import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { productReviews } from "@workspace/db/schema";
import { eq, and, gte, count, avg, gt, or, isNull } from "drizzle-orm";
import { sendEmail, buildNewReviewAdminEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { getSiteUrl } from "../lib/siteUrl.js";

const router: IRouter = Router();

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

// Known valid product handle slugs — rejects garbage / fake handles
const VALID_HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;

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
  const variantId = typeof body_.variantId === "string" ? body_.variantId.trim() : null;
  const rating = typeof body_.rating === "number" ? body_.rating : NaN;
  const title = typeof body_.title === "string" ? body_.title.trim() : "";
  const body = typeof body_.body === "string" ? body_.body.trim() : "";
  const author = typeof body_.author === "string" ? body_.author.trim() : "";
  const email = typeof body_.email === "string" ? body_.email.trim() : "";

  // Basic field validation
  if (
    !productHandle ||
    !VALID_HANDLE_RE.test(productHandle) ||
    isNaN(rating) ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    res.status(400).json({ error: "Invalid submission. Please check your input." });
    return;
  }

  // Length limits
  if (title.length > 200) {
    res.status(400).json({ error: "Title must be 200 characters or fewer." });
    return;
  }
  if (body.length > 2000) {
    res.status(400).json({ error: "Review must be 2,000 characters or fewer." });
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

  // Same email > 5 submissions in 24h → flag as spam
  // Threshold is 5 (not 2) so a buyer reviewing multiple purchases the same day
  // doesn't get silently blocked.
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
    if (emailCount >= 5) {
      status = "spam";
      spamReason = "duplicate_email";
    }
  }

  // Duplicate body in last 7 days → flag as spam (silent); skip for rating-only reviews.
  // Only check against approved reviews — checking spam rows would prevent a user from
  // resubmitting after an earlier review was incorrectly flagged.
  if (status === "pending" && body.trim().length > 0) {
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
    variantId: variantId || null,
    rating,
    title: title?.trim() || null,
    body: body.trim() || null,
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

// GET /api/reviews/public
//   ?handle=<productHandle>
//   &variantId=<variantId>   (optional)
//   &limit=<n>               (1–50, default 12)
//   &cursor=<lastId>         (last review id from previous page, for pagination)
//
// Returns: { reviews, nextCursor, total, avgRating }
// — Variant-scoped with backward-compatible fallback for pre-migration
//   reviews (variantId IS NULL match).
// — cursor-based pagination on `id ASC` for stable ordering with no duplicates.
router.get("/reviews/public", async (req, res): Promise<void> => {
  const handle = typeof req.query.handle === "string" ? req.query.handle : null;
  const variantId = typeof req.query.variantId === "string" ? req.query.variantId : null;
  const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : DEFAULT_PAGE_SIZE;
  const cursorRaw = typeof req.query.cursor === "string" ? parseInt(req.query.cursor, 10) : null;

  if (!handle) {
    res.status(400).json({ error: "handle query param required" });
    return;
  }

  const limit = Math.min(Math.max(isNaN(limitRaw) ? DEFAULT_PAGE_SIZE : limitRaw, 1), MAX_PAGE_SIZE);
  const cursor = cursorRaw !== null && !isNaN(cursorRaw) ? cursorRaw : null;

  // Variant filter shared between page query and stats query.
  // NULL variantId = "applies to all variants" (backward compat).
  // When a specific variantId is requested, include both that variant's
  // reviews AND any NULL reviews (product-level reviews).
  const variantFilter = variantId
    ? and(
        eq(productReviews.productHandle, handle),
        or(
          eq(productReviews.variantId, variantId),
          isNull(productReviews.variantId),
        ),
      )
    : and(
        eq(productReviews.productHandle, handle),
        isNull(productReviews.variantId),
      );

  // Page condition — adds cursor constraint when paginating
  const pageWhere = cursor !== null
    ? and(variantFilter, eq(productReviews.status, "approved"), gt(productReviews.id, cursor))
    : and(variantFilter, eq(productReviews.status, "approved"));

  // Stats condition — always over all approved reviews (no cursor), for accurate header summary
  const statsWhere = and(variantFilter, eq(productReviews.status, "approved"));

  // Fetch one extra row to detect hasMore, and run stats in parallel
  const [pageRows, statsRows] = await Promise.all([
    db
      .select()
      .from(productReviews)
      .where(pageWhere)
      .orderBy(productReviews.id)
      .limit(limit + 1),
    db
      .select({ total: count(), avgRating: avg(productReviews.rating) })
      .from(productReviews)
      .where(statsWhere),
  ]);

  const hasMore = pageRows.length > limit;
  const rows = hasMore ? pageRows.slice(0, limit) : pageRows;
  const nextCursor = hasMore ? rows[rows.length - 1].id : null;

  const totalCount = Number(statsRows[0]?.total ?? 0);
  // parseFloat can return NaN for unexpected Postgres output; || 0 ensures a safe fallback
  const avgRating = parseFloat(statsRows[0]?.avgRating ?? "0") || 0;

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
    nextCursor,
    total: totalCount,
    avgRating,
  });
});

export default router;
