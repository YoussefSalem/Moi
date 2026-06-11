import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowLeft, Bell, Plus } from "lucide-react";
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
import { ReviewSection, loadReviews, StarDisplay } from "@/components/ReviewSection";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

  const allVariants = (matched as unknown as {
    variants?: Array<{
      id: string;
      availableForSale: boolean;
      selectedOptions: Array<{ name: string; value: string }>;
      price?: string;
      compareAtPrice?: string;
    }>;
  }).variants;
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

// ─── Accordion items ──────────────────────────────────────────────────────────
const ACCORDION_ITEMS = [
  {
    key: "fabric",
    label: "Fabric & Care",
    body: "Crafted from premium Egyptian cotton for all-day comfort. Machine wash at 30°C on a gentle cycle. Lay flat to dry. Iron on low heat with a pressing cloth.",
  },
  {
    key: "sizing",
    label: "Size & Fit",
    body: "Designed for an elegant, relaxed silhouette. S & M suit heights up to 1.65 m for a closer drape; L & XL suit taller frames. When between sizes, size up for a more fluid look.",
  },
  {
    key: "delivery",
    label: "Delivery & Returns",
    body: "Free delivery across Egypt in 2–4 business days. Express next-day delivery available at checkout. Returns accepted within 14 days in original unworn condition with tags attached.",
  },
];

// ─── Shared style constants ───────────────────────────────────────────────────
const SERIF: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const SANS: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif" };

// ─── Accordion item component ─────────────────────────────────────────────────
function AccordionItem({
  label,
  body,
  open,
  onToggle,
}: {
  label: string;
  body: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid rgba(30,24,20,0.09)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "14px 0", minHeight: 48 }}
      >
        <span style={{ ...SANS, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#1e1814", fontWeight: 500 }}>
          {label}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ color: "rgba(30,24,20,0.5)", lineHeight: 0, flexShrink: 0, marginLeft: 12 }}
        >
          <Plus size={13} strokeWidth={1.5} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.30, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <p style={{ ...SANS, fontSize: "clamp(0.73rem, 2vw, 0.8rem)", color: "#6a5e56", lineHeight: 1.80, letterSpacing: "0.025em", paddingBottom: 16 }}>
              {body}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
interface ProductPageProps {
  handle: string;
  onBack: () => void;
  onNavigate?: (handle: string) => void;
}

