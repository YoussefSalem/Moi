import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Review {
  id: string;
  productHandle: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
}

export const REVIEWS_STORAGE_KEY = "moi_reviews_v1";

export function loadReviews(): Review[] {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY) ?? "[]") as Review[];
  } catch {
    return [];
  }
}

function saveReviews(reviews: Review[]) {
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // ignore
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function StarSvg({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={filled ? "#1e1814" : "none"}
      stroke="#1e1814"
      strokeWidth="1.3"
      style={{ display: "inline-block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <polygon points="10,1.5 12.9,7.3 19.5,8.3 14.7,13 15.9,19.6 10,16.5 4.1,19.6 5.3,13 0.5,8.3 7.1,7.3" />
    </svg>
  );
}

export function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <StarSvg key={s} filled={rounded >= s} size={size} />
      ))}
    </div>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div
      className="flex gap-1"
      onMouseLeave={() => setHovered(0)}
      role="group"
      aria-label="Choose a star rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onTouchStart={() => setHovered(star)}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          className="transition-transform hover:scale-110 active:scale-95"
          style={{ background: "none", border: "none", padding: "4px 3px", cursor: "pointer", lineHeight: 0, minWidth: 32, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <StarSvg filled={(hovered || value) >= star} size={26} />
        </button>
      ))}
    </div>
  );
}

interface ReviewSectionProps {
  productHandle: string;
  productName: string;
}

const SERIF: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const SANS: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif" };
const LABEL_STYLE: React.CSSProperties = {
  ...SANS,
  fontSize: 9,
  letterSpacing: "0.30em",
  textTransform: "uppercase",
  color: "#8a7e74",
} as React.CSSProperties;

