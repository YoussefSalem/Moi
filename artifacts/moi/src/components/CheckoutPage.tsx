import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Upload, X, CreditCard } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";

type PaymentMethod = "cod" | "instapay" | "card";
type Step = "form" | "loading" | "cod-confirm" | "instapay-confirm" | "card-checkout" | "card-confirm" | "card-failed";
type InstapaySubStep = "instructions" | "upload" | "review";

interface OrderResult {
  orderNumber: string | number;
  total: string;
  shopifyOrderId?: number;
  shopifyOrderNumber?: number;
  instapayAccount?: string;
  instapayNumber?: string;
  customerName?: string;
  customerPhone?: string;
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

    // Card payment: call paymob-init → embed Paymob hosted checkout in-page via iframe
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

        const resolvedTotal = data.total ?? fmt(totalAmount);
        setOrderResult({
          orderNumber: data.shopifyOrderNumber ?? data.shopifyOrderId ?? "",
          total: resolvedTotal,
          shopifyOrderId: data.shopifyOrderId,
          shopifyOrderNumber: data.shopifyOrderNumber,
        });
        setFailedOrderId(null);
        // Persist order info in sessionStorage so it survives a 3DS full-page redirect
        if (data.shopifyOrderId) {
          sessionStorage.setItem("moi_paymob_pending_order_id", String(data.shopifyOrderId));
          sessionStorage.setItem("moi_paymob_order_number", String(data.shopifyOrderNumber ?? ""));
          sessionStorage.setItem("moi_paymob_order_total", resolvedTotal);
          sessionStorage.removeItem("moi_paymob_failed_order_id");
        }
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

