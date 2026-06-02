import { useMemo } from "react";

export interface ShopifyApplePayButtonProps {
  checkoutUrl?: string | null;
  variantId?: string;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  height?: number;
}

export function ShopifyApplePayButton({
  checkoutUrl,
  variantId,
  quantity = 1,
  disabled = false,
  className,
  style,
  height = 52,
}: ShopifyApplePayButtonProps) {
  const src = useMemo(() => {
    if (checkoutUrl) {
      return `/buy/apple-pay?checkoutUrl=${encodeURIComponent(checkoutUrl)}`;
    }
    if (variantId) {
      return `/buy/apple-pay?variantId=${encodeURIComponent(variantId)}&qty=${quantity}`;
    }
    return null;
  }, [checkoutUrl, variantId, quantity]);

  if (!src || disabled) return null;

  return (
    <iframe
      src={src}
      allow="payment"
      scrolling="no"
      className={className}
      style={{
        border: "none",
        width: "100%",
        height,
        display: "block",
        overflow: "hidden",
        background: "transparent",
        pointerEvents: disabled ? "none" : undefined,
        opacity: disabled ? 0.45 : 1,
        borderRadius: 8,
        ...style,
      }}
      title="Buy with Apple Pay"
    />
  );
}
