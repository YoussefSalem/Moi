import { Router, type IRouter } from "express";

const router: IRouter = Router();

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN ?? "";
const CHECKOUT_DOMAIN = process.env.VITE_SHOPIFY_CHECKOUT_DOMAIN ?? STORE_DOMAIN;

let domainFileCache: { body: string; ts: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * GET /.well-known/apple-developer-merchantid-domain-association
 *
 * Proxies Shopify's Apple Pay domain verification file so Apple can verify
 * this custom domain as a registered Apple Pay merchant domain.
 * The file is fetched from the Shopify store and cached for 24 hours.
 */
router.get("/.well-known/apple-developer-merchantid-domain-association", async (req, res) => {
  if (!STORE_DOMAIN) {
    req.log.warn("VITE_SHOPIFY_STORE_DOMAIN is not set — cannot serve Apple Pay domain association file");
    res.status(404).send("Not found");
    return;
  }

  const now = Date.now();
  if (domainFileCache && now - domainFileCache.ts < CACHE_TTL_MS) {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(domainFileCache.body);
    return;
  }

  try {
    const upstream = await fetch(
      `https://${STORE_DOMAIN}/.well-known/apple-developer-merchantid-domain-association`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!upstream.ok) {
      req.log.warn({ status: upstream.status }, "Shopify Apple Pay domain file not found — Apple Pay domain registration may not be active");
      res.status(404).send("Not found");
      return;
    }

    const body = await upstream.text();
    domainFileCache = { body, ts: now };
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(body);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Apple Pay domain association file from Shopify");
    res.status(503).send("Unavailable");
  }
});

/**
 * POST /api/apple-pay/shopify-session
 *
 * Called during ApplePaySession.onvalidatemerchant.
 * Proxies the Apple Pay merchant validation request to Shopify's checkout
 * endpoint so Shopify (and Apple) can authenticate this merchant.
 *
 * Body: { validationURL: string, checkoutWebUrl: string }
 * Returns: { merchantSession: object }
 */
router.post("/apple-pay/shopify-session", async (req, res) => {
  const body = req.body as { validationURL?: unknown; checkoutWebUrl?: unknown };

  if (typeof body.validationURL !== "string" || !body.validationURL) {
    res.status(400).json({ error: "validationURL is required" });
    return;
  }
  if (typeof body.checkoutWebUrl !== "string" || !body.checkoutWebUrl) {
    res.status(400).json({ error: "checkoutWebUrl is required" });
    return;
  }

  const { validationURL, checkoutWebUrl } = body as { validationURL: string; checkoutWebUrl: string };

  const sessionEndpoint = `${checkoutWebUrl}/apple_pay/session`;

  req.log.info({ sessionEndpoint }, "Apple Pay: requesting merchant session from Shopify");

  try {
    const upstream = await fetch(sessionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: validationURL }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      req.log.warn({ status: upstream.status, body: text }, "Shopify Apple Pay session endpoint returned non-OK");
      res.status(502).json({ error: "Merchant validation failed — Shopify Payments may not be active on this store" });
      return;
    }

    const merchantSession = await upstream.json() as unknown;
    req.log.info("Apple Pay: merchant session obtained from Shopify");
    res.json({ merchantSession });
  } catch (err) {
    req.log.error({ err }, "Apple Pay: merchant session request failed");
    res.status(503).json({ error: "Merchant validation unavailable. Please try another payment method." });
  }
});

export default router;
