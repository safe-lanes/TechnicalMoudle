# Refactoring Analysis Report

> Generated: 2026-02-21
> Codebase: Maritime PMS (Planned Maintenance System)
> Branch: refactor/modular-architecture

---

## 1. Module Summary Table

| # | Module | Routes (routes.ts) | Routes (separated) | Total Endpoints | Storage Methods | Complexity | Key Dependencies |
|---|--------|:---:|:---:|:---:|:---:|:---:|---|
| 1 | **Vessels** | 4 | 0 | 4 | 9 | Low | Fleets |
| 2 | **Fleets** | 7 | 0 | 7 | 9 | Low | Vessels |
| 3 | **Components** | 21 | 0 | 21 | 46 | Medium | Jobs (job-component-links), Spares (spare-component-links) |
| 4 | **Jobs** | 9 | 0 | 9 | 23 | High | Components, Work Orders, Maintenance History |
| 5 | **Work Orders** | 18 | 0 | 18 | 33 | Very High | Jobs, Components, Running Hours, PMS Settings |
| 6 | **Running Hours** | 3 | 10 | 13 | 5 | High | Components (cascade updates) |
| 7 | **Spares** | 16 | 0 | 16 | 37 | High | Inventory (spare_location_stock), Locations |
| 8 | **Inventory** | 17 | 0 | 17 | 28 | High | Spares, Locations, Components |
| 9 | **Stores** | 12 | 0 | 12 | 11 | Medium | Stores Ledger (internal) |
| 10 | **Defects** | 27 | 0 | 27 | 28 | Medium | Vessels (sequence gen), Equipment Categories |
| 11 | **Certificates & Surveys** | 21 | 0 | 21 | 10 | Medium | Vessels, Direct Drizzle (bypasses storage) |
| 12 | **Fleet Admin** | 31 | 46 | 77 | 32 | Medium | Makers, Master Lists, Components, Jobs, Spares |
| 13 | **Reports** | 43 | 0 | 43 | 0 | Very High | All modules (read-only), ExcelJS inline |
| 14 | **Change Requests** | 0 | 12 | 12 | 16 | High | Components, Jobs, WOs, Spares, Stores (approve flow) |
| 15 | **Bulk Upload** | 0 | 26 | 26 | ~30 | Very High | Components, Jobs, Spares, Stores, Fleet Admin |
| 16 | **Alerts** | 0 | 10 | 10 | 13 | Low | None |
| 17 | **Forms** | 0 | 10 | 10 | 14 | Low | None |
| 18 | **Chatbot** | 0 | 1 | 1 | All (via service) | High | All modules (read-only, via chatbotService) |
| 19 | **Misc** | 23 | 0 | 23 | 105 | Medium | Various (PMS settings, admin utils, documents) |
| | **TOTALS** | **232** | **115** | **347** | **382** | | |

### Complexity Rating Criteria
- **Low**: Simple CRUD, no cross-module dependencies
- **Medium**: Some validation/business logic, limited cross-module
- **High**: Complex business logic, cascade operations, multiple modules
- **Very High**: 200+ line handlers, complex state machines, many cross-module dependencies

---

## 2. Full Route Inventory (server/routes.ts)

### 2.1 Vessels (4 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 13092 | GET | `/technical/api/vessels` | `getVessels` | NO |
| 13103 | POST | `/technical/api/vessels` | `createVessel` | YES — field validation |
| 13081 | GET | `/technical/api/vessels-with-fleets` | `getVesselsWithFleets` | NO |
| 13068 | PUT | `/technical/api/vessels/:id/fleet` | `updateVesselFleet` | YES — fleet assignment logic |

### 2.2 Fleets (7 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 12958 | GET | `/technical/api/fleets` | `getFleets` | NO |
| 12972 | GET | `/technical/api/fleets/:id` | `getFleet` | NO |
| 12986 | POST | `/technical/api/fleets` | `createFleet` | YES — validation |
| 13013 | PUT | `/technical/api/fleets/:id` | `updateFleet` | YES — validation |
| 13038 | DELETE | `/technical/api/fleets/:id` | `deleteFleet` | NO |
| 13055 | GET | `/technical/api/fleets/:id/vessels` | `getFleetVessels` | NO |
| 12907 | GET | `/technical/api/fleet/vessel-mappings` | `getFleetVesselMappings` | NO |

### 2.3 Components (21 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 125 | GET | `/technical/api/components/:vesselId` | `getComponents` | NO |
| 141 | GET | `/technical/api/components/details/:id` | `getComponent` | NO |
| 155 | POST | `/technical/api/components/upload` | `bulkCreateComponents`, `bulkUpdateComponents`, `bulkUpsertComponents` | YES — Excel parsing, validation, hierarchy |
| 6726 | POST | `/technical/api/components` | `createComponent` | YES — validation, code generation |
| 6787 | GET | `/technical/api/components` | `getComponents` | NO |
| 6807 | GET | `/technical/api/components/:id` | `getComponent` | NO |
| 6819 | PATCH | `/technical/api/components/:id` | `updateComponent`, `getLinkedJobsForComponent` | YES — cascade RH to children, job next-due recalc |
| 6939 | DELETE | `/technical/api/components/:id` | `deleteComponent` | NO |
| 6954 | POST | `/technical/api/components/:id/inactivate` | `archiveComponent` | YES — cascade archive children |
| 1514 | GET | `/technical/api/component-documents/:componentId` | `getComponentDocuments` | NO |
| 1560 | POST | `/technical/api/component-documents` | `createComponentDocument` | YES — file upload handling |
| 1672 | PUT | `/technical/api/component-documents/:id` | `updateComponentDocument` | YES — file replacement |
| 1728 | DELETE | `/technical/api/component-documents/:id` | `deleteComponentDocument` | YES — file deletion |
| 1739 | GET | `/technical/api/component-documents/:id/download` | `getComponentDocument` | YES — S3/local file serving |
| 1798 | GET | `/technical/api/component-class-regulatory/:componentId` | `getComponentClassRegulatory` | NO |
| 1825 | POST | `/technical/api/component-class-regulatory` | `createComponentClassRegulatory` | NO |
| 1845 | PUT | `/technical/api/component-class-regulatory/:id` | `updateComponentClassRegulatory` | NO |
| 1864 | DELETE | `/technical/api/component-class-regulatory/:id` | `deleteComponentClassRegulatory` | NO |
| 1877 | GET | `/technical/api/component-requisitions/:componentId` | `getComponentRequisitions` | NO |
| 1938 | GET | `/technical/api/component-requisitions` | `getAllComponentRequisitions` | YES — filtering |
| 1956 | GET | `/technical/api/component-requisitions/item/:id` | `getComponentRequisitionItem` | NO |
| 1982 | POST | `/technical/api/component-requisitions` | `createComponentRequisition` | YES — auto-generate requisitionNo |
| 2014 | PUT | `/technical/api/component-requisitions/:id` | `updateComponentRequisition` | NO |
| 2055 | DELETE | `/technical/api/component-requisitions/:id` | `deleteComponentRequisition` | NO |
| 2068 | GET | `/technical/api/component-maintenance-history` | `getAllComponentMaintenanceHistory` | NO |
| 2078 | GET | `/technical/api/component-maintenance-history/:componentId` | `getComponentMaintenanceHistory` | YES — fallback by code |
| 2117 | GET | `/technical/api/job-maintenance-history/:jobId` | `getMaintenanceHistoryByJobId` | YES — fallback by code |
| 2148 | GET | `/technical/api/component-maintenance-history/item/:id` | `getComponentMaintenanceHistoryItem` | NO |

