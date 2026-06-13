import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { ReviewsPaginationState } from "./useReviewsPagination";

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

function StarRow({ rating, filled, size = 14 }: { rating: number; filled: number; size?: number }) {
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

function LoadingSpinner() {
  return (
    <>
      <style>{`@keyframes _moi_spin { to { transform: rotate(360deg); } }`}</style>
      <div
        role="status"
        aria-label="Loading reviews"
        style={{
          width: 20,
          height: 20,
          border: "1.5px solid rgba(30,24,20,0.15)",
          borderTopColor: "#1e1814",
          borderRadius: "50%",
          animation: "_moi_spin 0.75s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.44, ease: [0.25, 0.1, 0.25, 1] as const, delay },
  }),
};

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
  // Sentinel element observed by IntersectionObserver to trigger next-page loads
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      {
        // Trigger 300px before the sentinel enters viewport for seamless loading
        rootMargin: "300px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const avgDisplay = avgRating % 1 === 0 ? avgRating.toFixed(0) : avgRating.toFixed(1);
  const avgRounded = Math.round(avgRating);

  return (
    <div
      style={{
        background: "linear-gradient(158deg, #f2ece2 0%, #e8dfd2 55%, #ede6d8 100%)",
        padding: "clamp(48px, 10vw, 80px) clamp(20px, 5vw, 40px)",
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
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

        {/* Summary header — shown once initial load is done */}
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
            <StarRow rating={avgRating} filled={avgRounded} size={17} />
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
              style={{
                display: "inline-block",
                width: "0.75em",
                height: "0.75em",
                verticalAlign: "middle",
                marginLeft: "0.15em",
              }}
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

        {/* Review cards list */}
        {reviews.length > 0 && (
          <div style={{ marginTop: 48 }}>
            {reviews.map((review, idx) => {
              // Only stagger newly loaded cards; existing cards won't re-animate (stable key)
              const posInBatch = idx - batchBase;
              const delay = posInBatch >= 0 ? Math.min(posInBatch * 0.07, 0.56) : 0;

              return (
                <motion.div
                  key={review.id}
                  custom={delay}
                  variants={CARD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  style={{
                    background: "rgba(255,255,255,0.52)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    borderRadius: 3,
                    padding: "clamp(24px, 5vw, 36px)",
                    marginBottom: idx < reviews.length - 1 ? 16 : 0,
                    position: "relative",
                    overflow: "hidden",
                    willChange: "opacity, transform",
                  }}
                >
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

                  <StarRow rating={review.rating} filled={review.rating} size={14} />

                  {review.title && (
                    <p
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        color: "#1e1814",
                        margin: "14px 0 10px",
                        lineHeight: 1.25,
                      }}
                    >
                      {review.title}
                    </p>
                  )}

                  {!review.title && <div style={{ marginBottom: 14 }} />}

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
                    }}
                  >
                    {review.body ?? ""}
                  </p>

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
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty state icons */}
        {initialLoaded && total === 0 && (
          <div
            style={{
              marginTop: 44,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
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
              }}
            >
              Your words matter — share how this piece made you feel.
            </p>
          </div>
        )}

        {/* Sentinel + footer states */}
        <div
          ref={sentinelRef}
          aria-hidden="true"
          style={{ height: 1, marginTop: reviews.length > 0 ? 16 : 0 }}
        />

        {/* Loading more indicator */}
        {loadingMore && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "24px 0 8px",
            }}
          >
            <LoadingSpinner />
          </div>
        )}

        {/* Error state with retry */}
        {error && !loadingMore && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "24px 0 8px",
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
              onClick={retry}
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

        {/* End-of-reviews indicator — only when all loaded and there are reviews */}
        {initialLoaded && !hasMore && !loadingMore && !error && total > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "28px 0 4px",
            }}
          >
            <div style={{ height: 1, width: 40, background: "rgba(30,24,20,0.14)" }} />
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 9,
                fontWeight: 400,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#b5aea8",
                margin: 0,
              }}
            >
              All reviews shown
            </p>
            <div style={{ height: 1, width: 40, background: "rgba(30,24,20,0.14)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
