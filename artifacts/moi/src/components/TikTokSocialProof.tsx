import { motion } from "framer-motion";

const videos = [
  {
    embedUrl: "https://www.tiktok.com/embed/v2/7642745763021262098",
  },
  {
    embedUrl: "https://www.tiktok.com/embed/v2/7639398570302377223",
  },
  {
    embedUrl: "https://www.tiktok.com/embed/v2/7639352601947016455",
  },
  {
    embedUrl: "https://www.tiktok.com/embed/v2/7641637259661430024",
  },
];

export function TikTokSocialProof() {
  return (
    <section className="py-12 md:py-20 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {videos.map((video, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl"
                style={{ background: "#000" }}
              >
                {/* TikTok embed includes video + profile bar + bottom action bar + related videos.
                    9/20 on desktop shows everything without clipping. Phone keeps 9/16. */}
                <div className="relative overflow-hidden aspect-[9/16] md:aspect-[9/20]">
                  <iframe
                    title={`TikTok ${idx + 1}`}
                    src={video.embedUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                    scrolling="no"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
