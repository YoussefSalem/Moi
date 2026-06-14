import { memo } from "react";
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
  onAddToCart?: (handle: string, currentImage: string) => void;
  id?: string;
  dark?: boolean;
  description?: string;
}

export const ProductColorSection = memo(function ProductColorSection({
  product,
  sectionTitle,
  sectionSubtitle,
  colors,
  onNavigate,
  onAddToCart,
  id,
  dark = false,
  description,
}: ProductColorSectionProps) {
  const colorImages = (product.colorImages ?? {}) as unknown as Record<string, string>;
  const colorSwatches = (product.colorSwatches ?? {}) as unknown as Record<string, string>;

  const bg = dark ? "#f0ece6" : "#ffffff";

  return (
    <section id={id} className="w-full py-16 md:py-24 px-6 md:px-16 lg:px-24" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center mb-10 md:mb-12"
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
            Collections
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "clamp(2.29rem, 7vw, 3.95rem)",
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
                fontSize: "clamp(0.83rem, 2vw, 0.92rem)",
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

        {/* Color cards — flex-wrap so last row always centers naturally */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {colors.map((c, i) => {
            const img = colorImages[c.name] ?? product.productShot;
            const galleries = (product.colorGalleries ?? {}) as unknown as Record<string, string[]>;
            const gallery = galleries[c.name] ?? [];
            const hoverImg = gallery[1] ?? gallery[0] ?? img;
            const swatchKey = c.name.toLowerCase();
            const swatch = colorSwatches[swatchKey];
            const handle = `${product.slug}-${slugify(c.name)}`;
            // Find the Shopify variant for this specific color (case-insensitive)
            const cNameLower = c.name.toLowerCase();
            const variant = product.variants?.find((v) =>
              v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === cNameLower)
            );
            const hasVariants = product.variants !== undefined && product.variants.length > 0;
            const outOfStock = hasVariants ? (variant !== undefined ? !variant.availableForSale : true) : false;

            return (
              <div
                key={handle}
                className="flex justify-center w-[calc(50%-8px)] md:w-[calc(33.33%-16px)]"
                style={{ maxWidth: 360 }}
              >
                <ColorCard
                  productName={sectionTitle}
                  colorName={c.name}
                  image={img}
                  hoverImage={hoverImg !== img ? hoverImg : undefined}
                  gallery={gallery.length > 0 ? gallery : undefined}
                  price={variant?.price ?? product.price}
                  compareAtPrice={variant?.compareAtPrice}
                  handle={handle}
                  swatchColor={swatch}
                  description={description ?? (product as unknown as Record<string, string>).description}
                  outOfStock={outOfStock}
                  onNavigate={onNavigate}
                  onAddToCart={onAddToCart}
                  index={i}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
