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

const GRAD_COLOR = "rgba(180,160,130,0.08)";

export function LookView({ product, onClose }: LookViewProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const [ready, setReady] = useState(false);
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

  // Preload all look images before revealing the panel
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

    if (urls.length === 0) { setReady(true); return undefined; }

    let loaded = 0;
    let settled = false;
    const markReady = () => { if (!settled) { settled = true; setReady(true); } };

    // Defer so the spinner always gets at least one rendered frame before onload fires
    const kickoff = setTimeout(() => {
      urls.forEach((url) => {
        const img = new Image();
        img.onload = img.onerror = () => { loaded++; if (loaded >= urls.length) markReady(); };
        img.src = url;
      });
    }, 0);

    const fallback = setTimeout(markReady, 1000);
    return () => { clearTimeout(kickoff); clearTimeout(fallback); };
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
    const raw = [product.look.model, product.look.earring, product.look.shoes, product.look.bag, product.look.extra].filter(Boolean) as string[];
    return raw.filter((s, i, a) => a.indexOf(s) === i);
  }, [product]);

  const sideImages = useMemo(() => {
    if (!product) return [];
    return availableImages.filter((s) => s !== activeImage).slice(0, 4);
  }, [activeImage, availableImages, product]);

  return (
    <>
      {/*
        Architecture for 144Hz mobile smoothness:
        1. Outer overlay: opacity-only transition — compositor-only, zero repaints
        2. Spinner: scale wrapper (framer) wraps plain div (CSS spin) — no transform conflict
        3. Panel motion.div: translateY + opacity only — NO scale on scrollable containers
        4. Scroll container: separate plain div inside the panel — not the animated element
      */}
      <AnimatePresence>
        {product && (
          <motion.div
            key="look-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[80]"
            style={{ backgroundColor: "#faf8f5", willChange: "opacity" }}
          >
            {/* ── Loading spinner — visible while !ready ──────────────────── */}
            <AnimatePresence>
              {!ready && (
                <motion.div
                  key="spinner"
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                >
                  {/*
                    Scale wrapper handled by framer-motion.
                    The CSS spin lives on a child plain div so `transform` doesn't conflict.
                  */}
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, scale: 0.72 },
                      show: {
                        opacity: 1,
                        scale: 1,
                        transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] },
                      },
                    }}
                    style={{ willChange: "transform, opacity" }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        border: "1.5px solid rgba(30,24,20,0.07)",
                        borderTopColor: "#1e1814",
                        animation: "lookSpin 0.75s linear infinite",
                      }}
                    />
                  </motion.div>

                  <motion.p
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                    }}
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "9.5px",
                      letterSpacing: "0.3em",
                      textTransform: "uppercase",
                      color: "rgba(120,108,96,0.6)",
                      willChange: "transform, opacity",
                    }}
                  >
                    Loading look
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Panel — translateY + opacity only (no scale on scroll container) ── */}
            <AnimatePresence>
              {ready && (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                  style={{ willChange: "transform, opacity" }}
                >
                  {/*
                    Scroll container is a plain div, completely separate from the
                    animated wrapper above — animating scale on overflow-y-auto
                    forces GPU re-rasterisation on every frame (kills 144Hz).
                  */}
                  <div
                    className="absolute inset-0 overflow-y-auto"
                    style={{
                      WebkitOverflowScrolling: "touch",
                      touchAction: "pan-y",
                      overscrollBehavior: "contain",
                    }}
                  >
                    {/* Ambient gradient */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse 100% 70% at 50% 20%, ${GRAD_COLOR} 0%, transparent 70%)`,
                      }}
                    />

                    {/* Sticky header */}
                    <div
                      className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-16 pb-3"
                      style={{
                        backgroundColor: "rgba(250,248,245,0.97)",
                        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
                        backdropFilter: "none",
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
                        opacity: 0.18,
                      }}
                    >
                      THE LOOK
                    </h2>

                    {/* ── Editorial layout ───────────────── */}
                    <div className="mx-auto w-full max-w-6xl px-5 md:px-16 pb-10 md:pb-16">

                      {/* Mobile: stacked hero + thumb strip */}
                      <div className="md:hidden flex flex-col gap-3">
                        <button
                          type="button"
                          className="relative w-full"
                          style={{ height: "56vh", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                          onClick={() => {
                            const i = availableImages.indexOf(activeImage ?? product.look.model);
                            setLbIndex(i >= 0 ? i : 0);
                            setLbOpen(true);
                          }}
                        >
                          {/* Plain img — already preloaded, renders instantly */}
                          <img
                            src={activeImage ?? product.look.model}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover object-top rounded-sm"
                            draggable={false}
                          />
                        </button>

                        {/* Horizontal thumb strip */}
                        <div
                          className="flex gap-2 overflow-x-auto pb-1"
                          style={{
                            scrollSnapType: "x mandatory",
                            scrollbarWidth: "none",
                            WebkitOverflowScrolling: "touch",
                            touchAction: "pan-x",
                          }}
                        >
                          {availableImages.map((src) => {
                            const active = src === (activeImage ?? product.look.model);
                            return (
                              <button
                                key={src}
                                type="button"
                                onClick={() => setActiveImage(src)}
                                className="flex-shrink-0 overflow-hidden rounded-sm"
                                style={{
                                  width: 68,
                                  aspectRatio: "1 / 1",
                                  border: active ? "2px solid #1e1814" : "2px solid transparent",
                                  opacity: active ? 1 : 0.6,
                                  scrollSnapAlign: "start",
                                  transition: "border-color 0.15s, opacity 0.15s",
                                }}
                              >
                                <img src={src} alt="" className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
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

                    {/* ── Bottom product strip ──────────── */}
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
                          whileTap={{ scale: 0.97 }}
                          onClick={handleAddToBag}
                          className="px-10 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors duration-200"
                          style={{
                            backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                            color: addedFeedback ? "#1e1814" : "#fff",
                            border: "1px solid #1e1814",
                            boxShadow: addedFeedback
                              ? "none"
                              : "0 0 20px rgba(30,24,20,0.15), 0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        >
                          {addedFeedback ? "Added \u2713" : "Order Now"}
                        </motion.button>
                      </div>
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
