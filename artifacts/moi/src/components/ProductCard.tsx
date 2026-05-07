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
  const colorOptions = [
    { name: "Ivory", swatch: "#f2ede4" },
    { name: "Sand", swatch: "#d1c2b0" },
    { name: "Taupe", swatch: "#a28a76" },
    { name: "Espresso", swatch: "#3a312c" },
  ];
  const sizeOptions = ["Small", "Medium"];

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
        className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(320px,460px)_minmax(260px,1fr)] gap-10 md:gap-16 items-center"
      >
        <div className="flex flex-col gap-5 md:items-start md:justify-center md:text-left text-center">
          <h2
            className="text-xl md:text-2xl font-bold tracking-widest uppercase"
            style={{ color: "#1e1814", letterSpacing: "0.12em" }}
          >
            {product.name}
          </h2>
          <p
            className="text-sm leading-relaxed font-light mt-2 max-w-md"
            style={{ color: "#5a5048" }}
          >
            {product.description}
          </p>
        </div>

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

        <div className="flex flex-col gap-5 md:items-start md:justify-center">
          <div className="flex flex-col gap-3">
            <p
              className="text-[11px] tracking-[0.22em] uppercase font-medium"
              style={{ color: "#7a6e64" }}
            >
              Color
            </p>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              {colorOptions.map((option, index) => (
                <button
                  key={option.name}
                  type="button"
                  aria-label={option.name}
                  className="relative group"
                  style={{ width: 34, height: 34 }}
                >
                  <span
                    className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: option.swatch,
                      boxShadow:
                        index === 3
                          ? "inset 0 0 0 1px rgba(255,255,255,0.16)"
                          : "inset 0 0 0 1px rgba(30,24,20,0.08)",
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
          <div className="flex flex-col gap-3">
            <p
              className="text-[11px] tracking-[0.22em] uppercase font-medium"
              style={{ color: "#7a6e64" }}
            >
              Size
            </p>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              {sizeOptions.map((size, index) => (
                <button
                  key={size}
                  type="button"
                  className="min-w-24 px-5 py-3 text-[11px] tracking-[0.22em] uppercase font-medium border transition-all duration-300"
                  style={{
                    color: index === 0 ? "#1e1814" : "#7a6e64",
                    borderColor: index === 0 ? "#1e1814" : "rgba(30,24,20,0.14)",
                    backgroundColor: index === 0 ? "rgba(30,24,20,0.04)" : "rgba(250,248,245,0.78)",
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="min-w-[204px] px-7 py-4 text-[10px] tracking-[0.35em] uppercase font-light border transition-all duration-300 self-center"
            style={{
              color: "#fff",
              borderColor: "#1e1814",
              backgroundColor: "#1e1814",
              letterSpacing: "0.28em",
            }}
          >
            Add to Cart
          </button>
        </div>
      </motion.div>
    </section>
  );
}
