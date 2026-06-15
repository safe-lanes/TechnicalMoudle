# Audit Trail — Architecture & Plan

**Status:** Phase 0 (Identity Threading) built, server-side verified, pushed (isolated branch `feature/audit-identity-phase0`, NOT merged). Phases 1–4 pending.
**Last updated:** 2026-06-15
**Owner branch:** `feature/audit-identity-phase0` (off `replit_dev` @ `02c1081dd`; merged personally after integrated-SAILERP verification)
**Related:** ABS sample audit-trail report (investigation source), `CLAUDE.md` (sync layer rules), memory `project_audit_identity_phase0_build`.

---

## 1. Purpose & Background

The ABS-style audit trail requires that every meaningful change to maintenance data records **who** did it, **when**, **what changed** (old → new), and that the recorded actor is **frozen at write time** (it must survive crew changes and must never be resolved live from the users table).

Before this work, the system fabricated a single mock actor ("Sail Administrator" / "Chief Engineer") for all writes, because PMS does not run its own authentication — identity comes from the SAILERP shell. The goal of Phase 0 was to thread the **real, two-tier SAILERP identity** onto audit records, without rebuilding auth and without touching the sync layer.

### Two-tier identity rule (LOCKED)
| User type | Accountable identity (frozen label) | Canonical id |
|---|---|---|
| **Office** (email login) | person **full name** (+ email) | `userUuid` |
| **Ship** (rank login) | **rank_name** (e.g. "Chief Engineer") | `userUuid` |

`actorId` (canonical token) is always `userUuid`, with fallback `email → rank → 'system'`. The frozen **display label** is the person name (Office) or rank (Ship). Machine/background writes use `'system'` or `'auto-generation'`.

---

## 2. Storage model — the three audit streams

| Stream | Table | Grain | Sync category | Written by |
|---|---|---|---|---|
| **Field-level audit** | `sync_field_log` | one row per changed field (old→new) | **NO_SYNC** (local) | `logFieldChanges` / `logFieldChangesBatch` (gated by `requiresFieldLogging` = BOTH_EDITABLE tables) |
| **Action-level audit** | `audit_log` | one row per business action | **NO_SYNC** (local) | `createAuditLog` (manual calls — WO/job/CR actions) |
| **Running-hours audit** | `running_hours_audit` | one row per RH change (incl. cascade) | **BOTH_EDITABLE** (syncs) | storage RH insert sites + field-logged |

Key facts:
- `audit_log` and `sync_field_log` are **NO_SYNC** — action/field audit stays on the instance where it happened; it does **not** travel ship↔shore.
- `running_hours_audit`, `component_maintenance_history`, `work_order_postponements`, `superintendent_notifications` are **BOTH_EDITABLE** (bidirectional sync, field-logged).
- `components`, `jobs` are **ONE_WAY_SHORE_TO_SHIP**. `users` is **NO_SYNC**.

### Frozen-identity columns (added in Phase 0 — additive only)
| Column | Table | Migration | Holds |
|---|---|---|---|
| `changed_by_display` | `sync_field_log` | **121** | frozen human label (Office name / Ship rank) |
| `actor_label` | `running_hours_audit` | **122** | frozen human label |
| (payload `actorLabel/actorEmail/actorType/actorRole`) | `audit_log.payload` | — | frozen identity, merged into JSON payload |

Both columns are `text`, nullable, idempotent (`ADD COLUMN IF NOT EXISTS`); production schema is untouched until the branch deploys.

---

## 3. Identity threading — the request path (built in Phase 0)

```
SAILERP login → AuthContext.currentUser (userUuid, fullName, email, userType, rank_name, role)
   │
   ├─ client/src/lib/activeRank.ts  (global window.fetch interceptor)
   │     injects on every /technical/api call:
   │       x-user-id (userUuid), x-user-name (fullName), x-user-email,
   │       x-user-type (Office|Ship), x-user-role, and existing x-rank
   │     (URI-encoded; never overwrites caller-set headers; no longer skips when rank is null)
   ▼
server/middleware/auth.ts  (mockAuthMiddleware)
   reads x-user-* over the mock for IDENTITY fields only.
   ⚠ RBAC unchanged: req.user.role STAYS the mock; the real role is stashed as forwardedRole
     (audit attribution only — never consulted by requireRole).
   ▼
server/middleware/auditActor.ts  (resolveAuditActor)
   builds the frozen AuditActor {actorId, actorLabel, actorEmail, actorType, actorRank, actorRole}
   per the two-tier rule. SYSTEM_ACTOR when no user.
   ▼
server/middleware/requestContext.ts  (AsyncLocalStorage)
   carries the full frozen actor for the whole request; exposes getAuditActor().
   ▼
audit sinks (deep in the stack, no param threading):
   • fieldLogger.logFieldChanges / logFieldChangesBatch → sync_field_log
   • postgresStorage.createAuditLog                     → audit_log
   • running_hours_audit insert sites                   → actor_label
```

### Actor precedence (the critical contract — set by the Phase 0 fix)
- **A request context exists** → the **context actor is authoritative** for the audit-identity columns:
  `changed_by_user_id = actorId (uuid)`, `changed_by_display = actorLabel`, `audit_log.user_id = actorId`.
  This holds **even when a controller injects a name/rank into `body.userId`/`performedBy`** for its own operational use.
- **No request context** (ship `jobDueScanner` timer, cron, startup) → the **explicit token is preserved** (`'auto-generation'`, `'system'`).

