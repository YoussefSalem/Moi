import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { transitions } from "@/lib/motion";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, Mail } from "lucide-react";
import { useCustomer } from "@/context/CustomerContext";

type Step = "email" | "code";

export function CustomerAuthModal() {
  const { authOpen, closeAuth, sendOtp, verifyOtp, customer, signOut, loading } = useCustomer();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, authOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && authOpen) handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOpen]);

  const reset = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setError(null);
    setCountdown(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleClose = () => { reset(); closeAuth(); };

  // Focus code input when step changes
  useEffect(() => {
    if (step === "code") {
      setTimeout(() => codeInputRef.current?.focus(), 120);
    }
  }, [step]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown(seconds = 60) {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await sendOtp(email);
    if (err) { setError(err); return; }
    setStep("code");
    startCountdown(60);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await verifyOtp(email, code);
    if (err) { setError(err); return; }
    // success — context closes modal and sets customer
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    setCode("");
    const err = await sendOtp(email);
    if (err) { setError(err); return; }
    startCountdown(60);
  };

  const inputStyle: React.CSSProperties = {
    color: "#1e1814",
    border: "1px solid rgba(30,24,20,0.14)",
    width: "100%",
    padding: "12px 16px",
    fontSize: "15px",
    fontWeight: 300,
    letterSpacing: "0.04em",
    backgroundColor: "transparent",
    outline: "none",
    fontFamily: "'Montserrat', sans-serif",
  };

  return (
    <AnimatePresence>
      {authOpen && (
        <>
          <motion.div
            key="auth-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.modalOverlay}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.div
            key="auth-modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={transitions.modal}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Sign in"
              className="relative w-full max-w-sm pointer-events-auto flex flex-col"
              style={{ backgroundColor: "#faf8f5" }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-8 py-6"
                style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}
              >
                <div className="flex items-center gap-3">
                  {step === "code" && !customer && (
                    <button
                      onClick={() => { setStep("email"); setCode(""); setError(null); }}
                      className="w-11 h-11 flex items-center justify-center -ml-3 transition-opacity hover:opacity-50"
                      aria-label="Back"
                    >
                      <ArrowLeft size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                    </button>
                  )}
                  <span
                    className="text-[11px] tracking-[0.32em] uppercase font-medium"
                    style={{ color: "#1e1814" }}
                  >
                    {customer ? "My Account" : step === "email" ? "Sign In" : "Enter Code"}
                  </span>
                </div>
                <button onClick={handleClose} className="w-11 h-11 flex items-center justify-center -mr-3 transition-opacity hover:opacity-50" aria-label="Close">
                  <X size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                </button>
              </div>

              <div className="px-8 py-8">
                {/* Signed-in view */}
                {customer ? (
                  <div className="flex flex-col gap-6">
                    <div>
                      <p className="text-sm font-light" style={{ color: "#1e1814" }}>
                        {customer.firstName ? `Welcome back, ${customer.firstName}.` : "Welcome back."}
                      </p>
                      <p className="text-[11px] tracking-wide mt-1" style={{ color: "#7a6e64" }}>
                        {customer.email}
                      </p>
                    </div>
                    <button
                      onClick={() => { signOut(); handleClose(); }}
                      className="w-full py-3.5 text-[11px] tracking-[0.28em] uppercase font-medium transition-opacity hover:opacity-70"
                      style={{ border: "1px solid rgba(30,24,20,0.2)", color: "#1e1814" }}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    {/* Step 1 — Email */}
                    {step === "email" && (
                      <motion.form
                        key="email-step"
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        onSubmit={handleSendOtp}
                        className="flex flex-col gap-4"
                      >
                        <p className="text-[12px] leading-relaxed" style={{ color: "#7a6e64", letterSpacing: "0.03em" }}>
                          Enter your email and we'll send you a one-time sign-in code — no password needed.
                        </p>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="Email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={inputStyle}
                        />

                        {error && (
                          <p className="text-[11px] tracking-wide" style={{ color: "#a0522d" }}>{error}</p>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white mt-1 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ backgroundColor: "#1e1814" }}
                        >
                          <Mail size={13} strokeWidth={1.8} />
                          {loading ? "Sending…" : "Send Code"}
                        </button>
                      </motion.form>
                    )}

                    {/* Step 2 — Code */}
                    {step === "code" && (
                      <motion.form
                        key="code-step"
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 18 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        onSubmit={handleVerify}
                        className="flex flex-col gap-4"
                      >
                        <p className="text-[12px] leading-relaxed" style={{ color: "#7a6e64", letterSpacing: "0.03em" }}>
                          We sent a 6-digit code to <strong style={{ color: "#1e1814" }}>{email}</strong>. Enter it below.
                        </p>

                        <input
                          ref={codeInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          maxLength={6}
                          placeholder="– – – – – –"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          style={{
                            ...inputStyle,
                            fontSize: "23px",
                            letterSpacing: "0.4em",
                            textAlign: "center",
                            fontWeight: 500,
                          }}
                        />

                        {error && (
                          <p className="text-[11px] tracking-wide" style={{ color: "#a0522d" }}>{error}</p>
                        )}

                        <button
                          type="submit"
                          disabled={loading || code.length < 6}
                          className="w-full py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white mt-1 transition-opacity disabled:opacity-50"
                          style={{ backgroundColor: "#1e1814" }}
                        >
                          {loading ? "Verifying…" : "Sign In"}
                        </button>

                        <div className="text-center">
                          {countdown > 0 ? (
                            <span
                              className="text-[10px] tracking-[0.2em] uppercase"
                              style={{ color: "rgba(30,24,20,0.35)" }}
                            >
                              Resend in {countdown}s
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResend}
                              disabled={loading}
                              className="text-[10px] tracking-[0.25em] uppercase font-light transition-opacity hover:opacity-60 disabled:opacity-40"
                              style={{ color: "#7a6e64" }}
                            >
                              {loading ? "Sending…" : "Resend code"}
                            </button>
                          )}
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
