---
name: Card order direct creation — June 2nd working approach
description: The only approach that avoids "Order has no shopify_payment." on Shopify Payments stores is draft-complete (no payment_pending) → capture the auto-created pending transaction.
---

## Rule
For card/apple-pay Paymob payments, use the **draft → complete → capture** flow:

1. `createDraftOrder(complete: true)` **WITHOUT** `payment_pending=true` (COD-only gets payment_pending)
2. Shopify auto-creates a `kind:"pending"` transaction on the completed order
3. `recordShopifyPaymentTransaction` checks for that pending transaction and posts `kind:"capture"` with `parent_id` to mark the order paid

**Why:** On Shopify Payments stores, ANY attempt to add a transaction to a Shopify-Payments-linked order via `POST /transactions.json` with `kind:"sale"` fails with `{"message":"Order has no shopify_payment."}`. But capturing an authorization Shopify itself created works fine — Shopify created that pending transaction through its own Payments infrastructure.

**Why `payment_pending=true` only for COD:**
- COD: `payment_pending=true` prevents Shopify's auto-capture from marking it "paid" immediately on stores with automatic capture enabled.
- Card/Apple Pay: `payment_pending=true` would suppress the auto-created pending authorization, leaving nothing to capture, causing the same error.

## What does NOT work (do not revert to these)
- `financial_status: "paid"` at any level of `POST /orders.json` → "Order has no shopify_payment"
- `POST /orders.json` with embedded `transactions: [{ kind: "sale" }]` → same error
- `POST /orders/{id}/transactions.json` with `kind: "sale"` after draft completion → same error
- `POST /orders/{id}/transactions.json` with `source_name: "external"` → same error
- GraphQL `orderMarkAsPaid` → fails on Shopify Payments stores
- `POST /orders.json` embedded-transaction approach (was `createDirectPaidCardOrder`, now deleted) → do NOT re-introduce. A doc comment in shopifyOrder.ts once claimed it was "the only reliable approach" — that comment was wrong and caused a regression; the proven approach is draft→complete→capture.

## Capturable transaction match (recordShopifyPaymentTransaction)
The Shopify auto-created authorization is usually `kind:"pending", status:"success"` but can be `kind:"authorization"` on some stores. Match must accept either, else it falls back to `kind:"sale"` and fails. When no capturable txn is found it logs the full transaction list — read that log to diagnose.

## payment_pending in `completeDraftOrder` (InstaPay)
`completeDraftOrder` (used for InstaPay admin approval) keeps `payment_pending=true` because InstaPay orders are approved later via the admin panel, not auto-captured. These orders remain `financial_status: "pending"` in Shopify.
