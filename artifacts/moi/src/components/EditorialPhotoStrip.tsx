import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const LOOK_IMAGES = [
  "/images/wavvy-look-1.webp",
  "/images/wavvy-look-2.webp",
  "/images/wavvy-look-3.webp",
  "/images/wavvy-look-4.webp",
  "/images/wavvy-look-5.webp",
];

export function EditorialPhotoStrip() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "hsl(30 15% 95%)",
        paddingTop: "clamp(40px, 7vw, 80px)",
        paddingBottom: "clamp(48px, 8vw, 96px)",
      }}
    >
      {/* Label */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="text-center text-[9px] tracking-[0.55em] uppercase mb-8"
        style={{ color: "rgba(120,108,96,0.6)", fontFamily: "'Montserrat', sans-serif" }}
      >
        The Collection
      </motion.p>

      {/* Scrollable strip */}
      <div
        className="flex gap-3 overflow-x-auto"
        style={{
          paddingLeft: "clamp(20px, 6vw, 80px)",
          paddingRight: "clamp(20px, 6vw, 80px)",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          touchAction: "pan-x",
          cursor: "grab",
        }}
      >
        <style>{`section[data-strip]::-webkit-scrollbar { display: none; }`}</style>
        {LOOK_IMAGES.map((src, i) => (
          <motion.div
            key={src}
            className="flex-shrink-0 overflow-hidden"
            style={{
              width: "clamp(200px, 28vw, 340px)",
              scrollSnapAlign: "start",
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.85,
              ease: [0.22, 1, 0.36, 1],
              delay: i * 0.08,
            }}
          >
            <div
              className="relative w-full overflow-hidden"
              style={{ height: "clamp(280px, 44vw, 520px)" }}
            >
              <motion.img
                src={src}
                alt={`Moi Wavvy look ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-top"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom brand note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 0.55 }}
        className="text-center mt-8 text-[9px] tracking-[0.35em] uppercase"
        style={{ color: "rgba(120,108,96,0.42)", fontFamily: "'Montserrat', sans-serif" }}
      >
        Height of model: 178 cm — Size S
      </motion.p>
    </section>
  );
}
