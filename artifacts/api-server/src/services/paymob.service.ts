/**
 * paymob.service.ts
 *
 * Pure business logic for Paymob interactions.
 * All HTTP is done via axios with retry logic.
 * No Express types here — this is a pure service layer.
 */
import axios from "axios";
import crypto from "crypto";
import { withRetry } from "../utils/retry";
import { logger } from "../lib/logger";

const PAYMOB_BASE = "https://accept.paymob.com";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface PaymobConfig {
  secretKey: string;
  publicKey: string;
  integrationId: string;
  hmacSecret: string;
  apiKey: string;
  iframeId: string;
}

export function getPaymobConfig(): PaymobConfig {
  return {
    secretKey: process.env.PAYMOB_SECRET_KEY ?? "",
    publicKey: process.env.PAYMOB_PUBLIC_KEY ?? "",
    integrationId: process.env.PAYMOB_INTEGRATION_ID ?? "",
    hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? "",
    apiKey: process.env.PAYMOB_API_KEY ?? "",
    iframeId: process.env.PAYMOB_IFRAME_ID ?? "",
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillingData {
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

export interface CartItem {
  name: string;
  amount_cents: number;
  description: string;
  quantity: number;
}

export interface IntentionParams {
  amountCents: number;
  currency: string;
  billingData: BillingData;
  items: CartItem[];
  specialReference: string;
  notificationUrl: string;
  redirectionUrl: string;
}

export interface IntentionResult {
  intentionId: string;
  clientSecret: string;
  checkoutUrl: string;
}

export interface LegacyPaymentResult {
  iframeUrl: string;
  paymobOrderId: number;
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

// ─── Auth token (legacy API) ──────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const { apiKey } = getPaymobConfig();
  if (!apiKey) throw new Error("PAYMOB_API_KEY is not configured");

  const res = await withRetry(
    () =>
      axios.post<{ token: string }>(`${PAYMOB_BASE}/api/auth/tokens`, {
        api_key: apiKey,
      }),
    { attempts: 3, delayMs: 500, label: "paymob.getAuthToken" },
  );

  const token = res.data.token;
  if (!token) throw new Error("No token in Paymob auth response");
  return token;
}

// ─── Intentions API (Unified Checkout) ───────────────────────────────────────

export async function createIntention(
  params: IntentionParams,
): Promise<IntentionResult> {
  const { secretKey, publicKey, integrationId } = getPaymobConfig();
  if (!secretKey) throw new Error("PAYMOB_SECRET_KEY is not configured");

  const body = {
    amount: params.amountCents,
    currency: params.currency,
    payment_methods: [parseInt(integrationId, 10)],
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
    "paymob.service: creating intention",
  );

  const res = await withRetry(
    () =>
      axios.post<{ id: string; client_secret: string }>(
        `${PAYMOB_BASE}/v1/intention/`,
        body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${secretKey}`,
          },
        },
      ),
    { attempts: 3, delayMs: 500, label: "paymob.createIntention" },
  );

  const { id, client_secret } = res.data;
  if (!id || !client_secret) {
    throw new Error("Paymob intention response missing id or client_secret");
  }

  const checkoutUrl = `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(client_secret)}`;

  logger.info(
    { intentionId: id, specialReference: params.specialReference },
    "paymob.service: intention created",
  );

  return { intentionId: id, clientSecret: client_secret, checkoutUrl };
}

// ─── Legacy API (auth → order → payment_key → iframe) ────────────────────────

export async function createLegacyPayment(params: {
  amountCents: number;
  currency: string;
  merchantOrderId: string;
  billingData: BillingData;
  items: CartItem[];
  notificationUrl: string;
  redirectionUrl: string;
}): Promise<LegacyPaymentResult> {
  const { integrationId, iframeId } = getPaymobConfig();
  if (!integrationId) throw new Error("PAYMOB_INTEGRATION_ID is not configured");
  if (!iframeId) throw new Error("PAYMOB_IFRAME_ID is not configured");

  logger.info(
    { merchantOrderId: params.merchantOrderId, amountCents: params.amountCents },
    "paymob.service: creating legacy payment",
  );

  const authToken = await getAuthToken();

  // Step 2 — create Paymob order
  const orderRes = await withRetry(
    () =>
      axios.post<{ id: number }>(
        `${PAYMOB_BASE}/api/ecommerce/orders`,
        {
          auth_token: authToken,
          delivery_needed: false,
          merchant_order_id: params.merchantOrderId,
          amount_cents: params.amountCents,
          currency: params.currency,
          items: params.items,
        },
      ),
    { attempts: 3, delayMs: 500, label: "paymob.createOrder" },
  );

  const paymobOrderId = orderRes.data.id;
  if (!paymobOrderId) throw new Error("Paymob order response missing id");

  // Step 3 — get payment key
  const keyRes = await withRetry(
    () =>
      axios.post<{ token: string }>(
        `${PAYMOB_BASE}/api/acceptance/payment_keys`,
        {
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
        },
      ),
    { attempts: 3, delayMs: 500, label: "paymob.getPaymentKey" },
  );

  const paymentToken = keyRes.data.token;
  if (!paymentToken) throw new Error("Paymob payment key response missing token");

  const iframeUrl = `${PAYMOB_BASE}/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;

  logger.info(
    { paymobOrderId, merchantOrderId: params.merchantOrderId },
    "paymob.service: legacy payment created",
  );

  return { iframeUrl, paymobOrderId };
}

// ─── HMAC Verification ────────────────────────────────────────────────────────

export function verifyHmac(txn: PaymobTransaction, receivedHmac: string): boolean {
  const { hmacSecret } = getPaymobConfig();
  if (!hmacSecret) {
    logger.warn("PAYMOB_HMAC_SECRET not configured — skipping HMAC verification");
    return false;
  }

  const bool = (v: boolean) => String(v);

  const concatenated = [
    String(txn.amount_cents),
    String(txn.created_at),
    String(txn.currency),
    bool(txn.error_occured),
    bool(txn.has_parent_transaction),
    String(txn.id),
    String(txn.integration_id),
    bool(txn.is_3d_secure),
    bool(txn.is_auth),
    bool(txn.is_capture),
    bool(txn.is_refunded),
    bool(txn.is_standalone_payment),
    bool(txn.is_voided),
    String(txn.order.id),
    String(txn.owner),
    bool(txn.pending),
    String(txn.source_data.pan ?? ""),
    String(txn.source_data.sub_type ?? ""),
    String(txn.source_data.type ?? ""),
    bool(txn.success),
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

// ─── Transaction inquiry ──────────────────────────────────────────────────────

export async function findSuccessfulTransaction(
  merchantOrderId: string,
): Promise<PaymobTransaction | null> {
  const token = await getAuthToken();
  const url = `${PAYMOB_BASE}/api/acceptance/transactions?merchant_order_id=${encodeURIComponent(merchantOrderId)}&page_size=10`;

  const res = await axios.get<{ results?: PaymobTransaction[] } | PaymobTransaction[]>(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
  ).catch((err) => {
    logger.error({ err, merchantOrderId }, "paymob.service: transaction inquiry failed");
    return null;
  });

  if (!res) return null;

  const results: PaymobTransaction[] = Array.isArray(res.data)
    ? res.data
    : (res.data as { results?: PaymobTransaction[] }).results ?? [];

  return (
    results.find((t) => t.success && !t.pending) ??
    results.find((t) => t.pending && !t.error_occured && t.amount_cents > 0) ??
    null
  );
}

// ─── Capture (force-resolve pending transactions) ─────────────────────────────

export async function captureTransaction(
  transactionId: number,
  amountCents: number,
): Promise<{ success: boolean; captured: boolean }> {
  try {
    const authToken = await getAuthToken();
    const res = await axios.post<{ success: boolean; pending: boolean }>(
      `${PAYMOB_BASE}/api/acceptance/void_refund/capture`,
      { auth_token: authToken, transaction_id: transactionId, amount_cents: amountCents },
    );
    const captured = res.data.success === true && res.data.pending === false;
    logger.info(
      { transactionId, amountCents, captured },
      "paymob.service: capture attempt",
    );
    return { success: true, captured };
  } catch (err) {
    logger.error({ err, transactionId }, "paymob.service: capture threw");
    return { success: false, captured: false };
  }
}
