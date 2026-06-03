---
name: Apple Pay via Shopify checkout popup
description: How Apple Pay is implemented — opens Shopify's hosted checkout in a popup window; no custom Apple Pay session or Paymob integration ID needed.
---

## The Rule
Apple Pay button → `window.open(checkoutUrl, "shopify_checkout", popup_params)` in a centered 480×700 popup.
Do NOT use native `ApplePaySession` on buy-moi.com (domain not registered).
Do NOT use `PAYMOB_APPLE_PAY_INTEGRATION_ID` or Paymob Pixel SDK.

**Why:** Shopify's checkout domain (`checkout-moi.myshopify.com`) is already registered with Apple Pay via "Paymob — Native Checkout for Debit/Credit Cards" (shown in Shopify Admin > Payments). Opening that URL as a popup keeps the user on buy-moi.com while Shopify's checkout handles Apple Pay natively. No domain registration needed on our end.

## Shared utility
`artifacts/moi/src/lib/shopifyCheckout.ts` — `openShopifyCheckout(url: string): void`
Opens a centered 480×700 popup. Named window "shopify_checkout" (reuses same popup if already open).

## How it flows

### Product page (`ShopifyApplePayButton.tsx`)
1. User taps Apple Pay button
2. `addToCart({ variantId, quantity, ... })` → returns `checkoutUrl` (new or updated Shopify cart)
3. `openShopifyCheckout(url)` — popup opens with Shopify checkout

### Cart drawer (`ShopifyApplePayButton.tsx`, no variantId)
1. Cart already has items; `checkoutUrl` from `useCart()` is set
2. `openShopifyCheckout(checkoutUrl)` directly

### Checkout page (`CheckoutPage.tsx`)
1. Apple Pay tile visible only when `checkoutUrl && ApplePaySession.canMakePayments()`
2. tile onClick → `openShopifyCheckout(checkoutUrl)`

## What's intentionally unused (but still present)
- `triggerApplePayDirectInit` / `applePayData` in CheckoutPage — no longer triggered by the tile; leave in place, they don't cause errors
- `PaymobApplePayButton` renders in CheckoutPage when `applePayData` is set — dead path now
- `artifacts/api-server/src/routes/paymobApplePayInit.ts` — still callable but no longer called by frontend Apple Pay flow
