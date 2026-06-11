import { useState } from "react";

const DOMAIN = "https://3095ac8c-c529-4d3f-b18a-1650accab2e5-00-2nu3cckgl9eyi.kirk.replit.dev";

const IMAGES = [
  `${DOMAIN}/images/light-blue.jpg`,
  `${DOMAIN}/images/light-blue-alt-1.jpg`,
  `${DOMAIN}/images/light-blue-alt-2.jpg`,
];

export function Redesign() {
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [added, setAdded] = useState(false);

  const mainImg = IMAGES[galleryIdx];

  function handleAddToCart() {
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; background: none; border: none; }
        img { display: block; }

        .product-layout {
          display: grid;
          grid-template-columns: 1fr 1.8fr 1fr;
          gap: 0;
          padding: 0 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .product-layout {
            grid-template-columns: 1fr;
            padding: 0 20px 48px;
          }
          .left-col { order: 2; padding: 24px 0 0 0 !important; }
          .center-col { order: 1; }
          .right-col { order: 3; padding: 24px 0 0 0 !important; }
          .header-inner { padding: 0 20px !important; }
          .breadcrumb { padding: 12px 20px !important; }
          .heading { font-size: 36px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(250,248,245,0.96)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(26,20,16,0.08)",
      }}>
        <div className="header-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 60 }}>
          <button style={{ display: "flex", flexDirection: "column", gap: 5, padding: 4 }}>
            <span style={{ display: "block", width: 22, height: 1, background: "#1a1410" }} />
            <span style={{ display: "block", width: 22, height: 1, background: "#1a1410" }} />
          </button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, letterSpacing: "0.22em", color: "#1a1410", fontWeight: 400 }}>
            MOI
          </span>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {["🔍","♡","🛍"].map((icon, i) => (
              <button key={i} style={{ fontSize: 16, opacity: 0.7 }}>{icon}</button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Breadcrumb ── */}
      <div className="breadcrumb" style={{ padding: "14px 40px", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)" }}>Home</span>
        <span style={{ color: "rgba(26,20,16,0.3)", fontSize: 10 }}>/</span>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)" }}>New Collection</span>
        <span style={{ color: "rgba(26,20,16,0.3)", fontSize: 10 }}>/</span>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1a1410" }}>Moi Wavvy</span>
      </div>

      {/* ── Main layout ── */}
      <div className="product-layout">

        {/* ── LEFT: Info ── */}
        <div className="left-col" style={{ paddingRight: 48, paddingTop: 8 }}>
          <p style={{ fontSize: 9.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", marginBottom: 16 }}>
            New Collection
          </p>
          <h1 className="heading" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 46, fontWeight: 400, lineHeight: 1.05, color: "#1a1410", marginBottom: 20, letterSpacing: "0.01em" }}>
            MOI<br />WAVVY
          </h1>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 24 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: "#c83232" }}>
              899 EGP
            </span>
            <span style={{ fontSize: 13, color: "rgba(26,20,16,0.38)", textDecoration: "line-through" }}>
              1,500 EGP
            </span>
            <span style={{ fontSize: 10, letterSpacing: "0.08em", color: "#c83232", fontWeight: 600 }}>−40%</span>
          </div>

          {/* Description bullets */}
          <div>
            {[
              "The ultimate throw-and-go piece.",
              "Effortless design makes it easy to wear.",
              "Wavy is light for all-day comfort.",
              "Breathable fabric keeps you cool.",
              "Made for drifting with ease.",
            ].map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                <span style={{ width: 1, height: 14, background: "rgba(26,20,16,0.25)", flexShrink: 0, marginTop: 4 }} />
                <span style={{ fontSize: 12.5, color: "rgba(26,20,16,0.65)", lineHeight: 1.75, letterSpacing: "0.02em" }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Gallery ── */}
        <div className="center-col" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Main image */}
          <div style={{ position: "relative", background: "#f0ece6", overflow: "hidden" }}>
            <img
              key={mainImg}
              src={mainImg}
              alt="Moi Wavvy"
              style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "top center" }}
            />
            {/* Nav arrows */}
            <button
              onClick={() => setGalleryIdx((galleryIdx - 1 + IMAGES.length) % IMAGES.length)}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(250,248,245,0.85)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
            >
              <span style={{ fontSize: 16, color: "#1a1410", lineHeight: 1 }}>‹</span>
            </button>
            <button
              onClick={() => setGalleryIdx((galleryIdx + 1) % IMAGES.length)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(250,248,245,0.85)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
            >
              <span style={{ fontSize: 16, color: "#1a1410", lineHeight: 1 }}>›</span>
            </button>
            {/* Dot indicator */}
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
              {IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setGalleryIdx(i)}
                  style={{ width: i === galleryIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === galleryIdx ? "#1a1410" : "rgba(26,20,16,0.3)", transition: "all 0.25s", border: "none", padding: 0 }}
                />
              ))}
            </div>
          </div>

          {/* Thumbnail strip */}
          <div style={{ display: "flex", gap: 8 }}>
            {IMAGES.map((img, i) => (
              <button
                key={i}
                onClick={() => setGalleryIdx(i)}
                style={{ flex: 1, overflow: "hidden", outline: i === galleryIdx ? "2px solid #1a1410" : "2px solid transparent", outlineOffset: 2, transition: "outline 0.2s" }}
              >
                <img src={img} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "top center" }} />
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: CTA ── */}
        <div className="right-col" style={{ paddingLeft: 48, paddingTop: 8 }}>

          {/* CTA Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            <button
              onClick={handleAddToCart}
              style={{
                width: "100%", padding: "16px 24px",
                background: added ? "#3a7a4a" : "#1a1410",
                color: "#faf8f5",
                fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600,
                border: "none", transition: "background 0.25s",
              }}
            >
              {added ? "Added ✓" : "Add to Bag"}
            </button>
            <button style={{
              width: "100%", padding: "16px 24px",
              background: "transparent", color: "#1a1410",
              fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600,
              border: "1px solid rgba(26,20,16,0.3)",
            }}>
              Buy It Now
            </button>
          </div>

          {/* Trust badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 20, borderTop: "1px solid rgba(26,20,16,0.08)" }}>
            {[
              { icon: "🚚", label: "Free shipping across Egypt" },
              { icon: "↩", label: "14-day returns" },
              { icon: "🔒", label: "Secure checkout" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span style={{ fontSize: 10.5, color: "rgba(26,20,16,0.55)", letterSpacing: "0.04em" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Review stars */}
          <div style={{ marginTop: 24, display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ color: i <= 4 ? "#c8a040" : "rgba(26,20,16,0.2)", fontSize: 12 }}>★</span>
              ))}
            </div>
            <span style={{ fontSize: 11, color: "rgba(26,20,16,0.5)", letterSpacing: "0.04em" }}>4.8 (124 reviews)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
