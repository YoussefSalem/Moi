import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { queryPaymobByMerchantOrderId } from "../lib/paymob";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

// Per-intent rate-limit for direct Paymob API lookups: at most once every 5 seconds.
// Stored in-process; resets on server restart (acceptable — worst case is one extra call).
const _lastDirectLookup = new Map<string, number>();

router.get("/orders/paymob-status/:intentId", async (req, res) => {
  const { intentId } = req.params;

  if (!intentId || typeof intentId !== "string") {
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

  // Fast path: already resolved by webhook or a prior direct lookup.
  if (status !== "pending") {
    res.json({
      status,
      paymobTxnId: paymobTxnId ?? null,
      shopifyOrderId: shopifyOrderId ?? null,
      shopifyOrderNumber: shopifyOrderNumber ?? null,
    });
    return;
  }

  // Fallback: if the intent has been pending for > 8 seconds and the webhook has
  // not arrived yet (common during development or if Paymob cannot reach our URL),
  // query Paymob directly. Rate-limited to once per 5 s per intent to avoid hammering
  // their API during the 200 ms polling interval.
  const ageMs = Date.now() - new Date(createdAt).getTime();
  // 1 s delay so the lookup fires quickly if polling continues after the postMessage.
  // The frontend also calls /paymob-sync directly on success, so this is a fallback.
  const DIRECT_LOOKUP_DELAY_MS = 1_000;
  // Increased to 15 s — each check now makes 2 Paymob API calls (order search +
  // transaction list), so we keep this conservative to avoid rate-limiting.
  const DIRECT_LOOKUP_RATE_MS = 15_000;

  if (ageMs > DIRECT_LOOKUP_DELAY_MS) {
    const lastLookup = _lastDirectLookup.get(intentId) ?? 0;
    if (Date.now() - lastLookup > DIRECT_LOOKUP_RATE_MS) {
      _lastDirectLookup.set(intentId, Date.now());
      const result = await queryPaymobByMerchantOrderId(intentId).catch(() => null);

      if (result !== null) {
        if (result.success) {
          req.log.info(
            { intentId, txnId: result.txnId, amountCents: result.amountCents },
            "paymob-status: direct lookup found successful payment — processing order",
          );
          // Process the successful payment: creates Shopify order, sends
          // confirmation email + WhatsApp, marks intent completed. Idempotent.
          await processPaymobSuccess({
            intentId,
            paymobTxnId: result.txnId,
            amountCents: result.amountCents,
          }).catch((err: unknown) =>
            req.log.error({ err, intentId }, "paymob-status: processPaymobSuccess error"),
          );
          // Fetch updated order details to return to the client
          const updatedRows = await db
            .select({
              shopifyOrderId: paymobIntents.shopifyOrderId,
              shopifyOrderNumber: paymobIntents.shopifyOrderNumber,
            })
            .from(paymobIntents)
            .where(eq(paymobIntents.intentId, intentId))
            .limit(1);
          const updated = updatedRows[0];
          res.json({
            status: "completed",
            paymobTxnId: result.txnId,
            shopifyOrderId: updated?.shopifyOrderId ?? null,
            shopifyOrderNumber: updated?.shopifyOrderNumber ?? null,
          });
        } else {
          req.log.info(
            { intentId, txnId: result.txnId },
            "paymob-status: direct lookup found declined payment",
          );
          await db
            .update(paymobIntents)
            .set({ status: "declined", paymobTxnId: result.txnId })
            .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")))
            .catch((err: unknown) =>
              req.log.error({ err, intentId }, "paymob-status: failed to mark intent declined"),
            );
          res.json({ status: "declined", paymobTxnId: result.txnId });
        }
        return;
      }
    }
  }

  res.json({ status, paymobTxnId: paymobTxnId ?? null });
});

export default router;
