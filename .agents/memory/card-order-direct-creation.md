---
name: Card order via draft on Shopify Payments stores
description: The correct approach for marking card/apple-pay orders as paid on Shopify Payments stores. The previous entry was wrong — completing WITHOUT payment_pending causes the error.
---

## Rule
For card/apple-pay Paymob payments, use **draft → complete WITH payment_pending=true → POST kind:"sale"**:

1. `createDraftOrder(complete: true)` WITH `payment_pending=true` for ALL payment methods (card, apple-pay, COD)
2. For card/apple-pay: immediately POST `kind:"sale"`, `gateway:"Paymob"` via `recordShopifyPaymentTransaction`
3. Order becomes `financial_status:"paid"`

**Why payment_pending=true is required for card/apple-pay:**
Completing a draft order WITHOUT `payment_pending=true` causes Shopify to auto-create a pending authorization with `gateway:"shopify_payments"`. The Admin API **cannot capture a Shopify Payments authorization** — it returns `{"message":"Order has no shopify_payment."}`. So we must prevent Shopify from creating that authorization by always passing `payment_pending=true`, leaving the order with no existing transaction, then posting our own `kind:"sale"` transaction.

**Why:** Admin API `kind:"sale"` succeeds on a `payment_pending=true`-completed order because it has no Shopify Payments record. It fails when Shopify auto-created an authorization (which it did when we completed WITHOUT `payment_pending=true`).

## The error timeline
- Previous (wrong) approach: complete WITHOUT `payment_pending` → Shopify creates `kind:"pending"`, `gateway:"shopify_payments"` auth → capture it → `"Order has no shopify_payment."` (Admin API can't capture Shopify Payments auth)
- OR: timing miss → no auth found yet → try `kind:"sale"` → same error (auth was just created)
- **Correct**: complete WITH `payment_pending=true` → no Shopify Payments record → `kind:"sale"` succeeds

## What does NOT work
- `kind:"capture"` with `parent_id` against a Shopify Payments auto-authorization → "Order has no shopify_payment."
- `kind:"sale"` after completing WITHOUT `payment_pending=true` → same error
- `financial_status:"paid"` in `POST /orders.json` → same error
- `POST /orders.json` embedded transactions → same error
- GraphQL `orderMarkAsPaid` → fails on Shopify Payments stores

## COD
`payment_pending=true` also used for COD — order stays `financial_status:"pending"` (no transaction posted), correct for cash on delivery.

## InstaPay
`completeShopifyDraftOrder` (InstaPay admin approval) also uses `payment_pending=true` — remains pending until manually approved.
