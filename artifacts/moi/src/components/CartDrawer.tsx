import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { trackTikTokInitiateCheckout } from "@/lib/tiktokPixel";
import { trackCheckoutStep, trackCartAbandonment } from "@/lib/analytics";
import { formatMoney } from "@/lib/shopify";
import type { ShopifyCartLine } from "@/lib/shopify";
import type { LocalCartItem } from "@/context/CartContext";
import { ENABLE_APPLE_PAY } from "@/config/features";
import { ShopifyApplePayButton } from "@/components/ShopifyApplePayButton";
import { resolveLineImage } from "@/lib/productImages";

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

// Quantity stepper extracted into its own component so useCallback handlers
// hold stable references and React never passes stale closures to touch events.
// touch-action: manipulation removes the 300ms Mobile Safari tap delay on the buttons.
interface QuantityControlProps {
  itemId: string;
  quantity: number;
  updateQuantity: (id: string, qty: number) => Promise<void>;
}

function QuantityControl({ itemId, quantity, updateQuantity }: QuantityControlProps) {
  const handleDecrease = useCallback(() => {
    updateQuantity(itemId, quantity - 1);
  }, [itemId, quantity, updateQuantity]);

  const handleIncrease = useCallback(() => {
    updateQuantity(itemId, quantity + 1);
  }, [itemId, quantity, updateQuantity]);

  return (
    <div
      className="flex items-center"
      style={{ border: "1px solid rgba(30,24,20,0.12)" }}
    >
      <button
        onClick={handleDecrease}
        className="w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-50"
        style={{ touchAction: "manipulation" }}
        aria-label="Decrease"
      >
        <Minus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </button>
      <span
        className="w-9 h-11 flex items-center justify-center text-[12px] font-semibold"
        style={{ color: "#17120f" }}
      >
        {quantity}
      </span>
      <button
        onClick={handleIncrease}
        className="w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-50"
        style={{ touchAction: "manipulation" }}
        aria-label="Increase"
      >
        <Plus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </button>
    </div>
  );
}

interface CartDrawerProps {
  onNavigateToSection?: (sectionId: string) => void;
}

