import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { parseEGP } from "@workspace/utils";
import { sendWhatsApp, completeShopifyCheckout } from "./integrations";
import {
  createShopifyDirectOrder,
  recordDiscountCodeUse,
  validateStockAvailability,
  type OrderLine,
  type CustomerInfo,
  type ShopifyLineItem,
  type OrderAttribution,
} from "./shopifyOrder";
import { sendEmail, buildOrderConfirmationEmail, buildAdminPaymentNotificationEmail } from "./email";
import { logger } from "./logger";

/**
 * Atomically claims a pending Paymob intent and creates a Shopify order.
 * Idempotent — returns { alreadyClaimed: true } if the intent is already claimed.
 *
 * Called by the webhook handler, paymob-sync, and the status polling fallback.
 */
export async function processPaymobSuccess(params: {
  intentId: string;
  paymobTxnId: string;
  amountCents: number;
}): Promise<{ alreadyClaimed: boolean }> {
  const { intentId, paymobTxnId, amountCents } = params;
  const amount = (amountCents / 100).toFixed(2);

  // Atomically claim the intent — only proceeds if status is still "pending"
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
    logger.info({ intentId, paymobTxnId }, "processPaymobSuccess: already claimed (idempotent)");
    return { alreadyClaimed: true };
  }

  const intent = claimed[0];

  // Normalize customer fields
  const rawCustomer = intent.customer as CustomerInfo | null;
  const customer: CustomerInfo = rawCustomer ? {
    firstName: rawCustomer.firstName || "NA",
    lastName: rawCustomer.lastName || "NA",
    phone: rawCustomer.phone || "NA",
    email: rawCustomer.email ?? undefined,
    address: rawCustomer.address || "NA",
    city: rawCustomer.city || "Cairo",
    governorate: rawCustomer.governorate || "NA",
  } : {
    firstName: "NA", lastName: "NA", phone: "NA",
    address: "NA", city: "Cairo", governorate: "NA",
  };

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

  // Backend stock enforcement
  const stockCheck = await validateStockAvailability(lines);
  if (!stockCheck.ok) {
    logger.warn({ intentId, unavailableVariantIds: stockCheck.unavailableVariantIds }, "processPaymobSuccess: stock unavailable");
    await db.update(paymobIntents).set({ status: "failed" }).where(eq(paymobIntents.intentId, intentId));
    return { alreadyClaimed: false };
  }

  logger.info({ intentId, paymobTxnId, amount }, "processPaymobSuccess: creating Shopify order");

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
      financialStatus: "paid",
      paymobTxnId,
      paymobDetails: { txnId: paymobTxnId, amountCents, intentId },
    });
    shopifyOrderId = result.orderId;
    shopifyOrderNumber = result.orderNumber;
    shopifyLineItems = result.lineItems;
    shopifyDiscountAmount = result.discountAmount;
    shopifyDiscountCode = result.discountCode;
  } catch (err) {
    logger.error({ err, intentId }, "processPaymobSuccess: Shopify order creation failed");
    await db.update(paymobIntents).set({ status: "failed" }).where(eq(paymobIntents.intentId, intentId));
    return { alreadyClaimed: false };
  }

  // Mark completed and auto-approved
  await db
    .update(paymobIntents)
    .set({
      status: "completed",
      shopifyOrderId,
      shopifyConfirmedOrderId: shopifyOrderId,
      shopifyOrderNumber,
      adminApproved: true,
      adminApprovedAt: new Date(),
    })
    .where(eq(paymobIntents.intentId, intentId));

  logger.info({ intentId, shopifyOrderId, shopifyOrderNumber, paymobTxnId }, "processPaymobSuccess: order created");

  // Fire-and-forget side effects
  if (intent.checkoutToken) {
    void completeShopifyCheckout(intent.checkoutToken);
  }

  if (intent.discountCode && shopifyDiscountAmount) {
    void recordDiscountCodeUse(intent.discountCode, shopifyOrderId, shopifyOrderId, "card");
  }

  // Customer confirmation email
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
      .catch((err) => logger.warn({ err }, "processPaymobSuccess: confirmation email failed"));
  }

  // Admin notification email
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
      .catch((err) => logger.warn({ err }, "processPaymobSuccess: admin notification failed"));
  }

  // WhatsApp confirmation
  const phone = customer.phone ?? "";
  if (phone && phone !== "NA") {
    void sendWhatsApp(
      phone,
      `✅ Payment confirmed for your Moi order!

Order #${shopifyOrderNumber}
Total: ${amount} EGP
Payment: Credit/Debit Card

Your order is being prepared and will be dispatched soon. Thank you for shopping with Moi. 🖤`,
    );
  }

  logger.info({ shopifyOrderId, shopifyOrderNumber, paymobTxnId, amount }, "processPaymobSuccess: completed");
  return { alreadyClaimed: false };
}
