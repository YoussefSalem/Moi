import { PgBoss } from "pg-boss";
import type { JobWithMetadata } from "pg-boss";
import { logger } from "./logger";
import {
  getShopifyOrderForReview,
  getShopifyProductHandle,
  getShopifyOrderDisputes,
  replaceShopifyOrderTag,
  tagShopifyOrder,
  TransientShopifyError,
} from "./integrations";
import { buildReviewRequestEmail, sendEmail, ResendTerminalError } from "./email";

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

// ── Shopify Admin API throttle ─────────────────────────────────────────────
// Shopify allows 2 req/s (Standard plan). All worker Shopify calls go through
// this guard to prevent 429s during multi-attempt batch processing.

const SHOPIFY_THROTTLE_MS = 500; // 2 req/s
let lastShopifyCallMs = 0;

async function shopifyThrottle(): Promise<void> {
  const wait = SHOPIFY_THROTTLE_MS - (Date.now() - lastShopifyCallMs);
  if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
  lastShopifyCallMs = Date.now();
}

// ── DLQ monitoring ────────────────────────────────────────────────────────────
// Two-layer rate limiting: per-intent 1 h cooldown + global 5/hr cap.
// Both layers emit WARN with explicit suppressionReason when throttled.

const dlqAlertByIntentId = new Map<string, number>(); // intentId → lastAlertMs
const dlqGlobalAlertTs:    number[] = [];
const DLQ_ALERT_PER_INTENT_MS   = 60 * 60 * 1000; // 1 h per intent
const DLQ_GLOBAL_CAP_PER_HOUR   = 5;
const DLQ_ALERT_WINDOW_MS       = 60 * 60 * 1000;

function shouldEmitDlqAlert(intentId: string): { emit: boolean; reason?: string } {
  const now    = Date.now();
  const cutoff = now - DLQ_ALERT_WINDOW_MS;

  // Prune stale entries
  for (const [k, v] of dlqAlertByIntentId) if (v < cutoff) dlqAlertByIntentId.delete(k);
  let i = 0;
  while (i < dlqGlobalAlertTs.length && (dlqGlobalAlertTs[i] ?? 0) < cutoff) i++;
  if (i > 0) dlqGlobalAlertTs.splice(0, i);

  // Per-intent cooldown
  const lastForIntent = dlqAlertByIntentId.get(intentId);
  if (lastForIntent !== undefined && now - lastForIntent < DLQ_ALERT_PER_INTENT_MS) {
    const remaining = Math.round((DLQ_ALERT_PER_INTENT_MS - (now - lastForIntent)) / 60000);
    return { emit: false, reason: `per-intent cooldown (${remaining}min remaining for ${intentId})` };
  }

  // Global hourly cap
  if (dlqGlobalAlertTs.length >= DLQ_GLOBAL_CAP_PER_HOUR) {
    return { emit: false, reason: `global DLQ cap (${DLQ_GLOBAL_CAP_PER_HOUR}/hr reached)` };
  }

  dlqAlertByIntentId.set(intentId, now);
  dlqGlobalAlertTs.push(now);
  return { emit: true };
}

async function workDlq(jobs: JobWithMetadata<ReviewEmailJobData>[]): Promise<void> {
  for (const job of jobs) {
    const { intentId, shopifyOrderId } = job.data;
    const { emit, reason } = shouldEmitDlqAlert(intentId);
    if (emit) {
      logger.warn(
        { intentId, shopifyOrderId, retryCount: job.retryCount },
        "review-email: job landed in DLQ — manual intervention may be needed",
      );
    } else {
      logger.warn(
        { intentId, shopifyOrderId, suppressionReason: reason },
        "review-email: DLQ alert suppressed",
      );
    }
  }
}

// ── Job worker ────────────────────────────────────────────────────────────────

async function work(jobs: JobWithMetadata<ReviewEmailJobData>[]): Promise<void> {
  for (const job of jobs) {
    await processJob(job);
  }
}

