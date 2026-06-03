import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

/**
 * POST /api/shopify-apple-pay/checkout
 *
 * Creates a Shopify Cart (Storefront API 2024-04+ Cart API) from the given
 * line items and returns { checkoutUrl, checkoutId } so the frontend can open
 * the checkout in a popup where Shopify handles Apple Pay natively.
 *
 * Note: Storefront API 2022-01+ removed the legacy checkoutCreate mutation.
 * We now use cartCreate which returns cart.checkoutUrl.
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

  const lines = body.lines as Array<{ variantId: string; quantity: number }>;
  const discountCode = typeof body.discountCode === "string" && body.discountCode.trim()
    ? body.discountCode.trim()
    : undefined;

  try {
    // Cart API uses `merchandiseId` (= variantId GID) not `variantId`
    const input: Record<string, unknown> = {
      lines: lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })),
    };
    if (discountCode) input.discountCodes = [discountCode];

    const data = await storefrontFetch<{
      cartCreate: {
        cart: {
          id: string;
          checkoutUrl: string;
          cost: {
            totalAmount: { amount: string; currencyCode: string };
            subtotalAmount: { amount: string; currencyCode: string };
          };
        } | null;
        userErrors: { code: string; field: string[]; message: string }[];
      };
    }>(`
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            cost {
              totalAmount { amount currencyCode }
              subtotalAmount { amount currencyCode }
            }
          }
          userErrors { code field message }
        }
      }
    `, { input });

    const cart = data.cartCreate.cart;
    const errors = data.cartCreate.userErrors;

    if (errors.length) {
      logger.warn({ errors }, "Shopify Apple Pay cart creation failed");
      res.status(422).json({ error: errors[0].message });
      return;
    }
    if (!cart) {
      res.status(500).json({ error: "Cart could not be created" });
      return;
    }

    // Optionally rewrite the checkout URL to the custom domain
    const checkoutDomain = process.env.VITE_SHOPIFY_CHECKOUT_DOMAIN;
    let checkoutUrl = cart.checkoutUrl;
    if (checkoutDomain) {
      try {
        const url = new URL(checkoutUrl);
        url.hostname = checkoutDomain;
        checkoutUrl = url.toString();
      } catch {
        // leave original
      }
    }

    req.log.info({ cartId: cart.id, lineCount: lines.length }, "Shopify cart created for Apple Pay popup");

    res.status(200).json({
      checkoutUrl,
      checkoutId: cart.id,
      total: cart.cost.totalAmount.amount,
      currencyCode: cart.cost.totalAmount.currencyCode,
      subtotal: cart.cost.subtotalAmount.amount,
    });
  } catch (err) {
    logger.error({ err }, "Shopify Apple Pay checkout creation error");
    res.status(500).json({ error: "Could not create checkout. Please try again." });
  }
});

export default router;
