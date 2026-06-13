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
- The postMessage handler reads intentId as: `orderResult?.intentId ?? sessionStorage.getItem("moi_paymob_intent_id")` — the sessionStorage fallback is critical because after full-page navigation `orderResult` is null and `orderResult?.intentId` would be undefined, causing a fall to `transactionId` (a different identifier) → different event_id → no dedup.
- COD / InstaPay use the order number; Apple Pay uses `shopifyOrderNumber ?? applePayIntentId`.
- **Why:** There are NO server-side Meta Purchase fires (CAPI relay `/api/capi/event` is called only from the browser via `trackEvent`→`sendCapiEvent`). So browser-side order_id consistency is the *only* dedup mechanism. If you ever add a server-side Meta fire, it MUST reuse the same order_id.

## Gating
- `isMetaTrackingEnabled()` exact-matches the two prod hostnames and gates BOTH the browser pixel AND CAPI inside `trackEvent`. Mirrors the pixel init gate in `index.html`. Preview/dev/*.replit.app never fire.
- **Why:** The `fbq` stub is always defined by the index.html snippet, so gating on `fbq` existence leaks events from non-prod. Gate on hostname, never on `fbq`.
- CAPI fires independently of `fbq` presence (recovers ad-blocked / iOS conversions).

## The original ZERO-conversions bug
- `trackPurchase` was exported but never imported/called anywhere → zero Purchase events ever sent. Card-redirect and Apple Pay additionally fired nothing. This caused every reported symptom (wrong ROAS, missing Result Value, zero-conversion days).
- **How to apply:** when adding a payment path, wire `trackPurchase` INSIDE the existing tracked-once guard (`paymobTrackedRef` / `codTrackedRef` / `instapayTrackedRef`) alongside the TikTok/Shopify fires, using the same order_id as those fires.

## Double-count root causes (audited)

Three concrete bugs that together explain 1 real order → 2 Meta Purchase events:

### Bug 1 (most impactful): `moi_paymob_result` written but not cleared by postMessage handler
- `/api/paymob-return` ALWAYS writes `moi_paymob_result` to sessionStorage, even when taking the postMessage path (e.g. Paymob's 3DS runs our return URL inside its iframe → `window.parent !== window` → postMessage → `sent=true` → no redirect).
- The postMessage handler in CheckoutPage fired Purchase event A but never called `sessionStorage.removeItem("moi_paymob_result")`.
- Later, Paymob's page navigates top-level to our site. Fresh mount → Path C reads the stale key → Purchase event B. If order_ids differ → different event_ids → Meta cannot dedup → 2 counted.
- **Fix applied:** postMessage handler now calls `sessionStorage.removeItem("moi_paymob_result")` before firing.

### Bug 2: order_id inconsistency between postMessage and Path C
- postMessage handler was using `orderResult?.intentId ?? data.transactionId`. After full-page navigation `orderResult` is null → fell back to Paymob's `transactionId`.
- Path C (3DS restore) uses `sessionStorage.getItem("moi_paymob_intent_id")` (our DB intent ID).
- `transactionId` ≠ `intentId` → different event_ids → no dedup.
- **Fix applied:** postMessage handler now reads `orderResult?.intentId ?? sessionStorage.getItem("moi_paymob_intent_id")` — both paths use the same DB intent ID.

### Bug 3: CAPI fetch had no `keepalive: true`
- Without keepalive, hard page navigations could cancel the CAPI request in flight.
- If browser pixel (fbq) fired but CAPI was cancelled, the dedup partner never arrived at Meta. Any subsequent re-fire produces a non-matching event → 2 counted.
- **Fix applied:** `keepalive: true` added to the CAPI fetch in `metaPixel.ts`.

## Line data
- `buildMetaLineData(isShopify, shopifyCart, localItems)` in checkoutUtils.ts → `{contentIds, contents, numItems}`. content_ids use `merchandise.id` (variant gid), consistent with TikTok/orderLines.
- **Card 3DS redirect-restore omits content_ids on purpose:** after the page reload the only line data left is the `moi_paymob_items` snapshot whose `id` is the Shopify cart-LINE id (NOT the variant id). Sending it would pollute catalog matching. value+currency+order_id are enough there. Known minor: that path reports num_items=1 (trackPurchase default) for multi-item orders.

## Advanced matching PII freshness trap
- Card `handleIframeSuccess` and the postMessage handler are `useCallback`/effect closures that do NOT have `form` in their deps → `form` is STALE there. So those two paths pass NO user PII (rely on fbp/fbc/IP/UA). COD reads `d.form` via the always-fresh depsRef; InstaPay reads `form` inline in JSX (fresh); Apple Pay reads `sc` shippingContact (fresh). Don't add `form`-based PII to the card iframe/postMessage paths without first giving them a fresh form ref.
