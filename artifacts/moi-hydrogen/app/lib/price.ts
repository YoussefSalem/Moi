/**
 * EGP price parsing utility.
 * Extracted from @workspace/utils — duplicated here since Hydrogen
 * is a standalone project outside the monorepo.
 */

/**
 * Parse a price string like "1,690 EGP" or "1690.00" into a plain number.
 * Returns 0 for any unparseable input.
 */
export function parseEGP(price: string | number | undefined | null): number {
  if (price == null) return 0;
  if (typeof price === "number") return Number.isFinite(price) ? price : 0;
  const cleaned = price.replace(/[^\d.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Format a number as an EGP price string: "1,690 EGP"
 */
export function formatEGP(amount: number): string {
  return `${amount.toLocaleString("en-EG")} EGP`;
}

/**
 * Format a Storefront API MoneyV2 object as a display string.
 * e.g. { amount: "1690.00", currencyCode: "EGP" } → "1,690 EGP"
 */
export function formatMoney(money: { amount: string; currencyCode: string } | null | undefined): string {
  if (!money) return "";
  const amount = parseFloat(money.amount);
  if (!Number.isFinite(amount)) return "";
  return `${Math.round(amount).toLocaleString("en-EG")} ${money.currencyCode}`;
}
