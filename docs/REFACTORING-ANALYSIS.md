# Refactoring Analysis Report

**Generated:** 2026-03-18
**Branch:** `refactor/modular-architecture`
**Codebase:** Maritime PMS (Planned Maintenance System)

---

## 1. Executive Summary

| Metric | Count |
|--------|------:|
| Endpoints in `server/routes.ts` | 277 |
| Storage methods in `server/postgresStorage.ts` | 387 |
| Database tables in `shared/schema.ts` | 51 |
| Already-separated route files | 7 |
| Service files in `server/services/` | 10 |
| Total lines: routes.ts | ~21,144 |
| Total lines: postgresStorage.ts | ~7,501 |

---

## 2. Module Summary Table

| # | Module | Endpoints | Storage Methods | Tables | Complexity | Dependencies | Already Separated? |
|---|--------|:---------:|:---------------:|:------:|:----------:|:-------------|:------------------:|
| 1 | **Vessels** | 4 | 7 | 2 (vessels, fleets) | Low | None | No |
| 2 | **Fleets** | 3 | 6 | 2 (fleets, vessels) | Low | Vessels | No |
| 3 | **Components** | 29 | 50 | 8 | High | Vessels, Running Hours | Partial (componentService.ts) |
| 4 | **Jobs** | 10 | 12 | 2 (jobs, jobComponentLinks) | High | Components, Work Orders, Vessels | Partial (jobService.ts) |
| 5 | **Work Orders** | 17 | 25 | 4 | Very High | Jobs, Components, RH, Spares, Vessels | Partial (workOrderService.ts) |
| 6 | **Running Hours** | 10+ | 8 (in components) | 2 (runningHoursAudit, componentRHLog) | High | Components, Jobs, Work Orders | Yes (runningHoursRoutes.ts, runningHoursService.ts) |
| 7 | **Spares** | 19 | 42 | 5 (spares, sparesHistory, spareComponentLinks, spareLocationStock, fleetSpares) | High | Components, Inventory, Vessels | No |
| 8 | **Inventory** | 20 | 30 | 3 (inventoryTransactions, spareLocationStock, locations) | High | Spares, Components, Locations | No |
| 9 | **Stores** | 10 | 17 | 2 (storesItems, storesLedger) | Medium | Vessels | No |
| 10 | **Defects** | 32 | 31 | 6 | High | Components, Vessels | No |
| 11 | **Certificates & Surveys** | 26 | 12 | 8 | Medium | Vessels | No |
| 12 | **Fleet Admin** | 21+ | 34 | 12 (fleet*, master*, makers, sfi) | High | Components, Jobs, Spares, Vessels | Yes (fleetAdmin.ts) |
| 13 | **Reports** | 38 | 0 (inline) | 0 (reads from all) | Very High | ALL modules (read-only) | No |
| 14 | **Change Requests** | 11 | 25+ | 3 | High | Components, Jobs, WO, Spares, Stores | Yes (changeRequests.ts) |
| 15 | **Bulk Upload** | 10+ | 15 | 4 (importHistory, importChangeLog, bulkImportHistory, bulkImportErrors) | Very High | Components, Jobs, Spares, Stores, Makers | Yes (bulk.ts) |
| 16 | **Alerts** | 10 | 14 | 4 | Low | Vessels | Yes (alerts.ts) |
| 17 | **Forms** | 10 | 15 | 3 | Low | None | Yes (forms.ts) |
| 18 | **Chatbot** | 1 | 0 | 0 | Low | All (read-only) | Yes (chatbot.ts) |
| 19 | **Misc/Admin** | 25+ | 20+ | 5+ (users, pmsVesselSettings, equipmentCategories, auditLog, etc.) | Medium | Vessels | No |

---

## 3. Full Route Inventory by Module

### 3.1 Vessels (4 endpoints)

| Line | Method | Path | Storage Methods | Business Logic |
|------|--------|------|-----------------|:--------------:|
| ~120 | GET | `/technical/api/vessels` | `getVessels()` | No |
| ~135 | GET | `/technical/api/vessels/:id` | `getVessel()` | No |
| ~150 | POST | `/technical/api/vessels` | `createVessel()` | Yes (validation) |
| ~165 | GET | `/technical/api/vessels-with-fleets` | `getVesselsWithFleets()` | Yes (join) |

### 3.2 Fleets (3 endpoints)

| Line | Method | Path | Storage Methods | Business Logic |
|------|--------|------|-----------------|:--------------:|
| ~180 | GET | `/technical/api/fleets` | `getAllFleets()` | No |
| ~195 | GET | `/technical/api/fleets/:id` | `getFleetById()` | No |
| ~210 | POST | `/technical/api/fleets` | `createFleet()` | Yes (validation) |

### 3.3 Components (29 endpoints)

