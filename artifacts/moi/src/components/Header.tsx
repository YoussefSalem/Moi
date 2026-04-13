import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, User, X } from "lucide-react";

interface HeaderProps {
  onNavigate?: (page: "home" | "accessories") => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = ["Clothing", "Accessories"];

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          backgroundColor: scrolled ? "rgba(250, 248, 245, 0.97)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(180,160,140,0.18)" : "1px solid transparent",
          boxShadow: scrolled ? "0 2px 20px rgba(20,16,12,0.06)" : "none",
        }}
      >
        <div className="flex items-center justify-between px-6 md:px-12 h-16">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col gap-1.5 w-8 h-8 items-center justify-center group"
            aria-label="Open menu"
          >
            <span
              className="block w-6 h-px transition-all duration-300"
              style={{ backgroundColor: scrolled ? "#1e1814" : "#fff" }}
            />
            <span
              className="block w-4 h-px transition-all duration-300 group-hover:w-6"
              style={{ backgroundColor: scrolled ? "#1e1814" : "#fff" }}
            />
          </button>

          <a
            href="#"
            className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl tracking-[0.3em] font-light select-none transition-colors duration-500"
            style={{ color: scrolled ? "#1e1814" : "#fff", letterSpacing: "0.35em" }}
          >
            MOI
          </a>

          <div className="flex items-center gap-5">
            <button aria-label="Search" className="transition-opacity hover:opacity-60">
              <Search
                size={18}
                strokeWidth={1.5}
                style={{ color: scrolled ? "#1e1814" : "#fff" }}
              />
            </button>
            <button aria-label="Account" className="transition-opacity hover:opacity-60">
              <User
                size={18}
                strokeWidth={1.5}
                style={{ color: scrolled ? "#1e1814" : "#fff" }}
              />
            </button>
            <button aria-label="Cart" className="transition-opacity hover:opacity-60 relative">
              <ShoppingBag
                size={18}
                strokeWidth={1.5}
                style={{ color: scrolled ? "#1e1814" : "#fff" }}
              />
              <span
                className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full text-[9px] font-medium flex items-center justify-center"
                style={{ backgroundColor: scrolled ? "#1e1814" : "#fff", color: scrolled ? "#fff" : "#1e1814" }}
              >
                0
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.nav
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
              className="fixed top-0 left-0 bottom-0 z-[70] w-80 flex flex-col"
              style={{ backgroundColor: "#faf8f5" }}
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-stone-200">
                <span className="font-serif text-xl tracking-[0.3em]" style={{ color: "#1e1814" }}>
                  MOI
                </span>
                <button onClick={() => setMenuOpen(false)} className="transition-opacity hover:opacity-50">
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-10 px-8">
                <ul className="space-y-8">
                  {navLinks.map((link, i) => (
                    <motion.li
                      key={link}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                    >
                      <a
                        href={link === "Accessories" ? "#accessories" : "#"}
                        className="block text-2xl font-light tracking-wide hover:opacity-50 transition-opacity"
                        style={{ color: "#1e1814", letterSpacing: "0.08em" }}
                        onClick={() => {
                          setMenuOpen(false);
                          if (link === "Accessories") onNavigate?.("accessories");
                        }}
                      >
                        {link}
                      </a>
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-16 pt-8 border-t border-stone-200 space-y-4">
                  {["Sign In"].map((link) => (
                    <a
                      key={link}
                      href="#"
                      className="block text-sm tracking-widest uppercase hover:opacity-50 transition-opacity"
                      style={{ color: "#7a6e64", letterSpacing: "0.15em" }}
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
