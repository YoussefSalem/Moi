import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getPaymobConfig } from "../lib/paymobConfig";
import { createPaymobPaymentKey } from "../lib/paymob";
import { fetchStorefrontCart, type OrderLine, type CustomerInfo, type OrderAttribution } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

const router: IRouter = Router();

const SHIPPING_EGP = 50;

/**
 * POST /api/orders/paymob-init
 *
 * Creates a Paymob payment key (legacy 3-step flow) for card payments.
 * Uses the iframe at accept.paymob.com/api/acceptance/iframes/{iframeId}.
 *
 * Returns { iframeUrl, intentId, total }.
 */
router.post("/orders/paymob-init", async (req, res) => {
  const config = getPaymobConfig();

  if (!config.apiKey) {
    res.status(503).json({ error: "Payment gateway is not configured." });
    return;
  }
  if (!config.integrationId) {
    res.status(503).json({ error: "Payment gateway integration is not configured." });
    return;
  }
  if (!config.iframeId) {
    res.status(503).json({ error: "Payment gateway iframe is not configured." });
    return;
  }

  const body = req.body as {
    lines?: unknown;
    customer?: unknown;
    cartId?: unknown;
    discountCode?: unknown;
    attribution?: unknown;
    checkoutToken?: unknown;
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
  const checkoutToken = typeof body.checkoutToken === "string" && body.checkoutToken.trim() ? body.checkoutToken.trim() : null;

  let attribution: OrderAttribution | undefined;
  if (body.attribution && typeof body.attribution === "object") {
    const a = body.attribution as Record<string, unknown>;
    attribution = {};
    if (typeof a.sourceName === "string") attribution.sourceName = a.sourceName;
    if (typeof a.referringSite === "string") attribution.referringSite = a.referringSite;
    if (typeof a.landingSite === "string") attribution.landingSite = a.landingSite;
    if (typeof a.fbclid === "string") attribution.fbclid = a.fbclid;
    if (typeof a.gclid === "string") attribution.gclid = a.gclid;
    if (typeof a.ttclid === "string") attribution.ttclid = a.ttclid;
    if (a.utm && typeof a.utm === "object") {
      attribution.utm = Object.fromEntries(
        Object.entries(a.utm as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
    }
    if (Object.keys(attribution).length === 0) attribution = undefined;
  }

  if (!cartId) {
    res.status(400).json({ error: "Cart ID is required for card payments." });
    return;
  }

  req.log.info({ lineCount: lines.length }, "Paymob init — computing total from Storefront cart");

  const cart = await fetchStorefrontCart(cartId);
  if (!cart) {
    res.status(400).json({ error: "Could not load your cart. Please try again." });
    return;
  }

  if (discountCode && cart.discountCodes.length > 0) {
    const applicable = cart.discountCodes.find((d) => d.applicable);
    if (!applicable) {
      res.status(422).json({ error: `Discount code "${discountCode}" is not applicable to this order.` });
      return;
    }
  }

  const cartTotalEGP = cart.totalAmount;
  const isFreeShipping = cartTotalEGP >= 2000;
  const shippingEGP = isFreeShipping ? 0 : SHIPPING_EGP;
  const totalEGP = cartTotalEGP + shippingEGP;
  const amountCents = Math.round(totalEGP * 100);
  const total = totalEGP.toFixed(2);

  const intentId = randomUUID();

  await db.insert(paymobIntents).values({
    intentId,
    lines: lines as unknown as Record<string, unknown>[],
    customer: customer as unknown as Record<string, unknown>,
    cartId,
    discountCode: discountCode ?? null,
    amountCents,
    total,
    status: "pending",
    attribution: attribution as Record<string, unknown> | null ?? null,
    checkoutToken,
  });

  req.log.info({ intentId, amountCents, total }, "Paymob card intent saved — creating legacy payment key");

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const redirectionUrl = domain ? `https://${domain}/paymob-relay.html` : undefined;

  let iframeUrl: string;
  try {
    const result = await createPaymobPaymentKey({
      amountCents,
      merchantOrderId: intentId,
      customer: {
        firstName: customer.firstName.trim(),
        lastName: customer.lastName.trim(),
        email: customer.email?.trim(),
        phone: customer.phone.trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
      },
      redirectionUrl,
    });
    iframeUrl = result.iframeUrl;
  } catch (err) {
    req.log.error({ err, intentId }, "Paymob card payment key creation failed");
    res.status(500).json({ error: "Payment gateway unavailable. Please try again." });
    return;
  }

  req.log.info({ intentId, iframeUrl }, "Paymob card payment key created — iframe ready");

  res.status(200).json({
    iframeUrl,
    intentId,
    total,
  });
});

export default router;
