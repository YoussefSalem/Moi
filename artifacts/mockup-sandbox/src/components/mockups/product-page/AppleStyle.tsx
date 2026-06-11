import { useState, useRef, useEffect, useCallback } from "react";

const C = {
  canvas: "#ffffff",
  parchment: "#f5f5f7",
  blue: "#0066cc",
  ink: "#1d1d1f",
  inkMuted: "#6e6e73",
  inkFaint: "#a1a1a6",
  hairline: "#d2d2d7",
  black: "#000000",
  surface: "#fafafc",
};

const GALLERY = [
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=900&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=85&auto=format&fit=crop",
];

const COLOR_GALLERY: Record<string, string[]> = {
  White: GALLERY,
  Cashmere: [
    "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=900&q=85&auto=format&fit=crop",
  ],
  Beige: [
    "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1546938576-6e12d9468cbe?w=900&q=85&auto=format&fit=crop",
  ],
  Teal: [
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1543525238-54e3d131d627?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=85&auto=format&fit=crop",
  ],
  "Light Blue": [
    "https://images.unsplash.com/photo-1481233085934-e3c49c9e18dc?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1532453288672-3a17cdc67d4f?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=85&auto=format&fit=crop",
  ],
  Navy: [
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=900&q=85&auto=format&fit=crop",
  ],
  Mint: [
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=85&auto=format&fit=crop",
  ],
};

const COLORS = [
  { name: "White", hex: "#f0ece5", border: "#d4cfc8" },
  { name: "Cashmere", hex: "#c9aa87", border: "#b89870" },
  { name: "Beige", hex: "#d6c4a8", border: "#c4b090" },
  { name: "Teal", hex: "#5f9ea0", border: "#4e8a8c" },
  { name: "Light Blue", hex: "#a8c8e0", border: "#90b4d0" },
  { name: "Navy", hex: "#1e2d5a", border: "#162245" },
  { name: "Mint", hex: "#98d4b8", border: "#7ec0a4" },
];

const SIZES = ["XS", "S", "M", "L", "XL"];

const REVIEWS = [
  {
    author: "Layla M.",
    date: "May 2025",
    rating: 5,
    title: "The most beautiful top I own",
    body: "The fabric is incredibly soft and the silhouette is perfect. I've worn it three different ways this week. Worth every pound.",
    verified: true,
  },
  {
    author: "Sara A.",
    date: "April 2025",
    rating: 5,
    title: "Effortless luxury",
    body: "I ordered the Cashmere color and it's stunning in person. The asymmetric hem is subtle and elegant. Ships fast, packaged beautifully.",
    verified: true,
  },
  {
    author: "Nour K.",
    date: "March 2025",
    rating: 4,
    title: "Gorgeous, runs slightly large",
    body: "Absolutely love the quality and drape. I'd recommend sizing down if you prefer a more fitted look. Still keeping mine — the oversized feel is chic.",
    verified: true,
  },
];

const RECOMMENDED = [
  {
    name: "MOI VERSA TOP",
    price: "1,399 EGP",
    img: "https://images.unsplash.com/photo-1598522325074-042db73aa4e6?w=600&q=80&auto=format&fit=crop",
  },
  {
    name: "Trio Bangles",
    price: "890 EGP",
    img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80&auto=format&fit=crop",
  },
  {
    name: "MOI DRAPE DRESS",
    price: "1,890 EGP",
    img: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&q=80&auto=format&fit=crop",
  },
  {
    name: "SILK SCARF",
    price: "490 EGP",
    img: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80&auto=format&fit=crop",
  },
  {
    name: "LINEN WIDE LEG",
    price: "1,290 EGP",
    img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80&auto=format&fit=crop",
  },
  {
    name: "WRAP SKIRT",
    price: "999 EGP",
    img: "https://images.unsplash.com/photo-1546938576-6e12d9468cbe?w=600&q=80&auto=format&fit=crop",
  },
];

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 14 14" fill={s <= Math.floor(rating) ? C.ink : s - 0.5 <= rating ? "url(#half)" : C.hairline}>
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor={C.ink} />
              <stop offset="50%" stopColor={C.hairline} />
            </linearGradient>
          </defs>
          <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.885l-3.09 1.625.59-3.44L2 4.635l3.455-.505z" />
        </svg>
      ))}
    </span>
  );
}

