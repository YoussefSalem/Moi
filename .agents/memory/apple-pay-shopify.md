---
name: Apple Pay via Paymob — native sheet + Shopify order
description: Apple Pay uses the native OS sheet (Paymob direct on product page, Pixel SDK on checkout). On success, a Shopify order is created.
---

## Rule
Apple Pay shows the native Apple Pay sheet. After authorization, a Shopify order is created via `processPaymobSuccess` (same as card payments). The Shopify `checkoutUrl` redirect approach was tried but reverted because the user wanted the native double-click sheet experience.

**Why:** Owner confirmed they want the native Apple Pay sheet (Touch ID / Face ID double-press), not a redirect to Shopify checkout. Payment is processed via Paymob; Shopify order is created server-side on success.

## Two flows

### Product page (direct ApplePaySession)
- `handleBuyWithApplePay` in `ProductPage.tsx` creates `ApplePaySession` synchronously in the click handler (required by Apple).
- `onvalidatemerchant`: calls `/api/apple-pay/validate-merchant` — creates intent + Paymob legacy payment key + proxies merchant validation.
- `onpaymentauthorized`: calls `/api/apple-pay/authorize` — submits token to Paymob, calls `processPaymobSuccess` to create Shopify order, stores result in `sessionStorage("moi_apple_pay_result")`, then `openCheckout()` to show confirmation.
- Backend: `applePayDirect.ts`

### Checkout page (Paymob Pixel SDK)
- Apple Pay tile sets `paymentMethod = "apple-pay"`. `handleSubmit` calls `/api/orders/paymob-apple-pay-init` which creates a Paymob Unified Checkout intention.
- `PaymobApplePayButton` loads the Pixel SDK, renders the native Apple Pay button, fires `afterPaymentComplete(txnId)`.
- `handleApplePaySuccess` polls `/api/orders/paymob-sync` (up to 5×) until `status === "completed"`, then shows confirmation. Creates Shopify order via webhook/sync.
- `triggerApplePayDirectInit` is called when checkout opens with `moi_preferred_payment = "apple-pay"` in sessionStorage.
- Backend: `paymobApplePayInit.ts`

## CartContext
`addToCart` returns `Promise<void>` (not `string | null`). The `checkoutUrl` is exposed on the context as `checkoutUrl: string | null` from `shopifyCart.checkoutUrl`.

