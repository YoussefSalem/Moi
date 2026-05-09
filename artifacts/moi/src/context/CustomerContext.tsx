import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const TOKEN_KEY = "moi_customer_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Customer {
  shopifyId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface CustomerContextValue {
  customer: Customer | null;
  loading: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  sendOtp: (email: string) => Promise<string | null>;
  verifyOtp: (email: string, code: string) => Promise<string | null>;
  signOut: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const initRef = useRef(false);

  // Restore session on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetch(`${BASE}/api/auth/customer/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { customer: Customer } | null) => {
        if (data?.customer) setCustomer(data.customer);
        else localStorage.removeItem(TOKEN_KEY);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY));
  }, []);

  const sendOtp = useCallback(async (email: string): Promise<string | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/customer/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) return data.error ?? "Failed to send code.";
      return null;
    } catch {
      return "Network error. Please try again.";
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string): Promise<string | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/customer/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as { token?: string; customer?: Customer; error?: string };
      if (!res.ok) return data.error ?? "Verification failed.";
      if (data.token && data.customer) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setCustomer(data.customer);
        setAuthOpen(false);
      }
      return null;
    } catch {
      return "Network error. Please try again.";
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setCustomer(null);
  }, []);

  return (
    <CustomerContext.Provider
      value={{
        customer,
        loading,
        authOpen,
        openAuth: () => setAuthOpen(true),
        closeAuth: () => setAuthOpen(false),
        sendOtp,
        verifyOtp,
        signOut,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}
