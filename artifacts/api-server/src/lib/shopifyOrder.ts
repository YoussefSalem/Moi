import { getShopifyAdminToken, setShopifyOrderReferrer } from "./integrations";

const EGYPT_PROVINCE_CODES: Record<string, string> = {
  "Cairo": "C",
  "Giza": "GZ",
  "Alexandria": "ALX",
  "Dakahlia": "DK",
  "Red Sea": "BA",
  "Beheira": "BH",
  "Fayoum": "FYM",
  "Gharbia": "GH",
  "Ismailia": "IS",
  "Menofia": "MNF",
  "Minya": "MN",
  "Qaliubiya": "KB",
  "New Valley": "WAD",
  "Suez": "SUZ",
  "Aswan": "ASN",
  "Assiut": "AST",
  "Beni Suef": "BS",
  "Port Said": "PTS",
  "Damietta": "DT",
  "Sharkia": "SHR",
  "South Sinai": "JS",
  "Kafr El Sheikh": "KFS",
  "Matrouh": "MT",
  "Luxor": "LX",
  "Qena": "KN",
  "North Sinai": "SIN",
  "Sohag": "SHG",
  "Ain Sokhna": "SUZ",
};

export interface OrderLine {
  variantId: string;
  quantity: number;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address: string;
  governorate: string;
  postalCode?: string;
  city: string;
}

export interface OrderAttribution {
  /** Marketing source name for Shopify channel attribution (e.g. 'pos', 'web', 'facebook', 'instagram') */
  sourceName?: string;
  /** Full referring URL (e.g. https://www.facebook.com/) */
  referringSite?: string;
  /** Full landing page URL with UTM params */
  landingSite?: string;
  /** UTM parameters from the session */
  utm?: Record<string, string>;
  /** Meta click ID */
  fbclid?: string;
  /** Google click ID */
  gclid?: string;
  /** TikTok click ID */
  ttclid?: string;
}

export interface StorefrontCartResult {
  subtotalAmount: number;
  totalAmount: number;
  discountCodes: { code: string; applicable: boolean }[];
}

export function extractVariantId(gid: string): number {
  const parts = gid.split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  if (isNaN(id)) throw new Error(`Invalid variant GID: ${gid}`);
  return id;
}

export async function fetchStorefrontCart(
  cartId: string,
): Promise<StorefrontCartResult | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const storefrontToken = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;
  if (!storeDomain || !storefrontToken) return null;

  const query = `
    query GetCartCost($cartId: ID!) {
      cart(id: $cartId) {
        cost {
          subtotalAmount { amount }
          totalAmount { amount }
        }
        discountCodes {
          code
          applicable
        }
      }
    }
  `;

  try {
    const res = await fetch(
      `https://${storeDomain}/api/2024-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": storefrontToken,
        },
        body: JSON.stringify({ query, variables: { cartId } }),
      },
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      data?: {
        cart?: {
          cost: {
            subtotalAmount: { amount: string };
            totalAmount: { amount: string };
          };
          discountCodes: { code: string; applicable: boolean }[];
        };
      };
    };

    const cart = data?.data?.cart;
    if (!cart) return null;

    return {
      subtotalAmount: parseFloat(cart.cost.subtotalAmount.amount),
      totalAmount: parseFloat(cart.cost.totalAmount.amount),
      discountCodes: cart.discountCodes,
    };
  } catch {
    return null;
  }
}

export interface ShopifyLineItem {
  title: string;
  variant_title: string | null;
  quantity: number;
  price: string;
}

export async function completeShopifyDraftOrder(draftOrderId: number): Promise<{ orderId: number; orderNumber: number; total: string; lineItems: ShopifyLineItem[] } | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return null;

  // Read the draft first so we can recover attribution stored as a note_attribute
  let draftAttr: { referringSite?: string; landingSite?: string } | undefined;
  try {
    const draftRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}.json?fields=note_attributes`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (draftRes.ok) {
      const draftData = await draftRes.json() as {
        draft_order?: { note_attributes?: Array<{ name: string; value: string }> };
      };
      const raw = draftData.draft_order?.note_attributes?.find((n) => n.name === "__attribution")?.value;
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        draftAttr = {
          ...(typeof parsed.referringSite === "string" ? { referringSite: parsed.referringSite } : {}),
          ...(typeof parsed.landingSite === "string" ? { landingSite: parsed.landingSite } : {}),
        };
      }
    }
  } catch { /* ignore */ }

  const completeRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}/complete.json?payment_pending=true&send_receipt=false&send_fulfillment_receipt=false`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
    },
  );

  if (!completeRes.ok) return null;

  const completeData = await completeRes.json() as {
    draft_order: { order_id: number; total_price: string };
  };
  const orderId = completeData.draft_order.order_id;
  const total = completeData.draft_order.total_price;

  const orderRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=order_number,line_items`,
    { headers: { "X-Shopify-Access-Token": adminToken } },
  );

  let orderNumber = orderId;
  let fetchedLineItems: ShopifyLineItem[] = [];
  if (orderRes.ok) {
    const orderData = await orderRes.json() as {
      order: { order_number: number; line_items: unknown[] };
    };
    orderNumber = orderData.order.order_number ?? orderId;
    fetchedLineItems = (orderData.order.line_items ?? []) as unknown as ShopifyLineItem[];
  }

  // Re-apply referring_site / landing_site because Shopify strips them during API completion
  if (draftAttr) {
    void setShopifyOrderReferrer(orderId, draftAttr);
  }

  return { orderId, orderNumber, total, lineItems: fetchedLineItems };
}

