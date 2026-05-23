/**
 * Meta Pixel tracking utility for Moi e-commerce events.
 * Safe to call even before fbq loads — queue handles it.
 */

import { getAttribution } from "./adAttribution";

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
  // Always require currency when value is present (Meta standard)
  if ("value" in cleaned && !("currency" in cleaned)) {
    cleaned.currency = "EGP";
  }
  if ("currency" in cleaned && !("value" in cleaned)) {
    cleaned.value = 0;
  }

  // Attach Meta attribution cookies for ad platform cross-device matching
  const attr = getAttribution();
  if (attr.fbc) cleaned.fbc = attr.fbc;
  if (attr.fbp) cleaned.fbp = attr.fbp;

  // Deduplication key: same event_id must be used on both browser + server
  cleaned.event_id = `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
