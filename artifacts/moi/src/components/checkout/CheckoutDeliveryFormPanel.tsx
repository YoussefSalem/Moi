import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ENABLE_APPLE_PAY } from "@/config/features";

type PaymentMethod = "cod" | "instapay" | "card" | "wallet" | "apple-pay";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  governorate: string;
  postalCode: string;
  city: string;
};

const GOVERNORATES = [
  "Cairo","Giza","Alexandria","Dakahlia","Red Sea","Beheira","Fayoum","Gharbia",
  "Ismailia","Menofia","Minya","Qaliubiya","New Valley","Suez","Aswan","Assiut",
  "Beni Suef","Port Said","Damietta","Sharkia","South Sinai","Kafr El Sheikh",
  "Matrouh","Luxor","Qena","North Sinai","Sohag","Ain Sokhna",
] as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(30,24,20,0.22)",
  outline: "none",
  padding: "14px 0",
  fontSize: "16px",
  color: "#1e1814",
  fontWeight: 500,
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.025em",
  WebkitAppearance: "none",
  borderRadius: 0,
};

const governorateInputStyle: React.CSSProperties = {
  ...inputStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "15px",
  letterSpacing: "0.24em",
  textTransform: "uppercase" as const,
  color: "rgba(30,24,20,0.92)",
  marginBottom: "2px",
  fontFamily: "'Montserrat', sans-serif",
};

const optionListStyle: React.CSSProperties = {
  maxHeight: "240px",
  overflowY: "auto",
  border: "1px solid rgba(30,24,20,0.16)",
  backgroundColor: "#efe6da",
  boxShadow: "0 18px 40px rgba(30,24,20,0.12)",
};

const optionStyle: React.CSSProperties = {
  width: "100%",
  display: "block",
  padding: "12px 14px",
  textAlign: "left",
  fontFamily: "'Montserrat', sans-serif",
  fontSize: "14px",
  letterSpacing: "0.02em",
  color: "#1e1814",
};

interface CheckoutDeliveryFormPanelProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  availablePaymentMethods: PaymentMethod[];
  submitError: string;
  emailError: string;
  setEmailError: (e: string) => void;
  handleEmailBlur: () => void;
  handleSubmit: () => void;
  navigatingToPaymob: boolean;
  governorateOpen: boolean;
  setGovernorateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerApplePayDirectInit: () => void;
}

