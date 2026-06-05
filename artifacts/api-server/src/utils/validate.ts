/**
 * Validates required environment variables at startup.
 * Throws if any required key is missing.
 */
export function validateEnv(required: string[]): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

/**
 * Asserts a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
