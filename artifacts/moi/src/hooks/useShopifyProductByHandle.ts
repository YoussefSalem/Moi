import { useEffect, useState } from "react";
import { getProductByHandle, SHOPIFY_CONFIGURED } from "@/lib/shopify";
import { type ProductConfig } from "@/config/images";
import { mapProductToConfig } from "@/hooks/useShopifyProducts";

interface UseShopifyProductByHandleResult {
  product: ProductConfig;
  loading: boolean;
}

export function useShopifyProductByHandle(
  handle: string,
  fallback: ProductConfig,
): UseShopifyProductByHandleResult {
  const [product, setProduct] = useState<ProductConfig>(fallback);
  const [loading, setLoading] = useState(SHOPIFY_CONFIGURED);

  const fallbackSlug = fallback.slug;

  useEffect(() => {
    setProduct(fallback);
    if (!SHOPIFY_CONFIGURED) return;
    let cancelled = false;
    setLoading(true);

    // Color-suffixed handles like "moi-wavvy-light-blue" don't exist in Shopify;
    // use the base product slug from the fallback config to fetch the real product.
    const shopifyHandle = fallbackSlug ?? handle;
    getProductByHandle(shopifyHandle)
      .then((shopifyProduct) => {
        if (cancelled) return;
        if (shopifyProduct) {
          setProduct(mapProductToConfig(shopifyProduct, fallback));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [handle, fallbackSlug]);

  // Guard against stale state when navigating between different base products.
  // product.slug stays in sync with fallbackSlug once the async effect fires,
  // but between the synchronous re-render (new handle prop) and the async effect
  // execution the stored product may still belong to the previous product.
  // Return the fallback immediately in that window so the UI never flashes the
  // old product's content — this is the root cause of the "wrong page" bug when
  // clicking a rec card and of the "adds as wrong product" cart bug.
  const stale = product.slug !== fallbackSlug;

  return {
    product: stale ? fallback : product,
    loading: stale || loading,
  };
}
