import { useRef, useCallback, useEffect } from "react";

export function ZoomableImage({ src, alt, resetKey, onPinchStart }: {
  src: string;
  alt: string;
  resetKey: number;
  onPinchStart?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const pinchRef = useRef<{ dist: number; startScale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(null);
  const lastTapRef = useRef(0);
  const isPinchingRef = useRef(false);
  const onPinchStartRef = useRef(onPinchStart);
  onPinchStartRef.current = onPinchStart;

  const applyTransform = useCallback((animated = false) => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transition = animated ? "transform 0.22s ease-out" : "none";
    el.style.transform = `scale(${scaleRef.current}) translate(${txRef.current}px, ${tyRef.current}px)`;
  }, []);

  const clampTranslate = useCallback((s: number, x: number, y: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const parent = wrapRef.current?.parentElement;
    if (!parent) return { x, y };
    const rect = parent.getBoundingClientRect();
    const maxX = (rect.width * (s - 1)) / (2 * s);
    const maxY = (rect.height * (s - 1)) / (2 * s);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  useEffect(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    isPinchingRef.current = false;
    applyTransform(true);
  }, [resetKey, applyTransform]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const getDistance = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        isPinchingRef.current = true;
        onPinchStartRef.current?.();
        pinchRef.current = { dist: getDistance(e.touches[0], e.touches[1]), startScale: scaleRef.current };
        panRef.current = null;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        const dt = now - lastTapRef.current;
        lastTapRef.current = now;
        if (dt < 300 && dt > 0) {
          e.preventDefault();
          e.stopPropagation();
          lastTapRef.current = 0;
          if (scaleRef.current > 1.1) {
            scaleRef.current = 1; txRef.current = 0; tyRef.current = 0;
            isPinchingRef.current = false;
          } else {
            scaleRef.current = 2;
            const c = clampTranslate(2, txRef.current, tyRef.current);
            txRef.current = c.x; tyRef.current = c.y;
          }
          applyTransform(true);
          return;
        }
        if (scaleRef.current > 1) {
          e.preventDefault();
          e.stopPropagation();
          panRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, startTx: txRef.current, startTy: tyRef.current };
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const newDist = getDistance(e.touches[0], e.touches[1]);
        let s = pinchRef.current.startScale * (newDist / pinchRef.current.dist);
        s = Math.max(1, Math.min(4, s));
        scaleRef.current = s;
        const c = clampTranslate(s, txRef.current, tyRef.current);
        txRef.current = c.x; tyRef.current = c.y;
        applyTransform();
      } else if (e.touches.length === 1 && panRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const dx = (e.touches[0].clientX - panRef.current.x) / scaleRef.current;
        const dy = (e.touches[0].clientY - panRef.current.y) / scaleRef.current;
        const c = clampTranslate(scaleRef.current, panRef.current.startTx + dx, panRef.current.startTy + dy);
        txRef.current = c.x; tyRef.current = c.y;
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
        if (e.touches.length === 0) isPinchingRef.current = false;
      }
      if (e.touches.length === 0) panRef.current = null;
      if (scaleRef.current < 1.15) {
        scaleRef.current = 1; txRef.current = 0; tyRef.current = 0;
        isPinchingRef.current = false;
        applyTransform(true);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform, clampTranslate]);

  const stopIfActive = useCallback((e: React.PointerEvent) => {
    if (scaleRef.current > 1 || isPinchingRef.current) {
      e.stopPropagation();
    }
  }, []);

  return (
    <div
      ref={wrapRef}
      onPointerDown={stopIfActive}
      onPointerMove={stopIfActive}
      onPointerUp={stopIfActive}
      onPointerCancel={stopIfActive}
      style={{ width: "100%", height: "100%", transformOrigin: "center center", willChange: "transform" }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block", userSelect: "none", pointerEvents: "none" }}
        loading="eager"
        draggable={false}
      />
    </div>
  );
}
