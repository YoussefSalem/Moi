import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
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
import { WavySeparator } from "@/components/WavySeparator";
import { LookView } from "@/components/LookView";
import { CartProvider, useCart } from "@/context/CartContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";


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
const ProductPage = lazy(() => import("@/pages/ProductPage").then(m => ({ default: m.ProductPage })));
const OrderConfirmationPage = lazy(() => import("@/pages/OrderConfirmationPage").then(m => ({ default: m.OrderConfirmationPage })));
const PaymentSuccessPage = lazy(() => import("@/pages/PaymentSuccessPage").then(m => ({ default: m.PaymentSuccessPage })));
const ApplePayIframePage = lazy(() => import("@/pages/ApplePayIframePage").then(m => ({ default: m.ApplePayIframePage })));
const PaymentFailedPage = lazy(() => import("@/pages/PaymentFailedPage").then(m => ({ default: m.PaymentFailedPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => import("@/components/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

const IS_ADMIN = window.location.pathname.startsWith("/admin");
const IS_APPLE_PAY_IFRAME = window.location.pathname === "/buy/apple-pay";

type PageType = "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery" | "product" | "notfound" | "checkout" | "order-confirmation" | "payment-success" | "payment-failed";
const POLICY_PAGES: PageType[] = ["privacy", "refund", "return", "delivery"];

// Known product slugs — used only for URL routing. Colors are derived live from
// Shopify variants; we never hardcode which colors a product supports.
const KNOWN_PRODUCT_SLUGS = ["moi-wavvy", "moi-versa-top", "trio-bangles"];

const SECTION_PATH_MAP: Record<string, string> = {
  "/versa-top": "moi-versa-top",
  "/wavvy-top": "moi-wavvy",
};

function parsePath(): { page: PageType; productHandle: string; section?: string } {
  if (typeof window === "undefined") return { page: "home", productHandle: "" };
  const pathname = window.location.pathname;
  if (pathname.startsWith("/products/")) {
    const handle = pathname.slice("/products/".length);
    const matchedSlug = KNOWN_PRODUCT_SLUGS.find(
      (p) => handle === p || handle.startsWith(p + "-"),
    );
    if (!matchedSlug) return { page: "notfound", productHandle: handle };
    return { page: "product", productHandle: handle };
  }
  if (pathname === "/payment/success") return { page: "payment-success", productHandle: "" };
  if (pathname === "/payment/failed") return { page: "payment-failed", productHandle: "" };
  if (pathname === "/ordermade") return { page: "order-confirmation", productHandle: "" };
  if (pathname === "/checkout") return { page: "checkout", productHandle: "" };
  if (pathname === "/accessories") return { page: "accessories", productHandle: "" };
  if (pathname === "/ambassador") return { page: "ambassador", productHandle: "" };
  const sectionId = SECTION_PATH_MAP[pathname];
  if (sectionId) return { page: "home", productHandle: "", section: sectionId };
  const slug = pathname.slice(1) as PageType;
  if (POLICY_PAGES.includes(slug)) return { page: slug, productHandle: "" };
  return { page: "home", productHandle: "" };
}

const FALLBACK_PRODUCTS: ProductConfig[] = [IMAGES.product1, IMAGES.product2, IMAGES.product3 as ProductConfig];

/** Derive the list of color names for a product from Shopify variants, falling
 *  back to the local colorImages keys. This ensures the homepage always reflects
 *  exactly what Shopify has — no hardcoded color lists. */
function deriveColors(product: ProductConfig): { name: string }[] {
  if (product.variants && product.variants.length > 0) {
    const seen = new Set<string>();
    const result: { name: string }[] = [];
    for (const v of product.variants) {
      const colorOpt = v.selectedOptions.find((o) => o.name.toLowerCase() === "color");
      if (colorOpt && !seen.has(colorOpt.value)) {
        seen.add(colorOpt.value);
        result.push({ name: colorOpt.value });
      }
    }
    if (result.length > 0) return result;
  }
  return Object.keys((product.colorImages ?? {}) as Record<string, string>).map((name) => ({ name }));
}

function AppContent() {
  const [lookProduct, setLookProduct] = useState<ProductConfig | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroReady, setHeroReady] = useState(false);
  // Once home has fully loaded once, never show the LoadingScreen again.
  const [homeLoadedOnce, setHomeLoadedOnce] = useState(false);
  // Stable callback reference so HeroVideo's useEffect doesn't re-run on every render.
  const handleHeroReady = useCallback(() => setHeroReady(true), []);
  const { products, loading } = useShopifyProducts(FALLBACK_PRODUCTS);
  // Scroll restoration: save position before navigating to a product, restore on back
  const savedScrollRef = useRef(0);
  const pendingScrollRef = useRef<number | null>(null);
  const cart = useCart();

  // homeRevealed decouples the home div's visibility from the `page` state.
  // When navigating back to home via a programmatic back button, we keep the home div
  // hidden (display:none) until the overlay exit animation fully completes, so the
  // browser never has to repaint the homepage while an animation is also running.
  // onExitComplete flips this. For popstate (swipe-back / browser back), we flip it
  // immediately — see onPopState below.
  const [homeRevealed, setHomeRevealed] = useState(() => parsePath().page === "home");

  // When the popstate event fires (swipe-back or browser back button), the native
  // browser gesture has already completed its own visual transition. Playing our
  // 220ms exit animation on top of that causes the product page to briefly re-appear
  // after iOS has already slid it away — the visible "flash". Skipping the exit
  // animation for popstate navigations eliminates this entirely.
  const [skipExitAnimation, setSkipExitAnimation] = useState(false);

  function handleColorCardAddToCart(handle: string, _image?: string) {
    // Use Shopify-fetched products (real variant GIDs) — all three products now in `products`.
    // DO NOT shadow the outer `products` state — we need the live Shopify data.
    const allProducts: ProductConfig[] = [...products];
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
    const sizeValue = variant?.selectedOptions.find(
      (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre"
    )?.value ?? "One Size";
    cart.addToCart({
      variantId,
      title: product.name,
      price: variant?.price ?? product.price,
      priceAmount: parseEGP(variant?.price ?? product.price) || 0,
      compareAtPrice: variant?.compareAtPrice,
      currencyCode: "EGP",
      image,
      size: sizeValue,
      color: colorName,
    });
    toast.success(`${product.name} added to bag`, {
      description: [colorName, sizeValue].filter(Boolean).join(" · "),
      duration: 2500,
    });
  }

  const [page, setPage] = useState<PageType>(() => parsePath().page);
  const [productHandle, setProductHandle] = useState<string>(() => parsePath().productHandle);
  const [scrollTarget, setScrollTarget] = useState<string>(() => parsePath().section ?? "");

  const navigateToProduct = useCallback((handle: string) => {
    savedScrollRef.current = window.scrollY;
    setHomeRevealed(false); // Hide home immediately so product page owns the scroll
    setPage("product");
    setProductHandle(handle);
    window.history.pushState(null, "", `/products/${handle}`);
  }, []);

  const navigateTo = useCallback((p: PageType, hash?: string) => {
    if (p !== "home") setHomeRevealed(false); // Hide home when leaving it
    setPage(p);
    setProductHandle("");
    setScrollTarget(hash ?? "");
    if (p === "home" && hash) {
      window.history.pushState(null, "", `/`);
    } else {
      window.history.pushState(null, "", p === "home" ? "/" : `/${p}`);
    }
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const parsed = parsePath();
      if (parsed.page === "home") {
        // Swipe-back or browser back to home. The native browser gesture has already
        // completed its own visual transition — we must NOT play our 220ms exit
        // animation on top of it, or the product page briefly re-appears (the flash).
        // Instead: reveal home immediately and exit in 0ms. Scroll restoration still
        // happens via useEffect([homeRevealed]) because pendingScrollRef is set here.
        pendingScrollRef.current = savedScrollRef.current;
        setSkipExitAnimation(true);
        setHomeRevealed(true);
      } else {
        setHomeRevealed(false);
      }
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
  const product3 = products.find(p => p.slug === "trio-bangles") ?? IMAGES.product3 as ProductConfig;

  // Preload all landing-page product images into the browser cache while the MOI
  // loader is showing, so nothing pops in on scroll. The images keep loading="lazy",
  // but once cached they render instantly the moment they enter the viewport.
  // Gated on Shopify products resolving (real color image URLs come from there).
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    // Reset the gate for this run so a stale `true` from a previous product set
    // can never let the loader hide before the current assets are cached.
    setAssetsReady(false);

    const urls = new Set<string>();
    for (const product of [product1, product2]) {
      const colorImages = (product.colorImages ?? {}) as Record<string, string>;
      const galleries = (product.colorGalleries ?? {}) as Record<string, string[]>;
      for (const url of Object.values(colorImages)) if (url) urls.add(url);
      for (const g of Object.values(galleries)) for (const url of g) if (url) urls.add(url);
      if (product.productShot) urls.add(product.productShot);
    }

    const list = [...urls];
    if (list.length === 0) {
      setAssetsReady(true);
      return;
    }

    let remaining = list.length;
    const markDone = () => {
      remaining -= 1;
      if (remaining <= 0 && !cancelled) setAssetsReady(true);
    };

    // Safety net: never let one slow/broken image stall the gate indefinitely.
    // Matches the LoadingScreen hard cap (7s) so gating semantics stay consistent —
    // on very slow connections both release together rather than the gate firing early.
    const safety = setTimeout(() => {
      if (!cancelled) setAssetsReady(true);
    }, 7000);

    for (const url of list) {
      const img = new Image();
      img.onload = markDone;
      img.onerror = markDone;
      img.src = url;
    }

    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [loading, product1, product2]);

  // Build search items: one entry per color variant derived from Shopify data
  const searchItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];
    const allProducts: ProductConfig[] = [product1, product2, product3];

    for (const product of allProducts) {
      const colorImages = product.colorImages as Record<string, string> | undefined;

      // Derive live colors from Shopify variants; fall back to colorImages keys
      const colorNames: string[] = (() => {
        if (product.variants && product.variants.length > 0) {
          const seen = new Set<string>();
          const result: string[] = [];
          for (const v of product.variants) {
            const colorOpt = v.selectedOptions.find((o) => o.name.toLowerCase() === "color");
            if (colorOpt && !seen.has(colorOpt.value)) {
              seen.add(colorOpt.value);
              result.push(colorOpt.value);
            }
          }
          if (result.length > 0) return result;
        }
        return Object.keys(colorImages ?? {});
      })();

      if (colorNames.length === 0) {
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

      for (const colorName of colorNames) {
        const colorSlug = colorName.toLowerCase().replace(/\s+/g, "-");
        const handle = `${product.slug}-${colorSlug}`;
        const colorImage = colorImages?.[colorName] ?? product.productShot;
        const variant = product.variants?.find((v) =>
          v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === colorName)
        );
        const price = variant?.price ?? product.price;

        items.push({
          id: handle,
          name: `${product.name} \u2014 ${colorName}`,
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
    if (!(page === "home" && scrollTarget)) return;
    // Wait for a small buffer before scrolling
    const t = setTimeout(() => {
      const el = document.getElementById(scrollTarget);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTarget("");
    }, 120);
    return () => clearTimeout(t);
  }, [page, scrollTarget]);

  // Mark home as "loaded once" so the LoadingScreen never shows again after first visit.
  // Delay past the LoadingScreen's own minimum (800ms) + fade-out (600ms).
  useEffect(() => {
    if (homeLoadedOnce || !heroReady || loading || !assetsReady) return;
    const t = setTimeout(() => setHomeLoadedOnce(true), 1500);
    return () => clearTimeout(t);
  }, [heroReady, loading, assetsReady, homeLoadedOnce]);

  // Restore scroll position after home becomes visible (homeRevealed flips to true).
  // This runs after the exit animation completes and the home div is display:block,
  // so the scroll target is always reachable and there is no animation contention.
  useEffect(() => {
    if (!homeRevealed) return;
    const target = pendingScrollRef.current;
    if (target === null) return;
    pendingScrollRef.current = null;
    // rAF lets the display:block repaint settle before we set scrollY
    requestAnimationFrame(() => {
      window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
    });
  }, [homeRevealed]);

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
  const isPaymentPage = page === "order-confirmation" || page === "payment-failed";
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
      {!isPaymentPage && <Header onNavigate={(p, hash) => navigateTo(p as PageType, hash)} onSearch={() => setSearchOpen(true)} dark={isDark} page={page} />}

      {/*
        Home page — always mounted so HeroVideo, ProductColorSection, and all images
        stay alive in the DOM. We use homeRevealed (not `page`) to control visibility:
        homeRevealed only flips to true in AnimatePresence.onExitComplete, so the
        browser never has to repaint the entire homepage while an exit animation is
        also running on the overlay above it. This eliminates all back-nav jank.
      */}
      <div
        style={{ display: homeRevealed ? "block" : "none" }}
        aria-hidden={!homeRevealed}
      >
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
              colors={deriveColors(product1)}
              onNavigate={navigateToProduct}
              onAddToCart={handleColorCardAddToCart}
            />
          </div>

          <WavySeparator />

          <ProductColorSection
            id={product2.slug}
            product={product2}
            sectionTitle="MOI VERSA TOP"
            sectionSubtitle="Effortlessly versatile. A silhouette that moves with you, in every shade of summer."
            colors={deriveColors(product2)}
            onNavigate={navigateToProduct}
            onAddToCart={handleColorCardAddToCart}
            dark
          />

          <Suspense fallback={null}>
            <TikTokSocialProof />
          </Suspense>
        </main>

        <Suspense fallback={null}>
          <Footer onNavigate={(p, hash) => navigateTo(p as PageType, hash)} />
        </Suspense>
      </div>

      {/* Non-home pages — animated in/out over the (hidden) home background */}
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          // For programmatic Back-button navigation: home is only revealed after the
          // overlay finishes its 220ms exit animation (prevents repaint contention).
          // For popstate (swipe-back): homeRevealed is already true; this is a no-op.
          if (page === "home") setHomeRevealed(true);
          // Reset the popstate skip flag after the exit completes.
          setSkipExitAnimation(false);
        }}
      >
        {page !== "home" && (
          <motion.div
            key={isProductPage ? `product-${productHandle}` : page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              skipExitAnimation
                ? // Popstate: native gesture already handled the visual transition.
                  // Exit instantly so the product page never re-appears on screen.
                  { opacity: 0, transition: { duration: 0 } }
                : // Programmatic back (Back button tap): play the polished 220ms fade.
                  { opacity: 0, y: -4, transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } }
            }
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ willChange: "opacity, transform" }}
          >
            {page === "order-confirmation" ? (
              <OrderConfirmationPage
                onContinueShopping={() => navigateTo("home")}
              />
            ) : page === "payment-success" ? (
              <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#faf8f5" }} />}>
                <PaymentSuccessPage
                  intentId={new URLSearchParams(window.location.search).get("intentId") ?? ""}
                  txnId={new URLSearchParams(window.location.search).get("txnId") ?? undefined}
                  onContinueShopping={() => {
                    setPage("order-confirmation");
                    const search = window.location.search;
                    window.history.replaceState(null, "", `/ordermade${search}`);
                  }}
                />
              </Suspense>
            ) : page === "payment-failed" ? (
              <PaymentFailedPage
                onTryAgain={() => { navigateTo("home"); cart.openCheckout(); }}
                onContinueShopping={() => navigateTo("home")}
              />
            ) : isProductPage ? (
              <div>
                <ProductPage
                  handle={productHandle}
                  onBack={() => { pendingScrollRef.current = savedScrollRef.current; navigateTo("home"); }}
                  onNavigate={navigateToProduct}
                />
                <Footer onNavigate={(p, hash) => navigateTo(p as PageType, hash)} />
              </div>
            ) : page === "accessories" ? (
              <div>
                <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                  <AccessoriesPage onLookView={setLookProduct} onNavigateToProduct={navigateToProduct} />
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* LoadingScreen — only shown on the very first home visit. After that, home
          is always mounted so there is nothing to wait for on back navigation. */}
      {!homeLoadedOnce && page === "home" && (
        <LoadingScreen ready={heroReady && !loading && assetsReady} />
      )}

      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />

      <WhatsAppButton />

      <Suspense fallback={null}>
        <CartDrawer
          onNavigateToSection={(sectionId) => {
            setScrollTarget(sectionId);
            if (page !== "home") {
              setPage("home");
              setProductHandle("");
              window.history.pushState(null, "", "/");
            } else {
              setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 80);
            }
          }}
        />
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
          position="top-right"
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
