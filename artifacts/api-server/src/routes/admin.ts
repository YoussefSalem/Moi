import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { instapayProofs, abandonedCarts, paymobIntents } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, count, isNull, inArray } from "drizzle-orm";
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
import { listDiscountCodeUses } from "@workspace/db";
import { sendEmail, buildAbandonedCartEmail, buildInstapayConfirmedEmail, buildInstapayRejectedEmail } from "../lib/email";
import { getSiteUrl } from "../lib/siteUrl";
import { completeShopifyDraftOrder } from "../lib/shopifyOrder";
import { parseEGP } from "@workspace/utils";

const router: IRouter = Router();

/**
 * Derives a scoped session token from ADMIN_SECRET using HMAC-SHA256.
 * The raw secret never leaves the server — only this derived token is
 * sent to the browser as the bearer credential.
 */
function deriveSessionToken(adminSecret: string): string {
  return crypto
    .createHmac("sha256", adminSecret)
    .update("moi-admin-session-v1")
    .digest("base64url");
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }
  const auth = req.headers.authorization;
  const expectedToken = deriveSessionToken(adminSecret);
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!provided) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const ok = crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(expectedToken),
    );
    if (!ok) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// POST /api/admin/login — public, no auth required.
// Validates the supplied PIN against ADMIN_PIN (a server-only env var separate
// from ADMIN_SECRET). On success returns a derived session token (HMAC of
// ADMIN_SECRET); the raw secret is never transmitted to the browser and the PIN
// is never used for signing — the two concerns are deliberately separate.
router.post("/admin/login", (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const adminPin = process.env.ADMIN_PIN ?? process.env.VITE_ADMIN_PIN;
  if (!adminSecret || !adminPin) {
    res.status(503).json({ error: "Admin not configured." });
    return;
  }
  const body = req.body as { secret?: unknown };
  if (typeof body.secret !== "string" || body.secret !== adminPin) {
    res.status(401).json({ error: "Incorrect PIN." });
    return;
  }
  const token = deriveSessionToken(adminSecret);
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  res.status(200).json({ token, expiresAt });
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
    draftOrderId: r.draftOrderId,
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
  const id = parseInt(String(req.params.id), 10);
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
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(instapayProofs).where(eq(instapayProofs.id, id)).limit(1);
  const proof = rows[0];
  if (!proof) { res.status(404).json({ error: "Proof not found" }); return; }
  if (proof.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();

  // Step 1: Complete the Shopify draft order (converts draft → real order)
  // The Bosta Shopify app will auto-fulfill the real order when it sees it.
  let orderId: number | null = null;
  let orderNumber: number | null = null;

  if (proof.draftOrderId) {
    const completed = await completeShopifyDraftOrder(proof.draftOrderId);
    if (completed) {
      orderId = completed.orderId;
      orderNumber = completed.orderNumber;
      req.log.info({ draftOrderId: proof.draftOrderId, orderId, orderNumber }, "InstaPay draft order completed on admin approval");
    } else {
      req.log.error({ draftOrderId: proof.draftOrderId }, "Failed to complete draft order on admin approval");
      res.status(500).json({ error: "Could not complete the order. Please check Shopify and try again." });
      return;
    }
  } else {
    req.log.error({ id }, "InstaPay proof missing draftOrderId; cannot complete");
    res.status(500).json({ error: "Proof record is missing the draft order ID." });
    return;
  }

  // Step 2: Tag the new real order
  await tagShopifyOrder(orderId, "instapay-admin-approved");
  await tagShopifyOrder(orderId, "instapay");

  // Step 3: Check if already fulfilled by Shopify Bosta app (skip duplicate Bosta)
  let alreadyFulfilled = false;
  if (storeDomain && adminToken) {
    try {
      const orderRes = await fetch(
        `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=fulfillment_status,shipping_address,note_attributes`,
        { headers: { "X-Shopify-Access-Token": adminToken! } },
      );
      if (orderRes.ok) {
        const orderData = await orderRes.json() as {
          order: { fulfillment_status?: string | null | undefined; shipping_address?: { city?: string; address1?: string }; note_attributes?: { name: string; value: string }[] };
        };
        alreadyFulfilled = Boolean(orderData.order.fulfillment_status);
        if (alreadyFulfilled) {
          req.log.info({ orderId }, "InstaPay order auto-fulfilled by Shopify Bosta app on approval");
        }
      }
    } catch (err) {
      req.log.error({ err }, "Could not check Shopify fulfillment status on approve");
    }
  }

  // Step 4: Create Bosta shipment (skip if already fulfilled by Bosta app)
  let city = "Cairo";
  let address = "";
  if (!alreadyFulfilled && proof.customerPhone && proof.customerName) {
    const nameParts = proof.customerName.trim().split(" ");
    const firstName = nameParts[0] ?? proof.customerName;
    const lastName = nameParts.slice(1).join(" ") || firstName;

    try {
      const orderRes = await fetch(
        `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=shipping_address`,
        { headers: { "X-Shopify-Access-Token": adminToken! } },
      );
      if (orderRes.ok) {
        const orderData = await orderRes.json() as {
          order: { shipping_address?: { city?: string; address1?: string } };
        };
        city = orderData.order.shipping_address?.city ?? city;
        address = orderData.order.shipping_address?.address1 ?? "";
      }
    } catch (err) {
      req.log.warn({ err }, "Could not fetch shipping address from Shopify on approve; using defaults");
    }

    try {
      const trackingNumber = await createBostaShipment({
        firstName,
        lastName,
        phone: proof.customerPhone,
        address,
        city,
        orderReference: `#${orderNumber}`,
        codAmount: 0,
      });

      if (trackingNumber) {
        void addShopifyOrderNote(orderId, `Bosta tracking: ${trackingNumber}\nPayment: Instapay (admin approved)`);
        void tagShopifyOrder(orderId, `bosta-${trackingNumber}`);
        const fulfillmentId = await createShopifyFulfillment(orderId, trackingNumber);
        if (fulfillmentId) {
          void addShopifyFulfillmentEvent(orderId, fulfillmentId, "in_transit");
        }
        req.log.info({ trackingNumber, orderId }, "Bosta shipment created on InstaPay approval");
      }
    } catch (err) {
      req.log.error({ err }, "Bosta shipment creation failed on approve");
    }
  }

  // Step 5: Fetch customer email + shipping address from Shopify order for email
  let customerEmail = "";
  let shipAddress = "";
  let shipCity = city;
  let shipGov = "";
  if (storeDomain && adminToken) {
    try {
      const orderRes = await fetch(
        `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=email,shipping_address`,
        { headers: { "X-Shopify-Access-Token": adminToken! } },
      );
      if (orderRes.ok) {
        const o = await orderRes.json() as {
          order: { email?: string; shipping_address?: { address1?: string; city?: string; province?: string } };
        };
        customerEmail = o.order.email ?? "";
        shipAddress = o.order.shipping_address?.address1 ?? address;
        shipCity = o.order.shipping_address?.city ?? city;
        shipGov = o.order.shipping_address?.province ?? "";
      }
    } catch (err) {
      req.log.warn({ err }, "Could not fetch customer email from Shopify order");
    }
  }

  // Step 6: WhatsApp + email to customer
  if (proof.customerPhone) {
    void sendWhatsApp(
      proof.customerPhone,
      `✅ Payment confirmed for Moi order #${orderNumber}! Your order is being prepared. You'll receive a tracking update soon. 🖤`,
    );
  }
  if (customerEmail) {
    const shippingPrice = parseEGP(proof.amount ?? "0") >= 2000 ? "0.00" : "50.00";
    const { html, text } = buildInstapayConfirmedEmail({
      orderNumber: orderNumber!,
      customerName: proof.customerName ?? "",
      total: proof.amount ?? "",
      referenceNumber: proof.referenceNumber,
      address: shipAddress,
      city: shipCity,
      governorate: shipGov,
      shippingAmount: shippingPrice,
    });
    void sendEmail({ to: customerEmail, subject: `Payment Confirmed — Moi Order #${orderNumber}`, html, text })
      .then(() => req.log.info({ email: customerEmail, orderNumber }, "InstaPay confirmed email sent"))
      .catch((err) => req.log.warn({ err, email: customerEmail }, "InstaPay confirmed email failed"));
  }

  // Step 7: Update DB with real order IDs
  await db
    .update(instapayProofs)
    .set({ status: "approved", reviewedAt: new Date(), shopifyOrderId: orderId, shopifyOrderNumber: orderNumber })
    .where(eq(instapayProofs.id, id));

  req.log.info({ id, shopifyOrderId: orderId, shopifyOrderNumber: orderNumber }, "InstaPay proof approved — draft completed to real order");
  res.status(200).json({ ok: true });
});

// POST /admin/instapay-proofs/:id/reject
router.post("/admin/instapay-proofs/:id/reject", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { reason } = req.body as { reason?: string };

  const rows = await db.select().from(instapayProofs).where(eq(instapayProofs.id, id)).limit(1);
  const proof = rows[0];
  if (!proof) { res.status(404).json({ error: "Proof not found" }); return; }
  if (proof.status === "rejected") { res.status(409).json({ error: "Already rejected" }); return; }

  // Step 1: Update DB
  await db
    .update(instapayProofs)
    .set({ status: "rejected", rejectionReason: reason ?? null, reviewedAt: new Date() })
    .where(eq(instapayProofs.id, id));

  // Step 2: Fetch customer email from draft order BEFORE deleting it (need email for rejection notification)
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  let customerEmail = "";

  if (storeDomain && adminToken && proof.draftOrderId) {
    try {
      const draftRes = await fetch(
        `https://${storeDomain}/admin/api/2024-04/draft_orders/${proof.draftOrderId}.json?fields=email`,
        { headers: { "X-Shopify-Access-Token": adminToken } },
      );
      if (draftRes.ok) {
        const d = await draftRes.json() as { draft_order?: { email?: string } };
        customerEmail = d.draft_order?.email ?? "";
      }
    } catch (err) {
      req.log.warn({ err }, "Could not fetch customer email from draft order for rejection");
    }
  }

  // Step 3: Delete the Shopify draft order (order never became real, so we just delete the draft)
  if (storeDomain && adminToken && proof.draftOrderId) {
    try {
      const deleteRes = await fetch(
        `https://${storeDomain}/admin/api/2024-04/draft_orders/${proof.draftOrderId}.json`,
        {
          method: "DELETE",
          headers: { "X-Shopify-Access-Token": adminToken },
        },
      );
      if (deleteRes.ok || deleteRes.status === 404) {
        req.log.info({ draftOrderId: proof.draftOrderId }, "Shopify draft order deleted on InstaPay rejection");
      } else {
        const errBody = await deleteRes.text();
        req.log.warn({ status: deleteRes.status, body: errBody, draftOrderId: proof.draftOrderId }, "Shopify draft order delete failed");
      }
    } catch (err) {
      req.log.error({ err, draftOrderId: proof.draftOrderId }, "Shopify draft order delete request failed");
    }
  }

  // Step 4: WhatsApp + email to customer
  if (proof.customerPhone) {
    void sendWhatsApp(
      proof.customerPhone,
      `⚠️ We could not verify your payment for Moi order.${reason ? `\n\nReason: ${reason}` : ""}\n\nYour order has been cancelled. Please contact us via WhatsApp if you believe this is a mistake. 🖤`,
    );
  }
  if (customerEmail) {
    const { html, text } = buildInstapayRejectedEmail({
      draftOrderId: proof.draftOrderId ?? id,
      customerName: proof.customerName ?? "",
      total: proof.amount ?? "",
      referenceNumber: proof.referenceNumber,
      rejectionReason: reason ?? null,
    });
    void sendEmail({ to: customerEmail, subject: `Payment Not Confirmed — Draft Order #${proof.draftOrderId ?? id}`, html, text })
      .then(() => req.log.info({ email: customerEmail, draftOrderId: proof.draftOrderId }, "InstaPay rejection email sent"))
      .catch((err) => req.log.warn({ err, email: customerEmail }, "InstaPay rejection email failed"));
  }

  req.log.info({ id, reason, draftOrderId: proof.draftOrderId }, "InstaPay proof rejected and draft deleted");
  res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Card order dispatch (Paymob card payments — admin approves Bosta shipment)
// ---------------------------------------------------------------------------

// GET /admin/card-orders — list all Paymob intents that have payment activity
// (completed, processing, failed, declined) — pending intents that never
// progressed are excluded to avoid clutter.
router.get("/admin/card-orders", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(paymobIntents)
      .where(inArray(paymobIntents.status, ["completed", "processing", "failed", "declined"]))
      .orderBy(desc(paymobIntents.createdAt));

    const result = rows.map((r) => {
      const customer = r.customer as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        address?: string;
        city?: string;
        governorate?: string;
        email?: string;
      };
      return {
        id: r.id,
        intentId: r.intentId,
        status: r.status,
        shopifyOrderId: r.shopifyOrderId,
        shopifyConfirmedOrderId: r.shopifyConfirmedOrderId,
        paymobTxnId: r.paymobTxnId,
        total: r.total,
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
        customerPhone: customer.phone ?? null,
        customerEmail: customer.email ?? null,
        address: customer.address ?? null,
        city: customer.city ?? null,
        adminApproved: r.adminApproved,
        adminApprovedAt: r.adminApprovedAt,
        bostaDispatched: r.bostaDispatched,
        bostaTrackingNumber: r.bostaTrackingNumber,
        bostaDispatchedAt: r.bostaDispatchedAt,
        createdAt: r.createdAt,
      };
    });

    res.status(200).json({ orders: result });
  } catch (err) {
    req.log.error({ err }, "card-orders: failed to fetch");
    res.status(500).json({ error: "Failed to fetch card orders" });
  }
});

