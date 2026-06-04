import { useState, useEffect, useRef, useCallback } from "react";

const BTN_CSS = `
  .ap-express-btn {
    -webkit-appearance: -apple-pay-button;
    -apple-pay-button-type: buy;
    -apple-pay-button-style: black;
    display: block; width: 100%; height: 56px;
    border: none; cursor: pointer; border-radius: 10px;
  }
  .ap-express-btn:disabled { opacity: 0.55; cursor: default; }
`;

// ── Minimal ApplePaySession types ────────────────────────────────────────────

interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  requiredShippingContactFields?: string[];
  total: { label: string; amount: string };
}
interface ApplePayContact {
  givenName?: string;
  familyName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
}
interface ApplePayToken { paymentData: unknown }
interface ApplePayPayment {
  token: ApplePayToken;
  shippingContact?: ApplePayContact;
}
interface APSession {
  onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((e: { payment: ApplePayPayment }) => void) | null;
  onshippingmethodselected: ((e: { shippingMethod: { amount: string } }) => void) | null;
  oncancel: (() => void) | null;
  completeMerchantValidation(sess: unknown): void;
  completePayment(result: { status: number }): void;
  completeShippingMethodSelection(result: { status: number; newTotal: unknown; newLineItems: unknown[] }): void;
  abort(): void;
  begin(): void;
}
interface APSessionCtor {
  new(version: number, request: ApplePayPaymentRequest): APSession;
  canMakePayments(): boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
}

function getAP(): APSessionCtor | undefined {
  return (window as unknown as { ApplePaySession?: APSessionCtor }).ApplePaySession;
}

// ── Component ────────────────────────────────────────────────────────────────

export interface ShopifyApplePayButtonProps {
  variantId?: string;
  quantity?: number;
  priceEGP?: number;
  lines?: Array<{ variantId: string; quantity: number }>;
  totalEGP?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  discountCode?: string;
  onSuccess?: (orderNumber: number | null, total?: string) => void;
  onCancel?: () => void;
  onError?: (msg: string) => void;
}

