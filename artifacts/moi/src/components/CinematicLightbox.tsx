import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
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

  // Refs so gesture handlers always read latest values without re-attaching
  const zoomScaleRef = useRef(zoomScale);
  const panRef = useRef(pan);
  useEffect(() => { zoomScaleRef.current = zoomScale; }, [zoomScale]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Mutable gesture state — updated imperatively, never causes re-renders
  const gesture = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    startX: 0, startY: 0, startTime: 0,
    startDist: 0, startScale: 1,
    startPanX: 0, startPanY: 0,
    lastX: 0, lastY: 0,
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

  // Reset on image change
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    setLoaded(false);
  }, [idx]);

  const go = useCallback((delta: number) => {
    setIdx((i) => (i + delta + images.length) % images.length);
  }, [images.length]);

  // Stable refs for callbacks — avoids re-attaching listeners when these change
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; }, [go]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const current = images[idx] ?? "";
  const currentAlt = current.split("/").pop()
    ?.replace(/\.(webp|jpg|png)$/i, "")
    .replace(/-/g, " ") ?? "Image";

  // Cached images don't fire onLoad — check immediately after mount
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [idx, current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "ArrowLeft") goRef.current(-1);
      if (e.key === "ArrowRight") goRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Touch gesture handlers — only re-attached when `open` changes.
  // zoomScale/pan are read from refs so stale closures are not an issue.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;

    const getDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(b.x - a.x, b.y - a.y);

    const onStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        gesture.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      const zs = zoomScaleRef.current;
      const p = panRef.current;
      if (gesture.pointers.size === 1) {
        const pt = Array.from(gesture.pointers.values())[0];
        gesture.startX = pt.x; gesture.startY = pt.y;
        gesture.lastX = pt.x; gesture.lastY = pt.y;
        gesture.startTime = Date.now();
        if (zs > 1) { gesture.startPanX = p.x; gesture.startPanY = p.y; }
      } else if (gesture.pointers.size === 2) {
        e.preventDefault();
        const pts = Array.from(gesture.pointers.values());
        gesture.startDist = getDist(pts[0], pts[1]);
        gesture.startScale = zs;
      }
    };

    const onMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (gesture.pointers.has(t.identifier))
          gesture.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      gesture.lastX = e.changedTouches[0]?.clientX ?? gesture.lastX;
      gesture.lastY = e.changedTouches[0]?.clientY ?? gesture.lastY;

      if (gesture.pointers.size === 2) {
        e.preventDefault();
        const pts = Array.from(gesture.pointers.values());
        const dist = getDist(pts[0], pts[1]);
        const newScale = Math.min(
          Math.max(gesture.startScale * (dist / Math.max(gesture.startDist, 1)), 1),
          3.5,
        );
        setZoomScale(newScale);
      } else if (gesture.pointers.size === 1 && zoomScaleRef.current > 1) {
        e.preventDefault();
        const pt = Array.from(gesture.pointers.values())[0];
        setPan({
          x: gesture.startPanX + (pt.x - gesture.startX) / zoomScaleRef.current,
          y: gesture.startPanY + (pt.y - gesture.startY) / zoomScaleRef.current,
        });
      }
    };

    const onEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++)
        gesture.pointers.delete(e.changedTouches[i].identifier);

      const zs = zoomScaleRef.current;
      if (gesture.pointers.size === 0) {
        if (zs < 1.1) { setZoomScale(1); setPan({ x: 0, y: 0 }); }
        if (zs <= 1) {
          const elapsed = Date.now() - gesture.startTime;
          const dx = gesture.lastX - gesture.startX;
          const dy = gesture.lastY - gesture.startY;
          const velocity = Math.abs(dx) / Math.max(1, elapsed);
          if ((Math.abs(dx) > 40 || velocity > 0.35) && Math.abs(dx) > Math.abs(dy)) {
            goRef.current(dx < 0 ? 1 : -1);
          }
        }
      }
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [open, gesture]); // ← NOT [zoomScale, pan] — refs handle those

  const handleDoubleTap = () => {
    if (zoomScaleRef.current > 1) { setZoomScale(1); setPan({ x: 0, y: 0 }); }
    else setZoomScale(2.2);
  };

  return (
    /*
     * PERMANENTLY MOUNTED — no AnimatePresence, no motion.div, no GPU layer cycling.
     *
     * Previous approach (AnimatePresence + motion.div):
     *   Every open/close cycle mounted a new DOM subtree with willChange:"opacity",
     *   forcing iOS to allocate and deallocate a full-screen GPU compositor layer
     *   repeatedly. Rapid open/close → memory fragmentation → WebKit process kill.
     *
     * Current approach (CSS visibility + opacity):
     *   The div is always in the DOM. visibility:hidden removes it from hit-testing
     *   and accessibility. The opacity transition is handled by the CSS compositor
     *   with zero JavaScript overhead. No new GPU layer is ever allocated because
     *   there is no willChange on this element.
     *   Crucially: the skeleton inside is ALREADY RENDERED when the user taps —
     *   it becomes visible within one paint frame (~16ms) vs 100-300ms before.
     */
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        backgroundColor: "#faf8f5",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
        // Open: opacity fades in; visibility switches immediately (0s delay)
        // Close: opacity fades out first; visibility hides after fade completes
        transition: open
          ? "opacity 0.15s ease-out, visibility 0s linear 0s"
          : "opacity 0.12s ease-in, visibility 0s linear 0.12s",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && zoomScale <= 1) onClose(); }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 md:px-8 py-4 z-10 shrink-0">
        <span
          className="text-[10px] tracking-[0.35em] uppercase"
          style={{ color: "rgba(120,108,96,0.6)", fontFamily: "'Montserrat', sans-serif" }}
        >
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
        style={{ touchAction: "none" }}
        onDoubleClick={handleDoubleTap}
      >
        {/* Loading skeleton — visible immediately on tap (pre-rendered in DOM) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: loaded ? 0 : 1,
            transition: "opacity 0.25s ease-out",
            backgroundColor: "rgba(30,24,20,0.03)",
          }}
        >
          <div
            className="animate-pulse"
            style={{
              width: "min(72%, 340px)",
              height: "min(55vh, 480px)",
              backgroundColor: "rgba(30,24,20,0.07)",
              borderRadius: 2,
            }}
          />
        </div>

        <img
          key={current}
          ref={imgRef}
          src={current}
          alt={currentAlt}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `scale(${zoomScale}) translate(${pan.x}px, ${pan.y}px)`,
            transition: zoomScale === 1
              ? "transform 0.35s cubic-bezier(0.32,0,0.16,1), opacity 0.28s ease-out"
              : "opacity 0.28s ease-out",
            willChange: zoomScale > 1 ? "transform" : "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            opacity: loaded ? 1 : 0,
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
              onClick={(e) => {
                e.stopPropagation();
                setIdx(i);
                setZoomScale(1);
                setPan({ x: 0, y: 0 });
              }}
              className="flex-shrink-0 overflow-hidden transition-all duration-200"
              style={{
                width: 44, height: 44,
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
    </div>
  );
}
