import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { motion, useMotionValue, useMotionValueEvent, animate } from "framer-motion";
import type { ReviewsPaginationState } from "./useReviewsPagination";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: number;
  author: string;
  title: string;
  body: string | null;
  rating: number;
  date: string;
  verified?: boolean;
}

interface ProductReviewsProps extends ReviewsPaginationState {
  onWriteReview: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Card width = 76% of container → side peek = 50% - 73% + 38% = 15%
const CARD_W_RATIO = 0.76;
const STEP_RATIO   = 0.73;   // distance between card centers / container width
const SCALE_CENTER = 0.95;
const SCALE_SIDE   = 0.85;
const OPACITY_CENTER = 1;
const OPACITY_SIDE   = 0.46;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StarRow({ filled, size = 14 }: { filled: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 12 12">
          <path
            d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z"
            fill={s <= filled ? "#1e1814" : "rgba(30,24,20,0.16)"}
          />
        </svg>
      ))}
    </div>
  );
}

function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <>
      <style>{`@keyframes _moi_spin{to{transform:rotate(360deg)}}`}</style>
      <div
        role="status"
        aria-label="Loading reviews"
        style={{
          width: size,
          height: size,
          border: "1.5px solid rgba(30,24,20,0.14)",
          borderTopColor: "#1e1814",
          borderRadius: "50%",
          animation: "_moi_spin 0.75s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

interface CarouselProps {
  reviews: ReviewItem[];
  batchBase: number;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

function ReviewCarousel({
  reviews,
  batchBase,
  hasMore,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
}: CarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  // Single motion value drives the entire carousel
  const trackX = useMotionValue(0);
  const snapAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  // Refs for stable closures in event handlers
  const activeIdxRef   = useRef(0);
  activeIdxRef.current = activeIdx;
  const reviewsRef     = useRef(reviews);
  reviewsRef.current   = reviews;
  const containerWRef  = useRef(0);
  containerWRef.current = containerW;

  // Imperative card DOM refs (Map to handle dynamic list)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Pointer drag state
  const pointerRef = useRef<{
    startX: number;
    startY: number;
    startTrackX: number;
    pointerId: number;
    el: HTMLDivElement;
    captured: boolean;
  } | null>(null);
  const velSamples = useRef<Array<{ t: number; x: number }>>([]);

  // ── Geometry helpers ────────────────────────────────────────────────────────

  const restX = useCallback(
    (idx: number) => {
      const CW   = containerWRef.current;
      const STEP = CW * STEP_RATIO;
      const CW76 = CW * CARD_W_RATIO;
      return CW / 2 - CW76 / 2 - idx * STEP;
    },
    [],
  );

  // ── Measure container (synchronous before first paint) ─────────────────────

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    containerWRef.current = w;
    setContainerW(w);
    trackX.set(restX(0)); // position instantly — no spring on initial mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      containerWRef.current = w;
      setContainerW(w);
      // Reposition instantly on resize (e.g. orientation change)
      trackX.set(restX(activeIdxRef.current));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [restX, trackX]);

  // ── Spring-snap to active card ──────────────────────────────────────────────

  useEffect(() => {
    if (!containerW) return;
    snapAnimRef.current?.stop();
    snapAnimRef.current = animate(trackX, restX(activeIdx), {
      type: "spring",
      stiffness: 280,
      damping: 32,
      mass: 1,
      restDelta: 0.5,
      restSpeed: 0.5,
    });
    return () => { snapAnimRef.current?.stop(); };
  }, [activeIdx, containerW, restX, trackX]);

  // ── Imperative style updater (runs on every frame during animation/drag) ───

  const applyStylesFn = useCallback(
    (xVal: number) => {
      const CW   = containerWRef.current;
      if (!CW) return;
      const STEP = CW * STEP_RATIO;
      const CW76 = CW * CARD_W_RATIO;

      cardRefs.current.forEach((el, i) => {
        // Normalised distance from center: 0 = center, ±1 = one step away
        const cardCX = xVal + CW76 / 2 + i * STEP;
        const dist   = (cardCX - CW / 2) / STEP;
        const absDist = Math.abs(dist);
        const t       = Math.max(0, 1 - absDist); // 1 at center, 0 at ±1+

        const scale  = SCALE_SIDE + (SCALE_CENTER - SCALE_SIDE) * t;
        const opac   = OPACITY_SIDE + (OPACITY_CENTER - OPACITY_SIDE) * t;

        el.style.transform = `scale(${scale.toFixed(5)})`;
        el.style.opacity   = opac.toFixed(5);

        // Content: fades in fast when approaching center
        const contentEl = el.querySelector<HTMLElement>("[data-rvc]");
        if (contentEl) {
          // Tight fade: fully invisible at |dist| ≥ 0.35
          const ct = Math.max(0, Math.min(1, 1 - absDist * 2.85));
          contentEl.style.opacity   = ct.toFixed(5);
          // Subtle vertical parallax
          contentEl.style.transform = `translateY(${(dist * 9).toFixed(2)}px)`;
        }
      });
    },
    [],
  );

  useMotionValueEvent(trackX, "change", applyStylesFn);

  // Apply styles immediately when new cards mount (after loadMore)
  useLayoutEffect(() => {
    applyStylesFn(trackX.get());
  }, [reviews.length, applyStylesFn, trackX]);

  // ── Reset to index 0 when variant switches ──────────────────────────────────

  const prevBatchBaseRef = useRef(batchBase);
  useEffect(() => {
    if (batchBase === 0 && prevBatchBaseRef.current !== 0) {
      setActiveIdx(0);
      snapAnimRef.current?.stop();
      trackX.set(restX(0));
    }
    prevBatchBaseRef.current = batchBase;
  }, [batchBase, restX, trackX]);

  // ── Load more when near end of loaded reviews ───────────────────────────────

  useEffect(() => {
    if (hasMore && !loadingMore && reviews.length > 0 && activeIdx >= reviews.length - 3) {
      onLoadMore();
    }
  }, [activeIdx, reviews.length, hasMore, loadingMore, onLoadMore]);

  // ── Pointer handlers ────────────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      snapAnimRef.current?.stop();
      pointerRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTrackX: trackX.get(),
        pointerId: e.pointerId,
        el: e.currentTarget,
        captured: false,
      };
      velSamples.current = [{ t: Date.now(), x: e.clientX }];
    },
    [trackX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const pr = pointerRef.current;
      if (!pr) return;

      const dx = e.clientX - pr.startX;
      const dy = e.clientY - pr.startY;

      if (!pr.captured) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // dead zone
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical scroll wins — release drag
          pointerRef.current = null;
          return;
        }
        // Horizontal swipe confirmed — capture pointer
        try { pr.el.setPointerCapture(pr.pointerId); } catch { /* */ }
        pr.captured = true;
        pr.el.style.cursor = "grabbing";
      }

      trackX.set(pr.startTrackX + dx);
      velSamples.current.push({ t: Date.now(), x: e.clientX });
      if (velSamples.current.length > 8) velSamples.current.shift();
    },
    [trackX],
  );

  const finishDrag = useCallback(
    (clientX: number) => {
      const pr = pointerRef.current;
      if (!pr) return;
      pointerRef.current = null;
      pr.el.style.cursor = "";

      if (!pr.captured) { velSamples.current = []; return; }

      const dx = clientX - pr.startX;

      // Velocity from sample buffer (px/s)
      let vel = 0;
      const samps = velSamples.current;
      if (samps.length >= 2) {
        const newest = samps[samps.length - 1];
        const oldest = samps[0];
        const dt = newest.t - oldest.t;
        if (dt > 0) vel = ((newest.x - oldest.x) / dt) * 1000;
      }
      velSamples.current = [];

      const STEP      = containerWRef.current * STEP_RATIO;
      const THRESHOLD = STEP * 0.22;
      const ai        = activeIdxRef.current;
      const len       = reviewsRef.current.length;

      let newIdx = ai;
      if ((dx < -THRESHOLD || vel < -380) && ai < len - 1) newIdx = ai + 1;
      else if ((dx > THRESHOLD || vel > 380) && ai > 0)    newIdx = ai - 1;

      if (newIdx !== ai) {
        setActiveIdx(newIdx);
      } else {
        // Spring back to rest position
        snapAnimRef.current = animate(trackX, restX(ai), {
          type: "spring", stiffness: 280, damping: 32, mass: 1,
        });
      }
    },
    [restX, trackX],
  );

  const onPointerUp     = useCallback((e: React.PointerEvent) => { finishDrag(e.clientX); }, [finishDrag]);
  const onPointerCancel = useCallback(() => {
    const pr = pointerRef.current;
    if (!pr) return;
    pointerRef.current = null;
    pr.el.style.cursor = "";
    velSamples.current = [];
    snapAnimRef.current = animate(trackX, restX(activeIdxRef.current), {
      type: "spring", stiffness: 280, damping: 32, mass: 1,
    });
  }, [restX, trackX]);

  // ── Navigate ────────────────────────────────────────────────────────────────

  const goTo = useCallback((idx: number) => {
    setActiveIdx(Math.max(0, Math.min(idx, reviewsRef.current.length - 1)));
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (reviews.length === 0) return null;

  const CARD_W_PX = containerW * CARD_W_RATIO;
  const progress  = reviews.length > 0 ? (activeIdx + 1) / reviews.length : 0;

  return (
    <div>
      {/* Drag area */}
      <div
        ref={containerRef}
        role="region"
        aria-label={`Customer reviews, showing ${activeIdx + 1} of ${reviews.length}`}
        style={{
          overflow: "hidden",
          cursor: "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Track */}
        <motion.div style={{ x: trackX, display: "flex", willChange: "transform" }}>
          {reviews.map((review, i) => (
            <div
              key={review.id}
              ref={(el) => {
                if (el) cardRefs.current.set(i, el);
                else cardRefs.current.delete(i);
              }}
              style={{
                width: CARD_W_PX || containerW * CARD_W_RATIO || 280,
                minWidth: CARD_W_PX || containerW * CARD_W_RATIO || 280,
                flexShrink: 0,
                transformOrigin: "center center",
                willChange: "transform, opacity",
                padding: "0 8px",
                boxSizing: "border-box",
              }}
            >
              {/* Glass card */}
              <div
                style={{
                  background: "rgba(255,255,255,0.52)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  borderRadius: 3,
                  padding: "clamp(28px, 5vw, 40px) clamp(20px, 4vw, 32px)",
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 288,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Decorative quote glyph */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -8,
                    left: 12,
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "7rem",
                    fontWeight: 300,
                    lineHeight: 1,
                    color: "rgba(30,24,20,0.05)",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  "
                </span>

                {/* Content — fades in when card is center */}
                <div
                  data-rvc=""
                  style={{
                    width: "100%",
                    willChange: "opacity, transform",
                  }}
                >
                  {/* Stars */}
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 16 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} width={14} height={14} viewBox="0 0 12 12">
                        <path
                          d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z"
                          fill={s <= review.rating ? "#1e1814" : "rgba(30,24,20,0.16)"}
                        />
                      </svg>
                    ))}
                  </div>

                  {/* Title */}
                  {review.title && (
                    <p
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        color: "#1e1814",
                        margin: "0 0 10px",
                        lineHeight: 1.25,
                        textAlign: "center",
                      }}
                    >
                      {review.title}
                    </p>
                  )}

                  {!review.title && <div style={{ height: 10 }} />}

                  {/* Body */}
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: "clamp(1rem, 3vw, 1.15rem)",
                      fontStyle: "italic",
                      fontWeight: 400,
                      color: "#4a4038",
                      lineHeight: 1.85,
                      margin: "0 0 18px",
                      letterSpacing: "0.01em",
                      textAlign: "center",
                    }}
                  >
                    {review.body ?? ""}
                  </p>

                  {/* Byline */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "#7a6e64",
                        margin: 0,
                      }}
                    >
                      — {review.author}
                    </p>
                    <p
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 9,
                        fontWeight: 400,
                        letterSpacing: "0.10em",
                        color: "#b5aea8",
                        margin: 0,
                      }}
                    >
                      {review.date}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Progress bar + counter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginTop: 24,
        }}
      >
        {/* Prev arrow */}
        <button
          type="button"
          onClick={() => goTo(activeIdx - 1)}
          disabled={activeIdx === 0}
          aria-label="Previous review"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: activeIdx === 0 ? "default" : "pointer",
            opacity: activeIdx === 0 ? 0.2 : 0.55,
            transition: "opacity 0.2s",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => { if (activeIdx > 0) e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = activeIdx === 0 ? "0.2" : "0.55"; }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1e1814" strokeWidth="1.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Thin progress bar */}
        <div style={{ width: 100, height: 1.5, background: "rgba(30,24,20,0.12)", borderRadius: 1, overflow: "hidden" }}>
          <motion.div
            style={{ height: "100%", background: "#1e1814", borderRadius: 1 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
          />
        </div>

        {/* Counter */}
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 9,
            fontWeight: 400,
            letterSpacing: "0.16em",
            color: "#b5aea8",
            margin: 0,
            minWidth: 36,
          }}
        >
          {activeIdx + 1} / {reviews.length}{hasMore || loadingMore ? "+" : ""}
        </p>

        {/* Next arrow */}
        <button
          type="button"
          onClick={() => goTo(activeIdx + 1)}
          disabled={activeIdx === reviews.length - 1 && !hasMore}
          aria-label="Next review"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: activeIdx >= reviews.length - 1 && !hasMore ? "default" : "pointer",
            opacity: activeIdx >= reviews.length - 1 && !hasMore ? 0.2 : 0.55,
            transition: "opacity 0.2s",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => { if (activeIdx < reviews.length - 1 || hasMore) e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = (activeIdx >= reviews.length - 1 && !hasMore) ? "0.2" : "0.55"; }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1e1814" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Loading more */}
      {loadingMore && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
          <LoadingSpinner />
        </div>
      )}

      {/* Error */}
      {error && !loadingMore && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            paddingTop: 16,
          }}
        >
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 10,
              color: "#9a8e84",
              letterSpacing: "0.06em",
              margin: 0,
            }}
          >
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#1e1814",
              background: "transparent",
              border: "1px solid rgba(30,24,20,0.3)",
              padding: "10px 22px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.6"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* End of reviews */}
      {!hasMore && !loadingMore && !error && reviews.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            paddingTop: 18,
          }}
        >
          <div style={{ height: 1, width: 32, background: "rgba(30,24,20,0.13)" }} />
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 9,
              fontWeight: 400,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#c0b8b2",
              margin: 0,
            }}
          >
            All reviews shown
          </p>
          <div style={{ height: 1, width: 32, background: "rgba(30,24,20,0.13)" }} />
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function ProductReviews({
  reviews,
  total,
  avgRating,
  batchBase,
  initialLoaded,
  loading,
  loadingMore,
  hasMore,
  error,
  loadMore,
  retry,
  onWriteReview,
}: ProductReviewsProps) {
  const avgDisplay = avgRating % 1 === 0 ? avgRating.toFixed(0) : avgRating.toFixed(1);
  const avgRounded = Math.round(avgRating);

  return (
    <div
      style={{
        background: "linear-gradient(158deg, #f2ece2 0%, #e8dfd2 55%, #ede6d8 100%)",
        paddingTop: "clamp(48px, 10vw, 80px)",
        paddingBottom: "clamp(48px, 10vw, 80px)",
      }}
    >
      {/* Header — centred with horizontal padding */}
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          textAlign: "center",
          padding: "0 clamp(20px, 5vw, 40px)",
        }}
      >
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.36em",
            textTransform: "uppercase",
            color: "#a09890",
            margin: "0 0 18px",
          }}
        >
          From Sister to Sister
        </p>

        {/* Rating summary */}
        {initialLoaded && total > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "clamp(4rem, 12vw, 6rem)",
                fontWeight: 300,
                color: "#1e1814",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {avgDisplay}
            </span>
            <StarRow filled={avgRounded} size={17} />
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10,
                fontWeight: 400,
                color: "#9a8e84",
                letterSpacing: "0.08em",
                margin: 0,
              }}
            >
              Based on {total} {total === 1 ? "review" : "reviews"}
            </p>
          </div>
        )}

        {/* Empty heading */}
        {initialLoaded && total === 0 && (
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(1.8rem, 6vw, 2.6rem)",
              fontWeight: 400,
              letterSpacing: "0.03em",
              color: "#1e1814",
              margin: "0 0 10px",
              lineHeight: 1.15,
            }}
          >
            Be the first to share your thoughts{" "}
            <svg
              viewBox="0 0 24 24"
              style={{ display: "inline-block", width: "0.75em", height: "0.75em", verticalAlign: "middle", marginLeft: "0.15em" }}
              fill="none"
              stroke="#c9a0a0"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z" />
            </svg>
          </h2>
        )}

        {/* Write a Review button */}
        <button
          type="button"
          onClick={onWriteReview}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#faf8f5",
            backgroundColor: "#1e1814",
            border: "none",
            padding: "14px 32px",
            minHeight: 46,
            cursor: "pointer",
            transition: "opacity 0.2s",
            marginTop: initialLoaded && total > 0 ? 0 : 20,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.76"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Write a Review
        </button>
      </div>

      {/* Initial loading spinner */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 48 }}>
          <LoadingSpinner size={22} />
        </div>
      )}

      {/* Carousel — full width (no horizontal padding here, carousel manages its own) */}
      {initialLoaded && reviews.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <ReviewCarousel
            reviews={reviews}
            batchBase={batchBase}
            hasMore={hasMore}
            loadingMore={loadingMore}
            error={error}
            onLoadMore={loadMore}
            onRetry={retry}
          />
        </div>
      )}

      {/* Empty state */}
      {initialLoaded && total === 0 && (
        <div
          style={{
            marginTop: 44,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: "0 clamp(20px, 5vw, 40px)",
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <svg key={s} width={20} height={20} viewBox="0 0 12 12">
                <path
                  d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z"
                  fill="rgba(30,24,20,0.14)"
                />
              </svg>
            ))}
          </div>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(1.05rem, 3.5vw, 1.25rem)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "#9a8e84",
              margin: 0,
              lineHeight: 1.65,
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            Your words matter — share how this piece made you feel.
          </p>
        </div>
      )}
    </div>
  );
}
