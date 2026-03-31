# PMS Reports Module — Comprehensive Audit & Technical Reference

> **Generated:** 2026-03-31  
> **Scope:** All 22 reports across 8 categories  
> **Purpose:** Full technical verification and troubleshooting reference covering column definitions, formula logic, data sources, derivation paths, API endpoints, and debugging guides for every report in the PMS Reports Module.

---

## Section A: Master Report Inventory

| # | Category | Report Name | View Cols | PDF Cols | Excel Cols | Aligned | Frontend File | API Endpoint (Data) | API Endpoint (Excel) | Data Source |
|---|----------|-------------|-----------|----------|------------|---------|---------------|---------------------|----------------------|-------------|
| 1.1 | Maintenance | Due Jobs (7 Days) | 8 | 8 | 8 | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | POST `/technical/api/reports/due-jobs-7-days` | work_orders table, client filter |
| 1.2 | Maintenance | Overdue Jobs | 15 | 15 | 15 | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | POST `/technical/api/reports/overdue-jobs` | work_orders table, client filter |
| 1.3 | Maintenance | Completed Jobs Register | 11 | 11 | 11 | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | POST `/technical/api/reports/completed-jobs` | work_orders table, client filter |
| 1.4 | Maintenance | Monthly Maintenance Summary | 3 | 3 | KPI layout | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | POST `/technical/api/reports/maintenance/monthly-summary/excel` | work_orders table, client aggregation |
| 1.5 | Maintenance | Critical Equipment Status | 12 | 12 | 12 | Yes | MaintenanceReports.tsx | GET `/technical/api/reports/critical-equipment-status` | POST `/technical/api/reports/critical-equipment-status/excel` | Server-side query (components + work_orders) |
| 1.6 | Maintenance | Unplanned/Breakdown Jobs | 11 | 11 | 11 | Yes | MaintenanceReports.tsx | GET `/technical/api/reports/unplanned-breakdown-jobs` | POST `/technical/api/reports/unplanned-breakdown-jobs/excel` | Server-side query (work_orders) |
| 1.7 | Maintenance | Job Postponement Log | 10 | 10 | 10 | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | POST `/technical/api/reports/postponement-log` | work_orders table, client filter (status=Postponed) |
| 1.8 | Maintenance | Work Priority Performance | 5 | 5 | N/A | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | None | work_orders table, client aggregation |
| 1.9 | Maintenance | Man-Hours Analysis | 5 | 5 | N/A | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | None | work_orders table, client aggregation |
| 1.10 | Maintenance | Crew Workload Distribution | 10 | 10 | 10 | Yes | MaintenanceReports.tsx | Client-side (useQuery `/technical/api/work-orders`) | POST `/technical/api/reports/crew-workload-distribution/excel` | work_orders table, client aggregation |
| 2.1 | Running Hours | Equipment Utilization Summary | 10 | 10 | 10 | Yes | RunningHoursReports.tsx | GET `/technical/api/reports/equipment-utilization-summary` | POST `/technical/api/reports/equipment-utilization-summary/excel` | Server-side (components + running_hours) |
| 2.2 | Running Hours | RH Anomaly Detection | 11 | 11 | 11 | Yes | RunningHoursReports.tsx | GET `/technical/api/reports/running-hours-anomaly-detection` | POST `/technical/api/reports/running-hours-anomaly-detection/excel` | Server-side (running_hours logs) |
| 3.1 | Spares | Critical Spares Availability | 10 | 10 | 10 | Yes | SparesReports.tsx | GET `/technical/api/reports/critical-spares/preview` | POST `/technical/api/reports/critical-spares` | Server-side (spares + components) |
| 3.2 | Spares | Low Stock Alert | 8 | 8 | 8 | Yes | SparesReports.tsx | GET `/technical/api/reports/low-stock-alert/:vesselId` | POST `/technical/api/reports/low-stock-alert/:vesselId/excel` | Server-side (spares) |
| 3.3 | Spares | Consumption Pattern Analysis | 10 | 10 | 10 | Yes | SparesReports.tsx | GET `/technical/api/reports/consumption-analysis/:vesselId` | POST `/technical/api/reports/consumption-analysis/:vesselId/excel` | Server-side (spares + consumption_history) |
| 4.1 | Stores | Stores Inventory Status | 8 | 8 | 8 | Yes | StoresReports.tsx | Client-side (useQuery `/technical/api/stores`) | POST `/technical/api/reports/stores-inventory-status/:vesselId/excel` | stores table |
| 4.2 | Stores | Lubricants & Oil Analysis | 6 | 6 | N/A | Yes | StoresReports.tsx | Client-side (useQuery `/technical/api/stores`, filter itemType=lubes) | None | stores table, client filter |
| 4.3 | Stores | Chemicals Inventory & Expiry | 9 | 9 | N/A | Yes | StoresReports.tsx | Client-side (useQuery `/technical/api/stores`, filter itemType=chemicals) | None | stores table, client filter |
| 4.4 | Stores | Stores Low Stock Alert | 13 | 13 | 13 | Yes | StoresReports.tsx | GET `/technical/api/reports/stores-low-stock-alert/:vesselId` | POST `/technical/api/reports/stores-low-stock-alert/:vesselId/excel` | Server-side (stores) |
| 5.1 | Compliance | IHM Inventory Status | 10 | 10 | 10 | Yes | IhmReports.tsx (via MaintenanceReports routing) | GET `/technical/api/reports/ihm-inventory-status` | POST `/technical/api/reports/ihm-inventory-status/excel` | Server-side (ihm_items + stores) |
| 6.1 | Change Requests | CR Status & Tracking | 13 | 13 | 13 | Yes | ChangeRequestReports.tsx | GET `/technical/api/reports/change-requests-status-tracking` | GET `/technical/api/reports/change-requests-status-tracking/export` | Server-side (change_requests) |
| 7.1 | LSA/FFA | Equipment Master List | 12 | 12 | 12 | Yes | LsaFfaReports.tsx | GET `/technical/api/reports/lsa-ffa-master-list` | GET `/technical/api/reports/lsa-ffa-master-list?format=excel` | Server-side (components, equipmentType LSA/FFA) |
| 7.2 | LSA/FFA | Maintenance Schedule & Status | 16 | 16 | 16 | Yes | LsaFfaReports.tsx | GET `/technical/api/reports/lsa-ffa-maintenance-schedule` | GET `/technical/api/reports/lsa-ffa-maintenance-schedule?format=excel` | Server-side (components + work_orders) |

