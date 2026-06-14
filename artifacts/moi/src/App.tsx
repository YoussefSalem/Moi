import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { transitions, dur } from "@/lib/motion";
import { showAddedToBagToast } from "@/lib/cartToast";
import { trackShopifyPageView } from "@/lib/shopifyAnalytics";
import { parseEGP } from "@/lib/price";
import { captureAttribution } from "@/lib/adAttribution";
import { initAnalytics } from "@/lib/analytics";
import { AnalyticsDebug } from "@/components/AnalyticsDebug";
import { LoadingScreen } from "@/components/LoadingScreen";
import { AddedToBagToast } from "@/components/AddedToBagToast";
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
import { ErrorBoundary, InlineErrorFallback } from "@/components/ErrorBoundary";
import { parsePath, deriveColors, FALLBACK_PRODUCTS, type PageType } from "@/lib/appRouting";


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
const OrderConfirmationPage = lazy(() => import("@/pages/OrderConfirmationPage").then(m => ({ default: m.OrderConfirmationPage })));
const ApplePayIframePage = lazy(() => import("@/pages/ApplePayIframePage").then(m => ({ default: m.ApplePayIframePage })));
const PaymentFailedPage = lazy(() => import("@/pages/PaymentFailedPage").then(m => ({ default: m.PaymentFailedPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => import("@/components/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

const IS_ADMIN = window.location.pathname.startsWith("/admin");
const IS_APPLE_PAY_IFRAME = window.location.pathname === "/buy/apple-pay";


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

  // Distinguish iOS swipe-back from the Safari toolbar back button.
  // Swipe-back always starts with a touchstart near the left screen edge (x < 20px).
  // A toolbar button tap produces no preceding touch event on the page at all.
  // We set this flag on left-edge touchstart and consume it in onPopState so we can
  // skip the exit animation only for swipes (where iOS has already animated the slide)
  // and play it for button presses (where no native animation occurs).
  const edgeSwipePendingRef = useRef(false);
  const cart = useCart();
  // Always-current reference to cart.closeCart so stale-closure callbacks
  // (navigateToProduct, navigateTo, onPopState — all have empty deps) can safely
  // close the cart without needing to be recreated on every render.
  const closeCartRef = useRef(cart.closeCart);
  useEffect(() => { closeCartRef.current = cart.closeCart; });

  // Hamburger menu state — lifted here so navigation can close it from anywhere
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenuRef = useRef(() => setMenuOpen(false));
  useEffect(() => { closeMenuRef.current = () => setMenuOpen(false); });

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
  const [isGoingBack, setIsGoingBack] = useState(false);

  const handleColorCardAddToCart = useCallback((handle: string, _image?: string) => {
    // Resolve products by slug — always maps the right config regardless of Shopify order.
    // Prefer Shopify-enriched products (real variant GIDs); fall back to local config.
    const slugProducts: ProductConfig[] = [
      products.find((p) => p.slug === "moi-wavvy") ?? (IMAGES.product1 as unknown as ProductConfig),
      products.find((p) => p.slug === "moi-versa-top") ?? (IMAGES.product2 as unknown as ProductConfig),
      products.find((p) => p.slug === "trio-bangles") ?? (IMAGES.product3 as unknown as ProductConfig),
    ];
    const product = slugProducts.find((p) => handle.startsWith(p.slug + "-") || handle === p.slug);
    if (!product) return;
    const colorSlug = handle.startsWith(product.slug + "-")
      ? handle.slice(product.slug.length + 1)
      : "";
    const colorName = Object.keys((product.colorImages ?? {}) as Record<string, string>).find(
      (c) => c.toLowerCase().replace(/\s+/g, "-") === colorSlug,
    ) ?? "";
    const image = ((product.colorImages ?? {}) as Record<string, string>)[colorName] ?? product.productShot;
    // Find the color-specific Shopify variant using case-insensitive matching so
    // "White" in local config matches "white" or "WHITE" in Shopify option values.
    const colorLower = colorName.toLowerCase();
    const variant = product.variants?.find((v) =>
      v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === colorLower)
    );
    // Only use product.variantId when there is no color constraint (i.e. colorName is empty).
    // If colorName is set but no variant was found, skip the Shopify add entirely rather
    // than silently adding the wrong color's variant to the cart.
    const variantId = variant?.id ?? (colorName ? undefined : product.variantId) ?? handle;
    const sizeValue = variant?.selectedOptions.find(
      (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre"
    )?.value ?? "One Size";
    // Cart title must be the base product name (no color suffix) so it stays
    // stable when Shopify syncs — Shopify uses the parent product title.
    const cartTitle = product.name.includes(" — ")
      ? product.name.split(" — ")[0]
      : product.name;
    cart.addToCart({
      variantId,
      title: cartTitle,
      price: variant?.price ?? product.price,
      priceAmount: parseEGP(variant?.price ?? product.price) || 0,
      compareAtPrice: variant?.compareAtPrice,
      currencyCode: "EGP",
      image,
      size: sizeValue,
      color: colorName,
    });
    showAddedToBagToast(colorName, sizeValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, cart.addToCart]);

  const [page, setPage] = useState<PageType>(() => parsePath().page);
  const [productHandle, setProductHandle] = useState<string>(() => parsePath().productHandle);
  const [scrollTarget, setScrollTarget] = useState<string>(() => parsePath().section ?? "");
  const [autoOpenReview, setAutoOpenReview] = useState<string | null>(null);
  const [reviewNonce, setReviewNonce] = useState(0);

  // Always-current references to page/handle for use inside stale-closure
  // callbacks (onPopState, navigateToProduct — both have empty deps arrays).
  const currentPageRef = useRef<PageType>(parsePath().page);
  const currentHandleRef = useRef(parsePath().productHandle);
  useEffect(() => {
    currentPageRef.current = page;
    currentHandleRef.current = productHandle;
  }, [page, productHandle]);

  const navigateToProduct = useCallback((handle: string) => {
    closeCartRef.current();
    closeMenuRef.current();
    if (currentPageRef.current === "product") {
      // Already on a product page — update the handle in-place (no new overlay push)
      setProductHandle(handle);
      window.history.replaceState(null, "", `/products/${handle}`);
      return;
    }
    savedScrollRef.current = window.scrollY;
    setIsGoingBack(false);
    setHomeRevealed(false);
    setPage("product");
    setProductHandle(handle);
    window.history.pushState(null, "", `/products/${handle}`);
  }, []);

  // back=true → play the back (slide-down) exit animation instead of forward (slide-up).
  // Use this for UI "← Back" buttons so pages slide down when dismissed.
  const navigateTo = useCallback((p: PageType, hash?: string, back = false) => {
    closeCartRef.current();
    closeMenuRef.current();
    if (back && p === "home") {
      // Back navigation: save scroll before updating state
      pendingScrollRef.current = savedScrollRef.current;
      setHomeRevealed(true);
      // flushSync forces a render with isGoingBack=true while the page is still
      // mounted so AnimatePresence captures the back exit animation correctly.
      flushSync(() => setIsGoingBack(true));
    } else {
      if (p !== "home") savedScrollRef.current = window.scrollY;
      if (p !== "home") setHomeRevealed(false); // Hide home when leaving it
      setIsGoingBack(false);
    }
    setPage(p);
    setProductHandle("");
    setScrollTarget(hash ?? "");
    if (p === "home" && hash) {
      window.history.pushState(null, "", `/`);
    } else {
      window.history.pushState(null, "", p === "home" ? "/" : `/${p}`);
    }
  }, []);

  // Track left-edge touchstart so onPopState can tell swipe-back apart from the
  // toolbar back button. The flag is consumed (and reset) inside onPopState.
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const isEdge = (e.touches[0]?.clientX ?? 999) < 20;
      edgeSwipePendingRef.current = isEdge;
      if (isEdge) {
        // Synchronously flush React state so cart and menu are removed from the
        // DOM *before* iOS begins rendering the swipe-back animation. Without
        // flushSync the DOM update is async and the overlays are still visible
        // during the native swipe gesture even though we called close.
        flushSync(() => {
          closeCartRef.current();
          closeMenuRef.current();
        });
      }
    }
    function onTouchEnd() {
      // Reset after a short delay — popstate may fire slightly after touchend
      // on some iOS versions, so give it a 150ms window.
      setTimeout(() => { edgeSwipePendingRef.current = false; }, 150);
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend",   onTouchEnd,   { passive: true });
    window.addEventListener("touchcancel",onTouchEnd,   { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend",   onTouchEnd);
      window.removeEventListener("touchcancel",onTouchEnd);
    };
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      closeCartRef.current();
      closeMenuRef.current();
      const parsed = parsePath();
      if (parsed.page === "home") {
        // Decide whether this popstate came from a swipe gesture or the toolbar button.
        const isSwipe = edgeSwipePendingRef.current;
        edgeSwipePendingRef.current = false; // consume

        pendingScrollRef.current = savedScrollRef.current;
        setHomeRevealed(true);

        if (isSwipe) {
          // Swipe-back: iOS has already slid the page away. Add a CSS class that
          // animates the product page off the right edge, then wait for the
          // transition to finish before updating React state. This prevents the
          // flash where the product page briefly re-appears at center before
          // AnimatePresence catches up.
          const el = document.getElementById("product-scroll-container");
          if (el) {
            el.classList.add("swipe-back-exit");
            const onTransitionEnd = () => {
              el.removeEventListener("transitionend", onTransitionEnd);
              setSkipExitAnimation(true);
              setPage(parsed.page);
              setProductHandle(parsed.productHandle);
              setScrollTarget(parsed.section ?? "");
              // Restore scroll position after the animation completes
              if (pendingScrollRef.current !== null) {
                window.scrollTo(0, pendingScrollRef.current);
                pendingScrollRef.current = null;
              }
            };
            el.addEventListener("transitionend", onTransitionEnd);
            // Safety: if transition never fires (e.g. element already hidden), fall back
            setTimeout(() => {
              el.removeEventListener("transitionend", onTransitionEnd);
              setSkipExitAnimation(true);
              setPage(parsed.page);
              setProductHandle(parsed.productHandle);
              setScrollTarget(parsed.section ?? "");
            }, 400);
            return; // Defer state update until transition finishes
          }
        }

        // Toolbar button: play the back exit animation via AnimatePresence.
        // flushSync forces a render with isGoingBack=true while the page overlay
        // is still mounted so AnimatePresence captures the correct exit direction.
        setSkipExitAnimation(false);
        flushSync(() => setIsGoingBack(true));
      } else {
        setIsGoingBack(false);
        setHomeRevealed(false);
      }
      setPage(parsed.page);
      setProductHandle(parsed.productHandle);
      setScrollTarget(parsed.section ?? "");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Take full control of scroll position on history navigation. Without this, iOS
  // Safari's native scroll restoration ("auto") races the app's own scroll logic on
  // swipe-back: when returning to a previous product page (e.g. reached via "You may
  // also like"), the browser restores it to where it was scrolled (the bottom),
  // overriding ProductPage's scroll-to-top. "manual" makes the app authoritative so
  // back-nav reliably lands at the top of a product or the saved home position.
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => { window.history.scrollRestoration = prev; };
    }
    return undefined;
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

  // Handle post-purchase review deep-links (?review=1 or #write-review)
  // Runs once on mount and also listens for hashchange (e.g. email link clicked
  // while already on the product page). Raises autoOpenReview so ProductPage can
  // open WriteReviewModal once the product finishes loading.
  // sessionStorage prevents the modal re-opening on a manual refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;

    function tryTriggerReview() {
      const params = new URLSearchParams(window.location.search);
      const isQueryParam = params.get("review") === "1";
      const isHash = window.location.hash === "#write-review";
      if (!isQueryParam && !isHash) return;

      const handle = parsePath().productHandle;
      if (!handle) return;

      if (isHash) {
        // Fresh email-link click — always open. Clear any stale session guards
        // (both the App-level guard and the useProductPageState guard) so the
        // modal fires even if it has been opened before in this browser session.
        try {
          sessionStorage.removeItem(`moi_review_modal_${handle}`);
          sessionStorage.removeItem(`review-modal-opened-${handle}`);
        } catch { /* sessionStorage unavailable */ }
        setReviewNonce((n) => n + 1);
      } else {
        // ?review=1 (legacy links) — session guard prevents double-open on refresh.
        const ssKey = `moi_review_modal_${handle}`;
        try {
          if (sessionStorage.getItem(ssKey)) return;
          sessionStorage.setItem(ssKey, "1");
        } catch { /* sessionStorage unavailable */ }
      }

      setAutoOpenReview(handle);
      // Strip the param/hash so the URL is clean
      window.history.replaceState(null, "", `/products/${handle}`);
    }

    tryTriggerReview();

    window.addEventListener("hashchange", tryTriggerReview);
    return () => window.removeEventListener("hashchange", tryTriggerReview);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve homepage products by stable handle/slug prefix instead of array index,
  // so the mapping doesn't break when the Shopify store grows.
  const product1 = products.find(p => p.slug === "moi-wavvy") ?? IMAGES.product1;
  const product2 = products.find(p => p.slug === "moi-versa-top") ?? IMAGES.product2;
  const product3 = products.find(p => p.slug === "trio-bangles") ?? IMAGES.product3 as ProductConfig;
  const product1Colors = useMemo(() => deriveColors(product1), [product1]);
  const product2Colors = useMemo(() => deriveColors(product2), [product2]);

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

    // +1 slot for document.fonts.ready — the loading screen must never exit
    // before fonts are ready, otherwise the MOI logotype flashes unstyled.
    let remaining = list.length + 1;
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

    // Wait for fonts in parallel with images.
    document.fonts.ready.then(() => { if (!cancelled) markDone(); });

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
        const colorNameLower = colorName.toLowerCase();
        const variant = product.variants?.find((v) =>
          v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === colorNameLower)
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

  // Clear the order confirmation session whenever the customer navigates away from it.
  // This prevents returning to the confirmation page after intentional navigation
  // (back button, Continue Shopping, etc.) while still allowing refresh/app-switch.
  useEffect(() => {
    if (page !== "order-confirmation") {
      try { sessionStorage.removeItem("moi_order_confirmed_active"); } catch { /* ignore */ }
    }
  }, [page]);

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
      {!isPaymentPage && <Header onNavigate={(p, hash) => navigateTo(p as PageType, hash)} onSearch={() => setSearchOpen(true)} dark={isDark} page={page} zIndex={page !== "home" ? 52 : 50} menuOpen={menuOpen} onMenuChange={setMenuOpen} />}

      {/*
        Home page — always mounted so HeroVideo, ProductColorSection, and all images
        stay alive in the DOM. We use homeRevealed (not `page`) to control visibility:
        homeRevealed only flips to true in AnimatePresence.onExitComplete, so the
        browser never has to repaint the entire homepage while an exit animation is
        also running on the overlay above it. This eliminates all back-nav jank.
      */}
      <div
        style={homeRevealed ? {} : { pointerEvents: "none" as const, visibility: "hidden" as const }}
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
              colors={product1Colors}
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
            colors={product2Colors}
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
          // Reset direction + skip flags after the exit animation completes.
          setSkipExitAnimation(false);
          setIsGoingBack(false);
          // Clean up any leftover swipe-back class so the element is fresh next mount.
          const el = document.getElementById("product-scroll-container");
          if (el) el.classList.remove("swipe-back-exit");
        }}
      >
        {page !== "home" && (
          <motion.div
            id="product-scroll-container"
            key={isProductPage ? "product" : page}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              skipExitAnimation
                ? { opacity: 0, transition: { duration: dur.instant } }
                : isGoingBack
                  ? { opacity: 0, y: 14, transition: transitions.pageExit }
                  : { opacity: 0, y: -4, transition: transitions.page }
            }
            transition={transitions.page}
            style={{
              willChange: "opacity, transform",
              backgroundColor: "#faf8f5",
              position: "fixed",
              inset: 0,
              zIndex: 51,
              overflowX: "hidden",
              overflowY: "auto",
            }}
          >
            <ErrorBoundary>
              {page === "order-confirmation" ? (
                <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#faf8f5" }} />}>
                  <OrderConfirmationPage
                    onContinueShopping={() => navigateTo("home")}
                  />
                </Suspense>
              ) : page === "payment-failed" ? (
                <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf8f5" }} />}>
                  <PaymentFailedPage
                    onTryAgain={() => { navigateTo("home"); cart.openCheckout(); }}
                    onContinueShopping={() => navigateTo("home")}
                  />
                </Suspense>
              ) : isProductPage ? (
                <ProductPage
                  handle={productHandle}
                  autoOpenReview={autoOpenReview}
                  autoOpenReviewNonce={reviewNonce}
                  onBack={() => navigateTo("home", undefined, true)}
                  onNavigate={navigateToProduct}
                  onPageNavigate={(p, hash) => navigateTo(p as PageType, hash)}
                />
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
                  <PolicyPage policy={page as "privacy" | "refund" | "return" | "delivery"} onClose={() => navigateTo("home", undefined, true)} />
                </Suspense>
              )}
            </ErrorBoundary>
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

      <ErrorBoundary fallback={(reset) => <InlineErrorFallback reset={reset} />}>
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
      </ErrorBoundary>
    </div>
  );
}

function App() {
  if (IS_ADMIN) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf8f5" }} />}>
          <AdminPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (IS_APPLE_PAY_IFRAME) {
    // Apple Pay iframe is disabled until ENABLE_APPLE_PAY is true in features.ts
    return null;
  }

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <CustomerProvider>
          <CartProvider>
            <AppContent />
            {typeof window !== "undefined" && window.location.href.includes("debug_analytics") && <AnalyticsDebug />}
            <AddedToBagToast />
          </CartProvider>
        </CustomerProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
