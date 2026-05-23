import { motion } from "framer-motion";

const videos = [
  {
    title: "How brands under 1000 EGP actually look on 👀💸",
    embedUrl: "https://www.tiktok.com/embed/v2/7642745763021262098?hide_related=1",
  },
  {
    title: "Get ready with me",
    embedUrl: "https://www.tiktok.com/embed/v2/7639398570302377223?hide_related=1",
  },
  {
    title: "Outfit of the day",
    embedUrl: "https://www.tiktok.com/embed/v2/7639352601947016455?hide_related=1",
  },
  {
    title: "Everyday outfit inspo",
    embedUrl: "https://www.tiktok.com/embed/v2/7641637259661430024?hide_related=1",
  },
];

export function TikTokSocialProof() {
  return (
    <section className="py-16 md:py-24 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
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

          {/* Clean TikTok embed grid — just the players, no card wrapper */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {videos.map((video, idx) => (
              <div
                key={`${video.title}-${idx}`}
                className="relative overflow-hidden rounded-xl"
                style={{ backgroundColor: "#000", aspectRatio: "9/16" }}
              >
                {/* iframe extends below container to hide the "Watch now" ribbon; overflow:hidden clips it */}
                <iframe
                  title={video.title}
                  src={video.embedUrl}
                  className="absolute top-0 left-0 w-full"
                  style={{
                    height: "calc(100% + 100px)",
                    border: "none",
                  }}
                  allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                  scrolling="no"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
