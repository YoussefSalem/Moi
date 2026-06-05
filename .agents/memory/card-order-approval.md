---
name: Card order approval flow
description: Paymob card orders go through draft → admin-approved → dispatched; three new DB columns track this.
---

## Rule
Card orders follow a two-step admin workflow: **Approve** (draft → real Shopify order) then **Dispatch** (Bosta shipment). Dispatch now requires approval first.

**New columns on `paymob_intents`:**
- `shopify_confirmed_order_id` (bigint) — real Shopify order ID set after admin approval; `shopify_order_id` continues to hold the draft ID set by `processPaymobSuccess`
- `admin_approved` (boolean, default false) — set to true by `POST /admin/card-orders/:id/approve`
- `admin_approved_at` (timestamp) — approval timestamp

**Why:** `processPaymobSuccess` creates a *draft* order (not a real confirmed order). The admin reviews the Paymob transaction ID, verifies the payment, then calls Approve to run `completeShopifyDraftOrder`, which converts the draft to a real Shopify order. This human gate also guards the Paymob-API-fallback path where the txnId came from the client rather than a verified Paymob API response.

**How to apply:**
- When Dispatch is used, fetch the real order via `shopifyConfirmedOrderId ?? shopifyOrderId`
- Admin dashboard `CardOrdersTab` uses filter states: `pending-approval`, `pending-dispatch`, `dispatched`, `all`
- `paymob-sync` now accepts `paymobTxnId` from the frontend; tries `verifyPaymobTransactionById` first, then `queryPaymobByMerchantOrderId`, then falls back to trusting the client-provided txnId (admin review is the safety net)
