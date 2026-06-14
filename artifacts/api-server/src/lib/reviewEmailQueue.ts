import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import { logger } from "./logger";
import {
  getShopifyOrderForReview,
  getShopifyProductHandle,
  replaceShopifyOrderTag,
} from "./integrations";
import { buildReviewRequestEmail, sendEmail } from "./email";

// ── Constants ─────────────────────────────────────────────────────────────────

const JOB_NAME  = "review-email";
const DLQ_NAME  = "review-email-dlq";
const DELAY_MIN = 24 * 60 * 60;      // 24 h in seconds
const DELAY_MAX = 28 * 60 * 60;      // 28 h in seconds
const MAX_RETRIES    = 2;            // 3 total attempts (initial + 2 retries)
const RETRY_DELAY    = 24 * 60 * 60; // 24 h between retries (seconds)

const TAG_PENDING = "review-email-pending";
const TAG_SENT    = "review-email-sent";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewEmailJobData {
  intentId:            string;
  bostaTrackingNumber: string;
  shopifyOrderId:      number;
}

// ── In-process rate limiting ──────────────────────────────────────────────────
// Shopify tags are the authoritative dedup; this is a belt-and-suspenders guard.

const sentByIntentId  = new Map<string, number>(); // intentId → sentAt ms
const globalSentTs: number[] = [];
const RATE_WINDOW_MS    = 60 * 60 * 1000; // 1 h
const GLOBAL_HOURLY_CAP = 50;             // safety cap per hour (single instance)

function pruneRateLimits(): void {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [k, v] of sentByIntentId) if (v < cutoff) sentByIntentId.delete(k);
  let i = 0;
  while (i < globalSentTs.length && (globalSentTs[i] ?? 0) < cutoff) i++;
  if (i > 0) globalSentTs.splice(0, i);
}

function isRateLimited(intentId: string): string | null {
  pruneRateLimits();
  if (sentByIntentId.has(intentId))            return `duplicate send for intentId ${intentId}`;
  if (globalSentTs.length >= GLOBAL_HOURLY_CAP) return `global cap (${GLOBAL_HOURLY_CAP}/hr) reached`;
  return null;
}

function recordSend(intentId: string): void {
  const now = Date.now();
  sentByIntentId.set(intentId, now);
  globalSentTs.push(now);
}

// ── Product handle cache ──────────────────────────────────────────────────────
// Single-instance assumption: lives for the life of the process.

const productHandleCache = new Map<number, string>();

async function resolveProductHandle(productId: number): Promise<string | null> {
  const hit = productHandleCache.get(productId);
  if (hit) return hit;
  const handle = await getShopifyProductHandle(productId);
  if (handle) productHandleCache.set(productId, handle);
  return handle ?? null;
}

// ── Job worker ────────────────────────────────────────────────────────────────

async function work(jobs: Job<ReviewEmailJobData>[]): Promise<void> {
  for (const job of jobs) {
    await processJob(job);
  }
}

