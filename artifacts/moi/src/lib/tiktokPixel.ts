/**
 * TikTok Pixel tracking utility for Moi e-commerce events.
 * Safe to call even before ttq loads — queue handles it.
 */

function getTtq(): ((...args: unknown[]) => void) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { ttq?: unknown };
  if (typeof w.ttq === "function") {
    return w.ttq as (...args: unknown[]) => void;
  }
  return undefined;
}

export function trackTikTokEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
): void {
  const ttq = getTtq();
  if (!ttq) return;

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      cleaned[key] = value;
    }
  }

  if (Object.keys(cleaned).length > 0) {
    ttq("track", eventName, cleaned);
  } else {
    ttq("track", eventName);
  }
}

/** E-commerce helpers */
export function trackTikTokViewContent(params: {
  content_name?: string;
  content_type?: string;
  content_id?: string;
  currency?: string;
  value?: number;
}): void {
  trackTikTokEvent("ViewContent", {
    content_name: params.content_name,
    content_type: params.content_type ?? "product",
    content_id: params.content_id,
    currency: params.currency ?? "EGP",
    value: params.value,
  });
}

export function trackTikTokAddToCart(params: {
  content_name?: string;
  content_type?: string;
  content_id?: string;
  currency?: string;
  value?: number;
  quantity?: number;
}): void {
  trackTikTokEvent("AddToCart", {
    content_name: params.content_name,
    content_type: params.content_type ?? "product",
    content_id: params.content_id,
    currency: params.currency ?? "EGP",
    value: params.value,
    quantity: params.quantity ?? 1,
  });
}

export function trackTikTokInitiateCheckout(params: {
  content_id?: string;
  currency?: string;
  value?: number;
  quantity?: number;
}): void {
  trackTikTokEvent("InitiateCheckout", {
    content_type: "product",
    content_id: params.content_id,
    currency: params.currency ?? "EGP",
    value: params.value,
    quantity: params.quantity ?? 1,
  });
}

export function trackTikTokPurchase(params: {
  content_id?: string;
  currency?: string;
  value?: number;
  quantity?: number;
  order_id?: string;
}): void {
  trackTikTokEvent("Purchase", {
    content_type: "product",
    content_id: params.content_id,
    currency: params.currency ?? "EGP",
    value: params.value,
    quantity: params.quantity ?? 1,
  });
}
