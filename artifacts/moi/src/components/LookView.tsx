import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ProductConfig } from "@/config/images";
import { useCart } from "@/context/CartContext";
import { CinematicLightbox } from "@/components/CinematicLightbox";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

const GRAD_COLOR = "rgba(180,160,130,0.10)";

export function LookView({ product, onClose }: LookViewProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  // ready=false: show spinner; ready=true: show panel
  const [ready, setReady] = useState(false);
  const { addToCart } = useCart();

  // Lock scroll while panel is open
  useEffect(() => {
    if (product) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [product]);

  // Escape key closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Preload images when product changes; ready=true only after all loaded (or 800ms timeout)
  useEffect(() => {
    setActiveImage(product?.look.model ?? null);
    setAddedFeedback(false);
    setReady(false);

    if (!product) return undefined;

    const urls = [
      product.look.model,
      product.look.shoes,
      product.look.bag,
      product.look.earring,
      product.look.extra,
    ].filter(Boolean) as string[];

    if (urls.length === 0) {
      setReady(true);
      return undefined;
    }

    let loaded = 0;
    let settled = false;

    const markReady = () => {
      if (!settled) {
        settled = true;
        setReady(true);
      }
    };

    // Use setTimeout so cached-image onload never beats the first render
    const kickoff = setTimeout(() => {
      urls.forEach((url) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded >= urls.length) markReady();
        };
        img.src = url;
      });
    }, 0);

    // Hard fallback — never wait more than 900ms regardless
    const fallback = setTimeout(markReady, 900);

    return () => {
      clearTimeout(kickoff);
      clearTimeout(fallback);
    };
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

  const availableImages = useMemo(() => {
    if (!product) return [];
    const items = [
      product.look.model,
      product.look.earring,
      product.look.shoes,
      product.look.bag,
      product.look.extra,
    ].filter(Boolean) as string[];
    return items.filter((src, i, arr) => arr.indexOf(src) === i);
  }, [product]);

  const sideImages = useMemo(() => {
    if (!product) return [];
    return availableImages.filter((src) => src !== activeImage).slice(0, 4);
  }, [activeImage, availableImages, product]);

  return (
    <>
      {/* Single overlay — mounts when product is set, never unmounts until closed.
          Inside, crossfade between spinner and panel to avoid any blip. */}
      <AnimatePresence>
        {product && (
          <motion.div
            key="look-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[80]"
            style={{ backgroundColor: "#faf8f5", transform: "translateZ(0)" }}
          >
            {/* Spinner — visible while !ready */}
            <AnimatePresence>
              {!ready && (
                <motion.div
                  key="spinner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "2px solid rgba(30,24,20,0.08)",
                      borderTopColor: "#1e1814",
                      animation: "lookSpin 0.8s linear infinite",
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "10px",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "rgba(120,108,96,0.65)",
                    }}
                  >
                    Loading look
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Panel content — crossfades in when ready */}
            <AnimatePresence>
              {ready && (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="absolute inset-0 overflow-y-auto"
                >
            {/* Subtle ambient gradient */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 120% 90% at 50% 35%, ${GRAD_COLOR} 0%, transparent 75%)`,
              }}
            />

            {/* Sticky header */}
            <div
              className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-16 pt-5 pb-3"
              style={{
                backgroundColor: "rgba(250,248,245,0.97)",
                paddingTop: "max(1.25rem, env(safe-area-inset-top))",
              }}
            >
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase hover:opacity-50 transition-opacity"
                style={{ color: "#1e1814" }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 16 }}>&#8592;</span>
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

            {/* THE LOOK watermark */}
            <h2
              className="text-center font-serif leading-none mb-8 select-none pointer-events-none"
              style={{
                color: "#1e1814",
                fontSize: "clamp(2.5rem, 9vw, 11rem)",
                letterSpacing: "0.08em",
                fontWeight: 300,
                opacity: 0.22,
              }}
            >
              THE LOOK
            </h2>

            {/* Editorial layout */}
            <div className="mx-auto w-full max-w-6xl px-5 md:px-16 pb-10 md:pb-16">

              {/* Mobile: full-height hero + horizontal thumbnail strip */}
              <div className="md:hidden flex flex-col gap-3">
                <button
                  type="button"
                  className="relative w-full"
                  style={{ height: "55vh", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  onClick={() => {
                    const i = availableImages.indexOf(activeImage ?? product.look.model);
                    setLbIndex(i >= 0 ? i : 0);
                    setLbOpen(true);
                  }}
                >
                  <img
                    src={activeImage ?? product.look.model}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover object-top rounded-sm"
                    draggable={false}
                  />
                </button>
                <div
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
                >
                  {availableImages.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActiveImage(src)}
                      className="flex-shrink-0 overflow-hidden rounded-sm"
                      style={{
                        width: 72,
                        aspectRatio: "1 / 1",
                        border: src === (activeImage ?? product.look.model) ? "2px solid #1e1814" : "2px solid transparent",
                        opacity: src === (activeImage ?? product.look.model) ? 1 : 0.65,
                        scrollSnapAlign: "start",
                        transition: "border-color 0.18s, opacity 0.18s",
                      }}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop: 2 + center + 2 editorial grid */}
              <div className="hidden md:grid grid-cols-[minmax(140px,1fr)_minmax(0,1.35fr)_minmax(140px,1fr)] gap-6 items-center">
                <div className="grid grid-rows-2 gap-4">
                  {sideImages.slice(0, 2).map((src) => {
                    const idx = availableImages.indexOf(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => { setLbIndex(idx); setLbOpen(true); }}
                        className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 transition-opacity"
                        style={{ aspectRatio: "1 / 1", background: "none", padding: 0, cursor: "pointer" }}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
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
                  <img
                    src={activeImage ?? product.look.model}
                    alt={product.name}
                    className="w-full h-full object-cover object-top"
                  />
                </button>
                <div className="grid grid-rows-2 gap-4">
                  {sideImages.slice(2, 4).map((src) => {
                    const idx = availableImages.indexOf(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => { setLbIndex(idx); setLbOpen(true); }}
                        className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 transition-opacity"
                        style={{ aspectRatio: "1 / 1", background: "none", padding: 0, cursor: "pointer" }}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom product strip */}
            <div
              className="border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-8 md:px-16 py-8"
              style={{ borderColor: "rgba(180,160,140,0.2)" }}
            >
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
              <div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToBag}
                  className="px-10 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300"
                  style={{
                    backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                    color: addedFeedback ? "#1e1814" : "#fff",
                    border: "1px solid #1e1814",
                    boxShadow: addedFeedback
                      ? "none"
                      : "0 0 24px rgba(30,24,20,0.18), 0 4px 14px rgba(0,0,0,0.12)",
                  }}
                >
                  {addedFeedback ? "Added \u2713" : "Order Now"}
                </motion.button>
              </div>
            </div>
                </motion.div>
              )}
            </AnimatePresence>
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
