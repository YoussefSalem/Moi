import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { queryTransactionByMerchantOrderId } from "../lib/paymob";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

// Rate-limit direct Paymob API lookups to once every 15 seconds per intent
const _lastLookup = new Map<string, number>();
const LOOKUP_RATE_MS = 15_000;
const MIN_AGE_MS = 1_000; // Wait at least 1 second before first direct lookup

/**
 * GET /api/orders/paymob-status/:intentId
 *
 * Polling endpoint used by the frontend while a card payment is in progress.
 * Returns the current status of the intent.
 *
 * After a short delay, also queries the Paymob API directly as a webhook
 * fallback (in case the server-to-server callback never arrives).
 */
router.get("/orders/paymob-status/:intentId", async (req, res) => {
  const { intentId } = req.params;
  if (!intentId) {
    res.status(400).json({ error: "Missing intentId" });
    return;
  }

  const rows = await db
    .select({
      status: paymobIntents.status,
      paymobTxnId: paymobIntents.paymobTxnId,
      shopifyOrderId: paymobIntents.shopifyOrderId,
      shopifyOrderNumber: paymobIntents.shopifyOrderNumber,
      createdAt: paymobIntents.createdAt,
    })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  const { status, paymobTxnId, shopifyOrderId, shopifyOrderNumber, createdAt } = rows[0];
  res.setHeader("Cache-Control", "no-store");

  // Fast path: already resolved
  if (status !== "pending") {
    res.json({ status, paymobTxnId: paymobTxnId ?? null, shopifyOrderId: shopifyOrderId ?? null, shopifyOrderNumber: shopifyOrderNumber ?? null });
    return;
  }

  // Fallback: query Paymob directly if the webhook hasn't arrived yet (rate-limited)
  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (ageMs > MIN_AGE_MS) {
    const lastLookup = _lastLookup.get(intentId) ?? 0;
    if (Date.now() - lastLookup > LOOKUP_RATE_MS) {
      _lastLookup.set(intentId, Date.now());
      const result = await queryTransactionByMerchantOrderId(intentId).catch(() => null);

      if (result !== null) {
        if (result.success) {
          req.log.info({ intentId, txnId: result.txnId }, "paymob-status: direct lookup — successful payment");
          await processPaymobSuccess({ intentId, paymobTxnId: result.txnId, amountCents: result.amountCents })
            .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-status: processPaymobSuccess error"));
          const updated = await db
            .select({ shopifyOrderId: paymobIntents.shopifyOrderId, shopifyOrderNumber: paymobIntents.shopifyOrderNumber })
            .from(paymobIntents).where(eq(paymobIntents.intentId, intentId)).limit(1);
          const row = updated[0];
          res.json({ status: "completed", paymobTxnId: result.txnId, shopifyOrderId: row?.shopifyOrderId ?? null, shopifyOrderNumber: row?.shopifyOrderNumber ?? null });
        } else {
          req.log.info({ intentId, txnId: result.txnId }, "paymob-status: direct lookup — declined payment");
          await db
            .update(paymobIntents)
            .set({ status: "declined", paymobTxnId: result.txnId })
            .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
            .catch((err: unknown) => req.log.error({ err, intentId }, "paymob-status: failed to mark declined"));
          res.json({ status: "declined", paymobTxnId: result.txnId });
        }
        return;
      }
    }
  }

  res.json({ status, paymobTxnId: paymobTxnId ?? null });
});

export default router;
