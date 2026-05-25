/**
 * Moi internal analytics — track user behavior and funnel data
 * for the admin dashboard. Works alongside Meta/TikTok pixels.
 *
 * NOTE: Analytics tracking is currently disabled to reduce PostgreSQL compute.
 * Set ANALYTICS_ENABLED = true to re-enable. All tracking code remains intact.
 */

const ANALYTICS_ENABLED = false;

const API_BASE = import.meta.env.BASE_URL ?? "/";

let sessionId: string | null = null;
let visitorId: string | null = null;
let sessionStartTime: number | null = null;

/** Generate or retrieve a stable visitor ID (localStorage) */
function getVisitorId(): string {
  if (visitorId) return visitorId;
  if (typeof window === "undefined") return "server";
  const stored = localStorage.getItem("moi_vid");
  if (stored) { visitorId = stored; return stored; }
  const id = generateId();
  localStorage.setItem("moi_vid", id);
  visitorId = id;
  return id;
}

/** Generate or retrieve a session ID (sessionStorage, resets per tab) */
function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "server";
  const stored = sessionStorage.getItem("moi_sid");
  if (stored) { sessionId = stored; return stored; }
  const id = generateId();
  sessionStorage.setItem("moi_sid", id);
  sessionId = id;
  sessionStartTime = Date.now();
  return id;
}

/** Check if this is a returning visitor */
function isReturningVisitor(): boolean {
  if (typeof window === "undefined") return false;
  const hasPrevious = localStorage.getItem("moi_has_session");
  if (hasPrevious) return true;
  localStorage.setItem("moi_has_session", "1");
  return false;
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Detect device type from user agent */
function getDeviceType(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "tablet";
  if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/** Detect OS from user agent */
function getOS(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X|macOS/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "other";
}

/** Detect browser name */
function getBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Chrome\/\d+/.test(ua) && !/Edg\/\d+/.test(ua)) return "Chrome";
  if (/Safari\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua)) return "Safari";
  if (/Firefox\/\d+/.test(ua)) return "Firefox";
  if (/Edg\/\d+/.test(ua)) return "Edge";
  return "other";
}

/** Parse UTM params from URL */
function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params: Record<string, string> = {};
  const url = new URL(window.location.href);
  for (const [k, v] of url.searchParams) {
    if (k.startsWith("utm_")) params[k] = v;
  }
  return params;
}

/** Resolve traffic source */
function getTrafficSource(): string {
  const utm = getUtmParams();
  const source = utm.utm_source?.toLowerCase();
  if (source?.includes("meta") || source?.includes("facebook") || source?.includes("instagram")) return "meta";
  if (source?.includes("tiktok")) return "tiktok";
  if (source?.includes("google") || source?.includes("gclid")) return "google";
  if (source) return source;
  // Check referrer
  if (typeof document === "undefined") return "direct";
  const ref = document.referrer;
  if (!ref) return "direct";
  if (ref.includes("facebook") || ref.includes("instagram")) return "meta";
  if (ref.includes("tiktok")) return "tiktok";
  if (ref.includes("google")) return "google";
  return "organic";
}

/** Send an analytics event to the backend */
export function trackEvent(
  category: "page" | "product" | "cart" | "checkout" | "purchase" | "interaction",
  event: string,
  metadata?: Record<string, unknown>,
): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const sid = getSessionId();
  const vid = getVisitorId();

  const payload = {
    sessionId: sid,
    visitorId: vid,
    category,
    event,
    pageUrl: window.location.pathname + window.location.search,
    metadata: metadata ?? {},
  };

  // Use sendBeacon if available for reliability on page unload
  const url = `${API_BASE}api/analytics/event`;
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } else {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => { /* ignore network errors */ });
  }
}

