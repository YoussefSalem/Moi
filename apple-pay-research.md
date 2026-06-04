# Apple Pay Implementation — Complete Error & Logic Flow

## Current Architecture (Moi Storefront)

### What exists
- **Frontend**: React + Vite website at `buy-moi.com` (or dev domain)
- **Backend**: Express API server with Paymob integration
- **Shopify**: Storefront API for cart/products, checkout at `checkout-moi.myshopify.com`
- **Paymob**: Payment processor for Egypt (cards, InstaPay, Apple Pay)

### Apple Pay approaches attempted

#### Approach 1: Native `ApplePaySession` on buy-moi.com (CURRENT CODE)

**Flow:**
1. User clicks Apple Pay button on buy-moi.com
2. Frontend calls `ApplePaySession.begin()` synchronously
3. `onvalidatemerchant` callback → `POST /api/apple-pay/validate-merchant`
4. Backend calls Paymob: `POST https://accept.paymob.com/api/auth/merchant/validate`
   - Body: `{ appleURL, integrationId }`
5. Paymob returns merchant session (with domain info, signature, etc.)
6. Backend returns `{ merchantSession, intentId }` to frontend
7. Frontend calls `session.completeMerchantValidation(merchantSession)`
8. Apple Pay drawer shows (user sees card, shipping, total)
9. User authenticates (Face ID / Touch ID)
10. `onpaymentauthorized` callback → `POST /api/apple-pay/authorize`
11. Backend:
    - Creates Paymob Intention: `POST https://accept.paymob.com/v1/intention/`
      - Body: `{ amount, currency, payment_methods: [integrationId], billing_data, customer, ... }`
    - Charges token: `POST https://accept.paymob.com/v1/payments/pay/?publicKey={pk}`
      - Body: `{ payment_token: clientSecret, source: { identifier: paymentData, subtype: "APPLE_PAY" } }`
12. On success: backend calls `processPaymobSuccess()` → creates Shopify order
13. Backend returns `{ success: true, shopifyOrderNumber }`
14. Frontend shows order confirmation on buy-moi.com

**Error observed:** "Payment Not Completed" (red error in Apple Pay drawer)

**Root cause analysis:**

| Step | What happens | Status |
|------|-------------|--------|
| Merchant validation | Paymob returns session with `domainName: "accept.paymob.com"` | **SUCCESS** |
| Intention creation | Paymob creates intention with `payment_methods: [integrationId]` | **SUCCESS** |
| Payment processing | Paymob attempts to charge Apple Pay token | **FAILURE** |

**Why it fails:**
- The `integrationId` used is the **card integration ID** (for credit/debit card payments)
- Card integration cannot decrypt Apple Pay payment tokens
- Apple Pay requires a **dedicated Apple Pay integration ID** with Apple's certificates
- Paymob's Apple Pay integration has the cryptographic keys to decrypt Apple tokens
- The card integration does not have these keys
- Result: Paymob can't process the token → "Payment Not Completed"

**Credential mapping:**

| Env Var | Purpose | Apple Pay compatible? |
|---------|---------|----------------------|
| `PAYMOB_API_KEY` | Authentication for legacy API | Yes (just auth) |
| `PAYMOB_SECRET_KEY` | Creates intentions (v1 API) | Yes (just auth) |
| `PAYMOB_PUBLIC_KEY` | Tokenizes cards | No (card iframe only) |
| `PAYMOB_INTEGRATION_ID` | **Card payment method** | **NO** — cannot decrypt Apple Pay tokens |
| `PAYMOB_APPLE_PAY_INTEGRATION_ID` | **Apple Pay payment method** | **YES** — has Apple certificates |

**What the user has:**
- `PAYMOB_API_KEY` ✅
- `PAYMOB_SECRET_KEY` ✅
- `PAYMOB_PUBLIC_KEY` ✅
- `PAYMOB_INTEGRATION_ID` ✅
- `PAYMOB_APPLE_PAY_INTEGRATION_ID` ❌ (does not have)

