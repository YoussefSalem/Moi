# Moi Shopify Theme — Deployment Checklist

Work through every item before going live. Tick each box as you complete it.

---

## Phase 1 — Theme Build

- [ ] All pages converted to Liquid templates
  - [x] Home page (`templates/index.json`)
  - [x] Product page (`templates/product.json`)
  - [x] Collection page (`templates/collection.json`)
  - [x] Cart page (`templates/cart.json`)
  - [x] Standard page (`templates/page.json`)
  - [x] Ambassador page (`templates/page.ambassador.json`)
- [x] All nav links use Shopify Liquid routes (`{{ routes.root_url }}`, `{{ routes.collections_url }}`, etc.)
- [x] Cart uses Shopify AJAX Cart API (`/cart/add.js`, `/cart/change.js`, `/cart.js`)
- [x] All images reference Shopify CDN `img_url` filter or external URLs
- [x] WhatsApp floating button present in `layout/theme.liquid`
- [x] Scroll-triggered animations use `IntersectionObserver` (no Framer Motion dependency)
- [x] Hero parallax uses `requestAnimationFrame` (no Framer Motion)
- [x] CSS animations replace all Framer Motion keyframe animations
- [x] Nav drawer slide-in implemented in pure CSS + JS
- [x] Cart drawer slide-in implemented in pure CSS + JS
- [x] Footer accordion implemented in pure JS

---

## Phase 2 — Ambassador Form + Resend API

- [ ] Deploy `resend-function/` to Vercel
  - [ ] Run `cd resend-function && npm install` then deploy: `vercel deploy --prod`
  - [ ] Copy the production URL (e.g. `https://moi-ambassador.vercel.app/api/ambassador`)
- [ ] Set Vercel environment variables:
  - [ ] `RESEND_API_KEY` — get from [resend.com/api-keys](https://resend.com/api-keys)
  - [ ] `NOTIFY_EMAIL` — email that receives ambassador applications (e.g. `hello@buy-moi.com`)
- [ ] Update `sections/ambassador-form.liquid` `form_endpoint` setting in Shopify Theme Editor
  - [ ] Go to **Shopify Admin → Online Store → Themes → Customize**
  - [ ] Navigate to the Ambassador page → Ambassador Form section
  - [ ] Paste the Vercel function URL into "Form endpoint URL"
- [ ] Test the ambassador form end-to-end:
  - [ ] Submit a test application
  - [ ] Confirm email arrives at `NOTIFY_EMAIL`

---

## Phase 3 — Data Migration

- [ ] Run the product export script:
  ```bash
  node scripts/src/export-products.js
  ```
- [ ] Verify `exports/products.csv` was created and looks correct
- [ ] Import CSV into Shopify: **Admin → Products → Import**
- [ ] After import, add product images for each variant:
  - [ ] MOI Wavvy — Light Blue, Navy, Mint images uploaded and assigned
  - [ ] MOI Versa Top — White, Cashmere, Beige, Yellow, Teal images uploaded and assigned
  - [ ] Trio Bangles — product images uploaded
- [ ] Review all product prices match the original config
- [ ] Set stock levels for each variant
- [ ] Create the following collections in Shopify Admin:
  - [ ] `clothing` — contains Wavvy + Versa Top
  - [ ] `accessories` — contains Trio Bangles
- [ ] Link collections to `product-color-section` blocks in the theme editor

---

## Phase 4 — Theme Configuration

- [ ] Upload hero image via **Theme Editor → Hero section → Hero image**
- [ ] (Optional) Add hero video URL if you have a hosted .mp4 link
- [ ] Confirm trust bar items read correctly (☀️ New summer drop / ⚡ Fast delivery / 🔥 Limited stock)
- [ ] Check footer accordion content (Care instructions, Return policy, Shipping, Contact us)
- [ ] Set social media URLs in **Theme Settings → Social**:
  - [ ] Instagram URL: `https://www.instagram.com/shopmoi/`
  - [ ] TikTok URL: `https://www.tiktok.com/@shopmoi_`
  - [ ] WhatsApp number: `201200520083`
- [ ] Confirm newsletter form submits correctly and tags customers with `newsletter`
- [ ] Verify cart drawer opens and items display correctly

---

## Phase 5 — Policies

- [ ] Create the following Shopify Pages with correct content:
  - [ ] `privacy-policy` — Privacy Policy
  - [ ] `refund-policy` — Refund Policy
  - [ ] `return-policy` — Return Policy
  - [ ] `delivery-policy` — Delivery Policy
  - [ ] `ambassador` — Ambassador page (uses `page.ambassador.json` template)

---

## Phase 6 — Shopify Settings

- [ ] Set currency to EGP in **Settings → Store details → Store currency**
- [ ] Configure Paymob as payment provider (via Paymob Shopify app)
- [ ] Enable Shopify Payments or alternative if Paymob app unavailable in your region
- [ ] Set up shipping zones for Egypt (Cairo/Giza 3–4 days, Governorates 5–6 days)
- [ ] Enable customer accounts: **Settings → Customer accounts**
- [ ] Configure email notifications for orders, shipping, returns

---

## Phase 7 — Pre-Launch Testing

- [ ] View theme in Shopify Theme Preview on desktop and mobile
- [ ] Test product page: variant selection, gallery, Add to Bag, AJAX cart
- [ ] Test cart page: quantity update, remove item, proceed to checkout
- [ ] Test collection page: products display, pagination
- [ ] Test ambassador form submission (real submit, not preview)
- [ ] Test header scroll behaviour: transparent → solid white
- [ ] Test nav drawer open/close on mobile
- [ ] Test search overlay: open, type, submit to Shopify search
- [ ] Test WhatsApp button opens correct chat link

---

## Phase 8 — Go Live

- [ ] Push theme to Shopify store:
  ```bash
  # Install Shopify CLI if not already installed
  npm install -g @shopify/cli @shopify/theme

  # Authenticate
  shopify auth login --store your-store.myshopify.com

  # Push theme
  shopify theme push --path shopify-theme/ --store your-store.myshopify.com
  ```
- [ ] Preview theme in Shopify Admin and confirm it renders correctly
- [ ] Publish theme: **Online Store → Themes → [Theme] → Publish**
- [ ] Set custom domain (if applicable): **Settings → Domains**
- [ ] Enable SSL: **Settings → Domains → Enable SSL**
- [ ] Submit sitemap to Google Search Console: `https://your-store.myshopify.com/sitemap.xml`

---

## Notes

- The custom Express backend (`artifacts/api-server/`) is **not** required for the Shopify theme — Shopify's native cart, checkout, and accounts replace it.
- The Paymob integration must be set up separately via the Paymob Shopify app — contact Paymob Egypt for access.
- The `admin` section of the React app is **not** ported — use Shopify Admin instead.
