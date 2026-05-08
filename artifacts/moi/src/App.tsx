import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
import { ProductDivider } from "@/components/ProductDivider";
import { AccessoriesPage } from "@/components/AccessoriesPage";
import { LookView } from "@/components/LookView";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { CartProvider } from "@/context/CartContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { Instagram, Music2 } from "lucide-react";

const FALLBACK_PRODUCTS: ProductConfig[] = [IMAGES.product1, IMAGES.product2];

function AppContent() {
  const [lookProduct, setLookProduct] = useState<ProductConfig | null>(null);
  const [page, setPage] = useState<"home" | "accessories">("home");
  const { products } = useShopifyProducts(FALLBACK_PRODUCTS);

  const product1 = products[0] ?? IMAGES.product1;
  const product2 = products[1] ?? IMAGES.product2;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      <Header onNavigate={setPage} dark={page === "accessories"} />

      {page === "home" ? (
        <main>
          <HeroVideo />

          <div id="collection">
            <ProductCard
              product={product1}
              onLookView={setLookProduct}
            />
          </div>

          <ProductDivider />

          <ProductCard
            product={product2}
            onLookView={setLookProduct}
          />

          <section className="py-16 md:py-24 px-6">
            <div className="max-w-3xl mx-auto flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-4">
                <div className="h-px w-12 bg-[rgba(30,24,20,0.2)]" />
                <p
                  className="text-[10px] md:text-[11px] tracking-[0.35em] uppercase"
                  style={{ color: "#7a6e64" }}
                >
                  Follow Moi
                </p>
                <div className="h-px w-12 bg-[rgba(30,24,20,0.2)]" />
              </div>
              <div className="flex items-center justify-center gap-5">
                <a
                  href="https://www.instagram.com/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="inline-flex items-center gap-2 text-sm tracking-[0.22em] uppercase hover:opacity-60 transition-opacity"
                  style={{ color: "#1e1814" }}
                >
                  <Instagram size={18} strokeWidth={1.7} />
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  className="inline-flex items-center gap-2 text-sm tracking-[0.22em] uppercase hover:opacity-60 transition-opacity"
                  style={{ color: "#1e1814" }}
                >
                  <Music2 size={18} strokeWidth={1.7} />
                  TikTok
                </a>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <div>
          <AccessoriesPage />
          <Footer />
        </div>
      )}

      {page === "home" && <Footer />}

      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />
      <CartDrawer />
      <CustomerAuthModal />
    </div>
  );
}

function App() {
  return (
    <CustomerProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </CustomerProvider>
  );
}

export default App;
