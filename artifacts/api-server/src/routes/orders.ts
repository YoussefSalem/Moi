import { Router, type IRouter } from "express";
import {
  sendWhatsApp,
  createBostaShipment,
  addShopifyOrderNote,
  tagShopifyOrder,
  completeShopifyCheckout,
  createShopifyFulfillment,
  addShopifyFulfillmentEvent,
} from "../lib/integrations";
import {
  createDraftOrder,
  createShopifyDirectOrder,
  extractVariantId,
  lookupDiscountCode,
  recordDiscountCodeUse,
  type OrderLine,
  type CustomerInfo,
  type OrderAttribution,
} from "../lib/shopifyOrder";
import { sendEmail, buildCODOrderEmail } from "../lib/email";
import { parseEGP } from "@workspace/utils";

const router: IRouter = Router();

interface CreateOrderBody {
  lines?: unknown;
  customer?: unknown;
  paymentMethod?: unknown;
  discountCode?: unknown;
  cartId?: unknown;
  attribution?: unknown;
  checkoutToken?: unknown;
}

function extractAttribution(body: CreateOrderBody): OrderAttribution | undefined {
  const raw = body.attribution;
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const attr: OrderAttribution = {};
  if (typeof a.sourceName === "string") attr.sourceName = a.sourceName;
  if (typeof a.referringSite === "string") attr.referringSite = a.referringSite;
  if (typeof a.landingSite === "string") attr.landingSite = a.landingSite;
  if (typeof a.fbclid === "string") attr.fbclid = a.fbclid;
  if (typeof a.gclid === "string") attr.gclid = a.gclid;
  if (typeof a.ttclid === "string") attr.ttclid = a.ttclid;
  if (a.utm && typeof a.utm === "object") {
    attr.utm = Object.fromEntries(
      Object.entries(a.utm as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  }
  return Object.keys(attr).length > 0 ? attr : undefined;
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

function validateEmail(email: string | undefined): string | undefined {
  if (!email || !email.trim()) return undefined;
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : undefined;
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
  const validated = c as unknown as CustomerInfo;
  validated.email = validateEmail(c.email as string);
  return validated;
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

  const checkoutToken =
    typeof body.checkoutToken === "string" && body.checkoutToken.trim()
      ? body.checkoutToken.trim()
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
      attribution: extractAttribution(body),
    });

    req.log.info({ shopifyOrderId: result.orderId, shopifyOrderNumber: result.orderNumber }, "Instapay init — order created");

    // Record discount code use so Shopify's usage_limit is enforced across API orders
    if (discountCode && result.discountAmount) {
      void recordDiscountCodeUse(discountCode, result.orderId, result.orderNumber, "instapay");
    }

    // Mark the Shopify abandoned checkout as complete (fire-and-forget)
    if (checkoutToken) {
      void completeShopifyCheckout(checkoutToken);
    }

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
  const checkoutToken =
    typeof body.checkoutToken === "string" && body.checkoutToken.trim()
      ? body.checkoutToken.trim()
      : undefined;

  req.log.info(
    { paymentMethod, lineCount: lines.length, discountCode, cartId },
    "Creating COD order",
  );

  try {
    const result = await createShopifyDirectOrder({
      lines,
      customer,
      paymentMethod: "cod",
      cartId,
      discountCode,
      attribution: extractAttribution(body),
    });
    const { orderNumber, orderId, total, lineItems } = result;

    req.log.info({ orderNumber, orderId }, "COD order created");

    // Record discount code use so Shopify's usage_limit is enforced across API orders
    if (discountCode && result.discountAmount) {
      void recordDiscountCodeUse(discountCode, orderId, orderNumber, "cod");
    }

    // Branded order confirmation email (fire-and-forget)
    if (customer.email) {
      const shippingPrice = result.shippingAmount ?? (parseEGP(total) >= 2000 ? "0.00" : "50.00");
      const { html, text } = buildCODOrderEmail({
        orderNumber,
        customerName: customer.firstName,
        total,
        address: customer.address,
        governorate: customer.governorate,
        city: customer.city,
        lineItems: lineItems,
        discountAmount: result.discountAmount ? result.discountAmount.toFixed(2) : undefined,
        discountCode: result.discountCode || undefined,
        shippingAmount: shippingPrice,
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

    const shippingNum = parseFloat(result.shippingAmount ?? "50.00");
    const whatsappShippingNote = shippingNum === 0
      ? "Complimentary shipping"
      : `Includes ${shippingNum.toFixed(0)} EGP shipping`;
    void sendWhatsApp(
      customer.phone,
      `✅ Your Moi order #${orderNumber} has been placed!\n\nTotal: ${total} EGP (${whatsappShippingNote})\nPayment: Cash on Delivery\n\nOur team will contact you shortly. Thank you for shopping with Moi. 🖤`,
    );

    // Immediately create a Shopify fulfillment (no tracking number yet) so the
    // order shows as "fulfilled" before the Bosta Shopify App's orders/create
    // webhook fires. If the App sees fulfillment_status:"fulfilled" it skips
    // creating a competing Bosta shipment (which would have cod: 0 / "No Cash
    // Collection"). We then call our own Bosta API and update with real tracking.
    const earlyFulfillmentId = await createShopifyFulfillment(orderId);
    if (earlyFulfillmentId) {
      req.log.info({ orderId, orderNumber }, "COD early fulfillment created to block Bosta App duplicate");
    } else {
      req.log.warn({ orderId, orderNumber }, "COD early fulfillment failed — Bosta App may create duplicate shipment");
    }

    const trackingNumber = await createBostaShipment({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      orderReference: `#${orderNumber}`,
      codAmount: parseEGP(total),
      items: lineItems,
    });

    if (trackingNumber) {
      void addShopifyOrderNote(orderId, `Bosta tracking: ${trackingNumber}`);
      void tagShopifyOrder(orderId, `bosta-${trackingNumber}`);
      req.log.info({ trackingNumber, orderNumber }, "Bosta COD shipment created");

      if (earlyFulfillmentId) {
        void addShopifyFulfillmentEvent(orderId, earlyFulfillmentId, "in_transit");
      } else {
        // Fallback: create a new fulfillment with the real tracking number
        const fulfillmentId = await createShopifyFulfillment(orderId, trackingNumber);
        if (fulfillmentId) {
          void addShopifyFulfillmentEvent(orderId, fulfillmentId, "in_transit");
        }
      }
    }

    // Mark the Shopify abandoned checkout as complete (fire-and-forget)
    if (checkoutToken) {
      void completeShopifyCheckout(checkoutToken);
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

/**
 * GET /api/orders/discount-lookup?code=DODO15&subtotal=899
 *
 * Looks up a discount code via the Shopify Admin API and returns the
 * discount amount for the given subtotal. Used by the frontend to show
 * the correct discounted price before placing the order, since Shopify's
 * Storefront API doesn't reflect discount codes in cart.cost.totalAmount.
 */
router.get("/orders/discount-lookup", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  const subtotalRaw = typeof req.query.subtotal === "string" ? parseFloat(req.query.subtotal) : NaN;

  if (!code || isNaN(subtotalRaw) || subtotalRaw <= 0) {
    res.status(400).json({ error: "Missing or invalid code / subtotal" });
    return;
  }

  const result = await lookupDiscountCode(code, subtotalRaw);
  if (!result) {
    res.status(404).json({ applicable: false, discountAmount: 0, code });
    return;
  }

  res.json({ applicable: true, discountAmount: result.discountAmount, code: result.discountCode });
});

export default router;
