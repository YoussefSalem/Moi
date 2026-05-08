import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useCustomer } from "@/context/CustomerContext";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";

type Mode = "signin" | "signup";

export function CustomerAuthModal() {
  const { authOpen, closeAuth, signIn, signUp, customer, signOut, loading } = useCustomer();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setEmail(""); setPassword(""); setFirstName(""); setLastName("");
    setError(null); setSuccess(false);
  };

  const handleClose = () => { reset(); closeAuth(); };
  const switchMode = (m: Mode) => { setMode(m); setError(null); setSuccess(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SHOPIFY_CONFIGURED) { setError("Shopify is not connected yet."); return; }
    setError(null);
    const err = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, firstName, lastName);
    if (err) { setError(err); } else { setSuccess(true); setTimeout(handleClose, 900); }
  };

  const inputClass = "w-full px-4 py-3 text-sm font-light tracking-wide bg-transparent outline-none placeholder:text-[rgba(30,24,20,0.3)] transition-colors";
  const inputStyle: React.CSSProperties = {
    color: "#1e1814",
    border: "1px solid rgba(30,24,20,0.14)",
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
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            key="auth-modal"
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
              {/* Header */}
              <div
                className="flex items-center justify-between px-8 py-6"
                style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}
              >
                <span
                  className="text-[11px] tracking-[0.32em] uppercase font-medium"
                  style={{ color: "#1e1814" }}
                >
                  {customer ? "My Account" : mode === "signin" ? "Sign In" : "Create Account"}
                </span>
                <button onClick={handleClose} className="transition-opacity hover:opacity-50" aria-label="Close">
                  <X size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                </button>
              </div>

              <div className="px-8 py-8">
                {customer ? (
                  <div className="flex flex-col gap-6">
                    <div>
                      <p className="text-sm font-light" style={{ color: "#1e1814" }}>
                        {customer.firstName ? `Welcome back, ${customer.firstName}.` : `Welcome back.`}
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
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {mode === "signup" && (
                      <div className="flex gap-3">
                        <input
                          className={inputClass}
                          style={inputStyle}
                          placeholder="First name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                        />
                        <input
                          className={inputClass}
                          style={inputStyle}
                          placeholder="Last name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                        />
                      </div>
                    )}
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
                    <input
                      type="password"
                      required
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />

                    {error && (
                      <p className="text-[11px] tracking-wide" style={{ color: "#a0522d" }}>
                        {error}
                      </p>
                    )}
                    {success && (
                      <p className="text-[11px] tracking-wide" style={{ color: "#5a7a5a" }}>
                        {mode === "signin" ? "Welcome back." : "Account created."}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white mt-2 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#1e1814" }}
                    >
                      {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
                    </button>

                    <div className="text-center mt-2">
                      {mode === "signin" ? (
                        <button
                          type="button"
                          onClick={() => switchMode("signup")}
                          className="text-[10px] tracking-[0.25em] uppercase font-light transition-opacity hover:opacity-60"
                          style={{ color: "#7a6e64" }}
                        >
                          New to Moi? Create an account
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchMode("signin")}
                          className="text-[10px] tracking-[0.25em] uppercase font-light transition-opacity hover:opacity-60"
                          style={{ color: "#7a6e64" }}
                        >
                          Already have an account? Sign in
                        </button>
                      )}
                    </div>
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
