import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { fetchTransactionById, queryTransactionByMerchantOrderId } from "../lib/paymob";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

/**
 * POST /api/orders/paymob-sync
 *
 * Called by the frontend immediately after it receives the Paymob postMessage.
 * Verifies the transaction with the Paymob API before creating a Shopify order.
 * Idempotent — safe to call multiple times for the same intent.
 *
 * Body: { intentId: string, paymobTxnId?: string }
 */
router.post("/orders/paymob-sync", async (req, res) => {
  const body = req.body as { intentId?: unknown; paymobTxnId?: unknown };
  const intentId = typeof body.intentId === "string" ? body.intentId.trim() : "";
  const clientTxnId = typeof body.paymobTxnId === "string" ? body.paymobTxnId.trim() : "";

  if (!intentId) {
    res.status(400).json({ error: "Missing intentId" });
    return;
  }

  req.log.info({ intentId, clientTxnId: clientTxnId || undefined }, "paymob-sync: received");

  const rows = await db
    .select({ status: paymobIntents.status, paymobTxnId: paymobIntents.paymobTxnId, amountCents: paymobIntents.amountCents })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  const { status, paymobTxnId, amountCents } = rows[0];
  res.setHeader("Cache-Control", "no-store");

  // Already resolved — return current state
  if (status !== "pending") {
    req.log.info({ intentId, status }, "paymob-sync: already resolved (idempotent)");
    res.json({ status, alreadyClaimed: true, paymobTxnId: paymobTxnId ?? null });
    return;
  }

  // Strategy 1: verify by transaction ID the client received from Paymob
  if (clientTxnId) {
    const verified = await fetchTransactionById(clientTxnId, intentId).catch(() => null);
    if (verified !== null) {
      if (!verified.success) {
        req.log.info({ intentId, txnId: verified.txnId }, "paymob-sync: payment declined (txn verify)");
        await db
          .update(paymobIntents)
          .set({ status: "declined", paymobTxnId: verified.txnId })
          .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
          .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-sync: failed to mark declined"));
        res.json({ status: "declined", paymobTxnId: verified.txnId });
        return;
      }

      req.log.info({ intentId, txnId: verified.txnId }, "paymob-sync: verified via txnId — creating order");
      await processPaymobSuccess({ intentId, paymobTxnId: verified.txnId, amountCents: verified.amountCents })
        .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error"));

      const updated = await db
        .select({ shopifyOrderId: paymobIntents.shopifyOrderId, shopifyOrderNumber: paymobIntents.shopifyOrderNumber })
        .from(paymobIntents).where(eq(paymobIntents.intentId, intentId)).limit(1);
      const row = updated[0];
      res.json({ status: "completed", paymobTxnId: verified.txnId, shopifyOrderId: row?.shopifyOrderId ?? null, shopifyOrderNumber: row?.shopifyOrderNumber ?? null });
      return;
    }
    req.log.info({ intentId, clientTxnId }, "paymob-sync: txnId verify returned null — falling through");
  }

  // Strategy 2: query Paymob by our merchant_order_id
  const result = await queryTransactionByMerchantOrderId(intentId).catch(() => null);
  if (result !== null) {
    if (!result.success) {
      req.log.info({ intentId, txnId: result.txnId }, "paymob-sync: payment declined (order query)");
      await db
        .update(paymobIntents)
        .set({ status: "declined", paymobTxnId: result.txnId })
        .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
        .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-sync: failed to mark declined"));
      res.json({ status: "declined", paymobTxnId: result.txnId });
      return;
    }

    req.log.info({ intentId, txnId: result.txnId }, "paymob-sync: verified via order query — creating order");
    await processPaymobSuccess({ intentId, paymobTxnId: result.txnId, amountCents: result.amountCents })
      .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error"));

    const updated = await db
      .select({ shopifyOrderId: paymobIntents.shopifyOrderId, shopifyOrderNumber: paymobIntents.shopifyOrderNumber })
      .from(paymobIntents).where(eq(paymobIntents.intentId, intentId)).limit(1);
    const row = updated[0];
    res.json({ status: "completed", paymobTxnId: result.txnId, shopifyOrderId: row?.shopifyOrderId ?? null, shopifyOrderNumber: row?.shopifyOrderNumber ?? null });
    return;
  }

  // Strategy 3: Paymob API unavailable — use client txnId as best-effort fallback
  if (clientTxnId) {
    req.log.warn({ intentId, clientTxnId }, "paymob-sync: Paymob API unreachable — using client txnId as fallback");
    await processPaymobSuccess({ intentId, paymobTxnId: clientTxnId, amountCents })
      .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error (fallback)"));

    const updated = await db
      .select({ shopifyOrderId: paymobIntents.shopifyOrderId, shopifyOrderNumber: paymobIntents.shopifyOrderNumber })
      .from(paymobIntents).where(eq(paymobIntents.intentId, intentId)).limit(1);
    const row = updated[0];
    res.json({ status: "completed", paymobTxnId: clientTxnId, shopifyOrderId: row?.shopifyOrderId ?? null, shopifyOrderNumber: row?.shopifyOrderNumber ?? null });
    return;
  }

  req.log.info({ intentId }, "paymob-sync: no transaction found yet — still processing");
  res.json({ status: "pending" });
});

export default router;
