import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { createCardPaymentKey } from "../lib/paymob";
import { fetchStorefrontCart, type OrderLine, type CustomerInfo, type OrderAttribution } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

const router: IRouter = Router();
const SHIPPING_EGP = 50;

/**
 * POST /api/orders/paymob-init
 *
 * Initializes a Paymob card payment:
 * 1. Validates the request (line items + customer details)
 * 2. Fetches the live Shopify cart total
 * 3. Creates a paymob_intents record in the DB
 * 4. Runs the Paymob 3-step auth flow to obtain an iframe URL
 * 5. Returns { iframeUrl, intentId, total }
 */
router.post("/orders/paymob-init", async (req, res) => {
  const body = req.body as {
    lines?: unknown;
    customer?: unknown;
    cartId?: unknown;
    discountCode?: unknown;
    attribution?: unknown;
    checkoutToken?: unknown;
  };

  // Validate line items
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

  // Validate customer
  const customer = body.customer as CustomerInfo | undefined;
  if (
    !customer?.firstName?.trim() || !customer?.lastName?.trim() ||
    !customer?.phone?.trim() || !customer?.address?.trim() ||
    !customer?.governorate?.trim() || !customer?.city?.trim()
  ) {
    res.status(400).json({ error: "All customer fields are required." });
    return;
  }

  const cartId = typeof body.cartId === "string" && body.cartId.trim() ? body.cartId.trim() : undefined;
  if (!cartId) {
    res.status(400).json({ error: "Cart ID is required for card payments." });
    return;
  }

  const lines = body.lines as OrderLine[];
  const discountCode = typeof body.discountCode === "string" && body.discountCode.trim()
    ? body.discountCode.trim() : undefined;
  const checkoutToken = typeof body.checkoutToken === "string" && body.checkoutToken.trim()
    ? body.checkoutToken.trim() : null;

  // Parse attribution
  let attribution: OrderAttribution | undefined;
  if (body.attribution && typeof body.attribution === "object") {
    const a = body.attribution as Record<string, unknown>;
    const built: OrderAttribution = {};
    if (typeof a.sourceName === "string") built.sourceName = a.sourceName;
    if (typeof a.referringSite === "string") built.referringSite = a.referringSite;
    if (typeof a.landingSite === "string") built.landingSite = a.landingSite;
    if (typeof a.fbclid === "string") built.fbclid = a.fbclid;
    if (typeof a.gclid === "string") built.gclid = a.gclid;
    if (typeof a.ttclid === "string") built.ttclid = a.ttclid;
    if (a.utm && typeof a.utm === "object") {
      built.utm = Object.fromEntries(
        Object.entries(a.utm as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
    }
    if (Object.keys(built).length > 0) attribution = built;
  }

  // Fetch live cart total from Shopify
  req.log.info({ lineCount: lines.length }, "paymob-init: fetching cart total");
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

  const totalEGP = cart.totalAmount + SHIPPING_EGP;
  const amountCents = Math.round(totalEGP * 100);
  const total = totalEGP.toFixed(2);
  const intentId = randomUUID();

  // Persist intent
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

  req.log.info({ intentId, amountCents, total }, "paymob-init: intent saved — creating payment key");

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const redirectionUrl = domain ? `https://${domain}/api/paymob-return` : undefined;
  const callbackUrl = domain ? `https://${domain}/api/webhooks/paymob` : undefined;

  try {
    const { iframeUrl } = await createCardPaymentKey({
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
      redirectionUrl,
      callbackUrl,
    });

    req.log.info({ intentId }, "paymob-init: iframe URL ready");
    res.status(200).json({ iframeUrl, intentId, total });
  } catch (err) {
    req.log.error({ err, intentId }, "paymob-init: payment key creation failed");
    res.status(500).json({ error: "Payment gateway unavailable. Please try again." });
  }
});

export default router;
