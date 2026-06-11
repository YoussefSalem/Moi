import { useState } from "react";

const DOMAIN = "https://3095ac8c-c529-4d3f-b18a-1650accab2e5-00-2nu3cckgl9eyi.kirk.replit.dev";

const COLORS = [
  { name: "Light Blue", swatch: "#a8c8d8", images: [`${DOMAIN}/images/light-blue.jpg`, `${DOMAIN}/images/light-blue-alt-1.jpg`, `${DOMAIN}/images/light-blue-alt-2.jpg`] },
  { name: "Mint",       swatch: "#98c8a8", images: [`${DOMAIN}/images/mint.jpg`, `${DOMAIN}/images/mint-alt-1.jpg`, `${DOMAIN}/images/mint-alt-2.jpg`] },
  { name: "Beige",      swatch: "#c8b8a0", images: [`${DOMAIN}/images/beige.jpg`, `${DOMAIN}/images/beige-alt-1.jpg`, `${DOMAIN}/images/beige-alt-2.jpg`] },
  { name: "Cashmere",   swatch: "#d4c4b0", images: [`${DOMAIN}/images/cashmere-main-new.jpg`, `${DOMAIN}/images/cashmere-alt-1.jpg`, `${DOMAIN}/images/cashmere-alt-2.jpg`] },
  { name: "Teal",       swatch: "#4a8a8a", images: [`${DOMAIN}/images/teal.jpg`, `${DOMAIN}/images/teal-alt-1.jpg`, `${DOMAIN}/images/teal-alt-2.jpg`] },
  { name: "White",      swatch: "#f5f0e8", images: [`${DOMAIN}/images/white.jpg`] },
];

const SIZES = ["XS", "S", "M", "L", "XL"];

const ACCORDION = [
  { key: "fabric",   label: "Fabric & Care",      body: "Crafted from premium Egyptian cotton for all-day comfort. Machine wash at 30°C on a gentle cycle. Lay flat to dry. Iron on low heat with a pressing cloth." },
  { key: "sizing",   label: "Size & Fit",          body: "Designed for an elegant, relaxed silhouette. S & M suit heights up to 1.65 m for a closer drape; L & XL suit taller frames. When between sizes, size up for a more fluid look." },
  { key: "delivery", label: "Delivery & Returns",  body: "Free delivery across Egypt in 2–4 business days. Express next-day delivery available at checkout. Returns accepted within 14 days in original unworn condition with tags attached." },
];

function PlusIcon({ open }: { open: boolean }) {
  return (
    <span style={{ display: "inline-block", width: 16, height: 16, position: "relative", flexShrink: 0, transition: "transform 0.25s ease", transform: open ? "rotate(45deg)" : "none" }}>
      <span style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#1a1410", transform: "translateY(-50%)" }} />
      <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#1a1410", transform: "translateX(-50%)" }} />
    </span>
  );
}

