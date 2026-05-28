import { useState } from "react";
import { motion } from "framer-motion";

interface ColorCardProps {
  productName: string;
  colorName: string;
  image: string;
  hoverImage?: string;
  price: string;
  handle: string;
  swatchColor?: string;
  onNavigate: (handle: string) => void;
  onAddToCart?: (handle: string) => void;
  index?: number;
}

export function ColorCard({
  productName,
  colorName,
  image,
  hoverImage,
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
      {/* Image container — soft rounded corners, subtle shadow */}
      <div
        className="relative overflow-hidden aspect-[4/5] md:aspect-[3/4] rounded-lg md:rounded-xl"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 16px rgba(30,24,20,0.04)",
        }}
      >
        {!imgLoaded && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ backgroundColor: "rgba(30,24,20,0.06)" }}
          />
        )}

        {/* Default image */}
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

        {/* Hover image — second photo with subtle zoom */}
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

      {/* Info — generous breathing room, clean typography */}
      <div className="flex flex-col gap-2.5 pt-5 md:pt-6 pb-2 px-1 md:px-0">
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

        {/* CTA — solid dark, generous horizontal padding on desktop */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onAddToCart) {
              onAddToCart(handle);
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
