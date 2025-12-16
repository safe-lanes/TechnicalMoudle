# Seafarer PMS - PostgreSQL Write Operations Testing Reference

## Overview

The system uses **HybridStorage** which routes modules 1-14 to PostgreSQL when `DATABASE_URL` is configured. All PostgreSQL operations are implemented via Drizzle ORM in `server/postgresStorage.ts`.

---

## Module 1: Users, Fleets, Vessels, PMS Vessel Settings

### Tables Used
| Table | Purpose |
|-------|---------|
| `users` | User registry |
| `fleets` | Fleet groupings |
| `vessels` | Vessel registry |
| `pms_vessel_settings` | Per-vessel configuration |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create User | `users` | INSERT |
| Update User | `users` | UPDATE |
| Delete User | `users` | DELETE |
| Create Fleet | `fleets` | INSERT |
| Update Fleet | `fleets` | UPDATE |
| Delete Fleet | `fleets` | DELETE |
| Create Vessel | `vessels` | INSERT |
| Update Vessel | `vessels` | UPDATE |
| Assign Vessel to Fleet | `vessels` | UPDATE |
| Create/Update PMS Settings | `pms_vessel_settings` | UPSERT |
| Delete PMS Settings | `pms_vessel_settings` | DELETE |

### Trigger Points (How to Test)

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create User | Admin → User Management | "Add User" button |
| Update User | Admin → User Management | Edit icon on user row |
| Delete User | Admin → User Management | Delete icon on user row |
| Create Fleet | Admin → Fleet Management | "Add Fleet" button |
| Update Fleet | Admin → Fleet Management | Edit icon on fleet row |
| Create Vessel | Admin → Vessel Management | "Add Vessel" button |
| Update Vessel | Admin → Vessel Management | Edit icon on vessel row |
| Assign Vessel to Fleet | Admin → Vessel Management | Fleet dropdown on vessel |
| Update PMS Settings | Vessel Settings page | "Save Settings" button |

### Test Verification Steps

**Create Vessel:**
```sql
-- After: Click "Add Vessel" → Fill form → Submit
SELECT * FROM vessels WHERE id = '<new_vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with name, code, fleet_id, is_active=true
```

**Update PMS Settings:**
```sql
-- After: Navigate to Vessel Settings → Modify settings → Save
SELECT * FROM pms_vessel_settings WHERE vessel_id = '<vessel_id>';
-- Expected: Row with updated grace_period_days, work_order_prefix, etc.
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback for Module 1 entities.

---

## Module 2: Makers, Master Lists, Maker List, SFI Details, Master Data

### Tables Used
| Table | Purpose |
|-------|---------|
| `makers` | Equipment manufacturers |
| `master_lists` | Dropdown options (departments, ranks, etc.) |
| `maker_list` | Master data maker registry |
| `sfi_details` | SFI code lookup |
| `master_data` | Fleet equipment code generation |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Maker | `makers` | INSERT (auto-generates makerCode) |
| Update Maker | `makers` | UPDATE |
| Delete Maker | `makers` | DELETE |
| Create Master List Item | `master_lists` | INSERT |
| Update Master List Item | `master_lists` | UPDATE |
| Delete Master List Item | `master_lists` | DELETE |
| Create Maker List Entry | `maker_list` | INSERT |
| Update Maker List Entry | `maker_list` | UPDATE |
| Delete Maker List Entry | `maker_list` | Soft DELETE (isActive=false) |
| Create SFI Detail | `sfi_details` | INSERT |
| Update SFI Detail | `sfi_details` | UPDATE |
| Delete SFI Detail | `sfi_details` | Soft DELETE (isActive=false) |
| Create Master Data | `master_data` | INSERT |
| Update Master Data | `master_data` | UPDATE |
| Delete Master Data | `master_data` | Soft DELETE (isActive=false) |
| Generate Fleet Equipment Code | `master_data` | INSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Maker | Fleet Admin → Makers | "Add Maker" button |
| Update Maker | Fleet Admin → Makers | Edit icon on maker row |
| Manage Master Lists | Fleet Admin → Master Lists | Add/Edit/Delete list items |
| Create SFI Detail | Fleet Admin → SFI Codes | "Add SFI Code" button |
| Generate Fleet Equipment Code | Fleet Admin → Master Data | "Generate Code" button |

### Test Verification Steps

**Create Maker:**
```sql
-- After: Click "Add Maker" → Fill name, address, etc. → Submit
SELECT * FROM makers ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with auto-generated maker_code (MKR-000001 format)
```

**Create Master List Item:**
```sql
-- After: Fleet Admin → Master Lists → Select type → Add item
SELECT * FROM master_lists WHERE list_type = '<type>' ORDER BY display_order;
-- Expected: New row with list_key, list_value, is_active=true
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback.