export function Redesign() {
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const color = COLORS[selectedColor];
  const images = color.images;
  const mainImg = images[galleryIdx] ?? images[0];

  function handleColorSelect(idx: number) { setSelectedColor(idx); setGalleryIdx(0); }
  function handleAdd() { setAdded(true); setTimeout(() => setAdded(false), 2000); }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; background: none; border: none; }
        img { display: block; }

        /* ── Desktop 3-col ── */
        .product-layout {
          display: grid;
          grid-template-columns: 1fr 1.8fr 1fr;
          padding: 0 40px 80px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .left-col  { padding-right: 48px; padding-top: 8px; }
        .right-col { padding-left: 48px;  padding-top: 8px; }
        .mobile-info { display: none; }
        .mobile-cta-bar { display: none; }

        @media (max-width: 768px) {
          /* header */
          .header-inner { padding: 0 20px !important; }
          .breadcrumb   { display: none !important; }

          /* layout reset */
          .product-layout {
            display: block;
            padding: 0 0 120px;
          }

          /* hide desktop left/right, show mobile info */
          .left-col  { display: none; }
          .right-col { display: none; }
          .mobile-info { display: block; padding: 20px 20px 0; }
          .mobile-cta-bar { display: flex; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,248,245,0.96)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(26,20,16,0.08)" }}>
        <div className="header-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 60 }}>
          <button style={{ display: "flex", flexDirection: "column", gap: 5, padding: 4 }}>
            <span style={{ display: "block", width: 22, height: 1, background: "#1a1410" }} />
            <span style={{ display: "block", width: 22, height: 1, background: "#1a1410" }} />
          </button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, letterSpacing: "0.22em", color: "#1a1410", fontWeight: 400 }}>MOI</span>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {["🔍","♡","🛍"].map((icon, i) => <button key={i} style={{ fontSize: 16, opacity: 0.7 }}>{icon}</button>)}
          </div>
        </div>
      </header>

      {/* ── Breadcrumb (desktop only) ── */}
      <div className="breadcrumb" style={{ padding: "14px 40px", display: "flex", gap: 8, alignItems: "center" }}>
        {["Home", "New Collection", "Moi Wavvy"].map((seg, i, arr) => (
          <span key={seg} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: i === arr.length - 1 ? "#1a1410" : "rgba(26,20,16,0.45)" }}>{seg}</span>
            {i < arr.length - 1 && <span style={{ color: "rgba(26,20,16,0.3)", fontSize: 10 }}>/</span>}
          </span>
        ))}
      </div>

      {/* ── Main layout ── */}
      <div className="product-layout">

        {/* LEFT (desktop) */}
        <div className="left-col">
          <p style={{ fontSize: 9.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", marginBottom: 16 }}>New Collection</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 46, fontWeight: 400, lineHeight: 1.05, color: "#1a1410", marginBottom: 8 }}>MOI<br />WAVVY</h1>
          <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)", marginBottom: 20 }}>{color.name}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 24 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: "#c83232" }}>899 EGP</span>
            <span style={{ fontSize: 13, color: "rgba(26,20,16,0.38)", textDecoration: "line-through" }}>1,500 EGP</span>
            <span style={{ fontSize: 10, color: "#c83232", fontWeight: 600 }}>−40%</span>
          </div>
          <div style={{ marginBottom: 32 }}>
            {["The ultimate throw-and-go piece.", "Effortless design makes it easy to wear.", "Wavy is light for all-day comfort.", "Breathable fabric keeps you cool.", "Made for drifting with ease."].map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 1, height: 14, background: "rgba(26,20,16,0.25)", flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 12.5, color: "rgba(26,20,16,0.65)", lineHeight: 1.7, letterSpacing: "0.02em" }}>{line}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(26,20,16,0.1)" }}>
            {ACCORDION.map(item => (
              <div key={item.key} style={{ borderBottom: "1px solid rgba(26,20,16,0.1)" }}>
                <button onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
                  <span style={{ fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "#1a1410", fontWeight: 600 }}>{item.label}</span>
                  <PlusIcon open={openAccordion === item.key} />
                </button>
                {openAccordion === item.key && <p style={{ fontSize: 12, color: "rgba(26,20,16,0.6)", lineHeight: 1.85, paddingBottom: 16 }}>{item.body}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Gallery */}
        <div className="center-col" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative", background: "#f0ece6", overflow: "hidden" }}>
            <img key={mainImg} src={mainImg} alt="Moi Wavvy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "top center" }} />
            <button onClick={() => setGalleryIdx((galleryIdx - 1 + images.length) % images.length)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(250,248,245,0.85)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
              <span style={{ fontSize: 16, color: "#1a1410" }}>‹</span>
            </button>
            <button onClick={() => setGalleryIdx((galleryIdx + 1) % images.length)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(250,248,245,0.85)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
              <span style={{ fontSize: 16, color: "#1a1410" }}>›</span>
            </button>
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
              {images.map((_, i) => <button key={i} onClick={() => setGalleryIdx(i)} style={{ width: i === galleryIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === galleryIdx ? "#1a1410" : "rgba(26,20,16,0.3)", transition: "all 0.25s", border: "none", padding: 0 }} />)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {images.map((img, i) => (
              <button key={i} onClick={() => setGalleryIdx(i)} style={{ flex: 1, overflow: "hidden", outline: i === galleryIdx ? "2px solid #1a1410" : "2px solid transparent", outlineOffset: 2, transition: "outline 0.2s" }}>
                <img src={img} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "top center" }} />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT (desktop) */}
        <div className="right-col">
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)", marginBottom: 14 }}>Colour — <span style={{ color: "#1a1410" }}>{color.name}</span></p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {COLORS.map((c, i) => <button key={c.name} onClick={() => handleColorSelect(i)} title={c.name} style={{ width: 28, height: 28, borderRadius: "50%", background: c.swatch, border: i === selectedColor ? "2px solid #1a1410" : "2px solid transparent", outline: i === selectedColor ? "none" : "1px solid rgba(26,20,16,0.18)", outlineOffset: 2, transition: "all 0.2s", transform: i === selectedColor ? "scale(1.15)" : "scale(1)" }} />)}
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)" }}>Size</p>
              <button style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", textDecoration: "underline" }}>Size Guide</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SIZES.map(size => <button key={size} onClick={() => setSelectedSize(size)} style={{ padding: "10px 16px", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: selectedSize === size ? "#faf8f5" : "#1a1410", background: selectedSize === size ? "#1a1410" : "transparent", border: `1px solid ${selectedSize === size ? "#1a1410" : "rgba(26,20,16,0.2)"}`, transition: "all 0.18s" }}>{size}</button>)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            <button onClick={handleAdd} style={{ width: "100%", padding: "16px 24px", background: added ? "#3a7a4a" : "#1a1410", color: "#faf8f5", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600, transition: "background 0.25s" }}>{added ? "Added ✓" : "Add to Bag"}</button>
            <button style={{ width: "100%", padding: "16px 24px", background: "transparent", color: "#1a1410", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600, border: "1px solid rgba(26,20,16,0.3)" }}>Buy It Now</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 20, borderTop: "1px solid rgba(26,20,16,0.08)" }}>
            {[{ icon: "🚚", label: "Free shipping across Egypt" }, { icon: "↩", label: "14-day returns" }, { icon: "🔒", label: "Secure checkout" }].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 13 }}>{icon}</span><span style={{ fontSize: 10.5, color: "rgba(26,20,16,0.55)" }}>{label}</span></div>
            ))}
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 6, alignItems: "center" }}>
            {[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= 4 ? "#c8a040" : "rgba(26,20,16,0.2)", fontSize: 12 }}>★</span>)}
            <span style={{ fontSize: 11, color: "rgba(26,20,16,0.5)", marginLeft: 4 }}>4.8 (124 reviews)</span>
          </div>
        </div>

      </div>{/* end .product-layout */}

      {/* ══════════════════════════════════════════════
          MOBILE ONLY — Info section below the gallery
          ══════════════════════════════════════════════ */}
      <div className="mobile-info">
        {/* Name + price row */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", marginBottom: 10 }}>New Collection</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 400, lineHeight: 1.05, color: "#1a1410", marginBottom: 6 }}>MOI WAVVY</h1>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: "#c83232" }}>899 EGP</span>
            <span style={{ fontSize: 12, color: "rgba(26,20,16,0.38)", textDecoration: "line-through" }}>1,500 EGP</span>
            <span style={{ fontSize: 10, color: "#c83232", fontWeight: 600 }}>−40%</span>
          </div>
        </div>

        {/* Description bullets */}
        <div style={{ marginBottom: 24 }}>
          {["The ultimate throw-and-go piece.", "Effortless design makes it easy to wear.", "Wavy is light for all-day comfort.", "Breathable fabric keeps you cool.", "Made for drifting with ease."].map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 1, height: 14, background: "rgba(26,20,16,0.25)", flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: 13, color: "rgba(26,20,16,0.65)", lineHeight: 1.7 }}>{line}</span>
            </div>
          ))}
        </div>

        {/* Color */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)", marginBottom: 12 }}>Colour — <span style={{ color: "#1a1410" }}>{color.name}</span></p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {COLORS.map((c, i) => <button key={c.name} onClick={() => handleColorSelect(i)} title={c.name} style={{ width: 32, height: 32, borderRadius: "50%", background: c.swatch, border: i === selectedColor ? "2px solid #1a1410" : "2px solid transparent", outline: i === selectedColor ? "none" : "1px solid rgba(26,20,16,0.18)", outlineOffset: 2, transition: "all 0.2s", transform: i === selectedColor ? "scale(1.12)" : "scale(1)" }} />)}
          </div>
        </div>

        {/* Size */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)" }}>Size</p>
            <button style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", textDecoration: "underline" }}>Size Guide</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SIZES.map(size => <button key={size} onClick={() => setSelectedSize(size)} style={{ padding: "11px 18px", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: selectedSize === size ? "#faf8f5" : "#1a1410", background: selectedSize === size ? "#1a1410" : "transparent", border: `1px solid ${selectedSize === size ? "#1a1410" : "rgba(26,20,16,0.2)"}`, transition: "all 0.18s" }}>{size}</button>)}
          </div>
        </div>

        {/* Trust */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "20px 0", borderTop: "1px solid rgba(26,20,16,0.08)" }}>
          {[{ icon: "🚚", label: "Free shipping across Egypt" }, { icon: "↩", label: "14-day returns" }, { icon: "🔒", label: "Secure checkout" }].map(({ icon, label }) => (
            <div key={label} style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 14 }}>{icon}</span><span style={{ fontSize: 12, color: "rgba(26,20,16,0.55)" }}>{label}</span></div>
          ))}
        </div>

        {/* Accordions */}
        <div style={{ borderTop: "1px solid rgba(26,20,16,0.1)", marginBottom: 8 }}>
          {ACCORDION.map(item => (
            <div key={item.key} style={{ borderBottom: "1px solid rgba(26,20,16,0.1)" }}>
              <button onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
                <span style={{ fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "#1a1410", fontWeight: 600 }}>{item.label}</span>
                <PlusIcon open={openAccordion === item.key} />
              </button>
              {openAccordion === item.key && <p style={{ fontSize: 13, color: "rgba(26,20,16,0.6)", lineHeight: 1.85, paddingBottom: 16 }}>{item.body}</p>}
            </div>
          ))}
        </div>

        {/* Stars */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "16px 0" }}>
          {[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= 4 ? "#c8a040" : "rgba(26,20,16,0.2)", fontSize: 14 }}>★</span>)}
          <span style={{ fontSize: 12, color: "rgba(26,20,16,0.5)", marginLeft: 6 }}>4.8 (124 reviews)</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MOBILE ONLY — Sticky bottom CTA bar
          ══════════════════════════════════════════════ */}
      <div
        className="mobile-cta-bar"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: "rgba(250,248,245,0.97)", backdropFilter: "blur(10px)", borderTop: "1px solid rgba(26,20,16,0.1)", padding: "12px 20px 20px", flexDirection: "column", gap: 8 }}
      >
        <button onClick={handleAdd} style={{ width: "100%", padding: "15px 24px", background: added ? "#3a7a4a" : "#1a1410", color: "#faf8f5", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600, transition: "background 0.25s" }}>{added ? "Added ✓" : "Add to Bag"}</button>
        <button style={{ width: "100%", padding: "13px 24px", background: "transparent", color: "#1a1410", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600, border: "1px solid rgba(26,20,16,0.3)" }}>Buy It Now</button>
      </div>
    </div>
  );
}
