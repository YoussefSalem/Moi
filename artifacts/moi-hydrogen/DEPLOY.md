# Moi Hydrogen — Shopify Oxygen Deployment Guide

## Overview

This app is a Shopify Hydrogen (Remix + TypeScript) storefront for the **Moi** fashion brand.
It deploys to **Shopify Oxygen** and is served at **buy-moi.com**.

The Express backend (PostgreSQL, Resend, Bosta, Paymob webhooks) lives permanently at
**admin.buy-moi.com** on Replit — this app calls it via `PUBLIC_API_ORIGIN`.

---

## Prerequisites

1. **Shopify Partner account** with a Hydrogen storefront configured in your store.
2. **Shopify CLI** (`npm i -g @shopify/cli`) — Hydrogen commands use `shopify hydrogen …`.
3. **Node.js ≥ 18**.
4. **.env** — copy `.env.example` to `.env` and fill in all values (see below).

---

## Environment Variables

Create `.env` from `.env.example`:

```
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `PUBLIC_STORE_DOMAIN` | Shopify Admin → Settings → Domains (e.g. `checkout-moi.myshopify.com`) |
| `PUBLIC_STOREFRONT_API_TOKEN` | Admin → Apps → Hydrogen storefront → Storefront API token |
| `PRIVATE_STOREFRONT_API_TOKEN` | Same location — **never expose this in the browser** |
| `PUBLIC_STOREFRONT_ID` | Same location — format `gid://shopify/Shop/XXXXXXXX` |
| `SESSION_SECRET` | Generate: `openssl rand -base64 32` |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID` | Admin → Apps → Customer accounts → API credentials |
| `PUBLIC_CUSTOMER_ACCOUNT_API_URL` | Same location |
| `PUBLIC_API_ORIGIN` | `https://admin.buy-moi.com` (the Replit backend) |
| `PUBLIC_META_PIXEL_ID` | Meta Events Manager |
| `PUBLIC_TIKTOK_PIXEL_ID` | TikTok Ads Manager |
| `PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 |
| `PUBLIC_CHECKOUT_DOMAIN` | Usually same as `PUBLIC_STORE_DOMAIN` |

---

## Local Development

```bash
# Install dependencies
pnpm install

# Start local dev server (uses Mini Oxygen)
pnpm dev
# → http://localhost:3000
```

Hydrogen dev uses **Mini Oxygen** (a local Workers runtime) — no separate API server needed locally
since all API calls go to `admin.buy-moi.com`.

---

## Deploy to Shopify Oxygen

### 1. Link the store

```bash
shopify hydrogen link
# Select your store and Hydrogen storefront
```

### 2. Set environment variables on Oxygen

In **Shopify Admin → Hydrogen → Your storefront → Environment variables**, add every variable
from `.env` (or use the CLI):

```bash
shopify hydrogen env push
```

### 3. Deploy

```bash
# One-shot deploy
pnpm build && shopify hydrogen deploy

# Or via GitHub Actions (recommended for production)
# See: https://shopify.dev/docs/storefronts/headless/hydrogen/deployments/github-actions
```

Oxygen will give you a preview URL immediately. Point your DNS (`buy-moi.com`) to the Oxygen
edge once you're satisfied.

---

## DNS Setup (buy-moi.com)

1. In Shopify Admin → **Online Store → Domains**, add `buy-moi.com` as a custom domain.
2. Add a CNAME record pointing `buy-moi.com` → `shops.myshopify.com` at your registrar.
3. Shopify handles TLS termination automatically.

---

## Architecture

```
buy-moi.com (Shopify Oxygen)
    └── Hydrogen app (this repo, artifacts/moi-hydrogen)
            ├── Storefront API    → checkout-moi.myshopify.com/api/graphql
            ├── Cart API          → Hydrogen createCartHandler → Storefront API
            └── Backend calls     → https://admin.buy-moi.com (Replit Express)
                                        ├── POST /api/ambassador
                                        ├── POST /api/newsletter
                                        ├── POST /api/restock/subscribe
                                        ├── POST /api/capi/event  (Meta CAPI)
                                        └── POST /api/tiktok/capi (TikTok CAPI)

admin.buy-moi.com (Replit — permanent)
    └── Express 5 + PostgreSQL + Resend + Bosta + Paymob webhooks
```

---

## Releasing a New Version

```bash
# Typecheck
pnpm typecheck

# Build
pnpm build

# Deploy
shopify hydrogen deploy
```

Oxygen is a **serverless Workers runtime** — deployments are instant with zero downtime.
Every deploy creates a new version; you can roll back in Shopify Admin → Hydrogen → Versions.

---

## Adding / Updating Products

Product data (images, colors, sizes, variants) is managed in two places:

1. **Shopify Admin** — inventory, pricing, and Storefront API variant IDs.
2. **`app/config/images.ts`** — local image paths and fallback data used before Shopify data loads.

After adding a new product in Shopify:
1. Note the product `handle` (slug) and variant IDs from the Admin.
2. Add the product config to `app/config/images.ts`.
3. Add a new `<ProductCard>` in `app/routes/_index.tsx` (and/or a new route).
4. Deploy.

---

## Performance Notes

- All images are served from `/public/images/`. For production, upload images to the Shopify CDN
  (via the Admin media library) and update the URLs in `app/config/images.ts`.
- Hydrogen uses Oxygen's edge cache with `CacheLong` / `CacheShort` strategies — storefront queries
  are automatically cached at the edge.
- The Tailwind CSS build is inlined at build time — no runtime CSS loading.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `401 Unauthorized` on Storefront API | Check `PUBLIC_STOREFRONT_API_TOKEN` and `PUBLIC_STORE_DOMAIN` |
| Cart not persisting | Check `SESSION_SECRET` is set and `cart` cookie is not blocked |
| Images not loading | Verify `/public/images/` contains all files from `app/config/images.ts` |
| Analytics not firing | Set `?debug_analytics=1` in the URL to force analytics in development |
| CSP blocked scripts | Update directives in `app/entry.server.tsx` → `createContentSecurityPolicy` |
| Missing env var | Run `shopify hydrogen env pull` to sync Oxygen vars to local `.env` |
