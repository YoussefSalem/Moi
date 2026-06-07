import { motion } from "framer-motion";
import { X } from "lucide-react";

interface PaymentFailedPageProps {
  onTryAgain: () => void;
  onContinueShopping: () => void;
}

export function PaymentFailedPage({ onTryAgain, onContinueShopping }: PaymentFailedPageProps) {
  return (
    <div
      style={{ minHeight: "100vh", backgroundColor: "#faf8f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 400, width: "100%" }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "rgba(180,60,40,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <X size={28} strokeWidth={1.8} style={{ color: "#b43c28" }} />
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
          Payment Unsuccessful
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
          Payment Failed.
        </h1>

        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "14px",
            color: "rgba(30,24,20,0.62)",
            lineHeight: 1.75,
            maxWidth: 320,
            marginBottom: 40,
          }}
        >
          Unfortunately your payment could not be processed. Please try again or choose a different payment method.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
          <button
            onClick={onTryAgain}
            style={{
              width: "100%",
              padding: "16px 24px",
              backgroundColor: "#1e1814",
              color: "#faf8f5",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.82"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            Try Again
          </button>

          <button
            onClick={onContinueShopping}
            style={{
              width: "100%",
              padding: "15px 24px",
              backgroundColor: "transparent",
              color: "rgba(30,24,20,0.54)",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              border: "1px solid transparent",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1e1814"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(30,24,20,0.54)"; }}
          >
            Continue Shopping
          </button>
        </div>
      </motion.div>
    </div>
  );
}
