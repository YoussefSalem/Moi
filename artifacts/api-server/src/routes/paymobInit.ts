import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { createPaymobIntentionKey } from "../lib/paymob";
import { fetchStorefrontCart, type OrderLine, type CustomerInfo, type OrderAttribution } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

const router: IRouter = Router();

const SHIPPING_EGP = 50;

router.post("/orders/paymob-init", async (req, res) => {
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

  // Extract attribution from request body
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

  let cart: Awaited<ReturnType<typeof fetchStorefrontCart>>;
  try {
    cart = await fetchStorefrontCart(cartId);
  } catch (err) {
    req.log.error({ err, cartId }, "Paymob init — fetchStorefrontCart threw");
    res.status(400).json({ error: "Could not load your cart. Please try again." });
    return;
  }
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
  const totalEGP = cartTotalEGP + SHIPPING_EGP;
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

  req.log.info({ intentId, amountCents, total }, "Paymob intent saved — creating legacy payment key");

  // Build callback and redirection URLs from the first configured domain.
  // callback_url  = server-to-server transaction notification (POST from Paymob servers)
  // redirection_url = where the browser/iframe navigates after payment completes
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const callbackUrl = domain ? `https://${domain}/api/webhooks/paymob` : undefined;
  const redirectionUrl = domain ? `https://${domain}/paymob-relay.html` : undefined;

  let result: { iframeUrl: string };
  try {
    result = await createPaymobIntentionKey({
      amountCents,
      merchantOrderId: intentId,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
      },
      callbackUrl,
      redirectionUrl,
    });
  } catch (err) {
    req.log.error({ err, intentId }, "Paymob payment key creation failed");
    res.status(500).json({ error: "Payment gateway unavailable. Please try again." });
    return;
  }

  req.log.info({ intentId }, "Paymob legacy payment key created successfully");

  res.status(200).json({
    iframeUrl: result.iframeUrl,
    intentId,
    total,
  });
});

export default router;
