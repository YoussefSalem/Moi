import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { abandonedCarts } from "@workspace/db/schema";
import { eq, desc, and, isNull, isNotNull, or } from "drizzle-orm";
import { sendEmail, buildAbandonedCartEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { getSiteUrl } from "../lib/siteUrl";

const router = Router();

const isDev = process.env.NODE_ENV === "development";
const RECOVERY_DELAY_MS  = isDev ? 10 * 1000 :  45 * 60 * 1000; // 10s  dev / 45min prod
const DELAY_2_MS         = isDev ? 20 * 1000 :  24 * 60 * 60 * 1000; // 20s  dev / 24h   prod
const DELAY_3_MS         = isDev ? 30 * 1000 :  72 * 60 * 60 * 1000; // 30s  dev / 72h   prod
const RECOVERY_INTERVAL_MS = isDev ? 5 * 1000 : 5 * 60 * 1000; // 5s  dev / 5min prod

function generateRecoveryToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * POST /api/abandoned-carts/start
 * Idempotent upsert: if a "started" cart already exists for this email,
 * update its line items and total. Otherwise create a new record.
 * Safe to call multiple times (debounce, onBlur, and sendBeacon all hit this).
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
    const safeEmail = email.trim().toLowerCase();

    // Upsert: update the most-recent "started" cart for this email if one exists.
    const [existing] = await db.select()
      .from(abandonedCarts)
      .where(and(eq(abandonedCarts.email, safeEmail), eq(abandonedCarts.status, "started")))
      .orderBy(desc(abandonedCarts.createdAt))
      .limit(1);

    if (existing) {
      await db.update(abandonedCarts)
        .set({
          lineItems,
          totalAmount,
          cartId: cartId ?? existing.cartId,
          updatedAt: new Date(),
        })
        .where(eq(abandonedCarts.id, existing.id));

      req.log.info({ id: existing.id, email: safeEmail }, "abandoned-cart: updated");
      res.status(200).json({ id: existing.id, recoveryToken: existing.recoveryToken });
      return;
    }

    // No existing record — create a fresh one.
    const token = generateRecoveryToken();
    const [row] = await db.insert(abandonedCarts).values({
      email: safeEmail,
      cartId: cartId ?? null,
      originalCartId: cartId ?? null,
      lineItems,
      totalAmount,
      recoveryToken: token,
      status: "started",
    }).returning();

    req.log.info({ id: row.id, email: row.email }, "abandoned-cart: started");
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
 * POST /api/abandoned-carts/complete
 * Fallback called at order completion when no cart was recorded via email blur
 * (e.g. mobile autofill / copy-paste). Finds any "started" cart for this email
 * and marks it recovered, or creates a new record already in "recovered" state
 * so every completed order appears in the admin panel.
 */
router.post("/abandoned-carts/complete", async (req, res) => {
  const { email, cartId, lineItems, totalAmount } = req.body as {
    email?: string;
    cartId?: string | null;
    lineItems?: Array<{ title: string; variant?: string | null; quantity: number; price: string; imageUrl?: string | null }>;
    totalAmount?: string;
  };

  if (!email || !lineItems || !totalAmount) {
    res.status(400).json({ error: "email, lineItems, and totalAmount required" });
    return;
  }

  const safeEmail = email.trim().toLowerCase();

  try {
    const [existing] = await db.select().from(abandonedCarts)
      .where(and(eq(abandonedCarts.email, safeEmail), eq(abandonedCarts.status, "started")))
      .orderBy(desc(abandonedCarts.createdAt))
      .limit(1);

    if (existing) {
      await db.update(abandonedCarts)
        .set({ status: "recovered", recoveredAt: new Date(), updatedAt: new Date() })
        .where(eq(abandonedCarts.id, existing.id));
      req.log.info({ id: existing.id, email: safeEmail }, "abandoned-cart: recovered");
    } else {
      const token = generateRecoveryToken();
      const [row] = await db.insert(abandonedCarts).values({
        email: safeEmail,
        cartId: cartId ?? null,
        originalCartId: cartId ?? null,
        lineItems,
        totalAmount,
        recoveryToken: token,
        status: "recovered",
        recoveredAt: new Date(),
      }).returning();
      req.log.info({ id: row.id, email: safeEmail }, "abandoned-cart: recovered (no prior started record)");
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "abandoned-cart: complete failed");
    res.status(500).json({ error: "Failed" });
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

type LineItem = {
  title: string;
  variant?: string;
  quantity: number;
  price: string;
  imageUrl?: string;
};

function ageMs(createdAt: Date): number {
  return Date.now() - createdAt.getTime();
}

function repairLineItems(items: unknown, siteUrl: string): LineItem[] {
  return (items as LineItem[]).map((item) => {
    if (!item.imageUrl) return item;
    // Skip Shopify CDN URLs — they are always correct as-is
    if (item.imageUrl.includes("cdn.shopify.com")) return item;
    const fixed = item.imageUrl
      // Fix legacy /images/ paths (old deployments)
      .replace(/^https?:\/\/[^/]+\/images\//, `${siteUrl}/api/images/`)
      // Fix /api/images/ paths captured with a stale origin (e.g. dev preview URL)
      .replace(/^https?:\/\/[^/]+\/api\/images\//, `${siteUrl}/api/images/`);
    return { ...item, imageUrl: fixed };
  });
}

async function sendRecoveryEmails(): Promise<void> {
  try {
    const siteUrl = getSiteUrl();

    // ── Email 1: 45 min after abandonment (status = "started") ───────────
    const started = await db.select().from(abandonedCarts)
      .where(eq(abandonedCarts.status, "started"));

    for (const row of started) {
      if (ageMs(row.createdAt) < RECOVERY_DELAY_MS) continue;
      if (!Array.isArray(row.lineItems) || row.lineItems.length === 0) continue;

      if (!row.email || !row.email.includes("@")) {
        await db.update(abandonedCarts)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(abandonedCarts.id, row.id));
        logger.warn({ id: row.id, email: row.email }, "abandoned-cart: invalid email, marking failed");
        continue;
      }

      const recoveryUrl = `${siteUrl}/?recover-cart=${row.recoveryToken}`;
      const { html, text } = buildAbandonedCartEmail({
        customerEmail: row.email,
        lineItems: repairLineItems(row.lineItems, siteUrl),
        totalAmount: row.totalAmount,
        recoveryUrl,
        siteUrl,
      });

      try {
        await sendEmail({ to: row.email, subject: "You left something behind.", html, text });
        await db.update(abandonedCarts)
          .set({ status: "email_sent", emailSentAt: new Date(), updatedAt: new Date() })
          .where(eq(abandonedCarts.id, row.id));
        logger.info({ id: row.id, email: row.email }, "abandoned-cart: email 1 sent");
      } catch (err) {
        logger.warn({ err, id: row.id }, "abandoned-cart: failed to send email 1");
        await db.update(abandonedCarts)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(abandonedCarts.id, row.id));
      }
    }

    // ── Email 2: 24 h after abandonment (email_sent, email2SentAt IS NULL) ──
    const forEmail2 = await db.select().from(abandonedCarts)
      .where(and(eq(abandonedCarts.status, "email_sent"), isNull(abandonedCarts.email2SentAt)));

    for (const row of forEmail2) {
      if (ageMs(row.emailSentAt ?? row.createdAt) < DELAY_2_MS) continue;
      if (!Array.isArray(row.lineItems) || row.lineItems.length === 0) continue;

      const recoveryUrl = `${siteUrl}/?recover-cart=${row.recoveryToken}`;
      const { html, text } = buildAbandonedCartEmail({
        customerEmail: row.email,
        lineItems: repairLineItems(row.lineItems, siteUrl),
        totalAmount: row.totalAmount,
        recoveryUrl,
        siteUrl,
        headline: "Your cart is still waiting",
        subheadline: "You recently left a few items in your cart and we wanted to make sure you didn\u2019t miss them.\n\nIf you\u2019re still interested, you can return to your cart and complete your order in just a few clicks.",
        ctaText: "Complete Your Order",
        previewText: "Your items are still waiting in your cart.",
      });

      try {
        await sendEmail({ to: row.email, subject: "Still thinking it over?", html, text });
        await db.update(abandonedCarts)
          .set({ email2SentAt: new Date(), updatedAt: new Date() })
          .where(eq(abandonedCarts.id, row.id));
        logger.info({ id: row.id, email: row.email }, "abandoned-cart: email 2 sent");
      } catch (err) {
        logger.warn({ err, id: row.id }, "abandoned-cart: failed to send email 2");
      }
    }

    // ── Email 3: 72 h after abandonment (email_sent, email2 sent, email3 IS NULL) ──
    const forEmail3 = await db.select().from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.status, "email_sent"),
        isNotNull(abandonedCarts.email2SentAt),
        isNull(abandonedCarts.email3SentAt),
      ));

    for (const row of forEmail3) {
      if (ageMs(row.emailSentAt ?? row.createdAt) < DELAY_3_MS) continue;
      if (!Array.isArray(row.lineItems) || row.lineItems.length === 0) continue;

      const recoveryUrl = `${siteUrl}/?recover-cart=${row.recoveryToken}`;
      const { html, text } = buildAbandonedCartEmail({
        customerEmail: row.email,
        lineItems: repairLineItems(row.lineItems, siteUrl),
        totalAmount: row.totalAmount,
        recoveryUrl,
        siteUrl,
        headline: "Final reminder",
        subheadline: "This is our last reminder about the items you left in your cart.\n\nIf you\u2019re still interested, now is a great time to complete your order before your cart session expires or product availability changes.",
        ctaText: "Return To Your Cart",
        previewText: "Take one last look before your cart expires.",
      });

      try {
        await sendEmail({
          to: row.email,
          subject: "Last reminder: your cart may not be available for much longer",
          html,
          text,
        });
        await db.update(abandonedCarts)
          .set({ email3SentAt: new Date(), updatedAt: new Date() })
          .where(eq(abandonedCarts.id, row.id));
        logger.info({ id: row.id, email: row.email }, "abandoned-cart: email 3 sent");
      } catch (err) {
        logger.warn({ err, id: row.id }, "abandoned-cart: failed to send email 3");
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
