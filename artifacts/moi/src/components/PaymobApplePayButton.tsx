import { useEffect, useRef, useState } from "react";

interface PaymobApplePayButtonProps {
  clientSecret: string;
  publicKey: string;
  intentId: string;
  onSuccess: (txnId: string) => void;
  onFail: () => void;
}

interface PixelOptions {
  publicKey: string;
  clientSecret: string;
  paymentMethods: string[];
  elementId: string;
  disablePay?: boolean;
  showSaveCard?: boolean;
  beforePaymentComplete?: (paymentMethod: unknown) => Promise<boolean> | boolean;
  afterPaymentComplete?: (response: { id?: string | number; [key: string]: unknown }) => void;
  onPaymentCancel?: () => void;
  onError?: (error: unknown) => void;
  customStyle?: Record<string, string | number>;
}

declare global {
  interface Window {
    Pixel?: new (options: PixelOptions) => unknown;
  }
}

const PIXEL_BASE = "https://cdn.jsdelivr.net/npm/paymob-pixel@latest";
const PIXEL_ELEMENT_ID = "paymob-apple-pay-elements";

function ensureStylesheet(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadPixelSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureStylesheet(`${PIXEL_BASE}/styles.css`);
    ensureStylesheet(`${PIXEL_BASE}/main.css`);

    if (window.Pixel) { resolve(); return; }

    const src = `${PIXEL_BASE}/main.js`;
    const existing = document.querySelector(`script[src="${src}"]`);

    const waitForGlobal = () => {
      const started = Date.now();
      const tick = () => {
        if (window.Pixel) { resolve(); return; }
        if (Date.now() - started > 8000) { reject(new Error("Paymob Pixel SDK did not initialise")); return; }
        setTimeout(tick, 100);
      };
      tick();
    };

    if (existing) {
      existing.addEventListener("load", waitForGlobal);
      existing.addEventListener("error", () => reject(new Error("Paymob Pixel SDK failed to load")));
      waitForGlobal();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.type = "module";
    script.onload = waitForGlobal;
    script.onerror = () => reject(new Error("Paymob Pixel SDK failed to load"));
    document.head.appendChild(script);
  });
}

export function PaymobApplePayButton({ clientSecret, publicKey, onSuccess, onFail }: PaymobApplePayButtonProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadPixelSdk();
        if (cancelled) return;
        if (!window.Pixel) {
          setError("Apple Pay is not available on this device.");
          return;
        }
        if (initializedRef.current) return;
        initializedRef.current = true;

        new window.Pixel({
          publicKey,
          clientSecret,
          paymentMethods: ["apple-pay"],
          elementId: PIXEL_ELEMENT_ID,
          disablePay: false,
          beforePaymentComplete: () => true,
          afterPaymentComplete: (response) => {
            const txnId = String(response?.id ?? "");
            onSuccess(txnId);
          },
          onPaymentCancel: () => {
            onFail();
          },
          onError: () => {
            setError("Apple Pay encountered an error. Please try another payment method.");
          },
        });

        setReady(true);
      } catch {
        if (!cancelled) {
          setError("Could not load Apple Pay. Please try another payment method.");
        }
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [clientSecret, publicKey, onSuccess, onFail]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 8 }}>
      {error ? (
        <p style={{
          fontSize: 13,
          color: "rgba(30,24,20,0.6)",
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: "0.04em",
          textAlign: "center",
          maxWidth: 320,
        }}>
          {error}
        </p>
      ) : !ready ? (
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

      <div
        id={PIXEL_ELEMENT_ID}
        style={{
          width: "100%",
          maxWidth: 400,
          display: error ? "none" : "block",
        }}
      />

      {ready && (
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
