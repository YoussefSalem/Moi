---
name: testing-shopify-theme
description: Test and verify the native Shopify Liquid theme migration (artifacts/moi React app -> shopify-theme/). Use when converting a React component to a Liquid section/snippet or visually verifying a migrated section.
---

# Testing the Moi Shopify Liquid theme migration

## Repo layout (important)
- `artifacts/moi/src/components/*.tsx` — original React + Tailwind storefront (source of truth for design).
- `shopify-theme/` — **canonical** native theme (Online Store 2.0: JSON templates in `templates/*.json`, `sections/`, `snippets/`, `assets/theme.css`, `assets/theme.js`). This is the migration target.
- `moi-shopify-theme/` — an older/parallel theme (uses `templates/*.liquid` + `assets/moi-theme.css`). Don't confuse the two; prefer `shopify-theme/`.
- `shopify-theme/AUDIT.md` — Phase-1 audit mapping React routes/APIs/data models to Shopify equivalents. Read it first.

## Styling convention (decided by repo owner)
- **Do NOT retain Tailwind classes.** `shopify-theme/` does not load Tailwind. Rewrite Tailwind utilities into custom CSS classes appended to `assets/theme.css`, matching existing sections (e.g. `.editorial-strip`, `.ambassador-form`). Use BEM-ish names like `.newsletter`, `.newsletter-card`, `.newsletter-submit`.
- Reuse existing infra: `.animate-in` (+ `.visible`) drives scroll reveals via an IntersectionObserver in `assets/theme.js`. The `moi-shine` shimmer keyframe lives in the React app's `index.css`; copy it into `theme.css` if a section needs it.
- Fonts already loaded in `layout/theme.liquid`: Cormorant Garamond (headings) + Montserrat (UI).

## React -> Liquid mapping cheatsheet
- `useState`/`onChange` form fields -> plain inputs (no client state needed).
- Headless API calls (`subscribeToNewsletter`, `/api/*`) -> native Liquid objects/forms. Newsletter signup = `{% form 'customer' %}` + `<input type="hidden" name="contact[tags]" value="newsletter">` + `<input type="email" name="contact[email]">`. Success = `{% if form.posted_successfully? %}`, errors = `{% if form.errors %}{{ form.errors | default_errors }}`.
- `useCustomer()` / logged-in -> `{{ customer }}`, `{{ customer.email }}`.
- lucide-react icons -> inline equivalent SVGs (keep width/height/stroke-width).
- framer-motion `whileInView` -> `class="animate-in"`.
- Expose editable copy via a `{% schema %}` block with a `presets` entry, defaults equal to the original component text.
- Wire a new section into a page by adding it to the relevant `templates/*.json` `sections` map AND its `order` array (e.g. home = `templates/index.json`).
- **Constraints:** ignore `artifacts/api-server`, Paymob/checkout, and any headless API connection — rely on Shopify native checkout/Apple Pay.

## How to verify a section WITHOUT a Shopify store
There are no Shopify store credentials in this environment by default, and `{% form 'customer' %}` / `{{ customer }}` only resolve on Shopify's servers. The monorepo also ships without `node_modules` (large pnpm workspace), so running the React SPA is usually not worth it.

Use a **static preview** (the repo already does this — see `moi-shopify-theme/preview.html`):
1. Create a throwaway `shopify-theme/_preview-<name>.html` (relative `<link rel="stylesheet" href="assets/theme.css">` works from that folder) and paste the section's rendered HTML, substituting Liquid tags with sample values. Represent `{% form 'customer' %}` as `<form method="post" action="/contact#contact_form"><input type="hidden" name="form_type" value="customer">...`.
2. For an adversarial before/after, also make a `_preview-original.html` that loads the Tailwind Play CDN (`https://cdn.tailwindcss.com`) + the original `.tsx` markup. Because `theme.css` has no Tailwind, a broken CSS rewrite renders unstyled — so matching designs proves the rewrite.
3. Open `file:///home/ubuntu/repos/Moi/shopify-theme/_preview-<name>.html` in Chrome (click the address bar before typing; the omnibox sometimes treats a pasted `file://` path as a search). Maximize with `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.
4. Verify card/gradient/fonts/buttons match, toggle the `form.posted_successfully?` success markup, and confirm no headless `fetch`/`/api/` calls remain (`grep`).
5. **Delete the `_preview-*.html` files before committing** — they are not part of the PR.

## Build / lint / test
- No CI, no pre-commit hooks, no `.github/workflows` in this repo (a GH Actions workflow was intentionally removed).
- No theme-check / Shopify CLI installed. Liquid isn't covered by `pnpm run typecheck` (TS only). Validate `{% schema %}` blocks and `templates/*.json` as JSON manually (e.g. `python3 -c "import json,re; ..."`).
- Original React app commands (if you ever install deps): `artifacts/moi` has `dev` (vite), `build`, `serve`, `typecheck`, `test` (vitest).

## Devin Secrets Needed
- For live testing against a real store: a Shopify **Theme Access password** (e.g. `SHOPIFY_CLI_THEME_TOKEN`) + the store domain, to run `shopify theme dev`. None are configured by default — fall back to the static-preview method above.
