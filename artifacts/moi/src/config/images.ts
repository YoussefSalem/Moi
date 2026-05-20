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

// ── Compressed product images (~130–280 KB each, down from 8–11 MB originals) ──
// Imported as ES modules so Vite generates correct content-hashed URLs.
// SWAP ME: replace with CDN URLs when available.
import WHITE_MAIN    from "@/assets/images/white.webp";
import WHITE_ALT_ONE  from "@/assets/images/IMG_1996_1778613360425-opt.webp";
import WHITE_ALT_TWO  from "@/assets/images/IMG_1993_1778613360426-opt.webp";
import CASHMERE_MAIN from "@/assets/images/cashmere-main-new.webp";
import CASHMERE_ALT_1 from "@/assets/images/cashmere-alt-1.webp";
import CASHMERE_ALT_2 from "@/assets/images/cashmere-alt-2.webp";
import CASHMERE_ALT_3 from "@/assets/images/cashmere-alt-3.webp";
import BEIGE_MAIN    from "@/assets/images/beige.webp";
import BEIGE_ALT_1   from "@/assets/images/beige-alt-1.webp";
import BEIGE_ALT_2   from "@/assets/images/beige-alt-2.webp";
import BEIGE_ALT_3   from "@/assets/images/beige-alt-3.webp";
import YELLOW_MAIN   from "@/assets/images/yellow.webp";
import YELLOW_ALT_1  from "@/assets/images/yellow-alt-1.webp";
import YELLOW_ALT_2  from "@/assets/images/yellow-alt-2.webp";
import TEAL_MAIN     from "@/assets/images/teal.webp";
import TEAL_ALT_1    from "@/assets/images/teal-alt-1.webp";
import TEAL_ALT_2    from "@/assets/images/teal-alt-2.webp";
import TEAL_ALT_3    from "@/assets/images/teal-alt-3.webp";
import LIGHT_BLUE_MAIN from "@/assets/images/light-blue.webp";
import LIGHT_BLUE_ALT_1 from "@/assets/images/light-blue-alt-1.webp";
import LIGHT_BLUE_ALT_2 from "@/assets/images/light-blue-alt-2.webp";
import NAVI_MAIN from "@/assets/images/navi.webp";
import NAVI_ALT from "@/assets/images/navi-alt.webp";
import MINT_MAIN from "@/assets/images/mint.webp";
import MINT_ALT_1 from "@/assets/images/mint-alt-1.webp";
import MINT_ALT_2 from "@/assets/images/mint-alt-2.webp";
import BANGLES_MAIN from "@/assets/images/bangles-main.webp";
import BANGLES_ALT_1 from "@/assets/images/bangles-alt-1.webp";
import BANGLES_ALT_2 from "@/assets/images/bangles-alt-2.webp";
import BANGLES_ALT_3 from "@/assets/images/bangles-alt-3.webp";
import BANGLES_ALT_4 from "@/assets/images/bangles-alt-4.webp";
// filmstrip fallback assets (compressed)
import ATTACHED_ONE  from "@/assets/images/filmstrip-a.webp";
import ATTACHED_TWO  from "@/assets/images/filmstrip-b.webp";
const WHITE_GALLERY = [WHITE_MAIN, WHITE_ALT_ONE, WHITE_ALT_TWO];
const CASHMERE_GALLERY = [CASHMERE_MAIN, CASHMERE_ALT_1, CASHMERE_ALT_2, CASHMERE_ALT_3];
const BEIGE_GALLERY = [BEIGE_MAIN, BEIGE_ALT_1, BEIGE_ALT_2];
const YELLOW_GALLERY = [YELLOW_MAIN, YELLOW_ALT_1, YELLOW_ALT_2];
const TEAL_GALLERY = [TEAL_MAIN, TEAL_ALT_1, TEAL_ALT_2, TEAL_ALT_3];

// ── CDN a1–a14 substitutes (confirmed 200 OK) ─────────────
// Unsplash fashion editorial photos used in place of the unavailable CDN model shots.
// SWAP ME: replace each with the corresponding CDN URL (a1–a14) once they resolve.
const U = "https://images.unsplash.com/photo";
const HERO_IMAGE = `${import.meta.env.BASE_URL}hero-image.webp`;
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