export function ProductPage({ handle, onBack, onNavigate }: ProductPageProps) {
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
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [avgRatingData, setAvgRatingData] = useState<{ avg: number; count: number } | null>(null);

  const recsRef = useRef<HTMLDivElement>(null);
  const addingRef = useRef(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  // ── SEO head tags ──
  useEffect(() => {
    const rawImage = product.productShot ?? "";
    const absoluteImage = rawImage.startsWith("http")
      ? rawImage
      : `${window.location.origin}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;
    const pageUrl   = `${window.location.origin}/products/${handle}`;
    const fullTitle = `${product.name} — Moi`;
    const desc      = product.description?.slice(0, 160) ?? "";

    function getMeta(selector: string, attrKey: string, attrVal: string): HTMLMetaElement {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrKey, attrVal);
        document.head.appendChild(el);
      }
      return el;
    }

    const prevTitle  = document.title;
    document.title   = fullTitle;
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
    descTag.content   = desc;
    ogTitle.content   = fullTitle;
    ogDesc.content    = desc;
    ogImage.content   = absoluteImage;
    ogUrl.content     = pageUrl;
    ogType.content    = "product";
    twTitle.content   = fullTitle;
    twDesc.content    = desc;
    twImage.content   = absoluteImage;

    return () => {
      document.title    = prevTitle;
      descTag.content   = prev.desc;
      ogTitle.content   = prev.ogTitle;
      ogDesc.content    = prev.ogDesc;
      ogImage.content   = prev.ogImage;
      ogUrl.content     = prev.ogUrl;
      ogType.content    = prev.ogType;
      twTitle.content   = prev.twTitle;
      twDesc.content    = prev.twDesc;
      twImage.content   = prev.twImage;
    };
  }, [product.name, product.description, product.productShot, handle]);

  useEffect(() => {
    const el = document.getElementById("product-scroll-container");
    if (el) el.scrollTop = 0;
  }, [handle]);

  useEffect(() => { setGalleryIndex(0); setImgLoaded(false); }, [handle]);

  // ── Analytics ──
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

  // ── Review average ──
  useEffect(() => {
    const reviews = loadReviews().filter((r) => r.productHandle === handle);
    if (reviews.length > 0) {
      setAvgRatingData({
        avg: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length,
        count: reviews.length,
      });
    } else {
      setAvgRatingData(null);
    }
  }, [handle]);

  // ── Mobile sticky CTA bar: appears when the main CTA row scrolls off ──
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  // ── Sizes ──
  const sizeOption = useMemo(() => {
    if (!product.variants) return null;
    const opt = product.variants[0]?.selectedOptions.find(
      (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre",
    );
    if (!opt) return null;
    const vals = [
      ...new Set(
        product.variants
          .map((v) => v.selectedOptions.find((o) => o.name.toLowerCase() === opt.name.toLowerCase())?.value)
          .filter(Boolean),
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

  // ── Gallery ──
  const galleryImages = useMemo<string[]>(() => {
    const film = (product.filmstrip as string[]).filter(Boolean);
    if (film.length > 0) return Array.from(new Set(film));
    return product.productShot ? [product.productShot] : [];
  }, [product.productShot, product.filmstrip]);

  useEffect(() => { setThumbLoaded(new Array(galleryImages.length).fill(false)); }, [galleryImages.length, handle]);

  useEffect(() => {
    galleryImages.forEach((src) => { if (src) { const img = new Image(); img.src = src; } });
  }, [handle]);

  const mainImage = galleryImages[galleryIndex] ?? product.productShot;
  const prevImg = useCallback(() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length]);
  const nextImg = useCallback(() => setGalleryIndex((i) => (i + 1) % galleryImages.length), [galleryImages.length]);

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef  = useRef<number | null>(null);

  // ── Variant resolution ──
  const selectedVariant = product.variants?.find((v) => {
    const colorMatch = !pageColorName || v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === pageColorName);
    const sizeMatch  = !sizeOption    || v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption.optionName.toLowerCase() && o.value === selectedSize);
    return colorMatch && sizeMatch;
  }) ?? product.variants?.find((v) =>
    !pageColorName || v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === pageColorName),
  ) ?? product.variants?.[0];

  const isOutOfStock           = selectedVariant ? !selectedVariant.availableForSale : false;
  const effectivePrice         = selectedVariant?.price ?? product.price;
  const effectiveCompareAtPrice = selectedVariant?.compareAtPrice ?? (product as unknown as { compareAtPrice?: string }).compareAtPrice;

  // ── Cart handlers ──
  const handleAddToCart = () => {
    if (isOutOfStock || addingRef.current) return;
    addingRef.current = true;
    setAddedFeedback(true);
    trackAddToCart(selectedVariant?.id ?? product.variantId ?? "", product.name, 1, parseEGP(String(effectivePrice)) || 0);
    const baseTitle = product.name.includes(" — ") ? product.name.split(" — ")[0] : product.name;
    void addToCart({
      variantId: selectedVariant?.id ?? product.variantId ?? "",
      title: baseTitle,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: pageColorName || product.name,
    });
    toast.success(`${product.name} added to bag`, { duration: 2500 });
    setTimeout(() => { addingRef.current = false; setAddedFeedback(false); }, 1800);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    trackAddToCart(selectedVariant?.id ?? product.variantId ?? "", product.name, 1, parseEGP(String(effectivePrice)) || 0);
    const buyNowTitle = product.name.includes(" — ") ? product.name.split(" — ")[0] : product.name;
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
      const res  = await fetch("/api/restock/subscribe", {
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
      if (result.success) toast.success("You're on the list.", { description: "We'll email you when it's back.", duration: 3000 });
      else toast.error(result.error ?? "Could not subscribe.");
    } else {
      setNotifyModalOpen(true);
    }
  };

  // ── Recommendations ──
  const clothingRecs = useMemo(() => [
    { handle: "moi-versa-top-white",     name: "MOI VERSA TOP", color: "White",      price: "1,399 EGP", image: IMAGES.product2.colorImages.White as string,        swatch: "#f5f0e8" },
    { handle: "moi-versa-top-yellow",    name: "MOI VERSA TOP", color: "Yellow",     price: "1,399 EGP", image: IMAGES.product2.colorImages.Yellow as string,       swatch: "#e8d080" },
    { handle: "moi-versa-top-teal",      name: "MOI VERSA TOP", color: "Teal",       price: "1,399 EGP", image: IMAGES.product2.colorImages.Teal as string,         swatch: "#4a8a8a" },
    { handle: "moi-wavvy-light-blue",    name: "MOI WAVVY",     color: "Light Blue", price: "899 EGP",   image: IMAGES.product1.colorImages["Light Blue"] as string, swatch: "#a8c8d8" },
    { handle: "moi-wavvy-navy",          name: "MOI WAVVY",     color: "Navy",       price: "899 EGP",   image: IMAGES.product1.colorImages.Navy as string,          swatch: "#3a5a7a" },
    { handle: "moi-wavvy-mint",          name: "MOI WAVVY",     color: "Mint",       price: "899 EGP",   image: IMAGES.product1.colorImages.Mint as string,          swatch: "#98c8a8" },
  ].filter((r) => r.handle !== handle).slice(0, 6), [handle]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="min-h-screen"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(245,240,232,0.6) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(230,220,205,0.25) 0%, transparent 50%), #faf8f5",
        }}
      >
        {/* ── Back button ── */}
        <div className="px-5 md:px-12 pt-20 md:pt-22 pb-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 transition-opacity hover:opacity-60 active:opacity-40"
            style={{ ...SANS, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "#8a7e74", minHeight: 36 }}
          >
            <ArrowLeft size={13} strokeWidth={1.4} />
            Back
          </button>
        </div>

        {/* ── Skeleton / content ── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto px-5 md:px-12 pt-4 pb-12"
            >
              <div className="flex flex-col md:grid md:grid-cols-[1fr_400px] md:gap-16 md:items-start">
                <div className="w-full">
                  <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.04)" }}>
                    <ImageSkeleton variant="warm" />
                  </div>
                </div>
                <div className="pt-6 md:pt-0 flex flex-col gap-5">
                  {[["75%", 32], ["40%", 20], ["100%", 12], ["100%", 12], ["85%", 12]].map(([w, h], i) => (
                    <div key={i} className="overflow-hidden relative rounded-sm" style={{ height: h as number, width: w as string, backgroundColor: "rgba(30,24,20,0.04)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >

              {/* ══════════ MAIN PRODUCT GRID ══════════ */}
              <div className="max-w-6xl mx-auto md:px-12 pt-1 pb-6 md:pb-10">
                <div className="flex flex-col md:grid md:grid-cols-[1fr_380px] md:gap-12 md:items-start">

                  {/* ══ LEFT: Gallery ══ */}
                  <div>

                    {/* ── Mobile: contained swipeable image ── */}
                    <div className="md:hidden px-5">
                      <div
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: "3/4",
                          backgroundColor: "rgba(30,24,20,0.03)",
                          touchAction: "pan-y",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        } as React.CSSProperties}
                        onClick={() => setLightboxOpen(true)}
                        onPointerDown={(e) => { dragStartXRef.current = e.clientX; dragLastXRef.current = e.clientX; }}
                        onPointerMove={(e) => { if (dragStartXRef.current !== null) dragLastXRef.current = e.clientX; }}
                        onPointerUp={(e) => {
                          const start = dragStartXRef.current;
                          if (start === null) return;
                          const delta = (dragLastXRef.current ?? e.clientX) - start;
                          dragStartXRef.current = null; dragLastXRef.current = null;
                          if (Math.abs(delta) > 32) { delta < 0 ? nextImg() : prevImg(); }
                        }}
                        onPointerLeave={() => { dragStartXRef.current = null; dragLastXRef.current = null; }}
                      >
                        <AnimatePresence initial={false} mode="wait">
                          <motion.img
                            key={mainImage}
                            src={mainImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full"
                            style={{ objectFit: "cover", objectPosition: "center top" }}
                            loading="eager"
                            decoding="async"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: imgLoaded ? 1 : 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onLoad={() => setImgLoaded(true)}
                            onError={() => setImgLoaded(true)}
                          />
                        </AnimatePresence>
                        {!imgLoaded && <ImageSkeleton variant="warm" />}

                        {/* Sold out banner */}
                        {isOutOfStock && (
                          <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-3 pointer-events-none" style={{ background: "rgba(30,24,20,0.54)", backdropFilter: "blur(3px)" }}>
                            <span style={{ ...SANS, fontSize: "0.58rem", letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
                          </div>
                        )}

                        {/* Image counter */}
                        {galleryImages.length > 1 && (
                          <div className="absolute top-3 right-4 z-10" style={{ ...SANS, fontSize: 9, letterSpacing: "0.12em", color: "rgba(250,248,245,0.7)", textShadow: "0 1px 5px rgba(0,0,0,0.28)" }}>
                            {galleryIndex + 1} / {galleryImages.length}
                          </div>
                        )}
                      </div>

                      {/* Pill dots */}
                      {galleryImages.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-3 px-5">
                          {galleryImages.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                              aria-label={`Image ${i + 1}`}
                              style={{
                                width: i === galleryIndex ? 20 : 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: i === galleryIndex ? "#1e1814" : "rgba(30,24,20,0.2)",
                                transition: "all 0.28s cubic-bezier(0.22,1,0.36,1)",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                minWidth: 6,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Desktop: vertical thumb rail + main image ── */}
                    <div className="hidden md:flex gap-3 items-start">

                      {/* Vertical thumbnails */}
                      {galleryImages.length > 1 && (
                        <div
                          className="flex flex-col gap-2 flex-shrink-0"
                          style={{ width: 58, maxHeight: "calc(75vh)", overflowY: "auto", scrollbarWidth: "none" }}
                        >
                          {galleryImages.map((src, i) => (
                            <button
                              key={`${src}-${i}`}
                              type="button"
                              onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                              className="overflow-hidden flex-shrink-0 transition-all duration-200"
                              style={{
                                width: 58,
                                height: 74,
                                border: i === galleryIndex
                                  ? "1.5px solid #1e1814"
                                  : "1.5px solid rgba(30,24,20,0.11)",
                                opacity: i === galleryIndex ? 1 : 0.52,
                              }}
                            >
                              <div className="relative w-full h-full">
                                {!thumbLoaded[i] && (
                                  <div className="absolute inset-0 overflow-hidden" style={{ background: "rgba(230,220,205,0.55)" }}>
                                    <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, transparent 30%, rgba(245,240,232,0.75) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                                  </div>
                                )}
                                <img
                                  src={src}
                                  alt={`View ${i + 1}`}
                                  className="w-full h-full"
                                  style={{ objectFit: "cover", opacity: thumbLoaded[i] ? 1 : 0, transition: "opacity 0.2s ease" }}
                                  loading="eager"
                                  onLoad={() => setThumbLoaded((p) => { const n = [...p]; n[i] = true; return n; })}
                                  onError={() => setThumbLoaded((p) => { const n = [...p]; n[i] = true; return n; })}
                                />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Main image */}
                      <div
                        className="flex-1 relative overflow-hidden cursor-pointer"
                        onClick={() => setLightboxOpen(true)}
                        onPointerDown={(e) => { dragStartXRef.current = e.clientX; dragLastXRef.current = e.clientX; }}
                        onPointerMove={(e) => { if (dragStartXRef.current !== null) dragLastXRef.current = e.clientX; }}
                        onPointerUp={(e) => {
                          const start = dragStartXRef.current;
                          if (start === null) return;
                          const delta = (dragLastXRef.current ?? e.clientX) - start;
                          dragStartXRef.current = null; dragLastXRef.current = null;
                          if (Math.abs(delta) > 40) { delta < 0 ? nextImg() : prevImg(); }
                        }}
                        onPointerLeave={() => { dragStartXRef.current = null; dragLastXRef.current = null; }}
                        style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.03)", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                      >
                        <AnimatePresence initial={false} mode="wait">
                          <motion.img
                            key={mainImage}
                            src={mainImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full"
                            style={{ objectFit: "contain", objectPosition: "center" }}
                            loading="eager"
                            decoding="async"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: imgLoaded ? 1 : 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35 }}
                            onLoad={() => setImgLoaded(true)}
                            onError={() => setImgLoaded(true)}
                          />
                        </AnimatePresence>
                        {!imgLoaded && <ImageSkeleton variant="warm" />}
                        {isOutOfStock && (
                          <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2 pointer-events-none" style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}>
                            <span style={{ ...SANS, fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
                          </div>
                        )}
                        {galleryImages.length > 1 && (
                          <>
                            <button type="button" aria-label="Previous" onClick={(e) => { e.stopPropagation(); prevImg(); }} className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-[rgba(30,24,20,0.18)] hover:text-[rgba(30,24,20,0.6)] transition-colors" style={{ width: 32, height: 48, background: "none", border: "none", cursor: "pointer" }}>
                              <ChevronLeft size={20} strokeWidth={1} />
                            </button>
                            <button type="button" aria-label="Next" onClick={(e) => { e.stopPropagation(); nextImg(); }} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-[rgba(30,24,20,0.18)] hover:text-[rgba(30,24,20,0.6)] transition-colors" style={{ width: 32, height: 48, background: "none", border: "none", cursor: "pointer" }}>
                              <ChevronRight size={20} strokeWidth={1} />
                            </button>
                          </>
                        )}
                        <div className="absolute bottom-3 right-3" style={{ ...SANS, fontSize: 7.5, color: "rgba(30,24,20,0.28)", letterSpacing: "0.2em", textTransform: "uppercase" }}>click to zoom</div>
                      </div>
                    </div>
                  </div>

                  {/* ══ RIGHT: Product info ══ */}
                  <div className="px-5 md:px-0 pt-4 md:pt-0 md:sticky md:top-[80px]">

                    {/* Name */}
                    <h1
                      style={{
                        ...SERIF,
                        fontSize: "clamp(1.6rem, 6vw, 2.4rem)",
                        fontWeight: 300,
                        color: "#1e1814",
                        letterSpacing: "0.03em",
                        lineHeight: 1.1,
                        marginBottom: 6,
                      }}
                    >
                      {product.name}
                    </h1>

                    {/* Rating summary */}
                    {avgRatingData && (
                      <div className="flex items-center gap-2 mb-3">
                        <StarDisplay value={avgRatingData.avg} size={12} />
                        <span style={{ ...SANS, fontSize: 10, color: "#8a7e74", letterSpacing: "0.08em" }}>
                          {avgRatingData.avg.toFixed(1)} ({avgRatingData.count})
                        </span>
                      </div>
                    )}

                    {/* Price row */}
                    <div className="flex flex-wrap items-center gap-2.5 mb-4">
                      {effectiveCompareAtPrice && (
                        <span style={{ ...SANS, fontSize: "clamp(0.85rem, 2.5vw, 0.98rem)", color: "#8a7e74", textDecoration: "line-through", textDecorationColor: "#c83232", textDecorationThickness: 1, letterSpacing: "0.07em" }}>
                          {effectiveCompareAtPrice}
                        </span>
                      )}
                      <span style={{ ...SANS, fontSize: "clamp(1rem, 3vw, 1.12rem)", fontWeight: 500, letterSpacing: "0.10em", color: effectiveCompareAtPrice ? "#c83232" : "#1e1814" }}>
                        {effectivePrice}
                      </span>
                      {effectiveCompareAtPrice && (() => {
                        const p = parseEGP(String(effectivePrice));
                        const c = parseEGP(String(effectiveCompareAtPrice));
                        if (!p || !c || c <= p) return null;
                        return <span style={{ ...SANS, fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", color: "#c83232" }}>Save {Math.round((1 - p / c) * 100)}%</span>;
                      })()}
                    </div>

                    {/* Divider */}
                    <div className="mb-4" style={{ width: 28, height: 1, backgroundColor: "rgba(180,160,140,0.4)" }} />

                    {/* Description */}
                    {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
                      <ul className="mb-4 space-y-1">
                        {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 rounded-full" style={{ width: 5, height: 5, marginTop: 7, backgroundColor: "rgba(30,24,20,0.2)" }} />
                            <span style={{ ...SERIF, fontSize: "clamp(0.84rem, 2.2vw, 0.92rem)", color: "#6a5e56", lineHeight: 1.65 }}>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ ...SERIF, fontSize: "clamp(0.84rem, 2.2vw, 0.92rem)", color: "#6a5e56", lineHeight: 1.68, marginBottom: 16 }}>
                        {product.description}
                      </p>
                    )}

                    {/* Size selector */}
                    {displaySizes.length > 1 && (
                      <div className="flex flex-col gap-2.5 mb-4">
                        <p style={{ ...SANS, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#8a7e74" }}>
                          Size —{" "}<span style={{ color: "#1e1814" }}>{selectedSize}</span>
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {displaySizes.map((size) => {
                            const available = product.variants?.some(
                              (v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value === size) && v.availableForSale,
                            ) ?? true;
                            const isSelected = selectedSize === size;
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setSelectedSize(size)}
                                className="relative overflow-hidden border transition-all duration-200 active:scale-[0.96]"
                                style={{
                                  minWidth: 68,
                                  minHeight: 44,
                                  padding: "10px 14px",
                                  fontSize: 11,
                                  letterSpacing: "0.18em",
                                  textTransform: "uppercase",
                                  ...SANS,
                                  fontWeight: 500,
                                  color: !available ? "rgba(30,24,20,0.3)" : isSelected ? "#1e1814" : "#5a4e44",
                                  borderColor: isSelected ? "#1e1814" : "rgba(30,24,20,0.2)",
                                  backgroundColor: isSelected ? "rgba(30,24,20,0.07)" : "transparent",
                                }}
                              >
                                {!available && (
                                  <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                                    <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
                                      <line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(30,24,20,0.14)" strokeWidth="1" />
                                    </svg>
                                  </span>
                                )}
                                {size}
                              </button>
                            );
                          })}
                        </div>
                        {selectedSize && (
                          <p style={{ ...SANS, fontSize: 11, color: "rgba(90,78,68,0.75)", lineHeight: 1.6 }}>
                            {selectedSize.toLowerCase().startsWith("s") || selectedSize.toLowerCase().startsWith("m")
                              ? <><span style={{ color: "rgba(30,24,20,0.85)" }}>{selectedSize}</span> — closer fit · heights up to 1.65 m</>
                              : <><span style={{ color: "rgba(30,24,20,0.85)" }}>{selectedSize}</span> — relaxed fit · heights 1.65 m+</>
                            }
                          </p>
                        )}
                      </div>
                    )}

                    {/* One size */}
                    {displaySizes.length <= 1 && sizeOption && (
                      <div className="mb-5">
                        <button type="button" disabled style={{ ...SANS, padding: "10px 20px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500, color: "#1e1814", border: "1px solid #1e1814", backgroundColor: "rgba(30,24,20,0.04)", minHeight: 44 }}>
                          One Size
                        </button>
                      </div>
                    )}

                    {/* ── CTA buttons ── */}
                    <div ref={ctaRef} className="flex flex-col gap-2.5 mb-6">
                      {isOutOfStock ? (
                        <motion.button
                          type="button"
                          onClick={handleNotifyMe}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center justify-center gap-2 border w-full active:scale-[0.97]"
                          style={{ ...SANS, padding: "17px 0", fontSize: "clamp(0.68rem, 2.5vw, 0.78rem)", letterSpacing: "0.28em", textTransform: "uppercase", color: "#f5f0e8", borderColor: "rgba(245,240,232,0.2)", backgroundColor: "rgba(30,24,20,0.88)", borderRadius: 3 }}
                        >
                          <Bell size={11} strokeWidth={1.8} />
                          Notify Me When Back
                        </motion.button>
                      ) : (
                        <>
                          <motion.button
                            type="button"
                            onClick={handleAddToCart}
                            whileTap={{ scale: 0.98 }}
                            className="border transition-all duration-400 w-full flex items-center justify-center active:scale-[0.97]"
                            style={{ ...SANS, padding: "16px 0", fontSize: "clamp(0.68rem, 2.5vw, 0.78rem)", letterSpacing: "0.28em", textTransform: "uppercase", color: addedFeedback ? "rgba(30,24,20,0.65)" : "#1e1814", borderColor: "#1e1814", backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "transparent", borderRadius: 3 }}
                          >
                            {addedFeedback ? "Added to Bag ✓" : "Add to Cart"}
                          </motion.button>

                          <motion.button
                            type="button"
                            onClick={handleBuyNow}
                            whileTap={{ scale: 0.98 }}
                            className="border transition-all duration-300 w-full flex items-center justify-center active:scale-[0.97]"
                            style={{ ...SANS, padding: "17px 0", fontSize: "clamp(0.68rem, 2.5vw, 0.78rem)", letterSpacing: "0.28em", textTransform: "uppercase", color: "#faf8f5", borderColor: "#1e1814", backgroundColor: "#1e1814", boxShadow: "0 6px 20px rgba(30,24,20,0.16)", borderRadius: 3 }}
                          >
                            Buy It Now
                          </motion.button>

                          {/* Apple Pay */}
                          {ENABLE_APPLE_PAY && typeof window !== "undefined" && "ApplePaySession" in window && (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() && (
                            <>
                              <div className="flex items-center gap-3 my-0.5">
                                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.09)" }} />
                                <span style={{ ...SANS, fontSize: 9, letterSpacing: "0.18em", color: "rgba(30,24,20,0.36)", textTransform: "uppercase" }}>or</span>
                                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.09)" }} />
                              </div>
                              <ShopifyApplePayButton
                                variantId={selectedVariant?.id ?? product.variantId ?? ""}
                                quantity={1}
                                priceEGP={parseEGP(String(effectivePrice)) || 0}
                                disabled={isOutOfStock}
                                style={{ width: "100%" }}
                                onSuccess={(orderNumber, total) => toast.success(`Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`, { duration: 5000 })}
                                onError={(msg) => toast.error(msg, { duration: 4000 })}
                              />
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* ── Details accordion ── */}
                    <div style={{ borderTop: "1px solid rgba(30,24,20,0.09)" }}>
                      {ACCORDION_ITEMS.map((item) => (
                        <AccordionItem
                          key={item.key}
                          label={item.label}
                          body={item.body}
                          open={openAccordion === item.key}
                          onToggle={() => setOpenAccordion((p) => p === item.key ? null : item.key)}
                        />
                      ))}
                    </div>

                  </div>
                  {/* end right col */}
                </div>
              </div>
              {/* end main grid */}

              {/* ── Full-width: Reviews ── */}
              <ReviewSection productHandle={handle} productName={product.name} />

              {/* ── Full-width: You May Also Like (centred grid) ── */}
              {onNavigate && clothingRecs.length > 0 && (
                <section style={{ borderTop: "1px solid rgba(30,24,20,0.08)", paddingTop: 56, paddingBottom: 80 }}>
                  <div className="max-w-5xl mx-auto px-5 md:px-12 text-center">
                    <p style={{ ...SANS, fontSize: 9, letterSpacing: "0.30em", textTransform: "uppercase", color: "#8a7e74", marginBottom: 8 }}>
                      You May Also Like
                    </p>
                    <div ref={recsRef}
                      className="grid gap-x-5 gap-y-8 mt-8"
                      style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
                    >
                      {clothingRecs.map((rec) => (
                        <button
                          key={rec.handle}
                          type="button"
                          onClick={() => onNavigate(rec.handle)}
                          className="text-left group w-full"
                        >
                          <div
                            className="overflow-hidden mb-3 w-full"
                            style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.04)" }}
                          >
                            <img
                              src={rec.image}
                              alt={rec.name}
                              className="w-full h-full"
                              style={{ objectFit: "cover", transition: "transform 0.65s ease" }}
                              loading="lazy"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: rec.swatch, border: "1px solid rgba(30,24,20,0.14)" }} />
                            <span style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a7e74" }}>{rec.color}</span>
                          </div>
                          <p style={{ ...SERIF, fontSize: "clamp(0.88rem, 2.2vw, 1.05rem)", fontWeight: 300, color: "#1e1814", lineHeight: 1.2 }}>{rec.name}</p>
                          <p style={{ ...SANS, fontSize: 10, letterSpacing: "0.09em", color: "#7a6e64", marginTop: 3 }}>{rec.price}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Spacer for mobile sticky bar */}
              <div className="md:hidden" style={{ height: 80 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ MOBILE STICKY CTA BAR ══ */}
      <AnimatePresence>
        {showStickyBar && !loading && (
          <motion.div
            key="sticky-bar"
            initial={{ y: 76, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 76, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden fixed bottom-0 inset-x-0 z-[60]"
            style={{
              backgroundColor: "rgba(250,248,245,0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderTop: "1px solid rgba(30,24,20,0.09)",
              padding: "10px 16px",
              paddingBottom: "max(10px, env(safe-area-inset-bottom))",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div className="flex flex-col flex-1 min-w-0">
              <p style={{ ...SERIF, fontSize: "clamp(0.84rem, 3.5vw, 0.98rem)", fontWeight: 300, color: "#1e1814", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {product.name.split(" — ")[0]}
              </p>
              <p style={{ ...SANS, fontSize: 11, letterSpacing: "0.08em", color: effectiveCompareAtPrice ? "#c83232" : "#5a4e44", marginTop: 1 }}>
                {effectivePrice}
              </p>
            </div>

            {isOutOfStock ? (
              <button
                type="button"
                onClick={handleNotifyMe}
                className="flex-shrink-0 active:scale-[0.96] transition-transform flex items-center gap-1.5"
                style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#faf8f5", backgroundColor: "#1e1814", border: "1px solid #1e1814", padding: "12px 16px", fontWeight: 500, minHeight: 44 }}
              >
                <Bell size={10} strokeWidth={1.8} />
                Notify Me
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-shrink-0 active:scale-[0.96] transition-transform"
                style={{
                  ...SANS,
                  fontSize: 8.5,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: addedFeedback ? "#1e1814" : "#faf8f5",
                  backgroundColor: addedFeedback ? "rgba(30,24,20,0.07)" : "#1e1814",
                  border: "1px solid #1e1814",
                  padding: "12px 18px",
                  fontWeight: 500,
                  transition: "all 0.28s ease",
                  minHeight: 44,
                }}
              >
                {addedFeedback ? "Added ✓" : "Add to Cart"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <NotifyMeModal
        open={notifyModalOpen}
        productTitle={product.name}
        variantTitle={selectedSize || "One Size"}
        onClose={() => setNotifyModalOpen(false)}
        onSubmit={subscribeToRestock}
      />

      <CinematicLightbox
        images={galleryImages}
        initialIndex={galleryIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
