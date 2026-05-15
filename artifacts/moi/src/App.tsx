import { useMemo, useState, useEffect } from "react";
import { Toaster } from "sonner";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
import { ProductDivider } from "@/components/ProductDivider";
import { AccessoriesPage } from "@/components/AccessoriesPage";
import { AmbassadorPage } from "@/components/AmbassadorPage";
import { LookView } from "@/components/LookView";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutPage } from "@/components/CheckoutPage";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { AccountPage } from "@/components/AccountPage";
import { SearchDrawer } from "@/components/SearchDrawer";
import { CartProvider } from "@/context/CartContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useRestockChecker } from "@/hooks/useRestockChecker";
import { AdminPage } from "@/pages/AdminPage";

const IS_ADMIN = window.location.pathname.startsWith("/admin");

function ProductSkeleton() {
  return (
    <section className="w-full py-16 md:py-24 overflow-hidden" style={{ background: "hsl(30 15% 95%)" }}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 items-center">
        <div className="flex flex-col gap-4">
          <div className="h-5 w-36 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.08)" }} />
          <div className="h-3 w-full rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.06)" }} />
          <div className="h-3 w-4/5 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.06)" }} />
        </div>
        <div className="flex justify-center">
          <div className="w-64 h-80 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.07)" }} />
        </div>
        <div className="flex flex-col gap-4 items-center">
          <div className="h-3 w-28 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.07)" }} />
          <div className="flex gap-3">
            {[0,1,2,3].map((i) => <div key={i} className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.08)" }} />)}
          </div>
          <div className="flex gap-3 mt-2">
            {[0,1].map((i) => <div key={i} className="w-20 h-10 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.07)" }} />)}
          </div>
          <div className="h-3 w-20 rounded animate-pulse mt-2" style={{ backgroundColor: "rgba(30,24,20,0.07)" }} />
          <div className="w-48 h-12 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.1)" }} />
        </div>
      </div>
    </section>
  );
}

const FALLBACK_PRODUCTS: ProductConfig[] = [IMAGES.product1, IMAGES.product2];

// Eagerly preload every image from both products so there's zero fetch delay
// when the user switches colors or scrolls the carousel.
function useGlobalImagePreload(products: ProductConfig[]) {
  useEffect(() => {
    const urls = new Set<string>();
    for (const p of products) {
      if (p.productShot) urls.add(p.productShot);
      for (const u of Object.values(p.colorImages ?? {})) if (u) urls.add(u as string);
      for (const u of (p.filmstrip ?? [])) if (u) urls.add(u as string);
    }
    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }, [products]);
}

function AppContent() {
  const [lookProduct, setLookProduct] = useState<ProductConfig | null>(null);
  const [page, setPage] = useState<"home" | "accessories" | "ambassador">("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { products, loading } = useShopifyProducts(FALLBACK_PRODUCTS);
  useRestockChecker();
  useGlobalImagePreload(products);

  const product1 = products[0] ?? IMAGES.product1;
  const product2 = products[1] ?? IMAGES.product2;
  const allProducts = useMemo(() => products, [products]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      {/* Breadcrumb navigation for SEO */}
      <nav aria-label="Breadcrumb" className="sr-only">
        <ol>
          <li><a href="/">Home</a></li>
          {page === "accessories" && <li><a href="#accessories">Accessories</a></li>}
          {page === "ambassador" && <li><a href="#ambassador">Ambassador</a></li>}
        </ol>
      </nav>
      <Header onNavigate={setPage} onSearch={() => setSearchOpen(true)} dark={page === "accessories" || page === "ambassador"} />

      {page === "home" ? (
        <main>
          <HeroVideo />

          <div id="collection">
            {loading ? <ProductSkeleton /> : (
              <ProductCard
                product={product1}
                onLookView={setLookProduct}
              />
            )}
          </div>

          <ProductDivider />

          {loading ? <ProductSkeleton /> : (
            <ProductCard
              product={product2}
              onLookView={setLookProduct}
            />
          )}
        </main>
      ) : page === "accessories" ? (
        <div>
          <AccessoriesPage onLookView={setLookProduct} />
          <Footer />
        </div>
      ) : (
        <div>
          <AmbassadorPage />
          <Footer />
        </div>
      )}

      {page === "home" && <Footer />}

      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />
      <CartDrawer />
      <CheckoutPage />
      <CustomerAuthModal />
      <AccountPage />
      <SearchDrawer
        open={searchOpen}
        products={allProducts}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
        onSelect={(product) => {
          setLookProduct(product);
          setSearchOpen(false);
          setSearchQuery("");
          setPage("home");
        }}
      />
    </div>
  );
}

function App() {
  if (IS_ADMIN) {
    return <AdminPage />;
  }

  return (
    <CustomerProvider>
      <CartProvider>
        <AppContent />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "11px",
              letterSpacing: "0.12em",
              background: "#1e1814",
              color: "#ffffff",
              border: "none",
            },
            className: "text-white",
            descriptionClassName: "text-white",
          }}
        />
      </CartProvider>
    </CustomerProvider>
  );
}

export default App;
