import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalise a Shopify checkout URL to use the brand domain */
export function normalizeCheckoutUrl(checkoutUrl: string, checkoutDomain?: string): string {
  if (!checkoutDomain || !checkoutUrl) return checkoutUrl;
  try {
    const url = new URL(checkoutUrl);
    url.hostname = checkoutDomain;
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

/** Convert a color name to a CSS-safe slug. "Light Blue" → "light-blue" */
export function colorToSlug(color: string): string {
  return color.toLowerCase().replace(/\s+/g, "-");
}

/** Capitalise each word */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract the numeric ID from a Shopify GID */
export function parseGid(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}
