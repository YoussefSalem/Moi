import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  customerAccessTokenCreate,
  customerCreate,
  getCustomer,
  SHOPIFY_CONFIGURED,
} from "@/lib/shopify";

const TOKEN_KEY = "moi_customer_token";

interface Customer {
  id: string;
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
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<string | null>;
  signOut: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || !SHOPIFY_CONFIGURED) return;
    initRef.current = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      getCustomer(token)
        .then((c) => { if (c) setCustomer(c); else localStorage.removeItem(TOKEN_KEY); })
        .catch(() => localStorage.removeItem(TOKEN_KEY));
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!SHOPIFY_CONFIGURED) return "Shopify not configured";
    setLoading(true);
    try {
      const result = await customerAccessTokenCreate(email, password);
      if ("error" in result) return result.error;
      localStorage.setItem(TOKEN_KEY, result.accessToken);
      const c = await getCustomer(result.accessToken);
      if (c) setCustomer(c);
      setAuthOpen(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName?: string, lastName?: string): Promise<string | null> => {
    if (!SHOPIFY_CONFIGURED) return "Shopify not configured";
    setLoading(true);
    try {
      const result = await customerCreate(email, password, firstName, lastName, true);
      if ("error" in result) return result.error;
      return await signIn(email, password);
    } finally {
      setLoading(false);
    }
  }, [signIn]);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setCustomer(null);
  }, []);

  return (
    <CustomerContext.Provider value={{
      customer,
      loading,
      authOpen,
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}