export function CheckoutDeliveryFormPanel({
  form, setForm, paymentMethod, setPaymentMethod, availablePaymentMethods,
  submitError, emailError, setEmailError, handleEmailBlur, handleSubmit,
  navigatingToPaymob, governorateOpen, setGovernorateOpen,
  triggerApplePayDirectInit,
}: CheckoutDeliveryFormPanelProps) {
  return (
    <div>
      {/* ── Express Checkout (Apple Pay) ── */}
      {ENABLE_APPLE_PAY && typeof window !== "undefined" && "ApplePaySession" in window && (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.() && (
        <div style={{ marginBottom: "28px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.38)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, textAlign: "center", marginBottom: "12px" }}>
            Express Checkout
          </p>
          <button
            type="button"
            className="apple-pay-btn"
            onClick={triggerApplePayDirectInit}
            aria-label="Buy with Apple Pay"
          />
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "20px" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(30,24,20,0.10)" }} />
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.38)", fontWeight: 400, flexShrink: 0 }}>or</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(30,24,20,0.10)" }} />
          </div>
        </div>
      )}

      {/* ── Payment Method tiles ── */}
      <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        Payment Method
        <span style={{ fontSize: "13px", letterSpacing: 0, textTransform: "none", color: "#c9a0b4", opacity: 0.85 }}>✦</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8" style={{ alignItems: "start" }}>
        {availablePaymentMethods.filter((m) => m !== "apple-pay").map((m) => {
          const selected = paymentMethod === m;
          return (
            <div key={m} style={{ position: "relative" }}>
              <button
                onClick={() => setPaymentMethod(m)}
                className="text-left w-full"
                style={{
                  padding: "14px 10px",
                  height: "100px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  border: selected ? "1.5px solid #1e1814" : "1px solid rgba(30,24,20,0.15)",
                  backgroundColor: selected ? "rgba(30,24,20,0.04)" : "transparent",
                  width: "100%",
                  transform: selected ? "scale(1.05)" : "scale(1)",
                  boxShadow: selected ? "0 2px 12px rgba(30,24,20,0.10)" : "none",
                  transition: "transform 0.18s ease, box-shadow 0.18s ease, border 0.12s ease, background-color 0.12s ease",
                  zIndex: selected ? 1 : 0,
                }}
              >
                <div style={{ fontSize: "17px", marginBottom: "5px", display: "flex", alignItems: "center" }}>
                  {m === "wallet" ? (
                    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="0.75" y="4.75" width="18.5" height="12.5" rx="2.25" stroke="#1e1814" strokeWidth="1.3"/>
                      <path d="M0.75 8.25H19.25" stroke="#1e1814" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M1 6C1 4.34 2.34 3 4 3H16C17.66 3 19 4.34 19 6" stroke="#1e1814" strokeWidth="1.3" strokeLinecap="round"/>
                      <rect x="12.5" y="10.5" width="5.5" height="3.5" rx="1.1" fill="rgba(30,24,20,0.13)" stroke="#1e1814" strokeWidth="1.1"/>
                      <circle cx="14.25" cy="12.25" r="0.7" fill="#1e1814"/>
                    </svg>
                  ) : m === "cod" ? "🚚" : m === "instapay" ? "📱" : "💳"}
                </div>
                <p style={{ fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, lineHeight: 1.35 }}>
                  {m === "cod" ? "Cash on Delivery" : m === "instapay" ? "InstaPay" : m === "wallet" ? "Mobile Wallet" : "Debit Card"}
                </p>
                <p style={{ fontSize: "9px", color: "rgba(30,24,20,0.64)", fontFamily: "'Montserrat', sans-serif", marginTop: "3px", lineHeight: 1.45, letterSpacing: "0.02em" }}>
                  {m === "cod" ? "Pay on arrival" : m === "instapay" ? "Bank transfer" : m === "wallet" ? "Vodafone · Orange · e&" : "Visa · Mastercard"}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      {/* Delivery form */}
      <p style={{ fontSize: "14px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", marginBottom: "20px" }}>
        Delivery Details
      </p>

      <form id="checkout-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>First Name</label>
            <input type="text" name="given-name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={inputStyle} autoComplete="given-name" className="checkout-input" />
          </div>
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>Last Name</label>
            <input type="text" name="family-name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} autoComplete="family-name" className="checkout-input" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label style={labelStyle}>Phone Number</label>
          <input type="tel" name="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} autoComplete="tel" placeholder="01X XXXX XXXX" className="checkout-input" />
        </div>

        <div className="flex flex-col gap-1">
          <label style={labelStyle}>Email Address</label>
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setEmailError(""); }}
            onBlur={handleEmailBlur}
            style={inputStyle}
            placeholder="your@email.com"
            className="checkout-input"
          />
          {emailError && (
            <p style={{ marginTop: "6px", fontSize: "12px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{emailError}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label style={labelStyle}>Address</label>
          <input type="text" name="street-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} autoComplete="street-address" className="checkout-input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex flex-col gap-1 relative">
            <label style={labelStyle}>Governorate</label>
            <button type="button" onClick={() => setGovernorateOpen((o) => !o)} style={governorateInputStyle} className="checkout-input">
              <span style={{ color: form.governorate ? "#1e1814" : "rgba(30,24,20,0.42)" }}>
                {form.governorate || "Select governorate"}
              </span>
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "rgba(30,24,20,0.55)", flexShrink: 0 }} />
            </button>
            <AnimatePresence>
              {governorateOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.16 }}
                  style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, marginTop: 8 }}
                >
                  <div style={optionListStyle}>
                    {GOVERNORATES.map((governorate) => (
                      <button
                        key={governorate}
                        type="button"
                        onClick={() => { setForm((f) => ({ ...f, governorate })); setGovernorateOpen(false); }}
                        style={{ ...optionStyle, backgroundColor: form.governorate === governorate ? "rgba(30,24,20,0.06)" : "transparent" }}
                      >
                        {governorate}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>Postal Code <span style={{ textTransform: "none", letterSpacing: "0.08em", opacity: 0.7, fontSize: "11px" }}>(optional)</span></label>
            <input type="text" name="postal-code" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} style={inputStyle} autoComplete="postal-code" className="checkout-input" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label style={labelStyle}>City</label>
          <input type="text" name="address-level2" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={inputStyle} autoComplete="address-level2" className="checkout-input" />
        </div>

        {submitError && (
          <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginTop: "12px", letterSpacing: "0.04em" }}>{submitError}</p>
        )}

        {paymentMethod === "instapay" && (
          <div className="mt-5 p-4" style={{ backgroundColor: "rgba(30,24,20,0.05)", border: "1px solid rgba(30,24,20,0.14)" }}>
            <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.84)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.7, letterSpacing: "0.04em" }}>
              After placing your order, you'll see payment instructions and can upload your transfer screenshot directly on the site.
            </p>
          </div>
        )}

        {/* Place Order */}
        <div style={{ marginTop: "32px" }}>
          <button
            type="submit"
            disabled={navigatingToPaymob}
            style={{
              width: "100%",
              padding: "18px",
              backgroundColor: "#1e1814",
              color: "#fff",
              fontSize: "11px",
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              border: "none",
              cursor: navigatingToPaymob ? "not-allowed" : "pointer",
              opacity: navigatingToPaymob ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {navigatingToPaymob ? "Processing…" : "Place Order"}
          </button>
          <p style={{ fontSize: "10px", color: "rgba(30,24,20,0.42)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", marginTop: "10px", letterSpacing: "0.12em" }}>
            By placing your order you agree to our{" "}
            <a
              href="/return"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "rgba(30,24,20,0.65)", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              return policy
            </a>
            .
          </p>
        </div>
      </form>
    </div>
  );
}
