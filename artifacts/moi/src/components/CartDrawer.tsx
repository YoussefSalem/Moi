import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";

export function CartDrawer() {
  const {
    shopifyCart,
    localItems,
    cartOpen,
    closeCart,
    removeItem,
    updateQuantity,
    checkoutUrl,
    formatShopifyLinePrice,
    cartTotal,
    loading,
    isShopify,
  } = useCart();
  const [checkoutPending, setCheckoutPending] = useState(false);

  const hasItems = isShopify
    ? (shopifyCart?.lines.nodes.length ?? 0) > 0
    : localItems.length > 0;

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
                  className="text-[11px] tracking-[0.28em] uppercase font-medium"
                  style={{ color: "#1e1814" }}
                >
                  Your Bag
                </span>
              </div>
              <button
                onClick={closeCart}
                className="transition-opacity hover:opacity-50"
                aria-label="Close cart"
              >
                <X size={19} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              </button>
            </div>

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
                  {isShopify && shopifyCart
                    ? shopifyCart.lines.nodes.map((line, i) => (
                        <motion.li
                          key={line.id}
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
                            {line.merchandise.product.featuredImage && (
                              <img
                                src={line.merchandise.product.featuredImage.url}
                                alt={line.merchandise.product.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p
                                  className="text-[12px] tracking-wide font-medium leading-tight"
                                  style={{ color: "#1e1814" }}
                                >
                                  {line.merchandise.product.title}
                                </p>
                                <p
                                  className="text-[10px] tracking-[0.15em] uppercase mt-1 font-light"
                                  style={{ color: "#7a6e64" }}
                                >
                                  {line.merchandise.title !== "Default Title" ? line.merchandise.title : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => removeItem(line.id)}
                                className="flex-shrink-0 transition-opacity hover:opacity-50 mt-0.5"
                                aria-label="Remove"
                              >
                                <X size={13} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-auto">
                              <div
                                className="flex items-center"
                                style={{ border: "1px solid rgba(30,24,20,0.12)" }}
                              >
                                <button
                                  onClick={() => updateQuantity(line.id, line.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Decrease"
                                >
                                  <Minus size={11} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                                <span
                                  className="w-7 h-7 flex items-center justify-center text-[11px] font-medium"
                                  style={{ color: "#1e1814" }}
                                >
                                  {line.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(line.id, line.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Increase"
                                >
                                  <Plus size={11} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                              </div>
                              <p
                                className="text-[12px] font-medium tracking-wide"
                                style={{ color: "#1e1814" }}
                              >
                                {formatShopifyLinePrice(line)}
                              </p>
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
                                  className="text-[12px] tracking-wide font-medium leading-tight"
                                  style={{ color: "#1e1814" }}
                                >
                                  {item.title}
                                </p>
                                {item.size && (
                                  <p
                                    className="text-[10px] tracking-[0.15em] uppercase mt-1 font-light"
                                    style={{ color: "#7a6e64" }}
                                  >
                                    Size: {item.size}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="flex-shrink-0 transition-opacity hover:opacity-50 mt-0.5"
                                aria-label="Remove"
                              >
                                <X size={13} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-auto">
                              <div
                                className="flex items-center"
                                style={{ border: "1px solid rgba(30,24,20,0.12)" }}
                              >
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Decrease"
                                >
                                  <Minus size={11} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                                <span
                                  className="w-7 h-7 flex items-center justify-center text-[11px] font-medium"
                                  style={{ color: "#1e1814" }}
                                >
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-50"
                                  aria-label="Increase"
                                >
                                  <Plus size={11} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                                </button>
                              </div>
                              <p
                                className="text-[12px] font-medium tracking-wide"
                                style={{ color: "#1e1814" }}
                              >
                                {item.price}
                              </p>
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
                    className="text-[10px] tracking-[0.3em] uppercase font-light"
                    style={{ color: "#7a6e64" }}
                  >
                    Total
                  </span>
                  <span
                    className="text-base font-medium tracking-wide"
                    style={{ color: "#1e1814" }}
                  >
                    {cartTotal}
                  </span>
                </div>
                <p
                  className="text-[9px] tracking-[0.2em] uppercase font-light text-center"
                  style={{ color: "rgba(30,24,20,0.35)" }}
                >
                  Shipping & taxes calculated at checkout
                </p>
                {SHOPIFY_CONFIGURED && checkoutUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutPending(true);
                      window.location.assign(checkoutUrl);
                    }}
                    className="block text-center py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#1e1814" }}
                  >
                    {loading || checkoutPending ? "…" : "Checkout"}
                  </button>
                ) : (
                  <button
                    className="py-4 text-[11px] tracking-[0.32em] uppercase font-medium text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#1e1814" }}
                    onClick={() => {
                      alert("Connect your Shopify store to enable checkout.");
                    }}
                  >
                    {loading ? "…" : "Checkout"}
                  </button>
                )}
              </motion.div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
