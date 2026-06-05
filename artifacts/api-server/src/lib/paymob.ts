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

export interface PaymobBillingData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Maps Paymob billing_data (from Apple Pay shippingContact) to our CustomerInfo shape.
 * Falls back to "NA" placeholders for missing required fields.
 */
export function mapPaymobBillingToCustomer(billing: PaymobBillingData): {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
} {
  const email = billing.email?.trim();
  return {
    firstName: billing.first_name?.trim() || "NA",
    lastName: billing.last_name?.trim() || "NA",
    email: email && email !== "NA" ? email : undefined,
    phone: billing.phone_number?.trim() || "NA",
    address: billing.street?.trim() || "NA",
    city: billing.city?.trim() || "Cairo",
    governorate: billing.state?.trim() || "NA",
  };
}

export interface CreatePaymentKeyParams {
  amountCents: number;
  merchantOrderId: string;
  customer: PaymobCustomer;
  callbackUrl?: string;
  redirectionUrl?: string;
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
  if (params.redirectionUrl) {
    pkBody["redirection_url"] = params.redirectionUrl;
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
 * Paymob Unified Checkout / Intentions API flow (v1).
 * Uses Secret Key Bearer auth — works with live Paymob accounts that no longer
 * support the legacy API Key 3-step flow.
 *
 * 1. POST /v1/intention/ → client_secret
 * 2. Embed: accept.paymob.com/unifiedcheckout/?publicKey=…&clientSecret=…
 */
export async function createPaymobIntentionKey(
  params: CreatePaymentKeyParams,
): Promise<PaymobPaymentKeyResult> {
  const config = getPaymobConfig();
  if (!config.secretKey) throw new Error("Paymob secret key is not configured");
  if (!config.publicKey) throw new Error("Paymob public key is not configured");
  if (!config.integrationId) throw new Error("Paymob integration ID is not configured");

  const integrationIdNum = parseInt(config.integrationId, 10);

  const body: Record<string, unknown> = {
    amount: params.amountCents,
    currency: "EGP",
    payment_methods: [integrationIdNum],
    items: [
      {
        name: "Moi Order",
        amount: params.amountCents,
        description: "Fashion order",
        quantity: 1,
      },
    ],
    billing_data: {
      first_name: params.customer.firstName || "NA",
      last_name: params.customer.lastName || "NA",
      email: params.customer.email || "NA",
      phone_number: params.customer.phone || "NA",
      street: params.customer.address || "NA",
      city: params.customer.city || "Cairo",
      state: "NA",
      country: "EG",
      postal_code: "NA",
      apartment: "NA",
      floor: "NA",
      building: "NA",
    },
    customer: {
      first_name: params.customer.firstName || "NA",
      last_name: params.customer.lastName || "NA",
      email: params.customer.email || "NA",
    },
    merchant_order_ext_ref: params.merchantOrderId,
  };

  if (params.callbackUrl) body["notification_url"] = params.callbackUrl;
  if (params.redirectionUrl) body["redirection_url"] = params.redirectionUrl;

  const intentRes = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.secretKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!intentRes.ok) {
    const text = await intentRes.text();
    logger.error({ status: intentRes.status, text }, "Paymob intention creation failed");
    throw new Error(`Paymob intention error (${intentRes.status}): ${text}`);
  }

  const data = await intentRes.json() as { client_secret?: string };
  const clientSecret = data.client_secret;
  if (!clientSecret) throw new Error("Paymob intention returned no client_secret");

  logger.info({ merchantOrderId: params.merchantOrderId }, "Paymob intention created");

  const iframeUrl =
    `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(config.publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;

  return { iframeUrl };
}

/**
 * Creates a Paymob legacy payment key specifically for the Apple Pay direct flow.
 * Uses the configured Apple Pay integration ID (falls back to card integration ID).
 * Returns the raw payment token used in POST /api/acceptance/payments/pay.
 */
export async function createApplePayPaymentKeyRaw(params: {
  amountCents: number;
  merchantOrderId: string;
}): Promise<{ paymentToken: string }> {
  const config = getPaymobConfig();
  if (!config.apiKey) throw new Error("Paymob API key is not configured");

  const integrationIdNum = parseInt(config.integrationId, 10);

  // Step 1: Auth
  const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey }),
  });
  if (!authRes.ok) {
    const text = await authRes.text();
    throw new Error(`Paymob auth error (${authRes.status}): ${text}`);
  }
  const authData = await authRes.json() as { token?: string };
  const authToken = authData.token;
  if (!authToken) throw new Error("Paymob auth returned no token");

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
      items: [{ name: "Moi Order", amount_cents: params.amountCents, description: "Fashion order", quantity: 1 }],
    }),
  });
  if (!orderRes.ok) {
    const text = await orderRes.text();
    throw new Error(`Paymob order error (${orderRes.status}): ${text}`);
  }
  const orderData = await orderRes.json() as { id?: number };
  const paymobOrderId = orderData.id;
  if (!paymobOrderId) throw new Error("Paymob order registration returned no ID");

  // Step 3: Payment Key with Apple Pay integration ID
  const pkRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: params.amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        first_name: "Apple",
        last_name: "Pay",
        email: "NA",
        phone_number: "NA",
        street: "NA",
        city: "Cairo",
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
    }),
  });
  if (!pkRes.ok) {
    const text = await pkRes.text();
    throw new Error(`Paymob Apple Pay payment key error (${pkRes.status}): ${text}`);
  }
  const pkData = await pkRes.json() as { token?: string };
  const paymentToken = pkData.token;
  if (!paymentToken) throw new Error("Paymob Apple Pay payment key returned no token");

  logger.info({ hasToken: true, integrationId: integrationIdNum }, "Paymob Apple Pay payment key obtained");
  return { paymentToken };
}

// In-process auth token cache — avoids re-authenticating on every status poll.
let _cachedAuthToken: { token: string; expiresAt: number } | null = null;

async function getPaymobAuthToken(apiKey: string): Promise<string> {
  if (_cachedAuthToken && Date.now() < _cachedAuthToken.expiresAt) {
    return _cachedAuthToken.token;
  }
  const res = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`);
  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error("Paymob auth: no token returned");
  // Paymob auth tokens are valid for 1 hour; cache for 50 minutes.
  _cachedAuthToken = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}

