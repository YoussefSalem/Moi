import { useEffect, useRef, useState } from "react";
import { ENABLE_APPLE_PAY } from "@/config/features";

declare global {
  interface Window {
    Pixel?: new (config: Record<string, unknown>) => unknown;
  }
}

interface PaymobPixelApplePayProps {
  lines: Array<{ variantId: string; quantity: number }>;
  totalEGP: number;
  cartId?: string;
  discountCode?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onSuccess?: (intentId?: string) => void;
  onCancel?: () => void;
  onError?: (msg: string) => void;
}

const FREE_SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 50;

export function PaymobPixelApplePay({
  lines,
  totalEGP,
  cartId,
  discountCode,
  disabled = false,
  className,
  style,
  onSuccess,
  onCancel,
  onError,
}: PaymobPixelApplePayProps) {
  const [available, setAvailable] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const intentIdRef = useRef<string | null>(null);
  const containerIdRef = useRef(`pmb-ap-${Math.random().toString(36).slice(2, 10)}`);

  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const AP = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setAvailable(!!(AP?.canMakePayments?.()));
  }, []);

  const linesKey = lines.map((l) => `${l.variantId}:${l.quantity}`).join(",");

  useEffect(() => {
    if (!available || disabled || !linesKey || totalEGP <= 0) return;

    let cancelled = false;

    const subtotal = cartId ? totalEGP : totalEGP;
    const finalTotal = cartId
      ? totalEGP
      : totalEGP + (totalEGP >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);

    fetch("/api/orders/paymob-apple-pay-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines,
        totalAmountCents: Math.round(finalTotal * 100),
        cartId: cartId || undefined,
        discountCode: discountCode || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data: { clientSecret?: string; publicKey?: string; intentId?: string; error?: string }) => {
        if (cancelled) return;
        if (!data.clientSecret || !data.publicKey) return;
        intentIdRef.current = data.intentId ?? null;
        setClientSecret(data.clientSecret);
        setPublicKey(data.publicKey);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [available, disabled, linesKey, totalEGP, cartId, discountCode]);

  useEffect(() => {
    if (disabled) {
      setClientSecret(null);
      setPublicKey(null);
      setInitialized(false);
      intentIdRef.current = null;
    }
  }, [disabled]);

  useEffect(() => {
    if (!clientSecret || !publicKey || !available) return;

    const containerId = containerIdRef.current;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tryInit = () => {
      if (!window.Pixel) return false;
      const el = document.getElementById(containerId);
      if (!el) return false;

      el.innerHTML = "";

      try {
        new window.Pixel({
          publicKey,
          clientSecret,
          paymentMethods: ["apple-pay"],
          elementId: containerId,
          disablePay: false,
          showSaveCard: false,
          forceSaveCard: false,
          afterPaymentComplete: async (response: unknown) => {
            const r = response as Record<string, unknown>;
            if (r?.success === false) {
              onErrorRef.current?.("Payment was declined. Please try again.");
            } else {
              onSuccessRef.current?.(intentIdRef.current ?? undefined);
            }
          },
          onPaymentCancel: () => {
            onCancelRef.current?.();
          },
        });
        setInitialized(true);
        return true;
      } catch {
        return false;
      }
    };

    if (!tryInit()) {
      intervalId = setInterval(() => {
        if (tryInit()) {
          if (intervalId) clearInterval(intervalId);
        }
      }, 150);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [clientSecret, publicKey, available]);

  if (!ENABLE_APPLE_PAY || !available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <div
        id={containerIdRef.current}
        style={{ minHeight: initialized ? undefined : 44, width: "100%" }}
      />
    </div>
  );
}
