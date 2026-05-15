import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import { IMAGES } from "@/config/images";

export function Carousel() {
  const images: readonly string[] = IMAGES.product1.filmstrip;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const color = useImageColor(images[activeIndex]);

  // Preload all filmstrip images immediately.
  useEffect(() => {
    for (const src of images) {
      if (!src) continue;
      const img = new Image();
      img.src = src as string;
    }
  }, [images]);

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = "";
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, images.length]);

  const rafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const centerX = el.scrollLeft + el.clientWidth / 2;
      const children = Array.from(el.children) as HTMLElement[];
      let closest = 0;
      let minDist = Infinity;
      children.forEach((child, i) => {
        const dist = Math.abs(child.offsetLeft + child.offsetWidth / 2 - centerX);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setActiveIndex(closest);
    });
  }, []);

  const gradBg = color?.rgba(0.14) ?? "rgba(180,160,140,0.10)";

  return (
    <>
      <section
        id="collection"
        className="relative w-full overflow-hidden py-0"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 50% 50%, ${gradBg} 0%, hsl(30 15% 95%) 65%)`,
        }}
      >
        <div className="relative">
          <div
            id="carousel-strip"
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-2 overflow-x-auto py-8"
            style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`#carousel-strip::-webkit-scrollbar { display: none; }`}</style>
            {images.map((src, i) => (
              <motion.button
                key={i}
                onClick={() => openLightbox(i)}
                className="flex-shrink-0 relative overflow-hidden focus:outline-none"
                style={{
                  width: "clamp(220px, 30vw, 380px)",
                  scrollSnapAlign: "center",
                }}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={src}
                  alt={`Cape look ${i + 1}`}
                  className="w-full h-full object-cover object-top transition-opacity duration-300"
                  style={{
                    height: "clamp(300px, 55vh, 600px)",
                    opacity: i === activeIndex ? 1 : 0.75,
                  }}
                />
              </motion.button>
            ))}
          </div>

          <div className="absolute top-4 right-6 md:right-12 flex flex-col items-end gap-1 pointer-events-none z-10">
            <span
              className="text-[10px] tracking-[0.3em] uppercase font-medium"
              style={{ color: "#1e1814", letterSpacing: "0.2em" }}
            >
              See Look
            </span>
          </div>

          <div className="absolute bottom-4 left-6 md:left-12 pointer-events-none z-10">
            <span
              className="text-[10px] tracking-widest uppercase font-light"
              style={{ color: "#7a6e64" }}
            >
              Height of model: 178 cm – Size S
            </span>
          </div>

          <button
            className="absolute bottom-4 right-6 md:right-12 z-10 hover:opacity-60 transition-opacity"
            aria-label="Add to wishlist"
            onClick={() => openLightbox(activeIndex)}
          >
            <Heart size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
          </button>
        </div>
      </section>

      <AnimatePresence>
        {lightboxOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm"
              onClick={closeLightbox}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[91] flex"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left: label + thumbnail strip */}
              <div
                className="hidden md:flex flex-col w-24 lg:w-28 bg-white h-full"
                style={{ backgroundColor: "hsl(30 20% 97%)" }}
              >
                <div className="px-3 pt-6 pb-4">
                  <p
                    className="text-[9px] tracking-[0.3em] uppercase font-medium leading-tight"
                    style={{ color: "#9a8e82" }}
                  >
                    The Collection
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-2 pb-4">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIdx(i)}
                      className="relative flex-shrink-0 focus:outline-none"
                      style={{ width: "100%", aspectRatio: "2/3" }}
                    >
                      <img
                        src={src}
                        alt={`Look ${i + 1} thumbnail`}
                        className="w-full h-full object-cover object-top transition-all duration-300"
                        style={{ opacity: i === lightboxIdx ? 1 : 0.45 }}
                      />
                      {i === lightboxIdx && (
                        <motion.div
                          layoutId="lb-thumb-border"
                          className="absolute inset-0 border-2"
                          style={{ borderColor: "#1e1814" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: full-size image */}
              <div className="flex-1 flex items-center justify-center relative bg-black">
                <AnimatePresence initial={false} mode="wait">
                  <motion.img
                    key={lightboxIdx}
                    src={images[lightboxIdx]}
                    alt={`Cape look ${lightboxIdx + 1}`}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  />
                </AnimatePresence>
              </div>

              <button
                onClick={closeLightbox}
                className="absolute top-5 right-6 z-10 hover:opacity-50 transition-opacity"
                aria-label="Close"
              >
                <X size={22} strokeWidth={1.5} className="text-white" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
