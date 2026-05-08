import { useState } from "react";
import { motion } from "framer-motion";
import { Send, UserRound, Phone, Mail, Facebook, Instagram, MessageCircleMore, Video } from "lucide-react";
const tiktokThumbnail = "/tiktok-thumbnail.png";

const videos = [
  {
    title: "Everyday styling",
    handle: "@moiwithsara",
    text: "A clean, modern look styled for day-to-night wear.",
    url: "https://www.tiktok.com/@grwm._isaaa/video/7637274579974606087?q=get%20ready%20with%20me%20&t=1778214831769",
  },
  {
    title: "Unboxing + fit check",
    handle: "@noorwearsmoi",
    text: "Real try-on content that builds trust and shows the fit.",
    url: "https://www.tiktok.com/@hollyjai_/photo/7329247143737249056?q=get%20ready%20with%20me%20&t=1778214831769",
  },
  {
    title: "How I style it",
    handle: "@bydalia",
    text: "Short-form content that feels authentic and easy to share.",
    url: "https://www.tiktok.com/@tatiannaareizaga/video/7598245849679826206?q=get%20ready%20with%20me%20&t=1778214831769",
  },
];

const embedUrls = [
  "https://www.tiktok.com/embed/v2/7637274579974606087",
  "https://www.tiktok.com/embed/v2/7329247143737249056",
  "https://www.tiktok.com/embed/v2/7598245849679826206",
];

const captions = [
  "A clean, modern look styled for day-to-night wear.",
  "Real try-on content that builds trust and shows the fit.",
  "Short-form content that feels authentic and easy to share.",
];

export function AmbassadorPage() {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

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
                <input className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none" type="text" placeholder="Your full name" />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Phone size={13} /> Phone number
                </span>
                <input className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none" type="tel" placeholder="Phone number" />
              </label>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Mail size={13} /> Email address
                </span>
                <input className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none" type="email" placeholder="Email address" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Facebook size={13} /> Facebook profile link
                </span>
                <input className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none" type="url" placeholder="Optional" />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                  <Instagram size={13} /> Instagram profile link
                </span>
                <input className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none" type="url" placeholder="Optional" />
              </label>
            </div>

            <label className="block mt-4">
              <span className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>
                <MessageCircleMore size={13} /> Tell us about yourself
              </span>
              <textarea
                rows={6}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/70 outline-none resize-none"
                placeholder="Describe yourself, your audience, and why you'd like to become an ambassador."
              />
            </label>

            <button
              type="button"
              className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-[10px] tracking-[0.34em] uppercase"
              style={{ backgroundColor: "#1e1814", color: "#fff" }}
            >
              <Send size={13} /> Apply Now
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
              {videos.map((video, index) => (
                <div
                  key={video.title}
                  className="rounded-2xl border border-white/10 p-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                >
                  <p className="text-sm text-white/90">{video.title}</p>
                  <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-white/40">{video.handle}</p>
                  <p className="mt-3 text-sm leading-7 text-white/60">{captions[index]}</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <div className="relative aspect-[9/16]">
                      {activeVideo === index ? (
                        <iframe
                          title={video.title}
                          src={embedUrls[index]}
                          className="absolute inset-0 h-full w-full"
                          allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveVideo(index)}
                          className="absolute inset-0 overflow-hidden"
                          style={{ padding: 0, border: "none", background: "none" }}
                        >
                          <img
                            src={tiktokThumbnail}
                            alt={video.title}
                            className="block w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                              <div className="ml-1 h-0 w-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-white" />
                            </div>
                          </div>
                        </button>
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