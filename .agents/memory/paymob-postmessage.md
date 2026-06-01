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

1. **Intermediate (3DS pending)**: `pending: "true"`, `success: "false"`, has txnId, `data.message: "Pending 3DS Authorization"`, `use_redirection: true`, `bypass_step_six: true`, contains `redirection_url`.

2. **Final failure**: `pending: "false"`, `success: "false"`, has txnId. Show the permanent fail overlay.

**CRITICAL — `use_redirection: true` / `bypass_step_six: true`:** When Paymob sets these flags it renders the JSON and **stops**. It does NOT navigate the iframe to the 3DS page automatically — the parent window must redirect `iframeRef.current.src = data.redirection_url`. If the parent never does this, the raw JSON stays visible forever. Always check for `redirection_url` in the pending postMessage and do the redirect from the parent.

**NEVER** use `loadCount >= 2` to auto-show overlay — it fires on 3DS pages and blocks user authentication.

**Correct pending flow (parent side):**
1. Receive `pending: "true"` postMessage → `showOverlay()` + `tempOverlayRef.current = true` + `iframeRef.current.src = redirectionUrl`
2. `handleIframeLoad` fires when 3DS bank page loads → clear `tempOverlayRef` + hide overlay → user completes authentication
3. After authentication → relay page postMessage (`PAYMOB_RESULT`) → show permanent success/fail overlay
