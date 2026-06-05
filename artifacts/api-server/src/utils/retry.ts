import { logger } from "../lib/logger";

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: boolean;
  label?: string;
}

/**
 * Retries an async operation with optional exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, delayMs = 500, backoff = true, label = "operation" } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const wait = backoff ? delayMs * 2 ** (attempt - 1) : delayMs;
        logger.warn(
          { label, attempt, attempts, waitMs: wait, err },
          `${label}: attempt ${attempt} failed — retrying in ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  logger.error({ label, attempts }, `${label}: all ${attempts} attempts failed`);
  throw lastError;
}
