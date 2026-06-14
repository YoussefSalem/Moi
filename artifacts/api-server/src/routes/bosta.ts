import crypto from "crypto";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  findOrderByTrackingNote,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
  tagShopifyOrder,
} from "../lib/integrations";
import { enqueueReviewEmail } from "../lib/reviewEmailQueue";

const router: IRouter = Router();

// Bosta → Shopify fulfillment event status mapping
const BOSTA_TO_SHOPIFY_STATUS: Record<string, string> = {
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED:        "delivered",
  IN_TRANSIT:       "in_transit",
  RETURNED:         "failure",
  CANCELLED:        "failure",
};

router.post("/bosta/create-shipment", async (_req, res) => {
  res.status(503).json({
    error: "Bosta shipment creation is disabled on this server. The Bosta Shopify app handles all shipments automatically.",
  });
});

// Bosta delivery-status webhook — updates Shopify fulfillment state and,
// on DELIVERED, enqueues a review-request email job 24-28 h out.
//
// Register in your Bosta dashboard:
//   POST /api/bosta/status-webhook
//
// Auth:
//   HMAC-SHA256: X-Bosta-Hmac-Signature header verified against BOSTA_WEBHOOK_SECRET.
//   Missing or invalid signature → 401.  No query-param fallback.
//
// req.body is a raw Buffer (express.raw applied in app.ts for this path).

function verifyBostaHmac(rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

router.post("/bosta/status-webhook", async (req, res) => {
  const webhookSecret = process.env.BOSTA_WEBHOOK_SECRET;

  if (!webhookSecret) {
    req.log.error("BOSTA_WEBHOOK_SECRET is not set; rejecting Bosta status webhook");
    res.status(503).json({ error: "Webhook secret not configured." });
    return;
  }

  const rawBody = req.body as Buffer;

  // Auth: HMAC-SHA256 only — no query-param fallback
  const hmacHeader = (req.headers["x-bosta-hmac-signature"] ?? "") as string;
  if (!hmacHeader) {
    req.log.warn("Bosta status webhook: missing X-Bosta-Hmac-Signature header");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!verifyBostaHmac(rawBody, hmacHeader, webhookSecret)) {
    req.log.warn("Bosta status webhook: HMAC signature mismatch");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let payload: {
    state?: { value?: string };
    trackingNumber?: string;
    updatedAt?: string;
  };

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Replay-window enforcement — checked before acknowledging the request.
  // BOSTA_WEBHOOK_REPLAY_WINDOW_MS defaults to 5 min (300 000 ms).
  // Only enforced when updatedAt is present; absent timestamps skip the check.
  const REPLAY_WINDOW_MS = parseInt(process.env.BOSTA_WEBHOOK_REPLAY_WINDOW_MS ?? "300000", 10);
  const eventTs = payload.updatedAt ? Date.parse(payload.updatedAt) : NaN;
  if (!isNaN(eventTs) && Date.now() - eventTs > REPLAY_WINDOW_MS) {
    req.log.warn(
      { eventAge: Date.now() - eventTs, updatedAt: payload.updatedAt },
      "Bosta webhook: replay-window exceeded — rejecting stale event",
    );
    res.status(400).json({ error: "Event timestamp outside replay window" });
    return;
  }

  // Respond quickly; Bosta expects a fast 200
  res.status(200).json({ ok: true });

  const bostaState     = (payload.state?.value ?? "").toUpperCase();
  const trackingNumber = payload.trackingNumber ?? "";
  const shopifyStatus  = BOSTA_TO_SHOPIFY_STATUS[bostaState];

  req.log.info(
    { trackingNumber, bostaState, shopifyStatus },
    "Bosta delivery status update",
  );

  if (!shopifyStatus || !trackingNumber) return;

  const order = await findOrderByTrackingNote(trackingNumber);
  if (!order) {
    req.log.warn({ trackingNumber }, "Bosta status webhook: no Shopify order found");
    return;
  }

  // ── Update Shopify fulfillment event ──────────────────────────────────────

  const existingFulfillment = order.fulfillments.find(
    (f) => f.tracking_number === trackingNumber,
  );

  if (existingFulfillment) {
    await addShopifyFulfillmentEvent(
      order.id,
      existingFulfillment.id,
      shopifyStatus,
    );
    req.log.info(
      { orderNumber: order.order_number, shopifyStatus, trackingNumber },
      "Shopify fulfillment event added from Bosta",
    );
  } else {
    const fulfillmentId = await createShopifyFulfillment(order.id, trackingNumber);
    if (fulfillmentId) {
      await addShopifyFulfillmentEvent(order.id, fulfillmentId, shopifyStatus);
      req.log.info(
        { orderNumber: order.order_number, fulfillmentId, shopifyStatus },
        "Shopify fulfillment created + event added from Bosta status",
      );
    }
  }

  // ── On DELIVERED: enqueue review email 24-28 h out ────────────────────────

  if (bostaState === "DELIVERED") {
    try {
      // First-terminal-DELIVERED guard: skip if a prior DELIVERED event already
      // set the pending/sent tag.  This prevents duplicate enqueues from Bosta
      // replaying webhooks without needing to touch the database.
      const existingTags = new Set(
        (order.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      );
      if (existingTags.has("review-email-pending") || existingTags.has("review-email-sent")) {
        req.log.info(
          { trackingNumber, orderNumber: order.order_number },
          "Bosta DELIVERED: review email already in-flight or sent — skipping duplicate",
        );
        return;
      }

      // Look up the paymob_intent so we have the intentId for idempotent job key
      const rows = await db
        .select({
          intentId:               paymobIntents.intentId,
          shopifyConfirmedOrderId: paymobIntents.shopifyConfirmedOrderId,
        })
        .from(paymobIntents)
        .where(eq(paymobIntents.bostaTrackingNumber, trackingNumber))
        .limit(1);

      const intent = rows[0];

      if (!intent?.intentId || !intent.shopifyConfirmedOrderId) {
        req.log.warn(
          { trackingNumber, orderNumber: order.order_number },
          "Bosta DELIVERED: no matching paymob_intent found — skipping review email",
        );
        return;
      }

      // Enqueue first so a failed enqueue doesn't leave the tag orphaned.
      // pg-boss singletonKey is the authoritative idempotency guard; the
      // pending tag is secondary (prevents duplicate DELIVERED events).
      await enqueueReviewEmail({
        intentId:            intent.intentId,
        bostaTrackingNumber: trackingNumber,
        shopifyOrderId:      intent.shopifyConfirmedOrderId,
      });

      // Tag AFTER successful enqueue so the transition guard in subsequent
      // DELIVERED events can skip without hitting the DB.
      await tagShopifyOrder(intent.shopifyConfirmedOrderId, "review-email-pending");

      req.log.info(
        { intentId: intent.intentId, shopifyOrderId: intent.shopifyConfirmedOrderId },
        "Bosta DELIVERED: review email job enqueued",
      );
    } catch (err) {
      req.log.warn(
        { err, trackingNumber },
        "Bosta DELIVERED: failed to enqueue review email job (non-fatal)",
      );
    }
  }
});

export default router;
