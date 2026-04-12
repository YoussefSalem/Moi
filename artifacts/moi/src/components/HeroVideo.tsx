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

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
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
        className="absolute bottom-0 left-0 right-0 pb-20 flex flex-col items-center text-center px-6"
      >
        <p
          className="text-[10px] tracking-[0.55em] uppercase mb-4 font-light"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          New Collection
        </p>

        <h1
          className="font-serif leading-[0.88] font-light mb-10"
          style={{
            color: "#fff",
            fontSize: "clamp(3.5rem, 10vw, 8.5rem)",
            letterSpacing: "0.04em",
          }}
        >
          Moi
        </h1>

        <p
          className="text-[10px] tracking-[0.45em] uppercase mb-8 font-light"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          Shop Now
        </p>

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
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
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
