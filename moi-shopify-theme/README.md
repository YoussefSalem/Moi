# MOI — Shopify Theme

A premium, minimal fashion Shopify theme based on the Moi brand aesthetic.

## Upload Instructions

1. **Zip this folder** (all files, maintaining the directory structure)
2. Go to your Shopify Admin → Online Store → Themes
3. Click "Upload theme" and select the zip file
4. Activate the theme or preview it

## Theme Structure

```
moi-shopify-theme/
├── layout/
│   └── theme.liquid          ── Main layout
├── templates/
│   ├── index.liquid           ── Homepage
│   ├── product.liquid         ── Product page
│   ├── collection.liquid      ── Collection page
│   ├── cart.liquid            ── Cart page
│   ├── page.liquid            ── Static pages
│   ├── page.ambassador.liquid ── Ambassador application
│   ├── search.liquid          ── Search results
│   └── 404.liquid            ── 404 page
├── sections/
│   ├── header.liquid          ── Sticky header
│   ├── hero.liquid            ── Full-screen hero
│   ├── trust-bar.liquid       ── Trust badges
│   ├── product-collection.liquid ── Product grid
│   ├── editorial.liquid       ── Dark editorial strip
│   ├── tiktok-social.liquid   ── TikTok social proof
│   ├── newsletter.liquid      ── Newsletter signup
│   ├── footer.liquid          ── Dark footer
│   ├── cart-drawer.liquid     ── Slide-out cart
│   └── search-drawer.liquid   ── Search overlay
├── assets/
│   ├── moi-theme.css          ── All styles
│   └── moi-theme.js           ── All scripts
├── snippets/
│   ├── head-meta.liquid       ── SEO meta tags
│   └── product-card.liquid    ── Reusable product card
├── config/
│   ├── settings_schema.json   ── Theme settings
│   └── settings_data.json     ── Default settings
```

## Features

- **Sticky header**: Transparent over hero, solid white on scroll
- **Full-screen hero**: Video support with fallback image
- **Product cards**: Color swatches, hover images, sold-out states
- **Editorial strip**: Dark section with animated text
- **TikTok social proof**: Embedded video grid
- **Newsletter**: Elegant gradient card with email capture
- **Footer**: Accordion FAQs, newsletter, social links
- **Ambassador page**: Form application with API integration
- **Cart drawer**: Slide-out cart with item management
- **Search drawer**: Overlay search with product suggestions
- **Responsive**: Fully mobile-optimized

## Customization

All sections are editable in the Shopify Theme Editor:
- Hero image/video and CTA text
- Collection grids (auto-populate or manual blocks)
- Trust bar text and emojis
- Editorial words and labels
- TikTok video URLs
- Newsletter headline and description
- Footer links, social URLs, and contact info

## Color Palette

- Background: `#faf8f5` (warm off-white)
- Text: `#1e1814` (near-black)
- Accent: `#c83232` (red for sale/stock)
- Footer: `#28211d` (dark brown)
- Fonts: Cormorant Garamond (serif) + Montserrat (sans)

## Notes

- Uses Shopify's native checkout, cart, and customer accounts
- No custom backend — all Shopify-native
- Products pull from Shopify collections automatically
- Variant selection works with color swatches and size pills
