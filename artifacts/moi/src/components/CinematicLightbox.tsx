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
  const [loaded, setLoaded] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch gesture refs
  const touchRefs = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    startDist: 0,
    startScale: 1,
    startPanX: 0,
    startPanY: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    panning: false,
  }).current;

  useEffect(() => {
    if (open) {
      setIdx(initialIndex);
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
      setLoaded(false);
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

  // Reset zoom/pan and loading on image change
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    setLoaded(false);
  }, [idx]);

  const go = useCallback((delta: number) => {
    setIdx((i) => (i + delta + images.length) % images.length);
  }, [images.length]);

  const current = images[idx] ?? "";
  const currentAlt = current.split("/").pop()?.replace(/\.(webp|jpg|png)$/i, "").replace(/-/g, " ") ?? "Image";

  // ── Touch handlers: swipe + pinch ──
  const getDist = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = touchRefs;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      t.pointers.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }

    if (t.pointers.size === 1) {
      const [pt] = Array.from(t.pointers.values());
      t.startX = pt.x;
      t.startY = pt.y;
      t.startTime = Date.now();
      t.panning = zoomScale > 1;
      if (zoomScale > 1) {
        t.startPanX = pan.x;
        t.startPanY = pan.y;
      }
    } else if (t.pointers.size === 2) {
      const pts = Array.from(t.pointers.values());
      t.startDist = getDist(pts[0], pts[1]);
      t.startScale = zoomScale;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = touchRefs;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (t.pointers.has(touch.identifier)) {
        t.pointers.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    }

    if (t.pointers.size === 2) {
      e.preventDefault();
      const pts = Array.from(t.pointers.values());
      const dist = getDist(pts[0], pts[1]);
      const newScale = Math.min(Math.max(t.startScale * (dist / Math.max(t.startDist, 1)), 1), 3.5);
      setZoomScale(newScale);
    } else if (t.pointers.size === 1 && zoomScale > 1) {
      e.preventDefault();
      const [pt] = Array.from(t.pointers.values());
      setPan({
        x: t.startPanX + (pt.x - t.startX) / zoomScale,
        y: t.startPanY + (pt.y - t.startY) / zoomScale,
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touchRefs;
    for (let i = 0; i < e.changedTouches.length; i++) {
      t.pointers.delete(e.changedTouches[i].identifier);
    }

    if (t.pointers.size === 0) {
      // Snap zoom below 1.1 back to 1
      if (zoomScale < 1.1) {
        setZoomScale(1);
        setPan({ x: 0, y: 0 });
      }
      // Swipe detection (single finger, no zoom)
      if (zoomScale <= 1) {
        const elapsed = Date.now() - t.startTime;
        const dx = (Array.from(t.pointers.values())[0]?.x ?? t.startX) - t.startX;
        const dy = (Array.from(t.pointers.values())[0]?.y ?? t.startY) - t.startY;
        const velocity = Math.abs(dx) / Math.max(1, elapsed);
        if ((Math.abs(dx) > 40 || velocity > 0.35) && Math.abs(dx) > Math.abs(dy)) {
          go(dx < 0 ? 1 : -1);
        }
      }
    }
  };

  const handleDoubleTap = () => {
    if (zoomScale > 1) {
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoomScale(2.2);
    }
  };

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
          onClick={(e) => { if (e.target === e.currentTarget && zoomScale <= 1) onClose(); }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 md:px-8 py-4 z-10 shrink-0">
            <span className="text-[10px] tracking-[0.35em] uppercase" style={{ color: "rgba(120,108,96,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
              {idx + 1} / {images.length}
            </span>
            <button onClick={onClose} className="hover:opacity-50 transition-opacity" aria-label="Close">
              <X size={22} strokeWidth={1.2} style={{ color: "#1e1814" }} />
            </button>
          </div>

          {/* ── Main image area ── */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center relative overflow-hidden select-none"
            style={{ touchAction: zoomScale > 1 ? "none" : "pan-y" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={handleDoubleTap}
          >
            {/* Skeleton while loading */}
            {!loaded && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: "rgba(30,24,20,0.04)" }}
              >
                <div
                  className="animate-pulse"
                  style={{
                    width: "min(70%, 320px)",
                    height: "min(50%, 240px)",
                    backgroundColor: "rgba(30,24,20,0.06)",
                    borderRadius: 2,
                  }}
                />
              </div>
            )}

            <img
              key={current}
              ref={imgRef}
              src={current}
              alt={currentAlt}
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `scale(${zoomScale}) translate(${pan.x}px, ${pan.y}px)`,
                transition: zoomScale === 1 ? "transform 0.35s cubic-bezier(0.32,0,0.16,1)" : "none",
                willChange: "transform",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                opacity: loaded ? 1 : 0,
                transitionProperty: "transform, opacity",
              }}
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />

            {/* Arrow nav (desktop only) */}
            {images.length > 1 && zoomScale <= 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center"
                  style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", color: "rgba(30,24,20,0.25)", transition: "color 0.25s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.25)")}
                >
                  <ChevronLeft size={24} strokeWidth={1} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center"
                  style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", color: "rgba(30,24,20,0.25)", transition: "color 0.25s ease" }}
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
            <div className="flex items-center justify-center gap-2 px-5 pb-6 pt-2 shrink-0">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setIdx(i); setZoomScale(1); setPan({ x: 0, y: 0 }); }}
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
