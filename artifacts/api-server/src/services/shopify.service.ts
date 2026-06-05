/**
 * shopify.service.ts
 *
 * Shopify Admin API interactions for custom headless checkout.
 * Uses axios with retry logic. No Express types — pure service layer.
 *
 * Architecture: Shopify is used for order management only.
 * Payment is handled entirely by Paymob; Shopify payment transaction APIs are NOT used.
 */
import axios from "axios";
import { withRetry } from "../utils/retry";
import { logger } from "../lib/logger";
import { getShopifyAdminToken } from "../lib/integrations";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartLineItem {
  /** Shopify variant GID: "gid://shopify/ProductVariant/12345" */
  variantId: string;
  quantity: number;
  /** Unit price in EGP (string, e.g. "1690.00") */
  price?: string;
  title?: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
}

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
}

export interface CheckoutParams {
  lineItems: CartLineItem[];
  customer: CustomerDetails;
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  totalAmount: number;
  currency?: string;
  paymentGateway?: string;
  transactionId?: string;
  specialReference?: string;
  tags?: string[];
  note?: string;
  noteAttributes?: Array<{ name: string; value: string }>;
}

export interface OrderResult {
  orderId: number;
  orderNumber: number;
  total: string;
  financialStatus: string;
  lineItems: ShopifyLineItem[];
}

export interface ShopifyLineItem {
  title: string;
  variant_title: string | null;
  quantity: number;
  price: string;
}

export interface DraftOrderResult {
  draftOrderId: number;
  total: string;
  lineItems: ShopifyLineItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractVariantNumericId(gid: string): number {
  const parts = gid.split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  if (isNaN(id)) throw new Error(`Invalid variant GID: ${gid}`);
  return id;
}

async function getAdminCredentials(): Promise<{ storeDomain: string; adminToken: string }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN ?? "";
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) {
    throw new Error("Shopify Admin API not configured (missing VITE_SHOPIFY_STORE_DOMAIN or admin token)");
  }
  return { storeDomain, adminToken };
}

// ─── Create a confirmed Shopify order (payment success = true) ─────────────

/**
 * Creates a Shopify order directly via Admin REST API with financial_status = "paid".
 * Used when Paymob confirms a successful payment.
 */
export async function createPaidOrder(params: CheckoutParams): Promise<OrderResult> {
  const { storeDomain, adminToken } = await getAdminCredentials();

  const lineItems = params.lineItems.map((l) => ({
    variant_id: extractVariantNumericId(l.variantId),
    quantity: l.quantity,
    ...(l.price ? { price: l.price } : {}),
    ...(l.title ? { title: l.title } : {}),
  }));

  const shippingAddress = {
    first_name: params.shippingAddress.firstName,
    last_name: params.shippingAddress.lastName,
    address1: params.shippingAddress.address1,
    city: params.shippingAddress.city,
    province: params.shippingAddress.province,
    country: params.shippingAddress.country,
    zip: params.shippingAddress.zip,
    phone: params.shippingAddress.phone,
  };

  const tags = ["paymob", "paid", ...(params.tags ?? [])].join(", ");

  const noteAttributes = [
    ...(params.noteAttributes ?? []),
    ...(params.transactionId ? [{ name: "paymob_transaction_id", value: params.transactionId }] : []),
    { name: "payment_gateway", value: params.paymentGateway ?? "paymob" },
    { name: "payment_metadata", value: JSON.stringify({ transactionId: params.transactionId }) },
  ];

  const orderPayload = {
    order: {
      line_items: lineItems,
      customer: {
        first_name: params.customer.firstName,
        last_name: params.customer.lastName,
        email: params.customer.email,
        phone: params.customer.phone,
      },
      shipping_address: shippingAddress,
      billing_address: params.billingAddress
        ? {
            first_name: params.billingAddress.firstName,
            last_name: params.billingAddress.lastName,
            address1: params.billingAddress.address1,
            city: params.billingAddress.city,
            province: params.billingAddress.province,
            country: params.billingAddress.country,
            zip: params.billingAddress.zip,
            phone: params.billingAddress.phone,
          }
        : shippingAddress,
      financial_status: "paid",
      gateway: params.paymentGateway ?? "paymob",
      payment_gateway_names: [params.paymentGateway ?? "paymob"],
      tags,
      note: params.note ?? `Paymob Transaction ID: ${params.transactionId ?? "N/A"}`,
      note_attributes: noteAttributes,
      send_receipt: true,
    },
  };

  logger.info(
    { specialReference: params.specialReference, totalAmount: params.totalAmount },
    "shopify.service: creating paid order",
  );

  const res = await withRetry(
    () =>
      axios.post<{
        order: {
          id: number;
          order_number: number;
          total_price: string;
          financial_status: string;
          line_items: ShopifyLineItem[];
        };
      }>(
        `https://${storeDomain}/admin/api/2024-04/orders.json`,
        orderPayload,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": adminToken,
          },
        },
      ),
    { attempts: 3, delayMs: 1000, label: "shopify.createPaidOrder" },
  );

  const order = res.data.order;
  logger.info(
    { orderId: order.id, orderNumber: order.order_number },
    "shopify.service: paid order created",
  );

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    total: order.total_price,
    financialStatus: order.financial_status,
    lineItems: order.line_items,
  };
}

