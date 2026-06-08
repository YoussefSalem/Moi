import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import path from "path";
import fs from "fs/promises";

const router: IRouter = Router();

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;
const MOI_PORT = "18266";

// Known base product slugs — color suffixes are stripped before querying Shopify
// because "moi-wavvy-navy" doesn't exist in Shopify; the handle is "moi-wavvy".
const BASE_SLUGS = ["moi-wavvy", "moi-versa-top", "trio-bangles"];

function extractBaseSlug(handle: string): { baseSlug: string; colorSlug: string } {
  for (const slug of BASE_SLUGS) {
    if (handle === slug) return { baseSlug: slug, colorSlug: "" };
    if (handle.startsWith(slug + "-")) {
      return { baseSlug: slug, colorSlug: handle.slice(slug.length + 1) };
    }
  }
  return { baseSlug: handle, colorSlug: "" };
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface ShopifyVariant {
  image?: { url: string } | null;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface ShopifyProductData {
  title: string;
  description: string;
  images: { nodes: Array<{ url: string }> };
  variants: { nodes: ShopifyVariant[] };
}

interface OgData {
  title: string;
  description: string;
  image: string;
}

// Simple in-memory cache with 5-minute TTL so each deploy doesn't hammer Shopify.
const ogCache = new Map<string, { data: OgData; ts: number }>();
const OG_TTL_MS = 5 * 60 * 1000;

async function fetchOgData(baseSlug: string, colorSlug: string): Promise<OgData | null> {
  const cacheKey = `${baseSlug}::${colorSlug}`;
  const cached = ogCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < OG_TTL_MS) return cached.data;

  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) return null;

  try {
    const query = `
      query OgProduct($handle: String!) {
        product(handle: $handle) {
          title
          description
          images(first: 1) { nodes { url } }
          variants(first: 50) {
            nodes {
              image { url }
              selectedOptions { name value }
            }
          }
        }
      }
    `;
    const res = await fetch(`https://${STORE_DOMAIN}/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables: { handle: baseSlug } }),
    });
    if (!res.ok) return null;

    const json = await res.json() as { data?: { product?: ShopifyProductData } };
    const product = json?.data?.product;
    if (!product) return null;

    // Prefer the variant whose color option slug matches the URL color suffix.
    let image = "";
    if (colorSlug) {
      const match = product.variants.nodes.find((v) =>
        v.selectedOptions.some(
          (o) => o.name.toLowerCase() === "color" && slugify(o.value) === colorSlug,
        ),
      );
      image = match?.image?.url ?? "";
    }
    // Fall back to first variant image, then first product image.
    if (!image) {
      image =
        product.variants.nodes[0]?.image?.url ??
        product.images.nodes[0]?.url ??
        "";
    }

    const data: OgData = {
      title: product.title,
      description: product.description?.slice(0, 160) ?? "",
      image,
    };
    ogCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    logger.warn({ err, baseSlug }, "ogProxy: Shopify fetch failed");
    return null;
  }
}

// Cache the SPA template in memory; in dev re-fetch on every request so HMR changes
// are reflected, in prod read once and keep for the process lifetime.
let spaTemplateCache: string | null = null;

async function getSpaTemplate(): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    if (spaTemplateCache) return spaTemplateCache;
    const distPath = path.join(process.cwd(), "artifacts/moi/dist/index.html");
    spaTemplateCache = await fs.readFile(distPath, "utf-8");
    return spaTemplateCache;
  }
  // Dev: always fetch fresh from the Vite dev server so HMR keeps working.
  const res = await fetch(`http://localhost:${MOI_PORT}/`);
  if (!res.ok) throw new Error(`Vite dev server returned ${res.status}`);
  return res.text();
}

function ea(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function injectOgTags(html: string, og: OgData, handle: string, origin: string): string {
  const fullTitle = `${og.title} — Moi`;
  const pageUrl = `${origin}/products/${handle}`;

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${ea(og.title)} — Moi</title>`)
    .replace(/<meta property="og:title"[^>]*\/?>/, `<meta property="og:title" content="${ea(fullTitle)}" />`)
    .replace(/<meta property="og:description"[^>]*\/?>/, `<meta property="og:description" content="${ea(og.description)}" />`)
    .replace(/<meta property="og:image"[^>]*\/?>/, `<meta property="og:image" content="${ea(og.image)}" />`)
    .replace(/<meta property="og:image:width"[^>]*\/?>/, "")
    .replace(/<meta property="og:image:height"[^>]*\/?>/, "")
    .replace(/<meta property="og:url"[^>]*\/?>/, `<meta property="og:url" content="${ea(pageUrl)}" />`)
    .replace(/<meta property="og:type"[^>]*\/?>/, `<meta property="og:type" content="product" />`)
    .replace(/<meta name="twitter:title"[^>]*\/?>/, `<meta name="twitter:title" content="${ea(fullTitle)}" />`)
    .replace(/<meta name="twitter:description"[^>]*\/?>/, `<meta name="twitter:description" content="${ea(og.description)}" />`)
    .replace(/<meta name="twitter:image"[^>]*\/?>/, `<meta name="twitter:image" content="${ea(og.image)}" />`);
}

router.get("/products/:handle", async (req, res) => {
  const { handle } = req.params as { handle: string };
  const { baseSlug, colorSlug } = extractBaseSlug(handle);

  try {
    const origin = `${req.protocol}://${req.get("host") ?? "buy-moi.com"}`;

    const [ogData, spaHtml] = await Promise.all([
      fetchOgData(baseSlug, colorSlug),
      getSpaTemplate(),
    ]);

    const html = ogData ? injectOgTags(spaHtml, ogData, handle, origin) : spaHtml;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Allow CDN / browser to cache for 5 minutes; must-revalidate after.
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, must-revalidate");
    res.send(html);
  } catch (err) {
    logger.error({ err, handle }, "ogProxy: failed — falling back to raw SPA template");
    try {
      const html = await getSpaTemplate();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch {
      res.status(500).send("Internal server error");
    }
  }
});

export default router;