**What the user needs for native Apple Pay:**
- `PAYMOB_APPLE_PAY_INTEGRATION_ID` (numeric ID from Paymob dashboard)
- Domain registration: `buy-moi.com` registered with Apple Pay
- Domain association file served at `/.well-known/apple-developer-merchantid-domain-association`

---

#### Approach 2: Shopify Checkout Popup (PREVIOUSLY WORKING)

**Flow:**
1. User clicks Apple Pay button on buy-moi.com
2. Frontend opens Shopify checkout URL in a small popup window (`window.open`)
3. Shopify checkout page loads in popup
4. Shopify's checkout has Apple Pay configured (via Paymob — Shopify already has Apple Pay integration)
5. Apple Pay drawer appears from the popup
6. User authenticates
7. Shopify processes payment through Paymob's Apple Pay integration
8. Shopify creates the order
9. Popup closes automatically
10. User stays on buy-moi.com

**Why it works:**
- Shopify's checkout domain (`checkout-moi.myshopify.com`) is already registered with Apple Pay
- Shopify already has the correct Paymob Apple Pay integration ID
- Shopify handles the entire merchant validation + payment processing flow
- The user doesn't need any additional credentials

**Why it was abandoned:**
- User wanted a "native" experience without any Shopify page visible
- But the popup approach actually shows the same Apple Pay drawer
- The Shopify checkout page is behind the drawer and never visible

---

#### Approach 3: Shopify Mobile App SDK (NOT APPLICABLE)

**What it is:**
- Shopify's `checkout-sheet-kit-swift` for native iOS apps
- Uses native iOS `PKPaymentAuthorizationViewController` (not web `ApplePaySession`)
- Requires Apple Pay certificates through Shopify's REST Admin API

**Why it doesn't apply:**
- Moi is a **website**, not a native iOS app
- The SDK is for Swift/React Native mobile apps
- Requires iOS 16+ and Xcode
- Not usable from a web browser

---

#### Approach 4: WebView Wrapper (NOT POSSIBLE)

**Why it doesn't work:**
- WebView (even in React Native) does not support `ApplePaySession`
- Apple Pay requires Safari's native Secure Element
- Apple explicitly blocks `ApplePaySession` in WebView, Chrome, Firefox, etc.
- Only Safari on iOS/macOS supports `ApplePaySession`

---

#### Approach 5: Shopify Domain Registration (WON'T FIX THE ISSUE)

**What the user suggested:**
- Add `buy-moi.com` to Shopify's domain settings
- Use Shopify's Apple Pay infrastructure for the custom storefront

**Why it doesn't work:**
- Shopify domain settings only control where Shopify's checkout page appears
- Adding a domain to Shopify redirects checkout to that domain, but it's still Shopify's checkout
- The custom storefront (React + Vite) is independent code
- The storefront's Apple Pay button calls the storefront's backend, not Shopify's checkout
- Shopify's domain registration does not affect how `ApplePaySession` on buy-moi.com works
- The storefront backend still needs its own Paymob Apple Pay integration

---

## Shopify's Checkout vs. Custom Storefront

### What Shopify's checkout has:
1. ✅ Domain registered with Apple Pay (`checkout-moi.myshopify.com`)
2. ✅ Paymob Apple Pay integration configured
3. ✅ Apple Pay certificates (managed by Shopify)
4. ✅ Merchant validation handled by Shopify
5. ✅ Payment processing handled by Shopify
6. ✅ Order creation handled by Shopify

### What the custom storefront has:
1. ❌ Domain not registered with Apple Pay (`buy-moi.com`)
2. ❌ No Paymob Apple Pay integration ID
3. ❌ No Apple Pay certificates
4. ✅ Merchant validation working (returns session)
5. ❌ Payment processing failing (wrong integration ID)
6. ✅ Order creation working (via `processPaymobSuccess`)

