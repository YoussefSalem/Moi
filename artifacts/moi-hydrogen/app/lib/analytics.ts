/**
 * Moi internal analytics — adapted for Hydrogen/Remix.
 * API calls route to admin.buy-moi.com (Express backend on Replit).
 * ANALYTICS_ENABLED = false keeps compute low; flip to true to re-enable.
 */

const ANALYTICS_ENABLED = false;
const API_ORIGIN =
  typeof window !== "undefined"
    ? (window as unknown as { ENV?: { PUBLIC_API_ORIGIN?: string } }).ENV?.PUBLIC_API_ORIGIN ?? "https://admin.buy-moi.com"
    : "https://admin.buy-moi.com";

let sessionId: string | null = null;
let visitorId: string | null = null;
let sessionStartTime: number | null = null;

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

function isReturningVisitor(): boolean {
  if (typeof window === "undefined") return false;
  const has = localStorage.getItem("moi_has_session");
  if (has) return true;
  localStorage.setItem("moi_has_session", "1");
  return false;
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDeviceType(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "tablet";
  if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

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

function getBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Chrome\/\d+/.test(ua) && !/Edg\/\d+/.test(ua)) return "Chrome";
  if (/Safari\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua)) return "Safari";
  if (/Firefox\/\d+/.test(ua)) return "Firefox";
  if (/Edg\/\d+/.test(ua)) return "Edge";
  return "other";
}

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params: Record<string, string> = {};
  const url = new URL(window.location.href);
  for (const [k, v] of url.searchParams) {
    if (k.startsWith("utm_")) params[k] = v;
  }
  return params;
}

function getTrafficSource(): string {
  const utm = getUtmParams();
  const source = utm.utm_source?.toLowerCase();
  if (source?.includes("meta") || source?.includes("facebook") || source?.includes("instagram")) return "meta";
  if (source?.includes("tiktok")) return "tiktok";
  if (source?.includes("google") || source?.includes("gclid")) return "google";
  if (source) return source;
  if (typeof document === "undefined") return "direct";
  const ref = document.referrer;
  if (!ref) return "direct";
  if (ref.includes("facebook") || ref.includes("instagram")) return "meta";
  if (ref.includes("tiktok")) return "tiktok";
  if (ref.includes("google")) return "google";
  return "organic";
}

export function trackEvent(
  category: "page" | "product" | "cart" | "checkout" | "purchase" | "interaction",
  event: string,
  metadata?: Record<string, unknown>,
): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const payload = {
    sessionId: getSessionId(),
    visitorId: getVisitorId(),
    category,
    event,
    pageUrl: window.location.pathname + window.location.search,
    metadata: metadata ?? {},
  };
  const url = `${API_ORIGIN}/api/analytics/event`;
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } else {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

export function startAnalyticsSession(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const sid = getSessionId();
  const vid = getVisitorId();
  sessionStartTime = Date.now();
  const payload = {
    sessionId: sid, visitorId: vid,
    utmSource: getTrafficSource(),
    utmCampaign: getUtmParams().utm_campaign ?? null,
    utmMedium: getUtmParams().utm_medium ?? null,
    deviceType: getDeviceType(), os: getOS(), browser: getBrowser(),
    entryUrl: window.location.pathname + window.location.search,
    userAgent: navigator.userAgent.slice(0, 500),
    isReturning: isReturningVisitor(),
  };
  fetch(`${API_ORIGIN}/api/analytics/session`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }).catch(() => {});
  trackEvent("page", "session_start");
}

export function endAnalyticsSession(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined" || !sessionId || !sessionStartTime) return;
  const duration = Math.round((Date.now() - sessionStartTime) / 1000);
  const payload = {
    sessionId, exitUrl: window.location.pathname + window.location.search,
    durationSeconds: duration,
    isBounce: (sessionStorage.getItem("moi_page_count") ?? "1") === "1",
  };
  const url = `${API_ORIGIN}/api/analytics/session/end`;
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } else {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

export function trackPageView(url?: string): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const count = parseInt(sessionStorage.getItem("moi_page_count") ?? "0", 10) + 1;
  sessionStorage.setItem("moi_page_count", String(count));
  trackEvent("page", "page_view", { url: url ?? window.location.pathname });
}

export function trackAddToCart(productId: string, productTitle: string, quantity: number, price: number): void {
  trackEvent("cart", "add_to_cart", { productId, productTitle, quantity, price });
}

export function trackProductView(productId: string, productTitle: string, price?: number): void {
  trackEvent("product", "view", { productId, productTitle, price });
}

export function trackPurchase(orderId: string, value: number, paymentMethod: string): void {
  trackEvent("purchase", "complete", { orderId, value, paymentMethod });
}

let pageScrollMax = 0;
export function trackPageScrollDepth(): void {
  if (typeof window === "undefined") return;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const depth = docHeight > 0 ? Math.round((window.scrollY / docHeight) * 100) : 0;
  if (depth > pageScrollMax) pageScrollMax = depth;
}

function recordFirstVisit(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("moi_first_visit")) {
    localStorage.setItem("moi_first_visit", String(Date.now()));
  }
}

export function initAnalytics(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  recordFirstVisit();
  startAnalyticsSession();
  trackPageView();
  window.addEventListener("pagehide", (e) => {
    if (!e.persisted) endAnalyticsSession();
  });
}
