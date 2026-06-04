import { useState, useMemo, useEffect, useRef } from "react";
import { trackShopifyProductView } from "@/lib/shopifyAnalytics";
import { parseEGP } from "@/lib/price";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { toast } from "sonner";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductConfig, VariantOption } from "@/config/images";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { NotifyMeModal } from "@/components/NotifyMeModal";
import { ImageSkeleton } from "@/components/ImageSkeleton";
import {
  trackProductView,
  trackProductImageInteraction,
  trackVariantChange,
  trackSizeChartClick,
  trackProductTime,
  trackProductScroll,
  trackAddToCart,
  trackRepeatedView,
} from "@/lib/analytics";
import { getStockCount } from "@/lib/stock";

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface ProductCardProps {
  product: ProductConfig;
  onLookView: (product: ProductConfig) => void;
  onNavigateToProduct?: (handle: string) => void;
  hideLookView?: boolean;
}

export function ProductCard({ product, onLookView, onNavigateToProduct, hideLookView }: ProductCardProps) {
  const { addToCart } = useCart();
  const { customer } = useCustomer();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);
  const dragStartTimeRef = useRef<number | null>(null);
  const [draggingGallery, setDraggingGallery] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-60px" });

  // Track product view + internal analytics when card enters viewport
  const viewTrackedRef = useRef(false);
  const productViewCountRef = useRef(0);
  const productEnterTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inView) return;
    const priceNum = parseEGP(product.price);
    trackShopifyProductView({
      productId: product.variantId ?? "",
      productTitle: product.name,
      price: Number.isFinite(priceNum) ? priceNum : undefined,
      currencyCode: "EGP",
    });
    // Internal analytics only — Meta Pixel + TikTok ViewContent are fired by ProductPage
    // when the user navigates to the product, avoiding a duplicate signal here.
    if (!viewTrackedRef.current) {
      viewTrackedRef.current = true;
      trackProductView(product.variantId ?? "", product.name, Number.isFinite(priceNum) ? priceNum : undefined);
    }
    productViewCountRef.current++;
    if (productViewCountRef.current >= 2) {
      trackRepeatedView(product.variantId ?? "", productViewCountRef.current);
    }
    productEnterTimeRef.current = Date.now();
  }, [inView, product.variantId ?? "", product.name, product.price]);

  // Track scroll depth on this product card
  useEffect(() => {
    if (!inView || !sectionRef.current) return;
    let maxDepth = 0;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    const el = sectionRef.current;
    const onScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const depth = Math.round((visible / rect.height) * 100);
        if (depth > maxDepth) {
          maxDepth = depth;
          if (depth % 25 === 0) trackProductScroll(product.variantId ?? "", depth);
        }
        scrollTimeout = null;
      }, 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [inView, product.variantId ?? ""]);

  // Track time spent when component unmounts
  useEffect(() => {
    return () => {
      if (productEnterTimeRef.current) {
        const seconds = Math.round((Date.now() - productEnterTimeRef.current) / 1000);
        if (seconds > 5) trackProductTime(product.variantId ?? "", seconds);
      }
    };
  }, []);

  const hasShopifyVariants = Boolean(product.variants && product.variants.length > 0);

  const colorOption = useMemo(() => {
    if (!hasShopifyVariants) return null;
    const opt = product.variants![0].selectedOptions.find((o) => o.name.toLowerCase() === "color");
    if (!opt) return null;
    const names = [...new Set(product.variants!.map((v) => {
      const o = v.selectedOptions.find((x) => x.name.toLowerCase() === "color");
      return o?.value ?? null;
    }).filter(Boolean))] as string[];
    return { optionName: opt.name, values: names };
  }, [product.variants, hasShopifyVariants]);

  const sizeOption = useMemo(() => {
    if (!hasShopifyVariants) return null;
    const opt = product.variants![0].selectedOptions.find(
      (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre"
    );
    if (!opt) return null;
    const names = [...new Set(product.variants!.map((v) => {
      const o = v.selectedOptions.find((x) => x.name.toLowerCase() === opt.name.toLowerCase());
      return o?.value ?? null;
    }).filter(Boolean))] as string[];
    return { optionName: opt.name, values: names };
  }, [product.variants, hasShopifyVariants]);

  const [selectedColor, setSelectedColor] = useState<string>(
    () => colorOption?.values[0] ?? "Ivory"
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    () => sizeOption?.values[0] ?? "Small"
  );

  // Persistent stock count for the selected color
  const stockCount = getStockCount(product.slug ?? "", selectedColor);

  const prevVariantsRef = useRef<readonly VariantOption[] | undefined>(undefined);
  useEffect(() => {
    if (product.variants === prevVariantsRef.current) return;
    prevVariantsRef.current = product.variants;
    if (!product.variants || product.variants.length === 0) return;
    const firstColor = colorOption?.values[0];
    if (firstColor) setSelectedColor(firstColor);
    const firstSize = sizeOption?.values[0];
    if (firstSize) setSelectedSize(firstSize);
  });

  const selectedVariant: VariantOption | undefined = useMemo(() => {
    if (!hasShopifyVariants || !product.variants) return undefined;
    return product.variants.find((v) => {
      const colorMatch = !colorOption || v.selectedOptions.some(
        (o) => o.name.toLowerCase() === "color" && o.value === selectedColor
      );
      const sizeMatch = !sizeOption || v.selectedOptions.some(
        (o) => o.name.toLowerCase() === sizeOption.optionName.toLowerCase() && o.value === selectedSize
      );
      return colorMatch && sizeMatch;
    }) ?? product.variants[0];
  }, [product.variants, hasShopifyVariants, selectedColor, selectedSize, colorOption, sizeOption]);

  const swatchFor = (name: string): string =>
    product.colorSwatches?.[name.toLowerCase()] ?? "#c8bdb5";

  function getDefaultStock(color: string, size: string): number {
    if (hasShopifyVariants) return -1;
    if (!product.defaultInventory) return -1;
    const colorKey = color.toLowerCase();
    const colorInventory = product.defaultInventory[colorKey];
    if (colorInventory === undefined) return -1;
    return colorInventory[size] ?? 0;
  }

  function isSizeAvailable(size: string): boolean {
    const defaultStock = getDefaultStock(selectedColor, size);
    if (defaultStock >= 0) return defaultStock > 0;
    if (!hasShopifyVariants || !product.variants) return true;
    return product.variants.some((v) => {
      const sizeMatch = v.selectedOptions.some(
        (o) => o.name.toLowerCase() === (sizeOption?.optionName.toLowerCase() ?? "size") && o.value === size
      );
      const colorMatch = !colorOption || v.selectedOptions.some(
        (o) => o.name.toLowerCase() === "color" && o.value === selectedColor
      );
      return sizeMatch && colorMatch && v.availableForSale;
    });
  }

  useEffect(() => {
    if (!sizeOption || !product.variants) return;
    const sizeExistsForColor = product.variants.some((v) =>
      v.selectedOptions.some((o) => o.name.toLowerCase() === (sizeOption.optionName.toLowerCase() ?? "size") && o.value === selectedSize) &&
      (!colorOption || v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === selectedColor))
    );
    if (!sizeExistsForColor) {
      const firstExisting = sizeOption.values.find((s) =>
        product.variants!.some((v) =>
          v.selectedOptions.some((o) => o.name.toLowerCase() === (sizeOption.optionName.toLowerCase() ?? "size") && o.value === s) &&
          (!colorOption || v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === selectedColor))
        )
      );
      if (firstExisting) setSelectedSize(firstExisting);
    }
  }, [selectedColor, product.variants]);

  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveCompareAtPrice = selectedVariant?.compareAtPrice ?? (product as unknown as { compareAtPrice?: string }).compareAtPrice;

  const resolvedColorImage = (() => {
    if (!product.colorImages) return undefined;
    const exact = product.colorImages[selectedColor];
    if (exact) return exact;
    const lower = selectedColor.toLowerCase();
    const key = Object.keys(product.colorImages).find((k) => k.toLowerCase() === lower);
    return key ? product.colorImages[key] : undefined;
  })();

  const colorGallery = (() => {
    const galleries = product.colorGalleries;
    if (galleries) {
      const exact = galleries[selectedColor];
      if (exact?.length) return exact as readonly string[];
      const lower = selectedColor.toLowerCase();
      const key = Object.keys(galleries).find((k) => k.toLowerCase() === lower);
      if (key && galleries[key]?.length) return galleries[key]!;
    }
    const filmstrip = product.filmstrip ?? [];
    const raw = filmstrip.length > 0
      ? [product.productShot, ...filmstrip]
      : [resolvedColorImage ?? product.productShot];
    return Array.from(new Set(raw));
  })();

  const galleryImages = colorGallery.length > 0 ? colorGallery : [resolvedColorImage ?? product.productShot];
  const mainImage = galleryImages[galleryIndex % galleryImages.length] ?? resolvedColorImage ?? product.productShot;

  // Soft warm beige ambient — consistent across all products, never extracts from image
  const AMBIENT_RGBA = "rgba(210,195,175,0.10)";
  const AMBIENT_STRONG = "rgba(210,195,175,0.14)";

  const [isSwapping, setIsSwapping] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const prevImageRef = useRef(mainImage);
  useEffect(() => {
    if (mainImage === prevImageRef.current) return;
    prevImageRef.current = mainImage;
    setIsSwapping(true);
    setImgLoaded(false);
    const t = setTimeout(() => setIsSwapping(false), 360);
    return () => clearTimeout(t);
  }, [mainImage]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [selectedColor]);

  const isOutOfStock = (() => {
    const defaultStock = getDefaultStock(selectedColor, selectedSize);
    if (defaultStock >= 0) return defaultStock <= 0;
    return hasShopifyVariants && selectedVariant ? !selectedVariant.availableForSale : false;
  })();

  const displayColors = colorOption
    ? colorOption.values.map((name) => ({ name, swatch: swatchFor(name) }))
    : product.variants
      ? [...new Set(product.variants.flatMap((variant) => variant.selectedOptions
          .filter((option) => option.name.toLowerCase() === "color")
          .map((option) => option.value)))].map((name) => ({ name, swatch: swatchFor(name) }))
      : [];

  const displaySizes = sizeOption?.values?.filter((s) =>
    !["one size", "os", "default title", "one-size"].includes(s.toLowerCase())
  ) ?? [];

  const hasSingleVariantPill = !sizeOption || sizeOption.values.length === 1 || sizeOption.values.every((s) =>
    ["one size", "os", "default title", "one-size"].includes(s.toLowerCase())
  );
  const singleVariantLabel = sizeOption?.values.find((s) => !["one size", "os", "default title", "one-size"].includes(s.toLowerCase()))
    ?? sizeOption?.values[0]
    ?? "One Size";

  const goToGallery = (index: number) => setGalleryIndex((index + galleryImages.length) % galleryImages.length);
  const nextGallery = () => goToGallery(galleryIndex + 1);
  const prevGallery = () => goToGallery(galleryIndex - 1);
  const jumpGallery = (direction: 1 | -1) => {
    direction > 0 ? nextGallery() : prevGallery();
  };

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    trackAddToCart(
      selectedVariant?.id ?? product.variantId ?? "",
      product.name,
      1,
      parseEGP(String(effectivePrice)) || 0,
    );
    await addToCart({
      variantId: selectedVariant?.id ?? product.variantId ?? "",
      title: product.name,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: resolvedColorImage ?? product.productShot,
      size: selectedSize,
      color: selectedColor,
    });
    toast.success(`${product.name} added to bag`, {
      description: `${selectedColor} · ${selectedSize}`,
      duration: 2500,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const subscribeToRestock = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const variantId = selectedVariant?.id ?? product.variantId ?? `${product.name}-fallback`;
    const variantTitle = selectedVariant
      ? selectedVariant.selectedOptions.map((o) => o.value).join(" / ")
      : `${selectedColor} / ${selectedSize}`;
    try {
      const res = await fetch("/api/restock/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productHandle: product.name, variantId, variantTitle, productTitle: product.name }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) return { success: false, error: json.error ?? "Something went wrong." };
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const handleNotifyMe = async () => {
    if (customer?.email) {
      const result = await subscribeToRestock(customer.email);
      if (result.success) {
        toast.success("You're on the list.", { description: `We'll email you when ${product.name} is back.`, duration: 3000 });
      } else {
        toast.error(result.error ?? "Could not subscribe. Please try again.");
      }
    } else {
      setNotifyModalOpen(true);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 22 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };

  return (
    <>
      <section
        ref={sectionRef}
        className="w-full overflow-hidden"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 50% 40%, ${AMBIENT_RGBA} 0%, hsl(30 15% 95%) 68%)`,
          paddingTop: "clamp(24px, 3vw, 40px)",
          paddingBottom: "clamp(28px, 4vw, 48px)",
        }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="w-full"
        >
          {/* ── Mobile layout: stacked ── Desktop layout: 2-col ── */}
          <div className="max-w-6xl mx-auto px-5 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 items-center">

            {/* ── IMAGE COLUMN ── */}
            <motion.div variants={itemVariants} className="relative w-full">
              {/* Ambient glow behind image */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 80% 70% at 50% 55%, ${AMBIENT_STRONG} 0%, transparent 72%)`,
                  filter: "blur(32px)",
                  transform: "scale(1.18) translateZ(0)",
                }}
              />

              {/* Image tap / swipe area */}
              <div className="relative w-full mx-auto">
                {/* See the Look — desktop, above image */}
                {!hideLookView && (
                <motion.button
                  type="button"
                  onClick={() => {
                    onLookView(product);
                    trackProductImageInteraction(product.variantId ?? "", "click");
                  }}
                  className="hidden md:flex mb-3 w-full items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                  variants={itemVariants}
                >
                  <span
                    className="text-[9px] tracking-[0.38em] uppercase font-medium"
                    style={{ color: "#7a6e64", fontFamily: "'Montserrat', sans-serif" }}
                  >
                    See the Look
                  </span>
                  <span style={{ color: "rgba(120,110,100,0.5)", fontSize: 11 }}>→</span>
                </motion.button>
                )}

                {/* Desktop: image + side arrows in a row — Mobile: swipe only */}
                <div className="hidden md:flex items-center justify-center gap-4">
                  {/* Left arrow (desktop) */}
                  {galleryImages.length > 1 && (
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={(e) => { e.stopPropagation(); prevGallery(); }}
                      className="shrink-0 flex items-center justify-center transition-all duration-300"
                      style={{
                        width: 28,
                        height: 28,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "rgba(30,24,20,0.35)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.85)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.35)")}
                    >
                      <ChevronLeft size={22} strokeWidth={1.2} />
                    </button>
                  )}

                  <div
                    className="relative group"
                    onPointerDown={(e) => {
                      dragStartXRef.current = e.clientX;
                      dragLastXRef.current = e.clientX;
                      dragStartTimeRef.current = Date.now();
                      setDraggingGallery(true);
                    }}
                    onPointerMove={(e) => {
                      if (dragStartXRef.current === null) return;
                      dragLastXRef.current = e.clientX;
                    }}
                    onPointerCancel={() => {
                      const start = dragStartXRef.current;
                      const last = dragLastXRef.current;
                      dragStartXRef.current = null;
                      dragLastXRef.current = null;
                      dragStartTimeRef.current = null;
                      setDraggingGallery(false);
                      if (start !== null && last !== null) {
                        const delta = last - start;
                        if (Math.abs(delta) > 40) jumpGallery(delta < 0 ? 1 : -1);
                      }
                    }}
                    onPointerUp={(e) => {
                      const start = dragStartXRef.current;
                      if (start === null) return;
                      const endX = dragLastXRef.current ?? e.clientX;
                      const delta = endX - start;
                      const elapsed = Math.max(1, Date.now() - (dragStartTimeRef.current ?? Date.now()));
                      const velocity = delta / elapsed;
                      const shouldSwipe = Math.abs(delta) > 40 || Math.abs(velocity) > 0.4;
                      dragStartXRef.current = null;
                      dragLastXRef.current = null;
                      dragStartTimeRef.current = null;
                      setDraggingGallery(false);
                      if (shouldSwipe) {
                        jumpGallery(delta < 0 ? 1 : -1);
                      } else if (hideLookView && onNavigateToProduct) {
                        onNavigateToProduct(product.slug);
                      } else {
                        onLookView(product);
                      }
                    }}
                    onPointerLeave={() => {
                      dragStartXRef.current = null;
                      dragLastXRef.current = null;
                      dragStartTimeRef.current = null;
                      setDraggingGallery(false);
                    }}
                    style={{ width: "min(380px, 100%)", flexShrink: 0, touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none", cursor: "pointer" }}
                  >
                    {/* Image frame */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{ height: "clamp(260px, 34vh, 400px)" }}
                    >
                      <AnimatePresence initial={false} mode="wait">
                        <motion.img
                          key={mainImage}
                          src={mainImage || undefined}
                          alt={`${product.name} — ${selectedColor}`}
                          className="absolute inset-0 w-full h-full"
                          style={{ objectFit: "contain", objectPosition: "center" }}
                          loading="lazy"
                          decoding="async"
                          initial={{ opacity: 0, scale: 0.975 }}
                          animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 0.975 }}
                          exit={{ opacity: 0, scale: 1.025 }}
                          transition={{ duration: 0.28, ease: "easeInOut" }}
                          onLoad={() => setImgLoaded(true)}
                          onError={() => setImgLoaded(true)}
                        />
                      </AnimatePresence>

                      {/* Skeleton — visible while new image loads */}
                      <AnimatePresence>
                        {(!imgLoaded || isSwapping) && (
                          <motion.div
                            key="skeleton"
                            className="absolute inset-0 pointer-events-none"
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.3 } }}
                          >
                            <ImageSkeleton variant="card" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>

                  {/* Right arrow (desktop) */}
                  {galleryImages.length > 1 && (
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={(e) => { e.stopPropagation(); nextGallery(); }}
                      className="shrink-0 flex items-center justify-center transition-all duration-300"
                      style={{
                        width: 28,
                        height: 28,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "rgba(30,24,20,0.35)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.85)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.35)")}
                    >
                      <ChevronRight size={22} strokeWidth={1.2} />
                    </button>
                  )}
                </div>

                {/* Mobile: just image, no arrows */}
                {!hideLookView && (
                <motion.button
                  type="button"
                  onClick={() => {
                    onLookView(product);
                    trackProductImageInteraction(product.variantId ?? "", "click");
                  }}
                  className="md:hidden mb-3 w-full flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                  variants={itemVariants}
                >
                  <span
                    className="text-[9px] tracking-[0.38em] uppercase font-medium"
                    style={{ color: "#7a6e64", fontFamily: "'Montserrat', sans-serif" }}
                  >
                    See the Look
                  </span>
                  <span style={{ color: "rgba(120,110,100,0.5)", fontSize: 11 }}>→</span>
                </motion.button>
                )}
                <div
                  className="md:hidden relative w-full mx-auto"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragStartXRef.current = e.clientX;
                    dragLastXRef.current = e.clientX;
                    dragStartTimeRef.current = Date.now();
                    setDraggingGallery(true);
                  }}
                  onPointerMove={(e) => {
                    if (dragStartXRef.current === null) return;
                    dragLastXRef.current = e.clientX;
                  }}
                  onPointerCancel={() => {
                    const start = dragStartXRef.current;
                    const last = dragLastXRef.current;
                    dragStartXRef.current = null;
                    dragLastXRef.current = null;
                    dragStartTimeRef.current = null;
                    setDraggingGallery(false);
                    if (start !== null && last !== null) {
                      const delta = last - start;
                      if (Math.abs(delta) > 40) jumpGallery(delta < 0 ? 1 : -1);
                    }
                  }}
                  onPointerUp={(e) => {
                    const start = dragStartXRef.current;
                    if (start === null) return;
                    const endX = dragLastXRef.current ?? e.clientX;
                    const delta = endX - start;
                    const elapsed = Math.max(1, Date.now() - (dragStartTimeRef.current ?? Date.now()));
                    const velocity = delta / elapsed;
                    const shouldSwipe = Math.abs(delta) > 40 || Math.abs(velocity) > 0.4;
                    dragStartXRef.current = null;
                    dragLastXRef.current = null;
                    dragStartTimeRef.current = null;
                    setDraggingGallery(false);
                    if (shouldSwipe) {
                      jumpGallery(delta < 0 ? 1 : -1);
                    } else if (hideLookView && onNavigateToProduct) {
                      onNavigateToProduct(product.slug);
                    } else {
                      onLookView(product);
                    }
                  }}
                  style={{ touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none", cursor: "pointer" }}
                >
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ height: "clamp(260px, 50vw, 380px)" }}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <motion.img
                        key={mainImage}
                        src={mainImage || undefined}
                        alt={`${product.name} — ${selectedColor}`}
                        className="absolute inset-0 w-full h-full"
                        style={{ objectFit: "contain", objectPosition: "center" }}
                        loading="lazy"
                        decoding="async"
                        initial={{ opacity: 0, scale: 0.975 }}
                        animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 0.975 }}
                        exit={{ opacity: 0, scale: 1.025 }}
                        transition={{ duration: 0.28, ease: "easeInOut" }}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgLoaded(true)}
                      />
                    </AnimatePresence>
                    {/* Skeleton — visible while new image loads */}
                    <AnimatePresence>
                      {(!imgLoaded || isSwapping) && (
                        <motion.div
                          key="skeleton"
                          className="absolute inset-0 pointer-events-none"
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        >
                          <ImageSkeleton variant="card" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Gallery dots — mobile only (desktop uses arrows) */}
                {galleryImages.length > 1 && (
                  <div className="md:hidden flex flex-col items-center gap-2 mt-5">
                    <div className="flex items-center justify-center">
                      {galleryImages.map((_, index) => (
                        <button
                          key={`${selectedColor}-${index}`}
                          type="button"
                          aria-label={`Image ${index + 1}`}
                          onClick={(e) => { e.stopPropagation(); setGalleryIndex(index); }}
                          style={{
                            padding: "6px 2px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            className="block rounded-full transition-all duration-300"
                            style={{
                              width: index === galleryIndex ? 14 : 4,
                              height: 4,
                              borderRadius: 999,
                              backgroundColor: index === galleryIndex ? "#1e1814" : "rgba(30,24,20,0.24)",
                            }}
                          />
                        </button>
                      ))}
                    </div>
                    <p
                      style={{
                        fontSize: "9px",
                        letterSpacing: "0.32em",
                        textTransform: "uppercase",
                        color: "rgba(30,24,20,0.38)",
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 500,
                        userSelect: "none",
                      }}
                    >
                      swipe to browse
                    </p>
                  </div>
                )}

              </div>
            </motion.div>

            {/* ── CONTENT COLUMN ── */}
            <div
              className="flex flex-col items-center text-center mt-3 md:mt-0"
            >
              {/* Product name */}
              <motion.h2
                variants={itemVariants}
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(1.6rem, 4.5vw, 2.4rem)",
                  fontWeight: 300,
                  color: "#1e1814",
                  letterSpacing: "0.04em",
                  lineHeight: 1.1,
                  marginBottom: 6,
                }}
              >
                {product.name}
              </motion.h2>

              {/* View product page link */}
              {onNavigateToProduct && (
                <motion.button
                  type="button"
                  variants={itemVariants}
                  onClick={() => onNavigateToProduct(`${product.slug}-${slugify(selectedColor)}`)}
                  className="flex items-center gap-1.5 mb-2 transition-opacity duration-200 hover:opacity-55"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    color: "#7a6e64",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  View Details →
                </motion.button>
              )}

              {/* Description — bullets if available, otherwise plain text */}
              {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
                <motion.ul variants={itemVariants} className="text-sm leading-relaxed font-light max-w-xs md:max-w-sm space-y-1.5 mb-2">
                  {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, backgroundColor: "rgba(30,24,20,0.18)", border: "1px solid rgba(30,24,20,0.2)" }} />
                      <span style={{ color: "#6a5e56" }}>{bullet}</span>
                    </li>
                  ))}
                </motion.ul>
              ) : (
                <motion.p
                  variants={itemVariants}
                  className="text-sm leading-relaxed font-light max-w-xs md:max-w-sm"
                  style={{ color: "#6a5e56", marginBottom: 8 }}
                >
                  {product.description}
                </motion.p>
              )}

              {/* Divider */}
              <motion.div
                variants={itemVariants}
                className="w-10 mb-2"
                style={{ height: 1, backgroundColor: "rgba(180,160,140,0.4)" }}
              />

              {/* Color */}
              {displayColors.length > 0 && (
                <motion.div variants={itemVariants} className="flex flex-col gap-1.5 mb-3 items-center w-full">
                  <p
                    className="text-[10px] tracking-[0.28em] uppercase font-medium"
                    style={{ color: "#8a7e74", fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Color —{" "}
                    <span style={{ color: "#1e1814" }}>{selectedColor}</span>
                  </p>
                  <div className="flex items-center gap-2.5 flex-wrap justify-center">
                    {displayColors.map((option, index) => (
                      <button
                        key={option.name}
                        type="button"
                        aria-label={`View ${option.name}`}
                        aria-pressed={selectedColor === option.name}
                        onClick={() => {
                          if (onNavigateToProduct) {
                            onNavigateToProduct(`${product.slug}-${slugify(option.name)}`);
                          } else {
                            setSelectedColor(option.name);
                            trackVariantChange(product.variantId ?? "", option.name);
                          }
                        }}
                        className="relative"
                        style={{ width: 30, height: 30, flexShrink: 0 }}
                      >
                        <span
                          className="absolute inset-0 rounded-full transition-transform duration-300 hover:scale-110"
                          style={{
                            backgroundColor: option.swatch,
                            boxShadow:
                              index === displayColors.length - 1 && option.swatch.startsWith("#1")
                                ? "inset 0 0 0 1px rgba(255,255,255,0.16)"
                                : "inset 0 0 0 1px rgba(30,24,20,0.1)",
                          }}
                        />
                        <span
                          className="absolute inset-[-5px] rounded-full border transition-opacity duration-300"
                          style={{
                            borderColor: "rgba(30,24,20,0.38)",
                            opacity: selectedColor === option.name ? 1 : 0,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Size */}
              {hasSingleVariantPill ? (
                <motion.div variants={itemVariants} className="flex flex-col gap-1.5 mb-2 items-center w-full">
                  <button
                    type="button"
                    aria-pressed
                    className="px-4 py-1.5 text-[10px] tracking-[0.22em] uppercase font-medium border"
                    style={{
                      color: "#1e1814",
                      borderColor: "#1e1814",
                      backgroundColor: "rgba(30,24,20,0.04)",
                      cursor: "default",
                    }}
                  >
                    {singleVariantLabel}
                  </button>
                </motion.div>
              ) : displaySizes.length > 1 && (
                <motion.div variants={itemVariants} className="flex flex-col gap-1.5 mb-2 items-center w-full">
                  <p
                    className="text-[10px] tracking-[0.28em] uppercase font-medium"
                    style={{ color: "#8a7e74", fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Size
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {displaySizes.map((size) => {
                      const available = isSizeAvailable(size);
                      const isSelected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          onClick={() => {
                            setSelectedSize(size);
                            trackVariantChange(product.variantId ?? "", size);
                          }}
                          type="button"
                          aria-pressed={isSelected}
                          title={!available ? "Out of stock — notify me" : undefined}
                          className="relative overflow-hidden border transition-all duration-300"
                          style={{
                            minWidth: 64,
                            padding: "7px 12px",
                            fontSize: 10,
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            fontWeight: 500,
                            color: !available ? "rgba(30,24,20,0.36)" : isSelected ? "#1e1814" : "#7a6e64",
                            borderColor: isSelected ? "#1e1814" : "rgba(30,24,20,0.16)",
                            backgroundColor: isSelected ? "rgba(30,24,20,0.05)" : "rgba(250,248,245,0.8)",
                          }}
                        >
                          {!available && (
                            <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                              <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
                                <line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(30,24,20,0.18)" strokeWidth="1" />
                              </svg>
                            </span>
                          )}
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {/* Size guide — updates when a size is selected */}
                  {selectedSize && (
                    <p
                      className="mt-1.5 text-[10px] leading-5 max-w-xs"
                      style={{
                        color: "rgba(120,108,96,0.5)",
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {selectedSize.toLowerCase().includes("s") || selectedSize.toLowerCase().includes("m") ? (
                        <>
                          <span style={{ color: "rgba(30,24,20,0.65)" }}>{selectedSize}</span> — a closer fit. Best for heights up to 1.65 m.
                        </>
                      ) : (
                        <>
                          <span style={{ color: "rgba(30,24,20,0.65)" }}>{selectedSize}</span> — a relaxed fit. Best for heights 1.65 m and above.
                        </>
                      )}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Scarcity note */}
              {!product.name.toLowerCase().includes("versa") && (
                <motion.p
                  variants={itemVariants}
                  className="mb-1"
                  style={{
                    color: "#9e2a2b",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "9px",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    textShadow: "0 0 14px rgba(158,42,43,0.22), 0 0 28px rgba(158,42,43,0.10)",
                  }}
                >
                  Almost sold out
                </motion.p>
              )}

              {/* Price */}
              <motion.div variants={itemVariants} className="mb-3 flex flex-col items-center" style={{ gap: 2 }}>
                {effectiveCompareAtPrice && (
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "clamp(0.95rem, 2.8vw, 1.1rem)",
                      fontWeight: 400,
                      letterSpacing: "0.08em",
                      color: "#8a7e74",
                      textDecoration: "line-through",
                      textDecorationThickness: 1,
                      textDecorationColor: "#c83232",
                      lineHeight: 1.2,
                    }}
                  >
                    {effectiveCompareAtPrice}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      color: effectiveCompareAtPrice ? "#c83232" : "#1e1814",
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "clamp(1.09rem, 3.5vw, 1.3rem)",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      lineHeight: 1.2,
                    }}
                  >
                    {effectivePrice}
                  </span>
                  {(() => {
                    const p = parseEGP(effectivePrice);
                    const c = parseEGP(effectiveCompareAtPrice ?? "");
                    if (!p || !c || c <= p) return null;
                    return (
                      <span
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: "11px",
                          fontWeight: 500,
                          letterSpacing: "0.14em",
                          color: "#c83232",
                        }}
                      >
                        {`Save ${Math.round((1 - p / c) * 100)}%`}
                      </span>
                    );
                  })()}
                </div>
              </motion.div>

              {/* Scarcity count */}
              {!isOutOfStock && (
                <motion.p
                  variants={itemVariants}
                  className="mb-3"
                  style={{
                    color: "#c83232",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    fontWeight: 500,
                    textShadow: "0 0 12px rgba(158,42,43,0.12)",
                  }}
                >
                  Only {stockCount} left
                </motion.p>
              )}

              {/* CTA */}
              <motion.div variants={itemVariants} className="w-full flex flex-col items-center">
                {isOutOfStock ? (
                  <motion.button
                    type="button"
                    onClick={handleNotifyMe}
                    whileTap={{ scale: 0.98 }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 border transition-all duration-300"
                    style={{
                      maxWidth: 320,
                      padding: "11px 24px",
                      fontSize: 9,
                      letterSpacing: "0.38em",
                      textTransform: "uppercase",
                      fontFamily: "'Montserrat', sans-serif",
                      color: "#f5f0e8",
                      borderColor: "rgba(245,240,232,0.2)",
                      backgroundColor: "rgba(30,24,20,0.9)",
                      boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
                    }}
                  >
                    <Bell size={11} strokeWidth={1.8} />
                    Notify Me
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={handleAddToCart}
                    whileTap={{ scale: 0.98 }}
                    className="w-full md:w-auto border transition-all duration-500"
                    style={{
                      maxWidth: 320,
                      padding: "11px 32px",
                      fontSize: 9,
                      letterSpacing: "0.42em",
                      textTransform: "uppercase",
                      fontFamily: "'Montserrat', sans-serif",
                      color: addedFeedback ? "#1e1814" : "#faf8f5",
                      borderColor: "#1e1814",
                      backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                      boxShadow: addedFeedback ? "none" : "0 8px 28px rgba(30,24,20,0.22), 0 2px 10px rgba(0,0,0,0.1)",
                    }}
                  >
                    {addedFeedback ? "Added to Bag ✓" : "Order Now"}
                  </motion.button>
                )}

              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      <NotifyMeModal
        open={notifyModalOpen}
        productTitle={product.name}
        variantTitle={
          selectedVariant
            ? selectedVariant.selectedOptions.map((o) => o.value).join(" / ")
            : `${selectedColor} / ${selectedSize}`
        }
        onClose={() => setNotifyModalOpen(false)}
        onSubmit={subscribeToRestock}
      />
    </>
  );
}
