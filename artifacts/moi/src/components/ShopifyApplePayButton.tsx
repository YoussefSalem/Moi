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
      <style dangerouslySetInnerHTML={{ __html: `
        .ap-pay-wrap {
          width: 100%;
          background: transparent;
          padding: 0;
          margin-bottom: 12px;
        }
        .ap-pay-btn {
          -webkit-appearance: -apple-pay-button;
          -apple-pay-button-type: buy;
          -apple-pay-button-style: black;
          width: 100%;
          height: 52px;
          border-radius: 0;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          /* Hard-reset every inherited property that warps native rendering */
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 17px;
          font-weight: 400;
          font-style: normal;
          line-height: normal;
          letter-spacing: normal;
          word-spacing: normal;
          text-transform: none;
          transform: none;
          zoom: 1;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }
        .ap-pay-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
      ` }} />
      <div className="ap-pay-wrap">
        <button
          type="button"
          className="ap-pay-btn"
          onClick={handlePay}
          disabled={busy}
          aria-label="Buy with Apple Pay"
        />
      </div>

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
