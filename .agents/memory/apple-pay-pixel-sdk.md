---
name: Apple Pay via Paymob Pixel SDK
description: Why native ApplePaySession fails and how the Paymob Pixel SDK approach works instead.
---

## The Rule
Never use native `ApplePaySession` for Apple Pay. Use Paymob's Pixel SDK via the `paymob-apple-pay-init` flow instead.

**Why:** `ApplePaySession.completeMerchantValidation()` requires the serving domain to be registered with Apple Pay's merchant account. Dev domains (*.replit.dev) and unregistered custom domains silently reject the merchant session — the sheet shows "Payment Not Completed" before Face ID, and `onpaymentauthorized` never fires. Server logs only ever show `validate-merchant` (succeeds) but never `authorize` calls.

**How to apply:**
1. Frontend calls `/api/orders/paymob-apple-pay-init` with cart lines + amount
2. Backend creates Paymob v1 intention → returns `{ clientSecret, publicKey, intentId }`
3. Frontend renders `<PaymobApplePayButton clientSecret=... publicKey=... />` (loads `paymob-pixel` JS SDK from CDN)
4. Pixel SDK shows native Apple Pay button on Paymob's registered domain context → Face ID → payment
5. Webhook fires → `processPaymobSuccess` → Shopify order created

## Key Files
- `artifacts/moi/src/components/PaymobApplePayButton.tsx` — Pixel SDK wrapper, uses `paymentMethods: ["apple-pay"]`
- `artifacts/moi/src/components/ShopifyApplePayButton.tsx` — product page express button; click → API call → renders PaymobApplePayButton
- `artifacts/api-server/src/routes/paymobApplePayInit.ts` — creates Paymob v1 intention; uses `PAYMOB_APPLE_PAY_INTEGRATION_ID` if set, else falls back to card integration ID
- `artifacts/api-server/src/routes/applePayDirect.ts` — old native approach (validate-merchant + authorize); still exists but NOT the active path

## Integration ID
- `PAYMOB_APPLE_PAY_INTEGRATION_ID` env var: set this to the Apple Pay integration ID from Paymob dashboard for full Apple Pay support
- Without it: falls back to card integration ID (unified checkout opens but may not show Apple Pay button)
- Card integration ID (5658307) is always set as `PAYMOB_INTEGRATION_ID`

## Email Placeholder
Paymob's v1 intention rejects `"NA"` as billing_data.email. Always use `"guest@buy-moi.com"` as the fallback when no customer email is available at payment init time.

## Checkout Page Wiring
- Apple Pay tile onClick → calls `triggerApplePayDirectInit()` → sets `applePayData` → `PaymobApplePayButton` renders in the payment surface area
- `applePayDirect.ts` routes (`/api/apple-pay/validate-merchant`, `/api/apple-pay/authorize`) are legacy and no longer called by the frontend
