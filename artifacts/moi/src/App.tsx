import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { trackShopifyPageView } from "@/lib/shopifyAnalytics";
import { captureAttribution } from "@/lib/adAttribution";
import { initAnalytics } from "@/lib/analytics";
import { AnalyticsDebug } from "@/components/AnalyticsDebug";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Toaster } from "sonner";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductColorSection } from "@/components/ProductColorSection";
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

function parsePath(): { page: PageType; productHandle: string } {
  if (typeof window === "undefined") return { page: "home", productHandle: "" };
  const pathname = window.location.pathname;
  if (pathname.startsWith("/products/")) {
    return { page: "product", productHandle: pathname.slice("/products/".length) };
  }
  if (pathname === "/accessories") return { page: "accessories", productHandle: "" };
  if (pathname === "/ambassador") return { page: "ambassador", productHandle: "" };
  const slug = pathname.slice(1) as PageType;
  if (POLICY_PAGES.includes(slug)) return { page: slug, productHandle: "" };
  return { page: "home", productHandle: "" };
}

// Colours shown on the homepage for each product line.
// product1 (moi-wavvy) → WAVVY line; product2 (moi-versa-top) → Versa Top line.
const WAVVY_COLORS  = [{ name: "Light Blue" }, { name: "Navy" }, { name: "Mint" }];
const VERSA_COLORS  = [{ name: "White" }, { name: "Cashmere" }, { name: "Beige" }, { name: "Yellow" }, { name: "Teal" }];

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

  function handleColorCardAddToCart(handle: string, _image?: string) {
    // Use Shopify-fetched products (real variant GIDs) + IMAGES.product3 fallback.
    // DO NOT shadow the outer `products` state — we need the live Shopify data.
    const allProducts: ProductConfig[] = [...products, IMAGES.product3 as ProductConfig];
    const product = allProducts.find((p) => handle.startsWith(p.slug + "-") || handle === p.slug);
    if (!product) return;
    const colorSlug = handle.startsWith(product.slug + "-")
      ? handle.slice(product.slug.length + 1)
      : "";
    const colorName = Object.keys((product.colorImages ?? {}) as Record<string, string>).find(
      (c) => c.toLowerCase().replace(/\s+/g, "-") === colorSlug,
    ) ?? "";
    const image = ((product.colorImages ?? {}) as Record<string, string>)[colorName] ?? product.productShot;
    // Find the color-specific Shopify variant; fall back to first available
    const variant = product.variants?.find((v) =>
      v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === colorName)
    );
    const variantId = variant?.id ?? product.variantId ?? handle;
    cart.addToCart({
      variantId,
      title: product.name,
      price: product.price,
      priceAmount: parseFloat(product.price.replace(/[^0-9]/g, "")) || 0,
      currencyCode: "EGP",
      image,
      size: "One Size",
      color: colorName,
    });
  }

  const [page, setPage] = useState<PageType>(() => parsePath().page);
  const [productHandle, setProductHandle] = useState<string>(() => parsePath().productHandle);

  function navigateToProduct(handle: string) {
    setPage("product");
    setProductHandle(handle);
    window.history.pushState(null, "", `/products/${handle}`);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  function navigateTo(p: PageType) {
    setPage(p);
    setProductHandle("");
    window.history.pushState(null, "", p === "home" ? "/" : `/${p}`);
  }

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const parsed = parsePath();
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
          window.history.replaceState(null, "", "/");
          return;
        }
        if (d.lineItems && d.lineItems.length > 0 && cart) {
          cart.replaceRecoveredCart(d.lineItems, d.email ?? undefined);
        }
        window.history.replaceState(null, "", "/");
      })
      .catch(() => {
        window.history.replaceState(null, "", "/");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve homepage products by stable handle/slug prefix instead of array index,
  // so the mapping doesn't break when the Shopify store grows.
  const product1 = products.find(p => p.slug === "moi-wavvy") ?? IMAGES.product1;
  const product2 = products.find(p => p.slug === "moi-versa-top") ?? IMAGES.product2;

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
  const isDark = page === "accessories" || page === "ambassador" || isProductPage;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      {/* Breadcrumb navigation for SEO */}
      <nav aria-label="Breadcrumb" className="sr-only">
        <ol>
          <li><a href="/">Home</a></li>
          {page === "accessories" && <li><a href="/accessories">Accessories</a></li>}
          {page === "ambassador" && <li><a href="/ambassador">Ambassador</a></li>}
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
              { emoji: "\u2600\uFE0F", text: "New summer drop" },
              { emoji: "\u26A1", text: "Fast delivery across Egypt" },
              { emoji: "\uD83D\uDD25", text: "Limited stock available" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5">
                <span className="text-[11px]" aria-hidden="true">{item.emoji}</span>
                <span
                  className="text-[9px] md:text-[10px] tracking-[0.18em] uppercase font-medium"
                  style={{ color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div id="collection">
            <ProductColorSection
              id={product1.slug}
              product={product1}
              sectionTitle="MOI WAVVY"
              sectionSubtitle="The ultimate throw-and-go. Light, breathable, and made for drifting."
              colors={WAVVY_COLORS}
              onNavigate={navigateToProduct}
              onAddToCart={handleColorCardAddToCart}
            />
          </div>

          <EditorialStrip />

          <ProductColorSection
            id={product2.slug}
            product={product2}
            sectionTitle="MOI VERSA TOP"
            sectionSubtitle="Effortlessly versatile. A silhouette that moves with you, in every shade of summer."
            colors={VERSA_COLORS}
            onNavigate={navigateToProduct}
            onAddToCart={handleColorCardAddToCart}
            dark
          />

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
