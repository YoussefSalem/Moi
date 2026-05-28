import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ProductConfig } from "@/config/images";
import { useCart } from "@/context/CartContext";
import { parseEGP } from "@/lib/price";
import { CinematicLightbox } from "@/components/CinematicLightbox";
import { ImageSkeleton } from "@/components/ImageSkeleton";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
}

const GRAD_COLOR = "rgba(210,195,175,0.08)";

export function LookView({ product, onClose }: LookViewProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  // displaySrc is what's actually rendered — lags activeImage by ~180ms for crossfade
  const [displaySrc, setDisplaySrc] = useState<string | undefined>(undefined);
  // fading: image is transitioning out (opacity → 0)
  const [fading, setFading] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [addingToBag, setAddingToBag] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [thumbLoading, setThumbLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Stable img refs — NO key-based remounting (kills GPU layers on mobile)
  const mobileHeroRef = useRef<HTMLImageElement>(null);
  const desktopHeroRef = useRef<HTMLImageElement>(null);
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

  // After displaySrc changes, immediately check if it's already in browser cache.
  // onLoad doesn't fire for cached images, so this prevents thumbLoading getting stuck.
  useLayoutEffect(() => {
    for (const ref of [mobileHeroRef, desktopHeroRef]) {
      const img = ref.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setThumbLoading(false);
        break;
      }
    }
  }, [displaySrc]);

  useEffect(() => {
    const initialSrc = product?.look.model ?? "";
    setActiveImage(initialSrc || null);
    setDisplaySrc(initialSrc || undefined);
    setFading(false);
    setThumbLoading(false);
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

    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true);
        });
      });
    };

    // ⚠️ DO NOT call img.decode() here.
    // img.decode() forces full GPU texture upload for every image simultaneously.
    // On iOS Safari, 5 large images decoded at once = 150-250 MB GPU memory → WebKit OOM kill.
    //
    // Instead: wait for the first (hero) image to load naturally, then reveal.
    // The heavy DOM is already in the DOM but hidden via `display:none` (not opacity)
    // so it causes zero layout/paint cost while the spinner is showing.
    const heroImg = new Image();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const onHeroReady = () => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 120);
    };

    heroImg.addEventListener("load", onHeroReady);
    heroImg.addEventListener("error", onHeroReady);
    heroImg.src = urls[0]!;
    if (heroImg.complete && heroImg.naturalWidth > 0) {
      onHeroReady();
    }

    // Warm the other images in the background (no blocking)
    urls.slice(1).forEach((src) => { const img = new Image(); img.src = src; });

    return () => {
      cancelled = true;
      heroImg.removeEventListener("load", onHeroReady);
      heroImg.removeEventListener("error", onHeroReady);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [product]);

  const handleAddToBag = async () => {
    if (!product || addingToBag) return;
    setAddingToBag(true);
    try {
      await addToCart({
        variantId: product.variantId,
        title: product.name,
        price: product.price,
        priceAmount: parseEGP(product.price),
        currencyCode: "EGP",
        image: product.look.model,
      });
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 1800);
    } finally {
      setAddingToBag(false);
    }
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
              Instead of rendering heavy DOM hidden via opacity (causes 1-sec
              freeze on first visit while images are cold), we render nothing
              until `ready`. When ready flips, a smooth opacity+transform fade
              brings the content in. This is the simplest path to zero jank.
            */}
            <div
              ref={panelRef}
              className="absolute inset-0"
              style={{
                display: ready ? "block" : "none",
                // Once visible, smooth fade in with upward drift
                opacity: ready ? 1 : 0,
                transform: ready ? "translateY(0)" : "translateY(14px)",
                transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
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
                    <span style={{ fontFamily: "monospace", fontSize: 17 }}>&#8592;</span>
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
                    fontSize: "clamp(2.6rem, 9vw, 11.44rem)",
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
                          {/* Stable DOM node — NO key remounting. Crossfade via opacity transition.
                              Remounting on every tap creates GPU layers → mobile tab crash. */}
                          <img
                            ref={mobileHeroRef}
                            src={displaySrc || product.look.model}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover object-top rounded-sm"
                            style={{
                              opacity: fading || thumbLoading ? 0 : 1,
                              transition: fading
                                ? "opacity 0.18s ease-in"
                                : "opacity 0.25s ease-out",
                            }}
                            draggable={false}
                            onLoad={() => setThumbLoading(false)}
                            onError={() => setThumbLoading(false)}
                          />
                          {/* Skeleton pulse while new image loads (between fade-out and onLoad) */}
                          {thumbLoading && !fading && (
                            <ImageSkeleton variant="card" borderRadius={2} />
                          )}
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
                                onClick={() => {
                                  if (src === displaySrc) return;
                                  setActiveImage(src);
                                  setFading(true);
                                  setThumbLoading(true);
                                  setTimeout(() => {
                                    setDisplaySrc(src);
                                    setFading(false);
                                  }, 180);
                                }}
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
                            ref={desktopHeroRef}
                            src={displaySrc || product.look.model}
                            alt={product.name}
                            className="w-full h-full object-cover object-top"
                            style={{
                              opacity: fading || thumbLoading ? 0 : 1,
                              transition: fading
                                ? "opacity 0.18s ease-in"
                                : "opacity 0.25s ease-out",
                            }}
                            draggable={false}
                            onLoad={() => setThumbLoading(false)}
                            onError={() => setThumbLoading(false)}
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
                          fontSize: "clamp(1.46rem, 3vw, 2.08rem)",
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
                          fontSize: "clamp(0.99rem, 2vw, 1.14rem)",
                          fontWeight: 500,
                          letterSpacing: "0.12em",
                          color: "#1e1814",
                        }}
                      >
                        {product.price}
                      </p>
                      <div>
                        <motion.button
                          whileHover={addingToBag ? {} : { scale: 1.02 }}
                          whileTap={addingToBag ? {} : { scale: 0.97 }}
                          onClick={handleAddToBag}
                          disabled={addingToBag}
                          className="px-10 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium"
                          style={{
                            backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                            color: addedFeedback ? "#1e1814" : "#fff",
                            border: "1px solid #1e1814",
                            transition: "background-color 0.2s, color 0.2s, box-shadow 0.2s, opacity 0.2s",
                            opacity: addingToBag ? 0.6 : 1,
                            cursor: addingToBag ? "wait" : "pointer",
                            boxShadow: addedFeedback || addingToBag
                              ? "none"
                              : "0 0 20px rgba(30,24,20,0.15), 0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        >
                          {addedFeedback ? "Added \u2713" : addingToBag ? "Adding\u2026" : "Order Now"}
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
