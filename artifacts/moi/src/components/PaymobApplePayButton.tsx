import { useEffect, useRef, useState } from "react";

interface PaymobApplePayButtonProps {
  clientSecret: string;
  publicKey: string;
  intentId: string;
  onSuccess: (txnId: string) => void;
  onFail: () => void;
}

declare global {
  interface Window {
    Paymob?: {
      init: (options: {
        publicKey: string;
        clientSecret: string;
        onPaymentSuccess?: (response: { id?: string | number; [key: string]: unknown }) => void;
        onPaymentFail?: (response: { id?: string | number; [key: string]: unknown }) => void;
        onPaymentPending?: (response: { id?: string | number; [key: string]: unknown }) => void;
        onError?: (error: unknown) => void;
      }) => void;
    };
  }
}

const PAYMOB_SDK_URL = "https://accept.paymob.com/v2/fawry/paymob.js";

function loadPaymobSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Paymob) { resolve(); return; }
    const existing = document.querySelector(`script[src="${PAYMOB_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Paymob SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = PAYMOB_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Paymob SDK failed to load"));
    document.head.appendChild(script);
  });
}

export function PaymobApplePayButton({ clientSecret, publicKey, onSuccess, onFail }: PaymobApplePayButtonProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadPaymobSdk();
        if (cancelled) return;
        if (!window.Paymob) {
          setSdkError("Apple Pay is not available on this device.");
          return;
        }
        if (initializedRef.current) return;
        initializedRef.current = true;

        window.Paymob.init({
          publicKey,
          clientSecret,
          onPaymentSuccess: (response) => {
            const txnId = String(response.id ?? "");
            onSuccess(txnId);
          },
          onPaymentFail: () => {
            onFail();
          },
          onPaymentPending: () => {
          },
          onError: () => {
            setSdkError("Apple Pay encountered an error. Please try another payment method.");
          },
        });

        setSdkReady(true);
      } catch {
        if (!cancelled) {
          setSdkError("Could not load Apple Pay. Please try another payment method.");
        }
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [clientSecret, publicKey, onSuccess, onFail]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {sdkError ? (
        <p style={{
          fontSize: 13,
          color: "rgba(30,24,20,0.6)",
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: "0.04em",
          textAlign: "center",
          maxWidth: 320,
        }}>
          {sdkError}
        </p>
      ) : !sdkReady ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 20, height: 20,
            border: "1.5px solid rgba(30,24,20,0.22)",
            borderTopColor: "#1e1814",
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }} />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
            Loading Apple Pay…
          </span>
        </div>
      ) : null}

      {/* Paymob SDK mounts the Apple Pay button here via #paymob-apple-pay-container */}
      <div
        id="paymob-apple-pay-container"
        style={{
          width: "100%",
          maxWidth: 360,
          minHeight: sdkReady ? 52 : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />

      {sdkReady && (
        <p style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          color: "rgba(30,24,20,0.38)",
          fontFamily: "'Montserrat', sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Secured by Apple Pay · Touch ID / Face ID
        </p>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
