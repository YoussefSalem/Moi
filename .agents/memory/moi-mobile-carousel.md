---
name: Moi mobile recs carousel
description: Mobile "Curated For You" recs carousel — 3 cards per view, translateX snap + pointer-drag, infinite loop via tripled track
---

# Moi mobile recommendations carousel

The ProductPage "Curated For You" / recs carousel on **mobile** shows **3 cards at a time**
using the same **translateX snap + pointer-drag** interaction as the original 1-card version.

**Why:** History: 1) original unknown; 2) rebuilt as 1-card snap; 3) user wanted 3 cards +
seamless scroll → tried native overflow-x scroll; 4) user rejected it ("same layout/
interactions as 1 card but show 3"). Final: 1-card translateX pattern scaled to 1/3-width cards.

**Implementation:**
- Clip container: `ref={recsScrollMobileRef}`, `overflow:hidden`, `touchAction:"pan-y"`.
- Track: `ref={recsTrackMobileRef}`, `display:flex`, `willChange:transform`. NO transform in
  React JSX style — controlled entirely via direct DOM (`track.style.transform`).
- Cards: tripled `[...recs,...recs,...recs]`, each `flex: 0 0 ${100/3}%`. No gaps.
- Init effect (deps `[isMobile, loading, handle]`): measures `mobileCardWRef.current =
  clip.offsetWidth/3`, sets `track.style.transform = translateX(-N*cardW)`, `setRecsIndex(N)`.
  (N = recs.length = middle set start.)
- Pointer handlers defined inside the recs IIFE (alongside `scrollDesktop`):
  - `onMobileDown`: store `{x, idx}` in `recsDragRef`, clear `recsDidDragRef`, remove transition.
  - `onMobileMove`: if drag exceeds `SWIPE_THRESHOLD=20`, set `recsDidDragRef=true`,
    call `e.preventDefault()`, live-update `track.style.transform` with drag offset.
  - `onMobileUp` (also handles `pointercancel` via `e.type` check): if cancel or no-drag,
    snap back to `startIdx`; if swipe, compute `newIdx = startIdx ± 1`, animate transition,
    add `suppressClick` to window to block accidental nav, `transitionend` handler normalizes
    to middle set and calls `setRecsIndex(newIdx)`.
- Dots: `recsIndex % recs.length` = active dot. Update only after transitionend.
- Loop wrap: after transition, if `newIdx >= 2N` → subtract N; if `newIdx < N` → add N.
  All three sets show identical cards so the silent position jump is invisible.

**Card width:** `clip.offsetWidth / 3` (no gaps). Measured once on init; re-measured on
`handle` change (product navigation). No `recs` in effect deps — `recs` is derived from
`handle`, so handle change always reflects new recs.

**State/refs:**
- `recsScrollMobileRef` — the clip div (overflow:hidden)
- `recsTrackMobileRef` — the flex track (transform controlled via DOM)
- `mobileCardWRef` — card width in px
- `recsDragRef` — `{x,idx}` on pointerdown, null otherwise
- `recsDidDragRef` — true once drag exceeds threshold
- `[recsIndex, setRecsIndex]` — current snap index (0..3N-1, stays in [N, 2N))

**Desktop:** unchanged (grab-drag + arrows + translateX loop).

**Why translateX not native scroll:** ProductPage renders inside `position:fixed;
overflow-y:auto` overlay (#product-scroll-container). Native overflow-x scrolling inside
this overlay previously failed to swipe on real iOS (touch listener swallowed). translateX
with pointer events and `touchAction:"pan-y"` on the clip is the reliable pattern.

**iOS — verify on a REAL device.** The `transitionend` wrap reposition is a direct DOM write
mid-momentum. In practice it fires only after the CSS transition completes (not during fling),
so it's safer than the native-scroll approach. But always confirm on hardware before closing
carousel work.

**How to apply:** For this carousel, always use translateX + pointer handlers + `touchAction:
pan-y` clip container. Do NOT use native overflow-x scroll inside the fixed product overlay.
