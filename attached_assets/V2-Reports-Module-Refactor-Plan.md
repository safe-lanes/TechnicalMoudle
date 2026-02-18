# V2 Modular Architecture Plan — Reports Module

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) Reports module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: All Report-specific entities — Maintenance Reports, Spares & Stores Reports, Stores-Specific Reports, Compliance & Regulatory Reports, Operations & Utilization Reports, Change Request Reports, Report Snapshots, and the Generic Report Type Router.

**Critical Constraint**: The V2 architecture must use 100% the same business rules, validations, calculations, and workflows as legacy. This initiative is purely an architectural re-organization, not a functional rewrite.

**Companion Document**: This plan follows the exact same conventions established in `V2-Fleet-Module-Refactor-Plan.md` (Fleet Module V2) and `V2-Component-Module-Refactor-Plan.md` (Component Module V2). All plans share identical layer rules, toggle mechanism, and enforcement policies.

---

## Canonical V2 API Prefix

All V2 reports endpoints use these canonical base paths:

```
/technical/api/v2/reports/maintenance           ← Maintenance Reports (due, overdue, completed, unplanned, postponement, monthly summary)
/technical/api/v2/reports/spares                ← Spares Reports (critical, low-stock, consumption)
/technical/api/v2/reports/stores                ← Stores Reports (consumption, inventory, chemicals-expiry, low-stock, combined)
/technical/api/v2/reports/compliance            ← Compliance & Regulatory Reports (critical equipment, IHM, RH anomaly)
/technical/api/v2/reports/operations            ← Operations & Utilization Reports (crew workload, equipment utilization)
/technical/api/v2/reports/change-requests       ← Change Request Reports (status tracking)
/technical/api/v2/reports/snapshots             ← Report Snapshots (per vessel, detail)
/technical/api/v2/reports/:reportType           ← Generic Report Type Router
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/reports/` — module name
- `/{sub-domain}` — report sub-domain (e.g., maintenance, spares, stores, compliance, operations)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [V2 Folder Structure](#2-v2-folder-structure)
3. [Layer Mapping: Current → V2](#3-layer-mapping-current--v2)
4. [Repository Layer Rules](#4-repository-layer-rules)
5. [Service Layer Rules](#5-service-layer-rules)
6. [Controller Layer Rules](#6-controller-layer-rules)
7. [RESTful Route Patterns](#7-restful-route-patterns)
8. [Frontend API Layer Rules](#8-frontend-api-layer-rules)
9. [Toggle Mechanism](#9-toggle-mechanism)
10. [Critical Enforcement Rules](#10-critical-enforcement-rules)
11. [Phased Migration Plan](#11-phased-migration-plan)
12. [Toggle-Based Flow Diagram](#12-toggle-based-flow-diagram)
13. [Risk Points & Rollback Strategy](#13-risk-points--rollback-strategy)
14. [Validation Checklist](#14-validation-checklist)

---

## 1. Current State Analysis

### 1.1 Backend File Sizes & Responsibility Mapping

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `server/routes.ts` | 20,231 | ALL route handlers including 38 report routes scattered across the file | Monolithic — report routes mixed with every other module |
| `server/postgresStorage.ts` | 7,111+ | ALL database queries — reports use cross-module storage methods | Reports don't have dedicated storage methods; they call `getSpares()`, `getJobs()`, `getComponents()`, `getWorkOrders()` and aggregate inline |
| `server/storage.ts` | 933 | Storage interface definition | No report-specific methods — reports consume other modules' methods |
| `shared/schema.ts` | 2,825 | ALL Drizzle schema definitions | 1 report-specific table (`report_snapshots` at L2801) |
| `client/src/pages/reports/ReportsModule.tsx` | 350 | Main reports landing/navigation page | Inline API calls via `useQuery`, no API abstraction layer |
| `client/src/pages/reports/MaintenanceReports.tsx` | 1,595 | Maintenance report views | Inline API calls, complex data aggregation in frontend |
| `client/src/pages/reports/MaintenancePlanner.tsx` | 964 | Maintenance planning view | Inline API calls |
| `client/src/pages/reports/SparesReports.tsx` | 669 | Spares reports views | Inline API calls |
| `client/src/pages/reports/CriticalSparesReport.tsx` | 552 | Critical spares report | Inline API calls |
| `client/src/pages/reports/SparesConsumptionPatternReport.tsx` | 772 | Spares consumption patterns | Inline API calls |
| `client/src/pages/reports/ConsumptionPatternReport.tsx` | 832 | Combined consumption pattern | Inline API calls |
| `client/src/pages/reports/StoresReports.tsx` | 796 | Stores reports views | Inline API calls |
| `client/src/pages/reports/StoresInventoryStatusReport.tsx` | 934 | Stores inventory status | Inline API calls |
| `client/src/pages/reports/LowStockAlertReport.tsx` | 1,061 | Low stock alert management | Inline API calls, includes mutation (mark ordered) |
| `client/src/pages/reports/ChemicalsExpiryReport.tsx` | 831 | Chemicals expiry tracking | Inline API calls |
| `client/src/pages/reports/ComplianceReports.tsx` | 602 | Compliance reports | Inline API calls |
| `client/src/pages/reports/RunningHoursReports.tsx` | 617 | Running hours reports | Inline API calls |
| `client/src/pages/reports/IhmReports.tsx` | 446 | IHM report views | Inline API calls |
| `client/src/pages/reports/IhmInventoryStatusReport.tsx` | 532 | IHM inventory detail | Inline API calls |
| `client/src/pages/reports/AlertsApprovalsAdminReports.tsx` | 572 | Alerts and approvals | Inline API calls |
| `client/src/pages/reports/ChangeRequestReports.tsx` | 635 | Change request reports | Inline API calls |

### 1.2 Report Route Inventory (Legacy)

#### 1.2.1 Maintenance Reports — routes.ts (8 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 5393 | GET | `/reports/unplanned-breakdown-jobs` | Get unplanned breakdown jobs data | `storage.getWorkOrders()`, `storage.getJobs()`, `storage.getComponents()` — inline aggregation |
| 5534 | POST | `/reports/unplanned-breakdown-jobs/excel` | Export unplanned breakdown jobs Excel | Same as above + ExcelJS generation |
| 15094 | POST | `/reports/due-jobs-7-days` | Generate due jobs report (7-day window) | `storage.getWorkOrders()`, `storage.getJobs()` — date-window filtering |
| 15484 | POST | `/reports/overdue-jobs` | Generate overdue jobs report | `storage.getWorkOrders()`, `storage.getJobs()` — overdue status filtering |
| 15834 | POST | `/reports/completed-jobs` | Generate completed jobs report | `storage.getWorkOrders()` — completed status filtering |
| 16193 | POST | `/reports/unplanned-jobs` | Generate unplanned jobs report | `storage.getWorkOrders()` — unplanned type filtering |
| 16374 | POST | `/reports/postponement-log` | Generate postponement log report | `storage.getWorkOrders()`, postponement data — date range filtering |
| 16757 | POST | `/reports/maintenance/monthly-summary/excel` | Generate maintenance monthly summary Excel | Multiple storage calls — complex cross-module aggregation |

#### 1.2.2 Spares & Stores Reports — routes.ts (12 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 4521 | GET | `/reports/critical-spares/preview` | Preview critical spares data | `storage.getSpares()` — critical flag filtering |
| 4745 | POST | `/reports/critical-spares` | Export critical spares Excel | Same as above + ExcelJS generation |
| 7360 | GET | `/reports/low-stock-alert/:vesselId` | Get low stock alert data | `storage.getSpares(vesselId)` — ROB < min filtering |
| 7448 | PATCH | `/reports/low-stock-alert/:vesselId/mark-ordered/:spareId` | Mark spare as ordered | `storage.updateSpare()` — last order date update |
| 7462 | POST | `/reports/low-stock-alert/:vesselId/excel` | Export low stock alert Excel | Same as GET + ExcelJS generation |
| 7608 | POST | `/reports/stores-inventory-status/:vesselId/excel` | Export stores inventory Excel | `storage.getStoresItems()` — full inventory export |
| 7865 | GET | `/reports/stores-consumption-analysis/:vesselId` | Get stores consumption data | `storage.getStoresLedger()` — consumption aggregation |
| 8208 | POST | `/reports/stores-consumption-analysis/:vesselId/excel` | Export stores consumption Excel | Same as above + ExcelJS generation |
| 8612 | GET | `/reports/spares-consumption-analysis/:vesselId` | Get spares consumption data | `storage.getSpareHistory()` — consumption pattern analysis |
| 8947 | POST | `/reports/spares-consumption-analysis/:vesselId/excel` | Export spares consumption Excel | Same as above + ExcelJS generation |
| 9339 | GET | `/reports/consumption-analysis/:vesselId` | Get combined consumption data | Combined spares + stores consumption |
| 9422 | POST | `/reports/consumption-analysis/:vesselId/excel` | Export combined consumption Excel | Same as above + ExcelJS generation |

#### 1.2.3 Stores-Specific Reports — routes.ts (3 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 10219 | GET | `/reports/chemicals-expiry/:vesselId` | Get chemicals expiry data | `storage.getStoresItems()` — expiry date filtering |
| 10319 | GET | `/reports/stores-low-stock-alert/:vesselId` | Get stores low stock alert data | `storage.getStoresItems()` — ROB < min filtering for stores |
| 10364 | POST | `/reports/stores-low-stock-alert/:vesselId/excel` | Export stores low stock alert Excel | Same as above + ExcelJS generation |

#### 1.2.4 Compliance & Regulatory Reports — routes.ts (6 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 5026 | GET | `/reports/critical-equipment-status` | Get critical equipment status data | `storage.getComponents()` — critical flag + status aggregation |
| 5164 | POST | `/reports/critical-equipment-status/excel` | Export critical equipment Excel | Same as above + ExcelJS generation |
| 19091 | GET | `/reports/ihm-inventory-status` | Get IHM inventory status data | `storage.getIhmStatusReport()` — IHM presence aggregation |
| 19298 | POST | `/reports/ihm-inventory-status/excel` | Export IHM inventory Excel | Same as above + ExcelJS generation |
| 18527 | GET | `/reports/running-hours-anomaly-detection` | Get RH anomaly data | `storage.getRunningHoursAudits()`, `storage.getComponents()` — anomaly detection |
| 18773 | POST | `/reports/running-hours-anomaly-detection/excel` | Export RH anomaly Excel | Same as above + ExcelJS generation |

#### 1.2.5 Operations & Utilization Reports — routes.ts (4 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 17427 | GET | `/reports/crew-workload-distribution` | Get crew workload data | `storage.getWorkOrders()`, `storage.getJobs()` — assignee aggregation |
| 17635 | POST | `/reports/crew-workload-distribution/excel` | Export crew workload Excel | Same as above + ExcelJS generation |
| 17973 | GET | `/reports/equipment-utilization-summary` | Get equipment utilization data | `storage.getComponents()`, `storage.getWorkOrders()` — utilization rate calculation |
| 18201 | POST | `/reports/equipment-utilization-summary/excel` | Export equipment utilization Excel | Same as above + ExcelJS generation |

#### 1.2.6 Change Request Reports — routes.ts (2 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 10906 | GET | `/reports/change-requests-status-tracking` | Get change request tracking data | `storage.getChangeRequests()` — status aggregation |
| 11073 | GET | `/reports/change-requests-status-tracking/export` | Export change request tracking Excel | Same as above + ExcelJS generation |

#### 1.2.7 Snapshots & Generic — routes.ts (3 handlers)

| Line | Method | Path | Purpose | Data Sources |
|------|--------|------|---------|-------------|
| 10460 | GET | `/reports/snapshots/:vesselId` | Get report snapshots for vessel | `report_snapshots` table — Drizzle query |
| 10478 | GET | `/reports/snapshots/detail/:snapshotId` | Get snapshot detail | `report_snapshots` table — single row query |
| 10792 | GET | `/reports/:reportType` | Generic report type router | Routes to specific report handlers by type |

**Total Legacy Report Routes: 38 route handlers** (all in routes.ts)

### 1.3 Storage Interface Methods (Report-Related)

**Critical Observation**: Unlike the Fleet module which has ~50+ dedicated storage methods, the Reports module has **NO dedicated report storage methods** in the `IStorage` interface. Reports consume cross-module storage methods and perform inline aggregation within route handlers.

**Cross-Module Storage Methods Used by Reports:**

| Module | Methods Used | Used By Report Sub-Domains |
|--------|-------------|---------------------------|
| Components | `getComponents(vesselId)`, `getComponent(id)` | Maintenance, Compliance, Operations |
| Jobs | `getJobs(vesselId)`, `getJob(id)` | Maintenance, Operations |
| Work Orders | `getWorkOrders(vesselId)`, `getWorkOrder(id)` | Maintenance, Operations |
| Spares | `getSpares(vesselId)`, `getAllSpares()`, `updateSpare(id, data)` | Spares & Stores |
| Spare History | `getSpareHistory(vesselId)`, `getSpareHistoryBySpareId(id)` | Spares Consumption |
| Stores Items | (inline queries to stores tables) | Stores Reports |
| Stores Ledger | (inline queries to stores ledger) | Stores Consumption |
| Change Requests | `getChangeRequests(filters)` | Change Request Reports |
| IHM | `getIhmStatusReport(vesselId)` | Compliance (IHM) |
| Running Hours | `getRunningHoursAudits(componentId)` | Compliance (RH Anomaly) |

**Report-Specific Storage (Snapshots Only):**

| Method | Returns | Used By |
|--------|---------|---------|
| Direct Drizzle query on `reportSnapshots` table | `ReportSnapshot[]` | routes.ts L10460 (snapshots by vessel) |
| Direct Drizzle query on `reportSnapshots` table | `ReportSnapshot \| undefined` | routes.ts L10478 (snapshot detail) |

### 1.4 Current Schema (Report Tables)

From `shared/schema.ts`:

**`report_snapshots` Table (L2801):** 8 columns
- Core: `id` (integer PK, auto-gen)
- Context: `vesselId` (text, NOT NULL), `reportType` (text, NOT NULL), `exportFormat` (text, NOT NULL)
- Metadata: `generatedAt` (timestamp, default NOW), `generatedBy` (text)
- Data: `itemCount` (integer, default 0), `filtersApplied` (jsonb), `summaryData` (jsonb, NOT NULL), `itemsData` (jsonb, NOT NULL)
- Indexes: `vesselId`, `reportType`, `generatedAt`

### 1.5 Key Business Logic in Route Handlers

The Reports module has **significant inline business logic** compared to simple CRUD modules. All report routes follow a pattern of multi-source data fetching, in-memory aggregation, and formatting. These important patterns exist:

**Vessel Context & "All Vessels" Aggregation:**
1. All reports accept `vesselId` via query params or request body
2. Many reports support `vesselId = "all"` for cross-vessel aggregate views
3. When "all", routes iterate over all vessels and merge results

**Excel Export Pattern (used by 19 of 38 handlers):**
1. GET endpoint returns JSON data for preview
2. POST endpoint generates Excel file using ExcelJS
3. Uses shared Excel styling utilities from `server/lib/excelReportStyles.ts`
4. Returns binary buffer with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Maintenance Report Status Logic (routes.ts L15094–L16757):**
1. Due Jobs (7-day window): Filters work orders where `nextDueDate` is within 7 days from now
2. Overdue Jobs: Filters work orders where `nextDueDate` is past and status is not completed
3. Completed Jobs: Filters work orders with `status = 'Completed'` within date range
4. Unplanned Jobs: Filters work orders with `maintenanceBasis = 'Unplanned'`
5. Postponement Log: Joins work orders with postponement records within date range

**Low Stock Alert Mark-Ordered Mutation (routes.ts L7448):**
1. Updates spare's `lastOrderDate` to current date
2. This is the only mutation (write) operation in the Reports module
3. Preserves all other spare fields unchanged

**Consumption Analysis Aggregation (routes.ts L7865–L9422):**
1. Fetches stores ledger / spare history entries within date range
2. Groups by item name/code
3. Calculates total consumed, average monthly consumption, and trend indicators
4. Returns sorted by consumption volume

**Running Hours Anomaly Detection (routes.ts L18527–L18773):**
1. Fetches all RH audit entries for components
2. Detects anomalies: sudden spikes, gaps in recording, negative deltas
3. Flags components with irregular patterns

**Critical Equipment Status (routes.ts L5026–L5164):**
1. Fetches components with `critical = true`
2. Joins with latest work order status
3. Aggregates: total critical, with overdue maintenance, with upcoming maintenance

### 1.6 Frontend API Consumption (Current)

**ReportsModule.tsx (350 lines)** — Main landing page:
| Query Key | Purpose |
|-----------|---------|
| Various navigation state | Routes to sub-report pages |

**MaintenanceReports.tsx (1,595 lines)** — Maintenance reports:
| Query Key | Purpose |
|-----------|---------|
| POST `/reports/due-jobs-7-days` | Fetch due jobs report data |
| POST `/reports/overdue-jobs` | Fetch overdue jobs report data |
| POST `/reports/completed-jobs` | Fetch completed jobs report data |
| POST `/reports/unplanned-jobs` | Fetch unplanned jobs report data |
| POST `/reports/postponement-log` | Fetch postponement log data |
| POST `/reports/maintenance/monthly-summary/excel` | Download monthly summary Excel |

**CriticalSparesReport.tsx (552 lines)** — Critical spares:
| Query Key | Purpose |
|-----------|---------|
| GET `/reports/critical-spares/preview` | Preview critical spares |
| POST `/reports/critical-spares` | Export critical spares Excel |

**LowStockAlertReport.tsx (1,061 lines)** — Low stock management:
| Query Key | Purpose |
|-----------|---------|
| GET `/reports/low-stock-alert/:vesselId` | Fetch low stock data |
| PATCH `/reports/low-stock-alert/:vesselId/mark-ordered/:spareId` | Mark spare as ordered |
| POST `/reports/low-stock-alert/:vesselId/excel` | Export low stock Excel |

**ComplianceReports.tsx (602 lines)** — Compliance:
| Query Key | Purpose |
|-----------|---------|
| GET `/reports/critical-equipment-status` | Fetch critical equipment data |
| POST `/reports/critical-equipment-status/excel` | Export critical equipment Excel |

**ChangeRequestReports.tsx (635 lines)** — Change requests:
| Query Key | Purpose |
|-----------|---------|
| GET `/reports/change-requests-status-tracking` | Fetch change request tracking |
| GET `/reports/change-requests-status-tracking/export` | Export change request Excel |

**Pattern**: No API abstraction layer. All `useQuery` calls use inline `queryKey` arrays with direct URL strings. `apiRequest()` helper used for mutations and POST exports.

---

## 2. V2 Folder Structure

### 2.1 Backend (Reports Module)

```
server/v2/
└── reports/
    ├── index.ts                              ← Module entry: exports all report sub-routers
    ├── routes.ts                             ← Express router combining all report sub-domain routes
    ├── errors.ts                             ← Shared error types (NotFoundError, ValidationError)
    ├── controllers/
    │   ├── index.ts                          ← Re-exports all controllers
    │   ├── maintenanceReportController.ts    ← HTTP handlers for maintenance reports (due, overdue, completed, unplanned, postponement, monthly summary, breakdown)
    │   ├── sparesReportController.ts         ← HTTP handlers for spares reports (critical, low-stock, consumption)
    │   ├── storesReportController.ts         ← HTTP handlers for stores reports (consumption, inventory, chemicals-expiry, low-stock, combined)
    │   ├── complianceReportController.ts     ← HTTP handlers for compliance reports (critical equipment, IHM, RH anomaly)
    │   ├── operationsReportController.ts     ← HTTP handlers for operations reports (crew workload, equipment utilization)
    │   ├── changeRequestReportController.ts  ← HTTP handlers for change request reports (status tracking)
    │   └── snapshotController.ts             ← HTTP handlers for report snapshots
    ├── services/
    │   ├── index.ts                          ← Re-exports all services
    │   ├── maintenanceReportService.ts       ← Business logic: work order status filtering, date-window calculations, aggregation
    │   ├── sparesReportService.ts            ← Business logic: critical spare filtering, low-stock detection, mark-ordered mutation
    │   ├── storesReportService.ts            ← Business logic: stores consumption aggregation, inventory status, chemicals expiry
    │   ├── complianceReportService.ts        ← Business logic: critical equipment status, IHM inventory, RH anomaly detection
    │   ├── operationsReportService.ts        ← Business logic: crew workload distribution, equipment utilization rates
    │   ├── changeRequestReportService.ts     ← Business logic: change request status aggregation
    │   ├── snapshotService.ts                ← Business logic: snapshot retrieval and filtering
    │   └── excelExportService.ts             ← Shared Excel generation utility (wraps ExcelJS + excelReportStyles)
    └── repositories/
        ├── index.ts                          ← Re-exports all repositories
        ├── maintenanceReportRepository.ts    ← Database access: wraps storage.getWorkOrders(), storage.getJobs(), storage.getComponents()
        ├── sparesReportRepository.ts         ← Database access: wraps storage.getSpares(), storage.getSpareHistory(), storage.updateSpare()
        ├── storesReportRepository.ts         ← Database access: wraps stores table queries
        ├── complianceReportRepository.ts     ← Database access: wraps storage.getComponents(), storage.getIhmStatusReport(), storage.getRunningHoursAudits()
        ├── operationsReportRepository.ts     ← Database access: wraps storage.getWorkOrders(), storage.getJobs(), storage.getComponents()
        ├── changeRequestReportRepository.ts  ← Database access: wraps storage.getChangeRequests()
        └── snapshotRepository.ts             ← Database access: wraps report_snapshots Drizzle queries
```

### 2.2 Shared Schema & Types

```
shared/v2/
└── reports/
    ├── schema.ts                             ← Re-exports report_snapshots schema from shared/schema.ts (no duplication)
    └── types.ts                              ← V2-specific request/response types, Zod schemas for report filters
```

### 2.3 Frontend (Reports Module)

```
client/src/modules/
└── reports/
    ├── api/
    │   ├── maintenanceReportApi.ts            ← V2 API functions for maintenance reports
    │   ├── sparesReportApi.ts                 ← V2 API functions for spares reports
    │   ├── storesReportApi.ts                 ← V2 API functions for stores reports
    │   ├── complianceReportApi.ts             ← V2 API functions for compliance reports
    │   ├── operationsReportApi.ts             ← V2 API functions for operations reports
    │   └── changeRequestReportApi.ts          ← V2 API functions for change request reports
    ├── hooks/
    │   └── useReportApi.ts                    ← V2 toggle-aware hook that switches between legacy and V2 API functions
    └── components/
        └── ReportApiToggle.tsx                ← Toggle UI component (V2 / Legacy switch)
```

### 2.4 Mapping: Current File → V2 Target Layer

| Current Location | Lines | V2 Target | V2 File |
|------------------|-------|-----------|---------|
| `routes.ts` L5393-5530 (GET unplanned breakdown) | ~138 | Controller + Service (aggregation) | `maintenanceReportController.ts` + `maintenanceReportService.ts` |
| `routes.ts` L5534-5600 (POST unplanned breakdown Excel) | ~67 | Controller + Service (Excel) | `maintenanceReportController.ts` + `excelExportService.ts` |
| `routes.ts` L15094-15480 (POST due-jobs-7-days) | ~387 | Controller + Service (date-window filtering) | `maintenanceReportController.ts` + `maintenanceReportService.ts` |
| `routes.ts` L15484-15830 (POST overdue-jobs) | ~347 | Controller + Service (overdue filtering) | `maintenanceReportController.ts` + `maintenanceReportService.ts` |
| `routes.ts` L15834-16190 (POST completed-jobs) | ~357 | Controller + Service (completed filtering) | `maintenanceReportController.ts` + `maintenanceReportService.ts` |
| `routes.ts` L16193-16370 (POST unplanned-jobs) | ~178 | Controller + Service (unplanned filtering) | `maintenanceReportController.ts` + `maintenanceReportService.ts` |
| `routes.ts` L16374-16753 (POST postponement-log) | ~380 | Controller + Service (postponement aggregation) | `maintenanceReportController.ts` + `maintenanceReportService.ts` |
| `routes.ts` L16757-16900+ (POST monthly summary Excel) | ~150+ | Controller + Service (monthly aggregation) | `maintenanceReportController.ts` + `excelExportService.ts` |
| `routes.ts` L4521-4741 (GET critical spares preview) | ~221 | Controller + Service (critical filtering) | `sparesReportController.ts` + `sparesReportService.ts` |
| `routes.ts` L4745-5022 (POST critical spares Excel) | ~278 | Controller + Service (Excel) | `sparesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L7360-7444 (GET low stock alert) | ~85 | Controller + Service (low-stock detection) | `sparesReportController.ts` + `sparesReportService.ts` |
| `routes.ts` L7448-7458 (PATCH mark ordered) | ~11 | Controller + Service (mutation) | `sparesReportController.ts` + `sparesReportService.ts` |
| `routes.ts` L7462-7604 (POST low stock Excel) | ~143 | Controller + Service (Excel) | `sparesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L7608-7861 (POST stores inventory Excel) | ~254 | Controller + Service (Excel) | `storesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L7865-8204 (GET stores consumption) | ~340 | Controller + Service (aggregation) | `storesReportController.ts` + `storesReportService.ts` |
| `routes.ts` L8208-8608 (POST stores consumption Excel) | ~401 | Controller + Service (Excel) | `storesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L8612-8943 (GET spares consumption) | ~332 | Controller + Service (aggregation) | `sparesReportController.ts` + `sparesReportService.ts` |
| `routes.ts` L8947-9335 (POST spares consumption Excel) | ~389 | Controller + Service (Excel) | `sparesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L9339-9418 (GET combined consumption) | ~80 | Controller + Service (aggregation) | `storesReportController.ts` + `storesReportService.ts` |
| `routes.ts` L9422-9800+ (POST combined consumption Excel) | ~380+ | Controller + Service (Excel) | `storesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L10219-10315 (GET chemicals expiry) | ~97 | Controller + Service | `storesReportController.ts` + `storesReportService.ts` |
| `routes.ts` L10319-10360 (GET stores low stock) | ~42 | Controller + Service | `storesReportController.ts` + `storesReportService.ts` |
| `routes.ts` L10364-10456 (POST stores low stock Excel) | ~93 | Controller + Service (Excel) | `storesReportController.ts` + `excelExportService.ts` |
| `routes.ts` L5026-5160 (GET critical equipment status) | ~135 | Controller + Service (aggregation) | `complianceReportController.ts` + `complianceReportService.ts` |
| `routes.ts` L5164-5389 (POST critical equipment Excel) | ~226 | Controller + Service (Excel) | `complianceReportController.ts` + `excelExportService.ts` |
| `routes.ts` L19091-19294 (GET IHM inventory status) | ~204 | Controller + Service (aggregation) | `complianceReportController.ts` + `complianceReportService.ts` |
| `routes.ts` L19298-19500+ (POST IHM inventory Excel) | ~200+ | Controller + Service (Excel) | `complianceReportController.ts` + `excelExportService.ts` |
| `routes.ts` L18527-18769 (GET RH anomaly detection) | ~243 | Controller + Service (anomaly detection) | `complianceReportController.ts` + `complianceReportService.ts` |
| `routes.ts` L18773-19087 (POST RH anomaly Excel) | ~315 | Controller + Service (Excel) | `complianceReportController.ts` + `excelExportService.ts` |
| `routes.ts` L17427-17631 (GET crew workload) | ~205 | Controller + Service (aggregation) | `operationsReportController.ts` + `operationsReportService.ts` |
| `routes.ts` L17635-17969 (POST crew workload Excel) | ~335 | Controller + Service (Excel) | `operationsReportController.ts` + `excelExportService.ts` |
| `routes.ts` L17973-18197 (GET equipment utilization) | ~225 | Controller + Service (calculation) | `operationsReportController.ts` + `operationsReportService.ts` |
| `routes.ts` L18201-18523 (POST equipment utilization Excel) | ~323 | Controller + Service (Excel) | `operationsReportController.ts` + `excelExportService.ts` |
| `routes.ts` L10906-11069 (GET change request tracking) | ~164 | Controller + Service (aggregation) | `changeRequestReportController.ts` + `changeRequestReportService.ts` |
| `routes.ts` L11073-11200+ (GET change request export) | ~130+ | Controller + Service (Excel) | `changeRequestReportController.ts` + `excelExportService.ts` |
| `routes.ts` L10460-10474 (GET snapshots by vessel) | ~15 | Controller | `snapshotController.ts` |
| `routes.ts` L10478-10500 (GET snapshot detail) | ~23 | Controller | `snapshotController.ts` |
| `routes.ts` L10792-10902 (GET generic reportType) | ~111 | Controller (router) | `snapshotController.ts` |

---

## 3. Layer Mapping: Current → V2

### 3.1 How V2 Reuses Legacy Logic (Not Rewrites)

**Critical principle**: V2 layers call the **same storage methods** and perform the **same aggregation logic** that legacy route handlers do today. The key difference is that inline aggregation currently buried in 300+ line route handlers is extracted into service methods.

```
LEGACY FLOW (Reports):
  Request → routes.ts (HTTP + multi-source data fetch + aggregation + Excel generation) → Response

V2 FLOW (Reports):
  Request → routes.ts → Controller (HTTP only) → Service (aggregation + Excel) → Repository (storage calls) → Response
```

The **same `storage.*` methods** are called at the end of both flows. The **same aggregation logic** is preserved in the service layer.

### 3.2 Legacy Route → V2 Layer Decomposition

**Example: POST /reports/due-jobs-7-days (Due Jobs Report, lines 15094–15480)**

| Concern | Legacy Location | V2 Location |
|---------|-----------------|-------------|
| Extract `req.body.vesselId`, `req.body.dateFrom`, `req.body.dateTo` | Route handler | Controller |
| Fetch work orders via `storage.getWorkOrders(vesselId)` | Route L15120 | Repository |
| Fetch jobs via `storage.getJobs(vesselId)` | Route L15125 | Repository |
| Fetch components via `storage.getComponents(vesselId)` | Route L15130 | Repository |
| Filter work orders where nextDueDate within 7-day window | Route L15140-15200 | Service `getDueJobs()` |
| Join job details (title, type, interval) to work orders | Route L15200-15250 | Service |
| Join component details (name, code, critical flag) | Route L15250-15300 | Service |
| Format response with summary (total, by status, by priority) | Route L15300-15400 | Service |
| Generate Excel if POST body requests Excel format | Route L15400-15480 | Service + `excelExportService` |
| Error handling, status codes | Route handler | Controller |

**Example: GET /reports/critical-equipment-status (Critical Equipment, lines 5026–5160)**

| Concern | Legacy Location | V2 Location |
|---------|-----------------|-------------|
| Extract `req.query.vesselId` | Route handler | Controller |
| Fetch components with `critical = true` | Route L5040 | Repository |
| Fetch latest work orders for critical components | Route L5060 | Repository |
| Aggregate: total critical, overdue maintenance, upcoming | Route L5080-5130 | Service |
| Format response with status breakdown | Route L5130-5160 | Service |
| Error handling, status codes | Route handler | Controller |

---

## 4. Repository Layer Rules

### 4.1 Purpose

The repository is the **only layer** allowed to access the database. In V2, it wraps calls to the existing `storage` interface and any inline Drizzle queries currently in route handlers.

### 4.2 Rules

| Rule | Detail |
|------|--------|
| **Only layer with DB access** | Only file allowed to import `storage` or Drizzle ORM |
| **No business logic** | No aggregation, no filtering beyond what storage methods accept, no error interpretation |
| **Same data shape as legacy** | Returns exact same types that `storage.*` methods return today |
| **Stateless** | No caching, no state — pure pass-through to storage |
| **Cross-module access** | May call storage methods from other modules (getSpares, getJobs, etc.) since reports are read-only consumers |
| **Raw SQL exception** | Any raw SQL aggregation currently inline in routes is extracted here |

### 4.3 Repository Method Signatures

```typescript
// server/v2/reports/repositories/maintenanceReportRepository.ts

export class MaintenanceReportRepository {
  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    return storage.getWorkOrders(vesselId);
  }
  async getJobs(vesselId?: string): Promise<Job[]> {
    return storage.getJobs(vesselId);
  }
  async getComponents(vesselId: string): Promise<Component[]> {
    return storage.getComponents(vesselId);
  }
  async getWorkOrderPostponements(vesselId?: string): Promise<WorkOrderPostponement[]> {
    // Wraps the inline Drizzle query currently at routes.ts L16374+
    const db = getDb();
    return db.select().from(workOrderPostponements)
      .where(vesselId ? eq(workOrderPostponements.vesselId, vesselId) : undefined);
  }
}

// server/v2/reports/repositories/sparesReportRepository.ts

export class SparesReportRepository {
  async getSpares(vesselId?: string): Promise<Spare[]> {
    if (vesselId) return storage.getSpares(vesselId);
    return storage.getAllSpares();
  }
  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    return storage.getSpareHistory(vesselId);
  }
  async updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    return storage.updateSpare(id, data);
  }
}

// server/v2/reports/repositories/snapshotRepository.ts

export class SnapshotRepository {
  async findByVessel(vesselId: string): Promise<ReportSnapshot[]> {
    const db = getDb();
    return db.select().from(reportSnapshots)
      .where(eq(reportSnapshots.vesselId, vesselId))
      .orderBy(reportSnapshots.generatedAt);
  }
  async findById(id: number): Promise<ReportSnapshot | undefined> {
    const db = getDb();
    const results = await db.select().from(reportSnapshots)
      .where(eq(reportSnapshots.id, id));
    return results[0];
  }
}
```

---

## 5. Service Layer Rules

### 5.1 Purpose

The service layer contains **all business logic** — the exact same aggregation, filtering, and calculation logic currently inline in route handlers.

### 5.2 Rules

| Rule | Detail |
|------|--------|
| **All business logic lives here** | Data aggregation, filtering, date calculations, anomaly detection, consumption analysis |
| **No HTTP objects** | No `Request`, `Response`, or `NextFunction` imports |
| **No database access** | Calls repository only, never imports `storage` or Drizzle |
| **Same logic as legacy** | Identical filtering, aggregation, and calculation rules |
| **Returns plain objects** | Returns data or throws typed errors — controller decides HTTP status |
| **Excel generation** | Shared `excelExportService.ts` handles all Excel file creation, called by individual services |

### 5.3 Business Logic Migration Map

**Maintenance Report Service — Due Jobs Filtering:**
```typescript
// server/v2/reports/services/maintenanceReportService.ts

export class MaintenanceReportService {
  constructor(private repository: MaintenanceReportRepository) {}

  async getDueJobs(params: {
    vesselId: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<DueJobsReport> {
    const workOrders = await this.repository.getWorkOrders(params.vesselId);
    const jobs = await this.repository.getJobs(params.vesselId);
    const components = await this.repository.getComponents(params.vesselId);

    // Exact same filtering logic from routes.ts L15140-15200
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dueWorkOrders = workOrders.filter(wo => {
      if (!wo.nextDueDate) return false;
      const dueDate = new Date(wo.nextDueDate);
      return dueDate >= now && dueDate <= sevenDaysFromNow;
    });

    // Exact same join logic — enrich with job and component details
    const enrichedItems = dueWorkOrders.map(wo => {
      const job = jobs.find(j => j.id === wo.jobId);
      const component = components.find(c => c.id === wo.componentId);
      return { ...wo, job, component };
    });

    return {
      items: enrichedItems,
      summary: {
        total: enrichedItems.length,
        byPriority: this.groupByPriority(enrichedItems),
        byDepartment: this.groupByDepartment(enrichedItems),
      },
    };
  }

  async getOverdueJobs(params: { vesselId: string; dateFrom?: string; dateTo?: string }): Promise<OverdueJobsReport> {
    // Exact same logic from routes.ts L15484-15830 — overdue status filtering
  }

  async getCompletedJobs(params: { vesselId: string; dateFrom?: string; dateTo?: string }): Promise<CompletedJobsReport> {
    // Exact same logic from routes.ts L15834-16190 — completed status filtering
  }

  async getUnplannedJobs(params: { vesselId: string; dateFrom?: string; dateTo?: string }): Promise<UnplannedJobsReport> {
    // Exact same logic from routes.ts L16193-16370 — unplanned type filtering
  }

  async getPostponementLog(params: { vesselId: string; dateFrom?: string; dateTo?: string }): Promise<PostponementLogReport> {
    // Exact same logic from routes.ts L16374-16753 — postponement aggregation
  }

  async getUnplannedBreakdown(params: { vesselId: string }): Promise<UnplannedBreakdownReport> {
    // Exact same logic from routes.ts L5393-5530
  }
}
```

**Spares Report Service — Low Stock and Mark-Ordered:**
```typescript
// server/v2/reports/services/sparesReportService.ts

export class SparesReportService {
  constructor(private repository: SparesReportRepository) {}

  async getCriticalSpares(params: { vesselId?: string }): Promise<CriticalSparesReport> {
    const spares = await this.repository.getSpares(params.vesselId);
    // Exact same filtering from routes.ts L4521-4741 — critical flag filtering
    const criticalSpares = spares.filter(s =>
      s.critical === 'Critical' || s.critical === 'Yes'
    );
    return {
      items: criticalSpares,
      summary: { total: criticalSpares.length },
    };
  }

  async getLowStockAlert(vesselId: string): Promise<LowStockAlertReport> {
    const spares = await this.repository.getSpares(vesselId);
    // Exact same filtering from routes.ts L7360-7444 — ROB < min filtering
    const lowStockSpares = spares.filter(s => s.rob < s.min);
    return {
      items: lowStockSpares,
      summary: { total: lowStockSpares.length },
    };
  }

  async markSpareAsOrdered(vesselId: string, spareId: number): Promise<Spare> {
    // Exact same logic from routes.ts L7448 — update lastOrderDate
    return this.repository.updateSpare(spareId, {
      lastOrderDate: new Date().toISOString(),
    });
  }

  async getSparesConsumption(vesselId: string, dateFrom?: string, dateTo?: string): Promise<ConsumptionReport> {
    // Exact same aggregation from routes.ts L8612-8943
  }
}
```

**Compliance Report Service — RH Anomaly Detection:**
```typescript
// server/v2/reports/services/complianceReportService.ts

export class ComplianceReportService {
  constructor(private repository: ComplianceReportRepository) {}

  async getRunningHoursAnomalyDetection(params: { vesselId: string }): Promise<RHAnomalyReport> {
    // Exact same anomaly detection logic from routes.ts L18527-18769
    // Detects: sudden spikes, recording gaps, negative deltas
  }

  async getCriticalEquipmentStatus(params: { vesselId: string }): Promise<CriticalEquipmentReport> {
    // Exact same aggregation from routes.ts L5026-5160
  }

  async getIhmInventoryStatus(params: { vesselId: string }): Promise<IhmInventoryReport> {
    // Exact same aggregation from routes.ts L19091-19294
  }
}
```

### 5.4 Shared Excel Export Service

```typescript
// server/v2/reports/services/excelExportService.ts

import ExcelJS from 'exceljs';
import { COLORS, STATUS_COLORS, applyStandardHeader, applyStandardTableHeader,
         applyStandardDataRows, applyStandardSummary, applyStandardPageSetup,
         generateFilename } from '../../lib/excelReportStyles';

export class ExcelExportService {
  async generateReport(params: {
    reportType: string;
    title: string;
    columns: ColumnDef[];
    data: any[];
    summary?: SummaryItem[];
    vesselName?: string;
  }): Promise<Buffer> {
    // Wraps the shared ExcelJS generation pattern used by all 19 Excel export handlers
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(params.title);
    applyStandardPageSetup(worksheet);
    applyStandardHeader(worksheet, params.title, params.vesselName);
    applyStandardTableHeader(worksheet, params.columns);
    applyStandardDataRows(worksheet, params.columns, params.data);
    if (params.summary) {
      applyStandardSummary(worksheet, params.summary);
    }
    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }
}
```

### 5.5 Error Types

```typescript
// server/v2/reports/errors.ts (shared across all report services)
export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}
export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}
```

---

## 6. Controller Layer Rules

### 6.1 Rules

| Rule | Detail |
|------|--------|
| **HTTP concerns only** | Extract params, body, query; set status codes; return JSON or binary |
| **Schema validation only** | Use Zod schemas — must be permissive (match what legacy accepts) |
| **Calls services only** | No direct database or storage access |
| **No business logic** | No filtering, no aggregation, no date calculations |
| **Excel response handling** | Sets correct Content-Type and Content-Disposition headers for Excel downloads |
| **Error mapping** | Maps service errors to HTTP status codes (NotFoundError → 404, ValidationError → 400) |

### 6.2 Controller Examples

```typescript
// server/v2/reports/controllers/maintenanceReportController.ts

export class MaintenanceReportController {
  constructor(private service: MaintenanceReportService, private excelService: ExcelExportService) {}

  async getDueJobs(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId, dateFrom, dateTo } = req.body;
      const report = await this.service.getDueJobs({ vesselId, dateFrom, dateTo });
      res.json(report);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getDueJobsExcel(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId, dateFrom, dateTo } = req.body;
      const report = await this.service.getDueJobs({ vesselId, dateFrom, dateTo });
      const buffer = await this.excelService.generateReport({
        reportType: 'due-jobs',
        title: 'Due Jobs Report (7-Day Window)',
        columns: MAINTENANCE_REPORT_COLUMNS,
        data: report.items,
        summary: [{ label: 'Total Due', value: report.summary.total }],
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${generateFilename('due-jobs')}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  }
}

// server/v2/reports/controllers/sparesReportController.ts

export class SparesReportController {
  constructor(private service: SparesReportService, private excelService: ExcelExportService) {}

  async markOrdered(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId, spareId } = req.params;
      const spare = await this.service.markSpareAsOrdered(vesselId, parseInt(spareId));
      res.json(spare);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
```

---

## 7. RESTful Route Patterns

### 7.1 V2 Route Registration

```typescript
// server/v2/reports/routes.ts

import { Router } from 'express';

export function createReportsRouter(): Router {
  const router = Router();

  // --- Maintenance Reports ---
  router.post('/maintenance/due-jobs', maintenanceController.getDueJobs);
  router.post('/maintenance/overdue-jobs', maintenanceController.getOverdueJobs);
  router.post('/maintenance/completed-jobs', maintenanceController.getCompletedJobs);
  router.post('/maintenance/unplanned-jobs', maintenanceController.getUnplannedJobs);
  router.post('/maintenance/postponement-log', maintenanceController.getPostponementLog);
  router.post('/maintenance/monthly-summary/excel', maintenanceController.getMonthlySummaryExcel);
  router.get('/maintenance/unplanned-breakdown', maintenanceController.getUnplannedBreakdown);
  router.post('/maintenance/unplanned-breakdown/excel', maintenanceController.getUnplannedBreakdownExcel);

  // --- Spares Reports ---
  router.get('/spares/critical/preview', sparesController.getCriticalSparesPreview);
  router.post('/spares/critical/excel', sparesController.getCriticalSparesExcel);
  router.get('/spares/low-stock/:vesselId', sparesController.getLowStockAlert);
  router.patch('/spares/low-stock/:vesselId/mark-ordered/:spareId', sparesController.markOrdered);
  router.post('/spares/low-stock/:vesselId/excel', sparesController.getLowStockExcel);
  router.get('/spares/consumption/:vesselId', sparesController.getSparesConsumption);
  router.post('/spares/consumption/:vesselId/excel', sparesController.getSparesConsumptionExcel);

  // --- Stores Reports ---
  router.get('/stores/consumption/:vesselId', storesController.getStoresConsumption);
  router.post('/stores/consumption/:vesselId/excel', storesController.getStoresConsumptionExcel);
  router.post('/stores/inventory/:vesselId/excel', storesController.getStoresInventoryExcel);
  router.get('/stores/chemicals-expiry/:vesselId', storesController.getChemicalsExpiry);
  router.get('/stores/low-stock/:vesselId', storesController.getStoresLowStock);
  router.post('/stores/low-stock/:vesselId/excel', storesController.getStoresLowStockExcel);
  router.get('/stores/consumption-combined/:vesselId', storesController.getCombinedConsumption);
  router.post('/stores/consumption-combined/:vesselId/excel', storesController.getCombinedConsumptionExcel);

  // --- Compliance Reports ---
  router.get('/compliance/critical-equipment', complianceController.getCriticalEquipmentStatus);
  router.post('/compliance/critical-equipment/excel', complianceController.getCriticalEquipmentExcel);
  router.get('/compliance/ihm-inventory', complianceController.getIhmInventoryStatus);
  router.post('/compliance/ihm-inventory/excel', complianceController.getIhmInventoryExcel);
  router.get('/compliance/rh-anomaly', complianceController.getRhAnomalyDetection);
  router.post('/compliance/rh-anomaly/excel', complianceController.getRhAnomalyExcel);

  // --- Operations Reports ---
  router.get('/operations/crew-workload', operationsController.getCrewWorkload);
  router.post('/operations/crew-workload/excel', operationsController.getCrewWorkloadExcel);
  router.get('/operations/equipment-utilization', operationsController.getEquipmentUtilization);
  router.post('/operations/equipment-utilization/excel', operationsController.getEquipmentUtilizationExcel);

  // --- Change Request Reports ---
  router.get('/change-requests/status-tracking', changeRequestController.getStatusTracking);
  router.get('/change-requests/status-tracking/export', changeRequestController.getStatusTrackingExport);

  // --- Snapshots ---
  router.get('/snapshots/:vesselId', snapshotController.getByVessel);
  router.get('/snapshots/detail/:snapshotId', snapshotController.getDetail);

  // --- Generic Report Type Router ---
  router.get('/:reportType', snapshotController.getByReportType);

  return router;
}
```

### 7.2 Legacy → V2 Route Mapping

| Legacy Path | Method | V2 Path | Method |
|-------------|--------|---------|--------|
| `/reports/due-jobs-7-days` | POST | `/v2/reports/maintenance/due-jobs` | POST |
| `/reports/overdue-jobs` | POST | `/v2/reports/maintenance/overdue-jobs` | POST |
| `/reports/completed-jobs` | POST | `/v2/reports/maintenance/completed-jobs` | POST |
| `/reports/unplanned-jobs` | POST | `/v2/reports/maintenance/unplanned-jobs` | POST |
| `/reports/postponement-log` | POST | `/v2/reports/maintenance/postponement-log` | POST |
| `/reports/maintenance/monthly-summary/excel` | POST | `/v2/reports/maintenance/monthly-summary/excel` | POST |
| `/reports/unplanned-breakdown-jobs` | GET | `/v2/reports/maintenance/unplanned-breakdown` | GET |
| `/reports/unplanned-breakdown-jobs/excel` | POST | `/v2/reports/maintenance/unplanned-breakdown/excel` | POST |
| `/reports/critical-spares/preview` | GET | `/v2/reports/spares/critical/preview` | GET |
| `/reports/critical-spares` | POST | `/v2/reports/spares/critical/excel` | POST |
| `/reports/low-stock-alert/:vesselId` | GET | `/v2/reports/spares/low-stock/:vesselId` | GET |
| `/reports/low-stock-alert/:vesselId/mark-ordered/:spareId` | PATCH | `/v2/reports/spares/low-stock/:vesselId/mark-ordered/:spareId` | PATCH |
| `/reports/low-stock-alert/:vesselId/excel` | POST | `/v2/reports/spares/low-stock/:vesselId/excel` | POST |
| `/reports/spares-consumption-analysis/:vesselId` | GET | `/v2/reports/spares/consumption/:vesselId` | GET |
| `/reports/spares-consumption-analysis/:vesselId/excel` | POST | `/v2/reports/spares/consumption/:vesselId/excel` | POST |
| `/reports/stores-consumption-analysis/:vesselId` | GET | `/v2/reports/stores/consumption/:vesselId` | GET |
| `/reports/stores-consumption-analysis/:vesselId/excel` | POST | `/v2/reports/stores/consumption/:vesselId/excel` | POST |
| `/reports/stores-inventory-status/:vesselId/excel` | POST | `/v2/reports/stores/inventory/:vesselId/excel` | POST |
| `/reports/chemicals-expiry/:vesselId` | GET | `/v2/reports/stores/chemicals-expiry/:vesselId` | GET |
| `/reports/stores-low-stock-alert/:vesselId` | GET | `/v2/reports/stores/low-stock/:vesselId` | GET |
| `/reports/stores-low-stock-alert/:vesselId/excel` | POST | `/v2/reports/stores/low-stock/:vesselId/excel` | POST |
| `/reports/consumption-analysis/:vesselId` | GET | `/v2/reports/stores/consumption-combined/:vesselId` | GET |
| `/reports/consumption-analysis/:vesselId/excel` | POST | `/v2/reports/stores/consumption-combined/:vesselId/excel` | POST |
| `/reports/critical-equipment-status` | GET | `/v2/reports/compliance/critical-equipment` | GET |
| `/reports/critical-equipment-status/excel` | POST | `/v2/reports/compliance/critical-equipment/excel` | POST |
| `/reports/ihm-inventory-status` | GET | `/v2/reports/compliance/ihm-inventory` | GET |
| `/reports/ihm-inventory-status/excel` | POST | `/v2/reports/compliance/ihm-inventory/excel` | POST |
| `/reports/running-hours-anomaly-detection` | GET | `/v2/reports/compliance/rh-anomaly` | GET |
| `/reports/running-hours-anomaly-detection/excel` | POST | `/v2/reports/compliance/rh-anomaly/excel` | POST |
| `/reports/crew-workload-distribution` | GET | `/v2/reports/operations/crew-workload` | GET |
| `/reports/crew-workload-distribution/excel` | POST | `/v2/reports/operations/crew-workload/excel` | POST |
| `/reports/equipment-utilization-summary` | GET | `/v2/reports/operations/equipment-utilization` | GET |
| `/reports/equipment-utilization-summary/excel` | POST | `/v2/reports/operations/equipment-utilization/excel` | POST |
| `/reports/change-requests-status-tracking` | GET | `/v2/reports/change-requests/status-tracking` | GET |
| `/reports/change-requests-status-tracking/export` | GET | `/v2/reports/change-requests/status-tracking/export` | GET |
| `/reports/snapshots/:vesselId` | GET | `/v2/reports/snapshots/:vesselId` | GET |
| `/reports/snapshots/detail/:snapshotId` | GET | `/v2/reports/snapshots/detail/:snapshotId` | GET |
| `/reports/:reportType` | GET | `/v2/reports/:reportType` | GET |

---

## 8. Frontend API Layer Rules

### 8.1 V2 API Functions

Each frontend API file provides functions that construct the V2 API URL and handle request/response:

```typescript
// client/src/modules/reports/api/maintenanceReportApi.ts

const V2_BASE = '/technical/api/v2/reports/maintenance';

export const maintenanceReportApiV2 = {
  getDueJobs: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/due-jobs`, params),

  getOverdueJobs: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/overdue-jobs`, params),

  getCompletedJobs: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/completed-jobs`, params),

  getUnplannedJobs: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/unplanned-jobs`, params),

  getPostponementLog: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/postponement-log`, params),

  getMonthlySummaryExcel: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/monthly-summary/excel`, params, { responseType: 'blob' }),

  getUnplannedBreakdown: (vesselId: string) =>
    fetch(`${V2_BASE}/unplanned-breakdown?vesselId=${vesselId}`).then(r => r.json()),

  getUnplannedBreakdownExcel: (params: ReportParams) =>
    apiRequest('POST', `${V2_BASE}/unplanned-breakdown/excel`, params, { responseType: 'blob' }),
};
```

### 8.2 Toggle-Aware Hook

```typescript
// client/src/modules/reports/hooks/useReportApi.ts

export function useReportApi() {
  const isV2 = localStorage.getItem('reports_api_version') === 'v2';

  return {
    maintenance: isV2 ? maintenanceReportApiV2 : maintenanceReportApiLegacy,
    spares: isV2 ? sparesReportApiV2 : sparesReportApiLegacy,
    stores: isV2 ? storesReportApiV2 : storesReportApiLegacy,
    compliance: isV2 ? complianceReportApiV2 : complianceReportApiLegacy,
    operations: isV2 ? operationsReportApiV2 : operationsReportApiLegacy,
    changeRequests: isV2 ? changeRequestReportApiV2 : changeRequestReportApiLegacy,
  };
}
```

---

## 9. Toggle Mechanism

### 9.1 Toggle Key

```
localStorage key: reports_api_version
Values: "legacy" (default) | "v2"
```

### 9.2 Toggle Rules

| Rule | Detail |
|------|--------|
| **Default is Legacy** | Until explicitly toggled, all report pages use legacy API paths |
| **Per-browser** | Toggle state stored in localStorage — per user, per browser |
| **No data migration** | Toggle switches API path only — same underlying data |
| **Instant switch** | No page reload required — React state change triggers re-fetch |
| **Admin-only visibility** | Toggle UI visible only to PMS Admin role users |

### 9.3 Toggle UI Component

```typescript
// client/src/modules/reports/components/ReportApiToggle.tsx

export function ReportApiToggle() {
  const [version, setVersion] = useState(
    localStorage.getItem('reports_api_version') || 'legacy'
  );

  const toggle = () => {
    const next = version === 'legacy' ? 'v2' : 'legacy';
    localStorage.setItem('reports_api_version', next);
    setVersion(next);
  };

  return (
    <div>
      <span>Reports API: {version.toUpperCase()}</span>
      <Switch checked={version === 'v2'} onCheckedChange={toggle} />
    </div>
  );
}
```

---

## 10. Critical Enforcement Rules

### 10.1 Layer Isolation Rules

| Rule | Enforcement |
|------|------------|
| **Repository is the only DB layer** | Code review: no `storage` or Drizzle imports outside repository files |
| **Service has no HTTP objects** | Code review: no `Request`, `Response`, `NextFunction` imports in service files |
| **Controller has no business logic** | Code review: no filtering, aggregation, or calculations in controller files |
| **No cross-layer imports** | Controllers import services only; services import repositories only |

### 10.2 Behavioral Parity Rules

| Rule | Enforcement |
|------|------------|
| **Same response shape** | V2 endpoints must return identical JSON structure as legacy |
| **Same Excel output** | V2 Excel exports must have identical columns, headers, and data formatting |
| **Same filtering logic** | Date range, status, vessel context filters must produce identical results |
| **Same aggregation totals** | Summary counts, averages, and breakdowns must match exactly |
| **Same error responses** | Error status codes and messages must match legacy behavior |

### 10.3 Migration Safety Rules

| Rule | Detail |
|------|--------|
| **Legacy routes never removed** | Legacy routes remain functional throughout migration |
| **No shared state** | V2 and legacy routes are completely independent |
| **Toggle defaults to legacy** | New deployments default to legacy behavior |
| **Rollback is instant** | Toggling back to legacy requires no data migration |

---

## 11. Phased Migration Plan

### Phase 1: Maintenance Reports (Backend) — 8 routes

**Scope**: Due jobs, overdue jobs, completed jobs, unplanned jobs, postponement log, monthly summary, unplanned breakdown

**Files Created**:
- `server/v2/reports/index.ts`
- `server/v2/reports/routes.ts` (maintenance routes only initially)
- `server/v2/reports/errors.ts`
- `server/v2/reports/repositories/maintenanceReportRepository.ts`
- `server/v2/reports/services/maintenanceReportService.ts`
- `server/v2/reports/services/excelExportService.ts`
- `server/v2/reports/controllers/maintenanceReportController.ts`
- `server/v2/reports/types.ts`

**Validation Checklist — Phase 1**:
- [ ] POST `/v2/reports/maintenance/due-jobs` returns identical data to POST `/reports/due-jobs-7-days`
- [ ] POST `/v2/reports/maintenance/overdue-jobs` returns identical data to POST `/reports/overdue-jobs`
- [ ] POST `/v2/reports/maintenance/completed-jobs` returns identical data to POST `/reports/completed-jobs`
- [ ] POST `/v2/reports/maintenance/unplanned-jobs` returns identical data to POST `/reports/unplanned-jobs`
- [ ] POST `/v2/reports/maintenance/postponement-log` returns identical data to POST `/reports/postponement-log`
- [ ] POST `/v2/reports/maintenance/monthly-summary/excel` produces identical Excel to POST `/reports/maintenance/monthly-summary/excel`
- [ ] GET `/v2/reports/maintenance/unplanned-breakdown` returns identical data to GET `/reports/unplanned-breakdown-jobs`
- [ ] POST `/v2/reports/maintenance/unplanned-breakdown/excel` produces identical Excel to POST `/reports/unplanned-breakdown-jobs/excel`
- [ ] "All Vessels" aggregation produces same totals in V2 and legacy
- [ ] Date range filtering produces identical results
- [ ] Status filtering (due, overdue, completed, unplanned) produces identical results
- [ ] Empty result sets handled identically (same response shape)

### Phase 2: Spares & Stores Reports (Backend) — 15 routes

**Scope**: Critical spares, low stock alert, mark-ordered mutation, stores inventory, stores consumption, spares consumption, combined consumption, chemicals expiry, stores low stock

**Files Created**:
- `server/v2/reports/repositories/sparesReportRepository.ts`
- `server/v2/reports/repositories/storesReportRepository.ts`
- `server/v2/reports/services/sparesReportService.ts`
- `server/v2/reports/services/storesReportService.ts`
- `server/v2/reports/controllers/sparesReportController.ts`
- `server/v2/reports/controllers/storesReportController.ts`

**Validation Checklist — Phase 2**:
- [ ] GET `/v2/reports/spares/critical/preview` returns identical data to GET `/reports/critical-spares/preview`
- [ ] POST `/v2/reports/spares/critical/excel` produces identical Excel to POST `/reports/critical-spares`
- [ ] GET `/v2/reports/spares/low-stock/:vesselId` returns identical data to GET `/reports/low-stock-alert/:vesselId`
- [ ] PATCH `/v2/reports/spares/low-stock/:vesselId/mark-ordered/:spareId` produces same mutation as legacy
- [ ] POST `/v2/reports/spares/low-stock/:vesselId/excel` produces identical Excel
- [ ] GET `/v2/reports/spares/consumption/:vesselId` returns identical data to GET `/reports/spares-consumption-analysis/:vesselId`
- [ ] POST `/v2/reports/spares/consumption/:vesselId/excel` produces identical Excel
- [ ] GET `/v2/reports/stores/consumption/:vesselId` returns identical data to GET `/reports/stores-consumption-analysis/:vesselId`
- [ ] POST `/v2/reports/stores/consumption/:vesselId/excel` produces identical Excel
- [ ] POST `/v2/reports/stores/inventory/:vesselId/excel` produces identical Excel to POST `/reports/stores-inventory-status/:vesselId/excel`
- [ ] GET `/v2/reports/stores/chemicals-expiry/:vesselId` returns identical data
- [ ] GET `/v2/reports/stores/low-stock/:vesselId` returns identical data
- [ ] POST `/v2/reports/stores/low-stock/:vesselId/excel` produces identical Excel
- [ ] GET `/v2/reports/stores/consumption-combined/:vesselId` returns identical data
- [ ] POST `/v2/reports/stores/consumption-combined/:vesselId/excel` produces identical Excel
- [ ] Consumption aggregation totals match exactly (monthly averages, trends)
- [ ] Low stock threshold logic (ROB < min) produces identical item lists

### Phase 3: Compliance & Operations Reports (Backend) — 10 routes

**Scope**: Critical equipment status, IHM inventory, RH anomaly detection, crew workload, equipment utilization

**Files Created**:
- `server/v2/reports/repositories/complianceReportRepository.ts`
- `server/v2/reports/repositories/operationsReportRepository.ts`
- `server/v2/reports/services/complianceReportService.ts`
- `server/v2/reports/services/operationsReportService.ts`
- `server/v2/reports/controllers/complianceReportController.ts`
- `server/v2/reports/controllers/operationsReportController.ts`

**Validation Checklist — Phase 3**:
- [ ] GET `/v2/reports/compliance/critical-equipment` returns identical data
- [ ] POST `/v2/reports/compliance/critical-equipment/excel` produces identical Excel
- [ ] GET `/v2/reports/compliance/ihm-inventory` returns identical data
- [ ] POST `/v2/reports/compliance/ihm-inventory/excel` produces identical Excel
- [ ] GET `/v2/reports/compliance/rh-anomaly` returns identical data
- [ ] POST `/v2/reports/compliance/rh-anomaly/excel` produces identical Excel
- [ ] GET `/v2/reports/operations/crew-workload` returns identical data
- [ ] POST `/v2/reports/operations/crew-workload/excel` produces identical Excel
- [ ] GET `/v2/reports/operations/equipment-utilization` returns identical data
- [ ] POST `/v2/reports/operations/equipment-utilization/excel` produces identical Excel
- [ ] RH anomaly detection logic identifies same anomalies as legacy
- [ ] Crew workload distribution percentages match exactly
- [ ] Equipment utilization rates calculated identically

### Phase 4: Change Request Reports + Snapshots (Backend) — 5 routes

**Scope**: Change request status tracking, report snapshots, generic report type router

**Files Created**:
- `server/v2/reports/repositories/changeRequestReportRepository.ts`
- `server/v2/reports/repositories/snapshotRepository.ts`
- `server/v2/reports/services/changeRequestReportService.ts`
- `server/v2/reports/services/snapshotService.ts`
- `server/v2/reports/controllers/changeRequestReportController.ts`
- `server/v2/reports/controllers/snapshotController.ts`

**Validation Checklist — Phase 4**:
- [ ] GET `/v2/reports/change-requests/status-tracking` returns identical data
- [ ] GET `/v2/reports/change-requests/status-tracking/export` produces identical Excel
- [ ] GET `/v2/reports/snapshots/:vesselId` returns identical snapshot list
- [ ] GET `/v2/reports/snapshots/detail/:snapshotId` returns identical snapshot detail
- [ ] GET `/v2/reports/:reportType` routes to correct V2 handler equivalents
- [ ] Change request status aggregation (counts by status) matches exactly

### Phase 5: Frontend Integration & Toggle — All 17 pages

**Scope**: Add V2 API layer, toggle component, and update all 17 report pages

**Files Created**:
- `client/src/modules/reports/api/maintenanceReportApi.ts`
- `client/src/modules/reports/api/sparesReportApi.ts`
- `client/src/modules/reports/api/storesReportApi.ts`
- `client/src/modules/reports/api/complianceReportApi.ts`
- `client/src/modules/reports/api/operationsReportApi.ts`
- `client/src/modules/reports/api/changeRequestReportApi.ts`
- `client/src/modules/reports/hooks/useReportApi.ts`
- `client/src/modules/reports/components/ReportApiToggle.tsx`

**Files Modified**: All 17 frontend report pages updated to use `useReportApi()` hook

**Validation Checklist — Phase 5**:
- [ ] Toggle defaults to Legacy
- [ ] All 17 pages work in Legacy mode (unchanged behavior)
- [ ] All 17 pages work in V2 mode (identical behavior)
- [ ] Toggle switch causes no data loss
- [ ] No visual differences between modes
- [ ] Excel downloads work identically in both modes
- [ ] Mark-ordered mutation works identically in both modes
- [ ] "All Vessels" view works identically in both modes
- [ ] Date range filtering works identically in both modes

---

## 12. Toggle-Based Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  localStorage: reports_api_version = "legacy" | "v2"            │
│                                                                  │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │ ReportApi    │     │ useReportApi() Hook                  │  │
│  │ Toggle.tsx   │────▶│                                      │  │
│  │ [Legacy|V2]  │     │ if (v2) → V2 API functions           │  │
│  └──────────────┘     │ else   → Legacy API functions        │  │
│                        └──────────────┬───────────────────────┘  │
│                                       │                          │
└───────────────────────────────────────┼──────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
         ┌──────────────────┐ ┌──────────────────┐
         │  Legacy Routes   │ │   V2 Routes      │
         │  /reports/*      │ │   /v2/reports/*   │
         │                  │ │                   │
         │  routes.ts       │ │  Controller       │
         │  (monolithic)    │ │     ↓             │
         │                  │ │  Service          │
         │                  │ │     ↓             │
         │                  │ │  Repository       │
         └────────┬─────────┘ └────────┬──────────┘
                  │                    │
                  └────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   storage interface    │
              │   (shared by both)     │
              │                        │
              │  getWorkOrders()       │
              │  getJobs()             │
              │  getSpares()           │
              │  getComponents()       │
              │  getChangeRequests()   │
              │  getIhmStatusReport()  │
              │  report_snapshots      │
              └────────────────────────┘
```

---

## 13. Risk Points & Rollback Strategy

### 13.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Inline SQL aggregation not in storage interface | High | Extract to repository layer, compare output field-by-field with legacy. Many reports use raw queries or multi-step aggregation that must be preserved exactly. |
| Excel export binary parity | High | Compare Excel file structure, column headers, data rows, and formatting row-by-row. Use shared `excelReportStyles.ts` utilities identically. |
| "All Vessels" aggregation logic | Medium | Test with multi-vessel data, compare totals. Some reports iterate over all vessels and merge — this logic must be preserved. |
| Date range and status filtering edge cases | Medium | Preserve exact filtering logic including boundary conditions (e.g., 7-day window includes today? inclusive/exclusive dates?). |
| Cross-module storage method dependency | Medium | Reports consume methods from 6+ other modules. Changes to those modules' storage methods could affect reports. Repository layer provides isolation point. |
| Generic `/:reportType` router | Low | Map each report type string to V2 equivalent. Low risk as this is a simple routing concern. |
| Mark-ordered mutation side effects | Low | Only one mutation endpoint in module. Verify lastOrderDate format and no other fields are affected. |

### 13.2 Rollback Strategy

| Scenario | Action |
|----------|--------|
| V2 endpoint returns different data than legacy | Toggle back to legacy immediately. Debug service layer. |
| V2 Excel export differs from legacy | Toggle back to legacy. Compare column definitions in excelExportService. |
| V2 aggregation totals don't match | Toggle back to legacy. Debug service aggregation logic step-by-step. |
| Performance regression (V2 slower than legacy) | Toggle back to legacy. Profile repository calls — may need query optimization. |
| Frontend toggle causes errors | Remove toggle UI, force legacy mode. Debug API layer. |

### 13.3 Rollback is Always Safe Because

1. Legacy routes are **never removed** — they continue to function
2. Toggle defaults to legacy — new users always start on legacy
3. No data migration — V2 reads the same data as legacy
4. No schema changes — `report_snapshots` table is unchanged
5. Toggle is per-browser — one user's V2 doesn't affect other users

---

## 14. Validation Checklist

### 14.1 Backend Parity (Per Sub-Domain)

**Maintenance Reports (8 handlers):**
- [ ] Due jobs 7-day window: same items returned, same summary counts
- [ ] Overdue jobs: same overdue detection logic, same results
- [ ] Completed jobs: same date-range filtering, same results
- [ ] Unplanned jobs: same maintenance basis filtering
- [ ] Postponement log: same postponement data joined correctly
- [ ] Monthly summary Excel: identical file content
- [ ] Unplanned breakdown: same aggregation, same breakdown categories
- [ ] Unplanned breakdown Excel: identical file content

**Spares & Stores Reports (15 handlers):**
- [ ] Critical spares preview: same critical flag filtering
- [ ] Critical spares Excel: identical file content
- [ ] Low stock alert: same ROB < min detection
- [ ] Mark ordered mutation: same field updated, same response
- [ ] Low stock Excel: identical file content
- [ ] Stores inventory Excel: identical file content
- [ ] Stores consumption analysis: same aggregation totals
- [ ] Stores consumption Excel: identical file content
- [ ] Spares consumption analysis: same pattern detection
- [ ] Spares consumption Excel: identical file content
- [ ] Combined consumption: same merged results
- [ ] Combined consumption Excel: identical file content
- [ ] Chemicals expiry: same expiry date filtering
- [ ] Stores low stock: same threshold detection
- [ ] Stores low stock Excel: identical file content

**Compliance & Operations Reports (10 handlers):**
- [ ] Critical equipment status: same critical component aggregation
- [ ] Critical equipment Excel: identical file content
- [ ] IHM inventory status: same IHM presence aggregation
- [ ] IHM inventory Excel: identical file content
- [ ] RH anomaly detection: same anomaly identification logic
- [ ] RH anomaly Excel: identical file content
- [ ] Crew workload distribution: same assignee aggregation
- [ ] Crew workload Excel: identical file content
- [ ] Equipment utilization: same utilization rate calculation
- [ ] Equipment utilization Excel: identical file content

**Change Request Reports + Snapshots (5 handlers):**
- [ ] Change request status tracking: same status aggregation
- [ ] Change request export: identical file content
- [ ] Snapshots by vessel: same snapshot list
- [ ] Snapshot detail: same snapshot data
- [ ] Generic reportType router: same routing behavior

### 14.2 Excel Export Validation

For **each** of the 19 Excel export endpoints:
- [ ] Same column count and column headers
- [ ] Same data row count
- [ ] Same data values in each cell
- [ ] Same formatting (colors, borders, fonts) via shared excelReportStyles
- [ ] Same filename pattern
- [ ] Same Content-Type and Content-Disposition headers

### 14.3 Cross-Cutting Validation

- [ ] "All Vessels" mode produces identical results in V2 and legacy
- [ ] Date range filtering edge cases handled identically
- [ ] Empty vessel (no data) produces same empty response shape
- [ ] Error responses (400, 404, 500) match legacy behavior
- [ ] Response time within 10% of legacy for all endpoints

### 14.4 Frontend Validation

- [ ] Toggle defaults to Legacy
- [ ] All 17 pages work in Legacy mode (unchanged)
- [ ] All 17 pages work in V2 mode (identical behavior)
- [ ] Toggle switch causes no data loss
- [ ] No visual differences between modes
- [ ] Excel download triggers work in both modes
- [ ] Mark-ordered button works in both modes

---

## Appendix A: Comparison with Fleet Module V2 Plan

| Aspect | Fleet V2 | Reports V2 |
|--------|----------|------------|
| Toggle key | `fleet_api_version` | `reports_api_version` |
| Inline business logic complexity | Medium (field sanitization, auto-code, delete guards) | High (multi-source aggregation, date calculations, anomaly detection, consumption analysis) |
| Number of entities | 12+ entities (components, jobs, spares, makers, mappings, registry) | 7 sub-domains (maintenance, spares, stores, compliance, operations, change requests, snapshots) |
| Route handlers (legacy) | 78 | 38 |
| Storage methods (dedicated) | ~50+ dedicated fleet storage methods | 0 dedicated — uses cross-module storage methods |
| Frontend pages affected | 11+ fleet admin pages | 17 report pages |
| Sub-router | `fleetAdmin.ts` (1,155 lines) | None (all in routes.ts) |
| Excel export endpoints | 3 exports (components, jobs, spares) | 19 exports across all sub-domains |
| Mutations (write operations) | Full CRUD (create, update, delete) | 1 mutation only (mark spare as ordered) |
| Schema tables | 10+ fleet tables | 1 table (report_snapshots) |
| Data access pattern | Dedicated storage methods | Cross-module storage method consumption + inline aggregation |

---

## Appendix B: Route Inventory Checklist (38/38 Verified)

### Maintenance Reports (8 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 1 | 5393 | GET | `/reports/unplanned-breakdown-jobs` | `maintenanceReportController.getUnplannedBreakdown` | YES |
| 2 | 5534 | POST | `/reports/unplanned-breakdown-jobs/excel` | `maintenanceReportController.getUnplannedBreakdownExcel` | YES |
| 3 | 15094 | POST | `/reports/due-jobs-7-days` | `maintenanceReportController.getDueJobs` | YES |
| 4 | 15484 | POST | `/reports/overdue-jobs` | `maintenanceReportController.getOverdueJobs` | YES |
| 5 | 15834 | POST | `/reports/completed-jobs` | `maintenanceReportController.getCompletedJobs` | YES |
| 6 | 16193 | POST | `/reports/unplanned-jobs` | `maintenanceReportController.getUnplannedJobs` | YES |
| 7 | 16374 | POST | `/reports/postponement-log` | `maintenanceReportController.getPostponementLog` | YES |
| 8 | 16757 | POST | `/reports/maintenance/monthly-summary/excel` | `maintenanceReportController.getMonthlySummaryExcel` | YES |

### Spares & Stores Reports (12 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 9 | 4521 | GET | `/reports/critical-spares/preview` | `sparesReportController.getCriticalSparesPreview` | YES |
| 10 | 4745 | POST | `/reports/critical-spares` | `sparesReportController.getCriticalSparesExcel` | YES |
| 11 | 7360 | GET | `/reports/low-stock-alert/:vesselId` | `sparesReportController.getLowStockAlert` | YES |
| 12 | 7448 | PATCH | `/reports/low-stock-alert/:vesselId/mark-ordered/:spareId` | `sparesReportController.markOrdered` | YES |
| 13 | 7462 | POST | `/reports/low-stock-alert/:vesselId/excel` | `sparesReportController.getLowStockExcel` | YES |
| 14 | 7608 | POST | `/reports/stores-inventory-status/:vesselId/excel` | `storesReportController.getStoresInventoryExcel` | YES |
| 15 | 7865 | GET | `/reports/stores-consumption-analysis/:vesselId` | `storesReportController.getStoresConsumption` | YES |
| 16 | 8208 | POST | `/reports/stores-consumption-analysis/:vesselId/excel` | `storesReportController.getStoresConsumptionExcel` | YES |
| 17 | 8612 | GET | `/reports/spares-consumption-analysis/:vesselId` | `sparesReportController.getSparesConsumption` | YES |
| 18 | 8947 | POST | `/reports/spares-consumption-analysis/:vesselId/excel` | `sparesReportController.getSparesConsumptionExcel` | YES |
| 19 | 9339 | GET | `/reports/consumption-analysis/:vesselId` | `storesReportController.getCombinedConsumption` | YES |
| 20 | 9422 | POST | `/reports/consumption-analysis/:vesselId/excel` | `storesReportController.getCombinedConsumptionExcel` | YES |

### Stores-Specific Reports (3 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 21 | 10219 | GET | `/reports/chemicals-expiry/:vesselId` | `storesReportController.getChemicalsExpiry` | YES |
| 22 | 10319 | GET | `/reports/stores-low-stock-alert/:vesselId` | `storesReportController.getStoresLowStock` | YES |
| 23 | 10364 | POST | `/reports/stores-low-stock-alert/:vesselId/excel` | `storesReportController.getStoresLowStockExcel` | YES |

### Compliance & Regulatory Reports (6 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 24 | 5026 | GET | `/reports/critical-equipment-status` | `complianceReportController.getCriticalEquipmentStatus` | YES |
| 25 | 5164 | POST | `/reports/critical-equipment-status/excel` | `complianceReportController.getCriticalEquipmentExcel` | YES |
| 26 | 19091 | GET | `/reports/ihm-inventory-status` | `complianceReportController.getIhmInventoryStatus` | YES |
| 27 | 19298 | POST | `/reports/ihm-inventory-status/excel` | `complianceReportController.getIhmInventoryExcel` | YES |
| 28 | 18527 | GET | `/reports/running-hours-anomaly-detection` | `complianceReportController.getRhAnomalyDetection` | YES |
| 29 | 18773 | POST | `/reports/running-hours-anomaly-detection/excel` | `complianceReportController.getRhAnomalyExcel` | YES |

### Operations & Utilization Reports (4 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 30 | 17427 | GET | `/reports/crew-workload-distribution` | `operationsReportController.getCrewWorkload` | YES |
| 31 | 17635 | POST | `/reports/crew-workload-distribution/excel` | `operationsReportController.getCrewWorkloadExcel` | YES |
| 32 | 17973 | GET | `/reports/equipment-utilization-summary` | `operationsReportController.getEquipmentUtilization` | YES |
| 33 | 18201 | POST | `/reports/equipment-utilization-summary/excel` | `operationsReportController.getEquipmentUtilizationExcel` | YES |

### Change Request Reports (2 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 34 | 10906 | GET | `/reports/change-requests-status-tracking` | `changeRequestReportController.getStatusTracking` | YES |
| 35 | 11073 | GET | `/reports/change-requests-status-tracking/export` | `changeRequestReportController.getStatusTrackingExport` | YES |

### Snapshots & Generic (3 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 36 | 10460 | GET | `/reports/snapshots/:vesselId` | `snapshotController.getByVessel` | YES |
| 37 | 10478 | GET | `/reports/snapshots/detail/:snapshotId` | `snapshotController.getDetail` | YES |
| 38 | 10792 | GET | `/reports/:reportType` | `snapshotController.getByReportType` | YES |

**Total Verified: 38/38 route handlers accounted for in V2 plan.**

---

## Appendix C: Business Logic Preservation Rules (Must-Preserve)

These are critical business logic behaviors that the V2 service layer MUST preserve exactly as-is. Each item references the legacy source location.

### C.1 Due Jobs 7-Day Window Calculation (routes.ts L15094–L15480)

**Rule**: Filter work orders where `nextDueDate` falls within a 7-day window from current date:
1. Calculate `now` and `sevenDaysFromNow`
2. Include work orders where `nextDueDate >= now && nextDueDate <= sevenDaysFromNow`
3. Exclude work orders with status `Completed`
4. Join with job details (title, task type, interval, priority)
5. Join with component details (name, code, critical flag)
6. Sort by due date ascending

**"All Vessels" Behavior**: When `vesselId = "all"`, iterate over all vessels, merge results, and produce a combined report with vessel name column.

### C.2 Overdue Jobs Detection (routes.ts L15484–L15830)

**Rule**: Filter work orders where maintenance is overdue:
1. `nextDueDate` is in the past AND status is NOT `Completed`
2. Calculate days overdue: `(now - nextDueDate) / (1000 * 60 * 60 * 24)`
3. Classify severity: 1-7 days = "Minor", 8-30 days = "Moderate", 30+ days = "Critical"

### C.3 Low Stock Detection Logic (routes.ts L7360–L7444)

**Rule**: Identify spares where remaining on board is below minimum:
1. Filter: `rob < min` (ROB = remaining on board, min = minimum stock level)
2. Calculate shortage: `min - rob`
3. Include only active spares (`deleted !== true`)
4. Sort by shortage quantity descending (most critical first)

### C.4 Mark Spare as Ordered (routes.ts L7448)

**Rule**: The only mutation in the Reports module:
1. Update spare's `lastOrderDate` to current date string
2. Preserve all other spare fields unchanged
3. Return updated spare object

### C.5 Consumption Analysis Aggregation (routes.ts L7865–L9422)

**Rule**: Aggregate consumption data from stores ledger / spare history:
1. Fetch all ledger entries within date range (dateFrom, dateTo)
2. Group by item name/code
3. For each group: calculate total consumed, total received, net change
4. Calculate average monthly consumption rate
5. Identify trend: increasing, decreasing, or stable
6. Sort by total consumption volume descending

### C.6 Running Hours Anomaly Detection (routes.ts L18527–L18769)

**Rule**: Detect anomalous patterns in running hours data:
1. Fetch all RH audit entries for components in vessel
2. For each component, analyze sequential entries:
   - Detect gaps: no entry for > 30 days when component has regular entries
   - Detect spikes: single entry increase > 2x average daily rate
   - Detect negative deltas: new RH < previous RH (without meter replacement)
3. Flag components with any anomaly
4. Return sorted by anomaly severity

### C.7 Critical Equipment Status Aggregation (routes.ts L5026–L5160)

**Rule**: Aggregate status of critical equipment:
1. Fetch components with `critical = true`
2. For each, fetch latest work order
3. Determine status: "On Schedule", "Due Soon", "Overdue", "No Maintenance Plan"
4. Aggregate counts by status category
5. Return both summary and detailed item list

### C.8 Crew Workload Distribution (routes.ts L17427–L17631)

**Rule**: Aggregate work orders by assigned crew member:
1. Fetch all work orders with `assignedTo` field populated
2. Group by `assignedTo` value
3. For each crew member: count total, open, completed, overdue
4. Calculate workload percentage: crew member's total / grand total
5. Return sorted by workload descending

### C.9 Equipment Utilization Summary (routes.ts L17973–L18197)

**Rule**: Calculate equipment utilization rates:
1. Fetch components with running hours
2. For each component with RH data: calculate utilization rate
3. Utilization = actual running hours / expected running hours (based on interval)
4. Classify: > 90% = "High", 50-90% = "Medium", < 50% = "Low"
5. Return with overall fleet average

### C.10 Excel Report Styling Contract (server/lib/excelReportStyles.ts)

**Rule**: All Excel exports MUST use the shared styling utilities:
1. `applyStandardHeader()` — report title, date, vessel name
2. `applyStandardTableHeader()` — column headers with frozen row
3. `applyStandardDataRows()` — data rows with alternating colors
4. `applyStandardSummary()` — summary section at bottom
5. `applyStandardPageSetup()` — print settings, margins
6. `generateFilename()` — standardized filename with date

The V2 `excelExportService.ts` MUST call these exact same utility functions to ensure Excel output parity.

---

## Appendix D: Cross-Module Storage Method Dependencies

This table documents which storage methods from OTHER modules are consumed by report route handlers. The V2 repository layer must wrap these same methods.

| Storage Method | Module Owner | Used By Report Sub-Domain | Route Lines |
|----------------|-------------|---------------------------|-------------|
| `storage.getWorkOrders(vesselId)` | Work Orders | Maintenance, Operations | L15094, L15484, L15834, L16193, L17427, L17973 |
| `storage.getJobs(vesselId)` | Jobs | Maintenance, Operations | L15094, L15484, L17427 |
| `storage.getComponents(vesselId)` | Components | Maintenance, Compliance, Operations | L15094, L5026, L17973 |
| `storage.getSpares(vesselId)` | Spares | Spares & Stores | L4521, L7360, L8612 |
| `storage.getAllSpares()` | Spares | Spares (all vessels) | L4521 |
| `storage.updateSpare(id, data)` | Spares | Spares (mark ordered) | L7448 |
| `storage.getSpareHistory(vesselId)` | Spare History | Spares Consumption | L8612 |
| `storage.getChangeRequests(filters)` | Change Requests | Change Request Reports | L10906 |
| `storage.getIhmStatusReport(vesselId)` | IHM | Compliance (IHM) | L19091 |
| `storage.getRunningHoursAudits(componentId)` | Running Hours | Compliance (RH Anomaly) | L18527 |
| Direct Drizzle on `storesItems` table | Stores | Stores Reports | L7608, L10219, L10319 |
| Direct Drizzle on `storesLedger` table | Stores | Stores Consumption | L7865, L8208 |
| Direct Drizzle on `reportSnapshots` table | Reports (own) | Snapshots | L10460, L10478 |
| Direct Drizzle on `workOrderPostponements` table | Work Orders | Maintenance (postponement) | L16374 |

---

*Document Version: 1.0*
*Created: February 2026*
*Scope: Reports Module V2 Architecture — Planning Only*
