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

    // Color-suffixed handles like "moi-wavvy-light-blue" don't exist in Shopify;
    // use the base product slug from the fallback config to fetch the real product.
    const shopifyHandle = fallback.slug ?? handle;
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
  }, [handle]);

  return { product, loading };
}
