import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { toast } from "sonner";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductConfig, VariantOption } from "~/config/images";
import { parseEGP } from "~/lib/price";
import { NotifyMeModal } from "~/components/NotifyMeModal";
import { ImageSkeleton } from "~/components/ImageSkeleton";
import { trackShopifyProductView } from "~/lib/shopifyAnalytics";

function getApiOrigin(): string {
  if (typeof window === "undefined") return "https://admin.buy-moi.com";
  return (window as unknown as { ENV?: { PUBLIC_API_ORIGIN?: string } }).ENV?.PUBLIC_API_ORIGIN ?? "https://admin.buy-moi.com";
}

interface ProductCardProps {
  product: ProductConfig;
  onLookView?: (product: ProductConfig) => void;
  onAddToCart: (variantId: string, quantity: number, title: string, color: string, size: string) => Promise<void>;
}

export function ProductCard({ product, onLookView, onAddToCart }: ProductCardProps) {
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);
  const dragStartTimeRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-60px" });
  const viewTrackedRef = useRef(false);

  const hasVariants = Boolean(product.variants && product.variants.length > 0);

  const colorOption = useMemo(() => {
    if (!hasVariants) return null;
    const firstVariant = product.variants![0];
    const opt = firstVariant.selectedOptions.find((o) => o.name.toLowerCase() === "color");
    if (!opt) return null;
    const names = [...new Set(product.variants!.map((v) => {
      const o = v.selectedOptions.find((x) => x.name.toLowerCase() === "color");
      return o?.value ?? null;
    }).filter(Boolean))] as string[];
    return { optionName: opt.name, values: names };
  }, [product.variants, hasVariants]);

  const sizeOption = useMemo(() => {
    if (!hasVariants) return null;
    const firstVariant = product.variants![0];
    const opt = firstVariant.selectedOptions.find((o) =>
      o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre"
    );
    if (!opt) return null;
    const names = [...new Set(product.variants!.map((v) => {
      const o = v.selectedOptions.find((x) => x.name.toLowerCase() === opt.name.toLowerCase());
      return o?.value ?? null;
    }).filter(Boolean))] as string[];
    return { optionName: opt.name, values: names };
  }, [product.variants, hasVariants]);

  const [selectedColor, setSelectedColor] = useState<string>(() => colorOption?.values[0] ?? "");
  const [selectedSize, setSelectedSize] = useState<string>(() => sizeOption?.values[0] ?? "One Size");

  useEffect(() => {
    if (!viewTrackedRef.current && inView) {
      viewTrackedRef.current = true;
      const priceNum = parseEGP(product.price);
      trackShopifyProductView({
        productId: product.slug,
        productTitle: product.name,
        price: Number.isFinite(priceNum) ? priceNum : undefined,
      });
    }
  }, [inView, product.slug, product.name, product.price]);

  const selectedVariant: VariantOption | undefined = useMemo(() => {
    if (!hasVariants || !product.variants) return undefined;
    return product.variants.find((v) => {
      const colorMatch = !colorOption || v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === selectedColor);
      const sizeMatch = !sizeOption || v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption.optionName.toLowerCase() && o.value === selectedSize);
      return colorMatch && sizeMatch;
    }) ?? product.variants[0];
  }, [product.variants, hasVariants, selectedColor, selectedSize, colorOption, sizeOption]);

  const swatchFor = (name: string): string =>
    product.colorSwatches?.[name.toLowerCase()] ?? "#c8bdb5";

  const resolvedColorImage = useMemo(() => {
    if (!product.colorImages) return undefined;
    const exact = product.colorImages[selectedColor];
    if (exact) return exact;
    const lower = selectedColor.toLowerCase();
    const key = Object.keys(product.colorImages).find((k) => k.toLowerCase() === lower);
    return key ? product.colorImages[key] : undefined;
  }, [product.colorImages, selectedColor]);

  const colorGallery = useMemo(() => {
    const galleries = product.colorGalleries;
    if (galleries) {
      const exact = galleries[selectedColor];
      if (exact?.length) return exact as readonly string[];
      const lower = selectedColor.toLowerCase();
      const key = Object.keys(galleries).find((k) => k.toLowerCase() === lower);
      if (key && galleries[key]?.length) return galleries[key]!;
    }
    return [resolvedColorImage ?? product.productShot];
  }, [product.colorGalleries, selectedColor, resolvedColorImage, product.productShot]);

  const galleryImages = colorGallery.length > 0 ? colorGallery : [resolvedColorImage ?? product.productShot];
  const mainImage = galleryImages[galleryIndex % galleryImages.length] ?? resolvedColorImage ?? product.productShot;

  const prevImageRef = useRef(mainImage);
  useEffect(() => {
    if (mainImage === prevImageRef.current) return;
    prevImageRef.current = mainImage;
    setIsSwapping(true);
    setImgLoaded(false);
    const t = setTimeout(() => setIsSwapping(false), 360);
    return () => clearTimeout(t);
  }, [mainImage]);

  useEffect(() => { setGalleryIndex(0); }, [selectedColor]);

  const isOutOfStock = useMemo(() => {
    if (hasVariants && selectedVariant) return !selectedVariant.availableForSale;
    return false;
  }, [hasVariants, selectedVariant]);

  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveCompareAtPrice = selectedVariant?.compareAtPrice;

  const displayColors = colorOption
    ? colorOption.values.map((name) => ({ name, swatch: swatchFor(name) }))
    : [];

  const displaySizes = (sizeOption?.values ?? []).filter((s) =>
    !["one size", "os", "default title", "one-size"].includes(s.toLowerCase())
  );

  const hasSingleVariantPill = !sizeOption || displaySizes.length === 0;

  const goToGallery = (index: number) => setGalleryIndex((index + galleryImages.length) % galleryImages.length);

  const jumpGallery = (direction: 1 | -1) => goToGallery(galleryIndex + direction);

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    const variantId = selectedVariant?.id ?? product.slug;
    await onAddToCart(variantId, 1, product.name, selectedColor, selectedSize);
    toast.success(`${product.name} added to bag`, {
      description: selectedColor && selectedSize && !hasSingleVariantPill
        ? `${selectedColor} · ${selectedSize}`
        : selectedColor || undefined,
      duration: 2500,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const subscribeToRestock = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const variantId = selectedVariant?.id ?? `${product.slug}-fallback`;
    const variantTitle = selectedVariant
      ? selectedVariant.selectedOptions.map((o) => o.value).join(" / ")
      : `${selectedColor} / ${selectedSize}`;
    try {
      const res = await fetch(`${getApiOrigin()}/api/restock/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productHandle: product.slug, variantId, variantTitle, productTitle: product.name }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) return { success: false, error: json.error ?? "Something went wrong." };
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const AMBIENT_RGBA = "rgba(210,195,175,0.10)";
  const AMBIENT_STRONG = "rgba(210,195,175,0.14)";

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 22 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };

  return (
    <>
      <section
        ref={sectionRef}
        id={product.slug}
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
          <div className="max-w-6xl mx-auto px-5 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 items-center">

            {/* Image column */}
            <motion.div variants={itemVariants} className="relative w-full">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 80% 70% at 50% 55%, ${AMBIENT_STRONG} 0%, transparent 72%)`, filter: "blur(32px)", transform: "scale(1.18) translateZ(0)" }}
              />

              <div className="relative w-full mx-auto">
                {onLookView && (
                  <motion.button
                    type="button"
                    onClick={() => onLookView(product)}
                    className="hidden md:flex mb-3 w-full items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                    variants={itemVariants}
                  >
                    <span className="text-[9px] tracking-[0.38em] uppercase font-medium" style={{ color: "#7a6e64" }}>See the Look</span>
                    <span style={{ color: "rgba(120,110,100,0.5)", fontSize: 11 }}>→</span>
                  </motion.button>
                )}

                {/* Desktop: arrows + image */}
                <div className="hidden md:flex items-center justify-center gap-4">
                  {galleryImages.length > 1 && (
                    <button
                      type="button" aria-label="Previous image"
                      onClick={(e) => { e.stopPropagation(); jumpGallery(-1); }}
                      className="shrink-0 w-7 h-7 flex items-center justify-center transition-all"
                      style={{ color: "rgba(30,24,20,0.35)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.85)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.35)")}
                    >
                      <ChevronLeft size={22} strokeWidth={1.2} />
                    </button>
                  )}

                  <div
                    className="relative group"
                    onClick={() => onLookView?.(product)}
                    style={{ width: "min(380px, 100%)", flexShrink: 0, cursor: "pointer" }}
                  >
                    <div className="relative w-full overflow-hidden" style={{ height: "clamp(260px, 34vh, 400px)" }}>
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
                      <AnimatePresence>
                        {(!imgLoaded || isSwapping) && (
                          <motion.div key="skeleton" className="absolute inset-0 pointer-events-none" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
                            <ImageSkeleton variant="warm" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {isOutOfStock && (
                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2" style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,248,245,0.92)", fontWeight: 500 }}>Sold Out</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {galleryImages.length > 1 && (
                    <button
                      type="button" aria-label="Next image"
                      onClick={(e) => { e.stopPropagation(); jumpGallery(1); }}
                      className="shrink-0 w-7 h-7 flex items-center justify-center transition-all"
                      style={{ color: "rgba(30,24,20,0.35)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.85)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(30,24,20,0.35)")}
                    >
                      <ChevronRight size={22} strokeWidth={1.2} />
                    </button>
                  )}
                </div>

                {/* Mobile */}
                <div className="md:hidden">
                  {onLookView && (
                    <motion.button
                      type="button"
                      onClick={() => onLookView(product)}
                      className="mb-3 w-full flex items-center justify-center gap-2"
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="text-[9px] tracking-[0.38em] uppercase font-medium" style={{ color: "#7a6e64" }}>See the Look</span>
                      <span style={{ color: "rgba(120,110,100,0.5)", fontSize: 11 }}>→</span>
                    </motion.button>
                  )}
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ height: "clamp(280px, 55vw, 440px)" }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      dragStartXRef.current = e.clientX;
                      dragLastXRef.current = e.clientX;
                      dragStartTimeRef.current = Date.now();
                    }}
                    onPointerMove={(e) => {
                      if (dragStartXRef.current === null) return;
                      dragLastXRef.current = e.clientX;
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
                      if (shouldSwipe) {
                        jumpGallery(delta < 0 ? 1 : -1);
                      } else {
                        onLookView?.(product);
                      }
                    }}
                    onClick={() => onLookView?.(product)}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <motion.img
                        key={mainImage}
                        src={mainImage || undefined}
                        alt={`${product.name} — ${selectedColor}`}
                        className="absolute inset-0 w-full h-full object-contain"
                        loading="lazy"
                        decoding="async"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: imgLoaded ? 1 : 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgLoaded(true)}
                      />
                    </AnimatePresence>
                    {(!imgLoaded || isSwapping) && <ImageSkeleton variant="warm" />}
                    {isOutOfStock && (
                      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2" style={{ background: "rgba(30,24,20,0.52)" }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,248,245,0.92)" }}>Sold Out</span>
                      </div>
                    )}
                  </div>

                  {/* Gallery dots (mobile) */}
                  {galleryImages.length > 1 && (
                    <div className="flex justify-center gap-1 mt-2">
                      {galleryImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          className="rounded-full transition-all"
                          style={{ width: i === galleryIndex ? 16 : 6, height: 6, backgroundColor: i === galleryIndex ? "#1e1814" : "rgba(30,24,20,0.2)" }}
                          aria-label={`Image ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Gallery thumbnails (desktop) */}
                {galleryImages.length > 1 && (
                  <div className="hidden md:flex justify-center gap-1.5 mt-3">
                    {galleryImages.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => setGalleryIndex(i)}
                        className="overflow-hidden transition-all"
                        style={{ width: 32, height: 32, border: i === galleryIndex ? "2px solid #1e1814" : "2px solid transparent", opacity: i === galleryIndex ? 1 : 0.5 }}
                        aria-label={`Gallery image ${i + 1}`}
                      >
                        <img src={src || undefined} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Details column */}
            <motion.div variants={itemVariants} className="flex flex-col gap-5 pt-6 md:pt-0 px-0 md:pl-4">
              {/* Label + Name */}
              <div>
                <p className="text-[9px] tracking-[0.45em] uppercase mb-2" style={{ color: "#7a6e64" }}>
                  {product.colorLabel || "New Drop"}
                </p>
                <h2 className="font-serif leading-tight" style={{ color: "#1e1814", fontSize: "clamp(1.5rem, 4vw, 2.4rem)", letterSpacing: "0.04em", fontWeight: 300 }}>
                  {product.name}
                </h2>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="font-medium text-base" style={{ color: "#1e1814" }}>{effectivePrice}</span>
                  {effectiveCompareAtPrice && (
                    <span className="text-sm line-through" style={{ color: "rgba(30,24,20,0.4)" }}>{effectiveCompareAtPrice}</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed" style={{ color: "rgba(30,24,20,0.65)" }}>{product.description}</p>

              {/* Color swatches */}
              {displayColors.length > 0 && (
                <div>
                  <p className="text-[9px] tracking-[0.3em] uppercase mb-2.5" style={{ color: "rgba(30,24,20,0.5)" }}>
                    Colour — <span style={{ color: "#1e1814" }}>{selectedColor}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {displayColors.map(({ name, swatch }) => {
                      const isSelected = name === selectedColor;
                      const isAvailable = !hasVariants || product.variants!.some((v) =>
                        v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === name) && v.availableForSale
                      );
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setSelectedColor(name)}
                          title={name}
                          className="relative transition-all duration-200"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            backgroundColor: swatch,
                            border: isSelected ? "2px solid #1e1814" : "2px solid rgba(30,24,20,0.15)",
                            outline: isSelected ? "2px solid transparent" : "none",
                            outlineOffset: 2,
                            boxShadow: isSelected ? "0 0 0 3px rgba(30,24,20,0.25)" : "none",
                            opacity: isAvailable ? 1 : 0.4,
                            cursor: isAvailable ? "pointer" : "not-allowed",
                          }}
                          aria-label={name}
                          aria-pressed={isSelected}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {!hasSingleVariantPill && displaySizes.length > 0 && (
                <div>
                  <p className="text-[9px] tracking-[0.3em] uppercase mb-2.5" style={{ color: "rgba(30,24,20,0.5)" }}>
                    Size — <span style={{ color: "#1e1814" }}>{selectedSize}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {displaySizes.map((size) => {
                      const isSelected = size === selectedSize;
                      const isAvailable = !hasVariants || product.variants!.some((v) =>
                        v.selectedOptions.some((o) => o.name.toLowerCase() === "size" && o.value === size) &&
                        (!colorOption || v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === selectedColor)) &&
                        v.availableForSale
                      );
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => isAvailable && setSelectedSize(size)}
                          className="relative px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition-all duration-200"
                          style={{
                            border: isSelected ? "1.5px solid #1e1814" : "1.5px solid rgba(30,24,20,0.2)",
                            backgroundColor: isSelected ? "#1e1814" : "transparent",
                            color: isSelected ? "#fff" : "rgba(30,24,20,0.7)",
                            opacity: isAvailable ? 1 : 0.4,
                            cursor: isAvailable ? "pointer" : "not-allowed",
                          }}
                          aria-label={`Size ${size}`}
                          aria-pressed={isSelected}
                          disabled={!isAvailable}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Material details */}
              {(product.outer || product.lining) && (
                <div className="text-[10px] leading-relaxed" style={{ color: "rgba(30,24,20,0.45)" }}>
                  {product.outer && <p>{product.outer}</p>}
                  {product.lining && <p>{product.lining}</p>}
                </div>
              )}

              {/* CTA */}
              {isOutOfStock ? (
                <button
                  type="button"
                  onClick={() => setNotifyModalOpen(true)}
                  className="flex items-center justify-center gap-2 w-full py-4 text-[11px] tracking-[0.28em] uppercase border transition-all duration-200 hover:bg-stone-50"
                  style={{ borderColor: "rgba(30,24,20,0.2)", color: "#1e1814" }}
                >
                  <Bell size={13} strokeWidth={1.5} />
                  Notify Me When Available
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="relative isolate overflow-hidden w-full py-4 text-[11px] tracking-[0.28em] uppercase text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "#1e1814", boxShadow: "0 12px 28px rgba(30,24,20,0.15), inset 0 1px 0 rgba(255,255,255,0.1)" }}
                >
                  <AnimatePresence mode="wait">
                    {addedFeedback ? (
                      <motion.span key="added" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="block">
                        Added to Bag ✓
                      </motion.span>
                    ) : (
                      <motion.span key="add" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="block">
                        Add to Bag
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )}

              {/* Ref */}
              {product.ref && (
                <p className="text-[9px] tracking-[0.2em]" style={{ color: "rgba(30,24,20,0.3)" }}>Ref. {product.ref}</p>
              )}
            </motion.div>
          </div>
        </motion.div>
      </section>

      <NotifyMeModal
        open={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
        productName={product.name}
        variantTitle={selectedVariant
          ? selectedVariant.selectedOptions.map((o) => o.value).join(" / ")
          : `${selectedColor} / ${selectedSize}`}
        onSubmit={subscribeToRestock}
      />
    </>
  );
}