### 2.4 Jobs (9 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 443 | GET | `/technical/api/jobs` | `getJobs`, `getJobComponentLinks`, `getComponents` | YES — 146 lines: enrichment, component linking, status computation, sorting |
| 589 | GET | `/technical/api/jobs/:id` | `getJob` | NO |
| 603 | GET | `/technical/api/jobs/:id/context` | `getJob`, `getLinkedComponentsForJob`, `getWorkOrdersByJobId`, `getMaintenanceHistoryByJobId` | YES — aggregation across multiple entities |
| 752 | POST | `/technical/api/jobs` | `createJob`, `createJobComponentLink` | YES — 120 lines: validation, auto-numbering, multi-component linking |
| 874 | PATCH | `/technical/api/jobs/:id` | `updateJob`, `createJobComponentLink`, `deleteJobComponentLink` | YES — 120 lines: component link sync, next-due recalc |
| 997 | DELETE | `/technical/api/jobs/:id` | `deleteJob` | NO |
| 1011 | GET | `/technical/api/maintenance-planner` | `getJobs`, `getComponents`, `getWorkOrders`, `getJobComponentLinks` | YES — 425 lines: complex aggregation, status computation, gantt data |
| 1437 | GET | `/technical/api/maintenance-planner/export` | Same as planner | YES — Excel export of planner data |
| 13325 | POST | `/technical/api/jobs/:id/generate-wo` | `generateOnDemandWorkOrder` | YES — on-demand WO generation |

### 2.5 Work Orders (18 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 2176 | GET | `/technical/api/work-orders` | `getWorkOrders`, `getComponents`, `getJobs` | YES — 178 lines: status computation, enrichment, calendar/RH next-due |
| 2355 | GET | `/technical/api/work-orders/:id` | `getWorkOrder`, `getComponent`, `getJob` | YES — 95 lines: enrichment, status computation |
| 2451 | GET | `/technical/api/work-orders/:id/context` | `getWorkOrder`, `getJob`, `getComponent`, `getWorkOrderPostponements`, `getMaintenanceHistoryByJobAndComponent` | YES — 248 lines: deep context aggregation |
| 2700 | POST | `/technical/api/work-orders` | `createWorkOrder`, `getJob`, `getComponent` | YES — 220 lines: validation, status computation, WO number generation |
| 2921 | PATCH | `/technical/api/work-orders/:id` | `updateWorkOrder`, `getComponent`, `getJob`, `createWorkOrderPostponement` | YES — **640 lines**: status transitions, approval/rejection, postponement handling, RH recording |
| 3563 | POST | `/technical/api/work-orders/bulk-approve` | `updateWorkOrder` | YES — bulk status transition |
| 3653 | POST | `/technical/api/work-orders/bulk-reject` | `updateWorkOrder` | YES — bulk rejection |
| 3715 | POST | `/technical/api/work-orders/:id/complete` | `getWorkOrder`, `updateWorkOrder`, `getJob`, `updateJob`, `getComponent`, `updateComponent`, `createComponentMaintenanceHistory` | YES — **510 lines**: completion flow, RH recording, next-due calc, maintenance history, cascade to inherited |
| 4228 | DELETE | `/technical/api/work-orders/:id` | `deleteWorkOrder` | NO |
| 4241 | POST | `/technical/api/work-orders/auto-generate` | `getJobs`, `getWorkOrders`, `createWorkOrder` | YES — 260 lines: batch auto-generation |
| 4439 | POST | `/technical/api/work-orders/backfill-job-ids` | `getWorkOrders`, `getJobs`, `updateWorkOrder` | YES — migration utility |
| 4503 | GET | `/technical/api/work-order-executions/:componentId` | `getWorkOrderExecutions` | NO |
| 4514 | GET | `/technical/api/work-order-executions/details/:id` | `getWorkOrderExecutionById` | NO |
| 4528 | POST | `/technical/api/work-order-executions` | `createWorkOrderExecution` | NO |
| 4543 | PATCH | `/technical/api/work-order-executions/:id` | `updateWorkOrderExecution` | NO |
| 13230 | POST | `/technical/api/work-orders/recalculate-statuses` | WorkOrderStatusRecalculator | YES — triggers status recalc service |
| 13356 | POST | `/technical/api/work-orders/check-postponements` | `checkAndRevertPostponedWorkOrders` | NO |
| 13325 | POST | `/technical/api/jobs/:id/generate-wo` | `generateOnDemandWorkOrder` | YES — on-demand WO generation |

### 2.6 Running Hours (3 endpoints in routes.ts + 10 in runningHoursRoutes.ts)

**In routes.ts:**

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 6570 | GET | `/technical/api/running-hours/:componentId` | `getRunningHoursAudits` | NO |
| 6580 | POST | `/technical/api/running-hours` | `createRunningHoursAudit` | NO |
| 6622 | POST | `/technical/api/running-hours/cascade` | `cascadeRunningHoursUpdate` | YES — validation, cascade to children/inherited |

**In server/runningHoursRoutes.ts (10 endpoints):** See Section 4.

### 2.7 Spares (16 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 6989 | GET | `/technical/api/spares` | `getAllSpares` | NO |
| 7001 | GET | `/technical/api/spares/history/:vesselId` | `getSpareHistory` | NO |
| 7016 | POST | `/technical/api/spares/bulk-update` | `consumeSpare`, `receiveSpare`, `adjustSpareQuantity` | YES — 155 lines: batch consume/receive/adjust |
| 7171 | GET | `/technical/api/spares/:vesselId` | `getSpares` | NO |
| 7192 | GET | `/technical/api/spares/:vesselId/:id` | `getSpare` | NO |
| 7205 | POST | `/technical/api/spares/:vesselId` | `createSpare` | NO |
| 7218 | PATCH | `/technical/api/spares/:vesselId/:id` | `updateSpare` | YES — field sanitization |
| 7279 | DELETE | `/technical/api/spares/:vesselId/:id` | `deleteSpare` | NO |
| 7292 | POST | `/technical/api/spares/:vesselId/:id/adjustment` | `adjustSpareQuantity` | YES — adjustment reason required |
| 7344 | POST | `/technical/api/spares/:vesselId/:id/adjust` | `adjustSpareAtLocation` | YES — location-based adjustment |
| 7379 | GET | `/technical/api/spares/:vesselId/history` | `getSpareHistoryBySpareId` | NO |
| 7392 | GET | `/technical/api/spares/:vesselId/low-stock` | `getSpares` | YES — filter spares where ROB < min |
| 9620 | POST | `/technical/api/spares/:vesselId/batch-consume` | `consumeSpareFromLocation` | YES — batch loop |
| 9647 | POST | `/technical/api/spares/:vesselId/batch-receive` | `receiveSpareToLocation` | YES — batch loop |
| 9675 | POST | `/technical/api/spares/:id/consume` | `consumeSpare` | NO |
| 9710 | POST | `/technical/api/spares/:id/receive` | `receiveSpare` | NO |
| 9759 | POST | `/technical/api/spares/:id/consume-from-location` | `consumeSpareFromLocation` | YES — validation |
| 9852 | POST | `/technical/api/spares/:id/receive-to-location` | `receiveSpareToLocation` | YES — validation |

