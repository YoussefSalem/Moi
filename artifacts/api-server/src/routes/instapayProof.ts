import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { db } from "@workspace/db";
import { instapayProofs } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { addShopifyOrderNote, tagShopifyOrder, sendWhatsApp, getShopifyAdminToken } from "../lib/integrations";
import { completeShopifyDraftOrder } from "../lib/shopifyOrder";
import { sendEmail, buildInstapayPendingEmail } from "../lib/email";
import { logger } from "../lib/logger";

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
 * Completes the Shopify draft order created at instapay-init time,
 * records payment proof, and sends notifications.
 *
 * Form fields (multipart/form-data):
 *   draftOrderId      — Shopify draft order ID from instapay-init (required)
 *   referenceNumber   — InstaPay reference number (required)
 *   customerName      — display name (optional, for notifications)
 *   customerPhone     — phone (optional, for notifications)
 *   amount            — display total string (optional, for notifications)
 *   screenshot        — image file (required)
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
    const { referenceNumber } = body;

    const draftOrderId = parseInt(body.draftOrderId ?? "", 10);

    if (!draftOrderId || isNaN(draftOrderId)) {
      res.status(400).json({ error: "draftOrderId is required." });
      return;
    }

    if (!referenceNumber?.trim()) {
      res.status(400).json({ error: "referenceNumber is required." });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Payment screenshot is required." });
      return;
    }

    // 1. Complete the Shopify draft order first
    let orderId: number;
    let orderNumber: number;
    let totalPrice: string;
    let customerEmail: string | null = null;

    const completed = await completeShopifyDraftOrder(draftOrderId);
    if (!completed) {
      res.status(500).json({ error: "Could not complete the order. Please try again or contact support." });
      return;
    }
    orderId = completed.orderId;
    orderNumber = completed.orderNumber;
    totalPrice = completed.total;
    const discountAmount = completed.discountAmount;
    const discountCode = completed.discountCode;

    // Fetch authoritative email from the completed order
    try {
      const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
      const adminToken = await getShopifyAdminToken();
      if (storeDomain && adminToken) {
        const orderRes = await fetch(
          `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=email`,
          { headers: { "X-Shopify-Access-Token": adminToken } },
        );
        if (orderRes.ok) {
          const orderData = await orderRes.json() as { order?: { email?: string } };
          if (orderData.order?.email) customerEmail = orderData.order.email;
        }
      }
    } catch (err) {
      logger.warn({ err, orderId }, "Could not fetch email from completed order");
    }

    // 2. Duplicate guard — by orderId in pending|approved status
    const existing = await db
      .select({
        id: instapayProofs.id,
        shopifyOrderId: instapayProofs.shopifyOrderId,
        shopifyOrderNumber: instapayProofs.shopifyOrderNumber,
        amount: instapayProofs.amount,
      })
      .from(instapayProofs)
      .where(
        and(
          eq(instapayProofs.shopifyOrderId, orderId),
          or(eq(instapayProofs.status, "pending"), eq(instapayProofs.status, "approved")),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({
        ok: true,
        alreadySubmitted: true,
        orderNumber: existing[0].shopifyOrderNumber,
        shopifyOrderId: existing[0].shopifyOrderId,
        total: existing[0].amount ?? "",
      });
      return;
    }

    // 3. Upload screenshot to object storage
    let screenshotKey: string;
    try {
      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const key = `instapay-proofs/${orderId}-${Date.now()}.${ext}`;
      const bucket = getBucket();
      const file = bucket.file(key);
      await file.save(req.file.buffer, { contentType: req.file.mimetype });
      screenshotKey = key;
    } catch (err) {
      logger.error({ err }, "Screenshot upload to object storage failed");
      res.status(500).json({ error: "Failed to upload screenshot. Please try again." });
      return;
    }

    const customerName = body.customerName?.trim() || "";
    const customerPhone = body.customerPhone?.trim() || "";
    const amountDisplay = body.amount?.trim() || totalPrice;

    // 4. Insert DB row
    await db.insert(instapayProofs).values({
      draftOrderId,
      shopifyOrderId: orderId,
      shopifyOrderNumber: orderNumber,
      customerPhone: customerPhone || null,
      customerName: customerName || null,
      amount: amountDisplay || null,
      referenceNumber: referenceNumber.trim(),
      screenshotKey,
      status: "pending",
    });

    // 5. Branded pending-verification email to customer (fire-and-forget)
    if (customerEmail) {
      const shippingPrice = parseFloat(amountDisplay) >= 2000 ? "0.00" : "50.00";
      const { html, text } = buildInstapayPendingEmail({
        orderNumber: orderNumber,
        customerName: customerName,
        total: amountDisplay,
        referenceNumber: referenceNumber.trim(),
        discountAmount: discountAmount ? discountAmount.toFixed(2) : undefined,
        discountCode: discountCode || undefined,
        shippingAmount: shippingPrice,
      });
      void sendEmail({
        to: customerEmail,
        subject: `Your Moi order #${orderNumber} — payment verification in progress`,
        html,
        text,
      })
        .then(() => logger.info({ email: customerEmail, orderNumber }, "InstaPay pending email sent"))
        .catch((err) => logger.warn({ err, email: customerEmail }, "InstaPay pending email failed"));
    }

    // 6. Shopify note + tag (fire-and-forget)
    void addShopifyOrderNote(orderId, `InstaPay proof submitted — ref: ${referenceNumber.trim()}`);
    void tagShopifyOrder(orderId, "instapay-proof-submitted");

    // 7. WhatsApp to business owner
    const businessWA = process.env.BUSINESS_WHATSAPP_NUMBER ?? "";
    const siteUrl = process.env.SITE_URL ?? "";
    if (businessWA) {
      void sendWhatsApp(
        businessWA,
        `📋 InstaPay proof — order #${orderNumber}\nRef: ${referenceNumber.trim()}\nAmount: ${amountDisplay} EGP\nCustomer: ${customerName} · ${customerPhone}\nReview: ${siteUrl}/admin`,
      );
    }

    // 8. WhatsApp to customer
    if (customerPhone) {
      void sendWhatsApp(
        customerPhone,
        `🎉 Your Moi order #${orderNumber} is being verified!\n\nRef: ${referenceNumber.trim()}\nTotal: ${amountDisplay} EGP\n\nOur team will confirm your order via WhatsApp once payment is verified. Thank you! 🖤`,
      );
    }

    res.status(200).json({ ok: true, orderNumber, shopifyOrderId: orderId, total: amountDisplay });
  },
);

export default router;
