---
name: Moi product recommendations carousel
description: Architecture of the "You May Also Like" carousel on product pages — imperative DOM pattern, infinite loop, drag support, click handling.
---

## Rule

`ProductCarousel.tsx` is a fully self-contained card carousel. Props: `items: CarouselItem[]`, `onItemClick`, optional `heading`/`subheading`. No ref/handle — App.tsx and ProductPage.tsx hold no carousel refs.

**Infinite loop:** ghost clones `[last, ...all, first]`; `rawIdxRef` starts at 1 (first real slide). After `transitionend`, if on a ghost, immediately jump (no transition) to the mirror real slide.

**60fps imperative updates:** card `transform` is written directly to DOM via ref — never via React `useState` or inline style driven by state. `useLayoutEffect` sets initial position; a resize listener re-measures and re-positions without triggering React renders.

**Drag:** `onPointerDown` fires on the clip div; window-level `pointermove` and `pointerup` listeners are registered via `useEffect` for the lifetime of the component. No `setPointerCapture`. Drag threshold 5px (`didDragRef`) distinguishes click from drag. On horizontal release, snap or flick; on vertical/null lock, let native click fire.

**Click handling:** native `onClick` on each card button, guarded by `if (!didDragRef.current)`. This works because we do NOT call `setPointerCapture` — without capture, the browser dispatches click events normally to the button.

**CRITICAL — do NOT add `setPointerCapture`:** `setPointerCapture` redirects `pointerup` to the capturing element and suppresses native `click` on child buttons. `e.target` also becomes the capturing element, so `closest("[data-handle]")` won't work. `document.elementFromPoint` as a workaround also doesn't reliably work inside the Replit proxy. The window-listener pattern avoids all of this.

**Card width:** `clamp(160px, 44vw, 260px)` via CSS; actual px read from DOM in `useLayoutEffect`.

**Why window listeners over clip-div handlers:** without `setPointerCapture`, pointer events don't automatically follow the pointer outside the clip div. Window listeners ensure drag tracking works even when the pointer leaves the carousel boundary, preventing a stuck `ptrIdRef` that would lock out future interactions.

**How to apply:** treat `ProductCarousel` as a drop-in — pass items + click handler, nothing else. For new drag-enabled components that also need native click on child elements, always use window-level move/up listeners + native onClick, never setPointerCapture.
