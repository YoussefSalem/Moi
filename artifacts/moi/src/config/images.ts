/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MOI — CENTRAL IMAGE CONFIGURATION
 * Edit this file to swap any image on the entire site.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ── Stradivarius CDN ──────────────────────────────────────
// Only a15 is confirmed accessible from the CDN.
// a1–a14 return 404 (model/angle shots are access-restricted).
// To use the real shots, replace the Unsplash URLs below with
// the CDN URLs once they become public or use an authenticated API.
const CDN_BASE = "https://static.e-stradivarius.net/assets/public/6609/3c52/c7794a08bf4d/3e85295c5fe2";
const CDN_TS  = "ts=1773676013508";

function cdnImage(id: string, width = 800): string {
  return `${CDN_BASE}/${id}/${id}.jpg?${CDN_TS}&w=${width}`;
}

// ── Confirmed CDN images ──────────────────────────────────
// SWAP ME: replace these with actual CDN a1–a15 when available
const PRODUCT_SHOT       = cdnImage("02076511400-a15", 800);  // standalone product (cape draped)
const PRODUCT_SHOT_LARGE = cdnImage("02076511400-a15", 1536); // for hero / look view

// ── Unsplash model/editorial images (confirmed 200 OK) ────
// SWAP ME: replace with the Stradivarius model shots a1–a14 once accessible
const U = "https://images.unsplash.com/photo";
const MODEL_A = `${U}-1515886657613-9f3515b0c78f?w=900&h=1200&fit=crop&q=85`; // model dark outfit
const MODEL_B = `${U}-1469334031218-e382a71b716b?w=900&h=1200&fit=crop&q=85`; // editorial
const MODEL_C = `${U}-1534528741775-53994a69daeb?w=900&h=1200&fit=crop&q=85`; // model standing
const MODEL_D = `${U}-1507003211169-0a1dd7228f2d?w=900&h=1200&fit=crop&q=85`; // close-up
const MODEL_E = `${U}-1617922001439-4a2e6562f328?w=900&h=1200&fit=crop&q=85`; // with bag
const MODEL_F = `${U}-1445205170230-053b83016050?w=900&h=1200&fit=crop&q=85`; // street style

// ── Accessory images for Look View ────────────────────────
// SWAP ME: replace with branded product shots
const ACC_SHOES   = `${U}-1445205170230-053b83016050?w=300&h=300&fit=crop&q=80`; // shoes detail
const ACC_BAG     = `${U}-1617922001439-4a2e6562f328?w=300&h=300&fit=crop&q=80`; // bag detail
const ACC_EARRING = `${U}-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&q=80`; // jewelry detail

export const IMAGES = {
  /**
   * HERO SECTION
   * videoUrl: set to a direct .mp4 URL for a looping fashion video
   *           (empty = falls back to fallbackUrl image with Ken Burns animation)
   */
  hero: {
    // SWAP ME: replace with a hosted fashion .mp4 (e.g. from Cloudinary or your CDN).
    // Hotlinking from Mixkit/Pexels/Pixabay returns 403; use a self-hosted or CDN URL.
    // This placeholder confirms the video infrastructure (autoplay/muted/loop + Ken Burns fallback).
    videoUrl: "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4",
    fallbackUrl: PRODUCT_SHOT_LARGE,
  },

  /**
   * PRODUCT 1 — Asymmetric Cape, Brown
   * productShot: the standalone cape photo (center column of the product card)
   * filmstrip[]: model shots for the horizontal carousel (a1–a8 equivalents)
   */
  product1: {
    productShot: PRODUCT_SHOT,
    filmstrip: [MODEL_A, MODEL_B, MODEL_C, MODEL_D, MODEL_E, MODEL_F, MODEL_A, MODEL_B],
    look: {
      model: PRODUCT_SHOT_LARGE,   // SWAP ME: Pexels/Unsplash model wearing the cape
      shoes: ACC_SHOES,            // SWAP ME: shoes product shot
      bag: ACC_BAG,                // SWAP ME: bag product shot
      earring: ACC_EARRING,        // SWAP ME: earring product shot
    },
    name: "Asymmetric Cape",
    colorLabel: "BROWN | REF: 2076/511/400",
    description: "Asymmetric cape with a single wide sleeve and an exposed shoulder. Ruched detail on the side. Available in several colours.",
    price: "1.690 EGP",
    outer: "Outer shell: 100% Polyester",
    lining: "Lining: 96% Polyester, 4% Elastane",
    ref: "2076/511/400",
  },

  /**
   * PRODUCT 2 — Asymmetric Cape, Taupe
   * Second stacked product card (same product, different colorway)
   */
  product2: {
    productShot: MODEL_C,           // SWAP ME: CDN taupe colorway shot
    filmstrip: [MODEL_C, MODEL_D, MODEL_E, MODEL_F, MODEL_A, MODEL_B, MODEL_C, MODEL_D],
    look: {
      model: MODEL_C,
      shoes: ACC_SHOES,
      bag: ACC_BAG,
      earring: ACC_EARRING,
    },
    name: "Asymmetric Cape",
    colorLabel: "TAUPE | REF: 2076/511/401",
    description: "Asymmetric cape with a single wide sleeve and an exposed shoulder. Ruched detail on the side. Available in several colours.",
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
}
