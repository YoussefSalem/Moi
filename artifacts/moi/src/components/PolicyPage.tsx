import { ArrowLeft } from "lucide-react";

interface PolicySection {
  badge?: string;
  heading: string;
  body: string;
  highlights?: string[];
}

interface PolicyData {
  title: string;
  subtitle?: string;
  updated: string;
  sections: PolicySection[];
}

const POLICIES: Record<string, PolicyData> = {
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
        highlights: ["Contact us within 3 days of delivery"],
      },
      {
        heading: "Non-Refundable Situations",
        body: "Refunds are not available for incorrect size selection by the customer, minor colour differences due to screen display, or products damaged after use.",
      },
      {
        heading: "Refund Process",
        body: "Once your refund request is reviewed and approved, the refund will be processed through the original payment method or bank transfer.",
        highlights: ["Processing time: 5–10 business days"],
      },
    ],
  },
  return: {
    title: "Return & Exchange Policy",
    subtitle: "Simple, transparent, and always on your terms.",
    updated: "June 2025",
    sections: [
      {
        badge: "RETURNS",
        heading: "Check on Delivery",
        body: "You may inspect your package while the courier waits. If you decide not to keep it, simply hand it back on the spot — no forms, no hassle.",
        highlights: ["Pay only the shipping fees"],
      },
      {
        heading: "Manufacturing Defects",
        body: "If you discover a manufacturing flaw after the item has been delivered, you have a full 14-day window to return it.",
        highlights: ["14 days from delivery"],
      },
      {
        badge: "EXCHANGES",
        heading: "Return on Delivery",
        body: "Need a different size or colour? Inspect your item while the courier waits and hand it back to them if you'd like to exchange.",
        highlights: ["Exchange at the door"],
      },
      {
        heading: "Place a New Order",
        body: "Contact our customer service team to confirm the exchange, then simply place a new order for your replacement item. We'll make sure it reaches you quickly.",
        highlights: ["We'll guide you through every step"],
      },
    ],
  },
  delivery: {
    title: "Delivery Policy",
    updated: "May 2025",
    sections: [
      {
        heading: "Shipping Areas",
        body: "Moi currently delivers across all of Egypt.",
        highlights: ["Nationwide delivery"],
      },
      {
        heading: "Delivery Times",
        body: "Cairo & Alexandria: 1–3 business days. All other governorates: 2–5 business days. Times may vary during public holidays or peak periods.",
        highlights: ["Cairo & Alex: 1–3 days", "Other governorates: 2–5 days"],
      },
      {
        heading: "Shipping Fees",
        body: "Shipping fees are calculated at checkout based on your delivery location.",
      },
      {
        heading: "Order Processing",
        body: "Orders are usually processed within 24 hours of confirmation.",
        highlights: ["Processed within 24 hours"],
      },
      {
        heading: "Delivery Delays",
        body: "Unexpected delays may occasionally occur due to weather, courier capacity, or public holidays. We'll keep you informed if your order is affected.",
      },
    ],
  },
};

