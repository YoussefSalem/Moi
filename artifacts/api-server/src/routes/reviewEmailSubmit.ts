import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productReviews } from "@workspace/db/schema";
import { count, and, eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getSiteUrl } from "../lib/siteUrl.js";
import { generateReviewToken } from "../lib/reviewToken.js";

const router: IRouter = Router();

const VALID_HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function getIp(req: import("express").Request): string {
  const fw = req.headers["x-forwarded-for"];
  if (typeof fw === "string") return fw.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

// Set AMP CORS headers so Gmail's AMP runtime can POST to this endpoint.
// AMP for Email sends requests with AMP-Same-Origin or a sandboxed Origin.
// We allow any origin here because the token validates authenticity instead.
function setAmpCorsHeaders(req: import("express").Request, res: import("express").Response): void {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, AMP-Same-Origin");
  res.setHeader("AMP-Access-Control-Allow-Source-Origin", origin === "*" ? "*" : origin);
}

const EMOJI_MAP: Record<number, string> = { 1: "😡", 2: "😕", 3: "😐", 4: "🙂", 5: "😍" };
const LABEL_MAP: Record<number, string> = { 1: "terrible", 2: "meh", 3: "okay", 4: "loved it", 5: "obsessed" };

function thankYouPage(opts: {
  siteUrl: string;
  productHandle: string;
  rating?: number;
  title?: string;
  reviewText?: string;
  author?: string;
}): string {
  const { siteUrl, productHandle, rating, title, reviewText, author } = opts;
  const shopLink = productHandle && productHandle !== "shop"
    ? `${siteUrl}/products/${productHandle}`
    : siteUrl;

  const emoji = rating ? EMOJI_MAP[rating] ?? "" : "";
  const label = rating ? LABEL_MAP[rating] ?? "" : "";

  const ratingBlock = rating ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:48px;line-height:1;margin-bottom:10px;">${emoji}</div>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;">${label}</p>
    </div>` : "";

  const reviewBlock = (title || reviewText || author) ? `
    <div style="text-align:left;background:#faf8f5;border-left:2px solid #c9a07a;padding:16px 20px;margin-bottom:28px;max-width:360px;margin-left:auto;margin-right:auto;">
      ${author ? `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:#c9a07a;font-weight:700;">${author}</p>` : ""}
      ${title ? `<p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',Times,serif;font-size:14px;color:#1a1714;font-weight:400;">${escapeHtml(title)}</p>` : ""}
      ${reviewText ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5c504a;line-height:1.7;">${escapeHtml(reviewText)}</p>` : ""}
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Moi — thank you 🤍</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#e8e3dc; min-height:100vh; display:flex; align-items:center; justify-content:center; font-family:Arial,Helvetica,sans-serif; padding:24px; }
  .card { background:#ffffff; max-width:480px; width:100%; text-align:center; overflow:hidden; }
  .bar-top  { background:linear-gradient(to right,#c9a07a,#1a1714); height:3px; }
  .bar-bot  { background:linear-gradient(to right,#c9a07a,#1a1714); height:2px; }
  .body { padding:52px 44px 48px; }
  .logo { font-family:Georgia,'Times New Roman',Times,serif; font-size:20px; letter-spacing:0.14em; color:#1a1714; font-weight:400; display:block; margin-bottom:36px; }
  h1 { font-family:Georgia,'Times New Roman',Times,serif; font-size:28px; font-weight:400; color:#1a1714; line-height:1.25; margin-bottom:14px; }
  .sub { font-size:13px; line-height:1.8; color:#5c504a; margin-bottom:32px; }
  a.btn { display:inline-block; background:#1a1714; color:#ffffff; text-decoration:none; padding:13px 36px; font-size:10px; font-weight:700; letter-spacing:0.38em; text-transform:uppercase; margin-bottom:28px; }
  .footer-txt { font-size:12px; color:#b0a89e; }
</style>
</head>
<body>
  <div class="card">
    <div class="bar-top"></div>
    <div class="body">
      <span class="logo">MOI</span>
      ${ratingBlock}
      <h1>thank you,<br />genuinely. 🤍</h1>
      <p class="sub">your review means everything — it helps other girls find their next favourite piece. we'll be reading it, promise.</p>
      ${reviewBlock}
      <a href="${shopLink}" class="btn">keep browsing</a>
      <p class="footer-txt">XoXo, Moi.💋</p>
    </div>
    <div class="bar-bot"></div>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Moi — oops</title>
<style>
  body { background:#e8e3dc; min-height:100vh; display:flex; align-items:center; justify-content:center; font-family:Arial,Helvetica,sans-serif; padding:24px; }
  .card { background:#fff; max-width:440px; width:100%; text-align:center; overflow:hidden; }
  .bar { background:linear-gradient(to right,#c9a07a,#1a1714); height:3px; }
  .body { padding:48px; }
  .logo { font-family:Georgia,serif; font-size:20px; letter-spacing:0.14em; color:#1a1714; font-weight:400; display:block; margin-bottom:32px; }
  h1 { font-family:Georgia,serif; font-size:22px; font-weight:400; color:#1a1714; margin-bottom:12px; }
  p { font-size:13px; color:#5c504a; line-height:1.7; }
</style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="body">
      <span class="logo">MOI</span>
      <h1>something went sideways 😬</h1>
      <p>${message}</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function checkRateLimit(ip: string, since: Date): Promise<boolean> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(productReviews)
    .where(and(eq(productReviews.ipAddress, ip), gte(productReviews.submittedAt, since)));
  return value >= 3;
}

async function checkEmailDuplicate(email: string, handle: string, since: Date): Promise<boolean> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(productReviews)
    .where(and(
      eq(productReviews.email, email),
      eq(productReviews.productHandle, handle),
      gte(productReviews.submittedAt, since)
    ));
  return value > 0;
}

// ─── AMP CORS preflight ───────────────────────────────────────────────────────
router.options("/review-email/submit", (req, res): void => {
  setAmpCorsHeaders(req, res);
  res.sendStatus(204);
});

/**
 * POST /api/review-email/submit
 *
 * Handles form submission from the email client.
 *
 * Standard clients (Apple Mail, Yahoo Mail): opens a new tab, returns a
 * branded HTML thank-you page.
 *
 * AMP for Email (Gmail): ?format=amp in the action URL triggers JSON
 * responses so <amp-form> can show the success/error inline in the email.
 *
 * Hidden fields expected in the POST body:
 *   productHandle  — product slug (required for validation)
 *   productId      — Shopify numeric product ID (logged, not stored)
 *   email          — customer email (used for spam detection + token check)
 *   orderId        — order number (used for token check)
 *   customerId     — Shopify customer ID (logged, not stored)
 *   token          — HMAC token from generateReviewToken (required)
 *   rating         — 1–5 (required)
 *   author         — display name
 *   title          — review headline
 *   body           — review body text
 */
router.post("/review-email/submit", async (req, res): Promise<void> => {
  const isAmp = req.query.format === "amp";
  if (isAmp) setAmpCorsHeaders(req, res);

  const body = req.body as Record<string, unknown>;
  const siteUrl = getSiteUrl();

  const productHandle = (typeof body.productHandle === "string" ? body.productHandle : "").trim().toLowerCase();
  const productId     = (typeof body.productId     === "string" ? body.productId     : "").trim();
  const email         = (typeof body.email         === "string" ? body.email         : "").trim();
  const orderId       = (typeof body.orderId       === "string" ? body.orderId       : "").trim();
  const customerId    = (typeof body.customerId    === "string" ? body.customerId    : "").trim();
  const token         = (typeof body.token         === "string" ? body.token         : "").trim();
  const author        = (typeof body.author        === "string" ? body.author        : "").trim().slice(0, 80);
  const title         = (typeof body.title         === "string" ? body.title         : "").trim().slice(0, 200);
  const reviewBody    = (typeof body.body          === "string" ? body.body          : "").trim().slice(0, 2000);
  const ratingRaw     = typeof body.rating === "string" ? parseInt(body.rating, 10) : NaN;

  // ── Field validation ────────────────────────────────────────────────────────
  if (!productHandle || !VALID_HANDLE_RE.test(productHandle)) {
    if (isAmp) { res.status(400).json({ message: "We couldn't identify the product. Please use the link below." }); return; }
    res.status(400).send(errorPage("We couldn't identify the product. Please try leaving your review on the website."));
    return;
  }

  if (isNaN(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    if (isAmp) { res.status(400).json({ message: "Please select a star rating before submitting." }); return; }
    res.status(400).send(errorPage("Please select a star rating before submitting."));
    return;
  }

  if (email && !isValidEmail(email)) {
    if (isAmp) { res.status(400).json({ message: "The email address doesn't look right. Please try again." }); return; }
    res.status(400).send(errorPage("The email address doesn't look right. Please try again."));
    return;
  }

  // ── Token validation ────────────────────────────────────────────────────────
  // The token is an HMAC of (productHandle, email, orderId) generated when
  // the email was sent. Verifying it ensures the submission came from a
  // genuine review email, not a forged POST.
  if (!token || !email || !orderId) {
    if (isAmp) { res.status(403).json({ message: "This review link is invalid or has expired." }); return; }
    res.status(403).send(errorPage("This review link is invalid or has expired. Please use the link in your email."));
    return;
  }

  const expectedToken = generateReviewToken(productHandle, email, orderId);
  if (token !== expectedToken) {
    logger.warn({ productHandle, email, orderId }, "review-email/submit: invalid token");
    if (isAmp) { res.status(403).json({ message: "This review link is invalid or has expired." }); return; }
    res.status(403).send(errorPage("This review link is invalid or has expired."));
    return;
  }

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = getIp(req);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (await checkRateLimit(ip, since24h)) {
    if (isAmp) { res.status(429).json({ message: "You've submitted a few reviews already today. Come back tomorrow 🤍" }); return; }
    res.status(429).send(errorPage("You've submitted a few reviews already today. Come back tomorrow 🤍"));
    return;
  }

  // ── Spam detection ──────────────────────────────────────────────────────────
  let status = "pending";
  let spamReason: string | undefined;

  if (email) {
    const isDuplicate = await checkEmailDuplicate(email, productHandle, since24h);
    if (isDuplicate) {
      status = "spam";
      spamReason = "duplicate_email";
    }
  }

  // ── Insert review ────────────────────────────────────────────────────────────
  try {
    await db.insert(productReviews).values({
      productHandle,
      rating: ratingRaw,
      title: title || null,
      body: reviewBody || null,
      author: author || null,
      email: email || null,
      status,
      spamReason: spamReason ?? null,
      ipAddress: ip,
    });

    logger.info(
      { productHandle, productId, customerId, rating: ratingRaw, email, status },
      "review-email/submit: review inserted"
    );
  } catch (err) {
    logger.error({ err }, "review-email/submit: DB insert failed");
    if (isAmp) { res.status(500).json({ message: "Something went wrong on our end. Please try again in a moment." }); return; }
    res.status(500).send(errorPage("Something went wrong on our end. Please try again in a moment."));
    return;
  }

  if (isAmp) {
    res.status(200).json({ result: "ok" });
    return;
  }

  res.send(thankYouPage({
    siteUrl,
    productHandle,
    rating: ratingRaw,
    title,
    reviewText: reviewBody,
    author,
  }));
});

/**
 * GET /api/review-email/quick-rate
 *
 * Single-click review submission for email clients that strip <form> tags.
 * Validates an HMAC token then inserts the review and returns the thank-you page.
 */
router.get("/review-email/quick-rate", async (req, res): Promise<void> => {
  const handle  = (typeof req.query.handle  === "string" ? req.query.handle  : "").trim().toLowerCase();
  const email   = (typeof req.query.email   === "string" ? req.query.email   : "").trim();
  const orderId = (typeof req.query.orderId === "string" ? req.query.orderId : "").trim();
  const ratingStr = typeof req.query.rating === "string" ? req.query.rating : "";
  const token     = typeof req.query.token  === "string" ? req.query.token  : "";
  const siteUrl   = getSiteUrl();

  if (!handle || !VALID_HANDLE_RE.test(handle)) {
    res.status(400).send(errorPage("Invalid product link."));
    return;
  }

  const rating = parseInt(ratingStr, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    res.status(400).send(errorPage("Invalid rating value."));
    return;
  }

  const expected = generateReviewToken(handle, email, orderId);
  if (!token || token !== expected) {
    res.status(403).send(errorPage("This review link has expired or is invalid."));
    return;
  }

  const ip = getIp(req);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (email) {
    const alreadyDone = await checkEmailDuplicate(email, handle, since24h);
    if (alreadyDone) {
      res.send(thankYouPage({ siteUrl, productHandle: handle, rating }));
      return;
    }
  }

  if (await checkRateLimit(ip, since24h)) {
    res.status(429).send(errorPage("Too many reviews submitted today. Come back tomorrow 🤍"));
    return;
  }

  try {
    await db.insert(productReviews).values({
      productHandle: handle,
      rating,
      email: email || null,
      author: null,
      title: null,
      body: null,
      status: "pending",
      spamReason: null,
      ipAddress: ip,
    });

    logger.info({ handle, rating, email }, "review-email/quick-rate: review inserted");
  } catch (err) {
    logger.error({ err }, "review-email/quick-rate: DB insert failed");
    res.status(500).send(errorPage("Something went wrong. Please try again."));
    return;
  }

  res.send(thankYouPage({ siteUrl, productHandle: handle, rating }));
});

export default router;
