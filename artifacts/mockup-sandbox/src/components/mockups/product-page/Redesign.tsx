import { useState } from "react";

const DOMAIN = "https://3095ac8c-c529-4d3f-b18a-1650accab2e5-00-2nu3cckgl9eyi.kirk.replit.dev";

const COLORS = [
  { name: "Light Blue", swatch: "#a8c8d8", images: [
    `${DOMAIN}/images/light-blue.jpg`,
    `${DOMAIN}/images/light-blue-alt-1.jpg`,
    `${DOMAIN}/images/light-blue-alt-2.jpg`,
  ]},
  { name: "Mint",       swatch: "#98c8a8", images: [
    `${DOMAIN}/images/mint.jpg`,
    `${DOMAIN}/images/mint-alt-1.jpg`,
    `${DOMAIN}/images/mint-alt-2.jpg`,
  ]},
  { name: "Beige",      swatch: "#c8b8a0", images: [
    `${DOMAIN}/images/beige.jpg`,
    `${DOMAIN}/images/beige-alt-1.jpg`,
    `${DOMAIN}/images/beige-alt-2.jpg`,
  ]},
  { name: "Cashmere",   swatch: "#d4c4b0", images: [
    `${DOMAIN}/images/cashmere-main-new.jpg`,
    `${DOMAIN}/images/cashmere-alt-1.jpg`,
    `${DOMAIN}/images/cashmere-alt-2.jpg`,
  ]},
  { name: "Teal",       swatch: "#4a8a8a", images: [
    `${DOMAIN}/images/teal.jpg`,
    `${DOMAIN}/images/teal-alt-1.jpg`,
    `${DOMAIN}/images/teal-alt-2.jpg`,
  ]},
  { name: "White",      swatch: "#f5f0e8", images: [
    `${DOMAIN}/images/white.jpg`,
  ]},
];

const SIZES = ["XS", "S", "M", "L", "XL"];

const ACCORDION = [
  {
    key: "fabric",
    label: "Fabric & Care",
    body: "Crafted from premium Egyptian cotton for all-day comfort. Machine wash at 30°C on a gentle cycle. Lay flat to dry. Iron on low heat with a pressing cloth.",
  },
  {
    key: "sizing",
    label: "Size & Fit",
    body: "Designed for an elegant, relaxed silhouette. S & M suit heights up to 1.65 m for a closer drape; L & XL suit taller frames. When between sizes, size up for a more fluid look.",
  },
  {
    key: "delivery",
    label: "Delivery & Returns",
    body: "Free delivery across Egypt in 2–4 business days. Express next-day delivery available at checkout. Returns accepted within 14 days in original unworn condition with tags attached.",
  },
];

