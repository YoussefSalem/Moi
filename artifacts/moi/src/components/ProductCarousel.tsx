import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { ProductPage } from "@/pages/ProductPage";
import type { ProductConfig } from "@/config/images";

const SNAP_MS = 300;

export interface ProductCarouselHandle {
  jumpTo: (handle: string) => void;
}

interface Props {
  products: ProductConfig[];
  initialHandle: string;
  onBack: () => void;
  onProductChange?: (handle: string) => void;
}

// Maps a raw slide index (in the ghost-padded array) to a real product index 0..N-1
function toProductIdx(rawIdx: number, N: number): number {
  if (rawIdx === 0) return N - 1;
  if (rawIdx === N + 1) return 0;
  return rawIdx - 1;
}

export const ProductCarousel = forwardRef<ProductCarouselHandle, Props>(
  function ProductCarousel({ products, initialHandle, onBack, onProductChange }, ref) {
    const N = products.length;

    // Slides: [ghost_last, p0, p1, …, pN-1, ghost_first]
    const slides = useMemo(
      () => [products[N - 1], ...products, products[0]],
      [products, N],
    );

    // Initial raw index based on handle — only used once at mount
    const initialRaw = useMemo(() => {
      const idx = products.findIndex(
        (p) => initialHandle === p.slug || initialHandle.startsWith(p.slug + "-"),
      );
      return idx >= 0 ? idx + 1 : 1;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally run once

    // ── Imperative refs — no React state to avoid re-render conflicts ─────────
    const trackRef = useRef<HTMLDivElement>(null);
    const rawIdxRef = useRef(initialRaw);
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Gesture state — all refs for zero-allocation pointer handling
    const ptrIdRef = useRef<number | null>(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const startTRef = useRef(0);
    const lockRef = useRef<"h" | "v" | null>(null);
    const settlingRef = useRef(false);

    // ── Transform helpers ────────────────────────────────────────────────────
    function applyTransform(dx: number, animated: boolean) {
      const track = trackRef.current;
      if (!track) return;
      track.style.transition = animated
        ? `transform ${SNAP_MS}ms cubic-bezier(0.25,0.46,0.45,0.94)`
        : "none";
      track.style.transform = `translateX(calc(${-rawIdxRef.current * 100}vw + ${dx}px))`;
    }

    // Set initial position synchronously before first paint (no React state involved)
    useLayoutEffect(() => {
      applyTransform(0, false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Swipe commit ─────────────────────────────────────────────────────────
    function landOn(newRaw: number) {
      rawIdxRef.current = newRaw;
      settlingRef.current = true;
      applyTransform(0, true);

      const productIdx = toProductIdx(newRaw, N);
      onProductChange?.(products[productIdx].slug);
      window.history.replaceState(null, "", `/products/${products[productIdx].slug}`);

      const track = trackRef.current;
      if (!track) return;

      const cleanup = () => {
        track.removeEventListener("transitionend", cleanup);
        settlingRef.current = false;

        // Ghost → real equivalent: instant jump with no animation
        if (newRaw === 0) {
          rawIdxRef.current = N;
          applyTransform(0, false);
        } else if (newRaw === N + 1) {
          rawIdxRef.current = 1;
          applyTransform(0, false);
        }

        // Scroll the newly active slide to top
        const realEl = slideRefs.current[rawIdxRef.current];
        if (realEl) realEl.scrollTop = 0;
      };

      track.addEventListener("transitionend", cleanup, { once: true });
      // Safety fallback if transitionend never fires
      setTimeout(() => { if (settlingRef.current) cleanup(); }, SNAP_MS + 80);
    }

    // ── Pointer event handlers ───────────────────────────────────────────────
    function handlePointerDown(e: React.PointerEvent) {
      if (e.clientX < 16) return; // iOS back-swipe zone — let browser handle
      if ((e.target as Element).closest("[data-no-carousel]")) return;
      if (settlingRef.current) return;
      if (ptrIdRef.current !== null) return; // already tracking a pointer

      ptrIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startTRef.current = e.timeStamp;
      lockRef.current = null;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: React.PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      if (lockRef.current === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          // Require clearly horizontal (1.5× ratio) to avoid competing with vertical scroll
          lockRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
        }
        return;
      }

      if (lockRef.current === "v") return;

      // Horizontal: follow finger directly, no transition
      applyTransform(dx, false);
    }

    function handlePointerUp(e: React.PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      ptrIdRef.current = null;

      if (lockRef.current !== "h") {
        lockRef.current = null;
        return;
      }
      lockRef.current = null;

      const dx = e.clientX - startXRef.current;
      const dt = Math.max(e.timeStamp - startTRef.current, 1);
      const velocity = Math.abs(dx) / dt; // px/ms

      if (Math.abs(dx) > 30 || velocity > 0.3) {
        landOn(rawIdxRef.current + (dx < 0 ? 1 : -1));
      } else {
        // Snap back to current slide
        settlingRef.current = true;
        applyTransform(0, true);
        const track = trackRef.current;
        if (track) {
          const done = () => {
            track.removeEventListener("transitionend", done);
            settlingRef.current = false;
          };
          track.addEventListener("transitionend", done, { once: true });
          setTimeout(() => { if (settlingRef.current) done(); }, SNAP_MS + 80);
        }
      }
    }

    function handlePointerCancel(e: React.PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      ptrIdRef.current = null;
      lockRef.current = null;
      applyTransform(0, false);
    }

    // ── Imperative handle — called by App.tsx navigateToProduct ──────────────
    useImperativeHandle(ref, () => ({
      jumpTo(handle: string) {
        const idx = products.findIndex(
          (p) => handle === p.slug || handle.startsWith(p.slug + "-"),
        );
        if (idx < 0) return;
        rawIdxRef.current = idx + 1;
        applyTransform(0, false);
        const el = slideRefs.current[idx + 1];
        if (el) el.scrollTop = 0;
      },
    }));

    // ── Render ───────────────────────────────────────────────────────────────
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          touchAction: "pan-y",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/*
          Track — no transform in React style! Position is driven exclusively
          by applyTransform() to avoid React re-renders resetting the offset.
        */}
        <div
          ref={trackRef}
          style={{
            display: "flex",
            height: "100%",
            willChange: "transform",
          }}
        >
          {slides.map((product, i) => {
            const isGhost = i === 0 || i === N + 1;
            return (
              <div
                key={`${product.slug}-${i}`}
                ref={(el) => { slideRefs.current[i] = el; }}
                style={{
                  width: "100vw",
                  height: "100%",
                  flexShrink: 0,
                  overflowY: isGhost ? "hidden" : "auto",
                  overflowX: "hidden",
                  position: "relative",
                }}
              >
                {isGhost ? (
                  // Lightweight ghost — only visible for ~300ms during infinite-loop
                  // transitions; shows the product hero image at the top.
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#faf8f5",
                      backgroundImage: product.productShot
                        ? `url(${product.productShot})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "top center",
                    }}
                  />
                ) : (
                  <ProductPage
                    handle={product.slug}
                    onBack={onBack}
                    onNavigate={(handle) => {
                      const idx = products.findIndex(
                        (p) => handle === p.slug || handle.startsWith(p.slug + "-"),
                      );
                      if (idx >= 0) {
                        rawIdxRef.current = idx + 1;
                        applyTransform(0, false);
                        const el = slideRefs.current[idx + 1];
                        if (el) el.scrollTop = 0;
                        onProductChange?.(products[idx].slug);
                        window.history.replaceState(null, "", `/products/${products[idx].slug}`);
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
