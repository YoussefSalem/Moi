import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, MessageCircle } from "lucide-react";

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

function reassuranceMessage(method: string): string {
  switch (method) {
    case "cod":
      return "Your order is confirmed. Pay cash when it arrives at your door — no card needed.";
    case "instapay":
      return "We've received your payment screenshot. Your order will be confirmed once we verify it.";
    case "card":
    case "wallet":
      return "Your payment is confirmed and your order is being prepared.";
    case "apple-pay":
      return "Your Apple Pay payment is confirmed and your order is being prepared.";
    default:
      return "Your order is confirmed. Our team will be in touch shortly.";
  }
}


const SESSION_KEY = "moi_order_confirmation";
const ACTIVE_SESSION_KEY = "moi_order_confirmed_active";

const EMPTY_BREAKDOWN: BreakdownSnapshot = { subtotal: 0, savings: 0, shippingCost: 0, freeShipping: false };

// Defensive: any writer (COD/Apple Pay/InstaPay/card) may persist a partial
// snapshot. Normalise it so the render never dereferences a missing breakdown.
function normalizeConfirmation(d: Partial<OrderConfirmationData> | null | undefined): OrderConfirmationData {
  return {
    items: Array.isArray(d?.items) ? d!.items : [],
    breakdown: d?.breakdown && typeof d.breakdown === "object"
      ? { ...EMPTY_BREAKDOWN, ...d.breakdown }
      : EMPTY_BREAKDOWN,
    paymentMethod: typeof d?.paymentMethod === "string" ? d.paymentMethod : "card",
    orderNumber: d?.orderNumber,
    intentId: d?.intentId,
  };
}

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

    type Particle = { x: number; y: number; size: number; color: string; vx: number; vy: number; alpha: number; life: number; maxLife: number };
    const particles: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      const maxLife = 1200 + Math.random() * 1600;
      particles.push({ x: Math.random() * W, y: H + Math.random() * 80, size: 1.5 + Math.random() * 3, color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)], vx: (Math.random() - 0.5) * 0.6, vy: -(0.5 + Math.random() * 1.2), alpha: 0, life: -Math.random() * 1200, maxLife });
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
      const globalFade = elapsed > TOTAL_DURATION - 800 ? Math.max(0, 1 - (elapsed - (TOTAL_DURATION - 800)) / 800) : 1;
      for (const p of particles) {
        p.life += dt;
        if (p.life < 0) continue;
        const progress = p.life / p.maxLife;
        p.alpha = progress < 0.15 ? progress / 0.15 : progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
        p.alpha = Math.max(0, Math.min(1, p.alpha)) * globalFade * 0.82;
        p.x += p.vx; p.y += p.vy;
        if (p.life > p.maxLife) { p.life = -Math.random() * 600; p.x = Math.random() * W; p.y = H + 10; }
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
      }
      if (elapsed < TOTAL_DURATION) { rafId = requestAnimationFrame(draw); } else { ctx.clearRect(0, 0, W, H); }
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200 }} />;
}

function readSessionData(propData?: OrderConfirmationData): OrderConfirmationData | null {
  if (propData) return propData;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OrderConfirmationData>;
      const d = normalizeConfirmation(parsed);
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(d));
      return d;
    }
    const itemsRaw = sessionStorage.getItem("moi_paymob_items");
    const breakdownRaw = sessionStorage.getItem("moi_paymob_breakdown");
    if (itemsRaw || breakdownRaw) {
      const methodRaw = sessionStorage.getItem("moi_paymob_payment_method") ?? "card";
      const intentIdFromUrl = new URLSearchParams(window.location.search).get("intentId") ?? undefined;
      const parsedItems = itemsRaw ? (JSON.parse(itemsRaw) as CartItem[]) : [];
      const parsedBreakdown = breakdownRaw
        ? (JSON.parse(breakdownRaw) as BreakdownSnapshot)
        : { subtotal: 0, savings: 0, shippingCost: 0, freeShipping: false };
      const d = normalizeConfirmation({ items: parsedItems, breakdown: parsedBreakdown, paymentMethod: methodRaw, intentId: intentIdFromUrl });
      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(d));
      return d;
    }
    const activeRaw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (activeRaw) {
      return normalizeConfirmation(JSON.parse(activeRaw) as Partial<OrderConfirmationData>);
    }
  } catch { /* ignore */ }
  return null;
}

