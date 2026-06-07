import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { ENABLE_CARD_PAYMENTS, ENABLE_WALLET_PAYMENTS, ENABLE_APPLE_PAY } from "@/config/features";
import { ShopifyApplePayButton } from "./ShopifyApplePayButton";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Upload, X, CreditCard, Tag, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SHOPIFY_CONFIGURED, cartBuyerIdentityUpdate } from "@/lib/shopify";
import { IMAGES } from "@/config/images";
import { parseEGP } from "@/lib/price";
import { trackTikTokPurchase } from "@/lib/tiktokPixel";
import { trackShopifyPurchase } from "@/lib/shopifyAnalytics";
import { getAttribution } from "@/lib/adAttribution";
import { trackCheckoutStep, trackCheckoutStepTime } from "@/lib/analytics";
import type { ShopifyCartLine } from "@/lib/shopify";

const PRODUCT_COLOR_MAP: Record<string, string> = {};
const PRODUCT_SHOT_MAP: Record<string, string> = {};

for (const cfg of Object.values(IMAGES)) {
  if (!("name" in cfg) || !cfg.name) continue;
  const rawNames = [cfg.name, ...("shopifyTitle" in cfg && cfg.shopifyTitle ? [cfg.shopifyTitle as string] : [])];
  const names = rawNames.flatMap((n) => [n.toLowerCase(), n.toLowerCase().replace(/\./g, "").trim()]);
  if ("productShot" in cfg && cfg.productShot) {
    for (const n of names) PRODUCT_SHOT_MAP[n] = cfg.productShot;
  }
  if ("colorImages" in cfg && cfg.colorImages) {
    for (const [color, url] of Object.entries(cfg.colorImages as Record<string, string>)) {
      for (const n of names) {
        PRODUCT_COLOR_MAP[`${n}::${color.toLowerCase()}`] = url;
      }
    }
  }
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/\./g, "").trim();
}

// Public image URLs for emails (Vite-hashed /assets/ paths only work in the browser)
// Images served via the API server (/api/images/) so they are always available
// regardless of whether the web-app deployment is up to date.
// window.location.origin auto-selects the right domain on dev vs production.
const BASE_IMG = `${typeof window !== "undefined" ? window.location.origin : "https://buy-moi.com"}/api/images`;
const PUBLIC_COLOR_IMAGES: Record<string, string> = {
  beige:        `${BASE_IMG}/beige.jpg`,
  white:        `${BASE_IMG}/white.jpg`,
  cashmere:     `${BASE_IMG}/cashmere.jpg`,
  yellow:       `${BASE_IMG}/yellow.jpg`,
  teal:         `${BASE_IMG}/teal.jpg`,
  navy:         `${BASE_IMG}/navi.jpg`,
  mint:         `${BASE_IMG}/mint.jpg`,
  "light blue": `${BASE_IMG}/light-blue-main.webp`,
};

function resolveLineImage(line: ShopifyCartLine, localItems?: { variantId: string; color?: string; image?: string | null }[]): string | null {
  const variantId = line.merchandise.id;
  const localMatch = localItems?.find((li) => li.variantId === variantId);

  const rawTitle = line.merchandise.product.title ?? "";
  const normTitle = normalizeTitle(rawTitle);

  // Size-like option names to skip when scanning for the color option
  const SIZE_OPTION_NAMES = new Set(["size", "titre", "taille", "tamanho", "gr\u00f6\u00dfe"]);

  // Candidate colors: local storage first (most reliable), then Shopify selectedOptions
  const colorCandidates: string[] = [];
  if (localMatch?.color) colorCandidates.push(localMatch.color.toLowerCase());
  for (const opt of (line.merchandise.selectedOptions ?? [])) {
    if (!SIZE_OPTION_NAMES.has(opt.name.toLowerCase())) {
      colorCandidates.push(opt.value.toLowerCase());
    }
  }

  // 1. Product + color map lookup (hashed bundle URL, always fresh)
  for (const color of colorCandidates) {
    const hit = PRODUCT_COLOR_MAP[`${normTitle}::${color}`]
      ?? PRODUCT_COLOR_MAP[`${rawTitle.toLowerCase()}::${color}`];
    if (hit) return hit;
  }

  // 2. Product-level shot
  const productHit = PRODUCT_SHOT_MAP[normTitle] ?? PRODUCT_SHOT_MAP[rawTitle.toLowerCase()];
  if (productHit) return productHit;

  // 3. Shopify CDN image
  if (line.merchandise.image?.url) return line.merchandise.image.url;
  if (line.merchandise.product.featuredImage?.url) return line.merchandise.product.featuredImage.url;

  // 4. Last resort: stale localStorage URL
  if (localMatch?.image) return localMatch.image;

  return null;
}

/** Convert any internal image URL to a public URL that works in emails. */
function resolveEmailImage(line: ShopifyCartLine, localItems?: { variantId: string; color?: string; image?: string | null }[]): string | null {
  const variantId = line.merchandise.id;
  const localMatch = localItems?.find((li) => li.variantId === variantId);

  const rawTitle = line.merchandise.product.title ?? "";
  const normTitle = normalizeTitle(rawTitle);

  const SIZE_OPTION_NAMES = new Set(["size", "titre", "taille", "tamanho", "gr\u00f6\u00dfe"]);

  const colorCandidates: string[] = [];
  if (localMatch?.color) colorCandidates.push(localMatch.color.toLowerCase());
  for (const opt of (line.merchandise.selectedOptions ?? [])) {
    if (!SIZE_OPTION_NAMES.has(opt.name.toLowerCase())) {
      colorCandidates.push(opt.value.toLowerCase());
    }
  }

  // 1. Color swatch always takes priority — this is what the customer selected
  for (const color of colorCandidates) {
    const publicHit = PUBLIC_COLOR_IMAGES[color];
    if (publicHit) return publicHit;
  }

  // 2. Shopify CDN image (only real CDN URLs, not placeholders)
  const shopifyUrl = line.merchandise.image?.url ?? line.merchandise.product.featuredImage?.url ?? "";
  if (shopifyUrl && shopifyUrl.includes("cdn.shopify.com")) {
    return shopifyUrl;
  }

  // 3. Last resort: localStorage image (must be a public HTTP URL)
  if (localMatch?.image && localMatch.image.startsWith("http")) return localMatch.image;

  return null;
}

type PaymentMethod = "cod" | "instapay" | "card" | "wallet" | "apple-pay";
/* Card, Wallet + Apple Pay are gated by feature flags in @/config/features */
const AVAILABLE_PAYMENT_METHODS: PaymentMethod[] = [
  "cod",
  "instapay",
  ...(ENABLE_CARD_PAYMENTS ? ["card" as PaymentMethod] : []),
  ...(ENABLE_WALLET_PAYMENTS ? ["wallet" as PaymentMethod] : []),
  ...(ENABLE_APPLE_PAY ? ["apple-pay" as PaymentMethod] : []),
];
type Step = "form" | "loading" | "cod-confirm" | "instapay-confirm" | "card-checkout" | "card-confirm";
type InstapaySubStep = "instructions" | "upload" | "review";

interface OrderResult {
  orderNumber: string | number;
  total: string;
  intentId?: string;
  paymobTxnId?: string;
  shopifyOrderId?: number | null;
  shopifyOrderNumber?: number;
  draftOrderId?: number;
  instapayAccount?: string;
  instapayNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items?: Array<{
    id?: string;
    title: string;
    variantTitle?: string | null;
    quantity: number;
    image?: string | null;
    price?: string;
  }>;
}

interface OrderBreakdown {
  subtotal: number;
  savings: number;
  shippingCost: number;
  freeShipping: boolean;
  fmt: (n: number) => string;
  /** Total amount charged — shown as a final "Total" row when provided */
  total?: number;
}

const SHIPPING_EGP = 50;
const GOVERNORATES = [
  "Cairo","Giza","Alexandria","Dakahlia","Red Sea","Beheira","Fayoum","Gharbia",
  "Ismailia","Menofia","Minya","Qaliubiya","New Valley","Suez","Aswan","Assiut",
  "Beni Suef","Port Said","Damietta","Sharkia","South Sinai","Kafr El Sheikh",
  "Matrouh","Luxor","Qena","North Sinai","Sohag","Ain Sokhna",
] as const;


const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(30,24,20,0.22)",
  outline: "none",
  padding: "14px 0",
  fontSize: "16px",
  color: "#1e1814",
  fontWeight: 500,
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.025em",
  WebkitAppearance: "none",
  borderRadius: 0,
};


const optionListStyle: React.CSSProperties = {
  maxHeight: "240px",
  overflowY: "auto",
  border: "1px solid rgba(30,24,20,0.16)",
  backgroundColor: "#efe6da",
  boxShadow: "0 18px 40px rgba(30,24,20,0.12)",
};

const optionStyle: React.CSSProperties = {
  width: "100%",
  display: "block",
  padding: "12px 14px",
  textAlign: "left",
  fontFamily: "'Montserrat', sans-serif",
  fontSize: "14px",
  letterSpacing: "0.02em",
  color: "#1e1814",
};

const governorateInputStyle: React.CSSProperties = {
  ...inputStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "15px",
  letterSpacing: "0.24em",
  textTransform: "uppercase" as const,
  color: "rgba(30,24,20,0.92)",
  marginBottom: "2px",
  fontFamily: "'Montserrat', sans-serif",
};