### 2.8 Inventory (17 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 9919 | GET | `/technical/api/inventory/locations/:vesselId` | `getLocations` | NO |
| 9929 | GET | `/technical/api/inventory/locations/:vesselId/:id` | `getLocationById` | NO |
| 9942 | POST | `/technical/api/inventory/locations/:vesselId` | `createLocation` | YES — validation |
| 9969 | POST | `/technical/api/inventory/reconcile/:vesselId` | `reconcileSpareLocationStock` | NO |
| 9982 | GET | `/technical/api/inventory/spare-links/:vesselId` | `getSpareComponentLinks` | NO |
| 9992 | GET | `/technical/api/inventory/spare-links/by-spare/:spareId` | `getSpareComponentLinksBySpare` | NO |
| 10004 | GET | `/technical/api/inventory/spare-links/by-component/:componentId` | `getSpareComponentLinksByComponent` | NO |
| 10014 | POST | `/technical/api/inventory/spare-links` | `createSpareComponentLink` | YES — duplicate check |
| 10040 | DELETE | `/technical/api/inventory/spare-links/:spareId/:componentId` | `deleteSpareComponentLink` | NO |
| 10053 | GET | `/technical/api/inventory/stock/:spareId` | `getSpareLocationStock`, `getSpareLocationsWithQty` | YES — enrichment |
| 10075 | GET | `/technical/api/inventory/stock/by-location/:locationId` | `getSparesAtLocation` | NO |
| 10086 | GET | `/technical/api/inventory/stock/locations-with-stock/:vesselId` | `getLocationsWithStock` | NO |
| 10096 | GET | `/technical/api/inventory/stock/full-by-location/:vesselId/:locationId` | `getFullSparesAtLocation` | NO |
| 10108 | POST | `/technical/api/inventory/stock/:spareId/:locationId` | `upsertSpareLocationStock` | YES — validation |
| 10149 | POST | `/technical/api/inventory/transactions` | `performInventoryTransaction` | YES — 58 lines: validation, type mapping |
| 10207 | GET | `/technical/api/inventory/transactions/:vesselId` | `getInventoryTransactions` | YES — query param parsing |
| 10242 | GET | `/technical/api/inventory/spares-with-inventory/:vesselId` | `getSparesWithInventoryByVessel` | NO |
| 10252 | GET | `/technical/api/inventory/spare-with-inventory/:spareId` | `getSpareWithInventory` | NO |
| 10268 | GET | `/technical/api/inventory/spares-by-component/:componentId` | `getSparesWithInventoryByComponent` | NO |
| 10278 | GET | `/technical/api/inventory/spares-by-component-code/:vesselId/:componentCode` | `getSparesWithInventoryByComponentCode` | NO |

### 2.9 Stores (12 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 10568 | GET | `/technical/api/stores` | `getStoresItems` | YES — query filtering |
| 10582 | GET | `/technical/api/stores/:vesselId` | `getStoresItems` | YES — query filtering |
| 10605 | GET | `/technical/api/stores/:vesselId/history` | `getStoresTransactionHistory` | NO |
| 10629 | GET | `/technical/api/stores/item/:id/history` | `getStoresItemHistory` | NO |
| 10639 | POST | `/technical/api/stores/:vesselId/create` | `createStoresItem` | NO |
| 10660 | PUT | `/technical/api/stores/item/:id` | `updateStoresItem` | NO |
| 10682 | POST | `/technical/api/stores/item/:id/adjust` | `adjustStoresItem` | YES — adjustment validation |
| 10713 | PATCH | `/technical/api/stores/:vesselId/:id` | `consumeStoresItem`, `receiveStoresItem`, `transferStoresItemLocation`, `adjustStoresItem` | YES — 70 lines: action routing (consume/receive/transfer/adjust) |
| 10783 | DELETE | `/technical/api/stores/item/:id` | `deleteStoresItem` | NO |
| 10794 | POST | `/technical/api/stores/:vesselId/batch-consume` | `consumeStoresItem` | YES — batch loop |
| 10828 | POST | `/technical/api/stores/:vesselId/batch-receive` | `receiveStoresItem` | YES — batch loop |
| 10863 | GET | `/technical/api/reports/:reportType` | `getStoresItems` + inline | YES — 75 lines: IHM report generation |

