import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

export function EditorialStrip() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], ["14px", "-14px"]);

  const words = ["Effortless", "Versatile", "Yours"];

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1a1410 0%, #221c16 50%, #1a1410 100%)",
        paddingTop: "clamp(64px, 12vw, 120px)",
        paddingBottom: "clamp(64px, 12vw, 120px)",
      }}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(210,195,175,0.07) 0%, transparent 70%)",
        }}
      />

      <motion.div
        style={{ y: textY }}
        className="relative z-10 flex flex-col items-center text-center px-8"
      >
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-[9px] tracking-[0.6em] uppercase mb-8"
          style={{
            color: "rgba(200,185,165,0.48)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          The Moi Philosophy
        </motion.p>

        {/* Three-word manifesto */}
        <div className="flex items-center gap-6 md:gap-10 flex-wrap justify-center mb-10">
          {words.map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "clamp(2.5rem, 8vw, 5.41rem)",
                fontWeight: 300,
                color: i === 1 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.42)",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Thin horizontal rule */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={inView ? { scaleX: 1, opacity: 1 } : {}}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
          className="mb-8"
          style={{
            height: 1,
            width: "clamp(60px, 12vw, 100px)",
            background: "rgba(200,185,165,0.28)",
            transformOrigin: "center",
          }}
        />

      </motion.div>
    </section>
  );
}