// ── Moi Wavvy — Look View images (real brand photography) ─
const WAVVY_LOOK_1 = "/images/wavvy-look-1.webp";
const WAVVY_LOOK_2 = "/images/wavvy-look-2.webp";
const WAVVY_LOOK_3 = "/images/wavvy-look-3.webp";
const WAVVY_LOOK_4 = "/images/wavvy-look-4.webp";
const WAVVY_LOOK_5 = "/images/wavvy-look-5.webp";

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
    name: "Moi Wavvy",
    shopifyTitle: "Moi Versa Top",
    colorLabel: "",
    description: "The ultimate throw-and-go. Effortless design, Wavy is light, breathable, and made for drifting.",
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
      {
        id: "moi-versa-top-light-blue-small",
        title: "Light Blue / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Light Blue" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-light-blue-medium",
        title: "Light Blue / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Light Blue" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-navy-small",
        title: "Navy / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Navy" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-navy-medium",
        title: "Navy / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Navy" },
          { name: "Size", value: "Medium" },
        ],
      },
      {
        id: "moi-versa-top-mint-small",
        title: "Mint / Small",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Mint" },
          { name: "Size", value: "Small" },
        ],
      },
      {
        id: "moi-versa-top-mint-medium",
        title: "Mint / Medium",
        availableForSale: true,
        inventoryQuantity: 5,
        price: "1.690 EGP",
        selectedOptions: [
          { name: "Color", value: "Mint" },
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
      "light blue": { Small: 5, Medium: 5 },
      navy:     { Small: 5, Medium: 5 },
      mint:     { Small: 5, Medium: 5 },
    },
  },

  /**
   * PRODUCT 2 — Asymmetric Cape, Taupe
   * Same reference article (02076511400) in the Taupe colorway.
   * Uses CDN a15 for the product flat-lay (same CDN asset, Taupe variant not yet public).
   * SWAP ME: replace productShot with the Taupe CDN a15 URL when it becomes available.
   */
  product2: {
    slug: "moi-versa",
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
    name: "Moi Wavvy",
    shopifyTitle: "Moi Versa Top",
    colorLabel: "",
    description: "The ultimate throw-and-go. Effortless design, Wavy is light, breathable, and made for drifting.",
    price: "1.690 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "Lining: 96% Polyester, 4% Elastane",
    ref: "2076/511/401",
    variants: [
      { id: "moi-versa-top-ivory-small",      title: "Ivory / Small",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Ivory" },      { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-ivory-medium",     title: "Ivory / Medium",      availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Ivory" },      { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-sand-small",       title: "Sand / Small",        availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Sand" },       { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-sand-medium",      title: "Sand / Medium",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Sand" },       { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-taupe-small",      title: "Taupe / Small",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Taupe" },      { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-taupe-medium",     title: "Taupe / Medium",      availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Taupe" },      { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-espresso-small",   title: "Espresso / Small",    availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Espresso" },   { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-espresso-medium",  title: "Espresso / Medium",   availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Espresso" },   { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-brown-small",      title: "Brown / Small",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Brown" },      { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-brown-medium",     title: "Brown / Medium",      availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Brown" },      { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-white-small",      title: "White / Small",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "White" },      { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-white-medium",     title: "White / Medium",      availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "White" },      { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-cashmere-small",   title: "Cashmere / Small",    availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Cashmere" },   { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-cashmere-medium",  title: "Cashmere / Medium",   availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Cashmere" },   { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-black-small",      title: "Black / Small",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Black" },      { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-black-medium",     title: "Black / Medium",      availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Black" },      { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-light-blue-small", title: "Light Blue / Small",  availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Light Blue" }, { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-light-blue-medium",title: "Light Blue / Medium", availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Light Blue" }, { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-navy-small",       title: "Navy / Small",        availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Navy" },       { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-navy-medium",      title: "Navy / Medium",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Navy" },       { name: "Size", value: "Medium" }] },
      { id: "moi-versa-top-mint-small",       title: "Mint / Small",        availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Mint" },       { name: "Size", value: "Small"  }] },
      { id: "moi-versa-top-mint-medium",      title: "Mint / Medium",       availableForSale: true, inventoryQuantity: 5, price: "1.690 EGP", selectedOptions: [{ name: "Color", value: "Mint" },       { name: "Size", value: "Medium" }] },
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
      "light blue": { Small: 5, Medium: 5 },
      navy:     { Small: 5, Medium: 5 },
      mint:     { Small: 5, Medium: 5 },
    },
  },
  /**
   * PRODUCT 3 — Trio Bangles (Accessories)
   * Elegant set of three stacking bangles. Placeholder Unsplash images.
   * SWAP ME: replace with branded product photography when available.
   */
  product3: {
    slug: "trio-bangles",
    productShot: BANGLES_MAIN,
    filmstrip: [
      BANGLES_ALT_1,
      BANGLES_ALT_2,
      BANGLES_ALT_3,
    ],
    look: {
      model:   "",
      shoes:   "",
      bag:     "",
      earring: "",
    },
    colorImages: {
      Ivory: BANGLES_MAIN,
      Beige: BANGLES_MAIN,
      "One Size": BANGLES_MAIN,
    },
    colorGalleries: {
      Ivory: [BANGLES_MAIN, BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
      Beige: [BANGLES_MAIN, BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
    },
    colorSwatches: {
      ivory: "#e3d4cb",
      beige: "#e3d4cb",
    },
    name: "Trio Bangles",
    shopifyTitle: "Trio Bangles.",
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