// ─── Create a Shopify draft order (payment success = false) ────────────────

/**
 * Creates a Shopify Draft Order when payment fails.
 * Tagged as "payment_failed", preserving cart and customer details.
 */
export async function createFailedPaymentDraft(
  params: CheckoutParams,
): Promise<DraftOrderResult> {
  const { storeDomain, adminToken } = await getAdminCredentials();

  const lineItems = params.lineItems.map((l) => ({
    variant_id: extractVariantNumericId(l.variantId),
    quantity: l.quantity,
  }));

  const shippingAddress = {
    first_name: params.shippingAddress.firstName,
    last_name: params.shippingAddress.lastName,
    address1: params.shippingAddress.address1,
    city: params.shippingAddress.city,
    province: params.shippingAddress.province,
    country: params.shippingAddress.country,
    zip: params.shippingAddress.zip,
    phone: params.shippingAddress.phone,
  };

  const noteAttributes = [
    ...(params.noteAttributes ?? []),
    ...(params.transactionId ? [{ name: "paymob_transaction_id", value: params.transactionId }] : []),
    { name: "payment_gateway", value: params.paymentGateway ?? "paymob" },
    { name: "failure_reason", value: "payment_failed" },
  ];

  const draftPayload = {
    draft_order: {
      line_items: lineItems,
      customer: {
        first_name: params.customer.firstName,
        last_name: params.customer.lastName,
        email: params.customer.email,
        phone: params.customer.phone,
      },
      shipping_address: shippingAddress,
      tags: ["payment_failed", ...(params.tags ?? [])].join(", "),
      note: `Payment failed — Paymob Transaction: ${params.transactionId ?? "N/A"}`,
      note_attributes: noteAttributes,
      send_invoice: false,
    },
  };

  logger.info(
    { specialReference: params.specialReference, totalAmount: params.totalAmount },
    "shopify.service: creating failed-payment draft order",
  );

  const res = await withRetry(
    () =>
      axios.post<{
        draft_order: {
          id: number;
          total_price: string;
          line_items: ShopifyLineItem[];
        };
      }>(
        `https://${storeDomain}/admin/api/2024-04/draft_orders.json`,
        draftPayload,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": adminToken,
          },
        },
      ),
    { attempts: 3, delayMs: 1000, label: "shopify.createFailedPaymentDraft" },
  );

  const draft = res.data.draft_order;
  logger.info(
    { draftOrderId: draft.id },
    "shopify.service: failed-payment draft order created",
  );

  return {
    draftOrderId: draft.id,
    total: draft.total_price,
    lineItems: draft.line_items,
  };
}

// ─── Stock validation ─────────────────────────────────────────────────────────

export async function validateStock(
  lineItems: CartLineItem[],
): Promise<{ ok: true } | { ok: false; unavailableVariantIds: string[] }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const storefrontToken = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

  if (!storeDomain || !storefrontToken) {
    logger.warn("shopify.service: validateStock — Shopify Storefront not configured, skipping");
    return { ok: true };
  }

  const uniqueIds = [...new Set(lineItems.map((l) => l.variantId))];
  const unavailable: string[] = [];
  const endpoint = `https://${storeDomain}/api/2024-04/graphql.json`;

  for (const variantId of uniqueIds) {
    try {
      const res = await axios.post<{
        data?: { node?: { id: string; availableForSale: boolean } };
        errors?: { message: string }[];
      }>(
        endpoint,
        {
          query: `query CheckVariant($id: ID!) { node(id: $id) { ... on ProductVariant { id availableForSale } } }`,
          variables: { id: variantId },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": storefrontToken,
          },
        },
      );
      const available = res.data?.data?.node?.availableForSale ?? true;
      if (!available) unavailable.push(variantId);
    } catch {
      // fail open per variant
    }
  }

  return unavailable.length > 0 ? { ok: false, unavailableVariantIds: unavailable } : { ok: true };
}
