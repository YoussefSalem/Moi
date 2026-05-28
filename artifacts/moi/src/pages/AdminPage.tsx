import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eye, RefreshCw, ChevronDown, ChevronUp, LogOut, BarChart3, TrendingUp, Monitor, Smartphone, Globe, AlertTriangle, Users, ArrowRight, MousePointer, Clock, Trash2, MessageCircle, Send } from "lucide-react";

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN as string | undefined;
const SESSION_KEY = "moi_admin_token";
const SESSION_EXPIRY_KEY = "moi_admin_token_expiry";

interface Proof {
  id: number;
  draftOrderId: number | null;
  shopifyOrderId: number | null;
  shopifyOrderNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  amount: string | null;
  referenceNumber: string;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  hasScreenshot: boolean;
}

interface PaymobConfigMask {
  apiKey: string;
  secretKey: string;
  publicKey: string;
  integrationId: string;
  hmacSecret: string;
}

const mono: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  letterSpacing: "0.025em",
};
const label: React.CSSProperties = {
  ...mono,
  fontSize: "11px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(30,24,20,0.6)",
  display: "block",
  marginBottom: "4px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid rgba(30,24,20,0.2)",
  backgroundColor: "#fff",
  fontSize: "14px",
  fontFamily: "'Montserrat', sans-serif",
  color: "#1e1814",
  outline: "none",
};
const btn: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "11px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  cursor: "pointer",
  border: "none",
};

function PinGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ADMIN_PIN) {
      setError("Admin panel not configured (VITE_ADMIN_PIN not set).");
      return;
    }
    // Client-side PIN check first to avoid unnecessary API calls
    if (pin !== ADMIN_PIN) {
      setError("Incorrect PIN.");
      setPin("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: pin }),
      });
      const data = await res.json() as { token?: string; expiresAt?: number; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Login failed. Please try again.");
        setPin("");
        return;
      }
      sessionStorage.setItem(SESSION_KEY, data.token);
      if (data.expiresAt) sessionStorage.setItem(SESSION_EXPIRY_KEY, String(data.expiresAt));
      onAuth(data.token);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: "#efe6da" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: "100%", maxWidth: 360, padding: "40px 32px" }}
      >
        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "33px", fontWeight: 700, color: "#1e1814", marginBottom: "4px" }}>
          Admin
        </p>
        <p style={{ fontSize: "12px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", marginBottom: "28px" }}>
          Moi · Internal
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={label}>Access PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(""); }}
              placeholder="Enter PIN"
              autoFocus
              style={{ ...inputStyle, letterSpacing: "0.2em" }}
            />
          </div>
          {error && <p style={{ fontSize: "12px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ ...btn, backgroundColor: "#1e1814", color: "#fff", padding: "12px", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Verifying…" : "Enter"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function apiHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "rgba(180,140,40,0.12)", text: "#8a6a10" },
    approved: { bg: "rgba(60,120,60,0.12)", text: "#2d6e2d" },
    rejected: { bg: "rgba(192,57,43,0.1)", text: "#b22a1e" },
  };
  const c = colors[status] ?? { bg: "rgba(30,24,20,0.1)", text: "rgba(30,24,20,0.7)" };
  return (
    <span style={{
      ...mono,
      fontSize: "11px",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      fontWeight: 700,
      padding: "3px 8px",
      backgroundColor: c.bg,
      color: c.text,
    }}>
      {status}
    </span>
  );
}

function ScreenshotModal({ proofId, token, onClose }: { proofId: number; token: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/instapay-proofs/${proofId}/screenshot`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) { setError("Screenshot not available"); return; }
        const blob = await r.blob();
        setSrc(URL.createObjectURL(blob));
      })
      .catch(() => setError("Failed to load screenshot"));
  }, [proofId, token]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: "rgba(30,24,20,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", padding: 8, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", position: "relative" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", backgroundColor: "#1e1814", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", zIndex: 10 }}
        >
          <X size={14} strokeWidth={2} style={{ color: "#fff" }} />
        </button>
        {error && <p style={{ padding: "24px 40px", fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>}
        {!src && !error && (
          <div style={{ padding: "40px 60px", fontSize: "14px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</div>
        )}
        {src && <img src={src} alt="Payment screenshot" style={{ maxWidth: "80vw", maxHeight: "80vh", display: "block" }} />}
      </div>
    </div>
  );
}

function RejectDialog({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: "rgba(30,24,20,0.5)" }}
    >
      <div style={{ background: "#efe6da", padding: "28px", width: 360, maxWidth: "95vw" }}>
        <p style={{ fontSize: "14px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, marginBottom: "16px" }}>
          Reject Payment
        </p>
        <div>
          <label style={label}>Reason (optional)</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount mismatch" style={inputStyle} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => onConfirm(reason)} style={{ ...btn, backgroundColor: "#c0392b", color: "#fff", flex: 1 }}>Reject</button>
          <button onClick={onCancel} style={{ ...btn, backgroundColor: "transparent", color: "rgba(30,24,20,0.7)", border: "1px solid rgba(30,24,20,0.2)", flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ProofsTab({ token, onAuth }: { token: string; onAuth?: (t: string | null) => void }) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [screenshotId, setScreenshotId] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/instapay-proofs", { headers: apiHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth?.(null); return;
      }
      if (!res.ok) { setError(`Failed to load proofs. (${res.status})`); return; }
      const data = await res.json() as { proofs: Proof[] };
      setProofs(data.proofs);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [token, onAuth]);

  useEffect(() => { void fetchProofs(); }, [fetchProofs]);

  async function approve(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/instapay-proofs/${id}/approve`, { method: "POST", headers: apiHeaders(token) });
      if (res.ok) await fetchProofs();
    } finally { setActionLoading(null); }
  }

  async function reject(id: number, reason: string) {
    setRejectId(null);
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/instapay-proofs/${id}/reject`, {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify({ reason }),
      });
      if (res.ok) await fetchProofs();
    } finally { setActionLoading(null); }
  }

  const filtered = proofs.filter((p) => filterStatus === "all" || p.status === filterStatus);
  const pendingCount = proofs.filter((p) => p.status === "pending").length;

  return (
    <div>
      {screenshotId !== null && (
        <ScreenshotModal proofId={screenshotId} token={token} onClose={() => setScreenshotId(null)} />
      )}
      {galleryOpen && (
        <ProofGallery proofs={proofs.filter((proof) => proof.hasScreenshot)} token={token} onClose={() => setGalleryOpen(false)} />
      )}
      {rejectId !== null && (
        <RejectDialog onConfirm={(r) => reject(rejectId, r)} onCancel={() => setRejectId(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p style={{ fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", fontWeight: 700 }}>
            Instapay Proofs
          </p>
          {pendingCount > 0 && (
            <span style={{ backgroundColor: "#c0392b", color: "#fff", fontSize: "11px", fontWeight: 700, fontFamily: "'Montserrat', sans-serif", padding: "2px 7px", borderRadius: 99 }}>
              {pendingCount}
            </span>
          )}
        </div>
        <button onClick={fetchProofs} style={{ display: "flex", alignItems: "center", gap: 6, ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)" }}>
          <RefreshCw size={12} strokeWidth={2} />
          Refresh
        </button>
      </div>

      <button
        onClick={() => setGalleryOpen(true)}
        disabled={proofs.filter((proof) => proof.hasScreenshot).length === 0}
        style={{
          ...btn,
          backgroundColor: "#1e1814",
          color: "#fff",
          padding: "8px 12px",
          marginBottom: 18,
          opacity: proofs.filter((proof) => proof.hasScreenshot).length === 0 ? 0.4 : 1,
        }}
      >
        View all proof images
      </button>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["pending", "all", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              ...btn,
              backgroundColor: filterStatus === s ? "#1e1814" : "transparent",
              color: filterStatus === s ? "#fff" : "rgba(30,24,20,0.6)",
              border: "1px solid rgba(30,24,20,0.18)",
              padding: "6px 12px",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginBottom: 12 }}>{error}</p>}
      {loading && <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          No {filterStatus === "all" ? "" : filterStatus} proofs found.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((proof) => (
          <div key={proof.id} style={{ border: "1px solid rgba(30,24,20,0.16)", backgroundColor: "#fff" }}>
            <div className="flex items-center justify-between p-4" style={{ gap: 12 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "19px", fontWeight: 700, color: "#1e1814" }}>
                    #{proof.shopifyOrderNumber ?? `Draft ${proof.draftOrderId}`}
                  </span>
                  <StatusBadge status={proof.status} />
                  {proof.hasScreenshot && (
                    <button
                      onClick={() => setScreenshotId(proof.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)", padding: "4px 8px" }}
                    >
                      <Eye size={12} strokeWidth={1.8} />
                      Screenshot
                    </button>
                  )}
                </div>
                <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", marginTop: 4 }}>
                  {proof.customerName ?? "—"} · {proof.customerPhone ?? "—"} · {proof.amount ? `${proof.amount} EGP` : "—"}
                </p>
                <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", marginTop: 2, letterSpacing: "0.04em" }}>
                  Ref: {proof.referenceNumber} · {new Date(proof.submittedAt).toLocaleString("en-EG")}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {proof.status === "pending" && (
                  <>
                    <button
                      onClick={() => approve(proof.id)}
                      disabled={actionLoading === proof.id}
                      style={{ ...btn, backgroundColor: "#1e6e1e", color: "#fff", display: "flex", alignItems: "center", gap: 4, padding: "7px 12px" }}
                    >
                      <Check size={12} strokeWidth={2.5} />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectId(proof.id)}
                      disabled={actionLoading === proof.id}
                      style={{ ...btn, backgroundColor: "#c0392b", color: "#fff", display: "flex", alignItems: "center", gap: 4, padding: "7px 12px" }}
                    >
                      <X size={12} strokeWidth={2.5} />
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => setExpanded(expanded === proof.id ? null : proof.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "1px solid rgba(30,24,20,0.15)", backgroundColor: "transparent", cursor: "pointer" }}
                >
                  {expanded === proof.id ? <ChevronUp size={13} strokeWidth={2} style={{ color: "rgba(30,24,20,0.6)" }} /> : <ChevronDown size={13} strokeWidth={2} style={{ color: "rgba(30,24,20,0.6)" }} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expanded === proof.id && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(30,24,20,0.1)", backgroundColor: "rgba(30,24,20,0.02)", fontSize: "12px", fontFamily: "'Montserrat', sans-serif", color: "rgba(30,24,20,0.8)" }}>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span style={label}>Shopify Order ID</span>{proof.shopifyOrderId}</div>
                      <div><span style={label}>Reviewed At</span>{proof.reviewedAt ? new Date(proof.reviewedAt).toLocaleString("en-EG") : "—"}</div>
                      {proof.rejectionReason && <div className="col-span-2"><span style={label}>Rejection Reason</span>{proof.rejectionReason}</div>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loads a Bearer-protected image via fetch and renders it from a blob URL. */
function AuthThumbnail({ proofId, token, orderNumber }: { proofId: number; token: string; orderNumber: number | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false;
    fetch(`/api/admin/instapay-proofs/${proofId}/screenshot`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok || revoked) return;
        const blob = await r.blob();
        if (!revoked) setSrc(URL.createObjectURL(blob));
      })
      .catch(() => {/* thumbnail stays blank */});
    return () => {
      revoked = true;
      setSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [proofId, token]);
  return src
    ? <img src={src} alt={`Proof ${orderNumber}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "rgba(30,24,20,0.3)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.15em" }}>Loading…</div>;
}

