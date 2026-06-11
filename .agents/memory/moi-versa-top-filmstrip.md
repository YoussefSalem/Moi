---
name: Moi deriveFallbackFromHandle filmstrip bug
description: deriveFallbackFromHandle must respect intentionally-empty filmstrip; otherwise mapProductToConfig never falls through to Shopify CDN images.
---

## Rule
In `deriveFallbackFromHandle` (ProductPage.tsx), use:
```js
filmstrip: (matched.filmstrip as string[]).length > 0 ? gallery : [],
```
**Not** `filmstrip: gallery` unconditionally.

**Why:** `IMAGES.product2` (Versa Top) has `filmstrip: []` intentionally so `mapProductToConfig` can fall through to Shopify CDN images. But `deriveFallbackFromHandle` was overwriting it with `gallery = colorGalleriesMap["White"] = [VERSA_TOP_CARD]`. Since `fallbackFilm` was non-empty, `mapProductToConfig` always used the local placeholder instead of Shopify images — causing a gray product page.

**How to apply:** Any new product added with `filmstrip: []` in `images.ts` (to defer to Shopify CDN) will silently break if `deriveFallbackFromHandle` is reverted to unconditional `filmstrip: gallery`. The empty filmstrip is the signal — preserve it.

**Affected products:** Versa Top (`moi-versa-top`). Wavvy and Bangles have non-empty filmstrips and use `gallery` correctly.
