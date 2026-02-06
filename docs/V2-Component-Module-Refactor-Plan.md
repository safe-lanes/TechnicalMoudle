# V2 Modular Architecture Plan — Component Module

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) component module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: Component Bulk Upload + Component Module fetch & usage only.

---

## Canonical V2 API Prefix

All V2 endpoints use this single canonical base path:

```
/technical/api/v2/components/component
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/components/` — module name
- `/component` — entity name

All references in this document use this exact prefix. No variations.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [V2 Folder Structure](#2-v2-folder-structure)
3. [V2 Schema Design](#3-v2-schema-design)
4. [Layer Mapping: Current → V2](#4-layer-mapping-current--v2)
5. [V2 Enforcement Rules](#5-v2-enforcement-rules)
6. [Toggle Mechanism](#6-toggle-mechanism)
7. [Phased Migration Plan](#7-phased-migration-plan)
8. [Toggle-Based Flow Diagram](#8-toggle-based-flow-diagram)
9. [Component Bulk Upload Refactor Plan](#9-component-bulk-upload-refactor-plan)
10. [Risk Points & Rollback Strategy](#10-risk-points--rollback-strategy)
11. [Validation Checklist Per Phase](#11-validation-checklist-per-phase)

---

## 1. Current State Analysis

### 1.1 Backend File Sizes & Responsibility Mapping

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `server/routes.ts` | 11,420 | All API routes for every module | Monolithic; component routes scattered at lines 83–396 and 5433–5682 |
| `server/postgresStorage.ts` | ~7,100 | All DB queries for every module | Acts as both repository and data-access layer |
| `server/storage.ts` | 933 | Interface definition | Single interface for all modules |
| `server/services/componentService.ts` | 222 | Component business logic | Exists but is **NOT used** — routes call `storage` directly |
| `server/routes/bulk.ts` | ~6,000+ | Bulk upload routes | Partially extracted but still uses `storage` directly |

### 1.2 Component Route Inventory (Legacy)

| Method | Path | Location | Purpose |
|--------|------|----------|---------|
| `GET` | `/technical/api/components/:vesselId` | routes.ts:83 | List components by vessel (legacy path-param pattern) |
| `GET` | `/technical/api/components/details/:id` | routes.ts:99 | Get single component by ID (legacy detail pattern) |
| `POST` | `/technical/api/components/upload` | routes.ts:113 | Bulk upload CSV/Excel |
| `POST` | `/technical/api/components` | routes.ts:5433 | Create single component |
| `GET` | `/technical/api/components` | routes.ts:5494 | List components (query-param pattern) |
| `GET` | `/technical/api/components/:id` | routes.ts:5505 | Get single component by ID |
| `PATCH` | `/technical/api/components/:id` | routes.ts:5517 | Update component |
| `DELETE` | `/technical/api/components/:id` | routes.ts:5637 | Hard delete component |
| `POST` | `/technical/api/components/:id/inactivate` | routes.ts:5652 | Soft inactivation |
| `GET` | `/technical/api/component-documents/:componentId` | routes.ts:1477 | List documents |
| `POST` | `/technical/api/component-documents` | routes.ts:1523 | Upload document |
| `PUT` | `/technical/api/component-documents/:id` | routes.ts:1635 | Update document |
| `DELETE` | `/technical/api/component-documents/:id` | routes.ts:1691 | Delete document |
| `GET` | `/technical/api/component-documents/:id/download` | routes.ts:1702 | Download document |
| `GET` | `/technical/api/component-class-regulatory/:componentId` | routes.ts:1761 | List class/regulatory |
| `POST` | `/technical/api/component-class-regulatory` | routes.ts:1788 | Create class/regulatory |
| `PUT` | `/technical/api/component-class-regulatory/:id` | routes.ts:1808 | Update class/regulatory |
| `DELETE` | `/technical/api/component-class-regulatory/:id` | routes.ts:1827 | Delete class/regulatory |
| `GET` | `/technical/api/component-requisitions/:componentId` | routes.ts:1840 | List requisitions |
| `POST` | `/technical/api/component-requisitions` | routes.ts:1945 | Create requisition |
| `PUT` | `/technical/api/component-requisitions/:id` | routes.ts:1977 | Update requisition |
| `DELETE` | `/technical/api/component-requisitions/:id` | routes.ts:2018 | Delete requisition |
| `GET` | `/technical/api/component-maintenance-history/:componentId` | routes.ts:2041 | List maintenance history |

### 1.3 Storage Interface Methods (Component-Related)

```
getComponents(vesselId: string): Promise<Component[]>
getComponent(id: string): Promise<Component | undefined>
getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined>
createComponent(component: InsertComponent): Promise<Component>
updateComponent(id: string, data: Partial<Component>): Promise<Component>
deleteComponent(id: string): Promise<void>
inactivateComponent(id, userId, options): Promise<{success, message, ...}>
getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]>
setComponentRunningHours(params): Promise<{component, inheritedUpdated}>
getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, Component>>
bulkCreateComponents(components: InsertComponent[]): Promise<Component[]>
bulkUpdateComponents(updates: {id, data}[]): Promise<Component[]>
bulkUpsertComponents(components: InsertComponent[]): Promise<{created, updated}>
getComponentDocuments(componentId): Promise<any[]>
getComponentDocument(id): Promise<any | undefined>
createComponentDocument(doc): Promise<any>
updateComponentDocument(id, data): Promise<any>
deleteComponentDocument(id): Promise<void>
getComponentClassRegulatory(componentId): Promise<any[]>
createComponentClassRegulatory(item): Promise<any>
updateComponentClassRegulatory(id, data): Promise<any>
deleteComponentClassRegulatory(id): Promise<void>
getComponentMaintenanceHistory(componentId): Promise<any[]>
getComponentMaintenanceHistoryByCode(code, vesselCode): Promise<any[]>
getComponentMaintenanceHistoryItem(id): Promise<any | undefined>
getComponentRequisitions(componentId): Promise<any[]>
createComponentRequisition(item): Promise<any>
updateComponentRequisition(id, data): Promise<any>
deleteComponentRequisition(id): Promise<void>
```

### 1.4 Current Schema (Legacy `components` Table)

```typescript
// shared/schema.ts — lines 234-316
components = pgTable("components", {
  id: text("id").primaryKey(),               // ← Text PK (not serial)
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetEquipmentName: text("fleet_equipment_name"),
  parentId: text("parent_id"),
  componentCode: text("component_code"),
  name: text("name"),
  componentCategory: text("component_category"),
  maker: text("maker"),
  makerCode: text("maker_code"),
  model: text("model"),
  modelCode: text("model_code"),
  serialNo: text("serial_no"),
  drawingNo: text("drawing_no"),
  location: text("location"),
  critical: boolean("critical").default(false),
  conditionBased: boolean("condition_based").default(false),
  installationDate: text("installation_date"),
  commissionedDate: text("commissioned_date"),
  rating: text("rating"),
  eqptSystemDept: text("eqpt_system_dept"),
  isActive: boolean("is_active").default(true),
  vesselCode: text("vessel_code"),
  isParent: boolean("is_parent").default(false),
  notes: text("notes"),
  vesselId: text("vessel_id"),
  dataScope: text("data_scope").notNull().default("vessel"),
  parentFleetEquipmentCode: text("parent_fleet_equipment_code"),
  modelNumber: text("model_number"),
  department: text("department"),
  deptCategory: text("dept_category"),
  category: text("category"),
  classItem: boolean("class_item").default(false),
  noOfUnits: text("no_of_units"),
  parentComponent: text("parent_component"),
  dimensionsSize: text("dimensions_size"),
  runningHours: decimal("running_hours"),
  currentCumulativeRH: decimal("current_cumulative_rh").notNull().default("0"),
  lastUpdated: text("last_updated"),
  applicableVesselIds: text("applicable_vessel_ids").array(),
  scopeNotes: text("scope_notes"),
  rhCounterType: text("rh_counter_type").notNull().default("NOT_RH_DRIVEN"),
  rhCounterSource: text("rh_counter_source"),
  rhMasterComponentId: text("rh_master_component_id"),
  rhCurrentMaster: decimal("rh_current_master"),
  rhMasterUpdatedAt: timestamp("rh_master_updated_at"),
  rhMasterUpdatedBy: text("rh_master_updated_by"),
  rhMasterUpdateSource: text("rh_master_update_source"),
  rhCurrentInheritedCached: decimal("rh_current_inherited_cached"),
  rhInheritedUpdatedAt: timestamp("rh_inherited_updated_at"),
  meterReplacedDate: timestamp("meter_replaced_date"),
  meterReplacedLastRh: decimal("meter_replaced_last_rh"),
  createdAt: timestamp("created_at").notNull().defaultNow(),   // ← timestamp, not text
  updatedAt: timestamp("updated_at").notNull().defaultNow(),   // ← timestamp, not text
})
```

**V2 Gaps Identified:**
- Uses `text("id")` as PK instead of `serial("id")` + `text("component_uuid")`
- No `sort_order`, `created_by_uuid`, `updated_by_uuid`, `is_deleted`, `is_sync` columns
- Uses `timestamp` type for dates instead of `text` (YYYY-MM-DD format)
- Uses `.array()` for `applicableVesselIds` (not a JSON column, but array)
- No hard FK constraints currently (already soft references) — aligns with V2 rule

### 1.5 Bulk Upload Flow (Current)

```
Frontend (MachineryComponentUpload.tsx)
  └→ Uses UniformBulkUpload component
     ├→ POST /technical/api/bulk/sheets      (load sheet names from Excel)
     ├→ POST /technical/api/bulk/dry-run      (validate without inserting)
     └→ POST /technical/api/bulk/import       (actual import)
        All go through server/routes/bulk.ts

Legacy Upload Path (routes.ts:113-396)
  └→ POST /technical/api/components/upload
     ├→ multer file receive
     ├→ CSV parse (PapaParse) / Excel parse (XLSX)
     ├→ 90-entry field mapping dictionary
     ├→ Header normalization (case-insensitive)
     ├→ Required field validation (4 fields)
     ├→ Boolean/decimal conversion
     └→ storage.bulkUpsertComponents() — direct DB call
```

**Two upload paths exist:**
1. **Legacy path** (`/components/upload`) — single-step, in `routes.ts`
2. **Uniform bulk path** (`/bulk/dry-run` + `/bulk/import`) — multi-step with preview, in `routes/bulk.ts`

### 1.6 Frontend API Consumption (Current)

| File | API Called | Pattern |
|------|-----------|---------|
| `Components.tsx:1360` | `/technical/api/components/${vesselId}` | Inline queryKey with template literal |
| `Components.tsx:2244` | `/technical/api/components/${vesselId}` | Duplicate fetch pattern |
| `Components.tsx:1891` | `/technical/api/component-documents/${id}` | Inline queryKey |
| `Components.tsx:2061` | `/technical/api/component-class-regulatory/${id}` | Inline queryKey |
| `Components.tsx:2139` | `/technical/api/component-requisitions/${id}` | Inline queryKey |
| `Components.tsx:1169` | `/technical/api/component-maintenance-history/${id}` | Inline queryKey |
| `MachineryComponentUpload.tsx:30-31` | Cache invalidation for `/technical/api/components` | Via `queryClient.invalidateQueries` |

**No centralized API layer** — all calls are inline `useQuery` with URL-as-queryKey.

### 1.7 Responsibilities Currently Mixed in Route Handlers

| Responsibility | Where It Lives Now | Should Be |
|----------------|-------------------|-----------|
| File parsing (CSV/Excel) | Route handler (routes.ts:126-153) | Upload Service |
| Field mapping dictionary (90 entries) | Route handler (routes.ts:157-245) | Upload Service / Config |
| Header normalization | Route handler (routes.ts:249-253) | Upload Service |
| Required field validation | Route handler (routes.ts:321-357) | Service Layer |
| Boolean/decimal conversion | Route handler (routes.ts:296-315) | Service Layer |
| RH validation (MASTER/INHERITED rules) | Route handler (routes.ts:5437-5592) | Service Layer |
| MASTER downgrade protection | Route handler (routes.ts:5582-5591) | Service Layer |
| RH cascade to inherited components | Route handler (routes.ts:5594-5618) | Service Layer |
| Direct DB calls (`storage.*`) | Route handlers throughout | Repository Layer |
| HTTP status code decisions | Route handlers | Controller Layer |
| Error response formatting | Route handlers | Controller Layer |

---

## 2. V2 Folder Structure

### 2.1 Backend

```
server/v2/
└── components/
    ├── index.ts                              ← Module entry: registers routes
    ├── routes.ts                             ← Express router with RESTful paths
    ├── controllers/
    │   ├── index.ts                          ← Barrel export
    │   ├── componentController.ts            ← HTTP handler for CRUD
    │   └── componentUploadController.ts      ← HTTP handler for bulk upload
    ├── services/
    │   ├── index.ts                          ← Barrel export
    │   ├── componentService.ts               ← Business logic for CRUD
    │   └── componentUploadService.ts          ← File parsing, mapping, validation
    └── repositories/
        ├── index.ts                          ← Barrel export
        └── componentRepository.ts            ← DB queries (Drizzle ORM only)
```

### 2.2 Shared Schema & Types

```
shared/v2/
└── components/
    ├── schema.ts                             ← V2 Drizzle schema (serial PK, UUID, audit cols)
    └── types.ts                              ← V2 request/response types, Zod schemas
```

### 2.3 Frontend

```
client/src/modules/
└── components/
    ├── api/
    │   └── componentApiV2.ts                 ← V2 API functions (typed, centralized)
    ├── hooks/
    │   ├── useComponents.ts                  ← V2 TanStack query hooks
    │   └── useComponentUpload.ts             ← V2 upload mutation hook
    └── components/
        └── ComponentApiToggle.tsx             ← Toggle control (V2 / Legacy)
```

### 2.4 Mapping: Current File → V2 Target Layer

| Current Source | Current Location | V2 Target |
|----------------|------------------|-----------|
| `storage.getComponents()` | `server/storage.ts:224` | `componentRepository.findAll()` |
| `storage.getComponent()` | `server/storage.ts:225` | `componentRepository.findByUuid()` |
| `storage.createComponent()` | `server/storage.ts:227` | `componentRepository.create()` |
| `storage.updateComponent()` | `server/storage.ts:228` | `componentRepository.update()` |
| `storage.deleteComponent()` | `server/storage.ts:229` | `componentRepository.softDelete()` |
| `storage.bulkUpsertComponents()` | `server/storage.ts:396` | `componentRepository.bulkUpsert()` |
| `storage.getInheritedComponents()` | `server/storage.ts:267` | `componentRepository.findInherited()` |
| `storage.setComponentRunningHours()` | `server/storage.ts:293` | `componentService.updateRunningHours()` → repo |
| RH validation (routes.ts:5437-5592) | Route handler | `componentService.validateRhRules()` |
| Field mapping dict (routes.ts:157-245) | Route handler | `componentUploadService.fieldMapping` |
| File parsing (routes.ts:126-153) | Route handler | `componentUploadService.parseFile()` |
| Row validation (routes.ts:278-365) | Route handler | `componentUploadService.validateRows()` |
| `componentService.ts` (existing) | `server/services/componentService.ts` | `server/v2/components/services/componentService.ts` |

---

## 3. V2 Schema Design

### 3.1 V2 Components Table (`components_v2`)

> **Note**: The V2 table exists alongside the legacy `components` table. No migration of legacy data during initial rollout.

```
Table: components_v2

Columns:
  id                          serial PK           ← Internal only, never exposed in API
  component_uuid              text UNIQUE NOT NULL ← External identifier, used in all API paths
  fleet_equipment_code        text
  fleet_equipment_name        text
  parent_uuid                 text                ← Soft reference to parent component_uuid
  component_code              text
  name                        text
  component_category          text
  maker                       text
  maker_code                  text
  model                       text
  model_code                  text
  serial_no                   text
  drawing_no                  text
  location                    text
  critical                    boolean DEFAULT false
  condition_based             boolean DEFAULT false
  installation_date           text                ← YYYY-MM-DD format (V2 rule: dates as text)
  commissioned_date           text
  rating                      text
  eqpt_system_dept            text
  is_active                   boolean DEFAULT true
  vessel_code                 text
  is_parent                   boolean DEFAULT false
  notes                       text
  vessel_uuid                 text                ← Soft reference to vessel UUID
  data_scope                  text NOT NULL DEFAULT 'vessel'
  parent_fleet_equipment_code text
  model_number                text
  department                  text
  dept_category               text
  category                    text
  class_item                  boolean DEFAULT false
  no_of_units                 text
  parent_component            text
  dimensions_size             text
  running_hours               text                ← Stored as text (V2 rule: no decimal type)
  current_cumulative_rh       text NOT NULL DEFAULT '0'
  last_updated                text
  scope_notes                 text
  rh_counter_type             text NOT NULL DEFAULT 'NOT_RH_DRIVEN'
  rh_counter_source           text
  rh_master_component_uuid    text                ← Soft reference to master component UUID
  rh_current_master           text
  rh_master_updated_at        text
  rh_master_updated_by        text
  rh_master_update_source     text
  rh_current_inherited_cached text
  rh_inherited_updated_at     text
  meter_replaced_date         text
  meter_replaced_last_rh      text

  --- V2 MANDATORY AUDIT COLUMNS ---
  sort_order                  integer DEFAULT 0
  created_at                  text NOT NULL        ← YYYY-MM-DDTHH:MM:SSZ format
  updated_at                  text NOT NULL
  created_by_uuid             text
  updated_by_uuid             text
  is_deleted                  boolean DEFAULT false ← Soft delete flag
  is_sync                     boolean DEFAULT false

Indexes:
  idx_v2_comp_uuid            UNIQUE (component_uuid)
  idx_v2_comp_vessel          (vessel_uuid) WHERE is_deleted = false
  idx_v2_comp_data_scope      (data_scope) WHERE is_deleted = false
  idx_v2_comp_rh_master       (rh_counter_type, vessel_uuid) WHERE is_deleted = false
  idx_v2_comp_parent          (parent_uuid) WHERE is_deleted = false
```

### 3.2 Key Differences: Legacy vs V2

| Aspect | Legacy (`components`) | V2 (`components_v2`) |
|--------|----------------------|---------------------|
| Primary Key | `text("id")` — user-provided string | `serial("id")` — auto-increment, internal |
| External ID | `id` (same as PK) | `component_uuid` (text, unique) |
| API identifier | `/components/:id` (text PK) | `/components/:uuid` (component_uuid) |
| Delete behavior | Hard delete / manual inactivation | Soft delete (`is_deleted = true`) |
| Date storage | Mixed: `text` for dates, `timestamp` for audit | All `text` (YYYY-MM-DD / ISO 8601) |
| Audit columns | Only `createdAt`, `updatedAt` | All 7: sort_order, created_at, updated_at, created_by_uuid, updated_by_uuid, is_deleted, is_sync |
| Decimal fields | `decimal("running_hours")` | `text` — parsed in service layer |
| Array columns | `applicableVesselIds: text().array()` | Dropped (or normalized into separate table if needed) |
| FK constraints | None (soft references) | None (V2 rule: soft UUID references only) |

### 3.3 Drizzle Schema Definition Location

```
File: shared/v2/components/schema.ts

Contents:
  - componentsV2 pgTable definition
  - insertComponentV2Schema (Zod via createInsertSchema, omitting id, created_at, updated_at, is_deleted)
  - InsertComponentV2 type
  - ComponentV2 type
```

---

## 4. Layer Mapping: Current → V2

### 4.1 Repository Layer (`componentRepository.ts`)

**Rules:**
- Only layer allowed to access the database
- Uses Drizzle ORM query builders exclusively
- Always filters `is_deleted = false` on all read queries
- No N+1 queries — uses JOINs where needed
- No business logic

**Method Inventory:**

| Method | Source Query | Notes |
|--------|-------------|-------|
| `findAll(vesselUuid)` | `SELECT * FROM components_v2 WHERE vessel_uuid = ? AND is_deleted = false` | Returns all active components |
| `findByUuid(uuid)` | `SELECT * FROM components_v2 WHERE component_uuid = ? AND is_deleted = false` | Returns single component |
| `findByCode(vesselUuid, code)` | `SELECT * FROM components_v2 WHERE vessel_uuid = ? AND component_code = ? AND is_deleted = false` | Lookup by code |
| `findInherited(masterUuid)` | `SELECT * FROM components_v2 WHERE rh_master_component_uuid = ? AND is_deleted = false` | Find INHERITED children |
| `create(data)` | `INSERT INTO components_v2 (...)` | Returns created row |
| `update(uuid, data)` | `UPDATE components_v2 SET ... WHERE component_uuid = ?` | Returns updated row |
| `softDelete(uuid, userUuid)` | `UPDATE SET is_deleted = true, updated_by_uuid = ?, updated_at = NOW()` | Soft delete only |
| `bulkUpsert(rows)` | Drizzle `onConflictDoUpdate` on `component_uuid` | Returns {created, updated} |
| `findByCodes(codes, vesselUuid)` | `SELECT * WHERE component_code IN (?) AND is_deleted = false` | Batch lookup |

### 4.2 Service Layer (`componentService.ts`)

**Rules:**
- All business logic lives here
- No HTTP objects (no `req`, `res`, `next`)
- No direct database access (calls repository only)
- Handles `created_by_uuid` / `updated_by_uuid` injection
- Applies create/update rules consistently

**Responsibilities extracted from current route handlers:**

| Business Rule | Current Location | V2 Service Method |
|---------------|------------------|-------------------|
| RH counter type validation (MASTER/INHERITED/NOT_RH_DRIVEN) | routes.ts:5437-5479 | `validateRhRules(data, existingComponent?)` |
| MASTER downgrade protection (check dependents) | routes.ts:5582-5591 | `validateRhDowngrade(componentUuid)` |
| Parent component exists validation | componentService.ts:37-47 | `validateParent(vesselUuid, parentUuid)` |
| RH cascade to inherited components | routes.ts:5594-5618 | `updateRunningHours(uuid, rhValue, userUuid)` |
| Component inactivation (block/cascade) | routes.ts:5652-5681 | `inactivateComponent(uuid, userUuid, cascade?)` |
| Set audit user on create | Not done currently | `create(data, userUuid)` |
| Set audit user on update | Not done currently | `update(uuid, data, userUuid)` |
| Set audit user on delete | Not done currently | `softDelete(uuid, userUuid)` |
| Build component hierarchy (tree structure) | componentService.ts:99-130 | `getHierarchy(vesselUuid)` |
| Build component path (breadcrumb) | componentService.ts:135-161 | `getComponentPath(vesselUuid, code)` |

### 4.3 Upload Service (`componentUploadService.ts`)

**Responsibilities extracted from routes.ts:113-396:**

| Responsibility | Current Location | V2 Method |
|----------------|------------------|-----------|
| File receive & extension check | routes.ts:115-152 | `parseFile(buffer, extension)` |
| CSV parsing (PapaParse) | routes.ts:126-134 | `parseCsv(buffer)` — called from `parseFile()` |
| Excel parsing (XLSX) | routes.ts:135-150 | `parseExcel(buffer)` — called from `parseFile()` |
| Field mapping dictionary (90 entries) | routes.ts:157-245 | `FIELD_MAPPING` constant |
| Header normalization | routes.ts:249-253 | `normalizeHeader(key)` |
| Column detection & mapping report | routes.ts:256-276 | `detectColumns(headers)` |
| Row-level validation (required fields) | routes.ts:278-365 | `validateRows(rows)` |
| Boolean field conversion | routes.ts:296-307 | `normalizeBoolean(value)` |
| Decimal field conversion | routes.ts:309-315 | `normalizeDecimal(value)` |
| Default values for optional fields | routes.ts:359-363 | `applyDefaults(component)` |

**Call flow in V2:**
```
componentUploadController.upload(req, res)
  └→ componentUploadService.parseFile(buffer, ext)
     └→ componentUploadService.mapAndValidate(rows)
        └→ componentService.bulkUpsert(validRows, userUuid)
           └→ componentRepository.bulkUpsert(rows)
```

### 4.4 Controller Layer (`componentController.ts`)

**Rules:**
- HTTP concerns only (req, res, status codes)
- Schema validation (Zod) before calling services
- Calls services only — no ORM, no business logic

**Method Inventory:**

| Controller Method | HTTP | Calls |
|-------------------|------|-------|
| `list(req, res)` | `GET /` | `componentService.getAll(vesselUuid)` |
| `getByUuid(req, res)` | `GET /:uuid` | `componentService.getByUuid(uuid)` |
| `create(req, res)` | `POST /` | Zod validate → `componentService.create(data, userUuid)` |
| `update(req, res)` | `PATCH /:uuid` | Zod validate → `componentService.update(uuid, data, userUuid)` |
| `remove(req, res)` | `DELETE /:uuid` | `componentService.softDelete(uuid, userUuid)` |
| `inactivate(req, res)` | `POST /:uuid/inactivate` | `componentService.inactivateComponent(uuid, userUuid, cascade)` |

**Upload Controller (`componentUploadController.ts`):**

| Controller Method | HTTP | Calls |
|-------------------|------|-------|
| `upload(req, res)` | `POST /upload` | `componentUploadService.parseFile()` → `.mapAndValidate()` → `componentService.bulkUpsert()` |

---

## 5. V2 Enforcement Rules

These rules are **mandatory** and must be enforced at every layer. Violations must be caught during code review.

### 5.1 Data Layer Rules

| Rule | Enforcement | Layer |
|------|-------------|-------|
| **Soft delete only** | `DELETE` endpoints set `is_deleted = true`, never execute SQL `DELETE` | Repository |
| **Always filter `is_deleted = false`** | Every read query in the repository appends `.where(eq(table.isDeleted, false))` | Repository |
| **No N+1 queries** | Repository methods use JOINs or batch queries for related data | Repository |
| **No direct DB access outside repositories** | Service and controller layers must NOT import Drizzle, `db`, or any table schema. Only repository modules import DB tooling. | Service, Controller |
| **ORM query builders only** | No raw SQL strings in repository layer. All queries built with Drizzle query builders | Repository |

### 5.2 API & Identity Rules

| Rule | Enforcement | Layer |
|------|-------------|-------|
| **UUIDs in APIs only** | All `:uuid` route params use `component_uuid` (text). Internal serial `id` is NEVER exposed in any response or accepted in any request. | Controller, Routes |
| **All relations via soft UUID references** | No hard FK constraints in V2 tables. Parent/child and cross-entity references use text UUID columns | Schema |
| **All dates stored as text** | Date columns use `text` type with `YYYY-MM-DD` format. Timestamp columns use `text` with ISO 8601 format (`YYYY-MM-DDTHH:MM:SSZ`) | Schema |

### 5.3 Column & Schema Rules

| Rule | Enforcement | Layer |
|------|-------------|-------|
| **No JSON columns** | V2 schema must not use `json()`, `jsonb()`, or `.array()` column types. Data that requires arrays must be normalized into separate tables or stored as comma-separated text | Schema |
| **Internal PK: `id` (serial)** | Every V2 table has `id: serial("id").primaryKey()` as auto-increment internal PK | Schema |
| **External identifier: `{entity}Uuid`** | Every V2 table has `{entity}_uuid: text().unique().notNull()` for external references | Schema |
| **7 mandatory audit columns** | Every V2 table includes: `sort_order` (integer), `created_at` (text), `updated_at` (text), `created_by_uuid` (text), `updated_by_uuid` (text), `is_deleted` (boolean), `is_sync` (boolean) | Schema |
| **Audit columns appended at end** | Audit columns are always the last 7 columns in the table definition | Schema |

### 5.4 Layer Boundary Rules

| Rule | Enforcement | Layer |
|------|-------------|-------|
| **Service handles audit user** | `created_by_uuid` and `updated_by_uuid` are set exclusively in the service layer before passing data to the repository | Service |
| **Controller: HTTP concerns only** | Controllers extract `req.params`, `req.body`, `req.query`, validate with Zod, call service, and return `res.json()` / `res.status()`. No business logic. | Controller |
| **Service: No HTTP objects** | Service methods accept plain TypeScript objects/strings. No `Request`, `Response`, or `NextFunction` imports. | Service |
| **No cross-module coupling** | V2 component module must not import from other V2 modules or legacy modules. If cross-module data is needed, it must go through a shared service or API call. | All layers |
| **No changes to legacy logic** | All V2 code lives in new files under `server/v2/`, `shared/v2/`, and `client/src/modules/`. Zero modifications to existing legacy files (except Phase 4 toggle integration). | All layers |

### 5.5 Numeric Field Handling

| Legacy Type | V2 Type | Conversion |
|-------------|---------|------------|
| `decimal("running_hours", { precision: 10, scale: 2 })` | `text("running_hours")` | Stored as text. Service layer validates numeric format using `parseFloat()` before saving. |
| `decimal("current_cumulative_rh")` | `text("current_cumulative_rh")` | Same pattern. All numeric precision is maintained as string representation. |
| `integer("quantity")` | `integer("quantity")` | Integers remain as `integer` type (not affected by the "dates as text" rule). |

---

## 6. Toggle Mechanism

### 6.1 Frontend Toggle Design

**Storage:** `localStorage` key: `pms_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

**Toggle Component:** `client/src/modules/components/components/ComponentApiToggle.tsx`

```
Location: Placed in the Component module header area (near existing settings/admin controls)
Behavior:
  - Toggle switch or dropdown: "V2 Mode" / "Legacy Mode"
  - On toggle, sets localStorage value and invalidates all component query caches
  - Shows visual indicator of active mode (small badge/pill)
```

### 6.2 API Selection Logic

**File:** `client/src/modules/components/api/componentApiV2.ts`

```
Pattern:
  const getApiBase = () => {
    const mode = localStorage.getItem('pms_api_version') || 'legacy';
    return mode === 'v2'
      ? '/technical/api/v2/components/component'
      : '/technical/api/components';
  };

  // All hook/api functions use getApiBase() to determine endpoint
```

### 6.3 How Both Systems Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (routes.ts)        V2 Routes (v2/)        │
│  ┌────────────────────────┐     ┌─────────────────────┐  │
│  │ /technical/api/        │     │ /technical/api/      │  │
│  │   components/*         │     │   api/v2/components/ │  │
│  │                        │     │   *                  │  │
│  │ → storage.*(...)       │     │ → controller         │  │
│  │   (direct DB call)     │     │   → service          │  │
│  │                        │     │   → repository       │  │
│  │ Reads/writes:          │     │   → componentV2 DB   │  │
│  │   components table     │     │ Reads/writes:        │  │
│  └────────────────────────┘     │   components_v2 tbl  │  │
│                                 └─────────────────────┘  │
│                                                          │
│  Both route sets coexist. No shared state. No conflict.  │
└─────────────────────────────────────────────────────────┘
```

**Key principle:** Legacy and V2 use **separate database tables** (`components` vs `components_v2`). This ensures:
- No data corruption risk
- Instant rollback by toggling back to legacy
- No migration of existing data required during initial rollout

### 6.4 Data Synchronization (Optional Future Phase)

During the parallel period, data entered via V2 will NOT appear in legacy views and vice versa. This is intentional to avoid complexity. A sync mechanism can be introduced in a later phase if needed:
- **Option A:** Background job that mirrors `components_v2` → `components` (one-way)
- **Option B:** Read from both tables and merge (complex, not recommended initially)
- **Option C:** Bulk data migration script run during a planned cutover window

### 6.5 Rollback to Legacy

**Instant rollback:**
1. User clicks toggle → switches to "Legacy"
2. `localStorage` updates to `'legacy'`
3. All frontend queries re-fire against legacy endpoints
4. No data loss — legacy table was never modified
5. V2 table data persists but is simply not queried

**No server restart needed.** Both route sets are always registered.

---

## 7. Phased Migration Plan

### Phase 1 — Structural Foundation (No functional change)

**Goal:** Create V2 folder structure, schema, and repository layer without affecting legacy.

| Step | Action | Files Created/Modified | Risk |
|------|--------|----------------------|------|
| 1.1 | Create `server/v2/components/` directory tree | New directories only | None |
| 1.2 | Create `shared/v2/components/schema.ts` with V2 Drizzle schema | New file | None |
| 1.3 | Create `shared/v2/components/types.ts` with Zod schemas + types | New file | None |
| 1.4 | Run `drizzle-kit generate` to create migration for `components_v2` table | New migration SQL file | Low — new table only |
| 1.5 | Apply migration to create `components_v2` table in DB | Database DDL | Low — additive only |
| 1.6 | Create `componentRepository.ts` with all query methods | New file | None |
| 1.7 | Create barrel `index.ts` files for each sublayer | New files | None |

**Validation:**
- [ ] V2 folder structure matches specification
- [ ] `components_v2` table exists in DB with all columns and indexes
- [ ] Repository methods compile and can be unit-tested in isolation
- [ ] Legacy routes, tables, and functionality completely untouched

---

### Phase 2 — Service & Controller Layers

**Goal:** Implement business logic and HTTP handling for V2 component CRUD.

| Step | Action | Files Created/Modified | Risk |
|------|--------|----------------------|------|
| 2.1 | Create `componentService.ts` with CRUD business logic | New file | None |
| 2.2 | Extract RH validation rules into service methods | New methods | None |
| 2.3 | Implement audit column injection (`created_by_uuid`, `updated_by_uuid`) | Service layer | None |
| 2.4 | Create `componentController.ts` with HTTP handlers | New file | None |
| 2.5 | Add Zod request body validation in controller | Controller | None |
| 2.6 | Create `routes.ts` with RESTful patterns | New file | None |
| 2.7 | Register V2 routes in Express app under `/technical/api/v2/` | `server/index.ts` or `server/v2/components/index.ts` | Low — additive |

**V2 RESTful Route Patterns:**

```
GET    /technical/api/v2/components/component            ← List all (query: ?vesselUuid=)
GET    /technical/api/v2/components/component/:uuid      ← Get by UUID
POST   /technical/api/v2/components/component            ← Create
PATCH  /technical/api/v2/components/component/:uuid      ← Update
DELETE /technical/api/v2/components/component/:uuid      ← Soft delete

POST   /technical/api/v2/components/component/upload     ← Bulk upload
POST   /technical/api/v2/components/component/:uuid/inactivate ← Inactivation

Nested sub-entities:
GET    /technical/api/v2/components/component/:uuid/documents
POST   /technical/api/v2/components/component/:uuid/documents
PATCH  /technical/api/v2/components/document/:uuid
DELETE /technical/api/v2/components/document/:uuid

GET    /technical/api/v2/components/component/:uuid/regulatory
POST   /technical/api/v2/components/component/:uuid/regulatory
PATCH  /technical/api/v2/components/regulatory/:uuid
DELETE /technical/api/v2/components/regulatory/:uuid

GET    /technical/api/v2/components/component/:uuid/requisitions
POST   /technical/api/v2/components/component/:uuid/requisitions
PATCH  /technical/api/v2/components/requisition/:uuid
DELETE /technical/api/v2/components/requisition/:uuid

GET    /technical/api/v2/components/component/:uuid/maintenance-history
```

**Validation:**
- [ ] All V2 CRUD endpoints return correct HTTP status codes (200, 201, 400, 404)
- [ ] Zod validation rejects invalid payloads with 400
- [ ] All responses use `component_uuid` (never expose internal `id`)
- [ ] All reads filter `is_deleted = false`
- [ ] DELETE performs soft delete (sets `is_deleted = true`)
- [ ] Audit columns are populated correctly
- [ ] Legacy routes remain completely unaffected

---

### Phase 3 — Bulk Upload Alignment

**Goal:** Extract upload logic into V2 service layer, reusing V2 repository.

| Step | Action | Files Created/Modified | Risk |
|------|--------|----------------------|------|
| 3.1 | Create `componentUploadService.ts` with file parsing logic | New file | None |
| 3.2 | Extract field mapping dictionary from routes.ts into upload service | New constant | None |
| 3.3 | Implement `parseFile()`, `parseCsv()`, `parseExcel()` methods | Upload service | None |
| 3.4 | Implement `mapAndValidate()` with row validation | Upload service | None |
| 3.5 | Create `componentUploadController.ts` | New file | None |
| 3.6 | Wire upload controller to call upload service → component service → repository | Controller | None |
| 3.7 | Register upload route: `POST /technical/api/v2/components/component/upload` | routes.ts | Low — additive |

**V2 Upload Call Chain:**
```
POST /technical/api/v2/components/component/upload
  → componentUploadController.upload(req, res)
    → Extracts file from multer
    → componentUploadService.parseFile(buffer, ext)
       → Returns parsed rows with detected headers
    → componentUploadService.mapAndValidate(rows, fieldMapping)
       → Returns { validRows, errors, columnInfo }
    → componentService.bulkUpsert(validRows, auditUserUuid)
       → componentRepository.bulkUpsert(rows)
    → Controller formats response { success, created, updated, failed, errors, preview }
```

**Key difference from legacy:** The upload service calls `componentService.bulkUpsert()` which in turn calls `componentRepository.bulkUpsert()`. This ensures:
- Same validation rules for single and bulk operations
- Audit columns handled by service layer
- No direct DB access from upload logic
- Consistent error handling

**Validation:**
- [ ] V2 upload endpoint accepts CSV and Excel files
- [ ] Field mapping produces same results as legacy for identical input files
- [ ] Validation errors match legacy format (row number, field, message)
- [ ] Bulk upsert uses repository methods (no direct SQL)
- [ ] Audit columns populated for bulk-created rows
- [ ] Legacy upload endpoints remain fully functional

---

### Phase 4 — Frontend Integration

**Goal:** Create V2 frontend API layer, hooks, and toggle mechanism.

| Step | Action | Files Created/Modified | Risk |
|------|--------|----------------------|------|
| 4.1 | Create `client/src/modules/components/` directory tree | New directories | None |
| 4.2 | Create `componentApiV2.ts` with typed API functions | New file | None |
| 4.3 | Create `useComponents.ts` with TanStack Query hooks | New file | None |
| 4.4 | Create `useComponentUpload.ts` with upload mutation hook | New file | None |
| 4.5 | Create `ComponentApiToggle.tsx` toggle component | New file | None |
| 4.6 | Add toggle to Component page header area | `Components.tsx` (minor) | Low |
| 4.7 | Replace inline queryKey strings with hook calls (behind toggle) | `Components.tsx` | Medium |
| 4.8 | Replace upload API call with V2 hook (behind toggle) | `MachineryComponentUpload.tsx` | Low |

**Frontend API Layer Design:**

```typescript
// client/src/modules/components/api/componentApiV2.ts

const V2_BASE = '/technical/api/v2/components/component';
const LEGACY_BASE = '/technical/api/components';

export const getApiBase = () => {
  const mode = localStorage.getItem('pms_api_version') || 'legacy';
  return mode === 'v2' ? V2_BASE : LEGACY_BASE;
};

// Typed API functions
export const componentApi = {
  list: (vesselUuid: string) =>
    fetch(`${getApiBase()}?vesselUuid=${vesselUuid}`).then(r => r.json()),

  getByUuid: (uuid: string) =>
    fetch(`${getApiBase()}/${uuid}`).then(r => r.json()),

  create: (data: CreateComponentV2, auditUserUuid: string) =>
    apiRequest('POST', getApiBase(), { ...data, auditUserUuid }),

  update: (uuid: string, data: Partial<CreateComponentV2>, auditUserUuid: string) =>
    apiRequest('PATCH', `${getApiBase()}/${uuid}`, { ...data, auditUserUuid }),

  remove: (uuid: string, auditUserUuid: string) =>
    apiRequest('DELETE', `${getApiBase()}/${uuid}`, { auditUserUuid }),

  upload: (file: File, vesselUuid: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('vesselUuid', vesselUuid);
    return fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
  },
};
```

**Hook Design:**

```typescript
// client/src/modules/components/hooks/useComponents.ts

export const useComponents = (vesselUuid: string) =>
  useQuery({
    queryKey: [getApiBase(), vesselUuid],
    // Default queryFn already handles fetch
  });

export const useCreateComponent = () =>
  useMutation({
    mutationFn: ({ data, userUuid }) => componentApi.create(data, userUuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [getApiBase()] }),
  });
```

**Validation:**
- [ ] Toggle switches between legacy and V2 API endpoints at runtime
- [ ] Component list loads from correct endpoint based on toggle state
- [ ] Bulk upload uses correct endpoint based on toggle state
- [ ] Cache invalidation works correctly after toggle switch
- [ ] No changes to legacy query patterns when toggle is set to "Legacy"
- [ ] All `auditUserUuid` passed to V2 API calls

---

## 8. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ComponentApiToggle  [ V2 Mode ●──○ Legacy Mode ]         │  │
│  │  Stores: localStorage('pms_api_version')                   │  │
│  └────────────────────┬───────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  componentApiV2.ts → getApiBase()                    │       │
│  │                                                      │       │
│  │  if (mode === 'v2') {                                │       │
│  │    base = '/technical/api/v2/components/component'│       │
│  │  } else {                                            │       │
│  │    base = '/technical/api/components'                 │       │
│  │  }                                                   │       │
│  └────────────┬──────────────────────┬──────────────────┘       │
│               │                      │                           │
│          V2 Mode                Legacy Mode                      │
│               │                      │                           │
└───────────────┼──────────────────────┼───────────────────────────┘
                │                      │
                ▼                      ▼
┌───────────────────────────┐  ┌──────────────────────────┐
│     V2 BACKEND STACK      │  │   LEGACY BACKEND STACK   │
│                           │  │                          │
│  Routes (v2/routes.ts)    │  │  routes.ts (monolithic)  │
│    ↓                      │  │    ↓                     │
│  Controller               │  │  (direct handler)        │
│    ↓                      │  │    ↓                     │
│  Service (business logic) │  │  storage.ts interface    │
│    ↓                      │  │    ↓                     │
│  Repository (DB queries)  │  │  postgresStorage.ts      │
│    ↓                      │  │    ↓                     │
│  components_v2 TABLE      │  │  components TABLE        │
└───────────────────────────┘  └──────────────────────────┘

ROLLBACK: Toggle → Legacy → All calls hit legacy stack → No data loss
```

---

## 9. Component Bulk Upload Refactor Plan

### 9.1 Current State (Two Paths)

**Path A — Legacy Direct Upload:**
```
POST /technical/api/components/upload (routes.ts:113-396)
  → multer → parse → map → validate → storage.bulkUpsertComponents()
  → 283 lines in one handler
```

**Path B — Uniform Bulk Upload:**
```
POST /technical/api/bulk/sheets (routes/bulk.ts)
POST /technical/api/bulk/dry-run (routes/bulk.ts)
POST /technical/api/bulk/import (routes/bulk.ts)
  → Multi-step with sheet selection, preview, and actual import
```

### 9.2 V2 Upload Architecture

```
V2 Upload Path:

POST /technical/api/v2/components/component/upload
  │
  ├→ componentUploadController.upload(req, res)
  │    │
  │    ├→ Extract file from multer middleware
  │    ├→ Validate file extension (CSV/XLSX/XLS)
  │    │
  │    ├→ componentUploadService.parseFile(buffer, extension)
  │    │    ├→ CSV: Papa.parse(content, { header, skipEmptyLines })
  │    │    └→ Excel: XLSX.read(buffer) → sheet_to_json()
  │    │    └→ Returns { rows: any[], headers: string[] }
  │    │
  │    ├→ componentUploadService.mapAndValidate(rows, headers)
  │    │    ├→ Apply FIELD_MAPPING constant (90 entries)
  │    │    ├→ Normalize headers (case-insensitive, flexible separators)
  │    │    ├→ Detect mapped/unmapped columns
  │    │    ├→ Per-row validation:
  │    │    │    ├→ Required: Component Code, Name, Category, Vessel Code
  │    │    │    ├→ Boolean normalization (true/false/yes/no/1/0)
  │    │    │    ├→ Decimal normalization (RH fields)
  │    │    │    └→ Apply defaults (currentCumulativeRH='0', critical=false)
  │    │    └→ Returns { validRows, errors, columnInfo }
  │    │
  │    ├→ componentService.bulkUpsert(validRows, auditUserUuid)
  │    │    ├→ Generate componentUuid for new rows
  │    │    ├→ Set created_by_uuid / updated_by_uuid
  │    │    ├→ Set created_at / updated_at
  │    │    └→ componentRepository.bulkUpsert(rows)
  │    │
  │    └→ Return response:
  │         { success, created, updated, failed, errors, preview, columnInfo }
  │
  └→ Legacy Path A and Path B remain fully intact
```

### 9.3 Mapping: Legacy Upload Handler → V2 Layers

| Legacy Code (routes.ts) | Lines | V2 Layer | V2 Method |
|--------------------------|-------|----------|-----------|
| `upload.single('file')` | 113 | Controller middleware | multer stays on route |
| File extension check | 120-152 | Upload Service | `parseFile(buffer, ext)` |
| Papa.parse (CSV) | 127-134 | Upload Service | `parseCsv(buffer)` |
| XLSX.read (Excel) | 136-150 | Upload Service | `parseExcel(buffer)` |
| `fieldMapping` dictionary | 157-245 | Upload Service | `FIELD_MAPPING` constant |
| `normalizeKey()` | 249 | Upload Service | `normalizeHeader(key)` |
| `normalizedMapping` build | 250-253 | Upload Service | `buildNormalizedMapping()` |
| Column detection | 256-276 | Upload Service | `detectColumns(headers, mapping)` |
| Row validation loop | 278-365 | Upload Service | `validateRows(rows, mapping)` |
| Boolean conversion | 296-307 | Upload Service | `normalizeBoolean(value)` |
| Decimal conversion | 309-315 | Upload Service | `normalizeDecimal(value)` |
| Default values | 359-363 | Upload Service | `applyDefaults(component)` |
| `storage.bulkUpsertComponents()` | 380 | Service → Repository | `componentService.bulkUpsert() → repo.bulkUpsert()` |
| Response construction | 382-390 | Controller | `res.json({...})` |

---

## 10. Risk Points & Rollback Strategy

### 10.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| V2 table migration fails | Medium | V2 table is additive — no impact on legacy table |
| V2 route conflicts with legacy | Low | Different URL prefix (`/api/v2/` vs no prefix) |
| Data entered in V2 not visible in legacy | Medium (expected) | Document clearly; sync is a later phase |
| Frontend toggle state lost on clear cache | Low | Default to 'legacy' — safest fallback |
| Performance of separate V2 table | Low | Same indexes, same DB engine |
| Bulk upload in V2 produces different results than legacy | Medium | Test with identical input files; compare output row by row |
| Other modules reference legacy component IDs | High | V2 table uses its own UUIDs; cross-module queries still use legacy table |
| RH cascade in V2 only updates V2 table | Medium | Expected during parallel period; cascade logic is V2-internal |

### 10.2 Rollback Strategy

**Instant Rollback (Frontend):**
- Toggle switch → "Legacy Mode"
- All frontend queries immediately target legacy endpoints
- No server restart required
- No data loss — V2 data persists in `components_v2`, legacy data untouched in `components`

**V2 Route Removal (Server):**
- Comment out V2 route registration in Express app
- Restart server
- V2 endpoints return 404; frontend toggle defaults to legacy

**V2 Table Cleanup (If Needed):**
- `DROP TABLE components_v2;` — only if fully abandoning V2
- Legacy table and all legacy functionality completely unaffected

### 10.3 Safe Migration Points

| Phase | Safe Rollback Point | What to Roll Back |
|-------|---------------------|-------------------|
| Phase 1 complete | Drop `components_v2` table | Remove new files from `server/v2/` and `shared/v2/` |
| Phase 2 complete | Remove V2 route registration | Comment out `app.use('/technical/api/v2', v2Router)` |
| Phase 3 complete | Same as Phase 2 | Upload service is only called by V2 routes |
| Phase 4 complete | Toggle to "Legacy" | Frontend reverts to legacy API calls |

---

## 11. Validation Checklist Per Phase

### Phase 1 — Structural Foundation

- [ ] `server/v2/components/` directory exists with all subfolders
- [ ] `shared/v2/components/schema.ts` defines `componentsV2` table with all 7 audit columns
- [ ] `shared/v2/components/types.ts` exports insert schema, select type, and request/response types
- [ ] Migration SQL file generated by `drizzle-kit generate`
- [ ] `components_v2` table exists in database (verify with `\dt components_v2` or SQL query)
- [ ] Table has all columns including `sort_order`, `created_at`, `updated_at`, `created_by_uuid`, `updated_by_uuid`, `is_deleted`, `is_sync`
- [ ] `component_uuid` column has UNIQUE constraint
- [ ] `componentRepository.ts` compiles without errors
- [ ] Legacy `routes.ts` is completely unchanged (diff shows zero modifications)
- [ ] Legacy `storage.ts` is completely unchanged
- [ ] Application starts and all legacy endpoints respond correctly

### Phase 2 — Service & Controller Layers

- [ ] `componentService.ts` compiles and has no dependency on HTTP objects
- [ ] `componentController.ts` never imports from repository layer directly
- [ ] Zod validation rejects malformed payloads with 400 status
- [ ] `POST /technical/api/v2/components/component` creates a row in `components_v2` with generated `component_uuid`
- [ ] `GET /technical/api/v2/components/component?vesselUuid=X` returns only non-deleted rows
- [ ] `DELETE` sets `is_deleted = true` (not hard delete)
- [ ] `created_by_uuid` and `updated_by_uuid` are set on every create/update
- [ ] RH validation rules produce same errors as legacy for identical invalid input
- [ ] MASTER downgrade protection works (reject if dependents exist)
- [ ] All legacy endpoints still respond correctly (regression test)

### Phase 3 — Bulk Upload Alignment

- [ ] `componentUploadService.ts` can parse both CSV and XLSX files
- [ ] Field mapping produces identical output to legacy for same input file
- [ ] Required field validation catches same errors as legacy
- [ ] Boolean normalization handles: true/false, yes/no, 1/0, Yes/No, TRUE/FALSE
- [ ] V2 upload endpoint returns same response structure as legacy
- [ ] Bulk-created rows have `component_uuid` generated
- [ ] Bulk-created rows have `created_by_uuid` set
- [ ] Legacy upload endpoints (`/components/upload` and `/bulk/import`) unaffected

### Phase 4 — Frontend Integration

- [ ] `client/src/modules/components/` directory exists
- [ ] `componentApiV2.ts` exports typed functions for all CRUD + upload operations
- [ ] Toggle defaults to "Legacy" when `localStorage` has no value
- [ ] Toggle switch immediately invalidates all component query caches
- [ ] In V2 mode: component list fetches from V2 endpoint
- [ ] In Legacy mode: component list fetches from legacy endpoint
- [ ] Upload in V2 mode sends to V2 upload endpoint
- [ ] `auditUserUuid` is always passed in V2 API calls
- [ ] No console errors in either mode
- [ ] Switching toggle back and forth does not cause data issues

---

## Appendix A: File Creation Checklist

| File | Phase | Purpose |
|------|-------|---------|
| `shared/v2/components/schema.ts` | 1 | V2 Drizzle table definition |
| `shared/v2/components/types.ts` | 1 | V2 types and Zod schemas |
| `server/v2/components/index.ts` | 1 | Module entry, route registration |
| `server/v2/components/routes.ts` | 2 | Express router |
| `server/v2/components/repositories/index.ts` | 1 | Barrel export |
| `server/v2/components/repositories/componentRepository.ts` | 1 | DB queries |
| `server/v2/components/services/index.ts` | 2 | Barrel export |
| `server/v2/components/services/componentService.ts` | 2 | Business logic |
| `server/v2/components/services/componentUploadService.ts` | 3 | Upload parsing/validation |
| `server/v2/components/controllers/index.ts` | 2 | Barrel export |
| `server/v2/components/controllers/componentController.ts` | 2 | HTTP handlers |
| `server/v2/components/controllers/componentUploadController.ts` | 3 | Upload HTTP handler |
| `client/src/modules/components/api/componentApiV2.ts` | 4 | Frontend API layer |
| `client/src/modules/components/hooks/useComponents.ts` | 4 | Query hooks |
| `client/src/modules/components/hooks/useComponentUpload.ts` | 4 | Upload mutation hook |
| `client/src/modules/components/components/ComponentApiToggle.tsx` | 4 | Toggle UI |

**Total new files: 16**
**Modified legacy files: 0** (until Phase 4.6 toggle integration)

---

## Appendix B: Enforcement Rules Compliance Matrix

| Rule | How V2 Enforces It |
|------|-------------------|
| Soft delete only | Repository `softDelete()` sets `is_deleted = true`; no `DELETE` SQL |
| Always filter `is_deleted = false` | Repository adds `.where(eq(table.isDeleted, false))` to all reads |
| UUIDs in APIs only | Controller never exposes `id`; all paths use `:uuid` param |
| No JSON columns | V2 schema uses only `text`, `boolean`, `integer`, `serial` |
| No cross-module coupling | V2 component module has no imports from other modules |
| No DB access outside repositories | Service and controller layers have no Drizzle imports |
| No changes to legacy logic | All V2 code in new files under `server/v2/` and `shared/v2/` |
| Audit columns in service layer | `componentService.create()` injects `created_by_uuid`, `created_at` etc. |
| All dates as text | V2 schema uses `text` for all date columns (YYYY-MM-DD format) |
| Nginx prefix respected | All V2 routes under `/technical/api/v2/...` |