export function ShopifyApplePayButton({
  variantId, quantity = 1, priceEGP,
  lines: cartLines, totalEGP,
  disabled = false, className, style,
  discountCode,
  onSuccess, onCancel, onError,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intentIdRef = useRef<string | null>(null);
  const shippingContactRef = useRef<{ firstName?: string; lastName?: string; email?: string; phone?: string; address?: string; city?: string; governorate?: string } | undefined>(undefined);

  useEffect(() => {
    const AP = getAP();
    setAvailable(!!(AP?.canMakePayments?.()));
  }, []);

  // ── handlePay is intentionally synchronous ──────────────────────────────
  // ApplePaySession.begin() MUST be called in the same synchronous call-stack
  // as the user gesture (click). All async work happens inside session callbacks.
  const handlePay = useCallback(() => {
    if (busy || disabled) return;

    let lines: Array<{ variantId: string; quantity: number }>;
    let totalCents: number;
    let totalEGPVal: number;

    if (variantId && priceEGP != null) {
      lines = [{ variantId, quantity }];
      totalEGPVal = priceEGP * quantity;
      totalCents = Math.round(totalEGPVal * 100);
    } else if (cartLines && cartLines.length > 0 && totalEGP != null) {
      lines = cartLines;
      totalEGPVal = totalEGP;
      totalCents = Math.round(totalEGP * 100);
    } else {
      return;
    }

    const AP = getAP();
    if (!AP) return;

    const shippingEGP = totalEGPVal >= 2000 ? 0 : 50;
    const shippingCents = Math.round(shippingEGP * 100);
    const totalWithShippingCents = totalCents + shippingCents;

    const session = new AP(3, {
      countryCode: "EG",
      currencyCode: "EGP",
      supportedNetworks: ["visa", "masterCard", "amex", "mada"],
      merchantCapabilities: ["supports3DS"],
      requiredShippingContactFields: ["postalAddress", "name", "email", "phone"],
      shippingType: "shipping",
      shippingMethods: [{
        label: "Standard",
        detail: shippingEGP === 0 ? "Free shipping on orders over 2,000 EGP" : "Delivery within 2-4 days",
        amount: shippingEGP.toFixed(2),
        identifier: "standard-shipping",
      }],
      lineItems: [
        { label: "Subtotal", amount: totalEGPVal.toFixed(2), type: "final" },
        { label: "Shipping", amount: shippingEGP.toFixed(2), type: "final" },
      ],
      total: { label: "Moi", amount: (totalWithShippingCents / 100).toFixed(2) },
    });

    intentIdRef.current = null;
    setBusy(true);
    setError(null);

    session.onshippingmethodselected = ({ shippingMethod }) => {
      session.completeShippingMethodSelection({
        status: AP.STATUS_SUCCESS,
        newTotal: { label: "Moi", amount: (totalWithShippingCents / 100).toFixed(2) },
        newLineItems: [
          { label: "Subtotal", amount: totalEGPVal.toFixed(2), type: "final" },
          { label: "Shipping", amount: shippingMethod.amount, type: "final" },
        ],
      });
    };

    session.onshippingcontactselected = async ({ shippingContact }) => {
      const contact = (shippingContact as {
        addressLines?: string[]; locality?: string; administrativeArea?: string;
        givenName?: string; familyName?: string; emailAddress?: string; phoneNumber?: string;
      }) ?? undefined;
      shippingContactRef.current = contact ? {
        firstName: contact.givenName,
        lastName: contact.familyName,
        email: contact.emailAddress,
        phone: contact.phoneNumber,
        address: contact.addressLines?.[0],
        city: contact.locality,
        governorate: contact.administrativeArea,
      } : undefined;
      const shippingDetail = totalEGPVal >= 2000 ? "Free shipping on orders over 2,000 EGP" : "Delivery within 2-4 days";
      const shippingAmt = totalEGPVal >= 2000 ? 0 : 50;
      const newTotalCents = Math.round(totalEGPVal * 100) + Math.round(shippingAmt * 100);
      (session as unknown as {
        completeShippingContactSelection(result: {
          status: number; newShippingMethods: unknown[]; newTotal: unknown; newLineItems: unknown[];
        }): void;
      }).completeShippingContactSelection({
        status: AP.STATUS_SUCCESS,
        newShippingMethods: [{
          label: "Standard", detail: shippingDetail, amount: shippingAmt.toFixed(2), identifier: "standard-shipping",
        }],
        newTotal: { label: "Moi", amount: (newTotalCents / 100).toFixed(2) },
        newLineItems: [
          { label: "Subtotal", amount: totalEGPVal.toFixed(2), type: "final" },
          { label: "Shipping", amount: shippingAmt.toFixed(2), type: "final" },
        ],
      });
    };

    session.onvalidatemerchant = async ({ validationURL }) => {
      try {
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validationURL, lines, totalAmountCents: totalWithShippingCents, discountCode }),
        });
        const data = await res.json() as { merchantSession?: unknown; intentId?: string; error?: string };
        if (!res.ok || !data.merchantSession) throw new Error(data.error ?? "Merchant validation failed");
        intentIdRef.current = data.intentId ?? null;
        session.completeMerchantValidation(data.merchantSession);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Apple Pay is unavailable.";
        session.abort();
        setError(msg);
        setBusy(false);
        onError?.(msg);
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
            intentId: intentIdRef.current,
            shippingContact: shippingContactRef.current ?? (sc ? {
              firstName: sc.givenName,
              lastName: sc.familyName,
              email: sc.emailAddress,
              phone: sc.phoneNumber,
              address: sc.addressLines?.[0],
              city: sc.locality,
              governorate: sc.administrativeArea,
            } : undefined),
          }),
        });
        const data = await res.json() as {
          success?: boolean;
          error?: string;
          shopifyOrderNumber?: number | null;
          total?: string;
        };
        if (data.success) {
          session.completePayment({ status: AP.STATUS_SUCCESS });
          const totalStr = data.total ?? `${Math.round(totalEGPVal + (totalEGPVal >= 2000 ? 0 : 50))} EGP`;
          onSuccess?.(data.shopifyOrderNumber ?? null, totalStr);
        } else {
          session.completePayment({ status: AP.STATUS_FAILURE });
          const msg = data.error ?? "Payment was declined. Please try another card.";
          setError(msg);
          onCancel?.();
        }
      } catch {
        session.completePayment({ status: AP.STATUS_FAILURE });
        setError("Payment failed. Please try again.");
        onCancel?.();
      }
      setBusy(false);
    };

    session.oncancel = () => {
      setBusy(false);
      onCancel?.();
    };

    session.begin();
  }, [busy, disabled, variantId, quantity, priceEGP, cartLines, totalEGP, discountCode, onSuccess, onCancel, onError]);

  if (!available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />

      <p style={{
        margin: "0 0 10px", fontSize: 13, color: "#6b7280",
        textAlign: "center", letterSpacing: "0.02em", fontFamily: "inherit",
      }}>
        {busy ? "Processing\u2026" : "Express checkout"}
      </p>
      <button
        type="button"
        className="ap-express-btn"
        onClick={handlePay}
        disabled={busy}
        aria-label="Buy with Apple Pay"
      />
      {error && (
        <p style={{
          marginTop: 8, fontSize: 11, color: "rgba(30,24,20,0.6)",
          textAlign: "center", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.03em",
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
