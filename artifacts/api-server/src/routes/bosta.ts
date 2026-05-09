import { Router, type IRouter } from "express";
import {
  createBostaShipment,
  addShopifyOrderNote,
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

function requireInternalAuth(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1],
): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return true; // no secret configured — skip check
  const auth = req.headers["x-internal-secret"];
  if (auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

interface CreateShipmentBody {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  address?: unknown;
  city?: unknown;
  orderReference?: unknown;
  codAmount?: unknown;
  orderId?: unknown;
}

router.post("/bosta/create-shipment", async (req, res) => {
  if (!requireInternalAuth(req, res)) return;

  const body = req.body as CreateShipmentBody;
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const orderReference = typeof body.orderReference === "string" ? body.orderReference.trim() : "";
  const codAmount = typeof body.codAmount === "number" ? body.codAmount : 0;
  const orderId = typeof body.orderId === "number" ? body.orderId : null;

  if (!firstName || !phone || !address || !city) {
    res.status(400).json({ error: "firstName, phone, address, and city are required." });
    return;
  }

  if (!process.env.BOSTA_API_KEY) {
    res.status(503).json({ error: "Bosta shipping not configured." });
    return;
  }

  try {
    const trackingNumber = await createBostaShipment({
      firstName,
      lastName,
      phone,
      address,
      city,
      orderReference,
      codAmount,
    });

    if (!trackingNumber) {
      res.status(502).json({ error: "Bosta did not return a tracking number." });
      return;
    }

    if (orderId) {
      void addShopifyOrderNote(orderId, `Bosta tracking: ${trackingNumber}`);
    }

    req.log.info({ trackingNumber, orderReference }, "Bosta shipment created via API");
    res.status(200).json({ success: true, trackingNumber });
  } catch (err) {
    req.log.error({ err }, "Bosta shipment creation failed");
    res.status(500).json({ error: "Failed to create Bosta shipment." });
  }
});

// Bosta delivery status webhook — updates Shopify fulfillment status.
// Register in your Bosta dashboard: POST /api/bosta/status-webhook
// req.body is a raw Buffer (express.raw applied in app.ts for this path).
router.post("/bosta/status-webhook", async (req, res) => {
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

  res.status(200).json({ ok: true });

  const bostaState = (payload.state?.value ?? "").toUpperCase();
  const trackingNumber = payload.trackingNumber ?? "";
  const shopifyStatus = BOSTA_TO_SHOPIFY_STATUS[bostaState];

  req.log.info({ trackingNumber, bostaState, shopifyStatus }, "Bosta delivery status update");

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
    // Add event to existing fulfillment
    await addShopifyFulfillmentEvent(order.id, existingFulfillment.id, shopifyStatus);
    req.log.info(
      { orderNumber: order.order_number, shopifyStatus, trackingNumber },
      "Shopify fulfillment event added",
    );
  } else {
    // Create fulfillment and add event
    const fulfillmentId = await createShopifyFulfillment(order.id, trackingNumber);
    if (fulfillmentId) {
      await addShopifyFulfillmentEvent(order.id, fulfillmentId, shopifyStatus);
      req.log.info(
        { orderNumber: order.order_number, fulfillmentId, shopifyStatus },
        "Shopify fulfillment created and event added from Bosta status",
      );
    }
  }
});

export default router;
