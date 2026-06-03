const POPUP_NAME = "shopify_checkout";
const POPUP_W = 480;
const POPUP_H = 700;

function popupFeatures(): string {
  const left = Math.max(0, Math.round((screen.width - POPUP_W) / 2));
  const top = Math.max(0, Math.round((screen.height - POPUP_H) / 2));
  return `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

/**
 * Open the popup window immediately — must be called inside a synchronous user
 * gesture (before any await) so the browser doesn't block it.
 * Returns the window reference so you can navigate it after async work.
 */
export function openShopifyCheckoutBlank(): Window | null {
  return window.open("", POPUP_NAME, popupFeatures());
}

/**
 * Navigate an already-open popup to the final checkout URL.
 * Falls back to same-tab navigation if the popup was blocked.
 */
export function navigateShopifyCheckout(
  popup: Window | null,
  url: string | null,
): void {
  if (!url) {
    popup?.close();
    return;
  }
  if (popup && !popup.closed) {
    popup.location.href = url;
  } else {
    // popup was blocked — fall back to a new tab
    window.open(url, "_blank");
  }
}

/** Convenience: open popup and navigate in one call (for synchronous URLs). */
export function openShopifyCheckout(url: string): void {
  const popup = window.open(url, POPUP_NAME, popupFeatures());
  if (!popup) {
    window.open(url, "_blank");
  }
}
