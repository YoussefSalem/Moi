import { useCallback, useRef, useEffect } from "react";
import { parseEGP } from "@/lib/price";
import { trackTikTokPurchase } from "@/lib/tiktokPixel";
import { trackShopifyPurchase } from "@/lib/shopifyAnalytics";
import { trackPurchase as trackMetaPurchase } from "@/lib/metaPixel";
import { SHOPIFY_CONFIGURED } from "@/lib/shopify";
import { ENABLE_CARD_PAYMENTS, ENABLE_WALLET_PAYMENTS, ENABLE_APPLE_PAY } from "@/config/features";
import { resolveLineImage } from "@/lib/productImages";
import { buildOrderAttribution, buildMetaLineData } from "./checkoutUtils";
import type { ShopifyCart, ShopifyCartLine } from "@/lib/shopify";
import type { LocalCartItem } from "@/context/CartContext";
import type { OrderResult, PaymentMethod, Step } from "./types";

interface SubmitDeps {
  isShopify: boolean;
  shopifyCart: ShopifyCart | null;
  localItems: LocalCartItem[];
  form: { firstName: string; lastName: string; phone: string; email: string; address: string; governorate: string; postalCode: string; city: string };
  paymentMethod: PaymentMethod;
  promoApplied: { code: string } | null;
  shopifyCheckoutToken: string | null;
  totalAmount: number;
  subtotalAmount: number;
  savings: number;
  shippingCost: number;
  freeShipping: boolean;
  fmt: (n: number) => string;
  clearCart: () => void;
  waitForSync: () => Promise<ShopifyCart | null>;
  markAbandonedCartRecovered: () => void;
  formatShopifyLinePrice: (line: ShopifyCartLine) => string;
  navigateToOrderConfirmed: (intentId?: string | null) => void;
  closeCheckout: () => void;
  setSubmitError: (e: string) => void;
  setStep: (s: Step) => void;
  setBreakdownSnapshot: (b: { subtotal: number; savings: number; shippingCost: number; freeShipping: boolean } | null) => void;
  setOrderResult: React.Dispatch<React.SetStateAction<OrderResult | null>>;
  setNavigatingToPaymob: (v: boolean) => void;
  submittingRef: React.MutableRefObject<boolean>;
  paymobTrackedRef: React.MutableRefObject<boolean>;
  instapayTrackedRef: React.MutableRefObject<boolean>;
  codTrackedRef: React.MutableRefObject<boolean>;
}

