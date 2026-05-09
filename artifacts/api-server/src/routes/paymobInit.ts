import { Router, type IRouter } from "express";
import {
  createPaymobIntention,
  cancelShopifyOrder,
} from "../lib/paymob";
import {
  addShopifyOrderNote,
  tagShopifyOrder,
  getShopifyAdminToken,
} from "../lib/integrations";

const router: IRouter = Router();

const EGYPT_PROVINCE_CODES: Record<string, string> = {
  "Cairo": "C", "Giza": "GZ", "Alexandria": "ALX", "Dakahlia": "DK",
  "Red Sea": "BA", "Beheira": "BH", "Fayoum": "FYM", "Gharbia": "GH",
  "Ismailia": "IS", "Menofia": "MNF", "Minya": "MN", "Qaliubiya": "KB",
  "New Valley": "WAD", "Suez": "SUZ", "Aswan": "ASN", "Assiut": "AST",
  "Beni Suef": "BS", "Port Said": "PTS", "Damietta": "DT", "Sharkia": "SHR",
  "South Sinai": "JS", "Kafr El Sheikh": "KFS", "Matrouh": "MT", "Luxor": "LX",
  "Qena": "KN", "North Sinai": "SIN", "Sohag": "SHG", "Ain Sokhna": "SUZ",
};

function extractVariantId(gid: string): number {
  const parts = gid.split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  if (isNaN(id)) throw new Error(`Invalid variant GID: ${gid}`);
  return id;
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address: string;
  governorate: string;
  postalCode?: string;
  city: string;
}

interface OrderLine {
  variantId: string;
  quantity: number;
}

interface StorefrontCartResult {
  subtotalAmount: number;
  totalAmount: number;
  discountCodes: { code: string; applicable: boolean }[];
}

async function fetchStorefrontCart(cartId: string): Promise<StorefrontCartResult | null> {
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
        discountCodes { code applicable }
      }
    }
  `;
  try {
    const res = await fetch(`https://${storeDomain}/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify({ query, variables: { cartId } }),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: { cart?: { cost: { subtotalAmount: { amount: string }; totalAmount: { amount: string } }; discountCodes: { code: string; applicable: boolean }[] } };
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

