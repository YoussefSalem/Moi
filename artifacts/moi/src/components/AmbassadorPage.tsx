import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, UserRound, Phone, Mail, Facebook, Instagram, MessageCircleMore, Video, CheckCircle, AlertCircle, Loader } from "lucide-react";

const videos = [
  {
    title: "How brands under 1000 EGP actually look on 👀💸",
    handle: "@etharrdiabb",
    profileUrl: "https://www.tiktok.com/@etharrdiabb",
    caption: "Real styling review — affordable local fashion that actually delivers.",
    embedUrl: "https://www.tiktok.com/embed/v2/7642745763021262098",
  },
  {
    title: "Get ready with me",
    handle: "@thatsalmarocks",
    profileUrl: "https://www.tiktok.com/@thatsalmarocks",
    caption: "Morning routine & outfit check — effortless day-to-night dressing.",
    embedUrl: "https://www.tiktok.com/embed/v2/7639398570302377223",
  },
  {
    title: "Outfit of the day",
    handle: "@shopmoi_",
    profileUrl: "https://www.tiktok.com/@shopmoi_",
    caption: "Styling picks that feel polished and easy to recreate.",
    embedUrl: "https://www.tiktok.com/embed/v2/7639352601947016455",
  },
  {
    title: "Everyday outfit inspo",
    handle: "@thatsalmarocks",
    profileUrl: "https://www.tiktok.com/@thatsalmarocks",
    caption: "Real, wearable outfits that translate from screen to wardrobe.",
    embedUrl: "https://www.tiktok.com/embed/v2/7641637259661430024",
  },
];

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

          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="w-full max-w-6xl rounded-3xl p-6 md:p-8 border border-black/10"
            style={{ backgroundColor: "#1f1916", boxShadow: "0 16px 40px rgba(20,16,12,0.10)" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Video size={16} className="text-white/70" />
              <p className="text-[10px] tracking-[0.35em] uppercase text-white/50">TikTok social proof</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {videos.map((video, idx) => (
                <div
                  key={`${video.handle}-${idx}`}
                  className="rounded-2xl border border-white/10 p-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                >
                  <p className="text-sm text-white/90">{video.title}</p>
                  <a
                    href={video.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[10px] tracking-[0.25em] uppercase text-white/40 hover:text-white/80 transition-colors"
                  >
                    {video.handle}
                  </a>
                  <p className="mt-3 text-sm leading-7 text-white/60">{video.caption}</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10" style={{ background: "#000" }}>
                    <div className="relative aspect-[9/16] overflow-hidden">
                      {video.embedUrl ? (
                        <iframe
                          title={video.title}
                          src={video.embedUrl}
                          className="absolute inset-0 h-full w-full scale-[0.96] md:scale-100 origin-center"
                          allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                          scrolling="no"
                          sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                          style={{ overflow: "hidden" }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg, #1f1916 0%, #2a201c 50%, #1f1916 100%)" }}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-white/25 mb-3">
                            <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                          </svg>
                          <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>Coming soon</p>
                          <div className="mt-4 w-12 h-px bg-white/10" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>
        </section>
      </div>
    </main>
  );
}
