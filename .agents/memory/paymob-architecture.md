---
name: Paymob card payment architecture
description: How card payments via Paymob are implemented — no Shopify payment transaction APIs used anywhere.
---

## Rule
Shopify is inventory/order management only. Paymob is the payment source of truth for card payments.

## Flow (legacy iframe — current implementation)
1. `POST /api/paymob/create-payment` — creates Shopify draft (reserves inventory, gets total) + calls legacy Paymob API (auth → order → payment_key), saves to `paymob_intents` DB table, returns `iframeUrl` + `checkoutToken`
2. Frontend shows `<iframe src={iframeUrl}>` — Paymob hosted payment page inside iframe
3. On iframe 2nd load (Paymob redirect after payment), frontend immediately calls verify-payment
4. `POST /api/paymob/verify-payment` — queries Paymob transactions API by merchant_order_id, completes the Shopify draft order if transaction found, sends email/WhatsApp
5. `POST /api/paymob/webhook` — verifies HMAC-SHA512, also completes draft order (runs in parallel with verify-payment; idempotent)
6. Frontend also polls verify-payment every 5 s as a fallback

## Why legacy iframe, NOT Pixel/Intentions v1
The Pixel (Intentions v1 API) with integration 5658307 (Shopify-type) triggers an internal Paymob `shopify_callback` after every 3DS, which fails with "Order has no shopify_payment" and leaves transactions permanently Pending (never Success/Declined — money never settled). The legacy iframe API with the same integration does NOT trigger the Shopify callback — transactions resolve to Success/Declined as normal. Evidence: June 2026 successful transactions (e.g. 471988307) used legacy iframe (Origin: "Application"), failed ones used Pixel (Origin: "OTHER").

## Paymob legacy API flow
1. POST `/api/auth/tokens` with `PAYMOB_API_KEY` → `auth_token`
2. POST `/api/ecommerce/orders` with `merchant_order_id = checkoutToken` (UUID) → `paymobOrderId`
3. POST `/api/acceptance/payment_keys` with `order_id`, `integration_id`, `notification_url`, `redirection_url` → `paymentToken`
4. Iframe URL: `https://accept.paymob.com/api/acceptance/iframes/{PAYMOB_IFRAME_ID}?payment_token={paymentToken}`

## Correlation
- `checkoutToken` (UUID) = `merchant_order_id` on the Paymob order
- Webhook & verify-payment both find the DB record via `transaction.order.merchant_order_id` = `checkoutToken`

## Key files
- `artifacts/api-server/src/lib/paymob.ts` — `createLegacyPaymobPayment` + HMAC verification
- `artifacts/api-server/src/routes/paymob.ts` — create-payment, webhook, verify-payment, status endpoints
- `artifacts/moi/src/components/PixelCheckoutPanel.tsx` — iframe checkout panel (kept name for import compatibility)
- `lib/db/src/schema/paymobIntents.ts` — DB schema (paymob_intents table)

## HMAC verification
HMAC-SHA512 with `PAYMOB_HMAC_SECRET` as key. The message is 20 specific transaction fields concatenated in a fixed order. See `verifyPaymobHmac()` in `paymob.ts`.

**VPC/MIGS integrations send the HMAC as a URL query parameter** (`?hmac=...` appended to the webhook URL), NOT inside the transaction JSON body. Webhook handler reads from `req.query.hmac` first, falls back to `txn.hmac`.

## Integration IDs (as of June 2026)
- 5658307 — test, VPC, Shopify-type — legacy iframe works; Pixel/Intentions does NOT work
- PAYMOB_IFRAME_ID = 1041673 — legacy hosted payment page iframe

## Pending transaction capture (critical)
When the webhook arrives with `pending=true && success=false` (Shopify-type integration callback failure), the webhook handler MUST call `capturePaymobTransaction(txn.id, txn.amount_cents)` before completing the Shopify draft. Without this, the transaction stays "Pending" in the Paymob dashboard forever even though the card was charged. The capture call is now present in both `src/routes/paymob.ts` (webhook handler) and `src/services/webhook.service.ts`. `verify-payment` had this fix already.

## Shopify draft completion for card
`completeShopifyDraftOrder()` does NOT call any Shopify payment transaction API. Completes the draft directly; no `payment_pending=true`. Fallback to `payment_pending=true` + manual transaction if 422.

## Critical constraints
- Never call Shopify payment transaction APIs
- Never use Pixel/Intentions v1 API with integration 5658307 — transactions stay Pending forever
- `createDraftOrder` tags as `card,moi-checkout,card-pending`

## Env vars required
- PAYMOB_API_KEY (legacy base64 JWT)
- PAYMOB_INTEGRATION_ID (5658307 for test)
- PAYMOB_IFRAME_ID (1041673)
- PAYMOB_HMAC_SECRET
- PAYMOB_SECRET_KEY / PAYMOB_PUBLIC_KEY (can remain set but unused for payment creation now)
