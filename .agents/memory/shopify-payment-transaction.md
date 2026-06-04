---
name: Shopify payment transaction for custom gateways
description: How to correctly mark a Shopify order as paid after completing a draft order with a custom gateway (Paymob). What breaks and why.
---

## The rule

Always post `kind: "sale"` to `POST /orders/{id}/transactions.json` for custom payment gateways. Never use `kind: "capture"`.

**Why:** Completing a draft order auto-creates a `kind: "pending"` transaction. `capture` only works on authorization transactions created by **Shopify Payments** — using it on a custom-gateway pending transaction returns `{"message":"Order has no shopify_payment."}`. Shopify correctly accepts `kind: "sale"` even when a pending transaction already exists for custom gateways.

**How to apply:** In `recordShopifyPaymentTransaction` (artifacts/api-server/src/lib/shopifyOrder.ts), the transaction body is always `kind: "sale"`. Do not check for existing pending transactions or try to capture them.

## What NOT to do

```js
// WRONG — causes "Order has no shopify_payment." after 3DS
const pending = transactions.find(t => t.kind === "pending");
if (pending) {
  body = { kind: "capture", parent_id: pending.id, ... };
}
```

## What to do

```js
// CORRECT — always sale for Paymob / custom gateways
body = { kind: "sale", status: "success", gateway: "Paymob", amount, currency: "EGP" };
```
