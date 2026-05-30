import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { IMAGES } from "@/config/images";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { trackTikTokInitiateCheckout } from "@/lib/tiktokPixel";
import { trackCheckoutStep, trackCartAbandonment } from "@/lib/analytics";
import { formatMoney } from "@/lib/shopify";
import type { ShopifyCartLine } from "@/lib/shopify";
import type { LocalCartItem } from "@/context/CartContext";

// Product-scoped color map: "productname::color" → image URL
// This prevents color collisions across products (e.g. "Beige" exists in both the Cape and Bangles variants).
const PRODUCT_COLOR_MAP: Record<string, string> = {};
const PRODUCT_SHOT_MAP: Record<string, string> = {};

for (const cfg of Object.values(IMAGES)) {
  if (!("name" in cfg) || !cfg.name) continue;
  const rawNames = [cfg.name, ...("shopifyTitle" in cfg && cfg.shopifyTitle ? [cfg.shopifyTitle as string] : [])];
  const names = rawNames.flatMap((n) => [n.toLowerCase(), n.toLowerCase().replace(/\./g, "").trim()]);
  if ("productShot" in cfg && cfg.productShot) {
    for (const n of names) PRODUCT_SHOT_MAP[n] = cfg.productShot;
  }
  if ("colorImages" in cfg && cfg.colorImages) {
    for (const [color, url] of Object.entries(cfg.colorImages as Record<string, string>)) {
      for (const n of names) {
        PRODUCT_COLOR_MAP[`${n}::${color.toLowerCase()}`] = url;
      }
    }
  }
}

// FIRST50 discount banner — placed at checkout button area for high conversion visibility
function DiscountBanner() {
  const [copied, setCopied] = useState(false);
  const CODE = "FIRST50";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
      toast.success("Copied to clipboard", { duration: 2000 });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy.");
    }
  };

  return (
    <div
      className="mx-4 mb-3 rounded flex items-center gap-3 px-3 py-2.5"
      style={{
        backgroundColor: "rgba(250,248,245,0.95)",
        border: "1px solid rgba(30,24,20,0.08)",
      }}
    >
      {/* Compact text */}
      <p
        className="flex-1 min-w-0"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 16,
          fontWeight: 600,
          color: "#1e1814",
          lineHeight: 1.35,
        }}
      >
        <span role="img" aria-label="celebration" style={{ fontSize: 15, marginRight: 4 }}>
          &#127881;
        </span>
        10% off — use <span style={{ fontWeight: 700 }}>{CODE}</span>
      </p>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 py-2 px-2.5 text-[9px] tracking-[0.22em] uppercase font-medium transition-opacity hover:opacity-70 text-center rounded flex items-center gap-1"
        style={{
          backgroundColor: "transparent",
          border: "1px solid rgba(30,24,20,0.15)",
          color: "#1e1814",
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/\./g, "").trim();
}

function resolveLineImage(line: ShopifyCartLine, localItems: LocalCartItem[]): string | null {
  const variantId = line.merchandise.id;
  const localMatch = localItems.find((li) => li.variantId === variantId);

  const rawTitle = line.merchandise.product.title ?? "";
  const normTitle = normalizeTitle(rawTitle);

  // Size-like option names to skip when scanning for the color option
  const SIZE_OPTION_NAMES = new Set(["size", "titre", "taille", "tamanho", "größe"]);

  // Build a candidate color list from multiple sources, most-reliable first:
  // a) color stored explicitly when item was added locally
  // b) selectedOptions from the Shopify cart line
  const colorCandidates: string[] = [];
  if (localMatch?.color) colorCandidates.push(localMatch.color.toLowerCase());
  for (const opt of (line.merchandise.selectedOptions ?? [])) {
    if (!SIZE_OPTION_NAMES.has(opt.name.toLowerCase())) {
      colorCandidates.push(opt.value.toLowerCase());
    }
  }

  // 1. Product + color map lookup (hashed bundle URL, always fresh — no stale localStorage URLs)
  for (const color of colorCandidates) {
    const hit = PRODUCT_COLOR_MAP[`${normTitle}::${color}`]
      ?? PRODUCT_COLOR_MAP[`${rawTitle.toLowerCase()}::${color}`];
    if (hit) return hit;
  }

  // 2. Product-level shot
  const productHit = PRODUCT_SHOT_MAP[normTitle] ?? PRODUCT_SHOT_MAP[rawTitle.toLowerCase()];
  if (productHit) return productHit;

  // 3. Shopify CDN image (set on the variant in Shopify admin)
  if (line.merchandise.image?.url) return line.merchandise.image.url;
  if (line.merchandise.product.featuredImage?.url) return line.merchandise.product.featuredImage.url;

  // 4. Last resort: the stored localStorage URL (may be stale after a rebuild)
  if (localMatch?.image) return localMatch.image;

  return null;
}

