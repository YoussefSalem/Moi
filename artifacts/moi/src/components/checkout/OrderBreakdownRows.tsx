import type { OrderBreakdown } from "./types";

export function OrderBreakdownRows({ breakdown }: { breakdown: OrderBreakdown }) {
  const { subtotal, savings, shippingCost, freeShipping, fmt, total } = breakdown;
  const computedTotal = total ?? (subtotal - savings + shippingCost);
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
  const labelStyle: React.CSSProperties = { fontSize: "12px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" };
  const valueStyle: React.CSSProperties = { fontSize: "12px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 };
  const totalLabelStyle: React.CSSProperties = { fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.08em" };
  const totalValueStyle: React.CSSProperties = { fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 };
  return (
    <div style={{ border: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.02)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {subtotal > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Subtotal</span>
          <span style={valueStyle}>{fmt(subtotal)}</span>
        </div>
      )}
      {savings > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Discount</span>
          <span style={{ ...valueStyle, color: "#5a7a5a" }}>−{fmt(savings)}</span>
        </div>
      )}
      <div style={rowStyle}>
        <span style={labelStyle}>Shipping</span>
        {freeShipping ? (
          <span style={{ ...valueStyle, color: "rgba(30,24,20,0.5)", fontStyle: "italic" }}>Complimentary</span>
        ) : (
          <span style={valueStyle}>{fmt(shippingCost)}</span>
        )}
      </div>
      <div style={{ ...rowStyle, borderTop: "1px solid rgba(30,24,20,0.12)", paddingTop: 8, marginTop: 2 }}>
        <span style={totalLabelStyle}>Total</span>
        <span style={totalValueStyle}>{fmt(computedTotal)}</span>
      </div>
    </div>
  );
}
