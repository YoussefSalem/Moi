import { motion } from "framer-motion";
import { ColorCard } from "@/components/ColorCard";
import { type ProductConfig } from "@/config/images";

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export interface ColorEntry {
  name: string;
}

interface ProductColorSectionProps {
  product: ProductConfig;
  sectionTitle: string;
  sectionSubtitle?: string;
  colors: ColorEntry[];
  onNavigate: (handle: string) => void;
  id?: string;
  dark?: boolean;
}

export function ProductColorSection({
  product,
  sectionTitle,
  sectionSubtitle,
  colors,
  onNavigate,
  id,
  dark = false,
}: ProductColorSectionProps) {
  const colorImages = (product.colorImages ?? {}) as unknown as Record<string, string>;
  const colorSwatches = (product.colorSwatches ?? {}) as unknown as Record<string, string>;

  const bg = dark ? "#f0ece6" : "#faf8f5";

  return (
    <section id={id} className="w-full py-16 md:py-24 px-6 md:px-12" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center mb-12 md:mb-16"
        >
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 9,
              letterSpacing: "0.44em",
              textTransform: "uppercase",
              color: "#b0a090",
              marginBottom: 10,
            }}
          >
            Collection
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(2.2rem, 7vw, 3.8rem)",
              fontWeight: 300,
              color: "#1e1814",
              letterSpacing: "0.07em",
              lineHeight: 1.05,
              marginBottom: sectionSubtitle ? 12 : 0,
            }}
          >
            {sectionTitle}
          </h2>
          {sectionSubtitle && (
            <p
              style={{
                color: "#7a6e64",
                fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
                maxWidth: 380,
                lineHeight: 1.75,
                fontWeight: 300,
              }}
            >
              {sectionSubtitle}
            </p>
          )}
          <div
            className="mt-6"
            style={{ width: 32, height: 1, backgroundColor: "rgba(180,160,140,0.55)" }}
          />
        </motion.div>

        {/* Color cards grid */}
        <div
          className="grid gap-5 md:gap-7"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 220px), 1fr))`,
          }}
        >
          {colors.map((c, i) => {
            const img = colorImages[c.name] ?? product.productShot;
            const galleries = (product.colorGalleries ?? {}) as unknown as Record<string, string[]>;
            const gallery = galleries[c.name] ?? [];
            const hoverImg = gallery[1] ?? gallery[0] ?? img;
            const swatchKey = c.name.toLowerCase();
            const swatch = colorSwatches[swatchKey];
            const handle = `${product.slug}-${slugify(c.name)}`;

            return (
              <ColorCard
                key={handle}
                productName={sectionTitle}
                colorName={c.name}
                image={img}
                hoverImage={hoverImg !== img ? hoverImg : undefined}
                price={product.price}
                handle={handle}
                swatchColor={swatch}
                onNavigate={onNavigate}
                index={i}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
