# PMS Reports Module — Comprehensive Audit Document

> **Generated:** 2026-03-31  
> **Scope:** All 22 reports across 8 categories  
> **Purpose:** Document every report's column definitions for View/Preview, PDF export, and Excel export; identify and resolve all discrepancies so exports match the view.

---

## Section A: Master Report Inventory

| # | Category | Report Name | View | PDF | Excel | Aligned |
|---|----------|-------------|------|-----|-------|---------|
| 1.1 | Maintenance | Due Jobs (7 Days) | 8 cols | 8 cols | 8 cols | Yes |
| 1.2 | Maintenance | Overdue Jobs | 15 cols | 15 cols | 15 cols | Yes |
| 1.3 | Maintenance | Completed Jobs Register | 11 cols | 11 cols | 11 cols | Yes |
| 1.4 | Maintenance | Monthly Maintenance Summary | 3 cols | 3 cols | KPI layout | Yes |
| 1.5 | Maintenance | Critical Equipment Status | 12 cols | 12 cols | 12 cols | Yes |
| 1.6 | Maintenance | Unplanned/Breakdown Jobs | 11 cols | 11 cols | 11 cols | Yes |
| 1.7 | Maintenance | Job Postponement Log | 10 cols | 10 cols | 10 cols | Yes |
| 1.8 | Maintenance | Work Priority Performance | 5 cols | 5 cols | N/A | Yes |
| 1.9 | Maintenance | Man-Hours Analysis | 5 cols | 5 cols | N/A | Yes |
| 1.10 | Maintenance | Crew Workload Distribution | 10 cols | 10 cols | 10 cols | Yes |
| 2.1 | Running Hours | Running Hours Log | Variable | Variable | Variable | Yes |
| 2.2 | Running Hours | RH Anomaly Detection | Variable | Variable | Variable | Yes |
| 3.1 | Spares | Critical Spares Availability | Variable | Variable | Variable | Yes |
| 3.2 | Spares | Low Stock Alert | Variable | Variable | Variable | Yes |
| 3.3 | Spares | Spares Consumption Analysis | Variable | Variable | Variable | Yes |
| 4.1 | Stores | Stores Inventory Status | Variable | Variable | Variable | Yes |
| 4.2 | Stores | Stores Consumption Analysis | Variable | Variable | Variable | Yes |
| 4.3 | Stores | Combined Consumption Report | Variable | Variable | Variable | Yes |
| 4.4 | Stores | Stores Low Stock Alert | Variable | Variable | Variable | Yes |
| 5.1 | IHM | IHM Inventory Status | 10 cols | 10 cols | 10 cols | Yes |
| 6.1 | Change Requests | CR Status & Tracking | 13 cols | 13 cols | 13 cols | Yes |
| 7.1 | LSA/FFA | Equipment Master List | 12 cols | 12 cols | 12 cols | Yes |
| 7.2 | LSA/FFA | Maintenance Schedule & Status | 16 cols | 16 cols | 16 cols | Yes |

---

## Section B: Per-Report Column Details

### Category 1: Maintenance & Work Orders

**Source files:**
- Frontend: `client/src/pages/reports/MaintenanceReports.tsx`
- PDF generator: `client/src/lib/pdfReportGenerator.ts`
- Excel service: `server/modules/reports/services/maintenanceReportService.ts`

#### Report 1.1: Due Jobs (7 Days)

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | Priority | Yes | Yes | Yes |
| 2 | Status | Yes | Yes | Yes |
| 3 | WO Number | Yes | Yes | Yes |
| 4 | Title | Yes | Yes | Yes |
| 5 | Component | Yes | Yes | Yes |
| 6 | Due Date | Yes | Yes | Yes |
| 7 | Days Left | Yes | Yes | Yes |
| 8 | Assigned To | Yes | Yes | Yes |

#### Report 1.2: Overdue Jobs

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | WO No | Yes | Yes | Yes |
| 3 | Job Title | Yes | Yes | Yes |
| 4 | Comp Code | Yes | Yes | Yes |
| 5 | Component Name | Yes | Yes | Yes |
| 6 | Dept | Yes | Yes | Yes |
| 7 | Due Date | Yes | Yes | Yes |
| 8 | Days Overdue | Yes | Yes | Yes |
| 9 | Next Due RH | Yes | Yes | Yes |
| 10 | Current RH | Yes | Yes | Yes |
| 11 | RH Overdue | Yes | Yes | Yes |
| 12 | Type | Yes | Yes | Yes |
| 13 | Assigned To | Yes | Yes | Yes |
| 14 | Last Done | Yes | Yes | Yes |
| 15 | Critical | Yes | Yes | Yes |

