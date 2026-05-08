import { useState } from "react";
import { motion } from "framer-motion";
import { Send, UserRound, Phone, Mail, Facebook, Instagram, MessageCircleMore, Video } from "lucide-react";
import { toast } from "sonner";

const videos = [
  {
    title: "Get ready with me",
    handle: "@grwm._isaaa",
    caption: "Morning routine & outfit check — effortless day-to-night dressing.",
    embedUrl: "https://www.tiktok.com/embed/v2/7637274579974606087",
  },
  {
    title: "Outfit of the day",
    handle: "@hollyjai_",
    caption: "Styling picks that feel polished and easy to recreate.",
    embedUrl: "https://www.tiktok.com/embed/v2/7329247143737249056",
  },
  {
    title: "My go-to look",
    handle: "@tatiannaareizaga",
    caption: "Real, wearable outfits that translate from screen to wardrobe.",
    embedUrl: "https://www.tiktok.com/embed/v2/7598245849679826206",
  },
];

export function AmbassadorPage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    facebook: "",
    instagram: "",
    about: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ambassador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      toast.success("Application sent! We'll be in touch soon.");
      setForm({ name: "", phone: "", email: "", facebook: "", instagram: "", about: "" });
    } catch {
      toast.error("Could not send your application. Please try again.");
    } finally {
      setSubmitting(false);
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
                  <UserRound size={13} /> Full name
                </span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none"
                  type="text"
                  placeholder="Your full name"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Phone size={13} /> Phone number
                </span>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none"
                  type="tel"
                  placeholder="Phone number"
                />
              </label>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Mail size={13} /> Email address
                </span>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none"
                  type="email"
                  placeholder="Email address"
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
                  name="facebook"
                  value={form.facebook}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none"
                  type="url"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Instagram size={13} /> Instagram profile link
                </span>
                <input
                  name="instagram"
                  value={form.instagram}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none"
                  type="url"
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="block mt-4">
              <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                <MessageCircleMore size={13} /> Tell us about yourself
              </span>
              <textarea
                name="about"
                value={form.about}
                onChange={handleChange}
                rows={6}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none resize-none"
                placeholder="Describe yourself, your audience, and why you'd like to become an ambassador."
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-[10px] tracking-[0.34em] uppercase disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#1e1814", color: "#fff" }}
            >
              <Send size={13} /> {submitting ? "Sending…" : "Apply Now"}
            </button>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div
                  key={video.handle}
                  className="rounded-2xl border border-white/10 p-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                >
                  <p className="text-sm text-white/90">{video.title}</p>
                  <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-white/40">{video.handle}</p>
                  <p className="mt-3 text-sm leading-7 text-white/60">{video.caption}</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10" style={{ background: "#000" }}>
                    <div className="relative aspect-[9/16]">
                      <iframe
                        title={video.title}
                        src={video.embedUrl}
                        className="absolute inset-0 h-full w-full"
                        allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                        scrolling="no"
                        style={{ overflow: "hidden" }}
                      />
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
