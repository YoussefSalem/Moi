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

export function useImageColor(imageUrl: string | null): ImageColorResult | null {
  const [color, setColor] = useState<ImageColorResult | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
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
          mode: "precision",
          ignoredColor: [[255, 255, 255, 255, 20], [0, 0, 0, 255, 20]],
        });

        const [r, g, b] = result.value;

        if (!cancelled) {
          setColor({
            rgb: `${r}, ${g}, ${b}`,
            rgba: (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`,
            isLight: result.isLight,
            isDark: result.isDark,
            hex: result.hex,
          });
        }
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
