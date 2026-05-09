import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { instapayProofs } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { addShopifyOrderNote, tagShopifyOrder, sendWhatsApp } from "../lib/integrations";
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

router.post("/orders/instapay-proof", upload.single("screenshot"), async (req, res) => {
  const { orderId, orderNumber, customerName, customerPhone, amount, referenceNumber } = req.body as Record<string, string>;

  const shopifyOrderId = parseInt(orderId, 10);
  const shopifyOrderNumber = parseInt(orderNumber, 10);

  if (!shopifyOrderId || isNaN(shopifyOrderId) || !referenceNumber?.trim()) {
    res.status(400).json({ error: "orderId and referenceNumber are required." });
    return;
  }

  // Duplicate check
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
    res.status(200).json({ ok: false, alreadySubmitted: true });
    return;
  }

  // Upload screenshot to object storage
  let screenshotKey: string | null = null;
  if (req.file) {
    try {
      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const key = `instapay-proofs/${shopifyOrderId}-${Date.now()}.${ext}`;
      const bucket = getBucket();
      const file = bucket.file(key);
      await file.save(req.file.buffer, { contentType: req.file.mimetype });
      screenshotKey = key;
    } catch (err) {
      logger.error({ err }, "Screenshot upload to object storage failed");
    }
  }

  // Insert DB row
  await db.insert(instapayProofs).values({
    shopifyOrderId,
    shopifyOrderNumber: isNaN(shopifyOrderNumber) ? shopifyOrderId : shopifyOrderNumber,
    customerPhone: customerPhone ?? null,
    customerName: customerName ?? null,
    amount: amount ?? null,
    referenceNumber: referenceNumber.trim(),
    screenshotKey,
    status: "pending",
  });

  // Shopify note + tag (fire-and-forget)
  void addShopifyOrderNote(shopifyOrderId, `InstaPay proof submitted — ref: ${referenceNumber.trim()}`);
  void tagShopifyOrder(shopifyOrderId, "instapay-proof-submitted");

  // WhatsApp to business owner
  const businessWA = process.env.BUSINESS_WHATSAPP_NUMBER ?? "";
  const siteUrl = process.env.SITE_URL ?? "";
  if (businessWA) {
    void sendWhatsApp(
      businessWA,
      `📋 InstaPay proof — order #${shopifyOrderNumber}\nRef: ${referenceNumber.trim()}\nAmount: ${amount ?? "?"} EGP\nCustomer: ${customerName ?? "?"} · ${customerPhone ?? "?"}\nReview: ${siteUrl}/admin`,
    );
  }

  res.status(200).json({ ok: true });
});

export default router;
