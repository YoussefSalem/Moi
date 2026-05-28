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
  const baseBg = {
    light: "rgba(255,255,255,0.35)",
    dark: "rgba(255,255,255,0.06)",
    warm: "rgba(30,24,20,0.055)",
    card: "rgba(30,24,20,0.045)",
  }[variant];

  const shimmerBg = {
    light: "rgba(255,255,255,0.55)",
    dark: "rgba(255,255,255,0.12)",
    warm: "rgba(255,255,255,0.42)",
    card: "rgba(255,255,255,0.35)",
  }[variant];

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{
        backgroundColor: baseBg,
        borderRadius: borderRadius ?? 0,
        ...style,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            115deg,
            transparent 0%,
            ${shimmerBg} 44%,
            transparent 58%
          )`,
          animation: "moi-skeleton-shimmer 1.8s ease-in-out infinite",
        }}
      />
    </div>
  );
}
