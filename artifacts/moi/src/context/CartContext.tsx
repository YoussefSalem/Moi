import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type ShopifyCart,
  type ShopifyCartLine,
  addCartLines,
  createCart,
  getCart,
  removeCartLines,
  updateCartLines,
  cartDiscountCodesUpdate,
  formatMoney,
  SHOPIFY_CONFIGURED,
} from "@/lib/shopify";

const CART_ID_KEY = "moi_cart_id";
const LOCAL_CART_KEY = "moi_local_cart";

export interface LocalCartItem {
  id: string;
  variantId: string;
  title: string;
  price: string;
  priceAmount: number;
  currencyCode: string;
  image: string | null;
  size?: string;
  color?: string;
  quantity: number;
}

export interface AddToCartParams {
  variantId?: string;
  title?: string;
  price?: string;
  priceAmount?: number;
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
  openCheckout: () => void;
  closeCheckout: () => void;
  addToCart: (params: AddToCartParams) => Promise<void>;
  removeItem: (idOrLineId: string) => Promise<void>;
  updateQuantity: (idOrLineId: string, quantity: number) => Promise<void>;
  applyDiscount: (code: string) => Promise<{ applicable: boolean; code: string }>;
  clearCart: () => void;
  checkoutUrl: string | null;
  formatShopifyLinePrice: (line: ShopifyCartLine) => string;
  cartTotal: string;
  cartRawTotal: string;
  cartSubtotal: string;
  isShopify: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadLocalCart(): LocalCartItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    return raw ? (JSON.parse(raw) as LocalCartItem[]) : [];
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
  const [loading, setLoading] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setLocalItems(loadLocalCart());
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

  const addToCart = useCallback(async (params: AddToCartParams) => {
    const qty = params.quantity ?? 1;
    setLoading(true);
    try {
      if (SHOPIFY_CONFIGURED && params.variantId) {
        const c = await ensureShopifyCart();
        const updated = await addCartLines(c.id, [{ merchandiseId: params.variantId, quantity: qty }]);
        setShopifyCart(updated);
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

  const applyDiscount = useCallback(async (code: string): Promise<{ applicable: boolean; code: string }> => {
    if (!SHOPIFY_CONFIGURED || !shopifyCart) throw new Error("Cart not available");
    // Pass [] to clear all codes — Shopify rejects [""] as an invalid code
    const codes = code.trim() ? [code] : [];
    const updated = await cartDiscountCodesUpdate(shopifyCart.id, codes);
    setShopifyCart(updated);
    const applied = updated.discountCodes.find((d) => d.code === code);
    return { applicable: applied?.applicable ?? false, code };
  }, [shopifyCart]);

  const clearCart = useCallback(() => {
    setShopifyCart(null);
    setLocalItems([]);
    localStorage.removeItem(CART_ID_KEY);
    localStorage.removeItem(LOCAL_CART_KEY);
  }, []);

  const formatShopifyLinePrice = useCallback((line: ShopifyCartLine) => {
    const price = parseFloat(line.merchandise.price.amount) * line.quantity;
    return formatMoney(String(price), line.merchandise.price.currencyCode);
  }, []);

  const shopifyItemCount = shopifyCart?.totalQuantity ?? 0;
  const localItemCount = localItems.reduce((sum, i) => sum + i.quantity, 0);
  const shopifyActive = SHOPIFY_CONFIGURED && shopifyCart !== null;
  const itemCount = shopifyActive ? shopifyItemCount : localItemCount;

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

  return (
    <CartContext.Provider value={{
      shopifyCart,
      localItems,
      cartOpen,
      checkoutOpen,
      loading,
      itemCount,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      openCheckout: () => { setCartOpen(false); setCheckoutOpen(true); },
      closeCheckout: () => setCheckoutOpen(false),
      addToCart,
      removeItem,
      updateQuantity,
      applyDiscount,
      clearCart,
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
