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
          let mapped = mapProductToConfig(shopifyProduct, fallback);
          // Respect fallback out-of-stock flags. If ALL fallback variants are
          // unavailable, force all Shopify variants as unavailable (covers the case
          // where the product is intentionally disabled in the frontend config).
          // If only some variants are unavailable, match by variant ID.
          if (mapped.variants) {
            const fallbackVariants = fallback.variants ?? [];
            const allFallbackUnavailable = fallbackVariants.length > 0 && fallbackVariants.every((v) => !v.availableForSale);
            if (allFallbackUnavailable) {
              mapped = {
                ...mapped,
                variants: mapped.variants.map((v) => ({ ...v, availableForSale: false })),
              };
            } else {
              const fallbackUnavailableIds = new Set(
                fallbackVariants
                  .filter((v) => !v.availableForSale)
                  .map((v) => v.id),
              );
              if (fallbackUnavailableIds.size > 0) {
                mapped = {
                  ...mapped,
                  variants: mapped.variants.map((v) =>
                    fallbackUnavailableIds.has(v.id)
                      ? { ...v, availableForSale: false }
                      : v,
                  ),
                };
              }
            }
          }
          setProduct(mapped);
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
