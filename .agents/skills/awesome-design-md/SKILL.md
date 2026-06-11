---
name: awesome-design-md
description: Fetch and apply DESIGN.md design system files from real websites to guide UI generation. Use when the user wants to build a UI that looks like a specific brand/website, asks to match a design style, or says "make it look like X". Fetches from https://getdesign.md/{slug}/design-md using webFetch.
---

# Awesome DESIGN.md

A curated collection of DESIGN.md files extracted from 73 real websites. Each file encodes a brand's complete design language — colors, typography, spacing, component patterns — in plain markdown an AI agent can read and apply directly.

Source: https://github.com/VoltAgent/awesome-design-md

## What is DESIGN.md?

A plain-text design system document (introduced by Google Stitch) that AI agents read to generate visually consistent UI. Drop it into your project root and any AI coding agent understands how your UI should look.

| File | Who reads it | What it defines |
|------|-------------|-----------------|
| `AGENTS.md` | Coding agents | How to build the project |
| `DESIGN.md` | Design agents | How the project should look and feel |

Each DESIGN.md covers:
1. Visual Theme & Atmosphere — mood, density, design philosophy
2. Color Palette & Roles — semantic name + hex + functional role
3. Typography Rules — font families, scale, weight pairings
4. Spacing & Layout System — grid, gutters, container widths
5. Component Patterns — buttons, cards, nav, forms
6. Imagery & Iconography — photo style, icon set, illustration tone
7. Motion & Interaction — easing curves, transition durations
8. Do / Don't Rules — explicit brand guardrails

## How to Use

### Fetching a DESIGN.md

URL pattern: `https://getdesign.md/{slug}/design-md`

```javascript
const result = await webFetch({ url: "https://getdesign.md/apple/design-md" });
console.log(result.markdown);
```

### Workflow

1. User says "make it look like [brand]" or "build a [brand]-style UI"
2. Find the slug from the catalog below
3. Fetch the DESIGN.md with webFetch
4. Read the design tokens, colors, typography, and component rules
5. Apply them when building or redesigning components

### If the website is not in the catalog

Request one at https://getdesign.md/request — or use `webFetch` on any URL and `extractBranding` as a fallback.

---

## Catalog

### AI & LLM Platforms

| Brand | Slug | Style |
|-------|------|-------|
| Claude | `claude` | Warm terracotta accent, clean editorial layout |
| Cohere | `cohere` | Vibrant gradients, data-rich dashboard aesthetic |
| ElevenLabs | `elevenlabs` | Dark cinematic UI, audio-waveform aesthetics |
| Minimax | `minimax` | Bold dark interface with neon accents |
| Mistral AI | `mistral.ai` | French-engineered minimalism, purple-toned |
| Ollama | `ollama` | Terminal-first, monochrome simplicity |
| OpenCode AI | `opencode.ai` | Developer-centric dark theme |
| Replicate | `replicate` | Clean white canvas, code-forward |
| Runway | `runwayml` | Cinematic dark heroes, paper-white reading bands, black pill CTAs |
| Together AI | `together.ai` | Technical, blueprint-style design |
| VoltAgent | `voltagent` | Void-black canvas, emerald accent, terminal-native |
| xAI | `x.ai` | Stark monochrome, futuristic minimalism |

### Developer Tools & IDEs

| Brand | Slug | Style |
|-------|------|-------|
| Cursor | `cursor` | Sleek dark interface, gradient accents |
| Expo | `expo` | Dark theme, tight letter-spacing, code-centric |
| Lovable | `lovable` | Playful gradients, friendly dev aesthetic |
| Raycast | `raycast` | Sleek dark chrome, vibrant gradient accents |
| Superhuman | `superhuman` | Premium dark UI, keyboard-first, purple glow |
| Vercel | `vercel` | Black and white precision, Geist font |
| Warp | `warp` | Dark IDE-like interface, block-based command UI |

### Backend, Database & DevOps

| Brand | Slug | Style |
|-------|------|-------|
| ClickHouse | `clickhouse` | Yellow-accented, technical documentation style |
| Composio | `composio` | Modern dark with colorful integration icons |
| HashiCorp | `hashicorp` | Enterprise-clean, black and white |
| MongoDB | `mongodb` | Green leaf branding, developer documentation focus |
| PostHog | `posthog` | Playful hedgehog branding, developer-friendly dark UI |
| Sanity | `sanity` | Dark-first editorial, 112px display type, coral-red accent |
| Sentry | `sentry` | Dark dashboard, data-dense, pink-purple accent |
| Supabase | `supabase` | Dark emerald theme, code-first |