async function compressImage(file: File, maxPx = 1400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/** Build marketing attribution payload from sessionStorage for order creation */
function buildOrderAttribution() {
  const attr = getAttribution();
  const utm = attr.utm || {};
  // Determine source_name for Shopify channel attribution
  let sourceName: string | undefined;
  if (utm.source === "facebook" || utm.source === "fb" || attr.fbclid) sourceName = "facebook";
  else if (utm.source === "instagram" || utm.source === "ig") sourceName = "instagram";
  else if (utm.source === "google" || attr.gclid) sourceName = "google";
  else if (utm.source === "tiktok" || attr.ttclid) sourceName = "tiktok";
  else if (utm.source) sourceName = utm.source;

  // Derive referring_site from the source — document.referrer is unreliable for
  // ad traffic (Meta/Google redirect chains strip it, iOS privacy hides it).
  const REF_MAP: Record<string, string> = {
    facebook: "https://www.facebook.com/",
    instagram: "https://www.instagram.com/",
    google: "https://www.google.com/",
    tiktok: "https://www.tiktok.com/",
  };
  // Prefer the explicit referring site if the browser still has it, otherwise
  // derive from source name so Shopify always has a value to report against.
  const referringSite = document.referrer || (sourceName ? REF_MAP[sourceName] : undefined);

  return {
    ...(sourceName ? { sourceName } : {}),
    ...(attr.firstLandingUrl ? { landingSite: attr.firstLandingUrl } : {}),
    ...(referringSite ? { referringSite } : {}),
    ...(Object.keys(utm).length > 0 ? { utm } : {}),
    ...(attr.fbclid ? { fbclid: attr.fbclid } : {}),
    ...(attr.gclid ? { gclid: attr.gclid } : {}),
    ...(attr.ttclid ? { ttclid: attr.ttclid } : {}),
  };
}

export function CheckoutPage() {
  const {
    shopifyCart,
    localItems,
    checkoutOpen,
    closeCheckout,
    openCheckout,
    clearCart,
    isShopify,
    formatShopifyLinePrice,
    applyDiscount,
    prefilledEmail,
    checkoutUrl,
  } = useCart();

  const [step, setStep] = useState<Step>("form");
  const [emailError, setEmailError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  // Promo code section is always visible (no dropdown toggle)
  // const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [breakdownSnapshot, setBreakdownSnapshot] = useState<{ subtotal: number; savings: number; shippingCost: number; freeShipping: boolean } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [governorateOpen, setGovernorateOpen] = useState(false);
  const [paymobIframeUrl, setPaymobIframeUrl] = useState<string | null>(null);
  const [shopifyCheckoutToken, setShopifyCheckoutToken] = useState<string | null>(null);
  const isApplyingRef = useRef(false); // Prevents recursive re-apply while we update cart
  const paymobTrackedRef = useRef(false); // Prevents duplicate trackPurchase when iframe fires twice
  const instapayTrackedRef = useRef(false); // Prevents duplicate trackPurchase on double-submit
  const codTrackedRef = useRef(false); // Prevents duplicate trackPurchase if COD submit fires twice
  const submittingRef = useRef(false); // Prevents double-submit of COD/card/instapay order forms
  // Holds the latest handleRefreshPaymobSession so callbacks defined before it can call it.
  const refreshSessionRef = useRef<() => void>(() => {});
  // Native Apple Pay — intentId from validate-merchant response (set in session callback)
  const applePayIntentIdRef = useRef<string | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    address: "", governorate: "", postalCode: "", city: "",
  });

  // When checkout opens with a pre-filled email (abandoned cart recovery),
  // seed the email field and skip straight to the order form.
  // Track checkout step changes
  const prevStepRef = useRef<Step | null>(null);
  const stepEnterTimeRef = useRef<number>(Date.now());

  // Auto-close checkout when user presses browser back button (popstate)
  useEffect(() => {
    if (!checkoutOpen) return;
    function onPopState() {
      if (window.location.pathname !== "/checkout") {
        setStep("form");
        setOrderResult(null);
        setPaymobIframeUrl(null);
        setPaymentMethod("cod");
        setSubmitError("");
        closeCheckout();
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [checkoutOpen, closeCheckout]);

  // Direct Apple Pay fast-path: native ApplePaySession with Paymob merchant validation.
  // This function is intentionally synchronous — ApplePaySession.begin() MUST be
  // called in the same call-stack as the user gesture (tap/click).
  // All async work (validate-merchant, authorize) happens inside the session callbacks.
  const triggerApplePayDirectInit = useCallback(() => {
    if (submittingRef.current) return;
    const AP = (window as unknown as {
      ApplePaySession?: {
        new(v: number, r: object): {
          onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
          onpaymentauthorized: ((e: {
            payment: {
              token: { paymentData: unknown };
              shippingContact?: {
                givenName?: string; familyName?: string; emailAddress?: string;
                phoneNumber?: string; addressLines?: string[]; locality?: string;
                administrativeArea?: string;
              };
            };
          }) => void) | null;
          oncancel: (() => void) | null;
          completeMerchantValidation(s: unknown): void;
          completePayment(r: { status: number }): void;
          abort(): void;
          begin(): void;
        };
        canMakePayments(): boolean;
        STATUS_SUCCESS: number;
        STATUS_FAILURE: number;
      };
    }).ApplePaySession;
    if (!AP) return;

    const orderLines = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
      : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
    if (orderLines.length === 0) return;

    const subTotal = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.reduce((s, l) => s + parseFloat(l.merchandise.price.amount) * l.quantity, 0)
      : localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);
    const cartDiscounted = isShopify && shopifyCart
      ? parseFloat(shopifyCart.cost.totalAmount.amount)
      : subTotal;
    const savingsAmt = Math.max(0, subTotal - cartDiscounted);
    const discSubtotal = subTotal - savingsAmt;
    const isFreeShipping = discSubtotal >= 2000;
    const shippingAmt = isFreeShipping ? 0 : SHIPPING_EGP;
    const totalEGP = discSubtotal + shippingAmt;
    const totalCents = Math.round(totalEGP * 100);

    // version 4 required for lineItems; type on lineItems requires v14+ so omit it
    const session = new AP(4, {
      countryCode: "EG",
      currencyCode: "EGP",
      supportedNetworks: ["visa", "masterCard"],
      merchantCapabilities: ["supports3DS"],
      requiredShippingContactFields: ["name", "email", "phone"],
      lineItems: shippingAmt > 0
        ? [{ label: "Shipping", amount: shippingAmt.toFixed(2) }]
        : [],
      total: { label: "Moi", amount: (totalCents / 100).toFixed(2) },
    });

    applePayIntentIdRef.current = null;
    setPaymentMethod("apple-pay");
    setSubmitError("");

    session.onvalidatemerchant = async ({ validationURL }) => {
      try {
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validationURL,
            lines: orderLines,
            totalAmountCents: totalCents,
            discountCode: promoApplied?.code ?? null,
          }),
        });
        const data = await res.json() as { merchantSession?: unknown; intentId?: string; error?: string };
        if (!res.ok || !data.merchantSession) throw new Error(data.error ?? "Merchant validation failed");
        applePayIntentIdRef.current = data.intentId ?? null;
        session.completeMerchantValidation(data.merchantSession);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Apple Pay is unavailable. Please try another payment method.";
        session.abort();
        setSubmitError(msg);
        setPaymentMethod("cod");
      }
    };

    session.onpaymentauthorized = async ({ payment }) => {
      try {
        const sc = payment.shippingContact;
        const res = await fetch("/api/apple-pay/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentData: JSON.stringify(payment.token.paymentData),
            intentId: applePayIntentIdRef.current,
            shippingContact: sc ? {
              firstName: sc.givenName,
              lastName: sc.familyName,
              email: sc.emailAddress,
              phone: sc.phoneNumber,
              address: sc.addressLines?.[0],
              city: sc.locality,
              governorate: sc.administrativeArea,
            } : undefined,
          }),
        });
        const data = await res.json() as {
          success?: boolean;
          error?: string;
          shopifyOrderNumber?: number | null;
        };
        if (data.success) {
          session.completePayment({ status: AP.STATUS_SUCCESS });
          const cartItemsSnapshot = isShopify && shopifyCart
            ? shopifyCart.lines.nodes.map((l) => ({
                id: l.id,
                title: l.merchandise.product.title,
                variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title,
                quantity: l.quantity,
                image: resolveLineImage(l, localItems),
                price: formatShopifyLinePrice(l),
              }))
            : localItems.map((i) => ({
                id: i.id,
                title: i.title,
                variantTitle: null,
                quantity: i.quantity,
                image: i.image ?? null,
                price: i.price,
              }));
          setOrderResult({
            orderNumber: String(data.shopifyOrderNumber ?? ""),
            shopifyOrderNumber: data.shopifyOrderNumber ?? undefined,
            total: `${Math.round(totalEGP)} EGP`,
            items: cartItemsSnapshot.length > 0 ? cartItemsSnapshot : undefined,
          });
          setStep("cod-confirm");
          clearCart();
        } else {
          session.completePayment({ status: AP.STATUS_FAILURE });
          setSubmitError(data.error ?? "Payment was declined. Please try another card.");
          setPaymentMethod("cod");
        }
      } catch {
        session.completePayment({ status: AP.STATUS_FAILURE });
        setSubmitError("Payment failed. Please try again.");
        setPaymentMethod("cod");
      }
    };

    session.oncancel = () => {
      setPaymentMethod("cod");
    };

    session.begin();
  }, [isShopify, shopifyCart, localItems, promoApplied, clearCart, formatShopifyLinePrice]);

  useEffect(() => {
    if (!checkoutOpen && prefilledEmail) return;
    if (!checkoutOpen) return;

    const applePayResultRaw = sessionStorage.getItem("moi_apple_pay_result");
    if (applePayResultRaw) {
      sessionStorage.removeItem("moi_apple_pay_result");
      try {
        const result = JSON.parse(applePayResultRaw) as {
          txnId?: string;
          shopifyOrderId?: number;
          shopifyOrderNumber?: number;
          total?: string;
          intentId?: string;
          items?: OrderResult["items"];
        };
        setOrderResult({
          orderNumber: result.shopifyOrderNumber ?? result.shopifyOrderId ?? "",
          total: result.total ?? "",
          intentId: result.intentId,
          paymobTxnId: result.txnId,
          shopifyOrderId: result.shopifyOrderId ?? null,
          shopifyOrderNumber: result.shopifyOrderNumber,
          items: result.items,
        });
        setStep("card-confirm");
      } catch { /* ignore parse errors */ }
      return;
    }

    const preferred = sessionStorage.getItem("moi_preferred_payment");
    if (preferred === "apple-pay") {
      sessionStorage.removeItem("moi_preferred_payment");
      setPaymentMethod("apple-pay");
    }
  }, [checkoutOpen]);

  useEffect(() => {
    if (checkoutOpen && prefilledEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(prefilledEmail.trim())) {
        setForm((f) => ({ ...f, email: prefilledEmail }));
      }
    }
  }, [checkoutOpen, prefilledEmail]);


  useEffect(() => {
    if (prevStepRef.current) {
      const seconds = Math.round((Date.now() - stepEnterTimeRef.current) / 1000);
      trackCheckoutStepTime(prevStepRef.current, seconds);
    }
    prevStepRef.current = step;
    stepEnterTimeRef.current = Date.now();

    // Map step names to analytics events (CartDrawer fires the start event)
    const stepMap: Record<string, string> = {
      form: "shipping",
      "card-checkout": "payment",
      "cod-confirm": "payment",
      "instapay-confirm": "payment",
      "card-confirm": "complete",
    };
    const analyticsStep = stepMap[step];
    if (analyticsStep) {
      trackCheckoutStep(analyticsStep as "shipping" | "payment" | "complete", { step });
    }
  }, [step]);

  const lines = isShopify && shopifyCart ? shopifyCart.lines.nodes : null;
  const localLines = !isShopify ? localItems : [];
  const localSubtotal = localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);
  // Discount is always derived from the live Shopify cart so it recalculates
  // automatically when items are added or removed. Shopify's cart.cost.totalAmount
  // reflects applied discount codes immediately after cartDiscountCodesUpdate.
  const shopifyHasLines = Boolean(shopifyCart && shopifyCart.lines.nodes.length > 0);
  const lineItemsSubtotal = shopifyHasLines
    ? shopifyCart!.lines.nodes.reduce(
        (sum, line) => sum + parseFloat(line.merchandise.price.amount) * line.quantity,
        0,
      )
    : localSubtotal;
  const subtotalAmount = lineItemsSubtotal;
  // Discount amount is always derived from the live Shopify cart so it
  // recalculates automatically when items are added or removed. When a user-
  // applied promo code is active, Shopify's cart.cost.totalAmount already
  // reflects it; when no code is applied, cartSavings handles automatic discounts.
  const cartDiscountedTotal = shopifyHasLines ? parseFloat(shopifyCart!.cost.totalAmount.amount) : localSubtotal;
  const cartSavings = Math.max(0, subtotalAmount - cartDiscountedTotal);
  const savings = cartSavings;
  const discountedSubtotal = subtotalAmount - savings;
  const freeShipping = discountedSubtotal >= 2000;
  const shippingCost = freeShipping ? 0 : SHIPPING_EGP;
  const totalAmount = discountedSubtotal + shippingCost;
  const currencyCode = shopifyCart?.cost.totalAmount.currencyCode ?? localItems[0]?.currencyCode ?? "EGP";
  const successItems = orderResult?.items ?? (lines
    ? lines.map((line) => ({
        id: line.id,
        title: line.merchandise.product.title,
        variantTitle: line.merchandise.title === "Default Title" ? null : line.merchandise.title,
        quantity: line.quantity,
        image: resolveLineImage(line, localItems),
        price: formatShopifyLinePrice(line),
      }))
    : localLines.map((item) => ({
        id: item.id,
        title: item.title,
        variantTitle: null,
        quantity: item.quantity,
        image: item.image ?? null,
        price: item.price,
      })));

  function fmt(amount: number) {
    try {
      return new Intl.NumberFormat("en-EG", {
        style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${amount.toFixed(0)} EGP`;
    }
  }


  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      isApplyingRef.current = true;
      const code = promoInput.trim().toUpperCase();
      // applyDiscount calls Shopify's cartDiscountCodesUpdate and returns whether
      // the code is applicable plus the actual discount amount (raw line total minus
      // Shopify's updated totalAmount, which reflects the discount immediately).
      const result = await applyDiscount(code);
      // Trust Shopify's `applicable` flag directly. The `discountAmount` from the
      // Storefront API may be 0 because Shopify doesn't always reflect discount
      // codes in cart totals immediately — the actual discount is resolved later
      // on the backend via discount-lookup.
      if (result.applicable) {
        setPromoApplied({ code: result.code });
        setPromoError("");
      } else {
        setPromoError("This code is invalid or doesn't apply to your cart.");
        setPromoApplied(null);
        await applyDiscount("").catch(() => {});
      }
    } catch {
      setPromoError("Could not verify the code. Please try again.");
    } finally {
      isApplyingRef.current = false;
      setPromoLoading(false);
    }
  }, [promoInput, applyDiscount]);

  const handleRemovePromo = useCallback(async () => {
    try { await applyDiscount(""); } catch {}
    setPromoApplied(null);
    setPromoInput("");
    setPromoError("");
  }, [applyDiscount]);

  const abandonedCartIdRef = useRef<number | null>(null);

  const markAbandonedCartRecovered = useCallback(() => {
    if (!abandonedCartIdRef.current) return;
    const id = abandonedCartIdRef.current;
    abandonedCartIdRef.current = null;
    fetch(`/api/abandoned-carts/${id}/recovered`, { method: "POST" }).catch(() => {});
  }, []);

  const handleSuccessDone = useCallback(() => {
    // Safety net: mark recovered in case payment path missed it
    markAbandonedCartRecovered();
    clearCart();
    setStep("form");
    setOrderResult(null);
    setPaymobIframeUrl(null);
    setShopifyCheckoutToken(null);
    setPromoApplied(null);
    setPromoInput("");
    setGovernorateOpen(false);
    setForm({ firstName: "", lastName: "", phone: "", email: "", address: "", governorate: "", postalCode: "", city: "" });
    sessionStorage.removeItem("moi_instapay_order_result");
    paymobTrackedRef.current = false;
    instapayTrackedRef.current = false;
    codTrackedRef.current = false;
    submittingRef.current = false;
    closeCheckout();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [clearCart, closeCheckout, markAbandonedCartRecovered]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    const hasShopifyItems = isShopify && !!shopifyCart && shopifyCart.lines.nodes.length > 0;
    const hasLocalItems = localItems.length > 0;
    if (!hasShopifyItems && !hasLocalItems) {
      setSubmitError("Your cart appears to be empty. Please add items before checking out.");
      submittingRef.current = false;
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.governorate.trim()) {
      setSubmitError("Please fill in all fields.");
      submittingRef.current = false;
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    const isValidPhone =
      (phoneDigits.length === 11 && phoneDigits.startsWith("01")) ||
      (phoneDigits.length === 12 && phoneDigits.startsWith("201"));
    if (!isValidPhone) {
      setSubmitError("Please enter a valid Egyptian phone number (e.g. 01200520083 or +20 1200520083).");
      submittingRef.current = false;
      return;
    }

    setSubmitError("");
    setStep("loading");

    const orderLines = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
      : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

    const customerPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim(),
      address: form.address.trim(),
      governorate: form.governorate.trim(),
      postalCode: form.postalCode.trim() || undefined,
      city: form.city.trim(),
    };

    // Card / Wallet payment: call paymob-init → redirect directly to Paymob Unified Checkout
    if (paymentMethod === "card" || paymentMethod === "wallet") {
      if (paymentMethod === "card" && !ENABLE_CARD_PAYMENTS) {
        submittingRef.current = false;
        setSubmitError("Card payments are temporarily unavailable. Please choose another payment method.");
        setStep("form");
        return;
      }
      if (paymentMethod === "wallet" && !ENABLE_WALLET_PAYMENTS) {
        submittingRef.current = false;
        setSubmitError("Mobile wallet payments are temporarily unavailable. Please choose another payment method.");
        setStep("form");
        return;
      }
      try {
        try { sessionStorage.setItem("moi_checkout_form", JSON.stringify(form)); } catch { /* ignore */ }
        const res = await fetch("/api/orders/paymob-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLines,
            customer: customerPayload,
            cartId: shopifyCart?.id ?? null,
            discountCode: promoApplied?.code ?? null,
            attribution: buildOrderAttribution(),
            checkoutToken: shopifyCheckoutToken ?? null,
            paymentType: paymentMethod,
          }),
        });

        const data = await res.json() as {
          iframeUrl?: string;
          intentId?: string;
          total?: string;
          error?: string;
        };

        if (!res.ok || !data.iframeUrl) {
          setStep("form");
          setSubmitError(data.error ?? "Payment gateway unavailable. Please try again.");
          submittingRef.current = false;
          return;
        }

        const resolvedTotal = data.total ?? fmt(totalAmount);
        // Snapshot the breakdown NOW while cart values are live.
        // By the time the card-confirm step renders the cart has been cleared,
        // so breakdownSnapshot is the only reliable source for subtotal/shipping.
        setBreakdownSnapshot({ subtotal: subtotalAmount, savings, shippingCost, freeShipping });
        // Snapshot items NOW while cart is still populated.
        // By the time onSuccess fires (after 5-second overlay countdown) React
        // may have re-created handleIframeSuccess with stale closure data,
        // so we capture items here where cart state is guaranteed fresh.
        const cartItemsSnapshot = isShopify && shopifyCart
          ? shopifyCart.lines.nodes.map((l) => ({
              id: l.id,
              title: l.merchandise.product.title,
              variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title,
              quantity: l.quantity,
              image: resolveLineImage(l, localItems),
              price: formatShopifyLinePrice(l),
            }))
          : localItems.map((i) => ({
              id: i.id,
              title: i.title,
              variantTitle: null,
              quantity: i.quantity,
              image: i.image ?? null,
              price: i.price,
            }));
        setOrderResult({
          orderNumber: "",
          total: resolvedTotal,
          intentId: data.intentId,
          items: cartItemsSnapshot.length > 0 ? cartItemsSnapshot : undefined,
        });
        // Persist in sessionStorage so state survives a 3DS full-page redirect
        if (data.intentId) {
          sessionStorage.setItem("moi_paymob_intent_id", data.intentId);
          sessionStorage.setItem("moi_paymob_order_total", resolvedTotal);
          // Save breakdown + items so the confirmation screen has correct values after redirect
          sessionStorage.setItem("moi_paymob_breakdown", JSON.stringify({ subtotal: subtotalAmount, savings, shippingCost, freeShipping }));
          if (cartItemsSnapshot.length > 0) {
            sessionStorage.setItem("moi_paymob_items", JSON.stringify(cartItemsSnapshot));
          }
        }
        paymobTrackedRef.current = false;
        window.location.href = data.iframeUrl;
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      submittingRef.current = false;
      return;
    }

    // Apple Pay is handled by the native "Buy with Apple Pay" button above — never redirect to Shopify.
    if (paymentMethod === "apple-pay") {
      if (!ENABLE_APPLE_PAY) {
        submittingRef.current = false;
        setSubmitError("Apple Pay is temporarily unavailable. Please choose another payment method.");
        setStep("form");
        return;
      }
      submittingRef.current = false;
      setSubmitError("Please tap the Apple Pay button above to complete your purchase.");
      setStep("form");
      return;
    }

    // InstaPay: validate cart + get account info — order is created only at proof upload
    if (paymentMethod === "instapay") {
      try {
        // Capture cart items snapshot so the confirmation screen shows thumbnails
        const cartItemsSnapshot = isShopify && shopifyCart
          ? shopifyCart.lines.nodes.map((l) => ({
              id: l.id,
              title: l.merchandise.product.title,
              variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title,
              quantity: l.quantity,
              image: resolveLineImage(l, localItems),
              price: formatShopifyLinePrice(l),
            }))
          : localItems.map((i) => ({
              id: i.id,
              title: i.title,
              variantTitle: null,
              quantity: i.quantity,
              image: i.image ?? null,
              price: i.price,
            }));
        const res = await fetch("/api/orders/instapay-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLines,
            customer: customerPayload,
            cartId: shopifyCart?.id ?? null,
            discountCode: promoApplied?.code ?? null,
            attribution: buildOrderAttribution(),
            checkoutToken: shopifyCheckoutToken ?? null,
          }),
        });

        const data = await res.json() as {
          success?: boolean;
          instapayAccount?: string;
          instapayNumber?: string;
          draftOrderId?: number;
          shopifyOrderId?: number;
          shopifyOrderNumber?: number;
          total?: string;
          error?: string;
        };

        if (!res.ok || !data.success) {
          setStep("form");
          setSubmitError(data.error ?? "Something went wrong. Please try again.");
          submittingRef.current = false;
          return;
        }

        const orderResultPayload: OrderResult = {
          orderNumber: data.shopifyOrderNumber ?? data.shopifyOrderId ?? "",
          total: data.total ?? fmt(totalAmount),
          draftOrderId: data.draftOrderId,
          shopifyOrderId: data.shopifyOrderId,
          shopifyOrderNumber: data.shopifyOrderNumber,
          instapayAccount: data.instapayAccount,
          instapayNumber: data.instapayNumber,
          customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          customerPhone: form.phone.trim(),
          items: cartItemsSnapshot.length > 0 ? cartItemsSnapshot : undefined,
        };
        setBreakdownSnapshot({ subtotal: subtotalAmount, savings, shippingCost, freeShipping });
        setOrderResult(orderResultPayload);
        // Persist instapay state so it survives tab switches on mobile
        sessionStorage.setItem("moi_instapay_order_result", JSON.stringify(orderResultPayload));
        setStep("instapay-confirm");
        markAbandonedCartRecovered();
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      submittingRef.current = false;
      return;
    }

    // COD: call orders/create
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: orderLines,
          customer: customerPayload,
          paymentMethod: "cod",
          cartId: shopifyCart?.id ?? null,
          discountCode: promoApplied?.code ?? null,
          attribution: buildOrderAttribution(),
          checkoutToken: shopifyCheckoutToken ?? null,
        }),
      });

      const data = await res.json() as {
        success?: boolean;
        orderNumber?: number | string;
        shopifyOrderId?: number;
        total?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setStep("form");
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
        submittingRef.current = false;
        return;
      }

      setBreakdownSnapshot({ subtotal: subtotalAmount, savings, shippingCost, freeShipping });
      setOrderResult({
        orderNumber: data.orderNumber ?? "",
        total: data.total ?? fmt(totalAmount),
        shopifyOrderId: data.shopifyOrderId,
        customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        customerPhone: form.phone.trim(),
      });

      clearCart();
      const purchaseValue = data.total ? parseEGP(data.total) || (Number.isFinite(totalAmount) ? totalAmount : 0) : (Number.isFinite(totalAmount) ? totalAmount : 0);
      const purchaseItems = orderLines.reduce((s, l) => s + l.quantity, 0);
      if (!codTrackedRef.current) {
        codTrackedRef.current = true;
        import("@/lib/analytics").then(({ trackPurchaseWithTime: trackInternalPurchase }) => {
          trackInternalPurchase(String(data.orderNumber ?? data.shopifyOrderId ?? ""), purchaseValue, "cod");
        });
        trackTikTokPurchase({
          content_id: orderLines[0]?.variantId,
          currency: "EGP",
          value: purchaseValue,
          quantity: purchaseItems,
          order_id: String(data.orderNumber ?? data.shopifyOrderId ?? ""),
        });
        trackShopifyPurchase({
          orderId: String(data.shopifyOrderId ?? data.orderNumber ?? ""),
          orderNumber: data.orderNumber,
          totalPrice: purchaseValue,
          currencyCode: "EGP",
          lineItems: orderLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        });
        if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
          (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "purchase", {
            transaction_id: String(data.orderNumber ?? data.shopifyOrderId ?? ""),
            value: purchaseValue,
            currency: "EGP",
            items: orderLines.map((l) => ({ item_id: l.variantId, quantity: l.quantity })),
          });
        }
      }
      setStep("cod-confirm");
      markAbandonedCartRecovered();
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
      submittingRef.current = false;
    }
  }, [form, paymentMethod, isShopify, shopifyCart, localItems, promoApplied, totalAmount, fmt, clearCart, shopifyCheckoutToken, markAbandonedCartRecovered]);

  const handleDone = useCallback(() => {
    clearCart();
    setStep("form");
    setOrderResult(null);
    setPaymobIframeUrl(null);
    setShopifyCheckoutToken(null);
    setPromoApplied(null);
    setPromoInput("");
    setGovernorateOpen(false);
    setForm({ firstName: "", lastName: "", phone: "", email: "", address: "", governorate: "", postalCode: "", city: "" });
    sessionStorage.removeItem("moi_instapay_order_result");
    paymobTrackedRef.current = false;
    instapayTrackedRef.current = false;
    codTrackedRef.current = false;
    submittingRef.current = false;
    closeCheckout();
  }, [clearCart, closeCheckout]);

  const handleEmailBlur = useCallback(() => {
    const email = form.email.trim();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return;
    const cartId = shopifyCart?.id;
    if (cartId) {
      // Fire-and-forget: set buyer identity on cart via Storefront API
      cartBuyerIdentityUpdate(cartId, email).catch(() => {});

      // Fire-and-forget: record abandoned cart for recovery email
      const lineItems = isShopify && shopifyCart
        ? shopifyCart.lines.nodes.map((l) => {
            const colorOpt = l.merchandise.selectedOptions?.find((o) => o.name.toLowerCase() === "color");
            const colorName = colorOpt?.value;
            return {
              title: l.merchandise.product.title,
              variant: colorName ? `Color: ${colorName}` : (l.merchandise.title === "Default Title" ? undefined : l.merchandise.title),
              quantity: l.quantity,
              price: `${Math.floor(parseFloat(l.merchandise.price.amount)).toLocaleString("de-DE")} EGP`,
              imageUrl: resolveEmailImage(l, localItems) ?? undefined,
              variantId: l.merchandise.id,
            };
          })
        : localItems.map((i) => {
            const color = i.color?.toLowerCase() ?? "";
            const publicImg = PUBLIC_COLOR_IMAGES[color];
            return {
              title: i.title,
              variant: i.color ? `Color: ${i.color}` : undefined,
              quantity: i.quantity,
              price: i.price,
              imageUrl: publicImg ?? (i.image?.startsWith("http") ? i.image : undefined),
              variantId: i.variantId,
            };
          });
      if (!abandonedCartIdRef.current) {
        fetch("/api/abandoned-carts/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            cartId,
            lineItems,
            totalAmount: fmt(totalAmount),
          }),
        })
          .then((r) => r.json())
          .then((data: unknown) => {
            const id = (data as { id?: number })?.id;
            if (id) abandonedCartIdRef.current = id;
          })
          .catch(() => {});
      }
    }
  }, [form.email, shopifyCart, isShopify, localItems, totalAmount, fmt]);

  const handleIframeSuccess = useCallback((txnId?: string, shopifyOrderId?: number | null, shopifyOrderNumber?: number | null) => {
    // Update orderResult immediately so Shopify data reaches the state even
    // when this function is called again by the polling path (which already
    // showed the overlay via postMessage).  The paymobTrackedRef guard below
    // only prevents duplicate analytics — state updates should always run.
    // Capture items from the current cart BEFORE clearing it so the success
    // screen has them even after the cart is emptied.
    const itemsSnapshot = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({
          id: l.id,
          title: l.merchandise.product.title,
          variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title,
          quantity: l.quantity,
          image: resolveLineImage(l, localItems),
          price: formatShopifyLinePrice(l),
        }))
      : localItems.map((i) => ({
          id: i.id,
          title: i.title,
          variantTitle: null,
          quantity: i.quantity,
          image: i.image ?? null,
          price: i.price,
        }));

    setOrderResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paymobTxnId: txnId ?? prev.paymobTxnId,
        shopifyOrderId: shopifyOrderId ?? prev.shopifyOrderId,
        shopifyOrderNumber: shopifyOrderNumber ?? prev.shopifyOrderNumber,
        // Only overwrite the items snapshot if we actually captured some.
        // The paymob-init path already stores a fresh snapshot; don't clobber
        // it with an empty array if shopifyCart is stale by the time this fires.
        items: itemsSnapshot.length > 0 ? itemsSnapshot : (prev.items ?? []),
      };
    });

    // Guard: Paymob iframe can fire onSuccess twice (inline message + 3DS relay page)
    if (paymobTrackedRef.current) return;
    paymobTrackedRef.current = true;

    setPaymobIframeUrl(null);
    setStep("card-confirm");
    clearCart();
    markAbandonedCartRecovered();
    const orderLines = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
      : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
    const totalVal = isShopify && shopifyCart && shopifyCart.cost?.totalAmount?.amount
      ? parseFloat(shopifyCart.cost.totalAmount.amount)
      : (Number.isFinite(totalAmount) ? totalAmount : 0);
    const effectiveOrderId = String(shopifyOrderNumber ?? shopifyOrderId ?? txnId ?? "");
    import("@/lib/analytics").then(({ trackPurchaseWithTime: trackInternalPurchase }) => {
      trackInternalPurchase(effectiveOrderId, totalVal, "card");
    });
    trackShopifyPurchase({
      orderId: effectiveOrderId,
      totalPrice: totalVal,
      currencyCode: "EGP",
      lineItems: orderLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    });
    if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "purchase", {
        transaction_id: effectiveOrderId,
        value: totalVal,
        currency: "EGP",
        items: orderLines.map((l) => ({ item_id: l.variantId, quantity: l.quantity })),
      });
    }
  }, [clearCart, markAbandonedCartRecovered, isShopify, shopifyCart, localItems, totalAmount]);


  const handleApplePayFail = useCallback(() => {
    setSubmitError("Apple Pay payment was declined or cancelled. Please try again.");
    setStep("form");
    submittingRef.current = false;
  }, []);

  const handleCancelCardCheckout = useCallback(() => {
    setPaymobIframeUrl(null);
    setStep("form");
    submittingRef.current = false;
  }, []);

  const handleRetryCard = useCallback(() => {
    setStep("form");
    submittingRef.current = false;
    // Re-initialize the Paymob iframe so the user can retry payment immediately
    // without re-entering their checkout form details.
    refreshSessionRef.current();
  }, []);

  const handleChooseDifferent = useCallback(() => {
    setStep("form");
    setPaymentMethod("cod");
    submittingRef.current = false;
  }, []);

  const handleRefreshPaymobSession = useCallback(async () => {
    setStep("loading");

    const orderLines = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
      : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

    const customerPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim(),
      address: form.address.trim(),
      governorate: form.governorate.trim(),
      postalCode: form.postalCode.trim() || undefined,
      city: form.city.trim(),
    };

    try {
      try { sessionStorage.setItem("moi_checkout_form", JSON.stringify(form)); } catch { /* ignore */ }
      const res = await fetch("/api/orders/paymob-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: orderLines,
          customer: customerPayload,
          cartId: shopifyCart?.id ?? null,
          discountCode: promoApplied?.code ?? null,
          attribution: buildOrderAttribution(),
          checkoutToken: shopifyCheckoutToken ?? null,
          paymentType: paymentMethod,
        }),
      });

      const data = await res.json() as {
        iframeUrl?: string;
        intentId?: string;
        total?: string;
        error?: string;
      };

      if (!res.ok || !data.iframeUrl) {
        setStep("form");
        setSubmitError(data.error ?? "Unable to refresh payment. Please try again.");
        return;
      }

      const resolvedTotal = data.total ?? fmt(totalAmount);
      const retryItemsSnapshot = isShopify && shopifyCart
        ? shopifyCart.lines.nodes.map((l) => ({
            id: l.id,
            title: l.merchandise.product.title,
            variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title,
            quantity: l.quantity,
            image: resolveLineImage(l, localItems),
            price: formatShopifyLinePrice(l),
          }))
        : localItems.map((i) => ({
            id: i.id,
            title: i.title,
            variantTitle: null,
            quantity: i.quantity,
            image: i.image ?? null,
            price: i.price,
          }));
      setOrderResult({ orderNumber: "", total: resolvedTotal, intentId: data.intentId, items: retryItemsSnapshot.length > 0 ? retryItemsSnapshot : undefined });
      // Refresh the breakdown snapshot so the confirmation screen shows correct values
      setBreakdownSnapshot({ subtotal: subtotalAmount, savings, shippingCost, freeShipping });
      if (data.intentId) {
        sessionStorage.setItem("moi_paymob_intent_id", data.intentId);
        sessionStorage.setItem("moi_paymob_order_total", resolvedTotal);
        // Persist breakdown + items so they survive a 3DS full-page redirect after retry
        sessionStorage.setItem("moi_paymob_breakdown", JSON.stringify({ subtotal: subtotalAmount, savings, shippingCost, freeShipping }));
        if (retryItemsSnapshot.length > 0) {
          sessionStorage.setItem("moi_paymob_items", JSON.stringify(retryItemsSnapshot));
        }
      }
      paymobTrackedRef.current = false;
      window.location.href = data.iframeUrl;
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
    }
  }, [isShopify, shopifyCart, localItems, form, promoApplied, shopifyCheckoutToken, totalAmount, subtotalAmount, savings, shippingCost, freeShipping, fmt]);

  // Keep refreshSessionRef pointing at the latest handleRefreshPaymobSession so
  // callbacks defined earlier in the component can call it without an ordering issue.
  useEffect(() => {
    refreshSessionRef.current = () => { void handleRefreshPaymobSession(); };
  }, [handleRefreshPaymobSession]);

  // When cart contents change (items added/removed) and a promo code is active,
  // silently re-apply it so Shopify recalculates the discount on the new subtotal.
  // The isApplyingRef guard prevents this from firing during the explicit
  // handleApplyPromo flow and from cascading during the re-apply itself.
  useEffect(() => {
    if (!shopifyCart || !promoApplied) return;
    if (isApplyingRef.current) return;
    // Get the actual discount code from Shopify's cart
    const code = shopifyCart.discountCodes.find((d) => d.applicable)?.code;
    if (!code) { setPromoApplied(null); return; }
    // No need to re-apply if the code on the cart is already our active one
    if (code.toUpperCase() === promoApplied.code.toUpperCase()) return;
    // Cart changed (or Shopify dropped the code). Re-apply.
    isApplyingRef.current = true;
    void applyDiscount(promoApplied.code)
      .then((r) => {
        if (!r.applicable) setPromoApplied(null);
      })
      .catch(() => setPromoApplied(null))
      .finally(() => { isApplyingRef.current = false; });
  }, [shopifyCart?.lines.nodes.map((l) => `${l.id}:${l.quantity}`).join(",")]);


  // On mount: restore state if the user was redirected back from Paymob's 3DS page.
  // /api/paymob-return writes moi_paymob_result + sibling keys before redirecting to /.
  // Also restore InstaPay state after a tab switch on mobile.
  // Intentionally mount-only: sessionStorage keys are consumed once, deps would cause re-runs.
  useEffect(() => {
    // 1. Paymob restore
    const resultRaw = sessionStorage.getItem("moi_paymob_result");
    if (resultRaw) {
      const intentIdRaw = sessionStorage.getItem("moi_paymob_intent_id");
      const orderTotalRaw = sessionStorage.getItem("moi_paymob_order_total");

      const breakdownRaw = sessionStorage.getItem("moi_paymob_breakdown");
      const itemsRaw = sessionStorage.getItem("moi_paymob_items");
      ["moi_paymob_result", "moi_paymob_intent_id", "moi_paymob_order_total", "moi_paymob_breakdown", "moi_paymob_items"].forEach((k) => sessionStorage.removeItem(k));

      try {
        const result = JSON.parse(resultRaw) as { success: boolean; transactionId?: string; merchantOrderId?: string };
        const txnId = result.transactionId || undefined;
        const restoredItems = itemsRaw ? JSON.parse(itemsRaw) as OrderResult["items"] : undefined;
        setOrderResult({
          orderNumber: "",
          total: orderTotalRaw ?? "",
          intentId: intentIdRaw ?? result.merchantOrderId ?? undefined,
          paymobTxnId: txnId,
          items: restoredItems,
        });
        if (breakdownRaw) {
          try {
            const bd = JSON.parse(breakdownRaw) as { subtotal: number; savings: number; shippingCost: number; freeShipping: boolean };
            setBreakdownSnapshot(bd);
          } catch { /* ignore */ }
        }
        if (result.success) {
          const syncIntentId = intentIdRaw ?? result.merchantOrderId;
          const txnId = result.transactionId;
          if (syncIntentId) {
            void fetch("/api/orders/paymob-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ intentId: syncIntentId, ...(txnId ? { paymobTxnId: txnId } : {}) }),
            }).catch(() => {});
          }
          clearCart();
          setStep("card-confirm");
        } else {
          setStep("form");
          submittingRef.current = false;
          setSubmitError("Payment was declined. Please try again or choose a different payment method.");
          // Restore form data saved before 3DS redirect so the user doesn't have to re-type
          const savedFormRaw = sessionStorage.getItem("moi_checkout_form");
          if (savedFormRaw) {
            sessionStorage.removeItem("moi_checkout_form");
            try {
              const savedForm = JSON.parse(savedFormRaw) as typeof form;
              setForm(savedForm);
            } catch { /* ignore */ }
          }
        }
        openCheckout();
      } catch {
        // ignore malformed sessionStorage data
      }
      return;
    }

    // 2. InstaPay restore after tab switch
    const instapayRaw = sessionStorage.getItem("moi_instapay_order_result");
    if (instapayRaw) {
      try {
        const restored = JSON.parse(instapayRaw) as OrderResult;
        setOrderResult(restored);
        setStep("instapay-confirm");
        openCheckout();
      } catch {
        sessionStorage.removeItem("moi_instapay_order_result");
      }
    }
  }, []); // mount-only — intentionally omits deps to avoid re-running on state changes

  // After the overlay countdown fires on a card payment, the postMessage path calls
  // handleIframeSuccess with shopifyOrderNumber=undefined (polling was stopped when the
  // message arrived). The order IS created server-side during the 5-second countdown,
  // so we poll paymob-status here until we get the order number — up to 30 s.
  useEffect(() => {
    if (step !== "card-confirm") return;
    if (orderResult?.shopifyOrderNumber) return;
    const intentId = orderResult?.intentId;
    if (!intentId) return;

    let cancelled = false;
    let attempts = 0;
    const MAX = 15; // 2 s × 15 = 30 s

    const run = async () => {
      while (!cancelled && attempts < MAX) {
        attempts++;
        await new Promise<void>((r) => setTimeout(r, 2000));
        if (cancelled) break;
        try {
          const res = await fetch(`/api/orders/paymob-status/${intentId}`, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json() as { status: string; shopifyOrderId?: number | null; shopifyOrderNumber?: number | null };
          if (data.shopifyOrderNumber) {
            setOrderResult((prev) => prev ? {
              ...prev,
              shopifyOrderNumber: data.shopifyOrderNumber!,
              shopifyOrderId: data.shopifyOrderId ?? prev.shopifyOrderId,
            } : prev);
            break;
          }
        } catch { /* keep polling */ }
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [step, orderResult?.intentId, orderResult?.shopifyOrderNumber]);

  const isSuccessStep = step === "cod-confirm" || step === "card-confirm";
  const isConfirmStep = isSuccessStep || step === "instapay-confirm";
  const loadingText = (paymentMethod === "card" || paymentMethod === "wallet") ? "Preparing payment…" : "Placing your order…";


  return (
    <>
    <AnimatePresence>
      {checkoutOpen && (
        <motion.div
          key="checkout-overlay"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: "tween", duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[120] overflow-y-auto"
          style={{ backgroundColor: "#efe6da" }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-10 py-5"
            style={{ backgroundColor: "#efe6da", borderBottom: "1px solid rgba(30,24,20,0.14)" }}
          >
            <button
              onClick={isSuccessStep ? handleSuccessDone : isConfirmStep ? handleDone : closeCheckout}
              className="flex items-center gap-2 transition-opacity hover:opacity-50"
              aria-label="Back"
            >
              <ArrowLeft size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              <span style={{ fontSize: "14px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif" }}>
                {isConfirmStep ? "Continue shopping" : "Back"}
              </span>
            </button>
            <span style={{ fontSize: "14px", letterSpacing: "0.4em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
              MOI
            </span>
            <div style={{ width: 80 }} />
          </div>

          {step === "loading" ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                style={{ width: 28, height: 28, border: "1.5px solid rgba(30,24,20,0.32)", borderTopColor: "#1e1814", borderRadius: "50%" }}
              />
              <p style={{ fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>
                {loadingText}
              </p>
            </div>
          ) : step === "cod-confirm" ? (
            <CODConfirmation orderResult={orderResult!} onDone={handleSuccessDone} items={successItems} breakdown={{ ...(breakdownSnapshot ?? { subtotal: subtotalAmount, savings, shippingCost, freeShipping }), fmt }} />
          ) : step === "instapay-confirm" ? (
            <InstapayConfirmation
              orderResult={orderResult!}
              onDone={handleSuccessDone}
              breakdown={{ ...(breakdownSnapshot ?? { subtotal: subtotalAmount, savings, shippingCost, freeShipping }), fmt }}
              onProofSubmitted={(orderNumber, shopifyOrderId, total) => {
                // Guard: double-click or rapid re-submit can fire this callback twice
                if (instapayTrackedRef.current) return;
                instapayTrackedRef.current = true;

                setOrderResult((prev) => prev ? { ...prev, orderNumber, shopifyOrderId, total } : prev);
                sessionStorage.removeItem("moi_instapay_order_result");
                clearCart();
                const proofOrderLines = isShopify && shopifyCart
                  ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
                  : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
                const proofTotal = isShopify && shopifyCart && shopifyCart.cost?.totalAmount?.amount
                  ? parseFloat(shopifyCart.cost.totalAmount.amount)
                  : (Number.isFinite(totalAmount) ? totalAmount : 0);
                const proofItems = proofOrderLines.reduce((s, l) => s + l.quantity, 0);
                import("@/lib/analytics").then(({ trackPurchaseWithTime: trackInternalPurchase }) => {
                  trackInternalPurchase(String(orderNumber), proofTotal, "instapay");
                });
                trackTikTokPurchase({
                  content_id: proofOrderLines[0]?.variantId,
                  currency: "EGP",
                  value: proofTotal,
                  quantity: proofItems,
                  order_id: String(orderNumber),
                });
                trackShopifyPurchase({
                  orderId: String(shopifyOrderId ?? orderNumber),
                  orderNumber: orderNumber,
                  totalPrice: proofTotal,
                  currencyCode: "EGP",
                  lineItems: proofOrderLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
                });
                if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
                  (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "purchase", {
                    transaction_id: String(orderNumber ?? shopifyOrderId ?? ""),
                    value: proofTotal,
                    currency: "EGP",
                    items: proofOrderLines.map((l) => ({ item_id: l.variantId, quantity: l.quantity })),
                  });
                }
              }}
              fmt={fmt}
            />
          ) : step === "card-confirm" ? (
            <CardConfirmation
              orderResult={orderResult!}
              onDone={handleSuccessDone}
              items={successItems}
              breakdown={{
                ...(breakdownSnapshot ?? { subtotal: subtotalAmount, savings, shippingCost, freeShipping }),
                fmt,
                total: orderResult?.total ? parseFloat(orderResult.total) || undefined : undefined,
              }}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              {/* Left: Order Summary */}
              <div>
                {/* Section heading */}
                <div className="flex items-center gap-3 mb-6">
                  <ShoppingBag size={14} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.5)", flexShrink: 0 }} />
                  <p style={{ fontSize: "11px", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
                    Order Summary
                  </p>
                  <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(30,24,20,0.1)" }} />
                </div>

                {/* Product lines */}
                <div className="flex flex-col" style={{ gap: 0 }}>
                  {lines
                    ? lines.map((line, idx) => {
                        const lineImg = resolveLineImage(line, localItems);
                        return (
                          <div key={line.id} className="flex gap-5 py-5" style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", borderTop: idx === 0 ? "1px solid rgba(30,24,20,0.08)" : "none" }}>
                            {/* Large product image */}
                            <div className="flex-shrink-0 overflow-hidden" style={{ width: 96, height: 120, backgroundColor: "rgba(30,24,20,0.07)" }}>
                              {lineImg ? (
                                <img src={lineImg} alt={line.merchandise.product.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag size={22} strokeWidth={1} style={{ color: "rgba(30,24,20,0.22)" }} />
                                </div>
                              )}
                            </div>
                            {/* Product info */}
                            <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                              <div>
                                <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "19px", fontWeight: 600, color: "#1e1814", lineHeight: 1.25, letterSpacing: "0.01em" }}>
                                  {line.merchandise.product.title}
                                </p>
                                {line.merchandise.title !== "Default Title" && (
                                  <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginTop: 6, fontWeight: 500 }}>
                                    {line.merchandise.title}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-end justify-between mt-4">
                                <span style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(30,24,20,0.46)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                                  Qty {line.quantity}
                                </span>
                                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1e1814" }}>
                                  {formatShopifyLinePrice(line)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    : localLines.map((item, idx) => (
                        <div key={item.id} className="flex gap-5 py-5" style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", borderTop: idx === 0 ? "1px solid rgba(30,24,20,0.08)" : "none" }}>
                          <div className="flex-shrink-0 overflow-hidden" style={{ width: 96, height: 120, backgroundColor: "rgba(30,24,20,0.07)" }}>
                            {item.image ? (
                              <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag size={22} strokeWidth={1} style={{ color: "rgba(30,24,20,0.22)" }} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                            <div>
                              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "19px", fontWeight: 600, color: "#1e1814", lineHeight: 1.25, letterSpacing: "0.01em" }}>
                                {item.title}
                              </p>
                              {item.color && (
                                <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginTop: 6, fontWeight: 500 }}>
                                  {item.color}
                                </p>
                              )}
                            </div>
                            <div className="flex items-end justify-between mt-4">
                              <span style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(30,24,20,0.46)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                                Qty {item.quantity}
                              </span>
                              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "15px", fontWeight: 700, color: "#1e1814" }}>
                                {fmt(item.priceAmount * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>

                {/* Totals block */}
                <div className="mt-1">
                  <AnimatePresence>
                    {promoApplied && savings > 0 && (
                      <motion.div
                        key="savings-row"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "spring", stiffness: 340, damping: 28 }}
                        className="flex items-center justify-between px-4 py-3 mt-4"
                        style={{ backgroundColor: "rgba(52,95,67,0.07)", border: "1px solid rgba(52,95,67,0.22)" }}
                      >
                        <div className="flex items-center gap-3">
                          <Tag size={11} strokeWidth={2} style={{ color: "#2f6644", flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#2f6644", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                              Promo applied
                            </p>
                            <p style={{ fontSize: "11px", color: "rgba(47,102,68,0.75)", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>
                              {promoApplied.code} — -{fmt(savings)}
                            </p>
                          </div>
                        </div>
                        {subtotalAmount > 0 && (
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", color: "#2f6644", fontWeight: 700, letterSpacing: "0.04em" }}>
                            {Math.round((savings / subtotalAmount) * 100)}% off
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Subtotal row */}
                  <div className="flex justify-between items-center py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
                    <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Subtotal</span>
                    <span style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>{fmt(discountedSubtotal)}</span>
                  </div>

                  {/* Free shipping nudge */}
                  {!freeShipping && discountedSubtotal > 0 && (
                    <div className="py-3" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
                      <div className="flex justify-between items-center mb-2">
                        <p style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: "#6b8f5e" }}>
                          {new Intl.NumberFormat("en-EG").format(2000 - discountedSubtotal)} EGP to free delivery
                        </p>
                        <p style={{ fontSize: "10px", letterSpacing: "0.12em", fontFamily: "'Montserrat', sans-serif", color: "rgba(107,143,94,0.7)" }}>
                          2,000 EGP
                        </p>
                      </div>
                      <div style={{ height: 2, backgroundColor: "rgba(107,143,94,0.18)", borderRadius: 1, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (discountedSubtotal / 2000) * 100)}%`, backgroundColor: "#6b8f5e", borderRadius: 1, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  )}

                  {/* Free shipping unlocked */}
                  {freeShipping && (
                    <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
                      <Check size={13} strokeWidth={2} style={{ color: "#6b8f5e", flexShrink: 0 }} />
                      <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: "#6b8f5e" }}>
                        Free delivery unlocked
                      </p>
                    </div>
                  )}

                  {/* Shipping row */}
                  <div className="flex justify-between items-center py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.07)" }}>
                    <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Shipping</span>
                    <span style={{ fontSize: "15px", color: "#6b8f5e", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                      {freeShipping
                        ? <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 600, color: "#6b8f5e", letterSpacing: "0.06em", textTransform: "uppercase" }}>Free</span>
                        : fmt(SHIPPING_EGP)}
                    </span>
                  </div>

                  {/* Total row — most prominent */}
                  <div className="flex justify-between items-center pt-5 pb-2">
                    <div>
                      <p style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, marginBottom: 3 }}>Total</p>
                      <p style={{ fontSize: "11px", letterSpacing: "0.14em", color: "rgba(30,24,20,0.4)", fontFamily: "'Montserrat', sans-serif" }}>Incl. VAT & fees</p>
                    </div>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "22px", fontWeight: 700, color: "#1e1814", letterSpacing: "0.02em", lineHeight: 1 }}>
                      {fmt(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Promo / Gift Card */}
                {SHOPIFY_CONFIGURED && (
                  <div className="mt-7 pt-6" style={{ borderTop: "1px solid rgba(30,24,20,0.1)" }}>
                    <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, marginBottom: "14px" }}>
                      Promo / Gift Card
                    </p>
                    {promoApplied ? (
                      <div className="flex items-center justify-between py-3 px-4" style={{ backgroundColor: "rgba(90,122,90,0.07)", border: "1px solid rgba(90,122,90,0.2)" }}>
                        <div className="flex items-center gap-3">
                          <Check size={13} strokeWidth={2} style={{ color: "#5a7a5a" }} />
                          <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", fontWeight: 600 }}>{promoApplied.code}</span>
                        </div>
                        <button onClick={handleRemovePromo} style={{ fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3 items-end">
                        <input
                          type="text"
                          placeholder="Enter code"
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                          style={{ ...inputStyle, flex: 1 }}
                          className="checkout-input"
                        />
                        <button
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoInput.trim()}
                          className="transition-opacity hover:opacity-70 disabled:opacity-40"
                          style={{ fontSize: "11px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, paddingBottom: "14px", background: "none", border: "none", borderBottom: "1px solid rgba(30,24,20,0.22)", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          {promoLoading ? "…" : "Apply"}
                        </button>
                      </div>
                    )}
                    {promoError && (
                      <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: 8, letterSpacing: "0.04em" }}>{promoError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Payment + Form */}
              <div>

                {/* ── Express Checkout (Apple Pay) ── */}
                {ENABLE_APPLE_PAY && typeof window !== "undefined" && "ApplePaySession" in window && (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() && (
                  <div style={{ marginBottom: "28px" }}>
                    <p style={{
                      fontSize: "10px",
                      letterSpacing: "0.3em",
                      textTransform: "uppercase",
                      color: "rgba(30,24,20,0.38)",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 400,
                      textAlign: "center",
                      marginBottom: "12px",
                    }}>
                      Express Checkout
                    </p>

                    <style dangerouslySetInnerHTML={{ __html: `
                      .ap-express-wrap {
                        width: 100%;
                        background: transparent;
                        padding: 0;
                        margin-bottom: 0;
                      }
                      .ap-express-btn {
                        -webkit-appearance: -apple-pay-button;
                        -apple-pay-button-type: buy;
                        -apple-pay-button-style: black;
                        width: 100%;
                        height: 52px;
                        border-radius: 0;
                        border: none;
                        padding: 0;
                        margin: 0;
                        cursor: pointer;
                        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                        font-size: 17px;
                        font-weight: 400;
                        font-style: normal;
                        line-height: normal;
                        letter-spacing: normal;
                        word-spacing: normal;
                        text-transform: none;
                        transform: none;
                        zoom: 1;
                        -webkit-text-size-adjust: 100%;
                        text-size-adjust: 100%;
                      }
                      .ap-express-btn:disabled {
                        opacity: 0.4;
                        cursor: default;
                      }
                    ` }} />
                    <div className="ap-express-wrap">
                      <button
                        type="button"
                        className="ap-express-btn"
                        onClick={triggerApplePayDirectInit}
                        aria-label="Buy with Apple Pay"
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "20px" }}>
                      <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(30,24,20,0.10)" }} />
                      <span style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: "10px",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "rgba(30,24,20,0.38)",
                        fontWeight: 400,
                        flexShrink: 0,
                      }}>
                        or
                      </span>
                      <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(30,24,20,0.10)" }} />
                    </div>
                  </div>
                )}

                {/* ── Payment Method tiles ── */}
                <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  Payment Method
                  <span style={{ fontSize: "13px", letterSpacing: 0, textTransform: "none", color: "#c9a0b4", opacity: 0.85 }}>✦</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8" style={{ alignItems: "start" }}>
                  {AVAILABLE_PAYMENT_METHODS.filter((m) => m !== "apple-pay").map((m) => {
                    const selected = paymentMethod === m;
                    return (
                      <div key={m} style={{ position: "relative" }}>
                        <button
                          onClick={() => setPaymentMethod(m)}
                          className="text-left w-full"
                          style={{
                            padding: "18px 14px",
                            height: "112px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            border: selected ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.15)",
                            backgroundColor: selected ? "rgba(30,24,20,0.04)" : "transparent",
                            width: "100%",
                            transform: selected ? "scale(1.05)" : "scale(1)",
                            boxShadow: selected ? "0 2px 12px rgba(30,24,20,0.10)" : "none",
                            transition: "transform 0.18s ease, box-shadow 0.18s ease, border 0.12s ease, background-color 0.12s ease",
                            zIndex: selected ? 1 : 0,
                          }}
                        >
                          <div style={{ fontSize: "17px", marginBottom: "5px", display: "flex", alignItems: "center" }}>
                            {m === "wallet" ? (
                              <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0.75" y="4.75" width="18.5" height="12.5" rx="2.25" stroke="#1e1814" strokeWidth="1.3"/>
                                <path d="M0.75 8.25H19.25" stroke="#1e1814" strokeWidth="1.3" strokeLinecap="round"/>
                                <path d="M1 6C1 4.34 2.34 3 4 3H16C17.66 3 19 4.34 19 6" stroke="#1e1814" strokeWidth="1.3" strokeLinecap="round"/>
                                <rect x="12.5" y="10.5" width="5.5" height="3.5" rx="1.1" fill="rgba(30,24,20,0.13)" stroke="#1e1814" strokeWidth="1.1"/>
                                <circle cx="14.25" cy="12.25" r="0.7" fill="#1e1814"/>
                              </svg>
                            ) : m === "cod" ? "🚚" : m === "instapay" ? "📱" : "💳"}
                          </div>
                          <p style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, lineHeight: 1.3 }}>
                            {m === "cod" ? "Cash on Delivery" : m === "instapay" ? "InstaPay" : m === "wallet" ? "Mobile Wallet" : "Credit / Debit Card"}
                          </p>
                          <p style={{ fontSize: "10px", color: "rgba(30,24,20,0.64)", fontFamily: "'Montserrat', sans-serif", marginTop: "3px", lineHeight: 1.45 }}>
                            {m === "cod" ? "Pay on arrival" : m === "instapay" ? "Bank transfer" : m === "wallet" ? "Vodafone · Orange · e&" : "Visa · Mastercard"}
                          </p>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Delivery form */}
                {true && (<>
                <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Delivery Details
                </p>

                <form id="checkout-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label style={labelStyle}>First Name</label>
                      <input type="text" name="given-name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={inputStyle} autoComplete="given-name" className="checkout-input" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label style={labelStyle}>Last Name</label>
                      <input type="text" name="family-name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} autoComplete="family-name" className="checkout-input" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Phone Number</label>
                    <input type="tel" name="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} autoComplete="tel" placeholder="01X XXXX XXXX" className="checkout-input" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      inputMode="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setEmailError(""); }}
                      onBlur={handleEmailBlur}
                      style={inputStyle}
                      placeholder="your@email.com"
                      className="checkout-input"
                    />
                    {emailError && (
                      <p style={{ marginTop: "6px", fontSize: "12px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{emailError}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Address</label>
                    <input type="text" name="street-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} autoComplete="street-address" className="checkout-input" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col gap-1 relative">
                      <label style={labelStyle}>Governorate</label>
                      <button type="button" onClick={() => setGovernorateOpen((o) => !o)} style={governorateInputStyle} className="checkout-input">
                        <span style={{ color: form.governorate ? "#1e1814" : "rgba(30,24,20,0.42)" }}>
                          {form.governorate || "Select governorate"}
                        </span>
                        <ChevronDown size={14} strokeWidth={1.8} style={{ color: "rgba(30,24,20,0.55)", flexShrink: 0 }} />
                      </button>
                      <AnimatePresence>
                        {governorateOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.16 }}
                            style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, marginTop: 8 }}
                          >
                            <div style={optionListStyle}>
                              {GOVERNORATES.map((governorate) => (
                                <button
                                  key={governorate}
                                  type="button"
                                  onClick={() => { setForm((f) => ({ ...f, governorate })); setGovernorateOpen(false); }}
                                  style={{ ...optionStyle, backgroundColor: form.governorate === governorate ? "rgba(30,24,20,0.06)" : "transparent" }}
                                >
                                  {governorate}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label style={labelStyle}>Postal Code <span style={{ textTransform: "none", letterSpacing: "0.08em", opacity: 0.7, fontSize: "11px" }}>(optional)</span></label>
                      <input type="text" name="postal-code" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} style={inputStyle} autoComplete="postal-code" className="checkout-input" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>City</label>
                    <input type="text" name="address-level2" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={inputStyle} autoComplete="address-level2" className="checkout-input" />
                  </div>

                  {submitError && (
                    <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: "12px", letterSpacing: "0.04em" }}>{submitError}</p>
                  )}

                  {paymentMethod === "instapay" && (
                    <div className="mt-5 p-4" style={{ backgroundColor: "rgba(30,24,20,0.05)", border: "1px solid rgba(30,24,20,0.14)" }}>
                      <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, letterSpacing: "0.04em" }}>
                        After placing your order, you'll see payment instructions and can upload your transfer screenshot directly on the site.
                      </p>
                    </div>
                  )}

                  {/* Place Order — static at bottom of form */}
                  <div style={{ marginTop: "32px" }}>
                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        padding: "18px",
                        backgroundColor: "#1e1814",
                        color: "#fff",
                        fontSize: "11px",
                        letterSpacing: "0.35em",
                        textTransform: "uppercase",
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Place Order
                    </button>
                    <p style={{ fontSize: "10px", color: "rgba(30,24,20,0.42)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", marginTop: "10px", letterSpacing: "0.12em" }}>
                      By placing your order you agree to our terms of service.
                    </p>
                  </div>
                </form>

                </>)}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

