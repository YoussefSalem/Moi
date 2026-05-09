import { Router, type IRouter } from "express";
import {
  sendWhatsApp,
  createBostaShipment,
  addShopifyOrderNote,
  tagShopifyOrder,
  getShopifyAdminToken,
} from "../lib/integrations";

const router: IRouter = Router();

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

interface OrderLine {
  variantId: string;
  quantity: number;
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

interface CreateOrderBody {
  lines?: unknown;
  customer?: unknown;
  paymentMethod?: unknown;
  discountCode?: unknown;
  cartId?: unknown;
}

function extractVariantId(gid: string): number {
  const parts = gid.split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  if (isNaN(id)) throw new Error(`Invalid variant GID: ${gid}`);
  return id;
}

interface StorefrontCartResult {
  subtotalAmount: number;
  totalAmount: number;
  discountCodes: { code: string; applicable: boolean }[];
}

/**
 * Fetches the Shopify Storefront cart server-side.
 * This is the authoritative source for discount validation — Shopify's engine
 * has already enforced usage limits, customer eligibility, product targeting,
 * minimum subtotals, and all other price-rule constraints.
 */
async function fetchStorefrontCart(
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

async function createDraftOrder(params: {
  lines: OrderLine[];
  customer: CustomerInfo;
  paymentMethod: "cod" | "instapay";
  cartId?: string;
  discountCode?: string;
}): Promise<{ orderNumber: number; orderId: number; total: string }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = await getShopifyAdminToken();
  if (!storeDomain || !adminToken) throw new Error("Shopify Admin API not configured");

  const lineItems = params.lines.map((l) => ({
    variant_id: extractVariantId(l.variantId),
    quantity: l.quantity,
  }));

  const draftPayload: Record<string, unknown> = {
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
      price: "120.00",
      title: "Standard Delivery",
      custom: true,
    },
    tags:
      params.paymentMethod === "cod"
        ? "cod,moi-checkout"
        : "instapay,moi-checkout",
    note: `Payment: ${params.paymentMethod === "cod" ? "Cash on Delivery" : "Instapay Transfer"}`,
    note_attributes: [
      { name: "payment_method", value: params.paymentMethod },
      { name: "customer_phone", value: params.customer.phone },
      { name: "governorate", value: params.customer.governorate },
      ...(params.customer.postalCode ? [{ name: "postal_code", value: params.customer.postalCode }] : []),
    ],
  };

  if (params.customer.email) draftPayload.email = params.customer.email;

  // Discount: fetch the Shopify Storefront cart server-side so Shopify's own
  // engine (usage limits, eligibility, product targeting, minimum subtotal, etc.)
  // has already validated the code. We use the cart's confirmed discounted total
  // as the fixed-amount applied_discount, refusing to trust any client-sent amounts.
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
        // Code was submitted but Shopify marked it as not applicable
        // (usage limit reached, eligibility mismatch, etc.) — reject the order
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

  // COD and Instapay should remain unpaid/pending in Shopify.
  // Only true online card payments should be completed as paid online.
  const paymentPending = true;
  const completeRes = await fetch(
    `https://${storeDomain}/admin/api/2024-04/draft_orders/${draftId}/complete.json?payment_pending=true`,
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
    `https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json?fields=order_number`,
    { headers: { "X-Shopify-Access-Token": adminToken } },
  );

  let orderNumber = orderId;
  if (orderRes.ok) {
    const orderData = await orderRes.json() as {
      order: { order_number: number };
    };
    orderNumber = orderData.order.order_number ?? orderId;
  }

  return { orderNumber, orderId, total };
}

