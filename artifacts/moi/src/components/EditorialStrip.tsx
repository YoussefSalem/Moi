import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function EditorialStrip() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{
        background: "hsl(30 15% 95%)",
        paddingTop: "clamp(48px, 10vw, 80px)",
        paddingBottom: "clamp(48px, 10vw, 80px)",
      }}
    >
      <div className="max-w-md mx-auto px-6 text-center">
        {/* UGC-feeling heading */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-[9px] tracking-[0.5em] uppercase mb-5"
          style={{ color: "rgba(120,108,96,0.65)", fontFamily: "'Montserrat', sans-serif" }}
        >
          Loved by 2,000+ women
        </motion.p>

        {/* Fake reviews */}
        <div className="flex flex-col gap-5 mb-6">
          {[
            { name: "Sara M.", text: "The cashmere shade is gorgeous. Wore it to a dinner and got so many compliments.", days: "2 days ago" },
            { name: "Nour K.", text: "Ordered Friday, arrived Saturday morning. Quality is way better than I expected.", days: "1 week ago" },
          ].map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
              className="text-left px-5 py-4"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(180,160,140,0.15)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] tracking-[0.12em] uppercase font-medium"
                  style={{ color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {r.name}
                </span>
                <span
                  className="text-[8px] tracking-[0.08em]"
                  style={{ color: "rgba(120,108,96,0.5)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {r.days}
                </span>
              </div>
              <p
                className="text-[11px] leading-[1.7]"
                style={{ color: "#5a5048", fontFamily: "'Montserrat', sans-serif" }}
              >
                {r.text}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Star rating summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex items-center justify-center gap-2"
        >
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} style={{ color: "#c8a85c", fontSize: 11 }}>★</span>
            ))}
          </div>
          <span
            className="text-[10px] tracking-[0.15em] uppercase"
            style={{ color: "#7a6e64", fontFamily: "'Montserrat', sans-serif" }}
          >
            4.9 / 5 from 200+ reviews
          </span>
        </motion.div>
      </div>
    </section>
  );
}
