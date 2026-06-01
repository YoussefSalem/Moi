---
name: Paymob webhook unreliable in dev
description: Paymob's server-to-server webhook never arrives during development; paymob-status uses direct Paymob API as a fallback.
---

During development (Replit dev domains), Paymob's server-to-server webhook (`POST /api/webhooks/paymob`) is never received. The intent status stays "pending" indefinitely because polling detects no change.

**Why:** Paymob likely cannot reach ephemeral `*.replit.dev` subdomains from their servers, or the webhook URL registration isn't reliable.

**Fix applied:** `paymobStatus.ts` now queries Paymob directly as a fallback:
- If intent has been "pending" for > 8 seconds, call Paymob's orders API using `merchantOrderId` to find the latest resolved transaction.
- Rate-limited: at most one direct lookup per 5 seconds per intent (using in-process `_lastDirectLookup` map).
- Auth token is cached in-process for 50 minutes to avoid re-authenticating on each lookup.

**How to apply:** Any future changes to the payment flow should account for webhook unreliability. The canonical fix pattern: store enough info at init time to do a direct Paymob API lookup as a fallback. The `merchant_order_id` (our `intentId`) is the key — Paymob's `GET /api/ecommerce/orders?merchant_order_id=` endpoint returns orders with their transactions.
