/**
 * Utility functions for the Moi Hydrogen storefront.
 */

/**
 * Format a Shopify price amount for EGP display.
 * Shopify returns amounts as strings like "1399.00"
 */
export function formatPrice(
  amount: string | number,
  currencyCode = 'EGP',
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${currencyCode}`;

  const formatted = new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

  return `${formatted} ${currencyCode}`;
}

/**
 * Parse a price string like "1,399 EGP" → 1399
 */
export function parseEGP(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Slugify a string for URL use.
 */
export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Convert a Shopify color name to a URL-safe slug.
 */
export function colorToSlug(colorName: string): string {
  return colorName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Convert a URL slug back to a display color name.
 */
export function slugToColor(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Get the color swatch hex value for a given product slug + color name.
 */
export const COLOR_SWATCHES: Record<string, string> = {
  white: '#f5f0e8',
  cashmere: '#d4c4b0',
  beige: '#c8b8a0',
  yellow: '#e8d080',
  teal: '#4a8a8a',
  'light blue': '#a8c8d8',
  'light-blue': '#a8c8d8',
  navy: '#3a5a7a',
  mint: '#98c8a8',
  ivory: '#e3d4cb',
};

/**
 * Construct a product URL from handle + color slug.
 */
export function productUrl(handle: string, colorSlug?: string): string {
  if (colorSlug) return `/products/${handle}-${colorSlug}`;
  return `/products/${handle}`;
}

/**
 * Truncate text to a maximum length.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

/**
 * Returns a CSS-safe color value from a Shopify option value.
 */
export function getSwatchColor(optionValue: string): string | undefined {
  const key = optionValue.toLowerCase();
  return COLOR_SWATCHES[key];
}

/**
 * Detect if running in an in-app browser (Instagram, WhatsApp, etc.)
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Instagram|FB_IAB|FBAN|FBAV|Messenger|WhatsApp|Twitter/i.test(
    navigator.userAgent,
  );
}
