import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ShoppingBag } from "lucide-react";

interface CartItem {
  id?: string;
  title: string;
  variantTitle?: string | null;
  quantity: number;
  image?: string | null;
  price?: string;
}

interface BreakdownSnapshot {
  subtotal: number;
  savings: number;
  shippingCost: number;
  freeShipping: boolean;
}

interface PaymentSuccessPageProps {
  intentId: string;
  onContinueShopping: () => void;
}

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("de-DE")} EGP`;
}

interface PaymentSuccessPageProps {
  intentId: string;
  txnId?: string;
  onContinueShopping: () => void;
}

export function PaymentSuccessPage({ intentId, txnId, onContinueShopping }: PaymentSuccessPageProps) {
  const [shopifyOrderNumber, setShopifyOrderNumber] = useState<number | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState<string>("");
  const [breakdown, setBreakdown] = useState<BreakdownSnapshot | null>(null);
  const syncCalledRef = useRef(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    const itemsRaw = sessionStorage.getItem("moi_paymob_items");
    const totalRaw = sessionStorage.getItem("moi_paymob_order_total");
    const breakdownRaw = sessionStorage.getItem("moi_paymob_breakdown");

    const paymentMethodRaw = sessionStorage.getItem("moi_paymob_payment_method") ?? "card";
    let parsedItems: CartItem[] = [];
    let parsedBreakdown: BreakdownSnapshot | null = null;

    if (itemsRaw) {
      try { parsedItems = JSON.parse(itemsRaw) as CartItem[]; setItems(parsedItems); } catch { /* ignore */ }
    }
    if (totalRaw) setTotal(totalRaw);
    if (breakdownRaw) {
      try { parsedBreakdown = JSON.parse(breakdownRaw) as BreakdownSnapshot; setBreakdown(parsedBreakdown); } catch { /* ignore */ }
    }

    // Redirect to /ordermade, passing data via sessionStorage so the unified page handles it
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      if (parsedBreakdown || parsedItems.length > 0) {
        try {
          sessionStorage.setItem("moi_order_confirmation", JSON.stringify({
            items: parsedItems,
            breakdown: parsedBreakdown ?? { subtotal: 0, savings: 0, shippingCost: 0, freeShipping: false },
            paymentMethod: paymentMethodRaw,
            intentId: intentId || undefined,
          }));
        } catch { /* ignore */ }
      }
      const search = new URLSearchParams();
      if (intentId) search.set("intentId", intentId);
      if (txnId) search.set("txnId", txnId);
      const dest = `/ordermade${search.toString() ? `?${search.toString()}` : ""}`;
      window.history.replaceState(null, "", dest);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }

    // Clear all Paymob session keys upfront so CheckoutPage's mount-only effect
    // doesn't find moi_paymob_result and reopen the checkout overlay on this page.
    ["moi_paymob_items", "moi_paymob_order_total", "moi_paymob_breakdown",
     "moi_paymob_intent_id", "moi_checkout_form", "moi_paymob_result"].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    if (!intentId) return;
    if (syncCalledRef.current) return;
    syncCalledRef.current = true;

    fetch("/api/orders/paymob-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId, ...(txnId ? { paymobTxnId: txnId } : {}) }),
    }).catch(() => {});
  }, [intentId, txnId]);

  useEffect(() => {
    if (!intentId) return;
    if (shopifyOrderNumber) return;

    let cancelled = false;
    let attempts = 0;
    const MAX = 15;

    const run = async () => {
      while (!cancelled && attempts < MAX) {
        attempts++;
        await new Promise<void>((r) => setTimeout(r, 2000));
        if (cancelled) break;
        try {
          const res = await fetch(`/api/orders/paymob-status/${intentId}`, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json() as { status: string; shopifyOrderNumber?: number | null };
          if (data.shopifyOrderNumber) {
            setShopifyOrderNumber(data.shopifyOrderNumber);
            break;
          }
        } catch { /* keep polling */ }
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [intentId, shopifyOrderNumber]);

  const handleContinue = () => {
    ["moi_paymob_result", "moi_paymob_items", "moi_paymob_order_total", "moi_paymob_breakdown", "moi_paymob_intent_id"].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
    onContinueShopping();
  };

  const displayTotal = breakdown
    ? fmt(breakdown.subtotal - breakdown.savings + breakdown.shippingCost)
    : total;

  return (
    <div
      style={{ minHeight: "100vh", backgroundColor: "#faf8f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "60px 24px 80px" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 480, width: "100%" }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "rgba(47,102,68,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <Check size={28} strokeWidth={2} style={{ color: "#2f6644" }} />
        </div>

        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "11px",
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "rgba(30,24,20,0.52)",
            marginBottom: 10,
          }}
        >
          Payment Successful
        </p>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "38px",
            fontWeight: 700,
            color: "#1e1814",
            marginBottom: 14,
            lineHeight: 1.1,
          }}
        >
          Order Placed.
        </h1>

        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "14px",
            color: "rgba(30,24,20,0.62)",
            lineHeight: 1.75,
            maxWidth: 340,
            marginBottom: 36,
          }}
        >
          {shopifyOrderNumber
            ? <>Your payment was received for order <strong style={{ color: "#1e1814" }}>#{shopifyOrderNumber}</strong>. Your order is now being prepared.</>
            : "Your payment has been received and your order is now being prepared."}
        </p>

        <div
          style={{
            padding: "16px 28px",
            border: "1px solid rgba(30,24,20,0.22)",
            width: "100%",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          {shopifyOrderNumber ? (
            <>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", marginBottom: 4 }}>
                Order Number
              </p>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "32px", color: "#1e1814", fontWeight: 700 }}>
                #{shopifyOrderNumber}
              </p>
            </>
          ) : (
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.45)" }}>
              Confirming order…
            </p>
          )}
        </div>

        {breakdown && (
          <div style={{ width: "100%", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "rgba(30,24,20,0.6)", letterSpacing: "0.04em" }}>Subtotal</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "#1e1814" }}>{fmt(breakdown.subtotal)}</span>
            </div>
            {breakdown.savings > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "#2f6644", letterSpacing: "0.04em" }}>Savings</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "#2f6644" }}>−{fmt(breakdown.savings)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "rgba(30,24,20,0.6)", letterSpacing: "0.04em" }}>Shipping</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "#1e1814" }}>{breakdown.freeShipping ? "Free" : fmt(breakdown.shippingCost)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 700, color: "#1e1814", letterSpacing: "0.06em", textTransform: "uppercase" }}>Total</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 700, color: "#1e1814" }}>{displayTotal}</span>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {items.map((item) => (
              <div
                key={item.id ?? `${item.title}-${item.quantity}`}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "1px solid rgba(30,24,20,0.08)", backgroundColor: "rgba(30,24,20,0.02)" }}
              >
                <div style={{ width: 48, height: 56, flexShrink: 0, overflow: "hidden", backgroundColor: "rgba(30,24,20,0.08)" }}>
                  {item.image
                    ? <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" decoding="async" />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={18} strokeWidth={1} style={{ color: "rgba(30,24,20,0.22)" }} /></div>
                  }
                </div>
                <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 600, color: "#1e1814", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </p>
                  {item.variantTitle && (
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", marginTop: 2 }}>
                      {item.variantTitle}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "rgba(30,24,20,0.54)" }}>Qty {item.quantity}</p>
                  {item.price && (
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 600, color: "#1e1814" }}>{item.price}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            padding: "14px 18px",
            backgroundColor: "rgba(30,24,20,0.04)",
            border: "1px solid rgba(30,24,20,0.12)",
            width: "100%",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "rgba(30,24,20,0.7)", letterSpacing: "0.04em", lineHeight: 1.7 }}>
            You'll receive a WhatsApp message with your order details and tracking update shortly.
          </p>
        </div>

        <button
          onClick={handleContinue}
          style={{
            padding: "14px 36px",
            border: "1px solid rgba(30,24,20,0.22)",
            backgroundColor: "transparent",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#1e1814",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          Continue Shopping
        </button>
      </motion.div>
    </div>
  );
}
