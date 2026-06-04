---
name: COD order bugs root causes
description: Root causes and fixes for COD orders showing as Paid and Bosta showing 0 COD amount.
---

## Bug 1 — COD orders showing "Paid" in Shopify

**Root cause:** When completing a Shopify draft order, Shopify auto-creates a "pending" payment transaction. Stores with automatic payment capture enabled immediately capture it → `financial_status: "paid"`.

**Fix:** Pass `&payment_pending=true` in the draft completion URL for COD orders (`createDraftOrder` in `shopifyOrder.ts`). This tells Shopify the payment is pending (COD), creates no pending transaction, and prevents auto-capture.

**Why:** `payment_pending=true` is the documented Shopify mechanism for COD/manual payment orders. Without it, the auto-created pending transaction is vulnerable to store-level auto-capture settings.

**How to apply:** Only add `payment_pending=true` for `paymentMethod === "cod"`. Card orders need the pending transaction so `recordShopifyPaymentTransaction` can capture it.

## Bug 2 — Bosta shipment shows "No Cash Collection" (0 EGP)

**Root cause:** `BOSTA_API_KEY` was not configured as a secret. `createBostaShipment` returns `null` immediately and silently when the key is missing (`if (!apiKey) return null`). No shipment is created by our code. The Bosta Shopify App (installed on the store) fires via Shopify order-created webhook and creates its own Bosta shipment without knowing the COD amount → 0 EGP "No Cash Collection".

**Fix:** Add `BOSTA_API_KEY` as a Replit secret. Also added a `logger.warn` when the key is missing (was silently failing, making diagnosis very difficult).

**Secondary fix:** In `orders.ts`, after `createBostaShipment` succeeds, now call `createShopifyFulfillment` + `addShopifyFulfillmentEvent` immediately. This creates the Shopify fulfillment via our code, reducing the chance the Bosta App creates a competing fulfillment.

**Why:** The Bosta Shopify App fires almost instantly via Shopify webhook. If our Bosta API call fails (or is slow), the App creates its own shipment with 0 COD. Creating the fulfillment ourselves after our shipment prevents the App from creating a duplicate.

## Diagnostic signal

If `createBostaShipment` produces NO log at all (neither success nor failure), check `BOSTA_API_KEY` first — the early return before the try/catch is completely silent.
