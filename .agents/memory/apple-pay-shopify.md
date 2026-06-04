---
name: Apple Pay via Shopify checkout redirect
description: Apple Pay is handled entirely by Shopify — every "Buy with Apple Pay" button redirects to the Shopify checkoutUrl. No Paymob Apple Pay processing.
---

## Rule
Apple Pay is NOT processed by Paymob. Every Apple Pay entry point redirects the
shopper to the Shopify `checkoutUrl`, where Shopify's own Apple Pay button
(Shopify Payments) completes the purchase.

**Why:** Apple Pay requires the *processing* domain to be registered/verified
with Apple. The custom Moi domain is not registered with Paymob's Apple Pay
merchant ID, and no dedicated Paymob Apple Pay integration exists, so the native
Paymob Apple Pay sheet always failed ("Payment Not Completed"). Shopify's
checkout domain IS Apple-verified, so routing Apple Pay through Shopify checkout
is the only reliable path. Owner explicitly asked to "just use shopify button."

**Constraint to remember:** You CANNOT show a native Apple Pay sheet on the Moi
domain that settles through Shopify Payments — Apple's domain verification
forbids it. The shopper must land on Shopify's checkout (briefly visible). To
make that on-brand, add a custom domain in Shopify so checkout isn't `*.myshopify.com`.

## How to apply
- Product page "Buy with Apple Pay" (single-item express): call `buyNowCheckoutUrl(variantId, 1)` from `useCart()` → `window.location.href = checkoutUrl`. NEVER `clearCart()` + `addToCart()` — that races (clearCart only sets React state, so `ensureShopifyCart`'s closure reads the stale cart in the same tick and appends to the OLD cart) AND destroys the persistent cart pre-payment.
- `buyNowCheckoutUrl(variantId, quantity)` creates a brand-new ephemeral Shopify cart (`createCartWithLines`) and returns its `checkoutUrl` WITHOUT mutating the persistent cart — so cancelling Apple Pay loses nothing.
- Cart drawer "Buy with Apple Pay" (whole cart): redirect to `checkoutUrl` from `useCart()` (cart already populated, no race).
- Checkout page Apple Pay express button: redirect to `shopifyCart?.checkoutUrl`.
- All entry points show a `toast.error` fallback when the resolved checkoutUrl is null.
- `addToCart` returns `Promise<string | null>` (the checkoutUrl), NOT void.
- Apple Pay buttons still render only on Apple-Pay-capable devices (`ApplePaySession.canMakePayments()`).

## Dead/dormant code (frontend, harmless — noUnusedLocals is false)
- Paymob Apple Pay routes (`/api/apple-pay/validate-merchant`, `/api/apple-pay/authorize`, `/api/orders/paymob-apple-pay-init`) are no longer called from the frontend. They were hardened to require a dedicated `applePayIntegrationId` (no fallback to the card integration).
- `CheckoutPage` still contains `applePayData`/`PaymobApplePayButton`/`triggerApplePayDirectInit`/`handleApplePaySuccess`/`handleApplePayFail` and the `moi_apple_pay_result` sessionStorage flow — dormant because nothing populates them anymore.

Card / COD / InstaPay remain headless on-site via Paymob (no Shopify redirect).
