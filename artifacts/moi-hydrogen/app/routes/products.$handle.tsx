import { useState, useCallback } from "react";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { CartDrawer } from "~/components/CartDrawer";
import { WhatsAppButton } from "~/components/WhatsAppButton";
import { SearchModal } from "~/components/SearchModal";
import { ProductCard } from "~/components/ProductCard";
import { IMAGES } from "~/config/images";
import { features } from "~/config/features";
import type { ProductConfig } from "~/config/images";
import type { CartReturn } from "@shopify/hydrogen";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Product — Moi" }];
  return [
    { title: `${data.staticProduct?.name ?? "Product"} — Moi` },
    { name: "description", content: data.staticProduct?.description ?? "Premium fashion from Moi." },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { handle } = params;
  const { cart } = context;

  const cartData = await cart.get();

  const allProducts: ProductConfig[] = [
    IMAGES.product1 as unknown as ProductConfig,
    IMAGES.product2 as unknown as ProductConfig,
    IMAGES.product3 as unknown as ProductConfig,
  ];
  const staticProduct = allProducts.find((p) => p.slug === handle) ?? null;

  return json({ handle, cart: cartData, staticProduct });
}

export default function Product() {
  const { cart, staticProduct } = useLoaderData<typeof loader>();
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

  if (!staticProduct) {
    return (
      <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header
          itemCount={currentCart?.totalQuantity ?? 0}
          onOpenCart={() => setCartOpen(true)}
          onSearch={() => setSearchOpen(true)}
          dark
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="font-serif text-3xl mb-4" style={{ color: "#1e1814" }}>Product not found</p>
            <a href="/" className="text-[10px] tracking-[0.25em] uppercase underline" style={{ color: "#7a6e64" }}>
              Back to Shop
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <div className="pt-16" style={{ backgroundColor: "#faf8f5" }}>
        <Header
          itemCount={currentCart?.totalQuantity ?? 0}
          onOpenCart={() => setCartOpen(true)}
          onSearch={() => setSearchOpen(true)}
          dark
        />

        <main>
          <ProductCard
            product={staticProduct}
            onAddToCart={handleAddToCart}
          />
        </main>

        <Footer />
      </div>

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
