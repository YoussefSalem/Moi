const stockCache: Record<string, number> = {};

export function getStockCount(productSlug: string, color: string): number {
  const key = `${productSlug}:${color}`;
  return stockCache[key] ?? -1;
}

export function setStockCount(productSlug: string, color: string, count: number): void {
  const key = `${productSlug}:${color}`;
  stockCache[key] = count;
}
