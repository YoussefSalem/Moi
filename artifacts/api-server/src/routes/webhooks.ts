import { Router, type IRouter } from "express";
import {
  sendWhatsApp,
  createBostaShipment,
  addShopifyOrderNote,
  verifyShopifyHmac,
} from "../lib/integrations";

const router: IRouter = Router();

// Note: req.body is a raw Buffer here because app.ts applies express.raw()
// for /api/webhooks BEFORE express.json(). Do not call express.json() again.

router.post("/webhooks/orders-paid", async (req, res) => {
  const rawBody = req.body as Buffer;

  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;
    if (!hmacHeader) {
      req.log.warn("orders/paid webhook: missing HMAC header");
      res.status(401).json({ error: "Missing HMAC" });
      return;
    }
    if (!verifyShopifyHmac(rawBody, hmacHeader, webhookSecret)) {
      req.log.warn("orders/paid webhook: HMAC mismatch");
      res.status(401).json({ error: "Invalid HMAC" });
      return;
    }
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
    "orders/paid webhook received",
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
  const orderRef = `#${order.order_number ?? order.id}`;
  const total = order.total_price ?? "";

  if (phone) {
    void sendWhatsApp(
      phone,
      `✅ Payment confirmed for Moi order ${orderRef}!\n\nTotal: ${total} EGP\n\nYour order is being prepared. You'll receive a tracking update soon. Thank you for shopping with Moi. 🖤`,
    );
  }

  // For Instapay orders, create Bosta shipment now that payment is confirmed
  if (isInstapay && firstName && address) {
    const trackingNumber = await createBostaShipment({
      firstName,
      lastName,
      phone,
      address,
      city,
      orderReference: orderRef,
      codAmount: 0,
    });

    if (trackingNumber && order.id) {
      const existingNote = order.note ?? "";
      void addShopifyOrderNote(
        order.id,
        `${existingNote ? existingNote + "\n" : ""}Bosta tracking: ${trackingNumber}\nPayment: Instapay (confirmed)`,
      );
      req.log.info(
        { trackingNumber, orderNumber: order.order_number },
        "Bosta Instapay shipment created after payment",
      );
    }
  }
});

export default router;
