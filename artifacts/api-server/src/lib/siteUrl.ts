/**
 * Returns the canonical public URL for the current environment.
 *
 * Priority:
 *  1. SITE_URL env var (explicit override, useful for local testing)
 *  2. REPLIT_DOMAINS — picks buy-moi.com if present (production),
 *     otherwise the first listed domain (dev replit preview URL)
 *  3. Hard-coded fallback of https://buy-moi.com
 */
export function getSiteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;

  const domains = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  const prod = domains.find((d) => d === "buy-moi.com" || d === "www.buy-moi.com");
  const domain = prod ?? domains[0];
  return domain ? `https://${domain}` : "https://buy-moi.com";
}
