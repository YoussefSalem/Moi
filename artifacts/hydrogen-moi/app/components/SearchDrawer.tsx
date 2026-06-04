import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { formatShopifyPrice } from '~/lib/price';

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  handle: string;
  title: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
}

export function SearchDrawer({ open, onClose }: SearchDrawerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/search?q=${encodeURIComponent(query)}&_data=routes/search`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json() as {
            results?: { products?: { nodes: SearchResult[] } }
          };
          const products = data?.results?.products?.nodes ?? [];
          setResults(products);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 z-[90]"
            style={{ backgroundColor: '#faf8f5', boxShadow: '0 8px 40px rgba(20,16,12,0.12)' }}
          >
            <div className="max-w-2xl mx-auto px-6 pt-6 pb-6">
              {/* Input row */}
              <div className="flex items-center gap-4 border-b border-stone-200 pb-4">
                {loading ? (
                  <div
                    className="w-4 h-4 border-2 rounded-full flex-shrink-0 animate-spin"
                    style={{ borderColor: '#b0a090', borderTopColor: '#1e1814' }}
                  />
                ) : (
                  <Search size={17} strokeWidth={1.5} className="flex-shrink-0" style={{ color: '#7a6e64' }} />
                )}
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="flex-1 bg-transparent outline-none text-base"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: '#1e1814',
                    letterSpacing: '0.04em',
                    fontSize: '1.15rem',
                  }}
                />
                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50"
                >
                  <X size={18} strokeWidth={1.5} style={{ color: '#7a6e64' }} />
                </button>
              </div>

              {/* Results */}
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
                      {results.slice(0, 8).map((result) => (
                        <a
                          key={result.id}
                          href={`/products/${result.handle}`}
                          className="flex items-center gap-3 py-2 group"
                          onClick={onClose}
                        >
                          <div
                            className="w-12 h-14 rounded-lg flex-shrink-0 overflow-hidden"
                            style={{ backgroundColor: '#f0ece6' }}
                          >
                            {result.featuredImage && (
                              <img
                                src={result.featuredImage.url}
                                alt={result.featuredImage.altText ?? result.title}
                                className="w-full h-full object-cover object-top"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm truncate group-hover:opacity-70 transition-opacity"
                              style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                color: '#1e1814',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {result.title}
                            </p>
                            <p
                              className="text-[11px] mt-0.5 tracking-[0.1em]"
                              style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
                            >
                              {formatShopifyPrice(result.priceRange.minVariantPrice)}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>

                    {results.length > 0 && (
                      <a
                        href={`/search?q=${encodeURIComponent(query)}`}
                        className="block text-center text-[10px] tracking-[0.3em] uppercase py-2 border-t border-stone-200 transition-opacity hover:opacity-60"
                        style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
                        onClick={onClose}
                      >
                        View all {results.length} results
                      </a>
                    )}
                  </motion.div>
                )}

                {!loading && query.length >= 2 && results.length === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-6 text-center text-[11px] tracking-[0.25em] uppercase"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
                  >
                    No results for "{query}"
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
