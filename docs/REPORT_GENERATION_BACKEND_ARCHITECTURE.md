# Report Generation System - Backend Architecture Documentation

## Planned Maintenance System (PMS) - Technical Reference

**Version:** 1.0
**Last Updated:** February 2026
**Scope:** Complete backend analysis of report generation, data models, API architecture, query patterns, business logic, and architectural considerations.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema for Reports](#2-database-schema-for-reports)
3. [Data Relationships and Entity Graph](#3-data-relationships-and-entity-graph)
4. [Report Catalog and API Endpoints](#4-report-catalog-and-api-endpoints)
5. [Shared Status Computation Engine](#5-shared-status-computation-engine)
6. [Report-Specific Business Logic](#6-report-specific-business-logic)
7. [Maintenance Planner (Real-Time Report)](#7-maintenance-planner-real-time-report)
8. [Excel Report Generation Pipeline](#8-excel-report-generation-pipeline)
9. [Defect Reports Sub-System](#9-defect-reports-sub-system)
10. [Running Hours Reports](#10-running-hours-reports)
11. [Frontend Report Consumption Patterns](#11-frontend-report-consumption-patterns)
12. [Storage Layer and Query Patterns](#12-storage-layer-and-query-patterns)
13. [Architectural Issues and Recommendations](#13-architectural-issues-and-recommendations)
14. [Appendix: Threshold Constants](#14-appendix-threshold-constants)

---

## 1. System Overview

### 1.1 Domain Context

The PMS is a maritime Planned Maintenance System managing vessel fleets. The report generation system produces operational intelligence across these domains:

| Domain | Description | Primary Tables |
|--------|-------------|----------------|
| Maintenance Planning | Job schedules, due dates, RH-based intervals | `jobs`, `components`, `job_component_links` |
| Work Order Lifecycle | Creation, approval, execution, completion | `work_orders`, `work_order_postponements` |
| Running Hours | Equipment runtime tracking and anomaly detection | `running_hours_audit`, `component_running_hours_log`, `components` |
| Defects | Deficiency tracking, COC defects, recurring patterns | `defects`, `defect_actions`, `recurring_defects` |
| Spares & Stores | Inventory levels, consumption, requisitions | `spares`, `component_requisitions`, `spare_consumption_history` |
| Certificates & Surveys | Regulatory compliance tracking | `vessel_certificate_data`, `vessel_survey_data` |

### 1.2 Architecture Pattern

```
Frontend (React/TanStack Query)
    |
    v
Express API (server/routes.ts - 16,600+ lines)
    |
    +---> Storage Interface (IStorage - server/storage.ts)
    |         |
    |         v
    |     PostgreSQL (postgresStorage.ts - Drizzle ORM)
    |
    +---> Shared Business Logic
    |         +---> shared/workOrders/status.ts (computeWorkOrderStatus)
    |         +---> shared/workOrders/constants.ts (WORK_ORDER_THRESHOLDS)
    |
    +---> Excel Generation Layer (server/lib/excelReportStyles.ts)
    |         +---> ExcelJS library
    |
    +---> Services Layer
              +---> jobDueScanner.ts (auto WO generation)
              +---> workOrderService.ts (WO lifecycle)
```

### 1.3 Vessel-Scoped Data Isolation

All report queries are scoped to a single vessel via `vesselId` parameter. The data isolation model:

- **Vessel-level data:** Components, jobs, work orders, spares, defects, running hours
- **Fleet-level master data:** Fleet components, fleet jobs, fleet spares, makers (shared templates)
- **System-wide config:** Equipment categories, defect categories, PMS vessel settings

Reports primarily query vessel-level data. However, some reports (e.g., Equipment Utilization) query by `vesselCode` in addition to `vesselId`, and the `component_running_hours_log` table uses `vesselCode` as its key. Fleet master data is generally not included in report outputs, but vessel-to-fleet mappings exist for organizational grouping.

---

## 2. Database Schema for Reports

### 2.1 Core Tables Used by Reports

#### `work_orders` (Central to most reports)
```
Primary Key: id (text)
Key Columns:
  - workOrderNo (text) - Display identifier (e.g., "WO-001")
  - vesselId (text) - Vessel scope filter
  - jobId (text) - Links to jobs table
  - jobTitle (text) - Denormalized job title
  - componentCode (text) - Links to components
  - status (text) - 'Active' | 'Completed' | 'Postponed' | 'Pending Approval' | 'Rejected'
  - maintenanceBasis (text) - 'Calendar' | 'Running Hours' | 'Calendar+RH'
  - dueDate (text) - Calendar due date
  - dueDateSnapshot (text) - Frozen due date at WO creation
  - nextDueReading (text) - RH due reading
  - currentReading (text) - RH current reading at creation
  - lastDoneDateSnapshot (text) - Frozen last done date
  - completionDateTime (text) - When work was completed
  - dateCompleted (text) - Completion date
  - department (text) - Deck/Engine/Electrical
  - assignedTo (text) - Crew rank
  - jobPriority (text) - Critical/High/Medium/Low
  - manhours (text) - Actual man-hours spent
  - workOrderType (text) - 'Planned' | 'Unplanned'
  - isExecution (boolean) - Distinguishes template vs execution record
  - postponementReason (text) - Reason for postponement
  - postponementEndDate (text) - New due date after postponement
  - postponementAuthorizedBy (text) - Who authorized
  - criticality (text) - Job criticality flag
  - classRelated (text) - Classification society related
Indexes: vesselId, status, jobId
```

#### `jobs` (Job definitions linked to components)
```
Primary Key: id (text)
Key Columns:
  - jobNo / templateCode (text) - Job reference number
  - jobTitle (text)
  - vesselId (text) - Vessel scope
  - componentId (text) - DEPRECATED: Use job_component_links
  - componentCode (text) - DEPRECATED: Use job_component_links
  - maintenanceBasis (text) - 'Calendar' | 'Running Hours'
  - frequencyType (text) - Alias for maintenanceBasis
  - frequencyValue (text) - Numeric interval
  - frequencyUnit (text) - 'Days' | 'Weeks' | 'Months' | 'Years'
  - nextDueDate (text) - Computed next due
  - lastDoneDate (text) - Last completion date
  - lastDoneRH (text) - RH at last completion
  - nextDueRH (text) - Computed next due RH
  - intervalRunningHour (integer) - RH interval
  - assignedTo (text) - Default crew rank
  - department (text)
  - criticality (text) - 'Yes' | 'No'
  - jobPriority (text)
  - estimatedManHours (text)
  - requiredSpareParts (jsonb) - Array of required spares
  - isActive (boolean) - Active/inactive flag
  - dataScope (text) - 'vessel' | 'fleet'
```

#### `components` (Equipment hierarchy)
```
Primary Key: id (text)
Key Columns:
  - componentCode (text) - Unique within vessel
  - name (text) - Component display name
  - vesselId (text)
  - parentId (text) - Self-referencing hierarchy
  - currentCumulativeRH (text) - Current running hours
  - rhCounterType (text) - 'SELF' | 'PARENT_DRIVEN' | 'Not RH Driven'
  - critical (boolean) - Critical equipment flag
  - department (text) - Deck/Engine/Electrical
  - isActive (boolean)
  - componentCategory / category (text)
```

#### `job_component_links` (Many-to-many: Jobs <-> Components)
```
Primary Key: id (integer)
Columns:
  - jobId (text) - References jobs.id
  - componentId (text) - References components.id
  - vesselId (text)
Purpose: A single job can be linked to multiple components.
         Each link produces a separate row in the Maintenance Planner.
```

#### `work_order_postponements` (Audit trail)
```
Primary Key: id (text)
Key Columns:
  - workOrderId (text) - References work_orders.id
  - vesselId (text)
  - postponementNumber (integer) - 1st, 2nd, 3rd postponement
  - originalDueDate (text)
  - newDueDate (text)
  - postponementReason (text)
  - authorizedBy (text)
  - approvalRemarks (text)
  - durationDays (integer)
  - status (text) - 'Pending' | 'Approved' | 'Rejected'
  - informOffice (boolean)
Indexes: workOrderId, vesselId, status
```

#### `running_hours_audit` (RH change log)
```
Primary Key: id (integer, auto-generated)
Key Columns:
  - vesselId (text) - Vessel scope
  - componentId (text) - References components.id
  - previousRH (decimal 10,2) - Before update
  - newRH (decimal 10,2) - After update
  - cumulativeRH (decimal 10,2) - Running total
  - dateUpdatedLocal (text) - DD-MMM-YYYY HH:mm format
  - dateUpdatedTZ (text) - Timezone string (e.g., Asia/Kolkata)
  - enteredAtUTC (timestamp) - UTC timestamp of entry
  - userId (text) - Who made the change
  - source (text) - 'single' | 'bulk' | 'cascade' | 'inherited_cascade'
  - notes (text) - Optional notes
  - meterReplaced (boolean) - Meter replacement flag
  - oldMeterFinal (decimal 10,2) - Final reading before meter replacement
  - newMeterStart (decimal 10,2) - Starting reading after replacement
  - isRenewalReset (boolean) - True when RH reset to 0 via renewal
  - renewalActionType (text) - 'Renewed' | 'Replaced' | 'Overhauled'
  - renewalReason (text) - Mandatory when isRenewalReset = true
  - componentCode (text) - Denormalized for reporting
  - componentName (text) - Denormalized for reporting
  - version (integer) - Record version
Indexes: (componentId, enteredAtUTC), (componentId, dateUpdatedLocal), (isRenewalReset, vesselId)
Purpose: Anomaly detection, utilization analysis, renewal tracking
```

#### `component_running_hours_log` (RH change log - alternative)
```
Primary Key: id (integer, auto-generated)
Key Columns:
  - vesselCode (text) - Vessel code (may differ from vesselId)
  - componentCode (text) - Component code
  - componentId (text) - Component ID
  - previousRh (decimal 10,2) - Before update
  - newRh (decimal 10,2) - After update
  - deltaRh (decimal 10,2) - Change amount (can be negative)
  - updatedBy (text) - User who made change
  - updatedAt (timestamp) - When updated
  - updateSource (text) - 'manual' | 'cascade' | 'bulk_import' | 'work_order'
  - notes (text) - Optional
Indexes: componentCode, vesselCode, updatedAt, updateSource
Purpose: Equipment utilization trend analysis, delta-based reporting

NOTE: Equipment Utilization report queries this table by BOTH vesselCode
and vesselId to handle vessels where these values differ.
```

#### `component_maintenance_history` (Immutable completion records)
```
Primary Key: id (integer, auto-generated)
Key Columns:
  - componentId (text) - References components.id
  - componentCode (text)
  - vesselCode (text)
  - jobId (text) - Link to parent job
  - jobCode (text) - Job number
  - workOrderId (text) - Link to completed work order
  - workOrderNo (text)
  - jobTitle (text)
  - maintenanceType (text) - 'Inspection' | 'Overhaul' | 'Servicing' | etc.
  - dateCompleted (text) - ISO YYYY-MM-DD for sorting
  - runningHoursAtCompletion (decimal 10,2)
  - performedBy (text)
  - approvedBy (text)
  - status (text) - Only 'Approved' entries shown
  - sparesUsed (json) - [{partCode, partName, quantity}]
  - isComponentReplaced (boolean) - Component replacement flag
  - createdAt (timestamp) - IMMUTABLE, no updates/deletes allowed
Indexes: componentId, componentCode, vesselCode, jobId, jobCode, workOrderId, dateCompleted
Purpose: Immutable audit trail of completed maintenance work
```

#### `spares` (Inventory tracking)
```
Key Columns:
  - partCode (text) - Primary match key
  - partName (text) - Display name
  - rob (integer) - Remaining on Board
  - min (integer) - Minimum stock level
  - vesselId (text)
```

### 2.2 Certificate & Survey Tables

#### `vessel_certificate_data` / `vessel_survey_data`
```
Both share structure:
  - vesselId (text)
  - masterId (text) - References master definition
  - issueDate / surveyDate (text)
  - expiryDate / dueDate (text)
  - attachments (jsonb) - File references
```

### 2.3 PMS Configuration

#### `pms_vessel_settings` (Per-vessel overrides)
```
Key Columns:
  - vesselId (text)
  - calendarGraceMode (text) - 'COMPANY_STANDARD' | 'CUSTOM_DAYS'
  - calendarGraceDays (integer) - Custom grace period
  - rhGraceHours (integer) - RH grace period
  - rhLeadTimeHours (integer) - RH lead time
  - calendarLeadDaysCritical (integer)
  - calendarLeadDaysNonCritical (integer)
  - rhLeadHoursCritical (integer)
  - rhLeadHoursNonCritical (integer)
```

---

## 3. Data Relationships and Entity Graph

```
vessels (1)
  |
  +---> components (N) ---> parentId (self-ref hierarchy)
  |       |
  |       +---> job_component_links (N) <---+ jobs (N)
  |       |                                  |
  |       +---> spares (N)                   +---> work_orders (N)
  |       |                                         |
  |       +---> running_hours_audit (N)              +---> work_order_postponements (N)
  |       |
  |       +---> component_running_hours_log (N)
  |       |
  |       +---> component_maintenance_history (N)
  |
  +---> defects (N) ---> defect_actions (N)
  |                 ---> defect_attachments (N)
  |
  +---> vessel_certificate_data (N) ---> ship_certificates_master (FK: masterId)
  |
  +---> vessel_survey_data (N) ---> ship_surveys_master (FK: masterId)
  |
  +---> pms_vessel_settings (1) [grace period config]
```

### Key Relationship Notes:

1. **Jobs to Components:** Many-to-many via `job_component_links`. Legacy `jobs.componentId` and `jobs.componentCode` fields exist for backward compatibility but are deprecated.

2. **Work Orders to Jobs:** `work_orders.jobId` references `jobs.id`. Some legacy WOs use `templateCode` matching `jobs.jobNo` as fallback.

3. **Components to Running Hours:** `components.currentCumulativeRH` stores the current value. `running_hours_audit` and `component_running_hours_log` store history.

4. **Components hierarchy:** `components.parentId` creates a tree. RH-based jobs on child components look up the parent's `currentCumulativeRH` for RH calculations.

5. **Denormalized fields in work_orders:** `componentCode`, `component` (name), `jobTitle`, `department` are stored directly on work orders as snapshots. Reports may join back to source tables for current values.

---

## 4. Report Catalog and API Endpoints

### 4.1 Maintenance Reports (Excel Exports)

| # | Report Name | Endpoint | Method | Output |
|---|------------|----------|--------|--------|
| 1 | Due Jobs (7 Days) | `/technical/api/reports/due-jobs-7-days` | POST | Excel |
| 2 | Overdue Jobs | `/technical/api/reports/overdue-jobs` | POST | Excel |
| 3 | Completed Jobs Register | `/technical/api/reports/completed-jobs` | POST | Excel |
| 4 | Unplanned/Breakdown Jobs | `/technical/api/reports/unplanned-jobs` | POST | Excel |
| 5 | Postponement Log | `/technical/api/reports/postponement-log` | POST | Excel |
| 6 | Monthly Summary | `/technical/api/reports/maintenance/monthly-summary/excel` | POST | Excel |

### 4.2 Operational Reports (JSON + Optional Excel)

| # | Report Name | Endpoint | Method | Output |
|---|------------|----------|--------|--------|
| 7 | Maintenance Planner | `/technical/api/maintenance-planner` | GET | JSON |
| 8 | Planner Export | `/technical/api/maintenance-planner/export` | GET | Excel |
| 9 | Crew Workload Distribution | `/technical/api/reports/crew-workload-distribution` | GET | JSON |
| 10 | Crew Workload Export | `/technical/api/reports/crew-workload-distribution/excel` | POST | Excel |
| 11 | Equipment Utilization | `/technical/api/reports/equipment-utilization-summary` | GET | JSON |
| 12 | Equipment Utilization Export | `/technical/api/reports/equipment-utilization-summary/excel` | POST | Excel |
| 13 | RH Anomaly Detection | `/technical/api/reports/running-hours-anomaly-detection` | GET | JSON |
| 14 | RH Anomaly Export | `/technical/api/reports/running-hours-anomaly-detection/excel` | POST | Excel |

### 4.3 Defect Reports (JSON)

| # | Report Name | Endpoint | Method | Output |
|---|------------|----------|--------|--------|
| 15 | Status Summary | `/technical/api/defects/reports/status-summary` | POST | JSON |
| 16 | Overdue Defects | `/technical/api/defects/reports/overdue` | POST | JSON |
| 17 | Critical Defects | `/technical/api/defects/reports/critical` | POST | JSON |
| 18 | By Vessel | `/technical/api/defects/reports/by-vessel` | POST | JSON |
| 19 | By Equipment | `/technical/api/defects/reports/by-equipment` | POST | JSON |
| 20 | Monthly Trend | `/technical/api/defects/reports/monthly-trend` | POST | JSON |

### 4.4 Data Source Endpoints (Used by Frontend Reports)

These are not report-specific endpoints but serve as data sources for frontend-rendered reports:

| Endpoint | Used By |
|----------|---------|
| `/technical/api/work-orders?vesselId=X` | MaintenanceReports (all tabs) |
| `/technical/api/jobs?vesselId=X` | MaintenanceReports |
| `/technical/api/components/:vesselId` | RunningHoursReports |
| `/technical/api/running-hours/:componentId` | RunningHoursReports |
| `/technical/api/certificates?vesselId=X` | ComplianceReports |
| `/technical/api/surveys?vesselId=X` | ComplianceReports |
| `/technical/api/spares?vesselId=X` | SparesReports |
| `/technical/api/defects?vesselId=X` | DefectReports |

---

## 5. Shared Status Computation Engine

### 5.1 Source of Truth: `shared/workOrders/status.ts`

The `computeWorkOrderStatus()` function is the canonical status calculation, shared between frontend display and some backend reports.

**Location:** `shared/workOrders/status.ts`

**Usage in Reports:**
- **Uses `computeWorkOrderStatus()`:** Overdue Jobs report (Report #2), Work Order list endpoints
- **Uses custom inline logic:** Due Jobs 7-Days (Report #1), Maintenance Planner, Monthly Summary
- The Due Jobs report applies its own urgency scoring and 7-day window filter rather than the standard function
- The Maintenance Planner uses its own status categories (`OVERDUE|DUE_GRACE|DUE_SOON|FUTURE`) which are conceptually similar but implemented separately

This divergence means status counts may not perfectly align between different reports for the same data.

### 5.2 Status Categories

```typescript
type ComputedWorkOrderStatus =
  | 'Active'         // Far from due (>30 days or >720 RH)
  | 'Due'            // Within lead time (<=30 days or <=720 RH)
  | 'Due (Grace P)'  // Past due but within grace period
  | 'Overdue'        // Past due AND past grace period
  | 'Completed'      // Terminal state
  | 'Pending Approval' // Awaiting approver action
  | 'Rejected'       // Rejected by approver
  | 'Postponed';     // Deferred maintenance
```

### 5.3 Calendar-Based Status Logic

```
Input: dueDate, today, vesselGraceSettings
Output: Active | Due | Due (Grace P) | Overdue

1. Parse dueDate
2. Calculate diffDays = dueDate - today

3. If diffDays < 0 (past due):
   a. Calculate graceEndDate:
      - CUSTOM_DAYS mode: dueDate + calendarGraceDays
      - COMPANY_STANDARD mode:
        * If due in last 7 days of month -> grace = 7 days
        * Otherwise -> grace extends to end of due month
   b. If today > graceEndDate -> OVERDUE
   c. Else -> DUE (GRACE P)

4. If diffDays <= CALENDAR_LEAD_TIME_DAYS (30) -> DUE
5. Else -> ACTIVE
```

### 5.4 Running Hours-Based Status Logic

```
Input: dueRH, currentRH, leadTimeHours, graceHours
Output: OVERDUE | DUE_GRACE | DUE | PLANNED

1. rhRemaining = dueRH - currentRH

2. If rhRemaining < -graceHours -> OVERDUE
3. If rhRemaining < 0 -> DUE_GRACE
4. If rhRemaining <= leadTimeHours -> DUE
5. Else -> PLANNED (maps to Active)
```

### 5.5 Status Workflow Precedence

The `computeWorkOrderStatus` function applies checks in this exact order:

1. Execution records: Check `isExecution` flag
2. Pending Approval: Takes priority over completion check
3. Postponed: Returns 'Postponed'
4. Rejected: Falls through to due-date calculation (appears in due/overdue tabs)
5. Completed: Checks `completionDateTime` or `status === 'Completed'`
6. Maintenance basis branch: Calendar vs Running Hours calculation

### 5.6 Grace Period Configuration

**COMPANY_STANDARD (default):**
- If due date is in the last 7 days of the month -> 7-day fixed grace
- Otherwise -> grace extends to end of the due month

**CUSTOM_DAYS:**
- Fixed number of days from the due date (configurable per vessel)

**RH Grace:**
- Fixed 168 hours (7-day equivalent) by default
- Configurable per vessel via `pms_vessel_settings.rhGraceHours`

---

## 6. Report-Specific Business Logic

### 6.1 Report #1: Due Jobs (7 Days)

**Endpoint:** `POST /technical/api/reports/due-jobs-7-days`

**Input:** `{ vesselId: string }`

**Data Fetching:**
```
1. storage.getWorkOrders(vesselId)
2. storage.getJobs(vesselId)
3. storage.getComponents(vesselId)
4. storage.getVessels()
```

**Filtering Logic:**
- Skip `status === 'Completed'` and `status === 'Postponed'`
- Calendar jobs: Include if `daysRemaining < 0` (overdue) OR `daysRemaining <= 7` (due soon)
- RH jobs: Include if `hoursRemaining < 0` (overdue) OR `hoursRemaining <= 168` (7-day equivalent)
- Uses `dueDateSnapshot` with fallback to `dueDate`

**Status Indicators:**
- `OVERDUE`: Past due (daysRemaining < 0 or hoursRemaining < 0)
- `URGENT`: Within 2 days or 48 RH
- `DUE`: Within 7 days or 168 RH

**Urgency Scoring:**
- Calendar: `urgencyScore = daysRemaining` (negative = most urgent)
- RH: `urgencyScore = hoursRemaining / 24`
- Sort: urgencyScore ASC, then priority DESC

**Output Format:** 18-column standardized Excel with status-based row highlighting.

### 6.2 Report #2: Overdue Jobs

**Endpoint:** `POST /technical/api/reports/overdue-jobs`

**Key Difference from Due Jobs:** Uses `computeWorkOrderStatus()` for filtering consistency.

**Filtering Logic:**
```
1. Skip isExecution records
2. Skip Completed and Postponed
3. Compute status via computeWorkOrderStatus()
4. Include ONLY where computedStatus === 'Overdue'
```

**Sort:** Critical equipment first, then days overdue DESC, then component name ASC.

**This report is audit-critical** - it must exactly match the UI badge count for overdue items.

### 6.3 Report #3: Completed Jobs Register

**Endpoint:** `POST /technical/api/reports/completed-jobs`

**Input:** `{ vesselId, dateFrom?, dateTo? }`

**Filtering:**
- `wo.status === 'Completed'`
- Optional date range on `wo.dateCompleted` or `wo.completionDateTime`

**Computed Fields:**
- Duration: `parseFloat(wo.totalTimeHours)` or calculated from `startDateTime` to `completionDateTime`
- Man-hours: `parseFloat(wo.manhours)` or `duration * noOfPersons`
- Aggregations: By department (count + man-hours), by priority (count), by job type (count)

**Output:** 25-column format (expanded from standard 18). Includes start/end times, persons, man-hours, risk assessment, safety checklists, operational forms.

### 6.4 Report #4: Unplanned/Breakdown Jobs

**Endpoint:** `POST /technical/api/reports/unplanned-jobs`

**Filtering:**
```
wo.workOrderType === 'Unplanned' ||
wo.type === 'Unplanned' ||
wo.workOrderNumber.startsWith('UWO')
```

**Output:** Standard 18-column with yellow highlighting for unplanned jobs.

### 6.5 Report #5: Postponement Log

**Endpoint:** `POST /technical/api/reports/postponement-log`

**Input:** `{ vesselId, dateFrom?, dateTo?, status? }`

**Data Source Priority:**
1. **Primary:** `work_order_postponements` table (audit trail with multiple postponements per WO)
2. **Fallback:** Generate from postponed work orders if no history records exist

**Output:** Custom 19-column format with sky blue highlighting. Tracks postponement number, original/new dates, reasons, approvals.

### 6.6 Report #6: Monthly Summary

**Endpoint:** `POST /technical/api/reports/maintenance/monthly-summary/excel`

**Input:** `{ vesselId, startDate, endDate }`

**Scope Calculation:**
```
monthlyWOs = WOs where:
  - dueDate is within [startDate, endDate]  (due in period)
  OR
  - status === 'Completed' AND completionDateTime within [startDate, endDate]  (completed in period)
```

**Computed Metrics:**
- Total in scope
- Total completed (within scope)
- Cumulative overdue: ALL WOs with dueDate < periodEnd AND status != Completed
- Completion rate: completed / totalInScope * 100
- On-time rate: (completed where completionDate <= dueDate) / completed * 100

---

## 7. Maintenance Planner (Real-Time Report)

### 7.1 Overview

The Maintenance Planner is the most complex real-time report. It computes planning data by processing each job-component pair individually.

**Endpoint:** `GET /technical/api/maintenance-planner`

### 7.2 Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| vesselId | string | Required. Vessel scope. |
| jobType | string | 'CALENDAR' \| 'RH' \| 'BOTH' |
| fromDate | string | ISO date for calendar filter |
| toDate | string | ISO date for calendar filter |
| remainingHoursMin | number | Min RH remaining filter |
| remainingHoursMax | number | Max RH remaining filter |
| includeOverdue | boolean | Include overdue items |
| includeGrace | boolean | Include grace period items |
| ranks | string | Comma-separated crew ranks |
| department | string | Department filter |
| criticalOnly | boolean | Only critical equipment |

### 7.3 Processing Pipeline

```
Step 1: Fetch Data
  - Jobs (active, vessel-scoped only: isActive !== false, dataScope === 'vessel')
  - Components (all for vessel)
  - Job-Component Links (many-to-many)
  - Work Orders (all for vessel)
  - Spares (all for vessel)
  - Vessel PMS Settings (grace period config)

Step 2: Build Lookup Maps
  - componentMap: id -> component
  - componentCodeMap: code -> component
  - jobToComponentsMap: jobId -> Set<componentId>

Step 3: Create Job-Component Pairs
  For each job:
    If job has entries in jobComponentLinks:
      Create one pair per linked component
    Else (backward compatibility):
      Use deprecated componentId/componentCode fields
      Match by ID first, then by code

Step 4: Process Each Pair
  For each (job, component) pair:
    a. Determine type: Calendar vs Running Hours
    b. Apply filters (type, department, rank, criticality)
    c. Calculate status:
       Calendar: nextDueDate computation + grace period
       RH: remainingHours = (lastDoneRH + frequencyRH) - parentRH
    d. Apply date/RH range filters
    e. Find relevant work orders (open priority > completed)
    f. Calculate spare status (OK/LOW/ZERO/NOT_SET)

Step 5: Sort Results
  Priority: OVERDUE > DUE_GRACE > DUE_SOON > FUTURE
  Secondary: Date (nearest first) or RH remaining (lowest first)

Step 6: Aggregate Summary
  - Total jobs, total man-hours
  - By rank, by department, by status
```

### 7.4 Planner Status Calculation

The planner uses its own status categories (different from `computeWorkOrderStatus`):

```typescript
type PlannerStatus = 'OVERDUE' | 'DUE_GRACE' | 'DUE_SOON' | 'FUTURE';
```

**Calendar Status:**
```
Parse nextDueDate (from job.nextDueDate or calculated from lastDoneDate + frequency)
daysUntilDue = dueDate - today

If daysUntilDue < 0:
  Calculate graceEndDate (same COMPANY_STANDARD / CUSTOM_DAYS logic)
  If today > graceEndDate -> OVERDUE
  Else -> DUE_GRACE
Else if daysUntilDue <= 30 -> DUE_SOON
Else -> FUTURE
```

**RH Status:**
```
parentRH = parent component's currentCumulativeRH
rhDue = lastDoneRH + frequencyRH
rhRemaining = rhDue - parentRH

If rhRemaining < -graceHours -> OVERDUE
Else if rhRemaining < 0 -> DUE_GRACE
Else if rhRemaining <= leadTimeHours -> DUE_SOON
Else -> FUTURE
```

### 7.5 Spare Status Calculation

```
For each job, check requiredSpareParts (JSONB array):
  Match spares by:
    1. partCode (primary, correct design)
    2. partNo (fallback for legacy)
    3. partName / description (fallback for legacy)

  If any matched spare has rob === 0 -> ZERO
  Else if any spare has rob < min -> LOW
  Else if all spares found -> OK
  If no requiredSpareParts defined -> NOT_SET
```

### 7.6 Planner Export

**Endpoint:** `GET /technical/api/maintenance-planner/export`

Internally calls the planner endpoint via `fetch('http://localhost:PORT/technical/api/maintenance-planner?...')` and transforms the JSON response into an Excel workbook.

**Architectural Note:** This self-referencing fetch pattern creates a coupling to the server's own port and could cause issues in environments where `localhost` is not accessible.

---

## 8. Excel Report Generation Pipeline

### 8.1 Library and Style System

**Library:** ExcelJS (`exceljs` package)

**Style Module:** `server/lib/excelReportStyles.ts` (710 lines)

### 8.2 Color Palette

```
Maritime Professional Theme:
  Primary:    #1E5A8E (Deep Blue - sidebar/headers)
  Secondary:  #5DADE2 (Light Blue - table headers)

Status-Based Row Colors:
  Due:        Light Orange #FFE4B5 / Dark Orange #FF8C00 (critical)
  Overdue:    Light Red #FFB6C1 / Crimson #DC143C (critical)
  Completed:  Light Green #90EE90 / Forest Green #228B22 (critical)
  Unplanned:  Light Yellow #FFFFB3 / Gold #FFD700 (critical)
  Postponed:  Powder Blue #B0E0E6 / Steel Blue #4682B4 (critical)

Rule: Critical equipment rows use the "dark" variant of each status color.
```

### 8.3 Standard 18-Column Layout

All Maintenance Work Order reports (except Completed Jobs) use this layout:

| # | Column | Width | Type |
|---|--------|-------|------|
| 1 | S.No | 6 | number |
| 2 | WO Number | 16 | text |
| 3 | Job Code | 12 | text |
| 4 | Job Title | 35 | text |
| 5 | Component Code | 14 | text |
| 6 | Component Name | 30 | text |
| 7 | Department | 12 | text |
| 8 | Priority | 10 | text |
| 9 | Status | 14 | text |
| 10 | Due Date | 14 | date |
| 11 | Last Done | 14 | date |
| 12 | Days Left | 10 | number |
| 13 | Days Overdue | 12 | number |
| 14 | Next Due RH | 12 | number |
| 15 | Current RH | 12 | number |
| 16 | RH Remaining | 12 | number |
| 17 | Assigned To | 14 | text |
| 18 | Critical Equip. | 12 | text |

### 8.4 Report Template Structure

Every Excel report follows this structure:

```
Row 1:   Title bar (merged, deep blue background, white text, 16pt)
Row 2:   Subtitle (merged, deep blue background, white text, 11pt)
Row 3-4: Metadata (vessel name, date range, totals)
Row 5-6: Spacer rows
Row 7:   Column headers (light blue background, white text, 9pt, frozen)
Row 8+:  Data rows (alternating or status-based coloring)
...
Last+3:  Summary section (key metrics, action notes)
```

Features:
- Frozen panes (header row + first 2-3 columns)
- Auto-filter on header row
- Print setup (landscape, A3/A4, repeat header rows)
- Status-based row highlighting with critical equipment dark variant

### 8.5 Helper Functions

| Function | Purpose |
|----------|---------|
| `applyStandardHeader()` | Rows 1-6 with title, subtitle, vessel, count |
| `applyStandardTableHeader()` | Column header row with styling |
| `applyWorkOrderDataRows()` | Data rows with status-based highlighting |
| `applyStandardSummary()` | Summary metrics section after data |
| `applyStandardPageSetup()` | Print margins, orientation, repeat rows |
| `generateFilename()` | `{ReportType}_{VesselName}_{YYYYMMDD}.xlsx` |
| `getLastColumnLetter()` | Maps column count to Excel letter |
| `getStatusRowColors()` | Returns colors for given status + critical flag |

---

## 9. Defect Reports Sub-System

### 9.1 Dynamic Report Router

**Endpoint:** `POST /technical/api/defects/reports/:reportKey`

Uses a `switch` statement on `reportKey` to generate different aggregation views from the same defects dataset.

### 9.2 Report Types

| reportKey | Title | Logic |
|-----------|-------|-------|
| `status-summary` | Defects Status Summary | Group by `defect.status`, count + percentage |
| `overdue` | Overdue Defects | Filter: status='Open' AND targetCloseDate < today |
| `critical` | Critical Defects | Filter: `critical === true` OR `is_coc === true` |
| `by-vessel` | Defects by Vessel | Group by `vesselName`, count open/closed |
| `by-equipment` | Defects by Equipment | Group by `equipmentCategory`, count + percentage |
| `monthly-trend` | Monthly Trend | Group by month (from `issueDate`), count created/closed/net |
| (default) | Defects Report | Return raw filtered defects |

### 9.3 Date Format Issue

The defect reports parse dates in DD-MM-YYYY format:
```javascript
new Date(d.targetCloseDate.split('-').reverse().join('-'))
```

This reverses DD-MM-YYYY to YYYY-MM-DD for `Date()` parsing. This approach is fragile and inconsistent with the ISO date format used elsewhere in the system.

---

## 10. Running Hours Reports

### 10.1 Equipment Utilization Summary

**Endpoint:** `GET /technical/api/reports/equipment-utilization-summary`

**Parameters:** `vesselId, startDate, endDate, category, department`

**Data Sources:**
- `components` table (filtered by `rhCounterType`)
- `component_running_hours_log` table (period-filtered RH snapshots)

**Processing:**
1. Filter components with RH tracking (`rhCounterType` not 'Not RH Driven')
2. Apply category/department filters
3. Query `component_running_hours_log` by vesselCode
4. Calculate utilization metrics per component within the date range

### 10.2 Running Hours Anomaly Detection

**Endpoint:** `GET /technical/api/reports/running-hours-anomaly-detection`

**Parameters:** `vesselId, startDate, endDate, anomalyType, severity`

**Data Sources:**
- `running_hours_audit` table (filtered by `enteredAtUTC`)

**Processing:**
1. Query audit logs for vesselId
2. Filter by date range (default: last 90 days)
3. Group by component
4. Analyze patterns for anomalies (spikes, drops, missing data)
5. Classify severity

---

## 11. Frontend Report Consumption Patterns

### 11.1 Report Module Architecture

The frontend report system is organized into these page components:

| Page | Lines | Primary Data Source |
|------|-------|-------------------|
| `MaintenanceReports.tsx` | 1,641 | Work orders + jobs (TanStack Query) |
| `MaintenancePlanner.tsx` | 955 | Planner API endpoint |
| `SparesReports.tsx` | 640 | Spares API |
| `ComplianceReports.tsx` | 559 | Certificates + Surveys APIs |
| `RunningHoursReports.tsx` | 552 | Components + RH APIs |
| `StoresReports.tsx` | 539 | Stores API |
| `AlertsApprovalsAdminReports.tsx` | 523 | Work orders + settings |
| `LowStockAlertReport.tsx` | 422 | Spares API |
| `ChangeRequestReports.tsx` | 383 | Change requests API |
| `IhmReports.tsx` | 382 | IHM data |
| `ReportsModule.tsx` | 378 | Navigation hub |

### 11.2 Data Fetching Patterns

**Pattern 1: TanStack Query for base data + client-side processing**
```typescript
// MaintenanceReports.tsx - loads ALL work orders then filters client-side
const { data: workOrders = [] } = useQuery<any[]>({
  queryKey: ['/technical/api/work-orders', effectiveVesselId],
  queryFn: async () => {
    const response = await fetch(url);
    return response.json();
  }
});
// Also loads jobs via useQuery for cross-referencing
const { data: jobs = [] } = useQuery<any[]>({
  queryKey: ['/technical/api/jobs', effectiveVesselId],
  ...
});
// Then filters/aggregates client-side for different report tabs
```

**Pattern 2: Direct fetch for Excel report downloads**
```typescript
// MaintenanceReports.tsx, RunningHoursReports.tsx
// Used for generating Excel exports on demand
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ vesselId, dateFrom, dateTo })
});
const blob = await response.blob();
// Trigger browser download
```

**Pattern 3: Direct fetch for JSON visualization data**
```typescript
// Both MaintenanceReports.tsx AND RunningHoursReports.tsx fetch these directly
// (not via useQuery, using raw fetch instead)
const response = await fetch(
  `/technical/api/reports/equipment-utilization-summary?${params}`
);
const result = await response.json();

// Similarly for anomaly detection:
const response = await fetch(
  `/technical/api/reports/running-hours-anomaly-detection?${params}`
);
```

**Pattern 4: TanStack Query for compliance data**
```typescript
// ComplianceReports.tsx - simple query, minimal client processing
const { data: certificates = [] } = useQuery<any[]>({
  queryKey: ['/technical/api/certificates', effectiveVesselId],
});
const { data: surveys = [] } = useQuery<any[]>({
  queryKey: ['/technical/api/surveys', effectiveVesselId],
});
```

### 11.3 Client-Side Computation

`MaintenanceReports.tsx` fetches all work orders for a vessel and performs significant client-side filtering and aggregation:

- Tab-based views (Overdue, Due, Completed, etc.)
- Real-time status badge counts
- Critical equipment filtering
- Department and rank breakdowns

This duplicates some of the server-side report logic, creating a risk of count mismatches between the UI tabs and the Excel downloads.

---

## 12. Storage Layer and Query Patterns

### 12.1 Storage Interface (IStorage)

Report-relevant methods from `server/storage.ts`:

```typescript
interface IStorage {
  // Primary data fetchers for reports
  getWorkOrders(vesselId?: string): Promise<WorkOrder[]>;
  getJobs(vesselId?: string, componentId?: string): Promise<Job[]>;
  getComponents(vesselId: string): Promise<Component[]>;
  getSpares(vesselId?: string): Promise<Spare[]>;
  getVessels(): Promise<Vessel[]>;
  getDefects(filters?: DefectFilters): Promise<Defect[]>;

  // Relational lookups
  getJobComponentLinks(vesselId: string): Promise<JobComponentLink[]>;
  getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]>;
  
  // Audit/history
  getWorkOrderPostponements(vesselId: string, filters?: PostponementFilters): Promise<WorkOrderPostponement[]>;
  
  // Batch lookups
  getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, Component>>;
  getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, Job>>;
  
  // Configuration
  getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | null>;
}
```

### 12.2 Query Pattern Analysis

**Typical report data loading pattern:**
```
Every report endpoint loads the same base data set:
1. storage.getWorkOrders(vesselId)     -- ALL work orders for vessel
2. storage.getJobs(vesselId)           -- ALL jobs for vessel
3. storage.getComponents(vesselId)     -- ALL components for vessel
4. storage.getVessels()                -- ALL vessels (just for name lookup!)
```

**Problem:** This fetches entire tables into memory and filters in JavaScript. For large vessels with thousands of work orders, this creates significant memory pressure.

### 12.3 Lookup Map Construction

Reports consistently build lookup maps for cross-referencing:

```typescript
const jobsMap = new Map(jobs.map(job => [job.id, job]));
const componentsByCodeMap = new Map(components.map(comp => [comp.componentCode, comp]));
const componentsMap = new Map(components.map(comp => [comp.id, comp]));
```

This pattern is repeated identically in every report endpoint (6+ times).

---

## 13. Architectural Issues and Recommendations

### 13.1 Critical Issues

#### ISSUE-1: Duplicated Date Parsing Logic
**Severity:** High
**Description:** The `parseDate` helper function is defined locally inside 4+ report endpoints with identical logic. Each handles ISO, DD-MMM-YYYY, and fallback formats.
**Impact:** Bug fixes must be applied to every copy. Risk of drift.
**Recommendation:** Extract to a shared utility module (partially exists in `shared/utils/dateCalculations.ts` but not used in reports).

#### ISSUE-2: Full-Table Scans for Every Report
**Severity:** High
**Description:** Every report loads ALL work orders, ALL jobs, and ALL components for a vessel into memory, then filters in JavaScript.
**Impact:** O(n) memory for each report, poor performance with large vessels.
**Recommendation:** Push filtering to the database layer via parameterized queries. For example, the Overdue report could use `WHERE status != 'Completed' AND dueDate < NOW()`.

#### ISSUE-3: `storage.getVessels()` Called for Name Lookup
**Severity:** Medium
**Description:** Every report calls `storage.getVessels()` (loads ALL vessels globally) just to find one vessel's name.
**Impact:** Unnecessary data transfer on every report.
**Recommendation:** Add `storage.getVessel(vesselId)` or cache vessel names.

#### ISSUE-4: Status Logic Divergence Between Planner and Work Order Reports
**Severity:** High
**Description:** The Maintenance Planner uses its own status calculation (inline in routes.ts) with categories `OVERDUE|DUE_GRACE|DUE_SOON|FUTURE`, while Work Order reports use `computeWorkOrderStatus()` with categories `Active|Due|Due (Grace P)|Overdue`. These are conceptually similar but implemented differently.
**Impact:** Potential count mismatches between Planner view and Work Order reports for the same data.
**Recommendation:** Unify status calculation into a single shared function with configurable output format.

#### ISSUE-5: Self-Referencing HTTP Fetch in Planner Export
**Severity:** Medium
**Description:** The planner export endpoint calls `fetch('http://localhost:PORT/...')` to get planner data from its own server.
**Impact:** Fails in environments where localhost is not resolvable. Creates unnecessary HTTP overhead. Port mismatch risk.
**Recommendation:** Extract planner computation into a shared function callable by both endpoints.

### 13.2 Moderate Issues

#### ISSUE-6: JSON Columns for Structured Data
**Description:** `jobs.requiredSpareParts` is a JSONB array. `vesselCertificateData.attachments` and `vesselSurveyData.attachments` are JSONB arrays.
**Impact:** Cannot be indexed or queried efficiently. Schema integrity not enforced.
**Recommendation:** For `requiredSpareParts`, consider a junction table `job_required_spares` with proper foreign keys.

#### ISSUE-7: Text Types for Dates and Numbers
**Description:** Fields like `dueDate`, `currentCumulativeRH`, `manhours`, `frequencyValue` are stored as `text` rather than proper `date`/`numeric` types.
**Impact:** Requires runtime parsing in every report. Risk of format inconsistencies (DD-MMM-YYYY vs ISO vs DD-MM-YYYY).
**Recommendation:** Migrate to proper types with a standardized format.

#### ISSUE-8: Deprecated Fields Still in Use
**Description:** `jobs.componentId` and `jobs.componentCode` are deprecated in favor of `job_component_links`, but the Maintenance Planner still uses them as fallback.
**Impact:** Dual code paths increase complexity.
**Recommendation:** Complete migration and remove deprecated fields after verification.

#### ISSUE-9: Client-Side Report Logic Duplication
**Description:** `MaintenanceReports.tsx` (1,641 lines) performs significant filtering and aggregation on raw work order data that duplicates server-side report logic.
**Impact:** Count mismatches between UI tabs and Excel downloads. Bug fixes needed in two places.
**Recommendation:** Have the frontend consume pre-computed report endpoints rather than raw data.

#### ISSUE-10: Inconsistent Date Formats Across Tables
**Description:** Some tables use ISO (YYYY-MM-DD), others DD-MMM-YYYY, others store timestamps as text strings.
**Impact:** Every report needs multi-format date parsing.
**Recommendation:** Standardize on ISO 8601 for all new data; migrate existing data.

### 13.3 Minor Issues

#### ISSUE-11: Excessive Debug Logging
**Description:** Report endpoints contain extensive `console.log` statements with emoji prefixes, debug stats, and filtering breakdowns.
**Impact:** Log noise in production.
**Recommendation:** Use a structured logger with configurable levels.

#### ISSUE-12: `parseRH` Helper Duplication
**Description:** Same `parseRH` function defined locally in multiple endpoints.
**Recommendation:** Extract to shared utility.

#### ISSUE-13: No Pagination for Large Datasets
**Description:** Reports return all matching records with no pagination or streaming.
**Impact:** Memory issues for large Excel files.
**Recommendation:** Consider streaming Excel generation for large datasets.

---

## 14. Appendix: Threshold Constants

**Source of Truth:** `shared/workOrders/constants.ts`

| Constant | Value | Description |
|----------|-------|-------------|
| `CALENDAR_LEAD_TIME_DAYS` | 30 | Days before due when status becomes "Due" |
| `RH_LEAD_TIME_HOURS` | 720 | RH before due when status becomes "Due" |
| `RH_GRACE_PERIOD_HOURS` | 168 | RH grace period (7-day equivalent) |
| `CALENDAR_GRACE_PERIOD_DAYS` | 7 | Min fixed grace for calendar jobs |
| `RH_LEAD_TIME_HOURS_CRITICAL` | 720 | RH lead time for critical equipment |
| `RH_LEAD_TIME_HOURS_NON_CRITICAL` | 720 | RH lead time for non-critical |
| `CALENDAR_LEAD_TIME_DAYS_CRITICAL` | 7 | Calendar lead time for critical jobs |
| `CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL` | 14 | Calendar lead time for non-critical jobs |

**Per-Vessel Overrides:** Stored in `pms_vessel_settings` table. When present, override the global constants above.

---

*End of Document*
