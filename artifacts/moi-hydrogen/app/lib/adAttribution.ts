/**
 * Ad attribution tracking — capture Meta / Google / TikTok click IDs
 * from landing URLs and persist them across the session.
 *
 * These IDs allow ad platforms to attribute downstream events
 * (page views, add-to-cart, purchase) back to the original ad click.
 *
 * Click IDs captured:
 *   fbclid   → Meta (Facebook/Instagram) → send as `fbc` to Meta pixel
 *   gclid    → Google Ads → pass to GA4 + Shopify analytics
 *   ttclid   → TikTok Ads → send to TikTok pixel
 *   utm_*    → All platforms → pass to Shopify analytics for source reporting
 *
 * Storage: sessionStorage (resets on tab close = one attribution per session).
 *
 * NOTE: Copied exactly from the React SPA version — do not simplify.
 * Campaign attribution accuracy depends on this logic being identical.
 */

const STORAGE_KEY = "moi_ad_attribution";

export interface AdAttribution {
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  fbp?: string;
  fbc?: string;
  utm?: Record<string, string>;
  firstLandingUrl?: string;
  capturedAt?: string;
}

function getFbcCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/_fbc=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function getFbpCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/_fbp=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function getQueryParam(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get(key);
  return v ?? undefined;
}

export function captureAttribution(): AdAttribution {
  const fbclid = getQueryParam("fbclid");
  const gclid = getQueryParam("gclid");
  const ttclid = getQueryParam("ttclid");

  const utm: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of p) {
      if (k.startsWith("utm_")) utm[k] = v;
    }
  }

  const attr: AdAttribution = {
    fbclid,
    gclid,
    ttclid,
    fbp: getFbpCookie(),
    fbc: fbclid ? `fb.1.${Date.now()}.${fbclid}` : getFbcCookie(),
    utm: Object.keys(utm).length > 0 ? utm : undefined,
    firstLandingUrl: typeof window !== "undefined" ? window.location.href : undefined,
    capturedAt: new Date().toISOString(),
  };

  try {
    const existing = getAttribution();
    const merged: AdAttribution = {
      ...existing,
      ...Object.fromEntries(
        Object.entries(attr).filter(([, v]) => v !== undefined),
      ),
      utm: { ...existing.utm, ...attr.utm },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }

  return attr;
}

export function getAttribution(): AdAttribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdAttribution) : {};
  } catch { return {}; }
}

export function clearAttribution(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
