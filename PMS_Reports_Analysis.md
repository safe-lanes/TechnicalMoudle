# PMS Reports Module - Comprehensive Analysis
**Date:** February 13, 2026  
**Scope:** All reports under PMS > Reports section

---

## Executive Summary

The Reports Module contains **7 report categories** with **23+ individual reports** across 16 component files. Most reports have dedicated backend API endpoints and are backed by real database tables. However, there are notable gaps: **2 report categories (Compliance, Alerts/Approvals/Admin) exist as files but are NOT wired into the navigation**, and **2 maintenance sub-reports are intentionally hidden**. There is also a **TypeScript error** in `MaintenanceReports.tsx`.

---

## 1. REPORT CATEGORIES (from ReportsModule.tsx)

| # | Category ID | Title | Report Count (Claimed) | Wired In? | Component File |
|---|------------|-------|----------------------|-----------|----------------|
| 1 | planner | Maintenance Planner | 1 | YES | MaintenancePlanner.tsx |
| 2 | maintenance | Maintenance & Work Orders | 10 (8 visible) | YES | MaintenanceReports.tsx |
| 3 | running-hours | Running Hours & Condition | 2 | YES | RunningHoursReports.tsx |
| 4 | spares | Inventory - Spares | 3 | YES | SparesReports.tsx |
| 5 | stores | Inventory - Stores/Lubes/Chemicals | 5 | YES | StoresReports.tsx |
| 6 | ihm | IHM (Inventory of Hazardous Materials) | 1 | YES | IhmReports.tsx |
| 7 | change-requests | Modify PMS (Change Requests) | 1 | YES | ChangeRequestReports.tsx |

### NOT WIRED INTO NAVIGATION (Files exist but are unreachable):
| File | Purpose | Issue |
|------|---------|-------|
| ComplianceReports.tsx | Certificates & Surveys status | Not imported in ReportsModule.tsx, no category card |
| AlertsApprovalsAdminReports.tsx | System alerts, pending approvals, user activity | Not imported in ReportsModule.tsx, no category card |

---

## 2. DETAILED REPORT-BY-REPORT ANALYSIS

### 2.1 Maintenance Planner (planner)
| Report | Backend Endpoint | DB Tables Used | Status |
|--------|-----------------|----------------|--------|
| Maintenance Planner | GET `/technical/api/maintenance-planner` | jobs, work_orders, components | WORKING |
| Planner Excel Export | GET `/technical/api/maintenance-planner/export` | Same as above | WORKING |

### 2.2 Maintenance & Work Orders (maintenance)
| Report ID | Report Name | Backend Endpoint | DB Tables | Status |
|-----------|------------|-----------------|-----------|--------|
| due-jobs-7 | Due Jobs (7 days) | POST `/technical/api/reports/due-jobs-7-days` | work_orders, components | WORKING |
| overdue-jobs | Overdue Jobs | POST `/technical/api/reports/overdue-jobs` | work_orders, components | WORKING |
| completed-jobs | Completed Jobs Register | POST `/technical/api/reports/completed-jobs` | work_orders, components | WORKING |
| monthly-summary | Monthly Maintenance Summary | POST `/technical/api/reports/maintenance/monthly-summary/excel` | work_orders, jobs, components | WORKING |
| critical-equipment | Critical Equipment Status | GET `/technical/api/reports/critical-equipment-status` | components, work_orders | WORKING |
| unplanned-jobs | Unplanned/Breakdown Jobs | GET `/technical/api/reports/unplanned-breakdown-jobs` | work_orders, components | WORKING |
| postponement-log | Job Postponement Log | POST `/technical/api/reports/postponement-log` | work_orders | WORKING |
| workload-distribution | Crew Workload Distribution | GET `/technical/api/reports/crew-workload-distribution` | work_orders, jobs | WORKING |
| priority-performance | Work Priority Performance | N/A (client-side from work_orders query) | work_orders | HIDDEN (hidden: true) |
| manhours-analysis | Man-Hours Planned vs Actual | N/A (client-side from work_orders query) | work_orders | HIDDEN (hidden: true) |

**LSP Error:** Lines 229 and 244 - `'hidden' does not exist in type 'MaintenanceReport'`. The `hidden` property is used to filter reports but is not declared in the TypeScript interface.

**Excel Export Endpoints Available:**
- POST `/technical/api/reports/critical-equipment-status/excel`
- POST `/technical/api/reports/unplanned-breakdown-jobs/excel`
- POST `/technical/api/reports/crew-workload-distribution/excel`
- POST `/technical/api/reports/maintenance/monthly-summary/excel`

