---
name: Paymob card payment architecture
description: How card payments via Paymob are implemented — no Shopify payment transaction APIs used anywhere.
---

## Rule
Shopify is inventory/order management only. Paymob is the payment source of truth for card payments.

## Flow
1. `POST /api/paymob/create-payment` — creates Shopify draft (reserves inventory, gets total) + Paymob intention, saves to `paymob_intents` DB table, returns `clientSecret` + `publicKey`
2. Frontend redirects to: `https://accept.paymob.com/unifiedcheckout/?publicKey=<pk>&clientSecret=<cs>`
3. `POST /api/paymob/webhook` — verifies HMAC-SHA512, completes the Shopify draft order (no payment transaction), sends email/WhatsApp
4. `GET /api/paymob/status?token=<checkoutToken>` — frontend polls for completion

## Correlation
- `checkoutToken` (UUID) is stored in DB and passed as `special_reference` to Paymob
- Webhook identifies the DB record via `transaction.order.merchant_order_id` = `checkoutToken`

## Key files
- `artifacts/api-server/src/lib/paymob.ts` — Paymob Intentions API + HMAC verification
- `artifacts/api-server/src/routes/paymob.ts` — the 3 endpoints above
- `lib/db/src/schema/paymobIntents.ts` — DB schema (paymob_intents table)
- `lib/db/src/index.ts` — insertPaymobIntent, findPaymobIntentByCheckoutToken, updatePaymobIntent

## HMAC verification
HMAC-SHA512 with `PAYMOB_HMAC_SECRET` as key. The message is 20 specific transaction fields concatenated in a fixed order. See `verifyPaymobHmac()` in `paymob.ts`.

**VPC/MIGS integrations send the HMAC as a URL query parameter** (`?hmac=...` appended to the webhook URL), NOT inside the transaction JSON body. UIG integrations send it inside `txn.hmac`. The webhook handler reads from `req.query.hmac` first, falls back to `txn.hmac`.

## Integration types — critical lessons
- **Shopify-type integration** (e.g. 5658307): Paymob hardcodes an internal call to `shopify_callback` after every payment regardless of webhook URL or `notification_url`. This cannot be overridden. Do NOT use for custom checkout — the customer sees "Order has no shopify_payment." error.
- **VPC/Non-Shopify integration** (e.g. 5693943 "MIGS-online", live): Webhook fires correctly to `transaction_processed_callback`. HMAC arrives as query param. Full pipeline confirmed working.
- **UIG/online_new integration** (e.g. 5700496): Returns 404 from Intentions API — incompatible with Intentions API.
- Only ONE test integration per gateway type/currency is allowed. To get a test VPC Non-Shopify integration, the Shopify-type 5658307 must be deleted first to free the slot.

## Integration IDs (as of June 2026)
- 5658307 — test, VPC, **Shopify-type** (causes shopify_callback) — must delete to free test slot
- 5693943 — **live**, VPC, Non-Shopify ("MIGS-online") — works fully, real cards only
- 5700496 — test, UIG/online_new, Non-Shopify — incompatible with Intentions API

## Shopify draft completion for card
`completeShopifyDraftOrder()` in `shopifyOrder.ts` is reused — it does NOT call any Shopify payment transaction API; it just completes the draft which makes the order appear in Shopify Admin for fulfillment.

## Critical constraints
- Never call Shopify payment transaction APIs (no captureShopifyPayment, authorizeShopifyPayment, etc.)
- `createDraftOrder` accepts paymentMethod: "card" — tags as `card,moi-checkout,card-pending`
- `completeShopifyDraftOrder` does NOT return `shippingAmount` — approximate from total threshold

**Why:** Shopify would throw "Order has no Shopify payment" errors if payment transaction APIs are used without a real Shopify payment provider. Paymob is the payment processor; Shopify only needs the order.

## Critical bugs fixed (2026-06-05)

- **Trailing slash bug**: `findSuccessfulPaymobTransaction` used `/api/acceptance/transactions/?merchant_order_id=...` — the trailing slash returns a 404 HTML page, not JSON. Correct endpoint has no trailing slash.
- **Shopify-type integration pending state**: Integration 5658307 (Shopify-type) marks transactions as `pending=true, success=false` because its Shopify payment callback fails with "Order has no shopify_payment". The card IS charged. Both `findSuccessfulPaymobTransaction` and the webhook handler now accept `pending && !error_occured && amount_cents > 0` as a valid payment.
- **Draft completion without payment_pending**: Removed `payment_pending=true` from `completeShopifyDraftOrder` — completing without it marks Shopify order as "Paid" directly. Fallback to `payment_pending=true` + manual transaction if 422.
