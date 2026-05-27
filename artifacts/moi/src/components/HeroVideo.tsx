import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { IMAGES } from "@/config/images";

// Detect mobile once on mount (never re-check — prevents layout jitter)
const getIsMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

const HERO_GRAD_EDGE = "rgba(210,195,175,0.10)";

interface HeroVideoProps {
  onReady?: () => void;
}

export function HeroVideo({ onReady }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isMobileRef = useRef(getIsMobile());
  const [loaded, setLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const gradEdge = HERO_GRAD_EDGE;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const mobileImageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "38%"]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const handleShopNow = () => {
    const el = document.getElementById("collection");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Notify parent when hero media is ready
  useEffect(() => {
    if (loaded) onReady?.();
  }, [loaded, onReady]);

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
  }, [onReady]);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: "100svh" }}
    >
      {/* Skeleton shown while hero image/video is loading */}
      {!loaded && (
        <div
          className="absolute inset-0 z-[1] animate-pulse"
          style={{ backgroundColor: "#e8e3dc" }}
        />
      )}

      {/* Ambient edge glow */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: [
            `radial-gradient(ellipse 70% 50% at 0% 50%, ${gradEdge} 0%, transparent 70%)`,
            `radial-gradient(ellipse 70% 50% at 100% 50%, ${gradEdge} 0%, transparent 70%)`,
            `radial-gradient(ellipse 100% 40% at 50% 100%, ${gradEdge} 0%, transparent 60%)`,
          ].join(", "),
        }}
      />

      {/* Parallax image / video — mobile: subtle 8% parallax; desktop: full 22% */}
      <motion.div
        className="absolute inset-0 w-full h-[115%] -top-[7.5%]"
        style={isMobileRef.current
          ? { y: mobileImageY, willChange: "transform" }
          : { y: imageY, willChange: "transform" }
        }
      >
        {!videoFailed && IMAGES.hero.videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover object-top"
            src={IMAGES.hero.videoUrl || undefined}
            loop muted playsInline autoPlay
            poster={IMAGES.hero.fallbackUrl}
          />
        ) : (
          <img
            src={IMAGES.hero.fallbackUrl}
            alt="Moi premium versatile top — elegant fashion collection"
            className="hero-breathe w-full h-full object-cover"
            style={{ objectPosition: "center 22%" }}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        )}
      </motion.div>

      {/* Gradient overlay — two layers for depth */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.03) 30%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.62) 100%)",
        }}
      />
      {/* Vignette: stronger darkening at bottom-center where text lives */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 110% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.42) 100%)",
        }}
      />

      {/* Hero text content — mobile: opacity fade only; desktop: parallax + fade */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-[3] flex flex-col items-center text-center"
        style={isMobileRef.current
          ? { paddingBottom: "clamp(80px, 14vw, 140px)", opacity: overlayOpacity, willChange: "opacity" }
          : { y: textY, paddingBottom: "clamp(80px, 14vw, 140px)", opacity: overlayOpacity }
        }
      >
        {/* Collection label */}
        <motion.p
          className="text-[9px] md:text-[10px] tracking-[0.55em] uppercase font-light mb-2"
          style={{ color: "rgba(255,255,255,0.70)", fontFamily: "'Montserrat', sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.25)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          Limited Drop
        </motion.p>

        {/* Brand name */}
        <motion.h1
          className="font-serif font-light"
          style={{
            color: "#fff",
            fontSize: "clamp(5.2rem, 22vw, 13rem)",
            letterSpacing: "0.03em",
            lineHeight: 0.88,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          MOI
          <span className="sr-only"> — Premium Versatile Tops & Fashion</span>
        </motion.h1>

        {/* Headline */}
        <motion.p
          className="mt-3 text-[13px] md:text-[15px] tracking-[0.12em] uppercase font-medium"
          style={{ color: "rgba(255,255,255,0.82)", fontFamily: "'Montserrat', sans-serif" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: loaded ? 1 : 0, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.5 }}
        >
          Summer Collection — Limited Drop
        </motion.p>

        {/* Subheadline */}
        <motion.p
          className="mt-2 text-[10px] md:text-[11px] tracking-[0.28em] uppercase font-light"
          style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Montserrat', sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.7 }}
        >
          New pieces just launched. Limited availability.
        </motion.p>

        {/* CTA — subtle opacity fade only, no offset/scale transforms that fight the compositor */}
        <motion.button
          type="button"
          onClick={handleShopNow}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.4 }}
          className="mt-7 inline-block border transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] hover:bg-white/15"
          style={{
            color: "#fff",
            borderColor: "rgba(255,255,255,0.48)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            backgroundColor: "rgba(255,255,255,0.07)",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "9px",
            letterSpacing: "0.45em",
            padding: "14px 36px",
            textTransform: "uppercase",
          }}
        >
          Shop Now
        </motion.button>

        {/* Urgency line */}
        <motion.p
          className="mt-3 text-[9px] tracking-[0.2em] uppercase font-light"
          style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Montserrat', sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.9 }}
        >
          Delivery in Egypt: 2–4 days
        </motion.p>
      </motion.div>

      {/* Scroll cue line */}
      <motion.div
        className="absolute z-[4]"
        style={{ bottom: 28, left: "50%", transform: "translateX(-50%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 1 }}
      >
        <motion.div
          animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
          style={{
            width: 1,
            height: 44,
            background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.6))",
            margin: "0 auto",
            transformOrigin: "top",
          }}
        />
      </motion.div>
    </section>
  );
}
