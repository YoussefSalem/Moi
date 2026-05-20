import { useRef, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CinematicLightbox } from "@/components/CinematicLightbox";
import { IMAGES } from "@/config/images";

/* Build a deduplicated flat array of every unique product image. */
function allUniqueProductImages(): readonly string[] {
  const seen = new Set<string>();
  const add = (src: string) => { if (src && !seen.has(src)) seen.add(src); };

  // Hero
  add(IMAGES.hero.fallbackUrl);

  // All color galleries from every product (dedupes mains + alts automatically)
  for (const key of ["product1", "product2", "product3"] as const) {
    const p = IMAGES[key] as { colorGalleries?: Record<string, readonly string[]> };
    if (!p.colorGalleries) continue;
    for (const gallery of Object.values(p.colorGalleries)) {
      for (const src of gallery) add(src);
    }
  }

  // Brand/editorial look photos
  for (const key of ["product1", "product2", "product3"] as const) {
    const p = IMAGES[key] as { look?: Record<string, string> };
    if (!p.look) continue;
    for (const src of Object.values(p.look)) add(src);
  }

  // Filmstrip images (product1 + product2, already deduped by Set)
  for (const key of ["product1", "product2", "product3"] as const) {
    const p = IMAGES[key] as { filmstrip?: readonly string[] };
    if (!p.filmstrip) continue;
    for (const src of p.filmstrip) add(src);
  }

  return Array.from(seen);
}

const COLLECTION_IMAGES = allUniqueProductImages();

export function EditorialPhotoStrip() {
  const ref = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  const openAt = useCallback((i: number) => {
    setLbIndex(i);
    setLbOpen(true);
  }, []);

  const scrollBy = useCallback((dir: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const card = strip.firstElementChild as HTMLElement | null;
    const gap = 12;
    const step = (card?.offsetWidth ?? 300) + gap;
    strip.scrollTo({ left: strip.scrollLeft + dir * step, behavior: "smooth" });
  }, []);

  return (
    <section
      ref={ref}
      data-strip
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "hsl(30 15% 95%)",
        paddingTop: "clamp(40px, 7vw, 80px)",
        paddingBottom: "clamp(48px, 8vw, 96px)",
      }}
    >
      {/* Label */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="text-center text-[9px] tracking-[0.55em] uppercase mb-8"
        style={{ color: "rgba(120,108,96,0.6)", fontFamily: "'Montserrat', sans-serif" }}
      >
        The Collection
      </motion.p>

      {/* Scrollable strip with arrow nav (desktop) */}
      <div className="relative flex items-center">
        {/* Left arrow */}
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="hidden md:flex z-10 shrink-0 items-center justify-center"
          style={{
            width: 40,
            height: 40,
            marginLeft: 16,
            borderRadius: "50%",
            backgroundColor: "rgba(250,248,245,0.92)",
            border: "1px solid rgba(30,24,20,0.08)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            cursor: "pointer",
            color: "rgba(30,24,20,0.45)",
            transition: "color 0.25s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.85)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.45)")}
        >
          <ChevronLeft size={18} strokeWidth={1.3} />
        </button>

        <div
          ref={stripRef}
          className="flex gap-3 overflow-x-auto flex-1"
          style={{
            paddingLeft: "clamp(20px, 6vw, 80px)",
            paddingRight: "clamp(20px, 6vw, 80px)",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            touchAction: "pan-x",
            cursor: "grab",
          }}
        >
        <style>{`section[data-strip]::-webkit-scrollbar { display: none; }`}</style>
        {COLLECTION_IMAGES.map((src, i) => (
          <motion.button
            key={src}
            type="button"
            aria-label={`Open image ${i + 1}`}
            onClick={() => openAt(i)}
            className="flex-shrink-0 overflow-hidden"
            style={{
              width: "clamp(200px, 28vw, 340px)",
              scrollSnapAlign: "start",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.85,
              ease: [0.22, 1, 0.36, 1],
              delay: i * 0.05,
            }}
          >
            <div
              className="relative w-full overflow-hidden"
              style={{ height: "clamp(280px, 44vw, 520px)" }}
            >
              <motion.img
                src={src}
                alt={`Moi collection image ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-top"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                draggable={false}
              />
            </div>
          </motion.button>
        ))}
        </div>

        {/* Right arrow */}
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="hidden md:flex z-10 shrink-0 items-center justify-center"
          style={{
            width: 40,
            height: 40,
            marginRight: 16,
            borderRadius: "50%",
            backgroundColor: "rgba(250,248,245,0.92)",
            border: "1px solid rgba(30,24,20,0.08)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            cursor: "pointer",
            color: "rgba(30,24,20,0.45)",
            transition: "color 0.25s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.85)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.45)")}
        >
          <ChevronRight size={18} strokeWidth={1.3} />
        </button>
      </div>

      {/* Bottom brand note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 0.55 }}
        className="text-center mt-8 text-[9px] tracking-[0.35em] uppercase"
        style={{ color: "rgba(120,108,96,0.42)", fontFamily: "'Montserrat', sans-serif" }}
      >
        Height of model: 178 cm — Size S
      </motion.p>

      <CinematicLightbox
        images={COLLECTION_IMAGES}
        initialIndex={lbIndex}
        open={lbOpen}
        onClose={() => setLbOpen(false)}
      />
    </section>
  );
}
