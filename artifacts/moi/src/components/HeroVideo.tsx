import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IMAGES } from "@/config/images";
import { useImageColor } from "@/hooks/useImageColor";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const color = useImageColor(IMAGES.hero.fallbackUrl);
  const gradEdge = color?.rgba(0.22) ?? "rgba(180,160,130,0.15)";

  useEffect(() => {
    if (!IMAGES.hero.videoUrl) {
      setLoaded(true);
      setVideoFailed(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;

    const play = async () => {
      try { await video.play(); }
      catch { setVideoFailed(true); setLoaded(true); }
    };

    if (video.readyState >= 3) {
      setLoaded(true);
      play();
    } else {
      video.oncanplay = () => { setLoaded(true); play(); };
      video.onerror = () => { setVideoFailed(true); setLoaded(true); };
    }
  }, []);

  return (
    <section className="relative w-full h-screen overflow-hidden">
      {/* Ambient edge glow — derived from hero image dominant color */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: [
            `radial-gradient(ellipse 60% 40% at 0% 50%, ${gradEdge} 0%, transparent 70%)`,
            `radial-gradient(ellipse 60% 40% at 100% 50%, ${gradEdge} 0%, transparent 70%)`,
            `radial-gradient(ellipse 100% 30% at 50% 100%, ${gradEdge} 0%, transparent 60%)`,
          ].join(", "),
          transition: "background 2s ease",
        }}
      />

      {/* Video or Ken Burns image */}
      {!videoFailed && IMAGES.hero.videoUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover object-top"
          src={IMAGES.hero.videoUrl}
          loop muted playsInline autoPlay
          poster={IMAGES.hero.fallbackUrl}
        />
      ) : (
        <motion.img
          src={IMAGES.hero.fallbackUrl}
          alt="Moi fashion"
          className="absolute inset-0 w-full h-full object-cover object-top"
          initial={{ scale: 1 }}
          animate={{ scale: 1.06 }}
          transition={{ duration: 14, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
        />
      )}

      {/* Primary gradient overlay */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.04) 35%, rgba(0,0,0,0.04) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Text content */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 28 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        className="absolute bottom-0 left-0 right-0 pb-20 flex flex-col items-center text-center px-6 z-[3]"
      >
        <p
          className="text-[10px] tracking-[0.55em] uppercase mb-4 font-light"
          style={{ color: "rgba(255,255,255,0.72)", fontFamily: "'Montserrat', sans-serif" }}
        >
          New Collection
        </p>

        <h1
          className="font-serif font-light mb-8"
          style={{
            color: "#fff",
            fontSize: "clamp(5rem, 13vw, 11rem)",
            letterSpacing: "0.02em",
            lineHeight: 0.9,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
          }}
        >
          Moi
        </h1>

        <motion.a
          href="#collection"
          whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.14)" }}
          whileTap={{ scale: 0.98 }}
          className="inline-block px-12 py-4 text-[10px] tracking-[0.4em] uppercase font-light border transition-all duration-300"
          style={{
            color: "#fff",
            borderColor: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(4px)",
            backgroundColor: "rgba(255,255,255,0.06)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Shop Now
        </motion.a>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[3]"
      >
        <motion.div
          animate={{ y: [0, 9, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="w-px h-10 mx-auto"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.55))" }}
        />
      </motion.div>
    </section>
  );
}