#### Report 1.3: Completed Jobs Register

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | WO No | Yes | Yes | Yes |
| 3 | Component | Yes | Yes | Yes |
| 4 | Job Title | Yes | Yes | Yes |
| 5 | Job Type | Yes | Yes | Yes |
| 6 | Dept | Yes | Yes | Yes |
| 7 | Priority | Yes | Yes | Yes |
| 8 | Assigned To | Yes | Yes | Yes |
| 9 | Start Date | Yes | Yes | Yes |
| 10 | Completion Date | Yes | Yes | Yes |
| 11 | Man Hours | Yes | Yes | Yes |

#### Report 1.4: Monthly Maintenance Summary

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | Metric | Yes | Yes | KPI layout |
| 2 | Value | Yes | Yes | KPI layout |
| 3 | Percentage | Yes | Yes | KPI layout |

Monthly Summary uses a KPI dashboard layout in Excel rather than a simple table. The same metrics are displayed in both formats.

#### Report 1.5: Critical Equipment Status

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | Comp. Code | Yes | Yes | Yes |
| 3 | Component Name | Yes | Yes | Yes |
| 4 | Critical | Yes | Yes | Yes |
| 5 | Class Item | Yes | Yes | Yes |
| 6 | Dept | Yes | Yes | Yes |
| 7 | Location | Yes | Yes | Yes |
| 8 | Total WOs | Yes | Yes | Yes |
| 9 | Overdue | Yes | Yes | Yes |
| 10 | Due Soon | Yes | Yes | Yes |
| 11 | Next Due | Yes | Yes | Yes |
| 12 | Days | Yes | Yes | Yes |

#### Report 1.6: Unplanned/Breakdown Jobs

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | WO Number | Yes | Yes | Yes |
| 3 | Comp. Code | Yes | Yes | Yes |
| 4 | Component Name | Yes | Yes | Yes |
| 5 | Job Title | Yes | Yes | Yes |
| 6 | Description | Yes | Yes | Yes |
| 7 | Created Date | Yes | Yes | Yes |
| 8 | Completed Date | Yes | Yes | Yes |
| 9 | Performed By | Yes | Yes | Yes |
| 10 | Hours | Yes | Yes | Yes |
| 11 | Manhours | Yes | Yes | Yes |

#### Report 1.7: Job Postponement Log

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | WO Number | Yes | Yes | Yes |
| 3 | Job Title | Yes | Yes | Yes |
| 4 | Component | Yes | Yes | Yes |
| 5 | Dept | Yes | Yes | Yes |
| 6 | Original Due | Yes | Yes | Yes |
| 7 | New Due | Yes | Yes | Yes |
| 8 | Days Extended | Yes | Yes | Yes |
| 9 | Reason | Yes | Yes | Yes |
| 10 | Status | Yes | Yes | Yes |

#### Report 1.8: Work Priority Performance

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | Priority | Yes | Yes | N/A |
| 2 | Total WOs | Yes | Yes | N/A |
| 3 | Completed | Yes | Yes | N/A |
| 4 | On-Time % | Yes | Yes | N/A |
| 5 | Overdue | Yes | Yes | N/A |

No Excel export endpoint exists for this report.

#### Report 1.9: Man-Hours Planned vs Actual

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | WO Number | Yes | Yes | N/A |
| 2 | Title | Yes | Yes | N/A |
| 3 | Planned Hrs | Yes | Yes | N/A |
| 4 | Actual Hrs | Yes | Yes | N/A |
| 5 | Variance | Yes | Yes | N/A |

No Excel export endpoint exists for this report.

#### Report 1.10: Crew Workload Distribution

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | Rank | Yes | Yes | Yes |
| 2 | Dept | Yes | Yes | Yes |
| 3 | Total | Yes | Yes | Yes |
| 4 | Done | Yes | Yes | Yes |
| 5 | Pending | Yes | Yes | Yes |
| 6 | Overdue | Yes | Yes | Yes |
| 7 | Manhours | Yes | Yes | Yes |
| 8 | Avg Time | Yes | Yes | Yes |
| 9 | Rate % | Yes | Yes | Yes |
| 10 | Load % | Yes | Yes | Yes |

### Category 2: Running Hours

**Source files:**
- Frontend: `client/src/pages/reports/RunningHoursReports.tsx`
- Excel service: `server/modules/reports/services/complianceReportService.ts`

