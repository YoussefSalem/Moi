import { useState, useEffect } from "react";
import { createCartWithLines, SHOPIFY_CONFIGURED } from "@/lib/shopify";

/**
 * Embeds the Shopify one-page checkout (/checkouts/cn/…) in a clipped iframe
 * so only the "Express checkout" + Apple Pay section is visible at the top.
 * The Apple Pay button fires on Shopify's registered domain — no redirect needed.
 */

const CLIP_HEIGHT = 154; // px — reveals "Express checkout" label + Apple Pay button

export interface ShopifyApplePayButtonProps {
  /** Ready checkout URL from the cart (CartDrawer / CheckoutPage). */
  checkoutUrl?: string | null;
  /** Variant ID to auto-create an express cart (ProductPage). */
  variantId?: string;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ShopifyApplePayButton({
  checkoutUrl: externalUrl,
  variantId,
  quantity = 1,
  disabled = false,
  className,
  style,
}: ShopifyApplePayButtonProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(externalUrl ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (externalUrl) {
      setIframeUrl(externalUrl);
      return;
    }
    if (!variantId || !SHOPIFY_CONFIGURED) return;

    let cancelled = false;
    setLoading(true);
    setIframeUrl(null);

    createCartWithLines([{ merchandiseId: variantId, quantity }])
      .then((cart) => {
        if (!cancelled) {
          setIframeUrl(cart.checkoutUrl ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [variantId, quantity, externalUrl]);

  if (disabled) return null;

  if (loading) {
    return (
      <div
        className={className}
        style={{ height: CLIP_HEIGHT, borderRadius: 12, background: "#000", opacity: 0.12, ...style }}
      />
    );
  }

  if (!iframeUrl) return null;

  return (
    <div
      className={className}
      style={{
        height: CLIP_HEIGHT,
        overflow: "hidden",
        borderRadius: 12,
        background: "#000",
        position: "relative",
        ...style,
      }}
    >
      <iframe
        src={iframeUrl}
        allow="payment; accelerometer; autoplay; camera; encrypted-media; gyroscope; picture-in-picture"
        style={{
          border: "none",
          width: "100%",
          height: "900px",
          display: "block",
          position: "absolute",
          top: 0,
          left: 0,
        }}
        title="Express checkout"
      />
    </div>
  );
}
