import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getPaymobConfig } from "../lib/paymobConfig";
import { fetchStorefrontCart, type OrderLine, type CustomerInfo, type OrderAttribution } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

const router: IRouter = Router();

const SHIPPING_EGP = 50;

/**
 * POST /api/orders/paymob-apple-pay-init
 *
 * Creates a Paymob Intention (Unified Checkout v1) for Apple Pay.
 * Returns { clientSecret, publicKey, intentId, total } which the frontend
 * uses to initialise the Paymob JS SDK and display the native Apple Pay button.
 *
 * The Paymob Intentions API endpoint: POST https://accept.paymob.com/v1/intention/
 * Auth: Authorization: Token {secretKey}
 */
router.post("/orders/paymob-apple-pay-init", async (req, res) => {
  const config = getPaymobConfig();

  if (!config.secretKey) {
    res.status(503).json({ error: "Payment gateway is not configured." });
    return;
  }
  if (!config.publicKey) {
    res.status(503).json({ error: "Payment gateway public key is not configured." });
    return;
  }

  // Use the dedicated Apple Pay integration ID if set, otherwise fall back to the card integration ID
  const rawIntegrationId = config.applePayIntegrationId || config.integrationId;
  if (!rawIntegrationId) {
    res.status(503).json({ error: "Paymob integration is not configured. Please contact support." });
    return;
  }

  const applePayIntegrationIdNum = parseInt(rawIntegrationId, 10);
  if (isNaN(applePayIntegrationIdNum) || applePayIntegrationIdNum <= 0) {
    res.status(503).json({ error: "Paymob integration ID is invalid. Please contact support." });
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
    res.status(400).json({ error: "Cart ID is required for Apple Pay." });
    return;
  }

  req.log.info({ lineCount: lines.length }, "Paymob Apple Pay init — computing total from Storefront cart");

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

  req.log.info({ intentId, amountCents, total }, "Paymob Apple Pay intent saved — creating Unified Checkout intention");

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const redirectionUrl = domain ? `https://${domain}/paymob-relay.html` : undefined;
  const notificationUrl = domain ? `https://${domain}/api/webhooks/paymob` : undefined;

  const intentionBody: Record<string, unknown> = {
    amount: amountCents,
    currency: "EGP",
    payment_methods: [applePayIntegrationIdNum],
    items: [
      {
        name: "Moi Order",
        amount: amountCents,
        description: "Fashion order",
        quantity: 1,
      },
    ],
    billing_data: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email ?? "NA",
      phone_number: customer.phone,
      street: customer.address,
      city: customer.city,
      country: "EG",
      state: "NA",
      postal_code: "NA",
      apartment: "NA",
      floor: "NA",
      building: "NA",
    },
    customer: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email ?? "NA",
    },
    extras: {
      merchant_order_id: intentId,
    },
    merchant_order_id: intentId,
  };

  if (redirectionUrl) intentionBody["redirection_url"] = redirectionUrl;
  if (notificationUrl) intentionBody["notification_url"] = notificationUrl;

  let clientSecret: string;
  try {
    const intentionRes = await fetch("https://accept.paymob.com/v1/intention/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${config.secretKey}`,
      },
      body: JSON.stringify(intentionBody),
    });

    if (!intentionRes.ok) {
      const text = await intentionRes.text();
      req.log.error({ status: intentionRes.status, text, intentId }, "Paymob Intentions API failed");
      res.status(500).json({ error: "Apple Pay is unavailable right now. Please try another payment method." });
      return;
    }

    const intentionData = await intentionRes.json() as { client_secret?: string };
    if (!intentionData.client_secret) {
      req.log.error({ intentionData, intentId }, "Paymob Intentions API returned no client_secret");
      res.status(500).json({ error: "Apple Pay is unavailable right now. Please try another payment method." });
      return;
    }
    clientSecret = intentionData.client_secret;
  } catch (err) {
    req.log.error({ err, intentId }, "Paymob Apple Pay intention creation failed");
    res.status(500).json({ error: "Apple Pay is unavailable right now. Please try another payment method." });
    return;
  }

  req.log.info({ intentId }, "Paymob Apple Pay intention created successfully");

  res.status(200).json({
    clientSecret,
    publicKey: config.publicKey,
    intentId,
    total,
  });
});

export default router;