// POST /admin/card-orders/:id/approve — convert Shopify draft order to a confirmed order
router.post("/admin/card-orders/:id/approve", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(paymobIntents).where(eq(paymobIntents.id, id)).limit(1);
  const intent = rows[0];
  if (!intent) { res.status(404).json({ error: "Order not found" }); return; }
  if (intent.status !== "completed") { res.status(409).json({ error: "Order not in completed state" }); return; }
  if (intent.adminApproved) { res.status(409).json({ error: "Order already approved" }); return; }
  if (!intent.shopifyOrderId) { res.status(409).json({ error: "No Shopify draft order linked — payment may still be processing" }); return; }

  req.log.info({ id, draftOrderId: intent.shopifyOrderId }, "card-orders approve: completing Shopify draft order");

  const result = await completeShopifyDraftOrder(intent.shopifyOrderId).catch((err: unknown) => {
    req.log.error({ err, id }, "card-orders approve: completeShopifyDraftOrder threw");
    return null;
  });

  if (!result) {
    res.status(502).json({ error: "Failed to complete Shopify draft order — check Shopify credentials and draft order status" });
    return;
  }

  await db
    .update(paymobIntents)
    .set({
      adminApproved: true,
      adminApprovedAt: new Date(),
      shopifyConfirmedOrderId: result.orderId,
    })
    .where(eq(paymobIntents.id, id));

  req.log.info({ id, draftOrderId: intent.shopifyOrderId, confirmedOrderId: result.orderId, orderNumber: result.orderNumber }, "card-orders approve: draft completed → confirmed Shopify order");
  res.status(200).json({ ok: true, orderId: result.orderId, orderNumber: result.orderNumber, total: result.total });
});

