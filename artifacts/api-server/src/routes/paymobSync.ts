import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { queryPaymobByMerchantOrderId } from "../lib/paymob";
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
 * Security: does NOT trust the client's claimed paymobTxnId — always queries
 * Paymob directly using the intentId (our merchantOrderId) to verify the
 * transaction before calling processPaymobSuccess.
 *
 * Idempotent: if the intent is already claimed it returns the current status.
 */
router.post("/orders/paymob-sync", async (req, res) => {
  const body = req.body as { intentId?: unknown };
  const intentId = typeof body.intentId === "string" ? body.intentId.trim() : "";

  if (!intentId) {
    res.status(400).json({ error: "Missing intentId" });
    return;
  }

  const rows = await db
    .select({
      status: paymobIntents.status,
      paymobTxnId: paymobIntents.paymobTxnId,
    })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  const { status, paymobTxnId } = rows[0];
  res.setHeader("Cache-Control", "no-store");

  // Already resolved — return current state without touching Paymob.
  if (status !== "pending") {
    req.log.info({ intentId, status }, "paymob-sync: intent already resolved (idempotent)");
    res.json({ status, alreadyClaimed: true, paymobTxnId: paymobTxnId ?? null });
    return;
  }

  // Query Paymob directly to verify the transaction — never trust the client.
  const result = await queryPaymobByMerchantOrderId(intentId).catch(() => null);

  if (result === null) {
    // Paymob API returned nothing yet — payment may still be processing on their end.
    req.log.info({ intentId }, "paymob-sync: Paymob query returned null — retrying later");
    res.json({ status: "pending" });
    return;
  }

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
    "paymob-sync: verified successful payment — processing order",
  );

  // Fire processing in the background so the response is immediate.
  void processPaymobSuccess({
    intentId,
    paymobTxnId: result.txnId,
    amountCents: result.amountCents,
  }).catch((err: unknown) =>
    req.log.error({ err, intentId }, "paymob-sync: processPaymobSuccess error"),
  );

  res.json({ status: "completed", paymobTxnId: result.txnId });
});

export default router;
