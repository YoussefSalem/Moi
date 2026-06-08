import { useState } from "react";
import { motion } from "framer-motion";
import { Video, Play } from "lucide-react";

type VideoType = "video" | "carousel";

interface VideoItem {
  title: string;
  handle: string;
  profileUrl: string;
  caption: string;
  embedUrl: string;
  type: VideoType;
  thumbnail?: string;
}

const videos: VideoItem[] = [
  {
    title: "Moi moment",
    handle: "@dinaayman52",
    profileUrl: "https://www.tiktok.com/@dinaayman52",
    caption: "Another real look in Moi — styled and worn.",
    embedUrl: "https://www.tiktok.com/embed/v2/7648005799708544276",
    type: "carousel",
  },
  {
    title: "Moi fit check",
    handle: "@llifewitht",
    profileUrl: "https://www.tiktok.com/@llifewitht",
    caption: "Styling Moi — real look, real feel.",
    embedUrl: "https://www.tiktok.com/embed/v2/7647230230519713044",
    type: "carousel",
  },
  {
    title: "Moi outfit of the day",
    handle: "@lojaiinnabil",
    profileUrl: "https://www.tiktok.com/@lojaiinnabil",
    caption: "Everyday Moi looks that actually work.",
    embedUrl: "https://www.tiktok.com/embed/v2/7647196308670926087",
    type: "video",
  },
  {
    title: "Wearing Moi",
    handle: "@tokagamal2",
    profileUrl: "https://www.tiktok.com/@tokagamal2",
    caption: "Effortless dressing with Moi pieces.",
    embedUrl: "https://www.tiktok.com/embed/v2/7647232073824062721",
    type: "video",
  },
  {
    title: "How brands under 1000 EGP actually look on 👀💸",
    handle: "@etharrdiabb",
    profileUrl: "https://www.tiktok.com/@etharrdiabb",
    caption: "Real styling review — affordable local fashion that actually delivers.",
    embedUrl: "https://www.tiktok.com/embed/v2/7642745763021262098",
    type: "video",
  },
  {
    title: "New Moi piece just dropped 🔥",
    handle: "@etharrdiabb",
    profileUrl: "https://www.tiktok.com/@etharrdiabb",
    caption: "First look at the latest Moi drop — fit, fabric, and how it wears.",
    embedUrl: "https://www.tiktok.com/embed/v2/7643440266891840776",
    type: "video",
  },
  {
    title: "Get ready with me",
    handle: "@thatsalmarocks",
    profileUrl: "https://www.tiktok.com/@thatsalmarocks",
    caption: "Morning routine & outfit check — effortless day-to-night dressing.",
    embedUrl: "https://www.tiktok.com/embed/v2/7639398570302377223",
    type: "carousel",
  },
  {
    title: "Outfit of the day",
    handle: "@shopmoi_",
    profileUrl: "https://www.tiktok.com/@shopmoi_",
    caption: "Styling picks that feel polished and easy to recreate.",
    embedUrl: "https://www.tiktok.com/embed/v2/7639352601947016455",
    type: "video",
  },
  {
    title: "Everyday outfit inspo",
    handle: "@thatsalmarocks",
    profileUrl: "https://www.tiktok.com/@thatsalmarocks",
    caption: "Real, wearable outfits that translate from screen to wardrobe.",
    embedUrl: "https://www.tiktok.com/embed/v2/7641637259661430024",
    type: "video",
  },
];

interface TikTokCardProps {
  video: VideoItem;
}

function TikTokCard({ video }: TikTokCardProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)] max-w-[440px] rounded-2xl border border-white/10 p-4"
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

      <div
        className="mt-4 overflow-hidden rounded-2xl border border-white/10"
        style={{ background: "#000" }}
      >
        <div className="relative overflow-hidden aspect-[9/16]">
          {playing ? (
            <iframe
              title={video.title}
              src={video.embedUrl}
              className="absolute left-0 top-0 w-full"
              style={{ height: "107%", transform: "translateY(-2px)" }}
              allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture; autoplay"
              scrolling="no"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms"
            />
          ) : (
            /* Facade: instant thumbnail — no network cost, no lazy loading */
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center group"
              style={{
                background: "linear-gradient(160deg, #1a1410 0%, #2c1f18 40%, #1a1410 100%)",
                cursor: "pointer",
              }}
              aria-label={`Play ${video.title}`}
            >
              {/* Subtle TikTok-style grid lines for texture */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,1) 39px, rgba(255,255,255,1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,1) 39px, rgba(255,255,255,1) 40px)",
                }}
              />

              {/* TikTok logo watermark */}
              <div className="absolute top-4 right-4 opacity-20">
                <svg width="20" height="22" viewBox="0 0 24 28" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9a8.19 8.19 0 0 0 4.78 1.52V7.07a4.85 4.85 0 0 1-1.01-.38z" />
                </svg>
              </div>

              {/* Handle badge */}
              <div
                className="absolute bottom-5 left-0 right-0 flex justify-center"
              >
                <span
                  className="px-3 py-1 rounded-full text-[10px] tracking-[0.2em] uppercase font-medium text-white/60"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {video.handle}
                </span>
              </div>

              {/* Play button */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="relative z-10 flex items-center justify-center rounded-full"
                style={{
                  width: 60,
                  height: 60,
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Play
                  size={22}
                  fill="white"
                  strokeWidth={0}
                  style={{ color: "white", marginLeft: 3 }}
                />
              </motion.div>

              <p
                className="mt-4 text-[9px] tracking-[0.3em] uppercase text-white/35 font-medium"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Tap to play
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TikTokSocialProof() {
  return (
    <section id="social-proof" className="py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Headline */}
          <div className="text-center mb-10 md:mb-14">
            <p
              className="tracking-[0.45em] uppercase mb-4 text-[11px]"
              style={{
                color: "rgba(120,108,96,0.55)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              TikTok social proof
            </p>
            <h2
              className="font-serif text-3xl md:text-5xl leading-[1.05]"
              style={{ color: "#1e1814" }}
            >
              Styled by you
            </h2>
            <p
              className="mt-4 text-sm md:text-base leading-7 max-w-lg mx-auto"
              style={{
                color: "rgba(30,24,20,0.55)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Real people. Real outfits. See how Moi moves in the wild.
            </p>
          </div>

          {/* Video grid */}
          <div
            className="rounded-3xl p-6 md:p-8 border border-black/10"
            style={{ backgroundColor: "#1f1916", boxShadow: "0 16px 40px rgba(20,16,12,0.10)" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Video size={16} className="text-white/70" />
              <p className="text-[10px] tracking-[0.35em] uppercase text-white/50">TikTok social proof</p>
            </div>
            <div className="flex flex-wrap justify-center gap-5">
              {videos.map((video, idx) => (
                <TikTokCard key={`${video.handle}-${idx}`} video={video} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
