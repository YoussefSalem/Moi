import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";

type PaymentMethod = "cod" | "instapay";
type Step = "form" | "loading" | "cod-confirm" | "instapay-confirm";

interface OrderResult {
  orderNumber: string | number;
  total: string;
  instapayAccount?: string;
  instapayNumber?: string;
  businessWA?: string;
}

const SHIPPING_EGP = 120;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(30,24,20,0.18)",
  outline: "none",
  padding: "10px 0",
  fontSize: "13px",
  color: "#1e1814",
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.04em",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  letterSpacing: "0.28em",
  textTransform: "uppercase" as const,
  color: "rgba(30,24,20,0.8)",
  marginBottom: "2px",
  fontFamily: "'Montserrat', sans-serif",
};

export function CheckoutPage() {
  const {
    shopifyCart,
    localItems,
    checkoutOpen,
    closeCheckout,
    clearCart,
    isShopify,
    formatShopifyLinePrice,
    applyDiscount,
  } = useCart();

  const [step, setStep] = useState<Step>("form");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
  });

  const lines = isShopify && shopifyCart
    ? shopifyCart.lines.nodes
    : null;
  const localLines = !isShopify ? localItems : [];

  const localSubtotal = localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);

  // subtotalAmount: original line-items total before any discount codes
  const subtotalAmount = shopifyCart
    ? parseFloat(shopifyCart.cost.subtotalAmount.amount)
    : localSubtotal;

  // cartDiscountedTotal: after discount codes, before shipping (Shopify cart has no shipping)
  const cartDiscountedTotal = shopifyCart
    ? parseFloat(shopifyCart.cost.totalAmount.amount)
    : localSubtotal;

  // savings: the discount applied by promo codes
  const savings = Math.max(0, subtotalAmount - cartDiscountedTotal);

  // final total the customer pays
  const totalAmount = cartDiscountedTotal + SHIPPING_EGP;

  const currencyCode = shopifyCart?.cost.totalAmount.currencyCode ?? localItems[0]?.currencyCode ?? "EGP";

  function fmt(amount: number) {
    try {
      return new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${amount.toFixed(0)} EGP`;
    }
  }

  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const result = await applyDiscount(promoInput.trim().toUpperCase());
      if (result.applicable) {
        setPromoApplied({ code: result.code });
        setPromoError("");
      } else {
        setPromoError("This code is invalid or doesn't apply to your cart.");
        setPromoApplied(null);
        await applyDiscount("");
      }
    } catch {
      setPromoError("Could not verify the code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, applyDiscount]);

  const handleRemovePromo = useCallback(async () => {
    try { await applyDiscount(""); } catch {}
    setPromoApplied(null);
    setPromoInput("");
    setPromoError("");
  }, [applyDiscount]);

  const handleSubmit = useCallback(async () => {
    if (!isShopify || !shopifyCart) {
      setSubmitError("Our store is temporarily unavailable. Please try again later.");
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim()) {
      setSubmitError("Please fill in all fields.");
      return;
    }
    if (!/^\d{7,15}$/.test(form.phone.replace(/\D/g, ""))) {
      setSubmitError("Please enter a valid phone number.");
      return;
    }

    setSubmitError("");
    setStep("loading");

    const orderLines = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({
          variantId: l.merchandise.id,
          quantity: l.quantity,
        }))
      : localItems.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        }));

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: orderLines,
          customer: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
          },
          paymentMethod,
          // cartId lets the server fetch Shopify's validated cart totals server-side,
          // so discount eligibility is enforced by Shopify's own engine, not re-derived here.
          cartId: shopifyCart?.id ?? null,
          discountCode: promoApplied?.code ?? null,
        }),
      });

      const data = await res.json() as {
        success?: boolean;
        orderNumber?: number | string;
        total?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setStep("form");
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOrderResult({
        orderNumber: data.orderNumber ?? "",
        total: data.total ?? fmt(totalAmount),
        instapayAccount: (data as Record<string, unknown>).instapayAccount as string | undefined,
        instapayNumber: (data as Record<string, unknown>).instapayNumber as string | undefined,
        businessWA: (data as Record<string, unknown>).businessWA as string | undefined,
      });

      if (paymentMethod === "cod") {
        setStep("cod-confirm");
      } else {
        setStep("instapay-confirm");
      }
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
    }
  }, [form, paymentMethod, isShopify, shopifyCart, localItems, promoApplied, totalAmount, fmt]);

  const handleDone = useCallback(() => {
    clearCart();
    setStep("form");
    setOrderResult(null);
    setPromoApplied(null);
    setPromoInput("");
    setForm({ firstName: "", lastName: "", phone: "", address: "", city: "" });
    closeCheckout();
  }, [clearCart, closeCheckout]);


  return (
    <AnimatePresence>
      {checkoutOpen && (
        <motion.div
          key="checkout-overlay"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: "tween", duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[120] overflow-y-auto"
          style={{ backgroundColor: "#efe6da" }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-10 py-5"
            style={{ backgroundColor: "#efe6da", borderBottom: "1px solid rgba(30,24,20,0.14)" }}
          >
            <button
              onClick={step === "form" || step === "loading" ? closeCheckout : handleDone}
              className="flex items-center gap-2 transition-opacity hover:opacity-50"
              aria-label="Back"
            >
              <ArrowLeft size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              <span style={{ fontSize: "13px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif" }}>
                {step === "form" || step === "loading" ? "Back" : "Continue shopping"}
              </span>
            </button>
            <span style={{ fontSize: "13px", letterSpacing: "0.4em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
              MOI
            </span>
            <div style={{ width: 80 }} />
          </div>

          {step === "loading" ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                style={{ width: 28, height: 28, border: "1.5px solid rgba(30,24,20,0.32)", borderTopColor: "#1e1814", borderRadius: "50%" }}
              />
              <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>
                Placing your order…
              </p>
            </div>
          ) : step === "cod-confirm" ? (
            <CODConfirmation orderResult={orderResult!} onDone={handleDone} fmt={fmt} />
          ) : step === "instapay-confirm" ? (
            <InstapayConfirmation
              orderResult={orderResult!}
              onDone={handleDone}
              fmt={fmt}
              instapayName={orderResult?.instapayAccount ?? ""}
              instapayNumber={orderResult?.instapayNumber ?? ""}
              businessWA={orderResult?.businessWA ?? ""}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              {/* Left: Order Summary */}
              <div>
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Order Summary
                </p>

                {/* Items */}
                <div style={{ borderTop: "1px solid rgba(30,24,20,0.16)" }}>
                  {lines
                    ? lines.map((line) => (
                        <div key={line.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.1)" }}>
                            {line.merchandise.product.featuredImage && (
                              <img src={line.merchandise.product.featuredImage.url} alt={line.merchandise.product.title} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{line.merchandise.product.title}</p>
                              {line.merchandise.title !== "Default Title" && (
                                <p style={{ fontSize: "13px", color: "#7a6e64", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>{line.merchandise.title}</p>
                              )}
                            </div>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>Qty {line.quantity}</span>
                              <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{formatShopifyLinePrice(line)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    : localLines.map((item) => (
                        <div key={item.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.1)" }}>
                            {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{item.title}</p>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>Qty {item.quantity}</span>
                              <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{item.price}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>

                {/* Totals */}
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between">
                    <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>Subtotal</span>
                    <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{fmt(subtotalAmount)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between">
                      <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>
                        Discount{promoApplied ? ` (${promoApplied.code})` : ""}
                      </span>
                      <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif" }}>
                        −{fmt(savings)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>Shipping</span>
                    <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{fmt(SHIPPING_EGP)}</span>
                  </div>
                  <div className="flex justify-between pt-3" style={{ borderTop: "1px solid rgba(30,24,20,0.22)" }}>
                    <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}>Total</span>
                    <span style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>{fmt(totalAmount)}</span>
                  </div>
                </div>

                {/* Promo code */}
                {SHOPIFY_CONFIGURED && (
                  <div className="mt-6">
                    <button
                      onClick={() => setPromoOpen((o) => !o)}
                      className="flex items-center gap-2 transition-opacity hover:opacity-60"
                    >
                      <span style={{ fontSize: "13px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.88)", fontFamily: "'Montserrat', sans-serif" }}>
                        Promo / Gift Card
                      </span>
                      {promoOpen ? <ChevronUp size={12} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.72)" }} /> : <ChevronDown size={12} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.72)" }} />}
                    </button>

                    <AnimatePresence>
                      {promoOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div className="mt-3">
                            {promoApplied ? (
                              <div className="flex items-center justify-between py-2 px-3" style={{ backgroundColor: "rgba(90,122,90,0.08)", border: "1px solid rgba(90,122,90,0.2)" }}>
                                <div className="flex items-center gap-2">
                                  <Check size={12} strokeWidth={2} style={{ color: "#5a7a5a" }} />
                                  <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>{promoApplied.code}</span>
                                </div>
                                <button onClick={handleRemovePromo} style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Enter code"
                                  value={promoInput}
                                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                                  onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                                  style={{ ...inputStyle, flex: 1 }}
                                />
                                <button
                                  onClick={handleApplyPromo}
                                  disabled={promoLoading || !promoInput.trim()}
                                  className="transition-opacity hover:opacity-70 disabled:opacity-40"
                                  style={{ fontSize: "13px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, padding: "0 12px", borderBottom: "1px solid rgba(30,24,20,0.18)" }}
                                >
                                  {promoLoading ? "…" : "Apply"}
                                </button>
                              </div>
                            )}
                            {promoError && (
                              <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: 6, letterSpacing: "0.04em" }}>{promoError}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Right: Payment + Form */}
              <div>
                {/* Payment method */}
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "16px" }}>
                  Payment Method
                </p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {(["cod", "instapay"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className="text-left transition-all"
                      style={{
                        padding: "16px",
                        border: paymentMethod === m ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.15)",
                        backgroundColor: paymentMethod === m ? "rgba(30,24,20,0.03)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: "18px", marginBottom: "6px" }}>
                        {m === "cod" ? "🚚" : "📱"}
                      </div>
                      <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                        {m === "cod" ? "Cash on Delivery" : "Instapay"}
                      </p>
                      <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.8)", fontFamily: "'Montserrat', sans-serif", marginTop: "4px", lineHeight: 1.5 }}>
                        {m === "cod" ? "Pay when you receive" : "Bank transfer"}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Customer details form */}
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Delivery Details
                </p>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>First Name</label>
                      <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={inputStyle} autoComplete="given-name" />
                    </div>
                    <div>
                      <label style={labelStyle}>Last Name</label>
                      <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} autoComplete="family-name" />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} autoComplete="tel" placeholder="01X XXXX XXXX" />
                  </div>

                  <div>
                    <label style={labelStyle}>Address</label>
                    <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} autoComplete="street-address" />
                  </div>

                  <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={inputStyle} autoComplete="address-level2" />
                  </div>
                </div>

                {submitError && (
                  <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: "12px", letterSpacing: "0.04em" }}>{submitError}</p>
                )}

                {paymentMethod === "instapay" && (
                  <div className="mt-5 p-4" style={{ backgroundColor: "rgba(30,24,20,0.07)", border: "1px solid rgba(30,24,20,0.2)" }}>
                    <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.92)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, letterSpacing: "0.04em" }}>
                      After placing your order you will receive your order number and payment instructions via WhatsApp.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  className="w-full mt-8 py-4 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
                >
                  Place Order
                </button>

                <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.58)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", marginTop: "14px", letterSpacing: "0.18em" }}>
                  By placing your order you agree to our terms of service.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CODConfirmation({ orderResult, onDone, fmt }: { orderResult: OrderResult; onDone: () => void; fmt: (n: number) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-8 py-16 text-center flex flex-col items-center gap-6"
    >
      <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={22} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </div>

      <div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "36px", fontWeight: 700, color: "#1e1814", marginBottom: "8px" }}>
          Order Placed.
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.8)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
          Thank you for shopping with Moi.
        </p>
      </div>

      <div style={{ padding: "20px 28px", border: "1px solid rgba(30,24,20,0.22)", width: "100%" }}>
        <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "6px" }}>
          Order Number
        </p>
        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", color: "#1e1814", fontWeight: 700 }}>
          #{orderResult.orderNumber}
        </p>
      </div>

      <div style={{ padding: "16px 20px", backgroundColor: "rgba(30,24,20,0.07)", width: "100%" }}>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.92)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.8, letterSpacing: "0.04em" }}>
          <strong style={{ color: "#1e1814" }}>Cash on Delivery</strong><br />
          Our team will contact you shortly to arrange delivery. Total due on arrival: <strong style={{ color: "#1e1814" }}>{orderResult.total} EGP</strong>
        </p>
      </div>

      <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7 }}>
        A WhatsApp confirmation has been sent to your number.
      </p>

      <button
        onClick={onDone}
        className="mt-2 transition-opacity hover:opacity-60"
        style={{ fontSize: "13px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", padding: "12px 32px", border: "1px solid rgba(30,24,20,0.18)" }}
      >
        Continue Shopping
      </button>
    </motion.div>
  );
}

function InstapayConfirmation({
  orderResult,
  onDone,
  fmt,
  instapayName,
  instapayNumber,
  businessWA,
}: {
  orderResult: OrderResult;
  onDone: () => void;
  fmt: (n: number) => string;
  instapayName: string;
  instapayNumber: string;
  businessWA: string;
}) {
  const waLink = businessWA
    ? `https://wa.me/${businessWA.replace(/\D/g, "")}?text=${encodeURIComponent(`Order #${orderResult.orderNumber} - Payment Screenshot`)}`
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-8 py-14 flex flex-col items-center gap-6"
    >
      <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={22} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </div>

      <div className="text-center">
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "36px", fontWeight: 700, color: "#1e1814", marginBottom: "8px" }}>
          Order Placed.
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.8)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
          Complete your payment to confirm.
        </p>
      </div>

      <div style={{ padding: "16px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
        <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "6px" }}>
          Order Number
        </p>
        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "32px", color: "#1e1814", fontWeight: 700 }}>
          #{orderResult.orderNumber}
        </p>
      </div>

      {/* Payment steps */}
      <div style={{ width: "100%", border: "1px solid rgba(30,24,20,0.22)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(30,24,20,0.14)" }}>
          <p style={{ fontSize: "13px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "10px" }}>
            How to Pay via Instapay
          </p>

          <div className="space-y-3">
            {[
              { n: "1", text: `Open your banking app and send ${orderResult.total} EGP via Instapay to:` },
              { n: "2", text: `Send your order number (#${orderResult.orderNumber}) + payment screenshot via WhatsApp.` },
              { n: "3", text: "Your order will be confirmed once payment is received." },
            ].map((s) => (
              <div key={s.n} className="flex gap-3 items-start">
                <span style={{ width: 20, height: 20, backgroundColor: "#1e1814", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "13px", color: "#fff", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                  {s.n}
                </span>
                <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.94)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, letterSpacing: "0.03em" }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {(instapayName || instapayNumber) && (
          <div style={{ padding: "14px 20px", backgroundColor: "rgba(30,24,20,0.07)" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(30,24,20,0.94)", fontFamily: "'Montserrat', sans-serif", marginBottom: "6px" }}>
              Instapay Account
            </p>
            {instapayName && <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{instapayName}</p>}
            {instapayNumber && <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.05em" }}>{instapayNumber}</p>}
          </div>
        )}
      </div>

      {businessWA && (
        <div style={{ textAlign: "center", marginBottom: "-8px" }}>
          <p style={{ fontSize: "13px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(30,24,20,0.94)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>
            Business WhatsApp
          </p>
          <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>
            {businessWA}
          </p>
        </div>
      )}

      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full justify-center py-4 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#25D366", color: "#fff", fontSize: "13px", letterSpacing: "0.28em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textDecoration: "none" }}
        >
          <MessageCircle size={15} strokeWidth={1.5} />
          Send Payment Screenshot
        </a>
      )}

      <button
        onClick={onDone}
        className="transition-opacity hover:opacity-60"
        style={{ fontSize: "13px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", padding: "10px 24px" }}
      >
        I've sent the payment
      </button>
    </motion.div>
  );
}
