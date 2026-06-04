import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageSkeleton } from '~/components/ImageSkeleton';
import { CartForm } from '@shopify/hydrogen';
import { toast } from 'sonner';
import { getSwatchColor } from '~/lib/utils';

interface ColorCardProps {
  productName: string;
  colorName: string;
  image: string;
  hoverImage?: string;
  gallery?: string[];
  price: string;
  compareAtPrice?: string;
  handle: string;
  outOfStock?: boolean;
  variantId?: string;
  index?: number;
  className?: string;
}

export function ColorCard({
  productName,
  colorName,
  image,
  hoverImage,
  gallery,
  price,
  compareAtPrice,
  handle,
  outOfStock = false,
  variantId,
  index = 0,
  className,
}: ColorCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hoverImgLoaded, setHoverImgLoaded] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [pressed, setPressed] = useState(false);

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);

  const allImages = (gallery && gallery.length > 0
    ? gallery
    : [image, ...(hoverImage ? [hoverImage] : [])]
  ).filter(Boolean);

  const swatchColor = getSwatchColor(colorName);

  function swipeBy(dir: 1 | -1) {
    setMobileIndex((i) => (i + dir + allImages.length) % allImages.length);
  }

  // Stock-like display (mirrors existing site logic)
  const stockDisplay =
    productName === 'MOI WAVVY' && colorName === 'Light Blue' ? 'Selling Fast' : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.07, 0.35) }}
      className={`flex flex-col cursor-pointer group w-full h-full max-w-[360px] ${className ?? ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image container */}
      <a href={`/products/${handle}`} className="block">
        <div
          className="relative overflow-hidden aspect-[4/5] md:aspect-[3/4] rounded-lg md:rounded-xl"
          style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 16px rgba(30,24,20,0.04)' }}
        >
          {!imgLoaded && <ImageSkeleton variant="card" className="z-0" borderRadius={8} />}

          {/* Desktop: hover crossfade */}
          <div className="hidden md:block absolute inset-0">
            {image && (
              <img
                src={image}
                alt={`${productName} — ${colorName}`}
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  opacity: imgLoaded ? (hovered && hoverImage ? 0 : 1) : 0,
                  transform: hovered ? 'scale(1.02)' : 'scale(1)',
                  transition: 'opacity 500ms ease, transform 800ms cubic-bezier(0.22,1,0.36,1)',
                }}
                loading="lazy"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
              />
            )}
            {hoverImage && (
              <img
                src={hoverImage}
                alt={`${productName} — ${colorName} alternate`}
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  opacity: hovered && hoverImgLoaded ? 1 : 0,
                  transform: hovered ? 'scale(1.03)' : 'scale(1)',
                  transition: 'opacity 500ms ease, transform 800ms cubic-bezier(0.22,1,0.36,1)',
                }}
                loading="eager"
                decoding="async"
                onLoad={() => setHoverImgLoaded(true)}
              />
            )}
          </div>

          {/* Out of stock overlay */}
          {outOfStock && (
            <div
              className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center py-2.5"
              style={{ background: 'rgba(30,24,20,0.52)', backdropFilter: 'blur(2px)' }}
            >
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 'clamp(0.55rem, 1.6vw, 0.65rem)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(250,248,245,0.9)',
                fontWeight: 500,
              }}>
                Sold Out
              </span>
            </div>
          )}

          {/* Mobile: swipe */}
          <div
            className="md:hidden absolute inset-0"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragStartXRef.current = e.clientX;
              dragLastXRef.current = e.clientX;
              setPressed(true);
            }}
            onPointerMove={(e) => {
              if (dragStartXRef.current === null) return;
              dragLastXRef.current = e.clientX;
              const delta = e.clientX - (dragStartXRef.current ?? e.clientX);
              if (Math.abs(delta) > 10) setPressed(false);
            }}
            onPointerUp={(e) => {
              setPressed(false);
              if (dragStartXRef.current === null) return;
              const delta = (dragLastXRef.current ?? e.clientX) - dragStartXRef.current;
              dragStartXRef.current = null;
              dragLastXRef.current = null;
              if (Math.abs(delta) > 30) {
                swipeBy(delta < 0 ? 1 : -1);
              }
            }}
            onPointerCancel={() => {
              setPressed(false);
              dragStartXRef.current = null;
              dragLastXRef.current = null;
            }}
            style={{ touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
          >
            <ImageSkeleton variant="card" className="z-0" borderRadius={8} />
            <AnimatePresence initial={false} mode="sync">
              <motion.img
                key={mobileIndex}
                src={(allImages[mobileIndex] ?? image) || undefined}
                alt={`${productName} — ${colorName}`}
                className="absolute inset-0 w-full h-full z-10"
                style={{ objectFit: 'cover', objectPosition: 'center top', userSelect: 'none' }}
                loading="lazy"
                decoding="async"
                draggable={false}
                onLoad={() => setImgLoaded(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: imgLoaded ? 1 : 0, scale: pressed ? 1.03 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </AnimatePresence>
            <motion.div
              className="absolute inset-0 z-20 pointer-events-none"
              animate={{ opacity: pressed ? 0.12 : 0, backgroundColor: '#000000' }}
              transition={{ duration: 0.18 }}
            />
          </div>
        </div>

        {/* Mobile pagination dots */}
        {allImages.length > 1 && (
          <div className="md:hidden flex justify-center mt-2">
            {allImages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileIndex(i); }}
                style={{ padding: '6px 2px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div style={{
                  width: i === mobileIndex ? 14 : 4,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: i === mobileIndex ? '#1e1814' : 'rgba(30,24,20,0.24)',
                  transition: 'all 0.28s ease',
                }} />
              </button>
            ))}
          </div>
        )}
      </a>

      {/* Info */}
      <div className="flex flex-col items-center flex-grow pt-3 md:pt-4 pb-4 md:pb-5 px-1 md:px-0 gap-y-2 md:gap-y-2.5">
        <div className="flex items-center justify-center gap-2 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            {swatchColor && (
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 10, height: 10, backgroundColor: swatchColor, border: '1px solid rgba(30,24,20,0.18)' }}
              />
            )}
            <span className="truncate" style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(0.6rem, 2vw, 0.78rem)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#8a7e74',
            }}>
              {colorName}
            </span>
          </div>
          {stockDisplay && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: 'rgba(200, 50, 50, 0.08)', border: '1px solid rgba(200, 50, 50, 0.18)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#c83232' }} />
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(0.52rem, 1.4vw, 0.62rem)', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c83232', fontWeight: 500 }}>
                {stockDisplay}
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5 md:flex-row md:items-center md:justify-center md:gap-6">
          <h3 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(0.88rem, 2.5vw, 1.35rem)',
            fontWeight: 300,
            color: '#1e1814',
            letterSpacing: '0.04em',
            lineHeight: 1.15,
            textAlign: 'center',
          }}>
            {productName}
          </h3>
        </div>

        <div className="text-center mt-auto flex flex-col items-center" style={{ gap: 2 }}>
          {compareAtPrice && (
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(0.72rem, 2vw, 0.78rem)',
              fontWeight: 400,
              letterSpacing: '0.08em',
              color: '#8a7e74',
              textDecoration: 'line-through',
              textDecorationThickness: 1,
              textDecorationColor: '#c83232',
            }}>
              {compareAtPrice}
            </span>
          )}
          {price && (
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(0.81rem, 2.2vw, 0.88rem)',
              letterSpacing: '0.14em',
              color: compareAtPrice ? '#c83232' : '#7a6e64',
            }}>
              {price}
            </span>
          )}
        </div>

        {outOfStock ? (
          <button
            type="button"
            disabled
            className="self-center border px-6 py-2.5 md:px-14 md:py-3.5 w-full md:w-auto cursor-not-allowed"
            style={{
              fontSize: 'clamp(0.62rem, 2vw, 0.78rem)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              color: '#a89e97',
              borderColor: '#c8bfb8',
              backgroundColor: '#f0ece8',
              borderRadius: 6,
            }}
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
              onClick={() => toast.success(`${productName} — ${colorName} added`)}
              className="self-center border transition-all duration-300 px-6 py-2.5 md:px-14 md:py-3.5 hover:shadow-lg w-full md:w-auto"
              style={{
                fontSize: 'clamp(0.62rem, 2vw, 0.78rem)',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                color: '#faf8f5',
                borderColor: '#1e1814',
                backgroundColor: '#1e1814',
                borderRadius: 6,
              }}
            >
              Order Now
            </button>
          </CartForm>
        ) : (
          <a
            href={`/products/${handle}`}
            className="self-center border transition-all duration-300 px-6 py-2.5 md:px-14 md:py-3.5 hover:shadow-lg w-full md:w-auto text-center"
            style={{
              fontSize: 'clamp(0.62rem, 2vw, 0.78rem)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              color: '#faf8f5',
              borderColor: '#1e1814',
              backgroundColor: '#1e1814',
              borderRadius: 6,
            }}
          >
            View Details
          </a>
        )}
      </div>
    </motion.article>
  );
}
