import { useEffect, useState } from "react";
import { getProducts, getProductByHandle, formatMoney, SHOPIFY_CONFIGURED, type ShopifyProduct } from "@/lib/shopify";
import { type ProductConfig, type VariantOption } from "@/config/images";

export function mapProductToConfig(shopify: ShopifyProduct, fallback: ProductConfig): ProductConfig {
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
    compareAtPrice: v.compareAtPrice ? formatMoney(v.compareAtPrice.amount, v.compareAtPrice.currencyCode) : undefined,
    selectedOptions: v.selectedOptions,
  }));

  const firstAvailable = shopify.variants.nodes.find((v) => v.availableForSale) ?? shopify.variants.nodes[0];

  // Pull Shopify images into The Look slots.
  // Featured image = main model shot; remaining images = side thumbnails.
  const featuredUrl = shopify.featuredImage?.url;
  const extraShopifyImages = shopify.images.nodes
    .filter((img) => img.url !== featuredUrl)
    .map((img) => img.url)
    .slice(0, 4);

  const look = {
    model:   featuredUrl || fallback.look.model,
    shoes:   extraShopifyImages[0] || fallback.look.shoes,
    bag:     extraShopifyImages[1] || fallback.look.bag,
    earring: extraShopifyImages[2] || fallback.look.earring,
    extra:   extraShopifyImages[3] || fallback.look.extra,
  };

  return {
    ...fallback,
    slug: fallback.slug,
    name: shopify.title || fallback.name,
    description: shopify.description || fallback.description,
    price: priceFormatted || fallback.price,
    // Preserve the config's color-specific productShot (set by deriveFallbackFromHandle).
    // Shopify's featuredImage is used for look.model but must not override the per-color image.
    productShot: fallback.productShot,
    filmstrip: (fallback.filmstrip?.length ? fallback.filmstrip : filmstripImages) as string[],
    look,
    variantId: firstAvailable?.id,
    variants,
    colorImages: fallback.colorImages,
    colorGalleries: fallback.colorGalleries,
    colorSwatches: (() => {
      const LOCAL_FALLBACK: Record<string, string> = {
        black: "#000000",
        blue: "#a9bdd7",
        brown: "#9a6338",
        red: "#f12e2e",
        gold: "#d8a018",
        ivory: "#e3d4cb",
        white: "#ffffff",
        beige: "#e3d4cb",
        sand: "#e3d4cb",
        taupe: "#e3d4cb",
        espresso: "#9a6338",
      };
      const colorOption = shopify.options.find(
        (o) => o.name.toLowerCase() === "color",
      );
      if (!colorOption) return LOCAL_FALLBACK;
      const fromShopify: Record<string, string> = {};
      for (const ov of colorOption.optionValues) {
        const key = ov.name.toLowerCase();
        if (ov.swatch?.color) {
          fromShopify[key] = ov.swatch.color.startsWith("#")
            ? ov.swatch.color
            : `#${ov.swatch.color}`;
        } else {
          fromShopify[key] = LOCAL_FALLBACK[key] ?? "#c8bdb5";
        }
      }
      return fromShopify;
    })(),
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
