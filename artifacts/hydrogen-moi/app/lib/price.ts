/**
 * Price utilities — mirrors the existing Moi price.ts
 */

/**
 * Parse a price string like "1,399 EGP" or "1399.00" → number
 */
export function parseEGP(priceStr: string | undefined | null): number {
  if (!priceStr) return 0;
  // Remove everything except digits and decimal points
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isFinite(parsed) ? parsed : 0;
}

/**
 * Format a number as EGP price string.
 */
export function formatEGP(amount: number): string {
  if (!isFinite(amount)) return '0 EGP';
  return `${amount.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP`;
}

/**
 * Format a Shopify price object ({ amount, currencyCode }) for display.
 */
export function formatShopifyPrice(
  price: { amount: string; currencyCode: string } | null | undefined,
): string {
  if (!price) return '';
  const num = parseFloat(price.amount);
  if (!isFinite(num)) return '';

  if (price.currencyCode === 'EGP') {
    return `${Math.round(num).toLocaleString('en-EG')} EGP`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}
