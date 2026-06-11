---
name: Moi product recommendations carousel
description: Architecture of the "You May Also Like" carousel on product pages — imperative DOM pattern, infinite loop, drag + inertia, click handling.
---

## Rule

`ProductCarousel.tsx` is a fully self-contained card carousel. Props: `items: CarouselItem[]`, `onItemClick`, optional `heading`/`subheading`. No ref/handle — App.tsx and ProductPage.tsx hold no carousel refs.

## Infinite loop: triple-copy track (NOT ghost clones)

**Why triple copy instead of ghost clones:** Ghost clones ([last, ...all, first]) only work for snap-to-index navigation. For continuous inertia scrolling they cause a large position jump when wrapping that's visible between frames. Triple copy `[...items, ...items, ...items]` allows `rawPxRef` to stay within the middle copy `[N·step, 2N·step)` at all times. Wrap is seamless because N·step and 2N·step show identical content.

**Position model:** `rawPxRef` (absolute px offset, `translateX(-rawPxRef)`). At rest, always in `[N·step, 2N·step)` via `wrapMiddle()`. Starts at `N·step` (middle copy's item 0).

**`wrapMiddle(px, step)`:** `((px - lo) % range + range) % range + lo` — handles negative JS modulo correctly.

## Physics

**Drag:** `startPxRef - dx` (dx = clientX delta). When a wrap occurs mid-drag, `startPxRef` is adjusted by the wrap delta so subsequent frames remain continuous (no jump when looping during a single drag gesture).

**Inertia:** `vel *= Math.pow(FRICTION, dt)` where `FRICTION = 0.992` and `dt` is in ms. Frame-rate independent — same feel at 60/120/144Hz. Stops when `|vel| < 0.05 px/ms` (~400ms for a typical fast swipe).

**Snap:** `Math.round(rawPxRef / step) * step`. Cross-boundary snaps (target outside `[N·step, 2N·step)`) are handled by teleporting `rawPxRef` first (no transition), forcing a reflow (`offsetHeight`), then playing the CSS transition for the short remaining distance. Prevents huge animated jumps.

**Interrupt mid-snap:** `onPointerDown` reads `DOMMatrix(computedStyle.transform).m41` to freeze the track at its current animated position before starting a new drag.

## Click handling

Native `onClick` on each card `<button>`, guarded by `if (!didDragRef.current)`. Works because we do NOT call `setPointerCapture`.

**CRITICAL — do NOT add `setPointerCapture`:** Redirects `pointerup` to the capturing element and suppresses native `click` on child buttons. Window-level `pointermove`/`pointerup` listeners solve this without capture.

## Axis locking

`lockRef: "h" | "v" | null`. Set once movement exceeds 5px. "v" = let native scroll win (return immediately). "h" = take ownership, `e.preventDefault()` to stop page scroll. Axis lock is decided before any transform is applied, so the carousel never fights vertical scroll.

## Why window listeners (not clip-div handlers)

Without `setPointerCapture`, pointer events don't follow the pointer outside the clip. Window listeners ensure drag tracking works even when the finger leaves the carousel, preventing a stuck `ptrIdRef`.

## How to apply

Drop-in: pass items + click handler. For new drag components needing native child clicks, always use window-level listeners + native onClick — never `setPointerCapture`.
