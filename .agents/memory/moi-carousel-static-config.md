---
name: Moi recs carousel uses static config, not Shopify
description: Why the "You May Also Like / Curated For You" carousel can show blank/wrong images while the landing page looks fine.
---

The product-page recommendations carousel (`buildAllRecs` in `ProductPage.tsx`) builds its
items at module load from the **static** `IMAGES` config in `src/config/images.ts`
(`colorImages` keyed against `colorSwatches`). It does NOT use Shopify data.

The landing page, by contrast, resolves products via `useShopifyProducts` and renders
**Shopify CDN** per-variant images. So the two surfaces can diverge: a product can look
correct on the landing page (real Shopify photos) but show blank/placeholder cards in the
carousel if its local `colorImages` point to a missing or broken asset.

**Why:** This bit us when Moi Versa Top's only local image (`moi-versa-top-beige-card.webp`)
was a broken/blank screenshot — every Versa Top card in the carousel rendered grey, even
though the landing page showed real Shopify imagery.

**How to apply:** When carousel cards are blank but the landing page is fine, suspect the
local `colorImages` assets, not the Shopify pipeline. To match the landing page, download the
real per-color photos from Shopify CDN into `artifacts/moi/public/images/` and point each
color's `colorImages`/`colorGalleries` entry at the local copy (the user prefers local images
over hot-linking Shopify CDN in the carousel). A color only renders if it has a matching
lowercase key in `colorSwatches` — `buildAllRecs` skips colors with no swatch.

To pull real product images, query the Storefront API with `VITE_SHOPIFY_STORE_DOMAIN` +
`VITE_SHOPIFY_STOREFRONT_TOKEN` for `product(handle:"…"){ variants{ image{url} selectedOptions } }`.
