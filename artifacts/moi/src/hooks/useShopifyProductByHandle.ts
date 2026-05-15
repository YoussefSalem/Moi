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

  useEffect(() => {
    if (!SHOPIFY_CONFIGURED) return;
    let cancelled = false;
    setLoading(true);

    getProductByHandle(handle)
      .then((shopifyProduct) => {
        if (cancelled) return;
        if (shopifyProduct) {
          // Preserve handle from fallback for downstream matching
          const enrichedFallback = {
            ...fallback,
            handle: fallback.handle ?? handle,
          };
          setProduct(mapProductToConfig(shopifyProduct, enrichedFallback));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [handle]);

  return { product, loading };
}