/**
 * Directly queries Paymob for the latest completed transaction on an order
 * identified by our internal merchantOrderId. Used as a fallback when the
 * server-to-server webhook has not arrived (e.g. network issues or config
 * mismatch). Returns null if no completed transaction is found or on any error.
 *
 * Tries Bearer token auth (newer Paymob API style) first; falls back to the
 * legacy auth_token query-parameter style if the Bearer approach fails.
 */
export async function queryPaymobByMerchantOrderId(merchantOrderId: string): Promise<{
  success: boolean;
  txnId: string;
  amountCents: number;
  billingData?: PaymobBillingData;
  sourceDataSubType?: string;
} | null> {
  const config = getPaymobConfig();
  if (!config.apiKey) return null;
  try {
    const token = await getPaymobAuthToken(config.apiKey);
    const url = `https://accept.paymob.com/api/ecommerce/orders?merchant_order_id=${encodeURIComponent(merchantOrderId)}`;

    // Attempt 1: Bearer auth in Authorization header (newer Paymob API).
    // Attempt 2: auth_token as query param (legacy).
    // Attempt 3: Bearer using secret key directly (Paymob Intentions API style).
    const attempts: Array<() => Promise<Response>> = [
      () => fetch(url, { headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } }),
      () => fetch(`${url}&auth_token=${encodeURIComponent(token)}`, { headers: { "Content-Type": "application/json" } }),
      ...(config.secretKey ? [() => fetch(url, { headers: { "Authorization": `Bearer ${config.secretKey}`, "Content-Type": "application/json" } })] : []),
    ];

    let res: Response | null = null;
    for (const attempt of attempts) {
      const r = await attempt();
      if (r.ok) { res = r; break; }
      const text = await r.text().catch(() => "");
      logger.warn({ status: r.status, text, merchantOrderId }, "queryPaymobByMerchantOrderId: attempt failed, trying next auth strategy");
    }

    if (!res) {
      logger.warn({ merchantOrderId }, "queryPaymobByMerchantOrderId: all auth strategies failed");
      return null;
    }

    const body = await res.json() as {
      results?: Array<{
        id: number;
        amount_cents?: number;
        transactions?: Array<{ id: number; success: boolean; pending: boolean; amount_cents?: number }>;
      }>;
    };
    const orders = body.results ?? [];
    logger.info({ merchantOrderId, orderCount: orders.length }, "queryPaymobByMerchantOrderId: orders found");
    if (orders.length === 0) return null;

    // Paymob's paginated orders list API does NOT embed transactions — the
    // `transactions` array is always empty in the list response. We must
    // separately query each order's transactions via the transactions endpoint.
    for (const order of orders) {
      const inlineCount = (order.transactions ?? []).length;
      logger.info({ orderId: order.id, inlineTxnCount: inlineCount }, "queryPaymobByMerchantOrderId: checking order (will fetch transactions separately)");

      // Fetch transactions for this order using the acceptance/transactions endpoint.
      // Try same 3 auth strategies.
      const txnUrl = `https://accept.paymob.com/api/acceptance/transactions?order_id=${order.id}`;
      const txnAttempts: Array<() => Promise<Response>> = [
        () => fetch(txnUrl, { headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } }),
        () => fetch(`${txnUrl}&auth_token=${encodeURIComponent(token)}`, { headers: { "Content-Type": "application/json" } }),
        ...(config.secretKey ? [() => fetch(txnUrl, { headers: { "Authorization": `Bearer ${config.secretKey}`, "Content-Type": "application/json" } })] : []),
      ];

      let txnRes: Response | null = null;
      for (const attempt of txnAttempts) {
        const r = await attempt();
        if (r.ok) { txnRes = r; break; }
        const text = await r.text().catch(() => "");
        logger.warn({ status: r.status, text, orderId: order.id }, "queryPaymobByMerchantOrderId: txn fetch attempt failed, trying next auth strategy");
      }

      if (!txnRes) {
        logger.warn({ orderId: order.id }, "queryPaymobByMerchantOrderId: all auth strategies failed for transactions endpoint");
        continue;
      }

      const txnBody = await txnRes.json() as {
        results?: Array<{
          id: number;
          success: boolean;
          pending: boolean;
          amount_cents?: number;
          billing_data?: PaymobBillingData;
          source_data?: { type?: string; sub_type?: string };
        }>;
      };
      const txns = txnBody.results ?? [];
      logger.info({ orderId: order.id, txnCount: txns.length }, "queryPaymobByMerchantOrderId: transactions fetched");

      const resolved = txns.find((t) => !t.pending);
      if (resolved) {
        logger.info({ txnId: resolved.id, success: resolved.success, orderId: order.id }, "queryPaymobByMerchantOrderId: resolved transaction found");
        return {
          success: resolved.success,
          txnId: String(resolved.id),
          amountCents: resolved.amount_cents ?? order.amount_cents ?? 0,
          billingData: resolved.billing_data,
          sourceDataSubType: resolved.source_data?.sub_type,
        };
      }
    }
    logger.info({ merchantOrderId }, "queryPaymobByMerchantOrderId: no resolved transaction yet");
    return null;
  } catch (err) {
    logger.warn({ err, merchantOrderId }, "queryPaymobByMerchantOrderId: unexpected error");
    return null;
  }
}

