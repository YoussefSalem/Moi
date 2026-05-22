/**
 * Shopify Analytics — headless storefront event tracking.
 *
 * Sends events to Shopify's analytics endpoint so they appear in
 * Shopify Admin → Analytics → Overview and Reports.
 *
 * Mirrors the structure of metaPixel.ts and tiktokPixel.ts.
 * Safe to call on every event — no-ops silently in dev/staging.
 *
 * Events tracked:
 *   page_viewed        — every page load / in-app navigation
 *   product_viewed     — when a product card enters the viewport
 *   cart_updated       — on every add-to-cart (alongside Meta & TikTok)
 *   checkout_started   — when the user opens the checkout flow
 */

const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined;
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined;

// Shopify headless analytics endpoint (used internally by @shopify/hydrogen-react).
// Only fires on the production domain — dev/staging events are dropped silently.
const ENDPOINT = STORE_DOMAIN
  ? `https://${STORE_DOMAIN}/api/2024-04/analytics`
  : null;

const IS_PRODUCTION =
  typeof window !== "undefined" &&
  (window.location.hostname === "buy-moi.com" ||
    window.location.hostname === "www.buy-moi.com");

interface ShopifyAnalyticsEvent {
  event_name: string;
  payload: Record<string, unknown>;
}

/** Low-level: POST events to Shopify's headless analytics endpoint. Never throws. */
async function publish(events: ShopifyAnalyticsEvent[]): Promise<void> {
  if (!IS_PRODUCTION || !ENDPOINT || !STOREFRONT_TOKEN) return;
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      // keepalive: stays in flight even if user navigates away (e.g. to Shopify checkout)
      keepalive: true,
      body: JSON.stringify({ events }),
    });
  } catch {
    // Analytics failures are always silent — never surface to the user
  }
}

function basePayload(): Record<string, unknown> {
  return {
    url: typeof window !== "undefined" ? window.location.href : "",
    referrer:
      typeof document !== "undefined" && document.referrer
        ? document.referrer
        : undefined,
    timestamp: new Date().toISOString(),
  };
}

/** ── Public API ─────────────────────────────────────────── */

/** Call on every page load and in-app navigation. */
export function trackShopifyPageView(): void {
  void publish([{ event_name: "page_viewed", payload: basePayload() }]);
}

/**
 * Call when a product card enters the viewport.
 * `productId` is the Shopify variant GID (gid://shopify/ProductVariant/…)
 * if available, otherwise the local slug.
 */
export function trackShopifyProductView(params: {
  productId?: string;
  variantId?: string;
  productTitle: string;
  price?: number;
  currencyCode?: string;
}): void {
  void publish([{
    event_name: "product_viewed",
    payload: {
      ...basePayload(),
      product_id: params.productId,
      variant_id: params.variantId,
      title: params.productTitle,
      price: params.price != null ? params.price.toFixed(2) : undefined,
      currency: params.currencyCode ?? "EGP",
    },
  }]);
}

/**
 * Call alongside Meta + TikTok pixels on add-to-cart.
 * All params are optional — pass whatever is available in context.
 */
export function trackShopifyAddToCart(params: {
  cartId?: string;
  productId?: string;
  variantId?: string;
  productTitle: string;
  price?: number;
  quantity?: number;
  currencyCode?: string;
}): void {
  void publish([{
    event_name: "cart_updated",
    payload: {
      ...basePayload(),
      cart_id: params.cartId,
      product_id: params.productId,
      variant_id: params.variantId,
      title: params.productTitle,
      price: params.price != null ? params.price.toFixed(2) : undefined,
      quantity: params.quantity ?? 1,
      currency: params.currencyCode ?? "EGP",
    },
  }]);
}

/**
 * Call when the user opens the checkout flow.
 * Populates line_items from cart state (Shopify or local).
 */
export function trackShopifyCheckoutStarted(params: {
  cartId?: string;
  totalPrice?: number;
  currencyCode?: string;
  lineItems?: Array<{
    productId?: string;
    variantId?: string;
    title: string;
    price?: number;
    quantity: number;
  }>;
}): void {
  void publish([{
    event_name: "checkout_started",
    payload: {
      ...basePayload(),
      cart_id: params.cartId,
      total_price:
        params.totalPrice != null ? params.totalPrice.toFixed(2) : undefined,
      currency: params.currencyCode ?? "EGP",
      line_items: params.lineItems?.map((li) => ({
        product_id: li.productId,
        variant_id: li.variantId,
        title: li.title,
        price: li.price != null ? li.price.toFixed(2) : undefined,
        quantity: li.quantity,
      })),
    },
  }]);
}
