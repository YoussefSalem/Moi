import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bell } from "lucide-react";
import { ProductCarousel, type CarouselItem } from "@/components/ProductCarousel";
import { toast } from "sonner";
import { showAddedToBagToast } from "@/lib/cartToast";
import { useShopifyProductByHandle } from "@/hooks/useShopifyProductByHandle";
import { parseEGP } from "@/lib/price";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { IMAGES, type ProductConfig } from "@/config/images";
import { NotifyMeModal } from "@/components/NotifyMeModal";
import { CinematicLightbox } from "@/components/CinematicLightbox";
import { trackAddToCart } from "@/lib/analytics";
import { trackViewContent } from "@/lib/metaPixel";
import { trackTikTokViewContent } from "@/lib/tiktokPixel";

import { ENABLE_APPLE_PAY } from "@/config/features";
import { ShopifyApplePayButton } from "@/components/ShopifyApplePayButton";
import { WriteReviewModal } from "@/components/WriteReviewModal";
import { Footer } from "@/components/Footer";
import { ZoomableImage } from "./product/ZoomableImage";
import { ProductSkeleton } from "./product/ProductSkeleton";
import { ProductReviews, type ReviewItem } from "./product/ProductReviews";
import { SizeGuideModal } from "./product/SizeGuideModal";
import { ProductTrustBadges } from "./product/ProductTrustBadges";
import { ProductDesktopLayout } from "./product/ProductDesktopLayout";
import { ProductMobileSection } from "./product/ProductMobileSection";
import { ImageSkeleton } from "@/components/ImageSkeleton";

import { buildAllRecs, deriveFallbackFromHandle } from "./product/productPageUtils";
import { useMobileGallerySwipe } from "@/hooks/useMobileGallerySwipe";

const ALL_RECS = buildAllRecs();

interface ProductPageProps {
  handle: string;
  onBack: () => void;
  onNavigate?: (handle: string) => void;
  onPageNavigate?: (page: "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery", hash?: string) => void;
}

