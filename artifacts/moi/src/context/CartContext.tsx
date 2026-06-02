import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type ShopifyCart,
  type ShopifyCartLine,
  addCartLines,
  createCart,
  createCartWithLines,
  getCart,
  removeCartLines,
  updateCartLines,
  cartDiscountCodesUpdate,
  formatMoney,
  SHOPIFY_CONFIGURED,
} from "@/lib/shopify";
import { trackAddToCart } from "@/lib/metaPixel";
import { parseEGP } from "@/lib/price";
import { trackTikTokAddToCart } from "@/lib/tiktokPixel";
import {
  trackShopifyAddToCart,
  trackShopifyCartViewed,
  trackShopifyCheckoutStarted,
} from "@/lib/shopifyAnalytics";
import { trackAddToCart as trackInternalAddToCart } from "@/lib/analytics";

const CART_ID_KEY = "moi_cart_id";
const LOCAL_CART_KEY = "moi_local_cart";

export interface LocalCartItem {
  id: string;
  variantId: string;
  title: string;
  price: string;
  priceAmount: number;
  compareAtPrice?: string;
  currencyCode: string;
  image: string | null;
  size?: string;
  color?: string;
  quantity: number;
}

export interface RecoveredItem {
  title: string;
  variant?: string;
  quantity: number;
  price: string;
  imageUrl?: string;
  variantId?: string;
}

export interface AddToCartParams {
  variantId?: string;
  title?: string;
  price?: string;
  priceAmount?: number;
  compareAtPrice?: string;
  currencyCode?: string;
  image?: string | null;
  size?: string;
  color?: string;
  quantity?: number;
}

interface CartContextValue {
  shopifyCart: ShopifyCart | null;
  localItems: LocalCartItem[];
  cartOpen: boolean;
  checkoutOpen: boolean;
  loading: boolean;
  itemCount: number;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: (email?: string) => void;
  closeCheckout: () => void;
  prefilledEmail: string | null;
  addToCart: (params: AddToCartParams) => Promise<void>;
  removeItem: (idOrLineId: string) => Promise<void>;
  updateQuantity: (idOrLineId: string, quantity: number) => Promise<void>;
  applyDiscount: (code: string) => Promise<{ applicable: boolean; code: string; discountAmount: number }>;
  clearCart: () => void;
  replaceRecoveredCart: (items: RecoveredItem[], email?: string) => Promise<void>;
  checkoutUrl: string | null;
  formatShopifyLinePrice: (line: ShopifyCartLine) => string;
  cartTotal: string;
  cartRawTotal: string;
  cartSubtotal: string;
  isShopify: boolean;
}

export const CartContext = createContext<CartContextValue | null>(null);

function loadLocalCart(): LocalCartItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as LocalCartItem[];
    // Migrate items stored before the price-parsing fix.
    // Old code used /[^0-9.]/g so "1.399 EGP" → parseFloat("1.399") = 1.399.
    // New code uses /[^0-9]/g so "1.399 EGP" → parseFloat("1399") = 1399.
    // Always re-parse from the price string so stale cached values are corrected.
    return items.map((item) => {
      if (!item.price) return item;
      const reparsed = parseEGP(item.price);
      if (Number.isFinite(reparsed) && reparsed > 0 && reparsed !== item.priceAmount) {
        return { ...item, priceAmount: reparsed };
      }
      return item;
    });
  } catch {
    return [];
  }
}

