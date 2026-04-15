# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Moi (artifacts/moi)
Premium single-page fashion website for the brand "Moi", inspired by Stradivarius.

**URL**: `/` (root path, port 18266)

**Features**:
- Sticky header: transparent over hero → solid white on scroll; hamburger | MOI centered | search/heart/bag icons
- Full-screen hero: product image fallback (real video can be added via `config/images.ts`)
- Product Card 1: "Asymmetric Cape" Brown, 1.690 EGP — image left, text right, gallery thumbnails, Look View
- Collection carousel: thumbnail strip + large main image + lightbox on click
- Product Card 2: "Asymmetric Cape" Taupe — reversed layout
- Look View: full-screen animated panel with back button, triggered from product cards
- Ambient gradient color-blending via `useImageColor` hook (fast-average-color)
- Footer: dark background with brand links

**Key Files**:
- `src/config/images.ts` — single source of truth for ALL image URLs and product data
- `src/hooks/useImageColor.ts` — ambient gradient color extraction hook
- `src/components/Header.tsx` — sticky header with hamburger drawer
- `src/components/HeroVideo.tsx` — full-screen hero (image/video)
- `src/components/ProductCard.tsx` — product display with gallery and look view trigger
- `src/components/Carousel.tsx` — image carousel + lightbox
- `src/components/LookView.tsx` — full-screen look view panel
- `src/components/Footer.tsx` — dark brand footer

**Typography**: Cormorant Garamond (serif/headings) + Montserrat (sans/UI)
**Palette**: Warm off-white background (#faf8f5), near-black foreground (#1e1814), warm neutral accents
**Dependencies**: framer-motion, lucide-react, fast-average-color

## Tooling

### Spec Kit (v0.7.1)
Spec-Driven Development toolkit installed via `specify-cli` (uv tool).

- **CLI**: `specify` — available after `export PATH="/home/runner/workspace/.local/bin:$PATH"`
- **Skills**: installed to `.claude/skills/` (gitignored for security)
- **Integration**: Claude

Available spec-kit commands (run inside Claude):
- `/speckit-constitution` — establish project principles
- `/speckit-specify` — create baseline specification
- `/speckit-plan` — create implementation plan
- `/speckit-tasks` — generate actionable tasks
- `/speckit-implement` — execute implementation

Optional enhancement commands: `/speckit-clarify`, `/speckit-analyze`, `/speckit-checklist`
