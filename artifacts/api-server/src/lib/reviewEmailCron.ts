import { db, reviewEmailQueue } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { fetchDeliveredOrders } from "./shopifyDelivered.js";
import { buildReviewEmail } from "./reviewEmail.js";
import { sendEmail } from "./email.js";
import { logger } from "./logger.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface CronResult {
  scanned: number;
  sent: number;
  skippedTooSoon: number;
  skippedAlreadySent: number;
  errors: number;
}

export async function runReviewEmailCron(): Promise<CronResult> {
  logger.info("reviewEmailCron: starting run");

  const result: CronResult = {
    scanned: 0,
    sent: 0,
    skippedTooSoon: 0,
    skippedAlreadySent: 0,
    errors: 0,
  };

  let delivered;
  try {
    delivered = await fetchDeliveredOrders();
  } catch (err) {
    logger.error({ err }, "reviewEmailCron: failed to fetch delivered orders");
    return result;
  }

  result.scanned = delivered.length;
  const now = new Date();

  for (const order of delivered) {
    const msSinceDelivery = now.getTime() - order.deliveredAt.getTime();

    if (msSinceDelivery < TWENTY_FOUR_HOURS_MS) {
      result.skippedTooSoon++;
      continue;
    }

    const existing = await db
      .select()
      .from(reviewEmailQueue)
      .where(eq(reviewEmailQueue.shopifyOrderId, order.shopifyOrderId))
      .limit(1);

    if (existing.length > 0 && existing[0].emailSent) {
      result.skippedAlreadySent++;
      continue;
    }

    if (existing.length === 0) {
      try {
        await db.insert(reviewEmailQueue).values({
          shopifyOrderId: order.shopifyOrderId,
          shopifyOrderNumber: order.shopifyOrderNumber,
          customerEmail: order.customerEmail,
          customerName: order.customerName || null,
          deliveredAt: order.deliveredAt,
          products: order.products,
          emailSent: false,
        });
      } catch (err) {
        logger.error(
          { err, orderId: order.shopifyOrderId },
          "reviewEmailCron: failed to insert queue record"
        );
        result.errors++;
        continue;
      }
    }

    try {
      const orderId = String(order.shopifyOrderNumber ?? order.shopifyOrderId);
      const { html, ampHtml, text, subject } = buildReviewEmail({
        customerName: order.customerName,
        orderId,
        customerEmail: order.customerEmail,
        customerId: order.customerId,
        products: order.products,
      });

      await sendEmail({
        to: order.customerEmail,
        subject,
        html,
        amp: ampHtml,
        text,
      });

      await db
        .update(reviewEmailQueue)
        .set({ emailSent: true, emailSentAt: new Date() })
        .where(eq(reviewEmailQueue.shopifyOrderId, order.shopifyOrderId));

      logger.info(
        { orderId: order.shopifyOrderId, orderNumber: order.shopifyOrderNumber, to: order.customerEmail },
        "reviewEmailCron: review email sent"
      );
      result.sent++;
    } catch (err) {
      logger.error(
        { err, orderId: order.shopifyOrderId },
        "reviewEmailCron: failed to send review email"
      );
      result.errors++;
    }
  }

  logger.info(result, "reviewEmailCron: run complete");
  return result;
}

let _cronStarted = false;

export function startReviewEmailCron(): void {
  if (_cronStarted) return;
  _cronStarted = true;

  logger.info("reviewEmailCron: scheduling hourly cron");

  // First run: 90 seconds after startup (let the server stabilize)
  setTimeout(() => {
    runReviewEmailCron().catch((err) =>
      logger.error({ err }, "reviewEmailCron: initial run failed")
    );
  }, 90_000);

  // Subsequent runs: every hour
  setInterval(() => {
    runReviewEmailCron().catch((err) =>
      logger.error({ err }, "reviewEmailCron: scheduled run failed")
    );
  }, 60 * 60 * 1000);
}
