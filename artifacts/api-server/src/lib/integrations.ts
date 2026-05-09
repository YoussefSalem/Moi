import crypto from "crypto";

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
  await fetch("https://gate.whapi.cloud/messages/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: `${formatted}@s.whatsapp.net`, body: message }),
  }).catch(() => {});
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
        cod: params.codAmount ?? 0,
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

export async function addShopifyOrderNote(
  orderId: number,
  note: string,
): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  if (!storeDomain || !adminToken) return;
  await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ order: { id: orderId, note } }),
    },
  ).catch(() => {});
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  note: string | null;
  fulfillments: {
    id: number;
    status: string;
    tracking_number: string | null;
  }[];
}

export async function findOrderByTrackingNote(
  trackingNumber: string,
): Promise<ShopifyOrder | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  if (!storeDomain || !adminToken) return null;

  try {
    const res = await fetch(
      `https://${storeDomain}/admin/api/2024-04/orders.json?status=any&limit=250&fields=id,order_number,note,fulfillments`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { orders: ShopifyOrder[] };
    return (
      data.orders.find((o) => o.note?.includes(trackingNumber)) ?? null
    );
  } catch {
    return null;
  }
}

export async function createShopifyFulfillment(
  orderId: number,
  trackingNumber: string,
): Promise<number | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
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
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
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
