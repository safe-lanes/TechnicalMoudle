# PMS Reports Module — Comprehensive Audit & Technical Reference

> **Generated:** 2026-03-31  
> **Scope:** All 22 reports across 8 categories  
> **Purpose:** Full technical verification and troubleshooting reference covering column definitions, formula logic, data sources, derivation paths, API endpoints, verification methods, edge cases, and debugging guides for every report in the PMS Reports Module.

---

## Section A: Master Report Inventory (Technical Verification)

### A.1: Report Metadata & Alignment

| # | Category | Report Name | View | PDF | Excel | Aligned | Frontend File | Excel Service File |
|---|----------|-------------|------|-----|-------|---------|---------------|--------------------|
| 1.1 | Maintenance | Due Jobs (7 Days) | 8 | 8 | 8 | Yes | MaintenanceReports.tsx:314-392 | maintenanceReportService.ts |
| 1.2 | Maintenance | Overdue Jobs | 15 | 15 | 15 | Yes | MaintenanceReports.tsx:395-524 | maintenanceReportService.ts |
| 1.3 | Maintenance | Completed Jobs Register | 11 | 11 | 11 | Yes | MaintenanceReports.tsx:527-673 | maintenanceReportService.ts |
| 1.4 | Maintenance | Monthly Summary | 3 | 3 | KPI | Yes | MaintenanceReports.tsx:676-818 | maintenanceReportService.ts |
| 1.5 | Maintenance | Critical Equipment Status | 12 | 12 | 12 | Yes | MaintenanceReports.tsx:821-878 | equipmentReportService.ts |
| 1.6 | Maintenance | Unplanned/Breakdown Jobs | 11 | 11 | 11 | Yes | MaintenanceReports.tsx:881-936 | equipmentReportService.ts |
| 1.7 | Maintenance | Postponement Log | 10 | 10 | 10 | Yes | MaintenanceReports.tsx:938-999 | maintenanceReportService.ts |
| 1.8 | Maintenance | Priority Performance | 5 | 5 | N/A | Yes | MaintenanceReports.tsx:1001-1040 | — |
| 1.9 | Maintenance | Man-Hours Analysis | 5 | 5 | N/A | Yes | MaintenanceReports.tsx:1042-1073 | — |
| 1.10 | Maintenance | Workload Distribution | 10 | 10 | 10 | Yes | MaintenanceReports.tsx:1075-1190 | operationsReportService.ts |
| 2.1 | Running Hours | Utilization Summary | 10 | 10 | 10 | Yes | RunningHoursReports.tsx:175-245 | operationsReportService.ts |
| 2.2 | Running Hours | Anomaly Detection | 11 | 11 | 11 | Yes | RunningHoursReports.tsx:248-340 | complianceReportService.ts |
| 3.1 | Spares | Critical Spares | 10 | 10 | 10 | Yes | SparesReports.tsx:258-303 | sparesReportService.ts |
| 3.2 | Spares | Low Stock Alert | 8 | 8 | 8 | Yes | SparesReports.tsx:216-255 | sparesReportService.ts |
| 3.3 | Spares | Consumption Analysis | 10 | 10 | 10 | Yes | SparesReports.tsx:305-361 | sparesReportService.ts |
| 4.1 | Stores | Inventory Status | 8 | 8 | 8 | Yes | StoresReports.tsx:226-267 | storesReportService.ts |
| 4.2 | Stores | Lubricants & Oil | 6 | 6 | N/A | Yes | StoresReports.tsx:270-308 | — |
| 4.3 | Stores | Chemicals & Expiry | 9 | 9 | N/A | Yes | StoresReports.tsx:311-372 | — |
| 4.4 | Stores | Low Stock Alert | 13 | 13 | 13 | Yes | StoresReports.tsx:374-450 | storesReportService.ts |
| 5.1 | Compliance | IHM Inventory | 10 | 10 | 10 | Yes | IhmReports.tsx | complianceReportService.ts |
| 6.1 | Change Requests | CR Status & Tracking | 13 | 13 | 13 | Yes | ChangeRequestReports.tsx:236-311 | changeRequestReportService.ts |
| 7.1 | LSA/FFA | Equipment Master List | 12 | 12 | 12 | Yes | LsaFfaReports.tsx:172-242 | equipmentReportService.ts |
| 7.2 | LSA/FFA | Maintenance Schedule | 16 | 16 | 16 | Yes | LsaFfaReports.tsx:243-322 | equipmentReportService.ts |

### A.2: Formula Summary, Verification & Troubleshooting Paths

