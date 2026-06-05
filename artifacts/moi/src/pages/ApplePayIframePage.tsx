import { useState, useCallback, useEffect } from "react";
import { createCartWithLines, SHOPIFY_CONFIGURED } from "@/lib/shopify";

function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    checkoutUrl: p.get("checkoutUrl") ?? null,
    variantId: p.get("variantId") ?? null,
    qty: Math.max(1, parseInt(p.get("qty") ?? "1", 10) || 1),
  };
}

/* Injected via <style> so CSS custom props reach -webkit-appearance */
const STYLE = `
  html, body {
    margin: 0;
    padding: 0;
    background: transparent !important;
    height: 100%;
    overflow: hidden;
  }
  * { box-sizing: border-box; }

  .ap-btn {
    -webkit-appearance: -apple-pay-button;
    -apple-pay-button-type: plain;
    -apple-pay-button-style: black;
    display: block;
    width: 100%;
    height: 100%;
    min-height: 44px;
    border: none;
    cursor: pointer;
    border-radius: 10px;
  }
  .ap-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }
`;

export function ApplePayIframePage() {
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const ap = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    if (!ap?.canMakePayments?.()) setUnavailable(true);
  }, []);

  const handleClick = useCallback(async () => {
    if (loading) return;
    const { checkoutUrl, variantId, qty } = getParams();

    let url = checkoutUrl;

    if (!url && variantId && SHOPIFY_CONFIGURED) {
      setLoading(true);
      try {
        const cart = await createCartWithLines([{ merchandiseId: variantId, quantity: qty }]);
        url = cart.checkoutUrl ?? null;
      } catch {
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (!url) return;

    try {
      window.top!.location.href = url;
    } catch {
      window.location.href = url;
    }
  }, [loading]);

  if (unavailable) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <button
        type="button"
        className="ap-btn"
        onClick={() => { void handleClick(); }}
        disabled={loading}
        aria-label="Buy with Apple Pay"
      />
    </>
  );
}
