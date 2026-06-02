---
name: Paymob Apple Pay Direct ApplePaySession
description: Single-tap native Apple Pay sheet using direct ApplePaySession (no Pixel SDK button). How it works, endpoints used, and the critical async trick.
---

## The single-tap trick

`ApplePaySession.onvalidatemerchant` fires ASYNCHRONOUSLY after `session.begin()` — the native iOS sheet is already visible. This means you can do all backend initialization (create intent, get payment key, validate merchant) INSIDE `onvalidatemerchant` without violating the user-gesture requirement.

```
User taps button
  → new ApplePaySession(3, { total: { type: 'final', amount } })   ← SYNC, in gesture
  → session.begin()                                                 ← SYNC, sheet opens
  → onvalidatemerchant (async):
      fetch /api/apple-pay/validate-merchant                        ← parallel in backend
      completeMerchantValidation(data.merchantSession)
  → User authorizes with Face ID
  → onpaymentauthorized (async):
      fetch /api/apple-pay/authorize
      completePayment(STATUS_SUCCESS or STATUS_FAILURE)
```

## Paymob endpoints (from Pixel SDK source)

Merchant validation:
- `POST https://accept.paymob.com/api/auth/merchant/validate`
- Body: `{ appleURL: event.validationURL, integrationId: applePayIntegrationId }`
- Returns: `{ api_response: merchantSession }` — pass `api_response` to `completeMerchantValidation`

Payment:
- `POST https://accept.paymob.com/api/acceptance/payments/pay`
- Body: `{ source: { identifier: JSON.stringify(payment.token.paymentData), subtype: "APPLE_PAY" }, payment_token: paymobPaymentKey, api_source: "PIXEL" }`
- Success: `status === 200 && response.success === "true"`
- Declined: `status === 200 && response.success === "false" && response.pending === "false"`

## Payment key for Apple Pay

Use the legacy 3-step flow: auth → order → payment_keys, but with `applePayIntegrationId` (not card integrationId). See `createApplePayPaymentKeyRaw` in `artifacts/api-server/src/lib/paymob.ts`.

Use NA placeholders for billing_data (real contact comes from Apple Pay sheet later).

## Backend routes

`POST /api/apple-pay/validate-merchant`:
- Creates intent in DB (customer = NA placeholders)
- Runs `createApplePayPaymentKeyRaw` + Paymob merchant validation IN PARALLEL
- Returns: `{ merchantSession, intentId, paymobPaymentKey, total }`

`POST /api/apple-pay/authorize`:
- Updates intent.customer with real Apple Pay shippingContact data
- Calls Paymob payments/pay
- On success: calls processPaymobSuccess → Shopify order + email + WhatsApp
- Returns: `{ success, txnId, shopifyOrderId, shopifyOrderNumber, total }`

## Contact data from Apple Pay sheet

`event.payment.shippingContact` contains: `givenName`, `familyName`, `emailAddress`, `phoneNumber`, `addressLines[0]`, `locality` (city), `administrativeArea` (governorate).

## Success UI

After successful payment, ProductPage stores result in `sessionStorage("moi_apple_pay_result")` and calls `openCheckout()`. CheckoutPage's useEffect detects this key, sets `orderResult` + `step = "card-confirm"` directly.

**Why:** `handleIframeSuccess` requires `orderResult` to be pre-set; the direct path skips the paymob-init flow so we set state directly.

## How to apply

This flow is used ONLY from ProductPage's "Buy with Apple Pay" button for direct single-product purchase. The Pixel SDK / checkout-drawer flow is still used for the cart checkout path.
