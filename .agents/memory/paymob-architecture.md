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

## Shopify draft completion for card
`completeShopifyDraftOrder()` in `shopifyOrder.ts` is reused — it does NOT call any Shopify payment transaction API; it just completes the draft which makes the order appear in Shopify Admin for fulfillment.

## Critical constraints
- Never call Shopify payment transaction APIs (no captureShopifyPayment, authorizeShopifyPayment, etc.)
- `createDraftOrder` accepts paymentMethod: "card" — tags as `card,moi-checkout,card-pending`
- `completeShopifyDraftOrder` does NOT return `shippingAmount` — approximate from total threshold

**Why:** Shopify would throw "Order has no Shopify payment" errors if payment transaction APIs are used without a real Shopify payment provider. Paymob is the payment processor; Shopify only needs the order.
