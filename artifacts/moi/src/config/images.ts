import WHITE_MAIN    from "@/assets/images/white.jpg";
import WHITE_ALT_ONE  from "@/assets/images/IMG_1996_1778613360425-opt.jpg";
import WHITE_ALT_TWO  from "@/assets/images/IMG_1993_1778613360426-opt.jpg";
import CASHMERE_MAIN from "@/assets/images/cashmere-main-new.jpg";
import CASHMERE_ALT_1 from "@/assets/images/cashmere-alt-1.jpg";
import CASHMERE_ALT_2 from "@/assets/images/cashmere-alt-2.jpg";
import CASHMERE_ALT_3 from "@/assets/images/cashmere-alt-3.jpg";
import BEIGE_MAIN    from "@/assets/images/beige.jpg";
import BEIGE_ALT_1   from "@/assets/images/beige-alt-1.jpg";
import BEIGE_ALT_2   from "@/assets/images/beige-alt-2.jpg";
import YELLOW_MAIN   from "@/assets/images/yellow.jpg";
import YELLOW_ALT_1  from "@/assets/images/yellow-alt-1.jpg";
import YELLOW_ALT_2  from "@/assets/images/yellow-alt-2.jpg";
import TEAL_MAIN     from "@/assets/images/teal.jpg";
import TEAL_ALT_1    from "@/assets/images/teal-alt-1.jpg";
import TEAL_ALT_2    from "@/assets/images/teal-alt-2.jpg";
import TEAL_ALT_3    from "@/assets/images/teal-alt-3.jpg";
import LIGHT_BLUE_MAIN from "@/assets/images/light-blue.jpg";
import LIGHT_BLUE_ALT_1 from "@/assets/images/light-blue-alt-1.jpg";
import LIGHT_BLUE_ALT_2 from "@/assets/images/light-blue-alt-2.jpg";
import NAVI_MAIN from "@/assets/images/navi.jpg";
import NAVI_ALT from "@/assets/images/navi-alt.jpg";
import MINT_MAIN from "@/assets/images/mint.jpg";
import MINT_ALT_1 from "@/assets/images/mint-alt-1.jpg";
import MINT_ALT_2 from "@/assets/images/mint-alt-2.jpg";
import BANGLES_MAIN from "@/assets/images/bangles-main.jpg";
import BANGLES_ALT_1 from "@/assets/images/bangles-alt-1.jpg";
import BANGLES_ALT_2 from "@/assets/images/bangles-alt-2.jpg";
import BANGLES_ALT_3 from "@/assets/images/bangles-alt-3.jpg";

const WHITE_GALLERY    = [WHITE_MAIN, WHITE_ALT_ONE, WHITE_ALT_TWO];
const CASHMERE_GALLERY = [CASHMERE_MAIN, CASHMERE_ALT_1, CASHMERE_ALT_2, CASHMERE_ALT_3];
const BEIGE_GALLERY    = [BEIGE_MAIN, BEIGE_ALT_1, BEIGE_ALT_2];
const YELLOW_GALLERY   = [YELLOW_MAIN, YELLOW_ALT_1, YELLOW_ALT_2];
const TEAL_GALLERY     = [TEAL_MAIN, TEAL_ALT_1, TEAL_ALT_2, TEAL_ALT_3];

const HERO_IMAGE = `${import.meta.env.BASE_URL}hero-image.jpeg`;

const WAVVY_LOOK_1 = "/images/wavvy-look-1.jpg";
const WAVVY_LOOK_2 = "/images/wavvy-look-2.jpg";
const WAVVY_LOOK_3 = "/images/wavvy-look-3.jpg";
const WAVVY_LOOK_4 = "/images/wavvy-look-4.jpg";
const WAVVY_LOOK_5 = "/images/wavvy-look-5.jpg";
const SAND_MAIN = "/images/sand.webp";
const VERSA_TOP_CARD = "/images/moi-versa-top-beige-card.webp";

