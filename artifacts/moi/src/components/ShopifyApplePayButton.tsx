import { useState, useEffect } from "react";

const SHIPPING_EGP = 50;

/* ApplePaySession minimal type stubs — avoids needing @types/apple-pay-js */
type APSession = {
  onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((e: APAuthorizedEvent) => void) | null;
  oncancel: (() => void) | null;
  completeMerchantValidation(session: unknown): void;
  completePayment(status: number): void;
  abort(): void;
  begin(): void;
};
type APCtor = {
  new (version: number, request: object): APSession;
  canMakePayments(): boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
};
type APAuthorizedEvent = {
  payment: {
    token: { paymentData: unknown };
    shippingContact?: {
      givenName?: string; familyName?: string; emailAddress?: string;
      phoneNumber?: string; addressLines?: string[];
      locality?: string; administrativeArea?: string;
    };
  };
};

function getAP(): APCtor | null {
  return (window as unknown as { ApplePaySession?: APCtor }).ApplePaySession ?? null;
}

/* CSS via <style> so -apple-pay-button-type/style custom props reach -webkit-appearance */
const BTN_CSS = `
  .ap-express-btn {
    -webkit-appearance: -apple-pay-button;
    -apple-pay-button-type: plain;
    -apple-pay-button-style: black;
    display: block; width: 100%; height: 56px;
    border: none; cursor: pointer; border-radius: 10px;
  }
  .ap-express-btn:disabled { opacity: 0.55; cursor: default; }
`;

export interface ShopifyApplePayButtonProps {
  /** Product-page express buy (single item). */
  variantId?: string;
  quantity?: number;
  priceEGP?: number;

  /** Cart / checkout: all items + pre-shipping total. */
  lines?: Array<{ variantId: string; quantity: number }>;
  totalEGP?: number;

  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ShopifyApplePayButton({
  variantId, quantity = 1, priceEGP,
  lines: cartLines, totalEGP,
  disabled = false, className, style,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const AP = getAP();
    setAvailable(!!(AP?.canMakePayments()));
  }, []);

  /* ApplePaySession.begin() MUST be called synchronously inside the click handler.
     All async work goes into session callbacks (onvalidatemerchant / onpaymentauthorized). */
  const handlePay = () => {
    const AP = getAP();
    if (!AP || processing) return;

    let lines: Array<{ variantId: string; quantity: number }>;
    let total: number;

    if (variantId && priceEGP != null) {
      lines = [{ variantId, quantity }];
      total = priceEGP * quantity + SHIPPING_EGP;
    } else if (cartLines && cartLines.length > 0 && totalEGP != null) {
      lines = cartLines;
      total = totalEGP + SHIPPING_EGP;
    } else {
      return;
    }

    const totalAmountCents = Math.round(total * 100);

    const paymentRequest = {
      countryCode: "EG",
      currencyCode: "EGP",
      merchantCapabilities: ["supports3DS"],
      supportedNetworks: ["visa", "masterCard"],
      total: { label: "Moi", amount: total.toFixed(2) },
      lineItems: [
        { label: "Subtotal", amount: (total - SHIPPING_EGP).toFixed(2) },
        { label: "Shipping", amount: SHIPPING_EGP.toFixed(2) },
      ],
      requiredShippingContactFields: ["email", "phone", "postalAddress", "name"],
    };

    const session = new AP(3, paymentRequest);

    /* Stored between onvalidatemerchant → onpaymentauthorized */
    let intentId: string | undefined;
    let paymobPaymentKey: string | undefined;

    session.onvalidatemerchant = async ({ validationURL }) => {
      try {
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validationURL, lines, totalAmountCents }),
        });
        const data = await res.json() as {
          merchantSession?: unknown; intentId?: string;
          paymobPaymentKey?: string; error?: string;
        };
        if (!res.ok || !data.merchantSession) {
          session.abort();
          setProcessing(false);
          return;
        }
        intentId = data.intentId;
        paymobPaymentKey = data.paymobPaymentKey;
        session.completeMerchantValidation(data.merchantSession);
      } catch {
        session.abort();
        setProcessing(false);
      }
    };

    session.onpaymentauthorized = async (event) => {
      if (!intentId || !paymobPaymentKey) {
        session.completePayment(AP.STATUS_FAILURE);
        setProcessing(false);
        return;
      }
      try {
        const sc = event.payment.shippingContact ?? {};
        const res = await fetch("/api/apple-pay/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentData: JSON.stringify(event.payment.token.paymentData),
            intentId,
            paymobPaymentKey,
            shippingContact: {
              firstName: sc.givenName ?? "",
              lastName: sc.familyName ?? "",
              email: sc.emailAddress ?? "",
              phone: sc.phoneNumber ?? "",
              address: (sc.addressLines ?? []).join(", "),
              city: sc.locality ?? "Cairo",
              governorate: sc.administrativeArea ?? "",
            },
          }),
        });
        const result = await res.json() as { success?: boolean; error?: string };
        session.completePayment(result.success ? AP.STATUS_SUCCESS : AP.STATUS_FAILURE);
        if (result.success) {
          /* Brief delay lets the system sheet animate out before navigating */
          setTimeout(() => { window.location.href = "/?paid=1"; }, 800);
        }
      } catch {
        session.completePayment(AP.STATUS_FAILURE);
      } finally {
        setProcessing(false);
      }
    };

    session.oncancel = () => setProcessing(false);

    /* begin() must be synchronous in click handler — above callbacks are async-safe */
    session.begin();
    setProcessing(true);
  };

  if (!available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />
      <p style={{
        margin: "0 0 10px", fontSize: 13, color: "#6b7280",
        textAlign: "center", letterSpacing: "0.02em", fontFamily: "inherit",
      }}>
        Express checkout
      </p>
      <button
        type="button"
        className="ap-express-btn"
        onClick={handlePay}
        disabled={processing}
        aria-label="Buy with Apple Pay"
      />
    </div>
  );
}
