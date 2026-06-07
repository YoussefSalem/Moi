import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { Link } from "@remix-run/react";

interface SearchResult {
  id: string;
  title: string;
  handle: string;
  price?: string;
  image?: string;
}

const STATIC_PRODUCTS: SearchResult[] = [
  { id: "wavvy", title: "MOI WAVVY", handle: "moi-wavvy", price: "899 EGP", image: "/images/light-blue.jpg" },
  { id: "versa", title: "MOI VERSA TOP", handle: "moi-versa-top", price: "1,399 EGP", image: "/images/white.jpg" },
  { id: "bangles", title: "Trio Bangles", handle: "trio-bangles", price: "890 EGP", image: "/images/bangles-main.jpg" },
];

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = query.length >= 2
    ? STATIC_PRODUCTS.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase())
      )
    : STATIC_PRODUCTS;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 z-[81]"
            style={{ backgroundColor: "#faf8f5", borderBottom: "1px solid rgba(30,24,20,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 px-6 md:px-12"
              style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))", paddingBottom: "1rem" }}
            >
              <Search size={16} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.45)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search Moi…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-base"
                style={{ color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}
              />
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-50 -mr-1"
                aria-label="Close search"
              >
                <X size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
              </button>
            </div>

            {results.length > 0 && (
              <div className="px-6 md:px-12 pb-4">
                <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(30,24,20,0.4)" }}>
                  {query.length >= 2 ? `Results for "${query}"` : "Products"}
                </p>
                <div className="flex flex-col divide-y" style={{ divideColor: "rgba(30,24,20,0.06)" }}>
                  {results.map((product) => (
                    <Link
                      key={product.id}
                      to={`/products/${product.handle}`}
                      onClick={onClose}
                      className="flex items-center gap-3 py-3 transition-opacity hover:opacity-70"
                    >
                      {product.image && (
                        <div className="w-10 h-12 flex-shrink-0 overflow-hidden" style={{ backgroundColor: "#ede8e3" }}>
                          <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] tracking-[0.12em] uppercase font-medium" style={{ color: "#1e1814" }}>{product.title}</p>
                        {product.price && (
                          <p className="text-[11px] mt-0.5" style={{ color: "rgba(30,24,20,0.55)" }}>{product.price}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
