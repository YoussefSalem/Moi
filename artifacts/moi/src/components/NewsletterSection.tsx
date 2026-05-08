import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { useCustomer } from "@/context/CustomerContext";
import { subscribeToNewsletter } from "@/lib/shopify";

export function NewsletterSection() {
  const { customer, openAuth } = useCustomer();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isLoggedIn = Boolean(customer?.email);
  const resolvedEmail = customer?.email ?? email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (isLoggedIn ? customer?.email ?? "" : email).trim();

    if (!targetEmail || !targetEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const result = await subscribeToNewsletter(targetEmail);
    if (result.success) {
      setStatus("success");
      return;
    }

    setStatus("error");
    setErrorMsg(result.error ?? "Something went wrong. Please try again.");
  };

  return (
    <section className="px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden border border-[rgba(30,24,20,0.14)] bg-[linear-gradient(135deg,#fbf7f1_0%,#f2ebe2_52%,#e9dfd2_100%)]"
        >
          <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top_left,rgba(30,24,20,0.08),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(122,110,100,0.16),transparent_34%)]" />
          <div className="relative px-6 py-10 md:px-12 md:py-14">
            <div className="flex flex-col gap-8 md:gap-10">
              <div className="flex items-center gap-3 text-[10px] tracking-[0.35em] uppercase" style={{ color: "#7a6e64" }}>
                <Sparkles size={13} strokeWidth={1.6} />
                Moi Newsletter
              </div>

              <div className="max-w-3xl flex flex-col gap-4">
                <p className="font-[Cormorant_Garamond,serif] text-[clamp(2rem,5vw,4.5rem)] leading-[0.92] tracking-[-0.04em] font-semibold text-[#1e1814]">
                  Stay in Moi-tion.
                </p>
                <p className="max-w-2xl text-sm md:text-base leading-relaxed font-light" style={{ color: "#5a5048" }}>
                  More Moi, never miss a moment — get first access to new drops, restocks, and pieces worth waiting for.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-4">
                {isLoggedIn ? (
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex-1 px-4 py-4 border border-[rgba(30,24,20,0.14)] bg-white/35 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <Mail size={15} strokeWidth={1.6} style={{ color: "#1e1814" }} />
                        <div className="min-w-0">
                          <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                            Your email
                          </p>
                          <p className="truncate text-sm md:text-base font-light" style={{ color: "#1e1814" }}>
                            {resolvedEmail}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading" || status === "success"}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 text-[11px] tracking-[0.28em] uppercase font-medium text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#1e1814" }}
                    >
                      {status === "loading" ? "Joining…" : status === "success" ? "Subscribed" : "Subscribe"}
                      <ArrowRight size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex-1">
                      <input
                        type="email"
                        required
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === "loading" || status === "success"}
                        autoComplete="email"
                        className="w-full px-4 py-4 text-sm md:text-base font-light tracking-wide bg-transparent outline-none placeholder:text-[rgba(30,24,20,0.35)]"
                        style={{ color: "#1e1814", border: "1px solid rgba(30,24,20,0.14)" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading" || status === "success"}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 text-[11px] tracking-[0.28em] uppercase font-medium text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#1e1814" }}
                    >
                      {status === "loading" ? "Joining…" : status === "success" ? "Subscribed" : "Subscribe"}
                      <ArrowRight size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                )}

                {(status === "error" || errorMsg) && (
                  <p className="text-[11px] tracking-wide" style={{ color: "#a0522d" }}>
                    {errorMsg}
                  </p>
                )}

                {status === "success" && (
                  <p className="text-[11px] tracking-[0.22em] uppercase" style={{ color: "#7a6e64" }}>
                    You're on the list.
                  </p>
                )}

                {!isLoggedIn && (
                  <button
                    type="button"
                    onClick={openAuth}
                    className="w-fit text-[10px] tracking-[0.28em] uppercase transition-opacity hover:opacity-60"
                    style={{ color: "#7a6e64" }}
                  >
                    Sign in for one-click subscribe
                  </button>
                )}
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
