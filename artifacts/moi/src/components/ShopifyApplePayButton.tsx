import { useState, useEffect, useRef, useCallback } from "react";

const SHIPPING_FEE = 50;
const FREE_SHIPPING_THRESHOLD = 2000;


interface ApplePayLineItem {
  label: string;
  amount: string;
  type?: string;
}
interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  requiredShippingContactFields?: string[];
  lineItems?: ApplePayLineItem[];
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
  onMoreOptions?: () => void;
}

export function ShopifyApplePayButton({
  variantId, quantity = 1, priceEGP,
  lines: cartLines, totalEGP,
  disabled = false, className, style,
  discountCode,
  onSuccess, onCancel, onError, onMoreOptions,
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
    let subtotalEGP: number;

    if (variantId && priceEGP != null) {
      lines = [{ variantId, quantity }];
      subtotalEGP = priceEGP * quantity;
    } else if (cartLines && cartLines.length > 0 && totalEGP != null) {
      lines = cartLines;
      subtotalEGP = totalEGP;
    } else {
      return;
    }

    const isFreeShipping = subtotalEGP >= FREE_SHIPPING_THRESHOLD;
    const shippingAmt = isFreeShipping ? 0 : SHIPPING_FEE;
    const grandTotalEGP = subtotalEGP + shippingAmt;
    const grandTotalCents = Math.round(grandTotalEGP * 100);

    const AP = getAP();
    if (!AP) return;

    const lineItems: ApplePayLineItem[] = shippingAmt > 0
      ? [{ label: "Shipping", amount: shippingAmt.toFixed(2) }]
      : [];

    // version 4 required for lineItems; type on lineItems requires v14+ so omit it
    const session = new AP(4, {
      countryCode: "EG",
      currencyCode: "EGP",
      supportedNetworks: ["visa", "masterCard"],
      merchantCapabilities: ["supports3DS"],
      requiredShippingContactFields: ["name", "email", "phone"],
      lineItems,
      total: { label: "Moi", amount: (grandTotalCents / 100).toFixed(2) },
    });

    intentIdRef.current = null;
    setBusy(true);
    setError(null);

    session.onvalidatemerchant = async ({ validationURL }) => {
      try {
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validationURL, lines, totalAmountCents: grandTotalCents, discountCode }),
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
          const totalStr = `${Math.round(grandTotalEGP)} EGP`;
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
      <button
        type="button"
        onClick={handlePay}
        disabled={busy}
        aria-label="Buy with Apple Pay"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          width: "100%",
          height: "44px",
          backgroundColor: "#000",
          border: "none",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.5 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: "13px",
          fontWeight: 200,
          letterSpacing: "0.08em",
          color: "#fff",
          lineHeight: 1,
        }}>
          Buy with
        </span>
        <svg viewBox="0 0 814 1000" width="14" height="14" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0, marginTop: "-1px" }}>
          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.2 135.4-316.7 269-316.7 70.8 0 129.9 43.1 172.8 43.1 42.2 0 108.1-45.6 190.5-45.6 30.5 0 110.7 2.6 170.3 65.8zm-108.2-170.7c-55.4 59.2-132.7 84.5-210 84.5-15.5 0-31-1.5-42.8-2.8 4.8-71.6 51.6-141.4 108-192.2 56.4-50.8 138.2-84.5 215.4-88.7 2.5 13.5 3.2 27.1 3.2 39.5 0 62.3-27 133.2-73.8 159.7z"/>
        </svg>
        <span style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: "13px",
          fontWeight: 200,
          letterSpacing: "0.08em",
          color: "#fff",
          lineHeight: 1,
        }}>
          Pay
        </span>
      </button>

      {error && (
        <p style={{
          marginTop: 9,
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
