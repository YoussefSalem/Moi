import crypto from "crypto";
import { logger } from "./logger";

// ─── Shopify Admin Token ─────────────────────────────────────────────────────
let _shopifyTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Returns a valid Shopify Admin API access token.
 * Priority:
 *   1. SHOPIFY_ADMIN_API_TOKEN (static token — legacy custom apps)
 *   2. Client credentials grant via SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
 *      (required by Partner apps / Headless channel apps)
 */
export async function getShopifyAdminToken(): Promise<string | null> {
  const clientId = process.env.SHOPIFY_CLIENT_ID ?? "13d5094d322a8034b996021917ac8bda";
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET ?? process.env.SHOPIFY_APP_SHARED_SECRET;
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;

  // Prefer client credentials (Partner/Headless apps — grants scoped tokens).
  // Falls back to a static SHOPIFY_ADMIN_API_TOKEN if credentials are unavailable.
  if (clientId && clientSecret && storeDomain) {
    const now = Date.now();
    if (_shopifyTokenCache && now < _shopifyTokenCache.expiresAt - 60_000) {
      return _shopifyTokenCache.token;
    }
    try {
      const res = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string; expires_in?: number };
        _shopifyTokenCache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 86399) * 1000 };
        logger.info("Shopify Admin token refreshed via client credentials");
        return _shopifyTokenCache.token;
      }
      const errBody = await res.text().catch(() => "");
      logger.warn({ status: res.status, errBody }, "Shopify client credentials grant failed — falling back to static token");
    } catch (err) {
      logger.warn({ err }, "Shopify client credentials grant error — falling back to static token");
    }
  }

  return process.env.SHOPIFY_ADMIN_API_TOKEN ?? null;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return "2" + digits;
  return "20" + digits;
}

const BOSTA_CITY_MAP: Record<string, string> = {
  cairo: "Cairo",
  "new cairo": "Cairo",
  "nasr city": "Cairo",
  heliopolis: "Cairo",
  maadi: "Cairo",
  zamalek: "Cairo",
  "القاهرة": "Cairo",
  giza: "Giza",
  "6th of october": "Giza",
  "6 october": "Giza",
  october: "Giza",
  "sheikh zayed": "Giza",
  "الجيزة": "Giza",
  alexandria: "Alexandria",
  "الإسكندرية": "Alexandria",
  aswan: "Aswan",
  "أسوان": "Aswan",
  asyut: "Asyut",
  assiut: "Asyut",
  "أسيوط": "Asyut",
  beheira: "Beheira",
  "البحيرة": "Beheira",
  "beni suef": "Beni Suef",
  "بني سويف": "Beni Suef",
  dakahlia: "Dakahlia",
  "الدقهلية": "Dakahlia",
  mansoura: "Dakahlia",
  "المنصورة": "Dakahlia",
  damietta: "Damietta",
  "دمياط": "Damietta",
  fayoum: "Fayoum",
  "الفيوم": "Fayoum",
  gharbia: "Gharbia",
  "الغربية": "Gharbia",
  tanta: "Gharbia",
  "طنطا": "Gharbia",
  ismailia: "Ismailia",
  "الإسماعيلية": "Ismailia",
  "kafr el sheikh": "Kafr El Sheikh",
  "كفر الشيخ": "Kafr El Sheikh",
  luxor: "Luxor",
  "الأقصر": "Luxor",
  matruh: "Matruh",
  "مطروح": "Matruh",
  menoufia: "Menoufia",
  "المنوفية": "Menoufia",
  minya: "Minya",
  "المنيا": "Minya",
  "north sinai": "North Sinai",
  "شمال سيناء": "North Sinai",
  "new valley": "New Valley",
  "الوادي الجديد": "New Valley",
  "port said": "Port Said",
  "بورسعيد": "Port Said",
  qalyubia: "Qalyubia",
  "القليوبية": "Qalyubia",
  qena: "Qena",
  "قنا": "Qena",
  "red sea": "Red Sea",
  "البحر الأحمر": "Red Sea",
  hurghada: "Red Sea",
  "الغردقة": "Red Sea",
  sharqia: "Sharqia",
  "الشرقية": "Sharqia",
  zagazig: "Sharqia",
  "الزقازيق": "Sharqia",
  sohag: "Sohag",
  "سوهاج": "Sohag",
  "south sinai": "South Sinai",
  "جنوب سيناء": "South Sinai",
  "sharm el sheikh": "South Sinai",
  "شرم الشيخ": "South Sinai",
  suez: "Suez",
  "السويس": "Suez",
};

