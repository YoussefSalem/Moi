import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getPaymobConfig } from "../lib/paymobConfig";
import { createApplePayPaymentKeyRaw } from "../lib/paymob";
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
 * 2. Obtains a Paymob legacy payment key (for Apple Pay integration).
 * 3. Proxies Apple Pay merchant validation to Paymob.
 * Returns { merchantSession, intentId, paymobPaymentKey, total }.
 */
router.post("/apple-pay/validate-merchant", async (req, res) => {
  const config = getPaymobConfig();
  if (!config.apiKey || !(config.applePayIntegrationId || config.integrationId)) {
    res.status(503).json({ error: "Payment gateway is not configured." });
    return;
  }

  const applePayIntegrationId = config.applePayIntegrationId || config.integrationId;

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

  req.log.info({ intentId, amountCents, total }, "Apple Pay direct: intent saved — creating payment key");

  let paymobPaymentKey: string;
  let merchantSession: unknown;

  try {
    const [keyResult, validationResult] = await Promise.all([
      createApplePayPaymentKeyRaw({ amountCents, merchantOrderId: intentId }),
      (async () => {
        const validationRes = await fetch(
          "https://accept.paymob.com/api/auth/merchant/validate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appleURL: body.validationURL,
              integrationId: applePayIntegrationId,
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
        return data.api_response;
      })(),
    ]);

    paymobPaymentKey = keyResult.paymentToken;
    merchantSession = validationResult;
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay direct: payment key or merchant validation failed");
    await db.delete(paymobIntents).where(eq(paymobIntents.intentId, intentId));
    res.status(500).json({ error: "Apple Pay is unavailable right now. Please try another payment method." });
    return;
  }

  req.log.info({ intentId }, "Apple Pay direct: payment key and merchant validation complete");

  res.status(200).json({
    merchantSession,
    intentId,
    paymobPaymentKey,
    total,
    shippingEGP: SHIPPING_EGP,
  });
});

/**
 * POST /api/apple-pay/authorize
 *
 * Called by the frontend's ApplePaySession.onpaymentauthorized callback.
 * 1. Updates the intent's customer info with the Apple Pay shippingContact data.
 * 2. Submits the Apple Pay token to Paymob's /api/acceptance/payments/pay.
 * 3. On success, calls processPaymobSuccess to create the Shopify order.
 * Returns { success, txnId, shopifyOrderId, shopifyOrderNumber, total }.
 */
router.post("/apple-pay/authorize", async (req, res) => {
  const body = req.body as {
    paymentData?: unknown;
    intentId?: unknown;
    paymobPaymentKey?: unknown;
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
  if (typeof body.paymobPaymentKey !== "string" || !body.paymobPaymentKey) {
    res.status(400).json({ success: false, error: "paymobPaymentKey is required." });
    return;
  }

  const { paymentData, intentId, paymobPaymentKey } = body as {
    paymentData: string;
    intentId: string;
    paymobPaymentKey: string;
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

  req.log.info({ intentId, amountCents }, "Apple Pay direct: submitting token to Paymob");

  let paymobSuccess = false;
  let paymobTxnId: string | undefined;
  let paymobDeclined = false;

  try {
    const payRes = await fetch("https://accept.paymob.com/api/acceptance/payments/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { identifier: paymentData, subtype: "APPLE_PAY" },
        payment_token: paymobPaymentKey,
      }),
    });

    const payData = await payRes.json() as {
      success?: boolean | string;
      pending?: boolean | string;
      id?: number | string;
      obj?: { id?: number | string; success?: boolean | string };
    };

    const txnId = String(payData.id ?? payData.obj?.id ?? "");
    paymobTxnId = txnId || undefined;

    const successVal = String(payData.success ?? payData.obj?.success ?? "false");
    const pendingVal = String(payData.pending ?? "false");

    if (payRes.status === 200 && successVal === "true") {
      paymobSuccess = true;
    } else if (payRes.status === 200 && successVal === "false" && pendingVal === "false") {
      paymobDeclined = true;
    }

    req.log.info(
      { intentId, paymobSuccess, paymobDeclined, txnId, status: payRes.status },
      "Apple Pay direct: Paymob payment response",
    );
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay direct: Paymob payment request failed");
    res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
    return;
  }

  if (!paymobSuccess) {
    await db
      .update(paymobIntents)
      .set({ status: "failed" })
      .where(eq(paymobIntents.intentId, intentId));

    const errorMsg = paymobDeclined
      ? "Payment was declined. Please try another card."
      : "Payment could not be processed. Please try again.";
    res.status(200).json({ success: false, error: errorMsg });
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
    req.log.error({ err, intentId }, "Apple Pay direct: processPaymobSuccess failed");
  }

  const updated = await db
    .select({
      shopifyOrderId: paymobIntents.shopifyOrderId,
      shopifyOrderNumber: paymobIntents.shopifyOrderNumber,
    })
    .from(paymobIntents)
    .where(eq(paymobIntents.intentId, intentId))
    .limit(1);

  const shopifyOrderId = updated[0]?.shopifyOrderId ?? undefined;
  const shopifyOrderNumber = updated[0]?.shopifyOrderNumber ?? undefined;

  req.log.info(
    { intentId, paymobTxnId, shopifyOrderId, shopifyOrderNumber },
    "Apple Pay direct: payment complete",
  );

  res.status(200).json({
    success: true,
    txnId: paymobTxnId,
    shopifyOrderId: shopifyOrderId ?? null,
    shopifyOrderNumber: shopifyOrderNumber ?? null,
    total,
  });
});

export default router;
