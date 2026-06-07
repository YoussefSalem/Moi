import { useState, useCallback, useEffect, useMemo } from "react";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { motion } from "framer-motion";
import { Header } from "~/components/Header";
import { HeroVideo } from "~/components/HeroVideo";
import { VariantCard } from "~/components/VariantCard";
import { Carousel } from "~/components/Carousel";
import { LookView } from "~/components/LookView";
import { CartDrawer } from "~/components/CartDrawer";
import { Footer } from "~/components/Footer";
import { LoadingScreen } from "~/components/LoadingScreen";
import { WhatsAppButton } from "~/components/WhatsAppButton";
import { SearchModal } from "~/components/SearchModal";
import { NewsletterSection } from "~/components/NewsletterSection";
import { IMAGES } from "~/config/images";
import { features } from "~/config/features";
import type { ProductConfig } from "~/config/images";
import type { CartReturn } from "@shopify/hydrogen";
import { trackShopifyPageView } from "~/lib/shopifyAnalytics";

export const meta: MetaFunction = () => {
  return [
    { title: "Moi — Premium Versatile Tops & Fashion" },
    {
      name: "description",
      content:
        "Shop Moi's exclusive collection of versatile tops, elegant fashion, and curated accessories. New drops: Moi Wavvy and Moi Versa Top. Delivery across Egypt in 2–4 days.",
    },
    { property: "og:title", content: "Moi — Premium Versatile Tops & Fashion" },
    { property: "og:description", content: "Shop Moi's exclusive fashion collection." },
    { property: "og:type", content: "website" },
  ];
};

export async function loader({ context }: LoaderFunctionArgs) {
  const { cart } = context;
  const cartData = await cart.get();
  return json({ cart: cartData });
}

/** Derive unique colors that have actual purchasable variants */
function getVariantColors(product: ProductConfig): string[] {
  if (!product.variants || product.variants.length === 0) return [];
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const v of product.variants) {
    const colorOpt = v.selectedOptions.find((o) => o.name.toLowerCase() === "color");
    const color = colorOpt?.value;
    if (color && !seen.has(color)) {
      seen.add(color);
      colors.push(color);
    }
  }
  // If no color option exists, treat the whole product as one "variant"
  if (colors.length === 0) colors.push("");
  return colors;
}

function getGalleryForColor(product: ProductConfig, color: string): readonly string[] {
  if (color && product.colorGalleries) {
    const exact = product.colorGalleries[color];
    if (exact?.length) return exact;
    const key = Object.keys(product.colorGalleries).find(
      (k) => k.toLowerCase() === color.toLowerCase()
    );
    if (key && product.colorGalleries[key]?.length) return product.colorGalleries[key]!;
  }
  if (color && product.colorImages) {
    const img = product.colorImages[color] ?? product.productShot;
    return [img];
  }
  return product.filmstrip?.length ? product.filmstrip : [product.productShot];
}

interface ProductSectionProps {
  product: ProductConfig;
  onAddToCart: (variantId: string, quantity: number, title: string, color: string, size: string) => Promise<void>;
  onLookView?: (product: ProductConfig) => void;
}

function ProductSection({ product, onAddToCart, onLookView }: ProductSectionProps) {
  const colors = useMemo(() => getVariantColors(product), [product]);

  return (
    <section
      id={product.slug}
      className="w-full"
      style={{ background: "#faf8f5", paddingTop: "clamp(32px, 4vw, 56px)", paddingBottom: "clamp(32px, 4vw, 56px)" }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-10">
        {/* Section heading */}
        <motion.h2
          className="font-serif text-center mb-8 md:mb-10"
          style={{
            color: "#1e1814",
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
            letterSpacing: "0.1em",
            fontWeight: 300,
          }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {product.name}
        </motion.h2>

        {/* Variant grid — 2 cols mobile, 3 cols tablet, 4 cols desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {colors.map((color, i) => (
            <VariantCard
              key={`${product.slug}-${color || "default"}`}
              product={product}
              color={color}
              gallery={getGalleryForColor(product, color)}
              onAddToCart={onAddToCart}
              onLookView={onLookView}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Effortless · Versatile · Yours" marquee divider */
function MarqueeDivider() {
  const words = ["Effortless", "Versatile", "Yours", "Effortless", "Versatile", "Yours"];
  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: "#1e1814",
        paddingTop: "clamp(22px, 3vw, 36px)",
        paddingBottom: "clamp(22px, 3vw, 36px)",
      }}
      aria-hidden
    >
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
      >
        {[...words, ...words].map((word, i) => (
          <span
            key={i}
            className="font-serif shrink-0"
            style={{
              color: i % 3 === 1 ? "rgba(250,248,245,0.55)" : "rgba(250,248,245,0.92)",
              fontSize: "clamp(1.1rem, 2.8vw, 1.6rem)",
              letterSpacing: "0.18em",
              fontStyle: i % 3 === 1 ? "italic" : "normal",
              fontWeight: 300,
            }}
          >
            {word}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function Index() {
  const { cart } = useLoaderData<{ cart: CartReturn | null }>();
  const fetcher = useFetcher();

  const [heroReady, setHeroReady] = useState(false);
  const [lookViewProduct, setLookViewProduct] = useState<ProductConfig | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const onHeroReady = useCallback(() => setHeroReady(true), []);

  const handleAddToCart = useCallback(
    async (merchandiseId: string, quantity: number, _title: string, _color: string, _size: string) => {
      fetcher.submit(
        { merchandiseId, quantity: String(quantity), action: "add" },
        { method: "post", action: "/api/cart" },
      );
    },
    [fetcher],
  );

  useEffect(() => {
    trackShopifyPageView();
  }, []);

  const currentCart = (fetcher.data as { cart?: CartReturn } | undefined)?.cart ?? cart;

  const product1 = IMAGES.product1 as unknown as ProductConfig;
  const product2 = IMAGES.product2 as unknown as ProductConfig;

  return (
    <>
      <LoadingScreen ready={heroReady} />
      <Header
        itemCount={currentCart?.totalQuantity ?? 0}
        onOpenCart={() => setCartOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />

      <main>
        <HeroVideo onReady={onHeroReady} />

        <ProductSection
          product={product1}
          onAddToCart={handleAddToCart}
          onLookView={setLookViewProduct}
        />

        <MarqueeDivider />

        <ProductSection
          product={product2}
          onAddToCart={handleAddToCart}
          onLookView={setLookViewProduct}
        />

        <Carousel />

        {features.ENABLE_NEWSLETTER && <NewsletterSection />}
      </main>

      <Footer />

      <LookView product={lookViewProduct} onClose={() => setLookViewProduct(null)} />

      <CartDrawer
        cart={currentCart as CartReturn | null}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {features.ENABLE_WHATSAPP_BUTTON && <WhatsAppButton />}
    </>
  );
}
