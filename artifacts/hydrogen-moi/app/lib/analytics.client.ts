/**
 * Client-side analytics utilities.
 * Mirrors the existing Moi analytics.ts.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, params?: Record<string, unknown>) => void;
      identify: (params: Record<string, unknown>) => void;
    };
  }
}

export function initAnalytics() {
  if (typeof window === 'undefined') return;
  // Google Analytics is initialized via the script tag in root.tsx
  // Meta Pixel and TikTok Pixel are initialized via their respective modules
}

export function trackPageView(path?: string) {
  if (typeof window === 'undefined') return;
  const location = path ?? window.location.pathname;
  window.gtag?.('event', 'page_view', {
    page_path: location,
    page_location: window.location.href,
  });
}

export function trackAddToCart(params: {
  content_name: string;
  content_ids?: string[];
  currency?: string;
  value?: number;
}) {
  if (typeof window === 'undefined') return;

  window.fbq?.('track', 'AddToCart', {
    content_name: params.content_name,
    content_ids: params.content_ids ?? [],
    currency: params.currency ?? 'EGP',
    value: params.value ?? 0,
  });

  window.ttq?.track('AddToCart', {
    content_id: params.content_ids?.[0],
    content_name: params.content_name,
    currency: params.currency ?? 'EGP',
    value: params.value ?? 0,
  });
}

export function trackInitiateCheckout(params: {
  value: number;
  currency?: string;
  content_ids?: string[];
}) {
  if (typeof window === 'undefined') return;

  window.fbq?.('track', 'InitiateCheckout', {
    value: params.value,
    currency: params.currency ?? 'EGP',
    content_ids: params.content_ids ?? [],
  });
}

export function trackPurchase(params: {
  value: number;
  currency?: string;
  transaction_id?: string;
  content_ids?: string[];
}) {
  if (typeof window === 'undefined') return;

  window.fbq?.('track', 'Purchase', {
    value: params.value,
    currency: params.currency ?? 'EGP',
    content_ids: params.content_ids ?? [],
  });

  window.ttq?.track('CompletePayment', {
    value: params.value,
    currency: params.currency ?? 'EGP',
  });

  window.gtag?.('event', 'purchase', {
    transaction_id: params.transaction_id,
    value: params.value,
    currency: params.currency ?? 'EGP',
  });
}
