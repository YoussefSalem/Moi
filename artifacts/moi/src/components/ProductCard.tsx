import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";

interface ProductCardProps {
  product: ProductConfig;
  onLookView: (product: ProductConfig) => void;
  reverse?: boolean;
}

export function ProductCard({ product, onLookView, reverse = false }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [selectedThumb, setSelectedThumb] = useState(0);
  const color = useImageColor(product.gallery[selectedThumb]);

  const gradientColor = color?.rgba(0.18) ?? "rgba(180, 160, 130, 0.12)";
  const gradientColorDeep = color?.rgba(0.28) ?? "rgba(180, 160, 130, 0.20)";

  return (
    <section
      id="collection"
      className="relative w-full overflow-hidden py-20 md:py-32"
      style={{
        background: `radial-gradient(ellipse 80% 70% at ${reverse ? "20%" : "80%"} 50%, ${gradientColorDeep} 0%, transparent 70%), hsl(30 20% 98%)`,
        transition: "background 1.2s ease",
      }}
    >
      <div
        className={`relative z-10 max-w-7xl mx-auto px-6 md:px-12 flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} gap-12 md:gap-0 items-center`}
      >
        <motion.div
          className="w-full md:w-1/2 flex flex-col items-center"
          initial={{ opacity: 0, x: reverse ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative group" style={{ maxWidth: 420 }}>
            <div
              className="absolute inset-0 rounded-none pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 90% 80% at 50% 60%, ${gradientColorDeep} 0%, transparent 70%)`,
                filter: "blur(30px)",
                transform: "scale(1.15)",
                transition: "background 1.2s ease",
              }}
            />
            <motion.div
              className="relative cursor-pointer overflow-hidden"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onClick={() => onLookView(product)}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.4 }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={hovered ? "hover" : "main"}
                  src={hovered ? product.hover : product.gallery[selectedThumb]}
                  alt={product.name}
                  className="w-full aspect-[2/3] object-cover object-top"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  crossOrigin="anonymous"
                />
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: hovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
              >
                <p className="text-xs tracking-[0.35em] uppercase font-medium text-white bg-black/30 px-6 py-3">
                  See The Look
                </p>
              </motion.div>
            </motion.div>

            <div className="flex gap-2 mt-4 justify-center">
              {product.gallery.slice(0, 5).map((src, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedThumb(i)}
                  className="relative transition-all duration-300"
                  style={{ width: 40, height: 56, flexShrink: 0 }}
                >
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover object-top transition-opacity duration-300"
                    style={{ opacity: selectedThumb === i ? 1 : 0.45 }}
                    crossOrigin="anonymous"
                  />
                  {selectedThumb === i && (
                    <motion.div
                      layoutId={`thumb-indicator-${product.ref}`}
                      className="absolute inset-0 border"
                      style={{ borderColor: "#1e1814" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          className={`w-full md:w-1/2 flex flex-col ${reverse ? "md:items-end md:text-right md:pr-20" : "md:items-start md:pl-20"}`}
          initial={{ opacity: 0, x: reverse ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <p
            className="text-xs tracking-[0.35em] uppercase mb-6 font-light"
            style={{ color: "#9a8e82" }}
          >
            New Collection
          </p>
          <h2
            className="font-serif text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] font-light mb-3"
            style={{ color: "#1e1814" }}
          >
            {product.name}
          </h2>
          <p
            className="text-sm tracking-wide mb-8 font-light"
            style={{ color: "#7a6e64" }}
          >
            {product.color}
          </p>

          <div
            className="w-12 h-px mb-8"
            style={{ backgroundColor: "rgba(180,160,140,0.5)" }}
          />

          <p
            className="text-xl font-light tracking-wide mb-6"
            style={{ color: "#1e1814" }}
          >
            {product.price}
          </p>

          <p
            className="text-xs tracking-wide leading-relaxed mb-10 max-w-xs"
            style={{ color: "#9a8e82" }}
          >
            {product.composition}
          </p>

          <div className={`flex gap-3 flex-wrap ${reverse ? "md:justify-end" : ""}`}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-10 py-4 text-xs tracking-[0.25em] uppercase font-medium text-white transition-all duration-300"
              style={{ backgroundColor: "#1e1814" }}
            >
              Add to Bag
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onLookView(product)}
              className="px-10 py-4 text-xs tracking-[0.25em] uppercase font-medium border transition-all duration-300"
              style={{ color: "#1e1814", borderColor: "rgba(30,24,20,0.3)" }}
            >
              The Look
            </motion.button>
          </div>

          <p
            className="mt-8 text-[10px] tracking-[0.2em] uppercase"
            style={{ color: "#bab0a6" }}
          >
            Ref. {product.ref}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
