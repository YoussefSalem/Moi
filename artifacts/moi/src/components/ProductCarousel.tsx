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
const SNAP_MS = 300;
// Continuous scroll speed on mobile (px/s). At 144fps each frame moves ~0.21px.
const MOBILE_SCROLL_PX_PER_S = 30;

// ─── Card image with shimmer skeleton ────────────────────────────────────────
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
            background:
              "linear-gradient(90deg,#f0ede8 25%,#e3dfd8 50%,#f0ede8 75%)",
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

// ─── Main component ───────────────────────────────────────────────────────────
export function ProductCarousel({
  items,
  onItemClick,
  heading = "Curated For You",
  subheading = "You May Also Like",
}: ProductCarouselProps) {
  const N = items.length;

  const slides = useMemo(
    () => (N > 1 ? [items[N - 1], ...items, items[0]] : items),
    [items, N],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const rawIdxRef = useRef(N > 1 ? 1 : 0);
  const settlingRef = useRef(false);
  const cardWRef = useRef(0);

  // Continuous-scroll state (mobile only)
  const subOffsetRef = useRef(0); // sub-step offset in px (0 → cardW+GAP)
  const rafRef = useRef<number | null>(null);
  const lastRafTimeRef = useRef<number | null>(null);
  const isMobileRef = useRef(false);

  // Drag state
  const ptrIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTRef = useRef(0);
  const lockRef = useRef<"h" | "v" | null>(null);
  const didDragRef = useRef(false);
  // Sub-offset frozen at drag start so drag delta applies on top
  const dragBaseSubRef = useRef(0);

  function measure(): number {
    const t = trackRef.current;
    if (!t?.firstElementChild) return 0;
    return (t.firstElementChild as HTMLElement).offsetWidth;
  }

  function applyTransformRaw(totalDx: number, animated: boolean) {
    const track = trackRef.current;
    if (!track) return;
    const cw = cardWRef.current || measure();
    if (cw === 0) return;
    cardWRef.current = cw;
    const step = cw + GAP;
    track.style.transition = animated
      ? `transform ${SNAP_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
      : "none";
    track.style.transform = `translateX(${-(rawIdxRef.current * step) + totalDx}px)`;
  }

  // For snap actions (landOn, resize): always uses current subOffset = 0
  function applyTransform(animated: boolean) {
    applyTransformRaw(0, animated);
  }

  useLayoutEffect(() => {
    cardWRef.current = measure();
    applyTransform(false);

    function onResize() {
      cardWRef.current = measure();
      applyTransform(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [N]);

  function landOn(newRaw: number) {
    if (N <= 1) return;
    subOffsetRef.current = 0;
    rawIdxRef.current = newRaw;
    settlingRef.current = true;
    applyTransform(true);

    const track = trackRef.current;
    if (!track) return;

    const cleanup = () => {
      track.removeEventListener("transitionend", cleanup);
      settlingRef.current = false;
      if (newRaw === 0) {
        rawIdxRef.current = N;
        applyTransform(false);
      } else if (newRaw === N + 1) {
        rawIdxRef.current = 1;
        applyTransform(false);
      }
    };
    track.addEventListener("transitionend", cleanup, { once: true });
    setTimeout(() => { if (settlingRef.current) cleanup(); }, SNAP_MS + 80);
  }

  // ── Continuous mobile scroll via requestAnimationFrame ───────────────────
  useEffect(() => {
    const checkMobile = () => { isMobileRef.current = window.matchMedia("(max-width: 767px)").matches; };
    checkMobile();
    const mq = window.matchMedia("(max-width: 767px)");
    const mqHandler = (e: MediaQueryListEvent) => { isMobileRef.current = e.matches; };
    mq.addEventListener("change", mqHandler);

    function tick(time: number) {
      rafRef.current = requestAnimationFrame(tick);

      if (!isMobileRef.current || N <= 1) {
        lastRafTimeRef.current = null;
        return;
      }
      // Pause during drag or CSS snap transition
      if (ptrIdRef.current !== null || settlingRef.current) {
        lastRafTimeRef.current = null;
        return;
      }

      if (lastRafTimeRef.current === null) {
        lastRafTimeRef.current = time;
        return;
      }

      const dt = Math.min(time - lastRafTimeRef.current, 50); // cap for tab-wake scenarios
      lastRafTimeRef.current = time;

      const cw = cardWRef.current;
      if (cw === 0) return;
      const step = cw + GAP;

      subOffsetRef.current += MOBILE_SCROLL_PX_PER_S * (dt / 1000);

      // Advance to next card when sub-offset exceeds one step
      if (subOffsetRef.current >= step) {
        subOffsetRef.current -= step;
        rawIdxRef.current += 1;
        // Silently wrap: ghost of first → real first
        if (rawIdxRef.current === N + 1) {
          rawIdxRef.current = 1;
        }
      }

      const track = trackRef.current;
      if (!track) return;
      track.style.transition = "none";
      track.style.transform = `translateX(${-(rawIdxRef.current * step) - subOffsetRef.current}px)`;
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mq.removeEventListener("change", mqHandler);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [N]);

  // ── Window-level pointer listeners (drag handling) ───────────────────────
  useEffect(() => {
    function onWindowMove(e: PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      if (lockRef.current === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          lockRef.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? "h" : "v";
        }
        return;
      }
      if (lockRef.current === "v") return;
      if (Math.abs(dx) > 5) didDragRef.current = true;
      e.preventDefault();

      const cw = cardWRef.current;
      if (cw > 0) {
        const step = cw + GAP;
        const track = trackRef.current;
        if (track) {
          track.style.transition = "none";
          // Base position includes the sub-offset frozen at drag start
          track.style.transform = `translateX(${-(rawIdxRef.current * step) - dragBaseSubRef.current + dx}px)`;
        }
      }
    }

    function onWindowUp(e: PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      const wasH = lockRef.current === "h";
      ptrIdRef.current = null;
      lockRef.current = null;

      if (!wasH) {
        // Not a horizontal drag — snap back to current card, native click fires normally
        subOffsetRef.current = 0;
        applyTransform(false);
        return;
      }

      const cw = cardWRef.current;
      if (cw === 0) return;
      const step = cw + GAP;

      // Effective drag delta accounting for sub-offset
      const rawDx = e.clientX - startXRef.current;
      const effectiveDx = rawDx - dragBaseSubRef.current; // normalise: positive = moved right
      const dt = Math.max(e.timeStamp - startTRef.current, 1);

      if (Math.abs(rawDx) > 40 || Math.abs(rawDx) / dt > 0.35) {
        // Flick — snap to next/prev card
        // Determine target based on effective position
        const currentOffset = -(rawIdxRef.current * step) - dragBaseSubRef.current + rawDx;
        const snapIdx = Math.round(-currentOffset / step);
        const clamped = Math.max(0, Math.min(N + 1, snapIdx));
        subOffsetRef.current = 0;
        landOn(clamped !== rawIdxRef.current ? clamped : rawIdxRef.current + (rawDx < 0 ? 1 : -1));
      } else {
        // No flick — snap back
        subOffsetRef.current = 0;
        applyTransform(false);
        const track = trackRef.current;
        if (track) {
          settlingRef.current = true;
          track.style.transition = `transform ${SNAP_MS}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
          track.style.transform = `translateX(${-(rawIdxRef.current * step)}px)`;
          const done = () => {
            track.removeEventListener("transitionend", done);
            settlingRef.current = false;
          };
          track.addEventListener("transitionend", done, { once: true });
          setTimeout(() => { if (settlingRef.current) done(); }, SNAP_MS + 80);
        }
      }
    }

    function onWindowCancel(e: PointerEvent) {
      if (ptrIdRef.current !== e.pointerId) return;
      ptrIdRef.current = null;
      lockRef.current = null;
      subOffsetRef.current = 0;
      applyTransform(false);
    }

    window.addEventListener("pointermove", onWindowMove, { passive: false });
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowCancel);
    };
  }, [N]);

  function onPointerDown(e: React.PointerEvent) {
    if (settlingRef.current || ptrIdRef.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Freeze the current sub-offset so drag starts from the exact visual position
    dragBaseSubRef.current = subOffsetRef.current;
    ptrIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTRef.current = e.timeStamp;
    lockRef.current = null;
    didDragRef.current = false;
  }

  if (N === 0) return null;

  return (
    <>
      {/* Keyframes injected once — shimmer + (unused outside this component) */}
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
          {/* Section header */}
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

            {/* Arrows — desktop only (hidden on mobile via Tailwind; no inline display override) */}
            {N > 1 && (
              <div className="hidden md:flex" style={{ gap: 8 }}>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => !settlingRef.current && landOn(rawIdxRef.current - 1)}
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
                  onClick={() => !settlingRef.current && landOn(rawIdxRef.current + 1)}
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
            style={{ overflow: "hidden", touchAction: "pan-y", cursor: N > 1 ? "grab" : "default" }}
            onPointerDown={onPointerDown}
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
