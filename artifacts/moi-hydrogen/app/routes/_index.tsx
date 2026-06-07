import { useState, useCallback, useEffect } from "react";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Header } from "~/components/Header";
import { HeroVideo } from "~/components/HeroVideo";
import { ProductCard } from "~/components/ProductCard";
import { Carousel } from "~/components/Carousel";
import { LookView } from "~/components/LookView";
import { CartDrawer } from "~/components/CartDrawer";
import { Footer } from "~/components/Footer";
import { LoadingScreen } from "~/components/LoadingScreen";
import { WhatsAppButton } from "~/components/WhatsAppButton";
import { SearchModal } from "~/components/SearchModal";
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

export default function Index() {
  const { cart } = useLoaderData<{ cart: CartReturn | null }>();
  const fetcher = useFetcher();

  const [heroReady, setHeroReady] = useState(false);
  const [lookViewProduct, setLookViewProduct] = useState<ProductConfig | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const onHeroReady = useCallback(() => setHeroReady(true), []);

  const handleAddToCart = useCallback(
    async (merchandiseId: string, quantity: number, title: string, color: string, size: string) => {
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

  const itemCount = cart?.totalQuantity ?? 0;
  const currentCart = (fetcher.data as { cart?: CartReturn } | undefined)?.cart ?? cart;

  return (
    <>
      <LoadingScreen ready={heroReady} />
      <Header
        itemCount={currentCart?.totalQuantity ?? itemCount}
        onOpenCart={() => setCartOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />

      <main>
        <HeroVideo onReady={onHeroReady} />

        <ProductCard
          product={IMAGES.product1 as unknown as ProductConfig}
          onLookView={setLookViewProduct}
          onAddToCart={handleAddToCart}
        />

        <Carousel />

        <ProductCard
          product={IMAGES.product2 as unknown as ProductConfig}
          onLookView={setLookViewProduct}
          onAddToCart={handleAddToCart}
        />
      </main>

      <Footer />

      <LookView
        product={lookViewProduct}
        onClose={() => setLookViewProduct(null)}
      />

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
