import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { parseEGP } from "@/lib/price";
import { ImageSkeleton } from "@/components/ImageSkeleton";
import { ProductTrustBadges } from "./ProductTrustBadges";
import { ShopifyApplePayButton } from "@/components/ShopifyApplePayButton";
import type { ProductConfig } from "@/config/images";

interface ProductDesktopLayoutProps {
  product: ProductConfig;
  pageColorName: string;
  galleryImages: string[];
  galleryIndex: number;
  setGalleryIndex: (i: number) => void;
  imgLoaded: boolean;
  setImgLoaded: (loaded: boolean) => void;
  thumbLoaded: boolean[];
  setThumbLoaded: (fn: (prev: boolean[]) => boolean[]) => void;
  isOutOfStock: boolean;
  effectivePrice: string;
  effectiveCompareAtPrice: string | null;
  displaySizes: string[];
  selectedSize: string;
  setSelectedSize: (s: string) => void;
  sizeOption: { optionName: string; values: string[] } | null;
  selectedVariant: { id: string } | undefined;
  addedFeedback: boolean;
  applePayAvailable: boolean;
  waHover: boolean;
  setWaHover: (h: boolean) => void;
  setSizeGuideOpen: (open: boolean) => void;
  setLightboxOpen: (open: boolean) => void;
  onBack: () => void;
  nextImg: () => void;
  prevImg: () => void;
  handleAddToCart: () => void;
  handleBuyNow: () => void;
  handleNotifyMe: () => void;
}

