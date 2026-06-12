/**
 * Meta Pixel tracking utility for Moi e-commerce events.
 * Safe to call even before fbq loads — queue handles it.
 *
 * Each `trackEvent` call fires TWO signals in parallel:
 *   1. Browser pixel (fbq)        — client-side, used for attribution / retargeting
 *   2. Conversions API (CAPI)     — server-side relay via /api/capi/event
 *
 * Both carry the same deterministic `event_id` so Meta deduplicates them as
 * a single event, eliminating the cs_est double-fire in Events Manager.
 *
 * Gating: tracking fires ONLY on the production storefront hostnames
 * (buy-moi.com / www.buy-moi.com), mirroring the pixel init in index.html.
 * This keeps the browser pixel and CAPI in lockstep and prevents events from
 * leaking out of dev / preview / *.replit.app environments. The CAPI relay is
 * intentionally NOT gated on the presence of `fbq` so it still fires when the
 * browser pixel script is blocked (ad blockers / iOS), which is the whole point
 * of having a server-side channel.
 */

import { getAttribution } from "./adAttribution";

export function hashId(str: string): string {
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

/**
 * Tracking is only active on the live storefront. Mirrors the hostname gate in
 * index.html so the browser pixel and CAPI never disagree about whether an event
 * should be sent.
 */
function isMetaTrackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "buy-moi.com" || h === "www.buy-moi.com";
}

/** Read a browser cookie by name. */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export interface CapiUserData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

/** A single line item, in Meta's `contents` shape. */
export interface CapiContent {
  id: string;
  quantity: number;
  item_price?: number;
}

/**
 * Send a server-side CAPI event. Fire-and-forget — never throws.
 * Only fires for e-commerce events; skips when the API is unreachable.
 * PII (email, phone, name) is sent plaintext over HTTPS to our own server,
 * which SHA-256 hashes it before forwarding to Meta.
 */
function sendCapiEvent(
  eventName: string,
  eventId: string,
  params: Record<string, string | number | boolean>,
  userData?: CapiUserData,
  contents?: CapiContent[],
): void {
  if (typeof window === "undefined") return;
  if (!ECOMMERCE_EVENTS.has(eventName)) return;

  const contentIdsRaw = params.content_ids as string | undefined;
  const contentIds = contentIdsRaw
    ? contentIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const body: Record<string, unknown> = {
    event_name: eventName,
    event_id: eventId,
    event_source_url: window.location.href,
    content_type: params.content_type ?? "product",
    currency: params.currency ?? "EGP",
  };
  if (contentIds?.length) body.content_ids = contentIds;
  if (contents?.length) body.contents = contents;
  if (params.value) body.value = params.value;
  if (params.num_items) body.num_items = params.num_items;
  if (params.fbc) body.fbc = params.fbc;
  if (params.fbp) body.fbp = params.fbp;
  if (params.order_id) body.order_id = params.order_id;

  if (userData?.email) body.email = userData.email;
  if (userData?.phone) body.phone = userData.phone;
  if (userData?.first_name) body.first_name = userData.first_name;
  if (userData?.last_name) body.last_name = userData.last_name;

  fetch("/api/capi/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silently ignore network errors — CAPI is a best-effort enhancement
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
  userData?: CapiUserData,
  contents?: CapiContent[],
): void {
  // Single gate for BOTH browser pixel and CAPI — keeps them in lockstep and
  // prevents events leaking from non-production hostnames.
  if (!isMetaTrackingEnabled()) return;

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

  // Attach Meta attribution cookies for ad platform cross-device matching.
  // Prefer the LIVE _fbc / _fbp cookies (set by fbq, refreshed each visit) and
  // fall back to the session-captured attribution snapshot. Live cookies give
  // Meta the strongest match signal for CAPI.
  const attr = getAttribution();
  const fbc = readCookie("_fbc") ?? attr.fbc;
  const fbp = readCookie("_fbp") ?? attr.fbp;
  if (fbc) cleaned.fbc = fbc;
  if (fbp) cleaned.fbp = fbp;

  // Deduplication key: deterministic event_id so Meta can deduplicate duplicate fires.
  // IMPORTANT: eventID must go in the 4th argument {eventID: ...}, NOT inside the params
  // object. Placing it in params means Meta ignores it for deduplication entirely.
  // For Purchase events, use order_id as the event_id (the single source of truth).
  // For other events, hash the content_ids + value so the same cart fires the same ID.
  const orderId = cleaned.order_id as string | undefined;
  const contentIds = cleaned.content_ids as string | undefined;
  const value = cleaned.value as number | undefined;
  let eventId: string;
  if (eventName === "Purchase" && orderId) {
    eventId = hashId(`purchase_${orderId}`);
  } else if (contentIds) {
    eventId = hashId(`${eventName}_${contentIds}_${value ?? 0}`);
  } else {
    eventId = `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // 1. Browser pixel — only if fbq is present (may be blocked by ad blockers).
  //    content_ids is sent as a proper array (Meta's expected shape) so it
  //    matches what the CAPI relay sends server-side.
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (fbq) {
    const fbqPayload: Record<string, unknown> = { ...cleaned };
    if (contentIds) {
      fbqPayload.content_ids = contentIds.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (contents?.length) fbqPayload.contents = contents;
    fbq("track", eventName, fbqPayload, { eventID: eventId });
  }

  // 2. Server-side CAPI (same event_id → Meta deduplicates). Fires even when the
  //    browser pixel is blocked, so ad-blocked / iOS conversions are recovered.
  sendCapiEvent(eventName, eventId, cleaned, userData, contents);
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
  user?: CapiUserData;
}): void {
  trackEvent("InitiateCheckout", {
    content_type: "product",
    content_ids: params.content_ids?.join(","),
    currency: params.currency ?? "EGP",
    value: params.value,
    num_items: params.num_items ?? 1,
  }, params.user);
}

export function trackPurchase(params: {
  content_ids?: string[];
  contents?: CapiContent[];
  currency?: string;
  value?: number;
  num_items?: number;
  order_id?: string;
  user?: CapiUserData;
}): void {
  trackEvent("Purchase", {
    content_type: "product",
    content_ids: params.content_ids?.join(","),
    currency: params.currency ?? "EGP",
    value: params.value,
    num_items: params.num_items ?? 1,
    order_id: params.order_id,
  }, params.user, params.contents);
}
