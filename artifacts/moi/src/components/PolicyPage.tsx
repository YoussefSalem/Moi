import { X } from "lucide-react";

interface PolicyPageProps {
  policy: "privacy" | "refund" | "return" | "delivery";
  onClose: () => void;
}

const POLICIES: Record<string, { title: string; updated: string; sections: Array<{ heading: string; body: string }> }> = {
  privacy: {
    title: "Privacy Policy",
    updated: "May 2025",
    sections: [
      {
        heading: "Information We Collect",
        body: "When you place an order, we may collect your full name, phone number, email address, shipping and billing address, and order details. We may also collect basic browsing information such as device type and pages visited to improve website performance.",
      },
      {
        heading: "How We Use Your Information",
        body: "Your information is used to process and deliver orders, contact you regarding your purchase, provide customer support, improve our products and services, and send updates or promotional offers (only if you choose to receive them).",
      },
      {
        heading: "Information Protection",
        body: "We take reasonable precautions to protect your personal information and prevent unauthorized access or misuse.",
      },
      {
        heading: "Third-Party Services",
        body: "We may use trusted third-party services such as payment providers and shipping companies to complete your order.",
      },
      {
        heading: "Contact",
        body: "If you have any questions regarding this Privacy Policy, contact us at hello@buy-moi.com or +201200520083.",
      },
    ],
  },
  refund: {
    title: "Refund Policy",
    updated: "May 2025",
    sections: [
      {
        heading: "Refund Eligibility",
        body: "Refunds may be approved in cases of wrong item received, damaged product upon arrival, or order not delivered. To request a refund, contact us within 3 days of receiving the order.",
      },
      {
        heading: "Non-Refundable Situations",
        body: "Refunds are not available for incorrect size selection by the customer, minor color differences due to screen display, or products damaged after use.",
      },
      {
        heading: "Refund Process",
        body: "Once your refund request is reviewed and approved, the refund will be processed through the original payment method or bank transfer. Processing time may take 5–10 business days.",
      },
      {
        heading: "Contact",
        body: "For refund assistance, contact hello@buy-moi.com.",
      },
    ],
  },
  return: {
    title: "Return Policy",
    updated: "May 2025",
    sections: [
      {
        heading: "Return Conditions",
        body: "Items may be returned if they are unused and in original condition, original packaging and tags are included, and the return request is submitted within 3 days of delivery.",
      },
      {
        heading: "Non-Returnable Items",
        body: "We do not accept returns for used or washed items, damaged products caused by misuse, or sale and discounted items unless defective.",
      },
      {
        heading: "Return Shipping",
        body: "Customers are responsible for return shipping costs unless the item received was incorrect or defective.",
      },
      {
        heading: "Contact",
        body: "To initiate a return, contact hello@buy-moi.com.",
      },
    ],
  },
  delivery: {
    title: "Delivery Policy",
    updated: "May 2025",
    sections: [
      {
        heading: "Shipping Areas",
        body: "Moi currently delivers across Egypt.",
      },
      {
        heading: "Delivery Time",
        body: "Cairo & Alexandria: 1–3 business days. Other governorates: 2–5 business days. Delivery times may vary during holidays or high-demand periods.",
      },
      {
        heading: "Shipping Fees",
        body: "Shipping fees are calculated at checkout based on the delivery location.",
      },
      {
        heading: "Order Processing",
        body: "Orders are usually processed within 24 hours after confirmation.",
      },
      {
        heading: "Delivery Delays",
        body: "Unexpected delays may occur due to weather conditions, courier issues, or public holidays.",
      },
      {
        heading: "Contact",
        body: "For delivery support, contact hello@buy-moi.com or +201200520083.",
      },
    ],
  },
};

export function PolicyPage({ policy, onClose }: PolicyPageProps) {
  const data = POLICIES[policy];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf8f5" }}>
      {/* Floating back button — sits below the site header (z-50) */}
      <div className="fixed top-20 left-4 md:left-8 z-40">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase hover:opacity-50 transition-opacity"
          style={{ color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}
        >
          <X size={16} strokeWidth={1.5} />
          Back
        </button>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 md:px-8 pt-24 md:pt-28 pb-14 md:pb-20">
        <p className="text-[9px] tracking-[0.4em] uppercase mb-3" style={{ color: "rgba(120,108,96,0.55)", fontFamily: "'Montserrat', sans-serif" }}>
          Legal
        </p>
        <h1
          className="text-2xl md:text-3xl mb-2"
          style={{ color: "#1e1814", fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, letterSpacing: "0.02em" }}
        >
          {data.title}
        </h1>
        <p className="text-[10px] tracking-[0.2em] uppercase mb-12" style={{ color: "rgba(120,108,96,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          Last updated: {data.updated}
        </p>

        <div className="space-y-10">
          {data.sections.map((section) => (
            <section key={section.heading}>
              <h2
                className="text-sm tracking-[0.15em] uppercase mb-3"
                style={{ color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
              >
                {section.heading}
              </h2>
              <p className="text-sm leading-7" style={{ color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>
                {section.body}
              </p>
            </section>
          ))}
        </div>

        {/* Contact bar */}
        <div className="mt-16 pt-8 border-t" style={{ borderColor: "rgba(30,24,20,0.08)" }}>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-4" style={{ color: "rgba(120,108,96,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
            Contact Us
          </p>
          <div className="space-y-2 text-sm" style={{ color: "rgba(30,24,20,0.65)", fontFamily: "'Montserrat', sans-serif" }}>
            <p>Email: <a href="mailto:hello@buy-moi.com" className="underline underline-offset-2 hover:opacity-60 transition-opacity" style={{ color: "#1e1814" }}>hello@buy-moi.com</a></p>
            <p>Phone: <a href="tel:+201200520083" className="underline underline-offset-2 hover:opacity-60 transition-opacity" style={{ color: "#1e1814" }}>+20 120 052 0083</a></p>
            <p>58 Sotar Street, Azarita, Bab Sharq, Alexandria, Egypt</p>
          </div>
        </div>
      </main>

      {/* Footer note */}
      <div className="px-6 md:px-12 py-8 border-t" style={{ borderColor: "rgba(30,24,20,0.06)" }}>
        <p className="text-center text-[9px] tracking-[0.3em] uppercase" style={{ color: "rgba(120,108,96,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
          © 2026 Moi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