### 2.10 Defects (27 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 5777 | GET | `/technical/api/defects` | `getDefects` | NO |
| 5803 | GET | `/technical/api/defects/coc` | `getDefects` | YES — COC filter |
| 5825 | GET | `/technical/api/defects/recurring` | `getRecurringDefects` | NO |
| 5842 | GET | `/technical/api/defects/count` | `getDefectsCount` | NO |
| 5866 | GET | `/technical/api/defects/count/recurring` | `getRecurringDefects` | YES — count computation |
| 5876 | GET | `/technical/api/defects/:id` | `getDefect` | NO |
| 5889 | POST | `/technical/api/defects` | `createDefect` | YES — validation |
| 5918 | PATCH | `/technical/api/defects/:id` | `updateDefect` | NO |
| 5936 | DELETE | `/technical/api/defects/:id` | `deleteDefect` | NO |
| 5949 | DELETE | `/technical/api/defects-clear-all` | Direct Drizzle | YES — dev/test only |
| 5957 | POST | `/technical/api/defects-seed-e2e-test` | Direct Drizzle | YES — dev/test only |
| 5965 | GET | `/technical/api/defects-count` | Direct Drizzle | YES — direct count query |
| 5980 | GET | `/technical/api/defects/:defectId/actions` | `getDefectActions` | NO |
| 5990 | POST | `/technical/api/defects/:defectId/actions` | `createDefectAction` | NO |
| 6008 | PATCH | `/technical/api/defects/actions/:actionId` | `updateDefectAction` | NO |
| 6026 | DELETE | `/technical/api/defects/actions/:actionId` | `deleteDefectAction` | NO |
| 6039 | GET | `/technical/api/defects/:defectId/attachments` | `getDefectAttachments` | NO |
| 6049 | POST | `/technical/api/defects/:defectId/attachments` | `createDefectAttachment` | NO |
| 6067 | DELETE | `/technical/api/defects/attachments/:attachmentId` | `deleteDefectAttachment` | NO |
| 6080 | POST | `/technical/api/defects/:id/notes` | `addDefectNote` | NO |
| 6104 | PATCH | `/technical/api/defects/:id/link` | `linkDefects` | NO |
| 6120 | PATCH | `/technical/api/defects/:id/close` | `closeDefect` | YES — closure validation |
| 6154 | POST | `/technical/api/defects/reports/:reportKey` | Direct Drizzle + ExcelJS | YES — 130 lines: report generation |
| 6287 | GET | `/technical/api/equipment-categories` | Direct Drizzle | YES — direct query |
| 6299 | POST | `/technical/api/equipment-categories` | Direct Drizzle | YES — direct insert |
| 6325 | PATCH | `/technical/api/equipment-categories/:id` | Direct Drizzle | YES — direct update |
| 6362 | DELETE | `/technical/api/equipment-categories/:id` | Direct Drizzle | YES — usage check |
| 6381 | GET | `/technical/api/defect-categories` | Direct Drizzle | YES — direct query |
| 6393 | POST | `/technical/api/defect-categories` | Direct Drizzle | YES — direct insert |
| 6419 | PATCH | `/technical/api/defect-categories/:id` | Direct Drizzle | YES — direct update |
| 6456 | DELETE | `/technical/api/defect-categories/:id` | Direct Drizzle | YES — usage check |
| 6475 | GET | `/technical/api/defect-types` | Direct Drizzle | YES — direct query |
| 6487 | POST | `/technical/api/defect-types` | Direct Drizzle | YES — direct insert |
| 6513 | PATCH | `/technical/api/defect-types/:id` | Direct Drizzle | YES — direct update |
| 6550 | DELETE | `/technical/api/defect-types/:id` | Direct Drizzle | YES — usage check |
| 12057 | GET | `/technical/api/recurring-defects` | `getRecurringDefects` | NO |
| 12101 | GET | `/technical/api/recurring-defects/:id` | `getRecurringDefect` | NO |
| 12115 | GET | `/technical/api/recurring-defects/:id/defects` | `getDefectsForRecurring` | NO |
| 12126 | POST | `/technical/api/recurring-defects/recalculate` | `recalculateAllRecurringDefects` | NO |

### 2.11 Certificates & Surveys (21 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 14169 | GET | `/technical/api/certificates` | Direct Drizzle (6+ tables) | YES — 210 lines: complex joins, master+data+applicability merge |
| 14382 | GET | `/technical/api/certificates/:id` | Direct Drizzle | YES — 75 lines: multi-table lookup |
| 14458 | PATCH | `/technical/api/certificates/:id` | Direct Drizzle | YES — 185 lines: upsert across multiple tables |
| 14646 | GET | `/technical/api/surveys` | Direct Drizzle (6+ tables) | YES — 190 lines: complex joins |
| 14837 | GET | `/technical/api/surveys/:id` | Direct Drizzle | YES |
| 14852 | PATCH | `/technical/api/surveys/:id` | Direct Drizzle | YES — 95 lines: multi-table upsert |
| 14950 | POST | `/technical/api/surveys` | `createSurvey` | NO |
| 14965 | GET | `/technical/api/admin/ship-certificates-master` | Direct Drizzle | YES |
| 14983 | POST | `/technical/api/admin/ship-certificates-master` | Direct Drizzle | YES — 200 lines: batch create/update |
| 15183 | DELETE | `/technical/api/admin/ship-certificates-master/:masterId` | Direct Drizzle | YES — cascade delete |
| 15219 | GET | `/technical/api/admin/ship-certificates-labels` | Direct Drizzle | NO |
| 15246 | POST | `/technical/api/admin/ship-certificates-labels` | Direct Drizzle | YES — batch upsert |
| 15289 | GET | `/technical/api/admin/vessel-certificate-applicability` | Direct Drizzle | YES — joins |
| 15325 | POST | `/technical/api/admin/vessel-certificate-applicability/initialize` | Direct Drizzle | YES — batch init |
| 15379 | PATCH | `/technical/api/admin/vessel-certificate-applicability` | Direct Drizzle | YES |
| 15429 | POST | `/technical/api/admin/vessel-certificate-applicability/bulk-update` | Direct Drizzle | YES — batch |
| 15484 | GET | `/technical/api/admin/ship-surveys-master` | Direct Drizzle | YES |
| 15502 | POST | `/technical/api/admin/ship-surveys-master` | Direct Drizzle | YES — 170 lines: batch create/update |
| 15671 | DELETE | `/technical/api/admin/ship-surveys-master/:masterId` | Direct Drizzle | YES — cascade delete |
| 15698 | GET | `/technical/api/admin/ship-surveys-labels` | Direct Drizzle | NO |
| 15725 | POST | `/technical/api/admin/ship-surveys-labels` | Direct Drizzle | YES — batch upsert |
| 15770 | GET | `/technical/api/admin/vessel-survey-applicability` | Direct Drizzle | YES — joins |
| 15804 | POST | `/technical/api/admin/vessel-survey-applicability/initialize` | Direct Drizzle | YES — batch init |
| 15858 | POST | `/technical/api/admin/vessel-survey-applicability/bulk-update` | Direct Drizzle | YES — batch |

