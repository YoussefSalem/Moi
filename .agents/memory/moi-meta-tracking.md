---
name: Moi Meta Pixel + CAPI tracking
description: How Meta (Facebook) Purchase tracking is wired across Moi's payment paths, the dedup contract, and the gating rules. Read before touching metaPixel.ts or any Purchase fire.
---

# Moi Meta Pixel + Conversions API (CAPI)

Pixel ID 2281707575977889. Active ONLY on `buy-moi.com` / `www.buy-moi.com`.

## The dedup contract (do not break)
- Every Meta Purchase event_id = `hashId('purchase_' + order_id)` (computed in `trackEvent`, metaPixel.ts).
- Therefore the **order_id passed to `trackPurchase` must be stable across any path that could fire for the same order**, or Meta double-counts → inflated ROAS.
- All three CARD paths (iframe `handleIframeSuccess`, postMessage handler, full-page 3DS redirect-restore) use the **Paymob intent id** as order_id so they dedup to one event even if two fire.
- COD / InstaPay use the order number; Apple Pay uses `shopifyOrderNumber ?? applePayIntentId`.
- **Why:** There are NO server-side Meta Purchase fires (CAPI relay `/api/capi/event` is called only from the browser via `trackEvent`→`sendCapiEvent`). So browser-side order_id consistency is the *only* dedup mechanism. If you ever add a server-side Meta fire, it MUST reuse the same order_id.

## Gating
- `isMetaTrackingEnabled()` exact-matches the two prod hostnames and gates BOTH the browser pixel AND CAPI inside `trackEvent`. Mirrors the pixel init gate in `index.html`. Preview/dev/*.replit.app never fire.
- **Why:** The `fbq` stub is always defined by the index.html snippet, so gating on `fbq` existence leaks events from non-prod. Gate on hostname, never on `fbq`.
- CAPI fires independently of `fbq` presence (recovers ad-blocked / iOS conversions).

## The original ZERO-conversions bug
- `trackPurchase` was exported but never imported/called anywhere → zero Purchase events ever sent. Card-redirect and Apple Pay additionally fired nothing. This caused every reported symptom (wrong ROAS, missing Result Value, zero-conversion days).
- **How to apply:** when adding a payment path, wire `trackPurchase` INSIDE the existing tracked-once guard (`paymobTrackedRef` / `codTrackedRef` / `instapayTrackedRef`) alongside the TikTok/Shopify fires, using the same order_id as those fires.

## Line data
- `buildMetaLineData(isShopify, shopifyCart, localItems)` in checkoutUtils.ts → `{contentIds, contents, numItems}`. content_ids use `merchandise.id` (variant gid), consistent with TikTok/orderLines.
- **Card 3DS redirect-restore omits content_ids on purpose:** after the page reload the only line data left is the `moi_paymob_items` snapshot whose `id` is the Shopify cart-LINE id (NOT the variant id). Sending it would pollute catalog matching. value+currency+order_id are enough there. Known minor: that path reports num_items=1 (trackPurchase default) for multi-item orders.

## Advanced matching PII freshness trap
- Card `handleIframeSuccess` and the postMessage handler are `useCallback`/effect closures that do NOT have `form` in their deps → `form` is STALE there. So those two paths pass NO user PII (rely on fbp/fbc/IP/UA). COD reads `d.form` via the always-fresh depsRef; InstaPay reads `form` inline in JSX (fresh); Apple Pay reads `sc` shippingContact (fresh). Don't add `form`-based PII to the card iframe/postMessage paths without first giving them a fresh form ref.