export function normalizeCityName(city: string): string {
  return BOSTA_CITY_MAP[city.toLowerCase().trim()] ?? city;
}

interface BostaCity {
  _id: string;
  name: string;
  nameAr?: string;
}

let _bostaCityCache: BostaCity[] | null = null;

async function fetchBostaCities(apiKey: string): Promise<BostaCity[]> {
  if (_bostaCityCache) return _bostaCityCache;
  try {
    const res = await fetch("https://app.bosta.co/api/v2/cities", {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data?: BostaCity[] };
    _bostaCityCache = data?.data ?? [];
    return _bostaCityCache;
  } catch {
    return [];
  }
}

/**
 * Resolves a user-entered city string to the exact Bosta city name.
 * First normalises via the static map, then validates against Bosta's live city list.
 * Falls back to the normalised name if the API is unavailable.
 */
export async function resolveBostaCityName(
  cityInput: string,
  apiKey: string,
): Promise<string> {
  const normalised = normalizeCityName(cityInput);
  const cities = await fetchBostaCities(apiKey);
  if (cities.length === 0) return normalised;

  // Exact match first
  const exact = cities.find(
    (c) => c.name.toLowerCase() === normalised.toLowerCase(),
  );
  if (exact) return exact.name;

  // Partial match fallback
  const partial = cities.find((c) =>
    c.name.toLowerCase().includes(normalised.toLowerCase()) ||
    normalised.toLowerCase().includes(c.name.toLowerCase()),
  );
  return partial?.name ?? normalised;
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const token = process.env.WHAPI_API_TOKEN;
  if (!token) return;
  const formatted = formatPhone(phone);
  try {
    const res = await fetch("https://gate.whapi.cloud/messages/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: `${formatted}@s.whatsapp.net`, body: message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, phone: formatted, body }, "Whapi non-2xx response");
    }
  } catch (err) {
    logger.warn({ err, phone: formatted }, "Whapi fetch error");
  }
}


export async function createBostaShipment(params: {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  orderReference: string;
  codAmount?: number;
}): Promise<string | null> {
  const apiKey = process.env.BOSTA_API_KEY;
  if (!apiKey) return null;

  const resolvedCity = await resolveBostaCityName(params.city, apiKey);
  const formatted = formatPhone(params.phone);

  try {
    const res = await fetch("https://app.bosta.co/api/v2/deliveries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        type: 10,
        specs: { packageType: "Parcel", size: "SMALL" },
        receiver: {
          firstName: params.firstName,
          lastName: params.lastName,
          phone: formatted,
          address: { city: resolvedCity, firstLine: params.address },
        },
        notes: `Moi Order ${params.orderReference}`,
        ...(params.codAmount && params.codAmount > 0 ? { cod: params.codAmount } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bosta ${res.status}: ${text}`);
    }
    const data = await res.json() as {
      data?: { trackingNumber?: string; _id?: string };
    };
    return data?.data?.trackingNumber ?? data?.data?._id ?? null;
  } catch {
    return null;
  }
}

/**
 * Appends `noteFragment` to the existing Shopify order note.
 * Always fetches the current note first to prevent overwriting prior content.
 */
export async function addShopifyOrderNote(
  orderId: number,
  noteFragment: string,
): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return;

  let existingNote = "";
  try {
    const getRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=note`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (getRes.ok) {
      const data = await getRes.json() as { order: { note: string | null } };
      existingNote = data.order.note ?? "";
    }
  } catch {
    // proceed with empty existing note
  }

  const combined = existingNote
    ? `${existingNote}\n${noteFragment}`
    : noteFragment;

  await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ order: { id: orderId, note: combined } }),
    },
  ).catch(() => {});
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  note: string | null;
  tags: string;
  fulfillments: {
    id: number;
    status: string;
    tracking_number: string | null;
  }[];
}