    // InstaPay: validate cart + get account info — order is created only at proof upload
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
          shopifyOrderId?: number;
          shopifyOrderNumber?: number;
          total?: string;
          error?: string;
        };

        if (!res.ok || !data.success) {
          setStep("form");
          setSubmitError(data.error ?? "Something went wrong. Please try again.");
          return;
        }

        setOrderResult({
          orderNumber: data.shopifyOrderNumber ?? data.shopifyOrderId ?? "",
          total: data.total ?? fmt(totalAmount),
          shopifyOrderId: data.shopifyOrderId,
          shopifyOrderNumber: data.shopifyOrderNumber,
          instapayAccount: data.instapayAccount,
          instapayNumber: data.instapayNumber,
          customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          customerPhone: form.phone.trim(),
        });
        setStep("instapay-confirm");
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      return;
    }

    // COD: call orders/create
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

      const data = await res.json() as {
        success?: boolean;
        orderNumber?: number | string;
        shopifyOrderId?: number;
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
        shopifyOrderId: data.shopifyOrderId,
        customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        customerPhone: form.phone.trim(),
      });

      clearCart();
      setStep("cod-confirm");
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
    }
  }, [form, paymentMethod, isShopify, shopifyCart, localItems, promoApplied, totalAmount, fmt, failedOrderId, clearCart]);

  const handleDone = useCallback(() => {
    clearCart();
    setStep("form");
    setOrderResult(null);
    setPaymobIframeUrl(null);
    setPromoApplied(null);
    setPromoInput("");
    setGovernorateOpen(false);
    setFailedOrderId(null);
    setForm({ firstName: "", lastName: "", phone: "", email: "", address: "", governorate: "", postalCode: "", city: "" });
    closeCheckout();
  }, [clearCart, closeCheckout]);

  const handleIframeSuccess = useCallback(() => {
    setPaymobIframeUrl(null);
    setStep("card-confirm");
    clearCart();
  }, [clearCart]);

  const handleIframeFail = useCallback(() => {
    setPaymobIframeUrl(null);
    if (orderResult?.shopifyOrderId) {
      setFailedOrderId(orderResult.shopifyOrderId);
    }
    setStep("card-failed");
  }, [orderResult]);

  const handleCancelCardCheckout = useCallback(() => {
    if (orderResult?.shopifyOrderId) {
      setFailedOrderId(orderResult.shopifyOrderId);
    }
    setPaymobIframeUrl(null);
    setStep("form");
    setPaymentMethod("card");
  }, [orderResult]);

  const handleRetryCard = useCallback(() => {
    if (orderResult?.shopifyOrderId) {
      setFailedOrderId(orderResult.shopifyOrderId);
    }
    setStep("form");
    setPaymentMethod("card");
  }, [orderResult]);

  const handleChooseDifferent = useCallback(() => {
    if (orderResult?.shopifyOrderId) {
      setFailedOrderId(orderResult.shopifyOrderId);
    }
    setStep("form");
    setPaymentMethod("cod");
  }, [orderResult]);

  // On mount: restore state if the user was redirected back from Paymob's 3DS page.
  // /api/paymob-return writes moi_paymob_result + sibling keys before redirecting to /.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const resultRaw = sessionStorage.getItem("moi_paymob_result");
    if (!resultRaw) return;

    const pendingIdRaw = sessionStorage.getItem("moi_paymob_pending_order_id");
    const orderNumRaw = sessionStorage.getItem("moi_paymob_order_number");
    const orderTotalRaw = sessionStorage.getItem("moi_paymob_order_total");

    ["moi_paymob_result", "moi_paymob_pending_order_id", "moi_paymob_order_number",
      "moi_paymob_order_total", "moi_paymob_failed_order_id"].forEach((k) => sessionStorage.removeItem(k));

    try {
      const result = JSON.parse(resultRaw) as { success: boolean };
      const shopifyOrderId = pendingIdRaw ? parseInt(pendingIdRaw, 10) : undefined;
      setOrderResult({
        orderNumber: orderNumRaw ?? "",
        total: orderTotalRaw ?? "",
        shopifyOrderId: shopifyOrderId || undefined,
      });
      if (result.success) {
        clearCart();
        setStep("card-confirm");
      } else {
        if (shopifyOrderId) setFailedOrderId(shopifyOrderId);
        setStep("card-failed");
      }
      openCheckout();
    } catch {
      // ignore malformed sessionStorage data
    }
  }, []); // mount-only — intentionally omits deps to avoid re-running on state changes

  const isConfirmStep = step === "cod-confirm" || step === "instapay-confirm" || step === "card-confirm" || step === "card-failed";
  const isCardCheckoutStep = step === "card-checkout";
  const loadingText = paymentMethod === "card" ? "Preparing payment…" : "Placing your order…";

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
              onClick={isConfirmStep ? handleDone : isCardCheckoutStep ? handleCancelCardCheckout : closeCheckout}
              className="flex items-center gap-2 transition-opacity hover:opacity-50"
              aria-label="Back"
            >
              <ArrowLeft size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              <span style={{ fontSize: "13px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif" }}>
                {isConfirmStep ? "Continue shopping" : isCardCheckoutStep ? "Cancel" : "Back"}
              </span>
            </button>
            <span style={{ fontSize: "13px", letterSpacing: "0.4em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
              MOI
            </span>
            <div style={{ width: 80 }} />
          </div>

          {step === "card-checkout" && paymobIframeUrl ? (
            <motion.div
              key="card-checkout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16"
            >
              {/* Left: compact order summary */}
              <div>
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Order Summary
                </p>
                <div style={{ borderTop: "1px solid rgba(30,24,20,0.16)" }}>
                  {lines
                    ? lines.map((line) => (
                        <div key={line.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.08)" }}>
                            {line.merchandise.product.featuredImage && (
                              <img src={line.merchandise.product.featuredImage.url} alt={line.merchandise.product.title} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{line.merchandise.product.title}</p>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif" }}>Qty {line.quantity}</span>
                              <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{formatShopifyLinePrice(line)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    : localLines.map((item) => (
                        <div key={item.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.08)" }}>
                            {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{item.title}</p>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif" }}>Qty {item.quantity}</span>
                              <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{fmt(item.priceAmount * item.quantity)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(30,24,20,0.12)" }}>
                  <div className="flex justify-between items-center mb-1">
                    <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>Shipping</span>
                    <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif" }}>{fmt(SHIPPING_EGP)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>Total</span>
                    <span style={{ fontSize: "18px", color: "#1e1814", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, letterSpacing: "0.03em" }}>
                      {orderResult?.total ?? fmt(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: card payment panel */}
              <div className="flex flex-col">
                {/* Card header */}
                <div className="mb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <rect x="0.5" y="0.5" width="33" height="23" rx="3.5" stroke="rgba(30,24,20,0.22)" fill="rgba(30,24,20,0.03)"/>
                      <rect x="9" y="7" width="16" height="10" rx="1.5" fill="rgba(30,24,20,0.15)" stroke="rgba(30,24,20,0.2)" strokeWidth="0.75"/>
                      <line x1="9" y1="12" x2="25" y2="12" stroke="rgba(30,24,20,0.16)" strokeWidth="0.75"/>
                      <line x1="17" y1="7" x2="17" y2="17" stroke="rgba(30,24,20,0.16)" strokeWidth="0.75"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.45)", fontFamily: "'Montserrat', sans-serif", marginBottom: "2px" }}>
                        Payment
                      </p>
                      <p style={{ fontSize: "13px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
                        Credit / Debit Card
                      </p>
                    </div>
                  </div>
                  <div style={{ height: "1px", backgroundColor: "rgba(30,24,20,0.13)" }} />
                </div>

                {/* Paymob iframe */}
                <div className="flex-1" style={{ minHeight: "520px" }}>
                  <PaymobIframe
                    url={paymobIframeUrl}
                    onSuccess={handleIframeSuccess}
                    onFail={handleIframeFail}
                    iframeStyle={{ height: "580px" }}
                  />
                </div>

                {/* Security badge */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <CreditCard size={12} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.38)", flexShrink: 0 }} />
                  <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.42)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
                    Secured by Paymob · 256-bit SSL
                  </p>
                </div>
              </div>
            </motion.div>
          ) : step === "loading" ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                style={{ width: 28, height: 28, border: "1.5px solid rgba(30,24,20,0.32)", borderTopColor: "#1e1814", borderRadius: "50%" }}
              />
              <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>
                {loadingText}
              </p>
            </div>
          ) : step === "cod-confirm" ? (
            <CODConfirmation orderResult={orderResult!} onDone={handleDone} fmt={fmt} />
          ) : step === "instapay-confirm" ? (
            <InstapayConfirmation
              orderResult={orderResult!}
              onDone={handleDone}
              onProofSubmitted={(orderNumber, shopifyOrderId, total) => {
                setOrderResult((prev) => prev ? { ...prev, orderNumber, shopifyOrderId, total } : prev);
                clearCart();
              }}
              fmt={fmt}
            />
          ) : step === "card-confirm" ? (
            <CardConfirmation orderResult={orderResult!} onDone={handleDone} />
          ) : step === "card-failed" ? (
            <CardFailed
              orderResult={orderResult!}
              onRetry={handleRetryCard}
              onChooseDifferent={handleChooseDifferent}
              onDone={handleDone}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              {/* Left: Order Summary */}
              <div>
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Order Summary
                </p>

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
                              <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{line.merchandise.product.title}</p>
                              {line.merchandise.title !== "Default Title" && (
                                <p style={{ fontSize: "13px", color: "#7a6e64", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>{line.merchandise.title}</p>
                              )}
                            </div>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Qty {line.quantity}</span>
                              <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{formatShopifyLinePrice(line)}</span>
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
                            <p style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{item.title}</p>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Qty {item.quantity}</span>
                              <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{item.price}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>

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
                    <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.12em" }}>Total Amount</span>
                    <span style={{ fontSize: "16px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>{fmt(totalAmount)}</span>
                  </div>
                </div>

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
                                  className="checkout-input"
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
                {/* Payment method tiles */}
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "16px" }}>
                  Payment Method
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-8">
                  {(["cod", "instapay", "card"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className="text-left transition-all"
                      style={{
                        padding: "14px 12px",
                        border: paymentMethod === m ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.15)",
                        backgroundColor: paymentMethod === m ? "rgba(30,24,20,0.03)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: "16px", marginBottom: "5px" }}>
                        {m === "cod" ? "🚚" : m === "instapay" ? "📱" : "💳"}
                      </div>
                      <p style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, lineHeight: 1.3 }}>
                        {m === "cod" ? "Cash on Delivery" : m === "instapay" ? "InstaPay" : "Card"}
                      </p>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", marginTop: "3px", lineHeight: 1.4 }}>
                        {m === "cod" ? "Pay on arrival" : m === "instapay" ? "Bank transfer" : "Online payment"}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Delivery form */}
                <p style={{ fontSize: "13px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Delivery Details
                </p>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label style={labelStyle}>First Name</label>
                      <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={inputStyle} autoComplete="given-name" className="checkout-input" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label style={labelStyle}>Last Name</label>
                      <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} autoComplete="family-name" className="checkout-input" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Phone Number</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} autoComplete="tel" placeholder="01X XXXX XXXX" className="checkout-input" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Email Address</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} autoComplete="email" placeholder="your@email.com" className="checkout-input" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Address</label>
                    <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} autoComplete="street-address" className="checkout-input" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col gap-1 relative">
                      <label style={labelStyle}>Governorate</label>
                      <button type="button" onClick={() => setGovernorateOpen((o) => !o)} style={governorateInputStyle} className="checkout-input">
                        <span style={{ color: form.governorate ? "#1e1814" : "rgba(30,24,20,0.42)" }}>
                          {form.governorate || "Select governorate"}
                        </span>
                        <ChevronDown size={14} strokeWidth={1.8} style={{ color: "rgba(30,24,20,0.55)", flexShrink: 0 }} />
                      </button>
                      <AnimatePresence>
                        {governorateOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.16 }}
                            style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, marginTop: 8 }}
                          >
                            <div style={optionListStyle}>
                              {GOVERNORATES.map((governorate) => (
                                <button
                                  key={governorate}
                                  type="button"
                                  onClick={() => { setForm((f) => ({ ...f, governorate })); setGovernorateOpen(false); }}
                                  style={{ ...optionStyle, backgroundColor: form.governorate === governorate ? "rgba(30,24,20,0.06)" : "transparent" }}
                                >
                                  {governorate}
                                </button>
                              ))}
                            </div>
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
                    <div>
                      <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.8, letterSpacing: "0.04em" }}>
                        Your delivery details are pre-filled. You'll only need to enter your card number, expiry, and CVV on the secure payment screen.
                      </p>
                    </div>
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
      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onRetry}
          className="w-full py-4 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
        >
          Try Again with Card
        </button>
        <button
          onClick={onChooseDifferent}
          className="w-full py-3 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "transparent", border: "1.5px solid #1e1814", color: "#1e1814", fontSize: "13px", letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
        >
          Choose Different Method
        </button>
        <button
          onClick={onDone}
          className="w-full py-3 transition-opacity hover:opacity-60"
          style={{ fontSize: "13px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", border: "1px solid rgba(30,24,20,0.18)" }}
        >
          Cancel Order
        </button>
      </div>
    </motion.div>
  );
}

function InstapayConfirmation({
  orderResult,
  onDone,
  onProofSubmitted,
  fmt,
}: {
  orderResult: OrderResult;
  onDone: () => void;
  onProofSubmitted: (orderNumber: string | number, shopifyOrderId: number, total: string) => void;
  fmt: (n: number) => string;
}) {
  const [subStep, setSubStep] = useState<InstapaySubStep>("instructions");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isTouch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  const instapayAccount = orderResult.instapayAccount ?? import.meta.env.VITE_INSTAPAY_ACCOUNT_NAME ?? "";
  const instapayNumber = orderResult.instapayNumber ?? import.meta.env.VITE_INSTAPAY_ACCOUNT_NUMBER ?? "";

  function applyFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (JPG, PNG, HEIC).");
      return;
    }
    const preview = URL.createObjectURL(file);
    setScreenshotFile(file);
    setScreenshotPreview(preview);
    setUploadError("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) applyFile(file);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  }

  async function handleSubmitProof() {
    if (!referenceNumber.trim()) {
      setUploadError("Please enter the Instapay reference number.");
      return;
    }
    if (!screenshotFile) {
      setUploadError("Please upload your payment screenshot to continue.");
      return;
    }

    setUploadError("");
    setUploading(true);
    setUploadProgress(5);

    try {
      const compressed = await compressImage(screenshotFile);
      setUploadProgress(20);

      const formData = new FormData();
      formData.append("shopifyOrderId", String(orderResult.shopifyOrderId ?? ""));
      formData.append("shopifyOrderNumber", String(orderResult.shopifyOrderNumber ?? orderResult.orderNumber ?? ""));
      formData.append("referenceNumber", referenceNumber.trim());
      if (orderResult.customerName) formData.append("customerName", orderResult.customerName);
      if (orderResult.customerPhone) formData.append("customerPhone", orderResult.customerPhone);
      formData.append("amount", orderResult.total);
      formData.append("screenshot", compressed, "proof.jpg");

      const data = await new Promise<{
        ok?: boolean;
        alreadySubmitted?: boolean;
        error?: string;
        orderNumber?: string | number;
        shopifyOrderId?: number;
        total?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/orders/instapay-proof");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(20 + Math.round((ev.loaded / ev.total) * 70));
          }
        };
        xhr.onload = () => {
          try {
            resolve(JSON.parse(xhr.responseText) as {
              ok?: boolean; alreadySubmitted?: boolean; error?: string;
              orderNumber?: string | number; shopifyOrderId?: number; total?: string;
            });
          }
          catch { reject(new Error("Invalid response")); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      setUploadProgress(95);

      if (!data.ok && !data.alreadySubmitted) {
        setUploadError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      if (data.orderNumber != null && data.shopifyOrderId != null) {
        setConfirmedOrderNumber(data.orderNumber);
        onProofSubmitted(data.orderNumber, data.shopifyOrderId, data.total ?? orderResult.total);
      }

      setUploadProgress(100);
      setSubStep("review");
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6"
    >
      {/* Heading — changes once order is confirmed */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "32px", fontWeight: 700, color: "#1e1814", marginBottom: "6px" }}>
          {subStep === "review" ? "Order Confirmed." : "Payment Instructions"}
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
          {subStep === "review"
            ? "We'll verify your payment and contact you shortly."
            : "Complete the steps below to place your order."}
        </p>
      </div>

      {/* Order number — only shown once proof is submitted */}
      {confirmedOrderNumber != null && (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>Order Number</p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", color: "#1e1814", fontWeight: 700 }}>#{confirmedOrderNumber}</p>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-0 w-full" style={{ maxWidth: 320 }}>
        {(["instructions", "upload", "review"] as InstapaySubStep[]).map((s, i) => (
          <div key={s} className="flex items-center" style={{ flex: 1 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: subStep === s ? "#1e1814" : (i < ["instructions","upload","review"].indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.12)"),
              flexShrink: 0,
            }}>
              {i < ["instructions","upload","review"].indexOf(subStep) ? (
                <Check size={12} strokeWidth={2.5} style={{ color: "#fff" }} />
              ) : (
                <span style={{ fontSize: "11px", color: subStep === s ? "#fff" : "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{i + 1}</span>
              )}
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, backgroundColor: i < ["instructions","upload","review"].indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.18)", marginLeft: 2, marginRight: 2 }} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {subStep === "instructions" && (
          <motion.div key="instructions" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <div style={{ border: "1px solid rgba(30,24,20,0.22)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.03)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>How to Pay via Instapay</p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  `Open your banking app and transfer ${orderResult.total} EGP via Instapay.`,
                  `Send to the account below. Save your reference number.`,
                  `Return here to upload your payment screenshot.`,
                ].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#1e1814", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", color: "#fff", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.88)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(30,24,20,0.22)", backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>Instapay Account</p>
              </div>
              <div className="p-4 space-y-3">
                {instapayAccount && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Name</p>
                      <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{instapayAccount}</p>
                    </div>
                    <button onClick={() => copyToClipboard(instapayAccount, "name")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "name" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                      {copied === "name" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                {instapayNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Account / Number</p>
                      <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}>{instapayNumber}</p>
                    </div>
                    <button onClick={() => copyToClipboard(instapayNumber, "number")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "number" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                      {copied === "number" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(30,24,20,0.1)" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Amount</p>
                    <p style={{ fontSize: "16px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{orderResult.total} EGP</p>
                  </div>
                  <button onClick={() => copyToClipboard(orderResult.total, "amount")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "amount" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                    {copied === "amount" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSubStep("upload")}
              className="w-full py-4 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              I've Sent the Payment →
            </button>
          </motion.div>
        )}

        {subStep === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <div>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>Instapay Reference Number <span style={{ color: "#c0392b" }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={inputStyle}
                className="checkout-input"
              />
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>
                Payment Screenshot <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onPaste={handlePaste}
                onClick={() => fileRef.current?.click()}
                tabIndex={0}
                style={{
                  border: "1.5px dashed rgba(30,24,20,0.28)",
                  padding: "24px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: screenshotPreview ? "transparent" : "rgba(30,24,20,0.02)",
                  position: "relative",
                  overflow: "hidden",
                  outline: "none",
                }}
              >
                {screenshotPreview ? (
                  <div style={{ position: "relative", width: "100%" }}>
                    <img src={screenshotPreview} alt="Screenshot preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain" }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setScreenshotFile(null); setScreenshotPreview(null); }}
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
                    >
                      <X size={12} strokeWidth={2} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={20} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                    <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", lineHeight: 1.6 }}>
                      {isTouch ? "Tap to upload your screenshot" : "Drag & drop, paste, or click to upload"}<br />
                      <span style={{ fontSize: "11px", opacity: 0.7 }}>JPG, PNG, HEIC accepted</span>
                    </p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              </div>
            </div>

            {uploading && (
              <div style={{ width: "100%", height: 3, backgroundColor: "rgba(30,24,20,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  style={{ height: "100%", backgroundColor: "#1e1814", borderRadius: 2 }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {uploadError && (
              <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>{uploadError}</p>
            )}

            <button
              onClick={handleSubmitProof}
              disabled={uploading || !referenceNumber.trim()}
              className="w-full py-4 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              {uploading ? "Submitting…" : "Submit Proof"}
            </button>

            <button
              onClick={() => setSubStep("instructions")}
              style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", textAlign: "center" as const }}
            >
              ← Back to Instructions
            </button>
          </motion.div>
        )}

        {subStep === "review" && (
          <motion.div key="review" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col items-center gap-5 py-4">
            <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={24} strokeWidth={1.5} style={{ color: "#1e1814" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#1e1814", marginBottom: "8px" }}>
                Proof Submitted
              </h2>
              <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
                {confirmedOrderNumber != null
                  ? <>We've received your payment proof for order <strong style={{ color: "#1e1814" }}>#{confirmedOrderNumber}</strong>. Our team will verify and confirm your order via WhatsApp shortly.</>
                  : <>We've received your payment proof. Our team will verify and confirm your order via WhatsApp shortly.</>}
              </p>
            </div>
            <div style={{ padding: "14px 18px", backgroundColor: "rgba(30,24,20,0.04)", border: "1px solid rgba(30,24,20,0.12)", width: "100%", textAlign: "center" as const }}>
              <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", lineHeight: 1.7 }}>
                Verification is usually completed within a few hours during business hours.
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
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface PaymobIframeProps {
  url: string;
  onSuccess: () => void;
  onFail: () => void;
  iframeStyle?: React.CSSProperties;
}

function PaymobIframe({ url, onSuccess, onFail, iframeStyle }: PaymobIframeProps) {
  useEffect(() => {
    const expectedOrigin = window.location.origin;
    function handleMessage(event: MessageEvent) {
      // Only accept messages from our own origin (the /api/paymob-return relay page)
      if (event.origin !== expectedOrigin) return;
      const data = event.data as { type?: string; success?: boolean };
      if (data?.type === "PAYMOB_RESULT") {
        if (data.success) {
          onSuccess();
        } else {
          onFail();
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSuccess, onFail]);

  return (
    <iframe
      src={url}
      title="Secure Card Payment"
      allow="payment"
      style={{
        width: "100%",
        height: "calc(100vh - 73px)",
        border: "none",
        display: "block",
        ...iframeStyle,
      }}
    />
  );
}
