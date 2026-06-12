---
name: Moi motion token system
description: Shared animation tokens in src/lib/motion.ts; MotionConfig, focus trap pattern, and ARIA setup for overlay drawers.
---

## Rule
All Framer Motion `transition` props in Moi components must use tokens from `@/lib/motion` (`ease`, `dur`, `transitions`). Never add bare inline `{ duration: N, ease: [...] }` objects to a component — add a named token to `motion.ts` instead, so timing can be tuned in one place.

**Why:** Scattered inline values made animation timing inconsistent across the site (overlay: 0.18 in one place, 0.3 in another; drawer: 0.32 vs 0.4, etc). Centralising ensures the UX has a coherent rhythm.

**How to apply:**
1. If a suitable token already exists in `transitions`, use it.
2. If not, add a new named constant to `motion.ts` with a comment explaining what it animates.
3. Never delete existing tokens — mark unused ones with a comment.

## MotionConfig
`MotionConfig reducedMotion="user"` wraps the entire App (in `App.tsx` around the provider tree). This automatically respects the OS `prefers-reduced-motion` setting for ALL Framer Motion animations without per-component checks.

## Focus trap pattern
`useFocusTrap(containerRef, active)` in `src/hooks/useFocusTrap.ts`:
- Saves previously focused element on activation
- Moves focus to first focusable in container (via rAF to avoid race with enter animation)
- Wraps Tab/Shift+Tab within the container's focusable elements
- Restores previous focus on deactivation

Apply to every overlay component (drawers, modals, lightboxes) — any element that renders above the main page content and intercepts user interaction requires this treatment.

## ARIA for overlay drawers
Overlay drawers/modals use:
- `role="dialog" aria-modal="true"` on the panel element
- `aria-label="<descriptive name>"` on the panel
- `aria-hidden="true"` on the backdrop scrim
- `aria-expanded` + `aria-controls` + `id` on accordion triggers
- `role="region"` + `aria-labelledby` on accordion panels
