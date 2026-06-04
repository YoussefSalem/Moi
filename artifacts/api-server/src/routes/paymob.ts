import { Router, type IRouter } from "express";
import crypto from "crypto";
import {
  createPaymobIntention,
  verifyPaymobHmac,
  getPaymobConfig,
  type PaymobTransaction,
} from "../lib/paymob";
import {
  createDraftOrder,
  completeShopifyDraftOrder,
  extractVariantId,
  validateStockAvailability,
  type OrderLine,
  type CustomerInfo,
  type OrderAttribution,
} from "../lib/shopifyOrder";
import {
  insertPaymobIntent,
  findPaymobIntentByCheckoutToken,
  updatePaymobIntent,
} from "@workspace/db";
import { sendEmail, buildOrderConfirmationEmail } from "../lib/email";
import { sendWhatsApp } from "../lib/integrations";
import { recordDiscountCodeUse } from "../lib/shopifyOrder";
import { addShopifyOrderNote } from "../lib/integrations";
import { getSiteUrl } from "../lib/siteUrl";
import { parseEGP } from "@workspace/utils";

const router: IRouter = Router();

interface CreatePaymentBody {
  lines?: unknown;
  customer?: unknown;
  discountCode?: unknown;
  cartId?: unknown;
  attribution?: unknown;
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
  const validated = c as unknown as CustomerInfo;
  if (c.email && typeof c.email === "string" && c.email.trim()) {
    validated.email = c.email.trim();
  }
  return validated;
}

