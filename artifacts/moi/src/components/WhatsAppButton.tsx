import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { trackChatInteraction } from "@/lib/analytics";

const WHATSAPP_NUMBER = "201200520083";
const WHATSAPP_MESSAGE = "Hi, I have a question about this product";

export function WhatsAppButton() {
  const shouldOpen = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("whatsapp");
  }, []);
  const [open, setOpen] = useState(shouldOpen);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftSeqRef = useRef(0);
  const lastDraftRef = useRef("");

  useEffect(() => {
    if (open) {
      draftSeqRef.current = 0;
      lastDraftRef.current = "";
    }
  }, [open]);

  const toggleOpen = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    trackChatInteraction(nextOpen ? "open" : "close", undefined, undefined, { pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined });
  }, []);

  const trackDraftChange = useCallback((text: string) => {
    // Only track meaningful changes (not single char backspaces)
    if (text.length > 0 && Math.abs(text.length - lastDraftRef.current.length) >= 1) {
      draftSeqRef.current++;
      lastDraftRef.current = text;
      trackChatInteraction("draft_change", text, draftSeqRef.current, {
        length: text.length,
        pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    }
  }, []);

  function handleSend() {
    const text = message.trim() || WHATSAPP_MESSAGE;
    trackChatInteraction("send", text, draftSeqRef.current, { pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined });
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setMessage("");
      lastDraftRef.current = "";
      draftSeqRef.current = 0;
      toggleOpen(false);
    }, 1500);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div style={{ position: "fixed", bottom: "max(20px, env(safe-area-inset-bottom) + 4px)", right: "max(20px, env(safe-area-inset-right) + 4px)", zIndex: 50 }}>
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
              width: 320,
              maxWidth: "calc(100vw - 40px)",
              background: "#faf8f5",
              border: "1px solid rgba(30,24,20,0.08)",
              borderRadius: 16,
              boxShadow: "0 12px 40px rgba(30,24,20,0.14)",
              overflow: "hidden",
              fontFamily: "'Montserrat', sans-serif",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#1e1814",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageCircle size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 600,
                    margin: 0,
                    letterSpacing: "0.02em",
                  }}
                >
                  Moi
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 11,
                    margin: 0,
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#4ade80",
                      display: "inline-block",
                      boxShadow: "0 0 6px 2px rgba(74,222,128,0.5)",
                      animation: "pulse-green 2s ease-in-out infinite",
                    }}
                  />
                  Replies almost instantly
                </p>
              </div>
              <button
                onClick={() => toggleOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 10,
                  margin: -6,
                  color: "rgba(255,255,255,0.5)",
                }}
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat area */}
            <div
              style={{
                flex: 1,
                padding: "16px 16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 180,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {/* Welcome message */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: "14px 14px 14px 4px",
                  padding: "12px 14px",
                  maxWidth: "90%",
                  boxShadow: "0 1px 4px rgba(30,24,20,0.04)",
                }}
              >
                <p
                  style={{
                    color: "#1e1814",
                    fontSize: 14,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  Hello! How can we help you today?
                </p>
                <p
                  style={{
                    color: "rgba(30,24,20,0.35)",
                    fontSize: 10,
                    marginTop: 6,
                    margin: 0,
                  }}
                >
                  Moi
                </p>
              </div>

              {sent && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: "#fff",
                    borderRadius: "14px 14px 4px 14px",
                    padding: "12px 14px",
                    alignSelf: "flex-end",
                    maxWidth: "90%",
                    boxShadow: "0 1px 4px rgba(30,24,20,0.04)",
                  }}
                >
                  <p style={{ color: "#1e1814", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                    {message.trim() || WHATSAPP_MESSAGE}
                  </p>
                  <p
                    style={{
                      color: "rgba(30,24,20,0.35)",
                      fontSize: 10,
                      marginTop: 6,
                      margin: 0,
                      textAlign: "right",
                    }}
                  >
                    You
                  </p>
                </motion.div>
              )}
            </div>

            {/* Input area */}
            <div
              style={{
                padding: "10px 14px 14px",
                borderTop: "1px solid rgba(30,24,20,0.06)",
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => {
                  const val = e.target.value;
                  setMessage(val);
                  trackDraftChange(val);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  border: "1px solid rgba(30,24,20,0.12)",
                  borderRadius: 20,
                  padding: "10px 14px",
                  fontSize: 17,
                  fontFamily: "'Montserrat', sans-serif",
                  lineHeight: 1.5,
                  outline: "none",
                  background: "#fff",
                  color: "#1e1814",
                  maxHeight: 100,
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                aria-label="Send message"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#1e1814",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                }}
              >
                <Send size={16} />
              </motion.button>
            </div>

            {/* Footer */}
            <div
              style={{
                textAlign: "center",
                padding: "6px 0 10px",
                fontSize: 10,
                color: "rgba(30,24,20,0.3)",
                letterSpacing: "0.06em",
              }}
            >
              Powered by WhatsApp
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => toggleOpen(!open)}
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
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>
    </div>
    </>
  );
}
