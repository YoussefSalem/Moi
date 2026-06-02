---
name: Apple Pay via Shopify checkout
description: Apple Pay is now handled entirely by Shopify checkout redirect — all Paymob Apple Pay code removed.
---

## Rule
Apple Pay goes through Shopify's hosted checkout, not Paymob. When a user taps Apple Pay anywhere on the site, they are redirected to `cart.checkoutUrl` (the Shopify-generated checkout URL). Shopify's checkout shows Apple Pay as an express payment option natively.

**Why:** Owner requested Apple Pay be handled by Shopify only, eliminating the Paymob Pixel SDK dependency, the custom ApplePaySession flow, and all associated backend routes.

## How to apply
- **Product page**: `handleBuyWithApplePay` calls `addToCart(...)` (which now returns `string | null` — the checkoutUrl) then does `window.location.href = checkoutUrl`.
- **Checkout page**: The Apple Pay tile in the payment method grid directly redirects to `checkoutUrl` on click. The tile is only shown when `checkoutUrl` is non-null AND `ApplePaySession.canMakePayments()` is true.
- **`CartContext.addToCart`**: Return type changed from `Promise<void>` to `Promise<string | null>` — returns `cart.checkoutUrl` after the Shopify cart add.

## Removed code
- `artifacts/api-server/src/routes/applePayDirect.ts` — `POST /api/apple-pay/validate-merchant` and `/api/apple-pay/authorize`
- `artifacts/api-server/src/routes/paymobApplePayInit.ts` — `POST /api/orders/paymob-apple-pay-init`
- `artifacts/moi/src/components/PaymobApplePayButton.tsx` — Paymob Pixel SDK wrapper
- All `applePayData` state, `triggerApplePayDirectInit`, `handleApplePaySuccess`, `handleApplePayFail` in CheckoutPage
