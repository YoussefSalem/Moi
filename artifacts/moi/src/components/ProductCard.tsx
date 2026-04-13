import { motion } from "framer-motion";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";

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
            className="text-[11px] tracking-widest uppercase font-light"
            style={{ color: "#7a6e64", letterSpacing: "0.1em" }}
          >
            {product.colorLabel}
          </p>

          <p
            className="text-sm leading-relaxed font-light mt-2"
            style={{ color: "#5a5048" }}
          >
            {product.description}
          </p>

          <div className="mt-4">
            <a
              href="#"
              className="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase font-medium hover:opacity-60 transition-opacity"
              style={{ color: "#1e1814", letterSpacing: "0.12em" }}
            >
              Availability in Store
              <span style={{ fontFamily: "monospace" }}>→</span>
            </a>
          </div>
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

        {/* ── Right column: composition and care ───────── */}
        <div className="flex flex-col gap-4">
          <h3
            className="text-xs tracking-[0.2em] uppercase font-bold"
            style={{ color: "#1e1814" }}
          >
            Composition and Care
          </h3>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-light" style={{ color: "#5a5048" }}>
              {product.outer}
            </p>
            <p className="text-sm font-light" style={{ color: "#5a5048" }}>
              {product.lining}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mt-2">
            {CARE_ICONS.map((icon) => (
              <span
                key={icon.label}
                title={icon.label}
                className="block"
                style={{ width: 22, height: 22, color: "#5a5048" }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d={icon.path} />
                </svg>
              </span>
            ))}
          </div>

          <p
            className="text-[11px] tracking-wider font-light mt-1"
            style={{ color: "#9a8e82" }}
          >
            Bleach when needed
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <a
              href="#"
              className="inline-block text-[11px] tracking-widest uppercase font-medium underline underline-offset-4 hover:opacity-60 transition-opacity"
              style={{ color: "#1e1814" }}
            >
              Environmental Characteristics
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase font-medium hover:opacity-60 transition-opacity"
              style={{ color: "#1e1814" }}
            >
              Deliveries and Returns
              <span style={{ fontFamily: "monospace" }}>→</span>
            </a>
            <p
              className="text-[11px] tracking-wide font-medium"
              style={{ color: "#2a8a6a" }}
            >
              Free store delivery!
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
