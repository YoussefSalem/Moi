import type { MetaFunction } from "@shopify/remix-oxygen";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Delivery Policy — Moi" }];

export default function Delivery() {
  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-2xl mx-auto px-6 pb-20">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-10 transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
          <span style={{ fontFamily: "monospace" }}>←</span> Back
        </Link>
        <h1 className="font-serif font-light mb-8" style={{ color: "#1e1814", fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "0.04em" }}>Delivery Policy</h1>
        <div style={{ color: "rgba(30,24,20,0.7)", lineHeight: 1.85 }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-6" style={{ color: "rgba(30,24,20,0.4)" }}>Last updated: June 2026</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Delivery Areas</h2>
          <p className="mb-5 text-sm leading-relaxed">We deliver across Egypt including Cairo, Giza, Alexandria, and all governorates.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Delivery Times</h2>
          <ul className="mb-5 text-sm leading-relaxed list-none space-y-2">
            <li>Cairo & Giza: 2–4 working days</li>
            <li>Alexandria & Delta: 3–5 working days</li>
            <li>Upper Egypt & other governorates: 5–7 working days</li>
          </ul>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Tracking</h2>
          <p className="mb-5 text-sm leading-relaxed">Once your order is dispatched, you will receive a tracking number by email or SMS. You can track your shipment with our courier partner Bosta.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Cash on Delivery</h2>
          <p className="mb-5 text-sm leading-relaxed">Cash on delivery is available for all orders across Egypt at no extra charge.</p>
          <h2 className="font-serif text-lg mb-3" style={{ color: "#1e1814" }}>Delivery Issues</h2>
          <p className="text-sm leading-relaxed">If your order is delayed or lost in transit, please contact us at <a href="mailto:hello@buy-moi.com" style={{ color: "#1e1814" }}>hello@buy-moi.com</a> and we will resolve it promptly.</p>
        </div>
      </div>
    </div>
  );
}
