import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock, AlertCircle, Loader2 } from "lucide-react";

interface PixelCheckoutPanelProps {
  publicKey: string;
  clientSecret: string;
  checkoutToken: string;
  onSuccess: (result: { orderNumber: number; total: string; shopifyOrderId: number }) => void;
  onBack: () => void;
}

type PanelStatus = "loading" | "ready" | "processing" | "declined" | "error";

declare global {
  interface Window {
    Pixel: new (config: Record<string, unknown>) => unknown;
  }
}

const PIXEL_CSS_1 = "https://cdn.jsdelivr.net/npm/paymob-pixel@latest/styles.css";
const PIXEL_CSS_2 = "https://cdn.jsdelivr.net/npm/paymob-pixel@latest/main.css";
const PIXEL_JS = "https://cdn.jsdelivr.net/npm/paymob-pixel@latest/main.js";
const ELEMENT_ID = "moi-paymob-pixel-container";

export function PixelCheckoutPanel({
  publicKey,
  clientSecret,
  checkoutToken,
  onSuccess,
  onBack,
}: PixelCheckoutPanelProps) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;

    const addedLinks: HTMLLinkElement[] = [];
    let addedScript: HTMLScriptElement | null = null;

    function addLink(href: string) {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      addedLinks.push(link);
    }

    function initPixel() {
      if (!mountedRef.current) return;
      if (!window.Pixel) {
        setTimeout(() => {
          if (mountedRef.current && window.Pixel) initPixel();
          else if (mountedRef.current) {
            setStatus("error");
            setErrorMsg("Payment widget could not be loaded. Please refresh and try again.");
          }
        }, 300);
        return;
      }

      initializedRef.current = true;

      try {
        new window.Pixel({
          publicKey,
          clientSecret,
          paymentMethods: ["card"],
          elementId: ELEMENT_ID,
          disablePay: false,
          showSaveCard: false,
          forceSaveCard: false,

          cardValidationChanged: (isValid: boolean) => {
            if (!mountedRef.current) return;
            if (isValid && status !== "processing") setStatus("ready");
          },

          afterPaymentComplete: async (_response: Record<string, unknown>) => {
            if (!mountedRef.current) return;

            // Always call verify-payment regardless of response.success.
            // Integration 5658307 (Shopify-type) fires afterPaymentComplete
            // with success:false because its Shopify callback fails — even
            // though the card WAS charged. verify-payment checks Paymob
            // directly and decides whether a real transaction exists.
            setStatus("processing");

            try {
              const res = await fetch("/api/paymob/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checkoutToken }),
              });

              const data = await res.json() as {
                success?: boolean;
                orderNumber?: number;
                total?: string;
                shopifyOrderId?: number;
                error?: string;
              };

              if (!mountedRef.current) return;

              if (res.ok && data.success && data.orderNumber && data.total && data.shopifyOrderId) {
                onSuccess({
                  orderNumber: data.orderNumber,
                  total: data.total,
                  shopifyOrderId: data.shopifyOrderId,
                });
              } else if (res.status === 402) {
                // Genuine decline — no transaction found at all
                setStatus("declined");
                setErrorMsg("Your payment was declined. Please check your card details or try a different card.");
              } else {
                setStatus("error");
                setErrorMsg(data.error ?? "Could not confirm your payment. Please contact support.");
              }
            } catch {
              if (!mountedRef.current) return;
              setStatus("error");
              setErrorMsg("Network error while confirming payment. Please contact support with your order details.");
            }
          },

          onPaymentCancel: () => {
            if (!mountedRef.current) return;
            setStatus("ready");
          },

          customStyle: {
            Font_Family: "Montserrat",
            Font_Size_Label: "10",
            Font_Size_Input_Fields: "14",
            Font_Size_Payment_Button: "11",
            Font_Weight_Label: 600,
            Font_Weight_Input_Fields: 400,
            Font_Weight_Payment_Button: 700,
            Color_Container: "#faf8f5",
            Color_Border_Input_Fields: "rgba(30,24,20,0.22)",
            Color_Border_Payment_Button: "#1e1814",
            Radius_Border: "0",
            Color_Disabled: "rgba(30,24,20,0.3)",
            Color_Error: "#c0392b",
            Color_Primary: "#1e1814",
            Color_Input_Fields: "#faf8f5",
            Text_Color_For_Label: "rgba(30,24,20,0.55)",
            Text_Color_For_Payment_Button: "#faf8f5",
            Text_Color_For_Input_Fields: "#1e1814",
            Color_For_Text_Placeholder: "rgba(30,24,20,0.35)",
            Width_of_Container: "100%",
            Vertical_Padding: "24",
            Vertical_Spacing_between_components: "16",
            Container_Padding: "0",
          },
        });

        if (mountedRef.current) setStatus("ready");
      } catch (err) {
        if (mountedRef.current) {
          setStatus("error");
          setErrorMsg("Payment widget failed to initialize. Please refresh and try again.");
        }
        console.error("Pixel init error:", err);
      }
    }

    addLink(PIXEL_CSS_1);
    addLink(PIXEL_CSS_2);

    if (window.Pixel) {
      initPixel();
    } else {
      const existing = document.querySelector(`script[src="${PIXEL_JS}"]`);
      if (existing) {
        existing.addEventListener("load", initPixel);
      } else {
        const script = document.createElement("script");
        script.src = PIXEL_JS;
        script.type = "module";
        script.addEventListener("load", initPixel);
        script.addEventListener("error", () => {
          if (mountedRef.current) {
            setStatus("error");
            setErrorMsg("Could not load payment widget. Please check your connection and refresh.");
          }
        });
        document.body.appendChild(script);
        addedScript = script;
      }
    }

    return () => {
      addedLinks.forEach((l) => l.parentNode?.removeChild(l));
      if (addedScript) addedScript.parentNode?.removeChild(addedScript);
    };
  }, [publicKey, clientSecret, checkoutToken, onSuccess]);

  const isDeclinedOrError = status === "declined" || status === "error";

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

      <AnimatePresence mode="wait">
        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "48px 0",
              color: "rgba(30,24,20,0.45)",
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
              backgroundColor: "rgba(250,248,245,0.92)",
              zIndex: 10,
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

      {isDeclinedOrError && (
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

      <div
        style={{
          position: "relative",
          opacity: status === "processing" ? 0.4 : 1,
          transition: "opacity 0.3s",
          backgroundColor: "#faf8f5",
        }}
      >
        <div id={ELEMENT_ID} />
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
