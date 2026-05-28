import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageSkeleton } from "@/components/ImageSkeleton";
import { getStockCount } from "@/lib/stock";

interface ColorCardProps {
  productName: string;
  colorName: string;
  image: string;
  hoverImage?: string;
  gallery?: string[];
  price: string;
  handle: string;
  swatchColor?: string;
  onNavigate: (handle: string) => void;
  onAddToCart?: (handle: string, currentImage: string) => void;
  index?: number;
}

export function ColorCard({
  productName,
  colorName,
  image,
  hoverImage,
  gallery,
  price,
  handle,
  swatchColor,
  onNavigate,
  onAddToCart,
  index = 0,
}: ColorCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hoverImgLoaded, setHoverImgLoaded] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);

  // Full image list for mobile swipe — gallery already starts with the main image
  const allImages: string[] = gallery && gallery.length > 0
    ? gallery
    : [image, ...(hoverImage ? [hoverImage] : [])];

  function swipeBy(dir: 1 | -1) {
    setSwipeDirection(dir);
    setMobileIndex(i => (i + dir + allImages.length) % allImages.length);
  }


  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.07, 0.35) }}
      className="flex flex-col cursor-pointer group w-full max-w-[360px]"
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
          <img
            src={image}
            alt={`${productName} — ${colorName}`}
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: "cover",
              objectPosition: "center top",
              opacity: hovered && hoverImage ? 0 : 1,
              transform: hovered ? "scale(1.02)" : "scale(1)",
              transition: "opacity 500ms ease, transform 800ms cubic-bezier(0.22,1,0.36,1)",
            }}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
          />
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

        {/* ── MOBILE: swipeable image with animated transition ── */}
        <div
          className="md:hidden absolute inset-0"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragStartXRef.current = e.clientX;
            dragLastXRef.current = e.clientX;
          }}
          onPointerMove={(e) => {
            if (dragStartXRef.current === null) return;
            dragLastXRef.current = e.clientX;
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
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
            dragStartXRef.current = null;
            dragLastXRef.current = null;
          }}
          style={{ touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none" }}
        >
          {/* Skeleton — shown while next image loads after swipe */}
          <ImageSkeleton variant="card" className="z-0" borderRadius={8} />
          <AnimatePresence initial={false} mode="sync">
            <motion.img
              key={mobileIndex}
              src={allImages[mobileIndex] ?? image}
              alt={`${productName} — ${colorName}`}
              className="absolute inset-0 w-full h-full z-10"
              style={{ objectFit: "cover", objectPosition: "center top" }}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          </AnimatePresence>
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

      {/* Swipe hint — mobile only, shown below dots when gallery has multiple */}
      {allImages.length > 1 && (
        <p
          className="md:hidden text-center mt-1"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 8,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "rgba(30,24,20,0.38)",
          }}
        >
          swipe to browse
        </p>
      )}

      {/* Info */}
      <div className="flex flex-col gap-2.5 pt-5 md:pt-6 pb-2 px-1 md:px-0 pr-14 md:pr-0">
        {/* Color label + swatch + urgency */}
        <div className="flex items-center justify-between gap-2">
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
                fontSize: "clamp(0.65rem, 2vw, 0.75rem)",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#8a7e74",
              }}
            >
              {colorName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {productName === "MOI WAVVY" && colorName === "Light Blue" && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm"
                style={{
                  backgroundColor: "rgba(200, 50, 50, 0.08)",
                  border: "1px solid rgba(200, 50, 50, 0.18)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#c83232" }} />
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 8,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#c83232",
                    fontWeight: 500,
                  }}
                >
                  Selling Fast
                </span>
              </span>
            )}
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "clamp(0.58rem, 1.6vw, 0.68rem)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#c83232",
                fontWeight: 500,
                paddingLeft: 4,
              }}
            >
              Only {getStockCount(handle.split("-")[0] ?? "", colorName)} left
            </span>
          </div>
        </div>

        {/* Product name */}
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(1.05rem, 3vw, 1.3rem)",
            fontWeight: 300,
            color: "#1e1814",
            letterSpacing: "0.04em",
            lineHeight: 1.15,
          }}
        >
          {productName}
        </h3>

        {/* Price */}
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "clamp(0.78rem, 2.2vw, 0.85rem)",
            letterSpacing: "0.14em",
            color: "#7a6e64",
          }}
        >
          {price}
        </p>

        {/* CTA */}
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
          className="self-stretch md:self-center mt-3 md:mt-4 border transition-all duration-300 px-6 py-3.5 md:px-14 md:py-3.5 hover:shadow-lg"
          style={{
            fontSize: "clamp(0.65rem, 2vw, 0.75rem)",
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
          {onAddToCart ? "Add to Cart" : "View Details"}
        </button>
      </div>
    </motion.article>
  );
}
