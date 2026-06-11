import { useState, useRef, useCallback, useEffect } from "react";

// ── Moi design tokens ───────────────────────────────────────────
const C = {
  bg:       "#faf8f5",          // warm off-white
  surface:  "#eee8e2",          // slightly warmer parchment
  surface2: "#f4f0eb",          // mid-tone tile
  dark:     "#342b26",          // footer / nav dark
  ink:      "#1e1814",          // near-black espresso
  muted:    "#7a6e64",          // taupe
  faint:    "#a9a09a",          // light taupe
  border:   "rgba(30,24,20,0.10)",
  borderSolid: "#d4cdc8",
  cta:      "#1e1814",          // primary CTA button
  ctaHover: "#342b26",
};

const serif   = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const sans    = '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif';

// ── Image data ──────────────────────────────────────────────────
const COLOR_GALLERY: Record<string, string[]> = {
  White: [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=85&auto=format&fit=crop",
  ],
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
    "https://images.unsplash.com/photo-1543525238-54e3d131d627?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=85&auto=format&fit=crop",
  ],
  "Light Blue": [
    "https://images.unsplash.com/photo-1481233085934-e3c49c9e18dc?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1532453288672-3a17cdc67d4f?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=85&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=85&auto=format&fit=crop",
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
  { name: "White",      hex: "#f0ece5", border: "#c8c2ba" },
  { name: "Cashmere",   hex: "#c9aa87", border: "#b89870" },
  { name: "Beige",      hex: "#d6c4a8", border: "#c4b090" },
  { name: "Teal",       hex: "#5f9ea0", border: "#4e8a8c" },
  { name: "Light Blue", hex: "#a8c8e0", border: "#90b4d0" },
  { name: "Navy",       hex: "#1e2d5a", border: "#162245" },
  { name: "Mint",       hex: "#98d4b8", border: "#7ec0a4" },
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
  { name: "MOI VERSA TOP",    price: "1,399 EGP", img: "https://images.unsplash.com/photo-1598522325074-042db73aa4e6?w=600&q=80&auto=format&fit=crop" },
  { name: "TRIO BANGLES",     price: "890 EGP",   img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80&auto=format&fit=crop" },
  { name: "MOI DRAPE DRESS",  price: "1,890 EGP", img: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&q=80&auto=format&fit=crop" },
  { name: "SILK SCARF",       price: "490 EGP",   img: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80&auto=format&fit=crop" },
  { name: "LINEN WIDE LEG",   price: "1,290 EGP", img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80&auto=format&fit=crop" },
  { name: "WRAP SKIRT",       price: "999 EGP",   img: "https://images.unsplash.com/photo-1546938576-6e12d9468cbe?w=600&q=80&auto=format&fit=crop" },
];

// ── Sub-components ───────────────────────────────────────────────
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= Math.floor(rating);
        const half   = !filled && s - 0.5 <= rating;
        return (
          <svg key={s} width={size} height={size} viewBox="0 0 12 12">
            <defs>
              <linearGradient id={`hg-${s}`}>
                <stop offset="50%" stopColor={C.ink} />
                <stop offset="50%" stopColor={C.borderSolid} />
              </linearGradient>
            </defs>
            <path
              d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z"
              fill={filled ? C.ink : half ? `url(#hg-${s})` : C.borderSolid}
            />
          </svg>
        );
      })}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function AppleStyle() {
  const [selectedColor, setSelectedColor] = useState(COLORS[0].name);
  const [selectedSize,  setSelectedSize]  = useState<string | null>(null);
  const [activeImg,     setActiveImg]     = useState(0);
  const [showAll,       setShowAll]       = useState(false);
  const [addedToBag,    setAddedToBag]    = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [mobileIdx,     setMobileIdx]     = useState(0);
  const [isDesktop,     setIsDesktop]     = useState(window.innerWidth >= 900);
  const touchX = useRef(0);

  useEffect(() => {
    // Inject Google Fonts into <head>
    const id = "moi-gfonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap";
      document.head.appendChild(link);
    }
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const gallery = COLOR_GALLERY[selectedColor] ?? COLOR_GALLERY["White"];

  const handleColor = (name: string) => {
    setSelectedColor(name);
    setActiveImg(0);
    setMobileIdx(0);
  };

  const handleAddToBag = useCallback(() => {
    if (!selectedSize) return;
    setAddedToBag(true);
    setTimeout(() => setAddedToBag(false), 2400);
  }, [selectedSize]);

  // ── shared label style ──
  const label = (extra?: object) => ({
    fontFamily: sans,
    fontSize: 10,
    fontWeight: 600 as const,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
    color: C.muted,
    ...extra,
  });

  return (
    <div style={{ fontFamily: sans, backgroundColor: C.bg, color: C.ink, minHeight: "100vh" }}>

      {/* ─── BASE STYLES ──────────────────────────────────────── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
        .swatch:hover { transform: scale(1.12) !important; }
        .cta-btn:hover { background-color: ${C.ctaHover} !important; }
        .outline-btn:hover { background-color: ${C.surface2} !important; }
        .thumb:hover { opacity: 1 !important; }
        .rec-img:hover { transform: scale(1.03) !important; }
      `}</style>

      {/* ─── NAV ──────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        backgroundColor: "rgba(250,248,245,0.88)",
        backdropFilter: "saturate(160%) blur(16px)",
        WebkitBackdropFilter: "saturate(160%) blur(16px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "0 28px",
          height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}>
            <svg width={17} height={17} viewBox="0 0 17 17" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke={C.ink} strokeWidth="1.3"/>
              <line x1="11.5" y1="11.5" x2="15" y2="15" stroke={C.ink} strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>

          <a href="#" style={{
            fontFamily: serif,
            fontSize: 24, fontWeight: 400, letterSpacing: "0.32em",
            color: C.ink, textDecoration: "none",
          }}>MOI</a>

          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}>
            <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
              <path d="M3 4.5h12l-1.5 9H4.5L3 4.5z" stroke={C.ink} strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M6.5 4.5V3a2.5 2.5 0 015 0v1.5" stroke={C.ink} strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════
          DESKTOP  ≥ 900 px
      ════════════════════════════════════════════════════════ */}
      <div style={{ display: isDesktop ? "block" : "none" }}>
        {/* Breadcrumb */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 28px 0" }}>
          <p style={{ ...label(), color: C.faint }}>
            <a href="#" style={{ color: C.muted, textDecoration: "none" }}>Clothing</a>
            <span style={{ margin: "0 8px" }}>›</span>
            <span style={{ color: C.ink }}>Wavvy Top</span>
          </p>
        </div>

        {/* 3-col grid */}
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          padding: "44px 28px 96px",
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr 1fr",
          gap: 72,
          alignItems: "start",
        }}>

          {/* ── LEFT: story ── */}
          <div style={{ paddingTop: 4 }}>
            <p style={label({ marginBottom: 18 })}>New Arrival</p>

            <h1 style={{
              fontFamily: serif,
              fontSize: 48, fontWeight: 400, lineHeight: 1.05,
              letterSpacing: "0.04em", color: C.ink, marginBottom: 18,
            }}>
              MOI WAVVY
            </h1>

            <p style={{
              fontFamily: serif,
              fontSize: 22, fontWeight: 300, fontStyle: "italic",
              lineHeight: 1.5, color: C.muted, marginBottom: 36,
              letterSpacing: "0.02em",
            }}>
              Effortlessly draped.<br/>Infinitely wearable.
            </p>

            <div style={{ height: 1, backgroundColor: C.border, marginBottom: 36 }} />

            <p style={{
              fontSize: 14, lineHeight: 1.75, letterSpacing: "0.02em",
              color: C.ink, marginBottom: 32, fontWeight: 300,
            }}>
              Woven from 100% premium cotton in a relaxed silhouette that moves with you. The WAVVY top features a signature asymmetric hem and deep-set side seams — designed to layer beautifully or stand alone.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Material", "100% Premium Egyptian Cotton"],
                ["Fit",      "Relaxed — asymmetric hem"],
                ["Care",     "Machine wash cold, lay flat"],
                ["Origin",   "Locally crafted in Egypt"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 20 }}>
                  <span style={{ ...label({ minWidth: 68 }) }}>{k}</span>
                  <span style={{ fontSize: 13, color: C.ink, fontWeight: 300, letterSpacing: "0.02em" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── CENTER: gallery ── */}
          <div>
            {/* Main image */}
            <div style={{
              overflow: "hidden",
              aspectRatio: "3/4",
              backgroundColor: C.surface,
              boxShadow: "0 16px 56px rgba(30,24,20,0.10)",
            }}>
              <img
                src={gallery[activeImg]}
                alt="Product"
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover", display: "block",
                  transition: "opacity 0.25s ease",
                }}
              />
            </div>

            {/* Thumbnails */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
              {gallery.map((img, i) => (
                <button
                  key={i}
                  className="thumb"
                  onClick={() => setActiveImg(i)}
                  style={{
                    width: 58, height: 76, border: "none", padding: 0, cursor: "pointer",
                    overflow: "hidden",
                    outline: activeImg === i ? `1.5px solid ${C.ink}` : `1px solid ${C.border}`,
                    outlineOffset: activeImg === i ? 2 : 0,
                    opacity: activeImg === i ? 1 : 0.48,
                    transition: "opacity 0.2s, outline 0.15s",
                    flexShrink: 0,
                    background: "none",
                  }}
                >
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          </div>

          {/* ── RIGHT: purchase ── */}
          <div style={{ paddingTop: 4 }}>
            {/* Price */}
            <div style={{ marginBottom: 28 }}>
              <p style={{
                fontFamily: serif,
                fontSize: 34, fontWeight: 400, letterSpacing: "0.04em", color: C.ink,
              }}>
                899 EGP
              </p>
              <p style={{ fontSize: 11, color: C.faint, marginTop: 6, letterSpacing: "0.04em", fontWeight: 300 }}>
                Free delivery on orders over 1,500 EGP
              </p>
            </div>

            <div style={{ height: 1, backgroundColor: C.border, marginBottom: 28 }} />

            {/* Color */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <span style={label()}>Color</span>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 300, letterSpacing: "0.04em" }}>{selectedColor}</span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    className="swatch"
                    onClick={() => handleColor(c.name)}
                    title={c.name}
                    style={{
                      width: 26, height: 26, borderRadius: "50%",
                      backgroundColor: c.hex,
                      border: selectedColor === c.name
                        ? `2px solid ${C.ink}`
                        : `1.5px solid ${c.border}`,
                      cursor: "pointer", padding: 0,
                      transition: "transform 0.15s",
                      transform: selectedColor === c.name ? "scale(1.14)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <span style={label()}>Size</span>
                <a href="#" style={{ fontSize: 11, color: C.muted, textDecoration: "underline", textUnderlineOffset: 3, letterSpacing: "0.06em", fontWeight: 400 }}>
                  Size guide
                </a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    style={{
                      height: 40,
                      border: selectedSize === sz ? `1.5px solid ${C.ink}` : `1px solid ${C.borderSolid}`,
                      borderRadius: 0,
                      backgroundColor: selectedSize === sz ? C.ink : "transparent",
                      color: selectedSize === sz ? "#faf8f5" : C.ink,
                      fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
                      cursor: "pointer", fontFamily: sans,
                      transition: "all 0.15s",
                    }}
                  >{sz}</button>
                ))}
              </div>
              {!selectedSize && (
                <p style={{ fontSize: 11, color: C.faint, marginTop: 8, letterSpacing: "0.04em" }}>
                  Select a size to continue
                </p>
              )}
            </div>

            {/* CTA */}
            <button
              className="cta-btn"
              onClick={handleAddToBag}
              style={{
                width: "100%", height: 48,
                backgroundColor: addedToBag ? "#2d6a4f" : C.cta,
                color: "#faf8f5",
                border: "none", borderRadius: 0,
                fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: selectedSize ? "pointer" : "not-allowed",
                opacity: selectedSize ? 1 : 0.38,
                transition: "background-color 0.3s, opacity 0.2s",
                fontFamily: sans,
                marginBottom: 12,
              }}
            >
              {addedToBag ? "Added to Bag ✓" : "Add to Bag"}
            </button>

            <button
              className="outline-btn"
              onClick={() => setSaved(!saved)}
              style={{
                width: "100%", height: 48,
                backgroundColor: "transparent",
                border: `1px solid ${C.borderSolid}`,
                borderRadius: 0,
                color: C.ink,
                fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: sans,
                transition: "background-color 0.15s",
              }}
            >
              {saved ? "♥  Saved" : "♡  Save"}
            </button>

            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating rating={4.7} />
              <a href="#reviews" style={{ fontSize: 11, color: C.muted, textDecoration: "underline", textUnderlineOffset: 3, letterSpacing: "0.04em" }}>
                47 Reviews
              </a>
            </div>
          </div>

        </div>{/* end 3-col */}
      </div>{/* end desktop */}

      {/* ════════════════════════════════════════════════════════
          MOBILE  < 900 px
      ════════════════════════════════════════════════════════ */}
      <div style={{ display: isDesktop ? "none" : "block", paddingBottom: 96 }}>
        {/* Swipeable gallery */}
        <div
          style={{ position: "relative", backgroundColor: C.surface, overflow: "hidden" }}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = touchX.current - e.changedTouches[0].clientX;
            if (Math.abs(dx) > 40) {
              if (dx > 0) setMobileIdx((i) => Math.min(i + 1, gallery.length - 1));
              else        setMobileIdx((i) => Math.max(i - 1, 0));
            }
          }}
        >
          <div style={{
            display: "flex",
            transform: `translateX(-${mobileIdx * 100}%)`,
            transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
          }}>
            {gallery.map((img, i) => (
              <div key={i} style={{ flex: "0 0 100%", aspectRatio: "3/4" }}>
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
          {/* Dots */}
          <div style={{
            position: "absolute", bottom: 14, left: 0, right: 0,
            display: "flex", justifyContent: "center", gap: 6,
          }}>
            {gallery.map((_, i) => (
              <button key={i} onClick={() => setMobileIdx(i)} style={{
                width: mobileIdx === i ? 18 : 6, height: 6, borderRadius: 9999,
                border: "none", padding: 0, cursor: "pointer",
                backgroundColor: mobileIdx === i ? C.bg : "rgba(250,248,245,0.5)",
                transition: "width 0.22s, background-color 0.22s",
              }} />
            ))}
          </div>
        </div>

        {/* Info block */}
        <div style={{ padding: "28px 20px 0" }}>
          <p style={label({ marginBottom: 10 })}>New Arrival</p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, letterSpacing: "0.04em", lineHeight: 1.1, color: C.ink }}>
                MOI WAVVY
              </h1>
              <p style={{ fontFamily: serif, fontSize: 16, fontStyle: "italic", fontWeight: 300, color: C.muted, marginTop: 6 }}>
                Effortlessly draped.
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, letterSpacing: "0.04em", color: C.ink }}>
                899 EGP
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 6 }}>
                <StarRating rating={4.7} size={11} />
                <span style={{ fontSize: 11, color: C.faint, letterSpacing: "0.02em" }}>47</span>
              </div>
            </div>
          </div>

          {/* Color */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={label()}>Color</span>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 300, letterSpacing: "0.04em" }}>{selectedColor}</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  className="swatch"
                  onClick={() => handleColor(c.name)}
                  title={c.name}
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    backgroundColor: c.hex,
                    border: selectedColor === c.name ? `2px solid ${C.ink}` : `1.5px solid ${c.border}`,
                    cursor: "pointer", padding: 0,
                    transform: selectedColor === c.name ? "scale(1.12)" : "scale(1)",
                    transition: "transform 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={label()}>Size</span>
              <a href="#" style={{ fontSize: 11, color: C.muted, textDecoration: "underline", textUnderlineOffset: 3, letterSpacing: "0.04em" }}>Guide</a>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {SIZES.map((sz) => (
                <button key={sz} onClick={() => setSelectedSize(sz)} style={{
                  flex: 1, height: 42,
                  border: selectedSize === sz ? `1.5px solid ${C.ink}` : `1px solid ${C.borderSolid}`,
                  borderRadius: 0,
                  backgroundColor: selectedSize === sz ? C.ink : "transparent",
                  color: selectedSize === sz ? "#faf8f5" : C.ink,
                  fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
                  cursor: "pointer", fontFamily: sans,
                  transition: "all 0.15s",
                }}>{sz}</button>
              ))}
            </div>
          </div>

          {/* Desc */}
          <p style={{
            fontSize: 13, lineHeight: 1.75, color: C.muted,
            marginTop: 28, fontWeight: 300, letterSpacing: "0.02em",
          }}>
            100% premium Egyptian cotton. Relaxed silhouette with signature asymmetric hem. Locally crafted.
          </p>
        </div>

        {/* Sticky bottom bar */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
          backgroundColor: "rgba(250,248,245,0.95)",
          backdropFilter: "blur(16px)",
          borderTop: `1px solid ${C.border}`,
          padding: "12px 20px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          display: "flex", gap: 10,
        }}>
          <button
            onClick={() => setSaved(!saved)}
            style={{
              width: 48, height: 48, borderRadius: 0, flexShrink: 0,
              border: `1px solid ${C.borderSolid}`,
              backgroundColor: "transparent",
              color: saved ? "#9b2335" : C.muted,
              fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: sans,
            }}
          >
            {saved ? "♥" : "♡"}
          </button>
          <button
            className="cta-btn"
            onClick={handleAddToBag}
            style={{
              flex: 1, height: 48, borderRadius: 0,
              backgroundColor: addedToBag ? "#2d6a4f" : C.cta,
              color: "#faf8f5", border: "none",
              fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
              cursor: selectedSize ? "pointer" : "not-allowed",
              opacity: selectedSize ? 1 : 0.42,
              transition: "background-color 0.3s",
              fontFamily: sans,
            }}
          >
            {addedToBag ? "Added ✓" : `Add to Bag — 899 EGP`}
          </button>
        </div>
      </div>{/* end mobile */}

      {/* ════════════════════════════════════════════════════════
          REVIEWS — warm surface tile
      ════════════════════════════════════════════════════════ */}
      <div id="reviews" style={{ backgroundColor: C.surface2 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 28px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 52, flexWrap: "wrap", gap: 20 }}>
            <div>
              <p style={label({ marginBottom: 14 })}>Customer Reviews</p>
              <h2 style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, letterSpacing: "0.04em", color: C.ink, marginBottom: 14 }}>
                What Our Customers Say
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StarRating rating={4.7} size={14} />
                <span style={{ fontSize: 14, fontWeight: 300, color: C.ink }}>4.7</span>
                <span style={{ fontSize: 14, color: C.muted, fontWeight: 300 }}>· 47 reviews</span>
              </div>
            </div>
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                background: "none",
                border: `1px solid ${C.borderSolid}`,
                borderRadius: 0, padding: "11px 28px",
                fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
                color: C.ink, cursor: "pointer", fontFamily: sans,
                backgroundColor: C.bg,
              }}
            >
              {showAll ? "Show Less" : "View All Reviews"}
            </button>
          </div>

          {/* Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {(showAll ? REVIEWS : REVIEWS.slice(0, 3)).map((r, i) => (
              <div key={i} style={{
                backgroundColor: C.bg,
                padding: "28px 28px 32px",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <StarRating rating={r.rating} size={12} />
                  {r.verified && (
                    <span style={{ fontSize: 10, color: "#2d6a4f", fontWeight: 600, letterSpacing: "0.08em" }}>✓ Verified</span>
                  )}
                </div>
                <p style={{ fontFamily: serif, fontSize: 17, fontWeight: 400, color: C.ink, marginBottom: 10, lineHeight: 1.3, letterSpacing: "0.02em" }}>
                  {r.title}
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: C.muted, marginBottom: 18, fontWeight: 300 }}>
                  {r.body}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28,
                    backgroundColor: C.surface,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: serif, fontSize: 14, fontWeight: 600, color: C.muted,
                  }}>
                    {r.author[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: C.ink, letterSpacing: "0.06em" }}>{r.author}</p>
                    <p style={{ fontSize: 11, color: C.faint, fontWeight: 300, marginTop: 2 }}>{r.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          RECOMMENDED
      ════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: C.bg }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 0 88px 28px" }}>
          <p style={label({ marginBottom: 14 })}>You May Also Like</p>
          <h2 style={{
            fontFamily: serif,
            fontSize: 32, fontWeight: 400, letterSpacing: "0.04em", color: C.ink, marginBottom: 40,
          }}>
            Curated For You
          </h2>

          <div style={{
            display: "flex", gap: 16,
            overflowX: "auto",
            paddingBottom: 16, paddingRight: 28,
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}>
            {RECOMMENDED.map((p, i) => (
              <div key={i} style={{ flex: "0 0 auto", width: "clamp(180px, 20vw, 260px)", scrollSnapAlign: "start", cursor: "pointer" }}>
                <div
                  className="rec-img"
                  style={{
                    overflow: "hidden",
                    aspectRatio: "3/4",
                    backgroundColor: C.surface,
                    marginBottom: 14,
                    transition: "transform 0.28s cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  <img src={p.img} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <p style={{ ...label({ marginBottom: 5 }) }}>{p.name}</p>
                <p style={{ fontFamily: serif, fontSize: 16, fontWeight: 400, color: C.muted, letterSpacing: "0.04em" }}>
                  {p.price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.dark }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "48px 28px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 24,
        }}>
          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, letterSpacing: "0.32em", color: "#faf8f5" }}>
            MOI
          </span>
          <div style={{ display: "flex", gap: 28 }}>
            {["Returns", "Shipping", "FAQ", "Contact"].map((l) => (
              <a key={l} href="#" style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "rgba(250,248,245,0.5)", textDecoration: "none",
              }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "rgba(250,248,245,0.3)", letterSpacing: "0.04em", fontWeight: 300 }}>
            © 2025 MOI. All rights reserved.
          </p>
        </div>
      </div>

    </div>
  );
}
