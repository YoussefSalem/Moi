import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ProductConfig } from "~/config/images";
import { ImageSkeleton } from "~/components/ImageSkeleton";

interface LookViewProps {
  product: ProductConfig | null;
  onClose: () => void;
  onAddToCart?: (variantId: string, quantity: number) => Promise<void>;
}

const GRAD_COLOR = "rgba(210,195,175,0.08)";

export function LookView({ product, onClose, onAddToCart }: LookViewProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string | undefined>(undefined);
  const [fading, setFading] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [thumbLoading, setThumbLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileHeroRef = useRef<HTMLImageElement>(null);
  const desktopHeroRef = useRef<HTMLImageElement>(null);

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
    setReady(false);

    if (!product) return undefined;

    const urls = [
      product.look.model, product.look.shoes, product.look.bag, product.look.earring, product.look.extra,
    ].filter(Boolean) as string[];

    if (urls.length === 0) { setReady(true); return undefined; }

    let cancelled = false;
    const heroImg = new Image();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const onHeroReady = () => {
      if (cancelled) return;
      timeoutId = setTimeout(() => { if (!cancelled) setReady(true); }, 120);
    };

    heroImg.addEventListener("load", onHeroReady);
    heroImg.addEventListener("error", onHeroReady);
    heroImg.src = urls[0]!;
    if (heroImg.complete && heroImg.naturalWidth > 0) onHeroReady();

    urls.slice(1).forEach((src) => { const img = new Image(); img.src = src; });

    return () => {
      cancelled = true;
      heroImg.removeEventListener("load", onHeroReady);
      heroImg.removeEventListener("error", onHeroReady);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [product]);

  const availableImages = useMemo(() => {
    if (!product) return [];
    const raw = [
      product.look.model, product.look.earring, product.look.shoes, product.look.bag, product.look.extra,
    ].filter(Boolean) as string[];
    return raw.filter((s, i, a) => a.indexOf(s) === i);
  }, [product]);

  const sideImages = useMemo(() => {
    if (!product) return [];
    return availableImages.filter((s) => s !== activeImage).slice(0, 4);
  }, [activeImage, availableImages, product]);

  const switchImage = (src: string) => {
    if (src === displaySrc) return;
    setActiveImage(src);
    setFading(true);
    setThumbLoading(true);
    setTimeout(() => { setDisplaySrc(src); setFading(false); }, 180);
  };

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          key="look-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80]"
          style={{ backgroundColor: "#faf8f5", willChange: "opacity" }}
        >
          <div
            ref={panelRef}
            className="absolute inset-0"
            style={{
              display: ready ? "block" : "none",
              opacity: ready ? 1 : 0,
              transform: ready ? "translateY(0)" : "translateY(14px)",
              transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
              willChange: "opacity, transform",
            }}
          >
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#faf8f5" }}>
                <div className="text-[10px] tracking-[0.3em] uppercase" style={{ color: "rgba(30,24,20,0.35)", fontFamily: "'Montserrat', sans-serif" }}>
                  Loading...
                </div>
              </div>
            )}

            <div
              className="absolute inset-0 overflow-y-auto"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y", overscrollBehavior: "contain" }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 100% 70% at 50% 20%, ${GRAD_COLOR} 0%, transparent 70%)` }} />

              {/* Sticky header */}
              <div
                className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-16 pb-3"
                style={{ backgroundColor: "rgba(250,248,245,0.97)", paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
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

              <h2
                className="text-center font-serif leading-none mb-8 select-none pointer-events-none"
                style={{ color: "#1e1814", fontSize: "clamp(2.6rem, 9vw, 11.44rem)", letterSpacing: "0.08em", fontWeight: 300, opacity: 0.18 }}
              >
                THE LOOK
              </h2>

              {product && (
                <div className="mx-auto w-full max-w-6xl px-5 md:px-16 pb-10 md:pb-16">
                  {/* Mobile */}
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
                        ref={mobileHeroRef}
                        src={displaySrc || product.look.model || undefined}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover object-top rounded-sm"
                        style={{ opacity: fading || thumbLoading ? 0 : 1, transition: fading ? "opacity 0.18s ease-in" : "opacity 0.25s ease-out" }}
                        draggable={false}
                        onLoad={() => setThumbLoading(false)}
                        onError={() => setThumbLoading(false)}
                      />
                      {thumbLoading && !fading && <ImageSkeleton variant="warm" />}
                    </button>

                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
                      {availableImages.map((src) => {
                        const active = src === (activeImage ?? product.look.model);
                        return (
                          <button
                            key={src}
                            type="button"
                            onClick={() => switchImage(src)}
                            className="flex-shrink-0 overflow-hidden rounded-sm"
                            style={{ width: 68, aspectRatio: "1/1", border: active ? "2px solid #1e1814" : "2px solid transparent", opacity: active ? 1 : 0.6, scrollSnapAlign: "start", transition: "border-color 0.15s, opacity 0.15s", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                          >
                            <img src={src || undefined} alt="" className="w-full h-full object-cover" draggable={false} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Desktop */}
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
                            style={{ aspectRatio: "1/1", background: "none", padding: 0, cursor: "pointer" }}
                          >
                            <img src={src || undefined} alt="" className="w-full h-full object-cover" draggable={false} />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="relative w-full active:opacity-90 transition-opacity duration-100"
                      style={{ aspectRatio: "2/3", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      onClick={() => {
                        const i = availableImages.indexOf(activeImage ?? product.look.model);
                        setLbIndex(i >= 0 ? i : 0);
                        setLbOpen(true);
                      }}
                    >
                      <img
                        ref={desktopHeroRef}
                        src={displaySrc || product.look.model || undefined}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover object-top rounded-sm"
                        style={{ opacity: fading || thumbLoading ? 0 : 1, transition: fading ? "opacity 0.18s ease-in" : "opacity 0.25s ease-out" }}
                        draggable={false}
                        onLoad={() => setThumbLoading(false)}
                        onError={() => setThumbLoading(false)}
                      />
                      {thumbLoading && !fading && <ImageSkeleton variant="warm" />}
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
                            style={{ aspectRatio: "1/1", background: "none", padding: 0, cursor: "pointer" }}
                          >
                            <img src={src || undefined} alt="" className="w-full h-full object-cover" draggable={false} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Desktop thumbnails */}
                  <div className="hidden md:flex justify-center gap-3 mt-6">
                    {availableImages.map((src) => {
                      const active = src === (activeImage ?? product.look.model);
                      return (
                        <button
                          key={src}
                          type="button"
                          onClick={() => switchImage(src)}
                          className="overflow-hidden rounded-sm transition-all duration-150"
                          style={{ width: 60, height: 60, border: active ? "2px solid #1e1814" : "2px solid transparent", opacity: active ? 1 : 0.5 }}
                        >
                          <img src={src || undefined} alt="" className="w-full h-full object-cover" draggable={false} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Product info */}
                  <div className="mt-10 text-center">
                    <p className="text-[10px] tracking-[0.35em] uppercase mb-3" style={{ color: "#7a6e64" }}>{product.name}</p>
                    <p className="font-serif text-2xl mb-2" style={{ color: "#1e1814" }}>{product.price}</p>
                    <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "rgba(30,24,20,0.6)" }}>{product.description}</p>
                    <button
                      onClick={onClose}
                      className="mt-6 px-8 py-3 text-[11px] tracking-[0.25em] uppercase text-white transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "#1e1814" }}
                    >
                      Shop This Look
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-8 h-8 rounded-full border-2"
                  style={{ borderColor: "rgba(30,24,20,0.12)", borderTopColor: "#1e1814", animation: "spin 0.8s linear infinite" }}
                />
              </div>
            )}
          </div>

          {/* Lightbox */}
          <AnimatePresence>
            {lbOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[90] bg-black/90"
                  onClick={() => setLbOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 z-[91] flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={availableImages[lbIndex] || undefined}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: "90vh" }}
                  />
                  <button
                    onClick={() => setLbOpen(false)}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                  {availableImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setLbIndex((i) => (i - 1 + availableImages.length) % availableImages.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white text-xl"
                      >‹</button>
                      <button
                        onClick={() => setLbIndex((i) => (i + 1) % availableImages.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white text-xl"
                      >›</button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
