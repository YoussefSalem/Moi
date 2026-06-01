import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactModal({ open, onClose }: ContactModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => { setName(""); setEmail(""); setMessage(""); setStatus("idle"); setErrorMsg(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE}api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Request failed");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const inputClass = "w-full px-4 py-3 text-sm font-light tracking-wide bg-transparent outline-none placeholder:opacity-30 transition-colors";
  const inputStyle: React.CSSProperties = { color: "#1e1814", border: "1px solid rgba(30,24,20,0.14)" };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="contact-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            key="contact-modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "tween", duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className="relative w-full max-w-sm pointer-events-auto flex flex-col"
              style={{ backgroundColor: "#faf8f5" }}
            >
              {/* Wavy top border */}
              <svg
                viewBox="0 0 420 48"
                preserveAspectRatio="none"
                className="absolute top-0 left-0 w-full z-[1] pointer-events-none"
                style={{ height: 48 }}
                aria-hidden="true"
              >
                {/* Double-V wave: sharp peaks and valleys */}
                <path
                  d="M0 48 L0 30 L52 8 L105 30 L158 8 L211 30 L264 8 L317 30 L370 8 L420 30 L420 48 Z"
                  fill="none"
                  stroke="rgba(30,24,20,0.14)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 48 L0 38 L52 16 L105 38 L158 16 L211 38 L264 16 L317 38 L370 16 L420 38 L420 48 Z"
                  fill="none"
                  stroke="rgba(30,24,20,0.08)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div
                className="flex items-center justify-between px-8 py-6"
                style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}
              >
                <span className="text-[11px] tracking-[0.32em] uppercase font-medium" style={{ color: "#1e1814" }}>
                  Contact
                </span>
                <button onClick={handleClose} className="transition-opacity hover:opacity-50" aria-label="Close">
                  <X size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                </button>
              </div>

              <div className="px-8 py-8">
                {status === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 text-center py-4"
                  >
                    <p className="text-sm font-light" style={{ color: "#1e1814" }}>
                      Message received.
                    </p>
                    <p className="text-[11px] tracking-wide font-light" style={{ color: "#7a6e64" }}>
                      We'll be in touch shortly.
                    </p>
                    <button
                      onClick={handleClose}
                      className="mt-4 text-[10px] tracking-[0.28em] uppercase font-medium px-8 py-3 transition-opacity hover:opacity-70 self-center"
                      style={{ border: "1px solid rgba(30,24,20,0.2)", color: "#1e1814" }}
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                      required
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                    <input
                      type="email"
                      required
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <textarea
                      required
                      rows={4}
                      className={inputClass}
                      style={{ ...inputStyle, resize: "none" }}
                      placeholder="Your message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />

                    {status === "error" && (
                      <p className="text-[11px] tracking-wide" style={{ color: "#a0522d" }}>
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white mt-1 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#1e1814" }}
                    >
                      {status === "loading" ? "Sending…" : "Send Message"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
