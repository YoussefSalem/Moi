---
name: Apple Pay Shopify order population
description: How Apple Pay customer data flows into Shopify orders via Paymob billing_data; key bugs and their fixes.
---

## The Problem
Paymob Pixel SDK Apple Pay orders (CheckoutPage → paymobApplePayInit → PaymobApplePayButton) were creating Shopify orders with null/placeholder customer data ("Apple Pay"/"NA") because:
1. `paymobIntents.customer` is `NOT NULL` in the DB schema — inserting `undefined` causes a constraint error; the route was passing `undefined` for the fast-path (no form filled).
2. Even when the intent was created, `processPaymobSuccess` read the null/placeholder customer and `createShopifyDirectOrder` would throw on `customer.firstName`.
3. The Paymob transaction API (`/api/acceptance/transactions/{id}`) returns `billing_data` with the real Apple Pay shippingContact — we were never extracting it.

## The Fix
**`paymob.ts`**: Added `PaymobBillingData` interface and `mapPaymobBillingToCustomer()` export. Extended `verifyPaymobTransactionById` and `queryPaymobByMerchantOrderId` return types to include `billingData?` and `sourceDataSubType?` (from `source_data.sub_type`, which is `"APPLE_PAY"` for Apple Pay transactions).

**`paymobApplePayInit.ts`**: Store a placeholder customer `{ firstName: "Apple", lastName: "Pay", ... }` when none is provided, so the DB NOT NULL constraint is never violated.

**`paymobSync.ts` / `paymobStatus.ts`**: Before calling `processPaymobSuccess`, if `billingData` is present in the Paymob verify response, update the intent's `customer` field with the real Apple Pay contact data.

**`paymobWebhook.ts`**: Same — extract `billing_data` and `source_data.sub_type` from the webhook `txn` payload; update intent customer if meaningful data present.

**`processPaymobSuccess.ts`**: Added `paymentChannel?: "card" | "apple-pay"` param; null-safe customer (provide defaults for all fields); Apple Pay-specific Shopify tags (`apple-pay,paymob-apple-pay-paid`), labels ("Apple Pay (Paymob)"), and admin email subject ("🍎 Apple Pay"); skip Bosta auto-dispatch when customer fields are placeholder "NA".

**`shopifyOrder.ts`**: Added `"apple-pay"` to `paymentMethod` union in both `createDraftOrder` and `createShopifyDirectOrder`; apple-pay-specific `baseTags`, `noteText`, `note_attributes`; payment transaction recording applies to both `"card"` and `"apple-pay"`.

**`CheckoutPage.tsx`**: `triggerApplePayDirectInit` now builds `formCustomer` from form state (only when firstName+phone are filled) and passes it to `/api/orders/paymob-apple-pay-init`. Added `form` to the useCallback dependency array.

## Key Insight
For the Pixel SDK fast-path (opened from "Buy with Apple Pay" button — no form), customer data is ONLY available from Paymob's transaction `billing_data` after payment succeeds. The flow is: payment completes → `afterPaymentComplete(txnId)` fires → `/api/orders/paymob-sync` with txnId → `verifyPaymobTransactionById` returns `billingData` → update intent customer → `processPaymobSuccess` → Shopify order with real name/email/phone/address.

## Detection
`source_data.sub_type === "APPLE_PAY"` (case-insensitive check) distinguishes Apple Pay from card transactions in both the Paymob API response and webhook payload.
