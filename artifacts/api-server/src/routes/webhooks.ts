import { Router, type IRouter } from "express";
import {
  sendWhatsApp,
  createBostaShipment,
  addShopifyOrderNote,
  tagShopifyOrder,
  verifyShopifyHmac,
  findOrderByTrackingNote,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
} from "../lib/integrations";

const router: IRouter = Router();

// Note: req.body is a raw Buffer for this route because app.ts applies
// express.raw({ type: "application/json" }) for /api/webhooks before express.json().

router.post("/webhooks/orders-paid", async (req, res) => {
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // Require the secret to be configured — reject ambiguous requests otherwise
  if (!webhookSecret) {
    req.log.error("SHOPIFY_WEBHOOK_SECRET is not set; rejecting webhook");
    res.status(503).json({
      error: "Webhook verification not configured on this server.",
    });
    return;
  }

  const rawBody = req.body as Buffer;
  const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;

  if (!hmacHeader) {
    req.log.warn("orders/paid webhook: missing HMAC header");
    res.status(401).json({ error: "Missing HMAC header" });
    return;
  }

  if (!verifyShopifyHmac(rawBody, hmacHeader, webhookSecret)) {
    req.log.warn("orders/paid webhook: HMAC verification failed");
    res.status(401).json({ error: "Invalid HMAC" });
    return;
  }

  let order: {
    id?: number;
    order_number?: number;
    tags?: string;
    total_price?: string;
    customer?: { first_name?: string; last_name?: string; phone?: string };
    shipping_address?: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      address1?: string;
      city?: string;
      province?: string;
    };
    note?: string;
    note_attributes?: { name: string; value: string }[];
  };

  try {
    order = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  req.log.info(
    { orderId: order.id, orderNumber: order.order_number },
    "orders/paid webhook verified and received",
  );

  // Respond immediately — Shopify requires a fast 200
  res.status(200).json({ ok: true });

  const tags = order.tags ?? "";
  const isInstapay = tags.includes("instapay");
  const isMoiCheckout = tags.includes("moi-checkout");

  if (!isMoiCheckout) return;

  const phone =
    order.note_attributes?.find((a) => a.name === "customer_phone")?.value ??
    order.shipping_address?.phone ??
    order.customer?.phone ??
    "";
  const firstName =
    order.shipping_address?.first_name ?? order.customer?.first_name ?? "";
  const lastName =
    order.shipping_address?.last_name ?? order.customer?.last_name ?? "";
  const address = order.shipping_address?.address1 ?? "";
  const city = order.shipping_address?.city ?? "";
  const governorate =
    order.note_attributes?.find((a) => a.name === "governorate")?.value ??
    order.shipping_address?.province ??
    "";
  const orderRef = `#${order.order_number ?? order.id}`;
  const total = order.total_price ?? "";

  // Payment-confirmed notification and Bosta shipment are Instapay-only:
  // COD orders are already confirmed at placement; paid event only fires for Instapay here.
  if (!isInstapay) return;

  if (phone) {
    void sendWhatsApp(
      phone,
      `✅ Payment confirmed for Moi order ${orderRef}!\n\nTotal: ${total} EGP\n\nYour order is being prepared. You'll receive a tracking update soon. Thank you for shopping with Moi. 🖤`,
    );
  }

  if (firstName && address && order.id) {
    const trackingNumber = await createBostaShipment({
      firstName,
      lastName,
      phone,
      address,
      city,
      orderReference: orderRef,
      codAmount: 0,
    });

    if (trackingNumber) {
      void addShopifyOrderNote(
        order.id,
        `Bosta tracking: ${trackingNumber}\nPayment: Instapay (confirmed)`,
      );
      void tagShopifyOrder(order.id, `bosta-${trackingNumber}`);

      // Create a Shopify fulfillment with the Bosta tracking number
      const fulfillmentId = await createShopifyFulfillment(order.id, trackingNumber);
      if (fulfillmentId) {
        void addShopifyFulfillmentEvent(order.id, fulfillmentId, "in_transit");
        req.log.info(
          { trackingNumber, fulfillmentId, orderNumber: order.order_number },
          "Bosta Instapay shipment created and Shopify fulfillment opened",
        );
      }
    }
  }
});

export default router;
