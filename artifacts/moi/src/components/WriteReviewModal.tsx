import { useState, useEffect, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { transitions } from "@/lib/motion";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Check } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  error?: string;
}

interface FormErrors {
  rating?: string;
  body?: string;
  email?: string;
  images?: string;
}

// ── Star Selector ──────────────────────────────────────────────────────────────

function StarSelector({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((s) => {
          const active = (hovered || value) >= s;
          return (
            <button
              key={s}
              type="button"
              aria-label={`Rate ${s} star${s !== 1 ? "s" : ""}`}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(s)}
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <svg width={32} height={32} viewBox="0 0 12 12">
                <path
                  d="M6 1l1.2 2.9L10.5 4l-2.25 2.2.53 3.15L6 7.85l-2.78 1.5.53-3.15L1.5 4l3.3-.1z"
                  fill={active ? "#1e1814" : "#d4cdc8"}
                  style={{ transition: "fill 0.12s ease" }}
                />
              </svg>
            </button>
          );
        })}
      </div>
      {error && (
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#a0522d", marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Image Upload ───────────────────────────────────────────────────────────────

function ImageUpload({
  images,
  onChange,
  globalError,
}: {
  images: UploadedImage[];
  onChange: (imgs: UploadedImage[]) => void;
  globalError?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFiles = useCallback((files: File[]) => {
    const accepted = files.filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );
    const newImgs: UploadedImage[] = accepted.map((f) => {
      const error = f.size > 5 * 1024 * 1024 ? "File exceeds 5 MB limit" : undefined;
      const preview = URL.createObjectURL(f);
      return { id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, file: f, preview, error };
    });
    onChange([...images, ...newImgs]);
  }, [images, onChange]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const remove = (id: string) => {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    onChange(images.filter((i) => i.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragging ? "#1e1814" : "rgba(30,24,20,0.22)"}`,
          borderRadius: 2,
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          backgroundColor: dragging ? "rgba(30,24,20,0.04)" : "transparent",
          transition: "background-color 0.15s, border-color 0.15s",
          userSelect: "none",
        }}
      >
        <Upload size={20} strokeWidth={1.5} color="#7a6e64" />
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#7a6e64", fontWeight: 400, textAlign: "center", margin: 0 }}>
          Drag &amp; drop photos here, or tap to browse
        </p>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#a9a09a", fontWeight: 300, margin: 0 }}>
          JPG, PNG, WEBP · Max 5 MB each
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={handleChange}
      />

      {globalError && (
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#a0522d" }}>
          {globalError}
        </p>
      )}

      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {images.map((img) => (
            <div key={img.id} style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
              <img
                src={img.preview}
                alt="preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  border: img.error ? "1.5px solid #a0522d" : "1px solid rgba(30,24,20,0.12)",
                }}
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={(e) => { e.stopPropagation(); remove(img.id); }}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: "#1e1814",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <X size={10} strokeWidth={2.5} color="#fff" />
              </button>
              {img.error && (
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(160,82,45,0.85)",
                  padding: "2px 4px",
                }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                    {img.error}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared field styles ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 13,
  fontWeight: 300,
  color: "#1e1814",
  backgroundColor: "transparent",
  border: "1px solid rgba(30,24,20,0.18)",
  outline: "none",
  borderRadius: 0,
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#7a6e64",
  display: "block",
  marginBottom: 6,
};

const fieldErrorStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 11,
  color: "#a0522d",
  marginTop: 5,
};

// ── Main Modal ─────────────────────────────────────────────────────────────────

export interface WriteReviewModalProps {
  open: boolean;
  onClose: () => void;
  productHandle?: string;
}

type ModalState = "idle" | "loading" | "success";

export function WriteReviewModal({ open, onClose, productHandle }: WriteReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<ModalState>("idle");
  const [showDiscard, setShowDiscard] = useState(false);

  const isDirty = rating > 0 || title.trim() !== "" || body.trim() !== "" || name.trim() !== "" || email.trim() !== "" || images.length > 0;

  // Scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Reset on close
  const reset = useCallback(() => {
    setRating(0);
    setTitle("");
    setBody("");
    setName("");
    setEmail("");
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setErrors({});
    setTouched({});
    setModalState("idle");
    setShowDiscard(false);
  }, [images]);

  const requestClose = useCallback(() => {
    if (modalState === "success") {
      reset();
      onClose();
      return;
    }
    if (isDirty) {
      setShowDiscard(true);
    } else {
      reset();
      onClose();
    }
  }, [isDirty, modalState, reset, onClose]);

  const confirmDiscard = () => {
    reset();
    onClose();
  };

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (rating === 0) errs.rating = "Please select a star rating.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    return errs;
  };

  const handleBlur = (field: string) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const errs = validate();
    setErrors(errs);
  };

  const scrollToFirstError = (errs: FormErrors) => {
    const order = ["rating", "body", "email"];
    for (const key of order) {
      if (errs[key as keyof FormErrors]) {
        const el = document.getElementById(`review-field-${key}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched: Record<string, boolean> = { rating: true, body: true, email: true };
    setTouched(allTouched);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
      return;
    }

    setModalState("loading");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productHandle: productHandle ?? "unknown",
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          author: name.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });

      if (res.status === 429) {
        setModalState("idle");
        setErrors({ body: "Too many review submissions. Please try again tomorrow." });
        return;
      }

      if (!res.ok) {
        setModalState("idle");
        setErrors({ body: "Something went wrong. Please try again." });
        return;
      }
    } catch {
      setModalState("idle");
      setErrors({ body: "Network error. Please check your connection and try again." });
      return;
    }

    setModalState("success");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const modal = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="review-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.modalOverlay}
            onClick={requestClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              backgroundColor: "rgba(0,0,0,0.38)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />

          {/* Centering shell — plain div so Framer Motion doesn't clobber the translate */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 201,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              pointerEvents: "none",
            }}
          >
          <motion.div
            ref={panelRef}
            key="review-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Write a review"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={transitions.modal}
            style={{
              backgroundColor: "#faf8f5",
              overflowY: "auto",
              width: "100%",
              maxWidth: 560,
              borderRadius: 4,
              maxHeight: "90dvh",
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Discard bar */}
            <AnimatePresence>
              {showDiscard && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    backgroundColor: "#1e1814",
                    padding: "14px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 300, margin: 0 }}>
                    Discard your review? Your changes will be lost.
                  </p>
                  <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setShowDiscard(false)}
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.6)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 0",
                      }}
                    >
                      Keep Editing
                    </button>
                    <button
                      type="button"
                      onClick={confirmDiscard}
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#fff",
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.35)",
                        cursor: "pointer",
                        padding: "4px 12px",
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid rgba(30,24,20,0.08)",
                position: "sticky",
                top: 0,
                backgroundColor: "#faf8f5",
                zIndex: 10,
              }}
            >
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.28em", textTransform: "uppercase", color: "#1e1814", margin: 0 }}>
                Write a Review
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={requestClose}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.7, transition: "opacity 0.15s", flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.4")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                <X size={18} strokeWidth={1.5} color="#1e1814" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "28px 24px 40px" }}>
              <AnimatePresence mode="wait">
                {modalState === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "32px 0 16px", textAlign: "center" }}
                  >
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        backgroundColor: "#1e1814",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={26} strokeWidth={2} color="#fff" />
                    </motion.div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(1.4rem, 3vw, 1.8rem)", fontWeight: 400, color: "#1e1814", margin: 0, letterSpacing: "0.04em" }}>
                        Thank you for your review!
                      </h3>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 300, color: "#7a6e64", lineHeight: 1.7, margin: 0 }}>
                        We'll review your submission and publish it shortly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { reset(); onClose(); }}
                      style={{
                        marginTop: 8,
                        padding: "12px 40px",
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.28em",
                        textTransform: "uppercase",
                        color: "#faf8f5",
                        backgroundColor: "#1e1814",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    noValidate
                    style={{ display: "flex", flexDirection: "column", gap: 22 }}
                  >
                    {/* Star rating */}
                    <div id="review-field-rating">
                      <label style={labelStyle}>Your rating *</label>
                      <StarSelector
                        value={rating}
                        onChange={(v) => {
                          setRating(v);
                          setTouched((t) => ({ ...t, rating: true }));
                          setErrors((e) => ({ ...e, rating: undefined }));
                        }}
                        error={touched.rating ? errors.rating : undefined}
                      />
                    </div>

                    {/* Title */}
                    <div>
                      <label style={labelStyle} htmlFor="review-title">Give your review a title</label>
                      <input
                        id="review-title"
                        type="text"
                        placeholder="e.g. Effortless elegance"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={modalState === "loading"}
                        style={inputStyle}
                      />
                    </div>

                    {/* Body */}
                    <div id="review-field-body">
                      <label style={labelStyle} htmlFor="review-body">Your review (optional)</label>
                      <textarea
                        id="review-body"
                        placeholder="Share your experience with this piece…"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onBlur={() => handleBlur("body")}
                        disabled={modalState === "loading"}
                        rows={4}
                        style={{
                          ...inputStyle,
                          resize: "vertical",
                          minHeight: 96,
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      />
                      {touched.body && errors.body && (
                        <p style={fieldErrorStyle}>{errors.body}</p>
                      )}
                    </div>

                    {/* Image upload */}
                    <div>
                      <label style={labelStyle}>Add photos (optional)</label>
                      <ImageUpload
                        images={images}
                        onChange={setImages}
                        globalError={touched.images ? errors.images : undefined}
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <label style={labelStyle} htmlFor="review-name">Your name</label>
                      <input
                        id="review-name"
                        type="text"
                        placeholder="e.g. Layla M."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={modalState === "loading"}
                        style={inputStyle}
                      />
                    </div>

                    {/* Email */}
                    <div id="review-field-email">
                      <label style={labelStyle} htmlFor="review-email">Your email</label>
                      <input
                        id="review-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleBlur("email")}
                        disabled={modalState === "loading"}
                        style={inputStyle}
                        autoComplete="email"
                      />
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#a9a09a", fontWeight: 300, marginTop: 5 }}>
                        Not shown publicly.
                      </p>
                      {touched.email && errors.email && (
                        <p style={fieldErrorStyle}>{errors.email}</p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={modalState === "loading"}
                      style={{
                        width: "100%",
                        padding: "15px",
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.28em",
                        textTransform: "uppercase",
                        color: "#faf8f5",
                        backgroundColor: "#1e1814",
                        border: "none",
                        cursor: modalState === "loading" ? "not-allowed" : "pointer",
                        opacity: modalState === "loading" ? 0.6 : 1,
                        transition: "opacity 0.2s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {modalState === "loading" ? (
                        <>
                          <LoadingSpinner />
                          Submitting…
                        </>
                      ) : (
                        "Submit Review"
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}

function LoadingSpinner() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      style={{ animation: "review-spin 0.7s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes review-spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
