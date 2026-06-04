# MOI → Shopify Theme Conversion Audit

> **Phase 1 audit of `artifacts/moi/src/` — completed June 2026**

---

## 1. Pages & Routes Found in the React App

The React app uses a custom `parsePath()` router (no React Router library — pure `window.history.pushState`).

| Path pattern | Page / Component | Shopify Template |
|---|---|---|
| `/` | `AppContent` — Home | `templates/index.json` |
| `/products/:handle` | `ProductPage` — dynamic handle includes colour slug | `templates/product.json` |
| `/accessories` | `AccessoriesPage` — dark-bg collection | `templates/collection.json` |
| `/ambassador` | `AmbassadorPage` — brand ambassador form | `templates/page.ambassador.json` |
| `/checkout` | `CheckoutPage` — custom Paymob overlay | ❌ Replaced by Shopify native checkout |
| `/admin` | `AdminPage` — internal dashboard | ❌ Not converted — use Shopify Admin |
| `/buy/apple-pay` | `ApplePayIframePage` — disabled by feature flag | ❌ Replaced by Shopify Payments |
| `/privacy` | `PolicyPage` | `templates/page.json` (Shopify Page) |
| `/refund` | `PolicyPage` | `templates/page.json` |
| `/return` | `PolicyPage` | `templates/page.json` |
| `/delivery` | `PolicyPage` | `templates/page.json` |

---

## 2. API Endpoints Called from the Frontend

| Endpoint | Method | Purpose | Shopify Replacement |
|---|---|---|---|
| `https://{store}.myshopify.com/api/graphql` | POST | Storefront API — products, cart, checkout | ✅ Already Shopify native |
| `/api/abandoned-carts/recover` | GET | Cart recovery from URL token | Shopify abandoned-checkout emails |
| `/api/newsletter` | POST | Subscribe to mailing list | Shopify Customer form + `contact[tags]=newsletter` |
| `/api/restock/subscribe` | POST | Out-of-stock notify-me | Shopify Back-in-Stock app |
| `/api/orders/discount-lookup` | GET | Validate discount codes | Shopify Discount Codes API |
| `/api/analytics/track` | POST | Server-side analytics proxy | Shopify Web Pixel / GA4 |
| `/api/paymob/*` | POST | Paymob payment gateway init & status | Paymob Shopify app |
| `/api/ambassador` | POST | Ambassador form submission | Vercel function (`resend-function/`) |
| `/api/admin/*` | Various | Internal order management | Shopify Admin API |

---

## 3. Data Models

### `ShopifyProduct` (from Storefront GraphQL)
- `id` (GID), `handle`, `title`, `description`
- `priceRange.minVariantPrice`
- `images[]` → `url`, `altText`
- `variants[]` → `id`, `price`, `compareAtPrice`, `availableForSale`, `selectedOptions[]`
- `options[]` → `name`, `values[]`

### `ProductConfig` (local static config in `src/config/images.ts`)
- `slug` — URL handle prefix  
- `name`, `price`, `variantId` — fallback values when Shopify offline  
- `productShot` — primary image URL  
- `colorImages: Record<colorName, imageUrl>` — per-colour hero image  
- `colorGalleries: Record<colorName, imageUrl[]>` — per-colour gallery  
- `colorSwatches: Record<colorName, cssColor>` — swatch circle colour  

### `ShopifyCart`
- `id`, `checkoutUrl`, `totalQuantity`
- `lines[]` → `id`, `quantity`, `merchandise`
- `cost.totalAmount`

### `Customer`
- `id`, `email`, `firstName`, `lastName`, `phone`

### `SearchItem`
- `id`, `name`, `subtitle`, `handle`, `image`, `price`, `product`

---

## 4. Framer Motion Animations — Converted

| Original (Framer Motion) | Theme Replacement |
|---|---|
| Page `AnimatePresence` opacity fade | CSS `opacity` fade on body load |
| Hero text `y: 20→0, opacity: 0→1` entrance | `setTimeout` + CSS transitions in `sections/hero.liquid` |
| Hero parallax (`useScroll`, `useTransform`) | `requestAnimationFrame` scroll handler in `theme.js` |
| `whileInView` scroll entrance on product sections | `IntersectionObserver` + `.animate-in` class in `theme.js` |
| Nav drawer slide-in (`x: -100%→0`) | CSS `transform: translateX(-100%)` + `.open` toggle |
| Cart drawer slide-in (`x: 100%→0`) | CSS `transform: translateX(100%)` + `.open` toggle |
| Footer accordion `height: 0→auto` | JS `hidden` toggle |
| Color card hover scale | CSS `transform: scale(1.04)` |
| Scroll cue pulse | CSS `@keyframes scrollCuePulse` |
| Editorial strip parallax | `requestAnimationFrame` in `theme.js` |

---

## 5. Design Tokens Captured

| Token | Value |
|---|---|
| Background | `#faf8f5` |
| Foreground | `#1e1814` |
| Muted text | `rgba(30,24,20,0.55)` |
| Accent | `#b0a090` |
| Dark section bg | `#f0ece6` |
| Footer bg | `#28211d` |
| Heading font | Cormorant Garamond (300–600) |
| UI font | Montserrat (300–700) |
| Border radius | `0` (sharp rectangles) |

---

## 6. Data Migration — How to Import Products into Shopify

Products are defined as a static config in `src/config/images.ts` (not in PostgreSQL).

**Steps:**

1. Run the export script from the project root:
   ```bash
   node scripts/src/export-products.js
   ```
   Output: `exports/products.csv`

2. In Shopify Admin → **Products → Import** → upload `exports/products.csv`

3. After import, manually upload colour-variant images per product:  
   **Products → [Product] → Media** — assign images to each variant

4. Ensure colour swatch CSS variables in `shopify-theme/assets/theme.css` cover all colour names.

---

## 7. Files That Could Not Be Fully Audited

| File | Status |
|---|---|
| `src/components/CheckoutPage.tsx` | Not converted — replaced by Shopify native checkout |
| `src/pages/AdminPage.tsx` | Not converted — internal tool; use Shopify Admin |
| `src/pages/ApplePayIframePage.tsx` | Not converted — disabled by feature flag; Shopify Payments covers this |
| `src/context/CartContext.tsx` | Not converted — replaced by Shopify AJAX Cart API |
| `src/context/CustomerContext.tsx` | Not converted — replaced by Shopify Accounts |
