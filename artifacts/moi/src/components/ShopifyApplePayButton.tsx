import { useState, useEffect, useCallback } from "react";

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
  /** If provided, the checkout will be created with this discount code. */
  discountCode?: string;
  /** Called when the user successfully completes Apple Pay in the popup. */
  onSuccess?: (orderNumber: number | null, total?: string) => void;
  /** Called when the popup is closed without a successful payment. */
  onCancel?: () => void;
  /** Called when the popup cannot be opened or creation fails. */
  onError?: (msg: string) => void;
}

export function ShopifyApplePayButton({
  variantId, quantity = 1, priceEGP,
  lines: cartLines, totalEGP,
  disabled = false, className, style,
  discountCode,
  onSuccess,
  onCancel,
  onError,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready">("idle");
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
      const res = await fetch("/api/shopify-apple-pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines,
          totalAmountCents,
          discountCode,
        }),
      });
      const data = await res.json() as {
        checkoutUrl?: string;
        checkoutId?: string;
        error?: string;
      };
      if (!res.ok || !data.checkoutUrl || !data.checkoutId) {
        setError(data.error ?? "Apple Pay is unavailable. Please try another payment method.");
        setPhase("idle");
        onError?.(data.error ?? "Apple Pay is unavailable.");
        return;
      }

      // Open Shopify checkout in a popup. The popup URL contains the
      // checkout_token which Shopify uses to route the Apple Pay session
      // to the correct checkout. Shopify handles the Apple Pay merchant
      // validation and payment sheet entirely within the popup.
      const popup = openShopifyCheckoutPopup(data.checkoutUrl);
      if (!popup) {
        setError("Popup blocked. Please allow popups for this site.");
        setPhase("idle");
        onError?.("Popup blocked.");
        return;
      }

      setPhase("ready");

      // Poll until popup closes, then infer success/cancel by how long it was open.
      // The Storefront API 2024-04 Cart type has no completedAt, so we use a
      // time-based heuristic: > 8 s open = likely paid, otherwise cancelled.
      const openedAt = Date.now();
      const pollInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollInterval);
          const elapsed = Date.now() - openedAt;
          const totalStr = totalEGP != null ? `${Math.round(totalEGP)} EGP` : undefined;
          if (elapsed > 8000) {
            onSuccess?.(null, totalStr);
          } else {
            onCancel?.();
          }
          setPhase("idle");
        }
      }, 800);
    } catch {
      setError("Network error. Please try again.");
      setPhase("idle");
      onError?.("Network error.");
    }
  }, [phase, disabled, variantId, quantity, priceEGP, cartLines, totalEGP, discountCode, onSuccess, onCancel, onError]);

  if (!available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />

      <p style={{
        margin: "0 0 10px", fontSize: 13, color: "#6b7280",
        textAlign: "center", letterSpacing: "0.02em", fontFamily: "inherit",
      }}>
        {phase === "loading" ? "Setting up Apple Pay\u2026" : "Express checkout"}
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
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function openShopifyCheckoutPopup(checkoutUrl: string): Window | null {
  const width = Math.min(520, window.innerWidth - 20);
  const height = Math.min(800, window.innerHeight - 40);
  const left = Math.round((window.innerWidth - width) / 2);
  const top = Math.round((window.innerHeight - height) / 2);

  return window.open(
    checkoutUrl,
    "ShopifyApplePay",
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
  );
}

