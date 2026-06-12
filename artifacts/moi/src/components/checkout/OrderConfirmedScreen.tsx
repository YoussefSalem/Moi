import { motion } from "framer-motion";
import type { OrderResult, OrderBreakdown } from "./types";

interface OrderConfirmedScreenProps {
  orderResult: OrderResult;
  onDone: () => void;
  items: NonNullable<OrderResult["items"]>;
  breakdown: OrderBreakdown;
  title?: string;
  subtitle?: string;
  message?: React.ReactNode;
  note?: string;
  orderNumber?: string | number | null;
}

export function OrderConfirmedScreen({
  orderResult,
  onDone,
  items,
  breakdown,
  title = "Order Confirmed.",
  subtitle,
  message,
  note,
  orderNumber,
}: OrderConfirmedScreenProps) {
  const displayOrderNumber = orderNumber ?? orderResult.shopifyOrderNumber;
  const visibleItems = items.slice(0, 3);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100dvh - 72px)",
        maxWidth: 480,
        margin: "0 auto",
        padding: "clamp(16px,3vh,36px) 24px clamp(12px,2vh,24px)",
      }}
    >
      <div style={{ textAlign: "center", flexShrink: 0, marginBottom: "clamp(10px,1.8vh,20px)" }}>
        {subtitle && (
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(201,168,76,0.9)", marginBottom: 8 }}>
            {subtitle}
          </p>
        )}
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(26px,5.5vw,38px)", fontWeight: 700, color: "#1e1814", lineHeight: 1.1, marginBottom: 8 }}>
          {title}
        </h1>
        {message && (
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(10px,1.6vw,12px)", color: "rgba(30,24,20,0.58)", lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
            {message}
          </p>
        )}
      </div>

      {visibleItems.length > 0 && (
        <div style={{ flexShrink: 0, marginBottom: "clamp(8px,1.4vh,16px)", borderTop: "1px solid rgba(30,24,20,0.08)", borderBottom: "1px solid rgba(30,24,20,0.08)" }}>
          {visibleItems.map((item, idx) => (
            <div key={item.id ?? `${item.title}-${item.quantity}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "clamp(6px,1vh,10px) 0", borderBottom: idx < visibleItems.length - 1 ? "1px solid rgba(30,24,20,0.06)" : undefined }}>
              <div style={{ width: 46, aspectRatio: "3/4", flexShrink: 0, overflow: "hidden", backgroundColor: "rgba(30,24,20,0.07)" }}>
                {item.image && <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="eager" decoding="async" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#1e1814", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                {item.variantTitle && <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(30,24,20,0.42)", marginTop: 2 }}>{item.variantTitle}</p>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", color: "rgba(30,24,20,0.42)" }}>×{item.quantity}</p>
                {item.price && <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11px", color: "#1e1814", fontWeight: 600, marginTop: 1 }}>{item.price}</p>}
              </div>
            </div>
          ))}
          {hiddenCount > 0 && (
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(30,24,20,0.38)", padding: "6px 0", textAlign: "center" }}>
              +{hiddenCount} more item{hiddenCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      <div style={{ flexShrink: 0, border: "1px solid rgba(30,24,20,0.12)", padding: "clamp(10px,1.6vh,16px) 14px", marginBottom: "clamp(8px,1.2vh,14px)" }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "8px", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(30,24,20,0.38)", marginBottom: 8, paddingBottom: 7, borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
          Order Summary
        </p>
        {[
          { label: "Subtotal", value: breakdown.fmt(breakdown.subtotal) },
          ...(breakdown.savings > 0 ? [{ label: "Savings", value: `−${breakdown.fmt(breakdown.savings)}`, green: true }] : []),
          { label: "Shipping", value: breakdown.freeShipping ? "Free" : breakdown.fmt(breakdown.shippingCost) },
        ].map(({ label, value, green }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "clamp(3px,0.5vh,5px) 0", borderBottom: "1px solid rgba(30,24,20,0.05)" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: green ? "#2f6644" : "rgba(30,24,20,0.52)", letterSpacing: "0.05em" }}>{label}</span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: green ? "#2f6644" : "#1e1814" }}>{value}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "clamp(3px,0.55vh,5px) 0", borderBottom: "1px solid rgba(30,24,20,0.05)" }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: "rgba(30,24,20,0.52)", letterSpacing: "0.05em" }}>Order No.</span>
          {displayOrderNumber
            ? <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "16px", fontWeight: 700, color: "#1e1814" }}>#{displayOrderNumber}</span>
            : <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.32)" }}>Confirming…</span>
          }
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: "clamp(7px,1vh,10px)" }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 700, color: "#1e1814", letterSpacing: "0.18em", textTransform: "uppercase" }}>Total</span>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(20px,3.5vw,24px)", fontWeight: 700, color: "#1e1814" }}>{breakdown.fmt(breakdown.total ?? Math.max(0, (breakdown.subtotal || 0) - (breakdown.savings || 0) + (breakdown.shippingCost || 0)))}</span>
        </div>
      </div>

      {note && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 9, padding: "clamp(8px,1.2vh,12px) 12px", backgroundColor: "rgba(30,24,20,0.03)", border: "1px solid rgba(30,24,20,0.07)", marginBottom: "clamp(8px,1.4vh,16px)" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", color: "rgba(30,24,20,0.55)", letterSpacing: "0.03em", lineHeight: 1.6 }}>{note}</p>
        </div>
      )}

      <div style={{ marginTop: "auto", flexShrink: 0 }}>
        <button
          onClick={onDone}
          className="w-full py-4 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          Continue Shopping
        </button>
      </div>
    </motion.div>
  );
}
