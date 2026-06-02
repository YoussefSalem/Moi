import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PAYMOB_DOMAIN_FILE_URL =
  "https://accept.paymob.com/.well-known/apple-developer-merchantid-domain-association";

let domainFileCache: { body: string; ts: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * GET /.well-known/apple-developer-merchantid-domain-association
 *
 * Proxies Paymob's Apple Pay domain verification file so Apple can verify
 * this custom domain as a registered Apple Pay merchant domain.
 * The file is fetched from accept.paymob.com and cached for 24 hours.
 */
router.get("/.well-known/apple-developer-merchantid-domain-association", async (req, res) => {
  const now = Date.now();
  if (domainFileCache && now - domainFileCache.ts < CACHE_TTL_MS) {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(domainFileCache.body);
    return;
  }

  try {
    const upstream = await fetch(PAYMOB_DOMAIN_FILE_URL, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      req.log.warn({ status: upstream.status }, "Paymob Apple Pay domain file not found");
      res.status(404).send("Not found");
      return;
    }

    const body = await upstream.text();
    domainFileCache = { body, ts: now };
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(body);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Apple Pay domain association file from Paymob");
    res.status(503).send("Unavailable");
  }
});

export default router;
