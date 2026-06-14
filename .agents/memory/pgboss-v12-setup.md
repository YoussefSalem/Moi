---
name: pg-boss v12 setup quirks
description: How to correctly import and initialize pg-boss v12 in the API server — traps that wasted time.
---

## Rules

1. **Named export only** — `import { PgBoss } from "pg-boss"`. Default import does not exist in v12.
2. **`Job<T>` is a separate type** — `import type { Job } from "pg-boss"`. Cannot write `PgBoss.Job<T>` because `PgBoss` is a class, not a namespace.
3. **`createQueue()` before `work()`** — pg-boss v12 throws "Queue X does not exist" if you call `boss.work(name, handler)` on a queue that hasn't been created first. Call `boss.createQueue(JOB_NAME)` (and `createQueue(DLQ_NAME)`) right after `boss.start()`.
4. **Constructor option names differ from older docs** — `monitorStateIntervalMinutes` does NOT exist. Use `monitorIntervalSeconds` (from `MaintenanceOptions`). `deleteAfterHours` and `archiveCompletedAfterSeconds` also don't exist in v12's `ConstructorOptions`.
5. **`singletonKey`** in `SendOptions` is the v12 idempotency key (replaces the old `sendOnce` / singleton pattern).

**Why:** pg-boss v12 is a major API rewrite from v8/v9. Documentation found online often refers to older versions.

**How to apply:** Any time pg-boss is added or updated in the api-server, verify these points against the installed package's `dist/index.d.ts`.
