/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MOI — CENTRAL IMAGE CONFIGURATION (Hydrogen version)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * In Hydrogen, static images are served from the /public folder.
 * All paths below are relative to /public — they map to /images/... at runtime.
 *
 * SWAP ME: replace /images/... paths with Shopify CDN URLs or your own CDN.
 * Shopify product images are available via the Storefront API and are injected
 * by the route loaders — this file is only used as a local fallback when
 * Shopify data hasn't loaded yet (e.g. during SSR or cold start).
 */

const IMG = (name: string) => `/images/${name}`;

const HERO_IMAGE = "/images/hero-image.jpeg";

const WHITE_MAIN    = IMG("white.jpg");
const WHITE_ALT_ONE  = IMG("IMG_1996_1778613360425-opt.jpg");
const WHITE_ALT_TWO  = IMG("IMG_1993_1778613360426-opt.jpg");
const CASHMERE_MAIN = IMG("cashmere-main-new.jpg");
const CASHMERE_ALT_1 = IMG("cashmere-alt-1.jpg");
const CASHMERE_ALT_2 = IMG("cashmere-alt-2.jpg");
const CASHMERE_ALT_3 = IMG("cashmere-alt-3.jpg");
const BEIGE_MAIN    = IMG("beige.jpg");
const BEIGE_ALT_1   = IMG("beige-alt-1.jpg");
const BEIGE_ALT_2   = IMG("beige-alt-2.jpg");
const BEIGE_ALT_3   = IMG("beige-alt-3.jpg");
const YELLOW_MAIN   = IMG("yellow.jpg");
const YELLOW_ALT_1  = IMG("yellow-alt-1.jpg");
const YELLOW_ALT_2  = IMG("yellow-alt-2.jpg");
const TEAL_MAIN     = IMG("teal.jpg");
const TEAL_ALT_1    = IMG("teal-alt-1.jpg");
const TEAL_ALT_2    = IMG("teal-alt-2.jpg");
const TEAL_ALT_3    = IMG("teal-alt-3.jpg");
const LIGHT_BLUE_MAIN = IMG("light-blue.jpg");
const LIGHT_BLUE_ALT_1 = IMG("light-blue-alt-1.jpg");
const LIGHT_BLUE_ALT_2 = IMG("light-blue-alt-2.jpg");
const NAVI_MAIN = IMG("navi.jpg");
const NAVI_ALT = IMG("navi-alt.jpg");
const MINT_MAIN = IMG("mint.jpg");
const MINT_ALT_1 = IMG("mint-alt-1.jpg");
const MINT_ALT_2 = IMG("mint-alt-2.jpg");
const BANGLES_MAIN = IMG("bangles-main.jpg");
const BANGLES_ALT_1 = IMG("bangles-alt-1.jpg");
const BANGLES_ALT_2 = IMG("bangles-alt-2.jpg");
const BANGLES_ALT_3 = IMG("bangles-alt-3.jpg");
const BANGLES_ALT_4 = IMG("bangles-alt-4.jpg");
const ATTACHED_ONE = IMG("filmstrip-a.jpg");
const ATTACHED_TWO = IMG("filmstrip-b.jpg");

const WHITE_GALLERY = [WHITE_MAIN, WHITE_ALT_ONE, WHITE_ALT_TWO];
const CASHMERE_GALLERY = [CASHMERE_MAIN, CASHMERE_ALT_1, CASHMERE_ALT_2, CASHMERE_ALT_3];
const BEIGE_GALLERY = [BEIGE_MAIN, BEIGE_ALT_1, BEIGE_ALT_2, BEIGE_ALT_3];
const YELLOW_GALLERY = [YELLOW_MAIN, YELLOW_ALT_1, YELLOW_ALT_2];
const TEAL_GALLERY = [TEAL_MAIN, TEAL_ALT_1, TEAL_ALT_2, TEAL_ALT_3];

const FS_A1 = ATTACHED_ONE;
const FS_A2 = ATTACHED_TWO;
const FS_A3 = ATTACHED_ONE;
const FS_A4 = ATTACHED_TWO;
const FS_A5 = ATTACHED_ONE;
const FS_A6 = ATTACHED_TWO;
const FS_A7 = ATTACHED_ONE;
const FS_A8 = ATTACHED_TWO;

const WAVVY_LOOK_1 = "/images/wavvy-look-1.jpg";
const WAVVY_LOOK_2 = "/images/wavvy-look-2.jpg";
const WAVVY_LOOK_3 = "/images/wavvy-look-3.jpg";
const WAVVY_LOOK_4 = "/images/wavvy-look-4.jpg";
const WAVVY_LOOK_5 = "/images/wavvy-look-5.jpg";

