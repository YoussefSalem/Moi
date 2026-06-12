import { IMAGES, type ProductConfig } from "@/config/images";

export interface RecItem {
  handle: string;
  name: string;
  color: string;
  price: string;
  swatch: string;
  image: () => string;
  gallery: () => readonly string[];
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function buildAllRecs(): RecItem[] {
  const allProducts = [IMAGES.product1, IMAGES.product2] as const;
  const items: RecItem[] = [];
  for (const product of allProducts) {
    const colorImages = product.colorImages as Record<string, string> | undefined;
    const colorGalleries = product.colorGalleries as Record<string, readonly string[]> | undefined;
    const colorSwatches = product.colorSwatches as Record<string, string> | undefined;
    if (!colorImages) continue;
    for (const colorName of Object.keys(colorImages)) {
      const swatch = colorSwatches?.[colorName.toLowerCase()] ?? colorSwatches?.[colorName] ?? "";
      if (!swatch) continue;
      const handle = `${product.slug}-${slugify(colorName)}`;
      items.push({
        handle,
        name: product.name,
        color: colorName,
        price: product.price,
        swatch,
        image: () => colorImages[colorName] ?? product.productShot,
        gallery: () => colorGalleries?.[colorName] ?? [colorImages[colorName] ?? product.productShot],
      });
    }
  }
  return items;
}

export function deriveFallbackFromHandle(handle: string): ProductConfig {
  const allProducts = [IMAGES.product1, IMAGES.product2, IMAGES.product3];
  const matched = allProducts.find(
    (p) => handle.startsWith(p.slug + "-") || handle === p.slug,
  );
  if (!matched) return IMAGES.product1;

  const colorSlug = handle.startsWith(matched.slug + "-")
    ? handle.slice(matched.slug.length + 1)
    : "";

  const colorNames = Object.keys(matched.colorImages ?? {});
  const colorName =
    colorNames.find((c) => slugify(c) === colorSlug) ??
    colorNames[0] ??
    "White";

  const colorImagesMap = (matched.colorImages ?? {}) as unknown as Record<string, string>;
  const colorGalleriesMap = (matched.colorGalleries ?? {}) as unknown as Record<string, string[]>;
  const mainImage: string = colorImagesMap[colorName] ?? matched.productShot;
  const gallery: string[] = (colorGalleriesMap[colorName] as string[] | undefined) ?? [mainImage];

  const allVariants = (matched as unknown as {
    variants?: Array<{
      id: string;
      availableForSale: boolean;
      selectedOptions: Array<{ name: string; value: string }>;
      price?: string;
      compareAtPrice?: string;
    }>;
  }).variants;
  const filteredVariants = allVariants?.filter((v) =>
    v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && slugify(o.value) === colorSlug,
    ),
  );
  const resolvedVariants = filteredVariants?.length ? filteredVariants : allVariants;

  return {
    ...(matched as unknown as ProductConfig),
    name: colorSlug ? `${matched.name} — ${colorName}` : matched.name,
    productShot: mainImage,
    filmstrip: gallery,
    variants: resolvedVariants,
  } as ProductConfig;
}
