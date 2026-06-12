import { normalizeTitle } from "@/lib/productImages";
import { getAttribution } from "@/lib/adAttribution";
import type { ShopifyCart, ShopifyCartLine } from "@/lib/shopify";
import type { CapiContent } from "@/lib/metaPixel";

export const SHIPPING_EGP = 50;

export interface MetaLineData {
  contentIds: string[];
  contents: CapiContent[];
  numItems: number;
}

/**
 * Build Meta Pixel / CAPI line data (content_ids, contents with item_price, and
 * total quantity) from whichever cart source is active. Used by every Purchase
 * fire so the Meta payload matches the actual order. Best-effort: returns empty
 * arrays when no cart is available (the Purchase still carries value + order_id).
 */
export function buildMetaLineData(
  isShopify: boolean,
  shopifyCart: ShopifyCart | null,
  localItems: { variantId: string; quantity: number; priceAmount?: number }[],
): MetaLineData {
  if (isShopify && shopifyCart && shopifyCart.lines.nodes.length > 0) {
    const nodes = shopifyCart.lines.nodes;
    return {
      contentIds: nodes.map((l) => l.merchandise.id),
      contents: nodes.map((l) => {
        const price = parseFloat(l.merchandise.price.amount);
        return {
          id: l.merchandise.id,
          quantity: l.quantity,
          ...(Number.isFinite(price) && price > 0 ? { item_price: price } : {}),
        };
      }),
      numItems: nodes.reduce((s, l) => s + l.quantity, 0),
    };
  }
  return {
    contentIds: localItems.map((i) => i.variantId),
    contents: localItems.map((i) => ({
      id: i.variantId,
      quantity: i.quantity,
      ...(typeof i.priceAmount === "number" && i.priceAmount > 0 ? { item_price: i.priceAmount } : {}),
    })),
    numItems: localItems.reduce((s, i) => s + i.quantity, 0),
  };
}

// Public image URLs for emails (Vite-hashed /assets/ paths only work in the browser)
// Images served via the API server (/api/images/) so they are always available
// regardless of whether the web-app deployment is up to date.
const BASE_IMG = `${typeof window !== "undefined" ? window.location.origin : "https://buy-moi.com"}/api/images`;
export const PUBLIC_COLOR_IMAGES: Record<string, string> = {
  // Moi Versa Top colors
  white:        `${BASE_IMG}/versa-white-main.jpg`,
  cashmere:     `${BASE_IMG}/versa-cashmere-main.jpg`,
  beige:        `${BASE_IMG}/versa-beige-main.jpg`,
  yellow:       `${BASE_IMG}/versa-yellow-main.jpg`,
  teal:         `${BASE_IMG}/versa-teal-main.jpg`,
  // Moi Wavvy colors
  "light blue": `${BASE_IMG}/light-blue-main.jpg`,
  navy:         `${BASE_IMG}/navi.jpg`,
  mint:         `${BASE_IMG}/mint.jpg`,
  sand:         `${BASE_IMG}/sand-main.jpg`,
};

/** Convert any internal image URL to a public URL that works in emails. */
export function resolveEmailImage(
  line: ShopifyCartLine,
  localItems?: { variantId: string; color?: string; image?: string | null }[],
): string | null {
  // 1. Static color map → /api/images/ URLs served by the API server (preferred)
  const variantId = line.merchandise.id;
  const localMatch = localItems?.find((li) => li.variantId === variantId);

  const SIZE_OPTION_NAMES = new Set(["size", "titre", "taille", "tamanho", "gr\u00f6\u00dfe"]);
  const colorCandidates: string[] = [];
  if (localMatch?.color) colorCandidates.push(localMatch.color.toLowerCase());
  for (const opt of (line.merchandise.selectedOptions ?? [])) {
    if (!SIZE_OPTION_NAMES.has(opt.name.toLowerCase())) {
      colorCandidates.push(opt.value.toLowerCase());
    }
  }
  for (const color of colorCandidates) {
    const publicHit = PUBLIC_COLOR_IMAGES[color];
    if (publicHit) return publicHit;
  }

  // 2. Shopify CDN URL — fallback if no local image exists for this color
  const shopifyUrl = line.merchandise.image?.url ?? line.merchandise.product.featuredImage?.url ?? "";
  if (shopifyUrl && shopifyUrl.includes("cdn.shopify.com")) {
    return shopifyUrl;
  }

  // 3. Local match image if it's an absolute URL
  if (localMatch?.image && localMatch.image.startsWith("http")) return localMatch.image;

  return null;
}

/** Build marketing attribution payload from sessionStorage for order creation */
export function buildOrderAttribution() {
  const attr = getAttribution();
  const utm = attr.utm || {};
  let sourceName: string | undefined;
  if (utm.source === "facebook" || utm.source === "fb" || attr.fbclid) sourceName = "facebook";
  else if (utm.source === "instagram" || utm.source === "ig") sourceName = "instagram";
  else if (utm.source === "google" || attr.gclid) sourceName = "google";
  else if (utm.source === "tiktok" || attr.ttclid) sourceName = "tiktok";
  else if (utm.source) sourceName = utm.source;

  const REF_MAP: Record<string, string> = {
    facebook: "https://www.facebook.com/",
    instagram: "https://www.instagram.com/",
    google: "https://www.google.com/",
    tiktok: "https://www.tiktok.com/",
  };
  const referringSite = document.referrer || (sourceName ? REF_MAP[sourceName] : undefined);

  return {
    ...(sourceName ? { sourceName } : {}),
    ...(attr.firstLandingUrl ? { landingSite: attr.firstLandingUrl } : {}),
    ...(referringSite ? { referringSite } : {}),
    ...(Object.keys(utm).length > 0 ? { utm } : {}),
    ...(attr.fbclid ? { fbclid: attr.fbclid } : {}),
    ...(attr.gclid ? { gclid: attr.gclid } : {}),
    ...(attr.ttclid ? { ttclid: attr.ttclid } : {}),
  };
}
