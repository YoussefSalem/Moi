import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function ProductDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div
      ref={ref}
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ height: 80 }}
    >
      {/* Left line */}
      <motion.div
        className="absolute"
        style={{
          left: 0,
          height: 1,
          transformOrigin: "right",
          width: "calc(50% - 22px)",
          background:
            "linear-gradient(to left, transparent 0%, rgba(180,160,140,0.18) 20%, rgba(180,160,140,0.52) 55%, rgba(180,160,140,0.18) 80%, transparent 100%)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />

      {/* Right line */}
      <motion.div
        className="absolute"
        style={{
          right: 0,
          height: 1,
          transformOrigin: "left",
          width: "calc(50% - 22px)",
          background:
            "linear-gradient(to right, transparent 0%, rgba(180,160,140,0.18) 20%, rgba(180,160,140,0.52) 55%, rgba(180,160,140,0.18) 80%, transparent 100%)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />

      {/* Center diamond ornament */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={inView ? { scale: 1, opacity: 1, rotate: 45 } : {}}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
        style={{
          width: 9,
          height: 9,
          border: "1px solid rgba(180,160,140,0.72)",
          background: "rgba(250,248,245,0.9)",
        }}
      />
    </div>
  );
}
