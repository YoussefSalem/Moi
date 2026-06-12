import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { ZoomableImage } from "./ZoomableImage";
import { ProductTrustBadges } from "./ProductTrustBadges";
import { ShopifyApplePayButton } from "@/components/ShopifyApplePayButton";
import { toast } from "sonner";
import { parseEGP } from "@/lib/price";
import type { ProductConfig } from "@/config/images";

interface ProductMobileSectionProps {
  product: ProductConfig;
  pageColorName: string;
  galleryImages: string[];
  galleryIndex: number;
  setGalleryIndex: (i: number) => void;
  setLightboxOpen: (open: boolean) => void;
  isOutOfStock: boolean;
  effectivePrice: string;
  effectiveCompareAtPrice: string | null;
  displaySizes: string[];
  selectedSize: string;
  setSelectedSize: (s: string) => void;
  sizeOption: { optionName: string; values: string[] } | null;
  selectedVariant: { id: string } | undefined;
  applePayAvailable: boolean;
  addedFeedback: boolean;
  waHover: boolean;
  setWaHover: (h: boolean) => void;
  setSizeGuideOpen: (open: boolean) => void;
  handleNotifyMe: () => void;
  handleAddToCart: () => void;
  handleBuyNow: () => void;
  setMobileGalleryTrackRef: (el: HTMLDivElement | null) => void;
  mobileGalleryRawIdxRef: React.MutableRefObject<number>;
  mobileGalleryDragRef: React.MutableRefObject<{ x: number; y: number } | null>;
  mobileGalleryDidDragRef: React.MutableRefObject<boolean>;
}

