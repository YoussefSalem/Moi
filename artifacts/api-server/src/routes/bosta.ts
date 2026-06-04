import { Router, type IRouter } from "express";
import {
  findOrderByTrackingNote,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
} from "../lib/integrations";

const router: IRouter = Router();

// Bosta → Shopify fulfillment event status mapping
const BOSTA_TO_SHOPIFY_STATUS: Record<string, string> = {
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  IN_TRANSIT: "in_transit",
  RETURNED: "failure",
  CANCELLED: "failure",
};

router.post("/bosta/create-shipment", async (_req, res) => {
  res.status(503).json({
    error: "Bosta shipment creation is disabled on this server. The Bosta Shopify app handles all shipments automatically.",
  });
});

// Bosta delivery-status webhook — updates Shopify fulfillment state.
// Register in your Bosta dashboard:
//   POST /api/bosta/status-webhook?secret=<BOSTA_WEBHOOK_SECRET>
// req.body is a raw Buffer (express.raw applied in app.ts for this path).
router.post("/bosta/status-webhook", async (req, res) => {
  const webhookSecret = process.env.BOSTA_WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided = req.query["secret"] as string | undefined;
    if (!provided || provided !== webhookSecret) {
      req.log.warn("Bosta status webhook: invalid or missing secret query param");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } else {
    // Secret not configured — reject to avoid unauthenticated fulfillment mutations
    req.log.error("BOSTA_WEBHOOK_SECRET is not set; rejecting Bosta status webhook");
    res.status(503).json({ error: "Webhook secret not configured." });
    return;
  }

  const rawBody = req.body as Buffer;

  let payload: {
    state?: { value?: string };
    trackingNumber?: string;
  };

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Respond quickly; Bosta expects a fast 200
  res.status(200).json({ ok: true });

  const bostaState = (payload.state?.value ?? "").toUpperCase();
  const trackingNumber = payload.trackingNumber ?? "";
  const shopifyStatus = BOSTA_TO_SHOPIFY_STATUS[bostaState];

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
});

export default router;
