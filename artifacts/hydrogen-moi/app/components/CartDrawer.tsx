import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart, CartForm } from '@shopify/hydrogen';
import { formatShopifyPrice } from '~/lib/price';

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { lines, cost, totalQuantity, status, checkoutUrl } = useCart();

  // Listen for the custom open-cart event dispatched by the Header
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('moi:open-cart', handler);
    return () => window.removeEventListener('moi:open-cart', handler);
  }, []);

  // Auto-open when an item is added
  const prevQty = useRef(totalQuantity ?? 0);
  useEffect(() => {
    const qty = totalQuantity ?? 0;
    if (qty > prevQty.current && status === 'idle') {
      setOpen(true);
    }
    prevQty.current = qty;
  }, [totalQuantity, status]);

  const lineItems = lines?.nodes ?? [];
  const subtotal = cost?.subtotalAmount;
  const isEmpty = lineItems.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.38, ease: [0.76, 0, 0.24, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[90] flex flex-col w-full max-w-md"
            style={{ backgroundColor: '#faf8f5' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} strokeWidth={1.5} style={{ color: '#1e1814' }} />
                <span
                  className="text-xs tracking-[0.25em] uppercase"
                  style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814' }}
                >
                  Cart {totalQuantity ? `(${totalQuantity})` : ''}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-50 -mr-1"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Line items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <ShoppingBag size={36} strokeWidth={1} style={{ color: '#c8bfb8' }} />
                  <p
                    className="text-sm tracking-[0.15em] uppercase text-center"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
                  >
                    Your cart is empty
                  </p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-4 text-xs tracking-[0.3em] uppercase border px-6 py-3 transition-colors hover:bg-[#1e1814] hover:text-white"
                    style={{ fontFamily: "'Montserrat', sans-serif", borderColor: '#1e1814', color: '#1e1814' }}
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems.map((line) => (
                    <CartLineItem key={line.id} line={line} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!isEmpty && (
              <div className="px-6 py-6 border-t border-stone-200 space-y-4">
                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs tracking-[0.2em] uppercase"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
                  >
                    Subtotal
                  </span>
                  <span
                    className="text-sm tracking-[0.1em]"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814', fontWeight: 500 }}
                  >
                    {subtotal ? formatShopifyPrice(subtotal) : '—'}
                  </span>
                </div>

                {/* Checkout button — links to custom checkout route */}
                <a
                  href="/checkout"
                  className="block w-full text-center py-4 text-xs tracking-[0.4em] uppercase transition-all hover:opacity-85"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    backgroundColor: '#1e1814',
                    color: '#faf8f5',
                  }}
                >
                  Checkout
                </a>

                {/* Shopify checkout fallback */}
                <a
                  href={checkoutUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-3 text-[10px] tracking-[0.3em] uppercase transition-colors hover:opacity-60"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    color: '#7a6e64',
                    border: '1px solid rgba(30,24,20,0.15)',
                  }}
                >
                  Pay via Shopify
                </a>

                <p
                  className="text-center text-[10px] tracking-[0.1em]"
                  style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
                >
                  Shipping & taxes calculated at checkout
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface CartLineItemProps {
  line: {
    id: string;
    quantity: number;
    merchandise: {
      id: string;
      title: string;
      selectedOptions: { name: string; value: string }[];
      product: { handle: string; title: string; featuredImage: { url: string; altText: string | null } | null };
      price: { amount: string; currencyCode: string };
      image: { url: string; altText: string | null } | null;
    };
    cost: { totalAmount: { amount: string; currencyCode: string } };
  };
}

function CartLineItem({ line }: CartLineItemProps) {
  const { merchandise, quantity, cost } = line;
  const image = merchandise.image ?? merchandise.product.featuredImage;
  const colorOption = merchandise.selectedOptions.find((o) => o.name.toLowerCase() === 'color');
  const sizeOption = merchandise.selectedOptions.find((o) => o.name.toLowerCase() === 'size');

  return (
    <div className="flex gap-4">
      {/* Image */}
      <a
        href={`/products/${merchandise.product.handle}`}
        className="flex-shrink-0 w-20 h-24 rounded-lg overflow-hidden"
        style={{ backgroundColor: '#f0ece6' }}
      >
        {image && (
          <img
            src={image.url}
            alt={image.altText ?? merchandise.product.title}
            className="w-full h-full object-cover object-top"
          />
        )}
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <a
            href={`/products/${merchandise.product.handle}`}
            className="block text-sm leading-snug hover:opacity-70 transition-opacity"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1e1814', letterSpacing: '0.03em' }}
          >
            {merchandise.product.title}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {colorOption && (
              <span className="text-[10px] tracking-[0.12em]" style={{ fontFamily: "'Montserrat', sans-serif", color: '#8a7e74' }}>
                {colorOption.value}
              </span>
            )}
            {sizeOption && (
              <span className="text-[10px] tracking-[0.12em]" style={{ fontFamily: "'Montserrat', sans-serif", color: '#8a7e74' }}>
                {sizeOption.value}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Quantity controls */}
          <div className="flex items-center gap-2">
            <CartForm
              route="/cart"
              action={CartForm.ACTIONS.LinesUpdate}
              inputs={{ lines: [{ id: line.id, quantity: Math.max(0, quantity - 1) }] }}
            >
              <button type="submit" className="w-6 h-6 flex items-center justify-center transition-opacity hover:opacity-60">
                {quantity === 1 ? (
                  <Trash2 size={13} strokeWidth={1.5} style={{ color: '#7a6e64' }} />
                ) : (
                  <Minus size={13} strokeWidth={1.5} style={{ color: '#1e1814' }} />
                )}
              </button>
            </CartForm>
            <span className="text-xs w-4 text-center" style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814' }}>
              {quantity}
            </span>
            <CartForm
              route="/cart"
              action={CartForm.ACTIONS.LinesUpdate}
              inputs={{ lines: [{ id: line.id, quantity: quantity + 1 }] }}
            >
              <button type="submit" className="w-6 h-6 flex items-center justify-center transition-opacity hover:opacity-60">
                <Plus size={13} strokeWidth={1.5} style={{ color: '#1e1814' }} />
              </button>
            </CartForm>
          </div>

          {/* Line total */}
          <span className="text-xs tracking-[0.08em]" style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814', fontWeight: 500 }}>
            {formatShopifyPrice(cost.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
