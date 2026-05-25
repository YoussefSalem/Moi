import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingScreenProps {
  /** Set to true once the critical hero content is ready */
  ready: boolean;
}

export function LoadingScreen({ ready }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    // Hard cap: never block longer than 3.5s regardless of load state
    const hardCap = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(hardCap);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Enforce a minimum display time of 800ms so the loader never flashes
    // even if everything loads instantly — the user always sees a smooth entrance.
    const elapsed = Date.now() - shownAt.current;
    const remaining = Math.max(0, 800 - elapsed);
    const t = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ backgroundColor: "#faf8f5" }}
        >
          {/* Brand mark */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif font-light text-[#1e1814]"
            style={{
              fontSize: "clamp(3rem, 10vw, 5rem)",
              letterSpacing: "0.12em",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
            }}
          >
            MOI
          </motion.div>

          {/* Subtle shimmer line */}
          <motion.div
            className="mt-6 overflow-hidden rounded-full"
            style={{ width: 80, height: 2, backgroundColor: "rgba(30,24,20,0.08)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "rgba(30,24,20,0.28)", width: 24 }}
              animate={{ x: [-24, 80, -24] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          {/* Optional micro-copy */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-5 text-[9px] tracking-[0.35em] uppercase"
            style={{ color: "rgba(30,24,20,0.45)", fontFamily: "'Montserrat', sans-serif" }}
          >
            Loading
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
