import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import type { ProductConfig, VariantOption } from "@/config/images";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  product: ProductConfig;
  onLookView: (product: ProductConfig) => void;
}

export function ProductCard({ product, onLookView }: ProductCardProps) {
  const color = useImageColor(product.productShot);
  const gradBg = color?.rgba(0.12) ?? "rgba(180,160,140,0.08)";
  const { addToCart } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);

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
    if (isSizeAvailable(selectedSize)) return;
    const firstAvail = sizeOption.values.find((s) => isSizeAvailable(s));
    if (firstAvail) setSelectedSize(firstAvail);
  }, [selectedColor, product.variants]);

  const effectivePrice = selectedVariant?.price ?? product.price;

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

  const displaySizes = sizeOption?.values ?? ["Small", "Medium"];

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    await addToCart({
      variantId: selectedVariant?.id ?? product.variantId,
      title: product.name,
      price: effectivePrice,
      priceAmount: parseFloat(String(effectivePrice).replace(/[^0-9.]/g, "")),
      currencyCode: "EGP",
      image: product.productShot,
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

  const handleNotifyMe = () => {
    toast.success("We'll notify you when it's back.", {
      description: `${product.name} · ${selectedColor} · ${selectedSize}`,
      duration: 2500,
      position: "top-center",
      style: {
        backgroundColor: "#302824",
        color: "#ffffff",
        border: "1px solid rgba(255,255,255,0.08)",
      },
    });
  };

  return (
    <section
      className="w-full py-16 md:py-24 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 80% 70% at 50% 50%, ${gradBg} 0%, hsl(30 15% 95%) 70%)`,
        transition: "background 1.5s ease",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(320px,460px)_minmax(260px,1fr)] gap-10 md:gap-16 items-center"
      >
        {/* Left: name + description */}
        <div className="flex flex-col gap-5 md:items-start md:justify-center md:text-left text-center">
          <h2
            className="text-xl md:text-2xl font-bold tracking-widest uppercase"
            style={{ color: "#1e1814", letterSpacing: "0.12em" }}
          >
            {product.name}
          </h2>
          <p
            className="text-sm leading-relaxed font-light mt-2 max-w-md"
            style={{ color: "#5a5048" }}
          >
            {product.description}
          </p>
        </div>

        {/* Center: product image */}
        <div className="flex justify-center relative">
          <div className="relative">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 90% 80% at 50% 60%, ${color?.rgba(0.18) ?? "rgba(180,160,140,0.12)"} 0%, transparent 70%)`,
                filter: "blur(24px)",
                transform: "scale(1.2)",
                transition: "background 1.5s ease",
              }}
            />
            <motion.button
              onClick={() => onLookView(product)}
              className="block relative group focus:outline-none"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.4 }}
              aria-label="See the look"
            >
              <img
                src={product.productShot}
                alt={product.name}
                className="relative z-10 w-full max-w-xs md:max-w-sm"
                style={{ maxHeight: 440, objectFit: "contain", objectPosition: "center" }}
                crossOrigin="anonymous"
              />
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 z-20 flex items-center justify-center"
              >
                <span
                  className="text-[10px] tracking-[0.3em] uppercase font-medium px-4 py-2"
                  style={{
                    backgroundColor: "rgba(250,248,245,0.88)",
                    color: "#1e1814",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  See the Look
                </span>
              </motion.div>
            </motion.button>
          </div>
        </div>

        {/* Right: color + size + price + add to cart */}
        <div className="flex flex-col gap-5 items-center md:items-center md:justify-center text-center">
          {/* Color */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] tracking-[0.22em] uppercase font-medium" style={{ color: "#7a6e64" }}>
              Color — <span style={{ color: "#1e1814" }}>{selectedColor}</span>
            </p>
            <div className="flex items-center gap-3 justify-center">
              {displayColors.map((option, index) => (
                <button
                  key={option.name}
                  type="button"
                  aria-label={option.name}
                  aria-pressed={selectedColor === option.name}
                  onClick={() => setSelectedColor(option.name)}
                  className="relative group"
                  style={{ width: 34, height: 34 }}
                >
                  <span
                    className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: option.swatch,
                      boxShadow:
                        index === displayColors.length - 1 && option.swatch.startsWith("#1")
                          ? "inset 0 0 0 1px rgba(255,255,255,0.16)"
                          : "inset 0 0 0 1px rgba(30,24,20,0.08)",
                    }}
                  />
                  <span
                    className="absolute inset-[-5px] rounded-full border transition-opacity duration-300"
                    style={{
                      borderColor: "rgba(30,24,20,0.35)",
                      opacity: selectedColor === option.name ? 1 : 0,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] tracking-[0.22em] uppercase font-medium" style={{ color: "#7a6e64" }}>
              Size
            </p>
            <div className="flex items-center gap-3 justify-center flex-wrap">
              {displaySizes.map((size) => {
                const available = isSizeAvailable(size);
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => { if (available) setSelectedSize(size); }}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!available}
                    title={!available ? "Out of stock" : undefined}
                    className="min-w-24 px-5 py-3 text-[11px] tracking-[0.22em] uppercase font-medium border transition-all duration-300 relative"
                    style={{
                      color: !available ? "rgba(30,24,20,0.25)" : isSelected ? "#1e1814" : "#7a6e64",
                      borderColor: isSelected ? "#1e1814" : "rgba(30,24,20,0.14)",
                      backgroundColor: isSelected ? "rgba(30,24,20,0.04)" : "rgba(250,248,245,0.78)",
                      boxShadow: isSelected ? "inset 0 0 0 1px rgba(30,24,20,0.08)" : "none",
                      cursor: available ? "pointer" : "not-allowed",
                      textDecoration: !available ? "line-through" : "none",
                    }}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price */}
          <p className="text-base font-light tracking-widest" style={{ color: "#1e1814" }}>
            {effectivePrice}
          </p>

          {/* Add to Cart */}
          {isOutOfStock ? (
            <motion.button
              type="button"
              onClick={handleNotifyMe}
              whileHover={{ x: [0, -2, 2, -1, 1, 0] }}
              whileTap={{ x: [0, -1, 1, 0], scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="min-w-[220px] px-7 py-4 text-[10px] tracking-[0.35em] uppercase font-light border transition-all duration-300 self-center flex items-center justify-center gap-2"
              style={{
                color: "#f5f0e8",
                borderColor: "rgba(245,240,232,0.22)",
                backgroundColor: "rgba(30,24,20,0.92)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
                letterSpacing: "0.28em",
              }}
            >
              <Bell size={12} strokeWidth={1.8} />
              Notify me when available
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleAddToCart}
              whileTap={{ scale: 0.97 }}
              className="min-w-[204px] px-7 py-4 text-[10px] tracking-[0.35em] uppercase font-light border transition-all duration-300 self-center"
              style={{
                color: addedFeedback ? "#1e1814" : "#fff",
                borderColor: "#1e1814",
                backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "#1e1814",
                cursor: "pointer",
                letterSpacing: "0.28em",
              }}
            >
              {addedFeedback ? "Added ✓" : "Add to Cart"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </section>
  );
}
