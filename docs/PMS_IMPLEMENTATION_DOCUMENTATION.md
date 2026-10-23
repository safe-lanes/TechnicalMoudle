# PMS Implementation and Codebase Reference

**Prepared:** 12 October 2026  
**Source revision:** `1e9c3360b`  
**Audience:** Claude, technical developers, maintainers, and domain reviewers.  
**Purpose:** Explain the current Planned Maintenance System implementation, its workflows, calculations, APIs, data model, and hybrid office/vessel operation.

> This is a source-analysis reference, not a specification of an ideal PMS. Creating this document did not change application code, settings, database records, or migrations. No WO generation, synchronization, approval, inventory transaction, or application test was executed for this documentation.
>
> All source paths are relative to the repository root. Appendix line numbers identify this snapshot and will change after edits. Inventory entries establish that code exists; they do not prove that every function is reached, correctly authorized, deployed, or operationally tested.

## Contents

1. [Scope, evidence, and terminology](#1-scope-evidence-and-terminology)
2. [Architecture and request flow](#2-architecture-and-request-flow)
3. [Screens, navigation, and role context](#3-screens-navigation-and-role-context)
4. [Components and hierarchy](#4-components-and-hierarchy)
5. [Jobs and frequency configuration](#5-jobs-and-frequency-configuration)
6. [Running Hours and rotational items](#6-running-hours-and-rotational-items)
7. [Due-date calculation and RH projections](#7-due-date-calculation-and-rh-projections)
8. [Work Order generation](#8-work-order-generation)
9. [Schedulers and event-driven automation](#9-schedulers-and-event-driven-automation)
10. [WO list, planner, and category counts](#10-wo-list-planner-and-category-counts)
11. [WO lifecycle, approval, and completion](#11-wo-lifecycle-approval-and-completion)
12. [Spare consumption and inventory effects](#12-spare-consumption-and-inventory-effects)
13. [Modify PMS and change requests](#13-modify-pms-and-change-requests)
14. [Master data, imports, and configuration](#14-master-data-imports-and-configuration)
15. [Office, vessel, and hybrid synchronization](#15-office-vessel-and-hybrid-synchronization)
16. [Reports, dashboard, alerts, and exports](#16-reports-dashboard-alerts-and-exports)
17. [Database relationships and identity](#17-database-relationships-and-identity)
18. [API contracts and validation responsibilities](#18-api-contracts-and-validation-responsibilities)
19. [Troubleshooting and operational analysis](#19-troubleshooting-and-operational-analysis)
20. [Verification gaps and development safeguards](#20-verification-gaps-and-development-safeguards)
21. [Reading guide and references](#21-reading-guide-and-references)

The source-derived appendices after Section 21 contain the API registration catalogue, database field dictionary, synchronization registry, frontend file/request index, and exported backend/shared symbol index.

## 1. Scope, evidence, and terminology

### 1.1 Scope

PMS includes the dashboard, equipment/component register, job definitions, Work Orders, maintenance planner, execution and approval, Running Hours, maintenance records, change requests, related inventory consumption, administration, and maintenance reports.

Supporting scope includes fleet/vessel master mapping, rotational items, forms, bulk import, settings, access/view controls, audit/retention, and ship-shore synchronization. These are necessary to understand PMS even where directories are not named `pms`.

Defects, Certificates & Surveys, Noon Reports, and Purchasing are adjacent modules. Their complete business workflows are outside this reference. Shared API, report, permission, and synchronization entries appear in inventories to preserve integration context; that does not make all adjacent functionality part of PMS.

### 1.2 Evidence labels

| Label | Meaning |
|---|---|
| **Code confirmed** | The responsibility or rule is supported by the inspected implementation at the recorded revision. |
| **Source inventory** | A route, symbol, file, table, or registry entry was extracted from source. Runtime use remains to be traced where not explained in the narrative. |
| **Requires Verification** | Behaviour depends on uninspected branches, deployment/configuration, database contents, identity, or an actual execution. |
| **Recommendation** | Suggested investigation or improvement, not implemented behaviour. |

Executable conditions take precedence over stale comments and older design documents. This document does not substitute current source inspection for production incident evidence.

### 1.3 Terms that must not be conflated

| Term | Meaning |
|---|---|
| Job | Maintenance definition with frequency, component associations, assignment, and cycle tracking. |
| WO | Planned/unplanned work record, execution, workflow state, and cycle snapshots. |
| Calendar due date | Date by which a Calendar leg is due. |
| Due RH | Counter threshold by which an RH leg is due. |
| Expected/estimated RH due date | Calendar-time projection based on historical utilization; not the RH eligibility trigger. |
| Generation advance | Fixed normal scanner advance: 30 calendar days or 720 RH. |
| Lead time | Window classifying an existing WO as Due before its threshold. |
| Grace period | Allowance after a due threshold before calculated Overdue. |
| Planned date | User planning intention; not the job due date or generation threshold. |
| Stored status | Workflow/category value persisted on a WO. |
| Computed status | Value derived on read using due values, current inputs, and workflow state. |
| Office/shore | Office-side installation/local data store and office-managed configuration. |
| Vessel/ship | Vessel-side installation/local data store and crew operational execution. |

## 2. Architecture and request flow

### 2.1 Stack

The application uses React/TypeScript, Vite, Tailwind, Radix/Shadcn components, AG Grid, Wouter routing, TanStack Query, Express/TypeScript, PostgreSQL, and Drizzle. See `replit.md` for project conventions.

### 2.2 Principal layers

```text
App.tsx / TechnicalModule.tsx
  -> page / feature component
  -> fetch or apiRequest to /technical/api/...
  -> tenant + authentication + request-context middleware
  -> module routes
  -> controller: HTTP input, scope, response/error handling
  -> service: business rule, calculation, orchestration
  -> repository / storage adapter
  -> PostgreSQL
  -> audit / inventory / field logger / downstream hooks, as applicable
  -> TanStack Query invalidation / refetch
```

`server/routes.ts` mounts central middleware; `server/modules/index.ts` mounts module routers. Some configuration/administration endpoints are registered centrally instead of in module routers.

### 2.3 Modern modules and older services coexist

Feature folders contain controllers, services, repositories, routes, utilities, and tests. Important older/shared responsibilities remain under `server/services/`.

| Source | Responsibility |
|---|---|
| `server/modules/work-orders/services/workOrderService.ts` | Operational reads/create/update, execution, approvals, cycle advancement, inventory and postponements. |
| `server/services/workOrderService.ts` | Common older generation creator and Calendar generation helper. |
| `server/services/jobDueScanner.ts` | Normal scanner, RH/Dual generation, individual-job on-demand generation. |
| `server/services/rhDueDateService.ts` | Historical RH utilization and calendar-date estimates. |
| `server/postgresStorage.ts` | PostgreSQL storage used by several repositories/services. |
| `shared/schema.ts` | Drizzle tables and insertion schemas. |
| `shared/workOrders/` | Shared status, date parsing, job-cycle, point-in-time and completion-validation helpers. |

Do not substitute similarly named services solely because names match. Their public interfaces and callers differ.

### 2.4 Identity and permissions

`App.tsx` wraps pages in authentication, UI-role, vessel, offline, permission, change-request/change-mode, and marker contexts. Some routes use `ProtectedRoute`; `TechnicalModule.tsx` also applies navigation permission checks.

The inspected API mount includes `mockAuthMiddleware`. `replit.md` documents identity/permission constraints, including permission fail-open behaviour for roles without configured rows.

**Requires Verification:** deployment identity integration, forwarded role values, configured permissions, and whether a gate restricts the real caller as intended. UI hiding is not proof of API authorization.

## 3. Screens, navigation, and role context

### 3.1 Active entry points

| Feature | Navigation or entry | Principal source |
|---|---|---|
| PMS shell/dashboard | `/pms`, shell dashboard selection | `client/src/pages/TechnicalModule.tsx`, `client/src/pages/pms/Dashboard.tsx` |
| Components | `/pms/components` | `client/src/pages/pms/Components.tsx` |
| Jobs Form | `/pms/job/:id` | `client/src/pages/pms/JobsFormPage.tsx` |
| Work Orders | `/pms/work-orders` | `client/src/pages/pms/WorkOrders.tsx` |
| WO execution | `/pms/work-order/:id` | `client/src/pages/pms/WorkOrderFormPage.tsx` |
| New component-linked WO | `/pms/work-order/new/:componentId` | `WorkOrderFormPage.tsx`, mode `new` |
| New unplanned WO | `/pms/work-order/unplanned/new` | `WorkOrderFormPage.tsx`, mode `unplanned-create` |
| Work Order Planner | Inside Work Orders when `showPlanner` is true | `client/src/pages/pms/WorkOrderPlanner.tsx` |
| Running Hours | `/pms/running-hrs` | `client/src/pages/pms/RunningHours.tsx` |
| Maintenance records | `/pms/maintenance-records/:componentId` | `client/src/pages/pms/MaintenanceRecords.tsx` |
| Modify PMS | PMS shell `modify-pms` | **`client/src/components/modifyPms/ModifyPMS.tsx`** |
| Modify PMS jobs selection | `/pms/modify-pms/jobs` | `client/src/pages/modify-pms/JobsSelector.tsx` |
| Superintendent | PMS shell `superintendent` | `client/src/pages/pms/SuperintendentPage.tsx` |
| Anomalies | `/pms/anomalies` | `client/src/pages/pms/AnomaliesPage.tsx` |
| Spares | `/spares` / PMS shell | **`client/src/pages/spares/SparesNew.tsx`** |
| Stores | `/stores` | `client/src/pages/stores/Stores.tsx` |
| Bulk stock updates | `/spares/bulk-update`, `/stores/bulk-update` | Respective `BulkUpdate...tsx` pages |
| Reports | `/reports` | `client/src/pages/reports/ReportsModule.tsx` |
| PMS admin | PMS/Admin shell | `client/src/pages/pms/PMSAdmin.tsx` |
| Master data | Admin master view | `client/src/pages/admin/DataMasters.tsx` and child pages |
| Sync management | Admin sync views | `SyncDashboard.tsx`, `SyncProvisioning.tsx`, `SyncFleetOverview.tsx`, `SyncConflictReview.tsx` |

`client/src/pages/pms/ModifyPMS.tsx` exists, but the shell imports `components/modifyPms/ModifyPMS.tsx`. Archived Spares pages are not the active shell implementation.

### 3.2 Typical user navigation

1. Open PMS and select an accessible vessel.
2. Open Components and select equipment in the tree.
3. Inspect information, linked jobs, history, RH and associated records.
4. Open a job definition and tracking.
5. Generate a job WO where authorized, or open existing Work Orders.
6. Plan, execute, submit, review and approve the WO.
7. Check history, cycle advancement, inventory and RH effects.
8. Monitor reports, alerts and hybrid synchronization.

Controls vary by role, view mode, instance and vessel policies. The route index is not evidence that every role can perform every listed action.

## 4. Components and hierarchy

### 4.1 Definition and ownership

Operational equipment is stored in `components`; fleet templates in `fleet_components`. SFI/equipment codes, parent information, fleet associations and vessel identity participate in tree construction and lookup. Displayed business code is not canonical database identity.

Read `Components.tsx` for tree/search/criticality filtering, selected state, view/edit forms, draft jobs and job actions. Backend: `server/modules/components/routes.ts`, controllers, services, repository and schemas.

### 4.2 Component workflow

1. Resolve accessible vessel scope and load records.
2. Build/filter equipment hierarchy and select a component.
3. Load/display details and sub-entities.
4. Validate authorized create/edit input.
5. Persist through a component API.
6. Refresh tree/detail records and apply path-specific audit/sync logging.

Documents, class/regulatory entries, maintenance history and requisitions have distinct APIs/data. `subEntityService.ts`, `documentService.ts` and `shipVesselAccess.ts` are relevant; the latter restricts ship sub-entity vessel access.

### 4.3 Component hierarchy versus job links

`job_component_links` implements many-to-many associations. Older `jobs.componentId`, `componentCode` and `componentName` remain for compatibility and are still used by generation branches.

Do not assume one job means one component, or that all code ignores the primary legacy association.

### 4.4 RH and rotational association

Fields include counter type, authoritative master/source, master RH, inherited cached RH, cumulative RH, replacement date/last reading and stamp/rotational-item information. Exact properties, SQL names/types/references appear in Appendix B.

### 4.5 Lifecycle and date presentation

Active/inactive state differs from soft deletion. Dedicated service rules/tests cover visibility and deletion; deletion is not automatically a hard SQL delete.

Component UI date work targets `DD-MM-YYYY`; see `ComponentDateInput.tsx` and presentation tests. Backend/API date values should not be rewritten solely to change display.

**Requires Verification:** every create/edit/delete state, unusual parent/import hierarchy, and draft component/job transaction atomicity.

## 5. Jobs and frequency configuration

### 5.1 Important fields

- `id`, canonical `juuid`, vessel association.
- `jobNo`, title, maintenance/task type, basis and descriptions.
- Frequency value/unit and `intervalRunningHour`.
- Initial/next due, last done date/RH, next due RH.
- RH-estimated date, average per day and basis marker.
- Assigned rank, approver and optional Level 2 reviewer rank.
- Priority, criticality/class relationship and department.
- Spare/tool/safety requirements.
- Active/deleted state, fleet/vessel scope, template links.
- Audit/sync metadata and authorized tracking rebaseline stamp.

### 5.2 Create/update flow

`server/modules/jobs/services/jobService.ts` exposes list/get/create/update/inactivate/history/generation functions. Create/update use shared schemas and basis-specific rules.

Omitted `lastDoneDate` is distinguished from an explicitly provided value. A frontend default must not invent completion history. Editing definitions differs from completing a WO or authorizing rebaseline.

RH definition updates align interval representations and recalculate applicable tracking/estimates. Dual definitions require calendar and RH inputs and RH-capable associations. Read the exact merge/recalculation conditions before changing frequency.

### 5.3 Maintenance bases

| Basis | Definition | Trigger |
|---|---|---|
| Calendar | Positive interval in Days/Weeks/Months/Years | Date |
| Running Hours | RH interval | Counter |
| Dual Frequency | Calendar and RH legs | Either leg's generation threshold |

An expected calendar date is not a third maintenance basis.

### 5.4 Activity and history

`inactivateJob` changes job activity and inspects associated active WOs. It does not mean deleting all history or automatically cancelling all WOs. Check warnings and caller behaviour.

History endpoints require canonical identities and vessel scope. Imported/master records are not proof of maintenance execution.

## 6. Running Hours and rotational items

### 6.1 Implementation

- UI: `RunningHours.tsx`, `RHTimelineViewer.tsx`, component/WO RH controls.
- Module service: `server/modules/running-hours/services/runningHoursService.ts`.
- Lower-level service: `server/services/runningHoursService.ts`.
- Validation: module `utils/rhValidation.ts`, timeline/date helpers, `rhEventComparator.ts`.
- Data: components, RH audit/log and rotational tables.

Module functions include `createAudit`, `cascadeUpdate`, `listParents`, `listChildren`, `updateChildRH`, `resetChildRH`.

### 6.2 Master and inherited counters

MASTER is authoritative. INHERITED references a master by ID/source code and carries cached/derived values. Tree parentage and RH-master association need not be identical.

Application may update master, audits, children and installed physical-item hours. Read the locked transaction, delta propagation, event comparison and reset epoch before editing cascade logic.

### 6.3 Monotonicity and policy

Normal live counters must not decrease. Equal values are idempotent/no-op in relevant paths. Optional vessel rate/anomaly validation does not authorize a lower normal counter.

Explicit replacement/renewal/reset is separate. A historical completion may retain its reading while skipping application of a lower live RH value. That outcome must not be described as a permitted counter rollback.

Fresh-read checks after locking matter; frontend-only validation is insufficient.

### 6.4 Typical entry sequence

1. Select vessel and source component.
2. Enter RH and local reading date.
3. Validate type, vessel policy, timeline and monotonicity.
4. Apply through fresh-read/locking transaction.
5. Write event/audit.
6. Cascade to inherited counters/stamps where applicable.
7. Refresh invoked estimates.
8. Ship updates can request a WO scan; shore RH-update scans are refused.

### 6.5 Rotation Item Master List

`RotationItemMasterList.tsx` manages physical stamps/items, not job frequency definitions. `rotationalItemService.ts` provides vessel/stamp lookup, create/update/delete, installed holder, detach, claim and replacement.

Relationships: item identity/stamp, vessel, current holder/component, physical-item hours/status and rotation history.

Inherited engine total differs from a physical item's accumulated hours since installation. Do not substitute one in replacement/report logic.

**Requires Verification:** reset/replacement state transitions and rollback across component, item and audit writes.

## 7. Due-date calculation and RH projections

### 7.1 Calendar next due

`shared/dateUtils.ts::calculateNextDueDate`:

```text
Next Due Date = actual completion date + one positive frequency interval
```

Supports Days/Weeks/Months/Years, normalizes input, adds date-fns duration, returns `dd-MMM-yyyy`; missing/invalid inputs return null.

**Current important rule:** `originalDueDate` remains a compatibility parameter but is **not used**. Some surrounding comments still mention original-date anchoring; that is not the current calculation.

Month/year duration is calendar arithmetic, not fixed 30/365-day conversion.

### 7.2 RH threshold

Main scanner:

```text
Due RH = parse(lastDoneRH, default 0) + intervalRunningHour
Generation RH = max(0, Due RH - 720)
```

`nextDueRH` is also persisted. Read-side hydration can prefer it; the separate older auto API uses it. Inconsistent stored/computed tracking can therefore affect results.

### 7.3 Shared cycle advancement

`shared/workOrders/jobCycleCalc.ts::computeJobCycleUpdates`:

- Calendar advances completion date and next calendar due.
- RH completion date is metadata; completion RH advances last/next RH.
- Dual advances calendar with completion date and RH only when completion RH is supplied.
- Completion RH is integer-parsed in this helper; arbitrary fractional precision is not guaranteed.

`preserveNewerJobRhState` suppresses older/equal date/RH changes and avoids reducing next RH/related estimates. Completion and shore learning reuse this calculation, with caller-specific persistence guards.

### 7.4 Historical utilization

`server/services/rhDueDateService.ts`:

1. Parse numeric/date points, exclude invalid/deleted entries.
2. Order by reading date, entered time tie-break.
3. Restrict to latest reset/replacement epoch.
4. Restrict to latest contiguous stamp epoch.
5. Select valid increasing baseline and latest reading.

```text
Average RH/day = (latest RH - baseline RH) / elapsed days
```

This uses the valid active history period, not a fixed last-30-day window. Completion date is not the utilization baseline.

### 7.5 Expected/estimated RH date

`estimateRhDueDate(completionDate, rhFrequency, points)`:

```text
Projected days = max(0, round(RH frequency / historical average RH/day))
Estimated date = completion date + projected days
```

Unavailable history, invalid completion date or nonpositive frequency produces null date and explicit basis reason, not a fabricated date.

`resolveAuthoritativeRhComponent` resolves an inherited component to a vessel-consistent MASTER by ID/source. `effectiveDueDate` selects the earlier calendar/RH estimate; equal dates have combined basis.

Example: 500 RH / 10 RH per day = 50-day projection from completion. Actual RH eligibility remains counter-based.

### 7.6 Parsing and display

`shared/workOrders/dateParse.ts` provides shared parsing and canonical day operations. Text due/completion dates and timestamps coexist. Avoid blind `new Date()` on `DD-MM-YYYY`.

Component, Job Form and Planner UI presentation targets `DD-MM-YYYY`. Backend functions may retain ISO or `DD-MMM-YYYY`. This is not a claim that every unrelated screen/export is uniformly formatted.

**Requires Verification:** deployment timezone boundaries, malformed imports, leap/month-end cases and all export date representations.

## 8. Work Order generation

### 8.1 Entry points

| Action | Entry | Engine | Early override |
|---|---|---|---|
| Job Generate WO | `POST /technical/api/jobs/:id/generate-wo` | Job service -> `generateWorkOrderForJob` | Yes |
| Vessel Generate Now | `POST /technical/api/work-orders/generate-now` | Controller -> `runScan(vesselId)` | No |
| Ship timer | Application startup scheduler | `runScan()` | No |
| Shore timer | Per-vessel sweep | `runScan(vesselId)` | No |
| Ship RH/completion event | Service hooks | Scoped scanner | No |
| Older auto API | `POST /technical/api/work-orders/auto-generate` | `workOrderAutoService.autoGenerate` | Separate implementation |

### 8.2 Normal scanner

`runScan` loads jobs/WOs once, then Calendar, RH, Dual. Storage excludes soft-deleted jobs; branches select basis/activity/data conditions.

Calendar:

```text
Generation date = job.nextDueDate - 30 days
Eligible if current calendar day >= generation date
```

Overdue jobs remain eligible. Invalid/missing date skips the job. Generation copies existing due date; it does not advance to today/current week.

RH: positive interval; primary component exists and supported counter type. MASTER uses master RH; INHERITED uses cached RH with post-replacement cumulative correction when indicated. Linked-component current values determine RH eligibility.

Dual: valid calendar due and positive RH interval; either leg triggers. Calendar precedence when both trigger. Automatic branch uses primary-component trigger/RH before iterating links.

### 8.3 Associations and duplicates

Calendar/RH support linked-component WOs with primary fallback. `server/utils/workOrderStatus.ts` supplies blocking/cycle maps. Pure Calendar/RH maps include completed cycles and exclude cancelled/deleted rows.

Blocking includes active/due/overdue, pending approval, in-progress/open, rejected and several postponement/office-approval states. Legacy no-component WOs explicitly block whole jobs in relevant RH/Dual/manual branches; Calendar prechecks are not fully identical.

Common creator repeats an active duplicate check. **Requires Verification:** deployed unique indexes and race guarantees; source comments are not live DDL evidence.

### 8.4 Individual-job manual path

1. Validate Planning/Breakdown/Other reason.
2. Reject absent/deleted/inactive job.
3. Shore checks vessel office-generation flag.
4. Choose requested or job component.
5. Check blockers and applicable cycle records.
6. Resolve component, due and snapshots.
7. Allow early generation.
8. Calculate initial status/settings.
9. Generate planned number and call common older creator.
10. Save reason in remarks; return WO/blocking details.

Reason does not change frequency formula or automatically make an unplanned WO.

### 8.5 Differences and risks

| Item | Individual-job path | Normal scanner |
|---|---|---|
| Scope | Selected component | Linked-component processing |
| Invalid calendar date | Snapshot fallback may use today, actual due field still uses job value | Skip |
| RH validation | Legacy type/reading fallback; not identical positive-interval selection | Positive interval/supported primary type |
| Inherited replacement | Does not use same correction | Correction present |
| Stored initial status | Computed; grace result stored as Due | Active |
| Provenance | Explicit instance origin and reason | RH/Dual origin set; Calendar payload does not explicitly set origin |

Auto RH can snapshot primary `effectiveRhAtGeneration` alongside linked `currentReading`. Auto Dual does not independently trigger per linked component. Dual does not use pure Calendar/RH's same completed-cycle maps. These are source risks, not verified affected records.

### 8.6 Older auto endpoint

`workOrderAutoService.ts` uses vessel leads as creation windows, stored `nextDueRH`, integer cumulative parsing, narrower duplicate key/status logic and a separate create/assignment-sync path. No equivalent Dual branch.

No current frontend caller was identified during generation analysis. **Requires Verification:** external callers/deployment use. Do not identify this endpoint as the normal timer.

## 9. Schedulers and event-driven automation

| Service/trigger | Source default | Scope |
|---|---|---|
| Ship scanner | 24 hours passed at startup; first scan ~10 seconds | Local DB, ship role |
| Shore sweep | 24 hours; first ~10 minutes | Provisioned active vessels, enabled office flag |
| Role watchdog | Every 5 minutes | Re-resolve role; start/stop correct timers |
| Ship RH entry | Event-driven | Same scanner thresholds |
| Final approved ship completion | Event-driven next cycle | Eligible cycles only |
| Shore RH entry | No generation | Explicit gate |
| Post-sync reconciliation | Sync completion hook | Shore reconciler |

Keys: `JOB_DUE_SCAN_INTERVAL_MS`, `SHORE_WO_SWEEP_INTERVAL_MS`, `SCHEDULER_ROLE_WATCHDOG_MS`. No configured values were read; above are code defaults.

### 9.1 Shore scope

`getProvisionedVesselIds` joins active vessels with non-deleted sync metadata. Not simply all enabled vessels. A never-provisioned vessel may be excluded while Generate Now is allowed.

Missing setting/null/nontrue office flag or lookup error denies shore generation.

### 9.2 Reliability

Scanner in-process guard skips overlapping runs. Shore has sweep-in-flight guard. Neither is a durable distributed queue.

Skipped/failed daily runs are not queued for immediate retry. Timers restart with process. No persisted missed-run catch-up appears in these WO schedulers. Watchdog checks started state, not last successful completion/hung scans.

Shore catches per-vessel errors but preparation before the loop can reject its sweep without the timer's outer catch. Process consequence depends on global error handling.

### 9.3 Role and lifecycle

Stored identity participates in role resolution and can override environment assumptions. Watchdog follows resolved role; does not correct wrong DB identity.

Ship initial timeout is not retained/cleared by `stop()` unlike shore's first timer. Inspect stop/start role transitions when changing lifecycle.

### 9.4 Reconciliation

Older text says generation+reconcile, but current shore sweep generates only. Post-sync trigger in `server/modules/sync/controller.ts` and manual reconciler APIs perform reconciliation.

## 10. WO list, planner, and category counts

### 10.1 Lists

`WorkOrders.tsx` sends vessel, paging, category, search, period, rank, criticality, postponement and sorting. Backend returns paginated data plus category counts. Full fetch supports export/deep linking.

Generate Now returns checked/generated/basis counts and invalidates WO query. UI delta need not equal created count: refreshed status, sync or other categories can contribute.

### 10.2 Status

`computeWorkOrderStatus` in `shared/workOrders/status.ts` handles finalized/execution states and preserves pending approval/office review and postponement branches before deriving categories.

```text
RH remaining = due RH - current RH
remaining < -grace -> Overdue
remaining < 0 -> Due (Grace P)
remaining <= lead -> Due
otherwise -> Active
```

Calendar: future outside lead Active; inside lead through due date Due; past due within grace Due (Grace P); after grace Overdue.

Dual chooses worse calculated leg where inputs are supplied. **Requires Verification:** hydration parity; not all read callers supply the same Dual fields.

Criticality rules differ between callers (High/Critical priority versus Critical/class flags). Grace/lead/company inputs also differ. Shared helper does not imply identical inputs.

### 10.3 Planner

Planner opens inside Work Orders. APIs: planner GET, single/bulk planned-date PATCH and planner export GET/POST. `planner_dates` stores intention. Horizon/rank/state/search, due and RH projection affect display.

Planned date is not normal scanner generation date. `PlannerDateInput.tsx`, `workOrderExportDueValue.ts` and planner service/schema are key references.

## 11. WO lifecycle, approval, and completion

### 11.1 Forms and creation

Form separates definition/template from execution/completion. Shared insertion schemas, B2 validation and RH completion requirements matter. Modern operational creator differs from scanner's older common creator.

### 11.2 Lifecycle

```text
Planned/unplanned WO -> execution/save -> Pending Approval
  -> reject/rework/resubmit OR approve
  -> optional Pending Office Review -> final Completed
  -> history/tracking/inventory/sync -> eligible next cycle on ship
```

Postponement/re-postponement are separate workflows.

### 11.3 Update guards

`updateWorkOrder` orchestrates:

- Required completion date.
- Pending Approval submitted-field protection.
- Explicit approve/reject actions.
- Office Part B edit allowlist.
- Rejection/reopening resubmission cleanup.
- Submission date and approval-tier capture.
- Vessel Superintendent policy and Level 2 interception.
- RH/audit application claims.
- Inventory save/approval.
- History, cycle, notification, sync/audit hooks.

Setting status Completed alone is not a safe emulation of approval.

### 11.4 Superintendent and Level 2

`isSuperintendentLockEnabled(vesselId)` uses vessel policy; missing means OFF/notify-only. Legacy singleton is not active fallback. Check submission and approval/acknowledgment enforcement, notifications and bulk parity.

Job `level2ReviewerRankId` can intercept approval into Pending Office Review. Direct update logs/proceeds if job lookup for interception fails: a source fail-open risk, not a proven incident.

### 11.5 Final effects

Approval can persist completion, apply/skip RH, create history, advance job cycle, record missed cycles, process undeducted spares, notify/log/sync and request next scanner run on ship.

Ancillary operations have separate catch boundaries. WO success does not prove every effect succeeded. Current cycle helper uses actual completion date, not old due-date anchoring.

### 11.6 Reject/reopen

`rejectCompletedWorkOrder` and `reopenCompletedWorkOrder` differ in role/behaviour. They may return tracking to the affected due cycle. Do not reduce live RH as ordinary completion reversal.

**Requires Verification:** all history/inventory reversal and idempotency cases; no blanket atomic rollback claim.

### 11.7 Postponement

Submit/approve/reject and re-postpone equivalents validate reason/Other remarks, classification/levels, original due snapshots and audit steps. Re-postponement rejection restores pre-request snapshot. RH and Calendar branches differ.

## 12. Spare consumption and inventory effects

### 12.1 Records

Spare definition -> component links/location balances -> transactions/history. Required spares are planned needs; `consumedSpareParts` is execution data.

### 12.2 Save versus approval

Eligible ordinary WO saves perform real-time ROB processing. Branch excludes approval/rejection/completed/L2-intercept situations; final approval has separate logic. Do not say consumption happens only on final approval.

### 12.3 Delta

`utils/spareConsumptionDelta.ts::computeSpareConsumptionDelta`:

1. Key by part code/number + normalized location.
2. Read prior `_deductedQty`.
3. Compare requested consumption with prior deduction.
4. Positive delta deducts; negative delta reverses.
5. Removed deducted line requests reversal.

Approval accounts for already deducted quantities. Changing deduction-marker contract affects repeat saves.

### 12.4 Failures

Resolve spare/location, apply stock/ledger and line metadata. Save lookup/errors may log/continue; approval propagates selected stock failures.

**Requires Verification:** WO/stock/ledger atomicity, duplicate lines, negative-stock handling, rework/reopen and partial-write retries. Saved WO is not proof every line deducted.

Receipts, issues, stock bulk updates and stores actions independently affect balances; consult their APIs when diagnosing ROB.

## 13. Modify PMS and change requests

Active frontend: `components/modifyPms/ModifyPMS.tsx`; field schema/labels: `shared/changeRequestFields.ts`, `changeRequestFieldLabels.ts`, `changeRequestSchema.ts`.

Workflow:

1. Select target and editable fields; load current values.
2. Prepare changes/comments/attachments; draft.
3. Submit from draft/returned state.
4. Classify/snapshot configured approval levels; create steps.
5. Approve/reject/return.
6. Apply supported final changes and retain revision/review evidence.
7. Synchronize office-mastered definitions.

`updateStatus` validates and dispatches submit setup. `approveChangeRequest` requires comment and blocks reapproval of decided records. Legacy zero-step and stepped paths coexist.

**Requires Verification:** every field/target mapping, approver override, direct-status transition and applied-record side effect.

## 14. Master data, imports, and configuration

### 14.1 Admin

PMS admin tabs: Bulk Data Import, Alerts, Forms, Master Data with permission/view-based visibility. Masters include maker/list, fleet equipment/jobs/spares, locations, central data, fleet/vessel mappings, rotation items, lead/grace settings, approval/rank registry.

### 14.2 Fleet mapping

Templates are not operational events. Mapping/materialization associates templates with vessel definitions. Definition ownership and cycle tracking differ.

**Requires Verification:** each mapping's copy/update/delete and preservation of existing execution tracking.

### 14.3 Imports

`server/modules/bulk-upload/`, `admin/BulkDataImport.tsx`, `admin/bulk/` and import history/error/change logs. Parser/controller source defines templates, header mappings, validation/staging/apply and error behaviour.

Historical WO import is not live approval; do not assume equivalent RH/inventory/history side effects.

### 14.4 Settings

| Setting | Purpose |
|---|---|
| Calendar/RH critical/noncritical lead | Due status; older auto API also uses creation window |
| Grace/company standard | Grace/Overdue, caller-specific inputs |
| Office generation enabled | Vessel shore-generation permission |
| Office RH entry enabled | Separate shore RH-write permission |
| RH validation enabled | Optional rate/anomaly, never normal rollback permission |
| Superintendent lock | Vessel approval enforcement |
| Level 2 reviewer rank | Optional office review |
| Workflow configuration | Applicable Level 1/2 change/postponement steps |
| Sync cadence/checkpoints | Data transfer, not maintenance frequency |

Missing-setting defaults differ; do not invent universal company fallback.

## 15. Office, vessel, and hybrid synchronization

### 15.1 Ownership

Separate local databases can temporarily differ. Identical scanner code can see different WOs/tracking/readings.

`shared/syncConfig.ts` declares direction/category/identity/scope. Components/jobs/links/fleet masters are shore-to-ship definitions; WO/execution/postponement are bidirectional. Special runtime RH and learned completion tracking qualify simple ownership.

### 15.2 Source responsibilities

| File under `server/modules/sync/` | Responsibility |
|---|---|
| `syncRole.ts` | Instance role |
| `autoSyncScheduler.ts` | Ship-initiated scheduling |
| `provisioningService.ts` | Initial vessel/bundle setup |
| `syncEngine.ts`, `service.ts`, `repository.ts` | Batch/session/checkpoint/application |
| `fieldLogger.ts` | Change tracking |
| `oneWayApplier.ts` | Office rows and tracking guards |
| `shipCompletionLearner.ts` | Completion-derived shore tracking |
| `dualCompletionResolver.ts` | Completion conflicts |
| `completedWorkOrderDateSync.ts` | Completion date support |
| Conflict review files | Recorded conflict review |
| `fileSyncProcessor.ts` | File transfer |
| Health/drift/pruning services | Diagnostic maintenance |

### 15.3 Sequence

Resolve role/scope -> provision if needed -> session/checkpoints -> exchange directions -> apply identity/ownership/conflicts -> derived completion/RH/tracking -> acknowledge -> complete -> shore reconciliation.

This map is not a guarantee that all steps occur in one transaction; consult actual engine/session boundaries.

### 15.4 Tracking exceptions

Ship completion can advance shore job tracking despite shore-mastered definitions. Ordinary incoming definitions must not replace newer operational tracking. Authorized rebaseline uses `trackingRebaselinedAt`.

RH derivation respects reset epochs, monotonicity and reading-date/tie-break comparator, not blanket last-request-wins.

### 15.5 Two WO writers

Office enabled generation and ship generation use their own WO sets. Sync lag can allow duplicate cycle creation. Shore `workOrderReconcilerService.ts::reconcileVessel` handles supported cases post-sync/manual, not current daily sweep.

**Requires Verification:** winner selection and execution-bearing duplicate handling. Same title/number alone is not a safe deletion rule.

## 16. Reports, dashboard, alerts, and exports

### 16.1 Families

Reports frontend dispatcher and backend routes/services cover:

- Maintenance: due/overdue/completed/all, unplanned, postponement, WO overview, monthly summaries/snapshots.
- Equipment: critical status/components, breakdown, LSA/FFA, class-related lists/jobs.
- Operations: crew workload/equipment utilization.
- Spares: critical/low stock/consumption.
- Stores: inventory/consumption/combined/expiry/low stock.
- Compliance, IHM and change-request reporting.
- Favorites/templates.

Exact registrations appear in Appendix A. Registered handler is not proof every chart/filter/export works or every proposed feature exists.

### 16.2 Flow

UI filters -> preview/export -> scoped report query/calculation -> DTO/workbook/snapshot -> chart/table/download.

Snapshots/regeneration are distinct from live WO generation.

**Requires Verification:** each metric, dates, inactive/deleted handling, role scope, status source, chart and export parity.

### 16.3 Dashboard/alerts

Dashboard services include trend and WO status-by-period. Current status is not historical status without point-in-time logic.

Alert policy/event/delivery/config/ack records and maintenance orchestrator are separate from generation. Alert visibility does not prove WO creation.

## 17. Database relationships and identity

### 17.1 Map

```text
vessels.vuuid -> components / jobs / work_orders / vessel settings / inventory
components.cuuid <-> job_component_links <-> jobs.juuid
jobs.juuid -> work_orders.jobId + compatibility code/template lookups
work_orders -> execution/details/postponement/notification/history
components -> documents/class/history/requisitions
spares -> links + location stock -> transactions/history
change_request -> approval steps + attachments + comments
fleet templates -> mapping -> vessel definitions
```

Includes application relationships, not only enforced FKs. Appendix B preserves `.references()` declarations. Do not claim a foreign key just because code joins fields.

### 17.2 Identity and scope

Canonical examples: vessel `vuuid`, component `cuuid`, job `juuid`, WO `wouuid`. Older IDs and business/template codes coexist. Several child tables use integer identity.

Codes can repeat across vessels; retain vessel context. JSON arrays for requirements/execution are not normalized child rows.

### 17.3 Source versus live DB

Dictionary is schema-derived, not production introspection. Raw SQL/migrations/triggers/deployed drift can qualify definitions. Sync infrastructure may have SQL-defined tables not present in `shared/schema.ts`; registry entries alone do not supply their column DDL.

Follow ordered migrations in `replit.md`; never `db:push` on an existing database. No migration is needed for this document.

## 18. API contracts and validation responsibilities

| API family | Input/flow | Main side effects |
|---|---|---|
| Jobs | Definition/frequency/requirements/scope | Schema/basis validation, tracking/estimates |
| Job Generate WO | Reason, optional active component | Early creation, blockers, office flag |
| Generate Now | Specific vessel | Gate/scanner/counts; no `all` scope |
| WO create/update | Definition/execution/status/action | Guards, RH, inventory, history/workflow |
| Bulk approval | Scoped WOs/action | Separate approval/L2 checks |
| Planner | Association/date(s) | Planning persistence, not trigger replacement |
| RH | Reading/date/component | Audit/cascade/reset |
| Change requests | Target/fields/review | Steps/application/revision |
| Sync | Vessel/session/batch/checkpoints | Direction, conflicts, application/ack |

Exact required keys/envelopes/errors belong to insertion schemas/controller/services. Registration guards/named handlers are in Appendix A; symbol definitions in Appendix E.

Individual-job generation: 201 created or 400 failure/blocker result. Generate Now: gate 403, skipped 409, successful counts/breakdown.

Generate Now maps any scanner skipped result to busy message even though scanner gate failure also skips. Initial direct gate reduces but does not eliminate diagnostic ambiguity.

Do not expose serialized SQL/server errors or log credentials as user-readable validation.

## 19. Troubleshooting and operational analysis

### 19.1 Manual sweep works, automatic missing

Check vessel/instance/time/build -> actual generated count/timestamps -> role/startup -> provisioning and flag at earlier time -> last success/skips/errors/restarts -> data then versus now -> blockers -> cache/sync/reconciliation.

Same scanner/data/time/scope should yield same eligible results. Count difference alone does not prove calculation difference.

### 19.2 Old weekly dates

Overdue dates are copied, not moved to current week. Check absent completion/approval, failed advancement, import and delayed sync. Do not mask overdue maintenance by mass-moving dates.

### 19.3 RH disagreement

Check master/source, reset/stamp epoch, cached/current counter, history, completion date, frequency, stored next due, scanner formula and read hydration. Estimate is not trigger.

### 19.4 Inventory missing after save

Check branch, deduction marker, location, stock validations, catch logs and atomicity. Ancillary writes can fail separately.

### 19.5 Observed count incident

User observation: Active 29 -> 218; Due 260 -> 421; Overdue 0 -> 8. Combined 289 -> 647, net +358.

Not a reproduced test or confirmed root cause. Internal category movement cannot explain combined increase, but exactly 358 new rows needs generated response/DB/sync evidence.

Affected vessel/instance/time were not supplied. Separately inspected workspace logs showed one shore vessel skipped for disabled generation. These were not proven to describe the incident; do not cite them as its confirmed cause.

## 20. Verification gaps and development safeguards

| Area | Requires Verification |
|---|---|
| Schema | Deployed DDL, constraints/triggers/migrations |
| Auth | Real roles, mock context, enforcement |
| UI | State/permission/date/export parity |
| Completion | Bulk/direct/L2/lock and ancillary atomicity |
| RH | Reset/cascade/stamp/winner/skipped application |
| Inventory | Partial writes, rejection/reopen, multi-line idempotency |
| Fleet/import | Tracking preservation and materialization |
| Reports | Metric/status/filter correctness |
| Scheduler | Success/skip/failure/hung recovery |
| Hybrid incident | Exact vessel/time/data/sync chronology |

No test pass or live database validation is claimed. Test files are intended coverage, not executed evidence.

Safeguards:

- Read `replit.md`, current callers and tests.
- Preserve canonical IDs/vessel scope and ownership exceptions.
- No ordinary RH rollback or unapproved tracking reset.
- No backend date rewrite for cosmetic formatting.
- No casual merge of older/modern services.
- No inference of scheduler absence from one missing WO.
- No treating comments/plans/routes as proven complete functionality.
- No incidental sync/field-logger/live integration changes.
- No credentials, raw backups or personal data in shared documentation.

## 21. Reading guide and references

Start at real screen/API -> controller/service -> shared computation -> repository/storage -> schema/ownership -> tests/migrations -> deployment evidence.

Supporting references (reconcile older docs with current source):

- `replit.md`
- `docs/MODULE-ARCHITECTURE.md`
- `docs/BACKEND_ARCHITECTURE_ANALYSIS.md`
- `docs/DEVELOPER-HANDOFF-refactor-modular-architecture.md`
- `docs/SYNC-TECHNICAL-ARCHITECTURE.md`
- `docs/REPORT_GENERATION_BACKEND_ARCHITECTURE.md`
- `docs/V2-ModifyPMS-ChangeRequests-Module-Refactor-Plan.md`
- `docs/SUPPORT-WO-RECOVERY-MANUAL-RUNBOOK.md`

Appendices are source metadata, not application records. Middleware/handler text is preserved; inline bodies require source reading. Factory-defined columns are marked rather than guessed. Frontend API strings are lexical references, not independently registered endpoints.


---

## Appendix overview — source inventory coverage

This snapshot contains **466 API registrations**, **70 selected schema tables**, **1557 extracted column declarations**, **123 synchronization registry entries**, **93 frontend page files**, and **1661 exported backend/shared function or class declarations**. Supporting modules are included; these counts are not counts of independently verified user features. No database row values are included.

The inventories use literal source declarations. Dynamic route generation, non-exported functions, routes in unselected modules, frontend shared components, SQL-only tables, and runtime configuration are not exhaustively represented. The narrative supplies the principal flow and responsibility explanations; indexes provide precise lookup locations.

## Appendix A — API registration catalogue

Module routes are mounted under `/technical/api`; central routes retain their full literal path. HTTP method plus path identifies a registration. The registration column shows local middleware/handler composition, not a complete authorization or payload contract. For inline handlers the body is deliberately not duplicated; inspect the source. Namespace controller targets are resolved where possible. Global middleware is described in Section 2.

### A. vessels (28 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/fleets` | `asyncHandler(ctrl.getFleets)` | `server/modules/vessels/controllers/vesselController.ts#getFleets` | `server/modules/vessels/routes.ts:17` |
| GET | `/technical/api/fleets/:id` | `asyncHandler(ctrl.getFleetById)` | `server/modules/vessels/controllers/vesselController.ts#getFleetById` | `server/modules/vessels/routes.ts:18` |
| POST | `/technical/api/fleets` | `requirePermission('admin-masters', 'create'), asyncHandler(ctrl.createFleet)` | `server/modules/vessels/controllers/vesselController.ts#createFleet` | `server/modules/vessels/routes.ts:19` |
| PUT | `/technical/api/fleets/:id` | `requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.updateFleet)` | `server/modules/vessels/controllers/vesselController.ts#updateFleet` | `server/modules/vessels/routes.ts:20` |
| DELETE | `/technical/api/fleets/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.deleteFleet)` | `server/modules/vessels/controllers/vesselController.ts#deleteFleet` | `server/modules/vessels/routes.ts:21` |
| GET | `/technical/api/fleets/:id/vessels` | `asyncHandler(ctrl.getVesselsByFleet)` | `server/modules/vessels/controllers/vesselController.ts#getVesselsByFleet` | `server/modules/vessels/routes.ts:22` |
| GET | `/technical/api/fleets/:fleetId/classes` | `asyncHandler(ctrl.getFleetClasses)` | `server/modules/vessels/controllers/vesselController.ts#getFleetClasses` | `server/modules/vessels/routes.ts:26` |
| POST | `/technical/api/fleets/:fleetId/classes` | `requirePermission('admin-masters', 'create'), asyncHandler(ctrl.createFleetClass)` | `server/modules/vessels/controllers/vesselController.ts#createFleetClass` | `server/modules/vessels/routes.ts:27` |
| PUT | `/technical/api/fleet-classes/:fcuuid` | `requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.updateFleetClass)` | `server/modules/vessels/controllers/vesselController.ts#updateFleetClass` | `server/modules/vessels/routes.ts:28` |
| DELETE | `/technical/api/fleet-classes/:fcuuid` | `requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.deleteFleetClass)` | `server/modules/vessels/controllers/vesselController.ts#deleteFleetClass` | `server/modules/vessels/routes.ts:29` |
| GET | `/technical/api/vessels` | `asyncHandler(ctrl.getVessels)` | `server/modules/vessels/controllers/vesselController.ts#getVessels` | `server/modules/vessels/routes.ts:33` |
| POST | `/technical/api/vessels` | `requirePermission('admin-masters', 'create'), asyncHandler(ctrl.createVessel)` | `server/modules/vessels/controllers/vesselController.ts#createVessel` | `server/modules/vessels/routes.ts:34` |
| GET | `/technical/api/vessels-with-fleets` | `asyncHandler(ctrl.getVesselsWithFleets)` | `server/modules/vessels/controllers/vesselController.ts#getVesselsWithFleets` | `server/modules/vessels/routes.ts:35` |
| PUT | `/technical/api/vessels/:id/fleet` | `requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.assignVesselToFleet)` | `server/modules/vessels/controllers/vesselController.ts#assignVesselToFleet` | `server/modules/vessels/routes.ts:36` |
| PUT | `/technical/api/vessels/:id/class` | `requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.assignVesselToClass)` | `server/modules/vessels/controllers/vesselController.ts#assignVesselToClass` | `server/modules/vessels/routes.ts:37` |
| GET | `/technical/api/pms-vessel-settings` | `asyncHandler(ctrl.getAllPmsVesselSettings)` | `server/modules/vessels/controllers/vesselController.ts#getAllPmsVesselSettings` | `server/modules/vessels/routes.ts:41` |
| POST | `/technical/api/pms-vessel-settings` | `requirePermission('pms-admin', ['create', 'edit']), asyncHandler(ctrl.createPmsVesselSettings)` | `server/modules/vessels/controllers/vesselController.ts#createPmsVesselSettings` | `server/modules/vessels/routes.ts:42` |
| GET | `/technical/api/pms-vessel-settings/:vesselId` | `asyncHandler(ctrl.getPmsVesselSettings)` | `server/modules/vessels/controllers/vesselController.ts#getPmsVesselSettings` | `server/modules/vessels/routes.ts:43` |
| PUT | `/technical/api/pms-vessel-settings/:vesselId/office-wo-generation` | `requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updateOfficeWoGenerationSwitch)` | `server/modules/vessels/controllers/vesselController.ts#updateOfficeWoGenerationSwitch` | `server/modules/vessels/routes.ts:44` |
| PUT | `/technical/api/pms-vessel-settings/:vesselId/office-rh-entry` | `requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updateOfficeRhEntrySwitch)` | `server/modules/vessels/controllers/vesselController.ts#updateOfficeRhEntrySwitch` | `server/modules/vessels/routes.ts:45` |
| PUT | `/technical/api/pms-vessel-settings/:vesselId/rh-validation` | `requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updateRhValidationSwitch)` | `server/modules/vessels/controllers/vesselController.ts#updateRhValidationSwitch` | `server/modules/vessels/routes.ts:46` |
| PUT | `/technical/api/pms-vessel-settings/:vesselId/superintendent-lock` | `requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updateSuperintendentLockSwitch)` | `server/modules/vessels/controllers/vesselController.ts#updateSuperintendentLockSwitch` | `server/modules/vessels/routes.ts:47` |
| PUT | `/technical/api/pms-vessel-settings/:vesselId` | `requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updatePmsVesselSettings)` | `server/modules/vessels/controllers/vesselController.ts#updatePmsVesselSettings` | `server/modules/vessels/routes.ts:48` |
| DELETE | `/technical/api/pms-vessel-settings/:vesselId` | `requirePermission('pms-admin', 'delete'), asyncHandler(ctrl.deletePmsVesselSettings)` | `server/modules/vessels/controllers/vesselController.ts#deletePmsVesselSettings` | `server/modules/vessels/routes.ts:49` |
| GET | `/technical/api/company-standard-grace-settings` | `asyncHandler(ctrl.getCompanyStandardGraceSettings)` | `server/modules/vessels/controllers/vesselController.ts#getCompanyStandardGraceSettings` | `server/modules/vessels/routes.ts:53` |
| PUT | `/technical/api/company-standard-grace-settings` | `requirePermission('pms-admin', 'edit'), asyncHandler(ctrl.updateCompanyStandardGraceSettings)` | `server/modules/vessels/controllers/vesselController.ts#updateCompanyStandardGraceSettings` | `server/modules/vessels/routes.ts:54` |
| GET | `/technical/api/vessel-location-names/:vesselId` | `asyncHandler(ctrl.getVesselLocationNames)` | `server/modules/vessels/controllers/vesselController.ts#getVesselLocationNames` | `server/modules/vessels/routes.ts:58` |
| PUT | `/technical/api/vessel-location-names/:vesselId` | `requirePermission('admin-masters', 'edit'), asyncHandler(ctrl.updateVesselLocationNames)` | `server/modules/vessels/controllers/vesselController.ts#updateVesselLocationNames` | `server/modules/vessels/routes.ts:59` |

### A. components (33 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| POST | `/technical/api/components/sort-order` | `asyncHandler(componentCtrl.updateSortOrder)` | `server/modules/components/controllers/componentController.ts#updateSortOrder` | `server/modules/components/routes.ts:21` |
| GET | `/technical/api/components/:vesselId` | `asyncHandler(componentCtrl.listByVessel)` | `server/modules/components/controllers/componentController.ts#listByVessel` | `server/modules/components/routes.ts:26` |
| GET | `/technical/api/components/details/:id` | `asyncHandler(componentCtrl.getDetails)` | `server/modules/components/controllers/componentController.ts#getDetails` | `server/modules/components/routes.ts:29` |
| POST | `/technical/api/components/upload` | `upload.single('file'), asyncHandler(uploadCtrl.upload)` | `server/modules/components/controllers/componentUploadController.ts#upload` | `server/modules/components/routes.ts:32` |
| GET | `/technical/api/components` | `asyncHandler(componentCtrl.listAll)` | `server/modules/components/controllers/componentController.ts#listAll` | `server/modules/components/routes.ts:37` |
| POST | `/technical/api/components` | `asyncHandler(componentCtrl.create)` | `server/modules/components/controllers/componentController.ts#create` | `server/modules/components/routes.ts:38` |
| PATCH | `/technical/api/components/:id` | `asyncHandler(componentCtrl.update)` | `server/modules/components/controllers/componentController.ts#update` | `server/modules/components/routes.ts:45` |
| DELETE | `/technical/api/components/:id` | `requirePermission('pms-components', 'delete', { enforce: true, unconfigured: 'deny' }), asyncHandler(componentCtrl.remove)` | `server/modules/components/controllers/componentController.ts#remove` | `server/modules/components/routes.ts:46` |
| POST | `/technical/api/components/:id/inactivate` | `asyncHandler(componentCtrl.inactivate)` | `server/modules/components/controllers/componentController.ts#inactivate` | `server/modules/components/routes.ts:53` |
| GET | `/technical/api/component-documents/:componentId` | `requireAuth, asyncHandler(subCtrl.listDocuments)` | `server/modules/components/controllers/subEntityController.ts#listDocuments` | `server/modules/components/routes.ts:57` |
| POST | `/technical/api/component-documents` | `requirePMSAdmin, upload.single('file'), asyncHandler(subCtrl.createDocument)` | `server/modules/components/controllers/subEntityController.ts#createDocument` | `server/modules/components/routes.ts:58` |
| PUT | `/technical/api/component-documents/:id` | `requirePMSAdmin, asyncHandler(subCtrl.updateDocument)` | `server/modules/components/controllers/subEntityController.ts#updateDocument` | `server/modules/components/routes.ts:59` |
| DELETE | `/technical/api/component-documents/:id` | `requirePMSAdmin, asyncHandler(subCtrl.deleteDocument)` | `server/modules/components/controllers/subEntityController.ts#deleteDocument` | `server/modules/components/routes.ts:60` |
| GET | `/technical/api/component-documents/:id/download` | `requireAuth, asyncHandler(subCtrl.downloadDocument)` | `server/modules/components/controllers/subEntityController.ts#downloadDocument` | `server/modules/components/routes.ts:61` |
| GET | `/technical/api/component-class-regulatory/:componentId` | `requireAuth, asyncHandler(subCtrl.listClassRegulatory)` | `server/modules/components/controllers/subEntityController.ts#listClassRegulatory` | `server/modules/components/routes.ts:65` |
| POST | `/technical/api/component-class-regulatory` | `requirePMSAdmin, asyncHandler(subCtrl.createClassRegulatory)` | `server/modules/components/controllers/subEntityController.ts#createClassRegulatory` | `server/modules/components/routes.ts:66` |
| PUT | `/technical/api/component-class-regulatory/:id` | `requirePMSAdmin, asyncHandler(subCtrl.updateClassRegulatory)` | `server/modules/components/controllers/subEntityController.ts#updateClassRegulatory` | `server/modules/components/routes.ts:67` |
| DELETE | `/technical/api/component-class-regulatory/:id` | `requirePMSAdmin, asyncHandler(subCtrl.deleteClassRegulatory)` | `server/modules/components/controllers/subEntityController.ts#deleteClassRegulatory` | `server/modules/components/routes.ts:68` |
| GET | `/technical/api/component-requisitions/:componentId` | `requireAuth, asyncHandler(subCtrl.listRequisitions)` | `server/modules/components/controllers/subEntityController.ts#listRequisitions` | `server/modules/components/routes.ts:72` |
| GET | `/technical/api/component-requisitions` | `requireAuth, asyncHandler(subCtrl.listAllRequisitions)` | `server/modules/components/controllers/subEntityController.ts#listAllRequisitions` | `server/modules/components/routes.ts:73` |
| GET | `/technical/api/component-requisitions/item/:id` | `requireAuth, asyncHandler(subCtrl.getRequisition)` | `server/modules/components/controllers/subEntityController.ts#getRequisition` | `server/modules/components/routes.ts:74` |
| POST | `/technical/api/component-requisitions` | `requireAuth, asyncHandler(subCtrl.createRequisition)` | `server/modules/components/controllers/subEntityController.ts#createRequisition` | `server/modules/components/routes.ts:75` |
| PUT | `/technical/api/component-requisitions/:id` | `requireAuth, asyncHandler(subCtrl.updateRequisition)` | `server/modules/components/controllers/subEntityController.ts#updateRequisition` | `server/modules/components/routes.ts:76` |
| DELETE | `/technical/api/component-requisitions/:id` | `requirePMSAdmin, asyncHandler(subCtrl.deleteRequisition)` | `server/modules/components/controllers/subEntityController.ts#deleteRequisition` | `server/modules/components/routes.ts:77` |
| GET | `/technical/api/component-maintenance-history` | `asyncHandler(subCtrl.listAllMaintenanceHistory)` | `server/modules/components/controllers/subEntityController.ts#listAllMaintenanceHistory` | `server/modules/components/routes.ts:81` |
| GET | `/technical/api/component-maintenance-history/vessel/:vesselId` | `asyncHandler(subCtrl.listVesselMaintenanceHistory)` | `server/modules/components/controllers/subEntityController.ts#listVesselMaintenanceHistory` | `server/modules/components/routes.ts:82` |
| GET | `/technical/api/maintenance-history/vessel/:vesselId` | `asyncHandler(subCtrl.listVesselMaintenanceHistory)` | `server/modules/components/controllers/subEntityController.ts#listVesselMaintenanceHistory` | `server/modules/components/routes.ts:83` |
| GET | `/technical/api/component-maintenance-history/:componentId` | `requireAuth, asyncHandler(subCtrl.listMaintenanceHistory)` | `server/modules/components/controllers/subEntityController.ts#listMaintenanceHistory` | `server/modules/components/routes.ts:84` |
| GET | `/technical/api/component-maintenance-history/item/:id` | `requireAuth, asyncHandler(subCtrl.getMaintenanceHistoryItem)` | `server/modules/components/controllers/subEntityController.ts#getMaintenanceHistoryItem` | `server/modules/components/routes.ts:85` |
| GET | `/technical/api/equipment-categories` | `asyncHandler(subCtrl.listEquipmentCategories)` | `server/modules/components/controllers/subEntityController.ts#listEquipmentCategories` | `server/modules/components/routes.ts:89` |
| POST | `/technical/api/equipment-categories` | `asyncHandler(subCtrl.createEquipmentCategory)` | `server/modules/components/controllers/subEntityController.ts#createEquipmentCategory` | `server/modules/components/routes.ts:90` |
| PATCH | `/technical/api/equipment-categories/:id` | `asyncHandler(subCtrl.updateEquipmentCategory)` | `server/modules/components/controllers/subEntityController.ts#updateEquipmentCategory` | `server/modules/components/routes.ts:91` |
| DELETE | `/technical/api/equipment-categories/:id` | `asyncHandler(subCtrl.deleteEquipmentCategory)` | `server/modules/components/controllers/subEntityController.ts#deleteEquipmentCategory` | `server/modules/components/routes.ts:92` |

### A. jobs (12 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/jobs` | `asyncHandler(jobCtrl.listJobs)` | `server/modules/jobs/controllers/jobController.ts#listJobs` | `server/modules/jobs/routes.ts:17` |
| GET | `/technical/api/jobs/:id` | `asyncHandler(jobCtrl.getJob)` | `server/modules/jobs/controllers/jobController.ts#getJob` | `server/modules/jobs/routes.ts:20` |
| GET | `/technical/api/jobs/:id/context` | `asyncHandler(jobCtrl.getJobContext)` | `server/modules/jobs/controllers/jobController.ts#getJobContext` | `server/modules/jobs/routes.ts:23` |
| POST | `/technical/api/jobs` | `requirePermission('pms-modify-pms', 'create'), asyncHandler(jobCtrl.createJob)` | `server/modules/jobs/controllers/jobController.ts#createJob` | `server/modules/jobs/routes.ts:26` |
| PATCH | `/technical/api/jobs/:id` | `requirePermission('pms-modify-pms', 'edit'), asyncHandler(jobCtrl.updateJob)` | `server/modules/jobs/controllers/jobController.ts#updateJob` | `server/modules/jobs/routes.ts:29` |
| DELETE | `/technical/api/jobs/:id` | `requirePermission('pms-modify-pms', 'delete'), asyncHandler(jobCtrl.deleteJob)` | `server/modules/jobs/controllers/jobController.ts#deleteJob` | `server/modules/jobs/routes.ts:32` |
| POST | `/technical/api/jobs/:id/inactivate` | `requirePermission('pms-modify-pms', 'edit'), asyncHandler(jobCtrl.inactivateJob)` | `server/modules/jobs/controllers/jobController.ts#inactivateJob` | `server/modules/jobs/routes.ts:35` |
| POST | `/technical/api/jobs/:id/generate-wo` | `asyncHandler(jobCtrl.generateWorkOrder)` | `server/modules/jobs/controllers/jobController.ts#generateWorkOrder` | `server/modules/jobs/routes.ts:40` |
| POST | `/technical/api/jobs/:id/rebaseline-tracking` | `requirePermission('pms-modify-pms', 'edit'), asyncHandler(jobCtrl.rebaselineJobTracking)` | `server/modules/jobs/controllers/jobController.ts#rebaselineJobTracking` | `server/modules/jobs/routes.ts:46` |
| GET | `/technical/api/maintenance-planner` | `asyncHandler(jobCtrl.getMaintenancePlanner)` | `server/modules/jobs/controllers/jobController.ts#getMaintenancePlanner` | `server/modules/jobs/routes.ts:51` |
| GET | `/technical/api/maintenance-planner/export` | `asyncHandler(jobCtrl.exportMaintenancePlanner)` | `server/modules/jobs/controllers/jobController.ts#exportMaintenancePlanner` | `server/modules/jobs/routes.ts:54` |
| GET | `/technical/api/job-maintenance-history/:jobId` | `requireAuth, asyncHandler(jobCtrl.getJobMaintenanceHistory)` | `server/modules/jobs/controllers/jobController.ts#getJobMaintenanceHistory` | `server/modules/jobs/routes.ts:59` |

### A. work-orders (58 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/dashboard/compliance-anomalies` | `asyncHandler(woCtrl.getComplianceAnomalies)` | `server/modules/work-orders/controllers/workOrderController.ts#getComplianceAnomalies` | `server/modules/work-orders/routes.ts:35` |
| GET | `/technical/api/anomalies/dashboard` | `asyncHandler(woCtrl.getAnomaliesDashboard)` | `server/modules/work-orders/controllers/workOrderController.ts#getAnomaliesDashboard` | `server/modules/work-orders/routes.ts:40` |
| GET | `/technical/api/anomalies/statistics` | `asyncHandler(woCtrl.getAnomalyStatistics)` | `server/modules/work-orders/controllers/workOrderController.ts#getAnomalyStatistics` | `server/modules/work-orders/routes.ts:43` |
| PATCH | `/technical/api/anomalies/:anomalyId/acknowledge` | `asyncHandler(woCtrl.acknowledgeAnomaly)` | `server/modules/work-orders/controllers/workOrderController.ts#acknowledgeAnomaly` | `server/modules/work-orders/routes.ts:46` |
| GET | `/technical/api/anomalies/work-order/:workOrderId` | `asyncHandler(woCtrl.getAnomalyForWorkOrder)` | `server/modules/work-orders/controllers/workOrderController.ts#getAnomalyForWorkOrder` | `server/modules/work-orders/routes.ts:49` |
| GET | `/technical/api/work-orders/planner` | `asyncHandler(woCtrl.getPlannerData)` | `server/modules/work-orders/controllers/workOrderController.ts#getPlannerData` | `server/modules/work-orders/routes.ts:54` |
| PATCH | `/technical/api/work-orders/planner/planned-date` | `asyncHandler(woCtrl.savePlannedDate)` | `server/modules/work-orders/controllers/workOrderController.ts#savePlannedDate` | `server/modules/work-orders/routes.ts:57` |
| PATCH | `/technical/api/work-orders/planner/bulk-planned-date` | `asyncHandler(woCtrl.bulkSavePlannedDate)` | `server/modules/work-orders/controllers/workOrderController.ts#bulkSavePlannedDate` | `server/modules/work-orders/routes.ts:60` |
| GET | `/technical/api/work-orders/planner/export` | `asyncHandler(woCtrl.exportPlanner)` | `server/modules/work-orders/controllers/workOrderController.ts#exportPlanner` | `server/modules/work-orders/routes.ts:63` |
| POST | `/technical/api/work-orders/planner/export` | `asyncHandler(woCtrl.exportPlannerFromItems)` | `server/modules/work-orders/controllers/workOrderController.ts#exportPlannerFromItems` | `server/modules/work-orders/routes.ts:66` |
| GET | `/technical/api/approval-policy` | `asyncHandler(woCtrl.getApprovalPolicy)` | `server/modules/work-orders/controllers/workOrderController.ts#getApprovalPolicy` | `server/modules/work-orders/routes.ts:70` |
| PUT | `/technical/api/approval-policy` | `asyncHandler(woCtrl.updateApprovalPolicy)` | `server/modules/work-orders/controllers/workOrderController.ts#updateApprovalPolicy` | `server/modules/work-orders/routes.ts:73` |
| GET | `/technical/api/work-orders` | `asyncHandler(woCtrl.listWorkOrders)` | `server/modules/work-orders/controllers/workOrderController.ts#listWorkOrders` | `server/modules/work-orders/routes.ts:78` |
| GET | `/technical/api/work-orders/:id` | `asyncHandler(woCtrl.getWorkOrder)` | `server/modules/work-orders/controllers/workOrderController.ts#getWorkOrder` | `server/modules/work-orders/routes.ts:81` |
| GET | `/technical/api/work-orders/:id/context` | `asyncHandler(woCtrl.getWorkOrderContext)` | `server/modules/work-orders/controllers/workOrderController.ts#getWorkOrderContext` | `server/modules/work-orders/routes.ts:84` |
| GET | `/technical/api/work-orders/:id/rejection-history` | `asyncHandler(woCtrl.getRejectionHistory)` | `server/modules/work-orders/controllers/workOrderController.ts#getRejectionHistory` | `server/modules/work-orders/routes.ts:87` |
| POST | `/technical/api/work-orders/generate-now` | `asyncHandler(woCtrl.generateNow)` | `server/modules/work-orders/controllers/workOrderController.ts#generateNow` | `server/modules/work-orders/routes.ts:91` |
| GET | `/technical/api/work-orders/reconciler/status` | `asyncHandler(woCtrl.getReconcilerStatus)` | `server/modules/work-orders/controllers/workOrderController.ts#getReconcilerStatus` | `server/modules/work-orders/routes.ts:96` |
| POST | `/technical/api/work-orders/reconciler/run` | `asyncHandler(woCtrl.runReconcilerNow)` | `server/modules/work-orders/controllers/workOrderController.ts#runReconcilerNow` | `server/modules/work-orders/routes.ts:100` |
| POST | `/technical/api/work-orders` | `asyncHandler(woCtrl.createWorkOrder)` | `server/modules/work-orders/controllers/workOrderController.ts#createWorkOrder` | `server/modules/work-orders/routes.ts:103` |
| PATCH | `/technical/api/work-orders/:id` | `asyncHandler(woCtrl.updateWorkOrder)` | `server/modules/work-orders/controllers/workOrderController.ts#updateWorkOrder` | `server/modules/work-orders/routes.ts:106` |
| DELETE | `/technical/api/work-orders/:id` | `asyncHandler(woCtrl.deleteWorkOrder)` | `server/modules/work-orders/controllers/workOrderController.ts#deleteWorkOrder` | `server/modules/work-orders/routes.ts:109` |
| POST | `/technical/api/work-orders/:id/reviewer-approve` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.reviewerApprove)` | `server/modules/work-orders/controllers/workOrderController.ts#reviewerApprove` | `server/modules/work-orders/routes.ts:114` |
| POST | `/technical/api/work-orders/:id/reviewer-reopen` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.reviewerReopen)` | `server/modules/work-orders/controllers/workOrderController.ts#reviewerReopen` | `server/modules/work-orders/routes.ts:120` |
| POST | `/technical/api/work-orders/:id/reject-completion` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.rejectCompletion)` | `server/modules/work-orders/controllers/workOrderController.ts#rejectCompletion` | `server/modules/work-orders/routes.ts:126` |
| POST | `/technical/api/work-orders/:id/reopen-completion` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.reopenCompletion)` | `server/modules/work-orders/controllers/workOrderController.ts#reopenCompletion` | `server/modules/work-orders/routes.ts:132` |
| POST | `/technical/api/work-orders/bulk-superintendent-acknowledge` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.bulkSuperintendentAcknowledge)` | `server/modules/work-orders/controllers/workOrderController.ts#bulkSuperintendentAcknowledge` | `server/modules/work-orders/routes.ts:142` |
| POST | `/technical/api/work-orders/:id/superintendent-acknowledge` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.superintendentAcknowledge)` | `server/modules/work-orders/controllers/workOrderController.ts#superintendentAcknowledge` | `server/modules/work-orders/routes.ts:148` |
| GET | `/technical/api/superintendent/notifications` | `asyncHandler(woCtrl.getSuperintendentNotifications)` | `server/modules/work-orders/controllers/workOrderController.ts#getSuperintendentNotifications` | `server/modules/work-orders/routes.ts:154` |
| GET | `/technical/api/superintendent/notifications/all` | `asyncHandler(woCtrl.getAllSuperintendentNotifications)` | `server/modules/work-orders/controllers/workOrderController.ts#getAllSuperintendentNotifications` | `server/modules/work-orders/routes.ts:157` |
| GET | `/technical/api/superintendent/notifications/summary` | `asyncHandler(woCtrl.getSuperintendentNotificationsSummary)` | `server/modules/work-orders/controllers/workOrderController.ts#getSuperintendentNotificationsSummary` | `server/modules/work-orders/routes.ts:160` |
| POST | `/technical/api/work-orders/:id/complete` | `asyncHandler(woCtrl.completeWorkOrder)` | `server/modules/work-orders/controllers/workOrderController.ts#completeWorkOrder` | `server/modules/work-orders/routes.ts:165` |
| POST | `/technical/api/work-orders/bulk-approve` | `asyncHandler(woCtrl.bulkApprove)` | `server/modules/work-orders/controllers/workOrderController.ts#bulkApprove` | `server/modules/work-orders/routes.ts:170` |
| POST | `/technical/api/work-orders/bulk-reject` | `asyncHandler(woCtrl.bulkReject)` | `server/modules/work-orders/controllers/workOrderController.ts#bulkReject` | `server/modules/work-orders/routes.ts:173` |
| POST | `/technical/api/work-orders/auto-generate` | `asyncHandler(woCtrl.autoGenerate)` | `server/modules/work-orders/controllers/workOrderController.ts#autoGenerate` | `server/modules/work-orders/routes.ts:178` |
| POST | `/technical/api/work-orders/backfill-job-ids` | `asyncHandler(woCtrl.backfillJobIds)` | `server/modules/work-orders/controllers/workOrderController.ts#backfillJobIds` | `server/modules/work-orders/routes.ts:181` |
| POST | `/technical/api/work-orders/:id/overdue-reason` | `asyncHandler(woCtrl.saveOverdueReason)` | `server/modules/work-orders/controllers/workOrderController.ts#saveOverdueReason` | `server/modules/work-orders/routes.ts:186` |
| POST | `/technical/api/work-orders/recalculate-statuses` | `asyncHandler(woCtrl.recalculateStatuses)` | `server/modules/work-orders/controllers/workOrderController.ts#recalculateStatuses` | `server/modules/work-orders/routes.ts:191` |
| POST | `/technical/api/work-orders/check-postponements` | `asyncHandler(woCtrl.checkPostponements)` | `server/modules/work-orders/controllers/workOrderController.ts#checkPostponements` | `server/modules/work-orders/routes.ts:194` |
| POST | `/technical/api/work-orders/:id/postpone-request` | `asyncHandler(woCtrl.submitPostponeRequest)` | `server/modules/work-orders/controllers/workOrderController.ts#submitPostponeRequest` | `server/modules/work-orders/routes.ts:199` |
| PUT | `/technical/api/work-orders/:id/postpone-request` | `asyncHandler(woCtrl.editPostponeRequest)` | `server/modules/work-orders/controllers/workOrderController.ts#editPostponeRequest` | `server/modules/work-orders/routes.ts:202` |
| POST | `/technical/api/work-orders/:id/postpone-approve` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.approvePostponement)` | `server/modules/work-orders/controllers/workOrderController.ts#approvePostponement` | `server/modules/work-orders/routes.ts:205` |
| POST | `/technical/api/work-orders/:id/postpone-reject` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.rejectPostponement)` | `server/modules/work-orders/controllers/workOrderController.ts#rejectPostponement` | `server/modules/work-orders/routes.ts:211` |
| GET | `/technical/api/work-orders/:id/postpone-approval-steps` | `asyncHandler(woCtrl.getPostponementApprovalSteps)` | `server/modules/work-orders/controllers/workOrderController.ts#getPostponementApprovalSteps` | `server/modules/work-orders/routes.ts:217` |
| POST | `/technical/api/work-orders/:id/re-postpone-request` | `asyncHandler(woCtrl.submitRePostponeRequest)` | `server/modules/work-orders/controllers/workOrderController.ts#submitRePostponeRequest` | `server/modules/work-orders/routes.ts:222` |
| PUT | `/technical/api/work-orders/:id/re-postpone-request` | `asyncHandler(woCtrl.editRePostponeRequest)` | `server/modules/work-orders/controllers/workOrderController.ts#editRePostponeRequest` | `server/modules/work-orders/routes.ts:225` |
| POST | `/technical/api/work-orders/:id/re-postpone-approve` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.approveRePostponement)` | `server/modules/work-orders/controllers/workOrderController.ts#approveRePostponement` | `server/modules/work-orders/routes.ts:228` |
| POST | `/technical/api/work-orders/:id/re-postpone-reject` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), asyncHandler(woCtrl.rejectRePostponement)` | `server/modules/work-orders/controllers/workOrderController.ts#rejectRePostponement` | `server/modules/work-orders/routes.ts:234` |
| GET | `/technical/api/work-orders/:id/re-postpone-approval-steps` | `asyncHandler(woCtrl.getRePostponementApprovalSteps)` | `server/modules/work-orders/controllers/workOrderController.ts#getRePostponementApprovalSteps` | `server/modules/work-orders/routes.ts:240` |
| GET | `/technical/api/work-order-executions/:componentId` | `asyncHandler(woCtrl.getExecutions)` | `server/modules/work-orders/controllers/workOrderController.ts#getExecutions` | `server/modules/work-orders/routes.ts:245` |
| GET | `/technical/api/work-order-executions/details/:id` | `asyncHandler(woCtrl.getExecution)` | `server/modules/work-orders/controllers/workOrderController.ts#getExecution` | `server/modules/work-orders/routes.ts:248` |
| POST | `/technical/api/work-order-executions` | `asyncHandler(woCtrl.createExecution)` | `server/modules/work-orders/controllers/workOrderController.ts#createExecution` | `server/modules/work-orders/routes.ts:251` |
| PATCH | `/technical/api/work-order-executions/:id` | `asyncHandler(woCtrl.updateExecution)` | `server/modules/work-orders/controllers/workOrderController.ts#updateExecution` | `server/modules/work-orders/routes.ts:254` |
| GET | `/technical/api/work-orders/:workOrderId/documents` | `asyncHandler(woDocCtrl.listDocuments)` | `server/modules/work-orders/controllers/woDocumentController.ts#listDocuments` | `server/modules/work-orders/routes.ts:259` |
| POST | `/technical/api/work-orders/:workOrderId/documents` | `upload.single('file'), asyncHandler(woDocCtrl.uploadDocument)` | `server/modules/work-orders/controllers/woDocumentController.ts#uploadDocument` | `server/modules/work-orders/routes.ts:262` |
| GET | `/technical/api/work-order-documents/:documentId/download` | `asyncHandler(woDocCtrl.downloadDocument)` | `server/modules/work-orders/controllers/woDocumentController.ts#downloadDocument` | `server/modules/work-orders/routes.ts:265` |
| DELETE | `/technical/api/work-order-documents/:documentId` | `asyncHandler(woDocCtrl.deleteDocument)` | `server/modules/work-orders/controllers/woDocumentController.ts#deleteDocument` | `server/modules/work-orders/routes.ts:268` |
| GET | `/technical/api/scoped-operation-data/:vesselId` | `asyncHandler(woCtrl.getScopedOperationData)` | `server/modules/work-orders/controllers/workOrderController.ts#getScopedOperationData` | `server/modules/work-orders/routes.ts:271` |

### A. running-hours (20 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/running-hours/history` | `requireAuth, asyncHandler(rhCtrl.getHistory)` | `server/modules/running-hours/controllers/runningHoursController.ts#getHistory` | `server/modules/running-hours/routes.ts:15` |
| GET | `/technical/api/running-hours/history/export` | `requireAuth, asyncHandler(rhCtrl.exportHistory)` | `server/modules/running-hours/controllers/runningHoursController.ts#exportHistory` | `server/modules/running-hours/routes.ts:16` |
| GET | `/technical/api/running-hours/valid-range` | `requireAuth, asyncHandler(rhCtrl.getValidRange)` | `server/modules/running-hours/controllers/runningHoursController.ts#getValidRange` | `server/modules/running-hours/routes.ts:21` |
| POST | `/technical/api/running-hours/validate` | `requireAuth, asyncHandler(rhCtrl.validateRHEntry)` | `server/modules/running-hours/controllers/runningHoursController.ts#validateRHEntry` | `server/modules/running-hours/routes.ts:24` |
| GET | `/technical/api/running-hours/timeline` | `requireAuth, asyncHandler(rhCtrl.getRHTimeline)` | `server/modules/running-hours/controllers/runningHoursController.ts#getRHTimeline` | `server/modules/running-hours/routes.ts:27` |
| GET | `/technical/api/running-hours/current` | `requireAuth, asyncHandler(rhCtrl.getCurrentRH)` | `server/modules/running-hours/controllers/runningHoursController.ts#getCurrentRH` | `server/modules/running-hours/routes.ts:30` |
| GET | `/technical/api/running-hours/parents` | `requireAuth, asyncHandler(rhCtrl.listParents)` | `server/modules/running-hours/controllers/runningHoursController.ts#listParents` | `server/modules/running-hours/routes.ts:35` |
| GET | `/technical/api/running-hours/children/:parentCode` | `requireAuth, asyncHandler(rhCtrl.listChildren)` | `server/modules/running-hours/controllers/runningHoursController.ts#listChildren` | `server/modules/running-hours/routes.ts:38` |
| PUT | `/technical/api/running-hours/child/:componentId` | `requirePMSAdmin, asyncHandler(rhCtrl.updateChildRH)` | `server/modules/running-hours/controllers/runningHoursController.ts#updateChildRH` | `server/modules/running-hours/routes.ts:41` |
| POST | `/technical/api/running-hours` | `requirePMSAdmin, asyncHandler(rhCtrl.createAudit)` | `server/modules/running-hours/controllers/runningHoursController.ts#createAudit` | `server/modules/running-hours/routes.ts:44` |
| POST | `/technical/api/running-hours/cascade` | `requirePMSAdmin, asyncHandler(rhCtrl.cascadeUpdate)` | `server/modules/running-hours/controllers/runningHoursController.ts#cascadeUpdate` | `server/modules/running-hours/routes.ts:47` |
| POST | `/technical/api/running-hours/reset-child/:componentId` | `requirePMSAdmin, asyncHandler(rhCtrl.resetChildRH)` | `server/modules/running-hours/controllers/runningHoursController.ts#resetChildRH` | `server/modules/running-hours/routes.ts:50` |
| POST | `/technical/api/running-hours/propagate-all` | `requirePMSAdmin, asyncHandler(rhCtrl.propagateAll)` | `server/modules/running-hours/controllers/runningHoursController.ts#propagateAll` | `server/modules/running-hours/routes.ts:53` |
| GET | `/technical/api/running-hours/replacement-history/:componentId` | `requireAuth, asyncHandler(rhCtrl.getMeterReplacementHistory)` | `server/modules/running-hours/controllers/runningHoursController.ts#getMeterReplacementHistory` | `server/modules/running-hours/routes.ts:56` |
| GET | `/technical/api/running-hours/:componentId` | `requireAuth, asyncHandler(rhCtrl.getAudits)` | `server/modules/running-hours/controllers/runningHoursController.ts#getAudits` | `server/modules/running-hours/routes.ts:59` |
| GET | `/technical/api/rh-config/master-components/:vesselId` | `requireAuth, asyncHandler(rhCtrl.listMasterComponents)` | `server/modules/running-hours/controllers/runningHoursController.ts#listMasterComponents` | `server/modules/running-hours/routes.ts:64` |
| GET | `/technical/api/rh-config/inherited/:masterComponentId` | `requireAuth, asyncHandler(rhCtrl.listInheritedComponents)` | `server/modules/running-hours/controllers/runningHoursController.ts#listInheritedComponents` | `server/modules/running-hours/routes.ts:67` |
| PUT | `/technical/api/rh-config/master/:componentId` | `requirePMSAdmin, asyncHandler(rhCtrl.updateMasterRH)` | `server/modules/running-hours/controllers/runningHoursController.ts#updateMasterRH` | `server/modules/running-hours/routes.ts:70` |
| GET | `/technical/api/rh-config/:componentId` | `requireAuth, asyncHandler(rhCtrl.getRHConfig)` | `server/modules/running-hours/controllers/runningHoursController.ts#getRHConfig` | `server/modules/running-hours/routes.ts:73` |
| PUT | `/technical/api/rh-config/:componentId` | `requirePMSAdmin, asyncHandler(rhCtrl.updateRHConfig)` | `server/modules/running-hours/controllers/runningHoursController.ts#updateRHConfig` | `server/modules/running-hours/routes.ts:76` |

### A. spares (40 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/spares` | `requireAuth, asyncHandler(sparesCtrl.getAllSpares)` | `server/modules/spares/controllers/sparesController.ts#getAllSpares` | `server/modules/spares/routes.ts:19` |
| GET | `/technical/api/spares/history/:vesselId` | `requireAuth, asyncHandler(sparesCtrl.getSpareHistoryByVessel)` | `server/modules/spares/controllers/sparesController.ts#getSpareHistoryByVessel` | `server/modules/spares/routes.ts:22` |
| POST | `/technical/api/spares/bulk-update` | `requirePMSAdmin, asyncHandler(sparesCtrl.bulkUpdate)` | `server/modules/spares/controllers/sparesController.ts#bulkUpdate` | `server/modules/spares/routes.ts:25` |
| POST | `/technical/api/spares/:id/consume` | `requirePMSAdmin, asyncHandler(sparesCtrl.consumeSimple)` | `server/modules/spares/controllers/sparesController.ts#consumeSimple` | `server/modules/spares/routes.ts:30` |
| POST | `/technical/api/spares/:id/receive` | `requirePMSAdmin, asyncHandler(sparesCtrl.receiveSimple)` | `server/modules/spares/controllers/sparesController.ts#receiveSimple` | `server/modules/spares/routes.ts:33` |
| POST | `/technical/api/spares/:id/consume-from-location` | `requirePMSAdmin, asyncHandler(sparesCtrl.consumeFromLocation)` | `server/modules/spares/controllers/sparesController.ts#consumeFromLocation` | `server/modules/spares/routes.ts:36` |
| POST | `/technical/api/spares/:id/receive-to-location` | `requirePMSAdmin, asyncHandler(sparesCtrl.receiveToLocation)` | `server/modules/spares/controllers/sparesController.ts#receiveToLocation` | `server/modules/spares/routes.ts:39` |
| POST | `/technical/api/spares/:vesselId/batch-consume` | `requirePMSAdmin, asyncHandler(sparesCtrl.batchConsume)` | `server/modules/spares/controllers/sparesController.ts#batchConsume` | `server/modules/spares/routes.ts:44` |
| POST | `/technical/api/spares/:vesselId/batch-receive` | `requirePMSAdmin, asyncHandler(sparesCtrl.batchReceive)` | `server/modules/spares/controllers/sparesController.ts#batchReceive` | `server/modules/spares/routes.ts:47` |
| GET | `/technical/api/spares/:vesselId/history` | `requireAuth, asyncHandler(sparesCtrl.getSpareHistoryLegacy)` | `server/modules/spares/controllers/sparesController.ts#getSpareHistoryLegacy` | `server/modules/spares/routes.ts:52` |
| GET | `/technical/api/spares/:vesselId/low-stock` | `requireAuth, asyncHandler(sparesCtrl.getLowStockSpares)` | `server/modules/spares/controllers/sparesController.ts#getLowStockSpares` | `server/modules/spares/routes.ts:55` |
| POST | `/technical/api/spares/:vesselId/:id/inactivate` | `requirePMSAdmin, asyncHandler(sparesCtrl.inactivateSpare)` | `server/modules/spares/controllers/sparesController.ts#inactivateSpare` | `server/modules/spares/routes.ts:58` |
| POST | `/technical/api/spares/:vesselId/:id/adjustment` | `requirePMSAdmin, asyncHandler(sparesCtrl.adjustSpareAtLocation)` | `server/modules/spares/controllers/sparesController.ts#adjustSpareAtLocation` | `server/modules/spares/routes.ts:61` |
| POST | `/technical/api/spares/:vesselId/:id/adjust` | `requirePMSAdmin, asyncHandler(sparesCtrl.adjustSpareQuantity)` | `server/modules/spares/controllers/sparesController.ts#adjustSpareQuantity` | `server/modules/spares/routes.ts:64` |
| GET | `/technical/api/spares/:vesselId/:id` | `requireAuth, asyncHandler(sparesCtrl.getSpareById)` | `server/modules/spares/controllers/sparesController.ts#getSpareById` | `server/modules/spares/routes.ts:69` |
| POST | `/technical/api/spares/:vesselId` | `requirePMSAdmin, asyncHandler(sparesCtrl.createSpare)` | `server/modules/spares/controllers/sparesController.ts#createSpare` | `server/modules/spares/routes.ts:72` |
| PATCH | `/technical/api/spares/:vesselId/:id` | `requirePMSAdmin, asyncHandler(sparesCtrl.updateSpare)` | `server/modules/spares/controllers/sparesController.ts#updateSpare` | `server/modules/spares/routes.ts:75` |
| DELETE | `/technical/api/spares/:vesselId/:id` | `requirePermission('pms-spares', 'delete', { enforce: true, unconfigured: 'deny' }), asyncHandler(sparesCtrl.deleteSpare)` | `server/modules/spares/controllers/sparesController.ts#deleteSpare` | `server/modules/spares/routes.ts:78` |
| GET | `/technical/api/spares/:vesselId` | `requireAuth, asyncHandler(sparesCtrl.getSparesByVessel)` | `server/modules/spares/controllers/sparesController.ts#getSparesByVessel` | `server/modules/spares/routes.ts:85` |
| GET | `/technical/api/inventory/locations/:vesselId` | `requireAuth, asyncHandler(invCtrl.getLocations)` | `server/modules/spares/controllers/inventoryController.ts#getLocations` | `server/modules/spares/routes.ts:93` |
| GET | `/technical/api/inventory/locations/:vesselId/:id` | `requireAuth, asyncHandler(invCtrl.getLocationById)` | `server/modules/spares/controllers/inventoryController.ts#getLocationById` | `server/modules/spares/routes.ts:94` |
| POST | `/technical/api/inventory/locations/:vesselId` | `requirePMSAdmin, asyncHandler(invCtrl.createLocation)` | `server/modules/spares/controllers/inventoryController.ts#createLocation` | `server/modules/spares/routes.ts:95` |
| POST | `/technical/api/inventory/reconcile/:vesselId` | `requirePMSAdmin, asyncHandler(invCtrl.reconcile as any)` | `server/modules/spares/controllers/inventoryController.ts#reconcile` | `server/modules/spares/routes.ts:99` |
| GET | `/technical/api/inventory/spare-links/by-spare/:spareId` | `requireAuth, asyncHandler(invCtrl.getSpareLinksBySpare)` | `server/modules/spares/controllers/inventoryController.ts#getSpareLinksBySpare` | `server/modules/spares/routes.ts:103` |
| GET | `/technical/api/inventory/spare-links/by-component/:componentId` | `requireAuth, asyncHandler(invCtrl.getSpareLinksByComponent)` | `server/modules/spares/controllers/inventoryController.ts#getSpareLinksByComponent` | `server/modules/spares/routes.ts:104` |
| GET | `/technical/api/inventory/spare-links/:vesselId` | `requireAuth, asyncHandler(invCtrl.getSpareLinks)` | `server/modules/spares/controllers/inventoryController.ts#getSpareLinks` | `server/modules/spares/routes.ts:105` |
| POST | `/technical/api/inventory/spare-links` | `requirePMSAdmin, asyncHandler(invCtrl.createSpareLink)` | `server/modules/spares/controllers/inventoryController.ts#createSpareLink` | `server/modules/spares/routes.ts:106` |
| DELETE | `/technical/api/inventory/spare-links/:spareId/:componentId` | `requirePMSAdmin, asyncHandler(invCtrl.deleteSpareLink)` | `server/modules/spares/controllers/inventoryController.ts#deleteSpareLink` | `server/modules/spares/routes.ts:107` |
| GET | `/technical/api/inventory/stock/by-location/:locationId` | `requireAuth, asyncHandler(invCtrl.getSparesAtLocation)` | `server/modules/spares/controllers/inventoryController.ts#getSparesAtLocation` | `server/modules/spares/routes.ts:111` |
| GET | `/technical/api/inventory/stock/locations-with-stock/:vesselId` | `requireAuth, asyncHandler(invCtrl.getLocationsWithStock)` | `server/modules/spares/controllers/inventoryController.ts#getLocationsWithStock` | `server/modules/spares/routes.ts:112` |
| GET | `/technical/api/inventory/stock/full-by-location/:vesselId/:locationId` | `requireAuth, asyncHandler(invCtrl.getFullSparesAtLocation)` | `server/modules/spares/controllers/inventoryController.ts#getFullSparesAtLocation` | `server/modules/spares/routes.ts:113` |
| GET | `/technical/api/inventory/stock/:spareId` | `requireAuth, asyncHandler(invCtrl.getSpareStock)` | `server/modules/spares/controllers/inventoryController.ts#getSpareStock` | `server/modules/spares/routes.ts:114` |
| POST | `/technical/api/inventory/stock/:spareId/:locationId` | `requirePMSAdmin, asyncHandler(invCtrl.upsertStock)` | `server/modules/spares/controllers/inventoryController.ts#upsertStock` | `server/modules/spares/routes.ts:115` |
| POST | `/technical/api/inventory/transactions` | `requirePMSAdmin, asyncHandler(invCtrl.createTransaction)` | `server/modules/spares/controllers/inventoryController.ts#createTransaction` | `server/modules/spares/routes.ts:119` |
| GET | `/technical/api/inventory/transactions/:vesselId` | `requireAuth, asyncHandler(invCtrl.getTransactions)` | `server/modules/spares/controllers/inventoryController.ts#getTransactions` | `server/modules/spares/routes.ts:120` |
| POST | `/technical/api/inventory/backfill-sibling-links/:vesselId` | `requirePMSAdmin, asyncHandler(invCtrl.backfillSiblingLinks)` | `server/modules/spares/controllers/inventoryController.ts#backfillSiblingLinks` | `server/modules/spares/routes.ts:124` |
| GET | `/technical/api/inventory/spares-with-inventory/:vesselId` | `requireAuth, asyncHandler(invCtrl.getSparesWithInventory)` | `server/modules/spares/controllers/inventoryController.ts#getSparesWithInventory` | `server/modules/spares/routes.ts:128` |
| GET | `/technical/api/inventory/spare-with-inventory/:spareId` | `requireAuth, asyncHandler(invCtrl.getSpareWithInventory)` | `server/modules/spares/controllers/inventoryController.ts#getSpareWithInventory` | `server/modules/spares/routes.ts:129` |
| GET | `/technical/api/inventory/spares-by-component/:componentId` | `requireAuth, asyncHandler(invCtrl.getSparesByComponent)` | `server/modules/spares/controllers/inventoryController.ts#getSparesByComponent` | `server/modules/spares/routes.ts:130` |
| GET | `/technical/api/inventory/spares-by-component-code/:vesselId/:componentCode` | `requireAuth, asyncHandler(invCtrl.getSparesByComponentCode)` | `server/modules/spares/controllers/inventoryController.ts#getSparesByComponentCode` | `server/modules/spares/routes.ts:131` |

### A. stores (12 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/stores` | `requireAuth, asyncHandler(storesCtrl.getAllStores)` | `server/modules/stores/controllers/storesController.ts#getAllStores` | `server/modules/stores/routes.ts:17` |
| GET | `/technical/api/stores/item/:id/history` | `requireAuth, asyncHandler(storesCtrl.getItemHistory)` | `server/modules/stores/controllers/storesController.ts#getItemHistory` | `server/modules/stores/routes.ts:22` |
| PUT | `/technical/api/stores/item/:id` | `requirePMSAdmin, asyncHandler(storesCtrl.updateStoresItem as any)` | `server/modules/stores/controllers/storesController.ts#updateStoresItem` | `server/modules/stores/routes.ts:25` |
| POST | `/technical/api/stores/item/:id/adjust` | `requirePMSAdmin, asyncHandler(storesCtrl.adjustStoresItem as any)` | `server/modules/stores/controllers/storesController.ts#adjustStoresItem` | `server/modules/stores/routes.ts:28` |
| DELETE | `/technical/api/stores/item/:id` | `requirePMSAdmin, asyncHandler(storesCtrl.deleteStoresItem as any)` | `server/modules/stores/controllers/storesController.ts#deleteStoresItem` | `server/modules/stores/routes.ts:31` |
| GET | `/technical/api/stores/:vesselId/history` | `requireAuth, asyncHandler(storesCtrl.getTransactionHistory)` | `server/modules/stores/controllers/storesController.ts#getTransactionHistory` | `server/modules/stores/routes.ts:36` |
| POST | `/technical/api/stores/:vesselId/create` | `requirePMSAdmin, asyncHandler(storesCtrl.createStoresItem as any)` | `server/modules/stores/controllers/storesController.ts#createStoresItem` | `server/modules/stores/routes.ts:39` |
| POST | `/technical/api/stores/:vesselId/:id/inactivate` | `requirePMSAdmin, asyncHandler(storesCtrl.inactivateStoresItem as any)` | `server/modules/stores/controllers/storesController.ts#inactivateStoresItem` | `server/modules/stores/routes.ts:42` |
| POST | `/technical/api/stores/:vesselId/batch-consume` | `requirePMSAdmin, asyncHandler(storesCtrl.batchConsume as any)` | `server/modules/stores/controllers/storesController.ts#batchConsume` | `server/modules/stores/routes.ts:45` |
| POST | `/technical/api/stores/:vesselId/batch-receive` | `requirePMSAdmin, asyncHandler(storesCtrl.batchReceive as any)` | `server/modules/stores/controllers/storesController.ts#batchReceive` | `server/modules/stores/routes.ts:48` |
| PATCH | `/technical/api/stores/:vesselId/:id` | `requirePMSAdmin, asyncHandler(storesCtrl.patchStoresItem as any)` | `server/modules/stores/controllers/storesController.ts#patchStoresItem` | `server/modules/stores/routes.ts:51` |
| GET | `/technical/api/stores/:vesselId` | `requireAuth, asyncHandler(storesCtrl.getStoresByVessel)` | `server/modules/stores/controllers/storesController.ts#getStoresByVessel` | `server/modules/stores/routes.ts:56` |

### A. fleet (35 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| POST | `/technical/api/fleet/components/sort-order` | `requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateComponentSortOrder)` | `server/modules/fleet/controllers/fleetController.ts#updateComponentSortOrder` | `server/modules/fleet/routes.ts:29` |
| GET | `/technical/api/fleet/components` | `asyncHandler(fleetCtrl.getFleetScopedComponents)` | `server/modules/fleet/controllers/fleetController.ts#getFleetScopedComponents` | `server/modules/fleet/routes.ts:30` |
| GET | `/technical/api/fleet/components/:id` | `asyncHandler(fleetCtrl.getFleetScopedComponent)` | `server/modules/fleet/controllers/fleetController.ts#getFleetScopedComponent` | `server/modules/fleet/routes.ts:31` |
| POST | `/technical/api/fleet/components` | `requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetScopedComponent)` | `server/modules/fleet/controllers/fleetController.ts#createFleetScopedComponent` | `server/modules/fleet/routes.ts:32` |
| PATCH | `/technical/api/fleet/components/:id` | `requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateFleetScopedComponent)` | `server/modules/fleet/controllers/fleetController.ts#updateFleetScopedComponent` | `server/modules/fleet/routes.ts:33` |
| GET | `/technical/api/fleet/jobs/export` | `asyncHandler(fleetCtrl.exportFleetJobs)` | `server/modules/fleet/controllers/fleetController.ts#exportFleetJobs` | `server/modules/fleet/routes.ts:40` |
| GET | `/technical/api/fleet/jobs` | `asyncHandler(fleetCtrl.getFleetJobs)` | `server/modules/fleet/controllers/fleetController.ts#getFleetJobs` | `server/modules/fleet/routes.ts:41` |
| GET | `/technical/api/fleet/jobs/:id` | `asyncHandler(fleetCtrl.getFleetJob)` | `server/modules/fleet/controllers/fleetController.ts#getFleetJob` | `server/modules/fleet/routes.ts:42` |
| POST | `/technical/api/fleet/jobs` | `requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetJob)` | `server/modules/fleet/controllers/fleetController.ts#createFleetJob` | `server/modules/fleet/routes.ts:43` |
| PATCH | `/technical/api/fleet/jobs/:id` | `requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateFleetJob)` | `server/modules/fleet/controllers/fleetController.ts#updateFleetJob` | `server/modules/fleet/routes.ts:44` |
| DELETE | `/technical/api/fleet/jobs/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteFleetJob)` | `server/modules/fleet/controllers/fleetController.ts#deleteFleetJob` | `server/modules/fleet/routes.ts:45` |
| GET | `/technical/api/fleet/spares/export` | `asyncHandler(fleetCtrl.exportFleetSpares)` | `server/modules/fleet/controllers/fleetController.ts#exportFleetSpares` | `server/modules/fleet/routes.ts:49` |
| GET | `/technical/api/fleet/spares` | `asyncHandler(fleetCtrl.getFleetSpares)` | `server/modules/fleet/controllers/fleetController.ts#getFleetSpares` | `server/modules/fleet/routes.ts:50` |
| GET | `/technical/api/fleet/spares/:id` | `asyncHandler(fleetCtrl.getFleetSpare)` | `server/modules/fleet/controllers/fleetController.ts#getFleetSpare` | `server/modules/fleet/routes.ts:51` |
| POST | `/technical/api/fleet/spares` | `requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetSpare)` | `server/modules/fleet/controllers/fleetController.ts#createFleetSpare` | `server/modules/fleet/routes.ts:52` |
| PATCH | `/technical/api/fleet/spares/:id` | `requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateFleetSpare)` | `server/modules/fleet/controllers/fleetController.ts#updateFleetSpare` | `server/modules/fleet/routes.ts:53` |
| DELETE | `/technical/api/fleet/spares/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteFleetSpare)` | `server/modules/fleet/controllers/fleetController.ts#deleteFleetSpare` | `server/modules/fleet/routes.ts:54` |
| GET | `/technical/api/fleet/makers` | `asyncHandler(fleetCtrl.getMakers)` | `server/modules/fleet/controllers/fleetController.ts#getMakers` | `server/modules/fleet/routes.ts:57` |
| GET | `/technical/api/fleet/makers/:id` | `asyncHandler(fleetCtrl.getMakerById)` | `server/modules/fleet/controllers/fleetController.ts#getMakerById` | `server/modules/fleet/routes.ts:58` |
| POST | `/technical/api/fleet/makers` | `requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createMaker)` | `server/modules/fleet/controllers/fleetController.ts#createMaker` | `server/modules/fleet/routes.ts:59` |
| PUT | `/technical/api/fleet/makers/:id` | `requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateMaker)` | `server/modules/fleet/controllers/fleetController.ts#updateMaker` | `server/modules/fleet/routes.ts:60` |
| DELETE | `/technical/api/fleet/makers/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteMaker)` | `server/modules/fleet/controllers/fleetController.ts#deleteMaker` | `server/modules/fleet/routes.ts:61` |
| GET | `/technical/api/fleet/master-lists` | `asyncHandler(fleetCtrl.getMasterLists)` | `server/modules/fleet/controllers/fleetController.ts#getMasterLists` | `server/modules/fleet/routes.ts:64` |
| GET | `/technical/api/fleet/master-lists/:id` | `asyncHandler(fleetCtrl.getMasterListById)` | `server/modules/fleet/controllers/fleetController.ts#getMasterListById` | `server/modules/fleet/routes.ts:65` |
| POST | `/technical/api/fleet/master-lists` | `requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createMasterList)` | `server/modules/fleet/controllers/fleetController.ts#createMasterList` | `server/modules/fleet/routes.ts:66` |
| PUT | `/technical/api/fleet/master-lists/:id` | `requirePermission('admin-masters', 'edit'), asyncHandler(fleetCtrl.updateMasterList)` | `server/modules/fleet/controllers/fleetController.ts#updateMasterList` | `server/modules/fleet/routes.ts:67` |
| DELETE | `/technical/api/fleet/master-lists/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteMasterList)` | `server/modules/fleet/controllers/fleetController.ts#deleteMasterList` | `server/modules/fleet/routes.ts:68` |
| GET | `/technical/api/fleet/master-list-types` | `asyncHandler(fleetCtrl.getMasterListTypes)` | `server/modules/fleet/controllers/fleetController.ts#getMasterListTypes` | `server/modules/fleet/routes.ts:71` |
| GET | `/technical/api/fleet/master-list-types/:id` | `asyncHandler(fleetCtrl.getMasterListTypeById)` | `server/modules/fleet/controllers/fleetController.ts#getMasterListTypeById` | `server/modules/fleet/routes.ts:72` |
| POST | `/technical/api/fleet/master-list-types` | `requireSailAdmin, asyncHandler(fleetCtrl.createMasterListType)` | `server/modules/fleet/controllers/fleetController.ts#createMasterListType` | `server/modules/fleet/routes.ts:73` |
| PUT | `/technical/api/fleet/master-list-types/:id` | `requireSailAdmin, asyncHandler(fleetCtrl.updateMasterListType)` | `server/modules/fleet/controllers/fleetController.ts#updateMasterListType` | `server/modules/fleet/routes.ts:74` |
| DELETE | `/technical/api/fleet/master-list-types/:id` | `requireSailAdmin, asyncHandler(fleetCtrl.deleteMasterListType)` | `server/modules/fleet/controllers/fleetController.ts#deleteMasterListType` | `server/modules/fleet/routes.ts:75` |
| GET | `/technical/api/fleet/vessel-mappings` | `asyncHandler(fleetCtrl.getFleetVesselMappings)` | `server/modules/fleet/controllers/fleetController.ts#getFleetVesselMappings` | `server/modules/fleet/routes.ts:78` |
| POST | `/technical/api/fleet/vessel-mappings` | `requirePermission('admin-masters', 'create'), asyncHandler(fleetCtrl.createFleetVesselMappings)` | `server/modules/fleet/controllers/fleetController.ts#createFleetVesselMappings` | `server/modules/fleet/routes.ts:79` |
| DELETE | `/technical/api/fleet/vessel-mappings/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(fleetCtrl.deleteFleetVesselMapping)` | `server/modules/fleet/controllers/fleetController.ts#deleteFleetVesselMapping` | `server/modules/fleet/routes.ts:80` |

### A. reports (60 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/reports/favorites` | `asyncHandler(favCtrl.getFavorites)` | `server/modules/reports/controllers/favoritesController.ts#getFavorites` | `server/modules/reports/routes.ts:22` |
| POST | `/technical/api/reports/favorites/:reportId` | `asyncHandler(favCtrl.addFavorite)` | `server/modules/reports/controllers/favoritesController.ts#addFavorite` | `server/modules/reports/routes.ts:23` |
| DELETE | `/technical/api/reports/favorites/:reportId` | `asyncHandler(favCtrl.removeFavorite)` | `server/modules/reports/controllers/favoritesController.ts#removeFavorite` | `server/modules/reports/routes.ts:24` |
| GET | `/technical/api/template-builder/:templateType` | `asyncHandler(equipCtrl.getTemplate)` | `server/modules/reports/controllers/equipmentReportsController.ts#getTemplate` | `server/modules/reports/routes.ts:27` |
| GET | `/technical/api/reports/critical-spares/preview` | `asyncHandler(sparesCtrl.getCriticalSparesPreview)` | `server/modules/reports/controllers/sparesReportsController.ts#getCriticalSparesPreview` | `server/modules/reports/routes.ts:30` |
| POST | `/technical/api/reports/critical-spares` | `asyncHandler(sparesCtrl.exportCriticalSparesExcel)` | `server/modules/reports/controllers/sparesReportsController.ts#exportCriticalSparesExcel` | `server/modules/reports/routes.ts:31` |
| GET | `/technical/api/reports/low-stock-alert/:vesselId` | `asyncHandler(sparesCtrl.getLowStockAlert)` | `server/modules/reports/controllers/sparesReportsController.ts#getLowStockAlert` | `server/modules/reports/routes.ts:32` |
| PATCH | `/technical/api/reports/low-stock-alert/:vesselId/mark-ordered/:spareId` | `asyncHandler(sparesCtrl.markSpareAsOrdered)` | `server/modules/reports/controllers/sparesReportsController.ts#markSpareAsOrdered` | `server/modules/reports/routes.ts:33` |
| POST | `/technical/api/reports/low-stock-alert/:vesselId/excel` | `asyncHandler(sparesCtrl.exportLowStockAlertExcel)` | `server/modules/reports/controllers/sparesReportsController.ts#exportLowStockAlertExcel` | `server/modules/reports/routes.ts:34` |
| GET | `/technical/api/reports/spares-consumption-analysis/:vesselId/component-names` | `asyncHandler(sparesCtrl.getSparesComponentNames)` | `server/modules/reports/controllers/sparesReportsController.ts#getSparesComponentNames` | `server/modules/reports/routes.ts:35` |
| GET | `/technical/api/reports/spares-consumption-analysis/:vesselId` | `asyncHandler(sparesCtrl.getSparesConsumptionAnalysis)` | `server/modules/reports/controllers/sparesReportsController.ts#getSparesConsumptionAnalysis` | `server/modules/reports/routes.ts:36` |
| POST | `/technical/api/reports/spares-consumption-analysis/:vesselId/excel` | `asyncHandler(sparesCtrl.exportSparesConsumptionExcel)` | `server/modules/reports/controllers/sparesReportsController.ts#exportSparesConsumptionExcel` | `server/modules/reports/routes.ts:37` |
| POST | `/technical/api/reports/stores-inventory-status/:vesselId/excel` | `asyncHandler(storesCtrl.exportStoresInventoryStatusExcel)` | `server/modules/reports/controllers/storesReportsController.ts#exportStoresInventoryStatusExcel` | `server/modules/reports/routes.ts:40` |
| GET | `/technical/api/reports/stores-consumption-analysis/:vesselId` | `asyncHandler(storesCtrl.getStoresConsumptionAnalysis)` | `server/modules/reports/controllers/storesReportsController.ts#getStoresConsumptionAnalysis` | `server/modules/reports/routes.ts:41` |
| POST | `/technical/api/reports/stores-consumption-analysis/:vesselId/excel` | `asyncHandler(storesCtrl.exportStoresConsumptionExcel)` | `server/modules/reports/controllers/storesReportsController.ts#exportStoresConsumptionExcel` | `server/modules/reports/routes.ts:42` |
| GET | `/technical/api/reports/consumption-analysis/:vesselId` | `asyncHandler(storesCtrl.getCombinedConsumptionAnalysis)` | `server/modules/reports/controllers/storesReportsController.ts#getCombinedConsumptionAnalysis` | `server/modules/reports/routes.ts:43` |
| POST | `/technical/api/reports/consumption-analysis/:vesselId/excel` | `asyncHandler(storesCtrl.exportCombinedConsumptionExcel)` | `server/modules/reports/controllers/storesReportsController.ts#exportCombinedConsumptionExcel` | `server/modules/reports/routes.ts:44` |
| GET | `/technical/api/reports/chemicals-expiry/:vesselId` | `asyncHandler(storesCtrl.getChemicalsExpiry)` | `server/modules/reports/controllers/storesReportsController.ts#getChemicalsExpiry` | `server/modules/reports/routes.ts:45` |
| GET | `/technical/api/reports/stores-low-stock-alert/:vesselId` | `asyncHandler(storesCtrl.getStoresLowStockAlert)` | `server/modules/reports/controllers/storesReportsController.ts#getStoresLowStockAlert` | `server/modules/reports/routes.ts:46` |
| POST | `/technical/api/reports/stores-low-stock-alert/:vesselId/excel` | `asyncHandler(storesCtrl.exportStoresLowStockAlertExcel)` | `server/modules/reports/controllers/storesReportsController.ts#exportStoresLowStockAlertExcel` | `server/modules/reports/routes.ts:47` |
| GET | `/technical/api/reports/critical-equipment-status` | `asyncHandler(equipCtrl.getCriticalEquipmentStatus)` | `server/modules/reports/controllers/equipmentReportsController.ts#getCriticalEquipmentStatus` | `server/modules/reports/routes.ts:50` |
| POST | `/technical/api/reports/critical-equipment-status/excel` | `asyncHandler(equipCtrl.exportCriticalEquipmentStatusExcel)` | `server/modules/reports/controllers/equipmentReportsController.ts#exportCriticalEquipmentStatusExcel` | `server/modules/reports/routes.ts:51` |
| GET | `/technical/api/reports/unplanned-breakdown-jobs` | `asyncHandler(equipCtrl.getUnplannedBreakdownJobs)` | `server/modules/reports/controllers/equipmentReportsController.ts#getUnplannedBreakdownJobs` | `server/modules/reports/routes.ts:52` |
| POST | `/technical/api/reports/unplanned-breakdown-jobs/excel` | `asyncHandler(equipCtrl.exportUnplannedBreakdownJobsExcel)` | `server/modules/reports/controllers/equipmentReportsController.ts#exportUnplannedBreakdownJobsExcel` | `server/modules/reports/routes.ts:53` |
| GET | `/technical/api/reports/critical-components-list` | `asyncHandler(equipCtrl.getCriticalComponentsList)` | `server/modules/reports/controllers/equipmentReportsController.ts#getCriticalComponentsList` | `server/modules/reports/routes.ts:54` |
| GET | `/technical/api/reports/lsa-ffa-master-list` | `asyncHandler(equipCtrl.getLsaFfaMasterList)` | `server/modules/reports/controllers/equipmentReportsController.ts#getLsaFfaMasterList` | `server/modules/reports/routes.ts:55` |
| GET | `/technical/api/reports/lsa-ffa-maintenance-schedule` | `asyncHandler(equipCtrl.getLsaFfaMaintenanceSchedule)` | `server/modules/reports/controllers/equipmentReportsController.ts#getLsaFfaMaintenanceSchedule` | `server/modules/reports/routes.ts:56` |
| GET | `/technical/api/reports/critical-equipment-schedule` | `asyncHandler(equipCtrl.getCriticalEquipmentSchedule)` | `server/modules/reports/controllers/equipmentReportsController.ts#getCriticalEquipmentSchedule` | `server/modules/reports/routes.ts:57` |
| GET | `/technical/api/reports/class-items-master-list` | `asyncHandler(equipCtrl.getClassItemsMasterList)` | `server/modules/reports/controllers/equipmentReportsController.ts#getClassItemsMasterList` | `server/modules/reports/routes.ts:58` |
| GET | `/technical/api/reports/class-items-jobs` | `asyncHandler(equipCtrl.getClassItemsJobsStatus)` | `server/modules/reports/controllers/equipmentReportsController.ts#getClassItemsJobsStatus` | `server/modules/reports/routes.ts:59` |
| GET | `/technical/api/reports/due-jobs-7-days/preview` | `asyncHandler(maintCtrl.getDueJobs7DaysPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getDueJobs7DaysPreview` | `server/modules/reports/routes.ts:62` |
| GET | `/technical/api/reports/overdue-jobs/preview` | `asyncHandler(maintCtrl.getOverdueJobsPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getOverdueJobsPreview` | `server/modules/reports/routes.ts:63` |
| GET | `/technical/api/reports/completed-jobs/preview` | `asyncHandler(maintCtrl.getCompletedJobsPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getCompletedJobsPreview` | `server/modules/reports/routes.ts:64` |
| GET | `/technical/api/reports/all-jobs/preview` | `asyncHandler(maintCtrl.getAllJobsPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getAllJobsPreview` | `server/modules/reports/routes.ts:65` |
| GET | `/technical/api/reports/postponement-log/preview` | `asyncHandler(maintCtrl.getPostponementLogPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getPostponementLogPreview` | `server/modules/reports/routes.ts:66` |
| POST | `/technical/api/reports/due-jobs-7-days` | `asyncHandler(maintCtrl.exportDueJobs7Days)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportDueJobs7Days` | `server/modules/reports/routes.ts:67` |
| POST | `/technical/api/reports/overdue-jobs` | `asyncHandler(maintCtrl.exportOverdueJobs)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportOverdueJobs` | `server/modules/reports/routes.ts:68` |
| POST | `/technical/api/reports/completed-jobs` | `asyncHandler(maintCtrl.exportCompletedJobs)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportCompletedJobs` | `server/modules/reports/routes.ts:69` |
| POST | `/technical/api/reports/all-jobs` | `asyncHandler(maintCtrl.exportAllJobs)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportAllJobs` | `server/modules/reports/routes.ts:70` |
| POST | `/technical/api/reports/unplanned-jobs` | `asyncHandler(maintCtrl.exportUnplannedJobs)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportUnplannedJobs` | `server/modules/reports/routes.ts:71` |
| POST | `/technical/api/reports/postponement-log` | `asyncHandler(maintCtrl.exportPostponementLog)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportPostponementLog` | `server/modules/reports/routes.ts:72` |
| GET | `/technical/api/reports/maintenance/work-order-overview/preview` | `asyncHandler(maintCtrl.getWorkOrderOverviewPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getWorkOrderOverviewPreview` | `server/modules/reports/routes.ts:73` |
| POST | `/technical/api/reports/maintenance/work-order-overview/excel` | `asyncHandler(maintCtrl.exportWorkOrderOverview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportWorkOrderOverview` | `server/modules/reports/routes.ts:74` |
| GET | `/technical/api/reports/maintenance/monthly-summary/preview` | `asyncHandler(maintCtrl.getMonthlySummaryPreview)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getMonthlySummaryPreview` | `server/modules/reports/routes.ts:75` |
| GET | `/technical/api/reports/maintenance/monthly-summary/snapshot-detail` | `asyncHandler(maintCtrl.getMonthlySummarySnapshotDetail)` | `server/modules/reports/controllers/maintenanceReportsController.ts#getMonthlySummarySnapshotDetail` | `server/modules/reports/routes.ts:76` |
| POST | `/technical/api/reports/maintenance/monthly-summary/regenerate` | `asyncHandler(maintCtrl.regenerateMonthlySummarySnapshots)` | `server/modules/reports/controllers/maintenanceReportsController.ts#regenerateMonthlySummarySnapshots` | `server/modules/reports/routes.ts:77` |
| POST | `/technical/api/reports/maintenance/monthly-summary/excel` | `asyncHandler(maintCtrl.exportMonthlySummary)` | `server/modules/reports/controllers/maintenanceReportsController.ts#exportMonthlySummary` | `server/modules/reports/routes.ts:78` |
| GET | `/technical/api/reports/crew-workload-distribution` | `asyncHandler(opsCtrl.getCrewWorkloadDistribution)` | `server/modules/reports/controllers/operationsReportsController.ts#getCrewWorkloadDistribution` | `server/modules/reports/routes.ts:81` |
| POST | `/technical/api/reports/crew-workload-distribution/excel` | `asyncHandler(opsCtrl.exportCrewWorkloadDistributionExcel)` | `server/modules/reports/controllers/operationsReportsController.ts#exportCrewWorkloadDistributionExcel` | `server/modules/reports/routes.ts:82` |
| GET | `/technical/api/reports/equipment-utilization-summary` | `asyncHandler(opsCtrl.getEquipmentUtilizationSummary)` | `server/modules/reports/controllers/operationsReportsController.ts#getEquipmentUtilizationSummary` | `server/modules/reports/routes.ts:83` |
| POST | `/technical/api/reports/equipment-utilization-summary/excel` | `asyncHandler(opsCtrl.exportEquipmentUtilizationSummaryExcel)` | `server/modules/reports/controllers/operationsReportsController.ts#exportEquipmentUtilizationSummaryExcel` | `server/modules/reports/routes.ts:84` |
| GET | `/technical/api/reports/running-hours-anomaly-detection` | `asyncHandler(compCtrl.getRunningHoursAnomalyDetection)` | `server/modules/reports/controllers/complianceReportsController.ts#getRunningHoursAnomalyDetection` | `server/modules/reports/routes.ts:87` |
| POST | `/technical/api/reports/running-hours-anomaly-detection/excel` | `asyncHandler(compCtrl.exportRunningHoursAnomalyDetectionExcel)` | `server/modules/reports/controllers/complianceReportsController.ts#exportRunningHoursAnomalyDetectionExcel` | `server/modules/reports/routes.ts:88` |
| GET | `/technical/api/reports/ihm-inventory-status` | `asyncHandler(compCtrl.getIhmInventoryStatus)` | `server/modules/reports/controllers/complianceReportsController.ts#getIhmInventoryStatus` | `server/modules/reports/routes.ts:89` |
| POST | `/technical/api/reports/ihm-inventory-status/excel` | `asyncHandler(compCtrl.exportIhmInventoryStatusExcel)` | `server/modules/reports/controllers/complianceReportsController.ts#exportIhmInventoryStatusExcel` | `server/modules/reports/routes.ts:90` |
| GET | `/technical/api/reports/change-requests-status-tracking` | `asyncHandler(crCtrl.getChangeRequestsStatusTracking)` | `server/modules/reports/controllers/changeRequestReportsController.ts#getChangeRequestsStatusTracking` | `server/modules/reports/routes.ts:93` |
| GET | `/technical/api/reports/change-requests-status-tracking/export` | `asyncHandler(crCtrl.exportChangeRequestsExcel)` | `server/modules/reports/controllers/changeRequestReportsController.ts#exportChangeRequestsExcel` | `server/modules/reports/routes.ts:94` |
| GET | `/technical/api/reports/snapshots/:vesselId` | `asyncHandler(snapCtrl.getSnapshots)` | `server/modules/reports/controllers/snapshotController.ts#getSnapshots` | `server/modules/reports/routes.ts:97` |
| GET | `/technical/api/reports/snapshots/detail/:snapshotId` | `asyncHandler(snapCtrl.getSnapshotDetail)` | `server/modules/reports/controllers/snapshotController.ts#getSnapshotDetail` | `server/modules/reports/routes.ts:98` |
| GET | `/technical/api/reports/:reportType` | `asyncHandler(snapCtrl.getGenericReport)` | `server/modules/reports/controllers/snapshotController.ts#getGenericReport` | `server/modules/reports/routes.ts:101` |

### A. change-requests (14 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/change-requests/field-definitions/:targetType` | `asyncHandler(crCtrl.getFieldDefinitions)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getFieldDefinitions` | `server/modules/change-requests/routes.ts:20` |
| GET | `/technical/api/change-requests/target-entity/:targetType/:targetId` | `asyncHandler(crCtrl.getTargetEntity)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getTargetEntity` | `server/modules/change-requests/routes.ts:21` |
| GET | `/technical/api/change-requests` | `asyncHandler(crCtrl.getChangeRequests)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getChangeRequests` | `server/modules/change-requests/routes.ts:24` |
| POST | `/technical/api/change-requests` | `requirePermission('change-requests', 'create'), asyncHandler(crCtrl.createChangeRequest)` | `server/modules/change-requests/controllers/changeRequestsController.ts#createChangeRequest` | `server/modules/change-requests/routes.ts:25` |
| PATCH | `/technical/api/change-requests/:id/status` | `requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.updateStatus)` | `server/modules/change-requests/controllers/changeRequestsController.ts#updateStatus` | `server/modules/change-requests/routes.ts:28` |
| GET | `/technical/api/change-requests/:id/approval-steps` | `asyncHandler(crCtrl.getApprovalSteps)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getApprovalSteps` | `server/modules/change-requests/routes.ts:29` |
| GET | `/technical/api/change-requests/:id/comments` | `asyncHandler(crCtrl.getComments)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getComments` | `server/modules/change-requests/routes.ts:30` |
| POST | `/technical/api/change-requests/:id/comments` | `requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.createComment)` | `server/modules/change-requests/controllers/changeRequestsController.ts#createComment` | `server/modules/change-requests/routes.ts:31` |
| GET | `/technical/api/change-requests/:id/attachments` | `asyncHandler(crCtrl.getAttachments)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getAttachments` | `server/modules/change-requests/routes.ts:32` |
| POST | `/technical/api/change-requests/:id/attachments` | `requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.createAttachment)` | `server/modules/change-requests/controllers/changeRequestsController.ts#createAttachment` | `server/modules/change-requests/routes.ts:33` |
| PUT | `/technical/api/change-requests/:id/approve` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.approveChangeRequest)` | `server/modules/change-requests/controllers/changeRequestsController.ts#approveChangeRequest` | `server/modules/change-requests/routes.ts:39` |
| PUT | `/technical/api/change-requests/:id/reject` | `requireRole(['Office', 'PMS Admin', 'Sail Admin']), requirePermission('change-requests', 'edit'), asyncHandler(crCtrl.rejectChangeRequest)` | `server/modules/change-requests/controllers/changeRequestsController.ts#rejectChangeRequest` | `server/modules/change-requests/routes.ts:40` |
| GET | `/technical/api/change-requests/:id/rejection-history` | `asyncHandler(crCtrl.getRejectionHistory)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getRejectionHistory` | `server/modules/change-requests/routes.ts:41` |
| GET | `/technical/api/change-requests/:id` | `asyncHandler(crCtrl.getChangeRequest)` | `server/modules/change-requests/controllers/changeRequestsController.ts#getChangeRequest` | `server/modules/change-requests/routes.ts:44` |

### A. bulk-upload (32 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/bulk/template` | `asyncHandler(ctrl.getTemplate)` | `server/modules/bulk-upload/controllers/bulkController.ts#getTemplate` | `server/modules/bulk-upload/routes.ts:25` |
| POST | `/technical/api/bulk/sheets` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.getSheets)` | `server/modules/bulk-upload/controllers/bulkController.ts#getSheets` | `server/modules/bulk-upload/routes.ts:26` |
| POST | `/technical/api/bulk/dry-run` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.dryRun)` | `server/modules/bulk-upload/controllers/bulkController.ts#dryRun` | `server/modules/bulk-upload/routes.ts:29` |
| POST | `/technical/api/bulk/import` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.doImport)` | `server/modules/bulk-upload/controllers/bulkController.ts#doImport` | `server/modules/bulk-upload/routes.ts:30` |
| POST | `/technical/api/bulk/import-stream` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.doImportStream)` | `server/modules/bulk-upload/controllers/bulkController.ts#doImportStream` | `server/modules/bulk-upload/routes.ts:31` |
| POST | `/technical/api/bulk/export-summary` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.exportSummary)` | `server/modules/bulk-upload/controllers/bulkController.ts#exportSummary` | `server/modules/bulk-upload/routes.ts:32` |
| GET | `/technical/api/bulk/history` | `asyncHandler(ctrl.getHistoryList)` | `server/modules/bulk-upload/controllers/bulkController.ts#getHistoryList` | `server/modules/bulk-upload/routes.ts:35` |
| GET | `/technical/api/bulk/import-status/:id` | `asyncHandler(ctrl.getImportStatus)` | `server/modules/bulk-upload/controllers/bulkController.ts#getImportStatus` | `server/modules/bulk-upload/routes.ts:36` |
| GET | `/technical/api/bulk/history/:id/download-original` | `asyncHandler(ctrl.downloadOriginal)` | `server/modules/bulk-upload/controllers/bulkController.ts#downloadOriginal` | `server/modules/bulk-upload/routes.ts:37` |
| GET | `/technical/api/bulk/history/:id/:fileType` | `asyncHandler(ctrl.getHistoryFileHandler)` | `server/modules/bulk-upload/controllers/bulkController.ts#getHistoryFileHandler` | `server/modules/bulk-upload/routes.ts:38` |
| POST | `/technical/api/bulk/undo/:historyId` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.undoImport)` | `server/modules/bulk-upload/controllers/bulkController.ts#undoImport` | `server/modules/bulk-upload/routes.ts:41` |
| GET | `/technical/api/bulk/makers/export` | `asyncHandler(ctrl.get_makers_export)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_makers_export` | `server/modules/bulk-upload/routes.ts:44` |
| GET | `/technical/api/bulk/makers` | `asyncHandler(ctrl.get_makers)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_makers` | `server/modules/bulk-upload/routes.ts:45` |
| GET | `/technical/api/bulk/makers/:id` | `asyncHandler(ctrl.get_makersByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_makersByid` | `server/modules/bulk-upload/routes.ts:46` |
| POST | `/technical/api/bulk/makers` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.post_makers)` | `server/modules/bulk-upload/controllers/bulkController.ts#post_makers` | `server/modules/bulk-upload/routes.ts:47` |
| PATCH | `/technical/api/bulk/makers/:id` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.patch_makersByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#patch_makersByid` | `server/modules/bulk-upload/routes.ts:48` |
| DELETE | `/technical/api/bulk/makers/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.delete_makersByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#delete_makersByid` | `server/modules/bulk-upload/routes.ts:49` |
| POST | `/technical/api/bulk/makers/import` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.post_makers_import)` | `server/modules/bulk-upload/controllers/bulkController.ts#post_makers_import` | `server/modules/bulk-upload/routes.ts:50` |
| GET | `/technical/api/bulk/sfi-details` | `asyncHandler(ctrl.get_sfi_details)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_sfi_details` | `server/modules/bulk-upload/routes.ts:53` |
| GET | `/technical/api/bulk/sfi-details/:id` | `asyncHandler(ctrl.get_sfi_detailsByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_sfi_detailsByid` | `server/modules/bulk-upload/routes.ts:54` |
| POST | `/technical/api/bulk/sfi-details` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.post_sfi_details)` | `server/modules/bulk-upload/controllers/bulkController.ts#post_sfi_details` | `server/modules/bulk-upload/routes.ts:55` |
| PATCH | `/technical/api/bulk/sfi-details/:id` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.patch_sfi_detailsByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#patch_sfi_detailsByid` | `server/modules/bulk-upload/routes.ts:56` |
| DELETE | `/technical/api/bulk/sfi-details/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.delete_sfi_detailsByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#delete_sfi_detailsByid` | `server/modules/bulk-upload/routes.ts:57` |
| POST | `/technical/api/bulk/sfi-details/import` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.post_sfi_details_import)` | `server/modules/bulk-upload/controllers/bulkController.ts#post_sfi_details_import` | `server/modules/bulk-upload/routes.ts:58` |
| GET | `/technical/api/bulk/locations/template` | `asyncHandler(ctrl.get_locations_template)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_locations_template` | `server/modules/bulk-upload/routes.ts:61` |
| POST | `/technical/api/bulk/locations/import` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.post_locations_import)` | `server/modules/bulk-upload/controllers/bulkController.ts#post_locations_import` | `server/modules/bulk-upload/routes.ts:62` |
| POST | `/technical/api/bulk/locations/import-stream` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.doLocationsImportStream)` | `server/modules/bulk-upload/controllers/bulkController.ts#doLocationsImportStream` | `server/modules/bulk-upload/routes.ts:63` |
| GET | `/technical/api/bulk/locations` | `asyncHandler(ctrl.get_locations)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_locations` | `server/modules/bulk-upload/routes.ts:64` |
| GET | `/technical/api/bulk/rotational-items/template` | `asyncHandler(ctrl.get_rotational_items_template)` | `server/modules/bulk-upload/controllers/bulkController.ts#get_rotational_items_template` | `server/modules/bulk-upload/routes.ts:67` |
| POST | `/technical/api/bulk/rotational-items/import-stream` | `requirePermission('admin-masters', ['create', 'edit']), upload.single('file'), asyncHandler(ctrl.doRotationalItemsImportStream)` | `server/modules/bulk-upload/controllers/bulkController.ts#doRotationalItemsImportStream` | `server/modules/bulk-upload/routes.ts:68` |
| PUT | `/technical/api/bulk/locations/:id` | `requirePermission('admin-masters', ['create', 'edit']), asyncHandler(ctrl.put_locationsByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#put_locationsByid` | `server/modules/bulk-upload/routes.ts:69` |
| DELETE | `/technical/api/bulk/locations/:id` | `requirePermission('admin-masters', 'delete'), asyncHandler(ctrl.delete_locationsByid)` | `server/modules/bulk-upload/controllers/bulkController.ts#delete_locationsByid` | `server/modules/bulk-upload/routes.ts:70` |

### A. alerts (13 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/alerts/policies` | `asyncHandler(alertsCtrl.getPolicies)` | `server/modules/alerts/controllers/alertsController.ts#getPolicies` | `server/modules/alerts/routes.ts:19` |
| GET | `/technical/api/alerts/policies/:id` | `asyncHandler(alertsCtrl.getPolicy)` | `server/modules/alerts/controllers/alertsController.ts#getPolicy` | `server/modules/alerts/routes.ts:20` |
| PATCH | `/technical/api/alerts/policies/:id` | `requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.updatePolicy)` | `server/modules/alerts/controllers/alertsController.ts#updatePolicy` | `server/modules/alerts/routes.ts:21` |
| POST | `/technical/api/alerts/policies/batch-update` | `requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.batchUpdatePolicies)` | `server/modules/alerts/controllers/alertsController.ts#batchUpdatePolicies` | `server/modules/alerts/routes.ts:22` |
| GET | `/technical/api/alerts/events` | `asyncHandler(alertsCtrl.getEvents)` | `server/modules/alerts/controllers/alertsController.ts#getEvents` | `server/modules/alerts/routes.ts:25` |
| GET | `/technical/api/alerts/events/for-current-user` | `asyncHandler(alertsCtrl.getEventsForCurrentUser)` | `server/modules/alerts/controllers/alertsController.ts#getEventsForCurrentUser` | `server/modules/alerts/routes.ts:26` |
| GET | `/technical/api/alerts/events/:id` | `asyncHandler(alertsCtrl.getEvent)` | `server/modules/alerts/controllers/alertsController.ts#getEvent` | `server/modules/alerts/routes.ts:27` |
| GET | `/technical/api/alerts/events/:id/acknowledgements` | `asyncHandler(alertsCtrl.getAcknowledgements)` | `server/modules/alerts/controllers/alertsController.ts#getAcknowledgements` | `server/modules/alerts/routes.ts:28` |
| POST | `/technical/api/alerts/events/:id/acknowledge` | `asyncHandler(alertsCtrl.acknowledgeEvent)` | `server/modules/alerts/controllers/alertsController.ts#acknowledgeEvent` | `server/modules/alerts/routes.ts:29` |
| POST | `/technical/api/alerts/scan` | `requirePermission('admin-alerts', 'edit'), asyncHandler(async (req, res) => { const { pmsAlertEngine } = await import('./services/pmsAlertEngine'); const results = await pmsAlertEngine.runScan(); res.json({ success: true, ...results }); })` | Inline or directly imported handler; inspect route | `server/modules/alerts/routes.ts:32` |
| POST | `/technical/api/alerts/test` | `requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.sendTestAlert)` | `server/modules/alerts/controllers/alertsController.ts#sendTestAlert` | `server/modules/alerts/routes.ts:37` |
| GET | `/technical/api/alerts/config/:vesselId` | `asyncHandler(alertsCtrl.getConfig)` | `server/modules/alerts/controllers/alertsController.ts#getConfig` | `server/modules/alerts/routes.ts:38` |
| POST | `/technical/api/alerts/config` | `requirePermission('admin-alerts', 'edit'), asyncHandler(alertsCtrl.updateConfig)` | `server/modules/alerts/controllers/alertsController.ts#updateConfig` | `server/modules/alerts/routes.ts:39` |

### A. forms (10 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| POST | `/technical/api/admin/forms/seed-from-live` | `requirePermission('admin-forms', ['create', 'edit']), asyncHandler(formsCtrl.seedForms)` | `server/modules/forms/controllers/formsController.ts#seedForms` | `server/modules/forms/routes.ts:19` |
| GET | `/technical/api/admin/forms` | `asyncHandler(formsCtrl.getFormDefinitions)` | `server/modules/forms/controllers/formsController.ts#getFormDefinitions` | `server/modules/forms/routes.ts:22` |
| GET | `/technical/api/admin/forms/:formId/versions` | `asyncHandler(formsCtrl.getFormVersions)` | `server/modules/forms/controllers/formsController.ts#getFormVersions` | `server/modules/forms/routes.ts:23` |
| GET | `/technical/api/admin/forms/:formId/versions/:versionId` | `asyncHandler(formsCtrl.getFormVersion)` | `server/modules/forms/controllers/formsController.ts#getFormVersion` | `server/modules/forms/routes.ts:24` |
| POST | `/technical/api/admin/forms/:formId/versions` | `requirePermission('admin-forms', ['create', 'edit']), asyncHandler(formsCtrl.createDraftVersion)` | `server/modules/forms/controllers/formsController.ts#createDraftVersion` | `server/modules/forms/routes.ts:25` |
| PUT | `/technical/api/admin/forms/:formId/versions/:versionId/schema` | `requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.updateDraftSchema)` | `server/modules/forms/controllers/formsController.ts#updateDraftSchema` | `server/modules/forms/routes.ts:28` |
| POST | `/technical/api/admin/forms/:formId/versions/:versionId/publish` | `requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.publishVersion)` | `server/modules/forms/controllers/formsController.ts#publishVersion` | `server/modules/forms/routes.ts:29` |
| POST | `/technical/api/admin/forms/:formId/versions/:versionId/discard` | `requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.discardVersion)` | `server/modules/forms/controllers/formsController.ts#discardVersion` | `server/modules/forms/routes.ts:30` |
| POST | `/technical/api/admin/forms/:formId/versions/:versionId/rollback` | `requirePermission('admin-forms', 'edit'), asyncHandler(formsCtrl.rollbackVersion)` | `server/modules/forms/controllers/formsController.ts#rollbackVersion` | `server/modules/forms/routes.ts:31` |
| GET | `/technical/api/forms/runtime/:name` | `asyncHandler(formsCtrl.getRuntimeSchema)` | `server/modules/forms/controllers/formsController.ts#getRuntimeSchema` | `server/modules/forms/routes.ts:34` |

### A. misc (12 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| POST | `/technical/api/upload-document` | `upload.single('file'), asyncHandler(docsCtrl.uploadDocument)` | `server/modules/misc/controllers/documentsController.ts#uploadDocument` | `server/modules/misc/routes.ts:19` |
| GET | `/technical/api/documents/:fileKey(*)` | `asyncHandler(docsCtrl.getDocument)` | `server/modules/misc/controllers/documentsController.ts#getDocument` | `server/modules/misc/routes.ts:20` |
| DELETE | `/technical/api/documents/:fileKey(*)` | `asyncHandler(docsCtrl.deleteDocument)` | `server/modules/misc/controllers/documentsController.ts#deleteDocument` | `server/modules/misc/routes.ts:21` |
| GET | `/technical/api/admin/job-due-scan` | `asyncHandler(adminCtrl.jobDueScan)` | `server/modules/misc/controllers/adminController.ts#jobDueScan` | `server/modules/misc/routes.ts:27` |
| POST | `/technical/api/admin/job-due-scan` | `asyncHandler(adminCtrl.jobDueScan)` | `server/modules/misc/controllers/adminController.ts#jobDueScan` | `server/modules/misc/routes.ts:28` |
| POST | `/technical/api/admin/purge-jobs` | `asyncHandler(adminCtrl.purgeJobs)` | `server/modules/misc/controllers/adminController.ts#purgeJobs` | `server/modules/misc/routes.ts:29` |
| POST | `/technical/api/admin/migrate-inventory` | `asyncHandler(adminCtrl.migrateInventory)` | `server/modules/misc/controllers/adminController.ts#migrateInventory` | `server/modules/misc/routes.ts:30` |
| POST | `/technical/api/admin/sync-work-order-status` | `asyncHandler(adminCtrl.syncWorkOrderStatus)` | `server/modules/misc/controllers/adminController.ts#syncWorkOrderStatus` | `server/modules/misc/routes.ts:31` |
| POST | `/technical/api/admin/sync-masters` | `requirePMSAdmin, asyncHandler(adminCtrl.syncMasters)` | `server/modules/misc/controllers/adminController.ts#syncMasters` | `server/modules/misc/routes.ts:32` |
| POST | `/technical/api/admin/populate-postponement-history` | `asyncHandler(adminCtrl.populatePostponementHistory)` | `server/modules/misc/controllers/adminController.ts#populatePostponementHistory` | `server/modules/misc/routes.ts:33` |
| GET | `/technical/api/admin/rh-diagnostic` | `requirePMSAdmin, asyncHandler(adminCtrl.rhDiagnostic)` | `server/modules/misc/controllers/adminController.ts#rhDiagnostic` | `server/modules/misc/routes.ts:34` |
| POST | `/technical/api/admin/repair-rh-tracking` | `requirePMSAdmin, asyncHandler(adminCtrl.repairRhTracking)` | `server/modules/misc/controllers/adminController.ts#repairRhTracking` | `server/modules/misc/routes.ts:35` |

### A. access-control (9 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/admin/view-modes` | `requireAuth, getViewModesHandler` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:18` |
| GET | `/technical/api/admin/role-view-mappings/resolve` | `requireAuth, resolveViewModeHandler` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:19` |
| GET | `/technical/api/admin/role-view-mappings` | `requireAuth, getRoleViewMappingsHandler` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:20` |
| PUT | `/technical/api/admin/role-view-mappings` | `requireAuth, putRoleViewMappingsHandler` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:24` |
| GET | `/technical/api/admin/roles` | `async (_req: Request, res: Response) => { try { const roles = await storage.getActiveRoles(); res.json(roles); } catch (error: any) { res.status(500).json({ error: 'Failed to fetch roles', details: error.message }); } }` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:26` |
| GET | `/technical/api/admin/menu-items` | `async (_req: Request, res: Response) => { try { const menuItems = await storage.getActiveMenuItems(); res.json(menuItems); } catch (error: any) { res.status(500).json({ error: 'Failed to fetch menu items', details: error.message }); } }` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:35` |
| GET | `/technical/api/admin/role-by-name/:roleName` | `async (req: Request, res: Response) => { try { const { roleName } = req.params; const role = await storage.getRoleByName(roleName); if (!role) { return res.status(404).json({ error: 'Role not found' }); } res.json(role); } catch (error: any) { res.status(500).json({ error: 'Failed to fetch role', details: error.message }); } }` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:44` |
| GET | `/technical/api/admin/access-control/:roleRuid` | `async (req: Request, res: Response) => { try { const { roleRuid } = req.params; const permissions = await storage.getRoleMenuPermissions(roleRuid); res.json(permissions); } catch (error: any) { res.status(500).json({ error: 'Failed to fetch permissions', details: error.message }); } }` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:57` |
| PUT | `/technical/api/admin/access-control/:roleRuid` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/modules/access-control/routes.ts:68` |

### A. audit (3 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/admin/audit-trail` | `requirePMSAdmin, asyncHandler(ctrl.getAuditTrail)` | `server/modules/audit/controller.ts#getAuditTrail` | `server/modules/audit/routes.ts:12` |
| POST | `/technical/api/admin/audit-trail/excel` | `requirePMSAdmin, asyncHandler(ctrl.exportAuditTrailExcel)` | `server/modules/audit/controller.ts#exportAuditTrailExcel` | `server/modules/audit/routes.ts:15` |
| GET | `/technical/api/admin/audit-trail/excel` | `requirePMSAdmin, asyncHandler(ctrl.exportAuditTrailExcel)` | `server/modules/audit/controller.ts#exportAuditTrailExcel` | `server/modules/audit/routes.ts:16` |

### A. retention (5 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/admin/retention-settings` | `requirePMSAdmin, asyncHandler(ctrl.getRetentionSettings)` | `server/modules/retention/controller.ts#getRetentionSettings` | `server/modules/retention/routes.ts:11` |
| PUT | `/technical/api/admin/retention-settings/:category` | `requirePMSAdmin, asyncHandler(ctrl.updateRetentionSetting)` | `server/modules/retention/controller.ts#updateRetentionSetting` | `server/modules/retention/routes.ts:12` |
| POST | `/technical/api/admin/retention-settings/:category/dispose` | `requirePMSAdmin, asyncHandler(ctrl.disposeCategory)` | `server/modules/retention/controller.ts#disposeCategory` | `server/modules/retention/routes.ts:13` |
| POST | `/technical/api/admin/retention-settings/:category/retain` | `requirePMSAdmin, asyncHandler(ctrl.retainCategory)` | `server/modules/retention/controller.ts#retainCategory` | `server/modules/retention/routes.ts:14` |
| POST | `/technical/api/admin/retention-settings/:category/revert` | `requirePMSAdmin, asyncHandler(ctrl.revertCategory)` | `server/modules/retention/controller.ts#revertCategory` | `server/modules/retention/routes.ts:15` |

### A. ranks (14 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/admin/available-ranks` | `asyncHandler(ctrl.getRanks)` | `server/modules/ranks/controller.ts#getRanks` | `server/modules/ranks/routes.ts:12` |
| GET | `/technical/api/admin/available-ranks/:rankId` | `asyncHandler(ctrl.getRankById)` | `server/modules/ranks/controller.ts#getRankById` | `server/modules/ranks/routes.ts:13` |
| POST | `/technical/api/admin/available-ranks` | `requirePermission('admin-ranks', 'create'), asyncHandler(ctrl.saveRanks)` | `server/modules/ranks/controller.ts#saveRanks` | `server/modules/ranks/routes.ts:14` |
| PUT | `/technical/api/admin/available-ranks/:rankId` | `requirePermission('admin-ranks', 'edit'), asyncHandler(ctrl.updateRank)` | `server/modules/ranks/controller.ts#updateRank` | `server/modules/ranks/routes.ts:15` |
| DELETE | `/technical/api/admin/available-ranks/:rankId` | `requirePermission('admin-ranks', 'delete'), asyncHandler(ctrl.deleteRank)` | `server/modules/ranks/controller.ts#deleteRank` | `server/modules/ranks/routes.ts:16` |
| GET | `/technical/api/admin/vessel-org-chart` | `asyncHandler(ctrl.getOrgChart)` | `server/modules/ranks/controller.ts#getOrgChart` | `server/modules/ranks/routes.ts:18` |
| GET | `/technical/api/admin/vessel-org-chart/:id` | `asyncHandler(ctrl.getOrgChartById)` | `server/modules/ranks/controller.ts#getOrgChartById` | `server/modules/ranks/routes.ts:19` |
| POST | `/technical/api/admin/vessel-org-chart` | `requirePermission('admin-ranks', 'create'), asyncHandler(ctrl.saveOrgChart)` | `server/modules/ranks/controller.ts#saveOrgChart` | `server/modules/ranks/routes.ts:20` |
| PUT | `/technical/api/admin/vessel-org-chart/:id` | `requirePermission('admin-ranks', 'edit'), asyncHandler(ctrl.updateOrgChartEntry)` | `server/modules/ranks/controller.ts#updateOrgChartEntry` | `server/modules/ranks/routes.ts:21` |
| DELETE | `/technical/api/admin/vessel-org-chart/:id` | `requirePermission('admin-ranks', 'delete'), asyncHandler(ctrl.deleteOrgChartEntry)` | `server/modules/ranks/controller.ts#deleteOrgChartEntry` | `server/modules/ranks/routes.ts:22` |
| GET | `/technical/api/admin/vessel-org-chart-nodes/:vesselId` | `asyncHandler(ctrl.getVesselOrgChartNodes)` | `server/modules/ranks/controller.ts#getVesselOrgChartNodes` | `server/modules/ranks/routes.ts:24` |
| GET | `/technical/api/admin/vessel-department-config/:vesselId` | `asyncHandler(ctrl.getVesselDepartmentConfig)` | `server/modules/ranks/controller.ts#getVesselDepartmentConfig` | `server/modules/ranks/routes.ts:26` |
| GET | `/technical/api/hierarchy-scope/:vesselId` | `asyncHandler(ctrl.getHierarchyScope)` | `server/modules/ranks/controller.ts#getHierarchyScope` | `server/modules/ranks/routes.ts:28` |
| GET | `/technical/api/hod/:vesselId/:department` | `asyncHandler(ctrl.resolveHod)` | `server/modules/ranks/controller.ts#resolveHod` | `server/modules/ranks/routes.ts:30` |

### A. sync (41 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| POST | `/technical/api/sync/initiate` | `syncTenantGuard, asyncHandler(syncController.initiateSyncHandler)` | `server/modules/sync/controller.ts#initiateSyncHandler` | `server/modules/sync/routes.ts:25` |
| POST | `/technical/api/sync/push` | `syncTenantGuard, asyncHandler(syncController.pushHandler)` | `server/modules/sync/controller.ts#pushHandler` | `server/modules/sync/routes.ts:26` |
| POST | `/technical/api/sync/pull` | `syncTenantGuard, asyncHandler(syncController.pullHandler)` | `server/modules/sync/controller.ts#pullHandler` | `server/modules/sync/routes.ts:27` |
| POST | `/technical/api/sync/resolve-conflict` | `requirePermission('admin-sync-conflicts', 'edit', { enforce: true }), asyncHandler(syncController.resolveConflictHandler)` | `server/modules/sync/controller.ts#resolveConflictHandler` | `server/modules/sync/routes.ts:28` |
| POST | `/technical/api/sync/complete` | `syncTenantGuard, asyncHandler(syncController.completeSyncHandler)` | `server/modules/sync/controller.ts#completeSyncHandler` | `server/modules/sync/routes.ts:29` |
| POST | `/technical/api/sync/fetch-rows` | `syncTenantGuard, asyncHandler(syncController.fetchRowsHandler)` | `server/modules/sync/controller.ts#fetchRowsHandler` | `server/modules/sync/routes.ts:32` |
| GET | `/technical/api/sync/status` | `asyncHandler(syncController.statusHandler)` | `server/modules/sync/controller.ts#statusHandler` | `server/modules/sync/routes.ts:33` |
| GET | `/technical/api/sync/batches` | `asyncHandler(syncController.recentBatchesHandler)` | `server/modules/sync/controller.ts#recentBatchesHandler` | `server/modules/sync/routes.ts:36` |
| GET | `/technical/api/sync/conflicts` | `asyncHandler(syncController.unresolvedConflictsHandler)` | `server/modules/sync/controller.ts#unresolvedConflictsHandler` | `server/modules/sync/routes.ts:37` |
| GET | `/technical/api/sync/conflicts/review/count` | `requirePermission('admin-sync-dashboard', 'view', { enforce: true }), asyncHandler(conflictReviewCtrl.countConflictsHandler)` | `server/modules/sync/conflictReviewController.ts#countConflictsHandler` | `server/modules/sync/routes.ts:41` |
| GET | `/technical/api/sync/conflicts/review/tables` | `requirePermission('admin-sync-conflicts', 'view', { enforce: true }), asyncHandler(conflictReviewCtrl.conflictTablesHandler)` | `server/modules/sync/conflictReviewController.ts#conflictTablesHandler` | `server/modules/sync/routes.ts:42` |
| GET | `/technical/api/sync/conflicts/review` | `requirePermission('admin-sync-conflicts', 'view', { enforce: true }), asyncHandler(conflictReviewCtrl.listConflictsHandler)` | `server/modules/sync/conflictReviewController.ts#listConflictsHandler` | `server/modules/sync/routes.ts:43` |
| GET | `/technical/api/sync/conflicts/review/:id` | `requirePermission('admin-sync-conflicts', 'view', { enforce: true }), asyncHandler(conflictReviewCtrl.getConflictHandler)` | `server/modules/sync/conflictReviewController.ts#getConflictHandler` | `server/modules/sync/routes.ts:44` |
| POST | `/technical/api/sync/conflicts/review/:id/apply-incoming` | `requirePermission('admin-sync-conflicts', 'edit', { enforce: true }), asyncHandler(conflictReviewCtrl.applyIncomingHandler)` | `server/modules/sync/conflictReviewController.ts#applyIncomingHandler` | `server/modules/sync/routes.ts:45` |
| POST | `/technical/api/sync/conflicts/review/:id/dismiss` | `requirePermission('admin-sync-conflicts', 'edit', { enforce: true }), asyncHandler(conflictReviewCtrl.dismissHandler)` | `server/modules/sync/conflictReviewController.ts#dismissHandler` | `server/modules/sync/routes.ts:46` |
| POST | `/technical/api/sync/trigger` | `requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.triggerSyncHandler)` | `server/modules/sync/controller.ts#triggerSyncHandler` | `server/modules/sync/routes.ts:49` |
| POST | `/technical/api/sync/file/upload-chunk` | `syncTenantGuard, asyncHandler(syncController.uploadChunkHandler)` | `server/modules/sync/controller.ts#uploadChunkHandler` | `server/modules/sync/routes.ts:52` |
| POST | `/technical/api/sync/file/pending` | `syncTenantGuard, asyncHandler(syncController.pendingFilesHandler)` | `server/modules/sync/controller.ts#pendingFilesHandler` | `server/modules/sync/routes.ts:55` |
| POST | `/technical/api/sync/file/download-chunk` | `syncTenantGuard, asyncHandler(syncController.downloadChunkHandler)` | `server/modules/sync/controller.ts#downloadChunkHandler` | `server/modules/sync/routes.ts:56` |
| GET | `/technical/api/sync/file/queue` | `asyncHandler(syncController.fileQueueHandler)` | `server/modules/sync/controller.ts#fileQueueHandler` | `server/modules/sync/routes.ts:57` |
| POST | `/technical/api/sync/file/:queueUuid/retry` | `requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.retryFileHandler)` | `server/modules/sync/controller.ts#retryFileHandler` | `server/modules/sync/routes.ts:58` |
| POST | `/technical/api/sync/file/:queueUuid/skip` | `requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.skipFileHandler)` | `server/modules/sync/controller.ts#skipFileHandler` | `server/modules/sync/routes.ts:59` |
| POST | `/technical/api/sync/file/:queueUuid/complete` | `syncTenantGuard, asyncHandler(syncController.completeFileHandler)` | `server/modules/sync/controller.ts#completeFileHandler` | `server/modules/sync/routes.ts:60` |
| POST | `/technical/api/sync/file/:queueUuid/fail` | `syncTenantGuard, asyncHandler(syncController.failFileHandler)` | `server/modules/sync/controller.ts#failFileHandler` | `server/modules/sync/routes.ts:61` |
| POST | `/technical/api/sync/prune` | `requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.pruneHandler)` | `server/modules/sync/controller.ts#pruneHandler` | `server/modules/sync/routes.ts:64` |
| GET | `/technical/api/sync/health` | `asyncHandler(syncController.healthCheckHandler)` | `server/modules/sync/controller.ts#healthCheckHandler` | `server/modules/sync/routes.ts:65` |
| GET | `/technical/api/sync/drift` | `requireOfflineAdmin, asyncHandler(syncController.driftListHandler)` | `server/modules/sync/controller.ts#driftListHandler` | `server/modules/sync/routes.ts:67` |
| POST | `/technical/api/sync/drift/scan` | `requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.driftScanHandler)` | `server/modules/sync/controller.ts#driftScanHandler` | `server/modules/sync/routes.ts:68` |
| GET | `/technical/api/sync/table-stats` | `asyncHandler(syncController.tableStatsHandler)` | `server/modules/sync/controller.ts#tableStatsHandler` | `server/modules/sync/routes.ts:69` |
| GET | `/technical/api/sync/settings` | `requireOfflineAdmin, asyncHandler(syncController.getSettingsHandler)` | `server/modules/sync/controller.ts#getSettingsHandler` | `server/modules/sync/routes.ts:72` |
| PUT | `/technical/api/sync/settings` | `requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.updateSettingsHandler)` | `server/modules/sync/controller.ts#updateSettingsHandler` | `server/modules/sync/routes.ts:73` |
| POST | `/technical/api/sync/settings/test-connection` | `requireOfflineAdmin, requirePermission('admin-sync-dashboard', 'edit'), asyncHandler(syncController.testConnectionHandler)` | `server/modules/sync/controller.ts#testConnectionHandler` | `server/modules/sync/routes.ts:74` |
| GET | `/technical/api/sync/fleet-overview` | `requireOfflineAdmin, asyncHandler(syncController.fleetOverviewHandler)` | `server/modules/sync/controller.ts#fleetOverviewHandler` | `server/modules/sync/routes.ts:77` |
| GET | `/technical/api/sync/instance-info` | `asyncHandler(syncController.instanceInfoHandler)` | `server/modules/sync/controller.ts#instanceInfoHandler` | `server/modules/sync/routes.ts:80` |
| GET | `/technical/api/sync/diag-log` | `asyncHandler(syncController.diagLogHandler)` | `server/modules/sync/controller.ts#diagLogHandler` | `server/modules/sync/routes.ts:83` |
| GET | `/technical/api/sync/diag-logs` | `asyncHandler(syncController.diagLogsListHandler)` | `server/modules/sync/controller.ts#diagLogsListHandler` | `server/modules/sync/routes.ts:84` |
| POST | `/technical/api/sync/provision/import` | `requireOfflineAdmin, requirePermission('admin-sync-provisioning', 'edit'), asyncHandler(syncController.importProvisionHandler)` | `server/modules/sync/controller.ts#importProvisionHandler` | `server/modules/sync/routes.ts:88` |
| POST | `/technical/api/sync/provision/verify` | `requireOfflineAdmin, requirePermission('admin-sync-provisioning', 'edit'), asyncHandler(syncController.verifyProvisionHandler)` | `server/modules/sync/controller.ts#verifyProvisionHandler` | `server/modules/sync/routes.ts:89` |
| POST | `/technical/api/sync/provision/:vesselId` | `requireOfflineAdmin, requirePermission('admin-sync-provisioning', 'edit'), asyncHandler(syncController.generateProvisionHandler)` | `server/modules/sync/controller.ts#generateProvisionHandler` | `server/modules/sync/routes.ts:90` |
| GET | `/technical/api/sync/provision/manifest/:vesselId` | `requireOfflineAdmin, asyncHandler(syncController.getManifestHandler)` | `server/modules/sync/controller.ts#getManifestHandler` | `server/modules/sync/routes.ts:91` |
| GET | `/technical/api/sync/provision/download/:vesselId` | `requireOfflineAdmin, asyncHandler(syncController.downloadProvisionHandler)` | `server/modules/sync/controller.ts#downloadProvisionHandler` | `server/modules/sync/routes.ts:92` |

### A. dashboard (2 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/dashboard/maintenance-trend` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/modules/dashboard/routes.ts:9` |
| GET | `/technical/api/dashboard/wo-status-by-period` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/modules/dashboard/routes.ts:42` |

### A. rotational-items (5 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/rotational-items` | `asyncHandler(ctrl.listRotationalItems)` | `server/modules/rotational-items/controllers/rotationalItemController.ts#listRotationalItems` | `server/modules/rotational-items/routes.ts:11` |
| POST | `/technical/api/rotational-items` | `requirePMSAdmin, asyncHandler(ctrl.createRotationalItem)` | `server/modules/rotational-items/controllers/rotationalItemController.ts#createRotationalItem` | `server/modules/rotational-items/routes.ts:12` |
| POST | `/technical/api/rotational-items/swap` | `requirePMSAdmin, asyncHandler(ctrl.replaceRotationalItem)` | `server/modules/rotational-items/controllers/rotationalItemController.ts#replaceRotationalItem` | `server/modules/rotational-items/routes.ts:15` |
| PUT | `/technical/api/rotational-items/:riuuid` | `requirePMSAdmin, asyncHandler(ctrl.updateRotationalItem)` | `server/modules/rotational-items/controllers/rotationalItemController.ts#updateRotationalItem` | `server/modules/rotational-items/routes.ts:16` |
| DELETE | `/technical/api/rotational-items/:riuuid` | `requirePMSAdmin, asyncHandler(ctrl.deleteRotationalItem)` | `server/modules/rotational-items/controllers/rotationalItemController.ts#deleteRotationalItem` | `server/modules/rotational-items/routes.ts:17` |

### A. central (8 registrations)

| Method | Full path | Registration / guards | Handler source | Route location |
|---|---|---|---|---|
| GET | `/technical/api/admin/local-approvers` | `async (req, res) => { try { const rows = await storage.getLocalApprovers(); return res.json(rows); } catch (error: any) { console.error('[LocalApprovers] Failed to fetch:', error.message); return res.status(500).json({ error: 'Failed to fetch local approvers' }); } }` | Inline or directly imported handler; inspect route | `server/routes.ts:55` |
| GET | `/technical/api/admin/approvers` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/routes.ts:65` |
| GET | `/technical/api/external/master-data/:endpoint` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/routes.ts:94` |
| GET | `/download/docs/:filename` | `Inline handler; read source registration` | `server/path.ts#resolve`<br>`server/fs.ts#existsSync` | `server/routes.ts:128` |
| POST | `/dev/seed/recurring-defects` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/routes.ts:230` |
| DELETE | `/dev/seed/recurring-defects` | `async (req, res) => { try { let deleted = 0; for (const seedId of ALL_SEED_IDS) { const defect = await storage.getDefectBySeedId(seedId); if (defect) { await storage.deleteDefect(defect.id); deleted++; } } res.json({ message: "Seed data deleted successfully", deleted }); } catch (error: any) { console.error("Delete seed error:", error); res.status(500).json({ error: "Failed to delete seed data", details: error.message }); } }` | Inline or directly imported handler; inspect route | `server/routes.ts:326` |
| GET | `/technical/api/admin/approval-workflow-config` | `async (_req, res) => { try { const rows = await storage.getApprovalWorkflowConfig(); res.json({ success: true, data: rows }); } catch (err) { console.error('[ApprovalWorkflowConfig] GET error:', err); res.status(500).json({ success: false, error: 'Failed to fetch approval workflow config' }); } }` | Inline or directly imported handler; inspect route | `server/routes.ts:349` |
| PUT | `/technical/api/admin/approval-workflow-config` | `Inline handler; read source registration` | Inline or directly imported handler; inspect route | `server/routes.ts:373` |

## Appendix B — Database field dictionary

Source: `shared/schema.ts`. This dictionary includes selected operational PMS tables and supporting configuration, inventory, reporting, master-data and identity tables. It is **not a live PostgreSQL schema dump**. Each expression preserves declared type, nullability/default/identity/reference details where present. `.references()` is schema evidence of an FK declaration; absence does not prove no migration-defined constraint exists. `updatedAtColumn()` and other factory definitions require helper inspection. Multi-line default objects, table-level indexes and SQL-only migration additions require the source/migration; a single extracted field line is not their complete definition. See `shared/schemaHelpers.ts`.

| Table | Source symbol | Columns indexed | Declaration |
|---|---|---:|---|
| `users` | `users` | 16 | `shared/schema.ts:11` |
| `fleets` | `fleets` | 13 | `shared/schema.ts:52` |
| `vessels` | `vessels` | 19 | `shared/schema.ts:77` |
| `fleet_classes` | `fleetClasses` | 12 | `shared/schema.ts:108` |
| `running_hours_audit` | `runningHoursAudit` | 32 | `shared/schema.ts:157` |
| `components` | `components` | 61 | `shared/schema.ts:302` |
| `rotational_items` | `rotationalItems` | 15 | `shared/schema.ts:417` |
| `rotation_history` | `rotationHistory` | 23 | `shared/schema.ts:453` |
| `form_definitions` | `formDefinitions` | 9 | `shared/schema.ts:492` |
| `form_versions` | `formVersions` | 15 | `shared/schema.ts:513` |
| `form_version_usage` | `formVersionUsage` | 10 | `shared/schema.ts:544` |
| `ihm_items` | `ihmItems` | 18 | `shared/schema.ts:566` |
| `ihm_maintenance_log` | `ihmMaintenanceLog` | 17 | `shared/schema.ts:600` |
| `spares` | `spares` | 58 | `shared/schema.ts:632` |
| `spares_history` | `sparesHistory` | 26 | `shared/schema.ts:713` |
| `stores_ledger` | `storesLedger` | 26 | `shared/schema.ts:757` |
| `stores_items` | `storesItems` | 51 | `shared/schema.ts:799` |
| `change_request` | `changeRequest` | 26 | `shared/schema.ts:874` |
| `change_request_approval` | `changeRequestApproval` | 15 | `shared/schema.ts:936` |
| `change_request_attachment` | `changeRequestAttachment` | 12 | `shared/schema.ts:964` |
| `change_request_comment` | `changeRequestComment` | 11 | `shared/schema.ts:991` |
| `alert_policies` | `alertPolicies` | 19 | `shared/schema.ts:1017` |
| `alert_events` | `alertEvents` | 20 | `shared/schema.ts:1050` |
| `alert_deliveries` | `alertDeliveries` | 15 | `shared/schema.ts:1086` |
| `alert_config` | `alertConfig` | 16 | `shared/schema.ts:1116` |
| `alert_acknowledgements` | `alertAcknowledgements` | 13 | `shared/schema.ts:1145` |
| `jobs` | `jobs` | 53 | `shared/schema.ts:1172` |
| `work_orders` | `workOrders` | 141 | `shared/schema.ts:1251` |
| `superintendent_notifications` | `superintendentNotifications` | 21 | `shared/schema.ts:1484` |
| `work_order_executions` | `workOrderExecutions` | 21 | `shared/schema.ts:1518` |
| `import_history` | `importHistory` | 23 | `shared/schema.ts:1897` |
| `import_change_log` | `importChangeLog` | 14 | `shared/schema.ts:1928` |
| `makers` | `makers` | 15 | `shared/schema.ts:1963` |
| `master_lists` | `masterLists` | 12 | `shared/schema.ts:1996` |
| `master_list_types` | `masterListTypes` | 15 | `shared/schema.ts:2025` |
| `component_running_hours_log` | `componentRunningHoursLog` | 18 | `shared/schema.ts:2061` |
| `audit_log` | `auditLog` | 20 | `shared/schema.ts:2098` |
| `retention_settings` | `retentionSettings` | 12 | `shared/schema.ts:2140` |
| `component_documents` | `componentDocuments` | 22 | `shared/schema.ts:2157` |
| `component_class_regulatory` | `componentClassRegulatory` | 25 | `shared/schema.ts:2197` |
| `component_maintenance_history` | `componentMaintenanceHistory` | 34 | `shared/schema.ts:2241` |
| `component_requisitions` | `componentRequisitions` | 30 | `shared/schema.ts:2296` |
| `pms_vessel_settings` | `pmsVesselSettings` | 34 | `shared/schema.ts:2346` |
| `company_standard_grace_settings` | `companyStandardGraceSettings` | 25 | `shared/schema.ts:2416` |
| `company_approval_settings` | `companyApprovalSettings` | 7 | `shared/schema.ts:2464` |
| `maker_list` | `makerList` | 17 | `shared/schema.ts:2481` |
| `fleet_components` | `fleetComponents` | 22 | `shared/schema.ts:2522` |
| `fleet_jobs` | `fleetJobs` | 33 | `shared/schema.ts:2567` |
| `fleet_spares` | `fleetSpares` | 28 | `shared/schema.ts:2623` |
| `sfi_details` | `sfiDetails` | 12 | `shared/schema.ts:2673` |
| `master_data` | `masterData` | 22 | `shared/schema.ts:2703` |
| `fleet_vessel_mapping` | `fleetVesselMapping` | 12 | `shared/schema.ts:2747` |
| `fleet_component_mapping` | `fleetComponentMapping` | 14 | `shared/schema.ts:2778` |
| `fleet_job_vessel_mapping` | `fleetJobVesselMapping` | 14 | `shared/schema.ts:2812` |
| `fleet_spare_vessel_mapping` | `fleetSpareVesselMapping` | 14 | `shared/schema.ts:2845` |
| `bulk_import_history` | `bulkImportHistory` | 25 | `shared/schema.ts:2878` |
| `bulk_import_errors` | `bulkImportErrors` | 17 | `shared/schema.ts:2924` |
| `work_order_execution_details` | `workOrderExecutionDetails` | 24 | `shared/schema.ts:3040` |
| `locations` | `locations` | 13 | `shared/schema.ts:3107` |
| `spare_component_links` | `spareComponentLinks` | 13 | `shared/schema.ts:3136` |
| `spare_location_stock` | `spareLocationStock` | 13 | `shared/schema.ts:3167` |
| `inventory_transactions` | `inventoryTransactions` | 23 | `shared/schema.ts:3197` |
| `job_component_links` | `jobComponentLinks` | 18 | `shared/schema.ts:3285` |
| `work_order_postponements` | `workOrderPostponements` | 30 | `shared/schema.ts:3690` |
| `wo_postponement_approvals` | `woPostponementApprovals` | 16 | `shared/schema.ts:3738` |
| `report_snapshots` | `reportSnapshots` | 15 | `shared/schema.ts:3769` |
| `approval_workflow_config` | `approvalWorkflowConfig` | 14 | `shared/schema.ts:4156` |
| `planner_dates` | `plannerDates` | 13 | `shared/schema.ts:4185` |
| `report_favorites` | `reportFavorites` | 10 | `shared/schema.ts:4213` |
| `moc_approvers` | `mocApprovers` | 15 | `shared/schema.ts:4639` |

### B. users

Schema symbol: `users`. Declaration: `shared/schema.ts:11`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 12 |
| `username` | `username` | `text` | `text("username").notNull().unique()` | 13 |
| `password` | `password` | `text` | `text("password").notNull()` | 14 |
| `fullName` | `full_name` | `text` | `text("full_name").notNull()` | 15 |
| `email` | `email` | `text` | `text("email")` | 16 |
| `role` | `role` | `userRoleEnum` | `userRoleEnum("role").notNull().default("Ship")` | 17 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 18 |
| `department` | `department` | `text` | `text("department")` | 19 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 20 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 21 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 22 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 23 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 24 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 25 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 26 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 27 |

### B. fleets

Schema symbol: `fleets`. Declaration: `shared/schema.ts:52`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 53 |
| `fuuid` | `fuuid` | `text` | `text("fuuid").notNull().unique()` | 54 |
| `code` | `code` | `text` | `text("code").notNull().unique()` | 55 |
| `name` | `name` | `text` | `text("name").notNull()` | 56 |
| `description` | `description` | `text` | `text("description")` | 57 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 58 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 59 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 60 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 61 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 62 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 63 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 64 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 65 |

### B. vessels

Schema symbol: `vessels`. Declaration: `shared/schema.ts:77`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 78 |
| `vuuid` | `vuuid` | `text` | `text("vuuid").notNull().unique()` | 79 |
| `name` | `name` | `text` | `text("name").notNull()` | 80 |
| `code` | `code` | `text` | `text("code").notNull()` | 81 |
| `vCode` | `v_code` | `text` | `text("v_code")` | 82 |
| `fleetId` | `fleet_id` | `text` | `text("fleet_id")` | 83 |
| `imoNumber` | `imo_number` | `text` | `text("imo_number")` | 84 |
| `vesselType` | `vessel_type` | `text` | `text("vessel_type")` | 85 |
| `flag` | `flag` | `text` | `text("flag")` | 86 |
| `vesselSequence` | `vessel_sequence` | `integer` | `integer("vessel_sequence")` | 87 |
| `classId` | `class_id` | `text` | `text("class_id")` | 88 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 89 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 90 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 91 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 92 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 93 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 94 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 95 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 96 |

### B. fleet_classes

Schema symbol: `fleetClasses`. Declaration: `shared/schema.ts:108`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `serial` | `serial("id").primaryKey()` | 109 |
| `fcuuid` | `fcuuid` | `text` | `text("fcuuid").notNull().unique()` | 110 |
| `fleetId` | `fleet_id` | `text` | `text("fleet_id").notNull()` | 111 |
| `name` | `name` | `text` | `text("name").notNull()` | 112 |
| `description` | `description` | `text` | `text("description")` | 113 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 114 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 115 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 116 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 117 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 118 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 119 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 120 |

### B. running_hours_audit

Schema symbol: `runningHoursAudit`. Declaration: `shared/schema.ts:157`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 158 |
| `rhauuid` | `rhauuid` | `text` | ``text("rhauuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 159 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 160 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 161 |
| `previousRH` | `previous_rh` | `decimal` | `decimal("previous_rh", { precision: 10, scale: 2 }).notNull()` | 162 |
| `newRH` | `new_rh` | `decimal` | `decimal("new_rh", { precision: 10, scale: 2 }).notNull()` | 163 |
| `cumulativeRH` | `cumulative_rh` | `decimal` | `decimal("cumulative_rh", { precision: 10, scale: 2 }).notNull()` | 164 |
| `dateUpdatedLocal` | `date_updated_local` | `text` | `text("date_updated_local").notNull()` | 165 |
| `dateUpdatedTZ` | `date_updated_tz` | `text` | `text("date_updated_tz").notNull()` | 166 |
| `enteredAtUTC` | `entered_at_utc` | `timestamp` | `timestamp("entered_at_utc").notNull()` | 167 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 168 |
| `actorLabel` | `actor_label` | `text` | `text("actor_label")` | 169 |
| `source` | `source` | `text` | `text("source").notNull()` | 170 |
| `notes` | `notes` | `text` | `text("notes")` | 171 |
| `meterReplaced` | `meter_replaced` | `boolean` | `boolean("meter_replaced").notNull().default(false)` | 172 |
| `oldMeterFinal` | `old_meter_final` | `decimal` | `decimal("old_meter_final", { precision: 10, scale: 2 })` | 173 |
| `newMeterStart` | `new_meter_start` | `decimal` | `decimal("new_meter_start", { precision: 10, scale: 2 })` | 174 |
| `version` | `version` | `integer` | `integer("version").notNull().default(1)` | 175 |
| `isRenewalReset` | `is_renewal_reset` | `boolean` | `boolean("is_renewal_reset").notNull().default(false)` | 177 |
| `renewalActionType` | `renewal_action_type` | `text` | `text("renewal_action_type")` | 178 |
| `renewalReason` | `renewal_reason` | `text` | `text("renewal_reason")` | 179 |
| `renewalReference` | `renewal_reference` | `text` | `text("renewal_reference")` | 180 |
| `renewalEvidenceUrls` | `renewal_evidence_urls` | `json` | `json("renewal_evidence_urls")` | 181 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 182 |
| `componentName` | `component_name` | `text` | `text("component_name")` | 183 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 184 |
| `originSide` | `origin_side` | `text` | `text("origin_side")` | 188 |
| `stampHolder` | `stamp_holder` | `text` | `text("stamp_holder")` | 189 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 190 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 191 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 192 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 193 |

### B. components

Schema symbol: `components`. Declaration: `shared/schema.ts:302`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 303 |
| `cuuid` | `cuuid` | `text` | `text("cuuid").notNull().unique()` | 304 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code")` | 306 |
| `fleetEquipmentName` | `fleet_equipment_name` | `text` | `text("fleet_equipment_name")` | 307 |
| `parentId` | `parent_id` | `text` | `text("parent_id")` | 308 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 309 |
| `name` | `name` | `text` | `text("name")` | 311 |
| `componentCategory` | `component_category` | `text` | `text("component_category")` | 312 |
| `maker` | `maker` | `text` | `text("maker")` | 313 |
| `makerCode` | `maker_code` | `text` | `text("maker_code")` | 314 |
| `model` | `model` | `text` | `text("model")` | 316 |
| `modelCode` | `model_code` | `text` | `text("model_code")` | 317 |
| `serialNo` | `serial_no` | `text` | `text("serial_no")` | 318 |
| `drawingNo` | `drawing_no` | `text` | `text("drawing_no")` | 319 |
| `location` | `location` | `text` | `text("location")` | 321 |
| `critical` | `critical` | `boolean` | `boolean("critical").default(false)` | 322 |
| `conditionBased` | `condition_based` | `boolean` | `boolean("condition_based").default(false)` | 323 |
| `installationDate` | `installation_date` | `text` | `text("installation_date")` | 324 |
| `commissionedDate` | `commissioned_date` | `text` | `text("commissioned_date")` | 326 |
| `rating` | `rating` | `text` | `text("rating")` | 327 |
| `eqptSystemDept` | `eqpt_system_dept` | `text` | `text("eqpt_system_dept")` | 328 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").default(true)` | 330 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code")` | 331 |
| `isParent` | `is_parent` | `boolean` | `boolean("is_parent").default(false)` | 332 |
| `notes` | `notes` | `text` | `text("notes")` | 334 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 336 |
| `dataScope` | `data_scope` | `text` | `text("data_scope").notNull().default("vessel")` | 337 |
| `parentFleetEquipmentCode` | `parent_fleet_equipment_code` | `text` | `text("parent_fleet_equipment_code")` | 338 |
| `modelNumber` | `model_number` | `text` | `text("model_number")` | 339 |
| `department` | `department` | `text` | `text("department")` | 340 |
| `deptCategory` | `dept_category` | `text` | `text("dept_category")` | 341 |
| `category` | `category` | `text` | `text("category")` | 342 |
| `classItem` | `class_item` | `boolean` | `boolean("class_item").default(false)` | 343 |
| `noOfUnits` | `no_of_units` | `text` | `text("no_of_units")` | 344 |
| `parentComponent` | `parent_component` | `text` | `text("parent_component")` | 345 |
| `dimensionsSize` | `dimensions_size` | `text` | `text("dimensions_size")` | 346 |
| `runningHours` | `running_hours` | `decimal` | `decimal("running_hours", { precision: 10, scale: 2 })` | 347 |
| `currentCumulativeRH` | `current_cumulative_rh` | `decimal` | `decimal("current_cumulative_rh", { precision: 10, scale: 2 }).notNull().default("0")` | 348 |
| `lastUpdated` | `last_updated` | `text` | `text("last_updated")` | 349 |
| `applicableVesselIds` | `applicable_vessel_ids` | `text` | `text("applicable_vessel_ids").array()` | 350 |
| `scopeNotes` | `scope_notes` | `text` | `text("scope_notes")` | 351 |
| `rhCounterType` | `rh_counter_type` | `text` | `text("rh_counter_type").notNull().default("NOT_RH_DRIVEN")` | 355 |
| `rhCounterSource` | `rh_counter_source` | `text` | `text("rh_counter_source")` | 357 |
| `rhMasterComponentId` | `rh_master_component_id` | `text` | `text("rh_master_component_id")` | 359 |
| `rhCurrentMaster` | `rh_current_master` | `decimal` | `decimal("rh_current_master", { precision: 10, scale: 2 })` | 361 |
| `rhMasterUpdatedAt` | `rh_master_updated_at` | `timestamp` | `timestamp("rh_master_updated_at")` | 362 |
| `rhMasterUpdatedBy` | `rh_master_updated_by` | `text` | `text("rh_master_updated_by")` | 363 |
| `rhMasterUpdateSource` | `rh_master_update_source` | `text` | `text("rh_master_update_source")` | 364 |
| `rhCurrentInheritedCached` | `rh_current_inherited_cached` | `decimal` | `decimal("rh_current_inherited_cached", { precision: 10, scale: 2 })` | 366 |
| `rhInheritedUpdatedAt` | `rh_inherited_updated_at` | `timestamp` | `timestamp("rh_inherited_updated_at")` | 367 |
| `meterReplacedDate` | `meter_replaced_date` | `timestamp` | `timestamp("meter_replaced_date")` | 372 |
| `meterReplacedLastRh` | `meter_replaced_last_rh` | `decimal` | `decimal("meter_replaced_last_rh", { precision: 10, scale: 2 })` | 373 |
| `rotationalItem` | `rotational_item` | `boolean` | `boolean("rotational_item").notNull().default(false)` | 379 |
| `currentStamp` | `current_stamp` | `text` | `text("current_stamp")` | 380 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 382 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 383 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 384 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 385 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 386 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 387 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 388 |

### B. rotational_items

Schema symbol: `rotationalItems`. Declaration: `shared/schema.ts:417`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 418 |
| `riuuid` | `riuuid` | `text` | ``text("riuuid").notNull().unique().default(sql`gen_random_uuid()`)`` | 419 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 420 |
| `stamp` | `stamp` | `text` | `text("stamp").notNull()` | 421 |
| `stampName` | `stamp_name` | `text` | `text("stamp_name")` | 422 |
| `currentRh` | `current_rh` | `decimal` | `decimal("current_rh", { precision: 10, scale: 2 }).notNull().default("0")` | 423 |
| `rhLastUpdated` | `rh_last_updated` | `text` | `text("rh_last_updated")` | 424 |
| `status` | `status` | `text` | `text("status").notNull().default("Spare")` | 425 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 426 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 427 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 428 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 429 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 430 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 431 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 432 |

### B. rotation_history

Schema symbol: `rotationHistory`. Declaration: `shared/schema.ts:453`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 454 |
| `rhruuid` | `rhruuid` | `text` | ``text("rhruuid").notNull().unique().default(sql`gen_random_uuid()`)`` | 455 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 456 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull()` | 457 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 458 |
| `componentName` | `component_name` | `text` | `text("component_name")` | 459 |
| `outRiuuid` | `out_riuuid` | `text` | `text("out_riuuid")` | 460 |
| `outStamp` | `out_stamp` | `text` | `text("out_stamp")` | 461 |
| `outRh` | `out_rh` | `decimal` | `decimal("out_rh", { precision: 10, scale: 2 })` | 462 |
| `inRiuuid` | `in_riuuid` | `text` | `text("in_riuuid").notNull()` | 463 |
| `inStamp` | `in_stamp` | `text` | `text("in_stamp").notNull()` | 464 |
| `inRh` | `in_rh` | `decimal` | `decimal("in_rh", { precision: 10, scale: 2 }).notNull()` | 465 |
| `rotationDate` | `rotation_date` | `timestamp` | `timestamp("rotation_date").notNull().defaultNow()` | 466 |
| `userId` | `user_id` | `text` | `text("user_id")` | 467 |
| `actorLabel` | `actor_label` | `text` | `text("actor_label")` | 468 |
| `notes` | `notes` | `text` | `text("notes")` | 469 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 470 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 471 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 472 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 473 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 474 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 475 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 476 |

### B. form_definitions

Schema symbol: `formDefinitions`. Declaration: `shared/schema.ts:492`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 493 |
| `fduuid` | `fduuid` | `text` | `text("fduuid").notNull().unique()` | 494 |
| `name` | `name` | `text` | `text("name").notNull().unique()` | 495 |
| `subgroup` | `subgroup` | `text` | `text("subgroup")` | 496 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 497 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 498 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 499 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 500 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 501 |

### B. form_versions

Schema symbol: `formVersions`. Declaration: `shared/schema.ts:513`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 514 |
| `fvuuid` | `fvuuid` | `text` | `text("fvuuid").notNull().unique()` | 515 |
| `formId` | `form_id` | `integer` | `integer("form_id").notNull()` | 516 |
| `formDefinitionUuid` | `form_definition_uuid` | `text` | `text("form_definition_uuid").notNull()` | 517 |
| `versionNo` | `version_no` | `integer` | `integer("version_no").notNull()` | 519 |
| `versionDate` | `version_date` | `timestamp` | `timestamp("version_date").notNull()` | 520 |
| `status` | `status` | `text` | `text("status").notNull()` | 521 |
| `authorUserId` | `author_user_id` | `text` | `text("author_user_id").notNull()` | 522 |
| `changelog` | `changelog` | `text` | `text("changelog")` | 523 |
| `schemaJson` | `schema_json` | `text` | `text("schema_json").notNull()` | 524 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 525 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 526 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 527 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 528 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 529 |

### B. form_version_usage

Schema symbol: `formVersionUsage`. Declaration: `shared/schema.ts:544`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 545 |
| `formVersionId` | `form_version_id` | `integer` | `integer("form_version_id").notNull()` | 546 |
| `formVersionUuid` | `form_version_uuid` | `text` | `text("form_version_uuid").notNull()` | 547 |
| `usedInModule` | `used_in_module` | `text` | `text("used_in_module").notNull()` | 549 |
| `usedAt` | `used_at` | `timestamp` | `timestamp("used_at").notNull()` | 550 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 551 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 552 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 553 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 554 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 555 |

### B. ihm_items

Schema symbol: `ihmItems`. Declaration: `shared/schema.ts:566`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 567 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 568 |
| `spareId` | `spare_id` | `text` | `text("spare_id")` | 569 |
| `presence` | `presence` | `text` | `text("presence").notNull()` | 570 |
| `materials` | `materials` | `text` | `text("materials").array()` | 571 |
| `evidenceType` | `evidence_type` | `text` | `text("evidence_type")` | 572 |
| `evidenceFileName` | `evidence_file_name` | `text` | `text("evidence_file_name")` | 573 |
| `verifiedDate` | `verified_date` | `text` | `text("verified_date")` | 574 |
| `supplier` | `supplier` | `text` | `text("supplier")` | 575 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 576 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().default("V001").references(() => vessels.vuuid)` | 577 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 578 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 579 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 580 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 581 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 582 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 583 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 584 |

### B. ihm_maintenance_log

Schema symbol: `ihmMaintenanceLog`. Declaration: `shared/schema.ts:600`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 601 |
| `workOrderId` | `work_order_id` | `text` | `text("work_order_id").notNull().references(() => workOrders.wouuid)` | 602 |
| `action` | `action` | `text` | `text("action").notNull()` | 603 |
| `targetComponent` | `target_component` | `text` | `text("target_component")` | 604 |
| `targetSpare` | `target_spare` | `text` | `text("target_spare")` | 605 |
| `quantity` | `quantity` | `decimal` | `decimal("quantity", { precision: 10, scale: 2 })` | 606 |
| `location` | `location` | `text` | `text("location")` | 607 |
| `materials` | `materials` | `text` | `text("materials").array()` | 608 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 609 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().default("V001").references(() => vessels.vuuid)` | 610 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 611 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 612 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 613 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 614 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 615 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 616 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 617 |

### B. spares

Schema symbol: `spares`. Declaration: `shared/schema.ts:632`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 633 |
| `suuid` | `suuid` | `text` | `text("suuid").notNull().unique()` | 634 |
| `partCode` | `part_code` | `text` | `text("part_code").notNull()` | 635 |
| `partName` | `part_name` | `text` | `text("part_name").notNull()` | 636 |
| `componentId` | `component_id` | `text` | `text("component_id").references(() => components.cuuid)` | 637 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 638 |
| `componentName` | `component_name` | `text` | `text("component_name").notNull()` | 639 |
| `componentSpareCode` | `component_spare_code` | `text` | `text("component_spare_code")` | 640 |
| `critical` | `critical` | `text` | `text("critical").notNull()` | 641 |
| `rob` | `rob` | `integer` | `integer("rob").notNull().default(0)` | 642 |
| `robLocationA` | `rob_location_a` | `integer` | `integer("rob_location_a").notNull().default(0)` | 643 |
| `robLocationB` | `rob_location_b` | `integer` | `integer("rob_location_b").notNull().default(0)` | 644 |
| `min` | `min` | `integer` | `integer("min").notNull().default(0)` | 645 |
| `max` | `max` | `integer` | `integer("max")` | 646 |
| `unitCost` | `unit_cost` | `decimal` | `decimal("unit_cost", { precision: 10, scale: 2 })` | 647 |
| `stockingNumber` | `stocking_number` | `text` | `text("stocking_number")` | 648 |
| `leadTime` | `lead_time` | `text` | `text("lead_time")` | 649 |
| `supplier` | `supplier` | `text` | `text("supplier")` | 650 |
| `lastOrderDate` | `last_order_date` | `text` | `text("last_order_date")` | 651 |
| `location` | `location` | `text` | `text("location")` | 652 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 653 |
| `deleted` | `deleted` | `boolean` | `boolean("deleted").notNull().default(false)` | 654 |
| `dataScope` | `data_scope` | `text` | `text("data_scope").notNull().default("vessel")` | 656 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code")` | 657 |
| `fleetPartCode` | `fleet_part_code` | `text` | `text("fleet_part_code")` | 658 |
| `partNumber` | `part_number` | `text` | `text("part_number")` | 659 |
| `uom` | `uom` | `text` | `text("uom")` | 660 |
| `drawingNumber` | `drawing_number` | `text` | `text("drawing_number")` | 661 |
| `drawingNo` | `drawing_no` | `text` | `text("drawing_no")` | 662 |
| `location2` | `location_2` | `text` | `text("location_2")` | 663 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 664 |
| `unit` | `unit` | `text` | `text("unit")` | 665 |
| `positionNumber` | `position_number` | `text` | `text("position_number")` | 666 |
| `note` | `note` | `text` | `text("note")` | 667 |
| `specification` | `specification` | `text` | `text("specification")` | 668 |
| `maker` | `maker` | `text` | `text("maker")` | 669 |
| `makerCode` | `maker_code` | `text` | `text("maker_code")` | 670 |
| `model` | `model` | `text` | `text("model")` | 671 |
| `manualName` | `manual_name` | `text` | `text("manual_name")` | 672 |
| `pageNumber` | `page_number` | `text` | `text("page_number")` | 673 |
| `criticality` | `criticality` | `text` | `text("criticality")` | 674 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").default(true)` | 675 |
| `ihm` | `ihm` | `text` | `text("ihm")` | 676 |
| `ihmPresence` | `ihm_presence` | `text` | `text("ihm_presence").default("UNKNOWN")` | 677 |
| `evidenceType` | `evidence_type` | `text` | `text("evidence_type")` | 678 |
| `partCategory` | `part_category` | `text` | `text("part_category")` | 679 |
| `applicableVesselIds` | `applicable_vessel_ids` | `text` | `text("applicable_vessel_ids").array()` | 680 |
| `scopeNotes` | `scope_notes` | `text` | `text("scope_notes")` | 681 |
| `isRotationItem` | `is_rotation_item` | `boolean` | `boolean("is_rotation_item").notNull().default(false)` | 682 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 683 |
| `createdBy` | `created_by` | `text` | `text("created_by")` | 684 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 685 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by")` | 686 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 687 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 688 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 689 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 690 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 691 |

### B. spares_history

Schema symbol: `sparesHistory`. Declaration: `shared/schema.ts:713`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 714 |
| `shuuid` | `shuuid` | `text` | ``text("shuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 715 |
| `timestampUTC` | `timestamp_utc` | `timestamp` | `timestamp("timestamp_utc").notNull()` | 716 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 717 |
| `spareId` | `spare_id` | `integer` | `integer("spare_id").notNull()` | 718 |
| `spareUuid` | `spare_uuid` | `text` | `text("spare_uuid").references(() => spares.suuid)` | 719 |
| `partCode` | `part_code` | `text` | `text("part_code").notNull()` | 720 |
| `partName` | `part_name` | `text` | `text("part_name").notNull()` | 721 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 722 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 723 |
| `componentName` | `component_name` | `text` | `text("component_name").notNull()` | 724 |
| `componentSpareCode` | `component_spare_code` | `text` | `text("component_spare_code")` | 725 |
| `eventType` | `event_type` | `text` | `text("event_type").notNull()` | 726 |
| `qtyChange` | `qty_change` | `integer` | `integer("qty_change").notNull()` | 727 |
| `robAfter` | `rob_after` | `integer` | `integer("rob_after").notNull()` | 728 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 729 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 730 |
| `reference` | `reference` | `text` | `text("reference")` | 731 |
| `dateLocal` | `date_local` | `text` | `text("date_local")` | 732 |
| `tz` | `tz` | `text` | `text("tz")` | 733 |
| `place` | `place` | `text` | `text("place")` | 734 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 735 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 736 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 737 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 738 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 739 |

### B. stores_ledger

Schema symbol: `storesLedger`. Declaration: `shared/schema.ts:757`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 758 |
| `sluuid` | `sluuid` | `text` | ``text("sluuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 759 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 760 |
| `section` | `section` | `text` | `text("section").notNull()` | 761 |
| `itemId` | `item_id` | `integer` | `integer("item_id").notNull()` | 762 |
| `storeUuid` | `store_uuid` | `text` | `text("store_uuid").notNull().references(() => storesItems.stuuid)` | 763 |
| `partCode` | `part_code` | `text` | `text("part_code").notNull()` | 764 |
| `itemName` | `item_name` | `text` | `text("item_name").notNull()` | 765 |
| `uom` | `uom` | `text` | `text("uom")` | 766 |
| `eventType` | `event_type` | `text` | `text("event_type").notNull()` | 767 |
| `qtyChangeBase` | `qty_change_base` | `decimal` | `decimal("qty_change_base", { precision: 10, scale: 2 }).notNull()` | 768 |
| `qtyDisplay` | `qty_display` | `decimal` | `decimal("qty_display", { precision: 10, scale: 2 }).notNull()` | 769 |
| `uomDisplay` | `uom_display` | `text` | `text("uom_display")` | 770 |
| `robAfterBase` | `rob_after_base` | `decimal` | `decimal("rob_after_base", { precision: 10, scale: 2 }).notNull()` | 771 |
| `dateLocal` | `date_local` | `text` | `text("date_local").notNull()` | 772 |
| `tz` | `tz` | `text` | `text("tz").notNull()` | 773 |
| `timestampUTC` | `timestamp_utc` | `timestamp` | `timestamp("timestamp_utc").notNull()` | 774 |
| `place` | `place` | `text` | `text("place")` | 775 |
| `ref` | `ref` | `text` | `text("ref")` | 776 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 777 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 778 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 779 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 780 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 781 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 782 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 783 |

### B. stores_items

Schema symbol: `storesItems`. Declaration: `shared/schema.ts:799`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 800 |
| `stuuid` | `stuuid` | `text` | `text("stuuid").notNull().unique()` | 801 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 802 |
| `itemType` | `item_type` | `text` | `text("item_type").notNull()` | 803 |
| `itemCode` | `item_code` | `text` | `text("item_code").notNull()` | 804 |
| `impaCode` | `impa_code` | `text` | `text("impa_code")` | 805 |
| `itemName` | `item_name` | `text` | `text("item_name").notNull()` | 806 |
| `category` | `category` | `text` | `text("category")` | 807 |
| `specification` | `specification` | `text` | `text("specification")` | 808 |
| `uom` | `uom` | `text` | `text("uom")` | 809 |
| `rob` | `rob` | `decimal` | `decimal("rob", { precision: 10, scale: 2 }).notNull().default("0")` | 810 |
| `robLocationA` | `rob_location_a` | `decimal` | `decimal("rob_location_a", { precision: 10, scale: 2 }).notNull().default("0")` | 811 |
| `robLocationB` | `rob_location_b` | `decimal` | `decimal("rob_location_b", { precision: 10, scale: 2 }).notNull().default("0")` | 812 |
| `locationA` | `location_a` | `text` | `text("location_a")` | 813 |
| `locationB` | `location_b` | `text` | `text("location_b")` | 814 |
| `min` | `min` | `decimal` | `decimal("min", { precision: 10, scale: 2 }).notNull().default("0")` | 815 |
| `max` | `max` | `decimal` | `decimal("max", { precision: 10, scale: 2 })` | 816 |
| `unitCost` | `unit_cost` | `decimal` | `decimal("unit_cost", { precision: 10, scale: 2 })` | 817 |
| `supplier` | `supplier` | `text` | `text("supplier")` | 818 |
| `lastOrderDate` | `last_order_date` | `text` | `text("last_order_date")` | 819 |
| `leadTime` | `lead_time` | `text` | `text("lead_time")` | 820 |
| `ihm` | `ihm` | `boolean` | `boolean("ihm").notNull().default(false)` | 821 |
| `ihmDetails` | `ihm_details` | `text` | `text("ihm_details")` | 822 |
| `ihmPresence` | `ihm_presence` | `text` | `text("ihm_presence").default("Unknown")` | 823 |
| `ihmEvidenceType` | `ihm_evidence_type` | `text` | `text("ihm_evidence_type").default("None")` | 824 |
| `manufactureDate` | `manufacture_date` | `text` | `text("manufacture_date")` | 825 |
| `expiryDate` | `expiry_date` | `text` | `text("expiry_date")` | 826 |
| `batchNumber` | `batch_number` | `text` | `text("batch_number")` | 827 |
| `lotNumber` | `lot_number` | `text` | `text("lot_number")` | 828 |
| `shelfLifeMonths` | `shelf_life_months` | `integer` | `integer("shelf_life_months")` | 829 |
| `sdsReference` | `sds_reference` | `text` | `text("sds_reference")` | 830 |
| `sdsDocumentUrl` | `sds_document_url` | `text` | `text("sds_document_url")` | 831 |
| `sdsLastUpdated` | `sds_last_updated` | `text` | `text("sds_last_updated")` | 832 |
| `hazardClassification` | `hazard_classification` | `text` | `text("hazard_classification")` | 833 |
| `unNumber` | `un_number` | `text` | `text("un_number")` | 834 |
| `flashPoint` | `flash_point` | `text` | `text("flash_point")` | 835 |
| `storageTempMin` | `storage_temp_min` | `decimal` | `decimal("storage_temp_min", { precision: 5, scale: 2 })` | 836 |
| `storageTempMax` | `storage_temp_max` | `decimal` | `decimal("storage_temp_max", { precision: 5, scale: 2 })` | 837 |
| `disposalInstructions` | `disposal_instructions` | `text` | `text("disposal_instructions")` | 838 |
| `ppeRequirements` | `ppe_requirements` | `text` | `text("ppe_requirements")` | 839 |
| `emergencyContact` | `emergency_contact` | `text` | `text("emergency_contact")` | 840 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 841 |
| `deleted` | `deleted` | `boolean` | `boolean("deleted").notNull().default(false)` | 842 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 843 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 844 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 845 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 846 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 847 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 848 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 849 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 850 |

### B. change_request

Schema symbol: `changeRequest`. Declaration: `shared/schema.ts:874`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 875 |
| `cruuid` | `cruuid` | `text` | ``text("cruuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 876 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 877 |
| `category` | `category` | `text` | `text("category").notNull()` | 878 |
| `title` | `title` | `text` | `text("title").notNull()` | 879 |
| `reason` | `reason` | `text` | `text("reason").notNull()` | 880 |
| `targetType` | `target_type` | `text` | `text("target_type")` | 881 |
| `targetId` | `target_id` | `text` | `text("target_id")` | 882 |
| `snapshotBeforeJson` | `snapshot_before_json` | `json` | `json("snapshot_before_json")` | 883 |
| `proposedChangesJson` | `proposed_changes_json` | `json` | `json("proposed_changes_json")` | 884 |
| `movePreviewJson` | `move_preview_json` | `json` | `json("move_preview_json")` | 885 |
| `status` | `status` | `text` | `text("status").notNull().default("draft")` | 886 |
| `requestedByUserId` | `requested_by_user_id` | `text` | `text("requested_by_user_id").notNull()` | 887 |
| `submittedAt` | `submitted_at` | `timestamp` | `timestamp("submitted_at")` | 888 |
| `reviewedByUserId` | `reviewed_by_user_id` | `text` | `text("reviewed_by_user_id")` | 889 |
| `reviewedAt` | `reviewed_at` | `timestamp` | `timestamp("reviewed_at")` | 890 |
| `revisionNumber` | `revision_number` | `integer` | `integer("revision_number").notNull().default(0)` | 892 |
| `revisionHistory` | `revision_history` | `json` | `json("revision_history").$type<Array<{` | 893 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 905 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 906 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 907 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 908 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 909 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 910 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 911 |
| `approvalWorkflowSnapshot` | `approval_workflow_snapshot` | `json` | `json("approval_workflow_snapshot").$type<{` | 912 |

### B. change_request_approval

Schema symbol: `changeRequestApproval`. Declaration: `shared/schema.ts:936`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 937 |
| `crauuid` | `crauuid` | `text` | ``text("crauuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 938 |
| `changeRequestId` | `change_request_id` | `integer` | `integer("change_request_id").notNull().references(() => changeRequest.id)` | 939 |
| `changeRequestUuid` | `change_request_uuid` | `text` | `text("change_request_uuid").notNull()` | 940 |
| `approvalLevel` | `approval_level` | `text` | `text("approval_level").notNull()` | 941 |
| `status` | `status` | `text` | `text("status").notNull().default("Pending")` | 942 |
| `actionByUserId` | `action_by_user_id` | `text` | `text("action_by_user_id")` | 943 |
| `actionAt` | `action_at` | `timestamp` | `timestamp("action_at", { withTimezone: true })` | 944 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 945 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 946 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 947 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 948 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 949 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 950 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 951 |

### B. change_request_attachment

Schema symbol: `changeRequestAttachment`. Declaration: `shared/schema.ts:964`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 965 |
| `crauuid` | `crauuid` | `text` | ``text("crauuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 966 |
| `changeRequestId` | `change_request_id` | `integer` | `integer("change_request_id").notNull()` | 967 |
| `filename` | `filename` | `text` | `text("filename").notNull()` | 968 |
| `url` | `url` | `text` | `text("url").notNull()` | 969 |
| `uploadedByUserId` | `uploaded_by_user_id` | `text` | `text("uploaded_by_user_id").notNull()` | 970 |
| `uploadedAt` | `uploaded_at` | `timestamp` | `timestamp("uploaded_at").notNull().defaultNow()` | 971 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 972 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 973 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 974 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 975 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 976 |

### B. change_request_comment

Schema symbol: `changeRequestComment`. Declaration: `shared/schema.ts:991`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 992 |
| `crcuuid` | `crcuuid` | `text` | ``text("crcuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 993 |
| `changeRequestId` | `change_request_id` | `integer` | `integer("change_request_id").notNull()` | 994 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 995 |
| `message` | `message` | `text` | `text("message").notNull()` | 996 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 997 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 998 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 999 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1000 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1001 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1002 |

### B. alert_policies

Schema symbol: `alertPolicies`. Declaration: `shared/schema.ts:1017`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1018 |
| `apuuid` | `apuuid` | `text` | `text("apuuid").notNull().unique()` | 1019 |
| `alertType` | `alert_type` | `text` | `text("alert_type").notNull()` | 1020 |
| `enabled` | `enabled` | `boolean` | `boolean("enabled").notNull().default(true)` | 1021 |
| `priority` | `priority` | `text` | `text("priority").notNull().default("medium")` | 1022 |
| `emailEnabled` | `email_enabled` | `boolean` | `boolean("email_enabled").notNull().default(false)` | 1023 |
| `inAppEnabled` | `in_app_enabled` | `boolean` | `boolean("in_app_enabled").notNull().default(true)` | 1024 |
| `thresholds` | `thresholds` | `text` | `text("thresholds").notNull().default("{}")` | 1025 |
| `scopeFilters` | `scope_filters` | `text` | `text("scope_filters").notNull().default("{}")` | 1026 |
| `recipients` | `recipients` | `text` | `text("recipients").notNull().default("{}")` | 1027 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1028 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 1029 |
| `createdBy` | `created_by` | `text` | `text("created_by").notNull()` | 1030 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by").notNull()` | 1031 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1032 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1033 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1034 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1035 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1036 |

### B. alert_events

Schema symbol: `alertEvents`. Declaration: `shared/schema.ts:1050`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1051 |
| `aeuuid` | `aeuuid` | `text` | `text("aeuuid").notNull().unique()` | 1052 |
| `policyId` | `policy_id` | `integer` | `integer("policy_id").notNull()` | 1053 |
| `policyUuid` | `policy_uuid` | `text` | `text("policy_uuid").notNull().references(() => alertPolicies.apuuid)` | 1054 |
| `alertType` | `alert_type` | `text` | `text("alert_type").notNull()` | 1055 |
| `priority` | `priority` | `text` | `text("priority").notNull()` | 1056 |
| `objectType` | `object_type` | `text` | `text("object_type")` | 1057 |
| `objectId` | `object_id` | `text` | `text("object_id")` | 1058 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 1059 |
| `dedupeKey` | `dedupe_key` | `text` | `text("dedupe_key").notNull()` | 1060 |
| `state` | `state` | `text` | `text("state")` | 1061 |
| `payload` | `payload` | `text` | `text("payload").notNull()` | 1062 |
| `ackBy` | `ack_by` | `text` | `text("ack_by")` | 1063 |
| `ackAt` | `ack_at` | `timestamp` | `timestamp("ack_at")` | 1064 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1065 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1066 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1067 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1068 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1069 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1070 |

### B. alert_deliveries

Schema symbol: `alertDeliveries`. Declaration: `shared/schema.ts:1086`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1087 |
| `eventId` | `event_id` | `integer` | `integer("event_id").notNull()` | 1088 |
| `eventUuid` | `event_uuid` | `text` | `text("event_uuid").notNull().references(() => alertEvents.aeuuid)` | 1089 |
| `channel` | `channel` | `text` | `text("channel").notNull()` | 1090 |
| `recipient` | `recipient` | `text` | `text("recipient").notNull()` | 1091 |
| `status` | `status` | `text` | `text("status").notNull().default("pending")` | 1092 |
| `errorMessage` | `error_message` | `text` | `text("error_message")` | 1093 |
| `sentAt` | `sent_at` | `timestamp` | `timestamp("sent_at")` | 1094 |
| `acknowledgedAt` | `acknowledged_at` | `timestamp` | `timestamp("acknowledged_at")` | 1095 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1096 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1097 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1098 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1099 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1100 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1101 |

### B. alert_config

Schema symbol: `alertConfig`. Declaration: `shared/schema.ts:1116`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1117 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 1118 |
| `quietHoursEnabled` | `quiet_hours_enabled` | `boolean` | `boolean("quiet_hours_enabled").notNull().default(false)` | 1119 |
| `quietHoursStart` | `quiet_hours_start` | `text` | `text("quiet_hours_start")` | 1120 |
| `quietHoursEnd` | `quiet_hours_end` | `text` | `text("quiet_hours_end")` | 1121 |
| `escalationEnabled` | `escalation_enabled` | `boolean` | `boolean("escalation_enabled").notNull().default(false)` | 1122 |
| `escalationHours` | `escalation_hours` | `integer` | `integer("escalation_hours").notNull().default(4)` | 1123 |
| `escalationRecipients` | `escalation_recipients` | `text` | `text("escalation_recipients").notNull().default("[]")` | 1124 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1125 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 1126 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by").notNull()` | 1127 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1128 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1129 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1130 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1131 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1132 |

### B. alert_acknowledgements

Schema symbol: `alertAcknowledgements`. Declaration: `shared/schema.ts:1145`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1146 |
| `aauuid` | `aauuid` | `text` | `text("aauuid").notNull().unique()` | 1147 |
| `eventUuid` | `event_uuid` | `text` | `text("event_uuid").notNull().references(() => alertEvents.aeuuid)` | 1148 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 1149 |
| `userRole` | `user_role` | `text` | `text("user_role").notNull()` | 1150 |
| `comments` | `comments` | `text` | `text("comments").notNull()` | 1151 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1152 |
| `updatedAt` | `updated_at` | `timestamp` | `timestamp("updated_at").defaultNow().notNull()` | 1153 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1154 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1155 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1156 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1157 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 1158 |

### B. jobs

Schema symbol: `jobs`. Declaration: `shared/schema.ts:1172`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 1173 |
| `juuid` | `juuid` | `text` | `text("juuid").notNull().unique()` | 1174 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 1175 |
| `componentId` | `component_id` | `text` | `text("component_id").references(() => components.cuuid)` | 1176 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 1177 |
| `componentName` | `component_name` | `text` | `text("component_name")` | 1178 |
| `jobNo` | `job_no` | `text` | `text("job_no").notNull()` | 1179 |
| `jobTitle` | `job_title` | `text` | `text("job_title").notNull()` | 1180 |
| `assignedTo` | `assigned_to` | `text` | `text("assigned_to")` | 1181 |
| `assignedToRankId` | `assigned_to_rank_id` | `text` | `text("assigned_to_rank_id")` | 1182 |
| `maintenanceType` | `maintenance_type` | `text` | `text("maintenance_type")` | 1183 |
| `maintenanceBasis` | `maintenance_basis` | `text` | `text("maintenance_basis")` | 1184 |
| `frequencyType` | `frequency_type` | `text` | `text("frequency_type")` | 1185 |
| `frequencyValue` | `frequency_value` | `text` | `text("frequency_value")` | 1186 |
| `frequencyUnit` | `frequency_unit` | `text` | `text("frequency_unit")` | 1187 |
| `intervalRunningHour` | `interval_running_hour` | `integer` | `integer("interval_running_hour")` | 1188 |
| `leadTimeValue` | `lead_time_value` | `integer` | `integer("lead_time_value")` | 1189 |
| `leadTimeUnit` | `lead_time_unit` | `text` | `text("lead_time_unit")` | 1190 |
| `initialNextDue` | `initial_next_due` | `text` | `text("initial_next_due")` | 1191 |
| `lastDoneDate` | `last_done_date` | `text` | `text("last_done_date")` | 1192 |
| `nextDueDate` | `next_due_date` | `text` | `text("next_due_date")` | 1193 |
| `lastDoneRH` | `last_done_rh` | `text` | `text("last_done_rh")` | 1194 |
| `nextDueRH` | `next_due_rh` | `text` | `text("next_due_rh")` | 1195 |
| `rhEstimatedDueDate` | `rh_estimated_due_date` | `text` | `text("rh_estimated_due_date")` | 1196 |
| `rhAveragePerDay` | `rh_average_per_day` | `decimal` | `decimal("rh_average_per_day", { precision: 12, scale: 6 })` | 1197 |
| `rhEstimateBasis` | `rh_estimate_basis` | `text` | `text("rh_estimate_basis")` | 1198 |
| `trackingRebaselinedAt` | `tracking_rebaselined_at` | `timestamp` | `timestamp("tracking_rebaselined_at")` | 1201 |
| `jobPriority` | `job_priority` | `text` | `text("job_priority")` | 1202 |
| `classRelated` | `class_related` | `text` | `text("class_related")` | 1203 |
| `briefWorkDescription` | `brief_work_description` | `text` | `text("brief_work_description")` | 1204 |
| `jobDescription` | `job_description` | `text` | `text("job_description")` | 1205 |
| `approver` | `approver` | `text` | `text("approver")` | 1206 |
| `level2ReviewerRankId` | `level2_reviewer_rank_id` | `text` | `text("level2_reviewer_rank_id")` | 1207 |
| `department` | `department` | `text` | `text("department")` | 1208 |
| `requiredSpareParts` | `required_spare_parts` | `json` | `json("required_spare_parts").notNull().default([])` | 1211 |
| `requiredTools` | `required_tools` | `json` | `json("required_tools").notNull().default([])` | 1212 |
| `safetyRequirements` | `safety_requirements` | `json` | `json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []})` | 1213 |
| `dataScope` | `data_scope` | `text` | `text("data_scope").notNull().default("vessel")` | 1216 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code")` | 1217 |
| `fleetJobCode` | `fleet_job_code` | `text` | `text("fleet_job_code")` | 1218 |
| `sfiCode` | `sfi_code` | `text` | `text("sfi_code")` | 1219 |
| `criticality` | `criticality` | `text` | `text("criticality")` | 1220 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").default(true)` | 1221 |
| `estimatedManHours` | `estimated_man_hours` | `decimal` | `decimal("estimated_man_hours", { precision: 6, scale: 2 })` | 1222 |
| `createdBy` | `created_by` | `text` | `text("created_by")` | 1224 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1225 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by")` | 1226 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 1227 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1228 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1229 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1230 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1231 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1232 |

### B. work_orders

Schema symbol: `workOrders`. Declaration: `shared/schema.ts:1251`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 1252 |
| `wouuid` | `wouuid` | `text` | `text("wouuid").notNull().unique()` | 1253 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 1254 |
| `component` | `component` | `text` | `text("component").notNull()` | 1255 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 1256 |
| `jobId` | `job_id` | `text` | `text("job_id").references(() => jobs.juuid)` | 1257 |
| `workOrderNo` | `work_order_no` | `text` | `text("work_order_no").notNull()` | 1258 |
| `workOrderType` | `work_order_type` | `text` | `text("work_order_type").notNull().default("Planned")` | 1259 |
| `templateCode` | `template_code` | `text` | `text("template_code")` | 1260 |
| `executionId` | `execution_id` | `text` | `text("execution_id")` | 1261 |
| `jobTitle` | `job_title` | `text` | `text("job_title").notNull()` | 1262 |
| `assignedTo` | `assigned_to` | `text` | `text("assigned_to").notNull()` | 1263 |
| `assignedToRankId` | `assigned_to_rank_id` | `text` | `text("assigned_to_rank_id")` | 1264 |
| `dueDate` | `due_date` | `text` | `text("due_date")` | 1265 |
| `status` | `status` | `text` | `text("status").notNull().default("Active")` | 1266 |
| `dateCompleted` | `date_completed` | `text` | `text("date_completed")` | 1267 |
| `submittedDate` | `submitted_date` | `text` | `text("submitted_date")` | 1268 |
| `formData` | `form_data` | `json` | `json("form_data")` | 1269 |
| `taskType` | `task_type` | `text` | `text("task_type")` | 1270 |
| `maintenanceType` | `maintenance_type` | `text` | `text("maintenance_type")` | 1271 |
| `maintenanceBasis` | `maintenance_basis` | `text` | `text("maintenance_basis")` | 1272 |
| `frequencyValue` | `frequency_value` | `text` | `text("frequency_value")` | 1273 |
| `frequencyUnit` | `frequency_unit` | `text` | `text("frequency_unit")` | 1274 |
| `approverRemarks` | `approver_remarks` | `text` | `text("approver_remarks")` | 1275 |
| `isExecution` | `is_execution` | `boolean` | `boolean("is_execution").notNull().default(false)` | 1276 |
| `templateId` | `template_id` | `text` | `text("template_id")` | 1277 |
| `approver` | `approver` | `text` | `text("approver")` | 1278 |
| `approvalDate` | `approval_date` | `text` | `text("approval_date")` | 1279 |
| `rejectionDate` | `rejection_date` | `text` | `text("rejection_date")` | 1280 |
| `nextDueDate` | `next_due_date` | `text` | `text("next_due_date")` | 1281 |
| `nextDueReading` | `next_due_reading` | `text` | `text("next_due_reading")` | 1282 |
| `currentReading` | `current_reading` | `text` | `text("current_reading")` | 1283 |
| `generatedByInstance` | `generated_by_instance` | `text` | `text("generated_by_instance")` | 1286 |
| `classRelated` | `class_related` | `text` | `text("class_related")` | 1287 |
| `jobPriority` | `job_priority` | `text` | `text("job_priority")` | 1288 |
| `briefWorkDescription` | `brief_work_description` | `text` | `text("brief_work_description")` | 1289 |
| `dataScope` | `data_scope` | `text` | `text("data_scope").notNull().default("vessel")` | 1291 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code")` | 1292 |
| `fleetJobCode` | `fleet_job_code` | `text` | `text("fleet_job_code")` | 1293 |
| `jobGroup` | `job_group` | `text` | `text("job_group")` | 1294 |
| `jobCategory` | `job_category` | `text` | `text("job_category")` | 1295 |
| `sfiCode` | `sfi_code` | `text` | `text("sfi_code")` | 1296 |
| `maintenanceIntervalValue` | `maintenance_interval_value` | `integer` | `integer("maintenance_interval_value")` | 1297 |
| `maintenanceIntervalUnit` | `maintenance_interval_unit` | `text` | `text("maintenance_interval_unit")` | 1298 |
| `intervalRunningHour` | `interval_running_hour` | `integer` | `integer("interval_running_hour")` | 1299 |
| `department` | `department` | `text` | `text("department")` | 1300 |
| `criticality` | `criticality` | `text` | `text("criticality")` | 1301 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").default(true)` | 1302 |
| `applicableVesselIds` | `applicable_vessel_ids` | `text` | `text("applicable_vessel_ids").array()` | 1303 |
| `scopeNotes` | `scope_notes` | `text` | `text("scope_notes")` | 1304 |
| `postponementEndDate` | `postponement_end_date` | `text` | `text("postponement_end_date")` | 1306 |
| `postponementReason` | `postponement_reason` | `text` | `text("postponement_reason")` | 1307 |
| `postponementRemarks` | `postponement_remarks` | `text` | `text("postponement_remarks")` | 1308 |
| `postponementAuthorizedBy` | `postponement_authorized_by` | `text` | `text("postponement_authorized_by")` | 1309 |
| `overdueReason` | `overdue_reason` | `text` | `text("overdue_reason")` | 1311 |
| `overdueReasonDetails` | `overdue_reason_details` | `text` | `text("overdue_reason_details")` | 1312 |
| `onDemandReason` | `on_demand_reason` | `text` | `text("on_demand_reason")` | 1314 |
| `requiredSpareParts` | `required_spare_parts` | `json` | `json("required_spare_parts").notNull().default([])` | 1316 |
| `requiredTools` | `required_tools` | `json` | `json("required_tools").notNull().default([])` | 1317 |
| `safetyRequirements` | `safety_requirements` | `json` | `json("safety_requirements").notNull().default({ppeRequirements: [], permitRequirements: [], otherRequirements: []})` | 1318 |
| `uploadedDocuments` | `uploaded_documents` | `json` | `json("uploaded_documents").notNull().default([])` | 1320 |
| `consumedSpareParts` | `consumed_spare_parts` | `json` | `json("consumed_spare_parts").notNull().default([])` | 1321 |
| `riskAssessmentStatus` | `risk_assessment_status` | `text` | `text("risk_assessment_status")` | 1323 |
| `safetyChecklistsStatus` | `safety_checklists_status` | `text` | `text("safety_checklists_status")` | 1324 |
| `operationalFormsStatus` | `operational_forms_status` | `text` | `text("operational_forms_status")` | 1325 |
| `startDateTime` | `start_date_time` | `text` | `text("start_date_time")` | 1327 |
| `completionDateTime` | `completion_date_time` | `text` | `text("completion_date_time")` | 1328 |
| `executionAssignedTo` | `execution_assigned_to` | `text` | `text("execution_assigned_to")` | 1329 |
| `performedBy` | `performed_by` | `text` | `text("performed_by")` | 1330 |
| `noOfPersons` | `no_of_persons` | `text` | `text("no_of_persons")` | 1331 |
| `totalTimeHours` | `total_time_hours` | `text` | `text("total_time_hours")` | 1332 |
| `manhours` | `manhours` | `text` | `text("manhours")` | 1333 |
| `workCarriedOut` | `work_carried_out` | `text` | `text("work_carried_out")` | 1334 |
| `jobExperienceNotes` | `job_experience_notes` | `text` | `text("job_experience_notes")` | 1335 |
| `previousReading` | `previous_reading` | `text` | `text("previous_reading")` | 1337 |
| `runningHours` | `running_hours` | `text` | `text("running_hours")` | 1338 |
| `runningHoursDifference` | `running_hours_difference` | `text` | `text("running_hours_difference")` | 1339 |
| `readingDate` | `reading_date` | `text` | `text("reading_date")` | 1340 |
| `woExecutionId` | `wo_execution_id` | `text` | `text("wo_execution_id")` | 1342 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 1343 |
| `completionRemarks` | `completion_remarks` | `text` | `text("completion_remarks")` | 1344 |
| `rejectionComments` | `rejection_comments` | `text` | `text("rejection_comments")` | 1346 |
| `approvalAction` | `approval_action` | `text` | `text("approval_action")` | 1347 |
| `wasRejected` | `was_rejected` | `boolean` | `boolean("was_rejected").notNull().default(false)` | 1348 |
| `missedCycles` | `missed_cycles` | `integer` | `integer("missed_cycles").default(0)` | 1349 |
| `originalDueDate` | `original_due_date` | `text` | `text("original_due_date")` | 1350 |
| `skippedCyclesJustification` | `skipped_cycles_justification` | `text` | `text("skipped_cycles_justification")` | 1351 |
| `daysLate` | `days_late` | `integer` | `integer("days_late").default(0)` | 1354 |
| `approvalTier` | `approval_tier` | `text` | `text("approval_tier").default("standard")` | 1355 |
| `superintendentAcknowledged` | `superintendent_acknowledged` | `boolean` | `boolean("superintendent_acknowledged").default(false)` | 1356 |
| `superintendentAcknowledgedAt` | `superintendent_acknowledged_at` | `text` | `text("superintendent_acknowledged_at")` | 1357 |
| `superintendentNotifiedAt` | `superintendent_notified_at` | `text` | `text("superintendent_notified_at")` | 1358 |
| `ceApprovalRemarks` | `ce_approval_remarks` | `text` | `text("ce_approval_remarks")` | 1359 |
| `approvalBlockReason` | `approval_block_reason` | `text` | `text("approval_block_reason")` | 1360 |
| `superintendentRejectionRemarks` | `superintendent_rejection_remarks` | `text` | `text("superintendent_rejection_remarks")` | 1361 |
| `superintendentRejectedByName` | `superintendent_rejected_by_name` | `text` | `text("superintendent_rejected_by_name")` | 1362 |
| `wasReopened` | `was_reopened` | `boolean` | `boolean("was_reopened").notNull().default(false)` | 1365 |
| `superintendentReopenRemarks` | `superintendent_reopen_remarks` | `text` | `text("superintendent_reopen_remarks")` | 1366 |
| `superintendentReopenedByName` | `superintendent_reopened_by_name` | `text` | `text("superintendent_reopened_by_name")` | 1367 |
| `reopenedAt` | `reopened_at` | `text` | `text("reopened_at")` | 1368 |
| `completionRH` | `completion_rh` | `decimal` | `decimal("completion_rh", { precision: 10, scale: 2 })` | 1371 |
| `woCompletionRh` | `wo_completion_rh` | `decimal` | `decimal("wo_completion_rh", { precision: 10, scale: 2 })` | 1376 |
| `currentReadingDate` | `current_reading_date` | `text` | `text("current_reading_date")` | 1380 |
| `completionRHValidated` | `completion_rh_validated` | `boolean` | `boolean("completion_rh_validated")` | 1381 |
| `completionRHSource` | `completion_rh_source` | `text` | `text("completion_rh_source")` | 1382 |
| `completionRHValidationDetails` | `completion_rh_validation_details` | `jsonb` | `jsonb("completion_rh_validation_details")` | 1383 |
| `rhJustification` | `rh_justification` | `text` | `text("rh_justification")` | 1384 |
| `rhJustificationProvidedBy` | `rh_justification_provided_by` | `text` | `text("rh_justification_provided_by")` | 1385 |
| `rhJustificationDate` | `rh_justification_date` | `timestamp` | `timestamp("rh_justification_date")` | 1386 |
| `rhSyncedAt` | `rh_synced_at` | `timestamp` | `timestamp("rh_synced_at")` | 1391 |
| `rhBackdatedEntry` | `rh_backdated_entry` | `boolean` | `boolean("rh_backdated_entry")` | 1398 |
| `rhUpdateOutcome` | `rh_update_outcome` | `text` | `text("rh_update_outcome")` | 1402 |
| `rhSkipReason` | `rh_skip_reason` | `text` | `text("rh_skip_reason")` | 1403 |
| `rhSkipSubmittedRh` | `rh_skip_submitted_rh` | `decimal` | `decimal("rh_skip_submitted_rh", { precision: 10, scale: 2 })` | 1404 |
| `rhSkipLatestRh` | `rh_skip_latest_rh` | `decimal` | `decimal("rh_skip_latest_rh", { precision: 10, scale: 2 })` | 1405 |
| `rhSkipLatestRhDate` | `rh_skip_latest_rh_date` | `text` | `text("rh_skip_latest_rh_date")` | 1406 |
| `draftExecutionData` | `draft_execution_data` | `jsonb` | `jsonb("draft_execution_data")` | 1412 |
| `postponeRequestedDate` | `postpone_requested_date` | `text` | `text("postpone_requested_date")` | 1415 |
| `postponeApprover` | `postpone_approver` | `text` | `text("postpone_approver")` | 1416 |
| `postponementApprovalDate` | `postponement_approval_date` | `text` | `text("postponement_approval_date")` | 1417 |
| `postponementApprovalRemarks` | `postponement_approval_remarks` | `text` | `text("postponement_approval_remarks")` | 1418 |
| `driverType` | `driver_type` | `text` | `text("driver_type")` | 1422 |
| `dualTriggerLeg` | `dual_trigger_leg` | `text` | `text("dual_trigger_leg")` | 1423 |
| `cycleDueRhSnapshot` | `cycle_due_rh_snapshot` | `decimal` | `decimal("cycle_due_rh_snapshot", { precision: 10, scale: 2 })` | 1426 |
| `generateRhSnapshot` | `generate_rh_snapshot` | `decimal` | `decimal("generate_rh_snapshot", { precision: 10, scale: 2 })` | 1427 |
| `dueRhSnapshot` | `due_rh_snapshot` | `decimal` | `decimal("due_rh_snapshot", { precision: 10, scale: 2 })` | 1428 |
| `effectiveRhAtGeneration` | `effective_rh_at_generation` | `decimal` | `decimal("effective_rh_at_generation", { precision: 10, scale: 2 })` | 1429 |
| `rhLastDoneSnapshot` | `rh_last_done_snapshot` | `decimal` | `decimal("rh_last_done_snapshot", { precision: 10, scale: 2 })` | 1430 |
| `cycleDueDateSnapshot` | `cycle_due_date_snapshot` | `text` | `text("cycle_due_date_snapshot")` | 1433 |
| `generateDateSnapshot` | `generate_date_snapshot` | `text` | `text("generate_date_snapshot")` | 1434 |
| `dueDateSnapshot` | `due_date_snapshot` | `text` | `text("due_date_snapshot")` | 1435 |
| `lastDoneDateSnapshot` | `last_done_date_snapshot` | `text` | `text("last_done_date_snapshot")` | 1436 |
| `reviewerComments` | `reviewer_comments` | `text` | `text("reviewer_comments")` | 1439 |
| `reviewedByUuid` | `reviewed_by_uuid` | `text` | `text("reviewed_by_uuid")` | 1440 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1442 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 1443 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1444 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1445 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1446 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1447 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1448 |

### B. superintendent_notifications

Schema symbol: `superintendentNotifications`. Declaration: `shared/schema.ts:1484`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `serial` | `serial("id").primaryKey()` | 1485 |
| `snuuid` | `snuuid` | `text` | ``text("snuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 1486 |
| `workOrderId` | `work_order_id` | `text` | `text("work_order_id").notNull()` | 1487 |
| `workOrderCode` | `work_order_code` | `text` | `text("work_order_code")` | 1488 |
| `jobTitle` | `job_title` | `text` | `text("job_title")` | 1489 |
| `componentName` | `component_name` | `text` | `text("component_name")` | 1490 |
| `vesselName` | `vessel_name` | `text` | `text("vessel_name")` | 1491 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id")` | 1492 |
| `daysLate` | `days_late` | `integer` | `integer("days_late").default(0)` | 1493 |
| `missedCycles` | `missed_cycles` | `integer` | `integer("missed_cycles").default(0)` | 1494 |
| `backdatingDays` | `backdating_days` | `integer` | `integer("backdating_days").default(0)` | 1495 |
| `approvalTier` | `approval_tier` | `text` | `text("approval_tier")` | 1496 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1497 |
| `updatedAt` | `updated_at` | `timestamp` | `timestamp("updated_at").defaultNow().notNull()` | 1498 |
| `acknowledgedAt` | `acknowledged_at` | `timestamp` | `timestamp("acknowledged_at")` | 1499 |
| `isAcknowledged` | `is_acknowledged` | `boolean` | `boolean("is_acknowledged").default(false)` | 1500 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1501 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1502 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1503 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1504 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 1505 |

### B. work_order_executions

Schema symbol: `workOrderExecutions`. Declaration: `shared/schema.ts:1518`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 1519 |
| `templateId` | `template_id` | `text` | `text("template_id").notNull().references(() => workOrders.wouuid)` | 1520 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 1521 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 1522 |
| `executionId` | `execution_id` | `text` | `text("execution_id").notNull().unique()` | 1523 |
| `dateCompleted` | `date_completed` | `text` | `text("date_completed")` | 1526 |
| `runningHoursAtCompletion` | `running_hours_at_completion` | `decimal` | `decimal("running_hours_at_completion", { precision: 10, scale: 2 })` | 1527 |
| `performedBy` | `performed_by` | `text` | `text("performed_by")` | 1528 |
| `approvedBy` | `approved_by` | `text` | `text("approved_by")` | 1529 |
| `status` | `status` | `text` | `text("status").notNull().default("In Progress")` | 1530 |
| `uploadedDocuments` | `uploaded_documents` | `json` | `json("uploaded_documents").notNull().default([])` | 1533 |
| `consumedSpareParts` | `consumed_spare_parts` | `json` | `json("consumed_spare_parts").notNull().default([])` | 1534 |
| `workDescription` | `work_description` | `text` | `text("work_description")` | 1537 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 1538 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1540 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 1541 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1542 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1543 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1544 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1545 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1546 |

### B. import_history

Schema symbol: `importHistory`. Declaration: `shared/schema.ts:1897`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 1898 |
| `type` | `type` | `text` | `text("type").notNull()` | 1899 |
| `mode` | `mode` | `text` | `text("mode").notNull()` | 1900 |
| `archiveMissing` | `archive_missing` | `boolean` | `boolean("archive_missing").notNull().default(false)` | 1901 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 1902 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").references(() => vessels.vuuid)` | 1903 |
| `created` | `created` | `integer` | `integer("created").notNull().default(0)` | 1904 |
| `updated` | `updated` | `integer` | `integer("updated").notNull().default(0)` | 1905 |
| `skipped` | `skipped` | `integer` | `integer("skipped").notNull().default(0)` | 1906 |
| `archived` | `archived` | `integer` | `integer("archived").notNull().default(0)` | 1907 |
| `startedAt` | `started_at` | `timestamp` | `timestamp("started_at").notNull().defaultNow()` | 1908 |
| `finishedAt` | `finished_at` | `timestamp` | `timestamp("finished_at")` | 1909 |
| `status` | `status` | `text` | `text("status").notNull()` | 1910 |
| `originalName` | `original_name` | `text` | `text("original_name")` | 1911 |
| `fileSize` | `file_size` | `integer` | `integer("file_size")` | 1912 |
| `storedFilePath` | `stored_file_path` | `text` | `text("stored_file_path")` | 1913 |
| `undoneAt` | `undone_at` | `timestamp` | `timestamp("undone_at")` | 1914 |
| `errorMessage` | `error_message` | `text` | `text("error_message")` | 1915 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1916 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1917 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1918 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1919 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1920 |

### B. import_change_log

Schema symbol: `importChangeLog`. Declaration: `shared/schema.ts:1928`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | `text("id").primaryKey()` | 1929 |
| `importHistoryId` | `import_history_id` | `text` | `text("import_history_id").notNull().references(() => importHistory.id, { onDelete: "cascade" })` | 1930 |
| `entityType` | `entity_type` | `text` | `text("entity_type").notNull()` | 1931 |
| `entityId` | `entity_id` | `text` | `text("entity_id").notNull()` | 1932 |
| `operation` | `operation` | `text` | `text("operation").notNull()` | 1933 |
| `previousData` | `previous_data` | `json` | `json("previous_data")` | 1934 |
| `newData` | `new_data` | `json` | `json("new_data")` | 1935 |
| `checksum` | `checksum` | `text` | `text("checksum").notNull()` | 1936 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1937 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1938 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1939 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1940 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1941 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1942 |

### B. makers

Schema symbol: `makers`. Declaration: `shared/schema.ts:1963`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1964 |
| `makerCode` | `maker_code` | `text` | `text("maker_code").notNull().unique()` | 1965 |
| `makerName` | `maker_name` | `text` | `text("maker_name").notNull()` | 1966 |
| `address` | `address` | `text` | `text("address")` | 1967 |
| `addressId` | `address_id` | `text` | `text("address_id")` | 1968 |
| `contactPerson` | `contact_person` | `text` | `text("contact_person")` | 1969 |
| `email` | `email` | `text` | `text("email")` | 1970 |
| `phone` | `phone` | `text` | `text("phone")` | 1971 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 1972 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 1973 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 1974 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 1975 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 1976 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 1977 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 1978 |

### B. master_lists

Schema symbol: `masterLists`. Declaration: `shared/schema.ts:1996`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 1997 |
| `listType` | `list_type` | `text` | `text("list_type").notNull()` | 1998 |
| `listKey` | `list_key` | `text` | `text("list_key").notNull()` | 1999 |
| `listValue` | `list_value` | `text` | `text("list_value").notNull()` | 2000 |
| `displayOrder` | `display_order` | `integer` | `integer("display_order").notNull().default(0)` | 2001 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2002 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2003 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2004 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2005 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2006 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2007 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2008 |

### B. master_list_types

Schema symbol: `masterListTypes`. Declaration: `shared/schema.ts:2025`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2026 |
| `mltuuid` | `mltuuid` | `text` | ``text("mltuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 2027 |
| `listTypeKey` | `list_type_key` | `text` | `text("list_type_key").notNull().unique()` | 2028 |
| `label` | `label` | `text` | `text("label").notNull()` | 2029 |
| `section` | `section` | `text` | `text("section").notNull()` | 2030 |
| `isSystem` | `is_system` | `boolean` | `boolean("is_system").notNull().default(false)` | 2031 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2032 |
| `displayOrder` | `display_order` | `integer` | `integer("display_order").notNull().default(0)` | 2033 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2034 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2035 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2036 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2037 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 2038 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 2039 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 2040 |

### B. component_running_hours_log

Schema symbol: `componentRunningHoursLog`. Declaration: `shared/schema.ts:2061`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2062 |
| `crhluuid` | `crhluuid` | `text` | ``text("crhluuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 2063 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2064 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull()` | 2065 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 2066 |
| `previousRh` | `previous_rh` | `decimal` | `decimal("previous_rh", { precision: 10, scale: 2 }).notNull()` | 2067 |
| `newRh` | `new_rh` | `decimal` | `decimal("new_rh", { precision: 10, scale: 2 }).notNull()` | 2068 |
| `deltaRh` | `delta_rh` | `decimal` | `decimal("delta_rh", { precision: 10, scale: 2 }).notNull()` | 2069 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by").notNull()` | 2070 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2071 |
| `updateSource` | `update_source` | `text` | `text("update_source").notNull()` | 2072 |
| `notes` | `notes` | `text` | `text("notes")` | 2073 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2074 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2075 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2076 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2077 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2078 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2079 |

### B. audit_log

Schema symbol: `auditLog`. Declaration: `shared/schema.ts:2098`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2099 |
| `timestamp` | `timestamp` | `timestamp` | `timestamp("timestamp").notNull().defaultNow()` | 2100 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 2101 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code")` | 2102 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 2103 |
| `entityType` | `entity_type` | `text` | `text("entity_type").notNull()` | 2104 |
| `entityId` | `entity_id` | `text` | `text("entity_id").notNull()` | 2105 |
| `actionType` | `action_type` | `text` | `text("action_type").notNull()` | 2106 |
| `fieldName` | `field_name` | `text` | `text("field_name")` | 2107 |
| `oldValue` | `old_value` | `text` | `text("old_value")` | 2108 |
| `newValue` | `new_value` | `text` | `text("new_value")` | 2109 |
| `source` | `source` | `text` | `text("source").notNull()` | 2110 |
| `payload` | `payload` | `json` | `json("payload")` | 2111 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2112 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2113 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2114 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2115 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2116 |
| `disposedAt` | `disposed_at` | `timestamp` | `timestamp("disposed_at")` | 2117 |
| `disposedByUuid` | `disposed_by_uuid` | `text` | `text("disposed_by_uuid")` | 2118 |

### B. retention_settings

Schema symbol: `retentionSettings`. Declaration: `shared/schema.ts:2140`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2141 |
| `category` | `category` | `text` | `text("category").notNull().unique()` | 2142 |
| `label` | `label` | `text` | `text("label").notNull()` | 2143 |
| `retentionValue` | `retention_value` | `integer` | `integer("retention_value").notNull().default(0)` | 2144 |
| `retentionUnit` | `retention_unit` | `text` | `text("retention_unit").notNull().default("years")` | 2145 |
| `enabled` | `enabled` | `boolean` | `boolean("enabled").notNull().default(true)` | 2146 |
| `isProtected` | `is_protected` | `boolean` | `boolean("is_protected").notNull().default(true)` | 2147 |
| `minValue` | `min_value` | `integer` | `integer("min_value").notNull().default(0)` | 2148 |
| `minUnit` | `min_unit` | `text` | `text("min_unit").notNull().default("years")` | 2149 |
| `description` | `description` | `text` | `text("description")` | 2150 |
| `updatedAt` | `updated_at` | `timestamp` | `timestamp("updated_at").notNull().defaultNow()` | 2151 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2152 |

### B. component_documents

Schema symbol: `componentDocuments`. Declaration: `shared/schema.ts:2157`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2158 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 2159 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull()` | 2160 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2161 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code")` | 2162 |
| `fileName` | `file_name` | `text` | `text("file_name").notNull()` | 2163 |
| `fileKey` | `file_key` | `text` | `text("file_key").notNull()` | 2164 |
| `fileType` | `file_type` | `text` | `text("file_type").notNull()` | 2165 |
| `fileSize` | `file_size` | `integer` | `integer("file_size")` | 2166 |
| `version` | `version` | `text` | `text("version").notNull().default("1.0")` | 2167 |
| `uploadedBy` | `uploaded_by` | `text` | `text("uploaded_by").notNull()` | 2168 |
| `uploadedAt` | `uploaded_at` | `timestamp` | `timestamp("uploaded_at").notNull().defaultNow()` | 2169 |
| `canShipView` | `can_ship_view` | `boolean` | `boolean("can_ship_view").notNull().default(true)` | 2170 |
| `canShipDownload` | `can_ship_download` | `boolean` | `boolean("can_ship_download").notNull().default(false)` | 2171 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2172 |
| `notes` | `notes` | `text` | `text("notes")` | 2173 |
| `storageBackend` | `storage_backend` | `text` | `text("storage_backend").default("object")` | 2174 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2175 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2176 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2177 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2178 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2179 |

### B. component_class_regulatory

Schema symbol: `componentClassRegulatory`. Declaration: `shared/schema.ts:2197`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2198 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 2199 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull()` | 2200 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2201 |
| `classificationSociety` | `classification_society` | `text` | `text("classification_society").notNull()` | 2202 |
| `surveyType` | `survey_type` | `text` | `text("survey_type").notNull()` | 2203 |
| `certificateNumber` | `certificate_number` | `text` | `text("certificate_number")` | 2204 |
| `issueDate` | `issue_date` | `text` | `text("issue_date")` | 2205 |
| `expiryDate` | `expiry_date` | `text` | `text("expiry_date")` | 2206 |
| `lastClassSurvey` | `last_class_survey` | `text` | `text("last_class_survey")` | 2207 |
| `nextSurveyDue` | `next_survey_due` | `text` | `text("next_survey_due")` | 2208 |
| `classRequirements` | `class_requirements` | `text` | `text("class_requirements")` | 2209 |
| `classCode` | `class_code` | `text` | `text("class_code")` | 2210 |
| `information` | `information` | `text` | `text("information")` | 2211 |
| `surveyStatus` | `survey_status` | `text` | `text("survey_status").notNull().default("Active")` | 2212 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 2213 |
| `createdBy` | `created_by` | `text` | `text("created_by").notNull()` | 2214 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2215 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by")` | 2216 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2217 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2218 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2219 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2220 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2221 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2222 |

### B. component_maintenance_history

Schema symbol: `componentMaintenanceHistory`. Declaration: `shared/schema.ts:2241`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2242 |
| `cmhuuid` | `cmhuuid` | `text` | ``text("cmhuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 2243 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 2244 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull()` | 2245 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2246 |
| `jobId` | `job_id` | `text` | `text("job_id").references(() => jobs.juuid)` | 2247 |
| `jobCode` | `job_code` | `text` | `text("job_code")` | 2248 |
| `workOrderId` | `work_order_id` | `text` | `text("work_order_id").notNull().references(() => workOrders.wouuid)` | 2249 |
| `workOrderNo` | `work_order_no` | `text` | `text("work_order_no").notNull()` | 2250 |
| `jobTitle` | `job_title` | `text` | `text("job_title").notNull()` | 2251 |
| `maintenanceType` | `maintenance_type` | `text` | `text("maintenance_type").notNull()` | 2252 |
| `dateCompleted` | `date_completed` | `text` | `text("date_completed").notNull()` | 2253 |
| `runningHoursAtCompletion` | `running_hours_at_completion` | `decimal` | `decimal("running_hours_at_completion", { precision: 10, scale: 2 })` | 2254 |
| `performedBy` | `performed_by` | `text` | `text("performed_by").notNull()` | 2255 |
| `approvedBy` | `approved_by` | `text` | `text("approved_by")` | 2256 |
| `approvalDate` | `approval_date` | `text` | `text("approval_date")` | 2257 |
| `status` | `status` | `text` | `text("status").notNull().default("Approved")` | 2258 |
| `workDescription` | `work_description` | `text` | `text("work_description")` | 2259 |
| `sparesUsed` | `spares_used` | `json` | `json("spares_used")` | 2260 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 2261 |
| `isComponentReplaced` | `is_component_replaced` | `boolean` | `boolean("is_component_replaced").notNull().default(false)` | 2262 |
| `missedCycles` | `missed_cycles` | `integer` | `integer("missed_cycles").default(0)` | 2263 |
| `originalDueDate` | `original_due_date` | `text` | `text("original_due_date")` | 2264 |
| `isSkipped` | `is_skipped` | `boolean` | `boolean("is_skipped").default(false)` | 2265 |
| `skippedCycleDate` | `skipped_cycle_date` | `text` | `text("skipped_cycle_date")` | 2266 |
| `sourceWorkOrderId` | `source_work_order_id` | `text` | `text("source_work_order_id")` | 2267 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2268 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2269 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2270 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2271 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2272 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2273 |
| `disposedAt` | `disposed_at` | `timestamp` | `timestamp("disposed_at")` | 2274 |
| `disposedByUuid` | `disposed_by_uuid` | `text` | `text("disposed_by_uuid")` | 2275 |

### B. component_requisitions

Schema symbol: `componentRequisitions`. Declaration: `shared/schema.ts:2296`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2297 |
| `requisitionNo` | `requisition_no` | `text` | `text("requisition_no").notNull().unique()` | 2298 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 2299 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull()` | 2300 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2301 |
| `raisedOn` | `raised_on` | `text` | `text("raised_on").notNull()` | 2302 |
| `itemOrService` | `item_or_service` | `text` | `text("item_or_service").notNull()` | 2303 |
| `relatedPartCode` | `related_part_code` | `text` | `text("related_part_code")` | 2304 |
| `relatedPartName` | `related_part_name` | `text` | `text("related_part_name")` | 2305 |
| `quantity` | `quantity` | `integer` | `integer("quantity").notNull().default(1)` | 2306 |
| `uom` | `uom` | `text` | `text("uom").default("EA")` | 2307 |
| `status` | `status` | `text` | `text("status").notNull().default("Draft")` | 2308 |
| `priority` | `priority` | `text` | `text("priority").notNull().default("Normal")` | 2309 |
| `requestedBy` | `requested_by` | `text` | `text("requested_by").notNull()` | 2310 |
| `approvedBy` | `approved_by` | `text` | `text("approved_by")` | 2311 |
| `approvalDate` | `approval_date` | `text` | `text("approval_date")` | 2312 |
| `purchaseOrderNo` | `purchase_order_no` | `text` | `text("purchase_order_no")` | 2313 |
| `expectedDelivery` | `expected_delivery` | `text` | `text("expected_delivery")` | 2314 |
| `actualDelivery` | `actual_delivery` | `text` | `text("actual_delivery")` | 2315 |
| `supplier` | `supplier` | `text` | `text("supplier")` | 2316 |
| `estimatedCost` | `estimated_cost` | `decimal` | `decimal("estimated_cost", { precision: 10, scale: 2 })` | 2317 |
| `actualCost` | `actual_cost` | `decimal` | `decimal("actual_cost", { precision: 10, scale: 2 })` | 2318 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 2319 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2320 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2321 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2322 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2323 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2324 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2325 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2326 |

### B. pms_vessel_settings

Schema symbol: `pmsVesselSettings`. Declaration: `shared/schema.ts:2346`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2347 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().unique().references(() => vessels.vuuid)` | 2348 |
| `settingsMode` | `settings_mode` | `text` | `text("settings_mode").notNull().default("COMPANY_STANDARD")` | 2350 |
| `calendarLeadDaysCritical` | `calendar_lead_days_critical` | `integer` | `integer("calendar_lead_days_critical").notNull().default(7)` | 2352 |
| `calendarLeadDaysNonCritical` | `calendar_lead_days_non_critical` | `integer` | `integer("calendar_lead_days_non_critical").notNull().default(14)` | 2353 |
| `calendarGraceMode` | `calendar_grace_mode` | `text` | `text("calendar_grace_mode").notNull().default("COMPANY_STANDARD")` | 2354 |
| `calendarGraceDays` | `calendar_grace_days` | `integer` | `integer("calendar_grace_days").notNull().default(7)` | 2355 |
| `calendarGraceMethod` | `calendar_grace_method` | `text` | `text("calendar_grace_method").notNull().default("FIXED_DAYS")` | 2356 |
| `calendarGraceValue` | `calendar_grace_value` | `integer` | `integer("calendar_grace_value").notNull().default(7)` | 2357 |
| `calendarGraceScope` | `calendar_grace_scope` | `text` | `text("calendar_grace_scope").notNull().default("ALL_WORK_ORDERS")` | 2358 |
| `calendarFallbackMethod` | `calendar_fallback_method` | `text` | `text("calendar_fallback_method")` | 2359 |
| `calendarFallbackGraceDays` | `calendar_fallback_grace_days` | `integer` | `integer("calendar_fallback_grace_days")` | 2360 |
| `rhLeadHoursCritical` | `rh_lead_hours_critical` | `integer` | `integer("rh_lead_hours_critical").notNull().default(50)` | 2362 |
| `rhLeadHoursNonCritical` | `rh_lead_hours_non_critical` | `integer` | `integer("rh_lead_hours_non_critical").notNull().default(100)` | 2363 |
| `rhGraceHours` | `rh_grace_hours` | `integer` | `integer("rh_grace_hours").notNull().default(168)` | 2364 |
| `rhGraceMethod` | `rh_grace_method` | `text` | `text("rh_grace_method").notNull().default("FIXED_HOURS")` | 2365 |
| `rhGraceValue` | `rh_grace_value` | `integer` | `integer("rh_grace_value").notNull().default(168)` | 2366 |
| `rhGraceScope` | `rh_grace_scope` | `text` | `text("rh_grace_scope").notNull().default("ALL_WORK_ORDERS")` | 2367 |
| `rhFallbackMethod` | `rh_fallback_method` | `text` | `text("rh_fallback_method")` | 2368 |
| `rhFallbackGraceHours` | `rh_fallback_grace_hours` | `integer` | `integer("rh_fallback_grace_hours")` | 2369 |
| `locationAName` | `location_a_name` | `text` | `text("location_a_name").notNull().default("Location A")` | 2371 |
| `locationBName` | `location_b_name` | `text` | `text("location_b_name").notNull().default("Location B")` | 2372 |
| `officeWoGenerationEnabled` | `office_wo_generation_enabled` | `boolean` | `boolean("office_wo_generation_enabled").notNull().default(false)` | 2376 |
| `officeRhEntryEnabled` | `office_rh_entry_enabled` | `boolean` | `boolean("office_rh_entry_enabled").notNull().default(false)` | 2380 |
| `rhValidationEnabled` | `rh_validation_enabled` | `boolean` | `boolean("rh_validation_enabled").notNull().default(true)` | 2384 |
| `superintendentLockEnabled` | `superintendent_lock_enabled` | `boolean` | `boolean("superintendent_lock_enabled").notNull().default(false)` | 2388 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by").notNull()` | 2390 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2391 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2392 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2393 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2394 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2395 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2396 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2397 |

### B. company_standard_grace_settings

Schema symbol: `companyStandardGraceSettings`. Declaration: `shared/schema.ts:2416`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2417 |
| `singletonKey` | `singleton_key` | `text` | `text("singleton_key").notNull().unique().default("ACTIVE")` | 2418 |
| `graceMethod` | `grace_method` | `text` | `text("grace_method").notNull().default("FIXED_DAYS")` | 2420 |
| `graceValue` | `grace_value` | `integer` | `integer("grace_value").default(7)` | 2421 |
| `scope` | `scope` | `text` | `text("scope").notNull().default("LAST_WEEK_OF_MONTH")` | 2422 |
| `fallbackGraceDays` | `fallback_grace_days` | `integer` | `integer("fallback_grace_days")` | 2423 |
| `fallbackMethod` | `fallback_method` | `text` | `text("fallback_method").default("MONTH_END")` | 2424 |
| `calendarLeadDaysCritical` | `calendar_lead_days_critical` | `integer` | `integer("calendar_lead_days_critical").notNull().default(7)` | 2426 |
| `calendarLeadDaysNonCritical` | `calendar_lead_days_non_critical` | `integer` | `integer("calendar_lead_days_non_critical").notNull().default(14)` | 2427 |
| `rhLeadHoursCritical` | `rh_lead_hours_critical` | `integer` | `integer("rh_lead_hours_critical").notNull().default(720)` | 2428 |
| `rhLeadHoursNonCritical` | `rh_lead_hours_non_critical` | `integer` | `integer("rh_lead_hours_non_critical").notNull().default(720)` | 2429 |
| `rhGraceHours` | `rh_grace_hours` | `integer` | `integer("rh_grace_hours").notNull().default(168)` | 2430 |
| `rhGraceMethod` | `rh_grace_method` | `text` | `text("rh_grace_method").notNull().default("FIXED_HOURS")` | 2432 |
| `rhGraceValue` | `rh_grace_value` | `integer` | `integer("rh_grace_value").notNull().default(168)` | 2433 |
| `rhGraceScope` | `rh_grace_scope` | `text` | `text("rh_grace_scope").notNull().default("ALL_WORK_ORDERS")` | 2434 |
| `rhFallbackMethod` | `rh_fallback_method` | `text` | `text("rh_fallback_method")` | 2435 |
| `rhFallbackGraceHours` | `rh_fallback_grace_hours` | `integer` | `integer("rh_fallback_grace_hours")` | 2436 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by").notNull()` | 2438 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2439 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2440 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2441 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2442 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2443 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2444 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 2445 |

### B. company_approval_settings

Schema symbol: `companyApprovalSettings`. Declaration: `shared/schema.ts:2464`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2465 |
| `singletonKey` | `singleton_key` | `text` | `text("singleton_key").notNull().unique().default("ACTIVE")` | 2466 |
| `superintendentLockEnabled` | `superintendent_lock_enabled` | `boolean` | `boolean("superintendent_lock_enabled").notNull().default(true)` | 2467 |
| `updatedBy` | `updated_by` | `text` | `text("updated_by")` | 2468 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").defaultNow()` | 2469 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2470 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2472 |

### B. maker_list

Schema symbol: `makerList`. Declaration: `shared/schema.ts:2481`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2482 |
| `makerListUuid` | `maker_list_uuid` | `text` | ``text("maker_list_uuid").default(sql`gen_random_uuid()`)`` | 2483 |
| `makerCode` | `maker_code` | `text` | `text("maker_code").notNull().unique()` | 2484 |
| `makerName` | `maker_name` | `text` | `text("maker_name").notNull()` | 2485 |
| `address` | `address` | `text` | `text("address")` | 2486 |
| `addressId` | `address_id` | `text` | `text("address_id")` | 2487 |
| `contactPerson` | `contact_person` | `text` | `text("contact_person")` | 2488 |
| `email` | `email` | `text` | `text("email")` | 2489 |
| `phone` | `phone` | `text` | `text("phone")` | 2490 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2491 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 2492 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2493 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2494 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2495 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2496 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2497 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2498 |

### B. fleet_components

Schema symbol: `fleetComponents`. Declaration: `shared/schema.ts:2522`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2523 |
| `fleetComponentsUuid` | `fleet_components_uuid` | `text` | ``text("fleet_components_uuid").default(sql`gen_random_uuid()`)`` | 2524 |
| `parentFleetEquipmentCode` | `parent_fleet_equipment_code` | `text` | `text("parent_fleet_equipment_code")` | 2525 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull().unique()` | 2526 |
| `fleetEquipmentName` | `fleet_equipment_name` | `text` | `text("fleet_equipment_name").notNull()` | 2527 |
| `componentCategory` | `component_category` | `text` | `text("component_category")` | 2528 |
| `makerName` | `maker_name` | `text` | `text("maker_name")` | 2529 |
| `makerCode` | `maker_code` | `text` | `text("maker_code")` | 2530 |
| `model` | `model` | `text` | `text("model")` | 2531 |
| `modelCode` | `model_code` | `text` | `text("model_code")` | 2532 |
| `location` | `location` | `text` | `text("location")` | 2533 |
| `rating` | `rating` | `text` | `text("rating")` | 2534 |
| `eqptSystemDept` | `eqpt_system_dept` | `text` | `text("eqpt_system_dept")` | 2535 |
| `notes` | `notes` | `text` | `text("notes")` | 2536 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2537 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 2538 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2539 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2540 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2541 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2542 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2543 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2544 |

### B. fleet_jobs

Schema symbol: `fleetJobs`. Declaration: `shared/schema.ts:2567`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2568 |
| `fleetJobsUuid` | `fleet_jobs_uuid` | `text` | ``text("fleet_jobs_uuid").default(sql`gen_random_uuid()`)`` | 2569 |
| `jobCode` | `job_code` | `text` | `text("job_code").notNull()` | 2570 |
| `fleetComponentsUuid` | `fleet_components_uuid` | `text` | `text("fleet_components_uuid")` | 2571 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull()` | 2572 |
| `fleetEquipmentName` | `fleet_equipment_name` | `text` | `text("fleet_equipment_name").notNull()` | 2573 |
| `woTitle` | `wo_title` | `text` | `text("wo_title").notNull()` | 2574 |
| `maintenanceBasis` | `maintenance_basis` | `text` | `text("maintenance_basis")` | 2575 |
| `intervalValue` | `interval_value` | `text` | `text("interval_value")` | 2576 |
| `unit` | `unit` | `text` | `text("unit")` | 2577 |
| `taskType` | `task_type` | `text` | `text("task_type").notNull()` | 2578 |
| `assignedTo` | `assigned_to` | `text` | `text("assigned_to").notNull()` | 2579 |
| `approver` | `approver` | `text` | `text("approver").notNull()` | 2580 |
| `level2ReviewerRankId` | `level2_reviewer_rank_id` | `text` | `text("level2_reviewer_rank_id")` | 2581 |
| `jobPriority` | `job_priority` | `text` | `text("job_priority").notNull()` | 2582 |
| `classRelated` | `class_related` | `text` | `text("class_related").notNull()` | 2583 |
| `briefWorkDescription` | `brief_work_description` | `text` | `text("brief_work_description").notNull()` | 2584 |
| `department` | `department` | `text` | `text("department").notNull()` | 2585 |
| `criticality` | `criticality` | `text` | `text("criticality").notNull()` | 2586 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2587 |
| `requiredSpareParts` | `required_spare_parts` | `json` | `json("required_spare_parts").default([])` | 2588 |
| `requiredTools` | `required_tools` | `json` | `json("required_tools").default([])` | 2589 |
| `ppeRequirements` | `ppe_requirements` | `text` | `text("ppe_requirements")` | 2590 |
| `permitRequirements` | `permit_requirements` | `text` | `text("permit_requirements")` | 2591 |
| `otherSafetyRequirements` | `other_safety_requirements` | `text` | `text("other_safety_requirements")` | 2592 |
| `intervalRunningHour` | `interval_running_hour` | `integer` | `integer("interval_running_hour")` | 2593 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 2594 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2595 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2596 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2597 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2598 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2599 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2600 |

### B. fleet_spares

Schema symbol: `fleetSpares`. Declaration: `shared/schema.ts:2623`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2624 |
| `fleetSparesUuid` | `fleet_spares_uuid` | `text` | ``text("fleet_spares_uuid").default(sql`gen_random_uuid()`)`` | 2625 |
| `fleetComponentsUuid` | `fleet_components_uuid` | `text` | `text("fleet_components_uuid")` | 2626 |
| `partCode` | `part_code` | `text` | `text("part_code").notNull()` | 2627 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull()` | 2628 |
| `fleetEquipmentName` | `fleet_equipment_name` | `text` | `text("fleet_equipment_name").notNull()` | 2629 |
| `partName` | `part_name` | `text` | `text("part_name").notNull()` | 2630 |
| `partNumber` | `part_number` | `text` | `text("part_number")` | 2631 |
| `unitOfMeasurement` | `unit_of_measurement` | `text` | `text("unit_of_measurement").notNull()` | 2632 |
| `drawingNumber` | `drawing_number` | `text` | `text("drawing_number")` | 2633 |
| `positionNumber` | `position_number` | `text` | `text("position_number")` | 2634 |
| `note` | `note` | `text` | `text("note")` | 2635 |
| `specification` | `specification` | `text` | `text("specification")` | 2636 |
| `maker` | `maker` | `text` | `text("maker")` | 2637 |
| `makerCode` | `maker_code` | `text` | `text("maker_code")` | 2638 |
| `manualName` | `manual_name` | `text` | `text("manual_name")` | 2639 |
| `pageNumber` | `page_number` | `text` | `text("page_number")` | 2640 |
| `criticality` | `criticality` | `text` | `text("criticality")` | 2641 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2642 |
| `ihm` | `ihm` | `text` | `text("ihm")` | 2643 |
| `evidenceType` | `evidence_type` | `text` | `text("evidence_type")` | 2644 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 2645 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2646 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2647 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2648 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2649 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2650 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2651 |

### B. sfi_details

Schema symbol: `sfiDetails`. Declaration: `shared/schema.ts:2673`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2674 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull().unique()` | 2675 |
| `componentName` | `component_name` | `text` | `text("component_name").notNull()` | 2676 |
| `description` | `description` | `text` | `text("description")` | 2677 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2678 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2679 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2680 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2681 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2682 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2683 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2684 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2685 |

### B. master_data

Schema symbol: `masterData`. Declaration: `shared/schema.ts:2703`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2704 |
| `slNo` | `sl_no` | `integer` | `integer("sl_no")` | 2705 |
| `makerName` | `maker_name` | `text` | `text("maker_name").notNull()` | 2706 |
| `makerCode` | `maker_code` | `text` | `text("maker_code").notNull()` | 2707 |
| `countMaker` | `count_maker` | `integer` | `integer("count_maker")` | 2708 |
| `model` | `model` | `text` | `text("model").notNull()` | 2709 |
| `modelCode` | `model_code` | `text` | `text("model_code").notNull()` | 2710 |
| `countSfiCode` | `count_sfi_code` | `integer` | `integer("count_sfi_code")` | 2711 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull().unique()` | 2712 |
| `sfiCode` | `sfi_code` | `text` | `text("sfi_code").notNull()` | 2713 |
| `assignedSubCode` | `assigned_sub_code` | `text` | `text("assigned_sub_code")` | 2714 |
| `vesselName` | `vessel_name` | `text` | `text("vessel_name")` | 2715 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code")` | 2716 |
| `equipmentName` | `equipment_name` | `text` | `text("equipment_name").notNull()` | 2717 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2718 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2719 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 2720 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2721 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2722 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2723 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2724 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2725 |

### B. fleet_vessel_mapping

Schema symbol: `fleetVesselMapping`. Declaration: `shared/schema.ts:2747`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2748 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull()` | 2749 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2750 |
| `vesselName` | `vessel_name` | `text` | `text("vessel_name")` | 2751 |
| `mappedBy` | `mapped_by` | `text` | `text("mapped_by").notNull()` | 2752 |
| `mappedAt` | `mapped_at` | `timestamp` | `timestamp("mapped_at").notNull().defaultNow()` | 2753 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2754 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2755 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2756 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2757 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2758 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2759 |

### B. fleet_component_mapping

Schema symbol: `fleetComponentMapping`. Declaration: `shared/schema.ts:2778`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2779 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull()` | 2780 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2781 |
| `componentCode` | `component_code` | `text` | `text("component_code").notNull()` | 2782 |
| `componentId` | `component_id` | `text` | `text("component_id").references(() => components.cuuid)` | 2783 |
| `componentName` | `component_name` | `text` | `text("component_name")` | 2784 |
| `mappedBy` | `mapped_by` | `text` | `text("mapped_by").notNull()` | 2785 |
| `mappedAt` | `mapped_at` | `timestamp` | `timestamp("mapped_at").notNull().defaultNow()` | 2786 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2787 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2788 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2789 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2790 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2791 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2792 |

### B. fleet_job_vessel_mapping

Schema symbol: `fleetJobVesselMapping`. Declaration: `shared/schema.ts:2812`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2813 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull()` | 2814 |
| `jobCode` | `job_code` | `text` | `text("job_code").notNull()` | 2815 |
| `jobId` | `job_id` | `text` | `text("job_id").references(() => jobs.juuid)` | 2816 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2817 |
| `vesselName` | `vessel_name` | `text` | `text("vessel_name")` | 2818 |
| `mappedBy` | `mapped_by` | `text` | `text("mapped_by").notNull()` | 2819 |
| `mappedAt` | `mapped_at` | `timestamp` | `timestamp("mapped_at").notNull().defaultNow()` | 2820 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2821 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2822 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2823 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2824 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2825 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2826 |

### B. fleet_spare_vessel_mapping

Schema symbol: `fleetSpareVesselMapping`. Declaration: `shared/schema.ts:2845`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2846 |
| `fleetEquipmentCode` | `fleet_equipment_code` | `text` | `text("fleet_equipment_code").notNull()` | 2847 |
| `partCode` | `part_code` | `text` | `text("part_code").notNull()` | 2848 |
| `spareId` | `spare_id` | `text` | `text("spare_id")` | 2849 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code").notNull()` | 2850 |
| `vesselName` | `vessel_name` | `text` | `text("vessel_name")` | 2851 |
| `mappedBy` | `mapped_by` | `text` | `text("mapped_by").notNull()` | 2852 |
| `mappedAt` | `mapped_at` | `timestamp` | `timestamp("mapped_at").notNull().defaultNow()` | 2853 |
| `isActive` | `is_active` | `boolean` | `boolean("is_active").notNull().default(true)` | 2854 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2855 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2856 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2857 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2858 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2859 |

### B. bulk_import_history

Schema symbol: `bulkImportHistory`. Declaration: `shared/schema.ts:2878`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2879 |
| `biuuid` | `biuuid` | `text` | `text("biuuid").notNull().unique()` | 2880 |
| `vesselCode` | `vessel_code` | `text` | `text("vessel_code")` | 2881 |
| `vesselName` | `vessel_name` | `text` | `text("vessel_name")` | 2882 |
| `moduleType` | `module_type` | `text` | `text("module_type").notNull()` | 2883 |
| `sheetName` | `sheet_name` | `text` | `text("sheet_name")` | 2884 |
| `fileName` | `file_name` | `text` | `text("file_name").notNull()` | 2885 |
| `fileSize` | `file_size` | `integer` | `integer("file_size")` | 2886 |
| `uploadedBy` | `uploaded_by` | `text` | `text("uploaded_by").notNull()` | 2887 |
| `uploadedByName` | `uploaded_by_name` | `text` | `text("uploaded_by_name")` | 2888 |
| `uploadedAt` | `uploaded_at` | `timestamp` | `timestamp("uploaded_at").notNull().defaultNow()` | 2889 |
| `totalRows` | `total_rows` | `integer` | `integer("total_rows").notNull().default(0)` | 2890 |
| `successCount` | `success_count` | `integer` | `integer("success_count").notNull().default(0)` | 2891 |
| `failedCount` | `failed_count` | `integer` | `integer("failed_count").notNull().default(0)` | 2892 |
| `skippedCount` | `skipped_count` | `integer` | `integer("skipped_count").notNull().default(0)` | 2893 |
| `status` | `status` | `text` | `text("status").notNull().default("Processing")` | 2894 |
| `errorSummary` | `error_summary` | `text` | `text("error_summary")` | 2895 |
| `isFleetImport` | `is_fleet_import` | `boolean` | `boolean("is_fleet_import").notNull().default(false)` | 2896 |
| `templateVersion` | `template_version` | `text` | `text("template_version")` | 2897 |
| `processingTimeMs` | `processing_time_ms` | `integer` | `integer("processing_time_ms")` | 2898 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2899 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2900 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2901 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2902 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2903 |

### B. bulk_import_errors

Schema symbol: `bulkImportErrors`. Declaration: `shared/schema.ts:2924`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 2925 |
| `importId` | `import_id` | `integer` | `integer("import_id").notNull()` | 2926 |
| `importUuid` | `import_uuid` | `text` | `text("import_uuid").notNull()` | 2927 |
| `rowNumber` | `row_number` | `integer` | `integer("row_number").notNull()` | 2929 |
| `fieldName` | `field_name` | `text` | `text("field_name")` | 2930 |
| `fieldValue` | `field_value` | `text` | `text("field_value")` | 2931 |
| `errorType` | `error_type` | `text` | `text("error_type").notNull()` | 2932 |
| `errorDescription` | `error_description` | `text` | `text("error_description").notNull()` | 2933 |
| `recommendedFix` | `recommended_fix` | `text` | `text("recommended_fix")` | 2934 |
| `severity` | `severity` | `text` | `text("severity").notNull().default("Error")` | 2935 |
| `rawRowData` | `raw_row_data` | `json` | `json("raw_row_data")` | 2936 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 2937 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 2938 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 2939 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 2940 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 2941 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 2942 |

### B. work_order_execution_details

Schema symbol: `workOrderExecutionDetails`. Declaration: `shared/schema.ts:3040`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3041 |
| `woeduuid` | `woeduuid` | `text` | ``text("woeduuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 3042 |
| `workOrderId` | `work_order_id` | `text` | `text("work_order_id").notNull().references(() => workOrders.wouuid)` | 3043 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3044 |
| `executedBy` | `executed_by` | `text` | `text("executed_by")` | 3045 |
| `executedDate` | `executed_date` | `text` | `text("executed_date")` | 3046 |
| `completionNotes` | `completion_notes` | `text` | `text("completion_notes")` | 3047 |
| `partsUsed` | `parts_used` | `json` | `json("parts_used").$type<any[]>().default([])` | 3048 |
| `toolsUsed` | `tools_used` | `json` | `json("tools_used").$type<any[]>().default([])` | 3049 |
| `laborHours` | `labor_hours` | `decimal` | `decimal("labor_hours", { precision: 6, scale: 2 })` | 3050 |
| `findings` | `findings` | `text` | `text("findings")` | 3051 |
| `recommendations` | `recommendations` | `text` | `text("recommendations")` | 3052 |
| `nextActionRequired` | `next_action_required` | `text` | `text("next_action_required")` | 3053 |
| `qualityCheckBy` | `quality_check_by` | `text` | `text("quality_check_by")` | 3054 |
| `qualityCheckDate` | `quality_check_date` | `text` | `text("quality_check_date")` | 3055 |
| `qualityCheckNotes` | `quality_check_notes` | `text` | `text("quality_check_notes")` | 3056 |
| `attachments` | `attachments` | `json` | `json("attachments").$type<any[]>().default([])` | 3057 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 3058 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 3059 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3060 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3061 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3062 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3063 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3064 |

### B. locations

Schema symbol: `locations`. Declaration: `shared/schema.ts:3107`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3108 |
| `luuid` | `luuid` | `text` | ``text("luuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 3109 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3110 |
| `locationName` | `location_name` | `text` | `text("location_name").notNull()` | 3111 |
| `locationType` | `location_type` | `text` | `text("location_type")` | 3112 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 3113 |
| `updatedAt` | `updated_at` | `timestamp` | `timestamp("updated_at").defaultNow()` | 3114 |
| `createdBy` | `created_by` | `text` | `text("created_by").notNull()` | 3115 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3116 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3117 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3118 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3119 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3120 |

### B. spare_component_links

Schema symbol: `spareComponentLinks`. Declaration: `shared/schema.ts:3136`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3137 |
| `scluuid` | `scluuid` | `text` | ``text("scluuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 3138 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3139 |
| `spareId` | `spare_id` | `integer` | `integer("spare_id").notNull()` | 3140 |
| `spareUuid` | `spare_uuid` | `text` | `text("spare_uuid").notNull().references(() => spares.suuid)` | 3141 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 3142 |
| `linkedBy` | `linked_by` | `text` | `text("linked_by").notNull()` | 3143 |
| `linkedAt` | `linked_at` | `timestamp` | `timestamp("linked_at").notNull().defaultNow()` | 3144 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3145 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3146 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3147 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3148 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3149 |

### B. spare_location_stock

Schema symbol: `spareLocationStock`. Declaration: `shared/schema.ts:3167`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3168 |
| `slsuuid` | `slsuuid` | `text` | ``text("slsuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 3169 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3170 |
| `spareId` | `spare_id` | `integer` | `integer("spare_id").notNull()` | 3171 |
| `spareUuid` | `spare_uuid` | `text` | `text("spare_uuid").notNull().references(() => spares.suuid)` | 3172 |
| `locationId` | `location_id` | `integer` | `integer("location_id").notNull()` | 3173 |
| `locationUuid` | `location_uuid` | `text` | `text("location_uuid")` | 3174 |
| `qty` | `qty` | `integer` | `integer("qty").notNull().default(0)` | 3175 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3176 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3177 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3178 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3179 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3180 |

### B. inventory_transactions

Schema symbol: `inventoryTransactions`. Declaration: `shared/schema.ts:3197`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3198 |
| `ituuid` | `ituuid` | `text` | ``text("ituuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 3199 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3200 |
| `txnDatetime` | `txn_datetime` | `timestamp` | `timestamp("txn_datetime").notNull().defaultNow()` | 3201 |
| `spareId` | `spare_id` | `integer` | `integer("spare_id").notNull()` | 3202 |
| `spareUuid` | `spare_uuid` | `text` | `text("spare_uuid").notNull().references(() => spares.suuid)` | 3203 |
| `locationId` | `location_id` | `integer` | `integer("location_id")` | 3204 |
| `locationUuid` | `location_uuid` | `text` | `text("location_uuid")` | 3205 |
| `eventType` | `event_type` | `text` | `text("event_type").notNull()` | 3206 |
| `qtyChange` | `qty_change` | `integer` | `integer("qty_change").notNull()` | 3207 |
| `robTotalBefore` | `rob_total_before` | `integer` | `integer("rob_total_before").notNull()` | 3208 |
| `robTotalAfter` | `rob_total_after` | `integer` | `integer("rob_total_after").notNull()` | 3209 |
| `robLocationBefore` | `rob_location_before` | `integer` | `integer("rob_location_before")` | 3210 |
| `robLocationAfter` | `rob_location_after` | `integer` | `integer("rob_location_after")` | 3211 |
| `referenceType` | `reference_type` | `text` | `text("reference_type").notNull()` | 3212 |
| `referenceId` | `reference_id` | `text` | `text("reference_id")` | 3213 |
| `referenceNote` | `reference_note` | `text` | `text("reference_note")` | 3214 |
| `userId` | `user_id` | `text` | `text("user_id").notNull()` | 3215 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3216 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3217 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3218 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3219 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3220 |

### B. job_component_links

Schema symbol: `jobComponentLinks`. Declaration: `shared/schema.ts:3285`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3286 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3287 |
| `jobId` | `job_id` | `text` | `text("job_id").notNull().references(() => jobs.juuid)` | 3288 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 3289 |
| `componentCode` | `component_code` | `text` | `text("component_code")` | 3290 |
| `linkedBy` | `linked_by` | `text` | `text("linked_by").notNull()` | 3291 |
| `linkedAt` | `linked_at` | `timestamp` | `timestamp("linked_at").notNull().defaultNow()` | 3292 |
| `lastDoneDate` | `last_done_date` | `text` | `text("last_done_date")` | 3294 |
| `nextDueDate` | `next_due_date` | `text` | `text("next_due_date")` | 3295 |
| `lastDoneRH` | `last_done_rh` | `text` | `text("last_done_rh")` | 3296 |
| `nextDueRH` | `next_due_rh` | `text` | `text("next_due_rh")` | 3297 |
| `trackingRebaselinedAt` | `tracking_rebaselined_at` | `timestamp` | `timestamp("tracking_rebaselined_at")` | 3299 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 3300 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3301 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3302 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3303 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3304 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3305 |

### B. work_order_postponements

Schema symbol: `workOrderPostponements`. Declaration: `shared/schema.ts:3690`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `text` | ``text("id").primaryKey().default(sql`gen_random_uuid()::text`)`` | 3694 |
| `workOrderId` | `work_order_id` | `text` | `text("work_order_id").notNull().references(() => workOrders.wouuid)` | 3695 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3696 |
| `postponementNumber` | `postponement_number` | `integer` | `integer("postponement_number").notNull().default(1)` | 3697 |
| `originalDueDate` | `original_due_date` | `text` | `text("original_due_date")` | 3698 |
| `newDueDate` | `new_due_date` | `text` | `text("new_due_date")` | 3699 |
| `postponementReason` | `postponement_reason` | `text` | `text("postponement_reason")` | 3700 |
| `postponementRemarks` | `postponement_remarks` | `text` | `text("postponement_remarks")` | 3701 |
| `authorizedBy` | `authorized_by` | `text` | `text("authorized_by")` | 3702 |
| `approvalRemarks` | `approval_remarks` | `text` | `text("approval_remarks")` | 3703 |
| `durationDays` | `duration_days` | `integer` | `integer("duration_days")` | 3704 |
| `submittedDate` | `submitted_date` | `text` | `text("submitted_date")` | 3705 |
| `approvedDate` | `approved_date` | `text` | `text("approved_date")` | 3706 |
| `approvedBy` | `approved_by` | `text` | `text("approved_by")` | 3707 |
| `status` | `status` | `text` | `text("status").notNull().default("Pending")` | 3708 |
| `approver` | `approver` | `text` | `text("approver")` | 3709 |
| `postponeDate` | `postpone_date` | `text` | `text("postpone_date")` | 3710 |
| `informOffice` | `inform_office` | `boolean` | `boolean("inform_office").notNull().default(false)` | 3711 |
| `attachmentPath` | `attachment_path` | `text` | `text("attachment_path")` | 3712 |
| `approvalWorkflowSnapshot` | `approval_workflow_snapshot` | `jsonb` | `jsonb("approval_workflow_snapshot")` | 3713 |
| `requestType` | `request_type` | `text` | `text("request_type")` | 3714 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 3715 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 3716 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3717 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3718 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3719 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3720 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3721 |
| `disposedAt` | `disposed_at` | `timestamp` | `timestamp("disposed_at")` | 3722 |
| `disposedByUuid` | `disposed_by_uuid` | `text` | `text("disposed_by_uuid")` | 3723 |

### B. wo_postponement_approvals

Schema symbol: `woPostponementApprovals`. Declaration: `shared/schema.ts:3738`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3739 |
| `wpauuid` | `wpauuid` | `text` | ``text("wpauuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 3740 |
| `postponementId` | `postponement_id` | `text` | `text("postponement_id").notNull()` | 3741 |
| `workOrderId` | `work_order_id` | `text` | `text("work_order_id").notNull()` | 3742 |
| `approvalLevel` | `approval_level` | `text` | `text("approval_level").notNull()` | 3743 |
| `status` | `status` | `text` | `text("status").notNull().default("Pending")` | 3744 |
| `actionByUserId` | `action_by_user_id` | `text` | `text("action_by_user_id")` | 3745 |
| `actionAt` | `action_at` | `timestamp` | `timestamp("action_at", { withTimezone: true })` | 3746 |
| `remarks` | `remarks` | `text` | `text("remarks")` | 3747 |
| `requestType` | `request_type` | `text` | `text("request_type")` | 3748 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 3749 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 3750 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3751 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3752 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 3753 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 3754 |

### B. report_snapshots

Schema symbol: `reportSnapshots`. Declaration: `shared/schema.ts:3769`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 3770 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 3771 |
| `reportType` | `report_type` | `text` | `text("report_type").notNull()` | 3772 |
| `exportFormat` | `export_format` | `text` | `text("export_format").notNull()` | 3773 |
| `generatedAt` | `generated_at` | `timestamp` | `timestamp("generated_at").notNull().defaultNow()` | 3774 |
| `generatedBy` | `generated_by` | `text` | `text("generated_by")` | 3775 |
| `itemCount` | `item_count` | `integer` | `integer("item_count").notNull().default(0)` | 3776 |
| `filtersApplied` | `filters_applied` | `jsonb` | `jsonb("filters_applied")` | 3777 |
| `summaryData` | `summary_data` | `jsonb` | `jsonb("summary_data").notNull()` | 3778 |
| `itemsData` | `items_data` | `jsonb` | `jsonb("items_data").notNull()` | 3779 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").default(false)` | 3780 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 3781 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 3782 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").default(false)` | 3783 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order")` | 3784 |

### B. approval_workflow_config

Schema symbol: `approvalWorkflowConfig`. Declaration: `shared/schema.ts:4156`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `serial` | `serial("id").primaryKey()` | 4157 |
| `awcuuid` | `awcuuid` | `text` | ``text("awcuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 4158 |
| `moduleId` | `module_id` | `text` | `text("module_id").notNull()` | 4159 |
| `subModuleId` | `sub_module_id` | `text` | `text("sub_module_id").notNull()` | 4160 |
| `functionId` | `function_id` | `text` | `text("function_id").notNull()` | 4161 |
| `variableName` | `variable_name` | `text` | `text("variable_name").notNull()` | 4162 |
| `level1Enabled` | `level1_enabled` | `boolean` | `boolean("level1_enabled").notNull().default(false)` | 4163 |
| `level2Enabled` | `level2_enabled` | `boolean` | `boolean("level2_enabled").notNull().default(false)` | 4164 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()` | 4165 |
| `updatedAt` | `updated_at` | `timestamp` | `timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date())` | 4166 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 4167 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 4168 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 4169 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 4170 |

### B. planner_dates

Schema symbol: `plannerDates`. Declaration: `shared/schema.ts:4185`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `serial` | `serial("id").primaryKey()` | 4186 |
| `pduuid` | `pduuid` | `text` | `text("pduuid").notNull().unique()` | 4187 |
| `vesselId` | `vessel_id` | `text` | `text("vessel_id").notNull().references(() => vessels.vuuid)` | 4188 |
| `jobId` | `job_id` | `text` | `text("job_id").notNull().references(() => jobs.juuid)` | 4189 |
| `componentId` | `component_id` | `text` | `text("component_id").notNull().references(() => components.cuuid)` | 4190 |
| `plannedDate` | `planned_date` | `text` | `text("planned_date")` | 4191 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 4192 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 4193 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 4194 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 4195 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 4196 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 4197 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 4198 |

### B. report_favorites

Schema symbol: `reportFavorites`. Declaration: `shared/schema.ts:4213`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `serial` | `serial("id").primaryKey()` | 4214 |
| `rfuuid` | `rfuuid` | `text` | ``text("rfuuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 4215 |
| `reportId` | `report_id` | `text` | `text("report_id").notNull()` | 4216 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid").notNull()` | 4217 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 4218 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 4219 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 4220 |
| `sortOrder` | `sort_order` | `integer` | `integer("sort_order").default(0)` | 4221 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 4222 |
| `updatedAt` | `(factory-defined; inspect helper)` | `updatedAtColumn()` | `updatedAtColumn()` | 4223 |

### B. moc_approvers

Schema symbol: `mocApprovers`. Declaration: `shared/schema.ts:4639`.

| Application property | SQL column | Type / factory | Source declaration | Line |
|---|---|---|---|---:|
| `id` | `id` | `integer` | `integer("id").primaryKey().generatedByDefaultAsIdentity()` | 4640 |
| `mauuid` | `mauuid` | `text` | ``text("mauuid").notNull().unique().default(sql`gen_random_uuid()::text`)`` | 4641 |
| `name` | `name` | `text` | `text("name")` | 4642 |
| `userId` | `user_id` | `text` | `text("user_id")` | 4643 |
| `userUuid` | `user_uuid` | `text` | `text("user_uuid")` | 4644 |
| `approverLevel` | `approver_level` | `text` | `text("approver_level")` | 4645 |
| `emailId` | `email_id` | `text` | `text("email_id")` | 4646 |
| `isActive` | `is_active` | `integer` | `integer("is_active").default(1)` | 4647 |
| `modulename` | `modulename` | `text` | `text("modulename")` | 4648 |
| `createdAt` | `created_at` | `timestamp` | `timestamp("created_at").notNull().defaultNow()` | 4649 |
| `updatedAt` | `updated_at` | `timestamp` | `timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date())` | 4653 |
| `createdByUuid` | `created_by_uuid` | `text` | `text("created_by_uuid")` | 4654 |
| `updatedByUuid` | `updated_by_uuid` | `text` | `text("updated_by_uuid")` | 4655 |
| `isDeleted` | `is_deleted` | `boolean` | `boolean("is_deleted").notNull().default(false)` | 4656 |
| `isSync` | `is_sync` | `boolean` | `boolean("is_sync").notNull().default(false)` | 4657 |

## Appendix C — Synchronization registry

Source: `shared/syncConfig.ts`. This lists the inspected registry, including non-PMS supporting/adjacent tables. Direction/identity metadata describes configured ownership, not the complete applier/conflict algorithm. Job tracking, runtime RH, completion learning and authorized rebaseline have additional rules. For SQL-only sync infrastructure tables consult `server/modules/sync/repository.ts`, initialization SQL and migrations; their presence here does not imply their column dictionary is in Appendix B.

| Table | Category | Direction | Canonical identity | Vessel scope column | Scope join | Global | Configurable | Source line |
|---|---|---|---|---|---|---|---|---:|
| `components` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `cuuid` | `vessel_id` | `null` | false | false | 64 |
| `jobs` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `juuid` | `vessel_id` | `null` | false | false | 76 |
| `job_component_links` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_id` | `null` | false | false | 94 |
| `fleet_components` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fleet_components_uuid` | `null` | `null` | true | false | 109 |
| `fleet_jobs` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fleet_jobs_uuid` | `null` | `null` | true | false | 121 |
| `fleet_spares` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fleet_spares_uuid` | `null` | `null` | true | false | 133 |
| `fleet_vessel_mapping` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_code` | `null` | false | false | 145 |
| `fleet_component_mapping` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_code` | `null` | false | false | 157 |
| `fleet_job_vessel_mapping` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_code` | `null` | false | false | 169 |
| `fleet_spare_vessel_mapping` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_code` | `null` | false | false | 181 |
| `fleet_groups` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `null` | `null` | true | false | 193 |
| `fleet_classes` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fcuuid` | `null` | `null` | true | false | 205 |
| `adm_available_ranks` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `ar_uuid` | `null` | `null` | true | false | 220 |
| `vessel_org_chart_nodes` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `node_uuid` | `vessel_id` | `null` | false | false | 232 |
| `adm_vessel_org_chart` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `oc_uuid` | `null` | `null` | true | false | 244 |
| `vessel_department_config` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_id` | `null` | false | false | 256 |
| `admn_role_master` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `ruid` | `null` | `null` | true | false | 268 |
| `view_modes_master` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `code` | `null` | `null` | true | false | 280 |
| `role_view_mode_mapping` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `role_ruid` | `null` | `null` | true | false | 292 |
| `adm_menumaster_ac` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `muid` | `null` | `null` | true | false | 304 |
| `adm_role_menu_access` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `null` | `null` | true | false | 316 |
| `equipment_categories` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `name` | `null` | `null` | true | false | 331 |
| `sfi_details` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `component_code` | `null` | `null` | true | false | 343 |
| `master_data` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fleet_equipment_code` | `vessel_code` | `null` | false | false | 355 |
| `defect_categories` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `name` | `null` | `null` | true | false | 367 |
| `defect_types` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `name` | `null` | `null` | true | false | 379 |
| `makers` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `maker_code` | `null` | `null` | true | false | 391 |
| `maker_list` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `maker_list_uuid` | `null` | `null` | true | false | 403 |
| `master_list_types` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `mltuuid` | `null` | `null` | true | false | 415 |
| `master_lists` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `null` | `null` | true | false | 427 |
| `form_definitions` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fduuid` | `null` | `null` | true | false | 442 |
| `form_versions` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `fvuuid` | `null` | `null` | true | false | 454 |
| `alert_policies` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `apuuid` | `null` | `null` | true | false | 469 |
| `alert_config` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_id` | `null` | false | false | 481 |
| `company_standard_grace_settings` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `singleton_key` | `null` | `null` | true | false | 493 |
| `company_approval_settings` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `singleton_key` | `null` | `null` | true | false | 505 |
| `pms_vessel_settings` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `vessel_id` | `vessel_id` | `null` | false | false | 517 |
| `ship_certificates_master` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `master_id` | `null` | `null` | true | false | 532 |
| `ship_certificates_labels_config` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `null` | `null` | true | false | 544 |
| `ship_surveys_master` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `master_id` | `null` | `null` | true | false | 556 |
| `ship_surveys_labels_config` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `null` | `null` | true | false | 568 |
| `vessel_certificate_applicability` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_id` | `null` | false | false | 580 |
| `vessel_survey_applicability` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_id` | `null` | false | false | 592 |
| `component_class_regulatory` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `null` | `vessel_code` | `null` | false | false | 607 |
| `approval_workflow_config` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `awcuuid` | `null` | `null` | true | true | 622 |
| `moc_approvers` | ONE_WAY_SHORE_TO_SHIP | `shore_to_ship` | `mauuid` | `null` | `null` | true | true | 634 |
| `work_orders` | BOTH_EDITABLE | `bidirectional` | `wouuid` | `vessel_id` | `null` | false | true | 653 |
| `work_order_executions` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 665 |
| `work_order_execution_details` | BOTH_EDITABLE | `bidirectional` | `woeduuid` | `vessel_id` | `null` | false | true | 677 |
| `work_order_postponements` | BOTH_EDITABLE | `bidirectional` | `id` | `vessel_id` | `null` | false | true | 689 |
| `wo_postponement_approvals` | BOTH_EDITABLE | `bidirectional` | `wpauuid` | `null` | `wo_postponement_approvals.postponement_id -> work_order_postponements.id -> work_order_postponements.vessel_id` | false | true | 701 |
| `work_order_documents` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 713 |
| `defects` | BOTH_EDITABLE | `bidirectional` | `duuid` | `vessel_id` | `null` | false | true | 728 |
| `defect_actions` | BOTH_EDITABLE | `bidirectional` | `dauuid` | `null` | `defect_actions.defect_id -> defects.duuid -> defects.vessel_id` | false | true | 740 |
| `defect_attachments` | BOTH_EDITABLE | `bidirectional` | `datuuid` | `null` | `defect_attachments.defect_id -> defects.duuid -> defects.vessel_id` | false | true | 752 |
| `defect_sequences` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 764 |
| `spares` | BOTH_EDITABLE | `bidirectional` | `suuid` | `vessel_id` | `null` | false | true | 779 |
| `spares_history` | BOTH_EDITABLE | `bidirectional` | `shuuid` | `vessel_id` | `null` | false | true | 791 |
| `spare_location_stock` | BOTH_EDITABLE | `bidirectional` | `slsuuid` | `vessel_id` | `null` | false | true | 803 |
| `spare_component_links` | BOTH_EDITABLE | `bidirectional` | `scluuid` | `vessel_id` | `null` | false | true | 815 |
| `stores_items` | BOTH_EDITABLE | `bidirectional` | `stuuid` | `vessel_id` | `null` | false | true | 827 |
| `stores_ledger` | BOTH_EDITABLE | `bidirectional` | `sluuid` | `vessel_id` | `null` | false | true | 839 |
| `inventory_transactions` | BOTH_EDITABLE | `bidirectional` | `ituuid` | `vessel_id` | `null` | false | true | 851 |
| `change_request` | BOTH_EDITABLE | `bidirectional` | `cruuid` | `vessel_id` | `null` | false | true | 866 |
| `change_request_attachment` | BOTH_EDITABLE | `bidirectional` | `crauuid` | `null` | `change_request_attachment.change_request_id -> change_request.id -> change_request.vessel_id` | false | true | 878 |
| `change_request_approval` | BOTH_EDITABLE | `bidirectional` | `crauuid` | `null` | `change_request_approval.change_request_id -> change_request.id -> change_request.vessel_id` | false | true | 890 |
| `change_request_comment` | BOTH_EDITABLE | `bidirectional` | `crcuuid` | `null` | `change_request_comment.change_request_id -> change_request.id -> change_request.vessel_id` | false | true | 902 |
| `certificates` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 917 |
| `surveys` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 929 |
| `vessel_certificate_data` | BOTH_EDITABLE | `bidirectional` | `vcduuid` | `vessel_id` | `null` | false | true | 941 |
| `vessel_survey_data` | BOTH_EDITABLE | `bidirectional` | `vsduuid` | `vessel_id` | `null` | false | true | 953 |
| `running_hours_audit` | BOTH_EDITABLE | `bidirectional` | `rhauuid` | `vessel_id` | `null` | false | true | 968 |
| `component_running_hours_log` | BOTH_EDITABLE | `bidirectional` | `crhluuid` | `vessel_code` | `null` | false | true | 980 |
| `rotational_items` | BOTH_EDITABLE | `bidirectional` | `riuuid` | `vessel_id` | `null` | false | true | 992 |
| `rotation_history` | BOTH_EDITABLE | `bidirectional` | `rhruuid` | `vessel_id` | `null` | false | true | 1004 |
| `component_maintenance_history` | BOTH_EDITABLE | `bidirectional` | `cmhuuid` | `vessel_code` | `null` | false | true | 1017 |
| `component_documents` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_code` | `null` | false | true | 1033 |
| `component_requisitions` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_code` | `null` | false | true | 1045 |
| `ihm_items` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 1060 |
| `ihm_maintenance_log` | BOTH_EDITABLE | `bidirectional` | `null` | `vessel_id` | `null` | false | true | 1072 |
| `nr_noon_reports` | SHIP_ONLY | `ship_to_shore` | `nruuid` | `vessel_id` | `null` | false | false | 1089 |
| `nr_bunker_records` | SHIP_ONLY | `ship_to_shore` | `nbruuid` | `vessel_id` | `null` | false | false | 1101 |
| `nr_alerts` | SHIP_ONLY | `ship_to_shore` | `nauuid` | `vessel_id` | `null` | false | false | 1113 |
| `nr_cii_tracking` | SHIP_ONLY | `ship_to_shore` | `nctuuid` | `vessel_id` | `null` | false | false | 1125 |
| `nr_fuel_rob` | SHIP_ONLY | `ship_to_shore` | `nfruuid` | `vessel_id` | `null` | false | false | 1137 |
| `nr_voyage_legs` | SHIP_ONLY | `ship_to_shore` | `nvluuid` | `vessel_id` | `null` | false | false | 1149 |
| `users` | NO_SYNC | `none` | `null` | `vessel_id` | `null` | false | false | 1168 |
| `master_users` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1180 |
| `vessels` | NO_SYNC | `none` | `vuuid` | `null` | `null` | true | false | 1192 |
| `fleets` | NO_SYNC | `none` | `fuuid` | `null` | `null` | true | false | 1204 |
| `vessel_types` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1216 |
| `additional_groups` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1228 |
| `ports` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1240 |
| `locations` | BOTH_EDITABLE | `bidirectional` | `luuid` | `vessel_id` | `null` | false | true | 1252 |
| `sync_metadata` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1267 |
| `sync_table_checkpoints` | NO_SYNC | `none` | `null` | `null` | `null` | false | false | 1279 |
| `shipskart_tenant_config` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1293 |
| `shipskart_user_links` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1305 |
| `shipskart_vessel_links` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1317 |
| `master_user_vessels` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1329 |
| `sync_field_log` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1341 |
| `sync_conflicts` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1353 |
| `sync_file_queue` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1365 |
| `sync_batches` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1377 |
| `audit_log` | NO_SYNC | `none` | `null` | `vessel_code` | `null` | false | false | 1392 |
| `import_history` | NO_SYNC | `none` | `null` | `vessel_id` | `null` | false | false | 1404 |
| `import_change_log` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1416 |
| `bulk_import_history` | NO_SYNC | `none` | `biuuid` | `vessel_code` | `null` | false | false | 1428 |
| `bulk_import_errors` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1440 |
| `report_snapshots` | NO_SYNC | `none` | `null` | `vessel_id` | `null` | false | false | 1452 |
| `report_favorites` | NO_SYNC | `none` | `rfuuid` | `null` | `null` | true | false | 1464 |
| `monthly_snapshots` | NO_SYNC | `none` | `null` | `vessel_id` | `null` | false | false | 1476 |
| `superintendent_notifications` | BOTH_EDITABLE | `bidirectional` | `snuuid` | `vessel_id` | `null` | false | true | 1488 |
| `alert_events` | NO_SYNC | `none` | `aeuuid` | `vessel_id` | `null` | false | false | 1503 |
| `alert_deliveries` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1515 |
| `alert_acknowledgements` | NO_SYNC | `none` | `aauuid` | `null` | `null` | true | false | 1527 |
| `work_order_anomalies` | NO_SYNC | `none` | `null` | `vessel_id` | `null` | false | false | 1542 |
| `planner_dates` | BOTH_EDITABLE | `bidirectional` | `pduuid` | `vessel_id` | `null` | false | false | 1554 |
| `schema_migrations` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1566 |
| `form_version_usage` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1578 |
| `recurring_defects` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1590 |
| `recurring_defect_links` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1602 |
| `shipskart_role_mappings` | NO_SYNC | `none` | `null` | `null` | `null` | true | false | 1614 |

## Appendix D — Frontend page and API-reference index

Includes non-archived page files under PMS, Admin, Reports, Spares, Stores and Modify PMS. Shared components and contexts are described in the narrative, not exhaustively indexed here. File existence does not prove shell activation; Section 3 identifies active imports. API references are literal/template snippets, can contain query fragments, and are capped at 30 unique strings per file. Empty reference lists mean no literal `/technical/api/` string was extracted, not that the page never uses data.

| Frontend source | Extracted API references |
|---|---|
| `client/src/pages/admin/AccessControl.tsx` | `/technical/api/admin/roles`<br>`/technical/api/admin/menu-items`<br>`/technical/api/admin/access-control`<br>`/technical/api/admin/access-control/${selectedRoleRuid}`<br>`/technical/api/admin/role-view-mappings`<br>`/technical/api/admin/role-view-mappings/resolve`<br>`/technical/api/shipskart/role-mappings` |
| `client/src/pages/admin/AddEditFleetComponent.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/makers`<br>`/technical/api/fleet-admin/fleet-components/${editId}`<br>`/technical/api/fleet-admin/fleet-components/${data.id}`<br>`/technical/api/fleet-admin/fleet-components/${id}` |
| `client/src/pages/admin/Admin4Dashboard.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/admin/Alerts.tsx` | `/technical/api/alerts/policies`<br>`/technical/api/alerts/config`<br>`/technical/api/alerts/config/${selectedVesselId}`<br>`/technical/api/alerts/policies/batch-update` |
| `client/src/pages/admin/ApprovalWorkflow.tsx` | `/technical/api/admin/approval-workflow-config` |
| `client/src/pages/admin/AuditTrail.tsx` | `/technical/api/admin/audit-trail`<br>`/technical/api/admin/audit-trail?${buildQuery`<br>`/technical/api/admin/audit-trail/excel` |
| `client/src/pages/admin/BulkDataImport.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/admin/DataMasters.tsx` | `/technical/api/equipment-categories`<br>`/technical/api/equipment-categories/${id}`<br>`/technical/api/defect-categories`<br>`/technical/api/defect-categories/${id}`<br>`/technical/api/defect-types`<br>`/technical/api/defect-types/${id}`<br>`/technical/api/admin/sync-masters`<br>`/technical/api/admin/local-approvers`<br>`/technical/api/vessels` |
| `client/src/pages/admin/FleetComponentForm.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet-admin/fleet-components/${id}` |
| `client/src/pages/admin/FleetComponentsManagement.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/makers`<br>`/technical/api/fleet-admin/fleet-components/${id}`<br>`/technical/api/fleet-admin/fleet-components/export` |
| `client/src/pages/admin/FleetDataView.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/jobs`<br>`/technical/api/fleet/spares`<br>`/technical/api/fleet/makers`<br>`/technical/api/fleet-admin/component-vessel-mappings`<br>`/technical/api/fleet-admin/fleet-job-mappings/by-job`<br>`/technical/api/fleet-admin/fleet-job-mappings/by-job/${encodeURIComponent`<br>`/technical/api/fleet-admin/fleet-spare-mappings/by-spare`<br>`/technical/api/fleet-admin/fleet-spare-mappings/by-spare/${encodeURIComponent`<br>`/technical/api/fleet-admin/component-vessel-mappings/${id}`<br>`/technical/api/fleet/jobs/${id}`<br>`/technical/api/fleet/components/sort-order`<br>`/technical/api/fleet-admin/component-vessel-mappings/auto-linkage`<br>`/technical/api/components?vesselId=${encodeURIComponent`<br>`/technical/api/fleet-admin/fleet-component-mappings`<br>`/technical/api/jobs?vesselId=${encodeURIComponent`<br>`/technical/api/fleet-admin/fleet-job-mappings`<br>`/technical/api/fleet-admin/fleet-job-mappings?jobCode=${encodeURIComponent`<br>`/technical/api/spares/${encodeURIComponent`<br>`/technical/api/fleet-admin/fleet-spare-mappings`<br>`/technical/api/fleet-admin/fleet-spare-mappings?partCode=${encodeURIComponent`<br>`/technical/api/fleet-admin/resync/${type}`<br>`/technical/api/fleet/jobs/export?fleetEquipmentCode=${encodeURIComponent`<br>`/technical/api/fleet/spares/export?fleetEquipmentCode=${encodeURIComponent` |
| `client/src/pages/admin/FleetEquipmentTreeView.tsx` | `/technical/api/fleet-admin/master-data`<br>`/technical/api/fleet-admin/master-data?limit=10000`<br>`/technical/api/fleet/jobs`<br>`/technical/api/fleet/spares` |
| `client/src/pages/admin/FleetJobForm.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/jobs`<br>`/technical/api/fleet/jobs/${id}` |
| `client/src/pages/admin/FleetJobsManagement.tsx` | `/technical/api/fleet/jobs`<br>`/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/jobs/${id}`<br>`/technical/api/jobs/${jobId}/generate-wo`<br>`/technical/api/work-orders`<br>`/technical/api/fleet/jobs/export` |
| `client/src/pages/admin/FleetSpareForm.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/makers`<br>`/technical/api/fleet/spares`<br>`/technical/api/fleet/spares/${id}` |
| `client/src/pages/admin/FleetSparesManagement.tsx` | `/technical/api/fleet/spares`<br>`/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet/makers`<br>`/technical/api/fleet/spares/${id}`<br>`/technical/api/fleet/spares/export` |
| `client/src/pages/admin/FleetVesselManager.tsx` | `/technical/api/fleets`<br>`/technical/api/fleets/${fleet.fuuid}/classes`<br>`/technical/api/vessels-with-fleets`<br>`/technical/api/fleets/${id}`<br>`/technical/api/vessels`<br>`/technical/api/vessels/${id}/fleet`<br>`/technical/api/fleet-admin/copy-vessel`<br>`/technical/api/fleet-admin`<br>`/technical/api/fleets/${fleetFuuid}/classes`<br>`/technical/api/fleet-classes/${fcuuid}`<br>`/technical/api/vessels/${vesselId}/class` |
| `client/src/pages/admin/FleetVesselMapping.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/components`<br>`/technical/api/components?vesselId=${selectedVessel}`<br>`/technical/api/fleet-admin/fleet-component-mappings`<br>`/technical/api/fleet-admin/fleet-component-mappings?vesselCode=${selectedVessel}`<br>`/technical/api/fleet/jobs`<br>`/technical/api/jobs`<br>`/technical/api/jobs?vesselId=${selectedVessel}`<br>`/technical/api/fleet-admin/fleet-job-mappings`<br>`/technical/api/fleet-admin/fleet-job-mappings?vesselCode=${selectedVessel}`<br>`/technical/api/fleet/spares`<br>`/technical/api/spares`<br>`/technical/api/spares/${selectedVessel}`<br>`/technical/api/fleet-admin/fleet-spare-mappings`<br>`/technical/api/fleet-admin/fleet-spare-mappings?vesselCode=${selectedVessel}`<br>`/technical/api/fleet-admin/fleet-component-mappings?fleetEquipmentCode=${encodeURIComponent`<br>`/technical/api/fleet-admin/fleet-job-mappings?jobCode=${encodeURIComponent`<br>`/technical/api/fleet-admin/fleet-spare-mappings?partCode=${encodeURIComponent`<br>`/technical/api/fleet-admin/resync/components`<br>`/technical/api/fleet-admin/resync/jobs`<br>`/technical/api/fleet-admin/resync/spares` |
| `client/src/pages/admin/Forms.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/admin/JobUpload.tsx` | `/technical/api/jobs` |
| `client/src/pages/admin/LocationManagement.tsx` | `/technical/api/inventory/locations`<br>`/technical/api/inventory/locations/${encodeURIComponent`<br>`/technical/api/bulk/locations/${data.id}`<br>`/technical/api/bulk/locations/${id}` |
| `client/src/pages/admin/MachineryComponentUpload.tsx` | `/technical/api/components` |
| `client/src/pages/admin/MakerManagement.tsx` | `/technical/api/fleet/makers`<br>`/technical/api/fleet/makers/${id}`<br>`/technical/api/bulk/makers/export` |
| `client/src/pages/admin/MasterDataManagement.tsx` | `/technical/api/fleet-admin/master-data`<br>`/technical/api/fleet-admin/master-data?limit=10000`<br>`/technical/api/fleet-admin/sfi-details`<br>`/technical/api/fleet-admin/master-data/${id}` |
| `client/src/pages/admin/MasterDataTableView.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet-admin/fleet-vessel-mappings/by-equipment/${encodeURIComponent` |
| `client/src/pages/admin/MasterListsManagement.tsx` | `/technical/api/fleet/master-list-types`<br>`/technical/api/fleet/master-list-types?includeInactive=true`<br>`/technical/api/fleet/master-lists`<br>`/technical/api/fleet/master-lists?listType=${selectedListType}`<br>`/technical/api/fleet/master-lists/${id}`<br>`/technical/api/fleet/master-list-types/${id}` |
| `client/src/pages/admin/PmsVesselSettingsManagement.tsx` | `/technical/api/pms-vessel-settings`<br>`/technical/api/company-standard-grace-settings`<br>`/technical/api/pms-vessel-settings/${data.vesselId}/office-wo-generation`<br>`/technical/api/pms-vessel-settings/${data.vesselId}/office-rh-entry`<br>`/technical/api/pms-vessel-settings/${data.vesselId}/rh-validation`<br>`/technical/api/pms-vessel-settings/${data.vesselId}/superintendent-lock`<br>`/technical/api/pms-vessel-settings/${data.vesselId}` |
| `client/src/pages/admin/RanksAdmin.tsx` | `/technical/api/admin/available-ranks`<br>`/technical/api/admin/available-ranks/${rankId}` |
| `client/src/pages/admin/RetentionSettings.tsx` | `/technical/api/admin/retention-settings` |
| `client/src/pages/admin/RotationItemMasterList.tsx` | `/technical/api/rotational-items?vesselId=${encodeURIComponent`<br>`/technical/api/rotational-items`<br>`/technical/api/rotational-items/${editingItem.riuuid}`<br>`/technical/api/rotational-items/${riuuid}` |
| `client/src/pages/admin/ShipsCertificatesAdmin.tsx` | `/technical/api/admin/ship-certificates-master`<br>`/technical/api/admin/vessel-certificate-applicability`<br>`/technical/api/admin/ship-certificates-labels`<br>`/technical/api/admin/vessel-certificate-applicability?vesselIds=${vesselIdsQueryParam}`<br>`/technical/api/admin/vessel-certificate-applicability/initialize`<br>`/technical/api/admin/vessel-certificate-applicability/bulk-update` |
| `client/src/pages/admin/ShipsSurveysAdmin.tsx` | `/technical/api/admin/ship-surveys-master`<br>`/technical/api/admin/ship-surveys-labels`<br>`/technical/api/admin/vessel-survey-applicability`<br>`/technical/api/admin/vessel-survey-applicability?vesselIds=${selectedVesselIds}`<br>`/technical/api/admin/ship-surveys-master/${masterId}`<br>`/technical/api/admin/vessel-survey-applicability/initialize`<br>`/technical/api/admin/vessel-survey-applicability/bulk-update` |
| `client/src/pages/admin/ShipskartCatalogue.tsx` | `/technical/api/shipskart/b2b/reconciler-config`<br>`/technical/api/shipskart/catalogue/status/${vesselId}`<br>`/technical/api/shipskart/catalogue/push`<br>`/technical/api/shipskart/b2b/reconcile/status`<br>`/technical/api/shipskart/b2b/reconcile`<br>`/technical/api/shipskart/vessels/sync/status`<br>`/technical/api/shipskart/vessels/sync` |
| `client/src/pages/admin/SyncConflictReview.tsx` | `/technical/api/sync/conflicts/review`<br>`/technical/api/sync/conflicts/review?${params}`<br>`/technical/api/sync/conflicts/review/tables`<br>`/technical/api/sync/conflicts/review/${id}/apply-incoming`<br>`/technical/api/sync/conflicts/review/${id}/dismiss` |
| `client/src/pages/admin/SyncDashboard.tsx` | `/technical/api/sync/batches`<br>`/technical/api/sync/batches?vesselId=${selectedVesselId}&limit=20`<br>`/technical/api/sync/batches?vesselId=all&limit=20`<br>`/technical/api/sync/conflicts`<br>`/technical/api/sync/conflicts?vesselId=${selectedVesselId}`<br>`/technical/api/sync/file/queue`<br>`/technical/api/sync/file/queue?vesselId=${selectedVesselId}`<br>`/technical/api/sync/file/${queueUuid}/${action}`<br>`/technical/api/sync/conflicts/review/count`<br>`/technical/api/sync/conflicts/review/count?vesselId=${selectedVesselId}`<br>`/technical/api/sync/trigger`<br>`/technical/api/sync/resolve-conflict` |
| `client/src/pages/admin/SyncFleetOverview.tsx` | `/technical/api/sync/fleet-overview`<br>`/technical/api/sync/settings`<br>`/technical/api/sync/batches`<br>`/technical/api/sync/batches?vesselId=all&limit=50`<br>`/technical/api/sync/settings/test-connection` |
| `client/src/pages/admin/SyncProvisioning.tsx` | `/technical/api/sync/provision/manifest`<br>`/technical/api/sync/provision/manifest/${selectedVesselId}`<br>`/technical/api/sync/provision/download/${selectedVesselId}`<br>`/technical/api/sync/provision/import`<br>`/technical/api/sync/provision/verify` |
| `client/src/pages/admin/VesselOrgChartModal.tsx` | `/technical/api/admin/vessel-org-chart`<br>`/technical/api/admin/available-ranks`<br>`/technical/api/admin/vessel-org-chart/${id}` |
| `client/src/pages/admin/bulk/BulkImportHistory.tsx` | `/technical/api/fleet-admin/import-history`<br>`/technical/api/fleet-admin/import-history?${queryParams}`<br>`/technical/api/fleet-admin/import-history/${selectedImport?.id}/errors` |
| `client/src/pages/admin/bulk/FleetComponentUpload.tsx` | `/technical/api/fleet-admin/fleet-components`<br>`/technical/api/fleet-admin/master-data` |
| `client/src/pages/admin/bulk/FleetJobsUpload.tsx` | `/technical/api/fleet-jobs` |
| `client/src/pages/admin/bulk/FleetSparesUpload.tsx` | `/technical/api/fleet/spares` |
| `client/src/pages/admin/bulk/LocationsUpload.tsx` | `/technical/api/bulk/locations/template`<br>`/technical/api/bulk/locations/import-stream?vesselId=${encodeURIComponent` |
| `client/src/pages/admin/bulk/MakerListUpload.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/admin/bulk/MasterDataUpload.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/admin/bulk/MasterListsUpload.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/admin/bulk/RotationalItemsUpload.tsx` | `/technical/api/bulk/rotational-items/template`<br>`/technical/api/bulk/rotational-items/import-stream?vesselId=${encodeURIComponent` |
| `client/src/pages/admin/bulk/SparesUpload.tsx` | `/technical/api/spares` |
| `client/src/pages/admin/bulk/StoresUpload.tsx` | `/technical/api/stores/${vesselId}?itemType=${tab}` |
| `client/src/pages/admin/bulk/WoHistoryUpload.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/modify-pms/JobsSelector.tsx` | `/technical/api/jobs?vesselId=${vesselId}` |
| `client/src/pages/pms/AnomaliesPage.tsx` | `/technical/api/anomalies/statistics`<br>`/technical/api/anomalies/dashboard`<br>`/technical/api/anomalies/dashboard?${params}`<br>`/technical/api/anomalies/${anomalyId}/acknowledge` |
| `client/src/pages/pms/AnomalyDetectionTile.tsx` | `/technical/api/anomalies/statistics`<br>`/technical/api/anomalies/statistics?vesselId=${effectiveVesselId}`<br>`/technical/api/anomalies/dashboard`<br>`/technical/api/anomalies/dashboard?${params}`<br>`/technical/api/anomalies/${anomalyId}/acknowledge` |
| `client/src/pages/pms/ComplianceAnomalyPanel.tsx` | `/technical/api/anomalies/dashboard`<br>`/technical/api/anomalies/dashboard?${params}`<br>`/technical/api/anomalies/${anomalyId}/acknowledge`<br>`/technical/api/anomalies/statistics`<br>`/technical/api/anomalies/${id}/acknowledge`<br>`/technical/api/dashboard/compliance-anomalies?vesselId=${vesselId}`<br>`/technical/api/dashboard/compliance-anomalies`<br>`/technical/api/anomalies/statistics?vesselId=${effectiveVesselId}` |
| `client/src/pages/pms/Components.tsx` | `/technical/api/components/${`<br>`/technical/api/running-hours/${selectedComponent?.id}`<br>`/technical/api/jobs/${job.id}/generate-wo`<br>`/technical/api/work-orders`<br>`/technical/api/jobs`<br>`/technical/api/jobs?vesselId=${vesselId}`<br>`/technical/api/component-maintenance-history/${componentDbId}`<br>`/technical/api/components/${vesselId}`<br>`/technical/api/inventory/spares-by-component-code`<br>`/technical/api/inventory/spares-by-component-code/${vesselId}/${encodeURIComponent`<br>`/technical/api/component-documents`<br>`/technical/api/component-documents/${selectedComponent.actualId}`<br>`/technical/api/component-documents/${docId}/download`<br>`/technical/api/component-documents/${docId}`<br>`/technical/api/component-class-regulatory/${selectedComponent?.id}`<br>`/technical/api/component-requisitions/${selectedComponent?.id}`<br>`/technical/api/components/${componentId}`<br>`/technical/api/change-requests/${changeRequestId}`<br>`/technical/api/components/sort-order`<br>`/technical/api/change-requests` |
| `client/src/pages/pms/Dashboard.tsx` | `/technical/api/work-orders`<br>`/technical/api/work-orders?vesselId=${vessel.id}`<br>`/technical/api/spares`<br>`/technical/api/spares/${vessel.id}`<br>`/technical/api/scoped-operation-data`<br>`/technical/api/scoped-operation-data/${effectiveVesselId}?${params.toString`<br>`/technical/api/work-orders?vesselId=${id}`<br>`/technical/api/work-orders?vesselId=${effectiveVesselId}`<br>`/technical/api/spares/${effectiveVesselId}`<br>`/technical/api/stores`<br>`/technical/api/stores/${vessel.id}`<br>`/technical/api/stores/${effectiveVesselId}`<br>`/technical/api/components`<br>`/technical/api/components/${vessel.id}`<br>`/technical/api/components/${effectiveVesselId}`<br>`/technical/api/running-hours/parents`<br>`/technical/api/running-hours/parents?vesselId=${vessel.id}`<br>`/technical/api/running-hours/parents?vesselId=${effectiveVesselId}`<br>`/technical/api/spares/history`<br>`/technical/api/spares/history/${vessel.id}`<br>`/technical/api/spares/history/${effectiveVesselId}`<br>`/technical/api/change-requests`<br>`/technical/api/change-requests?vesselId=${id}`<br>`/technical/api/change-requests?vesselId=${effectiveVesselId}`<br>`/technical/api/change-requests?pendingForApprover=${encodeURIComponent`<br>`/technical/api/change-requests/${opDetailChangeRequest`<br>`/technical/api/work-orders/${postponeWoId}/postpone-approval-steps`<br>`/technical/api/superintendent/notifications/summary?${superintendentSummaryParams.toString`<br>`/technical/api/work-orders/${id}/postpone-approve`<br>`/technical/api/jobs` |
| `client/src/pages/pms/JobsFormPage.tsx` | `/technical/api/jobs/${jobId}/context`<br>`/technical/api/jobs/${jobId}`<br>`/technical/api/jobs`<br>`/technical/api/jobs/${jobId}/rebaseline-tracking`<br>`/technical/api/change-requests`<br>`/technical/api/jobs?vesselId=${encodeURIComponent` |
| `client/src/pages/pms/MaintenanceRecords.tsx` | `/technical/api/work-order-executions/${componentId}`<br>`/technical/api/components/details/${componentId}`<br>`/technical/api/work-orders`<br>`/technical/api/work-orders?vesselId=${component.vesselId}` |
| `client/src/pages/pms/ModifyPMS.tsx` | `/technical/api/change-requests`<br>`/technical/api/change-requests?${params}`<br>`/technical/api/change-requests/${viewingRequest`<br>`/technical/api/change-requests/${id}`<br>`/technical/api/change-requests/${id}/status`<br>`/technical/api/change-requests/${editingRequest.id}`<br>`/technical/api/change-requests/${request.id}`<br>`/technical/api/change-requests/${reviewDialog.requestId}/${endpoint}` |
| `client/src/pages/pms/PMSAdmin.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/pms/RunningHours.tsx` | `/technical/api/pms-vessel-settings`<br>`/technical/api/running-hours/children`<br>`/technical/api/running-hours/children/${selectedParentForChildRH?.componentCode}?vesselId=${rhScopeSegment}`<br>`/technical/api/running-hours/parents`<br>`/technical/api/running-hours/parents?${params}`<br>`/technical/api/running-hours/history`<br>`/technical/api/running-hours/history?${params.toString`<br>`/technical/api/running-hours/history/export?${params.toString`<br>`/technical/api/running-hours/cascade`<br>`/technical/api/rh-config`<br>`/technical/api/components`<br>`/technical/api/rh-config/master-components`<br>`/technical/api/running-hours/child/${data.componentId}` |
| `client/src/pages/pms/SparesListModal.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/pms/SuperintendentPage.tsx` | `/technical/api/superintendent/notifications?${params.toString`<br>`/technical/api/superintendent/notifications`<br>`/technical/api/work-orders`<br>`/technical/api/work-orders/${workOrderId}/superintendent-acknowledge`<br>`/technical/api/work-orders/bulk-superintendent-acknowledge` |
| `client/src/pages/pms/WorkOrderFormPage.tsx` | `/technical/api/components/details/${d3ComponentCuuid}`<br>`/technical/api/jobs/${workOrderId}/context`<br>`/technical/api/work-orders/${workOrderId}/context`<br>`/technical/api/anomalies/work-order`<br>`/technical/api/anomalies/work-order/${workOrderId}`<br>`/technical/api/spares/${vesselId}`<br>`/technical/api/inventory/locations/${vesselId}`<br>`/technical/api/hod`<br>`/technical/api/hod/${vesselId`<br>`/technical/api/inventory/spares-with-inventory/${vesselId}`<br>`/technical/api/components/${contextVesselId}`<br>`/technical/api/work-orders/${workOrderId}/documents`<br>`/technical/api/running-hours/validate`<br>`/technical/api/running-hours/current?machineryId=${encodeURIComponent`<br>`/technical/api/inventory/spares-by-component-code/${effectiveVesselId}/${encodeURIComponent`<br>`/technical/api/inventory/spares-by-component-code/${vesselId}/${encodeURIComponent`<br>`/technical/api/work-orders/${targetWoId}/documents`<br>`/technical/api/work-order-documents/${fetchId}/download`<br>`/technical/api/documents/${fileKeyEncoded}`<br>`/technical/api/work-order-documents/${documentToDelete.documentId}`<br>`/technical/api/work-orders/${workOrderId}`<br>`/technical/api/work-orders`<br>`/technical/api/scoped-operation-data`<br>`/technical/api/jobs`<br>`/technical/api/work-orders/${newWoId}`<br>`/technical/api/work-orders/${workOrderId}/reviewer-approve`<br>`/technical/api/work-orders/${workOrderId}/reviewer-reopen`<br>`/technical/api/work-orders/${workOrderId}/reject-completion`<br>`/technical/api/work-orders/${workOrderId}/reopen-completion` |
| `client/src/pages/pms/WorkOrderPlanner.tsx` | `/technical/api/work-orders/planner`<br>`/technical/api/work-orders/planner?${searchParams.toString`<br>`/technical/api/work-orders/planner/planned-date`<br>`/technical/api/work-orders/planner/bulk-planned-date`<br>`/technical/api/work-orders/planner/export` |
| `client/src/pages/pms/WorkOrders.tsx` | `/technical/api/work-orders?page=...`<br>`/technical/api/work-orders`<br>`/technical/api/work-orders?${params.toString`<br>`/technical/api/jobs`<br>`/technical/api/jobs?${params.toString`<br>`/technical/api/fleet/master-lists`<br>`/technical/api/fleet/master-lists?listType=postponementReason`<br>`/technical/api/work-orders/${id}`<br>`/technical/api/work-orders/generate-now`<br>`/technical/api/work-orders/${workOrder.id}/postpone-approval-steps`<br>`/technical/api/work-orders/${id}/postpone-approve`<br>`/technical/api/work-orders/${id}/postpone-reject`<br>`/technical/api/work-orders/${id}/postpone-request`<br>`/technical/api/work-orders/${id}/re-postpone-request`<br>`/technical/api/components?${params.toString`<br>`/technical/api/admin/available-ranks` |
| `client/src/pages/pms/WorkOrdersListModal.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/pms/anomalyColumnDefs.tsx` | No literal reference extracted; check hooks/imported helpers |
| `client/src/pages/reports/AlertsApprovalsAdminReports.tsx` | `/technical/api/work-orders`<br>`/technical/api/work-orders?${params}`<br>`/technical/api/defects`<br>`/technical/api/defects?${params}` |
| `client/src/pages/reports/ChangeRequestReports.tsx` | `/technical/api/reports/change-requests-status-tracking`<br>`/technical/api/reports/change-requests-status-tracking?${params.toString`<br>`/technical/api/reports/change-requests-status-tracking/export?${params.toString` |
| `client/src/pages/reports/ChemicalsExpiryReport.tsx` | `/technical/api/reports/chemicals-expiry/${effectiveVesselId}` |
| `client/src/pages/reports/ClassItemsJobsStatus.tsx` | `/technical/api/reports/class-items-jobs`<br>`/technical/api/reports/class-items-jobs?${buildParams` |
| `client/src/pages/reports/ClassItemsMasterList.tsx` | `/technical/api/reports/class-items-master-list`<br>`/technical/api/reports/class-items-master-list?${buildParams` |
| `client/src/pages/reports/ComplianceReports.tsx` | `/technical/api/certificates`<br>`/technical/api/certificates?${params}`<br>`/technical/api/surveys`<br>`/technical/api/surveys?${params}` |
| `client/src/pages/reports/ConsumptionPatternReport.tsx` | `/technical/api/reports/stores-consumption-analysis/${vesselId}${qs`<br>`/technical/api/reports/stores-consumption-analysis`<br>`/technical/api/reports/stores-consumption-analysis/${vesselId}/excel` |
| `client/src/pages/reports/CriticalEquipmentReports.tsx` | `/technical/api/reports/critical-components-list`<br>`/technical/api/reports/critical-components-list?${params}`<br>`/technical/api/reports/critical-equipment-schedule`<br>`/technical/api/reports/critical-equipment-schedule?${params}` |
| `client/src/pages/reports/CriticalSparesReport.tsx` | `/technical/api/reports/critical-spares/preview?${params.toString`<br>`/technical/api/reports/critical-spares/preview`<br>`/technical/api/reports/critical-spares` |
| `client/src/pages/reports/IhmInventoryStatusReport.tsx` | `/technical/api/reports/ihm-inventory-status`<br>`/technical/api/reports/ihm-inventory-status?${queryParams}`<br>`/technical/api/reports/ihm-inventory-status?${allParams.toString`<br>`/technical/api/reports/ihm-inventory-status/excel` |
| `client/src/pages/reports/IhmReports.tsx` | `/technical/api/reports/ihm-inventory-status`<br>`/technical/api/reports/ihm-inventory-status?${params}`<br>`/technical/api/reports/ihm-inventory-status/excel` |
| `client/src/pages/reports/LowStockAlertReport.tsx` | `/technical/api/reports/low-stock-alert`<br>`/technical/api/reports/stores-low-stock-alert`<br>`/technical/api/reports/snapshots`<br>`/technical/api/reports/snapshots/${effectiveVesselId}?reportType=low-stock-alert&limit=20`<br>`/technical/api/reports/snapshots/detail`<br>`/technical/api/reports/snapshots/detail/${viewingSnapshotId}`<br>`/technical/api/reports/stores-low-stock-alert/${effectiveVesselId}/excel` |
| `client/src/pages/reports/LsaFfaReports.tsx` | `/technical/api/reports/lsa-ffa-master-list`<br>`/technical/api/reports/lsa-ffa-master-list?${params}`<br>`/technical/api/reports/lsa-ffa-maintenance-schedule`<br>`/technical/api/reports/lsa-ffa-maintenance-schedule?${params}` |
| `client/src/pages/reports/MaintenancePlanner.tsx` | `/technical/api/maintenance-planner`<br>`/technical/api/maintenance-planner?${searchParams.toString`<br>`/technical/api/maintenance-planner/export?${searchParams.toString` |
| `client/src/pages/reports/MaintenanceReports.tsx` | `/technical/api/work-orders`<br>`/technical/api/work-orders${params.toString`<br>`/technical/api/jobs`<br>`/technical/api/jobs${params.toString`<br>`/technical/api/reports/due-jobs-7-days/preview?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/overdue-jobs/preview?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/completed-jobs/preview?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/all-jobs/preview?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/maintenance/monthly-summary/preview?vesselId=${activeVesselId}&year=${periodYear}&month=${periodMonth}${vesselIdsParam}`<br>`/technical/api/reports/critical-equipment-status?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/unplanned-breakdown-jobs?vesselId=${activeVesselId}${vesselIdsParam}&startDate=${startDate}&endDate=${endDate}`<br>`/technical/api/reports/postponement-log/preview?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/crew-workload-distribution?vesselId=${activeVesselId}&startDate=${wdStartDate}&endDate=${wdEndDate}&viewType=summary`<br>`/technical/api/reports/maintenance/work-order-overview/preview?vesselId=${activeVesselId}&year=${anchorYear}&month=${anchorMonth}${vesselIdsParam}`<br>`/technical/api/reports/due-jobs-7-days`<br>`/technical/api/reports/overdue-jobs`<br>`/technical/api/reports/completed-jobs`<br>`/technical/api/reports/all-jobs`<br>`/technical/api/reports/unplanned-breakdown-jobs/excel`<br>`/technical/api/reports/postponement-log`<br>`/technical/api/reports/maintenance/monthly-summary/excel`<br>`/technical/api/reports/critical-equipment-status/excel`<br>`/technical/api/reports/crew-workload-distribution/excel`<br>`/technical/api/reports/maintenance/work-order-overview/excel`<br>`/technical/api/reports/maintenance/monthly-summary/regenerate` |
| `client/src/pages/reports/ReportsModule.tsx` | `/technical/api/reports/favorites`<br>`/technical/api/reports/favorites/${reportId}` |
| `client/src/pages/reports/RunningHoursReports.tsx` | `/technical/api/components`<br>`/technical/api/components?${params}`<br>`/technical/api/running-hours`<br>`/technical/api/reports/equipment-utilization-summary?${params}`<br>`/technical/api/reports/running-hours-anomaly-detection?${params}`<br>`/technical/api/reports/equipment-utilization-summary/excel`<br>`/technical/api/reports/running-hours-anomaly-detection/excel` |
| `client/src/pages/reports/SparesConsumptionPatternReport.tsx` | `/technical/api/reports/spares-consumption-analysis`<br>`/technical/api/reports/spares-consumption-analysis/${vesselId}/component-names`<br>`/technical/api/reports/spares-consumption-analysis/${vesselId}${qs`<br>`/technical/api/reports/spares-consumption-analysis/${vesselId}/excel` |
| `client/src/pages/reports/SparesReports.tsx` | `/technical/api/spares`<br>`/technical/api/spares/${effectiveVesselId}`<br>`/technical/api/reports/low-stock-alert/${activeVesselId}?_=1${vesselIdsParam}`<br>`/technical/api/reports/critical-spares/preview?vesselId=${activeVesselId}${vesselIdsParam}`<br>`/technical/api/reports/consumption-analysis/${activeVesselId}?_=1${vesselIdsParam}`<br>`/technical/api/reports/low-stock-alert/${activeVesselId}/excel`<br>`/technical/api/reports/critical-spares`<br>`/technical/api/reports/consumption-analysis/${activeVesselId}/excel` |
| `client/src/pages/reports/StoresInventoryStatusReport.tsx` | `/technical/api/stores/${effectiveVesselId}`<br>`/technical/api/stores/${effectiveVesselId}/history`<br>`/technical/api/reports/stores-inventory-status/${effectiveVesselId}/excel` |
| `client/src/pages/reports/StoresReports.tsx` | `/technical/api/stores`<br>`/technical/api/stores/${effectiveVesselId}`<br>`/technical/api/reports/stores-low-stock-alert/${activeVesselId}?_=1${vesselIdsParam}`<br>`/technical/api/reports/stores-consumption-analysis/${activeVesselId}${storesConsQs}`<br>`/technical/api/reports/stores-inventory-status/${activeVesselId}/excel`<br>`/technical/api/reports/stores-low-stock-alert/${activeVesselId}/excel`<br>`/technical/api/reports/stores-consumption-analysis/${activeVesselId}/excel` |
| `client/src/pages/spares/BulkUpdateSpares.tsx` | `/technical/api/inventory/spares-with-inventory`<br>`/technical/api/inventory/spares-with-inventory/${vesselId}`<br>`/technical/api/vessel-location-names/${vesselId}`<br>`/technical/api/spares/bulk-update` |
| `client/src/pages/spares/SparesNew.tsx` | `/technical/api/spares/${vesselId}/${spareId}`<br>`/technical/api/inventory/spares-with-inventory`<br>`/technical/api/spares/history`<br>`/technical/api/inventory/transactions`<br>`/technical/api/inventory/stock/full-by-location/${vesselId}/${selectedLocationId}`<br>`/technical/api/spares/${vesselId}/${spare.id}`<br>`/technical/api/inventory/stock/full-by-location/${vesselId}/${newLocationId}`<br>`/technical/api/inventory/stock/locations-with-stock/${vesselId}`<br>`/technical/api/inventory/locations/${vesselId}`<br>`/technical/api/spares/${vesselId}`<br>`/technical/api/spares/${vesselId}/${spareId}/adjust`<br>`/technical/api/change-requests`<br>`/technical/api/fleet/makers`<br>`/technical/api/inventory/spares-with-inventory/${sparesScopeSegment}?${params.toString`<br>`/technical/api/spares/history/${sparesScopeSegment}${qs`<br>`/technical/api/components/${vesselId}`<br>`/technical/api/vessel-location-names/${vesselId}`<br>`/technical/api/spares/${id}/consume-from-location`<br>`/technical/api/spares/${id}/receive-to-location`<br>`/technical/api/spares/${vesselId}/${id}/adjustment`<br>`/technical/api/spares/${vesselId}/${selectedSpare.id}`<br>`/technical/api/spares/bulk-update`<br>`/technical/api/spares`<br>`/technical/api/spares/${targetVesselId}/${id}`<br>`/technical/api/spares/${selectedSpare.id}/consume-from-location`<br>`/technical/api/spares/${selectedSpare.id}/receive-to-location` |
| `client/src/pages/stores/BulkUpdateStores.tsx` | `/technical/api/stores/${vesselId}?itemType=${activeTab}`<br>`/technical/api/vessel-location-names/${vesselId}`<br>`/technical/api/stores/${vesselId}/batch-consume`<br>`/technical/api/stores/${vesselId}/batch-receive`<br>`/technical/api/stores`<br>`/technical/api/stores/item/${update.itemId}` |
| `client/src/pages/stores/Stores.tsx` | `/technical/api/stores/all?itemType=${activeTab}&vesselIds=${assignedVesselIds.join`<br>`/technical/api/stores/${vesselId}?itemType=${activeTab}`<br>`/technical/api/stores/all/history?itemType=${activeTab}&vesselIds=${assignedVesselIds.join`<br>`/technical/api/stores/${vesselId}/history?itemType=${activeTab}`<br>`/technical/api/vessel-location-names/${vesselId}`<br>`/technical/api/inventory/locations/${vesselId}`<br>`/technical/api/stores/${vesselId}/${item.id}`<br>`/technical/api/stores`<br>`/technical/api/stores/${vesselId}/${itemId}`<br>`/technical/api/stores/${vesselId}/history`<br>`/technical/api/change-requests`<br>`/technical/api/stores/${vesselId}/create`<br>`/technical/api/stores/${vesselId}/${editingItem.id}`<br>`/technical/api/stores/${vesselId}/batch-receive`<br>`/technical/api/stores/${vesselId}/batch-consume`<br>`/technical/api/stores/${vesselId}/${storeId}/inactivate`<br>`/technical/api/stores/item/${item.id}` |

## Appendix E — Exported backend/shared symbol index

Function/class declaration locations for selected module controllers/services/repositories/utilities, older services, and shared calculations. This is a lookup index, not a call graph or evidence that all exports are currently invoked. Files under test folders are excluded. Private nested helpers, most class methods, interface/type definitions and ordinary exported constants are not exhaustively indexed. Use each file and the narrative to understand the responsibility and inputs before editing.

### `server/modules/access-control/controllers/viewModeController.ts`

| Exported symbol | Source line |
|---|---:|
| `getViewModesHandler` | 17 |
| `getRoleViewMappingsHandler` | 26 |
| `putRoleViewMappingsHandler` | 35 |
| `resolveViewModeHandler` | 68 |

### `server/modules/access-control/repositories/viewModeRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getActiveViewModes` | 20 |
| `getRolesWithMappings` | 37 |
| `getActiveRoleByTypeAndName` | 65 |
| `getActiveRoleByRuid` | 89 |
| `getMappingByRoleRuid` | 110 |
| `upsertMapping` | 130 |
| `softDeleteMapping` | 154 |

### `server/modules/access-control/services/viewModeService.ts`

| Exported symbol | Source line |
|---|---:|
| `listViewModes` | 31 |
| `getRoleViewMappings` | 35 |
| `ValidationError` | 46 |
| `saveMappings` | 56 |
| `resolveViewMode` | 99 |

### `server/modules/alerts/controllers/alertsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getPolicies` | 6 |
| `getPolicy` | 13 |
| `updatePolicy` | 21 |
| `batchUpdatePolicies` | 29 |
| `getEvents` | 36 |
| `getEvent` | 50 |
| `acknowledgeEvent` | 58 |
| `getAcknowledgements` | 70 |
| `getEventsForCurrentUser` | 78 |
| `sendTestAlert` | 88 |
| `getConfig` | 96 |
| `updateConfig` | 103 |

### `server/modules/alerts/evaluators/certificateEvaluators.ts`

| Exported symbol | Source line |
|---|---:|
| `evaluateCertificateExpiring` | 51 |
| `evaluateCertificateExpired` | 107 |

### `server/modules/alerts/evaluators/defectEvaluators.ts`

| Exported symbol | Source line |
|---|---:|
| `evaluateDefectOverdue` | 48 |
| `evaluateDefectCoc` | 94 |

### `server/modules/alerts/evaluators/lowSparesEvaluator.ts`

| Exported symbol | Source line |
|---|---:|
| `evaluateLowSpares` | 37 |

### `server/modules/alerts/evaluators/overdueJobsEvaluator.ts`

| Exported symbol | Source line |
|---|---:|
| `evaluateOverdueJobs` | 38 |

### `server/modules/alerts/evaluators/skippedCyclesEvaluator.ts`

| Exported symbol | Source line |
|---|---:|
| `evaluateSkippedCycles` | 38 |

### `server/modules/alerts/evaluators/surveyEvaluators.ts`

| Exported symbol | Source line |
|---|---:|
| `evaluateSurveyDueSoon` | 38 |
| `evaluateSurveyWindowClosing` | 84 |
| `evaluateSurveyOverdue` | 131 |

### `server/modules/alerts/repositories/alertsRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getAlertPolicies` | 5 |
| `getAlertPolicy` | 9 |
| `updateAlertPolicy` | 13 |
| `getAlertEvents` | 19 |
| `getAlertEvent` | 30 |
| `getAlertDeliveries` | 34 |
| `acknowledgeAlertEvent` | 38 |
| `createAlertEvent` | 42 |
| `createAlertDelivery` | 46 |
| `getAlertAcknowledgements` | 52 |
| `createAlertAcknowledgement` | 56 |
| `getExistingAlertDedupeKeys` | 62 |
| `getWorkOrdersWithMissedCycles` | 66 |
| `getAllVesselSpares` | 70 |
| `getLowCriticalSpareCandidates` | 77 |
| `getUnacknowledgedAlertEventsForRole` | 81 |
| `getAlertConfig` | 87 |
| `createOrUpdateAlertConfig` | 91 |

### `server/modules/alerts/services/alertsService.ts`

| Exported symbol | Source line |
|---|---:|
| `getPolicies` | 6 |
| `getPolicy` | 10 |
| `updatePolicy` | 18 |
| `batchUpdatePolicies` | 22 |
| `getEvents` | 36 |
| `getEvent` | 54 |
| `acknowledgeEvent` | 63 |
| `getAcknowledgements` | 120 |
| `getEventsForCurrentUser` | 124 |
| `sendTestAlert` | 130 |
| `getConfig` | 178 |
| `updateConfig` | 191 |

### `server/modules/alerts/services/pmsAlertEngine.ts`

| Exported symbol | Source line |
|---|---:|
| `PmsAlertEngine` | 33 |

### `server/modules/audit/controller.ts`

| Exported symbol | Source line |
|---|---:|
| `getAuditTrail` | 39 |
| `exportAuditTrailExcel` | 52 |

### `server/modules/audit/excel.ts`

| Exported symbol | Source line |
|---|---:|
| `buildAuditTrailWorkbook` | 25 |

### `server/modules/audit/service.ts`

| Exported symbol | Source line |
|---|---:|
| `getAuditTrail` | 248 |
| `getAuditTrailForExport` | 269 |

### `server/modules/bulk-upload/controllers/bulkController.ts`

| Exported symbol | Source line |
|---|---:|
| `getTemplate` | 84 |
| `getSheets` | 696 |
| `dryRun` | 722 |
| `doImport` | 868 |
| `doImportStream` | 986 |
| `doLocationsImportStream` | 1129 |
| `getImportStatus` | 1253 |
| `getHistoryList` | 1281 |
| `downloadOriginal` | 1299 |
| `getHistoryFileHandler` | 1361 |
| `undoImport` | 1380 |
| `get_makers_export` | 1740 |
| `get_makers` | 1778 |
| `get_makersByid` | 1789 |
| `post_makers` | 1803 |
| `patch_makersByid` | 1847 |
| `delete_makersByid` | 1880 |
| `post_makers_import` | 1898 |
| `get_sfi_details` | 1988 |
| `get_sfi_detailsByid` | 1999 |
| `post_sfi_details` | 2013 |
| `patch_sfi_detailsByid` | 2041 |
| `delete_sfi_detailsByid` | 2073 |
| `post_sfi_details_import` | 2091 |
| `get_locations_template` | 2163 |
| `post_locations_import` | 2185 |
| `get_locations` | 2276 |
| `put_locationsByid` | 2290 |
| `delete_locationsByid` | 2309 |
| `exportSummary` | 2323 |
| `get_rotational_items_template` | 2422 |
| `doRotationalItemsImportStream` | 2470 |

### `server/modules/bulk-upload/services/dryRunCache.ts`

| Exported symbol | Source line |
|---|---:|
| `cleanExpiredCache` | 5 |

### `server/modules/bulk-upload/services/helpers.ts`

| Exported symbol | Source line |
|---|---:|
| `checkTemplateVersion` | 9 |
| `addVersionInfoToSheet` | 51 |
| `getColumnLetter` | 60 |
| `extractRawExcelData` | 75 |
| `getExplicitParentFromRowEarly` | 653 |
| `normalizeColumnNames` | 683 |
| `setDynamicComponentCategories` | 745 |
| `resetDynamicComponentCategories` | 759 |
| `getEffectiveComponentCategories` | 764 |
| `getComponentCategory` | 771 |
| `getSubGroupCode` | 778 |
| `getSubGroupName` | 790 |
| `getExplicitParentFromRow` | 818 |
| `getTypeFromSheetName` | 892 |

### `server/modules/bulk-upload/services/historyService.ts`

| Exported symbol | Source line |
|---|---:|
| `getImportHistory` | 6 |
| `getHistoryFile` | 29 |

### `server/modules/bulk-upload/services/importService.ts`

| Exported symbol | Source line |
|---|---:|
| `processSpareInventory` | 113 |
| `trackChange` | 172 |
| `performImport` | 250 |
| `createComponentFromRow` | 2868 |
| `updateComponentFromRow` | 3032 |
| `createWorkOrderFromRow` | 3243 |
| `updateWorkOrderFromRow` | 3332 |
| `storeImportHistory` | 3352 |

### `server/modules/bulk-upload/services/templateService.ts`

| Exported symbol | Source line |
|---|---:|
| `generateFleetMasterTemplate` | 24 |
| `generateWorkOrdersTemplate` | 541 |
| `generateJobsTemplate` | 737 |
| `generateSparesTemplate` | 955 |
| `generateWoHistoryTemplate` | 1109 |
| `generateStoreHistoryTemplate` | 1228 |
| `generateSpareHistoryTemplate` | 1326 |

### `server/modules/bulk-upload/services/undoService.ts`

| Exported symbol | Source line |
|---|---:|
| `createRecordSnapshot` | 3 |

### `server/modules/bulk-upload/services/validationService.ts`

| Exported symbol | Source line |
|---|---:|
| `validateData` | 125 |

### `server/modules/change-requests/controllers/changeRequestsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getFieldDefinitions` | 7 |
| `getTargetEntity` | 16 |
| `getChangeRequests` | 24 |
| `getChangeRequest` | 40 |
| `createChangeRequest` | 48 |
| `updateStatus` | 55 |
| `getApprovalSteps` | 63 |
| `getComments` | 71 |
| `createComment` | 79 |
| `getAttachments` | 87 |
| `createAttachment` | 95 |
| `approveChangeRequest` | 103 |
| `rejectChangeRequest` | 119 |
| `getRejectionHistory` | 134 |

### `server/modules/change-requests/repositories/changeRequestsRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getChangeRequests` | 11 |
| `getChangeRequest` | 15 |
| `createChangeRequest` | 19 |
| `updateChangeRequest` | 23 |
| `deleteChangeRequest` | 27 |
| `approveChangeRequest` | 33 |
| `getAuditLogsByEntity` | 37 |
| `rejectChangeRequest` | 41 |
| `returnChangeRequest` | 45 |
| `submitChangeRequest` | 49 |
| `getChangeRequestApprovalSteps` | 55 |
| `createChangeRequestApprovalStep` | 59 |
| `updateChangeRequestApprovalStep` | 63 |
| `getApprovalWorkflowConfig` | 69 |
| `getChangeRequestComments` | 75 |
| `createChangeRequestComment` | 79 |
| `getChangeRequestAttachments` | 85 |
| `createChangeRequestAttachment` | 89 |
| `getComponent` | 95 |
| `getJob` | 99 |
| `getWorkOrder` | 103 |
| `getSpare` | 107 |
| `getStoresItem` | 111 |

### `server/modules/change-requests/services/changeRequestsService.ts`

| Exported symbol | Source line |
|---|---:|
| `getFieldDefs` | 42 |
| `getTargetEntity` | 54 |
| `getChangeRequests` | 102 |
| `getChangeRequest` | 150 |
| `createChangeRequest` | 158 |
| `updateStatus` | 195 |
| `approveChangeRequest` | 394 |
| `rejectChangeRequest` | 433 |
| `getApprovalSteps` | 459 |
| `getRejectionHistory` | 467 |
| `getComments` | 504 |
| `createComment` | 508 |
| `getAttachments` | 516 |
| `createAttachment` | 520 |

### `server/modules/components/controllers/componentController.ts`

| Exported symbol | Source line |
|---|---:|
| `updateSortOrder` | 22 |
| `listByVessel` | 39 |
| `getDetails` | 50 |
| `listAll` | 59 |
| `getById` | 69 |
| `create` | 78 |
| `update` | 94 |
| `remove` | 117 |
| `inactivate` | 144 |

### `server/modules/components/controllers/componentUploadController.ts`

| Exported symbol | Source line |
|---|---:|
| `upload` | 6 |

### `server/modules/components/controllers/subEntityController.ts`

| Exported symbol | Source line |
|---|---:|
| `listDocuments` | 14 |
| `createDocument` | 20 |
| `updateDocument` | 37 |
| `deleteDocument` | 49 |
| `downloadDocument` | 54 |
| `listClassRegulatory` | 64 |
| `createClassRegulatory` | 70 |
| `updateClassRegulatory` | 83 |
| `deleteClassRegulatory` | 96 |
| `listRequisitions` | 103 |
| `listAllRequisitions` | 109 |
| `getRequisition` | 116 |
| `createRequisition` | 122 |
| `updateRequisition` | 135 |
| `deleteRequisition` | 148 |
| `listAllMaintenanceHistory` | 155 |
| `listVesselMaintenanceHistory` | 160 |
| `listMaintenanceHistory` | 168 |
| `getMaintenanceHistoryItem` | 174 |
| `listEquipmentCategories` | 182 |
| `createEquipmentCategory` | 187 |
| `updateEquipmentCategory` | 196 |
| `deleteEquipmentCategory` | 209 |

### `server/modules/components/repositories/componentRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `findByVesselId` | 27 |
| `findByVesselIds` | 32 |
| `findById` | 37 |
| `findByIdOrCode` | 44 |
| `findAll` | 58 |
| `create` | 68 |
| `findByCodeAndVessel` | 72 |
| `findByNameAndVessel` | 80 |
| `update` | 95 |
| `remove` | 99 |
| `createAuditLog` | 106 |
| `inactivate` | 110 |
| `bulkUpsert` | 114 |
| `setRunningHours` | 118 |
| `getInheritedComponents` | 128 |
| `findDocuments` | 134 |
| `findDocument` | 138 |
| `createDocument` | 142 |
| `updateDocument` | 146 |
| `deleteDocument` | 150 |
| `findClassRegulatory` | 156 |
| `findClassRegulatoryItem` | 160 |
| `createClassRegulatory` | 164 |
| `updateClassRegulatory` | 168 |
| `deleteClassRegulatory` | 172 |
| `findRequisitions` | 178 |
| `findAllRequisitions` | 182 |
| `findRequisitionItem` | 186 |
| `createRequisition` | 190 |
| `updateRequisition` | 194 |
| `deleteRequisition` | 198 |
| `findAllMaintenanceHistory` | 204 |
| `findMaintenanceHistory` | 208 |
| `findMaintenanceHistoryByCode` | 212 |
| `findMaintenanceHistoryItem` | 216 |
| `findMaintenanceHistoryByVessel` | 220 |
| `updateSortOrder` | 226 |
| `updateHierarchyAndSortOrder` | 242 |
| `findEquipmentCategories` | 327 |
| `createEquipmentCategory` | 332 |
| `updateEquipmentCategory` | 342 |
| `deleteEquipmentCategory` | 356 |

### `server/modules/components/services/componentService.ts`

| Exported symbol | Source line |
|---|---:|
| `syncRotationalRegistry` | 99 |
| `listByVessel` | 281 |
| `listAll` | 285 |
| `getById` | 298 |
| `create` | 302 |
| `update` | 440 |
| `updateSortOrder` | 659 |
| `remove` | 678 |
| `inactivate` | 724 |

### `server/modules/components/services/componentUploadService.ts`

| Exported symbol | Source line |
|---|---:|
| `processUpload` | 105 |

### `server/modules/components/services/documentService.ts`

| Exported symbol | Source line |
|---|---:|
| `listDocuments` | 45 |
| `createDocument` | 60 |
| `updateDocument` | 150 |
| `deleteDocument` | 180 |
| `downloadDocument` | 200 |

### `server/modules/components/services/shipVesselAccess.ts`

| Exported symbol | Source line |
|---|---:|
| `assertShipVesselAccess` | 9 |

### `server/modules/components/services/subEntityService.ts`

| Exported symbol | Source line |
|---|---:|
| `listClassRegulatory` | 14 |
| `createClassRegulatory` | 23 |
| `updateClassRegulatory` | 41 |
| `deleteClassRegulatory` | 60 |
| `listRequisitions` | 66 |
| `listAllRequisitions` | 109 |
| `getRequisition` | 118 |
| `createRequisition` | 127 |
| `updateRequisition` | 150 |
| `deleteRequisition` | 167 |
| `listAllMaintenanceHistory` | 173 |
| `listVesselMaintenanceHistory` | 177 |
| `listMaintenanceHistory` | 182 |
| `getMaintenanceHistoryItem` | 198 |
| `listEquipmentCategories` | 209 |
| `createEquipmentCategory` | 213 |
| `updateEquipmentCategory` | 231 |
| `deleteEquipmentCategory` | 251 |

### `server/modules/dashboard/services/maintenanceTrendService.ts`

| Exported symbol | Source line |
|---|---:|
| `getMaintenanceTrend` | 94 |

### `server/modules/dashboard/services/woStatusByPeriodService.ts`

| Exported symbol | Source line |
|---|---:|
| `getWoStatusByPeriod` | 296 |

### `server/modules/fleet/controllers/fleetAdminController.ts`

| Exported symbol | Source line |
|---|---:|
| `getMasterDataList` | 9 |
| `getMasterDataItem` | 19 |
| `getMasterDataByCode` | 33 |
| `createMasterData` | 46 |
| `updateMasterData` | 59 |
| `deleteMasterData` | 73 |
| `generateFleetEquipmentCode` | 87 |
| `getFleetComponents` | 101 |
| `exportFleetComponents` | 111 |
| `getFleetComponentById` | 123 |
| `getFleetComponentByCode` | 137 |
| `createFleetComponent` | 150 |
| `updateFleetComponent` | 169 |
| `deleteFleetComponent` | 186 |
| `getFleetVesselMappings` | 204 |
| `getFleetVesselMappingsByEquipment` | 214 |
| `getFleetVesselMappingsByVessel` | 224 |
| `createFleetVesselMapping` | 234 |
| `deleteFleetVesselMapping` | 247 |
| `getComponentVesselMappings` | 261 |
| `createComponentVesselMapping` | 271 |
| `mapVesselWithAutoLinkage` | 284 |
| `deleteComponentVesselMapping` | 297 |
| `getFleetComponentMappings` | 312 |
| `getFleetComponentMappingsByEquipment` | 322 |
| `getFleetComponentMappingsByVessel` | 332 |
| `createFleetComponentMapping` | 342 |
| `deleteFleetComponentMapping` | 355 |
| `getFleetJobMappings` | 372 |
| `getFleetJobMappingsByJob` | 382 |
| `getFleetJobMappingsByVessel` | 392 |
| `createFleetJobMapping` | 402 |
| `deleteFleetJobMapping` | 415 |
| `getFleetSpareMappings` | 432 |
| `getFleetSpareMappingsBySpare` | 442 |
| `getFleetSpareMappingsByVessel` | 452 |
| `createFleetSpareMapping` | 462 |
| `deleteFleetSpareMapping` | 475 |
| `getImportHistory` | 492 |
| `getImportHistoryItem` | 502 |
| `getImportErrors` | 516 |
| `createImportHistory` | 527 |
| `updateImportHistory` | 540 |
| `createImportErrors` | 551 |
| `getDashboardMetrics` | 571 |
| `getDashboardStats` | 581 |
| `copyVessel` | 595 |
| `resyncComponents` | 615 |
| `resyncJobs` | 629 |
| `resyncSpares` | 643 |

### `server/modules/fleet/controllers/fleetController.ts`

| Exported symbol | Source line |
|---|---:|
| `getFleetScopedComponents` | 8 |
| `getFleetScopedComponent` | 18 |
| `createFleetScopedComponent` | 31 |
| `updateFleetScopedComponent` | 47 |
| `deleteFleetScopedComponent` | 66 |
| `updateComponentSortOrder` | 82 |
| `exportFleetJobs` | 99 |
| `getFleetJobs` | 113 |
| `getFleetJob` | 123 |
| `createFleetJob` | 136 |
| `updateFleetJob` | 152 |
| `deleteFleetJob` | 171 |
| `exportFleetSpares` | 191 |
| `getFleetSpares` | 205 |
| `getFleetSpare` | 215 |
| `createFleetSpare` | 228 |
| `updateFleetSpare` | 241 |
| `deleteFleetSpare` | 265 |
| `getMakers` | 282 |
| `getMakerById` | 293 |
| `createMaker` | 306 |
| `updateMaker` | 319 |
| `deleteMaker` | 335 |
| `getMasterLists` | 352 |
| `getMasterListById` | 363 |
| `createMasterList` | 376 |
| `updateMasterList` | 392 |
| `deleteMasterList` | 411 |
| `getMasterListTypes` | 428 |
| `getMasterListTypeById` | 440 |
| `createMasterListType` | 453 |
| `updateMasterListType` | 470 |
| `deleteMasterListType` | 487 |
| `getFleetVesselMappings` | 505 |
| `createFleetVesselMappings` | 515 |
| `deleteFleetVesselMapping` | 528 |

### `server/modules/fleet/repositories/fleetAdminRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getMasterDataList` | 24 |
| `getMasterDataItem` | 28 |
| `getMasterDataByFleetCode` | 32 |
| `getMasterDataByMakerModel` | 36 |
| `generateFleetEquipmentCode` | 40 |
| `createMasterData` | 44 |
| `updateMasterData` | 48 |
| `deleteMasterData` | 52 |
| `getFleetComponents` | 60 |
| `getFleetComponent` | 64 |
| `getFleetComponentByCode` | 68 |
| `getFleetComponentByName` | 72 |
| `createFleetComponent` | 83 |
| `updateFleetComponent` | 87 |
| `deleteFleetComponent` | 91 |
| `getAdminFleetVesselMappings` | 99 |
| `getFleetVesselMappingsByVessel` | 103 |
| `createFleetVesselMappingRecord` | 107 |
| `deleteAdminFleetVesselMapping` | 111 |
| `getComponentVesselMappings` | 119 |
| `createComponentVesselMapping` | 123 |
| `deleteComponentVesselMapping` | 127 |
| `getFleetComponentMappings` | 135 |
| `getFleetComponentMappingsByVessel` | 139 |
| `createFleetComponentMappingRecord` | 143 |
| `removeFleetComponentMappingRecord` | 147 |
| `getFleetJobVesselMappings` | 155 |
| `createFleetJobVesselMappingRecord` | 159 |
| `removeFleetJobVesselMappingRecord` | 163 |
| `getFleetSpareVesselMappings` | 171 |
| `createFleetSpareVesselMappingRecord` | 175 |
| `removeFleetSpareVesselMappingRecord` | 179 |
| `getBulkImportHistory` | 187 |
| `getBulkImportHistoryItem` | 191 |
| `getBulkImportErrors` | 195 |
| `createBulkImportHistory` | 199 |
| `updateBulkImportHistory` | 203 |
| `createBulkImportErrors` | 207 |
| `getFleetAdminMetrics` | 215 |
| `getDashboardStatsData` | 219 |
| `getCopyVesselDb` | 232 |
| `getVesselComponentsByFleetEquipmentPrefix` | 243 |
| `getActiveComponentMappingsForVessel` | 262 |
| `getActiveFleetComponentByCode` | 275 |
| `getComponentByCuuid` | 286 |
| `updateComponentResyncFields` | 293 |
| `getActiveJobMappingsForVessel` | 300 |
| `getFleetJobByCode` | 313 |
| `getJobByJuuid` | 324 |
| `updateJobResyncFields` | 331 |
| `getActiveSpareMappingsForVessel` | 338 |
| `getFleetSpareByPartCode` | 351 |
| `getSpareBySuuid` | 362 |
| `updateSpareResyncFields` | 369 |

### `server/modules/fleet/repositories/fleetRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getFleetScopedComponents` | 8 |
| `getFleetScopedComponent` | 12 |
| `createFleetScopedComponent` | 16 |
| `updateFleetScopedComponent` | 20 |
| `deleteFleetScopedComponent` | 24 |
| `updateComponentSortOrder` | 28 |
| `getFleetJobs` | 43 |
| `getFleetJob` | 47 |
| `createFleetJob` | 51 |
| `updateFleetJob` | 55 |
| `deleteFleetJob` | 59 |
| `getFleetSpares` | 67 |
| `getFleetSpare` | 71 |
| `createFleetSpare` | 75 |
| `updateFleetSpare` | 79 |
| `deleteFleetSpare` | 83 |
| `getMakers` | 91 |
| `getMakerById` | 95 |
| `createMaker` | 99 |
| `updateMaker` | 103 |
| `deleteMaker` | 107 |
| `getMasterLists` | 115 |
| `getMasterListById` | 119 |
| `createMasterList` | 123 |
| `updateMasterList` | 127 |
| `deleteMasterList` | 131 |
| `getMasterListTypes` | 139 |
| `getAllMasterListTypesIncludingInactive` | 143 |
| `getMasterListTypeById` | 147 |
| `getMasterListTypeByKey` | 151 |
| `createMasterListType` | 155 |
| `updateMasterListType` | 159 |
| `softDeleteMasterListType` | 163 |
| `countMasterListItemsByType` | 167 |
| `getFleetVesselMappings` | 175 |
| `createFleetVesselMappings` | 179 |
| `deleteFleetVesselMapping` | 183 |

### `server/modules/fleet/services/fleetAdminService.ts`

| Exported symbol | Source line |
|---|---:|
| `getMasterDataList` | 20 |
| `getMasterDataItem` | 45 |
| `getMasterDataByCode` | 55 |
| `createMasterData` | 70 |
| `updateMasterData` | 102 |
| `deleteMasterData` | 112 |
| `generateFleetEquipmentCode` | 123 |
| `getFleetComponents` | 132 |
| `exportFleetComponents` | 157 |
| `getFleetComponentById` | 198 |
| `getFleetComponentByCode` | 208 |
| `createFleetComponent` | 218 |
| `updateFleetComponent` | 242 |
| `deleteFleetComponent` | 264 |
| `getFleetVesselMappings` | 279 |
| `getFleetVesselMappingsByEquipment` | 297 |
| `getFleetVesselMappingsByVessel` | 301 |
| `createFleetVesselMapping` | 305 |
| `deleteFleetVesselMapping` | 310 |
| `getComponentVesselMappings` | 328 |
| `createComponentVesselMapping` | 332 |
| `mapVesselWithAutoLinkage` | 337 |
| `deleteComponentVesselMapping` | 393 |
| `getFleetComponentMappings` | 402 |
| `getFleetComponentMappingsByEquipment` | 426 |
| `getFleetComponentMappingsByVessel` | 430 |
| `createFleetComponentMapping` | 434 |
| `deleteFleetComponentMapping` | 439 |
| `getFleetJobMappings` | 460 |
| `getFleetJobMappingsByJob` | 475 |
| `getFleetJobMappingsByVessel` | 479 |
| `createFleetJobMapping` | 484 |
| `deleteFleetJobMapping` | 489 |
| `getFleetSpareMappings` | 510 |
| `getFleetSpareMappingsBySpare` | 525 |
| `getFleetSpareMappingsByVessel` | 529 |
| `createFleetSpareMapping` | 534 |
| `deleteFleetSpareMapping` | 539 |
| `getImportHistory` | 560 |
| `getImportHistoryItem` | 589 |
| `getImportErrors` | 599 |
| `createImportHistory` | 603 |
| `updateImportHistory` | 608 |
| `createImportErrors` | 612 |
| `getDashboardMetrics` | 630 |
| `getDashboardStats` | 634 |
| `copyVessel` | 775 |
| `resyncComponents` | 1169 |
| `resyncJobs` | 1238 |
| `resyncSpares` | 1306 |

### `server/modules/fleet/services/fleetService.ts`

| Exported symbol | Source line |
|---|---:|
| `getFleetScopedComponents` | 17 |
| `getFleetScopedComponent` | 21 |
| `createFleetScopedComponent` | 31 |
| `updateFleetScopedComponent` | 36 |
| `deleteFleetScopedComponent` | 42 |
| `updateComponentSortOrder` | 47 |
| `getFleetJobs` | 62 |
| `getFleetJob` | 66 |
| `createFleetJob` | 76 |
| `updateFleetJob` | 81 |
| `deleteFleetJob` | 153 |
| `exportFleetJobs` | 158 |
| `getFleetSpares` | 216 |
| `getFleetSpare` | 220 |
| `createFleetSpare` | 230 |
| `updateFleetSpare` | 235 |
| `deleteFleetSpare` | 241 |
| `exportFleetSpares` | 246 |
| `getMakers` | 300 |
| `getMakerById` | 304 |
| `createMaker` | 314 |
| `updateMaker` | 335 |
| `deleteMaker` | 347 |
| `getMasterLists` | 356 |
| `getMasterListById` | 360 |
| `createMasterList` | 370 |
| `updateMasterList` | 398 |
| `deleteMasterList` | 415 |
| `getMasterListTypes` | 432 |
| `getMasterListTypeById` | 439 |
| `createMasterListType` | 449 |
| `updateMasterListType` | 471 |
| `deleteMasterListType` | 527 |
| `getFleetVesselMappings` | 558 |
| `createFleetVesselMappings` | 562 |
| `deleteFleetVesselMapping` | 581 |

### `server/modules/forms/controllers/formsController.ts`

| Exported symbol | Source line |
|---|---:|
| `seedForms` | 6 |
| `getFormDefinitions` | 13 |
| `getFormVersions` | 20 |
| `getFormVersion` | 28 |
| `createDraftVersion` | 36 |
| `updateDraftSchema` | 44 |
| `publishVersion` | 52 |
| `discardVersion` | 60 |
| `rollbackVersion` | 68 |
| `getRuntimeSchema` | 77 |

### `server/modules/forms/repositories/formsRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getFormDefinitions` | 3 |
| `seedForms` | 7 |
| `getLatestPublishedVersion` | 13 |
| `getLatestPublishedVersionByName` | 17 |
| `getFormVersions` | 21 |
| `getFormVersion` | 25 |
| `createFormVersion` | 29 |
| `updateFormVersion` | 33 |
| `publishFormVersion` | 37 |
| `discardFormVersion` | 41 |
| `createFormVersionUsage` | 45 |

### `server/modules/forms/services/formsService.ts`

| Exported symbol | Source line |
|---|---:|
| `seedForms` | 6 |
| `getFormDefinitions` | 10 |
| `getFormVersions` | 37 |
| `getFormVersion` | 41 |
| `createDraftVersion` | 49 |
| `updateDraftSchema` | 73 |
| `publishVersion` | 83 |
| `discardVersion` | 91 |
| `rollbackToVersion` | 95 |
| `getRuntimeSchema` | 124 |

### `server/modules/jobs/controllers/jobController.ts`

| Exported symbol | Source line |
|---|---:|
| `listJobs` | 17 |
| `getJob` | 31 |
| `getJobContext` | 39 |
| `createJob` | 48 |
| `updateJob` | 53 |
| `deleteJob` | 58 |
| `inactivateJob` | 63 |
| `getMaintenancePlanner` | 74 |
| `exportMaintenancePlanner` | 91 |
| `getJobMaintenanceHistory` | 121 |
| `rebaselineJobTracking` | 139 |
| `generateWorkOrder` | 153 |

### `server/modules/jobs/repositories/jobRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `findJobs` | 5 |
| `findById` | 9 |
| `create` | 13 |
| `update` | 17 |
| `remove` | 21 |
| `findJobComponentLinks` | 27 |
| `findComponent` | 33 |
| `findComponentByCode` | 37 |
| `findComponents` | 41 |
| `findWorkOrdersByJobId` | 45 |
| `findWorkOrders` | 49 |
| `findSpareInventoryByPartCodes` | 53 |
| `findSpareInventoryByPartNumbers` | 57 |
| `findSpares` | 61 |
| `findPmsVesselSettings` | 65 |
| `findMaintenanceHistoryByJobId` | 71 |
| `findMaintenanceHistoryByJobCode` | 75 |
| `createAuditLog` | 81 |

### `server/modules/jobs/services/jobContextService.ts`

| Exported symbol | Source line |
|---|---:|
| `getJobContext` | 23 |

### `server/modules/jobs/services/jobService.ts`

| Exported symbol | Source line |
|---|---:|
| `listJobs` | 12 |
| `getJob` | 88 |
| `createJob` | 94 |
| `updateJob` | 286 |
| `deleteJob` | 480 |
| `inactivateJob` | 486 |
| `getJobMaintenanceHistory` | 515 |
| `rebaselineJobTracking` | 541 |
| `generateWorkOrder` | 555 |

### `server/modules/jobs/services/maintenancePlannerService.ts`

| Exported symbol | Source line |
|---|---:|
| `getMaintenancePlannerData` | 28 |
| `exportMaintenancePlanner` | 430 |

### `server/modules/misc/controllers/adminController.ts`

| Exported symbol | Source line |
|---|---:|
| `normalizeSourceDeletionState` | 36 |
| `getSourceDeletionState` | 46 |
| `jobDueScan` | 86 |
| `purgeJobs` | 130 |
| `migrateInventory` | 155 |
| `syncWorkOrderStatus` | 255 |
| `syncMasters` | 403 |
| `reconcileApprovers` | 723 |
| `populatePostponementHistory` | 859 |
| `rhDiagnostic` | 938 |
| `repairRhTracking` | 1077 |

### `server/modules/misc/controllers/documentsController.ts`

| Exported symbol | Source line |
|---|---:|
| `downloadDoc` | 9 |
| `uploadDocument` | 27 |
| `getDocument` | 63 |
| `deleteDocument` | 82 |

### `server/modules/ranks/controller.ts`

| Exported symbol | Source line |
|---|---:|
| `getRanks` | 5 |
| `getRankById` | 16 |
| `saveRanks` | 27 |
| `updateRank` | 40 |
| `deleteRank` | 51 |
| `getOrgChart` | 62 |
| `getOrgChartById` | 73 |
| `saveOrgChart` | 84 |
| `updateOrgChartEntry` | 97 |
| `deleteOrgChartEntry` | 108 |
| `getVesselOrgChartNodes` | 119 |
| `getVesselDepartmentConfig` | 132 |
| `resolveHod` | 145 |
| `getHierarchyScope` | 158 |

### `server/modules/ranks/hodResolutionService.ts`

| Exported symbol | Source line |
|---|---:|
| `resolveHodForDepartment` | 15 |
| `getHodShortLabel` | 157 |

### `server/modules/ranks/repository.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllRanks` | 11 |
| `getRankById` | 19 |
| `getRankByRankId` | 28 |
| `upsertRank` | 37 |
| `softDeleteRank` | 53 |
| `getAllOrgChart` | 61 |
| `getOrgChartById` | 69 |
| `upsertOrgChartEntry` | 78 |
| `softDeleteOrgChartEntry` | 100 |
| `getVesselOrgChartNodes` | 108 |
| `getVesselDepartmentConfig` | 138 |

### `server/modules/ranks/service.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllRanks` | 25 |
| `getRankByRankId` | 35 |
| `saveRanks` | 45 |
| `updateRank` | 100 |
| `deleteRank` | 124 |
| `getAllOrgChart` | 142 |
| `getOrgChartById` | 152 |
| `saveOrgChart` | 162 |
| `updateOrgChartEntry` | 207 |
| `deleteOrgChartEntry` | 225 |
| `getVesselOrgChartNodes` | 236 |
| `getVesselDepartmentConfig` | 252 |
| `resolveHierarchyScope` | 270 |
| `resolveHierarchyScopeByRankName` | 291 |
| `resolveHierarchyScopeByRankId` | 337 |

### `server/modules/reports/controllers/changeRequestReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getChangeRequestsStatusTracking` | 8 |
| `exportChangeRequestsExcel` | 32 |

### `server/modules/reports/controllers/complianceReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getRunningHoursAnomalyDetection` | 8 |
| `exportRunningHoursAnomalyDetectionExcel` | 36 |
| `getIhmInventoryStatus` | 65 |
| `exportIhmInventoryStatusExcel` | 99 |

### `server/modules/reports/controllers/equipmentReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getTemplate` | 8 |
| `getCriticalEquipmentStatus` | 22 |
| `exportCriticalEquipmentStatusExcel` | 47 |
| `getUnplannedBreakdownJobs` | 73 |
| `exportUnplannedBreakdownJobsExcel` | 102 |
| `getCriticalComponentsList` | 131 |
| `getLsaFfaMasterList` | 167 |
| `getLsaFfaMaintenanceSchedule` | 201 |
| `getClassItemsMasterList` | 238 |
| `getClassItemsJobsStatus` | 269 |
| `getCriticalEquipmentSchedule` | 303 |

### `server/modules/reports/controllers/favoritesController.ts`

| Exported symbol | Source line |
|---|---:|
| `getFavorites` | 11 |
| `addFavorite` | 36 |
| `removeFavorite` | 87 |

### `server/modules/reports/controllers/maintenanceReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getDueJobs7DaysPreview` | 9 |
| `getOverdueJobsPreview` | 28 |
| `getCompletedJobsPreview` | 49 |
| `getAllJobsPreview` | 70 |
| `exportAllJobs` | 91 |
| `getPostponementLogPreview` | 111 |
| `exportDueJobs7Days` | 133 |
| `exportOverdueJobs` | 156 |
| `exportCompletedJobs` | 179 |
| `exportUnplannedJobs` | 202 |
| `exportPostponementLog` | 225 |
| `getMonthlySummaryPreview` | 304 |
| `getMonthlySummarySnapshotDetail` | 337 |
| `regenerateMonthlySummarySnapshots` | 370 |
| `getWorkOrderOverviewPreview` | 395 |
| `exportWorkOrderOverview` | 416 |
| `exportMonthlySummary` | 447 |

### `server/modules/reports/controllers/operationsReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getCrewWorkloadDistribution` | 8 |
| `exportCrewWorkloadDistributionExcel` | 35 |
| `getEquipmentUtilizationSummary` | 65 |
| `exportEquipmentUtilizationSummaryExcel` | 95 |

### `server/modules/reports/controllers/snapshotController.ts`

| Exported symbol | Source line |
|---|---:|
| `getSnapshots` | 8 |
| `getSnapshotDetail` | 30 |
| `getGenericReport` | 51 |

### `server/modules/reports/controllers/sparesReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `getCriticalSparesPreview` | 8 |
| `exportCriticalSparesExcel` | 36 |
| `getLowStockAlert` | 65 |
| `markSpareAsOrdered` | 89 |
| `exportLowStockAlertExcel` | 103 |
| `getSparesComponentNames` | 123 |
| `getSparesConsumptionAnalysis` | 138 |
| `exportSparesConsumptionExcel` | 163 |

### `server/modules/reports/controllers/storesReportsController.ts`

| Exported symbol | Source line |
|---|---:|
| `exportStoresInventoryStatusExcel` | 8 |
| `getStoresConsumptionAnalysis` | 30 |
| `exportStoresConsumptionExcel` | 55 |
| `getCombinedConsumptionAnalysis` | 77 |
| `exportCombinedConsumptionExcel` | 94 |
| `getChemicalsExpiry` | 112 |
| `getStoresLowStockAlert` | 135 |
| `exportStoresLowStockAlertExcel` | 158 |

### `server/modules/reports/repositories/reportRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getVessels` | 7 |
| `getComponents` | 12 |
| `getJobs` | 17 |
| `getJobComponentLinks` | 21 |
| `getWorkOrders` | 26 |
| `getSpares` | 31 |
| `updateSpare` | 35 |
| `getStoresItems` | 40 |
| `getChangeRequests` | 47 |
| `getIhmStatusReport` | 52 |
| `getSnapshots` | 65 |
| `getSnapshotDetail` | 83 |
| `getStoresConsumptionData` | 93 |
| `getSpareHistory` | 111 |
| `getStoresTransactionHistory` | 123 |
| `getStoresItemsFiltered` | 128 |
| `getComponent` | 133 |
| `getJob` | 137 |
| `getWorkOrder` | 141 |
| `getSpare` | 145 |
| `getStoresItem` | 149 |
| `getUsers` | 154 |
| `getWorkOrderPostponements` | 159 |
| `getPmsVesselSettings` | 164 |
| `getRunningHoursAudits` | 169 |

### `server/modules/reports/services/changeRequestReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `getChangeRequestsStatusTracking` | 8 |
| `exportChangeRequestsExcel` | 180 |

### `server/modules/reports/services/complianceReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `getRunningHoursAnomalyDetection` | 45 |
| `exportRunningHoursAnomalyDetectionExcel` | 275 |
| `getIhmInventoryStatus` | 560 |
| `exportIhmInventoryStatusExcel` | 777 |

### `server/modules/reports/services/equipmentReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `getTemplate` | 47 |
| `getCriticalEquipmentStatus` | 64 |
| `exportCriticalEquipmentStatusExcel` | 201 |
| `getUnplannedBreakdownJobs` | 336 |
| `exportUnplannedBreakdownJobsExcel` | 465 |
| `getCriticalComponentsList` | 657 |
| `getLsaFfaMasterList` | 780 |
| `getLsaFfaMaintenanceSchedule` | 886 |
| `getCriticalEquipmentSchedule` | 1136 |
| `getClassItemsMasterList` | 1396 |
| `getClassItemsJobsStatus` | 1536 |

### `server/modules/reports/services/maintenanceReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `getDueJobs7DaysData` | 89 |
| `exportDueJobs7Days` | 267 |
| `getOverdueJobsData` | 335 |
| `exportOverdueJobs` | 507 |
| `getCompletedJobsData` | 590 |
| `exportCompletedJobs` | 706 |
| `getAllJobsData` | 845 |
| `exportAllJobs` | 959 |
| `exportUnplannedJobs` | 1117 |
| `getPostponementLogData` | 1241 |
| `exportPostponementLog` | 1375 |
| `exportMonthlySummary` | 1498 |
| `getWorkOrderOverviewData` | 1723 |
| `exportWorkOrderOverview` | 1944 |

### `server/modules/reports/services/monthlySnapshotService.ts`

| Exported symbol | Source line |
|---|---:|
| `ensureSnapshotsExist` | 238 |
| `computeMonthlyMovement` | 308 |
| `getMonthlySummaryData` | 434 |
| `getSnapshotDetail` | 526 |
| `getMovementDetail` | 560 |
| `regenerateSnapshots` | 592 |

### `server/modules/reports/services/operationsReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `getCrewWorkloadDistribution` | 63 |
| `exportCrewWorkloadDistributionExcel` | 255 |
| `getEquipmentUtilizationSummary` | 561 |
| `exportEquipmentUtilizationSummaryExcel` | 763 |

### `server/modules/reports/services/snapshotService.ts`

| Exported symbol | Source line |
|---|---:|
| `getSnapshots` | 9 |
| `getSnapshotDetail` | 23 |
| `getGenericReport` | 45 |

### `server/modules/reports/services/sparesReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `getCriticalSparesPreview` | 25 |
| `exportCriticalSparesExcel` | 241 |
| `getLowStockAlert` | 483 |
| `markSpareAsOrdered` | 575 |
| `exportLowStockAlertExcel` | 587 |
| `getDistinctComponentNames` | 731 |
| `getSparesConsumptionAnalysis` | 758 |
| `exportSparesConsumptionExcel` | 1131 |

### `server/modules/reports/services/storesReportService.ts`

| Exported symbol | Source line |
|---|---:|
| `exportStoresInventoryStatusExcel` | 19 |
| `getStoresConsumptionAnalysis` | 272 |
| `exportStoresConsumptionExcel` | 623 |
| `getCombinedConsumptionAnalysis` | 1013 |
| `exportCombinedConsumptionExcel` | 1097 |
| `getChemicalsExpiry` | 1247 |
| `getStoresLowStockAlert` | 1348 |
| `exportStoresLowStockAlertExcel` | 1389 |

### `server/modules/retention/controller.ts`

| Exported symbol | Source line |
|---|---:|
| `getRetentionSettings` | 13 |
| `updateRetentionSetting` | 23 |
| `disposeCategory` | 38 |
| `retainCategory` | 49 |
| `revertCategory` | 60 |

### `server/modules/retention/service.ts`

| Exported symbol | Source line |
|---|---:|
| `periodToDays` | 57 |
| `getAllSettings` | 78 |
| `getEligibility` | 100 |
| `RetentionError` | 127 |
| `updateSetting` | 133 |
| `dispose` | 182 |
| `retain` | 212 |
| `revert` | 225 |

### `server/modules/rotational-items/controllers/rotationalItemController.ts`

| Exported symbol | Source line |
|---|---:|
| `listRotationalItems` | 5 |
| `createRotationalItem` | 20 |
| `updateRotationalItem` | 37 |
| `replaceRotationalItem` | 58 |
| `deleteRotationalItem` | 72 |

### `server/modules/rotational-items/repositories/rotationalItemRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `listByVessel` | 7 |
| `listByVesselWithHolder` | 20 |
| `getByRiuuid` | 49 |
| `getByStamp` | 56 |
| `getInstalledByComponentCuuid` | 73 |
| `getComponentHoldingStamp` | 92 |
| `getComponentsWithStamps` | 113 |
| `create` | 130 |
| `claimStamp` | 141 |
| `releaseStamp` | 158 |
| `update` | 181 |
| `softDelete` | 190 |

### `server/modules/rotational-items/services/rotationalItemService.ts`

| Exported symbol | Source line |
|---|---:|
| `RotationalItemValidationError` | 33 |
| `listByVesselWithHolder` | 55 |
| `getByRiuuid` | 60 |
| `listByVessel` | 64 |
| `getByStamp` | 70 |
| `createRotationalItem` | 74 |
| `updateRotationalItem` | 110 |
| `deleteRotationalItem` | 145 |
| `getInstalledForComponent` | 153 |
| `detachFromComponent` | 164 |
| `claimStamp` | 188 |
| `getComponentHoldingStamp` | 201 |
| `replaceRotationalItem` | 226 |

### `server/modules/running-hours/controllers/runningHoursController.ts`

| Exported symbol | Source line |
|---|---:|
| `getAudits` | 36 |
| `createAudit` | 41 |
| `cascadeUpdate` | 57 |
| `listParents` | 76 |
| `listChildren` | 101 |
| `updateChildRH` | 117 |
| `resetChildRH` | 133 |
| `listMasterComponents` | 147 |
| `getRHConfig` | 157 |
| `updateRHConfig` | 170 |
| `updateMasterRH` | 183 |
| `listInheritedComponents` | 198 |
| `getValidRange` | 210 |
| `validateRHEntry` | 225 |
| `getRHTimeline` | 284 |
| `getCurrentRH` | 300 |
| `propagateAll` | 316 |
| `getMeterReplacementHistory` | 330 |
| `getHistory` | 342 |
| `exportHistory` | 370 |

### `server/modules/running-hours/repositories/dateUpdatedLocalSql.ts`

| Exported symbol | Source line |
|---|---:|
| `parsedDateUpdatedLocalExpr` | 27 |
| `readingDayLocalExpr` | 40 |
| `targetReadingDay` | 45 |

### `server/modules/running-hours/repositories/runningHoursRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getComponents` | 10 |
| `getComponent` | 14 |
| `getPmsVesselSettings` | 18 |
| `accrueInstalledStampRh` | 24 |
| `updateChildRhWithStampAccrual` | 36 |
| `getInstalledStampRhBatch` | 56 |
| `updateComponent` | 89 |
| `getEarliestAuditTimestamp` | 95 |
| `sumPositiveDeltasInPeriod` | 99 |
| `getRunningHoursAtDate` | 103 |
| `getRunningHoursAudits` | 109 |
| `getRunningHoursAtDateBatch` | 148 |
| `getLatestAuditUserBatch` | 244 |
| `getLatestCompletedDateBatch` | 289 |
| `createRunningHoursAudit` | 317 |
| `getMeterReplacementHistory` | 334 |
| `cascadeRunningHoursUpdate` | 384 |
| `getMasterComponents` | 407 |
| `getInheritedComponents` | 411 |
| `updateRHConfig` | 415 |
| `updateMasterRunningHours` | 424 |
| `getRunningHoursHistory` | 482 |

### `server/modules/running-hours/rhEventComparator.ts`

| Exported symbol | Source line |
|---|---:|
| `parseReadingDay` | 40 |
| `originRank` | 78 |
| `effectiveReadingDay` | 91 |
| `compareRhEvents` | 104 |
| `incomingRhStamp` | 136 |
| `localRhClaimDay` | 155 |
| `shouldStripIncomingRh` | 163 |
| `canApplyWinningRHToCurrent` | 200 |
| `selectWinningRhEvent` | 217 |
| `applyWinningRhToComponent` | 270 |
| `selfHealInheritedRhCaches` | 466 |
| `selfHealRhComponents` | 506 |
| `resolveRhBaselineDay` | 574 |
| `claimWoRhSync` | 593 |
| `releaseWoRhSync` | 601 |

### `server/modules/running-hours/services/rhTimelineValidationService.ts`

| Exported symbol | Source line |
|---|---:|
| `getValidRange` | 138 |
| `validateRHEntry` | 260 |
| `getRHTimeline` | 415 |
| `getCurrentRH` | 496 |

### `server/modules/running-hours/services/runningHoursService.ts`

| Exported symbol | Source line |
|---|---:|
| `isRhValidationEnabledForVessel` | 6 |
| `validateCascadePolicyRules` | 42 |
| `getAuditsForComponent` | 108 |
| `createAudit` | 112 |
| `cascadeUpdate` | 139 |
| `listParents` | 286 |
| `listChildren` | 444 |
| `updateChildRH` | 518 |
| `resetChildRH` | 701 |
| `listMasterComponents` | 758 |
| `getRHConfig` | 774 |
| `updateRHConfig` | 820 |
| `updateMasterRH` | 891 |
| `listInheritedComponents` | 1051 |
| `propagateAll` | 1067 |
| `getRunningHoursHistory` | 1117 |
| `getMeterReplacementHistory` | 1125 |

### `server/modules/running-hours/utils/readingDate.ts`

| Exported symbol | Source line |
|---|---:|
| `parseReadingDayStrict` | 49 |
| `formatReadingDay` | 87 |
| `canonicalReadingDay` | 95 |
| `canonicalizeReadingDateInput` | 107 |
| `todayReadingDay` | 120 |
| `InvalidReadingDateError` | 126 |
| `requireReadingDayInput` | 142 |

### `server/modules/running-hours/utils/rhValidation.ts`

| Exported symbol | Source line |
|---|---:|
| `validateRHMonotonicity` | 46 |
| `validateRunningHoursIncrease` | 126 |
| `canAdminOverride` | 234 |
| `safeParseDate` | 244 |

### `server/modules/spares/controllers/inventoryController.ts`

| Exported symbol | Source line |
|---|---:|
| `getLocations` | 7 |
| `getLocationById` | 19 |
| `createLocation` | 34 |
| `reconcile` | 49 |
| `getSpareLinks` | 62 |
| `getSpareLinksBySpare` | 74 |
| `getSpareLinksByComponent` | 87 |
| `createSpareLink` | 99 |
| `deleteSpareLink` | 117 |
| `getSpareStock` | 130 |
| `getSparesAtLocation` | 146 |
| `getLocationsWithStock` | 159 |
| `getFullSparesAtLocation` | 171 |
| `upsertStock` | 185 |
| `createTransaction` | 208 |
| `getTransactions` | 262 |
| `getSparesWithInventory` | 274 |
| `getSpareWithInventory` | 339 |
| `getSparesByComponent` | 357 |
| `backfillSiblingLinks` | 369 |
| `getSparesByComponentCode` | 381 |

### `server/modules/spares/controllers/sparesController.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllSpares` | 18 |
| `getSpareHistoryByVessel` | 30 |
| `bulkUpdate` | 48 |
| `getSparesByVessel` | 75 |
| `getSpareById` | 87 |
| `createSpare` | 101 |
| `updateSpare` | 113 |
| `deleteSpare` | 136 |
| `inactivateSpare` | 160 |
| `adjustSpareAtLocation` | 181 |
| `adjustSpareQuantity` | 207 |
| `getSpareHistoryLegacy` | 227 |
| `getLowStockSpares` | 241 |
| `batchConsume` | 252 |
| `batchReceive` | 272 |
| `consumeSimple` | 292 |
| `receiveSimple` | 314 |
| `consumeFromLocation` | 336 |
| `receiveToLocation` | 368 |

### `server/modules/spares/repositories/inventoryRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getLocations` | 12 |
| `getLocationById` | 16 |
| `getLocationByName` | 20 |
| `createLocation` | 24 |
| `reconcileSpareLocationStock` | 30 |
| `getSpareComponentLinks` | 36 |
| `getSpareComponentLinksBySpare` | 40 |
| `getSpareComponentLinksByComponent` | 44 |
| `getLinkedComponentsForSpare` | 48 |
| `createSpareComponentLink` | 52 |
| `deleteSpareComponentLink` | 56 |
| `getSpareLocationStock` | 62 |
| `getSpareLocationsWithQty` | 66 |
| `getSpareRobTotal` | 70 |
| `getSparesAtLocation` | 74 |
| `getFullSparesAtLocation` | 78 |
| `getLocationsWithStock` | 82 |
| `upsertSpareLocationStock` | 86 |
| `performInventoryTransaction` | 92 |
| `getInventoryTransactions` | 101 |
| `getSparesWithInventoryByVessel` | 109 |
| `getSparesWithInventoryByVesselPaged` | 113 |
| `getSpareWithInventory` | 132 |
| `getSparesWithInventoryByComponent` | 136 |
| `getSparesWithInventoryByComponentCode` | 140 |
| `backfillSiblingLinks` | 146 |
| `getSpare` | 152 |

### `server/modules/spares/repositories/sparesRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllSpares` | 6 |
| `getSpares` | 10 |
| `getSpare` | 14 |
| `createSpare` | 18 |
| `updateSpare` | 22 |
| `deleteSpare` | 26 |
| `consumeSpare` | 32 |
| `consumeSpareFromLocation` | 38 |
| `receiveSpare` | 44 |
| `receiveSpareToLocation` | 50 |
| `adjustSpareQuantity` | 56 |
| `adjustSpareAtLocation` | 62 |
| `transferSpareLocation` | 68 |
| `getSpareHistory` | 76 |
| `getVessels` | 82 |

### `server/modules/spares/services/inventoryService.ts`

| Exported symbol | Source line |
|---|---:|
| `getLocations` | 25 |
| `getLocationById` | 29 |
| `createLocation` | 33 |
| `reconcile` | 54 |
| `getSpareComponentLinks` | 60 |
| `getSpareComponentLinksBySpare` | 64 |
| `getSpareComponentLinksByComponent` | 72 |
| `createSpareComponentLink` | 76 |
| `deleteSpareComponentLink` | 99 |
| `getSpareStock` | 105 |
| `getSparesAtLocation` | 119 |
| `getLocationsWithStock` | 123 |
| `getFullSparesAtLocation` | 127 |
| `upsertStock` | 131 |
| `createTransaction` | 152 |
| `getTransactions` | 170 |
| `getSparesWithInventoryByVessel` | 200 |
| `getSparesWithInventoryByVesselPaged` | 204 |
| `getSpareWithInventory` | 223 |
| `getSparesWithInventoryByComponent` | 227 |
| `getSparesWithInventoryByComponentCode` | 231 |
| `backfillSiblingLinks` | 237 |

### `server/modules/spares/services/sparesService.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllSpares` | 14 |
| `getSparesByVessel` | 18 |
| `getSpare` | 31 |
| `createSpare` | 36 |
| `updateSpare` | 43 |
| `deleteSpare` | 96 |
| `inactivateSpare` | 116 |
| `adjustSpareAtLocationEndpoint` | 136 |
| `adjustSpareQuantityEndpoint` | 158 |
| `bulkUpdate` | 187 |
| `batchConsume` | 298 |
| `batchReceive` | 313 |
| `consumeSimple` | 330 |
| `receiveSimple` | 352 |
| `consumeFromLocation` | 379 |
| `receiveToLocation` | 442 |
| `getSpareHistory` | 489 |
| `getLowStockSpares` | 495 |

### `server/modules/stores/controllers/storesController.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllStores` | 7 |
| `getStoresByVessel` | 18 |
| `getTransactionHistory` | 37 |
| `getItemHistory` | 57 |
| `createStoresItem` | 69 |
| `updateStoresItem` | 85 |
| `adjustStoresItem` | 100 |
| `patchStoresItem` | 119 |
| `deleteStoresItem` | 139 |
| `inactivateStoresItem` | 151 |
| `batchConsume` | 163 |
| `batchReceive` | 179 |

### `server/modules/stores/repositories/storesRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getStoresItems` | 6 |
| `getStoresItem` | 10 |
| `createStoresItem` | 14 |
| `updateStoresItem` | 18 |
| `deleteStoresItem` | 22 |
| `inactivateStoresItem` | 26 |
| `consumeStoresItem` | 32 |
| `receiveStoresItem` | 39 |
| `transferStoresItemLocation` | 46 |
| `adjustStoresItem` | 53 |
| `getStoresTransactionHistory` | 62 |
| `getStoresItemHistory` | 66 |
| `getVessels` | 72 |

### `server/modules/stores/services/storesService.ts`

| Exported symbol | Source line |
|---|---:|
| `getAllStores` | 6 |
| `getStoresByVessel` | 22 |
| `getTransactionHistory` | 31 |
| `getItemHistory` | 48 |
| `createStoresItem` | 54 |
| `updateStoresItem` | 70 |
| `adjustStoresItem` | 87 |
| `patchStoresItem` | 103 |
| `deleteStoresItem` | 162 |
| `inactivateStoresItem` | 168 |
| `batchConsume` | 174 |
| `batchReceive` | 206 |

### `server/modules/sync/autoSyncScheduler.ts`

| Exported symbol | Source line |
|---|---:|
| `SyncAutoScheduler` | 81 |

### `server/modules/sync/completedWorkOrderDateSync.ts`

| Exported symbol | Source line |
|---|---:|
| `ensureDateBeforeSyncedCompletedStatus` | 20 |

### `server/modules/sync/conflictReviewController.ts`

| Exported symbol | Source line |
|---|---:|
| `listConflictsHandler` | 14 |
| `countConflictsHandler` | 38 |
| `conflictTablesHandler` | 52 |
| `getConflictHandler` | 64 |
| `applyIncomingHandler` | 87 |
| `dismissHandler` | 113 |

### `server/modules/sync/conflictReviewRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getFieldDisplayName` | 132 |
| `getInstanceLabel` | 163 |
| `listConflicts` | 271 |
| `countUnresolvedConflicts` | 491 |
| `getConflict` | 520 |
| `applyIncomingConflict` | 719 |
| `dismissConflict` | 873 |
| `getConflictTableNames` | 942 |

### `server/modules/sync/controller.ts`

| Exported symbol | Source line |
|---|---:|
| `initiateSyncHandler` | 26 |
| `pushHandler` | 48 |
| `pullHandler` | 71 |
| `resolveConflictHandler` | 110 |
| `completeSyncHandler` | 139 |
| `statusHandler` | 199 |
| `recentBatchesHandler` | 253 |
| `unresolvedConflictsHandler` | 269 |
| `triggerSyncHandler` | 287 |
| `fetchRowsHandler` | 317 |
| `uploadChunkHandler` | 334 |
| `fileQueueHandler` | 366 |
| `retryFileHandler` | 400 |
| `skipFileHandler` | 414 |
| `pendingFilesHandler` | 429 |
| `downloadChunkHandler` | 444 |
| `completeFileHandler` | 463 |
| `failFileHandler` | 478 |
| `generateProvisionHandler` | 497 |
| `getManifestHandler` | 524 |
| `downloadProvisionHandler` | 542 |
| `importProvisionHandler` | 572 |
| `verifyProvisionHandler` | 592 |
| `pruneHandler` | 614 |
| `healthCheckHandler` | 634 |
| `tableStatsHandler` | 647 |
| `getSettingsHandler` | 664 |
| `updateSettingsHandler` | 677 |
| `testConnectionHandler` | 754 |
| `instanceInfoHandler` | 781 |
| `fleetOverviewHandler` | 807 |
| `diagLogHandler` | 824 |
| `diagLogsListHandler` | 841 |
| `driftListHandler` | 870 |
| `driftScanHandler` | 880 |

### `server/modules/sync/driftDetector.ts`

| Exported symbol | Source line |
|---|---:|
| `valuesEqual` | 91 |
| `runDriftScan` | 168 |
| `getOpenDrift` | 304 |

### `server/modules/sync/dualCompletionResolver.ts`

| Exported symbol | Source line |
|---|---:|
| `isWoCompletionField` | 76 |
| `chooseInterimSide` | 94 |
| `collectIncomingWoCompletionDates` | 110 |
| `findWouuidsWithOpenDualConflicts` | 132 |
| `evaluateDualCompletion` | 177 |

### `server/modules/sync/fieldLogger.ts`

| Exported symbol | Source line |
|---|---:|
| `initFieldLoggerInstanceId` | 87 |
| `getFieldLogFailureSessionCount` | 152 |
| `logFieldChanges` | 182 |
| `logFieldChangesBatch` | 352 |
| `logSoftDelete` | 466 |

### `server/modules/sync/fileSyncProcessor.ts`

| Exported symbol | Source line |
|---|---:|
| `FileSyncProcessor` | 133 |

### `server/modules/sync/healthMonitor.ts`

| Exported symbol | Source line |
|---|---:|
| `runHealthCheck` | 215 |
| `getTableStats` | 255 |
| `SyncHealthScheduler` | 280 |

### `server/modules/sync/middleware.ts`

| Exported symbol | Source line |
|---|---:|
| `requireOfflineAdmin` | 20 |

### `server/modules/sync/oneWayApplier.ts`

| Exported symbol | Source line |
|---|---:|
| `getSoftDeleteSetClause` | 49 |
| `getColumnMeta` | 63 |
| `getLatestRotationDate` | 163 |
| `isReadingPreRotation` | 193 |
| `applyRotationToComponent` | 210 |
| `evaluateJobTrackingGuard` | 269 |
| `applyOneWayRows` | 300 |
| `fieldNameToColumn` | 650 |
| `coerceArrayValue` | 659 |
| `applyFieldLogInserts` | 798 |
| `applyFullRowsIfAbsent` | 1458 |
| `gatherFullRows` | 1549 |
| `getInsertLogSkipCount` | 1623 |
| `resetInsertLogSkipCount` | 1624 |
| `evaluateInsertOriginGuard` | 1633 |
| `evaluateStaleSkipGuard` | 1693 |

### `server/modules/sync/provisioningService.ts`

| Exported symbol | Source line |
|---|---:|
| `generateProvisioningBundle` | 55 |
| `verifyBundleExportIntegrity` | 280 |
| `importProvisioningBundle` | 373 |
| `verifyProvisioning` | 851 |

### `server/modules/sync/pruningService.ts`

| Exported symbol | Source line |
|---|---:|
| `runPruning` | 162 |
| `SyncPruningScheduler` | 196 |

### `server/modules/sync/repository.ts`

| Exported symbol | Source line |
|---|---:|
| `getInstanceMetadata` | 25 |
| `upsertInstanceMetadata` | 33 |
| `getAllInstanceMetadata` | 75 |
| `retryDuePredicate` | 113 |
| `retryDelayMs` | 122 |
| `getUnsyncedFieldLogs` | 130 |
| `getFieldLogsSinceCheckpoint` | 172 |
| `markFieldLogsSynced` | 261 |
| `getFieldLogCount` | 270 |
| `insertFieldLogs` | 282 |
| `createConflict` | 303 |
| `getUnresolvedConflicts` | 321 |
| `resolveConflict` | 331 |
| `getConflictsByBatch` | 354 |
| `getConflict` | 361 |
| `queueFile` | 373 |
| `queueFileWithUuid` | 398 |
| `getFileQueueEntry` | 427 |
| `incrementRetryCount` | 435 |
| `getPendingFiles` | 445 |
| `getPendingFileCountBySize` | 468 |
| `getFileQueueForDashboard` | 487 |
| `retryFileQueueEntry` | 506 |
| `skipFileQueueEntry` | 518 |
| `updateFileStatus` | 527 |
| `markFileCompleted` | 544 |
| `getPendingFileCount` | 551 |
| `createBatch` | 566 |
| `updateBatch` | 583 |
| `getBatch` | 607 |
| `getRecentBatches` | 615 |
| `getTableCheckpoints` | 642 |
| `setTableCheckpoints` | 658 |
| `getConservativeFloor` | 705 |
| `getAllSettings` | 719 |
| `getAllSettingsFull` | 730 |
| `getSetting` | 737 |
| `updateSetting` | 748 |
| `seedSettingIfEmpty` | 765 |
| `updateSettings` | 783 |
| `insertConnectivityLog` | 807 |
| `getConnectivityLogs` | 830 |
| `getUnsyncedFieldLogCount` | 858 |
| `getDueFieldLogCount` | 893 |
| `getShorePullRemainingCount` | 918 |
| `hasDeliveredSyncHistory` | 949 |
| `resetInstanceDeliveryStateForReprovision` | 996 |
| `parseBooleanSetting` | 1100 |
| `canonicaliseBooleanSettings` | 1111 |
| `recordDeliveryAttempt` | 1139 |
| `getRetryBacklog` | 1159 |

### `server/modules/sync/service.ts`

| Exported symbol | Source line |
|---|---:|
| `initiateSyncSession` | 65 |
| `refreshRhEstimatesSafely` | 98 |
| `receivePushData` | 119 |
| `fetchFullRowsForHeal` | 1009 |
| `preparePullData` | 1024 |
| `resolveConflictAction` | 1181 |
| `completeSyncSession` | 1249 |
| `getSyncStatus` | 1410 |
| `getRecentBatches` | 1456 |
| `getUnresolvedConflicts` | 1460 |
| `getVesselProvisioningState` | 1645 |
| `getFleetSyncOverview` | 1697 |

### `server/modules/sync/shipCompletionLearner.ts`

| Exported symbol | Source line |
|---|---:|
| `refreshRhEstimatesFromAuditRows` | 54 |
| `collectCompletionWouuidsFromLogs` | 235 |
| `collectCompletionWouuidsFromFullRows` | 246 |
| `filterAdvanceOnly` | 276 |
| `learnFromShipCompletions` | 342 |

### `server/modules/sync/syncDiagLogger.ts`

| Exported symbol | Source line |
|---|---:|
| `syncDiag` | 30 |
| `getSyncLogPath` | 46 |
| `getSyncLogDir` | 51 |

### `server/modules/sync/syncEngine.ts`

| Exported symbol | Source line |
|---|---:|
| `SyncEngine` | 90 |
| `getSyncEngine` | 1502 |

### `server/modules/sync/syncRole.ts`

| Exported symbol | Source line |
|---|---:|
| `isShipInstanceId` | 30 |
| `getEffectiveInstanceId` | 44 |
| `isShipInstance` | 58 |
| `getInstanceRole` | 66 |

### `server/modules/sync/unknownColumnRetryPolicy.ts`

| Exported symbol | Source line |
|---|---:|
| `shouldRetryUnknownSyncColumn` | 9 |

### `server/modules/vessels/controllers/vesselController.ts`

| Exported symbol | Source line |
|---|---:|
| `getFleets` | 7 |
| `getFleetById` | 13 |
| `createFleet` | 18 |
| `updateFleet` | 23 |
| `deleteFleet` | 28 |
| `getVesselsByFleet` | 33 |
| `getFleetClasses` | 40 |
| `createFleetClass` | 45 |
| `updateFleetClass` | 50 |
| `deleteFleetClass` | 56 |
| `assignVesselToClass` | 61 |
| `getVessels` | 69 |
| `getVesselsWithFleets` | 74 |
| `createVessel` | 79 |
| `assignVesselToFleet` | 84 |
| `getAllPmsVesselSettings` | 91 |
| `createPmsVesselSettings` | 96 |
| `getPmsVesselSettings` | 111 |
| `updatePmsVesselSettings` | 116 |
| `deletePmsVesselSettings` | 128 |
| `updateOfficeWoGenerationSwitch` | 151 |
| `updateOfficeRhEntrySwitch` | 175 |
| `updateRhValidationSwitch` | 197 |
| `updateSuperintendentLockSwitch` | 219 |
| `getCompanyStandardGraceSettings` | 242 |
| `updateCompanyStandardGraceSettings` | 247 |
| `getVesselLocationNames` | 259 |
| `updateVesselLocationNames` | 264 |

### `server/modules/vessels/repositories/vesselRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `getFleets` | 6 |
| `getAllFleets` | 10 |
| `getFleetById` | 14 |
| `createFleet` | 18 |
| `updateFleet` | 22 |
| `deleteFleet` | 26 |
| `getVesselsByFleet` | 30 |
| `getVessels` | 36 |
| `getVesselsWithFleets` | 40 |
| `createVessel` | 44 |
| `assignVesselToFleet` | 48 |
| `getFleetClasses` | 54 |
| `createFleetClass` | 58 |
| `updateFleetClass` | 62 |
| `deleteFleetClass` | 66 |
| `assignVesselToClass` | 70 |
| `getAllPmsVesselSettings` | 76 |
| `getPmsVesselSettings` | 80 |
| `createOrUpdatePmsVesselSettings` | 84 |
| `deletePmsVesselSettings` | 88 |
| `getCompanyStandardGraceSettings` | 94 |
| `upsertCompanyStandardGraceSettings` | 98 |

### `server/modules/vessels/services/vesselService.ts`

| Exported symbol | Source line |
|---|---:|
| `getFleets` | 8 |
| `getFleetById` | 12 |
| `createFleet` | 18 |
| `updateFleet` | 42 |
| `deleteFleet` | 61 |
| `getVesselsByFleet` | 75 |
| `getVessels` | 81 |
| `getVesselsWithFleets` | 85 |
| `createVessel` | 89 |
| `assignVesselToFleet` | 119 |
| `getFleetClasses` | 132 |
| `createFleetClass` | 136 |
| `updateFleetClass` | 160 |
| `deleteFleetClass` | 178 |
| `assignVesselToClass` | 189 |
| `getAllPmsVesselSettings` | 205 |
| `getPmsVesselSettings` | 209 |
| `createPmsVesselSettings` | 215 |
| `setOfficeWoGenerationEnabled` | 248 |
| `setOfficeRhEntryEnabled` | 262 |
| `setRhValidationEnabled` | 277 |
| `setSuperintendentLockEnabled` | 291 |
| `updatePmsVesselSettings` | 301 |
| `deletePmsVesselSettings` | 453 |
| `getCompanyStandardGraceSettings` | 477 |
| `upsertCompanyStandardGraceSettings` | 491 |
| `getVesselLocationNames` | 577 |
| `updateVesselLocationNames` | 590 |

### `server/modules/work-orders/controllers/woDocumentController.ts`

| Exported symbol | Source line |
|---|---:|
| `listDocuments` | 15 |
| `uploadDocument` | 21 |
| `downloadDocument` | 59 |
| `deleteDocument` | 71 |

### `server/modules/work-orders/controllers/workOrderController.ts`

| Exported symbol | Source line |
|---|---:|
| `getApprovalPolicy` | 42 |
| `updateApprovalPolicy` | 52 |
| `listWorkOrders` | 61 |
| `getWorkOrder` | 110 |
| `generateNow` | 120 |
| `getReconcilerStatus` | 184 |
| `runReconcilerNow` | 197 |
| `getWorkOrderContext` | 207 |
| `getRejectionHistory` | 212 |
| `createWorkOrder` | 224 |
| `updateWorkOrder` | 236 |
| `deleteWorkOrder` | 300 |
| `rejectCompletion` | 314 |
| `reopenCompletion` | 340 |
| `completeWorkOrder` | 366 |
| `reviewerApprove` | 399 |
| `reviewerReopen` | 407 |
| `bulkApprove` | 415 |
| `bulkReject` | 421 |
| `autoGenerate` | 430 |
| `backfillJobIds` | 436 |
| `recalculateStatuses` | 444 |
| `checkPostponements` | 449 |
| `submitPostponeRequest` | 457 |
| `editPostponeRequest` | 468 |
| `approvePostponement` | 479 |
| `rejectPostponement` | 497 |
| `getPostponementApprovalSteps` | 515 |
| `submitRePostponeRequest` | 528 |
| `editRePostponeRequest` | 539 |
| `approveRePostponement` | 550 |
| `rejectRePostponement` | 568 |
| `getRePostponementApprovalSteps` | 586 |
| `getExecutions` | 599 |
| `getExecution` | 604 |
| `createExecution` | 609 |
| `updateExecution` | 621 |
| `bulkSuperintendentAcknowledge` | 647 |
| `superintendentAcknowledge` | 700 |
| `getSuperintendentNotifications` | 745 |
| `getAllSuperintendentNotifications` | 762 |
| `getComplianceAnomalies` | 773 |
| `getAnomaliesDashboard` | 784 |
| `getAnomalyStatistics` | 816 |
| `acknowledgeAnomaly` | 827 |
| `getAnomalyForWorkOrder` | 848 |
| `getSuperintendentNotificationsSummary` | 859 |
| `getPlannerData` | 870 |
| `savePlannedDate` | 892 |
| `bulkSavePlannedDate` | 911 |
| `exportPlanner` | 936 |
| `exportPlannerFromItems` | 958 |
| `saveOverdueReason` | 982 |
| `getScopedOperationData` | 998 |

### `server/modules/work-orders/repositories/documentRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `findByWorkOrderId` | 5 |
| `findById` | 10 |
| `create` | 16 |
| `deleteById` | 22 |
| `countByWorkOrderAndType` | 27 |
| `linkExecutionId` | 39 |

### `server/modules/work-orders/repositories/workOrderReconcileRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `findDuplicateGroups` | 23 |
| `countDuplicateGroups` | 49 |
| `getInsertOriginInstanceId` | 66 |
| `getShipInstanceIds` | 81 |
| `hasDocuments` | 91 |
| `repointChildren` | 101 |
| `countChildRows` | 119 |
| `softDeleteWorkOrder` | 129 |
| `insertArchiveRow` | 134 |
| `archiveSummary` | 158 |
| `getProvisionedVesselIds` | 172 |

### `server/modules/work-orders/repositories/workOrderRepository.ts`

| Exported symbol | Source line |
|---|---:|
| `findWorkOrders` | 5 |
| `findAlertCandidateWorkOrders` | 11 |
| `findById` | 15 |
| `findByCode` | 19 |
| `create` | 23 |
| `update` | 27 |
| `remove` | 31 |
| `findExecutions` | 37 |
| `findExecutionById` | 41 |
| `createExecution` | 45 |
| `updateExecution` | 49 |
| `findJobs` | 55 |
| `findJob` | 59 |
| `findWorkOrdersByJobId` | 63 |
| `findWorkOrdersByComponent` | 67 |
| `updateJob` | 76 |
| `findJobsByVessel` | 80 |
| `findComponents` | 84 |
| `findComponent` | 88 |
| `findComponentByCode` | 92 |
| `findPmsVesselSettings` | 98 |
| `findAllPmsVesselSettings` | 102 |
| `findRunningHoursAudits` | 108 |
| `setComponentRunningHours` | 112 |
| `createRunningHoursAudit` | 116 |
| `findSpareInventoryByPartCodes` | 122 |
| `findSpareInventoryByPartNumbers` | 126 |
| `findSpares` | 130 |
| `findOrCreateLocation` | 134 |
| `performInventoryTransaction` | 138 |
| `getSpareLocationStockItem` | 142 |
| `upsertSpareLocationStock` | 146 |
| `getLocationById` | 150 |
| `getInventoryTransactions` | 154 |
| `createMaintenanceHistory` | 160 |
| `findMaintenanceHistoryByWorkOrderId` | 164 |
| `findMaintenanceHistoryByJobId` | 168 |
| `findAllJobComponentLinks` | 172 |
| `findLinkedComponentsForJob` | 176 |
| `findUser` | 182 |
| `checkAndRevertPostponedWorkOrders` | 188 |
| `findPostponementsByWorkOrderId` | 192 |
| `createPostponement` | 196 |
| `getMaxPostponementNumber` | 200 |
| `getWoPostponementApprovalSteps` | 208 |
| `createWoPostponementApprovalStep` | 212 |
| `updateWoPostponementApprovalStep` | 216 |
| `getLatestAwaitingPostponement` | 220 |
| `finalizePostponementApproval` | 225 |
| `verifyApproverForLevel` | 229 |
| `createAuditLog` | 235 |
| `getAuditLogsByEntity` | 239 |
| `getStorage` | 245 |

### `server/modules/work-orders/services/anomalyDetectionService.ts`

| Exported symbol | Source line |
|---|---:|
| `detectAndLogAnomalies` | 42 |

### `server/modules/work-orders/services/complianceAnomalyService.ts`

| Exported symbol | Source line |
|---|---:|
| `invalidateComplianceCache` | 73 |
| `getComplianceAnomalies` | 90 |

### `server/modules/work-orders/services/executionService.ts`

| Exported symbol | Source line |
|---|---:|
| `getExecutions` | 7 |
| `getExecution` | 11 |
| `createExecution` | 19 |
| `updateExecution` | 48 |

### `server/modules/work-orders/services/superintendentNotificationService.ts`

| Exported symbol | Source line |
|---|---:|
| `notificationMatchesVesselScope` | 44 |
| `classifySuperintendentNotifications` | 76 |
| `listSuperintendentNotifications` | 133 |
| `listAllActiveSuperintendentNotifications` | 141 |
| `getSuperintendentNotificationSummary` | 156 |

### `server/modules/work-orders/services/woDocumentService.ts`

| Exported symbol | Source line |
|---|---:|
| `listDocuments` | 123 |
| `uploadDocument` | 127 |
| `downloadDocument` | 233 |
| `deleteDocument` | 255 |
| `linkDocumentsToExecution` | 275 |

### `server/modules/work-orders/services/workOrderAutoService.ts`

| Exported symbol | Source line |
|---|---:|
| `autoGenerate` | 9 |
| `backfillJobIds` | 256 |
| `recalculateStatuses` | 318 |
| `checkPostponements` | 325 |

### `server/modules/work-orders/services/workOrderBulkService.ts`

| Exported symbol | Source line |
|---|---:|
| `bulkApprove` | 16 |
| `reviewerApprove` | 241 |
| `reviewerReopen` | 372 |
| `bulkReject` | 434 |

### `server/modules/work-orders/services/workOrderCompletionService.ts`

| Exported symbol | Source line |
|---|---:|
| `completeWorkOrder` | 35 |
| `finalizeWorkOrderCompletion` | 966 |

### `server/modules/work-orders/services/workOrderContextService.ts`

| Exported symbol | Source line |
|---|---:|
| `getWorkOrderContext` | 54 |

### `server/modules/work-orders/services/workOrderGenerationGate.ts`

| Exported symbol | Source line |
|---|---:|
| `resolveGateRole` | 60 |
| `isOfficeWoGenerationEnabled` | 71 |
| `isOfficeRhEntryEnabled` | 96 |
| `evaluateDirectGeneration` | 114 |

### `server/modules/work-orders/services/workOrderPlannerService.ts`

| Exported symbol | Source line |
|---|---:|
| `getWorkOrderPlannerData` | 61 |
| `savePlannedDate` | 301 |
| `bulkSavePlannedDate` | 357 |
| `exportPlannerExcel` | 435 |
| `exportPlannerExcelFromItems` | 467 |

### `server/modules/work-orders/services/workOrderReconcilerService.ts`

| Exported symbol | Source line |
|---|---:|
| `getLastRunSummary` | 90 |
| `reconcileVessel` | 193 |
| `reconcileAllProvisionedVessels` | 240 |

### `server/modules/work-orders/services/workOrderService.ts`

| Exported symbol | Source line |
|---|---:|
| `buildApprovedRhJobUpdates` | 41 |
| `persistApprovedRhJobCycle` | 96 |
| `applyAssignmentSync` | 157 |
| `isSuperintendentLockEnabled` | 231 |
| `calculateApprovalTier` | 242 |
| `createSuperintendentNotificationForWO` | 306 |
| `listWorkOrders` | 336 |
| `getWorkOrdersWithComputedStatus` | 619 |
| `getOverdueVesselWorkOrdersForAlerts` | 634 |
| `listWorkOrdersPaged` | 680 |
| `getRejectionHistory` | 711 |
| `getWorkOrder` | 765 |
| `createWorkOrder` | 874 |
| `updateWorkOrder` | 1110 |
| `deleteWorkOrder` | 2831 |
| `saveOverdueReason` | 2845 |
| `getScopedOperationData` | 2903 |
| `rejectCompletedWorkOrder` | 3002 |
| `submitPostponeRequest` | 3186 |
| `editPostponeRequest` | 3267 |
| `approvePostponement` | 3276 |
| `rejectPostponement` | 3393 |
| `submitRePostponeRequest` | 3669 |
| `editRePostponeRequest` | 3696 |
| `approveRePostponement` | 3721 |
| `rejectRePostponement` | 3833 |
| `reopenCompletedWorkOrder` | 3929 |

### `server/modules/work-orders/utils/approvalTransition.ts`

| Exported symbol | Source line |
|---|---:|
| `classifyApprovalTransition` | 1 |

### `server/modules/work-orders/utils/completedWorkOrderDate.ts`

| Exported symbol | Source line |
|---|---:|
| `isCompletedWorkOrderStatus` | 16 |
| `isValidCompletedWorkOrderDate` | 80 |
| `getJobCompletionDate` | 105 |
| `resolveFinalCompletionDate` | 140 |
| `ensureCompletedWorkOrderDate` | 154 |

### `server/modules/work-orders/utils/skippedCycleBackfill.ts`

| Exported symbol | Source line |
|---|---:|
| `createSkippedCycleRecords` | 8 |
| `createSkippedCycleRecordsRH` | 106 |

### `server/modules/work-orders/utils/spareConsumptionDelta.ts`

| Exported symbol | Source line |
|---|---:|
| `makeCompositeKey` | 22 |
| `computeSpareConsumptionDelta` | 26 |

### `server/modules/work-orders/utils/updateActorIdentity.ts`

| Exported symbol | Source line |
|---|---:|
| `enrichWorkOrderUpdateWithActor` | 8 |

### `server/modules/work-orders/utils/workOrderListHydration.ts`

| Exported symbol | Source line |
|---|---:|
| `buildHydrationJobIndexes` | 24 |
| `resolveWorkOrderHydrationJob` | 56 |

### `server/modules/work-orders/utils/workOrderPartADates.ts`

| Exported symbol | Source line |
|---|---:|
| `buildRunningHoursWorkOrderSnapshots` | 28 |
| `findAttemptedWorkOrderSnapshotFields` | 62 |
| `isImmutableWorkOrderSnapshotField` | 84 |
| `shouldApplySyncedWorkOrderSnapshot` | 95 |
| `normalizePartARunningHours` | 142 |
| `normalizePartADateForInput` | 154 |
| `resolveWorkOrderPartADates` | 185 |
| `getWorkOrderListDueHour` | 222 |

### `server/services/chatbotService.ts`

| Exported symbol | Source line |
|---|---:|
| `executeTool` | 815 |
| `processChatMessage` | 2883 |

### `server/services/componentService.ts`

| Exported symbol | Source line |
|---|---:|
| `ComponentService` | 10 |

### `server/services/fileBasedImportHistory.ts`

| Exported symbol | Source line |
|---|---:|
| `saveImportHistory` | 33 |
| `getImportHistoryList` | 61 |
| `getImportHistoryById` | 103 |
| `updateImportHistory` | 116 |
| `deleteImportHistory` | 131 |

### `server/services/jobDueScanner.ts`

| Exported symbol | Source line |
|---|---:|
| `JobDueScannerService` | 105 |

### `server/services/jobService.ts`

| Exported symbol | Source line |
|---|---:|
| `JobService` | 12 |

### `server/services/maintenanceOrchestrator.ts`

| Exported symbol | Source line |
|---|---:|
| `MaintenanceOrchestrator` | 48 |

### `server/services/rhDueDateService.ts`

| Exported symbol | Source line |
|---|---:|
| `isCurrentRhEstimateBasis` | 23 |
| `rhEstimateBasis` | 27 |
| `calculateHistoricalRhAverage` | 103 |
| `resolveAuthoritativeRhComponent` | 121 |
| `estimateRhDueDate` | 150 |
| `effectiveDueDate` | 189 |

### `server/services/runningHoursService.ts`

| Exported symbol | Source line |
|---|---:|
| `RunningHoursService` | 10 |

### `server/services/schedulerRoleWatchdog.ts`

| Exported symbol | Source line |
|---|---:|
| `SchedulerRoleWatchdog` | 35 |

### `server/services/workOrderService.ts`

| Exported symbol | Source line |
|---|---:|
| `WorkOrderService` | 74 |

### `server/services/workOrderStatusRecalculator.ts`

| Exported symbol | Source line |
|---|---:|
| `WorkOrderStatusRecalculatorService` | 24 |

### `shared/dateUtils.ts`

| Exported symbol | Source line |
|---|---:|
| `formatWorkOrderDateDDMMYYYY` | 28 |
| `workOrderDateInputValue` | 65 |
| `parseWorkOrderDateDDMMYYYYInput` | 74 |
| `normalizeWorkOrderDateTyping` | 88 |
| `workOrderOverdueCompletionMessage` | 95 |
| `normalizeDateToDDMMMYYYY` | 108 |
| `calculateNextDueDate` | 197 |
| `calculateMissedCycles` | 258 |
| `shouldGenerateWorkOrder` | 308 |
| `formatLocalDateTimeDDMMMYYYY` | 354 |
| `formatRelativeTime` | 359 |
| `calculateMissedCyclesRH` | 379 |
| `formatRHWithSeparators` | 398 |

### `shared/schemaHelpers.ts`

| Exported symbol | Source line |
|---|---:|
| `updatedAtColumn` | 18 |
| `updatedAtColumnTz` | 30 |

### `shared/syncConfig.ts`

| Exported symbol | Source line |
|---|---:|
| `getTablesByCategory` | 1633 |
| `getTableSyncConfig` | 1638 |
| `requiresFieldLogging` | 1643 |
| `getIdentityColumn` | 1649 |
| `getConfigurableTables` | 1654 |
| `getProvisioningTables` | 1659 |
| `getTablesWithBusinessRules` | 1664 |
| `getSyncPhaseOrder` | 1669 |

### `shared/workOrders/dateParse.ts`

| Exported symbol | Source line |
|---|---:|
| `parseWorkOrderDate` | 41 |
| `normalizeWorkOrderCalendarDate` | 85 |
| `formatWorkOrderCalendarDate` | 97 |
| `addWorkOrderCalendarDays` | 104 |
| `currentWorkOrderCalendarDate` | 119 |

### `shared/workOrders/jobCycleCalc.ts`

| Exported symbol | Source line |
|---|---:|
| `preserveNewerJobRhState` | 62 |
| `computeJobCycleUpdates` | 109 |

### `shared/workOrders/pointInTimeStatus.ts`

| Exported symbol | Source line |
|---|---:|
| `findActivePostponementAt` | 65 |
| `computePointInTimeStatus` | 116 |
| `getWorkOrderBucketMonth` | 173 |
| `computedStatusToPIT` | 185 |

### `shared/workOrders/status.ts`

| Exported symbol | Source line |
|---|---:|
| `buildCompanyGraceConfig` | 51 |
| `calculateCompanyStandardGraceEnd` | 144 |
| `computeRHStatusCategory` | 180 |
| `rhCategoryToDisplayStatus` | 209 |
| `computeWorkOrderStatus` | 226 |

### `shared/workOrders/woCompletionRhRequirement.ts`

| Exported symbol | Source line |
|---|---:|
| `requiresWoCompletionRh` | 3 |

### `shared/workOrders/workOrderB2Validation.ts`

| Exported symbol | Source line |
|---|---:|
| `normalizeWorkOrderB2Date` | 32 |
| `validateWorkOrderB2Baselines` | 61 |
| `getWorkOrderB2PatchValidationScope` | 102 |

---

**End of document.** This file is a technical source reference; unresolved runtime questions remain explicitly marked Requires Verification.
