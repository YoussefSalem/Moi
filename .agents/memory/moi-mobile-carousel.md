---
name: Moi mobile recs carousel
description: Mobile "Curated For You" recs carousel — infinite loop via native scroll with tripled cards
---

# Moi mobile recommendations carousel

The ProductPage "Curated For You" / recs carousel uses a **native horizontal scroll
container** on mobile (`overflow-x:auto` + `-webkit-overflow-scrolling:touch`), NOT
custom JS touch handlers or rAF auto-scroll.

**Why:** Custom rAF/translateX + manual touchstart/move/end handling repeatedly failed
to swipe on real iOS devices. Root cause: the product page is a `position:fixed;
overflow-y:auto` overlay (see moi-ios-back-gesture). A carousel nested inside that
scroll container has its touch events swallowed by iOS's scroll heuristic before the
JS listeners fire — moving listeners to the outer container and adding `touch-action:
pan-y` + direction detection still wasn't reliable. Native scroll containers are the
only robust pattern here: the browser handles momentum, tap-vs-swipe, and
horizontal-vs-vertical disambiguation itself, identically on iOS and Android.

**Infinite loop implementation (mobile):** Cards are rendered THREE times (set A, B, C).
The container starts with `scrollLeft` at the middle set (B). A `scroll` event listener
wraps the position back into B whenever the user scrolls past into A or C:

```
if (scrollLeft < oneSet - 60)   scrollLeft += oneSet;  // moved into A → jump to B
if (scrollLeft > 2*oneSet - 60) scrollLeft -= oneSet;  // moved into C → jump to B
```

The container has `scrollBehavior: auto` (instant) so the jump is never visible.
`overscrollBehaviorX: contain` prevents the browser from reaching the absolute edge
and rubber-banding out of the loop.

**Desktop (independent):** Still uses `translateX` + tripled track + `scrollWidth/3`
wrapping (mouse drag + arrow buttons), because `overflow:hidden` lets the mouse events
through cleanly.

**How to apply:** For any horizontally-swipeable strip on mobile in this app, prefer a
native overflow-x scroll container over JS-driven translateX. Reserve JS translateX for
desktop. Scrollbar is hidden via the `.moi-hscroll` utility in index.css.

**Important:** The carousel section is gated behind `!loading`, so any `useEffect` or
`useLayoutEffect` that attaches listeners to the carousel must include `loading` in its
dependency array — otherwise the effect runs on mount when the DOM is null and never
re-runs when the data arrives.
