import { SHIPPING_EGP } from "@/components/checkout/checkoutUtils";
import type { ShopifyCart, ShopifyCartLine } from "@/lib/shopify";

type PaymentMethod = "cod" | "instapay" | "card" | "wallet" | "apple-pay";

interface LocalItem {
  variantId: string;
  quantity: number;
  priceAmount: number;
  id: string;
  title: string;
  image?: string | null;
  price: string;
  color?: string;
  currencyCode?: string;
}

interface ApplePayHandlerOptions {
  submittingRef: { current: boolean };
  applePayIntentIdRef: { current: string | null };
  isShopify: boolean;
  shopifyCart: ShopifyCart | null;
  localItems: LocalItem[];
  promoApplied: { code: string } | null;
  clearCart: () => void;
  resolveLineImage: (l: ShopifyCartLine, localItems: LocalItem[]) => string | null;
  formatShopifyLinePrice: (l: ShopifyCartLine) => string;
  setPaymentMethod: (m: PaymentMethod) => void;
  setSubmitError: (e: string) => void;
  closeCheckout: () => void;
}

type ApSession = {
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

type ApplePaySessionCtor = {
  new(v: number, r: object): ApSession;
  canMakePayments(): boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
};

/**
 * Initiates a native ApplePaySession from a button click or similar synchronous event.
 * Must be called synchronously from a user gesture (ApplePaySession.begin() requirement).
 */
export function triggerApplePayHandler({
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
}: ApplePayHandlerOptions): void {
  if (submittingRef.current) return;

  const AP = (window as unknown as { ApplePaySession?: ApplePaySessionCtor }).ApplePaySession;
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
        } catch { }
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
}