export const IMAGES = {
  hero: {
    videoUrl: "",
    fallbackUrl: HERO_IMAGE,
  },

  /**
   * PRODUCT 1 — Moi Wavvy
   * colorImages / colorGalleries / colorSwatches reflect the real verified
   * colors in Shopify. Variants + pricing come from the Shopify Storefront API.
   * filmstrip is intentionally empty so the Shopify CDN images take over.
   */
  product1: {
    slug: "moi-wavvy",
    productShot: BEIGE_MAIN,
    filmstrip: [] as string[],
    look: {
      model:   WAVVY_LOOK_3,
      shoes:   WAVVY_LOOK_1,
      bag:     WAVVY_LOOK_4,
      earring: WAVVY_LOOK_5,
      extra:   WAVVY_LOOK_2,
    },
    colorImages: {
      "Light Blue": LIGHT_BLUE_MAIN,
      Navy:        NAVI_MAIN,
      Mint:        MINT_MAIN,
      Sand:        SAND_MAIN,
    },
    colorGalleries: {
      "Light Blue": [LIGHT_BLUE_MAIN, LIGHT_BLUE_ALT_1, LIGHT_BLUE_ALT_2],
      Navy:        [NAVI_MAIN, NAVI_ALT],
      Mint:        [MINT_MAIN, MINT_ALT_1, MINT_ALT_2],
      Sand:        [SAND_MAIN],
    },
    colorSwatches: {
      "light blue": "#a8c8d8",
      navy:         "#3a5a7a",
      mint:         "#98c8a8",
      sand:         "#d4c4a0",
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
  },

  /**
   * PRODUCT 2 — Moi Versa Top
   * colorImages / colorGalleries / colorSwatches reflect the real verified
   * colors in Shopify. Variants + pricing come from the Shopify Storefront API.
   * filmstrip is intentionally empty so the Shopify CDN images take over.
   */
  product2: {
    slug: "moi-versa-top",
    productShot: VERSA_TOP_CARD,
    filmstrip: [] as string[],
    look: {
      model:   WAVVY_LOOK_3,
      shoes:   WAVVY_LOOK_1,
      bag:     WAVVY_LOOK_4,
      earring: WAVVY_LOOK_5,
      extra:   WAVVY_LOOK_2,
    },
    colorImages: {
      White:    VERSA_TOP_CARD,
      Cashmere: VERSA_TOP_CARD,
      Beige:    VERSA_TOP_CARD,
      Yellow:   VERSA_TOP_CARD,
      Teal:     VERSA_TOP_CARD,
    },
    colorGalleries: {
      White:    [VERSA_TOP_CARD],
      Cashmere: [VERSA_TOP_CARD],
      Beige:    [VERSA_TOP_CARD],
      Yellow:   [VERSA_TOP_CARD],
      Teal:     [VERSA_TOP_CARD],
    },
    colorSwatches: {
      white:    "#f5f0e8",
      cashmere: "#d4c4b0",
      beige:    "#c8b8a0",
      yellow:   "#e8d080",
      teal:     "#4a8a8a",
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
  },

  /**
   * PRODUCT 3 — Trio Bangles (Accessories)
   * Variants + pricing come from the Shopify Storefront API.
   */
  product3: {
    slug: "trio-bangles",
    productShot: BANGLES_MAIN,
    filmstrip: [BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
    look: {
      model:   "",
      shoes:   "",
      bag:     "",
      earring: "",
    },
    colorImages: {
      Ivory:     BANGLES_MAIN,
      Beige:     BANGLES_MAIN,
      "One Size": BANGLES_MAIN,
    },
    colorGalleries: {
      Ivory: [BANGLES_MAIN, BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
      Beige: [BANGLES_MAIN, BANGLES_ALT_1, BANGLES_ALT_2, BANGLES_ALT_3],
    },
    colorSwatches: {
      ivory: "#e3d4cb",
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
  readonly colorSwatches?: Record<string, string>;
  readonly colorImages?: Record<string, string>;
  readonly colorGalleries?: Record<string, readonly string[]>;
}
