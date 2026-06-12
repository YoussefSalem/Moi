import { useEffect, useState } from "react";
import { getProducts, formatMoney, SHOPIFY_CONFIGURED, type ShopifyProduct } from "@/lib/shopify";
import { type ProductConfig, type VariantOption } from "@/config/images";

// Returns true only for real product photos hosted in Shopify's /products/ path.
// Variant images from the Files section (/files/) are colour swatches or uploads
// that should not replace local product shots.
function isProductPhoto(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path.includes("/products/");
  } catch {
    return false;
  }
}

export function mapProductToConfig(shopify: ShopifyProduct, fallback: ProductConfig): ProductConfig {
  const { minVariantPrice } = shopify.priceRange;
  const priceFormatted = formatMoney(minVariantPrice.amount, minVariantPrice.currencyCode);

  const shopifyImageUrls = shopify.images.nodes.map((img) => img.url);
  const featuredUrl = shopify.featuredImage?.url;

  // For color-specific pages, fallback.filmstrip holds colorGalleries images
  // (accurate per-color shots). We merge Shopify's per-variant image with local
  // alt images so the hero shot is the real Shopify photo while extras stay local.
  const fallbackFilm = fallback.filmstrip as string[];

  // Color suffix from fallback name, e.g. "MOI WAVVY — Sand" → "Sand"
  const pageColorName = fallback.name.includes(" — ")
    ? (fallback.name.split(" — ").pop() ?? "")
    : "";

  // Build merged colorGalleries first so we can use them for the current page
  const localGalleries = (fallback.colorGalleries ?? {}) as Record<string, string[]>;

  const shopifyMainByColor: Record<string, string> = {};
  for (const v of shopify.variants.nodes) {
    if (!v.image?.url) continue;
    if (!isProductPhoto(v.image.url)) continue;
    const colorOpt = v.selectedOptions.find(
      (o) => o.name.toLowerCase() === "color",
    );
    if (!colorOpt) continue;
    const colorName = colorOpt.value;
    if (!shopifyMainByColor[colorName]) {
      shopifyMainByColor[colorName] = v.image.url;
    }
  }

  const mergedColorGalleries: Record<string, string[]> = {};
  for (const [k, imgs] of Object.entries(localGalleries)) {
    mergedColorGalleries[k] = [...(imgs as string[])];
  }
  for (const [colorName, shopifyMain] of Object.entries(shopifyMainByColor)) {
    const localImgs = (localGalleries[colorName] ?? []) as string[];
    const localAlts = localImgs.slice(1);
    const combined = [shopifyMain, ...localAlts.filter((u) => u !== shopifyMain)];
    mergedColorGalleries[colorName] = combined;
  }

  // For color-specific pages: use the merged gallery (Shopify hero + local alts).
  // For generic pages: fall back to the old behavior.
  const mergedFilm = pageColorName ? mergedColorGalleries[pageColorName] : undefined;
  const filmstrip = mergedFilm?.length
    ? mergedFilm
    : fallbackFilm.length > 0
      ? fallbackFilm
      : shopifyImageUrls.length > 0
        ? shopifyImageUrls
        : [];

  const productShot = mergedFilm?.length
    ? mergedFilm[0]
    : fallbackFilm.length > 0
      ? fallback.productShot
      : (featuredUrl ?? fallback.productShot);

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

  // Build colorImages: prefer Shopify's per-variant image over the local fallback,
  // but only when the Shopify image is an actual product photo (hosted under
  // /products/ on the CDN). Swatch/file-section uploads (/files/) are skipped so
  // they don't replace the local product shots.
  const colorImages = (() => {
    const localMap = (fallback.colorImages ?? {}) as Record<string, string>;
    const merged: Record<string, string> = { ...localMap };

    for (const v of shopify.variants.nodes) {
      if (!v.image?.url) continue;
      if (!isProductPhoto(v.image.url)) continue;
      const colorOpt = v.selectedOptions.find(
        (o) => o.name.toLowerCase() === "color",
      );
      if (!colorOpt) continue;
      const colorName = colorOpt.value;
      merged[colorName] = v.image.url;
    }
    return merged;
  })();

  // Build colorGalleries: Shopify variant image leads, local alt images follow.
  // Strategy: [shopify_main, ...local_alts] where local_alts = local gallery minus
  // its first image (the local main shot that Shopify now replaces). This preserves
  // the extra styled shots from local assets while keeping the CDN hero accurate.
  const colorGalleries = (() => {
    const localGalleries = (fallback.colorGalleries ?? {}) as Record<string, string[]>;

    // Collect the first distinct Shopify product photo per color.
    // Skip swatch/file-section images that are not real product shots.
    const shopifyMainByColor: Record<string, string> = {};
    for (const v of shopify.variants.nodes) {
      if (!v.image?.url) continue;
      if (!isProductPhoto(v.image.url)) continue;
      const colorOpt = v.selectedOptions.find(
        (o) => o.name.toLowerCase() === "color",
      );
      if (!colorOpt) continue;
      const colorName = colorOpt.value;
      if (!shopifyMainByColor[colorName]) {
        shopifyMainByColor[colorName] = v.image.url;
      }
    }

    const merged: Record<string, string[]> = {};

    // Start from local galleries as defaults
    for (const [k, imgs] of Object.entries(localGalleries)) {
      merged[k] = [...(imgs as string[])];
    }

    // Where Shopify has a main image for a color: put it first, then append
    // the local alt images (skip index 0 — the local main that Shopify replaces).
    for (const [colorName, shopifyMain] of Object.entries(shopifyMainByColor)) {
      const localImgs = (localGalleries[colorName] ?? []) as string[];
      const localAlts = localImgs.slice(1); // everything after the local hero shot
      const combined = [shopifyMain, ...localAlts.filter((u) => u !== shopifyMain)];
      merged[colorName] = combined;
    }

    return merged;
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
    colorImages,
    colorGalleries,
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