### 2.12 Fleet Admin (31 endpoints in routes.ts)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 12283 | GET | `/technical/api/fleet/components` | `getFleetComponents` | NO |
| 12294 | GET | `/technical/api/fleet/components/:id` | `getFleetComponent` | NO |
| 12308 | POST | `/technical/api/fleet/components` | `createFleetComponent` | YES — validation |
| 12326 | PATCH | `/technical/api/fleet/components/:id` | `updateFleetComponent` | YES — validation |
| 12348 | DELETE | `/technical/api/fleet/components/:id` | `deleteFleetComponent` | NO |
| 12365 | POST | `/technical/api/fleet/components/sort-order` | Direct Drizzle | YES — batch sort |
| 12395 | GET | `/technical/api/fleet/jobs/export` | `getFleetJobs` | YES — Excel export |
| 12457 | GET | `/technical/api/fleet/jobs` | `getFleetJobs` | NO |
| 12468 | GET | `/technical/api/fleet/jobs/:id` | `getFleetJob` | NO |
| 12482 | POST | `/technical/api/fleet/jobs` | `createFleetJob` | YES — validation |
| 12500 | PATCH | `/technical/api/fleet/jobs/:id` | `updateFleetJob` | YES — 75 lines: cascade global field updates |
| 12578 | DELETE | `/technical/api/fleet/jobs/:id` | `deleteFleetJob` | NO |
| 12598 | GET | `/technical/api/fleet/spares/export` | `getFleetSparesFromTable` | YES — Excel export |
| 12656 | GET | `/technical/api/fleet/spares` | `getFleetSparesFromTable` | NO |
| 12667 | GET | `/technical/api/fleet/spares/:id` | `getFleetSpareFromTable` | NO |
| 12681 | POST | `/technical/api/fleet/spares` | `createFleetSpareInTable` | NO |
| 12696 | PATCH | `/technical/api/fleet/spares/:id` | `updateFleetSpareInTable` | NO |
| 12715 | DELETE | `/technical/api/fleet/spares/:id` | `deleteFleetSpareFromTable` | NO |
| 12731 | GET | `/technical/api/fleet/makers` | `getMakerList` | NO |
| 12743 | GET | `/technical/api/fleet/makers/:id` | `getMakerListItem` | NO |
| 12757 | POST | `/technical/api/fleet/makers` | `createMakerListItem` | YES — auto-code generation |
| 12788 | PUT | `/technical/api/fleet/makers/:id` | `updateMakerListItem` | NO |
| 12813 | DELETE | `/technical/api/fleet/makers/:id` | `deleteMakerListItem` | NO |
| 12829 | GET | `/technical/api/fleet/master-lists` | `getMasterLists` | NO |
| 12841 | GET | `/technical/api/fleet/master-lists/:id` | `getMasterListById` | NO |
| 12855 | POST | `/technical/api/fleet/master-lists` | `createMasterList` | NO |
| 12870 | PUT | `/technical/api/fleet/master-lists/:id` | `updateMasterList` | NO |
| 12889 | DELETE | `/technical/api/fleet/master-lists/:id` | `deleteMasterList` | NO |
| 12907 | GET | `/technical/api/fleet/vessel-mappings` | `getFleetVesselMappings` | NO |
| 12918 | POST | `/technical/api/fleet/vessel-mappings` | `createFleetVesselMappings` | YES — batch create |
| 12943 | DELETE | `/technical/api/fleet/vessel-mappings/:id` | `deleteFleetVesselMapping` | NO |

### 2.13 Reports (43 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 4564 | GET | `/technical/api/reports/critical-spares/preview` | Direct Drizzle | YES — 225 lines: multi-table aggregation |
| 4788 | POST | `/technical/api/reports/critical-spares` | Direct Drizzle + ExcelJS | YES — 280 lines: Excel generation |
| 5069 | GET | `/technical/api/reports/critical-equipment-status` | `getComponents`, `getJobs`, `getWorkOrders` | YES — 140 lines: aggregation |
| 5207 | POST | `/technical/api/reports/critical-equipment-status/excel` | Same + ExcelJS | YES — 230 lines |
| 5436 | GET | `/technical/api/reports/unplanned-breakdown-jobs` | `getWorkOrders` | YES — 140 lines: filtering + aggregation |
| 5577 | POST | `/technical/api/reports/unplanned-breakdown-jobs/excel` | Same + ExcelJS | YES — 200 lines |
| 7403 | GET | `/technical/api/reports/low-stock-alert/:vesselId` | `getSpares` | YES — 88 lines: low stock computation |
| 7491 | PATCH | `/technical/api/reports/low-stock-alert/:vesselId/mark-ordered/:spareId` | `updateSpare` | NO |
| 7505 | POST | `/technical/api/reports/low-stock-alert/:vesselId/excel` | `getSpares` + ExcelJS | YES — 145 lines |
| 7651 | POST | `/technical/api/reports/stores-inventory-status/:vesselId/excel` | `getStoresItems` + ExcelJS | YES — 255 lines |
| 7908 | GET | `/technical/api/reports/stores-consumption-analysis/:vesselId` | Direct Drizzle | YES — 340 lines: complex aggregation |
| 8251 | POST | `/technical/api/reports/stores-consumption-analysis/:vesselId/excel` | Same + ExcelJS | YES — 400 lines |
| 8655 | GET | `/technical/api/reports/spares-consumption-analysis/:vesselId` | Direct Drizzle | YES — 335 lines |
| 8990 | POST | `/technical/api/reports/spares-consumption-analysis/:vesselId/excel` | Same + ExcelJS | YES — 390 lines |
| 9382 | GET | `/technical/api/reports/consumption-analysis/:vesselId` | (combined) | YES — 82 lines |
| 9465 | POST | `/technical/api/reports/consumption-analysis/:vesselId/excel` | (combined) + ExcelJS | YES — 155 lines |
| 10290 | GET | `/technical/api/reports/chemicals-expiry/:vesselId` | `getStoresItems` | YES — 100 lines: expiry computation |
| 10390 | GET | `/technical/api/reports/stores-low-stock-alert/:vesselId` | `getStoresItems` | YES — 45 lines |
| 10435 | POST | `/technical/api/reports/stores-low-stock-alert/:vesselId/excel` | Same + ExcelJS | YES — 95 lines |
| 10531 | GET | `/technical/api/reports/snapshots/:vesselId` | Direct Drizzle | NO |
| 10549 | GET | `/technical/api/reports/snapshots/detail/:snapshotId` | Direct Drizzle | NO |
| 10863 | GET | `/technical/api/reports/:reportType` | `getStoresItems` | YES — 75 lines: IHM report |
| 10981 | GET | `/technical/api/reports/change-requests-status-tracking` | Direct Drizzle | YES — 170 lines |
| 11148 | GET | `/technical/api/reports/change-requests-status-tracking/export` | Same + ExcelJS | YES — 140 lines |
| 11314 | GET | `/technical/api/reports/critical-components-list` | `getComponents` | YES — 130 lines |
| 11443 | GET | `/technical/api/reports/lsa-ffa-master-list` | `getComponents` | YES — 110 lines |
| 11555 | GET | `/technical/api/reports/lsa-ffa-maintenance-schedule` | Direct Drizzle | YES — 245 lines |
| 11802 | GET | `/technical/api/reports/critical-equipment-schedule` | Direct Drizzle | YES — 255 lines |
| 15913 | POST | `/technical/api/reports/due-jobs-7-days` | Direct Drizzle + ExcelJS | YES — 390 lines |
| 16303 | POST | `/technical/api/reports/overdue-jobs` | Direct Drizzle + ExcelJS | YES — 350 lines |
| 16653 | POST | `/technical/api/reports/completed-jobs` | Direct Drizzle + ExcelJS | YES — 360 lines |
| 17012 | POST | `/technical/api/reports/unplanned-jobs` | Direct Drizzle + ExcelJS | YES — 180 lines |
| 17193 | POST | `/technical/api/reports/postponement-log` | `getWorkOrderPostponements` + ExcelJS | YES — 295 lines |
| 17576 | POST | `/technical/api/reports/maintenance/monthly-summary/excel` | Direct Drizzle + ExcelJS | YES — 670 lines: the largest single handler |
| 18246 | GET | `/technical/api/reports/crew-workload-distribution` | Direct Drizzle | YES — 210 lines |
| 18454 | POST | `/technical/api/reports/crew-workload-distribution/excel` | Same + ExcelJS | YES — 340 lines |
| 18792 | GET | `/technical/api/reports/equipment-utilization-summary` | Direct Drizzle | YES — 230 lines |
| 19020 | POST | `/technical/api/reports/equipment-utilization-summary/excel` | Same + ExcelJS | YES — 325 lines |
| 19346 | GET | `/technical/api/reports/running-hours-anomaly-detection` | Direct Drizzle | YES — 245 lines |
| 19592 | POST | `/technical/api/reports/running-hours-anomaly-detection/excel` | Same + ExcelJS | YES — 320 lines |
| 19910 | GET | `/technical/api/reports/ihm-inventory-status` | Direct Drizzle | YES — 210 lines |
| 20117 | POST | `/technical/api/reports/ihm-inventory-status/excel` | Same + ExcelJS | YES — 200+ lines |
| 6154 | POST | `/technical/api/defects/reports/:reportKey` | Direct Drizzle + ExcelJS | YES — 130 lines |

