import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { createPaymobIntention } from "../lib/paymob";
import { fetchStorefrontCart, type OrderLine, type CustomerInfo } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";

const router: IRouter = Router();

const SHIPPING_EGP = 120;

router.post("/orders/paymob-init", async (req, res) => {
  const body = req.body as {
    lines?: unknown;
    customer?: unknown;
    cartId?: unknown;
    discountCode?: unknown;
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
  });

  req.log.info({ intentId, amountCents, total }, "Paymob intent saved — creating Paymob intention");

  let intention: { clientSecret: string; publicKey: string };
  try {
    intention = await createPaymobIntention({
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
    });
  } catch (err) {
    req.log.error({ err, intentId }, "Paymob intention creation failed");
    res.status(500).json({ error: "Payment gateway unavailable. Please try again." });
    return;
  }

  req.log.info({ intentId }, "Paymob intention created successfully");

  res.status(200).json({
    clientSecret: intention.clientSecret,
    publicKey: intention.publicKey,
    intentId,
    total,
  });
});

export default router;
