import { getShopifyAdminToken } from "./integrations.js";
import { logger } from "./logger.js";

export interface DeliveredOrderProduct {
  name: string;
  slug: string;
  id: string;
}

export interface DeliveredOrder {
  shopifyOrderId: number;
  shopifyOrderNumber: number;
  customerEmail: string;
  customerName: string;
  customerId: string;
  deliveredAt: Date;
  products: DeliveredOrderProduct[];
}

interface ShopifyLineItem {
  id: number;
  title: string;
  product_id: number | null;
}

interface ShopifyFulfillment {
  id: number;
  shipment_status: string | null;
  updated_at: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string | null;
  customer?: { id?: number; first_name?: string; last_name?: string } | null;
  shipping_address?: { first_name?: string } | null;
  line_items?: ShopifyLineItem[];
  fulfillments?: ShopifyFulfillment[];
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchDeliveredOrders(): Promise<DeliveredOrder[]> {
  const token = await getShopifyAdminToken();
  if (!token) {
    logger.warn("shopifyDelivered: no Shopify admin token — skipping");
    return [];
  }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  if (!storeDomain) {
    logger.warn("shopifyDelivered: VITE_SHOPIFY_STORE_DOMAIN not set — skipping");
    return [];
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const url =
    `https://${storeDomain}/admin/api/2024-04/orders.json` +
    `?fulfillment_status=fulfilled&status=any&limit=250` +
    `&updated_at_min=${encodeURIComponent(thirtyDaysAgo)}` +
    `&fields=id,order_number,email,customer,shipping_address,line_items,fulfillments`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    logger.error({ err }, "shopifyDelivered: network error fetching orders");
    return [];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "shopifyDelivered: Shopify API error");
    return [];
  }

  const data = (await res.json()) as { orders: ShopifyOrder[] };
  const orders = data.orders ?? [];
  logger.info({ count: orders.length }, "shopifyDelivered: fetched fulfilled orders");

  const result: DeliveredOrder[] = [];

  for (const order of orders) {
    const email = order.email;
    if (!email) continue;

    const deliveredFulfillment = (order.fulfillments ?? []).find(
      (f) => f.shipment_status === "delivered"
    );
    if (!deliveredFulfillment) continue;

    const products: DeliveredOrderProduct[] = (order.line_items ?? []).map((item) => ({
      name: item.title,
      slug: titleToSlug(item.title),
      id: String(item.product_id ?? item.id),
    }));

    result.push({
      shopifyOrderId: order.id,
      shopifyOrderNumber: order.order_number,
      customerEmail: email,
      customerName:
        order.customer?.first_name ||
        order.shipping_address?.first_name ||
        "",
      customerId: order.customer?.id ? String(order.customer.id) : "",
      deliveredAt: new Date(deliveredFulfillment.updated_at),
      products,
    });
  }

  logger.info({ count: result.length }, "shopifyDelivered: delivered orders found");
  return result;
}
