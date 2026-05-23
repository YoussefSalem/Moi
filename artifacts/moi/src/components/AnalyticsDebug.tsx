import { useEffect, useState } from "react";

interface DebugEntry {
  time: string;
  type: "info" | "error" | "success";
  message: string;
}

const STORAGE_KEY = "moi_sa_debug_log";

function getLogs(): DebugEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DebugEntry[]) : [];
  } catch { return []; }
}

function pushLog(entry: DebugEntry): void {
  try {
    const logs = getLogs();
    logs.unshift(entry);
    if (logs.length > 20) logs.length = 20;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch { /* ignore */ }
}

/** Call from anywhere to add a debug entry visible on the mobile debug panel */
export function logAnalyticsDebug(message: string, type: DebugEntry["type"] = "info"): void {
  pushLog({ time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), type, message });
}

export function AnalyticsDebug() {
  const [logs, setLogs] = useState<DebugEntry[]>(getLogs);
  const [shopId, setShopId] = useState<string>("checking…");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [attr, setAttr] = useState<string>("");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(getLogs());
      try {
        const s = sessionStorage.getItem("moi_sa_session");
        setSessionToken(s ? s.slice(0, 20) + "…" : "none");
      } catch { setSessionToken("err"); }
      try {
        const a = sessionStorage.getItem("moi_ad_attribution");
        setAttr(a ? JSON.stringify(JSON.parse(a), null, 0).slice(0, 120) : "none");
      } catch { setAttr("err"); }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const STORE_DOMAIN = (import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string) || "";
        const STOREFRONT_TOKEN = (import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string) || "";
        if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
          setShopId("MISSING env vars");
          logAnalyticsDebug("Missing STORE_DOMAIN or TOKEN", "error");
          return;
        }
        const res = await fetch(`https://${STORE_DOMAIN}/api/2024-04/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
          },
          body: JSON.stringify({ query: "{ shop { id } }" }),
        });
        const json = (await res.json()) as { data?: { shop?: { id?: string } }; errors?: unknown[] };
        if (json.errors) {
          setShopId(`GraphQL error: ${JSON.stringify(json.errors).slice(0, 80)}`);
          logAnalyticsDebug(`shopId GraphQL error: ${JSON.stringify(json.errors)}`, "error");
        } else if (json.data?.shop?.id) {
          setShopId(json.data.shop.id);
          logAnalyticsDebug(`shopId OK: ${json.data.shop.id}`, "success");
        } else {
          setShopId("null response");
          logAnalyticsDebug("shopId returned null", "error");
        }
      } catch (err) {
        setShopId(`Fetch error: ${String(err).slice(0, 60)}`);
        logAnalyticsDebug(`shopId fetch error: ${String(err)}`, "error");
      }
    };
    check();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: collapsed ? 8 : 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 11,
        lineHeight: 1.4,
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "block",
          width: "100%",
          padding: "6px 12px",
          background: "#1e1814",
          color: "#faf8f5",
          border: "none",
          textAlign: "left",
          fontSize: 11,
          letterSpacing: "0.05em",
        }}
      >
        {collapsed ? "▲ Analytics Debug" : "▼ Analytics Debug"} — shopId: {shopId.slice(0, 30)}
        {shopId.length > 30 ? "…" : ""}
      </button>
      {!collapsed && (
        <div style={{ background: "rgba(30,24,20,0.96)", color: "#faf8f5", padding: 10, maxHeight: 280, overflow: "auto" }}>
          <div style={{ marginBottom: 8, opacity: 0.7 }}>
            Session: {sessionToken || "none"} | UTM/Ads: {attr || "none"}
          </div>
          {logs.length === 0 && <div style={{ opacity: 0.5 }}>No events yet. Navigate or refresh to trigger.</div>}
          {logs.map((l, i) => (
            <div key={i} style={{ marginBottom: 4, color: l.type === "error" ? "#ff8888" : l.type === "success" ? "#88ffaa" : "#ccc" }}>
              <span style={{ opacity: 0.5 }}>{l.time}</span> {l.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
