import { useCallback } from "react";
import { toast } from "sonner";
import {
  checkoutCreate,
  checkoutCompleteWithTokenizedPayment,
  pollCheckoutPayment,
  SHOPIFY_CONFIGURED,
} from "@/lib/shopify";

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

export function canUseApplePay(): boolean {
  return (
    typeof window !== "undefined" &&
    "ApplePaySession" in window &&
    !!(window.ApplePaySession?.canMakePayments?.())
  );
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
    if (!SHOPIFY_CONFIGURED) {
      toast.error("Shop is not configured. Please try another payment method.");
      return;
    }

    const ApplePaySession = window.ApplePaySession;
    if (!ApplePaySession) {
      toast.error("Apple Pay is not available on this device.");
      return;
    }

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

    let checkoutId: string | null = null;
    let checkoutWebUrl: string | null = null;
    let resolvedTotal: string = totalAmount;

    session.onvalidatemerchant = async (event) => {
      try {
        const checkout = await checkoutCreate(
          lines,
          discountCode,
        );
        checkoutId = checkout.id;
        checkoutWebUrl = checkout.webUrl;
        resolvedTotal = checkout.totalPriceV2.amount;

        const res = await fetch("/api/apple-pay/shopify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validationURL: event.validationURL,
            checkoutWebUrl: checkout.webUrl,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? "Merchant validation failed");
        }

        const { merchantSession } = await res.json() as { merchantSession: unknown };
        session.completeMerchantValidation(merchantSession);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Merchant validation failed";
        session.abort();
        onFail?.(msg);
        toast.error(msg);
      }
    };

    session.onpaymentauthorized = async (event) => {
      try {
        if (!checkoutId) throw new Error("Checkout not ready");

        const shipping = event.payment.shippingContact;
        const billing = event.payment.billingContact ?? shipping;

        const billingAddress = {
          firstName: billing?.givenName?.trim() || "Apple",
          lastName: billing?.familyName?.trim() || "Pay",
          address1: billing?.addressLines?.[0]?.trim() || shipping?.addressLines?.[0]?.trim() || "NA",
          address2: billing?.addressLines?.[1]?.trim() ?? undefined,
          city: billing?.locality?.trim() || shipping?.locality?.trim() || "Cairo",
          province: billing?.administrativeArea?.trim() ?? shipping?.administrativeArea?.trim() ?? undefined,
          zip: billing?.postalCode?.trim() ?? shipping?.postalCode?.trim() ?? undefined,
          country: billing?.country?.trim() || shipping?.country?.trim() || "Egypt",
          phone: shipping?.phoneNumber?.trim() ?? undefined,
        };

        const paymentData = btoa(
          JSON.stringify(event.payment.token.paymentData),
        );

        const result = await checkoutCompleteWithTokenizedPayment(checkoutId, {
          billingAddress,
          idempotencyKey: crypto.randomUUID(),
          paymentAmount: {
            amount: resolvedTotal,
            currencyCode,
          },
          paymentData,
          type: "APPLE_PAY",
        });

        if (result.error) {
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          onFail?.(result.error);
          toast.error(result.error);
          return;
        }

        let orderNumber = result.orderNumber;
        if (!orderNumber && checkoutId) {
          const polled = await pollCheckoutPayment(checkoutId);
          if (polled.error) {
            session.completePayment(ApplePaySession.STATUS_FAILURE);
            onFail?.(polled.error);
            toast.error(polled.error);
            return;
          }
          orderNumber = polled.orderNumber;
        }

        session.completePayment(ApplePaySession.STATUS_SUCCESS);
        onSuccess?.(orderNumber);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Payment failed";
        session.completePayment(ApplePaySession.STATUS_FAILURE);
        onFail?.(msg);
        toast.error(msg);
      }
    };

    session.oncancel = () => {
      onCancel?.();
    };

    void checkoutWebUrl;
    session.begin();
  }, [lines, totalAmount, currencyCode, label, discountCode, onSuccess, onFail, onCancel]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !SHOPIFY_CONFIGURED}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        width: "100%",
        padding: "14px",
        backgroundColor: "#000",
        color: "#fff",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "-apple-system, 'Helvetica Neue', sans-serif",
        fontSize: "17px",
        fontWeight: 500,
        letterSpacing: "0.01em",
        transition: "opacity 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
    >
      Buy with&nbsp;
      <svg
        viewBox="0 0 814 1000"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="#fff"
        style={{ flexShrink: 0, marginTop: "-1px" }}
        aria-hidden="true"
      >
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.1-38.8-168.4-103.1c-73.9-71.9-134.6-183.3-134.6-290.9 0-195.3 129.4-298.5 256.8-298.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
      </svg>
      Pay
    </button>
  );
}
