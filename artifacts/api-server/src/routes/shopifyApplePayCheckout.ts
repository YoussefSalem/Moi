import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { type OrderLine } from "../lib/shopifyOrder";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SHIPPING_EGP = 50;

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

async function storefrontFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) throw new Error("Shopify not configured");
  const res = await fetch(`https://${STORE_DOMAIN}/api/2024-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

const CHECKOUT_FRAGMENT = `
  fragment CheckoutFields on Checkout {
    id webUrl
    totalPriceV2 { amount currencyCode }
    subtotalPriceV2 { amount currencyCode }
  }
`;

/**
 * POST /api/shopify-apple-pay/checkout
 *
 * Creates a Shopify checkout (Storefront API) from the given line items.
 * Returns { checkoutUrl, checkoutId } so the frontend can open the checkout
 * in a popup where Shopify handles Apple Pay natively.
 */
router.post("/shopify-apple-pay/checkout", async (req, res) => {
  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
    res.status(503).json({ error: "Shopify not configured" });
    return;
  }

  const body = req.body as {
    lines?: unknown;
    totalAmountCents?: unknown;
    discountCode?: unknown;
  };

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "No items in order" });
    return;
  }

  for (const raw of body.lines as unknown[]) {
    const l = raw as Record<string, unknown>;
    if (typeof l.variantId !== "string" || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(l.variantId)) {
      res.status(400).json({ error: "Invalid variant ID in order lines" });
      return;
    }
    if (typeof l.quantity !== "number" || !Number.isInteger(l.quantity) || l.quantity < 1) {
      res.status(400).json({ error: "Each line item must have a quantity of at least 1" });
      return;
    }
  }

  const lines = body.lines as OrderLine[];
  const discountCode = typeof body.discountCode === "string" && body.discountCode.trim()
    ? body.discountCode.trim()
    : undefined;

  try {
    const input: Record<string, unknown> = {
      lineItems: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    };
    if (discountCode) input.discountCodes = [discountCode];

    const data = await storefrontFetch<{
      checkoutCreate: {
        checkout: {
          id: string;
          webUrl: string;
          totalPriceV2: { amount: string; currencyCode: string };
          subtotalPriceV2: { amount: string; currencyCode: string };
        } | null;
        checkoutUserErrors: { code: string; field: string[]; message: string }[];
      };
    }>(`
      ${CHECKOUT_FRAGMENT}
      mutation CheckoutCreate($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout { ...CheckoutFields }
          checkoutUserErrors { code field message }
        }
      }
    `, { input });

    const checkout = data.checkoutCreate.checkout;
    const errors = data.checkoutCreate.checkoutUserErrors;

    if (errors.length) {
      logger.warn({ errors }, "Shopify Apple Pay checkout creation failed");
      res.status(422).json({ error: errors[0].message });
      return;
    }
    if (!checkout) {
      res.status(500).json({ error: "Checkout could not be created" });
      return;
    }

    // Optionally rewrite the checkout URL to the custom domain
    const checkoutDomain = process.env.VITE_SHOPIFY_CHECKOUT_DOMAIN;
    let checkoutUrl = checkout.webUrl;
    if (checkoutDomain) {
      try {
        const url = new URL(checkoutUrl);
        url.hostname = checkoutDomain;
        checkoutUrl = url.toString();
      } catch {
        // leave original
      }
    }

    req.log.info({ checkoutId: checkout.id, lineCount: lines.length }, "Shopify checkout created for Apple Pay");

    res.status(200).json({
      checkoutUrl,
      checkoutId: checkout.id,
      total: checkout.totalPriceV2.amount,
      currencyCode: checkout.totalPriceV2.currencyCode,
      subtotal: checkout.subtotalPriceV2.amount,
    });
  } catch (err) {
    logger.error({ err }, "Shopify Apple Pay checkout creation error");
    res.status(500).json({ error: "Could not create checkout. Please try again." });
  }
});

export default router;
