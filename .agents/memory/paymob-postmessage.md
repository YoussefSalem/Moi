---
name: Paymob postMessage format
description: Paymob legacy v1 iframe sends postMessage as a JSON string, not an object — must handle both formats.
---

Paymob's legacy v1 iframe calls `window.parent.postMessage(JSON.stringify(data), "*")` — the payload is a JSON *string*, not a JS object. Our message handler was doing `typeof data !== "object"` and returning early, silently discarding all Paymob postMessages.

**Why:** Paymob's own docs/examples use string serialization for cross-origin safety. Our assumption that it would be an object was wrong.

**How to apply:** In any `window.addEventListener("message", ...)` handler that needs to process Paymob messages, parse both forms:

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

Also: for the "fail" case, check `pending === false` as an alternative to `hasTxnId` — some Paymob error types (e.g. "Invalid credentials") send `pending: "false"` without a transaction ID in their postMessage.
