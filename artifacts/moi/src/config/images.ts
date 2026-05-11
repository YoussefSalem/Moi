/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MOI — CENTRAL IMAGE CONFIGURATION
 * Edit this file to swap any image on the entire site.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * CDN ASSET STATUS (verified 2026-04-12, with browser User-Agent + Referer):
 *   02076511400-a15  ✅  200 OK  — standalone product flat-lay (cape draped)
 *   02076511400-a1   ❌  404 Not Found
 *   02076511400-a2   ❌  404 Not Found
 *   02076511400-a3   ❌  404 Not Found
 *   02076511400-a4   ❌  404 Not Found
 *   02076511400-a5   ❌  404 Not Found
 *   02076511400-a6   ❌  404 Not Found
 *   02076511400-a7   ❌  404 Not Found
 *   02076511400-a8   ❌  404 Not Found
 *   02076511400-a9   ❌  404 Not Found
 *   02076511400-a10  ❌  404 Not Found
 *   02076511400-a11  ❌  404 Not Found
 *   02076511400-a12  ❌  404 Not Found
 *   02076511400-a13  ❌  404 Not Found
 *   02076511400-a14  ❌  404 Not Found
 *
 * The model/lifestyle shots (a1–a14) simply don't exist at these CDN paths.
 * They return HTTP 404 even with a real browser User-Agent and Stradivarius Referer,
 * ruling out access-control as the cause.
 *
 * SWAP ME strategy: Replace the Unsplash/placeholder URLs below with:
 *   - Your own CDN-hosted fashion model photos
 *   - OR the Stradivarius CDN a1-a14 URLs when they become available
 */

import WHITE_MAIN from "@assets/White_Main_1778537256857.jpg";
import CASHMERE_MAIN from "@assets/Cashmere_Main_1778538163346.jpg";


// ── CDN a1–a14 substitutes (confirmed 200 OK) ─────────────
// Unsplash fashion editorial photos used in place of the unavailable CDN model shots.
// SWAP ME: replace each with the corresponding CDN URL (a1–a14) once they resolve.
const U = "https://images.unsplash.com/photo";
// attached fallback assets — used directly for the first paint
const ATTACHED_ONE = "@assets/image_1778208832966.png";
const ATTACHED_TWO = "@assets/image_1778208841709.png";
const HERO_IMAGE = `${import.meta.env.BASE_URL}hero-image.jpeg`;
// a1 substitute — attached product / variant image
const FS_A1  = ATTACHED_ONE;
// a2 substitute — attached product / variant image
const FS_A2  = ATTACHED_TWO;
// a3 substitute — attached product / variant image
const FS_A3  = ATTACHED_ONE;
// a4 substitute — attached product / variant image
const FS_A4  = ATTACHED_TWO;
// a5 substitute — attached product / variant image
const FS_A5  = ATTACHED_ONE;
// a6 substitute — attached product / variant image
const FS_A6  = ATTACHED_TWO;
// a7 substitute — attached product / variant image
const FS_A7  = ATTACHED_ONE;
// a8 substitute — attached product / variant image
const FS_A8  = ATTACHED_TWO;

// ── Look View: editorial model (a9 substitute) ────────────
// SWAP ME: replace with CDN a9 once available
const LOOK_MODEL = FS_A1;

// ── Accessory close-ups for Look View floating badges ─────
// SWAP ME: replace with branded accessory product shots
const ACC_SHOES   = `${U}-1445205170230-053b83016050?w=300&h=300&fit=crop&q=80`;
const ACC_BAG     = `${U}-1617922001439-4a2e6562f328?w=300&h=300&fit=crop&q=80`;
const ACC_EARRING = `${U}-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&q=80`;