function CODConfirmation({ orderResult, onDone, items, breakdown }: { orderResult: OrderResult; onDone: () => void; items: NonNullable<OrderResult["items"]>; breakdown: OrderBreakdown }) {
  return (
    <OrderConfirmedScreen
      orderResult={orderResult}
      onDone={onDone}
      items={items}
      breakdown={breakdown}
      title="Order Confirmed."
      subtitle="Cash on Delivery"
      message={orderResult.shopifyOrderNumber
        ? <>Your order has been placed for order <strong style={{ color: "#1e1814" }}>#{orderResult.shopifyOrderNumber}</strong>. Our team will contact you shortly to arrange delivery. Total due on arrival: {orderResult.total} EGP.</>
        : `Your order has been placed. Our team will contact you shortly to arrange delivery. Total due on arrival: ${orderResult.total} EGP.`}
      note="A WhatsApp confirmation has been sent to your number."
    />
  );
}

function CardConfirmation({
  orderResult,
  onDone,
  items,
  breakdown,
}: {
  orderResult: OrderResult;
  onDone: () => void;
  items: NonNullable<OrderResult["items"]>;
  breakdown: OrderBreakdown;
}) {
  return (
    <OrderConfirmedScreen
      orderResult={orderResult}
      onDone={onDone}
      items={items}
      breakdown={breakdown}
      message={orderResult.shopifyOrderNumber
        ? <>Your payment has been received for order <strong style={{ color: "#1e1814" }}>#{orderResult.shopifyOrderNumber}</strong>. Your order is now being prepared.</>
        : "Your payment has been received and your order is now being prepared."}
      note="You'll receive a WhatsApp message with your order details and tracking update shortly."
    />
  );
}

