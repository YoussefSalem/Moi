import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { instapayProofs } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import {
  addShopifyOrderNote,
  tagShopifyOrder,
  sendWhatsApp,
  getShopifyAdminToken,
  createBostaShipment,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
} from "../lib/integrations";
import { getMaskedConfig, savePaymobConfig, type PaymobConfig } from "../lib/paymobConfig";

const router: IRouter = Router();

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${adminSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// POST /api/admin/login — public, no auth required
// Returns the admin secret as a bearer token so subsequent requests can use it.
// Session lifetime: 8 hours (enforced client-side; server always checks ADMIN_SECRET).
router.post("/admin/login", (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({ error: "Admin not configured." });
    return;
  }
  const body = req.body as { secret?: unknown };
  if (typeof body.secret !== "string" || body.secret !== adminSecret) {
    res.status(401).json({ error: "Incorrect PIN." });
    return;
  }
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  res.status(200).json({ token: adminSecret, expiresAt });
});

router.use("/admin", requireAdminAuth);

// GET /admin/instapay-proofs
router.get("/admin/instapay-proofs", async (req, res) => {
  const rows = await db
    .select()
    .from(instapayProofs)
    .orderBy(desc(instapayProofs.submittedAt));

  const result = rows.map((r) => ({
    id: r.id,
    shopifyOrderId: r.shopifyOrderId,
    shopifyOrderNumber: r.shopifyOrderNumber,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    amount: r.amount,
    referenceNumber: r.referenceNumber,
    status: r.status,
    rejectionReason: r.rejectionReason,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    hasScreenshot: !!r.screenshotKey,
  }));

  res.status(200).json({ proofs: result });
});

// GET /admin/instapay-proofs/:id/screenshot
router.get("/admin/instapay-proofs/:id/screenshot", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db.select().from(instapayProofs).where(eq(instapayProofs.id, id)).limit(1);
  const proof = rows[0];

  if (!proof || !proof.screenshotKey) {
    res.status(404).json({ error: "Screenshot not found" });
    return;
  }

  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(proof.screenshotKey);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Screenshot file not found in storage" });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", (metadata.contentType as string) || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    file.createReadStream().pipe(res);
  } catch (err) {
    req.log.error({ err }, "Failed to stream screenshot");
    res.status(500).json({ error: "Failed to retrieve screenshot" });
  }
});

