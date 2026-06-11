import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  const recsRef = useRef<HTMLDivElement>(null);
  const addingRef = useRef(false);

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
  useEffect(() => { setGalleryIndex(0); setImgLoaded(false); }, [handle]);

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
                    {(product as unknown as { outer?: string }).outer && (
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#a9a09a", letterSpacing: "0.08em", fontWeight: 400 }}>
                        {(product as unknown as { ref?: string }).ref ? `REF ${(product as unknown as { ref: string }).ref} · ` : ""}
                        {(product as unknown as { outer: string }).outer}
                      </p>
                    )}
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
                        <motion.button type="button" onClick={handleAddToCart} whileTap={{ scale: 0.98 }}
                          style={{ width: "100%", height: 48, borderRadius: 0, border: "none", backgroundColor: addedFeedback ? "#2d6a4f" : "#1e1814", color: "#faf8f5", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.3s" }}
                        >
                          {addedFeedback ? "Added to Bag ✓" : "Add to Bag"}
                        </motion.button>
                        <motion.button type="button" onClick={handleBuyNow} whileTap={{ scale: 0.98 }}
                          style={{ width: "100%", height: 48, borderRadius: 0, border: "1px solid #d4cdc8", backgroundColor: "transparent", color: "#1e1814", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.15s" }}
                        >
                          Buy It Now
                        </motion.button>
                        {ENABLE_APPLE_PAY && typeof window !== "undefined" && "ApplePaySession" in window && (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() && (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                              <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" as const }}>or</span>
                              <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                            </div>
                            <ShopifyApplePayButton variantId={selectedVariant?.id ?? product.variantId ?? ""} quantity={1} priceEGP={parseEGP(String(effectivePrice)) || 0} disabled={isOutOfStock} style={{ width: "100%" }}
                              onSuccess={(orderNumber, total) => { toast.success(`Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`, { duration: 5000 }); }}
                              onError={(msg) => { toast.error(msg, { duration: 4000 }); }}
                            />
                          </>
                        )}
                      </div>
                    )}

                    {/* Recommendations — stacked list in right col */}
                    {onNavigate && (
                      <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid rgba(30,24,20,0.08)" }}>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase" as const, color: "#8a7e74", marginBottom: 16 }}>
                          You May Also Like
                        </p>
                        <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
                          {[
                            { handle: "moi-versa-top-white",  name: "MOI VERSA TOP", color: "White",      price: "1,399 EGP", image: IMAGES.product2.colorImages.White as string },
                            { handle: "moi-versa-top-yellow", name: "MOI VERSA TOP", color: "Yellow",     price: "1,399 EGP", image: IMAGES.product2.colorImages.Yellow as string },
                            { handle: "moi-versa-top-teal",   name: "MOI VERSA TOP", color: "Teal",       price: "1,399 EGP", image: IMAGES.product2.colorImages.Teal as string },
                            { handle: "moi-wavvy-light-blue", name: "MOI WAVVY",     color: "Light Blue",  price: "899 EGP",   image: IMAGES.product1.colorImages["Light Blue"] as string },
                            { handle: "moi-wavvy-navy",       name: "MOI WAVVY",     color: "Navy",        price: "899 EGP",   image: IMAGES.product1.colorImages.Navy as string },
                          ].filter((r) => r.handle !== handle).slice(0, 4).map((rec) => (
                            <button key={rec.handle} type="button" onClick={() => onNavigate(rec.handle)}
                              style={{ display: "flex", gap: 14, alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" as const }}
                            >
                              <div style={{ width: 48, height: 64, overflow: "hidden", flexShrink: 0, backgroundColor: "rgba(30,24,20,0.04)" }}>
                                <img src={rec.image} alt={rec.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                              </div>
                              <div>
                                <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 15, fontWeight: 300, color: "#1e1814", lineHeight: 1.2 }}>{rec.name}</p>
                                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.08em", color: "#7a6e64", marginTop: 3 }}>{rec.color} · {rec.price}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>{/* end 3-col */}
              </div>{/* end desktop */}

              {/* ══ MOBILE / TABLET stacked (< lg) ══ */}
              <div className="lg:hidden" style={{ paddingBottom: 96 }}>
                {/* Full-bleed gallery */}
                <div
                  className="relative overflow-hidden"
                  style={{ backgroundColor: "rgba(30,24,20,0.04)" }}
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
                  onClick={() => setLightboxOpen(true)}
                >
                  <div style={{ aspectRatio: "3/4", position: "relative" }}>
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
                        transition={{ duration: 0.3 }}
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
                    {/* Gallery dots */}
                    {galleryImages.length > 1 && (
                      <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 10 }}>
                        {galleryImages.map((_, i) => (
                          <button key={i} type="button"
                            onClick={(e) => { e.stopPropagation(); setGalleryIndex(i); setImgLoaded(false); }}
                            style={{ width: i === galleryIndex ? 18 : 6, height: 6, borderRadius: 9999, border: "none", padding: 0, cursor: "pointer", backgroundColor: i === galleryIndex ? "#faf8f5" : "rgba(250,248,245,0.45)", transition: "width 0.22s, background-color 0.22s" }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

                  {/* Recommendations — horizontal scroll */}
                  {onNavigate && (
                    <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(30,24,20,0.08)" }}>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase" as const, color: "#8a7e74", marginBottom: 16 }}>
                        You May Also Like
                      </p>
                      <div ref={recsRef} style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
                        {[
                          { handle: "moi-versa-top-white",  name: "MOI VERSA TOP", color: "White",     price: "1,399 EGP", image: IMAGES.product2.colorImages.White as string,              swatch: "#f5f0e8" },
                          { handle: "moi-versa-top-yellow", name: "MOI VERSA TOP", color: "Yellow",    price: "1,399 EGP", image: IMAGES.product2.colorImages.Yellow as string,             swatch: "#e8d080" },
                          { handle: "moi-versa-top-teal",   name: "MOI VERSA TOP", color: "Teal",      price: "1,399 EGP", image: IMAGES.product2.colorImages.Teal as string,               swatch: "#4a8a8a" },
                          { handle: "moi-wavvy-light-blue", name: "MOI WAVVY",     color: "Light Blue", price: "899 EGP",  image: IMAGES.product1.colorImages["Light Blue"] as string,       swatch: "#a8c8d8" },
                          { handle: "moi-wavvy-navy",       name: "MOI WAVVY",     color: "Navy",       price: "899 EGP",  image: IMAGES.product1.colorImages.Navy as string,                swatch: "#3a5a7a" },
                          { handle: "moi-wavvy-mint",       name: "MOI WAVVY",     color: "Mint",       price: "899 EGP",  image: IMAGES.product1.colorImages.Mint as string,                swatch: "#98c8a8" },
                        ].filter((r) => r.handle !== handle).slice(0, 5).map((rec) => (
                          <button key={rec.handle} type="button" onClick={() => onNavigate(rec.handle)}
                            style={{ flexShrink: 0, width: 100, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" as const }}
                          >
                            <div style={{ aspectRatio: "3/4", overflow: "hidden", marginBottom: 8, backgroundColor: "rgba(30,24,20,0.04)" }}>
                              <img src={rec.image} alt={rec.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: rec.swatch, border: "1px solid rgba(30,24,20,0.14)", flexShrink: 0 }} />
                              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#8a7e74" }}>{rec.color}</span>
                            </div>
                            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 13, fontWeight: 300, color: "#1e1814", lineHeight: 1.2 }}>{rec.name}</p>
                            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.08em", color: "#7a6e64", marginTop: 2 }}>{rec.price}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky bottom CTA bar */}
                {!isOutOfStock && (
                  <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90, backgroundColor: "rgba(250,248,245,0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: "1px solid rgba(30,24,20,0.10)", padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", display: "flex", gap: 10 }}>
                    <motion.button type="button" onClick={handleBuyNow} whileTap={{ scale: 0.98 }}
                      style={{ width: 80, height: 48, borderRadius: 0, flexShrink: 0, border: "1px solid #d4cdc8", backgroundColor: "transparent", color: "#1e1814", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      Buy Now
                    </motion.button>
                    <motion.button type="button" onClick={handleAddToCart} whileTap={{ scale: 0.98 }}
                      style={{ flex: 1, height: 48, borderRadius: 0, backgroundColor: addedFeedback ? "#2d6a4f" : "#1e1814", color: "#faf8f5", border: "none", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", transition: "background-color 0.3s" }}
                    >
                      {addedFeedback ? "Added ✓" : `Add to Bag — ${effectivePrice}`}
                    </motion.button>
                  </div>
                )}
              </div>{/* end mobile */}

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
    </>
  );
}
