import { useState, useEffect, useRef } from "react";
import { FastAverageColor } from "fast-average-color";

export interface ImageColorResult {
  rgb: string;
  rgba: (alpha: number) => string;
  isLight: boolean;
  isDark: boolean;
  hex: string;
}

const fac = new FastAverageColor();

const colorCache = new Map<string, ImageColorResult>();

function buildResult(r: number, g: number, b: number, isLight: boolean, isDark: boolean, hex: string): ImageColorResult {
  return {
    rgb: `${r}, ${g}, ${b}`,
    rgba: (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`,
    isLight,
    isDark,
    hex,
  };
}

function ric(cb: IdleRequestCallback, opts?: IdleRequestOptions): number {
  if (typeof requestIdleCallback === "function") return requestIdleCallback(cb, opts);
  return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 200) as unknown as number;
}

function cic(id: number): void {
  if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
  else clearTimeout(id);
}

export function useImageColor(imageUrl: string | null): ImageColorResult | null {
  const [color, setColor] = useState<ImageColorResult | null>(() =>
    imageUrl ? colorCache.get(imageUrl) ?? null : null
  );
  const imgRef = useRef<HTMLImageElement | null>(null);
  const ricHandle = useRef<number | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    const cached = colorCache.get(imageUrl);
    if (cached) {
      setColor(cached);
      return;
    }

    let cancelled = false;

    ricHandle.current = ric(() => {
      if (cancelled) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      imgRef.current = img;

      img.onload = () => {
        if (cancelled) return;
        ric(() => {
          if (cancelled) return;
          try {
            const result = fac.getColor(img, {
              algorithm: "dominant",
              mode: "speed",
              ignoredColor: [[255, 255, 255, 255, 20], [0, 0, 0, 255, 20]],
            });

            const [r, g, b] = result.value;
            const built = buildResult(r, g, b, result.isLight, result.isDark, result.hex);
            colorCache.set(imageUrl, built);

            if (!cancelled) setColor(built);
          } catch {
            if (!cancelled) setColor(null);
          }
        }, { timeout: 2000 });
      };

      img.onerror = () => {
        if (!cancelled) setColor(null);
      };
    }, { timeout: 3000 });

    return () => {
      cancelled = true;
      if (ricHandle.current !== null) cic(ricHandle.current);
    };
  }, [imageUrl]);

  return color;
}
