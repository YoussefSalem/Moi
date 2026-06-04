import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { parseEGP } from "@workspace/utils";
import {
  sendWhatsApp,
  completeShopifyCheckout,
  createBostaShipment,
  addShopifyOrderNote,
  tagShopifyOrder,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
} from "./integrations";
import {
  createShopifyDirectOrder,
  recordDiscountCodeUse,
  type OrderLine,
  type CustomerInfo,
  type ShopifyLineItem,
  type OrderAttribution,
} from "./shopifyOrder";
import { sendEmail, buildOrderConfirmationEmail, buildAdminPaymentNotificationEmail } from "./email";
import { logger } from "./logger";

/**
 * Atomically claims a pending Paymob intent and processes the successful payment:
 * creates a Shopify draft order, sends confirmation email, fires WhatsApp message,
 * and marks the intent completed.
 *
 * Idempotent — if the intent is already claimed (status !== "pending") the function
 * returns `{ alreadyClaimed: true }` and does nothing.
 *
 * Called from both the webhook handler (when Paymob pushes the result) and the
 * status polling fallback (when the webhook never arrives, e.g. in development).
 */
export async function processPaymobSuccess(params: {
  intentId: string;
  paymobTxnId: string;
  amountCents: number;
}): Promise<{ alreadyClaimed: boolean }> {
  const { intentId, paymobTxnId, amountCents } = params;
  const amount = (amountCents / 100).toFixed(2);

  // Atomically claim the intent — only proceed if it is still "pending"
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
    logger.info({ intentId, paymobTxnId }, "processPaymobSuccess: intent already claimed or not found (idempotent)");
    return { alreadyClaimed: true };
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
    ...(attr.utm && typeof attr.utm === "object"
      ? { utm: Object.fromEntries(Object.entries(attr.utm as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string> }
      : {}),
  } : undefined;

  logger.info({ intentId, paymobTxnId, amount, hasAttribution: !!attribution }, "processPaymobSuccess: creating Shopify order");

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
      extraTags: `paymob-card-paid,paymob-card-order,paymob-txn-${paymobTxnId}`,
      attribution,
      paymobTxnId,
      paymobDetails: { txnId: paymobTxnId, amountCents, intentId },
    });
    shopifyOrderId = result.orderId;
    shopifyOrderNumber = result.orderNumber;
    shopifyLineItems = result.lineItems;
    shopifyDiscountAmount = result.discountAmount;
    shopifyDiscountCode = result.discountCode;
  } catch (err) {
    logger.error({ err, intentId }, "processPaymobSuccess: Shopify order creation failed — marking intent failed");
    await db
      .update(paymobIntents)
      .set({ status: "failed" })
      .where(eq(paymobIntents.intentId, intentId));
    return { alreadyClaimed: false };
  }

  // Mark completed and auto-approved — no manual admin review needed for card orders
  await db
    .update(paymobIntents)
    .set({
      status: "completed",
      shopifyOrderId: shopifyOrderId,
      shopifyConfirmedOrderId: shopifyOrderId,
      shopifyOrderNumber: shopifyOrderNumber,
      adminApproved: true,
      adminApprovedAt: new Date(),
    })
    .where(eq(paymobIntents.intentId, intentId));

  logger.info({ intentId, shopifyOrderId, shopifyOrderNumber, paymobTxnId }, "processPaymobSuccess: Shopify order created and auto-approved");

  // Fire-and-forget side effects
  if (intent.checkoutToken) {
    void completeShopifyCheckout(intent.checkoutToken);
  }

  if (intent.discountCode && shopifyDiscountAmount) {
    void recordDiscountCodeUse(intent.discountCode, shopifyOrderId, shopifyOrderId, "card");
  }

  if (customer.email) {
    const shippingPrice = parseEGP(amount) >= 2000 ? "0.00" : "50.00";
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
    void sendEmail({
      to: customer.email,
      subject: `Your Moi payment is confirmed — order #${shopifyOrderNumber}`,
      html,
      text,
    })
      .then(() => logger.info({ email: customer.email, shopifyOrderId }, "processPaymobSuccess: confirmation email sent"))
      .catch((err) => logger.warn({ err, email: customer.email }, "processPaymobSuccess: confirmation email failed"));
  }

  // Admin notification email — sent to the store owner for every confirmed card payment
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const shippingForAdmin = parseEGP(amount) >= 2000 ? "0.00" : "50.00";
    const { html: adminHtml, text: adminText } = buildAdminPaymentNotificationEmail({
      draftOrderId: shopifyOrderId,
      orderNumber: shopifyOrderNumber,
      paymobTxnId,
      amount,
      customer,
      lineItems: shopifyLineItems,
      discountAmount: shopifyDiscountAmount ?? undefined,
      discountCode: shopifyDiscountCode ?? undefined,
      shippingAmount: shippingForAdmin,
    });
    void sendEmail({
      to: adminEmail,
      subject: `🟢 Card Payment — Order #${shopifyOrderNumber} — ${parseEGP(amount).toFixed(2)} EGP`,
      html: adminHtml,
      text: adminText,
    })
      .then(() => logger.info({ adminEmail, shopifyOrderId }, "processPaymobSuccess: admin notification sent"))
      .catch((err) => logger.warn({ err, adminEmail }, "processPaymobSuccess: admin notification failed"));
  }

  const phone = customer.phone ?? "";
  if (phone) {
    void sendWhatsApp(
      phone,
      `✅ Payment confirmed for your Moi order!

Order #${shopifyOrderNumber}
Total: ${amount} EGP
Payment: Credit/Debit Card

Your order is being prepared and will be dispatched soon. Thank you for shopping with Moi. 🖤`,
    );
  }

  // Auto-dispatch to Bosta — card orders are already paid, so COD = 0.
  // Runs fire-and-forget; failure does not affect payment confirmation.
  void (async () => {
    if (!customer.firstName || !customer.phone || !customer.address) {
      logger.warn({ intentId }, "processPaymobSuccess: missing customer data for Bosta auto-dispatch — skipping");
      return;
    }
    try {
      const trackingNumber = await createBostaShipment({
        firstName: customer.firstName,
        lastName: customer.lastName ?? customer.firstName,
        phone: customer.phone,
        address: customer.address,
        city: customer.city ?? "Cairo",
        orderReference: `#${paymobTxnId}`,
        codAmount: 0,
      });

      if (!trackingNumber) {
        logger.warn({ intentId, shopifyOrderId }, "processPaymobSuccess: Bosta dispatch returned no tracking number");
        return;
      }

      await db
        .update(paymobIntents)
        .set({ bostaDispatched: true, bostaTrackingNumber: trackingNumber, bostaDispatchedAt: new Date() })
        .where(eq(paymobIntents.intentId, intentId));

      void addShopifyOrderNote(shopifyOrderId, `Bosta tracking: ${trackingNumber}\nPayment: Paymob Card (paid — auto-dispatched)`);
      void tagShopifyOrder(shopifyOrderId, `bosta-${trackingNumber}`);
      const fulfillmentId = await createShopifyFulfillment(shopifyOrderId, trackingNumber);
      if (fulfillmentId) {
        void addShopifyFulfillmentEvent(shopifyOrderId, fulfillmentId, "in_transit");
      }

      logger.info({ intentId, shopifyOrderId, trackingNumber }, "processPaymobSuccess: auto-dispatched to Bosta (0 COD)");
    } catch (err) {
      logger.error({ err, intentId, shopifyOrderId }, "processPaymobSuccess: Bosta auto-dispatch failed");
    }
  })();

  logger.info({ shopifyOrderId, shopifyOrderNumber, paymobTxnId, amount }, "processPaymobSuccess: order fully processed and auto-approved");
  return { alreadyClaimed: false };
}
