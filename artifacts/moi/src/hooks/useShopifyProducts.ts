import { useEffect, useState } from "react";
import { getProducts, formatMoney, SHOPIFY_CONFIGURED, type ShopifyProduct } from "@/lib/shopify";
import { type ProductConfig, type VariantOption } from "@/config/images";

function mapProductToConfig(shopify: ShopifyProduct, fallback: ProductConfig): ProductConfig {
  const { minVariantPrice } = shopify.priceRange;
  const priceFormatted = formatMoney(minVariantPrice.amount, minVariantPrice.currencyCode);
  const mainImage = shopify.featuredImage?.url ?? fallback.productShot;
  const filmstripImages = shopify.images.nodes.length > 0
    ? shopify.images.nodes.map((img) => img.url)
    : (fallback.filmstrip as string[]);

  const variants: VariantOption[] = shopify.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    inventoryQuantity: undefined,
    price: formatMoney(v.price.amount, v.price.currencyCode),
    selectedOptions: v.selectedOptions,
  }));

  const firstAvailable = shopify.variants.nodes.find((v) => v.availableForSale) ?? shopify.variants.nodes[0];

  return {
    ...fallback,
    name: shopify.title || fallback.name,
    description: shopify.description || fallback.description,
    price: priceFormatted || fallback.price,
    productShot: mainImage,
    filmstrip: filmstripImages,
    variantId: firstAvailable?.id,
    variants,
    colorSwatches: {
      black: "#000000",
      blue: "#a9bdd7",
      brown: "#9a6338",
      red: "#f12e2e",
      gold: "#d8a018",
      ivory: "#e3d4cb",
      white: "#e3d4cb",
      beige: "#e3d4cb",
      sand: "#e3d4cb",
      taupe: "#e3d4cb",
      espresso: "#9a6338",
    },
    defaultInventory: {
      brown: { Small: 10, Medium: 10 },
      taupe: { Small: 10, Medium: 10 },
      ivory: { Small: 10, Medium: 10 },
      sand: { Small: 10, Medium: 10 },
      espresso: { Small: 10, Medium: 10 },
    },
  };
}

interface UseShopifyProductsResult {
  products: ProductConfig[];
  loading: boolean;
  error: string | null;
}

export function useShopifyProducts(fallbacks: ProductConfig[]): UseShopifyProductsResult {
  const [products, setProducts] = useState<ProductConfig[]>(fallbacks);
  const [loading, setLoading] = useState(SHOPIFY_CONFIGURED);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!SHOPIFY_CONFIGURED) return;

    let cancelled = false;
    setLoading(true);

    getProducts(10)
      .then((shopifyProducts) => {
        if (cancelled) return;
        if (shopifyProducts.length === 0) {
          setLoading(false);
          return;
        }
        const mapped = shopifyProducts.map((sp, i) =>
          mapProductToConfig(sp, fallbacks[i] ?? fallbacks[0]),
        );
        setProducts(mapped);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load products");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}
