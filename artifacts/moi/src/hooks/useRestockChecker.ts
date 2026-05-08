import { useEffect } from "react";

const STORAGE_KEY = "moi_restock_last_check";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function useRestockChecker() {
  useEffect(() => {
    const lastCheck = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    if (lastCheck && now - parseInt(lastCheck, 10) < CHECK_INTERVAL_MS) return;

    // Fire-and-forget: silently check if any subscribed products are back in stock
    fetch("/api/restock/check-and-notify", { method: "POST" })
      .then(() => localStorage.setItem(STORAGE_KEY, String(now)))
      .catch(() => {});
  }, []);
}