export const IMAGES = {
  /**
   * HERO SECTION
   * videoUrl: direct .mp4 URL for the full-screen looping fashion video.
   *           Ken Burns animation (fallbackUrl) is shown if video fails to load.
   * SWAP ME: replace videoUrl with a self-hosted or Cloudinary fashion video URL.
   *          Free CDNs (Mixkit, Pexels, Pixabay, Coverr) all block hotlinking (HTTP 403).
   *          This placeholder is a confirmed-accessible MP4 (CORS *, video/mp4, ~10 MB).
   */
  hero: {
    videoUrl: "",
    fallbackUrl: HERO_IMAGE,
  },

  /**
 * PRODUCT 1 — Moi Versa Top
   * productShot : center column of the 3-col product card (CDN a15 confirmed 200 OK)
   * filmstrip[] : 8 model/lifestyle shots for the horizontal carousel (a1–a8 substitutes)
   * look.model  : full editorial model shot for the Look View (a9 substitute)
   */
  product1: {
    productShot: WHITE_MAIN,
    filmstrip: [FS_A1, FS_A2, FS_A3, FS_A4, FS_A5, FS_A6, FS_A7, FS_A8],
    look: {
      model:   LOOK_MODEL,   // a9 substitute — editorial model wearing the cape
      shoes:   ACC_SHOES,    // SWAP ME: a10 or branded shoes shot
      bag:     ACC_BAG,      // SWAP ME: a11 or branded bag shot
      earring: ACC_EARRING,  // SWAP ME: a12 or branded earring shot
    },
    colorImages: {
      White: WHITE_MAIN,
      Cashmere: CASHMERE_MAIN,
    },
    name: "Moi Versa Top",
    colorLabel: "",
    description: "A versatile top designed to be styled in multiple ways.",
    price: "1.690 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "Lining: 96% Polyester, 4% Elastane",
    ref: "2076/511/400",
    variants: [
      {
        id: "moi-versa-top-ivory-small",
        title: "Ivory / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Ivory" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-ivory-medium",
        title: "Ivory / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Ivory" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-sand-small",
        title: "Sand / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Sand" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-sand-medium",
        title: "Sand / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Sand" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-taupe-small",
        title: "Taupe / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Taupe" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-taupe-medium",
        title: "Taupe / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Taupe" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-espresso-small",
        title: "Espresso / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Espresso" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-espresso-medium",
        title: "Espresso / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Espresso" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-brown-small",
        title: "Brown / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Brown" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-brown-medium",
        title: "Brown / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Brown" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-white-small",
        title: "White / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "White" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-white-medium",
        title: "White / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "White" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-cashmere-small",
        title: "Cashmere / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Cashmere" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-cashmere-medium",
        title: "Cashmere / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Cashmere" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-black-small",
        title: "Black / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Black" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-black-medium",
        title: "Black / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Black" },
          { name: "Size", value: "Medium" },
        ],
      },
    ],
    defaultInventory: {
      ivory:    { Small: 5, Medium: 5 },
      sand:     { Small: 5, Medium: 5 },
      taupe:    { Small: 5, Medium: 5 },
      espresso: { Small: 5, Medium: 5 },
      brown:    { Small: 5, Medium: 5 },
      white:    { Small: 5, Medium: 5 },
      cashmere: { Small: 5, Medium: 5 },
      black:    { Small: 5, Medium: 5 },
    },
  },

  /**
   * PRODUCT 2 — Asymmetric Cape, Taupe
   * Same reference article (02076511400) in the Taupe colorway.
   * Uses CDN a15 for the product flat-lay (same CDN asset, Taupe variant not yet public).
   * SWAP ME: replace productShot with the Taupe CDN a15 URL when it becomes available.
   */
  product2: {
    productShot: WHITE_MAIN,        // SWAP ME: replace with Taupe product shot
    filmstrip: [FS_A3, FS_A4, FS_A5, FS_A6, FS_A7, FS_A8, FS_A1, FS_A2],
    look: {
      model:   FS_A3,        // SWAP ME: Taupe colorway editorial model shot
      shoes:   ACC_SHOES,
      bag:     ACC_BAG,
      earring: ACC_EARRING,
    },
    name: "Asymmetric Cape",
    colorLabel: "",
    description: "A versatile top designed to be styled in multiple ways.",
    price: "1.690 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "Lining: 96% Polyester, 4% Elastane",
    ref: "2076/511/401",
  },
  /**
   * PRODUCT 3 — Trio Bangles (Accessories)
   * Elegant set of three stacking bangles. Placeholder Unsplash images.
   * SWAP ME: replace with branded product photography when available.
   */
  product3: {
    productShot: `${U}-1611591437281-460bfbe1220a?w=800&fit=crop&q=80`,
    filmstrip: [
      `${U}-1611591437281-460bfbe1220a?w=600&fit=crop&q=80`,
      `${U}-1603561591411-07134e71a2a9?w=600&fit=crop&q=80`,
      `${U}-1588444837495-c6cfeb53f32d?w=600&fit=crop&q=80`,
      `${U}-1515562141207-7a88fb7ce338?w=600&fit=crop&q=80`,
      `${U}-1611591437281-460bfbe1220a?w=600&fit=crop&q=80`,
      `${U}-1603561591411-07134e71a2a9?w=600&fit=crop&q=80`,
    ],
    look: {
      model:   `${U}-1611591437281-460bfbe1220a?w=800&fit=crop&q=80`,
      shoes:   ACC_SHOES,
      bag:     ACC_BAG,
      earring: ACC_EARRING,
    },
    name: "Trio Bangles",
    colorLabel: "",
    description: "Three slim stacking bangles in a polished finish — worn together or layered freely. Lightweight, adjustable, and crafted to accompany every look.",
    price: "890 EGP",
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
  selectedOptions: readonly { name: string; value: string }[];
}

export interface ProductConfig {
  readonly productShot: string;
  readonly filmstrip: readonly string[];
  readonly look: {
    readonly model: string;
    readonly shoes: string;
    readonly bag: string;
    readonly earring: string;
  };
  readonly name: string;
  readonly colorLabel: string;
  readonly description: string;
  readonly price: string;
  readonly outer: string;
  readonly lining: string;
  readonly ref: string;
  readonly variantId?: string;
  readonly variants?: readonly VariantOption[];
  readonly defaultInventory?: Record<string, Record<string, number>>;
  readonly colorSwatches?: Record<string, string>;
  readonly colorImages?: Record<string, string>;
}
