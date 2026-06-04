import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  verifyPaymobHmac,
  extractPaymobTxn,
  mapPaymobBillingToCustomer,
  type PaymobBillingData,
} from "../lib/paymob";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

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

  const hmac = (req.query.hmac ?? req.headers["x-paymob-hmac"]) as string | undefined;
  if (!hmac) {
    req.log.warn("paymob-webhook: missing HMAC");
    res.status(401).json({ error: "Missing HMAC" });
    return;
  }
  if (!verifyPaymobHmac(payload, hmac)) {
    req.log.warn("paymob-webhook: HMAC verification failed");
    res.status(401).json({ error: "Invalid HMAC" });
    return;
  }

  // Respond immediately — process asynchronously
  res.status(200).json({ ok: true });

  const txn = extractPaymobTxn(payload);

  const orderObj = txn.order && typeof txn.order === "object"
    ? (txn.order as Record<string, unknown>) : null;
  const intentId = String(txn.merchant_order_id ?? orderObj?.merchant_order_id ?? "");
  const paymobTxnId = String(txn.id ?? "");

  // Skip intermediate 3DS notifications (pending=true means authentication is still in progress)
  if (txn.pending === true) {
    req.log.info({ intentId, paymobTxnId }, "paymob-webhook: pending/3DS — waiting for final result");
    return;
  }

  // Handle failed / voided payments
  const isFailure = txn.success !== true || txn.is_voided === true || txn.is_refunded === true;
  if (isFailure) {
    req.log.info({ success: txn.success, intentId, paymobTxnId }, "paymob-webhook: payment failed — marking declined");
    if (intentId && paymobTxnId) {
      await db
        .update(paymobIntents)
        .set({ status: "declined", paymobTxnId })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
        .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-webhook: failed to mark declined"));
    }
    return;
  }

  if (!intentId || !paymobTxnId) {
    req.log.error({ intentId, paymobTxnId }, "paymob-webhook: missing intent or transaction ID");
    return;
  }

  const amountCents = txn.amount_cents as number | undefined;

  // Detect payment method
  const sourceSubType = typeof (txn.source_data as Record<string, unknown> | undefined)?.sub_type === "string"
    ? (txn.source_data as Record<string, unknown>).sub_type as string : undefined;
  const isApplePay = sourceSubType?.toUpperCase() === "APPLE_PAY";

  // Update customer from Apple Pay billing_data (shippingContact from the Apple Pay sheet)
  const billingData = txn.billing_data as PaymobBillingData | undefined;
  if (billingData && intentId) {
    const applePayCustomer = mapPaymobBillingToCustomer(billingData);
    if (applePayCustomer.firstName !== "NA" || applePayCustomer.email) {
      await db.update(paymobIntents)
        .set({ customer: applePayCustomer as unknown as Record<string, unknown> })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
        .catch((err: unknown) => req.log.warn({ err, intentId }, "paymob-webhook: failed to update customer from billing_data"));
    }
  }

  req.log.info({ intentId, paymobTxnId, isApplePay }, "paymob-webhook: processing successful payment");

  try {
    await processPaymobSuccess({
      intentId,
      paymobTxnId,
      amountCents: typeof amountCents === "number" ? amountCents : 0,
      paymentChannel: isApplePay ? "apple-pay" : "card",
    });
  } catch (err) {
    req.log.error({ err, intentId, paymobTxnId }, "paymob-webhook: processPaymobSuccess error");
    if (intentId) {
      await db
        .update(paymobIntents)
        .set({ status: "failed" })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "processing")))
        .catch((dbErr) => req.log.error({ dbErr }, "paymob-webhook: failed to mark intent as failed"));
    }
  }
});

export default router;
