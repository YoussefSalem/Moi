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
    light: "rgba(30,24,20,0.06)",
    dark: "rgba(255,255,255,0.08)",
    warm: "rgba(30,24,20,0.06)",
    card: "rgba(30,24,20,0.06)",
  }[variant];

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none animate-pulse ${className}`}
      style={{
        backgroundColor: bg,
        borderRadius: borderRadius ?? 0,
        ...style,
      }}
    />
  );
}
