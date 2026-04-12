import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

export function LookView({ product, onClose }: LookViewProps) {
  const color = useImageColor(product?.look ?? null);

  useEffect(() => {
    if (product) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const gradientColor = color?.rgba(0.22) ?? "rgba(180, 160, 130, 0.15)";

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          key="look-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[80] flex"
          style={{
            background: `radial-gradient(ellipse 100% 100% at 60% 50%, ${gradientColor} 0%, hsl(30 20% 98%) 60%)`,
            transition: "background 1.5s ease",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full flex flex-col md:flex-row"
          >
            <button
              onClick={onClose}
              className="absolute top-6 left-6 z-10 flex items-center gap-2 text-xs tracking-[0.2em] uppercase hover:opacity-50 transition-opacity"
              style={{ color: "#1e1814" }}
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
              <span>Back</span>
            </button>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 z-10 hover:opacity-50 transition-opacity"
              aria-label="Close"
            >
              <X size={20} strokeWidth={1.5} style={{ color: "#1e1814" }} />
            </button>

            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="w-full md:w-1/2 lg:w-[45%] h-[55vh] md:h-full flex items-end justify-center relative overflow-hidden"
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 100% 80% at 50% 70%, ${color?.rgba(0.2) ?? "rgba(180,160,130,0.12)"} 0%, transparent 70%)`,
                  filter: "blur(20px)",
                }}
              />
              <img
                src={product.look}
                alt={product.name}
                className="h-full w-full object-cover object-top md:object-contain md:object-bottom"
                crossOrigin="anonymous"
              />
            </motion.div>

            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="w-full md:w-1/2 lg:w-[55%] h-auto md:h-full flex flex-col justify-center px-10 md:px-16 lg:px-24 pb-12 md:pb-0"
            >
              <p
                className="text-[10px] tracking-[0.5em] uppercase mb-6 font-medium"
                style={{ color: "#9a8e82" }}
              >
                The Look
              </p>
              <h2
                className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-light mb-6"
                style={{ color: "#1e1814" }}
              >
                {product.name}
              </h2>
              <p
                className="text-sm tracking-wide mb-2 font-light"
                style={{ color: "#7a6e64" }}
              >
                {product.color}
              </p>
              <p
                className="text-xl font-light tracking-wide mb-8"
                style={{ color: "#1e1814" }}
              >
                {product.price}
              </p>

              <div className="w-8 h-px mb-8" style={{ backgroundColor: "rgba(180,160,140,0.5)" }} />

              <p
                className="text-xs tracking-wide leading-loose mb-10 max-w-sm"
                style={{ color: "#9a8e82" }}
              >
                {product.composition}
              </p>

              <div className="flex gap-3 flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-10 py-4 text-xs tracking-[0.25em] uppercase font-medium text-white"
                  style={{ backgroundColor: "#1e1814" }}
                >
                  Add to Bag
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-10 py-4 text-xs tracking-[0.25em] uppercase font-medium border"
                  style={{ color: "#1e1814", borderColor: "rgba(30,24,20,0.3)" }}
                >
                  Wishlist
                </motion.button>
              </div>

              <p
                className="mt-8 text-[10px] tracking-[0.2em] uppercase"
                style={{ color: "#bab0a6" }}
              >
                Ref. {product.ref}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