| # | Report | Key Formulas | Formula Location (file:line) | Verification Method | Troubleshooting Path | Input Dependencies | Edge Cases |
|---|--------|-------------|------------------------------|---------------------|---------------------|--------------------|------------|
| 1.1 | Due Jobs | `daysRemaining = ceil((dueDate-now)/86400000)`; status tiers (OVERDUE/URGENT/DUE/ACTIVE) | MaintenanceReports.tsx:328-337 | 1. Preview report in view. 2. Cross-check a sample WO's dueDate vs displayed daysRemaining. 3. Export PDF, verify same row count and values. 4. Export Excel, verify column headers match view. | API→filter→dateCalc→statusAssign→columnMap→export | `wo.dueDate`, `wo.status`, `wo.jobPriority`, `wo.assignedTo` | No dueDate → excluded; Completed/Postponed → excluded; timezone boundary may shift day count by ±1 |
| 1.2 | Overdue Jobs | `daysOverdue = floor((now-dueDate)/86400000)`; grace 7d/168RH; overdueType (Calendar/RH/Both) | MaintenanceReports.tsx:396-476 | 1. Verify grace period: WO 3 days overdue should NOT appear (within 7d grace). 2. Check RH overdue against component's currentCumulativeRH. 3. Compare PDF (A3) vs view row count. 4. Excel column count = 15. | API→graceFilter→daysCalc→RHcalc→typeClassify→sort→export | `wo.dueDate`, `wo.status`, `wo.nextDueReading`, `wo.currentCumulativeRH`, `wo.criticality` | Grace period means recently-overdue jobs (1-7 days) appear in 1.1 but NOT 1.2; RH overdue requires both nextDueReading and currentCumulativeRH to be populated |
| 1.3 | Completed Jobs | `manHours = parseFloat(manhours) \|\| (duration × persons)`; `duration = totalTimeHours \|\| (completion-start)/3600000` | MaintenanceReports.tsx:559-637 | 1. Select date range with known completed WOs. 2. Verify man-hours calculation for a sample row. 3. Check total man-hours sum in summary. 4. PDF and Excel should show identical 11 columns. | API→statusFilter→dateFilter→durationCalc→manhourCalc→sort→export | `wo.status`, `wo.dateCompleted`, `wo.completionDateTime`, `wo.startDateTime`, `wo.manhours`, `wo.noOfPersons` | Missing start/end times → duration=0 → manHours falls back to `wo.manhours`; missing manhours AND times → shows '—' |
| 1.4 | Monthly Summary | `completionRate = round((completed/inScope)*100)`; cumulative overdue = all WOs with dueDate<periodEnd and not completed | MaintenanceReports.tsx:676-818 | 1. Set date range to a known month. 2. Verify Jobs In Scope = WOs due OR completed in period. 3. Verify cumulative overdue counts ALL historic backlog. 4. Excel uses KPI dashboard layout (not table). | API→periodCalc→scopeFilter→deptAggregation→priorityAggregation→export | `wo.dueDate`, `wo.status`, `wo.completionDateTime`, `wo.department`, `wo.jobPriority`, `wo.manhours` | Default period = current month if no filter; cumulative overdue is intentionally NOT limited to period start (counts all backlog); DD-MMM-YYYY date parsing has custom regex |
| 1.5 | Critical Equipment | Server-computed totals; joins components+WOs | MaintenanceReports.tsx:821-878; server: equipmentReportsController | 1. Verify server response has `data` and `metadata` fields. 2. Check component appears only if isCritical OR isClassItem. 3. Compare overdue/dueSoon counts against WO data. | serverQuery→componentFilter→WOjoin→countAggregation→clientDisplay→export | `vesselId` param; server queries `components` and `work_orders` tables | Returns empty if no critical/class components exist for vessel; uses specialized PDF generator with metadata summary block |
| 1.6 | Unplanned Jobs | Server-computed; date range defaults to current month | MaintenanceReports.tsx:881-936; server: equipmentReportsController | 1. Verify date range params are sent. 2. Check server returns `data` and `metadata`. 3. Compare manhours/totalHours in output vs DB. | serverQuery→dateFilter→WOfilter→dataTransform→export | `vesselId`, `startDate`, `endDate` params | Default date range = current calendar month if not specified; uses specialized PDF generator |
| 1.7 | Postponement Log | `daysExtended = ceil((newDue-origDue)/86400000)` | MaintenanceReports.tsx:938-999 | 1. Filter for status=Postponed WOs. 2. Verify daysExtended calculation for a sample row. 3. Check that invalid dates produce '-'. 4. Excel = 10 cols. | API→statusFilter→dateCalc→fieldMapping→export | `wo.status`, `wo.originalDueDate`, `wo.dueDate`, `wo.newDueDate`, `wo.postponedToDate`, `wo.postponementReason` | If both dates missing or invalid → daysExtended = '-'; if result ≤ 0 → daysExtended = '-'; status is hardcoded 'Postponed' |
| 1.8 | Priority Perf | `onTimePercent = round((completed/total)*100)` | MaintenanceReports.tsx:1001-1040 | 1. Group WOs by jobPriority. 2. Verify completed count per group. 3. Verify overdue = dueDate < now AND status ≠ Completed. | API→groupByPriority→countCompleted→countOverdue→rateCalc | `wo.jobPriority`, `wo.status`, `wo.dueDate` | Missing jobPriority → defaults to 'Normal'; no Excel export available |
| 1.9 | Man-Hours | `variance = actualHours - plannedHours` | MaintenanceReports.tsx:1042-1073 | 1. Filter completed WOs. 2. Verify plannedHours vs actualHours fields. 3. Check variance sign (negative = under budget). | API→statusFilter→hoursFallback→varianceCalc | `wo.plannedHours`, `wo.estimatedHours`, `wo.actualHours`, `wo.hoursSpent` | Missing planned → 0; missing actual → falls back to planned (variance=0); no Excel export available |
| 1.10 | Workload Dist | `workloadPercent = round((assigneeManhours/totalManhours)*100)`; `completionPercent = round((completed/count)*100)` | MaintenanceReports.tsx:1075-1190 | 1. Group WOs by assignee. 2. Verify manhours sum. 3. Check workload % sums approximately to 100%. 4. Excel has 10 cols. | API→groupByAssignee→countStats→manhourSum→rateCalc→sort→export | `wo.assignedTo`, `wo.assignee`, `wo.performedBy`, `wo.status`, `wo.manhours`, `wo.totalTimeHours`, `wo.department` | Missing assignee → 'Unassigned'; sorted by manhours DESC; multiple assignee field fallbacks |
| 2.1 | Utilization | Server-computed: utilization bands (High/Normal/Low), avgDaily, period hours | RunningHoursReports.tsx:175-245; server: operationsReportService | 1. Verify server returns `data` and `summary`. 2. Check utilization bands are assigned correctly. 3. Verify data source quality flags (actual/estimated/noData). | serverQuery→componentJoin→RHcalc→bandAssign→summaryAggregation→export | `vesselId`, `startDate`, `endDate` params | Requires vessel selection (not 'all'); empty if no components have running hours; estimated data is capped |
| 2.2 | Anomaly Det | Server-computed: anomaly types (high_increment, negative_delta, zero_change, irregular_pattern, meter_replaced) | RunningHoursReports.tsx:248-340; server: complianceReportService | 1. Verify anomaly types match expected detection rules. 2. Check severity classification (critical/warning/info). 3. Verify delta = newRh - previousRh. | serverQuery→logPairAnalysis→deltaCalc→thresholdCheck→anomalyClassify→export | `vesselId`, `startDate`, `endDate` params | Empty if no RH log entries; negative_delta = meter rollback; requires ≥2 log entries per component |
| 3.1 | Critical Spares | Server-computed: shortage, stock status, criticality linking | SparesReports.tsx:258-303; server: sparesReportService | 1. Verify server returns data with shortageQty. 2. Check criticalEquip = YES matches linkedToCriticalEquipment. 3. Excel = 10 cols. | serverQuery→sparesJoin→shortageCalc→criticalityLink→export | `vesselId` param | Empty if no spares data; shortage = max(0, minStock - rob) |
| 3.2 | Low Stock (Spares) | Server-computed: `shortage = minQty - currentQty` | SparesReports.tsx:216-255; server: sparesReportService | 1. Verify shortage = minQty - currentQty. 2. Check status values. 3. Excel = 8 cols. | serverQuery→stockCheck→shortageCalc→statusAssign→export | `vesselId` path param | Empty if all spares above minimum |
| 3.3 | Consumption | Server-computed: consumption events, trends | SparesReports.tsx:305-361; server: sparesReportService | 1. Verify totalConsumed matches sum of consumption history. 2. Check lastConsumed date format. 3. Excel = 10 cols. | serverQuery→historyAggregation→trendCalc→export | `vesselId` path param | Date formatted as DD-MMM-YYYY via custom formatter |
| 4.1 | Stores Inv | `status = rob===0 ? 'Critical' : rob<=min ? 'Low' : 'OK'` | StoresReports.tsx:216-267 | 1. Verify status logic against rob/min values. 2. Check rob/min are parsed as float. 3. Excel = 8 cols. | API→allStoresQuery→statusCalc→export | `vesselId` (optional); stores table data | `parseFloat(String(s.rob))` — handles string/number; NaN → 0 |
| 4.2 | Lubes & Oil | Same stock status as 4.1; filter `itemType === 'lubes'` | StoresReports.tsx:270-308 | 1. Verify only lubes items appear. 2. Check UOM defaults to 'L'. | API→typeFilter→statusCalc→export | `storesItems`, `itemType` field | Empty if no items with itemType='lubes'; no Excel export |
| 4.3 | Chemicals | Expiry: `days = floor((expiryDate-today)/86400000)`; SDS compliance: `round((withSds/total)*100)` | StoresReports.tsx:311-372 | 1. Verify EXPIRED status for past dates. 2. Check SDS compliance percentage. 3. Verify filter is itemType='chemicals'. | API→typeFilter→expiryCalc→SDScount→statusCalc→export | `storesItems`, `itemType`, `expiryDate`, `sdsReference` | Timezone: uses `new Date()` (UTC); items near midnight may show off-by-one; no Excel export |
| 4.4 | Stores Low Stock | Server-computed: `deficit = max(0, minStock-rob)`; `daysToStockout = (rob/avgMonthly)*30` | StoresReports.tsx:374-450; server: storesReportService | 1. Verify deficit calculation. 2. Check daysToStockout for div-by-zero (avgMonthly=0). 3. Excel = 13 cols. | serverQuery→deficitCalc→stockoutCalc→priorityAssign→export | `vesselId` path param | daysToStockout undefined if avgMonthlyConsumption=0; 13 columns is the widest stores report |
| 5.1 | IHM Inventory | Server-computed status and evidence mapping | IhmReports.tsx; server: complianceReportService | 1. Verify server returns correct IHM status values. 2. Excel = 10 cols. | serverQuery→ihmStatusMap→evidenceMap→export | `vesselId` param | Empty if no IHM items configured for vessel |
| 6.1 | CR Tracking | `cycleTime = reviewedAt - submittedAt` (hours, server-computed); `approvalRate = round((approved/total)*100)` | ChangeRequestReports.tsx:236-311; server: changeRequestReportService | 1. Verify cycleTime matches manual (reviewedAt-submittedAt) calculation. 2. Check approval/rejection percentages sum correctly. 3. Excel uses GET (not POST). | serverQuery→statusCount→cycleTimeCalc→categoryBreakdown→export | `vesselId`, `status`, `category`, `startDate`, `endDate` params | Title truncated to 50 chars; cycleTime null if not yet reviewed; Excel is GET `/export` (unlike most POST endpoints) |
| 7.1 | LSA/FFA Master | Server-computed component listing | LsaFfaReports.tsx:172-242; server: equipmentReportsController | 1. Verify component count matches summary. 2. Check equipmentType filter works. 3. Excel via `format=excel` query param. | serverQuery→equipTypeFilter→componentMap→export | `vesselId`, `equipmentType` params | Excel is GET with `?format=excel` (not separate POST); empty if no LSA/FFA components |
| 7.2 | LSA/FFA Schedule | Server-computed maintenance items with status | LsaFfaReports.tsx:243-322; server: equipmentReportsController | 1. Verify schedule items match component+WO join. 2. Check status filter (overdue/due-soon/on-schedule). 3. Excel via `format=excel` query param. | serverQuery→equipTypeFilter→statusFilter→scheduleMap→export | `vesselId`, `equipmentType`, `status` params | 16 columns is the widest report; Excel is GET with `?format=excel`; status filter applied server-side |

---

## Section B: Per-Report Technical Detail

Each report follows this template:
1. **Column Definition** — header, field, width for every column
2. **Data Source & Filter Logic** — where data comes from, how it's filtered
3. **Derived Fields & Formulas** — every computed field with implementation location
4. **Sort Order & Summary Metrics**
5. **View/PDF/Excel Parity** — how alignment is maintained, any format-specific notes
6. **Verification Steps** — ordered procedure to verify correctness
7. **Edge Cases & Failure Conditions**
8. **Troubleshooting Flow** — ordered chain: API → filter → date parsing → export mapping → aggregation

