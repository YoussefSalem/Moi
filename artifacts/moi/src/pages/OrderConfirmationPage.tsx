import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import LIGHT_BLUE_IMG from "@/assets/images/light-blue.jpg";
import CASHMERE_IMG from "@/assets/images/cashmere-main-new.jpg";

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

interface OrderConfirmationData {
  items: CartItem[];
  breakdown: BreakdownSnapshot;
  paymentMethod: string;
  orderNumber?: string | number;
  intentId?: string;
}

interface OrderConfirmationPageProps {
  data?: OrderConfirmationData;
  onContinueShopping: () => void;
}

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("de-DE")} EGP`;
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    cod: "Cash on Delivery",
    instapay: "InstaPay",
    card: "Credit / Debit Card",
    wallet: "Mobile Wallet",
    "apple-pay": "Apple Pay",
  };
  return map[method] ?? method;
}

const DEMO_DATA: OrderConfirmationData = {
  items: [
    { id: "demo-1", title: "MOI WAVVY", variantTitle: "Light Blue", quantity: 1, image: LIGHT_BLUE_IMG, price: "899 EGP" },
    { id: "demo-2", title: "MOI VERSA TOP", variantTitle: "Cashmere", quantity: 1, image: CASHMERE_IMG, price: "1,399 EGP" },
  ],
  breakdown: { subtotal: 2298, savings: 0, shippingCost: 0, freeShipping: true },
  paymentMethod: "cod",
  orderNumber: "1042",
};

const SESSION_KEY = "moi_order_confirmation";

function GoldShimmer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(DPR, DPR);

    const GOLD_COLORS = ["#c9a84c", "#e8d5a3", "#f5e9c8", "#d4aa60", "#eddfa9"];
    const TOTAL_DURATION = 3200;

    type Particle = {
      x: number;
      y: number;
      size: number;
      color: string;
      vx: number;
      vy: number;
      alpha: number;
      life: number;
      maxLife: number;
    };

    const particles: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      const maxLife = 1200 + Math.random() * 1600;
      particles.push({
        x: Math.random() * W,
        y: H + Math.random() * 80,
        size: 1.5 + Math.random() * 3,
        color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(0.5 + Math.random() * 1.2),
        alpha: 0,
        life: -Math.random() * 1200,
        maxLife,
      });
    }

    const startTime = performance.now();
    let rafId: number;
    let lastTime = startTime;

    function draw(now: number) {
      if (!ctx) return;
      const elapsed = now - startTime;
      const dt = now - lastTime;
      lastTime = now;

      ctx.clearRect(0, 0, W, H);

      const globalFade = elapsed > TOTAL_DURATION - 800
        ? Math.max(0, 1 - (elapsed - (TOTAL_DURATION - 800)) / 800)
        : 1;

      for (const p of particles) {
        p.life += dt;
        if (p.life < 0) continue;
        const progress = p.life / p.maxLife;
        p.alpha = progress < 0.15
          ? progress / 0.15
          : progress < 0.7
            ? 1
            : 1 - (progress - 0.7) / 0.3;
        p.alpha = Math.max(0, Math.min(1, p.alpha)) * globalFade * 0.82;
        p.x += p.vx;
        p.y += p.vy;

        if (p.life > p.maxLife) {
          p.life = -Math.random() * 600;
          p.x = Math.random() * W;
          p.y = H + 10;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      if (elapsed < TOTAL_DURATION) {
        rafId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 200,
      }}
    />
  );
}

export function OrderConfirmationPage({ data: propData, onContinueShopping }: OrderConfirmationPageProps) {
  const [data, setData] = useState<OrderConfirmationData | null>(propData ?? null);
  const [shopifyOrderNumber, setShopifyOrderNumber] = useState<number | string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const syncCalledRef = useRef(false);

  useEffect(() => {
    if (propData) {
      setData(propData);
      if (propData.orderNumber) setShopifyOrderNumber(propData.orderNumber);
      return;
    }

    // Try the unified session key first (COD / InstaPay / redirect flow)
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as OrderConfirmationData;
        setData(parsed);
        if (parsed.orderNumber) setShopifyOrderNumber(parsed.orderNumber);
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        setData(DEMO_DATA);
        setIsDemo(true);
      }
    } else {
      // Fallback: read Paymob keys directly (card payment coming straight from /payment/success)
      const itemsRaw = sessionStorage.getItem("moi_paymob_items");
      const breakdownRaw = sessionStorage.getItem("moi_paymob_breakdown");
      const methodRaw = sessionStorage.getItem("moi_paymob_payment_method") ?? "card";
      const urlParams = new URLSearchParams(window.location.search);
      const intentIdFromUrl = urlParams.get("intentId") ?? undefined;

      if (itemsRaw || breakdownRaw) {
        try {
          const parsedItems = itemsRaw ? (JSON.parse(itemsRaw) as CartItem[]) : [];
          const parsedBreakdown = breakdownRaw
            ? (JSON.parse(breakdownRaw) as BreakdownSnapshot)
            : { subtotal: 0, savings: 0, shippingCost: 0, freeShipping: false };
          setData({ items: parsedItems, breakdown: parsedBreakdown, paymentMethod: methodRaw, intentId: intentIdFromUrl });
        } catch {
          setData(DEMO_DATA);
          setIsDemo(true);
        }
      } else {
        setData(DEMO_DATA);
        setIsDemo(true);
      }
    }

    // Clear Paymob session keys to prevent checkout re-open
    ["moi_paymob_items", "moi_paymob_order_total", "moi_paymob_breakdown",
     "moi_paymob_intent_id", "moi_checkout_form", "moi_paymob_result"].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  }, [propData]);

  // Preload all product images before revealing the page
  useEffect(() => {
    if (!data) return;
    const srcs = data.items.map((i) => i.image).filter(Boolean) as string[];
    if (srcs.length === 0) {
      setImagesReady(true);
      return;
    }
    let remaining = srcs.length;
    const done = () => { remaining--; if (remaining <= 0) setImagesReady(true); };
    srcs.forEach((src) => {
      const img = new Image();
      img.onload = done;
      img.onerror = done; // don't block on broken images
      img.src = src;
    });
  }, [data]);

  const intentId = data?.intentId ?? new URLSearchParams(window.location.search).get("intentId") ?? null;
  const txnId = new URLSearchParams(window.location.search).get("txnId") ?? undefined;

  // Sync paymob intent
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

  // Poll for order number
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
          const result = await res.json() as { status: string; shopifyOrderNumber?: number | null };
          if (result.shopifyOrderNumber) {
            setShopifyOrderNumber(result.shopifyOrderNumber);
            break;
          }
        } catch { /* keep polling */ }
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [intentId, shopifyOrderNumber]);

  const pageReady = data !== null && imagesReady;

  if (!data) return <LoadingScreen ready={false} />;

  const { items, breakdown, paymentMethod } = data;
  const orderNum = shopifyOrderNumber ?? data.orderNumber;
  const total = fmt((Number(breakdown.subtotal) || 0) - (Number(breakdown.savings) || 0) + (Number(breakdown.shippingCost) || 0));

  const handleContinue = () => {
    ["moi_paymob_result", "moi_paymob_items", "moi_paymob_order_total",
     "moi_paymob_breakdown", "moi_paymob_intent_id", SESSION_KEY].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
    onContinueShopping();
  };

  const handleContactSupport = () => {
    const whatsapp = "https://wa.me/201200520083";
    window.open(whatsapp, "_blank", "noopener,noreferrer");
  };

  const singleItem = items.length === 1;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#faf8f5", overflowX: "hidden" }}>

      <LoadingScreen ready={pageReady} />
      <GoldShimmer />

      {isDemo && (
        <div style={{
          position: "fixed",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(201,168,76,0.15)",
          border: "1px solid rgba(201,168,76,0.4)",
          padding: "6px 16px",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: "10px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(30,24,20,0.6)",
          zIndex: 300,
          whiteSpace: "nowrap",
        }}>
          Demo Preview
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "72px 24px 100px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Sub-label */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "10px",
            letterSpacing: "0.38em",
            textTransform: "uppercase",
            color: "rgba(201,168,76,0.9)",
            marginBottom: 14,
          }}
        >
          Order Confirmed
        </motion.p>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.55 }}
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(36px, 8vw, 52px)",
            fontWeight: 700,
            color: "#1e1814",
            textAlign: "center",
            lineHeight: 1.08,
            marginBottom: 18,
            letterSpacing: "-0.01em",
          }}
        >
          Your Order Has<br />Been Reserved
        </motion.h1>

        {/* Thank you line */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.5 }}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "13px",
            color: "rgba(30,24,20,0.58)",
            lineHeight: 1.8,
            textAlign: "center",
            maxWidth: 320,
            marginBottom: 48,
            letterSpacing: "0.02em",
          }}
        >
          Thank you for choosing Moi. Your piece is being prepared with care.
        </motion.p>

        {/* Product image grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.55 }}
          style={{
            width: "100%",
            marginBottom: 40,
            display: "grid",
            gridTemplateColumns: singleItem ? "1fr" : "1fr 1fr",
            gap: 12,
          }}
        >
          {items.map((item) => (
            <div key={item.id ?? item.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: singleItem ? "3/4" : "2/3",
                  overflow: "hidden",
                  backgroundColor: "rgba(30,24,20,0.06)",
                  position: "relative",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShoppingBag size={28} strokeWidth={1} style={{ color: "rgba(30,24,20,0.2)" }} />
                  </div>
                )}
              </div>
              <div style={{ textAlign: "center", width: "100%" }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#1e1814", fontWeight: 600 }}>
                  {item.title}
                </p>
                {item.variantTitle && (
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(30,24,20,0.46)", marginTop: 2 }}>
                    {item.variantTitle}
                  </p>
                )}
                {item.price && (
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", color: "rgba(30,24,20,0.6)", marginTop: 3 }}>
                    {item.price}
                  </p>
                )}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Order summary card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.5 }}
          style={{
            width: "100%",
            border: "1px solid rgba(30,24,20,0.14)",
            padding: "24px 20px",
            marginBottom: 32,
            backgroundColor: "#faf8f5",
          }}
        >
          {/* Section label */}
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(30,24,20,0.4)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
            Order Summary
          </p>

          {/* Subtotal */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "rgba(30,24,20,0.55)", letterSpacing: "0.06em" }}>Subtotal</span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "#1e1814" }}>{fmt(breakdown.subtotal)}</span>
          </div>

          {/* Savings */}
          {breakdown.savings > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "#2f6644", letterSpacing: "0.06em" }}>Savings</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "#2f6644" }}>−{fmt(breakdown.savings)}</span>
            </div>
          )}

          {/* Shipping */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "rgba(30,24,20,0.55)", letterSpacing: "0.06em" }}>Shipping</span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "#1e1814" }}>{breakdown.freeShipping ? "Free" : fmt(breakdown.shippingCost)}</span>
          </div>

          {/* Payment method */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "rgba(30,24,20,0.55)", letterSpacing: "0.06em" }}>Payment</span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "#1e1814" }}>{paymentLabel(paymentMethod)}</span>
          </div>

          {/* Order number */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "rgba(30,24,20,0.55)", letterSpacing: "0.06em" }}>Order No.</span>
            {orderNum ? (
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#1e1814" }}>
                #{orderNum}
              </span>
            ) : (
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.35)" }}>
                Confirming…
              </span>
            )}
          </div>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 0" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", fontWeight: 700, color: "#1e1814", letterSpacing: "0.18em", textTransform: "uppercase" }}>Total</span>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#1e1814", letterSpacing: "-0.01em" }}>
              {total}
            </span>
          </div>
        </motion.div>

        {/* WhatsApp note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.62, duration: 0.5 }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            backgroundColor: "rgba(30,24,20,0.03)",
            border: "1px solid rgba(30,24,20,0.08)",
            marginBottom: 36,
          }}
        >
          <MessageCircle size={14} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.35)", flexShrink: 0 }} />
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "rgba(30,24,20,0.58)", letterSpacing: "0.04em", lineHeight: 1.65 }}>
            We'll send your order details and tracking update via WhatsApp shortly.
          </p>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}
        >
          {/* Continue Shopping — primary */}
          <button
            onClick={handleContinue}
            style={{
              width: "100%",
              padding: "16px 24px",
              backgroundColor: "#1e1814",
              border: "1px solid #1e1814",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#faf8f5",
              cursor: "pointer",
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.75"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Continue Shopping
          </button>

          {/* Contact Support — secondary text */}
          <button
            onClick={handleContactSupport}
            style={{
              width: "100%",
              padding: "14px 24px",
              backgroundColor: "transparent",
              border: "none",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "10px",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(30,24,20,0.45)",
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(30,24,20,0.75)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(30,24,20,0.45)"; }}
          >
            Contact Support
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
