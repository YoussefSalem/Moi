import type { MetaFunction } from "@shopify/remix-oxygen";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Return Policy — Moi" }];

export default function Return() {
  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-2xl mx-auto px-6 pb-20">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-10 transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
          <span style={{ fontFamily: "monospace" }}>←</span> Back
        </Link>
        <h1 className="font-serif font-light mb-8" style={{ color: "#1e1814", fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "0.04em" }}>Return Policy</h1>
        <div style={{ color: "rgba(30,24,20,0.7)", lineHeight: 1.85 }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-6" style={{ color: "rgba(30,24,20,0.4)" }}>Last updated: June 2026</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Return Window</h2>
          <p className="mb-5 text-sm leading-relaxed">You may return eligible items within 14 days of receiving your order.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Condition Requirements</h2>
          <p className="mb-5 text-sm leading-relaxed">Items must be unworn, unwashed, unaltered, and in their original packaging with all tags and labels attached.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>How to Return</h2>
          <p className="mb-5 text-sm leading-relaxed">Contact our team at <a href="mailto:hello@buy-moi.com" style={{ color: "#1e1814" }}>hello@buy-moi.com</a> with your order number and reason for return. We will provide instructions and a return address.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Exchanges</h2>
          <p className="text-sm leading-relaxed">We offer exchanges for different sizes or colours subject to availability. Contact us to arrange an exchange.</p>
        </div>
      </div>
    </div>
  );
}
