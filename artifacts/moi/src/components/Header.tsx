import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";

interface HeaderProps {
  onNavigate?: (page: "home" | "accessories" | "ambassador", hash?: string) => void;
  onSearch?: () => void;
  dark?: boolean;
  page?: string;
  zIndex?: number;
}

function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Instagram|FB_IAB|FBAN|FBAV|Messenger|WhatsApp|Twitter/i.test(ua);
}

export function Header({ onNavigate, onSearch, dark, page, zIndex }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount, openCart, isAddingToCart } = useCart();
  const { customer, openAuth, openAccount, signOut } = useCustomer();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const inAppBrowser = useMemo(() => isInAppBrowser(), []);

  useEffect(() => {
    if (inAppBrowser) {
      document.body.style.setProperty("--header-offset", "calc(44px + env(safe-area-inset-top))");
    } else {
      document.body.style.removeProperty("--header-offset");
    }
  }, [inAppBrowser]);

  const iconColor = dark ? "#1e1814" : scrolled ? "#1e1814" : "#fff";
  const navLinks = [
    { label: "Wavvy Top", href: "/", scrollTo: "moi-wavvy", isHome: true },
    { label: "Versa Top", href: "/", scrollTo: "moi-versa-top", isHome: true },
    { label: "Accessories", href: "/accessories", scrollTo: "accessories" },
    { label: "Ambassador", href: "/ambassador", scrollTo: "ambassador" },
  ];
  const displayName = customer?.firstName ?? customer?.email?.split("@")[0] ?? null;
  const extraTop = inAppBrowser ? 44 : 0;

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          willChange: "transform",
          zIndex: zIndex ?? 50,
          paddingTop: `calc(${extraTop}px + env(safe-area-inset-top))`,
          backgroundColor: dark ? "rgba(30,24,20,0.08)" : scrolled ? "rgba(250, 248, 245, 0.97)" : "transparent",
          WebkitBackdropFilter: dark || scrolled ? "blur(12px)" : "none",
          backdropFilter: dark || scrolled ? "blur(12px)" : "none",
          borderBottom: dark ? "1px solid rgba(30,24,20,0.12)" : scrolled ? "1px solid rgba(180,160,140,0.18)" : "1px solid transparent",
          boxShadow: dark ? "0 2px 20px rgba(20,16,12,0.04)" : scrolled ? "0 2px 20px rgba(20,16,12,0.06)" : "none",
          transition: "background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-6 md:px-12 h-16">
          <button
            onClick={() => {
              if (page === "home") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                onNavigate?.("home");
              }
            }}
            className="absolute left-1/2 -translate-x-1/2 font-serif select-none transition-colors duration-500"
            style={{ color: iconColor, letterSpacing: "0.3em", fontSize: "1.82rem" }}
            aria-label="Go to home"
          >
            MOI
          </button>

          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col gap-1.5 w-11 h-11 items-center justify-center group -ml-1"
            aria-label="Open menu"
          >
            <span className="block w-6 h-px transition-all duration-300" style={{ backgroundColor: iconColor }} />
            <span className="block w-4 h-px transition-all duration-300 group-hover:w-6" style={{ backgroundColor: iconColor }} />
          </button>

          <div className="flex items-center gap-1">
            <button aria-label="Search" className="w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-60" onClick={onSearch}>
              <Search size={18} strokeWidth={1.5} style={{ color: iconColor }} />
            </button>

            <button
              aria-label={customer ? "My Account" : "Sign In"}
              className="w-11 h-11 flex items-center justify-center gap-1.5 transition-opacity hover:opacity-60"
              onClick={customer ? openAccount : openAuth}
            >
              <User size={18} strokeWidth={1.5} style={{ color: iconColor }} />
              {displayName && (
                <span
                  className="hidden md:block text-[10px] tracking-[0.18em] uppercase font-light"
                  style={{ color: iconColor }}
                >
                  {displayName}
                </span>
              )}
            </button>

            <button
              aria-label="Cart"
              className="w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-60 relative"
              onClick={openCart}
            >
              {/* Pulse ring — visible during the "adding to cart" window */}
              <AnimatePresence>
                {isAddingToCart && (
                  <motion.span
                    key="add-pulse"
                    initial={{ scale: 0.5, opacity: 0.7 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ border: `1.5px solid ${iconColor}` }}
                  />
                )}
              </AnimatePresence>
              <motion.span
                animate={isAddingToCart ? { scale: [1, 1.25, 1], y: [0, -3, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ShoppingBag size={18} strokeWidth={1.5} style={{ color: iconColor }} />
              </motion.span>
              <AnimatePresence>
                {itemCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-[4px] right-[6px] w-3.5 h-3.5 rounded-full text-[9px] font-medium flex items-center justify-center"
                    style={{
                      backgroundColor: iconColor,
                      color: iconColor === "#fff" ? "#1e1814" : "#fff",
                    }}
                  >
                    {itemCount > 9 ? "9+" : itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
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
              className="fixed top-0 left-0 bottom-0 z-[70] w-full max-w-xs flex flex-col"
              style={{ backgroundColor: "#faf8f5" }}
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-stone-200">
                <span className="font-serif text-xl tracking-[0.3em]" style={{ color: "#1e1814" }}>MOI</span>
                <button onClick={() => setMenuOpen(false)} className="w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-50 -mr-2">
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-10 px-8">
                <ul className="space-y-8">
                  {navLinks.map((link, i) => (
                    <motion.li
                      key={link.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                    >
                      <a
                        href={link.href}
                        className="block text-2xl font-light tracking-wide hover:opacity-50 transition-opacity"
                        style={{ color: "#1e1814", letterSpacing: "0.08em" }}
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpen(false);
                          if ((link as { isHome?: boolean }).isHome) {
                            onNavigate?.("home", link.scrollTo);
                          } else {
                            onNavigate?.(link.scrollTo as "home" | "accessories" | "ambassador");
                          }
                        }}
                      >
                        {link.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-16 pt-8 border-t border-stone-200 space-y-4">
                  {customer ? (
                    <>
                      <button
                        className="text-sm font-light tracking-wide text-left hover:opacity-50 transition-opacity"
                        style={{ color: "#1e1814" }}
                        onClick={() => { setMenuOpen(false); openAccount(); }}
                      >
                        {customer.firstName
                          ? `${customer.firstName}${customer.lastName ? ` ${customer.lastName}` : ""}`
                          : customer.email.split("@")[0]}
                      </button>
                      <button
                        className="block text-sm tracking-widest uppercase hover:opacity-50 transition-opacity"
                        style={{ color: "#7a6e64", letterSpacing: "0.15em" }}
                        onClick={() => { setMenuOpen(false); signOut(); }}
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <button
                      className="block text-sm tracking-widest uppercase hover:opacity-50 transition-opacity"
                      style={{ color: "#7a6e64", letterSpacing: "0.15em" }}
                      onClick={() => { setMenuOpen(false); openAuth(); }}
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
