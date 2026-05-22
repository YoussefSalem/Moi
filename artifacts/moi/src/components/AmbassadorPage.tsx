import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, UserRound, Phone, Mail, Facebook, Instagram, MessageCircleMore, CheckCircle, AlertCircle, Loader } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

const inputCls =
  "w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none focus:border-black/30 transition-colors text-sm";

export function AmbassadorPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3500);
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/ambassador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, facebook, instagram, message }),
      });

      if (!res.ok) throw new Error("Server error");

      setStatus("success");
      setName(""); setPhone(""); setEmail("");
      setFacebook(""); setInstagram(""); setMessage("");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <main className="min-h-screen pt-20 pb-24 px-6 md:px-12" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      <div className="max-w-6xl mx-auto">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <p className="text-[10px] tracking-[0.35em] uppercase mb-4" style={{ color: "#7a6e64" }}>
            Join Moi
          </p>
          <h1 className="font-serif text-5xl md:text-7xl leading-none" style={{ color: "#1e1814" }}>
            Become an Ambassador
          </h1>
          <p className="mt-6 text-base md:text-lg leading-8 max-w-2xl" style={{ color: "#5a5048" }}>
            Apply to collaborate with Moi and represent the brand through your content, audience, and personal style.
          </p>
        </motion.section>

        <section className="mt-14 flex flex-col items-center gap-12">
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05 }}
            className="w-full max-w-3xl rounded-3xl p-6 md:p-8 border border-black/10"
            style={{ backgroundColor: "#f7f4ef", boxShadow: "0 16px 40px rgba(20,16,12,0.06)" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <UserRound size={13} /> Full name <span style={{ color: "#c0392b" }}>*</span>
                </span>
                <input
                  className={inputCls}
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Phone size={13} /> Phone number
                </span>
                <input
                  className={inputCls}
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Mail size={13} /> Email address <span style={{ color: "#c0392b" }}>*</span>
                </span>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Facebook size={13} /> Facebook profile link
                </span>
                <input
                  className={inputCls}
                  type="url"
                  placeholder="Optional"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Instagram size={13} /> Instagram profile link
                </span>
                <input
                  className={inputCls}
                  type="url"
                  placeholder="Optional"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </label>
            </div>

            <label className="block mt-4">
              <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                <MessageCircleMore size={13} /> Tell us about yourself <span style={{ color: "#c0392b" }}>*</span>
              </span>
              <textarea
                rows={6}
                className={`${inputCls} resize-none`}
                placeholder="Describe yourself, your audience, and why you'd like to become an ambassador."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </label>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-[10px] tracking-[0.34em] uppercase transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#1e1814", color: "#fff" }}
              >
                {status === "loading" ? (
                  <><Loader size={13} className="animate-spin" /> Sending…</>
                ) : (
                  <><Send size={13} /> Apply Now</>
                )}
              </button>

              <AnimatePresence>
                {status === "success" && (
                  <motion.span
                    key="ok"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "#2e7d52" }}
                  >
                    <CheckCircle size={14} /> Application sent — we'll be in touch!
                  </motion.span>
                )}
                {status === "error" && (
                  <motion.span
                    key="err"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "#c0392b" }}
                  >
                    <AlertCircle size={14} /> Please fill in all required fields and try again.
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.form>

          {/* TikTok social proof moved to landing page */}
        </section>
      </div>
    </main>
  );
}
