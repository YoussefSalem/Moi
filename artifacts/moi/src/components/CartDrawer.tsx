import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { transitions } from "@/lib/motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";
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
      className="mb-3 rounded flex items-center gap-3 px-3 py-2.5"
      style={{
        backgroundColor: "rgba(250,248,245,0.95)",
        border: "1px solid rgba(30,24,20,0.08)",
      }}
    >
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
      style={{ border: "1px solid rgba(30,24,20,0.14)", borderRadius: 2 }}
    >
      <button
        onClick={handleDecrease}
        className="w-11 h-11 flex items-center justify-center transition-opacity active:opacity-40"
        style={{ touchAction: "manipulation" }}
        aria-label="Decrease"
      >
        <Minus size={13} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </button>
      <span
        className="w-10 h-11 flex items-center justify-center text-[13px] font-semibold"
        style={{ color: "#17120f", borderLeft: "1px solid rgba(30,24,20,0.10)", borderRight: "1px solid rgba(30,24,20,0.10)" }}
      >
        {quantity}
      </span>
      <button
        onClick={handleIncrease}
        className="w-11 h-11 flex items-center justify-center transition-opacity active:opacity-40"
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

function fmtDelivery(d: Date) {
  return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "long" })}`;
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
    itemCount,
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

  const [visuallyHasItems, setVisuallyHasItems] = useState(hasItems);
  useEffect(() => {
    if (hasItems) {
      setVisuallyHasItems(true);
      return;
    }
    const t = setTimeout(() => setVisuallyHasItems(false), 260);
    return () => clearTimeout(t);
  }, [hasItems]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && cartOpen) closeCart(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, closeCart]);

  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, cartOpen);

  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStartY.current);
    if (dx > 70 && dy < dx * 0.6) closeCart();
  }, [closeCart]);

  // Precompute delivery range
  const deliveryStart = new Date(); deliveryStart.setDate(deliveryStart.getDate() + 2);
  const deliveryEnd = new Date();   deliveryEnd.setDate(deliveryEnd.getDate() + 4);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.overlay}
            className="fixed inset-0 z-[90] bg-black/40"
            onClick={closeCart}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            ref={drawerRef}
            key="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={transitions.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[440px] flex flex-col"
            style={{ backgroundColor: "#faf8f5", willChange: "transform" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >

            {/* ── Header ─────────────────────────────── */}
            <div
              className="flex items-center justify-between gap-3 px-6 py-5 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}
            >
              {/* Left: bag icon + title + delivery */}
              <div className="flex items-center gap-0 min-w-0 flex-1">
                <ShoppingBag size={16} strokeWidth={1.5} style={{ color: "#1e1814", flexShrink: 0 }} />
                <span
                  className="ml-2.5 shrink-0 text-[10px] tracking-[0.3em] uppercase font-semibold"
                  style={{ color: "#17120f", fontFamily: "'Montserrat', sans-serif" }}
                >
                  Your Bag
                </span>
                {hasItems && (
                  <>
                    <span
                      style={{
                        color: "rgba(30,24,20,0.22)",
                        fontSize: 15,
                        margin: "0 10px",
                        fontWeight: 300,
                        flexShrink: 0,
                      }}
                    >
                      |
                    </span>
                    <span
                      className="truncate text-[10px] tracking-[0.04em]"
                      style={{ color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      Order now &amp; get it {fmtDelivery(deliveryStart)} – {fmtDelivery(deliveryEnd)}
                    </span>
                  </>
                )}
              </div>

              {/* Close */}
              <button
                onClick={() => {
                  const hi = (isShopify && shopifyCart ? shopifyCart.lines.nodes.length > 0 : localItems.length > 0);
                  if (hi) trackCartAbandonment("cart_drawer_closed");
                  closeCart();
                }}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center -mr-2 transition-opacity hover:opacity-50 active:opacity-40"
                aria-label="Close cart"
                style={{ touchAction: "manipulation" }}
              >
                <X size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              </button>
            </div>

            {/* ── Scrollable items ────────────────────── */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ overscrollBehavior: "contain", padding: "0 24px" }}
            >
              {!visuallyHasItems ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-16">
                  <ShoppingBag size={40} strokeWidth={1} style={{ color: "rgba(30,24,20,0.18)" }} />
                  <p
                    className="text-[11px] tracking-[0.28em] uppercase font-light"
                    style={{ color: "rgba(30,24,20,0.38)" }}
                  >
                    Your bag is empty
                  </p>
                  {!customer && (
                    <p
                      className="text-[12px] leading-relaxed tracking-[0.06em]"
                      style={{ color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      Have an account?{" "}
                      <button
                        type="button"
                        onClick={() => { closeCart(); openAuth(); }}
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
                    className="mt-1 text-[10px] tracking-[0.3em] uppercase font-medium px-9 py-3.5 transition-opacity hover:opacity-60 active:opacity-40"
                    style={{ color: "#1e1814", border: "1px solid rgba(30,24,20,0.18)", touchAction: "manipulation" }}
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                /* Items list */
                <ul style={{ paddingTop: 8 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {(() => {
                      const items = [] as {
                        key: string;
                        line?: ShopifyCartLine;
                        local?: LocalCartItem;
                      }[];
                      const seen = new Set<string>();
                      for (const local of localItems) {
                        const line = shopifyCart?.lines.nodes.find(
                          (l) => l.merchandise.id === local.variantId,
                        );
                        const reactKey = local.id;
                        if (line) {
                          items.push({ key: reactKey, line });
                        } else {
                          items.push({ key: reactKey, local });
                        }
                        seen.add(local.variantId);
                      }
                      for (const line of (shopifyCart?.lines.nodes ?? [])) {
                        const vid = line.merchandise.id;
                        if (!seen.has(vid)) {
                          items.push({ key: vid, line });
                          seen.add(vid);
                        }
                      }

                      return items.map(({ key, line, local }) => {
                        const img = line ? resolveLineImage(line, localItems) : local?.image;
                        const title = line?.merchandise.product.title ?? local?.title ?? "";
                        const variant = line
                          ? (line.merchandise.title !== "Default Title" ? line.merchandise.title : "")
                          : local?.size ? local.size : "";
                        const qty = line?.quantity ?? local?.quantity ?? 1;
                        const itemId = line?.id ?? local?.id ?? "";
                        const compareAt = line?.merchandise.compareAtPrice ?? null;
                        const compareAtLocal = local?.compareAtPrice ?? null;
                        const hasDiscount = !!(compareAt ?? compareAtLocal);

                        return (
                          <motion.li
                            key={key}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{
                              opacity: 0,
                              height: 0,
                              paddingBottom: 0,
                              marginBottom: 0,
                              borderBottomWidth: 0,
                              transition: transitions.listExit,
                            }}
                            transition={transitions.listLayout}
                            style={{
                              display: "flex",
                              gap: 16,
                              overflow: "hidden",
                              borderBottom: "1px solid rgba(30,24,20,0.07)",
                              paddingTop: 20,
                              paddingBottom: 20,
                            }}
                          >
                            {/* Product image — taller, more prominent */}
                            <div
                              style={{
                                width: 88,
                                height: 112,
                                flexShrink: 0,
                                overflow: "hidden",
                                backgroundColor: "rgba(30,24,20,0.04)",
                                borderRadius: 2,
                              }}
                            >
                              {img && (
                                <img
                                  src={img}
                                  alt={title}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                />
                              )}
                            </div>

                            {/* Info column */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, gap: 6 }}>

                              {/* Top row: title + remove */}
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleProductClick(title)}
                                    className="text-left transition-opacity hover:opacity-60"
                                    style={{ touchAction: "manipulation" }}
                                  >
                                    <p
                                      style={{
                                        fontFamily: "'Montserrat', sans-serif",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        letterSpacing: "0.06em",
                                        color: "#17120f",
                                        lineHeight: 1.4,
                                        textDecoration: "underline",
                                        textUnderlineOffset: 3,
                                        textDecorationThickness: 1,
                                      }}
                                    >
                                      {title}
                                    </p>
                                  </button>
                                  {variant && (
                                    <p
                                      style={{
                                        fontFamily: "'Montserrat', sans-serif",
                                        fontSize: 10,
                                        letterSpacing: "0.16em",
                                        textTransform: "uppercase",
                                        color: "rgba(30,24,20,0.5)",
                                        marginTop: 4,
                                        fontWeight: 400,
                                      }}
                                    >
                                      {variant}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItem(itemId)}
                                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center -mt-1 -mr-1 active:scale-75 transition-transform"
                                  style={{ touchAction: "manipulation" }}
                                  aria-label="Remove item"
                                >
                                  <X size={13} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.35)" }} />
                                </button>
                              </div>

                              {/* Bottom row: qty stepper + price */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                                <QuantityControl
                                  itemId={itemId}
                                  quantity={qty}
                                  updateQuantity={updateQuantity}
                                />
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                  {compareAt ? (
                                    <span
                                      style={{
                                        fontFamily: "'Montserrat', sans-serif",
                                        fontSize: 11,
                                        color: "#8a7e74",
                                        textDecoration: "line-through",
                                        textDecorationThickness: 1,
                                        textDecorationColor: "#c83232",
                                      }}
                                    >
                                      {formatMoney(
                                        String(parseFloat(compareAt.amount) * qty),
                                        compareAt.currencyCode,
                                      )}
                                    </span>
                                  ) : compareAtLocal ? (
                                    <span
                                      style={{
                                        fontFamily: "'Montserrat', sans-serif",
                                        fontSize: 11,
                                        color: "#8a7e74",
                                        textDecoration: "line-through",
                                        textDecorationThickness: 1,
                                        textDecorationColor: "#c83232",
                                      }}
                                    >
                                      {compareAtLocal}
                                    </span>
                                  ) : null}
                                  <p
                                    style={{
                                      fontFamily: "'Montserrat', sans-serif",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      letterSpacing: "0.04em",
                                      color: hasDiscount ? "#c83232" : "#17120f",
                                    }}
                                  >
                                    {line ? formatShopifyLinePrice(line) : local?.price ?? ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.li>
                        );
                      });
                    })()}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* ── Footer ─────────────────────────────── */}
            {hasItems && (
              <div
                className="flex-shrink-0 flex flex-col"
                style={{
                  borderTop: "1px solid rgba(30,24,20,0.08)",
                  padding: "20px 24px",
                  paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
                  gap: 14,
                  backgroundColor: "#faf8f5",
                }}
              >
                {/* Total row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.3em",
                      textTransform: "uppercase",
                      color: "rgba(30,24,20,0.55)",
                      fontWeight: 500,
                    }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 22,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      color: "#17120f",
                    }}
                  >
                    {cartRawTotal}
                  </span>
                </div>

                {/* Free shipping nudge */}
                <div
                  style={{
                    textAlign: "center",
                    padding: "11px 16px",
                    backgroundColor: "rgba(248,252,245,0.9)",
                    border: "1px solid rgba(160,190,150,0.22)",
                    borderRadius: 2,
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      color: "#6b8f5e",
                    }}
                  >
                    Free shipping on orders over 2,000 EGP
                  </p>
                </div>

                {/* Discount banner — uncomment to re-enable */}
                {/* <DiscountBanner /> */}

                {/* Apple Pay (Express) */}
                {ENABLE_APPLE_PAY &&
                  typeof window !== "undefined" &&
                  "ApplePaySession" in window &&
                  (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() &&
                  (shopifyCart ? shopifyCart.lines.nodes.length > 0 : localItems.length > 0) && (
                    <>
                      <p
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: 9,
                          letterSpacing: "0.28em",
                          textTransform: "uppercase",
                          color: "rgba(30,24,20,0.35)",
                          textAlign: "center",
                          fontWeight: 400,
                        }}
                      >
                        Express Checkout
                      </p>
                      <ShopifyApplePayButton
                        lines={
                          shopifyCart
                            ? shopifyCart.lines.nodes.map((l) => ({
                                variantId: l.merchandise.id,
                                quantity: l.quantity,
                              }))
                            : localItems.map((i) => ({
                                variantId: i.variantId,
                                quantity: Number(i.quantity),
                              }))
                        }
                        totalEGP={
                          shopifyCart?.cost?.totalAmount?.amount
                            ? parseFloat(shopifyCart.cost.totalAmount.amount)
                            : shopifyCart
                              ? shopifyCart.lines.nodes.reduce((s, l) => {
                                  const p = parseFloat(l.merchandise.price.amount ?? "0");
                                  return s + p * l.quantity;
                                }, 0)
                              : parseFloat(cartRawTotal)
                        }
                        disabled={loading}
                        onSuccess={(orderNumber, total) => {
                          toast.success(
                            `Order ${orderNumber ?? "confirmed"} placed!${total ? ` Total: ${total}` : ""}`,
                            { duration: 5000 },
                          );
                        }}
                        onError={(msg) => toast.error(msg, { duration: 4000 })}
                        onMoreOptions={() => openCheckout()}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.09)" }} />
                        <span
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontSize: 9,
                            letterSpacing: "0.22em",
                            color: "rgba(30,24,20,0.38)",
                            textTransform: "uppercase",
                          }}
                        >
                          or
                        </span>
                        <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.09)" }} />
                      </div>
                    </>
                  )}

                {/* Checkout CTA */}
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
                    const numItems = isShopify && shopifyCart
                      ? shopifyCart.lines.nodes.length
                      : localItems.length;
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
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "17px 16px",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                    color: "#faf8f5",
                    backgroundColor: "#1e1814",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.5 : 1,
                    transition: "opacity 0.18s",
                    touchAction: "manipulation",
                  }}
                >
                  {loading ? "…" : "Checkout"}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
