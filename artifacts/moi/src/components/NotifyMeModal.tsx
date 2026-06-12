import { useState, useRef, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { transitions } from "@/lib/motion";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell } from "lucide-react";

interface NotifyMeModalProps {
  open: boolean;
  productTitle: string;
  variantTitle?: string;
  onClose: () => void;
  onSubmit: (email: string) => Promise<{ success: boolean; error?: string }>;
}

export function NotifyMeModal({ open, productTitle, variantTitle, onClose, onSubmit }: NotifyMeModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    setEmail("");
    setStatus("idle");
    setErrorMsg("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    const result = await onSubmit(email.trim());
    if (result.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="notify-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.modalOverlay}
            className="fixed inset-0 z-[110] bg-black/30 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.div
            key="notify-modal"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={transitions.modal}
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Notify me when back in stock"
              className="relative w-full max-w-sm pointer-events-auto"
              style={{ backgroundColor: "#faf8f5" }}
            >
              <div
                className="flex items-center justify-between px-8 py-6"
                style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}
              >
                <div className="flex items-center gap-3">
                  <Bell size={15} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                  <span
                    className="text-[11px] tracking-[0.3em] uppercase font-medium"
                    style={{ color: "#1e1814" }}
                  >
                    Notify Me
                  </span>
                </div>
                <button
                  onClick={handleClose}
                  className="w-11 h-11 flex items-center justify-center -mr-3 transition-opacity hover:opacity-50"
                  aria-label="Close"
                >
                  <X size={17} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                </button>
              </div>

              <div className="px-8 py-8 flex flex-col gap-5">
                {status === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 text-center py-4"
                  >
                    <p
                      className="text-sm font-light leading-relaxed"
                      style={{ color: "#1e1814" }}
                    >
                      You're on the list.
                    </p>
                    <p
                      className="text-[11px] tracking-wide font-light"
                      style={{ color: "#7a6e64" }}
                    >
                      We'll email you as soon as{" "}
                      <span style={{ color: "#1e1814" }}>{productTitle}</span>
                      {variantTitle && variantTitle !== "Default Title" ? ` (${variantTitle})` : ""}{" "}
                      is back in stock.
                    </p>
                    <button
                      onClick={handleClose}
                      className="mt-3 text-[10px] tracking-[0.28em] uppercase font-medium transition-opacity hover:opacity-60"
                      style={{ color: "#7a6e64" }}
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <p
                      className="text-[12px] font-light leading-relaxed"
                      style={{ color: "#5a5048" }}
                    >
                      Enter your email and we'll notify you the moment{" "}
                      <span style={{ color: "#1e1814" }}>{productTitle}</span>
                      {variantTitle && variantTitle !== "Default Title" ? ` — ${variantTitle}` : ""}{" "}
                      is restocked.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                      <input
                        type="email"
                        required
                        autoFocus
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === "loading"}
                        className="w-full px-4 py-3 text-sm font-light tracking-wide bg-transparent outline-none placeholder:text-[rgba(30,24,20,0.3)] transition-colors"
                        style={{
                          color: "#1e1814",
                          border: "1px solid rgba(30,24,20,0.14)",
                        }}
                        autoComplete="email"
                      />

                      {(status === "error" || errorMsg) && (
                        <p
                          className="text-[11px] tracking-wide"
                          style={{ color: "#a0522d" }}
                        >
                          {errorMsg}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: "#1e1814" }}
                      >
                        {status === "loading" ? "…" : "Notify Me"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
