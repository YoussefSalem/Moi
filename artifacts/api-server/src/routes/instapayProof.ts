import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { db } from "@workspace/db";
import { instapayProofs } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { addShopifyOrderNote, tagShopifyOrder, sendWhatsApp, getShopifyAdminToken } from "../lib/integrations";
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
 * Records payment proof for an EXISTING InstaPay order.
 * The Shopify order MUST already exist (created at instapay-init time).
 *
 * Form fields (multipart/form-data):
 *   shopifyOrderId   — existing Shopify order ID (integer, required)
 *   shopifyOrderNumber — existing Shopify order number (integer, required)
 *   referenceNumber  — InstaPay reference number (required)
 *   customerName     — display name (optional, for notifications)
 *   customerPhone    — phone (optional, for notifications)
 *   amount           — display total string (optional, for notifications)
 *   screenshot       — image file (required)
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

    const shopifyOrderId = parseInt(body.shopifyOrderId ?? "", 10);
    const shopifyOrderNumber = parseInt(body.shopifyOrderNumber ?? "", 10);

    if (!shopifyOrderId || isNaN(shopifyOrderId)) {
      res.status(400).json({ error: "shopifyOrderId is required." });
      return;
    }

    if (!shopifyOrderNumber || isNaN(shopifyOrderNumber)) {
      res.status(400).json({ error: "shopifyOrderNumber is required." });
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

    // 1. Duplicate guard — by shopifyOrderId in pending|approved status
    //    Prevents submitting proof twice for the same order.
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
          eq(instapayProofs.shopifyOrderId, shopifyOrderId),
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

    // 2. Derive authoritative order total + customer email from Shopify (fall back to client-provided)
    let amountDisplay = body.amount?.trim() || "";
    let customerEmail: string | null = null;
    try {
      const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
      const adminToken = await getShopifyAdminToken();
      if (storeDomain && adminToken) {
        const orderRes = await fetch(
          `https://${storeDomain}/admin/api/2024-04/orders/${shopifyOrderId}.json?fields=total_price,email`,
          { headers: { "X-Shopify-Access-Token": adminToken } },
        );
        if (orderRes.ok) {
          const orderData = await orderRes.json() as { order?: { total_price?: string; email?: string } };
          if (orderData.order?.total_price) amountDisplay = orderData.order.total_price;
          if (orderData.order?.email) customerEmail = orderData.order.email;
        }
      }
    } catch (err) {
      logger.warn({ err, shopifyOrderId }, "Could not fetch authoritative order data from Shopify, using client value");
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

    const customerName = body.customerName?.trim() || "";
    const customerPhone = body.customerPhone?.trim() || "";

    // 4. Insert DB row
    await db.insert(instapayProofs).values({
      shopifyOrderId,
      shopifyOrderNumber,
      customerPhone: customerPhone || null,
      customerName: customerName || null,
      amount: amountDisplay || null,
      referenceNumber: referenceNumber.trim(),
      screenshotKey,
      status: "pending",
    });

    // 4. Branded pending-verification email to customer (fire-and-forget)
    if (customerEmail) {
      const { html, text } = buildInstapayPendingEmail({
        orderNumber: shopifyOrderNumber,
        customerName: customerName,
        total: amountDisplay,
        referenceNumber: referenceNumber.trim(),
      });
      void sendEmail({
        to: customerEmail,
        subject: `Your Moi order #${shopifyOrderNumber} — payment verification in progress`,
        html,
        text,
      })
        .then(() => logger.info({ email: customerEmail, shopifyOrderNumber }, "InstaPay pending email sent"))
        .catch((err) => logger.warn({ err, email: customerEmail }, "InstaPay pending email failed"));
    }

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

    // 6. WhatsApp to customer
    if (customerPhone) {
      void sendWhatsApp(
        customerPhone,
        `🎉 Your Moi order #${shopifyOrderNumber} is being verified!\n\nRef: ${referenceNumber.trim()}\nTotal: ${amountDisplay} EGP\n\nOur team will confirm your order via WhatsApp once payment is verified. Thank you! 🖤`,
      );
    }

    res.status(200).json({ ok: true, orderNumber: shopifyOrderNumber, shopifyOrderId, total: amountDisplay });
  },
);

export default router;
