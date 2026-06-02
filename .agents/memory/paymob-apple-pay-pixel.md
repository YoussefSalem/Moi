---
name: Paymob Apple Pay on web = Pixel SDK
description: How native-style Apple Pay works with Paymob on a web app, and why it can't be tested in dev.
---

# Paymob Apple Pay (web)

Paymob's official **web** API path for Apple Pay is their **Pixel embedded SDK**, NOT a separate
"pure native" ApplePaySession integration and NOT the full-page unified-checkout iframe.

Flow:
1. Backend creates a Paymob **Intention** (`POST https://accept.paymob.com/v1/intention/`,
   `Authorization: Token {secretKey}`, `payment_methods: [applePayIntegrationId]`) → returns `client_secret`.
2. Frontend loads the Pixel SDK as an **ES module**: `https://cdn.jsdelivr.net/npm/paymob-pixel@latest/main.js`
   (+ `styles.css`, `main.css`). The module attaches a global `window.Pixel` (set async — poll for it after load).
3. `new Pixel({ publicKey, clientSecret, paymentMethods: ['apple-pay'], elementId, afterPaymentComplete, onPaymentCancel })`
   renders the native Apple Pay button inline into `elementId` and triggers the real Apple Pay sheet.
4. `afterPaymentComplete(response)` fires only after Paymob confirms payment → finalize order via the
   existing `/api/orders/paymob-sync` (verify + create Shopify order). Only treat sync `status === "completed"`
   as success; retry while `pending`; never show success on `pending`/non-OK.

**Why it can't run in dev preview:** Apple Pay requires (a) Apple-Pay **domain verification** (host Paymob's
`apple-developer-merchantid-domain-association` file on the LIVE domain) and (b) a **Payment Processing
Certificate** (merchant generates CSR via openssl, uploads to Apple, sends `.pem` certs to Paymob support).
Until both are registered with Paymob on the live published domain, the button won't render / sheet won't open.

**"Same APIs as card":** when Paymob support says Apple Pay "works through the same APIs as card", they mean
the same Intention + integration flow — it does NOT remove the Apple-side domain/cert requirements.

Docs: developers.paymob.com → payment-methods/apple-pay-all-regions, faq/apple-pay-certificates-creation,
faq/apple-pay-domain-verification, developers/checkout-experiences/pixel-embedded.