### 2.14 Misc (23 endpoints)

| Line | Method | Path | Storage Methods | Inline Logic |
|------|--------|------|----------------|--------------|
| 89 | GET | `/download/docs/:filename` | None (static file) | YES — file serving |
| 10938 | GET | `/technical/api/me` | None | YES — returns auth user |
| 10949 | GET | `/technical/api/users` | `getUsers` | NO |
| 6594 | GET | `/technical/api/test-new-endpoint` | None | NO — test stub |
| 6599 | GET | `/technical/api/debug/jobs` | `getJobs` | YES — debug tool |
| 13137 | GET | `/technical/api/pms-vessel-settings` | `getAllPmsVesselSettings` | NO |
| 13148 | POST | `/technical/api/pms-vessel-settings` | `createOrUpdatePmsVesselSettings` | YES — upsert logic |
| 13175 | GET | `/technical/api/pms-vessel-settings/:vesselId` | `getPmsVesselSettings` | NO |
| 13189 | PUT | `/technical/api/pms-vessel-settings/:vesselId` | `updatePmsVesselSettings` | YES — field validation |
| 13218 | DELETE | `/technical/api/pms-vessel-settings/:vesselId` | `deletePmsVesselSettings` | NO |
| 13247 | GET | `/technical/api/vessel-location-names/:vesselId` | `getPmsVesselSettings` | YES — extracts location names |
| 13262 | PUT | `/technical/api/vessel-location-names/:vesselId` | `updatePmsVesselSettings` | YES — merges location names |
| 13374 | POST | `/technical/api/upload-document` | None (S3/local) | YES — file upload to storage |
| 13423 | GET | `/technical/api/documents/:fileKey(*)` | None (S3/local) | YES — file serving |
| 13455 | DELETE | `/technical/api/documents/:fileKey(*)` | None (S3/local) | YES — file deletion |
| 13478 | GET | `/technical/api/admin/job-due-scan` | via jobDueScanner | YES — returns scan status |
| 13510 | POST | `/technical/api/admin/job-due-scan` | via jobDueScanner | YES — manual trigger |
| 13543 | POST | `/technical/api/admin/purge-jobs` | `purgeJobsAndLinkedData` | YES — cascade purge |
| 13598 | POST | `/technical/api/admin/migrate-inventory` | Direct Drizzle | YES — 155 lines: one-time migration |
| 13755 | POST | `/technical/api/admin/sync-work-order-status` | `getWorkOrders`, `updateWorkOrder` | YES — 150 lines: bulk status sync |
| 13907 | POST | `/technical/api/admin/sync-masters` | Direct Drizzle | YES — 260 lines: master data sync |
| 11291 | GET | `/technical/api/template-builder/:templateType` | `getJobs`, `getComponents` | YES — builds templates |
| 17488 | POST | `/technical/api/admin/populate-postponement-history` | `createWorkOrderPostponement` | YES — 85 lines: one-time migration |

### 2.15 Router Mounts (6 mounts)

| Line | Mount Path | Router File | Endpoints |
|------|-----------|-------------|-----------|
| 10959 | (inline) | `server/routes/chatbot.ts` | 1 |
| 10962 | `/technical/api/bulk` | `server/routes/bulk.ts` | 26 |
| 10965 | `/technical/api/alerts` | `server/routes/alerts.ts` | 10 |
| 10968 | `/technical/api/forms` | `server/routes/forms.ts` | 10 |
| 10971 | `/technical/api/fleet-admin` | `server/routes/fleetAdmin.ts` | 46 |
| 10975 | `/technical/api/change-requests` | `server/routes/changeRequests.ts` | 12 |

---

## 3. Cross-Module Dependency Graph

```
                    ┌─────────────┐
                    │   Vessels    │◄────────────────────────────┐
                    └──────┬──────┘                              │
                           │                                     │
                    ┌──────▼──────┐                              │
                    │   Fleets    │                              │
                    └─────────────┘                              │
                                                                 │
┌──────────────────────────────────────────────────────────┐     │
│                    CORE MODULES                          │     │
│                                                          │     │
│  ┌─────────────┐     ┌─────────────┐                     │     │
│  │ Components  │◄───►│    Jobs     │                     │     │
│  └──────┬──────┘     └──────┬──────┘                     │     │
│         │                   │                            │     │
│         │            ┌──────▼──────┐                     │     │
│         │            │ Work Orders │────► Running Hours   │     │
│         │            └──────┬──────┘                     │     │
│         │                   │                            │     │
│  ┌──────▼──────┐     ┌─────┴───────┐                     │     │
│  │   Spares    │◄───►│  Inventory  │                     │     │
│  └─────────────┘     └─────────────┘                     │     │
│                                                          │     │
│  ┌─────────────┐     ┌─────────────┐                     │     │
│  │   Stores    │     │   Defects   │─────────────────────┼─────┘
│  └─────────────┘     └─────────────┘                     │
│                                                          │
│  ┌─────────────┐     ┌─────────────────────────┐         │
│  │ Certs/Surv  │     │ Running Hours           │         │
│  └─────────────┘     └─────────────────────────┘         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    CROSS-CUTTING                         │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Reports   │  │ Bulk Upload │  │ Fleet Admin  │      │
│  │ (reads ALL) │  │(writes ALL) │  │ (own tables) │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Change Req  │  │   Alerts    │  │   Forms     │      │
│  │(writes 5+)  │  │ (isolated)  │  │ (isolated)  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└──────────────────────────────────────────────────────────┘
```

### Dependency Details Per Module

