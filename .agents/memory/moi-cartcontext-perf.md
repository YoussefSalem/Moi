---
name: Moi CartContext performance pattern
description: How CartContext is memoized and which components are wrapped in React.memo to prevent jank.
---

## Rules

1. **CartContext value must be `useMemo`-wrapped** — bare object literal in `<CartContext.Provider value={...}>` creates a new reference every render, causing all `useCart()` consumers (Header, ColorCard parents, CheckoutPage, etc.) to re-render on every cart state change, even unrelated ones like `loading` toggling.

2. **Inline callbacks in the context value must be `useCallback`** — `openCart`, `closeCart`, `closeCheckout` were originally inline lambdas inside the value object; move them to named `useCallback`s before the `return` so their refs are stable and don't invalidate the `useMemo` unnecessarily.
   - `openCart` deps: `[shopifyCart, localItems]` (reads both)
   - `closeCart` deps: `[]` (only calls `setCartOpen`)
   - `closeCheckout` deps: `[]` (only calls setters + window ops)
   - `openCheckout` is already a `useCallback` at the bottom of CartProvider (leave it)

3. **ColorCard must be `memo`-wrapped** — it's rendered in a grid from a CartContext consumer; without memo it re-renders on every cart tick. Syntax: `export const ColorCard = memo(function ColorCard({...}: ColorCardProps) {...});` (named function expression inside memo preserves display name).

4. **`handleColorCardAddToCart` must be `useCallback`** — it's passed as `onAddToCart` prop to ColorCard; an unstable ref defeats ColorCard's memo. Deps: `[products, cart.addToCart]`. Use `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line above the deps array since the linter sees `cart` but only `cart.addToCart` is listed.

5. **Font loading gate** — `document.fonts.ready` must be included in the `assetsReady` counter in App.tsx so the loading screen never exits before fonts are rendered. Pattern: start `remaining = list.length + 1`; call `document.fonts.ready.then(() => { if (!cancelled) markDone(); })` in parallel with image preloads. The 7s safety timeout still fires as a fallback.

**Why:** Without these, every `addToCart` call triggers `isAddingToCart` state → CartProvider re-render → new context value object → all consumers re-render → ColorCard grid re-renders even for items not in the section, causing visible frame drops on mobile.

**How to apply:** Any time CartContext is modified to add new state or callbacks: (a) add new callbacks as `useCallback` before the `return`; (b) add them to the `useMemo` deps array; (c) verify ColorCard and any other hot-path grid components remain `memo`-wrapped.
