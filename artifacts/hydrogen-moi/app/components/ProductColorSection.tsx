import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ColorCard } from '~/components/ColorCard';

interface ColorEntry {
  name: string;
}

interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable?: number;
  selectedOptions: { name: string; value: string }[];
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  image: { url: string; altText: string | null } | null;
}

interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  options: { name: string; values: string[] }[];
  images: { nodes: { url: string; altText: string | null }[] };
  variants: { nodes: ProductVariant[] };
  featuredImage: { url: string; altText: string | null } | null;
}

interface ProductColorSectionProps {
  id?: string;
  productPromise: Promise<{ product: Product | null }>;
  sectionTitle: string;
  sectionSubtitle?: string;
  colors: ColorEntry[];
  background?: string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function ProductColorSection({
  id,
  productPromise,
  sectionTitle,
  sectionSubtitle,
  colors,
  background = '#ffffff',
}: ProductColorSectionProps) {
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    productPromise.then((d) => setProduct(d.product));
  }, [productPromise]);

  return (
    <section id={id} className="w-full py-32 md:py-48 px-6 md:px-16 lg:px-24" style={{ backgroundColor: background }}>
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center mb-16 md:mb-20"
        >
          <p style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 9,
            letterSpacing: '0.44em',
            textTransform: 'uppercase',
            color: '#b0a090',
            marginBottom: 10,
          }}>
            Collections
          </p>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(2.29rem, 7vw, 3.95rem)',
            fontWeight: 300,
            color: '#1e1814',
            letterSpacing: '0.07em',
            lineHeight: 1.05,
            marginBottom: sectionSubtitle ? 12 : 0,
          }}>
            {sectionTitle}
          </h2>
          {sectionSubtitle && (
            <p style={{
              color: '#7a6e64',
              fontSize: 'clamp(0.83rem, 2vw, 0.92rem)',
              maxWidth: 380,
              lineHeight: 1.75,
              fontWeight: 300,
            }}>
              {sectionSubtitle}
            </p>
          )}
          <div className="mt-6" style={{ width: 32, height: 1, backgroundColor: 'rgba(180,160,140,0.55)' }} />
        </motion.div>

        {/* Color cards */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-12 md:gap-x-14 md:gap-y-16">
          {colors.map((c, i) => {
            const handle = product
              ? `${product.handle}-${slugify(c.name)}`
              : `${id ?? ''}-${slugify(c.name)}`;

            // Get color-specific images from Shopify product
            const colorImages = product?.images?.nodes?.filter((img) =>
              img.altText?.toLowerCase().includes(c.name.toLowerCase()),
            ) ?? [];
            const allImages = product?.images?.nodes ?? [];
            const displayImages = colorImages.length > 0 ? colorImages : allImages;
            const mainImage = displayImages[0]?.url ?? '';
            const hoverImage = displayImages[1]?.url;

            // Find variant for this color
            const variant = product?.variants?.nodes?.find((v) =>
              v.selectedOptions.some(
                (o) => o.name.toLowerCase() === 'color' && o.value === c.name,
              ),
            );

            const price = variant
              ? `${Math.round(parseFloat(variant.price.amount)).toLocaleString('en-EG')} EGP`
              : '';
            const compareAtPrice = variant?.compareAtPrice
              ? `${Math.round(parseFloat(variant.compareAtPrice.amount)).toLocaleString('en-EG')} EGP`
              : undefined;
            const outOfStock = variant ? !variant.availableForSale : false;

            return (
              <div
                key={handle}
                className="flex justify-center w-[calc(50%-8px)] md:w-[calc(33.33%-38px)]"
                style={{ maxWidth: 360 }}
              >
                <ColorCard
                  productName={sectionTitle}
                  colorName={c.name}
                  image={mainImage || (variant?.image?.url ?? '')}
                  hoverImage={hoverImage}
                  gallery={displayImages.map((img) => img.url)}
                  price={price}
                  compareAtPrice={compareAtPrice}
                  handle={handle}
                  outOfStock={outOfStock}
                  variantId={variant?.id}
                  index={i}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
