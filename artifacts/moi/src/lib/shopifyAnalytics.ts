/**
 * Shopify Analytics -- official Hydrogen-compatible headless tracking.
 *
 * Uses Shopify's actual monorail endpoint and payload format from
 * @shopify/hydrogen-react/src/analytics.ts
 *
 * Endpoint: https://monorail-edge.shopifysvc.com/unstable/produce_batch
 * Content-Type: text/plain
 * Schema IDs: trekkie_storefront_page_view/1.4 + custom_storefront_customer_tracking/1.2
 */

import { getAttribution } from "./adAttribution";
import { logAnalyticsDebug } from "@/components/AnalyticsDebug";

const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined;
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined;

/** Only fire on the production domain */
const IS_PRODUCTION =
  typeof window !== "undefined" &&
  (window.location.hostname === "buy-moi.com" ||
    window.location.hostname === "www.buy-moi.com");

/** Temporarily allow firing in dev for testing */
const DEBUG_ANALYTICS =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("debug_analytics");

// --- Debug logger ---
function log(...args: unknown[]): void {
  if (DEBUG_ANALYTICS) {
    // Intentionally using console in debug mode only
    // eslint-disable-next-line no-console
    console.log("[ShopifyAnalytics]", ...args);
  }
}
function logError(...args: unknown[]): void {
  // Intentionally using console for critical analytics errors
  // eslint-disable-next-line no-console
  console.error("[ShopifyAnalytics]", ...args);
}

// --- Token generation ---
function buildUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Unique user token -- persists in cookie (like _shopify_y) */
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

/** Visit/session token -- like _shopify_s */
function getVisitToken(): string {
  const KEY = "_shopify_s";
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
    if (match) return match[1];
    const token = buildUUID();
    document.cookie = `${KEY}=${token}; path=/; max-age=1800; SameSite=Lax`; // 30 min
    return token;
  } catch {
    return buildUUID();
  }
}

// --- Shop ID ---
let _shopIdPromise: Promise<string | null> | null = null;

const STOREFRONT_ENDPOINT = STORE_DOMAIN
  ? `https://${STORE_DOMAIN}/api/2024-04/graphql.json`
  : null;

function fetchShopId(): Promise<string | null> {
  if (_shopIdPromise) return _shopIdPromise;
  if (!STOREFRONT_ENDPOINT || !STOREFRONT_TOKEN) {
    logError("Missing STORE_DOMAIN or STOREFRONT_TOKEN");
    logAnalyticsDebug("Missing STORE_DOMAIN or TOKEN", "error");
    return (_shopIdPromise = Promise.resolve(null));
  }
  _shopIdPromise = fetch(STOREFRONT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query: "{ shop { id } }" }),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ data?: { shop?: { id?: string } }; errors?: unknown[] }>;
    })
    .then((json) => {
      if (json.errors) {
        logError("shopId GraphQL errors:", json.errors);
        logAnalyticsDebug(`shopId GraphQL error: ${JSON.stringify(json.errors).slice(0, 80)}`, "error");
      }
      const id = json?.data?.shop?.id ?? null;
      log("shopId resolved:", id);
      if (id) logAnalyticsDebug(`shopId OK: ${id}`, "success");
      return id;
    })
    .catch((err) => {
      logError("shopId fetch exception:", err);
      logAnalyticsDebug(`shopId fetch error: ${String(err).slice(0, 80)}`, "error");
      return null;
    });
  return _shopIdPromise;
}

/** Parse numeric shop ID from GID */
function parseShopId(gid: string | null): number {
  if (!gid) return 0;
  const match = gid.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// --- UTM persistence ---
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

// --- Monorail payload builders ---

const TREKKIE_SCHEMA = "trekkie_storefront_page_view/1.4";
const CUSTOMER_SCHEMA = "custom_storefront_customer_tracking/1.2";

interface MonorailEvent {
  schema_id: string;
  payload: Record<string, unknown>;
  metadata: {
    event_created_at_ms: number;
  };
}

function nowMs(): number { return Date.now(); }

/** Build the trekkie page_view payload (Shopify's primary session counter) */
async function buildTrekkiePayload(): Promise<MonorailEvent> {
  const shopIdGid = await fetchShopId();
  const shopId = parseShopId(shopIdGid);
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
    shopId,
    currency: "EGP",
    contentLanguage: "en",
    url,
    path,
    search,
    referrer,
    title,
    uniqToken: uniqueToken,
    visitToken,
    microSessionId: buildUUID(),
    microSessionCount: 1,
    isPersistentCookie: true,
    isMerchantRequest: false,
    appClientId: "12802662",
    hydrogenSubchannelId: "0",
  };

  // UTM / ad attribution
  if (utm.source) payload.utm_source = utm.source;
  if (utm.medium) payload.utm_medium = utm.medium;
  if (utm.campaign) payload.utm_campaign = utm.campaign;
  if (utm.term) payload.utm_term = utm.term;
  if (utm.content) payload.utm_content = utm.content;
  if (attr.fbclid) payload.fbclid = attr.fbclid;
  if (attr.gclid) payload.gclid = attr.gclid;
  if (attr.ttclid) payload.ttclid = attr.ttclid;

  return {
    schema_id: TREKKIE_SCHEMA,
    metadata: { event_created_at_ms: nowMs() },
    payload,
  };
}

