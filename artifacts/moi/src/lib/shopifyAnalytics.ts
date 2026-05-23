/**
 * Shopify Analytics — headless storefront event tracking.
 *
 * Connects buy-moi.com visitor behaviour to Shopify Analytics dashboard:
 *   Admin → Analytics → Overview / Reports
 *
 * What flows into each Shopify report:
 *   page_viewed      → "Online store sessions", "Top landing pages"
 *   product_viewed   → "Top products by views"
 *   add_to_cart      → cart funnel metrics
 *   cart_viewed      → cart funnel metrics
 *   checkout_started → "Online store conversion rate" funnel
 *   purchase         → "Online store conversion rate", "Total sales from headless"
 *
 * Implementation notes:
 *   - Fetches the shop's Shopify GID once (lazy, cached in memory) via the
 *     Storefront API `{ shop { id } }` query.  The GID is required by Shopify's
 *     analytics backend to attribute events to the correct store.
 *   - Generates a session token (sessionStorage) so Shopify counts unique sessions.
 *   - Captures UTM parameters on every page view and persists them for the session,
 *     enabling "Sessions by traffic source" in Shopify Analytics.
 *   - Uses keepalive:true so in-flight requests survive navigation / page unload.
 *   - Silent no-op outside buy-moi.com — dev / staging traffic is never sent.
 *   - In dev, append `?debug_analytics=1` to see every request in the console.
 */

const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined;
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined;
const API_VERSION = "2024-04";

/** POST analytics events to Shopify's headless analytics endpoint */
const ANALYTICS_ENDPOINT = STORE_DOMAIN
  ? `https://${STORE_DOMAIN}/api/${API_VERSION}/analytics`
  : null;

/** Storefront GraphQL endpoint — used to resolve the shop GID */
const STOREFRONT_ENDPOINT = STORE_DOMAIN
  ? `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`
  : null;

/** Only fire on the production domain */
const IS_PRODUCTION =
  typeof window !== "undefined" &&
  (window.location.hostname === "buy-moi.com" ||
    window.location.hostname === "www.buy-moi.com");

/** Temporarily allow firing in dev for testing via `?debug_analytics=1` */
const DEBUG_ANALYTICS =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("debug_analytics");

/** Schema ID required by Shopify's Customer Events API for headless storefronts */
const SCHEMA_ID = "custom-storefront-customer-events-api/1.0";

// ─── Debug logger ──────────────────────────────────────────────────────────────────────
function log(...args: unknown[]): void {
  if (DEBUG_ANALYTICS) {
    // eslint-disable-next-line no-console
    console.log("[ShopifyAnalytics]", ...args);
  }
}
function logError(...args: unknown[]): void {
  if (DEBUG_ANALYTICS) {
    // eslint-disable-next-line no-console
    console.error("[ShopifyAnalytics]", ...args);
  }
}

// ─── Shop GID ──────────────────────────────────────────────────────────────────────
// Fetched once via the Storefront API and cached in-memory for the page session.
// Returns e.g. "gid://shopify/Shop/89490".
let _shopIdPromise: Promise<string | null> | null = null;

function fetchShopId(): Promise<string | null> {
  if (_shopIdPromise) return _shopIdPromise;
  if (!STOREFRONT_ENDPOINT || !STOREFRONT_TOKEN) {
    logError("Missing STORE_DOMAIN or STOREFRONT_TOKEN — cannot fetch shopId");
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
      if (!r.ok) {
        logError("shopId fetch failed:", r.status, r.statusText);
      }
      return r.json() as Promise<{ data?: { shop?: { id?: string } }; errors?: unknown[] }>;
    })
    .then((json) => {
      if (json.errors) {
        logError("shopId GraphQL errors:", json.errors);
      }
      const id = json?.data?.shop?.id ?? null;
      log("shopId resolved:", id);
      return id;
    })
    .catch((err) => {
      logError("shopId fetch exception:", err);
      return null;
    });
  return _shopIdPromise;
}

// ─── Session token ────────────────────────────────────────────────────────────
// One token per browser session (sessionStorage resets on tab close).
// Shopify uses this to count unique online store sessions.
function getSessionToken(): string {
  const KEY = "moi_sa_session";
  try {
    let t = sessionStorage.getItem(KEY);
    if (!t) {
      t = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, t);
      log("new session token:", t);
    }
    return t;
  } catch {
    return `${Date.now().toString(36)}-fallback`;
  }
}

// ─── UTM parameters ───────────────────────────────────────────────────────────
// Captured from the landing URL and persisted for the session so they survive
// in-app navigation.  Feeds "Sessions by traffic source" in Shopify Analytics.
interface UtmParams { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string }

function captureAndPersistUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  (["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const)
    .forEach((k) => { const v = p.get(k); if (v) utm[k] = v; });
  if (Object.keys(utm).length > 0) {
    try { sessionStorage.setItem("moi_sa_utm", JSON.stringify(utm)); log("UTM captured:", utm); } catch { /* ignore */ }
  }
  return utm;
}

function getStoredUtm(): UtmParams {
  try {
    const raw = sessionStorage.getItem("moi_sa_utm");
    return raw ? (JSON.parse(raw) as UtmParams) : {};
  } catch { return {}; }
}

// ─── Low-level publisher ──────────────────────────────────────────────────────
// Shopify's Customer Events API requires each event to have a schemaId.
// The payload contains the event_name and all event-specific data.
interface AnalyticsEvent { payload: Record<string, unknown> }

async function publish(events: AnalyticsEvent[]): Promise<void> {
  if ((!IS_PRODUCTION && !DEBUG_ANALYTICS) || !ANALYTICS_ENDPOINT || !STOREFRONT_TOKEN) {
    log("blocked — not production or missing token/endpoint");
    return;
  }

  const body = { events: events.map((e) => ({ schemaId: SCHEMA_ID, payload: e.payload })) };
  log("sending", body);

  try {
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      keepalive: true,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      logError("HTTP error:", res.status, text);
    } else {
      log("HTTP 200 OK");
    }
  } catch (err) {
    logError("fetch exception:", err);
  }
}

