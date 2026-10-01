# Application behaviour behind the four chatbot cases

**Where checked:**
- **Test shore:** `:5077`, running approval-branch code. The files for these four cases are identical to `replit_dev`.
- **Database:** `pms_ae_test`, a copy of the local `pms` database (vessel `743ef9d1…`).
- **When:** 30 Sep and 1 Oct 2026.
- **Probes:** throwaway, untracked: `local-test-env/verify-kb-*.cjs`.
- **Restored:** every row a probe changed was put back afterwards.

**Identity on the test shore:**
- `req.user.role` is always the mock `Sail Admin` (`server/middleware/auth.ts:244`). This is a known gap.
- The forwarded role (`x-user-role: Vessel User`) only reaches `req.rbac`.
- So "a request forwarding Vessel User could…" is **PROVEN for such a request only**. It says nothing about a server where
  the mock has been replaced.

**Evidence classes:**
- **PROVEN** — run on the test shore, output kept.
- **READ** — from the code, not run.

This document keeps three things apart:
- **intended rules**: what the code or screen is meant to do;
- **observed behaviour**: what actually happened on the test shore;
- **application defects**: logged for development, not fixed here (`DEFECTS-FOR-DEVELOPMENT.md`).

## 1. Delete job

| | Statement | Class |
|---|---|---|
| Intended | Job form shows a Delete (trash) button to Sail Admin and Client Admin, not in Modify/Edit mode (`JobsFormPage.tsx:1032-1041`) | READ |
| Observed | Delete is a soft delete: job `is_deleted=true`, `is_active=false` | PROVEN 30-Sep |
| Observed | **Work orders are kept:** a job with **34 work orders** (Due, Completed, Pending Approval, Postponement Approved) was deleted → all 34 rows unchanged (status, not deleted) and all 34 still listed by the Work Orders API; restored | PROVEN 1-Oct |
| Defect | The server accepted `DELETE /jobs/:id` from a request forwarding Vessel User (UI-only restriction; mock identity) | PROVEN 30-Sep → D1 |

## 2. Deactivate component

| | Statement | Class |
|---|---|---|
| Intended | Component Register → Edit → Is Active = No → Save calls the deactivate action (`ComponentRegisterAddEdit.tsx:938-959, 1619-1623`) | READ |
| Intended | Refuse while active child components, active jobs or active spares are linked (`postgresStorage.ts:1413-1530`) | READ |
| Observed | Refused while active **jobs** are linked (S-Band Radar, 6 jobs → "…6 active Job(s) are linked…") | PROVEN 30-Sep |
| Observed | Active **spares** check: **not exercised** — every component with active spares also has active jobs or children, so another check fires first | — (stays READ) |
| Observed | A component with active **child components** WAS deactivated (DIESEL ENGINES, 16 active children); restored | PROVEN 30-Sep |
| Defect | Child check compares `parent_id` with the parent's `cuuid`/`id`; the data stores the parent's **component code** (264/264 children on the pilot vessel, both local DBs) | READ + PROVEN count → D2 |
| Defect | `POST /components/:id/inactivate` has no server permission check | READ → D3 |
| Defect | Change-request apply sets Is Active without the safety checks (`postgresStorage.ts:6470-6541`) | READ → D4 |

## 3. RH counter types

| | Statement | Class |
|---|---|---|
| Intended | `MASTER`, `INHERITED`, `NOT_RH_DRIVEN` (default); labels "Master (RH Owner)", "Inherited (Uses Master Counter)", "Not RH Driven" | READ |
| Intended | Updating a Master applies the increase to the INHERITED components linked to it (`cascadeRunningHoursUpdate`); the Running Hrs page lists Masters | READ |
| Observed | Counter-type values in the data | PROVEN — data point: 30 rows use the legacy spelling `NOT RH DRIVEN` (69 use `NOT_RH_DRIVEN`) → D7 |
| Manuals | The Office (p.40) and Vessel (p.34) manuals say "For components with an Inherited RH type, updates are cascaded to all child components" — the reverse of the code's direction | READ (manual text) → corrected by a knowledge entry |

## 4. RH validations

| | Statement | Class |
|---|---|---|
| Observed | A reading lower than the current value is refused | PROVEN |
| Observed | A second increase on the same day is refused ("Same-day update already performed…") | PROVEN |
| Observed | At most 25 h per day since the last reading (next day +26 h refused) | PROVEN |
| Observed | A reading dated before the last reading is refused | PROVEN |
| Observed | No vessel setting row = validation ON | PROVEN |
| Intended | Update RH **screen**: date required, no future date, zero needs renewal confirmation, meter replacement needs old meter final (`RunningHours.tsx:1030-1110`); bulk update: date required, zero refused (`:1367-1411`) | READ |
| Defect | The Update RH **endpoint** accepted a reading dated in the future (only the screen blocks it) | PROVEN → D5 |
| Defect | A request forwarding Vessel User with `adminOverride:true` bypassed the same-day / 25 h limits (server role = mock Sail Admin) | PROVEN → D6 |

## What would disprove or limit these

- **One vessel's data:** D2 rests on it, and both local DBs hold the same vessel. One production count (the same query) is
  needed before calling it a pattern.
- **Mock identity:** D1 and D6 follow from it. On a server with real role enforcement they may not reproduce.
- **No production run:** none of this was run on production.