---

## The Actual User Experience

### Shopify checkout popup (works):
```
User on buy-moi.com
    ↓
Clicks Apple Pay button
    ↓
Popup opens (tiny window, hidden behind drawer)
    ↓
Apple Pay drawer appears (user sees: card, shipping, total)
    ↓
User authenticates (Face ID / Touch ID)
    ↓
Payment processed (Shopify + Paymob)
    ↓
Popup closes
    ↓
User stays on buy-moi.com
```

### Native `ApplePaySession` (current code, fails):
```
User on buy-moi.com
    ↓
Clicks Apple Pay button
    ↓
Apple Pay drawer appears (user sees: card, shipping, total)
    ↓
User authenticates (Face ID / Touch ID)
    ↓
Payment processing... ❌
    ↓
"Payment Not Completed" (red error)
    ↓
User falls back to COD or other payment
```

---

## What Works Today

| Feature | Status | Notes |
|---------|--------|-------|
| Card payments (Paymob iframe) | ✅ Working | Regular card integration |
| COD (Cash on Delivery) | ✅ Working | Bosta integration |
| InstaPay | ✅ Working | Paymob InstaPay integration |
| Apple Pay (native storefront) | ❌ Failing | Missing `PAYMOB_APPLE_PAY_INTEGRATION_ID` |
| Apple Pay (Shopify popup) | ✅ Working | Shopify handles everything |

---

## The Real Question

**Is the popup approach acceptable?**

The popup opens a tiny Shopify checkout window. The Apple Pay drawer appears from this window. The user never sees the Shopify checkout page — only the Apple Pay sheet. After payment, the popup closes and the user stays on buy-moi.com.

The popup approach is the **same user experience** as the native approach from the user's perspective. The only difference is technical implementation.

---

## Options for Fixing Apple Pay

### Option A: Revert to Shopify popup (fastest, works today)
- Revert `ShopifyApplePayButton.tsx` to popup approach
- Revert `CheckoutPage.tsx` to use popup instead of `ApplePaySession`
- Backend doesn't need changes (Shopify handles everything)
- **Time: 1 hour**
- **Status: Works today**

### Option B: Get `PAYMOB_APPLE_PAY_INTEGRATION_ID` from Paymob
- Contact Paymob support to create Apple Pay integration
- Register `buy-moi.com` with Apple Pay (domain association file)
- Set `PAYMOB_APPLE_PAY_INTEGRATION_ID` in environment
- Current code works as-is
- **Time: Unknown (depends on Paymob + Apple)**
- **Status: Would work, but requires external setup**

### Option C: Register buy-moi.com with Apple Pay independently
- Create Apple Developer account
- Register `buy-moi.com` as merchant domain with Apple
- Generate CSR, upload to Apple, download certificate
- Create Paymob Apple Pay integration with the certificate
- **Time: 2-3 days**
- **Status: Complex, requires Apple Developer account ($99/year)**

---

## File References

| File | Role |
|------|------|
| `artifacts/moi/src/components/ShopifyApplePayButton.tsx` | Apple Pay button (product page + cart) |
| `artifacts/moi/src/components/CheckoutPage.tsx` | Checkout page with Apple Pay tile |
| `artifacts/moi/src/lib/shopifyCheckout.ts` | Popup helpers (open/close Shopify checkout) |
| `artifacts/api-server/src/routes/applePayDirect.ts` | Backend: validate-merchant + authorize |
| `artifacts/api-server/src/lib/paymobConfig.ts` | Paymob credential configuration |
| `artifacts/api-server/src/lib/processPaymobSuccess.ts` | Creates Shopify order after Paymob success |
| `artifacts/api-server/src/app.ts` | Domain association file serving |
| `artifacts/moi/src/context/CartContext.tsx` | Cart state + checkout URL |
| `artifacts/moi/src/lib/shopify.ts` | Shopify Storefront API client |
