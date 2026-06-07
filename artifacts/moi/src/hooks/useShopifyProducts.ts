import { useEffect, useState } from "react";
import { getProducts, formatMoney, SHOPIFY_CONFIGURED, type ShopifyProduct } from "@/lib/shopify";
import { type ProductConfig, type VariantOption } from "@/config/images";

export function mapProductToConfig(shopify: ShopifyProduct, fallback: ProductConfig): ProductConfig {
  const { minVariantPrice } = shopify.priceRange;
  const priceFormatted = formatMoney(minVariantPrice.amount, minVariantPrice.currencyCode);

  const shopifyImageUrls = shopify.images.nodes.map((img) => img.url);
  const featuredUrl = shopify.featuredImage?.url;

  // For color-specific pages, fallback.filmstrip holds colorGalleries images
  // (accurate per-color shots). Prefer those over Shopify's all-product images
  // which mix every color variant together and are not color-filtered.
  const fallbackFilm = fallback.filmstrip as string[];
  const filmstrip = fallbackFilm.length > 0
    ? fallbackFilm
    : shopifyImageUrls.length > 0
      ? shopifyImageUrls
      : [];

  const productShot = featuredUrl ?? fallback.productShot;

  const extraShopifyImages = shopifyImageUrls
    .filter((url) => url !== featuredUrl)
    .slice(0, 4);

  const look = {
    model:   featuredUrl || fallback.look.model,
    shoes:   extraShopifyImages[0] || fallback.look.shoes,
    bag:     extraShopifyImages[1] || fallback.look.bag,
    earring: extraShopifyImages[2] || fallback.look.earring,
    extra:   extraShopifyImages[3] || fallback.look.extra,
  };

  const variants: VariantOption[] = shopify.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: formatMoney(v.price.amount, v.price.currencyCode),
    compareAtPrice: v.compareAtPrice ? formatMoney(v.compareAtPrice.amount, v.compareAtPrice.currencyCode) : undefined,
    selectedOptions: v.selectedOptions,
  }));

  const firstAvailable = shopify.variants.nodes.find((v) => v.availableForSale) ?? shopify.variants.nodes[0];

  const colorSwatches: Record<string, string> = (() => {
    const colorOption = shopify.options.find(
      (o) => o.name.toLowerCase() === "color",
    );
    if (!colorOption) return (fallback.colorSwatches as Record<string, string>) ?? {};
    const result: Record<string, string> = {};
    for (const ov of colorOption.optionValues) {
      const key = ov.name.toLowerCase();
      if (ov.swatch?.color) {
        result[key] = ov.swatch.color.startsWith("#")
          ? ov.swatch.color
          : `#${ov.swatch.color}`;
      } else {
        result[key] = (fallback.colorSwatches as Record<string, string>)?.[key] ?? "#c8bdb5";
      }
    }
    return result;
  })();

  return {
    ...fallback,
    slug: fallback.slug,
    // If the fallback name carries a color suffix (e.g. "MOI VERSA TOP — Yellow"),
    // preserve it so Shopify's generic product title doesn't strip the color.
    name: (() => {
      const base = shopify.title || fallback.name;
      const colorSuffix = fallback.name.includes(" — ")
        ? fallback.name.split(" — ").pop()
        : null;
      return colorSuffix ? `${base} — ${colorSuffix}` : base;
    })(),
    description: shopify.description || fallback.description,
    price: priceFormatted || fallback.price,
    productShot,
    filmstrip,
    look,
    variantId: firstAvailable?.id,
    variants,
    colorImages: fallback.colorImages,
    colorGalleries: fallback.colorGalleries,
    colorSwatches,
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

    const ric: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 600) as unknown as number;

    let ricId: number;
    ricId = ric(() => {
      if (cancelled) return;

      getProducts(50)
        .then((shopifyProducts) => {
          if (cancelled) return;
          if (shopifyProducts.length === 0) {
            setLoading(false);
            return;
          }
          const mapped = shopifyProducts.map((sp) => {
            const spTitle = sp.title.toLowerCase();
            const matched = fallbacks.find((fb) => {
              if (!fb.name) return false;
              const fbName = fb.name.toLowerCase();
              const fbShopifyTitle = ("shopifyTitle" in fb && fb.shopifyTitle ? String(fb.shopifyTitle).toLowerCase() : "");
              return spTitle.includes(fbName) || spTitle.includes(fbShopifyTitle) || fbName.includes(spTitle) || fbShopifyTitle.includes(spTitle);
            }) ?? fallbacks.find((fb) =>
              fb.name && spTitle.includes(fb.name.toLowerCase())
            ) ?? fallbacks.find((fb) =>
              fb.name && fb.name.toLowerCase().includes(spTitle)
            ) ?? fallbacks[0];
            return mapProductToConfig(sp, matched);
          });
          setProducts(mapped);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Failed to load products");
          setLoading(false);
        });
    }, { timeout: 4000 });

    const cic: (id: number) => void =
      typeof cancelIdleCallback === "function" ? cancelIdleCallback : clearTimeout;

    return () => {
      cancelled = true;
      if (ricId) cic(ricId);
    };
  }, []);

  return { products, loading, error };
}
