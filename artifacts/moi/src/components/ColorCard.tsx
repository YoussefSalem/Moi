import { useState } from "react";
import { motion } from "framer-motion";

interface ColorCardProps {
  productName: string;
  colorName: string;
  image: string;
  price: string;
  handle: string;
  swatchColor?: string;
  onNavigate: (handle: string) => void;
  index?: number;
}

export function ColorCard({
  productName,
  colorName,
  image,
  price,
  handle,
  swatchColor,
  onNavigate,
  index = 0,
}: ColorCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.07, 0.35) }}
      className="flex flex-col cursor-pointer group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onNavigate(handle)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(handle); }}
      aria-label={`View ${productName} in ${colorName}`}
    >
      {/* Image container — square on mobile, portrait on desktop */}
      <div
        className="relative overflow-hidden aspect-[4/5] md:aspect-[3/4]"
        style={{ backgroundColor: "rgba(30,24,20,0.04)" }}
      >
        {!imgLoaded && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ backgroundColor: "rgba(30,24,20,0.06)" }}
          />
        )}

        <img
          src={image}
          alt={`${productName} — ${colorName}`}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: "cover",
            objectPosition: "center top",
            transform: hovered ? "scale(1.05)" : "scale(1)",
            transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
          }}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
        />

        {/* Gradient + hover CTA */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-5"
          style={{
            background: hovered
              ? "linear-gradient(to top, rgba(30,24,20,0.72) 0%, rgba(30,24,20,0.12) 55%, transparent 100%)"
              : "linear-gradient(to top, rgba(30,24,20,0.18) 0%, transparent 40%)",
            transition: "background 350ms ease",
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(handle); }}
            className="border"
            style={{
              padding: "12px 32px",
              fontSize: "clamp(0.65rem, 2vw, 0.75rem)",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              fontFamily: "'Montserrat', sans-serif",
              color: "#faf8f5",
              borderColor: "rgba(250,248,245,0.65)",
              backgroundColor: "rgba(30,24,20,0.45)",
              backdropFilter: "blur(6px)",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 280ms ease, transform 280ms ease",
              whiteSpace: "nowrap",
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 pt-4 pb-1 px-0.5">
        {/* Color label + swatch */}
        <div className="flex items-center gap-2">
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

        {/* CTA below image (always visible) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(handle); }}
          className="self-center mt-3 border transition-all duration-300"
          style={{
            padding: "12px 28px",
            fontSize: "clamp(0.65rem, 2vw, 0.75rem)",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            fontFamily: "'Montserrat', sans-serif",
            color: "#faf8f5",
            borderColor: "#1e1814",
            backgroundColor: "#1e1814",
          }}
        >
          Add to Cart
        </button>
      </div>
    </motion.article>
  );
}