export const IMAGES = {
  hero: {
    videoUrl: "",
    fallbackUrl: HERO_IMAGE,
  },

  product1: {
    slug: "moi-wavvy",
    productShot: BEIGE_MAIN,
    filmstrip: [FS_A1, FS_A2, FS_A3, FS_A4, FS_A5, FS_A6, FS_A7, FS_A8],
    look: {
      model:   WAVVY_LOOK_3,
      shoes:   WAVVY_LOOK_1,
      bag:     WAVVY_LOOK_4,
      earring: WAVVY_LOOK_5,
      extra:   WAVVY_LOOK_2,
    },
    colorImages: {
      White: WHITE_MAIN,
      Cashmere: CASHMERE_MAIN,
      Cashemere: CASHMERE_MAIN,
      Beige: BEIGE_MAIN,
      Yellow: YELLOW_MAIN,
      Teal: TEAL_MAIN,
      "Light Blue": LIGHT_BLUE_MAIN,
      Navy: NAVI_MAIN,
      Mint: MINT_MAIN,
    },
    colorGalleries: {
      White: WHITE_GALLERY,
      Cashmere: CASHMERE_GALLERY,
      Cashemere: CASHMERE_GALLERY,
      Beige: BEIGE_GALLERY,
      Yellow: YELLOW_GALLERY,
      Teal: TEAL_GALLERY,
      "Light Blue": [LIGHT_BLUE_MAIN, LIGHT_BLUE_ALT_1, LIGHT_BLUE_ALT_2],
      Navy: [NAVI_MAIN, NAVI_ALT],
      Mint: [MINT_MAIN, MINT_ALT_1, MINT_ALT_2],
    },
    colorSwatches: {
      white: "#f5f0e8",
      cashmere: "#d4c4b0",
      cashemere: "#d4c4b0",
      beige: "#c8b8a0",
      yellow: "#e8d080",
      teal: "#4a8a8a",
      "light blue": "#a8c8d8",
      navy: "#3a5a7a",
      mint: "#98c8a8",
    },
    name: "MOI WAVVY",
    shopifyTitle: "MOI WAVVY",
    colorLabel: "",
    description: "The ultimate throw-and-go. Effortless design, Wavy is light, breathable, and made for drifting.",
    descriptionBullets: [
      "The ultimate throw-and-go piece.",
      "Effortless design makes it easy to wear.",
      "Wavy is light for all-day comfort.",
      "Breathable fabric keeps you cool.",
      "Made for drifting with ease.",
    ],
    price: "899 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "",
    ref: "2076/511/400",
    variants: [
      { id: "moi-wavvy-light-blue", title: "Light Blue / One Size", availableForSale: true, inventoryQuantity: 5, price: "899 EGP", compareAtPrice: "1,500 EGP", selectedOptions: [{ name: "Color", value: "Light Blue" }, { name: "Size", value: "One Size" }] },
      { id: "moi-wavvy-navy",       title: "Navy / One Size",       availableForSale: true, inventoryQuantity: 5, price: "899 EGP", compareAtPrice: "1,500 EGP", selectedOptions: [{ name: "Color", value: "Navy" },       { name: "Size", value: "One Size" }] },
      { id: "moi-wavvy-mint",       title: "Mint / One Size",       availableForSale: false, inventoryQuantity: 0, price: "899 EGP", compareAtPrice: "1,500 EGP", selectedOptions: [{ name: "Color", value: "Mint" },       { name: "Size", value: "One Size" }] },
    ],
    defaultInventory: {
      "light blue": { "One Size": 5 },
      navy:  { "One Size": 5 },
      mint:  { "One Size": 5 },
    },
  },

  product2: {
    slug: "moi-versa-top",
    productShot: WHITE_MAIN,
    filmstrip: [FS_A3, FS_A4, FS_A5, FS_A6, FS_A7, FS_A8, FS_A1, FS_A2],
    look: {
      model:   WAVVY_LOOK_3,
      shoes:   WAVVY_LOOK_1,
      bag:     WAVVY_LOOK_4,
      earring: WAVVY_LOOK_5,
      extra:   WAVVY_LOOK_2,
    },
    colorImages: {
      White: WHITE_MAIN,
      Cashmere: CASHMERE_MAIN,
      Cashemere: CASHMERE_MAIN,
      Beige: BEIGE_MAIN,
      Yellow: YELLOW_MAIN,
      Teal: TEAL_MAIN,
    },
    colorGalleries: {
      White: WHITE_GALLERY,
      Cashmere: CASHMERE_GALLERY,
      Cashemere: CASHMERE_GALLERY,
      Beige: BEIGE_GALLERY,
      Yellow: YELLOW_GALLERY,
      Teal: TEAL_GALLERY,
    },
    colorSwatches: {
      white: "#f5f0e8",
      cashmere: "#d4c4b0",
      cashemere: "#d4c4b0",
      beige: "#c8b8a0",
      yellow: "#e8d080",
      teal: "#4a8a8a",
    },
    name: "MOI VERSA TOP",
    shopifyTitle: "MOI VERSA TOP",
    colorLabel: "",
    description: "The signature wrap silhouette. Designed to drape beautifully, the Versa Top transitions effortlessly from day to night.",
    descriptionBullets: [
      "The signature wrap silhouette.",
      "Designed to drape beautifully.",
      "Transitions effortlessly from day to night.",
      "Light and comfortable for all-day wear.",
      "A polished piece that elevates every look.",
    ],
    price: "1,399 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "Lining: 96% Polyester, 4% Elastane",
    ref: "2076/511/401",
    variants: [
      { id: "moi-versa-top-white-sm",     title: "White / S/M",    availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "White" },    { name: "Size", value: "S/M"  }] },
      { id: "moi-versa-top-white-lxl",    title: "White / L/XL",   availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "White" },    { name: "Size", value: "L/XL" }] },
      { id: "moi-versa-top-cashmere-sm",  title: "Cashmere / S/M", availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Cashmere" }, { name: "Size", value: "S/M"  }] },
      { id: "moi-versa-top-cashmere-lxl", title: "Cashmere / L/XL",availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Cashmere" }, { name: "Size", value: "L/XL" }] },
      { id: "moi-versa-top-beige-sm",     title: "Beige / S/M",    availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Beige" },    { name: "Size", value: "S/M"  }] },
      { id: "moi-versa-top-beige-lxl",    title: "Beige / L/XL",   availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Beige" },    { name: "Size", value: "L/XL" }] },
      { id: "moi-versa-top-yellow-sm",    title: "Yellow / S/M",   availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Yellow" },   { name: "Size", value: "S/M"  }] },
      { id: "moi-versa-top-yellow-lxl",   title: "Yellow / L/XL",  availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Yellow" },   { name: "Size", value: "L/XL" }] },
      { id: "moi-versa-top-teal-sm",      title: "Teal / S/M",     availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Teal" },     { name: "Size", value: "S/M"  }] },
      { id: "moi-versa-top-teal-lxl",     title: "Teal / L/XL",    availableForSale: true, inventoryQuantity: 5, price: "1,399 EGP", selectedOptions: [{ name: "Color", value: "Teal" },     { name: "Size", value: "L/XL" }] },
    ],
    defaultInventory: {
      white:    { "S/M": 5, "L/XL": 5 },
      cashmere: { "S/M": 5, "L/XL": 5 },
      beige:    { "S/M": 5, "L/XL": 5 },
      yellow:   { "S/M": 5, "L/XL": 5 },
      teal:     { "S/M": 5, "L/XL": 5 },
    },
  },

  product3: {
    slug: "trio-bangles",
    productShot: BANGLES_MAIN,
    filmstrip: [BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3, BANGLES_ALT_4],
    look: { model: "", shoes: "", bag: "", earring: "" },
    colorImages: {
      Ivory: BANGLES_MAIN,
      Beige: BANGLES_MAIN,
      "One Size": BANGLES_MAIN,
    },
    colorGalleries: {
      Ivory: [BANGLES_MAIN, BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
      Beige: [BANGLES_MAIN, BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
    },
    colorSwatches: { ivory: "#e3d4cb", beige: "#e3d4cb" },
    name: "Trio Bangles",
    shopifyTitle: "Trio Bangles.",
    colorLabel: "",
    description: "Three slim stacking bangles in a polished finish — worn together or layered freely. Lightweight, adjustable, and crafted to accompany every look.",
    price: "890 EGP",
    variants: [{ id: "trio-bangles-one-size", title: "One Size", availableForSale: false, price: "890 EGP", selectedOptions: [{ name: "Size", value: "One Size" }] }],
    outer: "Material: Brass with gold-tone plating",
    lining: "Set of 3 bangles",
    ref: "ACC/001/TRB",
  },
} as const;

export interface VariantOption {
  id: string;
  title: string;
  availableForSale: boolean;
  inventoryQuantity?: number;
  price: string;
  compareAtPrice?: string;
  selectedOptions: readonly { name: string; value: string }[];
}

export interface ProductConfig {
  readonly slug: string;
  readonly productShot: string;
  readonly filmstrip: readonly string[];
  readonly look: {
    readonly model: string;
    readonly shoes: string;
    readonly bag: string;
    readonly earring: string;
    readonly extra?: string;
  };
  readonly name: string;
  readonly colorLabel: string;
  readonly description: string;
  readonly descriptionBullets?: readonly string[];
  readonly price: string;
  readonly outer: string;
  readonly lining: string;
  readonly ref: string;
  readonly variantId?: string;
  readonly variants?: readonly VariantOption[];
  readonly defaultInventory?: Record<string, Record<string, number>>;
  readonly colorSwatches?: Record<string, string>;
  readonly colorImages?: Record<string, string>;
  readonly colorGalleries?: Record<string, readonly string[]>;
}
