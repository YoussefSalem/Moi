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
import { ImageSkeleton } from "@/components/ImageSkeleton";
import { trackAddToCart } from "@/lib/analytics";
import { trackViewContent } from "@/lib/metaPixel";
import { trackTikTokViewContent } from "@/lib/tiktokPixel";

import { ENABLE_APPLE_PAY } from "@/config/features";
import { ShopifyApplePayButton } from "@/components/ShopifyApplePayButton";
import { WriteReviewModal } from "@/components/WriteReviewModal";
import { Footer } from "@/components/Footer";

// ── Star rating SVG component ─────────────────────────────────────────────────
interface RecItem {
  handle: string;
  name: string;
  color: string;
  price: string;
  swatch: string;
  image: () => string;
  gallery: () => readonly string[];
}

function buildAllRecs(): RecItem[] {
  const allProducts = [IMAGES.product1, IMAGES.product2] as const;
  const items: RecItem[] = [];
  for (const product of allProducts) {
    const colorImages = product.colorImages as Record<string, string> | undefined;
    const colorGalleries = product.colorGalleries as Record<string, readonly string[]> | undefined;
    const colorSwatches = product.colorSwatches as Record<string, string> | undefined;
    if (!colorImages) continue;
    for (const colorName of Object.keys(colorImages)) {
      const swatch = colorSwatches?.[colorName.toLowerCase()] ?? colorSwatches?.[colorName] ?? "";
      if (!swatch) continue;
      const handle = `${product.slug}-${slugify(colorName)}`;
      items.push({
        handle,
        name: product.name,
        color: colorName,
        price: product.price,
        swatch,
        image: () => colorImages[colorName] ?? product.productShot,
        gallery: () => colorGalleries?.[colorName] ?? [colorImages[colorName] ?? product.productShot],
      });
    }
  }
  return items;
}

const ALL_RECS = buildAllRecs();

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function deriveFallbackFromHandle(handle: string): ProductConfig {
  const allProducts = [IMAGES.product1, IMAGES.product2, IMAGES.product3];
  const matched = allProducts.find(
    (p) => handle.startsWith(p.slug + "-") || handle === p.slug,
  );
  if (!matched) return IMAGES.product1;

  const colorSlug = handle.startsWith(matched.slug + "-")
    ? handle.slice(matched.slug.length + 1)
    : "";

  const colorNames = Object.keys(matched.colorImages ?? {});
  const colorName =
    colorNames.find((c) => slugify(c) === colorSlug) ??
    colorNames[0] ??
    "White";

  const colorImagesMap = (matched.colorImages ?? {}) as unknown as Record<string, string>;
  const colorGalleriesMap = (matched.colorGalleries ?? {}) as unknown as Record<string, string[]>;
  const mainImage: string = colorImagesMap[colorName] ?? matched.productShot;
  const gallery: string[] = (colorGalleriesMap[colorName] as string[] | undefined) ?? [mainImage];

  const allVariants = (matched as unknown as { variants?: Array<{ id: string; availableForSale: boolean; selectedOptions: Array<{ name: string; value: string }>; price?: string; compareAtPrice?: string }> }).variants;
  const filteredVariants = allVariants?.filter((v) =>
    v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && slugify(o.value) === colorSlug,
    ),
  );
  const resolvedVariants = filteredVariants?.length ? filteredVariants : allVariants;

  return {
    ...(matched as unknown as ProductConfig),
    name: colorSlug ? `${matched.name} — ${colorName}` : matched.name,
    productShot: mainImage,
    filmstrip: gallery,
    variants: resolvedVariants,
  } as ProductConfig;
}