/**
 * Tags a Shopify order by appending a new tag (preserves existing tags).
 * Used to attach `bosta-{trackingNumber}` for deterministic status-webhook lookup.
 */
export async function tagShopifyOrder(orderId: number, tag: string): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return;

  try {
    const getRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=tags`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    let existingTags = "";
    if (getRes.ok) {
      const data = await getRes.json() as { order: { tags: string } };
      existingTags = data.order.tags ?? "";
    }
    const combined = existingTags ? `${existingTags}, ${tag}` : tag;
    await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({ order: { id: orderId, tags: combined } }),
      },
    );
  } catch (err) {
    logger.warn({ err, orderId, tag }, "tagShopifyOrder failed");
  }
}

/**
 * Shopify drops `referring_site` and `landing_site` when a draft order is
 * completed via API (no browser session). Re-apply them explicitly so
 * "Items sold by referrer" reporting stays accurate.
 */
export async function setShopifyOrderReferrer(
  orderId: number,
  attr: { referringSite?: string; landingSite?: string } | undefined,
): Promise<void> {
  if (!attr?.referringSite && !attr?.landingSite) return;
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return;

  const payload: Record<string, unknown> = { id: orderId };
  if (attr.referringSite) payload.referring_site = attr.referringSite;
  if (attr.landingSite) payload.landing_site = attr.landingSite;

  try {
    await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({ order: payload }),
      },
    );
  } catch (err) {
    logger.warn({ err, orderId, attr }, "setShopifyOrderReferrer failed");
  }
}

/**
 * Finds a Shopify order by its `bosta-{trackingNumber}` tag.
 * O(1) API call — no full order scan needed.
 */
export async function findOrderByTrackingNote(
  trackingNumber: string,
): Promise<ShopifyOrder | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return null;

  const tag = `bosta-${trackingNumber}`;
  try {
    const res = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders.json?status=any&tag=${encodeURIComponent(tag)}&limit=1&fields=id,order_number,note,tags,fulfillments`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { orders: ShopifyOrder[] };
    return data.orders[0] ?? null;
  } catch {
    return null;
  }
}

export async function createShopifyFulfillment(
  orderId: number,
  trackingNumber: string,
): Promise<number | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return null;

  try {
    const res = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders/${orderId}/fulfillments.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({
          fulfillment: {
            tracking_number: trackingNumber,
            tracking_company: "Bosta",
            tracking_url: `https://app.bosta.co/track-order/${trackingNumber}`,
            notify_customer: false,
          },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { fulfillment: { id: number } };
    return data.fulfillment.id;
  } catch {
    return null;
  }
}

export async function addShopifyFulfillmentEvent(
  orderId: number,
  fulfillmentId: number,
  status: string,
): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return;
  await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}/fulfillments/${fulfillmentId}/events.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ event: { status } }),
    },
  ).catch(() => {});
}

/**
 * Marks a Shopify checkout as complete so it no longer shows as abandoned.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function completeShopifyCheckout(token: string): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken || !token) return;
  try {
    const res = await fetch(
      `https://${storeDomain}/admin/api/2024-04/checkouts/${token}/complete.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body, token }, "completeShopifyCheckout: API call failed");
    } else {
      logger.info({ token }, "completeShopifyCheckout: checkout marked complete");
    }
  } catch (err) {
    logger.warn({ err, token }, "completeShopifyCheckout: network error");
  }
}

export function verifyShopifyHmac(
  rawBody: Buffer,
  hmacHeader: string,
  secret: string,
): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const hashBuf = Buffer.from(hash);
  const hmacBuf = Buffer.from(hmacHeader);
  if (hashBuf.length !== hmacBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, hmacBuf);
}