function OrderConfirmedScreen({
  orderResult,
  onDone,
  items,
  breakdown,
  title = "Order Confirmed.",
  subtitle,
  message,
  note,
  orderNumber,
}: {
  orderResult: OrderResult;
  onDone: () => void;
  items: NonNullable<OrderResult["items"]>;
  breakdown: OrderBreakdown;
  title?: string;
  subtitle?: string;
  message?: React.ReactNode;
  note?: string;
  orderNumber?: string | number | null;
}) {
  const displayOrderNumber = orderNumber ?? orderResult.shopifyOrderNumber;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6"
    >
      <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={24} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        {subtitle && (
          <p style={{ fontSize: "11px", letterSpacing: "0.34em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginBottom: "6px" }}>
            {subtitle}
          </p>
        )}
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "33px", fontWeight: 700, color: "#1e1814", marginBottom: "6px" }}>
          {title}
        </h1>
        {message && (
          <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
            {message}
          </p>
        )}
      </div>

      {displayOrderNumber ? (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>
            Order Number
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "29px", color: "#1e1814", fontWeight: 700 }}>
            #{displayOrderNumber}
          </p>
        </div>
      ) : (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.1)", width: "100%", textAlign: "center", opacity: 0.55 }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
            Confirming order…
          </p>
        </div>
      )}

      <div className="w-full">
        <OrderBreakdownRows breakdown={breakdown} />
      </div>

      {items.length > 0 && (
        <div className="w-full flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id ?? `${item.title}-${item.quantity}`} className="flex items-center gap-3 px-4 py-3" style={{ border: "1px solid rgba(30,24,20,0.08)", backgroundColor: "rgba(30,24,20,0.02)" }}>
              <div className="w-12 h-14 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.08)" }}>
                {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </p>
                {item.variantTitle && (
                  <p style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(30,24,20,0.56)", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>
                    {item.variantTitle}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.56)", fontFamily: "'Montserrat', sans-serif" }}>Qty {item.quantity}</p>
                {item.price && (
                  <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{item.price}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {note && (
        <div style={{ padding: "14px 18px", backgroundColor: "rgba(30,24,20,0.04)", border: "1px solid rgba(30,24,20,0.12)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", lineHeight: 1.7 }}>
            {note}
          </p>
        </div>
      )}

      <button
        onClick={onDone}
        className="mt-2 transition-opacity hover:opacity-60"
        style={{ fontSize: "14px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", padding: "12px 32px", border: "1px solid rgba(30,24,20,0.18)" }}
      >
        Continue Shopping
      </button>
    </motion.div>
  );
}


function InstapayConfirmation({
  orderResult,
  onDone,
  onProofSubmitted,
  fmt,
  breakdown,
}: {
  orderResult: OrderResult;
  onDone: () => void;
  onProofSubmitted: (orderNumber: string | number, shopifyOrderId: number | null, total: string) => void;
  fmt: (n: number) => string;
  breakdown: OrderBreakdown;
}) {
  const [subStep, setSubStep] = useState<InstapaySubStep>("instructions");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isTouch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  const instapayAccount = orderResult.instapayAccount ?? import.meta.env.VITE_INSTAPAY_ACCOUNT_NAME ?? "";
  const instapayNumber = orderResult.instapayNumber ?? import.meta.env.VITE_INSTAPAY_ACCOUNT_NUMBER ?? "";

  function applyFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (JPG, PNG, HEIC).");
      return;
    }
    const preview = URL.createObjectURL(file);
    setScreenshotFile(file);
    setScreenshotPreview(preview);
    setUploadError("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) applyFile(file);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  }

  async function handleSubmitProof() {
    if (!referenceNumber.trim()) {
      setUploadError("Please enter the Instapay reference number.");
      return;
    }
    if (!screenshotFile) {
      setUploadError("Please upload your payment screenshot to continue.");
      return;
    }

    setUploadError("");
    setUploading(true);
    setUploadProgress(5);

    try {
      const compressed = await compressImage(screenshotFile);
      setUploadProgress(20);

      const formData = new FormData();
      formData.append("draftOrderId", String(orderResult.draftOrderId ?? ""));
      formData.append("referenceNumber", referenceNumber.trim());
      if (orderResult.customerName) formData.append("customerName", orderResult.customerName);
      if (orderResult.customerPhone) formData.append("customerPhone", orderResult.customerPhone);
      formData.append("amount", orderResult.total.replace(/,/g, ""));
      formData.append("screenshot", compressed, "proof.jpg");

      const data = await new Promise<{
        ok?: boolean;
        alreadySubmitted?: boolean;
        error?: string;
        orderNumber?: string | number;
        shopifyOrderId?: number;
        total?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/orders/instapay-proof");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(20 + Math.round((ev.loaded / ev.total) * 70));
          }
        };
        xhr.onload = () => {
          try {
            resolve(JSON.parse(xhr.responseText) as {
              ok?: boolean; alreadySubmitted?: boolean; error?: string;
              orderNumber?: string | number; shopifyOrderId?: number; total?: string;
            });
          }
          catch { reject(new Error("Invalid response")); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      setUploadProgress(95);

      if (!data.ok && !data.alreadySubmitted) {
        setUploadError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      if (data.orderNumber != null) {
        setConfirmedOrderNumber(data.orderNumber);
        onProofSubmitted(data.orderNumber, data.shopifyOrderId ?? null, data.total ?? orderResult.total);
      }

      setUploadProgress(100);
      setSubStep("review");
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6"
    >
      {/* Heading — changes once order is confirmed */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "33px", fontWeight: 700, color: "#1e1814", marginBottom: "6px" }}>
          {subStep === "review" ? "Order Confirmed." : "Payment Instructions"}
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
          {subStep === "review"
            ? "We'll verify your payment and contact you shortly."
            : "Complete the steps below to place your order."}
        </p>
      </div>

      {/* Order number — only shown once proof is submitted */}
      {confirmedOrderNumber != null && (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>Order Number</p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "29px", color: "#1e1814", fontWeight: 700 }}>#{confirmedOrderNumber}</p>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-0 w-full" style={{ maxWidth: 320 }}>
        {(["instructions", "upload", "review"] as InstapaySubStep[]).map((s, i) => (
          <div key={s} className="flex items-center" style={{ flex: 1 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: subStep === s ? "#1e1814" : (i < ["instructions","upload","review"].indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.12)"),
              flexShrink: 0,
            }}>
              {i < ["instructions","upload","review"].indexOf(subStep) ? (
                <Check size={12} strokeWidth={2.5} style={{ color: "#fff" }} />
              ) : (
                <span style={{ fontSize: "11px", color: subStep === s ? "#fff" : "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{i + 1}</span>
              )}
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, backgroundColor: i < ["instructions","upload","review"].indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.18)", marginLeft: 2, marginRight: 2 }} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {subStep === "instructions" && (
          <motion.div key="instructions" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <OrderBreakdownRows breakdown={breakdown} />
            <div style={{ border: "1px solid rgba(30,24,20,0.22)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.03)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>How to Pay via Instapay</p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  `Open your banking app and transfer ${orderResult.total} EGP via Instapay.`,
                  `Send to the account below. Save your reference number.`,
                  `Return here to upload your payment screenshot.`,
                ].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#1e1814", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", color: "#fff", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.88)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(30,24,20,0.22)", backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>Instapay Account</p>
              </div>
              <div className="p-4 space-y-3">
                {instapayAccount && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Name</p>
                      <p style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{instapayAccount}</p>
                    </div>
                    <button onClick={() => copyToClipboard(instapayAccount, "name")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "name" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                      {copied === "name" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                {instapayNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Account / Number</p>
                      <p style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}>{instapayNumber}</p>
                    </div>
                    <button onClick={() => copyToClipboard(instapayNumber, "number")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "number" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                      {copied === "number" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(30,24,20,0.1)" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Amount</p>
                    <p style={{ fontSize: "17px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{orderResult.total} EGP</p>
                  </div>
                  <button onClick={() => copyToClipboard(orderResult.total, "amount")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "amount" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                    {copied === "amount" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSubStep("upload")}
              className="w-full py-4 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              I've Sent the Payment →
            </button>
          </motion.div>
        )}

        {subStep === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <div>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>Instapay Reference Number <span style={{ color: "#c0392b" }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={inputStyle}
                className="checkout-input"
              />
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>
                Payment Screenshot <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onPaste={handlePaste}
                onClick={() => fileRef.current?.click()}
                tabIndex={0}
                style={{
                  border: "1.5px dashed rgba(30,24,20,0.28)",
                  padding: "24px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: screenshotPreview ? "transparent" : "rgba(30,24,20,0.02)",
                  position: "relative",
                  overflow: "hidden",
                  outline: "none",
                }}
              >
                {screenshotPreview ? (
                  <div style={{ position: "relative", width: "100%" }}>
                    <img src={screenshotPreview} alt="Screenshot preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain" }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setScreenshotFile(null); setScreenshotPreview(null); }}
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
                    >
                      <X size={12} strokeWidth={2} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={20} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                    <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", lineHeight: 1.6 }}>
                      {isTouch ? "Tap to upload your screenshot" : "Drag & drop, paste, or click to upload"}<br />
                      <span style={{ fontSize: "11px", opacity: 0.7 }}>JPG, PNG, HEIC accepted</span>
                    </p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              </div>
            </div>

            {uploading && (
              <div style={{ width: "100%", height: 3, backgroundColor: "rgba(30,24,20,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  style={{ height: "100%", backgroundColor: "#1e1814", borderRadius: 2 }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {uploadError && (
              <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>{uploadError}</p>
            )}

            <button
              onClick={handleSubmitProof}
              disabled={uploading || !referenceNumber.trim()}
              className="w-full py-4 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              {uploading ? "Submitting…" : "Submit Proof"}
            </button>

            <button
              onClick={() => setSubStep("instructions")}
              style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", textAlign: "center" as const }}
            >
              ← Back to Instructions
            </button>
          </motion.div>
        )}

        {subStep === "review" && (
          <OrderConfirmedScreen
            orderResult={orderResult}
            onDone={onDone}
            items={orderResult.items ?? []}
            breakdown={breakdown}
            title="Order Confirmed."
            subtitle="InstaPay"
            message={confirmedOrderNumber != null
              ? <>Your order is confirmed and payment proof is awaiting verification. Our team will review and confirm your order <strong style={{ color: "#1e1814" }}>#{confirmedOrderNumber}</strong> shortly.</>
              : "Your order is confirmed and payment proof is awaiting verification. Our team will review and confirm your order shortly."}
            note="Verification is usually completed within a few hours. You'll receive a WhatsApp message once confirmed."
            orderNumber={confirmedOrderNumber}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OrderBreakdownRows({ breakdown }: { breakdown: OrderBreakdown }) {
  const { subtotal, savings, shippingCost, freeShipping, fmt, total } = breakdown;
  const computedTotal = total ?? (subtotal - savings + shippingCost);
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
  const labelStyle: React.CSSProperties = { fontSize: "12px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" };
  const valueStyle: React.CSSProperties = { fontSize: "12px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 };
  const totalLabelStyle: React.CSSProperties = { fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.08em" };
  const totalValueStyle: React.CSSProperties = { fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 };
  return (
    <div style={{ border: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.02)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {subtotal > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Subtotal</span>
          <span style={valueStyle}>{fmt(subtotal)}</span>
        </div>
      )}
      {savings > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Discount</span>
          <span style={{ ...valueStyle, color: "#5a7a5a" }}>−{fmt(savings)}</span>
        </div>
      )}
      <div style={rowStyle}>
        <span style={labelStyle}>Shipping</span>
        {freeShipping ? (
          <span style={{ ...valueStyle, color: "rgba(30,24,20,0.5)", fontStyle: "italic" }}>Complimentary</span>
        ) : (
          <span style={valueStyle}>{fmt(shippingCost)}</span>
        )}
      </div>
      <div style={{ ...rowStyle, borderTop: "1px solid rgba(30,24,20,0.12)", paddingTop: 8, marginTop: 2 }}>
        <span style={totalLabelStyle}>Total</span>
        <span style={totalValueStyle}>{fmt(computedTotal)}</span>
      </div>
    </div>
  );
}



