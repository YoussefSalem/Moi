---
name: Card order direct creation fix
description: Definitive fix for "Order has no shopify_payment" — use POST /orders.json with embedded transaction instead of draft-complete-then-add-transaction.
---

## Rule
For card/apple-pay Paymob payments, NEVER try to add a transaction after completing a draft order. Always use `createDirectPaidCardOrder` which calls `POST /orders.json` with the transaction embedded in the creation payload.

**Why:** On Shopify Payments stores, completing a draft order links the resulting Shopify order to Shopify Payments infrastructure. Any subsequent attempt to add a payment transaction fails:
- `POST /orders/{id}/transactions.json` → `{"message":"Order has no shopify_payment."}`
- GraphQL `orderMarkAsPaid` → same restriction (order's payment gateway is locked to Shopify Payments even with `payment_pending=true`)

This is a fundamental Shopify Payments restriction with NO workaround via `source_name: "external"`, custom gateway names, or any REST/GraphQL parameter.

## How to Apply
`createDirectPaidCardOrder` in `shopifyOrder.ts` is the single entry point for all card/apple-pay paid orders:

1. `createDraftOrder(complete: false)` — validate prices + apply discounts. Returns `draftOrderId` + `total`.
2. `GET /draft_orders/{id}.json` — read back Shopify-resolved line item prices.
3. `POST /orders.json` with `{ financial_status: "paid", gateway: "paymob", transactions: [{ kind: "sale", status: "success", amount: draft.total, gateway: "paymob", authorization: paymobTxnId }] }`
4. `DELETE /draft_orders/{id}.json` — cleanup (fire-and-forget).

`createShopifyDirectOrder` routes card+paid → `createDirectPaidCardOrder`, COD → existing draft-complete flow.

## What does NOT work (don't revert to these)
- `POST /orders/{id}/transactions.json` with any gateway name → "Order has no shopify_payment"
- `POST /orders/{id}/transactions.json` with `source_name: "external"` → same error
- GraphQL `orderMarkAsPaid` → fails on Shopify Payments stores for draft-completed orders

## InstaPay orders
`completeShopifyDraftOrder` (used for InstaPay admin approval) deliberately does NOT call `recordShopifyPaymentTransaction`. InstaPay orders remain `financial_status: "pending"` in Shopify. Admin manually marks them paid in Shopify after confirming bank transfer receipt.
