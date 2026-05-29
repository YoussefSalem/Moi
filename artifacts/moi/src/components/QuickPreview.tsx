import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ShoppingBag, Link2, Check } from "lucide-react";
import { getStockCount } from "@/lib/stock";

interface QuickPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  colorName: string;
  swatchColor?: string;
  price: string;
  gallery: string[];
  handle: string;
  description?: string;
  onNavigate: (handle: string) => void;
  onAddToCart?: (handle: string, image: string) => void;
}

export function QuickPreview({
  isOpen,
  onClose,
  productName,
  colorName,
  swatchColor,
  price,
  gallery,
  handle,
  description,
  onNavigate,
  onAddToCart,
}: QuickPreviewProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const stockCount = getStockCount(handle.split("-")[0] ?? "", colorName);

  const dragStartX = useRef<number | null>(null);
  const dragLastX = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setImgIndex(0);
      setImgLoaded(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // If the image is already cached (complete), show it immediately —
  // otherwise the skeleton stays visible because onLoad won't fire.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      setImgLoaded(true);
    }
  }, [isOpen, imgIndex]);

  function prev() {
    setImgLoaded(false);
    setImgIndex(i => (i - 1 + gallery.length) % gallery.length);
  }
  function next() {
    setImgLoaded(false);
    setImgIndex(i => (i + 1) % gallery.length);
  }

  const currentImage = gallery[imgIndex] ?? gallery[0];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[9998]"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            className="fixed left-0 right-0 bottom-0 z-[9999] rounded-t-2xl overflow-hidden"
            style={{
              backgroundColor: "#faf8f5",
              boxShadow: "0 -8px 48px rgba(30,24,20,0.18)",
              maxHeight: "88svh",
              display: "flex",
              flexDirection: "column",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34, mass: 0.9 }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: "rgba(30,24,20,0.18)" }} />
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: "rgba(30,24,20,0.08)",
                border: "none",
                cursor: "pointer",
              }}
              aria-label="Close preview"
            >
              <X size={15} strokeWidth={2} color="#1e1814" />
            </button>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 pb-6">

              {/* Image gallery */}
              <div
                className="relative mx-4 mt-2 rounded-xl overflow-hidden"
                style={{ aspectRatio: "4/5", backgroundColor: "rgba(30,24,20,0.04)", touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                onPointerDown={(e) => {
                  dragStartX.current = e.clientX;
                  dragLastX.current = e.clientX;
                }}
                onPointerMove={(e) => {
                  if (dragStartX.current === null) return;
                  dragLastX.current = e.clientX;
                }}
                onPointerUp={(e) => {
                  if (dragStartX.current === null) return;
                  const delta = (dragLastX.current ?? e.clientX) - dragStartX.current;
                  dragStartX.current = null;
                  dragLastX.current = null;
                  if (Math.abs(delta) > 30 && gallery.length > 1) {
                    delta < 0 ? next() : prev();
                  }
                }}
                onPointerCancel={() => { dragStartX.current = null; dragLastX.current = null; }}
              >
                {/* Skeleton */}
                {!imgLoaded && (
                  <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(30,24,20,0.06)" }}>
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
                        animation: "moi-shimmer 1.6s ease-in-out infinite",
                      }}
                    />
                  </div>
                )}
                <img
                  key={currentImage}
                  ref={imgRef}
                  src={currentImage}
                  alt={`${productName} — ${colorName}`}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: "cover",
                    objectPosition: "center top",
                    opacity: imgLoaded ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}
                  draggable={false}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />

                {/* Arrow nav — only when multiple images */}
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); prev(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
                      style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.72)", border: "none", cursor: "pointer" }}
                      aria-label="Previous"
                    >
                      <ChevronLeft size={16} strokeWidth={2} color="#1e1814" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); next(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
                      style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.72)", border: "none", cursor: "pointer" }}
                      aria-label="Next"
                    >
                      <ChevronRight size={16} strokeWidth={2} color="#1e1814" />
                    </button>
                  </>
                )}

                {/* Dot indicators */}
                {gallery.length > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
                    {gallery.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImgLoaded(false); setImgIndex(i); }}
                        style={{
                          width: i === imgIndex ? 16 : 5,
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: i === imgIndex ? "#fff" : "rgba(255,255,255,0.55)",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          transition: "all 0.25s ease",
                        }}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="px-5 mt-4 flex flex-col gap-2">

                {/* Color + badge */}
                <div className="flex items-center gap-2">
                  {swatchColor && (
                    <span
                      className="rounded-full flex-shrink-0"
                      style={{ width: 11, height: 11, backgroundColor: swatchColor, border: "1px solid rgba(30,24,20,0.18)" }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "0.65rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#8a7e74",
                    }}
                  >
                    {colorName}
                  </span>
                </div>

                {/* Product name */}
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "1.55rem",
                    fontWeight: 300,
                    color: "#1e1814",
                    letterSpacing: "0.04em",
                    lineHeight: 1.1,
                  }}
                >
                  {productName}
                </h3>

                {/* Share button — inline in product info, visible & accessible */}
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/products/${handle}`;
                    navigator.clipboard
                      .writeText(url)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => {
                        setCopied(false);
                      });
                  }}
                  className="self-start flex items-center gap-1.5"
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    backgroundColor: copied ? "rgba(74, 138, 90, 0.10)" : "rgba(30,24,20,0.06)",
                    border: copied ? "1px solid rgba(74, 138, 90, 0.28)" : "1px solid rgba(30,24,20,0.10)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  aria-label={copied ? "Link copied" : `Copy link to ${productName}`}
                  onPointerDown={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  }}
                  onPointerCancel={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  }}
                >
                  {copied ? (
                    <Check size={12} strokeWidth={2.5} color="#4a8a5a" />
                  ) : (
                    <Link2 size={12} strokeWidth={2.2} color="#1e1814" />
                  )}
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "0.62rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: copied ? "#4a8a5a" : "#1e1814",
                      fontWeight: 600,
                      lineHeight: 1,
                      transition: "color 0.2s ease",
                    }}
                  >
                    {copied ? "Copied to clipboard" : "Share"}
                  </span>
                </button>

                {/* Price + stock */}
                <div className="flex items-center justify-between mt-0.5">
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "0.9rem",
                      letterSpacing: "0.12em",
                      color: "#5a4e44",
                      fontWeight: 500,
                    }}
                  >
                    {price}
                  </span>
                  {stockCount !== null && (
                    <span
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: "0.62rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#c83232",
                        fontWeight: 500,
                      }}
                    >
                      Only {stockCount} left
                    </span>
                  )}
                </div>

                {/* Description */}
                {description && (
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: "1.05rem",
                      color: "#7a6e64",
                      lineHeight: 1.65,
                      fontWeight: 300,
                      marginTop: 2,
                    }}
                  >
                    {description}
                  </p>
                )}

                {/* Divider */}
                <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.08)", marginTop: 4 }} />

                {/* Action buttons */}
                <div className="flex flex-col gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onAddToCart) onAddToCart(handle, currentImage);
                      else onNavigate(handle);
                    }}
                    className="w-full flex items-center justify-center gap-2"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "0.7rem",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      color: "#faf8f5",
                      backgroundColor: "#1e1814",
                      border: "none",
                      borderRadius: 6,
                      padding: "13px 0",
                      cursor: "pointer",
                    }}
                  >
                    <ShoppingBag size={13} strokeWidth={2} />
                    Order Now
                  </button>
                  <button
                    type="button"
                    onClick={() => { onClose(); onNavigate(handle); }}
                    className="w-full flex items-center justify-center"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "0.7rem",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      color: "#1e1814",
                      backgroundColor: "transparent",
                      border: "1.5px solid rgba(30,24,20,0.22)",
                      borderRadius: 6,
                      padding: "12px 0",
                      cursor: "pointer",
                    }}
                  >
                    View Full Details
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
