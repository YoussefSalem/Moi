import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface CinematicLightboxProps {
  images: readonly string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function CinematicLightbox({ images, initialIndex, open, onClose }: CinematicLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const [dir, setDir] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  useEffect(() => {
    if (open) {
      setIdx(initialIndex);
      setDir(0);
      setZoomed(false);
      setPan({ x: 0, y: 0 });
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  const go = useCallback((delta: number) => {
    if (zoomed) { setZoomed(false); setPan({ x: 0, y: 0 }); }
    setDir(delta);
    setIdx((i) => (i + delta + images.length) % images.length);
  }, [images.length, zoomed]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoomed) return;
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    touchStartTime.current = Date.now();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (zoomed) return;
    const startX = touchStartX.current;
    if (startX === null) return;
    const deltaX = e.clientX - startX;
    const deltaY = (touchStartY.current ?? e.clientY) - e.clientY;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaX) / Math.max(1, elapsed);
    const isSwipe = Math.abs(deltaX) > 50 || velocity > 0.4;
    if (isSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
      go(deltaX < 0 ? 1 : -1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const toggleZoom = () => {
    if (zoomed) {
      setZoomed(false);
      setPan({ x: 0, y: 0 });
    } else {
      setZoomed(true);
    }
  };

  const swipeVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  const current = images[idx] ?? "";
  const currentAlt = current.split("/").pop()?.replace(/\.(webp|jpg|png)$/i, "").replace(/-/g, " ") ?? "Image";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ backgroundColor: "rgba(250,248,245,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !zoomed) onClose(); }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 md:px-8 py-4 z-10">
            <span className="text-[10px] tracking-[0.35em] uppercase" style={{ color: "rgba(120,108,96,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
              {idx + 1} / {images.length}
            </span>
            <button
              onClick={onClose}
              className="hover:opacity-50 transition-opacity"
              aria-label="Close"
            >
              <X size={22} strokeWidth={1.2} style={{ color: "#1e1814" }} />
            </button>
          </div>

          {/* ── Main image area ── */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center relative overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            style={{ touchAction: zoomed ? "none" : "pan-y", cursor: zoomed ? "grab" : "pointer" }}
          >
            <AnimatePresence initial={false} custom={dir} mode="wait">
              <motion.img
                key={current}
                custom={dir}
                variants={swipeVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.32, 0, 0.16, 1] }}
                src={current}
                alt={currentAlt}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: zoomed ? `scale(1.6) translate(${pan.x}px, ${pan.y}px)` : "scale(1)",
                  transition: "transform 0.35s cubic-bezier(0.32,0,0.16,1)",
                  willChange: "transform, opacity",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
                draggable={false}
                loading="eager"
                decoding="async"
              />
            </AnimatePresence>

            {/* Arrow nav */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center transition-colors duration-300"
                  style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", color: "rgba(30,24,20,0.25)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.25)")}
                >
                  <ChevronLeft size={24} strokeWidth={1} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center transition-colors duration-300"
                  style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", color: "rgba(30,24,20,0.25)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.25)")}
                >
                  <ChevronRight size={24} strokeWidth={1} />
                </button>
              </>
            )}
          </div>

          {/* ── Thumbnail strip ── */}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-2 px-5 pb-6 pt-2">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setDir(i > idx ? 1 : -1); setIdx(i); if (zoomed) { setZoomed(false); setPan({ x: 0, y: 0 }); } }}
                  className="flex-shrink-0 overflow-hidden transition-all duration-200"
                  style={{
                    width: 44,
                    height: 44,
                    border: i === idx ? "2px solid #1e1814" : "2px solid transparent",
                    opacity: i === idx ? 1 : 0.5,
                    borderRadius: 2,
                  }}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
