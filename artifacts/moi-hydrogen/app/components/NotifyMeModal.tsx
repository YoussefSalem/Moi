import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell } from "lucide-react";

interface NotifyMeModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  variantTitle?: string;
  onSubmit: (email: string) => Promise<{ success: boolean; error?: string }>;
}

export function NotifyMeModal({ open, onClose, productName, variantTitle, onSubmit }: NotifyMeModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    const result = await onSubmit(trimmed);
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[96] w-full max-w-sm mx-4"
            style={{ backgroundColor: "#faf8f5", border: "1px solid rgba(30,24,20,0.08)", boxShadow: "0 24px 80px rgba(30,24,20,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Bell size={15} strokeWidth={1.5} style={{ color: "#7a6e64" }} />
                <span className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>Notify Me</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-50">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-6 py-6">
              {status === "success" ? (
                <div className="text-center py-4">
                  <p className="font-serif text-xl mb-2" style={{ color: "#1e1814" }}>You're on the list.</p>
                  <p className="text-sm" style={{ color: "rgba(30,24,20,0.6)" }}>
                    We'll email you when {productName} is back in stock.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-5 text-[10px] tracking-[0.22em] uppercase transition-opacity hover:opacity-50"
                    style={{ color: "#1e1814" }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-serif text-lg mb-1" style={{ color: "#1e1814" }}>{productName}</p>
                  {variantTitle && (
                    <p className="text-[11px] tracking-wide mb-4" style={{ color: "rgba(30,24,20,0.5)" }}>{variantTitle}</p>
                  )}
                  <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(30,24,20,0.65)" }}>
                    Enter your email and we'll let you know as soon as this item is back in stock.
                  </p>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === "loading"}
                      autoComplete="email"
                      className="checkout-input w-full px-4 py-3 text-sm border outline-none transition-colors"
                      style={{ borderColor: "rgba(30,24,20,0.15)", backgroundColor: "white", color: "#1e1814" }}
                    />
                    {(status === "error" || errorMsg) && (
                      <p className="text-[11px]" style={{ color: "#a0522d" }}>{errorMsg}</p>
                    )}
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="py-3 text-[11px] tracking-[0.28em] uppercase text-white transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: "#1e1814" }}
                    >
                      {status === "loading" ? "Subscribing…" : "Notify Me"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
