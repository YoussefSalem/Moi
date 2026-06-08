import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 18266;
const dist = path.join(__dirname, "dist", "public");

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

// Social-media crawlers and link-preview bots that need server-side OG tags
const BOT_RE =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Discordbot|Slackbot|LinkedInBot|Applebot|Googlebot|bingbot|DuckDuckBot|rogerbot|embedly|Quora|outbrain|W3C_Validator|redditbot|Pinterest|Snapchat|Signal|viber|Line\/|kakaotalk|curl\/|python-requests|python-httpx|node-fetch|axios|Go-http-client/i;

function isCrawler(ua) {
  return BOT_RE.test(ua || "");
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMeta(html, property, value) {
  return html
    .replace(
      new RegExp(
        `(<meta\\s+property="${escapeRe(property)}"\\s+content=")[^"]*("\\s*/?>)`,
        "g"
      ),
      `$1${escAttr(value)}$2`
    )
    .replace(
      new RegExp(
        `(<meta\\s+content=")[^"]*("\\s+property="${escapeRe(property)}"\\s*/?>)`,
        "g"
      ),
      `$1${escAttr(value)}$2`
    );
}

function replaceMetaName(html, name, value) {
  return html
    .replace(
      new RegExp(
        `(<meta\\s+name="${escapeRe(name)}"\\s+content=")[^"]*("\\s*/?>)`,
        "g"
      ),
      `$1${escAttr(value)}$2`
    )
    .replace(
      new RegExp(
        `(<meta\\s+content=")[^"]*("\\s+name="${escapeRe(name)}"\\s*/?>)`,
        "g"
      ),
      `$1${escAttr(value)}$2`
    );
}

function injectProductOG(html, product, handle) {
  const title = `${product.title} — Moi`;
  const desc = (
    product.description ||
    `Shop ${product.title} at Moi — premium versatile fashion designed in Egypt.`
  ).slice(0, 200);
  const image = product.featuredImage?.url || "https://buy-moi.com/og-image.png";
  const url = `https://buy-moi.com/products/${handle}`;

  html = replaceMeta(html, "og:title", title);
  html = replaceMeta(html, "og:description", desc);
  html = replaceMeta(html, "og:image", image);
  html = replaceMeta(html, "og:image:width", "800");
  html = replaceMeta(html, "og:image:height", "1000");
  html = replaceMeta(html, "og:url", url);
  html = replaceMeta(html, "og:type", "product");
  html = replaceMetaName(html, "twitter:title", title);
  html = replaceMetaName(html, "twitter:description", desc);
  html = replaceMetaName(html, "twitter:image", image);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>`);
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    `$1${escAttr(url)}$2`
  );
  return html;
}

// Try the full handle first, then strip one suffix segment at a time.
// e.g. "moi-wavvy-navy" → tries "moi-wavvy-navy", then "moi-wavvy"
async function fetchProductForOG(handle) {
  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) return null;

  const segments = handle.split("-");
  const candidates = [handle];
  for (let i = segments.length - 1; i >= 2; i--) {
    candidates.push(segments.slice(0, i).join("-"));
  }

  for (const h of candidates) {
    try {
      const res = await fetch(
        `https://${STORE_DOMAIN}/api/2024-04/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
          },
          body: JSON.stringify({
            query: `{ product(handle: ${JSON.stringify(h)}) {
              title
              description(truncateAt: 200)
              featuredImage { url altText }
            } }`,
          }),
        }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const p = json?.data?.product;
      if (p?.title) return p;
    } catch {
      // network error — try next candidate
    }
  }
  return null;
}

// Static assets: long-lived cache (filenames are fingerprinted by Vite)
app.use(express.static(dist, { maxAge: "1y", immutable: true, index: false }));

// Product pages: inject per-product OG tags for crawlers
app.get("/products/:handle", async (req, res) => {
  const ua = req.headers["user-agent"] || "";
  const { handle } = req.params;

  let html;
  try {
    html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  } catch {
    return res.status(500).send("Internal server error");
  }

  if (isCrawler(ua)) {
    try {
      const product = await fetchProductForOG(handle);
      if (product) html = injectProductOG(html, product, handle);
    } catch {
      // Shopify unreachable — serve with generic site-wide OG tags
    }
    res.set("Cache-Control", "no-store");
  } else {
    res.set("Cache-Control", "no-cache");
  }

  res.send(html);
});

// SPA catch-all
app.use((_req, res) => {
  res.set("Cache-Control", "no-cache").sendFile(path.join(dist, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Moi serving on ${PORT}`);
});
