import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getPaymobConfig } from "../lib/paymobConfig";
import { type OrderLine, type CustomerInfo, type OrderAttribution } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

const SHIPPING_EGP = 50;

/**
 * POST /api/apple-pay/validate-merchant
 *
 * Called by the frontend's ApplePaySession.onvalidatemerchant callback.
 * 1. Creates a Paymob intent record in the DB.
 * 2. Calls Paymob's merchant validation endpoint (no auth required).
 * Returns { merchantSession, intentId }.
 */
router.post("/apple-pay/validate-merchant", async (req, res) => {
  const config = getPaymobConfig();
  // Apple Pay uses its own dedicated Paymob integration (applePayIntegrationId),
  // which must have Apple Pay enabled in the Paymob dashboard.
  if (!config.applePayIntegrationId) {
    res.status(503).json({ error: "Apple Pay is not configured." });
    return;
  }

  const body = req.body as {
    validationURL?: unknown;
    lines?: unknown;
    totalAmountCents?: unknown;
    discountCode?: unknown;
    attribution?: unknown;
  };

  if (typeof body.validationURL !== "string" || !body.validationURL) {
    res.status(400).json({ error: "validationURL is required." });
    return;
  }

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

  const clientTotalAmountCents =
    typeof body.totalAmountCents === "number" &&
    Number.isFinite(body.totalAmountCents) &&
    body.totalAmountCents > 0
      ? Math.round(body.totalAmountCents)
      : undefined;

  if (!clientTotalAmountCents) {
    res.status(400).json({ error: "totalAmountCents is required." });
    return;
  }

  const amountCents = clientTotalAmountCents;
  const total = (amountCents / 100).toFixed(2);
  const lines = body.lines as OrderLine[];
  const discountCode =
    typeof body.discountCode === "string" && body.discountCode.trim()
      ? body.discountCode.trim()
      : undefined;

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

  const intentId = randomUUID();

  await db.insert(paymobIntents).values({
    intentId,
    lines: lines as unknown as Record<string, unknown>[],
    customer: {
      firstName: "Apple",
      lastName: "Pay",
      email: "NA",
      phone: "NA",
      address: "NA",
      city: "Cairo",
      governorate: "NA",
    } as unknown as Record<string, unknown>,
    cartId: null,
    discountCode: discountCode ?? null,
    amountCents,
    total,
    status: "pending",
    attribution: attribution as Record<string, unknown> | null ?? null,
    checkoutToken: null,
  });

  req.log.info({ intentId, amountCents, total }, "Apple Pay: intent saved — calling Paymob merchant validate");

  try {
    const validationRes = await fetch(
      "https://accept.paymob.com/api/auth/merchant/validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appleURL: body.validationURL,
          integrationId: config.applePayIntegrationId,
        }),
      },
    );

    // Paymob returns HTTP 400 even on success — check body instead of status
    const text = await validationRes.text();
    let data: { api_response?: unknown };
    try {
      data = JSON.parse(text) as { api_response?: unknown };
    } catch {
      throw new Error(`Paymob merchant validation returned non-JSON (${validationRes.status}): ${text}`);
    }
    if (!data.api_response) {
      throw new Error(`Paymob merchant validation failed (${validationRes.status}): ${text}`);
    }

    const sess = data.api_response as Record<string, unknown>;
    req.log.info(
      {
        intentId,
        sessionDomainName: sess.domainName,
        sessionDisplayName: sess.displayName,
        sessionMerchantId: sess.merchantIdentifier,
        sessionKeys: Object.keys(sess),
      },
      "Apple Pay: merchant validation complete",
    );

    res.status(200).json({
      merchantSession: data.api_response,
      intentId,
      total,
      shippingEGP: SHIPPING_EGP,
    });
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay: merchant validation failed");
    await db.delete(paymobIntents).where(eq(paymobIntents.intentId, intentId));
    res.status(500).json({ error: "Apple Pay is unavailable right now. Please try another payment method." });
  }
});

/**
 * POST /api/apple-pay/authorize
 *
 * Called by the frontend's ApplePaySession.onpaymentauthorized callback.
 * 1. Updates the intent's customer info with Apple Pay shippingContact data.
 * 2. Creates a Paymob Intention (v1, using secretKey) for the order amount.
 * 3. Charges it immediately with the Apple Pay token via v1/payments/pay.
 * 4. On success, calls processPaymobSuccess to create the Shopify order.
 * Returns { success, txnId, shopifyOrderNumber, total }.
 */
