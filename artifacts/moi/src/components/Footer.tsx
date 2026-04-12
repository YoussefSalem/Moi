import { motion } from "framer-motion";
import { Instagram, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer
      className="w-full py-20 px-6 md:px-12"
      style={{ backgroundColor: "#1e1814" }}
    >
      <div className="max-w-7xl mx-auto">
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

        <div
          className="w-full h-px mb-16"
          style={{ backgroundColor: "rgba(250,248,245,0.1)" }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          {[
            {
              title: "Shop",
              links: ["New In", "Clothing", "Accessories", "Sale"],
            },
            {
              title: "Help",
              links: ["Size Guide", "Shipping", "Returns", "Contact"],
            },
            {
              title: "Company",
              links: ["About Moi", "Sustainability", "Press", "Careers"],
            },
            {
              title: "Legal",
              links: ["Privacy Policy", "Terms", "Cookies"],
            },
          ].map((col) => (
            <div key={col.title}>
              <p
                className="text-[10px] tracking-[0.35em] uppercase mb-6 font-medium"
                style={{ color: "rgba(250,248,245,0.5)" }}
              >
                {col.title}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm font-light tracking-wide hover:opacity-50 transition-opacity"
                      style={{ color: "rgba(250,248,245,0.75)" }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="w-full h-px mb-10"
          style={{ backgroundColor: "rgba(250,248,245,0.1)" }}
        />

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
  );
}
