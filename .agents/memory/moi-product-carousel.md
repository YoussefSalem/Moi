---
name: Moi product carousel imperative pattern
description: Architecture decisions for the ProductCarousel infinite-swipe component — imperative DOM, no React state, ghost slides.
---

## Rule
Never put `transform` in React's inline `style` when the same property is also driven by imperative `el.style.transform` calls. React re-renders (even those triggered by parent state changes like `setProductHandle`) will reset the inline style and snap the track back to position 0.

**Why:** React owns every property in `style={{...}}`. If you imperatively change `el.style.transform`, the next React render will overwrite it with the value from the JSX.

**How to apply:**
- Omit `transform` from the `style` prop entirely.
- Use `useLayoutEffect(() => { applyTransform(0, false); }, [])` to set the initial position before the browser's first paint (no flash).
- All subsequent positions are set by `applyTransform()` which writes directly to `trackRef.current.style`.

## No React state in the carousel body
`ProductCarousel` has zero `useState` calls. The only state change it triggers is `onProductChange?.(slug)` in the parent (App.tsx) via a callback. The parent's `setProductHandle` causes App.tsx to re-render, which passes new props to the carousel, but since transform is not in React's style, the visual position is unaffected.

## Ghost slides for infinite loop
- N+2 slides: `[ghost_last, p0, p1, …, pN-1, ghost_first]`
- Ghost slides render a cheap `background-image` div (not a full ProductPage) — they're only visible for ~300ms during the loop animation.
- After the CSS transition to a ghost (rawIdx === 0 or N+1), a `transitionend` listener instantly jumps to the real equivalent slide (rawIdx = N or 1) with `transition: "none"`.
- Safety: `setTimeout` fallback dispatches the transitionend cleanup if the event never fires.

## Gesture architecture
- `touch-action: pan-y` on the container: browser handles vertical scroll within each slide's `overflow-y: auto` naturally; horizontal pointer events fire to JS.
- Direction lock: `Math.abs(dx) > Math.abs(dy) * 1.5` — must be clearly horizontal (1.5× ratio) before committing to carousel drag.
- Left-edge guard: `e.clientX < 16` skips the iOS back-swipe zone so the browser handles it.
- `data-no-carousel` attribute on the inner product gallery container: `e.target.closest('[data-no-carousel]')` in `handlePointerDown` lets the gallery claim its own horizontal swipes.

## Integration with App.tsx
- `key="product-carousel"` on the motion.div (stable across all product changes) — AnimatePresence only fires on home↔product transitions, not product↔product.
- `navigateToProduct`: if `currentPageRef.current === "product"`, calls `carouselRef.current?.jumpTo(handle)` + `replaceState` instead of `pushState`. One pushState entry per product-area visit; all swipes use replaceState → back button always goes home.
- `overflow: isProductPage ? "hidden" : "auto"` on the motion.div — the carousel needs `overflow: hidden` on its container so the off-screen slides don't bleed.
- `isProductSwitch` state removed entirely — product switching is now the carousel's job.
