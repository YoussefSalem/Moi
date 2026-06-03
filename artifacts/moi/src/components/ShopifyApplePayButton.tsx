import { useState, useEffect, useCallback } from "react";
import { PaymobApplePayButton } from "./PaymobApplePayButton";

const BTN_CSS = `
  .ap-express-btn {
    -webkit-appearance: -apple-pay-button;
    -apple-pay-button-type: plain;
    -apple-pay-button-style: black;
    display: block; width: 100%; height: 56px;
    border: none; cursor: pointer; border-radius: 10px;
  }
  .ap-express-btn:disabled { opacity: 0.55; cursor: default; }
`;

export interface ShopifyApplePayButtonProps {
  variantId?: string;
  quantity?: number;
  priceEGP?: number;
  lines?: Array<{ variantId: string; quantity: number }>;
  totalEGP?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ShopifyApplePayButton({
  variantId, quantity = 1, priceEGP,
  lines: cartLines, totalEGP,
  disabled = false, className, style,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready">("idle");
  const [paymentData, setPaymentData] = useState<{ clientSecret: string; publicKey: string; intentId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const AP = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setAvailable(!!(AP?.canMakePayments?.()));
  }, []);

  const handlePay = useCallback(async () => {
    if (phase !== "idle" || disabled) return;

    let lines: Array<{ variantId: string; quantity: number }>;
    let totalAmountCents: number;

    if (variantId && priceEGP != null) {
      lines = [{ variantId, quantity }];
      totalAmountCents = Math.round((priceEGP * quantity) * 100);
    } else if (cartLines && cartLines.length > 0 && totalEGP != null) {
      lines = cartLines;
      totalAmountCents = Math.round(totalEGP * 100);
    } else {
      return;
    }

    setPhase("loading");
    setError(null);

    try {
      const res = await fetch("/api/orders/paymob-apple-pay-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, totalAmountCents }),
      });
      const data = await res.json() as {
        clientSecret?: string; publicKey?: string; intentId?: string; error?: string;
      };
      if (!res.ok || !data.clientSecret || !data.publicKey || !data.intentId) {
        setError(data.error ?? "Apple Pay is unavailable. Please try another payment method.");
        setPhase("idle");
        return;
      }
      setPaymentData({ clientSecret: data.clientSecret, publicKey: data.publicKey, intentId: data.intentId });
      setPhase("ready");
    } catch {
      setError("Network error. Please try again.");
      setPhase("idle");
    }
  }, [phase, disabled, variantId, quantity, priceEGP, cartLines, totalEGP]);

  const handleSuccess = useCallback((_txnId: string) => {
    setTimeout(() => { window.location.href = "/?paid=1"; }, 800);
  }, []);

  const handleFail = useCallback(() => {
    setPaymentData(null);
    setPhase("idle");
    setError("Payment was declined or cancelled. Please try again.");
  }, []);

  if (!available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />

      {phase === "ready" && paymentData ? (
        <PaymobApplePayButton
          clientSecret={paymentData.clientSecret}
          publicKey={paymentData.publicKey}
          intentId={paymentData.intentId}
          onSuccess={handleSuccess}
          onFail={handleFail}
        />
      ) : (
        <>
          <p style={{
            margin: "0 0 10px", fontSize: 13, color: "#6b7280",
            textAlign: "center", letterSpacing: "0.02em", fontFamily: "inherit",
          }}>
            {phase === "loading" ? "Setting up Apple Pay…" : "Express checkout"}
          </p>
          <button
            type="button"
            className="ap-express-btn"
            onClick={() => { void handlePay(); }}
            disabled={phase === "loading"}
            aria-label="Buy with Apple Pay"
          />
          {error && (
            <p style={{
              marginTop: 8, fontSize: 11, color: "rgba(30,24,20,0.6)",
              textAlign: "center", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.03em",
            }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
