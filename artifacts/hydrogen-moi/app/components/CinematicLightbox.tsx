import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface CinematicLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  productName?: string;
}

export function CinematicLightbox({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productName,
}: CinematicLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [imgLoaded, setImgLoaded] = useState(false);
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIndex(initialIndex);
      setImgLoaded(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, images.length, onClose]);

  useEffect(() => { setImgLoaded(false); }, [index]);

  const currentImage = images[index];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(15,10,8,0.96)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          onPointerDown={(e) => { startXRef.current = e.clientX; }}
          onPointerUp={(e) => {
            if (startXRef.current === null) return;
            const delta = e.clientX - startXRef.current;
            startXRef.current = null;
            if (Math.abs(delta) > 50) {
              setIndex((i) => delta < 0 ? (i + 1) % images.length : (i - 1 + images.length) % images.length);
            }
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <X size={22} strokeWidth={1.5} className="text-white" />
          </button>

          {/* Image */}
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28 }}
              className="relative flex items-center justify-center"
              style={{ maxWidth: 'min(90vw, 700px)', maxHeight: '90vh' }}
            >
              {!imgLoaded && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(30,24,20,0.3)' }}
                >
                  <div
                    className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }}
                  />
                </div>
              )}
              {currentImage && (
                <img
                  src={currentImage}
                  alt={productName ? `${productName} — image ${index + 1}` : `Image ${index + 1}`}
                  className="max-w-full max-h-[90vh] object-contain"
                  style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
                  onLoad={() => setImgLoaded(true)}
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); }}
              >
                <ChevronLeft size={24} strokeWidth={1.5} className="text-white/80" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length); }}
              >
                <ChevronRight size={24} strokeWidth={1.5} className="text-white/80" />
              </button>
            </>
          )}

          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                  className="transition-all duration-300"
                  style={{
                    width: i === index ? 20 : 6,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: i === index ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}

          {/* Counter */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(255,255,255,0.4)' }}
          >
            {index + 1} / {images.length}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
