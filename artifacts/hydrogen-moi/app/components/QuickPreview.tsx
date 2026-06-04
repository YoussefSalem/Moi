import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { CartForm } from '@shopify/hydrogen';
import { toast } from 'sonner';
import { getSwatchColor } from '~/lib/utils';

interface QuickPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  colorName: string;
  swatchColor?: string;
  price: string;
  compareAtPrice?: string;
  gallery: string[];
  handle: string;
  description?: string;
  outOfStock?: boolean;
  variantId?: string;
}

export function QuickPreview({
  isOpen,
  onClose,
  productName,
  colorName,
  swatchColor,
  price,
  compareAtPrice,
  gallery,
  handle,
  description,
  outOfStock = false,
  variantId,
}: QuickPreviewProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const swatch = swatchColor ?? getSwatchColor(colorName);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="qp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="qp-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.38, ease: [0.76, 0, 0.24, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[130] max-h-[88vh] overflow-hidden rounded-t-2xl flex flex-col"
            style={{ backgroundColor: '#faf8f5' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(30,24,20,0.18)' }} />
            </div>

            <div className="flex gap-5 p-5 overflow-y-auto flex-1">
              {/* Image strip */}
              <div className="w-32 flex-shrink-0">
                <div
                  className="relative aspect-[3/4] rounded-lg overflow-hidden"
                  style={{ backgroundColor: '#f0ece6' }}
                >
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={imgIndex}
                      src={gallery[imgIndex]}
                      alt={`${productName} — ${colorName}`}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    />
                  </AnimatePresence>

                  {gallery.length > 1 && (
                    <>
                      <button
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80"
                        onClick={() => setImgIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                      >
                        <ChevronLeft size={12} strokeWidth={2} />
                      </button>
                      <button
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80"
                        onClick={() => setImgIndex((i) => (i + 1) % gallery.length)}
                      >
                        <ChevronRight size={12} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col">
                {/* Close */}
                <div className="flex justify-end -mt-1 mb-2">
                  <button onClick={onClose} className="w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-50">
                    <X size={17} strokeWidth={1.5} />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  {swatch && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: swatch, border: '1px solid rgba(30,24,20,0.18)' }}
                    />
                  )}
                  <span
                    className="text-[10px] tracking-[0.2em] uppercase"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#8a7e74' }}
                  >
                    {colorName}
                  </span>
                </div>

                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: '1.3rem',
                    fontWeight: 300,
                    color: '#1e1814',
                    letterSpacing: '0.04em',
                  }}
                >
                  {productName}
                </p>

                <div className="flex items-center gap-3 mt-2">
                  {compareAtPrice && (
                    <span
                      className="text-xs"
                      style={{
                        color: '#8a7e74',
                        textDecoration: 'line-through',
                        textDecorationColor: '#c83232',
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {compareAtPrice}
                    </span>
                  )}
                  <span
                    className="text-xs"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      color: compareAtPrice ? '#c83232' : '#7a6e64',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {price}
                  </span>
                </div>

                {description && (
                  <p
                    className="mt-3 text-xs leading-6 line-clamp-3"
                    style={{ color: '#7a6e64' }}
                  >
                    {description}
                  </p>
                )}

                <div className="mt-auto pt-4 flex flex-col gap-2">
                  {outOfStock ? (
                    <button
                      disabled
                      className="w-full py-3 text-[10px] tracking-[0.3em] uppercase cursor-not-allowed"
                      style={{ fontFamily: "'Montserrat', sans-serif", backgroundColor: '#f0ece8', color: '#a89e97', border: '1px solid #c8bfb8' }}
                    >
                      Sold Out
                    </button>
                  ) : variantId ? (
                    <CartForm
                      route="/cart"
                      action={CartForm.ACTIONS.LinesAdd}
                      inputs={{ lines: [{ merchandiseId: variantId, quantity: 1 }] }}
                    >
                      <button
                        type="submit"
                        onClick={() => { toast.success('Added to cart'); onClose(); }}
                        className="w-full py-3 text-[10px] tracking-[0.3em] uppercase transition-colors hover:opacity-85"
                        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, backgroundColor: '#1e1814', color: '#faf8f5' }}
                      >
                        Order Now
                      </button>
                    </CartForm>
                  ) : null}

                  <a
                    href={`/products/${handle}`}
                    className="w-full py-3 text-[10px] tracking-[0.3em] uppercase text-center border transition-colors hover:bg-stone-50"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64', borderColor: 'rgba(30,24,20,0.2)' }}
                    onClick={onClose}
                  >
                    View Full Details
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