export function ProductPage({ handle, onBack, onNavigate, onPageNavigate }: ProductPageProps) {
  const fallback = deriveFallbackFromHandle(handle);
  const { product, loading } = useShopifyProductByHandle(handle, fallback);
  // When Shopify returns all variants for the base product (e.g. all MOI WAVVY colors),
  // we need to filter to the color in the URL. Extract from fallback.name which is
  // e.g. "MOI WAVVY — Light Blue" (set by deriveFallbackFromHandle).
  const pageColorName = fallback.name.includes(" — ")
    ? (fallback.name.split(" — ").pop() ?? "")
    : "";
  const { addToCart, buyNow, openCheckout } = useCart();
  const { customer } = useCustomer();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState<boolean[]>([]);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [trackMounted, setTrackMounted] = useState(false);
  const [waHover, setWaHover] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const recs = useMemo(() => ALL_RECS.filter((r) => r.handle !== handle), [handle]);
  const [carouselLb, setCarouselLb] = useState<{ open: boolean; images: readonly string[]; idx: number }>({ open: false, images: [], idx: 0 });
  const addingRef = useRef(false);

  // ── Reviews ──────────────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  useEffect(() => {
    const slug = product.slug;
    if (!slug) return;
    setReviewsLoaded(false);
    fetch(`/api/reviews/public?handle=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data: { reviews: ReviewItem[] }) => {
        setReviews(data.reviews ?? []);
        setReviewsLoaded(true);
      })
      .catch(() => {
        setReviewsLoaded(true);
      });
  }, [product.slug]);

  // Media query helper for mobile
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  // Detect Apple Pay availability once on mount
  useEffect(() => {
    const AP = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setApplePayAvailable(!!(ENABLE_APPLE_PAY && AP?.canMakePayments?.()));
  }, []);


  // SEO: update all <head> meta tags imperatively when the product or image changes.
  // This covers document.title, description, and all Open Graph + Twitter Card tags so
  // that the native share sheet (navigator.share), link-preview bots that execute JS,
  // and copy-paste unfurls all receive the correct per-product metadata.
  useEffect(() => {
    // Primary product image: productShot is always galleryImages[0] after dedup.
    // Make the URL absolute — Vite asset hashes are relative (/assets/…) while
    // Shopify CDN images are already https://.
    const rawImage = product.productShot ?? "";
    const absoluteImage = rawImage.startsWith("http")
      ? rawImage
      : `${window.location.origin}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;

    const pageUrl  = `${window.location.origin}/products/${handle}`;
    const fullTitle = `${product.name} — Moi`;
    const desc      = product.description?.slice(0, 160) ?? "";

    /** Get-or-create a <meta> element by CSS selector, inserting it if absent. */
    function getMeta(selector: string, attrKey: string, attrVal: string): HTMLMetaElement {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrKey, attrVal);
        document.head.appendChild(el);
      }
      return el;
    }

    // Snapshot originals so the cleanup can restore them precisely.
    const prevTitle = document.title;
    document.title  = fullTitle;

    const descTag    = getMeta('meta[name="description"]',           "name",     "description");
    const ogTitle    = getMeta('meta[property="og:title"]',          "property", "og:title");
    const ogDesc     = getMeta('meta[property="og:description"]',    "property", "og:description");
    const ogImage    = getMeta('meta[property="og:image"]',          "property", "og:image");
    const ogUrl      = getMeta('meta[property="og:url"]',            "property", "og:url");
    const ogType     = getMeta('meta[property="og:type"]',           "property", "og:type");
    const twTitle    = getMeta('meta[name="twitter:title"]',         "name",     "twitter:title");
    const twDesc     = getMeta('meta[name="twitter:description"]',   "name",     "twitter:description");
    const twImage    = getMeta('meta[name="twitter:image"]',         "name",     "twitter:image");

    const prev = {
      desc: descTag.content, ogTitle: ogTitle.content, ogDesc: ogDesc.content,
      ogImage: ogImage.content, ogUrl: ogUrl.content, ogType: ogType.content,
      twTitle: twTitle.content, twDesc: twDesc.content, twImage: twImage.content,
    };

    descTag.content  = desc;
    ogTitle.content  = fullTitle;
    ogDesc.content   = desc;
    ogImage.content  = absoluteImage;
    ogUrl.content    = pageUrl;
    ogType.content   = "product";
    twTitle.content  = fullTitle;
    twDesc.content   = desc;
    twImage.content  = absoluteImage;

    return () => {
      document.title   = prevTitle;
      descTag.content  = prev.desc;
      ogTitle.content  = prev.ogTitle;
      ogDesc.content   = prev.ogDesc;
      ogImage.content  = prev.ogImage;
      ogUrl.content    = prev.ogUrl;
      ogType.content   = prev.ogType;
      twTitle.content  = prev.twTitle;
      twDesc.content   = prev.twDesc;
      twImage.content  = prev.twImage;
    };
  }, [product.name, product.description, product.productShot, handle]);

  useEffect(() => {
    const el = document.getElementById("product-scroll-container");
    if (el) el.scrollTop = 0;
  }, [handle]);
  useEffect(() => {
    setGalleryIndex(0);
    setImgLoaded(false);
    // Do NOT touch the DOM here — useLayoutEffect below owns track positioning.
    // Resetting to 1 unconditionally was wrong for N=1 (1 slide → index 1 = blank).
  }, [handle]);

  // Meta Pixel + TikTok Pixel ViewContent — fires once per product page load
  useEffect(() => {
    const priceNum = parseEGP(product.price ?? "");
    const variantId = product.variantId ?? product.variants?.[0]?.id;
    trackViewContent({
      content_name: product.name,
      content_type: "product",
      content_ids: variantId ? [variantId] : undefined,
      currency: "EGP",
      value: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
    });
    trackTikTokViewContent({
      content_name: product.name,
      content_type: "product",
      content_id: variantId,
      currency: "EGP",
      value: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
    });
  }, [handle]);

  const sizeOption = useMemo(() => {
    if (!product.variants) return null;
    const opt = product.variants[0]?.selectedOptions.find(
      (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre",
    );
    if (!opt) return null;
    const vals = [
      ...new Set(
        product.variants.map(
          (v) => v.selectedOptions.find((o) => o.name.toLowerCase() === opt.name.toLowerCase())?.value,
        ).filter(Boolean),
      ),
    ] as string[];
    return { optionName: opt.name, values: vals };
  }, [product.variants]);

  const displaySizes = useMemo(
    () => sizeOption?.values.filter(
      (s) => !["one size", "os", "default title", "one-size"].includes(s.toLowerCase()),
    ) ?? [],
    [sizeOption],
  );

  const [selectedSize, setSelectedSize] = useState(() => displaySizes[0] ?? "");
  useEffect(() => { if (displaySizes[0]) setSelectedSize(displaySizes[0]); }, [product.slug]);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const galleryImages = useMemo<string[]>(() => {
    const film = (product.filmstrip as string[]).filter(Boolean);
    if (film.length > 0) return Array.from(new Set(film));
    return product.productShot ? [product.productShot] : [];
  }, [product.productShot, product.filmstrip]);

  useEffect(() => { setThumbLoaded(new Array(galleryImages.length).fill(false)); }, [galleryImages.length, handle]);

  // Set the mobile gallery track's initial position imperatively so React's
  // reconciler never overwrites it on re-renders (memory: moi-product-carousel).
  // Deps include `handle` (product navigation) and `loading` (skeleton → content
  // transition) so this fires whenever the track is newly mounted or the product
  // changes — not just when galleryImages.length changes.
  useLayoutEffect(() => {
    const track = mobileGalleryTrackRef.current;
    if (!track) return;
    const N = galleryImages.length;
    const rawIdx = N > 1 ? 1 : 0;
    mobileGalleryRawIdxRef.current = rawIdx;
    track.style.transition = "none";
    track.style.transform = `translateX(-${rawIdx * 100}%)`;
  }, [galleryImages.length, handle, loading]);



  // Preload all gallery images so thumbnails and swipes are instant, no spinners
  useEffect(() => {
    galleryImages.forEach((src) => {
      if (!src) return;
      const img = new Image();
      img.src = src;
    });
  }, [handle]);

  const mainImage = galleryImages[galleryIndex] ?? product.productShot;

  const prevImg = useCallback(() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length]);
  const nextImg = useCallback(() => setGalleryIndex((i) => (i + 1) % galleryImages.length), [galleryImages.length]);


  // Mobile gallery slide carousel refs
  const mobileGalleryTrackRef = useRef<HTMLDivElement>(null);
  const mobileGalleryRawIdxRef = useRef(1); // position in extended array [last, ...all, first]
  const mobileGalleryDragRef = useRef<{ x: number; y: number } | null>(null);
  const mobileGalleryDidDragRef = useRef(false);

  useMobileGallerySwipe({
    galleryImages,
    handle,
    loading,
    trackMounted,
    mobileGalleryTrackRef,
    mobileGalleryRawIdxRef,
    mobileGalleryDragRef,
    mobileGalleryDidDragRef,
    setGalleryIndex,
    setLightboxOpen,
  });

  // Callback ref: sets the transform immediately when the track element mounts.
  // The useLayoutEffect alone is insufficient because AnimatePresence mode="wait"
  // means the content div enters AFTER the skeleton exits — so when loading flips
  // to false the track isn't in the DOM yet and the ref is null. The callback ref
  // fires synchronously on mount regardless of AnimatePresence timing.
  const setMobileGalleryTrackRef = useCallback((el: HTMLDivElement | null) => {
    mobileGalleryTrackRef.current = el;
    if (!el) {
      setTrackMounted(false);
      return;
    }
    const N = galleryImages.length;
    const rawIdx = N > 1 ? 1 : 0;
    mobileGalleryRawIdxRef.current = rawIdx;
    el.style.transition = "none";
    el.style.transform = `translateX(-${rawIdx * 100}%)`;
    setTrackMounted(true);
  }, [galleryImages.length]);

  const selectedVariant = (() => {
    const variants = product.variants;
    if (!variants?.length) return undefined;
    const colorLower = pageColorName.toLowerCase();
    const sizeOptName = sizeOption?.optionName.toLowerCase() ?? "";
    const sizeLower = selectedSize.toLowerCase();

    if (pageColorName) {
      // 1. Color (case-insensitive) + size match
      const withBoth = variants.find((v) =>
        v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === colorLower) &&
        (!sizeOption || v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOptName && o.value.toLowerCase() === sizeLower))
      );
      if (withBoth) return withBoth;
      // 2. Color match only (ignore size)
      const colorOnly = variants.find((v) =>
        v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === colorLower)
      );
      if (colorOnly) return colorOnly;
      // 3. No color match at all — return undefined so we never leak a wrong-color variant
      return undefined;
    }

    // No color constraint on this page — pick by size or fallback to first
    if (sizeOption) {
      return variants.find((v) =>
        v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOptName && o.value.toLowerCase() === sizeLower)
      ) ?? variants[0];
    }
    return variants[0];
  })();

  const isOutOfStock = selectedVariant ? !selectedVariant.availableForSale : false;
  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveCompareAtPrice = selectedVariant?.compareAtPrice ?? (product as unknown as { compareAtPrice?: string }).compareAtPrice;

  const handleAddToCart = () => {
    if (isOutOfStock || addingRef.current) return;
    // Prevent duplicate taps — ref is synchronous unlike state
    addingRef.current = true;
    // Immediate visual feedback
    setAddedFeedback(true);
    trackAddToCart(
      selectedVariant?.id ?? product.variantId ?? "",
      product.name,
      1,
      parseEGP(String(effectivePrice)) || 0,
    );
    // Fire-and-forget — cart opens immediately inside addToCart (optimistic)
    // Cart title must be the base product name without the color suffix,
    // so it stays stable when Shopify syncs (Shopify uses the parent title).
    const baseProductName = product.name.includes(" — ")
      ? product.name.split(" — ")[0]
      : product.name;
    void addToCart({
      // When a specific color is required (pageColorName set), never fall back
      // to product.variantId (which may be a different color's first variant).
      // Use "" which will surface an error at checkout rather than silently
      // adding the wrong color. In practice this path is unreachable after the
      // stale-guard fix in useShopifyProductByHandle.
      variantId: selectedVariant?.id ?? (pageColorName ? "" : (product.variantId ?? "")),
      title: baseProductName,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: pageColorName || product.name,
    });
    showAddedToBagToast(pageColorName || undefined, selectedSize || undefined);
    setTimeout(() => {
      addingRef.current = false;
      setAddedFeedback(false);
    }, 1800);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    trackAddToCart(
      selectedVariant?.id ?? product.variantId ?? "",
      product.name,
      1,
      parseEGP(String(effectivePrice)) || 0,
    );
    const buyNowTitle = product.name.includes(" — ")
      ? product.name.split(" — ")[0]
      : product.name;
    buyNow({
      variantId: selectedVariant?.id ?? (pageColorName ? "" : (product.variantId ?? "")),
      title: buyNowTitle,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: pageColorName || product.name,
    });
  };


  const subscribeToRestock = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const variantId = selectedVariant?.id ?? product.variantId ?? `${product.name}-fallback`;
    try {
      const res = await fetch("/api/restock/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productHandle: handle, variantId, variantTitle: selectedSize || "One Size", productTitle: product.name }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      return json.success ? { success: true } : { success: false, error: json.error ?? "Something went wrong." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const handleNotifyMe = async () => {
    if (customer?.email) {
      const result = await subscribeToRestock(customer.email);
      if (result.success) {
        toast.success("You're on the list.", { description: `We'll email you when it's back.`, duration: 3000 });
      } else {
        toast.error(result.error ?? "Could not subscribe.");
      }
    } else {
      setNotifyModalOpen(true);
    }
  };

  const BG = "#faf8f5";

  return (
    <>
      <div
        className="min-h-screen"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(245,240,232,0.6) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(230,220,205,0.25) 0%, transparent 50%), #faf8f5",
        }}
      >
        {/* Back button — mobile/tablet only; desktop uses breadcrumb inside content */}
        <div className="lg:hidden w-full px-5 pt-20 pb-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-60"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 9,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#8a7e74",
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.4} />
            Back
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ProductSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >

              <ProductDesktopLayout
                product={product}
                pageColorName={pageColorName}
                galleryImages={galleryImages}
                galleryIndex={galleryIndex}
                setGalleryIndex={setGalleryIndex}
                imgLoaded={imgLoaded}
                setImgLoaded={setImgLoaded}
                thumbLoaded={thumbLoaded}
                setThumbLoaded={setThumbLoaded}
                isOutOfStock={isOutOfStock}
                effectivePrice={effectivePrice}
                effectiveCompareAtPrice={effectiveCompareAtPrice ?? null}
                displaySizes={displaySizes}
                selectedSize={selectedSize}
                setSelectedSize={setSelectedSize}
                sizeOption={sizeOption}
                selectedVariant={selectedVariant}
                addedFeedback={addedFeedback}
                applePayAvailable={applePayAvailable}
                waHover={waHover}
                setWaHover={setWaHover}
                setSizeGuideOpen={setSizeGuideOpen}
                setLightboxOpen={setLightboxOpen}
                onBack={onBack}
                nextImg={nextImg}
                prevImg={prevImg}
                handleAddToCart={handleAddToCart}
                handleBuyNow={handleBuyNow}
                handleNotifyMe={handleNotifyMe}
              />

              <ProductMobileSection
                product={product}
                pageColorName={pageColorName}
                galleryImages={galleryImages}
                galleryIndex={galleryIndex}
                setGalleryIndex={setGalleryIndex}
                setLightboxOpen={setLightboxOpen}
                isOutOfStock={isOutOfStock}
                effectivePrice={effectivePrice}
                effectiveCompareAtPrice={effectiveCompareAtPrice ?? null}
                displaySizes={displaySizes}
                selectedSize={selectedSize}
                setSelectedSize={setSelectedSize}
                sizeOption={sizeOption}
                selectedVariant={selectedVariant}
                applePayAvailable={applePayAvailable}
                addedFeedback={addedFeedback}
                waHover={waHover}
                setWaHover={setWaHover}
                setSizeGuideOpen={setSizeGuideOpen}
                handleNotifyMe={handleNotifyMe}
                handleAddToCart={handleAddToCart}
                handleBuyNow={handleBuyNow}
                setMobileGalleryTrackRef={setMobileGalleryTrackRef}
                mobileGalleryRawIdxRef={mobileGalleryRawIdxRef}
                mobileGalleryDragRef={mobileGalleryDragRef}
                mobileGalleryDidDragRef={mobileGalleryDidDragRef}
              />

              {/* ══ REVIEWS ══ */}
              <ProductReviews reviews={reviews} reviewsLoaded={reviewsLoaded} onWriteReview={() => setReviewModalOpen(true)} />

              {/* ══ YOU MAY ALSO LIKE ══ */}
              {onNavigate && recs.length > 0 && (() => {
                const carouselItems: CarouselItem[] = recs.map((rec) => ({
                  handle: rec.handle,
                  name: rec.name,
                  color: rec.color,
                  swatch: rec.swatch,
                  price: rec.price,
                  image: rec.image(),
                }));
                return (
                  <ProductCarousel
                    items={carouselItems}
                    onItemClick={onNavigate}
                    subheading="You May Also Like"
                    heading="Curated For You"
                  />
                );
              })()}

              {/* ══ FOOTER ══ */}
              <Footer onNavigate={onPageNavigate} />

            </motion.div>
          )}
          </AnimatePresence>
      </div>

      <NotifyMeModal
        open={notifyModalOpen}
        productTitle={product.name}
        variantTitle={selectedSize || "One Size"}
        onClose={() => setNotifyModalOpen(false)}
        onSubmit={subscribeToRestock}
      />

      <WriteReviewModal
        open={reviewModalOpen}
        productHandle={product.slug}
        onClose={() => setReviewModalOpen(false)}
      />

      {/* Full-screen zoom lightbox — pinch, double-tap, swipe nav */}
      <CinematicLightbox
        images={galleryImages}
        initialIndex={galleryIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Carousel quick-view gallery */}
      <CinematicLightbox
        images={carouselLb.images}
        initialIndex={carouselLb.idx}
        open={carouselLb.open}
        onClose={() => setCarouselLb((s) => ({ ...s, open: false }))}
      />

      <SizeGuideModal open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </>
  );
}
