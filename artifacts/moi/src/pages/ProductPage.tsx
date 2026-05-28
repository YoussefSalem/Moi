import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowLeft, Bell } from "lucide-react";
import { toast } from "sonner";
import { useShopifyProductByHandle } from "@/hooks/useShopifyProductByHandle";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { IMAGES, type ProductConfig } from "@/config/images";
import { NotifyMeModal } from "@/components/NotifyMeModal";
import { CinematicLightbox } from "@/components/CinematicLightbox";
import { trackAddToCart } from "@/lib/analytics";

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

  const allVariants = (matched as unknown as { variants?: Array<{ id: string; availableForSale: boolean; selectedOptions: Array<{ name: string; value: string }>; price?: string }> }).variants;
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
}

export function ProductPage({ handle, onBack }: ProductPageProps) {
  const fallback = deriveFallbackFromHandle(handle);
  const { product, loading } = useShopifyProductByHandle(handle, fallback);
  // When Shopify returns all variants for the base product (e.g. all MOI WAVVY colors),
  // we need to filter to the color in the URL. Extract from fallback.name which is
  // e.g. "MOI WAVVY — Light Blue" (set by deriveFallbackFromHandle).
  const pageColorName = fallback.name.includes(" — ")
    ? (fallback.name.split(" — ").pop() ?? "")
    : "";
  const { addToCart } = useCart();
  const { customer } = useCustomer();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // SEO: update document head imperatively so meta is reliably in the <head>
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${product.name} — Moi`;
    let descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = descTag?.content ?? "";
    if (!descTag) {
      descTag = document.createElement("meta");
      descTag.name = "description";
      document.head.appendChild(descTag);
    }
    descTag.content = product.description?.slice(0, 160) ?? "";
    return () => {
      document.title = prevTitle;
      if (descTag) descTag.content = prevDesc;
    };
  }, [product.name, product.description]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [handle]);
  useEffect(() => { setGalleryIndex(0); setImgLoaded(false); }, [handle]);

  const sizeOption = product.variants
    ? (() => {
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
      })()
    : null;

  const displaySizes = sizeOption?.values.filter(
    (s) => !["one size", "os", "default title", "one-size"].includes(s.toLowerCase()),
  ) ?? [];

  const [selectedSize, setSelectedSize] = useState(() => displaySizes[0] ?? "");
  useEffect(() => { if (displaySizes[0]) setSelectedSize(displaySizes[0]); }, [product.slug]);

  const galleryImages: string[] = (() => {
    const film = product.filmstrip as string[];
    if (film?.length > 0) return [product.productShot, ...film];
    return [product.productShot];
  })();

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

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    trackAddToCart(
      selectedVariant?.id ?? product.variantId ?? "",
      product.name,
      1,
      parseFloat(String(effectivePrice).replace(/[^0-9]/g, "")) || 0,
    );
    await addToCart({
      variantId: selectedVariant?.id ?? product.variantId ?? "",
      title: product.name,
      price: effectivePrice,
      priceAmount: parseFloat(String(effectivePrice).replace(/[^0-9]/g, "")),
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: product.name,
    });
    toast.success(`${product.name} added to bag`, { duration: 2500 });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
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
      <div className="min-h-screen" style={{ backgroundColor: BG }}>
        {/* Back button — extra top padding to clear the fixed header (h-16 + safe-area) */}
        <div className="w-full px-5 md:px-12 pt-20 md:pt-24 pb-3">
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

        {loading ? (
          <div className="flex flex-col md:flex-row gap-10 md:gap-16 max-w-6xl mx-auto px-5 md:px-12 py-10">
            <div className="w-full md:w-1/2 aspect-[3/4] rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.06)" }} />
            <div className="flex-1 flex flex-col gap-5 pt-4">
              <div className="h-7 w-2/3 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.07)" }} />
              <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.05)" }} />
              <div className="h-4 w-4/5 rounded animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.05)" }} />
              <div className="h-12 w-48 rounded animate-pulse mt-6" style={{ backgroundColor: "rgba(30,24,20,0.09)" }} />
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-6xl mx-auto px-5 md:px-12 pt-6 md:pt-10 pb-24 flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-16 items-start"
          >
            {/* ── IMAGE GALLERY ── */}
            <div className="w-full flex flex-col gap-4">
              {/* Image row: arrow | image | arrow */}
              <div className="flex items-center gap-2 md:gap-4">
                {/* Previous — minimal, outside image */}
                {galleryImages.length > 1 && (
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={(e) => { e.stopPropagation(); prevImg(); }}
                    className="hidden md:flex shrink-0 items-center justify-center text-[rgba(30,24,20,0.15)] hover:text-[rgba(30,24,20,0.55)] transition-colors duration-200"
                    style={{ width: 28, height: 60, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <ChevronLeft size={22} strokeWidth={1} />
                  </button>
                )}

                {/* Main image — click opens lightbox zoom */}
                <div
                  className="relative flex-1 overflow-hidden rounded-sm cursor-pointer"
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
                  style={{ touchAction: "pan-y", aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.03)", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                >
                  <AnimatePresence initial={false} mode="wait">
                    <motion.img
                      key={mainImage}
                      src={mainImage}
                      alt={`${product.name}`}
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: "contain", objectPosition: "center" }}
                      loading="eager"
                      decoding="async"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: imgLoaded ? 1 : 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgLoaded(true)}
                    />
                  </AnimatePresence>
                  {!imgLoaded && (
                    <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: "rgba(30,24,20,0.05)" }} />
                  )}

                  {/* Zoom hint — subtle, fades on interaction */}
                  <div className="absolute bottom-3 right-3" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, color: "rgba(30,24,20,0.35)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    tap to zoom
                  </div>
                </div>

                {/* Next — minimal, outside image */}
                {galleryImages.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={(e) => { e.stopPropagation(); nextImg(); }}
                    className="hidden md:flex shrink-0 items-center justify-center text-[rgba(30,24,20,0.15)] hover:text-[rgba(30,24,20,0.55)] transition-colors duration-200"
                    style={{ width: 28, height: 60, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <ChevronRight size={22} strokeWidth={1} />
                  </button>
                )}
              </div>

              {/* Thumbnails */}
              {galleryImages.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {galleryImages.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                      className="overflow-hidden rounded-sm transition-all duration-200"
                      style={{
                        width: 56,
                        height: 72,
                        border: i === galleryIndex
                          ? "1.5px solid #1e1814"
                          : "1.5px solid rgba(30,24,20,0.12)",
                        flexShrink: 0,
                        opacity: i === galleryIndex ? 1 : 0.65,
                      }}
                    >
                      <img
                        src={src}
                        alt={`View ${i + 1}`}
                        className="w-full h-full"
                        style={{ objectFit: "cover" }}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── PRODUCT INFO ── */}
            <div className="flex flex-col pt-0 md:pt-8 w-full">
              {/* Name */}
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(1.7rem, 7vw, 3rem)",
                  fontWeight: 300,
                  color: "#1e1814",
                  letterSpacing: "0.04em",
                  lineHeight: 1.1,
                  marginBottom: 12,
                }}
              >
                {product.name}
              </h1>

              {/* Price */}
              <p
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "clamp(1rem, 3vw, 1.15rem)",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  color: "#1e1814",
                  marginBottom: 20,
                }}
              >
                {effectivePrice}
              </p>

              {/* Divider */}
              <div className="w-10 mb-6" style={{ height: 1, backgroundColor: "rgba(180,160,140,0.4)" }} />

              {/* Description */}
              <p
                className="leading-relaxed font-light mb-8"
                style={{ color: "#6a5e56", fontSize: "clamp(0.82rem, 2.2vw, 0.9rem)", maxWidth: 400 }}
              >
                {product.description}
              </p>

              {/* Size selector */}
              {displaySizes.length > 1 && (
                <div className="flex flex-col gap-3 mb-8">
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "#8a7e74",
                    }}
                  >
                    Size —{" "}
                    <span style={{ color: "#1e1814" }}>{selectedSize}</span>
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
                          className="relative overflow-hidden border transition-all duration-300"
                          style={{
                            minWidth: 88,
                            padding: "11px 18px",
                            fontSize: 10,
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            fontFamily: "'Montserrat', sans-serif",
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
                  {selectedSize && (
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "rgba(120,108,96,0.5)", lineHeight: 1.7 }}>
                      {selectedSize.toLowerCase().includes("s") || selectedSize.toLowerCase().includes("m")
                        ? <><span style={{ color: "rgba(30,24,20,0.65)" }}>{selectedSize}</span> — a closer fit. Best for heights up to 1.65 m.</>
                        : <><span style={{ color: "rgba(30,24,20,0.65)" }}>{selectedSize}</span> — a relaxed fit. Best for heights 1.65 m and above.</>
                      }
                    </p>
                  )}
                </div>
              )}

              {/* One Size pill */}
              {displaySizes.length <= 1 && sizeOption && (
                <div className="mb-8">
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "11px 24px",
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      color: "#1e1814",
                      border: "1px solid #1e1814",
                      backgroundColor: "rgba(30,24,20,0.04)",
                    }}
                  >
                    One Size
                  </button>
                </div>
              )}

              {/* CTA — wide, luxurious, generous padding */}
              {isOutOfStock ? (
                <motion.button
                  type="button"
                  onClick={handleNotifyMe}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 border transition-all duration-300 w-full md:w-auto"
                  style={{
                    padding: "18px 48px",
                    minWidth: 280,
                    maxWidth: 400,
                    fontSize: "clamp(0.7rem, 2.5vw, 0.8rem)",
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    fontFamily: "'Montserrat', sans-serif",
                    color: "#f5f0e8",
                    borderColor: "rgba(245,240,232,0.2)",
                    backgroundColor: "rgba(30,24,20,0.9)",
                    borderRadius: 6,
                  }}
                >
                  <Bell size={11} strokeWidth={1.8} />
                  Notify Me When Back
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleAddToCart}
                  whileTap={{ scale: 0.98 }}
                  className="border transition-all duration-500 w-full md:w-auto flex items-center justify-center"
                  style={{
                    padding: "18px 56px",
                    minWidth: 280,
                    maxWidth: 400,
                    fontSize: "clamp(0.7rem, 2.5vw, 0.8rem)",
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    fontFamily: "'Montserrat', sans-serif",
                    color: addedFeedback ? "#1e1814" : "#faf8f5",
                    borderColor: "#1e1814",
                    backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                    boxShadow: addedFeedback ? "none" : "0 10px 32px rgba(30,24,20,0.18)",
                    borderRadius: 6,
                  }}
                >
                  {addedFeedback ? "Added to Bag ✓" : "Add to Cart"}
                </motion.button>
              )}

            </div>
          </motion.div>
        )}
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
