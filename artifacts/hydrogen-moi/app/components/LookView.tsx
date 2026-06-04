import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';

interface LookItem {
  id: string;
  label: string;
  image: string;
  name: string;
  price?: string;
  href: string;
}

interface LookViewProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  modelImage?: string;
  items?: LookItem[];
}

export function LookView({ isOpen, onClose, title = 'The Look', modelImage, items = [] }: LookViewProps) {
  const [activeItem, setActiveItem] = useState<LookItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setActiveItem(null);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="look-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[150] overflow-hidden"
          style={{ backgroundColor: '#1a1410' }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 flex items-center gap-2 transition-opacity hover:opacity-60"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <span className="hidden md:block text-[10px] tracking-[0.3em] uppercase text-white/55">
              Close
            </span>
            <X size={20} strokeWidth={1.5} className="text-white/70" />
          </button>

          <div className="h-full flex flex-col md:flex-row">
            {/* Model image */}
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full md:w-1/2 lg:w-2/5 h-[55vh] md:h-full relative overflow-hidden"
            >
              {modelImage ? (
                <img
                  src={modelImage}
                  alt={title}
                  className="w-full h-full object-cover object-top look-img-fade"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <p
                    className="text-xs tracking-widest uppercase"
                    style={{ color: 'rgba(200,185,165,0.3)', fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Look image
                  </p>
                </div>
              )}
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-16 py-8 overflow-y-auto"
            >
              <p
                className="text-[9px] tracking-[0.6em] uppercase mb-4"
                style={{ color: 'rgba(200,185,165,0.45)', fontFamily: "'Montserrat', sans-serif" }}
              >
                Shop The Look
              </p>
              <h2
                className="mb-8"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
                  fontWeight: 300,
                  color: '#fff',
                  letterSpacing: '0.05em',
                }}
              >
                {title}
              </h2>

              {/* Look items */}
              {items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      className="flex items-center gap-4 group cursor-pointer"
                      onClick={() => setActiveItem(item === activeItem ? null : item)}
                    >
                      <div
                        className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[10px] tracking-[0.2em] uppercase mb-0.5"
                          style={{ color: 'rgba(200,185,165,0.45)', fontFamily: "'Montserrat', sans-serif" }}
                        >
                          {item.label}
                        </p>
                        <p
                          className="text-sm truncate"
                          style={{
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            color: 'rgba(255,255,255,0.8)',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {item.name}
                        </p>
                        {item.price && (
                          <p
                            className="text-[11px] mt-0.5 tracking-[0.1em]"
                            style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(200,185,165,0.55)' }}
                          >
                            {item.price}
                          </p>
                        )}
                      </div>
                      <a
                        href={item.href}
                        className="text-[9px] tracking-[0.3em] uppercase px-3 py-2 border transition-colors"
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          color: 'rgba(255,255,255,0.55)',
                          borderColor: 'rgba(255,255,255,0.2)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Shop
                      </a>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p
                  className="text-sm leading-7"
                  style={{ color: 'rgba(200,185,165,0.55)', fontWeight: 300 }}
                >
                  A carefully curated look. Each piece chosen to complement the next.
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
