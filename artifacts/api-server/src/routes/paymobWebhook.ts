import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { verifyPaymobHmac, extractPaymobTxn } from "../lib/paymob";
import {
  getShopifyAdminToken,
  addShopifyOrderNote,
  tagShopifyOrder,
  sendWhatsApp,
  createBostaShipment,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
  completeShopifyCheckout,
} from "../lib/integrations";
import { createShopifyDirectOrder, recordDiscountCodeUse, type OrderLine, type CustomerInfo, type ShopifyLineItem, type OrderAttribution } from "../lib/shopifyOrder";
import { sendEmail, buildOrderConfirmationEmail } from "../lib/email";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

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

  // Normalize payload: v1 has fields at top level; v2 (Unified Checkout) wraps them in `obj`
  const txn = extractPaymobTxn(payload);

  // Only process successful, non-voided, non-refunded transactions
  if (txn.success !== true || txn.is_voided === true || txn.is_refunded === true) {
    req.log.info({ success: txn.success, is_voided: txn.is_voided }, "Paymob webhook: not a successful transaction, skipping");
    return;
  }

  // merchant_order_id is our internal intent UUID (set at paymob-init time)
  const orderObj = (txn.order && typeof txn.order === "object")
    ? (txn.order as Record<string, unknown>)
    : null;
  const intentId = String(txn.merchant_order_id ?? orderObj?.merchant_order_id ?? "");
  const paymobTxnId = String(txn.id ?? "");
  const amountCents = txn.amount_cents as number | undefined;
  const amount = amountCents ? (amountCents / 100).toFixed(2) : "0";

  if (!intentId || !paymobTxnId) {
    req.log.error({ merchant_order_id: intentId, id: txn.id }, "Paymob webhook: missing intent or transaction ID");
    return;
  }

  try {
    // Atomically claim the intent: only proceed if status is still "pending"
    const claimed = await db
      .update(paymobIntents)
      .set({ status: "processing", paymobTxnId })
      .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
      .returning({
        intentId: paymobIntents.intentId,
        lines: paymobIntents.lines,
        customer: paymobIntents.customer,
        cartId: paymobIntents.cartId,
        discountCode: paymobIntents.discountCode,
        total: paymobIntents.total,
        attribution: paymobIntents.attribution,
        checkoutToken: paymobIntents.checkoutToken,
      });

    if (claimed.length === 0) {
      req.log.info({ intentId, paymobTxnId }, "Paymob webhook: intent already claimed or not found, skipping (idempotent)");
      return;
    }

    const intent = claimed[0];
    const customer = intent.customer as CustomerInfo;
    const lines = intent.lines as OrderLine[];
    const attr = intent.attribution as Record<string, unknown> | null;
    const attribution: OrderAttribution | undefined = attr ? {
      ...(typeof attr.sourceName === "string" ? { sourceName: attr.sourceName } : {}),
      ...(typeof attr.referringSite === "string" ? { referringSite: attr.referringSite } : {}),
      ...(typeof attr.landingSite === "string" ? { landingSite: attr.landingSite } : {}),
      ...(typeof attr.fbclid === "string" ? { fbclid: attr.fbclid } : {}),
      ...(typeof attr.gclid === "string" ? { gclid: attr.gclid } : {}),
      ...(typeof attr.ttclid === "string" ? { ttclid: attr.ttclid } : {}),
      ...(attr.utm && typeof attr.utm === "object" ? { utm: Object.fromEntries(Object.entries(attr.utm as Record<string, unknown>).filter(([, v]) => typeof v === "string")) } : {}),
    } : undefined;

    req.log.info({ intentId, paymobTxnId, amount, hasAttribution: !!attribution }, "Paymob webhook: creating Shopify order");

    // Create Shopify order from stored intent data
    let shopifyOrderId: number;
    let shopifyOrderNumber: number;
    let shopifyLineItems: ShopifyLineItem[] = [];
    let shopifyDiscountAmount: number | undefined;
    let shopifyDiscountCode: string | undefined;
    try {
      const result = await createShopifyDirectOrder({
        lines,
        customer,
        paymentMethod: "card",
        cartId: intent.cartId ?? undefined,
        discountCode: intent.discountCode ?? undefined,
        extraTags: `paymob-card-paid,paymob-txn-${paymobTxnId}`,
        attribution,
        financialStatus: "paid",
      });
      shopifyOrderId = result.orderId;
      shopifyOrderNumber = result.orderNumber;
      shopifyLineItems = result.lineItems;
      shopifyDiscountAmount = result.discountAmount;
      shopifyDiscountCode = result.discountCode;
    } catch (err) {
      req.log.error({ err, intentId }, "Paymob webhook: Shopify order creation failed — marking intent failed");
      await db
        .update(paymobIntents)
        .set({ status: "failed" })
        .where(eq(paymobIntents.intentId, intentId));
      return;
    }

    // Mark intent as completed
    await db
      .update(paymobIntents)
      .set({ status: "completed", shopifyOrderId })
      .where(eq(paymobIntents.intentId, intentId));

    req.log.info({ intentId, shopifyOrderId, shopifyOrderNumber, paymobTxnId }, "Paymob webhook: Shopify order created");

    // Mark the Shopify abandoned checkout as complete (fire-and-forget)
    if (intent.checkoutToken) {
      void completeShopifyCheckout(intent.checkoutToken);
    }

    // Record discount code use so Shopify's usage_limit is enforced across API orders
    if (intent.discountCode && shopifyDiscountAmount) {
      void recordDiscountCodeUse(intent.discountCode, shopifyOrderId, shopifyOrderNumber, "card");
    }

    // Send branded order confirmation email to customer (fire-and-forget)
    if (customer.email) {
      const shippingPrice = parseFloat(amount) >= 2000 ? "0.00" : "50.00";
      const { html, text } = buildOrderConfirmationEmail({
        orderNumber: shopifyOrderNumber,
        customerName: customer.firstName,
        total: amount,
        paymentMethod: "Credit/Debit Card (Paymob)",
        address: customer.address,
        governorate: customer.governorate,
        city: customer.city,
        lineItems: shopifyLineItems,
        discountAmount: shopifyDiscountAmount ? shopifyDiscountAmount.toFixed(2) : undefined,
        discountCode: shopifyDiscountCode || undefined,
        shippingAmount: shippingPrice,
      });
      void sendEmail({ to: customer.email, subject: `Your Moi order #${shopifyOrderNumber} is confirmed`, html, text })
        .then(() => req.log.info({ email: customer.email, shopifyOrderNumber }, "Order confirmation email sent"))
        .catch((err) => req.log.warn({ err, email: customer.email }, "Order confirmation email failed"));
    }

    const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const adminToken = await getShopifyAdminToken();
    const orderRef = `#${shopifyOrderNumber}`;

    // Record Shopify capture transaction
    if (storeDomain && adminToken) {
      await fetch(
        `https://${storeDomain}/admin/api/2024-04/orders/${shopifyOrderId}/transactions.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
          body: JSON.stringify({ transaction: { kind: "capture", gateway: "Paymob", amount } }),
        },
      ).catch((err) => req.log.error({ err }, "Shopify transaction record failed"));
    }

    void addShopifyOrderNote(shopifyOrderId, `Paymob transaction: ${paymobTxnId}`);

    // WhatsApp to customer using intent's stored customer data
    const phone = customer.phone ?? "";
    if (phone) {
      void sendWhatsApp(
        phone,
        `✅ Payment confirmed for Moi order ${orderRef}!\n\nTotal: ${amount} EGP\nPayment: Credit/Debit Card\n\nYour order is being prepared. You'll receive a tracking update soon. Thank you for shopping with Moi. 🖤`,
      );
    }

    // Create Bosta shipment using intent's stored customer data
    if (customer.firstName && customer.address) {
      const trackingNumber = await createBostaShipment({
        firstName: customer.firstName,
        lastName: customer.lastName ?? "",
        phone,
        address: customer.address,
        city: customer.city ?? "",
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

    req.log.info({ shopifyOrderId, shopifyOrderNumber, paymobTxnId, amount }, "Paymob webhook: order fully processed");
  } catch (err) {
    req.log.error({ err, intentId, paymobTxnId }, "Paymob webhook processing error");
    // Prevent the intent from getting stuck in 'processing' — mark it failed so
    // it surfaces for manual review and future retries are not silently dropped.
    if (intentId) {
      await db
        .update(paymobIntents)
        .set({ status: "failed" })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "processing")))
        .catch((dbErr) => req.log.error({ dbErr }, "Paymob webhook: also failed to mark intent as failed"));
    }
  }
});

export default router;
