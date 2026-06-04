import { getShopifyAdminToken, setShopifyOrderReferrer } from "./integrations";
import { countDiscountCodeUses, insertDiscountCodeUse } from "@workspace/db";
import { logger } from "./logger";

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
  discountAmount: number;
  discountCodes: { code: string; applicable: boolean }[];
}

export function extractVariantId(gid: string): number {
  const parts = gid.split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  if (isNaN(id)) throw new Error(`Invalid variant GID: ${gid}`);
  return id;
}

/**
 * Batch-check whether all requested variants are available for sale via the
 * Shopify Storefront GraphQL API. Returns a list of unavailable variant GIDs.
 *
 * This is the backend enforcement layer for stock — the frontend already blocks
 * adding out-of-stock items to cart, but this prevents abuse (malicious / stale
 * cart requests, race conditions, etc.).
 */
export async function validateStockAvailability(
  lines: OrderLine[],
): Promise<{ ok: true } | { ok: false; unavailableVariantIds: string[] }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const storefrontToken = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;
  if (!storeDomain || !storefrontToken) {
    // If Shopify is not configured, we cannot validate — fail open (log loudly).
    logger.warn("validateStockAvailability: Shopify not configured — skipping stock check");
    return { ok: true };
  }

  const uniqueVariantIds = [...new Set(lines.map((l) => l.variantId))];
  const unavailable: string[] = [];

  const endpoint = `https://${storeDomain}/api/2024-04/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Storefront-Access-Token": storefrontToken,
  };

  for (const variantId of uniqueVariantIds) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `
            query CheckVariant($id: ID!) {
              node(id: $id) {
                ... on ProductVariant {
                  id
                  availableForSale
                }
              }
            }
          `,
          variables: { id: variantId },
        }),
      });
      if (!res.ok) {
        logger.warn({ variantId, status: res.status }, "validateStockAvailability: Storefront API error");
        continue; // fail open for individual variant errors
      }
      const json = await res.json() as {
        data?: { node?: { id: string; availableForSale: boolean } };
        errors?: { message: string }[];
      };
      if (json.errors?.length) {
        logger.warn({ variantId, errors: json.errors }, "validateStockAvailability: GraphQL errors");
        continue;
      }
      const available = json.data?.node?.availableForSale ?? true;
      if (!available) {
        unavailable.push(variantId);
      }
    } catch (err) {
      logger.warn({ err, variantId }, "validateStockAvailability: network error checking variant");
      // fail open for network errors
    }
  }

  if (unavailable.length > 0) {
    return { ok: false, unavailableVariantIds: unavailable };
  }
  return { ok: true };
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
        lines(first: 50) {
          nodes {
            merchandise {
              ... on ProductVariant {
                price { amount }
              }
            }
            quantity
            discountAllocations {
              discountedAmount {
                amount
              }
            }
          }
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
          lines: {
            nodes: {
              merchandise: { price?: { amount: string } };
              quantity: number;
              discountAllocations: { discountedAmount: { amount: string } }[];
            }[];
          };
        };
      };
    };

    const cart = data?.data?.cart;
    if (!cart) return null;

    // Sum discount allocations from all line nodes.
    // When a discount code is applied via cartDiscountCodesUpdate, Shopify reflects
    // it in both cost.totalAmount and in each line's discountAllocations.
    // The cart-level discountAllocations field is always empty for code discounts.
    const discountAmount = cart.lines.nodes.reduce((sum, line) => {
      return sum + line.discountAllocations.reduce(
        (lSum, a) => lSum + parseFloat(a.discountedAmount.amount),
        0,
      );
    }, 0);

    // Raw line total (pre-discount) so createDraftOrder has an accurate base for
    // the lookupDiscountCode fallback in case discountAllocations are ever empty.
    const rawLineTotal = cart.lines.nodes.reduce((sum, line) => {
      const price = parseFloat(line.merchandise.price?.amount ?? "0");
      return sum + price * line.quantity;
    }, 0);

    return {
      subtotalAmount: rawLineTotal > 0 ? rawLineTotal : parseFloat(cart.cost.subtotalAmount.amount),
      totalAmount: parseFloat(cart.cost.totalAmount.amount),
      discountAmount,
      discountCodes: cart.discountCodes,
    };
  } catch {
    return null;
  }
}

/**
 * Look up a discount code via the Admin API and compute the discount amount
 * against the given subtotal. Returns null if the code is invalid, not found,
 * or has reached its usage limit (combining Shopify's native usage_count with
 * our own DB-tracked uses from API-created draft orders).
 */
export async function lookupDiscountCode(
  code: string,
  lineSubtotal: number,
): Promise<{ discountAmount: number; discountCode: string } | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken || !code.trim()) return null;

  try {
    const codeRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/discount_codes/lookup.json?code=${encodeURIComponent(code)}`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (!codeRes.ok) return null;

    const codeData = await codeRes.json() as {
      discount_code?: { price_rule_id: number; code: string; usage_count: number };
    };
    const discountCode = codeData.discount_code;
    if (!discountCode) return null;

    const ruleRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/price_rules/${discountCode.price_rule_id}.json`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (!ruleRes.ok) return null;

    const ruleData = await ruleRes.json() as {
      price_rule?: {
        value_type: "fixed_amount" | "percentage";
        value: string;
        status?: string;
        usage_limit: number | null;
      };
    };
    const rule = ruleData.price_rule;
    if (!rule || rule.status === "disabled") return null;

    // Enforce usage limits: Shopify only increments usage_count for native
    // checkout flows, not API-created draft orders. We track API uses in our
    // own DB and add them to Shopify's count before checking the limit.
    if (rule.usage_limit !== null && rule.usage_limit !== undefined) {
      const shopifyUses = discountCode.usage_count ?? 0;
      const dbUses = await countDiscountCodeUses(code.trim());
      if (shopifyUses + dbUses >= rule.usage_limit) {
        return null; // Usage limit reached
      }
    }

    // Shopify stores values as negative numbers (e.g. "-15.0" for 15% off, "-50.00" for 50 EGP off)
    const value = Math.abs(parseFloat(rule.value));
    const discountAmount =
      rule.value_type === "percentage"
        ? (lineSubtotal * value) / 100
        : Math.min(value, lineSubtotal); // cap fixed discount at subtotal

    return { discountAmount, discountCode: discountCode.code };
  } catch {
    return null;
  }
}

/**
 * Record a discount code use after a successful API order. Shopify does not
 * increment usage_count for draft orders, so we track it ourselves in the DB.
 * Errors are swallowed — a DB write failure must not block the order response.
 */
export async function recordDiscountCodeUse(
  code: string,
  orderId?: number | bigint,
  orderNumber?: number | bigint,
  paymentMethod?: string,
): Promise<void> {
  try {
    await insertDiscountCodeUse(code.trim(), orderId ?? null, orderNumber ?? null, paymentMethod ?? null);
    logger.info({ code, orderId, orderNumber, paymentMethod }, "Discount code use recorded");
  } catch (err) {
    // Don't throw — usage recording failure must not block the order
    logger.error({ err, code, orderId, orderNumber }, "Failed to record discount code use");
  }
}

export interface ShopifyLineItem {
  title: string;
  variant_title: string | null;
  quantity: number;
  price: string;
}

export async function completeShopifyDraftOrder(draftOrderId: number): Promise<{ orderId: number; orderNumber: number; total: string; lineItems: ShopifyLineItem[]; discountAmount?: number; discountCode?: string } | null> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) return null;

  // Fetch the draft to extract discount info for the return value
  type DraftFull = {
    id: number;
    email?: string;
    tags?: string;
    note?: string;
    note_attributes?: Array<{ name: string; value: string }>;
    line_items?: Array<{ variant_id: number; quantity: number }>;
    shipping_address?: Record<string, unknown>;
    shipping_line?: { price: string; title: string };
    applied_discount?: { title: string; amount: string };
    source_name?: string;
    referring_site?: string;
    landing_site?: string;
  };

  let draft: DraftFull | null = null;
  try {
    const draftRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}.json`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (draftRes.ok) {
      const draftData = await draftRes.json() as { draft_order?: DraftFull };
      draft = draftData.draft_order ?? null;
    }
  } catch { /* ignore */ }

  const noteAttrs = draft?.note_attributes ?? [];
  const attributionRaw = noteAttrs.find((n) => n.name === "__attribution")?.value;

  let draftDiscountCode: string | undefined;
  let draftDiscountAmount: number | undefined;

  if (draft?.applied_discount?.title && draft?.applied_discount?.amount) {
    draftDiscountCode = draft.applied_discount.title;
    draftDiscountAmount = parseFloat(draft.applied_discount.amount);
  } else {
    const codeRaw = noteAttrs.find((n) => n.name === "__discount_code")?.value;
    const amountRaw = noteAttrs.find((n) => n.name === "__discount_amount")?.value;
    if (codeRaw) draftDiscountCode = codeRaw;
    if (amountRaw) draftDiscountAmount = parseFloat(amountRaw);
  }

  // Complete the draft order — applied_discount is preserved in the real order total.
  // payment_pending=true prevents Shopify from auto-creating a pending transaction which
  // would later block the GraphQL orderMarkAsPaid mutation.
  const completeRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}/complete.json?send_receipt=true&send_fulfillment_receipt=false&payment_pending=true`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
    },
  );
  if (!completeRes.ok) return null;

  const completeData = await completeRes.json() as {
    draft_order: { order_id: number; total_price: string };
  };
  const orderId = completeData.draft_order.order_id;
  const total = completeData.draft_order.total_price;

  let orderNumber = orderId;
  let lineItems: ShopifyLineItem[] = [];
  const orderRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=order_number,line_items`,
    { headers: { "X-Shopify-Access-Token": adminToken } },
  );
  if (orderRes.ok) {
    const orderData = await orderRes.json() as { order: { order_number: number; line_items: unknown[] } };
    orderNumber = orderData.order.order_number ?? orderId;
    lineItems = (orderData.order.line_items ?? []) as unknown as ShopifyLineItem[];
  }

  // InstaPay orders remain as "payment pending" in Shopify — this is correct since
  // payment confirmation happens via admin review of the bank-transfer proof, not via
  // a Paymob transaction. The admin should manually mark the order paid in Shopify
  // after confirming receipt.

  // Re-apply referring_site / landing_site (Shopify strips them during completion)
  if (attributionRaw) {
    try {
      const parsed = JSON.parse(attributionRaw) as Record<string, unknown>;
      const draftAttr = {
        ...(typeof parsed.referringSite === "string" ? { referringSite: parsed.referringSite } : {}),
        ...(typeof parsed.landingSite === "string" ? { landingSite: parsed.landingSite } : {}),
      };
      if (draftAttr.referringSite || draftAttr.landingSite) {
        void setShopifyOrderReferrer(orderId, draftAttr);
      }
    } catch { /* ignore */ }
  }

  return { orderId, orderNumber, total, lineItems, discountAmount: draftDiscountAmount, discountCode: draftDiscountCode };
}

