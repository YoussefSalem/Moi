import { Router } from "express";

const router = Router();

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
 * Registers an abandoned-checkout candidate by updating the cart's buyer
 * identity with the customer's email and returning the cart's checkout URL.
 *
 * The frontend must then load the returned checkoutUrl in a hidden iframe so
 * Shopify's checkout SPA creates a real checkout object on Shopify's server.
 * That checkout object is what appears at admin.shopify.com → Checkouts and
 * is what the Shopify Messaging app uses for abandoned-checkout recovery.
 */
router.post("/checkouts/register", async (req, res) => {
  const { email, cartId } = req.body as { email?: string; cartId?: string };

  if (!email || !cartId) {
    res.status(400).json({ error: "email and cartId required" });
    return;
  }

  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
    res.json({ success: false, reason: "unconfigured" });
    return;
  }

  try {
    const data = await storefrontFetch<{
      cartBuyerIdentityUpdate: {
        cart: {
          id: string;
          checkoutUrl: string;
          totalQuantity: number;
        };
        userErrors: { field: string[]; message: string }[];
      };
    }>(`
      mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
        cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
          cart { id checkoutUrl totalQuantity }
          userErrors { field message }
        }
      }
    `, { cartId, buyerIdentity: { email } });

    const errors = data?.cartBuyerIdentityUpdate?.userErrors ?? [];
    if (errors.length) {
      req.log.warn({ errors }, "checkout-register: cartBuyerIdentityUpdate returned errors");
      res.json({ success: false });
      return;
    }

    const cart = data?.cartBuyerIdentityUpdate?.cart;
    if (!cart) {
      req.log.warn("checkout-register: no cart returned");
      res.json({ success: false });
      return;
    }

    req.log.info(
      { cartId: cart.id, totalQuantity: cart.totalQuantity },
      "checkout-register: buyer identity set, checkout URL ready",
    );
    res.json({ success: true, checkoutUrl: cart.checkoutUrl });
  } catch (err) {
    req.log.warn({ err }, "checkout-register: error updating cart buyer identity");
    res.json({ success: false });
  }
});

export default router;
