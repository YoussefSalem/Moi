import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowLeft, Bell } from "lucide-react";
import { toast } from "sonner";
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

// ── Star rating SVG component ─────────────────────────────────────────────────
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= Math.floor(rating);
        const half   = !filled && s - 0.5 <= rating;
        const gradId = `hg-pp-${s}-${size}`;
        return (
          <svg key={s} width={size} height={size} viewBox="0 0 12 12">
            <defs>
              <linearGradient id={gradId}>
                <stop offset="50%" stopColor="#1e1814" />
                <stop offset="50%" stopColor="#d4cdc8" />
              </linearGradient>
            </defs>
            <path
              d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z"
              fill={filled ? "#1e1814" : half ? `url(#${gradId})` : "#d4cdc8"}
            />
          </svg>
        );
      })}
    </span>
  );
}

const PRODUCT_REVIEWS = [
  {
    author: "Layla M.",
    date: "May 2025",
    rating: 5,
    title: "The most beautiful top I own",
    body: "The fabric is incredibly soft and the silhouette is perfect. I've worn it three different ways this week. Worth every pound.",
    verified: true,
  },
  {
    author: "Sara A.",
    date: "April 2025",
    rating: 5,
    title: "Effortless luxury",
    body: "I ordered the Light Blue and it's stunning in person. The asymmetric drape is subtle and elegant. Ships fast, packaged beautifully.",
    verified: true,
  },
  {
    author: "Nour K.",
    date: "March 2025",
    rating: 4,
    title: "Gorgeous, runs slightly large",
    body: "Absolutely love the quality and drape. I'd recommend sizing down if you prefer a more fitted look. Still keeping mine — the oversized feel is chic.",
    verified: true,
  },
];

const ALL_RECS = [
  { handle: "moi-versa-top-white",  name: "MOI VERSA TOP", color: "White",      price: "1,399 EGP", swatch: "#f5f0e8", image: () => IMAGES.product2.colorImages.White  as string, gallery: () => IMAGES.product2.colorGalleries.White    as readonly string[] },
  { handle: "moi-versa-top-yellow", name: "MOI VERSA TOP", color: "Yellow",     price: "1,399 EGP", swatch: "#e8d080", image: () => IMAGES.product2.colorImages.Yellow as string, gallery: () => IMAGES.product2.colorGalleries.Yellow   as readonly string[] },
  { handle: "moi-versa-top-teal",   name: "MOI VERSA TOP", color: "Teal",       price: "1,399 EGP", swatch: "#4a8a8a", image: () => IMAGES.product2.colorImages.Teal   as string, gallery: () => IMAGES.product2.colorGalleries.Teal     as readonly string[] },
  { handle: "moi-wavvy-light-blue", name: "MOI WAVVY",     color: "Light Blue", price: "899 EGP",   swatch: "#a8c8d8", image: () => IMAGES.product1.colorImages["Light Blue"] as string, gallery: () => IMAGES.product1.colorGalleries["Light Blue"] as readonly string[] },
  { handle: "moi-wavvy-navy",       name: "MOI WAVVY",     color: "Navy",       price: "899 EGP",   swatch: "#3a5a7a", image: () => IMAGES.product1.colorImages.Navy   as string, gallery: () => IMAGES.product1.colorGalleries.Navy     as readonly string[] },
  { handle: "moi-wavvy-mint",       name: "MOI WAVVY",     color: "Mint",       price: "899 EGP",   swatch: "#98c8a8", image: () => IMAGES.product1.colorImages.Mint   as string, gallery: () => IMAGES.product1.colorGalleries.Mint     as readonly string[] },
];

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

interface ProductPageProps {
  handle: string;
  onBack: () => void;
  onNavigate?: (handle: string) => void;
}