---

### Category 1: Maintenance & Work Orders

**Source Files:**
- Frontend columns + PDF: `client/src/pages/reports/MaintenanceReports.tsx`
- PDF engine: `client/src/lib/pdfReportGenerator.ts`
- Excel exports: `server/modules/reports/services/maintenanceReportService.ts`
- Excel styles: `server/lib/excelReportStyles.ts`
- Routes: `server/modules/reports/routes.ts` (lines 53-58)

---

#### Report 1.1: Due Jobs (7 Days)

**1. Column Definition (8 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Priority | priority | 22 | `wo.jobPriority \|\| 'Normal'` |
| 2 | Status | statusIndicator | 22 | Computed (see formulas) |
| 3 | WO Number | workOrderNumber | 45 | `wo.workOrderNumber \|\| wo.workOrderNo \|\| wo.id` |
| 4 | Title | title | 70 | `wo.title \|\| wo.jobTitle \|\| '-'` |
| 5 | Component | component | 50 | `wo.component \|\| wo.componentName \|\| '-'` |
| 6 | Due Date | formattedDueDate | 26 | `formatDate(wo.dueDate)` |
| 7 | Days Left | daysRemaining | 20 | Computed (see formulas) |
| 8 | Assigned To | assignedTo | 35 | `wo.assignedTo \|\| wo.assignee \|\| wo.responsibleRank \|\| '-'` |

**2. Data Source & Filter Logic:**
- Source: Client-side from `vesselWorkOrders` (useQuery fetching `/technical/api/work-orders`)
- Implementation: MaintenanceReports.tsx:318-324
- Filter:
  ```
  wo.dueDate must exist
  AND wo.status NOT IN ('Completed', 'Postponed')
  AND new Date(wo.dueDate) <= (now + 7 * 24 * 60 * 60 * 1000)
  ```
  Note: This intentionally includes overdue jobs (dueDate < now).

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `daysRemaining` | `Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))` | MaintenanceReports.tsx:335-337 |
| `statusIndicator` | `days < 0 → 'OVERDUE'; days ≤ 2 → 'URGENT'; days ≤ 7 → 'DUE'; else → 'ACTIVE'` | MaintenanceReports.tsx:327-333 |
| `formattedDueDate` | `formatDate(wo.dueDate)` — DD-MMM-YYYY format | pdfReportGenerator.ts (exported utility) |

**4. Sort Order & Summary:**
- Sort: `daysRemaining` ASC (most urgent first). Location: MaintenanceReports.tsx:352-356
- Summary: Total Due (`data.length`), Overdue (count OVERDUE), Urgent ≤2d (count URGENT), Critical Priority (count where `priority === 'Critical'`). Location: MaintenanceReports.tsx:374-383

**5. View/PDF/Excel Parity:**
- View and PDF share the identical `columns` array defined at MaintenanceReports.tsx:340-349
- PDF uses `pdfReportGenerator.generateReport()` (generic method) with the same columns and data
- Excel uses POST `/technical/api/reports/due-jobs-7-days` with body `{ vesselId }`. The Excel service was updated in Phase 1 to use 8 report-specific columns (previously used 18-col STANDARD_WORK_ORDER_COLUMNS)
- Conditional formatting in PDF: `didParseCell` in pdfReportGenerator.ts:209-291 applies status-based colors using `statusIndicator`, `priority`, and `daysRemaining` field names

**6. Verification Steps:**
1. Select a vessel with known work orders. Preview the report in view mode.
2. Pick a sample WO with a known due date. Manually calculate `daysRemaining` and compare.
3. Verify status label matches threshold rules (OVERDUE < 0, URGENT ≤ 2, DUE ≤ 7).
4. Export PDF — verify same row count, column headers, and sample values.
5. Export Excel — verify 8 column headers match view exactly.
6. Test with empty result set — should show "no data" state.

**7. Edge Cases:**
- `wo.dueDate` is null/undefined → WO is excluded from report entirely
- `wo.status` is 'Completed' or 'Postponed' → excluded even if due date is within range
- Timezone: `new Date()` uses browser local time; `Math.ceil` rounding means a WO due today at 23:59 shows 0 or 1 depending on current time
- Very old overdue items (months/years) still appear because filter only checks `dueDate <= sevenDaysFromNow`

**8. Troubleshooting Flow:**
```
1. API Response: Check useQuery for '/technical/api/work-orders' returns data
2. Vessel Filter: Verify effectiveVesselId is set and data filtered by vessel
3. Status Filter: Confirm completed/postponed WOs excluded
4. Date Calculation: Verify dueDate parsing (new Date(wo.dueDate)) produces valid date
5. Status Assignment: Check threshold logic produces correct tier
6. Column Mapping: Verify column field names match data object keys
7. PDF Export: Check pdfReportGenerator.generateReport() receives correct columns/data
8. Excel Export: Verify POST body contains vesselId; check service file column alignment
```

---

#### Report 1.2: Overdue Jobs

**1. Column Definition (15 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 8 | Sequential (re-assigned after sort) |
| 2 | Work Order No | workOrderNumber | 30 | `wo.workOrderNumber \|\| wo.workOrderNo \|\| wo.id` |
| 3 | Job Title | jobTitle | 40 | `wo.title \|\| wo.jobTitle \|\| '-'` |
| 4 | Comp Code | componentCode | 18 | `wo.componentCode \|\| wo.componentNumber \|\| '-'` |
| 5 | Component Name | componentName | 32 | `wo.component \|\| wo.componentName \|\| '-'` |
| 6 | Dept | department | 14 | `wo.department \|\| wo.assignedDepartment \|\| '-'` |
| 7 | Due Date | formattedDueDate | 18 | `formatDate(wo.dueDate \|\| wo.dueDateSnapshot)` |
| 8 | Days Overdue | daysOverdue | 16 | Computed |
| 9 | Next Due RH | nextDueRH | 16 | `wo.nextDueReading?.toLocaleString() \|\| '-'` |
| 10 | Current RH | currentRH | 16 | `wo.currentCumulativeRH?.toLocaleString() \|\| '-'` |
| 11 | RH Overdue | rhOverdue | 14 | Computed |
| 12 | Type | overdueType | 14 | Computed |
| 13 | Assigned To | assignedTo | 20 | `wo.assignedTo \|\| wo.assignee \|\| wo.responsibleRank \|\| '-'` |
| 14 | Last Done | lastDoneDate | 18 | `formatDate(wo.lastDoneDate \|\| wo.lastDoneDateSnapshot) \|\| 'N/A'` |
| 15 | Critical | criticalEquip | 12 | Computed |

**2. Data Source & Filter Logic:**
- Source: Client-side from `vesselWorkOrders`
- Implementation: MaintenanceReports.tsx:396-419
- Grace period constants: `GRACE_PERIOD_DAYS = 7`, `GRACE_PERIOD_RH = 168` (hours)
- Filter:
  ```
  wo.status NOT IN ('Completed', 'Postponed')
  AND (
    (wo.dueDate exists AND dueDate < (now - 7 days))
    OR
    (wo.nextDueReading AND wo.currentCumulativeRH AND
     (currentCumulativeRH - nextDueReading) > 168)
  )
  ```

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `daysOverdue` | `Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))` | MaintenanceReports.tsx:451 |
| `rhOverdue` | `Math.max(0, currentCumulativeRH - nextDueReading)` | MaintenanceReports.tsx:452-454 |
| `overdueType` | Calendar AND RH → 'Both'; only RH → 'RH'; else → 'Calendar' | MaintenanceReports.tsx:422-428 |
| `criticalEquip` | `wo.criticality in ('Yes','Critical') \|\| wo.critical === true → 'YES' : 'NO'` | MaintenanceReports.tsx:455 |
| `daysPastDue` | Same as daysOverdue; used internally for sort and conditional formatting | MaintenanceReports.tsx:451 |

**4. Sort Order & Summary:**
- Sort: Critical equipment first → daysOverdue DESC → componentName ASC. Location: MaintenanceReports.tsx:479-487
- S.No re-assigned after sort: MaintenanceReports.tsx:490
- Summary: Total Overdue, Critical Equip count, Avg Days Overdue (mean), Max Days Overdue, Calendar/RH split. Location: MaintenanceReports.tsx:493-509

**5. View/PDF/Excel Parity:**
- View and PDF share `columns` array at MaintenanceReports.tsx:431-447
- PDF uses specialized `pdfReportGenerator.generateOverdueJobsReport()` — A3 landscape with colored header bar and critical row highlighting
- Excel service was updated in Phase 1 from 18 STANDARD_WORK_ORDER_COLUMNS to 15 report-specific columns
- PDF conditional formatting: critical equipment rows get `bgDanger` fill; days >30 get `textDarkRed` bold; days >7 get `textDarkOrange` bold. Location: pdfReportGenerator.ts:425-455

**6. Verification Steps:**
1. Create/find a WO with dueDate more than 7 days ago — verify it appears.
2. Create/find a WO with dueDate 3 days ago — verify it does NOT appear (within grace period).
3. Test RH overdue: component with currentRH exceeding nextDueReading by >168 hours.
4. Verify critical equipment rows appear first in sorted output.
5. Verify S.No is sequential after sort (not original index).
6. Compare PDF A3 output row count with view. Check column headers match.
7. Export Excel — verify 15 columns with correct headers.

**7. Edge Cases:**
- WO overdue by 1-7 calendar days: appears in Report 1.1 (Due Jobs) but NOT in 1.2 (Overdue) due to grace period
- WO with RH overdue but no calendar dueDate: only RH overdue check applies
- Missing `nextDueReading` or `currentCumulativeRH`: RH overdue check skipped, only calendar applies
- `daysOverdue` shows '-' if value is 0 or negative after calculation

**8. Troubleshooting Flow:**
```
1. API Response: Verify work-orders query returns data with dueDate populated
2. Grace Period: Confirm GRACE_PERIOD_DAYS=7 and GRACE_PERIOD_RH=168 are applied
3. Date Parsing: Check new Date(wo.dueDate) produces valid date
4. RH Data: Verify nextDueReading and currentCumulativeRH fields exist on WO
5. Type Classification: Verify overdueType logic matches both/rh/calendar rules
6. Sort: Confirm critical equipment sort priority, then daysOverdue DESC
7. PDF: Verify generateOverdueJobsReport() is called (not generic generateReport)
8. Excel: Verify POST body contains vesselId; check 15-column alignment in service file
```

---

#### Report 1.3: Completed Jobs Register

**1. Column Definition (11 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 8 | Sequential index+1 |
| 2 | WO No | workOrderNo | 22 | `wo.workOrderNo \|\| wo.id \|\| '—'` |
| 3 | Component | componentName | 28 | `wo.component \|\| wo.componentName \|\| '—'` |
| 4 | Job Title | jobTitle | 30 | `wo.jobTitle \|\| wo.title \|\| '—'` |
| 5 | Job Type | jobType | 14 | `wo.taskType \|\| wo.maintenanceType \|\| '—'` |
| 6 | Dept | department | 12 | `wo.department \|\| '—'` |
| 7 | Priority | priority | 12 | `wo.jobPriority \|\| wo.priority \|\| '—'` |
| 8 | Assigned To | assignedTo | 18 | `wo.performedBy \|\| wo.assignedTo \|\| '—'` |
| 9 | Start Date | startDate | 16 | `formatDateDDMMMYYYY(wo.startDateTime)` |
| 10 | Completion Date | completionDate | 16 | `formatDateDDMMMYYYY(wo.dateCompleted \|\| wo.completionDateTime)` |
| 11 | Man Hours | manHours | 12 | Computed |

**2. Data Source & Filter Logic:**
- Source: Client-side filter `vesselWorkOrders.filter(wo => wo.status === 'Completed')`
- Date range filter on `dateCompleted`/`completionDateTime`: MaintenanceReports.tsx:577-592
- Implementation: MaintenanceReports.tsx:527-673

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `duration` | `parseFloat(wo.totalTimeHours) \|\| ((completionDateTime - startDateTime) / 3600000)` | MaintenanceReports.tsx:559-569, 607 |
| `manHours` | `parseFloat(wo.manhours) \|\| (duration × parseInt(wo.noOfPersons \|\| 1))` | MaintenanceReports.tsx:609 |
| `totalManHours` | Running sum: `totalManHours += manHours` across all rows | MaintenanceReports.tsx:610 |
| `startDate` | Custom DD-MMM-YYYY formatter | MaintenanceReports.tsx:529-542 |
| `completionDate` | Custom DD-MMM-YYYY formatter | MaintenanceReports.tsx:529-542 |

**4. Sort Order & Summary:**
- Sort: `dateCompleted` DESC, then `workOrderNo` ASC. Location: MaintenanceReports.tsx:595-602
- Summary: Total Jobs, Total Man-Hours (toFixed(1)). Location: MaintenanceReports.tsx:655-658

**5. View/PDF/Excel Parity:**
- View and PDF share `completedColumns` array at MaintenanceReports.tsx:640-652
- PDF uses generic `generateReport()` (previously used specialized 24-col method — fixed in Phase 1)
- Excel was reduced from 24 to 11 columns in Phase 1
- Request body: `{ vesselId, dateFrom?, dateTo? }`

**6. Verification Steps:**
1. Set date range covering known completed WOs. Verify count matches.
2. Calculate man-hours manually for a sample row: check manhours field first, then fallback to duration×persons.
3. Verify total man-hours in summary equals sum of all row man-hours.
4. Export PDF — verify 11 columns (not legacy 24).
5. Export Excel — verify 11 columns with matching headers.

**7. Edge Cases:**
- Missing `startDateTime` AND `completionDateTime` AND `manhours` → manHours shows '—'
- `noOfPersons` missing → defaults to 1
- `totalTimeHours` is string → parsed with `parseFloat()`
- Date range filter: if both from/to null, all completed WOs included

**8. Troubleshooting Flow:**
```
1. API Response: Verify work-orders returns data with status='Completed'
2. Date Filter: Check dateCompleted/completionDateTime fields are populated
3. Duration Calc: Verify startDateTime and completionDateTime are valid ISO strings
4. ManHours Calc: Check fallback chain (manhours → duration*persons → '—')
5. Summary: Verify totalManHours accumulator
6. PDF: Verify generateReport() called (not generateCompletedJobsRegisterReport)
7. Excel: Verify POST body includes dateFrom/dateTo if date range set
```

---

#### Report 1.4: Monthly Maintenance Summary

**1. Column Definition (3 columns — KPI-style):**

| # | Header | Field | Width |
|---|--------|-------|-------|
| 1 | Metric | metric | 60 |
| 2 | Value | value | 40 |
| 3 | Percentage | percentage | 40 |

**2. Data Source & Filter Logic:**
- Source: Client-side aggregation of `vesselWorkOrders`
- Period: `globalFilters.dateRange` if both set; else current month (1st to last day). Location: MaintenanceReports.tsx:696-705

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `monthlyWOs` (in-scope) | WOs where dueDate in period OR (status=Completed AND completionDateTime in period) | MaintenanceReports.tsx:708-717 |
| `completedWOs` | Subset of monthlyWOs where `status === 'Completed'` | MaintenanceReports.tsx:720 |
| `cumulativeOverdue` | ALL WOs where `dueDate < periodEnd` AND `status !== 'Completed'` (intentionally NOT limited to period start) | MaintenanceReports.tsx:723-727 |
| `completionRate` | `Math.round((totalCompleted / totalInScope) * 100)` — 0 if totalInScope=0 | MaintenanceReports.tsx:732 |
| `totalManHours` | `sum(Number(wo.manhours \|\| wo.totalTimeHours \|\| wo.actualHours \|\| 0))` for completedWOs | MaintenanceReports.tsx:768-771 |
| Department breakdown | Group by `wo.department \|\| wo.assignedDepartment \|\| 'Unassigned'` | MaintenanceReports.tsx:735-746 |
| Priority breakdown | Group by `wo.jobPriority \|\| 'Normal'` with seed keys High/Medium/Low/Normal | MaintenanceReports.tsx:749-765 |

**4. Data Sections:** Three sections with header rows: Executive Summary, Priority Breakdown, Department Breakdown. Location: MaintenanceReports.tsx:782-803

**5. View/PDF/Excel Parity:**
- View and PDF share `columns` at MaintenanceReports.tsx:775-779
- Excel uses KPI dashboard layout (not a simple table) — different visual format but same metrics
- Excel request body: `{ vesselId, startDate?, endDate? }`

**6. Verification Steps:**
1. Set date range to a month with known WO activity.
2. Verify Jobs In Scope count = WOs due in period + completed in period (no double-counting).
3. Verify completion rate = completed / inScope × 100.
4. Verify cumulative overdue counts ALL historic backlog (not just new overdue in period).
5. Check department and priority breakdowns sum to correct totals.
6. Excel: verify KPI layout contains same metrics.

**7. Edge Cases:**
- Empty period (no WOs due or completed) → completionRate = 0, all counts = 0
- Cumulative overdue may be larger than in-scope count (by design — includes historic backlog)
- Date parsing: custom regex handles DD-MMM-YYYY format. Location: MaintenanceReports.tsx:678-693
- Default period = current month if no globalFilters date range

**8. Troubleshooting Flow:**
```
1. Period Calc: Verify periodStart/periodEnd are correct month boundaries
2. Scope Filter: Check WO inclusion logic (dueDate in period OR completed in period)
3. Overdue Calc: Verify cumulative logic (all WOs with dueDate < periodEnd, not completed)
4. Date Parsing: Check DD-MMM-YYYY regex handles all date formats
5. Aggregation: Verify department/priority grouping keys
6. Man-Hours: Check Number() conversion of manhours/totalTimeHours fields
7. Excel: Verify KPI dashboard layout maps to same metrics
```

---

#### Report 1.5: Critical Equipment Status

**1. Column Definition (12 columns):**

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

**2. Data Source:** Server-side via GET `/technical/api/reports/critical-equipment-status?vesselId=...`. Returns `{ data, metadata }`.

**3. Server Logic:** Queries components where isCritical=true OR isClassItem=true, joins with work_orders to count total/overdue/due-soon per component.

**4. Client Transform:** `nextDueDate` formatted via `formatDate()`, `daysUntilDue` displayed as-is or '-'. Location: MaintenanceReports.tsx:848-852

**5. View/PDF/Excel Parity:** View/PDF share columns at MaintenanceReports.tsx:832-845. PDF uses `generateCriticalEquipmentReport()`. Excel via POST with same 12 cols.

**6. Verification:** Verify component appears only if isCritical OR isClassItem. Check overdue/dueSoon counts against WO data.

**7. Edge Cases:** Empty if no critical/class components; `daysUntilDue` null → shows '-'.

---

#### Report 1.6: Unplanned/Breakdown Jobs

**1. Column Definition (11 columns):**

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

**2. Data Source:** Server-side via GET `/technical/api/reports/unplanned-breakdown-jobs?vesselId=...&startDate=...&endDate=...`

**3. Date Defaults:** Current month if no range provided. Location: MaintenanceReports.tsx:883-887

**4. View/PDF/Excel Parity:** View/PDF share columns at MaintenanceReports.tsx:899-911. PDF uses `generateUnplannedBreakdownReport()`. Excel via POST with same 11 cols.

**5. Verification:** Verify date params sent to server. Check server returns `{ data, metadata }`.

**6. Edge Cases:** Empty if no unplanned/breakdown WOs in period. Server handles filtering.

---

#### Report 1.7: Job Postponement Log

**1. Column Definition (10 columns):**

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

**2. Data Source:** Client-side: `vesselWorkOrders.filter(wo => wo.status === 'Postponed')`. Location: MaintenanceReports.tsx:939

**3. Derived Fields:**

| Field | Formula | Location |
|-------|---------|----------|
| `daysExtended` | `Math.ceil((newDate - origDate) / 86400000)` — '-' if ≤ 0 or invalid | MaintenanceReports.tsx:955-965 |
| `originalDue` | `formatDate(wo.originalDueDate \|\| wo.dueDate)` | MaintenanceReports.tsx:973 |
| `newDue` | `formatDate(wo.newDueDate \|\| wo.postponedToDate \|\| wo.dueDate)` | MaintenanceReports.tsx:974 |
| `reason` | `wo.postponementReason \|\| wo.remarks \|\| '-'` | MaintenanceReports.tsx:975 |
| `status` | Hardcoded `'Postponed'` | MaintenanceReports.tsx:977 |

**4. View/PDF/Excel Parity:** View/PDF share columns at MaintenanceReports.tsx:941-952. Excel was reduced from 19 to 10 columns in Phase 1.

**5. Verification:** Check daysExtended for a sample row manually. Verify invalid dates produce '-'.

**6. Edge Cases:** Both dates missing → daysExtended = '-'; result ≤ 0 → daysExtended = '-'; status always 'Postponed'.

---

#### Report 1.8: Work Priority Performance

**1. Columns:** Priority (40), Total WOs (30), Completed (30), On-Time % (30), Overdue (30). Location: MaintenanceReports.tsx:1016-1022

**2. Logic:** Group by `wo.jobPriority || 'Normal'`. `onTimePercent = Math.round((completed/total)*100)`. Overdue = `dueDate < now AND status ≠ Completed`. Location: MaintenanceReports.tsx:1001-1030

**3. Parity:** View/PDF only (no Excel endpoint). **4. Edge Cases:** Missing jobPriority → 'Normal'.

---

#### Report 1.9: Man-Hours Analysis

**1. Columns:** WO Number (40), Title (60), Planned Hrs (30), Actual Hrs (30), Variance (30). Location: MaintenanceReports.tsx:1043-1049

**2. Logic:** Filter completed WOs. `planned = wo.plannedHours || wo.estimatedHours || 0`. `actual = wo.actualHours || wo.hoursSpent || planned`. `variance = actual - planned`. Location: MaintenanceReports.tsx:1051-1063

**3. Parity:** View/PDF only (no Excel endpoint). **4. Edge Cases:** Missing actual → equals planned → variance = 0.

---

#### Report 1.10: Crew Workload Distribution

**1. Columns:** Rank (45), Dept (25), Total (22), Done (22), Pending (22), Overdue (22), Manhours (28), Avg Time (25), Rate % (25), Load % (25). Location: MaintenanceReports.tsx:1141-1152

**2. Logic:** Group by assignee (`wo.assignedTo || wo.assignee || wo.performedBy || wo.responsibleRank || 'Unassigned'`). `completionPercent = round((completed/count)*100)`. `workloadPercent = round((assigneeManhours/totalManhours)*100)`. Location: MaintenanceReports.tsx:1075-1167

**3. Parity:** View/PDF share columns. Excel via POST with `{ vesselId, startDate?, endDate?, viewType: 'summary' }`.

**4. Edge Cases:** Missing assignee → 'Unassigned'; totalManhours = 0 → workloadPercent = '0%'; sorted by manhours DESC.

---

### Category 2: Running Hours

**Source Files:**
- Frontend: `client/src/pages/reports/RunningHoursReports.tsx`
- Excel: `server/modules/reports/services/operationsReportService.ts` (utilization), `server/modules/reports/services/complianceReportService.ts` (anomaly)
- Routes: `server/modules/reports/routes.ts` (lines 61-68)

---

#### Report 2.1: Equipment Utilization Summary

**1. Columns (10):** S.No (12), Code (30), Component Name (55), Category (35), Current Hrs (25), Period Hrs (25), Avg Daily (22), Utilization band (25), Util % (20), Data Source (30). Location: RunningHoursReports.tsx:198-209

**2. Data Source:** Server-side GET `/technical/api/reports/equipment-utilization-summary?vesselId=...&startDate=...&endDate=...`. Returns `{ success, data, summary }`.

**3. Server Logic:** Computes utilization bands based on avgDailyHours vs expected hours. Data quality flags: actual (from RH logs), estimated (interpolated), noData.

**4. View/PDF/Excel Parity:** View/PDF share columns. PDF uses generic `generateReport()`. Excel via POST.

**5. Verification:** Check `summary` totals (High+Normal+Low+NoData = Total). Verify utilization % is reasonable (0-100+).

**6. Edge Cases:** Requires specific vessel (not 'all'). Empty if no components with running hours. Estimated data is capped.

---

#### Report 2.2: Running Hours Anomaly Detection

**1. Columns (11):** S.No (12), Component Code (30), Component Name (50), Prev RH (22), New RH (22), Delta (20), Days Between (25), Avg Daily (22), Type (30), Severity (22), Description (60). Location: RunningHoursReports.tsx:271-283

**2. Data Source:** Server-side GET `/technical/api/reports/running-hours-anomaly-detection?vesselId=...&startDate=...&endDate=...`. Returns `{ success, data, summary }`.

**3. Anomaly Types:** `high_increment` (excessive delta), `negative_delta` (meter rollback), `zero_change` (no movement), `irregular_pattern` (deviation from norm), `meter_replaced` (large discontinuity).

**4. Severity:** `critical`, `warning`, `info` — server-classified.

**5. Client Transform:** `previousRh`, `newRh`, `delta` formatted to 1 decimal. `daysBetween` as integer. `avgDailyHours` to 1 decimal. Location: RunningHoursReports.tsx:294-308

**6. View/PDF/Excel Parity:** View/PDF share columns. Excel via POST.

**7. Edge Cases:** Empty if no RH log entries. Requires ≥2 log entries per component for delta calculation.

---

### Category 3: Spares

**Source Files:**
- Frontend: `client/src/pages/reports/SparesReports.tsx`
- Excel: `server/modules/reports/services/sparesReportService.ts`
- Routes: `server/modules/reports/routes.ts` (lines 24-30)

---

#### Report 3.1: Critical Spares Availability

**1. Columns (10):** S.No (10), Part Code (28), Part Name (45), ROB (12), Min Stock (15), Status (18), Shortage (15), Criticality (18), Critical Equip (20), Remarks (45). Location: SparesReports.tsx:263-274

**2. Data Source:** Server GET `/technical/api/reports/critical-spares/preview?vesselId=...`

**3. Derived:** `criticalEquip = linkedToCriticalEquipment ? 'YES' : 'NO'`. `shortageQty` server-computed.

**4. Parity:** View uses PDF download (not preview mode for this report). Excel via POST `/technical/api/reports/critical-spares`.

**5. Edge Cases:** Empty if no spares data for vessel.

---

#### Report 3.2: Low Stock Alert (Spares)

**1. Columns (8):** S.No (12), Part Code (30), Part Name (50), Component (45), Current Qty (20), Min Qty (18), Shortage (20), Status (25). Location: SparesReports.tsx:221-229

**2. Data Source:** Server GET `/technical/api/reports/low-stock-alert/:vesselId`

**3. Key Formula:** `shortage = minQty - currentQty` (server-computed)

**4. Parity:** Excel via POST `/technical/api/reports/low-stock-alert/:vesselId/excel`

---

#### Report 3.3: Consumption Pattern Analysis (Spares)

**1. Columns (10):** S.No (12), Part Code (28), Part Name (45), Component (40), Total Consumed (25), Consumption Events (28), Current ROB (22), Min Stock (18), Status (18), Last Consumed (25). Location: SparesReports.tsx:319-330

**2. Data Source:** Server GET `/technical/api/reports/consumption-analysis/:vesselId`

**3. Date Transform:** `lastConsumed` formatted DD-MMM-YYYY via custom formatter. Location: SparesReports.tsx:310-317

**4. Parity:** Excel via POST `/technical/api/reports/consumption-analysis/:vesselId/excel`

---

### Category 4: Stores

**Source Files:**
- Frontend: `client/src/pages/reports/StoresReports.tsx`
- Excel: `server/modules/reports/services/storesReportService.ts`
- Routes: `server/modules/reports/routes.ts` (lines 33-40)

---

#### Report 4.1: Stores Inventory Status

**1. Columns (8):** Item Code (30), Item Name (55), Category (30), ROB (20), Min (20), Location A (25), Location B (25), Status (25). Location: StoresReports.tsx:227-236

**2. Data Source:** Client-side from useQuery `/technical/api/stores` (or `/:vesselId`).

**3. Stock Status Logic:** `rob === 0 → 'Critical'; rob <= min → 'Low'; else → 'OK'`. Location: StoresReports.tsx:216-220. Note: `parseFloat(String(s.rob))` handles string/number input; NaN → 0.

**4. Parity:** Excel via POST `/technical/api/reports/stores-inventory-status/:vesselId/excel`

---

#### Report 4.2: Lubricants & Oil Analysis

**1. Columns (6):** Item Code (30), Item Name (60), ROB (25), Min (25), UOM (25), Status (30). Location: StoresReports.tsx:273-280

**2. Filter:** `storesItems.filter(s => s.itemType === 'lubes')`. UOM defaults to 'L'.

**3. Parity:** View/PDF only. No Excel endpoint.

---

#### Report 4.3: Chemicals Inventory & Expiry

**1. Columns (9):** Item Code (25), Item Name (45), Batch # (25), Expiry Date (25), Hazard (25), SDS Ref (25), ROB (20), Min (20), Status (25). Location: StoresReports.tsx:314-324

**2. Filter:** `storesItems.filter(s => s.itemType === 'chemicals')`

**3. Expiry Logic:** `days = Math.floor((expiryDate - today) / 86400000)`. `days < 0 → 'EXPIRED'; ≤ 30 → '{days}d'; ≤ 90 → '{days}d'; else → 'OK'`. Location: StoresReports.tsx:332-336

**4. SDS Compliance:** `Math.round((withSds / total) * 100)` — items with non-empty `sdsReference`. Location: StoresReports.tsx:354-355

**5. Parity:** View/PDF only. No Excel endpoint.

**6. Edge Cases:** Timezone uses `new Date()` (browser local); items near midnight may show off-by-one for expiry.

---

#### Report 4.4: Stores Low Stock Alert

**1. Columns (13):** S.No (12), Priority (18), Item Code (22), Item Name (40), Type (20), Category (22), ROB (15), Min Stock (15), Deficit (15), UOM (15), Avg Monthly (20), Days to Stockout (22), Est. Cost (20). Location: StoresReports.tsx:383-397

**2. Data Source:** Server GET `/technical/api/reports/stores-low-stock-alert/:vesselId`

**3. Key Formulas (server-computed):** `deficit = max(0, minStock - rob)`. `daysToStockout = (rob / avgMonthlyConsumption) * 30` (if avgMonthly > 0).

**4. Parity:** Excel via POST `/technical/api/reports/stores-low-stock-alert/:vesselId/excel`. 13 columns is the widest stores report.

**5. Edge Cases:** `daysToStockout` undefined if avgMonthlyConsumption=0 (division by zero).

---

### Category 5: Compliance (IHM)

#### Report 5.1: IHM Inventory Status

**1. Columns (10):** S.No (8), Item Code (18), Item Name (38), Item Type (14), Component/Category (20), IHM Status (16), Evidence Type (16), Current ROB (14), Location (16), UOM (10).

**2. Data Source:** Server GET `/technical/api/reports/ihm-inventory-status?vesselId=...`

**3. Parity:** Excel via POST `/technical/api/reports/ihm-inventory-status/excel`. 10 columns aligned.

**4. Edge Cases:** Empty if no IHM items configured for vessel.

---

### Category 6: Change Requests

#### Report 6.1: Change Requests Status & Tracking

**1. Columns (13):** ID (10), Title (40), Category (18), Status (16), Requested By (20), Vessel (18), Submitted (18), Reviewed By (20), Reviewed At (18), Cycle Time hrs (16), Target (28), Changes (12), Reason (30). Location: ChangeRequestReports.tsx:237-251

**2. Data Source:** Server GET `/technical/api/reports/change-requests-status-tracking?vesselId=...&status=...&category=...&startDate=...&endDate=...`

**3. Derived Fields:**

| Field | Formula | Location |
|-------|---------|----------|
| `cycleTime` | Server-computed: `reviewedAt - submittedAt` in hours | Server: changeRequestReportService |
| `approvalRate` | `Math.round((approved / totalRequests) * 100)` | ChangeRequestReports.tsx:270 |
| `rejectedPct` | `Math.round((rejected / totalRequests) * 100)` | ChangeRequestReports.tsx:271 |
| `title` | Truncated: `title.length > 50 ? title.substring(0,47)+'...' : title` | ChangeRequestReports.tsx:255 |
| `target` | `'{CategoryLabel} - {targetInfo.name}'` | ChangeRequestReports.tsx:264 |

**4. Category Labels:** `components → 'Components'`, `work_orders → 'Work Orders'`, `spares → 'Spares'`, `stores → 'Stores'`. Location: ChangeRequestReports.tsx:107-112

**5. Status Labels:** `draft/submitted/returned/approved/rejected → Display labels`. Location: ChangeRequestReports.tsx:114-120

**6. View/PDF/Excel Parity:** View/PDF share columns. PDF uses generic `generateReport()` landscape. Excel is **GET** (not POST): `/technical/api/reports/change-requests-status-tracking/export?params`. Location: ChangeRequestReports.tsx:378-398

**7. Edge Cases:** `cycleTimeHours` null if not yet reviewed. Title truncated at 50 chars. Excel uses GET method (unlike most POST endpoints).

---

### Category 7: LSA/FFA

#### Report 7.1: LSA/FFA Equipment Master List

**1. Columns (12):** S.No (8), Component Code (22), Component Name (40), Equipment Type (16), Location (20), Maker (20), Model (20), Serial No (18), Installation Date (16), Criticality (12), Class Item (12), Active (10). Location: LsaFfaReports.tsx:178-191

**2. Data Source:** Server GET `/technical/api/reports/lsa-ffa-master-list?vesselId=...&equipmentType=...`

**3. Excel Export:** GET with `?format=excel` query param on same endpoint (not separate POST). Location: LsaFfaReports.tsx:344-346

**4. Edge Cases:** Empty if no LSA/FFA components. Equipment type filter: 'LSA', 'FFA', or omitted.

---

#### Report 7.2: LSA/FFA Maintenance Schedule & Status

**1. Columns (16):** S.No (6), Comp Code (16), Component Name (28), Type (8), Location (16), Job Code (14), Job Title (30), Task Type (14), Basis (12), Frequency (12), Next Due (14), Days (8), Status (12), Last Done (14), Last WO (16), Assigned To (14). Location: LsaFfaReports.tsx:249-266

**2. Data Source:** Server GET `/technical/api/reports/lsa-ffa-maintenance-schedule?vesselId=...&equipmentType=...&status=...`

**3. Excel Export:** GET with `?format=excel` query param. Location: LsaFfaReports.tsx:347-349

**4. Edge Cases:** 16 columns is the widest single report. Status filter applied server-side.

---

## Section C: Formula & Logic Index

### Date / Time Formulas

| Formula Name | Expression | Implementation Location | Used In | Notes |
|-------------|------------|------------------------|---------|-------|
| Days Remaining | `Math.ceil((dueDate - now) / 86400000)` | MaintenanceReports.tsx:335-337 | 1.1 | Negative = overdue; ceil rounds up to next day |
| Days Overdue | `Math.floor((now - dueDate) / 86400000)` | MaintenanceReports.tsx:451 | 1.2 | Floor rounds down; 0 = today |
| RH Overdue | `Math.max(0, currentCumulativeRH - nextDueReading)` | MaintenanceReports.tsx:452-454 | 1.2 | Clamped to ≥ 0 |
| Days Extended | `Math.ceil((newDueDate - originalDueDate) / 86400000)` | MaintenanceReports.tsx:955-965 | 1.7 | Result ≤ 0 → '-' |
| Duration (hrs) | `(endTime - startTime) / 3600000` | MaintenanceReports.tsx:559-569 | 1.3 | Milliseconds → hours |
| Expiry Days | `Math.floor((expiryDate - today) / 86400000)` | StoresReports.tsx:334 | 4.3 | Negative = expired |
| Cycle Time | `reviewedAt - submittedAt` (hours) | Server: changeRequestReportService | 6.1 | Null if not reviewed |
| Date Format | `DD-MMM-YYYY` via `formatDate()` | pdfReportGenerator.ts (exported) | All | Common date display |
| Date Format (custom) | DD-MMM-YYYY via regex + manual month lookup | MaintenanceReports.tsx:529-542 | 1.3 | Used for start/completion dates |
| DD-MMM-YYYY Parse | Custom regex `^(\d{1,2})-([A-Za-z]{3})-(\d{4})$` | MaintenanceReports.tsx:678-693 | 1.4 | Parses string dueDate to Date object |

### Threshold / Status Formulas

| Formula Name | Expression | Implementation Location | Used In |
|-------------|------------|------------------------|---------|
| Due Jobs Status | `days < 0 → OVERDUE; ≤ 2 → URGENT; ≤ 7 → DUE; else ACTIVE` | MaintenanceReports.tsx:327-333 | 1.1 |
| Overdue Grace (Calendar) | `dueDate < (now - 7 days)` | MaintenanceReports.tsx:396-410 | 1.2 |
| Overdue Grace (RH) | `(currentRH - nextDueRH) > 168` | MaintenanceReports.tsx:413-416 | 1.2 |
| Stock Status (Stores) | `rob === 0 → Critical; rob ≤ min → Low; else OK` | StoresReports.tsx:216-220 | 4.1, 4.2, 4.3 |
| Shortage | `max(0, minQty - currentQty)` | Server: sparesReportService, storesReportService | 3.2, 4.4 |
| Days to Stockout | `(rob / avgMonthlyConsumption) * 30` | Server: storesReportService | 4.4 |
| Critical Equipment | `criticality in ('Yes','Critical') \|\| critical === true` | MaintenanceReports.tsx:455 | 1.2 |
| Overdue Type | `calOverdue AND rhOverdue → 'Both'; rhOverdue → 'RH'; else → 'Calendar'` | MaintenanceReports.tsx:422-428 | 1.2 |

### Aggregation / Rate Formulas

| Formula Name | Expression | Implementation Location | Used In |
|-------------|------------|------------------------|---------|
| Man-Hours | `parseFloat(wo.manhours) \|\| (duration × noOfPersons)` | MaintenanceReports.tsx:609 | 1.3, 1.4, 1.10 |
| Completion Rate | `Math.round((completed / total) * 100)` | MaintenanceReports.tsx:732 | 1.4, 1.8, 1.10 |
| Workload % | `Math.round((assigneeManhours / totalManhours) * 100)` | MaintenanceReports.tsx:1165 | 1.10 |
| Approval Rate | `Math.round((approved / totalRequests) * 100)` | ChangeRequestReports.tsx:270 | 6.1 |
| SDS Compliance | `Math.round((withSds / totalChemicals) * 100)` | StoresReports.tsx:354-355 | 4.3 |
| Variance | `actualHours - plannedHours` | MaintenanceReports.tsx:1061 | 1.9 |
| Avg Time | `totalTimeTaken / jobsWithTime` | MaintenanceReports.tsx:1163 | 1.10 |
| On-Time % | `Math.round((completed / total) * 100)` | MaintenanceReports.tsx:1028 | 1.8 |
| Total Man-Hours Sum | `accumulator += manHours` per row | MaintenanceReports.tsx:610 | 1.3, 1.4 |

---

## Section D: Troubleshooting Matrix

### Ordered Diagnostic Checkpoints (per scenario)

#### D.1: Report Shows 0 Rows

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | API Response | Does the API return any data? | Browser DevTools → Network tab → check response body |
| 2 | Vessel Selection | Is a specific vessel selected (not 'all')? | Check `effectiveVesselId` in React state |
| 3 | Status Filter | Are Completed/Postponed WOs being excluded? | Check filter logic in the report's switch case |
| 4 | Date Range | Is date range filter too narrow? | Check `categoryFilters.dateRange` values |
| 5 | Data Existence | Does the DB have matching records? | Query work_orders table directly |
| 6 | Server Query | Is server query filtering correctly? | Check server controller/service file |

#### D.2: Excel Has Different Columns Than View

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Frontend Columns | Count columns in the switch case `columns` array | Read MaintenanceReports.tsx (or respective file) at the report's case block |
| 2 | Excel Service | Count columns in the Excel service file | Read the corresponding service file in `server/modules/reports/services/` |
| 3 | Column Name Match | Do headers match exactly between frontend and Excel service? | Diff the two arrays |
| 4 | Legacy Template | Is the Excel service still using STANDARD_WORK_ORDER_COLUMNS? | Search for `STANDARD_WORK_ORDER_COLUMNS` in the service file |
| 5 | Fix | Replace Excel columns with exact copy from frontend | Copy column array from frontend to Excel service |

#### D.3: PDF Missing or Wrong Conditional Formatting

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Generator Method | Which PDF generator method is used? | Check `pdfReportGenerator.generate*()` call in switch case |
| 2 | Field Names | Do `didParseCell` checks use correct field names? | Read pdfReportGenerator.ts:209-291 (generic) or method-specific code |
| 3 | Column Index | Is `findIndex` matching the right column? | Verify `statusColIndex`, `priorityColIndex`, `daysColIndex` |
| 4 | Data Values | Does row data have the expected field values? | Console.log row data before PDF generation |
| 5 | Color Constants | Are PDF_COLORS values correct? | Check pdfReportGenerator.ts:17-42 |

#### D.4: "Vessel Required" Error

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | effectiveVesselId | Is value 'all' or empty string? | Check vessel selector UI state |
| 2 | Server Validation | Does endpoint require specific vessel? | Check server controller for vesselId validation |
| 3 | Context | Is VesselContext providing a vessel? | Check `useVessel()` hook return |
| 4 | Fix | Select a specific vessel in the UI | User action required |

#### D.5: Man-Hours Showing 0 or '—'

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | manhours Field | Is `wo.manhours` populated? | Query WO record in DB |
| 2 | Time Fields | Are `startDateTime`/`completionDateTime` populated? | Check WO time tracking fields |
| 3 | totalTimeHours | Is `wo.totalTimeHours` populated? | Check WO record |
| 4 | noOfPersons | Is `wo.noOfPersons` > 0? | Check WO record (defaults to 1) |
| 5 | Fallback Chain | `parseFloat(manhours) → duration×persons → '—'` | Trace MaintenanceReports.tsx:607-609 |

#### D.6: Overdue Jobs Not Appearing (Grace Period)

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Grace Period | Is WO within 7-day grace period? | Calculate: `now - dueDate` in days |
| 2 | Report 1.1 vs 1.2 | WO 1-7 days overdue → appears in 1.1 (Due Jobs), NOT in 1.2 (Overdue) | This is by design |
| 3 | RH Check | Does WO have RH data? If RH overdue > 168, it appears in 1.2 | Check nextDueReading and currentCumulativeRH |
| 4 | Status | Is WO status Completed or Postponed? | These are always excluded |

#### D.7: Monthly Summary Unexpected Overdue Count

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Scope | Cumulative overdue = ALL WOs with dueDate < periodEnd AND not completed | This includes historic backlog |
| 2 | Period | Verify periodEnd is set correctly (last day of month, 23:59:59) | Check MaintenanceReports.tsx:705 |
| 3 | Expectation | Cumulative count can exceed in-scope count | This is by design |

#### D.8: Excel Download Returns 500 Error

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Server Logs | Check stack trace in server console | Read server logs or terminal output |
| 2 | Route Exists | Is the endpoint registered in routes.ts? | Check server/modules/reports/routes.ts |
| 3 | Service File | Does the service function exist and export correctly? | Check the corresponding service file |
| 4 | DB Connection | Is the database accessible? | Check DB connection status |
| 5 | Request Body | Is vesselId present in request body? | Check browser DevTools Network tab |
| 6 | Dependencies | Are ExcelJS and other packages installed? | Check node_modules |

#### D.9: Change Request Excel Uses GET Instead of POST

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Endpoint | CR Excel uses GET `/technical/api/reports/change-requests-status-tracking/export` | routes.ts:74 |
| 2 | Params | Filters sent as query params, not request body | ChangeRequestReports.tsx:378-383 |
| 3 | Comparison | Most other Excel exports use POST with JSON body | This is the exception |

#### D.10: LSA/FFA Excel Uses format=excel Query Param

| Step | Checkpoint | What to Check | Tool/Command |
|------|-----------|---------------|-------------|
| 1 | Endpoint | LSA/FFA Excel uses same GET endpoint with `?format=excel` | LsaFfaReports.tsx:344-349 |
| 2 | Server | Server checks `format` query param to decide JSON vs Excel response | equipmentReportsController |
| 3 | Comparison | Most other Excel exports use separate POST endpoints | LSA/FFA is the exception |

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

Verification procedure: For each report, the view-mode column array was compared against the PDF generator call and Excel service file. Column count and header names were confirmed matching.

| # | Report | View | PDF | Excel | Verification Status |
|---|--------|------|-----|-------|---------------------|
| 1.1 | Due Jobs (7 Days) | 8 | 8 | 8 | Verified: columns array shared between view/PDF; Excel service updated to match |
| 1.2 | Overdue Jobs | 15 | 15 | 15 | Verified: columns array shared between view/PDF; Excel service updated to match |
| 1.3 | Completed Jobs Register | 11 | 11 | 11 | Verified: columns array shared; PDF switched from legacy 24-col to generic; Excel reduced |
| 1.4 | Monthly Maintenance Summary | 3 | 3 | KPI | Verified: same 3 columns in view/PDF; Excel uses KPI dashboard with same metrics |
| 1.5 | Critical Equipment Status | 12 | 12 | 12 | Verified: columns array shared; specialized PDF generator uses same cols |
| 1.6 | Unplanned/Breakdown Jobs | 11 | 11 | 11 | Verified: server returns data with matching fields; same columns in all formats |
| 1.7 | Job Postponement Log | 10 | 10 | 10 | Verified: columns array shared; Excel service updated from 19 to 10 columns |
| 1.8 | Work Priority Performance | 5 | 5 | N/A | Verified: no Excel endpoint; view/PDF share columns |
| 1.9 | Man-Hours Analysis | 5 | 5 | N/A | Verified: no Excel endpoint; view/PDF share columns |
| 1.10 | Crew Workload Distribution | 10 | 10 | 10 | Verified: columns shared; Excel via separate service with matching cols |
| 2.1 | Equipment Utilization Summary | 10 | 10 | 10 | Verified: server data structure matches column definition |
| 2.2 | RH Anomaly Detection | 11 | 11 | 11 | Verified: server data structure matches column definition |
| 3.1 | Critical Spares Availability | 10 | 10 | 10 | Verified: server data matches; Excel via POST |
| 3.2 | Low Stock Alert (Spares) | 8 | 8 | 8 | Verified: server data matches; Excel via POST |
| 3.3 | Consumption Analysis (Spares) | 10 | 10 | 10 | Verified: server data matches; Excel via POST |
| 4.1 | Stores Inventory Status | 8 | 8 | 8 | Verified: client-side data; Excel via POST |
| 4.2 | Lubricants & Oil Analysis | 6 | 6 | N/A | Verified: no Excel; view/PDF share columns |
| 4.3 | Chemicals Inventory & Expiry | 9 | 9 | N/A | Verified: no Excel; view/PDF share columns |
| 4.4 | Stores Low Stock Alert | 13 | 13 | 13 | Verified: server data matches; Excel via POST |
| 5.1 | IHM Inventory Status | 10 | 10 | 10 | Verified: server data matches; Excel via POST |
| 6.1 | CR Status & Tracking | 13 | 13 | 13 | Verified: columns shared; Excel via GET (exception) |
| 7.1 | LSA/FFA Equipment Master | 12 | 12 | 12 | Verified: columns shared; Excel via format=excel param |
| 7.2 | LSA/FFA Maintenance Schedule | 16 | 16 | 16 | Verified: columns shared; Excel via format=excel param |

---

## API Endpoint Quick Reference

| Method | Endpoint | Report | Request Format |
|--------|----------|--------|----------------|
| POST | `/technical/api/reports/due-jobs-7-days` | 1.1 | `{ vesselId }` |
| POST | `/technical/api/reports/overdue-jobs` | 1.2 | `{ vesselId }` |
| POST | `/technical/api/reports/completed-jobs` | 1.3 | `{ vesselId, dateFrom?, dateTo? }` |
| POST | `/technical/api/reports/maintenance/monthly-summary/excel` | 1.4 | `{ vesselId, startDate?, endDate? }` |
| POST | `/technical/api/reports/critical-equipment-status/excel` | 1.5 | `{ vesselId }` |
| POST | `/technical/api/reports/unplanned-breakdown-jobs/excel` | 1.6 | `{ vesselId, startDate?, endDate? }` |
| POST | `/technical/api/reports/postponement-log` | 1.7 | `{ vesselId }` |
| POST | `/technical/api/reports/crew-workload-distribution/excel` | 1.10 | `{ vesselId, startDate?, endDate?, viewType }` |
| POST | `/technical/api/reports/equipment-utilization-summary/excel` | 2.1 | `{ vesselId, startDate?, endDate? }` |
| POST | `/technical/api/reports/running-hours-anomaly-detection/excel` | 2.2 | `{ vesselId, startDate?, endDate? }` |
| POST | `/technical/api/reports/critical-spares` | 3.1 | `{ vesselId }` |
| POST | `/technical/api/reports/low-stock-alert/:vesselId/excel` | 3.2 | POST body |
| POST | `/technical/api/reports/consumption-analysis/:vesselId/excel` | 3.3 | POST body |
| POST | `/technical/api/reports/stores-inventory-status/:vesselId/excel` | 4.1 | POST body |
| POST | `/technical/api/reports/stores-low-stock-alert/:vesselId/excel` | 4.4 | POST body |
| POST | `/technical/api/reports/ihm-inventory-status/excel` | 5.1 | POST body |
| GET | `/technical/api/reports/change-requests-status-tracking/export` | 6.1 | Query params |
| GET | `/technical/api/reports/lsa-ffa-master-list?format=excel` | 7.1 | Query params |
| GET | `/technical/api/reports/lsa-ffa-maintenance-schedule?format=excel` | 7.2 | Query params |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `client/src/pages/reports/MaintenanceReports.tsx` | Maintenance category (10 reports): view columns + PDF generation |
| `client/src/pages/reports/RunningHoursReports.tsx` | Running Hours (2 reports): view + PDF |
| `client/src/pages/reports/SparesReports.tsx` | Spares (3 reports): view + PDF |
| `client/src/pages/reports/StoresReports.tsx` | Stores (5 reports): view + PDF |
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
| `server/lib/excelReportStyles.ts` | Shared Excel styles (STANDARD_WORK_ORDER_COLUMNS — legacy, no longer used by active exports) |

### Architecture Pattern

**Column Definition Flow:**
```
Frontend switch block → defines columns[] array
  ├── setPreviewData({ columns, data }) → View/Preview (inline table)
  ├── pdfReportGenerator.generateReport(config, columns, data) → PDF download
  └── Excel: separate service file must manually mirror columns
```

**Key Invariant:** View and PDF always share the same column array (single source of truth). Excel services are independent and must be manually kept in sync.

**PDF Generation Methods:**

| Method | Used By | Paper | Notes |
|--------|---------|-------|-------|
| `generateReport()` | Most reports | A4 landscape | Generic table with conditional formatting |
| `generateOverdueJobsReport()` | 1.2 Overdue | A3 landscape | Colored header bar, critical row highlighting |
| `generateCriticalEquipmentReport()` | 1.5 Critical Equip | Custom | Metadata summary block above table |
| `generateUnplannedBreakdownReport()` | 1.6 Unplanned | Custom | Similar to overdue styling |
| `generateCompletedJobsRegisterReport()` | Legacy (unused) | A3 | Was 24 cols, replaced by generic 11-col in Phase 1 |
