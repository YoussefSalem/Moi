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

export interface CreatePaymentKeyParams {
  amountCents: number;
  merchantOrderId: string;
  customer: PaymobCustomer;
  callbackUrl?: string;
}

export interface PaymobPaymentKeyResult {
  iframeUrl: string;
}

/**
 * Legacy Paymob 3-step payment key flow:
 * 1. POST /api/auth/tokens → auth_token
 * 2. POST /api/ecommerce/orders → paymob_order_id
 * 3. POST /api/acceptance/payment_keys → payment_token
 * 4. Embed iframe: accept.paymob.com/api/acceptance/iframes/{iframeId}?payment_token={token}
 */
export async function createPaymobPaymentKey(
  params: CreatePaymentKeyParams,
): Promise<PaymobPaymentKeyResult> {
  const config = getPaymobConfig();
  if (!config.apiKey) {
    throw new Error("Paymob API key is not configured");
  }
  if (!config.integrationId) {
    throw new Error("Paymob integration ID is not configured");
  }
  if (!config.iframeId) {
    throw new Error("Paymob iframe ID is not configured");
  }

  const integrationIdNum = parseInt(config.integrationId, 10);

  // Step 1: Authentication
  const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey }),
  });
  if (!authRes.ok) {
    const text = await authRes.text();
    logger.error({ status: authRes.status, text }, "Paymob legacy auth failed");
    throw new Error(`Paymob auth error (${authRes.status}): ${text}`);
  }
  const authData = await authRes.json() as { token?: string };
  const authToken = authData.token;
  if (!authToken) {
    throw new Error("Paymob auth returned no token");
  }
  logger.info("Paymob legacy auth token obtained");

  // Step 2: Order Registration
  const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: "false",
      amount_cents: params.amountCents,
      currency: "EGP",
      merchant_order_id: params.merchantOrderId,
      items: [
        {
          name: "Moi Order",
          amount_cents: params.amountCents,
          description: "Fashion order",
          quantity: 1,
        },
      ],
    }),
  });
  if (!orderRes.ok) {
    const text = await orderRes.text();
    logger.error({ status: orderRes.status, text }, "Paymob order registration failed");
    throw new Error(`Paymob order error (${orderRes.status}): ${text}`);
  }
  const orderData = await orderRes.json() as { id?: number };
  const paymobOrderId = orderData.id;
  if (!paymobOrderId) {
    throw new Error("Paymob order registration returned no ID");
  }
  logger.info({ paymobOrderId }, "Paymob legacy order registered");

  // Step 3: Payment Key
  const pkBody: Record<string, unknown> = {
    auth_token: authToken,
    amount_cents: params.amountCents,
    expiration: 3600,
    order_id: paymobOrderId,
    billing_data: {
      first_name: params.customer.firstName,
      last_name: params.customer.lastName,
      email: params.customer.email ?? "NA",
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
    integration_id: integrationIdNum,
    lock_order_when_paid: false,
  };
  if (params.callbackUrl) {
    pkBody["callback_url"] = params.callbackUrl;
  }

  const pkRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pkBody),
  });
  if (!pkRes.ok) {
    const text = await pkRes.text();
    logger.error({ status: pkRes.status, text }, "Paymob payment key creation failed");
    throw new Error(`Paymob payment key error (${pkRes.status}): ${text}`);
  }
  const pkData = await pkRes.json() as { token?: string };
  const paymentToken = pkData.token;
  if (!paymentToken) {
    throw new Error("Paymob payment key returned no token");
  }
  logger.info({ hasToken: true }, "Paymob legacy payment key obtained");

  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${config.iframeId}?payment_token=${paymentToken}`;

  return { iframeUrl };
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
