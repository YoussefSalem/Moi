/**
 * Shopify Analytics — Hydrogen-compatible version.
 *
 * In Hydrogen, the primary analytics are wired via useAnalytics() from
 * @shopify/hydrogen. This file provides the Monorail batch publisher for
 * page_view, product_viewed, add_to_cart, and purchase events.
 *
 * Call trackShopifyPageView() in useEffect on route change (useLocation).
 */

import { getAttribution } from "~/lib/adAttribution";

const IS_PRODUCTION =
  typeof window !== "undefined" &&
  (window.location.hostname === "buy-moi.com" ||
    window.location.hostname === "www.buy-moi.com");

const DEBUG_ANALYTICS =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("debug_analytics");

function buildUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getUniqueToken(): string {
  const KEY = "_shopify_y";
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
    if (match) return match[1];
    const token = buildUUID();
    document.cookie = `${KEY}=${token}; path=/; max-age=31536000; SameSite=Lax`;
    return token;
  } catch {
    return buildUUID();
  }
}

function getVisitToken(): string {
  const KEY = "_shopify_s";
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
    if (match) return match[1];
    const token = buildUUID();
    document.cookie = `${KEY}=${token}; path=/; max-age=1800; SameSite=Lax`;
    return token;
  } catch {
    return buildUUID();
  }
}

function captureAndPersistUtm(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    ["source", "medium", "campaign", "term", "content"].forEach((k) => {
      const v = params.get(`utm_${k}`);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem("moi_sa_utm", JSON.stringify(utm));
    }
  } catch { /* ignore */ }
}

function getStoredUtm(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("moi_sa_utm");
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}

const MONORAIL_BATCH = "https://monorail-edge.shopifysvc.com/unstable/produce_batch";
const TREKKIE_SCHEMA = "trekkie_storefront_page_view/1.4";
const CUSTOMER_SCHEMA = "custom_storefront_customer_tracking/1.2";

interface MonorailEvent {
  schema_id: string;
  payload: Record<string, unknown>;
  metadata: { event_created_at_ms: number };
}

interface ShopifyAnalyticsProduct {
  product_gid?: string;
  variant_gid?: string;
  name?: string;
  variantName?: string;
  price: number;
  quantity: number;
}

async function sendToShopify(events: MonorailEvent[]): Promise<void> {
  if (!IS_PRODUCTION && !DEBUG_ANALYTICS) return;
  if (events.length === 0) return;
  try {
    await fetch(MONORAIL_BATCH, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      keepalive: true,
      body: JSON.stringify({ events, metadata: { event_sent_at_ms: Date.now() } }),
    });
  } catch { /* ignore */ }
}

function buildTrekkiePayload(shopId: number): MonorailEvent {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
  const title = typeof document !== "undefined" ? document.title : "";
  const uniqueToken = getUniqueToken();
  const visitToken = getVisitToken();
  const utm = getStoredUtm();
  const attr = getAttribution();

  const payload: Record<string, unknown> = {
    shopId, currency: "EGP", contentLanguage: "en",
    url, path, search, referrer, title,
    uniqToken: uniqueToken, visitToken,
    microSessionId: buildUUID(), microSessionCount: 1,
    isPersistentCookie: true, isMerchantRequest: false,
    appClientId: "12802662", hydrogenSubchannelId: "0",
  };

  if (utm.source) payload.utm_source = utm.source;
  if (utm.medium) payload.utm_medium = utm.medium;
  if (utm.campaign) payload.utm_campaign = utm.campaign;
  if (attr.fbclid) payload.fbclid = attr.fbclid;
  if (attr.gclid) payload.gclid = attr.gclid;
  if (attr.ttclid) payload.ttclid = attr.ttclid;

  return { schema_id: TREKKIE_SCHEMA, metadata: { event_created_at_ms: Date.now() }, payload };
}

function buildCustomerPayload(
  eventName: string,
  shopId: number,
  products?: ShopifyAnalyticsProduct[],
  totalValue?: number,
): MonorailEvent {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
  const utm = getStoredUtm();
  const attr = getAttribution();

  const payload: Record<string, unknown> = {
    event_name: eventName,
    source: "headless", asset_version_id: "1.0.0",
    hydrogenSubchannelId: "0", is_persistent_cookie: true,
    deprecated_visit_token: getVisitToken(), unique_token: getUniqueToken(),
    event_time: Date.now(), event_id: buildUUID(), event_source_url: url,
    referrer, user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    navigation_type: "navigate", navigation_api: "PerformanceNavigationTiming",
    shop_id: shopId, currency: "EGP",
    ccpa_enforced: false, gdpr_enforced: false,
    analytics_allowed: true, marketing_allowed: true, sale_of_data_allowed: true,
  };

  if (utm.source) payload.utm_source = utm.source;
  if (utm.medium) payload.utm_medium = utm.medium;
  if (utm.campaign) payload.utm_campaign = utm.campaign;
  if (attr.fbclid) payload.fbclid = attr.fbclid;
  if (attr.gclid) payload.gclid = attr.gclid;
  if (attr.ttclid) payload.ttclid = attr.ttclid;
  if (products?.length) payload.products = products.map((p) => JSON.stringify(p));
  if (totalValue != null) payload.total_value = totalValue;

  return { schema_id: CUSTOMER_SCHEMA, metadata: { event_created_at_ms: Date.now() }, payload };
}

/** Hydrogen: get shop ID from the ENV injected by root loader */
function getShopId(): number {
  if (typeof window === "undefined") return 0;
  const env = (window as unknown as { ENV?: { PUBLIC_STOREFRONT_ID?: string } }).ENV;
  const id = env?.PUBLIC_STOREFRONT_ID ?? "";
  const match = id.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function trackShopifyPageView(): void {
  captureAndPersistUtm();
  const shopId = getShopId();
  void sendToShopify([buildTrekkiePayload(shopId), buildCustomerPayload("page_rendered", shopId)]);
}

export function trackShopifyProductView(params: {
  productId?: string; variantId?: string; productTitle: string; price?: number;
}): void {
  const shopId = getShopId();
  const products: ShopifyAnalyticsProduct[] = [{
    product_gid: params.productId ?? "", variant_gid: params.variantId ?? "",
    name: params.productTitle, price: params.price ?? 0, quantity: 1,
  }];
  void sendToShopify([buildCustomerPayload("product_page_rendered", shopId, products)]);
}

export function trackShopifyAddToCart(params: {
  variantId?: string; productTitle?: string; price?: number; quantity: number;
}): void {
  const shopId = getShopId();
  const products: ShopifyAnalyticsProduct[] = [{
    product_gid: params.variantId ?? "", variant_gid: params.variantId ?? "",
    name: params.productTitle ?? "", price: params.price ?? 0, quantity: params.quantity,
  }];
  void sendToShopify([buildCustomerPayload("product_added_to_cart", shopId, products)]);
}

export function trackShopifyPurchase(params: {
  orderId?: string; totalPrice?: number;
  lineItems?: { variantId: string; quantity: number; name?: string; price?: number }[];
}): void {
  const shopId = getShopId();
  const products: ShopifyAnalyticsProduct[] = (params.lineItems ?? []).map((p) => ({
    product_gid: p.variantId, variant_gid: p.variantId,
    name: p.name ?? "", price: p.price ?? 0, quantity: p.quantity,
  }));
  void sendToShopify([buildCustomerPayload("payment_info_entered", shopId, products, params.totalPrice)]);
}