// ─── Base payload ──────────────────────────────────────────────────────────────────────
// Included in every event.  Shopify requires shopId for correct store attribution.
async function basePayload(): Promise<Record<string, unknown>> {
  const shopId = await fetchShopId();
  const utm = getStoredUtm();
  return {
    shopId:           shopId ?? undefined,
    sessionId:        getSessionToken(),
    currency:         "EGP",
    acceptedLanguage: "EN",
    hasUserConsent:   true,
    url:              typeof window !== "undefined" ? window.location.href : undefined,
    referrer:         typeof document !== "undefined" && document.referrer ? document.referrer : undefined,
    timestamp:        new Date().toISOString(),
    ...(Object.keys(utm).length > 0 ? { utm } : {}),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────────────

/** Fire on every page load and in-app navigation. Feeds "Online store sessions". */
export function trackShopifyPageView(): void {
  captureAndPersistUtm();
  void basePayload().then((base) =>
    publish([{ payload: { event_name: "page_viewed", ...base } }]),
  );
}

/** Fire when a product card enters the viewport. Feeds "Top products by views". */
export function trackShopifyProductView(params: {
  productId?: string;
  variantId?: string;
  productTitle: string;
  price?: number;
  currencyCode?: string;
}): void {
  void basePayload().then((base) =>
    publish([{
      payload: {
        event_name: "product_viewed",
        ...base,
        products: [{
          productGid: params.productId,
          variantGid: params.variantId,
          name:        params.productTitle,
          price:       params.price != null ? params.price.toFixed(2) : undefined,
          currency:    params.currencyCode ?? "EGP",
          quantity:    1,
        }],
      },
    }]),
  );
}

/** Fire when the cart drawer opens. Feeds cart-viewed funnel metrics. */
export function trackShopifyCartViewed(params: {
  cartId?: string;
  totalPrice?: number;
  currencyCode?: string;
}): void {
  void basePayload().then((base) =>
    publish([{
      payload: {
        event_name: "cart_viewed",
        ...base,
        cartId:     params.cartId,
        totalPrice: params.totalPrice != null ? params.totalPrice.toFixed(2) : undefined,
        currency:   params.currencyCode ?? "EGP",
      },
    }]),
  );
}

/** Fire alongside Meta + TikTok pixels on add-to-cart. */
export function trackShopifyAddToCart(params: {
  cartId?: string;
  productId?: string;
  variantId?: string;
  productTitle: string;
  price?: number;
  quantity?: number;
  currencyCode?: string;
}): void {
  void basePayload().then((base) =>
    publish([{
      payload: {
        event_name: "add_to_cart",
        ...base,
        cartId: params.cartId,
        products: [{
          productGid: params.productId,
          variantGid: params.variantId,
          name:       params.productTitle,
          price:      params.price != null ? params.price.toFixed(2) : undefined,
          quantity:   params.quantity ?? 1,
          currency:   params.currencyCode ?? "EGP",
        }],
      },
    }]),
  );
}

/** Fire when the checkout flow opens. Feeds conversion-rate funnel top step. */
export function trackShopifyCheckoutStarted(params: {
  cartId?: string;
  totalPrice?: number;
  currencyCode?: string;
  lineItems?: Array<{ productId?: string; variantId?: string; title: string; price?: number; quantity: number }>;
}): void {
  void basePayload().then((base) =>
    publish([{
      payload: {
        event_name: "checkout_started",
        ...base,
        cartId:     params.cartId,
        totalPrice: params.totalPrice != null ? params.totalPrice.toFixed(2) : undefined,
        currency:   params.currencyCode ?? "EGP",
        lineItems:  params.lineItems?.map((li) => ({
          productGid: li.productId,
          variantGid: li.variantId,
          name:       li.title,
          price:      li.price != null ? li.price.toFixed(2) : undefined,
          quantity:   li.quantity,
        })),
      },
    }]),
  );
}

/**
 * Fire after every successful order (COD / InstaPay / Card).
 *
 * This is the most important event for Shopify Analytics:
 *   - Closes the session funnel so the session is counted as "converted"
 *   - Feeds "Online store conversion rate"
 *   - Feeds "Total sales from headless storefront" in Shopify's channel reports
 */
export function trackShopifyPurchase(params: {
  orderId: string;
  orderNumber?: string | number;
  totalPrice: number;
  currencyCode?: string;
  lineItems: Array<{ variantId?: string; title?: string; price?: number; quantity: number }>;
}): void {
  void basePayload().then((base) =>
    publish([{
      payload: {
        event_name: "purchase",
        ...base,
        orderId:     params.orderId,
        orderNumber: params.orderNumber != null ? String(params.orderNumber) : undefined,
        totalPrice:  params.totalPrice.toFixed(2),
        currency:    params.currencyCode ?? "EGP",
        lineItems:   params.lineItems.map((li) => ({
          variantGid: li.variantId,
          name:       li.title,
          price:      li.price != null ? li.price.toFixed(2) : undefined,
          quantity:   li.quantity,
        })),
      },
    }]),
  );
}
