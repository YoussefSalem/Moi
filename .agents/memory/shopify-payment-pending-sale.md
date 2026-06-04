---
name: Shopify payment_pending + GraphQL orderMarkAsPaid
description: Always complete draft orders with payment_pending=true; use GraphQL orderMarkAsPaid mutation (not REST transactions) to mark card/apple-pay orders as paid.
---

## Rule

1. **Always** complete draft orders with `payment_pending=true` for ALL payment methods (COD, card, Apple Pay, InstaPay).
2. **Never** use the REST `POST /orders/{id}/transactions.json` API to mark Shopify orders as paid. Use the GraphQL `orderMarkAsPaid` mutation instead.

## Why

- Without `payment_pending=true`, Shopify auto-creates a phantom pending transaction on draft order completion. This transaction is linked to no real gateway, causing downstream failures.
- The REST transactions API (`kind: "sale"` or `kind: "capture"`) returns `{"message":"Order has no shopify_payment."}` on stores with Shopify Payments enabled. This error occurs for ALL transaction kinds — not just `capture`. The GraphQL `orderMarkAsPaid` mutation bypasses this restriction entirely.

## How to apply

The GraphQL mutation (`recordShopifyPaymentTransaction` in `shopifyOrder.ts`):

```graphql
mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
  orderMarkAsPaid(input: $input) {
    order { id displayFinancialStatus }
    userErrors { field message }
  }
}
```

Variables: `{ "input": { "id": "gid://shopify/Order/{orderId}" } }`

- Idempotent: "already paid" userErrors are treated as success.
- Used by: `createShopifyDirectOrder` (card/apple-pay), `completeShopifyDraftOrder` (InstaPay admin approval), and the admin "fix-payment-transaction" button.
- All three draft completion call sites must include `payment_pending=true` in the URL.
