import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Upload, X, CreditCard } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";

type PaymentMethod = "cod" | "instapay" | "card";
type Step = "form" | "loading" | "cod-confirm" | "instapay-confirm" | "card-checkout" | "card-confirm" | "card-failed";
type InstapaySubStep = "instructions" | "upload" | "review";

interface InstapayOrderData {
  lines: { variantId: string; quantity: number }[];
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    address: string;
    governorate: string;
    postalCode?: string;
    city: string;
  };
  cartId?: string;
  discountCode?: string;
}

interface OrderResult {
  orderNumber: string | number;
  total: string;
  shopifyOrderId?: number;
  instapayAccount?: string;
  instapayNumber?: string;
  customerName?: string;
  customerPhone?: string;
  instapayOrderData?: InstapayOrderData;
}

const SHIPPING_EGP = 120;
const GOVERNORATES = [
  "Cairo","Giza","Alexandria","Dakahlia","Red Sea","Beheira","Fayoum","Gharbia",
  "Ismailia","Menofia","Minya","Qaliubiya","New Valley","Suez","Aswan","Assiut",
  "Beni Suef","Port Said","Damietta","Sharkia","South Sinai","Kafr El Sheikh",
  "Matrouh","Luxor","Qena","North Sinai","Sohag","Ain Sokhna",
] as const;


const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(30,24,20,0.22)",
  outline: "none",
  padding: "10px 0",
  fontSize: "14px",
  color: "#1e1814",
  fontWeight: 500,
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.025em",
};


const optionListStyle: React.CSSProperties = {
  maxHeight: "240px",
  overflowY: "auto",
  border: "1px solid rgba(30,24,20,0.16)",
  backgroundColor: "#efe6da",
  boxShadow: "0 18px 40px rgba(30,24,20,0.12)",
};

const optionStyle: React.CSSProperties = {
  width: "100%",
  display: "block",
  padding: "12px 14px",
  textAlign: "left",
  fontFamily: "'Montserrat', sans-serif",
  fontSize: "13px",
  letterSpacing: "0.02em",
  color: "#1e1814",
};

const governorateInputStyle: React.CSSProperties = {
  ...inputStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  letterSpacing: "0.24em",
  textTransform: "uppercase" as const,
  color: "rgba(30,24,20,0.92)",
  marginBottom: "2px",
  fontFamily: "'Montserrat', sans-serif",
};