#### Report 2.1: Running Hours Log
Columns are dynamically generated based on component data. View, PDF, and Excel all use the same data structure.

#### Report 2.2: Running Hours Anomaly Detection
Columns are dynamically generated. View, PDF, and Excel all use the same data structure.

### Category 3: Spares

**Source files:**
- Frontend: `client/src/pages/reports/SparesReports.tsx`
- Excel service: `server/modules/reports/services/sparesReportService.ts`

#### Report 3.1: Critical Spares Availability
Server-side column definitions match frontend column definitions. Already aligned.

#### Report 3.2: Low Stock Alert
Server-side column definitions match frontend column definitions. Already aligned.

#### Report 3.3: Spares Consumption Analysis
Server-side column definitions match frontend column definitions. Already aligned.

### Category 4: Stores

**Source files:**
- Frontend: `client/src/pages/reports/StoresReports.tsx`
- Excel service: `server/modules/reports/services/storesReportService.ts`

#### Report 4.1-4.4: All Stores Reports
Server-side column definitions match frontend column definitions for all four stores reports. Already aligned.

### Category 5: IHM

**Source files:**
- Frontend: `client/src/pages/reports/IhmReports.tsx`
- Excel service: `server/modules/reports/services/complianceReportService.ts`

#### Report 5.1: IHM Inventory Status

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | Item Code | Yes | Yes | Yes |
| 3 | Item Name | Yes | Yes | Yes |
| 4 | Item Type | Yes | Yes | Yes |
| 5 | Component/Category | Yes | Yes | Yes |
| 6 | IHM Status | Yes | Yes | Yes |
| 7 | Evidence Type | Yes | Yes | Yes |
| 8 | Current ROB | Yes | Yes | Yes |
| 9 | Location | Yes | Yes | Yes |
| 10 | UOM | Yes | Yes | Yes |

### Category 6: Change Requests

**Source files:**
- Frontend: `client/src/pages/reports/ChangeRequestReports.tsx`
- Excel service: `server/modules/reports/services/changeRequestReportService.ts`

#### Report 6.1: Change Requests Status & Tracking

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | ID | Yes | Yes | Yes |
| 2 | Title | Yes | Yes | Yes |
| 3 | Category | Yes | Yes | Yes |
| 4 | Status | Yes | Yes | Yes |
| 5 | Requested By | Yes | Yes | Yes |
| 6 | Vessel | Yes | Yes | Yes |
| 7 | Submitted | Yes | Yes | Yes |
| 8 | Reviewed By | Yes | Yes | Yes |
| 9 | Reviewed At | Yes | Yes | Yes |
| 10 | Cycle Time (hrs) | Yes | Yes | Yes |
| 11 | Target | Yes | Yes | Yes |
| 12 | Changes | Yes | Yes | Yes |
| 13 | Reason | Yes | Yes | Yes |

### Category 7: LSA/FFA

**Source files:**
- Frontend: `client/src/pages/reports/LsaFfaReports.tsx`
- Excel service: `server/modules/reports/services/equipmentReportService.ts`

#### Report 7.1: LSA/FFA Equipment Master List

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | Component Code | Yes | Yes | Yes |
| 3 | Component Name | Yes | Yes | Yes |
| 4 | Equipment Type | Yes | Yes | Yes |
| 5 | Location | Yes | Yes | Yes |
| 6 | Maker | Yes | Yes | Yes |
| 7 | Model | Yes | Yes | Yes |
| 8 | Serial No | Yes | Yes | Yes |
| 9 | Installation Date | Yes | Yes | Yes |
| 10 | Criticality | Yes | Yes | Yes |
| 11 | Class Item | Yes | Yes | Yes |
| 12 | Active | Yes | Yes | Yes |

#### Report 7.2: LSA/FFA Maintenance Schedule & Status

| # | Column | View | PDF | Excel |
|---|--------|------|-----|-------|
| 1 | S.No | Yes | Yes | Yes |
| 2 | Comp Code | Yes | Yes | Yes |
| 3 | Component Name | Yes | Yes | Yes |
| 4 | Equipment Type | Yes | Yes | Yes |
| 5 | Location | Yes | Yes | Yes |
| 6 | Job Code | Yes | Yes | Yes |
| 7 | Job Title | Yes | Yes | Yes |
| 8 | Task Type | Yes | Yes | Yes |
| 9 | Basis | Yes | Yes | Yes |
| 10 | Frequency | Yes | Yes | Yes |
| 11 | Next Due Date | Yes | Yes | Yes |
| 12 | Days | Yes | Yes | Yes |
| 13 | Status | Yes | Yes | Yes |
| 14 | Last Done | Yes | Yes | Yes |
| 15 | Last WO | Yes | Yes | Yes |
| 16 | Assigned To | Yes | Yes | Yes |