---

## Module 3: Components, Documents, Class/Regulatory, Maintenance History, Requisitions, Running Hours Audit

### Tables Used
| Table | Purpose |
|-------|---------|
| `components` | Equipment registry (vessel & fleet) |
| `component_documents` | Technical documents, manuals, drawings |
| `component_class_regulatory` | Classification society and survey records |
| `component_maintenance_history` | **IMMUTABLE** maintenance audit trail |
| `component_requisitions` | Purchase/service requisitions |
| `running_hours_audit` | Running hours update audit trail |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Component | `components` | INSERT |
| Update Component | `components` | UPDATE |
| Delete Component | `components` | DELETE |
| Inactivate Component | `components` | UPDATE (isActive=false) |
| Bulk Upload Components | `components` | BULK INSERT/UPDATE |
| Upload Document | `component_documents` | INSERT |
| Update Document | `component_documents` | UPDATE |
| Delete Document | `component_documents` | DELETE |
| Add Class Survey | `component_class_regulatory` | INSERT |
| Update Class Survey | `component_class_regulatory` | UPDATE |
| Delete Class Survey | `component_class_regulatory` | DELETE |
| Record Maintenance | `component_maintenance_history` | **INSERT ONLY** |
| Create Requisition | `component_requisitions` | INSERT |
| Update Requisition | `component_requisitions` | UPDATE |
| Delete Requisition | `component_requisitions` | DELETE |
| Single RH Update | `running_hours_audit` + `components` | INSERT + UPDATE |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Component | PMS → Components → Add Component | "Add Component" button |
| Update Component | PMS → Components → Component Details | "Edit" button |
| Bulk Upload | PMS → Components → Upload | Upload CSV/Excel file |
| Upload Document | Component Details → Documents Tab | "Upload Document" button |
| Add Class Survey | Component Details → Class/Regulatory Tab | "Add Survey" button |
| Create Requisition | Component Details → Requisitions Tab | "New Requisition" button |
| Update Running Hours | PMS → Running Hours | RH Update form |
| Cascade RH Update | PMS → Running Hours → Parent | "Update RH" with cascade |

### Test Verification Steps

**Create Component:**
```sql
-- After: Add Component → Fill form → Submit
SELECT * FROM components WHERE vessel_id = '<vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with component_code, name, category, data_scope='vessel'
```

**Upload Document:**
```sql
-- After: Component Details → Documents → Upload file
SELECT * FROM component_documents WHERE component_id = '<component_id>' ORDER BY uploaded_at DESC LIMIT 1;
-- Expected: New row with file_name, file_key (object storage path), file_type
```

**Maintenance History (IMMUTABLE):**
```sql
-- After: Work Order approved → Maintenance history auto-created
SELECT * FROM component_maintenance_history WHERE component_id = '<component_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with work_order_id, date_completed, performed_by
-- NOTE: Updates and deletes are blocked by database trigger
```

