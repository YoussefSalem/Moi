---
name: Apple Pay — native ApplePaySession via Paymob
description: Apple Pay now uses native ApplePaySession with Paymob backend (validate-merchant + authorize). The old Shopify popup approach is gone.
---

## The Rule
Apple Pay uses **native `ApplePaySession`** — no popup, no Shopify checkout redirect.
The flow is: `ApplePaySession.begin()` → `onvalidatemerchant` → `POST /api/apple-pay/validate-merchant` → `completeMerchantValidation` → `onpaymentauthorized` → `POST /api/apple-pay/authorize` → `setStep("cod-confirm")`.

**Why:** The domain `buy-moi.com` was registered with Apple Pay via Paymob. The backend routes were already in place (`applePayDirect.ts`). The popup was a workaround; native session gives a better UX (no popup, Face ID/Touch ID inline).

**How to apply:** `triggerApplePayDirectInit` in `CheckoutPage.tsx` is a non-async `useCallback` — `session.begin()` MUST be called synchronously in the click handler. All async work (fetch calls) happens inside session event callbacks (`onvalidatemerchant`, `onpaymentauthorized`).

## Success path
On `onpaymentauthorized` success:
1. `session.completePayment({ status: AP.STATUS_SUCCESS })`
2. Build `cartItemsSnapshot` from `shopifyCart` or `localItems`
3. `setOrderResult({ orderNumber, shopifyOrderNumber, total, items })`
4. `setStep("cod-confirm")` — reuses COD confirmation screen (shows order number)
5. `clearCart()`

## Failure path
`session.completePayment({ status: AP.STATUS_FAILURE })` → `setSubmitError(...)` → `setPaymentMethod("cod")`

## Critical credential detail
`applePayDirect.ts` MUST use `config.applePayIntegrationId` (not `config.integrationId`) for ALL three places: guard check, validate-merchant body, and intention `payment_methods`. The apple pay integration is the one tied to Shopify's Apple certificates via Paymob; using the card integration ID causes "Payment Not Completed".

## Backend endpoints (already complete)
- `POST /api/apple-pay/validate-merchant` — proxies Paymob merchant session
- `POST /api/apple-pay/authorize` — processes Apple Pay token via Paymob, creates Shopify order via `processPaymobSuccess`

## Domain association
`app.ts` serves `/.well-known/apple-developer-merchantid-domain-association` from env var `APPLE_PAY_DOMAIN_ASSOCIATION`.

## Architecture gotcha
`showOverlaySuccess` lives inside `PaymobIframe` component (line ~2785), NOT `CheckoutPage`. Do NOT try to wire Apple Pay success through `PaymobIframe`'s overlay — set React state directly in `CheckoutPage` instead.