export function useCheckoutSubmit(deps: SubmitDeps): () => Promise<void> {
  const depsRef = useRef(deps);
  useEffect(() => { depsRef.current = deps; });

  const handleSubmit = useCallback(async () => {
    const d = depsRef.current;
    if (d.submittingRef.current) return;
    d.submittingRef.current = true;

    const hasShopifyItems = d.isShopify && !!d.shopifyCart && d.shopifyCart.lines.nodes.length > 0;
    const hasLocalItems   = d.localItems.length > 0;
    if (!hasShopifyItems && !hasLocalItems) {
      d.setSubmitError("Your cart appears to be empty. Please add items before checking out.");
      d.submittingRef.current = false;
      return;
    }

    let activeCart      = d.shopifyCart;
    let activeIsShopify = d.isShopify;

    if (SHOPIFY_CONFIGURED && !hasShopifyItems) {
      d.setStep("loading");
      try {
        const synced = await Promise.race<ShopifyCart | null>([
          d.waitForSync(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
        ]);
        if (!synced || synced.lines.nodes.length === 0) {
          d.setSubmitError("Your cart is still syncing. Please wait a moment and try again.");
          d.setStep("form");
          d.submittingRef.current = false;
          return;
        }
        activeCart      = synced;
        activeIsShopify = true;
      } catch {
        d.setSubmitError("Something went wrong. Please try again.");
        d.setStep("form");
        d.submittingRef.current = false;
        return;
      }
    }

    if (!d.form.firstName.trim() || !d.form.lastName.trim() || !d.form.phone.trim() || !d.form.address.trim() || !d.form.city.trim() || !d.form.governorate.trim()) {
      d.setSubmitError("Please fill in all fields.");
      d.submittingRef.current = false;
      return;
    }
    const phoneDigits = d.form.phone.replace(/\D/g, "");
    const isValidPhone =
      (phoneDigits.length === 11 && phoneDigits.startsWith("01")) ||
      (phoneDigits.length === 12 && phoneDigits.startsWith("201"));
    if (!isValidPhone) {
      d.setSubmitError("Please enter a valid Egyptian phone number (e.g. 01200520083 or +20 1200520083).");
      d.submittingRef.current = false;
      return;
    }

    d.setSubmitError("");
    d.setStep("loading");

    const orderLines = activeIsShopify && activeCart
      ? activeCart.lines.nodes.map((l) => ({ variantId: l.merchandise.id, quantity: l.quantity }))
      : d.localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

    const customerPayload = {
      firstName:  d.form.firstName.trim(),
      lastName:   d.form.lastName.trim(),
      email:      d.form.email.trim() || undefined,
      phone:      d.form.phone.trim(),
      address:    d.form.address.trim(),
      governorate: d.form.governorate.trim(),
      postalCode: d.form.postalCode.trim() || undefined,
      city:       d.form.city.trim(),
    };

    if (d.paymentMethod === "card" || d.paymentMethod === "wallet") {
      if (d.paymentMethod === "card" && !ENABLE_CARD_PAYMENTS) {
        d.submittingRef.current = false;
        d.setSubmitError("Card payments are temporarily unavailable. Please choose another payment method.");
        d.setStep("form");
        return;
      }
      if (d.paymentMethod === "wallet" && !ENABLE_WALLET_PAYMENTS) {
        d.submittingRef.current = false;
        d.setSubmitError("Mobile wallet payments are temporarily unavailable. Please choose another payment method.");
        d.setStep("form");
        return;
      }
      try {
        try { sessionStorage.setItem("moi_checkout_form", JSON.stringify(d.form)); } catch { /* ignore */ }
        const res = await fetch("/api/orders/paymob-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLines,
            customer: customerPayload,
            cartId: activeCart?.id ?? null,
            discountCode: d.promoApplied?.code ?? null,
            attribution: buildOrderAttribution(),
            checkoutToken: d.shopifyCheckoutToken ?? null,
            paymentType: d.paymentMethod,
          }),
        });
        const data = await res.json() as { iframeUrl?: string; intentId?: string; total?: string; error?: string };
        if (!res.ok || !data.iframeUrl) {
          d.setStep("form");
          d.setSubmitError(data.error ?? "Payment gateway unavailable. Please try again.");
          d.submittingRef.current = false;
          return;
        }
        const resolvedTotal = data.total ?? d.fmt(d.totalAmount);
        d.setBreakdownSnapshot({ subtotal: d.subtotalAmount, savings: d.savings, shippingCost: d.shippingCost, freeShipping: d.freeShipping });
        const cartItemsSnapshot = activeIsShopify && activeCart
          ? activeCart.lines.nodes.map((l) => ({ id: l.id, title: l.merchandise.product.title, variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title, quantity: l.quantity, image: resolveLineImage(l, d.localItems), price: d.formatShopifyLinePrice(l) }))
          : d.localItems.map((i) => ({ id: i.id, title: i.title, variantTitle: null, quantity: i.quantity, image: i.image ?? null, price: i.price }));
        d.setOrderResult({ orderNumber: "", total: resolvedTotal, intentId: data.intentId, items: cartItemsSnapshot.length > 0 ? cartItemsSnapshot : undefined });
        if (data.intentId) {
          sessionStorage.setItem("moi_paymob_intent_id", data.intentId);
          sessionStorage.setItem("moi_paymob_order_total", resolvedTotal);
          sessionStorage.setItem("moi_paymob_payment_method", d.paymentMethod);
          sessionStorage.setItem("moi_paymob_breakdown", JSON.stringify({ subtotal: d.subtotalAmount, savings: d.savings, shippingCost: d.shippingCost, freeShipping: d.freeShipping }));
          if (cartItemsSnapshot.length > 0) sessionStorage.setItem("moi_paymob_items", JSON.stringify(cartItemsSnapshot));
        }
        d.paymobTrackedRef.current = false;
        d.setNavigatingToPaymob(true);
        setTimeout(() => { window.location.href = data.iframeUrl!; }, 420);
      } catch {
        d.setStep("form");
        d.setSubmitError("Network error. Please check your connection and try again.");
      }
      d.submittingRef.current = false;
      return;
    }

    if (d.paymentMethod === "apple-pay") {
      if (!ENABLE_APPLE_PAY) {
        d.submittingRef.current = false;
        d.setSubmitError("Apple Pay is temporarily unavailable. Please choose another payment method.");
        d.setStep("form");
        return;
      }
      d.submittingRef.current = false;
      d.setSubmitError("Please tap the Apple Pay button above to complete your purchase.");
      d.setStep("form");
      return;
    }

    if (d.paymentMethod === "instapay") {
      try {
        const cartItemsSnapshot = activeIsShopify && activeCart
          ? activeCart.lines.nodes.map((l) => ({ id: l.id, title: l.merchandise.product.title, variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title, quantity: l.quantity, image: resolveLineImage(l, d.localItems), price: d.formatShopifyLinePrice(l) }))
          : d.localItems.map((i) => ({ id: i.id, title: i.title, variantTitle: null, quantity: i.quantity, image: i.image ?? null, price: i.price }));
        const res = await fetch("/api/orders/instapay-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: orderLines, customer: customerPayload, cartId: activeCart?.id ?? null, discountCode: d.promoApplied?.code ?? null, attribution: buildOrderAttribution(), checkoutToken: d.shopifyCheckoutToken ?? null }),
        });
        const data = await res.json() as { success?: boolean; instapayAccount?: string; instapayNumber?: string; draftOrderId?: number; shopifyOrderId?: number; shopifyOrderNumber?: number; total?: string; error?: string };
        if (!res.ok || !data.success) {
          d.setStep("form");
          d.setSubmitError(data.error ?? "Something went wrong. Please try again.");
          d.submittingRef.current = false;
          return;
        }
        const orderResultPayload: OrderResult = {
          orderNumber: data.shopifyOrderNumber ?? data.shopifyOrderId ?? "",
          total: data.total ?? d.fmt(d.totalAmount),
          draftOrderId: data.draftOrderId,
          shopifyOrderId: data.shopifyOrderId,
          shopifyOrderNumber: data.shopifyOrderNumber,
          instapayAccount: data.instapayAccount,
          instapayNumber: data.instapayNumber,
          customerName: `${d.form.firstName.trim()} ${d.form.lastName.trim()}`.trim(),
          customerPhone: d.form.phone.trim(),
          items: cartItemsSnapshot.length > 0 ? cartItemsSnapshot : undefined,
        };
        d.setBreakdownSnapshot({ subtotal: d.subtotalAmount, savings: d.savings, shippingCost: d.shippingCost, freeShipping: d.freeShipping });
        d.setOrderResult(orderResultPayload);
        sessionStorage.setItem("moi_instapay_order_result", JSON.stringify(orderResultPayload));
        d.setStep("instapay-confirm");
        d.markAbandonedCartRecovered();
      } catch {
        d.setStep("form");
        d.setSubmitError("Network error. Please check your connection and try again.");
      }
      d.submittingRef.current = false;
      return;
    }

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: orderLines, customer: customerPayload, paymentMethod: "cod", cartId: activeCart?.id ?? null, discountCode: d.promoApplied?.code ?? null, attribution: buildOrderAttribution(), checkoutToken: d.shopifyCheckoutToken ?? null }),
      });
      const data = await res.json() as { success?: boolean; orderNumber?: number | string; shopifyOrderId?: number; total?: string; error?: string };
      if (!res.ok || !data.success) {
        d.setStep("form");
        d.setSubmitError(data.error ?? "Something went wrong. Please try again.");
        d.submittingRef.current = false;
        return;
      }
      const codItemsSnapshot = activeIsShopify && activeCart
        ? activeCart.lines.nodes.map((l) => ({ id: l.id, title: l.merchandise.product.title, variantTitle: l.merchandise.title === "Default Title" ? null : l.merchandise.title, quantity: l.quantity, image: resolveLineImage(l, d.localItems), price: d.formatShopifyLinePrice(l) }))
        : d.localItems.map((i) => ({ id: i.id, title: i.title, variantTitle: null as string | null, quantity: i.quantity, image: i.image ?? null, price: i.price }));
      const codBreakdown = { subtotal: d.subtotalAmount, savings: d.savings, shippingCost: d.shippingCost, freeShipping: d.freeShipping };
      try {
        sessionStorage.setItem("moi_order_confirmation", JSON.stringify({ items: codItemsSnapshot, breakdown: codBreakdown, paymentMethod: "cod", orderNumber: data.orderNumber ?? "" }));
      } catch { /* ignore */ }
      d.clearCart();
      const purchaseValue = data.total ? parseEGP(data.total) || (Number.isFinite(d.totalAmount) ? d.totalAmount : 0) : (Number.isFinite(d.totalAmount) ? d.totalAmount : 0);
      const purchaseItems = orderLines.reduce((s, l) => s + l.quantity, 0);
      if (!d.codTrackedRef.current) {
        d.codTrackedRef.current = true;
        import("@/lib/analytics").then(({ trackPurchaseWithTime: trackInternalPurchase }) => {
          trackInternalPurchase(String(data.orderNumber ?? data.shopifyOrderId ?? ""), purchaseValue, "cod");
        });
        trackTikTokPurchase({ content_id: orderLines[0]?.variantId, currency: "EGP", value: purchaseValue, quantity: purchaseItems, order_id: String(data.orderNumber ?? data.shopifyOrderId ?? "") });
        trackShopifyPurchase({ orderId: String(data.shopifyOrderId ?? data.orderNumber ?? ""), orderNumber: data.orderNumber, totalPrice: purchaseValue, currencyCode: "EGP", lineItems: orderLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) });
        const codMeta = buildMetaLineData(activeIsShopify, activeCart, d.localItems);
        trackMetaPurchase({
          content_ids: codMeta.contentIds.length > 0 ? codMeta.contentIds : orderLines.map((l) => l.variantId),
          contents: codMeta.contents.length > 0 ? codMeta.contents : undefined,
          num_items: codMeta.numItems || purchaseItems,
          value: purchaseValue,
          currency: "EGP",
          order_id: String(data.orderNumber ?? data.shopifyOrderId ?? ""),
          user: {
            email: d.form.email.trim() || undefined,
            phone: d.form.phone.trim() || undefined,
            first_name: d.form.firstName.trim() || undefined,
            last_name: d.form.lastName.trim() || undefined,
          },
        });
        if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
          (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "purchase", { transaction_id: String(data.orderNumber ?? data.shopifyOrderId ?? ""), value: purchaseValue, currency: "EGP", items: orderLines.map((l) => ({ item_id: l.variantId, quantity: l.quantity })) });
        }
      }
      d.markAbandonedCartRecovered();
      d.submittingRef.current = false;
      d.setStep("form");
      window.history.pushState(null, "", "/order-confirmed");
      window.dispatchEvent(new PopStateEvent("popstate"));
      d.closeCheckout();
    } catch {
      d.setStep("form");
      d.setSubmitError("Network error. Please check your connection and try again.");
      d.submittingRef.current = false;
    }
  }, []); // uses depsRef — always reads latest values

  return handleSubmit;
}
