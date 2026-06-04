---
name: Card order direct creation fix
description: Definitive fix for "Order has no shopify_payment" — use POST /orders.json with embedded transaction; do NOT set financial_status:"paid" at the top level.
---

## Rule
For card/apple-pay Paymob payments, use `createDirectPaidCardOrder` which calls `POST /orders.json` with the transaction embedded in the payload — but **do NOT set `financial_status: "paid"` at the order level**.

**Why:** On Shopify Payments stores:
- Explicitly setting `financial_status: "paid"` in `POST /orders.json` triggers Shopify Payments validation → `{"message":"Order has no shopify_payment."}`
- `POST /orders/{id}/transactions.json` with any gateway after draft completion → same error
- GraphQL `orderMarkAsPaid` → same restriction
- The ONLY working approach: embed `transactions: [{ kind: "sale", status: "success", gateway: "paymob" }]` in the POST /orders.json payload WITHOUT `financial_status: "paid"`. Shopify auto-computes financial_status from the successful sale transaction, bypassing Shopify Payments validation entirely.

## How to Apply
`createDirectPaidCardOrder` in `shopifyOrder.ts` is the single entry point for all card/apple-pay paid orders:

1. `createDraftOrder(complete: false)` — validate prices + apply discounts. Returns `draftOrderId` + `total`.
2. `GET /draft_orders/{id}.json` — read back Shopify-resolved line item prices.
3. `POST /orders.json` with `{ source_name, transactions: [{ kind: "sale", status: "success", amount: draft.total, gateway: "paymob", authorization: paymobTxnId }] }` — NO `financial_status` or top-level `gateway` field.
4. `DELETE /draft_orders/{id}.json` — cleanup (fire-and-forget).

`createShopifyDirectOrder` routes card+paid → `createDirectPaidCardOrder`, COD → existing draft-complete flow.

## What does NOT work (don't revert to these)
- `financial_status: "paid"` at top level of POST /orders.json → "Order has no shopify_payment" on Shopify Payments stores
- `POST /orders/{id}/transactions.json` with any gateway name → "Order has no shopify_payment"
- `POST /orders/{id}/transactions.json` with `source_name: "external"` → same error
- GraphQL `orderMarkAsPaid` → fails on Shopify Payments stores for draft-completed orders

## InstaPay orders
`completeShopifyDraftOrder` (used for InstaPay admin approval) deliberately does NOT call `recordShopifyPaymentTransaction`. InstaPay orders remain `financial_status: "pending"` in Shopify. Admin manually marks them paid in Shopify after confirming bank transfer receipt.
