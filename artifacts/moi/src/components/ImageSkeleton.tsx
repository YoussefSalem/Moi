import { CSSProperties } from "react";

interface ImageSkeletonProps {
  variant?: "light" | "dark" | "warm" | "card";
  className?: string;
  style?: CSSProperties;
  borderRadius?: number | string;
}

export function ImageSkeleton({
  variant = "warm",
  className = "",
  style,
  borderRadius,
}: ImageSkeletonProps) {
  const bg = {
    light: "#e8e3dc",
    dark: "rgba(255,255,255,0.12)",
    warm: "#e8e3dc",
    card: "#ece6de",
  }[variant];

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{
        backgroundColor: bg,
        borderRadius: borderRadius ?? 0,
        animation: "moi-skeleton-pulse 1.8s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
