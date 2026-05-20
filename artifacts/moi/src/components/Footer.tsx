import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Instagram } from "lucide-react";
import { NewsletterSection } from "@/components/NewsletterSection";
export function Footer() {
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

  const quickLinks: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }> = [
    {
      title: "Shop",
      links: [
        { label: "New In", href: "/new-in" },
        { label: "Clothing", href: "/clothing" },
        { label: "Accessories", href: "/accessories" },
        { label: "Sale", href: "/sale" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Moi", href: "/about" },
        { label: "Sustainability", href: "/sustainability" },
        { label: "Press", href: "/press" },
        { label: "Careers", href: "/careers" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Cookies", href: "/cookies" },
      ],
    },
  ];

  return (
    <>
      <footer className="w-full px-6 md:px-12 py-14 md:py-18" style={{ backgroundColor: "#28211d" }}>
        <div className="max-w-6xl mx-auto">
          {/* Trust badges row */}
          <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap mb-8 pb-8 border-b border-white/8">
            {[
              { label: "Cash on Delivery", desc: "Pay when it arrives" },
              { label: "24h Shipping", desc: "Orders ship same day" },
              { label: "Free Shipping 2,000+", desc: "Complimentary delivery" },
            ].map((b, i) => (
              <div key={i} className="text-center">
                <p
                  className="text-[9px] tracking-[0.28em] uppercase font-medium"
                  style={{ color: "rgba(220,208,190,0.7)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {b.label}
                </p>
                <p
                  className="text-[8px] tracking-[0.12em] uppercase mt-1"
                  style={{ color: "rgba(220,208,190,0.38)", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {b.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Social links */}
          <div className="flex items-center justify-center gap-6 mb-10">
            <a
              href="https://www.instagram.com/shopmoi___?igsh=MW5xa3lvaXB3dmF3cw%3D%3D&utm_source=qr"
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
                  Shop versatile tops, elegant clothing, and curated fashion accessories designed for effortless everyday style in Egypt.
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

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/35">© 2026 Moi. All rights reserved.</p>
            <p className="text-[10px] tracking-[0.22em] uppercase text-white/35">Smooth, elegant, minimal.</p>
          </div>
        </div>
      </footer>

    </>
  );
}
