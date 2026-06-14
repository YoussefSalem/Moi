import { Router, type IRouter } from "express";
import { runReviewEmailCron } from "../lib/reviewEmailCron.js";
import { buildReviewEmail } from "../lib/reviewEmail.js";
import { sendEmail } from "../lib/email.js";

const router: IRouter = Router();

/**
 * POST /api/review-email/trigger
 *
 * Manual trigger for the review email cron — useful for testing and admin use.
 * Requires the CRON_SECRET env var (if set) as a Bearer token.
 */
router.post("/review-email/trigger", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const result = await runReviewEmailCron();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: "Cron run failed", details: String(err) });
  }
});

/**
 * POST /api/review-email/preview
 *
 * Send a test review email to any address with custom data.
 * Body: { to, customerName, orderId, products: [{ name, slug, id }] }
 */
router.post("/review-email/preview", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const body = req.body as Record<string, unknown>;
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const customerName = typeof body.customerName === "string" ? body.customerName : "there";
  const orderId = typeof body.orderId === "string" ? body.orderId : "1001";
  const products = Array.isArray(body.products) ? body.products as Array<{ name: string; slug: string; id: string }> : [];

  if (!to) {
    res.status(400).json({ error: "Missing 'to' email address" });
    return;
  }

  try {
    const { html, ampHtml, text, subject } = buildReviewEmail({
      customerName,
      orderId,
      customerEmail: to,
      customerId: typeof body.customerId === "string" ? body.customerId : "",
      products: products.length > 0 ? products : [{ name: "Sand Wavvy", slug: "sand-wavvy", id: "preview" }],
    });

    await sendEmail({ to, subject, html, amp: ampHtml, text });
    res.json({ ok: true, subject, to });
  } catch (err) {
    res.status(500).json({ error: "Send failed", details: String(err) });
  }
});

/**
 * GET /api/review-email/queue
 *
 * Returns the last 50 records in the review email queue (admin use).
 */
router.get("/review-email/queue", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const { db, reviewEmailQueue } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(reviewEmailQueue)
      .orderBy(sql`created_at DESC`)
      .limit(50);
    res.json({ ok: true, queue: rows });
  } catch (err) {
    res.status(500).json({ error: "Query failed", details: String(err) });
  }
});

export default router;