### Productivity & SaaS

| Brand | Slug | Style |
|-------|------|-------|
| Cal.com | `cal` | Clean neutral UI, developer-oriented simplicity |
| Intercom | `intercom` | Friendly blue palette, conversational UI patterns |
| Linear | `linear.app` | Ultra-minimal, precise, purple accent |
| Mintlify | `mintlify` | Clean, green-accented, reading-optimized |
| Notion | `notion` | Warm minimalism, serif headings, soft surfaces |
| Resend | `resend` | Minimal dark theme, monospace accents |
| Zapier | `zapier` | Warm orange, friendly illustration-driven |

### Design & Creative Tools

| Brand | Slug | Style |
|-------|------|-------|
| Airtable | `airtable` | Colorful, friendly, structured data aesthetic |
| Clay | `clay` | Organic shapes, soft gradients, art-directed layout |
| Figma | `figma` | Vibrant multi-color, playful yet professional |
| Framer | `framer` | Bold black and blue, motion-first, design-forward |
| Miro | `miro` | Bright yellow accent, infinite canvas aesthetic |
| Webflow | `webflow` | Blue-accented, polished marketing site aesthetic |

### Fintech & Crypto

| Brand | Slug | Style |
|-------|------|-------|
| Binance | `binance` | Bold yellow on monochrome, trading-floor urgency |
| Coinbase | `coinbase` | Clean blue identity, trust-focused, institutional feel |
| Kraken | `kraken` | Purple-accented dark UI, data-dense dashboards |
| Mastercard | `mastercard` | Warm cream canvas, orbital pill shapes, editorial warmth |
| Revolut | `revolut` | Sleek dark interface, gradient cards, fintech precision |
| Stripe | `stripe` | Signature purple gradients, weight-300 elegance |
| Wise | `wise` | Bright green accent, friendly and clear |

### E-commerce & Retail

| Brand | Slug | Style |
|-------|------|-------|
| Airbnb | `airbnb` | Warm coral accent, photography-driven, rounded UI |
| Meta | `meta` | Photography-first, binary light/dark surfaces, Meta Blue CTAs |
| Nike | `nike` | Monochrome UI, massive uppercase Futura, full-bleed photography |
| Shopify | `shopify` | Dark-first cinematic, neon green accent, ultra-light display type |
| Starbucks | `starbucks` | Four-tier earth-green system, warm cream canvas |

### Media & Consumer Tech

| Brand | Slug | Style |
|-------|------|-------|
| Apple | `apple` | Premium white space, SF Pro, cinematic imagery |
| HP | `hp` | Pure white canvas, HP Electric Blue CTA, geometric type |
| IBM | `ibm` | Carbon design system, structured blue palette |
| NVIDIA | `nvidia` | Green-black energy, technical power aesthetic |
| Pinterest | `pinterest` | Red accent, masonry grid, image-first |
| PlayStation | `playstation` | Three-surface channel layout, cyan hover-scale interaction |
| SpaceX | `spacex` | Stark black and white, full-bleed imagery, futuristic |
| Spotify | `spotify` | Vibrant green on dark, bold type, album-art-driven |
| The Verge | `theverge` | Acid-mint and ultraviolet accents, Manuka display type |
| Uber | `uber` | Bold black and white, tight type, urban energy |
| Vodafone | `vodafone` | Monumental uppercase display, Vodafone Red chapter bands |
| WIRED | `wired` | Paper-white broadsheet density, custom serif, ink-blue links |

### Automotive

| Brand | Slug | Style |
|-------|------|-------|
| BMW | `bmw` | Dark premium surfaces, precise German engineering aesthetic |
| BMW M | `bmw-m` | Motorsport-inspired contrast, M color accents |
| Bugatti | `bugatti` | Cinema-black canvas, monochrome austerity, monumental display type |
| Ferrari | `ferrari` | Chiaroscuro black-white editorial, Ferrari Red with extreme sparseness |
| Lamborghini | `lamborghini` | True black cathedral, gold accent, LamboType custom Neo-Grotesk |
| Renault | `renault` | Vivid aurora gradients, NouvelR proprietary typeface, zero-radius buttons |
| Tesla | `tesla` | Radical subtraction, cinematic full-viewport photography, Universal Sans |

### Retro Web

| Brand | Slug | Style |
|-------|------|-------|
| Dell (1996) | `dell-1996` | Catalog-era enterprise web, flat color-block ribbon cards |
| Nintendo.com (2001) | `nintendo-2001` | Y2K console chrome, brushed-periwinkle beveled metal panels |
