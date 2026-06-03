---
name: Apple Pay — Shopify native vs Paymob
description: Why custom ApplePaySession+Paymob fails for Apple Pay and how to do it correctly on this project.
---

# Apple Pay — Shopify native (correct) vs custom ApplePaySession+Paymob (broken)

## The rule
Do NOT use `ApplePaySession` + Paymob for Apple Pay on this project. Redirect to Shopify checkout instead.

**Why:**
- Paymob's regular card integration (5658307) cannot decrypt Apple Pay tokens — it needs a dedicated Apple Pay integration ID.
- Even if that ID were set, Paymob's merchant certificate must be registered for the exact domain (buy-moi.com). On the Replit preview domain it is never registered, so Apple rejects the merchant session silently — Face ID never appears, just "Payment Not Completed".
- Shopify already has a valid Apple Pay merchant certificate and processes tokens natively on its hosted checkout pages.

## How to apply
- `ShopifyApplePayButton` now works purely via redirect:
  - Product page: calls `buyNowCheckoutUrl(variantId, quantity)` from `useCart()` → `window.location.href = checkoutUrl`
  - Cart drawer: receives `checkoutUrl` prop directly → `window.location.href = checkoutUrl`
- Still uses `ApplePaySession.canMakePayments()` to hide the button on non-Apple devices.
- No `ApplePaySession`, no Paymob, no merchant validation code in the frontend.

## Files
- `artifacts/moi/src/components/ShopifyApplePayButton.tsx` — rewritten to redirect-only
- `artifacts/moi/src/pages/ProductPage.tsx` — removed `priceEGP` prop
- `artifacts/moi/src/components/CartDrawer.tsx` — passes `checkoutUrl` instead of `lines`/`totalEGP`
- `artifacts/api-server/src/routes/applePayDirect.ts` — backend still exists (used for checkout-page tile if ever wired)
- `artifacts/api-server/src/lib/paymob.ts` — `createApplePayPaymentKeyRaw` still exists but unused by the frontend button
