---
name: Moi mobile recs carousel
description: Mobile "Curated For You" recs carousel — 3 cards per view, seamless infinite loop via native horizontal scroll + tripled-set wrap
---

# Moi mobile recommendations carousel

The ProductPage "Curated For You" / recs carousel on **mobile** shows **3 cards at a
time** in a **native horizontal scroll** container with a **seamless infinite loop**.

**Why:** Evolved across two user requests. First the user rejected duplicated/tripled
cards and wanted one card per view (index-wrap). Then the user changed direction: they
want **3 cards visible AND seamless scrolling**. A seamless infinite loop inherently
repeats items, so the no-duplicate constraint no longer applies — "seamless" (continuous
momentum scroll, no jarring rewind/snap) is the governing requirement now.

**Implementation (mobile):**
- Native scroll: `overflow-x:auto`, `-webkit-overflow-scrolling:touch`,
  `overscrollBehaviorX:contain`, scrollbar hidden via `.moi-hscroll` (index.css).
- Cards rendered THREE times `[...recs,...recs,...recs]`. Each slide wrapper is
  `flex: 0 0 calc((100% - 24px)/3 - 10px)` with `gap:12` → 3 cards fit with a small peek
  of the 4th (peek signals scrollability). `renderCard(rec,key,true)` → card width 100%.
- Infinite wrap (effect, deps `[isMobile, loading, handle]`): measure one set's period
  EXACTLY from the DOM as `children[recs.length].offsetLeft - children[0].offsetLeft`.
  Do NOT use `scrollWidth/3` — `gap` (and any container padding) inflate scrollWidth so
  `scrollWidth/3` overshoots the true period by ~5px, producing a visible jitter at every
  loop boundary. On mount `scrollLeft = period` (middle set). On scroll (rAF-throttled):
  if `scrollLeft < period*0.5` add `period`, else if `> period*1.5` subtract `period`.
  Corrections are exactly one identical-set width → invisible, and never reach the hard
  edges (no rubber-band blank). `handle` is in deps so navigating to another product
  re-runs the effect (resets to the middle set + re-measures). Browser handles momentum,
  tap-vs-swipe, and axis disambiguation — so NO custom pointer handlers and NO tap
  suppression are needed (a click never fires after a scroll gesture). No `paddingRight`
  on the container: the right end is never reached in a loop, so it only confused the math.

**Why native scroll (not custom JS touch):** A prior custom-touch carousel here
"repeatedly failed to swipe on real iOS." ProductPage renders inside a `position:fixed;
overflow-y:auto` overlay (`#product-scroll-container`, see moi-ios-back-gesture) whose
scroll heuristic swallows raw touch listeners. Native overflow-x scroll is the robust,
iOS-reliable pattern; reserve JS translateX for desktop where `overflow:hidden` passes
mouse events cleanly.

**iOS — verify on a REAL device before declaring carousel work done.** Assigning
`scrollLeft` mid-momentum can cancel the fling on some iOS Safari versions (scroll stops
dead at a wrap boundary). A desktop screenshot cannot prove the loop is smooth — always
have the user confirm continuous looping on a real iPhone. (Native scroll is reliable for
*touch input*; the *programmatic reposition during momentum* is the part that needs hardware
verification.)

**Desktop (independent, UNCHANGED):** `translateX` + tripled track + `scrollWidth/3`
wrapping, mouse grab-drag + arrow buttons. Multiple cards in a continuous loop.

**How to apply:** For a multi-card seamless looping mobile strip here, use native
overflow-x scroll + tripled set + scrollLeft wrap. Do NOT use custom pointer handlers,
and do NOT one-card-per-view paging unless the user explicitly asks for snapping.

**Important:** The carousel section is gated behind `!loading`; any effect that measures
or attaches to carousel DOM must include `loading` in its dep array. `useLayoutEffect`
must be imported from "react" (a missing import crashes the whole ProductPage).
