import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const TIKTOK_HANDLE = '@shopmoi_';
const TIKTOK_URL = 'https://www.tiktok.com/@shopmoi_';

interface TikTokPost {
  id: string;
  thumbnail: string;
  views: string;
  likes: string;
  caption: string;
}

// Placeholder posts — replace with real TikTok embed thumbnails or API data
const PLACEHOLDER_POSTS: TikTokPost[] = [
  { id: '1', thumbnail: '', views: '24K', likes: '1.2K', caption: 'New summer drop 🌿' },
  { id: '2', thumbnail: '', views: '18K', likes: '890', caption: 'The Versa Top in Teal ✨' },
  { id: '3', thumbnail: '', views: '31K', likes: '2.1K', caption: 'Styling the Wavvy 🌊' },
];

export function TikTokSocialProof() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section
      ref={ref}
      className="w-full py-24 md:py-32 px-6 md:px-12"
      style={{ backgroundColor: '#faf8f5' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <p
            className="text-[9px] tracking-[0.55em] uppercase mb-3"
            style={{ color: '#b0a090', fontFamily: "'Montserrat', sans-serif" }}
          >
            Seen on TikTok
          </p>
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e1814" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
            </svg>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                fontWeight: 300,
                color: '#1e1814',
                letterSpacing: '0.04em',
              }}
            >
              {TIKTOK_HANDLE}
            </span>
          </a>
        </motion.div>

        {/* Posts grid */}
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          {PLACEHOLDER_POSTS.map((post, i) => (
            <motion.a
              key={post.id}
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="block group relative overflow-hidden rounded-xl"
              style={{ aspectRatio: '9/16', backgroundColor: '#1a1410' }}
            >
              {post.thumbnail ? (
                <img
                  src={post.thumbnail}
                  alt={post.caption}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(200,185,165,0.4)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                  </svg>
                  <p
                    className="text-[10px] text-center px-4"
                    style={{ color: 'rgba(200,185,165,0.4)', fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.12em' }}
                  >
                    {post.caption}
                  </p>
                </div>
              )}

              {/* Overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              />

              {/* Stats */}
              <div className="absolute bottom-0 inset-x-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] text-white/80"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    ▶ {post.views}
                  </span>
                  <span
                    className="text-[10px] text-white/80"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    ♥ {post.likes}
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-center mt-10"
        >
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[9px] tracking-[0.4em] uppercase border px-8 py-3 transition-colors hover:bg-[#1e1814] hover:text-white hover:border-[#1e1814]"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: '#7a6e64',
              borderColor: 'rgba(30,24,20,0.25)',
            }}
          >
            Follow for more
          </a>
        </motion.div>
      </div>
    </section>
  );
}
