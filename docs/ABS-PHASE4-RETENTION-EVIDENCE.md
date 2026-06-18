# SAIL PMS — Record Retention & Disposition: Evidence Note (ABS Type Approval File)

**Subject:** Configurable record retention with controlled, reversible disposition (Audit Trail Phase 4)
**System:** SAIL PMS (Planned Maintenance System) — shore/office instance
**Branch / status:** `feature/audit-identity-phase0`, server-side verified; pending integrated test sign-off
**Date:** 2026-06-17

---

## 1. Records-management philosophy

The configured retention period is a **minimum keep-time, not an auto-delete timer.** The system **never automatically deletes business or audit records.** When a record passes its configured minimum it becomes **eligible for disposal review**; an authorised administrator makes a **logged disposition decision**. "Dispose" is a **reversible soft-dispose** (the record is marked and removed from active views, but the row is retained and can be restored via **Revert**). **No permanent physical deletion of business/audit records exists in the system**; a future physical purge would be a separate, manual, double-confirmed action operating only on already-disposed records (out of scope here). This satisfies the principle that retained records remain tamper-evident and recoverable, and that disposition is a deliberate, accountable, auditable act.

Only **sync-scratch infrastructure** (transient ship↔shore transfer logs) auto-prunes, and only after its configured period, honouring safety predicates (only synced / resolved / completed rows are ever removed).

## 2. Seeded retention categories and floors (committed defaults, Record Retention Procedure §6)

| Category | Default retention (minimum) | Protected | Hard floor | Auto-delete? |
|---|---|---|---|---|
| Maintenance Records | **5 years** | Yes | 5 years | No (disposition review only) |
| Approval Records | **5 years** | Yes | 5 years | No |
| Audit Logs (incl. component-register audit) | **2 years** | Yes | 2 years | No |
| User Access Logs | **12 months** | Yes | 12 months | No |
| Running Hours History | **Life of equipment (forever)** | Yes | — | No (never disposed) |
| Sync Logs (transient) | **12 months** | No (editable) | — | **Yes** (sync-scratch only) |

**Hard floor:** protected categories cannot be configured below their committed minimum — the server rejects any attempt, and the admin UI disables sub-floor input. Periods are administrator-configurable **above** the floor through the UI; defaults are pre-seeded to the committed values, not hardcoded.

## 3. Mapping to the ABS audit-trail / retention requirement

- **Defined retention periods, documented and enforced** → `retention_settings` table, seeded to the committed §6 values; floor-enforced.
- **No uncontrolled loss of records** → business/audit categories have **no automatic deletion path**; over-aggressive prior pruning (90-day sync field log) was lengthened, never shortened.
- **Controlled, accountable disposition** → human decision required; disposal is reversible (soft-dispose + Revert); records still within their minimum **cannot** be disposed (server-enforced).
- **Audit of the audit** → every retention-period change and every disposition decision (Dispose / Retain / Revert) is itself written to the audit log with the responsible person and timestamp, and is visible in the Audit Trail viewer.
- **Authorised access only** → retention administration is restricted (PMS/Sail Admin, shore-side).

## 4. Evidence pointers

| Evidence | Location |
|---|---|
| Migration — retention settings + disposition columns | `migrations/123_retention_settings_and_disposition.sql` (additive; seeds the 6 categories) |
| Retention policy store | DB table `retention_settings` (category, period, unit, enabled, is_protected, min_value/min_unit) |
| Disposition state (reversible) | columns `disposed_at` / `disposed_by_uuid` on `audit_log`, `component_maintenance_history`, `work_order_postponements` (row retained when disposed) |
| Server logic | `server/modules/retention/` — eligibility, hard-floor `updateSetting`, `dispose` / `retain` / `revert` |
| API (admin-only, shore) | `GET/PUT /admin/retention-settings`, `POST /admin/retention-settings/:category/{dispose,retain,revert}` (guard `requirePMSAdmin`) |
| Auto-prune (sync-scratch only) | `server/modules/sync/pruningService.ts` — reads the `sync_logs` setting; business categories have no delete path |
| Admin screen | **Admin → Retention Settings** — editable periods (floor-enforced), eligibility banner, Retain/Dispose/Revert with double-confirmation (type-to-confirm; states records are marked disposed and recoverable, not erased) |
| Audit entries (governance of changes) | `audit_log` rows `entity_type='retention_setting'` (period changes) and `entity_type='retention_disposition'` (dispose/retain/revert), each with frozen actor + timestamp; surfaced in **Admin → Audit Trail** (Permissions / Access filter) |

## 5. Verification performed (server-side, against live database)

Defaults seed to the committed values; the prune reads configured settings and **only** sync-scratch is deleted; **business tables survive a simulated prune** unchanged; records past their minimum raise the eligibility notification; **Dispose marks (does not erase)** and **Revert restores**; both decisions are audited and appear in the viewer; the hard floor rejects a sub-minimum value. Integrated functional verification on the test server is pending sign-off.

---
*Architecture & build detail: `docs/AUDIT-TRAIL-ARCHITECTURE-AND-PLAN.md`.*
