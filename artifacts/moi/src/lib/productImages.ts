/**
 * Shared utilities for resolving product images from Shopify cart lines
 * and local cart items. Used by CartDrawer and CheckoutPage to avoid
 * duplication and ensure consistent image resolution logic.
 */
import { IMAGES } from "@/config/images";
import type { ShopifyCartLine } from "@/lib/shopify";

// Size-like option names to skip when scanning for the color option
const SIZE_OPTION_NAMES = new Set(["size", "titre", "taille", "tamanho", "größe"]);

// Product-scoped color map: "productname::color" → image URL
// This prevents color collisions across products (e.g. "Beige" exists in multiple products).
export const PRODUCT_COLOR_MAP: Record<string, string> = {};
export const PRODUCT_SHOT_MAP: Record<string, string> = {};

for (const cfg of Object.values(IMAGES)) {
  if (!("name" in cfg) || !cfg.name) continue;
  const rawNames = [cfg.name, ...("shopifyTitle" in cfg && cfg.shopifyTitle ? [cfg.shopifyTitle as string] : [])];
  const names = rawNames.flatMap((n) => [n.toLowerCase(), n.toLowerCase().replace(/\./g, "").trim()]);
  if ("productShot" in cfg && cfg.productShot) {
    for (const n of names) PRODUCT_SHOT_MAP[n] = cfg.productShot;
  }
  if ("colorImages" in cfg && cfg.colorImages) {
    for (const [color, url] of Object.entries(cfg.colorImages as Record<string, string>)) {
      for (const n of names) {
        PRODUCT_COLOR_MAP[`${n}::${color.toLowerCase()}`] = url;
      }
    }
  }
}

export function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\./g, "").trim();
}

type LocalItemRef = { variantId: string; color?: string; image?: string | null };

/**
 * Resolve the best available image for a Shopify cart line.
 * Priority: color map → product shot → Shopify CDN → local cache.
 */
export function resolveLineImage(
  line: ShopifyCartLine,
  localItems?: LocalItemRef[],
): string | null {
  const variantId = line.merchandise.id;
  const localMatch = localItems?.find((li) => li.variantId === variantId);

  const rawTitle = line.merchandise.product.title ?? "";
  const normTitle = normalizeTitle(rawTitle);

  const colorCandidates: string[] = [];
  if (localMatch?.color) colorCandidates.push(localMatch.color.toLowerCase());
  for (const opt of (line.merchandise.selectedOptions ?? [])) {
    if (!SIZE_OPTION_NAMES.has(opt.name.toLowerCase())) {
      colorCandidates.push(opt.value.toLowerCase());
    }
  }

  // 1. Product + color map lookup (hashed bundle URL, always fresh)
  for (const color of colorCandidates) {
    const hit = PRODUCT_COLOR_MAP[`${normTitle}::${color}`]
      ?? PRODUCT_COLOR_MAP[`${rawTitle.toLowerCase()}::${color}`];
    if (hit) return hit;
  }

  // 2. Product-level shot
  const productHit = PRODUCT_SHOT_MAP[normTitle] ?? PRODUCT_SHOT_MAP[rawTitle.toLowerCase()];
  if (productHit) return productHit;

  // 3. Shopify CDN image (set on the variant in Shopify admin)
  if (line.merchandise.image?.url) return line.merchandise.image.url;
  if (line.merchandise.product.featuredImage?.url) return line.merchandise.product.featuredImage.url;

  // 4. Last resort: the stored localStorage URL (may be stale after a rebuild)
  if (localMatch?.image) return localMatch.image;

  return null;
}
