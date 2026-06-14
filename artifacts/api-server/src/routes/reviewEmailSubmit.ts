import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productReviews } from "@workspace/db/schema";
import { count, and, eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getSiteUrl } from "../lib/siteUrl.js";

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

function thankYouPage(siteUrl: string, productHandle: string, productName?: string): string {
  const shopLink = productHandle ? `${siteUrl}/product/${productHandle}` : `${siteUrl}/shop`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Moi — thank you 🤍</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #e8e3dc;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
    padding: 24px;
  }
  .card {
    background: #ffffff;
    max-width: 480px;
    width: 100%;
    text-align: center;
    overflow: hidden;
  }
  .accent { background: #1a1714; height: 3px; }
  .body { padding: 56px 48px 52px; }
  .logo { font-size: 9px; font-weight: 700; letter-spacing: 0.5em; text-transform: uppercase; color: #1a1714; margin-bottom: 40px; display: block; }
  h1 { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 30px; font-weight: 400; color: #1a1714; line-height: 1.2; margin-bottom: 16px; }
  p { font-size: 13px; line-height: 1.8; color: #5c504a; margin-bottom: 32px; }
  a.btn {
    display: inline-block;
    background: #1a1714;
    color: #ffffff;
    text-decoration: none;
    padding: 13px 36px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    margin-bottom: 32px;
  }
  .footer { font-size: 12px; color: #b0a89e; }
  .accent-bottom { background: #1a1714; height: 2px; }
</style>
</head>
<body>
  <div class="card">
    <div class="accent"></div>
    <div class="body">
      <span class="logo">M O I</span>
      <h1>thank you,<br />genuinely. 🤍</h1>
      <p>your review means everything to us — it helps other girls find their next favourite piece. we'll be reading it, promise.</p>
      <a href="${shopLink}" class="btn">Keep browsing</a>
      <p class="footer">XoXo, Moi.💋</p>
    </div>
    <div class="accent-bottom"></div>
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
  .accent { background:#1a1714; height:3px; }
  .body { padding:48px; }
  .logo { font-size:9px; font-weight:700; letter-spacing:0.5em; text-transform:uppercase; color:#1a1714; margin-bottom:32px; display:block; }
  h1 { font-family:Georgia,serif; font-size:24px; font-weight:400; color:#1a1714; margin-bottom:12px; }
  p { font-size:13px; color:#5c504a; line-height:1.7; }
</style>
</head>
<body>
  <div class="card">
    <div class="accent"></div>
    <div class="body">
      <span class="logo">M O I</span>
      <h1>something went wrong 😬</h1>
      <p>${message}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * POST /api/review-email/submit
 *
 * Accepts an HTML form POST (application/x-www-form-urlencoded) from the
 * review request email. Validates and inserts the review, then returns a
 * branded thank-you HTML page.
 */
router.post("/review-email/submit", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const siteUrl = getSiteUrl();

  const productHandle = (typeof body.productHandle === "string" ? body.productHandle : "").trim().toLowerCase();
  const email = (typeof body.email === "string" ? body.email : "").trim();
  const author = (typeof body.author === "string" ? body.author : "").trim().slice(0, 80);
  const title = (typeof body.title === "string" ? body.title : "").trim().slice(0, 200);
  const reviewBody = (typeof body.body === "string" ? body.body : "").trim().slice(0, 2000);
  const ratingRaw = typeof body.rating === "string" ? parseInt(body.rating, 10) : NaN;

  if (!productHandle || !VALID_HANDLE_RE.test(productHandle)) {
    res.status(400).send(errorPage("We couldn't identify the product. Please try leaving your review on the website."));
    return;
  }

  if (isNaN(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    res.status(400).send(errorPage("Please select a star rating before submitting."));
    return;
  }

  if (email && !isValidEmail(email)) {
    res.status(400).send(errorPage("The email address on this review doesn't look right. Please try again."));
    return;
  }

  const ip = getIp(req);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Basic rate limit: max 3 submissions per IP in 24h
  const [{ value: ipCount }] = await db
    .select({ value: count() })
    .from(productReviews)
    .where(and(eq(productReviews.ipAddress, ip), gte(productReviews.submittedAt, since24h)));

  if (ipCount >= 3) {
    res.status(429).send(errorPage("You've submitted a few reviews already today. Come back tomorrow 🤍"));
    return;
  }

  let status = "pending";
  let spamReason: string | undefined;

  if (email) {
    const [{ value: emailCount }] = await db
      .select({ value: count() })
      .from(productReviews)
      .where(and(eq(productReviews.email, email), gte(productReviews.submittedAt, since24h)));
    if (emailCount >= 5) {
      status = "spam";
      spamReason = "duplicate_email";
    }
  }

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
      { productHandle, rating: ratingRaw, email, status },
      "review-email/submit: review inserted"
    );
  } catch (err) {
    logger.error({ err }, "review-email/submit: DB insert failed");
    res.status(500).send(errorPage("Something went wrong on our end. Please try again in a moment."));
    return;
  }

  res.send(thankYouPage(siteUrl, productHandle));
});

export default router;