router.post("/apple-pay/authorize", async (req, res) => {
  const config = getPaymobConfig();

  const body = req.body as {
    paymentData?: unknown;
    intentId?: unknown;
    shippingContact?: unknown;
  };

  if (typeof body.paymentData !== "string" || !body.paymentData) {
    res.status(400).json({ success: false, error: "paymentData is required." });
    return;
  }
  if (typeof body.intentId !== "string" || !body.intentId) {
    res.status(400).json({ success: false, error: "intentId is required." });
    return;
  }

  const { paymentData, intentId } = body as {
    paymentData: string;
    intentId: string;
  };

  const sc = (body.shippingContact ?? {}) as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    governorate?: string;
  };
  const customer: CustomerInfo = {
    firstName: sc.firstName?.trim() || "NA",
    lastName: sc.lastName?.trim() || "NA",
    email: sc.email?.trim() || undefined,
    phone: sc.phone?.trim() || "NA",
    address: sc.address?.trim() || "NA",
    city: sc.city?.trim() || "Cairo",
    governorate: sc.governorate?.trim() || "NA",
  };

  const existing = await db
    .select({
      intentId: paymobIntents.intentId,
      amountCents: paymobIntents.amountCents,
      status: paymobIntents.status,
      total: paymobIntents.total,
    })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  if (existing.length === 0) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }
  if (existing[0].status !== "pending") {
    res.status(409).json({ success: false, error: "Order already processed." });
    return;
  }

  const { amountCents, total } = existing[0];

  await db
    .update(paymobIntents)
    .set({ customer: customer as unknown as Record<string, unknown> })
    .where(eq(paymobIntents.intentId, intentId));

  req.log.info({ intentId, amountCents }, "Apple Pay: creating Paymob intention");

  // Step 1: Create a Paymob Intention (modern API, uses secretKey)
  let clientSecret: string;
  try {
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
    const notificationUrl = domain ? `https://${domain}/api/webhooks/paymob` : undefined;

    const intentionBody: Record<string, unknown> = {
      amount: amountCents,
      currency: "EGP",
      payment_methods: [parseInt(config.applePayIntegrationId, 10)],
      items: [{ name: "Moi Order", amount: amountCents, description: "Fashion order", quantity: 1 }],
      billing_data: {
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email || "guest@buy-moi.com",
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
        email: customer.email || "guest@buy-moi.com",
      },
      extras: { merchant_order_id: intentId },
      merchant_order_id: intentId,
    };
    if (notificationUrl) intentionBody["notification_url"] = notificationUrl;

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
      req.log.error({ status: intentionRes.status, text, intentId }, "Apple Pay: Paymob intention creation failed");
      res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
      return;
    }

    const intentionData = await intentionRes.json() as { client_secret?: string };
    if (!intentionData.client_secret) {
      req.log.error({ intentionData, intentId }, "Apple Pay: Paymob intention returned no client_secret");
      res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
      return;
    }
    clientSecret = intentionData.client_secret;
    req.log.info({ intentId }, "Apple Pay: Paymob intention created — charging with token");
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay: intention creation threw");
    res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
    return;
  }

  // Step 2: Charge the intention with the Apple Pay token
  let paymobSuccess = false;
  let paymobTxnId: string | undefined;

  try {
    const payRes = await fetch(
      `https://accept.paymob.com/v1/payments/pay/?publicKey=${encodeURIComponent(config.publicKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_token: clientSecret,
          source: { identifier: paymentData, subtype: "APPLE_PAY" },
        }),
      },
    );

    const payData = await payRes.json() as {
      success?: boolean | string;
      pending?: boolean | string;
      id?: number | string;
      obj?: { id?: number | string; success?: boolean | string };
    };

    const txnId = String(payData.id ?? payData.obj?.id ?? "");
    paymobTxnId = txnId || undefined;
    const successVal = String(payData.success ?? payData.obj?.success ?? "false");

    req.log.info(
      { intentId, paymobSuccess: successVal, txnId, status: payRes.status, payData },
      "Apple Pay: Paymob pay response",
    );

    if (successVal === "true") paymobSuccess = true;
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay: Paymob pay request failed");
    res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
    return;
  }

  if (!paymobSuccess) {
    await db
      .update(paymobIntents)
      .set({ status: "failed" })
      .where(eq(paymobIntents.intentId, intentId));
    res.status(200).json({ success: false, error: "Payment was declined. Please try another card." });
    return;
  }

  try {
    await processPaymobSuccess({
      intentId,
      paymobTxnId: paymobTxnId ?? `apple-pay-${intentId}`,
      amountCents,
      paymentChannel: "apple-pay",
    });
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay: processPaymobSuccess failed");
  }

  const updated = await db
    .select({ shopifyOrderId: paymobIntents.shopifyOrderId, shopifyOrderNumber: paymobIntents.shopifyOrderNumber })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  req.log.info(
    { intentId, paymobTxnId, shopifyOrderNumber: updated[0]?.shopifyOrderNumber },
    "Apple Pay: payment complete",
  );

  res.status(200).json({
    success: true,
    txnId: paymobTxnId,
    shopifyOrderId: updated[0]?.shopifyOrderId ?? null,
    shopifyOrderNumber: updated[0]?.shopifyOrderNumber ?? null,
    total,
  });
});

export default router;
