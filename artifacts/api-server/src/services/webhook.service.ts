/**
 * webhook.service.ts
 *
 * Business logic for processing Paymob webhook events asynchronously.
 * Handles idempotency, Shopify order creation (success/failure paths),
 * and post-order side effects (email, WhatsApp, notes).
 *
 * This service is called after the webhook route has already:
 *  - Verified the HMAC signature
 *  - Responded HTTP 200 to Paymob
 */
import {
  findPaymobIntentByCheckoutToken,
  updatePaymobIntent,
} from "@workspace/db";
import { completeShopifyDraftOrder, recordDiscountCodeUse } from "../lib/shopifyOrder";
import { addShopifyOrderNote } from "../lib/integrations";
import { sendEmail, buildOrderConfirmationEmail } from "../lib/email";
import { sendWhatsApp } from "../lib/integrations";
import { logger } from "../lib/logger";
import { parseEGP } from "@workspace/utils";
import { captureTransaction, type PaymobTransaction } from "./paymob.service";
import type { CustomerInfo } from "../lib/shopifyOrder";

export interface WebhookProcessResult {
  processed: boolean;
  skipped?: boolean;
  reason?: string;
  orderId?: number;
  orderNumber?: number;
}

/**
 * Processes a verified Paymob transaction webhook asynchronously.
 * This runs AFTER the HTTP 200 has been sent back to Paymob.
 */
