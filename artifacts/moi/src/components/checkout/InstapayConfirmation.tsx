import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Upload } from "lucide-react";
import { OrderConfirmedScreen } from "./OrderConfirmedScreen";
import { OrderBreakdownRows } from "./OrderBreakdownRows";
import type { OrderResult, OrderBreakdown } from "./types";

type InstapaySubStep = "instructions" | "upload" | "review";

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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "15px",
  letterSpacing: "0.24em",
  textTransform: "uppercase" as const,
  color: "rgba(30,24,20,0.92)",
  marginBottom: "2px",
  fontFamily: "'Montserrat', sans-serif",
};

async function compressImage(file: File, maxPx = 1400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

interface InstapayConfirmationProps {
  orderResult: OrderResult;
  onDone: () => void;
  onProofSubmitted: (orderNumber: string | number, shopifyOrderId: number | null, total: string) => void;
  fmt: (n: number) => string;
  breakdown: OrderBreakdown;
}

export function InstapayConfirmation({
  orderResult,
  onDone,
  onProofSubmitted,
  fmt: _fmt,
  breakdown,
}: InstapayConfirmationProps) {
  const [subStep, setSubStep] = useState<InstapaySubStep>("instructions");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isTouch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  const instapayAccount = orderResult.instapayAccount ?? import.meta.env.VITE_INSTAPAY_ACCOUNT_NAME ?? "";
  const instapayNumber = orderResult.instapayNumber ?? import.meta.env.VITE_INSTAPAY_ACCOUNT_NUMBER ?? "";

  function applyFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (JPG, PNG, HEIC).");
      return;
    }
    const preview = URL.createObjectURL(file);
    setScreenshotFile(file);
    setScreenshotPreview(preview);
    setUploadError("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) applyFile(file);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  }

  async function handleSubmitProof() {
    if (!referenceNumber.trim()) {
      setUploadError("Please enter the Instapay reference number.");
      return;
    }
    if (!screenshotFile) {
      setUploadError("Please upload your payment screenshot to continue.");
      return;
    }

    setUploadError("");
    setUploading(true);
    setUploadProgress(5);

    try {
      const compressed = await compressImage(screenshotFile);
      setUploadProgress(20);

      const formData = new FormData();
      formData.append("draftOrderId", String(orderResult.draftOrderId ?? ""));
      formData.append("referenceNumber", referenceNumber.trim());
      if (orderResult.customerName) formData.append("customerName", orderResult.customerName);
      if (orderResult.customerPhone) formData.append("customerPhone", orderResult.customerPhone);
      formData.append("amount", orderResult.total.replace(/,/g, ""));
      formData.append("screenshot", compressed, "proof.jpg");

      const data = await new Promise<{
        ok?: boolean;
        alreadySubmitted?: boolean;
        error?: string;
        orderNumber?: string | number;
        shopifyOrderId?: number;
        total?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/orders/instapay-proof");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(20 + Math.round((ev.loaded / ev.total) * 70));
          }
        };
        xhr.onload = () => {
          try {
            resolve(JSON.parse(xhr.responseText) as {
              ok?: boolean; alreadySubmitted?: boolean; error?: string;
              orderNumber?: string | number; shopifyOrderId?: number; total?: string;
            });
          }
          catch { reject(new Error("Invalid response")); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      setUploadProgress(95);

      if (!data.ok && !data.alreadySubmitted) {
        setUploadError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      if (data.orderNumber != null) {
        setConfirmedOrderNumber(data.orderNumber);
        onProofSubmitted(data.orderNumber, data.shopifyOrderId ?? null, data.total ?? orderResult.total);
      }

      setUploadProgress(100);
      setSubStep("review");
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const STEPS: InstapaySubStep[] = ["instructions", "upload", "review"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6"
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "33px", fontWeight: 700, color: "#1e1814", marginBottom: "6px" }}>
          {subStep === "review" ? "Order Confirmed." : "Payment Instructions"}
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.72)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em" }}>
          {subStep === "review"
            ? "We'll verify your payment and contact you shortly."
            : "Complete the steps below to place your order."}
        </p>
      </div>

      {confirmedOrderNumber != null && (
        <div style={{ padding: "14px 24px", border: "1px solid rgba(30,24,20,0.22)", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", marginBottom: "4px" }}>Order Number</p>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "29px", color: "#1e1814", fontWeight: 700 }}>#{confirmedOrderNumber}</p>
        </div>
      )}

      <div className="flex items-center gap-0 w-full" style={{ maxWidth: 320 }}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center" style={{ flex: 1 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: subStep === s ? "#1e1814" : (i < STEPS.indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.12)"),
              flexShrink: 0,
            }}>
              {i < STEPS.indexOf(subStep) ? (
                <Check size={12} strokeWidth={2.5} style={{ color: "#fff" }} />
              ) : (
                <span style={{ fontSize: "11px", color: subStep === s ? "#fff" : "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{i + 1}</span>
              )}
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, backgroundColor: i < STEPS.indexOf(subStep) ? "#1e1814" : "rgba(30,24,20,0.18)", marginLeft: 2, marginRight: 2 }} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {subStep === "instructions" && (
          <motion.div key="instructions" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <OrderBreakdownRows breakdown={breakdown} />
            <div style={{ border: "1px solid rgba(30,24,20,0.22)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.03)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>How to Pay via Instapay</p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  `Open your banking app and transfer ${orderResult.total} EGP via Instapay.`,
                  `Send to the account below. Save your reference number.`,
                  `Return here to upload your payment screenshot.`,
                ].map((text, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#1e1814", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", color: "#fff", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.88)", fontFamily: "'Montserrat', sans-serif", lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(30,24,20,0.22)", backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.1)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif" }}>Instapay Account</p>
              </div>
              <div className="p-4 space-y-3">
                {instapayAccount && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Name</p>
                      <p style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{instapayAccount}</p>
                    </div>
                    <button onClick={() => copyToClipboard(instapayAccount, "name")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "name" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                      {copied === "name" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                {instapayNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Account / Number</p>
                      <p style={{ fontSize: "15px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}>{instapayNumber}</p>
                    </div>
                    <button onClick={() => copyToClipboard(instapayNumber, "number")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "number" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                      {copied === "number" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(30,24,20,0.1)" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Amount</p>
                    <p style={{ fontSize: "17px", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{orderResult.total} EGP</p>
                  </div>
                  <button onClick={() => copyToClipboard(orderResult.total, "amount")} style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: copied === "amount" ? "#5a7a5a" : "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", padding: "6px 10px", border: "1px solid rgba(30,24,20,0.16)" }}>
                    {copied === "amount" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSubStep("upload")}
              className="w-full py-4 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              I've Sent the Payment →
            </button>
          </motion.div>
        )}

        {subStep === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="w-full flex flex-col gap-4">
            <div>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>Instapay Reference Number <span style={{ color: "#c0392b" }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={inputStyle}
                className="checkout-input"
              />
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>
                Payment Screenshot <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onPaste={handlePaste}
                onClick={() => fileRef.current?.click()}
                tabIndex={0}
                style={{
                  border: "1.5px dashed rgba(30,24,20,0.28)",
                  padding: "24px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: screenshotPreview ? "transparent" : "rgba(30,24,20,0.02)",
                  position: "relative",
                  overflow: "hidden",
                  outline: "none",
                }}
              >
                {screenshotPreview ? (
                  <div style={{ position: "relative", width: "100%" }}>
                    <img src={screenshotPreview} alt="Screenshot preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain" }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setScreenshotFile(null); setScreenshotPreview(null); }}
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
                    >
                      <X size={12} strokeWidth={2} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={20} strokeWidth={1.5} style={{ color: "rgba(30,24,20,0.4)" }} />
                    <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif", textAlign: "center", lineHeight: 1.6 }}>
                      {isTouch ? "Tap to upload your screenshot" : "Drag & drop, paste, or click to upload"}<br />
                      <span style={{ fontSize: "11px", opacity: 0.7 }}>JPG, PNG, HEIC accepted</span>
                    </p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              </div>
            </div>

            {uploading && (
              <div style={{ width: "100%", height: 3, backgroundColor: "rgba(30,24,20,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  style={{ height: "100%", backgroundColor: "#1e1814", borderRadius: 2 }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {uploadError && (
              <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>{uploadError}</p>
            )}

            <button
              onClick={handleSubmitProof}
              disabled={uploading || !referenceNumber.trim()}
              className="w-full py-4 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "#1e1814", color: "#fff", fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              {uploading ? "Submitting…" : "Submit Proof"}
            </button>

            <button
              onClick={() => setSubStep("instructions")}
              style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", textAlign: "center" as const }}
            >
              ← Back to Instructions
            </button>
          </motion.div>
        )}

        {subStep === "review" && (
          <OrderConfirmedScreen
            orderResult={orderResult}
            onDone={onDone}
            items={orderResult.items ?? []}
            breakdown={breakdown}
            title="Order Confirmed."
            subtitle="InstaPay"
            message={confirmedOrderNumber != null
              ? <>Your order is confirmed and payment proof is awaiting verification. Our team will review and confirm your order <strong style={{ color: "#1e1814" }}>#{confirmedOrderNumber}</strong> shortly.</>
              : "Your order is confirmed and payment proof is awaiting verification. Our team will review and confirm your order shortly."}
            note="Verification is usually completed within a few hours. You'll receive a WhatsApp message once confirmed."
            orderNumber={confirmedOrderNumber}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
