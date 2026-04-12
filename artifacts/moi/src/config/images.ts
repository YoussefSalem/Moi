const CDN_BASE = "https://static.e-stradivarius.net/assets/public/6609/3c52/c7794a08bf4d/3e85295c5fe2";
const CDN_TS = "ts=1773676013508";

function cdnImage(id: string, width = 800): string {
  return `${CDN_BASE}/${id}/${id}.jpg?${CDN_TS}&w=${width}`;
}

const UNSPLASH = "https://images.unsplash.com/photo";

function ux(id: string, w = 800, h = 1200): string {
  return `${UNSPLASH}-${id}?w=${w}&h=${h}&fit=crop&q=80`;
}

const U1 = "1515886657613-9f3515b0c78f";
const U2 = "1469334031218-e382a71b716b";
const U3 = "1534528741775-53994a69daeb";
const U4 = "1507003211169-0a1dd7228f2d";
const U5 = "1617922001439-4a2e6562f328";
const U6 = "1445205170230-053b83016050";

const PRODUCT_CDN = cdnImage("02076511400-a15");

export const IMAGES = {
  hero: {
    videoUrl: "",
    fallbackUrl: cdnImage("02076511400-a15", 1536),
  },

  product1: {
    main: PRODUCT_CDN,
    hover: ux(U1, 800, 1200),
    gallery: [
      PRODUCT_CDN,
      ux(U1, 800, 1200),
      ux(U2, 800, 1200),
      ux(U3, 800, 1200),
      ux(U4, 800, 1200),
    ],
    look: cdnImage("02076511400-a15", 1200),
    name: "Asymmetric Cape",
    color: "Brown",
    ref: "2076/511/400",
    price: "1.690 EGP",
    composition: "Outer: 100% Polyester · Lining: 96% Polyester, 4% Elastane",
  },

  product2: {
    main: ux(U5, 800, 1200),
    hover: ux(U6, 800, 1200),
    gallery: [
      ux(U5, 800, 1200),
      ux(U6, 800, 1200),
      ux(U2, 800, 1200),
      ux(U3, 800, 1200),
      ux(U4, 800, 1200),
    ],
    look: ux(U5, 1200, 1800),
    name: "Asymmetric Cape",
    color: "Taupe",
    ref: "2076/511/401",
    price: "1.690 EGP",
    composition: "Outer: 100% Polyester · Lining: 96% Polyester, 4% Elastane",
  },

  carousel: [
    PRODUCT_CDN,
    ux(U1, 800, 1100),
    ux(U2, 800, 1100),
    ux(U3, 800, 1100),
    ux(U4, 800, 1100),
    ux(U5, 800, 1100),
    ux(U6, 800, 1100),
    ux(U1, 900, 1200),
  ],
} as const;

export interface ProductConfig {
  readonly main: string;
  readonly hover: string;
  readonly gallery: readonly string[];
  readonly look: string;
  readonly name: string;
  readonly color: string;
  readonly ref: string;
  readonly price: string;
  readonly composition: string;
}
