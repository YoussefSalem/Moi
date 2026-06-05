import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock, AlertCircle, Loader2 } from "lucide-react";

interface PixelCheckoutPanelProps {
  iframeUrl: string;
  checkoutToken: string;
  onSuccess: (result: { orderNumber: number; total: string; shopifyOrderId: number }) => void;
  onBack: () => void;
}

type PanelStatus = "loading" | "ready" | "processing" | "declined" | "error";

export function PixelCheckoutPanel({
  iframeUrl,
  checkoutToken,
  onSuccess,
  onBack,
}: PixelCheckoutPanelProps) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  // Track iframe load count: 2nd load means Paymob redirected after payment
  const loadCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Poll verify-payment until we find a successful transaction.
  // For the legacy iframe flow, the webhook fires with success=true after 3DS,
  // so polling picks it up quickly. We also poll immediately on the 2nd iframe
  // load (triggered when Paymob redirects after payment).
  useEffect(() => {
    if (status === "loading") return;
    if (status === "processing" || status === "declined" || status === "error") return;

    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 10 * 60 * 1000;

    async function poll() {
      if (stopped || !mountedRef.current || Date.now() > deadline) return;
      if (completedRef.current) return;

      try {
        const res = await fetch("/api/paymob/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutToken }),
        });
        if (!mountedRef.current || stopped) return;

        if (res.ok) {
          const data = await res.json() as {
            success?: boolean;
            orderNumber?: number;
            total?: string;
            shopifyOrderId?: number;
          };
          if (data.success && data.orderNumber && data.total && data.shopifyOrderId) {
            if (!completedRef.current) {
              completedRef.current = true;
              setStatus("processing");
              onSuccess({ orderNumber: data.orderNumber, total: data.total, shopifyOrderId: data.shopifyOrderId });
            }
            return;
          }
        }
      } catch { /* network glitch — retry */ }

      if (!stopped && mountedRef.current) {
        timeoutId = setTimeout(poll, 5000);
      }
    }

    // First check after 8 s — enough time for user to start filling the form.
    // Subsequent checks every 5 s.
    timeoutId = setTimeout(poll, 8000);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, checkoutToken]);

  function handleIframeLoad() {
    loadCountRef.current += 1;
    if (!mountedRef.current) return;

    if (loadCountRef.current === 1) {
      // First load — the payment form is now visible
      setStatus("ready");
    } else {
      // Second load — Paymob redirected after payment attempt;
      // show processing overlay and immediately call verify-payment
      if (completedRef.current) return;
      setStatus("processing");
      void (async () => {
        try {
          const res = await fetch("/api/paymob/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkoutToken }),
          });
          if (!mountedRef.current) return;
          if (res.ok) {
            const data = await res.json() as {
              success?: boolean; orderNumber?: number; total?: string; shopifyOrderId?: number; error?: string;
            };
            if (data.success && data.orderNumber && data.total && data.shopifyOrderId) {
              if (!completedRef.current) {
                completedRef.current = true;
                onSuccess({ orderNumber: data.orderNumber, total: data.total, shopifyOrderId: data.shopifyOrderId });
              }
              return;
            }
          }
          if (res.status === 402) {
            setStatus("declined");
            setErrorMsg("Your payment was declined. Please check your card details or try a different card.");
          } else {
            // Not yet completed — fall back to polling overlay
            setStatus("ready");
          }
        } catch {
          if (mountedRef.current) setStatus("ready");
        }
      })();
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
      <button
        onClick={onBack}
        disabled={status === "processing"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "10px",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: status === "processing" ? "rgba(30,24,20,0.3)" : "rgba(30,24,20,0.55)",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          background: "none",
          border: "none",
          cursor: status === "processing" ? "not-allowed" : "pointer",
          padding: "0 0 24px 0",
          transition: "color 0.2s",
        }}
      >
        <ArrowLeft size={12} />
        Back to Details
      </button>

      <div
        style={{
          borderTop: "2px solid #1e1814",
          paddingTop: "24px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Lock size={13} style={{ color: "#1e1814" }} />
        <h2
          style={{
            fontSize: "10px",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "#1e1814",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
          }}
        >
          Secure Card Payment
        </h2>
      </div>

      <div style={{ position: "relative" }}>
        <AnimatePresence>
          {status === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                minHeight: 440,
                color: "rgba(30,24,20,0.45)",
                backgroundColor: "#faf8f5",
                zIndex: 2,
              }}
            >
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: "12px", letterSpacing: "0.1em", fontFamily: "'Montserrat', sans-serif" }}>
                Loading payment form…
              </p>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </motion.div>
          )}

          {status === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                minHeight: 440,
                backgroundColor: "rgba(250,248,245,0.94)",
                zIndex: 2,
              }}
            >
              <Loader2 size={28} style={{ color: "#1e1814", animation: "spin 1s linear infinite" }} />
              <p
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  color: "#1e1814",
                }}
              >
                Confirming Payment…
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {(status === "declined" || status === "error") && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "14px 16px",
              backgroundColor: "rgba(192,57,43,0.05)",
              border: "1px solid rgba(192,57,43,0.2)",
              marginBottom: "16px",
            }}
          >
            <AlertCircle size={14} style={{ color: "#c0392b", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.5 }}>
              {errorMsg}
            </p>
          </motion.div>
        )}

        <iframe
          src={iframeUrl}
          onLoad={handleIframeLoad}
          style={{
            width: "100%",
            height: 620,
            border: "none",
            display: "block",
            opacity: status === "processing" ? 0 : 1,
            transition: "opacity 0.3s",
          }}
          title="Secure card payment"
          allow="payment"
        />
      </div>

      <p
        style={{
          marginTop: "16px",
          fontSize: "10px",
          color: "rgba(30,24,20,0.35)",
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: "0.05em",
          textAlign: "center",
        }}
      >
        Secured by Paymob · Your card details are encrypted and never stored on our servers
      </p>
    </div>
  );
}
