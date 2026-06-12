// @refresh reset
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  isAddingToCart: boolean;
  itemCount: number;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: (email?: string) => void;
  closeCheckout: () => void;
  prefilledEmail: string | null;
  addToCart: (params: AddToCartParams) => Promise<string | null>;
  buyNow: (params: AddToCartParams) => void;
  buyNowCheckoutUrl: (variantId: string, quantity?: number) => Promise<string | null>;
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
  waitForSync: () => Promise<ShopifyCart | null>;
}

// CartContext is intentionally NOT exported — consumers must use `useCart()`.
// Keeping it unexported prevents Fast Refresh from treating this file as
// "mixed exports" (components + non-component values) which would force a
// full page remount on every hot update instead of a component-level refresh.
const CartContext = createContext<CartContextValue | null>(null);

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
  // Load local cart synchronously on first render so checkout doesn't flash
  // empty items after a refresh on /checkout.
  const [localItems, setLocalItems] = useState<LocalCartItem[]>(() => {
    if (typeof window === "undefined") return [];
    return loadLocalCart();
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [prefilledEmail, setPrefilledEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const initRef = useRef(false);
  const checkoutInitRef = useRef(false);

  // Keep localItemsRef in sync each render — async closures (removeItem rollback)
  // read this instead of capturing a potentially-stale closure over localItems.
  const localItemsRef = useRef(localItems);
  localItemsRef.current = localItems;

  // Per-item in-flight guard: prevents stacked network calls from rapid taps.
  // Key is the item id (local composite key) or Shopify line GID.
  const updatingRef = useRef<Map<string, boolean>>(new Map());

  // Always-current mirror of shopifyCart state — readable inside async closures
  // without stale-closure issues.
  const shopifyCartRef = useRef<ShopifyCart | null>(null);
  // Deduplicates concurrent cart creation: if two addToCart calls race while
  // shopifyCart is null, they both await the same promise instead of each
  // creating a separate Shopify cart.
  const cartCreationRef = useRef<Promise<ShopifyCart> | null>(null);
  // Serialises addCartLines calls so rapid "add item A, add item B" sequences
  // never overwrite each other's setShopifyCart result.
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());

  // Ref-counted loading so chained ops don't falsely flip loading=false
  // while a subsequent op is still pending (prevents checkout button flicker).
  const loadingCountRef = useRef(0);
  const startLoading = useCallback(() => {
    loadingCountRef.current += 1;
    setLoading(true);
  }, []);
  const stopLoading = useCallback(() => {
    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
    if (loadingCountRef.current === 0) setLoading(false);
  }, []);

  // Timer ref for isAddingToCart — cleared before each new add so rapid taps
  // don't stack multiple setTimeout callbacks.
  const addingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper that keeps both the ref and state in sync.
  const setCart = useCallback((c: ShopifyCart) => {
    shopifyCartRef.current = c;
    setShopifyCart(c);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
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
                setCart(cleaned);
              } catch {
                setCart(c);
              }
            } else {
              setCart(c);
            }
          })
          .catch(() => localStorage.removeItem(CART_ID_KEY));
      }
    }
  }, [setCart]);

  const ensureShopifyCart = useCallback(async (): Promise<ShopifyCart> => {
    // Use the always-current ref so concurrent callers see a cart created by a
    // sibling call that hasn't propagated to React state yet.
    if (shopifyCartRef.current) return shopifyCartRef.current;
    // Deduplicate: if another call is already creating the cart, piggyback on it.
    if (cartCreationRef.current) return cartCreationRef.current;
    cartCreationRef.current = createCart().then((newCart) => {
      localStorage.setItem(CART_ID_KEY, newCart.id);
      shopifyCartRef.current = newCart;
      setShopifyCart(newCart);
      cartCreationRef.current = null;
      return newCart;
    });
    return cartCreationRef.current;
  }, []);

  const addToCart = useCallback(async (params: AddToCartParams): Promise<string | null> => {
    const qty = params.quantity ?? 1;

    // ── Step 1: Optimistic local update — zero network wait ──────────────────
    // When a variantId is present it already uniquely encodes color + size, so
    // use it as the sole key. Composite fallback covers non-Shopify local items.
    const key = params.variantId
      ? params.variantId
      : `${params.title ?? "item"}-${params.color ?? ""}-${params.size ?? ""}`;
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

    // ── Step 2: Brief "adding" window, then open cart ────────────────────────
    // Clear any previous timer before starting a new one so rapid taps don't
    // stack callbacks and re-open the drawer multiple times.
    if (addingTimerRef.current !== null) clearTimeout(addingTimerRef.current);
    setIsAddingToCart(true);
    addingTimerRef.current = setTimeout(() => {
      addingTimerRef.current = null;
      setIsAddingToCart(false);
      setCartOpen(true);
    }, 120);

    // ── Step 3: Analytics (non-blocking) ─────────────────────────────────────
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

    // ── Step 4: Shopify sync — serialised to prevent concurrent race ──────────
    // syncChainRef ensures that if two addToCart calls happen in rapid succession
    // (e.g. wavy top then versa top), the second awaits the first's addCartLines
    // before running its own. Without this, both calls can race to create separate
    // Shopify carts and the second setShopifyCart overwrites the first, hiding
    // the earlier item in the drawer.
    // startLoading/stopLoading use a ref-counter so chained ops don't falsely
    // flip loading=false while a subsequent op is still pending.
    let resolvedCheckoutUrl: string | null = null;
    if (SHOPIFY_CONFIGURED && params.variantId) {
      startLoading();
      const variantId = params.variantId;
      const quantity = qty;
      const op = syncChainRef.current.then(async () => {
        const c = await ensureShopifyCart();
        const updated = await addCartLines(c.id, [{ merchandiseId: variantId, quantity }]);
        setCart(updated);
        resolvedCheckoutUrl = updated.checkoutUrl ?? null;
      }).catch(() => {
        // Shopify failure must not block local cart
      }).finally(() => {
        stopLoading();
      });
      syncChainRef.current = op;
      await op;
    }

    return resolvedCheckoutUrl;
  }, [ensureShopifyCart, setCart, startLoading, stopLoading]);

  // "Buy It Now" — replace cart with a single item and open checkout immediately.
  // Opens checkout with local state right away (zero wait), then syncs the Shopify
  // cart in the background. Avoids the clearCart()+addToCart() stale-closure race
  // and prevents the cart drawer from flashing open.
  const buyNow = useCallback((params: AddToCartParams): void => {
    const qty = params.quantity ?? 1;
    // Mirror addToCart: variantId alone is the key when present.
    const key = params.variantId
      ? params.variantId
      : `${params.title ?? "item"}-${params.color ?? ""}-${params.size ?? ""}`;

    // 1. Replace local cart immediately — no network wait
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
    saveLocalCart([newItem]);
    setLocalItems([newItem]);
    // Drop the old Shopify cart so checkout uses local fallback until background
    // cart creation finishes.
    shopifyCartRef.current = null;
    cartCreationRef.current = null;
    setShopifyCart(null);
    localStorage.removeItem(CART_ID_KEY);

    // 2. Open checkout immediately — no spinner, no delay
    setCartOpen(false);
    if (typeof window !== "undefined" && window.location.pathname !== "/checkout") {
      window.history.pushState({ checkout: true }, "", "/checkout");
    }
    setCheckoutOpen(true);

    // 3. Create a fresh single-item Shopify cart in the background.
    // Chain onto syncChainRef so waitForSync() covers this operation too.
    if (SHOPIFY_CONFIGURED && params.variantId) {
      const variantId = params.variantId;
      const op = syncChainRef.current.then(async () => {
        const freshCart = await createCartWithLines([{ merchandiseId: variantId, quantity: qty }]);
        localStorage.setItem(CART_ID_KEY, freshCart.id);
        setCart(freshCart);
      }).catch(() => {
        // Local cart is the fallback — checkout still works without Shopify
      });
      syncChainRef.current = op;
    }
  }, [setCart]);

  // Express single-item checkout (e.g. Apple Pay): creates a brand-new, ephemeral
  // Shopify cart containing only this item and returns its checkoutUrl. The
  // shopper's persistent cart is left untouched, so cancelling Apple Pay loses
  // nothing. Avoids the clearCart()+addToCart() race (stale cart contents).
  const buyNowCheckoutUrl = useCallback(async (variantId: string, quantity = 1): Promise<string | null> => {
    if (!SHOPIFY_CONFIGURED || !variantId) return null;
    try {
      const cart = await createCartWithLines([{ merchandiseId: variantId, quantity }]);
      return cart.checkoutUrl ?? null;
    } catch {
      return null;
    }
  }, []);

  const removeItem = useCallback(async (idOrLineId: string) => {
    // Skip if a mutation is already in-flight for this item to prevent ghost lines.
    if (updatingRef.current.get(idOrLineId)) return;
    updatingRef.current.set(idOrLineId, true);

    // ── Optimistic removal — update state IMMEDIATELY so the exit animation
    // plays right away instead of freezing for ~1s waiting on the network. ──
    const prevCart = shopifyCartRef.current;
    const prevLocal = localItemsRef.current;

    if (SHOPIFY_CONFIGURED && shopifyCartRef.current) {
      // Build an optimistic cart with the line removed
      const optimistic = {
        ...shopifyCartRef.current,
        lines: {
          nodes: shopifyCartRef.current.lines.nodes.filter((l) => l.id !== idOrLineId),
        },
        totalQuantity: Math.max(0, (shopifyCartRef.current.totalQuantity ?? 1) - 1),
      } as typeof shopifyCartRef.current;
      setCart(optimistic);
      // Also sync local items for the removed variantId
      const removedLine = prevCart?.lines.nodes.find((l) => l.id === idOrLineId);
      if (removedLine) {
        setLocalItems((prev) => {
          const filtered = prev.filter((i) => i.variantId !== removedLine.merchandise.id);
          saveLocalCart(filtered);
          return filtered;
        });
      }
      // Confirm with Shopify in the background
      removeCartLines(shopifyCartRef.current.id, [idOrLineId])
        .then((confirmed) => setCart(confirmed))
        .catch(() => {
          // Rollback on failure and notify the user
          if (prevCart) setCart(prevCart);
          setLocalItems(prevLocal);
          saveLocalCart(prevLocal);
          import("sonner").then(({ toast }) => {
            toast.error("Could not remove item. Please try again.");
          });
        })
        .finally(() => updatingRef.current.delete(idOrLineId));
      return;
    }

    // Local-only removal
    setLocalItems((prev) => {
      const updated = prev.filter((i) => i.id !== idOrLineId);
      saveLocalCart(updated);
      return updated;
    });
    updatingRef.current.delete(idOrLineId);
  }, [setCart]);

  const updateQuantity = useCallback(async (idOrLineId: string, quantity: number) => {
    if (quantity <= 0) { await removeItem(idOrLineId); return; }

    // Skip if a mutation is already in-flight for this item.
    // This prevents rapid mobile taps from stacking network calls and corrupting quantity.
    if (updatingRef.current.get(idOrLineId)) return;
    updatingRef.current.set(idOrLineId, true);
    startLoading();
    try {
      if (SHOPIFY_CONFIGURED && shopifyCartRef.current) {
        try {
          const updated = await updateCartLines(shopifyCartRef.current.id, [{ id: idOrLineId, quantity }]);
          setCart(updated);
          // When Shopify is active, idOrLineId is a Shopify CartLine GID, NOT the local
          // composite key. Derive the affected variantId from the updated Shopify cart
          // and sync local items by variantId so the drawer stays consistent.
          const updatedLine = updated.lines.nodes.find((l) => l.id === idOrLineId);
          if (updatedLine) {
            const affectedVariantId = updatedLine.merchandise.id;
            setLocalItems((prev) => {
              const next = prev.map((i) =>
                i.variantId === affectedVariantId ? { ...i, quantity } : i,
              );
              saveLocalCart(next);
              return next;
            });
            return;
          }
        } catch {
          // line may be local-only — fall through to local update below
        }
      }
      // Local-only update (no Shopify cart, or item was local-only)
      setLocalItems((prev) => {
        const updated = prev.map((i) => i.id === idOrLineId ? { ...i, quantity } : i);
        saveLocalCart(updated);
        return updated;
      });
    } finally {
      updatingRef.current.delete(idOrLineId);
      stopLoading();
    }
  }, [removeItem, startLoading, stopLoading]);

  const applyDiscount = useCallback(async (code: string): Promise<{ applicable: boolean; code: string; discountAmount: number }> => {
    if (!SHOPIFY_CONFIGURED) throw new Error("Shopify not configured");
    // Ensure a cart exists first (creates one if necessary) so discount codes
    // can always be applied even when the user only added items via local cart.
    const c = await ensureShopifyCart();
    // Pass [] to clear all codes — Shopify rejects [""] as an invalid code
    const codes = code.trim() ? [code] : [];
    const updated = await cartDiscountCodesUpdate(c.id, codes);
    setCart(updated);
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
    shopifyCartRef.current = null;
    cartCreationRef.current = null;
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
    shopifyCartRef.current = null;
    cartCreationRef.current = null;
    setShopifyCart(null);
    if (SHOPIFY_CONFIGURED) {
      const shopifyLines = items
        .filter((item) => item.variantId)
        .map((item) => ({ merchandiseId: item.variantId!, quantity: item.quantity }));
      if (shopifyLines.length > 0) {
        try {
          const newCart = await createCartWithLines(shopifyLines);
          localStorage.setItem(CART_ID_KEY, newCart.id);
          setCart(newCart);
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

  // Awaits the current in-flight Shopify sync chain and returns the latest cart.
  // Call this before submitting an order to guarantee the cart is fully synced.
  const waitForSync = useCallback(async (): Promise<ShopifyCart | null> => {
    await syncChainRef.current;
    return shopifyCartRef.current;
  }, []);

  const localItemCount = localItems.reduce((sum, i) => sum + i.quantity, 0);
  const shopifyActive = SHOPIFY_CONFIGURED && shopifyCart !== null && (shopifyCart?.lines.nodes.length ?? 0) > 0;
  // Always use localItemCount for the badge — it's optimistically updated the
  // moment "Add to Bag" is tapped, with no network wait. The Shopify quantity
  // lags by ~1-2s and causes a visible stale count in the header.
  const itemCount = localItemCount;

  // cartTotal, cartRawTotal, and cartSubtotal are always derived inline from
  // current cart state — never stored in separate useState — so they are always
  // fresh and can never be stale relative to shopifyCart or localItems.
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

  const openCart = useCallback(() => {
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
  }, [shopifyCart, localItems]);

  const closeCart = useCallback(() => setCartOpen(false), []);

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    setPrefilledEmail(null);
    if (typeof window !== "undefined" && window.location.pathname === "/checkout") {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, []);

  const contextValue = useMemo<CartContextValue>(() => ({
    shopifyCart,
    localItems,
    cartOpen,
    checkoutOpen,
    loading,
    isAddingToCart,
    itemCount,
    openCart,
    closeCart,
    openCheckout,
    closeCheckout,
    prefilledEmail,
    addToCart,
    buyNow,
    buyNowCheckoutUrl,
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
    waitForSync,
  }), [
    shopifyCart, localItems, cartOpen, checkoutOpen, loading, isAddingToCart, itemCount,
    openCart, closeCart, openCheckout, closeCheckout, prefilledEmail,
    addToCart, buyNow, buyNowCheckoutUrl, removeItem, updateQuantity, applyDiscount,
    clearCart, replaceRecoveredCart, formatShopifyLinePrice,
    cartTotal, cartRawTotal, cartSubtotal, shopifyActive, waitForSync,
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