| Line | Method | Path | Storage Methods | Business Logic |
|------|--------|------|-----------------|:--------------:|
| ~230 | GET | `/technical/api/components` | `getComponents()` | Yes (filtering) |
| ~280 | GET | `/technical/api/components/:id` | `getComponent()` | No |
| ~300 | POST | `/technical/api/components` | `createComponent()` | Yes (hierarchy, code gen) |
| ~370 | PATCH | `/technical/api/components/:id` | `updateComponent()` | Yes (validation) |
| ~420 | DELETE | `/technical/api/components/:id` | `deleteComponent()` | Yes (cascade check) |
| ~460 | GET | `/technical/api/components/:id/children` | `getChildComponents()` | No |
| ~480 | GET | `/technical/api/components/:id/hierarchy` | `getComponentHierarchy()` | Yes (tree build) |
| 1514 | GET | `/technical/api/component-documents/:componentId` | `getComponentDocuments()` | No |
| 1560 | POST | `/technical/api/component-documents` | `createComponentDocument()` | Yes (file upload) |
| 1672 | PUT | `/technical/api/component-documents/:id` | `updateComponentDocument()` | Yes |
| 1728 | DELETE | `/technical/api/component-documents/:id` | `deleteComponentDocument()` | No |
| 1739 | GET | `/technical/api/component-documents/:id/download` | `getComponentDocument()` | Yes (file download) |
| 1798 | GET | `/technical/api/component-class-regulatory/:componentId` | `getComponentClassRegulatories()` | No |
| 1825 | POST | `/technical/api/component-class-regulatory` | `createComponentClassRegulatory()` | Yes |
| 1845 | PUT | `/technical/api/component-class-regulatory/:id` | `updateComponentClassRegulatory()` | Yes |
| 1864 | DELETE | `/technical/api/component-class-regulatory/:id` | `deleteComponentClassRegulatory()` | No |
| 1877 | GET | `/technical/api/component-requisitions/:componentId` | `getComponentRequisitions()` | No |
| 1938 | GET | `/technical/api/component-requisitions` | `getComponentRequisitions()` | No |
| 1956 | GET | `/technical/api/component-requisitions/item/:id` | `getComponentRequisition()` | No |
| 1982 | POST | `/technical/api/component-requisitions` | `createComponentRequisition()` | Yes |
| 2014 | PUT | `/technical/api/component-requisitions/:id` | `updateComponentRequisition()` | Yes |
| 2055 | DELETE | `/technical/api/component-requisitions/:id` | `deleteComponentRequisition()` | No |
| 2068 | GET | `/technical/api/component-maintenance-history` | `getComponentMaintenanceHistory()` | No |
| 2078 | GET | `/technical/api/component-maintenance-history/:componentId` | `getComponentMaintenanceHistory()` | No |
| 2117 | GET | `/technical/api/job-maintenance-history/:jobId` | `getJobMaintenanceHistory()` | No |
| 2148 | GET | `/technical/api/component-maintenance-history/item/:id` | `getComponentMaintenanceHistoryItem()` | No |
| ~500 | POST | `/technical/api/components/bulk-create` | `bulkCreateComponents()` | Yes (bulk) |
| ~550 | POST | `/technical/api/components/bulk-update` | `bulkUpdateComponents()` | Yes (bulk) |
| ~600 | POST | `/technical/api/components/:id/inactivate` | `archiveComponent()` | Yes (cascade) |

### 3.4 Jobs (10 endpoints)