**Running Hours Update:**
```sql
-- After: PMS → Running Hours → Update component RH
SELECT * FROM running_hours_audit WHERE component_id = '<component_id>' ORDER BY entered_at_utc DESC LIMIT 1;
-- Expected: New row with previous_rh, new_rh, cumulative_rh, source='single'

SELECT current_cumulative_rh FROM components WHERE id = '<component_id>';
-- Expected: Updated cumulative RH value
```

### Storage Behavior
- **Components, Documents, Class/Regulatory, Requisitions, Running Hours Audit:** PostgreSQL only
- **Bulk Operations (bulkCreateComponents, bulkUpdateComponents, bulkUpsertComponents):** Still uses file storage (pending migration)
- **Cascade Running Hours Updates:** Still uses file storage for complex logic

---

## Module 4: Jobs (Vessel & Fleet)

### Tables Used
| Table | Purpose |
|-------|---------|
| `jobs` | Job templates with scheduling configuration |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Job | `jobs` | INSERT |
| Update Job | `jobs` | UPDATE |
| Delete Job | `jobs` | DELETE |
| Create Fleet Job | `jobs` | INSERT (dataScope='fleet') |
| Bulk Create Jobs | `jobs` | BULK INSERT |
| Bulk Update Jobs | `jobs` | BULK UPDATE |
| Bulk Upsert Jobs | `jobs` | BULK UPSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Job | PMS → Jobs → Add Job | "Add Job" button |
| Update Job | PMS → Jobs → Job Details | "Edit" button |
| Delete Job | PMS → Jobs → Job Details | "Delete" button |
| Create Fleet Job | Fleet Admin → Fleet Jobs | "Add Fleet Job" button |
| Import Jobs | PMS → Jobs → Import | Upload Excel file |

### Test Verification Steps

**Create Job:**
```sql
-- After: Add Job → Fill form → Submit
SELECT * FROM jobs WHERE vessel_id = '<vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with job_no (unique), job_title, component_id, maintenance_basis
```

**Update Job Frequency:**
```sql
-- After: Job Details → Change frequency → Save
SELECT next_due_date, next_due_rh, frequency_value, frequency_unit FROM jobs WHERE id = '<job_id>';
-- Expected: Updated frequency fields and recalculated next_due_date/next_due_rh
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback for jobs.

---

## Module 5: Work Orders (Vessel & Fleet)

### Tables Used
| Table | Purpose |
|-------|---------|
| `work_orders` | Main work order records |
| `work_order_executions` | Historical execution records (still in file storage) |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Work Order | `work_orders` | INSERT |
| Create from Job (auto-generate) | `work_orders` | INSERT |
| Update Work Order | `work_orders` | UPDATE |
| Delete Work Order | `work_orders` | DELETE |
| Submit for Approval | `work_orders` | UPDATE (status='Pending Approval') |
| Approve Work Order | `work_orders` + `component_maintenance_history` | Multi-table UPDATE + INSERT |
| Reject Work Order | `work_orders` | UPDATE |
| Postpone Work Order | `work_orders` | UPDATE |
| Create Fleet Work Order | `work_orders` | INSERT (dataScope='fleet') |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Unplanned WO | PMS → Work Orders → Create | "New Unplanned WO" button |
| Auto-generate from Job | System background job | Job Due Scanner (hourly) |
| Update WO Execution | Work Order → Part B | Fill execution fields → Save |
| Submit for Approval | Work Order → Part B | "Submit for Approval" button |
| Approve Work Order | Work Order → Approval | "Approve" button |
| Reject Work Order | Work Order → Approval | "Reject" button |
| Postpone Work Order | Work Order | "Postpone" button |

### Test Verification Steps

**Create Unplanned Work Order:**
```sql
-- After: Create Unplanned WO → Fill form → Submit
SELECT * FROM work_orders WHERE vessel_id = '<vessel_id>' AND work_order_type = 'Unplanned' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with work_order_no, job_title, assigned_to, status='Active'
```

**Submit for Approval:**
```sql
-- After: Work Order Part B → Complete execution → Submit for Approval
SELECT status, submitted_date FROM work_orders WHERE id = '<wo_id>';
-- Expected: status='Pending Approval', submitted_date set
```

**Approve Work Order (Multi-table transaction):**
```sql
-- After: Approve button → Confirm
-- 1. Check work order status
SELECT status, approval_date FROM work_orders WHERE id = '<wo_id>';
-- Expected: status='Completed', approval_date set

