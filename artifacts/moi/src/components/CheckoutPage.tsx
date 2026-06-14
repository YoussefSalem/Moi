import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { ENABLE_CARD_PAYMENTS, ENABLE_WALLET_PAYMENTS, ENABLE_APPLE_PAY } from "@/config/features";
import { ShopifyApplePayButton } from "./ShopifyApplePayButton";
import { motion, AnimatePresence } from "framer-motion";
import { transitions } from "@/lib/motion";
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
import { resolveLineImage } from "@/lib/productImages";
import { PUBLIC_COLOR_IMAGES, SHIPPING_EGP, resolveEmailImage, buildOrderAttribution } from "./checkout/checkoutUtils";
import { triggerApplePayHandler } from "@/lib/applePayHandler";

import type { OrderResult, OrderBreakdown, PaymentMethod, Step } from "./checkout/types";
import { useCheckoutSubmit } from "./checkout/useCheckoutSubmit";
import { CODConfirmation } from "./checkout/CODConfirmation";
import { CardConfirmation } from "./checkout/CardConfirmation";
import { InstapayConfirmation } from "./checkout/InstapayConfirmation";

/* Card, Wallet + Apple Pay are gated by feature flags in @/config/features */
const AVAILABLE_PAYMENT_METHODS: PaymentMethod[] = [
  "cod",
  "instapay",
  ...(ENABLE_CARD_PAYMENTS ? ["card" as PaymentMethod] : []),
  ...(ENABLE_WALLET_PAYMENTS ? ["wallet" as PaymentMethod] : []),
  ...(ENABLE_APPLE_PAY ? ["apple-pay" as PaymentMethod] : []),
];
type InstapaySubStep = "instructions" | "upload" | "review";
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
  // called synchronously from a user gesture; any async work before it causes Safari to
  // reject the call.
  const triggerApplePayDirectInit = useCallback(() => {
    triggerApplePayHandler({
      submittingRef,
      applePayIntentIdRef,
      isShopify,
      shopifyCart,
      localItems,
      promoApplied,
      clearCart,
      resolveLineImage,
      formatShopifyLinePrice,
      setPaymentMethod,
      setSubmitError,
      closeCheckout,
    });
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

  const fmt = useCallback((amount: number) => {
    try {
      return new Intl.NumberFormat("en-EG", {
        style: "currency", currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${amount.toFixed(0)} EGP`;
    }
  }, [currencyCode]);


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

  type AbandonedCartFallback = {
    email: string;
    cartId?: string | null;
    lineItems: Array<{ title: string; variant?: string | null; quantity: number; price: string; imageUrl?: string | null }>;
    totalAmount: string;
  };

  const markAbandonedCartRecovered = useCallback((fallback?: AbandonedCartFallback) => {
    if (abandonedCartIdRef.current) {
      const id = abandonedCartIdRef.current;
      abandonedCartIdRef.current = null;
      fetch(`/api/abandoned-carts/${id}/recovered`, { method: "POST" }).catch(() => {});
    } else if (fallback?.email) {
      fetch("/api/abandoned-carts/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallback),
      }).catch(() => {});
    }
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

  const handleSubmit = useCheckoutSubmit({
    isShopify, shopifyCart, localItems,
    form, paymentMethod, promoApplied, shopifyCheckoutToken,
    totalAmount, subtotalAmount, savings, shippingCost, freeShipping,
    fmt, clearCart, waitForSync, markAbandonedCartRecovered, formatShopifyLinePrice,
    navigateToOrderConfirmed, closeCheckout,
    setSubmitError, setStep, setBreakdownSnapshot, setOrderResult, setNavigatingToPaymob,
    submittingRef, paymobTrackedRef, instapayTrackedRef, codTrackedRef,
  });

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

  // Build the current abandoned-cart payload. Returns null if email is invalid
  // or the cart is empty. Shared by the debounce, onBlur fallback, and beacon.
  const buildAbandonedCartPayload = useCallback(() => {
    const email = form.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return null;

    const cartId = shopifyCart?.id ?? null;
    const lineItems = isShopify && shopifyCart
      ? shopifyCart.lines.nodes.map((l) => {
          const colorOpt = l.merchandise.selectedOptions?.find((o) => o.name.toLowerCase() === "color");
          const colorName = colorOpt?.value;
          return {
            title: l.merchandise.product.title,
            variant: colorName ? `Color: ${colorName}` : (l.merchandise.title === "Default Title" ? undefined : l.merchandise.title),
            quantity: l.quantity,
            price: `${Math.floor(parseFloat(l.merchandise.price.amount)).toLocaleString("en-US")} EGP`,
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

    if (!lineItems.length) return null;
    return { email, cartId, lineItems, totalAmount: fmt(totalAmount) };
  }, [form.email, shopifyCart, isShopify, localItems, totalAmount, fmt]);

  // Send /api/abandoned-carts/start. The backend upserts by email so calling
  // this multiple times is safe — it updates the existing record, not duplicate.
  const triggerAbandonedCartStart = useCallback(
    (payload: NonNullable<ReturnType<typeof buildAbandonedCartPayload>>) => {
      fetch("/api/abandoned-carts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((data: unknown) => {
          const id = (data as { id?: number })?.id;
          if (id) abandonedCartIdRef.current = id;
        })
        .catch(() => {});
    },
    [],
  );

  // onBlur secondary fallback: fires immediately when the email field loses focus
  // (catches autofill / paste / iOS keyboard-dismiss without typing).
  const handleEmailBlur = useCallback(() => {
    const email = form.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return;

    // Keep Shopify buyer-identity in sync regardless of abandoned-cart state.
    const cartId = shopifyCart?.id;
    if (cartId) cartBuyerIdentityUpdate(cartId, email).catch(() => {});

    // Fallback capture: only fires if the debounce hasn't already stored an ID.
    if (!abandonedCartIdRef.current) {
      const payload = buildAbandonedCartPayload();
      if (payload) triggerAbandonedCartStart(payload);
    }
  }, [form.email, shopifyCart, buildAbandonedCartPayload, triggerAbandonedCartStart]);

  // Always-fresh ref for the visibilitychange beacon — avoids stale closure capture.
  const latestBeaconPayloadRef = useRef<ReturnType<typeof buildAbandonedCartPayload>>(null);
  useEffect(() => {
    latestBeaconPayloadRef.current = buildAbandonedCartPayload();
  }, [buildAbandonedCartPayload]);

  // Primary trigger: fire 1.75 s after the email becomes valid (or cart changes
  // while a valid email is already present). Debounce prevents excessive calls.
  useEffect(() => {
    if (!checkoutOpen) return;
    const payload = buildAbandonedCartPayload();
    if (!payload) return;

    const timer = window.setTimeout(() => {
      triggerAbandonedCartStart(payload);
    }, 1750);
    return () => window.clearTimeout(timer);
  }, [checkoutOpen, buildAbandonedCartPayload, triggerAbandonedCartStart]);

  // Mobile safety net: when the user switches apps or closes the browser tab,
  // send the latest cart data via sendBeacon so the server can capture the
  // abandonment even if the page unloads before the debounce fires.
  useEffect(() => {
    function onVisibilityHide() {
      if (document.visibilityState !== "hidden") return;
      const payload = latestBeaconPayloadRef.current;
      if (!payload) return;

      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const queued = navigator.sendBeacon("/api/abandoned-carts/start", blob);
      if (!queued) {
        // sendBeacon queue full — fall back to keepalive fetch
        fetch("/api/abandoned-carts/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibilityHide);
    return () => document.removeEventListener("visibilitychange", onVisibilityHide);
  }, []);

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
    markAbandonedCartRecovered({
      email: form.email.trim(),
      cartId: shopifyCart?.id ?? null,
      lineItems: itemsSnapshot.map((i) => ({
        title: i.title,
        variant: i.variantTitle,
        quantity: i.quantity,
        price: i.price,
        imageUrl: i.image,
      })),
      totalAmount: fmt(totalAmount),
    });
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
  }, [clearCart, markAbandonedCartRecovered, isShopify, shopifyCart, localItems, totalAmount, form.email, fmt, navigateToOrderConfirmed]);


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

      // Prefer the in-memory intentId (set at paymob-init time) but fall back to the
      // sessionStorage key so the order_id matches what Path C (3DS redirect restore)
      // would use. This ensures both paths produce the same event_id for Meta dedup.
      const intentId =
        orderResult?.intentId ??
        (typeof sessionStorage !== "undefined"
          ? (sessionStorage.getItem("moi_paymob_intent_id") ?? undefined)
          : undefined);

      if (data.success) {
        if (paymobTrackedRef.current) return;
        paymobTrackedRef.current = true;
        // Clear the sessionStorage result key so the mount-only Path C (3DS redirect
        // restore) cannot fire a second Purchase event if the component later remounts.
        try { sessionStorage.removeItem("moi_paymob_result"); } catch { /* ignore */ }
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
          transition={transitions.departure}
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
          transition={transitions.springEntry}
          className="fixed inset-0 z-[120] overflow-y-auto"
          style={{
            overscrollBehavior: "contain",
            background: "linear-gradient(135deg, #FAFAF7 0%, #F5F1E8 30%, #EDE4D3 60%, #F5F1E8 80%, #FAFAF7 100%)",
            backgroundSize: "400% 400%",
            animation: "checkout-bg-drift 45s ease-in-out infinite",
          }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-10 py-5"
            style={{ backgroundColor: "rgba(245, 241, 232, 0.88)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: "1px solid rgba(30,24,20,0.10)" }}
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
                transition={transitions.spinner}
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
                formatShopifyLinePrice={formatShopifyLinePrice}
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