/**
 * Batch-fetch variant prices from Shopify Admin REST API.
 * Used when there is no Storefront cart to derive lineSubtotal from,
 * so we can apply the free-shipping threshold correctly.
 */
async function fetchVariantLineSubtotal(
  lines: OrderLine[],
  storeDomain: string,
  adminToken: string,
): Promise<number> {
  const ids = lines
    .map((l) => extractVariantId(l.variantId))
    .filter((id) => id > 0)
    .join(",");
  if (!ids) return 0;
  try {
    const res = await fetch(
      `https://${storeDomain}/admin/api/2024-04/variants.json?ids=${ids}`,
      { headers: { "X-Shopify-Access-Token": adminToken } },
    );
    if (!res.ok) return 0;
    const data = await res.json() as { variants: Array<{ id: number; price: string }> };
    const priceMap = new Map(data.variants.map((v) => [v.id, parseFloat(v.price)]));
    return lines.reduce((sum, line) => {
      const varId = extractVariantId(line.variantId);
      const price = priceMap.get(varId) ?? 0;
      return sum + price * line.quantity;
    }, 0);
  } catch {
    return 0;
  }
}

export async function createDraftOrder(params: {
  lines: OrderLine[];
  customer: CustomerInfo;
  paymentMethod: "cod" | "instapay" | "card" | "apple-pay";
  cartId?: string;
  discountCode?: string;
  extraTags?: string;
  complete?: boolean;
  /** Marketing attribution to pass to Shopify for channel/sales source reporting */
  attribution?: OrderAttribution;
  /** Paymob transaction details — attached as note_attributes for traceability */
  paymobDetails?: {
    txnId: string;
    amountCents: number;
    intentId?: string;
  };
}): Promise<{ orderNumber: number; orderId: number; total: string; lineItems: ShopifyLineItem[]; draftOrderId?: number; discountAmount?: number; discountCode?: string; shippingAmount?: string }> {
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
      : params.paymentMethod === "apple-pay"
      ? "apple-pay,moi-checkout"
      : params.paymentMethod === "card"
      ? "paymob,moi-checkout"
      : "instapay,moi-checkout";
  const tags = params.extraTags ? `${baseTags},${params.extraTags}` : baseTags;

  const pd = params.paymobDetails;
  const pdDate = pd ? new Date().toISOString() : "";

  const paymentLabel = params.paymentMethod === "apple-pay" ? "Apple Pay (Paymob)" : "Credit/Debit Card (Paymob)";
  const noteText =
    params.paymentMethod === "cod"
      ? "Cash on Delivery"
      : (params.paymentMethod === "card" || params.paymentMethod === "apple-pay") && pd
      ? [
          paymentLabel,
          `Transaction ID: ${pd.txnId}`,
          `Amount: ${(pd.amountCents / 100).toFixed(2)} EGP`,
          `Transaction Type: Payment`,
          `Payment Source: Paymob Application`,
          `Status: Successful`,
          `Date: ${pdDate}`,
          ...(pd.intentId ? [`Reference: ${pd.intentId}`] : []),
        ].join("\n")
      : params.paymentMethod === "apple-pay"
      ? "Apple Pay (Paymob)"
      : params.paymentMethod === "card"
      ? "Credit/Debit Card (Paymob)"
      : "Instapay Transfer";

  // Determine shipping based on cart total: free over 2,000 EGP
  let shippingPrice = "50.00";
  let shippingTitle = "Standard Delivery";
  let cartDiscountAmount = 0;
  let cartDiscountCode = "";

  // Track the line subtotal so we can compute percentage discounts below
  let lineSubtotal = 0;

  // When there is no Storefront cart, fetch variant prices from Admin API
  // so we can correctly evaluate the free-shipping threshold.
  if (!params.cartId) {
    lineSubtotal = await fetchVariantLineSubtotal(params.lines, storeDomain, adminToken);
    if (lineSubtotal >= 2000) {
      shippingPrice = "0.00";
      shippingTitle = "Free Delivery";
    }
  }

  if (params.cartId) {
    const cart = await fetchStorefrontCart(params.cartId);
    if (cart) {
      // Use subtotalAmount as the undiscounted line total for percentage calculations.
      // totalAmount may equal subtotalAmount because Shopify Storefront API does NOT
      // reduce cart totals for discount codes applied via cartDiscountCodesUpdate —
      // the discount is only resolved at order-creation time.
      lineSubtotal = cart.subtotalAmount;

      // Free shipping threshold is based on what the customer will actually pay
      // (after any discount). Use totalAmount here since free-shipping rules should
      // apply on the discounted price, but since totalAmount == subtotalAmount for
      // code discounts, we use subtotalAmount as the base and will adjust below
      // once we know the discount.
      if (cart.totalAmount >= 2000) {
        shippingPrice = "0.00";
        shippingTitle = "Free Delivery";
      }

      // Try discount allocations first (works for automatic discounts)
      cartDiscountAmount = cart.discountAmount;
      const codeInCart = cart.discountCodes.find(
        (d) => d.code.toLowerCase() === (params.discountCode || "").toLowerCase(),
      );
      cartDiscountCode = codeInCart?.code || params.discountCode || "";
    }
  }

  // Storefront API doesn't reflect percentage/code discounts in cart totals.
  // If we have a discount code but no discount amount yet, look it up via Admin API.
  if (cartDiscountAmount < 0.01 && params.discountCode) {
    const base = lineSubtotal > 0 ? lineSubtotal : 0;
    if (base > 0) {
      const looked = await lookupDiscountCode(params.discountCode, base);
      if (looked && looked.discountAmount > 0.01) {
        cartDiscountAmount = looked.discountAmount;
        cartDiscountCode = looked.discountCode;

        // Re-evaluate free shipping now that we know the discounted total
        const discountedTotal = base - cartDiscountAmount;
        if (discountedTotal >= 2000) {
          shippingPrice = "0.00";
          shippingTitle = "Free Delivery";
        }
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
      ...(cartDiscountAmount > 0.01 ? [
        { name: "__discount_amount", value: cartDiscountAmount.toFixed(2) },
        { name: "__discount_code", value: cartDiscountCode || "Discount" },
      ] : []),
      // Paymob transaction traceability fields — mirrors what Paymob shows in their dashboard
      ...(pd ? [
        { name: "Transaction ID", value: pd.txnId },
        { name: "Payment Method", value: params.paymentMethod === "apple-pay" ? "Apple Pay" : "Credit/Debit Card" },
        { name: "Amount", value: `${(pd.amountCents / 100).toFixed(2)} EGP` },
        { name: "Transaction Type", value: "Payment" },
        { name: "Payment Source", value: "Paymob Application" },
        { name: "Other References", value: pd.intentId ?? "" },
        { name: "Status", value: "Successful" },
        { name: "Date Created", value: pdDate },
        { name: "Last Updated", value: pdDate },
      ] : []),
    ],
    ...(cartDiscountAmount > 0.01 ? {
      applied_discount: {
        title: cartDiscountCode || "Discount",
        description: cartDiscountCode || "Discount",
        value_type: "fixed_amount",
        value: cartDiscountAmount,
        amount: cartDiscountAmount.toFixed(2),
      },
    } : {}),
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
    return { orderNumber: draftId, orderId: draftId, total: draftTotal, lineItems: [], draftOrderId: draftId, discountAmount: cartDiscountAmount > 0.01 ? cartDiscountAmount : undefined, discountCode: cartDiscountCode || undefined, shippingAmount: shippingPrice };
  }

  // For COD orders, pass payment_pending=true so Shopify creates the order with
  // financial_status:"pending" and does NOT auto-create a pending payment
  // transaction. Without this, stores with automatic payment capture enabled
  // would capture the auto-created pending transaction and mark the COD order
  // as "paid" immediately — incorrect for Cash on Delivery.
  //
  // For card/apple-pay: do NOT use payment_pending=true. Shopify auto-creates
  // a pending authorization transaction which we then capture via
  // recordShopifyPaymentTransaction (kind:"capture" with parent_id).
  const paymentPendingParam = params.paymentMethod === "cod" ? "&payment_pending=true" : "";
  const completeRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftId}/complete.json?send_receipt=true&send_fulfillment_receipt=false${paymentPendingParam}`,
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

  return { orderNumber, orderId, total, lineItems: fetchedLineItems, discountAmount: cartDiscountAmount > 0.01 ? cartDiscountAmount : undefined, discountCode: cartDiscountCode || undefined, shippingAmount: shippingPrice };
}

/**
 * Mark a Shopify order as paid after a successful Paymob transaction.
 *
 * Strategy:
 *   1. REST POST /orders/{id}/transactions.json with source_name:"external"
 *      This is the preferred path — it creates a real Shopify transaction record
 *      linked to the Paymob gateway and transaction ID so the order shows the
 *      correct payment method and is fully reconcilable.
 *      source_name:"external" signals to Shopify that this payment was captured
 *      outside of Shopify Payments, bypassing the "shopify_payment" gateway check.
 *
 *   2. GraphQL orderMarkAsPaid mutation (fallback)
 *      Used only when REST fails (e.g. on stores where REST is fully blocked).
 *      Marks the order as paid without detailed transaction metadata.
 *
 * Throws if both strategies fail so callers can retry.
 */
export async function recordShopifyPaymentTransaction(params: {
  orderId: number;
  amount: string;
  paymobTxnId?: string | null;
  storeDomain: string;
  adminToken: string;
}): Promise<void> {
  const { orderId, amount, paymobTxnId, storeDomain, adminToken } = params;
  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken };
  const baseUrl = `https://${storeDomain}/admin/api/2024-04/orders/${orderId}`;
  const now = new Date().toISOString();

  // Completing a draft order without payment_pending=true causes Shopify to
  // auto-create a "pending" authorization transaction (kind:"pending", status:"success").
  // Shopify rejects kind:"sale" if any transaction already exists — so we must
  // check first and capture the pending transaction if present.
  let pendingTxnId: number | null = null;
  const txnListRes = await fetch(`${baseUrl}/transactions.json?fields=id,kind,status`, { headers });
  if (txnListRes.ok) {
    const txnData = await txnListRes.json() as { transactions?: { id: number; kind: string; status: string }[] };
    const pending = (txnData.transactions ?? []).find(
      (t) => t.kind === "pending" && t.status === "success",
    );
    if (pending) pendingTxnId = pending.id;
  }

  const body: Record<string, unknown> = {
    kind: pendingTxnId ? "capture" : "sale",
    status: "success",
    gateway: "Paymob",
    amount,
    currency: "EGP",
    processed_at: now,
    ...(pendingTxnId ? { parent_id: pendingTxnId } : {}),
  };
  if (paymobTxnId) {
    body.authorization = paymobTxnId;
    body.receipt = {
      paymob_txn_id: paymobTxnId,
      payment_method: "Credit/Debit Card",
      transaction_type: "Payment",
      payment_source: "Paymob Application",
      status: "Successful",
      date_created: now,
      last_updated: now,
    };
  }

  logger.info({ orderId, kind: body.kind, pendingTxnId }, "recordShopifyPaymentTransaction: posting transaction");
  const res = await fetch(`${baseUrl}/transactions.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({ transaction: body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`recordShopifyPaymentTransaction: Shopify returned ${res.status}: ${text}`);
  }
  logger.info({ orderId, paymobTxnId, amount, kind: body.kind }, "recordShopifyPaymentTransaction: transaction posted — order marked paid");
}

/**
 * Creates a Shopify order for a verified Paymob card/apple-pay payment by POSTing
 * directly to /orders.json with the payment transaction embedded in the payload.
 *
 * WHY this approach instead of draft → complete → add transaction:
 *   On Shopify Payments stores, completing a draft order links the resulting order
 *   to Shopify Payments infrastructure. Any subsequent attempt to add a transaction
 *   via REST (POST /orders/{id}/transactions.json) fails with:
 *     {"message":"Order has no shopify_payment."}
 *   GraphQL orderMarkAsPaid also fails for the same reason — the order's payment
 *   gateway is locked to Shopify Payments even when completed with payment_pending=true.
 *
 *   The only reliable approach for external payment providers is to embed the
 *   transaction directly in POST /orders.json at creation time WITHOUT setting
 *   financial_status:"paid" explicitly. Shopify computes financial_status from
 *   the embedded kind:"sale" transaction automatically, bypassing the Shopify
 *   Payments infrastructure check that causes the above error.
 *
 * NOTE on discounts: Shopify's Orders API does accept discount_codes but does NOT
 *   reduce the order total from them (they're tracking-only). This function reads
 *   the draft's applied_discount to pass the correct already-computed amount via
 *   discount_codes, and uses Shopify-resolved line item prices from the draft.
 *   The transaction amount matches draft.total (which already includes the discount).
 *
 * Flow:
 *   1. createDraftOrder(complete:false) — validates prices, applies discounts
 *   2. GET /draft_orders/{id}.json — read back Shopify-resolved line item prices
 *   3. POST /orders.json with embedded transaction → order created and marked paid
 *   4. DELETE /draft_orders/{id}.json — cleanup (fire-and-forget)
 */
async function createDirectPaidCardOrder(params: {
  lines: OrderLine[];
  customer: CustomerInfo;
  paymentMethod: "card" | "apple-pay";
  cartId?: string;
  discountCode?: string;
  extraTags?: string;
  attribution?: OrderAttribution;
  paymobTxnId?: string;
  paymobDetails?: { txnId: string; amountCents: number; intentId?: string };
}): Promise<{ orderNumber: number; orderId: number; total: string; lineItems: ShopifyLineItem[]; discountAmount?: number; discountCode?: string; shippingAmount?: string }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) throw new Error("createDirectPaidCardOrder: Shopify not configured");

  const authHeader = { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken };

  // ── Step 1: Create draft order (price validation only, do NOT complete) ──────
  const draft = await createDraftOrder({
    lines: params.lines,
    customer: params.customer,
    paymentMethod: params.paymentMethod,
    cartId: params.cartId,
    discountCode: params.discountCode,
    extraTags: params.extraTags,
    complete: false,
    attribution: params.attribution,
    paymobDetails: params.paymobDetails,
  });

  const draftOrderId = draft.draftOrderId;
  if (!draftOrderId) throw new Error("createDirectPaidCardOrder: createDraftOrder returned no draftOrderId");

  // ── Step 2: Read back full draft to get Shopify-resolved prices ──────────────
  type DraftItem = { variant_id: number; quantity: number; price: string; title?: string; variant_title?: string | null };
  type DraftFull = {
    note?: string;
    note_attributes?: Array<{ name: string; value: string }>;
    tags?: string;
    email?: string;
    line_items?: DraftItem[];
    shipping_line?: { title: string; price: string; code?: string };
    applied_discount?: { title: string; amount: string; value_type?: string };
    source_name?: string;
    referring_site?: string;
    landing_site?: string;
  };

  const draftRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}.json`,
    { headers: { "X-Shopify-Access-Token": adminToken } },
  );
  if (!draftRes.ok) {
    throw new Error(`createDirectPaidCardOrder: failed to fetch draft ${draftOrderId} (${draftRes.status})`);
  }
  const draftFull = ((await draftRes.json()) as { draft_order: DraftFull }).draft_order;

  // ── Step 3: Build order payload and POST /orders.json ───────────────────────
  const c = params.customer;
  const shippingLine = draftFull.shipping_line;
  const appliedDiscount = draftFull.applied_discount;

  const orderPayload: Record<string, unknown> = {
    suppress_notifications: true,
    send_receipt: false,
    send_fulfillment_receipt: false,
    // Do NOT set financial_status:"paid" explicitly — on Shopify Payments stores this
    // triggers a validation check that returns "Order has no shopify_payment." because
    // Shopify tries to link it to Shopify Payments infrastructure.
    // Instead, let Shopify compute financial_status from the embedded transaction below.
    // A successful kind:"sale" transaction causes Shopify to set financial_status:"paid"
    // automatically without going through Shopify Payments.
    source_name: draftFull.source_name ?? "api",
    ...(c.email ? { email: c.email } : {}),
    line_items: (draftFull.line_items ?? []).map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
      price: item.price,
    })),
    shipping_address: {
      first_name: c.firstName,
      last_name: c.lastName,
      address1: c.address,
      address2: c.governorate,
      city: c.city,
      province: EGYPT_PROVINCE_CODES[c.governorate] ?? c.governorate,
      zip: c.postalCode ?? "",
      country: "Egypt",
      country_code: "EG",
      phone: c.phone,
    },
    // Embed the Paymob transaction — this is what makes the order "paid" without
    // needing a separate POST /transactions call afterward.
    transactions: [{
      kind: "sale",
      status: "success",
      amount: draft.total,
      gateway: "paymob",
      currency: "EGP",
      ...(params.paymobTxnId ? { authorization: params.paymobTxnId } : {}),
    }],
  };

  if (draftFull.note) orderPayload.note = draftFull.note;
  if (draftFull.note_attributes?.length) orderPayload.note_attributes = draftFull.note_attributes;
  if (draftFull.tags) orderPayload.tags = draftFull.tags;
  if (draftFull.referring_site) orderPayload.referring_site = draftFull.referring_site;
  if (draftFull.landing_site) orderPayload.landing_site = draftFull.landing_site;

  if (shippingLine) {
    orderPayload.shipping_lines = [{
      title: shippingLine.title,
      price: shippingLine.price,
      code: shippingLine.code ?? "STANDARD",
    }];
  }

  // discount_codes here is for Shopify's tracking display only (amounts are from the draft)
  if (appliedDiscount) {
    orderPayload.discount_codes = [{
      code: appliedDiscount.title,
      amount: appliedDiscount.amount,
      type: appliedDiscount.value_type === "percentage" ? "percentage" : "fixed_amount",
    }];
  }

  logger.info(
    { draftOrderId, total: draft.total, paymobTxnId: params.paymobTxnId },
    "createDirectPaidCardOrder: POSTing /orders.json with embedded transaction",
  );

  const orderRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders.json`,
    { method: "POST", headers: authHeader, body: JSON.stringify({ order: orderPayload }) },
  );
  if (!orderRes.ok) {
    const errText = await orderRes.text();
    throw new Error(`createDirectPaidCardOrder: POST /orders.json failed (${orderRes.status}): ${errText}`);
  }
  const orderData = ((await orderRes.json()) as {
    order: { id: number; order_number: number; line_items: ShopifyLineItem[]; financial_status: string };
  }).order;

  logger.info(
    { draftOrderId, orderId: orderData.id, orderNumber: orderData.order_number, financialStatus: orderData.financial_status, paymobTxnId: params.paymobTxnId },
    "createDirectPaidCardOrder: order created and marked paid",
  );

  // ── Step 4: Delete the draft order (cleanup — non-critical) ─────────────────
  void fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftOrderId}.json`,
    { method: "DELETE", headers: { "X-Shopify-Access-Token": adminToken } },
  ).catch(() => {});

  return {
    orderId: orderData.id,
    orderNumber: orderData.order_number,
    total: draft.total,
    lineItems: orderData.line_items,
    discountAmount: draft.discountAmount,
    discountCode: draft.discountCode,
    shippingAmount: draft.shippingAmount,
  };
}

