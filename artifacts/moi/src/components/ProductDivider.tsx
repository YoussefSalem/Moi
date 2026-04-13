import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function ProductDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div
      ref={ref}
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ height: 96 }}
    >
      {/* Left line — grows from center */}
      <motion.div
        className="absolute left-0"
        style={{
          height: 2,
          transformOrigin: "right",
          width: "calc(50% - 18px)",
          background:
            "linear-gradient(to left, rgba(180,160,140,0.0) 0%, rgba(180,160,140,0.28) 18%, rgba(180,160,140,0.7) 50%, rgba(180,160,140,0.28) 82%, rgba(180,160,140,0.0) 100%)",
          filter: "blur(0.2px)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1, x: [0, 8, 0] } : {}}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.1, x: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } }}
      />

      {/* Right line — grows from center */}
      <motion.div
        className="absolute right-0"
        style={{
          height: 2,
          transformOrigin: "left",
          width: "calc(50% - 18px)",
          background:
            "linear-gradient(to right, rgba(180,160,140,0.0) 0%, rgba(180,160,140,0.28) 18%, rgba(180,160,140,0.7) 50%, rgba(180,160,140,0.28) 82%, rgba(180,160,140,0.0) 100%)",
          filter: "blur(0.2px)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1, x: [0, -8, 0] } : {}}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.1, x: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } }}
      />

      {/* Center ornament — outer ring pulse */}
      <motion.div
        className="absolute z-10 rounded-full"
        style={{
          width: 40,
          height: 40,
          border: "1px solid rgba(180,160,140,0.35)",
        }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={inView
          ? {
              scale: [0.4, 1, 1.08, 1],
              opacity: [0, 1, 1, 1],
            }
          : {}}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.6 }}
      />

      <motion.div
        className="absolute z-10 rounded-full"
        style={{
          width: 48,
          height: 48,
          border: "2px solid rgba(180,160,140,0.28)",
          boxShadow: "0 0 0 10px rgba(180,160,140,0.04)",
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={inView
          ? {
              scale: [0.5, 1, 1.08, 1],
              opacity: [0, 1, 1, 1],
            }
          : {}}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.45 }}
      />

      <motion.div
        className="relative z-20 rounded-full"
        style={{
          width: 10,
          height: 10,
          background:
            "radial-gradient(circle, rgba(180,160,140,0.95) 0%, rgba(180,160,140,0.75) 45%, rgba(180,160,140,0.2) 100%)",
        }}
        animate={inView ? { x: [0, 3, 0, -3, 0], scale: [1, 1.12, 1] } : { scale: 0 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
