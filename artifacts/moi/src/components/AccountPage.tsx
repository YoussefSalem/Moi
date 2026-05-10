import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Package, User, Save, Loader2 } from "lucide-react";
import { useCustomer } from "@/context/CustomerContext";

const TOKEN_KEY = "moi_customer_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Address {
  id: number;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  zip: string | null;
  default: boolean;
}

interface Order {
  id: number;
  orderNumber: number;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  totalPrice: string;
  currency: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(financial: string, fulfillment: string | null): string {
  if (fulfillment === "fulfilled") return "Delivered";
  if (fulfillment === "partial") return "Partially Shipped";
  if (financial === "paid") return "Processing";
  if (financial === "pending") return "Pending Payment";
  if (financial === "refunded") return "Refunded";
  return financial.replace(/_/g, " ");
}

function statusColor(financial: string, fulfillment: string | null): string {
  if (fulfillment === "fulfilled") return "#3a7d44";
  if (fulfillment === "partial") return "#8a6a20";
  if (financial === "paid") return "#4a6fa5";
  if (financial === "refunded") return "#7a6e64";
  return "#7a6e64";
}

export function AccountPage() {
  const { customer, accountOpen, closeAccount, signOut, updateCustomer } = useCustomer();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [profileUnavailable, setProfileUnavailable] = useState(false);

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setProfileLoading(true);
    setProfileUnavailable(false);
    try {
      const r = await fetch(`${BASE}/api/auth/customer/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json() as {
          firstName: string | null;
          lastName: string | null;
          phone: string | null;
          addresses: Address[];
        };
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setPhone(data.phone ?? "");
        setAddresses(data.addresses ?? []);
      } else {
        setProfileUnavailable(true);
      }
    } catch {
      setProfileUnavailable(true);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setOrdersLoading(true);
    try {
      const r = await fetch(`${BASE}/api/auth/customer/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json() as { orders: Order[] };
        setOrders(data.orders);
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accountOpen && customer) {
      setFirstName(customer.firstName ?? "");
      setLastName(customer.lastName ?? "");
      setPhone(customer.phone ?? "");
      loadProfile();
      loadOrders();
    }
  }, [accountOpen, customer, loadProfile, loadOrders]);

