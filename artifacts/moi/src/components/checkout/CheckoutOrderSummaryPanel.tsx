import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Tag, Check } from "lucide-react";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";
import type { ShopifyCartLine } from "@/lib/shopify";
import type { LocalCartItem } from "@/context/CartContext";
import { resolveLineImage } from "@/lib/productImages";
// price-formatting helper used throughout CheckoutPage.

const SHIPPING_EGP_DISPLAY = 75;

const promoInputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(30,24,20,0.22)",
  outline: "none",
  padding: "14px 0",
  fontSize: "16px",
  color: "#1e1814",
  fontWeight: 500,
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.025em",
  WebkitAppearance: "none",
  borderRadius: 0,
};

interface CheckoutOrderSummaryPanelProps {
  lines: ShopifyCartLine[] | null;
  localLines: LocalCartItem[];
  localItems: LocalCartItem[];
  promoApplied: { code: string } | null;
  savings: number;
  subtotalAmount: number;
  discountedSubtotal: number;
  freeShipping: boolean;
  shippingCost: number;
  totalAmount: number;
  fmt: (amount: number) => string;
  formatShopifyLinePrice: (line: ShopifyCartLine) => string;
  promoInput: string;
  setPromoInput: (v: string) => void;
  setPromoError: (e: string) => void;
  handleApplyPromo: () => void;
  handleRemovePromo: () => void;
  promoLoading: boolean;
  promoError: string;
}

