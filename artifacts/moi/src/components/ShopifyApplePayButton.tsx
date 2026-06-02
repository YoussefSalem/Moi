import { useCallback, useState } from "react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

export interface ShopifyApplePayButtonProps {
  checkoutUrl?: string | null;
  variantId?: string;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ShopifyApplePayButton({
  checkoutUrl,
  variantId,
  quantity = 1,
  disabled = false,
  className,
  style,
}: ShopifyApplePayButtonProps) {
  const { buyNowCheckoutUrl } = useCart();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || loading) return;

    let url = checkoutUrl ?? null;

    if (!url && variantId) {
      setLoading(true);
      try {
        url = await buyNowCheckoutUrl(variantId, quantity);
      } catch {
        toast.error("Couldn't start Apple Pay. Please try again.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (!url) {
      toast.error("Checkout is unavailable. Please try again.");
      return;
    }

    window.location.href = url;
  }, [checkoutUrl, variantId, quantity, disabled, loading, buyNowCheckoutUrl]);

  return (
    <button
      type="button"
      onClick={() => { void handleClick(); }}
      disabled={disabled || loading}
      className={className}
      style={{
        WebkitAppearance: "none",
        appearance: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: (disabled || loading) ? "not-allowed" : "pointer",
        opacity: (disabled || loading) ? 0.45 : 1,
        background: "#000",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "0 24px",
        height: 48,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        fontSize: 17,
        fontWeight: 500,
        letterSpacing: "-0.02em",
        gap: 6,
        width: "100%",
        ...style,
      }}
      aria-label="Buy with Apple Pay"
    >
      {loading ? (
        <span style={{ fontSize: 14 }}>Loading…</span>
      ) : (
        <>
          <svg viewBox="0 0 814 1000" height="18" fill="currentColor" aria-hidden="true">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.1-38.8-168.4-103.1c-73.9-71.9-134.6-183.3-134.6-290.9 0-195.3 129.4-298.5 256.8-298.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
          </svg>
          Pay
        </>
      )}
    </button>
  );
}