function ProofGallery({
  proofs,
  token,
  onClose,
}: {
  proofs: Proof[];
  token: string;
  onClose: () => void;
}) {
  const [lightboxId, setLightboxId] = useState<number | null>(null);
  return (
    <>
      <div className="fixed inset-0 z-[220] flex items-center justify-center" style={{ backgroundColor: "rgba(30,24,20,0.62)", backdropFilter: "blur(5px)" }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#efe6da", width: "92vw", maxWidth: 1100, maxHeight: "90vh", overflow: "auto", padding: 24 }}>
          <div className="flex items-center justify-between mb-5">
            <p style={{ fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", fontWeight: 700 }}>
              All Proof Images
            </p>
            <button onClick={onClose} style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)" }}>
              Close
            </button>
          </div>
          {proofs.length === 0 ? (
            <p style={{ fontSize: "14px", fontFamily: "'Montserrat', sans-serif", color: "rgba(30,24,20,0.6)" }}>No proof images uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {proofs.map((proof) => (
                <button key={proof.id} onClick={() => setLightboxId(proof.id)} style={{ textAlign: "left" }}>
                  <div style={{ aspectRatio: "1 / 1.2", overflow: "hidden", backgroundColor: "rgba(30,24,20,0.08)", border: "1px solid rgba(30,24,20,0.12)" }}>
                    <AuthThumbnail proofId={proof.id} token={token} orderNumber={proof.shopifyOrderNumber ?? proof.draftOrderId} />
                  </div>
                  <p style={{ marginTop: 8, fontSize: "12px", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", letterSpacing: "0.08em" }}>
                    #{proof.shopifyOrderNumber ?? `Draft ${proof.draftOrderId}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {lightboxId !== null && (
        <ScreenshotModal proofId={lightboxId} token={token} onClose={() => setLightboxId(null)} />
      )}
    </>
  );
}

interface CardOrder {
  id: number;
  intentId: string;
  shopifyOrderId: number | null;
  paymobTxnId: string | null;
  total: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  address: string | null;
  city: string | null;
  bostaDispatched: boolean;
  bostaTrackingNumber: string | null;
  bostaDispatchedAt: string | null;
  createdAt: string;
}

function CardOrdersTab({ token, onAuth }: { token: string; onAuth?: (t: string | null) => void }) {
  const [orders, setOrders] = useState<CardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [filterDispatched, setFilterDispatched] = useState<"all" | "pending" | "dispatched">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/card-orders", { headers: apiHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth?.(null); return;
      }
      if (!res.ok) { setError(`Failed to load card orders. (${res.status})`); setLoading(false); return; }
      const data = await res.json() as { orders: CardOrder[] };
      setOrders(data.orders);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token, onAuth]);

  useEffect(() => { void load(); }, [load]);

  async function dispatch(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/card-orders/${id}/dispatch`, { method: "POST", headers: apiHeaders(token) });
      const data = await res.json() as { ok?: boolean; trackingNumber?: string; error?: string };
      if (!res.ok || data.error) {
        alert(`Dispatch failed: ${data.error ?? "Unknown error"}`);
        return;
      }
      alert(`✅ Dispatched to Bosta\nTracking: ${data.trackingNumber ?? "—"}`);
      await load();
    } finally { setActionLoading(null); }
  }

  const filtered = orders.filter((o) => {
    if (filterDispatched === "pending") return !o.bostaDispatched;
    if (filterDispatched === "dispatched") return o.bostaDispatched;
    return true;
  });

  const pendingCount = orders.filter((o) => !o.bostaDispatched).length;

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p style={{ fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", fontWeight: 700 }}>
            Card Orders
          </p>
          {pendingCount > 0 && (
            <span style={{ backgroundColor: "#c0392b", color: "#fff", fontSize: "11px", fontWeight: 700, fontFamily: "'Montserrat', sans-serif", padding: "2px 7px", borderRadius: 99 }}>
              {pendingCount}
            </span>
          )}
        </div>
        <button onClick={() => void load()} style={{ display: "flex", alignItems: "center", gap: 6, ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)" }}>
          <RefreshCw size={12} strokeWidth={2} /> Refresh
        </button>
      </div>

      <div style={{ backgroundColor: "rgba(60,100,140,0.07)", border: "1px solid rgba(60,100,140,0.2)", padding: "12px 16px", marginBottom: 22 }}>
        <p style={{ ...mono, fontSize: 12, color: "#2d5a7e", lineHeight: 1.6 }}>
          Card payments are confirmed automatically by Paymob. Click <strong>Dispatch</strong> to create the Bosta shipment and mark the order for fulfillment.
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(["pending", "all", "dispatched"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterDispatched(f)}
            style={{ ...btn, backgroundColor: filterDispatched === f ? "#1e1814" : "transparent", color: filterDispatched === f ? "#fff" : "rgba(30,24,20,0.6)", border: "1px solid rgba(30,24,20,0.18)", padding: "6px 12px" }}
          >
            {f === "pending" ? "Pending Dispatch" : f === "dispatched" ? "Dispatched" : "All"}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: "14px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginBottom: 12 }}>{error}</p>}
      {loading && <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          No {filterDispatched === "pending" ? "pending" : filterDispatched === "dispatched" ? "dispatched" : ""} card orders.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((order) => (
          <div key={order.id} style={{ border: "1px solid rgba(30,24,20,0.16)", backgroundColor: "#fff" }}>
            <div className="flex items-center justify-between p-4" style={{ gap: 12 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "19px", fontWeight: 700, color: "#1e1814" }}>
                    {order.shopifyOrderId ? `Shopify #${order.shopifyOrderId}` : `Txn ${order.paymobTxnId ?? order.intentId}`}
                  </span>
                  <span style={{
                    ...mono, fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, padding: "3px 8px",
                    backgroundColor: order.bostaDispatched ? "rgba(60,120,60,0.12)" : "rgba(180,140,40,0.12)",
                    color: order.bostaDispatched ? "#2d6e2d" : "#8a6a10",
                  }}>
                    {order.bostaDispatched ? "Dispatched" : "Pending Dispatch"}
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(30,24,20,0.7)", fontFamily: "'Montserrat', sans-serif", marginTop: 4 }}>
                  {order.customerName ?? "—"} · {order.customerPhone ?? "—"} · <strong>{order.total} EGP</strong>
                </p>
                <p style={{ fontSize: "11px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif", marginTop: 2, letterSpacing: "0.04em" }}>
                  {order.address ?? "—"}{order.city ? `, ${order.city}` : ""} · {fmtDate(order.createdAt)}
                </p>
                {order.bostaDispatched && order.bostaTrackingNumber && (
                  <p style={{ fontSize: "11px", color: "#2d6e2d", fontFamily: "'Montserrat', sans-serif", marginTop: 3, fontWeight: 700 }}>
                    Bosta: {order.bostaTrackingNumber} · Dispatched {fmtDate(order.bostaDispatchedAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!order.bostaDispatched && (
                  <button
                    onClick={() => void dispatch(order.id)}
                    disabled={actionLoading === order.id}
                    style={{ ...btn, backgroundColor: "#1e1814", color: "#fff", display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", opacity: actionLoading === order.id ? 0.6 : 1 }}
                  >
                    {actionLoading === order.id ? "Dispatching…" : "Dispatch to Bosta"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ token, onAuth }: { token: string; onAuth?: (t: string | null) => void }) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fields: { key: string; label: string; placeholder: string; sensitive?: boolean }[] = [
    { key: "apiKey", label: "Paymob API Key", placeholder: "Enter to update", sensitive: true },
    { key: "secretKey", label: "Paymob Secret Key", placeholder: "Enter to update", sensitive: true },
    { key: "publicKey", label: "Paymob Public Key", placeholder: "Enter to update", sensitive: true },
    { key: "integrationId", label: "Integration ID (Card)", placeholder: "Enter to update" },
    { key: "hmacSecret", label: "HMAC Secret", placeholder: "Enter to update", sensitive: true },
  ];

  useEffect(() => {
    fetch("/api/admin/paymob-config", { headers: apiHeaders(token) })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth?.(null); return null;
        }
        return r.json() as Promise<Record<string, string>>;
      })
      .then((d) => { if (d) { setConfig(d); setLoading(false); } })
      .catch(() => setLoading(false));
  }, [token, onAuth]);

  async function handleSave() {
    const patch: Record<string, string> = {};
    for (const f of fields) {
      if (form[f.key]?.trim()) patch[f.key] = form[f.key].trim();
    }
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/paymob-config", {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify(patch),
      });
      if (!res.ok) { setError("Save failed."); return; }
      const updated = await res.json() as Record<string, string>;
      setConfig(updated);
      setForm({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ fontSize: "14px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</p>;

  return (
    <div>
      <p style={{ fontSize: "14px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", fontWeight: 700, marginBottom: "20px" }}>
        Paymob Configuration
      </p>
      <div className="flex flex-col gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label style={label}>
              {f.label}
              {config[f.key] === "configured" && (
                <span style={{ marginLeft: 8, color: "#2d6e2d", fontWeight: 700 }}>✓ configured</span>
              )}
            </label>
            <input
              type={f.sensitive ? "password" : "text"}
              placeholder={f.placeholder}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              style={inputStyle}
              autoComplete="off"
            />
          </div>
        ))}
        {error && <p style={{ fontSize: "12px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>}
        {saved && <p style={{ fontSize: "12px", color: "#2d6e2d", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.08em" }}>✓ Saved successfully</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...btn, backgroundColor: "#1e1814", color: "#fff", padding: "12px", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function getStoredToken(): string | null {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) return null;
  const expiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);
  if (expiry && Date.now() > parseInt(expiry, 10)) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    return null;
  }
  return token;
}

interface DiscountUse {
  id: number;
  code: string;
  orderId: number | null;
  orderNumber: number | null;
  paymentMethod: string | null;
  usedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Analytics Tab                                                     */
/* ------------------------------------------------------------------ */

interface AnalyticsData {
  period: { days: number; since: string } | { from: string; to: string };
  summary: { totalVisitors: number; totalSessions: number; bounceRate: number; returningRate: number; pageViews: number; overallAtcRate: number };
  funnel: {
    visitors: number; productViews: number; addToCarts: number; checkouts: number; purchases: number;
    productViewRate: number; addToCartRate: number; checkoutRate: number; purchaseRate: number; overallConversion: number;
  };
  sourceQuality: { name: string; sessions: number; bounceRate: number; addToCartRate: number; checkoutRate: number; purchaseRate: number }[];
  deviceSegmentation: { name: string; sessions: number; conversionRate: number }[];
  osSegmentation: { name: string; sessions: number; conversionRate: number }[];
  visitorType: { new: { count: number; purchases: number; conversionRate: number }; returning: { count: number; purchases: number; conversionRate: number } };
  hesitationSignals: { repeatedViews: number; longViews: number; cartAbandons: number };
  exitPages: { page: string; count: number; pct: number }[];
  clickHeatmap: { elementId: string; tag: string; text: string; count: number; rageTaps: number }[];
  scrollDistribution: Record<number, number>;
  timeToPurchase: { avg: number | null; min: number | null; max: number | null; count: number };
  productPaths: { productId: string; title: string; views: number; carts: number; purchases: number; viewToCartRate: number; cartToPurchaseRate: number; viewToPurchaseRate: number }[];
  rageTaps: { total: number; topElements: { elementId: string; count: number }[] };
  elementInteractions: { elementType: string; action: string; count: number }[];
  chatActivity: {
    opens: number;
    closes: number;
    sends: number;
    drafts: number;
    avgDraftsPerSession: number;
    recentDrafts: { content: string; sessionId: string; draftSequence: number | null; createdAt: string }[];
  };
}

function FunnelBar({ label, value, max, rate, color }: { label: string; value: number; max: number; rate?: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="flex items-end justify-between" style={{ marginBottom: 6 }}>
        <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: "#1e1814" }}>{label}</span>
        <div className="flex items-center gap-2">
          <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: "#1e1814" }}>{value}</span>
          {rate !== undefined && <span style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>({rate}%)</span>}
        </div>
      </div>
      <div style={{ height: 10, backgroundColor: "rgba(30,24,20,0.06)", borderRadius: 5, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", backgroundColor: color, borderRadius: 5 }}
        />
      </div>
    </div>
  );
}

function AnalyticsTab({ token, onAuth }: { token: string; onAuth?: (t: string | null) => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [analyticsDisabled, setAnalyticsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate && toDate) {
        params.set("from", fromDate);
        params.set("to", toDate);
      } else {
        params.set("days", String(days));
      }
      const res = await fetch(`/api/admin/analytics?${params.toString()}`, { headers: apiHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_EXPIRY_KEY);
        onAuth?.(null);
        return;
      }
      if (!res.ok) { setError(`Failed to load analytics. (${res.status})`); return; }
      const json = await res.json() as AnalyticsData & { disabled?: boolean };
      if (json.disabled) { setAnalyticsDisabled(true); setLoading(false); return; }
      setData(json);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token, days, fromDate, toDate, onAuth]);

  async function handleClear() {
    if (!window.confirm("Clear ALL analytics data? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/admin/analytics/clear", { method: "POST", headers: apiHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth?.(null); return;
      }
      if (!res.ok) { setError("Failed to clear data."); return; }
      await load();
    } catch { setError("Network error clearing data."); }
    finally { setClearing(false); }
  }

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.5)", padding: "40px 0" }}>Loading analytics…</p>;
  if (analyticsDisabled) return <p style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.5)", padding: "40px 0" }}>Analytics tracking is currently disabled.</p>;
  if (error) return (
    <div style={{ padding: "40px 0", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginBottom: 16 }}>{error}</p>
      <button onClick={load} style={{ ...btn, backgroundColor: "#1e1814", color: "#fff", padding: "8px 16px", fontSize: 12 }}>
        Retry
      </button>
      {onAuth && (
        <button onClick={() => { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth(null); }} style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.15)", color: "#1e1814", padding: "8px 16px", fontSize: 12, marginLeft: 8 }}>
          Re-login
        </button>
      )}
    </div>
  );
  if (!data) return null;

  const { summary, funnel, sourceQuality, deviceSegmentation, osSegmentation, visitorType, hesitationSignals, exitPages, clickHeatmap, scrollDistribution, timeToPurchase, productPaths, rageTaps, elementInteractions, chatActivity } = data;

  const statCard = (icon: React.ReactNode, label: string, value: string | number, sub?: string) => (
    <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "18px 16px", flex: 1, minWidth: 140 }}>
      <div style={{ color: "rgba(30,24,20,0.45)", marginBottom: 8 }}>{icon}</div>
      <p style={{ ...mono, fontSize: 23, fontWeight: 700, color: "#1e1814", marginBottom: 4 }}>{value}</p>
      <p style={{ ...mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)" }}>{label}</p>
      {sub && <p style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.4)", marginTop: 4 }}>{sub}</p>}
    </div>
  );

  return (
    <div>
      {/* Time range */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => { setDays(d as 7 | 30 | 90); setFromDate(""); setToDate(""); }}
            style={{
              ...btn,
              backgroundColor: days === d && !fromDate ? "#1e1814" : "transparent",
              color: days === d && !fromDate ? "#fff" : "rgba(30,24,20,0.6)",
              border: "1px solid rgba(30,24,20,0.15)",
              padding: "6px 14px",
              fontSize: 12,
            }}
          >
            Last {d} days
          </button>
        ))}
        <div className="flex items-center gap-2" style={{ marginLeft: 12 }}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, width: 140 }}
          />
          <span style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.4)" }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, width: 140 }}
          />
        </div>
        <button onClick={load} className="ml-auto" style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.15)", padding: "6px 10px" }}>
          <RefreshCw size={14} color="rgba(30,24,20,0.5)" />
        </button>
        <button
          onClick={handleClear}
          disabled={clearing}
          style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(192,57,43,0.3)", color: "#c0392b", padding: "6px 10px", marginLeft: 8 }}
          title="Clear all analytics data"
        >
          <Trash2 size={14} />
          {clearing ? "…" : "Clear"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3 mb-8">
        {statCard(<Users size={18} />, "Visitors", summary.totalVisitors, `${summary.totalSessions} sessions`)}
        {statCard(<MousePointer size={18} />, "Page Views", summary.pageViews)}
        {statCard(<TrendingUp size={18} />, "Conversion", `${funnel.overallConversion}%`, `${funnel.purchases} purchases`)}
        {statCard(<Globe size={18} />, "Returning", `${summary.returningRate}%`, `${Math.round(summary.totalSessions * summary.returningRate / 100)} returning`)}
        {statCard(<AlertTriangle size={18} />, "Bounce Rate", `${summary.bounceRate}%`)}
      </div>

      {/* Conversion Funnel */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Conversion Funnel</p>
        </div>
        <FunnelBar label="Visitors" value={funnel.visitors} max={funnel.visitors} color="#1e1814" />
        <FunnelBar label="Product Views" value={funnel.productViews} max={funnel.visitors} rate={funnel.productViewRate} color="#3a6b4a" />
        <FunnelBar label="Add to Cart" value={funnel.addToCarts} max={funnel.visitors} rate={funnel.addToCartRate} color="#5a8a6a" />
        <FunnelBar label="Checkout Started" value={funnel.checkouts} max={funnel.visitors} rate={funnel.checkoutRate} color="#7aaa8a" />
        <FunnelBar label="Purchase" value={funnel.purchases} max={funnel.visitors} rate={funnel.purchaseRate} color="#bfa07a" />

        {/* Drop-off summary */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(30,24,20,0.06)" }}>
          <p style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)", lineHeight: 1.6 }}>
            Overall conversion: <strong>{funnel.overallConversion}%</strong> of visitors purchased.&nbsp;
            {funnel.visitors > 0 && funnel.purchases < funnel.visitors && (
              <span>Drop-off: {funnel.visitors - funnel.purchases} visitors did not convert.</span>
            )}
          </p>
        </div>
      </div>

      {/* Traffic Source Quality */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <Globe size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Traffic Source Quality</p>
        </div>
        {sourceQuality.length === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No traffic data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {sourceQuality.map((src) => (
              <div key={src.name} style={{ flex: 1, minWidth: 160, background: "rgba(30,24,20,0.02)", border: "1px solid rgba(30,24,20,0.06)", padding: 14 }}>
                <p style={{ ...mono, fontSize: 12, fontWeight: 700, color: "#1e1814", marginBottom: 8 }}>{src.name}</p>
                <div className="flex flex-col gap-1">
                  <SourceMetric label="Sessions" value={src.sessions} />
                  <SourceMetric label="Bounce" value={`${src.bounceRate}%`} warn={src.bounceRate > 50} />
                  <SourceMetric label="ATC Rate" value={`${src.addToCartRate}%`} />
                  <SourceMetric label="Checkout" value={`${src.checkoutRate}%`} />
                  <SourceMetric label="Purchase" value={`${src.purchaseRate}%`} good={src.purchaseRate > 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device & OS */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div style={{ flex: 1, minWidth: 260, background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={16} color="#1e1814" />
            <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Device</p>
          </div>
          {deviceSegmentation.map((d) => (
            <div key={d.name} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid rgba(30,24,20,0.04)" }}>
              <span style={{ ...mono, fontSize: 12, color: "#1e1814" }}>{d.name}</span>
              <span style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.5)" }}>{d.sessions} <span style={{ color: d.conversionRate > 0 ? "#3a6b4a" : "rgba(30,24,20,0.35)" }}>({d.conversionRate}%)</span></span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 260, background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Smartphone size={16} color="#1e1814" />
            <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Operating System</p>
          </div>
          {osSegmentation.map((o) => (
            <div key={o.name} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid rgba(30,24,20,0.04)" }}>
              <span style={{ ...mono, fontSize: 12, color: "#1e1814" }}>{o.name}</span>
              <span style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.5)" }}>{o.sessions} <span style={{ color: o.conversionRate > 0 ? "#3a6b4a" : "rgba(30,24,20,0.35)" }}>({o.conversionRate}%)</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Visitor Type */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <Users size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>New vs Returning Visitors</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div style={{ flex: 1, minWidth: 200, background: "rgba(30,24,20,0.02)", border: "1px solid rgba(30,24,20,0.06)", padding: 16 }}>
            <p style={{ ...mono, fontSize: 12, fontWeight: 700, color: "#1e1814", marginBottom: 4 }}>New</p>
            <p style={{ ...mono, fontSize: 25, fontWeight: 700, color: "#1e1814" }}>{visitorType.new.count}</p>
            <p style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>{visitorType.new.purchases} purchases ({visitorType.new.conversionRate}%)</p>
          </div>
          <div style={{ flex: 1, minWidth: 200, background: "rgba(30,24,20,0.02)", border: "1px solid rgba(30,24,20,0.06)", padding: 16 }}>
            <p style={{ ...mono, fontSize: 12, fontWeight: 700, color: "#1e1814", marginBottom: 4 }}>Returning</p>
            <p style={{ ...mono, fontSize: 25, fontWeight: 700, color: "#1e1814" }}>{visitorType.returning.count}</p>
            <p style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>{visitorType.returning.purchases} purchases ({visitorType.returning.conversionRate}%)</p>
          </div>
        </div>
      </div>

      {/* Hesitation Signals */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Hesitation Signals</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {statCard(<Eye size={18} />, "Repeated Views", hesitationSignals.repeatedViews, "viewed same product 2+")}
          {statCard(<Clock size={18} />, "Long Views (>60s)", hesitationSignals.longViews, "high intent / considering")}
          {statCard(<X size={18} />, "Cart Abandons", hesitationSignals.cartAbandons, "closed cart with items")}
        </div>
      </div>

      {/* Exit Pages */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <ArrowRight size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Exit Pages</p>
        </div>
        {exitPages.length === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No exit page data yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {exitPages.map((ep) => {
              const max = exitPages[0].count;
              const pct = max > 0 ? (ep.count / max) * 100 : 0;
              return (
                <div key={ep.page}>
                  <div className="flex items-end justify-between" style={{ marginBottom: 6 }}>
                    <span style={{ ...mono, fontSize: 12, fontWeight: 500, color: "#1e1814" }}>{ep.page}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ ...mono, fontSize: 15, fontWeight: 700, color: "#1e1814" }}>{ep.count}</span>
                      <span style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.45)", background: "rgba(30,24,20,0.06)", padding: "2px 6px", borderRadius: 4 }}>{ep.pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, backgroundColor: "rgba(30,24,20,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      style={{ height: "100%", backgroundColor: "#bfa07a", borderRadius: 3 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Click Heatmap */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <MousePointer size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Click Heatmap — Top Elements</p>
        </div>
        {clickHeatmap.length === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No click data yet. Browse the site to populate.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {clickHeatmap.map((c) => (
              <div key={c.elementId} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid rgba(30,24,20,0.04)" }}>
                <div>
                  <span style={{ ...mono, fontSize: 12, color: "#1e1814" }}>{c.elementId.slice(0, 40)}</span>
                  {c.text && <span style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.4)", marginLeft: 8 }}>{c.text}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: "#1e1814" }}>{c.count} clicks</span>
                  {c.rageTaps > 0 && <span style={{ ...mono, fontSize: 10, color: "#c0392b", fontWeight: 600 }}>{c.rageTaps} rage</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scroll Depth Distribution */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Scroll Depth Distribution</p>
        </div>
        {Object.keys(scrollDistribution).length === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No scroll data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((bucket) => {
              const count = scrollDistribution[bucket] ?? 0;
              const maxCount = Math.max(...Object.values(scrollDistribution), 1);
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={bucket} style={{ flex: 1, minWidth: 40, textAlign: "center" }}>
                  <div style={{ height: 80, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 6 }}>
                    <div style={{ width: 24, height: `${Math.max(pct, 4)}%`, backgroundColor: count > 0 ? "#1e1814" : "rgba(30,24,20,0.06)", borderRadius: 2 }} />
                  </div>
                  <p style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.5)" }}>{bucket}%</p>
                  <p style={{ ...mono, fontSize: 10, fontWeight: 600, color: "#1e1814" }}>{count}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Time to Purchase */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <Clock size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Time to Purchase</p>
        </div>
        {timeToPurchase.count === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No purchase data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {statCard(<Clock size={18} />, "Average", timeToPurchase.avg !== null ? `${timeToPurchase.avg} min` : "—", `${timeToPurchase.count} purchases`)}
            {statCard(<TrendingUp size={18} />, "Fastest", timeToPurchase.min !== null ? `${timeToPurchase.min} min` : "—", "first visit → buy")}
            {statCard(<TrendingUp size={18} />, "Slowest", timeToPurchase.max !== null ? `${timeToPurchase.max} min` : "—", "longest journey")}
          </div>
        )}
      </div>

      {/* Product Conversion Paths */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Product Conversion Paths</p>
        </div>
        {productPaths.length === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No product path data yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {productPaths.map((p) => (
              <div key={p.productId} style={{ background: "rgba(30,24,20,0.02)", border: "1px solid rgba(30,24,20,0.06)", padding: 14 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: "#1e1814" }}>{p.title}</span>
                  <span style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>{p.views} views</span>
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>Cart: {p.carts} ({p.viewToCartRate}%)</span>
                  <span style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>Purchase: {p.purchases} ({p.viewToPurchaseRate}%)</span>
                  {p.cartToPurchaseRate > 0 && (
                    <span style={{ ...mono, fontSize: 11, color: "#3a6b4a", fontWeight: 600 }}>Cart→Buy: {p.cartToPurchaseRate}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rage Taps */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle size={16} color="#c0392b" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Rage Taps (Frustration Signals)</p>
        </div>
        {statCard(<AlertTriangle size={18} />, "Total Rage Taps", rageTaps.total, "rapid repeated clicks")}
        {rageTaps.topElements.length > 0 && (
          <div className="flex flex-col gap-1 mt-4">
            <p style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)", marginBottom: 6 }}>Most frustrating elements:</p>
            {rageTaps.topElements.map((rt) => (
              <div key={rt.elementId} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid rgba(30,24,20,0.04)" }}>
                <span style={{ ...mono, fontSize: 11, color: "#1e1814" }}>{rt.elementId.slice(0, 40)}</span>
                <span style={{ ...mono, fontSize: 11, fontWeight: 600, color: "#c0392b" }}>{rt.count}x</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Element Interactions */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-5">
          <MousePointer size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Element Interactions</p>
        </div>
        {elementInteractions.length === 0 ? (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No element interaction data yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {elementInteractions.map((ei) => (
              <div key={`${ei.elementType}-${ei.action}`} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid rgba(30,24,20,0.04)" }}>
                <span style={{ ...mono, fontSize: 12, color: "#1e1814" }}>{ei.elementType} • {ei.action}</span>
                <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: "rgba(30,24,20,0.6)" }}>{ei.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Activity */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,24,20,0.08)", padding: "22px 20px" }}>
        <div className="flex items-center gap-2 mb-5">
          <MessageCircle size={16} color="#1e1814" />
          <p style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814" }}>Chat Activity</p>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          {statCard(<MessageCircle size={18} />, "Chat Opens", chatActivity.opens, `${Math.round((chatActivity.opens / Math.max(summary.totalSessions, 1)) * 100)}% of sessions`)}
          {statCard(<X size={18} />, "Chat Closes", chatActivity.closes)}
          {statCard(<Send size={18} />, "Messages Sent", chatActivity.sends)}
          {statCard(<MousePointer size={18} />, "Draft Edits", chatActivity.drafts, `${chatActivity.avgDraftsPerSession} avg/session`)}
        </div>
        {chatActivity.recentDrafts.length > 0 && (
          <div>
            <p style={{ ...mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", marginBottom: 10 }}>Recent Drafts (typed before sending)</p>
            <div className="flex flex-col gap-1" style={{ maxHeight: 240, overflowY: "auto" }}>
              {chatActivity.recentDrafts.map((d, i) => (
                <div key={i} className="flex flex-col" style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30,24,20,0.04)", background: i % 2 === 0 ? "#faf8f5" : "#fff" }}>
                  <p style={{ ...mono, fontSize: 12, color: "#1e1814", lineHeight: 1.5, marginBottom: 4, wordBreak: "break-word" }}>{d.content}</p>
                  <div className="flex items-center gap-3">
                    <span style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.35)" }}>Session {d.sessionId}</span>
                    <span style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.35)" }}>Draft #{d.draftSequence}</span>
                    <span style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.35)" }}>{new Date(d.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {chatActivity.recentDrafts.length === 0 && chatActivity.opens === 0 && (
          <p style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.45)" }}>No chat activity yet.</p>
        )}
      </div>
    </div>
  );
}

function SourceMetric({ label, value, warn, good }: { label: string; value: string | number; warn?: boolean; good?: boolean }) {
  const color = warn ? "#c0392b" : good ? "#3a6b4a" : "rgba(30,24,20,0.55)";
  return (
    <div className="flex items-center justify-between">
      <span style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)" }}>{label}</span>
      <span style={{ ...mono, fontSize: 11, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

function DiscountsTab({ token, onAuth }: { token: string; onAuth?: (t: string | null) => void }) {
  const [uses, setUses] = useState<DiscountUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/discount-uses", { headers: apiHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth?.(null); return;
      }
      if (!res.ok) { setError(`Failed to load discount uses. (${res.status})`); return; }
      const data = await res.json() as { uses: DiscountUse[] };
      setUses(data.uses);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token, onAuth]);

  useEffect(() => { void load(); }, [load]);

  // Group by code
  const grouped = uses.reduce<Record<string, DiscountUse[]>>((acc, u) => {
    (acc[u.code] = acc[u.code] ?? []).push(u);
    return acc;
  }, {});

  const methodLabel = (m: string | null) => {
    if (!m) return "—";
    if (m === "cod") return "COD";
    if (m === "card") return "Card";
    if (m === "instapay") return "InstaPay";
    return m;
  };

  if (loading) return <p style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.5)", padding: "40px 0" }}>Loading…</p>;
  if (error) return <p style={{ fontSize: 14, color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 27, fontWeight: 700, color: "#1e1814", marginBottom: 4 }}>
            Discount Codes
          </p>
          <p style={{ ...mono, fontSize: 11, letterSpacing: "0.15em", color: "rgba(30,24,20,0.5)", textTransform: "uppercase" }}>
            {uses.length} uses tracked in database
          </p>
        </div>
        <button onClick={() => void load()} style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={12} strokeWidth={2} /> Refresh
        </button>
      </div>

      {/* Note about Shopify counter */}
      <div style={{ backgroundColor: "rgba(180,140,40,0.08)", border: "1px solid rgba(180,140,40,0.25)", padding: "12px 16px", marginBottom: 24 }}>
        <p style={{ ...mono, fontSize: 12, color: "#7a5f10", lineHeight: 1.6 }}>
          Shopify&apos;s &quot;Used&quot; counter on the Discounts page stays at 0 for all API-created orders — this is a Shopify platform limitation (usage_count only increments through their hosted checkout). This database is the real source of truth for enforcement and reporting.
        </p>
      </div>

      {uses.length === 0 ? (
        <p style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.45)", textAlign: "center", padding: "48px 0" }}>No discount codes used yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([code, codeUses]) => (
            <div key={code} style={{ backgroundColor: "#fff", border: "1px solid rgba(30,24,20,0.1)" }}>
              {/* Code header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(30,24,20,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...mono, fontSize: 15, fontWeight: 700, color: "#1e1814", letterSpacing: "0.12em" }}>{code}</span>
                <span style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", backgroundColor: "rgba(30,24,20,0.07)", padding: "3px 10px", color: "#1e1814", fontWeight: 700 }}>
                  {codeUses.length} {codeUses.length === 1 ? "use" : "uses"}
                </span>
              </div>
              {/* Uses table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(30,24,20,0.08)" }}>
                    {["Order #", "Method", "Date"].map((h) => (
                      <th key={h} style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontWeight: 700, textAlign: "left", padding: "8px 18px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {codeUses.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < codeUses.length - 1 ? "1px solid rgba(30,24,20,0.05)" : "none" }}>
                      <td style={{ ...mono, fontSize: 14, color: "#1e1814", padding: "10px 18px" }}>
                        {u.orderNumber ? `#${u.orderNumber}` : u.orderId ? `id:${u.orderId}` : "—"}
                      </td>
                      <td style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.7)", padding: "10px 18px" }}>{methodLabel(u.paymentMethod)}</td>
                      <td style={{ ...mono, fontSize: 12, color: "rgba(30,24,20,0.6)", padding: "10px 18px" }}>
                        {new Date(u.usedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AbandonedCartItem {
  id: number;
  email: string;
  totalAmount: string;
  status: string;
  lineItemsCount: number;
  createdAt: string;
  emailSentAt: string | null;
  clickedAt: string | null;
  recoveredAt: string | null;
}

interface AbandonedStats {
  started: number;
  sent: number;
  clicked: number;
  recovered: number;
  totalStarted: number;
  recoveryRate: number;
  convertedBeforeEmail: number;
  convertedAfterEmail: number;
  emailDrivenRate: number;
}

function AbandonedCartsTab({ token, onAuth }: { token: string; onAuth?: (t: string | null) => void }) {
  const [items, setItems] = useState<AbandonedCartItem[]>([]);
  const [stats, setStats] = useState<AbandonedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/admin/abandoned-carts?${params.toString()}`, { headers: apiHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); onAuth?.(null); return;
      }
      if (!res.ok) { setError(`Failed to load abandoned carts. (${res.status})`); setLoading(false); return; }
      const data = await res.json() as { stats: AbandonedStats; items: AbandonedCartItem[] };
      setStats(data.stats);
      setItems(data.items);
      setLoading(false);
    } catch { setError("Network error."); setLoading(false); }
  }, [token, statusFilter, dateFrom, dateTo, onAuth]);

  useEffect(() => { void load(); }, [load]);

  const statusColors: Record<string, { bg: string; text: string }> = {
    started: { bg: "rgba(180,140,40,0.12)", text: "#8a6a10" },
    email_sent: { bg: "rgba(60,100,140,0.12)", text: "#2d5a7e" },
    clicked: { bg: "rgba(60,120,60,0.12)", text: "#2d6e2d" },
    recovered: { bg: "rgba(60,120,60,0.12)", text: "#2d6e2d" },
  };

  const formatDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 27, fontWeight: 700, color: "#1e1814", marginBottom: 4 }}>
            Abandoned Carts
          </p>
          <p style={{ ...mono, fontSize: 11, letterSpacing: "0.15em", color: "rgba(30,24,20,0.5)", textTransform: "uppercase" }}>
            Recovery funnel & stats
          </p>
        </div>
        <button onClick={() => void load()} style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={12} strokeWidth={2} /> Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Started", value: stats.totalStarted, sub: "entered checkout" },
            { label: "Emails Sent", value: stats.sent, sub: "recovery emails" },
            { label: "Clicked", value: stats.clicked, sub: "email links clicked" },
            { label: "Recovered", value: stats.recovered, sub: "orders placed" },
            { label: "Recovery Rate", value: `${stats.recoveryRate}%`, sub: "of all who started" },
            { label: "Email-Driven", value: `${stats.emailDrivenRate}%`, sub: `${stats.convertedAfterEmail} of ${stats.recovered} after email` },
            { label: "Auto-Converted", value: stats.convertedBeforeEmail, sub: "ordered before email" },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "#fff", border: "1px solid rgba(30,24,20,0.1)", padding: "16px 18px" }}>
              <p style={{ ...mono, fontSize: 23, fontWeight: 700, color: "#1e1814", marginBottom: 4 }}>{s.value}</p>
              <p style={{ ...mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontWeight: 700 }}>{s.label}</p>
              <p style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.4)", marginTop: 2 }}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: "auto", minWidth: 140 }}
        >
          <option value="">All Statuses</option>
          <option value="started">Started</option>
          <option value="email_sent">Email Sent</option>
          <option value="clicked">Clicked</option>
          <option value="recovered">Recovered</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
        <button onClick={() => { setStatusFilter(""); setDateFrom(""); setDateTo(""); }} style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.6)", fontSize: 10 }}>
          Clear
        </button>
      </div>

      {/* Send Test Email panel */}
      <div style={{ backgroundColor: "#fff", border: "1px solid rgba(30,24,20,0.1)", padding: "20px 24px", marginBottom: 28 }}>
        <p style={{ ...mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontWeight: 700, marginBottom: 14 }}>Send Test Email</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Recipient email"
            defaultValue="test@moi.com"
            id="ab-test-email"
            style={{ ...inputStyle, width: 240 }}
          />
          <button
            onClick={async () => {
              const to = (document.getElementById("ab-test-email") as HTMLInputElement)?.value?.trim() || "test@moi.com";
              try {
                const res = await fetch("/api/admin/abandoned-carts/send-test", { method: "POST", headers: apiHeaders(token), body: JSON.stringify({ to }) });
                const data = await res.json() as { ok?: boolean; error?: string; recoveryUrl?: string };
                if (!res.ok || data.error) { setError(data.error ?? "Failed to send"); return; }
                alert(`Test email sent to ${to}. Check your inbox and spam folder.\n\nRecovery link: ${data.recoveryUrl ?? ""}`);
                void load();
              } catch { setError("Network error sending test email."); }
            }}
            style={{ ...btn, backgroundColor: "#1e1814", color: "#fff" }}
          >
            Send Test Email
          </button>
        </div>
        <p style={{ ...mono, fontSize: 10, color: "rgba(30,24,20,0.4)", marginTop: 8 }}>Creates a sample cart and sends the recovery email immediately — no 30-minute wait.</p>
      </div>

      {loading && <p style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.5)", padding: "40px 0" }}>Loading…</p>}
      {error && <p style={{ fontSize: 14, color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>}

      {!loading && !error && (
        items.length === 0 ? (
          <p style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.45)", textAlign: "center", padding: "48px 0" }}>No abandoned carts yet.</p>
        ) : (
          <div style={{ backgroundColor: "#fff", border: "1px solid rgba(30,24,20,0.1)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ minWidth: 1100, borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(30,24,20,0.08)", backgroundColor: "#faf8f5" }}>
                    {["Email", "Items", "Total", "Status", "Created", "Sent", "Clicked", "Recovered", ""].map((h) => (
                      <th key={h} style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(30,24,20,0.5)", fontWeight: 700, textAlign: "left", padding: "10px 14px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const sc = statusColors[item.status] ?? { bg: "rgba(30,24,20,0.1)", text: "rgba(30,24,20,0.7)" };
                    const isRecovered = item.status === "recovered";
                    const recoveredAfterEmail = isRecovered && item.emailSentAt && item.recoveredAt && new Date(item.recoveredAt) >= new Date(item.emailSentAt);
                    const recoveredBeforeEmail = isRecovered && (!item.emailSentAt || (item.recoveredAt && new Date(item.recoveredAt) < new Date(item.emailSentAt)));
                    return (
                      <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? "1px solid rgba(30,24,20,0.05)" : "none" }}>
                        <td style={{ ...mono, fontSize: 14, color: "#1e1814", padding: "10px 14px", whiteSpace: "nowrap" }}>{item.email}</td>
                        <td style={{ ...mono, fontSize: 14, color: "rgba(30,24,20,0.7)", padding: "10px 14px", whiteSpace: "nowrap" }}>{item.lineItemsCount}</td>
                        <td style={{ ...mono, fontSize: 14, color: "#1e1814", fontWeight: 600, padding: "10px 14px", whiteSpace: "nowrap" }}>{item.totalAmount}&nbsp;EGP</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, padding: "3px 8px", backgroundColor: sc.bg, color: sc.text }}>
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)", padding: "10px 14px", whiteSpace: "nowrap" }}>{formatDate(item.createdAt)}</td>
                        <td style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)", padding: "10px 14px", whiteSpace: "nowrap" }}>{formatDate(item.emailSentAt)}</td>
                        <td style={{ ...mono, fontSize: 11, color: "rgba(30,24,20,0.5)", padding: "10px 14px", whiteSpace: "nowrap" }}>{formatDate(item.clickedAt)}</td>
                        <td style={{ ...mono, fontSize: 11, padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {recoveredBeforeEmail && (
                            <span style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, padding: "2px 6px", backgroundColor: "rgba(140,100,40,0.12)", color: "#7a5a10" }}>
                              Before email
                            </span>
                          )}
                          {recoveredAfterEmail && (
                            <span style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, padding: "2px 6px", backgroundColor: "rgba(60,120,60,0.12)", color: "#2d6e2d" }}>
                              After email
                            </span>
                          )}
                          {!isRecovered && formatDate(item.recoveredAt)}
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {item.status === "started" && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/admin/abandoned-carts/${item.id}/send-now`, { method: "POST", headers: apiHeaders(token) });
                                  const data = await res.json() as { ok?: boolean; error?: string; recoveryUrl?: string };
                                  if (!res.ok || data.error) { setError(data.error ?? "Failed to send"); return; }
                                  alert(`Email sent to ${item.email}\nRecovery link: ${data.recoveryUrl ?? ""}`);
                                  void load();
                                } catch { setError("Network error sending email."); }
                              }}
                              style={{ ...btn, backgroundColor: "transparent", border: "1px solid rgba(30,24,20,0.2)", color: "rgba(30,24,20,0.7)", fontSize: 10, padding: "4px 8px" }}
                            >
                              Send Now
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function useAuth() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    setToken(null);
  }, []);
  return { token, setToken, logout };
}

export function AdminPage() {
  const { token, setToken, logout } = useAuth();
  const [tab, setTab] = useState<"analytics" | "proofs" | "card-orders" | "abandoned" | "discounts" | "settings">("analytics");

  if (!token) {
    return <PinGate onAuth={setToken} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f3ee" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1e1814", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "23px", fontWeight: 700, color: "#fff", letterSpacing: "0.08em" }}>MOI</span>
          <span style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: "'Montserrat', sans-serif", marginLeft: 12 }}>Admin</span>
        </div>
        <button
          onClick={logout}
          style={{ display: "flex", alignItems: "center", gap: 6, ...btn, backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", padding: "6px 12px" }}
        >
          <LogOut size={12} strokeWidth={2} />
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid rgba(30,24,20,0.16)", backgroundColor: "#fff", paddingLeft: 24, overflowX: "auto", whiteSpace: "nowrap" }}>
        {(["analytics", "proofs", "card-orders", "abandoned", "discounts", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...btn,
              backgroundColor: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid #1e1814" : "2px solid transparent",
              color: tab === t ? "#1e1814" : "rgba(30,24,20,0.5)",
              padding: "14px 18px",
              marginRight: 4,
              borderRadius: 0,
            }}
          >
            {t === "analytics" ? "Analytics" : t === "proofs" ? "InstaPay" : t === "card-orders" ? "Card Orders" : t === "abandoned" ? "Abandoned Carts" : t === "discounts" ? "Discounts" : "Settings"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <AnimatePresence mode="wait">
          {tab === "analytics" ? (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AnalyticsTab token={token} onAuth={setToken} />
            </motion.div>
          ) : tab === "proofs" ? (
            <motion.div key="proofs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProofsTab token={token} onAuth={setToken} />
            </motion.div>
          ) : tab === "card-orders" ? (
            <motion.div key="card-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CardOrdersTab token={token} onAuth={setToken} />
            </motion.div>
          ) : tab === "abandoned" ? (
            <motion.div key="abandoned" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AbandonedCartsTab token={token} onAuth={setToken} />
            </motion.div>
          ) : tab === "discounts" ? (
            <motion.div key="discounts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DiscountsTab token={token} onAuth={setToken} />
            </motion.div>
          ) : (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SettingsTab token={token} onAuth={setToken} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
