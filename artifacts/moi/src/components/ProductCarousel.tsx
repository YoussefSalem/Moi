import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface CarouselItem {
  handle: string;
  name: string;
  color?: string;
  swatch?: string;
  price: string;
  image: string;
}

interface ProductCarouselProps {
  items: CarouselItem[];
  onItemClick: (handle: string) => void;
  heading?: string;
  subheading?: string;
}

const GAP = 20;
const CARD_W = "clamp(160px, 44vw, 260px)";
const SNAP_MS = 380;
const SNAP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// Friction: vel *= FRICTION^dt (dt in ms). 0.990^600 ≈ 0.002 — smooth coast ~600ms.
const FRICTION = 0.990;
const STOP_VEL = 0.02; // px/ms — below this just stop

// ─── Image with shimmer skeleton ────────────────────────────────────────────
function CardImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!loaded && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg,#f0ede8 25%,#e3dfd8 50%,#f0ede8 75%)",
            backgroundSize: "200% 100%",
            animation: "moiCarouselShimmer 1.6s ease-in-out infinite",
          }}
        />
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.35s ease",
          }}
          draggable={false}
          loading="lazy"
        />
      )}
    </div>
  );
}

// ─── Main carousel ───────────────────────────────────────────────────────────
export function ProductCarousel({
  items,
  onItemClick,
  heading = "Curated For You",
  subheading = "You May Also Like",
}: ProductCarouselProps) {
  const N = items.length;

  // Three copies for seamless infinite looping.
  const slides = useMemo(
    () => N > 1 ? [...items, ...items, ...items] : [...items],
    [items, N],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const cardWRef = useRef(0);

  // rawPxRef: absolute px offset — track renders at translateX(-rawPxRef).
  // At rest, always kept within [N·step, 2N·step) via wrapMiddle().
  const rawPxRef = useRef(0);
  const isArrowSnappingRef = useRef(false); // only true during arrow-button snaps
  const rafRef = useRef<number | null>(null);

  // Drag state
  const ptrIdRef = useRef<number | null>(null);
  const startPxRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lockRef = useRef<"h" | "v" | null>(null);
  const didDragRef = useRef(false);

  // Velocity buffer: last 80ms of pointer positions
  const velBufRef = useRef<Array<{ x: number; t: number }>>([]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getStep() { return cardWRef.current + GAP; }

  function measure() {
    const t = trackRef.current;
    return t?.firstElementChild ? (t.firstElementChild as HTMLElement).offsetWidth : 0;
  }

  function rawApply(px: number, animated: boolean) {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animated ? `transform ${SNAP_MS}ms ${SNAP_EASE}` : "none";
    track.style.transform = `translateX(${-px}px)`;
  }

  // Modular wrap into middle-copy range [N·step, 2N·step).
  function wrapMiddle(px: number, step: number): number {
    if (N <= 1 || step === 0) return px;
    const lo = N * step;
    const range = N * step;
    return ((px - lo) % range + range) % range + lo;
  }

  function cancelRaf() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  // Snap to nearest card — used ONLY by arrow buttons.
  function snapNearest() {
    cancelRaf();
    const step = getStep();
    if (step === 0) return;

    const snapped = Math.round(rawPxRef.current / step) * step;
    const wrapped = wrapMiddle(snapped, step);

    if (wrapped !== snapped) {
      rawPxRef.current += wrapped - snapped;
      rawApply(rawPxRef.current, false);
      void trackRef.current?.offsetHeight;
    }

    rawPxRef.current = wrapped;
    isArrowSnappingRef.current = true;
    rawApply(rawPxRef.current, true);

    const track = trackRef.current;
    if (track) {
      const done = () => {
        track.removeEventListener("transitionend", done);
        isArrowSnappingRef.current = false;
      };
      track.addEventListener("transitionend", done, { once: true });
      setTimeout(() => { isArrowSnappingRef.current = false; }, SNAP_MS + 80);
    }
  }

  // Free inertia: exponential friction, stops wherever momentum dies.
  function startInertia(velPxMs: number) {
    cancelRaf();
    const step = getStep();
    if (step === 0) return;

    let vel = velPxMs;
    let lastT: number | null = null;

    function tick(time: number) {
      if (lastT === null) { lastT = time; rafRef.current = requestAnimationFrame(tick); return; }
      const dt = Math.min(time - lastT, 50);
      lastT = time;

      vel *= Math.pow(FRICTION, dt);

      if (Math.abs(vel) < STOP_VEL) {
        // Drift to a stop naturally — no snap
        rafRef.current = null;
        return;
      }

      rawPxRef.current += vel * dt;

      if (N > 1) rawPxRef.current = wrapMiddle(rawPxRef.current, step);

      rawApply(rawPxRef.current, false);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  // Arrow navigation — intentionally snaps to a card boundary
  function goTo(delta: number) {
    if (isArrowSnappingRef.current) return;
    cancelRaf();
    const step = getStep();
    if (step === 0) return;

    const currentSlot = Math.round(rawPxRef.current / step);
    const targetPx = (currentSlot + delta) * step;
    const wrapped = wrapMiddle(targetPx, step);

    if (wrapped !== targetPx) {
      rawPxRef.current += wrapped - targetPx;
      rawApply(rawPxRef.current, false);
      void trackRef.current?.offsetHeight;
    }

    rawPxRef.current = wrapped;
    isArrowSnappingRef.current = true;
    rawApply(rawPxRef.current, true);

    const track = trackRef.current;
    if (track) {
      const done = () => { track.removeEventListener("transitionend", done); isArrowSnappingRef.current = false; };
      track.addEventListener("transitionend", done, { once: true });
      setTimeout(() => { isArrowSnappingRef.current = false; }, SNAP_MS + 80);
    }
  }

  // ── Layout: initialise position and handle resize ─────────────────────────

  useLayoutEffect(() => {
    cardWRef.current = measure();
    const step = getStep();
    rawPxRef.current = N > 1 ? N * step : 0;
    rawApply(rawPxRef.current, false);

    let resizeRaf: number | null = null;
    function onResize() {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        const oldStep = cardWRef.current + GAP;
        const oldSlot = Math.round(rawPxRef.current / oldStep);
        cardWRef.current = measure();
        const newStep = getStep();
        rawPxRef.current = N > 1 ? wrapMiddle(oldSlot * newStep, newStep) : 0;
        rawApply(rawPxRef.current, false);
      });
    }

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
    };
  }, [N]);

  // Wheel / trackpad momentum scroll
  const wheelVelRef = useRef(0);
  const wheelTimerRef = useRef<number | null>(null);

  function onWheel(e: React.WheelEvent) {
    if (N <= 1) return;
    const delta = e.deltaX || e.deltaY;
    if (Math.abs(delta) < 1) return;

    const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5;
    if (isHorizontal) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Interrupt arrow snap
    if (isArrowSnappingRef.current) {
      const track = trackRef.current;
      if (track) {
        const transformStr = window.getComputedStyle(track).transform;
        if (transformStr && transformStr !== "none") {
          const matrix = new DOMMatrix(transformStr);
          rawPxRef.current = -matrix.m41;
          track.style.transition = "none";
          track.style.transform = `translateX(${matrix.m41}px)`;
        }
      }
      isArrowSnappingRef.current = false;
    }
    cancelRaf();

    const step = getStep();
    const newPx = rawPxRef.current + delta;
    rawPxRef.current = N > 1 ? wrapMiddle(newPx, step) : newPx;
    rawApply(rawPxRef.current, false);

    wheelVelRef.current += delta;

    if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);

    wheelTimerRef.current = window.setTimeout(() => {
      const vel = wheelVelRef.current / 16;
      wheelVelRef.current = 0;
      // Hand off to free inertia — no snap
      if (Math.abs(vel) > STOP_VEL * 3) {
        startInertia(vel);
      }
      // else just stop where it is
    }, 80);
  }

  // ── Window-level pointer handlers ─────────────────────────────────────────

  useEffect(() => {
    function onWindowMove(e: PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;

      const dx = e.clientX - startXRef.current;

      if (lockRef.current === null) {
        const dy = e.clientY - startYRef.current;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          lockRef.current = Math.abs(dx) > Math.abs(dy) * 0.8 ? "h" : "v";
        }
        return;
      }
      if (lockRef.current === "v") return;

      e.preventDefault();
      if (Math.abs(dx) > 3) didDragRef.current = true;

      const now = e.timeStamp;
      velBufRef.current.push({ x: e.clientX, t: now });
      const cutoff = now - 80;
      while (velBufRef.current.length > 1 && velBufRef.current[0].t < cutoff) {
        velBufRef.current.shift();
      }

      const newPx = startPxRef.current - dx;
      const step = getStep();

      if (N > 1) {
        const wrapped = wrapMiddle(newPx, step);
        if (wrapped !== newPx) startPxRef.current += wrapped - newPx;
        rawPxRef.current = wrapped;
      } else {
        rawPxRef.current = newPx;
      }

      rawApply(rawPxRef.current, false);
    }

    function onWindowUp(e: PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      ptrIdRef.current = null;

      const wasH = lockRef.current === "h";
      lockRef.current = null;

      if (!wasH) return;

      const buf = velBufRef.current;
      let vel = 0;
      if (buf.length >= 2) {
        const first = buf[0];
        const last = buf[buf.length - 1];
        const dt = last.t - first.t;
        if (dt > 5) vel = -(last.x - first.x) / dt;
      }
      velBufRef.current = [];

      // Hand velocity to free inertia — let momentum coast naturally, no snap
      if (Math.abs(vel) > STOP_VEL) {
        startInertia(vel);
      }
      // else just stop where it is
    }

    function onWindowCancel(e: PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      ptrIdRef.current = null;
      lockRef.current = null;
      velBufRef.current = [];
      // Stop in place — no snap
    }

    window.addEventListener("pointermove", onWindowMove, { passive: false });
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowCancel);
      cancelRaf();
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
    };
  }, [N]);

  // ── Pointer down: freeze mid-transition, start drag ──────────────────────

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (ptrIdRef.current !== null) return;

    cancelRaf();

    // Freeze if an arrow snap is running
    const track = trackRef.current;
    if (track && isArrowSnappingRef.current) {
      const transformStr = window.getComputedStyle(track).transform;
      if (transformStr && transformStr !== "none") {
        const matrix = new DOMMatrix(transformStr);
        rawPxRef.current = -matrix.m41;
        track.style.transition = "none";
        track.style.transform = `translateX(${matrix.m41}px)`;
      }
    }
    isArrowSnappingRef.current = false;

    ptrIdRef.current = e.pointerId;
    startPxRef.current = rawPxRef.current;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockRef.current = null;
    didDragRef.current = false;
    velBufRef.current = [{ x: e.clientX, t: e.timeStamp }];
  }

  if (N === 0) return null;

  return (
    <>
      <style>{`
        @keyframes moiCarouselShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        style={{
          backgroundColor: "#faf8f5",
          borderTop: "1px solid rgba(30,24,20,0.07)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "72px 0 56px 28px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingRight: 28,
              marginBottom: 40,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#7a6e64",
                  marginBottom: 14,
                }}
              >
                {subheading}
              </p>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                  fontWeight: 400,
                  letterSpacing: "0.04em",
                  color: "#1e1814",
                }}
              >
                {heading}
              </h2>
            </div>

            {N > 1 && (
              <div className="hidden md:flex" style={{ gap: 8 }}>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => goTo(-1)}
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid rgba(30,24,20,0.2)",
                    background: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1e1814",
                    borderRadius: 2,
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => goTo(1)}
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid rgba(30,24,20,0.2)",
                    background: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1e1814",
                    borderRadius: 2,
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Carousel track */}
          <div
            style={{
              overflow: "hidden",
              touchAction: "pan-y",
              cursor: N > 1 ? "grab" : "default",
            }}
            onPointerDown={onPointerDown}
            onWheel={onWheel}
          >
            <div
              ref={trackRef}
              style={{
                display: "flex",
                gap: GAP,
                willChange: "transform",
              }}
            >
              {slides.map((item, i) => (
                <button
                  key={`${item.handle}-${i}`}
                  type="button"
                  onClick={() => {
                    if (!didDragRef.current) onItemClick(item.handle);
                  }}
                  draggable={false}
                  style={{
                    flex: `0 0 ${CARD_W}`,
                    width: CARD_W,
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "3/4",
                      overflow: "hidden",
                      marginBottom: 12,
                      backgroundColor: "rgba(30,24,20,0.04)",
                    }}
                  >
                    <CardImage src={item.image} alt={item.name} />
                  </div>

                  {item.color && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      {item.swatch && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: item.swatch,
                            border: "1px solid rgba(30,24,20,0.14)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "#8a7e74",
                        }}
                      >
                        {item.color}
                      </span>
                    </div>
                  )}

                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
                      fontWeight: 300,
                      color: "#1e1814",
                      lineHeight: 1.2,
                      marginBottom: 3,
                    }}
                  >
                    {item.name}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      color: "#7a6e64",
                    }}
                  >
                    {item.price}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