function extractAttribution(body: CreatePaymentBody): OrderAttribution | undefined {
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

/**
 * POST /api/paymob/create-payment
 *
 * Initiates a Paymob card payment:
 *  1. Validates the order (lines, customer, stock)
 *  2. Creates a Shopify draft order to reserve inventory and compute accurate total
 *  3. Creates a Paymob payment intention
 *  4. Saves to DB and returns clientSecret + publicKey for frontend redirect
 *
 * No Shopify payment transaction APIs are used. Payment source of truth is Paymob.
 */
router.post("/paymob/create-payment", async (req, res) => {
  const body = req.body as CreatePaymentBody;

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

  const stockCheck = await validateStockAvailability(lines);
  if (!stockCheck.ok) {
    req.log.warn({ unavailableVariantIds: stockCheck.unavailableVariantIds }, "Card payment — stock check failed");
    res.status(422).json({ error: "One or more items are out of stock." });
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

  req.log.info({ lineCount: lines.length, discountCode, cartId }, "Card payment — creating draft order");

  let draftResult: Awaited<ReturnType<typeof createDraftOrder>>;
  try {
    draftResult = await createDraftOrder({
      lines,
      customer,
      paymentMethod: "card",
      cartId,
      discountCode,
      extraTags: "card-pending",
      complete: false,
      attribution: extractAttribution(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order creation failed";
    req.log.error({ err }, "Card payment — draft order creation failed");
    if (message.includes("not applicable")) {
      res.status(422).json({ error: message });
    } else {
      res.status(500).json({ error: "Could not initiate payment. Please try again." });
    }
    return;
  }

  const draftOrderId = draftResult.draftOrderId ?? draftResult.orderId;
  const total = draftResult.total;
  const amountCents = Math.round(parseEGP(total) * 100);

  if (amountCents <= 0) {
    req.log.error({ total, amountCents }, "Card payment — invalid total amount");
    res.status(500).json({ error: "Could not compute order total. Please try again." });
    return;
  }

  const checkoutToken = crypto.randomUUID();
  const siteUrl = getSiteUrl();
  const notificationUrl = `${siteUrl}/api/paymob/webhook`;
  const redirectionUrl = `${siteUrl}/payment/return`;

  const items = lines.map((l) => ({
    name: `Product variant ${extractVariantId(l.variantId)}`,
    amount: amountCents,
    description: `Qty ${l.quantity}`,
    quantity: l.quantity,
  }));

  let paymobIntentionId: string;
  let clientSecret: string;
  try {
    const result = await createPaymobIntention({
      amountCents,
      currency: "EGP",
      billingData: {
        first_name: customer.firstName,
        last_name: customer.lastName,
        phone_number: customer.phone,
        email: customer.email ?? "N/A",
        street: customer.address,
        city: customer.city,
        state: customer.governorate,
        country: "EG",
        postal_code: customer.postalCode ?? "NA",
      },
      items,
      specialReference: checkoutToken,
      notificationUrl,
      redirectionUrl,
    });
    paymobIntentionId = result.intentionId;
    clientSecret = result.clientSecret;
  } catch (err) {
    req.log.error({ err }, "Card payment — Paymob intention creation failed");
    res.status(502).json({ error: "Payment provider unavailable. Please try again." });
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await insertPaymobIntent({
      intentId: paymobIntentionId,
      lines: lines as unknown as any,
      customer: customer as unknown as any,
      cartId: cartId ?? null,
      discountCode: discountCode ?? null,
      amountCents,
      total,
      status: "pending",
      shopifyOrderId: draftOrderId,
      attribution: (extractAttribution(body) ?? null) as unknown as any,
      checkoutToken,
    } as any);
  } catch (err) {
    req.log.error({ err, paymobIntentionId }, "Card payment — DB insert failed");
  }

  const { publicKey } = getPaymobConfig();

  req.log.info(
    { draftOrderId, paymobIntentionId, checkoutToken, amountCents },
    "Card payment — intention created successfully",
  );

  res.status(200).json({
    success: true,
    checkoutToken,
    clientSecret,
    publicKey,
    total,
    amountCents,
    draftOrderId,
  });
});

/**
 * POST /api/paymob/webhook
 *
 * Handles Paymob transaction processed webhooks.
 * On success:
 *  - Verifies HMAC
 *  - Completes the Shopify draft order (zero Shopify payment transaction APIs)
 *  - Adds a Paymob payment note to the order
 *  - Sends email + WhatsApp confirmation
 *
 * On failure:
 *  - Marks the DB record as "failed"
 *
 * Raw body is required for HMAC verification (wired in app.ts).
 */
router.post("/paymob/webhook", async (req, res) => {
  const rawBody = req.body as Buffer;

  let payload: { type?: string; obj?: PaymobTransaction };
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as typeof payload;
  } catch {
    req.log.warn("Paymob webhook: invalid JSON body");
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  if (payload.type !== "TRANSACTION" || !payload.obj) {
    res.status(200).json({ ok: true });
    return;
  }

  const txn = payload.obj;

  const receivedHmac = txn.hmac ?? "";
  if (!receivedHmac) {
    req.log.warn({ txnId: txn.id }, "Paymob webhook: missing hmac field — rejecting");
    res.status(401).json({ error: "Missing HMAC" });
    return;
  }

  if (!verifyPaymobHmac(txn, receivedHmac)) {
    req.log.warn({ txnId: txn.id }, "Paymob webhook: HMAC verification failed");
    res.status(401).json({ error: "Invalid HMAC" });
    return;
  }

  const checkoutToken = txn.order?.merchant_order_id ?? "";
  req.log.info(
    { txnId: txn.id, success: txn.success, pending: txn.pending, checkoutToken },
    "Paymob webhook verified",
  );

  res.status(200).json({ ok: true });

  if (!checkoutToken) {
    req.log.warn({ txnId: txn.id }, "Paymob webhook: no merchant_order_id — cannot correlate");
    return;
  }

  let intent;
  try {
    intent = await findPaymobIntentByCheckoutToken(checkoutToken);
  } catch (err) {
    req.log.error({ err, checkoutToken }, "Paymob webhook: DB lookup failed");
    return;
  }

  if (!intent) {
    req.log.warn({ checkoutToken, txnId: txn.id }, "Paymob webhook: no matching intent in DB");
    return;
  }

  if (!txn.success || txn.pending) {
    try {
      if (!txn.success && intent.status !== "failed") {
        await updatePaymobIntent(intent.id, { status: "failed" });
        req.log.info({ intentId: intent.id, txnId: txn.id }, "Paymob webhook: payment failed — intent marked failed");
      }
    } catch (err) {
      req.log.error({ err }, "Paymob webhook: failed to update intent status to failed");
    }
    return;
  }

  if (intent.shopifyConfirmedOrderId) {
    req.log.info({ intentId: intent.id, txnId: txn.id }, "Paymob webhook: already processed — skipping");
    return;
  }

  const paymobTxnId = String(txn.id);

  await updatePaymobIntent(intent.id, {
    status: "paid",
    paymobTxnId,
  }).catch((err) => req.log.error({ err }, "Paymob webhook: failed to mark intent as paid"));

  if (!intent.shopifyOrderId) {
    req.log.error({ intentId: intent.id }, "Paymob webhook: no shopifyOrderId (draft) to complete");
    return;
  }

  const shopifyResult = await completeShopifyDraftOrder(intent.shopifyOrderId).catch((err) => {
    req.log.error({ err, draftOrderId: intent.shopifyOrderId }, "Paymob webhook: failed to complete Shopify draft order");
    return null;
  });

  if (!shopifyResult) {
    req.log.error({ intentId: intent.id, draftOrderId: intent.shopifyOrderId }, "Paymob webhook: Shopify order completion returned null");
    return;
  }

  const { orderId: confirmedOrderId, orderNumber, total, lineItems, discountAmount, discountCode } = shopifyResult;

  await updatePaymobIntent(intent.id, {
    shopifyConfirmedOrderId: confirmedOrderId,
    shopifyOrderNumber: orderNumber,
  }).catch((err) => req.log.error({ err }, "Paymob webhook: failed to update confirmed order ID"));

  req.log.info(
    { confirmedOrderId, orderNumber, intentId: intent.id, txnId: paymobTxnId },
    "Paymob webhook: Shopify order completed successfully",
  );

  const paymobNote = [
    `Paymob Transaction ID: ${paymobTxnId}`,
    `Payment Method: Card`,
    `Paymob Order ID: ${txn.order?.id ?? "N/A"}`,
    `Payment Status: Paid`,
  ].join("\n");

  void addShopifyOrderNote(confirmedOrderId, paymobNote).catch((err) =>
    req.log.warn({ err, confirmedOrderId }, "Paymob webhook: failed to add Shopify note"),
  );

  if (intent.discountCode && discountAmount) {
    void recordDiscountCodeUse(intent.discountCode, confirmedOrderId, orderNumber, "card");
  }

  const customer = intent.customer as CustomerInfo;
  // Shipping estimate: if total > 2000 EGP the order qualified for free shipping (subtotal >= 2000).
  // completeShopifyDraftOrder doesn't return shipping_lines, so we approximate from the total.
  const shippingPrice = parseEGP(total) > 2000 ? "0.00" : "50.00";

  if (customer?.email) {
    const { html, text } = buildOrderConfirmationEmail({
      orderNumber,
      customerName: customer.firstName ?? "",
      total,
      paymentMethod: "Credit / Debit Card",
      address: customer.address ?? "",
      governorate: customer.governorate ?? "",
      city: customer.city ?? "",
      lineItems,
      discountAmount: discountAmount ? discountAmount.toFixed(2) : undefined,
      discountCode: discountCode || undefined,
      shippingAmount: shippingPrice,
    });
    void sendEmail({
      to: customer.email,
      subject: `Your Moi order #${orderNumber} is confirmed`,
      html,
      text,
    })
      .then(() => req.log.info({ email: customer.email, orderNumber }, "Card payment confirmation email sent"))
      .catch((err) => req.log.warn({ err, email: customer.email }, "Card payment confirmation email failed"));
  }

  if (customer?.phone) {
    const shippingNum = parseFloat(shippingPrice);
    const shippingNote = shippingNum === 0
      ? "Complimentary shipping"
      : `Includes ${shippingNum.toFixed(0)} EGP shipping`;
    void sendWhatsApp(
      customer.phone,
      `✅ Your Moi order #${orderNumber} is confirmed!\n\nTotal: ${total} EGP (${shippingNote})\nPayment: Card — confirmed\n\nYour order is now being prepared. You'll receive a tracking update when it ships. Thank you for shopping with Moi. 🖤`,
    );
  }
});

/**
 * GET /api/paymob/status?token=<checkoutToken>
 *
 * Returns the current payment status for a card checkout session.
 * The frontend polls this after the Paymob redirect to determine next steps.
 */
router.get("/paymob/status", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  let intent;
  try {
    intent = await findPaymobIntentByCheckoutToken(token);
  } catch (err) {
    req.log.error({ err, token }, "paymob/status: DB lookup failed");
    res.status(500).json({ error: "Could not look up payment status." });
    return;
  }

  if (!intent) {
    res.status(404).json({ error: "Payment session not found." });
    return;
  }

  res.json({
    status: intent.status,
    shopifyOrderNumber: intent.shopifyOrderNumber ?? null,
    shopifyOrderId: intent.shopifyConfirmedOrderId ?? null,
    total: intent.total,
    paymobTxnId: intent.paymobTxnId ?? null,
  });
});

export default router;
