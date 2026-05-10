import { Router, type IRouter } from "express";
import { verifyPaymobHmac, extractPaymobTxn } from "../lib/paymob";
import {
  getShopifyAdminToken,
  addShopifyOrderNote,
  tagShopifyOrder,
  sendWhatsApp,
  createBostaShipment,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
} from "../lib/integrations";

const router: IRouter = Router();

router.post("/webhooks/paymob", async (req, res) => {
  const rawBody = req.body as Buffer;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Paymob sends HMAC in the `hmac` query param
  const hmacParam = (req.query.hmac ?? req.headers["x-paymob-hmac"]) as string | undefined;

  if (!hmacParam) {
    req.log.warn("Paymob webhook: missing hmac");
    res.status(401).json({ error: "Missing HMAC" });
    return;
  }

  if (!verifyPaymobHmac(payload, hmacParam)) {
    req.log.warn("Paymob webhook: HMAC verification failed");
    res.status(401).json({ error: "Invalid HMAC" });
    return;
  }

  // Respond immediately — process async
  res.status(200).json({ ok: true });

  // Normalize payload: Paymob v1 has fields at top level; v2 (Unified Checkout) wraps them in `obj`
  const txn = extractPaymobTxn(payload);

  // Only process successful, non-voided, non-refunded transactions
  if (txn.success !== true || txn.is_voided === true || txn.is_refunded === true) {
    req.log.info({ success: txn.success, is_voided: txn.is_voided }, "Paymob webhook: not a successful transaction, skipping");
    return;
  }

  // merchant_order_id: top-level (v1) or inside txn.order (v2)
  const orderObj = (txn.order && typeof txn.order === "object")
    ? (txn.order as Record<string, unknown>)
    : null;
  const merchantOrderId = txn.merchant_order_id ?? orderObj?.merchant_order_id;

  const shopifyOrderId = parseInt(String(merchantOrderId ?? ""), 10);
  const paymobTxnId = String(txn.id ?? "");
  const amountCents = txn.amount_cents as number | undefined;
  const amount = amountCents ? (amountCents / 100).toFixed(2) : "0";

  if (!shopifyOrderId || !paymobTxnId) {
    req.log.error({ merchant_order_id: merchantOrderId, id: txn.id }, "Paymob webhook: missing order or transaction ID");
    return;
  }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) {
    req.log.error("Paymob webhook: Shopify admin not configured");
    return;
  }

  // Idempotency: fetch order tags and check for paymob-txn-{id}
  const idempotencyTag = `paymob-txn-${paymobTxnId}`;
  try {
    const tagCheckRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${shopifyOrderId}.json?fields=tags,order_number,shipping_address,note_attributes,customer`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (tagCheckRes.ok) {
      const tagData = await tagCheckRes.json() as {
        order: {
          tags: string;
          order_number: number;
          shipping_address?: { first_name?: string; last_name?: string; phone?: string; address1?: string; city?: string };
          note_attributes?: { name: string; value: string }[];
          customer?: { phone?: string };
        };
      };
      const order = tagData.order;

      const tagSet = new Set(order.tags.split(",").map((t) => t.trim()));
      if (tagSet.has(idempotencyTag)) {
        req.log.info({ shopifyOrderId, paymobTxnId }, "Paymob webhook: already processed (idempotent), skipping");
        return;
      }

      // Record Shopify capture transaction
      await fetch(
        `https://${storeDomain}/admin/api/2024-04/orders/${shopifyOrderId}/transactions.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
          body: JSON.stringify({
            transaction: { kind: "capture", gateway: "Paymob", amount },
          }),
        },
      ).catch((err) => req.log.error({ err }, "Shopify transaction record failed"));

      // Tag and note
      void addShopifyOrderNote(shopifyOrderId, `Paymob transaction: ${paymobTxnId}`);
      void tagShopifyOrder(shopifyOrderId, idempotencyTag);

      // WhatsApp to customer
      const phone =
        order.note_attributes?.find((a) => a.name === "customer_phone")?.value ??
        order.shipping_address?.phone ??
        order.customer?.phone ??
        "";
      const orderRef = `#${order.order_number ?? shopifyOrderId}`;

      if (phone) {
        void sendWhatsApp(
          phone,
          `✅ Payment confirmed for Moi order ${orderRef}!\n\nTotal: ${amount} EGP\nPayment: Credit/Debit Card\n\nYour order is being prepared. You'll receive a tracking update soon. Thank you for shopping with Moi. 🖤`,
        );
      }

      // Create Bosta shipment
      const firstName = order.shipping_address?.first_name ?? "";
      const lastName = order.shipping_address?.last_name ?? "";
      const address = order.shipping_address?.address1 ?? "";
      const city = order.shipping_address?.city ?? "";

      if (firstName && address) {
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
          void addShopifyOrderNote(shopifyOrderId, `Bosta tracking: ${trackingNumber}\nPayment: Paymob Card`);
          void tagShopifyOrder(shopifyOrderId, `bosta-${trackingNumber}`);
          const fulfillmentId = await createShopifyFulfillment(shopifyOrderId, trackingNumber);
          if (fulfillmentId) {
            void addShopifyFulfillmentEvent(shopifyOrderId, fulfillmentId, "in_transit");
          }
          req.log.info({ trackingNumber, shopifyOrderId, paymobTxnId }, "Paymob webhook: Bosta shipment created");
        }
      }

      req.log.info({ shopifyOrderId, paymobTxnId, amount }, "Paymob webhook: order fully processed");
    }
  } catch (err) {
    req.log.error({ err, shopifyOrderId, paymobTxnId }, "Paymob webhook processing error");
  }
});

export default router;
