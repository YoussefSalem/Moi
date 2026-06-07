/**
 * Meta Pixel tracking — adapted for Hydrogen.
 * CAPI events POST to admin.buy-moi.com/api/capi/event (Express backend on Replit).
 * Both browser pixel + CAPI carry the same event_id so Meta deduplicates them.
 */

import { getAttribution } from "~/lib/adAttribution";

export function hashId(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

const ECOMMERCE_EVENTS = new Set([
  "InitiateCheckout", "Purchase", "AddToCart", "ViewContent",
  "AddPaymentInfo", "CompleteRegistration",
]);

export interface CapiUserData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

function getApiOrigin(): string {
  if (typeof window === "undefined") return "https://admin.buy-moi.com";
  return (window as unknown as { ENV?: { PUBLIC_API_ORIGIN?: string } }).ENV?.PUBLIC_API_ORIGIN ?? "https://admin.buy-moi.com";
}

function sendCapiEvent(
  eventName: string,
  eventId: string,
  params: Record<string, string | number | boolean>,
  userData?: CapiUserData,
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
  if (params.value) body.value = params.value;
  if (params.num_items) body.num_items = params.num_items;
  if (params.fbc) body.fbc = params.fbc;
  if (params.fbp) body.fbp = params.fbp;
  if (params.order_id) body.order_id = params.order_id;
  if (userData?.email) body.email = userData.email;
  if (userData?.phone) body.phone = userData.phone;
  if (userData?.first_name) body.first_name = userData.first_name;
  if (userData?.last_name) body.last_name = userData.last_name;

  fetch(`${getApiOrigin()}/api/capi/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
  userData?: CapiUserData,
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

  const isEcommerce = ECOMMERCE_EVENTS.has(eventName);
  if (isEcommerce) {
    const rawCurrency = (cleaned.currency as string | undefined) ?? "EGP";
    cleaned.currency = rawCurrency.toUpperCase().slice(0, 3);
    if ("value" in cleaned) {
      const val = cleaned.value as number;
      if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
        delete cleaned.value;
      } else {
        cleaned.value = Math.round(val * 100) / 100;
      }
    }
  } else {
    if ("value" in cleaned && !("currency" in cleaned)) cleaned.currency = "EGP";
    if ("currency" in cleaned) cleaned.currency = String(cleaned.currency).toUpperCase().slice(0, 3);
  }

  const attr = getAttribution();
  if (attr.fbc) cleaned.fbc = attr.fbc;
  if (attr.fbp) cleaned.fbp = attr.fbp;

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

  fbq("track", eventName, Object.keys(cleaned).length > 0 ? cleaned : {}, { eventID: eventId });
  sendCapiEvent(eventName, eventId, cleaned, userData);
}

export function trackViewContent(params: {
  content_name?: string; content_type?: string; content_ids?: string[]; currency?: string; value?: number;
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
  content_name?: string; content_type?: string; content_ids?: string[]; currency?: string; value?: number; num_items?: number;
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
  content_ids?: string[]; currency?: string; value?: number; num_items?: number; user?: CapiUserData;
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
  content_ids?: string[]; currency?: string; value?: number; num_items?: number; order_id?: string;
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