-- 2. Check maintenance history created (IMMUTABLE)
SELECT * FROM component_maintenance_history WHERE work_order_id = '<wo_id>';
-- Expected: New row with maintenance_type, date_completed, performed_by

-- 3. Check job next due updated
SELECT next_due_date, last_done_date FROM jobs WHERE id = '<job_id>';
-- Expected: next_due_date advanced, last_done_date updated
```

### Storage Behavior
- **Work Orders:** PostgreSQL only
- **Work Order Executions:** Still uses file storage (not migrated)
- **Complex operations (generateOnDemandWorkOrder, checkAndRevertPostponedWorkOrders):** Still uses file storage

---

## Module 7: Spares, Spares History

### Tables Used
| Table | Purpose |
|-------|---------|
| `spares` | Spare parts inventory |
| `spares_history` | Transaction history |

### Write Operations Summary

| Operation | Table(s) | Type |
|-----------|----------|------|
| Create Spare | `spares` + `spares_history` | INSERT + INSERT (CREATE event) |
| Update Spare | `spares` + `spares_history` | UPDATE + INSERT (EDIT event) |
| Delete Spare | `spares` | Soft DELETE (deleted=true) |
| Consume Spare (via WO) | `spares` + `spares_history` | UPDATE rob + INSERT (CONSUME event) |
| Receive Spare | `spares` + `spares_history` | UPDATE rob + INSERT (RECEIVE event) |
| Adjust Stock | `spares` + `spares_history` | UPDATE rob + INSERT (ADJUST event) |
| Link to Component | `spares` + `spares_history` | UPDATE + INSERT (LINK_CREATED event) |
| Bulk Create Spares | `spares` + `spares_history` | BULK INSERT |
| Bulk Upsert Spares | `spares` + `spares_history` | BULK UPSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Spare | PMS → Spares → Add Spare | "Add Spare" button |
| Update Spare | PMS → Spares → Spare Details | "Edit" button |
| Consume Spare | PMS → Spares → Spare Details | "Consume" button |
| Receive Spare | PMS → Spares → Spare Details | "Receive" button |
| Adjust Stock | PMS → Spares → Spare Details | "Adjust" button |
| Bulk Import | PMS → Spares → Import | Upload Excel file |

### Test Verification Steps

**Create Spare:**
```sql
-- After: Add Spare → Fill form → Submit
SELECT * FROM spares WHERE vessel_id = '<vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with part_code, part_name, component_id, rob values

SELECT * FROM spares_history WHERE spare_id = <new_spare_id> AND event_type = 'CREATE';
-- Expected: History record with initial ROB
```

**Consume Spare:**
```sql
-- After: Spare Details → Consume → Enter quantity → Confirm
SELECT rob, rob_location_a, rob_location_b FROM spares WHERE id = <spare_id>;
-- Expected: rob decreased by consumed quantity

SELECT * FROM spares_history WHERE spare_id = <spare_id> AND event_type = 'CONSUME' ORDER BY timestamp_utc DESC LIMIT 1;
-- Expected: New row with qty_change (negative), rob_after, reference (WO number)
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback.

---

## Module 8: Stores Items, Stores Ledger

### Tables Used
| Table | Purpose |
|-------|---------|
| `stores_items` | Stores inventory (isolated from PMS - NO component/job links) |
| `stores_ledger` | Transaction history ledger |

### Write Operations Summary

