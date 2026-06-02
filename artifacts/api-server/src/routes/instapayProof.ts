import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { db } from "@workspace/db";
import { instapayProofs } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { addShopifyOrderNote, tagShopifyOrder, sendWhatsApp, getShopifyAdminToken } from "../lib/integrations";
import { sendEmail, buildInstapayPendingEmail, buildInstapayAdminReferenceEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { parseEGP } from "@workspace/utils";

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

    // 1. Fetch draft order details from Shopify (order stays as draft until admin approval)
    let totalPrice: string | null = null;
    let customerEmail: string | null = null;
    let draftDiscountAmount: number | undefined;
    let draftDiscountCode: string | undefined;
    let draftShippingAmount: string | undefined;

    try {
      const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
      const adminToken = await getShopifyAdminToken();
      if (storeDomain && adminToken) {
        const draftRes = await fetch(
          `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}.json?fields=total_price,email,line_items,applied_discount,note_attributes,shipping_line`,
          { headers: { "X-Shopify-Access-Token": adminToken } },
        );
        if (draftRes.ok) {
          const draftData = await draftRes.json() as {
            draft_order?: {
              total_price?: string;
              email?: string;
              applied_discount?: { title?: string; amount?: string } | null;
              note_attributes?: { name: string; value: string }[];
              shipping_line?: { price?: string } | null;
            };
          };
          const d = draftData.draft_order;
          if (d) {
            totalPrice = d.total_price ?? null;
            customerEmail = d.email ?? null;
            if (d.applied_discount?.title) draftDiscountCode = d.applied_discount.title;
            if (d.applied_discount?.amount) draftDiscountAmount = parseFloat(d.applied_discount.amount);
            if (d.shipping_line?.price !== undefined && d.shipping_line.price !== null) {
              draftShippingAmount = d.shipping_line.price;
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err, draftOrderId }, "Could not fetch draft order details");
    }

    // 2. Duplicate guard — by draftOrderId in pending|approved status
    const existing = await db
      .select({
        id: instapayProofs.id,
        draftOrderId: instapayProofs.draftOrderId,
        amount: instapayProofs.amount,
      })
      .from(instapayProofs)
      .where(
        and(
          eq(instapayProofs.draftOrderId, draftOrderId),
          or(eq(instapayProofs.status, "pending"), eq(instapayProofs.status, "approved")),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({
        ok: true,
        alreadySubmitted: true,
        orderNumber: draftOrderId,
        draftOrderId,
        total: existing[0].amount ?? totalPrice ?? "",
      });
      return;
    }

    // 3. Upload screenshot to object storage
    let screenshotKey: string;
    try {
      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const key = `instapay-proofs/draft-${draftOrderId}-${Date.now()}.${ext}`;
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
    const amountDisplay = body.amount?.trim() || totalPrice || "";

    // 4. Insert DB row (shopifyOrderId/shopifyOrderNumber stay null until approval)
    await db.insert(instapayProofs).values({
      draftOrderId,
      shopifyOrderId: null,
      shopifyOrderNumber: null,
      customerPhone: customerPhone || null,
      customerName: customerName || null,
      amount: amountDisplay || null,
      referenceNumber: referenceNumber.trim(),
      screenshotKey,
      status: "pending",
    });

    // 5. Generate signed URL for the screenshot (needed for both customer and admin emails)
    let screenshotUrl: string | undefined;
    try {
      const bucket = getBucket();
      const f = bucket.file(screenshotKey);
      const [signedUrl] = await f.getSignedUrl({ action: "read", expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      screenshotUrl = signedUrl;
    } catch {
      screenshotUrl = undefined;
    }

    // 6. Branded pending-verification email to customer (fire-and-forget)
    if (customerEmail) {
      const shippingPrice = draftShippingAmount ?? (parseEGP(amountDisplay) >= 2000 ? "0.00" : "50.00");
      const { html, text } = buildInstapayPendingEmail({
        orderNumber: draftOrderId,
        customerName: customerName,
        total: amountDisplay,
        referenceNumber: referenceNumber.trim(),
        discountAmount: draftDiscountAmount ? draftDiscountAmount.toFixed(2) : undefined,
        discountCode: draftDiscountCode || undefined,
        shippingAmount: shippingPrice,
        screenshotUrl: screenshotUrl || undefined,
      });
      void sendEmail({
        to: customerEmail,
        subject: `Your Moi order #${draftOrderId} — payment verification in progress`,
        html,
        text,
      })
        .then(() => logger.info({ email: customerEmail, draftOrderId }, "InstaPay pending email sent"))
        .catch((err) => logger.warn({ err, email: customerEmail }, "InstaPay pending email failed"));
    }

    // 7. Shopify note + tag on the DRAFT order (fire-and-forget)
    void addShopifyOrderNote(draftOrderId, `InstaPay proof submitted — ref: ${referenceNumber.trim()} (draft, awaiting approval)`);
    void tagShopifyOrder(draftOrderId, "instapay-proof-submitted");

    // 8. Admin notifications (WhatsApp + email)
    const businessWA = process.env.BUSINESS_WHATSAPP_NUMBER ?? "";
    const siteUrl = process.env.SITE_URL ?? "";
    if (businessWA) {
      void sendWhatsApp(
        businessWA,
        `📋 InstaPay proof — draft order #${draftOrderId}\nRef: ${referenceNumber.trim()}\nAmount: ${amountDisplay} EGP\nCustomer: ${customerName} · ${customerPhone}\nReview: ${siteUrl}/admin`,
      );
    }
    // 8b. Branded admin reference email (same Moi design, for support reference)
    const adminEmail = (process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "hello@buy-moi.com").trim();
    const { html: adminHtml, text: adminText } = buildInstapayAdminReferenceEmail({
      draftOrderId,
      customerName: customerName || "N/A",
      customerPhone: customerPhone || "N/A",
      referenceNumber: referenceNumber.trim(),
      amount: amountDisplay,
      screenshotUrl,
    });
    void sendEmail({
      to: adminEmail,
      subject: `Admin Reference — InstaPay Proof for Draft #${draftOrderId}`,
      html: adminHtml,
      text: adminText,
    }).then(() => logger.info({ draftOrderId, adminEmail }, "InstaPay admin reference email sent"))
      .catch((err) => logger.warn({ err, draftOrderId }, "InstaPay admin reference email failed"));

    // 8. WhatsApp to customer
    if (customerPhone) {
      const shippingForWA = draftShippingAmount ?? (parseEGP(amountDisplay) >= 2000 ? "0.00" : "50.00");
      const shippingNum = parseEGP(shippingForWA);
      const whatsappShippingNote = shippingNum === 0
        ? "Complimentary shipping"
        : `Includes ${shippingNum.toFixed(0)} EGP shipping`;
      void sendWhatsApp(
        customerPhone,
        `🎉 Your Moi order #${draftOrderId} is being verified!\n\nRef: ${referenceNumber.trim()}\nTotal: ${amountDisplay} EGP (${whatsappShippingNote})\n\nOur team will confirm your order via WhatsApp once payment is verified. Thank you! 🖤`,
      );
    }

    res.status(200).json({ ok: true, orderNumber: draftOrderId, draftOrderId, shopifyOrderId: null, total: amountDisplay });
  },
);

export default router;
