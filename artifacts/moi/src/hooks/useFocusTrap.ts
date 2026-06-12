import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Traps keyboard focus within `containerRef` while `active` is true.
 * - On activation: moves focus to the first focusable element in the container.
 * - While active: Tab/Shift+Tab cycle wraps within the container.
 * - On deactivation: restores focus to the element that was focused before activation.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  const prevFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;

    prevFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));

    // Move focus into the panel on the next frame so any enter animation
    // doesn't fight the focus call (avoids a flash of empty focus ring).
    const rafId = requestAnimationFrame(() => {
      getFocusables()[0]?.focus();
    });

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = getFocusables();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleTab);
      if (prevFocusRef.current instanceof HTMLElement) {
        prevFocusRef.current.focus();
      }
    };
  }, [active, containerRef]);
}
