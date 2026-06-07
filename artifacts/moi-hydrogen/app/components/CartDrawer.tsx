import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { useFetcher } from "@remix-run/react";
import type { CartReturn } from "@shopify/hydrogen";

interface CartDrawerProps {
  cart: CartReturn | null;
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ cart, open, onClose }: CartDrawerProps) {
  const fetcher = useFetcher();

  const lines = cart?.lines?.nodes ?? [];
  const totalQuantity = cart?.totalQuantity ?? 0;
  const total = cart?.cost?.totalAmount;
  const checkoutUrl = cart?.checkoutUrl;

  const updateQuantity = (lineId: string, quantity: number) => {
    fetcher.submit(
      { lineId, quantity: String(quantity), action: "update" },
      { method: "post", action: "/api/cart" },
    );
  };

  const removeLine = (lineId: string) => {
    fetcher.submit(
      { lineId, action: "remove" },
      { method: "post", action: "/api/cart" },
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[75] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[76] w-full max-w-sm flex flex-col"
            style={{ backgroundColor: "#faf8f5" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 border-b border-stone-100"
              style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))", paddingBottom: "1rem" }}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: "#1e1814" }}>
                  Your Bag
                </span>
                {totalQuantity > 0 && (
                  <span
                    className="ml-1 text-[10px] w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#1e1814", color: "#faf8f5" }}
                  >
                    {totalQuantity}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-50 -mr-2"
                aria-label="Close cart"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Lines */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <ShoppingBag size={32} strokeWidth={1} style={{ color: "rgba(30,24,20,0.2)" }} />
                  <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "rgba(30,24,20,0.4)" }}>
                    Your bag is empty
                  </p>
                </div>
              ) : (
                lines.map((line) => {
                  const merch = line.merchandise;
                  const image = merch.image?.url;
                  const productTitle = merch.product.title;
                  const variantTitle = merch.title !== "Default Title" ? merch.title : null;
                  const price = line.cost.totalAmount;

                  return (
                    <div key={line.id} className="flex gap-4">
                      {image && (
                        <div className="relative w-20 h-24 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "#ede8e3" }}>
                          <img
                            src={image}
                            alt={productTitle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] tracking-[0.1em] uppercase font-medium truncate" style={{ color: "#1e1814" }}>
                          {productTitle}
                        </p>
                        {variantTitle && (
                          <p className="text-[10px] mt-0.5" style={{ color: "rgba(30,24,20,0.55)" }}>{variantTitle}</p>
                        )}
                        <p className="text-[11px] mt-1.5 font-medium" style={{ color: "#1e1814" }}>
                          {Math.round(parseFloat(price.amount)).toLocaleString("en-EG")} {price.currencyCode}
                        </p>

                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => updateQuantity(line.id, Math.max(0, line.quantity - 1))}
                            className="w-7 h-7 flex items-center justify-center border transition-colors hover:bg-stone-100"
                            style={{ borderColor: "rgba(30,24,20,0.15)" }}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} strokeWidth={1.5} />
                          </button>
                          <span className="text-[12px] w-5 text-center" style={{ color: "#1e1814" }}>{line.quantity}</span>
                          <button
                            onClick={() => updateQuantity(line.id, line.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center border transition-colors hover:bg-stone-100"
                            style={{ borderColor: "rgba(30,24,20,0.15)" }}
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} strokeWidth={1.5} />
                          </button>

                          <button
                            onClick={() => removeLine(line.id)}
                            className="ml-auto w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-50"
                            aria-label="Remove item"
                          >
                            <Trash2 size={13} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.45)" }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {lines.length > 0 && (
              <div
                className="px-6 pt-4 pb-6 border-t border-stone-100 space-y-3"
                style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
              >
                {total && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "rgba(30,24,20,0.5)" }}>Total</span>
                    <span className="text-sm font-medium" style={{ color: "#1e1814" }}>
                      {Math.round(parseFloat(total.amount)).toLocaleString("en-EG")} {total.currencyCode}
                    </span>
                  </div>
                )}
                <p className="text-[9px] tracking-[0.15em]" style={{ color: "rgba(30,24,20,0.35)" }}>
                  Shipping and taxes calculated at checkout
                </p>
                {checkoutUrl ? (
                  <a
                    href={checkoutUrl}
                    className="block w-full py-3.5 text-center text-[11px] tracking-[0.28em] uppercase text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#1e1814" }}
                  >
                    Checkout
                  </a>
                ) : (
                  <button
                    disabled
                    className="block w-full py-3.5 text-center text-[11px] tracking-[0.28em] uppercase text-white opacity-50"
                    style={{ backgroundColor: "#1e1814" }}
                  >
                    Checkout
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