async function compressImage(file: File, maxPx = 1400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function CheckoutPage() {
  const {
    shopifyCart,
    localItems,
    checkoutOpen,
    closeCheckout,
    openCheckout,
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
  const [governorateOpen, setGovernorateOpen] = useState(false);
  const [failedOrderId, setFailedOrderId] = useState<number | null>(null);
  const [paymobIframeUrl, setPaymobIframeUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    address: "", governorate: "", postalCode: "", city: "",
  });

  const lines = isShopify && shopifyCart ? shopifyCart.lines.nodes : null;
  const localLines = !isShopify ? localItems : [];
  const localSubtotal = localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);
  const subtotalAmount = shopifyCart ? parseFloat(shopifyCart.cost.subtotalAmount.amount) : localSubtotal;
  const cartDiscountedTotal = shopifyCart ? parseFloat(shopifyCart.cost.totalAmount.amount) : localSubtotal;
  const savings = Math.max(0, subtotalAmount - cartDiscountedTotal);
  const totalAmount = cartDiscountedTotal + SHIPPING_EGP;
  const currencyCode = shopifyCart?.cost.totalAmount.currencyCode ?? localItems[0]?.currencyCode ?? "EGP";

  function fmt(amount: number) {
    try {
      return new Intl.NumberFormat("en-EG", {
        style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0,
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
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.governorate.trim()) {
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
      ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
      : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

    const customerPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim(),
      address: form.address.trim(),
      governorate: form.governorate.trim(),
      postalCode: form.postalCode.trim() || undefined,
      city: form.city.trim(),
    };

    if (paymentMethod === "card") {
      try {
        const res = await fetch("/api/orders/paymob-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLines,
            customer: customerPayload,
            cartId: shopifyCart?.id ?? null,
            discountCode: promoApplied?.code ?? null,
            cancelPreviousOrderId: failedOrderId ?? undefined,
            siteOrigin: window.location.origin,
          }),
        });

        const data = await res.json() as {
          clientSecret?: string;
          publicKey?: string;
          shopifyOrderId?: number;
          shopifyOrderNumber?: number;
          total?: string;
          error?: string;
        };

        if (!res.ok || !data.clientSecret || !data.publicKey) {
          setStep("form");
          setSubmitError(data.error ?? "Payment gateway unavailable. Please try again.");
          return;
        }

        setOrderResult({
          orderNumber: data.shopifyOrderNumber ?? data.shopifyOrderId ?? "",
          total: data.total ?? fmt(totalAmount),
          shopifyOrderId: data.shopifyOrderId,
        });
        setFailedOrderId(null);
        setPaymobIframeUrl(
          `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(data.publicKey)}&clientSecret=${encodeURIComponent(data.clientSecret)}`
        );
        setStep("card-checkout");
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      return;
    }

    if (paymentMethod === "instapay") {
      try {
        const res = await fetch("/api/orders/instapay-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLines,
            customer: customerPayload,
            cartId: shopifyCart?.id ?? null,
            discountCode: promoApplied?.code ?? null,
          }),
        });

        const data = await res.json() as {
          success?: boolean;
          instapayAccount?: string;
          instapayNumber?: string;
          error?: string;
        };

        if (!res.ok || !data.success) {
          setStep("form");
          setSubmitError(data.error ?? "Something went wrong. Please try again.");
          return;
        }

        setOrderResult({
          orderNumber: "",
          total: fmt(totalAmount),
          instapayAccount: data.instapayAccount,
          instapayNumber: data.instapayNumber,
          customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          customerPhone: form.phone.trim(),
          instapayOrderData: {
            lines: orderLines,
            customer: customerPayload,
            cartId: shopifyCart?.id ?? undefined,
            discountCode: promoApplied?.code ?? undefined,
          },
        });
        setStep("instapay-confirm");
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      return;
    }

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: orderLines,
          customer: customerPayload,
          paymentMethod: "cod",
          cartId: shopifyCart?.id ?? null,
          discountCode: promoApplied?.code ?? null,
        }),
      });

      const data = await res.json() as { orderNumber?: string | number; error?: string; total?: string; shopifyOrderId?: number };
      if (!res.ok || !data.orderNumber) {
        setStep("form");
        setSubmitError(data.error ?? "Could not place your order.");
        return;
      }

      setOrderResult({
        orderNumber: data.orderNumber,
        total: data.total ?? fmt(totalAmount),
        shopifyOrderId: data.shopifyOrderId,
      });
      setStep("cod-confirm");
      clearCart();
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
    }
  }, [form, isShopify, shopifyCart, paymentMethod, promoApplied?.code, failedOrderId, totalAmount, fmt, clearCart, localItems]);

  useEffect(() => {
    if (!checkoutOpen) {
      setStep("form");
      setSubmitError("");
      setOrderResult(null);
      setPromoError("");
      setPromoInput("");
      setPromoApplied(null);
      setGovernorateOpen(false);
      setPaymentMethod("cod");
      setFailedOrderId(null);
      setPaymobIframeUrl(null);
    }
  }, [checkoutOpen]);

  const closeAll = () => {
    closeCheckout();
    setStep("form");
    setSubmitError("");
    setOrderResult(null);
    setPaymobIframeUrl(null);
  };

  const handleCardSuccess = useCallback(() => {
    setPaymobIframeUrl(null);
    setStep("card-confirm");
    clearCart();
  }, [clearCart]);

  const handleCardFail = useCallback((orderId?: number | null) => {
    setPaymobIframeUrl(null);
    if (orderId) setFailedOrderId(orderId);
    setStep("card-failed");
  }, []);

  const handleCardRetry = useCallback(() => {
    setPaymobIframeUrl(null);
    setStep("form");
    setPaymentMethod("card");
  }, []);

  const handleChooseDifferent = useCallback(() => {
    setStep("form");
    setPaymentMethod("cod");
  }, []);

  const isConfirmStep = step === "cod-confirm" || step === "instapay-confirm" || step === "card-confirm" || step === "card-failed";
  const isCardCheckoutStep = step === "card-checkout";
  const loadingText = paymentMethod === "card" ? "Preparing payment…" : "Placing your order…";

  return (
    <AnimatePresence>
      {checkoutOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end justify-center md:items-center p-0 md:p-4"
          onClick={closeAll}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "tween", duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
            className="relative w-full max-w-6xl max-h-[100dvh] md:max-h-[90vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: "#faf8f5" }}
            onClick={(e) => e.stopPropagation()}
          >
            {step === "card-checkout" && paymobIframeUrl ? (
              <PaymobIframe
                url={paymobIframeUrl}
                onSuccess={handleCardSuccess}
                onFail={handleCardFail}
              />
            ) : step === "card-confirm" ? (
              <CardConfirmation orderResult={orderResult!} onDone={closeAll} />
            ) : step === "card-failed" ? (
              <CardFailed
                orderResult={orderResult!}
                onRetry={handleCardRetry}
                onChooseDifferent={handleChooseDifferent}
                onDone={closeAll}
              />
            ) : isConfirmStep ? (
              <CODConfirmation orderResult={orderResult!} onDone={closeAll} fmt={fmt} />
            ) : isCardCheckoutStep ? null : (
              <>
                <div className="flex-1 overflow-y-auto">
                  <div className="grid lg:grid-cols-[1.15fr_0.85fr] min-h-full">
                    <div className="relative px-6 md:px-10 py-6 md:py-8 border-r border-stone-200">
                      <button onClick={closeAll} className="absolute top-4 right-4 md:top-6 md:right-6 transition-opacity hover:opacity-50">
                        <X size={20} strokeWidth={1.5} />
                      </button>
                      <button onClick={closeAll} className="inline-flex items-center gap-2 text-xs tracking-[0.32em] uppercase font-light mb-8 md:mb-10 transition-opacity hover:opacity-60">
                        <ArrowLeft size={14} strokeWidth={1.5} /> Back
                      </button>

                      <h2 className="font-serif text-3xl md:text-4xl mb-2" style={{ color: "#1e1814" }}>Checkout</h2>
                      <p className="text-xs tracking-[0.2em] uppercase mb-8 md:mb-10" style={{ color: "rgba(30,24,20,0.56)" }}>
                        Secure payment • Delivery in Egypt
                      </p>

                      {SHOPIFY_CONFIGURED && lines && lines.length > 0 ? (
                        <>
                          <div className="mb-8 flex flex-col gap-4">
                            {lines.map((line: any) => {
                              const merch = line.merchandise;
                              const variant = merch.product?.variants?.nodes?.find((v: any) => v.id === merch.id) || merch;
                              const linePrice = formatShopifyLinePrice?.(line) ?? `EGP ${(parseFloat(line.cost?.totalAmount?.amount || "0") || 0).toFixed(0)}`;
                              return (
                                <div key={line.id} className="flex gap-4">
                                  {merch.image?.url && (
                                    <img src={merch.image.url} alt={merch.image.altText || merch.product?.title || "Product"} className="w-16 h-20 object-cover bg-stone-100" />
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm uppercase tracking-[0.12em]" style={{ color: "#1e1814" }}>{merch.product?.title || "Product"}</p>
                                    <p className="text-xs mt-1" style={{ color: "rgba(30,24,20,0.62)" }}>{variant?.title || "Default"}</p>
                                    <p className="text-xs mt-1" style={{ color: "rgba(30,24,20,0.78)" }}>Qty {line.quantity}</p>
                                  </div>
                                  <p className="text-sm" style={{ color: "#1e1814" }}>{linePrice}</p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : null}

                      <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-5">
                          <div className="flex flex-col gap-1">
                            <label style={labelStyle}>First Name</label>
                            <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={inputStyle} autoComplete="given-name" className="checkout-input" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label style={labelStyle}>Last Name</label>
                            <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} autoComplete="family-name" className="checkout-input" />
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-5">
                          <div className="flex flex-col gap-1">
                            <label style={labelStyle}>Phone</label>
                            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} autoComplete="tel" className="checkout-input" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label style={labelStyle}>Email <span style={{ textTransform: "none", letterSpacing: "0.08em", opacity: 0.7, fontSize: "11px" }}>(optional)</span></label>
                            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} autoComplete="email" className="checkout-input" />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label style={labelStyle}>Address</label>
                          <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} autoComplete="street-address" className="checkout-input" />
                        </div>

                        <div className="grid md:grid-cols-2 gap-5">
                          <div className="flex flex-col gap-1 relative">
                            <label style={labelStyle}>Governorate</label>
                            <button type="button" onClick={() => setGovernorateOpen((o) => !o)} style={governorateInputStyle} className="checkout-input">
                              <span>{form.governorate || "Select governorate"}</span>
                              {governorateOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <AnimatePresence>
                              {governorateOpen && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} style={optionListStyle} className="absolute top-full mt-2 z-20 w-full">
                                  {GOVERNORATES.map((gov) => (
                                    <button
                                      key={gov}
                                      type="button"
                                      onClick={() => {
                                        setForm((f) => ({ ...f, governorate: gov }));
                                        setGovernorateOpen(false);
                                      }}
                                      style={optionStyle}
                                      className="hover:bg-black/5"
                                    >
                                      {gov}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label style={labelStyle}>Postal Code <span style={{ textTransform: "none", letterSpacing: "0.08em", opacity: 0.7, fontSize: "11px" }}>(optional)</span></label>
                            <input type="text" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} style={inputStyle} autoComplete="postal-code" className="checkout-input" />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label style={labelStyle}>City</label>
                          <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={inputStyle} autoComplete="address-level2" className="checkout-input" />
                        </div>
                      </div>

                      {submitError && (
                        <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: "12px", letterSpacing: "0.04em" }}>{submitError}</p>
                      )}

                      {paymentMethod === "instapay" && (
                        <div className="mt-5 p-4" style={{ backgroundColor: "rgba(30,24,20,0.05)", border: "1px solid rgba(30,24,20,0.14)" }}>
                          <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, letterSpacing: "0.04em" }}>
                            After placing your order, you'll see payment instructions and can upload your transfer screenshot directly on the site.
                          </p>
                        </div>
                      )}

                      {paymentMethod === "card" && (
                        <div className="mt-5 p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(30,24,20,0.05)", border: "1px solid rgba(30,24,20,0.14)" }}>
                          <CreditCard size={15} strokeWidth={1.5} style={{ color: "#1e1814", flexShrink: 0, marginTop: 2 }} />
                          <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.8, letterSpacing: "0.04em" }}>
                            You'll enter your card details securely on the next screen. No card information is collected here.
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
                </div>
              </>
            )}
          </motion.div>
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
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, letterSpacing: "0.06em" }}>
          Thank you for shopping with Moi.
        </p>
      </div>
      <div style={{ padding: "20px 28px", border: "1px solid rgba(30,24,20,0.22)", width: "100%" }}>
        <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "6px" }}>Order Number</p>
        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", color: "#1e1814", fontWeight: 700 }}>#{orderResult.orderNumber}</p>
      </div>
      <div style={{ padding: "16px 20px", backgroundColor: "rgba(30,24,20,0.07)", width: "100%" }}>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.92)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.8, letterSpacing: "0.04em" }}>
          <strong style={{ color: "#1e1814" }}>Cash on Delivery</strong><br />
          Our team will contact you shortly to arrange delivery. Total due on arrival: <strong style={{ color: "#1e1814" }}>{orderResult.total} EGP</strong>
        </p>
      </div>
      <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, lineHeight: 1.7 }}>
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