/** Build the customer tracking payload (Shopify's event detail schema) */
interface ShopifyAnalyticsProduct {
  product_gid?: string;
  variant_gid?: string;
  name?: string;
  variantName?: string;
  price: number;
  quantity: number;
  brand?: string;
  category?: string;
  sku?: string;
}

/** Format products for customer tracking schema -- returns JSON strings */
function formatProductPayload(products?: ShopifyAnalyticsProduct[]): string[] {
  if (!products) return [];
  return products.map((p) => {
    const product: Record<string, unknown> = {
      product_gid: p.product_gid || "",
      variant_gid: p.variant_gid || "",
      name: p.name || "",
      variant: p.variantName || "",
      brand: p.brand || "",
      price: typeof p.price === "number" ? p.price : parseFloat(p.price as unknown as string) || 0,
      quantity: Number(p.quantity || 0),
    };
    if (p.category) product.category = p.category;
    if (p.sku) product.sku = p.sku;
    return JSON.stringify(product);
  });
}

async function buildCustomerPayload(eventName: string, products?: ShopifyAnalyticsProduct[], totalValue?: number): Promise<MonorailEvent> {
  const shopIdGid = await fetchShopId();
  const shopId = parseShopId(shopIdGid);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
  const title = typeof document !== "undefined" ? document.title : "";
  const uniqueToken = getUniqueToken();
  const visitToken = getVisitToken();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const utm = getStoredUtm();
  const attr = getAttribution();

  const payload: Record<string, unknown> = {
    event_name: eventName,
    source: "headless",
    asset_version_id: "1.0.0",
    hydrogenSubchannelId: "0",
    is_persistent_cookie: true,
    deprecated_visit_token: visitToken,
    unique_token: uniqueToken,
    event_time: Date.now(),
    event_id: buildUUID(),
    event_source_url: url,
    referrer,
    user_agent: userAgent,
    navigation_type: "navigate",
    navigation_api: "PerformanceNavigationTiming",
    shop_id: shopId,
    currency: "EGP",
    ccpa_enforced: false,
    gdpr_enforced: false,
    gdpr_enforced_as_string: "false",
    analytics_allowed: true,
    marketing_allowed: true,
    sale_of_data_allowed: true,
  };

  // UTM / ad attribution -- critical for social referrer reporting
  if (utm.source) payload.utm_source = utm.source;
  if (utm.medium) payload.utm_medium = utm.medium;
  if (utm.campaign) payload.utm_campaign = utm.campaign;
  if (utm.term) payload.utm_term = utm.term;
  if (utm.content) payload.utm_content = utm.content;
  if (attr.fbclid) payload.fbclid = attr.fbclid;
  if (attr.gclid) payload.gclid = attr.gclid;
  if (attr.ttclid) payload.ttclid = attr.ttclid;

  const formattedProducts = formatProductPayload(products);
  if (formattedProducts.length > 0) payload.products = formattedProducts;
  if (totalValue != null) payload.total_value = totalValue;

  return {
    schema_id: CUSTOMER_SCHEMA,
    metadata: { event_created_at_ms: nowMs() },
    payload,
  };
}

// --- Low-level publisher ---
// Following Hydrogen's sendToShopify exactly

interface MonorailResponse {
  status: number;
  message: string;
}

const MONORAIL_BATCH = "https://monorail-edge.shopifysvc.com/unstable/produce_batch";

