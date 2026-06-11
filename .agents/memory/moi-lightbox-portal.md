---
name: Moi CinematicLightbox portal
description: Why the fullscreen image lightbox must render via createPortal to document.body
---

# Moi CinematicLightbox must portal to document.body

`CinematicLightbox` renders its fullscreen overlay via `createPortal(jsx, document.body)`.

**Why:** The lightbox is used inside ProductPage, which is a `position:fixed; z-index:51`
overlay (see moi-ios-back-gesture). That div establishes a stacking context, so a
`position:fixed; z-index:100` lightbox nested inside it only competes *within* that
context — its effective stack order in the root is capped at the product page's 51. The
sticky site header (root stacking context) then painted ON TOP of the lightbox, so the
image did not cover the page edge-to-edge. Portaling to `document.body` lifts the
lightbox into the root stacking context where a high z-index (9999) genuinely sits above
everything.

**How to apply:** Keep the portal. Also keep the permanently-mounted CSS
visibility/opacity pattern (no AnimatePresence) to avoid iOS GPU-layer memory churn —
the portal mounts once and stays. Close button uses
`top: max(calc(env(safe-area-inset-top) + 10px), 16px)` and the thumb strip uses
`padding-bottom: max(env(safe-area-inset-bottom), 12px)` for notch/home-indicator safe
areas.
