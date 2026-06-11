import { useLayoutEffect, useMemo, useRef } from "react";

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

  const ptrIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTRef = useRef(0);
  const lockRef = useRef<"h" | "v" | null>(null);
  const didDragRef = useRef(false);

  function measure(): number {
    const t = trackRef.current;
    if (!t?.firstElementChild) return 0;
    return (t.firstElementChild as HTMLElement).offsetWidth;
  }

  function applyTransform(dx: number, animated: boolean) {
    const track = trackRef.current;
    if (!track) return;
    const cw = cardWRef.current || measure();
    if (cw === 0) return;
    cardWRef.current = cw;
    const step = cw + GAP;
    track.style.transition = animated
      ? `transform ${SNAP_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
      : "none";
    track.style.transform = `translateX(${-(rawIdxRef.current * step) + dx}px)`;
  }

  useLayoutEffect(() => {
    cardWRef.current = measure();
    applyTransform(0, false);

    function onResize() {
      cardWRef.current = measure();
      applyTransform(0, false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [N]);

  function landOn(newRaw: number) {
    if (N <= 1) return;
    rawIdxRef.current = newRaw;
    settlingRef.current = true;
    applyTransform(0, true);

    const track = trackRef.current;
    if (!track) return;

    const cleanup = () => {
      track.removeEventListener("transitionend", cleanup);
      settlingRef.current = false;
      if (newRaw === 0) {
        rawIdxRef.current = N;
        applyTransform(0, false);
      } else if (newRaw === N + 1) {
        rawIdxRef.current = 1;
        applyTransform(0, false);
      }
    };
    track.addEventListener("transitionend", cleanup, { once: true });
    setTimeout(() => { if (settlingRef.current) cleanup(); }, SNAP_MS + 80);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (settlingRef.current || ptrIdRef.current !== null) return;
    ptrIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTRef.current = e.timeStamp;
    lockRef.current = null;
    didDragRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
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
    applyTransform(dx, false);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (ptrIdRef.current !== e.pointerId) return;
    ptrIdRef.current = null;

    const wasH = lockRef.current === "h";
    const wasDrag = didDragRef.current;
    lockRef.current = null;

    // Clean tap (no meaningful movement) — fire navigation directly here
    // because setPointerCapture suppresses the native click on child buttons.
    if (!wasH && !wasDrag) {
      const btn = (e.target as HTMLElement).closest("[data-handle]") as HTMLElement | null;
      if (btn?.dataset.handle) onItemClick(btn.dataset.handle);
      return;
    }

    if (!wasH) return; // vertical scroll — no snap needed

    const dx = e.clientX - startXRef.current;
    const dt = Math.max(e.timeStamp - startTRef.current, 1);

    if (Math.abs(dx) > 40 || Math.abs(dx) / dt > 0.35) {
      landOn(rawIdxRef.current + (dx < 0 ? 1 : -1));
    } else {
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

  function onPointerCancel(e: React.PointerEvent) {
    if (ptrIdRef.current !== e.pointerId) return;
    ptrIdRef.current = null;
    lockRef.current = null;
    applyTransform(0, false);
  }

  if (N === 0) return null;

  return (
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

          {/* Desktop arrow buttons */}
          {N > 1 && (
            <div
              style={{
                display: "flex",
                gap: 8,
              }}
              className="hidden md:flex"
            >
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
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
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
                data-handle={item.handle}
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
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        pointerEvents: "none",
                      }}
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                </div>

                {item.color && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 5,
                    }}
                  >
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
  );
}