export function ProductPage({ handle, onBack, onNavigate }: ProductPageProps) {
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
  const [waHover, setWaHover] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const recsRef = useRef<HTMLDivElement>(null);
  const recsTrackRef = useRef<HTMLDivElement>(null);
  const recsDraggingRef = useRef(false);
  const desktopXRef = useRef(0);
  const desktopAnimatingRef = useRef(false);
  const recs = useMemo(() => ALL_RECS.filter((r) => r.handle !== handle), [handle]);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [carouselLb, setCarouselLb] = useState<{ open: boolean; images: readonly string[]; idx: number }>({ open: false, images: [], idx: 0 });
  const addingRef = useRef(false);

  // Sync isMobile with viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Detect Apple Pay availability once on mount
  useEffect(() => {
    const AP = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setApplePayAvailable(!!(ENABLE_APPLE_PAY && AP?.canMakePayments?.()));
  }, []);

  // Desktop: set initial translateX to the middle set (-oneSetWidth) after paint
  useLayoutEffect(() => {
    if (isMobile) return;
    const raf = requestAnimationFrame(() => {
      const track = recsTrackRef.current;
      if (!track) return;
      desktopXRef.current = -(track.scrollWidth / 3);
      track.style.transition = "none";
      track.style.transform = `translateX(${desktopXRef.current}px)`;
    });
    return () => cancelAnimationFrame(raf);
    // `loading` is in deps because the recs DOM only renders after the Shopify
    // fetch resolves; without it the effect runs on mount when the track is null.
  }, [isMobile, loading]);

  // Desktop: grab-to-drag via translateX; normalises position after drag ends
  useEffect(() => {
    if (isMobile) return;
    const el = recsRef.current;
    if (!el) return;
    const DRAG_THRESHOLD = 5;
    let didDrag = false;
    let startClientX = 0;
    let startX = 0;

    const onDown = (e: MouseEvent) => {
      if (desktopAnimatingRef.current) return;
      recsDraggingRef.current = true;
      didDrag = false;
      startClientX = e.clientX;
      startX = desktopXRef.current;
      const track = recsTrackRef.current;
      if (track) track.style.transition = "none";
      el.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      if (!recsDraggingRef.current) return;
      const dx = e.clientX - startClientX;
      if (!didDrag && Math.abs(dx) < DRAG_THRESHOLD) return;
      didDrag = true;
      e.preventDefault();
      desktopXRef.current = startX + dx;
      const track = recsTrackRef.current;
      if (track) track.style.transform = `translateX(${desktopXRef.current}px)`;
    };
    const onUp = () => {
      if (!recsDraggingRef.current) return;
      recsDraggingRef.current = false;
      el.style.cursor = "grab";
      if (didDrag) {
        const track = recsTrackRef.current;
        if (track) {
          const osw = track.scrollWidth / 3;
          // Wrap: pull back into the middle set so we always have room to loop
          while (desktopXRef.current < -2 * osw) desktopXRef.current += osw;
          while (desktopXRef.current > 0) desktopXRef.current -= osw;
          track.style.transform = `translateX(${desktopXRef.current}px)`;
        }
        const suppressClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", suppressClick, true);
        };
        window.addEventListener("click", suppressClick, true);
      }
      didDrag = false;
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onUp);
    };
    // `loading` in deps: recs DOM (and recsRef) only exists after the fetch resolves.
  }, [isMobile, loading]);

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
    mobileGalleryRawIdxRef.current = 1;
    const track = mobileGalleryTrackRef.current;
    if (track) {
      track.style.transition = "none";
      track.style.transform = "translateX(-100%)";
    }
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

  const galleryImages = useMemo<string[]>(() => {
    const film = (product.filmstrip as string[]).filter(Boolean);
    if (film.length > 0) return Array.from(new Set(film));
    return product.productShot ? [product.productShot] : [];
  }, [product.productShot, product.filmstrip]);

  useEffect(() => { setThumbLoaded(new Array(galleryImages.length).fill(false)); }, [galleryImages.length, handle]);

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
  const mobileGalleryDragRef = useRef<{ x: number } | null>(null);
  const mobileGalleryDidDragRef = useRef(false);

  const selectedVariant = product.variants?.find((v) => {
    const colorMatch = !pageColorName || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && o.value === pageColorName,
    );
    const sizeMatch = !sizeOption || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === sizeOption.optionName.toLowerCase() && o.value === selectedSize,
    );
    return colorMatch && sizeMatch;
  }) ?? product.variants?.find((v) =>
    !pageColorName || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && o.value === pageColorName,
    ),
  ) ?? product.variants?.[0];

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
      variantId: selectedVariant?.id ?? product.variantId ?? "",
      title: baseProductName,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: pageColorName || product.name,
    });
    toast.success(`${product.name} added to bag`, { duration: 2500 });
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
      variantId: selectedVariant?.id ?? product.variantId ?? "",
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
              className="max-w-6xl mx-auto px-5 md:px-12 pt-4 md:pt-6 pb-12 md:pb-16 flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-10 md:items-start"
            >
              {/* ── SKELETON IMAGE ── */}
              <div className="w-full flex flex-col gap-3">
                <div className="relative aspect-[3/4] rounded-sm overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <ImageSkeleton variant="warm" />
                </div>
                <div className="flex gap-2 justify-center">
                  {[1,2,3].map(i => (
                    <div key={i} className="relative w-16 h-20 rounded-sm overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                      <ImageSkeleton variant="warm" />
                    </div>
                  ))}
                </div>
              </div>
              {/* ── SKELETON INFO ── */}
              <div className="flex flex-col pt-0 w-full gap-6">
                <div className="h-10 rounded w-3/4 overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                </div>
                <div className="h-6 rounded w-1/3 overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                </div>
                <div className="h-12 rounded w-full max-w-[400px] overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                </div>
                <div className="h-12 rounded w-full max-w-[400px] overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                </div>
                <div className="space-y-2">
                  <div className="h-4 rounded w-full overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                  <div className="h-4 rounded w-5/6 overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                  </div>
                  <div className="h-4 rounded w-4/5 overflow-hidden relative" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
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
                    gridTemplateColumns: "1fr 1.1fr 1fr",
                    gap: "0 64px",
                    alignItems: "start",
                  }}
                >
                  {/* ── COL 1: Story ── */}
                  <div style={{ paddingTop: 4 }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 18 }}>
                      New Arrival
                    </p>
                    <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(2rem, 3vw, 2.8rem)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "0.04em", color: "#1e1814", marginBottom: 20 }}>
                      {product.name.split(" — ")[0]}
                    </h1>
                    <p style={{ fontSize: 14, lineHeight: 1.75, letterSpacing: "0.02em", color: "#7a6e64", marginBottom: 28, fontWeight: 300 }}>
                      {product.description}
                    </p>
                    <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.10)", marginBottom: 28 }} />
                    {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
                      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 28 }}>
                        {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                          <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ color: "#a9a09a", flexShrink: 0, marginTop: 2, fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>—</span>
                            <span style={{ fontSize: 13, color: "#1e1814", fontWeight: 300, letterSpacing: "0.02em", lineHeight: 1.65 }}>{bullet}</span>
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
                    <div style={{ marginBottom: 28 }}>
                      {effectiveCompareAtPrice && (
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.94rem", fontWeight: 400, letterSpacing: "0.08em", color: "#8a7e74", textDecoration: "line-through", textDecorationColor: "#c83232", lineHeight: 1.2, marginBottom: 4 }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                        <StarRating rating={4.7} size={13} />
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#1e1814", fontWeight: 300 }}>4.7</span>
                        <a href="#reviews" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300, textDecoration: "underline", textUnderlineOffset: 3 }}>47 reviews</a>
                      </div>
                    </div>

                    <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.10)", marginBottom: 28 }} />

                    {/* Size */}
                    {displaySizes.length > 1 && (
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64" }}>Size</span>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300, letterSpacing: "0.04em" }}>{selectedSize}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(displaySizes.length, 4)}, 1fr)`, gap: 8 }}>
                          {displaySizes.map((size) => {
                            const available = product.variants?.some((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value === size) && v.availableForSale) ?? true;
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
                    {displaySizes.length <= 1 && sizeOption && (
                      <div style={{ marginBottom: 32 }}>
                        <button type="button" disabled style={{ padding: "11px 24px", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" as const, fontFamily: "'Montserrat', sans-serif", fontWeight: 500, color: "#1e1814", border: "1px solid #1e1814", backgroundColor: "rgba(30,24,20,0.04)", borderRadius: 0 }}>
                          One Size
                        </button>
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
                            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", margin: "0 0 2px" }}>Express Checkout</p>
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

                  const handleGalleryPointerDown = (e: React.PointerEvent) => {
                    if (N <= 1) return;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    mobileGalleryDragRef.current = { x: e.clientX };
                    mobileGalleryDidDragRef.current = false;
                    const track = mobileGalleryTrackRef.current;
                    if (track) track.style.transition = "none";
                  };

                  const handleGalleryPointerMove = (e: React.PointerEvent) => {
                    if (!mobileGalleryDragRef.current) return;
                    const dx = e.clientX - mobileGalleryDragRef.current.x;
                    if (!mobileGalleryDidDragRef.current && Math.abs(dx) < 12) return;
                    mobileGalleryDidDragRef.current = true;
                    e.preventDefault();
                    const track = mobileGalleryTrackRef.current;
                    if (track) {
                      const pct = mobileGalleryRawIdxRef.current * 100;
                      track.style.transform = `translateX(calc(-${pct}% + ${dx}px))`;
                    }
                  };

                  const handleGalleryPointerUp = (e: React.PointerEvent) => {
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
                        ref={mobileGalleryTrackRef}
                        style={{
                          display: "flex",
                          willChange: "transform",
                          transform: `translateX(-${N > 1 ? 100 : 0}%)`,
                        }}
                        onPointerDown={handleGalleryPointerDown}
                        onPointerMove={handleGalleryPointerMove}
                        onPointerUp={handleGalleryPointerUp}
                        onPointerCancel={handleGalleryPointerCancel}
                      >
                        {extended.map((src, i) => (
                          <div key={i} style={{ flex: "0 0 100%", aspectRatio: "3/4", position: "relative", overflow: "hidden" }}>
                            <img
                              src={src}
                              alt={product.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block", userSelect: "none", pointerEvents: "none" }}
                              loading="eager"
                              draggable={false}
                            />
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
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64" }}>Size</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 300 }}>{selectedSize}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {displaySizes.map((size) => {
                          const available = product.variants?.some((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value === size) && v.availableForSale) ?? true;
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
                  {displaySizes.length <= 1 && sizeOption && (
                    <div style={{ marginBottom: 24 }}>
                      <button type="button" disabled style={{ padding: "11px 24px", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" as const, fontFamily: "'Montserrat', sans-serif", fontWeight: 500, color: "#1e1814", border: "1px solid #1e1814", backgroundColor: "rgba(30,24,20,0.04)", borderRadius: 0 }}>
                        One Size
                      </button>
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
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", margin: "0 0 2px" }}>Express Checkout</p>
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

              {/* ══ YOU MAY ALSO LIKE — full-width horizontal carousel ══ */}
              {onNavigate && (
                <div style={{ backgroundColor: "#faf8f5", borderTop: "1px solid rgba(30,24,20,0.07)" }}>
                  {(() => {
                    const renderCard = (rec: typeof recs[0], key: string) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onNavigate?.(rec.handle)}
                        style={{ flex: "0 0 auto", width: "clamp(160px, 42vw, 260px)", background: "none", border: "none", padding: 0, textAlign: "left", userSelect: "none", cursor: "pointer" }}
                        draggable={false}
                      >
                        <div style={{ aspectRatio: "3/4", overflow: "hidden", marginBottom: 12, backgroundColor: "rgba(30,24,20,0.04)" }}>
                          <img src={rec.image()} alt={rec.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} loading="lazy" draggable={false} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: rec.swatch, border: "1px solid rgba(30,24,20,0.14)", flexShrink: 0 }} />
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a7e74" }}>{rec.color}</span>
                        </div>
                        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(0.9rem, 2vw, 1.1rem)", fontWeight: 300, color: "#1e1814", lineHeight: 1.2, marginBottom: 3 }}>{rec.name}</p>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#7a6e64" }}>{rec.price}</p>
                      </button>
                    );
                    // Animate desktop track one card-width step; normalise position after transition so
                    // there is always room to loop in either direction. dir: 1 = next, -1 = prev.
                    const scrollDesktop = (dir: 1 | -1) => {
                      if (desktopAnimatingRef.current) return;
                      const track = recsTrackRef.current;
                      if (!track) return;
                      const firstCard = track.firstElementChild as HTMLElement | null;
                      const step = (firstCard?.offsetWidth ?? 280) + 24;
                      desktopXRef.current -= dir * step;
                      desktopAnimatingRef.current = true;
                      track.style.transition = "transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
                      track.style.transform = `translateX(${desktopXRef.current}px)`;
                      const onEnd = () => {
                        track.removeEventListener("transitionend", onEnd);
                        desktopAnimatingRef.current = false;
                        track.style.transition = "none";
                        const osw = track.scrollWidth / 3;
                        while (desktopXRef.current < -2 * osw) desktopXRef.current += osw;
                        while (desktopXRef.current > 0) desktopXRef.current -= osw;
                        track.style.transform = `translateX(${desktopXRef.current}px)`;
                      };
                      track.addEventListener("transitionend", onEnd);
                    };
                    return (
                      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "72px 0 56px 28px" }}>
                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingRight: 28, marginBottom: 40 }}>
                          <div>
                            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7a6e64", marginBottom: 14 }}>You May Also Like</p>
                            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 400, letterSpacing: "0.04em", color: "#1e1814" }}>Curated For You</h2>
                          </div>
                          {!isMobile && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="button" aria-label="Previous" onClick={() => scrollDesktop(-1)} style={{ width: 40, height: 40, border: "1px solid rgba(30,24,20,0.2)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e1814", borderRadius: 2 }}>
                                <ChevronLeft size={18} />
                              </button>
                              <button type="button" aria-label="Next" onClick={() => scrollDesktop(1)} style={{ width: 40, height: 40, border: "1px solid rgba(30,24,20,0.2)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e1814", borderRadius: 2 }}>
                                <ChevronRight size={18} />
                              </button>
                            </div>
                          )}
                        </div>

                        {isMobile ? (
                          /* Mobile: native free-scroll — no snapping, full momentum, tap navigates */
                          <div
                            style={{
                              overflowX: "auto",
                              overflowY: "hidden",
                              WebkitOverflowScrolling: "touch" as unknown as undefined,
                              scrollbarWidth: "none",
                              msOverflowStyle: "none",
                            } as React.CSSProperties}
                          >
                            <div style={{ display: "flex", gap: 20, paddingRight: 20, width: "max-content" }}>
                              {recs.map((rec, i) => renderCard(rec, `m-${rec.handle}-${i}`))}
                            </div>
                          </div>
                        ) : (
                          /* Desktop: infinite loop via tripled track + translateX; grab-to-drag + arrow buttons */
                          <div ref={recsRef} style={{ overflow: "hidden", cursor: "grab", paddingBottom: 16 }}>
                            <div ref={recsTrackRef} style={{ display: "flex", gap: 24, width: "max-content", willChange: "transform" }}>
                              {[...recs, ...recs, ...recs].map((rec, i) => renderCard(rec, `d-${rec.handle}-${i}`))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ══ REVIEWS ══ */}
              <div id="reviews" style={{ backgroundColor: "#f4f0eb" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", padding: "72px 28px 88px" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 52, flexWrap: "wrap" as const, gap: 20 }}>
                    <div>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#7a6e64", marginBottom: 14 }}>
                        Customer Reviews
                      </p>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 400, letterSpacing: "0.04em", color: "#1e1814", marginBottom: 14 }}>
                        What Our Customers Say
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <StarRating rating={4.7} size={14} />
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 300, color: "#1e1814" }}>4.7</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, color: "#7a6e64", fontWeight: 300 }}>· 47 reviews</span>
                      </div>
                    </div>
                  </div>

                  {/* Review cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {PRODUCT_REVIEWS.map((r, i) => (
                      <div key={i} style={{ backgroundColor: "#faf8f5", padding: "28px 28px 32px", border: "1px solid rgba(30,24,20,0.10)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <StarRating rating={r.rating} size={12} />
                          {r.verified && (
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#2d6a4f", fontWeight: 600, letterSpacing: "0.08em" }}>✓ Verified</span>
                          )}
                        </div>
                        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 400, color: "#1e1814", marginBottom: 10, lineHeight: 1.3, letterSpacing: "0.02em" }}>
                          {r.title}
                        </p>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, lineHeight: 1.7, color: "#7a6e64", marginBottom: 20, fontWeight: 300 }}>
                          {r.body}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 28, height: 28, backgroundColor: "#eee8e2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 14, fontWeight: 600, color: "#7a6e64", flexShrink: 0 }}>
                            {r.author[0]}
                          </div>
                          <div>
                            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: "#1e1814", letterSpacing: "0.06em" }}>{r.author}</p>
                            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#a9a09a", fontWeight: 300, marginTop: 2 }}>{r.date}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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
    </>
  );
}
