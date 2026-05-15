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

export function useImageColor(imageUrl: string | null): ImageColorResult | null {
  const [color, setColor] = useState<ImageColorResult | null>(() =>
    imageUrl ? colorCache.get(imageUrl) ?? null : null
  );
  const imgRef = useRef<HTMLImageElement | null>(null);

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

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    imgRef.current = img;

    img.onload = async () => {
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
    };

    img.onerror = () => {
      if (!cancelled) setColor(null);
    };

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return color;
}