// POST /admin/card-orders/:id/dispatch — create Bosta shipment and mark dispatched
router.post("/admin/card-orders/:id/dispatch", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(paymobIntents).where(eq(paymobIntents.id, id)).limit(1);
  const intent = rows[0];
  if (!intent) { res.status(404).json({ error: "Order not found" }); return; }
  if (intent.status !== "completed") { res.status(409).json({ error: "Order not completed" }); return; }
  if (!intent.adminApproved) { res.status(409).json({ error: "Order must be approved before dispatch — click Approve first to confirm the Shopify order" }); return; }
  if (intent.bostaDispatched) { res.status(409).json({ error: "Already dispatched" }); return; }

  // Use the confirmed real order ID for Shopify operations; fall back to draft ID
  const shopifyOrderId = intent.shopifyConfirmedOrderId ?? intent.shopifyOrderId;
  if (!shopifyOrderId) { res.status(409).json({ error: "No Shopify order linked" }); return; }

  const customer = intent.customer as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
  };

  if (!customer.firstName || !customer.address) {
    res.status(422).json({ error: "Missing customer address data" });
    return;
  }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();

  // Fetch shipping address from the confirmed Shopify order
  let address = customer.address;
  let city = customer.city ?? "Cairo";
  if (storeDomain && adminToken) {
    try {
      const orderRes = await fetch(
        `https://${storeDomain}/admin/api/2024-04/orders/${shopifyOrderId}.json?fields=shipping_address`,
        { headers: { "X-Shopify-Access-Token": adminToken } },
      );
      if (orderRes.ok) {
        const orderData = await orderRes.json() as {
          order: { shipping_address?: { address1?: string; city?: string } };
        };
        address = orderData.order.shipping_address?.address1 ?? address;
        city = orderData.order.shipping_address?.city ?? city;
      }
    } catch (err) {
      req.log.warn({ err }, "card-orders dispatch: could not fetch Shopify address, using intent data");
    }
  }

  const orderRef = `#${intent.paymobTxnId ?? intent.intentId}`;

  try {
    const trackingNumber = await createBostaShipment({
      firstName: customer.firstName,
      lastName: customer.lastName ?? customer.firstName,
      phone: customer.phone ?? "",
      address,
      city,
      orderReference: orderRef,
      codAmount: 0,
    });

    if (!trackingNumber) {
      res.status(502).json({ error: "Bosta did not return a tracking number" });
      return;
    }

    // Update intent
    await db
      .update(paymobIntents)
      .set({ bostaDispatched: true, bostaTrackingNumber: trackingNumber, bostaDispatchedAt: new Date() })
      .where(eq(paymobIntents.id, id));

    // Tag Shopify order + add note + create fulfillment (fire-and-forget)
    void addShopifyOrderNote(shopifyOrderId, `Bosta tracking: ${trackingNumber}\nPayment: Paymob Card (admin dispatched)`);
    void tagShopifyOrder(shopifyOrderId, `bosta-${trackingNumber}`);
    const fulfillmentId = await createShopifyFulfillment(shopifyOrderId, trackingNumber);
    if (fulfillmentId) {
      void addShopifyFulfillmentEvent(shopifyOrderId, fulfillmentId, "in_transit");
    }

    req.log.info({ id, trackingNumber, shopifyOrderId }, "card-orders: Bosta shipment dispatched");
    res.status(200).json({ ok: true, trackingNumber });
  } catch (err) {
    req.log.error({ err }, "card-orders dispatch: Bosta shipment creation failed");
    res.status(500).json({ error: "Failed to create Bosta shipment" });
  }
});