export function CheckoutOrderSummaryPanel({
  lines, localLines, localItems,
  promoApplied, savings, subtotalAmount, discountedSubtotal,
  freeShipping, shippingCost, totalAmount, fmt, formatShopifyLinePrice,
  promoInput, setPromoInput, setPromoError, handleApplyPromo, handleRemovePromo,
  promoLoading, promoError,
}: CheckoutOrderSummaryPanelProps) {
  return (
    <div>
      {/* Section heading */}
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag size={14} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.5)", flexShrink: 0 }} />
        <p style={{ fontSize: "11px", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
          Order Summary
        </p>
        <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(30,24,20,0.1)" }} />
      </div>

      {/* Product lines */}
      <div className="flex flex-col" style={{ gap: 0 }}>
        {lines
          ? lines.map((line, idx) => {
              const lineImg = resolveLineImage(line, localItems);
              const colorOpt = line.merchandise.selectedOptions?.find((o) => o.name.toLowerCase() === "color");
              const variantLabel = line.merchandise.title === "Default Title" ? null : line.merchandise.title;
              return (
                <div key={line.id} className="flex gap-5 py-5" style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", borderTop: idx === 0 ? "1px solid rgba(30,24,20,0.08)" : "none" }}>
                  <div className="flex-shrink-0 overflow-hidden" style={{ width: 96, height: 120, backgroundColor: "rgba(30,24,20,0.07)" }}>
                    {lineImg ? (
                      <img src={lineImg} alt={line.merchandise.product.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={22} strokeWidth={1} style={{ color: "rgba(30,24,20,0.22)" }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                    <div>
                      <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "19px", fontWeight: 600, color: "#1e1814", lineHeight: 1.25, letterSpacing: "0.01em" }}>
                        {line.merchandise.product.title}
                      </p>
                      {colorOpt && (
                        <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginTop: 6, fontWeight: 500 }}>
                          {colorOpt.value}
                        </p>
                      )}
                      {!colorOpt && variantLabel && (
                        <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginTop: 6, fontWeight: 500 }}>
                          {variantLabel}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <span style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(30,24,20,0.46)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                        Qty {line.quantity}
                      </span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1e1814" }}>
                        {formatShopifyLinePrice(line)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          : localLines.map((item, idx) => (
              <div key={item.id} className="flex gap-5 py-5" style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", borderTop: idx === 0 ? "1px solid rgba(30,24,20,0.08)" : "none" }}>
                <div className="flex-shrink-0 overflow-hidden" style={{ width: 96, height: 120, backgroundColor: "rgba(30,24,20,0.07)" }}>
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={22} strokeWidth={1} style={{ color: "rgba(30,24,20,0.22)" }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                  <div>
                    <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "19px", fontWeight: 600, color: "#1e1814", lineHeight: 1.25, letterSpacing: "0.01em" }}>
                      {item.title}
                    </p>
                    {item.color && (
                      <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginTop: 6, fontWeight: 500 }}>
                        {item.color}
                      </p>
                    )}
                  </div>
                  <div className="flex items-end justify-between mt-4">
                    <span style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(30,24,20,0.46)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                      Qty {item.quantity}
                    </span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1e1814" }}>
                      {fmt(item.priceAmount * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
        }
      </div>

      {/* Totals block */}
      <div className="mt-1">
        <AnimatePresence>
          {promoApplied && savings > 0 && (
            <motion.div
              key="savings-row"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="flex items-center justify-between px-4 py-3 mt-4"
              style={{ backgroundColor: "rgba(52,95,67,0.07)", border: "1px solid rgba(52,95,67,0.22)" }}
            >
              <div className="flex items-center gap-3">
                <Tag size={11} strokeWidth={2} style={{ color: "#2f6644", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#2f6644", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                    Promo applied
                  </p>
                  <p style={{ fontSize: "11px", color: "rgba(47,102,68,0.75)", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>
                    {promoApplied.code} — -{fmt(savings)}
                  </p>
                </div>
              </div>
              {subtotalAmount > 0 && (
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", color: "#2f6644", fontWeight: 700, letterSpacing: "0.04em" }}>
                  {Math.round((savings / subtotalAmount) * 100)}% off
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtotal row */}
        <div className="flex justify-between items-center py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
          <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Subtotal</span>
          <span style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>{fmt(discountedSubtotal)}</span>
        </div>

        {/* Free shipping nudge */}
        {!freeShipping && discountedSubtotal > 0 && (
          <div className="py-3" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
            <div className="flex justify-between items-center mb-2">
              <p style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: "#6b8f5e" }}>
                {new Intl.NumberFormat("en-EG").format(2000 - discountedSubtotal)} EGP to free delivery
              </p>
              <p style={{ fontSize: "10px", letterSpacing: "0.12em", fontFamily: "'Montserrat', sans-serif", color: "rgba(107,143,94,0.7)" }}>
                2,000 EGP
              </p>
            </div>
            <div style={{ height: 2, backgroundColor: "rgba(107,143,94,0.18)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (discountedSubtotal / 2000) * 100)}%`, backgroundColor: "#6b8f5e", borderRadius: 1, transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}

        {/* Free shipping unlocked */}
        {freeShipping && (
          <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
            <Check size={13} strokeWidth={2} style={{ color: "#6b8f5e", flexShrink: 0 }} />
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: "#6b8f5e" }}>
              Free delivery unlocked
            </p>
          </div>
        )}

        {/* Shipping row */}
        <div className="flex justify-between items-center py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
          <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Shipping</span>
          <span style={{ fontSize: "15px", color: "#6b8f5e", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
            {freeShipping
              ? <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 600, color: "#6b8f5e", letterSpacing: "0.06em", textTransform: "uppercase" }}>Free</span>
              : fmt(shippingCost || SHIPPING_EGP_DISPLAY)}
          </span>
        </div>

        {/* Total row */}
        <div className="flex justify-between items-center pt-5 pb-2">
          <div>
            <p style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, marginBottom: 3 }}>Total</p>
            <p style={{ fontSize: "11px", letterSpacing: "0.14em", color: "rgba(30,24,20,0.4)", fontFamily: "'Montserrat', sans-serif" }}>Incl. VAT & fees</p>
          </div>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "22px", fontWeight: 700, color: "#1e1814", letterSpacing: "0.02em", lineHeight: 1 }}>
            {fmt(totalAmount)}
          </span>
        </div>
      </div>

      {/* Promo / Gift Card */}
      {SHOPIFY_CONFIGURED && (
        <div className="mt-7 pt-6" style={{ borderTop: "1px solid rgba(30,24,20,0.1)" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, marginBottom: "14px" }}>
            Promo / Gift Card
          </p>
          {promoApplied ? (
            <div className="flex items-center justify-between py-3 px-4" style={{ backgroundColor: "rgba(90,122,90,0.07)", border: "1px solid rgba(90,122,90,0.2)" }}>
              <div className="flex items-center gap-3">
                <Check size={13} strokeWidth={2} style={{ color: "#5a7a5a" }} />
                <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", fontWeight: 600 }}>{promoApplied.code}</span>
              </div>
              <button onClick={handleRemovePromo} style={{ fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-3 items-end">
              <input
                type="text"
                placeholder="Enter code"
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); }}
                onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                style={{ ...promoInputStyle, flex: 1 }}
                className="checkout-input"
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoInput.trim()}
                className="transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ fontSize: "11px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, paddingBottom: "14px", background: "none", border: "none", borderBottom: "1px solid rgba(30,24,20,0.22)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {promoLoading ? "…" : "Apply"}
              </button>
            </div>
          )}
          {promoError && (
            <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: 8, letterSpacing: "0.04em" }}>{promoError}</p>
          )}
        </div>
      )}
    </div>
  );
}
