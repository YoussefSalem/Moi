import { Router } from "express";
import { getShopifyAdminToken } from "../lib/integrations";

const router = Router();

router.post("/checkouts/register", async (req, res) => {
  const { email, cartId } = req.body as { email?: string; cartId?: string };

  if (!email || !cartId) {
    res.status(400).json({ error: "email and cartId required" });
    return;
  }

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const storefrontToken = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;
  const adminToken = await getShopifyAdminToken();

  if (!storeDomain || !storefrontToken || !adminToken) {
    res.json({ success: false, reason: "unconfigured" });
    return;
  }

  // 1. Fetch cart line items via Storefront API
  let lineItems: Array<{ variant_id: number; quantity: number }> = [];
  try {
    const cartRes = await fetch(`https://${storeDomain}/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify({
        query: `
          query GetCartLines($cartId: ID!) {
            cart(id: $cartId) {
              lines(first: 50) {
                nodes {
                  quantity
                  merchandise {
                    ... on ProductVariant { id }
                  }
                }
              }
            }
          }
        `,
        variables: { cartId },
      }),
    });

    if (cartRes.ok) {
      const cartData = await cartRes.json() as {
        data?: {
          cart?: {
            lines: {
              nodes: Array<{ quantity: number; merchandise: { id: string } }>;
            };
          };
        };
      };
      const nodes = cartData.data?.cart?.lines.nodes ?? [];
      lineItems = nodes
        .map((n) => ({
          variant_id: parseInt(n.merchandise.id.split("/").pop() ?? "0", 10),
          quantity: n.quantity,
        }))
        .filter((li) => li.variant_id > 0);
    }
  } catch (err) {
    req.log.warn({ err }, "checkout-register: failed to fetch cart lines");
  }

  // 2. Create a Shopify checkout object so it appears in the Abandoned Checkouts admin page
  try {
    const checkoutRes = await fetch(
      `https://${storeDomain}/admin/api/2024-04/checkouts.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({
          checkout: {
            email,
            ...(lineItems.length > 0 ? { line_items: lineItems } : {}),
          },
        }),
      },
    );

    if (!checkoutRes.ok) {
      const errBody = await checkoutRes.text().catch(() => "");
      req.log.warn({ status: checkoutRes.status, errBody }, "checkout-register: Shopify rejected checkout creation");
      res.json({ success: false });
      return;
    }

    const checkoutData = await checkoutRes.json() as { checkout?: { token?: string } };
    req.log.info({ token: checkoutData.checkout?.token }, "checkout-register: Shopify abandoned checkout registered");
    res.json({ success: true, token: checkoutData.checkout?.token });
  } catch (err) {
    req.log.warn({ err }, "checkout-register: network error creating Shopify checkout");
    res.json({ success: false });
  }
});

export default router;
