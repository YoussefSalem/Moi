# Moi — Hydrogen Storefront

A pixel-perfect Shopify Hydrogen storefront for **Moi** (`buy-moi.com`), Egypt's premium versatile fashion brand.

## Stack

- **Hydrogen** `^2024.4.3` — Shopify's React-based storefront framework
- **Remix v2** — server-side rendering + file-based routing
- **Tailwind CSS v4** — utility-first styling
- **Framer Motion** — page/component animations
- **TypeScript** — full type safety
- **Oxygen** — Shopify's edge deployment platform (Cloudflare Workers)

## Features

- Full Shopify Storefront API integration (products, variants, collections, cart)
- Custom Egypt checkout: Cash on Delivery (COD), InstaPay, and Card via Paymob
- SSR product pages with SEO-optimized meta tags
- Animated hero with parallax scroll effect
- Color-swatchable product cards with hover crossfade and mobile swipe
- Cart drawer with line-item management
- Customer account (Shopify Customer Account API)
- Search drawer with live results
- WhatsApp chat widget
- Meta Pixel + TikTok Pixel analytics
- Policy pages (privacy, refund, delivery)
- Ambassador programme page
- Accessories collection page

## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) `@shopify/cli@^3.73`
- A Shopify store with a Storefront API token

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` → `.env` and fill in your values:

```env
SESSION_SECRET="any-32-char-random-string"
PUBLIC_STORE_DOMAIN="your-store.myshopify.com"
PUBLIC_STOREFRONT_API_TOKEN="your-storefront-api-token"
PUBLIC_STOREFRONT_API_VERSION="2024-04"
PUBLIC_CHECKOUT_DOMAIN="your-store.myshopify.com"  # or custom domain

# Customer Account API (for login — create a "Headless" app in Partner Dashboard)
PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID=""
PUBLIC_CUSTOMER_ACCOUNT_API_URL=""
```

### 4. Run locally

```bash
npm run dev
# → http://localhost:3000
```

### 5. Deploy to Oxygen (Shopify)

```bash
# Connect to Shopify (first time)
shopify hydrogen link

# Deploy
shopify hydrogen deploy
```

## Project Structure

```
app/
├── components/        # Shared UI components
│   ├── Header.tsx     # Sticky nav (transparent→solid on scroll)
│   ├── HeroVideo.tsx  # Full-screen hero with parallax
│   ├── Footer.tsx     # Dark brand footer with accordion
│   ├── CartDrawer.tsx # Side-panel cart
│   ├── CheckoutPage.tsx  # Custom Egypt checkout (COD/InstaPay/Card)
│   ├── ProductColorSection.tsx  # Homepage product grid
│   ├── ColorCard.tsx  # Product color card with hover + swipe
│   ├── EditorialStrip.tsx  # Dark brand manifesto strip
│   ├── SearchDrawer.tsx  # Search overlay
│   ├── LookView.tsx   # Full-screen "Shop the Look" panel
│   └── ...
├── routes/            # Remix file-based routes
│   ├── _index.tsx     # Homepage
│   ├── products.$handle.tsx  # Product detail page
│   ├── cart.tsx       # Cart actions (server-only)
│   ├── checkout.tsx   # Custom checkout page
│   ├── search.tsx     # Search results
│   ├── account.tsx    # Customer account
│   ├── accessories.tsx
│   ├── ambassador.tsx
│   └── policies.$handle.tsx
├── lib/               # Utilities
│   ├── fragments.ts   # Reusable GraphQL fragments
│   ├── price.ts       # EGP price formatting
│   ├── utils.ts       # Helpers (slugify, swatch colors, etc.)
│   └── analytics.client.ts  # Meta Pixel + TikTok Pixel
├── styles/
│   └── app.css        # Tailwind + custom animations
├── root.tsx           # Root layout (Header, CartDrawer, etc.)
├── entry.client.tsx
└── entry.server.tsx
server.ts              # Oxygen/Workers entry point
```

## Shopify Setup

### Products

The storefront expects these product handles:
- `moi-wavvy` — MOI WAVVY top (colors: Light Blue, Navy, Mint)
- `moi-versa-top` — MOI VERSA TOP (colors: White, Cashmere, Beige, Yellow, Teal)
- `trio-bangles` — Trio Bangles (accessories)

### Collections

- `accessories` — Accessories collection

### Product Options

Products should use the option names `Color` and `Size` (case-insensitive matching is applied).

### Hero Image

Place your hero image at `public/hero-image.jpeg` or update `HERO_FALLBACK` in `app/components/HeroVideo.tsx`.

### Hero Video (optional)

Set `HERO_VIDEO_URL` in `app/components/HeroVideo.tsx` to a hosted `.mp4` URL for an autoplay background video.

## Custom Checkout

The custom Egypt checkout (`/checkout`) connects to the API server at `/api/orders`. You need to have the existing Moi API server running (or deploy it separately) and ensure `CORS` is configured to allow requests from your Hydrogen domain.

Payment methods:
- **COD** — creates a Shopify draft order + fulfils on delivery
- **InstaPay** — collects receipt screenshot, admin approves manually
- **Card** — redirects to Paymob iframe for card processing

## Analytics

Set these in `.env`:
- `VITE_META_PIXEL_ID` — Facebook/Meta Pixel ID
- `VITE_TIKTOK_PIXEL_ID` — TikTok Pixel ID

Initialize the pixel scripts in `app/root.tsx` (add script tags to `<head>`).

## Typography & Colours

| Token | Value |
|-------|-------|
| `--color-bg-primary` | `#faf8f5` |
| `--color-fg-primary` | `#1e1814` |
| `--color-accent-warm` | `#7a6e64` |
| `--color-accent-muted` | `#b0a090` |
| `--color-red-sale` | `#c83232` |
| Heading font | Cormorant Garamond (serif) |
| UI font | Montserrat (sans-serif) |

## License

Private — all rights reserved by Moi.