function PlusIcon({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        position: "relative",
        flexShrink: 0,
        transition: "transform 0.25s ease",
        transform: open ? "rotate(45deg)" : "rotate(0deg)",
      }}
    >
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

  function handleColorSelect(idx: number) {
    setSelectedColor(idx);
    setGalleryIdx(0);
  }

  function handleAddToCart() {
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "'Montserrat', sans-serif" }}>
      {/* ── Google Fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; background: none; border: none; }
        img { display: block; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(250,248,245,0.96)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(26,20,16,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 60,
      }}>
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
      </header>

      {/* ── Breadcrumb ── */}
      <div style={{ padding: "14px 40px", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", cursor: "pointer" }}>Home</span>
        <span style={{ color: "rgba(26,20,16,0.3)", fontSize: 10 }}>/</span>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", cursor: "pointer" }}>New Collection</span>
        <span style={{ color: "rgba(26,20,16,0.3)", fontSize: 10 }}>/</span>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1a1410" }}>Moi Wavvy</span>
      </div>

      {/* ── Main 3-col layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr 1fr", gap: 0, padding: "0 40px 60px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── LEFT: Info + Accordions ── */}
        <div style={{ paddingRight: 48, paddingTop: 8 }}>
          <p style={{ fontSize: 9.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", marginBottom: 16 }}>
            New Collection
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 46, fontWeight: 400, lineHeight: 1.05, color: "#1a1410", marginBottom: 8, letterSpacing: "0.01em" }}>
            MOI<br />WAVVY
          </h1>
          <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)", marginBottom: 20 }}>
            {color.name}
          </p>

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
          <div style={{ marginBottom: 32 }}>
            {[
              "The ultimate throw-and-go piece.",
              "Effortless design makes it easy to wear.",
              "Wavy is light for all-day comfort.",
              "Breathable fabric keeps you cool.",
              "Made for drifting with ease.",
            ].map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ width: 1, height: 14, background: "rgba(26,20,16,0.25)", flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 12.5, color: "rgba(26,20,16,0.65)", lineHeight: 1.7, letterSpacing: "0.02em" }}>{line}</span>
              </div>
            ))}
          </div>

          {/* Accordions */}
          <div style={{ borderTop: "1px solid rgba(26,20,16,0.1)" }}>
            {ACCORDION.map(item => (
              <div key={item.key} style={{ borderBottom: "1px solid rgba(26,20,16,0.1)" }}>
                <button
                  onClick={() => setOpenAccordion(openAccordion === item.key ? null : item.key)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", background: "none" }}
                >
                  <span style={{ fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "#1a1410", fontWeight: 600 }}>
                    {item.label}
                  </span>
                  <PlusIcon open={openAccordion === item.key} />
                </button>
                {openAccordion === item.key && (
                  <p style={{ fontSize: 12, color: "rgba(26,20,16,0.6)", lineHeight: 1.85, letterSpacing: "0.025em", paddingBottom: 16 }}>
                    {item.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Gallery ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Main image */}
          <div
            style={{ position: "relative", background: "#f0ece6", overflow: "hidden", cursor: "zoom-in" }}
            onClick={() => setGalleryIdx((galleryIdx + 1) % images.length)}
          >
            <img
              key={mainImg}
              src={mainImg}
              alt="Moi Wavvy"
              style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "top center", transition: "opacity 0.3s" }}
            />
            {/* Nav arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setGalleryIdx((galleryIdx - 1 + images.length) % images.length); }}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(250,248,245,0.85)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                >
                  <span style={{ fontSize: 14, color: "#1a1410" }}>‹</span>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setGalleryIdx((galleryIdx + 1) % images.length); }}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(250,248,245,0.85)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                >
                  <span style={{ fontSize: 14, color: "#1a1410" }}>›</span>
                </button>
              </>
            )}
            {/* Dot indicator */}
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setGalleryIdx(i); }}
                  style={{ width: i === galleryIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === galleryIdx ? "#1a1410" : "rgba(26,20,16,0.3)", transition: "all 0.25s", border: "none", padding: 0 }}
                />
              ))}
            </div>
          </div>

          {/* Thumbnail strip */}
          <div style={{ display: "flex", gap: 8 }}>
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setGalleryIdx(i)}
                style={{ flex: 1, overflow: "hidden", outline: i === galleryIdx ? `2px solid #1a1410` : "2px solid transparent", outlineOffset: 2, transition: "outline 0.2s" }}
              >
                <img src={img} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "top center" }} />
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Variant selector + CTA ── */}
        <div style={{ paddingLeft: 48, paddingTop: 8 }}>
          {/* Color */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)", marginBottom: 14 }}>
              Colour — <span style={{ color: "#1a1410" }}>{color.name}</span>
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {COLORS.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => handleColorSelect(i)}
                  title={c.name}
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: c.swatch,
                    border: i === selectedColor ? "2px solid #1a1410" : "2px solid transparent",
                    outline: i === selectedColor ? "none" : `1px solid rgba(26,20,16,0.18)`,
                    outlineOffset: 2,
                    transition: "border 0.2s, transform 0.15s",
                    transform: i === selectedColor ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(26,20,16,0.5)" }}>Size</p>
              <button style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(26,20,16,0.45)", textDecoration: "underline" }}>
                Size Guide
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  style={{
                    padding: "10px 16px",
                    fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                    color: selectedSize === size ? "#faf8f5" : "#1a1410",
                    background: selectedSize === size ? "#1a1410" : "transparent",
                    border: `1px solid ${selectedSize === size ? "#1a1410" : "rgba(26,20,16,0.2)"}`,
                    transition: "all 0.18s",
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

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
              background: "transparent",
              color: "#1a1410",
              fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600,
              border: "1px solid rgba(26,20,16,0.3)", transition: "border 0.2s",
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
