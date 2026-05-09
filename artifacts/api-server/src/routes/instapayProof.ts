import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { db } from "@workspace/db";
import { instapayProofs } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { addShopifyOrderNote, tagShopifyOrder, sendWhatsApp } from "../lib/integrations";
import { logger } from "../lib/logger";
import {
  createDraftOrder,
  type OrderLine,
  type CustomerInfo,
} from "../lib/shopifyOrder";

const router: IRouter = Router();

const ALLOWED_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

/**
 * POST /api/orders/instapay-proof
 *
 * Creates the Shopify order AND records proof atomically.
 * The order is only created here — at proof submission time — never before.
 *
 * Form fields (multipart/form-data):
 *   lines         — JSON array of { variantId, quantity }
 *   customer      — JSON object with customer fields
 *   cartId        — (optional) Shopify Storefront cart ID
 *   discountCode  — (optional) discount code
 *   referenceNumber — Instapay reference number
 *   customerName  — display name (optional, derived from customer if omitted)
 *   customerPhone — phone (optional, derived from customer if omitted)
 *   amount        — display total string (optional, used for WhatsApp message)
 *   screenshot    — image file (required)
 */
router.post(
  "/orders/instapay-proof",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("screenshot")(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "File too large. Maximum size is 10 MB." });
          return;
        }
        res.status(400).json({ error: err instanceof Error ? err.message : "Invalid file." });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const body = req.body as Record<string, string>;
    const { referenceNumber, cartId, discountCode } = body;

    if (!referenceNumber?.trim()) {
      res.status(400).json({ error: "referenceNumber is required." });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Payment screenshot is required." });
      return;
    }

    // Parse lines and customer from JSON form fields
    let lines: OrderLine[];
    let customer: CustomerInfo;
    try {
      lines = JSON.parse(body.lines ?? "[]") as OrderLine[];
      customer = JSON.parse(body.customer ?? "{}") as CustomerInfo;
    } catch {
      res.status(400).json({ error: "Invalid order data." });
      return;
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ error: "No items in order." });
      return;
    }

    if (
      !customer?.firstName?.trim() ||
      !customer?.lastName?.trim() ||
      !customer?.phone?.trim() ||
      !customer?.address?.trim() ||
      !customer?.governorate?.trim() ||
      !customer?.city?.trim()
    ) {
      res.status(400).json({ error: "Customer information is incomplete." });
      return;
    }

    // 1. Create Shopify draft order tagged as pending-verification
    let shopifyOrderId: number;
    let shopifyOrderNumber: number;
    let total: string;

    try {
      const result = await createDraftOrder({
        lines,
        customer,
        paymentMethod: "instapay",
        cartId: cartId?.trim() || undefined,
        discountCode: discountCode?.trim() || undefined,
        extraTags: "instapay-pending-verification",
      });
      shopifyOrderId = result.orderId;
      shopifyOrderNumber = result.orderNumber;
      total = result.total;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Order creation failed";
      logger.error({ err }, "Instapay proof — Shopify order creation failed");
      if (message.includes("not applicable")) {
        res.status(422).json({ error: message });
      } else {
        res.status(500).json({ error: "Could not place your order. Please try again." });
      }
      return;
    }

    // 2. Duplicate-proof check (idempotent — should not happen, but guard anyway)
    const existing = await db
      .select({ id: instapayProofs.id })
      .from(instapayProofs)
      .where(
        and(
          eq(instapayProofs.shopifyOrderId, shopifyOrderId),
          or(eq(instapayProofs.status, "pending"), eq(instapayProofs.status, "approved")),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({ ok: true, alreadySubmitted: true, orderNumber: shopifyOrderNumber, shopifyOrderId, total });
      return;
    }

    // 3. Upload screenshot to object storage
    let screenshotKey: string;
    try {
      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const key = `instapay-proofs/${shopifyOrderId}-${Date.now()}.${ext}`;
      const bucket = getBucket();
      const file = bucket.file(key);
      await file.save(req.file.buffer, { contentType: req.file.mimetype });
      screenshotKey = key;
    } catch (err) {
      logger.error({ err }, "Screenshot upload to object storage failed");
      res.status(500).json({ error: "Failed to upload screenshot. Please try again." });
      return;
    }

    const customerName = body.customerName?.trim() ||
      `${customer.firstName} ${customer.lastName}`.trim();
    const customerPhone = body.customerPhone?.trim() || customer.phone;
    const amountDisplay = body.amount?.trim() || total;

    // 4. Insert DB row
    await db.insert(instapayProofs).values({
      shopifyOrderId,
      shopifyOrderNumber,
      customerPhone: customerPhone ?? null,
      customerName: customerName ?? null,
      amount: amountDisplay ?? null,
      referenceNumber: referenceNumber.trim(),
      screenshotKey,
      status: "pending",
    });

    // 5. Shopify note + tag (fire-and-forget)
    void addShopifyOrderNote(shopifyOrderId, `InstaPay proof submitted — ref: ${referenceNumber.trim()}`);
    void tagShopifyOrder(shopifyOrderId, "instapay-proof-submitted");

    // 6. WhatsApp to business owner
    const businessWA = process.env.BUSINESS_WHATSAPP_NUMBER ?? "";
    const siteUrl = process.env.SITE_URL ?? "";
    if (businessWA) {
      void sendWhatsApp(
        businessWA,
        `📋 InstaPay proof — order #${shopifyOrderNumber}\nRef: ${referenceNumber.trim()}\nAmount: ${amountDisplay} EGP\nCustomer: ${customerName} · ${customerPhone}\nReview: ${siteUrl}/admin`,
      );
    }

    // 7. WhatsApp to customer
    void sendWhatsApp(
      customerPhone,
      `🎉 Your Moi order #${shopifyOrderNumber} is being verified!\n\nRef: ${referenceNumber.trim()}\nTotal: ${amountDisplay} EGP\n\nOur team will confirm your order via WhatsApp once payment is verified. Thank you! 🖤`,
    );

    res.status(200).json({ ok: true, orderNumber: shopifyOrderNumber, shopifyOrderId, total });
  },
);

export default router;
