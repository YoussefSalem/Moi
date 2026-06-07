import type { MetaFunction } from "@shopify/remix-oxygen";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — Moi" },
];

export default function Privacy() {
  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-2xl mx-auto px-6 pb-20">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-10 transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
          <span style={{ fontFamily: "monospace" }}>←</span> Back
        </Link>
        <h1 className="font-serif font-light mb-8" style={{ color: "#1e1814", fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "0.04em" }}>
          Privacy Policy
        </h1>
        <div className="prose prose-sm max-w-none" style={{ color: "rgba(30,24,20,0.7)", lineHeight: 1.85, fontFamily: "'Montserrat', sans-serif" }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-6" style={{ color: "rgba(30,24,20,0.4)" }}>
            Last updated: June 2026
          </p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Information We Collect</h2>
          <p className="mb-5 text-sm leading-relaxed">
            We collect information you provide directly to us when you create an account, make a purchase, or contact us. This includes your name, email address, shipping address, payment information, and phone number.
          </p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>How We Use Your Information</h2>
          <p className="mb-5 text-sm leading-relaxed">
            We use your information to process orders, provide customer service, send transactional emails, and improve our services. With your consent, we may send marketing communications.
          </p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Data Sharing</h2>
          <p className="mb-5 text-sm leading-relaxed">
            We do not sell your personal data. We share information with service providers who assist in our operations (Shopify, delivery partners, payment processors) under strict confidentiality agreements.
          </p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Your Rights</h2>
          <p className="mb-5 text-sm leading-relaxed">
            You may request access to, correction of, or deletion of your personal data by contacting us at <a href="mailto:hello@buy-moi.com" style={{ color: "#1e1814" }}>hello@buy-moi.com</a>.
          </p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Contact</h2>
          <p className="text-sm leading-relaxed">
            For privacy-related inquiries, contact us at <a href="mailto:hello@buy-moi.com" style={{ color: "#1e1814" }}>hello@buy-moi.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