| Line | Method | Path | Storage Methods | Business Logic |
|------|--------|------|-----------------|:--------------:|
| ~850 | GET | `/technical/api/jobs` | `getJobs()` | Yes (multi-vessel) |
| ~920 | GET | `/technical/api/jobs/:id` | `getJob()` | No |
| ~940 | POST | `/technical/api/jobs` | `createJob()` | Yes (job# gen, date calc) |
| ~997 | PATCH | `/technical/api/jobs/:id` | `getJob(), updateJob()` | Yes (recalc dates/RH) |
| ~997 | DELETE | `/technical/api/jobs/:id` | `deleteJob()` | No |
| 13325 | POST | `/technical/api/jobs/:id/generate-wo` | `getJob(), createWorkOrder()` | Yes (WO generation) |
| 1011 | GET | `/technical/api/maintenance-planner` | `getPmsVesselSettings(), getJobs(), getComponents()` | Yes (complex filtering, grace calc) |
| 1437 | GET | `/technical/api/maintenance-planner/export` | `getJobs(), getComponents()` | Yes (Excel export) |
| 12457 | GET | `/technical/api/fleet/jobs` | `getFleetJobs()` | No |
| 12482 | POST | `/technical/api/fleet/jobs` | `createFleetJob()` | Yes |

### 3.5 Work Orders (17 endpoints)

| Line | Method | Path | Storage Methods | Business Logic |
|------|--------|------|-----------------|:--------------:|
| 2176 | GET | `/technical/api/work-orders` | `getWorkOrders(), getJobs(), getComponents(), getPmsVesselSettings()` | Yes (multi-vessel, status calc) |
| 2355 | GET | `/technical/api/work-orders/:id` | `getWorkOrder(), getJobs(), getPmsVesselSettings()` | Yes (status computation) |
| 2451 | GET | `/technical/api/work-orders/:id/context` | `getWorkOrder(), getComponent(), getRunningHoursAudits(), getJob()` | Yes (context hydration) |
| 2700 | POST | `/technical/api/work-orders` | `createWorkOrder()` | Yes (validation, status calc) |
| 2921 | PATCH | `/technical/api/work-orders/:id` | `getWorkOrder(), getJob(), updateWorkOrder()` | Yes (status recalc) |
| 3563 | POST | `/technical/api/work-orders/bulk-approve` | `getWorkOrder(), updateWorkOrder()` | Yes (batch) |
| 3653 | POST | `/technical/api/work-orders/bulk-reject` | `getWorkOrder(), updateWorkOrder()` | Yes (batch) |
| 3715 | POST | `/technical/api/work-orders/:id/complete` | `getWorkOrder(), getJob(), getComponent(), updateWorkOrder()` | Yes (completion flow) |
| 4228 | DELETE | `/technical/api/work-orders/:id` | `deleteWorkOrder()` | No |
| 4241 | POST | `/technical/api/work-orders/auto-generate` | `getJobs(), createWorkOrder()` | Yes (auto-gen) |
| 4439 | POST | `/technical/api/work-orders/backfill-job-ids` | `getWorkOrders(), updateWorkOrder()` | Yes (backfill) |
| 13230 | POST | `/technical/api/work-orders/recalculate-statuses` | `getWorkOrders(), updateWorkOrder()` | Yes (batch recalc) |
| 13356 | POST | `/technical/api/work-orders/check-postponements` | `getWorkOrders(), updateWorkOrder()` | Yes |
| 4503 | GET | `/technical/api/work-order-executions/:componentId` | `getWorkOrderExecutions()` | No |
| 4514 | GET | `/technical/api/work-order-executions/details/:id` | `getWorkOrderExecution()` | No |
| 4528 | POST | `/technical/api/work-order-executions` | `createWorkOrderExecution()` | Yes |
| 4543 | PATCH | `/technical/api/work-order-executions/:id` | `updateWorkOrderExecution()` | Yes |

### 3.6 Running Hours (10+ endpoints in runningHoursRoutes.ts)

| Source | Method | Path | Business Logic |
|--------|--------|------|:--------------:|
| routes.ts:6570 | GET | `/technical/api/running-hours/:componentId` | No |
| routes.ts:6580 | POST | `/technical/api/running-hours` | Yes (validation) |
| routes.ts:6622 | POST | `/technical/api/running-hours/cascade` | Yes (cascade) |
| RH file | GET | `/technical/api/running-hours/parents` | Yes (master/inherited) |
| RH file | GET | `/technical/api/running-hours/children/:parentCode` | Yes |
| RH file | PUT | `/technical/api/running-hours/child/:componentId` | Yes (24hr validation) |
| RH file | POST | `/technical/api/running-hours/reset-child/:componentId` | Yes (replacement) |
| RH file | GET | `/technical/api/rh-config/master-components/:vesselId` | No |
| RH file | GET | `/technical/api/rh-config/:componentId` | No |
| RH file | PUT | `/technical/api/rh-config/:componentId` | Yes (counter type) |
| RH file | PUT | `/technical/api/rh-config/master/:componentId` | Yes (master cascade) |
| RH file | POST | `/technical/api/running-hours/propagate-all` | Yes (batch fix) |

### 3.7 Spares (19 endpoints)

| Line | Method | Path | Storage Methods | Business Logic |
|------|--------|------|-----------------|:--------------:|
| 6989 | GET | `/technical/api/spares` | `getAllSpares()` | No |
| 7001 | GET | `/technical/api/spares/history/:vesselId` | `getSpareHistory()` | No |
| 7016 | POST | `/technical/api/spares/bulk-update` | `consumeSpareFromLocation(), receiveSpareToLocation()` | Yes |
| 7171 | GET | `/technical/api/spares/:vesselId` | `getSpares()` | No |
| 7192 | GET | `/technical/api/spares/:vesselId/:id` | `getSpare()` | No |
| 7205 | POST | `/technical/api/spares/:vesselId` | `createSpare()` | Yes |
| 7218 | PATCH | `/technical/api/spares/:vesselId/:id` | `updateSpare()` | Yes |
| 7279 | DELETE | `/technical/api/spares/:vesselId/:id` | `deleteSpare()` | No |
| 7292 | POST | `/technical/api/spares/:vesselId/:id/adjustment` | `adjustSpareInventory()` | Yes |
| 7344 | POST | `/technical/api/spares/:vesselId/:id/adjust` | `adjustSpareInventory()` | Yes |
| 7379 | GET | `/technical/api/spares/:vesselId/history` | `getSpareHistory()` | No |
| 7392 | GET | `/technical/api/spares/:vesselId/low-stock` | `getSpares()` | Yes |
| 9620 | POST | `/technical/api/spares/:vesselId/batch-consume` | `consumeSpareFromLocation()` | Yes |
| 9647 | POST | `/technical/api/spares/:vesselId/batch-receive` | `receiveSpareToLocation()` | Yes |
| 9675 | POST | `/technical/api/spares/:id/consume` | `consumeSpare()` | Yes |
| 9710 | POST | `/technical/api/spares/:id/receive` | `receiveSpare()` | Yes |
| 9759 | POST | `/technical/api/spares/:id/consume-from-location` | `consumeSpareFromLocation()` | Yes |
| 9852 | POST | `/technical/api/spares/:id/receive-to-location` | `receiveSpareToLocation()` | Yes |
| 12656 | GET | `/technical/api/fleet/spares` | `getFleetSpares()` | No |

### 3.8 Inventory (20 endpoints)

| Line | Method | Path | Business Logic |
|------|--------|------|:--------------:|
| 9919 | GET | `/technical/api/inventory/locations/:vesselId` | No |
| 9929 | GET | `/technical/api/inventory/locations/:vesselId/:id` | No |
| 9942 | POST | `/technical/api/inventory/locations/:vesselId` | Yes |
| 9969 | POST | `/technical/api/inventory/reconcile/:vesselId` | Yes (reconcile) |
| 9982 | GET | `/technical/api/inventory/spare-links/:vesselId` | No |
| 9992 | GET | `/technical/api/inventory/spare-links/by-spare/:spareId` | No |
| 10004 | GET | `/technical/api/inventory/spare-links/by-component/:componentId` | No |
| 10014 | POST | `/technical/api/inventory/spare-links` | Yes |
| 10040 | DELETE | `/technical/api/inventory/spare-links/:spareId/:componentId` | No |
| 10053 | GET | `/technical/api/inventory/stock/:spareId` | No |
| 10075 | GET | `/technical/api/inventory/stock/by-location/:locationId` | No |
| 10086 | GET | `/technical/api/inventory/stock/locations-with-stock/:vesselId` | No |
| 10096 | GET | `/technical/api/inventory/stock/full-by-location/:vesselId/:locationId` | No |
| 10108 | POST | `/technical/api/inventory/stock/:spareId/:locationId` | Yes |
| 10149 | POST | `/technical/api/inventory/transactions` | Yes (multi-step txn) |
| 10207 | GET | `/technical/api/inventory/transactions/:vesselId` | No |
| 10242 | GET | `/technical/api/inventory/spares-with-inventory/:vesselId` | No |
| 10252 | GET | `/technical/api/inventory/spare-with-inventory/:spareId` | No |
| 10268 | GET | `/technical/api/inventory/spares-by-component/:componentId` | No |
| 10278 | GET | `/technical/api/inventory/spares-by-component-code/:vesselId/:componentCode` | No |

### 3.9 Stores (10 endpoints)

| Line | Method | Path | Business Logic |
|------|--------|------|:--------------:|
| 10568 | GET | `/technical/api/stores` | Yes (multi-vessel) |
| 10582 | GET | `/technical/api/stores/:vesselId` | Yes |
| 10605 | GET | `/technical/api/stores/:vesselId/history` | Yes |
| 10629 | GET | `/technical/api/stores/item/:id/history` | No |
| 10639 | POST | `/technical/api/stores/:vesselId/create` | Yes |
| 10660 | PUT | `/technical/api/stores/item/:id` | Yes |
| 10682 | POST | `/technical/api/stores/item/:id/adjust` | Yes |
| 10713 | PATCH | `/technical/api/stores/:vesselId/:id` | Yes |
| 10783 | DELETE | `/technical/api/stores/item/:id` | No |
| 10794 | POST | `/technical/api/stores/:vesselId/batch-consume` | Yes |

### 3.10 Defects (32 endpoints)

| Line | Method | Path | Business Logic |
|------|--------|------|:--------------:|
| 5777 | GET | `/technical/api/defects` | Yes (filtering) |
| 5803 | GET | `/technical/api/defects/coc` | Yes (CoC filter) |
| 5825 | GET | `/technical/api/defects/recurring` | Yes |
| 5842 | GET | `/technical/api/defects/count` | Yes |
| 5866 | GET | `/technical/api/defects/count/recurring` | Yes |
| 5876 | GET | `/technical/api/defects/:id` | No |
| 5889 | POST | `/technical/api/defects` | Yes (ID gen) |
| 5918 | PATCH | `/technical/api/defects/:id` | Yes |
| 5936 | DELETE | `/technical/api/defects/:id` | No |
| 5965 | GET | `/technical/api/defects-count` | Yes |
| 5980 | GET | `/technical/api/defects/:defectId/actions` | No |
| 5990 | POST | `/technical/api/defects/:defectId/actions` | Yes |
| 6008 | PATCH | `/technical/api/defects/actions/:actionId` | Yes |
| 6026 | DELETE | `/technical/api/defects/actions/:actionId` | No |
| 6039 | GET | `/technical/api/defects/:defectId/attachments` | No |
| 6049 | POST | `/technical/api/defects/:defectId/attachments` | Yes |
| 6067 | DELETE | `/technical/api/defects/attachments/:attachmentId` | No |
| 6080 | POST | `/technical/api/defects/:id/notes` | Yes (append) |
| 6104 | PATCH | `/technical/api/defects/:id/link` | Yes |
| 6120 | PATCH | `/technical/api/defects/:id/close` | Yes |
| 6154 | POST | `/technical/api/defects/reports/:reportKey` | Yes |
| 12057 | GET | `/technical/api/recurring-defects` | Yes |
| 12101 | GET | `/technical/api/recurring-defects/:id` | No |
| 12115 | GET | `/technical/api/recurring-defects/:id/defects` | No |
| 12126 | POST | `/technical/api/recurring-defects/recalculate` | Yes |
| + 7 | Various | dev/seed/test endpoints | Various |

### 3.11 Reports (38 endpoints)

All report endpoints have heavy inline business logic (data aggregation, Excel generation).

| Group | Count | Key Endpoints |
|-------|:-----:|---------------|
| Critical Spares | 2 | preview + Excel export |
| Critical Equipment Status | 2 | JSON + Excel |
| Unplanned Breakdown Jobs | 2 | JSON + Excel |
| Low Stock Alert | 3 | JSON + mark-ordered + Excel |
| Stores Inventory Status | 1 | Excel |
| Stores Consumption Analysis | 2 | JSON + Excel |
| Spares Consumption Analysis | 2 | JSON + Excel |
| Combined Consumption Analysis | 2 | JSON + Excel |
| Chemicals Expiry | 1 | JSON |
| Stores Low Stock Alert | 2 | JSON + Excel |
| Report Snapshots | 2 | list + detail |
| Change Requests Status | 2 | JSON + Excel |
| Critical Components List | 1 | JSON |
| LSA/FFA Master List | 1 | JSON |
| LSA/FFA Maintenance Schedule | 1 | JSON |
| Critical Equipment Schedule | 1 | JSON |
| Due Jobs 7 Days | 1 | Excel |
| Overdue Jobs | 1 | Excel |
| Completed Jobs | 1 | Excel |
| Unplanned Jobs | 1 | Excel |
| Postponement Log | 1 | Excel |
| Monthly Summary | 1 | Excel |
| Crew Workload Distribution | 2 | JSON + Excel |
| Equipment Utilization Summary | 2 | JSON + Excel |
| RH Anomaly Detection | 2 | JSON + Excel |
| IHM Inventory Status | 1 | Excel |

### 3.12 Certificates & Surveys (26 endpoints)

| Line | Method | Path | Business Logic |
|------|--------|------|:--------------:|
| 14169 | GET | `/technical/api/certificates` | Yes (filtering) |
| 14382 | GET | `/technical/api/certificates/:id` | No |
| 14458 | PATCH | `/technical/api/certificates/:id` | Yes |
| 14646 | GET | `/technical/api/surveys` | Yes (filtering) |
| 14837 | GET | `/technical/api/surveys/:id` | No |
| 14852 | PATCH | `/technical/api/surveys/:id` | Yes |
| 14950 | POST | `/technical/api/surveys` | Yes |
| 14965 | GET | `/technical/api/admin/ship-certificates-master` | No |
| 14983 | POST | `/technical/api/admin/ship-certificates-master` | Yes |
| 15183 | DELETE | `/technical/api/admin/ship-certificates-master/:masterId` | No |
| 15219 | GET | `/technical/api/admin/ship-certificates-labels` | No |
| 15246 | POST | `/technical/api/admin/ship-certificates-labels` | Yes |
| 15289 | GET | `/technical/api/admin/vessel-certificate-applicability` | No |
| 15325 | POST | `/technical/api/admin/vessel-certificate-applicability/initialize` | Yes |
| 15379 | PATCH | `/technical/api/admin/vessel-certificate-applicability` | Yes |
| 15429 | POST | `/technical/api/admin/vessel-certificate-applicability/bulk-update` | Yes |
| 15484 | GET | `/technical/api/admin/ship-surveys-master` | No |
| 15502 | POST | `/technical/api/admin/ship-surveys-master` | Yes |
| 15671 | DELETE | `/technical/api/admin/ship-surveys-master/:masterId` | No |
| 15698 | GET | `/technical/api/admin/ship-surveys-labels` | No |
| 15725 | POST | `/technical/api/admin/ship-surveys-labels` | Yes |
| 15770 | GET | `/technical/api/admin/vessel-survey-applicability` | No |
| 15804 | POST | `/technical/api/admin/vessel-survey-applicability/initialize` | Yes |
| 15858 | POST | `/technical/api/admin/vessel-survey-applicability/bulk-update` | Yes |
| + 2 | | Vessel survey data endpoints | |

### 3.13 Misc/Admin (25+ endpoints)

| Line | Method | Path | Business Logic |
|------|--------|------|:--------------:|
| 10938 | GET | `/technical/api/me` | No |
| 10949 | GET | `/technical/api/users` | No |
| 6287-6362 | Various | `/technical/api/equipment-categories` | CRUD |
| 6381-6456 | Various | `/technical/api/defect-categories` | CRUD |
| 6475-6550 | Various | `/technical/api/defect-types` | CRUD |
| 13137-13218 | Various | `/technical/api/pms-vessel-settings` | CRUD |
| 13247-13262 | Various | `/technical/api/vessel-location-names/:vesselId` | GET + PUT |
| 13374-13455 | Various | `/technical/api/upload-document`, `/technical/api/documents/*` | File ops |
| 13478+ | Various | `/technical/api/admin/*` | System ops |
| 11291 | GET | `/technical/api/template-builder/:templateType` | Yes |

---

## 4. Cross-Module Dependency Graph

```
                    ┌──────────┐
                    │  Vessels  │ (foundation - no deps)
                    └────┬─────┘
                         │
           ┌─────────────┼────────────────┐
           │             │                │
      ┌────▼───┐   ┌────▼─────┐   ┌──────▼──────┐
      │ Fleets │   │Components│   │   Settings   │
      └────┬───┘   └────┬─────┘   │(PMS Vessel)  │
           │             │         └──────────────┘
           │    ┌────────┼────────────┐
           │    │        │            │
      ┌────▼────▼┐  ┌───▼──┐   ┌────▼────┐
      │Fleet Admin│  │ Jobs │   │  Spares │
      └──────────┘  └──┬───┘   └────┬────┘
                       │             │
                  ┌────▼─────┐  ┌───▼──────┐
                  │Work Orders│  │Inventory │
                  └────┬─────┘  └──────────┘
                       │
                ┌──────▼──────┐
                │Running Hours│
                └─────────────┘

  Independent modules (Vessels only):
  ┌────────┐  ┌────────┐  ┌──────┐  ┌────────────────────┐
  │Defects │  │ Stores │  │Alerts│  │Certificates/Surveys│
  └────────┘  └────────┘  └──────┘  └────────────────────┘
  (+ Components)

  Cross-cutting modules (read from ALL):
  ┌─────────┐  ┌────────────┐  ┌─────────────┐  ┌───────┐
  │ Reports │  │Bulk Upload  │  │Change Reqs   │  │Chatbot│
  └─────────┘  └────────────┘  └─────────────┘  └───────┘
```

### Detailed Dependencies

| Module | Depends On | Depended On By |
|--------|-----------|----------------|
| **Vessels** | (none) | All modules |
| **Fleets** | Vessels | Fleet Admin |
| **Components** | Vessels | Jobs, Spares, Defects, Running Hours, Work Orders, Reports |
| **Jobs** | Vessels, Components | Work Orders, Reports |
| **Work Orders** | Vessels, Jobs, Components, RH, PMS Settings | Reports, Change Requests |
| **Running Hours** | Components, Jobs, Work Orders | Work Orders (threshold triggers) |
| **Spares** | Vessels, Components | Inventory, Reports, Change Requests, Bulk Upload |
| **Inventory** | Spares, Components, Locations | Reports |
| **Stores** | Vessels | Reports, Change Requests, Bulk Upload |
| **Defects** | Vessels, Components | Reports |
| **Certificates & Surveys** | Vessels | Reports |
| **Fleet Admin** | Fleets, Vessels, Components, Jobs, Spares | Bulk Upload |
| **Reports** | ALL modules (read-only) | (none) |
| **Change Requests** | Components, Jobs, WO, Spares, Stores | (none) |
| **Bulk Upload** | Components, Jobs, Spares, Stores, Makers | (none) |
| **Alerts** | Vessels | (none) |
| **Forms** | (none) | (none) |
| **Chatbot** | ALL (read-only) | (none) |
| **Misc/Admin** | Vessels | Various |

---

## 5. Already-Separated Code Inventory

### 5.1 Route Files

| File | Lines | Endpoints | Coverage |
|------|------:|:---------:|----------|
| `server/routes/alerts.ts` | 203 | 10 | Full alert policy/event/config CRUD |
| `server/routes/bulk.ts` | 7,620 | 10+ | Bulk import/export for components, jobs, spares, stores; maker/SFI CRUD |
| `server/routes/forms.ts` | 256 | 10 | Form definition versioning, publish/rollback |
| `server/routes/fleetAdmin.ts` | 1,375 | 21+ | Master data, fleet components/jobs/spares mappings, dashboard metrics, copy vessel |
| `server/routes/changeRequests.ts` | 320 | 11 | Change request workflow (create/submit/approve/reject), comments, attachments |
| `server/routes/chatbot.ts` | 62 | 1 | AI chat message processing |
| `server/runningHoursRoutes.ts` | 622 | 10+ | RH display, child updates, config, master cascade, propagation |

### 5.2 Service Files

| File | Lines | Purpose | Key Logic |
|------|------:|---------|-----------|
| `server/services/index.ts` | 20 | Central export barrel | Re-exports all services |
| `server/services/componentService.ts` | 222 | Component hierarchy | Tree navigation, path, bulk ops |
| `server/services/jobService.ts` | 150+ | Job management | Job# gen, Rule #15 (frequency change), next due calc |
| `server/services/workOrderService.ts` | 150+ | WO management | Status computation, auto-generation, grace periods |
| `server/services/runningHoursService.ts` | 121 | RH operations | Cascade updates, audit trail, realism validation |
| `server/services/jobDueScanner.ts` | 200+ | Scheduled scanner | Auto-gen WOs from due jobs (1-min interval) |
| `server/services/workOrderStatusRecalculator.ts` | 100+ | Status recalc | Periodic status updates (1-min interval) |
| `server/services/lowStockReportService.ts` | 100+ | Low stock analysis | Priority calc, consumption averaging, days-to-stockout |
| `server/services/chatbotService.ts` | 1000+ | AI chatbot | Context-aware responses, conversation history |
| `server/services/fileBasedImportHistory.ts` | 141 | File-based history | JSON file persistence for import history |

### 5.3 Existing Module Structure (on replit_dev)

| Path | Purpose |
|------|---------|
| `server/modules/access-control/routes.ts` | RBAC access control |
| `server/modules/running-hours/services/rhTimelineValidationService.ts` | RH timeline validation |
| `server/modules/work-orders/controllers/woDocumentController.ts` | WO document handling |
| `server/modules/work-orders/repositories/documentRepository.ts` | WO document storage |
| `server/modules/work-orders/services/anomalyDetectionService.ts` | WO anomaly detection |
| `server/modules/work-orders/services/complianceAnomalyService.ts` | Compliance anomalies |
| `server/modules/work-orders/services/woDocumentService.ts` | WO document service |
| `server/modules/work-orders/utils/skippedCycleBackfill.ts` | Skipped cycle backfill |
| `server/modules/work-orders/utils/spareConsumptionDelta.ts` | Spare consumption delta |

---

## 6. Schema Inventory (51 tables)

### Tables by Domain

| Domain | Tables | Total Columns (est.) |
|--------|:------:|--------------------:|
| Users & Auth | 3 (users, fleets, vessels) | ~29 |
| Components | 8 (components + 7 sub-tables) | ~175 |
| Jobs & Work Orders | 4 (jobs, workOrders, workOrderExecutions, jobComponentLinks) | ~157 |
| Work Order Extensions | 2 (workOrderPostponements, workOrderExecutionDetails) | ~27 |
| Spares & Inventory | 9 (spares + 8 related) | ~190 |
| Defects | 6 (defects + 5 related) | ~135 |
| Alerts | 4 | ~41 |
| Forms | 3 | ~14 |
| IHM | 2 | ~19 |
| Change Requests | 3 | ~23 |
| Import & Audit | 4 | ~50 |
| Fleet Master Data | 8 | ~120 |
| Fleet Mappings | 4 | ~31 |
| Certificates & Surveys | 8 | ~91 |
| Settings & Config | 2 | ~23 |
| Reports | 1 (reportSnapshots) | ~9 |

### Key Foreign Key Chains

```
vessels <- components <- jobs <- workOrders
                      <- spares <- spareComponentLinks
                      <- defects
                      <- jobComponentLinks -> jobs

workOrders <- workOrderPostponements
           <- workOrderExecutionDetails
           <- workOrderExecutions -> components

spares <- spareLocationStock -> locations
       <- inventoryTransactions -> locations
       <- sparesHistory

defects <- defectActions
        <- defectAttachments
        <- recurringDefectLinks -> recurringDefects

alertPolicies <- alertEvents <- alertDeliveries

changeRequest <- changeRequestAttachment
              <- changeRequestComment

importHistory <- importChangeLog
```

---

## 7. Recommended Refactoring Order

Based on dependency analysis: extract modules with fewest dependencies first.

### Phase 1: Zero/Minimal Dependencies (Foundation)

| Order | Module | Reason |
|:-----:|--------|--------|
| 1 | **Vessels** | No dependencies. Foundation for everything. |
| 2 | **Fleets** | Only depends on Vessels. |
| 3 | **Alerts** | Already separated. Only depends on Vessels. |
| 4 | **Forms** | Already separated. No dependencies. |

### Phase 2: Single-Domain Modules

| Order | Module | Reason |
|:-----:|--------|--------|
| 5 | **Certificates & Surveys** | Only depends on Vessels. Self-contained. |
| 6 | **Stores** | Only depends on Vessels. Isolated from Components/Jobs (Business Rule 7.2). |
| 7 | **Defects** | Depends on Vessels + Components (read-only for component lookup). |
| 8 | **Components** | Depends on Vessels. Core entity, must be extracted before Jobs/Spares. |

### Phase 3: Dependent Domain Modules

| Order | Module | Reason |
|:-----:|--------|--------|
| 9 | **Jobs** | Depends on Components + Vessels. Needed before Work Orders. |
| 10 | **Running Hours** | Depends on Components. Already partially separated. |
| 11 | **Spares** | Depends on Components + Vessels. |
| 12 | **Inventory** | Depends on Spares + Components + Locations. |
| 13 | **Work Orders** | Depends on Jobs + Components + RH + Settings. Most complex. |

### Phase 4: Cross-Cutting Modules

| Order | Module | Reason |
|:-----:|--------|--------|
| 14 | **Fleet Admin** | Already separated. Touches Components/Jobs/Spares. |
| 15 | **Change Requests** | Already separated. Cross-module approval workflow. |
| 16 | **Bulk Upload** | Already separated. Cross-module import engine. |
| 17 | **Reports** | Reads from ALL modules. Extract last, most cross-cutting. |

### Phase 5: Misc & Admin

| Order | Module | Reason |
|:-----:|--------|--------|
| 18 | **Misc/Admin** | Users, settings, categories, documents, remaining endpoints. |

---

## 8. Risk Assessment

### High-Risk Extractions

- **Work Orders** (25 storage methods, status computation, RH triggers, spare consumption)
- **Reports** (38 endpoints, reads from every module, heavy Excel generation)
- **Bulk Upload** (7,620 lines, touches all domain tables, undo capability)

### Medium-Risk Extractions

- **Components** (50 storage methods, hierarchy, RH configuration)
- **Spares** (42 storage methods, multi-location inventory)
- **Jobs** (Rule #15 frequency change logic, WO generation triggers)

### Low-Risk Extractions

- **Vessels, Fleets** (simple CRUD)
- **Alerts, Forms** (already separated, self-contained)
- **Certificates & Surveys** (self-contained, moderate complexity)
- **Stores** (isolated from Components/Jobs by design)

---

## 9. Key Business Rules to Preserve

1. **Rule #15 (Job Frequency Change):** If active WO exists, preserve current due date; apply new frequency on next cycle only.
2. **RH Cascade:** Master component RH updates cascade to all inherited children.
3. **RH 24-Hour Validation:** Daily increase cannot exceed 24 hours (admin override available).
4. **Work Order Status Computation:** Uses grace periods from PMS vessel settings.
5. **Defect ID Generation:** Semantic format `D{VesselCode}-{YY}-{Seq}` with per-vessel sequence counter.
6. **Stores Isolation (Business Rule 7.2):** Stores items have NO linkage to Components/Jobs.
7. **Component Maintenance History:** Immutable, no edits or deletes allowed.
8. **Inventory Transactions:** Single source of truth; all stock changes must go through transaction pipeline.
9. **Job Due Scanner:** 1-minute periodic scan for calendar and RH-based WO auto-generation.
10. **Fleet/Vessel Dual-Scope:** Components, spares, and jobs support both fleet-level templates and vessel-specific instances via `dataScope` field.

---

## 10. Orphan Check Results (replit_dev, 2026-03-18)

All implicit FK relationships verified clean:

| Query | Orphan Count |
|-------|:---:|
| vessel_certificate_applicability -> ship_certificates_master | 0 |
| vessel_certificate_data -> ship_certificates_master | 0 |
| vessel_survey_applicability -> ship_surveys_master | 0 |
| vessel_survey_data -> ship_surveys_master | 0 |
| Certificate categories not in labels_config | (none) |
| Survey categories not in labels_config | (none) |
