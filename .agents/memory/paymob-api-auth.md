---
name: Paymob API auth 401 fix
description: Paymob orders/transactions endpoints return 401 when auth_token is passed as a query param — must try multiple auth strategies.
---

## Rule
`queryPaymobByMerchantOrderId` and `verifyPaymobTransactionById` must try three auth strategies in order:
1. `Authorization: Bearer {authToken}` header (newer Paymob API style)
2. `?auth_token={authToken}` query param (legacy, may be rejected)
3. `Authorization: Bearer {secretKey}` header (Paymob Intentions/v2 API style)

**Why:** Paymob returns `{"detail":"Authentication credentials were not provided."}` (HTTP 401) when `auth_token` is in the query string on certain endpoints. The error message says "not provided" (not "invalid"), confirming the server ignores the query param entirely. The fix is to send the token in the `Authorization: Bearer` header instead.

**How to apply:** Any new Paymob API call that needs auth should follow the same attempt-loop pattern already in `paymob.ts`. Never assume query-param auth works.
