---
name: awesome-design-md
description: Fetch and apply DESIGN.md design system files from the awesome-design-md collection (73+ real websites). Use when the user asks to build UI "like X", "inspired by Y", "in the style of Z", or wants to apply a specific brand's design language to their project. Also use when the user says "use a DESIGN.md" or references getdesign.md.
---

# Awesome DESIGN.md

A curated collection of DESIGN.md files extracted from 73+ real websites. Each file is a plain-text design system document — colors, typography, spacing, component rules — that you can read and apply when generating UI.

**Source repo**: https://github.com/VoltAgent/awesome-design-md  
**Browse & fetch**: https://getdesign.md

## What is DESIGN.md?

A concept introduced by Google Stitch. A plain-text markdown file that defines a website's visual design system — tokens, type scales, color palettes, component patterns, layout rules. Drop it into a project and any AI coding agent can generate UI that matches that brand's design language.

## How to Fetch a DESIGN.md

The getdesign.md site is a JavaScript SPA — `curl` alone won't render the content. Use the **web-search skill** (`fetch_page` / `web_fetch`) to get rendered content from the URL:

```
URL pattern: https://getdesign.md/<slug>/design-md
```

Example: to fetch Linear's design system:
1. Read the `web-search` skill
2. Use its fetch tool on `https://getdesign.md/linear.app/design-md`
3. Extract the markdown content from the rendered page
4. Save to `DESIGN.md` in the project root (or a relevant artifact directory)

## How to Apply a DESIGN.md

Once fetched:
1. Save the content to `DESIGN.md` at the project root or the relevant artifact directory.
2. Read it in full before generating any UI for that context.
3. Honor every token it defines — colors, typefaces, spacing scales, border-radius, shadow depths, component rules.
4. When building components, cite the DESIGN.md rule you're following in code comments where non-obvious.

Do **not** mix tokens from two different DESIGN.md files unless the user explicitly asks for a hybrid.

## Available Designs (73 entries, slug → description)

### AI & LLM Platforms
| Slug | Brand | Vibe |
|------|-------|------|
| `claude` | Claude (Anthropic) | Warm terracotta accent, clean editorial layout |
| `cohere` | Cohere | Vibrant gradients, data-rich dashboard aesthetic |
| `elevenlabs` | ElevenLabs | Dark cinematic UI, audio-waveform aesthetics |
| `minimax` | Minimax | Bold dark interface with neon accents |
| `mistral.ai` | Mistral AI | French-engineered minimalism, purple-toned |
| `ollama` | Ollama | Terminal-first, monochrome simplicity |
| `opencode.ai` | OpenCode AI | Developer-centric dark theme |
| `replicate` | Replicate | Clean white canvas, code-forward |
| `runwayml` | Runway | Cinematic dark heroes, paper-white reading bands, pure black pill CTAs |
| `together.ai` | Together AI | Technical, blueprint-style design |
| `voltagent` | VoltAgent | Void-black canvas, emerald accent, terminal-native |
| `x.ai` | xAI | Stark monochrome, futuristic minimalism |

### Dev Tools
| Slug | Brand | Vibe |
|------|-------|------|
| `cursor` | Cursor | Sleek dark interface, gradient accents |
| `expo` | Expo | Dark theme, tight letter-spacing, code-centric |
| `lovable` | Lovable | Playful gradients, friendly dev aesthetic |
| `raycast` | Raycast | Sleek dark chrome, vibrant gradient accents |
| `superhuman` | Superhuman | Premium dark UI, keyboard-first, purple glow |
| `vercel` | Vercel | Black and white precision, Geist font |
| `warp` | Warp | Dark IDE-like interface, block-based command UI |

### Data & Infrastructure
| Slug | Brand | Vibe |
|------|-------|------|
| `clickhouse` | ClickHouse | Yellow-accented, technical documentation style |
| `composio` | Composio | Modern dark with colorful integration icons |
| `hashicorp` | HashiCorp | Enterprise-clean, black and white |
| `mongodb` | MongoDB | Green leaf branding, developer documentation focus |
| `posthog` | PostHog | Playful hedgehog branding, developer-friendly dark UI |
| `sanity` | Sanity | Dark-first editorial; 112px display type, IBM Plex Mono, coral-red accent |
| `sentry` | Sentry | Dark dashboard, data-dense, pink-purple accent |
| `supabase` | Supabase | Dark emerald theme, code-first |

### Productivity & SaaS
| Slug | Brand | Vibe |
|------|-------|------|
| `cal` | Cal.com | Clean neutral UI, developer-oriented simplicity |
| `intercom` | Intercom | Friendly blue palette, conversational UI patterns |
| `linear.app` | Linear | Ultra-minimal, precise, purple accent |
| `mintlify` | Mintlify | Clean, green-accented, reading-optimized |
| `notion` | Notion | Warm minimalism, serif headings, soft surfaces |
| `resend` | Resend | Minimal dark theme, monospace accents |
| `zapier` | Zapier | Warm orange, friendly illustration-driven |