async function sendToShopify(events: MonorailEvent[]): Promise<void> {
  if ((!IS_PRODUCTION && !DEBUG_ANALYTICS)) {
    log("blocked -- not production or debug mode");
    return;
  }

  if (events.length === 0) return;

  const body = {
    events,
    metadata: {
      event_sent_at_ms: Date.now(),
    },
  };

  log("sending", body);
  logAnalyticsDebug(`sending ${events.length} event(s)`, "info");

  try {
    const res = await fetch(MONORAIL_BATCH, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      keepalive: true,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      logError("HTTP error:", res.status, text);
      logAnalyticsDebug(`HTTP ${res.status}: ${text.slice(0, 60)}`, "error");
      return;
    }

    const data = await res.text();
    if (data) {
      try {
        const json = JSON.parse(data) as { result?: MonorailResponse[] };
        json.result?.forEach((eventResponse) => {
          if (eventResponse.status !== 200) {
            logError("Event failed:", eventResponse.message);
            logAnalyticsDebug(`Event failed: ${eventResponse.message.slice(0, 60)}`, "error");
          } else {
            log("Event success:", eventResponse.status);
          }
        });
        logAnalyticsDebug(`Batch sent: ${json.result?.length || 0} events`, "success");
      } catch {
        log("HTTP 200 OK");
        logAnalyticsDebug("HTTP 200 OK", "success");
      }
    } else {
      log("HTTP 200 OK (empty body)");
      logAnalyticsDebug("HTTP 200 OK", "success");
    }
  } catch (err) {
    logError("fetch exception:", err);
    logAnalyticsDebug(`fetch error: ${String(err).slice(0, 60)}`, "error");
  }
}

// --- Public API ---

/** Fire on every page load */
export function trackShopifyPageView(): void {
  captureAndPersistUtm();
  void (async () => {
    const trekkie = await buildTrekkiePayload();
    const customer = await buildCustomerPayload("page_rendered");
    return sendToShopify([trekkie, customer]);
  })();
}

/** Fire when a product card enters the viewport */
export function trackShopifyProductView(params: {
  productId?: string;
  variantId?: string;
  productTitle: string;
  price?: number;
  currencyCode?: string;
}): void {
  void (async () => {
    const products: ShopifyAnalyticsProduct[] = [{
      product_gid: params.productId || params.variantId || "",
      variant_gid: params.variantId || "",
      name: params.productTitle,
      price: params.price ?? 0,
      quantity: 1,
    }];
    const customer = await buildCustomerPayload("product_page_rendered", products);
    return sendToShopify([customer]);
  })();
}

/** Fire when the cart drawer opens */
export function trackShopifyCartViewed(params?: {
  cartId?: string;
  totalPrice?: number;
  totalValue?: number;
  currencyCode?: string;
}): void {
  void (async () => {
    const customer = await buildCustomerPayload("cart_viewed");
    return sendToShopify([customer]);
  })();
}

/** Fire when an item is added to the cart */
export function trackShopifyAddToCart(params: {
  variantId?: string;
  productTitle?: string;
  price?: number;
  quantity: number;
  currencyCode?: string;
}): void {
  void (async () => {
    const products: ShopifyAnalyticsProduct[] = [{
      product_gid: params.variantId || "",
      variant_gid: params.variantId || "",
      name: params.productTitle || "",
      price: params.price ?? 0,
      quantity: params.quantity,
    }];
    const customer = await buildCustomerPayload("product_added_to_cart", products);
    return sendToShopify([customer]);
  })();
}

/** Fire when checkout begins */
export function trackShopifyCheckoutStarted(params: {
  cartId?: string;
  totalPrice?: number;
  totalValue?: number;
  currencyCode?: string;
  lineItems?: { variantId: string; quantity: number; name?: string; price?: number }[];
}): void {
  void (async () => {
    const customer = await buildCustomerPayload("checkout_started");
    return sendToShopify([customer]);
  })();
}

/** Fire when a purchase is completed */
export function trackShopifyPurchase(params: {
  orderId?: string;
  orderNumber?: string | number;
  totalPrice?: number;
  totalValue?: number;
  currencyCode?: string;
  lineItems?: { variantId: string; quantity: number; name?: string; price?: number }[];
}): void {
  void (async () => {
    const totalValue = params.totalPrice ?? params.totalValue ?? 0;
    const products: ShopifyAnalyticsProduct[] = (params.lineItems || []).map((p) => ({
      product_gid: p.variantId,
      variant_gid: p.variantId,
      name: p.name || "",
      price: p.price ?? 0,
      quantity: p.quantity,
    }));
    const customer = await buildCustomerPayload("payment_info_entered", products, totalValue);
    return sendToShopify([customer]);
  })();
}
