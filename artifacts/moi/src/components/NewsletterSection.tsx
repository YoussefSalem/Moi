import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { useCustomer } from "@/context/CustomerContext";
import { subscribeToNewsletter } from "@/lib/shopify";

export function NewsletterSection() {
  const { customer } = useCustomer();
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
    <section className="relative overflow-hidden px-6 pb-20 md:pb-28 pt-10 md:pt-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 md:h-36 bg-[linear-gradient(to_bottom,rgba(40,33,29,0),rgba(40,33,29,0.22),rgba(40,33,29,0.5))]" />
      <div className="mx-auto max-w-5xl relative">
        <div className="absolute inset-x-8 -top-10 h-24 rounded-full blur-3xl bg-[radial-gradient(circle,rgba(255,255,255,0.26),transparent_70%)] opacity-70" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(135deg,rgba(251,247,241,0.96)_0%,rgba(242,235,226,0.93)_52%,rgba(233,223,210,0.9)_100%)] shadow-[0_24px_80px_rgba(20,16,12,0.12)]"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 24px 80px rgba(20,16,12,0.12)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,24,20,0.08),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(122,110,100,0.18),transparent_34%)]" />
          <div className="absolute inset-0 opacity-35 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.55)_44%,transparent_58%)] animate-[moi-shine_7s_ease-in-out_infinite]" />
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
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex-1 px-4 py-4 border border-[rgba(30,24,20,0.12)] bg-white/25 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <Mail size={15} strokeWidth={1.6} style={{ color: "#1e1814" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                          Email address
                        </p>
                        <input
                          type="email"
                          required
                          placeholder="Email address"
                          value={resolvedEmail}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={status === "loading" || status === "success" || isLoggedIn}
                          autoComplete="email"
                          className="mt-1 w-full bg-transparent text-sm md:text-base font-light outline-none placeholder:text-[rgba(30,24,20,0.35)]"
                          style={{ color: "#1e1814" }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={status === "loading" || status === "success"}
                    className="relative isolate inline-flex items-center justify-center gap-2 overflow-hidden px-6 py-4 text-[11px] tracking-[0.28em] uppercase font-medium text-white transition-transform duration-300 hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ backgroundColor: "#1e1814", boxShadow: "0 12px 28px rgba(30,24,20,0.2), inset 0 1px 0 rgba(255,255,255,0.12)" }}
                  >
                    <span className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.42)_46%,transparent_60%)] animate-[moi-shine_6s_ease-in-out_infinite]" />
                    <span className="relative z-10 flex items-center gap-2">
                      {status === "loading" ? "Joining…" : status === "success" ? "Subscribed" : "Subscribe"}
                      <ArrowRight size={14} strokeWidth={1.8} />
                    </span>
                  </button>
                </div>

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
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