export function CartDrawer() {
  const {
    shopifyCart,
    localItems,
    cartOpen,
    closeCart,
    openCheckout,
    removeItem,
    updateQuantity,
    formatShopifyLinePrice,
    cartRawTotal,
    loading,
    isShopify,
    applyDiscount,
  } = useCart();

  const hasItems = (isShopify && (shopifyCart?.lines.nodes.length ?? 0) > 0) || localItems.length > 0;

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            onClick={closeCart}
          />
          <motion.aside
            key="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.42, ease: [0.76, 0, 0.24, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[420px] flex flex-col"
            style={{ backgroundColor: "#faf8f5" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-6"
              style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag size={17} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                <span
                  className="text-[11px] tracking-[0.28em] uppercase font-semibold"
                  style={{ color: "#17120f" }}
                >
                  Your Bag
                </span>
              </div>
              <button
                onClick={() => {
                  const hasItems = (isShopify && shopifyCart ? shopifyCart.lines.nodes.length > 0 : localItems.length > 0);
                  if (hasItems) trackCartAbandonment("cart_drawer_closed");
                  closeCart();
                }}
                className="transition-opacity hover:opacity-50"
                aria-label="Close cart"
              >
                <X size={19} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              </button>
            </div>

            {/* Delivery estimate — placed under header for visibility */}
            {hasItems && (
              <div className="px-7 pt-5 pb-1">
                <div
                  className="text-[14px] tracking-[0.12em] font-medium"
                  style={{ color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {(() => {
                    const now = new Date();
                    const start = new Date(now);
                    start.setDate(now.getDate() + 2);
                    const end = new Date(now);
                    end.setDate(now.getDate() + 4);
                    const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "long" })}`;
                    return (
                      <>
                        <p>Order now</p>
                        <p>and get it between {fmt(start)} – {fmt(end)}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-7 py-6">
              {!hasItems ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex flex-col items-center justify-center h-full gap-5 text-center"
                >
                  <ShoppingBag size={36} strokeWidth={1} style={{ color: "rgba(30,24,20,0.2)" }} />
                  <p
                    className="text-[11px] tracking-[0.25em] uppercase font-light"
                    style={{ color: "rgba(30,24,20,0.4)" }}
                  >
                    Your bag is empty
                  </p>
                  <button
                    onClick={closeCart}
                    className="mt-2 text-[10px] tracking-[0.28em] uppercase font-medium px-8 py-3 transition-opacity hover:opacity-60"
                    style={{ color: "#1e1814", border: "1px solid rgba(30,24,20,0.18)" }}
                  >
                    Continue Shopping
                  </button>
                </motion.div>
              ) : (
                <ul className="space-y-6">
                  {isShopify && shopifyCart && shopifyCart.lines.nodes.length > 0
                    ? shopifyCart.lines.nodes.map((line, i) => (
                        <motion.li
                          key={line.id}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex gap-4"
                          style={{ borderBottom: "1px solid rgba(30,24,20,0.06)", paddingBottom: "1.5rem" }}
                        >
                          {(() => {
                            const lineImg = resolveLineImage(line, localItems);
                            return (
                              <div
                                className="w-20 h-24 flex-shrink-0 overflow-hidden"
                                style={{ backgroundColor: "rgba(30,24,20,0.04)" }}
                              >
                                {lineImg && (
                                  <img
                                    src={lineImg}
                                    alt={line.merchandise.product.title}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p
                                  className="text-[12px] tracking-wide font-semibold leading-tight"
                                  style={{ color: "#17120f" }}
                                >
                                  {line.merchandise.product.title}
                                </p>
                                <p
                                  className="text-[10px] tracking-[0.15em] uppercase mt-1 font-light"
                                  style={{ color: "rgba(23,18,15,0.72)" }}
                                >
                                  {line.merchandise.title !== "Default Title" ? line.merchandise.title : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => removeItem(line.id)}
                                className="flex-shrink-0 w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50 mt-0.5"
                                aria-label="Remove"
                              >
                                <X size={14} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-auto">
                              <div
                                className="flex items-center"
                                style={{ border: "1px solid rgba(30,24,20,0.12)" }}
                              >
                                <button
                                  onClick={() => updateQuantity(line.id, line.quantity - 1)}
                                  className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Decrease"
                                >
                                  <Minus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                                <span
                                  className="w-9 h-9 flex items-center justify-center text-[12px] font-semibold"
                                  style={{ color: "#17120f" }}
                                >
                                  {line.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(line.id, line.quantity + 1)}
                                  className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Increase"
                                >
                                  <Plus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                              </div>
                              <div className="flex flex-col items-end" style={{ gap: 2 }}>
                                {line.merchandise.compareAtPrice && (
                                  <span
                                    className="text-[11px] font-medium"
                                    style={{ color: "#8a7e74", textDecoration: "line-through", textDecorationThickness: 1, textDecorationColor: "#c83232" }}
                                  >
                                    {formatMoney(
                                      String(parseFloat(line.merchandise.compareAtPrice.amount) * line.quantity),
                                      line.merchandise.compareAtPrice.currencyCode,
                                    )}
                                  </span>
                                )}
                                <p
                                  className="text-[12px] font-semibold tracking-wide"
                                  style={{ color: line.merchandise.compareAtPrice ? "#c83232" : "#17120f" }}
                                >
                                  {formatShopifyLinePrice(line)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ))
                    : localItems.map((item, i) => (
                        <motion.li
                          key={item.id}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex gap-4"
                          style={{ borderBottom: "1px solid rgba(30,24,20,0.06)", paddingBottom: "1.5rem" }}
                        >
                          <div
                            className="w-20 h-24 flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: "rgba(30,24,20,0.04)" }}
                          >
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p
                                  className="text-[12px] tracking-wide font-semibold leading-tight"
                                  style={{ color: "#17120f" }}
                                >
                                  {item.title}
                                </p>
                                {item.size && (
                                  <p
                                    className="text-[10px] tracking-[0.15em] uppercase mt-1 font-light"
                                    style={{ color: "rgba(23,18,15,0.72)" }}
                                  >
                                    Size: {item.size}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="flex-shrink-0 w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50 mt-0.5"
                                aria-label="Remove"
                              >
                                <X size={14} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-auto">
                              <div
                                className="flex items-center"
                                style={{ border: "1px solid rgba(30,24,20,0.12)" }}
                              >
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Decrease"
                                >
                                  <Minus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                                <span
                                  className="w-9 h-9 flex items-center justify-center text-[12px] font-semibold"
                                  style={{ color: "#17120f" }}
                                >
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Increase"
                                >
                                  <Plus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                {item.compareAtPrice && (
                                  <span
                                    className="text-[11px] font-medium"
                                    style={{ color: "#8a7e74", textDecoration: "line-through", textDecorationThickness: 1, textDecorationColor: "#c83232" }}
                                  >
                                    {item.compareAtPrice}
                                  </span>
                                )}
                                <p
                                  className="text-[12px] font-semibold tracking-wide"
                                  style={{ color: item.compareAtPrice ? "#c83232" : "#17120f" }}
                                >
                                  {item.price}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ))
                  }
                </ul>
              )}
            </div>

            {/* Footer */}
            {hasItems && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="px-7 py-6 flex flex-col gap-5"
                style={{ borderTop: "1px solid rgba(30,24,20,0.08)" }}
              >
                <div className="flex justify-between items-baseline">
                  <span
                    className="text-[10px] tracking-[0.3em] uppercase font-medium"
                    style={{ color: "#17120f" }}
                  >
                    Total
                  </span>
                  <span
                    className="text-base font-semibold tracking-wide"
                    style={{ color: "#17120f" }}
                  >
                    {cartRawTotal}
                  </span>
                </div>
                {/* Shipping info */}
                <div
                  className="text-center py-3.5 px-4 mx-4 mb-2 rounded"
                  style={{ backgroundColor: "rgba(248,252,245,0.9)", border: "1px solid rgba(160,190,150,0.22)" }}
                >
                  <p
                    className="text-[16px] tracking-[0.25em] uppercase font-semibold text-center leading-tight"
                    style={{ color: "#6b8f5e" }}
                  >
                    Free shipping on orders over 2,000 EGP
                  </p>
                </div>
                {/* Conversion Banner — FIRST50 */}
                <DiscountBanner />
                <button
                  type="button"
                  onClick={() => {
                    const ids = isShopify && shopifyCart
                      ? shopifyCart.lines.nodes.map((l) => l.merchandise.id)
                      : localItems.map((i) => i.variantId);
                    const totalVal = isShopify && shopifyCart
                      ? shopifyCart.cost?.totalAmount?.amount
                        ? parseFloat(shopifyCart.cost.totalAmount.amount)
                        : 0
                      : localItems.reduce((s, i) => s + (i.priceAmount ?? 0) * i.quantity, 0);
                    const numItems = isShopify && shopifyCart ? shopifyCart.lines.nodes.length : localItems.length;
                    trackInitiateCheckout({
                      content_ids: ids,
                      currency: "EGP",
                      value: Number.isFinite(totalVal) && totalVal > 0 ? totalVal : undefined,
                      num_items: numItems,
                    });
                    trackTikTokInitiateCheckout({
                      content_id: ids?.[0],
                      currency: "EGP",
                      value: totalVal > 0 ? totalVal : undefined,
                      quantity: numItems,
                    });
                    trackCheckoutStep("start", { numItems, totalVal });
                    openCheckout();
                  }}
                  disabled={loading}
                  className="block w-full text-center py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "#1e1814" }}
                >
                  {loading ? "…" : "Checkout"}
                </button>
              </motion.div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