export function ProductMobileSection({
  product, pageColorName, galleryImages, galleryIndex, setGalleryIndex,
  setLightboxOpen, isOutOfStock,
  effectivePrice, effectiveCompareAtPrice,
  displaySizes, selectedSize, setSelectedSize, sizeOption, selectedVariant,
  applePayAvailable, addedFeedback, waHover, setWaHover,
  setSizeGuideOpen, handleNotifyMe, handleAddToCart, handleBuyNow,
  setMobileGalleryTrackRef, mobileGalleryRawIdxRef, mobileGalleryDragRef, mobileGalleryDidDragRef,
}: ProductMobileSectionProps) {
  return (
    <div className="lg:hidden" style={{ paddingBottom: 96 }}>
      {/* Full-bleed sliding gallery */}
      {(() => {
        const N = galleryImages.length;
        const extended = N > 1
          ? [galleryImages[N - 1], ...galleryImages, galleryImages[0]]
          : galleryImages;

        const jumpToSlide = (targetGalleryIdx: number) => {
          const rawIdx = N > 1 ? targetGalleryIdx + 1 : 0;
          mobileGalleryRawIdxRef.current = rawIdx;
          const track = document.querySelector<HTMLDivElement>("[data-mobile-gallery-track]");
          if (track) {
            track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
            track.style.transform = `translateX(-${rawIdx * 100}%)`;
          }
          setGalleryIndex(targetGalleryIdx);
        };

        const handleGalleryPointerDown = (e: React.PointerEvent) => {
          if (e.pointerType === "touch") return;
          if (N <= 1) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          mobileGalleryDragRef.current = { x: e.clientX, y: e.clientY };
          mobileGalleryDidDragRef.current = false;
        };

        const handleGalleryPointerMove = (e: React.PointerEvent) => {
          if (e.pointerType === "touch") return;
          if (!mobileGalleryDragRef.current) return;
          const dx = e.clientX - mobileGalleryDragRef.current.x;
          if (!mobileGalleryDidDragRef.current && Math.abs(dx) < 8) return;
          mobileGalleryDidDragRef.current = true;
          e.preventDefault();
        };

        const handleGalleryPointerUp = (e: React.PointerEvent) => {
          if (e.pointerType === "touch") return;
          if (!mobileGalleryDragRef.current) return;
          const { x: startX } = mobileGalleryDragRef.current;
          mobileGalleryDragRef.current = null;
          const didDrag = mobileGalleryDidDragRef.current;
          mobileGalleryDidDragRef.current = false;

          if (!didDrag) {
            setLightboxOpen(true);
            return;
          }

          const dx = e.clientX - startX;
          const dir = dx < -20 ? 1 : dx > 20 ? -1 : 0;
          if (dir !== 0) {
            const newIdx = (galleryIndex + dir + N) % N;
            jumpToSlide(newIdx);
          }
        };

        const handleGalleryPointerCancel = () => {
          mobileGalleryDragRef.current = null;
          mobileGalleryDidDragRef.current = false;
        };

        return (
          <div
            className="relative overflow-hidden"
            data-no-carousel
            style={{ backgroundColor: "rgba(30,24,20,0.04)", touchAction: N > 1 ? "pan-y" : "auto" }}
          >
            <div
              ref={setMobileGalleryTrackRef}
              data-mobile-gallery-track
              style={{ display: "flex", willChange: "transform" }}
              onPointerDown={handleGalleryPointerDown}
              onPointerMove={handleGalleryPointerMove}
              onPointerUp={handleGalleryPointerUp}
              onPointerCancel={handleGalleryPointerCancel}
            >
              {extended.map((src, i) => (
                <div key={i} style={{ flex: "0 0 100%", aspectRatio: "3/4", position: "relative", overflow: "hidden" }}>
                  <ZoomableImage src={src} alt={product.name} resetKey={galleryIndex} onPinchStart={handleGalleryPointerCancel} />
                </div>
              ))}
            </div>

            {isOutOfStock && (
              <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2 pointer-events-none" style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
              </div>
            )}

            {N > 1 && (
              <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 10 }}>
                {galleryImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); jumpToSlide(i); }}
                    style={{ width: i === galleryIndex ? 18 : 6, height: 6, borderRadius: 9999, border: "none", padding: 0, cursor: "pointer", backgroundColor: i === galleryIndex ? "#faf8f5" : "rgba(250,248,245,0.45)", transition: "width 0.22s, background-color 0.22s" }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Info block */}
      <div style={{ padding: "28px 20px 0" }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 10 }}>
          New Arrival
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.77rem, 7vw, 2.4rem)", fontWeight: 400, letterSpacing: "0.04em", lineHeight: 1.1, color: "#1e1814" }}>
            {product.name.split(" — ")[0]}
            {pageColorName && (
              <span style={{ color: "#8a7e74" }}> — {pageColorName}</span>
            )}
          </h1>
          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
            {effectiveCompareAtPrice && (
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.88rem", fontWeight: 400, letterSpacing: "0.08em", color: "#8a7e74", textDecoration: "line-through", textDecorationColor: "#c83232" }}>
                {effectiveCompareAtPrice}
              </p>
            )}
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.1rem, 4vw, 1.5rem)", fontWeight: 400, letterSpacing: "0.04em", color: effectiveCompareAtPrice ? "#c83232" : "#1e1814" }}>
              {effectivePrice}
            </p>
          </div>
        </div>

        {/* Size */}
        {displaySizes.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64" }}>Size</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <button type="button" onClick={() => setSizeGuideOpen(true)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#7a6e64", fontWeight: 400, letterSpacing: "0.08em", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Size Guide</button>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300 }}>{selectedSize}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {displaySizes.map((size) => {
                const available = product.variants?.some((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value.toLowerCase() === size.toLowerCase()) && v.availableForSale) ?? true;
                const isSelected = selectedSize === size;
                return (
                  <button key={size} type="button" onClick={() => setSelectedSize(size)}
                    style={{ flex: 1, height: 42, position: "relative", overflow: "hidden", border: isSelected ? "1.5px solid #1e1814" : "1px solid #d4cdc8", borderRadius: 0, backgroundColor: isSelected ? "#1e1814" : "transparent", color: !available ? "rgba(30,24,20,0.36)" : isSelected ? "#faf8f5" : "#1e1814", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "all 0.15s" }}
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

        {/* Description */}
        <p style={{ fontSize: 13, lineHeight: 1.75, color: "#7a6e64", fontWeight: 300, letterSpacing: "0.02em", marginBottom: 24 }}>
          {product.description}
        </p>

        {/* Out-of-stock CTA — inline */}
        {isOutOfStock && (
          <motion.button type="button" onClick={handleNotifyMe} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", height: 48, backgroundColor: "rgba(30,24,20,0.9)", color: "#f5f0e8", border: "none", borderRadius: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}
          >
            <Bell size={11} strokeWidth={1.8} />
            Notify Me When Back
          </motion.button>
        )}
      </div>

      {/* Sticky bottom CTA bar */}
      {!isOutOfStock && (
        <div style={{ padding: "16px 20px", paddingBottom: "calc(16px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {applePayAvailable && (
            <>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 400, letterSpacing: "0.3em", textTransform: "uppercase" as const, color: "rgba(30,24,20,0.38)", textAlign: "center", marginBottom: "12px" }}>Express Checkout</p>
              <ShopifyApplePayButton
                variantId={selectedVariant?.id ?? (product as unknown as { variantId?: string }).variantId ?? ""}
                quantity={1}
                priceEGP={parseEGP(String(effectivePrice)) || 0}
                disabled={isOutOfStock}
                style={{ width: "100%" }}
                onSuccess={(orderNumber, total) => { toast.success(`Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`, { duration: 5000 }); }}
                onError={(msg) => { toast.error(msg, { duration: 4000 }); }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
              </div>
            </>
          )}
          <motion.button type="button" onClick={handleAddToCart} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", height: 52, borderRadius: 0, backgroundColor: addedFeedback ? "#2d6a4f" : "transparent", color: addedFeedback ? "#faf8f5" : "#1e1814", border: addedFeedback ? "none" : "1.5px solid #1e1814", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.3s, color 0.3s, border-color 0.3s" }}
          >
            {addedFeedback ? "Added ✓" : `Add to Bag — ${effectivePrice}`}
          </motion.button>
          <motion.button type="button" onClick={handleBuyNow} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", height: 52, borderRadius: 0, border: "none", backgroundColor: "#1e1814", color: "#faf8f5", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}
          >
            Buy Now
          </motion.button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
          </div>
          <a
            href={`https://wa.me/201200520083?text=${encodeURIComponent(`Hi, I'd like to order the ${product.name}`)}`}
            target="_blank" rel="noopener noreferrer"
            onPointerDown={() => setWaHover(true)} onPointerUp={() => setWaHover(false)} onPointerLeave={() => setWaHover(false)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 50, borderRadius: 0, border: `1.5px solid ${waHover ? "#25d366" : "rgba(37,211,102,0.4)"}`, backgroundColor: waHover ? "rgba(37,211,102,0.06)" : "transparent", color: "#25d366", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, textDecoration: "none", fontFamily: "'Montserrat', sans-serif", boxShadow: waHover ? "0 0 0 3px rgba(37,211,102,0.14)" : "none", transition: "all 0.2s" }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.526 5.856L.057 23.215a.75.75 0 00.928.908l5.444-1.466A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.714 9.714 0 01-4.95-1.355l-.355-.211-3.676.99.997-3.584-.232-.37A9.715 9.715 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
            Order via WhatsApp
          </a>
          <ProductTrustBadges />
        </div>
      )}
    </div>
  );
}
