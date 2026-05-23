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
 */

const STORAGE_KEY = "moi_ad_attribution";

export interface AdAttribution {
  fbclid?: string;    // Meta click ID
  gclid?: string;     // Google Ads click ID
  ttclid?: string;    // TikTok click ID
  fbp?: string;       // Meta browser ID (_fbp cookie)
  fbc?: string;       // Meta click ID cookie (_fbc)
  utm?: Record<string, string>;
  firstLandingUrl?: string;
  capturedAt?: string;
}

/** Read Meta's _fbc cookie (set by fbq when a user clicks a Meta ad) */
function getFbcCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/_fbc=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Read Meta's _fbp cookie (browser fingerprint) */
function getFbpCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/_fbp=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Parse query params from current URL */
function getQueryParam(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get(key);
  return v ?? undefined;
}

/** Capture all attribution data from current URL and cookies */
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

  // Persist for the session so in-app navigation retains attribution
  try {
    const existing = getAttribution();
    // Merge: prefer first-captured values, fill in new ones if missing
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

/** Retrieve the attribution data stored for this session */
export function getAttribution(): AdAttribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdAttribution) : {};
  } catch { return {}; }
}

/** Clear stored attribution (useful for testing) */
export function clearAttribution(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
