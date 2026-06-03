import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/context/CartContext";

/* CSS via <style> so -apple-pay-button-type/style custom props reach -webkit-appearance */
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
  /** Product-page express buy: creates a fresh single-item Shopify checkout. */
  variantId?: string;
  quantity?: number;

  /** Cart / drawer: use the existing Shopify cart's checkout URL directly. */
  checkoutUrl?: string | null;

  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Apple Pay express-checkout button.
 *
 * On click, it redirects to the Shopify-hosted checkout page, which handles
 * Apple Pay natively using Shopify's own merchant certificate.  No Paymob or
 * custom ApplePaySession is involved — identical to the "Buy It Now" / checkout
 * button approach.
 *
 * Visibility: only rendered when ApplePaySession.canMakePayments() returns true
 * (i.e. Safari on an Apple device with a card set up).
 */
export function ShopifyApplePayButton({
  variantId, quantity = 1, checkoutUrl,
  disabled = false, className, style,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const { buyNowCheckoutUrl } = useCart();

  useEffect(() => {
    const AP = (window as unknown as { ApplePaySession?: { canMakePayments(): boolean } }).ApplePaySession;
    setAvailable(!!(AP?.canMakePayments()));
  }, []);

  const handlePay = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      let url: string | null = checkoutUrl ?? null;
      if (!url && variantId) {
        url = await buyNowCheckoutUrl(variantId, quantity);
      }
      if (url) {
        window.location.href = url;
      }
    } finally {
      setLoading(false);
    }
  }, [checkoutUrl, variantId, quantity, buyNowCheckoutUrl, loading, disabled]);

  if (!available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />
      <p style={{
        margin: "0 0 10px", fontSize: 13, color: "#6b7280",
        textAlign: "center", letterSpacing: "0.02em", fontFamily: "inherit",
      }}>
        Express checkout
      </p>
      <button
        type="button"
        className="ap-express-btn"
        onClick={handlePay}
        disabled={loading}
        aria-label="Buy with Apple Pay"
      />
    </div>
  );
}