/**
 * POST /api/admin/test-discount-counter
 *
 * Dev/debug endpoint. Creates a minimal Shopify order with a discount code via
 * the Orders API (the only way usage_count increments for API orders), checks
 * the before/after usage_count via Admin GraphQL, then deletes the test order.
 * Protected by admin auth.
 */
router.post("/admin/test-discount-counter", requireAdminAuth, async (req, res) => {
  const body = req.body as { discountCode?: string; keepOrder?: boolean };
  const code = ((body.discountCode as string | undefined) || "DODO15").trim().toUpperCase();
  const keepOrder = body.keepOrder === true;

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  const staticToken = process.env.SHOPIFY_ADMIN_API_TOKEN ?? adminToken;

  if (!storeDomain || !adminToken) {
    res.status(503).json({ error: "Shopify not configured" });
    return;
  }

  async function queryUsageCount(token: string): Promise<{ usageLimit: number | null; asyncUsageCount: number } | null> {
    try {
      const r = await fetch(`https://${storeDomain}/admin/api/2024-04/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({
          query: `{ codeDiscountNodeByCode(code: "${code}") { codeDiscount { ... on DiscountCodeBasic { usageLimit asyncUsageCount } } } }`,
        }),
      });
      if (!r.ok) return null;
      const d = await r.json() as {
        data?: { codeDiscountNodeByCode?: { codeDiscount?: { usageLimit?: number | null; asyncUsageCount?: number } | null } | null };
      };
      const dc = d?.data?.codeDiscountNodeByCode?.codeDiscount;
      if (dc === undefined || dc === null) return null;
      return { usageLimit: dc.usageLimit ?? null, asyncUsageCount: dc.asyncUsageCount ?? 0 };
    } catch { return null; }
  }

  // Try OAuth token first, then static token for read queries
  async function getUsageCount(): Promise<{ usageLimit: number | null; asyncUsageCount: number } | null> {
    return (await queryUsageCount(adminToken!)) ?? (staticToken ? await queryUsageCount(staticToken) : null);
  }

  // Find a variant to use in the test order.
  // Try Admin REST (needs read_products), then fall back to Storefront API.
  let variantId: number | null = null;
  let variantPrice = "500.00";

  for (const token of [adminToken, staticToken].filter(Boolean)) {
    try {
      const r = await fetch(`https://${storeDomain}/admin/api/2024-04/products.json?limit=1&fields=id,variants`, {
        headers: { "X-Shopify-Access-Token": token! },
      });
      if (r.ok) {
        const d = await r.json() as { products?: Array<{ variants?: Array<{ id: number; price: string }> }> };
        const v = d.products?.[0]?.variants?.[0];
        if (v?.id) { variantId = v.id; variantPrice = v.price; break; }
      }
    } catch { /* try next */ }
  }

  // Fallback: use Storefront API (always available)
  if (!variantId) {
    const storefrontToken = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;
    if (storefrontToken) {
      try {
        const sfRes = await fetch(`https://${storeDomain}/api/2024-04/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": storefrontToken,
          },
          body: JSON.stringify({
            query: `{ products(first:1) { edges { node { variants(first:1) { edges { node { id price { amount } } } } } } } }`,
          }),
        });
        if (sfRes.ok) {
          const sfData = await sfRes.json() as {
            data?: { products?: { edges?: Array<{ node?: { variants?: { edges?: Array<{ node?: { id?: string; price?: { amount?: string } } }> } } }> } };
          };
          const sfVariant = sfData.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node;
          if (sfVariant?.id) {
            // GID → integer: "gid://shopify/ProductVariant/12345" → 12345
            const numericId = sfVariant.id.split("/").pop();
            if (numericId) {
              variantId = parseInt(numericId, 10);
              variantPrice = sfVariant.price?.amount ?? "500.00";
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  if (!variantId) {
    res.status(422).json({
      error: "Could not find a product variant (tried Admin REST + Storefront API).",
    });
    return;
  }

  const before = await getUsageCount();

  // Create a minimal test order via Orders API with discount_codes
  const createRes = await fetch(`https://${storeDomain}/admin/api/2024-04/orders.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
    body: JSON.stringify({
      order: {
        send_receipt: true,
        send_fulfillment_receipt: false,
        financial_status: "pending",
        line_items: [{ variant_id: variantId, quantity: 1, price: variantPrice }],
        discount_codes: [{ code, amount: "100.00", type: "fixed_amount" }],
      },
    }),
  });

  const createData = await createRes.json() as { order?: { id: number; order_number: number }; errors?: unknown };
  const orderId = createData.order?.id;
  const orderNumber = createData.order?.order_number;

  if (!orderId) {
    res.status(500).json({ error: "Test order creation failed", shopifyErrors: createData.errors });
    return;
  }

  // Short pause — Shopify sometimes updates asyncUsageCount asynchronously
  await new Promise((r) => setTimeout(r, 1500));
  const after = await getUsageCount();

  // Clean up unless caller asked to keep the order (for manual Shopify admin inspection)
  if (!keepOrder) {
    await fetch(`https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json`, {
      method: "DELETE",
      headers: { "X-Shopify-Access-Token": adminToken },
    }).catch(() => { /* best effort */ });
  }

  const incremented = after !== null && before !== null
    ? after.asyncUsageCount > before.asyncUsageCount
    : null;

  req.log.info({ code, orderId, orderNumber, before, after, incremented, keepOrder }, "test-discount-counter result");

  res.status(200).json({
    discountCode: code,
    testOrderNumber: orderNumber,
    testOrderId: orderId,
    orderKept: keepOrder,
    before,
    after,
    usageCountIncremented: incremented,
    success: incremented === true,
    note: incremented === null
      ? keepOrder
        ? `Order #${orderNumber} kept alive — check Shopify admin Discounts → ${code} → "Used" count, then delete order #${orderNumber} manually`
        : "Could not read usage_count (read_discounts scope missing) — order was auto-deleted"
      : undefined,
  });
});

/**
 * GET /api/admin/discount-uses
 * Returns all discount code usage records from our DB (newest first).
 * Shopify's native "Used" counter stays 0 for Admin API orders — this DB is the
 * real source of truth for enforcement and reporting.
 */
router.get("/admin/discount-uses", requireAdminAuth, async (_req, res) => {
  try {
    const rows = await listDiscountCodeUses();
    res.status(200).json({ uses: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch discount uses" });
  }
});

// GET /admin/abandoned-carts?from=&to=&status=
router.get("/admin/abandoned-carts", requireAdminAuth, async (req, res) => {
  const { from, to, status } = req.query as { from?: string; to?: string; status?: string };

  const conditions = [];
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) conditions.push(gte(abandonedCarts.createdAt, d));
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) conditions.push(lte(abandonedCarts.createdAt, d));
  }
  if (status) {
    conditions.push(eq(abandonedCarts.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [startedCount] = await db.select({ count: count() }).from(abandonedCarts)
      .where(whereClause ? and(whereClause, eq(abandonedCarts.status, "started")) : eq(abandonedCarts.status, "started"));
    const [sentCount] = await db.select({ count: count() }).from(abandonedCarts)
      .where(whereClause ? and(whereClause, eq(abandonedCarts.status, "email_sent")) : eq(abandonedCarts.status, "email_sent"));
    const [clickedCount] = await db.select({ count: count() }).from(abandonedCarts)
      .where(whereClause ? and(whereClause, eq(abandonedCarts.status, "clicked")) : eq(abandonedCarts.status, "clicked"));
    const [recoveredCount] = await db.select({ count: count() }).from(abandonedCarts)
      .where(whereClause ? and(whereClause, eq(abandonedCarts.status, "recovered")) : eq(abandonedCarts.status, "recovered"));

    const [convertedBeforeEmailCount] = await db.select({ count: count() }).from(abandonedCarts)
      .where(whereClause
        ? and(whereClause, eq(abandonedCarts.status, "recovered"), isNull(abandonedCarts.emailSentAt))
        : and(eq(abandonedCarts.status, "recovered"), isNull(abandonedCarts.emailSentAt)));
    const [convertedAfterEmailCount] = await db.select({ count: count() }).from(abandonedCarts)
      .where(whereClause
        ? and(whereClause, eq(abandonedCarts.status, "recovered"), and(gte(abandonedCarts.recoveredAt, abandonedCarts.emailSentAt)))
        : and(eq(abandonedCarts.status, "recovered"), and(gte(abandonedCarts.recoveredAt, abandonedCarts.emailSentAt))));

    const started = startedCount?.count ?? 0;
    const sent = sentCount?.count ?? 0;
    const clicked = clickedCount?.count ?? 0;
    const recovered = recoveredCount?.count ?? 0;
    const totalStarted = started + sent + clicked + recovered;
    const recoveryRate = totalStarted > 0 ? Math.round((recovered / totalStarted) * 1000) / 10 : 0;
    const convertedBeforeEmail = convertedBeforeEmailCount?.count ?? 0;
    const convertedAfterEmail = convertedAfterEmailCount?.count ?? 0;
    const emailDrivenRate = recovered > 0 ? Math.round((convertedAfterEmail / recovered) * 1000) / 10 : 0;

    const rows = await db.select().from(abandonedCarts)
      .where(whereClause)
      .orderBy(desc(abandonedCarts.createdAt));

    const items = rows.map((r) => ({
      id: r.id,
      email: r.email,
      totalAmount: r.totalAmount,
      status: r.status,
      lineItemsCount: Array.isArray(r.lineItems) ? r.lineItems.length : 0,
      createdAt: r.createdAt,
      emailSentAt: r.emailSentAt,
      clickedAt: r.clickedAt,
      recoveredAt: r.recoveredAt,
    }));

    res.status(200).json({
      stats: { started, sent, clicked, recovered, totalStarted, recoveryRate, convertedBeforeEmail, convertedAfterEmail, emailDrivenRate },
      items,
    });
  } catch (err) {
    req.log.error({ err }, "abandoned-cart: admin fetch failed");
    res.status(500).json({ error: "Failed to fetch abandoned carts" });
  }
});

// POST /admin/abandoned-carts/send-test
// Creates a test abandoned cart with sample items and sends recovery email immediately.
// Only requires admin auth, no 30-min wait.
router.post("/admin/abandoned-carts/send-test", requireAdminAuth, async (req, res) => {
  const body = req.body as { to?: string; items?: Array<{ title: string; price: string; quantity?: number; imageUrl?: string; variant?: string }>; totalAmount?: string };
  const to = (body.to ?? "test@moi.com").trim().toLowerCase();
  const sampleItems = body.items && body.items.length > 0
    ? body.items.map((i) => ({
        title: i.title,
        price: i.price,
        quantity: i.quantity ?? 1,
        imageUrl: i.imageUrl,
        variant: i.variant,
      }))
    : [
        { title: "Moi Wavvy", price: "1.690 EGP", quantity: 1, variant: "Beige", imageUrl: "https://buy-moi.com/images/beige.webp" },
        { title: "Moi Versa Top", price: "1.690 EGP", quantity: 1, variant: "White", imageUrl: "https://buy-moi.com/images/white.webp" },
      ];
  const totalAmount = body.totalAmount ?? sampleItems.reduce((sum, i) => sum + parseEGP(i.price) * i.quantity, 0).toFixed(3);

  try {
    const token = crypto.randomBytes(16).toString("hex");
    const [row] = await db.insert(abandonedCarts).values({
      email: to,
      cartId: null,
      originalCartId: null,
      lineItems: sampleItems,
      totalAmount,
      recoveryToken: token,
      status: "started",
    }).returning();

    const siteUrl = getSiteUrl();
    const recoveryUrl = `${siteUrl}/?recover-cart=${token}`;

    const { html, text } = buildAbandonedCartEmail({
      customerEmail: to,
      lineItems: sampleItems,
      totalAmount,
      recoveryUrl,
      siteUrl,
    });

    await sendEmail({ to, subject: "You left something behind.", html, text });

    await db.update(abandonedCarts)
      .set({ status: "email_sent", emailSentAt: new Date(), updatedAt: new Date() })
      .where(eq(abandonedCarts.id, row.id));

    req.log.info({ id: row.id, email: to }, "abandoned-cart: test email sent");
    res.status(200).json({ ok: true, id: row.id, email: to, recoveryUrl, token });
  } catch (err) {
    req.log.error({ err }, "abandoned-cart: test email failed");
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// POST /admin/abandoned-carts/:id/send-now
// Sends recovery email for a specific cart immediately (bypasses 30-min delay).
router.post("/admin/abandoned-carts/:id/send-now", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const rows = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, id)).limit(1);
    const row = rows[0];
    if (!row) { res.status(404).json({ error: "Cart not found" }); return; }

    const siteUrl = getSiteUrl();
    const recoveryUrl = `${siteUrl}/?recover-cart=${row.recoveryToken}`;

    const repairedItems = (row.lineItems as Array<{ title: string; variant?: string; quantity: number; price: string; imageUrl?: string }>)
      .map((item) => ({
        ...item,
        imageUrl: item.imageUrl
          ? item.imageUrl.replace(/^https?:\/\/[^/]+\/images\//, `${siteUrl}/api/images/`)
          : item.imageUrl,
      }));

    const { html, text } = buildAbandonedCartEmail({
      customerEmail: row.email,
      lineItems: repairedItems,
      totalAmount: row.totalAmount,
      recoveryUrl,
      siteUrl,
    });

    await sendEmail({ to: row.email, subject: "You left something behind.", html, text });

    await db.update(abandonedCarts)
      .set({ status: "email_sent", emailSentAt: new Date(), updatedAt: new Date() })
      .where(eq(abandonedCarts.id, row.id));

    req.log.info({ id, email: row.email }, "abandoned-cart: manual send-now email sent");
    res.status(200).json({ ok: true, email: row.email, recoveryUrl });
  } catch (err) {
    req.log.error({ err, id }, "abandoned-cart: send-now failed");
    res.status(500).json({ error: "Failed to send email" });
  }
});

// GET /admin/paymob-config
router.get("/admin/paymob-config", (_req, res) => {
  res.status(200).json(getMaskedConfig());
});

// POST /admin/paymob-config
router.post("/admin/paymob-config", (req, res) => {
  const patch = req.body as Partial<PaymobConfig>;
  const allowed: (keyof PaymobConfig)[] = ["apiKey", "secretKey", "publicKey", "integrationId", "hmacSecret", "iframeId"];
  const filtered: Partial<PaymobConfig> = {};
  for (const key of allowed) {
    if (typeof patch[key] === "string" && (patch[key] as string).trim()) {
      filtered[key] = (patch[key] as string).trim();
    }
  }
  if (filtered.integrationId !== undefined) {
    const id = parseInt(filtered.integrationId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Integration ID must be a numeric ID (e.g. 123456) from your Paymob dashboard." });
      return;
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
