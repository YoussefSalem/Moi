/**
 * Stock count utility.
 * Returns a display number for "only N left" badges.
 * These are soft numbers — real inventory comes from Shopify's quantityAvailable.
 */

const STOCK_SEED: Record<string, Record<string, number>> = {
  moi: {
    'Light Blue': 3,
    'Navy': 7,
    'Mint': 5,
    'White': 6,
    'Cashmere': 4,
    'Beige': 8,
    'Yellow': 4,
    'Teal': 5,
  },
};

/**
 * Get a persistent soft stock count for a given product slug + color.
 * Uses sessionStorage so it stays stable within a session but resets on new visits.
 */
export function getStockCount(productSlug: string, colorName: string): number {
  if (typeof window === 'undefined') return 5;

  const key = `moi_stock_${productSlug}_${colorName}`;
  const cached = sessionStorage.getItem(key);
  if (cached) return parseInt(cached, 10);

  const base = STOCK_SEED[productSlug]?.[colorName] ?? 6;
  // Add slight variation based on color name hash for determinism
  const hash = colorName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = Math.max(2, Math.min(9, base + (hash % 3) - 1));

  sessionStorage.setItem(key, String(count));
  return count;
}
