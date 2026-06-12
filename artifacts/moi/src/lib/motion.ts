// Shared animation timing tokens for the Moi design system.
// Import these in Framer Motion `transition` props instead of inline values.
// Keep all motion purposeful and consistent — enter/exit curves mirror the
// Material Design easing spec adapted to a luxury fashion pace.

export const ease = {
  enter:  [0.4, 0, 0.2, 1] as [number, number, number, number],
  exit:   [0.4, 0, 1, 0.2] as [number, number, number, number],
  spring: [0.16, 1, 0.3, 1] as [number, number, number, number],
  drawer: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  menu:   [0.76, 0, 0.24, 1] as [number, number, number, number],
  reveal: [0.22, 1, 0.36, 1] as [number, number, number, number],  // energetic reveal — modals + page entries
} as const;

export const dur = {
  instant:     0,
  fastest:     0.1,
  fast:        0.15,
  snappy:      0.18,
  standard:    0.25,
  comfortable: 0.32,
  relaxed:     0.4,
  slow:        0.55,
  gentle:      0.7,
} as const;

// Pre-composed transition objects for the most common patterns.
// Pass these directly to Framer Motion's `transition` prop.
export const transitions = {
  overlay:       { duration: dur.snappy, ease: ease.enter },
  overlayExit:   { duration: 0.14, ease: ease.exit },
  drawer:        { type: "tween" as const, duration: dur.comfortable, ease: ease.drawer },
  menu:          { type: "tween" as const, duration: dur.relaxed, ease: ease.menu },
  accordion:     { duration: 0.28, ease: ease.menu },
  page:          { duration: dur.comfortable, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  fade:          { duration: dur.standard, ease: ease.enter },
  quick:         { duration: dur.fast, ease: ease.enter },
  badge:         { duration: 0.35, ease: ease.enter },
  lookReveal:    { duration: dur.gentle, ease: ease.spring },
  // Header cart icon animations
  pulse:         { duration: 0.45, ease: ease.exit },     // add-to-cart ring expansion
  iconBounce:    { duration: 0.35, ease: ease.exit },     // bag icon bounce on add
  // Cart drawer list item animations
  listExit:      { duration: 0.28, ease: ease.exit },     // item removal
  listLayout:    { layout: { duration: dur.comfortable, ease: ease.enter } },  // relayout on remove
  // Modal / dialog overlays
  modalOverlay:  { duration: dur.standard, ease: ease.enter },                                    // backdrop fade (0.25s)
  modal:         { type: "tween" as const, duration: dur.comfortable, ease: ease.reveal },        // panel entry (0.32s)
  reveal:        { duration: 0.35, ease: ease.reveal },                                            // page content reveal
  departure:     { duration: 0.35, ease: ease.exit },                                              // full-screen overlay fade-in before navigation
  springEntry:   { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.9 },            // springy overlay entry (checkout drawer)
  spinner:       { repeat: Infinity, duration: 1.2, ease: "linear" as const },                   // infinite spinner rotation
  // Stagger list items: pass i = index
  listItem: (i: number) => ({ duration: dur.standard, delay: 0.08 + i * 0.06 }),
} as const;
