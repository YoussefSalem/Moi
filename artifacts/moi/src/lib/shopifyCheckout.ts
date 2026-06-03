export function openShopifyCheckout(url: string): void {
  const w = 480;
  const h = 700;
  const left = Math.max(0, Math.round((screen.width - w) / 2));
  const top = Math.max(0, Math.round((screen.height - h) / 2));
  window.open(
    url,
    "shopify_checkout",
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`,
  );
}
