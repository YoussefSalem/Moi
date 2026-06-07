import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageSkeleton } from "@/components/ImageSkeleton";
import { QuickPreview } from "@/components/QuickPreview";

interface ColorCardProps {
  productName: string;
  colorName: string;
  image: string;
  hoverImage?: string;
  gallery?: string[];
  price: string;
  compareAtPrice?: string;
  handle: string;
  swatchColor?: string;
  description?: string;
  outOfStock?: boolean;
  onNavigate: (handle: string) => void;
  onAddToCart?: (handle: string, currentImage: string) => void;
  index?: number;
  className?: string;
}

export function ColorCard({
  productName,
  colorName,
  image,
  hoverImage,
  gallery,
  price,
  compareAtPrice,
  handle,
  swatchColor,
  description,
  outOfStock = false,
  onNavigate,
  onAddToCart,
  index = 0,
  className,
}: ColorCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hoverImgLoaded, setHoverImgLoaded] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [quickPreviewOpen, setQuickPreviewOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivatedRef = useRef(false);

  const allImages: string[] = (gallery && gallery.length > 0
    ? gallery
    : [image, ...(hoverImage ? [hoverImage] : [])]
  ).filter(Boolean);

  // Deterministic scarcity — same hash logic as ProductCard so numbers never change on refresh
  const scarcityCount = (() => {
    let h = 0;
    for (let i = 0; i < handle.length; i++) {
      h = Math.imul(31, h) + handle.charCodeAt(i) | 0;
    }
    const buckets = [1, 2, 2, 3, 3, 3, 4, 4, 5];
    return buckets[Math.abs(h) % buckets.length];
  })();

  const isSellingFast =
    !outOfStock &&
    handle.startsWith("moi-wavvy") &&
    colorName.toLowerCase().replace(/\s+/g, "-").includes("light");

  function swipeBy(dir: 1 | -1) {
    setMobileIndex(i => (i + dir + allImages.length) % allImages.length);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.07, 0.35) }}
        className={`flex flex-col cursor-pointer group w-full h-full max-w-[360px] ${className ?? ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onNavigate(handle)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(handle); }}
        aria-label={`View ${productName} in ${colorName}`}
      >
        {/* Image container */}
        <div
          className="relative overflow-hidden aspect-[4/5] md:aspect-[3/4] rounded-lg md:rounded-xl"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 2px 16px rgba(30,24,20,0.04)",
          }}
        >
          {!imgLoaded && (
            <ImageSkeleton variant="card" className="z-0" borderRadius={8} />
          )}

          {/* ── DESKTOP: hover crossfade ── */}
          <div className="hidden md:block absolute inset-0">
            {image && (
              <img
                src={image}
                alt={`${productName} — ${colorName}`}
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: "cover",
                  objectPosition: "center top",
                  opacity: imgLoaded ? (hovered && hoverImage ? 0 : 1) : 0,
                  transform: hovered ? "scale(1.02)" : "scale(1)",
                  transition: "opacity 500ms ease, transform 800ms cubic-bezier(0.22,1,0.36,1)",
                }}
                loading="lazy"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
              />
            )}
            {hoverImage && (
              <img
                src={hoverImage}
                alt={`${productName} — ${colorName} alternate`}
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: "cover",
                  objectPosition: "center top",
                  opacity: hovered && hoverImgLoaded ? 1 : 0,
                  transform: hovered ? "scale(1.03)" : "scale(1)",
                  transition: "opacity 500ms ease, transform 800ms cubic-bezier(0.22,1,0.36,1)",
                }}
                loading="eager"
                decoding="async"
                onLoad={() => setHoverImgLoaded(true)}
              />
            )}
          </div>

          {/* ── Out of Stock overlay ── */}
          {outOfStock && (
            <div
              className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2.5"
              style={{
                background: "rgba(30,24,20,0.52)",
                backdropFilter: "blur(2px)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "clamp(0.55rem, 1.6vw, 0.65rem)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(250,248,245,0.9)",
                  fontWeight: 500,
                }}
              >
                Sold Out
              </span>
            </div>
          )}

          {/* ── MOBILE: swipe + long-press quick preview ── */}
          <div
            className="md:hidden absolute inset-0"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragStartXRef.current = e.clientX;
              dragLastXRef.current = e.clientX;
              longPressActivatedRef.current = false;
              setPressed(true);

              longPressTimerRef.current = setTimeout(() => {
                longPressActivatedRef.current = true;
                longPressTimerRef.current = null;
                if (navigator.vibrate) navigator.vibrate(18);
                setQuickPreviewOpen(true);
              }, 520);
            }}
            onPointerMove={(e) => {
              if (dragStartXRef.current === null) return;
              dragLastXRef.current = e.clientX;
              const delta = e.clientX - (dragStartXRef.current ?? e.clientX);
              if (Math.abs(delta) > 10) {
                cancelLongPress();
                setPressed(false);
              }
            }}
            onPointerUp={(e) => {
              cancelLongPress();
              setPressed(false);
              e.stopPropagation();
              if (longPressActivatedRef.current) {
                dragStartXRef.current = null;
                dragLastXRef.current = null;
                return;
              }
              if (dragStartXRef.current === null) return;
              const delta = (dragLastXRef.current ?? e.clientX) - dragStartXRef.current;
              dragStartXRef.current = null;
              dragLastXRef.current = null;
              if (Math.abs(delta) > 30) {
                swipeBy(delta < 0 ? 1 : -1);
              } else {
                onNavigate(handle);
              }
            }}
            onPointerCancel={() => {
              cancelLongPress();
              setPressed(false);
              dragStartXRef.current = null;
              dragLastXRef.current = null;
            }}
            style={{
              touchAction: "pan-y",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            } as React.CSSProperties}
          >
            <ImageSkeleton variant="card" className="z-0" borderRadius={8} />
            <AnimatePresence initial={false} mode="sync">
              <motion.img
                key={mobileIndex}
                src={(allImages[mobileIndex] ?? image) || undefined}
                alt={`${productName} — ${colorName}`}
                className="absolute inset-0 w-full h-full z-10"
                style={{
                  objectFit: "cover",
                  objectPosition: "center top",
                  WebkitTouchCallout: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                loading="lazy"
                decoding="async"
                draggable={false}
                onLoad={() => setImgLoaded(true)}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: imgLoaded ? 1 : 0,
                  scale: pressed ? 1.03 : 1,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </AnimatePresence>

            {/* Press feedback overlay — subtle darkening when held */}
            <motion.div
              className="absolute inset-0 z-20 pointer-events-none"
              animate={{
                opacity: pressed ? 0.12 : 0,
                backgroundColor: "#000000",
              }}
              transition={{ duration: 0.18 }}
            />
          </div>
        </div>

        {/* Mobile pagination dots — pill style */}
        {allImages.length > 1 && (
          <div className="md:hidden flex justify-center mt-2">
            {allImages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                onClick={(e) => { e.stopPropagation(); setMobileIndex(i); }}
                style={{
                  padding: "6px 2px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: i === mobileIndex ? 14 : 4,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: i === mobileIndex ? "#1e1814" : "rgba(30,24,20,0.24)",
                    transition: "all 0.28s ease",
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="flex flex-col items-center flex-grow pt-3 md:pt-4 pb-4 md:pb-5 px-1 md:px-0 gap-y-2 md:gap-y-2.5">
          <div className="flex items-center justify-center gap-2 flex-wrap md:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0">
              {swatchColor && (
                <span
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: swatchColor,
                    border: "1px solid rgba(30,24,20,0.18)",
                  }}
                />
              )}
              <span
                className="truncate"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "clamp(0.6rem, 2vw, 0.78rem)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#8a7e74",
                }}
              >
                {colorName}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-0.5 md:flex-row md:items-center md:justify-center md:gap-6">
            <h3
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "clamp(0.88rem, 2.5vw, 1.35rem)",
                fontWeight: 300,
                color: "#1e1814",
                letterSpacing: "0.04em",
                lineHeight: 1.15,
                textAlign: "center",
              }}
            >
              {productName}
            </h3>
          </div>

          <div className="text-center mt-auto flex flex-col items-center" style={{ gap: 2 }}>
            {compareAtPrice && (
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "clamp(0.72rem, 2vw, 0.78rem)",
                  fontWeight: 400,
                  letterSpacing: "0.08em",
                  color: "#8a7e74",
                  textDecoration: "line-through",
                  textDecorationThickness: 1,
                  textDecorationColor: "#c83232",
                  lineHeight: 1.2,
                }}
              >
                {compareAtPrice}
              </span>
            )}
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "clamp(0.81rem, 2.2vw, 0.88rem)",
                letterSpacing: "0.14em",
                color: compareAtPrice ? "#c83232" : "#7a6e64",
                lineHeight: 1.2,
              }}
            >
              {price}
            </span>
          </div>

          {/* Scarcity / urgency signals */}
          {isSellingFast && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: "rgba(158,42,43,0.07)",
                border: "1px solid rgba(158,42,43,0.2)",
                borderRadius: 999,
                padding: "4px 11px 4px 8px",
              }}
            >
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <motion.span
                  animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    backgroundColor: "#c83232",
                    display: "block",
                  }}
                />
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#c83232",
                    display: "block",
                    flexShrink: 0,
                  }}
                />
              </span>
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "9px",
                  letterSpacing: "0.22em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "#c83232",
                }}
              >
                Selling Fast
              </span>
            </div>
          )}
          {!outOfStock && !isSellingFast && (
            <p
              style={{
                color: "#c83232",
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "11px",
                letterSpacing: "0.18em",
                fontWeight: 500,
                textShadow: "0 0 12px rgba(158,42,43,0.12)",
                margin: 0,
              }}
            >
              Only {scarcityCount} left
            </p>
          )}

          {outOfStock ? (
            <button
              type="button"
              disabled
              onClick={(e) => e.stopPropagation()}
              className="self-center border px-6 py-2.5 md:px-14 md:py-3.5 w-full md:w-auto cursor-not-allowed"
              style={{
                fontSize: "clamp(0.62rem, 2vw, 0.78rem)",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                color: "#a89e97",
                borderColor: "#c8bfb8",
                backgroundColor: "#f0ece8",
                borderRadius: 6,
              }}
            >
              Sold Out
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onAddToCart) {
                  onAddToCart(handle, image);
                } else {
                  onNavigate(handle);
                }
              }}
              className="self-center border transition-all duration-300 px-6 py-2.5 md:px-14 md:py-3.5 hover:shadow-lg w-full md:w-auto"
              style={{
                fontSize: "clamp(0.62rem, 2vw, 0.78rem)",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                color: "#faf8f5",
                borderColor: "#1e1814",
                backgroundColor: "#1e1814",
                borderRadius: 6,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2d231c";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#2d231c";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1e1814";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e1814";
              }}
            >
              {onAddToCart ? "Order Now" : "View Details"}
            </button>
          )}
        </div>
      </motion.article>

      <QuickPreview
        isOpen={quickPreviewOpen}
        onClose={() => setQuickPreviewOpen(false)}
        productName={productName}
        colorName={colorName}
        swatchColor={swatchColor}
        price={price}
        compareAtPrice={compareAtPrice}
        gallery={allImages.length > 0 ? allImages : [image]}
        handle={handle}
        description={description}
        onNavigate={onNavigate}
        onAddToCart={onAddToCart}
      />
    </>
  );
}
