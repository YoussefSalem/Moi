import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { verifyPaymobHmac, extractPaymobTxn } from "../lib/paymob";
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

  // merchant_order_id is our internal intent UUID (set at paymob-init time)
  const orderObj = (txn.order && typeof txn.order === "object")
    ? (txn.order as Record<string, unknown>)
    : null;
  const intentId = String(txn.merchant_order_id ?? orderObj?.merchant_order_id ?? "");
  const paymobTxnId = String(txn.id ?? "");

  // Skip intermediate 3DS notifications — Paymob fires a webhook with
  // success=false + pending=true while the cardholder is authenticating.
  // Marking this as declined would kill the intent before 3DS completes.
  const isPendingTxn = txn.pending === true;
  if (isPendingTxn) {
    req.log.info({ intentId, paymobTxnId }, "Paymob webhook: pending/3DS transaction — skipping (waiting for final result)");
    return;
  }

  // Mark declined/voided transactions so the frontend polling can detect them.
  const isFailure = txn.success !== true || txn.is_voided === true || txn.is_refunded === true;
  if (isFailure) {
    req.log.info({ success: txn.success, is_voided: txn.is_voided, intentId, paymobTxnId }, "Paymob webhook: failed/voided transaction — marking intent declined");
    if (intentId && paymobTxnId) {
      await db
        .update(paymobIntents)
        .set({ status: "declined", paymobTxnId })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
        .catch((err: unknown) => req.log.error({ err, intentId }, "Paymob webhook: failed to mark intent declined"));
    }
    return;
  }

  const amountCents = txn.amount_cents as number | undefined;

  if (!intentId || !paymobTxnId) {
    req.log.error({ merchant_order_id: intentId, id: txn.id }, "Paymob webhook: missing intent or transaction ID");
    return;
  }

  req.log.info({ intentId, paymobTxnId }, "Paymob webhook: processing successful payment");

  try {
    await processPaymobSuccess({
      intentId,
      paymobTxnId,
      amountCents: typeof amountCents === "number" ? amountCents : 0,
    });
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
