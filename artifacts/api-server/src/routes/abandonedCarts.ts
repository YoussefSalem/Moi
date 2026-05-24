import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { abandonedCarts } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sendEmail, buildAbandonedCartEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

const isDev = process.env.NODE_ENV === "development";
const RECOVERY_DELAY_MS = isDev ? 10 * 1000 : 30 * 60 * 1000; // 10s dev / 30min prod
const RECOVERY_INTERVAL_MS = isDev ? 5 * 1000 : 5 * 60 * 1000; // 5s dev / 5min prod

function generateRecoveryToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * POST /api/abandoned-carts/start
 * Records an abandoned cart when the customer enters their email in checkout.
 */
router.post("/abandoned-carts/start", async (req, res) => {
  const { email, cartId, lineItems, totalAmount } = req.body as {
    email?: string;
    cartId?: string;
    lineItems?: Array<{
      title: string;
      variant?: string;
      quantity: number;
      price: string;
      imageUrl?: string;
    }>;
    totalAmount?: string;
  };

  if (!email || !lineItems || !totalAmount) {
    res.status(400).json({ error: "email, lineItems, and totalAmount required" });
    return;
  }

  try {
    const token = generateRecoveryToken();
    const [row] = await db.insert(abandonedCarts).values({
      email: email.trim().toLowerCase(),
      cartId: cartId ?? null,
      originalCartId: cartId ?? null,
      lineItems,
      totalAmount,
      recoveryToken: token,
      status: "started",
    }).returning();

    req.log.info({ id: row.id, email: row.email, token }, "abandoned-cart: recorded");
    res.status(200).json({ id: row.id, recoveryToken: token });
  } catch (err) {
    req.log.error({ err }, "abandoned-cart: failed to record");
    res.status(500).json({ error: "Failed to record abandoned cart" });
  }
});

/**
 * GET /api/abandoned-carts/recover?token=
 * Handles recovery link click. Returns cart details so the frontend can restore it.
 */
router.get("/abandoned-carts/recover", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  try {
    const rows = await db.select().from(abandonedCarts).where(eq(abandonedCarts.recoveryToken, token)).limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Invalid or expired recovery link" });
      return;
    }

    if (row.status === "recovered") {
      res.status(200).json({ recovered: true });
      return;
    }

    // Update clickedAt
    await db.update(abandonedCarts)
      .set({ clickedAt: new Date(), updatedAt: new Date() })
      .where(eq(abandonedCarts.id, row.id));

    res.status(200).json({
      recovered: false,
      email: row.email,
      cartId: row.cartId,
      lineItems: row.lineItems,
      totalAmount: row.totalAmount,
    });
  } catch (err) {
    req.log.error({ err }, "abandoned-cart: recovery failed");
    res.status(500).json({ error: "Failed to recover cart" });
  }
});

/**
 * POST /api/abandoned-carts/:id/recovered
 * Called by the frontend when a recovered cart successfully places an order.
 */
router.post("/abandoned-carts/:id/recovered", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const rows = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, id)).limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Cart not found" });
      return;
    }

    if (row.status === "recovered") {
      res.status(200).json({ alreadyRecovered: true });
      return;
    }

    await db.update(abandonedCarts)
      .set({ status: "recovered", recoveredAt: new Date(), updatedAt: new Date() })
      .where(eq(abandonedCarts.id, id));

    req.log.info({ id, email: row.email }, "abandoned-cart: marked recovered");
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "abandoned-cart: failed to mark recovered");
    res.status(500).json({ error: "Failed to update" });
  }
});

// ---------------------------------------------------------------------------
// Background scheduler: sends recovery emails
// ---------------------------------------------------------------------------

function isSendTime(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() >= RECOVERY_DELAY_MS;
}

async function sendRecoveryEmails(): Promise<void> {
  try {
    const rows = await db.select().from(abandonedCarts)
      .where(eq(abandonedCarts.status, "started"));

    for (const row of rows) {
      if (!isSendTime(row.createdAt)) continue;
      if (!Array.isArray(row.lineItems) || row.lineItems.length === 0) continue;

      const siteUrl = process.env.SITE_URL ?? "https://buy-moi.com";
      const recoveryUrl = `${siteUrl}/?recover-cart=${row.recoveryToken}`;

      const { html, text } = buildAbandonedCartEmail({
        customerEmail: row.email,
        lineItems: row.lineItems as Array<{
          title: string;
          variant?: string;
          quantity: number;
          price: string;
          imageUrl?: string;
        }>,
        totalAmount: row.totalAmount,
        recoveryUrl,
        siteUrl,
      });

      try {
        await sendEmail({
          to: row.email,
          subject: "You left something behind.",
          html,
          text,
        });

        await db.update(abandonedCarts)
          .set({ status: "email_sent", emailSentAt: new Date(), updatedAt: new Date() })
          .where(eq(abandonedCarts.id, row.id));

        logger.info({ id: row.id, email: row.email }, "abandoned-cart: recovery email sent");
      } catch (err) {
        logger.warn({ err, id: row.id }, "abandoned-cart: failed to send recovery email");
      }
    }
  } catch (err) {
    logger.warn({ err }, "abandoned-cart: scheduler error");
  }
}

// Start background scheduler
setInterval(sendRecoveryEmails, RECOVERY_INTERVAL_MS);
// Run once on startup too (in case of missed emails during downtime)
setTimeout(sendRecoveryEmails, 5000);

export default router;
