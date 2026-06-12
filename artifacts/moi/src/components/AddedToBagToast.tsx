import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function AddedToBagToast() {
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: Event) => {
      const { color, size } = (e as CustomEvent<{ color?: string; size?: string }>).detail;
      const parts = [color, size && size !== "One Size" ? size : undefined].filter(Boolean);
      setDetail(parts.join("  ·  "));
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 2200);
    };
    window.addEventListener("moi:added-to-bag", handler);
    return () => {
      window.removeEventListener("moi:added-to-bag", handler);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="added-to-bag"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            position: "fixed",
            top: 68,
            left: "50%",
            x: "-50%",
            zIndex: 9999,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#faf8f5",
            border: "1px solid rgba(30,24,20,0.14)",
            borderRadius: 2,
            padding: "11px 20px",
            fontFamily: "'Montserrat', sans-serif",
            boxShadow: "0 4px 20px rgba(0,0,0,0.09)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <svg
            width="11"
            height="9"
            viewBox="0 0 11 9"
            fill="none"
            style={{ flexShrink: 0, opacity: 0.65 }}
          >
            <path
              d="M1 4L4 7.5L10 1"
              stroke="#1e1814"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div
              style={{
                fontSize: 9.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "#1e1814",
              }}
            >
              Added to bag
            </div>
            {detail && (
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(30,24,20,0.45)",
                  marginTop: 3,
                }}
              >
                {detail}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
