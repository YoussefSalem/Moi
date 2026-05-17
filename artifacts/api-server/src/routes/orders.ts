import { Router, type IRouter } from "express";
import {
  sendWhatsApp,
  createBostaShipment,
  addShopifyOrderNote,
  tagShopifyOrder,
} from "../lib/integrations";
import {
  createDraftOrder,
  extractVariantId,
  type OrderLine,
  type CustomerInfo,
} from "../lib/shopifyOrder";
import { sendEmail, buildCODOrderEmail } from "../lib/email";

const router: IRouter = Router();

interface CreateOrderBody {
  lines?: unknown;
  customer?: unknown;
  paymentMethod?: unknown;
  discountCode?: unknown;
  cartId?: unknown;
}

function validateLines(lines: unknown[]): OrderLine[] | null {
  for (const raw of lines) {
    const l = raw as Record<string, unknown>;
    if (
      typeof l.variantId !== "string" ||
      !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(l.variantId)
    ) return null;
    if (
      typeof l.quantity !== "number" ||
      !Number.isInteger(l.quantity) ||
      l.quantity < 1
    ) return null;
    // also check extractVariantId won't throw
    try { extractVariantId(l.variantId); } catch { return null; }
  }
  return lines as OrderLine[];
}

function validateCustomer(customer: unknown): CustomerInfo | null {
  const c = customer as Record<string, unknown> | undefined;
  if (
    !c?.firstName || typeof c.firstName !== "string" || !c.firstName.trim() ||
    !c?.lastName || typeof c.lastName !== "string" || !c.lastName.trim() ||
    !c?.phone || typeof c.phone !== "string" || !c.phone.trim() ||
    !c?.address || typeof c.address !== "string" || !c.address.trim() ||
    !c?.governorate || typeof c.governorate !== "string" || !c.governorate.trim() ||
    !c?.city || typeof c.city !== "string" || !c.city.trim()
  ) return null;
  return c as unknown as CustomerInfo;
}

/**
 * POST /api/orders/instapay-init
 *
 * Creates the Shopify draft order tagged as instapay-pending-verification,
 * and returns the order ID + InstaPay account info so the customer can make
 * the transfer. Proof is submitted separately via /api/orders/instapay-proof.
 */
router.post("/orders/instapay-init", async (req, res) => {
  const body = req.body as CreateOrderBody;

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "No items in order." });
    return;
  }

  const lines = validateLines(body.lines as unknown[]);
  if (!lines) {
    res.status(400).json({ error: "Invalid order lines." });
    return;
  }

  const customer = validateCustomer(body.customer);
  if (!customer) {
    res.status(400).json({ error: "All customer fields are required." });
    return;
  }

  const cartId =
    typeof body.cartId === "string" && body.cartId.trim()
      ? body.cartId.trim()
      : undefined;

  const discountCode =
    typeof body.discountCode === "string" && body.discountCode.trim()
      ? body.discountCode.trim()
      : undefined;

  const instapayAccount = process.env.INSTAPAY_ACCOUNT_NAME ?? process.env.VITE_INSTAPAY_ACCOUNT_NAME ?? "";
  const instapayNumber = process.env.INSTAPAY_ACCOUNT_NUMBER ?? process.env.VITE_INSTAPAY_ACCOUNT_NUMBER ?? "";

  req.log.info({ lineCount: lines.length, discountCode, cartId }, "Instapay init — creating draft order");

  try {
    const result = await createDraftOrder({
      lines,
      customer,
      paymentMethod: "instapay",
      cartId,
      discountCode,
      extraTags: "instapay-pending-verification",
      complete: false,
    });

    req.log.info({ shopifyOrderId: result.orderId, shopifyOrderNumber: result.orderNumber }, "Instapay init — order created");

    res.status(200).json({
      success: true,
      instapayAccount,
      instapayNumber,
      draftOrderId: result.draftOrderId,
      shopifyOrderId: result.orderId,
      shopifyOrderNumber: result.orderNumber,
      total: result.total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order creation failed";
    req.log.error({ err }, "Instapay init — order creation failed");
    if (message.includes("not applicable")) {
      res.status(422).json({ error: message });
    } else {
      res.status(500).json({ error: "Could not place your order. Please try again." });
    }
  }
});

/**
 * POST /api/orders/create
 *
 * COD only. Instapay orders are now created atomically at proof upload time.
 */
router.post("/orders/create", async (req, res) => {
  const body = req.body as CreateOrderBody;

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "No items in order." });
    return;
  }

  const lines = validateLines(body.lines as unknown[]);
  if (!lines) {
    res.status(400).json({ error: "Invalid variant ID or quantity in order lines." });
    return;
  }

  const customer = validateCustomer(body.customer);
  if (!customer) {
    res.status(400).json({ error: "All customer fields are required." });
    return;
  }

  const paymentMethod = body.paymentMethod as string | undefined;
  if (paymentMethod !== "cod") {
    res.status(400).json({ error: "Only COD orders are accepted at this endpoint." });
    return;
  }

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
    "Creating COD order",
  );

  try {
    const { orderNumber, orderId, total, lineItems } = await createDraftOrder({
      lines,
      customer,
      paymentMethod: "cod",
      cartId,
      discountCode,
    });

    req.log.info({ orderNumber, orderId }, "COD order created");

    // Branded order confirmation email (fire-and-forget)
    if (customer.email) {
      const { html, text } = buildCODOrderEmail({
        orderNumber,
        customerName: customer.firstName,
        total,
        address: customer.address,
        governorate: customer.governorate,
        city: customer.city,
        lineItems: lineItems,
      });
      void sendEmail({
        to: customer.email,
        subject: `Your Moi order #${orderNumber} has been placed`,
        html,
        text,
      })
        .then(() => req.log.info({ email: customer.email, orderNumber }, "COD order confirmation email sent"))
        .catch((err) => req.log.warn({ err, email: customer.email }, "COD order confirmation email failed"));
    }

    void sendWhatsApp(
      customer.phone,
      `✅ Your Moi order #${orderNumber} has been placed!\n\nTotal: ${total} EGP (includes 50 EGP shipping)\nComplimentary shipping on orders over 2,000 EGP\nPayment: Cash on Delivery\n\nOur team will contact you shortly. Thank you for shopping with Moi. 🖤`,
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

    res.status(200).json({
      success: true,
      orderNumber,
      orderId,
      shopifyOrderId: orderId,
      total,
      paymentMethod: "cod",
    });
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
