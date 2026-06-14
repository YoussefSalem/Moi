import { createHmac } from "crypto";

/**
 * Generate a tamper-proof HMAC token for a specific review link.
 * Used by the quick-rate GET endpoint to validate single-click submissions.
 */
export function generateReviewToken(
  productHandle: string,
  email: string,
  orderId: string
): string {
  const secret = process.env.CRON_SECRET ?? "moi-review-fallback-secret";
  return createHmac("sha256", secret)
    .update(`${productHandle}:${email}:${orderId}`)
    .digest("hex")
    .slice(0, 32);
}
