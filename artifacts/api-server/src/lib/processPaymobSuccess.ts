import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { parseEGP } from "@workspace/utils";
import {
  sendWhatsApp,
  completeShopifyCheckout,
} from "./integrations";
import {
  createDraftOrder,
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

  logger.info({ intentId, paymobTxnId, amount, hasAttribution: !!attribution }, "processPaymobSuccess: creating Shopify draft order");

  let shopifyDraftId: number;
  let shopifyLineItems: ShopifyLineItem[] = [];
  let shopifyDiscountAmount: number | undefined;
  let shopifyDiscountCode: string | undefined;

  try {
    const result = await createDraftOrder({
      lines,
      customer,
      paymentMethod: "card",
      cartId: intent.cartId ?? undefined,
      discountCode: intent.discountCode ?? undefined,
      extraTags: `paymob-card-paid,paymob-card-draft,paymob-txn-${paymobTxnId}`,
      attribution,
      complete: false,
    });
    shopifyDraftId = result.draftOrderId ?? result.orderId;
    shopifyLineItems = result.lineItems;
    shopifyDiscountAmount = result.discountAmount;
    shopifyDiscountCode = result.discountCode;
  } catch (err) {
    logger.error({ err, intentId }, "processPaymobSuccess: Shopify draft order creation failed — marking intent failed");
    await db
      .update(paymobIntents)
      .set({ status: "failed" })
      .where(eq(paymobIntents.intentId, intentId));
    return { alreadyClaimed: false };
  }

  // Mark completed; store the Shopify draft order ID
  await db
    .update(paymobIntents)
    .set({ status: "completed", shopifyOrderId: shopifyDraftId })
    .where(eq(paymobIntents.intentId, intentId));

  logger.info({ intentId, shopifyDraftId, paymobTxnId }, "processPaymobSuccess: Shopify draft order created — awaiting admin review");

  // Fire-and-forget side effects
  if (intent.checkoutToken) {
    void completeShopifyCheckout(intent.checkoutToken);
  }

  if (intent.discountCode && shopifyDiscountAmount) {
    void recordDiscountCodeUse(intent.discountCode, shopifyDraftId, shopifyDraftId, "card");
  }

  if (customer.email) {
    const shippingPrice = parseEGP(amount) >= 2000 ? "0.00" : "50.00";
    const { html, text } = buildOrderConfirmationEmail({
      orderNumber: shopifyDraftId,
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
      subject: `Your Moi payment is confirmed — order being processed`,
      html,
      text,
    })
      .then(() => logger.info({ email: customer.email, shopifyDraftId }, "processPaymobSuccess: confirmation email sent"))
      .catch((err) => logger.warn({ err, email: customer.email }, "processPaymobSuccess: confirmation email failed"));
  }

  // Admin notification email — sent to the store owner for every confirmed card payment
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const shippingForAdmin = parseEGP(amount) >= 2000 ? "0.00" : "50.00";
    const { html: adminHtml, text: adminText } = buildAdminPaymentNotificationEmail({
      draftOrderId: shopifyDraftId,
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
      subject: `🟢 Card Payment — Draft Order #${shopifyDraftId} — ${parseEGP(amount).toFixed(2)} EGP`,
      html: adminHtml,
      text: adminText,
    })
      .then(() => logger.info({ adminEmail, shopifyDraftId }, "processPaymobSuccess: admin notification sent"))
      .catch((err) => logger.warn({ err, adminEmail }, "processPaymobSuccess: admin notification failed"));
  }

  const phone = customer.phone ?? "";
  if (phone) {
    void sendWhatsApp(
      phone,
      `✅ Payment confirmed for your Moi order!\n\nTotal: ${amount} EGP\nPayment: Credit/Debit Card\n\nYour order is being reviewed and prepared. You'll receive a tracking update soon. Thank you for shopping with Moi. 🖤`,
    );
  }

  logger.info({ shopifyDraftId, paymobTxnId, amount }, "processPaymobSuccess: draft order fully processed — awaiting admin dispatch");
  return { alreadyClaimed: false };
}
