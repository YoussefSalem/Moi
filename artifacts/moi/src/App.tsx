import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { trackShopifyPageView } from "@/lib/shopifyAnalytics";
import { captureAttribution } from "@/lib/adAttribution";
import { initAnalytics } from "@/lib/analytics";
import { AnalyticsDebug } from "@/components/AnalyticsDebug";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Toaster } from "sonner";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
import { EditorialStrip } from "@/components/EditorialStrip";
import { LookView } from "@/components/LookView";
import { CartProvider, useCart } from "@/context/CartContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useRestockChecker } from "@/hooks/useRestockChecker";

// Heavy components — loaded only when needed
const AccessoriesPage = lazy(() => import("@/components/AccessoriesPage").then(m => ({ default: m.AccessoriesPage })));
const AmbassadorPage = lazy(() => import("@/components/AmbassadorPage").then(m => ({ default: m.AmbassadorPage })));
const LimitedDrop = lazy(() => import("@/components/LimitedDrop").then(m => ({ default: m.LimitedDrop })));
const TikTokSocialProof = lazy(() => import("@/components/TikTokSocialProof").then(m => ({ default: m.TikTokSocialProof })));
const PolicyPage = lazy(() => import("@/components/PolicyPage").then(m => ({ default: m.PolicyPage })));
const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const CartDrawer = lazy(() => import("@/components/CartDrawer").then(m => ({ default: m.CartDrawer })));
const CheckoutPage = lazy(() => import("@/components/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const CustomerAuthModal = lazy(() => import("@/components/CustomerAuthModal").then(m => ({ default: m.CustomerAuthModal })));
const AccountPage = lazy(() => import("@/components/AccountPage").then(m => ({ default: m.AccountPage })));
const SearchDrawer = lazy(() => import("@/components/SearchDrawer").then(m => ({ default: m.SearchDrawer })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const ProductPage = lazy(() => import("@/pages/ProductPage").then(m => ({ default: m.ProductPage })));

const IS_ADMIN = window.location.pathname.startsWith("/admin");

type PageType = "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery" | "product";
const POLICY_PAGES: PageType[] = ["privacy", "refund", "return", "delivery"];

function parseHash(): { page: PageType; productHandle: string } {
  if (typeof window === "undefined") return { page: "home", productHandle: "" };
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("products/")) {
    return { page: "product", productHandle: hash.slice("products/".length) };
  }
  if (hash === "accessories" || hash === "ambassador") return { page: hash, productHandle: "" };
  if (POLICY_PAGES.includes(hash as PageType)) return { page: hash as PageType, productHandle: "" };
  return { page: "home", productHandle: "" };
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroReady, setHeroReady] = useState(false);
  const handleHeroReady = useMemo(() => () => setHeroReady(true), []);
  const { products, loading } = useShopifyProducts(FALLBACK_PRODUCTS);
  useRestockChecker();
  const cart = useCart();

  const [page, setPage] = useState<PageType>(() => parseHash().page);
  const [productHandle, setProductHandle] = useState<string>(() => parseHash().productHandle);

  function navigateToProduct(handle: string) {
    setPage("product");
    setProductHandle(handle);
    window.history.pushState(null, "", window.location.pathname + `#products/${handle}`);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  function navigateTo(p: PageType) {
    setPage(p);
    setProductHandle("");
    if (p === "home") {
      window.history.pushState(null, "", window.location.pathname);
    } else {
      window.history.pushState(null, "", window.location.pathname + `#${p}`);
    }
  }

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const parsed = parseHash();
      setPage(parsed.page);
      setProductHandle(parsed.productHandle);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Handle abandoned-cart recovery links (?recover-cart=TOKEN)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("recover-cart");
    if (!token) return;

    fetch(`/api/abandoned-carts/recover?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { recovered?: boolean; email?: string; cartId?: string; lineItems?: Array<{ title: string; variant?: string; quantity: number; price: string; imageUrl?: string; variantId?: string }>; totalAmount?: string };
        if (d.recovered) {
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
        if (d.lineItems && d.lineItems.length > 0 && cart) {
          cart.replaceRecoveredCart(d.lineItems, d.email ?? undefined);
        }
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(() => {
        window.history.replaceState(null, "", window.location.pathname);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const product1 = products[0] ?? IMAGES.product1;
  const product2 = products[1] ?? IMAGES.product2;

  useEffect(() => {
    if (page === "home") {
      const hash = window.location.hash.slice(1);
      if (!hash || hash.startsWith("products/")) return;
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
    }
  }, [page, loading, product1.slug, product2.slug]);

  // Shopify Analytics: page_viewed fires on mount and on every in-app navigation
  useEffect(() => {
    captureAttribution();
    initAnalytics();
    trackShopifyPageView();
    if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname + window.location.hash,
      });
    }
  }, [page, productHandle]);

  const isProductPage = page === "product" && Boolean(productHandle);
  const isDark = page === "accessories" || page === "ambassador";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      {/* Breadcrumb navigation for SEO */}
      <nav aria-label="Breadcrumb" className="sr-only">
        <ol>
          <li><a href="/">Home</a></li>
          {page === "accessories" && <li><a href="#accessories">Accessories</a></li>}
          {page === "ambassador" && <li><a href="#ambassador">Ambassador</a></li>}
          {isProductPage && <li><span>{productHandle}</span></li>}
        </ol>
      </nav>
      <Header onNavigate={(p) => navigateTo(p as PageType)} onSearch={() => setSearchOpen(true)} dark={isDark} />

      {isProductPage ? (
        <Suspense fallback={<div style={{ minHeight: "80vh", background: "#faf8f5" }} />}>
          <ProductPage handle={productHandle} onBack={() => navigateTo("home")} />
          <Footer onNavigate={(p) => navigateTo(p as PageType)} />
        </Suspense>
      ) : page === "home" ? (
        <main>
          <HeroVideo onReady={handleHeroReady} />

          {/* Trust bar — 3 conversion points, minimal style */}
          <div
            className="w-full flex items-center justify-center gap-4 md:gap-8 py-4 px-4"
            style={{ backgroundColor: "#faf8f5" }}
          >
            {[
              { emoji: "\u2744\uFE0F", text: "New summer drop" },
              { emoji: "\u26A1", text: "Fast delivery across Egypt" },
              { emoji: "\uD83D\uDD25", text: "Limited stock available" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5">
                <span className="text-[11px]" aria-hidden="true">{item.emoji}</span>
                <span
                  className="text-[9px] md:text-[10px] tracking-[0.18em] uppercase font-light"
                  style={{ color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div id="collection">
            <div id={product1.slug}>
              {loading ? <ProductSkeleton /> : (
                <ProductCard
                  product={product1}
                  onLookView={setLookProduct}
                  onNavigateToProduct={navigateToProduct}
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
                onNavigateToProduct={navigateToProduct}
              />
            </div>
          )}

          {/* Section end divider */}
          <div className="w-full py-4 md:py-6 px-6 md:px-12">
            <svg className="w-full" height="16" viewBox="0 0 1200 16" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0 8 Q75 0 150 8 T300 8 T450 8 T600 8 T750 8 T900 8 T1050 8 T1200 8"
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
            <Footer onNavigate={(p) => navigateTo(p as PageType)} />
          </Suspense>
        </div>
      ) : page === "ambassador" ? (
        <div>
          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
            <AmbassadorPage />
            <Footer onNavigate={(p) => navigateTo(p as PageType)} />
          </Suspense>
        </div>
      ) : (
        <Suspense fallback={<div style={{ minHeight: "60vh", background: "#faf8f5" }} />}>
          <PolicyPage policy={page as "privacy" | "refund" | "return" | "delivery"} onClose={() => navigateTo("home")} />
        </Suspense>
      )}

      {page === "home" && (
        <Suspense fallback={null}>
          <Footer onNavigate={(p) => navigateTo(p as PageType)} />
        </Suspense>
      )}

      <LoadingScreen ready={page !== "home" ? !loading : heroReady && !loading} />
      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />

      <WhatsAppButton />

      <Suspense fallback={null}>
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
            navigateTo("home");
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
        {typeof window !== "undefined" && window.location.href.includes("debug_analytics") && <AnalyticsDebug />}
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
