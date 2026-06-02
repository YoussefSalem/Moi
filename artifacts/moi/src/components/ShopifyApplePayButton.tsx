import { useCallback } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    ApplePaySession?: {
      new (version: number, request: ApplePayPaymentRequest): ApplePaySessionInstance;
      canMakePayments(): boolean;
      readonly STATUS_SUCCESS: number;
      readonly STATUS_FAILURE: number;
    };
  }
}

interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  total: { label: string; amount: string; type?: "final" | "pending" };
  requiredShippingContactFields?: string[];
  requiredBillingContactFields?: string[];
}

interface ApplePayContact {
  givenName?: string;
  familyName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  addressLines?: string[];
  locality?: string;
  postalCode?: string;
  administrativeArea?: string;
  country?: string;
  countryCode?: string;
}

interface ApplePayPaymentToken {
  paymentData: unknown;
  paymentMethod?: { displayName?: string; network?: string };
  transactionIdentifier?: string;
}

interface ApplePayPayment {
  token: ApplePayPaymentToken;
  billingContact?: ApplePayContact;
  shippingContact?: ApplePayContact;
}

interface ApplePaySessionInstance {
  onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((event: { payment: ApplePayPayment }) => void) | null;
  oncancel: (() => void) | null;
  begin(): void;
  abort(): void;
  completeMerchantValidation(merchantSession: unknown): void;
  completePayment(status: number): void;
}

export interface ShopifyApplePayButtonProps {
  lines: { variantId: string; quantity: number }[];
  totalAmount: string;
  currencyCode: string;
  label?: string;
  discountCode?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onSuccess?: (orderNumber: number | null) => void;
  onFail?: (error: string) => void;
  onCancel?: () => void;
}

export function ShopifyApplePayButton({
  lines,
  totalAmount,
  currencyCode,
  label = "Moi",
  discountCode,
  disabled = false,
  className,
  style,
  onSuccess,
  onFail,
  onCancel,
}: ShopifyApplePayButtonProps) {
  const handleClick = useCallback(() => {
    const ApplePaySession = window.ApplePaySession;
    if (!ApplePaySession) {
      toast.error("Apple Pay is not available on this device.");
      return;
    }

    const totalAmountCents = Math.round(parseFloat(totalAmount) * 100);

    const paymentRequest: ApplePayPaymentRequest = {
      countryCode: "EG",
      currencyCode,
      supportedNetworks: ["visa", "masterCard", "amex", "mada"],
      merchantCapabilities: ["supports3DS"],
      total: { label, amount: totalAmount, type: "final" },
      requiredShippingContactFields: ["postalAddress", "name", "email", "phone"],
      requiredBillingContactFields: ["postalAddress", "name"],
    };

    let session: ApplePaySessionInstance;
    try {
      session = new ApplePaySession(3, paymentRequest);
    } catch {
      toast.error("Apple Pay could not be started. Please try another payment method.");
      return;
    }

    let intentId: string | null = null;
    let paymobPaymentKey: string | null = null;
    let validationStarted = false;
    let paymentAuthorized = false;

    session.onvalidatemerchant = async (event) => {
      validationStarted = true;
      try {
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validationURL: event.validationURL,
            lines,
            totalAmountCents,
            discountCode: discountCode ?? undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          const errMsg = data.error ?? "Merchant validation failed — please try another payment method";
          session.abort();
          onFail?.(errMsg);
          toast.error(errMsg);
          return;
        }

        const data = await res.json() as {
          merchantSession: unknown;
          intentId: string;
          paymobPaymentKey: string;
          total: string;
          shippingEGP: number;
        };

        intentId = data.intentId;
        paymobPaymentKey = data.paymobPaymentKey;

        session.completeMerchantValidation(data.merchantSession);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Apple Pay is unavailable. Please try another payment method.";
        session.abort();
        onFail?.(msg);
        toast.error(msg);
      }
    };

    session.onpaymentauthorized = async (event) => {
      paymentAuthorized = true;
      try {
        if (!intentId || !paymobPaymentKey) {
          throw new Error("Payment session not ready. Please try again.");
        }

        const sc = event.payment.shippingContact;
        const shippingContact = {
          firstName: sc?.givenName?.trim() || "NA",
          lastName: sc?.familyName?.trim() || "NA",
          email: sc?.emailAddress?.trim() || undefined,
          phone: sc?.phoneNumber?.trim() || "NA",
          address: sc?.addressLines?.[0]?.trim() || "NA",
          city: sc?.locality?.trim() || "Cairo",
          governorate: sc?.administrativeArea?.trim() || "NA",
        };

        const paymentData = btoa(JSON.stringify(event.payment.token.paymentData));

        const res = await fetch("/api/apple-pay/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentData, intentId, paymobPaymentKey, shippingContact }),
        });

        const data = await res.json() as {
          success: boolean;
          error?: string;
          txnId?: string;
          shopifyOrderId?: string | null;
          shopifyOrderNumber?: string | null;
          total?: string;
        };

        if (!data.success) {
          const errMsg = data.error ?? "Payment was declined. Please try another card.";
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          onFail?.(errMsg);
          toast.error(errMsg);
          return;
        }

        session.completePayment(ApplePaySession.STATUS_SUCCESS);

        const orderNum = data.shopifyOrderNumber ? parseInt(data.shopifyOrderNumber, 10) : null;
        onSuccess?.(isNaN(orderNum as number) ? null : orderNum);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Payment could not be processed. Please try again.";
        session.completePayment(ApplePaySession.STATUS_FAILURE);
        onFail?.(msg);
        toast.error(msg);
      }
    };

    session.oncancel = () => {
      if (paymentAuthorized) return;
      if (!validationStarted) {
        const msg = "Apple Pay is not active on this domain yet. Please register buy-moi.com in Shopify Admin → Settings → Payments → Apple Pay, then try again.";
        onFail?.(msg);
        toast.error(msg, { duration: 10_000 });
      } else {
        onCancel?.();
      }
    };

    session.begin();
  }, [lines, totalAmount, currencyCode, label, discountCode, onSuccess, onFail, onCancel]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{
        WebkitAppearance: "none",
        appearance: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        background: "#000",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "0 24px",
        height: 48,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        fontSize: 17,
        fontWeight: 500,
        letterSpacing: "-0.02em",
        gap: 6,
        width: "100%",
        ...style,
      }}
      aria-label="Buy with Apple Pay"
    >
      <svg viewBox="0 0 24 10" height="18" fill="currentColor" aria-hidden="true">
        <path d="M4.47 0C3.7.03 2.7.52 2.12 1.2 1.6 1.8 1.17 2.7 1.3 3.57c.87.07 1.75-.42 2.3-1.1.53-.65.9-1.55.87-2.47zM4.52 3.7C3.25 3.63 2.16 4.43 1.56 4.43c-.61 0-1.54-.67-2.55-.65C-2.3 3.8-3.6 4.5-4.3 5.66c-1.44 2.47-.38 6.15 1.02 8.16.68.98 1.5 2.07 2.56 2.03 1.02-.04 1.4-.65 2.63-.65 1.22 0 1.57.65 2.63.63 1.1-.02 1.8-1 2.48-1.98.77-1.12 1.09-2.2 1.11-2.26-.02-.02-2.13-.82-2.15-3.26-.02-2.04 1.67-3.02 1.75-3.08-.97-1.4-2.46-1.55-2.96-1.58z" transform="translate(5,0)"/>
      </svg>
      Pay
    </button>
  );
}
