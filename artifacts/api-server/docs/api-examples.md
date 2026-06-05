# API Request / Response Examples

---

## POST /api/checkout

Initiates a Paymob card payment for a custom Shopify headless checkout.

### Request

```http
POST /api/checkout
Content-Type: application/json
```

```json
{
  "items": [
    {
      "variantId": "gid://shopify/ProductVariant/48701234567890",
      "quantity": 1
    },
    {
      "variantId": "gid://shopify/ProductVariant/48701234567891",
      "quantity": 2
    }
  ],
  "customer": {
    "firstName": "Salma",
    "lastName": "Hassan",
    "email": "salma@example.com",
    "phone": "01012345678"
  },
  "shippingAddress": {
    "address": "15 Mohamed Naguib St, Heliopolis",
    "city": "Cairo",
    "governorate": "Cairo",
    "postalCode": "11361"
  },
  "billingAddress": {
    "address": "15 Mohamed Naguib St, Heliopolis",
    "city": "Cairo",
    "governorate": "Cairo",
    "postalCode": "11361"
  },
  "discountCode": "SUMMER20",
  "cartId": "gid://shopify/Cart/c1-abc123def456",
  "attribution": {
    "sourceName": "instagram",
    "referringSite": "https://www.instagram.com/",
    "utm": {
      "utm_source": "instagram",
      "utm_medium": "social",
      "utm_campaign": "summer2025"
    }
  }
}
```

### Response — 200 OK (payment initiated, 3DS redirect required)

```json
{
  "success": true,
  "status": "requires_redirect",
  "checkoutToken": "a3f7b2c1-4d8e-4f9a-b0c2-1d3e5f7a9b0c",
  "redirectUrl": "https://accept.paymob.com/api/acceptance/iframes/12345?payment_token=eyJhbGci...",
  "transactionReference": "a3f7b2c1-4d8e-4f9a-b0c2-1d3e5f7a9b0c",
  "total": "3380.00",
  "amountCents": 338000,
  "draftOrderId": 987654321
}
```

The customer must be redirected to `redirectUrl` to complete 3DS authentication.
After payment, Paymob redirects back to `APP_BASE_URL/payment/return?checkoutToken=...`

### Response — 400 Bad Request

```json
{
  "error": "items is required and must be a non-empty array."
}
```

```json
{
  "error": "customer is required with firstName, lastName, and phone."
}
```

### Response — 422 Unprocessable Entity (out of stock)

```json
{
  "error": "One or more items are out of stock.",
  "unavailableVariantIds": ["gid://shopify/ProductVariant/48701234567890"]
}
```

### Response — 502 Bad Gateway (Paymob unavailable)

```json
{
  "error": "Payment provider unavailable. Please try again."
}
```

---

## POST /api/webhooks/paymob

Receives Paymob transaction result webhooks. HMAC-verified, responds immediately.

### Request (sent by Paymob)

```http
POST /api/webhooks/paymob?hmac=<SHA512_HMAC>
Content-Type: application/json
```

```json
{
  "type": "TRANSACTION",
  "obj": {
    "id": 987654321,
    "pending": false,
    "amount_cents": 338000,
    "success": true,
    "is_auth": false,
    "is_capture": false,
    "is_standalone_payment": true,
    "is_voided": false,
    "is_refunded": false,
    "is_3d_secure": true,
    "integration_id": 123456,
    "has_parent_transaction": false,
    "order": {
      "id": 111222333,
      "merchant_order_id": "a3f7b2c1-4d8e-4f9a-b0c2-1d3e5f7a9b0c",
      "currency": "EGP"
    },
    "created_at": "2025-06-05T14:30:00.000000",
    "currency": "EGP",
    "error_occured": false,
    "owner": 100200300,
    "source_data": {
      "pan": "2346",
      "sub_type": "MasterCard",
      "type": "card"
    }
  }
}
```

### Response — 200 OK (always, if HMAC valid)

```json
{ "ok": true }
```

The webhook is processed **asynchronously** after this response.

### Response — 401 Unauthorized (invalid or missing HMAC)

```json
{ "error": "Invalid HMAC signature" }
```

```json
{ "error": "Missing HMAC" }
```

---

## Shopify Order Creation (internal — triggered by webhook)

### Payment Success → Confirmed Order

When `success === true`, the Shopify draft order is completed as `financial_status: "paid"`.

Resulting Shopify order:
- `financial_status`: `"paid"`
- `tags`: `"card, moi-checkout, paymob, paid"`
- `note`: includes Paymob transaction ID, order ID, payment status
- Customer email, shipping address, and line items are preserved

### Payment Failure → Draft Order

When `success === false`, the existing draft order is tagged `"payment_failed"` and preserved
with all cart contents and customer details for recovery.

---

## POST /api/paymob/verify-payment

Frontend-initiated verification after Paymob redirects the customer back.

### Request

```json
{ "checkoutToken": "a3f7b2c1-4d8e-4f9a-b0c2-1d3e5f7a9b0c" }
```

### Response — 200 OK (payment confirmed)

```json
{
  "success": true,
  "orderNumber": 1042,
  "total": "3380.00",
  "shopifyOrderId": 5678901234
}
```

### Response — 402 Payment Required (not completed)

```json
{
  "success": false,
  "error": "Payment was not completed. Please try again or use a different card."
}
```

### Response — 422 Unprocessable Entity (amount mismatch)

```json
{
  "error": "Payment amount mismatch. Please contact support."
}
```

---

## Security Notes

| Layer | Mechanism |
|---|---|
| HMAC | `HMAC-SHA512` over Paymob transaction fields, `timingSafeEqual` comparison |
| Rate limiting | 100 req/15min (global), 20 req/15min (checkout), 500 req/min (webhooks) |
| Helmet | Secure HTTP headers on all responses |
| CORS | Configurable via `CORS_ORIGINS` env var |
| Env validation | Server refuses to start if required keys are missing |
| Idempotency | `shopifyConfirmedOrderId` guard prevents duplicate Shopify orders |
| Amount check | `verify-payment` rejects if Paymob amount ≠ stored intent amount |
