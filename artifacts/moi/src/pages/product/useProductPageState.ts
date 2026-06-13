import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { showAddedToBagToast } from "@/lib/cartToast";
import { useShopifyProductByHandle } from "@/hooks/useShopifyProductByHandle";
import { parseEGP } from "@/lib/price";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { ENABLE_APPLE_PAY } from "@/config/features";
import { trackAddToCart } from "@/lib/analytics";
import { trackViewContent } from "@/lib/metaPixel";
import { trackTikTokViewContent } from "@/lib/tiktokPixel";
import { buildAllRecs, deriveFallbackFromHandle } from "./productPageUtils";
import { useMobileGallerySwipe } from "@/hooks/useMobileGallerySwipe";
import type { ReviewItem } from "./ProductReviews";

const ALL_RECS = buildAllRecs();

export function useProductPageState(handle: string) {
  const fallback = deriveFallbackFromHandle(handle);
  const { product, loading } = useShopifyProductByHandle(handle, fallback);
  const pageColorName = fallback.name.includes(" — ")
    ? (fallback.name.split(" — ").pop() ?? "")
    : "";
  const { addToCart, buyNow } = useCart();
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

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  useEffect(() => {
    if (!handle) return;
    setReviewsLoaded(false);
    fetch(`/api/reviews/public?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((data: { reviews: ReviewItem[] }) => {
        setReviews(data.reviews ?? []);
        setReviewsLoaded(true);
      })
      .catch(() => { setReviewsLoaded(true); });
  }, [handle]);

  useEffect(() => {
    const AP = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setApplePayAvailable(!!(ENABLE_APPLE_PAY && AP?.canMakePayments?.()));
  }, []);

  useEffect(() => {
    const rawImage = product.productShot ?? "";
    const absoluteImage = rawImage.startsWith("http")
      ? rawImage
      : `${window.location.origin}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;
    const pageUrl   = `${window.location.origin}/products/${handle}`;
    const fullTitle = `${product.name} — Moi`;
    const desc      = product.description?.slice(0, 160) ?? "";

    function getMeta(sel: string, attrKey: string, attrVal: string): HTMLMetaElement {
      let el = document.querySelector<HTMLMetaElement>(sel);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attrKey, attrVal); document.head.appendChild(el); }
      return el;
    }
    const prevTitle = document.title;
    document.title  = fullTitle;
    const descTag  = getMeta('meta[name="description"]',           "name",     "description");
    const ogTitle  = getMeta('meta[property="og:title"]',          "property", "og:title");
    const ogDesc   = getMeta('meta[property="og:description"]',    "property", "og:description");
    const ogImage  = getMeta('meta[property="og:image"]',          "property", "og:image");
    const ogUrl    = getMeta('meta[property="og:url"]',            "property", "og:url");
    const ogType   = getMeta('meta[property="og:type"]',           "property", "og:type");
    const twTitle  = getMeta('meta[name="twitter:title"]',         "name",     "twitter:title");
    const twDesc   = getMeta('meta[name="twitter:description"]',   "name",     "twitter:description");
    const twImage  = getMeta('meta[name="twitter:image"]',         "name",     "twitter:image");
    const prev = {
      desc: descTag.content, ogTitle: ogTitle.content, ogDesc: ogDesc.content,
      ogImage: ogImage.content, ogUrl: ogUrl.content, ogType: ogType.content,
      twTitle: twTitle.content, twDesc: twDesc.content, twImage: twImage.content,
    };
    descTag.content = desc;     ogTitle.content = fullTitle; ogDesc.content  = desc;
    ogImage.content = absoluteImage; ogUrl.content = pageUrl;  ogType.content  = "product";
    twTitle.content = fullTitle; twDesc.content  = desc;     twImage.content = absoluteImage;
    return () => {
      document.title   = prevTitle;
      descTag.content  = prev.desc;  ogTitle.content = prev.ogTitle; ogDesc.content  = prev.ogDesc;
      ogImage.content  = prev.ogImage; ogUrl.content = prev.ogUrl;   ogType.content  = prev.ogType;
      twTitle.content  = prev.twTitle; twDesc.content = prev.twDesc;  twImage.content = prev.twImage;
    };
  }, [product.name, product.description, product.productShot, handle]);

  useEffect(() => {
    const el = document.getElementById("product-scroll-container");
    if (el) el.scrollTop = 0;
  }, [handle]);

  useEffect(() => { setGalleryIndex(0); setImgLoaded(false); }, [handle]);

  useEffect(() => {
    const priceNum = parseEGP(product.price ?? "");
    const variantId = product.variantId ?? product.variants?.[0]?.id;
    trackViewContent({ content_name: product.name, content_type: "product", content_ids: variantId ? [variantId] : undefined, currency: "EGP", value: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined });
    trackTikTokViewContent({ content_name: product.name, content_type: "product", content_id: variantId, currency: "EGP", value: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined });
  }, [handle]);

  const sizeOption = useMemo(() => {
    if (!product.variants) return null;
    const opt = product.variants[0]?.selectedOptions.find((o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre");
    if (!opt) return null;
    const vals = [...new Set(product.variants.map((v) => v.selectedOptions.find((o) => o.name.toLowerCase() === opt.name.toLowerCase())?.value).filter(Boolean))] as string[];
    return { optionName: opt.name, values: vals };
  }, [product.variants]);

  const displaySizes = useMemo(
    () => sizeOption?.values.filter((s) => !["one size", "os", "default title", "one-size"].includes(s.toLowerCase())) ?? [],
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

  const mobileGalleryTrackRef    = useRef<HTMLDivElement>(null);
  const mobileGalleryRawIdxRef   = useRef(1);
  const mobileGalleryDragRef     = useRef<{ x: number; y: number } | null>(null);
  const mobileGalleryDidDragRef  = useRef(false);

  useLayoutEffect(() => {
    const track = mobileGalleryTrackRef.current;
    if (!track) return;
    const N = galleryImages.length;
    const rawIdx = N > 1 ? 1 : 0;
    mobileGalleryRawIdxRef.current = rawIdx;
    track.style.transition = "none";
    track.style.transform  = `translateX(-${rawIdx * 100}%)`;
  }, [galleryImages.length, handle, loading]);

  useEffect(() => {
    galleryImages.forEach((src) => { if (!src) return; const img = new Image(); img.src = src; });
  }, [handle]);

  const prevImg = useCallback(() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length]);
  const nextImg = useCallback(() => setGalleryIndex((i) => (i + 1) % galleryImages.length),                       [galleryImages.length]);

  useMobileGallerySwipe({ galleryImages, handle, loading, trackMounted, mobileGalleryTrackRef, mobileGalleryRawIdxRef, mobileGalleryDragRef, mobileGalleryDidDragRef, setGalleryIndex, setLightboxOpen });

  const setMobileGalleryTrackRef = useCallback((el: HTMLDivElement | null) => {
    mobileGalleryTrackRef.current = el;
    if (!el) { setTrackMounted(false); return; }
    const N = galleryImages.length;
    const rawIdx = N > 1 ? 1 : 0;
    mobileGalleryRawIdxRef.current = rawIdx;
    el.style.transition = "none";
    el.style.transform  = `translateX(-${rawIdx * 100}%)`;
    setTrackMounted(true);
  }, [galleryImages.length]);

  const selectedVariant = (() => {
    const variants = product.variants;
    if (!variants?.length) return undefined;
    const colorLower   = pageColorName.toLowerCase();
    const sizeOptName  = sizeOption?.optionName.toLowerCase() ?? "";
    const sizeLower    = selectedSize.toLowerCase();
    if (pageColorName) {
      const withBoth = variants.find((v) =>
        v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === colorLower) &&
        (!sizeOption || v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOptName && o.value.toLowerCase() === sizeLower))
      );
      if (withBoth) return withBoth;
      const colorOnly = variants.find((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value.toLowerCase() === colorLower));
      if (colorOnly) return colorOnly;
      return undefined;
    }
    if (sizeOption) {
      return variants.find((v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOptName && o.value.toLowerCase() === sizeLower)) ?? variants[0];
    }
    return variants[0];
  })();

  const isOutOfStock           = selectedVariant ? !selectedVariant.availableForSale : false;
  const effectivePrice         = selectedVariant?.price ?? product.price;
  const effectiveCompareAtPrice = selectedVariant?.compareAtPrice ?? (product as unknown as { compareAtPrice?: string }).compareAtPrice;
  const mainImage              = galleryImages[galleryIndex] ?? product.productShot;

  const handleAddToCart = () => {
    if (isOutOfStock || addingRef.current) return;
    addingRef.current = true;
    setAddedFeedback(true);
    trackAddToCart(selectedVariant?.id ?? product.variantId ?? "", product.name, 1, parseEGP(String(effectivePrice)) || 0);
    const baseProductName = product.name.includes(" — ") ? product.name.split(" — ")[0] : product.name;
    void addToCart({
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
    setTimeout(() => { addingRef.current = false; setAddedFeedback(false); }, 1800);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    trackAddToCart(selectedVariant?.id ?? product.variantId ?? "", product.name, 1, parseEGP(String(effectivePrice)) || 0);
    const buyNowTitle = product.name.includes(" — ") ? product.name.split(" — ")[0] : product.name;
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
      const res  = await fetch("/api/restock/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, productHandle: handle, variantId, variantTitle: selectedSize || "One Size", productTitle: product.name }) });
      const json = await res.json() as { success?: boolean; error?: string };
      return json.success ? { success: true } : { success: false, error: json.error ?? "Something went wrong." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const handleNotifyMe = async () => {
    if (customer?.email) {
      const result = await subscribeToRestock(customer.email);
      if (result.success) { toast.success("You're on the list.", { description: "We'll email you when it's back.", duration: 3000 }); }
      else { toast.error(result.error ?? "Could not subscribe."); }
    } else { setNotifyModalOpen(true); }
  };

  return {
    product, loading, pageColorName,
    galleryImages, galleryIndex, setGalleryIndex, mainImage,
    imgLoaded, setImgLoaded,
    thumbLoaded, setThumbLoaded,
    addedFeedback,
    notifyModalOpen, setNotifyModalOpen,
    lightboxOpen, setLightboxOpen,
    waHover, setWaHover,
    applePayAvailable,
    recs,
    carouselLb, setCarouselLb,
    reviews, reviewsLoaded,
    reviewModalOpen, setReviewModalOpen,
    sizeOption, displaySizes, selectedSize, setSelectedSize,
    sizeGuideOpen, setSizeGuideOpen,
    selectedVariant,
    isOutOfStock, effectivePrice, effectiveCompareAtPrice,
    prevImg, nextImg,
    mobileGalleryRawIdxRef, mobileGalleryDragRef, mobileGalleryDidDragRef,
    setMobileGalleryTrackRef,
    handleAddToCart, handleBuyNow,
    subscribeToRestock, handleNotifyMe,
  };
}
