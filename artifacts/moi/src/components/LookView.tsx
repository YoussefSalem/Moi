import { useEffect, useMemo, useRef, useState } from "react";
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
  const panelRef = useRef<HTMLDivElement>(null);
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

    let settled = false;

    const markReady = () => {
      if (settled) return;
      settled = true;
      // Double-rAF: wait for the browser to paint the hidden panel before revealing.
      // This ensures layout + paint are done — reveal is then a pure compositor flip.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setReady(true);
        });
      });
    };

    const kickoff = setTimeout(async () => {
      const decodePromises = urls.map(async (url) => {
        const img = new Image();
        img.src = url;
        try {
          // img.decode() waits for GPU texture upload — not just HTTP complete
          await img.decode();
        } catch {
          // silently ignore decode failures (e.g. network error)
        }
      });

      // Minimum intentional pause: ensures animations always have time to
      // initialize, preventing the panel from snapping in too fast even on
      // fast connections. Runs in parallel with image decoding.
      const minPause = new Promise<void>((res) => setTimeout(res, 350));

      // Reveal only when BOTH the images are GPU-ready AND the min pause elapsed
      await Promise.all([Promise.all(decodePromises), minPause]);
      markReady();
    }, 0);

    // Hard fallback — never block longer than 1.2s
    const fallback = setTimeout(markReady, 1200);

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
    const raw = [
      product.look.model,
      product.look.earring,
      product.look.shoes,
      product.look.bag,
      product.look.extra,
    ].filter(Boolean) as string[];
    return raw.filter((s, i, a) => a.indexOf(s) === i);
  }, [product]);

  const sideImages = useMemo(() => {
    if (!product) return [];
    return availableImages.filter((s) => s !== activeImage).slice(0, 4);
  }, [activeImage, availableImages, product]);

  return (
    <>
      <AnimatePresence>
        {product && (
          <motion.div
            key="look-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80]"
            style={{ backgroundColor: "#faf8f5", willChange: "opacity" }}
          >

            {/*
              KEY PERFORMANCE TRICK:
              The panel is rendered in the DOM immediately (even while !ready)
              but is invisible + non-interactive. This lets the browser do all
              layout and paint work while the spinner is showing.
              When ready flips, the reveal is a pure compositor opacity change —
              zero paint cost, zero jank at 144Hz.
            */}
            <div
              ref={panelRef}
              className="absolute inset-0"
              style={{
                opacity: ready ? 1 : 0,
                // Subtle upward drift — starts 14px below, rises as it fades in
                transform: ready ? "translateY(0)" : "translateY(14px)",
                pointerEvents: ready ? "auto" : "none",
                // Fast start (feels snappy), long smooth tail (feels cinematic)
                transition: ready
                  ? "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)"
                  : "none",
                willChange: "opacity, transform",
              }}
            >
              {/* Scroll container: completely separate from any animated/transformed wrapper */}
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
                  }}
                >
                  <button
                    onClick={onClose}
                    className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase active:opacity-40 transition-opacity duration-100"
                    style={{ color: "#1e1814", touchAction: "manipulation", userSelect: "none", WebkitTapHighlightColor: "transparent", minHeight: 44, minWidth: 44 }}
                  >
                    <span style={{ fontFamily: "monospace", fontSize: 16 }}>&#8592;</span>
                    <span>Back</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="active:opacity-40 transition-opacity duration-100"
                    aria-label="Close"
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
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

                {product && (
                  <>
                    {/* Editorial layout */}
                    <div className="mx-auto w-full max-w-6xl px-5 md:px-16 pb-10 md:pb-16">

                      {/* Mobile: stacked hero + thumb strip */}
                      <div className="md:hidden flex flex-col gap-3">
                        <button
                          type="button"
                          className="relative w-full active:opacity-90 transition-opacity duration-100"
                          style={{ height: "56vh", background: "none", border: "none", padding: 0, cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", userSelect: "none" }}
                          onClick={() => {
                            const i = availableImages.indexOf(activeImage ?? product.look.model);
                            setLbIndex(i >= 0 ? i : 0);
                            setLbOpen(true);
                          }}
                        >
                          <img
                            key={activeImage ?? product.look.model}
                            src={activeImage ?? product.look.model}
                            alt={product.name}
                            className="look-img-fade absolute inset-0 w-full h-full object-cover object-top rounded-sm"
                            draggable={false}
                          />
                        </button>

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
                                  touchAction: "manipulation",
                                  WebkitTapHighlightColor: "transparent",
                                  userSelect: "none",
                                }}
                              >
                                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
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
                                className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 active:opacity-60 transition-opacity duration-150"
                                style={{ aspectRatio: "1 / 1", background: "none", padding: 0, cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                              >
                                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className="relative block w-full active:opacity-90 transition-opacity duration-100"
                          style={{ height: "70vh", background: "none", border: "none", padding: 0, cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                          onClick={() => {
                            const i = availableImages.indexOf(activeImage ?? product.look.model);
                            setLbIndex(i >= 0 ? i : 0);
                            setLbOpen(true);
                          }}
                        >
                          <img
                            key={activeImage ?? product.look.model}
                            src={activeImage ?? product.look.model}
                            alt={product.name}
                            className="look-img-fade w-full h-full object-cover object-top"
                            draggable={false}
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
                                className="overflow-hidden rounded-sm border border-stone-200 hover:opacity-75 active:opacity-60 transition-opacity duration-150"
                                style={{ aspectRatio: "1 / 1", background: "none", padding: 0, cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                              >
                                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
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
                          whileTap={{ scale: 0.97 }}
                          onClick={handleAddToBag}
                          className="px-10 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium"
                          style={{
                            backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                            color: addedFeedback ? "#1e1814" : "#fff",
                            border: "1px solid #1e1814",
                            transition: "background-color 0.2s, color 0.2s, box-shadow 0.2s",
                            boxShadow: addedFeedback
                              ? "none"
                              : "0 0 20px rgba(30,24,20,0.15), 0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        >
                          {addedFeedback ? "Added \u2713" : "Order Now"}
                        </motion.button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Spinner — overlaid on top, fades out once ready */}
            <AnimatePresence>
              {!ready && (
                <motion.div
                  key="spinner"
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }}
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
                >
                  {/* Scale wrapper (framer) — child plain div handles CSS rotation, no transform conflict */}
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, scale: 0.7 },
                      show: {
                        opacity: 1,
                        scale: 1,
                        transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
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
                      show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
                    }}
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "9.5px",
                      letterSpacing: "0.3em",
                      textTransform: "uppercase",
                      color: "rgba(120,108,96,0.6)",
                    }}
                  >
                    Loading look
                  </motion.p>
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