| Operation | Table(s) | Type |
|-----------|----------|------|
| Create Stores Item | `stores_items` | INSERT |
| Update Stores Item | `stores_items` | UPDATE |
| Delete Stores Item | `stores_items` | Soft DELETE (deleted=true) |
| Consume Stores Item | `stores_items` + `stores_ledger` | UPDATE rob + INSERT |
| Receive Stores Item | `stores_items` + `stores_ledger` | UPDATE rob + INSERT |
| Archive Stores Item | `stores_items` + `stores_ledger` | UPDATE + INSERT (ARCHIVE event) |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Stores Item | Stores → Add Item | "Add Item" button |
| Update Stores Item | Stores → Item Details | "Edit" button |
| Consume Item | Stores → Item Details | "Consume" button |
| Receive Item | Stores → Item Details | "Receive" button |
| Archive Item | Stores → Item Details | "Archive" button |

### Test Verification Steps

**Create Stores Item:**
```sql
-- After: Add Item → Fill form → Submit
SELECT * FROM stores_items WHERE vessel_id = '<vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with item_code, item_name, item_type ('stores'|'lubricants'|'chemicals'|'others')
```

**Consume Stores Item:**
```sql
-- After: Item Details → Consume → Enter quantity → Confirm
SELECT rob FROM stores_items WHERE id = <item_id>;
-- Expected: rob decreased

SELECT * FROM stores_ledger WHERE item_id = <item_id> AND event_type = 'CONSUME' ORDER BY timestamp_utc DESC LIMIT 1;
-- Expected: New row with qty_change_base (negative), rob_after_base
```

### Storage Behavior
- **Uses PostgreSQL only** for stores_items and stores_ledger
- **Important:** Stores Ledger is **NOT read-only** - it receives INSERT operations when consuming/receiving items

---

## Module 9: Defects, Defect Actions, Defect Attachments, Recurring Defects

### Tables Used
| Table | Purpose |
|-------|---------|
| `defects` | Main defect records |
| `defect_actions` | Corrective/preventive action items |
| `defect_attachments` | Photos and documents |
| `recurring_defects` | Aggregated recurring defect groups |
| `recurring_defect_links` | Links defects to recurring groups |

### Write Operations Summary

| Operation | Table(s) | Type |
|-----------|----------|------|
| Create Defect | `defects` | INSERT |
| Update Defect | `defects` | UPDATE |
| Close Defect | `defects` | UPDATE (status, closedBy, closedOn) |
| Add Action | `defect_actions` + `defects.actions` JSONB | INSERT + UPDATE |
| Update Action | `defect_actions` + `defects.actions` JSONB | UPDATE |
| Delete Action | `defect_actions` | DELETE |
| Upload Attachment | `defect_attachments` + `defects.attachments` JSONB | INSERT + UPDATE |
| Delete Attachment | `defect_attachments` | DELETE |
| Add Note | `defects.notes` JSONB | UPDATE (append) |
| Detect Recurring | `recurring_defects` + `recurring_defect_links` | UPSERT + INSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Defect | Defects → Create Defect | "New Defect" button |
| Update Defect | Defects → Defect Details | "Edit" button |
| Close Defect | Defects → Defect Details | "Close Defect" button |
| Add Action | Defect Details → Actions Tab | "Add Action" button |
| Upload Attachment | Defect Details → Attachments | "Upload" button |
| Add Note | Defect Details → Notes | "Add Note" button |

### Test Verification Steps

**Create Defect:**
```sql
-- After: Create Defect → Fill wizard → Submit
SELECT * FROM defects WHERE vessel_id = '<vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with category ('Defect'|'COC'|'Observation'|'NCR'), description, status='Open'
```

**Close Defect:**
```sql
-- After: Defect Details → Close Defect → Add closure comment → Confirm
SELECT status, closed_by, closed_on, closure_comment FROM defects WHERE id = '<defect_id>';
-- Expected: status='Closed', closed_by/closed_on populated
```

**Add Action:**
```sql
-- After: Defect Details → Actions → Add Action → Submit
SELECT * FROM defect_actions WHERE defect_id = '<defect_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with action_type, action_description, due_date, status='Open'

SELECT actions FROM defects WHERE id = '<defect_id>';
-- Expected: JSONB array updated with new action
```

