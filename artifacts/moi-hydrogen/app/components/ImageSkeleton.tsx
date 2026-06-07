interface ImageSkeletonProps {
  variant?: "warm" | "neutral" | "dark";
  className?: string;
}

export function ImageSkeleton({ variant = "warm", className = "" }: ImageSkeletonProps) {
  const bg =
    variant === "warm" ? "#ede8e3" :
    variant === "dark" ? "#2a2520" :
    "#e8e8e8";

  const shimmerColor =
    variant === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)";

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-0 translate-x-[-110%]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${shimmerColor} 50%, transparent 100%)`,
          animation: "moi-skeleton-shimmer 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}
