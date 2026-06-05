/**
 * Restock checking is handled server-side via Shopify webhooks
 * (inventory_levels/update, products/update → POST /api/restock/check-and-notify).
 * The endpoint requires a secret token that is not available in the browser,
 * so client-side polling has been removed.
 */
export function useRestockChecker() {}
