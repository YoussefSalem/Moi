import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

export function LookView({ product, onClose }: LookViewProps) {
  const color = useImageColor(product?.look.model ?? null);

  useEffect(() => {
    if (product) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const gradColor = color?.rgba(0.15) ?? "rgba(180,160,130,0.10)";

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          key="look-view"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[80] flex flex-col overflow-y-auto"
          style={{
            background: `radial-gradient(ellipse 100% 100% at 50% 60%, ${gradColor} 0%, hsl(30 20% 97%) 65%)`,
            transition: "background 1.5s ease",
          }}
        >
          <div className="relative flex-1 flex flex-col min-h-screen">
            {/* ── Header ────────────────────────────── */}
            <div className="flex items-center justify-between px-8 md:px-16 pt-8 pb-4">
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase hover:opacity-50 transition-opacity"
                style={{ color: "#1e1814" }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 16 }}>←</span>
                <span>Back</span>
              </button>

              <button
                onClick={onClose}
                className="hover:opacity-50 transition-opacity"
                aria-label="Close"
              >
                <X size={20} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              </button>
            </div>

            {/* ── "THE LOOK" label ──────────────────── */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7 }}
              className="text-center font-serif leading-none mb-8"
              style={{
                color: "#1e1814",
                fontSize: "clamp(4rem, 12vw, 11rem)",
                letterSpacing: "0.08em",
                fontWeight: 300,
                opacity: 0.12,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              THE LOOK
            </motion.h2>

            {/* ── Editorial layout ─────────────────── */}
            <div className="relative flex-1 mx-auto w-full max-w-5xl px-8 md:px-16 pb-16" style={{ minHeight: 560 }}>
              {/* Model — center */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-center"
              >
                <div className="relative">
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse 90% 80% at 50% 60%, ${color?.rgba(0.2) ?? "rgba(180,160,130,0.14)"} 0%, transparent 70%)`,
                      filter: "blur(24px)",
                      transform: "scale(1.2)",
                      transition: "background 1.5s ease",
                    }}
                  />
                  <img
                    src={product.look.model}
                    alt={product.name}
                    className="relative z-10"
                    style={{
                      maxHeight: "65vh",
                      maxWidth: "100%",
                      objectFit: "contain",
                      objectPosition: "top",
                    }}
                    crossOrigin="anonymous"
                  />
                </div>
              </motion.div>

              {/* Floating accessories */}
              {/* Earring — top left */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="absolute hidden md:block"
                style={{ top: "8%", left: "2%" }}
              >
                <img
                  src={product.look.earring}
                  alt="Earrings"
                  className="rounded-sm"
                  style={{ width: 90, height: 90, objectFit: "cover" }}
                />
                <p
                  className="mt-2 text-[9px] tracking-[0.2em] uppercase font-medium leading-tight"
                  style={{ color: "#7a6e64", maxWidth: 90 }}
                >
                  Gold<br />Drop<br />Earrings
                </p>
              </motion.div>

              {/* Shoes — bottom left */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="absolute hidden md:block"
                style={{ bottom: "12%", left: "3%" }}
              >
                <img
                  src={product.look.shoes}
                  alt="Shoes"
                  className="rounded-sm"
                  style={{ width: 100, height: 100, objectFit: "cover" }}
                />
                <p
                  className="mt-2 text-[9px] tracking-[0.2em] uppercase font-medium leading-tight"
                  style={{ color: "#7a6e64", maxWidth: 100 }}
                >
                  Leather<br />Mule Heel
                </p>
              </motion.div>

              {/* Bag — right center */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45, duration: 0.7 }}
                className="absolute hidden md:block"
                style={{ top: "30%", right: "2%" }}
              >
                <img
                  src={product.look.bag}
                  alt="Bag"
                  className="rounded-sm"
                  style={{ width: 110, height: 110, objectFit: "cover" }}
                />
                <p
                  className="mt-2 text-[9px] tracking-[0.2em] uppercase font-medium leading-tight"
                  style={{ color: "#7a6e64", maxWidth: 110 }}
                >
                  Structured<br />Handbag
                </p>
              </motion.div>

              {/* Product annotation — right of model */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55, duration: 0.7 }}
                className="absolute hidden lg:block"
                style={{ top: "20%", right: "14%" }}
              >
                <div className="flex items-start gap-2">
                  <div className="w-6 h-px mt-2" style={{ backgroundColor: "#c8beb4" }} />
                  <div>
                    <p className="text-[9px] tracking-[0.2em] uppercase font-medium leading-tight" style={{ color: "#7a6e64" }}>
                      {product.name}
                    </p>
                    <p className="text-[9px] tracking-[0.1em] uppercase mt-0.5 leading-tight" style={{ color: "#bab0a6" }}>
                      {product.colorLabel.split("|")[0].trim()}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ── Bottom product info strip ─────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-8 md:px-16 py-8"
              style={{ borderColor: "rgba(180,160,140,0.2)" }}
            >
              <div>
                <p className="text-lg font-bold tracking-widest uppercase" style={{ color: "#1e1814" }}>
                  {product.name}
                </p>
                <p className="text-[11px] tracking-widest uppercase mt-1 font-light" style={{ color: "#7a6e64" }}>
                  {product.colorLabel}
                </p>
              </div>
              <p className="text-lg font-light" style={{ color: "#1e1814" }}>
                {product.price}
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-10 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium text-white"
                  style={{ backgroundColor: "#1e1814" }}
                >
                  Add to Bag
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
