import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/orders/paymob-status/:intentId", async (req, res) => {
  const { intentId } = req.params;

  if (!intentId || typeof intentId !== "string") {
    res.status(400).json({ error: "Missing intentId" });
    return;
  }

  const rows = await db
    .select({ status: paymobIntents.status, paymobTxnId: paymobIntents.paymobTxnId })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  const { status, paymobTxnId } = rows[0];
  res.json({ status, paymobTxnId: paymobTxnId ?? null });
});

export default router;