### 2.3 Running Hours & Condition (running-hours)
| Report | Backend Endpoint | DB Tables | Status |
|--------|-----------------|-----------|--------|
| Equipment Utilization Summary | GET `/technical/api/reports/equipment-utilization-summary` | components, running_hours_audit, jobs, work_orders | WORKING |
| Running Hours Anomaly Detection | GET `/technical/api/reports/running-hours-anomaly-detection` | components, running_hours_audit, component_running_hours_log | WORKING |

**Excel Export Endpoints Available:**
- POST `/technical/api/reports/equipment-utilization-summary/excel`
- POST `/technical/api/reports/running-hours-anomaly-detection/excel`

### 2.4 Inventory - Spares (spares)
| Report | Backend Endpoint | DB Tables | Status |
|--------|-----------------|-----------|--------|
| Low Stock Alert | GET `/technical/api/reports/low-stock-alert/:vesselId` | spares, jobs, components, job_component_links | WORKING |
| Critical Spares | GET `/technical/api/reports/critical-spares/preview` | spares, jobs, components, job_component_links | WORKING |
| Consumption Pattern Analysis | GET `/technical/api/reports/consumption-analysis/:vesselId` | spares, spares_history | WORKING |

**Excel Export Endpoints Available:**
- POST `/technical/api/reports/low-stock-alert/:vesselId/excel`
- POST `/technical/api/reports/critical-spares` (Excel export)
- POST `/technical/api/reports/consumption-analysis/:vesselId/excel`

### 2.5 Inventory - Stores/Lubes/Chemicals (stores)
| Report ID | Report Name | Backend Endpoint | DB Tables | Status |
|-----------|------------|-----------------|-----------|--------|
| stores-inventory-status | Stores Inventory Status | GET `/technical/api/stores/:vesselId` | stores_items, stores_ledger | WORKING |
| lubes-oil-analysis | Lubricants & Oil Analysis | GET `/technical/api/stores/:vesselId` (filtered client-side by itemType='lubes') | stores_items | WORKING (limited: filters client-side, no dedicated API) |
| chemicals-tracking | Chemicals Inventory & Expiry | GET `/technical/api/reports/chemicals-expiry/:vesselId` | stores_items | WORKING |
| low-stock-alert | Low Stock Alert | GET `/technical/api/reports/stores-low-stock-alert/:vesselId` | stores_items | WORKING |
| stores-consumption-analysis | Consumption Pattern Analysis | GET `/technical/api/reports/stores-consumption-analysis/:vesselId` | stores_items, stores_ledger | WORKING |

**Excel Export Endpoints Available:**
- POST `/technical/api/reports/stores-inventory-status/:vesselId/excel`
- POST `/technical/api/reports/stores-low-stock-alert/:vesselId/excel`
- POST `/technical/api/reports/stores-consumption-analysis/:vesselId/excel`

**Sub-Component Views (open in-place):**
- StoresInventoryStatusReport.tsx - Detailed interactive view
- ChemicalsExpiryReport.tsx - Dedicated chemicals view
- LowStockAlertReport.tsx - Dedicated low stock view
- ConsumptionPatternReport.tsx - Consumption trends view

### 2.6 IHM - Inventory of Hazardous Materials (ihm)
| Report | Backend Endpoint | DB Tables | Status |
|--------|-----------------|-----------|--------|
| IHM Inventory Status | GET `/technical/api/reports/ihm-inventory-status` | ihm_items, ihm_maintenance_log | WORKING |

**Excel Export Endpoints Available:**
- POST `/technical/api/reports/ihm-inventory-status/excel`

**Sub-Component View:**
- IhmInventoryStatusReport.tsx - Detailed interactive view

### 2.7 Modify PMS - Change Requests (change-requests)
| Report | Backend Endpoint | DB Tables | Status |
|--------|-----------------|-----------|--------|
| Change Request Status Tracking | GET `/technical/api/reports/change-requests-status-tracking` | change_request, change_request_attachment, change_request_comment | WORKING |

**Excel Export Endpoints Available:**
- GET `/technical/api/reports/change-requests-status-tracking/export`

---

## 3. UNREACHABLE REPORT PAGES (Files exist but not wired in)

### 3.1 Compliance Reports (ComplianceReports.tsx)
| Report | Backend Endpoint | DB Tables | Status |
|--------|-----------------|-----------|--------|
| Certificates Status | GET `/technical/api/certificates` | certificates | BACKEND EXISTS - Frontend not wired |
| Surveys Status | GET `/technical/api/surveys` | surveys | BACKEND EXISTS - Frontend not wired |

**Issue:** The file exists and fetches data from working API endpoints backed by real DB tables (`certificates`, `surveys`). However, it is NOT imported in `ReportsModule.tsx` and there is no category card for it.

