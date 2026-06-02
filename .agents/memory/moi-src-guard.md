---
name: Moi src-guard audit
description: Findings from the pre-launch audit — which components had empty-string src= warnings, which are home-page-rendered, and what pre-launch blockers remain.
---

# Moi src-guard audit

## The pattern
React fires "An empty string was passed to the src attribute" when `src=""` reaches a DOM `<img>`. Fix with `src={value || undefined}` (omits the attribute entirely when falsy) or a conditional render guard `{value && <img src={value} />}`.

## Home page component tree (non-lazy)
- HeroVideo, ProductColorSection (× 2 WAVVY/VERSA), EditorialStrip (text-only, no images), LookView (guarded by `product !== null`), WhatsAppButton, LoadingScreen, Header

## Lazy always-rendered (Suspense)
- CartDrawer, CheckoutPage (inner content guarded by `checkoutOpen`), CustomerAuthModal, AccountPage, SearchDrawer (inner content guarded by `open`)

## Components fixed during audit
All had `src={value}` → `src={value || undefined}` or existence-guard added:
- ColorCard.tsx (mobile img), QuickPreview.tsx, SearchDrawer.tsx, Carousel.tsx (×3), LookView.tsx (×3), CinematicLightbox.tsx (×2), ProductCard.tsx (desktop + mobile), EditorialPhotoStrip.tsx

## Dead components
- `LimitedDrop.tsx` — file exists but is never imported; can be deleted.
- `EditorialPhotoStrip.tsx` — file exists but is never imported anywhere; can be deleted.

## Pre-launch blockers still open
1. SESSION_SECRET: **FIXED** — fails fast at startup in production; dev still falls back safely.
2. GA4 measurement ID is placeholder `G-MEASUREMENT_ID` in index.html + `ANALYTICS_ENABLED = false` in analytics.ts → zero analytics data after launch. Needs manual action.
3. Auth routes (`/api/customers/auth/customer/verify-otp`, etc.) have no rate limiting → brute-force vulnerable. Needs manual action.

**Why:** These are post-audit operational tasks, not code defects (except SESSION_SECRET which is now fixed).
