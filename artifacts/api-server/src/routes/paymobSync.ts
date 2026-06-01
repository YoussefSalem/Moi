import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { queryPaymobByMerchantOrderId, verifyPaymobTransactionById } from "../lib/paymob";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

/**
 * POST /api/orders/paymob-sync
 *
 * Called by the frontend the moment it receives a "success" postMessage from the
 * Paymob iframe. This is the primary trigger for draft order creation when the
 * server-to-server webhook has not arrived (e.g. Paymob cannot reach the callback
 * URL, or the webhook fires after the frontend polling has already stopped).
 *
 * Security: does NOT trust the client's claimed paymobTxnId blindly —
 * it first attempts to verify the transaction via the Paymob API.
 * When the Paymob API is unreachable (e.g. auth issues), it falls back to
 * accepting the txnId with a log warning — the admin approval step provides
 * a human review gate before the draft is converted to a real Shopify order.
 *
 * Idempotent: if the intent is already claimed it returns the current status.
 */
router.post("/orders/paymob-sync", async (req, res) => {
  const body = req.body as { intentId?: unknown; paymobTxnId?: unknown };
  const intentId = typeof body.intentId === "string" ? body.intentId.trim() : "";
  const clientTxnId = typeof body.paymobTxnId === "string" ? body.paymobTxnId.trim() : "";

  if (!intentId) {
    res.status(400).json({ error: "Missing intentId" });
    return;
  }

  const rows = await db
    .select({
      status: paymobIntents.status,
      paymobTxnId: paymobIntents.paymobTxnId,
      amountCents: paymobIntents.amountCents,
    })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  const { status, paymobTxnId, amountCents } = rows[0];
  res.setHeader("Cache-Control", "no-store");

  // Already resolved — return current state without touching Paymob.
  if (status !== "pending") {
    req.log.info({ intentId, status }, "paymob-sync: intent already resolved (idempotent)");
    res.json({ status, alreadyClaimed: true, paymobTxnId: paymobTxnId ?? null });
    return;
  }

  // Strategy 1: If the client provided a txnId, try to verify it directly via
  // Paymob's transaction endpoint (more reliable than the order-level query).
  if (clientTxnId) {
    const verified = await verifyPaymobTransactionById(clientTxnId, intentId).catch(() => null);
    if (verified !== null) {
      if (!verified.success) {
        req.log.info({ intentId, txnId: verified.txnId }, "paymob-sync: Paymob reports failed/declined (via txnId verify)");
        await db
          .update(paymobIntents)
          .set({ status: "declined", paymobTxnId: verified.txnId })
          .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
          .catch((err: unknown) =>
            req.log.error({ err, intentId }, "paymob-sync: failed to mark intent declined"),
          );
        res.json({ status: "declined", paymobTxnId: verified.txnId });
        return;
      }
      req.log.info(
        { intentId, txnId: verified.txnId, amountCents: verified.amountCents },
        "paymob-sync: verified via txnId — processing order",
      );
      void processPaymobSuccess({
        intentId,
        paymobTxnId: verified.txnId,
        amountCents: verified.amountCents,
      }).catch((err: unknown) =>
        req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error"),
      );
      res.json({ status: "completed", paymobTxnId: verified.txnId });
      return;
    }
    req.log.info({ intentId, clientTxnId }, "paymob-sync: txnId verify returned null — falling through to order query");
  }

  // Strategy 2: Query Paymob directly by merchant_order_id.
  const result = await queryPaymobByMerchantOrderId(intentId).catch(() => null);

  if (result !== null) {
    if (!result.success) {
      req.log.info({ intentId, txnId: result.txnId }, "paymob-sync: Paymob reports failed/declined");
      await db
        .update(paymobIntents)
        .set({ status: "declined", paymobTxnId: result.txnId })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
        .catch((err: unknown) =>
          req.log.error({ err, intentId }, "paymob-sync: failed to mark intent declined"),
        );
      res.json({ status: "declined", paymobTxnId: result.txnId });
      return;
    }

    req.log.info(
      { intentId, txnId: result.txnId, amountCents: result.amountCents },
      "paymob-sync: verified via order query — processing order",
    );
    void processPaymobSuccess({
      intentId,
      paymobTxnId: result.txnId,
      amountCents: result.amountCents,
    }).catch((err: unknown) =>
      req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error"),
    );
    res.json({ status: "completed", paymobTxnId: result.txnId });
    return;
  }

  // Strategy 3: Paymob API is unavailable. If the client provided a txnId (from
  // the relay page, which only runs after Paymob redirects post-payment), use it
  // as a best-effort fallback. The draft order will require admin approval before
  // converting to a real Shopify order, which acts as the human review gate.
  if (clientTxnId) {
    req.log.warn(
      { intentId, clientTxnId, storedAmountCents: amountCents },
      "paymob-sync: Paymob API unavailable — processing with client-provided txnId (admin review required)",
    );
    void processPaymobSuccess({
      intentId,
      paymobTxnId: clientTxnId,
      amountCents,
    }).catch((err: unknown) =>
      req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error (fallback)"),
    );
    res.json({ status: "completed", paymobTxnId: clientTxnId });
    return;
  }

  // No txnId and Paymob API unavailable — payment may still be processing.
  req.log.info({ intentId }, "paymob-sync: Paymob query returned nothing — retrying later");
  res.json({ status: "pending" });
});

export default router;