export function OrderConfirmationPage({ data: propData, onContinueShopping }: OrderConfirmationPageProps) {
  const [data, setData] = useState<OrderConfirmationData | null>(() => readSessionData(propData));
  const [shopifyOrderNumber, setShopifyOrderNumber] = useState<number | string | null>(
    () => propData?.orderNumber ?? null
  );
  const syncCalledRef = useRef(false);
  const redirectedRef = useRef(false);

  // Sync orderNumber from data on first render
  useEffect(() => {
    if (data?.orderNumber && !shopifyOrderNumber) {
      setShopifyOrderNumber(data.orderNumber);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If no session data found, redirect to home on next tick
  useEffect(() => {
    if (!data && !redirectedRef.current) {
      redirectedRef.current = true;
      onContinueShopping();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If propData changes (rare), sync it in
  useEffect(() => {
    if (!propData) return;
    setData(propData);
    if (propData.orderNumber) setShopifyOrderNumber(propData.orderNumber);
  }, [propData]);

  // Clean up legacy sessionStorage keys
  useEffect(() => {
    ["moi_paymob_items", "moi_paymob_order_total", "moi_paymob_breakdown",
     "moi_paymob_intent_id", "moi_checkout_form", "moi_paymob_result",
     "moi_paymob_payment_method"].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  }, []);

  const intentId = data?.intentId ?? new URLSearchParams(window.location.search).get("intentId") ?? null;
  const txnId = new URLSearchParams(window.location.search).get("txnId") ?? undefined;

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
          const result = await res.json() as { status: string; shopifyOrderNumber?: number | null };
          if (result.shopifyOrderNumber) {
            setShopifyOrderNumber(result.shopifyOrderNumber);
            // Persist to active session so a refresh restores the order number
            // immediately without re-polling.
            try {
              const activeRaw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
              if (activeRaw) {
                const parsed = JSON.parse(activeRaw) as Partial<OrderConfirmationData>;
                sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
                  ...parsed,
                  orderNumber: result.shopifyOrderNumber,
                }));
              }
            } catch { /* ignore */ }
            break;
          }
        } catch { /* keep polling */ }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [intentId, shopifyOrderNumber]);

  if (!data) return null;

  const { items, breakdown, paymentMethod } = data;
  const orderNum = shopifyOrderNumber ?? data.orderNumber;
  const total = fmt((Number(breakdown.subtotal) || 0) - (Number(breakdown.savings) || 0) + (Number(breakdown.shippingCost) || 0));
  // Cap at 2 images in the portrait grid; show "+N more" label if needed
  const gridItems = items.slice(0, 2);
  const hiddenCount = items.length - gridItems.length;
  const isSingle = gridItems.length === 1;

  const handleContinue = () => {
    ["moi_paymob_result", "moi_paymob_items", "moi_paymob_order_total",
     "moi_paymob_breakdown", "moi_paymob_intent_id", SESSION_KEY, ACTIVE_SESSION_KEY].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
    // Scroll the home page to the hero while the overlay fades out (350ms).
    window.scrollTo({ top: 0, behavior: "smooth" });
    onContinueShopping();
  };

  const handleContactSupport = () => {
    window.open("https://wa.me/201200520083", "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "#faf8f5", overflowX: "hidden", overflowY: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
      <GoldShimmer />


      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 520,
          width: "100%",
          margin: "0 auto",
          padding: "clamp(10px,2vh,28px) 20px clamp(16px,3vh,28px)",
          overflow: "visible",
        }}
      >
        {/* ── HEADING ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ textAlign: "center", flexShrink: 0, marginBottom: "clamp(8px,1.5vh,16px)" }}
        >
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.42em", textTransform: "uppercase", color: "rgba(201,168,76,0.9)", marginBottom: "clamp(3px,0.6vh,7px)" }}>
            Order Confirmed
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(24px,5vw,38px)", fontWeight: 700, color: "#1e1814", lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: "clamp(4px,0.8vh,10px)" }}>
            Your Order Has Been Reserved
          </h1>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(10px,1.5vw,11px)", color: "rgba(30,24,20,0.52)", lineHeight: 1.65, maxWidth: 300, margin: "0 auto", letterSpacing: "0.02em" }}>
            {reassuranceMessage(paymentMethod)}
          </p>
        </motion.div>

        {/* ── LARGE PORTRAIT IMAGES ── */}
        {gridItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            style={{ flexShrink: 0, marginBottom: "clamp(4px,0.8vh,10px)" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSingle ? "1fr" : "1fr 1fr",
                gap: 8,
              }}
            >
              {gridItems.map((item) => (
                <div key={item.id ?? item.title} style={{ display: "flex", flexDirection: "column" }}>
                  {/* Portrait image */}
                  <div
                    style={{
                      width: "100%",
                      height: isSingle ? "clamp(240px,44vh,440px)" : "clamp(160px,30vh,300px)",
                      overflow: "hidden",
                      backgroundColor: "rgba(30,24,20,0.07)",
                      flexShrink: 0,
                    }}
                  >
                    {item.image
                      ? <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="eager" decoding="async" />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={22} strokeWidth={1} style={{ color: "rgba(30,24,20,0.2)" }} /></div>
                    }
                  </div>
                  {/* Caption */}
                  <div style={{ textAlign: "center", paddingTop: "clamp(5px,0.8vh,8px)" }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#1e1814", fontWeight: 600 }}>
                      {item.title}
                    </p>
                    {item.variantTitle && (
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(30,24,20,0.42)", marginTop: 2 }}>
                        {item.variantTitle}
                      </p>
                    )}
                    {item.price && (
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: "rgba(30,24,20,0.6)", marginTop: 2 }}>
                        {item.price}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hiddenCount > 0 && (
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(30,24,20,0.38)", paddingTop: 6, textAlign: "center" }}>
                +{hiddenCount} more item{hiddenCount > 1 ? "s" : ""}
              </p>
            )}
          </motion.div>
        )}

        {/* ── ORDER SUMMARY ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.38 }}
          style={{ flexShrink: 0, border: "1px solid rgba(30,24,20,0.12)", padding: "clamp(8px,1.4vh,14px) 14px", marginBottom: "clamp(6px,1vh,12px)", backgroundColor: "#faf8f5" }}
        >
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "8px", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(30,24,20,0.38)", marginBottom: "clamp(5px,0.8vh,8px)", paddingBottom: "clamp(4px,0.7vh,7px)", borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
            Order Summary
          </p>

          {[
            { label: "Subtotal", value: fmt(breakdown.subtotal) },
            ...(breakdown.savings > 0 ? [{ label: "Savings", value: `−${fmt(breakdown.savings)}`, green: true }] : []),
            { label: "Shipping", value: breakdown.freeShipping ? "Free" : fmt(breakdown.shippingCost) },
            { label: "Payment", value: paymentLabel(paymentMethod) },
          ].map(({ label, value, green }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "clamp(3px,0.5vh,5px) 0", borderBottom: "1px solid rgba(30,24,20,0.05)" }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: green ? "#2f6644" : "rgba(30,24,20,0.52)", letterSpacing: "0.05em" }}>{label}</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: green ? "#2f6644" : "#1e1814" }}>{value}</span>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "clamp(3px,0.5vh,5px) 0", borderBottom: "1px solid rgba(30,24,20,0.05)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: "rgba(30,24,20,0.52)", letterSpacing: "0.05em" }}>Order No.</span>
            {orderNum
              ? <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#1e1814" }}>#{orderNum}</span>
              : <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.32)" }}>Confirming…</span>
            }
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: "clamp(7px,1vh,10px)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 700, color: "#1e1814", letterSpacing: "0.18em", textTransform: "uppercase" }}>Total</span>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(20px,3.2vw,24px)", fontWeight: 700, color: "#1e1814" }}>{total}</span>
          </div>
        </motion.div>

        {/* ── WHATSAPP NOTE ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.38 }}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 9, padding: "clamp(7px,1vh,11px) 12px", backgroundColor: "rgba(30,24,20,0.03)", border: "1px solid rgba(30,24,20,0.07)", marginBottom: "clamp(6px,1.2vh,14px)" }}
        >
          <MessageCircle size={12} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.32)", flexShrink: 0 }} />
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: "rgba(30,24,20,0.55)", letterSpacing: "0.03em", lineHeight: 1.55 }}>
            We'll send your order details and tracking update via WhatsApp shortly.
          </p>
        </motion.div>

        {/* ── BUTTONS ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.38 }}
          style={{ flexShrink: 0, marginTop: "clamp(10px,2vh,20px)", display: "flex", flexDirection: "column", gap: "clamp(4px,0.7vh,8px)" }}
        >
          <button
            onClick={handleContinue}
            style={{ width: "100%", padding: "clamp(11px,1.6vh,15px) 24px", backgroundColor: "#1e1814", border: "1px solid #1e1814", fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.28em", textTransform: "uppercase", color: "#faf8f5", cursor: "pointer", transition: "opacity 0.2s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.75"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Continue Shopping
          </button>
          <button
            onClick={handleContactSupport}
            style={{ width: "100%", padding: "clamp(7px,1vh,11px) 24px", backgroundColor: "transparent", border: "none", fontFamily: "'Montserrat', sans-serif", fontSize: "9px", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.4)", cursor: "pointer", transition: "color 0.2s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(30,24,20,0.7)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(30,24,20,0.4)"; }}
          >
            Contact Support
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