### Design & Creative
| Slug | Brand | Vibe |
|------|-------|------|
| `airtable` | Airtable | Colorful, friendly, structured data aesthetic |
| `clay` | Clay | Organic shapes, soft gradients, art-directed layout |
| `figma` | Figma | Vibrant multi-color, playful yet professional |
| `framer` | Framer | Bold black and blue, motion-first, design-forward |
| `miro` | Miro | Bright yellow accent, infinite canvas aesthetic |
| `webflow` | Webflow | Blue-accented, polished marketing site aesthetic |

### Fintech & Payments
| Slug | Brand | Vibe |
|------|-------|------|
| `binance` | Binance | Bold Binance Yellow on monochrome, trading-floor urgency |
| `coinbase` | Coinbase | Clean blue identity, trust-focused, institutional feel |
| `kraken` | Kraken | Purple-accented dark UI, data-dense dashboards |
| `mastercard` | Mastercard | Warm cream canvas, orbital pill shapes, editorial warmth |
| `revolut` | Revolut | Sleek dark interface, gradient cards, fintech precision |
| `stripe` | Stripe | Signature purple gradients, weight-300 elegance |
| `wise` | Wise | Bright green accent, friendly and clear |

### Retail & E-commerce
| Slug | Brand | Vibe |
|------|-------|------|
| `airbnb` | Airbnb | Warm coral accent, photography-driven, rounded UI |
| `meta` | Meta | Photography-first, binary light/dark surfaces, Meta Blue CTAs |
| `nike` | Nike | Monochrome UI, massive uppercase Futura, full-bleed photography |
| `shopify` | Shopify | Dark-first cinematic, neon green accent, ultra-light display type |
| `starbucks` | Starbucks | Four-tier earth-green system, warm cream canvas, SoDoSans typography |

### Consumer Tech
| Slug | Brand | Vibe |
|------|-------|------|
| `apple` | Apple | Premium white space, SF Pro, cinematic imagery |
| `hp` | HP | Pure white canvas, HP Electric Blue CTA, geometric Forma DJR Micro |
| `ibm` | IBM | Carbon design system, structured blue palette |
| `nvidia` | NVIDIA | Green-black energy, technical power aesthetic |
| `pinterest` | Pinterest | Red accent, masonry grid, image-first |
| `playstation` | PlayStation | Three-surface channel layout, cyan hover-scale interaction |
| `spacex` | SpaceX | Stark black and white, full-bleed imagery, futuristic |
| `spotify` | Spotify | Vibrant green on dark, bold type, album-art-driven |
| `uber` | Uber | Bold black and white, tight type, urban energy |
| `vodafone` | Vodafone | Monumental uppercase display, Vodafone Red chapter bands |

### Media & Editorial
| Slug | Brand | Vibe |
|------|-------|------|
| `theverge` | The Verge | Acid-mint and ultraviolet accents, Manuka display type |
| `wired` | WIRED | Paper-white broadsheet density, custom serif, ink-blue links |

### Automotive
| Slug | Brand | Vibe |
|------|-------|------|
| `bmw` | BMW | Dark premium surfaces, precise German engineering aesthetic |
| `bmw-m` | BMW M | Motorsport-inspired contrast, M color accents, precision-driven layout |
| `bugatti` | Bugatti | Cinema-black canvas, monochrome austerity, monumental display type |
| `ferrari` | Ferrari | Chiaroscuro black-white editorial, Ferrari Red with extreme sparseness |
| `lamborghini` | Lamborghini | True black cathedral, gold accent, LamboType custom Neo-Grotesk |
| `renault` | Renault | Vivid aurora gradients, NouvelR proprietary typeface, zero-radius buttons |
| `tesla` | Tesla | Radical subtraction, cinematic full-viewport photography, Universal Sans |

### Retro / Historical
| Slug | Brand | Vibe |
|------|-------|------|
| `dell-1996` | Dell (1996) | Catalog-era web: black page frames, flat color-block ribbon cards, Helvetica-Black |
| `nintendo-2001` | Nintendo.com (2001) | Y2K console chrome: brushed-periwinkle beveled metal panels, halftone carbon nav |

## Workflow

1. **User asks for a design style** → find the closest slug from the table above.
2. **Fetch the DESIGN.md** using the web-search skill at `https://getdesign.md/<slug>/design-md`.
3. **Save it** to the project as `DESIGN.md` (or `artifacts/<name>/DESIGN.md` for a specific artifact).
4. **Read the file** in full.
5. **Generate UI** strictly following its tokens and rules.

If no slug matches, you can **request a custom DESIGN.md** at https://getdesign.md/request or create one manually by analyzing the target website with the web-search skill.

## Tips

- For fashion/luxury UI with no exact match, **Ferrari**, **Lamborghini**, **Apple**, or **Nike** tend to work well as reference design systems.
- For Moi (this project), **Stradivarius** isn't in the collection yet — **Ferrari** or **Apple** are the closest luxury-fashion matches.
- DESIGN.md files are reusable reference documents. Once fetched, commit them to the repo so they persist across sessions.
- The collection grows regularly — check https://getdesign.md/design-md for the latest additions.
