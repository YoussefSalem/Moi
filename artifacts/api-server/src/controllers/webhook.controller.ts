/**
 * webhook.controller.ts
 *
 * Handles POST /api/webhooks/paymob
 *
 * Spec requirements:
 *  1. Verify Paymob webhook HMAC signature
 *  2. Reject invalid signatures (HTTP 401)
 *  3. Parse: success, transaction_id, order reference, amount
 *  4. Respond immediately with HTTP 200
 *  5. Process webhook logic asynchronously (idempotent)
 */
import type { Request, Response } from "express";
import { verifyHmac, type PaymobTransaction } from "../services/paymob.service";
import { processPaymobWebhook } from "../services/webhook.service";
import { logger } from "../lib/logger";

export async function handlePaymobWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = req.body as Buffer;

  // ── Parse JSON body ────────────────────────────────────────────────────
  let payload: { type?: string; obj?: PaymobTransaction };
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as typeof payload;
  } catch {
    req.log.warn("webhook.controller: invalid JSON body");
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // ── Filter non-transaction events ──────────────────────────────────────
  if (payload.type !== "TRANSACTION" || !payload.obj) {
    res.status(200).json({ ok: true });
    return;
  }

  const txn = payload.obj;

  // ── HMAC verification ──────────────────────────────────────────────────
  // VPC/MIGS integrations send HMAC as a query param; UIG sends it inside txn.hmac
  const queryHmac = typeof req.query.hmac === "string" ? req.query.hmac : "";
  const receivedHmac = queryHmac || txn.hmac || "";

  req.log.info(
    { txnId: txn.id, hmacSource: queryHmac ? "query" : txn.hmac ? "body" : "none" },
    "webhook.controller: received",
  );

  if (!receivedHmac) {
    req.log.warn({ txnId: txn.id }, "webhook.controller: missing HMAC — rejecting");
    res.status(401).json({ error: "Missing HMAC" });
    return;
  }

  if (!verifyHmac(txn, receivedHmac)) {
    req.log.warn({ txnId: txn.id }, "webhook.controller: HMAC verification failed — rejecting");
    res.status(401).json({ error: "Invalid HMAC signature" });
    return;
  }

  req.log.info(
    {
      txnId: txn.id,
      success: txn.success,
      pending: txn.pending,
      amountCents: txn.amount_cents,
      merchantOrderId: txn.order?.merchant_order_id,
    },
    "webhook.controller: HMAC verified — responding 200, processing async",
  );

  // ── Respond immediately (spec requirement) ─────────────────────────────
  res.status(200).json({ ok: true });

  // ── Process asynchronously (idempotency handled in webhook.service) ────
  void processPaymobWebhook(txn).catch((err) =>
    logger.error({ err, txnId: txn.id }, "webhook.controller: async processing threw"),
  );
}
