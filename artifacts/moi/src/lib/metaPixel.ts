/**
 * Meta Pixel tracking utility for Moi e-commerce events.
 * Safe to call even before fbq loads — queue handles it.
 */

import { getAttribution } from "./adAttribution";

function hashId(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

const ECOMMERCE_EVENTS = new Set([
  "InitiateCheckout",
  "Purchase",
  "AddToCart",
  "ViewContent",
  "AddPaymentInfo",
  "CompleteRegistration",
]);

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (!fbq) return;

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    cleaned[key] = value;
  }

  // E-commerce events: currency must always be present; value must be a positive finite number.
  const isEcommerce = ECOMMERCE_EVENTS.has(eventName);
  if (isEcommerce) {
    // Always set currency — never strip it, even when value is absent or invalid.
    const rawCurrency = (cleaned.currency as string | undefined) ?? "EGP";
    cleaned.currency = rawCurrency.toUpperCase().slice(0, 3);

    // Value: keep only if it's a valid positive number; strip silently otherwise (currency stays).
    if ("value" in cleaned) {
      const val = cleaned.value as number;
      if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
        delete cleaned.value;
      } else {
        // Meta expects value rounded to exactly 2 decimal places.
        cleaned.value = Math.round(val * 100) / 100;
      }
    }
  } else {
    // Non-e-commerce: currency must be a valid ISO code and paired with value.
    if ("value" in cleaned && !("currency" in cleaned)) {
      cleaned.currency = "EGP";
    }
    if ("currency" in cleaned) {
      cleaned.currency = String(cleaned.currency).toUpperCase().slice(0, 3);
    }
  }

  // Attach Meta attribution cookies for ad platform cross-device matching
  const attr = getAttribution();
  if (attr.fbc) cleaned.fbc = attr.fbc;
  if (attr.fbp) cleaned.fbp = attr.fbp;

  // Deduplication key: deterministic event_id so Meta can deduplicate duplicate fires.
  // For Purchase events, use order_id as the event_id (the single source of truth).
  // For other events, hash the content_ids + value so the same cart fires the same ID.
  const orderId = cleaned.order_id as string | undefined;
  const contentIds = cleaned.content_ids as string | undefined;
  const value = cleaned.value as number | undefined;
  if (eventName === "Purchase" && orderId) {
    cleaned.event_id = hashId(`purchase_${orderId}`);
  } else if (contentIds) {
    cleaned.event_id = hashId(`${eventName}_${contentIds}_${value ?? 0}`);
  } else {
    cleaned.event_id = `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  if (Object.keys(cleaned).length > 1) {
    fbq("track", eventName, cleaned);
  } else {
    fbq("track", eventName, { event_id: cleaned.event_id });
  }
}

/** E-commerce helpers */
export function trackViewContent(params: {
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  currency?: string;
  value?: number;
}): void {
  trackEvent("ViewContent", {
    content_name: params.content_name,
    content_type: params.content_type ?? "product",
    content_ids: params.content_ids?.join(","),
    currency: params.currency ?? "EGP",
    value: params.value,
  });
}

export function trackAddToCart(params: {
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  currency?: string;
  value?: number;
  num_items?: number;
}): void {
  trackEvent("AddToCart", {
    content_name: params.content_name,
    content_type: params.content_type ?? "product",
    content_ids: params.content_ids?.join(","),
    currency: params.currency ?? "EGP",
    value: params.value,
    num_items: params.num_items ?? 1,
  });
}

export function trackInitiateCheckout(params: {
  content_ids?: string[];
  currency?: string;
  value?: number;
  num_items?: number;
}): void {
  trackEvent("InitiateCheckout", {
    content_type: "product",
    content_ids: params.content_ids?.join(","),
    currency: params.currency ?? "EGP",
    value: params.value,
    num_items: params.num_items ?? 1,
  });
}

export function trackPurchase(params: {
  content_ids?: string[];
  currency?: string;
  value?: number;
  num_items?: number;
  order_id?: string;
}): void {
  trackEvent("Purchase", {
    content_type: "product",
    content_ids: params.content_ids?.join(","),
    currency: params.currency ?? "EGP",
    value: params.value,
    num_items: params.num_items ?? 1,
    order_id: params.order_id,
  });
}