export default function AppleStyle() {
  const [selectedColor, setSelectedColor] = useState(COLORS[0].name);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [addedToBag, setAddedToBag] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mobileImgIndex, setMobileImgIndex] = useState(0);
  const touchStartX = useRef(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const currentGallery = COLOR_GALLERY[selectedColor] || GALLERY;

  useEffect(() => {
    setActiveImg(0);
    setMobileImgIndex(0);
  }, [selectedColor]);

  const handleAddToBag = useCallback(() => {
    if (!selectedSize) return;
    setAddedToBag(true);
    setTimeout(() => setAddedToBag(false), 2200);
  }, [selectedSize]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent, total: number) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) setMobileImgIndex((i) => Math.min(i + 1, total - 1));
      else setMobileImgIndex((i) => Math.max(i - 1, 0));
    }
  };

  const font = {
    fontFamily: '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  };

  return (
    <div style={{ ...font, backgroundColor: C.canvas, color: C.ink, minHeight: "100vh" }}>

      {/* ── STICKY NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        backgroundColor: "rgba(255,255,255,0.85)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: `1px solid ${C.hairline}`,
      }}>
        <div style={{
          maxWidth: 1240, margin: "0 auto",
          padding: "0 24px",
          height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, padding: "8px 0" }}>
            <svg width={17} height={17} viewBox="0 0 17 17" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke={C.ink} strokeWidth="1.4" />
              <path d="M13 13l2.5 2.5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <a href="#" style={{
            fontSize: 22, fontWeight: 600, letterSpacing: "0.2em",
            color: C.ink, textDecoration: "none",
          }}>MOI</a>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, padding: "8px 0", position: "relative" }}>
            <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
              <path d="M3 4.5h12l-1.5 9H4.5L3 4.5z" stroke={C.ink} strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M6.5 4.5V3a2.5 2.5 0 015 0v1.5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════
          DESKTOP LAYOUT (≥900px)
      ═══════════════════════════════════ */}
      <div className="hidden md:block">
        {/* Breadcrumb */}
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px 0" }}>
          <p style={{ fontSize: 12, color: C.inkFaint, letterSpacing: "0.01em" }}>
            <a href="#" style={{ color: C.blue, textDecoration: "none" }}>Clothing</a>
            <span style={{ margin: "0 6px", color: C.inkFaint }}>›</span>
            <span>WAVVY Top</span>
          </p>
        </div>

        {/* 3-column product grid */}
        <div style={{
          maxWidth: 1240, margin: "0 auto",
          padding: "40px 24px 80px",
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr 1fr",
          gap: 64,
          alignItems: "start",
        }}>

          {/* LEFT: Product Info */}
          <div style={{ paddingTop: 8 }}>
            <p style={{
              fontSize: 12, fontWeight: 600, letterSpacing: "0.12em",
              color: C.inkMuted, textTransform: "uppercase", marginBottom: 16,
            }}>
              New Arrival
            </p>
            <h1 style={{
              fontSize: 40, fontWeight: 600, lineHeight: 1.1,
              letterSpacing: "-0.02em", color: C.ink, marginBottom: 16,
            }}>
              MOI WAVVY
            </h1>
            <p style={{
              fontSize: 21, fontWeight: 300, lineHeight: 1.5,
              color: C.inkMuted, marginBottom: 32,
              letterSpacing: "0.01em",
            }}>
              Effortlessly draped.<br />Infinitely wearable.
            </p>
            <div style={{ height: 1, backgroundColor: C.hairline, marginBottom: 32 }} />
            <p style={{
              fontSize: 17, lineHeight: 1.6, letterSpacing: "-0.022em",
              color: C.ink, marginBottom: 28,
            }}>
              Woven from 100% premium cotton in a relaxed silhouette that moves with you. The WAVVY top features a signature asymmetric hem and deep-set side seams — designed to layer beautifully or stand alone.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Material", "100% Premium Egyptian Cotton"],
                ["Fit", "Relaxed, asymmetric hem"],
                ["Care", "Machine wash cold, lay flat to dry"],
                ["Origin", "Locally crafted"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.inkMuted, minWidth: 72 }}>{k}</span>
                  <span style={{ fontSize: 13, color: C.ink }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER: Gallery */}
          <div>
            <div style={{
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: "0 12px 48px rgba(0,0,0,0.10)",
              aspectRatio: "3/4",
              backgroundColor: C.parchment,
            }}>
              <img
                src={currentGallery[activeImg]}
                alt="Product"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            {/* Thumbnails */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
              {currentGallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  style={{
                    width: 60, height: 80, border: "none", padding: 0, cursor: "pointer",
                    borderRadius: 4, overflow: "hidden",
                    outline: activeImg === i ? `2px solid ${C.ink}` : "none",
                    outlineOffset: 2,
                    opacity: activeImg === i ? 1 : 0.55,
                    transition: "opacity 0.2s, outline 0.15s",
                    flexShrink: 0,
                  }}
                >
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Purchase Actions */}
          <div style={{ paddingTop: 8 }}>
            {/* Price */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink }}>
                899 EGP
              </p>
              <p style={{ fontSize: 13, color: C.inkFaint, marginTop: 4 }}>
                Free delivery on orders over 1,500 EGP
              </p>
            </div>

            <div style={{ height: 1, backgroundColor: C.hairline, marginBottom: 28 }} />

            {/* Color */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Color</p>
                <p style={{ fontSize: 13, color: C.inkMuted }}>{selectedColor}</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    title={c.name}
                    style={{
                      width: 28, height: 28,
                      borderRadius: "50%",
                      backgroundColor: c.hex,
                      border: selectedColor === c.name
                        ? `2px solid ${C.ink}`
                        : `1.5px solid ${c.border}`,
                      cursor: "pointer",
                      padding: 0,
                      boxSizing: "border-box",
                      transition: "transform 0.15s, border 0.15s",
                      transform: selectedColor === c.name ? "scale(1.12)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Size</p>
                <a href="#" style={{ fontSize: 13, color: C.blue, textDecoration: "none" }}>Size guide ›</a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    style={{
                      height: 42,
                      border: selectedSize === sz
                        ? `1.5px solid ${C.ink}`
                        : `1px solid ${C.hairline}`,
                      borderRadius: 8,
                      backgroundColor: selectedSize === sz ? C.ink : C.canvas,
                      color: selectedSize === sz ? C.canvas : C.ink,
                      fontSize: 13, fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      fontFamily: "inherit",
                    }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              {!selectedSize && (
                <p style={{ fontSize: 12, color: C.inkFaint, marginTop: 10 }}>Please select a size</p>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleAddToBag}
              style={{
                width: "100%",
                height: 50,
                borderRadius: 9999,
                backgroundColor: addedToBag ? "#1d7a3a" : C.blue,
                color: "#fff",
                border: "none",
                fontSize: 17, fontWeight: 400, letterSpacing: "-0.022em",
                cursor: selectedSize ? "pointer" : "not-allowed",
                opacity: selectedSize ? 1 : 0.45,
                transition: "background-color 0.3s, opacity 0.2s",
                fontFamily: "inherit",
                marginBottom: 14,
              }}
            >
              {addedToBag ? "Added to Bag ✓" : "Add to Bag"}
            </button>

            <button
              onClick={() => setSaved(!saved)}
              style={{
                width: "100%", height: 50, borderRadius: 9999,
                backgroundColor: C.surface,
                border: `1px solid ${C.hairline}`,
                color: C.ink, fontSize: 17, fontWeight: 400,
                cursor: "pointer", fontFamily: "inherit",
                transition: "background-color 0.15s",
              }}
            >
              {saved ? "♥ Saved" : "♡ Save"}
            </button>

            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating rating={4.7} />
              <a href="#reviews" style={{ fontSize: 13, color: C.blue, textDecoration: "none" }}>
                47 Reviews
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════
          MOBILE LAYOUT (<900px)
      ═══════════════════════════════════ */}
      <div className="md:hidden" style={{ paddingBottom: 100 }}>
        {/* Swipeable Gallery */}
        <div
          style={{ position: "relative", backgroundColor: C.parchment, overflow: "hidden" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={(e) => handleTouchEnd(e, currentGallery.length)}
        >
          <div style={{
            display: "flex",
            transform: `translateX(-${mobileImgIndex * 100}%)`,
            transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {currentGallery.map((img, i) => (
              <div key={i} style={{ flex: "0 0 100%", aspectRatio: "3/4" }}>
                <img
                  src={img}
                  alt={`Product view ${i + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
          {/* Dot indicators */}
          <div style={{
            position: "absolute", bottom: 16, left: 0, right: 0,
            display: "flex", justifyContent: "center", gap: 6,
          }}>
            {currentGallery.map((_, i) => (
              <button
                key={i}
                onClick={() => setMobileImgIndex(i)}
                style={{
                  width: mobileImgIndex === i ? 16 : 6,
                  height: 6, borderRadius: 9999, border: "none",
                  backgroundColor: mobileImgIndex === i ? C.canvas : "rgba(255,255,255,0.55)",
                  padding: 0, cursor: "pointer",
                  transition: "width 0.2s, background-color 0.2s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Mobile Product Info */}
        <div style={{ padding: "28px 20px 0" }}>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
            color: C.inkMuted, textTransform: "uppercase", marginBottom: 8,
          }}>New Arrival</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{
                fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em",
                color: C.ink, marginBottom: 4,
              }}>MOI WAVVY</h1>
              <p style={{ fontSize: 17, color: C.inkMuted, fontWeight: 300 }}>
                Effortlessly draped.
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>899 EGP</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                <StarRating rating={4.7} size={12} />
                <span style={{ fontSize: 12, color: C.inkFaint }}>47</span>
              </div>
            </div>
          </div>

          {/* Mobile Color */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Color — <span style={{ fontWeight: 400, color: C.inkMuted }}>{selectedColor}</span></p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelectedColor(c.name)}
                  title={c.name}
                  style={{
                    width: 30, height: 30, borderRadius: "50%",
                    backgroundColor: c.hex,
                    border: selectedColor === c.name ? `2.5px solid ${C.ink}` : `1.5px solid ${c.border}`,
                    cursor: "pointer", padding: 0, boxSizing: "border-box",
                    transform: selectedColor === c.name ? "scale(1.1)" : "scale(1)",
                    transition: "transform 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Mobile Size */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Size</p>
              <a href="#" style={{ fontSize: 13, color: C.blue, textDecoration: "none" }}>Guide ›</a>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSelectedSize(sz)}
                  style={{
                    flex: 1, height: 44,
                    border: selectedSize === sz ? `1.5px solid ${C.ink}` : `1px solid ${C.hairline}`,
                    borderRadius: 8,
                    backgroundColor: selectedSize === sz ? C.ink : C.canvas,
                    color: selectedSize === sz ? C.canvas : C.ink,
                    fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >{sz}</button>
              ))}
            </div>
          </div>

          {/* Mobile description */}
          <p style={{
            fontSize: 15, lineHeight: 1.6, color: C.inkMuted,
            marginTop: 28, letterSpacing: "-0.01em",
          }}>
            Woven from 100% premium cotton in a relaxed silhouette that moves with you. Signature asymmetric hem with deep-set side seams.
          </p>
        </div>

        {/* Mobile sticky bottom bar */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
          backgroundColor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${C.hairline}`,
          padding: "12px 20px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          display: "flex", gap: 12,
        }}>
          <button
            onClick={() => setSaved(!saved)}
            style={{
              width: 50, height: 50, borderRadius: 9999, flexShrink: 0,
              border: `1px solid ${C.hairline}`,
              backgroundColor: C.surface,
              color: saved ? "#e63946" : C.inkMuted,
              fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {saved ? "♥" : "♡"}
          </button>
          <button
            onClick={handleAddToBag}
            style={{
              flex: 1, height: 50, borderRadius: 9999,
              backgroundColor: addedToBag ? "#1d7a3a" : C.blue,
              color: "#fff", border: "none",
              fontSize: 17, fontWeight: 400,
              cursor: selectedSize ? "pointer" : "not-allowed",
              opacity: selectedSize ? 1 : 0.5,
              transition: "background-color 0.3s",
              fontFamily: "inherit",
            }}
          >
            {addedToBag ? "Added ✓" : "Add to Bag — 899 EGP"}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════
          REVIEWS SECTION (parchment tile)
      ═══════════════════════════════════ */}
      <div id="reviews" style={{ backgroundColor: C.parchment }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "80px 24px" }}>
          {/* Header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 48,
            flexWrap: "wrap", gap: 16,
          }}>
            <div>
              <h2 style={{
                fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em",
                color: C.ink, marginBottom: 10,
              }}>Customer Reviews</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <StarRating rating={4.7} size={18} />
                <span style={{ fontSize: 17, color: C.ink }}>4.7</span>
                <span style={{ fontSize: 17, color: C.inkMuted }}>· 47 reviews</span>
              </div>
            </div>
            <button
              onClick={() => setShowAllReviews(!showAllReviews)}
              style={{
                background: "none", border: `1px solid ${C.hairline}`,
                borderRadius: 9999, padding: "10px 22px",
                fontSize: 13, fontWeight: 500, color: C.ink,
                cursor: "pointer", fontFamily: "inherit",
                backgroundColor: C.canvas,
                transition: "background-color 0.15s",
              }}
            >
              {showAllReviews ? "Show Less" : "View All Reviews"}
            </button>
          </div>

          {/* Review cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}>
            {(showAllReviews ? REVIEWS : REVIEWS.slice(0, 3)).map((r, i) => (
              <div key={i} style={{
                backgroundColor: C.canvas,
                borderRadius: 18,
                padding: "28px 28px 32px",
                border: `1px solid ${C.hairline}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <StarRating rating={r.rating} size={13} />
                  {r.verified && (
                    <span style={{ fontSize: 11, color: "#1d7a3a", fontWeight: 500, letterSpacing: "0.03em" }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: 15, fontWeight: 600, color: C.ink,
                  marginBottom: 10, lineHeight: 1.3,
                }}>{r.title}</p>
                <p style={{
                  fontSize: 14, lineHeight: 1.65, color: C.inkMuted,
                  marginBottom: 16,
                }}>{r.body}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    backgroundColor: C.parchment,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600, color: C.inkMuted,
                  }}>
                    {r.author[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{r.author}</p>
                    <p style={{ fontSize: 11, color: C.inkFaint }}>{r.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════
          RECOMMENDED — "You May Also Like"
      ═══════════════════════════════════ */}
      <div style={{ backgroundColor: C.canvas }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "80px 0 80px 24px" }}>
          <h2 style={{
            fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em",
            color: C.ink, marginBottom: 8,
          }}>
            You May Also Like
          </h2>
          <p style={{ fontSize: 15, color: C.inkMuted, marginBottom: 36 }}>
            Curated pieces that pair beautifully.
          </p>

          {/* Scrollable carousel */}
          <div
            ref={carouselRef}
            style={{
              display: "flex", gap: 16, overflowX: "auto",
              paddingBottom: 16, paddingRight: 24,
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              msOverflowStyle: "none",
              scrollbarWidth: "none",
            }}
          >
            {RECOMMENDED.map((p, i) => (
              <div
                key={i}
                style={{
                  flex: "0 0 auto",
                  width: "clamp(200px, 22vw, 280px)",
                  scrollSnapAlign: "start",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: C.parchment,
                  aspectRatio: "3/4",
                  marginBottom: 14,
                  transition: "transform 0.25s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <img
                    src={p.img}
                    alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                  {p.name}
                </p>
                <p style={{ fontSize: 13, color: C.inkMuted }}>{p.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.hairline}`, backgroundColor: C.parchment }}>
        <div style={{
          maxWidth: 1240, margin: "0 auto", padding: "40px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 16,
        }}>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.2em", color: C.ink }}>
            MOI
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Returns", "Shipping", "FAQ", "Contact"].map((l) => (
              <a key={l} href="#" style={{ fontSize: 12, color: C.inkMuted, textDecoration: "none", letterSpacing: "0.01em" }}>
                {l}
              </a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.inkFaint }}>© 2025 MOI. All rights reserved.</p>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .hidden.md\\:block { display: block !important; }
          .md\\:hidden { display: none !important; }
        }
        @media (max-width: 767px) {
          .hidden.md\\:block { display: none !important; }
          .md\\:hidden { display: block !important; }
        }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
