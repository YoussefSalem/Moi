import { useState, useEffect, useRef } from "react";

const SHIPPING_FEE = 50;
const FREE_SHIPPING_THRESHOLD = 2000;

// ─── Pixel SDK types ──────────────────────────────────────────────────────────

interface PixelOptions {
  publicKey: string;
  clientSecret: string;
  paymentMethods: string[];
  elementId: string;
  disablePay?: boolean;
  afterPaymentComplete?: (response: Record<string, unknown>) => void | Promise<void>;
  onPaymentCancel?: () => void;
  beforePaymentComplete?: (paymentMethod: string) => Promise<boolean>;
}
type PixelCtor = new (opts: PixelOptions) => void;

// Module-level cache — the SDK script is injected once per page lifetime.
// paymob-pixel is a browser-globals bundle: it sets window.Pixel after loading.
let pixelSdkPromise: Promise<PixelCtor> | null = null;

async function loadPixelSDK(): Promise<PixelCtor> {
  if (pixelSdkPromise) return pixelSdkPromise;
  pixelSdkPromise = new Promise<PixelCtor>((resolve, reject) => {
    // If already loaded by a previous mount (e.g. HMR), resolve immediately.
    const existing = (window as unknown as { Pixel?: PixelCtor }).Pixel;
    if (typeof existing === "function") { resolve(existing); return; }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/paymob-pixel@latest/main.js";
    script.async = true;
    script.onload = () => {
      const Ctor = (window as unknown as { Pixel?: PixelCtor }).Pixel;
      if (typeof Ctor === "function") {
        resolve(Ctor);
      } else {
        reject(new Error("Paymob Pixel SDK: window.Pixel not found after script load"));
      }
    };
    script.onerror = () => reject(new Error("Paymob Pixel SDK: failed to load script"));
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    pixelSdkPromise = null;
    return Promise.reject(err);
  });
  return pixelSdkPromise;
}

// ─── Component ───────────────────────────────────────────────────────────────

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

let _instanceCounter = 0;

export function ShopifyApplePayButton({
  variantId,
  quantity = 1,
  priceEGP,
  lines: cartLines,
  totalEGP,
  disabled = false,
  className,
  style,
  discountCode,
  onSuccess,
  onCancel,
  onError,
}: ShopifyApplePayButtonProps) {
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [reinitKey, setReinitKey] = useState(0);

  const containerIdRef = useRef(`paymob-pixel-ap-${++_instanceCounter}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const initDataRef = useRef<{ intentId: string; total: string } | null>(null);

  // Keep callback refs so they never appear in the init effect's dep array.
  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCancelRef.current = onCancel;
    onErrorRef.current = onError;
  }, [onSuccess, onCancel, onError]);

  // Keep latest cart props in a ref so the init closure always reads current values.
  const propsRef = useRef({ variantId, quantity, priceEGP, cartLines, totalEGP, discountCode });
  useEffect(() => {
    propsRef.current = { variantId, quantity, priceEGP, cartLines, totalEGP, discountCode };
  });

  // Check Apple Pay availability once.
  useEffect(() => {
    const ap = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    setAvailable(!!(ap?.canMakePayments?.()));
  }, []);

  // A stable string key that changes only when the cart content or discount changes.
  // Avoids re-initialising on every render just because parent creates a new array ref.
  const cartKey = [
    variantId ?? "",
    String(quantity),
    String(priceEGP ?? ""),
    cartLines ? cartLines.map((l) => `${l.variantId}:${l.quantity}`).join(",") : "",
    String(totalEGP ?? ""),
    discountCode ?? "",
  ].join("|");

  useEffect(() => {
    if (!available || disabled) return;

    const { variantId: vid, quantity: qty, priceEGP: price, cartLines: cLines, totalEGP: tEGP, discountCode: dc } = propsRef.current;

    let lines: Array<{ variantId: string; quantity: number }>;
    let totalAmountCents: number;
    let grandTotalStr: string;

    if (vid && price != null) {
      const subtotal = price * qty;
      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      const total = subtotal + shipping;
      lines = [{ variantId: vid, quantity: qty }];
      totalAmountCents = Math.round(total * 100);
      grandTotalStr = `${Math.round(total)} EGP`;
    } else if (cLines && cLines.length > 0 && tEGP != null) {
      const shipping = tEGP >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      const total = tEGP + shipping;
      lines = cLines;
      totalAmountCents = Math.round(total * 100);
      grandTotalStr = `${Math.round(total)} EGP`;
    } else {
      return;
    }

    let cancelled = false;
    setStatus("loading");

    void (async () => {
      try {
        if (containerRef.current) containerRef.current.innerHTML = "";

        const [PixelCtor, initRes] = await Promise.all([
          loadPixelSDK(),
          fetch("/api/orders/paymob-apple-pay-init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lines,
              totalAmountCents,
              discountCode: dc ?? null,
            }),
          }).then(async (r) => {
            const d = (await r.json()) as {
              clientSecret?: string;
              publicKey?: string;
              intentId?: string;
              total?: string;
              error?: string;
            };
            if (!r.ok || !d.clientSecret || !d.publicKey || !d.intentId) {
              throw new Error(d.error ?? "Apple Pay is unavailable. Please try another payment method.");
            }
            return d as { clientSecret: string; publicKey: string; intentId: string; total: string };
          }),
        ]);

        if (cancelled) return;

        initDataRef.current = { intentId: initRes.intentId, total: initRes.total };

        new PixelCtor({
          publicKey: initRes.publicKey,
          clientSecret: initRes.clientSecret,
          paymentMethods: ["apple-pay"],
          elementId: containerIdRef.current,
          afterPaymentComplete: async (response) => {
            const isSuccess = response["success"] === true || response["success"] === "true";
            const { intentId, total } = initDataRef.current ?? { intentId: "", total: "" };
            if (isSuccess) {
              const totalStr = total ? `${Math.round(parseFloat(total))} EGP` : grandTotalStr;
              try {
                sessionStorage.setItem(
                  "moi_order_confirmation",
                  JSON.stringify({ paymentMethod: "apple-pay", orderNumber: "" }),
                );
              } catch { /* ignore */ }
              onSuccessRef.current?.(null, totalStr);
              window.history.pushState(null, "", `/order-confirmed?intentId=${encodeURIComponent(intentId)}`);
              window.dispatchEvent(new PopStateEvent("popstate"));
            } else {
              const msg = String(
                response["txnResponseCode"] ??
                  response["message"] ??
                  "Payment was declined. Please try another card.",
              );
              onErrorRef.current?.(msg);
              // Refresh with a new intention so the user can try again.
              setReinitKey((k) => k + 1);
            }
          },
          onPaymentCancel: () => {
            onCancelRef.current?.();
            setReinitKey((k) => k + 1);
          },
        });

        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Apple Pay is unavailable. Please try another payment method.";
          setStatus("error");
          onErrorRef.current?.(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, disabled, cartKey, reinitKey]);

  if (!available || disabled) return null;

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      {status === "loading" && (
        <div
          style={{
            height: 44,
            backgroundColor: "#000",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.72,
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: 11,
              letterSpacing: "0.06em",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Apple Pay
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        id={containerIdRef.current}
        style={{ display: status === "ready" ? "block" : "none", position: "relative" }}
      />
    </div>
  );
}
