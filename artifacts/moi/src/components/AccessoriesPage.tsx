import { motion } from "framer-motion";

export function AccessoriesPage() {
  return (
    <main
      id="accessories"
      className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6 py-28"
      style={{ backgroundColor: "hsl(30 15% 95%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-3xl mx-auto"
      >
        <motion.p
          animate={{ y: [0, -8, 0], rotate: [0, -0.4, 0.4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="text-[10px] md:text-[11px] tracking-[0.55em] uppercase mb-6"
          style={{ color: "#7a6e64", fontFamily: "'Montserrat', sans-serif" }}
        >
          Stay Tuned!
        </motion.p>
        <motion.h1
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="font-serif leading-none"
          style={{
            color: "#1e1814",
            fontSize: "clamp(3rem, 8vw, 7rem)",
            letterSpacing: "0.05em",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
        >
          Coming Soon....
        </motion.h1>
      </motion.div>
    </main>
  );
}