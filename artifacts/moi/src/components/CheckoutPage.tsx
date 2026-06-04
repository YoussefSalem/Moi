import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Upload, X, Tag, ShoppingBag, Smartphone } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
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
        PRODUCT_COLOR_MAP[`\${n}::\${color.toLowerCase()}`] = url;
      }
    }
  }
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/\./g, "").trim();
}

const BASE_IMG = `\${typeof window !== "undefined" ? window.location.origin : "https://buy-moi.com"}/api/images`;
const PUBLIC_COLOR_IMAGES: Record<string, string> = {
  beige: `\${BASE_IMG}/beige.jpg`,
  white: `\${BASE_IMG}/white.jpg`,
  cashmere: `\${BASE_IMG}/cashmere.jpg`,
  cashemere: `\${BASE_IMG}/cashmere.jpg`,
  yellow: `\${BASE_IMG}/yellow.jpg`,
  teal: `\${BASE_IMG}/teal.jpg`,
  "light blue": `\${BASE_IMG}/light-blue-main.jpg`,
  navy: `\${BASE_IMG}/navi.jpg`,
  mint: `\${BASE_IMG}/mint.jpg`,
  ivory: `\${BASE_IMG}/ivory.jpg`,
  sand: `\${BASE_IMG}/sand.jpg`,
  taupe: `\${BASE_IMG}/taupe.jpg`,
  espresso: `\${BASE_IMG}/espresso.jpg`,
  brown: `\${BASE_IMG}/brown.jpg`,
  black: `\${BASE_IMG}/black.jpg`,
};

function resolveLineImage(line: ShopifyCartLine, localItems?: { variantId: string; color?: string; image?: string | null }[]): string | null {
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
  for (const color of colorCandidates) {
    const hit = PRODUCT_COLOR_MAP[`\${normTitle}::\${color}`] ?? PRODUCT_COLOR_MAP[`\${rawTitle.toLowerCase()}::\${color}`];
    if (hit) return hit;
  }
  const productHit = PRODUCT_SHOT_MAP[normTitle] ?? PRODUCT_SHOT_MAP[rawTitle.toLowerCase()];
  if (productHit) return productHit;
  if (line.merchandise.image?.url) return line.merchandise.image.url;
  if (line.merchandise.product.featuredImage?.url) return line.merchandise.product.featuredImage.url;
  if (localMatch?.image) return localMatch.image;
  return null;
}

function resolveEmailImage(line: ShopifyCartLine, localItems?: { variantId: string; color?: string; image?: string | null }[]): string | null {
  const variantId = line.merchandise.id;
  const localMatch = localItems?.find((li) => li.variantId === variantId);
  const rawTitle = line.merchandise.product.title ?? "";
  const SIZE_OPTION_NAMES = new Set(["size", "titre", "taille", "tamanho", "gr\u00f6\u00dfe"]);
  const colorCandidates: string[] = [];
  if (localMatch?.color) colorCandidates.push(localMatch.color.toLowerCase());
  for (const opt of (line.merchandise.selectedOptions ?? [])) {
    if (!SIZE_OPTION_NAMES.has(opt.name.toLowerCase())) {
      colorCandidates.push(opt.value.toLowerCase());
    }
  }
  for (const color of colorCandidates) {
    const publicHit = PUBLIC_COLOR_IMAGES[color];
    if (publicHit) return publicHit;
  }
  const shopifyUrl = line.merchandise.image?.url ?? line.merchandise.product.featuredImage?.url ?? "";
  if (shopifyUrl && shopifyUrl.includes("cdn.shopify.com")) return shopifyUrl;
  if (localMatch?.image && localMatch.image.startsWith("http")) return localMatch.image;
  return null;
}

type PaymentMethod = "cod" | "instapay" | "card";
const AVAILABLE_PAYMENT_METHODS: PaymentMethod[] = ["cod", "instapay", "card"];
type Step = "form" | "loading" | "cod-confirm" | "instapay-confirm" | "card-pending" | "card-confirm";
type InstapaySubStep = "instructions" | "upload" | "review";

interface OrderResult {
  orderNumber: string | number;
  total: string;
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

function buildOrderAttribution() {
  const attr = getAttribution();
  const utm = attr.utm || {};
  let sourceName: string | undefined;
  if (utm.source === "facebook" || utm.source === "fb" || attr.fbclid) sourceName = "facebook";
  else if (utm.source === "instagram" || utm.source === "ig") sourceName = "instagram";
  else if (utm.source === "google" || attr.gclid) sourceName = "google";
  else if (utm.source === "tiktok" || attr.ttclid) sourceName = "tiktok";
  else if (utm.source) sourceName = utm.source;
  const REF_MAP: Record<string, string> = {
    facebook: "https://www.facebook.com/",
    instagram: "https://www.instagram.com/",
    google: "https://www.google.com/",
    tiktok: "https://www.tiktok.com/",
  };
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

  const { customer } = useCustomer();

  const [step, setStep] = useState<Step>("form");
  const [emailError, setEmailError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [breakdownSnapshot, setBreakdownSnapshot] = useState<{ subtotal: number; savings: number; shippingCost: number; freeShipping: boolean } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [governorateOpen, setGovernorateOpen] = useState(false);
  const isApplyingRef = useRef(false);
  const instapayTrackedRef = useRef(false);
  const codTrackedRef = useRef(false);
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    address: "", governorate: "", postalCode: "", city: "",
  });