export function CartDrawer({ onNavigateToSection }: CartDrawerProps = {}) {
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
    prefilledEmail,
    clearCart,
    checkoutUrl,
  } = useCart();

  function handleProductClick(title: string) {
    const sectionId = title.toLowerCase().replace(/\s+/g, "-");
    closeCart();
    if (onNavigateToSection) {
      onNavigateToSection(sectionId);
    }
  }

  const { customer, openAuth } = useCustomer();

  const hasItems = (isShopify && (shopifyCart?.lines.nodes.length ?? 0) > 0) || localItems.length > 0;

  // Keep the list mounted for 250ms after the last item is removed so the
  // exit animation can finish before the empty state takes over.
  const [visuallyHasItems, setVisuallyHasItems] = useState(hasItems);
  useEffect(() => {
    if (hasItems) {
      setVisuallyHasItems(true);
      return;
    }
    const t = setTimeout(() => setVisuallyHasItems(false), 260);
    return () => clearTimeout(t);
  }, [hasItems]);

  // Lock body scroll when cart is open.
  // Compensates for scrollbar width so there's no layout jump when the scrollbar disappears.
  useEffect(() => {
    if (!cartOpen) return;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [cartOpen]);

  // Swipe-right-to-close touch tracking
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStartY.current);
    // Trigger close only on a clear rightward swipe (>70px horizontal, not a vertical scroll)
    if (dx > 70 && dy < dx * 0.6) {
      closeCart();
    }
  }, [closeCart]);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] bg-black/40"
            onClick={closeCart}
          />
          <motion.aside
            key="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[420px] flex flex-col"
            style={{ backgroundColor: "#faf8f5", willChange: "transform" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
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
            <div className="flex-1 overflow-y-auto px-7 py-6" style={{ overscrollBehavior: "contain" }}>
              {!visuallyHasItems ? (
                <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
                  <ShoppingBag size={36} strokeWidth={1} style={{ color: "rgba(30,24,20,0.2)" }} />
                  <p
                    className="text-[11px] tracking-[0.25em] uppercase font-light"
                    style={{ color: "rgba(30,24,20,0.4)" }}
                  >
                    Your bag is empty
                  </p>
                  {!customer && (
                    <p
                      className="text-[12px] tracking-[0.08em]"
                      style={{ color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      Have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          closeCart();
                          openAuth();
                        }}
                        className="underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "#1e1814", fontWeight: 500 }}
                      >
                        Log in
                      </button>{" "}
                      to check out faster.
                    </p>
                  )}
                  <button
                    onClick={closeCart}
                    className="mt-2 text-[10px] tracking-[0.28em] uppercase font-medium px-8 py-3 transition-opacity hover:opacity-60"
                    style={{ color: "#1e1814", border: "1px solid rgba(30,24,20,0.18)" }}
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <ul className="space-y-6">
                  <AnimatePresence mode="popLayout" initial={false}>
                  {(() => {
                    // Build a unified list keyed by variantId so the same item
                    // keeps the same React key whether it is local-only (pending)
                    // or confirmed by Shopify. This prevents any exit/enter
                    // animation when the sync completes — the card just updates
                    // in place with zero layout shift.
                    const items = [] as {
                      key: string;
                      line?: ShopifyCartLine;
                      local?: LocalCartItem;
                    }[];
                    const seen = new Set<string>();
                    if (isShopify && shopifyCart) {
                      for (const line of shopifyCart.lines.nodes) {
                        const vid = line.merchandise.id;
                        items.push({ key: vid, line });
                        seen.add(vid);
                      }
                    }
                    for (const local of localItems) {
                      if (!seen.has(local.variantId)) {
                        items.push({ key: local.variantId, local });
                        seen.add(local.variantId);
                      }
                    }
                    return items.map(({ key, line, local }) => (
                      <motion.li
                        key={key}
                        initial={false}
                        exit={{ opacity: 0, x: 32, transition: { duration: 0.2, ease: "easeIn" } }}
                        className="flex gap-4"
                        style={{ borderBottom: "1px solid rgba(30,24,20,0.06)", paddingBottom: "1.5rem" }}
                      >
                        {line ? (() => {
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
                        })() : (
                          <div
                            className="w-20 h-24 flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: "rgba(30,24,20,0.04)" }}
                          >
                            {local?.image && (
                              <img
                                src={local.image}
                                alt={local.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        )}
                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => handleProductClick(line?.merchandise.product.title ?? local?.title ?? "")}
                                className="text-left transition-opacity hover:opacity-60"
                                style={{ touchAction: "manipulation" }}
                              >
                                <p
                                  className="text-[12px] tracking-wide font-semibold leading-tight underline underline-offset-2"
                                  style={{ color: "#17120f" }}
                                >
                                  {line?.merchandise.product.title ?? local?.title}
                                </p>
                              </button>
                              <p
                                className="text-[10px] tracking-[0.15em] uppercase mt-1 font-light"
                                style={{ color: "rgba(23,18,15,0.72)" }}
                              >
                                {line
                                  ? (line.merchandise.title !== "Default Title" ? line.merchandise.title : "")
                                  : local?.size
                                    ? `Size: ${local.size}`
                                    : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(line?.id ?? local?.id ?? "")}
                              className="flex-shrink-0 w-11 h-11 flex items-center justify-center mt-0.5 active:scale-75 transition-transform"
                              style={{ touchAction: "manipulation" }}
                              aria-label="Remove"
                            >
                              <X size={14} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <QuantityControl
                              itemId={line?.id ?? local?.id ?? ""}
                              quantity={line?.quantity ?? local?.quantity ?? 1}
                              updateQuantity={updateQuantity}
                            />
                            <div className="flex flex-col items-end" style={{ gap: 2 }}>
                              {line?.merchandise.compareAtPrice ? (
                                <span
                                  className="text-[11px] font-medium"
                                  style={{ color: "#8a7e74", textDecoration: "line-through", textDecorationThickness: 1, textDecorationColor: "#c83232" }}
                                >
                                  {formatMoney(
                                    String(parseFloat(line.merchandise.compareAtPrice.amount) * line.quantity),
                                    line.merchandise.compareAtPrice.currencyCode,
                                  )}
                                </span>
                              ) : local?.compareAtPrice ? (
                                <span
                                  className="text-[11px] font-medium"
                                  style={{ color: "#8a7e74", textDecoration: "line-through", textDecorationThickness: 1, textDecorationColor: "#c83232" }}
                                >
                                  {local.compareAtPrice}
                                </span>
                              ) : null}
                              <p
                                className="text-[12px] font-semibold tracking-wide"
                                style={{ color: (line?.merchandise.compareAtPrice ?? local?.compareAtPrice) ? "#c83232" : "#17120f" }}
                              >
                                {line ? formatShopifyLinePrice(line) : local?.price ?? ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ));
                  })()}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {hasItems && (
              <div
                className="px-7 pt-6 flex flex-col gap-5"
                style={{
                  borderTop: "1px solid rgba(30,24,20,0.08)",
                  paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
                }}
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
                {/* Conversion Banner — FIRST50 (disabled — uncomment to re-enable) */}
                {/* <DiscountBanner /> */}
                <button
                  type="button"
                  onClick={() => {
                    const ids = isShopify && shopifyCart
                      ? shopifyCart.lines.nodes.map((l) => l.merchandise.id)
                      : localItems.map((i) => i.variantId);
                    const totalVal = isShopify && shopifyCart
                      ? shopifyCart.cost?.totalAmount?.amount
                        ? parseFloat(shopifyCart.cost.totalAmount.amount)
                        : shopifyCart.lines.nodes.reduce((s, l) => {
                            const p = parseFloat(l.merchandise.price.amount ?? "0");
                            return s + (Number.isFinite(p) ? p * l.quantity : 0);
                          }, 0)
                      : localItems.reduce((s, i) => s + (i.priceAmount ?? 0) * i.quantity, 0);
                    const numItems = isShopify && shopifyCart ? shopifyCart.lines.nodes.length : localItems.length;
                    trackInitiateCheckout({
                      content_ids: ids,
                      currency: "EGP",
                      value: Number.isFinite(totalVal) && totalVal > 0 ? totalVal : undefined,
                      num_items: numItems,
                      user: {
                        email: customer?.email || prefilledEmail || undefined,
                        phone: customer?.phone || undefined,
                        first_name: customer?.firstName || undefined,
                        last_name: customer?.lastName || undefined,
                      },
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
                {ENABLE_APPLE_PAY && typeof window !== "undefined" && "ApplePaySession" in window && (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() && shopifyCart && shopifyCart.lines.nodes.length > 0 && (
                  <>
                    <div className="flex items-center gap-3">
                      <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "rgba(30,24,20,0.4)", textTransform: "uppercase" }}>or</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.10)" }} />
                    </div>
                  <ShopifyApplePayButton
                    lines={shopifyCart.lines.nodes.map((l) => ({
                      variantId: l.merchandise.id,
                      quantity: l.quantity,
                    }))}
                    totalEGP={
                      shopifyCart.cost?.totalAmount?.amount
                        ? parseFloat(shopifyCart.cost.totalAmount.amount)
                        : shopifyCart.lines.nodes.reduce((s, l) => {
                            const p = parseFloat(l.merchandise.price.amount ?? "0");
                            return s + p * l.quantity;
                          }, 0)
                    }
                    disabled={loading}
                    onSuccess={(orderNumber, total) => {
                      toast.success(
                        `Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`,
                        { duration: 5000 },
                      );
                    }}
                    onError={(msg) => {
                      toast.error(msg, { duration: 4000 });
                    }}
                    onMoreOptions={() => openCheckout()}
                  />
                  </>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