### Storage Behavior
- **Defects, Actions, Attachments:** PostgreSQL only
- **Recurring Defect Calculation (calculateAndUpdateRecurringDefects, recalculateAllRecurringDefects):** Still uses file storage for complex logic

---

## Module 10: Alert Policies, Alert Events, Alert Deliveries, Alert Config

### Tables Used
| Table | Purpose |
|-------|---------|
| `alert_policies` | Alert configuration rules |
| `alert_events` | Generated alert instances |
| `alert_deliveries` | Delivery tracking per channel |
| `alert_config` | Per-vessel alert configuration |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Alert Policy | `alert_policies` | INSERT |
| Update Alert Policy | `alert_policies` | UPDATE |
| Delete Alert Policy | `alert_policies` | DELETE |
| Generate Alert Event | `alert_events` | INSERT (with dedupe check) |
| Update Alert Event | `alert_events` | UPDATE |
| Mark Alert Resolved | `alert_events` | UPDATE (resolved_at) |
| Create Alert Delivery | `alert_deliveries` | INSERT |
| Update Delivery Status | `alert_deliveries` | UPDATE |
| Update Alert Config | `alert_config` | UPSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Alert Policy | Alerts → Policies | "Add Policy" button |
| Update Alert Policy | Alerts → Policies → Edit | Edit icon |
| View Alert Events | Alerts → Events | View list |
| Resolve Alert | Alerts → Events → Event Details | "Resolve" button |
| Configure Alerts | Alerts → Configuration | Save configuration |

### Test Verification Steps

**Create Alert Policy:**
```sql
-- After: Add Policy → Configure triggers → Save
SELECT * FROM alert_policies ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with name, alert_type, severity, trigger_type, is_active=true
```

**Alert Event Generated (System):**
```sql
-- After: System detects trigger condition (e.g., work order overdue)
SELECT * FROM alert_events WHERE alert_type = 'WORK_ORDER_OVERDUE' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with entity_type, entity_id, severity, resolved_at=null
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback.

---

## Module 11: Form Definitions, Form Versions, Form Version Usage

### Tables Used
| Table | Purpose |
|-------|---------|
| `form_definitions` | Dynamic form templates (ADD_COMPONENT, WO_PLANNED, etc.) |
| `form_versions` | Versioned form schemas |
| `form_version_usage` | Audit of form version usage |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Form Definition | `form_definitions` | INSERT |
| Create Form Version | `form_versions` | INSERT |
| Update Form Version | `form_versions` | UPDATE |
| Publish Form Version | `form_versions` | UPDATE (status='PUBLISHED') |
| Archive Form Version | `form_versions` | UPDATE (status='ARCHIVED') |
| Log Form Usage | `form_version_usage` | INSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Form | Forms → Form Builder | "Create Form" button |
| Edit Form Version | Forms → Form Details → Versions | "Edit" button |
| Publish Version | Forms → Form Details → Versions | "Publish" button |
| Form Usage (System) | Any form submission | Auto-logged on form use |

### Test Verification Steps

**Create Form Version:**
```sql
-- After: Form Builder → Edit schema → Save as new version
SELECT * FROM form_versions WHERE form_id = <form_id> ORDER BY version_no DESC LIMIT 1;
-- Expected: New row with schema_json, status='DRAFT', version_no incremented
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback.

---

## Module 12: Change Requests, Attachments, Comments

