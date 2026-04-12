import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IMAGES } from "@/config/images";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

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
      try {
        await video.play();
      } catch {
        setVideoFailed(true);
      }
    };

    if (video.readyState >= 3) {
      setLoaded(true);
      play();
    } else {
      video.oncanplay = () => {
        setLoaded(true);
        play();
      };
      video.onerror = () => { setVideoFailed(true); setLoaded(true); };
    }
  }, []);

  return (
    <section className="relative w-full h-screen overflow-hidden">
      {!videoFailed && IMAGES.hero.videoUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={IMAGES.hero.videoUrl}
          loop
          muted
          playsInline
          autoPlay
          poster={IMAGES.hero.fallbackUrl}
        />
      ) : (
        <img
          src={IMAGES.hero.fallbackUrl}
          alt="Moi fashion"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: loaded || videoFailed ? 1 : 0, y: loaded || videoFailed ? 0 : 30 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        className="absolute bottom-0 left-0 right-0 pb-20 flex flex-col items-center text-center"
      >
        <p
          className="text-xs tracking-[0.4em] uppercase mb-4 font-light"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          New Collection
        </p>
        <h1
          className="font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.9] font-light mb-8"
          style={{ color: "#fff", letterSpacing: "0.04em" }}
        >
          The Cape
          <br />
          <em style={{ fontStyle: "italic", opacity: 0.85 }}>Edit</em>
        </h1>
        <motion.a
          href="#collection"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-block px-10 py-4 text-xs tracking-[0.3em] uppercase font-medium border transition-all duration-300"
          style={{
            color: "#fff",
            borderColor: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          Discover
        </motion.a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-px h-10"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.6))" }}
        />
      </motion.div>
    </section>
  );
}