  useEffect(() => {
    if (accountOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [accountOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAccount(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAccount]);

  const handleSave = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const r = await fetch(`${BASE}/api/auth/customer/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const data = await r.json() as {
        token?: string;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        error?: string;
      };
      if (!r.ok) {
        setSaveError(data.error ?? "Failed to save changes.");
        return;
      }
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      updateCustomer({
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .map((s) => s![0].toUpperCase())
    .join("") || customer?.email?.[0]?.toUpperCase() || "?";

  return (
    <AnimatePresence>
      {accountOpen && customer && (
        <motion.div
          key="account-page"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[80] overflow-y-auto"
          style={{ backgroundColor: "#faf8f5" }}
        >
          <div className="flex items-center justify-between px-8 md:px-16 pt-8 pb-4 border-b border-stone-200 sticky top-0 z-10" style={{ backgroundColor: "#faf8f5" }}>
            <button
              onClick={closeAccount}
              className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase hover:opacity-50 transition-opacity"
              style={{ color: "#1e1814" }}
            >
              <span style={{ fontFamily: "monospace", fontSize: 16 }}>←</span>
              <span>Back</span>
            </button>
            <span className="font-serif text-xl tracking-[0.3em]" style={{ color: "#1e1814" }}>MOI</span>
            <button onClick={closeAccount} className="hover:opacity-50 transition-opacity" aria-label="Close">
              <X size={20} strokeWidth={1.5} style={{ color: "#1e1814" }} />
            </button>
          </div>

          <div className="max-w-2xl mx-auto px-6 md:px-8 py-12 space-y-14">

            {/* ── Profile section ── */}
            <section>
              <div className="flex items-center gap-3 mb-8">
                <User size={14} strokeWidth={1.5} style={{ color: "#7a6e64" }} />
                <h2 className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>Profile</h2>
              </div>

              <div className="flex items-center gap-5 mb-8">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-light tracking-widest"
                  style={{ backgroundColor: "#1e1814", color: "#faf8f5", letterSpacing: "0.12em" }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-light" style={{ color: "#1e1814" }}>
                    {[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="text-[11px] tracking-wide mt-0.5" style={{ color: "#7a6e64" }}>{customer.email}</p>
                </div>
              </div>

              {profileLoading ? (
                <div className="flex items-center gap-2 py-6" style={{ color: "#7a6e64" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[11px] tracking-widest uppercase">Loading…</span>
                </div>
              ) : profileUnavailable ? (
                <p className="text-sm font-light" style={{ color: "#7a6e64" }}>
                  Profile details are not available for this account.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: "#7a6e64" }}>
                        First Name
                      </label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-4 py-3 text-sm font-light border border-stone-200 bg-transparent outline-none focus:border-stone-400 transition-colors"
                        style={{ color: "#1e1814" }}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: "#7a6e64" }}>
                        Last Name
                      </label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-4 py-3 text-sm font-light border border-stone-200 bg-transparent outline-none focus:border-stone-400 transition-colors"
                        style={{ color: "#1e1814" }}
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: "#7a6e64" }}>
                      Phone Number
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 text-sm font-light border border-stone-200 bg-transparent outline-none focus:border-stone-400 transition-colors"
                      style={{ color: "#1e1814" }}
                      placeholder="+20 1xx xxx xxxx"
                      type="tel"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: "#7a6e64" }}>
                      Email Address
                    </label>
                    <input
                      value={customer.email}
                      readOnly
                      className="w-full px-4 py-3 text-sm font-light border border-stone-100 bg-stone-50 cursor-default"
                      style={{ color: "#7a6e64" }}
                    />
                  </div>

                  {saveError && (
                    <p className="text-[11px] tracking-wide" style={{ color: "#c0392b" }}>{saveError}</p>
                  )}

                  <div className="flex items-center gap-4 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-8 py-3 text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300 hover:opacity-80 disabled:opacity-50"
                      style={{ backgroundColor: "#1e1814", color: "#faf8f5" }}
                    >
                      {saving ? (
                        <><Loader2 size={12} className="animate-spin" /><span>Saving…</span></>
                      ) : (
                        <><Save size={12} /><span>Save Changes</span></>
                      )}
                    </button>
                    {saveSuccess && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[11px] tracking-[0.18em] uppercase"
                        style={{ color: "#3a7d44" }}
                      >
                        Saved ✓
                      </motion.span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ── Addresses section ── */}
            <section>
              <div className="flex items-center gap-3 mb-8">
                <MapPin size={14} strokeWidth={1.5} style={{ color: "#7a6e64" }} />
                <h2 className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>Saved Addresses</h2>
              </div>

              {profileLoading ? (
                <div className="flex items-center gap-2 py-4" style={{ color: "#7a6e64" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[11px] tracking-widest uppercase">Loading…</span>
                </div>
              ) : profileUnavailable ? (
                <p className="text-sm font-light" style={{ color: "#7a6e64" }}>
                  Address information is not available for this account.
                </p>
              ) : addresses.length === 0 ? (
                <p className="text-sm font-light" style={{ color: "#7a6e64" }}>No saved addresses yet.</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="border border-stone-200 px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-sm font-light space-y-0.5" style={{ color: "#1e1814" }}>
                          {addr.address1 && <p>{addr.address1}</p>}
                          {addr.address2 && <p>{addr.address2}</p>}
                          <p>{[addr.city, addr.province, addr.zip].filter(Boolean).join(", ")}</p>
                          {addr.country && <p style={{ color: "#7a6e64" }}>{addr.country}</p>}
                        </div>
                        {addr.default && (
                          <span className="text-[9px] tracking-[0.2em] uppercase px-2 py-1 border border-stone-300 flex-shrink-0" style={{ color: "#7a6e64" }}>
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Orders section ── */}
            <section>
              <div className="flex items-center gap-3 mb-8">
                <Package size={14} strokeWidth={1.5} style={{ color: "#7a6e64" }} />
                <h2 className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "#7a6e64" }}>Order History</h2>
              </div>

              {ordersLoading ? (
                <div className="flex items-center gap-2 py-4" style={{ color: "#7a6e64" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[11px] tracking-widest uppercase">Loading…</span>
                </div>
              ) : orders.length === 0 ? (
                <p className="text-sm font-light" style={{ color: "#7a6e64" }}>No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-stone-200 px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] tracking-[0.18em] uppercase font-medium" style={{ color: "#1e1814" }}>
                            #{order.orderNumber}
                          </p>
                          <p className="text-[11px] tracking-wide mt-1" style={{ color: "#7a6e64" }}>
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            className="text-[10px] tracking-[0.16em] uppercase px-2.5 py-1"
                            style={{
                              color: statusColor(order.financialStatus, order.fulfillmentStatus),
                              backgroundColor: statusColor(order.financialStatus, order.fulfillmentStatus) + "18",
                            }}
                          >
                            {statusLabel(order.financialStatus, order.fulfillmentStatus)}
                          </span>
                          <p className="text-sm font-light" style={{ color: "#1e1814" }}>
                            {parseFloat(order.totalPrice).toLocaleString("en-EG")} {order.currency}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Sign Out ── */}
            <section className="pt-4 border-t border-stone-200">
              <button
                onClick={() => { signOut(); closeAccount(); }}
                className="text-[11px] tracking-[0.22em] uppercase hover:opacity-50 transition-opacity"
                style={{ color: "#7a6e64" }}
              >
                Sign Out
              </button>
            </section>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
