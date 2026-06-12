import { useEffect } from "react";
import type React from "react";

interface UseMobileGallerySwipeOptions {
  galleryImages: string[];
  handle: string;
  loading: boolean;
  trackMounted: boolean;
  mobileGalleryTrackRef: React.RefObject<HTMLDivElement | null>;
  mobileGalleryRawIdxRef: React.MutableRefObject<number>;
  mobileGalleryDragRef: React.MutableRefObject<{ x: number; y: number } | null>;
  mobileGalleryDidDragRef: React.MutableRefObject<boolean>;
  setGalleryIndex: React.Dispatch<React.SetStateAction<number>>;
  setLightboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Attaches non-passive touchmove listener so we can call preventDefault()
 * only for horizontal swipes while letting vertical scrolls pass through.
 */
export function useMobileGallerySwipe({
  galleryImages,
  handle,
  loading,
  trackMounted,
  mobileGalleryTrackRef,
  mobileGalleryRawIdxRef,
  mobileGalleryDragRef,
  mobileGalleryDidDragRef,
  setGalleryIndex,
  setLightboxOpen,
}: UseMobileGallerySwipeOptions): void {
  useEffect(() => {
    const track = mobileGalleryTrackRef.current;
    const N = galleryImages.length;
    if (!track || N <= 1) return;

    let startX = 0;
    let startY = 0;
    let dirLocked: "h" | "v" | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dirLocked = null;
      mobileGalleryDragRef.current = { x: startX, y: startY };
      mobileGalleryDidDragRef.current = false;
      track.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !mobileGalleryDragRef.current) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!dirLocked) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        dirLocked = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }

      if (dirLocked === "v") {
        mobileGalleryDragRef.current = null;
        mobileGalleryDidDragRef.current = false;
        track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
        return;
      }

      e.preventDefault();
      mobileGalleryDidDragRef.current = true;
      const pct = mobileGalleryRawIdxRef.current * 100;
      track.style.transform = `translateX(calc(-${pct}% + ${dx}px))`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!mobileGalleryDragRef.current) return;
      const { x: sx } = mobileGalleryDragRef.current;
      mobileGalleryDragRef.current = null;
      const didDrag = mobileGalleryDidDragRef.current;
      mobileGalleryDidDragRef.current = false;

      if (!didDrag) {
        setLightboxOpen(true);
        track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
        track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
        return;
      }

      const endX = e.changedTouches[0]?.clientX ?? sx;
      const dx = endX - sx;
      const dir = dx < -20 ? 1 : dx > 20 ? -1 : 0;
      let rawIdx = mobileGalleryRawIdxRef.current + dir;

      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
      track.style.transform = `translateX(-${rawIdx * 100}%)`;
      mobileGalleryRawIdxRef.current = rawIdx;

      const suppressClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        window.removeEventListener("click", suppressClick, true);
      };
      window.addEventListener("click", suppressClick, true);

      track.addEventListener("transitionend", function onEnd() {
        track.removeEventListener("transitionend", onEnd);
        if (rawIdx <= 0) {
          rawIdx = N;
          track.style.transition = "none";
          track.style.transform = `translateX(-${rawIdx * 100}%)`;
          mobileGalleryRawIdxRef.current = rawIdx;
        } else if (rawIdx >= N + 1) {
          rawIdx = 1;
          track.style.transition = "none";
          track.style.transform = `translateX(-${rawIdx * 100}%)`;
          mobileGalleryRawIdxRef.current = rawIdx;
        }
        setGalleryIndex((rawIdx - 1 + N) % N);
      });
    };

    const onTouchCancel = () => {
      mobileGalleryDragRef.current = null;
      mobileGalleryDidDragRef.current = false;
      dirLocked = null;
      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
      track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
    };

    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchmove", onTouchMove, { passive: false });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    track.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchmove", onTouchMove);
      track.removeEventListener("touchend", onTouchEnd);
      track.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [
    galleryImages.length, handle, loading, trackMounted,
    setGalleryIndex, setLightboxOpen,
    mobileGalleryTrackRef, mobileGalleryRawIdxRef, mobileGalleryDragRef, mobileGalleryDidDragRef,
  ]);
}
