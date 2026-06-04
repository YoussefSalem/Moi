import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackShopifyPageView } from "@/lib/shopifyAnalytics";
import { parseEGP } from "@/lib/price";
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
const TikTokSocialProof = lazy(() => import("@/components/TikTokSocialProof").then(m => ({ default: m.TikTokSocialProof })));
const PolicyPage = lazy(() => import("@/components/PolicyPage").then(m => ({ default: m.PolicyPage })));
const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const CartDrawer = lazy(() => import("@/components/CartDrawer").then(m => ({ default: m.CartDrawer })));
const CheckoutPage = lazy(() => import("@/components/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const CustomerAuthModal = lazy(() => import("@/components/CustomerAuthModal").then(m => ({ default: m.CustomerAuthModal })));
const AccountPage = lazy(() => import("@/components/AccountPage").then(m => ({ default: m.AccountPage })));
const SearchDrawer = lazy(() => import("@/components/SearchDrawer").then(m => ({ default: m.SearchDrawer })));
import type { SearchItem } from "@/components/SearchDrawer";
import { ProductPage } from "@/pages/ProductPage";
import { ApplePayIframePage } from "@/pages/ApplePayIframePage";
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => import("@/components/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

const IS_ADMIN = window.location.pathname.startsWith("/admin");
const IS_APPLE_PAY_IFRAME = window.location.pathname === "/buy/apple-pay";

type PageType = "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery" | "product" | "notfound" | "checkout";
const POLICY_PAGES: PageType[] = ["privacy", "refund", "return", "delivery"];

const VALID_PRODUCTS: Record<string, string[] | null> = {
  "moi-wavvy": ["light-blue", "navy", "mint"],
  "moi-versa-top": ["white", "cashmere", "beige", "yellow", "teal"],
  "trio-bangles": null,
};

const SECTION_PATH_MAP: Record<string, string> = {
  "/versa-top": "moi-versa-top",
  "/wavvy-top": "moi-wavvy",
};

function parsePath(): { page: PageType; productHandle: string; section?: string } {
  if (typeof window === "undefined") return { page: "home", productHandle: "" };
  const pathname = window.location.pathname;
  if (pathname.startsWith("/products/")) {
    const handle = pathname.slice("/products/".length);
    const matchedProduct = Object.keys(VALID_PRODUCTS).find(
      (p) => handle === p || handle.startsWith(p + "-"),
    );
    if (!matchedProduct) return { page: "notfound", productHandle: handle };
    const validColors = VALID_PRODUCTS[matchedProduct];
    if (validColors === null) return { page: "product", productHandle: handle }; // trio-bangles has no color variants
    const colorSlug = handle.slice(matchedProduct.length + 1);
    if (!colorSlug || validColors.includes(colorSlug)) return { page: "product", productHandle: handle };
    return { page: "notfound", productHandle: handle };
  }
  if (pathname === "/checkout") return { page: "checkout", productHandle: "" };
  if (pathname === "/accessories") return { page: "accessories", productHandle: "" };
  if (pathname === "/ambassador") return { page: "ambassador", productHandle: "" };
  const sectionId = SECTION_PATH_MAP[pathname];
  if (sectionId) return { page: "home", productHandle: "", section: sectionId };
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
      price: variant?.price ?? product.price,
      priceAmount: parseEGP(variant?.price ?? product.price) || 0,
      compareAtPrice: variant?.compareAtPrice,
      currencyCode: "EGP",
      image,
      size: "One Size",
      color: colorName,
    });
  }

  const [page, setPage] = useState<PageType>(() => parsePath().page);
  const [productHandle, setProductHandle] = useState<string>(() => parsePath().productHandle);
  const [scrollTarget, setScrollTarget] = useState<string>(() => parsePath().section ?? "");

  function navigateToProduct(handle: string) {
    setPage("product");
    setProductHandle(handle);
    window.history.pushState(null, "", `/products/${handle}`);
  }

  function navigateTo(p: PageType, hash?: string) {
    setPage(p);
    setProductHandle("");
    setScrollTarget(hash ?? "");
    if (p === "home" && hash) {
      window.history.pushState(null, "", `/`);
    } else {
      window.history.pushState(null, "", p === "home" ? "/" : `/${p}`);
    }
  }

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const parsed = parsePath();
      setPage(parsed.page);
      setProductHandle(parsed.productHandle);
      setScrollTarget(parsed.section ?? "");
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
  // Intentionally omit deps: this effect must run once on mount only to process
  // the ?recover-cart= token from the URL, then clear it. Adding deps would re-run
  // and potentially re-process the (already consumed) token on every state change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve homepage products by stable handle/slug prefix instead of array index,
  // so the mapping doesn't break when the Shopify store grows.
  const product1 = products.find(p => p.slug === "moi-wavvy") ?? IMAGES.product1;
  const product2 = products.find(p => p.slug === "moi-versa-top") ?? IMAGES.product2;
  const product3 = IMAGES.product3 as ProductConfig;

  // Build search items: one entry per color variant, plus accessories
  const searchItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];

    const allProducts: ProductConfig[] = [product1, product2, product3];
    for (const product of allProducts) {
      if (product.slug === "trio-bangles") {
        items.push({
          id: product.slug,
          name: product.name,
          handle: product.slug,
          image: product.productShot,
          price: product.price,
          product,
        });
        continue;
      }

      const colorImages = product.colorImages as Record<string, string> | undefined;
      const validColors = VALID_PRODUCTS[product.slug];
      if (!validColors) continue;

      // For each valid color slug, generate a variant search item
      for (const colorSlug of validColors) {
        const colorName = colorSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const handle = `${product.slug}-${colorSlug}`;
        const colorImage = colorImages?.[colorName] ?? product.productShot;
        const variant = product.variants?.find((v) =>
          v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === colorName)
        );
        const price = variant?.price ?? product.price;
        const sizeOption = variant?.selectedOptions.find((o) => o.name.toLowerCase() === "size");
        const subtitle = sizeOption ? `Size: ${sizeOption.value}` : undefined;

        items.push({
          id: handle,
          name: `${product.name} \u2014 ${colorName}`,
          subtitle,
          handle,
          image: colorImage,
          price,
          product,
        });
      }
    }
    return items;
  }, [product1, product2, product3]);

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
    if (page === "home" && scrollTarget) {
      const el = document.getElementById(scrollTarget);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
    }
  }, [page, scrollTarget]);

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
      <Header onNavigate={(p, hash) => navigateTo(p as PageType, hash)} onSearch={() => setSearchOpen(true)} dark={isDark} page={page} />

      <AnimatePresence
        mode="wait"
        onExitComplete={() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })}
      >
        <motion.div
          key={isProductPage ? `product-${productHandle}` : page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.25, 0.1, 0.25, 1], // sleek cubic-bezier
          }}
        >
          {isProductPage ? (
            <div>
              <ProductPage handle={productHandle} onBack={() => navigateTo("home")} onNavigate={navigateToProduct} />
              <Footer onNavigate={(p, hash) => navigateTo(p as PageType, hash)} />
            </div>
          ) : page === "home" ? (
            <main>
              <HeroVideo onReady={() => setHeroReady(true)} />

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
                <AccessoriesPage onNavigateToProduct={navigateToProduct} onLookView={setLookProduct} />
                <Footer onNavigate={(p, hash) => navigateTo(p as PageType, hash)} />
              </Suspense>
            </div>
          ) : page === "ambassador" ? (
            <div>
              <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                <AmbassadorPage />
                <Footer onNavigate={(p, hash) => navigateTo(p as PageType, hash)} />
              </Suspense>
            </div>
          ) : page === "notfound" ? (
            <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf8f5" }} />}>
              <NotFoundPage onNavigateHome={() => navigateTo("home")} />
            </Suspense>
          ) : page === "checkout" ? (
            <div style={{ minHeight: "100vh", background: "#efe6da" }} />
          ) : (
            <Suspense fallback={<div style={{ minHeight: "60vh", background: "#faf8f5" }} />}>
              <PolicyPage policy={page as "privacy" | "refund" | "return" | "delivery"} onClose={() => navigateTo("home")} />
            </Suspense>
          )}

          {page === "home" && (
            <Suspense fallback={null}>
              <Footer onNavigate={(p, hash) => navigateTo(p as PageType, hash)} />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>

      {page === "home" && <LoadingScreen ready={heroReady && !loading} />}

      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />

      <WhatsAppButton />

      <Suspense fallback={null}>
        <CartDrawer />
        <CheckoutPage />
        <CustomerAuthModal />
        <AccountPage />
        <SearchDrawer
          open={searchOpen}
          items={searchItems}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onClose={() => setSearchOpen(false)}
          onSelect={(item) => {
            setSearchOpen(false);
            setSearchQuery("");
            navigateToProduct(item.handle);
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

  if (IS_APPLE_PAY_IFRAME) {
    // Apple Pay iframe is disabled until ENABLE_APPLE_PAY is true in features.ts
    return null;
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
