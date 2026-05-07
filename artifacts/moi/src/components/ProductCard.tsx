import { motion } from "framer-motion";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";
import productMockup from "@assets/image_1778185291321.png";

interface ProductCardProps {
  product: ProductConfig;
  onLookView: (product: ProductConfig) => void;
}

const CARE_ICONS = [
  { label: "Machine wash", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" },
  { label: "Bleach when needed", path: "M12 2L2 19h20L12 2zm0 3.5l7.5 13H4.5l7.5-13z" },
  { label: "Dry clean", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
  { label: "Tumble dry", path: "M19 3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" },
  { label: "Do not iron", path: "M20 3H4v2l9 9 9-9V3zm0 16H4v-2l9-9 9 9v2z" },
  { label: "Natural fiber", path: "M17 8C8 10 5.9 16.17 3.82 21L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 4-2 8-2s4 2 8 2v-2c-4 0-4-2-8-2-1.13 0-1.9.16-2.53.33C14.28 12.06 16 10 17 8z" },
];

const COLOR_OPTIONS = [
  { name: "Ivory", swatch: "#f2ede4" },
  { name: "Sand", swatch: "#cdbfae" },
  { name: "Taupe", swatch: "#9c8470" },
  { name: "Charcoal", swatch: "#3a332f" },
];

const SIZE_OPTIONS = ["S", "M"] as const;

export function ProductCard({ product, onLookView }: ProductCardProps) {
  const color = useImageColor(product.productShot);
  const gradBg = color?.rgba(0.12) ?? "rgba(180,160,140,0.08)";

  return (
    <section
      className="w-full py-16 md:py-24 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 80% 70% at 50% 50%, ${gradBg} 0%, hsl(30 15% 95%) 70%)`,
        transition: "background 1.5s ease",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto px-6 md:px-12 flex flex-col items-center text-center gap-8 md:gap-10"
      >
        <div className="flex flex-col items-center text-center gap-4 max-w-xl">
          <h2
            className="text-xl md:text-2xl font-bold tracking-widest uppercase"
            style={{ color: "#1e1814", letterSpacing: "0.12em" }}
          >
            {product.name}
          </h2>
          <p
            className="text-sm leading-relaxed font-light mt-2"
            style={{ color: "#5a5048" }}
          >
            {product.description}
          </p>
          <div className="flex items-center gap-3">
            {COLOR_OPTIONS.map((option, index) => (
              <button
                key={option.name}
                type="button"
                className="relative group"
                aria-label={option.name}
                style={{ width: 34, height: 34 }}
              >
                <span
                  className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: option.swatch,
                    boxShadow: index === 3 ? "inset 0 0 0 1px rgba(255,255,255,0.16)" : "inset 0 0 0 1px rgba(30,24,20,0.08)",
                  }}
                />
                <span
                  className="absolute inset-[-5px] rounded-full border opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ borderColor: "rgba(30,24,20,0.18)" }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center relative w-full">
          <div className="relative">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 90% 80% at 50% 60%, ${color?.rgba(0.18) ?? "rgba(180,160,140,0.12)"} 0%, transparent 70%)`,
                filter: "blur(24px)",
                transform: "scale(1.2)",
                transition: "background 1.5s ease",
              }}
            />
            <motion.button
              onClick={() => onLookView(product)}
              className="block relative group focus:outline-none mx-auto"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.4 }}
              aria-label="See the look"
            >
              <img
                src={productMockup}
                alt={product.name}
                className="relative z-10 w-full max-w-sm md:max-w-md"
                style={{ maxHeight: 520, objectFit: "contain", objectPosition: "center" }}
                crossOrigin="anonymous"
              />
            </motion.button>
          </div>
        </div>

        <div className="flex flex-col items-center text-center gap-4 w-full max-w-md">
          <button
            type="button"
            className="w-full inline-flex items-center justify-center border transition-all duration-300"
            style={{
              minHeight: 54,
              borderColor: "#1e1814",
              color: "#faf8f5",
              backgroundColor: "#1e1814",
              letterSpacing: "0.28em",
            }}
          >
            <span className="text-[11px] uppercase font-medium">Add to Cart</span>
          </button>

          <div className="flex items-center justify-center gap-3">
            {SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className="inline-flex items-center justify-center border transition-all duration-300"
                style={{
                  width: 96,
                  minHeight: 50,
                  borderColor: "#1e1814",
                  color: "#1e1814",
                  backgroundColor: "rgba(250,248,245,0.55)",
                  letterSpacing: "0.22em",
                }}
              >
                <span className="text-[11px] uppercase font-medium">
                  {size === "S" ? "Small (S)" : "Medium (M)"}
                </span>
              </button>
            ))}
          </div>
        </div>

      </motion.div>
    </section>
  );
}
