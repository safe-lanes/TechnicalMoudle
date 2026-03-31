# PMS Reports Module — Comprehensive Audit & Technical Reference

> **Generated:** 2026-03-31  
> **Scope:** 23 reports across 7 categories (Maintenance ×10, Running Hours ×2, Spares ×3, Stores ×5, Compliance/IHM ×1, Change Requests ×1, LSA/FFA ×2)  
> **Note:** Original task framing referenced "22 reports across 8 categories." Actual code implements 23 report IDs across 7 categories (Stores has 5 reports including `stores-consumption-analysis`, which was added after initial scoping).  
> **Purpose:** Full technical verification and troubleshooting reference covering column definitions, formula logic, data sources, derivation paths, API endpoints, verification methods, edge cases, and debugging guides for every report in the PMS Reports Module.  
> **Line Number Disclaimer:** Source file line references (e.g., `MaintenanceReports.tsx:335-337`) are snapshot-based from the date above and may drift as code evolves. Prefer searching for the formula expression or function name as a stable anchor.  
> **Maintenance:** This document should be updated whenever report columns, formulas, or API endpoints are modified. The view-mode column array is the single source of truth — PDF and Excel must match.

---

## Section A: Master Report Inventory (Consolidated Technical-Verification Table)

| # | Category | Report Name | View | PDF | Excel | Export Match | Data Source | Frontend File:Lines | Excel Service File | Formula Summary | Formula Location | Verification Method | Troubleshooting Path | Input Dependencies | Edge Cases | Notes |
|---|----------|-------------|------|-----|-------|-------------|-------------|--------------------|--------------------|-----------------|-----------------|---------------------|---------------------|--------------------|------------|-------|
| 1.1 | Maintenance | Due Jobs (7 Days) | 8 | 8 | 8 | All 3 match | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:314-392 | maintenanceReportService.ts | `daysRemaining=ceil((due-now)/86400000)`; status tiers | MaintenanceReports.tsx:327-337 | Preview→verify sample daysRemaining→PDF row count→Excel 8 cols | API→vesselFilter→statusFilter→dateCalc→statusAssign→colMap→export | wo.dueDate, wo.status, wo.jobPriority, wo.assignedTo | No dueDate→excluded; Completed/Postponed→excluded; TZ may shift ±1 day; old overdue items still appear | Phase 1: Excel updated from 18→8 cols |
| 1.2 | Maintenance | Overdue Jobs | 15 | 15 | 15 | All 3 match | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:395-524 | maintenanceReportService.ts | `daysOverdue=floor((now-due)/86400000)`; grace 7d/168RH; overdueType | MaintenanceReports.tsx:396-476 | Grace period test (3d overdue→NOT shown)→RH overdue→critical sort→PDF A3→Excel 15 cols | API→graceFilter→daysCalc→RHcalc→typeClassify→critSort→colMap→export | wo.dueDate, wo.status, wo.nextDueReading, wo.currentCumulativeRH, wo.criticality | 1-7d overdue→in 1.1 NOT 1.2; missing RH fields→skip RH check; S.No re-numbered after sort | Phase 1: Excel updated from 18→15 cols; PDF uses A3 specialized generator |
| 1.3 | Maintenance | Completed Jobs | 11 | 11 | 11 | All 3 match | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:527-673 | maintenanceReportService.ts | `manHours=parseFloat(manhours)\|\|(duration×persons)`; `duration=totalTimeHours\|\|(end-start)/3600000` | MaintenanceReports.tsx:559-637 | Date range with known WOs→verify manHours calc→total sum→PDF 11 cols→Excel 11 cols | API→statusFilter→dateRangeFilter→durationCalc→manhourCalc→sort→colMap→export | wo.status, wo.dateCompleted, wo.startDateTime, wo.manhours, wo.noOfPersons | Missing times AND manhours→'—'; noOfPersons missing→1; totalTimeHours is string→parseFloat | Phase 1: PDF switched from 24→11 cols; Excel from 24→11 cols |
| 1.4 | Maintenance | Monthly Summary | 3 | 3 | KPI | KPI format differs, same metrics | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:676-818 | maintenanceReportService.ts | `completionRate=round((completed/inScope)*100)`; cumulative overdue; dept/priority breakdown | MaintenanceReports.tsx:696-803 | Set known month→verify inScope count→completion rate→cumulative overdue→dept sums→Excel KPI | API→periodCalc→scopeFilter→completedCount→overdueCount→deptGroup→priorityGroup→export | wo.dueDate, wo.status, wo.completionDateTime, wo.department, wo.jobPriority, wo.manhours | Default period=current month; cumulative overdue includes ALL historic backlog; DD-MMM-YYYY parse regex | Excel uses KPI dashboard layout, not table |
| 1.5 | Maintenance | Critical Equipment | 12 | 12 | 12 | All 3 match | Server: GET `/technical/api/reports/critical-equipment-status` | MaintenanceReports.tsx:821-878 | equipmentReportService.ts | Server-computed: component joins WO counts (total/overdue/dueSoon); daysUntilDue | Server: equipmentReportsController | Verify response has data+metadata→component appears only if critical/classItem→overdue counts→PDF 12 cols→Excel 12 cols | serverQuery→criticalFilter→WOjoin→countAgg→clientDisplay→colMap→export | vesselId param; server queries components+work_orders | Empty if no critical/class components; daysUntilDue null→'-'; uses specialized PDF generator | Server pre-computes all data |
| 1.6 | Maintenance | Unplanned Jobs | 11 | 11 | 11 | All 3 match | Server: GET `/technical/api/reports/unplanned-breakdown-jobs` | MaintenanceReports.tsx:881-936 | equipmentReportService.ts | Server-computed: manhours, totalHours, date range filter | Server: equipmentReportsController | Verify date params sent→server returns data+metadata→check manhours→PDF 11 cols→Excel 11 cols | serverQuery→dateFilter→WOfilter→dataTransform→clientDisplay→colMap→export | vesselId, startDate, endDate params | Default range=current month if not specified; uses specialized PDF generator | Server pre-computes all data |
| 1.7 | Maintenance | Postponement Log | 10 | 10 | 10 | All 3 match | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:938-999 | maintenanceReportService.ts | `daysExtended=ceil((newDue-origDue)/86400000)` | MaintenanceReports.tsx:955-965 | Filter Postponed WOs→verify daysExtended→invalid dates→'-'→PDF 10 cols→Excel 10 cols | API→statusFilter(Postponed)→dateCalc→fieldMapping→colMap→export | wo.status, wo.originalDueDate, wo.dueDate, wo.newDueDate, wo.postponedToDate, wo.postponementReason | Both dates missing→'-'; result≤0→'-'; status hardcoded 'Postponed' | Phase 1: Excel updated from 19→10 cols |
| 1.8 | Maintenance | Priority Performance | 5 | 5 | N/A | View/PDF match; no Excel | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:1001-1040 | — | `onTimePercent=round((completed/total)*100)`; overdue=dueDate<now AND status≠Completed | MaintenanceReports.tsx:1001-1030 | Group by priority→verify completed count→onTime%→overdue count | API→groupByPriority→countCompleted→countOverdue→rateCalc | wo.jobPriority, wo.status, wo.dueDate | Missing jobPriority→'Normal'; no Excel export available | View/PDF only |
| 1.9 | Maintenance | Man-Hours Analysis | 5 | 5 | N/A | View/PDF match; no Excel | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:1042-1073 | — | `variance=actualHours-plannedHours`; fallbacks for planned/actual | MaintenanceReports.tsx:1051-1063 | Filter completed→verify planned/actual→variance sign | API→statusFilter(Completed)→hoursFallback→varianceCalc | wo.plannedHours, wo.estimatedHours, wo.actualHours, wo.hoursSpent | Missing actual→equals planned→variance=0; no Excel export | View/PDF only |
| 1.10 | Maintenance | Workload Distribution | 10 | 10 | 10 | All 3 match | Client: useQuery `/technical/api/work-orders` | MaintenanceReports.tsx:1075-1190 | operationsReportService.ts | `workloadPct=round((assigneeMH/totalMH)*100)`; `completionPct=round((done/total)*100)` | MaintenanceReports.tsx:1141-1167 | Group by assignee→verify manhours sum→workload% sums ~100%→PDF 10 cols→Excel 10 cols | API→groupByAssignee→countStats→manhourSum→rateCalc→sort→colMap→export | wo.assignedTo, wo.assignee, wo.performedBy, wo.status, wo.manhours, wo.totalTimeHours | Missing assignee→'Unassigned'; totalMH=0→workloadPct='0%'; sorted by manhours DESC | Multiple assignee field fallbacks |
| 2.1 | Running Hours | Utilization Summary | 10 | 10 | 10 | All 3 match | Server: GET `/technical/api/reports/equipment-utilization-summary` | RunningHoursReports.tsx:175-245 | operationsReportService.ts | Server-computed: utilization bands (High/Normal/Low), avgDaily, periodHours, data quality flags | Server: operationsReportService | Verify summary totals (High+Normal+Low+NoData=Total)→util% 0-100+→data quality flags→Excel 10 cols | serverQuery→componentJoin→RHcalc→bandAssign→summaryAgg→clientDisplay→colMap→export | vesselId, startDate, endDate params | Requires specific vessel; empty if no RH data; estimated data capped; noData flag for missing | Server pre-computes utilization |
| 2.2 | Running Hours | Anomaly Detection | 11 | 11 | 11 | All 3 match | Server: GET `/technical/api/reports/running-hours-anomaly-detection` | RunningHoursReports.tsx:248-340 | complianceReportService.ts | Server-computed: anomaly types (high_increment/negative_delta/zero_change/irregular_pattern/meter_replaced), severity (critical/warning/info) | Server: complianceReportService | Verify anomaly types→severity classification→delta=newRh-prevRh→counts match summary→Excel 11 cols | serverQuery→logPairAnalysis→deltaCalc→thresholdCheck→anomalyClassify→clientDisplay→colMap→export | vesselId, startDate, endDate params | Empty if no RH logs; requires ≥2 log entries per component; negative_delta=meter rollback | Server pre-computes anomalies |
| 3.1 | Spares | Critical Spares | 10 | 10 | 10 | All 3 match | Server: GET `/technical/api/reports/critical-spares/preview` | SparesReports.tsx:258-303 | sparesReportService.ts | `shortage=max(0,minStock-rob)` (server); `criticalEquip=linkedToCriticalEquipment?'YES':'NO'` | SparesReports.tsx:285; Server: sparesReportService | Verify shortage calc→criticalEquip flag→stockStatus values→PDF 10 cols→Excel 10 cols | serverQuery→sparesFilter→shortageCalc→criticalityLink→clientMap→colMap→export | vesselId param | Empty if no spares for vessel; shortage server-computed | Server pre-computes shortage/status |
| 3.2 | Spares | Low Stock Alert | 8 | 8 | 8 | All 3 match | Server: GET `/technical/api/reports/low-stock-alert/:vesselId` | SparesReports.tsx:216-255 | sparesReportService.ts | `shortage=minQty-currentQty` (server) | Server: sparesReportService | Verify shortage values→status assignments→row count→PDF 8 cols→Excel 8 cols | serverQuery→stockCheck→shortageCalc→statusAssign→clientDisplay→colMap→export | vesselId path param | Empty if all above minimum; shortage server-computed | Server pre-computes all |
| 3.3 | Spares | Consumption Analysis | 10 | 10 | 10 | All 3 match | Server: GET `/technical/api/reports/consumption-analysis/:vesselId` → `storesCtrl.getCombinedConsumptionAnalysis` | SparesReports.tsx:305-361 | storesReportService.ts (combined endpoint) | `totalConsumed=sum(history)`; lastConsumed formatted DD-MMM-YYYY | SparesReports.tsx:310-317; Server: storesReportService (combined) | Verify totalConsumed→consumptionEvents count→lastConsumed date format→PDF 10 cols→Excel 10 cols | serverQuery(storesCtrl)→historyAgg→trendCalc→clientDateFormat→colMap→export | vesselId path param | lastConsumed uses custom DD-MMM-YYYY formatter; endpoint routes to storesCtrl NOT sparesCtrl | Combined endpoint serves spares consumption data |
| 4.1 | Stores | Inventory Status | 8 | 8 | 8 | All 3 match | Client: useQuery `/technical/api/stores` | StoresReports.tsx:226-267 | storesReportService.ts | `status: rob===0?'Critical':rob<=min?'Low':'OK'`; `rob=parseFloat(String(s.rob))\|\|0` | StoresReports.tsx:216-220, 239 | Verify status logic vs rob/min→parseFloat handles string→PDF 8 cols→Excel 8 cols | API→allStoresQuery→robParse→statusCalc→colMap→export | vesselId (optional); stores table | parseFloat(String(val)) handles string/number; NaN→0; 'all' vessel returns all stores | Client-side computation |
| 4.2 | Stores | Lubricants & Oil | 6 | 6 | N/A | View/PDF match; no Excel | Client: useQuery `/technical/api/stores`, filter itemType=lubes | StoresReports.tsx:270-308 | — | Same stock status as 4.1; UOM defaults to 'L' | StoresReports.tsx:216-220 | Verify only lubes items→UOM default→status calc→PDF 6 cols | API→typeFilter(lubes)→statusCalc→colMap→export | storesItems, itemType field | Empty if no lubes items; UOM='L' default; no Excel | View/PDF only |
| 4.3 | Stores | Chemicals & Expiry | 9 | 9 | N/A | View/PDF match; no Excel | Client: useQuery `/technical/api/stores`, filter itemType=chemicals | StoresReports.tsx:311-372 | — | `expiryDays=floor((expiry-today)/86400000)`; `sdsCompliance=round((withSds/total)*100)` | StoresReports.tsx:332-336, 354-355 | Verify EXPIRED for past dates→SDS%→filter itemType=chemicals→PDF 9 cols | API→typeFilter(chemicals)→expiryCalc→SDScount→statusCalc→colMap→export | storesItems, itemType, expiryDate, sdsReference | TZ uses new Date() (browser local); near-midnight off-by-one; no Excel | View/PDF only |
| 4.4 | Stores | Low Stock Alert | 13 | 13 | 13 | All 3 match | Server: GET `/technical/api/reports/stores-low-stock-alert/:vesselId` | StoresReports.tsx:374-450 | storesReportService.ts | `deficit=max(0,minStock-rob)`; `daysToStockout=(rob/avgMonthly)*30` | Server: storesReportService | Verify deficit calc→daysToStockout→div-by-zero check→PDF 13 cols→Excel 13 cols | serverQuery→deficitCalc→stockoutCalc→priorityAssign→clientDisplay→colMap→export | vesselId path param | daysToStockout undefined if avgMonthly=0; widest stores report (13 cols) | Server pre-computes |
| 4.5 | Stores | Consumption Analysis | 7 | Special | 7 | View/Excel=7; PDF uses specialized generator | Server: GET `/technical/api/reports/stores-consumption-analysis/:vesselId` → `storesCtrl.getStoresConsumptionAnalysis` | StoresReports.tsx:434-491 | storesReportService.ts | `confidence: daysOfData>90→High, ≥30→Medium, else→Low` | StoresReports.tsx:469-470; Server: storesReportService | Verify topConsumedItems→summary totals→confidence level→Excel 7 cols | serverQuery(storesCtrl)→topItemsAgg→trendCalc→forecastCalc→clientDisplay→colMap→export | vesselId path param | Uses specialized `generateConsumptionAnalysisPDF()` (not generic); includes forecast/trend/stockEfficiency sections | PDF is multi-section dashboard, not simple table |
| 5.1 | Compliance | IHM Inventory | 10 | 10 | 10 | All 3 match | Server: GET `/technical/api/reports/ihm-inventory-status` | IhmReports.tsx | complianceReportService.ts | Server-computed: IHM status mapping, evidence type classification | Server: complianceReportService | Verify server response structure→status values→evidence types→PDF 10 cols→Excel 10 cols | serverQuery→ihmStatusMap→evidenceMap→clientDisplay→colMap→export | vesselId param | Empty if no IHM items for vessel | Server pre-computes all |
| 6.1 | Change Requests | CR Tracking | 13 | 13 | 13 | All 3 match | Server: GET `/technical/api/reports/change-requests-status-tracking` | ChangeRequestReports.tsx:236-311 | changeRequestReportService.ts | `cycleTime=reviewedAt-submittedAt` (hrs, server); `approvalRate=round((approved/total)*100)`; title truncated 50 chars | ChangeRequestReports.tsx:255-271; Server: changeRequestReportService | Verify cycleTime→approval/rejection%→title truncation→category labels→Excel uses GET (not POST) | serverQuery→statusCount→cycleTimeCalc→categoryBreak→clientTruncate→colMap→export | vesselId, status, category, startDate, endDate params | cycleTime null if not reviewed; title >50 chars truncated; Excel is GET `/export` (exception) | Excel uses GET method unlike most reports |
| 7.1 | LSA/FFA | Equipment Master | 12 | 12 | 12 | All 3 match | Server: GET `/technical/api/reports/lsa-ffa-master-list` | LsaFfaReports.tsx:172-242 | equipmentReportService.ts | Server-computed: component listing with equipment type filter | Server: equipmentReportsController | Verify component count→equipmentType filter→summary counts→Excel via format=excel param | serverQuery→equipTypeFilter→componentMap→clientDisplay→colMap→export | vesselId, equipmentType params | Empty if no LSA/FFA components; Excel via `?format=excel` query param (exception) | Excel is GET with query param |
| 7.2 | LSA/FFA | Maintenance Schedule | 16 | 16 | 16 | All 3 match | Server: GET `/technical/api/reports/lsa-ffa-maintenance-schedule` | LsaFfaReports.tsx:243-322 | equipmentReportService.ts | Server-computed: maintenance items with schedule status (overdue/due-soon/on-schedule) | Server: equipmentReportsController | Verify schedule items→status filter→on-schedule/overdue/due-soon counts→Excel via format=excel param | serverQuery→equipTypeFilter→statusFilter→scheduleMap→clientDisplay→colMap→export | vesselId, equipmentType, status params | Widest report (16 cols); status filter server-side; Excel via `?format=excel` query param (exception) | Excel is GET with query param |

