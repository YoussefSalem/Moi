import { useMemo } from "react";

interface Star {
  id: number;
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  trailLength: number;
  opacity: number;
}

export function StarField({ count = 1000 }: { count?: number }) {
  const stars = useMemo(() => {
    const s: Star[] = [];
    for (let i = 0; i < count; i++) {
      s.push({
        id: i,
        top: Math.random() * 120 - 20, // -20% to 100% — starts above viewport
        left: Math.random() * 110 - 5,  // -5% to 105% — slight horizontal overflow
        size: 2 + Math.random() * 5,    // 2px to 7px
        delay: Math.random() * 12,      // 0s to 12s stagger
        duration: 3 + Math.random() * 3, // 3s to 6s fall time
        trailLength: 16 + Math.random() * 32, // 16px to 48px
        opacity: 0.35 + Math.random() * 0.5, // 0.35 to 0.85
      });
    }
    return s;
  }, [count]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {stars.map((star) => (
        <div
          key={star.id}
          style={{
            position: "absolute",
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            pointerEvents: "none",
            willChange: "opacity, transform",
            animation: `checkout-shooting-star ${star.duration}s ease-in infinite`,
            animationDelay: `${star.delay}s`,
            opacity: star.opacity,
          }}
        >
          {/* Star body */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: `rgba(235, 225, 205, ${star.opacity})`,
              boxShadow: `0 0 ${star.size * 3}px ${star.size}px rgba(235, 225, 205, ${star.opacity * 0.5})`,
            }}
          />
          {/* Trail */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: `${star.trailLength}px`,
              height: `${Math.max(1, star.size * 0.4)}px`,
              borderRadius: "1px",
              transform: "translate(-50%, -50%) rotate(35deg)",
              background: `linear-gradient(90deg, rgba(235, 225, 205, ${star.opacity * 0.6}) 0%, transparent 100%)`,
              animation: `checkout-star-trail ${star.duration}s ease-in infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