export function PolicyPage({ policy, onClose }: { policy: "privacy" | "refund" | "return" | "delivery"; onClose: () => void }) {
  const data = POLICIES[policy];
  let lastBadge = "";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf8f5" }}>
      {/* Back button */}
      <div className="fixed top-20 left-4 md:left-8 z-40">
        <button
          onClick={onClose}
          className="flex items-center gap-2 transition-opacity hover:opacity-50"
          style={{ color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} />
          Back
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-6 md:px-8 pt-28 md:pt-32 pb-20">

        {/* Header */}
        <div className="mb-14">
          <p
            className="mb-4"
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.45em", textTransform: "uppercase", color: "rgba(120,108,96,0.5)" }}
          >
            Moi &nbsp;/&nbsp; {data.title}
          </p>
          <h1
            className="mb-3"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300, fontSize: "clamp(2rem, 6vw, 2.8rem)", color: "#1e1814", letterSpacing: "0.02em", lineHeight: 1.1 }}
          >
            {data.title}
          </h1>
          {data.subtitle && (
            <p
              className="mb-4"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "rgba(30,24,20,0.45)", letterSpacing: "0.01em" }}
            >
              {data.subtitle}
            </p>
          )}
          <p
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(120,108,96,0.4)" }}
          >
            Last updated: {data.updated}
          </p>
        </div>

        {/* Thin rule */}
        <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)", marginBottom: "3.5rem" }} />

        {/* Sections */}
        <div className="space-y-0">
          {data.sections.map((section, i) => {
            const showBadge = section.badge && section.badge !== lastBadge;
            if (section.badge) lastBadge = section.badge;

            return (
              <div key={i}>
                {/* Group badge separator */}
                {showBadge && (
                  <div className="flex items-center gap-4 mb-8" style={{ marginTop: i === 0 ? 0 : "3rem" }}>
                    <span
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 9,
                        letterSpacing: "0.38em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        color: "#1e1814",
                        backgroundColor: "rgba(30,24,20,0.05)",
                        border: "1px solid rgba(30,24,20,0.1)",
                        borderRadius: 999,
                        padding: "4px 12px",
                      }}
                    >
                      {section.badge}
                    </span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "rgba(30,24,20,0.07)" }} />
                  </div>
                )}

                {/* Section card */}
                <div
                  className="mb-5"
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(30,24,20,0.07)",
                    backgroundColor: "#ffffff",
                    padding: "clamp(1.25rem, 4vw, 1.75rem) clamp(1.25rem, 4vw, 1.75rem)",
                    boxShadow: "0 1px 12px rgba(30,24,20,0.04)",
                  }}
                >
                  <h2
                    className="mb-3"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontWeight: 500,
                      fontSize: "clamp(1.1rem, 3.5vw, 1.35rem)",
                      color: "#1e1814",
                      letterSpacing: "0.01em",
                      lineHeight: 1.2,
                    }}
                  >
                    {section.heading}
                  </h2>
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "clamp(0.78rem, 2.2vw, 0.84rem)",
                      color: "rgba(30,24,20,0.62)",
                      lineHeight: 1.85,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {section.body}
                  </p>

                  {/* Highlight chips */}
                  {section.highlights && section.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {section.highlights.map((h) => (
                        <span
                          key={h}
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontSize: 10,
                            letterSpacing: "0.14em",
                            fontWeight: 500,
                            color: "#7a5c3a",
                            backgroundColor: "rgba(190,148,90,0.1)",
                            border: "1px solid rgba(190,148,90,0.22)",
                            borderRadius: 999,
                            padding: "3px 11px",
                          }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact bar */}
        <div className="mt-16 pt-10 border-t" style={{ borderColor: "rgba(30,24,20,0.08)" }}>
          <p
            className="mb-5"
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(120,108,96,0.45)" }}
          >
            Need help?
          </p>
          <div className="space-y-2.5" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.82rem", color: "rgba(30,24,20,0.6)" }}>
            <p>
              Email{" "}
              <a href="mailto:hello@buy-moi.com" style={{ color: "#1e1814", textDecoration: "underline", textUnderlineOffset: 3 }}>
                hello@buy-moi.com
              </a>
            </p>
            <p>
              Phone{" "}
              <a href="tel:+201200520083" style={{ color: "#1e1814", textDecoration: "underline", textUnderlineOffset: 3 }}>
                +20 120 052 0083
              </a>
            </p>
            <p style={{ color: "rgba(30,24,20,0.42)", fontSize: "0.76rem" }}>58 Sotar Street, Azarita, Bab Sharq, Alexandria, Egypt</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="px-6 py-8 border-t" style={{ borderColor: "rgba(30,24,20,0.06)" }}>
        <p className="text-center" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(120,108,96,0.35)" }}>
          © 2026 Moi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