---

## Section B: Per-Report Technical Detail

**Template:** Each report follows 8 required subsections:
1. Column Definition (header, field, width, source field)
2. Data Source & Filter Logic
3. Derived Fields & Formulas (with file:line locations)
4. Sort Order & Summary Metrics
5. View/PDF/Excel Parity Notes
6. Verification Steps (ordered procedure)
7. Edge Cases & Failure Conditions
8. Troubleshooting Flow (ordered chain)

---

### Category 1: Maintenance & Work Orders

**Source Files:** Frontend: `client/src/pages/reports/MaintenanceReports.tsx` | PDF: `client/src/lib/pdfReportGenerator.ts` | Excel: `server/modules/reports/services/maintenanceReportService.ts` | Routes: `server/modules/reports/routes.ts:53-58`

---

#### Report 1.1: Due Jobs (7 Days)

**1. Column Definition (8 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Priority | priority | 22 | `wo.jobPriority \|\| 'Normal'` |
| 2 | Status | statusIndicator | 22 | Computed (see §3) |
| 3 | WO Number | workOrderNumber | 45 | `wo.workOrderNumber \|\| wo.workOrderNo \|\| wo.id` |
| 4 | Title | title | 70 | `wo.title \|\| wo.jobTitle \|\| '-'` |
| 5 | Component | component | 50 | `wo.component \|\| wo.componentName \|\| '-'` |
| 6 | Due Date | formattedDueDate | 26 | `formatDate(wo.dueDate)` |
| 7 | Days Left | daysRemaining | 20 | Computed (see §3) |
| 8 | Assigned To | assignedTo | 35 | `wo.assignedTo \|\| wo.assignee \|\| wo.responsibleRank \|\| '-'` |

**2. Data Source & Filter Logic:**
- Source: Client-side from `vesselWorkOrders` (useQuery `/technical/api/work-orders`). Location: MaintenanceReports.tsx:318-324
- Filter: `wo.dueDate exists AND wo.status NOT IN ('Completed','Postponed') AND dueDate <= (now + 7 days)`
- Note: Intentionally includes overdue jobs (dueDate < now).

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `daysRemaining` | `Math.ceil((dueDate.getTime() - now.getTime()) / (1000*60*60*24))` | MaintenanceReports.tsx:335-337 |
| `statusIndicator` | `days < 0 → 'OVERDUE'; days ≤ 2 → 'URGENT'; days ≤ 7 → 'DUE'; else → 'ACTIVE'` | MaintenanceReports.tsx:327-333 |
| `formattedDueDate` | `formatDate(wo.dueDate)` → DD-MMM-YYYY | pdfReportGenerator.ts (exported utility) |

**4. Sort Order & Summary:**
- Sort: `daysRemaining` ASC (most urgent first). Location: MaintenanceReports.tsx:352-356
- Summary: Total Due, Overdue count, Urgent ≤2d count, Critical Priority count. Location: MaintenanceReports.tsx:374-383

**5. View/PDF/Excel Parity:**
- View/PDF share identical `columns` array (MaintenanceReports.tsx:340-349). PDF uses `pdfReportGenerator.generateReport()`.
- PDF conditional formatting via `didParseCell` (pdfReportGenerator.ts:209-291): OVERDUE→bgDanger bold, URGENT→bgWarning bold, negative daysRemaining→bold.
- Excel: POST `/technical/api/reports/due-jobs-7-days` with `{ vesselId }`. Phase 1 fix: updated from 18-col STANDARD_WORK_ORDER_COLUMNS to 8 report-specific columns.

**6. Verification Steps:**
1. Select vessel with known WOs. Preview report in view mode.
2. Pick a sample WO, manually calculate `ceil((dueDate-now)/86400000)`, compare to displayed daysRemaining.
3. Verify status label: OVERDUE if negative, URGENT if ≤2, DUE if ≤7.
4. Export PDF → verify identical row count, column headers, sample values.
5. Export Excel → verify exactly 8 column headers matching view.
6. Test empty result set → should show "no data" state.

**7. Edge Cases:**
- `wo.dueDate` null/undefined → WO excluded entirely
- `wo.status` = Completed/Postponed → excluded even if due date in range
- Timezone: `new Date()` uses browser local time; `Math.ceil` means a WO due today at 23:59 shows 0 or 1 depending on current time
- Old overdue items (months/years past) still appear since filter only checks `≤ sevenDaysFromNow`

**8. Troubleshooting Flow:**
```
1. API → Check useQuery '/technical/api/work-orders' returns data
2. Vessel Filter → Verify effectiveVesselId is set, data filtered by vessel
3. Status Filter → Confirm Completed/Postponed excluded
4. Date Parse → Verify new Date(wo.dueDate) is valid
5. Day Calc → Check daysRemaining formula output
6. Status Assign → Verify threshold tier logic
7. Column Map → Field names in columns match data object keys
8. PDF Export → generateReport() receives correct columns/data
9. Excel Export → POST body contains vesselId; service file has 8 matching columns
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
| 8 | Days Overdue | daysOverdue | 16 | Computed (see §3) |
| 9 | Next Due RH | nextDueRH | 16 | `wo.nextDueReading?.toLocaleString() \|\| '-'` |
| 10 | Current RH | currentRH | 16 | `wo.currentCumulativeRH?.toLocaleString() \|\| '-'` |
| 11 | RH Overdue | rhOverdue | 14 | Computed (see §3) |
| 12 | Type | overdueType | 14 | Computed (see §3) |
| 13 | Assigned To | assignedTo | 20 | `wo.assignedTo \|\| wo.assignee \|\| wo.responsibleRank \|\| '-'` |
| 14 | Last Done | lastDoneDate | 18 | `formatDate(wo.lastDoneDate \|\| wo.lastDoneDateSnapshot) \|\| 'N/A'` |
| 15 | Critical | criticalEquip | 12 | Computed (see §3) |

**2. Data Source & Filter Logic:**
- Source: Client-side from `vesselWorkOrders`. Location: MaintenanceReports.tsx:396-419
- Grace constants: `GRACE_PERIOD_DAYS = 7`, `GRACE_PERIOD_RH = 168` (hours)
- Filter: `wo.status NOT IN ('Completed','Postponed') AND ((dueDate exists AND dueDate < (now - 7 days)) OR (nextDueReading AND currentCumulativeRH AND (currentCumulativeRH - nextDueReading) > 168))`

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `daysOverdue` | `Math.floor((now.getTime() - dueDate.getTime()) / (1000*60*60*24))` | MaintenanceReports.tsx:451 |
| `rhOverdue` | `Math.max(0, currentCumulativeRH - nextDueReading)` | MaintenanceReports.tsx:452-454 |
| `overdueType` | `calOverdue AND rhOverdue → 'Both'; only rhOverdue → 'RH'; else → 'Calendar'` | MaintenanceReports.tsx:422-428 |
| `criticalEquip` | `wo.criticality in ('Yes','Critical') \|\| wo.critical === true → 'YES' : 'NO'` | MaintenanceReports.tsx:455 |

**4. Sort Order & Summary:**
- Sort: Critical equipment first → daysOverdue DESC → componentName ASC. Location: MaintenanceReports.tsx:479-487
- S.No re-assigned after sort (MaintenanceReports.tsx:490)
- Summary: Total Overdue, Critical Equip count, Avg Days Overdue, Max Days Overdue, Calendar/RH split. Location: MaintenanceReports.tsx:493-509

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` array (MaintenanceReports.tsx:431-447). PDF uses specialized `generateOverdueJobsReport()` — A3 landscape with colored header bar.
- PDF conditional formatting: critical rows→bgDanger fill; days>30→textDarkRed bold; days>7→textDarkOrange bold. Location: pdfReportGenerator.ts:425-455
- Excel: POST `/technical/api/reports/overdue-jobs` with `{ vesselId }`. Phase 1: updated from 18→15 cols.

**6. Verification Steps:**
1. Find WO with dueDate >7 days ago → verify it appears.
2. Find WO with dueDate 3 days ago → verify it does NOT appear (within grace).
3. Test RH overdue: component with currentRH exceeding nextDueReading by >168h.
4. Verify critical equipment rows appear first in sorted output.
5. Verify S.No is sequential 1,2,3... after sort (not original index).
6. Compare PDF (A3 layout) row count with view.
7. Export Excel → verify 15 columns with correct headers.

**7. Edge Cases:**
- WO 1-7 days overdue: appears in 1.1 (Due Jobs) but NOT 1.2 (Overdue) due to grace
- WO with RH overdue but no calendar dueDate: only RH check applies
- Missing `nextDueReading` or `currentCumulativeRH`: RH check skipped, only calendar
- `daysOverdue` shows '-' if value is 0 or negative

**8. Troubleshooting Flow:**
```
1. API → Verify work-orders returns data with dueDate populated
2. Grace Period → Confirm 7d/168RH thresholds applied correctly
3. Date Parse → Check new Date(wo.dueDate) is valid
4. RH Data → Verify nextDueReading and currentCumulativeRH fields exist
5. Type Classify → overdueType matches both/rh/calendar rules
6. Critical Flag → criticality field check
7. Sort → Critical first, then daysOverdue DESC
8. PDF → generateOverdueJobsReport() called (not generic)
9. Excel → POST body has vesselId; 15-column alignment in service file
```

---

#### Report 1.3: Completed Jobs Register

**1. Column Definition (11 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 8 | Sequential idx+1 |
| 2 | WO No | workOrderNo | 22 | `wo.workOrderNo \|\| wo.id \|\| '—'` |
| 3 | Component | componentName | 28 | `wo.component \|\| wo.componentName \|\| '—'` |
| 4 | Job Title | jobTitle | 30 | `wo.jobTitle \|\| wo.title \|\| '—'` |
| 5 | Job Type | jobType | 14 | `wo.taskType \|\| wo.maintenanceType \|\| '—'` |
| 6 | Dept | department | 12 | `wo.department \|\| '—'` |
| 7 | Priority | priority | 12 | `wo.jobPriority \|\| wo.priority \|\| '—'` |
| 8 | Assigned To | assignedTo | 18 | `wo.performedBy \|\| wo.assignedTo \|\| '—'` |
| 9 | Start Date | startDate | 16 | `formatDateDDMMMYYYY(wo.startDateTime)` |
| 10 | Completion Date | completionDate | 16 | `formatDateDDMMMYYYY(wo.dateCompleted \|\| wo.completionDateTime)` |
| 11 | Man Hours | manHours | 12 | Computed (see §3) |

**2. Data Source & Filter Logic:**
- Source: Client-side: `vesselWorkOrders.filter(wo => wo.status === 'Completed')`. Location: MaintenanceReports.tsx:575
- Date range filter on `dateCompleted`/`completionDateTime` against `categoryFilters.dateRange`. Location: MaintenanceReports.tsx:577-592

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `duration` | `parseFloat(wo.totalTimeHours) \|\| ((completionTime - startTime) / 3600000)` | MaintenanceReports.tsx:559-569, 607 |
| `manHours` | `parseFloat(wo.manhours) \|\| (duration × parseInt(wo.noOfPersons \|\| 1))` | MaintenanceReports.tsx:609 |
| `totalManHours` | Running sum: `totalManHours += manHours` across all rows | MaintenanceReports.tsx:610 |
| `startDate` | Custom DD-MMM-YYYY via `formatDateDDMMMYYYY()` | MaintenanceReports.tsx:529-542 |
| `completionDate` | Custom DD-MMM-YYYY via `formatDateDDMMMYYYY()` | MaintenanceReports.tsx:529-542 |

**4. Sort Order & Summary:**
- Sort: `dateCompleted` DESC, then `workOrderNo` ASC. Location: MaintenanceReports.tsx:595-602
- Summary: Total Jobs (`data.length`), Total Man-Hours (`toFixed(1)`). Location: MaintenanceReports.tsx:655-658

**5. View/PDF/Excel Parity:**
- View/PDF share `completedColumns` (MaintenanceReports.tsx:640-652). PDF uses generic `generateReport()`.
- Phase 1: PDF switched from specialized 24-col method to generic 11-col; Excel reduced from 24→11 cols.
- Excel: POST `/technical/api/reports/completed-jobs` with `{ vesselId, dateFrom?, dateTo? }`.

**6. Verification Steps:**
1. Set date range covering known completed WOs. Verify count.
2. Calculate man-hours manually: check manhours field, then duration×persons fallback.
3. Verify total man-hours in summary = sum of all row values.
4. Export PDF → 11 columns (not legacy 24).
5. Export Excel → 11 columns with matching headers.

**7. Edge Cases:**
- Missing startDateTime AND completionDateTime AND manhours → manHours shows '—'
- `noOfPersons` missing → defaults to 1
- `totalTimeHours` is string → `parseFloat()` handles it
- Date range null → all completed WOs included

**8. Troubleshooting Flow:**
```
1. API → work-orders returns Completed status WOs
2. Date Filter → dateCompleted/completionDateTime populated
3. Duration Calc → startDateTime/completionDateTime valid ISO strings
4. ManHours Calc → Fallback: manhours → duration×persons → '—'
5. Summary → totalManHours accumulator
6. PDF → generateReport() called (not generateCompletedJobsRegisterReport)
7. Excel → POST body includes dateFrom/dateTo if range set; 11 cols in service
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
- Source: Client-side aggregation of `vesselWorkOrders`. Location: MaintenanceReports.tsx:696-705
- Period: `globalFilters.dateRange` if both set; else current month (1st to last day)

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `monthlyWOs` (in-scope) | WOs where dueDate in period OR (status=Completed AND completionDateTime in period) | MaintenanceReports.tsx:708-717 |
| `completedWOs` | Subset of monthlyWOs where `status === 'Completed'` | MaintenanceReports.tsx:720 |
| `cumulativeOverdue` | ALL WOs where `dueDate < periodEnd AND status !== 'Completed'` | MaintenanceReports.tsx:723-727 |
| `completionRate` | `Math.round((completed / inScope) * 100)` — 0 if inScope=0 | MaintenanceReports.tsx:732 |
| `totalManHours` | `sum(Number(wo.manhours \|\| wo.totalTimeHours \|\| wo.actualHours \|\| 0))` for completedWOs | MaintenanceReports.tsx:768-771 |
| Dept breakdown | Group by `wo.department \|\| wo.assignedDepartment \|\| 'Unassigned'` | MaintenanceReports.tsx:735-746 |
| Priority breakdown | Group by `wo.jobPriority \|\| 'Normal'` with seed keys High/Medium/Low/Normal | MaintenanceReports.tsx:749-765 |

**4. Data Sections:** Executive Summary (6 rows) + Priority Breakdown (dynamic) + Department Breakdown (dynamic). Location: MaintenanceReports.tsx:782-803

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:775-779). PDF uses generic `generateReport()`.
- Excel uses KPI dashboard layout (different visual, same metrics). POST with `{ vesselId, startDate?, endDate? }`.

**6. Verification Steps:**
1. Set date range to month with known WO activity.
2. Verify inScope = WOs due in period + completed in period (no double-count).
3. Verify completionRate = completed / inScope × 100.
4. Verify cumulative overdue counts ALL historic backlog (not just new in period).
5. Check dept/priority breakdowns sum to correct totals.
6. Excel: verify KPI layout has same metrics.

**7. Edge Cases:**
- Empty period → completionRate=0, all counts=0
- Cumulative overdue may exceed inScope count (by design — includes historic backlog)
- Date parse: custom regex handles DD-MMM-YYYY. Location: MaintenanceReports.tsx:678-693
- Default period = current month if no dateRange filter

**8. Troubleshooting Flow:**
```
1. Period Calc → periodStart/periodEnd correct month boundaries
2. Scope Filter → dueDate in period OR completed in period
3. Overdue Calc → cumulative: dueDate < periodEnd AND not completed
4. Date Parse → DD-MMM-YYYY regex handles input formats
5. Aggregation → dept/priority grouping keys correct
6. ManHours → Number() conversion of manhours/totalTimeHours
7. Excel → KPI dashboard maps to same metrics
```

---

#### Report 1.5: Critical Equipment Status

**1. Column Definition (12 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 8 | Server-assigned sequential |
| 2 | Comp. Code | componentCode | 18 | Server: component.componentCode |
| 3 | Component Name | componentName | 38 | Server: component.componentName |
| 4 | Critical | isCritical | 12 | Server: component.isCritical → 'YES'/'NO' |
| 5 | Class Item | isClassItem | 12 | Server: component.isClassItem → 'YES'/'NO' |
| 6 | Dept | department | 15 | Server: component.department |
| 7 | Location | location | 15 | Server: component.location |
| 8 | Total WOs | totalWorkOrders | 12 | Server: count of WOs per component |
| 9 | Overdue | overdueJobs | 12 | Server: count where dueDate<now AND not completed |
| 10 | Due Soon | dueSoonJobs | 12 | Server: count where dueDate within 7 days |
| 11 | Next Due | nextDueDate | 18 | Server: earliest upcoming dueDate, formatted client-side |
| 12 | Days | daysUntilDue | 10 | Server: days until next due date |

**2. Data Source & Filter Logic:**
- Source: Server-side GET `/technical/api/reports/critical-equipment-status?vesselId=...`
- Server queries components where `isCritical=true OR isClassItem=true`, joins with work_orders
- Returns `{ data[], metadata }`. Location: MaintenanceReports.tsx:838-839

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `nextDueDate` | `formatDate(item.nextDueDate)` (client-side formatting of server value) | MaintenanceReports.tsx:848 |
| `daysUntilDue` | Displayed as-is from server; '-' if null | MaintenanceReports.tsx:849 |
| All counts | Server pre-computed: totalWorkOrders, overdueJobs, dueSoonJobs | Server: equipmentReportsController |

**4. Sort & Summary:**
- Sort: Server-provided order. Summary from `metadata`: Total Critical Equipment, Critical Only, Class Item Only, Both, With Overdue, Due Soon.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:832-845). PDF uses specialized `generateCriticalEquipmentReport()` with metadata summary block.
- Excel: POST `/technical/api/reports/critical-equipment-status/excel` with `{ vesselId }`.

**6. Verification Steps:**
1. Verify server response has `data` and `metadata` fields.
2. Check only isCritical OR isClassItem components appear.
3. Cross-check overdue/dueSoon counts against actual WO statuses.
4. PDF: verify metadata summary block renders above table.
5. Excel: verify 12 columns match.

**7. Edge Cases:**
- Empty if no critical/class components for vessel.
- `daysUntilDue` null → displays '-'.
- Server handles all computation — client only formats dates.

**8. Troubleshooting Flow:**
```
1. API → GET endpoint returns 200 with data/metadata
2. VesselId → Specific vessel required (not 'all')
3. Component Filter → Only isCritical/isClassItem components
4. WO Counts → Server join produces correct counts
5. Date Format → Client formatDate() on nextDueDate
6. PDF → generateCriticalEquipmentReport() with metadata
7. Excel → POST body has vesselId; 12 cols in service
```

---

#### Report 1.6: Unplanned/Breakdown Jobs

**1. Column Definition (11 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 8 | Server-assigned sequential |
| 2 | WO Number | workOrderNo | 20 | Server: wo.workOrderNo |
| 3 | Comp. Code | componentCode | 15 | Server: wo.componentCode |
| 4 | Component Name | componentName | 30 | Server: wo.componentName |
| 5 | Job Title | jobTitle | 25 | Server: wo.jobTitle |
| 6 | Description | briefDescription | 35 | Server: wo.briefDescription |
| 7 | Created Date | createdDate | 16 | Server: formatted date |
| 8 | Completed Date | completedDate | 16 | Server: formatted date |
| 9 | Performed By | performedBy | 18 | Server: wo.performedBy |
| 10 | Hours | totalHours | 10 | Server: wo.totalHours |
| 11 | Manhours | manhours | 12 | Server: wo.manhours |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/unplanned-breakdown-jobs?vesselId=...&startDate=...&endDate=...`
- Date defaults: Current month if not specified. Location: MaintenanceReports.tsx:883-887
- Returns `{ data[], metadata }`. Location: MaintenanceReports.tsx:899

**3. Derived Fields:** All server-computed (manhours, totalHours, dates).

**4. Sort & Summary:**
- Summary from metadata: Total Unplanned Jobs, Total Manhours, Avg Time Taken (hrs), Date Range.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:899-911). PDF uses `generateUnplannedBreakdownReport()`.
- Excel: POST `/technical/api/reports/unplanned-breakdown-jobs/excel` with `{ vesselId, startDate?, endDate? }`.

**6. Verification Steps:**
1. Verify date range params sent to server.
2. Check server returns `{ data, metadata }`.
3. Compare manhours/totalHours values with DB records.
4. PDF: verify specialized generator renders correctly.
5. Excel: verify 11 columns match.

**7. Edge Cases:**
- Empty if no unplanned/breakdown WOs in period.
- Default range = current month.
- Server handles all filtering and computation.

**8. Troubleshooting Flow:**
```
1. API → GET endpoint with date params returns 200
2. Date Params → startDate/endDate sent correctly
3. Server Filter → Only unplanned/breakdown type WOs
4. Data Transform → Server formats dates, computes manhours
5. PDF → generateUnplannedBreakdownReport() called
6. Excel → POST body matches; 11 cols in service
```

---

#### Report 1.7: Job Postponement Log

**1. Column Definition (10 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 12 | Sequential idx+1 |
| 2 | WO Number | workOrderNumber | 35 | `wo.workOrderNumber \|\| wo.workOrderNo \|\| wo.id` |
| 3 | Job Title | title | 55 | `wo.title \|\| wo.jobTitle \|\| '-'` |
| 4 | Component | componentName | 45 | `wo.component \|\| wo.componentName \|\| '-'` |
| 5 | Dept | department | 20 | `wo.department \|\| wo.assignedDepartment \|\| '-'` |
| 6 | Original Due | originalDue | 25 | `formatDate(wo.originalDueDate \|\| wo.dueDate)` |
| 7 | New Due | newDue | 25 | `formatDate(wo.newDueDate \|\| wo.postponedToDate \|\| wo.dueDate)` |
| 8 | Days Extended | daysExtended | 22 | Computed (see §3) |
| 9 | Reason | reason | 50 | `wo.postponementReason \|\| wo.remarks \|\| '-'` |
| 10 | Status | status | 22 | Hardcoded `'Postponed'` |

**2. Data Source & Filter Logic:**
- Source: Client-side: `vesselWorkOrders.filter(wo => wo.status === 'Postponed')`. Location: MaintenanceReports.tsx:939

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `daysExtended` | `Math.ceil((newDate - origDate) / 86400000)` — '-' if ≤0 or invalid | MaintenanceReports.tsx:955-965 |

**4. Sort & Summary:** Summary: Total Postponed, Avg Days Extended, Most Common Reason.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:941-952). PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/postponement-log` with `{ vesselId }`. Phase 1: reduced from 19→10 cols.

**6. Verification Steps:**
1. Filter for Postponed WOs → verify count.
2. Calculate daysExtended manually for a sample row.
3. Test invalid dates → should produce '-'.
4. PDF → 10 columns. Excel → 10 columns.

**7. Edge Cases:**
- Both dates missing → daysExtended = '-'
- Result ≤ 0 → daysExtended = '-'
- Status always hardcoded 'Postponed'

**8. Troubleshooting Flow:**
```
1. API → work-orders returns Postponed status WOs
2. Date Fields → originalDueDate/newDueDate populated
3. Day Calc → ceil division produces positive integer
4. Field Map → column fields match data keys
5. PDF → generateReport() with 10 columns
6. Excel → POST body; 10 cols in service (not legacy 19)
```

---

#### Report 1.8: Work Priority Performance

**1. Column Definition (5 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Priority | priority | 40 | Group key: `wo.jobPriority \|\| 'Normal'` |
| 2 | Total WOs | total | 30 | Count per priority group |
| 3 | Completed | completed | 30 | Count where status=Completed per group |
| 4 | On-Time % | onTimePercent | 30 | Computed (see §3) |
| 5 | Overdue | overdue | 30 | Count where dueDate<now AND status≠Completed per group |

**2. Data Source & Filter Logic:**
- Source: Client-side aggregation grouping `vesselWorkOrders` by `wo.jobPriority || 'Normal'`. Location: MaintenanceReports.tsx:1001-1030

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `onTimePercent` | `Math.round((completed / total) * 100)` + '%' | MaintenanceReports.tsx:1028 |
| `overdue` | Count where `dueDate < now AND status !== 'Completed'` per group | MaintenanceReports.tsx:1025 |

**4. Sort & Summary:** Rows = one per unique priority value. No explicit sort.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:1016-1022). PDF uses generic `generateReport()`.
- No Excel export endpoint exists.

**6. Verification Steps:**
1. Group WOs by priority → verify group counts.
2. Verify completed count per group matches status=Completed filter.
3. Calculate onTimePercent manually.
4. Verify overdue = dueDate<now AND not completed.

**7. Edge Cases:**
- Missing jobPriority → defaults to 'Normal' group.
- No Excel export available.
- Division: total=0 → onTimePercent=NaN → `Math.round(NaN)` = NaN → displays 'NaN%' (potential bug).

**8. Troubleshooting Flow:**
```
1. API → work-orders returns data
2. Group Logic → jobPriority || 'Normal' grouping
3. Count Logic → completed/overdue counts per group
4. Rate Calc → round((completed/total)*100)
5. Edge Case → total=0 produces NaN%
6. No Excel → confirm no endpoint exists
```

---

#### Report 1.9: Man-Hours Analysis

**1. Column Definition (5 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | WO Number | workOrderNumber | 40 | `wo.workOrderNumber \|\| wo.workOrderNo` |
| 2 | Title | title | 60 | `wo.title \|\| wo.jobTitle` |
| 3 | Planned Hrs | plannedHours | 30 | Computed (see §3) |
| 4 | Actual Hrs | actualHours | 30 | Computed (see §3) |
| 5 | Variance | variance | 30 | Computed (see §3) |

**2. Data Source & Filter Logic:**
- Source: Client-side: `vesselWorkOrders.filter(wo => wo.status === 'Completed')`. Location: MaintenanceReports.tsx:1042-1050

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `plannedHours` | `wo.plannedHours \|\| wo.estimatedHours \|\| 0` | MaintenanceReports.tsx:1055 |
| `actualHours` | `wo.actualHours \|\| wo.hoursSpent \|\| plannedHours` | MaintenanceReports.tsx:1057 |
| `variance` | `actualHours - plannedHours` | MaintenanceReports.tsx:1061 |

**4. Sort & Summary:** No explicit sort. Summary: Total Planned, Total Actual, Net Variance.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:1043-1049). PDF uses generic `generateReport()`.
- No Excel export endpoint.

**6. Verification Steps:**
1. Filter completed WOs → verify all shown.
2. Verify plannedHours fallback chain.
3. Verify variance = actual - planned (negative = under budget).

**7. Edge Cases:**
- Missing planned → 0; missing actual → equals planned → variance=0.
- No Excel export available.

**8. Troubleshooting Flow:**
```
1. API → work-orders returns Completed WOs
2. Hours Fallback → plannedHours/estimatedHours/0; actualHours/hoursSpent/planned
3. Variance → actual - planned
4. No Excel → confirm no endpoint
```

---

#### Report 1.10: Crew Workload Distribution

**1. Column Definition (10 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Rank | rank | 45 | Group key: `wo.assignedTo \|\| wo.assignee \|\| wo.performedBy \|\| wo.responsibleRank \|\| 'Unassigned'` |
| 2 | Dept | department | 25 | `wo.department \|\| wo.assignedDepartment \|\| '-'` |
| 3 | Total | total | 22 | Count of WOs per assignee |
| 4 | Done | completed | 22 | Count where status=Completed per assignee |
| 5 | Pending | pending | 22 | `total - completed - overdue` |
| 6 | Overdue | overdue | 22 | Count where dueDate<now AND not completed per assignee |
| 7 | Manhours | manhours | 28 | `sum(Number(wo.manhours))` per assignee |
| 8 | Avg Time | avgTime | 25 | `totalTimeTaken / jobsWithTime` per assignee |
| 9 | Rate % | completionPercent | 25 | Computed (see §3) |
| 10 | Load % | workloadPercent | 25 | Computed (see §3) |

**2. Data Source & Filter Logic:**
- Source: Client-side aggregation grouping `vesselWorkOrders` by assignee. Location: MaintenanceReports.tsx:1075-1140

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `manhours` | `sum(Number(wo.manhours))` per assignee | MaintenanceReports.tsx:1120 |
| `avgTime` | `totalTimeTaken / jobsWithTime` per assignee | MaintenanceReports.tsx:1163 |
| `completionPercent` | `Math.round((completed / count) * 100)` + '%' | MaintenanceReports.tsx:1160 |
| `workloadPercent` | `Math.round((assigneeManhours / totalManhours) * 100)` + '%' | MaintenanceReports.tsx:1165 |

**4. Sort & Summary:**
- Sort: `manhours` DESC. Location: MaintenanceReports.tsx:1155
- Summary: Total Crew, Total WOs, Total Manhours, Avg Completion Rate.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (MaintenanceReports.tsx:1141-1152). PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/crew-workload-distribution/excel` with `{ vesselId, startDate?, endDate?, viewType: 'summary' }`.

**6. Verification Steps:**
1. Group WOs by assignee → verify group counts.
2. Verify manhours sum per assignee.
3. Check workloadPercent values sum approximately to 100%.
4. PDF: 10 columns. Excel: 10 columns.

**7. Edge Cases:**
- Missing assignee → 'Unassigned' (multiple field fallbacks: assignedTo→assignee→performedBy→responsibleRank)
- totalManhours = 0 → workloadPercent = '0%' for all
- Sorted by manhours DESC

**8. Troubleshooting Flow:**
```
1. API → work-orders returns data with assignee fields
2. Group Logic → Multiple fallback fields for assignee key
3. Count Logic → completed/overdue/pending per group
4. Manhours Sum → Number(wo.manhours) accumulation
5. Rate Calc → completionPercent, workloadPercent
6. Sort → manhours DESC
7. Excel → POST with viewType: 'summary'; 10 cols in service
```

---

### Category 2: Running Hours

**Source Files:** Frontend: `client/src/pages/reports/RunningHoursReports.tsx` | Excel: `server/modules/reports/services/operationsReportService.ts` (util), `server/modules/reports/services/complianceReportService.ts` (anomaly) | Routes: `server/modules/reports/routes.ts:61-68`

---

#### Report 2.1: Equipment Utilization Summary

**1. Column Definition (10 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 12 | Sequential idx+1 |
| 2 | Code | componentCode | 30 | Server: component.componentCode |
| 3 | Component Name | componentName | 55 | Server: component.componentName |
| 4 | Category | category | 35 | Server: component.category |
| 5 | Current Hrs | currentHours | 25 | Server: latest cumulative RH |
| 6 | Period Hrs | periodHours | 25 | Server: RH accrued during report period |
| 7 | Avg Daily | avgDailyHours | 22 | Server: periodHours / dayCount |
| 8 | Utilization | utilizationBand | 25 | Server: High/Normal/Low based on avgDaily vs expected |
| 9 | Util % | utilizationPercent | 20 | Server: (avgDaily / expectedDaily) × 100 |
| 10 | Data Source | dataSource | 30 | Server: actual/estimated/noData |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/equipment-utilization-summary?vesselId=...&startDate=...&endDate=...`. Location: RunningHoursReports.tsx:186-192
- Returns `{ success, data[], summary }`.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `periodHours` | `latestRH - earliestRH` during period | Server: operationsReportService |
| `avgDailyHours` | `periodHours / dayCount` | Server: operationsReportService |
| `utilizationBand` | `avgDaily > highThreshold → 'High'; avgDaily > lowThreshold → 'Normal'; else → 'Low'` | Server: operationsReportService |
| `utilizationPercent` | `(avgDaily / expectedDailyHours) × 100` | Server: operationsReportService |
| `dataSource` | `'actual'` if from RH logs; `'estimated'` if interpolated; `'noData'` if no entries | Server: operationsReportService |

**4. Sort & Summary:**
- Summary: Total Equipment, High/Normal/Low counts, Avg Utilization%, Actual/Estimated/NoData counts.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (RunningHoursReports.tsx:198-209). PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/equipment-utilization-summary/excel`.

**6. Verification Steps:**
1. Verify server response has `success`, `data`, `summary`.
2. Check High+Normal+Low+NoData = Total Equipment.
3. Verify utilizationPercent is within reasonable range (0-100+).
4. Check data source flags match actual RH log availability.
5. PDF: 10 columns. Excel: 10 columns.

**7. Edge Cases:**
- Requires specific vessel (not 'all').
- Empty if no components with running hours tracking.
- Estimated data is capped at 100% utilization.
- NoData components have zeroed-out fields.

**8. Troubleshooting Flow:**
```
1. API → GET endpoint returns 200 with success:true
2. VesselId → Must be specific vessel
3. Date Range → startDate/endDate passed correctly
4. Server Calc → RH log entries exist for components
5. Band Assign → Thresholds applied correctly
6. Data Quality → actual/estimated/noData flags
7. PDF → generateReport() with 10 columns
8. Excel → POST body; 10 cols in service
```

---

#### Report 2.2: Running Hours Anomaly Detection

**1. Column Definition (11 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 12 | Sequential idx+1 |
| 2 | Component Code | componentCode | 30 | Server: component code |
| 3 | Component Name | componentName | 50 | Server: component name |
| 4 | Prev RH | previousRh | 22 | Server: previous log entry RH value |
| 5 | New RH | newRh | 22 | Server: current log entry RH value |
| 6 | Delta | delta | 20 | Server: newRh - previousRh |
| 7 | Days Between | daysBetween | 25 | Server: days between log entries |
| 8 | Avg Daily | avgDailyHours | 22 | Server: delta / daysBetween |
| 9 | Type | anomalyType | 30 | Server: classification (see §3) |
| 10 | Severity | severity | 22 | Server: critical/warning/info |
| 11 | Description | description | 60 | Server: human-readable explanation |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/running-hours-anomaly-detection?vesselId=...&startDate=...&endDate=...`. Location: RunningHoursReports.tsx:260-268
- Returns `{ success, data[], summary }`.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `delta` | `newRh - previousRh` | Server: complianceReportService |
| `avgDailyHours` | `delta / daysBetween` | Server: complianceReportService |
| `anomalyType` | `high_increment` (excessive delta), `negative_delta` (rollback), `zero_change` (stalled), `irregular_pattern` (deviation), `meter_replaced` (large jump) | Server: complianceReportService |
| `severity` | `critical` (needs immediate attention), `warning` (investigate), `info` (note for awareness) | Server: complianceReportService |

**4. Client Transform:** `previousRh`, `newRh`, `delta` formatted to 1 decimal. `daysBetween` as integer. `avgDailyHours` to 1 decimal. Location: RunningHoursReports.tsx:294-308

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (RunningHoursReports.tsx:271-283). PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/running-hours-anomaly-detection/excel`.

**6. Verification Steps:**
1. Verify anomaly types in response match expected detection rules.
2. Check severity classification: critical/warning/info.
3. Verify delta = newRh - previousRh for a sample row.
4. Check summary counts match data array length.
5. PDF: 11 columns. Excel: 11 columns.

**7. Edge Cases:**
- Empty if no RH log entries for vessel in period.
- Requires ≥2 log entries per component for delta calculation.
- `negative_delta` indicates meter rollback or replacement.
- Very high delta may indicate meter_replaced rather than actual running.

**8. Troubleshooting Flow:**
```
1. API → GET endpoint returns 200 with success:true
2. VesselId → Specific vessel required
3. Date Range → Entries exist within range
4. Log Pairs → ≥2 entries per component needed
5. Delta Calc → newRh - previousRh computed correctly
6. Threshold → Anomaly detection thresholds applied
7. Classify → Type and severity assigned
8. PDF → generateReport() with 11 columns
9. Excel → POST body; 11 cols in service
```

---

### Category 3: Spares

**Source Files:** Frontend: `client/src/pages/reports/SparesReports.tsx` | Excel: `server/modules/reports/services/sparesReportService.ts` | Routes: `server/modules/reports/routes.ts:24-30`

---

#### Report 3.1: Critical Spares Availability

**1. Column Definition (10 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 10 | Sequential idx+1 |
| 2 | Part Code | partCode | 28 | Server: spare.partCode |
| 3 | Part Name | partName | 45 | Server: spare.partName |
| 4 | ROB | rob | 12 | Server: spare.rob (current quantity) |
| 5 | Min Stock | minStock | 15 | Server: spare.minStock |
| 6 | Status | stockStatus | 18 | Server: ZERO/LOW/OK based on rob vs minStock |
| 7 | Shortage | shortageQty | 15 | Server: max(0, minStock - rob) |
| 8 | Criticality | criticalityLevel | 18 | Server: spare.criticalityLevel |
| 9 | Critical Equip | criticalEquip | 20 | Computed client-side (see §3) |
| 10 | Remarks | remarks | 45 | Server: spare.remarks |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/critical-spares/preview?vesselId=...`. Location: SparesReports.tsx:259-261
- Returns `{ data[], summary, reportMeta }`.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `criticalEquip` | `item.linkedToCriticalEquipment ? 'YES' : 'NO'` | SparesReports.tsx:285 |
| `shortageQty` | Server pre-computed: `max(0, minStock - rob)` | Server: sparesReportService |
| `stockStatus` | Server: `rob=0 → 'ZERO'; rob<minStock → 'LOW'; else → 'OK'` | Server: sparesReportService |

**4. Sort & Summary:**
- Summary from server: Total Spares, Critical Equipment Spares, Out of Stock, Low Stock, Total Shortage (units).

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (SparesReports.tsx:263-274). PDF uses generic `generateReport()` landscape.
- Excel: POST `/technical/api/reports/critical-spares` with `{ vesselId }`.

**6. Verification Steps:**
1. Verify server returns data with shortageQty pre-computed.
2. Check criticalEquip flag: YES matches linkedToCriticalEquipment=true.
3. Verify stockStatus: ZERO/LOW/OK matches rob vs minStock.
4. Summary counts match data array statistics.
5. PDF: 10 columns landscape. Excel: 10 columns.

**7. Edge Cases:**
- Empty if no spares data for vessel.
- shortage = max(0, minStock-rob) — never negative.
- linkedToCriticalEquipment may be null/undefined → treated as false → 'NO'.

**8. Troubleshooting Flow:**
```
1. API → GET preview endpoint returns 200
2. VesselId → Passed as query param
3. Server Data → Spares with criticality data exist
4. Shortage Calc → Server: max(0, minStock-rob)
5. Client Map → criticalEquip boolean → YES/NO
6. PDF → generateReport() landscape with 10 cols
7. Excel → POST body; 10 cols in service
```

---

#### Report 3.2: Low Stock Alert (Spares)

**1. Column Definition (8 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 12 | Sequential idx+1 |
| 2 | Part Code | partCode | 30 | Server: spare.partCode |
| 3 | Part Name | partName | 50 | Server: spare.partName |
| 4 | Component | componentName | 45 | Server: associated component name |
| 5 | Current Qty | currentQty | 20 | Server: spare.currentQty |
| 6 | Min Qty | minQty | 18 | Server: spare.minQty |
| 7 | Shortage | shortage | 20 | Server: minQty - currentQty |
| 8 | Status | status | 25 | Server: stock status classification |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/low-stock-alert/:vesselId`. Location: SparesReports.tsx:217-219
- Returns `{ items[], summary }`.

**3. Derived Fields:** All server-computed: shortage = minQty - currentQty.

**4. Sort & Summary:**
- Summary from server: Total Low Stock Items, Critical count, At Minimum count.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (SparesReports.tsx:221-229). PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/low-stock-alert/:vesselId/excel`.

**6. Verification Steps:**
1. Verify shortage = minQty - currentQty for sample rows.
2. Check status classification matches quantity levels.
3. Summary counts match data array.
4. PDF: 8 columns. Excel: 8 columns.

**7. Edge Cases:**
- Empty if all spares above minimum.
- vesselId is path param (not query param).

**8. Troubleshooting Flow:**
```
1. API → GET with vesselId path param returns 200
2. Server Filter → Only items below minimum
3. Shortage Calc → minQty - currentQty
4. PDF → generateReport() with 8 cols
5. Excel → POST to /excel endpoint; 8 cols
```

---

#### Report 3.3: Consumption Pattern Analysis (Spares)

**1. Column Definition (10 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 12 | Sequential idx+1 |
| 2 | Part Code | partCode | 28 | Server: spare.partCode |
| 3 | Part Name | partName | 45 | Server: spare.partName |
| 4 | Component | componentName | 40 | Server: associated component |
| 5 | Total Consumed | totalConsumed | 25 | Server: sum of consumption history |
| 6 | Consumption Events | consumptionEvents | 28 | Server: count of consumption records |
| 7 | Current ROB | currentRob | 22 | Server: current remaining on board |
| 8 | Min Stock | minStock | 18 | Server: minimum stock level |
| 9 | Status | status | 18 | Server: stock status based on rob vs min |
| 10 | Last Consumed | lastConsumed | 25 | Client-formatted DD-MMM-YYYY |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/consumption-analysis/:vesselId`. Location: SparesReports.tsx:306-308
- **Route mapping:** `routes.ts:36` → `storesCtrl.getCombinedConsumptionAnalysis` (NOT sparesCtrl — this is a combined endpoint served by the stores controller)
- Returns `{ items[], summary }`.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `lastConsumed` | Client-side DD-MMM-YYYY formatting via custom UTC formatter | SparesReports.tsx:310-317 |
| `totalConsumed` | Server (storesReportService/combined): sum of all consumption history entries | Server: storesReportService (combined endpoint) |
| `consumptionEvents` | Server (storesReportService/combined): count of consumption records | Server: storesReportService (combined endpoint) |

**4. Sort & Summary:**
- Summary from server: Total Items, Total Consumed, Total Events, Critical Items.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (SparesReports.tsx:319-330). PDF uses generic `generateReport()` landscape.
- Excel: POST `/technical/api/reports/consumption-analysis/:vesselId/excel` → `storesCtrl.exportCombinedConsumptionExcel` (routes.ts:37).

**6. Verification Steps:**
1. Verify totalConsumed matches sum of consumption history.
2. Check consumptionEvents = count of records.
3. Verify lastConsumed date format DD-MMM-YYYY (UTC-based).
4. Summary totals match data array statistics.
5. PDF: 10 columns landscape. Excel: 10 columns.
6. Confirm endpoint routes to storesCtrl, NOT sparesCtrl.

**7. Edge Cases:**
- lastConsumed date formatted client-side — uses UTC methods (getUTCDate, getUTCMonth), not local time.
- Endpoint is `/consumption-analysis/` (combined), not `/spares-consumption-analysis/` (which is a separate spares-specific endpoint at routes.ts:29-30).

**8. Troubleshooting Flow:**
```
1. API → GET /consumption-analysis/:vesselId (combined endpoint)
2. Route → storesCtrl.getCombinedConsumptionAnalysis (NOT sparesCtrl)
3. Server Data → Consumption history exists for spares
4. Date Format → Client DD-MMM-YYYY formatter uses UTC
5. PDF → generateReport() landscape, 10 cols
6. Excel → POST /consumption-analysis/:vesselId/excel → storesCtrl.exportCombinedConsumptionExcel
```

---

### Category 4: Stores

**Source Files:** Frontend: `client/src/pages/reports/StoresReports.tsx` | Excel: `server/modules/reports/services/storesReportService.ts` | Routes: `server/modules/reports/routes.ts:33-40` | PDF: `client/src/lib/pdfReportGenerator.ts` (generic + specialized `generateConsumptionAnalysisPDF`)

---

#### Report 4.1: Stores Inventory Status

**1. Column Definition (8 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Item Code | itemCode | 30 | `s.itemCode \|\| '-'` |
| 2 | Item Name | itemName | 55 | `s.itemName \|\| '-'` |
| 3 | Category | category | 30 | `s.category \|\| s.itemType \|\| '-'` |
| 4 | ROB | rob | 20 | `parseFloat(String(s.rob)) \|\| 0` |
| 5 | Min | min | 20 | `parseFloat(String(s.min)) \|\| 0` |
| 6 | Location A | locationA | 25 | `s.locationA \|\| '-'` |
| 7 | Location B | locationB | 25 | `s.locationB \|\| '-'` |
| 8 | Status | status | 25 | Computed (see §3) |

**2. Data Source & Filter Logic:**
- Source: Client-side useQuery `/technical/api/stores` (or `/technical/api/stores/:vesselId`). Location: StoresReports.tsx:118-130

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `rob` | `parseFloat(String(s.rob)) \|\| 0` — handles string/number, NaN→0 | StoresReports.tsx:239 |
| `min` | `parseFloat(String(s.min)) \|\| 0` | StoresReports.tsx:240 |
| `status` | `rob === 0 → 'Critical'; rob <= min → 'Low'; else → 'OK'` | StoresReports.tsx:216-220 |

**4. Sort & Summary:**
- Summary: Total Items, Low Stock count, OK count. Location: StoresReports.tsx:253-257

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (StoresReports.tsx:227-236). PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/stores-inventory-status/:vesselId/excel`.

**6. Verification Steps:**
1. Verify status logic: rob=0→Critical, rob≤min→Low, else→OK.
2. Check parseFloat handles string values correctly.
3. Summary counts match filtered data.
4. PDF: 8 columns. Excel: 8 columns.

**7. Edge Cases:**
- `parseFloat(String(val))` handles both string and number inputs; NaN→0.
- 'all' vessel returns all stores across vessels.

**8. Troubleshooting Flow:**
```
1. API → /technical/api/stores returns data
2. Vessel Filter → effectiveVesselId correct
3. Rob Parse → parseFloat(String(val)) handles type
4. Status Calc → threshold logic correct
5. PDF → generateReport() 8 cols
6. Excel → POST with vesselId path; 8 cols in service
```

---

#### Report 4.2: Lubricants & Oil Analysis

**1. Column Definition (6 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Item Code | itemCode | 30 | `s.itemCode \|\| '-'` |
| 2 | Item Name | itemName | 60 | `s.itemName \|\| '-'` |
| 3 | ROB | rob | 25 | `parseFloat(String(s.rob)) \|\| 0` |
| 4 | Min | min | 25 | `parseFloat(String(s.min)) \|\| 0` |
| 5 | UOM | uom | 25 | `s.uom \|\| 'L'` |
| 6 | Status | status | 30 | Same stock status as 4.1 |

**2. Data Source & Filter Logic:**
- Source: Client-side filter: `storesItems.filter(s => s.itemType === 'lubes')`. Location: StoresReports.tsx:271

**3. Derived Fields:** Same as 4.1 plus UOM defaults to 'L'. Location: StoresReports.tsx:290

**4. Sort & Summary:** Total Lubes, Low Stock count. Location: StoresReports.tsx:295-298

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (StoresReports.tsx:273-280). PDF uses generic `generateReport()`.
- No Excel export endpoint.

**6. Verification Steps:**
1. Verify only lubes items appear (itemType='lubes').
2. Check UOM defaults to 'L'.
3. Status calc same as 4.1.

**7. Edge Cases:**
- Empty if no items with itemType='lubes'.
- No Excel export available.

**8. Troubleshooting Flow:**
```
1. API → stores data loads
2. Type Filter → itemType === 'lubes'
3. Status Calc → same as 4.1
4. UOM Default → 'L' if missing
5. PDF → generateReport() 6 cols
6. No Excel → endpoint does not exist
```

---

#### Report 4.3: Chemicals Inventory & Expiry

**1. Column Definition (9 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | Item Code | itemCode | 25 | `s.itemCode \|\| '-'` |
| 2 | Item Name | itemName | 45 | `s.itemName \|\| '-'` |
| 3 | Batch # | batchNumber | 25 | `s.batchNumber \|\| '-'` |
| 4 | Expiry Date | expiryDate | 25 | Formatted with status suffix (see §3) |
| 5 | Hazard | hazardClassification | 25 | `s.hazardClassification \|\| 'None'` |
| 6 | SDS Ref | sdsReference | 25 | `s.sdsReference \|\| '-'` |
| 7 | ROB | rob | 20 | `parseFloat(String(s.rob)) \|\| 0` |
| 8 | Min | min | 20 | `parseFloat(String(s.min)) \|\| 0` |
| 9 | Status | status | 25 | Same stock status as 4.1 |

**2. Data Source & Filter Logic:**
- Source: Client-side filter: `storesItems.filter(s => s.itemType === 'chemicals')`. Location: StoresReports.tsx:312

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| Expiry days | `Math.floor((new Date(expiryDate).getTime() - today.getTime()) / (1000*60*60*24))` | StoresReports.tsx:334 |
| Expiry status | `days < 0 → 'EXPIRED'; days ≤ 30 → '{days}d'; days ≤ 90 → '{days}d'; else → 'OK'` | StoresReports.tsx:335 |
| Formatted expiry | `'{expiryDate} ({expiryStatus})'` or `'-'` if no expiry date | StoresReports.tsx:341 |
| SDS compliance | `Math.round((withSds / total) * 100)` — % items with non-empty sdsReference | StoresReports.tsx:354-355 |
| `expiredCount` | `chemicalsItems.filter(s => new Date(s.expiryDate) < today).length` | StoresReports.tsx:350-353 |

**4. Sort & Summary:**
- Summary: Total Chemicals, Expired count, Low Stock count, SDS Compliance %. Location: StoresReports.tsx:356-361

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (StoresReports.tsx:314-324). PDF uses generic `generateReport()`.
- No Excel export endpoint.

**6. Verification Steps:**
1. Verify EXPIRED status for past expiry dates.
2. Check SDS compliance percentage calculation.
3. Verify filter is itemType='chemicals'.
4. Verify expiry date formatting includes status suffix.

**7. Edge Cases:**
- Timezone: uses `new Date()` (browser local time); items near midnight may show off-by-one for expiry.
- No expiry date → expiryDate column shows '-'.
- No Excel export available.
- SDS compliance: 0 chemicals → '0%' (guarded by `data.length > 0`).

**8. Troubleshooting Flow:**
```
1. API → stores data loads
2. Type Filter → itemType === 'chemicals'
3. Expiry Calc → Date subtraction, floor division
4. Status → days threshold classification
5. SDS Count → non-empty sdsReference check
6. PDF → generateReport() 9 cols
7. No Excel → endpoint does not exist
```

---

#### Report 4.4: Stores Low Stock Alert

**1. Column Definition (13 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 12 | Sequential idx+1 |
| 2 | Priority | priority | 18 | Server: computed priority level |
| 3 | Item Code | itemCode | 22 | Server: item.itemCode |
| 4 | Item Name | itemName | 40 | Server: item.itemName |
| 5 | Type | itemType | 20 | Server: item.itemType |
| 6 | Category | category | 22 | Server: item.category |
| 7 | ROB | rob | 15 | Server: current stock |
| 8 | Min Stock | minStock | 15 | Server: minimum level |
| 9 | Deficit | deficit | 15 | Server: max(0, minStock - rob) |
| 10 | UOM | uom | 15 | Server: unit of measure |
| 11 | Avg Monthly | avgMonthly | 20 | Server: avg monthly consumption |
| 12 | Days to Stockout | daysToStockout | 22 | Server: (rob/avgMonthly)×30 |
| 13 | Est. Cost | estCost | 20 | Server: estimated reorder cost |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/stores-low-stock-alert/:vesselId`. Location: StoresReports.tsx:375-379
- Returns `{ items[], summary }`.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `deficit` | `max(0, minStock - rob)` | Server: storesReportService |
| `daysToStockout` | `(rob / avgMonthlyConsumption) * 30` — only if avgMonthly > 0 | Server: storesReportService |
| `priority` | Based on deficit severity and criticality | Server: storesReportService |

**4. Sort & Summary:**
- Summary from server: Total items, by priority, total deficit, total estimated cost.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (StoresReports.tsx:383-397). PDF uses generic `generateReport()` landscape.
- Excel: POST `/technical/api/reports/stores-low-stock-alert/:vesselId/excel`.
- 13 columns — widest stores report.

**6. Verification Steps:**
1. Verify deficit = max(0, minStock-rob) for sample rows.
2. Check daysToStockout for division-by-zero (avgMonthly=0).
3. Verify priority assignment logic.
4. PDF: 13 columns landscape. Excel: 13 columns.

**7. Edge Cases:**
- `daysToStockout` undefined/Infinity if avgMonthlyConsumption=0 (division by zero).
- Widest stores report at 13 columns.
- vesselId is path param.

**8. Troubleshooting Flow:**
```
1. API → GET with vesselId path param returns 200
2. Server Filter → Items below minimum stock
3. Deficit Calc → max(0, minStock-rob)
4. Stockout Calc → div-by-zero guard on avgMonthly
5. Priority → Server assigns based on severity
6. PDF → generateReport() landscape, 13 cols
7. Excel → POST to /excel; 13 cols in service
```

---

#### Report 4.5: Stores Consumption Pattern Analysis

**1. Column Definition (7 columns — view/preview):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 12 | Sequential idx+1 |
| 2 | Item Code | itemCode | 25 | Server: item.itemCode |
| 3 | Item Name | itemName | 45 | Server: item.itemName |
| 4 | Category | category | 25 | Server: item.category |
| 5 | Total Consumed | totalConsumed | 25 | Server: sum of consumption history |
| 6 | Events | events | 15 | Server: consumptionEvents or events count |
| 7 | Current ROB | rob | 20 | Server: currentRob or rob |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/stores-consumption-analysis/:vesselId` → `storesCtrl.getStoresConsumptionAnalysis` (routes.ts:34). Location: StoresReports.tsx:434-437
- Returns `{ summary, consumptionTrends[], topConsumedItems[], categoryBreakdown[], stockEfficiency[], forecastData[], nonMovingItems[] }`.
- View uses `topConsumedItems` array for table rows.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `events` | `i.consumptionEvents \|\| i.events \|\| 0` | StoresReports.tsx:456 |
| `rob` | `i.currentRob \|\| i.rob \|\| 0` | StoresReports.tsx:457 |
| `confidence` | `daysOfData > 90 → 'High'; daysOfData >= 30 → 'Medium'; else → 'Low'` | StoresReports.tsx:469-470 |
| `daysOfData` | `freshData.summary?.dataQuality?.daysOfData \|\| 0` | StoresReports.tsx:469 |

**4. Sort & Summary:**
- View summary: Total Items Analyzed, Total Consumption, Categories count. Location: StoresReports.tsx:460-464

**5. View/PDF/Excel Parity:**
- **View** uses 7-column table of `topConsumedItems` (StoresReports.tsx:441-448).
- **PDF** uses specialized `generateConsumptionAnalysisPDF()` — a multi-section dashboard report (NOT generic table). Includes: summary, consumption trends, top consumed items, category breakdown, stock efficiency, forecast data, and non-moving items. Location: StoresReports.tsx:471-489
- **Excel**: POST `/technical/api/reports/stores-consumption-analysis/:vesselId/excel` → `storesCtrl.exportStoresConsumptionExcel` (routes.ts:35). Location: StoresReports.tsx:564-577
  - Multi-sheet workbook: Stock Status, Monthly Trends, Stock Efficiency, Forecast & Reorder Projections
  - Forecast sheet includes: reorder point, confidence multiplier-adjusted rates, suggested reorder quantities
  - Uses confidence multiplier system: `daysOfData < 7 → ×0.5; < 30 → ×0.75; else → ×1.0`
- PDF format differs significantly from view — it's a comprehensive analysis dashboard, not a simple table.

**6. Verification Steps:**
1. Verify server returns full data structure (summary, topConsumedItems, etc.).
2. View: verify 7-column table shows topConsumedItems data.
3. Verify confidence level: >90 days=High, ≥30=Medium, <30=Low.
4. PDF: verify multi-section layout (not generic table).
5. Excel: verify POST to stores-consumption-analysis endpoint.
6. Check summary values match data array statistics.

**7. Edge Cases:**
- PDF uses `generateConsumptionAnalysisPDF()` — specialized generator, NOT `generateReport()`.
- View only shows topConsumedItems subset; PDF shows comprehensive analysis.
- daysOfData=0 if no consumption history → confidence='Low'.
- Empty if no stores consumption data for vessel.

**8. Troubleshooting Flow:**
```
1. API → GET /stores-consumption-analysis/:vesselId returns 200
2. Route → storesCtrl.getStoresConsumptionAnalysis (routes.ts:34)
3. Data Structure → Response has summary/topConsumedItems/categoryBreakdown/etc.
4. View → 7-col table from topConsumedItems
5. PDF → generateConsumptionAnalysisPDF() (specialized, NOT generateReport)
6. Excel → POST /stores-consumption-analysis/:vesselId/excel → storesCtrl.exportStoresConsumptionExcel
7. Confidence → daysOfData threshold check
```

---

### Category 5: Compliance (IHM)

**Source Files:** Frontend: `client/src/pages/reports/IhmReports.tsx` | Excel: `server/modules/reports/services/complianceReportService.ts`

---

#### Report 5.1: IHM Inventory Status

**1. Column Definition (10 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sNo | 8 | Server-assigned sequential |
| 2 | Item Code | itemCode | 18 | Server: ihm.itemCode |
| 3 | Item Name | itemName | 38 | Server: ihm.itemName |
| 4 | Item Type | itemType | 14 | Server: ihm.itemType |
| 5 | Component/Category | category | 20 | Server: ihm.category or component |
| 6 | IHM Status | ihmStatus | 16 | Server: status classification |
| 7 | Evidence Type | evidenceType | 16 | Server: evidence classification |
| 8 | Current ROB | currentRob | 14 | Server: current quantity |
| 9 | Location | location | 16 | Server: storage location |
| 10 | UOM | uom | 10 | Server: unit of measure |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/ihm-inventory-status?vesselId=...`
- Returns pre-formatted data with status mapping.

**3. Derived Fields:** All server-computed (status, evidence type).

**4. Sort & Summary:** Server-provided order and summary.

**5. View/PDF/Excel Parity:**
- View/PDF share columns. PDF uses generic `generateReport()`.
- Excel: POST `/technical/api/reports/ihm-inventory-status/excel`.

**6. Verification Steps:**
1. Verify server returns correct IHM status values.
2. Check evidence type classifications.
3. PDF: 10 columns. Excel: 10 columns.

**7. Edge Cases:**
- Empty if no IHM items configured for vessel.
- All computation server-side.

**8. Troubleshooting Flow:**
```
1. API → GET returns 200 with data
2. VesselId → Passed as query param
3. Server Data → IHM items exist for vessel
4. Status Map → Server classifies correctly
5. PDF → generateReport() 10 cols
6. Excel → POST body; 10 cols in service
```

---

### Category 6: Change Requests

**Source Files:** Frontend: `client/src/pages/reports/ChangeRequestReports.tsx` | Excel: `server/modules/reports/services/changeRequestReportService.ts`

---

#### Report 6.1: Change Requests Status & Tracking

**1. Column Definition (13 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | ID | id | 10 | Server: cr.id |
| 2 | Title | title | 40 | Truncated: `title.length > 50 ? title.substring(0,47)+'...' : title` |
| 3 | Category | category | 18 | Category label mapping (see §3) |
| 4 | Status | status | 16 | Status label mapping (see §3) |
| 5 | Requested By | requestedBy | 20 | Server: cr.requestedBy |
| 6 | Vessel | vessel | 18 | Server: vessel name |
| 7 | Submitted | submittedAt | 18 | Server: formatted date |
| 8 | Reviewed By | reviewedBy | 20 | Server: cr.reviewedBy |
| 9 | Reviewed At | reviewedAt | 18 | Server: formatted date |
| 10 | Cycle Time (hrs) | cycleTime | 16 | Server: reviewedAt - submittedAt in hours |
| 11 | Target | target | 28 | `'{CategoryLabel} - {targetInfo.name}'` |
| 12 | Changes | changesCount | 12 | Server: count of change items |
| 13 | Reason | reason | 30 | Server: cr.reason |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/change-requests-status-tracking?vesselId=...&status=...&category=...&startDate=...&endDate=...`. Location: ChangeRequestReports.tsx:236-250
- Returns array of change request records.

**3. Derived Fields & Formulas:**

| Field | Formula | Location |
|-------|---------|----------|
| `cycleTime` | Server-computed: `(reviewedAt - submittedAt)` in hours | Server: changeRequestReportService |
| `approvalRate` | `Math.round((approved / totalRequests) * 100)` | ChangeRequestReports.tsx:270 |
| `rejectedPct` | `Math.round((rejected / totalRequests) * 100)` | ChangeRequestReports.tsx:271 |
| `title` | `title.length > 50 ? title.substring(0,47) + '...' : title` | ChangeRequestReports.tsx:255 |
| `target` | `'{CategoryLabel} - {targetInfo.name}'` | ChangeRequestReports.tsx:264 |
| Category labels | `components→'Components', work_orders→'Work Orders', spares→'Spares', stores→'Stores'` | ChangeRequestReports.tsx:107-112 |
| Status labels | `draft→'Draft', submitted→'Submitted', returned→'Returned', approved→'Approved', rejected→'Rejected'` | ChangeRequestReports.tsx:114-120 |

**4. Sort & Summary:**
- Summary: Total Requests, Approved (with %), Rejected (with %), Pending Review, Avg Approval Time (hrs), Breakdown by category.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (ChangeRequestReports.tsx:237-251). PDF uses generic `generateReport()` landscape.
- Excel: **GET** (not POST) `/technical/api/reports/change-requests-status-tracking/export?vesselId=...&status=...&category=...`. Location: ChangeRequestReports.tsx:378-398
- This is the only report using GET for Excel export.

**6. Verification Steps:**
1. Verify cycleTime = manual calculation of (reviewedAt - submittedAt) in hours.
2. Check approval/rejection percentages sum correctly.
3. Verify title truncation at 50 chars.
4. Check category labels map correctly.
5. Excel: verify uses GET method (not POST).
6. PDF: 13 columns. Excel: 13 columns.

**7. Edge Cases:**
- `cycleTimeHours` null if CR not yet reviewed (no reviewedAt).
- Title >50 chars → truncated with '...'.
- Excel uses GET with query params (exception vs other POST endpoints).
- Empty if no CRs match filters.

**8. Troubleshooting Flow:**
```
1. API → GET status-tracking endpoint returns 200
2. Filters → vesselId/status/category/dateRange applied
3. Server Data → Change requests exist
4. CycleTime → reviewedAt - submittedAt (null if unreviewed)
5. Client Map → title truncation, category/status labels
6. Summary → approval/rejection rate calculations
7. PDF → generateReport() landscape, 13 cols
8. Excel → GET /export endpoint (NOT POST); query params
```

---

### Category 7: LSA/FFA

**Source Files:** Frontend: `client/src/pages/reports/LsaFfaReports.tsx` | Backend: `server/modules/reports/controllers/equipmentReportsController.ts` | Excel: `server/modules/reports/services/equipmentReportService.ts`

---

#### Report 7.1: LSA/FFA Equipment Master List

**1. Column Definition (12 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 8 | Sequential idx+1 |
| 2 | Component Code | componentCode | 22 | Server: component.componentCode |
| 3 | Component Name | componentName | 40 | Server: component.componentName |
| 4 | Equipment Type | equipmentType | 16 | Server: LSA or FFA |
| 5 | Location | location | 20 | Server: component.location |
| 6 | Maker | maker | 20 | Server: component.maker |
| 7 | Model | model | 20 | Server: component.model |
| 8 | Serial No | serialNo | 18 | Server: component.serialNo |
| 9 | Installation Date | installationDate | 16 | Server: formatted date |
| 10 | Criticality | critical | 12 | Server: criticality flag |
| 11 | Class Item | classItem | 12 | Server: class item flag |
| 12 | Active | isActive | 10 | Server: active status |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/lsa-ffa-master-list?vesselId=...&equipmentType=...`. Location: LsaFfaReports.tsx:183-189
- Equipment type filter: 'LSA', 'FFA', or omitted for all.

**3. Derived Fields:** All server-computed. Client receives pre-formatted data.

**4. Sort & Summary:**
- Summary: Total LSA, Total FFA, Total Combined, Active count.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (LsaFfaReports.tsx:178-191). PDF uses generic `generateReport()` landscape.
- Excel: **GET** (same endpoint) with `?format=excel` query param. Location: LsaFfaReports.tsx:344-346
- This is an exception — same endpoint returns JSON or Excel based on `format` param.

**6. Verification Steps:**
1. Verify component count matches summary.
2. Check equipmentType filter (LSA/FFA/all).
3. Verify active status flag.
4. Excel: test with `?format=excel` param on same endpoint.
5. PDF: 12 columns landscape. Excel: 12 columns.

**7. Edge Cases:**
- Empty if no LSA/FFA components for vessel.
- Excel uses GET with `?format=excel` query param (exception vs POST).
- Server decides JSON vs Excel response format based on `format` param.

**8. Troubleshooting Flow:**
```
1. API → GET master-list endpoint returns 200
2. VesselId → Passed as query param
3. EquipType → Optional filter LSA/FFA
4. Server Data → LSA/FFA components exist
5. Format → JSON (view/PDF) vs Excel (format=excel)
6. PDF → generateReport() landscape, 12 cols
7. Excel → Same GET endpoint with ?format=excel; 12 cols
```

---

#### Report 7.2: LSA/FFA Maintenance Schedule & Status

**1. Column Definition (16 columns):**

| # | Header | Field | Width | Source Field(s) |
|---|--------|-------|-------|-----------------|
| 1 | S.No | sno | 6 | Sequential idx+1 |
| 2 | Comp Code | componentCode | 16 | Server: component.componentCode |
| 3 | Component Name | componentName | 28 | Server: component.componentName |
| 4 | Type | equipmentType | 8 | Server: LSA or FFA |
| 5 | Location | location | 16 | Server: component.location |
| 6 | Job Code | jobCode | 14 | Server: wo.jobCode |
| 7 | Job Title | jobTitle | 30 | Server: wo.jobTitle |
| 8 | Task Type | taskType | 14 | Server: wo.taskType |
| 9 | Basis | maintenanceBasis | 12 | Server: calendar/RH/condition |
| 10 | Frequency | frequency | 12 | Server: wo.frequency |
| 11 | Next Due | nextDueDate | 14 | Server: formatted date |
| 12 | Days | daysUntilDue | 8 | Server: days until next due |
| 13 | Status | status | 12 | Server: overdue/due-soon/on-schedule |
| 14 | Last Done | lastDoneDate | 14 | Server: formatted date |
| 15 | Last WO | lastWONumber | 16 | Server: last completed WO number |
| 16 | Assigned To | assignedTo | 14 | Server: wo.assignedTo |

**2. Data Source & Filter Logic:**
- Source: Server GET `/technical/api/reports/lsa-ffa-maintenance-schedule?vesselId=...&equipmentType=...&status=...`. Location: LsaFfaReports.tsx:256-264
- Status filter options: 'overdue', 'due-soon', 'on-schedule', or omitted for all.

**3. Derived Fields:** All server-computed (daysUntilDue, status, schedule data).

**4. Sort & Summary:**
- Summary: Total Items, On Schedule, Due Soon, Overdue.

**5. View/PDF/Excel Parity:**
- View/PDF share `columns` (LsaFfaReports.tsx:249-266). PDF uses generic `generateReport()` landscape.
- Excel: **GET** (same endpoint) with `?format=excel` query param. Location: LsaFfaReports.tsx:347-349
- Same exception pattern as 7.1.
- 16 columns — widest single report in the entire module.

**6. Verification Steps:**
1. Verify schedule items match component+WO join.
2. Test status filter (overdue/due-soon/on-schedule).
3. Check on-schedule/overdue/due-soon counts in summary.
4. Excel: test with `?format=excel` on same endpoint.
5. PDF: 16 columns landscape. Excel: 16 columns.

**7. Edge Cases:**
- 16 columns is the widest report — landscape mode required.
- Status filter applied server-side.
- Excel uses GET with `?format=excel` query param (exception).

**8. Troubleshooting Flow:**
```
1. API → GET maintenance-schedule endpoint returns 200
2. VesselId → Required
3. EquipType → Optional filter LSA/FFA
4. Status Filter → Server-side: overdue/due-soon/on-schedule
5. Server Data → Components with WOs exist
6. Format → JSON (view/PDF) vs Excel (format=excel)
7. PDF → generateReport() landscape, 16 cols
8. Excel → Same GET with ?format=excel; 16 cols
```

---

## Section C: Formula & Logic Index (with Implementation Locations)

### Date / Time Formulas

| Formula Name | Expression | Implementation File:Line | Used In | Input Fields | Output | Notes |
|-------------|------------|-------------------------|---------|-------------|--------|-------|
| Days Remaining | `Math.ceil((dueDate - now) / 86400000)` | MaintenanceReports.tsx:335-337 | 1.1 | `wo.dueDate` | Integer (negative=overdue) | ceil rounds up |
| Days Overdue | `Math.floor((now - dueDate) / 86400000)` | MaintenanceReports.tsx:451 | 1.2 | `wo.dueDate` | Integer ≥0 | floor rounds down |
| RH Overdue | `Math.max(0, currentCumulativeRH - nextDueReading)` | MaintenanceReports.tsx:452-454 | 1.2 | `wo.currentCumulativeRH`, `wo.nextDueReading` | Float ≥0 | Clamped |
| Days Extended | `Math.ceil((newDueDate - originalDueDate) / 86400000)` | MaintenanceReports.tsx:955-965 | 1.7 | `wo.originalDueDate`, `wo.newDueDate` | Integer or '-' | ≤0→'-' |
| Duration (hrs) | `parseFloat(totalTimeHours) \|\| ((end-start)/3600000)` | MaintenanceReports.tsx:559-569, 607 | 1.3, 1.4, 1.10 | `wo.totalTimeHours`, `wo.startDateTime`, `wo.completionDateTime` | Float hours | Fallback chain |
| Expiry Days | `Math.floor((expiryDate - today) / 86400000)` | StoresReports.tsx:334 | 4.3 | `s.expiryDate` | Integer | Negative=expired |
| Cycle Time | `reviewedAt - submittedAt` (hours) | Server: changeRequestReportService | 6.1 | `cr.reviewedAt`, `cr.submittedAt` | Float hours or null | Null if unreviewed |
| Date Format (shared) | DD-MMM-YYYY via `formatDate()` | pdfReportGenerator.ts (exported) | All reports | ISO date string | 'DD-MMM-YYYY' string | Common utility |
| Date Format (custom) | DD-MMM-YYYY via manual month lookup | MaintenanceReports.tsx:529-542 | 1.3 | ISO date string | 'DD-MMM-YYYY' string | Uses UTC methods |
| DD-MMM-YYYY Parse | Regex `^(\d{1,2})-([A-Za-z]{3})-(\d{4})$` | MaintenanceReports.tsx:678-693 | 1.4 | String date | Date object | Parses back to Date |
| Consumption Date | DD-MMM-YYYY via UTC month lookup | SparesReports.tsx:310-317 | 3.3 | ISO date string | 'DD-MMM-YYYY' | UTC-based |

### Threshold / Status Formulas

| Formula Name | Expression | Implementation File:Line | Used In | Thresholds | Notes |
|-------------|------------|-------------------------|---------|-----------|-------|
| Due Jobs Status | `days < 0 → OVERDUE; ≤ 2 → URGENT; ≤ 7 → DUE; else ACTIVE` | MaintenanceReports.tsx:327-333 | 1.1 | 0, 2, 7 | Four-tier classification |
| Overdue Grace (Calendar) | `dueDate < (now - 7 days)` | MaintenanceReports.tsx:396-410 | 1.2 | 7 days | WOs 1-7d overdue excluded |
| Overdue Grace (RH) | `(currentRH - nextDueRH) > 168` | MaintenanceReports.tsx:413-416 | 1.2 | 168 hours | RH excess threshold |
| Overdue Type | `calOverdue AND rhOverdue → 'Both'; only rh → 'RH'; else → 'Calendar'` | MaintenanceReports.tsx:422-428 | 1.2 | — | Three-way classification |
| Critical Equipment | `criticality in ('Yes','Critical') \|\| critical === true → 'YES'` | MaintenanceReports.tsx:455 | 1.2 | — | Boolean flag |
| Stock Status (Stores) | `rob === 0 → 'Critical'; rob ≤ min → 'Low'; else → 'OK'` | StoresReports.tsx:216-220 | 4.1, 4.2, 4.3 | 0, min | Three-tier |
| Stock Status (Spares) | `rob = 0 → 'ZERO'; rob < minStock → 'LOW'; else → 'OK'` | Server: sparesReportService | 3.1 | 0, minStock | Server-side |
| Shortage (Spares) | `max(0, minQty - currentQty)` | Server: sparesReportService | 3.1, 3.2 | — | Never negative |
| Shortage (Stores) | `max(0, minStock - rob)` | Server: storesReportService | 4.4 | — | Never negative |
| Days to Stockout | `(rob / avgMonthlyConsumption) * 30` | Server: storesReportService | 4.4 | — | Undefined if avgMonthly=0 |
| Expiry Status | `days < 0 → EXPIRED; ≤ 30 → '{d}d'; ≤ 90 → '{d}d'; else → OK` | StoresReports.tsx:335 | 4.3 | 0, 30, 90 | Four-tier |
| Utilization Band | `avgDaily > highThreshold → High; > lowThreshold → Normal; else → Low` | Server: operationsReportService | 2.1 | Configurable | Server thresholds |
| Anomaly Severity | `critical/warning/info` | Server: complianceReportService | 2.2 | Configurable | Server classification |
| Anomaly Type | `high_increment/negative_delta/zero_change/irregular_pattern/meter_replaced` | Server: complianceReportService | 2.2 | — | Five types |

### Aggregation / Rate Formulas

| Formula Name | Expression | Implementation File:Line | Used In | Input Fields | Notes |
|-------------|------------|-------------------------|---------|-------------|-------|
| Man-Hours | `parseFloat(wo.manhours) \|\| (duration × noOfPersons)` | MaintenanceReports.tsx:609 | 1.3, 1.4, 1.10 | manhours, totalTimeHours, startDateTime, completionDateTime, noOfPersons | Fallback chain |
| Total Man-Hours Sum | `accumulator += manHours` per row | MaintenanceReports.tsx:610 | 1.3, 1.4 | Per-row manHours | Running sum |
| Completion Rate | `Math.round((completed / total) * 100)` | MaintenanceReports.tsx:732 | 1.4, 1.8, 1.10 | Completed count, total count | Returns 0 if total=0 (1.4); may NaN if total=0 (1.8) |
| On-Time % | `Math.round((completed / total) * 100) + '%'` | MaintenanceReports.tsx:1028 | 1.8 | Per-group completed/total | String with % suffix |
| Workload % | `Math.round((assigneeMH / totalMH) * 100) + '%'` | MaintenanceReports.tsx:1165 | 1.10 | Per-assignee MH, total MH | '0%' if totalMH=0 |
| Completion % (Workload) | `Math.round((completed / count) * 100) + '%'` | MaintenanceReports.tsx:1160 | 1.10 | Per-assignee completed/count | String with % suffix |
| Avg Time | `totalTimeTaken / jobsWithTime` | MaintenanceReports.tsx:1163 | 1.10 | Per-assignee time data | Only WOs with time tracking |
| Variance | `actualHours - plannedHours` | MaintenanceReports.tsx:1061 | 1.9 | Planned, actual hours | Negative = under budget |
| Approval Rate | `Math.round((approved / totalRequests) * 100)` | ChangeRequestReports.tsx:270 | 6.1 | Approved count, total | Percentage |
| Rejection Rate | `Math.round((rejected / totalRequests) * 100)` | ChangeRequestReports.tsx:271 | 6.1 | Rejected count, total | Percentage |
| SDS Compliance | `Math.round((withSds / totalChemicals) * 100)` | StoresReports.tsx:354-355 | 4.3 | Items with sdsReference, total | Guarded by total>0 |
| Consumption Sum (Spares) | `sum(consumption history records)` | Server: storesReportService (combined endpoint) | 3.3 | Consumption records | Server-side via getCombinedConsumptionAnalysis |
| Consumption Sum (Stores) | `sum(consumption history records)` | Server: storesReportService | 4.5 | Consumption records | Server-side via getStoresConsumptionAnalysis |
| Data Confidence | `daysOfData > 90 → 'High'; >= 30 → 'Medium'; else → 'Low'` | StoresReports.tsx:469-470 | 4.5 | summary.dataQuality.daysOfData | Client-side |
| Period Hours (RH) | `latestRH - earliestRH` | Server: operationsReportService | 2.1 | RH log entries | Over report period |
| Avg Daily (RH) | `periodHours / dayCount` | Server: operationsReportService | 2.1 | Period hours, day count | Per-component |
| Utilization % | `(avgDaily / expectedDailyHours) × 100` | Server: operationsReportService | 2.1 | Avg daily, expected | Can exceed 100% |
| RH Delta | `newRh - previousRh` | Server: complianceReportService | 2.2 | Consecutive RH entries | Can be negative (rollback) |
| Avg Daily (Anomaly) | `delta / daysBetween` | Server: complianceReportService | 2.2 | Delta, days between entries | Per-entry pair |

### Advanced Formulas in Stores Consumption (storesReportService.ts)

| Formula Name | Expression | Implementation File:Line | Used In | Notes |
|-------------|------------|-------------------------|---------|-------|
| Confidence Level | `daysOfData > 90 → 'high'; >= 30 → 'medium'; else → 'low'` | storesReportService.ts:320-322 | 4.5 (JSON + Excel) | Data quality tier |
| Confidence Multiplier | `daysOfData < 7 → 0.5; < 30 → 0.75; else → 1.0` | storesReportService.ts:378-380 | 4.5 consumption rate | Scales raw rate by sample size |
| Adjusted Monthly Consumption | `rawMonthlyRate × confidenceMultiplier` | storesReportService.ts:381 | 4.5 consumption rate | `avgMonthlyConsumption` used downstream |
| Reorder Point | `adjustedDaily × leadTimeDays + safetyStock` | storesReportService.ts:520 | 4.5 forecast | leadTimeDays=30, safetyStock=projectedMonthly (one month buffer) |
| Reorder Needed | `currentRob ≤ reorderPoint AND projectedMonthly > 0` | storesReportService.ts:522 | 4.5 forecast | Boolean trigger |
| Suggested Reorder Qty | `reorderNeeded ? max(0, ceil(targetLevel - currentRob)) : 0` | storesReportService.ts:523 | 4.5 forecast | targetLevel = max(minStock×3, projectedMonthly×6) |
| Forecast Projected Monthly | `adjustedDaily × 30` (rounded to 2 decimal) | storesReportService.ts:515 | 4.5 forecast | Uses confidence-adjusted daily rate |
| Months Remaining | `currentRob / (adjustedDaily × 30)` | storesReportService.ts:516 | 4.5 forecast | null if adjustedDaily=0 |
| Forecast Confidence Multiplier | `daysOfData < 7 → 0.5; < 30 → 0.75; else → 1.0` | storesReportService.ts:511-513 | 4.5 forecast | Same thresholds as consumption, applied to forecast |
| Monthly Trends | Grouped by month: sum(qty), count(events), split by itemType (stores/lubricants/chemicals/others) | storesReportService.ts:669-708 | 4.5 Excel (Monthly Trends sheet) | Multi-sheet Excel export |
| Stock Efficiency (Movement) | Items classified by consumption activity vs data period | storesReportService.ts:874 | 4.5 Excel (Stock Efficiency sheet) | Movement thresholds adjusted for sample size |
| Stock Turnover Ratio (JSON) | `totalConsumed / avgRob` (0 if avgRob=0) | storesReportService.ts:441 | 4.5 stock efficiency (JSON) | Used for fast/slow/non-moving classification |
| Stock Turnover Ratio (Excel) | `totalConsumed / currentRob` (0 if currentRob=0) | storesReportService.ts:821 | 4.5 Excel (Stock Efficiency sheet) | Sorted by turnover DESC |
| Movement Speed Classification | `turnover >= fastThreshold \|\| freq >= 0.5 → 'Fast'; turnover >= slowThreshold \|\| freq >= 0.1 → 'Slow'; else → 'Non-Moving'` | storesReportService.ts:455-462 (JSON), :830-836 (Excel) | 4.5 stock efficiency | Thresholds are sample-size adjusted |
| Safety Stock | `safetyStock = projectedMonthly` (one month of projected consumption) | storesReportService.ts:519 (JSON), :915 (Excel) | 4.5 forecast/reorder | Used in reorder point formula |
| Target Level | `max(minStock × 3, projectedMonthly × 6)` | storesReportService.ts:521 (JSON), :917 (Excel) | 4.5 reorder qty | Determines suggested reorder quantity |

All formulas referenced in the original task scope are implemented in the current codebase. No formulas remain unimplemented.

---

## Section D: Troubleshooting Matrix (Ordered Diagnostic Checkpoints)

### D.1: Report Shows 0 Rows

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | API Response | Does the API return data? Check browser DevTools Network tab for response body | If empty array, data doesn't exist in DB |
| 2 | Vessel Selection | Is a specific vessel selected? Many endpoints require specific vessel, not 'all' | Select a specific vessel |
| 3 | Status Filter | Are status-based filters excluding all WOs? (e.g., all WOs are Completed but report filters them out) | Adjust status expectations |
| 4 | Date Range | Is date range filter too narrow or inverted? | Widen date range or clear filter |
| 5 | Data Existence | Do matching records exist in the database? | Query work_orders/stores/spares tables directly |
| 6 | Server Query | Is the server-side query filtering correctly? Check controller/service file | Debug server-side SQL/ORM query |

### D.2: Excel Has Different Columns Than View

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Frontend Columns | Count columns in switch case `columns` array | Read the report's case block in the frontend file |
| 2 | Excel Service | Count columns in the Excel service file | Read corresponding file in `server/modules/reports/services/` |
| 3 | Header Match | Do header strings match exactly? | Diff the two arrays |
| 4 | Legacy Template | Is service using STANDARD_WORK_ORDER_COLUMNS (18 cols)? | Search for `STANDARD_WORK_ORDER_COLUMNS` in service file |
| 5 | Fix | Replace Excel columns with exact copy from frontend | Copy column array; restart server |

### D.3: PDF Missing or Wrong Conditional Formatting

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Generator Method | Which method is called? Generic `generateReport()` or specialized? | Check `pdfReportGenerator.generate*()` in switch case |
| 2 | Field Names | Do `didParseCell` checks reference correct field names? | Verify field names in pdfReportGenerator.ts |
| 3 | Column Index | Is `findIndex()` finding the right column? | Check column array order matches |
| 4 | Data Values | Does row data have expected values in the checked fields? | Console.log data before PDF call |
| 5 | Color Constants | Are PDF_COLORS correct? | Check pdfReportGenerator.ts:17-42 |

### D.4: "Vessel Required" or Vessel-Related Error

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | effectiveVesselId | Is value 'all', empty string, or undefined? | Check vessel selector UI state |
| 2 | Server Validation | Does endpoint validate vesselId? | Check controller for validation |
| 3 | VesselContext | Is `useVessel()` hook providing a value? | Check VesselContext provider |
| 4 | Fix | Select a specific vessel in the UI before exporting | User action |

### D.5: Man-Hours Showing 0, NaN, or '—'

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | manhours Field | Is `wo.manhours` populated in DB? | Query WO record |
| 2 | Time Fields | Are `startDateTime`/`completionDateTime` valid ISO strings? | Check DB values |
| 3 | totalTimeHours | Is `wo.totalTimeHours` populated? | Check WO record |
| 4 | noOfPersons | Is `wo.noOfPersons` > 0? (defaults to 1 if missing) | Check WO record |
| 5 | Fallback Chain | `parseFloat(manhours) → duration×persons → '—'` | Trace MaintenanceReports.tsx:607-609 |

### D.6: Overdue Jobs Not Appearing (Grace Period)

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Calculate Age | How many days overdue is the WO? `(now - dueDate)` in days | Manual calculation |
| 2 | Grace Period | Is WO within 7-day grace? (1-7 days overdue → NOT in report 1.2) | This is by design |
| 3 | Report 1.1 | Does it appear in Due Jobs report? (which includes all overdue) | Check 1.1 instead |
| 4 | RH Override | Does WO have RH data? (RH >168 overdue → appears in 1.2 regardless) | Check nextDueReading/currentCumulativeRH |
| 5 | Status | Is WO Completed or Postponed? (always excluded) | Check wo.status |

### D.7: Monthly Summary Unexpected Overdue Count

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Definition | Cumulative overdue = ALL WOs with dueDate < periodEnd AND not completed | Includes historic backlog |
| 2 | Period End | Verify periodEnd = last day of month, 23:59:59 | Check MaintenanceReports.tsx:705 |
| 3 | Expectation | Cumulative count CAN exceed in-scope count | By design for backlog visibility |

### D.8: Excel Download Returns 500 Error

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Server Logs | Stack trace in server console output | Read logs for error details |
| 2 | Route | Is endpoint registered in routes.ts? | Check server/modules/reports/routes.ts |
| 3 | Service | Does service function exist and export correctly? | Check service file |
| 4 | DB | Is database connection active? | Check DB status |
| 5 | Request | Is vesselId present in request body (POST) or query params (GET)? | Check DevTools Network |
| 6 | Dependencies | Are ExcelJS and other packages installed? | Check node_modules |

### D.9: Change Request Excel Fails

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Method | CR Excel uses **GET** (not POST) unlike most reports | ChangeRequestReports.tsx:378-383 |
| 2 | Endpoint | `/technical/api/reports/change-requests-status-tracking/export` | routes.ts |
| 3 | Params | Filters sent as query params, not request body | Verify URL construction |

### D.10: LSA/FFA Excel Fails

| Step | Checkpoint | What to Check | Resolution |
|------|-----------|---------------|------------|
| 1 | Method | Uses same GET endpoint with `?format=excel` query param | LsaFfaReports.tsx:344-349 |
| 2 | Server | Server checks `format` param to decide JSON vs Excel | equipmentReportsController |
| 3 | Content-Type | Response should be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Check response headers |

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

### Post-Fix Verification (All 23 Reports)

Verification method: For each report, the view-mode column array in the frontend switch case was compared against the PDF generator call and the Excel service file. Column count and header names were confirmed matching per format.

| # | Report | View | PDF | Excel | Verification Detail |
|---|--------|------|-----|-------|---------------------|
| 1.1 | Due Jobs (7 Days) | 8 | 8 | 8 | Columns shared view/PDF at MaintenanceReports.tsx:340-349. Excel service updated from STANDARD_WORK_ORDER_COLUMNS (18) to 8 report-specific cols. |
| 1.2 | Overdue Jobs | 15 | 15 | 15 | Columns shared view/PDF at MaintenanceReports.tsx:431-447. Excel service updated from 18→15 cols. PDF uses specialized A3 generator. |
| 1.3 | Completed Jobs | 11 | 11 | 11 | Columns shared at MaintenanceReports.tsx:640-652. PDF switched from 24-col specialized to generic 11-col. Excel reduced from 24→11. |
| 1.4 | Monthly Summary | 3 | 3 | KPI | Same 3 metric columns in view/PDF (MaintenanceReports.tsx:775-779). Excel uses KPI dashboard layout with same metrics. |
| 1.5 | Critical Equipment | 12 | 12 | 12 | Columns at MaintenanceReports.tsx:832-845. Specialized PDF with metadata block. Excel via equipmentReportService. |
| 1.6 | Unplanned Jobs | 11 | 11 | 11 | Server returns data matching column definition. Specialized PDF. Excel via equipmentReportService. |
| 1.7 | Postponement Log | 10 | 10 | 10 | Columns shared at MaintenanceReports.tsx:941-952. Excel service updated from 19→10 cols. |
| 1.8 | Priority Performance | 5 | 5 | N/A | View/PDF share columns at MaintenanceReports.tsx:1016-1022. No Excel endpoint. |
| 1.9 | Man-Hours Analysis | 5 | 5 | N/A | View/PDF share columns at MaintenanceReports.tsx:1043-1049. No Excel endpoint. |
| 1.10 | Workload Distribution | 10 | 10 | 10 | Columns shared at MaintenanceReports.tsx:1141-1152. Excel via operationsReportService. |
| 2.1 | Utilization Summary | 10 | 10 | 10 | Columns at RunningHoursReports.tsx:198-209. Excel via operationsReportService. |
| 2.2 | Anomaly Detection | 11 | 11 | 11 | Columns at RunningHoursReports.tsx:271-283. Excel via complianceReportService. |
| 3.1 | Critical Spares | 10 | 10 | 10 | Columns at SparesReports.tsx:263-274. Excel via sparesReportService. |
| 3.2 | Low Stock (Spares) | 8 | 8 | 8 | Columns at SparesReports.tsx:221-229. Excel via sparesReportService. |
| 3.3 | Consumption (Spares) | 10 | 10 | 10 | Columns at SparesReports.tsx:319-330. API `/consumption-analysis/:vesselId` routes to storesCtrl (combined). Excel via storesReportService (combined). |
| 4.1 | Stores Inventory | 8 | 8 | 8 | Columns at StoresReports.tsx:227-236. Excel via storesReportService. |
| 4.2 | Lubricants & Oil | 6 | 6 | N/A | Columns at StoresReports.tsx:273-280. No Excel endpoint. |
| 4.3 | Chemicals & Expiry | 9 | 9 | N/A | Columns at StoresReports.tsx:314-324. No Excel endpoint. |
| 4.4 | Stores Low Stock | 13 | 13 | 13 | Columns at StoresReports.tsx:383-397. Excel via storesReportService. |
| 4.5 | Stores Consumption | 7 | Special | 7 | View 7-col table at StoresReports.tsx:441-448. PDF uses specialized `generateConsumptionAnalysisPDF()` (multi-section dashboard). Excel via storesReportService. |
| 5.1 | IHM Inventory | 10 | 10 | 10 | Columns in IhmReports.tsx. Excel via complianceReportService. |
| 6.1 | CR Tracking | 13 | 13 | 13 | Columns at ChangeRequestReports.tsx:237-251. Excel via GET /export (changeRequestReportService). |
| 7.1 | LSA/FFA Master | 12 | 12 | 12 | Columns at LsaFfaReports.tsx:178-191. Excel via GET ?format=excel (equipmentReportService). |
| 7.2 | LSA/FFA Schedule | 16 | 16 | 16 | Columns at LsaFfaReports.tsx:249-266. Excel via GET ?format=excel (equipmentReportService). |

---

## API Endpoint Quick Reference

| Method | Endpoint | Report | Request Body / Params |
|--------|----------|--------|-----------------------|
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
| POST | `/technical/api/reports/consumption-analysis/:vesselId/excel` | 3.3 | POST body (routes to storesCtrl.exportCombinedConsumptionExcel) |
| POST | `/technical/api/reports/stores-inventory-status/:vesselId/excel` | 4.1 | POST body |
| POST | `/technical/api/reports/stores-low-stock-alert/:vesselId/excel` | 4.4 | POST body |
| POST | `/technical/api/reports/stores-consumption-analysis/:vesselId/excel` | 4.5 | POST body (routes to storesCtrl.exportStoresConsumptionExcel) |
| POST | `/technical/api/reports/ihm-inventory-status/excel` | 5.1 | POST body |
| GET | `/technical/api/reports/change-requests-status-tracking/export` | 6.1 | Query params: vesselId, status, category |
| GET | `/technical/api/reports/lsa-ffa-master-list?format=excel` | 7.1 | Query params: vesselId, equipmentType |
| GET | `/technical/api/reports/lsa-ffa-maintenance-schedule?format=excel` | 7.2 | Query params: vesselId, equipmentType, status |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `client/src/pages/reports/MaintenanceReports.tsx` | Maintenance (10 reports): view columns + PDF generation |
| `client/src/pages/reports/RunningHoursReports.tsx` | Running Hours (2 reports): view + PDF |
| `client/src/pages/reports/SparesReports.tsx` | Spares (3 reports): view + PDF |
| `client/src/pages/reports/StoresReports.tsx` | Stores (5 reports): view + PDF |
| `client/src/pages/reports/ChangeRequestReports.tsx` | Change Requests (1 report): view + PDF |
| `client/src/pages/reports/LsaFfaReports.tsx` | LSA/FFA (2 reports): view + PDF |
| `client/src/lib/pdfReportGenerator.ts` | PDF generation: generic `generateReport()` + specialized methods |
| `server/modules/reports/routes.ts` | All report API route definitions |
| `server/modules/reports/services/maintenanceReportService.ts` | Maintenance Excel exports |
| `server/modules/reports/services/equipmentReportService.ts` | Equipment + LSA/FFA Excel exports |
| `server/modules/reports/services/complianceReportService.ts` | Running Hours Anomaly + IHM Excel exports |
| `server/modules/reports/services/operationsReportService.ts` | Utilization + Workload Excel exports |
| `server/modules/reports/services/sparesReportService.ts` | Spares Excel exports |
| `server/modules/reports/services/storesReportService.ts` | Stores Excel exports |
| `server/modules/reports/services/changeRequestReportService.ts` | Change Requests Excel export |
| `server/lib/excelReportStyles.ts` | Shared Excel styles (STANDARD_WORK_ORDER_COLUMNS — legacy, unused by active exports) |

### Architecture Pattern

```
Frontend switch block → defines columns[] array
  ├── setPreviewData({ columns, data }) → View/Preview (inline table)
  ├── pdfReportGenerator.generateReport(config, columns, data) → PDF download
  └── Excel: separate service file must manually mirror columns
```

**Key Invariant:** View and PDF always share the same column array (single source of truth). Excel services are independent and must be manually kept in sync.

**PDF Generation Methods:**

| Method | Reports | Paper | Notes |
|--------|---------|-------|-------|
| `generateReport()` | Most (1.1, 1.3, 1.4, 1.7-1.10, 2.x, 3.x, 4.1-4.4, 5.1, 6.1, 7.x) | A4 landscape | Generic table with conditional formatting |
| `generateOverdueJobsReport()` | 1.2 Overdue | A3 landscape | Colored header, critical row highlighting |
| `generateCriticalEquipmentReport()` | 1.5 Critical Equip | Custom | Metadata summary above table |
| `generateUnplannedBreakdownReport()` | 1.6 Unplanned | Custom | Similar to overdue styling |
| `generateConsumptionAnalysisPDF()` | 4.5 Stores Consumption | Landscape | Multi-section dashboard (trends, categories, forecast, etc.) |
| `generateCompletedJobsRegisterReport()` | Legacy (unused) | A3 | Was 24 cols; replaced in Phase 1 |

### Excel Export API Exceptions

| Report | Exception | Details |
|--------|-----------|---------|
| 6.1 CR Tracking | Uses GET instead of POST | Filters as query params, not request body |
| 7.1 LSA/FFA Master | Uses `?format=excel` on same endpoint | Server checks format param to return JSON or Excel |
| 7.2 LSA/FFA Schedule | Uses `?format=excel` on same endpoint | Same pattern as 7.1 |
| 1.8 Priority Perf | No Excel endpoint | View/PDF only |
| 1.9 Man-Hours | No Excel endpoint | View/PDF only |
| 4.2 Lubricants | No Excel endpoint | View/PDF only |
| 4.3 Chemicals | No Excel endpoint | View/PDF only |
