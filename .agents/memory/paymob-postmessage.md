---
name: Paymob postMessage format
description: Paymob legacy v1 iframe sends postMessage as a JSON string, not an object. Must handle both formats and distinguish 3DS intermediate from final results.
---

Paymob's legacy v1 iframe calls `window.parent.postMessage(JSON.stringify(data), "*")` — the payload is a JSON *string*, not a JS object. Our message handler was doing `typeof data !== "object"` and returning early, silently discarding all Paymob postMessages.

**Why:** Paymob's own docs/examples use string serialization for cross-origin safety. Our assumption that it would be an object was wrong.

**How to apply:** In any `window.addEventListener("message", ...)` handler, parse both forms:

```ts
let data: Record<string, unknown> | null = null;
if (event.data && typeof event.data === "object" && !Array.isArray(event.data)) {
  data = event.data as Record<string, unknown>;
} else if (typeof event.data === "string") {
  try {
    const parsed: unknown = JSON.parse(event.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch { return; }
}
if (!data) return;
```

**3DS intermediate vs final result:** Paymob sends TWO types of messages:

1. **Intermediate (3DS pending)**: `pending: "true"`, `success: "false"`, has txnId, `data.message: "Pending 3DS Authorization"`. The iframe is about to redirect to the bank's 3DS page. Show a TEMPORARY overlay (covers the raw JSON), then auto-hide it on the next iframe load event so the user can complete 3DS.

2. **Final failure**: `pending: "false"`, `success: "false"`, has txnId. Show the permanent fail overlay.

**NEVER** use `loadCount >= 2` to auto-show overlay — it fires on 3DS pages and blocks user authentication.

**tempOverlayRef pattern:**
- `tempOverlayRef.current = true` → `showOverlay()` when `pending: "true"` message arrives
- In `handleIframeLoad`: if `tempOverlayRef.current`, clear it and hide the overlay