// POST /admin/instapay-proofs/:id/approve
router.post("/admin/instapay-proofs/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(instapayProofs).where(eq(instapayProofs.id, id)).limit(1);
  const proof = rows[0];
  if (!proof) { res.status(404).json({ error: "Proof not found" }); return; }
  if (proof.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();

  // Step 1: Tag instapay-admin-approved FIRST (prevents duplicate Bosta in orders/paid webhook)
  await tagShopifyOrder(proof.shopifyOrderId, "instapay-admin-approved");

  // Step 2: Record Shopify capture transaction
  if (storeDomain && adminToken && proof.amount) {
    await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${proof.shopifyOrderId}/transactions.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
        body: JSON.stringify({
          transaction: {
            kind: "capture",
            gateway: "Instapay",
            amount: proof.amount,
          },
        }),
      },
    ).catch((err) => req.log.error({ err }, "Shopify capture transaction failed"));
  }

  // Step 3: Create Bosta shipment
  if (proof.customerPhone && proof.customerName) {
    const nameParts = proof.customerName.trim().split(" ");
    const firstName = nameParts[0] ?? proof.customerName;
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Fetch city from Shopify order
    let city = "Cairo";
    if (storeDomain && adminToken) {
      try {
        const orderRes = await fetch(
          `https://${storeDomain}/admin/api/2024-04/orders/${proof.shopifyOrderId}.json?fields=shipping_address,note_attributes`,
          { headers: { "X-Shopify-Access-Token": adminToken } },
        );
        if (orderRes.ok) {
          const orderData = await orderRes.json() as {
            order: { shipping_address?: { city?: string; address1?: string }; note_attributes?: { name: string; value: string }[] };
          };
          city = orderData.order.shipping_address?.city ?? city;
          const address = orderData.order.shipping_address?.address1 ?? "";

          const trackingNumber = await createBostaShipment({
            firstName,
            lastName,
            phone: proof.customerPhone,
            address,
            city,
            orderReference: `#${proof.shopifyOrderNumber}`,
            codAmount: 0,
          });

          if (trackingNumber) {
            void addShopifyOrderNote(proof.shopifyOrderId, `Bosta tracking: ${trackingNumber}\nPayment: Instapay (admin approved)`);
            void tagShopifyOrder(proof.shopifyOrderId, `bosta-${trackingNumber}`);
            const fulfillmentId = await createShopifyFulfillment(proof.shopifyOrderId, trackingNumber);
            if (fulfillmentId) {
              void addShopifyFulfillmentEvent(proof.shopifyOrderId, fulfillmentId, "in_transit");
            }
            req.log.info({ trackingNumber, orderId: proof.shopifyOrderId }, "Bosta shipment created on InstaPay approval");
          }
        }
      } catch (err) {
        req.log.error({ err }, "Bosta shipment creation failed on approve");
      }
    }
  }

  // Step 4: WhatsApp to customer
  if (proof.customerPhone) {
    void sendWhatsApp(
      proof.customerPhone,
      `✅ Payment confirmed for Moi order #${proof.shopifyOrderNumber}! Your order is being prepared. You'll receive a tracking update soon. 🖤`,
    );
  }

  // Step 5: Update DB
  await db
    .update(instapayProofs)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(instapayProofs.id, id));

  req.log.info({ id, shopifyOrderId: proof.shopifyOrderId }, "InstaPay proof approved");
  res.status(200).json({ ok: true });
});

// POST /admin/instapay-proofs/:id/reject
router.post("/admin/instapay-proofs/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { reason } = req.body as { reason?: string };

  const rows = await db.select().from(instapayProofs).where(eq(instapayProofs.id, id)).limit(1);
  const proof = rows[0];
  if (!proof) { res.status(404).json({ error: "Proof not found" }); return; }
  if (proof.status === "rejected") { res.status(409).json({ error: "Already rejected" }); return; }

  await db
    .update(instapayProofs)
    .set({ status: "rejected", rejectionReason: reason ?? null, reviewedAt: new Date() })
    .where(eq(instapayProofs.id, id));

  void addShopifyOrderNote(proof.shopifyOrderId, `InstaPay proof rejected${reason ? `: ${reason}` : ""}`);
  void tagShopifyOrder(proof.shopifyOrderId, "instapay-proof-rejected");

  if (proof.customerPhone) {
    void sendWhatsApp(
      proof.customerPhone,
      `⚠️ We could not verify your Moi payment for order #${proof.shopifyOrderNumber}.${reason ? `\n\nReason: ${reason}` : ""}\n\nPlease contact us via WhatsApp for assistance. 🖤`,
    );
  }

  req.log.info({ id, reason }, "InstaPay proof rejected");
  res.status(200).json({ ok: true });
});

// GET /admin/paymob-config
router.get("/admin/paymob-config", (_req, res) => {
  res.status(200).json(getMaskedConfig());
});

// POST /admin/paymob-config
router.post("/admin/paymob-config", (req, res) => {
  const patch = req.body as Partial<PaymobConfig>;
  const allowed: (keyof PaymobConfig)[] = ["apiKey", "secretKey", "publicKey", "integrationId", "hmacSecret"];
  const filtered: Partial<PaymobConfig> = {};
  for (const key of allowed) {
    if (typeof patch[key] === "string" && (patch[key] as string).trim()) {
      filtered[key] = (patch[key] as string).trim();
    }
  }
  try {
    savePaymobConfig(filtered);
    res.status(200).json(getMaskedConfig());
  } catch {
    res.status(500).json({ error: "Failed to save config" });
  }
});

export default router;
