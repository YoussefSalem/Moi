import { useState, useCallback } from "react";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Header } from "~/components/Header";
import { ProductCard } from "~/components/ProductCard";
import { CartDrawer } from "~/components/CartDrawer";
import { Footer } from "~/components/Footer";
import { WhatsAppButton } from "~/components/WhatsAppButton";
import { SearchModal } from "~/components/SearchModal";
import { IMAGES } from "~/config/images";
import { features } from "~/config/features";
import type { ProductConfig } from "~/config/images";
import type { CartReturn } from "@shopify/hydrogen";

export const meta: MetaFunction = () => [
  { title: "Accessories — Moi" },
  { name: "description", content: "Curated accessories from Moi. Elegant bangles and jewellery to complement every look." },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const { cart } = context;
  const cartData = await cart.get();
  return json({ cart: cartData });
}

export default function Accessories() {
  const { cart } = useLoaderData<{ cart: CartReturn | null }>();
  const fetcher = useFetcher();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleAddToCart = useCallback(
    async (merchandiseId: string, quantity: number) => {
      fetcher.submit(
        { merchandiseId, quantity: String(quantity), action: "add" },
        { method: "post", action: "/api/cart" },
      );
    },
    [fetcher],
  );

  const currentCart = (fetcher.data as { cart?: CartReturn } | undefined)?.cart ?? cart;

  return (
    <>
      <Header
        itemCount={currentCart?.totalQuantity ?? 0}
        onOpenCart={() => setCartOpen(true)}
        onSearch={() => setSearchOpen(true)}
        dark
      />

      <main className="pt-20">
        <section className="px-6 md:px-12 py-14 text-center" style={{ backgroundColor: "#faf8f5" }}>
          <p className="text-[9px] tracking-[0.45em] uppercase mb-3" style={{ color: "#7a6e64" }}>Curated Accessories</p>
          <h1 className="font-serif font-light" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", color: "#1e1814", letterSpacing: "0.06em" }}>
            Accessories
          </h1>
          <p className="mt-4 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: "rgba(30,24,20,0.6)" }}>
            Elegant pieces to elevate every look. Crafted to accompany you.
          </p>
        </section>

        <ProductCard
          product={IMAGES.product3 as unknown as ProductConfig}
          onAddToCart={handleAddToCart}
        />
      </main>

      <Footer />

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
