# V2 Modular Architecture Plan — Component Module

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) component module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: Component Bulk Upload + Component Module fetch & usage only.

**Critical Constraint**: The V2 architecture must use 100% the same business rules, validations, calculations, and workflows as legacy. This initiative is purely an architectural re-organization, not a functional rewrite.

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
3. [Layer Mapping: Current → V2](#3-layer-mapping-current--v2)
4. [Repository Layer Rules](#4-repository-layer-rules)
5. [Service Layer Rules](#5-service-layer-rules)
6. [Controller Layer Rules](#6-controller-layer-rules)
7. [RESTful Route Patterns](#7-restful-route-patterns)
8. [Frontend API Layer Rules](#8-frontend-api-layer-rules)
9. [Toggle Mechanism](#9-toggle-mechanism)
10. [Critical Enforcement Rules](#10-critical-enforcement-rules)
11. [Phased Migration Plan](#11-phased-migration-plan)
12. [Toggle-Based Flow Diagram](#12-toggle-based-flow-diagram)
13. [Component Bulk Upload Refactor Plan](#13-component-bulk-upload-refactor-plan)
14. [Risk Points & Rollback Strategy](#14-risk-points--rollback-strategy)
15. [Validation Checklist](#15-validation-checklist)

---

## 1. Current State Analysis

### 1.1 Backend File Sizes & Responsibility Mapping

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `server/routes.ts` | 11,420 | ALL route handlers for ALL modules | Monolithic — component routes mixed with every other module |
| `server/postgresStorage.ts` | 7,111 | ALL database queries for ALL modules | Monolithic — component queries mixed with every other query |
| `server/storage.ts` | 933 | Storage interface definition | 800+ methods spanning all modules in a single interface |
| `server/services/componentService.ts` | 221 | Component service class | Exists but is **unused** — routes call `storage` directly |
| `shared/schema.ts` | 2,610 | ALL Drizzle schema definitions | All tables in one file |
| `client/src/pages/pms/Components.tsx` | 3,308 | Component UI page | Inline API calls via `useQuery`, no API abstraction layer |

### 1.2 Component Route Inventory (Legacy)

**Primary Component Routes (routes.ts):**

| Line | Method | Path | Purpose |
|------|--------|------|---------|
| 83 | GET | `/technical/api/components/:vesselId` | List components by vessel |
| 99 | GET | `/technical/api/components/details/:id` | Get single component |
| 113 | POST | `/technical/api/components/upload` | Bulk upload (CSV/XLS/XLSX) |
| 5433 | POST | `/technical/api/components` | Create component |
| 5494 | GET | `/technical/api/components` | List all components (query param) |
| 5505 | GET | `/technical/api/components/:id` | Get component by ID |
| 5517 | PATCH | `/technical/api/components/:id` | Update component |
| 5637 | DELETE | `/technical/api/components/:id` | Delete component |
| 5652 | POST | `/technical/api/components/:id/inactivate` | Inactivate component |

**Sub-Entity Routes (routes.ts):**

| Line | Method | Path | Purpose |
|------|--------|------|---------|
| 1477 | GET | `/technical/api/component-documents/:componentId` | List documents |
| 1523 | POST | `/technical/api/component-documents` | Upload document |
| 1635 | PUT | `/technical/api/component-documents/:id` | Update document |
| 1691 | DELETE | `/technical/api/component-documents/:id` | Delete document |
| 1702 | GET | `/technical/api/component-documents/:id/download` | Download document |
| 1761 | GET | `/technical/api/component-class-regulatory/:componentId` | List regulatory |
| 1788 | POST | `/technical/api/component-class-regulatory` | Create regulatory |
| 1808 | PUT | `/technical/api/component-class-regulatory/:id` | Update regulatory |
| 1827 | DELETE | `/technical/api/component-class-regulatory/:id` | Delete regulatory |
| 1840 | GET | `/technical/api/component-requisitions/:componentId` | List requisitions |
| 1901 | GET | `/technical/api/component-requisitions` | List all requisitions |
| 1945 | POST | `/technical/api/component-requisitions` | Create requisition |
| 1977 | PUT | `/technical/api/component-requisitions/:id` | Update requisition |
| 2018 | DELETE | `/technical/api/component-requisitions/:id` | Delete requisition |
| 2031 | GET | `/technical/api/component-maintenance-history` | List maintenance history |
| 2041 | GET | `/technical/api/component-maintenance-history/:componentId` | Get maintenance history for component |
| 2111 | GET | `/technical/api/component-maintenance-history/item/:id` | Get single history item |

### 1.3 Storage Interface Methods (Component-Related)

From `server/storage.ts`, the component-related interface methods:

| Method | Returns | Used By |
|--------|---------|---------|
| `getComponents(vesselId)` | `Component[]` | Route L83, L5494 |
| `getComponent(id)` | `Component \| undefined` | Route L99, L5505 |
| `getComponentByCode(code, vesselId)` | `Component \| undefined` | Various |
| `createComponent(data)` | `Component` | Route L5433 |
| `updateComponent(id, data)` | `Component` | Route L5517 |
| `deleteComponent(id)` | `void` | Route L5637 |
| `inactivateComponent(id, userId, opts)` | Result object | Route L5652 |
| `bulkUpsertComponents(components)` | `{ created, updated }` | Upload L380 |
| `bulkCreateComponents(components)` | `Component[]` | Bulk import |
| `bulkUpdateComponents(components)` | `Component[]` | Bulk import |
| `getComponentDocuments(componentId)` | `any[]` | Route L1477 |
| `createComponentDocument(doc)` | `any` | Route L1523 |
| `updateComponentDocument(id, data)` | `any` | Route L1635 |
| `deleteComponentDocument(id)` | `void` | Route L1691 |
| `getComponentClassRegulatory(componentId)` | `any[]` | Route L1761 |
| `createComponentClassRegulatory(data)` | `any` | Route L1788 |
| `updateComponentClassRegulatory(id, data)` | `any` | Route L1808 |
| `deleteComponentClassRegulatory(id)` | `void` | Route L1827 |
| `getComponentRequisitions(componentId)` | `any[]` | Route L1840 |
| `createComponentRequisition(data)` | `any` | Route L1945 |
| `updateComponentRequisition(id, data)` | `any` | Route L1977 |
| `deleteComponentRequisition(id)` | `void` | Route L2018 |
| `setComponentRunningHours(params)` | Result object | Route L5517 (RH intercept) |
| `getInheritedComponents(masterComponentId)` | `Component[]` | Route L5517 (downgrade check) |
| `getMasterComponents(vesselId)` | `Component[]` | RH module |

### 1.4 Current Schema (Legacy `components` Table)

From `shared/schema.ts` (line 234), the `components` table has these column groups:

**Core Identifiers:**
- `id` (text, PK) — UUID
- `fleetEquipmentCode`, `fleetEquipmentName` — Fleet level
- `parentId` (text) — Parent component code reference
- `componentCode` (text) — Unique code within vessel

**Classification:**
- `name`, `componentCategory`, `category`, `deptCategory`
- `maker`, `makerCode`, `model`, `modelCode`, `modelNumber`
- `serialNo`, `drawingNo`, `location`, `department`
- `eqptSystemDept`, `rating`, `notes`

**Boolean Flags:**
- `critical`, `classItem`, `conditionBased`, `isActive`, `isParent`

**Running Hours (Section B7.B):**
- `runningHours` (decimal 10,2)
- `currentCumulativeRH` (decimal 10,2)
- `rhCounterType` (text: MASTER | INHERITED | NOT_RH_DRIVEN)
- `rhCounterSource`, `rhMasterComponentId`
- `rhCurrentMaster` (decimal 10,2)
- `rhMasterUpdatedAt`, `rhMasterUpdatedBy`

**Dates & Metadata:**
- `installationDate`, `commissionedDate`, `lastUpdated` (all text)
- `vesselCode`, `vesselId`, `dataScope`
- `noOfUnits`, `dimensionsSize`
- `parentFleetEquipmentCode`, `applicableVesselIds` (text array)
- `scopeNotes`

### 1.5 Key Business Logic in Route Handlers

The following business logic currently lives **inline in routes.ts** and must be preserved exactly:

**RH Field Validation (B7.B Rules) — Lines 5437-5592:**
1. MASTER counter type: `rhMasterComponentId` must be NULL
2. INHERITED counter type: `rhMasterComponentId` must be set, must reference a valid MASTER in same vessel
3. NOT_RH_DRIVEN: `rhMasterComponentId` must be NULL
4. Downgrade protection: Cannot change MASTER → other type if dependents exist
5. Self-reference prevention: Cannot inherit from self

**RH Cascade Update — Lines 5594-5618:**
- When `currentCumulativeRH` or `runningHours` is updated, route intercepts and calls `storage.setComponentRunningHours()` for field sync and cascade to inherited components
- Non-RH fields are then updated separately

**Bulk Upload Validation — Lines 113-396:**
- File parsing (CSV via PapaParse, XLS/XLSX via XLSX library)
- Flexible field mapping with case-insensitive header normalization
- Boolean field conversion (string "yes"/"true"/"1" → boolean)
- Decimal field conversion (parseFloat with NaN check)
- Required fields: `id`, `name`, `componentCategory`, `vesselCode`
- Defaults: `currentCumulativeRH` → '0', `critical` → false, `classItem` → false

**Inactivation — Lines 5652-5679:**
- Option A (default): Block if any child is ACTIVE
- Option B: Cascade inactivate with `cascadeInactivate=true`

### 1.6 Frontend API Consumption (Current)

From `client/src/pages/pms/Components.tsx`, API calls are made directly via `useQuery`:

| Query Key | Purpose |
|-----------|---------|
| `/technical/api/components/${vesselId}` | Fetch all components for vessel (2 places: L1360, L2244) |
| `/technical/api/component-documents/${selectedComponent?.id}` | Fetch documents for selected component (L1891) |
| `/technical/api/component-class-regulatory/${selectedComponent?.id}` | Fetch regulatory info (L2061) |
| `/technical/api/component-requisitions/${selectedComponent?.id}` | Fetch requisitions (L2139) |
| `/technical/api/component-maintenance-history/${componentDbId}` | Fetch maintenance history (L1169) |

**Pattern**: No API abstraction layer. All `useQuery` calls use inline `queryKey` arrays with direct URL strings. No `queryFn` (relies on default fetcher).

### 1.7 Existing Service Layer (Unused)

`server/services/componentService.ts` (221 lines) exists but is **not imported or used** by any route handler. Routes call `storage.*` directly. The service has:
- `getComponents(vesselId)` — passthrough to storage
- `getComponent(id)` — passthrough to storage
- `getComponentByCode(vesselId, code)` — filters from `getComponents()`
- `createComponent(data)` — validates parent exists, then calls storage
- `updateComponent(id, data)` — passthrough to storage
- `deleteComponent(id)` — passthrough to storage
- `getChildComponents()`, `getAllDescendants()`, `getComponentHierarchy()` — tree operations
- `bulkUpsertComponents()` — passthrough to storage
- `validateComponentData()` — basic field presence validation

**V2 Approach**: The V2 service layer will call the **same storage methods** that legacy routes call today, but through a proper Repository → Service → Controller chain. The business logic currently inline in routes will move to the service layer.

---

## 2. V2 Folder Structure

### 2.1 Backend (Component Module)

```
server/v2/
└── components/
    ├── index.ts                          ← Module entry: exports router
    ├── routes.ts                         ← Express router with V2 RESTful patterns
    ├── controllers/
    │   ├── index.ts                      ← Re-exports all controllers
    │   ├── componentController.ts        ← HTTP handlers for component CRUD
    │   └── componentUploadController.ts  ← HTTP handler for bulk upload
    ├── services/
    │   ├── index.ts                      ← Re-exports all services
    │   ├── componentService.ts           ← Business logic (RH validation, etc.)
    │   └── componentUploadService.ts     ← File parsing, field mapping, validation
    └── repositories/
        ├── index.ts                      ← Re-exports all repositories
        └── componentRepository.ts        ← Database access via existing storage
```

### 2.2 Shared Schema & Types

```
shared/v2/
└── components/
    ├── schema.ts                         ← Re-exports from shared/schema.ts (no duplication)
    └── types.ts                          ← V2-specific request/response types, Zod schemas
```

### 2.3 Frontend (Component Module)

```
client/src/modules/
└── components/
    ├── api/
    │   └── componentApiV2.ts             ← V2 API functions (one file per module)
    ├── hooks/
    │   └── useComponentsV2.ts            ← V2 query hooks wrapping componentApiV2
    └── components/
        └── ComponentApiToggle.tsx         ← Toggle UI component (V2 / Legacy switch)
```

### 2.4 Mapping: Current File → V2 Target Layer

| Current Location | Lines | V2 Target | V2 File |
|------------------|-------|-----------|---------|
| `routes.ts` L83-96 (GET components) | 14 | Controller | `componentController.ts` |
| `routes.ts` L99-110 (GET details) | 12 | Controller | `componentController.ts` |
| `routes.ts` L113-396 (upload) | 284 | Upload Controller + Upload Service | `componentUploadController.ts` + `componentUploadService.ts` |
| `routes.ts` L5433-5492 (POST create) | 60 | Controller + Service (RH validation) | `componentController.ts` + `componentService.ts` |
| `routes.ts` L5517-5635 (PATCH update) | 119 | Controller + Service (RH validation + cascade) | `componentController.ts` + `componentService.ts` |
| `routes.ts` L5637-5647 (DELETE) | 11 | Controller | `componentController.ts` |
| `routes.ts` L5652-5679 (inactivate) | 28 | Controller + Service | `componentController.ts` + `componentService.ts` |
| `routes.ts` L1477-1702 (documents) | 226 | Controller | `componentController.ts` (sub-entity) |
| `routes.ts` L1761-1827 (regulatory) | 67 | Controller | `componentController.ts` (sub-entity) |
| `routes.ts` L1840-2018 (requisitions) | 179 | Controller | `componentController.ts` (sub-entity) |
| `routes.ts` L2031-2111 (maintenance history) | 81 | Controller | `componentController.ts` (sub-entity) |
| `postgresStorage.ts` (component methods) | ~400 | Repository | `componentRepository.ts` |
| `Components.tsx` (inline API calls) | scattered | Frontend API + Hooks | `componentApiV2.ts` + `useComponentsV2.ts` |

---

## 3. Layer Mapping: Current → V2

### 3.1 How V2 Reuses Legacy Logic (Not Rewrites)

**Critical principle**: V2 layers call the **same storage methods** in `postgresStorage.ts` that legacy routes call today. The repository layer wraps storage calls. The service layer encapsulates business logic currently inline in routes. The controller layer handles HTTP concerns.

```
LEGACY FLOW:
  Request → routes.ts (HTTP + validation + business logic + storage call) → Response

V2 FLOW:
  Request → routes.ts → Controller (HTTP only) → Service (business logic) → Repository (storage call) → Response
```

The **same `storage.*` methods** are called at the end of both flows. The only difference is architectural separation.

### 3.2 Legacy Route → V2 Layer Decomposition

**Example: PATCH /components/:id (Update Component, lines 5517-5635)**

| Concern | Legacy Location | V2 Location |
|---------|-----------------|-------------|
| Extract `req.params.id` and `req.body` | Route handler | Controller |
| Validate request body with Zod | Not done (raw `req.body`) | Controller |
| Get existing component for validation | Route L5523 | Service |
| RH field validation (B7.B rules) | Route L5528-5592 | Service |
| Downgrade protection check | Route L5582-5591 | Service |
| RH cascade update intercept | Route L5594-5618 | Service |
| Call `storage.updateComponent()` | Route L5615-5623 | Repository |
| Format response, set status code | Route L5626-5633 | Controller |
| Error handling, status codes | Route L5628-5634 | Controller |

**Example: POST /components/upload (Bulk Upload, lines 113-396)**

| Concern | Legacy Location | V2 Location |
|---------|-----------------|-------------|
| multer middleware, file extraction | Route L113-117 | Controller (middleware stays on route) |
| File type detection | Route L120 | Upload Service |
| CSV parsing (PapaParse) | Route L126-134 | Upload Service |
| XLSX parsing (XLSX library) | Route L135-150 | Upload Service |
| Field mapping dictionary | Route L157-245 | Upload Service |
| Header normalization | Route L249-253 | Upload Service |
| Column detection for feedback | Route L256-276 | Upload Service |
| Row-by-row validation | Route L282-365 | Upload Service |
| Boolean field conversion | Route L296-307 | Upload Service |
| Decimal field conversion | Route L310-315 | Upload Service |
| Required field checks | Route L322-357 | Upload Service |
| Defaults assignment | Route L359-362 | Upload Service |
| `storage.bulkUpsertComponents()` | Route L380 | Repository |
| Response construction | Route L382-390 | Controller |

---

## 4. Repository Layer Rules

### 4.1 Purpose

The repository is the **only layer** allowed to access the database. In V2, it wraps calls to the existing `storage` interface in `postgresStorage.ts`.

### 4.2 Rules

| Rule | Detail |
|------|--------|
| **Only layer with DB access** | Only file allowed to import `storage` from `server/storage.ts` |
| **ORM query builders only** | No raw SQL strings — all queries go through existing `storage.*` methods which use Drizzle |
| **No N+1 queries** | Must use JOINs or batch queries (existing storage methods already do this) |
| **No business logic** | No validation, no conditional logic, no error interpretation |
| **Same data shape as legacy** | Returns the exact same types that `storage.*` methods return today |
| **Stateless** | No caching, no state — pure pass-through to storage |

### 4.3 Repository Method Signatures

```typescript
// server/v2/components/repositories/componentRepository.ts

import { storage } from "../../../storage";
import type { Component, InsertComponent } from "@shared/schema";

export class ComponentRepository {
  async findByVesselId(vesselId: string): Promise<Component[]> {
    return storage.getComponents(vesselId);
  }

  async findById(id: string): Promise<Component | undefined> {
    return storage.getComponent(id);
  }

  async findByCode(code: string, vesselId: string): Promise<Component | undefined> {
    return storage.getComponentByCode(code, vesselId);
  }

  async create(data: InsertComponent): Promise<Component> {
    return storage.createComponent(data);
  }

  async update(id: string, data: Partial<Component>): Promise<Component> {
    return storage.updateComponent(id, data);
  }

  async remove(id: string): Promise<void> {
    return storage.deleteComponent(id);
  }

  async inactivate(id: string, userId: string, options?: { cascadeInactivate?: boolean }) {
    return storage.inactivateComponent(id, userId, options);
  }

  async bulkUpsert(components: InsertComponent[]): Promise<{ created: number; updated: number }> {
    return storage.bulkUpsertComponents(components);
  }

  async setRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: string;
    userId: string;
    lastUpdatedDate?: string;
  }) {
    return storage.setComponentRunningHours(params);
  }

  async getInheritedComponents(masterComponentId: string): Promise<Component[]> {
    return storage.getInheritedComponents(masterComponentId);
  }

  // Sub-entity repositories
  async findDocuments(componentId: string) {
    return storage.getComponentDocuments(componentId);
  }

  async findDocument(id: number) {
    return storage.getComponentDocument(id);
  }

  async createDocument(doc: any) {
    return storage.createComponentDocument(doc);
  }

  async updateDocument(id: number, data: any) {
    return storage.updateComponentDocument(id, data);
  }

  async removeDocument(id: number) {
    return storage.deleteComponentDocument(id);
  }

  async findClassRegulatory(componentId: string) {
    return storage.getComponentClassRegulatory(componentId);
  }

  async createClassRegulatory(data: any) {
    return storage.createComponentClassRegulatory(data);
  }

  async updateClassRegulatory(id: number, data: any) {
    return storage.updateComponentClassRegulatory(id, data);
  }

  async removeClassRegulatory(id: number) {
    return storage.deleteComponentClassRegulatory(id);
  }

  async findRequisitions(componentId: string) {
    return storage.getComponentRequisitions(componentId);
  }

  async createRequisition(data: any) {
    return storage.createComponentRequisition(data);
  }

  async updateRequisition(id: number, data: any) {
    return storage.updateComponentRequisition(id, data);
  }

  async removeRequisition(id: number) {
    return storage.deleteComponentRequisition(id);
  }
}
```

**Key insight**: The repository does NOT create a new database layer. It wraps the existing `storage.*` calls, preserving identical query behavior and data shapes.

---

## 5. Service Layer Rules

### 5.1 Purpose

The service layer contains **all business logic** — the exact same logic currently inline in route handlers. It does not access the database directly (calls repository only) and does not handle HTTP objects.

### 5.2 Rules

| Rule | Detail |
|------|--------|
| **All business logic lives here** | RH validation, cascade, inactivation rules — all moved from routes |
| **No HTTP objects** | No `Request`, `Response`, or `NextFunction` imports |
| **No database access** | Calls repository only, never imports `storage` or Drizzle |
| **Handles audit user** | Receives `userId` as a parameter, passes to repository |
| **Same logic as legacy** | Apply create/update/validation rules identically to how they work in routes.ts today |
| **Returns plain objects** | Returns data or throws typed errors — controller decides HTTP status |

### 5.3 Business Logic Migration Map

The following logic moves from `routes.ts` to `componentService.ts`:

**RH Validation (B7.B Rules):**
```typescript
// V2 Service method — identical logic from routes.ts L5437-5592
async validateAndUpdate(id: string, data: Partial<Component>, userId: string): Promise<Component> {
  const existing = await this.repository.findById(id);
  if (!existing) throw new NotFoundError("Component not found");

  // RH field validation — exact same logic from routes.ts
  const effectiveRhType = data.rhCounterType || existing.rhCounterType || 'NOT_RH_DRIVEN';
  const effectiveMasterId = data.rhMasterComponentId !== undefined
    ? data.rhMasterComponentId
    : existing.rhMasterComponentId;

  if (data.rhCounterType || data.rhMasterComponentId !== undefined) {
    // MASTER validation
    if (effectiveRhType === 'MASTER' && effectiveMasterId) {
      throw new ValidationError("MASTER counter type cannot have a master component reference");
    }
    // INHERITED validation
    if (effectiveRhType === 'INHERITED') {
      if (!effectiveMasterId) throw new ValidationError("INHERITED requires rhMasterComponentId");
      if (effectiveMasterId === id) throw new ValidationError("Cannot inherit from self");
      const master = await this.repository.findById(effectiveMasterId);
      if (!master) throw new ValidationError("Master component not found");
      if (master.vesselId !== existing.vesselId) throw new ValidationError("Master must be same vessel");
      if (master.rhCounterType !== 'MASTER') throw new ValidationError("Referenced component is not MASTER");
    }
    // NOT_RH_DRIVEN validation
    if (effectiveRhType === 'NOT_RH_DRIVEN' && effectiveMasterId) {
      throw new ValidationError("NOT_RH_DRIVEN cannot have master reference");
    }
    // Downgrade protection
    if (existing.rhCounterType === 'MASTER' && effectiveRhType !== 'MASTER') {
      const dependents = await this.repository.getInheritedComponents(id);
      if (dependents.length > 0) {
        throw new ValidationError(`Cannot change from MASTER: ${dependents.length} dependents`);
      }
    }
  }

  // RH cascade update — exact same logic from routes.ts L5594-5618
  if (data.currentCumulativeRH !== undefined || data.runningHours !== undefined) {
    const rhValue = parseFloat(data.currentCumulativeRH || data.runningHours || '0');
    if (!isNaN(rhValue)) {
      const result = await this.repository.setRunningHours({
        componentId: id,
        newRHValue: rhValue,
        updateSource: 'MANUAL',
        userId,
        lastUpdatedDate: data.lastUpdated
      });
      const { currentCumulativeRH, runningHours, lastUpdated, ...otherData } = data;
      if (Object.keys(otherData).length > 0) {
        return this.repository.update(id, otherData);
      }
      return result.component;
    }
  }

  return this.repository.update(id, data);
}
```

**Create Validation:**
```typescript
// V2 Service method — identical logic from routes.ts L5437-5492
async create(data: InsertComponent, userId: string): Promise<Component> {
  const effectiveRhType = data.rhCounterType || 'NOT_RH_DRIVEN';

  if (data.rhCounterType || data.rhMasterComponentId) {
    if (effectiveRhType === 'MASTER' && data.rhMasterComponentId) {
      throw new ValidationError("MASTER cannot have master reference");
    }
    if (effectiveRhType === 'INHERITED') {
      if (!data.rhMasterComponentId) throw new ValidationError("INHERITED requires rhMasterComponentId");
      const master = await this.repository.findById(data.rhMasterComponentId);
      if (!master) throw new ValidationError("Master component not found");
      if (master.vesselId !== data.vesselId) throw new ValidationError("Master must be same vessel");
      if (master.rhCounterType !== 'MASTER') throw new ValidationError("Not a MASTER type");
    }
    if (effectiveRhType === 'NOT_RH_DRIVEN' && data.rhMasterComponentId) {
      throw new ValidationError("NOT_RH_DRIVEN cannot have master reference");
    }
  }

  return this.repository.create(data);
}
```

**Inactivation:**
```typescript
// V2 Service method — identical logic from routes.ts L5652-5679
async inactivate(id: string, userId: string, cascadeInactivate: boolean = false) {
  return this.repository.inactivate(id, userId, { cascadeInactivate });
}
```

### 5.4 Error Types

```typescript
// server/v2/components/services/errors.ts
export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}
```

---

## 6. Controller Layer Rules

### 6.1 Purpose

Controllers handle **HTTP concerns only**: extract request data, validate with Zod, call service, map errors to HTTP status codes, return response.

### 6.2 Rules

| Rule | Detail |
|------|--------|
| **HTTP concerns only** | Extract params, body, query; set status codes; return JSON |
| **Schema validation only** | Use Zod schemas for type coercion and structural checks only. Schemas must be **permissive** — they must accept the same inputs legacy routes accept (raw `req.body` with no validation). Zod must NOT reject inputs that legacy would accept. Its purpose is type safety, not stricter validation. |
| **Calls services only** | No direct database or storage access |
| **No ORM usage** | No Drizzle imports |
| **No business logic** | No RH validation, no cascade logic, no conditional data transformations |
| **Same response contracts** | Must return identical JSON shapes as legacy route handlers |
| **DELETE = legacy behavior** | V2 DELETE calls `storage.deleteComponent()` — same hard delete as legacy. If soft delete is needed in the future, it will be a separate initiative. V2 must not change delete behavior. |
| **Error mapping** | `NotFoundError` → 404, `ValidationError` → 400, unknown → 500 |

### 6.3 Controller Method Signatures

```typescript
// server/v2/components/controllers/componentController.ts

export class ComponentController {
  constructor(private service: ComponentService) {}

  async list(req: Request, res: Response): Promise<void> {
    // Maps to legacy GET /technical/api/components/:vesselId (L83-96)
    const { vesselId } = req.params;
    const components = await this.service.getByVesselId(vesselId);
    res.json(components);
  }

  async getById(req: Request, res: Response): Promise<void> {
    // Maps to legacy GET /technical/api/components/:id (L5505-5514)
    const component = await this.service.getById(req.params.id);
    if (!component) return res.status(404).json({ error: "Component not found" });
    res.json(component);
  }

  async create(req: Request, res: Response): Promise<void> {
    // Maps to legacy POST /technical/api/components (L5433-5492)
    // Note: Zod schema is permissive (passthrough) to match legacy behavior
    const data = req.body;
    const userId = (req as any).user?.username || 'unknown';
    const component = await this.service.create(data, userId);
    res.status(201).json(component);
  }

  async update(req: Request, res: Response): Promise<void> {
    // Maps to legacy PATCH /technical/api/components/:id (L5517-5635)
    // Note: Zod schema is permissive (passthrough) to match legacy behavior
    const data = req.body;
    const userId = (req as any).user?.username || 'unknown';
    const component = await this.service.validateAndUpdate(req.params.id, data, userId);
    res.json(component);
  }

  async remove(req: Request, res: Response): Promise<void> {
    // Maps to legacy DELETE /technical/api/components/:id (L5637-5647)
    await this.service.remove(req.params.id);
    res.json({ success: true });
  }

  async inactivate(req: Request, res: Response): Promise<void> {
    // Maps to legacy POST /technical/api/components/:id/inactivate (L5652-5679)
    const { cascadeInactivate, userId } = req.body;
    const result = await this.service.inactivate(req.params.id, userId || 'system', cascadeInactivate === true);
    if (!result.success) {
      const status = result.activeChildrenCount > 0 ? 400 : 400;
      return res.status(status).json(result);
    }
    res.json(result);
  }
}
```

### 6.4 Upload Controller

```typescript
// server/v2/components/controllers/componentUploadController.ts

export class ComponentUploadController {
  constructor(private uploadService: ComponentUploadService) {}

  async upload(req: Request, res: Response): Promise<void> {
    // Maps to legacy POST /technical/api/components/upload (L113-396)
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const result = await this.uploadService.processUpload(req.file);
    res.json(result);
  }
}
```

### 6.5 Error Handling Middleware

```typescript
// Wrap all controller methods with error handling
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error) => {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("V2 Component Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
}
```

---

## 7. RESTful Route Patterns

### 7.1 V2 Component Routes

```
GET    /technical/api/v2/components/component/:vesselId      ← List all by vessel
GET    /technical/api/v2/components/component/by-id/:id      ← Get by ID
POST   /technical/api/v2/components/component                ← Create
PATCH  /technical/api/v2/components/component/:id            ← Update
DELETE /technical/api/v2/components/component/:id            ← Delete (hard delete, matches legacy)
POST   /technical/api/v2/components/component/:id/inactivate ← Inactivate (preferred over delete)
POST   /technical/api/v2/components/component/upload         ← Bulk upload
```

### 7.2 V2 Sub-Entity Routes (Nested Under Component)

```
GET    /technical/api/v2/components/component/:componentId/documents
POST   /technical/api/v2/components/component/:componentId/documents
PUT    /technical/api/v2/components/component/documents/:id
DELETE /technical/api/v2/components/component/documents/:id
GET    /technical/api/v2/components/component/documents/:id/download

GET    /technical/api/v2/components/component/:componentId/class-regulatory
POST   /technical/api/v2/components/component/:componentId/class-regulatory
PUT    /technical/api/v2/components/component/class-regulatory/:id
DELETE /technical/api/v2/components/component/class-regulatory/:id

GET    /technical/api/v2/components/component/:componentId/requisitions
POST   /technical/api/v2/components/component/:componentId/requisitions
PUT    /technical/api/v2/components/component/requisitions/:id
DELETE /technical/api/v2/components/component/requisitions/:id

GET    /technical/api/v2/components/component/:componentId/maintenance-history
GET    /technical/api/v2/components/component/maintenance-history/:id
```

### 7.3 Route Response Contract Rule

**All V2 routes must return identical JSON shapes as legacy routes.** Specifically:

| V2 Route | Must Match Legacy Route | Response Shape |
|----------|------------------------|----------------|
| GET `/:vesselId` | GET `/technical/api/components/:vesselId` | `Component[]` |
| GET `/by-id/:id` | GET `/technical/api/components/:id` | `Component` |
| POST `/` | POST `/technical/api/components` | `Component` (201) |
| PATCH `/:id` | PATCH `/technical/api/components/:id` | `Component` |
| DELETE `/:id` | DELETE `/technical/api/components/:id` | `{ success: true }` |
| POST `/upload` | POST `/technical/api/components/upload` | `{ success, created, updated, failed, errors, preview, columnInfo }` |
| POST `/:id/inactivate` | POST `/technical/api/components/:id/inactivate` | `{ success, message, componentsInactivated, ... }` |

### 7.4 Route Registration

```typescript
// server/v2/components/routes.ts
import { Router } from 'express';

export function createComponentRouter(controller: ComponentController, uploadController: ComponentUploadController): Router {
  const router = Router();

  router.get('/component/:vesselId', asyncHandler(ctrl.list));
  router.get('/component/by-id/:id', asyncHandler(ctrl.getById));
  router.post('/component', asyncHandler(ctrl.create));
  router.patch('/component/:id', asyncHandler(ctrl.update));
  router.delete('/component/:id', asyncHandler(ctrl.remove));
  router.post('/component/:id/inactivate', asyncHandler(ctrl.inactivate));
  router.post('/component/upload', upload.single('file'), asyncHandler(uploadCtrl.upload));

  // Sub-entity routes...
  return router;
}

// server/v2/components/index.ts — Module entry point
import { createComponentRouter } from './routes';
// Wire up dependencies and export router

// Registration in main app (additive only):
// app.use('/technical/api/v2/components', v2ComponentRouter);
```

---

## 8. Frontend API Layer Rules

### 8.1 Rules

| Rule | Detail |
|------|--------|
| **One API file per module** | `componentApiV2.ts` contains all V2 API functions |
| **Toggle decides Legacy vs V2** | `getApiBase()` reads `localStorage('pms_api_version')` |
| **Always pass auditUserUuid** | All mutation calls include user context |
| **No direct fetch calls in components** | Components consume hooks, hooks consume API file |
| **Hooks/components consume module API only** | No inline `useQuery` with URL strings |
| **UI behavior must remain unchanged** | Same data shapes, same loading states, same error handling |

### 8.2 API File Pattern

```typescript
// client/src/modules/components/api/componentApiV2.ts

const getApiBase = () => {
  const mode = localStorage.getItem('pms_api_version') || 'legacy';
  return mode === 'v2'
    ? '/technical/api/v2/components/component'
    : '/technical/api';
};

export const componentApi = {
  getByVesselId: (vesselId: string) => {
    const base = getApiBase();
    const mode = localStorage.getItem('pms_api_version') || 'legacy';
    const url = mode === 'v2'
      ? `${base}/${vesselId}`
      : `/technical/api/components/${vesselId}`;
    return fetch(url).then(r => r.json());
  },

  getById: (id: string) => {
    const base = getApiBase();
    const mode = localStorage.getItem('pms_api_version') || 'legacy';
    const url = mode === 'v2'
      ? `${base}/by-id/${id}`
      : `/technical/api/components/${id}`;
    return fetch(url).then(r => r.json());
  },

  create: (data: any) => {
    const base = getApiBase();
    const mode = localStorage.getItem('pms_api_version') || 'legacy';
    const url = mode === 'v2' ? base : '/technical/api/components';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
  },

  // ... same pattern for update, delete, upload, inactivate

  getDocuments: (componentId: string) => {
    const base = getApiBase();
    const mode = localStorage.getItem('pms_api_version') || 'legacy';
    const url = mode === 'v2'
      ? `${base}/${componentId}/documents`
      : `/technical/api/component-documents/${componentId}`;
    return fetch(url).then(r => r.json());
  },

  // ... same pattern for regulatory, requisitions, maintenance-history
};
```

### 8.3 Hook Pattern

```typescript
// client/src/modules/components/hooks/useComponentsV2.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { componentApi } from '../api/componentApiV2';

export function useComponents(vesselId: string) {
  return useQuery({
    queryKey: ['components', vesselId],
    queryFn: () => componentApi.getByVesselId(vesselId),
    enabled: !!vesselId,
  });
}

export function useComponentDocuments(componentId: string | undefined) {
  return useQuery({
    queryKey: ['component-documents', componentId],
    queryFn: () => componentApi.getDocuments(componentId!),
    enabled: !!componentId,
  });
}

// ... same pattern for other queries and mutations
```

---

## 9. Toggle Mechanism

### 9.1 Frontend Toggle Design

**Storage:** `localStorage` key: `pms_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

**Toggle Component:** `client/src/modules/components/components/ComponentApiToggle.tsx`

```
Design:
  - Simple switch/toggle UI element in the Component page header
  - Shows "V2 Mode" or "Legacy Mode" indicator
  - On toggle, sets localStorage value and invalidates all component query caches
  - Shows visual indicator of active mode (small badge/pill)
```

### 9.2 How the Toggle Determines API Selection

```typescript
const getApiBase = () => {
  const mode = localStorage.getItem('pms_api_version') || 'legacy';
  return mode === 'v2'
    ? '/technical/api/v2/components/component'
    : '/technical/api';
};
```

- When toggle = `'legacy'` (default): All API calls go to existing legacy endpoints
- When toggle = `'v2'`: All API calls go to V2 endpoints under `/technical/api/v2/components/component/`

### 9.3 How Legacy and V2 Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (always registered):                      │
│    app.get("/technical/api/components/:vesselId", ...)   │
│    app.post("/technical/api/components/upload", ...)     │
│    app.patch("/technical/api/components/:id", ...)       │
│    ... (all existing routes unchanged)                   │
│                                                          │
│  V2 Routes (always registered, additive):                │
│    app.use("/technical/api/v2/components", v2Router)     │
│    → GET /component/:vesselId                            │
│    → POST /component/upload                              │
│    → PATCH /component/:id                                │
│    ... (new routes, same storage underneath)              │
│                                                          │
│  BOTH route sets call the SAME storage methods:          │
│    storage.getComponents()                                │
│    storage.updateComponent()                              │
│    storage.bulkUpsertComponents()                         │
│    etc.                                                   │
└─────────────────────────────────────────────────────────┘
```

**Key facts:**
- Both route sets are always registered — no server restart needed
- Both call the same `storage.*` methods → same database → same data
- Toggle only controls which URL the frontend calls
- No data divergence risk — there is only ONE database table (`components`)

### 9.4 How Rollback Happens Instantly

**Instant rollback:**
1. User clicks toggle → switches to "Legacy"
2. `localStorage` updates to `'legacy'`
3. All query caches are invalidated
4. Next render: all `useQuery` hooks fire with legacy URLs
5. Same data loads from same database table

**Zero data loss**: Both V2 and legacy operate on the same `components` table in the same database. There is no separate V2 data store. Switching modes is purely a URL routing change.

**No behavior difference**: V2 service layer executes identical business logic to what's inline in legacy routes. Same inputs → same validation → same storage calls → same outputs.

---

## 10. Critical Enforcement Rules

These rules are **mandatory** for all V2 code. Violations must be caught during code review.

### 10.1 Architecture Enforcement

| Rule | Detail |
|------|--------|
| **No JSON columns** | V2 shared types must not introduce `json()` or `jsonb()` column types |
| **No cross-module coupling** | V2 component module must not import from other V2 modules. If cross-module data is needed, go through storage or a shared API call |
| **No DB access outside repositories** | Service and controller layers must NOT import `storage`, `db`, or any Drizzle table schema |
| **No functional or logical changes** | V2 must produce identical outputs for identical inputs as legacy |
| **No data model behavior change** | Same table, same columns, same constraints — no schema changes |
| **No legacy code modification** | All V2 code lives in new files under `server/v2/`, `shared/v2/`, and `client/src/modules/`. Zero modifications to existing legacy files (Phase 4 toggle integration excepted) |

### 10.2 Layer Boundary Enforcement

| Rule | Enforcement | Layer |
|------|-------------|-------|
| **Repository: DB only** | Only layer that imports `storage`. No business logic, no HTTP objects. | Repository |
| **Service: logic only** | No `Request`/`Response` imports. No `storage` import. Receives plain params, returns plain objects or throws errors. | Service |
| **Controller: HTTP only** | Extracts req data, validates with Zod, calls service, maps errors to status codes. No business logic. | Controller |
| **Routes: wiring only** | Maps HTTP methods + paths to controller methods. No inline logic. | Routes |

### 10.3 Response Contract Enforcement

| Rule | Detail |
|------|--------|
| **Same inputs** | V2 accepts the same request shapes (params, body, query) as legacy |
| **Same logic** | V2 service executes the same validation/cascade/business rules as legacy route handlers |
| **Same outputs** | V2 returns the same JSON response shapes as legacy endpoints |

---

## 11. Phased Migration Plan

### Phase 1 — Backend Structure (No functional change)

**Goal:** Create V2 folder structure, repository, and service layers. Wire up routes. No legacy changes.

| Step | Task | File | Legacy Impact |
|------|------|------|---------------|
| 1.1 | Create `server/v2/components/` directory structure | New directories | None |
| 1.2 | Create `shared/v2/components/schema.ts` (re-exports from shared/schema.ts) | New file | None |
| 1.3 | Create `shared/v2/components/types.ts` (Zod schemas for request validation) | New file | None |
| 1.4 | Implement `componentRepository.ts` (wraps storage calls) | New file | None |
| 1.5 | Implement `componentService.ts` (business logic from routes) | New file | None |
| 1.6 | Implement `componentUploadService.ts` (file parsing/validation from routes) | New file | None |
| 1.7 | Implement `componentController.ts` (HTTP handlers) | New file | None |
| 1.8 | Implement `componentUploadController.ts` (upload handler) | New file | None |
| 1.9 | Create `routes.ts` with RESTful patterns | New file | None |
| 1.10 | Create `index.ts` module entry point | New file | None |
| 1.11 | Register V2 routes in Express app under `/technical/api/v2/components/` | Additive change to server startup | Low — additive only |

**Validation:**
- [ ] All V2 CRUD endpoints return correct HTTP status codes (200, 201, 400, 404)
- [ ] Zod validation rejects invalid payloads with 400
- [ ] All responses match legacy response shapes exactly
- [ ] Legacy routes remain completely unaffected
- [ ] RH validation rules produce identical results to legacy
- [ ] RH cascade update works identically
- [ ] Inactivation with/without cascade works identically

### Phase 2 — Sub-Entity Routes

**Goal:** Add V2 routes for component sub-entities (documents, regulatory, requisitions, maintenance history).

| Step | Task | File | Legacy Impact |
|------|------|------|---------------|
| 2.1 | Add document CRUD to repository | `componentRepository.ts` | None |
| 2.2 | Add document handlers to controller | `componentController.ts` | None |
| 2.3 | Add class-regulatory CRUD to repository and controller | Same files | None |
| 2.4 | Add requisition CRUD to repository and controller | Same files | None |
| 2.5 | Add maintenance-history read endpoints | Same files | None |
| 2.6 | Register all sub-entity routes | `routes.ts` | None |

**Validation:**
- [ ] All sub-entity GET/POST/PUT/DELETE endpoints work
- [ ] Document download works
- [ ] Response shapes match legacy exactly

### Phase 3 — Bulk Upload Alignment

**Goal:** Move bulk upload logic from controller to upload service, keeping identical parsing and validation behavior.

| Step | Task | File | Legacy Impact |
|------|------|------|---------------|
| 3.1 | Implement `processUpload()` in upload service | `componentUploadService.ts` | None |
| 3.2 | Wire upload controller to use upload service | `componentUploadController.ts` | None |
| 3.3 | Verify field mapping dictionary matches legacy exactly | Test comparison | None |
| 3.4 | Verify boolean/decimal conversion matches legacy | Test comparison | None |

**Validation:**
- [ ] Upload same test file via legacy and V2 → compare results row by row
- [ ] Column detection (`columnInfo`) output matches exactly
- [ ] Error messages match exactly
- [ ] Same defaults applied

### Phase 4 — Frontend Integration & Toggle

**Goal:** Create frontend API abstraction, hooks, and toggle component.

| Step | Task | File | Legacy Impact |
|------|------|------|---------------|
| 4.1 | Create `componentApiV2.ts` with toggle-aware API functions | New file | None |
| 4.2 | Create `useComponentsV2.ts` hooks | New file | None |
| 4.3 | Create `ComponentApiToggle.tsx` toggle UI | New file | None |
| 4.4 | Add toggle to Component page header | `Components.tsx` — minimal change | Low — additive toggle UI |
| 4.5 | Replace inline `useQuery` calls with V2 hooks (toggle-aware) | `Components.tsx` | Medium — refactor API consumption |
| 4.6 | Test toggle switching between legacy and V2 | Manual test | None |

**Validation:**
- [ ] Toggle defaults to "Legacy" mode
- [ ] Switching to V2 mode: all data loads correctly
- [ ] Switching back to Legacy mode: all data loads correctly
- [ ] No visual differences between modes
- [ ] All `auditUserUuid` passed to V2 API calls

---

## 12. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌─────────────┐                                                 │
│  │  Toggle UI  │  localStorage: 'pms_api_version' = 'v2'|'legacy'│
│  └──────┬──────┘                                                 │
│         │                                                        │
│         ▼                                                        │
│  ┌───────────────────┐                                           │
│  │ componentApiV2.ts │  getApiBase() reads toggle                │
│  └──────┬────────────┘                                           │
│         │                                                        │
│    ┌────┴────┐                                                   │
│    │         │                                                   │
│    ▼         ▼                                                   │
│  Legacy    V2 URL                                                │
│  URL       /technical/api/v2/components/component/...            │
│  /technical/api/components/...                                   │
└────┬─────────┬───────────────────────────────────────────────────┘
     │         │
     ▼         ▼
┌────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  Legacy Handler          V2 Handler                              │
│  (routes.ts)             (v2/components/routes.ts)               │
│  inline logic            Controller → Service → Repository      │
│         │                         │                              │
│         └─────────┬───────────────┘                              │
│                   ▼                                              │
│         ┌─────────────────┐                                      │
│         │ storage.*()     │  SAME storage methods                │
│         │ (postgresStorage│  SAME database table                 │
│         │  .ts)           │  SAME data                           │
│         └────────┬────────┘                                      │
│                  ▼                                                │
│         ┌────────────────┐                                       │
│         │  PostgreSQL    │                                       │
│         │  components    │  ← ONE table, shared by both          │
│         │  table         │                                       │
│         └────────────────┘                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Component Bulk Upload Refactor Plan

### 13.1 Current State

**Legacy Upload Handler (routes.ts L113-396, 284 lines):**

```
POST /technical/api/components/upload
  → multer middleware (file extraction)
  → File type detection (CSV vs XLSX/XLS)
  → CSV: PapaParse with header=true, skipEmptyLines, dynamicTyping
  → XLSX: XLSX.read + sheet_to_json, manual header extraction
  → Field mapping dictionary (89 entries, case-insensitive normalization)
  → Column detection for user feedback
  → Row-by-row validation:
    - Required: id, name, componentCategory, vesselCode
    - Boolean conversion: critical, classItem, conditionBased, isParent, isActive
    - Decimal conversion: currentCumulativeRH, runningHours
    - Defaults: currentCumulativeRH='0', critical=false, classItem=false
  → storage.bulkUpsertComponents(processedComponents)
  → Response: { success, created, updated, failed, errors, preview, columnInfo }
```

### 13.2 V2 Upload Architecture

```
V2 Upload Path:

POST /technical/api/v2/components/component/upload
  │
  ├→ Controller: componentUploadController.ts
  │   - multer middleware on route definition
  │   - Validates file exists
  │   - Calls uploadService.processUpload(req.file)
  │   - Returns result as JSON
  │
  ├→ Upload Service: componentUploadService.ts
  │   - parseFile(buffer, extension) → { data, headers }
  │   - mapAndValidate(parsedData, headers) → { processedComponents, errors, columnInfo }
  │   - Contains EXACT same:
  │     · Field mapping dictionary (89 entries)
  │     · normalizeKey() function
  │     · Boolean conversion logic
  │     · Decimal conversion logic
  │     · Required field checks
  │     · Default value assignment
  │   - processUpload(file) → orchestrates parse + validate + repository call
  │
  └→ Repository: componentRepository.ts
      - bulkUpsert(processedComponents) → storage.bulkUpsertComponents()
```

### 13.3 Mapping: Legacy Upload Handler → V2 Layers

| Legacy Code (routes.ts) | Lines | V2 Layer | V2 Method |
|--------------------------|-------|----------|-----------|
| `upload.single('file')` | 113 | Route middleware | multer stays on route definition |
| File existence check | 114-117 | Controller | `upload()` method |
| File extension detection | 120 | Upload Service | `parseFile()` |
| CSV parsing (PapaParse) | 126-134 | Upload Service | `parseFile()` |
| XLSX parsing | 135-150 | Upload Service | `parseFile()` |
| Field mapping dictionary | 157-245 | Upload Service | Class constant |
| `normalizeKey()` function | 249 | Upload Service | Private method |
| Column detection | 256-276 | Upload Service | `mapAndValidate()` |
| Row-by-row validation | 282-365 | Upload Service | `mapAndValidate()` |
| Boolean field conversion | 296-307 | Upload Service | `mapAndValidate()` |
| Decimal field conversion | 310-315 | Upload Service | `mapAndValidate()` |
| Required field checks | 322-357 | Upload Service | `mapAndValidate()` |
| Default assignment | 359-362 | Upload Service | `mapAndValidate()` |
| `storage.bulkUpsertComponents()` | 380 | Repository | `bulkUpsert()` |
| Response construction | 382-390 | Controller | `upload()` method |

### 13.4 Verification Strategy

To prove V2 upload produces identical results:

1. Take a test upload file (CSV and XLSX)
2. Upload via legacy endpoint → capture full response JSON
3. Upload same file via V2 endpoint → capture full response JSON
4. Compare:
   - `created` count must match
   - `updated` count must match
   - `failed` count must match
   - `errors` array must match (same row numbers, same messages)
   - `columnInfo.mapped` must match
   - `columnInfo.unmapped` must match
   - `preview` records must match
5. Query database → both should have produced identical rows

---

## 14. Risk Points & Rollback Strategy

### 14.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| V2 service logic diverges from legacy | High | Copy exact logic from routes.ts, not rewrite. Line-by-line comparison during review. |
| V2 upload produces different results | Medium | Side-by-side test with identical input files, compare JSON responses |
| V2 routes conflict with legacy routes | Low | V2 routes use `/v2/` namespace — no URL overlap possible |
| Toggle breaks existing UI | Low | Toggle defaults to "Legacy". V2 mode is opt-in only. |
| Storage method behavior changes | None | V2 calls same `storage.*` methods — no storage changes |
| Database integrity risk | None | Both flows use same database table via same storage methods |

### 14.2 Rollback Strategy

**Instant Rollback (Frontend):**
- Toggle switch → "Legacy Mode"
- All frontend queries immediately target legacy endpoints
- Same data, same database, zero downtime

**Server Rollback (If Needed):**
- Comment out `app.use('/technical/api/v2/components', v2Router)` in server startup
- V2 routes disappear, all traffic goes to legacy
- No database cleanup needed — same table was used throughout

**Complete Removal (If Abandoning V2):**
- Delete `server/v2/components/` directory
- Delete `shared/v2/components/` directory
- Delete `client/src/modules/components/` directory
- Remove V2 route registration from server startup
- Remove toggle from Components.tsx
- No database changes needed

### 14.3 Safe Migration Points

| Phase | Safe Rollback Point | What to Roll Back |
|-------|---------------------|-------------------|
| Phase 1 complete | Remove V2 route registration | Comment out `app.use('/technical/api/v2/components', v2Router)` |
| Phase 2 complete | Same as Phase 1 | Same — sub-entity routes are part of V2 router |
| Phase 3 complete | Same as Phase 1 | Upload service is only called by V2 routes |
| Phase 4 complete | Toggle to "Legacy" | Frontend reverts to legacy API calls |

---

## 15. Validation Checklist

### 15.1 Same Inputs

- [ ] V2 `POST /component` accepts same JSON body as legacy `POST /technical/api/components`
- [ ] V2 `PATCH /component/:id` accepts same JSON body as legacy `PATCH /technical/api/components/:id`
- [ ] V2 `POST /component/upload` accepts same file types (CSV, XLS, XLSX) as legacy
- [ ] V2 `POST /component/:id/inactivate` accepts same body as legacy
- [ ] V2 sub-entity routes accept same bodies as legacy

### 15.2 Same Logic

- [ ] RH MASTER validation: reject if `rhMasterComponentId` provided → same error
- [ ] RH INHERITED validation: require `rhMasterComponentId`, validate same vessel, validate MASTER type → same errors
- [ ] RH NOT_RH_DRIVEN validation: reject if `rhMasterComponentId` provided → same error
- [ ] RH self-reference prevention: reject if master = self → same error
- [ ] RH downgrade protection: reject if MASTER has dependents → same error with dependent names
- [ ] RH cascade update: `setComponentRunningHours()` called with same params
- [ ] Upload field mapping: 89-entry dictionary produces same column mappings
- [ ] Upload boolean conversion: "yes", "true", "1" → true; others → false
- [ ] Upload decimal conversion: parseFloat with NaN check
- [ ] Upload required fields: id, name, componentCategory, vesselCode
- [ ] Upload defaults: currentCumulativeRH='0', critical=false, classItem=false
- [ ] Inactivation Option A (block): same 400 response when children are active
- [ ] Inactivation Option B (cascade): same cascade behavior

### 15.3 Same Outputs

- [ ] GET list: returns identical `Component[]` array
- [ ] GET by ID: returns identical `Component` object (or 404)
- [ ] POST create: returns identical `Component` with 201 status
- [ ] PATCH update: returns identical `Component` after RH cascade
- [ ] DELETE: returns `{ success: true }`
- [ ] Upload: returns identical `{ success, created, updated, failed, errors, preview, columnInfo }`
- [ ] Inactivate: returns identical result object
- [ ] All error responses: same HTTP status codes, same error message strings

### 15.4 Architecture Compliance

- [ ] No legacy files modified (until Phase 4 toggle integration)
- [ ] All V2 code in new files under `server/v2/`, `shared/v2/`, `client/src/modules/`
- [ ] Repository is the only layer importing `storage`
- [ ] Service has no HTTP object imports
- [ ] Controller has no storage/Drizzle imports
- [ ] No JSON columns introduced
- [ ] No cross-module coupling
- [ ] Nginx prefix `/technical/api/` respected on all V2 routes
- [ ] All V2 routes under `/technical/api/v2/components/...`
