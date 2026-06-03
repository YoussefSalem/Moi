import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/context/CartContext";
import { openShopifyCheckout } from "@/lib/shopifyCheckout";

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
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ShopifyApplePayButton({
  variantId, quantity = 1, priceEGP,
  disabled = false, className, style,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToCart, checkoutUrl } = useCart();

  useEffect(() => {
    const AP = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setAvailable(!!(AP?.canMakePayments?.()));
  }, []);

  const handlePay = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      if (variantId && priceEGP != null) {
        const url = await addToCart({
          variantId,
          quantity,
          price: `${priceEGP} EGP`,
          priceAmount: priceEGP,
          currencyCode: "EGP",
        });
        if (url) openShopifyCheckout(url);
      } else if (checkoutUrl) {
        openShopifyCheckout(checkoutUrl);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, disabled, variantId, quantity, priceEGP, addToCart, checkoutUrl]);

  const canPay = available && !disabled && (
    (variantId != null && priceEGP != null) || !!checkoutUrl
  );

  if (!canPay) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />
      <p style={{
        margin: "0 0 10px", fontSize: 13, color: "#6b7280",
        textAlign: "center", letterSpacing: "0.02em", fontFamily: "inherit",
      }}>
        {loading ? "Opening checkout…" : "Express checkout"}
      </p>
      <button
        type="button"
        className="ap-express-btn"
        onClick={() => { void handlePay(); }}
        disabled={loading}
        aria-label="Buy with Apple Pay"
      />
    </div>
  );
}