/**
 * Fetches a specific Paymob transaction by its numeric ID and verifies it
 * belongs to the given merchantOrderId. Used by paymob-sync as an alternative
 * to the order-level query when the client provides a txnId from the relay page.
 *
 * Returns null on any error or if the transaction does not match.
 */
export async function verifyPaymobTransactionById(txnId: string, expectedMerchantOrderId: string): Promise<{
  success: boolean;
  txnId: string;
  amountCents: number;
  billingData?: PaymobBillingData;
  sourceDataSubType?: string;
} | null> {
  const config = getPaymobConfig();
  if (!config.apiKey) return null;
  const numericId = parseInt(txnId, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  try {
    const token = await getPaymobAuthToken(config.apiKey);
    const url = `https://accept.paymob.com/api/acceptance/transactions/${numericId}`;

    const attempts: Array<() => Promise<Response>> = [
      () => fetch(url, { headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } }),
      () => fetch(`${url}?auth_token=${encodeURIComponent(token)}`, { headers: { "Content-Type": "application/json" } }),
      ...(config.secretKey ? [() => fetch(url, { headers: { "Authorization": `Bearer ${config.secretKey}`, "Content-Type": "application/json" } })] : []),
    ];

    let res: Response | null = null;
    for (const attempt of attempts) {
      const r = await attempt();
      if (r.ok) { res = r; break; }
      const text = await r.text().catch(() => "");
      logger.warn({ status: r.status, text, txnId }, "verifyPaymobTransactionById: attempt failed, trying next auth strategy");
    }

    if (!res) {
      logger.warn({ txnId, expectedMerchantOrderId }, "verifyPaymobTransactionById: all auth strategies failed");
      return null;
    }

    const txn = await res.json() as {
      id?: number;
      success?: boolean;
      pending?: boolean;
      amount_cents?: number;
      order?: { merchant_order_id?: string; amount_cents?: number };
      billing_data?: PaymobBillingData;
      source_data?: { type?: string; sub_type?: string };
    };

    // Verify this transaction belongs to our intent
    const actualMerchantOrderId = txn.order?.merchant_order_id;
    if (actualMerchantOrderId !== expectedMerchantOrderId) {
      logger.warn(
        { txnId, expectedMerchantOrderId, actualMerchantOrderId },
        "verifyPaymobTransactionById: merchant_order_id mismatch — rejecting",
      );
      return null;
    }

    if (txn.pending) {
      logger.info({ txnId, expectedMerchantOrderId }, "verifyPaymobTransactionById: transaction still pending");
      return null;
    }

    return {
      success: txn.success === true,
      txnId: String(txn.id ?? numericId),
      amountCents: txn.amount_cents ?? txn.order?.amount_cents ?? 0,
      billingData: txn.billing_data,
      sourceDataSubType: txn.source_data?.sub_type,
    };
  } catch (err) {
    logger.warn({ err, txnId, expectedMerchantOrderId }, "verifyPaymobTransactionById: unexpected error");
    return null;
  }
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
