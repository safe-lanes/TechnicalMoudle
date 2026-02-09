# Seafarer PMS - PostgreSQL Database Architecture Plan

> Complete PostgreSQL migration architecture based on analysis of current file-based storage system.
> **STATUS: PLANNING ONLY - DO NOT APPLY**

---

## Table of Contents

1. [High-Level Migration Overview](#1-high-level-migration-overview)
2. [Full DB Architecture - Table Designs](#2-full-db-architecture---table-designs)
3. [Module-to-Database Flow](#3-module-to-database-flow)
4. [JSON to SQL Mapping](#4-json-to-sql-mapping)
5. [Backend Integration & Refactor Plan](#5-backend-integration--refactor-plan)
6. [Frontend Considerations](#6-frontend-considerations)
7. [Indexing, Performance & Scaling](#7-indexing-performance--scaling)

---

## 1. High-Level Migration Overview

### 1.1 Current Architecture Summary

| Aspect | Current State |
|--------|---------------|
| **Primary Storage** | `test-data.json` (single JSON file, ~variable size) |
| **Storage Pattern** | In-memory cache + full JSON rewrite on every write |
| **Binary Files** | `uploads/component-documents/` via LocalFileStorage |
| **Concurrency** | Promise-based write lock queue |
| **ORM** | Drizzle ORM (schema defined but not active in file mode) |
| **Schema Location** | `shared/schema.ts` (1,813 lines, 50 tables defined) |

### 1.2 Target PostgreSQL Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TARGET ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐     ┌───────────────────────────┐        │
│  │   IStorage        │     │  PostgreSQL Database      │        │
│  │   (Interface)     │────▶│  (Neon-backed)            │        │
│  └───────────────────┘     │                           │        │
│            │               │  • 50+ normalized tables  │        │
│            ▼               │  • Foreign key integrity  │        │
│  ┌───────────────────┐     │  • Index optimization     │        │
│  │  PostgresStorage  │     │  • Transaction support    │        │
│  │  (Drizzle ORM)    │────▶│  • Connection pooling     │        │
│  └───────────────────┘     └───────────────────────────┘        │
│                                                                  │
│  ┌───────────────────────────┐                                  │
│  │  Object Storage           │  ← Binary files (unchanged)      │
│  │  (Replit Object Storage)  │                                  │
│  └───────────────────────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Impacted Backend Modules

| Module | Files | Impact Level |
|--------|-------|--------------|
| **Storage Layer** | `server/storage.ts`, `server/persistentStorage.ts` | HIGH - Complete rewrite |
| **Component Service** | `server/services/componentService.ts` | MEDIUM - Query changes |
| **Job Service** | `server/services/jobService.ts` | MEDIUM - Query changes |
| **Work Order Service** | `server/services/workOrderService.ts` | MEDIUM - Query changes |
| **Running Hours Service** | `server/services/runningHoursService.ts` | MEDIUM - Transaction handling |
| **Job Due Scanner** | `server/services/jobDueScanner.ts` | MEDIUM - Query optimization |
| **Routes** | `server/routes.ts`, `server/routes/*.ts` | LOW - Storage calls unchanged |

### 1.4 Read/Write Patterns (Current)

| Operation Type | Frequency | Current Behavior |
|----------------|-----------|------------------|
| **Component Reads** | HIGH (every page load) | O(1) in-memory lookup |
| **Work Order Queries** | HIGH (filtered views) | Array filter in memory |
| **Running Hours Updates** | MEDIUM (daily bulk) | Cascade update + full persist |
| **Spare Inventory Changes** | MEDIUM | Single record update + full persist |
| **Defect CRUD** | LOW-MEDIUM | Standard CRUD + full persist |
| **Audit Log Writes** | HIGH (every mutation) | Append to array + full persist |

### 1.5 Data Classification

| Data Type | Migrate to DB? | Reason |
|-----------|----------------|--------|
| Users, Vessels, Fleets | YES | Core reference data |
| Components, Jobs, Work Orders | YES | Transactional data with relationships |
| Spares, Stores Items | YES | Inventory with history tracking |
| Defects, Actions, Attachments | YES | Compliance data with audit trail |
| Running Hours Audits | YES | Time-series audit data |
| Alert Policies/Events | YES | Notification system |
| Form Definitions/Versions | YES | Dynamic form configuration |
| Import History/Change Logs | YES | Audit and undo functionality |
| Certificates, Surveys | YES | Regulatory compliance |
| Binary Files (PDFs, images) | NO | Keep in Object Storage |
| Session/Cache Data | NO | Use Redis or in-memory |

### 1.6 Drizzle ORM Integration Points

**Current Schema Location:** `shared/schema.ts`

The schema already defines all 50 tables with:
- Column types and constraints
- Index definitions
- Insert schemas (Zod validation)
- TypeScript types

**Required Changes:**
1. Create `PostgresStorage` class implementing `IStorage`
2. Use Drizzle query builder for all CRUD operations
3. Add transaction support for multi-table operations
4. Implement connection pooling via `drizzle-orm/neon-http`

### 1.7 Environment Variable Changes

| Variable | Current | Target |
|----------|---------|--------|
| `DATABASE_URL` | Optional (unused) | Required (Postgres connection string) |
| `STORAGE_MODE` | N/A (always file) | `file` \| `postgres` (feature flag) |
| `DB_POOL_SIZE` | N/A | `10` (recommended) |
| `DB_SSL_MODE` | N/A | `require` (for Neon) |

### 1.8 Migration Rollback Considerations

1. **Before Migration:** Export `test-data.json` as backup
2. **Feature Flag:** Implement `STORAGE_MODE` environment variable
3. **Parallel Running:** Run both storage backends during transition
4. **Data Validation:** Checksum comparison between file and DB
5. **Rollback Path:** Switch `STORAGE_MODE=file` to revert instantly

---

## 2. Full DB Architecture - Table Designs

### 2.1 Table Summary (50 Tables)

| Category | Tables | Purpose |
|----------|--------|---------|
| **Core** | users, fleets, vessels | User and vessel management |
| **Components** | components, component_documents, component_class_regulatory, component_maintenance_history, component_requisitions, component_running_hours_log | Equipment registry and tracking |
| **Maintenance** | jobs, work_orders, work_order_executions | Planned and unplanned maintenance |
| **Running Hours** | running_hours_audit | Equipment runtime tracking |
| **Spares** | spares, spares_history | Spare parts inventory |
| **Stores** | stores_items, stores_ledger | Consumables and supplies |
| **Defects** | defects, defect_actions, defect_attachments, recurring_defects, recurring_defect_links | Defect management |
| **Alerts** | alert_policies, alert_events, alert_deliveries, alert_config | Notification system |
| **Forms** | form_definitions, form_versions, form_version_usage | Dynamic forms |
| **Change Requests** | change_request, change_request_attachment, change_request_comment | Modify PMS workflow |
| **IHM** | ihm_items, ihm_maintenance_log | Hazardous materials inventory |
| **Fleet Admin** | makers, master_lists, maker_list, sfi_details, master_data | Master data management |
| **Fleet Mappings** | fleet_vessel_mapping, fleet_component_mapping, fleet_job_vessel_mapping, fleet_spare_vessel_mapping | Fleet-to-vessel data sync |
| **Import** | import_history, import_change_log, bulk_import_history, bulk_import_errors | Data import tracking |
| **Audit** | audit_log | System-wide audit trail |
| **Settings** | pms_vessel_settings | Per-vessel configuration |

### 2.2 Detailed Table Designs

---

#### 2.2.1 `users` - User Registry

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role user_role NOT NULL DEFAULT 'Ship', -- ENUM: 'Ship', 'Office', 'PMS Admin'
  vessel_id TEXT, -- Required for Ship role
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_vessel ON users(vessel_id);
```

**Relationships:**
- `vessel_id` → `vessels.id` (optional FK for Ship users)

---

#### 2.2.2 `fleets` - Fleet Registry

```sql
CREATE TABLE fleets (
  id TEXT PRIMARY KEY, -- Fleet code: FLT001
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

#### 2.2.3 `vessels` - Vessel Registry

```sql
CREATE TABLE vessels (
  id TEXT PRIMARY KEY, -- Vessel code: V001
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  fleet_id TEXT REFERENCES fleets(id) ON DELETE SET NULL,
  imo_number TEXT,
  vessel_type TEXT,
  flag TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vessels_fleet ON vessels(fleet_id);
CREATE INDEX idx_vessels_imo ON vessels(imo_number);
```

---

#### 2.2.4 `components` - Equipment Registry

```sql
CREATE TABLE components (
  id TEXT PRIMARY KEY,
  name TEXT, -- Nullable for fleet templates
  component_code TEXT,
  parent_id TEXT REFERENCES components(id) ON DELETE SET NULL,
  category TEXT,
  current_cumulative_rh DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_updated TEXT,
  vessel_id TEXT REFERENCES vessels(id) ON DELETE CASCADE,
  vessel_code TEXT,
  data_scope TEXT NOT NULL DEFAULT 'vessel', -- 'fleet' | 'vessel'
  
  -- Fleet Equipment Fields
  fleet_equipment_code TEXT,
  fleet_equipment_name TEXT,
  parent_fleet_equipment_code TEXT,
  
  -- Maker and Model
  maker TEXT,
  maker_code TEXT,
  model TEXT,
  model_number TEXT,
  model_code TEXT,
  serial_no TEXT,
  drawing_no TEXT,
  
  -- Categorization
  department TEXT,
  dept_category TEXT,
  component_category TEXT,
  location TEXT,
  eqpt_system_dept TEXT,
  
  -- Dates
  commissioned_date TEXT,
  installation_date TEXT,
  
  -- Status
  critical BOOLEAN DEFAULT false,
  class_item BOOLEAN DEFAULT false,
  condition_based BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_parent BOOLEAN DEFAULT false,
  
  -- Technical
  rating TEXT,
  no_of_units TEXT,
  parent_component TEXT,
  dimensions_size TEXT,
  notes TEXT,
  running_hours DECIMAL(10,2),
  
  -- Fleet-specific
  applicable_vessel_ids TEXT[],
  scope_notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comp_data_scope ON components(data_scope);
CREATE INDEX idx_comp_fleet_tree ON components(data_scope, parent_fleet_equipment_code);
CREATE INDEX idx_comp_vessel_tree ON components(data_scope, vessel_id, parent_id);
CREATE UNIQUE INDEX unique_fleet_equipment_code ON components(fleet_equipment_code, data_scope);
CREATE INDEX idx_comp_component_code ON components(component_code);
```

**Relationships:**
- Self-referential: `parent_id` → `components.id`
- `vessel_id` → `vessels.id`

---

#### 2.2.5 `jobs` - Maintenance Job Templates

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  vessel_id TEXT REFERENCES vessels(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  component_code TEXT NOT NULL,
  component_name TEXT NOT NULL,
  job_no TEXT NOT NULL UNIQUE,
  job_title TEXT NOT NULL,
  assigned_to TEXT,
  
  -- Maintenance Configuration
  maintenance_type TEXT, -- 'Inspection' | 'Overhaul' | 'Service' | 'Testing'
  maintenance_basis TEXT, -- 'Calendar' | 'Running Hours'
  frequency_type TEXT,
  frequency_value TEXT,
  frequency_unit TEXT, -- 'Months' | 'Years' | 'Weeks' | 'Days' | 'Hours'
  interval_running_hour INTEGER,
  
  -- Lead Time
  lead_time_value INTEGER,
  lead_time_unit TEXT,
  
  -- Due Date Tracking
  initial_next_due TEXT,
  last_done_date TEXT,
  next_due_date TEXT,
  last_done_rh TEXT,
  next_due_rh TEXT,
  
  -- Priority and Classification
  job_priority TEXT, -- 'Low' | 'Medium' | 'High' | 'Critical'
  class_related TEXT, -- 'Yes' | 'No'
  brief_work_description TEXT,
  job_description TEXT,
  approver TEXT,
  department TEXT,
  
  -- Template Data (JSONB)
  required_spare_parts JSONB NOT NULL DEFAULT '[]',
  required_tools JSONB NOT NULL DEFAULT '[]',
  safety_requirements JSONB NOT NULL DEFAULT '{"ppeRequirements":[],"permitRequirements":[],"otherRequirements":[]}',
  
  -- Fleet-specific
  data_scope TEXT NOT NULL DEFAULT 'vessel',
  fleet_equipment_code TEXT,
  fleet_job_code TEXT,
  sfi_code TEXT,
  criticality TEXT,
  is_active BOOLEAN DEFAULT true,
  estimated_man_hours DECIMAL(6,2),
  
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_vessel ON jobs(vessel_id);
CREATE INDEX idx_job_component ON jobs(component_id);
CREATE INDEX idx_job_component_code ON jobs(component_code);
CREATE INDEX idx_job_data_scope ON jobs(data_scope);
CREATE INDEX idx_job_next_due ON jobs(next_due_date);
CREATE UNIQUE INDEX unique_job_no ON jobs(job_no);
```

---

#### 2.2.6 `work_orders` - Work Orders

```sql
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  vessel_id TEXT REFERENCES vessels(id) ON DELETE CASCADE,
  component TEXT NOT NULL,
  component_code TEXT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  work_order_no TEXT NOT NULL,
  work_order_type TEXT NOT NULL DEFAULT 'Planned', -- 'Planned' | 'Unplanned'
  template_code TEXT,
  execution_id TEXT,
  job_title TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  
  -- Status and Dates
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Active', -- 'Completed' | 'Due' | 'Overdue' | 'Postponed' | 'Pending Approval' | 'Active'
  date_completed TEXT,
  submitted_date TEXT,
  
  -- Form Data (JSONB)
  form_data JSONB,
  
  -- Maintenance Configuration
  task_type TEXT,
  maintenance_type TEXT,
  maintenance_basis TEXT,
  frequency_value TEXT,
  frequency_unit TEXT,
  
  -- Approval
  approver_remarks TEXT,
  is_execution BOOLEAN NOT NULL DEFAULT false,
  template_id TEXT,
  approver TEXT,
  approval_date TEXT,
  rejection_date TEXT,
  rejection_comments TEXT,
  approval_action TEXT,
  
  -- Next Due
  next_due_date TEXT,
  next_due_reading TEXT,
  current_reading TEXT,
  
  -- Classification
  class_related TEXT,
  job_priority TEXT,
  brief_work_description TEXT,
  
  -- Fleet-specific
  data_scope TEXT NOT NULL DEFAULT 'vessel',
  fleet_equipment_code TEXT,
  fleet_job_code TEXT,
  job_group TEXT,
  job_category TEXT,
  sfi_code TEXT,
  maintenance_interval_value INTEGER,
  maintenance_interval_unit TEXT,
  interval_running_hour INTEGER,
  department TEXT,
  criticality TEXT,
  is_active BOOLEAN DEFAULT true,
  applicable_vessel_ids TEXT[],
  scope_notes TEXT,
  
  -- Postponement
  postponement_end_date TEXT,
  postponement_reason TEXT,
  postponement_authorized_by TEXT,
  on_demand_reason TEXT,
  
  -- Part A - Template (JSONB)
  required_spare_parts JSONB NOT NULL DEFAULT '[]',
  required_tools JSONB NOT NULL DEFAULT '[]',
  safety_requirements JSONB NOT NULL DEFAULT '{"ppeRequirements":[],"permitRequirements":[],"otherRequirements":[]}',
  
  -- Part B - Execution (JSONB)
  uploaded_documents JSONB NOT NULL DEFAULT '[]',
  consumed_spare_parts JSONB NOT NULL DEFAULT '[]',
  
  -- Part B - Execution Fields
  risk_assessment_status TEXT,
  safety_checklists_status TEXT,
  operational_forms_status TEXT,
  start_date_time TEXT,
  completion_date_time TEXT,
  execution_assigned_to TEXT,
  performed_by TEXT,
  no_of_persons TEXT,
  total_time_hours TEXT,
  manhours TEXT,
  work_carried_out TEXT,
  job_experience_notes TEXT,
  
  -- Running Hours
  previous_reading TEXT,
  running_hours TEXT,
  running_hours_difference TEXT,
  reading_date TEXT,
  wo_execution_id TEXT,
  remarks TEXT,
  completion_remarks TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wo_vessel ON work_orders(vessel_id);
CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_due_date ON work_orders(due_date);
CREATE INDEX idx_wo_component ON work_orders(component_code);
CREATE INDEX idx_wo_template ON work_orders(template_code);
CREATE INDEX idx_wo_data_scope ON work_orders(data_scope);
CREATE INDEX idx_wo_fleet_equipment ON work_orders(data_scope, fleet_equipment_code);
CREATE UNIQUE INDEX unique_fleet_job_code ON work_orders(fleet_job_code, data_scope);
```

---

#### 2.2.7 `spares` - Spare Parts Inventory

```sql
CREATE TABLE spares (
  id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  part_code TEXT NOT NULL,
  part_name TEXT NOT NULL,
  component_id TEXT REFERENCES components(id) ON DELETE SET NULL,
  component_code TEXT,
  component_name TEXT NOT NULL,
  component_spare_code TEXT,
  critical TEXT NOT NULL, -- 'Critical' | 'Non-Critical'
  
  -- Stock Levels
  rob INTEGER NOT NULL DEFAULT 0,
  rob_location_a INTEGER NOT NULL DEFAULT 0,
  rob_location_b INTEGER NOT NULL DEFAULT 0,
  min INTEGER NOT NULL DEFAULT 0,
  max INTEGER,
  
  -- Pricing and Procurement
  unit_cost DECIMAL(10,2),
  stocking_number TEXT,
  lead_time TEXT,
  supplier TEXT,
  last_order_date TEXT,
  location TEXT,
  
  vessel_id TEXT REFERENCES vessels(id) ON DELETE CASCADE,
  deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Fleet-specific
  data_scope TEXT NOT NULL DEFAULT 'vessel',
  fleet_equipment_code TEXT,
  fleet_part_code TEXT,
  part_number TEXT,
  uom TEXT,
  drawing_number TEXT,
  drawing_no TEXT,
  location_2 TEXT,
  remarks TEXT,
  unit TEXT,
  position_number TEXT,
  note TEXT,
  specification TEXT,
  maker TEXT,
  maker_code TEXT,
  model TEXT,
  manual_name TEXT,
  page_number TEXT,
  criticality TEXT,
  is_active BOOLEAN DEFAULT true,
  ihm TEXT,
  evidence_type TEXT,
  part_category TEXT,
  applicable_vessel_ids TEXT[],
  scope_notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_spare_component ON spares(component_id);
CREATE INDEX idx_spare_vessel ON spares(vessel_id);
CREATE INDEX idx_spare_code ON spares(vessel_id, component_spare_code);
CREATE INDEX idx_spare_data_scope ON spares(data_scope);
CREATE INDEX idx_spare_fleet_equipment ON spares(data_scope, fleet_equipment_code);
CREATE UNIQUE INDEX unique_fleet_part_code ON spares(fleet_part_code, data_scope);
CREATE INDEX idx_spare_deleted ON spares(deleted);
```

---

#### 2.2.8 `defects` - Defect Tracking

```sql
CREATE TABLE defects (
  id TEXT PRIMARY KEY,
  vessel_id TEXT NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  vessel_name TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Defect' | 'COC' | 'Observation' | 'NCR'
  defect_type TEXT,
  description TEXT NOT NULL,
  description_html TEXT,
  description_text TEXT,
  action_taken_requested TEXT,
  target_close_date TEXT,
  date_completed TEXT,
  status TEXT NOT NULL DEFAULT 'Open', -- 'Open' | 'Pending' | 'In-Progress' | 'Closed' | etc.
  priority TEXT DEFAULT 'Medium',
  critical BOOLEAN NOT NULL DEFAULT false,
  is_coc BOOLEAN NOT NULL DEFAULT false,
  severity INTEGER DEFAULT 1,
  source TEXT, -- 'SIRE' | 'PSC' | 'Internal' | 'Class'
  
  -- Equipment Details
  equipment_category TEXT,
  equipment_type TEXT,
  equipment_make TEXT,
  equipment_model TEXT,
  equipment_serial_no TEXT,
  equipment_location TEXT,
  equipment_system TEXT,
  component_id TEXT REFERENCES components(id) ON DELETE SET NULL,
  
  -- Additional Fields
  purchase_order_ref TEXT,
  responsible_dept TEXT,
  verified_date TEXT,
  defect_category TEXT,
  
  -- VIQ Fields
  viq_version TEXT,
  viq_ref TEXT,
  viq_chapter TEXT,
  viq_section TEXT,
  sfi_code_ref TEXT,
  
  -- Root Cause Analysis (JSONB)
  immediate_cause JSONB,
  root_cause JSONB,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_defect_vessel ON defects(vessel_id);
CREATE INDEX idx_defect_status ON defects(status);
CREATE INDEX idx_defect_category ON defects(category);
CREATE INDEX idx_defect_issue_date ON defects(issue_date);
CREATE INDEX idx_defect_component ON defects(component_id);
CREATE INDEX idx_defect_priority ON defects(priority);
```

---

#### 2.2.9 `running_hours_audit` - Running Hours Tracking

```sql
CREATE TABLE running_hours_audit (
  id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  vessel_id TEXT NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  previous_rh DECIMAL(10,2) NOT NULL,
  new_rh DECIMAL(10,2) NOT NULL,
  cumulative_rh DECIMAL(10,2) NOT NULL,
  date_updated_local TEXT NOT NULL,
  date_updated_tz TEXT NOT NULL,
  entered_at_utc TIMESTAMP NOT NULL,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL, -- 'single' | 'bulk'
  notes TEXT,
  meter_replaced BOOLEAN NOT NULL DEFAULT false,
  old_meter_final DECIMAL(10,2),
  new_meter_start DECIMAL(10,2),
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX idx_component_entered ON running_hours_audit(component_id, entered_at_utc);
CREATE INDEX idx_component_date ON running_hours_audit(component_id, date_updated_local);
```

---

#### 2.2.10 Additional Tables (Summary)

| Table | Key Columns | Primary Relationships |
|-------|-------------|----------------------|
| `work_order_executions` | template_id, component_id, execution_id | → work_orders, components |
| `spares_history` | spare_id, event_type, qty_change | → spares |
| `stores_items` | vessel_id, item_type, item_code | → vessels (isolated from PMS) |
| `stores_ledger` | item_id, event_type, qty_change | → stores_items |
| `defect_actions` | defect_id, action_type, due_date | → defects |
| `defect_attachments` | defect_id, filename, url | → defects |
| `recurring_defects` | equipment_key, occurrence_count | - |
| `recurring_defect_links` | recurring_id, defect_id | → recurring_defects, defects |
| `alert_policies` | alert_type, enabled, thresholds | - |
| `alert_events` | policy_id, object_type, dedupe_key | → alert_policies |
| `alert_deliveries` | event_id, channel, status | → alert_events |
| `alert_config` | vessel_id, quiet_hours_*, escalation_* | → vessels |
| `change_request` | vessel_id, category, status | → vessels |
| `change_request_attachment` | change_request_id, filename | → change_request |
| `change_request_comment` | change_request_id, message | → change_request |
| `form_definitions` | name, subgroup | - |
| `form_versions` | form_id, version_no, schema_json | → form_definitions |
| `form_version_usage` | form_version_id, used_in_module | → form_versions |
| `ihm_items` | component_id, spare_id, presence | → components, spares |
| `ihm_maintenance_log` | work_order_id, action, materials | → work_orders |
| `component_documents` | component_id, file_key, file_type | → components |
| `component_class_regulatory` | component_id, survey_type, expiry_date | → components |
| `component_maintenance_history` | component_id, work_order_id (IMMUTABLE) | → components, work_orders |
| `component_requisitions` | component_id, requisition_no, status | → components |
| `component_running_hours_log` | component_id, previous_rh, new_rh | → components |
| `import_history` | type, mode, status | - |
| `import_change_log` | import_history_id, entity_type | → import_history |
| `audit_log` | entity_type, entity_id, action_type | - |
| `pms_vessel_settings` | vessel_id, lead times, grace periods | → vessels |
| `makers` | maker_code, maker_name | - |
| `master_lists` | list_type, list_key, list_value | - |
| `maker_list` | code, name | - |
| `sfi_details` | sfi_code, description | - |
| `master_data` | category, code, value | - |
| `fleet_vessel_mapping` | fleet_id, vessel_id | → fleets, vessels |
| `fleet_component_mapping` | fleet_component_id, vessel_id | - |
| `fleet_job_vessel_mapping` | fleet_job_id, vessel_id | - |
| `fleet_spare_vessel_mapping` | fleet_spare_id, vessel_id | - |
| `bulk_import_history` | import_type, vessel_id, status | → vessels |
| `bulk_import_errors` | import_id, row_number, error | → bulk_import_history |

---

## 3. Module-to-Database Flow

### 3.1 PMS Module (Components, Jobs, Work Orders)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PMS MODULE DATA FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tables Used:                                                    │
│  ├── components (R/W)                                           │
│  ├── jobs (R/W)                                                 │
│  ├── work_orders (R/W)                                          │
│  ├── work_order_executions (R/W)                                │
│  ├── running_hours_audit (R/W)                                  │
│  ├── component_maintenance_history (R - IMMUTABLE)              │
│  ├── component_documents (R/W)                                  │
│  └── pms_vessel_settings (R/W)                                  │
│                                                                  │
│  Services:                                                       │
│  ├── componentService.ts → components, component_*              │
│  ├── jobService.ts → jobs                                       │
│  ├── workOrderService.ts → work_orders, executions              │
│  ├── runningHoursService.ts → running_hours_audit               │
│  └── jobDueScanner.ts → jobs, work_orders (auto-generation)     │
│                                                                  │
│  Key Operations:                                                 │
│  ├── Component CRUD with hierarchy                              │
│  ├── Job template management                                    │
│  ├── Work order lifecycle (create→execute→approve)              │
│  ├── Running hours cascade updates (TRANSACTION REQUIRED)       │
│  └── Auto-generation of work orders when jobs are due           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Transaction Requirements:**
- Running hours cascade: Update parent → children in single transaction
- Work order approval: Create execution + update history + update spare inventory

---

### 3.2 Spares Module

```
Tables: spares, spares_history
Services: routes.ts (inline)

CRUD Flow:
├── List: SELECT * FROM spares WHERE vessel_id = ? AND deleted = false
├── Create: INSERT INTO spares + INSERT INTO spares_history (CREATE event)
├── Update: UPDATE spares + INSERT INTO spares_history (EDIT event)
├── Consume: UPDATE spares.rob + INSERT INTO spares_history (CONSUME event)
└── Receive: UPDATE spares.rob + INSERT INTO spares_history (RECEIVE event)

Constraints:
├── rob = rob_location_a + rob_location_b (computed, enforce via trigger)
├── Soft delete (deleted = true, no hard delete)
└── component_spare_code unique within vessel
```

---

### 3.3 Stores Module (Isolated from PMS)

```
Tables: stores_items, stores_ledger
Note: ZERO PMS LINKAGES per Business Rule Section 7.2

CRUD Flow:
├── List: SELECT * FROM stores_items WHERE vessel_id = ? AND item_type = ?
├── Create: INSERT INTO stores_items
├── Consume: UPDATE rob + INSERT INTO stores_ledger (CONSUME)
├── Receive: UPDATE rob + INSERT INTO stores_ledger (RECEIVE)
└── Transfer: UPDATE rob for both items + INSERT ledger entries
```

---

### 3.4 Defects Module

```
Tables: defects, defect_actions, defect_attachments, recurring_defects, recurring_defect_links

CRUD Flow:
├── Create Defect: INSERT defect + auto-calculate recurring links
├── Add Action: INSERT defect_action
├── Upload Attachment: INSERT defect_attachment + Object Storage
├── Close Defect: UPDATE status + INSERT action with closure details
└── Recurring Calculation: Aggregate by equipment_key, create/update recurring_defects

Constraints:
├── Equipment key normalization for recurring detection
├── Status transitions: Open → In-Progress → Closed
└── COC (Condition of Class) flag tracking
```

---

### 3.5 Alerts Module

```
Tables: alert_policies, alert_events, alert_deliveries, alert_config

Flow:
├── Policy CRUD: Manage alert rules
├── Event Generation: Scan for due items → INSERT alert_events
├── Delivery: INSERT alert_deliveries → Send via channel
└── Acknowledge: UPDATE alert_events.ack_by, ack_at

Deduplication:
├── dedupe_key = policy_id + object_type + object_id + state
└── Only create new event if dedupe_key doesn't exist in 24h window
```

---

### 3.6 Change Requests Module (Modify PMS)

```
Tables: change_request, change_request_attachment, change_request_comment

Workflow:
├── Draft: Create change request with proposed changes
├── Submit: Update status → 'submitted'
├── Review: Add comments, attachments
├── Approve: Apply changes to target entity (TRANSACTION)
│   ├── Update target table (components/jobs/spares/stores)
│   ├── Increment revision_number
│   ├── Append to revision_history JSONB
│   └── INSERT audit_log
└── Reject: Update status → 'rejected' with reason
```

---

## 4. JSON to SQL Mapping

### 4.1 Primary Data File: `test-data.json`

| JSON Key | SQL Table(s) | Mapping Notes |
|----------|--------------|---------------|
| `users` | `users` | Direct 1:1 mapping |
| `fleets` | `fleets` | Direct 1:1 mapping |
| `vessels` | `vessels` | Direct 1:1 mapping |
| `components` | `components` | Flatten nested arrays |
| `spares` | `spares` | Direct 1:1 mapping |
| `sparesHistory` | `spares_history` | Direct 1:1 mapping |
| `jobs` | `jobs` | JSONB for arrays (required_spare_parts, etc.) |
| `workOrders` | `work_orders` | Array → Table, JSONB for nested arrays |
| `workOrderExecutions` | `work_order_executions` | Direct 1:1 mapping |
| `defects` | `defects` | JSONB for immediate_cause, root_cause |
| `defectActions` | `defect_actions` | Direct 1:1 mapping |
| `defectAttachments` | `defect_attachments` | Direct 1:1 mapping |
| `recurringDefects` | `recurring_defects` | Direct 1:1 mapping |
| `recurringDefectLinks` | `recurring_defect_links` | Join table |
| `runningHoursAudits` | `running_hours_audit` | Direct 1:1 mapping |
| `alertPolicies` | `alert_policies` | JSON strings → JSONB or TEXT |
| `alertEvents` | `alert_events` | Direct 1:1 mapping |
| `alertDeliveries` | `alert_deliveries` | Direct 1:1 mapping |
| `alertConfigs` | `alert_config` | Direct 1:1 mapping |
| `formDefinitions` | `form_definitions` | Direct 1:1 mapping |
| `formVersions` | `form_versions` | schema_json stays as TEXT |
| `changeRequests` | `change_request` | JSONB for snapshot/changes |
| `storesItems` | `stores_items` | Direct 1:1 mapping |
| `storesLedger` | `stores_ledger` | Direct 1:1 mapping |
| `importHistory` | `import_history` | Direct 1:1 mapping |
| `auditLogs` | `audit_log` | JSONB for payload |
| `pmsVesselSettings` | `pms_vessel_settings` | Direct 1:1 mapping |
| `counters` | N/A | Use GENERATED BY DEFAULT AS IDENTITY |

### 4.2 Nested JSON → Normalized Tables

**Example: Work Order with Spare Parts**

```json
// Current JSON structure
{
  "requiredSpareParts": [
    {"partNo": "SP-001", "description": "Filter", "quantityRequired": 2}
  ],
  "consumedSpareParts": [
    {"partNo": "SP-001", "quantityConsumed": 2, "location": "A"}
  ]
}
```

**SQL Mapping (using JSONB):**
```sql
-- Keep as JSONB for flexibility
required_spare_parts JSONB NOT NULL DEFAULT '[]',
consumed_spare_parts JSONB NOT NULL DEFAULT '[]'
```

**Rationale for JSONB:**
- Arrays change structure frequently
- No need to query individual spare parts from work order
- Spare consumption updates inventory table separately

### 4.3 Fields That Should Become Enums

```sql
-- User Roles
CREATE TYPE user_role AS ENUM ('Ship', 'Office', 'PMS Admin');

-- Work Order Status
CREATE TYPE wo_status AS ENUM ('Active', 'Due', 'Due (Grace P)', 'Overdue', 'Postponed', 'Pending Approval', 'Completed', 'Rejected');

-- Defect Status
CREATE TYPE defect_status AS ENUM ('Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred', 'Closed', 'Cancelled');

-- Maintenance Basis
CREATE TYPE maintenance_basis AS ENUM ('Calendar', 'Running Hours');

-- Alert Channels
CREATE TYPE alert_channel AS ENUM ('email', 'in_app', 'sms', 'slack');
```

---

## 5. Backend Integration & Refactor Plan

### 5.1 Storage Adapter Pattern

**New File: `server/postgresStorage.ts`**

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import type { IStorage } from './storage';

export class PostgresStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  
  constructor(databaseUrl: string) {
    const sql = neon(databaseUrl);
    this.db = drizzle(sql, { schema });
  }
  
  // Implement all IStorage methods using Drizzle queries
  async getComponents(vesselId: string): Promise<Component[]> {
    return this.db.query.components.findMany({
      where: eq(schema.components.vesselId, vesselId)
    });
  }
  
  async createComponent(component: InsertComponent): Promise<Component> {
    const [created] = await this.db.insert(schema.components)
      .values(component)
      .returning();
    return created;
  }
  
  // ... 150+ more methods
}
```

**Updated File: `server/storage.ts`**

```typescript
import { PersistentFileStorage } from './persistentStorage';
import { PostgresStorage } from './postgresStorage';

export interface IStorage {
  // ... existing interface
}

// Feature flag-based storage selection
function createStorage(): IStorage {
  const mode = process.env.STORAGE_MODE || 'file';
  
  if (mode === 'postgres' && process.env.DATABASE_URL) {
    console.log('✅ Using PostgreSQL storage');
    return new PostgresStorage(process.env.DATABASE_URL);
  }
  
  console.log('📂 Using file-based storage');
  return new PersistentFileStorage();
}

export const storage: IStorage = createStorage();
```

### 5.2 Migration Sequence

```
Phase 1: Prepare (Week 1)
├── Create PostgresStorage class (empty implementation)
├── Add STORAGE_MODE environment variable
├── Implement core CRUD methods (10-15 methods)
└── Test with isolated tables (users, vessels, fleets)

Phase 2: Reference Data (Week 2)
├── Migrate static tables (makers, master_lists, sfi_details)
├── Migrate fleet mappings
├── Test fleet admin functionality
└── Data reconciliation checks

Phase 3: Transactional Data (Week 3-4)
├── Migrate components with hierarchy
├── Migrate jobs with due date calculations
├── Migrate work orders with all states
├── Migrate spares and stores with history
└── Transaction testing for cascade operations

Phase 4: Compliance Data (Week 5)
├── Migrate defects with actions/attachments
├── Migrate certificates and surveys
├── Migrate change requests
├── Audit log integration
└── Immutable history table enforcement

Phase 5: Cutover (Week 6)
├── Enable STORAGE_MODE=postgres behind feature flag
├── A/B testing with subset of users
├── Performance benchmarking
├── Full production cutover
└── Remove file storage fallback (optional)
```

### 5.3 Key Refactoring Points

| File | Line Range | Change Required |
|------|------------|-----------------|
| `server/storage.ts` | 1-736 | Add storage factory |
| `server/persistentStorage.ts` | All | Keep as fallback |
| `server/services/componentService.ts` | All | No change (uses IStorage) |
| `server/services/runningHoursService.ts` | 50-120 | Add transaction wrapper |
| `server/services/jobDueScanner.ts` | 30-150 | Optimize queries for DB |
| `server/routes.ts` | All | No change (uses storage) |
| `server/initDb.ts` | All | Add Drizzle migration runner |

---

## 6. Frontend Considerations

### 6.1 API Response Shape Changes

**No changes required.** The `IStorage` interface ensures identical response shapes regardless of backend.

### 6.2 New Query Optimizations

With PostgreSQL, enable:
- Server-side pagination (`?page=1&limit=50`)
- Server-side filtering (`?status=Due&vesselId=V001`)
- Server-side sorting (`?orderBy=dueDate&order=asc`)

**Frontend Changes:**
```typescript
// Before: Client-side filtering
const { data: allWorkOrders } = useQuery(['/api/work-orders']);
const filtered = allWorkOrders?.filter(wo => wo.status === 'Due');

// After: Server-side filtering
const { data: dueWorkOrders } = useQuery(['/api/work-orders', { status: 'Due' }]);
```

### 6.3 TanStack Query Cache Adjustments

With database consistency, increase stale times:
```typescript
export const STALE_TIMES = {
  CRITICAL: 5 * 60 * 1000,   // 5 minutes (was 2 minutes)
  REFERENCE: 15 * 60 * 1000, // 15 minutes (was 5 minutes)
  STATIC: 60 * 60 * 1000,    // 1 hour (was 30 minutes)
};
```

---

## 7. Indexing, Performance & Scaling

### 7.1 Index Strategy

| Table | Index | Type | Reason |
|-------|-------|------|--------|
| `work_orders` | (vessel_id, status, due_date) | B-tree Composite | Dashboard queries |
| `work_orders` | (status) WHERE status = 'Due' | Partial | Active items only |
| `components` | (vessel_id, component_code) | B-tree Composite | Component lookup |
| `components` | (parent_id) | B-tree | Hierarchy traversal |
| `spares` | (vessel_id, deleted, rob) | B-tree Composite | Low stock alerts |
| `defects` | (vessel_id, status, issue_date) | B-tree Composite | Defect list |
| `running_hours_audit` | (component_id, entered_at_utc) | B-tree Composite | History queries |
| `audit_log` | (timestamp DESC) | B-tree | Recent activity |
| `alert_events` | (dedupe_key, created_at) | B-tree | Deduplication |

### 7.2 Partition Candidates

| Table | Partition Key | Strategy |
|-------|---------------|----------|
| `running_hours_audit` | `entered_at_utc` | Range by month |
| `audit_log` | `timestamp` | Range by month |
| `spares_history` | `timestamp_utc` | Range by year |
| `stores_ledger` | `timestamp_utc` | Range by year |

### 7.3 PostgreSQL Configuration (Neon)

Neon handles most configuration automatically. For connection pooling:
```typescript
// Use Neon serverless driver with connection pooling
import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true; // Enable connection caching
neonConfig.poolQueryViaFetch = true;    // Use HTTP for queries (Neon optimized)
```

### 7.4 Expected Performance Impact

| Operation | File Storage | PostgreSQL | Change |
|-----------|--------------|------------|--------|
| Read single record | O(1) memory | ~5-20ms | Slightly slower |
| List 100 records | O(n) filter | ~10-30ms | Faster for large datasets |
| Complex filter | O(n) full scan | ~20-50ms | Much faster with indexes |
| Write single record | Full JSON rewrite | ~5-15ms | Much faster |
| Bulk write 100 records | Full JSON rewrite | ~50-100ms | Much faster |
| Startup time | Parse entire JSON | Connect only | Much faster |

---

## Summary

This document provides a complete PostgreSQL database architecture plan for migrating from file-based storage. Key points:

1. **50 tables** already defined in `shared/schema.ts` with Drizzle ORM
2. **IStorage interface** allows seamless backend swapping
3. **STORAGE_MODE** feature flag enables gradual migration
4. **No frontend changes** required due to consistent API shapes
5. **Transaction support** needed for cascade operations
6. **Indexing strategy** optimizes common query patterns

**Next Steps (When Ready to Implement):**
1. Create `PostgresStorage` class implementing `IStorage`
2. Add `STORAGE_MODE` environment variable handling
3. Write data migration scripts from JSON to PostgreSQL
4. Enable feature flag for testing
5. Monitor performance and iterate

---

*Document Version: 1.0*
*Created: December 2025*
*Status: PLANNING ONLY - NOT APPLIED*
