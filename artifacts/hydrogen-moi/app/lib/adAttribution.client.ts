/**
 * Ad attribution — captures UTM params, fbclid, gclid, ttclid into sessionStorage.
 * Mirrors the existing Moi adAttribution.ts.
 */

const ATTRIBUTION_KEY = 'moi_attribution';

interface Attribution {
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  captured_at?: string;
}

export function captureAttribution(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const keys: (keyof Attribution)[] = [
    'fbclid',
    'gclid',
    'ttclid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ];

  const attribution: Attribution = {};
  let hasData = false;

  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      (attribution as Record<string, string>)[key] = value;
      hasData = true;
    }
  }

  if (hasData) {
    attribution.captured_at = new Date().toISOString();
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  }
}

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}
