import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
  const thumbsRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const zoomScaleRef = useRef(zoomScale);
  const panRef = useRef(pan);
  useEffect(() => { zoomScaleRef.current = zoomScale; }, [zoomScale]);
  useEffect(() => { panRef.current = pan; }, [pan]);

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
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialIndex]);

  const go = useCallback((delta: number) => {
    setIdx((i) => (i + delta + images.length) % images.length);
  }, [images.length]);

  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; }, [go]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const current = images[idx] ?? "";
  const currentAlt = current.split("/").pop()
    ?.replace(/\.(webp|jpg|png)$/i, "")
    .replace(/-/g, " ") ?? "Image";

  useLayoutEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });

    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    const preload = new Image();
    preload.src = current;
    const done = () => setLoaded(true);
    preload.addEventListener("load", done);
    preload.addEventListener("error", done);
    if (preload.complete) done();
    return () => {
      preload.removeEventListener("load", done);
      preload.removeEventListener("error", done);
    };
  }, [idx, current]);

  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const btn = strip.children[idx] as HTMLElement | undefined;
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

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
  }, [open, gesture]);

  const handleDoubleTap = () => {
    if (zoomScaleRef.current > 1) { setZoomScale(1); setPan({ x: 0, y: 0 }); }
    else setZoomScale(2.2);
  };

  /*
   * PERMANENTLY MOUNTED via CSS visibility/opacity (no AnimatePresence / motion.div).
   * Rendered via createPortal into document.body so it sits in the ROOT stacking
   * context — not inside the product-page's position:fixed z-51 stacking context
   * which would cap its effective z-index and let the sticky header paint on top.
   */
  const lightbox = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(250,248,245,0.60)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
        transition: open
          ? "opacity 0.18s ease-out, visibility 0s linear 0s"
          : "opacity 0.14s ease-in, visibility 0s linear 0.14s",
      }}
    >
      {/* ── Close button ── circular, top-right, safe-area aware ──────────── */}
      <button
        type="button"
        aria-label="Close gallery"
        onClick={onClose}
        style={{
          position: "absolute",
          // safe-area-inset-top handles notch/Dynamic Island; falls back to 16px
          top: "max(calc(env(safe-area-inset-top, 0px) + 10px), 16px)",
          right: 16,
          zIndex: 10,
          width: 44,
          height: 44,
          borderRadius: "50%",
          // Strong dark fill so the X is legible over the light backdrop
          background: "rgba(30,24,20,0.70)",
          border: "1.5px solid rgba(30,24,20,0.18)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "background 0.18s, transform 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(30,24,20,0.90)";
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(30,24,20,0.70)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <X size={20} strokeWidth={2.2} color="#fff" />
      </button>

      {/* ── Image area — full viewport, gestures here ─────────────────────── */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          userSelect: "none",
        }}
        onDoubleClick={handleDoubleTap}
        onClick={(e) => { if (e.target === e.currentTarget && zoomScale <= 1) onClose(); }}
      >
        {/* Light shimmer skeleton — visible immediately before image loads */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(210,200,190,0.18) 25%, rgba(230,222,212,0.32) 50%, rgba(210,200,190,0.18) 75%)",
            backgroundSize: "200% 100%",
            animation: "lb-shimmer 1.4s ease-in-out infinite",
            opacity: loaded ? 0 : 1,
            transition: "opacity 0.3s ease-out",
            pointerEvents: "none",
          }}
        />

        <img
          key={current}
          ref={imgRef}
          src={current || undefined}
          alt={currentAlt}
          style={{
            // Leave room at bottom for thumbnail strip when multiple images
            width: "100%",
            height: images.length > 1 ? "calc(100% - 100px)" : "100%",
            objectFit: "contain",
            transform: `scale(${zoomScale}) translate(${pan.x}px, ${pan.y}px)`,
            transition: zoomScale === 1
              ? "transform 0.35s cubic-bezier(0.32,0,0.16,1), opacity 0.22s ease-out"
              : "opacity 0.22s ease-out",
            willChange: zoomScale > 1 ? "transform" : "auto",
            opacity: loaded ? 1 : 0,
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            display: "block",
          }}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>

      {/* ── Thumbnail strip — gradient veil + portrait thumbs ─────────────── */}
      {images.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            // Respect home-indicator safe area
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
            background: "linear-gradient(to top, rgba(250,248,245,0.85) 0%, rgba(250,248,245,0.0) 100%)",
            zIndex: 5,
            pointerEvents: "auto",
          }}
        >
          <div
            ref={thumbsRef}
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              scrollbarWidth: "none",
              paddingInline: 16,
              paddingTop: 20,
              paddingBottom: 10,
              alignItems: "flex-end",
            }}
          >
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                  setZoomScale(1);
                  setPan({ x: 0, y: 0 });
                }}
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 68,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: i === idx
                    ? "2px solid rgba(30,24,20,0.85)"
                    : "2px solid rgba(30,24,20,0.18)",
                  opacity: i === idx ? 1 : 0.55,
                  transform: i === idx ? "scale(1.06)" : "scale(1)",
                  transition: "opacity 0.2s, border-color 0.2s, transform 0.2s",
                  background: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <img
                  src={src || undefined}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes lb-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </div>
  );

  return createPortal(lightbox, document.body);
}
