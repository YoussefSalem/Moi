import { useState, useEffect, useRef, useCallback } from "react";

const BTN_CSS = `
  .ap-buy-btn {
    -webkit-appearance: -apple-pay-button;
    -apple-pay-button-type: buy;
    -apple-pay-button-style: black;
    display: block;
    width: 100%;
    height: 62px;
    border: none;
    cursor: pointer;
    border-radius: 8px;
  }
  .ap-buy-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

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
  oncancel: (() => void) | null;
  completeMerchantValidation(sess: unknown): void;
  completePayment(result: { status: number }): void;
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

  useEffect(() => {
    const AP = getAP();
    setAvailable(!!(AP?.canMakePayments?.()));
  }, []);

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

    const session = new AP(3, {
      countryCode: "EG",
      currencyCode: "EGP",
      supportedNetworks: ["visa", "masterCard", "amex", "mada"],
      merchantCapabilities: ["supports3DS"],
      requiredShippingContactFields: ["name", "email", "phone"],
      total: { label: "Moi", amount: (totalCents / 100).toFixed(2) },
    });

    intentIdRef.current = null;
    setBusy(true);
    setError(null);

    session.onvalidatemerchant = async ({ validationURL }) => {
      try {
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validationURL, lines, totalAmountCents: totalCents, discountCode }),
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
          total?: string;
        };
        if (data.success) {
          session.completePayment({ status: AP.STATUS_SUCCESS });
          const totalStr = `${Math.round(totalEGPVal)} EGP`;
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
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        ...style,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: BTN_CSS }} />

      <div
        style={{
          boxShadow: busy
            ? "0 2px 8px rgba(0,0,0,0.12)"
            : "0 4px 20px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.14)",
          borderRadius: 8,
          transition: "box-shadow 0.2s ease",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          className="ap-buy-btn"
          onClick={handlePay}
          disabled={busy}
          aria-label="Buy with Apple Pay"
        />
      </div>

      {error && (
        <p style={{
          marginTop: 10,
          fontSize: 11,
          color: "rgba(30,24,20,0.54)",
          textAlign: "center",
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: "0.04em",
          lineHeight: 1.5,
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