router.post("/orders/paymob-init", async (req, res) => {
  const body = req.body as {
    lines?: unknown;
    customer?: unknown;
    cartId?: unknown;
    discountCode?: unknown;
    cancelPreviousOrderId?: unknown;
    siteOrigin?: unknown;
  };

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "No items in order." });
    return;
  }

  for (const raw of body.lines as unknown[]) {
    const l = raw as Record<string, unknown>;
    if (typeof l.variantId !== "string" || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(l.variantId)) {
      res.status(400).json({ error: "Invalid variant ID in order lines." });
      return;
    }
    if (typeof l.quantity !== "number" || !Number.isInteger(l.quantity) || l.quantity < 1) {
      res.status(400).json({ error: "Each line item must have a quantity of at least 1." });
      return;
    }
  }

  const customer = body.customer as CustomerInfo | undefined;
  if (
    !customer?.firstName?.trim() || !customer?.lastName?.trim() ||
    !customer?.phone?.trim() || !customer?.address?.trim() ||
    !customer?.governorate?.trim() || !customer?.city?.trim()
  ) {
    res.status(400).json({ error: "All customer fields are required." });
    return;
  }

  const lines = body.lines as OrderLine[];
  const discountCode = typeof body.discountCode === "string" && body.discountCode.trim() ? body.discountCode.trim() : undefined;
  const cartId = typeof body.cartId === "string" && body.cartId.trim() ? body.cartId.trim() : undefined;
  const cancelPreviousOrderId = typeof body.cancelPreviousOrderId === "number" ? body.cancelPreviousOrderId : undefined;
  const siteOrigin = typeof body.siteOrigin === "string" && body.siteOrigin.trim() ? body.siteOrigin.trim() : undefined;

  req.log.info({ lineCount: lines.length, cancelPreviousOrderId }, "Paymob init started");

  // Cancel previous failed order if provided
  if (cancelPreviousOrderId) {
    req.log.info({ cancelPreviousOrderId }, "Cancelling previous failed Paymob order");
    await cancelShopifyOrder(cancelPreviousOrderId);
  }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) {
    res.status(500).json({ error: "Shopify Admin API not configured." });
    return;
  }

  const lineItems = lines.map((l) => ({
    variant_id: extractVariantId(l.variantId),
    quantity: l.quantity,
  }));

  const draftPayload: Record<string, unknown> = {
    line_items: lineItems,
    shipping_address: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      address1: customer.address,
      address2: customer.governorate,
      city: customer.city,
      province: EGYPT_PROVINCE_CODES[customer.governorate] ?? customer.governorate,
      zip: customer.postalCode ?? "",
      country: "Egypt",
      country_code: "EG",
    },
    shipping_line: { price: "120.00", title: "Standard Delivery", custom: true },
    tags: "paymob,moi-checkout",
    note: "Payment: Paymob Card",
    note_attributes: [
      { name: "payment_method", value: "card" },
      { name: "customer_phone", value: customer.phone },
      { name: "governorate", value: customer.governorate },
      ...(customer.postalCode ? [{ name: "postal_code", value: customer.postalCode }] : []),
    ],
  };

  if (customer.email) draftPayload.email = customer.email;

  if (cartId) {
    const cart = await fetchStorefrontCart(cartId);
    if (cart) {
      const applicableCode = cart.discountCodes.find((d) => d.applicable);
      const discountAmount = cart.subtotalAmount - cart.totalAmount;
      if (applicableCode && discountAmount > 0) {
        draftPayload.applied_discount = {
          title: applicableCode.code,
          value_type: "fixed_amount",
          value: discountAmount.toFixed(2),
        };
      } else if (discountCode && cart.discountCodes.length > 0) {
        res.status(422).json({ error: `Discount code "${discountCode}" is not applicable to this order.` });
        return;
      }
    }
  }

  // Create Shopify draft order
  const createRes = await fetch(`https://${storeDomain}/admin/api/2024-04/draft_orders.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
    body: JSON.stringify({ draft_order: draftPayload }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    req.log.error({ status: createRes.status, text }, "Shopify draft order failed");
    res.status(500).json({ error: "Could not create order. Please try again." });
    return;
  }

  const createData = await createRes.json() as { draft_order: { id: number; total_price: string } };
  const draftId = createData.draft_order.id;

  const completeRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftId}/complete.json?payment_pending=true`,
    { method: "PUT", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken } },
  );

  if (!completeRes.ok) {
    const text = await completeRes.text();
    req.log.error({ status: completeRes.status, text }, "Shopify draft order completion failed");
    res.status(500).json({ error: "Could not complete order. Please try again." });
    return;
  }

  const completeData = await completeRes.json() as { draft_order: { order_id: number; total_price: string } };
  const shopifyOrderId = completeData.draft_order.order_id;
  const total = completeData.draft_order.total_price;

  const orderRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/orders/${shopifyOrderId}.json?fields=order_number`,
    { headers: { "X-Shopify-Access-Token": adminToken } },
  );
  let shopifyOrderNumber: number = shopifyOrderId;
  if (orderRes.ok) {
    const orderData = await orderRes.json() as { order: { order_number: number } };
    shopifyOrderNumber = orderData.order.order_number ?? shopifyOrderId;
  }

  req.log.info({ shopifyOrderId, shopifyOrderNumber }, "Shopify order created for Paymob");

  // Create Paymob intention
  let intention: { clientSecret: string; publicKey: string };
  try {
    intention = await createPaymobIntention({
      amountCents: Math.round(parseFloat(total) * 100),
      shopifyOrderId,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
      },
      redirectionUrl: siteOrigin ? `${siteOrigin}/api/paymob-return` : undefined,
    });
  } catch (err) {
    req.log.error({ err, shopifyOrderId }, "Paymob intention creation failed — cancelling Shopify order");
    await cancelShopifyOrder(shopifyOrderId);
    res.status(500).json({ error: "Payment gateway unavailable. Please try again." });
    return;
  }

  req.log.info({ shopifyOrderId, shopifyOrderNumber }, "Paymob intention created");

  res.status(200).json({
    clientSecret: intention.clientSecret,
    publicKey: intention.publicKey,
    shopifyOrderId,
    shopifyOrderNumber,
    total,
  });
});

export default router;