### Tables Used
| Table | Purpose |
|-------|---------|
| `change_request` | Modify PMS workflow requests |
| `change_request_attachment` | Supporting documents |
| `change_request_comment` | Discussion comments |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create Change Request | `change_request` | INSERT |
| Update Change Request | `change_request` | UPDATE |
| Submit for Review | `change_request` | UPDATE (status='Submitted') |
| Approve Change Request | `change_request` | UPDATE (status='Approved') |
| Reject Change Request | `change_request` | UPDATE (status='Rejected') |
| Add Attachment | `change_request_attachment` | INSERT |
| Delete Attachment | `change_request_attachment` | DELETE |
| Add Comment | `change_request_comment` | INSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create Request | Modify PMS → Create Request | "New Request" button |
| Submit Request | Modify PMS → Request Details | "Submit for Review" button |
| Approve Request | Modify PMS → Request Details | "Approve" button |
| Add Attachment | Request Details → Attachments | "Upload" button |
| Add Comment | Request Details → Comments | "Add Comment" button |

### Test Verification Steps

**Create Change Request:**
```sql
-- After: New Request → Fill details → Submit
SELECT * FROM change_request ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with entity_type, change_type, status='Draft'
```

**Approve Change Request:**
```sql
-- After: Approve → Confirm
SELECT status, approved_by, approved_at FROM change_request WHERE id = <request_id>;
-- Expected: status='Approved', approved_by/approved_at populated
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback.

---

## Module 13: IHM Items, IHM Maintenance Log

### Tables Used
| Table | Purpose |
|-------|---------|
| `ihm_items` | Hazardous materials inventory |
| `ihm_maintenance_log` | Maintenance actions affecting IHM |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Create IHM Item | `ihm_items` | INSERT |
| Update IHM Item | `ihm_items` | UPDATE |
| Delete IHM Item | `ihm_items` | DELETE |
| Log IHM Maintenance | `ihm_maintenance_log` | INSERT |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Create IHM Item | IHM → Add Item | "Add IHM Item" button |
| Update IHM Item | IHM → Item Details | "Edit" button |
| IHM Log Entry | Work Order completion with IHM materials | Auto-logged on WO approval |

### Test Verification Steps

**Create IHM Item:**
```sql
-- After: Add IHM Item → Fill form → Submit
SELECT * FROM ihm_items WHERE vessel_id = '<vessel_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: New row with component_id, presence, materials[], evidence_type
```

**IHM Maintenance Log:**
```sql
-- After: Work Order with IHM materials approved
SELECT * FROM ihm_maintenance_log WHERE work_order_id = '<wo_id>';
-- Expected: New row with action ('Installed'|'Removed'|'Replaced'), materials[]
```

### Storage Behavior
**Uses PostgreSQL only** - No file storage fallback.

---

## Module 14: Fleet Vessel Mapping, Fleet Component Mapping, Fleet Job Vessel Mapping, Fleet Spare Vessel Mapping

### Tables Used
| Table | Purpose |
|-------|---------|
| `fleet_vessel_mapping` | Fleet equipment → Vessel access |
| `fleet_component_mapping` | Fleet equipment → Vessel component |
| `fleet_job_vessel_mapping` | Fleet job → Vessel access |
| `fleet_spare_vessel_mapping` | Fleet spare → Vessel access |

### Write Operations Summary

| Operation | Table | Type |
|-----------|-------|------|
| Map Fleet to Vessel | `fleet_vessel_mapping` | INSERT |
| Map Component to Vessel | `fleet_component_mapping` | INSERT |
| Map Job to Vessel | `fleet_job_vessel_mapping` | INSERT |
| Map Spare to Vessel | `fleet_spare_vessel_mapping` | INSERT |
| Unmap (deactivate) | All mapping tables | UPDATE (isActive=false) |
| Bulk Sync to Vessel | All mapping tables + entities | Multi-table INSERTs |

### Trigger Points

| Action | UI Location | Button/Action |
|--------|-------------|---------------|
| Map Equipment to Vessel | Fleet Admin → Fleet Mapping | Select vessel → "Map" button |
| Sync Fleet to Vessel | Fleet Admin → Fleet Sync | "Sync to Vessel" button |
| Unmap Equipment | Fleet Admin → Fleet Mapping | "Unmap" button |

### Test Verification Steps

**Map Fleet Component to Vessel:**
```sql
-- After: Fleet Mapping → Select component → Select vessel → Map
SELECT * FROM fleet_component_mapping WHERE fleet_equipment_code = '<code>' AND vessel_code = '<vessel>';
-- Expected: New row with is_active=true, mapped_by, mapped_at
```

### Storage Behavior
- **Mapping Tables:** PostgreSQL for new Module 14 tables
- **Legacy mappings (createFleetVesselMappings, deleteFleetVesselMapping):** Still uses file storage

---

## Areas Still Using File Storage

### Certificates & Surveys
- **Tables:** Uses file storage (`getCertificates`, `createCertificate`, etc.)
- **PostgreSQL Writes:** None
- **Test Location:** Vessel → Certificates & Surveys

### Import History & Change Logs
- **Tables:** `import_history`, `import_change_log` (defined in schema but delegated to file storage)
- **PostgreSQL Writes:** None - all operations via `fileStorage`
- **Test Location:** Import → Import History

### Bulk Import History & Errors
- **Tables:** `bulk_import_history`, `bulk_import_errors`
- **PostgreSQL Writes:** None - delegated to file storage
- **Test Location:** Import functionality

### Work Order Executions
- **Table:** `work_order_executions`
- **PostgreSQL Writes:** None - operations still in file storage
- **Test Location:** Work Order → View Execution History

### Legacy Fleet Mappings
- **Methods:** `createFleetVesselMappings`, `deleteFleetVesselMapping`
- **PostgreSQL Writes:** None - uses file storage
- **Note:** Newer mapping tables (Module 14) use PostgreSQL

### Complex Recalculation Logic
- **Running Hours Cascade:** `cascadeRunningHoursUpdate` - file storage
- **Recurring Defects:** `calculateAndUpdateRecurringDefects`, `recalculateAllRecurringDefects` - file storage
- **Job Due Scanner:** Generates work orders, may involve file storage for complex scenarios

### Component Vessel Mappings (Legacy)
- **Methods:** `getComponentVesselMappings`, `createComponentVesselMapping`, `deleteComponentVesselMapping`
- **PostgreSQL Writes:** None - file storage

---

## Quick Reference: PostgreSQL Table Summary

| Module | Tables | Total |
|--------|--------|-------|
| 1 | users, fleets, vessels, pms_vessel_settings | 4 |
| 2 | makers, master_lists, maker_list, sfi_details, master_data | 5 |
| 3 | components, component_documents, component_class_regulatory, component_maintenance_history, component_requisitions, running_hours_audit | 6 |
| 4 | jobs | 1 |
| 5 | work_orders | 1 |
| 7 | spares, spares_history | 2 |
| 8 | stores_items, stores_ledger | 2 |
| 9 | defects, defect_actions, defect_attachments, recurring_defects, recurring_defect_links | 5 |
| 10 | alert_policies, alert_events, alert_deliveries, alert_config | 4 |
| 11 | form_definitions, form_versions, form_version_usage | 3 |
| 12 | change_request, change_request_attachment, change_request_comment | 3 |
| 13 | ihm_items, ihm_maintenance_log | 2 |
| 14 | fleet_vessel_mapping, fleet_component_mapping, fleet_job_vessel_mapping, fleet_spare_vessel_mapping | 4 |
| **Total** | | **42 tables** |

---

## Critical Constraints

### component_maintenance_history Table - IMMUTABLE
- **INSERT ONLY** - Updates and deletes are blocked by database trigger
- Purpose: Maintain complete audit trail of all maintenance activities
- Any attempt to UPDATE or DELETE will be rejected at the database level

### Stores Module Isolation
- Stores items have **NO links** to components, jobs, or work orders
- This is intentional business rule separation
- Stores ledger tracks transactions independently of PMS

---

*Document generated from codebase analysis of Seafarer PMS system*
*Files analyzed: shared/schema.ts, server/postgresStorage.ts, server/hybridStorage.ts*
