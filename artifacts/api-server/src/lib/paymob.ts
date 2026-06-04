import crypto from "crypto";
import { getPaymobConfig } from "./paymobConfig";
import { logger } from "./logger";

export interface CardCustomer {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
}

/**
 * Paymob 3-step card payment key flow:
 * 1. POST /api/auth/tokens          → auth_token
 * 2. POST /api/ecommerce/orders      → paymob_order_id
 * 3. POST /api/acceptance/payment_keys → payment_token
 * 4. Embed iframe: accept.paymob.com/api/acceptance/iframes/{iframeId}?payment_token={token}
 */
export async function createCardPaymentKey(params: {
  amountCents: number;
  merchantOrderId: string;
  customer: CardCustomer;
  redirectionUrl?: string;
  callbackUrl?: string;
}): Promise<{ iframeUrl: string }> {
  const config = getPaymobConfig();
  if (!config.apiKey) throw new Error("PAYMOB_API_KEY is not set");
  if (!config.integrationId) throw new Error("Paymob integration ID is not configured");
  if (!config.iframeId) throw new Error("Paymob iframe ID is not configured");

  const integrationId = parseInt(config.integrationId, 10);

  // Step 1: Authenticate
  const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey }),
  });
  if (!authRes.ok) {
    const text = await authRes.text();
    throw new Error(`Paymob auth failed (${authRes.status}): ${text}`);
  }
  const { token: authToken } = await authRes.json() as { token?: string };
  if (!authToken) throw new Error("Paymob auth returned no token");

  // Step 2: Register order
  const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: "false",
      amount_cents: params.amountCents,
      currency: "EGP",
      merchant_order_id: params.merchantOrderId,
      items: [{ name: "Moi Order", amount_cents: params.amountCents, description: "Fashion order", quantity: 1 }],
    }),
  });
  if (!orderRes.ok) {
    const text = await orderRes.text();
    throw new Error(`Paymob order registration failed (${orderRes.status}): ${text}`);
  }
  const { id: paymobOrderId } = await orderRes.json() as { id?: number };
  if (!paymobOrderId) throw new Error("Paymob order registration returned no ID");

  // Step 3: Get payment key
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
    integration_id: integrationId,
    lock_order_when_paid: false,
  };
  if (params.redirectionUrl) pkBody["redirection_url"] = params.redirectionUrl;
  if (params.callbackUrl) pkBody["callback_url"] = params.callbackUrl;

  const pkRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pkBody),
  });
  if (!pkRes.ok) {
    const text = await pkRes.text();
    throw new Error(`Paymob payment key failed (${pkRes.status}): ${text}`);
  }
  const { token: paymentToken } = await pkRes.json() as { token?: string };
  if (!paymentToken) throw new Error("Paymob payment key returned no token");

  logger.info({ merchantOrderId: params.merchantOrderId, paymobOrderId }, "Paymob card payment key created");

  return {
    iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${config.iframeId}?payment_token=${paymentToken}`,
  };
}

// In-process auth token cache — avoids re-authenticating on every status poll.
let _cachedAuthToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string> {
  const config = getPaymobConfig();
  if (!config.apiKey) throw new Error("PAYMOB_API_KEY is not set");
  if (_cachedAuthToken && Date.now() < _cachedAuthToken.expiresAt) {
    return _cachedAuthToken.token;
  }
  const res = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey }),
  });
  if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`);
  const { token } = await res.json() as { token?: string };
  if (!token) throw new Error("Paymob auth returned no token");
  // Cache for 50 minutes (Paymob tokens are valid for 1 hour)
  _cachedAuthToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

/**
 * Fetch a specific Paymob transaction by its numeric ID.
 * Verifies it belongs to our merchantOrderId. Returns null if not found or mismatched.
 */
