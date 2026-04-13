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
          height: 1,
          transformOrigin: "right",
          width: "calc(50% - 28px)",
          background: "linear-gradient(to left, rgba(180,160,140,0.55), rgba(180,160,140,0))",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />

      {/* Right line — grows from center */}
      <motion.div
        className="absolute right-0"
        style={{
          height: 1,
          transformOrigin: "left",
          width: "calc(50% - 28px)",
          background: "linear-gradient(to right, rgba(180,160,140,0.55), rgba(180,160,140,0))",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
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

      {/* Continuous pulse ring */}
      <motion.div
        className="absolute z-10 rounded-full"
        style={{
          width: 40,
          height: 40,
          border: "1px solid rgba(180,160,140,0.22)",
        }}
        animate={inView
          ? {
              scale: [1, 1.65, 1.65],
              opacity: [0.7, 0, 0],
            }
          : { scale: 1, opacity: 0 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 1.4 }}
      />

      {/* Inner dot */}
      <motion.div
        className="relative z-20 rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: "rgba(150,130,110,0.6)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={inView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.75 }}
      />

      {/* Serif label */}
      <motion.span
        className="absolute font-serif font-light tracking-[0.35em] text-[9px] uppercase select-none"
        style={{
          color: "rgba(150,130,110,0.55)",
          top: "50%",
          transform: "translateY(-50%)",
          marginTop: 28,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          letterSpacing: "0.35em",
        }}
        initial={{ opacity: 0, y: 4 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 1.0 }}
      >
        Collection
      </motion.span>
    </div>
  );
}
