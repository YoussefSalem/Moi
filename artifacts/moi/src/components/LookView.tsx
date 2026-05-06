import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

export function LookView({ product, onClose }: LookViewProps) {
  const [activeImage, setActiveImage] = useState(product?.look.model ?? null);
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

  useEffect(() => {
    setActiveImage(product?.look.model ?? null);
  }, [product]);

  const gradColor = color?.rgba(0.15) ?? "rgba(180,160,130,0.10)";
  const availableImages = useMemo(() => {
    if (!product) return [];
    const items = [product.look.model, product.look.earring, product.look.shoes, product.look.bag];
    return items.filter((src, index, array) => array.indexOf(src) === index);
  }, [product]);
  const thumbnails = availableImages;
  const handleSwap = (src: string) => {
    setActiveImage(src);
  };
  const sideImages = useMemo(() => {
    if (!product) return [];
    return availableImages.filter((src) => src !== activeImage).slice(0, 4);
  }, [activeImage, availableImages, product]);

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
            <div className="mx-auto w-full max-w-6xl px-8 md:px-16 pb-16">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(140px,1fr)_minmax(0,1.35fr)_minmax(140px,1fr)] gap-4 md:gap-6 items-center">
                <div className="grid grid-rows-2 gap-4">
                  {sideImages.slice(0, 2).map((src) => (
                    <motion.button
                      key={src}
                      type="button"
                      onClick={() => handleSwap(src)}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden rounded-sm border border-stone-200"
                      style={{ aspectRatio: "1 / 1" }}
                    >
                      <img src={src} alt="Thumbnail" className="w-full h-full object-cover" />
                    </motion.button>
                  ))}
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="relative"
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse 90% 80% at 50% 60%, ${color?.rgba(0.2) ?? "rgba(180,160,130,0.14)"} 0%, transparent 70%)`,
                      filter: "blur(24px)",
                      transform: "scale(1.2)",
                      transition: "background 1.5s ease",
                    }}
                  />
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImage ?? product.look.model}
                      src={activeImage ?? product.look.model}
                      alt={product.name}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="relative z-10 w-full h-[70vh] object-cover object-top"
                      crossOrigin="anonymous"
                    />
                  </AnimatePresence>
                </motion.div>
                <div className="grid grid-rows-2 gap-4">
                  {sideImages.slice(2, 4).map((src) => (
                    <motion.button
                      key={src}
                      type="button"
                      onClick={() => handleSwap(src)}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden rounded-sm border border-stone-200"
                      style={{ aspectRatio: "1 / 1" }}
                    >
                      <img src={src} alt="Thumbnail" className="w-full h-full object-cover" />
                    </motion.button>
                  ))}
                </div>
              </div>
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
