import type { MetaFunction } from "@shopify/remix-oxygen";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Refund Policy — Moi" }];

export default function Refund() {
  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-2xl mx-auto px-6 pb-20">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-10 transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
          <span style={{ fontFamily: "monospace" }}>←</span> Back
        </Link>
        <h1 className="font-serif font-light mb-8" style={{ color: "#1e1814", fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "0.04em" }}>Refund Policy</h1>
        <div style={{ color: "rgba(30,24,20,0.7)", lineHeight: 1.85 }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-6" style={{ color: "rgba(30,24,20,0.4)" }}>Last updated: June 2026</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Refund Eligibility</h2>
          <p className="mb-5 text-sm leading-relaxed">We accept refund requests within 14 days of delivery for items that are unworn, unwashed, and in their original condition with all tags attached.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Non-Refundable Items</h2>
          <p className="mb-5 text-sm leading-relaxed">Sale items, accessories, and items showing signs of wear are not eligible for refunds.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Refund Process</h2>
          <p className="mb-5 text-sm leading-relaxed">To initiate a refund, contact us at <a href="mailto:hello@buy-moi.com" style={{ color: "#1e1814" }}>hello@buy-moi.com</a> with your order number. Once your return is received and inspected, we will process your refund within 5–7 business days.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Shipping Costs</h2>
          <p className="text-sm leading-relaxed">Return shipping costs are the responsibility of the customer unless the item is defective or incorrect.</p>
        </div>
      </div>
    </div>
  );
}
