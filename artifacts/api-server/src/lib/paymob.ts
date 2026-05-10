import crypto from "crypto";
import { getPaymobConfig } from "./paymobConfig";
import { logger } from "./logger";

export interface PaymobCustomer {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
}

export interface CreateIntentionParams {
  amountCents: number;
  shopifyOrderId: number;
  customer: PaymobCustomer;
  redirectionUrl?: string;
}

export interface PaymobIntentionResult {
  clientSecret: string;
  publicKey: string;
}

export async function createPaymobIntention(
  params: CreateIntentionParams,
): Promise<PaymobIntentionResult> {
  const config = getPaymobConfig();
  if (!config.secretKey || !config.publicKey || !config.integrationId) {
    throw new Error("Paymob credentials are not configured");
  }

  const body: Record<string, unknown> = {
    amount: params.amountCents,
    currency: "EGP",
    integration_ids: [parseInt(config.integrationId, 10)],
    merchant_order_id: String(params.shopifyOrderId),
    ...(params.redirectionUrl ? { redirection_url: params.redirectionUrl } : {}),
    billing_data: {
      first_name: params.customer.firstName,
      last_name: params.customer.lastName,
      email: params.customer.email ?? "na@na.com",
      phone_number: params.customer.phone,
      street: params.customer.address,
      city: params.customer.city,
      country: "EG",
      state: "NA",
      postal_code: "NA",
      apartment: "NA",
      floor: "NA",
      building: "NA",
    },
    items: [],
  };

  const res = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${config.secretKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text }, "Paymob intention creation failed");
    throw new Error(`Paymob API error (${res.status}): ${text}`);
  }

  const data = await res.json() as { client_secret?: string };
  if (!data.client_secret) {
    throw new Error("Paymob returned no client_secret");
  }

  return {
    clientSecret: data.client_secret,
    publicKey: config.publicKey,
  };
}

// ── V1 Direct Card Charge ─────────────────────────────────────────────────────

export interface CardData {
  nameOnCard: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface CardChargeParams {
  amountCents: number;
  shopifyOrderId: number;
  customer: PaymobCustomer;
  card: CardData;
  redirectionUrl?: string;
}

export interface CardChargeResult {
  success: boolean;
  pending: boolean;
  transactionId: string;
  redirectUrl?: string;
  declineMessage?: string;
}

/**
 * Charges a card directly using the Paymob v1 API.
 * Steps: auth token → register order → payment key → pay with card.
 * Non-3DS cards return success/decline immediately.
 * 3DS cards return pending=true with a redirectUrl for the bank's 3DS page.
 * Card data is never logged — only the last 4 digits are used in logs.
 */
export async function chargeCardV1(params: CardChargeParams): Promise<CardChargeResult> {
  const config = getPaymobConfig();
  if (!config.apiKey || !config.integrationId) {
    throw new Error("Paymob v1 credentials (API key or integration ID) not configured");
  }

  const last4 = params.card.cardNumber.slice(-4);

  // Step 1: Auth token
  const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey }),
  });
  if (!authRes.ok) {
    const text = await authRes.text();
    throw new Error(`Paymob v1 auth failed (${authRes.status}): ${text}`);
  }
  const authData = await authRes.json() as { token: string };
  const authToken = authData.token;

  // Step 2: Register order with Paymob
  const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: params.amountCents,
      currency: "EGP",
      merchant_order_id: String(params.shopifyOrderId),
      items: [],
    }),
  });
  if (!orderRes.ok) {
    const text = await orderRes.text();
    throw new Error(`Paymob v1 order registration failed (${orderRes.status}): ${text}`);
  }
  const orderData = await orderRes.json() as { id: number };
  const paymobOrderId = orderData.id;

  // Step 3: Get payment key
  const keyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: params.amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        first_name: params.customer.firstName,
        last_name: params.customer.lastName,
        email: params.customer.email ?? "na@na.com",
        phone_number: params.customer.phone,
        street: params.customer.address,
        city: params.customer.city,
        country: "EG",
        state: "NA",
        postal_code: "NA",
        apartment: "NA",
        floor: "NA",
        building: "NA",
      },
      currency: "EGP",
      integration_id: parseInt(config.integrationId, 10),
    }),
  });
  if (!keyRes.ok) {
    const text = await keyRes.text();
    throw new Error(`Paymob v1 payment key failed (${keyRes.status}): ${text}`);
  }
  const keyData = await keyRes.json() as { token: string };
  const paymentKey = keyData.token;

  // Step 4: Pay with card
  const payBody: Record<string, unknown> = {
    source: {
      identifier: params.card.cardNumber.replace(/\s/g, ""),
      sourceholder_name: params.card.nameOnCard,
      subtype: "CARD",
      card_cvn: params.card.cvv,
      expiry_month: params.card.expiryMonth,
      expiry_year: params.card.expiryYear,
    },
    payment_token: paymentKey,
  };
  if (params.redirectionUrl) {
    payBody.redirection_url = params.redirectionUrl;
  }

  const payRes = await fetch("https://accept.paymob.com/api/acceptance/payments/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payBody),
  });
  if (!payRes.ok) {
    const text = await payRes.text();
    throw new Error(`Paymob v1 pay request failed (${payRes.status}): ${text}`);
  }
  const payData = await payRes.json() as {
    id: number;
    success: boolean;
    pending: boolean;
    redirect_url?: string;
    data?: { message?: string };
  };

  logger.info(
    { shopifyOrderId: params.shopifyOrderId, last4, success: payData.success, pending: payData.pending },
    "Paymob v1 card charge result",
  );

  return {
    success: payData.success === true,
    pending: payData.pending === true,
    transactionId: String(payData.id),
    redirectUrl: payData.redirect_url ?? undefined,
    declineMessage: (!payData.success && !payData.pending) ? (payData.data?.message ?? "Card declined") : undefined,
  };
}

// ── HMAC verification ─────────────────────────────────────────────────────────

/**
 * Verifies a Paymob HMAC-SHA512 webhook signature.
 */
export function verifyPaymobHmac(
  payload: Record<string, unknown>,
  signature: string,
): boolean {
  const config = getPaymobConfig();
  if (!config.hmacSecret) return false;

  const HMAC_FIELDS = [
    "amount_cents",
    "created_at",
    "currency",
    "error_occured",
    "has_parent_transaction",
    "id",
    "integration_id",
    "is_3d_secure",
    "is_auth",
    "is_capture",
    "is_refunded",
    "is_standalone_payment",
    "is_voided",
    "order",
    "owner",
    "pending",
    "source_data.pan",
    "source_data.sub_type",
    "source_data.type",
    "success",
  ];

  const concatenated = HMAC_FIELDS.map((field) => {
    const parts = field.split(".");
    let val: unknown = payload;
    for (const part of parts) {
      val = (val as Record<string, unknown>)?.[part];
    }
    if (val === undefined || val === null) return "";
    if (typeof val === "object") return "";
    return String(val);
  }).join("");

  const computed = crypto
    .createHmac("sha512", config.hmacSecret)
    .update(concatenated)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function cancelShopifyOrder(orderId: number): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const { getShopifyAdminToken } = await import("./integrations");
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return;
  await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}/cancel.json`,
    {
      method: "POST",
      headers: { "X-Shopify-Access-Token": adminToken, "Content-Type": "application/json" },
    },
  ).catch(() => {});
}
