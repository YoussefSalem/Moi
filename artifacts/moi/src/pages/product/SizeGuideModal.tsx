import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { transitions } from "@/lib/motion";
import { motion, AnimatePresence } from "framer-motion";

interface SizeGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function SizeGuideModal({ open, onClose }: SizeGuideModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="size-guide-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitions.modalOverlay}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(30,24,20,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <motion.div
            ref={panelRef}
            key="size-guide-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Size guide"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={transitions.quick}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#faf8f5",
              width: "100%",
              maxWidth: 520,
              borderRadius: "12px",
              maxHeight: "85dvh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "28px 24px 20px", flexShrink: 0, borderBottom: "1px solid rgba(30,24,20,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 6 }}>MOI Versa Top</p>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.55rem", fontWeight: 400, letterSpacing: "0.04em", color: "#1e1814", lineHeight: 1 }}>Size Guide</h2>
                </div>
                <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7a6e74", lineHeight: 1, padding: 8, fontSize: 20, flexShrink: 0 }} aria-label="Close size guide">✕</button>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 32px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#8a7e74", fontWeight: 300, letterSpacing: "0.03em", marginBottom: 20, lineHeight: 1.6 }}>
                All measurements in centimetres. Measure yourself and compare to the size that fits best.
              </p>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "0 -4px" } as React.CSSProperties}>
                <table style={{ minWidth: 320, width: "100%", borderCollapse: "collapse" as const, fontFamily: "'Montserrat', sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid rgba(30,24,20,0.14)" }}>
                      {["Size", "Chest", "Waist", "Hip", "Length"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left" as const, fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#7a6e64", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { size: "S / M", chest: "82–94", waist: "66–78", hip: "90–102", length: "58" },
                      { size: "L / XL", chest: "98–110", waist: "82–94", hip: "106–118", length: "60" },
                    ].map((row, i) => (
                      <tr key={row.size} style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(30,24,20,0.025)" }}>
                        <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: "#1e1814", whiteSpace: "nowrap" }}>{row.size}</td>
                        <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.chest}</td>
                        <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.waist}</td>
                        <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.hip}</td>
                        <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 24, padding: "14px 16px", border: "1px solid rgba(30,24,20,0.10)", borderRadius: 6 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 8 }}>How to measure</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                  {[
                    { label: "Chest", desc: "Measure around the fullest part of your bust, keeping the tape parallel to the floor." },
                    { label: "Waist", desc: "Measure around your natural waistline, the narrowest part of your torso." },
                    { label: "Hip", desc: "Measure around the fullest part of your hips, about 20 cm below your waist." },
                  ].map(({ label, desc }) => (
                    <li key={label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8a7e74", minWidth: 40, paddingTop: 1 }}>{label}</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 300, color: "#8a7e74", lineHeight: 1.6 }}>{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  , document.body);
}