function saveLocalCart(items: LocalCartItem[]) {
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [shopifyCart, setShopifyCart] = useState<ShopifyCart | null>(null);
  const [localItems, setLocalItems] = useState<LocalCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [prefilledEmail, setPrefilledEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const initRef = useRef(false);
  const checkoutInitRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setLocalItems(loadLocalCart());
    // Auto-open checkout on initial load if URL is /checkout
    if (typeof window !== "undefined" && window.location.pathname === "/checkout" && !checkoutInitRef.current) {
      checkoutInitRef.current = true;
      setCheckoutOpen(true);
    }
    if (SHOPIFY_CONFIGURED) {
      const savedId = localStorage.getItem(CART_ID_KEY);
      if (savedId) {
        getCart(savedId)
          .then(async (c) => {
            if (!c) { localStorage.removeItem(CART_ID_KEY); return; }
            // Strip any leftover discount codes from a previous session so the
            // cart total always reflects the raw undiscounted price on load.
            const hasAppliedCodes = c.discountCodes.some((d) => d.applicable);
            if (hasAppliedCodes) {
              try {
                const cleaned = await cartDiscountCodesUpdate(c.id, []);
                setShopifyCart(cleaned);
              } catch {
                setShopifyCart(c);
              }
            } else {
              setShopifyCart(c);
            }
          })
          .catch(() => localStorage.removeItem(CART_ID_KEY));
      }
    }
  }, []);

  const ensureShopifyCart = useCallback(async (): Promise<ShopifyCart> => {
    if (shopifyCart) return shopifyCart;
    const newCart = await createCart();
    localStorage.setItem(CART_ID_KEY, newCart.id);
    setShopifyCart(newCart);
    return newCart;
  }, [shopifyCart]);

  const addToCart = useCallback(async (params: AddToCartParams): Promise<void> => {
    const qty = params.quantity ?? 1;
    setLoading(true);
    try {
      // Shopify sync — best-effort; local cart always succeeds regardless
      if (SHOPIFY_CONFIGURED && params.variantId) {
        try {
          const c = await ensureShopifyCart();
          const updated = await addCartLines(c.id, [{ merchandiseId: params.variantId, quantity: qty }]);
          setShopifyCart(updated);
        } catch {
          // Shopify failure must not block local cart; silently fall through
        }
      }
      const key = `${params.variantId ?? params.title ?? "item"}-${params.size ?? ""}`;
      setLocalItems((prev) => {
        const existing = prev.find((i) => i.id === key);
        let updated: LocalCartItem[];
        if (existing) {
          updated = prev.map((i) => i.id === key ? { ...i, quantity: i.quantity + qty } : i);
        } else {
          const newItem: LocalCartItem = {
            id: key,
            variantId: params.variantId ?? key,
            title: params.title ?? "Item",
            price: params.price ?? "",
            priceAmount: params.priceAmount ?? 0,
            compareAtPrice: params.compareAtPrice,
            currencyCode: params.currencyCode ?? "EGP",
            image: params.image ?? null,
            size: params.size,
            color: params.color,
            quantity: qty,
          };
          updated = [...prev, newItem];
        }
        saveLocalCart(updated);
        return updated;
      });
      trackAddToCart({
        content_name: params.title,
        content_ids: params.variantId ? [params.variantId] : undefined,
        currency: params.currencyCode ?? "EGP",
        value: Number.isFinite(params.priceAmount) && (params.priceAmount ?? 0) > 0 ? params.priceAmount : undefined,
        num_items: qty,
      });
      trackInternalAddToCart(
        params.variantId ?? params.title ?? "unknown",
        params.title ?? "Item",
        qty,
        Number.isFinite(params.priceAmount) && params.priceAmount != null ? params.priceAmount : 0
      );
      trackTikTokAddToCart({
        content_name: params.title,
        content_id: params.variantId,
        currency: params.currencyCode,
        value: params.priceAmount,
        quantity: qty,
      });
      // Google Analytics 4 — add_to_cart
      if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "add_to_cart", {
          currency: params.currencyCode ?? "EGP",
          value: Number.isFinite(params.priceAmount) ? params.priceAmount : 0,
          items: [{
            item_id: params.variantId,
            item_name: params.title,
            quantity: qty,
            price: params.priceAmount,
            currency: params.currencyCode ?? "EGP",
          }],
        });
      }
      trackShopifyAddToCart({
        variantId: params.variantId,
        productTitle: params.title ?? "",
        price: Number.isFinite(params.priceAmount) && params.priceAmount != null
          ? params.priceAmount
          : undefined,
        quantity: qty,
        currencyCode: params.currencyCode ?? "EGP",
      });
      setCartOpen(true);
    } finally {
      setLoading(false);
    }
  }, [ensureShopifyCart]);

  const removeItem = useCallback(async (idOrLineId: string) => {
    setLoading(true);
    try {
      if (SHOPIFY_CONFIGURED && shopifyCart) {
        try {
          const updated = await removeCartLines(shopifyCart.id, [idOrLineId]);
          setShopifyCart(updated);
        } catch {
          // line may be local-only
        }
      }
      setLocalItems((prev) => {
        const updated = prev.filter((i) => i.id !== idOrLineId);
        saveLocalCart(updated);
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [shopifyCart]);

  const updateQuantity = useCallback(async (idOrLineId: string, quantity: number) => {
    if (quantity <= 0) { await removeItem(idOrLineId); return; }
    setLoading(true);
    try {
      if (SHOPIFY_CONFIGURED && shopifyCart) {
        try {
          const updated = await updateCartLines(shopifyCart.id, [{ id: idOrLineId, quantity }]);
          setShopifyCart(updated);
        } catch {
          // line may be local-only
        }
      }
      setLocalItems((prev) => {
        const updated = prev.map((i) => i.id === idOrLineId ? { ...i, quantity } : i);
        saveLocalCart(updated);
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [shopifyCart, removeItem]);

  const applyDiscount = useCallback(async (code: string): Promise<{ applicable: boolean; code: string; discountAmount: number }> => {
    if (!SHOPIFY_CONFIGURED) throw new Error("Shopify not configured");
    // Ensure a cart exists first (creates one if necessary) so discount codes
    // can always be applied even when the user only added items via local cart.
    const c = await ensureShopifyCart();
    // Pass [] to clear all codes — Shopify rejects [""] as an invalid code
    const codes = code.trim() ? [code] : [];
    const updated = await cartDiscountCodesUpdate(c.id, codes);
    setShopifyCart(updated);
    const applied = updated.discountCodes.find((d) => d.code === code);

    // The Storefront API may return applicable:false when the cart is empty or
    // when discount codes cannot be pre-evaluated without real line items.
    // Fallback to our backend discount-lookup endpoint which validates the
    // code against the Admin API independently of cart contents.
    if (!applied?.applicable && code.trim()) {
      const localSubtotal = localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);
      if (localSubtotal > 0) {
        try {
          const res = await fetch(
            `/api/orders/discount-lookup?code=${encodeURIComponent(code)}&subtotal=${localSubtotal}`,
          );
          const data = (await res.json()) as {
            applicable?: boolean;
            discountAmount?: number;
            code?: string;
          };
          if (data.applicable && typeof data.discountAmount === "number") {
            return { applicable: true, code: data.code ?? code, discountAmount: data.discountAmount };
          }
        } catch {
          // Swallow: backend fallback is best-effort; return Shopify result below
        }
      }
    }

    // Discount amount = raw line total minus Shopify's discounted totalAmount.
    // Shopify reflects applied discount codes in cost.totalAmount immediately,
    // so this difference is the true discount amount.
    const rawLineTotal = updated.lines.nodes.reduce(
      (sum, line) => sum + parseFloat(line.merchandise.price.amount) * line.quantity,
      0,
    );
    const discountedTotal = parseFloat(updated.cost.totalAmount.amount);
    const discountAmount = Math.max(0, rawLineTotal - discountedTotal);
    return { applicable: applied?.applicable ?? false, code, discountAmount };
  }, [ensureShopifyCart, localItems]);

  const clearCart = useCallback(() => {
    setShopifyCart(null);
    setLocalItems([]);
    localStorage.removeItem(CART_ID_KEY);
    localStorage.removeItem(LOCAL_CART_KEY);
  }, []);

  const replaceRecoveredCart = useCallback(async (items: RecoveredItem[], email?: string) => {
    const newLocalItems: LocalCartItem[] = items.map((item, i) => ({
      id: `recovery-${i}-${(item.variantId ?? item.title).replace(/\s+/g, "-").toLowerCase()}`,
      variantId: item.variantId ?? `recovery-${i}`,
      title: item.title,
      price: item.price,
      priceAmount: parseEGP(item.price),
      currencyCode: "EGP",
      image: item.imageUrl ?? null,
      color: item.variant,
      quantity: item.quantity,
    }));
    saveLocalCart(newLocalItems);
    setLocalItems(newLocalItems);
    localStorage.removeItem(CART_ID_KEY);
    setShopifyCart(null);
    if (SHOPIFY_CONFIGURED) {
      const shopifyLines = items
        .filter((item) => item.variantId)
        .map((item) => ({ merchandiseId: item.variantId!, quantity: item.quantity }));
      if (shopifyLines.length > 0) {
        try {
          const newCart = await createCartWithLines(shopifyLines);
          localStorage.setItem(CART_ID_KEY, newCart.id);
          setShopifyCart(newCart);
        } catch {
          // fall through to local-only mode
        }
      }
    }
    if (email) setPrefilledEmail(email);
    setCartOpen(false);
    setCheckoutOpen(true);
  }, []);

  const formatShopifyLinePrice = useCallback((line: ShopifyCartLine) => {
    const price = parseFloat(line.merchandise.price.amount) * line.quantity;
    return formatMoney(String(price), line.merchandise.price.currencyCode);
  }, []);

  const shopifyItemCount = shopifyCart?.totalQuantity ?? 0;
  const localItemCount = localItems.reduce((sum, i) => sum + i.quantity, 0);
  const shopifyActive = SHOPIFY_CONFIGURED && shopifyCart !== null && (shopifyCart?.lines.nodes.length ?? 0) > 0;
  const itemCount = shopifyActive
    ? shopifyItemCount
    : localItemCount;

  const shopifyTotal = shopifyCart
    ? formatMoney(shopifyCart.cost.totalAmount.amount, shopifyCart.cost.totalAmount.currencyCode)
    : "";
  const shopifySubtotal = shopifyCart
    ? formatMoney(shopifyCart.cost.subtotalAmount.amount, shopifyCart.cost.subtotalAmount.currencyCode)
    : "";
  // Raw undiscounted total: sum line item prices × quantities, ignoring any applied discount.
  // Used in the cart drawer so discount codes don't silently alter the visible total there.
  const shopifyRawLineTotal = shopifyCart
    ? shopifyCart.lines.nodes.reduce(
        (sum, line) => sum + parseFloat(line.merchandise.price.amount) * line.quantity,
        0,
      )
    : 0;
  const shopifyCurrency = shopifyCart?.cost.totalAmount.currencyCode ?? "EGP";
  const localTotal = localItems.reduce((sum, i) => sum + i.priceAmount * i.quantity, 0);
  const localCurrency = localItems[0]?.currencyCode ?? "EGP";
  const cartTotal = shopifyActive
    ? shopifyTotal
    : localItems.length > 0 ? formatMoney(String(localTotal), localCurrency) : "";
  const cartRawTotal = shopifyActive
    ? formatMoney(String(shopifyRawLineTotal), shopifyCurrency)
    : localItems.length > 0 ? formatMoney(String(localTotal), localCurrency) : "";
  const cartSubtotal = shopifyActive
    ? shopifySubtotal
    : localItems.length > 0 ? formatMoney(String(localTotal), localCurrency) : "";

  const openCheckout = useCallback((email?: string) => {
    if (email) setPrefilledEmail(email);
    setCartOpen(false);
    if (typeof window !== "undefined" && window.location.pathname !== "/checkout") {
      window.history.pushState({ checkout: true }, "", "/checkout");
    }
    setCheckoutOpen(true);
    // Fire checkout_started to Shopify Analytics, alongside existing Meta & TikTok pixels
    const checkoutTotal = shopifyCart
      ? parseFloat(shopifyCart.cost.totalAmount.amount)
      : localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0);
    const checkoutCurrency = shopifyCart?.cost.totalAmount.currencyCode ?? localItems[0]?.currencyCode ?? "EGP";
    const checkoutItems = shopifyCart
      ? shopifyCart.lines.nodes.map((l) => ({
          item_id: l.merchandise.id,
          item_name: l.merchandise.product.title,
          price: parseFloat(l.merchandise.price.amount),
          quantity: l.quantity,
          currency: l.merchandise.price.currencyCode ?? "EGP",
        }))
      : localItems.map((i) => ({
          item_id: i.variantId,
          item_name: i.title,
          price: i.priceAmount,
          quantity: i.quantity,
          currency: i.currencyCode ?? "EGP",
        }));
    if (typeof window !== "undefined" && (window as unknown as { gtag?: unknown }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "begin_checkout", {
        currency: checkoutCurrency,
        value: checkoutTotal,
        items: checkoutItems,
      });
    }
    trackShopifyCheckoutStarted({
      cartId: shopifyCart?.id,
      totalPrice: shopifyCart
        ? parseFloat(shopifyCart.cost.totalAmount.amount)
        : localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0),
      currencyCode:
        shopifyCart?.cost.totalAmount.currencyCode ??
        localItems[0]?.currencyCode ??
        "EGP",
      lineItems: shopifyCart
        ? shopifyCart.lines.nodes.map((l) => ({
            variantId: l.merchandise.id,
            title: l.merchandise.product.title,
            price: parseFloat(l.merchandise.price.amount),
            quantity: l.quantity,
          }))
        : localItems.map((i) => ({
            variantId: i.variantId,
            title: i.title,
            price: i.priceAmount,
            quantity: i.quantity,
          })),
    });
  }, [shopifyCart, localItems]);

  return (
    <CartContext.Provider value={{
      shopifyCart,
      localItems,
      cartOpen,
      checkoutOpen,
      loading,
      itemCount,
      openCart: () => {
        setCartOpen(true);
        trackShopifyCartViewed({
          cartId: shopifyCart?.id,
          totalPrice: shopifyCart
            ? parseFloat(shopifyCart.cost.totalAmount.amount)
            : localItems.reduce((s, i) => s + i.priceAmount * i.quantity, 0),
          currencyCode: shopifyCart?.cost.totalAmount.currencyCode
            ?? localItems[0]?.currencyCode
            ?? "EGP",
        });
      },
      closeCart: () => setCartOpen(false),
      openCheckout,
      closeCheckout: () => {
        if (typeof window !== "undefined" && window.location.pathname === "/checkout") {
          window.history.back();
        } else {
          setCheckoutOpen(false);
          setPrefilledEmail(null);
        }
      },
      prefilledEmail,
      addToCart,
      removeItem,
      updateQuantity,
      applyDiscount,
      clearCart,
      replaceRecoveredCart,
      checkoutUrl: shopifyCart?.checkoutUrl ?? null,
      formatShopifyLinePrice,
      cartTotal,
      cartRawTotal,
      cartSubtotal,
      isShopify: shopifyActive,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
