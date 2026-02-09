# Seafarer PMS - Module-Wise PostgreSQL Migration Execution Plan

> Complete migration execution plan from file-based JSON storage to PostgreSQL database.
> **STATUS: PLANNING ONLY - DO NOT APPLY**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Execution Sequence](#3-execution-sequence)
4. [Module-Wise Migration Plans](#4-module-wise-migration-plans)
   - [4.1 Core Reference Data](#41-core-reference-data)
   - [4.2 Master Data & Fleet Admin](#42-master-data--fleet-admin)
   - [4.3 PMS Components](#43-pms-components)
   - [4.4 PMS Jobs](#44-pms-jobs)
   - [4.5 PMS Work Orders](#45-pms-work-orders)
   - [4.6 Running Hours](#46-running-hours)
   - [4.7 Spares](#47-spares)
   - [4.8 Stores](#48-stores)
   - [4.9 Defects](#49-defects)
   - [4.10 Alerts](#410-alerts)
   - [4.11 Certificates & Surveys](#411-certificates--surveys)
   - [4.12 Change Requests (Modify PMS)](#412-change-requests-modify-pms)
   - [4.13 IHM](#413-ihm)
   - [4.14 Form Engine](#414-form-engine)
   - [4.15 Fleet Sync & Vessel Mapping](#415-fleet-sync--vessel-mapping)
   - [4.16 Import Engine](#416-import-engine)
   - [4.17 Audit Log](#417-audit-log)
   - [4.18 Bulk Import](#418-bulk-import)
5. [Postgres Adapter Implementation](#5-postgres-adapter-implementation)
6. [Data Migration Strategy](#6-data-migration-strategy)
7. [Cutover Strategy](#7-cutover-strategy)
8. [Risk Assessment & Mitigation](#8-risk-assessment--mitigation)
9. [Validation & Testing Plan](#9-validation--testing-plan)
10. [Rollback Plan](#10-rollback-plan)

---

## 1. Executive Summary

### 1.1 Current State

| Aspect | Current Implementation |
|--------|------------------------|
| **Primary Storage** | `test-data.json` (single JSON file) |
| **Binary Storage** | `uploads/component-documents/` via LocalFileStorage |
| **Storage Interface** | `IStorage` interface in `server/storage.ts` |
| **Implementation** | `PersistentFileStorage` in `server/persistentStorage.ts` (~8,047 lines) |
| **Write Pattern** | Full JSON rewrite on every mutation |
| **Concurrency** | Promise-based write lock queue |
| **Schema** | Drizzle ORM schema defined but unused (`shared/schema.ts`, 50 tables) |

### 1.2 Target State

| Aspect | Target Implementation |
|--------|----------------------|
| **Primary Storage** | PostgreSQL (Neon-backed) |
| **Binary Storage** | Replit Object Storage (unchanged) |
| **Storage Interface** | `IStorage` interface (unchanged) |
| **Implementation** | `PostgresStorage` using Drizzle ORM |
| **Write Pattern** | Incremental row-level operations |
| **Concurrency** | Database-level transactions and locks |
| **Schema** | Active Drizzle schema with migrations |

### 1.3 Scope

- **50 database tables** across 18 functional modules
- **~150+ IStorage methods** to be reimplemented
- **Zero API contract changes** - frontend remains unchanged
- **Dual-mode operation** during transition via feature flag

### 1.4 Key Principles

1. **Interface Preservation** - `IStorage` interface contract remains identical
2. **Incremental Migration** - Module-by-module migration with validation
3. **Dual-Write Safety** - Optional parallel writes during transition
4. **Rollback Ready** - Feature flag allows instant revert to file storage

---

## 2. Architecture Overview

### 2.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────────────┐    ┌──────────────────────────┐ │
│  │   Routes    │───▶│     IStorage        │───▶│  PersistentFileStorage   │ │
│  │ (routes.ts) │    │   (storage.ts)      │    │ (persistentStorage.ts)   │ │
│  └─────────────┘    └─────────────────────┘    └────────────┬─────────────┘ │
│                                                              │               │
│                                                              ▼               │
│                                                    ┌─────────────────────┐  │
│                                                    │   this.data         │  │
│                                                    │  (in-memory cache)  │  │
│                                                    └──────────┬──────────┘  │
│                                                               │              │
│                                                               ▼              │
│                                                    ┌─────────────────────┐  │
│                                                    │   test-data.json    │  │
│                                                    │  (persistent file)  │  │
│                                                    └─────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TARGET ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────────────┐    ┌──────────────────────────┐ │
│  │   Routes    │───▶│     IStorage        │───▶│   StorageFactory         │ │
│  │ (routes.ts) │    │   (storage.ts)      │    │  (STORAGE_MODE env var)  │ │
│  └─────────────┘    └─────────────────────┘    └────────────┬─────────────┘ │
│                                                              │               │
│                          ┌───────────────────────────────────┤               │
│                          │                                   │               │
│                          ▼                                   ▼               │
│           ┌──────────────────────────┐        ┌──────────────────────────┐  │
│           │  PersistentFileStorage   │        │    PostgresStorage       │  │
│           │  (STORAGE_MODE='file')   │        │  (STORAGE_MODE='postgres')│  │
│           └──────────────────────────┘        └────────────┬─────────────┘  │
│                          │                                  │               │
│                          ▼                                  ▼               │
│           ┌──────────────────────────┐        ┌──────────────────────────┐  │
│           │     test-data.json       │        │       PostgreSQL         │  │
│           └──────────────────────────┘        │   (Neon-backed, 50 tbls) │  │
│                                               └──────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Adapter Pattern Design

```typescript
// server/storage.ts (Updated)

export interface IStorage {
  // All existing method signatures remain unchanged
  // ~150+ methods for all CRUD operations
}

// Factory function to select storage backend
export function createStorage(): IStorage {
  const mode = process.env.STORAGE_MODE || 'file';
  
  switch (mode) {
    case 'postgres':
      return new PostgresStorage();
    case 'dual':
      return new DualWriteStorage(); // For transition validation
    case 'file':
    default:
      return new PersistentFileStorage();
  }
}

export const storage: IStorage = createStorage();
```

---

## 3. Execution Sequence

### 3.1 High-Level Migration Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MIGRATION EXECUTION SEQUENCE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: Foundation (Week 1-2)                                             │
│  ├── Step 1.1: Setup migrations folder + Drizzle config                     │
│  ├── Step 1.2: Create PostgresStorage class skeleton                        │
│  ├── Step 1.3: Implement StorageFactory with feature flag                   │
│  └── Step 1.4: Setup database connection pool                               │
│                                                                              │
│  PHASE 2: Core Tables (Week 2-3)                                            │
│  ├── Step 2.1: Migrate users, fleets, vessels tables                        │
│  ├── Step 2.2: Migrate master data tables                                   │
│  └── Step 2.3: Migrate pms_vessel_settings                                  │
│                                                                              │
│  PHASE 3: PMS Core (Week 3-5)                                               │
│  ├── Step 3.1: Migrate components + satellite tables                        │
│  ├── Step 3.2: Migrate jobs table                                           │
│  ├── Step 3.3: Migrate work_orders + work_order_executions                  │
│  └── Step 3.4: Migrate running_hours_audit + component_running_hours_log    │
│                                                                              │
│  PHASE 4: Inventory & Defects (Week 5-6)                                    │
│  ├── Step 4.1: Migrate spares + spares_history                              │
│  ├── Step 4.2: Migrate stores_items + stores_ledger                         │
│  └── Step 4.3: Migrate defects + actions + attachments + recurring          │
│                                                                              │
│  PHASE 5: Supporting Modules (Week 6-7)                                     │
│  ├── Step 5.1: Migrate alerts (policies, events, deliveries, config)        │
│  ├── Step 5.2: Migrate change_request + attachments + comments              │
│  ├── Step 5.3: Migrate ihm_items + ihm_maintenance_log                      │
│  ├── Step 5.4: Migrate form_definitions + versions + usage                  │
│  └── Step 5.5: Migrate fleet mapping tables (4 tables)                      │
│                                                                              │
│  PHASE 6: Audit & Import (Week 7-8)                                         │
│  ├── Step 6.1: Migrate audit_log                                            │
│  ├── Step 6.2: Migrate import_history + import_change_log                   │
│  └── Step 6.3: Migrate bulk_import_history + bulk_import_errors             │
│                                                                              │
│  PHASE 7: Validation & Cutover (Week 8-9)                                   │
│  ├── Step 7.1: Enable dual-write mode for validation                        │
│  ├── Step 7.2: Run checksum validation between file and DB                  │
│  ├── Step 7.3: Performance testing                                          │
│  ├── Step 7.4: Switch to STORAGE_MODE=postgres                              │
│  └── Step 7.5: Deprecate file storage code                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Step-by-Step Sequence

| Step | Description | Tables | Dependencies | Est. Effort |
|------|-------------|--------|--------------|-------------|
| 1.1 | Setup migrations folder + Drizzle config | - | None | 2 hours |
| 1.2 | Create PostgresStorage class skeleton | - | 1.1 | 4 hours |
| 1.3 | Implement StorageFactory with feature flag | - | 1.2 | 2 hours |
| 1.4 | Setup database connection pool | - | 1.3 | 2 hours |
| 2.1 | Migrate users, fleets, vessels | 3 | 1.4 | 8 hours |
| 2.2 | Migrate master data tables | 6 | 2.1 | 8 hours |
| 2.3 | Migrate pms_vessel_settings | 1 | 2.1 | 2 hours |
| 3.1 | Migrate components + satellites | 6 | 2.1, 2.2 | 16 hours |
| 3.2 | Migrate jobs | 1 | 3.1 | 8 hours |
| 3.3 | Migrate work_orders + executions | 2 | 3.1, 3.2 | 12 hours |
| 3.4 | Migrate running hours | 2 | 3.1 | 6 hours |
| 4.1 | Migrate spares + history | 2 | 3.1 | 8 hours |
| 4.2 | Migrate stores | 2 | 2.1 | 6 hours |
| 4.3 | Migrate defects | 5 | 3.1 | 10 hours |
| 5.1 | Migrate alerts | 4 | 2.1 | 8 hours |
| 5.2 | Migrate change requests | 3 | 3.1, 4.1, 4.2 | 6 hours |
| 5.3 | Migrate IHM | 2 | 3.1, 3.3, 4.1 | 4 hours |
| 5.4 | Migrate forms | 3 | 2.1 | 4 hours |
| 5.5 | Migrate fleet mappings | 4 | 2.1, 3.1, 3.2, 4.1 | 6 hours |
| 6.1 | Migrate audit_log | 1 | All modules | 4 hours |
| 6.2 | Migrate import history | 2 | 3.1, 3.2, 4.1, 4.2 | 4 hours |
| 6.3 | Migrate bulk import | 2 | 6.2 | 3 hours |
| 7.1 | Enable dual-write validation | - | All | 8 hours |
| 7.2 | Checksum validation | - | 7.1 | 4 hours |
| 7.3 | Performance testing | - | 7.2 | 8 hours |
| 7.4 | Production cutover | - | 7.3 | 4 hours |
| 7.5 | Deprecate file storage | - | 7.4 | 4 hours |

**Total Estimated Effort: ~160 hours (~4 weeks full-time)**

---

## 4. Module-Wise Migration Plans

---

### 4.1 Core Reference Data

#### Tables Involved

| Table | Purpose | Record Count | ID Type |
|-------|---------|--------------|---------|
| `users` | User registry | ~10-50 | `serial` |
| `fleets` | Fleet groupings | ~1-5 | `text` (fleet code) |
| `vessels` | Vessel registry | ~5-20 | `text` (vessel code) |
| `pms_vessel_settings` | Per-vessel configuration | 1 per vessel | `serial` |

#### Relationships

```
fleets
    └── vessels.fleet_id → fleets.id

vessels
    └── users.vessel_id → vessels.id (Ship users only)
    └── pms_vessel_settings.vessel_id → vessels.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.users[id]` | `users.*` |
| `data.fleets[id]` | `fleets.*` |
| `data.vessels[id]` | `vessels.*` |
| `data.pmsVesselSettings[id]` | `pms_vessel_settings.*` |

#### Current Storage Implementation

**File:** `server/persistentStorage.ts`

```typescript
// Current implementation (lines ~550-650)
async getUser(id: number): Promise<User | undefined> {
  return this.data.users[id];
}

async createUser(userData: InsertUser): Promise<User> {
  const id = ++this.data.counters.userId;
  const user = { ...userData, id, isActive: true };
  this.data.users[id] = user;
  this.persistData();
  return user;
}
```

#### Target Postgres Implementation

```typescript
// server/postgresStorage.ts
import { db } from "./db";
import { users, fleets, vessels, pmsVesselSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

async getUser(id: number): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

async createUser(userData: InsertUser): Promise<User> {
  const [user] = await db.insert(users).values(userData).returning();
  return user;
}

async updateUser(id: number, data: Partial<User>): Promise<User> {
  const [user] = await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getUser(id)` | SELECT by id | LOW |
| `getUserByUsername(username)` | SELECT by username | LOW |
| `createUser(data)` | INSERT | LOW |
| `updateUser(id, data)` | UPDATE | LOW |
| `getUsers()` | SELECT all | LOW |
| `getFleet(id)` | SELECT by id | LOW |
| `getFleets()` | SELECT all | LOW |
| `createFleet(data)` | INSERT | LOW |
| `getVessel(id)` | SELECT by id | LOW |
| `getVessels()` | SELECT all | LOW |
| `createVessel(data)` | INSERT + settings | MEDIUM |
| `getPmsVesselSettings(vesselId)` | SELECT by vessel_id | LOW |
| `updatePmsVesselSettings(id, data)` | UPDATE | LOW |

#### Migration Script Pseudocode

```typescript
async function migrateCoreReferenceData(fileData: PersistentData) {
  await db.transaction(async (tx) => {
    // 1. Migrate fleets first (no dependencies)
    for (const fleet of Object.values(fileData.fleets)) {
      await tx.insert(fleets).values(fleet).onConflictDoNothing();
    }
    
    // 2. Migrate vessels (depends on fleets)
    for (const vessel of Object.values(fileData.vessels)) {
      await tx.insert(vessels).values(vessel).onConflictDoNothing();
    }
    
    // 3. Migrate users (depends on vessels for Ship role)
    for (const user of Object.values(fileData.users)) {
      await tx.insert(users).values(user).onConflictDoNothing();
    }
    
    // 4. Migrate pms_vessel_settings
    for (const settings of Object.values(fileData.pmsVesselSettings)) {
      await tx.insert(pmsVesselSettings).values(settings).onConflictDoNothing();
    }
  });
}
```

#### Backend Refactor Steps

1. Create `server/postgresStorage/coreReference.ts`
2. Implement all user/fleet/vessel methods
3. Update `storage.ts` to use PostgresStorage when flag enabled
4. Test CRUD operations via API

#### Frontend Adjustments

**None required** - API shape remains identical.

#### Index Recommendations

```sql
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_vessel ON users(vessel_id);
CREATE INDEX idx_vessels_fleet ON vessels(fleet_id);
CREATE UNIQUE INDEX idx_users_username ON users(username);
```

#### Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| User password hashing incompatibility | Verify password column stores hashed values identically |
| Fleet/vessel codes as PKs | Ensure codes are URL-safe and unique |

---

### 4.2 Master Data & Fleet Admin

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `makers` | Manufacturer registry | ~100-500 |
| `master_lists` | Dropdown/lookup values | ~50-200 |
| `maker_list` | Alternative maker registry | ~50-500 |
| `sfi_details` | SFI classification codes | ~1000-5000 |
| `master_data` | Equipment code generation | ~100-1000 |

#### Relationships

```
makers (standalone)
master_lists (standalone)
maker_list (standalone)
sfi_details (standalone)
master_data (standalone)
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.makers[]` | `makers.*` (array format) |
| `data.masterLists[]` | `master_lists.*` (array format) |
| `data.makersList[id]` | `maker_list.*` |
| `data.sfiDetailsList[id]` | `sfi_details.*` |
| `data.masterDataList[id]` | `master_data.*` |

#### IStorage Methods to Rewrite

| Method | Operation |
|--------|-----------|
| `getMakers()` | SELECT all |
| `createMaker(data)` | INSERT |
| `getMasterLists(vesselId)` | SELECT filtered |
| `createMasterList(data)` | INSERT |
| `getFleetEquipmentMaster()` | SELECT all |
| `createFleetEquipmentMaster(data)` | INSERT |
| `getMakersList()` | SELECT all |
| `getSfiDetailsList()` | SELECT all |
| `getMasterDataList()` | SELECT all |
| `createMasterData(data)` | INSERT |

#### Target Postgres Implementation

```typescript
async getMakers(): Promise<Maker[]> {
  return db.select().from(makers);
}

async getMasterLists(vesselId?: string): Promise<MasterList[]> {
  if (vesselId) {
    return db.select().from(masterLists).where(eq(masterLists.vesselId, vesselId));
  }
  return db.select().from(masterLists);
}

async getSfiDetailsList(): Promise<SfiDetails[]> {
  return db.select().from(sfiDetails);
}
```

#### Index Recommendations

```sql
CREATE INDEX idx_master_lists_vessel ON master_lists(vessel_id);
CREATE INDEX idx_master_lists_type ON master_lists(list_type);
CREATE INDEX idx_sfi_details_code ON sfi_details(sfi_code);
```

---

### 4.3 PMS Components

#### Tables Involved

| Table | Purpose | Record Count | Immutable |
|-------|---------|--------------|-----------|
| `components` | Equipment registry | ~500-5000 | No |
| `component_documents` | Technical documents | ~100-1000 | No |
| `component_class_regulatory` | Survey records | ~100-500 | No |
| `component_maintenance_history` | Maintenance audit trail | ~1000-10000 | **YES** |
| `component_requisitions` | Purchase requests | ~50-500 | No |
| `component_running_hours_log` | RH change log | ~1000-5000 | **YES** |

#### Relationships

```
components (parent_id → components.id) [Self-referential]
    ├── component_documents.component_id → components.id
    ├── component_class_regulatory.component_id → components.id
    ├── component_maintenance_history.component_id → components.id
    ├── component_requisitions.component_id → components.id
    └── component_running_hours_log.component_id → components.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.components[id]` | `components.*` |
| `data.componentDocuments[id]` | `component_documents.*` |
| `data.componentClassRegulatory[id]` | `component_class_regulatory.*` |
| `data.componentMaintenanceHistory[id]` | `component_maintenance_history.*` |
| `data.componentRequisitions[id]` | `component_requisitions.*` |
| Component.rhLog (nested) | `component_running_hours_log.*` |

#### Current Storage Implementation

**File:** `server/persistentStorage.ts` (lines ~650-900)

```typescript
async getComponents(vesselId: string): Promise<Component[]> {
  return Object.values(this.data.components)
    .filter(c => c.vesselId === vesselId || c.dataScope === 'fleet');
}

async getComponent(id: string): Promise<Component | undefined> {
  return this.data.components[id];
}

async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
  const component = this.data.components[id];
  if (!component) throw new Error('Component not found');
  Object.assign(component, data, { lastUpdated: new Date().toISOString() });
  this.rebuildComponentCodeIndex();
  this.persistData();
  return component;
}
```

#### Target Postgres Implementation

```typescript
async getComponents(vesselId: string): Promise<Component[]> {
  return db.select()
    .from(components)
    .where(or(
      eq(components.vesselId, vesselId),
      eq(components.dataScope, 'fleet')
    ));
}

async getComponent(id: string): Promise<Component | undefined> {
  const [component] = await db.select()
    .from(components)
    .where(eq(components.id, id));
  return component;
}

async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
  const [component] = await db.update(components)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(components.id, id))
    .returning();
  return component;
}

async getComponentHierarchy(vesselId: string): Promise<Component[]> {
  // Use recursive CTE for hierarchy
  const result = await db.execute(sql`
    WITH RECURSIVE hierarchy AS (
      SELECT * FROM components 
      WHERE vessel_id = ${vesselId} AND parent_id IS NULL
      UNION ALL
      SELECT c.* FROM components c
      JOIN hierarchy h ON c.parent_id = h.id
    )
    SELECT * FROM hierarchy
  `);
  return result.rows;
}
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getComponents(vesselId)` | SELECT filtered | LOW |
| `getComponent(id)` | SELECT by id | LOW |
| `getComponentByCode(vesselId, code)` | SELECT by code | LOW |
| `createComponent(data)` | INSERT + audit | MEDIUM |
| `updateComponent(id, data)` | UPDATE + audit | MEDIUM |
| `deleteComponent(id)` | Soft delete | LOW |
| `bulkCreateComponents(data[])` | Batch INSERT | HIGH |
| `moveComponent(id, newParentId)` | UPDATE hierarchy | MEDIUM |
| `getComponentDocuments(componentId)` | SELECT filtered | LOW |
| `createComponentDocument(data)` | INSERT | LOW |
| `getComponentClassRegulatory(componentId)` | SELECT filtered | LOW |
| `createComponentClassRegulatory(data)` | INSERT | LOW |
| `getComponentMaintenanceHistory(componentId)` | SELECT filtered | LOW |
| `createComponentMaintenanceHistory(data)` | INSERT (immutable) | LOW |
| `getComponentRequisitions(componentId)` | SELECT filtered | LOW |
| `createComponentRunningHoursLog(data)` | INSERT (immutable) | LOW |

#### Transaction Boundaries

```typescript
// Create component with documents - single transaction
async createComponentWithDocuments(
  componentData: InsertComponent,
  documents: InsertComponentDocument[]
): Promise<Component> {
  return db.transaction(async (tx) => {
    const [component] = await tx.insert(components)
      .values(componentData)
      .returning();
    
    if (documents.length > 0) {
      await tx.insert(componentDocuments)
        .values(documents.map(d => ({ ...d, componentId: component.id })));
    }
    
    await tx.insert(auditLog).values({
      action: 'CREATE',
      entityType: 'component',
      entityId: component.id,
      payload: component
    });
    
    return component;
  });
}
```

#### Index Recommendations

```sql
CREATE INDEX idx_comp_data_scope ON components(data_scope);
CREATE INDEX idx_comp_vessel ON components(vessel_id);
CREATE INDEX idx_comp_parent ON components(parent_id);
CREATE INDEX idx_comp_fleet_code ON components(fleet_equipment_code);
CREATE INDEX idx_comp_code ON components(component_code);
CREATE INDEX idx_comp_active ON components(is_active);
CREATE INDEX idx_comp_docs_component ON component_documents(component_id);
CREATE INDEX idx_comp_history_component ON component_maintenance_history(component_id);
```

#### Migration Order

1. Components (parents first, then children by depth)
2. Component documents
3. Component class regulatory
4. Component maintenance history
5. Component requisitions
6. Component running hours log

#### Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Self-referential hierarchy migration | Migrate root components first, then by tree depth |
| Large component count | Use batch inserts with 100-record chunks |
| Component code index rebuild | Postgres handles via unique index |

---

### 4.4 PMS Jobs

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `jobs` | Job templates | ~500-5000 |

#### Relationships

```
jobs.component_id → components.id
jobs.vessel_id → vessels.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.jobs[id]` | `jobs.*` |
| `job.requiredSpareParts` | `jobs.required_spare_parts` (JSONB) |
| `job.requiredTools` | `jobs.required_tools` (JSONB) |
| `job.safetyRequirements` | `jobs.safety_requirements` (JSONB) |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getJobs(vesselId?)` | SELECT filtered | LOW |
| `getJob(id)` | SELECT by id | LOW |
| `getJobByJobNo(jobNo)` | SELECT by job_no | LOW |
| `getJobsByComponent(componentId)` | SELECT filtered | LOW |
| `createJob(data)` | INSERT + audit | LOW |
| `updateJob(id, data)` | UPDATE + audit | MEDIUM |
| `deleteJob(id)` | Soft delete + check WOs | MEDIUM |
| `bulkUpsertJobs(data[])` | Batch UPSERT | HIGH |
| `getDueJobs(date)` | SELECT with date calc | MEDIUM |

#### Target Postgres Implementation

```typescript
async getJobs(vesselId?: string): Promise<Job[]> {
  if (vesselId) {
    return db.select()
      .from(jobs)
      .where(or(
        eq(jobs.vesselId, vesselId),
        eq(jobs.dataScope, 'fleet')
      ));
  }
  return db.select().from(jobs);
}

async getDueJobs(targetDate: Date): Promise<Job[]> {
  return db.select()
    .from(jobs)
    .where(and(
      eq(jobs.isActive, true),
      lte(jobs.nextDueDate, targetDate.toISOString())
    ));
}

async updateJobNextDue(id: string, data: {
  lastDoneDate?: string;
  lastDoneRh?: string;
  nextDueDate?: string;
  nextDueRh?: string;
}): Promise<Job> {
  const [job] = await db.update(jobs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();
  return job;
}
```

#### Index Recommendations

```sql
CREATE UNIQUE INDEX idx_job_no ON jobs(job_no);
CREATE INDEX idx_job_vessel ON jobs(vessel_id);
CREATE INDEX idx_job_component ON jobs(component_id);
CREATE INDEX idx_job_next_due ON jobs(next_due_date);
CREATE INDEX idx_job_data_scope ON jobs(data_scope);
CREATE INDEX idx_job_active ON jobs(is_active);
```

---

### 4.5 PMS Work Orders

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `work_orders` | Active/completed work orders | ~1000-10000 |
| `work_order_executions` | Historical execution records | ~500-5000 |

#### Relationships

```
work_orders.job_id → jobs.id
work_orders.vessel_id → vessels.id
work_order_executions.template_id → work_orders.template_id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.workOrders[]` | `work_orders.*` (array format) |
| `workOrder.formData` | `work_orders.form_data` (JSONB) |
| `workOrder.requiredSpareParts` | `work_orders.required_spare_parts` (JSONB) |
| `workOrder.consumedSpareParts` | `work_orders.consumed_spare_parts` (JSONB) |
| `workOrder.uploadedDocuments` | `work_orders.uploaded_documents` (JSONB) |
| `data.workOrderExecutions[]` | `work_order_executions.*` (array format) |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getWorkOrders(vesselId?)` | SELECT filtered | LOW |
| `getWorkOrder(id)` | SELECT by id | LOW |
| `getWorkOrderByNo(woNo)` | SELECT by work_order_no | LOW |
| `getWorkOrdersByComponent(componentCode)` | SELECT filtered | LOW |
| `getWorkOrdersByJob(jobId)` | SELECT filtered | LOW |
| `createWorkOrder(data)` | INSERT + audit | MEDIUM |
| `updateWorkOrder(id, data)` | UPDATE + status logic | MEDIUM |
| `approveWorkOrder(id, approvalData)` | Complex transaction | **HIGH** |
| `rejectWorkOrder(id, rejectionData)` | UPDATE + audit | MEDIUM |
| `postponeWorkOrder(id, postponeData)` | UPDATE + audit | MEDIUM |

#### Transaction Boundaries - Work Order Approval

This is the most complex transaction in the system:

```typescript
async approveWorkOrder(id: string, approvalData: {
  approverRemarks?: string;
  approver: string;
  consumedSpares?: ConsumedSpare[];
}): Promise<WorkOrder> {
  return db.transaction(async (tx) => {
    // 1. Get work order with job
    const [workOrder] = await tx.select()
      .from(workOrders)
      .where(eq(workOrders.id, id));
    
    // 2. Update work order status
    const [updatedWO] = await tx.update(workOrders)
      .set({
        status: 'Completed',
        approverRemarks: approvalData.approverRemarks,
        approver: approvalData.approver,
        approvalDate: new Date().toISOString(),
        dateCompleted: new Date().toISOString()
      })
      .where(eq(workOrders.id, id))
      .returning();
    
    // 3. Create immutable maintenance history
    await tx.insert(componentMaintenanceHistory).values({
      componentId: workOrder.componentCode,
      workOrderId: id,
      workOrderNo: workOrder.workOrderNo,
      jobTitle: workOrder.jobTitle,
      dateCompleted: new Date().toISOString(),
      performedBy: workOrder.performedBy,
      sparesUsed: approvalData.consumedSpares || []
    });
    
    // 4. Update spares inventory for each consumed spare
    for (const spare of approvalData.consumedSpares || []) {
      await tx.update(spares)
        .set({ rob: sql`rob - ${spare.quantity}` })
        .where(eq(spares.id, spare.spareId));
      
      await tx.insert(sparesHistory).values({
        spareId: spare.spareId,
        changeType: 'CONSUMPTION',
        quantityChange: -spare.quantity,
        workOrderId: id,
        reason: `Consumed in WO ${workOrder.workOrderNo}`
      });
    }
    
    // 5. Update job next due date
    if (workOrder.jobId) {
      const nextDue = calculateNextDueDate(workOrder);
      await tx.update(jobs)
        .set({
          lastDoneDate: workOrder.dateCompleted,
          nextDueDate: nextDue.date,
          nextDueRh: nextDue.rh
        })
        .where(eq(jobs.id, workOrder.jobId));
    }
    
    // 6. Create audit log
    await tx.insert(auditLog).values({
      action: 'APPROVE',
      entityType: 'work_order',
      entityId: id,
      performedBy: approvalData.approver,
      payload: { workOrder: updatedWO }
    });
    
    return updatedWO;
  });
}
```

#### Index Recommendations

```sql
CREATE INDEX idx_wo_vessel ON work_orders(vessel_id);
CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_due_date ON work_orders(due_date);
CREATE INDEX idx_wo_job ON work_orders(job_id);
CREATE INDEX idx_wo_component ON work_orders(component_code);
CREATE INDEX idx_wo_template ON work_orders(template_code);
CREATE INDEX idx_wo_data_scope ON work_orders(data_scope);
CREATE INDEX idx_wo_exec_template ON work_order_executions(template_id);
```

#### Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Work order approval transaction failure | Use savepoints, implement retry logic |
| Spare inventory going negative | Add CHECK constraint `rob >= 0` |
| Large JSONB form_data | No issue - Postgres handles well |

---

### 4.6 Running Hours

#### Tables Involved

| Table | Purpose | Record Count | Immutable |
|-------|---------|--------------|-----------|
| `running_hours_audit` | Primary RH audit trail | ~5000-50000 | **YES** |
| `component_running_hours_log` | Detailed RH log | ~5000-50000 | **YES** |

#### Relationships

```
running_hours_audit.component_id → components.id
component_running_hours_log.component_id → components.id
```

#### Transaction Boundaries - Running Hours Cascade

```typescript
async cascadeRunningHoursUpdate(
  parentComponentId: string,
  newReading: number,
  updateDetails: RHUpdateDetails
): Promise<void> {
  return db.transaction(async (tx) => {
    // 1. Get parent component and all children
    const children = await tx.execute(sql`
      WITH RECURSIVE tree AS (
        SELECT id, current_cumulative_rh FROM components WHERE id = ${parentComponentId}
        UNION ALL
        SELECT c.id, c.current_cumulative_rh FROM components c
        JOIN tree t ON c.parent_id = t.id
      )
      SELECT * FROM tree
    `);
    
    const previousReading = children.rows[0].current_cumulative_rh;
    const difference = newReading - previousReading;
    
    // 2. Update all components in hierarchy
    for (const component of children.rows) {
      const newValue = Number(component.current_cumulative_rh) + difference;
      
      await tx.update(components)
        .set({ 
          currentCumulativeRh: newValue.toString(),
          lastUpdated: new Date().toISOString()
        })
        .where(eq(components.id, component.id));
      
      // 3. Create running hours log entry for each
      await tx.insert(componentRunningHoursLog).values({
        componentId: component.id,
        previousReading: component.current_cumulative_rh,
        newReading: newValue.toString(),
        difference: difference.toString(),
        updatedBy: updateDetails.updatedBy,
        reason: updateDetails.reason
      });
    }
    
    // 4. Create main audit entry
    await tx.insert(runningHoursAudit).values({
      componentId: parentComponentId,
      previousReading: previousReading.toString(),
      newReading: newReading.toString(),
      difference: difference.toString(),
      updatedBy: updateDetails.updatedBy,
      vesselId: updateDetails.vesselId,
      updateSource: updateDetails.source
    });
    
    // 5. Recalculate RH-based job due dates
    const rhJobs = await tx.select()
      .from(jobs)
      .where(and(
        inArray(jobs.componentId, children.rows.map(c => c.id)),
        eq(jobs.maintenanceBasis, 'Running Hours')
      ));
    
    for (const job of rhJobs) {
      const nextDueRh = calculateNextDueRh(job, newReading);
      await tx.update(jobs)
        .set({ nextDueRh: nextDueRh.toString() })
        .where(eq(jobs.id, job.id));
    }
  });
}
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getRunningHoursAudit(vesselId)` | SELECT filtered | LOW |
| `createRunningHoursAudit(data)` | INSERT (immutable) | LOW |
| `cascadeRunningHoursUpdate(...)` | Complex transaction | **HIGH** |
| `getComponentRunningHoursLog(componentId)` | SELECT filtered | LOW |
| `createComponentRunningHoursLog(data)` | INSERT (immutable) | LOW |

---

### 4.7 Spares

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `spares` | Spare parts inventory | ~1000-10000 |
| `spares_history` | Inventory change log | ~5000-50000 |

#### Relationships

```
spares.component_id → components.id
spares.vessel_id → vessels.id
spares_history.spare_id → spares.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.spares[id]` | `spares.*` |
| `data.sparesHistory[]` | `spares_history.*` (array format) |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getSpares(vesselId)` | SELECT filtered | LOW |
| `getSpare(id)` | SELECT by id | LOW |
| `getSparesByComponent(componentId)` | SELECT filtered | LOW |
| `createSpare(data)` | INSERT + audit | LOW |
| `updateSpare(id, data)` | UPDATE + history | MEDIUM |
| `updateSpareRob(id, change, reason)` | UPDATE + history | MEDIUM |
| `bulkCreateSpares(data[])` | Batch INSERT | MEDIUM |
| `getSparesHistory(spareId)` | SELECT filtered | LOW |
| `createSparesHistory(data)` | INSERT | LOW |

#### Target Postgres Implementation

```typescript
async updateSpareRob(
  id: number,
  quantityChange: number,
  reason: string,
  workOrderId?: string
): Promise<Spare> {
  return db.transaction(async (tx) => {
    // 1. Update spare ROB
    const [spare] = await tx.update(spares)
      .set({ 
        rob: sql`rob + ${quantityChange}`,
        updatedAt: new Date()
      })
      .where(eq(spares.id, id))
      .returning();
    
    // 2. Create history entry
    await tx.insert(sparesHistory).values({
      spareId: id,
      changeType: quantityChange > 0 ? 'RECEIPT' : 'CONSUMPTION',
      quantityChange,
      robAfter: spare.rob,
      reason,
      workOrderId
    });
    
    return spare;
  });
}
```

#### Index Recommendations

```sql
CREATE INDEX idx_spares_vessel ON spares(vessel_id);
CREATE INDEX idx_spares_component ON spares(component_id);
CREATE INDEX idx_spares_part_code ON spares(part_code);
CREATE INDEX idx_spares_critical ON spares(critical);
CREATE INDEX idx_spares_history_spare ON spares_history(spare_id);
CREATE INDEX idx_spares_history_date ON spares_history(created_at);
```

---

### 4.8 Stores

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `stores_items` | Store inventory items | ~500-5000 |
| `stores_ledger` | Inventory transactions | ~2000-20000 |

#### Relationships

```
stores_items.vessel_id → vessels.id
stores_ledger.stores_item_id → stores_items.id

NOTE: Stores module is COMPLETELY ISOLATED from PMS
      - No component_id references
      - No job_id references
      - No work_order_id references
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.storesItems[id]` | `stores_items.*` |
| `data.storesLedger[]` | `stores_ledger.*` (array format) |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getStoresItems(vesselId)` | SELECT filtered | LOW |
| `getStoresItem(id)` | SELECT by id | LOW |
| `createStoresItem(data)` | INSERT | LOW |
| `updateStoresItem(id, data)` | UPDATE | LOW |
| `updateStoresItemStock(id, change, reason)` | UPDATE + ledger | MEDIUM |
| `getStoresLedger(itemId)` | SELECT filtered | LOW |
| `createStoresLedgerEntry(data)` | INSERT | LOW |

#### Index Recommendations

```sql
CREATE INDEX idx_stores_items_vessel ON stores_items(vessel_id);
CREATE INDEX idx_stores_items_category ON stores_items(category);
CREATE INDEX idx_stores_ledger_item ON stores_ledger(stores_item_id);
CREATE INDEX idx_stores_ledger_date ON stores_ledger(transaction_date);
```

---

### 4.9 Defects

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `defects` | Defect records | ~200-2000 |
| `defect_actions` | Corrective actions | ~500-5000 |
| `defect_attachments` | Evidence/documentation | ~300-3000 |
| `recurring_defects` | Recurring pattern definitions | ~20-200 |
| `recurring_defect_links` | Links to recurring patterns | ~50-500 |

#### Relationships

```
defects.component_id → components.id (optional)
defects.vessel_id → vessels.id
defect_actions.defect_id → defects.id
defect_attachments.defect_id → defects.id
recurring_defect_links.defect_id → defects.id
recurring_defect_links.recurring_defect_id → recurring_defects.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.defects[id]` | `defects.*` |
| `defect.notes` | `defects.notes` (JSONB) |
| `defect.actions` | `defects.actions` (JSONB) OR normalized to `defect_actions` |
| `defect.attachments` | `defects.attachments` (JSONB) OR normalized to `defect_attachments` |
| `defect.auditTrail` | `defects.audit_trail` (JSONB) |
| `data.defectActions[]` | `defect_actions.*` |
| `data.defectAttachments[]` | `defect_attachments.*` |
| `data.recurringDefects[id]` | `recurring_defects.*` |
| `data.recurringDefectLinks[]` | `recurring_defect_links.*` |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getDefects(vesselId)` | SELECT filtered | LOW |
| `getDefect(id)` | SELECT + join actions/attachments | MEDIUM |
| `createDefect(data)` | INSERT + audit | LOW |
| `updateDefect(id, data)` | UPDATE + audit | MEDIUM |
| `closeDefect(id, closureData)` | UPDATE status + audit | MEDIUM |
| `getDefectActions(defectId)` | SELECT filtered | LOW |
| `createDefectAction(data)` | INSERT | LOW |
| `getDefectAttachments(defectId)` | SELECT filtered | LOW |
| `createDefectAttachment(data)` | INSERT | LOW |
| `getRecurringDefects()` | SELECT all | LOW |
| `linkDefectToRecurring(defectId, recurringId)` | INSERT | LOW |

---

### 4.10 Alerts

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `alert_policies` | Alert rule definitions | ~10-100 |
| `alert_events` | Triggered alerts | ~500-5000 |
| `alert_deliveries` | Notification delivery log | ~1000-10000 |
| `alert_config` | Per-vessel alert settings | 1 per vessel |

#### Relationships

```
alert_events.policy_id → alert_policies.id
alert_deliveries.alert_event_id → alert_events.id
alert_config.vessel_id → vessels.id
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getAlertPolicies()` | SELECT all | LOW |
| `getAlertPolicy(id)` | SELECT by id | LOW |
| `createAlertPolicy(data)` | INSERT | LOW |
| `updateAlertPolicy(id, data)` | UPDATE | LOW |
| `getAlertEvents(vesselId?)` | SELECT filtered | LOW |
| `createAlertEvent(data)` | INSERT | LOW |
| `acknowledgeAlertEvent(id)` | UPDATE | LOW |
| `getAlertDeliveries(eventId)` | SELECT filtered | LOW |
| `createAlertDelivery(data)` | INSERT | LOW |
| `getAlertConfig(vesselId)` | SELECT by vessel | LOW |
| `updateAlertConfig(vesselId, data)` | UPSERT | LOW |

---

### 4.11 Certificates & Surveys

#### Tables Involved

| Table | Purpose | Notes |
|-------|---------|-------|
| `component_class_regulatory` | Survey records | Already covered in Components module |

This module uses the `component_class_regulatory` table which is documented in the Components module (4.3).

#### IStorage Methods

All methods are implemented as part of the Components module:
- `getComponentClassRegulatory(componentId)`
- `createComponentClassRegulatory(data)`
- `updateComponentClassRegulatory(id, data)`

---

### 4.12 Change Requests (Modify PMS)

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `change_request` | Change request records | ~50-500 |
| `change_request_attachment` | Supporting documents | ~100-1000 |
| `change_request_comment` | Review comments | ~200-2000 |

#### Relationships

```
change_request.target_id → (component/work_order/spare/store)
change_request_attachment.change_request_id → change_request.id
change_request_comment.change_request_id → change_request.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.changeRequests[id]` | `change_request.*` |
| `changeRequest.snapshotBeforeJson` | `change_request.snapshot_before_json` (JSONB) |
| `changeRequest.proposedChangesJson` | `change_request.proposed_changes_json` (JSONB) |
| `changeRequest.movePreviewJson` | `change_request.move_preview_json` (JSONB) |
| `changeRequest.revisionHistory` | `change_request.revision_history` (JSONB) |
| `data.changeRequestAttachments[]` | `change_request_attachment.*` |
| `data.changeRequestComments[]` | `change_request_comment.*` |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getChangeRequests(vesselId?, status?)` | SELECT filtered | LOW |
| `getChangeRequest(id)` | SELECT + attachments + comments | MEDIUM |
| `createChangeRequest(data)` | INSERT + snapshot | MEDIUM |
| `updateChangeRequest(id, data)` | UPDATE | LOW |
| `submitChangeRequest(id)` | UPDATE status | LOW |
| `approveChangeRequest(id, approvalData)` | Complex transaction | **HIGH** |
| `rejectChangeRequest(id, rejectionData)` | UPDATE status | LOW |
| `returnChangeRequest(id, returnData)` | UPDATE status | LOW |
| `getChangeRequestAttachments(requestId)` | SELECT filtered | LOW |
| `createChangeRequestAttachment(data)` | INSERT | LOW |
| `getChangeRequestComments(requestId)` | SELECT filtered | LOW |
| `createChangeRequestComment(data)` | INSERT | LOW |

#### Transaction Boundaries - Change Request Approval

```typescript
async approveChangeRequest(id: number, approvalData: ApprovalData): Promise<ChangeRequest> {
  return db.transaction(async (tx) => {
    // 1. Get change request
    const [request] = await tx.select()
      .from(changeRequest)
      .where(eq(changeRequest.id, id));
    
    // 2. Apply changes to target entity
    const changes = request.proposedChangesJson as ProposedChange[];
    
    switch (request.category) {
      case 'components':
        await tx.update(components)
          .set(buildUpdateObject(changes))
          .where(eq(components.id, request.targetId));
        break;
      case 'work_orders':
        await tx.update(workOrders)
          .set(buildUpdateObject(changes))
          .where(eq(workOrders.id, request.targetId));
        break;
      case 'spares':
        await tx.update(spares)
          .set(buildUpdateObject(changes))
          .where(eq(spares.id, request.targetId));
        break;
      case 'stores':
        await tx.update(storesItems)
          .set(buildUpdateObject(changes))
          .where(eq(storesItems.id, request.targetId));
        break;
    }
    
    // 3. Update change request status
    const [updated] = await tx.update(changeRequest)
      .set({
        status: 'approved',
        approvedBy: approvalData.approver,
        approvedAt: new Date(),
        revisionNumber: sql`revision_number + 1`,
        revisionHistory: sql`revision_history || ${JSON.stringify({
          action: 'approved',
          by: approvalData.approver,
          at: new Date().toISOString()
        })}::jsonb`
      })
      .where(eq(changeRequest.id, id))
      .returning();
    
    // 4. Create audit log
    await tx.insert(auditLog).values({
      action: 'APPROVE_CHANGE_REQUEST',
      entityType: 'change_request',
      entityId: id.toString(),
      performedBy: approvalData.approver,
      payload: { request: updated, changes }
    });
    
    return updated;
  });
}
```

---

### 4.13 IHM

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `ihm_items` | Hazardous materials inventory | ~100-1000 |
| `ihm_maintenance_log` | Material handling during WOs | ~200-2000 |

#### Relationships

```
ihm_items.component_id → components.id
ihm_items.spare_id → spares.id
ihm_maintenance_log.work_order_id → work_orders.id
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getIhmItems(vesselId)` | SELECT filtered | LOW |
| `getIhmItem(id)` | SELECT by id | LOW |
| `createIhmItem(data)` | INSERT | LOW |
| `updateIhmItem(id, data)` | UPDATE | LOW |
| `getIhmMaintenanceLog(workOrderId?)` | SELECT filtered | LOW |
| `createIhmMaintenanceLog(data)` | INSERT | LOW |

---

### 4.14 Form Engine

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `form_definitions` | Form templates | ~10-50 |
| `form_versions` | Version history | ~50-200 |
| `form_version_usage` | Usage tracking | ~100-1000 |

#### Relationships

```
form_versions.form_definition_id → form_definitions.id
form_version_usage.form_version_id → form_versions.id
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getFormDefinitions()` | SELECT all | LOW |
| `getFormDefinition(id)` | SELECT by id | LOW |
| `createFormDefinition(data)` | INSERT | LOW |
| `updateFormDefinition(id, data)` | UPDATE | LOW |
| `getFormVersions(definitionId)` | SELECT filtered | LOW |
| `createFormVersion(data)` | INSERT | LOW |
| `getActiveFormVersion(definitionId)` | SELECT by active flag | LOW |
| `getFormVersionUsage(versionId)` | SELECT filtered | LOW |
| `createFormVersionUsage(data)` | INSERT | LOW |

---

### 4.15 Fleet Sync & Vessel Mapping

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `fleet_vessel_mapping` | Fleet-to-vessel assignments | ~20-100 |
| `fleet_component_mapping` | Component deployment tracking | ~500-5000 |
| `fleet_job_vessel_mapping` | Job deployment tracking | ~500-5000 |
| `fleet_spare_vessel_mapping` | Spare deployment tracking | ~500-5000 |

#### Relationships

```
fleet_vessel_mapping.fleet_id → fleets.id
fleet_vessel_mapping.vessel_id → vessels.id
fleet_component_mapping.component_id → components.id
fleet_component_mapping.vessel_id → vessels.id
fleet_job_vessel_mapping.job_id → jobs.id
fleet_job_vessel_mapping.vessel_id → vessels.id
fleet_spare_vessel_mapping.spare_id → spares.id
fleet_spare_vessel_mapping.vessel_id → vessels.id
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getFleetVesselMappings(fleetId)` | SELECT filtered | LOW |
| `createFleetVesselMapping(data)` | INSERT | LOW |
| `getFleetComponentMappings(componentId)` | SELECT filtered | LOW |
| `createFleetComponentMapping(data)` | INSERT | LOW |
| `getFleetJobVesselMappings(jobId)` | SELECT filtered | LOW |
| `createFleetJobVesselMapping(data)` | INSERT | LOW |
| `getFleetSpareVesselMappings(spareId)` | SELECT filtered | LOW |
| `createFleetSpareVesselMapping(data)` | INSERT | LOW |
| `syncFleetToVessel(fleetId, vesselId)` | Complex transaction | **HIGH** |

---

### 4.16 Import Engine

#### Tables Involved

| Table | Purpose | Record Count | Immutable |
|-------|---------|--------------|-----------|
| `import_history` | Import session tracking | ~100-1000 | No |
| `import_change_log` | Per-record change tracking | ~10000-100000 | Logical (undo snapshots) |

#### Relationships

```
import_change_log.import_id → import_history.id
import_change_log.entity_id → (components/jobs/spares/stores)
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.importHistory[]` | `import_history.*` |
| `data.importChangeLogs[]` | `import_change_log.*` |
| `changeLog.previousData` | `import_change_log.previous_data` (JSONB) |
| `changeLog.newData` | `import_change_log.new_data` (JSONB) |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getImportHistory(vesselId)` | SELECT filtered | LOW |
| `createImportHistory(data)` | INSERT | LOW |
| `updateImportHistory(id, data)` | UPDATE | LOW |
| `getImportChangeLogs(importId)` | SELECT filtered | LOW |
| `createImportChangeLog(data)` | INSERT | LOW |
| `undoImport(importId)` | Complex transaction | **HIGH** |

#### Transaction Boundaries - Import Undo

```typescript
async undoImport(importId: number): Promise<void> {
  return db.transaction(async (tx) => {
    // 1. Get all change logs for this import
    const changeLogs = await tx.select()
      .from(importChangeLog)
      .where(eq(importChangeLog.importId, importId))
      .orderBy(desc(importChangeLog.id)); // Reverse order
    
    // 2. Undo each change in reverse order
    for (const log of changeLogs) {
      switch (log.entityType) {
        case 'component':
          if (log.changeType === 'CREATE') {
            await tx.delete(components)
              .where(eq(components.id, log.entityId));
          } else if (log.changeType === 'UPDATE') {
            await tx.update(components)
              .set(log.previousData)
              .where(eq(components.id, log.entityId));
          }
          break;
        case 'job':
          // Similar logic for jobs
          break;
        case 'spare':
          // Similar logic for spares
          break;
        case 'store':
          // Similar logic for stores
          break;
      }
    }
    
    // 3. Mark import as undone
    await tx.update(importHistory)
      .set({ 
        status: 'UNDONE',
        undoneAt: new Date()
      })
      .where(eq(importHistory.id, importId));
    
    // 4. Create audit log
    await tx.insert(auditLog).values({
      action: 'UNDO_IMPORT',
      entityType: 'import_history',
      entityId: importId.toString(),
      payload: { recordsUndone: changeLogs.length }
    });
  });
}
```

---

### 4.17 Audit Log

#### Tables Involved

| Table | Purpose | Record Count | Immutable |
|-------|---------|--------------|-----------|
| `audit_log` | System-wide audit trail | ~10000-100000 | **YES** |

#### Relationships

```
audit_log (standalone - references entities by type+id strings)
```

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getAuditLogs(filters)` | SELECT with filters | LOW |
| `createAuditLog(data)` | INSERT (append-only) | LOW |

**Note:** Audit log is append-only. No UPDATE or DELETE operations are permitted.

---

### 4.18 Bulk Import

#### Tables Involved

| Table | Purpose | Record Count |
|-------|---------|--------------|
| `bulk_import_history` | Bulk import sessions | ~50-500 |
| `bulk_import_errors` | Error tracking | ~100-5000 |

#### Relationships

```
bulk_import_errors.import_id → bulk_import_history.id
```

#### JSON → SQL Field Mapping

| JSON Path | Table.Column |
|-----------|--------------|
| `data.bulkImportHistory[id]` | `bulk_import_history.*` |
| `bulkImport.rawRowData` | `bulk_import_errors.raw_row_data` (JSONB) |
| `data.bulkImportErrors[]` | `bulk_import_errors.*` |

#### IStorage Methods to Rewrite

| Method | Operation | Complexity |
|--------|-----------|------------|
| `getBulkImportHistory(vesselId)` | SELECT filtered | LOW |
| `getBulkImportHistoryItem(id)` | SELECT by id | LOW |
| `createBulkImportHistory(data)` | INSERT | LOW |
| `updateBulkImportHistory(id, data)` | UPDATE | LOW |
| `getBulkImportErrors(importId)` | SELECT filtered | LOW |
| `createBulkImportError(data)` | INSERT | LOW |
| `bulkCreateBulkImportErrors(data[])` | Batch INSERT | LOW |

---

## 5. Postgres Adapter Implementation

### 5.1 File Structure

```
server/
├── storage.ts                 # IStorage interface + factory
├── persistentStorage.ts       # File-based implementation (existing)
├── postgresStorage.ts         # Main PostgresStorage class
├── postgresStorage/
│   ├── index.ts               # Re-exports PostgresStorage
│   ├── coreReference.ts       # Users, fleets, vessels methods
│   ├── masterData.ts          # Master data methods
│   ├── components.ts          # Component CRUD + satellites
│   ├── jobs.ts                # Job CRUD
│   ├── workOrders.ts          # Work order CRUD + approval
│   ├── runningHours.ts        # Running hours cascade
│   ├── spares.ts              # Spares CRUD + history
│   ├── stores.ts              # Stores CRUD + ledger
│   ├── defects.ts             # Defects CRUD + actions/attachments
│   ├── alerts.ts              # Alert policies, events, deliveries
│   ├── changeRequests.ts      # Change request workflow
│   ├── ihm.ts                 # IHM items + maintenance log
│   ├── forms.ts               # Form definitions + versions
│   ├── fleetMapping.ts        # Fleet-to-vessel mapping
│   ├── import.ts              # Import history + change log
│   ├── audit.ts               # Audit log
│   └── bulk.ts                # Bulk operations
└── db.ts                      # Drizzle DB connection
```

### 5.2 PostgresStorage Class Structure

```typescript
// server/postgresStorage.ts

import { db } from "./db";
import { IStorage } from "./storage";

// Import method implementations from modules
import * as coreReference from "./postgresStorage/coreReference";
import * as masterData from "./postgresStorage/masterData";
import * as componentMethods from "./postgresStorage/components";
import * as jobMethods from "./postgresStorage/jobs";
import * as workOrderMethods from "./postgresStorage/workOrders";
// ... etc

export class PostgresStorage implements IStorage {
  // Core Reference Data
  getUser = coreReference.getUser;
  createUser = coreReference.createUser;
  updateUser = coreReference.updateUser;
  getFleet = coreReference.getFleet;
  getFleets = coreReference.getFleets;
  createFleet = coreReference.createFleet;
  getVessel = coreReference.getVessel;
  getVessels = coreReference.getVessels;
  createVessel = coreReference.createVessel;
  
  // Components
  getComponents = componentMethods.getComponents;
  getComponent = componentMethods.getComponent;
  createComponent = componentMethods.createComponent;
  updateComponent = componentMethods.updateComponent;
  deleteComponent = componentMethods.deleteComponent;
  
  // ... ~150+ method assignments
}
```

### 5.3 Database Connection Setup

```typescript
// server/db.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
```

### 5.4 Storage Factory with Feature Flag

```typescript
// server/storage.ts (Updated)

import { IStorage } from "./storageInterface";
import { PersistentFileStorage } from "./persistentStorage";
import { PostgresStorage } from "./postgresStorage";
import { DualWriteStorage } from "./dualWriteStorage";

export function createStorage(): IStorage {
  const mode = process.env.STORAGE_MODE || 'file';
  
  console.log(`[Storage] Initializing with mode: ${mode}`);
  
  switch (mode) {
    case 'postgres':
      return new PostgresStorage();
    case 'dual':
      // For transition validation - writes to both, reads from postgres
      return new DualWriteStorage(
        new PersistentFileStorage(),
        new PostgresStorage()
      );
    case 'file':
    default:
      return new PersistentFileStorage();
  }
}

export const storage: IStorage = createStorage();
```

### 5.5 Dual-Write Storage (Transition Period)

```typescript
// server/dualWriteStorage.ts

export class DualWriteStorage implements IStorage {
  constructor(
    private fileStorage: IStorage,
    private postgresStorage: IStorage
  ) {}
  
  // Read from Postgres (source of truth during validation)
  async getUser(id: number): Promise<User | undefined> {
    return this.postgresStorage.getUser(id);
  }
  
  // Write to both (for validation)
  async createUser(userData: InsertUser): Promise<User> {
    const [fileResult, pgResult] = await Promise.all([
      this.fileStorage.createUser(userData),
      this.postgresStorage.createUser(userData)
    ]);
    
    // Validate consistency
    if (!this.compareResults(fileResult, pgResult)) {
      console.error('[DualWrite] Mismatch detected:', { fileResult, pgResult });
    }
    
    return pgResult; // Return Postgres result
  }
  
  private compareResults(a: any, b: any): boolean {
    // Compare essential fields, ignore timestamps
    const aClean = this.normalizeForComparison(a);
    const bClean = this.normalizeForComparison(b);
    return JSON.stringify(aClean) === JSON.stringify(bClean);
  }
  
  private normalizeForComparison(obj: any): any {
    const { createdAt, updatedAt, ...rest } = obj;
    return rest;
  }
  
  // ... implement all other IStorage methods
}
```

---

## 6. Data Migration Strategy

### 6.1 Migration Script Structure

```typescript
// scripts/migrateData.ts

import { PersistentFileStorage } from "../server/persistentStorage";
import { db } from "../server/db";
import * as schema from "../shared/schema";

async function migrateData() {
  const fileStorage = new PersistentFileStorage();
  const data = fileStorage.getAllData();
  
  console.log("Starting data migration...");
  
  // Phase 1: Core Reference Data
  await migratePhase1(data);
  
  // Phase 2: Master Data
  await migratePhase2(data);
  
  // Phase 3: PMS Core
  await migratePhase3(data);
  
  // Phase 4: Inventory & Defects
  await migratePhase4(data);
  
  // Phase 5: Supporting Modules
  await migratePhase5(data);
  
  // Phase 6: Audit & Import
  await migratePhase6(data);
  
  console.log("Migration complete!");
}
```

### 6.2 ID Generation Strategy

| Entity Type | Current ID | Postgres ID Strategy |
|-------------|------------|---------------------|
| Users | Auto-increment counter | `SERIAL` (Postgres auto) |
| Fleets | String code (FLT001) | Keep as `TEXT PRIMARY KEY` |
| Vessels | String code (V001) | Keep as `TEXT PRIMARY KEY` |
| Components | UUID-like string | Keep as `TEXT PRIMARY KEY` |
| Jobs | UUID-like string | Keep as `TEXT PRIMARY KEY` |
| Work Orders | UUID-like string | Keep as `TEXT PRIMARY KEY` |
| Spares | Auto-increment counter | `SERIAL` |
| Stores Items | Auto-increment counter | `SERIAL` |
| Defects | UUID-like string | Keep as `TEXT PRIMARY KEY` |
| Audit Logs | Auto-increment counter | `SERIAL` |
| Change Requests | Auto-increment counter | `SERIAL` |

### 6.3 Data Validation Checks

```typescript
async function validateMigration(fileData: PersistentData) {
  const validationResults = {
    passed: [],
    failed: []
  };
  
  // Count validation
  const fileCounts = {
    users: Object.keys(fileData.users).length,
    components: Object.keys(fileData.components).length,
    jobs: Object.keys(fileData.jobs).length,
    workOrders: fileData.workOrders.length,
    spares: Object.keys(fileData.spares).length,
    defects: Object.keys(fileData.defects).length
  };
  
  const pgCounts = {
    users: await db.select({ count: sql`count(*)` }).from(schema.users),
    components: await db.select({ count: sql`count(*)` }).from(schema.components),
    jobs: await db.select({ count: sql`count(*)` }).from(schema.jobs),
    workOrders: await db.select({ count: sql`count(*)` }).from(schema.workOrders),
    spares: await db.select({ count: sql`count(*)` }).from(schema.spares),
    defects: await db.select({ count: sql`count(*)` }).from(schema.defects)
  };
  
  // Compare counts
  for (const [entity, fileCount] of Object.entries(fileCounts)) {
    const pgCount = pgCounts[entity][0].count;
    if (fileCount === pgCount) {
      validationResults.passed.push(`${entity}: ${fileCount} records`);
    } else {
      validationResults.failed.push(`${entity}: file=${fileCount}, pg=${pgCount}`);
    }
  }
  
  // Referential integrity checks
  await validateForeignKeys(validationResults);
  
  // Sample data spot checks
  await spotCheckRandomRecords(fileData, validationResults);
  
  return validationResults;
}
```

---

## 7. Cutover Strategy

### 7.1 Pre-Cutover Checklist

- [ ] All 50 tables migrated
- [ ] All ~150 IStorage methods implemented
- [ ] Count validation passed (file vs DB)
- [ ] Referential integrity validated
- [ ] Dual-write mode tested for 48+ hours
- [ ] Performance benchmarks acceptable
- [ ] Backup of test-data.json created
- [ ] Rollback procedure documented and tested

### 7.2 Cutover Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUTOVER PROCEDURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  T-24h: Final Preparation                                                   │
│  ├── Take final backup of test-data.json                                    │
│  ├── Run final data migration                                               │
│  └── Enable dual-write mode                                                 │
│                                                                              │
│  T-4h: Validation                                                           │
│  ├── Run full validation suite                                              │
│  ├── Compare checksums: file vs database                                    │
│  └── Review dual-write logs for discrepancies                               │
│                                                                              │
│  T-0: Cutover                                                               │
│  ├── Set STORAGE_MODE=postgres                                              │
│  ├── Restart application                                                    │
│  └── Monitor logs for errors                                                │
│                                                                              │
│  T+1h: Verification                                                         │
│  ├── Test critical workflows (WO approval, RH update)                       │
│  ├── Verify audit logs are being written                                    │
│  └── Confirm no file storage access                                         │
│                                                                              │
│  T+24h: Confirmation                                                        │
│  ├── Review error logs                                                      │
│  ├── Confirm performance metrics                                            │
│  └── Mark migration as successful                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Feature Flag Usage

| Environment Variable | Value | Behavior |
|---------------------|-------|----------|
| `STORAGE_MODE=file` | Default | Uses PersistentFileStorage |
| `STORAGE_MODE=postgres` | Production | Uses PostgresStorage |
| `STORAGE_MODE=dual` | Validation | Writes to both, reads from Postgres |

---

## 8. Risk Assessment & Mitigation

### 8.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during migration | LOW | CRITICAL | Full backup + validation + rollback plan |
| Transaction deadlocks | MEDIUM | HIGH | Implement retry logic, proper isolation levels |
| Performance degradation | MEDIUM | MEDIUM | Benchmark before/after, index optimization |
| Foreign key violations | LOW | MEDIUM | Migrate in dependency order, validate integrity |
| JSONB migration issues | LOW | LOW | Use existing schema types, validate structure |
| Counter ID conflicts | LOW | MEDIUM | Use SERIAL for new records, migrate existing IDs |
| Work order approval failure | LOW | HIGH | Transaction savepoints, detailed error logging |
| Running hours cascade failure | MEDIUM | HIGH | Atomic transactions, cascade locking |

### 8.2 Known Issues from Storage Analysis

| Issue | Current Behavior | Postgres Behavior | Migration Action |
|-------|------------------|-------------------|------------------|
| Full JSON rewrite on every write | ~500ms+ per write | Instant row updates | No action needed |
| In-memory filtering | O(n) scan | Index-based queries | Add proper indexes |
| Component code index | Manual rebuild | Unique constraint | Use UNIQUE INDEX |
| Write lock queue | Promise chain | DB transactions | Use BEGIN/COMMIT |
| Counter state | In-memory + persist | SERIAL columns | Migrate to SERIAL |

### 8.3 Mitigation Strategies

**Transaction Failure Handling:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}
```

---

## 9. Validation & Testing Plan

### 9.1 Unit Testing

Each PostgresStorage method should have unit tests:

```typescript
describe('PostgresStorage - Components', () => {
  it('should create a component', async () => {
    const component = await storage.createComponent({
      id: 'TEST-001',
      name: 'Test Component',
      vesselId: 'V001',
      dataScope: 'vessel'
    });
    expect(component.id).toBe('TEST-001');
  });
  
  it('should get component by id', async () => {
    const component = await storage.getComponent('TEST-001');
    expect(component?.name).toBe('Test Component');
  });
  
  // ... more tests
});
```

### 9.2 Integration Testing

Test complete workflows:

```typescript
describe('Work Order Approval Flow', () => {
  it('should approve work order and update all related entities', async () => {
    // Create component, job, work order
    // Submit work order
    // Approve work order
    // Verify:
    //   - Work order status = 'Completed'
    //   - Maintenance history created
    //   - Spares ROB decremented
    //   - Spares history created
    //   - Job next due updated
    //   - Audit log created
  });
});
```

### 9.3 Performance Testing

```typescript
describe('Performance Benchmarks', () => {
  it('should handle 1000 component reads under 1 second', async () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      await storage.getComponents('V001');
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
  
  it('should handle running hours cascade for 100 children', async () => {
    // Test performance of cascadeRunningHoursUpdate
  });
});
```

---

## 10. Rollback Plan

### 10.1 Instant Rollback (Environment Variable)

```bash
# Rollback to file storage
export STORAGE_MODE=file

# Restart application
pm2 restart all  # or: npm run restart
```

### 10.2 Full Rollback Procedure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROLLBACK PROCEDURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. IMMEDIATE (if critical issue detected)                                  │
│     └── Set STORAGE_MODE=file and restart                                   │
│                                                                              │
│  2. DATA SYNC (if Postgres has newer data)                                  │
│     ├── Export Postgres data to JSON format                                 │
│     ├── Compare with test-data.json                                         │
│     ├── Merge newer records back to JSON                                    │
│     └── Verify merged data integrity                                        │
│                                                                              │
│  3. CLEANUP                                                                 │
│     ├── Remove STORAGE_MODE variable (defaults to file)                     │
│     ├── Document rollback reason                                            │
│     └── Plan remediation steps                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Postgres to JSON Export Script

```typescript
// scripts/exportToJson.ts

async function exportToJson() {
  const data: PersistentData = {
    users: {},
    components: {},
    jobs: {},
    // ... initialize all collections
    counters: { /* current max IDs */ }
  };
  
  // Export users
  const users = await db.select().from(schema.users);
  for (const user of users) {
    data.users[user.id] = user;
    data.counters.userId = Math.max(data.counters.userId, user.id);
  }
  
  // Export components
  const components = await db.select().from(schema.components);
  for (const component of components) {
    data.components[component.id] = component;
  }
  
  // ... export all other entities
  
  // Write to file
  fs.writeFileSync('test-data-export.json', JSON.stringify(data, null, 2));
  console.log('Export complete: test-data-export.json');
}
```

---

## Summary

### Key Deliverables

1. **50 Tables** migrated across 18 functional modules
2. **~150 IStorage methods** reimplemented using Drizzle ORM
3. **StorageFactory** with feature flag for gradual rollout
4. **DualWriteStorage** for transition validation
5. **Data migration scripts** with validation
6. **Rollback procedure** for instant revert

### Critical Success Factors

1. **Zero API changes** - Frontend remains unchanged
2. **Transaction integrity** - Complex operations (WO approval, RH cascade) properly transacted
3. **Immutable tables** - `audit_log`, `component_maintenance_history`, `running_hours_audit` remain append-only
4. **Stores isolation** - Maintains zero PMS linkages
5. **Performance parity** - Database queries match or exceed file-based performance

### Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Foundation Setup | 1 week | 1 week |
| Core Tables | 1 week | 2 weeks |
| PMS Core | 2 weeks | 4 weeks |
| Inventory & Defects | 1 week | 5 weeks |
| Supporting Modules | 1 week | 6 weeks |
| Audit & Import | 1 week | 7 weeks |
| Validation & Cutover | 1-2 weeks | 8-9 weeks |

---

*Document Version: 1.0*
*Created: December 2025*
*Status: PLANNING ONLY - DO NOT APPLY*
*Prerequisites: STORAGE_ANALYSIS.md, POSTGRESQL_DATABASE_ARCHITECTURE.md, MODULE_WISE_DATABASE_ARCHITECTURE.md*
