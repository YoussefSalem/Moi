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

// ─── Design tokens (Ferrari-luxury adapted for Moi) ───────────────────────────
const T = {
  ink: "#1a1410",
  inkMuted: "#6a5e56",
  inkFaint: "rgba(26,20,16,0.38)",
  hairline: "rgba(26,20,16,0.10)",
  hairlineStrong: "rgba(26,20,16,0.18)",
  canvas: "#faf8f5",
  canvasWarm: "#f5f0e8",
  surface: "rgba(26,20,16,0.04)",
  accent: "#c83232",
};

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
    <div style={{ borderBottom: `1px solid ${T.hairline}` }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "18px 0", minHeight: 56 }}
      >
        <span style={{ ...SANS, fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: T.ink, fontWeight: 600 }}>
          {label}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{ color: T.inkFaint, lineHeight: 0, flexShrink: 0, marginLeft: 12 }}
        >
          <Plus size={12} strokeWidth={1.5} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <p style={{ ...SANS, fontSize: "clamp(0.72rem, 2vw, 0.78rem)", color: T.inkMuted, lineHeight: 1.85, letterSpacing: "0.025em", paddingBottom: 20 }}>
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
  const [recsPage, setRecsPage] = useState(0);
  const [recsDir, setRecsDir] = useState<1 | -1>(1);

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

  // Product display name (split "Name — Color")
  const [productBaseName, productColorLabel] = product.name.includes(" — ")
    ? product.name.split(" — ")
    : [product.name, ""];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="min-h-screen"
        style={{ background: T.canvas }}
      >
        {/* ══ BACK NAV ══ */}
        <div
          className="absolute top-0 left-0 z-10 px-4 md:px-10"
          style={{ paddingTop: "max(72px, calc(env(safe-area-inset-top) + 64px))" }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2.5 group"
            style={{ background: "none", border: "none", cursor: "pointer", minHeight: 44, padding: "0 4px" }}
          >
            <ArrowLeft
              size={14}
              strokeWidth={1.3}
              style={{ color: T.inkMuted, transition: "transform 0.22s ease", display: "block" }}
              className="group-hover:-translate-x-0.5 transition-transform"
            />
            <span style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.30em", textTransform: "uppercase", color: T.inkMuted, fontWeight: 500 }}>
              Back
            </span>
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
            >
              {/* Mobile skeleton */}
              <div className="md:hidden">
                <div className="w-full" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <ImageSkeleton variant="warm" />
                </div>
                <div className="px-5 pt-8 flex flex-col gap-4">
                  {[["65%", 28], ["35%", 18], ["100%", 11], ["90%", 11]].map(([w, h], i) => (
                    <div key={i} className="overflow-hidden relative" style={{ height: h as number, width: w as string, backgroundColor: "rgba(30,24,20,0.05)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Desktop skeleton */}
              <div className="hidden md:grid max-w-[1320px] mx-auto" style={{ gridTemplateColumns: "minmax(0,1fr) 420px", gap: 0, paddingTop: 88 }}>
                <div className="w-full" style={{ aspectRatio: "4/5", backgroundColor: "rgba(30,24,20,0.04)" }}>
                  <ImageSkeleton variant="warm" />
                </div>
                <div className="px-12 pt-8 flex flex-col gap-5">
                  {[["70%", 36], ["40%", 22], ["100%", 12], ["90%", 12]].map(([w, h], i) => (
                    <div key={i} className="overflow-hidden relative" style={{ height: h as number, width: w as string, backgroundColor: "rgba(30,24,20,0.05)" }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >

              {/* ══════════ MAIN PRODUCT LAYOUT ══════════ */}
              <div
                className="md:grid md:items-start"
                style={{
                  gridTemplateColumns: "minmax(0,1fr) 420px",
                  maxWidth: 1320,
                  margin: "0 auto",
                }}
              >
                {/* ══ LEFT: Gallery ══ */}
                <div className="relative">

                  {/* ── MOBILE: full-bleed image ── */}
                  <div
                    className="md:hidden relative overflow-hidden"
                    style={{
                      aspectRatio: "3/4",
                      backgroundColor: T.canvasWarm,
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
                        transition={{ duration: 0.35 }}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgLoaded(true)}
                      />
                    </AnimatePresence>
                    {!imgLoaded && <ImageSkeleton variant="warm" />}

                    {/* Sold out banner */}
                    {isOutOfStock && (
                      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-4 pointer-events-none" style={{ background: "rgba(26,20,16,0.58)", backdropFilter: "blur(4px)" }}>
                        <span style={{ ...SANS, fontSize: "0.6rem", letterSpacing: "0.30em", textTransform: "uppercase", color: "rgba(250,248,245,0.92)", fontWeight: 600 }}>Sold Out</span>
                      </div>
                    )}

                    {/* Image counter — top right */}
                    {galleryImages.length > 1 && (
                      <div
                        className="absolute top-4 right-4 z-10 flex items-center gap-1"
                        style={{ ...SANS, fontSize: 8, letterSpacing: "0.18em", color: "rgba(250,248,245,0.75)" }}
                      >
                        <span style={{ fontWeight: 600 }}>{galleryIndex + 1}</span>
                        <span style={{ opacity: 0.5 }}>/</span>
                        <span>{galleryImages.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile dot indicators */}
                  {galleryImages.length > 1 && (
                    <div className="md:hidden flex items-center justify-center gap-2 mt-4">
                      {galleryImages.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                          aria-label={`Image ${i + 1}`}
                          style={{
                            width: i === galleryIndex ? 24 : 5,
                            height: 2,
                            backgroundColor: i === galleryIndex ? T.ink : "rgba(26,20,16,0.22)",
                            transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* ── DESKTOP: thumb rail + main image ── */}
                  <div className="hidden md:flex" style={{ paddingTop: 80, gap: 16, paddingLeft: 40, paddingRight: 0, paddingBottom: 40 }}>

                    {/* Vertical thumbnails */}
                    {galleryImages.length > 1 && (
                      <div
                        className="flex flex-col gap-2.5 flex-shrink-0"
                        style={{ width: 68, maxHeight: "calc(82vh)", overflowY: "auto", scrollbarWidth: "none" }}
                      >
                        {galleryImages.map((src, i) => (
                          <button
                            key={`${src}-${i}`}
                            type="button"
                            onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                            className="overflow-hidden flex-shrink-0 transition-all duration-250"
                            style={{
                              width: 68,
                              height: 88,
                              border: "none",
                              outline: i === galleryIndex ? `1.5px solid ${T.ink}` : `1px solid ${T.hairline}`,
                              opacity: i === galleryIndex ? 1 : 0.48,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            <div className="relative w-full h-full">
                              {!thumbLoaded[i] && (
                                <div className="absolute inset-0 overflow-hidden" style={{ background: T.canvasWarm }}>
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
                      className="flex-1 relative overflow-hidden cursor-zoom-in"
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
                      style={{ aspectRatio: "4/5", backgroundColor: T.canvasWarm, userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
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
                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-3 pointer-events-none" style={{ background: "rgba(26,20,16,0.52)", backdropFilter: "blur(3px)" }}>
                          <span style={{ ...SANS, fontSize: "0.58rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(250,248,245,0.92)", fontWeight: 600 }}>Sold Out</span>
                        </div>
                      )}

                      {galleryImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            aria-label="Previous"
                            onClick={(e) => { e.stopPropagation(); prevImg(); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-200 hover:opacity-100"
                            style={{ width: 36, height: 56, background: "none", border: "none", cursor: "pointer", opacity: 0.22, color: T.ink }}
                          >
                            <ChevronLeft size={20} strokeWidth={1} />
                          </button>
                          <button
                            type="button"
                            aria-label="Next"
                            onClick={(e) => { e.stopPropagation(); nextImg(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-200 hover:opacity-100"
                            style={{ width: 36, height: 56, background: "none", border: "none", cursor: "pointer", opacity: 0.22, color: T.ink }}
                          >
                            <ChevronRight size={20} strokeWidth={1} />
                          </button>
                        </>
                      )}

                      {/* Gallery count */}
                      {galleryImages.length > 1 && (
                        <div className="absolute bottom-4 right-4" style={{ ...SANS, fontSize: 7.5, color: "rgba(26,20,16,0.30)", letterSpacing: "0.22em", textTransform: "uppercase" }}>
                          {galleryIndex + 1} / {galleryImages.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ══ RIGHT: Product info ══ */}
                <div
                  className="md:sticky"
                  style={{ top: 0, paddingTop: 0 }}
                >
                  {/* ─── Info panel ─── */}
                  <div
                    className="px-6 md:px-10"
                    style={{
                      paddingTop: "clamp(28px, 6vw, 88px)",
                      paddingBottom: 40,
                      borderLeft: `1px solid ${T.hairline}`,
                      minHeight: "100vh",
                    }}
                  >

                    {/* Category eyebrow */}
                    <p style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.35em", textTransform: "uppercase", color: T.inkFaint, fontWeight: 500, marginBottom: 18 }}>
                      New Collection
                    </p>

                    {/* Product name */}
                    <h1
                      style={{
                        ...SERIF,
                        fontSize: "clamp(2rem, 5vw, 2.8rem)",
                        fontWeight: 300,
                        color: T.ink,
                        letterSpacing: "0.02em",
                        lineHeight: 1.08,
                        marginBottom: productColorLabel ? 8 : 16,
                      }}
                    >
                      {productBaseName}
                    </h1>

                    {/* Color label */}
                    {productColorLabel && (
                      <p style={{ ...SANS, fontSize: 9.5, letterSpacing: "0.28em", textTransform: "uppercase", color: T.inkMuted, fontWeight: 500, marginBottom: 16 }}>
                        {productColorLabel}
                      </p>
                    )}

                    {/* Rating summary */}
                    {avgRatingData && (
                      <div className="flex items-center gap-2 mb-4">
                        <StarDisplay value={avgRatingData.avg} size={11} />
                        <span style={{ ...SANS, fontSize: 9, color: T.inkMuted, letterSpacing: "0.08em" }}>
                          {avgRatingData.avg.toFixed(1)} · {avgRatingData.count} {avgRatingData.count === 1 ? "review" : "reviews"}
                        </span>
                      </div>
                    )}

                    {/* Price row */}
                    <div className="flex flex-wrap items-baseline gap-3 mb-7">
                      <span style={{ ...SERIF, fontSize: "clamp(1.4rem, 3vw, 1.7rem)", fontWeight: 400, letterSpacing: "0.04em", color: effectiveCompareAtPrice ? T.accent : T.ink }}>
                        {effectivePrice}
                      </span>
                      {effectiveCompareAtPrice && (
                        <>
                          <span style={{ ...SANS, fontSize: "clamp(0.78rem, 2vw, 0.88rem)", color: T.inkFaint, textDecoration: "line-through", textDecorationThickness: 1, letterSpacing: "0.06em" }}>
                            {effectiveCompareAtPrice}
                          </span>
                          {(() => {
                            const p = parseEGP(String(effectivePrice));
                            const c = parseEGP(String(effectiveCompareAtPrice));
                            if (!p || !c || c <= p) return null;
                            return (
                              <span style={{ ...SANS, fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: T.accent, textTransform: "uppercase" }}>
                                −{Math.round((1 - p / c) * 100)}%
                              </span>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {/* Hairline */}
                    <div style={{ height: 1, backgroundColor: T.hairline, marginBottom: 28 }} />

                    {/* Description */}
                    {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
                      <ul className="mb-6 space-y-2">
                        {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="flex-shrink-0" style={{ width: 1, height: 1, marginTop: 9, padding: "0 0.5px 4px", backgroundColor: T.inkFaint, display: "block", marginLeft: 2 }} />
                            <span style={{ ...SERIF, fontSize: "clamp(0.85rem, 2vw, 0.94rem)", color: T.inkMuted, lineHeight: 1.7 }}>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ ...SERIF, fontSize: "clamp(0.86rem, 2vw, 0.95rem)", color: T.inkMuted, lineHeight: 1.75, marginBottom: 24 }}>
                        {product.description}
                      </p>
                    )}

                    {/* Size selector */}
                    {displaySizes.length > 1 && (
                      <div className="mb-7">
                        <div className="flex items-center justify-between mb-3.5">
                          <p style={{ ...SANS, fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", color: T.inkFaint, fontWeight: 500 }}>
                            Size
                          </p>
                          <span style={{ ...SANS, fontSize: 9.5, letterSpacing: "0.14em", color: T.ink, fontWeight: 600, textTransform: "uppercase" }}>
                            {selectedSize}
                          </span>
                        </div>
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
                                className="size-pill relative transition-all duration-200 active:scale-[0.96]"
                                style={{
                                  minWidth: 52,
                                  minHeight: 46,
                                  padding: "10px 14px",
                                  fontSize: 9.5,
                                  letterSpacing: "0.22em",
                                  textTransform: "uppercase",
                                  ...SANS,
                                  fontWeight: isSelected ? 600 : 500,
                                  color: !available ? "rgba(26,20,16,0.25)" : isSelected ? T.ink : T.inkMuted,
                                  border: `1px solid ${isSelected ? T.ink : T.hairlineStrong}`,
                                  backgroundColor: isSelected ? "rgba(26,20,16,0.06)" : "transparent",
                                  cursor: "pointer",
                                }}
                              >
                                {!available && (
                                  <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                                    <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
                                      <line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(26,20,16,0.12)" strokeWidth="1" />
                                    </svg>
                                  </span>
                                )}
                                {size}
                              </button>
                            );
                          })}
                        </div>
                        {selectedSize && (
                          <p style={{ ...SANS, fontSize: 10, color: T.inkFaint, lineHeight: 1.6, marginTop: 10 }}>
                            {selectedSize.toLowerCase().startsWith("s") || selectedSize.toLowerCase().startsWith("m")
                              ? <>Closer fit · heights up to 1.65 m</>
                              : <>Relaxed fit · heights 1.65 m+</>
                            }
                          </p>
                        )}
                      </div>
                    )}

                    {/* One size */}
                    {displaySizes.length <= 1 && sizeOption && (
                      <div className="mb-6">
                        <button
                          type="button"
                          disabled
                          style={{ ...SANS, padding: "12px 22px", fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600, color: T.ink, border: `1px solid ${T.ink}`, backgroundColor: "rgba(26,20,16,0.04)", minHeight: 46, cursor: "default" }}
                        >
                          One Size
                        </button>
                      </div>
                    )}

                    {/* ── CTA buttons ── */}
                    <div ref={ctaRef} className="flex flex-col gap-3 mb-8">
                      {isOutOfStock ? (
                        <motion.button
                          type="button"
                          onClick={handleNotifyMe}
                          whileTap={{ scale: 0.98 }}
                          className="cta-btn-mobile flex items-center justify-center gap-2.5 w-full transition-opacity hover:opacity-80"
                          style={{ ...SANS, padding: "18px 0", fontSize: "clamp(0.68rem, 2vw, 0.76rem)", letterSpacing: "0.30em", textTransform: "uppercase", fontWeight: 600, color: "#faf8f5", backgroundColor: T.ink, border: "none", cursor: "pointer", minHeight: 52 }}
                        >
                          <Bell size={11} strokeWidth={1.8} />
                          Notify Me When Back
                        </motion.button>
                      ) : (
                        <>
                          <motion.button
                            type="button"
                            onClick={handleBuyNow}
                            whileTap={{ scale: 0.99 }}
                            className="cta-btn-mobile w-full flex items-center justify-center transition-opacity hover:opacity-85"
                            style={{ ...SANS, padding: "18px 0", fontSize: "clamp(0.68rem, 2vw, 0.76rem)", letterSpacing: "0.30em", textTransform: "uppercase", fontWeight: 600, color: "#faf8f5", backgroundColor: T.ink, border: "none", cursor: "pointer", minHeight: 52 }}
                          >
                            Buy It Now
                          </motion.button>

                          <motion.button
                            type="button"
                            onClick={handleAddToCart}
                            whileTap={{ scale: 0.99 }}
                            className="cta-btn-mobile w-full flex items-center justify-center transition-all duration-300"
                            style={{
                              ...SANS,
                              padding: "17px 0",
                              fontSize: "clamp(0.68rem, 2vw, 0.76rem)",
                              letterSpacing: "0.30em",
                              textTransform: "uppercase",
                              fontWeight: 500,
                              color: addedFeedback ? T.inkMuted : T.ink,
                              backgroundColor: "transparent",
                              border: `1px solid ${addedFeedback ? T.hairlineStrong : T.ink}`,
                              cursor: "pointer",
                              minHeight: 52,
                            }}
                          >
                            {addedFeedback ? "Added to Bag ✓" : "Add to Bag"}
                          </motion.button>

                          {/* Apple Pay */}
                          {ENABLE_APPLE_PAY && typeof window !== "undefined" && "ApplePaySession" in window && (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() && (
                            <>
                              <div className="flex items-center gap-3 my-1">
                                <div style={{ flex: 1, height: 1, backgroundColor: T.hairline }} />
                                <span style={{ ...SANS, fontSize: 8, letterSpacing: "0.22em", color: T.inkFaint, textTransform: "uppercase" }}>or</span>
                                <div style={{ flex: 1, height: 1, backgroundColor: T.hairline }} />
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

                    {/* ── Accordion ── */}
                    <div style={{ borderTop: `1px solid ${T.hairline}` }}>
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

                    {/* ── Provenance note ── */}
                    <div className="mt-8" style={{ borderTop: `1px solid ${T.hairline}`, paddingTop: 20 }}>
                      <p style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.20em", textTransform: "uppercase", color: T.inkFaint, lineHeight: 1.9 }}>
                        Designed &amp; crafted with care ·{" "}
                        <span style={{ color: T.inkMuted }}>Ships from Egypt</span>
                      </p>
                    </div>

                  </div>
                </div>
                {/* end info col */}
              </div>
              {/* end main grid */}

              {/* ── Full-width: Reviews ── */}
              <div style={{ borderTop: `1px solid ${T.hairline}` }}>
                <ReviewSection productHandle={handle} productName={product.name} />
              </div>

              {/* ── Full-width: You May Also Like ── */}
              {onNavigate && clothingRecs.length > 0 && (() => {
                const perPage = 3;
                const n = clothingRecs.length;
                const visibleRecs = Array.from({ length: perPage }, (_, i) =>
                  clothingRecs[((recsPage * perPage + i) % n + n) % n]
                );
                const goNext = () => { setRecsDir(1);  setRecsPage((p) => p + 1); };
                const goPrev = () => { setRecsDir(-1); setRecsPage((p) => p - 1); };
                return (
                  <section style={{ borderTop: `1px solid ${T.hairline}`, paddingTop: 72, paddingBottom: 96 }}>
                    {/* Heading */}
                    <div className="text-center px-6 mb-12">
                      <p style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.35em", textTransform: "uppercase", color: T.inkFaint, fontWeight: 500, marginBottom: 12 }}>
                        Continue Shopping
                      </p>
                      <h2 style={{
                        ...SERIF,
                        fontSize: "clamp(2rem, 6vw, 3.8rem)",
                        fontWeight: 300,
                        color: T.ink,
                        letterSpacing: "0.04em",
                        lineHeight: 1,
                      }}>
                        You May Also Like
                      </h2>
                    </div>

                    {/* Grid */}
                    <div
                      ref={recsRef}
                      className="relative overflow-hidden px-6 md:px-12"
                    >
                      <AnimatePresence initial={false} mode="wait" custom={recsDir}>
                        <motion.div
                          key={recsPage}
                          custom={recsDir}
                          variants={{
                            enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
                            center: { x: 0, opacity: 1 },
                            exit: (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
                          }}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                          className="grid grid-cols-1 sm:grid-cols-3 gap-0"
                          style={{ gridTemplateColumns: "repeat(3,1fr)" }}
                        >
                          {visibleRecs.map((rec) => (
                            <button
                              key={rec.handle}
                              type="button"
                              onClick={() => onNavigate(rec.handle)}
                              className="text-left group transition-opacity hover:opacity-90"
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              <div className="overflow-hidden" style={{ aspectRatio: "3/4", backgroundColor: T.canvasWarm }}>
                                <img
                                  src={rec.image}
                                  alt={`${rec.name} ${rec.color}`}
                                  className="w-full h-full transition-transform duration-700 group-hover:scale-[1.03]"
                                  style={{ objectFit: "cover", objectPosition: "center top" }}
                                  loading="lazy"
                                />
                              </div>
                              <div className="pt-4 pb-6 px-2">
                                <p style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.26em", textTransform: "uppercase", color: T.ink, fontWeight: 600, marginBottom: 4 }}>
                                  {rec.name}
                                </p>
                                <p style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.14em", color: T.inkMuted, marginBottom: 6 }}>
                                  {rec.color}
                                </p>
                                <p style={{ ...SERIF, fontSize: "0.95rem", color: T.inkMuted, letterSpacing: "0.04em" }}>
                                  {rec.price}
                                </p>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Nav arrows */}
                    <div className="flex items-center justify-center gap-6 mt-8">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="flex items-center justify-center transition-opacity hover:opacity-60"
                        style={{ width: 44, height: 44, border: `1px solid ${T.hairlineStrong}`, background: "none", cursor: "pointer", color: T.ink }}
                      >
                        <ChevronLeft size={16} strokeWidth={1.2} />
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="flex items-center justify-center transition-opacity hover:opacity-60"
                        style={{ width: 44, height: 44, border: `1px solid ${T.hairlineStrong}`, background: "none", cursor: "pointer", color: T.ink }}
                      >
                        <ChevronRight size={16} strokeWidth={1.2} />
                      </button>
                    </div>
                  </section>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile sticky CTA bar ── */}
      <AnimatePresence>
        {showStickyBar && !loading && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden fixed bottom-0 inset-x-0 z-[60]"
            style={{
              backgroundColor: "rgba(250,248,245,0.96)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderTop: `1px solid ${T.hairline}`,
              padding: "10px 16px",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div className="flex flex-col flex-1 min-w-0">
              <p style={{ ...SERIF, fontSize: "clamp(0.88rem, 3.5vw, 1rem)", fontWeight: 300, color: T.ink, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {productBaseName}
              </p>
              <p style={{ ...SANS, fontSize: 9.5, letterSpacing: "0.12em", color: effectiveCompareAtPrice ? T.accent : T.inkMuted, marginTop: 2, fontWeight: 500 }}>
                {effectivePrice}
              </p>
            </div>

            {isOutOfStock ? (
              <button
                type="button"
                onClick={handleNotifyMe}
                className="flex-shrink-0 active:scale-[0.96] transition-transform flex items-center gap-1.5"
                style={{ ...SANS, fontSize: 8.5, letterSpacing: "0.24em", textTransform: "uppercase", color: "#faf8f5", backgroundColor: T.ink, border: "none", padding: "13px 18px", fontWeight: 600, minHeight: 46, cursor: "pointer" }}
              >
                <Bell size={10} strokeWidth={1.8} />
                Notify Me
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-shrink-0 active:scale-[0.96] transition-all duration-300"
                style={{
                  ...SANS,
                  fontSize: 8.5,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: addedFeedback ? T.inkMuted : "#faf8f5",
                  backgroundColor: addedFeedback ? T.surface : T.ink,
                  border: `1px solid ${T.ink}`,
                  padding: "13px 20px",
                  fontWeight: 600,
                  minHeight: 46,
                  cursor: "pointer",
                }}
              >
                {addedFeedback ? "Added ✓" : "Add to Bag"}
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