function ZoomableImage({ src, alt, resetKey, onPinchStart }: {
  src: string;
  alt: string;
  resetKey: number;
  onPinchStart?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const pinchRef = useRef<{ dist: number; startScale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(null);
  const lastTapRef = useRef(0);
  const isPinchingRef = useRef(false);
  // Keep a stable ref to the latest onPinchStart callback
  const onPinchStartRef = useRef(onPinchStart);
  onPinchStartRef.current = onPinchStart;

  const applyTransform = useCallback((animated = false) => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transition = animated ? "transform 0.22s ease-out" : "none";
    el.style.transform = `scale(${scaleRef.current}) translate(${txRef.current}px, ${tyRef.current}px)`;
  }, []);

  const clampTranslate = useCallback((s: number, x: number, y: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const parent = wrapRef.current?.parentElement;
    if (!parent) return { x, y };
    const rect = parent.getBoundingClientRect();
    const maxX = (rect.width * (s - 1)) / (2 * s);
    const maxY = (rect.height * (s - 1)) / (2 * s);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  useEffect(() => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    isPinchingRef.current = false;
    applyTransform(true);
  }, [resetKey, applyTransform]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const getDistance = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        isPinchingRef.current = true;
        onPinchStartRef.current?.();
        pinchRef.current = { dist: getDistance(e.touches[0], e.touches[1]), startScale: scaleRef.current };
        panRef.current = null;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        const dt = now - lastTapRef.current;
        lastTapRef.current = now;
        if (dt < 300 && dt > 0) {
          e.preventDefault();
          e.stopPropagation();
          lastTapRef.current = 0;
          if (scaleRef.current > 1.1) {
            scaleRef.current = 1; txRef.current = 0; tyRef.current = 0;
            isPinchingRef.current = false;
          } else {
            scaleRef.current = 2;
            const c = clampTranslate(2, txRef.current, tyRef.current);
            txRef.current = c.x; tyRef.current = c.y;
          }
          applyTransform(true);
          return;
        }
        if (scaleRef.current > 1) {
          e.preventDefault();
          e.stopPropagation();
          panRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, startTx: txRef.current, startTy: tyRef.current };
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const newDist = getDistance(e.touches[0], e.touches[1]);
        let s = pinchRef.current.startScale * (newDist / pinchRef.current.dist);
        s = Math.max(1, Math.min(4, s));
        scaleRef.current = s;
        const c = clampTranslate(s, txRef.current, tyRef.current);
        txRef.current = c.x; tyRef.current = c.y;
        applyTransform();
      } else if (e.touches.length === 1 && panRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const dx = (e.touches[0].clientX - panRef.current.x) / scaleRef.current;
        const dy = (e.touches[0].clientY - panRef.current.y) / scaleRef.current;
        const c = clampTranslate(scaleRef.current, panRef.current.startTx + dx, panRef.current.startTy + dy);
        txRef.current = c.x; tyRef.current = c.y;
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
        if (e.touches.length === 0) isPinchingRef.current = false;
      }
      if (e.touches.length === 0) panRef.current = null;
      if (scaleRef.current < 1.15) {
        scaleRef.current = 1; txRef.current = 0; tyRef.current = 0;
        isPinchingRef.current = false;
        applyTransform(true);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform, clampTranslate]);

  // Belt-and-suspenders: stop pointer events from reaching the gallery swipe
  // handler when we own the gesture (zoomed or mid-pinch). This catches browsers
  // where pointerdown fires before touchstart, preventing preventDefault from
  // cancelling already-dispatched pointer events.
  const stopIfActive = useCallback((e: React.PointerEvent) => {
    if (scaleRef.current > 1 || isPinchingRef.current) {
      e.stopPropagation();
    }
  }, []);

  return (
    <div
      ref={wrapRef}
      onPointerDown={stopIfActive}
      onPointerMove={stopIfActive}
      onPointerUp={stopIfActive}
      onPointerCancel={stopIfActive}
      style={{ width: "100%", height: "100%", transformOrigin: "center center", willChange: "transform" }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block", userSelect: "none", pointerEvents: "none" }}
        loading="eager"
        draggable={false}
      />
    </div>
  );
}

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
  interface ReviewItem {
    id: number;
    author: string;
    title: string;
    body: string;
    rating: number;
    date: string;
  }
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

  // Native touch swipe handler for the mobile gallery.
  // Pointer events + setPointerCapture are unreliable on iOS when any child has
  // non-passive touch listeners (iOS ignores touchAction in that case).
  // This useEffect attaches touchmove with { passive: false } so we can call
  // preventDefault() ONLY for horizontal swipes, letting vertical scrolls pass through.
  useEffect(() => {
    const track = mobileGalleryTrackRef.current;
    const N = galleryImages.length;
    if (!track || N <= 1) return;

    let startX = 0;
    let startY = 0;
    let dirLocked: "h" | "v" | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dirLocked = null;
      mobileGalleryDragRef.current = { x: startX, y: startY };
      mobileGalleryDidDragRef.current = false;
      track.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !mobileGalleryDragRef.current) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!dirLocked) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        dirLocked = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }

      if (dirLocked === "v") {
        // Vertical scroll intent — cancel swipe and let browser scroll
        mobileGalleryDragRef.current = null;
        mobileGalleryDidDragRef.current = false;
        track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
        return;
      }

      // Horizontal swipe — block scroll
      e.preventDefault();
      mobileGalleryDidDragRef.current = true;
      const pct = mobileGalleryRawIdxRef.current * 100;
      track.style.transform = `translateX(calc(-${pct}% + ${dx}px))`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!mobileGalleryDragRef.current) return;
      const { x: sx } = mobileGalleryDragRef.current;
      mobileGalleryDragRef.current = null;
      const didDrag = mobileGalleryDidDragRef.current;
      mobileGalleryDidDragRef.current = false;

      if (!didDrag) {
        setLightboxOpen(true);
        track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
        track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
        return;
      }

      const endX = e.changedTouches[0]?.clientX ?? sx;
      const dx = endX - sx;
      const dir = dx < -20 ? 1 : dx > 20 ? -1 : 0;
      let rawIdx = mobileGalleryRawIdxRef.current + dir;

      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
      track.style.transform = `translateX(-${rawIdx * 100}%)`;
      mobileGalleryRawIdxRef.current = rawIdx;

      const suppressClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        window.removeEventListener("click", suppressClick, true);
      };
      window.addEventListener("click", suppressClick, true);

      track.addEventListener("transitionend", function onEnd() {
        track.removeEventListener("transitionend", onEnd);
        if (rawIdx <= 0) {
          rawIdx = N;
          track.style.transition = "none";
          track.style.transform = `translateX(-${rawIdx * 100}%)`;
          mobileGalleryRawIdxRef.current = rawIdx;
        } else if (rawIdx >= N + 1) {
          rawIdx = 1;
          track.style.transition = "none";
          track.style.transform = `translateX(-${rawIdx * 100}%)`;
          mobileGalleryRawIdxRef.current = rawIdx;
        }
        setGalleryIndex((rawIdx - 1 + N) % N);
      });
    };

    const onTouchCancel = () => {
      mobileGalleryDragRef.current = null;
      mobileGalleryDidDragRef.current = false;
      dirLocked = null;
      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
      track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
    };

    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchmove", onTouchMove, { passive: false });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    track.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchmove", onTouchMove);
      track.removeEventListener("touchend", onTouchEnd);
      track.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [galleryImages.length, handle, loading, trackMounted, setGalleryIndex, setLightboxOpen]);

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

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);

  // Mobile gallery slide carousel refs
  const mobileGalleryTrackRef = useRef<HTMLDivElement>(null);
  const mobileGalleryRawIdxRef = useRef(1); // position in extended array [last, ...all, first]
  const mobileGalleryDragRef = useRef<{ x: number; y: number } | null>(null);
  const mobileGalleryDidDragRef = useRef(false);

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
              {/* ── DESKTOP skeleton (lg+): 3-col to match real layout ── */}
              <div className="hidden lg:block" style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 28px 96px" }}>
                {/* Breadcrumb */}
                <div className="relative overflow-hidden rounded mb-10" style={{ height: 12, width: 160, backgroundColor: "rgba(30,24,20,0.05)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                </div>
                {/* 3-col grid */}
                <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.35fr 0.85fr", gap: "0 48px", alignItems: "start" }}>
                  {/* Col 1: Story */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
                    <div className="relative overflow-hidden rounded" style={{ height: 10, width: 80, backgroundColor: "rgba(30,24,20,0.05)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div className="relative overflow-hidden rounded" style={{ height: 44, width: "80%", backgroundColor: "rgba(30,24,20,0.05)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div className="relative overflow-hidden rounded" style={{ height: 36, width: "55%", backgroundColor: "rgba(30,24,20,0.04)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)", margin: "4px 0" }} />
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="relative overflow-hidden rounded" style={{ height: 12, width: i === 4 ? "65%" : "100%", backgroundColor: "rgba(30,24,20,0.04)" }}>
                        <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                      </div>
                    ))}
                  </div>
                  {/* Col 2: Image */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="relative overflow-hidden" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.05)", boxShadow: "0 16px 56px rgba(30,24,20,0.08)" }}>
                      <ImageSkeleton variant="warm" />
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="relative overflow-hidden" style={{ width: 58, height: 76, backgroundColor: "rgba(30,24,20,0.05)" }}>
                          <ImageSkeleton variant="warm" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Col 3: Purchase */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
                    <div className="relative overflow-hidden rounded" style={{ height: 34, width: "60%", backgroundColor: "rgba(30,24,20,0.05)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)" }} />
                    <div className="relative overflow-hidden rounded" style={{ height: 10, width: 64, backgroundColor: "rgba(30,24,20,0.04)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.07)" }} />
                      ))}
                    </div>
                    <div className="relative overflow-hidden rounded" style={{ height: 10, width: 48, backgroundColor: "rgba(30,24,20,0.04)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="relative overflow-hidden rounded" style={{ height: 32, flex: 1, backgroundColor: "rgba(30,24,20,0.05)" }}>
                          <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                        </div>
                      ))}
                    </div>
                    <div className="relative overflow-hidden rounded" style={{ height: 46, backgroundColor: "rgba(30,24,20,0.07)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                    <div className="relative overflow-hidden rounded" style={{ height: 46, backgroundColor: "rgba(30,24,20,0.04)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MOBILE skeleton (<lg): gallery → info stack ── */}
              <div className="lg:hidden">
                {/* Full-bleed image */}
                <div className="relative overflow-hidden w-full" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.05)" }}>
                  <ImageSkeleton variant="warm" />
                </div>
                {/* Dot indicators */}
                <div style={{ display: "flex", gap: 5, justifyContent: "center", padding: "10px 0 4px" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ height: 5, borderRadius: 3, backgroundColor: `rgba(30,24,20,${i === 1 ? 0.2 : 0.07})`, width: i === 1 ? 18 : 5 }} />
                  ))}
                </div>
                {/* Info */}
                <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="relative overflow-hidden rounded" style={{ height: 36, width: "75%", backgroundColor: "rgba(30,24,20,0.05)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                  <div className="relative overflow-hidden rounded" style={{ height: 22, width: "35%", backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                  <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)" }} />
                  <div className="relative overflow-hidden rounded" style={{ height: 10, width: 60, backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.07)" }} />
                    ))}
                  </div>
                  <div className="relative overflow-hidden rounded" style={{ height: 10, width: 44, backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="relative overflow-hidden rounded" style={{ height: 38, flex: 1, backgroundColor: "rgba(30,24,20,0.05)" }}>
                        <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                      </div>
                    ))}
                  </div>
                  <div className="relative overflow-hidden rounded" style={{ height: 48, backgroundColor: "rgba(30,24,20,0.07)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >

              {/* ══ DESKTOP — 3-column grid (≥ lg) ══ */}
              <div className="hidden lg:block">
                {/* Breadcrumb */}
                <div style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 28px 0" }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#a9a09a" }}>
                    <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: "#7a6e64", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit" as const }}>
                      All Products
                    </button>
                    <span style={{ margin: "0 8px" }}>›</span>
                    <span style={{ color: "#1e1814" }}>{product.name.split(" — ")[0]}</span>
                  </p>
                </div>

                {/* 3-col grid */}
                <div
                  style={{
                    maxWidth: 1280,
                    margin: "0 auto",
                    padding: "40px 28px 96px",
                    display: "grid",
                    gridTemplateColumns: "0.85fr 1.35fr 0.85fr",
                    gap: "0 48px",
                    alignItems: "start",
                  }}
                >
                  {/* ── COL 1: Story ── */}
                  <div style={{ paddingTop: 4 }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 16 }}>
                      New Arrival
                    </p>
                    <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(2rem, 2.8vw, 2.6rem)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "0.04em", color: "#1e1814", marginBottom: 16 }}>
                      {product.name.split(" — ")[0]}
                      {pageColorName && (
                        <span style={{ color: "#8a7e74" }}> — {pageColorName}</span>
                      )}
                    </h1>
                    <p style={{ fontSize: 14, lineHeight: 1.6, letterSpacing: "0.02em", color: "#7a6e64", marginBottom: 20, fontWeight: 300 }}>
                      {product.description}
                    </p>
                    <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.10)", marginBottom: 20 }} />
                    {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
                      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 20 }}>
                        {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                          <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ color: "#a9a09a", flexShrink: 0, marginTop: 2, fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>—</span>
                            <span style={{ fontSize: 13, color: "#1e1814", fontWeight: 300, letterSpacing: "0.02em", lineHeight: 1.55 }}>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  {/* ── COL 2: Gallery ── */}
                  <div>
                    <div
                      className="relative overflow-hidden cursor-pointer"
                      style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.04)", boxShadow: "0 16px 56px rgba(30,24,20,0.10)" }}
                      onClick={() => setLightboxOpen(true)}
                      onPointerDown={(e) => { dragStartXRef.current = e.clientX; dragLastXRef.current = e.clientX; }}
                      onPointerMove={(e) => { if (dragStartXRef.current !== null) dragLastXRef.current = e.clientX; }}
                      onPointerUp={(e) => {
                        const start = dragStartXRef.current;
                        if (start === null) return;
                        const delta = (dragLastXRef.current ?? e.clientX) - start;
                        dragStartXRef.current = null; dragLastXRef.current = null;
                        if (Math.abs(delta) > 40) { delta < 0 ? nextImg() : prevImg(); setImgLoaded(false); }
                      }}
                      onPointerLeave={() => { dragStartXRef.current = null; dragLastXRef.current = null; }}
                    >
                      <AnimatePresence initial={false} mode="wait">
                        <motion.img
                          key={mainImage}
                          src={mainImage}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full"
                          style={{ objectFit: "cover" }}
                          loading="eager"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: imgLoaded ? 1 : 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          onLoad={() => setImgLoaded(true)}
                          onError={() => setImgLoaded(true)}
                        />
                      </AnimatePresence>
                      {!imgLoaded && <ImageSkeleton variant="warm" />}
                      {isOutOfStock && (
                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2 pointer-events-none" style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
                        </div>
                      )}
                    </div>
                    {galleryImages.length > 1 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
                        {galleryImages.map((src, i) => (
                          <button
                            key={`${src}-${i}`}
                            type="button"
                            onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                            style={{
                              width: 58, height: 76, border: "none", padding: 0, cursor: "pointer",
                              overflow: "hidden",
                              outline: i === galleryIndex ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.12)",
                              outlineOffset: i === galleryIndex ? 2 : 0,
                              opacity: i === galleryIndex ? 1 : 0.5,
                              transition: "opacity 0.2s, outline 0.15s",
                              flexShrink: 0, background: "none",
                            }}
                          >
                            <div className="relative w-full h-full">
                              {!thumbLoaded[i] && (
                                <div className="absolute inset-0 overflow-hidden" style={{ background: "rgba(230,220,205,0.55)" }}>
                                  <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, transparent 30%, rgba(245,240,232,0.75) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                                </div>
                              )}
                              <img src={src} alt={`View ${i + 1}`} className="w-full h-full" style={{ objectFit: "cover", opacity: thumbLoaded[i] ? 1 : 0, transition: "opacity 0.2s ease" }} loading="eager"
                                onLoad={() => setThumbLoaded(prev => { const next = [...prev]; next[i] = true; return next; })}
                                onError={() => setThumbLoaded(prev => { const next = [...prev]; next[i] = true; return next; })}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── COL 3: Purchase ── */}
                  <div style={{ paddingTop: 4 }}>
                    {/* Price */}
                    <div style={{ marginBottom: 24 }}>
                      {effectiveCompareAtPrice && (
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.9rem", fontWeight: 400, letterSpacing: "0.08em", color: "#8a7e74", textDecoration: "line-through", textDecorationColor: "#c83232", lineHeight: 1.2, marginBottom: 4 }}>
                          {effectiveCompareAtPrice}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 400, letterSpacing: "0.04em", color: effectiveCompareAtPrice ? "#c83232" : "#1e1814", lineHeight: 1 }}>
                          {effectivePrice}
                        </p>
                        {effectiveCompareAtPrice && (
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", color: "#c83232" }}>
                            {(() => { const p = parseEGP(String(effectivePrice)); const c = parseEGP(String(effectiveCompareAtPrice)); if (!p || !c || c <= p) return null; return `Save ${Math.round((1 - p / c) * 100)}%`; })()}
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#a9a09a", marginTop: 6, letterSpacing: "0.04em", fontWeight: 300 }}>
                        Free delivery on orders over 1,500 EGP
                      </p>
                    </div>

                    <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.10)", marginBottom: 24 }} />

                    {/* Size */}
                    {displaySizes.length > 1 && (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64" }}>Size</span>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                            <button type="button" onClick={() => setSizeGuideOpen(true)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#7a6e64", fontWeight: 400, letterSpacing: "0.08em", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Size Guide</button>
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300, letterSpacing: "0.04em" }}>{selectedSize}</span>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(displaySizes.length, 4)}, 1fr)`, gap: 8 }}>
                          {displaySizes.map((size) => {
                            const available = product.variants?.some((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value.toLowerCase() === size.toLowerCase()) && v.availableForSale) ?? true;
                            const isSelected = selectedSize === size;
                            return (
                              <button key={size} type="button" onClick={() => setSelectedSize(size)}
                                style={{ height: 40, position: "relative", overflow: "hidden", border: isSelected ? "1.5px solid #1e1814" : "1px solid #d4cdc8", borderRadius: 0, backgroundColor: isSelected ? "#1e1814" : "transparent", color: !available ? "rgba(30,24,20,0.36)" : isSelected ? "#faf8f5" : "#1e1814", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "all 0.15s" }}
                              >
                                {!available && (<span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}><line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(30,24,20,0.18)" strokeWidth="1" /></svg></span>)}
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* CTAs */}
                    {isOutOfStock ? (
                      <motion.button type="button" onClick={handleNotifyMe} whileTap={{ scale: 0.98 }}
                        style={{ width: "100%", height: 48, backgroundColor: "rgba(30,24,20,0.9)", color: "#f5f0e8", border: "none", borderRadius: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <Bell size={11} strokeWidth={1.8} />
                        Notify Me When Back
                      </motion.button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                        {/* Express Checkout — only on Apple Pay capable devices */}
                        {applePayAvailable && (
                          <>
                            <p style={{
                              fontFamily: "'Montserrat', sans-serif",
                              fontSize: 10,
                              fontWeight: 400,
                              letterSpacing: "0.3em",
                              textTransform: "uppercase" as const,
                              color: "rgba(30,24,20,0.38)",
                              textAlign: "center",
                              marginBottom: "12px",
                            }}>Express Checkout</p>
                            <ShopifyApplePayButton
                              variantId={selectedVariant?.id ?? product.variantId ?? ""}
                              quantity={1}
                              priceEGP={parseEGP(String(effectivePrice)) || 0}
                              disabled={isOutOfStock}
                              style={{ width: "100%" }}
                              onSuccess={(orderNumber, total) => { toast.success(`Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`, { duration: 5000 }); }}
                              onError={(msg) => { toast.error(msg, { duration: 4000 }); }}
                            />
                            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
                              <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                              <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                            </div>
                          </>
                        )}
                        <motion.button type="button" onClick={handleAddToCart} whileTap={{ scale: 0.98 }}
                          style={{ width: "100%", height: 48, borderRadius: 0, backgroundColor: addedFeedback ? "#2d6a4f" : "transparent", color: addedFeedback ? "#faf8f5" : "#1e1814", border: addedFeedback ? "none" : "1.5px solid #1e1814", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.3s, color 0.3s, border-color 0.3s" }}
                        >
                          {addedFeedback ? "Added to Bag ✓" : "Add to Bag"}
                        </motion.button>
                        <motion.button type="button" onClick={handleBuyNow} whileTap={{ scale: 0.98 }}
                          style={{ width: "100%", height: 48, borderRadius: 0, border: "none", backgroundColor: "#1e1814", color: "#faf8f5", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}
                        >
                          Buy It Now
                        </motion.button>
                        {/* or separator */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                          <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                        </div>
                        {/* WhatsApp order */}
                        <a
                          href={`https://wa.me/201200520083?text=${encodeURIComponent(`Hi, I'd like to order the ${product.name}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          onMouseEnter={() => setWaHover(true)} onMouseLeave={() => setWaHover(false)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 44, borderRadius: 0, border: `1.5px solid ${waHover ? "#25d366" : "rgba(37,211,102,0.4)"}`, backgroundColor: waHover ? "rgba(37,211,102,0.06)" : "transparent", color: "#25d366", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, textDecoration: "none", fontFamily: "'Montserrat', sans-serif", boxShadow: waHover ? "0 0 0 3px rgba(37,211,102,0.14)" : "none", transition: "all 0.2s" }}
                        >
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.526 5.856L.057 23.215a.75.75 0 00.928.908l5.444-1.466A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.714 9.714 0 01-4.95-1.355l-.355-.211-3.676.99.997-3.584-.232-.37A9.715 9.715 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                          Order via WhatsApp
                        </a>
                        {/* Trust badges */}
                        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, padding: "12px 14px", border: "1px solid rgba(30,24,20,0.10)", borderRadius: 4 }}>
                          {[
                            { icon: <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="7" rx="1" stroke="#6b6258" strokeWidth="1.3"/><path d="M4 6V5a4 4 0 018 0v1" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5" cy="12" r="1.5" fill="#6b6258"/><circle cx="11" cy="12" r="1.5" fill="#6b6258"/></svg>, text: "2–4 day delivery in Egypt" },
                            { icon: <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="9" rx="1" stroke="#6b6258" strokeWidth="1.3"/><path d="M5 6V4.5A3 3 0 018 1.5v0A3 3 0 0111 4.5V6" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/><line x1="8" y1="9" x2="8" y2="12" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/><line x1="6.5" y1="10.5" x2="9.5" y2="10.5" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/></svg>, text: "Cash on delivery available" },
                            { icon: <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1.5z" stroke="#6b6258" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 8l1.5 1.5L10.5 6" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: "Secure checkout" },
                          ].map(({ icon, text }) => (
                            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {icon}
                              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, color: "#6b6258", fontWeight: 400, letterSpacing: "0.03em" }}>{text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>{/* end 3-col */}
              </div>{/* end desktop */}

              {/* ══ MOBILE / TABLET stacked (< lg) ══ */}
              <div className="lg:hidden" style={{ paddingBottom: 96 }}>
                {/* Full-bleed sliding gallery */}
                {(() => {
                  const N = galleryImages.length;
                  const extended = N > 1
                    ? [galleryImages[N - 1], ...galleryImages, galleryImages[0]]
                    : galleryImages;

                  const jumpToSlide = (targetGalleryIdx: number) => {
                    const rawIdx = targetGalleryIdx + 1;
                    mobileGalleryRawIdxRef.current = rawIdx;
                    const track = mobileGalleryTrackRef.current;
                    if (track) {
                      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
                      track.style.transform = `translateX(-${rawIdx * 100}%)`;
                    }
                    setGalleryIndex(targetGalleryIdx);
                  };

                  // Pointer handlers below are MOUSE-ONLY (desktop drag).
                  // Touch is handled by the native touch useEffect above the JSX.
                  const handleGalleryPointerDown = (e: React.PointerEvent) => {
                    if (e.pointerType === "touch") return;
                    if (N <= 1) return;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    mobileGalleryDragRef.current = { x: e.clientX, y: e.clientY };
                    mobileGalleryDidDragRef.current = false;
                    const track = mobileGalleryTrackRef.current;
                    if (track) track.style.transition = "none";
                  };

                  const handleGalleryPointerMove = (e: React.PointerEvent) => {
                    if (e.pointerType === "touch") return;
                    if (!mobileGalleryDragRef.current) return;
                    const dx = e.clientX - mobileGalleryDragRef.current.x;
                    if (!mobileGalleryDidDragRef.current && Math.abs(dx) < 8) return;
                    mobileGalleryDidDragRef.current = true;
                    e.preventDefault();
                    const track = mobileGalleryTrackRef.current;
                    if (track) {
                      const pct = mobileGalleryRawIdxRef.current * 100;
                      track.style.transform = `translateX(calc(-${pct}% + ${dx}px))`;
                    }
                  };

                  const handleGalleryPointerUp = (e: React.PointerEvent) => {
                    if (e.pointerType === "touch") return;
                    if (!mobileGalleryDragRef.current) return;
                    const { x: startX } = mobileGalleryDragRef.current;
                    mobileGalleryDragRef.current = null;
                    const didDrag = mobileGalleryDidDragRef.current;
                    mobileGalleryDidDragRef.current = false;
                    const track = mobileGalleryTrackRef.current;
                    if (!track) return;

                    if (!didDrag) {
                      setLightboxOpen(true);
                      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
                      track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
                      return;
                    }

                    const dx = e.clientX - startX;
                    const dir = dx < -20 ? 1 : dx > 20 ? -1 : 0;
                    let rawIdx = mobileGalleryRawIdxRef.current + dir;

                    track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
                    track.style.transform = `translateX(-${rawIdx * 100}%)`;
                    mobileGalleryRawIdxRef.current = rawIdx;

                    const suppressClick = (ev: MouseEvent) => {
                      ev.stopPropagation(); ev.preventDefault();
                      window.removeEventListener("click", suppressClick, true);
                    };
                    window.addEventListener("click", suppressClick, true);

                    track.addEventListener("transitionend", function onEnd() {
                      track.removeEventListener("transitionend", onEnd);
                      if (rawIdx <= 0) {
                        rawIdx = N;
                        track.style.transition = "none";
                        track.style.transform = `translateX(-${rawIdx * 100}%)`;
                        mobileGalleryRawIdxRef.current = rawIdx;
                      } else if (rawIdx >= N + 1) {
                        rawIdx = 1;
                        track.style.transition = "none";
                        track.style.transform = `translateX(-${rawIdx * 100}%)`;
                        mobileGalleryRawIdxRef.current = rawIdx;
                      }
                      setGalleryIndex((rawIdx - 1 + N) % N);
                    });
                  };

                  const handleGalleryPointerCancel = () => {
                    mobileGalleryDragRef.current = null;
                    mobileGalleryDidDragRef.current = false;
                    const track = mobileGalleryTrackRef.current;
                    if (track) {
                      track.style.transition = "transform 0.32s cubic-bezier(0.22,1,0.36,1)";
                      track.style.transform = `translateX(-${mobileGalleryRawIdxRef.current * 100}%)`;
                    }
                  };

                  return (
                    <div
                      className="relative overflow-hidden"
                      data-no-carousel
                      style={{ backgroundColor: "rgba(30,24,20,0.04)", touchAction: N > 1 ? "pan-y" : "auto" }}
                    >
                      <div
                        ref={setMobileGalleryTrackRef}
                        style={{
                          display: "flex",
                          willChange: "transform",
                        }}
                        onPointerDown={handleGalleryPointerDown}
                        onPointerMove={handleGalleryPointerMove}
                        onPointerUp={handleGalleryPointerUp}
                        onPointerCancel={handleGalleryPointerCancel}
                      >
                        {extended.map((src, i) => (
                          <div key={i} style={{ flex: "0 0 100%", aspectRatio: "3/4", position: "relative", overflow: "hidden" }}>
                            <ZoomableImage src={src} alt={product.name} resetKey={galleryIndex} onPinchStart={handleGalleryPointerCancel} />
                          </div>
                        ))}
                      </div>

                      {isOutOfStock && (
                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2 pointer-events-none" style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
                        </div>
                      )}

                      {N > 1 && (
                        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 10 }}>
                          {galleryImages.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); jumpToSlide(i); }}
                              style={{ width: i === galleryIndex ? 18 : 6, height: 6, borderRadius: 9999, border: "none", padding: 0, cursor: "pointer", backgroundColor: i === galleryIndex ? "#faf8f5" : "rgba(250,248,245,0.45)", transition: "width 0.22s, background-color 0.22s" }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Info block */}
                <div style={{ padding: "28px 20px 0" }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 10 }}>
                    New Arrival
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                    <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.77rem, 7vw, 2.4rem)", fontWeight: 400, letterSpacing: "0.04em", lineHeight: 1.1, color: "#1e1814" }}>
                      {product.name.split(" — ")[0]}
                      {pageColorName && (
                        <span style={{ color: "#8a7e74" }}> — {pageColorName}</span>
                      )}
                    </h1>
                    <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                      {effectiveCompareAtPrice && (
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.88rem", fontWeight: 400, letterSpacing: "0.08em", color: "#8a7e74", textDecoration: "line-through", textDecorationColor: "#c83232" }}>
                          {effectiveCompareAtPrice}
                        </p>
                      )}
                      <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.1rem, 4vw, 1.5rem)", fontWeight: 400, letterSpacing: "0.04em", color: effectiveCompareAtPrice ? "#c83232" : "#1e1814" }}>
                        {effectivePrice}
                      </p>
                    </div>
                  </div>

                  {/* Size */}
                  {displaySizes.length > 1 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64" }}>Size</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                          <button type="button" onClick={() => setSizeGuideOpen(true)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#7a6e64", fontWeight: 400, letterSpacing: "0.08em", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Size Guide</button>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300 }}>{selectedSize}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {displaySizes.map((size) => {
                          const available = product.variants?.some((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value.toLowerCase() === size.toLowerCase()) && v.availableForSale) ?? true;
                          const isSelected = selectedSize === size;
                          return (
                            <button key={size} type="button" onClick={() => setSelectedSize(size)}
                              style={{ flex: 1, height: 42, position: "relative", overflow: "hidden", border: isSelected ? "1.5px solid #1e1814" : "1px solid #d4cdc8", borderRadius: 0, backgroundColor: isSelected ? "#1e1814" : "transparent", color: !available ? "rgba(30,24,20,0.36)" : isSelected ? "#faf8f5" : "#1e1814", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "all 0.15s" }}
                            >
                              {!available && (<span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}><line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(30,24,20,0.18)" strokeWidth="1" /></svg></span>)}
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <p style={{ fontSize: 13, lineHeight: 1.75, color: "#7a6e64", fontWeight: 300, letterSpacing: "0.02em", marginBottom: 24 }}>
                    {product.description}
                  </p>

                  {/* Out-of-stock CTA — inline */}
                  {isOutOfStock && (
                    <motion.button type="button" onClick={handleNotifyMe} whileTap={{ scale: 0.98 }}
                      style={{ width: "100%", height: 48, backgroundColor: "rgba(30,24,20,0.9)", color: "#f5f0e8", border: "none", borderRadius: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}
                    >
                      <Bell size={11} strokeWidth={1.8} />
                      Notify Me When Back
                    </motion.button>
                  )}

                </div>

                {/* Sticky bottom CTA bar */}
                {!isOutOfStock && (
                  <div style={{ padding: "16px 20px", paddingBottom: "calc(16px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column" as const, gap: 10 }}>
                    {/* Express Checkout — only on Apple Pay capable devices */}
                    {applePayAvailable && (
                      <>
                        <p style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: 10,
                          fontWeight: 400,
                          letterSpacing: "0.3em",
                          textTransform: "uppercase" as const,
                          color: "rgba(30,24,20,0.38)",
                          textAlign: "center",
                          marginBottom: "12px",
                        }}>Express Checkout</p>
                        <ShopifyApplePayButton
                          variantId={selectedVariant?.id ?? product.variantId ?? ""}
                          quantity={1}
                          priceEGP={parseEGP(String(effectivePrice)) || 0}
                          disabled={isOutOfStock}
                          style={{ width: "100%" }}
                          onSuccess={(orderNumber, total) => { toast.success(`Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`, { duration: 5000 }); }}
                          onError={(msg) => { toast.error(msg, { duration: 4000 }); }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
                          <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                          <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                        </div>
                      </>
                    )}
                    <motion.button type="button" onClick={handleAddToCart} whileTap={{ scale: 0.98 }}
                      style={{ width: "100%", height: 52, borderRadius: 0, backgroundColor: addedFeedback ? "#2d6a4f" : "transparent", color: addedFeedback ? "#faf8f5" : "#1e1814", border: addedFeedback ? "none" : "1.5px solid #1e1814", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.3s, color 0.3s, border-color 0.3s" }}
                    >
                      {addedFeedback ? "Added ✓" : `Add to Bag — ${effectivePrice}`}
                    </motion.button>
                    <motion.button type="button" onClick={handleBuyNow} whileTap={{ scale: 0.98 }}
                      style={{ width: "100%", height: 52, borderRadius: 0, border: "none", backgroundColor: "#1e1814", color: "#faf8f5", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      Buy Now
                    </motion.button>
                    {/* or separator — mobile */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                    </div>
                    {/* WhatsApp order — mobile */}
                    <a
                      href={`https://wa.me/201200520083?text=${encodeURIComponent(`Hi, I'd like to order the ${product.name}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      onPointerDown={() => setWaHover(true)} onPointerUp={() => setWaHover(false)} onPointerLeave={() => setWaHover(false)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 50, borderRadius: 0, border: `1.5px solid ${waHover ? "#25d366" : "rgba(37,211,102,0.4)"}`, backgroundColor: waHover ? "rgba(37,211,102,0.06)" : "transparent", color: "#25d366", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, textDecoration: "none", fontFamily: "'Montserrat', sans-serif", boxShadow: waHover ? "0 0 0 3px rgba(37,211,102,0.14)" : "none", transition: "all 0.2s" }}
                    >
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.526 5.856L.057 23.215a.75.75 0 00.928.908l5.444-1.466A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.714 9.714 0 01-4.95-1.355l-.355-.211-3.676.99.997-3.584-.232-.37A9.715 9.715 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                      Order via WhatsApp
                    </a>
                    {/* Trust badges */}
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, padding: "12px 14px", border: "1px solid rgba(30,24,20,0.10)", borderRadius: 4 }}>
                      {[
                        {
                          icon: <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="7" rx="1" stroke="#6b6258" strokeWidth="1.3"/><path d="M4 6V5a4 4 0 018 0v1" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5" cy="12" r="1.5" fill="#6b6258"/><circle cx="11" cy="12" r="1.5" fill="#6b6258"/></svg>,
                          text: "2–4 day delivery in Egypt",
                        },
                        {
                          icon: <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="9" rx="1" stroke="#6b6258" strokeWidth="1.3"/><path d="M5 6V4.5A3 3 0 018 1.5v0A3 3 0 0111 4.5V6" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/><line x1="8" y1="9" x2="8" y2="12" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/><line x1="6.5" y1="10.5" x2="9.5" y2="10.5" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/></svg>,
                          text: "Cash on delivery available",
                        },
                        {
                          icon: <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1.5z" stroke="#6b6258" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 8l1.5 1.5L10.5 6" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                          text: "Secure checkout",
                        },
                      ].map(({ icon, text }) => (
                        <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {icon}
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, color: "#6b6258", fontWeight: 400, letterSpacing: "0.03em" }}>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>{/* end mobile */}

              {/* ══ REVIEWS ══ */}
              {reviewsLoaded && (() => {
                const avg = reviews.length > 0
                  ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
                  : 0;
                const avgRounded = Math.round(avg);
                return (
                  <div style={{
                    background: "linear-gradient(158deg, #f2ece2 0%, #e8dfd2 55%, #ede6d8 100%)",
                    padding: "clamp(48px, 10vw, 80px) clamp(20px, 5vw, 40px)",
                  }}>
                    {/* ── Centred inner shell ── */}
                    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>

                      {/* Label */}
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.36em", textTransform: "uppercase", color: "#a09890", margin: "0 0 18px" }}>
                        From Sister to Sister
                      </p>

                      {/* Score / heading */}
                      {reviews.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 28 }}>
                          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(4rem, 12vw, 6rem)", fontWeight: 300, color: "#1e1814", lineHeight: 1, letterSpacing: "-0.02em" }}>
                            {avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1)}
                          </span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {[1,2,3,4,5].map((s) => (
                              <svg key={s} width={17} height={17} viewBox="0 0 12 12">
                                <path d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z" fill={s <= avgRounded ? "#1e1814" : "rgba(30,24,20,0.18)"} />
                              </svg>
                            ))}
                          </div>
                          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 400, color: "#9a8e84", letterSpacing: "0.08em", margin: 0 }}>
                            Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                          </p>
                        </div>
                      ) : (
                        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.8rem, 6vw, 2.6rem)", fontWeight: 400, letterSpacing: "0.03em", color: "#1e1814", margin: "0 0 10px", lineHeight: 1.15 }}>
                          Be the first to share your thoughts{" "}
                          <svg viewBox="0 0 24 24" style={{ display: "inline-block", width: "0.75em", height: "0.75em", verticalAlign: "middle", marginLeft: "0.15em" }} fill="none" stroke="#c9a0a0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21C12 21 3 14.5 3 8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z"/></svg>
                        </h2>
                      )}

                      {/* CTA button — always centred */}
                      <button
                        type="button"
                        onClick={() => setReviewModalOpen(true)}
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.28em",
                          textTransform: "uppercase",
                          color: "#faf8f5",
                          backgroundColor: "#1e1814",
                          border: "none",
                          padding: "14px 32px",
                          minHeight: 46,
                          cursor: "pointer",
                          transition: "opacity 0.2s",
                          marginTop: reviews.length > 0 ? 0 : 20,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.76"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                      >
                        Write a Review
                      </button>

                      {/* ── Review list ── */}
                      {reviews.length > 0 && (
                        <div style={{ marginTop: 48 }}>
                          {reviews.map((review, idx) => (
                            <div
                              key={review.id}
                              style={{
                                background: "rgba(255,255,255,0.52)",
                                backdropFilter: "blur(6px)",
                                WebkitBackdropFilter: "blur(6px)",
                                borderRadius: 3,
                                padding: "clamp(24px, 5vw, 36px)",
                                marginBottom: idx < reviews.length - 1 ? 16 : 0,
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              {/* Decorative bg quote */}
                              <span aria-hidden="true" style={{
                                position: "absolute",
                                top: -8,
                                left: 12,
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize: "7rem",
                                fontWeight: 300,
                                lineHeight: 1,
                                color: "rgba(30,24,20,0.05)",
                                pointerEvents: "none",
                                userSelect: "none",
                              }}>"</span>

                              {/* Stars */}
                              <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 14 }}>
                                {[1,2,3,4,5].map((s) => (
                                  <svg key={s} width={14} height={14} viewBox="0 0 12 12">
                                    <path d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z" fill={s <= review.rating ? "#1e1814" : "rgba(30,24,20,0.16)"} />
                                  </svg>
                                ))}
                              </div>

                              {/* Title */}
                              {review.title && (
                                <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", fontWeight: 600, letterSpacing: "0.02em", color: "#1e1814", margin: "0 0 10px", lineHeight: 1.25 }}>
                                  {review.title}
                                </p>
                              )}

                              {/* Body */}
                              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1rem, 3vw, 1.15rem)", fontStyle: "italic", fontWeight: 400, color: "#4a4038", lineHeight: 1.85, margin: "0 0 18px", letterSpacing: "0.01em" }}>
                                {review.body}
                              </p>

                              {/* Author + date */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7a6e64", margin: 0 }}>
                                  — {review.author}
                                </p>
                                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 400, letterSpacing: "0.10em", color: "#b5aea8", margin: 0 }}>
                                  {review.date}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Empty state */}
                      {reviews.length === 0 && (
                        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            {[1,2,3,4,5].map((s) => (
                              <svg key={s} width={20} height={20} viewBox="0 0 12 12">
                                <path d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z" fill="rgba(30,24,20,0.14)" />
                              </svg>
                            ))}
                          </div>
                          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.05rem, 3.5vw, 1.25rem)", fontStyle: "italic", fontWeight: 400, color: "#9a8e84", margin: 0, lineHeight: 1.65, maxWidth: 320 }}>
                            Your words matter — share how this piece made you feel.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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

      {/* Size Guide Modal */}
      <AnimatePresence>
        {sizeGuideOpen && (
          <motion.div
            key="size-guide-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSizeGuideOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(30,24,20,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          >
            <motion.div
              key="size-guide-panel"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#faf8f5",
                width: "100%",
                maxWidth: 560,
                borderRadius: "12px 12px 0 0",
                maxHeight: "85dvh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Sticky header — never scrolls */}
              <div style={{ padding: "28px 24px 20px", flexShrink: 0, borderBottom: "1px solid rgba(30,24,20,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 6 }}>MOI Versa Top</p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.55rem", fontWeight: 400, letterSpacing: "0.04em", color: "#1e1814", lineHeight: 1 }}>Size Guide</h2>
                  </div>
                  <button type="button" onClick={() => setSizeGuideOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7a6e74", lineHeight: 1, padding: 8, fontSize: 20, flexShrink: 0 }} aria-label="Close size guide">✕</button>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px", paddingBottom: "calc(32px + env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

                {/* Measurement note */}
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#8a7e74", fontWeight: 300, letterSpacing: "0.03em", marginBottom: 20, lineHeight: 1.6 }}>
                  All measurements in centimetres. Measure yourself and compare to the size that fits best.
                </p>

                {/* Table — horizontally scrollable on narrow screens */}
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "0 -4px" } as React.CSSProperties}>
                  <table style={{ minWidth: 320, width: "100%", borderCollapse: "collapse" as const, fontFamily: "'Montserrat', sans-serif" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid rgba(30,24,20,0.14)" }}>
                        {["Size", "Chest", "Waist", "Hip", "Length"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left" as const, fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#7a6e64", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { size: "S / M", chest: "82–94", waist: "66–78", hip: "90–102", length: "58" },
                        { size: "L / XL", chest: "98–110", waist: "82–94", hip: "106–118", length: "60" },
                      ].map((row, i) => (
                        <tr key={row.size} style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(30,24,20,0.025)" }}>
                          <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: "#1e1814", whiteSpace: "nowrap" }}>{row.size}</td>
                          <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.chest}</td>
                          <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.waist}</td>
                          <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.hip}</td>
                          <td style={{ padding: "13px 10px", fontSize: 12, fontWeight: 300, color: "#4a4038", whiteSpace: "nowrap" }}>{row.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* How to measure tip */}
                <div style={{ marginTop: 24, padding: "14px 16px", border: "1px solid rgba(30,24,20,0.10)", borderRadius: 6 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 8 }}>How to measure</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    {[
                      { label: "Chest", desc: "Measure around the fullest part of your bust, keeping the tape parallel to the floor." },
                      { label: "Waist", desc: "Measure around your natural waistline, the narrowest part of your torso." },
                      { label: "Hip", desc: "Measure around the fullest part of your hips, about 20 cm below your waist." },
                    ].map(({ label, desc }) => (
                      <li key={label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8a7e74", minWidth: 40, paddingTop: 1 }}>{label}</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 300, color: "#8a7e74", lineHeight: 1.6 }}>{desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
