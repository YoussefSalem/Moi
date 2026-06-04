import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { verifyPaymobHmac, extractWebhookTxn } from "../lib/paymob";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

/**
 * POST /api/webhooks/paymob
 *
 * Receives Paymob server-to-server payment notifications.
 * - Verifies HMAC signature
 * - Ignores pending/3DS intermediate notifications
 * - Marks declined payments
 * - Triggers Shopify order creation for successful payments
 */
router.post("/webhooks/paymob", async (req, res) => {
  const rawBody = req.body as Buffer;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Verify HMAC signature — reject invalid or unsigned requests
  const hmac = (req.query.hmac ?? req.headers["x-paymob-hmac"]) as string | undefined;
  if (!hmac) {
    req.log.warn("paymob-webhook: missing HMAC");
    res.status(401).json({ error: "Missing HMAC" });
    return;
  }
  if (!verifyPaymobHmac(payload, hmac)) {
    req.log.warn("paymob-webhook: invalid HMAC");
    res.status(401).json({ error: "Invalid HMAC" });
    return;
  }

  // Respond immediately — process asynchronously so Paymob doesn't time out
  res.status(200).json({ ok: true });

  const txn = extractWebhookTxn(payload);
  const orderObj = txn.order && typeof txn.order === "object" ? (txn.order as Record<string, unknown>) : null;
  const intentId = String(txn.merchant_order_id ?? orderObj?.merchant_order_id ?? "");
  const paymobTxnId = String(txn.id ?? "");

  // Skip intermediate 3DS notifications — pending=true means auth is still in progress
  if (txn.pending === true) {
    req.log.info({ intentId, paymobTxnId }, "paymob-webhook: pending/3DS — waiting for final result");
    return;
  }

  if (!intentId || !paymobTxnId) {
    req.log.error({ intentId, paymobTxnId }, "paymob-webhook: missing intentId or txnId");
    return;
  }

  const isSuccess = txn.success === true && txn.is_voided !== true && txn.is_refunded !== true;

  if (!isSuccess) {
    req.log.info({ intentId, paymobTxnId, success: txn.success }, "paymob-webhook: payment failed — marking declined");
    await db
      .update(paymobIntents)
      .set({ status: "declined", paymobTxnId })
      .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
      .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-webhook: failed to mark declined"));
    return;
  }

  const amountCents = typeof txn.amount_cents === "number" ? txn.amount_cents : 0;
  req.log.info({ intentId, paymobTxnId, amountCents }, "paymob-webhook: processing successful payment");

  try {
    await processPaymobSuccess({ intentId, paymobTxnId, amountCents });
  } catch (err) {
    req.log.error({ err, intentId, paymobTxnId }, "paymob-webhook: processPaymobSuccess error");
    await db
      .update(paymobIntents)
      .set({ status: "failed" })
      .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "processing")))
      .catch((dbErr) => req.log.error({ dbErr }, "paymob-webhook: failed to mark intent as failed"));
  }
});

export default router;