export async function processPaymobWebhook(
  txn: PaymobTransaction,
): Promise<WebhookProcessResult> {
  const checkoutToken = txn.order?.merchant_order_id ?? "";
  const txnId = String(txn.id);

  if (!checkoutToken) {
    logger.warn({ txnId }, "webhook.service: no merchant_order_id — cannot correlate");
    return { processed: false, reason: "no_merchant_order_id" };
  }

  // ── Look up the pending intent ──────────────────────────────────────────
  let intent;
  try {
    intent = await findPaymobIntentByCheckoutToken(checkoutToken);
  } catch (err) {
    logger.error({ err, checkoutToken }, "webhook.service: DB lookup failed");
    return { processed: false, reason: "db_error" };
  }

  if (!intent) {
    logger.warn({ checkoutToken, txnId }, "webhook.service: no matching intent in DB");
    return { processed: false, reason: "intent_not_found" };
  }

  // ── Idempotency guard ───────────────────────────────────────────────────
  if (intent.shopifyConfirmedOrderId) {
    logger.info(
      { intentId: intent.id, txnId, shopifyOrderId: intent.shopifyConfirmedOrderId },
      "webhook.service: already processed — skipping (idempotent)",
    );
    return {
      processed: false,
      skipped: true,
      reason: "already_processed",
      orderId: intent.shopifyConfirmedOrderId,
      orderNumber: intent.shopifyOrderNumber ?? undefined,
    };
  }

  // ── Determine if this is a valid payment ─────────────────────────────────
  // Shopify-type integrations leave transactions as pending=true when the
  // Shopify payment callback fails. Treat pending+no-error as a valid payment.
  const isValidPayment =
    (txn.success && !txn.pending) ||
    (txn.pending && !txn.error_occured && txn.amount_cents > 0);

  if (!isValidPayment) {
    if (!txn.success && intent.status !== "failed") {
      await updatePaymobIntent(intent.id, { status: "failed" }).catch((err) =>
        logger.error({ err }, "webhook.service: failed to mark intent as failed"),
      );
      logger.info({ intentId: intent.id, txnId }, "webhook.service: payment failed — marked intent as failed");
    }
    return { processed: false, reason: "payment_not_successful" };
  }

  // ── Capture pending transactions (Shopify-type integration) ──────────────
  // When Paymob is configured as "Shopify" integration type, the transaction
  // arrives as pending=true because Paymob tries to confirm via Shopify's
  // payment callback which returns "Order has no shopify_payment." — the card
  // IS charged. Call capture to force the transaction to Success.
  //
  // IMPORTANT: If capture fails, the webhook fired before 3DS completed.
  // Do NOT create the Shopify order — the real success webhook will fire later.
  if (txn.pending && !txn.success) {
    logger.info(
      { txnId, amountCents: txn.amount_cents },
      "webhook.service: transaction is pending — attempting capture to confirm 3DS completion",
    );
    const captureResult = await captureTransaction(txn.id, txn.amount_cents);
    if (!captureResult.captured) {
      logger.warn(
        { txnId },
        "webhook.service: capture failed — pre-3DS event or genuine failure, NOT creating order",
      );
      return { processed: false, reason: "capture_failed_pre_3ds" };
    }
    logger.info(
      { txnId },
      "webhook.service: capture succeeded — card was charged, proceeding with order",
    );
  }

  // ── Mark intent as paid ──────────────────────────────────────────────────
  await updatePaymobIntent(intent.id, { status: "paid", paymobTxnId: txnId }).catch(
    (err) => logger.error({ err }, "webhook.service: failed to mark intent as paid"),
  );

  if (!intent.shopifyOrderId) {
    logger.error({ intentId: intent.id }, "webhook.service: no shopifyOrderId (draft) to complete");
    return { processed: false, reason: "no_draft_order" };
  }

  // ── Complete the Shopify draft → confirmed order ─────────────────────────
  const shopifyResult = await completeShopifyDraftOrder(intent.shopifyOrderId).catch(
    (err) => {
      logger.error({ err, draftOrderId: intent.shopifyOrderId }, "webhook.service: Shopify completion failed");
      return null;
    },
  );

  if (!shopifyResult) {
    logger.error(
      { intentId: intent.id, draftOrderId: intent.shopifyOrderId },
      "webhook.service: Shopify draft completion returned null",
    );
    return { processed: false, reason: "shopify_completion_failed" };
  }

  const { orderId, orderNumber, total, lineItems, discountAmount, discountCode } = shopifyResult;

  // ── Persist confirmed order IDs ──────────────────────────────────────────
  await updatePaymobIntent(intent.id, {
    shopifyConfirmedOrderId: orderId,
    shopifyOrderNumber: orderNumber,
  }).catch((err) => logger.error({ err }, "webhook.service: failed to update confirmed order IDs"));

  logger.info(
    { orderId, orderNumber, intentId: intent.id, txnId },
    "webhook.service: Shopify order completed successfully",
  );

  // ── Add Paymob transaction note to Shopify order ─────────────────────────
  void addShopifyOrderNote(
    orderId,
    [
      `Paymob Transaction ID: ${txnId}`,
      `Payment Method: Card`,
      `Paymob Order ID: ${txn.order?.id ?? "N/A"}`,
      `Payment Status: Paid`,
    ].join("\n"),
  ).catch((err) => logger.warn({ err, orderId }, "webhook.service: failed to add Shopify note"));

  // ── Record discount code use ─────────────────────────────────────────────
  if (intent.discountCode && discountAmount) {
    void recordDiscountCodeUse(intent.discountCode, orderId, orderNumber, "card");
  }

  // ── Send email + WhatsApp confirmation ───────────────────────────────────
  const customer = intent.customer as CustomerInfo;
  const shippingPrice = parseEGP(total) > 2000 ? "0.00" : "50.00";

  if (customer?.email) {
    const { html, text } = buildOrderConfirmationEmail({
      orderNumber,
      customerName: customer.firstName ?? "",
      total,
      paymentMethod: "Credit / Debit Card",
      address: customer.address ?? "",
      governorate: customer.governorate ?? "",
      city: customer.city ?? "",
      lineItems,
      discountAmount: discountAmount ? discountAmount.toFixed(2) : undefined,
      discountCode: discountCode || undefined,
      shippingAmount: shippingPrice,
    });
    void sendEmail({
      to: customer.email,
      subject: `Your Moi order #${orderNumber} is confirmed`,
      html,
      text,
    })
      .then(() =>
        logger.info({ email: customer.email, orderNumber }, "webhook.service: confirmation email sent"),
      )
      .catch((err) =>
        logger.warn({ err, email: customer.email }, "webhook.service: confirmation email failed"),
      );
  }

  if (customer?.phone) {
    const shippingNum = parseFloat(shippingPrice);
    const shippingNote =
      shippingNum === 0 ? "Complimentary shipping" : `Includes ${shippingNum.toFixed(0)} EGP shipping`;
    void sendWhatsApp(
      customer.phone,
      `✅ Your Moi order #${orderNumber} is confirmed!\n\nTotal: ${total} EGP (${shippingNote})\nPayment: Card — confirmed\n\nYour order is now being prepared. You'll receive a tracking update when it ships. Thank you for shopping with Moi. 🖤`,
    );
  }

  return { processed: true, orderId, orderNumber };
}
