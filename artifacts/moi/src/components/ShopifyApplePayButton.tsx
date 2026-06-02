import { useMemo } from "react";

/**
 * Renders the /buy/apple-pay iframe which uses Safari's native
 * -webkit-appearance: -apple-pay-button to show the official Apple Pay button.
 * On tap, navigates window.top to the Shopify checkout URL where Apple Pay
 * is the first option in the "Express checkout" section.
 */

const BUTTON_HEIGHT = 56; // px — height of the native Apple Pay button
const LABEL_HEIGHT = 28;  // px — "Express checkout" label

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
  const iframeSrc = useMemo(() => {
    if (checkoutUrl) {
      return `/buy/apple-pay?checkoutUrl=${encodeURIComponent(checkoutUrl)}`;
    }
    if (variantId) {
      return `/buy/apple-pay?variantId=${encodeURIComponent(variantId)}&qty=${quantity}`;
    }
    return null;
  }, [checkoutUrl, variantId, quantity]);

  if (!iframeSrc || disabled) return null;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        ...style,
      }}
    >
      {/* "Express checkout" label — matches Shopify checkout screenshot */}
      <p
        style={{
          margin: 0,
          marginBottom: 10,
          height: LABEL_HEIGHT,
          lineHeight: `${LABEL_HEIGHT}px`,
          fontSize: 13,
          color: "#6b7280",
          letterSpacing: "0.02em",
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        Express checkout
      </p>

      {/* Native Apple Pay button via -webkit-appearance */}
      <iframe
        src={iframeSrc}
        allow="payment"
        scrolling="no"
        style={{
          border: "none",
          width: "100%",
          height: BUTTON_HEIGHT,
          display: "block",
          overflow: "hidden",
          background: "transparent",
          borderRadius: 10,
        }}
        title="Buy with Apple Pay"
      />
    </div>
  );
}