function CardConfirmation({ orderResult, onDone }: { orderResult: OrderResult; onDone: () => void }) {
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
          Payment Confirmed.
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, letterSpacing: "0.06em" }}>
          Thank you for shopping with Moi.
        </p>
      </div>
      <div style={{ padding: "20px 28px", border: "1px solid rgba(30,24,20,0.22)", width: "100%" }}>
        <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "6px" }}>Order Number</p>
        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", color: "#1e1814", fontWeight: 700 }}>#{orderResult.orderNumber}</p>
      </div>
      <div style={{ padding: "16px 20px", backgroundColor: "rgba(30,24,20,0.07)", width: "100%" }}>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.92)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.8, letterSpacing: "0.04em" }}>
          <strong style={{ color: "#1e1814" }}>Card Payment</strong><br />
          Your order is confirmed and is being prepared. You'll receive a WhatsApp update with your tracking details shortly.
        </p>
      </div>
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

function CardFailed({
  orderResult,
  onRetry,
  onChooseDifferent,
  onDone,
}: {
  orderResult: OrderResult;
  onRetry: () => void;
  onChooseDifferent: () => void;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-8 py-16 text-center flex flex-col items-center gap-6"
    >
      <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(192,57,43,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={22} strokeWidth={1.5} style={{ color: "#c0392b" }} />
      </div>
      <div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "36px", fontWeight: 700, color: "#1e1814", marginBottom: "8px" }}>
          Payment Failed.
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, letterSpacing: "0.06em" }}>
          Your order is still reserved. Please try again.
        </p>
      </div>
      {orderResult.orderNumber && (
        <div style={{ padding: "14px 20px", border: "1px solid rgba(30,24,20,0.14)", width: "100%" }}>
          <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>Reserved Order</p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "24px", color: "#1e1814", fontWeight: 700 }}>#{orderResult.orderNumber}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <button onClick={onRetry} className="flex-1 py-4" style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
          Retry Card Payment
        </button>
        <button onClick={onChooseDifferent} className="flex-1 py-4" style={{ border: "1px solid rgba(30,24,20,0.16)", color: "#1e1814", fontSize: "13px", letterSpacing: "0.24em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
          Choose Another Method
        </button>
      </div>
      <button onClick={onDone} className="transition-opacity hover:opacity-60" style={{ fontSize: "13px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>
        Continue Shopping
      </button>
    </motion.div>
  );
}

interface PaymobIframeProps {
  url: string;
  onSuccess: () => void;
  onFail: (orderId?: number | null) => void;
}

function PaymobIframe({ url, onSuccess, onFail }: PaymobIframeProps) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "paymob-success") onSuccess();
      if (event.data?.type === "paymob-failure") onFail(event.data?.orderId ?? null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSuccess, onFail]);

  return (
    <iframe
      src={url}
      className="w-full h-[100dvh] md:h-[90vh] border-0"
      allow="payment *"
      title="Paymob Checkout"
    />
  );
}
