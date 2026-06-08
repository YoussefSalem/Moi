---
name: Moi SPA scroll restoration
description: Why history.scrollRestoration must be "manual" in the moi SPA, and how scroll is managed across home/product navigation.
---

# Manual scroll restoration is required

The moi home (`/`) is a single always-mounted div toggled via `display:none`
(`homeRevealed` state), and product/other pages render as an AnimatePresence overlay
keyed by `product-${handle}`. The app manages scroll itself:
- ProductPage scrolls window to top on every `handle` change.
- Returning home restores the saved home scroll via `pendingScrollRef` after
  `homeRevealed` flips true.

**Rule:** `window.history.scrollRestoration` MUST be `"manual"` (set once on mount in
App.tsx). 

**Why:** With the browser default `"auto"`, iOS Safari restores the previous scroll
position on swipe-back AFTER React's effects run, overriding the app's scroll-to-top.
Symptom: tapping a "You may also like" product (which pushState-navigates to another
product) then swiping back lands on the previous product scrolled to the bottom
instead of the top. It was intermittent ("sometimes") because it's a timing race
between native restoration and the app's scrollTo.

**How to apply:** Never remove the manual scrollRestoration setting. Any new
history-based navigation must own its scroll position explicitly; do not rely on the
browser to restore it.