export function ProductDesktopLayout({
  product, pageColorName, galleryImages, galleryIndex, setGalleryIndex,
  imgLoaded, setImgLoaded, thumbLoaded, setThumbLoaded,
  isOutOfStock, effectivePrice, effectiveCompareAtPrice,
  displaySizes, selectedSize, setSelectedSize, sizeOption, selectedVariant,
  addedFeedback, applePayAvailable, waHover, setWaHover,
  setSizeGuideOpen, setLightboxOpen, onBack, nextImg, prevImg,
  handleAddToCart, handleBuyNow, handleNotifyMe,
}: ProductDesktopLayoutProps) {
  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);
  const mainImage = galleryImages[galleryIndex] ?? (product.productShot as string);

  return (
    <div className="hidden lg:block">
      {/* Breadcrumb */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 28px 0" }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#a9a09a" }}>
          <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: "#7a6e64", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit" as const }}>
            All Products
          </button>
          <span style={{ margin: "0 8px" }}>›</span>
          <span style={{ color: "#1e1814" }}>{product.name.split(" — ")[0]}</span>
        </p>
      </div>

      {/* 3-col grid */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 28px 96px", display: "grid", gridTemplateColumns: "0.85fr 1.35fr 0.85fr", gap: "0 48px", alignItems: "start" }}>

        {/* ── COL 1: Story ── */}
        <div style={{ paddingTop: 4 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 16 }}>
            New Arrival
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(2rem, 2.8vw, 2.6rem)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "0.04em", color: "#1e1814", marginBottom: 16 }}>
            {product.name.split(" — ")[0]}
            {pageColorName && (
              <span style={{ color: "#8a7e74" }}> — {pageColorName}</span>
            )}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, letterSpacing: "0.02em", color: "#7a6e64", marginBottom: 20, fontWeight: 300 }}>
            {product.description}
          </p>
          <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.10)", marginBottom: 20 }} />
          {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 20 }}>
              {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#a9a09a", flexShrink: 0, marginTop: 2, fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>—</span>
                  <span style={{ fontSize: 13, color: "#1e1814", fontWeight: 300, letterSpacing: "0.02em", lineHeight: 1.55 }}>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ── COL 2: Gallery ── */}
        <div>
          <div
            className="relative overflow-hidden cursor-pointer"
            style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.04)", boxShadow: "0 16px 56px rgba(30,24,20,0.10)" }}
            onClick={() => setLightboxOpen(true)}
            onPointerDown={(e) => { dragStartXRef.current = e.clientX; dragLastXRef.current = e.clientX; }}
            onPointerMove={(e) => { if (dragStartXRef.current !== null) dragLastXRef.current = e.clientX; }}
            onPointerUp={(e) => {
              const start = dragStartXRef.current;
              if (start === null) return;
              const delta = (dragLastXRef.current ?? e.clientX) - start;
              dragStartXRef.current = null; dragLastXRef.current = null;
              if (Math.abs(delta) > 40) { delta < 0 ? nextImg() : prevImg(); setImgLoaded(false); }
            }}
            onPointerLeave={() => { dragStartXRef.current = null; dragLastXRef.current = null; }}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.img
                key={mainImage}
                src={mainImage}
                alt={product.name}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover" }}
                loading="eager"
                initial={{ opacity: 0 }}
                animate={{ opacity: imgLoaded ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgLoaded(true)}
              />
            </AnimatePresence>
            {!imgLoaded && <ImageSkeleton variant="warm" />}
            {isOutOfStock && (
              <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2 pointer-events-none" style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
              </div>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
              {galleryImages.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                  style={{
                    width: 58, height: 76, border: "none", padding: 0, cursor: "pointer",
                    overflow: "hidden",
                    outline: i === galleryIndex ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.12)",
                    outlineOffset: i === galleryIndex ? 2 : 0,
                    opacity: i === galleryIndex ? 1 : 0.5,
                    transition: "opacity 0.2s, outline 0.15s",
                    flexShrink: 0, background: "none",
                  }}
                >
                  <div className="relative w-full h-full">
                    {!thumbLoaded[i] && (
                      <div className="absolute inset-0 overflow-hidden" style={{ background: "rgba(230,220,205,0.55)" }}>
                        <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, transparent 30%, rgba(245,240,232,0.75) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                      </div>
                    )}
                    <img src={src} alt={`View ${i + 1}`} className="w-full h-full" style={{ objectFit: "cover", opacity: thumbLoaded[i] ? 1 : 0, transition: "opacity 0.2s ease" }} loading="eager"
                      onLoad={() => setThumbLoaded(prev => { const next = [...prev]; next[i] = true; return next; })}
                      onError={() => setThumbLoaded(prev => { const next = [...prev]; next[i] = true; return next; })}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── COL 3: Purchase ── */}
        <div style={{ paddingTop: 4 }}>
          {/* Price */}
          <div style={{ marginBottom: 24 }}>
            {effectiveCompareAtPrice && (
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.9rem", fontWeight: 400, letterSpacing: "0.08em", color: "#8a7e74", textDecoration: "line-through", textDecorationColor: "#c83232", lineHeight: 1.2, marginBottom: 4 }}>
                {effectiveCompareAtPrice}
              </p>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 400, letterSpacing: "0.04em", color: effectiveCompareAtPrice ? "#c83232" : "#1e1814", lineHeight: 1 }}>
                {effectivePrice}
              </p>
              {effectiveCompareAtPrice && (
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", color: "#c83232" }}>
                  {(() => { const p = parseEGP(String(effectivePrice)); const c = parseEGP(String(effectiveCompareAtPrice)); if (!p || !c || c <= p) return null; return `Save ${Math.round((1 - p / c) * 100)}%`; })()}
                </span>
              )}
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#a9a09a", marginTop: 6, letterSpacing: "0.04em", fontWeight: 300 }}>
              Free delivery on orders over 1,500 EGP
            </p>
          </div>

          <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.10)", marginBottom: 24 }} />

          {/* Size */}
          {displaySizes.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64" }}>Size</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <button type="button" onClick={() => setSizeGuideOpen(true)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#7a6e64", fontWeight: 400, letterSpacing: "0.08em", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Size Guide</button>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300, letterSpacing: "0.04em" }}>{selectedSize}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(displaySizes.length, 4)}, 1fr)`, gap: 8 }}>
                {displaySizes.map((size) => {
                  const available = product.variants?.some((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value.toLowerCase() === size.toLowerCase()) && v.availableForSale) ?? true;
                  const isSelected = selectedSize === size;
                  return (
                    <button key={size} type="button" onClick={() => setSelectedSize(size)}
                      style={{ height: 40, position: "relative", overflow: "hidden", border: isSelected ? "1.5px solid #1e1814" : "1px solid #d4cdc8", borderRadius: 0, backgroundColor: isSelected ? "#1e1814" : "transparent", color: !available ? "rgba(30,24,20,0.36)" : isSelected ? "#faf8f5" : "#1e1814", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "all 0.15s" }}
                    >
                      {!available && (<span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}><line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(30,24,20,0.18)" strokeWidth="1" /></svg></span>)}
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {displaySizes.length <= 1 && (sizeOption !== null || !!(product.variants?.length)) && (
            <div style={{ marginBottom: 24 }}>
              <button type="button" disabled style={{ padding: "11px 24px", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" as const, fontFamily: "'Montserrat', sans-serif", fontWeight: 500, color: "#1e1814", border: "1px solid #1e1814", backgroundColor: "rgba(30,24,20,0.04)", borderRadius: 0 }}>
                One Size
              </button>
            </div>
          )}

          {/* CTAs */}
          {isOutOfStock ? (
            <motion.button type="button" onClick={handleNotifyMe} whileTap={{ scale: 0.98 }}
              style={{ width: "100%", height: 48, backgroundColor: "rgba(30,24,20,0.9)", color: "#f5f0e8", border: "none", borderRadius: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Bell size={11} strokeWidth={1.8} />
              Notify Me When Back
            </motion.button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {applePayAvailable && (
                <>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 400, letterSpacing: "0.3em", textTransform: "uppercase" as const, color: "rgba(30,24,20,0.38)", textAlign: "center", marginBottom: "12px" }}>Express Checkout</p>
                  <ShopifyApplePayButton
                    variantId={selectedVariant?.id ?? (product as unknown as { variantId?: string }).variantId ?? ""}
                    quantity={1}
                    priceEGP={parseEGP(String(effectivePrice)) || 0}
                    disabled={isOutOfStock}
                    style={{ width: "100%" }}
                    onSuccess={(orderNumber, total) => { void orderNumber; void total; }}
                    onError={() => {}}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                  </div>
                </>
              )}
              <motion.button type="button" onClick={handleAddToCart} whileTap={{ scale: 0.98 }}
                style={{ width: "100%", height: 48, borderRadius: 0, backgroundColor: addedFeedback ? "#2d6a4f" : "transparent", color: addedFeedback ? "#faf8f5" : "#1e1814", border: addedFeedback ? "none" : "1.5px solid #1e1814", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.3s, color 0.3s, border-color 0.3s" }}
              >
                {addedFeedback ? "Added to Bag ✓" : "Add to Bag"}
              </motion.button>
              <motion.button type="button" onClick={handleBuyNow} whileTap={{ scale: 0.98 }}
                style={{ width: "100%", height: 48, borderRadius: 0, border: "none", backgroundColor: "#1e1814", color: "#faf8f5", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}
              >
                Buy It Now
              </motion.button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
              </div>
              <a
                href={`https://wa.me/201200520083?text=${encodeURIComponent(`Hi, I'd like to order the ${product.name}`)}`}
                target="_blank" rel="noopener noreferrer"
                onMouseEnter={() => setWaHover(true)} onMouseLeave={() => setWaHover(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 44, borderRadius: 0, border: `1.5px solid ${waHover ? "#25d366" : "rgba(37,211,102,0.4)"}`, backgroundColor: waHover ? "rgba(37,211,102,0.06)" : "transparent", color: "#25d366", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, textDecoration: "none", fontFamily: "'Montserrat', sans-serif", boxShadow: waHover ? "0 0 0 3px rgba(37,211,102,0.14)" : "none", transition: "all 0.2s" }}
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.526 5.856L.057 23.215a.75.75 0 00.928.908l5.444-1.466A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.714 9.714 0 01-4.95-1.355l-.355-.211-3.676.99.997-3.584-.232-.37A9.715 9.715 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                Order via WhatsApp
              </a>
              <ProductTrustBadges />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
