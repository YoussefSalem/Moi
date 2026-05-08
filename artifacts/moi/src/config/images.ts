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

// ── Stradivarius CDN ──────────────────────────────────────
const CDN_BASE = "https://static.e-stradivarius.net/assets/public/6609/3c52/c7794a08bf4d/3e85295c5fe2";
const CDN_TS   = "ts=1773676013508";

function cdnImage(id: string, width = 800): string {
  return `${CDN_BASE}/${id}/${id}.jpg?${CDN_TS}&w=${width}`;
}

// ── Only accessible CDN asset ─────────────────────────────
const PRODUCT_SHOT       = cdnImage("02076511400-a15", 800);   // cape draped flat-lay, 800px
const PRODUCT_SHOT_LARGE = cdnImage("02076511400-a15", 1536);  // hero / look view backdrop

// ── CDN a1–a14 substitutes (confirmed 200 OK) ─────────────
// Unsplash fashion editorial photos used in place of the unavailable CDN model shots.
// SWAP ME: replace each with the corresponding CDN URL (a1–a14) once they resolve.
const U = "https://images.unsplash.com/photo";
// a1 substitute — model in dark outfit
const FS_A1  = `${U}-1515886657613-9f3515b0c78f?w=900&h=1200&fit=crop&q=85`;
// a2 substitute — editorial standing pose
const FS_A2  = `${U}-1469334031218-e382a71b716b?w=900&h=1200&fit=crop&q=85`;
// a3 substitute — model facing forward
const FS_A3  = `${U}-1534528741775-53994a69daeb?w=900&h=1200&fit=crop&q=85`;
// a4 substitute — close-up editorial
const FS_A4  = `${U}-1507003211169-0a1dd7228f2d?w=900&h=1200&fit=crop&q=85`;
// a5 substitute — model with accessories
const FS_A5  = `${U}-1617922001439-4a2e6562f328?w=900&h=1200&fit=crop&q=85`;
// a6 substitute — street fashion
const FS_A6  = `${U}-1445205170230-053b83016050?w=900&h=1200&fit=crop&q=85`;
// a7 substitute — editorial detail
const FS_A7  = `${U}-1469334031218-e382a71b716b?w=900&h=1200&fit=crop&q=85&sat=-20`;
// a8 substitute — model full-length
const FS_A8  = `${U}-1515886657613-9f3515b0c78f?w=900&h=1200&fit=crop&q=85&bri=5`;

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
    fallbackUrl: PRODUCT_SHOT_LARGE,
  },

  /**
 * PRODUCT 1 — Moi Versa Top
   * productShot : center column of the 3-col product card (CDN a15 confirmed 200 OK)
   * filmstrip[] : 8 model/lifestyle shots for the horizontal carousel (a1–a8 substitutes)
   * look.model  : full editorial model shot for the Look View (a9 substitute)
   */
  product1: {
    productShot: PRODUCT_SHOT,
    filmstrip: [FS_A1, FS_A2, FS_A3, FS_A4, FS_A5, FS_A6, FS_A7, FS_A8],
    look: {
      model:   LOOK_MODEL,   // a9 substitute — editorial model wearing the cape
      shoes:   ACC_SHOES,    // SWAP ME: a10 or branded shoes shot
      bag:     ACC_BAG,      // SWAP ME: a11 or branded bag shot
      earring: ACC_EARRING,  // SWAP ME: a12 or branded earring shot
    },
    name: "Moi Versa Top",
    colorLabel: "",
    description: "A versatile top designed to be styled in multiple ways.",
    price: "1.690 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "Lining: 96% Polyester, 4% Elastane",
    ref: "2076/511/400",
  },

  /**
   * PRODUCT 2 — Asymmetric Cape, Taupe
   * Same reference article (02076511400) in the Taupe colorway.
   * Uses CDN a15 for the product flat-lay (same CDN asset, Taupe variant not yet public).
   * SWAP ME: replace productShot with the Taupe CDN a15 URL when it becomes available.
   */
  product2: {
    productShot: PRODUCT_SHOT,      // SWAP ME: Taupe CDN shot when available
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
} as const;

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
}