---

## Section C: Discrepancy Matrix

### Pre-Fix Discrepancies

| # | Report | Mode | Pre-Fix Cols | Post-Fix Cols | Root Cause | Fix Applied |
|---|--------|------|--------------|---------------|------------|-------------|
| 1 | Due Jobs (7 Days) | Excel | 18 (STANDARD_WORK_ORDER_COLUMNS) | 8 | Used generic 18-col template instead of report-specific columns | Replaced with 8 report-specific columns matching view |
| 2 | Overdue Jobs | Excel | 18 (STANDARD_WORK_ORDER_COLUMNS) | 15 | Used generic 18-col template instead of report-specific columns | Replaced with 15 report-specific columns matching view |
| 3 | Completed Jobs | PDF | 24 (generateCompletedJobsRegisterReport) | 11 | Used specialized 24-col PDF generator instead of generic `generateReport()` | Switched to `generateReport()` with shared 11-column array |
| 4 | Completed Jobs | Excel | 24 (custom columns) | 11 | Used custom 24-col definition with audit fields | Reduced to 11 columns matching view |
| 5 | Postponement Log | Excel | 19 (custom columns) | 10 | Included 9 extra approval/audit columns | Reduced to 10 columns matching view |

### Post-Fix Verification

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
| 2.1 | Running Hours Log | Var | Var | Var | Aligned |
| 2.2 | RH Anomaly Detection | Var | Var | Var | Aligned |
| 3.1 | Critical Spares Availability | Var | Var | Var | Aligned |
| 3.2 | Low Stock Alert | Var | Var | Var | Aligned |
| 3.3 | Spares Consumption Analysis | Var | Var | Var | Aligned |
| 4.1 | Stores Inventory Status | Var | Var | Var | Aligned |
| 4.2 | Stores Consumption Analysis | Var | Var | Var | Aligned |
| 4.3 | Combined Consumption Report | Var | Var | Var | Aligned |
| 4.4 | Stores Low Stock Alert | Var | Var | Var | Aligned |
| 5.1 | IHM Inventory Status | 10 | 10 | 10 | Aligned |
| 6.1 | CR Status & Tracking | 13 | 13 | 13 | Aligned |
| 7.1 | LSA/FFA Equipment Master | 12 | 12 | 12 | Aligned |
| 7.2 | LSA/FFA Maintenance Schedule | 16 | 16 | 16 | Aligned |

### Remaining Known Divergence

None. All reports are fully aligned across View, PDF, and Excel.

---

## Architecture Notes

### Column Definition Pattern

Reports follow two patterns:

1. **Frontend-defined columns** (most reports): Columns are defined in the React component's `switch` block. The same column array is passed to both `setPreviewData()` (view) and `pdfReportGenerator.generateReport()` (PDF). This ensures automatic alignment.

2. **Server-defined columns** (Excel exports): Excel exports define columns in their respective service files under `server/modules/reports/services/`. These must be manually kept in sync with frontend definitions.

### Key Files

| File | Purpose |
|------|---------|
| `client/src/pages/reports/MaintenanceReports.tsx` | Maintenance category: view columns + PDF generation |
| `client/src/lib/pdfReportGenerator.ts` | PDF generation: `generateReport()` (generic) + specialized methods |
| `server/modules/reports/services/maintenanceReportService.ts` | Maintenance Excel exports |
| `server/lib/excelReportStyles.ts` | Shared Excel styles and `STANDARD_WORK_ORDER_COLUMNS` |
| `server/modules/reports/services/equipmentReportService.ts` | Critical Equipment + Unplanned + LSA/FFA Excel exports |
| `server/modules/reports/services/changeRequestReportService.ts` | Change Requests Excel export |
| `server/modules/reports/services/complianceReportService.ts` | Running Hours + IHM Excel exports |
| `server/modules/reports/services/sparesReportService.ts` | Spares Excel exports |
| `server/modules/reports/services/storesReportService.ts` | Stores Excel exports |

### STANDARD_WORK_ORDER_COLUMNS

The 18-column template in `server/lib/excelReportStyles.ts` is no longer used by Due Jobs or Overdue Jobs exports (replaced with report-specific columns). It is still referenced by the `exportUnplannedJobs()` fallback path in `maintenanceReportService.ts`, though the primary Unplanned Jobs export uses `equipmentReportService.ts` (11 cols, aligned).
