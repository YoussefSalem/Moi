import { useEffect, useRef, useState } from "react";

interface CartItem {
  id?: string;
  title: string;
  variantTitle?: string | null;
  quantity: number;
  image?: string | null;
  price?: string;
}

interface BreakdownSnapshot {
  subtotal: number;
  savings: number;
  shippingCost: number;
  freeShipping: boolean;
}

interface PaymentSuccessPageProps {
  intentId: string;
  onContinueShopping: () => void;
}

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("de-DE")} EGP`;
}

interface PaymentSuccessPageProps {
  intentId: string;
  txnId?: string;
  onContinueShopping: () => void;
}

export function PaymentSuccessPage({ intentId, txnId, onContinueShopping }: PaymentSuccessPageProps) {
  const [shopifyOrderNumber, setShopifyOrderNumber] = useState<number | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState<string>("");
  const [breakdown, setBreakdown] = useState<BreakdownSnapshot | null>(null);
  const syncCalledRef = useRef(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    const itemsRaw = sessionStorage.getItem("moi_paymob_items");
    const totalRaw = sessionStorage.getItem("moi_paymob_order_total");
    const breakdownRaw = sessionStorage.getItem("moi_paymob_breakdown");

    const paymentMethodRaw = sessionStorage.getItem("moi_paymob_payment_method") ?? "card";
    let parsedItems: CartItem[] = [];
    let parsedBreakdown: BreakdownSnapshot | null = null;

    if (itemsRaw) {
      try { parsedItems = JSON.parse(itemsRaw) as CartItem[]; setItems(parsedItems); } catch { /* ignore */ }
    }
    if (totalRaw) setTotal(totalRaw);
    if (breakdownRaw) {
      try { parsedBreakdown = JSON.parse(breakdownRaw) as BreakdownSnapshot; setBreakdown(parsedBreakdown); } catch { /* ignore */ }
    }

    // Redirect to /ordermade, passing data via sessionStorage so the unified page handles it
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      if (parsedBreakdown || parsedItems.length > 0) {
        try {
          sessionStorage.setItem("moi_order_confirmation", JSON.stringify({
            items: parsedItems,
            breakdown: parsedBreakdown ?? { subtotal: 0, savings: 0, shippingCost: 0, freeShipping: false },
            paymentMethod: paymentMethodRaw,
            intentId: intentId || undefined,
          }));
        } catch { /* ignore */ }
      }
      const search = new URLSearchParams();
      if (intentId) search.set("intentId", intentId);
      if (txnId) search.set("txnId", txnId);
      const dest = `/ordermade${search.toString() ? `?${search.toString()}` : ""}`;
      window.history.replaceState(null, "", dest);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }

    // Clear all Paymob session keys upfront so CheckoutPage's mount-only effect
    // doesn't find moi_paymob_result and reopen the checkout overlay on this page.
    ["moi_paymob_items", "moi_paymob_order_total", "moi_paymob_breakdown",
     "moi_paymob_intent_id", "moi_checkout_form", "moi_paymob_result"].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    if (!intentId) return;
    if (syncCalledRef.current) return;
    syncCalledRef.current = true;

    fetch("/api/orders/paymob-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId, ...(txnId ? { paymobTxnId: txnId } : {}) }),
    }).catch(() => {});
  }, [intentId, txnId]);

  useEffect(() => {
    if (!intentId) return;
    if (shopifyOrderNumber) return;

    let cancelled = false;
    let attempts = 0;
    const MAX = 15;

    const run = async () => {
      while (!cancelled && attempts < MAX) {
        attempts++;
        await new Promise<void>((r) => setTimeout(r, 2000));
        if (cancelled) break;
        try {
          const res = await fetch(`/api/orders/paymob-status/${intentId}`, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json() as { status: string; shopifyOrderNumber?: number | null };
          if (data.shopifyOrderNumber) {
            setShopifyOrderNumber(data.shopifyOrderNumber);
            break;
          }
        } catch { /* keep polling */ }
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [intentId, shopifyOrderNumber]);

  const handleContinue = () => {
    ["moi_paymob_result", "moi_paymob_items", "moi_paymob_order_total", "moi_paymob_breakdown", "moi_paymob_intent_id"].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
    onContinueShopping();
  };

  return <div style={{ minHeight: "100vh", backgroundColor: "#faf8f5" }} />;
}
