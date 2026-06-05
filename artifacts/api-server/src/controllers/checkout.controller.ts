/**
 * checkout.controller.ts
 *
 * Handles POST /api/checkout
 *
 * Flow:
 *  1. Validate request body (cart items, customer, shipping, billing, total)
 *  2. Validate stock availability
 *  3. Create Shopify Draft Order (reserves inventory, computes accurate total)
 *  4. Create Paymob payment intention (Intentions API) or legacy iframe
 *  5. Store pending checkout record in DB
 *  6. Return payment status, redirect_url (or iframe_url), and transaction reference
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { createLegacyPayment, type BillingData } from "../services/paymob.service";
import { validateStock } from "../services/shopify.service";
import { createDraftOrder, extractVariantId, type OrderLine, type CustomerInfo } from "../lib/shopifyOrder";
import { insertPaymobIntent } from "@workspace/db";
import { getSiteUrl } from "../lib/siteUrl";
import { parseEGP } from "@workspace/utils";
import { logger } from "../lib/logger";

// ─── Request schema (manual — avoids Zod dep on this controller layer) ───────

export interface CheckoutRequestBody {
  items: Array<{
    variantId: string;
    quantity: number;
    price?: string;
    title?: string;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
  };
  shippingAddress: {
    address: string;
    city: string;
    governorate: string;
    postalCode?: string;
  };
  billingAddress?: {
    address: string;
    city: string;
    governorate: string;
    postalCode?: string;
  };
  totalAmount?: number;
  discountCode?: string;
  cartId?: string;
  attribution?: Record<string, unknown>;
}

export interface CheckoutResponse {
  success: boolean;
  status: "pending" | "requires_redirect";
  checkoutToken: string;
  redirectUrl: string;
  transactionReference: string;
  total: string;
  amountCents: number;
  draftOrderId: number;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateItems(raw: unknown[]): OrderLine[] | null {
  for (const item of raw) {
    const l = item as Record<string, unknown>;
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
  return raw as OrderLine[];
}

function validateCustomer(raw: unknown): CustomerInfo | null {
  const c = raw as Record<string, unknown> | undefined;
  if (
    !c?.firstName || typeof c.firstName !== "string" || !c.firstName.trim() ||
    !c?.lastName || typeof c.lastName !== "string" || !c.lastName.trim() ||
    !c?.phone || typeof c.phone !== "string" || !c.phone.trim()
  ) return null;
  return c as unknown as CustomerInfo;
}

function validateShippingAddress(raw: unknown): { address: string; city: string; governorate: string; postalCode?: string } | null {
  const a = raw as Record<string, unknown> | undefined;
  if (
    !a?.address || typeof a.address !== "string" || !a.address.trim() ||
    !a?.city || typeof a.city !== "string" || !a.city.trim() ||
    !a?.governorate || typeof a.governorate !== "string" || !a.governorate.trim()
  ) return null;
  return {
    address: String(a.address).trim(),
    city: String(a.city).trim(),
    governorate: String(a.governorate).trim(),
    postalCode: typeof a.postalCode === "string" ? a.postalCode : undefined,
  };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export async function handleCheckout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CheckoutRequestBody;

    // 1. Validate request
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "items is required and must be a non-empty array." });
      return;
    }

    const lines = validateItems(body.items as unknown[]);
    if (!lines) {
      res.status(400).json({ error: "Invalid items format. Each item requires a valid variantId (GID) and quantity >= 1." });
      return;
    }

    const customerRaw = {
      ...body.customer,
      address: body.shippingAddress?.address ?? "",
      governorate: body.shippingAddress?.governorate ?? "",
      city: body.shippingAddress?.city ?? "",
      postalCode: body.shippingAddress?.postalCode,
    };

    const customer = validateCustomer(customerRaw);
    if (!customer) {
      res.status(400).json({ error: "customer is required with firstName, lastName, and phone." });
      return;
    }

    const shippingAddr = validateShippingAddress(body.shippingAddress);
    if (!shippingAddr) {
      res.status(400).json({ error: "shippingAddress is required with address, city, and governorate." });
      return;
    }

    // 2. Validate stock
    const stockCheck = await validateStock(lines);
    if (!stockCheck.ok) {
      req.log.warn({ unavailableVariantIds: stockCheck.unavailableVariantIds }, "checkout: stock check failed");
      res.status(422).json({
        error: "One or more items are out of stock.",
        unavailableVariantIds: stockCheck.unavailableVariantIds,
      });
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

    // 3. Create Shopify draft order (reserves inventory, computes total)
    req.log.info({ lineCount: lines.length, discountCode, cartId }, "checkout: creating draft order");

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
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Order creation failed";
      req.log.error({ err }, "checkout: draft order creation failed");
      if (message.includes("not applicable")) {
        res.status(422).json({ error: message });
      } else {
        res.status(500).json({ error: "Could not initiate checkout. Please try again." });
      }
      return;
    }

    const draftOrderId = draftResult.draftOrderId ?? draftResult.orderId;
    const total = draftResult.total;
    const amountCents = Math.round(parseEGP(total) * 100);

    if (amountCents <= 0) {
      req.log.error({ total, amountCents }, "checkout: invalid total amount computed");
      res.status(500).json({ error: "Could not compute order total. Please try again." });
      return;
    }

    // 4. Create Paymob payment
    const checkoutToken = crypto.randomUUID();
    const siteUrl = getSiteUrl();
    const notificationUrl = `${siteUrl}/api/paymob/webhook`;
    const redirectionUrl = `${siteUrl}/payment/return`;

    const billingData: BillingData = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      phone_number: customer.phone,
      email: customer.email ?? "N/A",
      street: customer.address,
      building: "NA",
      floor: "NA",
      apartment: "NA",
      city: customer.city,
      state: customer.governorate,
      country: "EG",
      postal_code: customer.postalCode ?? "NA",
    };

    const paymobItems = lines.map((l) => ({
      name: `Product variant ${extractVariantId(l.variantId)}`,
      amount_cents: amountCents,
      description: `Qty ${l.quantity}`,
      quantity: l.quantity,
    }));

    let iframeUrl: string;
    let paymobOrderId: number;
    try {
      const result = await createLegacyPayment({
        amountCents,
        currency: "EGP",
        merchantOrderId: checkoutToken,
        billingData,
        items: paymobItems,
        notificationUrl,
        redirectionUrl,
      });
      iframeUrl = result.iframeUrl;
      paymobOrderId = result.paymobOrderId;
    } catch (err) {
      req.log.error({ err }, "checkout: Paymob payment creation failed");
      res.status(502).json({ error: "Payment provider unavailable. Please try again." });
      return;
    }

    // 5. Store pending checkout record
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await insertPaymobIntent({
        intentId: String(paymobOrderId),
        lines: lines as unknown as any,
        customer: customer as unknown as any,
        cartId: cartId ?? null,
        discountCode: discountCode ?? null,
        amountCents,
        total,
        status: "pending",
        shopifyOrderId: draftOrderId,
        attribution: null,
        checkoutToken,
      } as any);
    } catch (err) {
      req.log.error({ err, paymobOrderId }, "checkout: DB insert failed (non-fatal)");
    }

    req.log.info(
      { draftOrderId, paymobOrderId, checkoutToken, amountCents },
      "checkout: payment initiated successfully",
    );

    // 6. Return response — status is "requires_redirect" because customer must visit iframe URL
    const response: CheckoutResponse = {
      success: true,
      status: "requires_redirect",
      checkoutToken,
      redirectUrl: iframeUrl,
      transactionReference: checkoutToken,
      total,
      amountCents,
      draftOrderId,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
