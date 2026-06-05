# Moi Shopify Theme — Build Summary

> Conversion of the Moi React + Express + PostgreSQL e-commerce app to a standalone Shopify Liquid theme.

---

## What Was Built

### Shopify Theme (`shopify-theme/`)

| File | Description |
|---|---|
| `layout/theme.liquid` | Root layout: fonts, motion.dev CDN, WhatsApp button, section slots |
| `templates/index.json` | Home page — hero → Wavvy section → editorial strip → Versa Top section |
| `templates/product.json` | Product detail page |
| `templates/collection.json` | Collection / accessories listing page |
| `templates/cart.json` | Cart page (full page, not just drawer) |
| `templates/page.json` | Generic page (policies, etc.) |
| `templates/page.ambassador.json` | Ambassador page — uses the ambassador form section |
| `sections/header.liquid` | Sticky header with scroll transparency, hamburger drawer, search overlay, AJAX cart drawer |
| `sections/footer.liquid` | Dark footer with accordion info, newsletter form (Shopify native), social links, policy links |
| `sections/hero.liquid` | Full-screen hero — supports video URL or image, parallax, entrance animations, trust bar |
| `sections/product-color-section.liquid` | Colour-variant product grid section — links to a Shopify collection or individual products |
| `sections/editorial-strip.liquid` | Dark editorial text strip between product sections |
| `sections/ambassador-form.liquid` | Ambassador application form — POSTs to Vercel function |
| `sections/main-product.liquid` | Product page — gallery with thumbnails, variant selector (colour swatches + size pills), AJAX add-to-bag |
| `sections/main-collection.liquid` | Collection page — renders all products via `product-card` snippet, pagination |
| `sections/main-cart.liquid` | Cart page — item list, qty controls, subtotal, checkout button |
| `sections/main-page.liquid` | Generic page — renders Shopify page content as rich text |
| `snippets/product-card.liquid` | Reusable product card — image, colour swatches, price, Add to Bag button |
| `assets/theme.css` | Full CSS (1300+ lines) — all Tailwind + inline styles converted to plain CSS |
| `assets/theme.js` | Vanilla JS — IntersectionObserver animations, AJAX cart, hero/editorial parallax |
| `config/settings_schema.json` | Theme editor settings — colours, typography, social links |
| `locales/en.default.json` | English locale strings |

### Resend Serverless Function (`resend-function/`)

| File | Description |
|---|---|
| `index.js` | Vercel Node.js handler — receives ambassador form POST, sends branded email via Resend API |
| `vercel.json` | Vercel routing config — maps `/api/ambassador` to `index.js` |
| `package.json` | Dependencies: `resend` |
| `.env.example` | Environment variable template: `RESEND_API_KEY`, `NOTIFY_EMAIL` |

### Data Migration (`scripts/src/`, `exports/`)

| File | Description |
|---|---|
| `scripts/src/export-products.js` | Exports all products to `exports/products.csv` in Shopify import format |

### Documentation

| File | Description |
|---|---|
| `shopify-theme/AUDIT.md` | Phase 1 audit — pages, API endpoints, data models, animations |
| `CHECKLIST.md` | Step-by-step deployment checklist |
| `DONE.md` | This file |

---

## What Was Faithfully Preserved

- **Visual design** — warm off-white palette (`#faf8f5`), near-black (`#1e1814`), Cormorant Garamond headings + Montserrat UI text, sharp rectangular buttons, zero border radius
- **Layout hierarchy** — hero → trust bar → product colour sections → editorial strip → footer
- **Animations** — all Framer Motion animations reconstructed in CSS keyframes + Intersection Observer + `requestAnimationFrame` parallax
- **Typography** — all letter-spacing, font sizes, weights, and text-transform values preserved exactly
- **Header** — transparent over hero, solid white on scroll, hamburger drawer, search overlay, AJAX cart count
- **Footer** — dark background, accordion info panels, newsletter form, social links, policy links
- **Ambassador form** — all fields preserved (name, phone, email, Facebook, Instagram, message), success/error feedback

---

## What Needs Manual Action After Theme Push

### Required (will break without)
1. **Upload hero image** — Theme Editor → Hero section → Hero image
2. **Import products** — run `node scripts/src/export-products.js` → upload `exports/products.csv` to Shopify Admin
3. **Add variant images** — assign colour-specific images to each product variant in Shopify Admin
4. **Create collections** — `clothing` and `accessories` — link to product-color-section blocks
5. **Deploy Resend function** — `cd resend-function && vercel deploy --prod`, set `RESEND_API_KEY` + `NOTIFY_EMAIL`
6. **Update ambassador form endpoint** — paste Vercel URL into Theme Editor → Ambassador page → section settings
7. **Set currency to EGP** — Shopify Admin → Settings → Store currency
8. **Configure Paymob payment gateway** — via Paymob's official Shopify app

### Recommended
9. **Create policy pages** — privacy, refund, return, delivery — as Shopify Pages with the right content
10. **Set up shipping zones** — Egypt Cairo/Giza (3–4 days), Governorates (5–6 days)
11. **Enable customer accounts** — Shopify Admin → Settings → Customer accounts
12. **Set social URLs** — Theme Settings → Social → Instagram, TikTok, WhatsApp

---

## What Is Not Ported (By Design)

| Component | Reason |
|---|---|
| Custom Express checkout (`CheckoutPage.tsx`) | Replaced by Shopify native checkout — handles payment, shipping, confirmation |
| Paymob custom iframe integration | Replaced by Paymob Shopify app |
| Apple Pay iframe page | Replaced by Shopify Payments / Paymob app |
| Admin dashboard (`AdminPage.tsx`) | Use Shopify Admin instead |
| Customer auth modal + OTP flow | Replaced by Shopify Accounts |
| PostgreSQL database (orders, intents, proofs) | Shopify stores orders natively |
| Abandoned cart recovery API | Shopify has built-in abandoned-checkout emails |
| Restock notifications API | Use a Shopify back-in-stock app |

---

## How to Push the Theme to Shopify

```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Authenticate with your store
shopify auth login --store your-store.myshopify.com

# Push the theme (creates a new unpublished theme)
shopify theme push --path shopify-theme/ --store your-store.myshopify.com

# Preview it, then publish in Shopify Admin when ready
# Online Store → Themes → [Moi theme] → Publish
```

---

*Phase 1 complete — 9 sections audited.*  
*Phase 2 complete — 7 Shopify template files created.*  
*Phase 3 complete — 8 Liquid pages/templates converted.*  
*Phase 4 complete — 1300+ line theme.css, all animations CSS-native.*  
*Phase 5 complete — Ambassador form + Resend serverless function.*  
*Phase 6 complete — Product CSV export script.*  
*Phase 7 complete — CHECKLIST.md + DONE.md generated.*
