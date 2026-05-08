import { useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Twitter } from "lucide-react";
import { ContactModal } from "@/components/ContactModal";

const BASE = import.meta.env.BASE_URL ?? "/";

async function subscribeEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}api/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { success: false, error: body.error ?? "Something went wrong." };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Unable to subscribe. Please try again." };
  }
}

export function Footer() {
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subError, setSubError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubStatus("loading");
    setSubError("");
    const result = await subscribeEmail(email);
    if (result.success) {
      setSubStatus("success");
      setEmail("");
    } else {
      setSubStatus("error");
      setSubError(result.error ?? "Something went wrong.");
    }
  };

  const footerLinks = [
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
      title: "Help",
      links: [
        { label: "Size Guide", href: "#" },
        { label: "Shipping", href: "#" },
        { label: "Returns", href: "#" },
        { label: "Contact", href: "#", onClick: () => setContactOpen(true) },
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
      <footer className="w-full py-20 px-6 md:px-12" style={{ backgroundColor: "#1e1814" }}>
        <div className="max-w-7xl mx-auto">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <a
              href="#"
              className="font-serif text-4xl tracking-[0.4em] font-light"
              style={{ color: "#faf8f5", letterSpacing: "0.5em" }}
            >
              MOI
            </a>
            <p
              className="mt-4 text-[10px] tracking-[0.4em] uppercase font-light"
              style={{ color: "rgba(250,248,245,0.4)" }}
            >
              Curated Fashion
            </p>
          </motion.div>

          {/* Newsletter */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="max-w-md mx-auto mb-16 text-center"
          >
            <p
              className="text-[10px] tracking-[0.35em] uppercase mb-5 font-light"
              style={{ color: "rgba(250,248,245,0.5)" }}
            >
              Stay in the World of Moi
            </p>
            {subStatus === "success" ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] tracking-[0.2em] uppercase font-light"
                style={{ color: "rgba(250,248,245,0.6)" }}
              >
                Thank you for subscribing.
              </motion.p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-0">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="flex-1 px-4 py-3 text-[11px] tracking-wide bg-transparent outline-none placeholder:opacity-30 font-light"
                  style={{
                    color: "#faf8f5",
                    border: "1px solid rgba(250,248,245,0.18)",
                    borderRight: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={subStatus === "loading"}
                  className="px-6 py-3 text-[10px] tracking-[0.28em] uppercase font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    backgroundColor: "rgba(250,248,245,0.12)",
                    color: "#faf8f5",
                    border: "1px solid rgba(250,248,245,0.18)",
                  }}
                >
                  {subStatus === "loading" ? "…" : "Subscribe"}
                </button>
              </form>
            )}
            {subStatus === "error" && (
              <p className="mt-2 text-[10px] tracking-wide" style={{ color: "rgba(255,160,120,0.8)" }}>
                {subError}
              </p>
            )}
          </motion.div>

          <div className="w-full h-px mb-16" style={{ backgroundColor: "rgba(250,248,245,0.1)" }} />

          {/* Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {footerLinks.map((col) => (
              <div key={col.title}>
                <p
                  className="text-[10px] tracking-[0.35em] uppercase mb-6 font-medium"
                  style={{ color: "rgba(250,248,245,0.5)" }}
                >
                  {col.title}
                </p>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        onClick={link.onClick ? (e) => { e.preventDefault(); link.onClick!(); } : undefined}
                        className="text-sm font-light tracking-wide hover:opacity-50 transition-opacity"
                        style={{ color: "rgba(250,248,245,0.75)" }}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="w-full h-px mb-10" style={{ backgroundColor: "rgba(250,248,245,0.1)" }} />

          {/* Bottom bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p
              className="text-[10px] tracking-widest uppercase font-light"
              style={{ color: "rgba(250,248,245,0.3)" }}
            >
              © 2026 Moi. All rights reserved.
            </p>
            <div className="flex gap-5">
              <a href="#" className="transition-opacity hover:opacity-50" aria-label="Instagram">
                <Instagram size={18} strokeWidth={1.5} style={{ color: "rgba(250,248,245,0.5)" }} />
              </a>
              <a href="#" className="transition-opacity hover:opacity-50" aria-label="Twitter">
                <Twitter size={18} strokeWidth={1.5} style={{ color: "rgba(250,248,245,0.5)" }} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