### 3.2 Alerts, Approvals & Admin Reports (AlertsApprovalsAdminReports.tsx)
| Report | Backend Endpoint | DB Tables | Status |
|--------|-----------------|-----------|--------|
| System Alerts & Notifications | GET `/technical/api/work-orders`, GET `/technical/api/defects` | work_orders, defects | BACKEND EXISTS - Frontend not wired |
| Pending Approvals | Same as above | work_orders, defects | BACKEND EXISTS - Frontend not wired |
| Approval History Log | Client-side from work_orders/defects | work_orders, defects | CLIENT-SIDE - Frontend not wired |
| User Activity Report | Client-side (mock/aggregated) | N/A | PARTIAL - No dedicated backend |
| System Performance Report | Client-side (mock/aggregated) | N/A | PARTIAL - No dedicated backend |
| Overdue Items Alert Report | Client-side from work_orders/defects | work_orders, defects | CLIENT-SIDE - Frontend not wired |

**Issue:** File exists with 6 sub-reports. Core data (work_orders, defects) comes from existing APIs. Some reports (User Activity, System Performance) appear to use mock/aggregated data with no dedicated backend endpoint. NOT imported in `ReportsModule.tsx`.

---

## 4. DATABASE TABLES BACKING REPORTS

| DB Table | Reports Using It |
|----------|-----------------|
| work_orders | Maintenance (all 10), Running Hours, Alerts/Approvals |
| jobs | Maintenance Planner, Due Jobs, Spares (Low Stock, Critical), Running Hours |
| components | Maintenance Planner, Critical Equipment, Running Hours (both), Spares |
| spares | Low Stock Alert, Critical Spares, Consumption Analysis |
| spares_history | Consumption Pattern Analysis (Spares) |
| stores_items | Stores Inventory, Lubes, Chemicals Expiry, Stores Low Stock, Stores Consumption |
| stores_ledger | Stores Inventory Status, Stores Consumption Analysis |
| running_hours_audit | Equipment Utilization, Anomaly Detection |
| component_running_hours_log | Anomaly Detection |
| ihm_items | IHM Inventory Status |
| ihm_maintenance_log | IHM Inventory Status |
| change_request | Change Request Status Tracking |
| change_request_attachment | Change Request Status Tracking |
| change_request_comment | Change Request Status Tracking |
| certificates | Compliance Reports (not wired) |
| surveys | Compliance Reports (not wired) |
| defects | Alerts/Approvals (not wired) |
| alert_policies | Not used by any report |
| alert_events | Not used by any report |
| alert_deliveries | Not used by any report |
| alert_config | Not used by any report |

---

## 5. ISSUES & FINDINGS SUMMARY

### Critical Issues
| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | TypeScript Error: `hidden` property not in `MaintenanceReport` interface | MaintenanceReports.tsx:229,244 | Build warning, but reports still render (cast to `any`) |

### Accessibility / Navigation Issues
| # | Issue | File | Impact |
|---|-------|------|--------|
| 2 | ComplianceReports not wired into ReportsModule | ReportsModule.tsx | Users cannot access Certificates & Surveys reports |
| 3 | AlertsApprovalsAdminReports not wired into ReportsModule | ReportsModule.tsx | Users cannot access Alerts/Approvals/Admin reports |

### Data Completeness Issues
| # | Issue | Details | Impact |
|---|-------|---------|--------|
| 4 | Lubes report uses client-side filtering only | Filters `stores_items` by `itemType='lubes'` client-side | Works but not optimized for large datasets |
| 5 | 2 Maintenance reports hidden | priority-performance, manhours-analysis | Intentional (hidden: true), not broken |
| 6 | AlertsApprovals User Activity Report | No dedicated backend endpoint | Uses mock/aggregated data |
| 7 | AlertsApprovals System Performance Report | No dedicated backend endpoint | Uses mock/aggregated data |
| 8 | Alert tables unused by reports | alert_policies, alert_events, alert_deliveries, alert_config | These tables exist but no report reads from them |

### Working Well
- **20 out of 23 visible reports** have dedicated backend endpoints AND proper database tables
- **15 Excel export endpoints** are available across reports
- **4 dedicated sub-component views** for detailed interactive reports (Stores Inventory, Chemicals Expiry, Low Stock Alert, IHM Inventory)
- All report categories that ARE wired in are fully functional
- PDF generation works client-side via `pdfReportGenerator`
- Global filters (vessel, department, date range, priority) propagate correctly to sub-reports

---

## 6. RECOMMENDATIONS

1. **Fix TypeScript Error:** Add `hidden?: boolean` to the `MaintenanceReport` interface in `MaintenanceReports.tsx`
2. **Wire in ComplianceReports:** Add import and category card in `ReportsModule.tsx` - backend is already complete
3. **Wire in AlertsApprovalsAdminReports:** Add import and category card - partial backend exists
4. **Consider dedicated API for Lubes:** Instead of client-side filtering from stores
5. **Build backend for User Activity / System Performance reports** if AlertsApprovals section is wired in
6. **Leverage alert_* tables** for the Alerts section reports instead of deriving from work_orders/defects