async function processJob(job: Job<ReviewEmailJobData>): Promise<void> {
  const { intentId, shopifyOrderId } = job.data;
  logger.info({ intentId, shopifyOrderId }, "review-email: processing");

  // In-process rate limit
  const rateLimitReason = isRateLimited(intentId);
  if (rateLimitReason) {
    logger.warn({ intentId, reason: rateLimitReason }, "review-email: rate limited — dropping");
    return;
  }

  // Fetch order
  const order = await getShopifyOrderForReview(shopifyOrderId);
  if (!order) {
    logger.warn({ intentId, shopifyOrderId }, "review-email: order not found — aborting");
    return;
  }

  // ── Blocking states ────────────────────────────────────────────────────────

  if (order.cancelled_at) {
    logger.info({ intentId }, "review-email: order cancelled — skipping");
    return;
  }

  if (order.financial_status === "refunded") {
    logger.info({ intentId }, "review-email: order fully refunded — skipping");
    return;
  }

  const tagSet = new Set(
    (order.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
  );

  if (tagSet.has("disputed") || tagSet.has("chargeback")) {
    logger.info({ intentId }, "review-email: order disputed/chargebacked — skipping");
    return;
  }

  // ── Shopify-tag dedup ──────────────────────────────────────────────────────

  if (tagSet.has(TAG_SENT)) {
    logger.info({ intentId }, "review-email: already sent (tag present) — skipping");
    return;
  }

  // ── Customer & product ────────────────────────────────────────────────────

  const customerEmail = order.email;
  if (!customerEmail) {
    logger.warn({ intentId }, "review-email: no customer email — skipping");
    return;
  }

  const customerName =
    order.customer?.first_name ??
    order.billing_address?.first_name ??
    "";

  const lineItems = (order.line_items ?? []) as Array<{
    product_id: number | null;
    title: string;
    price: string;
    quantity: number;
  }>;

  if (lineItems.length === 0) {
    logger.warn({ intentId }, "review-email: no line items — skipping");
    return;
  }

  // Highest total price; tie-break by array index
  let primary = lineItems[0]!;
  for (const item of lineItems.slice(1)) {
    if (Number(item.price) * item.quantity > Number(primary.price) * primary.quantity) {
      primary = item;
    }
  }

  const productHandle = primary.product_id
    ? await resolveProductHandle(primary.product_id)
    : null;

  if (!productHandle) {
    logger.warn(
      { intentId, productId: primary.product_id },
      "review-email: cannot resolve product handle — skipping",
    );
    return;
  }

  // ── Atomic dedup: flip tag pending → sent ─────────────────────────────────

  await replaceShopifyOrderTag(shopifyOrderId, TAG_PENDING, TAG_SENT);

  // ── Build & send email ────────────────────────────────────────────────────

  const { html, text } = buildReviewRequestEmail({
    customerName,
    productHandle,
    productTitle: primary.title ?? "",
  });

  await sendEmail({
    to: customerEmail,
    subject: "Your thoughts mean the world 💕",
    html,
    text,
  });

  recordSend(intentId);
  logger.info({ intentId, shopifyOrderId, productHandle, to: customerEmail }, "review-email: sent");
}

// ── Boss singleton ────────────────────────────────────────────────────────────

let boss: PgBoss | null = null;

export async function startReviewEmailQueue(): Promise<void> {
  if (boss) return;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.error("DATABASE_URL not set — review-email queue will not start");
    return;
  }

  boss = new PgBoss({
    connectionString,
    schema: "pgboss",
    monitorIntervalSeconds: 300,
  });

  boss.on("error", (err: unknown) => logger.error({ err }, "pg-boss error"));

  await boss.start();

  // pg-boss v12 requires the queue to exist before registering a worker
  await boss.createQueue(JOB_NAME);
  await boss.createQueue(DLQ_NAME);

  await boss.work<ReviewEmailJobData>(JOB_NAME, work);

  logger.info("pg-boss: review-email queue started");
}

export async function enqueueReviewEmail(data: ReviewEmailJobData): Promise<void> {
  if (!boss) {
    logger.warn(data, "review-email queue not started — cannot enqueue");
    return;
  }

  const delaySec = DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN));
  const startAfter = new Date(Date.now() + delaySec * 1000);

  const jobId = await boss.send(JOB_NAME, data, {
    singletonKey: `review-${data.intentId}`,
    startAfter,
    retryLimit: MAX_RETRIES,
    retryDelay: RETRY_DELAY,
    deadLetter: DLQ_NAME,
  });

  if (jobId) {
    logger.info(
      { intentId: data.intentId, shopifyOrderId: data.shopifyOrderId, startAfter },
      "review-email: job enqueued",
    );
  } else {
    logger.info(
      { intentId: data.intentId },
      "review-email: job already queued (idempotent skip)",
    );
  }
}

export async function stopReviewEmailQueue(): Promise<void> {
  if (!boss) return;
  await boss.stop();
  boss = null;
  logger.info("pg-boss: review-email queue stopped");
}
