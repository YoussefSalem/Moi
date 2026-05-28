/**
 * Persistent per-user stock numbers for urgency indicators.
 * Each product+color gets a deterministic "random" stock count (3–8)
 * that stays the same across sessions for the same user.
 */

function getUserStockSeed(): string {
  if (typeof window === "undefined") return "0";
  const key = "moi_stock_seed_v2";
  let seed = localStorage.getItem(key);
  if (!seed) {
    seed = Math.random().toString(36).slice(2, 12);
    localStorage.setItem(key, seed);
  }
  return seed;
}

function hashKey(seed: string, productSlug: string, colorName: string): number {
  const raw = `${seed}::${productSlug}::${colorName}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Get a persistent stock count (3–8) for a product color. */
export function getStockCount(productSlug: string, colorName: string): number {
  const seed = getUserStockSeed();
  const h = hashKey(seed, productSlug, colorName);
  return 3 + (h % 6); // 3–8
}

/** Check if a stock count should trigger the "Selling Fast" urgency style.
 *  Returns true for counts 3–5 (lower stock = more urgent).
 */
export function isSellingFast(productSlug: string, colorName: string): boolean {
  return getStockCount(productSlug, colorName) <= 5;
}
