# Module 1-3: UI → DB Flow Verification Documentation

## Overview

This document verifies the complete data flow from UI to Database for Modules 1-3 of the Seafarer Technical Management System PostgreSQL migration.

## Migration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  UI Forms   │  │ Data Tables │  │  Dashboards │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                │                │                         │
│         └────────────────┼────────────────┘                         │
│                          ▼                                          │
│                 @tanstack/react-query                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP API Calls
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express.js)                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    server/routes.ts                          │   │
│  │              (API endpoint handlers)                         │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 server/hybridStorage.ts                      │   │
│  │           (Routing layer: PostgreSQL vs FileStorage)         │   │
│  │                                                              │   │
│  │  Module 1-3: Routes to PostgresStorage                       │   │
│  │  Module 4+:  Falls back to FileStorage (test-data.json)      │   │
│  └──────────┬───────────────────────────────────┬──────────────┘   │
│             │                                   │                   │
│             ▼                                   ▼                   │
│  ┌──────────────────────┐         ┌─────────────────────────────┐  │
│  │server/postgresStorage│         │ server/persistentFileStorage│  │
│  │    (PostgreSQL)      │         │    (test-data.json)         │  │
│  └──────────┬───────────┘         └─────────────────────────────┘  │
│             │                                                       │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL (Neon)                             │
│                                                                     │
│  Module 1: users, fleets, vessels, pms_vessel_settings              │
│  Module 2: makers, master_lists, maker_list, sfi_details,           │
│            master_data                                              │
│  Module 3: components, component_documents, component_class_        │
│            regulatory, component_maintenance_history,               │
│            component_requisitions, running_hours_audit              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module 1: Core Reference Data

### Tables Migrated

| Table | PostgreSQL Table | Status | Primary Key |
|-------|-----------------|--------|-------------|
| Users | `users` | ✅ Migrated | `id` (text) |
| Fleets | `fleets` | ✅ Migrated | `id` (text) |
| Vessels | `vessels` | ✅ Migrated | `id` (text) |
| PMS Vessel Settings | `pms_vessel_settings` | ✅ Migrated | `id` (serial) |

### UI → DB Flow: Users

```
UI: Login/User Management
    ↓
API: GET/POST/PATCH/DELETE /api/users
    ↓
Routes: server/routes.ts → storage.getUsers(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getUsers()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL users table
```

### UI → DB Flow: Fleets

```
UI: Fleet Admin Dashboard / Fleet Management
    ↓
API: GET/POST/PATCH/DELETE /api/fleets
    ↓
Routes: server/routes.ts → storage.getFleets(), storage.createFleet(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getFleets()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL fleets table
```

### UI → DB Flow: Vessels

```
UI: Vessel Selector / Fleet Admin
    ↓
API: GET/POST/PATCH/DELETE /api/vessels
    ↓
Routes: server/routes.ts → storage.getVessels(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getVessels()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL vessels table
```

### UI → DB Flow: PMS Vessel Settings

```
UI: PMS Settings / Admin Module
    ↓
API: GET/POST/PATCH /api/pms-settings/:vesselId
    ↓
Routes: server/routes.ts → storage.getPmsVesselSettings(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getPmsVesselSettings()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL pms_vessel_settings table
```

---

## Module 2: Master Data

### Tables Migrated

| Table | PostgreSQL Table | Status | Primary Key |
|-------|-----------------|--------|-------------|
| Makers | `makers` | ✅ Migrated | `id` (text) |
| Master Lists | `master_lists` | ✅ Migrated | `id` (text) |
| Maker List | `maker_list` | ✅ Migrated | `id` (text) |
| SFI Details | `sfi_details` | ✅ Migrated | `id` (text) |
| Master Data | `master_data` | ✅ Migrated | `id` (text) |

### UI → DB Flow: Makers

```
UI: Master Data Management / Makers Table
    ↓
API: GET/POST/PATCH/DELETE /api/makers
    ↓
Routes: server/routes.ts → storage.getMakers(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getMakers()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL makers table
```

### UI → DB Flow: Master Lists

```
UI: Dropdown options / Reference data
    ↓
API: GET/POST/PATCH/DELETE /api/master-lists
    ↓
Routes: server/routes.ts → storage.getMasterLists(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getMasterLists()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL master_lists table
```

### UI → DB Flow: Maker List

```
UI: Maker List Management / Equipment Maker Registry
    ↓
API: GET/POST/PATCH/DELETE /api/maker-list
    ↓
Routes: server/routes.ts → storage.getMakerList(), storage.createMakerList(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getMakerList()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL maker_list table
```

### UI → DB Flow: SFI Details

