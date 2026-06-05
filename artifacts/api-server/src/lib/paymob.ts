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
    secretKey: process.env.PAYMOB_SECRET_KEY ?? "",
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

export interface LegacyPaymobPaymentResult {
  iframeUrl: string;
  paymobOrderId: number;
}

/**
 * Creates a Paymob payment using the legacy API (auth → order → payment_key → iframe).
 *
 * This flow produces transactions with Origin "Application" that resolve to
 * Success or Declined after 3DS — unlike the Intentions v1 / Pixel flow which
 * uses a Shopify-type integration and leaves transactions permanently Pending.
 */
export async function createLegacyPaymobPayment(params: {
  amountCents: number;
  currency: string;
  merchantOrderId: string;
  billingData: PaymobBillingData;
  items: { name: string; amount_cents: number; description: string; quantity: number }[];
  notificationUrl: string;
  redirectionUrl: string;
}): Promise<LegacyPaymobPaymentResult> {
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  if (!iframeId) throw new Error("PAYMOB_IFRAME_ID not configured");

  const { integrationId } = getPaymobConfig();
  if (!integrationId) throw new Error("PAYMOB_INTEGRATION_ID not configured");

  logger.info(
    { merchantOrderId: params.merchantOrderId, amountCents: params.amountCents },
    "Creating legacy Paymob payment",
  );

  // Step 1 — auth token
  const authToken = await getPaymobAuthToken();

  // Step 2 — create Paymob order (merchant_order_id = our checkoutToken)
  const orderRes = await fetch(`${PAYMOB_BASE}/api/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      merchant_order_id: params.merchantOrderId,
      amount_cents: params.amountCents,
      currency: params.currency,
      items: params.items,
    }),
  });

  if (!orderRes.ok) {
    const text = await orderRes.text().catch(() => "");
    throw new Error(`Paymob order creation failed (${orderRes.status}): ${text}`);
  }

  const orderData = await orderRes.json() as { id?: number };
  if (!orderData.id) throw new Error("Paymob order response missing id");
  const paymobOrderId = orderData.id;

  // Step 3 — get payment key
  const keyRes = await fetch(`${PAYMOB_BASE}/api/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: params.amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: params.billingData,
      currency: params.currency,
      integration_id: parseInt(integrationId, 10),
      lock_order_when_paid: false,
      notification_url: params.notificationUrl,
      redirection_url: params.redirectionUrl,
    }),
  });

  if (!keyRes.ok) {
    const text = await keyRes.text().catch(() => "");
    throw new Error(`Paymob payment key creation failed (${keyRes.status}): ${text}`);
  }

  const keyData = await keyRes.json() as { token?: string };
  if (!keyData.token) throw new Error("Paymob payment key response missing token");

  const iframeUrl = `${PAYMOB_BASE}/api/acceptance/iframes/${iframeId}?payment_token=${keyData.token}`;

  logger.info(
    { paymobOrderId, merchantOrderId: params.merchantOrderId },
    "Legacy Paymob payment created",
  );

  return { iframeUrl, paymobOrderId };
}

/**
 * Obtains a short-lived Paymob auth token using the legacy API key.
 * Required for transaction inquiry and other non-Intentions endpoints.
 */
async function getPaymobAuthToken(): Promise<string> {
  const apiKey = process.env.PAYMOB_API_KEY ?? "";
  if (!apiKey) throw new Error("PAYMOB_API_KEY not configured");

  const res = await fetch(`${PAYMOB_BASE}/api/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paymob auth failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error("No token in Paymob auth response");
  return data.token;
}

/**
 * Queries Paymob transactions by merchant_order_id (our checkoutToken / special_reference).
 * Returns the first successful, non-pending transaction, or null if none found.
 *
 * Used by the Pixel verify-payment flow where the frontend calls back after
 * afterPaymentComplete fires, instead of waiting for the webhook.
 */
export async function findSuccessfulPaymobTransaction(
  merchantOrderId: string,
): Promise<PaymobTransaction | null> {
  const token = await getPaymobAuthToken();

  // NOTE: trailing slash causes 404 — do NOT add it.
  const url = `${PAYMOB_BASE}/api/acceptance/transactions?merchant_order_id=${encodeURIComponent(merchantOrderId)}&page_size=10`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, text, merchantOrderId }, "Paymob transaction inquiry failed");
    return null;
  }

  const data = await res.json() as { results?: PaymobTransaction[] } | PaymobTransaction[];
  const results: PaymobTransaction[] = Array.isArray(data)
    ? data
    : (data as { results?: PaymobTransaction[] }).results ?? [];

  logger.info(
    { merchantOrderId, count: results.length, statuses: results.map((t) => ({ id: t.id, success: t.success, pending: t.pending, error: t.error_occured })) },
    "Paymob transaction inquiry results",
  );

  // Prefer a fully confirmed transaction (success=true, pending=false).
  // Fall back to a pending transaction with no error — this happens with
  // Shopify-type integrations (e.g. 5658307) where the transaction is left
  // in pending state because Shopify's payment callback can't confirm it,
  // even though the card was actually charged.
  return (
    results.find((t) => t.success && !t.pending) ??
    results.find((t) => t.pending && !t.error_occured && t.amount_cents > 0) ??
    null
  );
}