/** Start a new analytics session */
export function startAnalyticsSession(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const sid = getSessionId();
  const vid = getVisitorId();
  sessionStartTime = Date.now();

  const payload = {
    sessionId: sid,
    visitorId: vid,
    utmSource: getTrafficSource(),
    utmCampaign: getUtmParams().utm_campaign ?? null,
    utmMedium: getUtmParams().utm_medium ?? null,
    deviceType: getDeviceType(),
    os: getOS(),
    browser: getBrowser(),
    entryUrl: window.location.pathname + window.location.search,
    userAgent: navigator.userAgent.slice(0, 500),
    isReturning: isReturningVisitor(),
  };

  fetch(`${API_BASE}api/analytics/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => { /* ignore */ });

  trackEvent("page", "session_start");
}

/** End the current session — call on page unload */
export function endAnalyticsSession(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined" || !sessionId || !sessionStartTime) return;
  const duration = Math.round((Date.now() - sessionStartTime) / 1000);

  const payload = {
    sessionId,
    exitUrl: window.location.pathname + window.location.search,
    durationSeconds: duration,
    isBounce: (sessionStorage.getItem("moi_page_count") ?? "1") === "1",
  };

  const url = `${API_BASE}api/analytics/session/end`;
  const endBody = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([endBody], { type: "application/json" }));
  } else {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: endBody,
      keepalive: true,
    }).catch(() => { /* ignore */ });
  }
}

/** Track a page view */
export function trackPageView(url?: string): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const count = parseInt(sessionStorage.getItem("moi_page_count") ?? "0", 10) + 1;
  sessionStorage.setItem("moi_page_count", String(count));
  trackEvent("page", "page_view", { url: url ?? window.location.pathname });
}

/** Track scroll depth on a page (0-100) */
export function trackScrollDepth(depth: number): void {
  if (!ANALYTICS_ENABLED) return;
  trackEvent("page", "scroll_depth", { depth });
}

/** Track chat interaction (open, close, draft_change, send) */
export function trackChatInteraction(
  eventType: "open" | "close" | "draft_change" | "send",
  messageContent?: string,
  draftSequence?: number,
  metadata?: Record<string, unknown>,
): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const sid = getSessionId();
  const vid = getVisitorId();
  const payload = {
    sessionId: sid,
    visitorId: vid,
    eventType,
    messageContent: messageContent ?? null,
    draftSequence: draftSequence ?? null,
    metadata: metadata ?? {},
  };
  const url = `${API_BASE}api/analytics/chat`;
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } else {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => { /* ignore */ });
  }
}

/** Track product view */
export function trackProductView(productId: string, productTitle: string, price?: number): void {
  if (!ANALYTICS_ENABLED) return;
  trackEvent("product", "view", { productId, productTitle, price });
}

/** Track image interaction (click, zoom, swipe) */
export function trackProductImageInteraction(productId: string, action: "click" | "zoom" | "swipe", index?: number): void {
  trackEvent("product", "image_interaction", { productId, action, index });
}

/** Track size chart click */
export function trackSizeChartClick(productId: string): void {
  trackEvent("product", "size_chart_click", { productId });
}

/** Track variant/color change */
export function trackVariantChange(productId: string, variant: string): void {
  trackEvent("product", "variant_change", { productId, variant });
}

/** Track scroll depth on product card */
export function trackProductScroll(productId: string, depth: number): void {
  trackEvent("product", "scroll_depth", { productId, depth });
}

/** Track time spent on product card (call on unmount) */
export function trackProductTime(productId: string, seconds: number): void {
  trackEvent("product", "time_spent", { productId, seconds });
}

/** Track add to cart */
export function trackAddToCart(productId: string, productTitle: string, quantity: number, price: number): void {
  trackEvent("cart", "add_to_cart", { productId, productTitle, quantity, price });
}

/** Track checkout step */
export function trackCheckoutStep(step: "start" | "email" | "shipping" | "payment" | "complete", metadata?: Record<string, unknown>): void {
  trackEvent("checkout", `step_${step}`, metadata);
}

/** Track checkout step time */
export function trackCheckoutStepTime(step: string, seconds: number): void {
  trackEvent("checkout", "step_time", { step, seconds });
}

/** Track cart abandonment */
export function trackCartAbandonment(reason: string): void {
  trackEvent("cart", "abandon", { reason });
}

/** Track purchase */
export function trackPurchase(orderId: string, value: number, paymentMethod: string): void {
  trackEvent("purchase", "complete", { orderId, value, paymentMethod });
}

/** Track repeated product view (hesitation signal) */
export function trackRepeatedView(productId: string, viewCount: number): void {
  trackEvent("product", "repeated_view", { productId, viewCount });
}

/** Track a click with element and coordinate info */
export function trackClick(x: number, y: number, elementId: string, elementTag: string, elementText?: string, isRageTap?: boolean): void {
  trackEvent("interaction", "click", { x, y, elementId: elementId || "unknown", elementTag: elementTag || "unknown", elementText: elementText?.slice(0, 50), isRageTap });
}

/** Track a rage tap (rapid repeated taps on same element) */
export function trackRageTap(elementId: string, tapCount: number, timeWindowMs: number): void {
  trackEvent("interaction", "rage_tap", { elementId, tapCount, timeWindowMs });
}

/** Track element interaction (hover, focus, etc) */
export function trackElementInteraction(elementType: string, elementId: string, action: string, productId?: string): void {
  trackEvent("interaction", "element_interaction", { elementType, elementId, action, productId });
}

/** Track max scroll depth for current page */
let pageScrollMax = 0;
export function trackPageScrollDepth(): void {
  if (typeof window === "undefined") return;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const depth = docHeight > 0 ? Math.round((window.scrollY / docHeight) * 100) : 0;
  if (depth > pageScrollMax) {
    pageScrollMax = depth;
  }
}

/** Send final page scroll depth */
function sendPageScroll(): void {
  if (pageScrollMax > 0) {
    trackEvent("page", "scroll_depth_max", { maxDepth: pageScrollMax, url: window.location.pathname });
  }
}

/** Record first visit timestamp for time-to-purchase tracking */
function recordFirstVisit(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("moi_first_visit")) {
    localStorage.setItem("moi_first_visit", String(Date.now()));
  }
}

/** Get minutes from first visit to now */
function getTimeSinceFirstVisit(): number | null {
  if (typeof window === "undefined") return null;
  const first = localStorage.getItem("moi_first_visit");
  if (!first) return null;
  return Math.round((Date.now() - parseInt(first, 10)) / 60000);
}

/** Track purchase with time-to-purchase */
export function trackPurchaseWithTime(orderId: string, value: number, paymentMethod: string): void {
  const minutes = getTimeSinceFirstVisit();
  trackEvent("purchase", "complete", { orderId, value, paymentMethod, timeToPurchaseMinutes: minutes });
}

/** Initialize analytics on app mount */
export function initAnalytics(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  recordFirstVisit();
  startAnalyticsSession();
  trackPageView();

  // Track page views on route changes
  let lastPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      sendPageScroll();
      pageScrollMax = 0;
      lastPath = window.location.pathname;
      trackPageView(lastPath);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Track scroll depth (throttled)
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("scroll", () => {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      trackPageScrollDepth();
      scrollTimeout = null;
    }, 500);
  }, { passive: true });

  // Click tracking with rage tap detection
  const tapState: Record<string, { lastTap: number; count: number; timer: ReturnType<typeof setTimeout> | null }> = {};
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const classNameStr = typeof target.className === "string" ? target.className : "";
    const elId = target.id || classNameStr.slice(0, 30) || target.tagName;
    const elTag = target.tagName;
    const elText = target.textContent?.trim().slice(0, 30);
    const x = e.clientX;
    const y = e.clientY;

    // Rage tap detection
    const now = Date.now();
    const state = tapState[elId] ?? { lastTap: 0, count: 0, timer: null };
    if (now - state.lastTap < 500) {
      state.count++;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        if (state.count >= 3) {
          trackRageTap(elId, state.count, now - state.lastTap);
        }
        tapState[elId] = { lastTap: 0, count: 0, timer: null };
      }, 600);
    } else {
      state.count = 1;
    }
    state.lastTap = now;
    tapState[elId] = state;

    trackClick(x, y, elId, elTag, elText, state.count >= 3);
  }, { passive: true });

  // Touch event tracking for mobile
  if ("ontouchstart" in window) {
    document.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      trackEvent("interaction", "touch", { x: touch.clientX, y: touch.clientY, touches: e.touches.length });
    }, { passive: true });
  }

  // End session on unload
  window.addEventListener("beforeunload", () => {
    sendPageScroll();
    endAnalyticsSession();
  });
  window.addEventListener("pagehide", () => {
    sendPageScroll();
    endAnalyticsSession();
  });
}
