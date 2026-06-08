import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getPaymobConfig } from "../lib/paymobConfig";
import { type OrderLine, type CustomerInfo, type OrderAttribution } from "../lib/shopifyOrder";
import { db } from "@workspace/db";
import { paymobIntents } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { processPaymobSuccess } from "../lib/processPaymobSuccess";

const router: IRouter = Router();

const SHIPPING_EGP = 50;

/**
 * In-memory store: intentId → Paymob client_secret
 *
 * The Paymob intention is created eagerly during validate-merchant (while the
 * user is still reviewing the Apple Pay sheet) so that authorize only needs the
 * single fast v1/payments/pay call — well within the ~30 s Apple Pay window.
 *
 * Entries are deleted on authorize (success or failure) and auto-expire after
 * 10 minutes in case the user abandons.
 */
const pendingSecrets = new Map<string, { clientSecret: string; expiresAt: number }>();

function storeSecret(intentId: string, clientSecret: string) {
  pendingSecrets.set(intentId, { clientSecret, expiresAt: Date.now() + 10 * 60 * 1000 });
  // Passive cleanup of expired entries
  for (const [k, v] of pendingSecrets) {
    if (v.expiresAt < Date.now()) pendingSecrets.delete(k);
  }
}

function consumeSecret(intentId: string): string | null {
  const entry = pendingSecrets.get(intentId);
  if (!entry) return null;
  pendingSecrets.delete(intentId);
  if (entry.expiresAt < Date.now()) return null;
  return entry.clientSecret;
}

/**
 * POST /api/apple-pay/ping
 * Diagnostic endpoint — confirms onpaymentauthorized fires and network is reachable.
 */
router.post("/api/apple-pay/ping", (req, res) => {
  req.log.info({ stage: req.body?.stage ?? "unknown" }, "Apple Pay: ping received");
  res.status(200).json({ ok: true });
});

/**
 * POST /api/apple-pay/validate-merchant
 *
 * Called by the frontend's ApplePaySession.onvalidatemerchant callback.
 * 1. Creates a Paymob intent record in the DB.
 * 2. In parallel:
 *    a. Calls Paymob's merchant validation endpoint.
 *    b. Creates a Paymob Intention (v1) so the client_secret is ready by the
 *       time the user taps Pay — saves one API round-trip from the critical
 *       onpaymentauthorized 30 s window.
 * Returns { merchantSession, intentId }.
 */