/**
 * Creates a Shopify order for an already-verified Paymob / COD payment.
 *
 * Card / Apple Pay ("paid"):
 *   Draft order → complete (without payment_pending=true) → Shopify auto-creates
 *   a pending authorization → capture it via recordShopifyPaymentTransaction
 *   (kind:"capture" with parent_id). This is the approach that worked reliably on
 *   June 2nd and avoids the "Order has no shopify_payment." error on Shopify
 *   Payments stores.
 *
 * COD:
 *   Draft order → complete with payment_pending=true (no transaction posted).
 */
export async function createShopifyDirectOrder(params: {
  lines: OrderLine[];
  customer: CustomerInfo;
  paymentMethod: "cod" | "card" | "apple-pay";
  cartId?: string;
  discountCode?: string;
  extraTags?: string;
  attribution?: OrderAttribution;
  financialStatus?: "pending" | "paid";
  /** Paymob transaction ID — stored in the order for reconciliation */
  paymobTxnId?: string;
  /** Full Paymob transaction details — stored in order note_attributes */
  paymobDetails?: { txnId: string; amountCents: number; intentId?: string };
}): Promise<{ orderNumber: number; orderId: number; total: string; lineItems: ShopifyLineItem[]; discountAmount?: number; discountCode?: string; shippingAmount?: string }> {
  const result = await createDraftOrder({
    lines: params.lines,
    customer: params.customer,
    paymentMethod: params.paymentMethod,
    cartId: params.cartId,
    discountCode: params.discountCode,
    extraTags: params.extraTags,
    complete: true,
    attribution: params.attribution,
    paymobDetails: params.paymobDetails,
  });

  // Card / Apple Pay — capture the Shopify-auto-created pending authorization
  // so the order's financial_status becomes "paid".
  if ((params.paymentMethod === "card" || params.paymentMethod === "apple-pay") && params.financialStatus === "paid") {
    const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const adminToken = await getShopifyAdminToken();
    if (storeDomain && adminToken) {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await recordShopifyPaymentTransaction({
            orderId: result.orderId,
            amount: result.total,
            paymobTxnId: params.paymobTxnId,
            storeDomain,
            adminToken,
          });
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          logger.warn({ err, orderId: result.orderId, attempt }, "createShopifyDirectOrder: payment transaction attempt failed");
          if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
        }
      }
      if (lastErr) {
        logger.error({ err: lastErr, orderId: result.orderId, paymobTxnId: params.paymobTxnId }, "createShopifyDirectOrder: payment transaction failed after 2 attempts — order will remain Payment Pending; use admin Record Payment button");
      }
    }
  }

  return {
    orderNumber: result.orderNumber,
    orderId: result.orderId,
    total: result.total,
    lineItems: result.lineItems,
    discountAmount: result.discountAmount,
    discountCode: result.discountCode,
    shippingAmount: result.shippingAmount,
  };
}