router.post("/orders/create", async (req, res) => {
  const body = req.body as CreateOrderBody;

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "No items in order." });
    return;
  }

  for (const raw of body.lines as unknown[]) {
    const l = raw as Record<string, unknown>;
    if (
      typeof l.variantId !== "string" ||
      !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(l.variantId)
    ) {
      res.status(400).json({ error: "Invalid variant ID in order lines." });
      return;
    }
    if (
      typeof l.quantity !== "number" ||
      !Number.isInteger(l.quantity) ||
      l.quantity < 1
    ) {
      res.status(400).json({ error: "Each line item must have a quantity of at least 1." });
      return;
    }
  }

  const customer = body.customer as CustomerInfo | undefined;
  if (
    !customer?.firstName?.trim() ||
    !customer?.lastName?.trim() ||
    !customer?.phone?.trim() ||
    !customer?.address?.trim() ||
    !customer?.governorate?.trim() ||
    !customer?.city?.trim()
  ) {
    res.status(400).json({ error: "All customer fields are required." });
    return;
  }

  const paymentMethod = body.paymentMethod as "cod" | "instapay" | undefined;
  if (paymentMethod !== "cod" && paymentMethod !== "instapay") {
    res.status(400).json({ error: "Invalid payment method." });
    return;
  }

  const lines = body.lines as OrderLine[];
  const discountCode =
    typeof body.discountCode === "string" && body.discountCode.trim()
      ? body.discountCode.trim()
      : undefined;
  const cartId =
    typeof body.cartId === "string" && body.cartId.trim()
      ? body.cartId.trim()
      : undefined;

  req.log.info(
    { paymentMethod, lineCount: lines.length, discountCode, cartId },
    "Creating order",
  );

  try {
    const { orderNumber, orderId, total } = await createDraftOrder({
      lines,
      customer,
      paymentMethod,
      cartId,
      discountCode,
    });

    req.log.info({ orderNumber, orderId }, "Order created");

    const instapayAccount = process.env.INSTAPAY_ACCOUNT_NAME ?? "";
    const instapayNumber = process.env.INSTAPAY_ACCOUNT_NUMBER ?? "";
    const businessWA = process.env.BUSINESS_WHATSAPP_NUMBER ?? "";

    if (paymentMethod === "cod") {
      void sendWhatsApp(
        customer.phone,
        `✅ Your Moi order #${orderNumber} has been placed!\n\nTotal: ${total} EGP (includes 120 EGP shipping)\nPayment: Cash on Delivery\n\nOur team will contact you shortly. Thank you for shopping with Moi. 🖤`,
      );

      const trackingNumber = await createBostaShipment({
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        orderReference: `#${orderNumber}`,
        codAmount: parseFloat(total),
      });

      if (trackingNumber) {
        void addShopifyOrderNote(orderId, `Bosta tracking: ${trackingNumber}`);
        void tagShopifyOrder(orderId, `bosta-${trackingNumber}`);
        req.log.info({ trackingNumber, orderNumber }, "Bosta COD shipment created");
      }
    } else {
      void sendWhatsApp(
        customer.phone,
        `🛍 Your Moi order #${orderNumber} is reserved!\n\nTotal: ${total} EGP (includes 120 EGP shipping)\nPayment: Instapay Transfer\n\nTo confirm:\n1️⃣ Open your banking app and send *${total} EGP* via Instapay to:\n   ${instapayAccount} — ${instapayNumber}\n2️⃣ Return to the site and upload your payment screenshot\n\nOrder ships once payment is verified. Thank you! 🖤`,
      );
    }

    const responsePayload: Record<string, unknown> = {
      success: true,
      orderNumber,
      orderId,
      shopifyOrderId: orderId,
      total,
      paymentMethod,
    };

    if (paymentMethod === "instapay") {
      responsePayload.instapayAccount = instapayAccount;
      responsePayload.instapayNumber = instapayNumber;
      responsePayload.businessWA = businessWA;
    }

    res.status(200).json(responsePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not place your order.";
    req.log.error({ err }, "Order creation failed");

    if (message.includes("not applicable")) {
      res.status(422).json({ error: message });
    } else {
      res.status(500).json({ error: "Could not place your order. Please try again." });
    }
  }
});

export default router;
