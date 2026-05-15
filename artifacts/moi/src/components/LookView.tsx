import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";
import { useCart } from "@/context/CartContext";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

export function LookView({ product, onClose }: LookViewProps) {
  const [activeImage, setActiveImage] = useState(product?.look.model ?? null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const color = useImageColor(product?.look.model ?? null);
  const { addToCart } = useCart();

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
    setAddedFeedback(false);
  }, [product]);

  const handleAddToBag = async () => {
    if (!product) return;
    await addToCart({
      variantId: product.variantId,
      title: product.name,
      price: product.price,
      priceAmount: parseFloat(product.price.replace(/[^0-9.]/g, "")),
      currencyCode: "EGP",
      image: product.look.model,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const gradColor = color?.rgba(0.15) ?? "rgba(180,160,130,0.10)";
  const availableImages = useMemo(() => {
    if (!product) return [];
    const items = [product.look.model, product.look.earring, product.look.shoes, product.look.bag, product.look.extra].filter(Boolean) as string[];
    return items.filter((src, index, array) => array.indexOf(src) === index);
  }, [product]);
  const sideImages = useMemo(() => {
    if (!product) return [];
    return availableImages.filter((src) => src !== activeImage).slice(0, 4);
  }, [activeImage, availableImages, product]);

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          key="look-view"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.38, ease: [0.32, 0, 0.16, 1] }}
          className="fixed inset-0 z-[80] overflow-hidden"
          style={{
            backgroundColor: "hsl(30 20% 97%)",
            willChange: "transform, opacity",
          }}
        >
          {/* Ambient glow — opacity-only transition (GPU composited, no repaint) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${gradColor} 0%, transparent 70%)`,
              transition: "opacity 0.6s ease",
            }}
          />
          {/* Scroll container is separate from the animated layer */}
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{ overscrollBehavior: "contain", touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
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
            <h2
              className="text-center font-serif leading-none mb-8"
              style={{
                color: "#1e1814",
                fontSize: "clamp(4rem, 12vw, 11rem)",
                letterSpacing: "0.08em",
                fontWeight: 300,
                opacity: 0.38,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              THE LOOK
            </h2>

            {/* ── Editorial layout ─────────────────── */}
            <div className="mx-auto w-full max-w-6xl px-5 md:px-16 pb-10 md:pb-16 flex flex-col md:block">
              {/* Mobile: hero image + horizontal thumb strip */}
              <div className="md:hidden flex flex-col gap-3">
                {/* Main image */}
                <div className="relative w-full" style={{ height: "55vh" }}>
                  <AnimatePresence initial={false} mode="wait">
                    <motion.img
                      key={activeImage ?? product.look.model}
                      src={activeImage ?? product.look.model}
                      alt={product.name}
                      loading="eager"
                      decoding="async"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="absolute inset-0 w-full h-full object-cover object-top rounded-sm pointer-events-none select-none"
                      draggable={false}
                    />
                  </AnimatePresence>
                </div>
                {/* Horizontal thumb strip */}
                <div
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
                >
                  <style>{`.look-strip::-webkit-scrollbar { display: none; }`}</style>
                  {availableImages.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActiveImage(src)}
                      className="flex-shrink-0 overflow-hidden rounded-sm"
                      style={{
                        width: "72px",
                        aspectRatio: "1 / 1",
                        border: src === activeImage ? "2px solid #1e1814" : "2px solid transparent",
                        opacity: src === activeImage ? 1 : 0.7,
                        scrollSnapAlign: "start",
                        transition: "border-color 0.2s ease, opacity 0.2s ease",
                      }}
                    >
                      <img src={src} alt="Thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop: 2+1+2 editorial grid */}
              <div className="hidden md:grid grid-cols-[minmax(140px,1fr)_minmax(0,1.35fr)_minmax(140px,1fr)] gap-6 items-center">
                <div className="grid grid-rows-2 gap-4">
                  {sideImages.slice(0, 2).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActiveImage(src)}
                      className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 transition-opacity duration-200"
                      style={{ aspectRatio: "1 / 1" }}
                    >
                      <img src={src} alt="Thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.img
                      key={activeImage ?? product.look.model}
                      src={activeImage ?? product.look.model}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="relative z-10 w-full h-[70vh] object-cover object-top"
                    />
                  </AnimatePresence>
                </div>
                <div className="grid grid-rows-2 gap-4">
                  {sideImages.slice(2, 4).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActiveImage(src)}
                      className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 transition-opacity duration-200"
                      style={{ aspectRatio: "1 / 1" }}
                    >
                      <img src={src} alt="Thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bottom product info strip ─────────── */}
            <div
              className="border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-8 md:px-16 py-8"
              style={{ borderColor: "rgba(180,160,140,0.2)" }}
            >
              <div>
                <p className="text-lg font-bold tracking-widest uppercase" style={{ color: "#1e1814" }}>
                  {product.name}
                </p>
              </div>
              <p className="text-lg font-light" style={{ color: "#1e1814" }}>
                {product.price}
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToBag}
                  className="px-10 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300"
                  style={{
                    backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                    color: addedFeedback ? "#1e1814" : "#fff",
                    border: "1px solid #1e1814",
                  }}
                >
                  {addedFeedback ? "Added ✓" : "Pre-Order"}
                </motion.button>
              </div>
            </div>
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