```
UI: SFI Code Management / Component Classification
    ↓
API: GET/POST/PATCH/DELETE /api/sfi-details
    ↓
Routes: server/routes.ts → storage.getSfiDetails(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getSfiDetails()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL sfi_details table
```

### UI → DB Flow: Master Data

```
UI: Equipment Master Data / Fleet Equipment Codes
    ↓
API: GET/POST/PATCH/DELETE /api/master-data
    ↓
Routes: server/routes.ts → storage.getMasterData(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getMasterData()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL master_data table
```

---

## Module 3: Components & Related Data

### Tables Migrated

| Table | PostgreSQL Table | Status | Primary Key |
|-------|-----------------|--------|-------------|
| Components | `components` | ✅ Migrated | `id` (text) |
| Component Documents | `component_documents` | ✅ Migrated | `id` (serial) |
| Component Class Regulatory | `component_class_regulatory` | ✅ Migrated | `id` (serial) |
| Component Maintenance History | `component_maintenance_history` | ✅ Migrated | `id` (serial) |
| Component Requisitions | `component_requisitions` | ✅ Migrated | `id` (serial) |
| Running Hours Audit | `running_hours_audit` | ✅ Migrated | `id` (serial) |

### UI → DB Flow: Components

```
UI: Component List / Component Form / Fleet Components
    ↓
API: GET/POST/PATCH/DELETE /api/components
     GET/POST/PATCH/DELETE /api/fleet-components
    ↓
Routes: server/routes.ts → storage.getComponents(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getComponents()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL components table
```

### UI → DB Flow: Component Documents

```
UI: Component Form - Section F (Documents)
    ↓
API: GET/POST/PATCH/DELETE /api/component-documents
    ↓
Routes: server/routes.ts → storage.getComponentDocuments(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getComponentDocuments()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL component_documents table
```

### UI → DB Flow: Component Class Regulatory

```
UI: Component Form - Classification & Surveys Section
    ↓
API: GET/POST/PATCH/DELETE /api/component-class-regulatory
    ↓
Routes: server/routes.ts → storage.getComponentClassRegulatory(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getComponentClassRegulatory()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL component_class_regulatory table
```

### UI → DB Flow: Component Maintenance History (IMMUTABLE)

```
UI: Component Form - Maintenance History Section (Read-only display)
    ↓
API: GET /api/component-maintenance-history (Read-only)
     POST /api/component-maintenance-history (Create only - via WO completion)
    ↓
Routes: server/routes.ts → storage.getComponentMaintenanceHistory(), etc.
    ↓
HybridStorage: Routes to PostgresStorage methods
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL component_maintenance_history table
    
NOTE: This table is IMMUTABLE - no updates or deletes allowed.
      Records are created automatically when work orders are completed.
```

### UI → DB Flow: Component Requisitions

```
UI: Component Form - Section G (Requisitions)
    ↓
API: GET/POST/PATCH/DELETE /api/component-requisitions
    ↓
Routes: server/routes.ts → storage.getComponentRequisitions(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.getComponentRequisitions()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL component_requisitions table
```

### UI → DB Flow: Running Hours Audit

```
UI: Running Hours Module / RH Update Forms
    ↓
API: GET /api/running-hours-audit
     POST /api/running-hours (creates audit record)
    ↓
Routes: server/routes.ts → storage.createRunningHoursAudit(), etc.
    ↓
HybridStorage: Routes to PostgresStorage.createRunningHoursAudit()
    ↓
PostgresStorage: Drizzle ORM → PostgreSQL running_hours_audit table
```

---

## Migration Scripts

### Module 2 Migration

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/migrate-module2-master-data.ts` | Migrate makers, master_lists, maker_list, sfi_details, master_data | `npx tsx scripts/migrate-module2-master-data.ts` |
| `scripts/validate-module2-migration.ts` | Validate Module 2 migration | `npx tsx scripts/validate-module2-migration.ts` |

### Module 3 Migration

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/migrate-module3-components.ts` | Migrate components, component_documents, component_class_regulatory, component_maintenance_history, component_requisitions, running_hours_audit | `npx tsx scripts/migrate-module3-components.ts` |
| `scripts/validate-module3-migration.ts` | Validate Module 3 migration | `npx tsx scripts/validate-module3-migration.ts` |

### Migration Execution Order

**IMPORTANT: Do NOT auto-run these scripts. Execute manually in this order:**

