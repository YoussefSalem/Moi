---
name: Moi product recommendations carousel
description: Architecture of the "You May Also Like" carousel on product pages — imperative DOM pattern, infinite loop, drag support.
---

## Rule

`ProductCarousel.tsx` is a fully self-contained card carousel. Props: `items: CarouselItem[]`, `onItemClick`, optional `heading`/`subheading`. No ref/handle — App.tsx and ProductPage.tsx hold no carousel refs.

**Infinite loop:** ghost clones `[last, ...all, first]`; `rawIdxRef` starts at 1 (first real slide). After `transitionend`, if on a ghost, immediately jump (no transition) to the mirror real slide.

**60fps imperative updates:** card `transform` is written directly to DOM via ref — never via React `useState` or inline style driven by state. `useLayoutEffect` sets initial position; a resize listener re-measures and re-positions without triggering React renders.

**Drag:** unified `PointerEvent` (covers mouse + touch). `pointerdown` → `pointermove` → `pointerup`. Drag threshold 5px distinguishes click from drag. On release, snap to nearest slide or flick to next/prev based on velocity.

**Card width:** `clamp(160px, 44vw, 260px)` via CSS; actual px read from DOM in `useLayoutEffect`.

**Why:** previous implementation embedded all carousel state/refs inside ProductPage.tsx as a large IIFE, used `overflow-x:scroll` + tripled-set wrap measured from child offsets, and broke when the item set changed on product navigation. The ghost-clone + imperative-transform pattern is deterministic, self-contained, and handles product switches cleanly since the component re-mounts.

**How to apply:** treat `ProductCarousel` as a drop-in — pass items + click handler, nothing else. If adding new carousel variants, copy this pattern (ghost clones + imperative transform ref) rather than the native-scroll approach.