export async function fetchTransactionById(txnId: string, expectedMerchantOrderId: string): Promise<{
  success: boolean;
  txnId: string;
  amountCents: number;
} | null> {
  const numericId = parseInt(txnId, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  try {
    const token = await getAuthToken();
    const url = `https://accept.paymob.com/api/acceptance/transactions/${numericId}`;

    // Try Bearer token auth first, then legacy query-param auth
    let res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) {
      res = await fetch(`${url}?auth_token=${encodeURIComponent(token)}`);
    }
    if (!res.ok) {
      logger.warn({ txnId, status: res.status }, "fetchTransactionById: all auth strategies failed");
      return null;
    }

    const txn = await res.json() as {
      id?: number;
      success?: boolean;
      pending?: boolean;
      amount_cents?: number;
      order?: { merchant_order_id?: string; amount_cents?: number };
    };

    // Reject if it doesn't belong to our order
    if (txn.order?.merchant_order_id !== expectedMerchantOrderId) {
      logger.warn({ txnId, expectedMerchantOrderId, actual: txn.order?.merchant_order_id }, "fetchTransactionById: merchant_order_id mismatch");
      return null;
    }
    if (txn.pending) return null; // Still in 3DS, not resolved yet

    return {
      success: txn.success === true,
      txnId: String(txn.id ?? numericId),
      amountCents: txn.amount_cents ?? txn.order?.amount_cents ?? 0,
    };
  } catch (err) {
    logger.warn({ err, txnId }, "fetchTransactionById: error");
    return null;
  }
}

/**
 * Query Paymob for the latest resolved transaction on an order by our merchantOrderId.
 * Used as a fallback when the server-to-server webhook has not arrived.
 * Returns null if no resolved transaction is found or on any error.
 */
export async function queryTransactionByMerchantOrderId(merchantOrderId: string): Promise<{
  success: boolean;
  txnId: string;
  amountCents: number;
} | null> {
  try {
    const token = await getAuthToken();
    const url = `https://accept.paymob.com/api/ecommerce/orders?merchant_order_id=${encodeURIComponent(merchantOrderId)}`;

    // Try Bearer token auth first, then legacy query-param auth
    let res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) {
      res = await fetch(`${url}&auth_token=${encodeURIComponent(token)}`);
    }
    if (!res.ok) {
      logger.warn({ merchantOrderId, status: res.status }, "queryTransactionByMerchantOrderId: all auth strategies failed");
      return null;
    }

    const body = await res.json() as {
      results?: Array<{ id: number; amount_cents?: number }>;
    };
    const orders = body.results ?? [];
    if (orders.length === 0) return null;

    for (const order of orders) {
      const txnUrl = `https://accept.paymob.com/api/acceptance/transactions?order_id=${order.id}`;
      let txnRes = await fetch(txnUrl, { headers: { "Authorization": `Bearer ${token}` } });
      if (!txnRes.ok) {
        txnRes = await fetch(`${txnUrl}&auth_token=${encodeURIComponent(token)}`);
      }
      if (!txnRes.ok) continue;

      const txnBody = await txnRes.json() as {
        results?: Array<{ id: number; success: boolean; pending: boolean; amount_cents?: number }>;
      };
      const resolved = (txnBody.results ?? []).find((t) => !t.pending);
      if (resolved) {
        return {
          success: resolved.success,
          txnId: String(resolved.id),
          amountCents: resolved.amount_cents ?? order.amount_cents ?? 0,
        };
      }
    }
    return null;
  } catch (err) {
    logger.warn({ err, merchantOrderId }, "queryTransactionByMerchantOrderId: error");
    return null;
  }
}

/**
 * Verifies a Paymob HMAC-SHA512 webhook signature.
 * Handles both v1 (top-level fields) and v2 (fields under `obj`) formats.
 */
export function verifyPaymobHmac(payload: Record<string, unknown>, signature: string): boolean {
  const config = getPaymobConfig();
  if (!config.hmacSecret) return false;

  const txn = (payload.obj && typeof payload.obj === "object")
    ? (payload.obj as Record<string, unknown>)
    : payload;

  const HMAC_FIELDS = [
    "amount_cents", "created_at", "currency", "error_occured",
    "has_parent_transaction", "id", "integration_id", "is_3d_secure",
    "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
    "is_voided", "order", "owner", "pending",
    "source_data.pan", "source_data.sub_type", "source_data.type", "success",
  ];

  const concatenated = HMAC_FIELDS.map((field) => {
    const parts = field.split(".");
    let val: unknown = txn;
    for (const part of parts) val = (val as Record<string, unknown>)?.[part];
    if (val === undefined || val === null || typeof val === "object") return "";
    return String(val);
  }).join("");

  const computed = crypto.createHmac("sha512", config.hmacSecret).update(concatenated).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Extracts the transaction object from a Paymob webhook payload.
 * Handles both v1 (top-level) and v2 (wrapped in `obj`) formats.
 */
export function extractWebhookTxn(payload: Record<string, unknown>): Record<string, unknown> {
  return (payload.obj && typeof payload.obj === "object")
    ? (payload.obj as Record<string, unknown>)
    : payload;
}
