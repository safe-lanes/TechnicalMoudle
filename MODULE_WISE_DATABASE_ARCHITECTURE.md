# Seafarer PMS - Module-Wise Database Architecture Breakdown

> Detailed breakdown of PostgreSQL database architecture by functional module.
> **STATUS: ANALYSIS ONLY - DO NOT APPLY**

---

## Table of Contents

1. [PMS (Components)](#1-pms-components)
2. [PMS (Jobs)](#2-pms-jobs)
3. [PMS (Work Orders)](#3-pms-work-orders)
4. [Running Hours](#4-running-hours)
5. [Spares](#5-spares)
6. [Stores](#6-stores)
7. [Defects](#7-defects)
8. [Alerts](#8-alerts)
9. [Certificates & Surveys](#9-certificates--surveys)
10. [Change Requests (Modify PMS)](#10-change-requests-modify-pms)
11. [IHM (Inventory of Hazardous Materials)](#11-ihm-inventory-of-hazardous-materials)
12. [Form Engine](#12-form-engine)
13. [Fleet Admin](#13-fleet-admin)
14. [Master Data](#14-master-data)
15. [Import Engine](#15-import-engine)
16. [Audit Log](#16-audit-log)
17. [Fleet Sync & Vessel Mapping](#17-fleet-sync--vessel-mapping)
18. [Core Reference Data](#18-core-reference-data)

---

## 1. PMS (Components)

### Module Overview
The Components module manages the equipment registry for vessels and fleet. It handles hierarchical equipment structures, technical specifications, maker/model associations, and links to documents, class/regulatory surveys, maintenance history, and requisitions.

### Tables Used

| Table | Purpose |
|-------|---------|
| `components` | Primary equipment registry (vessel & fleet scope) |
| `component_documents` | Technical documents, manuals, drawings |
| `component_class_regulatory` | Classification society and survey records |
| `component_maintenance_history` | Immutable maintenance audit trail |
| `component_requisitions` | Purchase/service requisitions |
| `component_running_hours_log` | Detailed RH update audit trail |

### Relationships Inside Module

```
components (parent_id → components.id)  [Self-referential hierarchy]
    │
    ├── component_documents.component_id → components.id
    ├── component_class_regulatory.component_id → components.id
    ├── component_maintenance_history.component_id → components.id
    ├── component_requisitions.component_id → components.id
    └── component_running_hours_log.component_id → components.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Jobs** | `jobs.component_id` → `components.id` |
| **Work Orders** | `work_orders.component` references component name |
| **Spares** | `spares.component_id` → `components.id` |
| **Defects** | `defects.component_id` → `components.id` (optional) |
| **IHM** | `ihm_items.component_id` → `components.id` |
| **Running Hours** | `running_hours_audit.component_id` → `components.id` |
| **Fleet Mapping** | `fleet_component_mapping.component_id` → `components.id` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `components[]` | `components.*` |
| `componentDocuments[]` | `component_documents.*` |
| `component.classRegulatory[]` | `component_class_regulatory.*` |
| `component.maintenanceHistory[]` | `component_maintenance_history.*` |
| `component.requisitions[]` | `component_requisitions.*` |
| `component.rhLog[]` | `component_running_hours_log.*` |

### Transaction Boundaries

1. **Create Component with Documents** - Single transaction:
   - INSERT into `components`
   - INSERT into `component_documents` (multiple rows)
   
2. **Move Component in Hierarchy** - Single transaction:
   - UPDATE `components.parent_id`
   - UPDATE all child `components.parent_id` (cascade)
   - INSERT `audit_log` entry
   
3. **Complete Component Replacement** - Single transaction:
   - INSERT `component_maintenance_history` with `is_component_replaced=true`
   - UPDATE `components` (new serial, maker, model)
   - INSERT `audit_log` entry

### Constraints & Integrity Rules

- `components.fleet_equipment_code` + `data_scope` must be unique (when not null)
- `components.component_code` should be unique within vessel scope
- `component_maintenance_history` is **IMMUTABLE** - no updates or deletes allowed
- Self-referential `parent_id` must not create circular references
- When `data_scope='vessel'`, `vessel_id` is required
- When `data_scope='fleet'`, `vessel_id` should be null

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `applicable_vessel_ids` | Keep as TEXT[] | Simple string array, no complex queries needed |

### Operations Affecting DB

1. Create component → INSERT `components` + INSERT `audit_log`
2. Update component → UPDATE `components` + INSERT `audit_log`
3. Delete component → Check FK dependencies → Soft delete via `is_active=false`
4. Upload document → INSERT `component_documents` + INSERT `audit_log`
5. Add class survey → INSERT `component_class_regulatory`
6. Complete maintenance → INSERT `component_maintenance_history` (immutable)
7. Update running hours → UPDATE `components.current_cumulative_rh` + INSERT `component_running_hours_log`

---

## 2. PMS (Jobs)

### Module Overview
The Jobs module manages maintenance job templates/blueprints linked to components. Jobs define the "what, when, and how" of maintenance tasks including frequency, safety requirements, and required spares/tools.

### Tables Used

| Table | Purpose |
|-------|---------|
| `jobs` | Job templates with scheduling configuration |

### Relationships Inside Module

Jobs is a single-table module with no internal relationships.

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `jobs.component_id` → `components.id` |
| **Work Orders** | `work_orders.job_id` → `jobs.id` |
| **Fleet Mapping** | `fleet_job_vessel_mapping.job_id` → `jobs.id` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `jobs[]` | `jobs.*` |
| `job.requiredSpareParts` | `jobs.required_spare_parts` (JSONB) |
| `job.requiredTools` | `jobs.required_tools` (JSONB) |
| `job.safetyRequirements` | `jobs.safety_requirements` (JSONB) |

### Transaction Boundaries

1. **Create Job** - Single INSERT + audit
2. **Update Job Frequency** - UPDATE `jobs` + recalculate `next_due_date` or `next_due_rh`
3. **Clone Job to Vessels** - Batch INSERT for multiple vessel-specific jobs

### Constraints & Integrity Rules

- `jobs.job_no` must be globally unique
- `jobs.component_id` must reference valid component
- When `maintenance_basis='Calendar'`, `frequency_value` + `frequency_unit` required
- When `maintenance_basis='Running Hours'`, `interval_running_hour` required
- `fleet_job_code` + `data_scope` must be unique

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `required_spare_parts` | Keep as JSONB | Template data, rarely queried independently |
| `required_tools` | Keep as JSONB | Template data, simple structure |
| `safety_requirements` | Keep as JSONB | Nested structure {ppeRequirements, permitRequirements, otherRequirements} |

### Operations Affecting DB

1. Create job → INSERT `jobs` + INSERT `audit_log`
2. Update job → UPDATE `jobs` + INSERT `audit_log`
3. Delete job → Check for active work orders → Soft delete via `is_active=false`
4. Job Due Scanner → SELECT jobs with due calculations → May generate work orders

---

## 3. PMS (Work Orders)

### Module Overview
Work Orders are the execution layer of maintenance. They track planned/unplanned maintenance from creation through completion and approval. Work orders can be generated from jobs (planned) or created ad-hoc (unplanned).

### Tables Used

| Table | Purpose |
|-------|---------|
| `work_orders` | Main work order records |
| `work_order_executions` | Historical execution records |

### Relationships Inside Module

```
work_orders.template_id → work_order_executions.template_id (one-to-many)
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `work_orders.component_code` references component |
| **Jobs** | `work_orders.job_id` → `jobs.id` |
| **Running Hours** | Completion updates component running hours |
| **Maintenance History** | Approval creates `component_maintenance_history` entry |
| **IHM** | `ihm_maintenance_log.work_order_id` → `work_orders.id` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `workOrders[]` | `work_orders.*` |
| `workOrder.requiredSpareParts` | `work_orders.required_spare_parts` (JSONB) |
| `workOrder.requiredTools` | `work_orders.required_tools` (JSONB) |
| `workOrder.safetyRequirements` | `work_orders.safety_requirements` (JSONB) |
| `workOrder.uploadedDocuments` | `work_orders.uploaded_documents` (JSONB) |
| `workOrder.consumedSpareParts` | `work_orders.consumed_spare_parts` (JSONB) |
| `workOrder.formData` | `work_orders.form_data` (JSONB) |
| `workOrderExecutions[]` | `work_order_executions.*` |

### Transaction Boundaries

1. **Create Work Order from Job** - Single transaction:
   - INSERT `work_orders` (copy template data from job)
   - UPDATE `jobs.last_done_date` or `jobs.last_done_rh`
   
2. **Submit Work Order for Approval** - Single transaction:
   - UPDATE `work_orders.status` = 'Pending Approval'
   - UPDATE `work_orders.submitted_date`
   
3. **Approve Work Order** - Single transaction:
   - UPDATE `work_orders.status` = 'Completed'
   - INSERT `component_maintenance_history` (immutable record)
   - UPDATE `spares.rob` for consumed parts
   - INSERT `spares_history` for each consumption
   - UPDATE `jobs.next_due_date` or `jobs.next_due_rh`
   - INSERT `audit_log`

4. **Postpone Work Order** - Single transaction:
   - UPDATE `work_orders.status` = 'Postponed'
   - UPDATE `work_orders.postponement_end_date`, `postponement_reason`
   - INSERT `audit_log`

### Constraints & Integrity Rules

- `work_orders.work_order_no` must be unique per vessel
- `fleet_job_code` + `data_scope` must be unique
- Status transitions: Active → Due → Overdue → Pending Approval → Completed
- Alternative: Active → Postponed (returns to Due when end date reached)
- Completed work orders cannot be edited
- Grace period logic controlled by `pms_vessel_settings`

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `required_spare_parts` | Keep as JSONB | Template data, copied from job |
| `required_tools` | Keep as JSONB | Template data, simple list |
| `safety_requirements` | Keep as JSONB | Nested structure |
| `uploaded_documents` | Keep as JSONB | Array of file references |
| `consumed_spare_parts` | Keep as JSONB | Captured at completion, queried via history |
| `form_data` | Keep as JSONB | Dynamic form submission |

### Operations Affecting DB

1. Auto-generate from due job → INSERT `work_orders`
2. Create unplanned WO → INSERT `work_orders` with `work_order_type='Unplanned'`
3. Update execution fields → UPDATE `work_orders` (Part B fields)
4. Submit for approval → UPDATE `work_orders.status`
5. Approve → UPDATE `work_orders` + INSERT `component_maintenance_history` + UPDATE `spares` + UPDATE `jobs`
6. Reject → UPDATE `work_orders.status` + `rejection_comments`
7. Postpone → UPDATE `work_orders.status`, `postponement_*` fields

---

## 4. Running Hours

### Module Overview
Tracks equipment runtime for condition-based maintenance. Running hours cascade from parent equipment to children and trigger due date recalculations for RH-based jobs.

### Tables Used

| Table | Purpose |
|-------|---------|
| `running_hours_audit` | Primary audit trail for RH updates |
| `component_running_hours_log` | Detailed RH change log |
| `components` | Stores `current_cumulative_rh` |

### Relationships Inside Module

```
running_hours_audit.component_id → components.id
component_running_hours_log.component_id → components.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | Updates `components.current_cumulative_rh` |
| **Jobs** | Triggers recalculation of `jobs.next_due_rh` |
| **Work Orders** | Completion may include RH reading |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `runningHoursAudit[]` | `running_hours_audit.*` |
| `component.currentCumulativeRH` | `components.current_cumulative_rh` |
| `rhLog[]` | `component_running_hours_log.*` |

### Transaction Boundaries

1. **Single RH Update** - Single transaction:
   - UPDATE `components.current_cumulative_rh`
   - INSERT `running_hours_audit`
   - INSERT `component_running_hours_log`
   - UPDATE affected `jobs.next_due_rh` (for RH-based jobs)
   
2. **Cascade RH Update (Parent)** - Single transaction:
   - UPDATE parent `components.current_cumulative_rh`
   - UPDATE all child `components.current_cumulative_rh`
   - INSERT `running_hours_audit` for parent
   - INSERT `component_running_hours_log` for parent + all children
   - Recalculate all affected `jobs.next_due_rh`

3. **Meter Replacement** - Single transaction:
   - INSERT `running_hours_audit` with `meter_replaced=true`
   - Record `old_meter_final` and `new_meter_start`
   - UPDATE `components.current_cumulative_rh` to cumulative value

### Constraints & Integrity Rules

- `running_hours_audit` is append-only (no updates/deletes)
- `new_rh` should generally be >= `previous_rh` (except meter replacement)
- `cumulative_rh` is always increasing
- Cascade updates must process parent before children
- Version field supports optimistic concurrency

### JSONB vs Normalization Decision

No JSONB fields in this module.

### Operations Affecting DB

1. Single update → UPDATE `components` + INSERT `running_hours_audit` + INSERT `component_running_hours_log`
2. Bulk update → Loop single updates in transaction
3. Cascade to children → Recursive UPDATE + multiple INSERTs
4. Query history → SELECT from `running_hours_audit` with component filter
5. Meter replacement → Special INSERT with `meter_replaced=true`

---

## 5. Spares

### Module Overview
Manages spare parts inventory linked to components. Tracks stock levels (ROB) across two locations, consumption via work orders, and procurement history.

### Tables Used

| Table | Purpose |
|-------|---------|
| `spares` | Spare parts inventory |
| `spares_history` | Transaction history (consume, receive, adjust) |

### Relationships Inside Module

```
spares_history.spare_id → spares.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `spares.component_id` → `components.id` |
| **Work Orders** | `consumed_spare_parts` JSONB references spare codes |
| **IHM** | `ihm_items.spare_id` → `spares.id` (for hazmat tracking) |
| **Fleet Mapping** | `fleet_spare_vessel_mapping.spare_id` references spares |
| **Component Requisitions** | `component_requisitions.related_part_code` references spare |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `spares[]` | `spares.*` |
| `sparesHistory[]` | `spares_history.*` |

### Transaction Boundaries

1. **Consume Spare (via WO completion)** - Single transaction:
   - UPDATE `spares.rob`, `rob_location_a` or `rob_location_b`
   - INSERT `spares_history` with `event_type='CONSUME'`
   
2. **Receive Spare** - Single transaction:
   - UPDATE `spares.rob`, `rob_location_a` or `rob_location_b`
   - INSERT `spares_history` with `event_type='RECEIVE'`
   
3. **Adjust Stock** - Single transaction:
   - UPDATE `spares.rob`
   - INSERT `spares_history` with `event_type='ADJUST'`

4. **Transfer Between Locations** - Single transaction:
   - UPDATE `spares.rob_location_a`, `rob_location_b`
   - INSERT `spares_history` with `event_type='TRANSFER_OUT'`
   - INSERT `spares_history` with `event_type='TRANSFER_IN'`

### Constraints & Integrity Rules

- `spares.rob` = `rob_location_a` + `rob_location_b`
- `fleet_part_code` + `data_scope` must be unique
- Soft delete via `deleted=true` (preserves history)
- `critical` value determines low-stock alert thresholds
- When `rob < min`, trigger low-stock alert

### JSONB vs Normalization Decision

No JSONB fields - all data is normalized.

### Operations Affecting DB

1. Create spare → INSERT `spares` + INSERT `spares_history` (CREATE event)
2. Edit spare → UPDATE `spares` + INSERT `spares_history` (EDIT event)
3. Consume → UPDATE `spares.rob` + INSERT `spares_history` (CONSUME)
4. Receive → UPDATE `spares.rob` + INSERT `spares_history` (RECEIVE)
5. Link to component → UPDATE `spares.component_id` + INSERT `spares_history` (LINK_CREATED)
6. Delete → UPDATE `spares.deleted=true` (soft delete)

---

## 6. Stores

### Module Overview
Manages general stores, lubricants, chemicals, and other consumables. **Completely isolated from PMS module** - no links to components, jobs, or work orders per Global Business Rule Section 7.2.

### Tables Used

| Table | Purpose |
|-------|---------|
| `stores_items` | Stores inventory items |
| `stores_ledger` | Transaction history ledger |

### Relationships Inside Module

```
stores_ledger.item_id → stores_items.id
```

### Relationships to Other Modules

**NONE** - Stores is intentionally isolated from:
- Components (no component_id)
- Work Orders (no work_order_id)
- Jobs (no job_id)

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `storesItems[]` | `stores_items.*` |
| `storesLedger[]` | `stores_ledger.*` |

### Transaction Boundaries

1. **Consume Stores Item** - Single transaction:
   - UPDATE `stores_items.rob`, `rob_location_a` or `rob_location_b`
   - INSERT `stores_ledger` with `event_type='CONSUME'`
   
2. **Receive Stores Item** - Single transaction:
   - UPDATE `stores_items.rob`, `rob_location_a` or `rob_location_b`
   - INSERT `stores_ledger` with `event_type='RECEIVE'`

### Constraints & Integrity Rules

- No PMS linkages allowed (enforced at application level)
- `stores_items.item_code` must be unique per vessel
- `stores_items.rob` = `rob_location_a` + `rob_location_b`
- IHM flag tracks hazardous materials
- Soft delete via `deleted=true`

### JSONB vs Normalization Decision

No JSONB fields - all data is normalized.

### Operations Affecting DB

1. Create item → INSERT `stores_items`
2. Edit item → UPDATE `stores_items`
3. Consume → UPDATE `stores_items.rob` + INSERT `stores_ledger`
4. Receive → UPDATE `stores_items.rob` + INSERT `stores_ledger`
5. Archive → UPDATE `stores_items.deleted=true` + INSERT `stores_ledger` (ARCHIVE)

---

## 7. Defects

### Module Overview
Tracks defects, Conditions of Class (COC), observations, and non-conformity reports. Includes root cause analysis, corrective/preventive actions, and recurring defect detection.

### Tables Used

| Table | Purpose |
|-------|---------|
| `defects` | Main defect records |
| `defect_actions` | Corrective/preventive action items |
| `defect_attachments` | Photos and documents |
| `recurring_defects` | Aggregated recurring defect groups |
| `recurring_defect_links` | Links defects to recurring groups |

### Relationships Inside Module

```
defects
    ├── defect_actions.defect_id → defects.id
    ├── defect_attachments.defect_id → defects.id
    └── recurring_defect_links.defect_id → defects.id
            └── recurring_defect_links.recurring_id → recurring_defects.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `defects.component_id` → `components.id` (optional) |
| **Vessels** | `defects.vessel_id` → `vessels.id` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `defects[]` | `defects.*` |
| `defect.actions[]` | `defects.actions` (inline JSONB) OR `defect_actions.*` |
| `defect.attachments[]` | `defects.attachments` (inline JSONB) OR `defect_attachments.*` |
| `defect.notes[]` | `defects.notes` (JSONB) |
| `defect.auditTrail[]` | `defects.audit_trail` (JSONB) |
| `defect.immediateCause` | `defects.immediate_cause` (JSONB) |
| `defect.rootCause` | `defects.root_cause` (JSONB) |
| `recurringDefects[]` | `recurring_defects.*` |

### Transaction Boundaries

1. **Create Defect with Actions** - Single transaction:
   - INSERT `defects`
   - INSERT `defect_actions` (multiple)
   - INSERT `defect_attachments` (multiple)
   - INSERT `audit_log`
   
2. **Close Defect** - Single transaction:
   - UPDATE `defects.status`, `closed_by`, `closed_on`
   - INSERT `audit_log`
   - UPDATE `recurring_defects` stats if applicable

3. **Link to Recurring Group** - Single transaction:
   - INSERT or UPDATE `recurring_defects`
   - INSERT `recurring_defect_links`

### Constraints & Integrity Rules

- `defects.category` must be one of: 'Defect', 'COC', 'Observation', 'NCR'
- COC defects have `is_coc=true`
- Critical defects have `critical=true`
- Actions have required due dates
- Recurring defect detection runs on equipment_key match within window_months

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `notes` | Keep as JSONB | Simple nested array, form wizard inline |
| `actions` | **Dual storage** | Inline JSONB for form + normalized `defect_actions` for queries |
| `attachments` | **Dual storage** | Inline JSONB for form + normalized `defect_attachments` for file management |
| `audit_trail` | Keep as JSONB | Append-only, rarely queried |
| `immediate_cause` | Keep as JSONB | Complex nested structure |
| `root_cause` | Keep as JSONB | Complex nested structure |
| `linked_defects` | Keep as TEXT[] | Simple string array |
| `closure_files` | Keep as TEXT[] | Simple URL array |

### Operations Affecting DB

1. Create defect → INSERT `defects` (may include inline JSONB for actions/attachments)
2. Add action → INSERT `defect_actions` + UPDATE `defects.actions` JSONB
3. Upload attachment → INSERT `defect_attachments` + UPDATE `defects.attachments` JSONB
4. Add note → UPDATE `defects.notes` JSONB (append)
5. Change status → UPDATE `defects.status` + append to `audit_trail`
6. Close defect → UPDATE multiple fields + final audit entry
7. Detect recurring → UPSERT `recurring_defects` + INSERT `recurring_defect_links`

---

## 8. Alerts

### Module Overview
Notification system for maintenance due, certificate expiry, low inventory, and system events. Supports email and in-app delivery with quiet hours and escalation.

### Tables Used

| Table | Purpose |
|-------|---------|
| `alert_policies` | Alert configuration rules |
| `alert_events` | Generated alert instances |
| `alert_deliveries` | Delivery tracking per channel |
| `alert_config` | Per-vessel quiet hours and escalation settings |

### Relationships Inside Module

```
alert_policies
    └── alert_events.policy_id → alert_policies.id
            └── alert_deliveries.event_id → alert_events.id

alert_config (per vessel settings)
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Work Orders** | Events reference `object_type='work_order'` |
| **Components** | Events reference `object_type='component'` |
| **Spares** | Events reference `object_type='spare'` |
| **Certificates** | Events reference `object_type='certificate'` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `alertPolicies[]` | `alert_policies.*` |
| `alertPolicies[].thresholds` | `alert_policies.thresholds` (JSON string) |
| `alertPolicies[].scopeFilters` | `alert_policies.scope_filters` (JSON string) |
| `alertPolicies[].recipients` | `alert_policies.recipients` (JSON string) |
| `alertEvents[]` | `alert_events.*` |
| `alertEvents[].payload` | `alert_events.payload` (JSON string) |
| `alertDeliveries[]` | `alert_deliveries.*` |
| `alertConfig[]` | `alert_config.*` |

### Transaction Boundaries

1. **Generate Alert Event** - Single transaction:
   - Check deduplication via `dedupe_key`
   - INSERT `alert_events`
   - INSERT `alert_deliveries` for each configured channel
   
2. **Acknowledge Alert** - Single transaction:
   - UPDATE `alert_events.ack_by`, `ack_at`
   - UPDATE `alert_deliveries.status` = 'acknowledged'

### Constraints & Integrity Rules

- `alert_events.dedupe_key` prevents duplicate alerts
- Alert types: 'maintenance_due', 'running_hours', 'critical_inventory', 'certificate_expiration', 'system_backup'
- Quiet hours respect vessel timezone
- Escalation triggers after `escalation_hours` without acknowledgment

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `thresholds` | Keep as JSON string | Type-specific, varies by alert type |
| `scope_filters` | Keep as JSON string | Flexible filter conditions |
| `recipients` | Keep as JSON string | User/role lists |
| `payload` | Keep as JSON string | Event-specific details |
| `escalation_recipients` | Keep as JSON string | Array of recipient configs |

### Operations Affecting DB

1. Create policy → INSERT `alert_policies`
2. Scanner runs → For each match: INSERT `alert_events` + INSERT `alert_deliveries`
3. Send delivery → UPDATE `alert_deliveries.status`, `sent_at`
4. Acknowledge → UPDATE `alert_events` + UPDATE `alert_deliveries`
5. Escalate → INSERT new `alert_deliveries` for escalation recipients

---

## 9. Certificates & Surveys

### Module Overview
Tracks classification society surveys, statutory certificates, and regulatory compliance for components. Stored in `component_class_regulatory` table.

### Tables Used

| Table | Purpose |
|-------|---------|
| `component_class_regulatory` | Survey and certificate records |

### Relationships Inside Module

Single table - no internal relationships.

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `component_class_regulatory.component_id` → `components.id` |
| **Alerts** | Certificate expiry triggers alerts |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `component.classRegulatory[]` | `component_class_regulatory.*` |

### Transaction Boundaries

1. **Add Survey Record** - Single INSERT
2. **Update Survey Status** - UPDATE with audit log

### Constraints & Integrity Rules

- `classification_society` must be valid society code
- `survey_status` values: 'Active', 'Expired', 'Pending', 'Cancelled'
- `expiry_date` triggers certificate expiration alerts
- Multiple surveys per component allowed (one-to-many)

### JSONB vs Normalization Decision

No JSONB fields - fully normalized.

### Operations Affecting DB

1. Add survey → INSERT `component_class_regulatory`
2. Update survey → UPDATE `component_class_regulatory`
3. Check expiry → SELECT with date comparison → Generate alerts

---

## 10. Change Requests (Modify PMS)

### Module Overview
Formal workflow for requesting changes to PMS data (components, work orders, spares, stores). Includes draft/submit/review/approve workflow with revision tracking.

### Tables Used

| Table | Purpose |
|-------|---------|
| `change_request` | Main change request records |
| `change_request_attachment` | Supporting documents |
| `change_request_comment` | Review comments |

### Relationships Inside Module

```
change_request
    ├── change_request_attachment.change_request_id → change_request.id
    └── change_request_comment.change_request_id → change_request.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `target_type='component'`, `target_id` references component |
| **Work Orders** | `target_type='work_order'`, `target_id` references work order |
| **Spares** | `target_type='spare'`, `target_id` references spare |
| **Stores** | `target_type='store'`, `target_id` references store item |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `changeRequests[]` | `change_request.*` |
| `changeRequest.snapshotBeforeJson` | `change_request.snapshot_before_json` (JSONB) |
| `changeRequest.proposedChangesJson` | `change_request.proposed_changes_json` (JSONB) |
| `changeRequest.movePreviewJson` | `change_request.move_preview_json` (JSONB) |
| `changeRequest.revisionHistory` | `change_request.revision_history` (JSONB) |
| `changeRequestAttachments[]` | `change_request_attachment.*` |
| `changeRequestComments[]` | `change_request_comment.*` |

### Transaction Boundaries

1. **Submit Change Request** - Single transaction:
   - UPDATE `change_request.status` = 'submitted'
   - UPDATE `change_request.submitted_at`
   
2. **Approve Change Request** - Single transaction:
   - UPDATE `change_request.status` = 'approved'
   - Apply changes to target entity (component/WO/spare/store)
   - INCREMENT `change_request.revision_number`
   - APPEND to `change_request.revision_history`
   - INSERT `audit_log`

### Constraints & Integrity Rules

- `category` must be: 'components', 'work_orders', 'spares', 'stores'
- Status workflow: draft → submitted → (returned | approved | rejected)
- `revision_number` increments on each approval
- `snapshot_before_json` captures entity state at submission time
- Title max 120 characters (enforced in application)

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `snapshot_before_json` | Keep as JSONB | Full entity snapshot, structure varies |
| `proposed_changes_json` | Keep as JSONB | Array of field changes |
| `move_preview_json` | Keep as JSONB | Component move preview |
| `revision_history` | Keep as JSONB | Append-only revision log |

### Operations Affecting DB

1. Create draft → INSERT `change_request`
2. Add attachment → INSERT `change_request_attachment`
3. Add comment → INSERT `change_request_comment`
4. Submit → UPDATE `change_request.status`, `submitted_at`
5. Return for revision → UPDATE `change_request.status` = 'returned'
6. Approve → UPDATE `change_request` + Apply to target + INSERT `audit_log`
7. Reject → UPDATE `change_request.status` = 'rejected'

---

## 11. IHM (Inventory of Hazardous Materials)

### Module Overview
Tracks hazardous materials present in components and spares per Hong Kong Convention requirements. Logs material movements during maintenance.

### Tables Used

| Table | Purpose |
|-------|---------|
| `ihm_items` | Hazardous materials inventory per component/spare |
| `ihm_maintenance_log` | Material handling during work orders |

### Relationships Inside Module

```
ihm_items (component_id, spare_id)
ihm_maintenance_log (work_order_id links to work_orders)
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `ihm_items.component_id` → `components.id` |
| **Spares** | `ihm_items.spare_id` → `spares.id` |
| **Work Orders** | `ihm_maintenance_log.work_order_id` → `work_orders.id` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `ihmItems[]` | `ihm_items.*` |
| `ihm_items[].materials` | `ihm_items.materials` (TEXT[]) |
| `ihmMaintenanceLog[]` | `ihm_maintenance_log.*` |
| `ihmMaintenanceLog[].materials` | `ihm_maintenance_log.materials` (TEXT[]) |

### Transaction Boundaries

1. **Log IHM Activity on WO Completion** - Single transaction:
   - INSERT `ihm_maintenance_log`
   - UPDATE `ihm_items` if quantities changed

### Constraints & Integrity Rules

- `presence` must be: 'Unknown', 'Present', 'Not Present'
- `evidence_type` must be: 'MD', 'SDoC', 'Test', 'None'
- Material types: Asbestos, PCB, PFOS, etc. (standard list)
- Either `component_id` or `spare_id` required (not both null)

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `materials` | Keep as TEXT[] | Simple enum-like list |

### Operations Affecting DB

1. Add IHM item → INSERT `ihm_items`
2. Update presence → UPDATE `ihm_items`
3. Log maintenance → INSERT `ihm_maintenance_log`
4. Query by material type → SELECT with ARRAY contains

---

## 12. Form Engine

### Module Overview
Dynamic form configuration system for work orders and other modules. Supports versioned form schemas with publish/archive lifecycle.

### Tables Used

| Table | Purpose |
|-------|---------|
| `form_definitions` | Form type registry (ADD_COMPONENT, WO_PLANNED, etc.) |
| `form_versions` | Versioned form schemas |
| `form_version_usage` | Audit trail of form version usage |

### Relationships Inside Module

```
form_definitions
    └── form_versions.form_id → form_definitions.id
            └── form_version_usage.form_version_id → form_versions.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Work Orders** | `work_orders.form_data` stores submitted form data |
| **All Modules** | Forms can be used across any module |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `formDefinitions[]` | `form_definitions.*` |
| `formVersions[]` | `form_versions.*` |
| `formVersion.schemaJson` | `form_versions.schema_json` (JSON string) |
| `formVersionUsage[]` | `form_version_usage.*` |

### Transaction Boundaries

1. **Publish Form Version** - Single transaction:
   - UPDATE previous version `status` = 'ARCHIVED'
   - UPDATE new version `status` = 'PUBLISHED'

### Constraints & Integrity Rules

- `form_definitions.name` must be unique
- Only one 'PUBLISHED' version per form at a time
- Version numbers increment monotonically
- Schema changes require new version (no edit in place)

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `schema_json` | Keep as JSON string | Complex dynamic form schema |

### Operations Affecting DB

1. Create form → INSERT `form_definitions`
2. Create version → INSERT `form_versions` with status='DRAFT'
3. Publish → UPDATE `form_versions.status`
4. Use form → INSERT `form_version_usage`
5. Archive → UPDATE `form_versions.status` = 'ARCHIVED'

---

## 13. Fleet Admin

### Module Overview
Master data management for fleet-wide configuration including equipment manufacturers and dropdown options.

### Tables Used

| Table | Purpose |
|-------|---------|
| `makers` | Equipment manufacturer registry |
| `master_lists` | Dropdown option management |
| `fleet_equipment_master` | Normalized fleet equipment registry |

### Relationships Inside Module

No direct FK relationships - lookup tables.

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `components.maker_code` references `makers.maker_code` |
| **Spares** | `spares.maker_code` references makers |
| **All Modules** | `master_lists` provides dropdown options |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `makers[]` | `makers.*` |
| `masterLists[]` | `master_lists.*` |
| `fleetEquipmentMaster[]` | `fleet_equipment_master.*` |

### Transaction Boundaries

1. **Add Maker** - Single INSERT (auto-generate maker_code)
2. **Update Master List** - UPDATE with display_order maintenance

### Constraints & Integrity Rules

- `makers.maker_code` must be unique (auto-generated: MKR-000001)
- `master_lists.list_type` + `list_key` must be unique
- List types: 'department', 'rank', 'intervalUnit', etc.
- `display_order` controls dropdown ordering

### JSONB vs Normalization Decision

No JSONB fields - fully normalized.

### Operations Affecting DB

1. Add maker → INSERT `makers`
2. Edit maker → UPDATE `makers`
3. Add list item → INSERT `master_lists`
4. Reorder list → UPDATE multiple `master_lists.display_order`
5. Deactivate → UPDATE `is_active=false`

---

## 14. Master Data

### Module Overview
Centralized fleet equipment code generation and tracking. Links SFI codes, makers, and models to generate unique fleet equipment codes.

### Tables Used

| Table | Purpose |
|-------|---------|
| `maker_list` | Maker registry for master data |
| `sfi_details` | SFI code lookup table |
| `master_data` | Fleet equipment code generation |

### Relationships Inside Module

```
master_data.maker_code → maker_list.maker_code (logical)
master_data.sfi_code → sfi_details.component_code (logical)
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | `components.fleet_equipment_code` → `master_data.fleet_equipment_code` |
| **Fleet Mapping** | All mapping tables reference fleet equipment codes |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `makerList[]` | `maker_list.*` |
| `sfiDetails[]` | `sfi_details.*` |
| `masterData[]` | `master_data.*` |

### Transaction Boundaries

1. **Generate Fleet Equipment Code** - Single transaction:
   - Lookup SFI code
   - Lookup/create maker
   - Calculate next sequence
   - INSERT `master_data`

### Constraints & Integrity Rules

- `sfi_details.component_code` must be unique
- `master_data.fleet_equipment_code` must be unique
- Fleet equipment code format: SFI.SEQ (e.g., 722.001.AA)
- Model code = Maker Code + Model

### JSONB vs Normalization Decision

No JSONB fields - fully normalized.

### Operations Affecting DB

1. Add SFI code → INSERT `sfi_details`
2. Add maker → INSERT `maker_list`
3. Generate equipment code → INSERT `master_data`
4. Link to vessel → INSERT into fleet mapping tables

---

## 15. Import Engine

### Module Overview
Bulk data import system with undo capability. Tracks import history, individual record changes, and provides rollback functionality.

### Tables Used

| Table | Purpose |
|-------|---------|
| `import_history` | Import session records |
| `import_change_log` | Individual record changes for undo |
| `bulk_import_history` | Extended import tracking with file info |
| `bulk_import_errors` | Row-level error details |

### Relationships Inside Module

```
import_history
    └── import_change_log.import_history_id → import_history.id

bulk_import_history
    └── bulk_import_errors.import_id → bulk_import_history.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | Import creates/updates components |
| **Jobs** | Import creates/updates jobs |
| **Spares** | Import creates/updates spares |
| **Stores** | Import creates/updates stores |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `importHistory[]` | `import_history.*` |
| `importChangeLog[]` | `import_change_log.*` |
| `importChangeLog[].previousData` | `import_change_log.previous_data` (JSONB) |
| `importChangeLog[].newData` | `import_change_log.new_data` (JSONB) |
| `bulkImportHistory[]` | `bulk_import_history.*` |
| `bulkImportErrors[]` | `bulk_import_errors.*` |
| `bulkImportErrors[].rawRowData` | `bulk_import_errors.raw_row_data` (JSONB) |

### Transaction Boundaries

1. **Execute Import** - Single transaction per batch:
   - INSERT `import_history` with status='processing'
   - For each row: INSERT/UPDATE entity + INSERT `import_change_log`
   - UPDATE `import_history` counts and status
   
2. **Undo Import** - Single transaction:
   - SELECT `import_change_log` for import
   - Reverse each change (restore `previous_data`)
   - UPDATE `import_history.status` = 'undone'

### Constraints & Integrity Rules

- `import_history.type` must be: 'components', 'spares', 'stores', 'jobs'
- `import_history.mode` must be: 'add', 'update', 'upsert'
- `import_change_log.checksum` enables conflict detection
- Only 'complete' imports can be undone
- Archive missing mode removes unmatched records

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `previous_data` | Keep as JSONB | Full entity snapshot for undo |
| `new_data` | Keep as JSONB | Minimal change record |
| `raw_row_data` | Keep as JSONB | Original Excel row for debugging |

### Operations Affecting DB

1. Start import → INSERT `import_history`
2. Process row → INSERT/UPDATE target + INSERT `import_change_log`
3. Log error → INSERT `bulk_import_errors`
4. Complete → UPDATE `import_history.status`, counts
5. Undo → Reverse `import_change_log` entries + UPDATE `import_history`

---

## 16. Audit Log

### Module Overview
System-wide audit trail for all data changes. Captures who, what, when, and before/after values for every mutation.

### Tables Used

| Table | Purpose |
|-------|---------|
| `audit_log` | Central audit trail |

### Relationships Inside Module

Single table - no internal relationships.

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **All Modules** | References entity via `entity_type` + `entity_id` |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `auditLog[]` | `audit_log.*` |
| `auditLog[].payload` | `audit_log.payload` (JSONB) |

### Transaction Boundaries

Audit log entries are always created within the transaction of the operation being logged.

### Constraints & Integrity Rules

- `entity_type` must be valid module type
- `action_type` must be: 'create', 'update', 'delete', 'approve', 'reject'
- `source` must be: 'web_ui', 'api', 'bulk_import', 'system', 'modify_pms'
- Append-only (no updates or deletes)
- Timestamp uses server UTC time

### JSONB vs Normalization Decision

| Field | Decision | Reason |
|-------|----------|--------|
| `payload` | Keep as JSONB | Additional context varies by operation |

### Operations Affecting DB

1. Any create/update/delete → INSERT `audit_log`
2. Query by entity → SELECT with entity_type + entity_id filter
3. Query by user → SELECT with user_id filter
4. Query by date range → SELECT with timestamp filter

---

## 17. Fleet Sync & Vessel Mapping

### Module Overview
Manages the relationship between fleet-level templates and vessel-specific instances. Controls which vessels have access to which fleet equipment, jobs, and spares.

### Tables Used

| Table | Purpose |
|-------|---------|
| `fleet_vessel_mapping` | Fleet equipment → Vessel access |
| `fleet_component_mapping` | Fleet equipment → Vessel component |
| `fleet_job_vessel_mapping` | Fleet job → Vessel access |
| `fleet_spare_vessel_mapping` | Fleet spare → Vessel access |

### Relationships Inside Module

```
All tables reference fleet_equipment_code as the grouping key
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **Components** | Maps fleet templates to vessel instances |
| **Jobs** | Maps fleet jobs to vessel jobs |
| **Spares** | Maps fleet spares to vessel spares |
| **Vessels** | All mappings reference vessel_code |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `fleetVesselMapping[]` | `fleet_vessel_mapping.*` |
| `fleetComponentMapping[]` | `fleet_component_mapping.*` |
| `fleetJobVesselMapping[]` | `fleet_job_vessel_mapping.*` |
| `fleetSpareVesselMapping[]` | `fleet_spare_vessel_mapping.*` |

### Transaction Boundaries

1. **Map Fleet Equipment to Vessel** - Single transaction:
   - INSERT `fleet_vessel_mapping`
   - INSERT `fleet_component_mapping` (if component exists)
   
2. **Sync Fleet Data to Vessel** - Transaction per entity type:
   - CREATE vessel component from fleet template
   - INSERT `fleet_component_mapping`
   - CREATE vessel jobs from fleet jobs
   - INSERT `fleet_job_vessel_mapping` for each
   - CREATE vessel spares from fleet spares
   - INSERT `fleet_spare_vessel_mapping` for each

### Constraints & Integrity Rules

- Unique constraints on (fleet_code, vessel_code) combinations
- `is_active=false` disables without deleting
- Mappings track `mapped_by` and `mapped_at` for audit
- Vessel must exist before mapping

### JSONB vs Normalization Decision

No JSONB fields - fully normalized.

### Operations Affecting DB

1. Map vessel → INSERT `fleet_vessel_mapping`
2. Map component → INSERT `fleet_component_mapping`
3. Map job → INSERT `fleet_job_vessel_mapping`
4. Map spare → INSERT `fleet_spare_vessel_mapping`
5. Unmap → UPDATE `is_active=false`
6. Sync all → Batch INSERTs for mappings + entity creation

---

## 18. Core Reference Data

### Module Overview
Foundational tables for users, vessels, fleets, and vessel-specific settings.

### Tables Used

| Table | Purpose |
|-------|---------|
| `users` | User registry |
| `fleets` | Fleet groupings |
| `vessels` | Vessel registry |
| `pms_vessel_settings` | Per-vessel PMS configuration |

### Relationships Inside Module

```
fleets
    └── vessels.fleet_id → fleets.id

vessels
    └── users.vessel_id → vessels.id (for Ship users)
    └── pms_vessel_settings.vessel_id → vessels.id
```

### Relationships to Other Modules

| Related Module | Relationship |
|----------------|--------------|
| **All Modules** | Vessel and user references throughout |

### JSON Keys to Table Mapping

| JSON Key | Table Column(s) |
|----------|-----------------|
| `users[]` | `users.*` |
| `fleets[]` | `fleets.*` |
| `vessels[]` | `vessels.*` |
| `pmsVesselSettings[]` | `pms_vessel_settings.*` |

### Transaction Boundaries

1. **Create User** - Single INSERT
2. **Create Vessel in Fleet** - Single transaction:
   - INSERT `vessels`
   - INSERT `pms_vessel_settings` with defaults

### Constraints & Integrity Rules

- `users.username` must be unique
- `users.role` must be: 'Ship', 'Office', 'PMS Admin'
- Ship users require `vessel_id`
- `fleets.code` must be unique
- `vessels.id` and `vessels.code` are the same
- `pms_vessel_settings.vessel_id` must be unique (one config per vessel)

### JSONB vs Normalization Decision

No JSONB fields - fully normalized.

### Operations Affecting DB

1. Create user → INSERT `users`
2. Update user → UPDATE `users`
3. Create fleet → INSERT `fleets`
4. Create vessel → INSERT `vessels` + INSERT `pms_vessel_settings`
5. Update settings → UPDATE `pms_vessel_settings`
6. Deactivate → UPDATE `is_active=false`

---

## Summary

### Complete Table Inventory (50 Tables)

| # | Table Name | Primary Module | Shared With |
|---|------------|----------------|-------------|
| 1 | `users` | Core Reference Data | All modules |
| 2 | `fleets` | Core Reference Data | Fleet Mappings |
| 3 | `vessels` | Core Reference Data | All modules |
| 4 | `pms_vessel_settings` | Core Reference Data | PMS (Work Orders) |
| 5 | `components` | PMS (Components) | Jobs, Spares, Defects, IHM, Running Hours |
| 6 | `component_documents` | PMS (Components) | - |
| 7 | `component_class_regulatory` | PMS (Components) | Certificates & Surveys |
| 8 | `component_maintenance_history` | PMS (Components) | Work Orders (creates on approval) |
| 9 | `component_requisitions` | PMS (Components) | Spares |
| 10 | `component_running_hours_log` | PMS (Components) | Running Hours |
| 11 | `jobs` | PMS (Jobs) | Work Orders, Fleet Mappings |
| 12 | `work_orders` | PMS (Work Orders) | Jobs, Components, Spares, IHM |
| 13 | `work_order_executions` | PMS (Work Orders) | - |
| 14 | `running_hours_audit` | Running Hours | Components, Jobs |
| 15 | `spares` | Spares | Components, Work Orders, IHM |
| 16 | `spares_history` | Spares | - |
| 17 | `stores_items` | Stores | - (Isolated) |
| 18 | `stores_ledger` | Stores | - (Isolated) |
| 19 | `defects` | Defects | Components |
| 20 | `defect_actions` | Defects | - |
| 21 | `defect_attachments` | Defects | - |
| 22 | `recurring_defects` | Defects | - |
| 23 | `recurring_defect_links` | Defects | - |
| 24 | `alert_policies` | Alerts | - |
| 25 | `alert_events` | Alerts | Work Orders, Components, Spares |
| 26 | `alert_deliveries` | Alerts | - |
| 27 | `alert_config` | Alerts | Vessels |
| 28 | `change_request` | Change Requests | Components, Work Orders, Spares, Stores |
| 29 | `change_request_attachment` | Change Requests | - |
| 30 | `change_request_comment` | Change Requests | - |
| 31 | `ihm_items` | IHM | Components, Spares |
| 32 | `ihm_maintenance_log` | IHM | Work Orders |
| 33 | `form_definitions` | Form Engine | - |
| 34 | `form_versions` | Form Engine | - |
| 35 | `form_version_usage` | Form Engine | - |
| 36 | `makers` | Fleet Admin | Components, Spares |
| 37 | `master_lists` | Fleet Admin | All modules (dropdowns) |
| 38 | `fleet_equipment_master` | Fleet Admin | Components |
| 39 | `maker_list` | Master Data | Components, Spares |
| 40 | `sfi_details` | Master Data | Components |
| 41 | `master_data` | Master Data | Fleet Mappings |
| 42 | `fleet_vessel_mapping` | Fleet Sync | Vessels |
| 43 | `fleet_component_mapping` | Fleet Sync | Components |
| 44 | `fleet_job_vessel_mapping` | Fleet Sync | Jobs |
| 45 | `fleet_spare_vessel_mapping` | Fleet Sync | Spares |
| 46 | `import_history` | Import Engine | - |
| 47 | `import_change_log` | Import Engine | Components, Jobs, Spares, Stores |
| 48 | `bulk_import_history` | Import Engine | - |
| 49 | `bulk_import_errors` | Import Engine | - |
| 50 | `audit_log` | Audit Log | All modules |

### Table Count by Module

| Module | Tables | Notes |
|--------|--------|-------|
| PMS (Components) | 6 | Core equipment registry with 5 satellite tables |
| PMS (Jobs) | 1 | Maintenance job templates |
| PMS (Work Orders) | 2 | Work orders + executions |
| Running Hours | 2 | Audit table + detailed log (shares `components`) |
| Spares | 2 | Inventory + history |
| Stores | 2 | Completely isolated from PMS |
| Defects | 5 | Defects + actions + attachments + recurring detection |
| Alerts | 4 | Policies + events + deliveries + config |
| Certificates & Surveys | 0 | Uses `component_class_regulatory` (counted in Components) |
| Change Requests | 3 | Modify PMS workflow |
| IHM | 2 | Hazardous materials tracking |
| Form Engine | 3 | Dynamic form configuration |
| Fleet Admin | 3 | Makers, master lists, equipment master |
| Master Data | 3 | SFI codes, maker list, equipment code generation |
| Import Engine | 4 | Import tracking + change log + bulk import + errors |
| Audit Log | 1 | System-wide audit trail |
| Fleet Sync & Vessel Mapping | 4 | Fleet-to-vessel data mapping |
| Core Reference Data | 4 | Users, fleets, vessels, settings |
| **TOTAL (Unique)** | **50** | |

### Key Cross-Module Dependencies

```
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                         AUDIT_LOG                               │
                    │    (Receives entries from ALL modules on create/update/delete)  │
                    └─────────────────────────────────────────────────────────────────┘
                                                   ▲
                                                   │
        ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
        │                                          │                                          │
        ▼                                          ▼                                          ▼
┌───────────────┐                          ┌───────────────┐                          ┌───────────────┐
│    VESSELS    │◄─────────────────────────│  COMPONENTS   │──────────────────────────►│     JOBS      │
│  (+ fleets)   │                          │               │                          │               │
└───────┬───────┘                          └───────┬───────┘                          └───────┬───────┘
        │                                          │                                          │
        │                                          ├───────────► SPARES                       │
        │                                          │             (rob, history)               │
        │                                          │                                          │
        │                                          ├───────────► DEFECTS                      │
        │                                          │             (actions, attachments)       │
        │                                          │                                          │
        │                                          ├───────────► IHM_ITEMS                    │
        │                                          │                                          │
        │                                          ├───────────► COMPONENT_DOCUMENTS          │
        │                                          │                                          │
        │                                          ├───────────► COMPONENT_CLASS_REGULATORY   │
        │                                          │                                          │
        │                                          └───────────► RUNNING_HOURS_AUDIT          │
        │                                                                                     │
        │                                                                                     ▼
        │                                                                            ┌───────────────┐
        │                                                                            │  WORK_ORDERS  │
        │                                                                            │               │
        │                                                                            └───────┬───────┘
        │                                                                                    │
        │                                                    ┌───────────────────────────────┤
        │                                                    │                               │
        │                                                    ▼                               ▼
        │                                           COMPONENT_MAINTENANCE_HISTORY    IHM_MAINTENANCE_LOG
        │
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     FLEET MAPPING TABLES                                          │
│  fleet_vessel_mapping ─► fleet_component_mapping ─► fleet_job_vessel_mapping                     │
│                                                   ─► fleet_spare_vessel_mapping                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        MASTER DATA                                                │
│           master_data ◄─── sfi_details, maker_list, makers, fleet_equipment_master               │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘


ISOLATED MODULE:
┌───────────────────────────────────────────┐
│              STORES                        │
│  stores_items ◄──► stores_ledger           │
│  (NO links to components/jobs/work_orders) │
└───────────────────────────────────────────┘
```

### Critical Transaction Boundaries

| Transaction | Tables Touched | Complexity |
|-------------|----------------|------------|
| Work Order Approval | `work_orders`, `component_maintenance_history`, `spares`, `spares_history`, `jobs`, `audit_log` | HIGH (6+ tables) |
| Running Hours Cascade | `components` (parent + N children), `running_hours_audit`, `component_running_hours_log`, `jobs` | HIGH (N+3 tables) |
| Import Undo | `import_change_log`, target table (components/jobs/spares/stores), `import_history` | MEDIUM (3 tables) |
| Fleet Sync to Vessel | `components`, `jobs`, `spares`, `fleet_*_mapping` (4 tables) | HIGH (7+ tables) |
| Defect with Actions | `defects`, `defect_actions`, `defect_attachments`, `audit_log` | MEDIUM (4 tables) |
| Change Request Approval | `change_request`, target table, `audit_log` | MEDIUM (3 tables) |

### Data Integrity Rules Summary

| Rule | Enforcement |
|------|-------------|
| `component_maintenance_history` is IMMUTABLE | No UPDATE/DELETE operations allowed |
| `running_hours_audit` is APPEND-ONLY | No UPDATE/DELETE operations allowed |
| `audit_log` is APPEND-ONLY | No UPDATE/DELETE operations allowed |
| Stores has ZERO PMS linkages | No component_id, job_id, or work_order_id fields |
| Soft deletes for Components, Spares, Stores | `is_active=false` or `deleted=true` |
| Unique fleet equipment codes | `fleet_equipment_code` + `data_scope` constraint |
| Unique job numbers | Global unique on `jobs.job_no` |
| Vessel-scoped uniqueness | Various codes unique within vessel context |

### JSONB Field Locations

| Table | JSONB Fields | Purpose |
|-------|--------------|---------|
| `jobs` | `required_spare_parts`, `required_tools`, `safety_requirements` | Template data |
| `work_orders` | `form_data`, `required_spare_parts`, `required_tools`, `safety_requirements`, `uploaded_documents`, `consumed_spare_parts` | Form + execution data |
| `defects` | `notes`, `actions`, `attachments`, `audit_trail`, `immediate_cause`, `root_cause` | Inline complex data |
| `change_request` | `snapshot_before_json`, `proposed_changes_json`, `move_preview_json`, `revision_history` | Change tracking |
| `import_change_log` | `previous_data`, `new_data` | Undo snapshots |
| `bulk_import_errors` | `raw_row_data` | Debug data |
| `component_maintenance_history` | `spares_used` | Parts consumption |
| `audit_log` | `payload` | Additional context |

---

*Document Version: 1.1*
*Last Updated: December 2025*
*Status: ANALYSIS ONLY - NOT APPLIED*
*Verification: All 50 tables cross-checked against shared/schema.ts*
