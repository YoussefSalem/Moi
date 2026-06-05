import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Instagram } from "lucide-react";
import { NewsletterSection } from "@/components/NewsletterSection";

interface FooterProps {
  onNavigate?: (page: "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery", hash?: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const [openSection, setOpenSection] = useState<string | null>("return");

  const accordionSections: Array<{ title: string; description: string; body: string }> = [
    {
      title: "Care instructions",
      description: "Handle each piece with care to preserve fit, texture, and finish over time.",
      body: "We recommend gentle cleaning, low heat drying, and storing garments away from direct sunlight. For more delicate pieces, professional care is best.",
    },
    {
      title: "Return policy",
      description: "Simple returns within the policy window for eligible items.",
      body: "Please keep items unworn, with original packaging and tags attached. If you need help with an exchange or return, contact us and we will guide you through the process.",
    },
    {
      title: "Shipping",
      description: "Fast, tracked delivery with clear timing by region.",
      body: "Delivery times vary by location. Orders in Cairo and Giza typically arrive within 3 to 4 days, while governorates may take 5 to 6 working days. Tracking details are shared once your order is processed.",
    },
    {
      title: "Contact us",
      description: "Reach the team for product, order, or policy questions.",
      body: "For more inquiries, email Hello@buy-moi.com or use the contact option in the footer menu. We aim to reply as quickly as possible.",
    },
  ];

  return (
    <>
      <footer className="w-full px-6 md:px-12 py-10 md:py-14" style={{ backgroundColor: "#28211d" }}>
        <div className="max-w-6xl mx-auto">
          {/* Quick links — replace old Clothing with Versa Top / Wavvy top */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mb-6">
            {[
              { label: "Clothing", page: "home" as const, hash: "collection" as string | undefined },
              { label: "Accessories", page: "accessories" as const, hash: undefined as string | undefined },
              { label: "Ambassador", page: "ambassador" as const, hash: undefined as string | undefined },
            ].map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => onNavigate?.(link.page, link.hash)}
                className="text-[10px] tracking-[0.25em] uppercase text-white/45 hover:text-white/80 transition-colors duration-300"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Social links */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <a
              href="https://www.instagram.com/shopmoi/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 transition-all duration-300 hover:opacity-100 opacity-70"
            >
              <Instagram size={22} strokeWidth={1.5} className="text-white/80 group-hover:text-white transition-colors" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-white/60 group-hover:text-white/90 transition-colors font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Follow us on Instagram
              </span>
            </a>
            <div className="w-px h-4 bg-white/15" />
            <a
              href="https://www.tiktok.com/@shopmoi_?_r=1&_t=ZS-96Mp1lQiOZO"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 transition-all duration-300 hover:opacity-100 opacity-70"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 group-hover:text-white transition-colors">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </svg>
              <span className="text-[11px] tracking-[0.25em] uppercase text-white/60 group-hover:text-white/90 transition-colors font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Follow us on TikTok
              </span>
            </a>
          </div>

          <div className="mb-10 border-t border-white/10 pt-8">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-[10px] tracking-[0.35em] uppercase text-white/45">Moi</p>
                <p className="mt-3 max-w-xl text-sm md:text-base leading-7 text-white/65">
                  Shop versatile tops, elegant clothing, and curated fashion accessories designed for effortless everyday style.
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-3xl bg-[#342b26] p-4 md:p-5" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
              {accordionSections.map((item) => {
                const isOpen = openSection === item.title.toLowerCase().replace(/\s+/g, "-");
                const key = item.title.toLowerCase().replace(/\s+/g, "-");
                return (
                  <div key={item.title} className="border-b border-white/10 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenSection(isOpen ? null : key)}
                      className="w-full flex items-center justify-between py-5 text-left"
                    >
                      <div>
                        <p className="text-[10px] tracking-[0.28em] uppercase text-white/40">{item.title}</p>
                        <p className="mt-2 text-sm md:text-base text-white/70">{item.description}</p>
                      </div>
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.28 }}>
                        <ChevronDown size={18} strokeWidth={1.5} className="text-white/45" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.76, 0, 0.24, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="pb-6 text-sm leading-7 text-white/60 max-w-2xl">
                            {item.body}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <NewsletterSection />

          <div className="mt-12 pt-6 border-t border-white/10">
            {/* Policy links — subtle, minimal */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-5">
              {[
                { label: "Privacy Policy", page: "privacy" as const },
                { label: "Refund Policy", page: "refund" as const },
                { label: "Return Policy", page: "return" as const },
                { label: "Delivery Policy", page: "delivery" as const },
              ].map((link) => (
                <a
                  key={link.page}
                  href={`/${link.page}`}
                  onClick={(e) => { e.preventDefault(); onNavigate?.(link.page); }}
                  className="text-[9px] tracking-[0.25em] uppercase text-white/35 hover:text-white/70 transition-colors duration-300"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Contact info — even more subtle */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-5">
              <a href="mailto:hello@buy-moi.com" className="text-[9px] tracking-[0.2em] text-white/25 hover:text-white/55 transition-colors duration-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                hello@buy-moi.com
              </a>
              <span className="text-white/15 hidden md:inline">|</span>
              <a href="tel:+201200520083" className="text-[9px] tracking-[0.2em] text-white/25 hover:text-white/55 transition-colors duration-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                +20 120 052 0083
              </a>
              <span className="text-white/15 hidden md:inline">|</span>
              <span className="text-[9px] tracking-[0.2em] text-white/25" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                58 Sotar Street, Azarita, Bab Sharq, Alexandria, Egypt
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/35">© 2026 Moi. All rights reserved.</p>
              <p className="text-[10px] tracking-[0.22em] uppercase text-white/35">Premium versatile tops.</p>
            </div>
          </div>
        </div>
      </footer>

    </>
  );
}
