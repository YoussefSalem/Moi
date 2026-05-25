import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";

const WHATSAPP_NUMBER = "201200520083";
const WHATSAPP_MESSAGE = "Hi, I have a question about this product";

const encodedMessage = encodeURIComponent(WHATSAPP_MESSAGE);
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 50 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: 64,
              right: 0,
              width: 280,
              background: "#fff",
              border: "1px solid rgba(30,24,20,0.1)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(30,24,20,0.12)",
              overflow: "hidden",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#1e1814",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageCircle size={18} color="#fff" />
              </div>
              <div>
                <p
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    margin: 0,
                    letterSpacing: "0.02em",
                  }}
                >
                  Moi
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 11,
                    margin: 0,
                    marginTop: 2,
                  }}
                >
                  Typically replies within a few hours
                </p>
              </div>
            </div>

            {/* Chat bubble preview */}
            <div style={{ padding: "16px 16px 12px" }}>
              <div
                style={{
                  background: "#f5f3f0",
                  borderRadius: "12px 12px 12px 4px",
                  padding: "12px 14px",
                  maxWidth: "90%",
                }}
              >
                <p
                  style={{
                    color: "#1e1814",
                    fontSize: 13,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Hello! How can we help you today?
                </p>
                <p
                  style={{
                    color: "rgba(30,24,20,0.4)",
                    fontSize: 10,
                    marginTop: 6,
                    margin: 0,
                  }}
                >
                  Moi
                </p>
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: "0 16px 16px" }}>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  background: "#1e1814",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "11px 0",
                  borderRadius: 8,
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#2a201a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#1e1814")
                }
              >
                Start Chat
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open WhatsApp chat"}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#1e1814",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(30,24,20,0.2)",
          color: "#fff",
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>
    </div>
  );
}