router.post("/apple-pay/validate-merchant", async (req, res) => {
  const config = getPaymobConfig();
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

  req.log.info({ intentId, amountCents, total }, "Apple Pay: intent saved — launching merchant validate + intention in parallel");

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const notificationUrl = domain ? `https://${domain}/api/webhooks/paymob` : undefined;

  const intentionBody: Record<string, unknown> = {
    amount: amountCents,
    currency: "EGP",
    payment_methods: [parseInt(config.applePayIntegrationId, 10)],
    items: [{ name: "Moi Order", amount: amountCents, description: "Fashion order", quantity: 1 }],
    billing_data: {
      first_name: "Apple",
      last_name: "Pay",
      email: "guest@buy-moi.com",
      phone_number: "NA",
      street: "NA",
      city: "Cairo",
      country: "EG",
      state: "NA",
      postal_code: "NA",
      apartment: "NA",
      floor: "NA",
      building: "NA",
    },
    customer: { first_name: "Apple", last_name: "Pay", email: "guest@buy-moi.com" },
    extras: { merchant_order_id: intentId },
    merchant_order_id: intentId,
  };
  if (notificationUrl) intentionBody["notification_url"] = notificationUrl;

  // Run merchant validation and Paymob intention creation in parallel
  const [validationResult, intentionResult] = await Promise.allSettled([
    // A: Apple Pay merchant validation
    fetch("https://accept.paymob.com/api/auth/merchant/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appleURL: body.validationURL,
        integrationId: config.applePayIntegrationId,
      }),
    }).then(async (r) => {
      const text = await r.text();
      let data: { api_response?: unknown };
      try {
        data = JSON.parse(text) as { api_response?: unknown };
      } catch {
        throw new Error(`Paymob merchant validation returned non-JSON (${r.status}): ${text}`);
      }
      if (!data.api_response) {
        throw new Error(`Paymob merchant validation failed (${r.status}): ${text}`);
      }
      return data.api_response;
    }),

    // B: Paymob Intention creation (pre-warm so authorize only needs one call)
    fetch("https://accept.paymob.com/v1/intention/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${config.secretKey}`,
      },
      body: JSON.stringify(intentionBody),
    }).then(async (r) => {
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Paymob intention creation failed (${r.status}): ${text}`);
      }
      const d = await r.json() as { client_secret?: string };
      if (!d.client_secret) throw new Error("Paymob intention returned no client_secret");
      return d.client_secret;
    }),
  ]);

  if (validationResult.status === "rejected") {
    req.log.error({ err: validationResult.reason, intentId }, "Apple Pay: merchant validation failed");
    await db.delete(paymobIntents).where(eq(paymobIntents.intentId, intentId));
    res.status(500).json({ error: "Apple Pay is unavailable right now. Please try another payment method." });
    return;
  }

  const merchantSession = validationResult.value;
  const sess = merchantSession as Record<string, unknown>;
  req.log.info(
    {
      intentId,
      sessionDomainName: sess.domainName,
      sessionDisplayName: sess.displayName,
      sessionMerchantId: sess.merchantIdentifier,
      sessionKeys: Object.keys(sess),
      intentionReady: intentionResult.status === "fulfilled",
    },
    "Apple Pay: merchant validation complete",
  );

  // Store client secret for use in authorize (best-effort — authorize will create one if missing)
  if (intentionResult.status === "fulfilled") {
    storeSecret(intentId, intentionResult.value);
    req.log.info({ intentId }, "Apple Pay: Paymob intention pre-warmed successfully");
  } else {
    req.log.warn({ err: intentionResult.reason, intentId }, "Apple Pay: Paymob intention pre-warm failed — will retry in authorize");
  }

  res.status(200).json({
    merchantSession,
    intentId,
    total,
    shippingEGP: SHIPPING_EGP,
  });
});

/**
 * POST /api/apple-pay/authorize
 *
 * Called by the frontend's ApplePaySession.onpaymentauthorized callback.
 * Uses the pre-warmed Paymob client_secret (created during validate-merchant)
 * so only a single fast v1/payments/pay call is needed — safely within the
 * Apple Pay ~30 s timeout window.
 *
 * Shopify order creation, email, and WhatsApp run in the background after
 * the device receives success so they never block the Apple Pay sheet.
 */
router.post("/apple-pay/authorize", async (req, res) => {
  const config = getPaymobConfig();

  const body = req.body as {
    paymentData?: unknown;
    intentId?: unknown;
    shippingContact?: unknown;
  };

  // Log immediately so we can confirm the request arrives even if later steps fail
  req.log.info({ hasPaymentData: !!body.paymentData, hasIntentId: !!body.intentId }, "Apple Pay: authorize request received");

  if (typeof body.paymentData !== "string" || !body.paymentData) {
    res.status(400).json({ success: false, error: "paymentData is required." });
    return;
  }
  if (typeof body.intentId !== "string" || !body.intentId) {
    res.status(400).json({ success: false, error: "intentId is required." });
    return;
  }

  const { paymentData: paymentDataRaw, intentId } = body as {
    paymentData: string;
    intentId: string;
  };

  // Parse the Apple Pay token back to an object — the frontend JSON.stringifies it
  // before sending; Paymob expects the actual token object (not a JSON string).
  let paymentDataObj: unknown;
  try {
    paymentDataObj = JSON.parse(paymentDataRaw);
  } catch {
    req.log.error({ intentId }, "Apple Pay: paymentData is not valid JSON");
    res.status(400).json({ success: false, error: "Invalid paymentData." });
    return;
  }

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
    req.log.warn({ intentId }, "Apple Pay: intent not found");
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }
  if (existing[0].status !== "pending") {
    req.log.warn({ intentId, status: existing[0].status }, "Apple Pay: intent already processed");
    res.status(409).json({ success: false, error: "Order already processed." });
    return;
  }

  const { amountCents, total } = existing[0];

  await db
    .update(paymobIntents)
    .set({ customer: customer as unknown as Record<string, unknown> })
    .where(eq(paymobIntents.intentId, intentId));

  // Retrieve or create Paymob client_secret
  let clientSecret = consumeSecret(intentId);

  if (!clientSecret) {
    req.log.info({ intentId, amountCents }, "Apple Pay: no pre-warmed secret — creating Paymob intention now");
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

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 20_000);
      try {
        const intentionRes = await fetch("https://accept.paymob.com/v1/intention/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Token ${config.secretKey}` },
          body: JSON.stringify(intentionBody),
          signal: ac.signal,
        });

        if (!intentionRes.ok) {
          const text = await intentionRes.text();
          req.log.error({ status: intentionRes.status, text, intentId }, "Apple Pay: Paymob intention creation failed");
          res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
          return;
        }

        const d = await intentionRes.json() as { client_secret?: string };
        if (!d.client_secret) {
          req.log.error({ d, intentId }, "Apple Pay: Paymob intention returned no client_secret");
          res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
          return;
        }
        clientSecret = d.client_secret;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      req.log.error({ err, intentId }, "Apple Pay: intention creation threw");
      res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
      return;
    }
  } else {
    req.log.info({ intentId }, "Apple Pay: using pre-warmed Paymob client_secret");
  }

  req.log.info({ intentId, amountCents }, "Apple Pay: charging with token via v1/payments/pay");

  // Charge with the Apple Pay token (15 s hard timeout)
  let paymobSuccess = false;
  let paymobTxnId: string | undefined;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    let payData: {
      success?: boolean | string;
      pending?: boolean | string;
      id?: number | string;
      obj?: { id?: number | string; success?: boolean | string };
    };
    try {
      const payRes = await fetch(
        `https://accept.paymob.com/v1/payments/pay/?publicKey=${encodeURIComponent(config.publicKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_token: clientSecret,
            source: { identifier: paymentDataObj, subtype: "APPLE_PAY" },
          }),
          signal: ac.signal,
        },
      );
      payData = await payRes.json() as typeof payData;
      req.log.info(
        { intentId, status: payRes.status, payData },
        "Apple Pay: Paymob pay response",
      );
    } finally {
      clearTimeout(timer);
    }

    const txnId = String(payData.id ?? payData.obj?.id ?? "");
    paymobTxnId = txnId || undefined;
    const successVal = String(payData.success ?? payData.obj?.success ?? "false");
    if (successVal === "true") paymobSuccess = true;
  } catch (err) {
    req.log.error({ err, intentId }, "Apple Pay: Paymob pay request failed or timed out");
    res.status(500).json({ success: false, error: "Payment processing failed. Please try again." });
    return;
  }

  if (!paymobSuccess) {
    await db
      .update(paymobIntents)
      .set({ status: "failed" })
      .where(and(eq(paymobIntents.intentId, intentId), eq(paymobIntents.status, "pending")));
    res.status(200).json({ success: false, error: "Payment was declined. Please try another card." });
    return;
  }

  // Respond to Apple Pay IMMEDIATELY — the device has a strict ~30 s timeout.
  // Shopify order creation, emails, and WhatsApp run in the background.
  req.log.info({ intentId, paymobTxnId }, "Apple Pay: payment confirmed — responding to device now");
  res.status(200).json({
    success: true,
    txnId: paymobTxnId,
    shopifyOrderId: null,
    shopifyOrderNumber: null,
    total,
  });

  // Background: create Shopify order, send email, WhatsApp, etc.
  void (async () => {
    try {
      await processPaymobSuccess({
        intentId,
        paymobTxnId: paymobTxnId ?? `apple-pay-${intentId}`,
        amountCents,
        paymentChannel: "apple-pay",
      });
      req.log.info({ intentId, paymobTxnId }, "Apple Pay: background order processing complete");
    } catch (err) {
      req.log.error({ err, intentId }, "Apple Pay: background processPaymobSuccess failed");
    }
  })();
});

export default router;