  const prevStepRef = useRef<Step | null>(null);
  const stepEnterTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!checkoutOpen) return;
    function onPopState() {
      if (window.location.pathname !== "/checkout") {
        setStep("form");
        setOrderResult(null);
        setPaymentMethod("cod");
        setSubmitError("");
        closeCheckout();
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [checkoutOpen, closeCheckout]);

  useEffect(() => {
    if (!checkoutOpen) return;
    setForm((f) => {
      const next = { ...f };
      if (!next.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const email = customer?.email ?? prefilledEmail ?? "";
        if (emailRegex.test(email.trim())) next.email = email.trim();
      }
      if (!next.firstName && customer?.firstName) next.firstName = customer.firstName;
      if (!next.lastName && customer?.lastName) next.lastName = customer.lastName;
      if (!next.phone && customer?.phone) next.phone = customer.phone;
      return next;
    });
  }, [checkoutOpen, prefilledEmail, customer]);

  useEffect(() => {
    if (prevStepRef.current) {
      const seconds = Math.round((Date.now() - stepEnterTimeRef.current) / 1000);
      trackCheckoutStepTime(prevStepRef.current, seconds);
    }
    prevStepRef.current = step;
    stepEnterTimeRef.current = Date.now();
    const stepMap: Record<string, string> = {
      form: "shipping",
      "cod-confirm": "payment",
      "instapay-confirm": "payment",
    };
    const analyticsStep = stepMap[step];
    if (analyticsStep) {
      trackCheckoutStep(analyticsStep as "shipping" | "payment" | "complete", { step });
    }
  }, [step]);

  const localSubtotal = localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);
  const shopifyHasLines = Boolean(shopifyCart && shopifyCart.lines.nodes.length > 0);
  const lineItemsSubtotal = shopifyHasLines
    ? shopifyCart!.lines.nodes.reduce((sum, line) => sum + parseFloat(line.merchandise.price.amount) * line.quantity, 0)
    : localSubtotal;
  const subtotalAmount = lineItemsSubtotal;
  const cartDiscountedTotal = shopifyHasLines ? parseFloat(shopifyCart!.cost.totalAmount.amount) : localSubtotal;
  const cartSavings = Math.max(0, subtotalAmount - cartDiscountedTotal);
  const savings = cartSavings;
  const discountedSubtotal = subtotalAmount - savings;
  const freeShipping = discountedSubtotal >= 2000;
  const shippingCost = freeShipping ? 0 : SHIPPING_EGP;
  const totalAmount = discountedSubtotal + shippingCost;
  const currencyCode = shopifyCart?.cost.totalAmount.currencyCode ?? localItems[0]?.currencyCode ?? "EGP";

  function fmt(amount: number) {
    try {
      return new Intl.NumberFormat("en-EG", {
        style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `\${amount.toFixed(0)} EGP`;
    }
  }

  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      isApplyingRef.current = true;
      const code = promoInput.trim().toUpperCase();
      const result = await applyDiscount(code);
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
    fetch(`/api/abandoned-carts/\${id}/recovered`, { method: "POST" }).catch(() => {});
  }, []);

  const handleSuccessDone = useCallback(() => {
    markAbandonedCartRecovered();
    clearCart();
    setStep("form");
    setOrderResult(null);
    setPromoApplied(null);
    setPromoInput("");
    setGovernorateOpen(false);
    setForm({ firstName: "", lastName: "", phone: "", email: "", address: "", governorate: "", postalCode: "", city: "" });
    sessionStorage.removeItem("moi_instapay_order_result");
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

    if (paymentMethod === "card") {
      try {
        const res = await fetch("/api/paymob/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLines,
            customer: customerPayload,
            cartId: shopifyCart?.id ?? null,
            discountCode: promoApplied?.code ?? null,
            attribution: buildOrderAttribution(),
          }),
        });
        const data = await res.json() as {
          clientSecret?: string;
          publicKey?: string;
          checkoutToken?: string;
          error?: string;
        };
        if (!res.ok || !data.clientSecret || !data.publicKey || !data.checkoutToken) {
          setStep("form");
          setSubmitError(data.error ?? "Could not initiate payment. Please try again.");
          submittingRef.current = false;
          return;
        }
        sessionStorage.setItem("moi_paymob_token", data.checkoutToken);
        sessionStorage.setItem("moi_paymob_snapshot", JSON.stringify({
          subtotal: subtotalAmount,
          savings,
          shippingCost,
          freeShipping,
          total: fmt(totalAmount),
          customerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          customerPhone: form.phone.trim(),
        }));
        window.location.href = `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(data.publicKey)}&clientSecret=${encodeURIComponent(data.clientSecret)}`;
      } catch {
        setStep("form");
        setSubmitError("Network error. Please check your connection and try again.");
      }
      submittingRef.current = false;
      return;
    }

    if (paymentMethod === "instapay") {
      try {
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
          customerName: `\${form.firstName.trim()} \${form.lastName.trim()}`.trim(),
          customerPhone: form.phone.trim(),
          items: cartItemsSnapshot.length > 0 ? cartItemsSnapshot : undefined,
        };
        setBreakdownSnapshot({ subtotal: subtotalAmount, savings, shippingCost, freeShipping });
        setOrderResult(orderResultPayload);
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
        customerName: `\${form.firstName.trim()} \${form.lastName.trim()}`.trim(),
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
  }, [form, paymentMethod, isShopify, shopifyCart, localItems, promoApplied, totalAmount, fmt, clearCart, markAbandonedCartRecovered]);

  const handleDone = useCallback(() => {
    clearCart();
    setStep("form");
    setOrderResult(null);
    setPromoApplied(null);
    setPromoInput("");
    setGovernorateOpen(false);
    setForm({ firstName: "", lastName: "", phone: "", email: "", address: "", governorate: "", postalCode: "", city: "" });
    sessionStorage.removeItem("moi_instapay_order_result");
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
      cartBuyerIdentityUpdate(cartId, email).catch(() => {});
      const lineItems = isShopify && shopifyCart
        ? shopifyCart.lines.nodes.map((l) => {
            const colorOpt = l.merchandise.selectedOptions?.find((o) => o.name.toLowerCase() === "color");
            const colorName = colorOpt?.value;
            return {
              title: l.merchandise.product.title,
              variant: colorName ? `Color: \${colorName}` : (l.merchandise.title === "Default Title" ? undefined : l.merchandise.title),
              quantity: l.quantity,
              price: `\${Math.floor(parseFloat(l.merchandise.price.amount)).toLocaleString("de-DE")} EGP`,
              imageUrl: resolveEmailImage(l, localItems) ?? undefined,
              variantId: l.merchandise.id,
            };
          })
        : localItems.map((i) => {
            const color = i.color?.toLowerCase() ?? "";
            const publicImg = PUBLIC_COLOR_IMAGES[color];
            return {
              title: i.title,
              variant: i.color ? `Color: \${i.color}` : undefined,
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

  useEffect(() => {
    if (!shopifyCart || !promoApplied) return;
    if (isApplyingRef.current) return;
    const code = shopifyCart.discountCodes.find((d) => d.applicable)?.code;
    if (!code) { setPromoApplied(null); return; }
    if (code.toUpperCase() === promoApplied.code.toUpperCase()) return;
    isApplyingRef.current = true;
    void applyDiscount(promoApplied.code)
      .then((r) => { if (!r.applicable) setPromoApplied(null); })
      .catch(() => setPromoApplied(null))
      .finally(() => { isApplyingRef.current = false; });
  }, [shopifyCart?.lines.nodes.map((l) => `\${l.id}:\${l.quantity}`).join(",")]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/payment/return") return;
    const token = sessionStorage.getItem("moi_paymob_token");
    if (!token) return;
    openCheckout();
    setStep("card-pending");
    window.history.replaceState({}, "", "/");
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const poll = async () => {
      try {
        const res = await fetch(`/api/paymob/status?token=${encodeURIComponent(token)}`);
        const data = await res.json() as {
          status?: string;
          shopifyOrderNumber?: number | null;
          shopifyOrderId?: number | null;
          total?: string;
        };
        if (data.status === "paid") {
          const snapshotRaw = sessionStorage.getItem("moi_paymob_snapshot");
          type Snap = { subtotal: number; savings: number; shippingCost: number; freeShipping: boolean; total: string; customerName: string; customerPhone: string };
          const snap = snapshotRaw ? JSON.parse(snapshotRaw) as Snap : null;
          sessionStorage.removeItem("moi_paymob_token");
          sessionStorage.removeItem("moi_paymob_snapshot");
          setOrderResult({
            orderNumber: data.shopifyOrderNumber ?? "",
            total: data.total ?? snap?.total ?? "",
            shopifyOrderId: data.shopifyOrderId ?? undefined,
            shopifyOrderNumber: data.shopifyOrderNumber ?? undefined,
            customerName: snap?.customerName ?? "",
            customerPhone: snap?.customerPhone ?? "",
          });
          if (snap) setBreakdownSnapshot({ subtotal: snap.subtotal, savings: snap.savings, shippingCost: snap.shippingCost, freeShipping: snap.freeShipping });
          clearCart();
          setStep("card-confirm");
          return;
        }
        if (data.status === "failed") {
          sessionStorage.removeItem("moi_paymob_token");
          sessionStorage.removeItem("moi_paymob_snapshot");
          setStep("form");
          setSubmitError("Payment was not completed. Please try again.");
          return;
        }
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          setStep("form");
          setSubmitError("Payment verification timed out. If your card was charged, please contact us.");
          return;
        }
        setTimeout(() => { void poll(); }, 2000);
      } catch {
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          setStep("form");
          setSubmitError("Could not verify payment. If charged, please contact us.");
          return;
        }
        setTimeout(() => { void poll(); }, 2000);
      }
    };
    void poll();
  }, []);

  const isSuccessStep = step === "cod-confirm" || step === "card-confirm";
  const isConfirmStep = isSuccessStep || step === "instapay-confirm";
  const loadingText = step === "card-pending" ? "Verifying your payment…" : "Placing your order…";

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
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-10 py-5" style={{ backgroundColor: "#efe6da", borderBottom: "1px solid rgba(30,24,20,0.14)" }}>
            <button
              onClick={isSuccessStep ? handleSuccessDone : isConfirmStep ? handleDone : closeCheckout}
              className="flex items-center gap-2 transition-opacity hover:opacity-50"
            >
              <ArrowLeft size={16} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              <span style={{ fontSize: "14px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif" }}>
                {isConfirmStep ? "Continue shopping" : "Back"}
              </span>
            </button>
            <span style={{ fontSize: "14px", letterSpacing: "0.4em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>MOI</span>
            <div style={{ width: 80 }} />
          </div>

          <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 md:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 lg:gap-20">
              <AnimatePresence mode="wait">
                {step === "form" && (
                  <motion.div key="form" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.35 }}>
                    <div className="space-y-12">
                      <section>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 500, color: "#1e1814", marginBottom: "32px" }}>Payment Method</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <motion.button
                            onClick={() => setPaymentMethod("cod")}
                            whileTap={{ scale: 0.98 }}
                            style={{
                              padding: "24px", textAlign: "left", border: "1px solid", transition: "all 0.2s",
                              borderColor: paymentMethod === "cod" ? "#1e1814" : "rgba(30,24,20,0.12)",
                              backgroundColor: paymentMethod === "cod" ? "rgba(30,24,20,0.02)" : "transparent",
                            }}
                          >
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>🚚 Cash on Delivery</p>
                            <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Pay when you receive your order</p>
                          </motion.button>
                          <motion.button
                            onClick={() => setPaymentMethod("instapay")}
                            whileTap={{ scale: 0.98 }}
                            style={{
                              padding: "24px", textAlign: "left", border: "1px solid", transition: "all 0.2s",
                              borderColor: paymentMethod === "instapay" ? "#1e1814" : "rgba(30,24,20,0.12)",
                              backgroundColor: paymentMethod === "instapay" ? "rgba(30,24,20,0.02)" : "transparent",
                            }}
                          >
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}><Smartphone size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px", marginBottom: "2px" }} />Instapay</p>
                            <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Instant bank transfer (Requires proof)</p>
                          </motion.button>
                          <motion.button
                            onClick={() => setPaymentMethod("card")}
                            whileTap={{ scale: 0.98 }}
                            style={{
                              padding: "24px", textAlign: "left", border: "1px solid", transition: "all 0.2s",
                              borderColor: paymentMethod === "card" ? "#1e1814" : "rgba(30,24,20,0.12)",
                              backgroundColor: paymentMethod === "card" ? "rgba(30,24,20,0.02)" : "transparent",
                            }}
                          >
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>💳 Credit / Debit Card</p>
                            <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Visa, Mastercard — secure checkout</p>
                          </motion.button>
                        </div>
                      </section>

                      <section>
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 500, color: "#1e1814", marginBottom: "32px" }}>Delivery Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                          <div className="space-y-2">
                            <label style={labelStyle}>First Name</label>
                            <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={inputStyle} className="checkout-input" />
                          </div>
                          <div className="space-y-2">
                            <label style={labelStyle}>Last Name</label>
                            <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={inputStyle} className="checkout-input" />
                          </div>
                          <div className="space-y-2">
                            <label style={labelStyle}>Phone Number</label>
                            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} className="checkout-input" placeholder="01XXXXXXXXX" />
                          </div>
                          <div className="space-y-2">
                            <label style={labelStyle}>Email (Optional)</label>
                            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={handleEmailBlur} style={inputStyle} className="checkout-input" />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <label style={labelStyle}>Street Address</label>
                            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} className="checkout-input" placeholder="House number and street name" />
                          </div>
                          <div className="space-y-2 relative">
                            <label style={labelStyle}>Governorate</label>
                            <button onClick={() => setGovernorateOpen(!governorateOpen)} style={governorateInputStyle}>
                              <span style={{ opacity: form.governorate ? 1 : 0.4 }}>{form.governorate || "Select governorate"}</span>
                              <ChevronDown size={14} style={{ transform: governorateOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                            </button>
                            <AnimatePresence>
                              {governorateOpen && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full z-[500] mt-1" style={optionListStyle}>
                                  {GOVERNORATES.map((g) => (
                                    <button key={g} onClick={() => { setForm({ ...form, governorate: g }); setGovernorateOpen(false); }} className="hover:bg-[rgba(30,24,20,0.04)] transition-colors" style={optionStyle}>{g}</button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="space-y-2">
                            <label style={labelStyle}>City / Area</label>
                            <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} className="checkout-input" />
                          </div>
                        </div>
                      </section>
                    </div>
                  </motion.div>
                )}

                {step === "loading" && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-12 h-12 border-2 border-[#1e1814] border-t-transparent rounded-full animate-spin mb-6" />
                    <p style={{ fontSize: "16px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>{loadingText}</p>
                  </motion.div>
                )}

                {step === "cod-confirm" && orderResult && (
                  <motion.div key="cod-confirm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                    <OrderConfirmedScreen 
                      orderResult={orderResult} 
                      onDone={handleSuccessDone} 
                      items={orderResult.items ?? (isShopify && shopifyCart
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
                          })))
                      } 
                      breakdown={{ subtotal: breakdownSnapshot?.subtotal ?? 0, savings: breakdownSnapshot?.savings ?? 0, shippingCost: breakdownSnapshot?.shippingCost ?? 0, freeShipping: breakdownSnapshot?.freeShipping ?? false, fmt }} 
                      title="Order Received." 
                      subtitle="Cash on Delivery" 
                      message={<>Your order <strong style={{ color: "#1e1814" }}>#{orderResult.orderNumber}</strong> has been placed successfully and is being processed.</>} 
                      note="You'll receive a confirmation WhatsApp message shortly." 
                    />
                  </motion.div>
                )}

                {step === "instapay-confirm" && orderResult && (
                  <motion.div key="instapay-confirm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                    <InstapayConfirmation orderResult={orderResult} onDone={handleSuccessDone} breakdown={{ subtotal: breakdownSnapshot?.subtotal ?? 0, savings: breakdownSnapshot?.savings ?? 0, shippingCost: breakdownSnapshot?.shippingCost ?? 0, freeShipping: breakdownSnapshot?.freeShipping ?? false, fmt }} onProofSubmitted={(orderNo, shopifyId, total) => { setOrderResult({ ...orderResult, orderNumber: orderNo, shopifyOrderId: shopifyId, total }); instapayTrackedRef.current = false; }} />
                  </motion.div>
                )}

                {step === "card-pending" && (
                  <motion.div key="card-pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-12 h-12 border-2 border-[#1e1814] border-t-transparent rounded-full animate-spin mb-6" />
                    <p style={{ fontSize: "16px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Verifying your payment…</p>
                    <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", marginTop: "12px" }}>Please do not close this page</p>
                  </motion.div>
                )}

                {step === "card-confirm" && orderResult && (
                  <motion.div key="card-confirm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                    <OrderConfirmedScreen
                      orderResult={orderResult}
                      onDone={handleSuccessDone}
                      items={[]}
                      breakdown={{ subtotal: breakdownSnapshot?.subtotal ?? 0, savings: breakdownSnapshot?.savings ?? 0, shippingCost: breakdownSnapshot?.shippingCost ?? 0, freeShipping: breakdownSnapshot?.freeShipping ?? false, fmt }}
                      title="Payment Confirmed."
                      subtitle="Credit / Debit Card"
                      message={<>Your order <strong style={{ color: "#1e1814" }}>#{orderResult.orderNumber}</strong> has been placed successfully and is being processed.</>}
                      note="You'll receive a confirmation email shortly."
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <aside>
                <div className="sticky top-32 space-y-10">
                  <section>
                    <h2 style={{ fontSize: "12px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", marginBottom: "24px" }}>Order Summary</h2>
                    <div className="space-y-6">
                      {(shopifyCart?.lines.nodes || localItems).map((line: any) => {
                        const isShopifyLine = "merchandise" in line;
                        const id = isShopifyLine ? line.id : line.id;
                        const title = isShopifyLine ? line.merchandise.product.title : line.title;
                        const variantTitle = isShopifyLine ? (line.merchandise.title === "Default Title" ? null : line.merchandise.title) : line.color;
                        const qty = line.quantity;
                        const price = isShopifyLine ? formatShopifyLinePrice(line) : fmt(line.priceAmount * line.quantity);
                        const img = isShopifyLine ? resolveLineImage(line, localItems) : line.image;
                        return (
                          <div key={id} className="flex gap-4">
                            <div className="w-16 h-20 bg-[rgba(30,24,20,0.04)] flex-shrink-0 overflow-hidden">
                              {img && <img src={img} alt={title} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                              <div>
                                <p style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, lineHeight: 1.4 }}>{title}</p>
                                {variantTitle && <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", marginTop: "2px" }}>{variantTitle}</p>}
                              </div>
                              <div className="flex justify-between items-end">
                                <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Qty {qty}</span>
                                <span style={{ fontSize: "14px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>{price}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="pt-8 border-t border-[rgba(30,24,20,0.1)]">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(30,24,20,0.4)]" />
                            <input type="text" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="PROMO CODE" style={{ ...inputStyle, paddingLeft: "36px", borderBottom: "1px solid rgba(30,24,20,0.12)" }} />
                          </div>
                          <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()} style={{ padding: "0 20px", fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", backgroundColor: "#1e1814", color: "#fff", fontWeight: 600 }}>{promoLoading ? "..." : "Apply"}</button>
                        </div>
                        {promoError && <p style={{ fontSize: "11px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.02em" }}>{promoError}</p>}
                        {promoApplied && (
                          <div className="flex items-center justify-between py-2 px-3 bg-[rgba(90,122,90,0.06)] border border-[rgba(90,122,90,0.15)]">
                            <span style={{ fontSize: "11px", color: "#5a7a5a", fontWeight: 600, letterSpacing: "0.1em" }}>{promoApplied.code} APPLIED</span>
                            <button onClick={handleRemovePromo} className="p-1 hover:opacity-50"><X size={14} className="text-[#5a7a5a]" /></button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between">
                          <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Subtotal</span>
                          <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{fmt(subtotalAmount)}</span>
                        </div>
                        {freeShipping ? (
                          <div className="flex items-center gap-2 py-2 px-3 bg-[rgba(90,122,90,0.06)] border border-[rgba(90,122,90,0.15)]">
                            <span style={{ fontSize: "11px", color: "#5a7a5a", fontWeight: 600, letterSpacing: "0.1em", fontFamily: "'Montserrat', sans-serif" }}>🎉 FREE SHIPPING UNLOCKED!</span>
                          </div>
                        ) : discountedSubtotal > 0 && (
                          <div>
                            <span style={{ fontSize: "11px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>{Math.round(2000 - discountedSubtotal).toLocaleString()} EGP AWAY FROM FREE DELIVERY</span>
                          </div>
                        )}
                        {savings > 0 && (
                          <div className="flex justify-between">
                            <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif" }}>Discount</span>
                            <span style={{ fontSize: "13px", color: "#5a7a5a", fontFamily: "'Montserrat', sans-serif" }}>−{fmt(savings)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span style={{ fontSize: "13px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Shipping</span>
                          <span style={{ fontSize: "13px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{freeShipping ? "Free" : fmt(SHIPPING_EGP)}</span>
                        </div>
                        <div className="flex justify-between pt-4 border-t border-[rgba(30,24,20,0.1)]">
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e1814", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Total</span>
                          <span style={{ fontSize: "18px", fontWeight: 700, color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}>{fmt(totalAmount)}</span>
                        </div>
                      </div>

                      {step === "form" && (
                        <button
                          onClick={handleSubmit}
                          disabled={submittingRef.current}
                          className="w-full py-5 mt-6 transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase" }}
                        >
                          {submittingRef.current ? "Processing…" : "Complete Order"}
                        </button>
                      )}
                      {submitError && <p className="mt-4 text-center" style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{submitError}</p>}
                    </div>
                  </section>
                </div>
              </aside>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OrderConfirmedScreen({ orderResult, onDone, items, breakdown, title, subtitle, message, note, orderNumber }: { orderResult: OrderResult; onDone: () => void; items: any[]; breakdown: OrderBreakdown; title: string; subtitle: string; message: React.ReactNode; note: string; orderNumber?: string | number | null; }) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-[rgba(90,122,90,0.1)] rounded-full flex items-center justify-center mb-8"><Check size={40} className="text-[#5a7a5a]" /></div>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "42px", color: "#1e1814", marginBottom: "8px" }}>{title}</h1>
      <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "32px" }}>{subtitle}</p>
      <div className="w-full bg-[rgba(30,24,20,0.02)] border border-[rgba(30,24,20,0.08)] p-8 md:p-12 mb-10">
        <p style={{ fontSize: "18px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.6, marginBottom: "40px" }}>{message}</p>
        <div className="space-y-6 mb-8 text-left">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-12 h-16 bg-[rgba(30,24,20,0.05)] flex-shrink-0">{item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0 py-1">
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#1e1814" }}>{item.title}</p>
                <div className="flex justify-between items-end mt-1">
                  <span style={{ fontSize: "12px", color: "rgba(30,24,20,0.5)" }}>Qty {item.quantity}</span>
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-[rgba(30,24,20,0.1)] space-y-3 mb-8">
          <div className="flex justify-between text-sm">
            <span style={{ color: "rgba(30,24,20,0.5)" }}>Subtotal</span>
            <span>{breakdown.fmt(breakdown.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "rgba(30,24,20,0.5)" }}>Shipping</span>
            <span>{breakdown.freeShipping ? "Free" : breakdown.fmt(breakdown.shippingCost)}</span>
          </div>
          <div className="flex justify-between pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{orderResult.total}</span>
          </div>
        </div>
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", fontStyle: "italic" }}>{note}</p>
      </div>
      <button onClick={onDone} className="w-full max-w-sm py-5 transition-all hover:opacity-80" style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase" }}>Back to Shopping</button>
    </div>
  );
}

function InstapayConfirmation({ orderResult, onDone, breakdown, onProofSubmitted }: { orderResult: OrderResult; onDone: () => void; breakdown: OrderBreakdown; onProofSubmitted: (orderNo: string | number, shopifyId: number | null, total: string) => void; }) {
  const [subStep, setSubStep] = useState<InstapaySubStep>("instructions");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const instapayAccount = orderResult.instapayAccount;
  const instapayNumber = orderResult.instapayNumber;
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  function applyFile(file: File) {
    if (!file.type.startsWith("image/")) { setUploadError("Please upload an image file (JPG, PNG, HEIC)."); return; }
    setUploadError("");
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) applyFile(file); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) applyFile(file); };
  const handlePaste = (e: React.ClipboardEvent) => { const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/")); if (item) { const file = item.getAsFile(); if (file) applyFile(file); } };
  const copyToClipboard = (text: string, key: string) => { navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1800); }).catch(() => {}); };

  async function handleSubmitProof() {
    if (!referenceNumber.trim()) { setUploadError("Please enter the Instapay reference number."); return; }
    if (!screenshotFile) { setUploadError("Please upload your payment screenshot to continue."); return; }
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
      const data = await new Promise<{ ok?: boolean; alreadySubmitted?: boolean; error?: string; orderNumber?: string | number; shopifyOrderId?: number; total?: string; }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/orders/instapay-proof");
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(20 + Math.round((ev.loaded / ev.total) * 70)); };
        xhr.onload = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid response")); } };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });
      setUploadProgress(95);
      if (!data.ok && !data.alreadySubmitted) { setUploadError(data.error ?? "Upload failed. Please try again."); return; }
      if (data.orderNumber != null) { setConfirmedOrderNumber(data.orderNumber); onProofSubmitted(data.orderNumber, data.shopifyOrderId ?? null, data.total ?? orderResult.total); }
      setUploadProgress(100);
      setSubStep("review");
    } catch { setUploadError("Network error. Please try again."); } finally { setUploading(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "33px", fontWeight: 700, color: "#1e1814", marginBottom: "6px" }}>{subStep === "review" ? "Order Confirmed." : "Payment Instructions"}</h1>
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>{subStep === "review" ? "We'll verify your payment and contact you shortly." : "Complete the steps below to place your order."}</p>
      </div>
      {confirmedOrderNumber != null && (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", marginBottom: "4px" }}>Order Number</p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "29px", color: "#1e1814", fontWeight: 700 }}>#{confirmedOrderNumber}</p>
        </div>
      )}
      <div className="flex items-center gap-0 w-full" style={{ maxWidth: 320 }}>
        {(["instructions", "upload", "review"] as InstapaySubStep[]).map((s, i) => (
          <div key={s} className="flex items-center" style={{ flex: 1 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: subStep === s || i < ["instructions","upload","review"].indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.12)", flexShrink: 0 }}>
              {i < ["instructions","upload","review"].indexOf(subStep) ? <Check size={12} strokeWidth={2.5} style={{ color: "#fff" }} /> : <span style={{ fontSize: "11px", color: subStep === s ? "#fff" : "rgba(30,24,20,0.5)", fontWeight: 700 }}>{i + 1}</span>}
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
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.03)" }}><p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)" }}>How to Pay via Instapay</p></div>
              <div className="p-4 space-y-3">
                {[`Open your banking app and transfer \${orderResult.total} EGP via Instapay.`, `Send to the account below. Save your reference number.`, `Return here to upload your payment screenshot.`].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start"><span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#1e1814", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", color: "#fff", fontWeight: 700 }}>{i + 1}</span><p style={{ fontSize: "14px", color: "rgba(30,24,20,0.88)", lineHeight: 1.6 }}>{text}</p></div>
                ))}
              </div>
            </div>
            <div style={{ border: "1px solid rgba(30,24,20,0.22)", backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)" }}><p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)" }}>Instapay Account</p></div>
              <div className="p-4 space-y-3">
                {instapayAccount && (<div className="flex items-center justify-between"><div><p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", textTransform: "uppercase" }}>Name</p><p style={{ fontSize: "15px", color: "#1e1814", fontWeight: 600 }}>{instapayAccount}</p></div><button onClick={() => copyToClipboard(instapayAccount, "name")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "name" ? "#5a7a5a" : "rgba(30,24,20,0.6)", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>{copied === "name" ? "Copied" : "Copy"}</button></div>)}
                {instapayNumber && (<div className="flex items-center justify-between"><div><p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", textTransform: "uppercase" }}>Account / Number</p><p style={{ fontSize: "15px", color: "#1e1814", fontWeight: 600 }}>{instapayNumber}</p></div><button onClick={() => copyToClipboard(instapayNumber, "number")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "number" ? "#5a7a5a" : "rgba(30,24,20,0.6)", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>{copied === "number" ? "Copied" : "Copy"}</button></div>)}
                <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(30,24,20,0.1)" }}><div><p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", textTransform: "uppercase" }}>Amount</p><p style={{ fontSize: "17px", color: "#1e1814", fontWeight: 700 }}>{orderResult.total} EGP</p></div><button onClick={() => copyToClipboard(orderResult.total, "amount")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "amount" ? "#5a7a5a" : "rgba(30,24,20,0.6)", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>{copied === "amount" ? "Copied" : "Copy"}</button></div>
              </div>
            </div>
            <button onClick={() => setSubStep("upload")} className="w-full py-4" style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>I've Sent the Payment →</button>
          </motion.div>
        )}
        {subStep === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <div><label style={{ ...labelStyle, marginBottom: "8px" }}>Instapay Reference Number <span style={{ color: "#c0392b" }}>*</span></label><input type="text" placeholder="e.g. 123456789" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} style={inputStyle} className="checkout-input" /></div>
            <div><label style={{ ...labelStyle, marginBottom: "8px" }}>Payment Screenshot <span style={{ color: "#c0392b" }}>*</span></label><div ref={dropZoneRef} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onPaste={handlePaste} onClick={() => fileRef.current?.click()} tabIndex={0} style={{ border: "1.5px dashed rgba(30,24,20,0.28)", padding: "24px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", backgroundColor: screenshotPreview ? "transparent" : "rgba(30,24,20,0.02)", position: "relative", overflow: "hidden", outline: "none" }}>{screenshotPreview ? (<div style={{ position: "relative", width: "100%" }}><img src={screenshotPreview} alt="Screenshot preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain" }} /><button onClick={(e) => { e.stopPropagation(); setScreenshotFile(null); setScreenshotPreview(null); }} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center", border: "none" }}><X size={12} strokeWidth={2} style={{ color: "#fff" }} /></button></div>) : (<><Upload size={20} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} /><p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", textAlign: "center" }}>{isTouch ? "Tap to upload your screenshot" : "Drag & drop, paste, or click to upload"}<br /><span style={{ fontSize: "11px", opacity: 0.7 }}>JPG, PNG, HEIC accepted</span></p></>)}<input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} /></div></div>
            {uploading && (<div style={{ width: "100%", height: 3, backgroundColor: "rgba(30,24,20,0.12)", borderRadius: 2, overflow: "hidden" }}><motion.div style={{ height: "100%", backgroundColor: "#1e1814", borderRadius: 2 }} initial={{ width: "0%" }} animate={{ width: `\${uploadProgress}%` }} transition={{ duration: 0.3 }} /></div>)}
            {uploadError && <p style={{ fontSize: "14px", color: "#c0392b" }}>{uploadError}</p>}
            <button onClick={handleSubmitProof} disabled={uploading || !referenceNumber.trim()} className="w-full py-4 disabled:opacity-40" style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>{uploading ? "Submitting…" : "Submit Proof"}</button>
            <button onClick={() => setSubStep("instructions")} style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", textAlign: "center" }}>← Back to Instructions</button>
          </motion.div>
        )}
        {subStep === "review" && (
          <OrderConfirmedScreen orderResult={orderResult} onDone={onDone} items={orderResult.items ?? []} breakdown={breakdown} title="Order Confirmed." subtitle="InstaPay" message={confirmedOrderNumber != null ? <>Your order is confirmed and payment proof is awaiting verification. Our team will review and confirm your order <strong style={{ color: "#1e1814" }}>#\${confirmedOrderNumber}</strong> shortly.</> : "Your order is confirmed and payment proof is awaiting verification. Our team will review and confirm your order shortly."} note="Verification is usually completed within a few hours. You'll receive a WhatsApp message once confirmed." />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OrderBreakdownRows({ breakdown }: { breakdown: OrderBreakdown }) {
  const { subtotal, savings, shippingCost, freeShipping, fmt, total } = breakdown;
  const computedTotal = total ?? (subtotal - savings + shippingCost);
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
  const labelStyle: React.CSSProperties = { fontSize: "12px", color: "rgba(30,24,20,0.6)", letterSpacing: "0.08em" };
  const valueStyle: React.CSSProperties = { fontSize: "12px", color: "#1e1814", fontWeight: 500 };
  const totalLabelStyle: React.CSSProperties = { fontSize: "13px", color: "#1e1814", fontWeight: 700, letterSpacing: "0.08em" };
  const totalValueStyle: React.CSSProperties = { fontSize: "13px", color: "#1e1814", fontWeight: 700 };
  return (
    <div style={{ border: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.02)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {subtotal > 0 && (<div style={rowStyle}><span style={labelStyle}>Subtotal</span><span style={valueStyle}>{fmt(subtotal)}</span></div>)}
      {savings > 0 && (<div style={rowStyle}><span style={labelStyle}>Discount</span><span style={{ ...valueStyle, color: "#5a7a5a" }}>−{fmt(savings)}</span></div>)}
      <div style={rowStyle}><span style={labelStyle}>Shipping</span>{freeShipping ? <span style={{ ...valueStyle, color: "rgba(30,24,20,0.5)", fontStyle: "italic" }}>Complimentary</span> : <span style={valueStyle}>{fmt(shippingCost)}</span>}</div>
      <div style={{ ...rowStyle, borderTop: "1px solid rgba(30,24,20,0.12)", paddingTop: 8, marginTop: 2 }}><span style={totalLabelStyle}>Total</span><span style={totalValueStyle}>{fmt(computedTotal)}</span></div>
    </div>
  );
}
