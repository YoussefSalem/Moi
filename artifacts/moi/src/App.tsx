import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
import { ProductDivider } from "@/components/ProductDivider";
import { EditorialStrip } from "@/components/EditorialStrip";
import { CartProvider } from "@/context/CartContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useRestockChecker } from "@/hooks/useRestockChecker";

// Heavy components — loaded only when needed
const AccessoriesPage = lazy(() => import("@/components/AccessoriesPage").then(m => ({ default: m.AccessoriesPage })));
const AmbassadorPage = lazy(() => import("@/components/AmbassadorPage").then(m => ({ default: m.AmbassadorPage })));
const LimitedDrop = lazy(() => import("@/components/LimitedDrop").then(m => ({ default: m.LimitedDrop })));
const TikTokSocialProof = lazy(() => import("@/components/TikTokSocialProof").then(m => ({ default: m.TikTokSocialProof })));
const PolicyPage = lazy(() => import("@/components/PolicyPage").then(m => ({ default: m.PolicyPage })));
const LookView = lazy(() => import("@/components/LookView").then(m => ({ default: m.LookView })));
const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const CartDrawer = lazy(() => import("@/components/CartDrawer").then(m => ({ default: m.CartDrawer })));
const CheckoutPage = lazy(() => import("@/components/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const CustomerAuthModal = lazy(() => import("@/components/CustomerAuthModal").then(m => ({ default: m.CustomerAuthModal })));
const AccountPage = lazy(() => import("@/components/AccountPage").then(m => ({ default: m.AccountPage })));
const SearchDrawer = lazy(() => import("@/components/SearchDrawer").then(m => ({ default: m.SearchDrawer })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));

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


function AppContent() {
  const [lookProduct, setLookProduct] = useState<ProductConfig | null>(null);
  function getInitialPage(): "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery" {
    if (typeof window === "undefined") return "home";
    const hash = window.location.hash.slice(1);
    if (hash === "accessories" || hash === "ambassador") return hash;
    if (["privacy", "refund", "return", "delivery"].includes(hash)) return hash as "privacy" | "refund" | "return" | "delivery";
    return "home";
  }

  const [page, setPage] = useState<"home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery">(getInitialPage);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { products, loading } = useShopifyProducts(FALLBACK_PRODUCTS);
  useRestockChecker();

  const product1 = products[0] ?? IMAGES.product1;
  const product2 = products[1] ?? IMAGES.product2;

  useEffect(() => {
    if (page === "home") {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
    }
  }, [page, loading, product1.slug, product2.slug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (page === "home") {
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    } else {
      window.location.hash = page;
    }
  }, [page]);

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
            <div id={product1.slug}>
              {loading ? <ProductSkeleton /> : (
                <ProductCard
                  product={product1}
                  onLookView={setLookProduct}
                />
              )}
            </div>
          </div>

          <EditorialStrip />

          {loading ? <ProductSkeleton /> : (
            <div id={product2.slug}>
              <ProductCard
                product={product2}
                onLookView={setLookProduct}
              />
            </div>
          )}

          {/* Section end divider */}
          <div className="w-full flex justify-center py-4 md:py-6">
            <svg className="w-40 md:w-56" height="16" viewBox="0 0 160 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0 8 Q20 0 40 8 T80 8 T120 8 T160 8"
                stroke="rgba(180,160,140,0.45)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <Suspense fallback={null}>
            <TikTokSocialProof />
          </Suspense>

        </main>
      ) : page === "accessories" ? (
        <div>
          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
            <AccessoriesPage onLookView={setLookProduct} />
            <Footer onNavigate={setPage} />
          </Suspense>
        </div>
      ) : page === "ambassador" ? (
        <div>
          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
            <AmbassadorPage />
            <Footer onNavigate={setPage} />
          </Suspense>
        </div>
      ) : (
        <Suspense fallback={<div style={{ minHeight: "60vh", background: "#faf8f5" }} />}>
          <PolicyPage policy={page} onClose={() => setPage("home")} />
        </Suspense>
      )}

      {page === "home" && (
        <Suspense fallback={null}>
          <Footer onNavigate={setPage} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <LookView product={lookProduct} onClose={() => setLookProduct(null)} />
        <CartDrawer />
        <CheckoutPage />
        <CustomerAuthModal />
        <AccountPage />
        <SearchDrawer
          open={searchOpen}
          products={products}
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
      </Suspense>
    </div>
  );
}

function App() {
  if (IS_ADMIN) {
    return (
      <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf8f5" }} />}>
        <AdminPage />
      </Suspense>
    );
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
