---
name: Paymob HMAC field ordering
description: The exact field list/format for verifying Paymob webhook HMAC, and the order.id gotcha that silently breaks it.
---

# Paymob webhook HMAC verification

`verifyPaymobHmac` (api-server `lib/paymob.ts`) verifies the **server-to-server
Transaction Processed (POST) callback** only. That is the one route that calls it
(`routes/paymobWebhook.ts`). The browser GET return (`paymobReturn.ts`) does NOT
HMAC-verify — it just reads query params.

## The 20 HMAC fields, in this exact order (SHA512, concatenated values)
amount_cents, created_at, currency, error_occured, has_parent_transaction,
**obj.id** (transaction id), integration_id, is_3d_secure, is_auth, is_capture,
is_refunded, is_standalone_payment, is_voided, **order.id**, owner, pending,
source_data.pan, source_data.sub_type, source_data.type, success.

Per Paymob docs, the Processed (POST) payload nests transaction data under `obj`,
so id is `obj.id` and order is `obj.order.id`. The code unwraps `obj` into `txn`
first, so it reads `id` and `order.id` from the unwrapped object.

## The gotcha (cost a production-down webhook)
The field at position 14 must be **`order.id`**, NOT `order`. `txn.order` is an
**object**; the verifier's guard stringifies objects to `""`, silently dropping
the order id from the signature string. Result: every real webhook HMAC mismatches
→ 401 → webhook (Paymob's documented source of truth) is rejected, forcing total
reliance on the polling fallback.

**Why:** booleans (`String(true)`→"true") and numbers stringify fine; objects do
not — any HMAC field that points at a nested object must use its dotted leaf path.

**How to apply:** if Paymob HMAC ever "always fails," check that every field
resolves to a scalar, especially `order.id` and `source_data.*`. Do not use bare
`order`.