async function processJob(job: JobWithMetadata<ReviewEmailJobData>): Promise<void> {
  const { intentId, shopifyOrderId } = job.data;
  const attempt = (job.retryCount ?? 0) + 1;
  const startMs = Date.now();

  logger.info({ intentId, shopifyOrderId, attempt }, "review-email: processing");

  // In-process rate limit (belt-and-suspenders; Shopify tags are authoritative)
  const rateLimitReason = isRateLimited(intentId);
  if (rateLimitReason) {
    logger.warn(
      { intentId, reason: rateLimitReason, orderId: shopifyOrderId, attempt, status: "rate_limited", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // ── Fetch order (transient vs terminal distinction) ───────────────────────

  let order: Awaited<ReturnType<typeof getShopifyOrderForReview>>;
  try {
    await shopifyThrottle();
    order = await getShopifyOrderForReview(shopifyOrderId);
  } catch (err) {
    if (err instanceof TransientShopifyError) {
      logger.warn(
        { intentId, shopifyOrderId, attempt, err, status: "transient_error", durationMs: Date.now() - startMs },
        "review-email: transient Shopify error — retrying",
      );
      throw err; // pg-boss will retry
    }
    logger.warn(
      { intentId, shopifyOrderId, attempt, err, status: "fetch_error", durationMs: Date.now() - startMs },
      "review-email: unexpected fetch error — aborting",
    );
    return;
  }

  if (!order) {
    logger.warn(
      { intentId, shopifyOrderId, attempt, status: "not_found", durationMs: Date.now() - startMs },
      "review-email: order not found (404) — terminal abort",
    );
    return;
  }

  // ── Phase 1: mark job as in-flight ────────────────────────────────────────
  // Idempotent: if TAG_PENDING is already present (prior failed attempt between
  // phase 1 and phase 3), tagShopifyOrder is a no-op.  Moving this into the
  // worker (not the webhook) ensures the tag is only set when a job is actually
  // executing, so a failed enqueue never orphans a pending tag.
  await shopifyThrottle();
  await tagShopifyOrder(shopifyOrderId, TAG_PENDING);

  const tagSet = new Set(
    (order.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
  );

  // ── Shopify-tag dedup ──────────────────────────────────────────────────────

  if (tagSet.has(TAG_SENT)) {
    logger.info(
      { intentId, orderId: shopifyOrderId, attempt, status: "already_sent", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // ── Blocking states ────────────────────────────────────────────────────────

  if (order.cancelled_at) {
    logger.info(
      { intentId, orderId: shopifyOrderId, attempt, status: "cancelled", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  if (order.financial_status === "refunded") {
    logger.info(
      { intentId, orderId: shopifyOrderId, attempt, status: "refunded", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // Partial-refund full-coverage check via line-item quantities.
  // Quantity coverage is more reliable than transaction amounts (taxes, fees, etc.).
  if (order.financial_status === "partially_refunded" && order.refunds.length > 0) {
    const orderedQty = order.line_items.reduce((sum, li) => sum + (li.quantity ?? 0), 0);
    const refundedQty = order.refunds.reduce(
      (sum, r) => sum + (r.refund_line_items ?? []).reduce((s, rli) => s + (rli.quantity ?? 0), 0),
      0,
    );
    if (orderedQty > 0 && refundedQty >= orderedQty) {
      logger.info(
        { intentId, orderId: shopifyOrderId, attempt, orderedQty, refundedQty, status: "partial_refund_full", durationMs: Date.now() - startMs },
        "review-email: outcome",
      );
      return;
    }
  }

  // Disputes check: Shopify Payments API with tag fallback
  await shopifyThrottle();
  const hasDispute = await getShopifyOrderDisputes(shopifyOrderId, tagSet);
  if (hasDispute) {
    logger.info(
      { intentId, orderId: shopifyOrderId, attempt, status: "disputed", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // Chargeback/dispute mention in order note (safety-net for manual flags)
  if (order.note && /chargeback|dispute/i.test(order.note)) {
    logger.info(
      { intentId, orderId: shopifyOrderId, attempt, status: "chargeback_note", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // ── Customer & product ────────────────────────────────────────────────────

  const customerEmail = order.email;
  if (!customerEmail) {
    logger.warn(
      { intentId, orderId: shopifyOrderId, attempt, status: "no_email", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
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
    logger.warn(
      { intentId, orderId: shopifyOrderId, attempt, status: "no_line_items", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // Highest total price; tie-break by array index
  let primary = lineItems[0]!;
  for (const item of lineItems.slice(1)) {
    if (Number(item.price) * item.quantity > Number(primary.price) * primary.quantity) {
      primary = item;
    }
  }

  await shopifyThrottle();
  const productHandle = primary.product_id
    ? await resolveProductHandle(primary.product_id)
    : null;

  if (!productHandle) {
    logger.warn(
      { intentId, orderId: shopifyOrderId, productId: primary.product_id, attempt, status: "no_product_handle", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    return;
  }

  // ── Build & send email ────────────────────────────────────────────────────
  // IMPORTANT: send first, then flip the Shopify tag.
  // If the tag were flipped before send, a failed send would cause retries
  // to silently skip (sent tag already present), producing a missed send.
  // At-least-once is preferable over at-most-once for a review-request email.

  const { html, text } = buildReviewRequestEmail({
    customerName,
    productHandle,
    productTitle: primary.title ?? "",
  });

  try {
    await sendEmail({
      to: customerEmail,
      subject: "Your thoughts mean the world 💕",
      html,
      text,
    });
  } catch (err) {
    if (err instanceof ResendTerminalError) {
      // 4xx from Resend — bad address, blocked, etc.  Do not retry.
      logger.warn(
        { intentId, orderId: shopifyOrderId, customerEmail, attempt, err: String(err), status: "email_terminal", durationMs: Date.now() - startMs },
        "review-email: outcome",
      );
      return;
    }
    // Transient (5xx, network) — let pg-boss retry
    logger.warn(
      { intentId, orderId: shopifyOrderId, attempt, err: String(err), status: "email_transient", durationMs: Date.now() - startMs },
      "review-email: outcome",
    );
    throw err;
  }

  // Phase 3: flip pending → sent (only after a confirmed successful send).
  await shopifyThrottle();
  await replaceShopifyOrderTag(shopifyOrderId, TAG_PENDING, TAG_SENT);
  recordSend(intentId);

  logger.info(
    {
      outcome:       "sent",
      orderId:       shopifyOrderId,
      intentId,
      customerEmail,
      productHandle,
      attempt,
      status:        "success",
      durationMs:    Date.now() - startMs,
    },
    "review-email: outcome",
  );
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
  await boss.work<ReviewEmailJobData>(DLQ_NAME, workDlq);

  logger.info("pg-boss: review-email queue started");
}

export async function enqueueReviewEmail(data: ReviewEmailJobData): Promise<void> {
  if (!boss) {
    const msg = "review-email queue not started — cannot enqueue";
    logger.error(data, msg);
    throw new Error(msg);
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
