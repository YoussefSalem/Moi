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
  merchantOrderId: string;
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
    payment_methods: [parseInt(config.integrationId, 10)],
    merchant_order_id: params.merchantOrderId,
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

/**
 * Verifies a Paymob HMAC-SHA512 webhook signature.
 *
 * Paymob v1 sends transaction fields at the top level.
 * Paymob v2 (Unified Checkout) wraps them inside an `obj` key.
 * This function handles both forms.
 */
export function verifyPaymobHmac(
  payload: Record<string, unknown>,
  signature: string,
): boolean {
  const config = getPaymobConfig();
  if (!config.hmacSecret) return false;

  // Paymob v2 wraps the transaction object under `obj`
  const txn = (payload.obj && typeof payload.obj === "object")
    ? (payload.obj as Record<string, unknown>)
    : payload;

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
    let val: unknown = txn;
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

/**
 * Extracts the transaction fields from a Paymob webhook payload.
 * Handles both top-level (v1) and obj-wrapped (v2) formats.
 */
export function extractPaymobTxn(payload: Record<string, unknown>): Record<string, unknown> {
  return (payload.obj && typeof payload.obj === "object")
    ? (payload.obj as Record<string, unknown>)
    : payload;
}