---

## Section B: Per-Report Technical Detail

### Category 1: Maintenance & Work Orders

**Frontend:** `client/src/pages/reports/MaintenanceReports.tsx`  
**PDF Generator:** `client/src/lib/pdfReportGenerator.ts`  
**Excel Service:** `server/modules/reports/services/maintenanceReportService.ts`  
**Excel Styles:** `server/lib/excelReportStyles.ts`

---

#### Report 1.1: Due Jobs (7 Days)

**Column Definition (8 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Priority | priority | 22 |
| 2 | Status | statusIndicator | 22 |
| 3 | WO Number | workOrderNumber | 45 |
| 4 | Title | title | 70 |
| 5 | Component | component | 50 |
| 6 | Due Date | formattedDueDate | 26 |
| 7 | Days Left | daysRemaining | 20 |
| 8 | Assigned To | assignedTo | 35 |

**Data Source:** Client-side filter on `vesselWorkOrders` from useQuery `/technical/api/work-orders`.

**Filter Logic:**
```
Include WO if:
  wo.dueDate exists
  AND wo.status NOT IN ('Completed', 'Postponed')
  AND dueDate <= (now + 7 days)
```
Note: This intentionally includes overdue jobs (dueDate < now).

**Derived Fields:**

| Field | Formula | Pseudo-code |
|-------|---------|-------------|
| `daysRemaining` | `Math.ceil((dueDate - now) / 86400000)` | Negative = overdue, 0 = today, positive = days remaining |
| `statusIndicator` | Tiered threshold | `if days < 0 → 'OVERDUE'`; `if days ≤ 2 → 'URGENT'`; `if days ≤ 7 → 'DUE'`; else `'ACTIVE'` |
| `formattedDueDate` | `formatDate(wo.dueDate)` | DD-MMM-YYYY via `pdfReportGenerator.formatDate()` |

**Sort Order:** `daysRemaining` ASC (most urgent first).

**Summary Metrics:**
- Total Due: `data.length`
- Overdue: count where `statusIndicator === 'OVERDUE'`
- Urgent (≤2d): count where `statusIndicator === 'URGENT'`
- Critical Priority: count where `priority === 'Critical'`

**PDF Conditional Formatting:**
- OVERDUE status → `bgDanger` (light red) background, bold
- URGENT status → `bgWarning` (light amber) background, bold
- DUE status → `primary` (deep blue) text, bold
- OVERDUE rows → all cells get subtle `bgDanger` background
- Negative `daysRemaining` → bold dark text

**Excel Endpoint:** POST `/technical/api/reports/due-jobs-7-days`  
**Excel Request Body:** `{ vesselId: string }`

---

#### Report 1.2: Overdue Jobs

**Column Definition (15 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 8 |
| 2 | Work Order No | workOrderNumber | 30 |
| 3 | Job Title | jobTitle | 40 |
| 4 | Comp Code | componentCode | 18 |
| 5 | Component Name | componentName | 32 |
| 6 | Dept | department | 14 |
| 7 | Due Date | formattedDueDate | 18 |
| 8 | Days Overdue | daysOverdue | 16 |
| 9 | Next Due RH | nextDueRH | 16 |
| 10 | Current RH | currentRH | 16 |
| 11 | RH Overdue | rhOverdue | 14 |
| 12 | Type | overdueType | 14 |
| 13 | Assigned To | assignedTo | 20 |
| 14 | Last Done | lastDoneDate | 18 |
| 15 | Critical | criticalEquip | 12 |

**Data Source:** Client-side filter on `vesselWorkOrders`.

**Filter Logic (Grace Period):**
```
GRACE_PERIOD_DAYS = 7
GRACE_PERIOD_RH  = 168 (hours)

Include WO if:
  wo.status NOT IN ('Completed', 'Postponed')
  AND (
    (wo.dueDate exists AND dueDate < (now - 7 days))
    OR
    (wo.nextDueReading AND wo.currentCumulativeRH AND
     (currentCumulativeRH - nextDueReading) > 168)
  )
```

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `daysOverdue` | `Math.floor((now - dueDate) / 86400000)` — calendar days past due |
| `rhOverdue` | `Math.max(0, currentCumulativeRH - nextDueReading)` — RH hours past due reading |
| `overdueType` | `'Both'` if calendar AND RH overdue; `'RH'` if only RH; `'Calendar'` otherwise |
| `criticalEquip` | `'YES'` if `wo.criticality` in ('Yes','Critical') or `wo.critical === true` |

**Sort Order:** Critical equipment first → days overdue DESC → component name ASC. Re-numbered after sort.

**Summary Metrics:**
- Total Overdue: `data.length`
- Critical Equip: count where `criticalEquip === 'YES'`
- Avg Days Overdue: mean of `daysOverdue` (integer values only)
- Max Days Overdue: max of `daysOverdue` array
- Calendar/RH: `calendarOverdueCount / rhOverdueCount`

**PDF Generator:** Uses `pdfReportGenerator.generateOverdueJobsReport()` — specialized A3 landscape layout with colored header bar. Conditional formatting: critical equipment rows get `bgDanger`, days >30 get `textDarkRed` bold, days >7 get `textDarkOrange` bold.

**Excel Endpoint:** POST `/technical/api/reports/overdue-jobs`  
**Excel Request Body:** `{ vesselId: string }`

---

#### Report 1.3: Completed Jobs Register

**Column Definition (11 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 8 |
| 2 | WO No | workOrderNo | 22 |
| 3 | Component | componentName | 28 |
| 4 | Job Title | jobTitle | 30 |
| 5 | Job Type | jobType | 14 |
| 6 | Dept | department | 12 |
| 7 | Priority | priority | 12 |
| 8 | Assigned To | assignedTo | 18 |
| 9 | Start Date | startDate | 16 |
| 10 | Completion Date | completionDate | 16 |
| 11 | Man Hours | manHours | 12 |

**Data Source:** Client-side filter on `vesselWorkOrders` where `status === 'Completed'`.

**Date Range Filtering:** Filters by `dateCompleted` or `completionDateTime` field against `categoryFilters.dateRange`.

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `duration` | `parseFloat(wo.totalTimeHours) \|\| ((endTime - startTime) / 3600000)` — hours |
| `manHours` | `parseFloat(wo.manhours) \|\| (duration * noOfPersons)` |
| `startDate` | `formatDateDDMMMYYYY(wo.startDateTime)` — DD-MMM-YYYY |
| `completionDate` | `formatDateDDMMMYYYY(wo.dateCompleted \|\| wo.completionDateTime)` |

**Sort Order:** `dateCompleted` DESC, then `workOrderNo` ASC.

**Summary Metrics:**
- Total Jobs: `data.length`
- Total Man-Hours: running sum of `manHours` across all rows, displayed as `toFixed(1)`

**Excel Endpoint:** POST `/technical/api/reports/completed-jobs`  
**Excel Request Body:** `{ vesselId: string, dateFrom?: string, dateTo?: string }`

---

#### Report 1.4: Monthly Maintenance Summary

**Column Definition (3 columns — KPI-style):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Metric | metric | 60 |
| 2 | Value | value | 40 |
| 3 | Percentage | percentage | 40 |

**Data Source:** Client-side aggregation of `vesselWorkOrders`.

**Period Determination:**
- Uses `globalFilters.dateRange` if both from/to are set
- Otherwise defaults to current calendar month (1st to last day)

**Derived Fields & Formulas:**

| Metric | Formula |
|--------|---------|
| Jobs In Scope | WOs where `dueDate` is within period OR `status=Completed` with `completionDateTime` in period |
| Completed | Subset of in-scope WOs where `status === 'Completed'` |
| Completion Rate | `Math.round((completedWOs / monthlyWOs) * 100)` — integer percentage |
| Cumulative Overdue | ALL WOs where `dueDate < periodEnd` AND `status !== 'Completed'` (not limited to period start) |
| Total Man-Hours | `sum(wo.manhours \|\| wo.totalTimeHours \|\| wo.actualHours)` for completed WOs |
| Department Breakdown | Group by `wo.department \|\| wo.assignedDepartment \|\| 'Unassigned'`, count planned/completed/overdue |
| Priority Breakdown | Group by `wo.jobPriority \|\| 'Normal'`, count total/completed/overdue |

**Data Sections:** The report outputs three sections separated by header rows:
1. Executive Summary (6 rows)
2. Priority Breakdown (dynamic rows)
3. Department Breakdown (dynamic rows)

**Excel Endpoint:** POST `/technical/api/reports/maintenance/monthly-summary/excel`  
**Excel Request Body:** `{ vesselId: string, startDate?: string, endDate?: string }`  
Excel uses a KPI dashboard layout rather than a simple table.

---

#### Report 1.5: Critical Equipment Status

**Column Definition (12 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 8 |
| 2 | Comp. Code | componentCode | 18 |
| 3 | Component Name | componentName | 38 |
| 4 | Critical | isCritical | 12 |
| 5 | Class Item | isClassItem | 12 |
| 6 | Dept | department | 15 |
| 7 | Location | location | 15 |
| 8 | Total WOs | totalWorkOrders | 12 |
| 9 | Overdue | overdueJobs | 12 |
| 10 | Due Soon | dueSoonJobs | 12 |
| 11 | Next Due | nextDueDate | 18 |
| 12 | Days | daysUntilDue | 10 |

**Data Source:** Server-side via GET `/technical/api/reports/critical-equipment-status?vesselId=...`

**Server Logic:** Queries components where `isCritical=true` OR `isClassItem=true`, joins with work_orders to count total/overdue/due-soon jobs per component. Returns pre-computed `metadata` with totals.

**Summary Metrics (from server metadata):**
- Total Critical Equipment, Critical Only, Class Item Only, Both Critical & Class
- With Overdue Jobs, Due Soon (7 days)

**PDF Generator:** Uses `pdfReportGenerator.generateCriticalEquipmentReport()` — specialized layout with metadata summary block.

**Excel Endpoint:** POST `/technical/api/reports/critical-equipment-status/excel`

---

#### Report 1.6: Unplanned/Breakdown Jobs

**Column Definition (11 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 8 |
| 2 | WO Number | workOrderNo | 20 |
| 3 | Comp. Code | componentCode | 15 |
| 4 | Component Name | componentName | 30 |
| 5 | Job Title | jobTitle | 25 |
| 6 | Description | briefDescription | 35 |
| 7 | Created Date | createdDate | 16 |
| 8 | Completed Date | completedDate | 16 |
| 9 | Performed By | performedBy | 18 |
| 10 | Hours | totalHours | 10 |
| 11 | Manhours | manhours | 12 |

**Data Source:** Server-side via GET `/technical/api/reports/unplanned-breakdown-jobs?vesselId=...&startDate=...&endDate=...`

**Date Defaults:** If no date range provided, defaults to current calendar month.

**Summary Metrics (from server metadata):**
- Total Unplanned Jobs, Total Manhours, Avg Time Taken (hrs), Date Range

**PDF Generator:** Uses `pdfReportGenerator.generateUnplannedBreakdownReport()`.

**Excel Endpoint:** POST `/technical/api/reports/unplanned-breakdown-jobs/excel`

---

#### Report 1.7: Job Postponement Log

**Column Definition (10 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sno | 12 |
| 2 | WO Number | workOrderNumber | 35 |
| 3 | Job Title | title | 55 |
| 4 | Component | componentName | 45 |
| 5 | Dept | department | 20 |
| 6 | Original Due | originalDue | 25 |
| 7 | New Due | newDue | 25 |
| 8 | Days Extended | daysExtended | 22 |
| 9 | Reason | reason | 50 |
| 10 | Status | status | 22 |

**Data Source:** Client-side filter: `vesselWorkOrders.filter(wo => wo.status === 'Postponed')`

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `daysExtended` | `Math.ceil((newDueDate - originalDueDate) / 86400000)` — only if both dates valid and result > 0 |
| `originalDue` | `formatDate(wo.originalDueDate \|\| wo.dueDate)` |
| `newDue` | `formatDate(wo.newDueDate \|\| wo.postponedToDate \|\| wo.dueDate)` |
| `reason` | `wo.postponementReason \|\| wo.remarks \|\| '-'` |
| `status` | Hardcoded `'Postponed'` |

**Excel Endpoint:** POST `/technical/api/reports/postponement-log`  
**Excel Request Body:** `{ vesselId: string }`

---

#### Report 1.8: Work Priority Performance

**Column Definition (5 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Priority | priority | 40 |
| 2 | Total WOs | total | 30 |
| 3 | Completed | completed | 30 |
| 4 | On-Time % | onTimePercent | 30 |
| 5 | Overdue | overdue | 30 |

**Data Source:** Client-side aggregation grouping by `wo.jobPriority || 'Normal'`.

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `onTimePercent` | `Math.round((completed / total) * 100)` + '%' |
| `overdue` | Count where `dueDate < now` AND `status !== 'Completed'` |

**Excel Export:** Not available (no endpoint).

---

#### Report 1.9: Man-Hours Analysis

**Column Definition (5 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | WO Number | workOrderNumber | 40 |
| 2 | Title | title | 60 |
| 3 | Planned Hrs | plannedHours | 30 |
| 4 | Actual Hrs | actualHours | 30 |
| 5 | Variance | variance | 30 |

**Data Source:** Client-side filter: `vesselWorkOrders.filter(wo => wo.status === 'Completed')`

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `plannedHours` | `wo.plannedHours \|\| wo.estimatedHours \|\| 0` |
| `actualHours` | `wo.actualHours \|\| wo.hoursSpent \|\| plannedHours` |
| `variance` | `actualHours - plannedHours` |

**Excel Export:** Not available (no endpoint).

---

#### Report 1.10: Crew Workload Distribution

**Column Definition (10 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Rank | rank | 45 |
| 2 | Dept | department | 25 |
| 3 | Total | total | 22 |
| 4 | Done | completed | 22 |
| 5 | Pending | pending | 22 |
| 6 | Overdue | overdue | 22 |
| 7 | Manhours | manhours | 28 |
| 8 | Avg Time | avgTime | 25 |
| 9 | Rate % | completionPercent | 25 |
| 10 | Load % | workloadPercent | 25 |

**Data Source:** Client-side aggregation grouping by `wo.assignedTo || wo.assignee || wo.performedBy || wo.responsibleRank || 'Unassigned'`.

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `manhours` | Sum of `Number(wo.manhours)` per assignee |
| `avgTime` | `(sum of totalTimeHours) / jobsWithTime` per assignee |
| `completionPercent` | `Math.round((completed / count) * 100)` + '%' |
| `workloadPercent` | `Math.round((assigneeManhours / totalManhours) * 100)` + '%' |

**Sort Order:** `manhours` DESC.

**Excel Endpoint:** POST `/technical/api/reports/crew-workload-distribution/excel`  
**Excel Request Body:** `{ vesselId: string, startDate?: string, endDate?: string, viewType: 'summary' }`

---

### Category 2: Running Hours

**Frontend:** `client/src/pages/reports/RunningHoursReports.tsx`  
**Excel Service:** `server/modules/reports/services/complianceReportService.ts` (anomaly), `server/modules/reports/services/operationsReportService.ts` (utilization)

---

#### Report 2.1: Equipment Utilization Summary

**Column Definition (10 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 12 |
| 2 | Code | componentCode | 30 |
| 3 | Component Name | componentName | 55 |
| 4 | Category | category | 35 |
| 5 | Current Hrs | currentHours | 25 |
| 6 | Period Hrs | periodHours | 25 |
| 7 | Avg Daily | avgDailyHours | 22 |
| 8 | Utilization | utilizationBand | 25 |
| 9 | Util % | utilizationPercent | 20 |
| 10 | Data Source | dataSource | 30 |

**Data Source:** Server-side via GET `/technical/api/reports/equipment-utilization-summary?vesselId=...&startDate=...&endDate=...`

**Server-side Logic:** Computes utilization bands (High/Normal/Low) based on average daily hours relative to expected operating hours per equipment type. Returns pre-computed `summary` with counts per band, `avgUtilization`, data quality breakdown (actual/estimated/noData).

**Summary Metrics:**
- Total Equipment, High/Normal/Low Utilization counts, Avg Utilization %, Actual Data count, Estimated count, No Data count

**Excel Endpoint:** POST `/technical/api/reports/equipment-utilization-summary/excel`

---

#### Report 2.2: Running Hours Anomaly Detection

**Column Definition (11 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 12 |
| 2 | Component Code | componentCode | 30 |
| 3 | Component Name | componentName | 50 |
| 4 | Prev RH | previousRh | 22 |
| 5 | New RH | newRh | 22 |
| 6 | Delta | delta | 20 |
| 7 | Days Between | daysBetween | 25 |
| 8 | Avg Daily | avgDailyHours | 22 |
| 9 | Type | anomalyType | 30 |
| 10 | Severity | severity | 22 |
| 11 | Description | description | 60 |

**Data Source:** Server-side via GET `/technical/api/reports/running-hours-anomaly-detection?vesselId=...&startDate=...&endDate=...`

**Anomaly Types (server-computed):**
| Type | Detection Rule |
|------|---------------|
| `high_increment` | Delta exceeds expected daily hours × days × threshold multiplier |
| `negative_delta` | New RH < Previous RH (meter rollback) |
| `zero_change` | Delta is 0 over a significant time period |
| `irregular_pattern` | Avg daily hours deviates significantly from historical pattern |
| `meter_replaced` | Large positive discontinuity suggesting meter replacement |

**Severity Levels:** `critical`, `warning`, `info`

**Summary Metrics:**
- Total Anomalies, Critical count, Warning count, Info count, Logs Analyzed, Components Analyzed

**Excel Endpoint:** POST `/technical/api/reports/running-hours-anomaly-detection/excel`

---

### Category 3: Spares

**Frontend:** `client/src/pages/reports/SparesReports.tsx`  
**Excel Service:** `server/modules/reports/services/sparesReportService.ts`

---

#### Report 3.1: Critical Spares Availability

**Column Definition (10 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 10 |
| 2 | Part Code | partCode | 28 |
| 3 | Part Name | partName | 45 |
| 4 | ROB | rob | 12 |
| 5 | Min Stock | minStock | 15 |
| 6 | Status | stockStatus | 18 |
| 7 | Shortage | shortageQty | 15 |
| 8 | Criticality | criticalityLevel | 18 |
| 9 | Critical Equip | criticalEquip | 20 |
| 10 | Remarks | remarks | 45 |

**Data Source:** Server-side via GET `/technical/api/reports/critical-spares/preview?vesselId=...`

**Derived Fields:**
- `criticalEquip`: `'YES'` if `linkedToCriticalEquipment === true`, else `'NO'`
- `shortageQty`: Pre-computed server-side as `max(0, minStock - rob)`

**Excel Endpoint:** POST `/technical/api/reports/critical-spares`

---

#### Report 3.2: Low Stock Alert (Spares)

**Column Definition (8 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sno | 12 |
| 2 | Part Code | partCode | 30 |
| 3 | Part Name | partName | 50 |
| 4 | Component | componentName | 45 |
| 5 | Current Qty | currentQty | 20 |
| 6 | Min Qty | minQty | 18 |
| 7 | Shortage | shortage | 20 |
| 8 | Status | status | 25 |

**Data Source:** Server-side via GET `/technical/api/reports/low-stock-alert/:vesselId`

**Key Formula:** `shortage = minQty - currentQty` (server-computed)

**Excel Endpoint:** POST `/technical/api/reports/low-stock-alert/:vesselId/excel`

---

#### Report 3.3: Consumption Pattern Analysis (Spares)

**Column Definition (10 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sno | 12 |
| 2 | Part Code | partCode | 28 |
| 3 | Part Name | partName | 45 |
| 4 | Component | componentName | 40 |
| 5 | Total Consumed | totalConsumed | 25 |
| 6 | Consumption Events | consumptionEvents | 28 |
| 7 | Current ROB | currentRob | 22 |
| 8 | Min Stock | minStock | 18 |
| 9 | Status | status | 18 |
| 10 | Last Consumed | lastConsumed | 25 |

**Data Source:** Server-side via GET `/technical/api/reports/consumption-analysis/:vesselId`

**Excel Endpoint:** POST `/technical/api/reports/consumption-analysis/:vesselId/excel`

---

### Category 4: Stores

**Frontend:** `client/src/pages/reports/StoresReports.tsx`  
**Excel Service:** `server/modules/reports/services/storesReportService.ts`

---

#### Report 4.1: Stores Inventory Status

**Column Definition (8 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Item Code | itemCode | 30 |
| 2 | Item Name | itemName | 55 |
| 3 | Category | category | 30 |
| 4 | ROB | rob | 20 |
| 5 | Min | min | 20 |
| 6 | Location A | locationA | 25 |
| 7 | Location B | locationB | 25 |
| 8 | Status | status | 25 |

**Data Source:** Client-side from useQuery `/technical/api/stores` (or `/technical/api/stores/:vesselId`).

**Stock Status Logic (client-side):**
```
if rob === 0 → 'Critical'
if rob <= min → 'Low'
else → 'OK'
```

**Excel Endpoint:** POST `/technical/api/reports/stores-inventory-status/:vesselId/excel`

---

#### Report 4.2: Lubricants & Oil Analysis

**Column Definition (6 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Item Code | itemCode | 30 |
| 2 | Item Name | itemName | 60 |
| 3 | ROB | rob | 25 |
| 4 | Min | min | 25 |
| 5 | UOM | uom | 25 |
| 6 | Status | status | 30 |

**Data Source:** Client-side filter: `storesItems.filter(s => s.itemType === 'lubes')`

**Excel Export:** Not available (PDF only).

---

#### Report 4.3: Chemicals Inventory & Expiry

**Column Definition (9 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Item Code | itemCode | 25 |
| 2 | Item Name | itemName | 45 |
| 3 | Batch # | batchNumber | 25 |
| 4 | Expiry Date | expiryDate | 25 |
| 5 | Hazard | hazardClassification | 25 |
| 6 | SDS Ref | sdsReference | 25 |
| 7 | ROB | rob | 20 |
| 8 | Min | min | 20 |
| 9 | Status | status | 25 |

**Data Source:** Client-side filter: `storesItems.filter(s => s.itemType === 'chemicals')`

**Expiry Logic:**
```
days = Math.floor((expiryDate - today) / 86400000)
if days < 0  → 'EXPIRED'
if days ≤ 30 → display as "{days}d"
if days ≤ 90 → display as "{days}d"
else         → 'OK'
```

**SDS Compliance:** `Math.round((withSds / total) * 100)` — percentage of items with a non-empty `sdsReference`.

**Excel Export:** Not available (PDF only).

---

#### Report 4.4: Stores Low Stock Alert

**Column Definition (13 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sno | 12 |
| 2 | Priority | priority | 18 |
| 3 | Item Code | itemCode | 22 |
| 4 | Item Name | itemName | 40 |
| 5 | Type | itemType | 20 |
| 6 | Category | category | 22 |
| 7 | ROB | rob | 15 |
| 8 | Min Stock | minStock | 15 |
| 9 | Deficit | deficit | 15 |
| 10 | UOM | uom | 15 |
| 11 | Avg Monthly | avgMonthly | 20 |
| 12 | Days to Stockout | daysToStockout | 22 |
| 13 | Est. Cost | estCost | 20 |

**Data Source:** Server-side via GET `/technical/api/reports/stores-low-stock-alert/:vesselId`

**Key Formulas (server-computed):**
- `deficit = max(0, minStock - rob)`
- `daysToStockout = (rob / avgMonthlyConsumption) * 30` (if avgMonthlyConsumption > 0)

**Excel Endpoint:** POST `/technical/api/reports/stores-low-stock-alert/:vesselId/excel`

---

### Category 5: Compliance (IHM)

**Frontend:** `client/src/pages/reports/IhmReports.tsx`  
**Excel Service:** `server/modules/reports/services/complianceReportService.ts`

---

#### Report 5.1: IHM Inventory Status

**Column Definition (10 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sNo | 8 |
| 2 | Item Code | itemCode | 18 |
| 3 | Item Name | itemName | 38 |
| 4 | Item Type | itemType | 14 |
| 5 | Component/Category | category | 20 |
| 6 | IHM Status | ihmStatus | 16 |
| 7 | Evidence Type | evidenceType | 16 |
| 8 | Current ROB | currentRob | 14 |
| 9 | Location | location | 16 |
| 10 | UOM | uom | 10 |

**Data Source:** Server-side via GET `/technical/api/reports/ihm-inventory-status?vesselId=...`

**Excel Endpoint:** POST `/technical/api/reports/ihm-inventory-status/excel`

---

### Category 6: Change Requests

**Frontend:** `client/src/pages/reports/ChangeRequestReports.tsx`  
**Excel Service:** `server/modules/reports/services/changeRequestReportService.ts`

---

#### Report 6.1: Change Requests Status & Tracking

**Column Definition (13 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | ID | id | 10 |
| 2 | Title | title | 40 |
| 3 | Category | category | 18 |
| 4 | Status | status | 16 |
| 5 | Requested By | requestedBy | 20 |
| 6 | Vessel | vessel | 18 |
| 7 | Submitted | submittedAt | 18 |
| 8 | Reviewed By | reviewedBy | 20 |
| 9 | Reviewed At | reviewedAt | 18 |
| 10 | Cycle Time (hrs) | cycleTime | 16 |
| 11 | Target | target | 28 |
| 12 | Changes | changesCount | 12 |
| 13 | Reason | reason | 30 |

**Data Source:** Server-side via GET `/technical/api/reports/change-requests-status-tracking?vesselId=...&status=...&category=...&startDate=...&endDate=...`

**Derived Fields:**

| Field | Formula |
|-------|---------|
| `cycleTime` | `req.cycleTimeHours` — server-computed as `(reviewedAt - submittedAt)` in hours |
| `approvalRate` | `Math.round((approved / totalRequests) * 100)` — summary metric |
| `title` | Truncated to 50 chars with '...' if longer |
| `target` | `"{CategoryLabel} - {targetInfo.name}"` |

**Category Labels:** `components → 'Components'`, `work_orders → 'Work Orders'`, `spares → 'Spares'`, `stores → 'Stores'`
**Status Labels:** `draft → 'Draft'`, `submitted → 'Submitted'`, `returned → 'Returned'`, `approved → 'Approved'`, `rejected → 'Rejected'`

**Summary Metrics:**
- Total Requests, Approved (with %), Rejected (with %), Pending Review, Avg Approval Time (hrs)
- Breakdown by category: Components, Work Orders, Spares, Stores

**Excel Endpoint:** GET `/technical/api/reports/change-requests-status-tracking/export?vesselId=...&status=...&category=...`  
Note: This is a GET request (not POST), unlike most other Excel exports.

---

### Category 7: LSA/FFA

**Frontend:** `client/src/pages/reports/LsaFfaReports.tsx`  
**Backend Controller:** `server/modules/reports/controllers/equipmentReportsController.ts`

---

#### Report 7.1: LSA/FFA Equipment Master List

**Column Definition (12 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sno | 8 |
| 2 | Component Code | componentCode | 22 |
| 3 | Component Name | componentName | 40 |
| 4 | Equipment Type | equipmentType | 16 |
| 5 | Location | location | 20 |
| 6 | Maker | maker | 20 |
| 7 | Model | model | 20 |
| 8 | Serial No | serialNo | 18 |
| 9 | Installation Date | installationDate | 16 |
| 10 | Criticality | critical | 12 |
| 11 | Class Item | classItem | 12 |
| 12 | Active | isActive | 10 |

**Data Source:** Server-side via GET `/technical/api/reports/lsa-ffa-master-list?vesselId=...&equipmentType=...`

**Query Filters:**
- `vesselId` — vessel filter
- `equipmentType` — 'LSA', 'FFA', or omitted for all

**Summary Metrics:** Total LSA, Total FFA, Total Combined, Active count.

**Excel Export:** GET `/technical/api/reports/lsa-ffa-master-list?vesselId=...&format=excel`  
Uses `format=excel` query param on same endpoint (not a separate POST).

---

#### Report 7.2: LSA/FFA Maintenance Schedule & Status

**Column Definition (16 columns):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | S.No | sno | 6 |
| 2 | Comp Code | componentCode | 16 |
| 3 | Component Name | componentName | 28 |
| 4 | Type | equipmentType | 8 |
| 5 | Location | location | 16 |
| 6 | Job Code | jobCode | 14 |
| 7 | Job Title | jobTitle | 30 |
| 8 | Task Type | taskType | 14 |
| 9 | Basis | maintenanceBasis | 12 |
| 10 | Frequency | frequency | 12 |
| 11 | Next Due | nextDueDate | 14 |
| 12 | Days | daysUntilDue | 8 |
| 13 | Status | status | 12 |
| 14 | Last Done | lastDoneDate | 14 |
| 15 | Last WO | lastWONumber | 16 |
| 16 | Assigned To | assignedTo | 14 |

**Data Source:** Server-side via GET `/technical/api/reports/lsa-ffa-maintenance-schedule?vesselId=...&equipmentType=...&status=...`

**Query Filters:**
- `vesselId`, `equipmentType` — same as master list
- `status` — 'overdue', 'due-soon', 'on-schedule', or omitted for all

**Summary Metrics:** Total Items, On Schedule, Due Soon, Overdue.

**Excel Export:** GET `/technical/api/reports/lsa-ffa-maintenance-schedule?vesselId=...&format=excel`

---

## Section C: Formula & Logic Index

### Date / Time Formulas

| Formula Name | Expression | Used In | Notes |
|-------------|------------|---------|-------|
| Days Remaining | `Math.ceil((dueDate - now) / 86400000)` | 1.1 Due Jobs | Negative = overdue |
| Days Overdue | `Math.floor((now - dueDate) / 86400000)` | 1.2 Overdue Jobs | Calendar days past due |
| RH Overdue | `Math.max(0, currentCumulativeRH - nextDueReading)` | 1.2 Overdue Jobs | Running-hour excess |
| Days Extended | `Math.ceil((newDueDate - originalDueDate) / 86400000)` | 1.7 Postponement Log | 0 or negative → '-' |
| Duration (hours) | `(endTime - startTime) / 3600000` | 1.3 Completed Jobs | Milliseconds → hours |
| Expiry Days | `Math.floor((expiryDate - today) / 86400000)` | 4.3 Chemicals | Negative = expired |
| Cycle Time | `reviewedAt - submittedAt` (hours) | 6.1 Change Requests | Server-computed |

### Threshold / Status Formulas

| Formula Name | Expression | Used In |
|-------------|------------|---------|
| Due Jobs Status | days < 0 → OVERDUE; ≤ 2 → URGENT; ≤ 7 → DUE; else ACTIVE | 1.1 |
| Overdue Grace (Calendar) | Include if `dueDate < (now - 7 days)` | 1.2 |
| Overdue Grace (RH) | Include if `(currentRH - nextDueRH) > 168` | 1.2 |
| Stock Status (Stores) | rob === 0 → Critical; rob ≤ min → Low; else OK | 4.1, 4.2, 4.3 |
| Shortage | `max(0, minQty - currentQty)` | 3.2, 4.4 |
| Days to Stockout | `(rob / avgMonthlyConsumption) * 30` | 4.4 |

### Aggregation / Rate Formulas

| Formula Name | Expression | Used In |
|-------------|------------|---------|
| Man-Hours | `parseFloat(wo.manhours) \|\| (duration × noOfPersons)` | 1.3, 1.4, 1.10 |
| Completion Rate | `Math.round((completed / total) * 100)` | 1.4, 1.8, 1.10 |
| Workload % | `Math.round((assigneeManhours / totalManhours) * 100)` | 1.10 |
| Approval Rate | `Math.round((approved / totalRequests) * 100)` | 6.1 |
| SDS Compliance | `Math.round((withSds / totalChemicals) * 100)` | 4.3 |
| Variance | `actualHours - plannedHours` | 1.9 |

---

## Section D: Troubleshooting Matrix

### Common Issues

| Symptom | Likely Cause | Diagnostic Steps | Resolution |
|---------|-------------|------------------|------------|
| Report shows 0 rows | No matching data for filters | 1. Check vessel selection (must not be 'all' for most exports). 2. Verify date range isn't empty. 3. Check work order statuses in DB. | Adjust filters or verify data exists. |
| Excel has different columns than view | Column definition drift | 1. Compare column array in frontend switch block vs Excel service file. 2. Check the service file in `server/modules/reports/services/`. | Align Excel service columns to match frontend column array. |
| PDF missing conditional formatting | Column field name mismatch | 1. Check `didParseCell` callback in `pdfReportGenerator.ts`. 2. Verify field names match (`statusIndicator`, `priority`, `daysRemaining`). | Update field names in the conditional formatting logic. |
| "Vessel Required" error on export | `effectiveVesselId` is 'all' or empty | Server-side Excel endpoints require a specific vessel ID. | Select a specific vessel before exporting. |
| Man-hours showing 0 or '—' | Missing `manhours`, `totalTimeHours`, or `startDateTime/completionDateTime` | Check if the WO has time tracking fields populated in the database. | Ensure work orders have time tracking data entered. |
| Overdue jobs not appearing | Grace period filtering | Due Jobs includes all overdue; Overdue Jobs only shows past 7-day grace period. A job 3 days overdue appears in 1.1 but NOT in 1.2. | Understand the two-tier overdue threshold. |
| Monthly summary shows unexpected overdue count | Cumulative overdue logic | Overdue count is cumulative (ALL WOs with `dueDate < periodEnd` and not completed), not just new overdue in the period. | This is by design for reporting total backlog. |
| RH anomaly report empty | No running hours log entries | Check if the vessel has components with `trackRunningHours=true` and actual RH log entries. | Enter running hours data for monitored equipment. |
| Chemical expiry showing wrong status | Timezone mismatch | Date comparison uses `new Date()` which is UTC-based. Items near midnight boundary may show off-by-one. | Verify expiry dates in the data. |
| Excel download fails with 500 | Server-side service error | 1. Check server logs for stack trace. 2. Verify the service file exists and exports the expected function. 3. Check DB connection. | Fix server-side error per stack trace. |

### API Endpoint Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/technical/api/reports/due-jobs-7-days` | Due Jobs Excel |
| POST | `/technical/api/reports/overdue-jobs` | Overdue Jobs Excel |
| POST | `/technical/api/reports/completed-jobs` | Completed Jobs Excel |
| POST | `/technical/api/reports/postponement-log` | Postponement Log Excel |
| POST | `/technical/api/reports/maintenance/monthly-summary/excel` | Monthly Summary Excel |
| POST | `/technical/api/reports/unplanned-breakdown-jobs/excel` | Unplanned Jobs Excel |
| POST | `/technical/api/reports/critical-equipment-status/excel` | Critical Equipment Excel |
| POST | `/technical/api/reports/crew-workload-distribution/excel` | Workload Distribution Excel |
| POST | `/technical/api/reports/equipment-utilization-summary/excel` | Utilization Summary Excel |
| POST | `/technical/api/reports/running-hours-anomaly-detection/excel` | RH Anomaly Excel |
| POST | `/technical/api/reports/critical-spares` | Critical Spares Excel |
| POST | `/technical/api/reports/low-stock-alert/:vesselId/excel` | Spares Low Stock Excel |
| POST | `/technical/api/reports/consumption-analysis/:vesselId/excel` | Spares Consumption Excel |
| POST | `/technical/api/reports/stores-inventory-status/:vesselId/excel` | Stores Inventory Excel |
| POST | `/technical/api/reports/stores-low-stock-alert/:vesselId/excel` | Stores Low Stock Excel |
| POST | `/technical/api/reports/ihm-inventory-status/excel` | IHM Inventory Excel |
| GET | `/technical/api/reports/change-requests-status-tracking/export` | CR Tracking Excel |
| GET | `/technical/api/reports/lsa-ffa-master-list?format=excel` | LSA/FFA Master Excel |
| GET | `/technical/api/reports/lsa-ffa-maintenance-schedule?format=excel` | LSA/FFA Schedule Excel |

### Architecture Pattern Reference

**Column Definition Flow:**
```
Frontend switch block → defines columns[] array
  ├── setPreviewData({ columns, data }) → View/Preview (inline table)
  ├── pdfReportGenerator.generateReport(config, columns, data) → PDF download
  └── Excel: separate service file must manually mirror columns
```

**Key Invariant:** The View and PDF always share the same column array (single source of truth). Excel services must be manually kept in sync.

**PDF Generation Methods:**
| Method | Used By | Paper Size |
|--------|---------|------------|
| `generateReport()` | Most reports | A4 landscape (default) |
| `generateOverdueJobsReport()` | 1.2 Overdue Jobs | A3 landscape, colored header |
| `generateCriticalEquipmentReport()` | 1.5 Critical Equipment | Custom with metadata block |
| `generateUnplannedBreakdownReport()` | 1.6 Unplanned Jobs | Custom styling |
| `generateCompletedJobsRegisterReport()` | Legacy (no longer used) | Was A3 with 24 cols |

---

## Section E: Discrepancy History (Phase 1 Fixes)

### Pre-Fix Discrepancies Found & Resolved

| # | Report | Mode | Pre-Fix Cols | Post-Fix Cols | Root Cause | Fix Applied |
|---|--------|------|--------------|---------------|------------|-------------|
| 1 | Due Jobs (7 Days) | Excel | 18 (STANDARD_WORK_ORDER_COLUMNS) | 8 | Used generic 18-col template | Replaced with 8 report-specific columns |
| 2 | Overdue Jobs | Excel | 18 (STANDARD_WORK_ORDER_COLUMNS) | 15 | Used generic 18-col template | Replaced with 15 report-specific columns |
| 3 | Completed Jobs | PDF | 24 (generateCompletedJobsRegisterReport) | 11 | Used specialized 24-col PDF generator | Switched to `generateReport()` with 11-column array |
| 4 | Completed Jobs | Excel | 24 (custom columns) | 11 | Used custom 24-col definition with audit fields | Reduced to 11 columns |
| 5 | Postponement Log | Excel | 19 (custom columns) | 10 | Included 9 extra approval/audit columns | Reduced to 10 columns |

### Post-Fix Verification (All 22 Reports)

| # | Report | View | PDF | Excel | Status |
|---|--------|------|-----|-------|--------|
| 1.1 | Due Jobs (7 Days) | 8 | 8 | 8 | Aligned |
| 1.2 | Overdue Jobs | 15 | 15 | 15 | Aligned |
| 1.3 | Completed Jobs Register | 11 | 11 | 11 | Aligned |
| 1.4 | Monthly Maintenance Summary | 3 | 3 | KPI | Aligned |
| 1.5 | Critical Equipment Status | 12 | 12 | 12 | Aligned |
| 1.6 | Unplanned/Breakdown Jobs | 11 | 11 | 11 | Aligned |
| 1.7 | Job Postponement Log | 10 | 10 | 10 | Aligned |
| 1.8 | Work Priority Performance | 5 | 5 | N/A | Aligned |
| 1.9 | Man-Hours Analysis | 5 | 5 | N/A | Aligned |
| 1.10 | Crew Workload Distribution | 10 | 10 | 10 | Aligned |
| 2.1 | Equipment Utilization Summary | 10 | 10 | 10 | Aligned |
| 2.2 | RH Anomaly Detection | 11 | 11 | 11 | Aligned |
| 3.1 | Critical Spares Availability | 10 | 10 | 10 | Aligned |
| 3.2 | Low Stock Alert (Spares) | 8 | 8 | 8 | Aligned |
| 3.3 | Consumption Analysis (Spares) | 10 | 10 | 10 | Aligned |
| 4.1 | Stores Inventory Status | 8 | 8 | 8 | Aligned |
| 4.2 | Lubricants & Oil Analysis | 6 | 6 | N/A | Aligned |
| 4.3 | Chemicals Inventory & Expiry | 9 | 9 | N/A | Aligned |
| 4.4 | Stores Low Stock Alert | 13 | 13 | 13 | Aligned |
| 5.1 | IHM Inventory Status | 10 | 10 | 10 | Aligned |
| 6.1 | CR Status & Tracking | 13 | 13 | 13 | Aligned |
| 7.1 | LSA/FFA Equipment Master | 12 | 12 | 12 | Aligned |
| 7.2 | LSA/FFA Maintenance Schedule | 16 | 16 | 16 | Aligned |

**Remaining Known Divergence:** None. All reports fully aligned.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `client/src/pages/reports/MaintenanceReports.tsx` | Maintenance category (10 reports): view columns + PDF generation |
| `client/src/pages/reports/RunningHoursReports.tsx` | Running Hours category (2 reports): view + PDF |
| `client/src/pages/reports/SparesReports.tsx` | Spares category (3 reports): view + PDF |
| `client/src/pages/reports/StoresReports.tsx` | Stores category (5 reports): view + PDF |
| `client/src/pages/reports/ChangeRequestReports.tsx` | Change Requests (1 report): view + PDF |
| `client/src/pages/reports/LsaFfaReports.tsx` | LSA/FFA Equipment (2 reports): view + PDF |
| `client/src/lib/pdfReportGenerator.ts` | PDF generation: generic + specialized methods |
| `server/modules/reports/routes.ts` | All report API route definitions |
| `server/modules/reports/services/maintenanceReportService.ts` | Maintenance Excel exports |
| `server/modules/reports/services/equipmentReportService.ts` | Equipment + LSA/FFA Excel exports |
| `server/modules/reports/services/complianceReportService.ts` | Running Hours + IHM Excel exports |
| `server/modules/reports/services/operationsReportService.ts` | Utilization + Workload Excel exports |
| `server/modules/reports/services/sparesReportService.ts` | Spares Excel exports |
| `server/modules/reports/services/storesReportService.ts` | Stores Excel exports |
| `server/modules/reports/services/changeRequestReportService.ts` | Change Requests Excel export |
| `server/lib/excelReportStyles.ts` | Shared Excel styles (STANDARD_WORK_ORDER_COLUMNS — legacy) |
