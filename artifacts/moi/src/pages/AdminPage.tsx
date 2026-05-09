import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eye, RefreshCw, ChevronDown, ChevronUp, LogOut } from "lucide-react";

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN as string | undefined;
const SESSION_KEY = "moi_admin_token";
const SESSION_EXPIRY_KEY = "moi_admin_token_expiry";

interface Proof {
  id: number;
  shopifyOrderId: number;
  shopifyOrderNumber: number;
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
  fontSize: "13px",
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
        <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "32px", fontWeight: 700, color: "#1e1814", marginBottom: "4px" }}>
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
        {error && <p style={{ padding: "24px 40px", fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>}
        {!src && !error && (
          <div style={{ padding: "40px 60px", fontSize: "13px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</div>
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
        <p style={{ fontSize: "13px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#1e1814", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, marginBottom: "16px" }}>
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

function ProofsTab({ token }: { token: string }) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [screenshotId, setScreenshotId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/instapay-proofs", { headers: apiHeaders(token) });
      if (!res.ok) { setError("Failed to load proofs."); return; }
      const data = await res.json() as { proofs: Proof[] };
      setProofs(data.proofs);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      {rejectId !== null && (
        <RejectDialog onConfirm={(r) => reject(rejectId, r)} onCancel={() => setRejectId(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", fontWeight: 700 }}>
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

      {error && <p style={{ fontSize: "13px", color: "#c0392b", fontFamily: "'Montserrat', sans-serif", marginBottom: 12 }}>{error}</p>}
      {loading && <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          No {filterStatus === "all" ? "" : filterStatus} proofs found.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((proof) => (
          <div key={proof.id} style={{ border: "1px solid rgba(30,24,20,0.16)", backgroundColor: "#fff" }}>
            <div className="flex items-center justify-between p-4" style={{ gap: 12 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "18px", fontWeight: 700, color: "#1e1814" }}>
                    #{proof.shopifyOrderNumber}
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

function SettingsTab({ token }: { token: string }) {
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
      .then((r) => r.json() as Promise<Record<string, string>>)
      .then((d) => { setConfig(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

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

  if (loading) return <p style={{ fontSize: "13px", color: "rgba(30,24,20,0.6)", fontFamily: "'Montserrat', sans-serif" }}>Loading…</p>;

  return (
    <div>
      <p style={{ fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", color: "#1e1814", fontWeight: 700, marginBottom: "20px" }}>
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

export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [tab, setTab] = useState<"proofs" | "settings">("proofs");

  if (!token) {
    return <PinGate onAuth={setToken} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f3ee" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1e1814", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#fff", letterSpacing: "0.08em" }}>MOI</span>
          <span style={{ fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: "'Montserrat', sans-serif", marginLeft: 12 }}>Admin</span>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_EXPIRY_KEY); setToken(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6, ...btn, backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", padding: "6px 12px" }}
        >
          <LogOut size={12} strokeWidth={2} />
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid rgba(30,24,20,0.16)", backgroundColor: "#fff", paddingLeft: 24 }}>
        {(["proofs", "settings"] as const).map((t) => (
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
            {t === "proofs" ? "Payments" : "Settings"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <AnimatePresence mode="wait">
          {tab === "proofs" ? (
            <motion.div key="proofs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProofsTab token={token} />
            </motion.div>
          ) : (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SettingsTab token={token} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
