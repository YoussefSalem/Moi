import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/context/CartContext";
import {
  openShopifyCheckoutBlank,
  navigateShopifyCheckout,
  openShopifyCheckout,
} from "@/lib/shopifyCheckout";

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
  const { buyNowCheckoutUrl, checkoutUrl } = useCart();

  useEffect(() => {
    const AP = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setAvailable(!!(AP?.canMakePayments?.()));
  }, []);

  const handlePay = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);

    if (variantId && priceEGP != null) {
      // Product-page express checkout: create an ephemeral cart (won't open bag).
      // Open the popup BEFORE the await so the browser doesn't block it.
      const popup = openShopifyCheckoutBlank();
      try {
        const url = await buyNowCheckoutUrl(variantId, quantity);
        navigateShopifyCheckout(popup, url);
      } catch {
        popup?.close();
      } finally {
        setLoading(false);
      }
    } else if (checkoutUrl) {
      // Cart-drawer mode: items already in cart, URL is ready — open synchronously.
      openShopifyCheckout(checkoutUrl);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [loading, disabled, variantId, quantity, priceEGP, buyNowCheckoutUrl, checkoutUrl]);

  const isProductMode = !!variantId && priceEGP != null;
  const isCartMode = !isProductMode && !!checkoutUrl;
  const canPay = available && !disabled && (isProductMode || isCartMode);

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