export function ReviewSection({ productHandle, productName }: ReviewSectionProps) {
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllReviews(loadReviews());
  }, []);

  const productReviews = allReviews
    .filter((r) => r.productHandle === productHandle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const avgRating =
    productReviews.length > 0
      ? productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (rating === 0) { setError("Please choose a star rating."); return; }
    if (comment.trim().length < 8) { setError("Please write at least a few words."); return; }
    setError("");
    const newReview: Review = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productHandle,
      name: name.trim(),
      rating,
      comment: comment.trim(),
      date: new Date().toISOString(),
    };
    const updated = [newReview, ...allReviews];
    saveReviews(updated);
    setAllReviews(updated);
    setName("");
    setRating(0);
    setComment("");
    setSubmitted(true);
    setFormOpen(false);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: productReviews.filter((r) => r.rating === star).length,
  }));

  const baseProductName = productName.includes(" — ")
    ? productName.split(" — ")[0]
    : productName;

  return (
    <section
      className="w-full"
      style={{ borderTop: "1px solid rgba(30,24,20,0.08)", paddingTop: 56, paddingBottom: 72 }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-12">

        {/* ── Header row ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8 md:mb-12">
          <div>
            <p style={{ ...LABEL_STYLE, marginBottom: 12 } as React.CSSProperties}>Customer Reviews</p>
            <h2
              style={{
                ...SERIF,
                fontSize: "clamp(1.7rem, 6vw, 2.6rem)",
                fontWeight: 300,
                color: "#1e1814",
                letterSpacing: "0.02em",
                lineHeight: 1.1,
              }}
            >
              What our customers say
            </h2>
            {productReviews.length > 0 && (
              <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
                <StarDisplay value={avgRating} size={14} />
                <span style={{ ...SANS, fontSize: 11, color: "#8a7e74", letterSpacing: "0.08em" }}>
                  {avgRating.toFixed(1)} · {productReviews.length} review{productReviews.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="active:scale-[0.97] transition-transform"
            style={{
              ...SANS,
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: formOpen ? "#1e1814" : "#faf8f5",
              backgroundColor: formOpen ? "transparent" : "#1e1814",
              border: "1px solid #1e1814",
              padding: "13px 22px",
              cursor: "pointer",
              flexShrink: 0,
              alignSelf: "flex-start",
              minHeight: 44,
            }}
          >
            {formOpen ? "Cancel" : "Write a Review"}
          </button>
        </div>

        {/* ── Rating bar chart ── */}
        {productReviews.length > 0 && (
          <div className="mb-8 md:mb-12">
            <div className="flex flex-col gap-2" style={{ maxWidth: 260 }}>
              {ratingCounts.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-3">
                  <span style={{ ...SANS, fontSize: 10, color: "#8a7e74", minWidth: 8 }}>{star}</span>
                  <StarSvg filled size={10} />
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, backgroundColor: "rgba(30,24,20,0.08)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${productReviews.length > 0 ? (count / productReviews.length) * 100 : 0}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: (5 - star) * 0.05 }}
                      style={{ height: "100%", backgroundColor: "#1e1814" }}
                    />
                  </div>
                  <span style={{ ...SANS, fontSize: 9, color: "rgba(30,24,20,0.38)", minWidth: 16 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Success flash ── */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              style={{ border: "1px solid rgba(30,24,20,0.14)", backgroundColor: "rgba(245,240,232,0.6)", padding: "14px 20px", marginBottom: 32 }}
            >
              <p style={{ ...SANS, fontSize: 11, letterSpacing: "0.14em", color: "#1e1814" }}>
                Thank you — your review has been added.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Write Review form ── */}
        <AnimatePresence>
          {formOpen && (
            <motion.div
              key="review-form"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{
                backgroundColor: "rgba(245,240,232,0.5)",
                border: "1px solid rgba(30,24,20,0.10)",
                padding: "clamp(20px, 5vw, 36px)",
                marginBottom: 48,
              }}
            >
              <p
                style={{
                  ...SERIF,
                  fontSize: "clamp(1.1rem, 3.5vw, 1.4rem)",
                  fontWeight: 300,
                  color: "#1e1814",
                  marginBottom: 24,
                  letterSpacing: "0.03em",
                }}
              >
                Your review —{" "}
                <em style={{ opacity: 0.65, fontStyle: "italic" }}>{baseProductName}</em>
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Rating */}
                <div className="flex flex-col gap-2">
                  <label style={LABEL_STYLE as React.CSSProperties}>Rating *</label>
                  <StarInput value={rating} onChange={setRating} />
                </div>

                {/* Name */}
                <div className="flex flex-col gap-2">
                  <label style={LABEL_STYLE as React.CSSProperties} htmlFor="review-name">Your Name *</label>
                  <input
                    id="review-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nour M."
                    maxLength={60}
                    autoComplete="name"
                    style={{
                      ...SANS,
                      fontSize: 14,
                      color: "#1e1814",
                      backgroundColor: "rgba(250,248,245,0.9)",
                      border: "1px solid rgba(30,24,20,0.18)",
                      padding: "13px 14px",
                      outline: "none",
                      width: "100%",
                      maxWidth: 360,
                      letterSpacing: "0.03em",
                      borderRadius: 0,
                      WebkitAppearance: "none",
                    } as React.CSSProperties}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(30,24,20,0.6)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(30,24,20,0.18)")}
                  />
                </div>

                {/* Comment */}
                <div className="flex flex-col gap-2">
                  <label style={LABEL_STYLE as React.CSSProperties} htmlFor="review-comment">Your Review *</label>
                  <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts on the fit, fabric, and quality…"
                    rows={4}
                    maxLength={600}
                    style={{
                      ...SANS,
                      fontSize: 14,
                      color: "#1e1814",
                      backgroundColor: "rgba(250,248,245,0.9)",
                      border: "1px solid rgba(30,24,20,0.18)",
                      padding: "13px 14px",
                      outline: "none",
                      width: "100%",
                      maxWidth: 560,
                      letterSpacing: "0.025em",
                      lineHeight: 1.7,
                      resize: "vertical",
                      borderRadius: 0,
                      WebkitAppearance: "none",
                    } as React.CSSProperties}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(30,24,20,0.6)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(30,24,20,0.18)")}
                  />
                  <p style={{ ...SANS, fontSize: 9, color: "rgba(30,24,20,0.32)", letterSpacing: "0.06em" }}>
                    {comment.length} / 600
                  </p>
                </div>

                {error && (
                  <p style={{ ...SANS, fontSize: 11, color: "#c83232", letterSpacing: "0.08em" }}>{error}</p>
                )}

                <button
                  type="submit"
                  className="active:scale-[0.97] transition-transform"
                  style={{
                    ...SANS,
                    fontSize: 9,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: "#faf8f5",
                    backgroundColor: "#1e1814",
                    border: "1px solid #1e1814",
                    padding: "14px 28px",
                    cursor: "pointer",
                    alignSelf: "flex-start",
                    minHeight: 44,
                  }}
                >
                  Submit Review
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty state ── */}
        {productReviews.length === 0 && !formOpen && !submitted && (
          <div
            className="flex flex-col items-center justify-center gap-3 py-12"
            style={{ borderTop: "1px solid rgba(30,24,20,0.07)" }}
          >
            <p style={{ ...SERIF, fontSize: "clamp(1.05rem, 3vw, 1.3rem)", fontWeight: 300, color: "rgba(30,24,20,0.4)", letterSpacing: "0.04em" }}>
              No reviews yet
            </p>
            <p style={{ ...SANS, fontSize: 9, letterSpacing: "0.18em", color: "#8a7e74" }}>
              Be the first to share your experience.
            </p>
          </div>
        )}

        {/* ── Review cards ── */}
        {productReviews.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(30,24,20,0.08)" }}>
            {productReviews.map((review, i) => (
              <motion.article
                key={review.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.04, 0.18) }}
                style={{ padding: "26px 0", borderBottom: "1px solid rgba(30,24,20,0.07)" }}
              >
                <div className="flex items-start justify-between gap-4 mb-2.5">
                  <div className="flex flex-col gap-1.5">
                    <StarDisplay value={review.rating} size={12} />
                    <p style={{ ...SERIF, fontSize: "clamp(0.92rem, 2.5vw, 1.05rem)", fontWeight: 400, color: "#1e1814", letterSpacing: "0.02em" }}>
                      {review.name}
                    </p>
                  </div>
                  <p style={{ ...SANS, fontSize: 9, letterSpacing: "0.14em", color: "#8a7e74", textTransform: "uppercase", flexShrink: 0, marginTop: 2 }}>
                    {formatDate(review.date)}
                  </p>
                </div>
                <p style={{ ...SANS, fontSize: "clamp(0.79rem, 2vw, 0.86rem)", color: "#5a4e44", lineHeight: 1.78, letterSpacing: "0.02em", maxWidth: 580 }}>
                  {review.comment}
                </p>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
