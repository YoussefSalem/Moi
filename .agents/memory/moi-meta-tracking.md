---
name: Moi Meta Pixel + CAPI tracking
description: How Meta (Facebook) tracking is wired in Moi, what fires and what does not, and why custom Purchase tracking was removed. Read before touching metaPixel.ts or any purchase flow.
---

# Moi Meta Pixel + Conversions API (CAPI)

Pixel ID 2281707575977889. Active ONLY on `buy-moi.com` / `www.buy-moi.com`.

## Current state — Purchase tracking

**Custom `trackMetaPurchase` calls have been REMOVED from all payment paths.**

Shopify's native Facebook/Instagram Sales Channel sends server-side CAPI Purchase events to Meta automatically for every order created via the Admin API (COD, InstaPay, card, Apple Pay all use Admin API). Adding our own client-side `trackPurchase` calls on top produced 2 Purchase events per order in Meta Ads Manager — 1 from our code, 1 from Shopify.

**Do NOT re-add `trackMetaPurchase` calls** without first confirming that Shopify's native Meta integration has been disabled. Adding them back without disabling Shopify's integration will immediately re-create the double-count.

## What the Meta Pixel fires (still active)

| Event | Source |
|---|---|
| `PageView` | index.html snippet on every page load |
| `ViewContent` | `trackViewContent` in `useProductPageState.ts` |
| `AddToCart` | `trackAddToCart` in `CartContext.tsx` |
| `InitiateCheckout` | `trackInitiateCheckout` in `CartDrawer.tsx` |
| `Purchase` | **Shopify only — not our code** |

## Gating
- `isMetaTrackingEnabled()` exact-matches the two prod hostnames and gates BOTH the browser pixel AND CAPI inside `trackEvent`. Mirrors the pixel init gate in `index.html`. Preview/dev/*.replit.app never fire.
- `fbq('set', 'autoConfig', false, ...)` and `fbq('set', 'disableAutoInitialization', true, ...)` in index.html prevent Shopify's auto-pixel from firing through our SPA.

## Pixel init (index.html)
- `autoConfig: false` — no automatic event collection
- `disableAutoInitialization: true` — Shopify's injected pixel cannot re-init ours
- Only `PageView` fires automatically from the snippet

## Dead code (intentionally left in place)
- `metaPixel.ts` — `trackPurchase` function and `sendCapiEvent` are exported but no longer called
- `/api/capi/event` server route — still in place, no longer receives traffic
- `buildMetaLineData` in `checkoutUtils.ts` — still exported, no longer called from checkout

## Double-count root causes (audited — now fixed/removed)

Three bugs were found and fixed before the decision to remove custom tracking entirely:

1. `moi_paymob_result` never cleared by postMessage handler → Path C could re-fire after a postMessage already fired
2. order_id inconsistency between postMessage path and Path C → different event_ids → no Meta dedup
3. CAPI fetch lacked `keepalive: true` → navigation could cancel the request

All three fixes were applied (postMessage handler clears key + reads intentId from sessionStorage; keepalive added). Then the decision was made to remove all custom Purchase tracking entirely to eliminate the Shopify duplicate.

## `trackShopifyPurchase` — NOT Meta

`trackShopifyPurchase` (from `shopifyAnalytics.ts`) sends `payment_info_entered` to Shopify's own monorail endpoint. It has nothing to do with Meta. It remains in all checkout paths.

## Internal purchase analytics — NOT Meta

`trackPurchaseWithTime` (from `analytics.ts`) sends to our internal analytics service. Not Meta.

## Advanced matching PII freshness (historical note)
- Card iframe/postMessage handlers had stale `form` in their closure deps — those paths passed no PII to Meta. COD, InstaPay, Apple Pay had fresh form access. This is now moot since custom Purchase tracking is removed.
