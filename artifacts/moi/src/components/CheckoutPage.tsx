import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { ENABLE_CARD_PAYMENTS, ENABLE_WALLET_PAYMENTS, ENABLE_APPLE_PAY } from "@/config/features";
import { ShopifyApplePayButton } from "./ShopifyApplePayButton";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Upload, X, CreditCard, Tag, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { SHOPIFY_CONFIGURED, cartBuyerIdentityUpdate } from "@/lib/shopify";
import { parseEGP } from "@/lib/price";
import { trackTikTokPurchase } from "@/lib/tiktokPixel";
import { trackShopifyPurchase } from "@/lib/shopifyAnalytics";
import { getAttribution } from "@/lib/adAttribution";
import { trackCheckoutStep, trackCheckoutStepTime } from "@/lib/analytics";
import type { ShopifyCartLine } from "@/lib/shopify";
import { CheckoutOrderSummaryPanel } from "./checkout/CheckoutOrderSummaryPanel";
import { CheckoutDeliveryFormPanel } from "./checkout/CheckoutDeliveryFormPanel";
import { resolveLineImage, normalizeTitle } from "@/lib/productImages";

import type { OrderResult, OrderBreakdown } from "./checkout/types";
import { CODConfirmation } from "./checkout/CODConfirmation";
import { CardConfirmation } from "./checkout/CardConfirmation";
import { InstapayConfirmation } from "./checkout/InstapayConfirmation";

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
  sand:         `${BASE_IMG}/sand-main.jpg`,
};

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


