import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import type { ProductConfig, VariantOption } from "~/config/images";
import { NotifyMeModal } from "~/components/NotifyMeModal";
import { ImageSkeleton } from "~/components/ImageSkeleton";

function getApiOrigin(): string {
  if (typeof window === "undefined") return "https://admin.buy-moi.com";
  return (window as unknown as { ENV?: { PUBLIC_API_ORIGIN?: string } }).ENV?.PUBLIC_API_ORIGIN ?? "https://admin.buy-moi.com";
}

interface VariantCardProps {
  product: ProductConfig;
  color: string;
  gallery: readonly string[];
  onAddToCart: (variantId: string, quantity: number, title: string, color: string, size: string) => Promise<void>;
  onLookView?: (product: ProductConfig) => void;
  index?: number;
}

export function VariantCard({ product, color, gallery, onAddToCart, onLookView, index = 0 }: VariantCardProps) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hoverImgLoaded, setHoverImgLoaded] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartTimeRef = useRef<number | null>(null);

  const colorVariants: readonly VariantOption[] = useMemo(() => {
    if (!product.variants) return [];
    return product.variants.filter((v) =>
      v.selectedOptions.some((o) => o.name.toLowerCase() === "color" && o.value === color)
    );
  }, [product.variants, color]);

  const sizes = useMemo(() => {
    if (colorVariants.length === 0) return [];
    const sizeOpt = colorVariants[0]?.selectedOptions.find((o) =>
      o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre"
    );
    if (!sizeOpt) return [];
    const names = colorVariants
      .map((v) => {
        const s = v.selectedOptions.find((o) => o.name.toLowerCase() === sizeOpt.name.toLowerCase());
        return s?.value ?? null;
      })
      .filter(Boolean) as string[];
    return names.filter((s) => !["one size", "os", "default title", "one-size"].includes(s.toLowerCase()));
  }, [colorVariants]);

  const [selectedSize, setSelectedSize] = useState<string>(() => sizes[0] ?? "");

  const selectedVariant = useMemo(() => {
    if (colorVariants.length === 0) return undefined;
    if (sizes.length === 0) return colorVariants[0];
    return (
      colorVariants.find((v) => v.selectedOptions.some((o) => o.value === selectedSize)) ??
      colorVariants[0]
    );
  }, [colorVariants, sizes, selectedSize]);

  const isOutOfStock = selectedVariant ? !selectedVariant.availableForSale : true;
  const isColorAvailable = colorVariants.some((v) => v.availableForSale);

  const mainImage = gallery[galleryIndex % gallery.length];
  const hoverImage = gallery.length > 1 ? gallery[1] : null;

  const price = selectedVariant?.price ?? product.price;
  const compareAtPrice = selectedVariant?.compareAtPrice;

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    const variantId = selectedVariant?.id ?? product.slug;
    await onAddToCart(variantId, 1, product.name, color, selectedSize || "One Size");
    toast.success(`${product.name} added to bag`, {
      description:
        color && sizes.length > 0 ? `${color} · ${selectedSize}` : color || undefined,
      duration: 2500,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const subscribeToRestock = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const variantId = selectedVariant?.id ?? `${product.slug}-fallback`;
    const variantTitle = selectedVariant
      ? selectedVariant.selectedOptions.map((o) => o.value).join(" / ")
      : `${color} / ${selectedSize || "One Size"}`;
    try {
      const res = await fetch(`${getApiOrigin()}/api/restock/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          productHandle: product.slug,
          variantId,
          variantTitle,
          productTitle: product.name,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) return { success: false, error: json.error ?? "Something went wrong." };
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  return (
    <>
      <motion.div
        className="flex flex-col overflow-hidden bg-white"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.06, 0.3) }}
      >
        {/* Image area */}
        <div
          className="relative overflow-hidden select-none"
          style={{ aspectRatio: "3/4", cursor: "pointer" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragStartXRef.current = e.clientX;
            dragStartTimeRef.current = Date.now();
          }}
          onPointerUp={(e) => {
            const start = dragStartXRef.current;
            const t = dragStartTimeRef.current;
            dragStartXRef.current = null;
            dragStartTimeRef.current = null;
            if (start === null) return;
            const delta = e.clientX - start;
            const elapsed = Date.now() - (t ?? Date.now());
            if (Math.abs(delta) > 36 || Math.abs(delta / Math.max(elapsed, 1)) > 0.35) {
              setGalleryIndex((i) => (i + (delta < 0 ? 1 : -1) + gallery.length) % gallery.length);
            } else if (elapsed < 300 && Math.abs(delta) < 8) {
              onLookView?.(product);
            }
          }}
          onClick={() => {}}
        >
          {/* Main image */}
          <img
            src={mainImage || undefined}
            alt={`${product.name} — ${color}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: isHovered && hoverImage && hoverImgLoaded ? 0 : 1 }}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />

          {/* Hover image */}
          {hoverImage && (
            <img
              src={hoverImage}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
              style={{ opacity: isHovered && hoverImgLoaded ? 1 : 0 }}
              loading="lazy"
              decoding="async"
              onLoad={() => setHoverImgLoaded(true)}
            />
          )}

          {!imgLoaded && <ImageSkeleton variant="warm" />}

          {/* Sold out ribbon */}
          {!isColorAvailable && (
            <div
              className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center py-2"
              style={{ background: "rgba(30,24,20,0.52)", backdropFilter: "blur(2px)" }}
            >
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "0.58rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(250,248,245,0.92)",
                  fontWeight: 500,
                }}
              >
                Sold Out
              </span>
            </div>
          )}

          {/* Gallery dots (mobile) */}
          {gallery.length > 1 && (
            <div className="md:hidden absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1 pointer-events-none">
              {gallery.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === galleryIndex ? 14 : 5,
                    height: 5,
                    backgroundColor:
                      i === galleryIndex ? "rgba(250,248,245,0.9)" : "rgba(250,248,245,0.4)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex flex-col gap-2 p-3 pt-3" style={{ background: "#faf8f5" }}>
          <div>
            <p
              className="text-[9px] tracking-[0.35em] uppercase"
              style={{ color: "rgba(30,24,20,0.42)", fontFamily: "'Montserrat', sans-serif" }}
            >
              {color}
            </p>
            <h3
              className="font-serif mt-0.5 leading-tight"
              style={{
                color: "#1e1814",
                fontSize: "clamp(0.88rem, 2vw, 1.05rem)",
                letterSpacing: "0.04em",
                fontWeight: 300,
              }}
            >
              {product.name}
            </h3>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium" style={{ color: "#1e1814" }}>
              {price}
            </span>
            {compareAtPrice && (
              <span className="text-xs line-through" style={{ color: "rgba(30,24,20,0.38)" }}>
                {compareAtPrice}
              </span>
            )}
          </div>

          {/* Size selector */}
          {sizes.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {sizes.map((size) => {
                const isSelected = size === selectedSize;
                const isAvailable = colorVariants.some(
                  (v) => v.selectedOptions.some((o) => o.value === size) && v.availableForSale
                );
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => isAvailable && setSelectedSize(size)}
                    className="px-2.5 py-1 text-[9px] tracking-[0.12em] uppercase transition-all duration-150"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      border: isSelected ? "1.5px solid #1e1814" : "1.5px solid rgba(30,24,20,0.18)",
                      backgroundColor: isSelected ? "#1e1814" : "transparent",
                      color: isSelected ? "#fff" : "rgba(30,24,20,0.65)",
                      opacity: isAvailable ? 1 : 0.3,
                      cursor: isAvailable ? "pointer" : "default",
                    }}
                    disabled={!isAvailable}
                    aria-pressed={isSelected}
                    aria-label={`Size ${size}`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          )}

          {/* CTA */}
          {isOutOfStock ? (
            <button
              type="button"
              onClick={() => setNotifyModalOpen(true)}
              className="flex items-center justify-center gap-2 w-full py-3 text-[9px] tracking-[0.28em] uppercase border transition-all duration-200 hover:bg-stone-100"
              style={{
                borderColor: "rgba(30,24,20,0.2)",
                color: "#1e1814",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <Bell size={12} strokeWidth={1.5} />
              Notify Me
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full py-3 text-[9px] tracking-[0.28em] uppercase text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{
                backgroundColor: "#1e1814",
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: "0 8px 20px rgba(30,24,20,0.14)",
              }}
            >
              <AnimatePresence mode="wait">
                {addedFeedback ? (
                  <motion.span
                    key="added"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="block"
                  >
                    Added ✓
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="block"
                  >
                    Order Now
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </motion.div>

      <NotifyMeModal
        open={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
        productName={product.name}
        variantTitle={
          selectedVariant
            ? selectedVariant.selectedOptions.map((o) => o.value).join(" / ")
            : `${color} / ${selectedSize || "One Size"}`
        }
        onSubmit={subscribeToRestock}
      />
    </>
  );
}
