# Audit Trail — Architecture & Plan

**Status:** Phases 0–4 built & server-side verified on isolated branch `feature/audit-identity-phase0` (NOT merged). All planned phases complete; only manual physical purge + legal-hold left as deliberate future scope.
**Last updated:** 2026-06-17
**Owner branch:** `feature/audit-identity-phase0` (off `replit_dev` @ `02c1081dd`; merged personally after integrated-SAILERP verification).
**Push state:** Phase 0 (incl. this doc's first version) pushed to origin; Phases 1/2/3 committed locally, **not yet pushed**.
**Related:** ABS sample audit-trail report (investigation source), `CLAUDE.md` (sync-layer rules), memory `project_audit_trail_plan` + `project_audit_identity_phase0_build`.

---

## 1. Purpose & Background

The ABS-style audit trail requires that every meaningful change to maintenance data records **who** did it, **when**, **what changed** (old → new), and that the recorded actor is **frozen at write time** — it must survive crew changes and never be resolved live from the users table.

PMS does not run its own authentication; identity comes from the SAILERP shell. So the work is to thread the **real, two-tier SAILERP identity** onto audit records, populate the silent streams, and surface a clean business audit viewer — without rebuilding auth and without touching the sync layer.

### Two-tier identity rule (LOCKED)
| User type | Accountable identity (frozen label) | Canonical id |
|---|---|---|
| **Office** (email login) | person **full name** (+ email) | `userUuid` |
| **Ship** (rank login) | **rank_name** (e.g. "Chief Engineer") | `userUuid` |

`actorId` (canonical token) is always `userUuid`, fallback `email → rank → 'system'`. The frozen **display label** is the person name (Office) or rank (Ship). Machine/background writes use `'system'` or `'auto-generation'`.

### Actor vs Subject
For object changes (component, WO, RH) the actor is *who acted* and the object is *what changed*. For **user-access** events there are two identities: the **actor** (admin who made the change) and the **subject** (the ROLE/RANK affected — PMS RBAC is role-based, there is no per-user access state). Both are recorded.

---

## 2. Storage model — audit streams

| Stream | Table | Grain | Sync category | Written by | In the viewer? |
|---|---|---|---|---|---|
| Action-level audit | `audit_log` | one row per business action | **NO_SYNC** | `createAuditLog` (Phases 1–3 + WO/job actions) | ✅ core |
| Running-hours audit | `running_hours_audit` | one row per RH change (incl. cascade) | **BOTH_EDITABLE** (syncs) | storage RH inserts + `actor_label` | ✅ |
| WO postponements | `work_order_postponements` | one row per postponement | **BOTH_EDITABLE** | postpone services | ✅ |
| Field-level audit | `sync_field_log` | one row per changed field (old→new), `changed_by_display` | **NO_SYNC** | `logFieldChanges`/`Batch` | ❌ **excluded** (sync mechanism, not a business record — internal row UUIDs/raw values) |

**Frozen-identity columns (Phase 0, additive migrations):**
| Column | Table | Migration | Holds |
|---|---|---|---|
| `changed_by_display` | `sync_field_log` | **121** | frozen human label (Office name / Ship rank) |
| `actor_label` | `running_hours_audit` | **122** | frozen human label |
| `payload.actorLabel/actorEmail/actorType/actorRole` | `audit_log` | — | frozen identity merged into JSON payload |

Both columns `text`, nullable, idempotent (`ADD COLUMN IF NOT EXISTS`). `audit_log.payload` is **`json`** (not `jsonb`) → use `json_array_length`/`->`/`->>`.

---

## 3. Phase 0 — Identity threading (request path)

```
SAILERP login → AuthContext.currentUser (userUuid, fullName, email, userType, rank_name, role)
  → client/src/lib/activeRank.ts (window.fetch interceptor) injects on every /technical/api call:
      x-user-id, x-user-name, x-user-email, x-user-type, x-user-role  (+ existing x-rank), URI-encoded
  → server/middleware/auth.ts (mockAuthMiddleware) reads x-user-* over the mock for IDENTITY only.
      ⚠ RBAC unchanged: req.user.role STAYS mock; real role stashed as forwardedRole (audit only).
  → server/middleware/auditActor.ts (resolveAuditActor) builds the frozen AuditActor per the two-tier rule.
  → server/middleware/requestContext.ts (AsyncLocalStorage) carries it; getAuditActor() exposes it.
  → audit sinks: logFieldChanges / createAuditLog / running_hours_audit inserts inherit the actor.
```

**Actor-precedence contract (fix `4ce07c2fb`):** when a request context exists, the **context actor is authoritative** for the audit-identity columns (`changed_by_user_id`/`changed_by_display`, `audit_log.user_id`), *regardless* of any name/rank a controller injected into `body.userId`/`performedBy` for its own operational use. With **no** request context (scanner/cron) the explicit token is preserved (`'auto-generation'`/`'system'`). The fix lives only inside the two audit sinks — **operational columns are never touched**. Sync apply re-inserts `sync_field_log` via raw SQL (preserves the wire actor) and is unaffected.

Also: `sync/service.ts` conflict-notification gate excludes both machine actors `{'system','auto-generation'}`.

---

## 4. Phase 1 — Equipment/Component register audit

`entity_type='component'`, via `createAuditLog` (actor auto-frozen), best-effort `try/catch`, operational columns untouched.

| Change | action_type | source | payload |
|---|---|---|---|
| Create | `create` | `web_ui` | snapshot |
| Field edit (rename / criticality=`critical` / etc.) | `update` | `web_ui` | `changedFields` old→new |
| Activate / Deactivate | `activate`/`deactivate` | `web_ui` | `isActive {old,new}` |
| Reparent | `reparent` | `web_ui` | `parentId {old,new}` (old parent captured before the UPDATE) |
| Bulk create/update (+ auto-parents, archive-missing→deactivate) | `create`/`update`/`deactivate` | `bulk_import` | snapshot / `changedFields` |
| Bulk import summary | `bulk_import` | `bulk_import` | `{importHistoryId, created, updated, total}` |
| Bulk undo (per-component + summary) | mapped + `bulk_undo` | `bulk_import` | `{via:'undo', …}` |

**Delete verdict (settled with Jeevan):** the register "Delete" = **deactivate** (`is_active=false`, record retained, syncs to ship via the one-way applier). The two `DELETE` routes (`DELETE /components/:id`, `DELETE /fleet/components/:id` → `storage.deleteComponent` hard delete) are **registered but UI-unreachable** (the fleet-admin UI uses a soft-delete endpoint). **Soft-delete conversion was DROPPED** — the model already retains-and-deactivates. Per-component bulk rows are tagged `source='bulk_import'` so the UI can filter them from the default per-component view but surface them on drill-in (ABS founding-state requirement).

---

## 5. Phase 2 — User-access audit

**Scope verdict:** user accounts + passwords are **SAILERP's domain** (`users` table `NO_SYNC`, "managed by SAILERP, provisioned separately"; `createUser`/`updateUser`/`deleteUser` are dead; no user-CRUD/password endpoints in PMS). Account/login auditing is **deferred to SAILERP**. The PMS-local mutable access state instrumented:

| Path | entity_type / action_type | subject | payload |
|---|---|---|---|
| `PUT /admin/access-control/:roleRuid` (pre-read grants → save → audit) | `role_permission` / `permission_change` | `{roleRuid, roleName}` | full `before[]` + `after[]` + `changedMenus` diff |
| `saveRanks`(per-rank)/`updateRank`/`deleteRank` (ranks service) | `rank` / `rank_create`·`rank_update`·`rank_delete` | `{rankId, rankName}` | `before`/`after` on update & delete |

Org-chart edits deferred to a future **approval-audit** phase (avoid double-scoping). No secrets exist in PMS and none are ever written.

---

## 6. Phase 3 — Unified business audit viewer + Excel

Admin **"Audit Trail"** screen (shore, Sail-Admin), `requirePMSAdmin`, **strictly read-only**. Unifies the three clean sources into one normalized table; `sync_field_log` excluded.

**WO-create gap closed:** `createWorkOrder` (manual → `source:'web_ui'`) and `workOrderAutoService` ×2 (system → `source:'auto-generation'`) now write a clean `audit_log` `create` row, so WO appearance is auditable whether a person or the scanner created it. (No separate "close" action exists — WO lifecycle is terminal at Completed.)

**Common row shape:** When (UTC) · Who (frozen actor) · Action · Entity (type + friendly ref) · Old→New · Log type · Remarks/status.

**Source → shape mapping:** `audit_log` (work_order→Work Orders via `payload.workOrderNo`; component→Components; role_permission/rank→Permissions); `running_hours_audit`→Running Hours (`actor_label`, `previous_rh`→`new_rh`, `component_name`); `work_order_postponements`→Postponements (LEFT JOIN `work_orders` for WO no; who = submitter on request / approver on decision; `original_due_date`→`new_due_date`).

**API (read-only):** `getAuditLogs` extended (+`userId`, `source`, `entityTypes[]`, free-text `actor` label-or-id ILIKE, `entityCode` code/id/WO-no ILIKE) + new `countAuditLogs` (both added to `IStorage`). `audit_log` is already indexed (timestamp/user_id/entity_*/action) — **no new index**. `server/modules/audit/`: service merges per-source top-`(offset+limit)` + counts → sort `when` desc → paginate (`total = Σ counts`); RH + postponements via read-only raw SQL. Routes `GET /admin/audit-trail` + `POST/GET …/excel`. Excel (ExcelJS + `excelReportStyles`): one row/record, flattened "Changes" cell, UTC header, 10k cap + refine note.

**Log-type filter → sources:** All→3 tables; Work Orders/Components/Permissions-Access→`audit_log[entity_type]`; Running Hours→`running_hours_audit`; Postponements→`work_order_postponements`.

**Frontend:** `client/src/pages/admin/AuditTrail.tsx` (shadcn Select/Table/Input/Badge/Button, mirrors AccessControl), filter bar + paginated table + row-expand detail + Export-Excel; nav `SideMenuBar.tsx` "Audit Trail" (isSailAdmin-gated) + `TechnicalModule.tsx` dispatch.

---

## 6b. Phase 4 — Configurable retention + disposition lifecycle

**Model:** the configured period is a **minimum keep-time, not an auto-delete timer**. Business/audit records are **never auto-deleted**. Disposal is a **human, logged, reversible soft-dispose** (`disposed_at`/`disposed_by_uuid`, row kept). No physical deletion of business records anywhere — manual physical purge is deliberately **out of scope** (design left open for it; the `disposed_at` flag is the future purge eligibility list). Legal-hold left as a future concept (not built).

**Migration 123 (additive, idempotent):** `retention_settings` (category, value, unit, enabled, is_protected, min_value/min_unit) seeded with the committed §6 defaults; + nullable `disposed_at`/`disposed_by_uuid` on `audit_log`, `component_maintenance_history`, `work_order_postponements`.

| Category | Default | Protected / floor | Disposition flow | Targets |
|---|---|---|---|---|
| Maintenance Records | 5 years | ✓ / 5y | yes | `audit_log[work_order]` + `component_maintenance_history` |
| Approval Records | 5 years | ✓ / 5y | yes | `work_order_postponements` |
| Audit Logs | 2 years | ✓ / 2y | yes | `audit_log[component + general]` |
| User Access Logs | 12 months | ✓ / 12m | yes | `audit_log[role_permission, rank, retention_setting, retention_disposition]` |
| Running Hours History | forever | ✓ / — | none (never disposed) | `running_hours_audit` |
| Sync Logs | 12 months | ✗ (editable) | **auto-prune only** | `sync_field_log`+`batches`+`file_queue`+`conflicts` |

**Behaviour:** `server/modules/retention/` (guard `requirePMSAdmin`): eligibility = count past minimum AND `disposed_at IS NULL`; `updateSetting` enforces a **hard floor** (protected categories reject below committed min, 400); `dispose` soft-marks **only past-minimum rows**; `retain`/`revert` log/restore — all audited (`entity_type` `retention_setting`/`retention_disposition`, frozen actor). `pruningService` reads the `sync_logs` setting (12mo → 365d via month factor 30.44, never shorter than the prior 90/90/180/365) and is the **only** auto-delete path; business categories have no auto-delete. The viewer adds `disposed_at IS NULL` (disposed rows leave active views) and maps the new entity types into Permissions/Access. Frontend `RetentionSettings.tsx` (Admin, Sail-Admin): floor-enforced period edit, eligibility banner, Retain/Dispose/Revert with a **double-confirm** dialog (Cancel default + type-to-confirm "DISPOSE", states marked-not-erased).

---

## 7. Commit list (branch `feature/audit-identity-phase0`)

| Commit | Phase |
|---|---|
| `0d52f948c` | P0 freeze storage — migrations 121/122 + schema cols |
| `c569580d7` | P0 server identity threading |
| `4ed7f5332` | P0 client identity forwarding |
| `4ce07c2fb` | P0 fix — request-context actor authoritative for audit-identity columns |
| `b9cee9eb2` | P0 this doc (initial) — *(origin HEAD)* |
| `f7ba28619` | P1 component register audit |
| `3fb4e3dca` | P2 user-access audit |
| `bc2eafc7b` | P3 unified viewer + Excel |
| `0c8aa21ce` | docs update (P1–3) |
| `6b6095cbf` | P4 configurable retention + disposition |

Migrations: **121** (`sync_field_log.changed_by_display`), **122** (`running_hours_audit.actor_label`), **123** (`retention_settings` + `disposed_at`/`disposed_by_uuid`) — additive, nullable, idempotent. tsc held **366** throughout.

---

## 8. Verification status

**Proven server-side (real DB):**
- P0: Office/Ship/no-headers/auto-generation — correct frozen actor + uuid in every audit-identity column; operational columns unchanged; machine writes tagged.
- P1: create/update(old→new)/reparent/activate/deactivate (`web_ui`) + bulk import (batch + tagged per-component rows, frozen uploader).
- P2: `permission_change` (actor + subject role + before/after + diff), `rank_update` (actor + subject + before/after).
- P3: unified rows from all three sources, log-type scoping, **WO-create row appearing**, postpone request (Due old→new), valid `.xlsx`.

**Needs Nilesh (integrated SAILERP):**
- The real SAILERP client actually emits `x-user-*` on a genuine login (the only standalone-unverifiable link; everything downstream is DB-proven).
- P3 browser click-through (login as Sail Admin → `/admin/audit-trail`); verified at API level + tsc.
- P2 `rank_create`/`rank_delete` and P1 bulk_update/bulk_undo per-component (code-complete, structurally identical to verified paths).

---

## 9. Invariants (for anyone extending this)
1. Audit identity is **frozen at write time** — never resolve the actor live from `users`.
2. **Context actor is authoritative** for audit-identity columns when a request context exists; explicit token only when there is none (machine/cron).
3. Never write audit logic that mutates **operational** columns; never route operational writes through `logFieldChanges`/`createAuditLog`.
4. **RBAC stays independent** — `req.user.role` is mock in this work; real role is `forwardedRole` (audit only); the frontend reads the real role.
5. **Additive migrations only** for audit columns; do not touch sync infrastructure or categories.
6. `audit_log` / `sync_field_log` are **NO_SYNC** — action/field audit does not travel ship↔shore.
7. The viewer is **strictly read-only** — it never mutates any audit table. `sync_field_log` is excluded by design.
8. `audit_log.payload` is `json` (not `jsonb`); avoid Map/Set iteration in TS (`TS2802`, no `downlevelIteration`).

---

## 10. Pending / deferred
- **Manual physical purge (future):** a separate, manual, double-confirmed admin action that erases **only already-disposed** rows — never automatic, never on a timer. The `disposed_at` flag is the eligibility list; not built.
- **Legal hold (future concept):** keep the design open; not built.
- **Phase 3.1 (deferred):** `sync_field_log` union in the viewer if ABS later wants field-level WO-edit granularity.
- **Approval-audit phase:** org-chart (`saveOrgChart`/`updateOrgChartEntry`/`deleteOrgChartEntry`) + approval routing.
- **DB-view union:** documented fallback for the viewer only if merge-pagination performance ever demands it.

### Cleanup flags (separate — not actioned in this work)
- `PUT /admin/access-control/:roleRuid` has **no `requireRole` guard** (anyone authenticated can rewrite a role's permissions) — recommend gating.
- Two **orphaned hard-delete routes** (`DELETE /components/:id`, `DELETE /fleet/components/:id`) bypass the retain-and-deactivate model — recommend gating/removing.