| Module | Depends On | Depended On By |
|--------|-----------|---------------|
| **Vessels** | None | Fleets, Defects, Certs/Surveys, Reports, all modules (vesselId FK) |
| **Fleets** | Vessels | Fleet Admin |
| **Components** | None (core entity) | Jobs, Spares, Running Hours, Work Orders, Reports, Defects |
| **Jobs** | Components (job_component_links) | Work Orders, Reports |
| **Work Orders** | Jobs, Components, Running Hours, PMS Settings | Reports |
| **Running Hours** | Components | Work Orders |
| **Spares** | Inventory (spare_location_stock, locations) | Reports, Bulk Upload |
| **Inventory** | Spares, Locations, Components (spare_component_links) | Reports |
| **Stores** | None (self-contained with stores_ledger) | Reports |
| **Defects** | Vessels (sequence generation) | Reports |
| **Certificates & Surveys** | Vessels | Reports |
| **Fleet Admin** | Own tables (fleet_*) | Bulk Upload |
| **Reports** | ALL modules (read-only) | None |
| **Change Requests** | Components, Jobs, Work Orders, Spares, Stores (write on approve) | None |
| **Bulk Upload** | Components, Jobs, Spares, Stores, Fleet Admin (write) | None |
| **Alerts** | None | None |
| **Forms** | None | None |
| **Chatbot** | ALL modules (read-only via service) | None |

---

## 4. Already-Separated Code Inventory

### 4.1 Route Files (Already Extracted)

| File | Lines | Endpoints | Module | Notes |
|------|-------|-----------|--------|-------|
| `server/routes/alerts.ts` | 202 | 10 | Alerts | Clean separation, uses storage abstraction |
| `server/routes/bulk.ts` | 7,620 | 26 | Bulk Upload | Very large! Covers import/export for Components, Jobs, Spares, Stores, Fleet Admin. Includes Makers + SFI Details CRUD. |
| `server/routes/forms.ts` | 255 | 10 | Forms | Clean separation, uses storage abstraction |
| `server/routes/fleetAdmin.ts` | 1,375 | 46 | Fleet Admin | Good separation. Has some direct `getDb()` calls for dashboard + copy-vessel. |
| `server/routes/changeRequests.ts` | 319 | 12 | Change Requests | Good separation. Uses IStorage interface injection. |
| `server/routes/chatbot.ts` | 62 | 1 | Chatbot | Thin wrapper around chatbotService |
| `server/runningHoursRoutes.ts` | 622 | 10 | Running Hours | Good separation. Uses storage + rhValidation utils. |

### 4.2 Service Files

| File | Lines | Module | Purpose | Dependencies |
|------|-------|--------|---------|-------------|
| `server/services/index.ts` | 19 | All | Barrel re-export | All services |
| `server/services/chatbotService.ts` | 3,103 | Chatbot | AI chatbot with OpenAI | ALL modules (read-only), direct `getDb()` |
| `server/services/componentService.ts` | 221 | Components | CRUD + hierarchy mgmt | storage.components |
| `server/services/jobService.ts` | 281 | Jobs | CRUD + validation | storage.jobs |
| `server/services/workOrderService.ts` | 498 | Work Orders | Lifecycle management | storage.workOrders, jobs, components |
| `server/services/runningHoursService.ts` | 120 | Running Hours | RH CRUD + cascade | storage.runningHoursAudits, cascadeRH |
| `server/services/jobDueScanner.ts` | 730 | Jobs/WO | Auto-generate WOs on due | storage.jobs, workOrders |
| `server/services/workOrderStatusRecalculator.ts` | 235 | Work Orders | Scheduled status recalc | storage.workOrders, vessels, PMS settings |
| `server/services/lowStockReportService.ts` | 254 | Stores/Reports | Low stock reporting | Direct `getDb()`, stores_ledger, reportSnapshots |
| `server/services/fileBasedImportHistory.ts` | 140 | Misc (Import) | File-based import history | Filesystem only |

### 4.3 Utility Files

| File | Lines | Module | Purpose |
|------|-------|--------|---------|
| `server/utils/codeGeneration.ts` | 136 | Components | Auto-generate component codes |
| `server/utils/defectNumbering.ts` | 65 | Defects | Auto-generate defect IDs |
| `server/utils/rhValidation.ts` | 118 | Running Hours | RH input validation |
| `server/utils/sfiLookup.ts` | 127 | Fleet Admin | SFI code lookup |
| `server/utils/workOrderNumbering.ts` | 201 | Work Orders | WO number generation |
| `server/utils/workOrderStatus.ts` | 299 | Work Orders | WO status computation |
| `shared/dateUtils.ts` | 196 | Shared | Date calculation utilities |
| `shared/changeRequestFields.ts` | 173 | Change Requests | Field definitions |
| `shared/changeRequestFieldLabels.ts` | 153 | Change Requests | Field labels |
| `shared/changeRequestSchema.ts` | 48 | Change Requests | Validation schema |
| `shared/defectStatus.ts` | 59 | Defects | Status constants |
| `shared/sparesTemplateFields.ts` | 90 | Spares/Bulk | Template field definitions |
| `shared/uiRoles.ts` | 18 | Auth | Role constants |

---

## 5. Schema Inventory (64 tables)

### 5.1 Tables by Module

| Module | Tables | Total Columns |
|--------|--------|:---:|
| **Users** | `users` | 10 |
| **Vessels** | `vessels`, `pmsVesselSettings` | 12+12 = 24 |
| **Fleets** | `fleets`, `fleetVesselMapping` | 7+7 = 14 |
| **Components** | `components`, `componentDocuments`, `componentClassRegulatory`, `componentMaintenanceHistory`, `componentRequisitions` | 48+14+15+17+22 = 116 |
| **Jobs** | `jobs`, `jobComponentLinks` | 35+9 = 44 |
| **Work Orders** | `workOrders`, `workOrderExecutions`, `workOrderExecutionDetails`, `workOrderPostponements` | 72+14+14+16 = 116 |
| **Running Hours** | `runningHoursAudit`, `componentRunningHoursLog` | 12+10 = 22 |
| **Spares** | `spares`, `sparesHistory` | 38+10 = 48 |
| **Inventory** | `locations`, `spareComponentLinks`, `spareLocationStock`, `inventoryTransactions` | 5+5+5+14 = 29 |
| **Stores** | `storesItems`, `storesLedger` | 24+12 = 36 |
| **Defects** | `defects`, `defectActions`, `defectAttachments`, `defectCategories`, `defectTypes`, `defectSequences`, `equipmentCategories`, `recurringDefects`, `recurringDefectLinks` | 82+11+6+5+5+4+5+9+2 = 129 |
| **Certificates** | `certificates`, `shipCertificatesMaster`, `shipCertificatesLabelsConfig`, `vesselCertificateApplicability`, `vesselCertificateData` | 14+14+5+6+10 = 49 |
| **Surveys** | `surveys`, `shipSurveysMaster`, `shipSurveysLabelsConfig`, `vesselSurveyApplicability`, `vesselSurveyData` | 14+13+5+6+10 = 48 |
| **Fleet Admin** | `fleetComponents`, `fleetJobs`, `fleetSpares`, `fleetComponentMapping`, `fleetJobVesselMapping`, `fleetSpareVesselMapping`, `makers`, `makerList`, `masterLists`, `sfiDetails`, `masterData`, `bulkImportHistory`, `bulkImportErrors` | ~170 |
| **Reports** | `reportSnapshots` | 8 |
| **Change Requests** | `changeRequest`, `changeRequestAttachment`, `changeRequestComment` | 15+5+4 = 24 |
| **Alerts** | `alertPolicies`, `alertEvents`, `alertDeliveries`, `alertConfig` | 12+12+8+9 = 41 |
| **Forms** | `formDefinitions`, `formVersions`, `formVersionUsage` | 7+10+5 = 22 |
| **Misc** | `auditLog`, `importHistory`, `importChangeLog`, `ihmItems`, `ihmMaintenanceLog`, `schemaMigrations` | ~60 |

