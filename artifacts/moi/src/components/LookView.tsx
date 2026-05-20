import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig } from "@/config/images";
import { useCart } from "@/context/CartContext";
import { CinematicLightbox } from "@/components/CinematicLightbox";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

export function LookView({ product, onClose }: LookViewProps) {
  const [activeImage, setActiveImage] = useState(product?.look.model ?? null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
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
    <>
    <AnimatePresence>
      {product && (
        <motion.div
          key="look-view"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.38, ease: [0.32, 0, 0.16, 1] }}
          className="fixed inset-0 z-[80] overflow-y-auto"
          style={{
            backgroundColor: "rgba(250,248,245,0.72)",
            backdropFilter: "blur(18px) saturate(1.2)",
            WebkitBackdropFilter: "blur(18px) saturate(1.2)",
            willChange: "transform, opacity",
          }}
        >
          {/* Ambient glow — richer and more spread against translucent background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 120% 90% at 50% 35%, ${gradColor} 0%, transparent 75%)`,
              transition: "opacity 0.8s ease",
            }}
          />

          {/* Header — sticky so it never scrolls away on mobile */}
          <div
            className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-16 pt-5 pb-3"
            style={{
              backgroundColor: "rgba(250,248,245,0.55)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              paddingTop: "max(1.25rem, env(safe-area-inset-top))",
            }}
          >
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
              fontSize: "clamp(2.5rem, 9vw, 11rem)",
              letterSpacing: "0.08em",
              fontWeight: 300,
              opacity: 0.22,
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
              {/* Main image (clickable) */}
              <button
                type="button"
                className="relative w-full block"
                style={{ height: "55vh", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => {
                  const i = availableImages.indexOf(activeImage ?? product.look.model);
                  setLbIndex(i >= 0 ? i : 0);
                  setLbOpen(true);
                }}
              >
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
                    className="absolute inset-0 w-full h-full object-cover object-top rounded-sm select-none"
                    draggable={false}
                  />
                </AnimatePresence>
              </button>
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
                    <img src={src} alt="Look view thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: 2+1+2 editorial grid — all images open lightbox */}
            <div className="hidden md:grid grid-cols-[minmax(140px,1fr)_minmax(0,1.35fr)_minmax(140px,1fr)] gap-6 items-center">
              <div className="grid grid-rows-2 gap-4">
                {sideImages.slice(0, 2).map((src) => {
                  const idx = availableImages.indexOf(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => { setLbIndex(idx); setLbOpen(true); }}
                      className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 transition-opacity duration-200"
                      style={{ aspectRatio: "1 / 1", background: "none", padding: 0, cursor: "pointer" }}
                    >
                      <img src={src} alt="Look view thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="relative block w-full"
                style={{ height: "70vh", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => {
                  const i = availableImages.indexOf(activeImage ?? product.look.model);
                  setLbIndex(i >= 0 ? i : 0);
                  setLbOpen(true);
                }}
              >
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
                    className="relative z-10 w-full h-full object-cover object-top"
                  />
                </AnimatePresence>
              </button>
              <div className="grid grid-rows-2 gap-4">
                {sideImages.slice(2, 4).map((src) => {
                  const idx = availableImages.indexOf(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => { setLbIndex(idx); setLbOpen(true); }}
                      className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 transition-opacity duration-200"
                      style={{ aspectRatio: "1 / 1", background: "none", padding: 0, cursor: "pointer" }}
                    >
                      <img src={src} alt="Look view thumbnail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Bottom product info strip ─────────── */}
          <div
            className="border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-8 md:px-16 py-8"
            style={{ borderColor: "rgba(180,160,140,0.2)" }}
          >
            <div>
              <p
                className="text-[10px] tracking-[0.45em] uppercase mb-1"
                style={{ color: "rgba(120,108,96,0.7)", fontFamily: "'Montserrat', sans-serif" }}
              >
                New Arrival
              </p>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  fontWeight: 300,
                  letterSpacing: "0.06em",
                  color: "#1e1814",
                }}
              >
                {product.name}
              </h2>
            </div>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
                fontWeight: 500,
                letterSpacing: "0.12em",
                color: "#1e1814",
              }}
            >
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
                  boxShadow: addedFeedback ? "none" : "0 0 24px rgba(30,24,20,0.18), 0 4px 14px rgba(0,0,0,0.12)",
                }}
              >
                {addedFeedback ? "Added \u2713" : "Order Now"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      <CinematicLightbox
        images={availableImages}
        initialIndex={lbIndex}
        open={lbOpen}
        onClose={() => setLbOpen(false)}
      />
    </>
  );
}
