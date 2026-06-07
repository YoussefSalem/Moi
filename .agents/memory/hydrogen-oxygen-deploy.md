---
name: Hydrogen Oxygen deployment quirks
description: Fixes needed to make shopify hydrogen deploy work in GitHub Actions for a pnpm monorepo
---

## Rule
When deploying a Hydrogen (Remix-based) app from a pnpm monorepo to Shopify Oxygen via GitHub Actions:

1. **Lockfile**: `shopify hydrogen deploy` requires `pnpm-lock.yaml` in the CWD (hydrogen dir). Install from monorepo root (`pnpm install --no-frozen-lockfile`), then `cp pnpm-lock.yaml artifacts/moi-hydrogen/`.
2. **--force**: Needed because the lockfile copy creates uncommitted changes.
3. **Hydrogen version**: Pin to `2025.4.2` — last Remix-compatible version. `2025.5.x+` switched to React Router and breaks `hydrogen.preset()`.
4. **isbot v5**: No default export — use `import { isbot } from "isbot"` not `import isbot from "isbot"`.
5. **createStorefrontClient**: In Hydrogen 2025.4.2 + @shopify/remix-oxygen@2.1.0, import from `@shopify/hydrogen`, not `@shopify/remix-oxygen`.

**Why:** pnpm in workspace mode creates the lockfile at the repo root; Shopify CLI looks for it in the working directory. isbot and remix-oxygen changed exports across major versions.

**How to apply:** Any Hydrogen Remix project deploying to Oxygen from a monorepo.