export async function createDraftOrder(params: {
  lines: OrderLine[];
  customer: CustomerInfo;
  paymentMethod: "cod" | "instapay" | "card";
  cartId?: string;
  discountCode?: string;
  extraTags?: string;
  complete?: boolean;
  /** Marketing attribution to pass to Shopify for channel/sales source reporting */
  attribution?: OrderAttribution;
}): Promise<{ orderNumber: number; orderId: number; total: string; lineItems: ShopifyLineItem[]; draftOrderId?: number }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) throw new Error("Shopify Admin API not configured");

  const lineItems = params.lines.map((l) => ({
    variant_id: extractVariantId(l.variantId),
    quantity: l.quantity,
  }));

  const baseTags =
    params.paymentMethod === "cod"
      ? "cod,moi-checkout"
      : params.paymentMethod === "card"
      ? "paymob,moi-checkout"
      : "instapay,moi-checkout";
  const tags = params.extraTags ? `${baseTags},${params.extraTags}` : baseTags;

  const noteText =
    params.paymentMethod === "cod"
      ? "Cash on Delivery"
      : params.paymentMethod === "card"
      ? "Credit/Debit Card"
      : "Instapay Transfer";

  // Determine shipping based on cart total: free over 2,000 EGP
  let shippingPrice = "50.00";
  let shippingTitle = "Standard Delivery";

  if (params.cartId) {
    const cart = await fetchStorefrontCart(params.cartId);
    if (cart) {
      if (cart.totalAmount >= 2000) {
        shippingPrice = "0.00";
        shippingTitle = "Free Delivery";
      }
    }
  }

  const draftPayload: Record<string, unknown> = {
    suppress_notifications: true,
    line_items: lineItems,
    shipping_address: {
      first_name: params.customer.firstName,
      last_name: params.customer.lastName,
      email: params.customer.email,
      phone: params.customer.phone,
      address1: params.customer.address,
      address2: params.customer.governorate,
      city: params.customer.city,
      province: EGYPT_PROVINCE_CODES[params.customer.governorate] ?? params.customer.governorate,
      zip: params.customer.postalCode ?? "",
      country: "Egypt",
      country_code: "EG",
    },
    shipping_line: {
      price: shippingPrice,
      title: shippingTitle,
      custom: true,
    },
    tags,
    note: `Payment: ${noteText}`,
    note_attributes: [
      { name: "payment_method", value: params.paymentMethod },
      { name: "customer_phone", value: params.customer.phone },
      { name: "governorate", value: params.customer.governorate },
      ...(params.customer.postalCode ? [{ name: "postal_code", value: params.customer.postalCode }] : []),
    ],
  };

  if (params.customer.email) draftPayload.email = params.customer.email;

  // Marketing attribution -- critical for "Referring channel" reporting in Shopify Analytics
  if (params.attribution) {
    const attr = params.attribution;
    // source_name maps to Shopify's channel attribution (facebook, instagram, web, etc.)
    if (attr.sourceName) draftPayload.source_name = attr.sourceName;
    // referring_site is the full referrer URL
    if (attr.referringSite) draftPayload.referring_site = attr.referringSite;
    // landing_site is the full URL the customer first landed on
    if (attr.landingSite) draftPayload.landing_site = attr.landingSite;
    // Add UTM params as note_attributes for internal reference
    if (attr.utm && Object.keys(attr.utm).length > 0) {
      const utmAttrs = Object.entries(attr.utm).map(([k, v]) => ({
        name: `utm_${k}`,
        value: v,
      }));
      (draftPayload.note_attributes as unknown[]).push(...utmAttrs);
    }
    if (attr.fbclid) {
      (draftPayload.note_attributes as unknown[]).push({ name: "fbclid", value: attr.fbclid });
    }
    if (attr.gclid) {
      (draftPayload.note_attributes as unknown[]).push({ name: "gclid", value: attr.gclid });
    }
    if (attr.ttclid) {
      (draftPayload.note_attributes as unknown[]).push({ name: "ttclid", value: attr.ttclid });
    }
    // Persist full attribution on the draft so it survives the later completion step
    // (Shopify strips referring_site / landing_site when completing via API).
    (draftPayload.note_attributes as unknown[]).push({
      name: "__attribution",
      value: JSON.stringify({
        sourceName: attr.sourceName,
        referringSite: attr.referringSite,
        landingSite: attr.landingSite,
      }),
    });
  }

  if (params.cartId) {
    const cart = await fetchStorefrontCart(params.cartId);
    if (cart) {
      const applicableCode = cart.discountCodes.find((d) => d.applicable);
      const discountAmount = cart.subtotalAmount - cart.totalAmount;

      if (applicableCode && discountAmount > 0) {
        draftPayload.applied_discount = {
          title: applicableCode.code,
          value_type: "fixed_amount",
          value: discountAmount.toFixed(2),
        };
      } else if (params.discountCode && cart.discountCodes.length > 0) {
        throw new Error(
          `Discount code "${params.discountCode}" is not applicable to this order.`,
        );
      }
    }
  }

  const createRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ draft_order: draftPayload }),
    },
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Shopify draft order failed (${createRes.status}): ${text}`);
  }

  const createData = await createRes.json() as {
    draft_order: { id: number; total_price: string };
  };
  const draftId = createData.draft_order.id;
  const draftTotal = createData.draft_order.total_price;

  // For instapay we return early with the draft ID — order is only completed when proof is submitted
  if (params.complete === false) {
    return { orderNumber: draftId, orderId: draftId, total: draftTotal, lineItems: [], draftOrderId: draftId };
  }

  const completeRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftId}/complete.json?payment_pending=true&send_receipt=false&send_fulfillment_receipt=false`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
    },
  );

  if (!completeRes.ok) {
    const text = await completeRes.text();
    throw new Error(`Shopify draft order completion failed (${completeRes.status}): ${text}`);
  }

  const completeData = await completeRes.json() as {
    draft_order: { order_id: number; total_price: string };
  };
  const orderId = completeData.draft_order.order_id;
  const total = completeData.draft_order.total_price;

  const orderRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=order_number,line_items`,
    { headers: { "X-Shopify-Access-Token": adminToken } },
  );

  let orderNumber = orderId;
  let fetchedLineItems: ShopifyLineItem[] = [];
  if (orderRes.ok) {
    const orderData = await orderRes.json() as {
      order: { order_number: number; line_items: unknown[] };
    };
    orderNumber = orderData.order.order_number ?? orderId;
    fetchedLineItems = (orderData.order.line_items ?? []) as unknown as ShopifyLineItem[];
  }

  // Re-apply referrer fields because Shopify strips them during API completion
  const attr = params.attribution;
  if (attr && (attr.referringSite || attr.landingSite)) {
    void setShopifyOrderReferrer(orderId, {
      referringSite: attr.referringSite,
      landingSite: attr.landingSite,
    });
  }

  return { orderNumber, orderId, total, lineItems: fetchedLineItems };
}
