---
name: Moi mobile recs carousel
description: Mobile "Curated For You" recs carousel — true infinite loop via index-wrap, ONE card per view, no duplicate cards in the DOM
---

# Moi mobile recommendations carousel

The ProductPage "Curated For You" / recs carousel on **mobile** shows **one full-width
card per view** and loops by wrapping an integer index — it renders a **single set of
cards** (exactly `recs.length`), with **no duplicated/tripled cards** in the DOM.

**Why:** The user explicitly rejected the tripled-cards approach (seeing repeated items
in sequence). Requirement: one set of cards; swipe left past the last → first, swipe
right past the first → last; smooth native-feeling touch both directions.

**Implementation (mobile):**
- Viewport `div` (`overflow:hidden; touchAction:"pan-y"`) wraps an inner track
  (`recsTrackMobileRef`, `display:flex`). Each slide is `flex:0 0 100%`, so the track
  box width equals the viewport and `translateX(-index*100%)` advances exactly one card.
  Do NOT give the track `width:max-content` — that breaks the `%` math.
- Pointer handlers (`onPointerDown/Move/Up/Cancel`) on the viewport, NOT native scroll.
  Down: store `{startX,startY,dx,active,decided,horizontal}` in `recsDragRef`, set
  `transition:"none"`, reset `recsDidDragRef=false`. Move: decide axis at ~6px; if
  horizontal set `recsDidDragRef=true` + `setPointerCapture`, drag track imperatively
  with `translateX(calc(-index*100% + dx))` (rubber-band 0.35× at first/last edge).
  Up: restore transition; if horizontal & |dx|>45 call `goTo(index±1)` (modulo wrap);
  else snap back.
- `goTo = i => setRecsIndex(((i%N)+N)%N)`. The index state change re-renders and React
  re-applies `transform: translateX(-index*100%)` WITH the transition → smooth animate
  (last→first is an animated rewind sweep, which reads as intentional).
- Tap-vs-swipe: `openGallery` early-returns when `recsDidDragRef.current` is true so a
  swipe never opens the lightbox. Must reset `recsDidDragRef=false` on every pointerdown
  (a swipe with no trailing click otherwise suppresses the next genuine tap).
- Pagination dots below mirror the main gallery dots (active dot widens to 18px).

**Desktop (independent, UNCHANGED):** still uses `translateX` + tripled track +
`scrollWidth/3` wrapping (mouse drag + arrow buttons). Desktop shows MULTIPLE cards in a
continuous loop where duplicates are invisible and seamless; the no-duplicate constraint
was a mobile-only complaint, so desktop tripling was intentionally left in place.

**How to apply:** For a one-card-per-view looping mobile carousel here, use index-wrap +
`flex:0 0 100%` slides + pointer handlers, NOT native overflow scroll and NOT duplicated
slides. Reserve the tripled-track translateX pattern for multi-card desktop strips.

**iOS CAUTION (unresolved root cause — verify on a real device):** ProductPage renders
inside a `position:fixed; overflow-y:auto` overlay (`#product-scroll-container`, see
moi-ios-back-gesture). A PRIOR custom-touch carousel here "repeatedly failed to swipe on
real iOS" because iOS's scroll heuristic swallowed raw `touchstart/move/end` before the
JS fired. The current rewrite uses **Pointer Events + `touchAction:"pan-y"` +
`setPointerCapture`**, which is materially more robust than raw touch listeners — but a
desktop screenshot CANNOT prove iOS swipe works. If it fails again, the symptom is
`pointercancel` firing early mid-swipe. Always have the user confirm swipe on their
actual phone before closing carousel work; do not declare done on visual inspection.

**Important:** The carousel section is gated behind `!loading`; any effect that measures
or attaches to carousel DOM must include `loading` in its dep array. `useLayoutEffect`
must be imported from "react" (a missing import crashes the whole ProductPage).
