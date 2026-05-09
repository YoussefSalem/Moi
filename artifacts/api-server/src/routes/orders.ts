import { Router, type IRouter } from "express";
import {
  sendWhatsApp,
  createBostaShipment,
  addShopifyOrderNote,
} from "../lib/integrations";

const router: IRouter = Router();

interface OrderLine {
  variantId: string;
  quantity: number;
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  email?: string;
}

interface CreateOrderBody {
  lines?: unknown;
  customer?: unknown;
  paymentMethod?: unknown;
  discountAmount?: unknown;
  discountCode?: unknown;
}

function extractVariantId(gid: string): number {
  const parts = gid.split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  if (isNaN(id)) throw new Error(`Invalid variant GID: ${gid}`);
  return id;
}

async function createDraftOrder(params: {
  lines: OrderLine[];
  customer: CustomerInfo;
  paymentMethod: "cod" | "instapay";
  discountAmount?: number;
  discountCode?: string;
}): Promise<{ orderNumber: number; orderId: number; total: string }> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
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
      phone: params.customer.phone,
      address1: params.customer.address,
      city: params.customer.city,
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
    ],
  };

  if (params.customer.email) draftPayload.email = params.customer.email;

  if (params.discountAmount && params.discountAmount > 0) {
    draftPayload.applied_discount = {
      title: params.discountCode ?? "Promo",
      value_type: "fixed_amount",
      value: params.discountAmount.toFixed(2),
      amount: params.discountAmount.toFixed(2),
    };
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
    throw new Error(
      `Shopify draft order completion failed (${completeRes.status}): ${text}`,
    );
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

  const customer = body.customer as CustomerInfo | undefined;
  if (
    !customer?.firstName?.trim() ||
    !customer?.lastName?.trim() ||
    !customer?.phone?.trim() ||
    !customer?.address?.trim() ||
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
  const discountAmount =
    typeof body.discountAmount === "number" && body.discountAmount > 0
      ? body.discountAmount
      : undefined;
  const discountCode =
    typeof body.discountCode === "string" ? body.discountCode : undefined;

  req.log.info({ paymentMethod, lineCount: lines.length }, "Creating order");

  try {
    const { orderNumber, orderId, total } = await createDraftOrder({
      lines,
      customer,
      paymentMethod,
      discountAmount,
      discountCode,
    });

    req.log.info({ orderNumber, orderId }, "Order created");

    const instapayAccount = process.env.INSTAPAY_ACCOUNT_NAME ?? "";
    const instapayNumber = process.env.INSTAPAY_ACCOUNT_NUMBER ?? "";
    const businessWA = process.env.BUSINESS_WHATSAPP_NUMBER ?? "";

    if (paymentMethod === "cod") {
      void sendWhatsApp(
        customer.phone,
        `✅ Your Moi order #${orderNumber} has been placed!\n\nTotal: ${total} EGP (includes 120 EGP shipping)\nPayment: Cash on Delivery\n\nOur team will contact you shortly to confirm delivery. Thank you for shopping with Moi. 🖤`,
      );

      // Await Bosta for COD so we can persist the tracking number
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
        void addShopifyOrderNote(
          orderId,
          `Bosta tracking: ${trackingNumber}\nPayment: Cash on Delivery`,
        );
        req.log.info({ trackingNumber, orderNumber }, "Bosta COD shipment created");
      }
    } else {
      void sendWhatsApp(
        customer.phone,
        `🛍 Your Moi order #${orderNumber} is reserved!\n\nTotal: ${total} EGP (includes 120 EGP shipping)\nPayment: Instapay Transfer\n\nTo confirm, please:\n1️⃣ Open Instapay and send *${total} EGP* to:\n   ${instapayAccount} — ${instapayNumber}\n2️⃣ Reply to this message with order #${orderNumber} + payment screenshot\n\nYour order ships once payment is confirmed. Thank you! 🖤`,
      );

      if (businessWA) {
        void sendWhatsApp(
          businessWA,
          `🆕 Instapay order #${orderNumber}\n${customer.firstName} ${customer.lastName} · ${customer.phone}\n${customer.city}\nTotal: ${total} EGP\n\nAwaiting payment confirmation.`,
        );
      }
    }

    res.status(200).json({
      success: true,
      orderNumber,
      orderId,
      total,
      paymentMethod,
    });
  } catch (err) {
    req.log.error({ err }, "Order creation failed");
    res.status(500).json({
      error: "Could not place your order. Please try again.",
    });
  }
});

export default router;
