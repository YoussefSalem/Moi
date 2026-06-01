import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  beige: `${BASE_IMG}/beige.jpg`,
  white: `${BASE_IMG}/white.jpg`,
  cashmere: `${BASE_IMG}/cashmere.jpg`,
  cashemere: `${BASE_IMG}/cashmere.jpg`,
  yellow: `${BASE_IMG}/yellow.jpg`,
  teal: `${BASE_IMG}/teal.jpg`,
  "light blue": `${BASE_IMG}/light-blue-main.jpg`,
  navy: `${BASE_IMG}/navi.jpg`,
  mint: `${BASE_IMG}/mint.jpg`,
  ivory: `${BASE_IMG}/ivory.jpg`,
  sand: `${BASE_IMG}/sand.jpg`,
  taupe: `${BASE_IMG}/taupe.jpg`,
  espresso: `${BASE_IMG}/espresso.jpg`,
  brown: `${BASE_IMG}/brown.jpg`,
  black: `${BASE_IMG}/black.jpg`,
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

type PaymentMethod = "cod" | "instapay" | "card";
type Step = "email" | "form" | "loading" | "cod-confirm" | "instapay-confirm" | "card-checkout" | "card-confirm" | "card-failed";
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
  padding: "10px 0",
  fontSize: "15px",
  color: "#1e1814",
  fontWeight: 500,
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.025em",
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
  } = useCart();

  const [step, setStep] = useState<Step>("email");
  const [emailInput, setEmailInput] = useState("");
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
  const [paymentTimerActive, setPaymentTimerActive] = useState(false);
  const [paymentTimerKey, setPaymentTimerKey] = useState(0);
  const [sessionRefreshed, setSessionRefreshed] = useState(false);
  const [shopifyCheckoutToken, setShopifyCheckoutToken] = useState<string | null>(null);
  const isApplyingRef = useRef(false); // Prevents recursive re-apply while we update cart
  const paymobTrackedRef = useRef(false); // Prevents duplicate trackPurchase when iframe fires twice
  const instapayTrackedRef = useRef(false); // Prevents duplicate trackPurchase on double-submit
  const codTrackedRef = useRef(false); // Prevents duplicate trackPurchase if COD submit fires twice
  const submittingRef = useRef(false); // Prevents double-submit of COD/card/instapay order forms
  // Holds the latest handleRefreshPaymobSession so callbacks defined before it can call it.
  const refreshSessionRef = useRef<() => void>(() => {});

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
        setStep("email");
        setEmailInput("");
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

  useEffect(() => {
    if (checkoutOpen && prefilledEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(prefilledEmail.trim())) {
        setEmailInput(prefilledEmail);
        setForm((f) => ({ ...f, email: prefilledEmail }));
        setStep("form");
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

    // Map step names to analytics events (skip "email" — CartDrawer already fires start)
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
    setStep("email");
    setEmailInput("");
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
    if (!/^\d{7,15}$/.test(form.phone.replace(/\D/g, ""))) {
      setSubmitError("Please enter a valid phone number.");
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

    // Card payment: call paymob-init → embed Paymob hosted checkout in-page via iframe
    if (paymentMethod === "card") {
      try {
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
        paymobTrackedRef.current = false; // Reset guard for new card payment session
        setPaymobIframeUrl(data.iframeUrl);
        setStep("form"); // Return to form step — iframe renders inline on the same page
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      submittingRef.current = false;
      return;
    }

    // InstaPay: validate cart + get account info — order is created only at proof upload
    if (paymentMethod === "instapay") {
      try {
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
    setStep("email");
    setEmailInput("");
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

  const handleEmailContinue = useCallback(async () => {
    const email = emailInput.trim();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address (e.g. your@email.com).");
      return;
    }
    setEmailError("");
    setForm((f) => ({ ...f, email }));
    setStep("form");
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
  }, [emailInput, shopifyCart, isShopify, localItems, totalAmount, fmt]);

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

    setPaymentTimerActive(false);
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

  const handleIframeFail = useCallback(() => {
    setPaymentTimerActive(false);
    setPaymobIframeUrl(null);
    submittingRef.current = false;
    // Auto-refresh the payment session so the user lands back on the card form.
    // (Form state is still intact for in-app failures — unlike 3DS redirect failures
    // which go directly to card-failed via the mount effect and handleRetryCard.)
    refreshSessionRef.current();
  }, []);

  const handleCancelCardCheckout = useCallback(() => {
    setPaymobIframeUrl(null);
    setStep("form");
    setPaymentMethod("card");
    submittingRef.current = false;
  }, []);

  const handleRetryCard = useCallback(() => {
    setStep("form");
    setPaymentMethod("card");
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
    setPaymentTimerActive(false);
    setSessionRefreshed(false);
    setPaymobIframeUrl(null);
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
      if (data.intentId) {
        sessionStorage.setItem("moi_paymob_intent_id", data.intentId);
        sessionStorage.setItem("moi_paymob_order_total", resolvedTotal);
      }
      paymobTrackedRef.current = false;
      setPaymentTimerKey((k) => k + 1);
      setSessionRefreshed(true);
      setPaymobIframeUrl(data.iframeUrl);
      setStep("form");
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
    }
  }, [isShopify, shopifyCart, localItems, form, promoApplied, shopifyCheckoutToken, totalAmount, fmt]);

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

  // Activate / deactivate the payment session timer based on whether the iframe is showing.
  useEffect(() => {
    if (paymobIframeUrl) {
      setPaymentTimerActive(true);
    } else {
      setPaymentTimerActive(false);
    }
  }, [paymobIframeUrl]);

  // Auto-clear "Session Refreshed" banner after 6 seconds.
  useEffect(() => {
    if (!sessionRefreshed) return;
    const t = setTimeout(() => setSessionRefreshed(false), 6000);
    return () => clearTimeout(t);
  }, [sessionRefreshed]);

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
          setStep("card-failed");
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
  const isConfirmStep = isSuccessStep || step === "instapay-confirm" || step === "card-failed";
  const isCardCheckoutStep = step === "card-checkout" || (step === "form" && !!paymobIframeUrl);
  const loadingText = paymentMethod === "card" ? "Preparing payment…" : "Placing your order…";

  return (
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
              onClick={isSuccessStep ? handleSuccessDone : isConfirmStep ? handleDone : isCardCheckoutStep ? handleCancelCardCheckout : step === "form" ? () => setStep("email") : closeCheckout}
              className="flex items-center gap-2 transition-opacity hover:opacity-50"
              aria-label="Back"
            >
              <ArrowLeft size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              <span style={{ fontSize: "14px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif" }}>
                {isConfirmStep ? "Continue shopping" : isCardCheckoutStep ? "Cancel" : "Back"}
              </span>
            </button>
            <span style={{ fontSize: "14px", letterSpacing: "0.4em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
              MOI
            </span>
            <div style={{ width: 80 }} />
          </div>

          {(step === "card-checkout" || step === "form") && paymobIframeUrl ? (
            <motion.div
              key="card-checkout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 md:items-center"
            >
              {/* Left: compact order summary */}
              <div>
                <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Order Summary
                </p>
                <div style={{ borderTop: "1px solid rgba(30,24,20,0.16)" }}>
                  {lines
                    ? lines.map((line) => (
                        <div key={line.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.08)" }}>
                            {resolveLineImage(line, localItems) && (
                              <img src={resolveLineImage(line, localItems)!} alt={line.merchandise.product.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{line.merchandise.product.title}</p>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "14px", color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif" }}>Qty {line.quantity}</span>
                              <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{formatShopifyLinePrice(line)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    : localLines.map((item) => (
                        <div key={item.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.08)" }}>
                            {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{item.title}</p>
                              {item.color && <p style={{ fontSize: "14px", color: "#7a6e64", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>{item.color}</p>}
                            </div>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "14px", color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif" }}>Qty {item.quantity}</span>
                              <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{fmt(item.priceAmount * item.quantity)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>
                <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid rgba(30,24,20,0.12)" }}>
                  {savings > 0 && promoApplied && (
                    <div style={{
                      backgroundColor: "rgba(52,95,67,0.09)", border: "1px solid rgba(52,95,67,0.28)",
                      borderRadius: "2px", padding: "8px 12px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Tag size={11} strokeWidth={2} style={{ color: "#2f6644" }} />
                        <div>
                          <p style={{ fontSize: "10px", color: "#2f6644", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>Promo applied</p>
                          <p style={{ fontSize: "10px", color: "rgba(47,102,68,0.75)", fontFamily: "'Montserrat', sans-serif" }}>{promoApplied.code} — -{fmt(savings)}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "15px", color: "#2f6644", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{Math.round((savings / subtotalAmount) * 100)}% off</p>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ fontSize: "14px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>Subtotal</span>
                    <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{fmt(discountedSubtotal)}</span>
                  </div>
                  {!freeShipping && discountedSubtotal > 0 && (
                    <p style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, color: "#6b8f5e" }}>
                      {new Intl.NumberFormat("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(2000 - discountedSubtotal)} EGP away from free delivery
                    </p>
                  )}
                  {freeShipping && (
                    <div style={{ backgroundColor: "rgba(248,252,245,0.9)", border: "1px solid rgba(160,190,150,0.35)", borderRadius: "2px", padding: "8px 12px", textAlign: "center" }}>
                      <p style={{ fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: "#6b8f5e" }}>Free delivery unlocked</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "16px", color: "#6b8f5e", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em", fontWeight: 600 }}>Shipping</span>
                      {!freeShipping && (
                        <span style={{ fontSize: "19px", fontStyle: "italic", color: "rgba(107,143,94,0.85)", fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>— free over 2,000 EGP</span>
                      )}
                    </div>
                    <span style={{ fontSize: "14px", color: "#6b8f5e", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                      {freeShipping ? <span style={{ fontSize: "14px", fontStyle: "italic", fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>Complimentary</span> : fmt(SHIPPING_EGP)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3" style={{ borderTop: "1px solid rgba(30,24,20,0.22)" }}>
                    <span style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>Total</span>
                    <span style={{ fontSize: "19px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.03em" }}>
                      {orderResult?.total ?? fmt(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: card payment panel */}
              <div className="flex flex-col">
                {/* Session Refreshed banner */}
                {sessionRefreshed && (
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    backgroundColor: "rgba(74,124,89,0.08)",
                    border: "1px solid rgba(74,124,89,0.28)",
                    borderRadius: "8px", padding: "12px 14px", marginBottom: "18px",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
                      <circle cx="8" cy="8" r="7.25" stroke="#4a7c59" strokeWidth="1.5"/>
                      <path d="M5 8.5l2 2 4-4" stroke="#4a7c59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#2f6644", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", marginBottom: "2px" }}>
                        Session Refreshed
                      </p>
                      <p style={{ fontSize: "11px", color: "rgba(47,102,68,0.82)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.5 }}>
                        Your payment session was refreshed. Please enter your details to continue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment session countdown timer */}
                <PaymentSessionTimer
                  key={paymentTimerKey}
                  active={paymentTimerActive}
                  onExpire={handleRefreshPaymobSession}
                  onTryAgain={handleRefreshPaymobSession}
                />

                {/* Card header */}
                <div className="mb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <rect x="0.5" y="0.5" width="33" height="23" rx="3.5" stroke="rgba(30,24,20,0.22)" fill="rgba(30,24,20,0.03)"/>
                      <rect x="9" y="7" width="16" height="10" rx="1.5" fill="rgba(30,24,20,0.15)" stroke="rgba(30,24,20,0.2)" strokeWidth="0.75"/>
                      <line x1="9" y1="12" x2="25" y2="12" stroke="rgba(30,24,20,0.16)" strokeWidth="0.75"/>
                      <line x1="17" y1="7" x2="17" y2="17" stroke="rgba(30,24,20,0.16)" strokeWidth="0.75"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.45)", fontFamily: "'Montserrat', sans-serif", marginBottom: "2px" }}>
                        Payment
                      </p>
                      <p style={{ fontSize: "14px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
                        Credit / Debit Card
                      </p>
                    </div>
                  </div>
                  <div style={{ height: "1px", backgroundColor: "rgba(30,24,20,0.13)" }} />
                </div>

                {/* Iframe container with rounded corners — clean blend into the page */}
                <div style={{ borderRadius: "16px", overflow: "hidden" }}>
                  <div className="max-h-[715px] md:max-h-[670px]" style={{ width: "100%", overflow: "hidden", position: "relative" }}>
                    <PaymobIframe
                      url={paymobIframeUrl}
                      intentId={orderResult?.intentId}
                      onSuccess={handleIframeSuccess}
                      onFail={handleIframeFail}
                    />
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 20,
                      background: "linear-gradient(to bottom, rgba(250,248,245,0), rgba(250,248,245,1))",
                      pointerEvents: "none",
                    }} />
                  </div>
                </div>

                {/* Security badge */}
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CreditCard size={12} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.38)", flexShrink: 0 }} />
                    <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.42)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
                      Secured by Paymob · 256-bit SSL
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (paymobIframeUrl) {
                        window.open(paymobIframeUrl, "_blank", "width=520,height=720");
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontSize: "11px",
                      color: "rgba(30,24,20,0.38)",
                      fontFamily: "'Montserrat', sans-serif",
                      letterSpacing: "0.06em",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    Payment stuck? Open in new window
                  </button>
                </div>
              </div>
            </motion.div>
          ) : step === "email" ? (
            <motion.div
              key="email-step"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col items-center justify-center min-h-[75vh] px-6"
            >
              <div style={{ width: "100%", maxWidth: "440px" }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(29px, 5vw, 40px)", fontWeight: 400, color: "#1e1814", marginBottom: "8px", letterSpacing: "0.02em", lineHeight: 1.15 }}>
                  What's your email?
                </h2>
                <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.56)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", marginBottom: "40px" }}>
                  We'll send your order confirmation here.
                </p>
                <div style={{ marginBottom: "28px" }}>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && emailInput.trim()) void handleEmailContinue(); }}
                    style={{ ...inputStyle, fontSize: "17px", padding: "14px 0", borderBottomColor: emailError ? "#c0392b" : undefined }}
                    placeholder="your@email.com"
                    autoFocus
                    className="checkout-input"
                  />
                  {emailError && (
                    <p style={{ marginTop: "8px", fontSize: "12px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{emailError}</p>
                  )}
                </div>
                <button
                  onClick={() => void handleEmailContinue()}
                  disabled={!emailInput.trim()}
                  style={{ 
                    width: "100%",
                    padding: "16px",
                    backgroundColor: emailInput.trim() ? "#1e1814" : "rgba(30,24,20,0.22)",
                    color: "#efe6da",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "12px",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    border: "none",
                    cursor: emailInput.trim() ? "pointer" : "not-allowed",
                    transition: "background-color 0.2s ease",
                  }}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          ) : step === "loading" ? (
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
              breakdown={{ ...(breakdownSnapshot ?? { subtotal: subtotalAmount, savings, shippingCost, freeShipping }), fmt }}
            />
          ) : step === "card-failed" ? (
            <CardFailed
              orderResult={orderResult!}
              onRetry={handleRetryCard}
              onChooseDifferent={handleChooseDifferent}
              onDone={handleDone}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              {/* Left: Order Summary */}
              <div>
                <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Order Summary
                </p>

                <div style={{ borderTop: "1px solid rgba(30,24,20,0.16)" }}>
                  {lines
                    ? lines.map((line) => (
                        <div key={line.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.1)" }}>
                            {resolveLineImage(line, localItems) && (
                              <img src={resolveLineImage(line, localItems)!} alt={line.merchandise.product.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{line.merchandise.product.title}</p>
                              {line.merchandise.title !== "Default Title" && (
                                <p style={{ fontSize: "14px", color: "#7a6e64", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>{line.merchandise.title}</p>
                              )}
                            </div>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "14px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Qty {line.quantity}</span>
                              <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{formatShopifyLinePrice(line)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    : localLines.map((item) => (
                        <div key={item.id} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(30,24,20,0.06)" }}>
                          <div className="w-16 h-20 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "rgba(30,24,20,0.1)" }}>
                            {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{item.title}</p>
                              {item.color && <p style={{ fontSize: "14px", color: "#7a6e64", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>{item.color}</p>}
                            </div>
                            <div className="flex justify-between items-end">
                              <span style={{ fontSize: "14px", color: "rgba(30,24,20,0.86)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>Qty {item.quantity}</span>
                              <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{fmt(item.priceAmount * item.quantity)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>

                <div className="mt-4 space-y-3">
                  <AnimatePresence>
                    {promoApplied && savings > 0 && (
                      <motion.div
                        key="savings-row"
                        initial={{ opacity: 0, scale: 0.96, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -6 }}
                        transition={{ type: "spring", stiffness: 340, damping: 28 }}
                        style={{
                          backgroundColor: "rgba(52,95,67,0.09)",
                          border: "1px solid rgba(52,95,67,0.28)",
                          borderRadius: "2px",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <div style={{
                            width: "26px", height: "26px", borderRadius: "50%",
                            backgroundColor: "rgba(52,95,67,0.14)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}>
                            <Tag size={12} strokeWidth={2} style={{ color: "#2f6644" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{
                              fontSize: "11px", color: "#2f6644",
                              fontFamily: "'Montserrat', sans-serif",
                              letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
                            }}>
                              Promo applied
                            </span>
                            <span style={{
                              fontSize: "11px", color: "rgba(47,102,68,0.75)",
                              fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em",
                            }}>
                              {promoApplied.code} — -{fmt(savings)}
                            </span>
                          </div>
                        </div>
                        {subtotalAmount > 0 && (
                          <span style={{
                            fontSize: "15px", color: "#2f6644",
                            fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                            letterSpacing: "0.02em", flexShrink: 0,
                          }}>
                            {Math.round((savings / subtotalAmount) * 100)}% off
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex justify-between">
                    <span style={{ fontSize: "14px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>Subtotal</span>
                    <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{fmt(discountedSubtotal)}</span>
                  </div>
                  {/* "X away from free delivery" nudge */}
                  {!freeShipping && discountedSubtotal > 0 && (
                    <p style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, color: "#6b8f5e" }}>
                      {new Intl.NumberFormat("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(2000 - discountedSubtotal)} EGP away from free delivery
                    </p>
                  )}
                  {freeShipping && (
                    <div style={{
                      backgroundColor: "rgba(248,252,245,0.9)",
                      border: "1px solid rgba(160,190,150,0.35)",
                      borderRadius: "2px",
                      padding: "10px 14px",
                      textAlign: "center",
                    }}>
                      <p style={{
                        fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase",
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: "#6b8f5e",
                      }}>
                        Free delivery unlocked
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "16px", color: "#6b8f5e", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em", fontWeight: 600 }}>Shipping</span>
                      {!freeShipping && (
                        <span style={{ fontSize: "19px", fontStyle: "italic", color: "rgba(107,143,94,0.85)", fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>— free over 2,000 EGP</span>
                      )}
                    </div>
                    <span style={{ fontSize: "14px", color: "#6b8f5e", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                      {freeShipping ? (
                        <span style={{ fontSize: "14px", fontStyle: "italic", fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>Complimentary</span>
                      ) : fmt(SHIPPING_EGP)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3" style={{ borderTop: "1px solid rgba(30,24,20,0.22)" }}>
                    <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.12em" }}>Total Amount</span>
                    <span style={{ fontSize: "17px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>{fmt(totalAmount)}</span>
                  </div>
                </div>

                {SHOPIFY_CONFIGURED && (
                  <div className="mt-6">
                    <p style={{ fontSize: "14px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,24,20,0.88)", fontFamily: "'Montserrat', sans-serif", marginBottom: "10px" }}>
                      Promo / Gift Card
                    </p>
                    <div className="mt-3">
                      {promoApplied ? (
                        <div className="flex items-center justify-between py-2 px-3" style={{ backgroundColor: "rgba(90,122,90,0.08)", border: "1px solid rgba(90,122,90,0.2)" }}>
                          <div className="flex items-center gap-2">
                            <Check size={12} strokeWidth={2} style={{ color: "#5a7a5a" }} />
                            <span style={{ fontSize: "14px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>{promoApplied.code}</span>
                          </div>
                          <button onClick={handleRemovePromo} style={{ fontSize: "14px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
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
                            style={{ fontSize: "14px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, padding: "0 12px", borderBottom: "1px solid rgba(30,24,20,0.18)" }}
                          >
                            {promoLoading ? "…" : "Apply"}
                          </button>
                        </div>
                      )}
                      {promoError && (
                        <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: 6, letterSpacing: "0.04em" }}>{promoError}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Payment + Form */}
              <div>
                {/* Payment method tiles */}
                <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "16px" }}>
                  Payment Method
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-8">
                  {(["cod", "instapay", "card"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className="text-left transition-all"
                      style={{
                        padding: "14px 12px",
                        border: paymentMethod === m ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.15)",
                        backgroundColor: paymentMethod === m ? "rgba(30,24,20,0.03)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: "17px", marginBottom: "5px" }}>
                        {m === "cod" ? "🚚" : m === "instapay" ? "📱" : "💳"}
                      </div>
                      <p style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, lineHeight: 1.3 }}>
                        {m === "cod" ? "Cash on Delivery" : m === "instapay" ? "InstaPay" : "Credit / Debit Card"}
                      </p>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", marginTop: "3px", lineHeight: 1.4 }}>
                        {m === "cod" ? "Pay on arrival" : m === "instapay" ? "Bank transfer" : "Visa · Mastercard"}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Delivery form */}
                <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
                  Delivery Details
                </p>

                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
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
                    <input type="tel" name="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} autoComplete="tel" placeholder="01X XXXX XXXX" className="checkout-input" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <label style={labelStyle}>Email Address</label>
                      <button
                        type="button"
                        onClick={() => setStep("email")}
                        style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Change
                      </button>
                    </div>
                    <input type="email" name="email" value={form.email} readOnly style={{ ...inputStyle, color: "rgba(30,24,20,0.65)" }} className="checkout-input" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label style={labelStyle}>Address</label>
                    <input type="text" name="street-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} autoComplete="street-address" className="checkout-input" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-end">
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

                  <button
                    type="submit"
                    className="w-full mt-8 py-4 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
                  >
                    Place Order
                  </button>
                </form>

                <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.58)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", marginTop: "14px", letterSpacing: "0.18em" }}>
                  By placing your order you agree to our terms of service.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CODConfirmation({ orderResult, onDone, items, breakdown }: { orderResult: OrderResult; onDone: () => void; items: NonNullable<OrderResult["items"]>; breakdown: OrderBreakdown }) {
  return (
    <OrderSuccessScreen
      orderResult={orderResult}
      onDone={onDone}
      items={items}
      title="Order Placed"
      subtitle="Cash on Delivery"
      detail={`Our team will contact you shortly to arrange delivery. Total due on arrival: ${orderResult.total} EGP`}
      note="A WhatsApp confirmation has been sent to your number."
      accentLabel="Pay on Delivery"
      breakdown={breakdown}
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6"
    >
      <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={24} strokeWidth={1.5} style={{ color: "#1e1814" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "33px", fontWeight: 700, color: "#1e1814", marginBottom: "6px" }}>
          Order Confirmed.
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
          {orderResult.shopifyOrderNumber
            ? <>Your payment has been received for order <strong style={{ color: "#1e1814" }}>#{orderResult.shopifyOrderNumber}</strong>. Your order is now being prepared.</>
            : "Your payment has been received and your order is now being prepared."}
        </p>
      </div>

      {orderResult.shopifyOrderNumber ? (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>
            Order Number
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "29px", color: "#1e1814", fontWeight: 700 }}>
            #{orderResult.shopifyOrderNumber}
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

      <div style={{ padding: "14px 18px", backgroundColor: "rgba(30,24,20,0.04)", border: "1px solid rgba(30,24,20,0.12)", width: "100%", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", lineHeight: 1.7 }}>
          You'll receive a WhatsApp message with your order details and tracking update shortly.
        </p>
      </div>

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

function CardFailed({
  orderResult,
  onRetry,
  onChooseDifferent,
  onDone,
}: {
  orderResult: OrderResult;
  onRetry: () => void;
  onChooseDifferent: () => void;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-8 py-16 text-center flex flex-col items-center gap-6"
    >
      <div style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "rgba(192,57,43,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={32} strokeWidth={1.5} style={{ color: "#c0392b" }} />
      </div>
      <div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "40px", fontWeight: 600, color: "#c0392b", marginBottom: "14px" }}>
          Payment Declined
        </h1>
        <p style={{ fontSize: "15px", color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, letterSpacing: "0.04em", lineHeight: 1.6 }}>
          No charge was made. Please try again or use a different method.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 380, margin: "0 auto" }}>
        <button
          onClick={onRetry}
          className="w-full py-4 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#c0392b", color: "#fff", fontSize: "14px", letterSpacing: "0.28em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
        >
          Try Again
        </button>
        <button
          onClick={onChooseDifferent}
          className="w-full py-3 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "transparent", border: "1.5px solid #1e1814", color: "#1e1814", fontSize: "14px", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
        >
          Different Method
        </button>
        <button
          onClick={onDone}
          className="w-full py-3 transition-opacity hover:opacity-60"
          style={{ fontSize: "14px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(30,24,20,0.62)", fontFamily: "'Montserrat', sans-serif", border: "1px solid rgba(30,24,20,0.14)" }}
        >
          Cancel
        </button>
      </div>
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
          <motion.div key="review" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col items-center gap-5 py-4">
            <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={24} strokeWidth={1.5} style={{ color: "#1e1814" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "29px", fontWeight: 700, color: "#1e1814", marginBottom: "8px" }}>
                Proof Submitted
              </h2>
              <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
                {confirmedOrderNumber != null
                  ? <>We've received your payment proof for order <strong style={{ color: "#1e1814" }}>#{confirmedOrderNumber}</strong>. Our team will verify and confirm your order via WhatsApp shortly.</>
                  : <>We've received your payment proof. Our team will verify and confirm your order via WhatsApp shortly.</>}
              </p>
            </div>
            <div style={{ padding: "14px 18px", backgroundColor: "rgba(30,24,20,0.04)", border: "1px solid rgba(30,24,20,0.12)", width: "100%", textAlign: "center" as const }}>
              <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", lineHeight: 1.7 }}>
                Verification is usually completed within a few hours during business hours.
              </p>
            </div>
            <button
              onClick={onDone}
              className="mt-2 transition-opacity hover:opacity-60"
              style={{ fontSize: "14px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", padding: "12px 32px", border: "1px solid rgba(30,24,20,0.18)" }}
            >
              Continue Shopping
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OrderBreakdownRows({ breakdown }: { breakdown: OrderBreakdown }) {
  const { subtotal, savings, shippingCost, freeShipping, fmt } = breakdown;
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
  const labelStyle: React.CSSProperties = { fontSize: "12px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" };
  const valueStyle: React.CSSProperties = { fontSize: "12px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 };
  return (
    <div style={{ border: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.02)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Subtotal</span>
        <span style={valueStyle}>{fmt(subtotal)} EGP</span>
      </div>
      {savings > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Discount</span>
          <span style={{ ...valueStyle, color: "#5a7a5a" }}>−{fmt(savings)} EGP</span>
        </div>
      )}
      <div style={rowStyle}>
        <span style={labelStyle}>Shipping</span>
        {freeShipping ? (
          <span style={{ ...valueStyle, color: "rgba(30,24,20,0.5)", fontStyle: "italic" }}>Complimentary</span>
        ) : (
          <span style={valueStyle}>{fmt(shippingCost)} EGP</span>
        )}
      </div>
    </div>
  );
}

function OrderSuccessScreen({
  orderResult,
  onDone,
  items,
  title,
  subtitle,
  detail,
  note,
  accentLabel,
  breakdown,
}: {
  orderResult: OrderResult;
  onDone: () => void;
  items: NonNullable<OrderResult["items"]>;
  title: string;
  subtitle: string;
  detail: string;
  note: string;
  accentLabel: string;
  breakdown?: OrderBreakdown;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-6 py-14 md:py-16 flex flex-col items-center text-center gap-7"
    >
      <div className="relative flex items-center justify-center" style={{ width: 82, height: 82 }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 82, height: 82, borderRadius: "50%", border: "1px solid rgba(30,24,20,0.12)", backgroundColor: "rgba(30,24,20,0.03)" }}
        />
        <motion.div
          initial={{ scale: 0.75, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "#1e1814", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Check size={24} strokeWidth={2} style={{ color: "#faf8f5" }} />
          </motion.div>
        </motion.div>
      </div>

      <div className="space-y-2">
        <p style={{ fontSize: "11px", letterSpacing: "0.34em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif" }}>
          {subtitle}
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "40px", fontWeight: 700, color: "#1e1814", lineHeight: 1 }}>
          {title}
        </h1>
      </div>

      <div className="w-full grid gap-3">
        {breakdown && <OrderBreakdownRows breakdown={breakdown} />}

        {/* Order number — appears as soon as the server confirms the Shopify order */}
        {orderResult.shopifyOrderNumber ? (
          <div className="flex items-center justify-between px-4 py-3" style={{ border: "1px solid rgba(30,24,20,0.12)" }}>
            <span style={{ fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(30,24,20,0.56)", fontFamily: "'Montserrat', sans-serif" }}>
              Order
            </span>
            <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
              #{orderResult.shopifyOrderNumber}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between px-4 py-3" style={{ border: "1px solid rgba(30,24,20,0.12)" }}>
          <span style={{ fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(30,24,20,0.56)", fontFamily: "'Montserrat', sans-serif" }}>
            {accentLabel}
          </span>
          <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
            {orderResult.total} EGP
          </span>
        </div>

        {items.length > 0 && (
          <>
            <p style={{ fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(30,24,20,0.52)", fontFamily: "'Montserrat', sans-serif", marginTop: 4 }}>
              Items
            </p>
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
                <div className="text-right">
                  <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.56)", fontFamily: "'Montserrat', sans-serif" }}>Qty {item.quantity}</p>
                  {item.price && (
                    <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
                      {item.price}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.8)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, maxWidth: 420 }}>
        {detail}
      </p>

      <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.68)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, maxWidth: 420 }}>
        {note}
      </p>

      <button
        onClick={onDone}
        className="w-full max-w-sm py-4 transition-opacity hover:opacity-85"
        style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "12px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <ShoppingBag size={14} strokeWidth={2} />
          Shop More
        </span>
      </button>
    </motion.div>
  );
}

interface PaymobIframeProps {
  url: string;
  intentId?: string | null;
  onSuccess: (txnId?: string, shopifyOrderId?: number | null, shopifyOrderNumber?: number | null) => void;
  onFail: () => void;
  iframeStyle?: React.CSSProperties;
}

function PaymobIframe({ url, intentId, onSuccess, onFail, iframeStyle }: PaymobIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);
  const loadCountRef = useRef(0);
  const resolvedRef = useRef(false);
  // Set to true when we show a *temporary* processing overlay to cover Paymob's
  // intermediate-state JSON (e.g. "Pending 3DS Authorization"). handleIframeLoad
  // clears the overlay on the very next page load so the 3DS page is visible.
  const tempOverlayRef = useRef(false);
  // Set to true once the 3DS redirect fires so the polling timeout does not
  // prematurely unmount the iframe or show the "Payment Failed" screen while
  // the user is completing their 3DS challenge.
  const threeDsActiveRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blurDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(Date.now());

  // Shows the overlay synchronously via DOM ref — no React re-render latency.
  const showOverlay = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.style.display = "flex";
    }
  }, []);

  // Shows a clean "Payment Successful" overlay with a 5-second countdown then calls onSuccess.
  const showOverlaySuccess = useCallback((txnId?: string, shopifyOrderId?: number | null, shopifyOrderNumber?: number | null) => {
    if (overlayInnerRef.current) {
      overlayInnerRef.current.innerHTML =
        '<div style="width:72px;height:72px;border-radius:50%;background:rgba(47,102,68,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:18px;flex-shrink:0">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2f6644" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<p style="font-size:16px;letter-spacing:0.3em;text-transform:uppercase;color:#2f6644;font-family:\'Montserrat\',sans-serif;font-weight:700;margin-bottom:14px">Payment Successful</p>' +
        '<p style="font-size:14px;color:rgba(30,24,20,0.6);font-family:\'Montserrat\',sans-serif;letter-spacing:0.03em;text-align:center;max-width:320px;line-height:1.75;margin-bottom:24px">Your payment has been received successfully.<br>We\'ve sent your order for processing and will<br>keep you updated on the next steps.</p>' +
        '<button id="pay-overlay-cta" style="background:#1e1814;color:#faf8f5;border:none;padding:14px 32px;font-family:\'Montserrat\',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;cursor:pointer;margin-bottom:14px;width:100%;max-width:320px">Proceed to Order Information</button>' +
        '<p id="pay-overlay-cd" style="font-size:12px;color:rgba(30,24,20,0.45);font-family:\'Montserrat\',sans-serif;letter-spacing:0.08em">Proceeding in 5s\u2026</p>';

      const inner = overlayInnerRef.current;
      const state: { tickId: ReturnType<typeof setInterval> | null } = { tickId: null };
      const proceed = () => {
        if (state.tickId) clearInterval(state.tickId);
        onSuccess(txnId, shopifyOrderId, shopifyOrderNumber);
      };
      const btnEl = inner.querySelector<HTMLElement>('#pay-overlay-cta');
      if (btnEl) btnEl.addEventListener('click', proceed);
      let secs = 5;
      state.tickId = setInterval(() => {
        secs -= 1;
        const cdEl = inner.querySelector<HTMLElement>('#pay-overlay-cd');
        if (cdEl) cdEl.textContent = secs > 0 ? `Proceeding in ${secs}s\u2026` : 'Opening your order\u2026';
        if (secs <= 0) proceed();
      }, 1000);
    }
    showOverlay();
  }, [showOverlay, onSuccess]);

  // Shows a "Payment Pending" overlay — payment received but awaiting final server confirmation.
  // Does NOT auto-call onSuccess; the caller must decide when/whether to proceed.
  const showOverlayPending = useCallback(() => {
    if (overlayInnerRef.current) {
      overlayInnerRef.current.innerHTML =
        '<div style="width:72px;height:72px;border-radius:50%;background:rgba(160,120,40,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:18px;flex-shrink:0">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#a07828" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' +
          '</svg>' +
        '</div>' +
        '<p style="font-size:16px;letter-spacing:0.3em;text-transform:uppercase;color:#a07828;font-family:\'Montserrat\',sans-serif;font-weight:700;margin-bottom:14px">Payment Pending</p>' +
        '<p style="font-size:14px;color:rgba(30,24,20,0.6);font-family:\'Montserrat\',sans-serif;letter-spacing:0.03em;text-align:center;max-width:320px;line-height:1.75">Your payment is currently being verified.<br>This may take a few moments. We\'ll update<br>your order status as soon as confirmation is received.</p>';
    }
    showOverlay();
  }, [showOverlay]);

  // Shows a "Payment Failed – Please try again" overlay with a 3-second countdown,
  // then auto-triggers onFail which refreshes the payment session.
  const showOverlayFail = useCallback(() => {
    if (overlayInnerRef.current) {
      overlayInnerRef.current.innerHTML =
        '<div style="width:72px;height:72px;border-radius:50%;background:rgba(192,57,43,0.10);display:flex;align-items:center;justify-content:center;margin-bottom:18px;flex-shrink:0">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' +
          '</svg>' +
        '</div>' +
        '<p style="font-size:16px;letter-spacing:0.3em;text-transform:uppercase;color:#c0392b;font-family:\'Montserrat\',sans-serif;font-weight:700;margin-bottom:12px">Payment Failed</p>' +
        '<p style="font-size:14px;color:rgba(30,24,20,0.6);font-family:\'Montserrat\',sans-serif;letter-spacing:0.03em;text-align:center;max-width:320px;line-height:1.75;margin-bottom:24px">No charge was made. Please check your card details<br>and try again.</p>' +
        '<button id="fail-overlay-cta" style="background:#c0392b;color:#fff;border:none;padding:14px 32px;font-family:\'Montserrat\',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;cursor:pointer;margin-bottom:14px;width:100%;max-width:320px">Retry Now</button>' +
        '<p id="fail-overlay-cd" style="font-size:12px;color:rgba(30,24,20,0.45);font-family:\'Montserrat\',sans-serif;letter-spacing:0.08em">Retrying in 3s\u2026</p>';

      const inner = overlayInnerRef.current;
      const state: { tickId: ReturnType<typeof setInterval> | null } = { tickId: null };
      const proceed = () => {
        if (state.tickId) clearInterval(state.tickId);
        onFail();
      };
      const btnEl = inner.querySelector<HTMLElement>('#fail-overlay-cta');
      if (btnEl) btnEl.addEventListener('click', proceed);
      let secs = 3;
      state.tickId = setInterval(() => {
        secs -= 1;
        const cdEl = inner.querySelector<HTMLElement>('#fail-overlay-cd');
        if (cdEl) cdEl.textContent = secs > 0 ? `Retrying in ${secs}s\u2026` : 'Refreshing your session\u2026';
        if (secs <= 0) proceed();
      }, 1000);
    }
    showOverlay();
  }, [showOverlay, onFail]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    loadCountRef.current += 1;
    // If a temporary overlay was shown to cover an intermediate-state JSON
    // (e.g. "Pending 3DS Authorization"), remove it unconditionally on the
    // next page load so the 3DS authentication page is always visible —
    // even if a stale polling timeout had briefly set resolvedRef.current.
    if (tempOverlayRef.current) {
      tempOverlayRef.current = false;
      if (overlayRef.current) {
        overlayRef.current.style.display = "none";
      }
    }
  }, []);

  // window.blur fires when the user clicks INTO the iframe (focus leaves parent window).
  // window.focus fires when focus returns to the parent.
  // Strategy: each time focus enters the iframe, reset a 60-second debounce timer.
  // 60s is a safe floor — most users fill a card form in 15-45 s, so the timer only
  // fires after they have submitted and are waiting on a result. This catches Paymob's
  // inline document.write() result which fires no onLoad or webhook for validation
  // failures (e.g. Luhn-invalid card numbers Paymob rejects client-side).
  useEffect(() => {
    const handleBlur = () => {
      if (resolvedRef.current) return;
      if (threeDsActiveRef.current) return; // 3DS in progress — don't debounce
      if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
      blurDebounceRef.current = setTimeout(() => {
        if (!resolvedRef.current && !threeDsActiveRef.current) showOverlayFail();
      }, 60_000);
    };

    const handleFocus = () => {
      // User clicked back into the parent page — cancel the debounce.
      if (blurDebounceRef.current) {
        clearTimeout(blurDebounceRef.current);
        blurDebounceRef.current = null;
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
    };
  }, [showOverlayFail]);

  // Poll /api/orders/paymob-status/:intentId every 500 ms.
  // Paymob's legacy v1 iframe renders its result JSON inline (document.write) without
  // navigating, so onLoad never fires a 2nd time. The webhook marks the intent as
  // "declined" / "completed" / "failed" — polling picks that up within ~500 ms.
  // For bank-declined cards the webhook fires server-to-server BEFORE the browser
  // renders the iframe result, so the overlay can appear before any JSON is visible.
  // Hard ceiling: after 15 minutes of "pending" status (e.g. "Invalid credentials"
  // where Paymob never fires a webhook), stop polling and trigger the failure screen.
  useEffect(() => {
    if (!intentId) return;
    pollStartRef.current = Date.now();

    const poll = async () => {
      if (resolvedRef.current) return;
      // Hard ceiling: 15 minutes of inactivity with no 3DS in flight.
      // We skip the timeout while 3DS is active so users who take longer
      // to complete their OTP challenge are not prematurely cut off.
      if (!threeDsActiveRef.current && Date.now() - pollStartRef.current > 15 * 60 * 1000) {
        resolvedRef.current = true;
        stopPolling();
        if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
        showOverlayFail();
        return;
      }
      try {
        const res = await fetch(`/api/orders/paymob-status/${intentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          paymobTxnId: string | null;
          shopifyOrderId?: number | null;
          shopifyOrderNumber?: number | null;
        };
        if (data.status === "completed") {
          threeDsActiveRef.current = false;
          resolvedRef.current = true;
          stopPolling();
          if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
          showOverlaySuccess(data.paymobTxnId ?? undefined, data.shopifyOrderId ?? null, data.shopifyOrderNumber ?? null);
        } else if (data.status === "processing") {
          // Paymob payment claimed — draft creation in progress. Show the pending
          // overlay but keep polling until "completed" so the success screen only
          // fires once the Shopify draft order is confirmed.
          showOverlayPending();
        } else if (data.status === "declined" || data.status === "failed") {
          threeDsActiveRef.current = false;
          resolvedRef.current = true;
          stopPolling();
          if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
          showOverlayFail();
        }
        // "pending" or "processing" — keep polling until resolved
      } catch {
        // Network error — keep polling
      }
    };

    pollIntervalRef.current = setInterval(() => { void poll(); }, 200);
    return () => stopPolling();
  }, [intentId, showOverlaySuccess, showOverlayPending, showOverlayFail, stopPolling]);

  useEffect(() => {
    const ownOrigin = window.location.origin;
    const paymobOrigin = "https://accept.paymob.com";

    function handleMessage(event: MessageEvent) {
      const isOwn = event.origin === ownOrigin;
      const isPaymob = event.origin === paymobOrigin;
      if (!isOwn && !isPaymob) return;

      // Paymob legacy v1 iframe sends postMessage as a JSON *string*; Unified Checkout
      // and our own relay page send an object. Handle both forms.
      let data: Record<string, unknown> | null = null;
      if (event.data && typeof event.data === "object" && !Array.isArray(event.data)) {
        data = event.data as Record<string, unknown>;
      } else if (typeof event.data === "string") {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            data = parsed as Record<string, unknown>;
          }
        } catch {
          return;
        }
      }
      if (!data) return;

      // Our relay page format — relay page already shows clean success/fail UI inside
      // the iframe; we immediately cover the iframe with our own overlay so no raw data
      // from any previous Paymob-rendered page can remain visible.
      // Helper: fire paymob-sync so the server creates the Shopify draft order
      // immediately, even if the webhook hasn't arrived yet.  Fire-and-forget.
      // paymobTxnId is passed so the server can verify the transaction directly
      // by ID rather than having to search by merchant_order_id.
      const syncPaymobOrder = (paymobTxnId?: string) => {
        if (!intentId) return;
        void fetch("/api/orders/paymob-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intentId, ...(paymobTxnId ? { paymobTxnId } : {}) }),
        }).catch(() => {});
      };

      if (isOwn && data["type"] === "PAYMOB_RESULT") {
        const txnId = String(data["transactionId"] ?? "");
        if (data["success"]) {
          threeDsActiveRef.current = false;
          resolvedRef.current = true;
          stopPolling();
          if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
          syncPaymobOrder(txnId || undefined);
          showOverlaySuccess(txnId || undefined, undefined, undefined);
        } else if (data["pending"]) {
          // Payment still pending (waiting on bank confirmation). Show the overlay
          // but keep polling — do NOT mark as resolved yet.
          showOverlayPending();
        } else {
          threeDsActiveRef.current = false;
          resolvedRef.current = true;
          stopPolling();
          if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
          showOverlayFail();
        }
        return;
      }

      // Paymob inline postMessage — legacy v1 sends success as a string ("true"/"false"),
      // Unified Checkout sends a boolean. Accept both.
      if (isPaymob && ("success" in data)) {
        const rawSuccess = data["success"];
        const isSuccess = rawSuccess === true || rawSuccess === "true";
        const isFail = rawSuccess === false || rawSuccess === "false";
        const txnId = String(data["id"] ?? data["txn_id"] ?? data["transactionId"] ?? "");
        const hasTxnId = txnId !== "" && txnId !== "0" && txnId !== "undefined";
        if (isSuccess && hasTxnId) {
          threeDsActiveRef.current = false;
          resolvedRef.current = true;
          stopPolling();
          if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
          syncPaymobOrder(txnId);
          showOverlaySuccess(txnId, undefined, undefined);
        } else if (isSuccess && !hasTxnId) {
          threeDsActiveRef.current = false;
          resolvedRef.current = true;
          stopPolling();
          if (blurDebounceRef.current) clearTimeout(blurDebounceRef.current);
          syncPaymobOrder(undefined);
          showOverlaySuccess(undefined, undefined, undefined);
        } else if (isFail) {
          const isPending = data["pending"] === true || data["pending"] === "true";
          if (hasTxnId && !isPending) {
            // Completed failure (e.g. card declined, invalid credentials) — cover permanently.
            threeDsActiveRef.current = false;
            resolvedRef.current = true;
            stopPolling();
            showOverlayFail();
          } else if (isPending) {
            // Intermediate state (e.g. "Pending 3DS Authorization").
            // When Paymob sends use_redirection:true / bypass_step_six:true, it renders
            // the JSON and WAITS for the parent to redirect the iframe — it won't navigate
            // on its own. We must: (1) mark 3DS active so the polling timeout is suspended,
            // (2) cover the JSON immediately, (3) do the redirect.
            // handleIframeLoad will clear the temp overlay when the 3DS page loads so
            // the user can complete authentication.
            // Guard against duplicate isPending messages (Paymob can send more than once).
            // Use threeDsActiveRef rather than resolvedRef so that even if the polling
            // timeout prematurely set resolvedRef=true, we still handle 3DS correctly.
            if (!threeDsActiveRef.current) {
              // Mark 3DS as active — suppresses polling timeout and blur debounce.
              threeDsActiveRef.current = true;
              // Undo any timeout-induced resolution so handleIframeLoad can clear overlay.
              resolvedRef.current = false;
              // Cancel any pending blur-debounce timer — 3DS is underway, not a failure.
              if (blurDebounceRef.current) { clearTimeout(blurDebounceRef.current); blurDebounceRef.current = null; }
              tempOverlayRef.current = true;
              showOverlay();
              const redirectionUrl = data["redirection_url"];
              if (typeof redirectionUrl === "string" && redirectionUrl && iframeRef.current) {
                iframeRef.current.src = redirectionUrl;
              }
            }
          }
          // isPending=unknown with no txnId = form loading event — ignore
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [intentId, showOverlay, showOverlaySuccess, showOverlayPending, showOverlayFail, stopPolling]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <iframe
        ref={iframeRef}
        src={url}
        title="Secure Card Payment"
        allow="payment"
        scrolling="no"
        onLoad={handleIframeLoad}
        style={{
          width: "100%",
          height: 760,
          border: "none",
          display: "block",
          ...iframeStyle,
        }}
      />
      {/* Overlay is always in the DOM but hidden — shown via ref for zero re-render latency.
          Inner content starts as a spinner ("Processing") and is replaced dynamically with
          success or failure messaging so no raw Paymob data is ever visible to the user. */}
      <div
        ref={overlayRef}
        style={{
          display: "none",
          position: "absolute",
          inset: 0,
          background: "#faf8f5",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
        }}
      >
        <div
          ref={overlayInnerRef}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: "0 24px",
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            border: "2px solid rgba(30,24,20,0.15)",
            borderTopColor: "#1e1814",
            borderRadius: "50%",
            animation: "moi-spin 0.8s linear infinite",
          }} />
          <p style={{
            fontSize: "11px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(30,24,20,0.5)",
            fontFamily: "'Montserrat', sans-serif",
          }}>
            Processing
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Session Countdown Timer ──────────────────────────────────────────

interface PaymentSessionTimerProps {
  active: boolean;
  onExpire: () => void;
  onTryAgain: () => void;
}

function PaymentSessionTimer({ active, onExpire, onTryAgain }: PaymentSessionTimerProps) {
  const TOTAL = 180;
  const [remaining, setRemaining] = useState(TOTAL);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(TOTAL);
    if (!active) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const R = 20;
  const circumference = 2 * Math.PI * R;
  const dashOffset = circumference * (1 - remaining / TOTAL);
  const arcColor = remaining > 90 ? "#4a7c59" : remaining > 45 ? "#c48c30" : "#c0392b";
  const isUrgent = remaining <= 45;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "14px",
      padding: "13px 15px",
      backgroundColor: isUrgent ? "rgba(192,57,43,0.04)" : "rgba(30,24,20,0.025)",
      border: `1px solid ${isUrgent ? "rgba(192,57,43,0.18)" : "rgba(30,24,20,0.09)"}`,
      borderRadius: "10px",
      marginBottom: "20px",
      transition: "background-color 1s ease, border-color 1s ease",
    }}>
      {/* Circular countdown */}
      <svg width="50" height="50" viewBox="0 0 50 50" style={{ flexShrink: 0 }}>
        <circle cx="25" cy="25" r={R} fill="none" stroke="rgba(30,24,20,0.09)" strokeWidth="3" />
        <circle
          cx="25" cy="25" r={R}
          fill="none"
          stroke={arcColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 25 25)"
          style={{ transition: "stroke-dashoffset 0.95s linear, stroke 1.2s ease" }}
        />
        <text
          x="25" y="26"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            fill: arcColor,
            transition: "fill 1.2s ease",
          }}
        >
          {`${minutes}:${String(seconds).padStart(2, "0")}`}
        </text>
      </svg>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#1e1814",
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: "0.05em",
          marginBottom: "3px",
          lineHeight: 1.3,
        }}>
          Complete Your Payment
        </p>
        <p style={{
          fontSize: "11px",
          color: "rgba(30,24,20,0.54)",
          fontFamily: "'Montserrat', sans-serif",
          lineHeight: 1.5,
          marginBottom: "6px",
        }}>
          Please enter your payment details within 3 minutes. This session will
          automatically refresh if no activity is detected.
        </p>
        <button
          onClick={onTryAgain}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: "11px",
            color: "rgba(30,24,20,0.42)",
            fontFamily: "'Montserrat', sans-serif",
            letterSpacing: "0.04em",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            lineHeight: 1,
          }}
        >
          Having trouble? Try again
        </button>
      </div>
    </div>
  );
}
