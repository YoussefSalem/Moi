export interface ReviewItem {
  id: number;
  author: string;
  title: string;
  body: string;
  rating: number;
  date: string;
}

interface ProductReviewsProps {
  reviews: ReviewItem[];
  reviewsLoaded: boolean;
  onWriteReview: () => void;
}

export function ProductReviews({ reviews, reviewsLoaded, onWriteReview }: ProductReviewsProps) {
  if (!reviewsLoaded) return null;

  const avg = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const avgRounded = Math.round(avg);

  return (
    <div style={{
      background: "linear-gradient(158deg, #f2ece2 0%, #e8dfd2 55%, #ede6d8 100%)",
      padding: "clamp(48px, 10vw, 80px) clamp(20px, 5vw, 40px)",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>

        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "#a09890", margin: "0 0 18px" }}>
          From Sister to Sister
        </p>

        {reviews.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(4rem, 12vw, 6rem)", fontWeight: 300, color: "#1e1814", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1)}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {[1,2,3,4,5].map((s) => (
                <svg key={s} width={17} height={17} viewBox="0 0 12 12">
                  <path d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z" fill={s <= avgRounded ? "#1e1814" : "rgba(30,24,20,0.18)"} />
                </svg>
              ))}
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 400, color: "#9a8e84", letterSpacing: "0.08em", margin: 0 }}>
              Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </p>
          </div>
        ) : (
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.8rem, 6vw, 2.6rem)", fontWeight: 400, letterSpacing: "0.03em", color: "#1e1814", margin: "0 0 10px", lineHeight: 1.15 }}>
            Be the first to share your thoughts{" "}
            <svg viewBox="0 0 24 24" style={{ display: "inline-block", width: "0.75em", height: "0.75em", verticalAlign: "middle", marginLeft: "0.15em" }} fill="none" stroke="#c9a0a0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z"/></svg>
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
            marginTop: reviews.length > 0 ? 0 : 20,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.76"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Write a Review
        </button>

        {reviews.length > 0 && (
          <div style={{ marginTop: 48 }}>
            {reviews.map((review, idx) => (
              <div
                key={review.id}
                style={{
                  background: "rgba(255,255,255,0.52)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  borderRadius: 3,
                  padding: "clamp(24px, 5vw, 36px)",
                  marginBottom: idx < reviews.length - 1 ? 16 : 0,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <span aria-hidden="true" style={{
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
                }}>"</span>

                <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 14 }}>
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} width={14} height={14} viewBox="0 0 12 12">
                      <path d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z" fill={s <= review.rating ? "#1e1814" : "rgba(30,24,20,0.16)"} />
                    </svg>
                  ))}
                </div>

                {review.title && (
                  <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", fontWeight: 600, letterSpacing: "0.02em", color: "#1e1814", margin: "0 0 10px", lineHeight: 1.25 }}>
                    {review.title}
                  </p>
                )}

                <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1rem, 3vw, 1.15rem)", fontStyle: "italic", fontWeight: 400, color: "#4a4038", lineHeight: 1.85, margin: "0 0 18px", letterSpacing: "0.01em" }}>
                  {review.body}
                </p>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7a6e64", margin: 0 }}>
                    — {review.author}
                  </p>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 400, letterSpacing: "0.10em", color: "#b5aea8", margin: 0 }}>
                    {review.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {reviews.length === 0 && (
          <div style={{ marginTop: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {[1,2,3,4,5].map((s) => (
                <svg key={s} width={20} height={20} viewBox="0 0 12 12">
                  <path d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z" fill="rgba(30,24,20,0.14)" />
                </svg>
              ))}
            </div>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.05rem, 3.5vw, 1.25rem)", fontStyle: "italic", fontWeight: 400, color: "#9a8e84", margin: 0, lineHeight: 1.65, maxWidth: 320 }}>
              Your words matter — share how this piece made you feel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
