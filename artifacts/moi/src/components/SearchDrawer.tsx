import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import type { ProductConfig } from "@/config/images";

interface SearchDrawerProps {
  open: boolean;
  products: ProductConfig[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelect: (product: ProductConfig) => void;
}

export function SearchDrawer({ open, products, query, onQueryChange, onClose, onSelect }: SearchDrawerProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? products.filter((product) => {
      const haystack = [
        product.name,
        product.description,
        product.ref,
        ...(product.variants?.flatMap((variant) => variant.selectedOptions.map((option) => option.value)) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    : products;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "tween", duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl overflow-hidden" style={{ backgroundColor: "#faf8f5" }}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
                <div className="flex items-center gap-3">
                  <Search size={16} strokeWidth={1.6} style={{ color: "#1e1814" }} />
                  <span className="text-[11px] tracking-[0.28em] uppercase" style={{ color: "#1e1814" }}>
                    Search Products
                  </span>
                </div>
                <button onClick={onClose} aria-label="Close search" className="hover:opacity-60 transition-opacity">
                  <X size={18} strokeWidth={1.6} style={{ color: "#1e1814" }} />
                </button>
              </div>

              <div className="p-6">
                <input
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search by product, color, or ref"
                  className="w-full px-4 py-3 text-base tracking-wide outline-none bg-transparent"
                  style={{ border: "1px solid rgba(30,24,20,0.14)", color: "#1e1814", fontSize: "16px" }}
                  autoFocus
                />

                <div className="mt-5 max-h-[55vh] overflow-y-auto pr-1 grid gap-3">
                  {results.length > 0 ? results.map((product) => (
                    <button
                      key={product.ref}
                      type="button"
                      onClick={() => onSelect(product)}
                      className="flex items-center gap-4 text-left p-3 transition-colors hover:bg-black/5"
                    >
                      <img
                        src={product.productShot}
                        alt={product.name}
                        className="w-16 h-20 object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm uppercase tracking-[0.16em]" style={{ color: "#1e1814" }}>{product.name}</p>
                        <p className="text-[11px] mt-1" style={{ color: "#7a6e64" }}>{product.ref}</p>
                        <p className="text-[11px] mt-1 truncate" style={{ color: "#7a6e64" }}>{product.description}</p>
                      </div>
                    </button>
                  )) : (
                    <p className="text-[11px] tracking-wide" style={{ color: "#7a6e64" }}>
                      No products found.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}