const SHIPPING_EGP = 75;

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
    waitForSync,
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
  const [navigatingToPaymob, setNavigatingToPaymob] = useState(false);
  const [returningFromPaymob, setReturningFromPaymob] = useState(false);
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
  // Mirrors orderResult.intentId so success callbacks (whose deps exclude
  // orderResult) can read the live Paymob intent id when navigating away.
  const orderIntentIdRef = useRef<string | null>(null);

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

  // When the browser restores this page from the back-forward cache (user pressed
  // "back" after being redirected to Paymob), the React state is exactly as it was
  // before navigation — navigatingToPaymob=true and step="loading". This makes the
  // site appear frozen under the full-screen overlay with the Place Order button
  // locked. The pageshow event fires on bfcache restores (persisted=true) so we
  // can detect this and reset to a clean form state.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        // Page was restored from bfcache after Paymob redirect — show brief loading
        // overlay while React re-hydrates, then reveal the clean form.
        setReturningFromPaymob(true);
        setNavigatingToPaymob(false);
        submittingRef.current = false;
        setStep("form");
        setPaymobIframeUrl(null);
        setSubmitError("");
        setTimeout(() => setReturningFromPaymob(false), 900);
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Keep orderIntentIdRef in sync with the current Paymob intent id.
  useEffect(() => {
    orderIntentIdRef.current = orderResult?.intentId ?? null;
  }, [orderResult?.intentId]);

  // Unified success navigation: every payment method (COD, Apple Pay, InstaPay,
  // card/wallet) ends on the single OrderConfirmationPage at /order-confirmed.
  const navigateToOrderConfirmed = useCallback((intentId?: string | null) => {
    submittingRef.current = false;
    setStep("form");
    const qs = intentId ? `?intentId=${encodeURIComponent(intentId)}` : "";
    window.history.pushState(null, "", `/order-confirmed${qs}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    closeCheckout();
  }, [closeCheckout]);

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
          onshippingcontactselected: ((e: { shippingContact: unknown }) => void) | null;
          onshippingmethodselected: ((e: { shippingMethod: unknown }) => void) | null;
          oncancel: (() => void) | null;
          completeMerchantValidation(s: unknown): void;
          completeShippingContactSelection(u: unknown): void;
          completeShippingMethodSelection(u: unknown): void;
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
      requiredShippingContactFields: ["name", "email", "phone", "postalAddress"],
      shippingMethods: [
        {
          label: "Standard",
          detail: "Delivery in 2–4 business days",
          amount: shippingAmt.toFixed(2),
          identifier: "standard",
        },
      ],
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

    // Required by Apple Pay JS when requiredShippingContactFields or shippingMethods
    // are specified — must call completeShippingContactSelection / completeShippingMethodSelection
    // or the session stalls and onpaymentauthorized never fires.
    session.onshippingcontactselected = () => {
      session.completeShippingContactSelection({
        newTotal: { label: "Moi", amount: (totalCents / 100).toFixed(2) },
        newLineItems: shippingAmt > 0 ? [{ label: "Shipping", amount: shippingAmt.toFixed(2) }] : [],
        newShippingMethods: [
          {
            label: "Standard",
            detail: "Delivery in 2–4 business days",
            amount: shippingAmt.toFixed(2),
            identifier: "standard",
          },
        ],
      });
    };

    session.onshippingmethodselected = () => {
      session.completeShippingMethodSelection({
        newTotal: { label: "Moi", amount: (totalCents / 100).toFixed(2) },
        newLineItems: shippingAmt > 0 ? [{ label: "Shipping", amount: shippingAmt.toFixed(2) }] : [],
      });
    };

    session.onpaymentauthorized = async ({ payment }) => {
      // Diagnostic: fire-and-forget ping to confirm callback fired + network works
      void fetch("/api/apple-pay/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "onpaymentauthorized" }),
      });
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
          const apBreakdown = { subtotal: subTotal, savings: savingsAmt, shippingCost: shippingAmt, freeShipping: isFreeShipping };
          try {
            sessionStorage.setItem("moi_order_confirmation", JSON.stringify({
              items: cartItemsSnapshot,
              breakdown: apBreakdown,
              paymentMethod: "apple-pay",
              orderNumber: data.shopifyOrderNumber ?? "",
            }));
          } catch { /* ignore */ }
          clearCart();
          window.history.pushState(null, "", "/order-confirmed");
          window.dispatchEvent(new PopStateEvent("popstate"));
          setTimeout(() => closeCheckout(), 80);
        } else {
          session.completePayment({ status: AP.STATUS_FAILURE });
          setSubmitError(data.error ?? "Payment was declined. Please try another card.");
          setPaymentMethod("cod");
        }
      } catch (apErr) {
        session.completePayment({ status: AP.STATUS_FAILURE });
        setSubmitError(`Debug: ${apErr instanceof Error ? apErr.message : String(apErr)}`);
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

    // `activeCart` / `activeIsShopify` are the authoritative cart values for this
    // submission. Normally equal to the React state snapshot, but if the user
    // submits before the background Shopify sync finishes we wait silently for up
    // to 10 s and proceed automatically — no retry required.
    let activeCart = shopifyCart;
    let activeIsShopify = isShopify;

    if (SHOPIFY_CONFIGURED && !hasShopifyItems) {
      setStep("loading");
      try {
        const synced = await Promise.race<import("@/lib/shopify").ShopifyCart | null>([
          waitForSync(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
        ]);
        if (!synced || synced.lines.nodes.length === 0) {
          setSubmitError("Your cart is still syncing. Please wait a moment and try again.");
          setStep("form");
          submittingRef.current = false;
          return;
        }
        activeCart = synced;
        activeIsShopify = true;
      } catch {
        setSubmitError("Something went wrong. Please try again.");
        setStep("form");
        submittingRef.current = false;
        return;
      }
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

    const orderLines = activeIsShopify && activeCart
      ? activeCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
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
            cartId: activeCart?.id ?? null,
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
        const cartItemsSnapshot = activeIsShopify && activeCart
          ? activeCart.lines.nodes.map((l) => ({
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
          sessionStorage.setItem("moi_paymob_payment_method", paymentMethod);
          // Save breakdown + items so the confirmation screen has correct values after redirect
          sessionStorage.setItem("moi_paymob_breakdown", JSON.stringify({ subtotal: subtotalAmount, savings, shippingCost, freeShipping }));
          if (cartItemsSnapshot.length > 0) {
            sessionStorage.setItem("moi_paymob_items", JSON.stringify(cartItemsSnapshot));
          }
        }
        paymobTrackedRef.current = false;
        setNavigatingToPaymob(true);
        setTimeout(() => { window.location.href = data.iframeUrl!; }, 420);
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
        const cartItemsSnapshot = activeIsShopify && activeCart
          ? activeCart.lines.nodes.map((l) => ({
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
            cartId: activeCart?.id ?? null,
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
          cartId: activeCart?.id ?? null,
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

      const codItemsSnapshot = activeIsShopify && activeCart
        ? activeCart.lines.nodes.map((l) => ({
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
            variantTitle: null as string | null,
            quantity: i.quantity,
            image: i.image ?? null,
            price: i.price,
          }));
      const codBreakdown = { subtotal: subtotalAmount, savings, shippingCost, freeShipping };
      try {
        sessionStorage.setItem("moi_order_confirmation", JSON.stringify({
          items: codItemsSnapshot,
          breakdown: codBreakdown,
          paymentMethod: "cod",
          orderNumber: data.orderNumber ?? "",
        }));
      } catch { /* ignore */ }

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
      markAbandonedCartRecovered();
      // Reset submission state before closing so the next order can be placed.
      submittingRef.current = false;
      setStep("form");
      window.history.pushState(null, "", "/order-confirmed");
      window.dispatchEvent(new PopStateEvent("popstate"));
      closeCheckout();
    } catch {
      setStep("form");
      setSubmitError("Network error. Please check your connection and try again.");
      submittingRef.current = false;
    }
  }, [form, paymentMethod, isShopify, shopifyCart, localItems, promoApplied, totalAmount, fmt, clearCart, shopifyCheckoutToken, markAbandonedCartRecovered, waitForSync]);

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
    // Unified success: land on the single OrderConfirmationPage (same as COD/Apple Pay).
    // Card item/breakdown snapshot is already in sessionStorage (moi_paymob_*);
    // the intent id drives order-number polling on the confirmation page.
    navigateToOrderConfirmed(orderIntentIdRef.current);
  }, [clearCart, markAbandonedCartRecovered, isShopify, shopifyCart, localItems, totalAmount, navigateToOrderConfirmed]);


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
      setNavigatingToPaymob(true);
      setTimeout(() => { window.location.href = data.iframeUrl!; }, 420);
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
          // Unified success: persist the snapshot then land on OrderConfirmationPage.
          try {
            const restoredBreakdown = breakdownRaw
              ? JSON.parse(breakdownRaw) as unknown
              : { subtotal: 0, savings: 0, shippingCost: 0, freeShipping: false };
            sessionStorage.setItem("moi_order_confirmation", JSON.stringify({
              items: restoredItems ?? [],
              breakdown: restoredBreakdown,
              paymentMethod: "card",
              orderNumber: "",
              intentId: syncIntentId ?? undefined,
            }));
          } catch { /* ignore */ }
          navigateToOrderConfirmed(syncIntentId ?? null);
          return;
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

  // Listen for PAYMOB_RESULT postMessages from the Paymob relay page when it runs
  // inside an iframe or popup (Cases 1 & 2 in paymob-relay.html).
  // On success: navigate to /payment/success; on failure: navigate to /payment/failed.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let data: { type?: string; success?: boolean; pending?: boolean; transactionId?: string };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) as typeof data : event.data as typeof data;
      } catch {
        return;
      }
      if (!data || data.type !== "PAYMOB_RESULT") return;

      const intentId = orderResult?.intentId;

      if (data.success) {
        if (paymobTrackedRef.current) return;
        paymobTrackedRef.current = true;
        clearCart();
        markAbandonedCartRecovered();
        const orderLines = isShopify && shopifyCart
          ? shopifyCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
          : localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
        const totalVal = isShopify && shopifyCart && shopifyCart.cost?.totalAmount?.amount
          ? parseFloat(shopifyCart.cost.totalAmount.amount)
          : (Number.isFinite(totalAmount) ? totalAmount : 0);
        const effectiveOrderId = String(intentId ?? data.transactionId ?? "");
        import("@/lib/analytics").then(({ trackPurchaseWithTime: trackInternalPurchase }) => {
          trackInternalPurchase(effectiveOrderId, totalVal, "card");
        });
        trackShopifyPurchase({
          orderId: effectiveOrderId,
          totalPrice: totalVal,
          currencyCode: "EGP",
          lineItems: orderLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        });
        navigateToOrderConfirmed(intentId ?? null);
      } else if (!data.pending) {
        window.location.href = "/payment/failed";
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [orderResult?.intentId, clearCart, markAbandonedCartRecovered, isShopify, shopifyCart, localItems, totalAmount, navigateToOrderConfirmed]);

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
    {/* Full-screen fade overlay shown before Paymob redirect — prevents jarring departure */}
    <AnimatePresence>
      {navigatingToPaymob && (
        <motion.div
          key="paymob-departure"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeIn" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#faf8f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid rgba(30,24,20,0.12)",
                borderTopColor: "#1e1814",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(30,24,20,0.55)" }}>
              Redirecting to payment
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    {/* Loading overlay shown when returning from Paymob via browser back (bfcache restore) */}
    <AnimatePresence>
      {returningFromPaymob && checkoutOpen && (
        <motion.div
          key="paymob-return"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55, ease: "easeOut" } }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 130,
            backgroundColor: "#efe6da",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.1rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1.5px solid rgba(30,24,20,0.16)",
                borderTopColor: "#1e1814",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.46)" }}>
              Returning to checkout
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {checkoutOpen && (
        <motion.div
          key="checkout-overlay"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
          className="fixed inset-0 z-[120] overflow-y-auto"
          style={{ backgroundColor: "#efe6da", overscrollBehavior: "contain" }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-10 py-5"
            style={{ backgroundColor: "#efe6da", borderBottom: "1px solid rgba(30,24,20,0.14)" }}
          >
            {step === "loading" ? (
              <div style={{ width: 80 }} />
            ) : (
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
            )}
            <span style={{ fontSize: "14px", letterSpacing: "0.4em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
              MOI
            </span>
            <div style={{ width: 80 }} />
          </div>

          {step === "loading" ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-6 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                style={{ width: 28, height: 28, border: "1.5px solid rgba(30,24,20,0.32)", borderTopColor: "#1e1814", borderRadius: "50%" }}
              />
              <p style={{ fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif" }}>
                {loadingText}
              </p>
              <p style={{ fontSize: "11px", letterSpacing: "0.12em", color: "rgba(30,24,20,0.45)", fontFamily: "'Montserrat', sans-serif", maxWidth: 240 }}>
                Please don't close or refresh this page
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

                const instapayItems = orderResult?.items ?? successItems;
                const instapayBreakdown = breakdownSnapshot ?? { subtotal: subtotalAmount, savings, shippingCost, freeShipping };
                try {
                  sessionStorage.setItem("moi_order_confirmation", JSON.stringify({
                    items: instapayItems,
                    breakdown: instapayBreakdown,
                    paymentMethod: "instapay",
                    orderNumber: orderNumber ?? "",
                  }));
                } catch { /* ignore */ }

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
                window.history.pushState(null, "", "/order-confirmed");
                window.dispatchEvent(new PopStateEvent("popstate"));
                closeCheckout();
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
              <CheckoutOrderSummaryPanel
                lines={lines}
                localLines={localLines}
                localItems={localItems}
                promoApplied={promoApplied}
                savings={savings}
                subtotalAmount={subtotalAmount}
                discountedSubtotal={discountedSubtotal}
                freeShipping={freeShipping}
                shippingCost={shippingCost}
                totalAmount={totalAmount}
                fmt={fmt}
                promoInput={promoInput}
                setPromoInput={setPromoInput}
                setPromoError={setPromoError}
                handleApplyPromo={handleApplyPromo}
                handleRemovePromo={handleRemovePromo}
                promoLoading={promoLoading}
                promoError={promoError}
              />
              {/* Right: Payment + Form */}
              <CheckoutDeliveryFormPanel
                form={form}
                setForm={setForm}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                availablePaymentMethods={AVAILABLE_PAYMENT_METHODS}
                submitError={submitError}
                emailError={emailError}
                setEmailError={setEmailError}
                handleEmailBlur={handleEmailBlur}
                handleSubmit={handleSubmit}
                navigatingToPaymob={navigatingToPaymob}
                governorateOpen={governorateOpen}
                setGovernorateOpen={setGovernorateOpen}
                triggerApplePayDirectInit={triggerApplePayDirectInit}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