```bash
# Step 1: Ensure DATABASE_URL is set
export DATABASE_URL="your-postgresql-connection-string"

# Step 2: Push schema to database (if not already done)
npm run db:push

# Step 3: Migrate Module 2 (Master Data)
npx tsx scripts/migrate-module2-master-data.ts

# Step 4: Validate Module 2
npx tsx scripts/validate-module2-migration.ts

# Step 5: Migrate Module 3 (Components)
npx tsx scripts/migrate-module3-components.ts

# Step 6: Validate Module 3
npx tsx scripts/validate-module3-migration.ts
```

---

## Storage Layer Architecture

### File: `server/hybridStorage.ts`

The HybridStorage class acts as a routing layer that:
- Routes Module 1-3 methods to PostgresStorage (database)
- Falls back to PersistentFileStorage for all other methods (test-data.json)

```typescript
// Module 1 routing (lines ~300-506)
getUsers(): PostgresStorage.getUsers()
getFleets(): PostgresStorage.getFleets()
getVessels(): PostgresStorage.getVessels()
getPmsVesselSettings(): PostgresStorage.getPmsVesselSettings()

// Module 2 routing (lines ~506-731)
getMakers(): PostgresStorage.getMakers()
getMasterLists(): PostgresStorage.getMasterLists()
getMakerList(): PostgresStorage.getMakerList()
getSfiDetails(): PostgresStorage.getSfiDetails()
getMasterData(): PostgresStorage.getMasterData()

// Module 3 routing (lines ~721-978)
getComponents(): PostgresStorage.getComponents()
getFleetComponents(): PostgresStorage.getFleetComponents()
getComponentDocuments(): PostgresStorage.getComponentDocuments()
getComponentClassRegulatory(): PostgresStorage.getComponentClassRegulatory()
getComponentMaintenanceHistory(): PostgresStorage.getComponentMaintenanceHistory()
getComponentRequisitions(): PostgresStorage.getComponentRequisitions()
getRunningHoursAudits(): PostgresStorage.getRunningHoursAudits()
```

### File: `server/postgresStorage.ts`

Contains all PostgreSQL-specific CRUD operations using Drizzle ORM:

- **Lines 25-242**: Module 1 methods (users, fleets, vessels, pms_vessel_settings)
- **Lines 244-541**: Module 2 methods (makers, master_lists, maker_list, sfi_details, master_data)
- **Lines 543-835**: Module 3 methods (components, component_documents, component_class_regulatory, component_maintenance_history, component_requisitions, running_hours_audit)

---

## Special Business Rules

### Component Maintenance History (Immutable)

- **INSERT ONLY**: No updates or deletes allowed
- Records are created when work orders are completed
- Serves as an audit trail for all maintenance performed

### Running Hours Audit

- Tracks all running hours updates for compliance
- Supports meter replacement scenarios
- Delta propagation to child components

### Fleet vs Vessel Data Scope

Components table uses `dataScope` field to distinguish:
- `dataScope = 'fleet'`: Fleet-level template components
- `dataScope = 'vessel'`: Vessel-specific component instances

---

## Verification Checklist

### Module 1 ✅
- [x] Users CRUD operations work via PostgreSQL
- [x] Fleets CRUD operations work via PostgreSQL
- [x] Vessels CRUD operations work via PostgreSQL
- [x] PMS Vessel Settings CRUD operations work via PostgreSQL

### Module 2 ✅
- [x] Makers CRUD operations work via PostgreSQL
- [x] Master Lists CRUD operations work via PostgreSQL
- [x] Maker List CRUD operations work via PostgreSQL
- [x] SFI Details CRUD operations work via PostgreSQL
- [x] Master Data CRUD operations work via PostgreSQL
- [x] Migration script created and validated
- [x] Validation script created and tested

### Module 3 ✅
- [x] Components CRUD operations work via PostgreSQL
- [x] Fleet Components CRUD operations work via PostgreSQL
- [x] Component Documents CRUD operations work via PostgreSQL
- [x] Component Class Regulatory CRUD operations work via PostgreSQL
- [x] Component Maintenance History (INSERT only) works via PostgreSQL
- [x] Component Requisitions CRUD operations work via PostgreSQL
- [x] Running Hours Audit operations work via PostgreSQL
- [x] Migration script created and validated
- [x] Validation script created and tested

---

## Next Steps (Module 4+)

The following modules remain on file-based storage and will be migrated in future phases:

- **Module 4**: Jobs, Work Orders, Work Order Executions
- **Module 5**: Spares, Spares History, Stores Items, Stores Ledger
- **Module 6**: Defects, Defect Actions, Defect Attachments
- **Module 7**: Certificates, Surveys
- **Module 8**: Audit Logs, Change Requests, Form Definitions

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-XX | System | Initial documentation for Modules 1-3 |
