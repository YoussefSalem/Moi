import crypto from "crypto";
import { logger } from "./logger";

const PAYMOB_BASE = "https://accept.paymob.com";

export interface PaymobConfig {
  secretKey: string;
  publicKey: string;
  integrationId: string;
  hmacSecret: string;
}

export function getPaymobConfig(): PaymobConfig {
  return {
    secretKey: process.env.PAYMOB_API_KEY ?? "",
    publicKey: process.env.PAYMOB_PUBLIC_KEY ?? "",
    integrationId: process.env.PAYMOB_INTEGRATION_ID ?? "",
    hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? "",
  };
}

export interface PaymobBillingData {
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

export interface PaymobIntentionParams {
  amountCents: number;
  currency: string;
  billingData: PaymobBillingData;
  items: { name: string; amount: number; description: string; quantity: number }[];
  specialReference: string;
  notificationUrl: string;
  redirectionUrl: string;
}

export interface PaymobIntentionResult {
  intentionId: string;
  clientSecret: string;
}

/**
 * Creates a Paymob payment intention using the Intentions API.
 * Returns the intention ID and client secret for frontend redirect.
 *
 * Frontend redirect URL:
 *   https://accept.paymob.com/unifiedcheckout/?publicKey=<publicKey>&clientSecret=<clientSecret>
 */
export async function createPaymobIntention(
  params: PaymobIntentionParams,
): Promise<PaymobIntentionResult> {
  const config = getPaymobConfig();

  if (!config.secretKey) {
    throw new Error("PAYMOB_SECRET_KEY is not configured");
  }

  const body = {
    amount: params.amountCents,
    currency: params.currency,
    payment_methods: [parseInt(config.integrationId, 10)],
    items: params.items,
    billing_data: params.billingData,
    customer: {
      first_name: params.billingData.first_name,
      last_name: params.billingData.last_name,
      email: params.billingData.email,
    },
    special_reference: params.specialReference,
    notification_url: params.notificationUrl,
    redirection_url: params.redirectionUrl,
  };

  logger.info(
    { specialReference: params.specialReference, amountCents: params.amountCents },
    "Creating Paymob intention",
  );

  const res = await fetch(`${PAYMOB_BASE}/v1/intention/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${config.secretKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, text }, "Paymob intention creation failed");
    throw new Error(`Paymob intention failed (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    id?: string;
    client_secret?: string;
  };

  if (!data.id || !data.client_secret) {
    throw new Error("Paymob intention response missing id or client_secret");
  }

  logger.info(
    { intentionId: data.id, specialReference: params.specialReference },
    "Paymob intention created",
  );

  return {
    intentionId: data.id,
    clientSecret: data.client_secret,
  };
}

export interface PaymobTransaction {
  id: number;
  pending: boolean;
  amount_cents: number;
  success: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_standalone_payment: boolean;
  is_voided: boolean;
  is_refunded: boolean;
  is_3d_secure: boolean;
  integration_id: number;
  has_parent_transaction: boolean;
  order: {
    id: number;
    merchant_order_id?: string;
    currency?: string;
  };
  created_at: string;
  currency: string;
  error_occured: boolean;
  owner: number;
  source_data: {
    pan?: string;
    sub_type?: string;
    type?: string;
  };
  hmac?: string;
}

/**
 * Verifies the HMAC signature on a Paymob transaction webhook.
 *
 * The HMAC is computed as HMAC-SHA512 of a specific concatenation of
 * transaction fields using the hmacSecret as the key.
 */
export function verifyPaymobHmac(
  txn: PaymobTransaction,
  receivedHmac: string,
): boolean {
  const { hmacSecret } = getPaymobConfig();
  if (!hmacSecret) {
    logger.warn("PAYMOB_HMAC_SECRET not configured — skipping HMAC verification");
    return false;
  }

  const boolStr = (v: boolean) => String(v);

  const concatenated = [
    String(txn.amount_cents),
    String(txn.created_at),
    String(txn.currency),
    boolStr(txn.error_occured),
    boolStr(txn.has_parent_transaction),
    String(txn.id),
    String(txn.integration_id),
    boolStr(txn.is_3d_secure),
    boolStr(txn.is_auth),
    boolStr(txn.is_capture),
    boolStr(txn.is_refunded),
    boolStr(txn.is_standalone_payment),
    boolStr(txn.is_voided),
    String(txn.order.id),
    String(txn.owner),
    boolStr(txn.pending),
    String(txn.source_data.pan ?? ""),
    String(txn.source_data.sub_type ?? ""),
    String(txn.source_data.type ?? ""),
    boolStr(txn.success),
  ].join("");

  const computed = crypto
    .createHmac("sha512", hmacSecret)
    .update(concatenated)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed.toLowerCase()),
    Buffer.from(receivedHmac.toLowerCase()),
  );
}

/**
 * Returns the Paymob unified checkout URL for the given client secret.
 */
export function getPaymobCheckoutUrl(clientSecret: string): string {
  const { publicKey } = getPaymobConfig();
  return `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
}
