---
name: Moi iOS back-gesture blank fix
description: Why the iOS swipe-back gesture showed a blank left side and how it was resolved.
---

## The Problem
iOS Safari's back gesture for pushState SPAs showed a blank warm-beige background on the left side instead of home page content. Multiple CSS tricks (position:fixed + z-index:0 on home, willChange, overflow:hidden) all failed.

## Root Cause
iOS's back gesture compositor uses a pre-captured screenshot of the "previous page" taken at pushState time. React commits state synchronously before pushState fires, so by pushState time the home div was already hidden (display:none or covered by a solid-background product page). The screenshot captured only the app background color, not home content.

## The Fix
Changed the navigation architecture so home is NEVER hidden from the document flow:

- **Home div**: Always `display: block` in the document flow. Style changes only from `{}` (active) to `{ pointerEvents: "none" }` (background).
- **Product page motion.div**: `position: fixed; inset: 0; z-index: 51; overflow-y: auto; background: #faf8f5` — a full-screen fixed overlay.
- **Header**: Gets `zIndex={page !== "home" ? 52 : 50}` so it always sits above the product page overlay.
- **ProductPage scroll-to-top**: Changed from `window.scrollTo({top:0})` (which scrolls the body/home) to `document.getElementById("product-scroll-container").scrollTop = 0`. The motion.div carries `id="product-scroll-container"`.

**Why:** With product page as a fixed overlay, iOS compositor sees home (always live) as the "background" layer behind the fixed product page layer. Back gesture slides the product page layer to the right, revealing live home content underneath — no snapshots needed.

**How to apply:** Any future "overlay page" that should reveal home on back gesture must use `position: fixed; inset: 0` instead of `position: relative` or document flow. Do NOT use opacity tricks or display:none on home.
