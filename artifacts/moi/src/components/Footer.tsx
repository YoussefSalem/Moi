import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Instagram, Twitter } from "lucide-react";
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
      body: "For more inquiries, email info@zuricairo.com or use the contact option in the footer menu. We aim to reply as quickly as possible.",
    },
  ];

  const quickLinks: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }> = [
    {
      title: "Shop",
      links: [
        { label: "New In", href: "#" },
        { label: "Clothing", href: "#" },
        { label: "Accessories", href: "#" },
        { label: "Sale", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Moi", href: "#" },
        { label: "Sustainability", href: "#" },
        { label: "Press", href: "#" },
        { label: "Careers", href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms", href: "#" },
        { label: "Cookies", href: "#" },
      ],
    },
  ];

  return (
    <>
      <footer className="w-full px-6 md:px-12 py-14 md:py-18" style={{ backgroundColor: "#f3f1ec" }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 border-t border-black/10 pt-8">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-[10px] tracking-[0.35em] uppercase text-black/45">Moi</p>
                <p className="mt-3 max-w-xl text-sm md:text-base leading-7 text-black/60">
                  Elegant support, thoughtful care, and a smooth shopping experience.
                </p>
              </div>
              <div className="hidden md:flex gap-4">
                <a href="#" className="transition-opacity hover:opacity-50" aria-label="Instagram">
                  <Instagram size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                </a>
                <a href="#" className="transition-opacity hover:opacity-50" aria-label="Twitter">
                  <Twitter size={18} strokeWidth={1.5} style={{ color: "#1e1814" }} />
                </a>
              </div>
            </div>
            <div className="space-y-3 rounded-3xl bg-[#ebe6dd] p-4 md:p-5" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)" }}>
              {accordionSections.map((item) => {
                const isOpen = openSection === item.title.toLowerCase().replace(/\s+/g, "-");
                const key = item.title.toLowerCase().replace(/\s+/g, "-");
                return (
                  <div key={item.title} className="border-b border-black/10 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenSection(isOpen ? null : key)}
                      className="w-full flex items-center justify-between py-5 text-left"
                    >
                      <div>
                        <p className="text-[10px] tracking-[0.28em] uppercase text-black/35">{item.title}</p>
                        <p className="mt-2 text-sm md:text-base text-black/70">{item.description}</p>
                      </div>
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.28 }}>
                        <ChevronDown size={18} strokeWidth={1.5} className="text-black/45" />
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
                          <div className="pb-6 text-sm leading-7 text-black/60 max-w-2xl">
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 mt-12">
            {quickLinks.map((col) => (
              <div key={col.title}>
                <p className="text-[10px] tracking-[0.3em] uppercase mb-5 text-black/40">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-black/65 hover:text-black transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-black/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-[10px] tracking-[0.3em] uppercase text-black/35">© 2026 Moi. All rights reserved.</p>
            <p className="text-[10px] tracking-[0.22em] uppercase text-black/35">Smooth, elegant, minimal.</p>
          </div>
        </div>
      </footer>

    </>
  );
}