**Why the precedence matters (the bug the fix resolved):** `workOrderController.resolveActorIdentity` picks `rank_name` first and injects it into `body.userId`/`performedBy`; `runningHoursController.resolveUserId` injects `fullName`. The initial Phase 0 build "preferred the explicit caller userId", so these injected names/ranks landed in the audit columns (an Office user was logged as the default rank "Chief Engineer"). The fix makes the context actor authoritative for audit identity only.

### Operational columns are NOT touched
The injected `body.userId/performedBy/approver/userUuid` also feed **real operational columns** — `work_orders.performed_by`, `work_orders.approver`/`postpone_approver`, `work_order_postponements.approver/authorized_by/approved_by`, `running_hours_audit.user_id`/`updated_by_uuid`, the inventory ledger, location created-by. These are written **directly by the service via repo/storage calls**, never through `logFieldChanges`/`createAuditLog`. The Phase 0 fix lives only in those two audit sinks, so every operational column is left exactly as before. (Sync apply re-inserts `sync_field_log` via raw SQL preserving the wire actor → unaffected.)

---

## 4. Conflict-notification gate (Phase 0)
`server/modules/sync/service.ts` (~line 356): sync-conflict notifications now exclude **both** machine actors `{'system', 'auto-generation'}` (previously only `'system'`), so a rejected machine write never queues a notification with no real recipient.

---

## 5. What is IMPLEMENTED (Phase 0) — commits

Branch `feature/audit-identity-phase0` (pushed to origin, isolated, not merged):

| Commit | Summary |
|---|---|
| `0d52f948c` | freeze storage — migrations 121/122 + Drizzle columns |
| `c569580d7` | server identity threading (auditActor, requestContext, auth, fieldLogger, createAuditLog, RH actor_label, service.ts gate) |
| `4ed7f5332` | client identity forwarding (activeRank interceptor + AuthContext) |
| `4ce07c2fb` | fix — request-context actor authoritative for audit-identity columns |

tsc held baseline **366** throughout. No controller changes; no sync-infrastructure changes; additive migrations only.

### Server-side verification (real DB, real HTTP with simulated `x-user-*` headers) — ALL PASS
| Scenario | `sync_field_log` id / display | `audit_log` user_id / actorLabel | Operational |
|---|---|---|---|
| Office (uuid, name "Rsms Admin", no rank) | uuid / **"Rsms Admin"** | uuid / **"Rsms Admin"** | `performed_by` unchanged |
| Ship (uuid, rank "Chief Engineer", name "Joe Bloggs") | uuid / **"Chief Engineer"** | uuid / **"Chief Engineer"** (Ship) | `running_hours_audit.actor_label`="Chief Engineer"; `user_id`="Joe Bloggs" unchanged |
| No headers (standalone) | mock uuid / "Sail Administrator" — no crash | mock uuid / "Sail Administrator" | — |
| Auto-generation (no request context) | "auto-generation" / "auto-generation" | n/a | `service.ts:356` gate suppresses |

---

## 6. What is PENDING

### Before merge (Nilesh — integrated SAILERP)
- **Confirm the real SAILERP client actually emits the `x-user-*` headers** on a genuine login. This is the ONLY part unverifiable in standalone (empty localStorage → mock-only path). Everything downstream of the headers is proven against the real DB.
- Spot-check that `changed_by_display` / `actor_label` / `audit_log.payload` carry the real person's name (Office) / rank (Ship) after a real login, and that RBAC is visibly unaffected (frontend reads the real role independently).

### Future phases (designed scope, NOT built)
| Phase | Scope | Notes |
|---|---|---|
| **Phase 1** | Component-register audit | `updateComponent`/`deleteComponent`/`inactivateComponent` write paths. Shore-mastered (`components` = ONE_WAY_SHORE_TO_SHIP). |
| **Phase 2** | User-access audit | login/logout, permission changes. Needs decision on store + whether real auth lands first. |
| **Phase 3** | Query & export | Excel export of the audit trail (ABS report format). |
| **Phase 4** | Retention | retention/pruning policy for audit streams. |

### Known dependencies / open questions
- **Operational `performed_by` for Office users** currently inherits the controller-injected `rank_name` (default "Chief Engineer" when no `x-rank`). This is **pre-existing** controller behavior, intentionally **out of scope** for Phase 0 (operational columns untouched). If the business wants `performed_by` to be the office person, that is a separate controller change to scope deliberately.
- `running_hours_audit.user_id` keeps the controller-injected name (operational attribution); the **new** `actor_label` is the frozen audit display. They are intentionally distinct.
- Real authentication + a real user→rank→vessel binding is still absent (`req.user` is the mock; rank comes from `x-rank`). Phase 0 records "what identity SAILERP sends," not "verified who the user is."

---

## 7. Invariants to preserve (for anyone extending this)
1. **Audit identity is frozen at write time** — never resolve the actor live from `users`.
2. **Context actor is authoritative for audit-identity columns** when a request context exists; explicit token only when there is none (machine/cron).
3. **Never write audit logic that mutates operational columns**, and never route operational writes through `logFieldChanges`/`createAuditLog`.
4. **RBAC stays independent** — `req.user.role` is mock in Phase 0; the real role is `forwardedRole` (audit only). The frontend reads the real role.
5. **Additive migrations only** for audit columns; do not touch sync infrastructure or categories.
6. **`audit_log` / `sync_field_log` are NO_SYNC** — do not assume action/field audit travels between ship and shore.
