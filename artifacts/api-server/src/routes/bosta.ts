import { Router, type IRouter } from "express";
import { createBostaShipment, addShopifyOrderNote } from "../lib/integrations";

const router: IRouter = Router();

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

    req.log.info({ trackingNumber, orderReference }, "Bosta shipment created");
    res.status(200).json({ success: true, trackingNumber });
  } catch (err) {
    req.log.error({ err }, "Bosta shipment creation failed");
    res.status(500).json({ error: "Failed to create Bosta shipment." });
  }
});

// Bosta delivery status webhook
// Register this URL in your Bosta dashboard: POST /api/bosta/status-webhook
router.post("/bosta/status-webhook", async (req, res) => {
  // req.body is a Buffer (express.raw applied in app.ts)
  const rawBody = req.body as Buffer;

  let payload: {
    state?: { value?: string; code?: number };
    trackingNumber?: string;
    orderRef?: string;
  };

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  res.status(200).json({ ok: true });

  const state = payload.state?.value ?? "";
  const trackingNumber = payload.trackingNumber ?? "";

  req.log.info({ trackingNumber, state }, "Bosta delivery status update");

  // Map Bosta delivery states to human-readable notes
  const stateMessages: Record<string, string> = {
    DELIVERED: "Order delivered successfully by Bosta.",
    RETURNED: "Order returned to sender by Bosta.",
    CANCELLED: "Bosta shipment was cancelled.",
    IN_TRANSIT: "Order is in transit with Bosta.",
    OUT_FOR_DELIVERY: "Order is out for delivery with Bosta.",
  };

  const note = stateMessages[state.toUpperCase()];
  if (!note || !trackingNumber) return;

  // Look up the Shopify order by Bosta tracking number stored in note
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  if (!storeDomain || !adminToken) return;

  try {
    // Search orders with this tracking in the note
    const searchRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders.json?note=${encodeURIComponent(trackingNumber)}&status=any&fields=id,order_number,note`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (!searchRes.ok) return;

    const searchData = await searchRes.json() as {
      orders: { id: number; order_number: number; note?: string }[];
    };

    for (const order of searchData.orders) {
      if (order.note?.includes(trackingNumber)) {
        void addShopifyOrderNote(
          order.id,
          `${order.note}\n[${new Date().toISOString()}] ${note}`,
        );
        req.log.info(
          { orderNumber: order.order_number, state, trackingNumber },
          "Shopify order note updated with Bosta status",
        );
        break;
      }
    }
  } catch (err) {
    req.log.error({ err }, "Bosta status webhook: Shopify update failed");
  }
});

export default router;
