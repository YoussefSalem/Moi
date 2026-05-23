import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function LimitedDrop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#faf8f5" }}
    >
      {/* Subtle warm tint overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(210,195,175,0.14), transparent 60%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Label */}
          <p
            className="text-[9px] tracking-[0.45em] uppercase mb-5"
            style={{
              color: "rgba(120,108,96,0.55)",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Limited Edition
          </p>

          {/* Heading */}
          <h2
            className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight"
            style={{ color: "#1e1814" }}
          >
            The Limited Spring Drop
          </h2>

          {/* Body */}
          <p
            className="mt-5 text-sm md:text-base leading-7 max-w-lg mx-auto"
            style={{
              color: "rgba(30,24,20,0.55)",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            A small batch of refined essentials, cut from premium fabrics and
            finished by hand. Once they leave the studio, they do not return.
          </p>

          {/* Scarcity hint */}
          <motion.p
            className="mt-6 text-[10px] tracking-[0.3em] uppercase"
            style={{
              color: "rgba(120,108,96,0.4)",
              fontFamily: "'Montserrat', sans-serif",
            }}
            initial={{ opacity: 0 }}
            animate={visible ? { opacity: 1 } : {}}
            transition={{ duration: 1.6, delay: 0.6, ease: "easeOut" }}
          >
            Only a select number of each piece remain
          </motion.p>

          {/* CTA */}
          <motion.a
            href="#collection"
            className="inline-block mt-8 text-[10px] tracking-[0.35em] uppercase px-8 py-4 border transition-colors duration-500"
            style={{
              color: "#1e1814",
              borderColor: "rgba(30,24,20,0.18)",
              fontFamily: "'Montserrat', sans-serif",
            }}
            whileHover={{
              backgroundColor: "#1e1814",
              color: "#faf8f5",
              borderColor: "#1e1814",
            }}
            transition={{ duration: 0.4 }}
          >
            Explore the drop
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
