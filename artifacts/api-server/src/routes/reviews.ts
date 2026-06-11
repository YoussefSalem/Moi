import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { productReviews } from "@workspace/db/schema";
import { eq, and, gte, count, or } from "drizzle-orm";
import { sendEmail, buildNewReviewAdminEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { getSiteUrl } from "../lib/siteUrl.js";

const router: IRouter = Router();

function getIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// POST /api/reviews — public submit with spam/rate-limit protection
router.post("/reviews", async (req, res): Promise<void> => {
  const body_ = req.body as Record<string, unknown>;
  const productHandle = typeof body_.productHandle === "string" ? body_.productHandle.trim() : "";
  const rating = typeof body_.rating === "number" ? body_.rating : NaN;
  const title = typeof body_.title === "string" ? body_.title.trim() : "";
  const body = typeof body_.body === "string" ? body_.body.trim() : "";
  const author = typeof body_.author === "string" ? body_.author.trim() : "";
  const email = typeof body_.email === "string" ? body_.email.trim() : "";

  if (!productHandle || isNaN(rating) || rating < 1 || rating > 5 || body.length < 50) {
    res.status(400).json({ error: "Invalid submission. Please check your input." });
    return;
  }
  if (email && !isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }
  const ip = getIp(req);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── Rate limit: max 3 submissions per IP in 24h ─────────────────────────────
  const [{ value: ipCount }] = await db
    .select({ value: count() })
    .from(productReviews)
    .where(
      and(
        eq(productReviews.ipAddress, ip),
        gte(productReviews.submittedAt, since24h),
      ),
    );

  if (ipCount >= 3) {
    res.status(429).json({
      error: "Too many review submissions. Please try again tomorrow.",
      rateLimited: true,
    });
    return;
  }

  // ── Spam detection: determine status before insert ──────────────────────────
  let status = "pending";
  let spamReason: string | undefined;

  // Same email > 1 submission in 24h → flag as spam
  if (email) {
    const [{ value: emailCount }] = await db
      .select({ value: count() })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.email, email),
          gte(productReviews.submittedAt, since24h),
        ),
      );
    if (emailCount >= 2) {
      status = "spam";
      spamReason = "duplicate_email";
    }
  }

  // Duplicate body in last 7 days → flag as spam (silent)
  if (status === "pending") {
    const [{ value: bodyCount }] = await db
      .select({ value: count() })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.body, body.trim()),
          gte(productReviews.submittedAt, since7d),
          or(
            eq(productReviews.status, "pending"),
            eq(productReviews.status, "approved"),
            eq(productReviews.status, "spam"),
          ),
        ),
      );
    if (bodyCount >= 1) {
      status = "spam";
      spamReason = "duplicate_body";
    }
  }

  await db.insert(productReviews).values({
    productHandle,
    rating,
    title: title?.trim() || null,
    body: body.trim(),
    author: author?.trim() || null,
    email: email?.trim() || null,
    status,
    spamReason: spamReason ?? null,
    ipAddress: ip,
  });

  // Send admin notification for genuine pending reviews (fire-and-forget)
  if (status === "pending") {
    const adminEmail = (process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "hello@buy-moi.com").trim();
    const siteUrl = getSiteUrl();
    const adminUrl = `${siteUrl}/admin#reviews`;
    const { html, text } = buildNewReviewAdminEmail({
      author: author || "",
      email: email || "",
      productHandle,
      rating,
      title: title || "",
      body,
      adminUrl,
    });
    void sendEmail({
      to: adminEmail,
      subject: `New ${rating}-star review on ${productHandle} — pending moderation`,
      html,
      text,
    })
      .then(() => logger.info({ adminEmail, productHandle }, "New review admin notification sent"))
      .catch((err) => logger.warn({ err, productHandle }, "New review admin notification failed"));
  }

  // Always return success so spammers don't learn they're blocked
  res.status(201).json({ ok: true });
});

// GET /api/reviews/public?handle=<productHandle> — approved reviews for product page
router.get("/reviews/public", async (req, res): Promise<void> => {
  const handle = typeof req.query.handle === "string" ? req.query.handle : null;
  if (!handle) {
    res.status(400).json({ error: "handle query param required" });
    return;
  }

  const rows = await db
    .select()
    .from(productReviews)
    .where(
      and(
        eq(productReviews.productHandle, handle),
        eq(productReviews.status, "approved"),
      ),
    )
    .orderBy(productReviews.submittedAt);

  res.status(200).json({
    reviews: rows.map((r) => ({
      id: r.id,
      author: r.author ?? "Anonymous",
      title: r.title ?? "",
      body: r.body,
      rating: r.rating,
      date: r.submittedAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      verified: false,
    })),
  });
});

export default router;
