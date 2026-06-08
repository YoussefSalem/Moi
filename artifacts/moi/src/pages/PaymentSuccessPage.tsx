import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface PaymentSuccessPageProps {
  intentId: string;
  txnId?: string;
  onContinueShopping: () => void;
}

export function PaymentSuccessPage({ intentId, txnId, onContinueShopping }: PaymentSuccessPageProps) {
  const [countdown, setCountdown] = useState(10);
  const syncCalledRef = useRef(false);

  // Sync the Paymob intent so the order is created in Shopify
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

  // 10-second countdown then auto-redirect
  useEffect(() => {
    if (countdown <= 0) {
      onContinueShopping();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onContinueShopping]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#faf8f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 400, width: "100%" }}
      >
        {/* Checkmark */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "rgba(201,168,76,0.12)",
            border: "1.5px solid rgba(201,168,76,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <motion.path
              d="M6 13.5L10.5 18L20 9"
              stroke="#c9a84c"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
            />
          </svg>
        </motion.div>

        {/* Heading */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "10px",
            letterSpacing: "0.38em",
            textTransform: "uppercase",
            color: "rgba(201,168,76,0.9)",
            marginBottom: 12,
          }}
        >
          Payment Confirmed
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(34px, 8vw, 48px)",
            fontWeight: 700,
            color: "#1e1814",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 16,
            letterSpacing: "-0.01em",
          }}
        >
          Thank You
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38, duration: 0.45 }}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "13px",
            color: "rgba(30,24,20,0.52)",
            lineHeight: 1.8,
            textAlign: "center",
            maxWidth: 300,
            marginBottom: 44,
            letterSpacing: "0.02em",
          }}
        >
          Your payment went through. We're preparing your order now.
        </motion.p>

        {/* Awesome button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.45 }}
          onClick={onContinueShopping}
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "17px 24px",
            backgroundColor: "#1e1814",
            border: "1px solid #1e1814",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#faf8f5",
            cursor: "pointer",
            transition: "opacity 0.2s ease",
            marginBottom: 18,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.75"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Awesome!
        </motion.button>

        {/* Countdown */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: "rgba(30,24,20,0.32)",
          }}
        >
          Redirecting to your order in {countdown}s…
        </motion.p>
      </motion.div>
    </div>
  );
}
