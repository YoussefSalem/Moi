---
name: Moi mobile recs carousel
description: Why the "Curated For You" recs carousel uses native scroll on mobile, not custom JS touch handling
---

# Moi mobile recommendations carousel

The ProductPage "Curated For You" / recs carousel uses a **native horizontal scroll
container** on mobile (`overflow-x:auto` + `-webkit-overflow-scrolling:touch` +
`scroll-snap-type:x proximity`), NOT custom JS touch handlers or rAF auto-scroll.

**Why:** Custom rAF/translateX + manual touchstart/move/end handling repeatedly failed
to swipe on real iOS devices. Root cause: the product page is a `position:fixed;
overflow-y:auto` overlay (see moi-ios-back-gesture). A carousel nested inside that
scroll container has its touch events swallowed by iOS's scroll heuristic before the
JS listeners fire — moving listeners to the outer container and adding `touch-action:
pan-y` + direction detection still wasn't reliable. Native scroll containers are the
only robust pattern here: the browser handles momentum, tap-vs-swipe, and
horizontal-vs-vertical disambiguation itself, identically on iOS and Android.

**How to apply:** For any horizontally-swipeable strip on mobile in this app, prefer a
native overflow-x scroll container over JS-driven translateX. Reserve JS translateX for
desktop (mouse drag + arrow buttons), which the recs carousel still uses via `isMobile`
branching. Scrollbar is hidden via the `.moi-hscroll` utility in index.css. Cards carry
`scrollSnapAlign:"start"`. Mobile shows recs once (finite scroll); desktop triples the
track for an infinite translateX loop.
