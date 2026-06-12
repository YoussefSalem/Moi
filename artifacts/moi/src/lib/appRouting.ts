import { IMAGES, type ProductConfig } from "@/config/images";

export const KNOWN_PRODUCT_SLUGS = ["moi-wavvy", "moi-versa-top", "trio-bangles"];

const SECTION_PATH_MAP: Record<string, string> = {
  "/versa-top": "moi-versa-top",
  "/wavvy-top": "moi-wavvy",
};

const POLICY_PAGES = ["privacy", "refund", "return", "delivery"];

export type PageType =
  | "home"
  | "product"
  | "checkout"
  | "order-confirmation"
  | "payment-failed"
  | "accessories"
  | "ambassador"
  | "notfound"
  | "privacy"
  | "refund"
  | "return"
  | "delivery";

export function parsePath(): { page: PageType; productHandle: string; section?: string } {
  if (typeof window === "undefined") return { page: "home", productHandle: "" };
  const pathname = window.location.pathname;
  if (pathname.startsWith("/products/")) {
    const handle = pathname.slice("/products/".length);
    const matchedSlug = KNOWN_PRODUCT_SLUGS.find(
      (p) => handle === p || handle.startsWith(p + "-"),
    );
    if (!matchedSlug) return { page: "notfound", productHandle: handle };
    return { page: "product", productHandle: handle };
  }
  if (pathname === "/payment/success" || pathname === "/order-confirmed") {
    const hasActive   = sessionStorage.getItem("moi_order_confirmed_active") !== null;
    const hasPrimary  =
      sessionStorage.getItem("moi_order_confirmation") !== null ||
      sessionStorage.getItem("moi_paymob_items") !== null;
    if (!hasActive && !hasPrimary) {
      window.history.replaceState(null, "", "/");
      return { page: "home", productHandle: "" };
    }
    return { page: "order-confirmation", productHandle: "" };
  }
  if (pathname === "/payment/failed") return { page: "payment-failed", productHandle: "" };
  if (pathname === "/checkout")       return { page: "checkout",       productHandle: "" };
  if (pathname === "/accessories")    return { page: "accessories",    productHandle: "" };
  if (pathname === "/ambassador")     return { page: "ambassador",     productHandle: "" };
  const sectionId = SECTION_PATH_MAP[pathname];
  if (sectionId) return { page: "home", productHandle: "", section: sectionId };
  const slug = pathname.slice(1) as PageType;
  if (POLICY_PAGES.includes(slug)) return { page: slug, productHandle: "" };
  return { page: "home", productHandle: "" };
}

export const FALLBACK_PRODUCTS: ProductConfig[] = [IMAGES.product1, IMAGES.product2, IMAGES.product3 as ProductConfig];

export function deriveColors(product: ProductConfig): { name: string }[] {
  if (product.variants && product.variants.length > 0) {
    const seen   = new Set<string>();
    const result: { name: string }[] = [];
    for (const v of product.variants) {
      const colorOpt = v.selectedOptions.find((o) => o.name.toLowerCase() === "color");
      if (colorOpt && !seen.has(colorOpt.value)) {
        seen.add(colorOpt.value);
        result.push({ name: colorOpt.value });
      }
    }
    if (result.length > 0) return result;
  }
  return Object.keys((product.colorImages ?? {}) as Record<string, string>).map((name) => ({ name }));
}
