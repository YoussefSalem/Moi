import { motion } from "framer-motion";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";

interface ProductCardProps {
  product: ProductConfig;
  onLookView: (product: ProductConfig) => void;
}

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
        className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center"
      >
        {/* ── Left column: product info ─────────────────── */}
        <div className="flex flex-col gap-5">
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
        </div>

        {/* ── Center column: product image ──────────────── */}
        <div className="flex justify-center relative">
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
              className="block relative group focus:outline-none"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.4 }}
              aria-label="See the look"
            >
              <img
                src={product.productShot}
                alt={product.name}
                className="relative z-10 w-full max-w-xs md:max-w-sm"
                style={{ maxHeight: 440, objectFit: "contain", objectPosition: "center" }}
                crossOrigin="anonymous"
              />
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 z-20 flex items-center justify-center"
              >
                <span
                  className="text-[10px] tracking-[0.3em] uppercase font-medium px-4 py-2"
                  style={{
                    backgroundColor: "rgba(250,248,245,0.88)",
                    color: "#1e1814",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  See the Look
                </span>
              </motion.div>
            </motion.button>
          </div>

        </div>

      </motion.div>
    </section>
  );
}