### 5.2 Key Foreign Key Relationships

```
vessels ◄─── components (vesselId)
vessels ◄─── jobs (vesselId)
vessels ◄─── workOrders (vesselId)
vessels ◄─── spares (vesselId)
vessels ◄─── defects (vesselId)
vessels ◄─── certificates (vesselId)
vessels ◄─── surveys (vesselId)

components ◄─── jobComponentLinks (componentId)
jobs ◄──────── jobComponentLinks (jobId)
jobs ◄──────── workOrders (jobId)

spares ◄────── spareComponentLinks (spareId)
components ◄── spareComponentLinks (componentId)
spares ◄────── spareLocationStock (spareId)
locations ◄─── spareLocationStock (locationId)

defects ◄───── defectActions (defectId)
defects ◄───── defectAttachments (defectId)
defects ◄───── recurringDefectLinks (defectId)
recurringDefects ◄── recurringDefectLinks (recurringId)

workOrders ◄── workOrderExecutions (templateId)
workOrders ◄── workOrderExecutionDetails (workOrderId)
workOrders ◄── workOrderPostponements (workOrderId)

shipCertificatesMaster ◄── vesselCertificateApplicability (masterId)
shipCertificatesMaster ◄── vesselCertificateData (masterId)
shipSurveysMaster ◄────── vesselSurveyApplicability (masterId)
shipSurveysMaster ◄────── vesselSurveyData (masterId)

fleetComponents ◄── fleetJobs (fleetComponentsUuid)
fleetComponents ◄── fleetSpares (fleetComponentsUuid)
fleetComponents ◄── fleetComponentMapping (fleetEquipmentCode)
```

---

## 6. Recommended Refactoring Order

Based on the dependency analysis, modules should be extracted in order from **least dependent** to **most dependent**. Leaf modules with zero cross-module dependencies first.

### Phase 1: Isolated Modules (No Cross-Module Dependencies)
These can be extracted in any order, or in parallel:

| Order | Module | Endpoints | Rationale |
|:---:|--------|:---:|---------|
| 1 | **Alerts** | 10 | Already separated. Zero dependencies. Move to module structure. |
| 2 | **Forms** | 10 | Already separated. Zero dependencies. Move to module structure. |
| 3 | **Stores** | 12 | Self-contained with internal ledger. No external dependencies. |
| 4 | **Defects** | 27 | Only depends on Vessels (for sequence gen). Mostly self-contained. |

### Phase 2: Core Entity Modules (Foundation)
These are depended on by many other modules, but have limited outgoing dependencies:

| Order | Module | Endpoints | Rationale |
|:---:|--------|:---:|---------|
| 5 | **Vessels** | 4 | Core entity. Depended on by nearly everything, but has no deps itself. |
| 6 | **Fleets** | 7 | Depends only on Vessels. |
| 7 | **Components** | 21 | Core entity. Depended on by Jobs, Spares, Work Orders. |
| 8 | **Running Hours** | 13 | Depends on Components. Already partially separated. |

### Phase 3: Business Logic Modules (Build on Core Entities)
These have significant cross-module dependencies:

| Order | Module | Endpoints | Rationale |
|:---:|--------|:---:|---------|
| 9 | **Jobs** | 9 | Depends on Components. Depended on by Work Orders. |
| 10 | **Spares** | 16 | Depends on Inventory/Locations. |
| 11 | **Inventory** | 17 | Depends on Spares, Locations, Components. |
| 12 | **Work Orders** | 18 | Depends on Jobs, Components, Running Hours, PMS Settings. Most complex module. |
| 13 | **Certificates & Surveys** | 21 | Mostly isolated but uses Direct Drizzle (needs storage method creation). |

### Phase 4: Cross-Cutting Modules
These depend on many modules and should be extracted last:

| Order | Module | Endpoints | Rationale |
|:---:|--------|:---:|---------|
| 14 | **Fleet Admin** | 77 | Already partially separated. Depends on own tables + Makers/MasterLists. |
| 15 | **Change Requests** | 12 | Already separated. Writes to 5+ module tables on approve. |
| 16 | **Reports** | 43 | Reads from ALL modules. Heaviest inline logic. Extract last. |
| 17 | **Bulk Upload** | 26 | Writes to ALL modules. Already separated but oversized. |
| 18 | **Misc/Admin** | 23 | Cleanup pass: PMS settings, documents, admin utils. |

### Critical Path Notes

1. **Work Orders (order 12)** is the hardest extraction due to 640-line and 510-line inline handlers with cascade logic touching Jobs, Components, Running Hours, and Maintenance History.

2. **Reports (order 16)** has 43 endpoints averaging 200+ lines each of inline ExcelJS generation. These read from all modules but never write, making them safe to extract late. The key decision is whether report generation logic lives in each module or in a dedicated Reports module.

3. **Bulk Upload (order 17)** at 7,620 lines is the largest separated file. It writes to Components, Jobs, Spares, Stores, and Fleet Admin tables. Consider splitting into per-module bulk handlers during extraction.

4. **Certificates & Surveys (order 13)** almost entirely bypass the `storage.*` abstraction and use Direct Drizzle queries. Extraction requires creating proper repository methods first.

---

## 7. File Size Summary

### Current Backend Code Distribution

| Category | Files | Total Lines |
|----------|:---:|:---:|
| **Main routes (monolithic)** | 1 | 21,144 |
| **Storage (monolithic)** | 1 | 7,501 |
| **Schema** | 1 | 2,826 |
| **Already-separated routes** | 7 | 10,455 |
| **Services** | 10 | 5,601 |
| **Utilities** | 13 | 1,683 |
| **TOTAL** | 33 | **49,210** |

### Monolithic Code to Extract

- `server/routes.ts`: **21,144 lines** (232 endpoints) -> target: 0 lines
- `server/postgresStorage.ts`: **7,501 lines** (382 methods) -> target: 0 lines
- **Total to refactor**: ~28,645 lines

---

*End of Analysis Report*
