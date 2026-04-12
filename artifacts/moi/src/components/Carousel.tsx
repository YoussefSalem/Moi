import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import { IMAGES } from "@/config/images";

export function Carousel() {
  const images = IMAGES.carousel as readonly string[];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeThumb, setActiveThumb] = useState(0);
  const color = useImageColor(images[activeThumb]);

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    document.body.style.overflow = "";
  };

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);

  const gradientColor = color?.rgba(0.18) ?? "rgba(180, 160, 130, 0.12)";

  return (
    <>
      <section
        className="relative w-full py-24 md:py-36 overflow-hidden"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 50% 50%, ${gradientColor} 0%, hsl(30 20% 97%) 65%)`,
          transition: "background 1.2s ease",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-14"
        >
          <p
            className="text-[10px] tracking-[0.5em] uppercase mb-4 font-medium"
            style={{ color: "#9a8e82" }}
          >
            Curated
          </p>
          <h2
            className="font-serif text-[clamp(2rem,5vw,4rem)] font-light"
            style={{ color: "#1e1814", letterSpacing: "0.05em" }}
          >
            The Collection
          </h2>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-4 max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:w-20 pb-2 md:pb-0 md:max-h-[600px] scrollbar-hide">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => { setActiveThumb(i); openLightbox(i); }}
                onMouseEnter={() => setActiveThumb(i)}
                className="relative flex-shrink-0"
                style={{ width: 64, height: 88 }}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover object-top transition-all duration-300"
                  style={{ opacity: activeThumb === i ? 1 : 0.45, filter: activeThumb === i ? "none" : "grayscale(20%)" }}
                  crossOrigin="anonymous"
                />
                {activeThumb === i && (
                  <motion.div
                    layoutId="carousel-thumb-border"
                    className="absolute inset-0 border-2"
                    style={{ borderColor: "#1e1814" }}
                  />
                )}
              </button>
            ))}
          </div>

          <motion.div
            className="flex-1 relative overflow-hidden cursor-pointer group"
            style={{ maxHeight: 680 }}
            onClick={() => openLightbox(activeThumb)}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={activeThumb}
                src={images[activeThumb]}
                alt="Collection"
                className="w-full h-full object-cover object-top"
                style={{ maxHeight: 680 }}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.03 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                crossOrigin="anonymous"
              />
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute inset-0 flex items-end pb-10 justify-center"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 60%)" }}
            >
              <p className="text-xs tracking-[0.35em] uppercase font-medium text-white">
                Open Gallery
              </p>
            </motion.div>

            <div className="absolute top-0 right-0 p-4">
              <span
                className="text-[10px] tracking-[0.3em] uppercase font-medium px-3 py-2"
                style={{
                  backgroundColor: "rgba(250,248,245,0.9)",
                  color: "#1e1814",
                  backdropFilter: "blur(8px)",
                }}
              >
                {activeThumb + 1} / {images.length}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[90] bg-black/92 backdrop-blur-sm"
              onClick={closeLightbox}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[91] flex items-center justify-center"
            >
              <button
                onClick={closeLightbox}
                className="absolute top-6 right-6 z-10 hover:opacity-50 transition-opacity"
                aria-label="Close"
              >
                <X size={22} strokeWidth={1.5} className="text-white" />
              </button>

              <button
                onClick={prev}
                className="absolute left-4 md:left-8 hover:opacity-50 transition-opacity"
                aria-label="Previous"
              >
                <ChevronLeft size={32} strokeWidth={1} className="text-white" />
              </button>

              <AnimatePresence mode="wait">
                <motion.img
                  key={lightboxIndex}
                  src={images[lightboxIndex]}
                  alt=""
                  className="max-h-[90vh] max-w-[90vw] md:max-w-[50vw] object-contain"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  crossOrigin="anonymous"
                />
              </AnimatePresence>

              <button
                onClick={next}
                className="absolute right-4 md:right-8 hover:opacity-50 transition-opacity"
                aria-label="Next"
              >
                <ChevronRight size={32} strokeWidth={1} className="text-white" />
              </button>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                    style={{ backgroundColor: i === lightboxIndex ? "#fff" : "rgba(255,255,255,0.35)" }}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
