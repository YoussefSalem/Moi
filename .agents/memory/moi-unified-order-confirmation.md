---
name: Moi unified order confirmation
description: All payment methods land on one OrderConfirmationPage at /order-confirmed; navigation + snapshot rules; Apple Pay dedicated integration id.
---

# Unified order success page

Every payment method (COD, Apple Pay, InstaPay, card/wallet) ends on a single
`OrderConfirmationPage` at `/order-confirmed`. `/payment/success` is kept only as
a safety-net route that maps to the same page. The old `/ordermade` route and the
separate `PaymentSuccessPage` + inline `card-confirm` step are gone (card-confirm
step is now dead/inert).

**Navigation pattern:** `navigateToOrderConfirmed(intentId)` in CheckoutPage does
`pushState('/order-confirmed?intentId=…')` + `dispatchEvent(PopStateEvent)` +
`setTimeout(closeCheckout, 80)`. App's popstate listener re-parses the route and
renders OrderConfirmationPage. Used by handleIframeSuccess (card), the postMessage
success handler (now SPA nav, was full reload), and the 3DS mount-restore branch.

**Why the snapshot must be normalized:** OrderConfirmationPage renders
`breakdown.subtotal` directly. Writers can persist a partial `moi_order_confirmation`
snapshot (e.g. card 3DS restore with no `moi_paymob_breakdown`). A missing breakdown
crashes the page to blank. Fix: `normalizeConfirmation()` defaults
items/breakdown/paymentMethod before render — keep it; do not dereference snapshot
fields raw.

**How to apply:** When adding a new payment method, write a `moi_order_confirmation`
snapshot (items, breakdown, paymentMethod, orderNumber, intentId) then call
`navigateToOrderConfirmed`. The 3DS mount-restore path READS then DELETES the
`moi_paymob_*` keys, so write the snapshot BEFORE navigating and `return` before the
shared `openCheckout()` or checkout reopens over the confirmation page.

# Apple Pay dedicated integration id

Apple Pay uses its own Paymob integration (`config.applePayIntegrationId`, default
`571502`), NOT the card `config.integrationId`. Used at the guard, merchant-validate
body, and intention `payment_methods` in `applePayDirect.ts`. The dashboard
integration must have Apple Pay enabled.

**Secret gotcha:** `PAYMOB_APPLE_PAY_INTEGRATION_ID` is stored as a global secret.
Secrets cannot be set, overwritten, or deleted programmatically — `setEnvVars`
throws a conflict and `deleteEnvVars` only affects shared/dev/prod scopes (no-op on
a global secret). To change its value you must `requestEnvVar({requestType:"secret"})`
or have the user edit the Secrets tab. The code default (571502) only applies when
the secret is unset, so an existing secret with the old value wins until updated.
