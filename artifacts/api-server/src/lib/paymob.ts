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

  const body = {
    amount: params.amountCents,
    currency: "EGP",
    integration_ids: [parseInt(config.integrationId, 10)],
    merchant_order_id: String(params.shopifyOrderId),
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

/**
 * Verifies a Paymob HMAC-SHA512 webhook signature.
 *
 * Paymob computes the signature by concatenating the values of specific
 * transaction fields in alphabetical key order, then HMAC-SHA512 with the
 * hmac_secret. The field list is documented in the Paymob Unified Checkout v2 docs.
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
    // Paymob sends order/owner as plain integer IDs — stringify them directly.
    // Nested objects must not be serialised as "[object Object]".
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
