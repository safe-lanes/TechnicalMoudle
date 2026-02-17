# V2 Modular Architecture Plan — Fleet Module (All Fleet Entities)

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) Fleet module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: All Fleet-specific entities — Fleet Components, Fleet Jobs, Fleet Spares, Makers, Master Lists, Fleet Vessel Mappings, Fleet Component Mappings, Fleet Job Vessel Mappings, Fleet Spare Vessel Mappings, Fleet Registry, Dashboard Metrics, Copy Vessel, and all associated Bulk Upload operations.

**Critical Constraint**: The V2 architecture must use 100% the same business rules, validations, calculations, and workflows as legacy. This initiative is purely an architectural re-organization, not a functional rewrite.

**Companion Document**: This plan follows the exact same conventions established in `V2-Component-Module-Refactor-Plan.md` (Component Module V2). Both plans share identical layer rules, toggle mechanism, and enforcement policies.

---

## Canonical V2 API Prefix

All V2 fleet endpoints use these canonical base paths:

```
/technical/api/v2/fleet/component          ← Fleet Components entity
/technical/api/v2/fleet/job                ← Fleet Jobs entity
/technical/api/v2/fleet/spare              ← Fleet Spares entity
/technical/api/v2/fleet/maker              ← Makers entity
/technical/api/v2/fleet/master-list        ← Master Lists entity
/technical/api/v2/fleet/vessel-mapping     ← Fleet Vessel Mappings entity
/technical/api/v2/fleet/component-mapping  ← Fleet Component Mappings entity
/technical/api/v2/fleet/job-mapping        ← Fleet Job Vessel Mappings entity
/technical/api/v2/fleet/spare-mapping      ← Fleet Spare Vessel Mappings entity
/technical/api/v2/fleet/registry           ← Fleet Registry (CRUD for fleet groups)
/technical/api/v2/fleet/dashboard          ← Dashboard Metrics & Stats
/technical/api/v2/fleet/master-data        ← Master Data (SFI codes, etc.)
/technical/api/v2/fleet/import-history     ← Bulk Import History & Errors
/technical/api/v2/fleet/copy-vessel        ← Copy Vessel operation
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/fleet/` — module name
- `/{entity}` — entity name (singular for REST convention)

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
13. [Fleet Bulk Upload Refactor Plan](#13-fleet-bulk-upload-refactor-plan)
14. [Risk Points & Rollback Strategy](#14-risk-points--rollback-strategy)
15. [Validation Checklist](#15-validation-checklist)

---

## 1. Current State Analysis

### 1.1 Backend File Sizes & Responsibility Mapping

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `server/routes.ts` | 19,499 | ALL route handlers including fleet routes (L10739–L11538) | Monolithic — fleet routes mixed with every other module |
| `server/routes/fleetAdmin.ts` | 1,155 | Fleet Admin sub-router (master data, fleet components, mappings, import history, dashboard, copy vessel) | Separate file but still monolithic internally |
| `server/postgresStorage.ts` | 7,111+ | ALL database queries including fleet storage methods | Monolithic — fleet queries mixed with every other query |
| `server/storage.ts` | 933 | Storage interface definition | 50+ fleet-specific methods in a single interface |
| `shared/schema.ts` | 2,610+ | ALL Drizzle schema definitions | All fleet tables defined alongside all other tables |
| `client/src/pages/admin/FleetDataView.tsx` | 4,248 | Main Fleet Data UI page (tree view + detail panels) | Inline API calls via `useQuery`, no API abstraction layer |
| `client/src/pages/admin/FleetComponentsManagement.tsx` | 47,820 chars | Fleet Components AG Grid management | Inline API calls |
| `client/src/pages/admin/FleetJobsManagement.tsx` | 80,862 chars | Fleet Jobs AG Grid management | Inline API calls |
| `client/src/pages/admin/FleetSparesManagement.tsx` | 47,757 chars | Fleet Spares AG Grid management | Inline API calls |
| `client/src/pages/admin/AddEditFleetComponent.tsx` | 28,684 chars | Fleet Component add/edit form | Inline API calls |
| `client/src/pages/admin/FleetEquipmentTreeView.tsx` | 18,123 chars | Fleet equipment tree view component | Inline API calls |
| `client/src/pages/admin/FleetVesselMapping.tsx` | 106,720 chars | Fleet vessel mapping management | Inline API calls |
| `client/src/pages/admin/FleetVesselManager.tsx` | 45,172 chars | Fleet vessel manager | Inline API calls |
| `client/src/pages/admin/MakerManagement.tsx` | varies | Maker management AG Grid | Inline API calls |

### 1.2 Fleet Route Inventory (Legacy)

#### 1.2.1 Fleet Components — routes.ts (L10739–L10848)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 10742 | GET | `/technical/api/fleet/components` | List all fleet components | `storage.getFleetScopedComponents()` |
| 10753 | GET | `/technical/api/fleet/components/:id` | Get fleet component by ID | `storage.getFleetScopedComponent(id)` |
| 10767 | POST | `/technical/api/fleet/components` | Create fleet component | `storage.createFleetScopedComponent(data)` |
| 10785 | PATCH | `/technical/api/fleet/components/:id` | Update fleet component | `storage.updateFleetScopedComponent(id, data)` |
| 10807 | DELETE | `/technical/api/fleet/components/:id` | Delete fleet component | `storage.deleteFleetScopedComponent(id)` |
| 10824 | POST | `/technical/api/fleet/components/sort-order` | Update sort order (batch) | `getPool()` + raw SQL |

#### 1.2.2 Fleet Jobs — routes.ts (L10850–L11046)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 10853 | GET | `/technical/api/fleet/jobs/export` | Export fleet jobs to Excel | `storage.getFleetJobs()` + XLSX |
| 10911 | GET | `/technical/api/fleet/jobs` | List all fleet jobs | `storage.getFleetJobs()` |
| 10922 | GET | `/technical/api/fleet/jobs/:id` | Get fleet job by ID | `storage.getFleetJob(id)` |
| 10936 | POST | `/technical/api/fleet/jobs` | Create fleet job | `storage.createFleetJob(data)` |
| 10954 | PATCH | `/technical/api/fleet/jobs/:id` | Update fleet job (with field sanitization) | `storage.updateFleetJob(id, data)` |
| 11032 | DELETE | `/technical/api/fleet/jobs/:id` | Delete fleet job | `storage.deleteFleetJob(id)` |

#### 1.2.3 Fleet Spares — routes.ts (L11048–L11175)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 11051 | GET | `/technical/api/fleet/spares/export` | Export fleet spares to Excel | `storage.getFleetSparesFromTable()` + XLSX |
| 11105 | GET | `/technical/api/fleet/spares` | List all fleet spares | `storage.getFleetSparesFromTable()` |
| 11116 | GET | `/technical/api/fleet/spares/:id` | Get fleet spare by ID | `storage.getFleetSpareFromTable(id)` |
| 11130 | POST | `/technical/api/fleet/spares` | Create fleet spare | `storage.createFleetSpareInTable(data)` |
| 11145 | PATCH | `/technical/api/fleet/spares/:id` | Update fleet spare | `storage.updateFleetSpareInTable(id, data)` |
| 11164 | DELETE | `/technical/api/fleet/spares/:id` | Delete fleet spare | `storage.deleteFleetSpareFromTable(id)` |

#### 1.2.4 Makers — routes.ts (L11177–L11273)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 11180 | GET | `/technical/api/fleet/makers` | List makers (with optional search) | `storage.getMakers(search)` |
| 11192 | GET | `/technical/api/fleet/makers/:id` | Get maker by ID | `storage.getMakerById(id)` |
| 11206 | POST | `/technical/api/fleet/makers` | Create maker (auto-generate makerCode) | `storage.createMaker(data)` |
| 11237 | PUT | `/technical/api/fleet/makers/:id` | Update maker | `storage.updateMaker(id, data)` |
| 11262 | DELETE | `/technical/api/fleet/makers/:id` | Delete maker | `storage.deleteMaker(id)` |

#### 1.2.5 Master Lists — routes.ts (L11275–L11349)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 11278 | GET | `/technical/api/fleet/master-lists` | List master lists (with optional listType) | `storage.getMasterLists(listType)` |
| 11290 | GET | `/technical/api/fleet/master-lists/:id` | Get master list by ID | `storage.getMasterListById(id)` |
| 11304 | POST | `/technical/api/fleet/master-lists` | Create master list | `storage.createMasterList(data)` |
| 11319 | PUT | `/technical/api/fleet/master-lists/:id` | Update master list | `storage.updateMasterList(id, data)` |
| 11338 | DELETE | `/technical/api/fleet/master-lists/:id` | Delete master list | `storage.deleteMasterList(id)` |

#### 1.2.6 Fleet Vessel Mappings — routes.ts (L11351–L11400)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 11356 | GET | `/technical/api/fleet/vessel-mappings` | List all vessel mappings | `storage.getFleetVesselMappings()` |
| 11367 | POST | `/technical/api/fleet/vessel-mappings` | Create vessel mappings (batch) | `storage.createFleetVesselMappings(data)` |
| 11392 | DELETE | `/technical/api/fleet/vessel-mappings/:id` | Delete vessel mapping | `storage.deleteFleetVesselMapping(id)` |

#### 1.2.7 Fleet Registry — routes.ts (L11402–L11538)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 11407 | GET | `/technical/api/fleets` | List fleets (active or all) | `storage.getFleets()` / `storage.getAllFleets()` |
| 11421 | GET | `/technical/api/fleets/:id` | Get fleet by ID | `storage.getFleetById(id)` |
| 11435 | POST | `/technical/api/fleets` | Create fleet | `storage.createFleet(data)` |
| 11462 | PUT | `/technical/api/fleets/:id` | Update fleet | `storage.updateFleet(id, data)` |
| 11487 | DELETE | `/technical/api/fleets/:id` | Delete fleet | `storage.deleteFleet(id)` |
| 11504 | GET | `/technical/api/fleets/:id/vessels` | Get vessels by fleet | `storage.getVesselsByFleet(id)` |
| 11515 | PUT | `/technical/api/vessels/:id/fleet` | Assign vessel to fleet | `storage.assignVesselToFleet(id, fleetId)` |
| 11530 | GET | `/technical/api/vessels-with-fleets` | Get vessels with fleet info | `storage.getVesselsWithFleets()` |

#### 1.2.8 Fleet Admin Sub-Router — server/routes/fleetAdmin.ts (1,155 lines)

| Line | Method | Path (under `/technical/api/fleet-admin/`) | Purpose | Storage Method |
|------|--------|---------------------------------------------|---------|----------------|
| 33 | GET | `master-data` | List master data (with pagination) | `storage.getMasterDataPaginated()` |
| 64 | GET | `master-data/:id` | Get master data by ID | `storage.getMasterDataById(id)` |
| 81 | GET | `master-data/by-code/:code` | Get master data by fleet code | `storage.getMasterDataByFleetCode(code)` |
| 104 | POST | `master-data` | Create master data | `storage.createMasterData(data)` |
| 147 | PATCH | `master-data/:id` | Update master data | `storage.updateMasterData(id, data)` |
| 165 | DELETE | `master-data/:id` | Delete master data | `storage.deleteMasterData(id)` |
| 183 | GET | `generate-fleet-equipment-code/:sfiCode` | Generate fleet equipment code | `storage.generateFleetEquipmentCode(sfiCode)` |
| 202 | GET | `fleet-components` | List fleet components (dedicated table) | `storage.getFleetComponents()` |
| 233 | GET | `fleet-components/export` | Export fleet components to Excel | `storage.getFleetComponents()` + XLSX |
| 281 | GET | `fleet-components/:id` | Get fleet component by ID | `storage.getFleetComponent(id)` |
| 298 | GET | `fleet-components/by-code/:code` | Get fleet component by code | `storage.getFleetComponentByCode(code)` |
| 315 | POST | `fleet-components` | Create fleet component | `storage.createFleetComponent(data)` |
| 336 | PATCH | `fleet-components/:id` | Update fleet component | `storage.updateFleetComponent(id, data)` |
| 354 | DELETE | `fleet-components/:id` | Delete fleet component | `storage.deleteFleetComponent(id)` |
| 376 | GET | `fleet-vessel-mappings` | List fleet vessel mappings (with filter) | `storage.getFleetVesselMappings(code)` |
| 400 | GET | `fleet-vessel-mappings/by-equipment/:code` | Get mappings by equipment code | `storage.getFleetVesselMappings(code)` |
| 412 | GET | `fleet-vessel-mappings/by-vessel/:vesselCode` | Get mappings by vessel | `storage.getFleetVesselMappingsByVessel(code)` |
| 424 | POST | `fleet-vessel-mappings` | Create fleet vessel mapping | `storage.createFleetVesselMappingRecord(data)` |
| 439 | DELETE | `fleet-vessel-mappings/:id` | Delete fleet vessel mapping | `storage.removeFleetVesselMappingRecord(code, vessel)` |
| 455 | GET | `component-vessel-mappings` | List component vessel mappings | `storage.getComponentVesselMappings(filter)` |
| 474 | POST | `component-vessel-mappings` | Create component vessel mapping | `storage.createComponentVesselMapping(data)` |
| 489 | DELETE | `component-vessel-mappings/:id` | Delete component vessel mapping | `storage.deleteComponentVesselMapping(id)` |
| 505 | GET | `fleet-component-mappings` | List fleet component mappings | `storage.getFleetComponentMappings(code)` |
| 535 | GET | `fleet-component-mappings/by-equipment/:code` | Get by equipment code | `storage.getFleetComponentMappings(code)` |
| 547 | GET | `fleet-component-mappings/by-vessel/:vesselCode` | Get by vessel | `storage.getFleetComponentMappingsByVessel(code)` |
| 559 | POST | `fleet-component-mappings` | Create fleet component mapping | `storage.createFleetComponentMappingRecord(data)` |
| 574 | DELETE | `fleet-component-mappings` | Delete fleet component mapping | `storage.removeFleetComponentMappingRecord(...)` |
| 601 | GET | `fleet-job-mappings` | List fleet job mappings | `storage.getFleetJobVesselMappings(code, job)` |
| 622 | GET | `fleet-job-mappings/by-job/:jobCode` | Get by job code | `storage.getFleetJobVesselMappings(null, code)` |
| 634 | GET | `fleet-job-mappings/by-vessel/:vesselCode` | Get by vessel | custom filter |
| 647 | POST | `fleet-job-mappings` | Create fleet job mapping | `storage.createFleetJobVesselMappingRecord(data)` |
| 662 | DELETE | `fleet-job-mappings` | Delete fleet job mapping | `storage.removeFleetJobVesselMappingRecord(...)` |
| 688 | GET | `fleet-spare-mappings` | List fleet spare mappings | `storage.getFleetSpareVesselMappings(code, part)` |
| 709 | GET | `fleet-spare-mappings/by-spare/:partCode` | Get by spare code | `storage.getFleetSpareVesselMappings(null, code)` |
| 721 | GET | `fleet-spare-mappings/by-vessel/:vesselCode` | Get by vessel | custom filter |
| 734 | POST | `fleet-spare-mappings` | Create fleet spare mapping | `storage.createFleetSpareVesselMappingRecord(data)` |
| 749 | DELETE | `fleet-spare-mappings` | Delete fleet spare mapping | `storage.removeFleetSpareVesselMappingRecord(...)` |
| 775 | GET | `import-history` | List import history (with pagination/filter) | `storage.getImportHistory(filter)` |
| 810 | GET | `import-history/:id` | Get import history by ID | `storage.getImportHistoryById(id)` |
| 827 | GET | `import-history/:id/errors` | Get import errors | `storage.getImportErrors(id)` |
| 839 | POST | `import-history` | Create import history record | `storage.createImportHistory(data)` |
| 854 | PATCH | `import-history/:id` | Update import history | `storage.updateImportHistory(id, data)` |
| 866 | POST | `import-errors` | Create import errors (batch) | `storage.createImportErrors(errors)` |
| 892 | GET | `dashboard-metrics` | Get fleet admin dashboard metrics | `storage.getFleetAdminMetrics()` |
| 902 | GET | `dashboard-stats` | Get fleet admin dashboard statistics | Various storage queries |
| 1040 | POST | `copy-vessel` | Copy vessel data from one vessel to another | Complex multi-table copy |

**Total Legacy Fleet Routes: 78 route handlers** (39 in routes.ts + 39 in fleetAdmin.ts)

### 1.3 Storage Interface Methods (Fleet-Related)

From `server/storage.ts`, the fleet-related interface methods (~50+ methods):

**Fleet Components (Dedicated `fleet_components` Table):**
| Method | Returns | Used By |
|--------|---------|---------|
| `getFleetComponents()` | `FleetComponents[]` | fleetAdmin.ts L202 |
| `getFleetComponent(id)` | `FleetComponents \| undefined` | fleetAdmin.ts L281 |
| `getFleetComponentByCode(code)` | `FleetComponents \| undefined` | fleetAdmin.ts L298 |
| `createFleetComponent(data)` | `FleetComponents` | fleetAdmin.ts L315 |
| `updateFleetComponent(id, data)` | `FleetComponents` | fleetAdmin.ts L336 |
| `deleteFleetComponent(id)` | `void` | fleetAdmin.ts L354 |

**Fleet Components (Legacy — Components Table with dataScope='fleet'):**
| Method | Returns | Used By |
|--------|---------|---------|
| `getFleetScopedComponents()` | `Component[]` | routes.ts L10742 |
| `getFleetScopedComponent(id)` | `Component \| undefined` | routes.ts L10753 |
| `createFleetScopedComponent(data)` | `Component` | routes.ts L10767 |
| `updateFleetScopedComponent(id, data)` | `Component` | routes.ts L10785 |
| `deleteFleetScopedComponent(id)` | `void` | routes.ts L10807 |

**Fleet Jobs:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getFleetJobs()` | `FleetJobs[]` | routes.ts L10911 |
| `getFleetJob(id)` | `FleetJobs \| undefined` | routes.ts L10922 |
| `getFleetJobByCode(code)` | `FleetJobs \| undefined` | Various |
| `createFleetJob(data)` | `FleetJobs` | routes.ts L10936 |
| `updateFleetJob(id, data)` | `{ updatedJob, affectedCount }` | routes.ts L10954 |
| `deleteFleetJob(id)` | `void` | routes.ts L11032 |

**Fleet Spares:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getFleetSparesFromTable()` | `FleetSpares[]` | routes.ts L11105 |
| `getFleetSpareFromTable(id)` | `FleetSpares \| undefined` | routes.ts L11116 |
| `getFleetSpareByPartCode(code)` | `FleetSpares \| undefined` | Various |
| `createFleetSpareInTable(data)` | `FleetSpares` | routes.ts L11130 |
| `updateFleetSpareInTable(id, data)` | `FleetSpares` | routes.ts L11145 |
| `deleteFleetSpareFromTable(id)` | `void` | routes.ts L11164 |

**Makers:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getMakers(search?)` | `MakerList[]` | routes.ts L11180 |
| `getMakerById(id)` | `MakerList \| undefined` | routes.ts L11192 |
| `createMaker(data)` | `MakerList` | routes.ts L11206 |
| `updateMaker(id, data)` | `MakerList` | routes.ts L11237 |
| `deleteMaker(id)` | `void` | routes.ts L11262 |

**Fleet Vessel Mappings (multiple mapping tables):**
| Method | Returns | Used By |
|--------|---------|---------|
| `getFleetVesselMappings(code?)` | `FleetVesselMapping[]` | fleetAdmin.ts L376 |
| `getFleetVesselMappingsByVessel(code)` | `FleetVesselMapping[]` | fleetAdmin.ts L412 |
| `createFleetVesselMappingRecord(data)` | `FleetVesselMapping` | fleetAdmin.ts L424 |
| `removeFleetVesselMappingRecord(code, vessel)` | `void` | fleetAdmin.ts L439 |
| `getFleetComponentMappings(code?)` | `FleetComponentMapping[]` | fleetAdmin.ts L505 |
| `getFleetComponentMappingsByVessel(code?)` | `FleetComponentMapping[]` | fleetAdmin.ts L547 |
| `createFleetComponentMappingRecord(data)` | `FleetComponentMapping` | fleetAdmin.ts L559 |
| `removeFleetComponentMappingRecord(...)` | `void` | fleetAdmin.ts L574 |
| `getFleetJobVesselMappings(code?, job?)` | `FleetJobVesselMapping[]` | fleetAdmin.ts L601 |
| `createFleetJobVesselMappingRecord(data)` | `FleetJobVesselMapping` | fleetAdmin.ts L647 |
| `removeFleetJobVesselMappingRecord(...)` | `void` | fleetAdmin.ts L662 |
| `getFleetSpareVesselMappings(code?, part?)` | `FleetSpareVesselMapping[]` | fleetAdmin.ts L688 |
| `createFleetSpareVesselMappingRecord(data)` | `FleetSpareVesselMapping` | fleetAdmin.ts L734 |
| `removeFleetSpareVesselMappingRecord(...)` | `void` | fleetAdmin.ts L749 |

**Fleet Registry:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getAllFleets()` | `Fleet[]` | routes.ts L11411 |
| `getFleets()` | `Fleet[]` | routes.ts L11412 |
| `getFleetById(id)` | `Fleet \| undefined` | routes.ts L11421 |
| `createFleet(data)` | `Fleet` | routes.ts L11435 |
| `updateFleet(id, data)` | `Fleet` | routes.ts L11462 |
| `deleteFleet(id)` | `void` | routes.ts L11487 |
| `getVesselsByFleet(id)` | `Vessel[]` | routes.ts L11504 |
| `assignVesselToFleet(id, fleetId)` | `Vessel` | routes.ts L11515 |
| `getVesselsWithFleets()` | `Array<Vessel & fleet info>` | routes.ts L11530 |

**Dashboard & Import History:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getFleetAdminMetrics()` | Metrics object | fleetAdmin.ts L892 |
| `getImportHistory(filter)` | Import history records | fleetAdmin.ts L775 |
| `getImportHistoryById(id)` | Single import record | fleetAdmin.ts L810 |
| `getImportErrors(id)` | Import error records | fleetAdmin.ts L827 |
| `createImportHistory(data)` | Import history record | fleetAdmin.ts L839 |
| `updateImportHistory(id, data)` | Import history record | fleetAdmin.ts L854 |
| `createImportErrors(errors)` | Import error records | fleetAdmin.ts L866 |

### 1.4 Current Schema (Fleet Tables)

From `shared/schema.ts`:

**`fleet_components` Table (L1792):** 26 columns
- Core: `id` (integer PK, auto-gen), `fleetComponentsUuid` (text, UUID default)
- Hierarchy: `parentFleetEquipmentCode` (text), `fleetEquipmentCode` (text, unique, NOT NULL)
- Data: `fleetEquipmentName`, `componentCategory`, `makerName`, `makerCode`, `model`, `modelCode`, `location`, `rating`, `eqptSystemDept`, `notes`
- Status: `isActive` (boolean, default true)
- Ordering: `sortOrder` (integer, default 0)
- Fleet Schema Contract: `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, `isSync`

**`fleet_jobs` Table (L1837):** 25 columns
- Core: `id` (integer PK, auto-gen), `fleetJobsUuid` (text, UUID default)
- Linking: `fleetComponentsUuid` (text FK → fleet_components), `fleetEquipmentCode` (text), `fleetEquipmentName` (text)
- Job Data: `jobCode`, `woTitle`, `maintenanceBasis`, `intervalValue`, `unit`, `taskType`, `assignedTo`, `approver`, `jobPriority`, `classRelated`, `briefWorkDescription`, `department`, `criticality`
- Safety: `requiredSpareParts` (json), `requiredTools` (json), `ppeRequirements`, `permitRequirements`, `otherSafetyRequirements`
- Status: `isActive` (boolean, default true)
- Ordering: `sortOrder` (integer, default 0)
- Fleet Schema Contract: `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, `isSync`

**`fleet_spares` Table (L1891):** 22 columns
- Core: `id` (integer PK, auto-gen), `fleetSparesUuid` (text, UUID default)
- Linking: `fleetComponentsUuid` (text FK → fleet_components), `fleetEquipmentCode` (text), `fleetEquipmentName` (text)
- Spare Data: `partCode`, `partName`, `partNumber`, `unitOfMeasurement`, `drawingNumber`, `positionNumber`, `note`, `specification`, `maker`, `makerCode`, `manualName`, `pageNumber`, `criticality`
- IHM: `ihm`, `evidenceType`
- Status: `isActive` (boolean, default true)
- Ordering: `sortOrder` (integer, default 0)
- Fleet Schema Contract: `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, `isSync`

**`maker_list` Table (L1743):** Maker master data with `sortOrder`, Fleet Schema Contract columns
**`master_lists` Table:** General master list data with configurable list types

**Mapping Tables:**
- `fleet_vessel_mapping` — Links fleet equipment codes to vessels
- `fleet_component_mapping` — Links fleet equipment to vessel-specific components
- `fleet_job_vessel_mapping` — Links fleet jobs to vessels (composite unique: jobCode + vesselCode)
- `fleet_spare_vessel_mapping` — Links fleet spares to vessels (composite unique: partCode + vesselCode)

**`fleets` Table (L39):** Fleet registry (id, code, name, description, isActive)

### 1.5 Key Business Logic in Route Handlers

The fleet module has **less complex inline business logic** compared to the Component module (no RH cascade, no counter type validation). However, these important patterns exist:

**Fleet Job Update Sanitization (routes.ts L10954–L11028):**
1. Field-type validation: STRING_FIELDS, JSON_FIELDS, BOOLEAN_FIELDS enforced by type
2. NOT NULL field protection: Required string fields (woTitle, jobCode, taskType, etc.) reject empty strings
3. Returns `{ ...updatedJob, affectedCount }` — includes cascade count

**Maker Code Auto-Generation (routes.ts L11206–L11233):**
1. If `makerCode` not provided or empty, auto-generates `MKR-XXXXXX` format
2. Scans existing makers for highest `MKR-` prefix number
3. Prevents clearing makerCode on update (L11243–11244)

**Fleet Sort Order (routes.ts L10824–L10848):**
1. Batch update using raw SQL via `getPool()`
2. Updates `sort_order` and `updated_at` columns

**Fleet Component Delete Guard (routes.ts L10815):**
1. Blocks deletion if component has child components

**Fleet Creation Validation (routes.ts L11439–L11441):**
1. Fleet code and name required
2. Uses code as id if id not provided
3. Conflict detection for duplicate codes (409 status)

**Copy Vessel (fleetAdmin.ts L1040+):**
1. Complex multi-table copy operation
2. Copies fleet components, jobs, spares, and mappings from source to target vessel

**Dashboard Stats (fleetAdmin.ts L902+):**
1. Aggregates multiple storage queries into dashboard statistics
2. Computes counts for components, jobs, spares, vessels, mappings

### 1.6 Frontend API Consumption (Current)

**FleetDataView.tsx (4,248 lines)** — Main Fleet Data page:
| Query Key | Purpose |
|-----------|---------|
| `/technical/api/fleet-admin/fleet-components` | Fetch all fleet components for tree view |
| `/technical/api/fleet/jobs` | Fetch all fleet jobs |
| `/technical/api/fleet/spares` | Fetch all fleet spares |
| `/technical/api/fleet/makers` | Fetch all makers |
| `/technical/api/fleet-admin/component-vessel-mappings` | Fetch component-vessel mappings |
| POST `/technical/api/fleet/components/sort-order` | Save drag-drop sort order |
| POST `/technical/api/fleet/jobs` | Create fleet job |
| PATCH `/technical/api/fleet/jobs/:id` | Update fleet job |

**FleetComponentsManagement.tsx** — AG Grid management:
| Query Key | Purpose |
|-----------|---------|
| `/technical/api/fleet-admin/fleet-components` | List fleet components |
| `/technical/api/fleet/makers` | Fetch makers for dropdown |
| POST `/technical/api/fleet-admin/fleet-components` | Create fleet component |
| PATCH `/technical/api/fleet-admin/fleet-components/:id` | Update fleet component |
| DELETE `/technical/api/fleet-admin/fleet-components/:id` | Delete fleet component |
| GET `/technical/api/fleet-admin/fleet-components/export` | Export to Excel |

**FleetJobsManagement.tsx** — AG Grid management:
| Query Key | Purpose |
|-----------|---------|
| `/technical/api/fleet/jobs` | List fleet jobs |
| `/technical/api/fleet-admin/fleet-components` | Components for linking |
| POST `/technical/api/fleet/jobs` | Create fleet job |
| PATCH `/technical/api/fleet/jobs/:id` | Update fleet job |
| DELETE `/technical/api/fleet/jobs/:id` | Delete fleet job |
| GET `/technical/api/fleet/jobs/export` | Export to Excel |

**FleetSparesManagement.tsx** — AG Grid management:
| Query Key | Purpose |
|-----------|---------|
| `/technical/api/fleet/spares` | List fleet spares |
| `/technical/api/fleet-admin/fleet-components` | Components for linking |
| `/technical/api/fleet/makers` | Makers for dropdown |
| POST `/technical/api/fleet/spares` | Create fleet spare |
| PATCH `/technical/api/fleet/spares/:id` | Update fleet spare |
| DELETE `/technical/api/fleet/spares/:id` | Delete fleet spare |
| GET `/technical/api/fleet/spares/export` | Export to Excel |

**Pattern**: No API abstraction layer. All `useQuery` calls use inline `queryKey` arrays with direct URL strings. `apiRequest()` helper used for mutations.

**Key Observation — Dual Route Paths**: Fleet components are accessed through TWO different route prefixes:
1. `/technical/api/fleet/components/*` — Uses `storage.getFleetScopedComponents()` (queries `components` table with `dataScope='fleet'`)
2. `/technical/api/fleet-admin/fleet-components/*` — Uses `storage.getFleetComponents()` (queries dedicated `fleet_components` table)

The V2 architecture should consolidate these into a single clear path per entity.

---

## 2. V2 Folder Structure

### 2.1 Backend (Fleet Module)

```
server/v2/
└── fleet/
    ├── index.ts                              ← Module entry: exports all fleet sub-routers
    ├── routes.ts                             ← Express router combining all fleet entity routes
    ├── errors.ts                             ← Shared error types (NotFoundError, ValidationError)
    ├── controllers/
    │   ├── index.ts                          ← Re-exports all controllers
    │   ├── fleetComponentController.ts       ← HTTP handlers for fleet component CRUD + sort-order
    │   ├── fleetJobController.ts             ← HTTP handlers for fleet job CRUD + export
    │   ├── fleetSpareController.ts           ← HTTP handlers for fleet spare CRUD + export
    │   ├── makerController.ts                ← HTTP handlers for maker CRUD
    │   ├── masterListController.ts           ← HTTP handlers for master list CRUD
    │   ├── fleetMappingController.ts         ← HTTP handlers for ALL mapping operations
    │   ├── fleetRegistryController.ts        ← HTTP handlers for fleet registry CRUD
    │   ├── fleetDashboardController.ts       ← HTTP handlers for dashboard metrics/stats
    │   ├── masterDataController.ts           ← HTTP handlers for master data (SFI codes)
    │   ├── importHistoryController.ts        ← HTTP handlers for import history/errors
    │   ├── copyVesselController.ts           ← HTTP handler for copy vessel operation
    │   └── fleetUploadController.ts          ← HTTP handlers for bulk uploads (components, jobs, spares)
    ├── services/
    │   ├── index.ts                          ← Re-exports all services
    │   ├── fleetComponentService.ts          ← Business logic: component CRUD, sort-order, delete guard
    │   ├── fleetJobService.ts                ← Business logic: job CRUD, field sanitization, export
    │   ├── fleetSpareService.ts              ← Business logic: spare CRUD, export
    │   ├── makerService.ts                   ← Business logic: maker CRUD, auto-code generation
    │   ├── masterListService.ts              ← Business logic: master list CRUD
    │   ├── fleetMappingService.ts            ← Business logic: ALL mapping operations
    │   ├── fleetRegistryService.ts           ← Business logic: fleet registry, vessel assignment
    │   ├── fleetDashboardService.ts          ← Business logic: dashboard aggregation
    │   ├── masterDataService.ts              ← Business logic: master data, code generation
    │   ├── importHistoryService.ts           ← Business logic: import history/errors
    │   ├── copyVesselService.ts              ← Business logic: multi-table vessel copy
    │   └── fleetUploadService.ts             ← File parsing, field mapping, validation for fleet uploads
    └── repositories/
        ├── index.ts                          ← Re-exports all repositories
        ├── fleetComponentRepository.ts       ← Database access: fleet_components table
        ├── fleetJobRepository.ts             ← Database access: fleet_jobs table
        ├── fleetSpareRepository.ts           ← Database access: fleet_spares table
        ├── makerRepository.ts                ← Database access: maker_list table
        ├── masterListRepository.ts           ← Database access: master_lists table
        ├── fleetMappingRepository.ts         ← Database access: ALL mapping tables
        ├── fleetRegistryRepository.ts        ← Database access: fleets + vessels tables
        ├── masterDataRepository.ts           ← Database access: master_data + sfi_details tables
        └── importHistoryRepository.ts        ← Database access: import_history + import_errors tables
```

### 2.2 Shared Schema & Types

```
shared/v2/
└── fleet/
    ├── schema.ts                             ← Re-exports fleet schemas from shared/schema.ts (no duplication)
    └── types.ts                              ← V2-specific request/response types, Zod schemas for all fleet entities
```

### 2.3 Frontend (Fleet Module)

```
client/src/modules/
└── fleet/
    ├── api/
    │   ├── fleetComponentApiV2.ts            ← V2 API functions for fleet components
    │   ├── fleetJobApiV2.ts                  ← V2 API functions for fleet jobs
    │   ├── fleetSpareApiV2.ts                ← V2 API functions for fleet spares
    │   ├── makerApiV2.ts                     ← V2 API functions for makers
    │   ├── fleetMappingApiV2.ts              ← V2 API functions for mappings
    │   ├── fleetRegistryApiV2.ts             ← V2 API functions for fleet registry
    │   └── fleetAdminApiV2.ts                ← V2 API functions for dashboard, master data, import history
    ├── hooks/
    │   ├── useFleetComponentsV2.ts           ← V2 query hooks for fleet components
    │   ├── useFleetJobsV2.ts                 ← V2 query hooks for fleet jobs
    │   ├── useFleetSparesV2.ts               ← V2 query hooks for fleet spares
    │   ├── useMakersV2.ts                    ← V2 query hooks for makers
    │   ├── useFleetMappingsV2.ts             ← V2 query hooks for mappings
    │   └── useFleetRegistryV2.ts             ← V2 query hooks for fleet registry
    └── components/
        └── FleetApiToggle.tsx                ← Toggle UI component (V2 / Legacy switch)
```

### 2.4 Mapping: Current File → V2 Target Layer

| Current Location | Lines | V2 Target | V2 File |
|------------------|-------|-----------|---------|
| `routes.ts` L10742-10748 (GET fleet components) | 7 | Controller | `fleetComponentController.ts` |
| `routes.ts` L10753-10763 (GET fleet component by ID) | 11 | Controller | `fleetComponentController.ts` |
| `routes.ts` L10767-10781 (POST fleet component) | 15 | Controller | `fleetComponentController.ts` |
| `routes.ts` L10785-10803 (PATCH fleet component) | 19 | Controller | `fleetComponentController.ts` |
| `routes.ts` L10807-10821 (DELETE fleet component) | 15 | Controller + Service (delete guard) | `fleetComponentController.ts` + `fleetComponentService.ts` |
| `routes.ts` L10824-10848 (POST sort-order) | 25 | Controller + Service | `fleetComponentController.ts` + `fleetComponentService.ts` |
| `routes.ts` L10853-10908 (GET fleet jobs export) | 56 | Controller + Service (Excel generation) | `fleetJobController.ts` + `fleetJobService.ts` |
| `routes.ts` L10911-10918 (GET fleet jobs) | 8 | Controller | `fleetJobController.ts` |
| `routes.ts` L10936-10950 (POST fleet job) | 15 | Controller | `fleetJobController.ts` |
| `routes.ts` L10954-11028 (PATCH fleet job — sanitization) | 75 | Controller + Service (field sanitization) | `fleetJobController.ts` + `fleetJobService.ts` |
| `routes.ts` L11032-11046 (DELETE fleet job) | 15 | Controller | `fleetJobController.ts` |
| `routes.ts` L11051-11102 (GET fleet spares export) | 52 | Controller + Service (Excel generation) | `fleetSpareController.ts` + `fleetSpareService.ts` |
| `routes.ts` L11105-11175 (fleet spares CRUD) | 71 | Controller | `fleetSpareController.ts` |
| `routes.ts` L11180-11273 (makers CRUD + auto-code) | 94 | Controller + Service (auto-code) | `makerController.ts` + `makerService.ts` |
| `routes.ts` L11278-11349 (master lists CRUD) | 72 | Controller | `masterListController.ts` |
| `routes.ts` L11356-11400 (vessel mappings) | 45 | Controller | `fleetMappingController.ts` |
| `routes.ts` L11407-11538 (fleet registry + vessels) | 132 | Controller + Service | `fleetRegistryController.ts` + `fleetRegistryService.ts` |
| `fleetAdmin.ts` L33-165 (master data CRUD) | 133 | Controller + Service | `masterDataController.ts` + `masterDataService.ts` |
| `fleetAdmin.ts` L183 (generate fleet code) | 20 | Controller + Service | `masterDataController.ts` + `masterDataService.ts` |
| `fleetAdmin.ts` L202-374 (fleet-admin fleet-components) | 173 | Controller (merged into fleetComponentController) | `fleetComponentController.ts` |
| `fleetAdmin.ts` L376-439 (fleet vessel mappings) | 64 | Controller | `fleetMappingController.ts` |
| `fleetAdmin.ts` L455-489 (component vessel mappings) | 35 | Controller | `fleetMappingController.ts` |
| `fleetAdmin.ts` L505-574 (fleet component mappings) | 70 | Controller | `fleetMappingController.ts` |
| `fleetAdmin.ts` L601-662 (fleet job mappings) | 62 | Controller | `fleetMappingController.ts` |
| `fleetAdmin.ts` L688-749 (fleet spare mappings) | 62 | Controller | `fleetMappingController.ts` |
| `fleetAdmin.ts` L775-866 (import history + errors) | 92 | Controller + Service | `importHistoryController.ts` + `importHistoryService.ts` |
| `fleetAdmin.ts` L892-1038 (dashboard) | 147 | Controller + Service | `fleetDashboardController.ts` + `fleetDashboardService.ts` |
| `fleetAdmin.ts` L1040+ (copy vessel) | ~115 | Controller + Service | `copyVesselController.ts` + `copyVesselService.ts` |

---

## 3. Layer Mapping: Current → V2

### 3.1 How V2 Reuses Legacy Logic (Not Rewrites)

**Critical principle**: V2 layers call the **same storage methods** in `postgresStorage.ts` that legacy routes call today. The repository layer wraps storage calls. The service layer encapsulates business logic currently inline in routes. The controller layer handles HTTP concerns.

```
LEGACY FLOW (Fleet):
  Request → routes.ts/fleetAdmin.ts (HTTP + validation + business logic + storage call) → Response

V2 FLOW (Fleet):
  Request → routes.ts → Controller (HTTP only) → Service (business logic) → Repository (storage call) → Response
```

The **same `storage.*` methods** are called at the end of both flows.

### 3.2 Legacy Route → V2 Layer Decomposition

**Example: PATCH /fleet/jobs/:id (Update Fleet Job, lines 10954-11028)**

| Concern | Legacy Location | V2 Location |
|---------|-----------------|-------------|
| Extract `req.params.id` and `req.body` | Route handler | Controller |
| Define STRING_FIELDS, JSON_FIELDS, BOOLEAN_FIELDS | Route L10956-10969 | Service (class constants) |
| Type-check and sanitize each field | Route L10974-11008 | Service `sanitizeJobUpdate()` |
| NOT NULL protection (skip empty strings for required fields) | Route L10981-10983 | Service |
| Collect validation errors | Route L10972, L11010 | Service |
| Call `storage.updateFleetJob()` | Route L11017 | Repository |
| Format response with affectedCount | Route L11018 | Controller |
| Error handling, status codes | Route L11019-11027 | Controller |

**Example: POST /fleet/makers (Create Maker, lines 11206-11233)**

| Concern | Legacy Location | V2 Location |
|---------|-----------------|-------------|
| Zod schema validation | Route L11208 | Controller |
| Auto-generate makerCode if empty | Route L11211-11222 | Service `generateMakerCode()` |
| Scan existing makers for max MKR- number | Route L11213-11221 | Service |
| Call `storage.createMaker()` | Route L11225 | Repository |
| Response formatting | Route L11226 | Controller |

---

## 4. Repository Layer Rules

### 4.1 Purpose

The repository is the **only layer** allowed to access the database. In V2, it wraps calls to the existing `storage` interface.

### 4.2 Rules

| Rule | Detail |
|------|--------|
| **Only layer with DB access** | Only file allowed to import `storage` |
| **No business logic** | No validation, no conditional logic, no error interpretation |
| **Same data shape as legacy** | Returns exact same types that `storage.*` methods return today |
| **Stateless** | No caching, no state — pure pass-through to storage |
| **Raw SQL exception** | Sort-order batch updates may use `getPool()` directly (matching legacy pattern) |

### 4.3 Repository Method Signatures

```typescript
// server/v2/fleet/repositories/fleetComponentRepository.ts

export class FleetComponentRepository {
  async findAll(): Promise<FleetComponents[]> {
    return storage.getFleetComponents();
  }
  async findById(id: number): Promise<FleetComponents | undefined> {
    return storage.getFleetComponent(id);
  }
  async findByCode(code: string): Promise<FleetComponents | undefined> {
    return storage.getFleetComponentByCode(code);
  }
  async create(data: InsertFleetComponents): Promise<FleetComponents> {
    return storage.createFleetComponent(data);
  }
  async update(id: number, data: Partial<FleetComponents>): Promise<FleetComponents> {
    return storage.updateFleetComponent(id, data);
  }
  async remove(id: number): Promise<void> {
    return storage.deleteFleetComponent(id);
  }
  async updateSortOrders(updates: Array<{ id: number; sortOrder: number }>): Promise<void> {
    const pool = await getPool();
    for (const update of updates) {
      await pool.query(
        `UPDATE fleet_components SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
        [update.sortOrder, update.id]
      );
    }
  }
}

// server/v2/fleet/repositories/fleetJobRepository.ts

export class FleetJobRepository {
  async findAll(): Promise<FleetJobs[]> {
    return storage.getFleetJobs();
  }
  async findById(id: number): Promise<FleetJobs | undefined> {
    return storage.getFleetJob(id);
  }
  async create(data: InsertFleetJobs): Promise<FleetJobs> {
    return storage.createFleetJob(data);
  }
  async update(id: number, data: Partial<FleetJobs>): Promise<{ updatedJob: FleetJobs; affectedCount: number }> {
    return storage.updateFleetJob(id, data);
  }
  async remove(id: number): Promise<void> {
    return storage.deleteFleetJob(id);
  }
}

// server/v2/fleet/repositories/fleetSpareRepository.ts

export class FleetSpareRepository {
  async findAll(): Promise<FleetSpares[]> {
    return storage.getFleetSparesFromTable();
  }
  async findById(id: number): Promise<FleetSpares | undefined> {
    return storage.getFleetSpareFromTable(id);
  }
  async create(data: InsertFleetSpares): Promise<FleetSpares> {
    return storage.createFleetSpareInTable(data);
  }
  async update(id: number, data: Partial<FleetSpares>): Promise<FleetSpares> {
    return storage.updateFleetSpareInTable(id, data);
  }
  async remove(id: number): Promise<void> {
    return storage.deleteFleetSpareFromTable(id);
  }
}

// server/v2/fleet/repositories/makerRepository.ts

export class MakerRepository {
  async findAll(search?: string): Promise<MakerList[]> {
    return storage.getMakers(search);
  }
  async findById(id: number): Promise<MakerList | undefined> {
    return storage.getMakerById(id);
  }
  async create(data: InsertMakerList): Promise<MakerList> {
    return storage.createMaker(data);
  }
  async update(id: number, data: Partial<MakerList>): Promise<MakerList> {
    return storage.updateMaker(id, data);
  }
  async remove(id: number): Promise<void> {
    return storage.deleteMaker(id);
  }
}
```

---

## 5. Service Layer Rules

### 5.1 Purpose

The service layer contains **all business logic** — the exact same logic currently inline in route handlers.

### 5.2 Rules

| Rule | Detail |
|------|--------|
| **All business logic lives here** | Field sanitization, auto-code generation, delete guards, export formatting |
| **No HTTP objects** | No `Request`, `Response`, or `NextFunction` imports |
| **No database access** | Calls repository only, never imports `storage` or Drizzle |
| **Same logic as legacy** | Identical validation and processing rules |
| **Returns plain objects** | Returns data or throws typed errors — controller decides HTTP status |

### 5.3 Business Logic Migration Map

**Fleet Job Update Sanitization:**
```typescript
// server/v2/fleet/services/fleetJobService.ts

export class FleetJobService {
  private static STRING_FIELDS = [
    'woTitle', 'jobCode', 'maintenanceBasis', 'intervalValue', 'unit',
    'taskType', 'assignedTo', 'approver', 'jobPriority',
    'classRelated', 'briefWorkDescription', 'department',
    'criticality', 'ppeRequirements', 'permitRequirements',
    'otherSafetyRequirements',
  ];

  private static NOTNULL_STRING_FIELDS = new Set([
    'woTitle', 'jobCode', 'taskType', 'assignedTo', 'approver',
    'jobPriority', 'classRelated', 'briefWorkDescription',
    'department', 'criticality',
  ]);

  private static JSON_FIELDS = ['requiredSpareParts', 'requiredTools'];
  private static BOOLEAN_FIELDS = ['isActive'];

  async sanitizeAndUpdate(id: number, body: Record<string, any>): Promise<FleetJobs & { affectedCount: number }> {
    const sanitizedData: Record<string, any> = {};
    const errors: string[] = [];

    // Exact same sanitization logic from routes.ts L10974-11008
    for (const field of FleetJobService.STRING_FIELDS) {
      if (field in body && body[field] !== undefined) {
        if (typeof body[field] !== 'string') { errors.push(`${field} must be a string`); continue; }
        if (FleetJobService.NOTNULL_STRING_FIELDS.has(field) && body[field].trim() === '') continue;
        sanitizedData[field] = body[field];
      }
    }
    for (const field of FleetJobService.JSON_FIELDS) {
      if (field in body && body[field] !== undefined) {
        if (body[field] !== null && !Array.isArray(body[field]) && typeof body[field] !== 'object') {
          errors.push(`${field} must be an array or object`); continue;
        }
        sanitizedData[field] = body[field];
      }
    }
    for (const field of FleetJobService.BOOLEAN_FIELDS) {
      if (field in body && body[field] !== undefined) {
        if (typeof body[field] !== 'boolean') { errors.push(`${field} must be a boolean`); continue; }
        sanitizedData[field] = body[field];
      }
    }

    if (errors.length > 0) throw new ValidationError(`Invalid field types: ${errors.join(', ')}`);
    if (Object.keys(sanitizedData).length === 0) throw new ValidationError('No valid fields to update');

    const { updatedJob, affectedCount } = await this.repository.update(id, sanitizedData);
    return { ...updatedJob, affectedCount };
  }
}
```

**Maker Code Auto-Generation:**
```typescript
// server/v2/fleet/services/makerService.ts

export class MakerService {
  async create(data: InsertMakerList): Promise<MakerList> {
    let makerCode = data.makerCode;
    if (!makerCode || makerCode.trim() === '') {
      const existingMakers = await this.repository.findAll();
      let maxNum = 0;
      for (const m of existingMakers) {
        const match = m.makerCode?.match(/MKR-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      makerCode = `MKR-${String(maxNum + 1).padStart(6, '0')}`;
    }
    return this.repository.create({ ...data, makerCode });
  }

  async update(id: number, data: Partial<MakerList>): Promise<MakerList> {
    // Prevent clearing makerCode
    if (data.makerCode !== undefined && data.makerCode.trim() === '') {
      delete data.makerCode;
    }
    return this.repository.update(id, data);
  }
}
```

**Fleet Job/Spare Excel Export:**
```typescript
// server/v2/fleet/services/fleetJobService.ts

async exportToExcel(): Promise<Buffer> {
  const jobs = await this.repository.findAll();
  // Exact same header list and row mapping from routes.ts L10857-10888
  const headers = [
    'Job Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'WO Title',
    'Task Type', 'Assigned To', 'Approver', 'Job Priority',
    'Class Related', 'Brief Work Description', 'Department', 'Criticality',
    'Is Active', 'Maintenance Basis', 'Interval Value', 'Unit',
    'Required Spare Parts', 'Required Tools', 'PPE Requirements',
    'Permit Requirements', 'Other Safety Requirements'
  ];
  // ... exact same XLSX generation logic
  return buffer;
}
```

### 5.4 Error Types

```typescript
// server/v2/fleet/errors.ts (shared across all fleet services)
export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}
export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}
export class ConflictError extends Error {
  constructor(message: string) { super(message); this.name = 'ConflictError'; }
}
```

---

## 6. Controller Layer Rules

### 6.1 Rules

| Rule | Detail |
|------|--------|
| **HTTP concerns only** | Extract params, body, query; set status codes; return JSON |
| **Schema validation only** | Use Zod schemas — must be permissive (match what legacy accepts) |
| **Calls services only** | No direct database or storage access |
| **No business logic** | No field sanitization, no auto-code generation, no aggregation |
| **Same response contracts** | Must return identical JSON shapes as legacy |
| **Error mapping** | `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409, unknown → 500 |

### 6.2 Error Handling Middleware

```typescript
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error) => {
      if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
      if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
      if (error instanceof ConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("V2 Fleet Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
}
```

---

## 7. RESTful Route Patterns

### 7.1 V2 Fleet Component Routes

```
GET    /technical/api/v2/fleet/component              ← List all
GET    /technical/api/v2/fleet/component/:id           ← Get by ID
GET    /technical/api/v2/fleet/component/by-code/:code ← Get by fleet equipment code
POST   /technical/api/v2/fleet/component               ← Create
PATCH  /technical/api/v2/fleet/component/:id            ← Update
DELETE /technical/api/v2/fleet/component/:id            ← Delete
POST   /technical/api/v2/fleet/component/sort-order     ← Batch sort order update
GET    /technical/api/v2/fleet/component/export         ← Export to Excel
```

### 7.2 V2 Fleet Job Routes

```
GET    /technical/api/v2/fleet/job                     ← List all
GET    /technical/api/v2/fleet/job/:id                  ← Get by ID
POST   /technical/api/v2/fleet/job                      ← Create
PATCH  /technical/api/v2/fleet/job/:id                  ← Update (with field sanitization)
DELETE /technical/api/v2/fleet/job/:id                   ← Delete
GET    /technical/api/v2/fleet/job/export                ← Export to Excel
```

### 7.3 V2 Fleet Spare Routes

```
GET    /technical/api/v2/fleet/spare                    ← List all
GET    /technical/api/v2/fleet/spare/:id                 ← Get by ID
POST   /technical/api/v2/fleet/spare                     ← Create
PATCH  /technical/api/v2/fleet/spare/:id                 ← Update
DELETE /technical/api/v2/fleet/spare/:id                  ← Delete
GET    /technical/api/v2/fleet/spare/export               ← Export to Excel
```

### 7.4 V2 Maker Routes

```
GET    /technical/api/v2/fleet/maker                    ← List all (with ?search= filter)
GET    /technical/api/v2/fleet/maker/:id                 ← Get by ID
POST   /technical/api/v2/fleet/maker                     ← Create (auto-generate makerCode)
PUT    /technical/api/v2/fleet/maker/:id                  ← Update
DELETE /technical/api/v2/fleet/maker/:id                   ← Delete
```

### 7.5 V2 Master List Routes

```
GET    /technical/api/v2/fleet/master-list               ← List all (with ?listType= filter)
GET    /technical/api/v2/fleet/master-list/:id            ← Get by ID
POST   /technical/api/v2/fleet/master-list                ← Create
PUT    /technical/api/v2/fleet/master-list/:id             ← Update
DELETE /technical/api/v2/fleet/master-list/:id              ← Delete
```

### 7.6 V2 Mapping Routes (Consolidated)

```
# Fleet Vessel Mappings
GET    /technical/api/v2/fleet/vessel-mapping             ← List all (with ?code= filter)
GET    /technical/api/v2/fleet/vessel-mapping/by-equipment/:code  ← By equipment code
GET    /technical/api/v2/fleet/vessel-mapping/by-vessel/:code     ← By vessel code
POST   /technical/api/v2/fleet/vessel-mapping              ← Create
DELETE /technical/api/v2/fleet/vessel-mapping/:id           ← Delete

# Component Vessel Mappings
GET    /technical/api/v2/fleet/component-mapping           ← List all
GET    /technical/api/v2/fleet/component-mapping/by-equipment/:code  ← By equipment code
GET    /technical/api/v2/fleet/component-mapping/by-vessel/:code     ← By vessel code
POST   /technical/api/v2/fleet/component-mapping            ← Create
DELETE /technical/api/v2/fleet/component-mapping             ← Delete (body: code + vessel + componentCode)

# Job Vessel Mappings
GET    /technical/api/v2/fleet/job-mapping                  ← List all (with ?code= &job= filters)
GET    /technical/api/v2/fleet/job-mapping/by-job/:jobCode  ← By job code
GET    /technical/api/v2/fleet/job-mapping/by-vessel/:code  ← By vessel code
POST   /technical/api/v2/fleet/job-mapping                   ← Create
DELETE /technical/api/v2/fleet/job-mapping                    ← Delete (body: jobCode + vesselCode)

# Spare Vessel Mappings
GET    /technical/api/v2/fleet/spare-mapping                 ← List all (with ?code= &part= filters)
GET    /technical/api/v2/fleet/spare-mapping/by-spare/:code  ← By part code
GET    /technical/api/v2/fleet/spare-mapping/by-vessel/:code ← By vessel code
POST   /technical/api/v2/fleet/spare-mapping                  ← Create
DELETE /technical/api/v2/fleet/spare-mapping                   ← Delete (body: partCode + vesselCode)
```

### 7.7 V2 Fleet Registry Routes

```
GET    /technical/api/v2/fleet/registry                    ← List fleets (?includeInactive=true)
GET    /technical/api/v2/fleet/registry/:id                 ← Get fleet by ID
POST   /technical/api/v2/fleet/registry                      ← Create fleet
PUT    /technical/api/v2/fleet/registry/:id                   ← Update fleet
DELETE /technical/api/v2/fleet/registry/:id                    ← Delete fleet
GET    /technical/api/v2/fleet/registry/:id/vessels            ← Get vessels by fleet
PUT    /technical/api/v2/fleet/registry/vessel/:id/assign      ← Assign vessel to fleet
GET    /technical/api/v2/fleet/registry/vessels-with-fleets     ← Get vessels with fleet info
```

### 7.8 V2 Admin Routes (Dashboard, Master Data, Import History, Copy Vessel)

```
# Dashboard
GET    /technical/api/v2/fleet/dashboard/metrics            ← Dashboard metrics
GET    /technical/api/v2/fleet/dashboard/stats              ← Dashboard statistics

# Master Data
GET    /technical/api/v2/fleet/master-data                  ← List master data (paginated)
GET    /technical/api/v2/fleet/master-data/:id              ← Get by ID
GET    /technical/api/v2/fleet/master-data/by-code/:code    ← Get by fleet code
POST   /technical/api/v2/fleet/master-data                   ← Create
PATCH  /technical/api/v2/fleet/master-data/:id               ← Update
DELETE /technical/api/v2/fleet/master-data/:id                ← Delete
GET    /technical/api/v2/fleet/master-data/generate-code/:sfiCode  ← Generate fleet equipment code

# Import History
GET    /technical/api/v2/fleet/import-history               ← List import history (paginated)
GET    /technical/api/v2/fleet/import-history/:id            ← Get by ID
GET    /technical/api/v2/fleet/import-history/:id/errors     ← Get import errors
POST   /technical/api/v2/fleet/import-history                ← Create history record
PATCH  /technical/api/v2/fleet/import-history/:id            ← Update history record
POST   /technical/api/v2/fleet/import-history/errors         ← Create import errors (batch)

# Copy Vessel
POST   /technical/api/v2/fleet/copy-vessel                  ← Copy vessel data
```

### 7.9 Route Response Contract Rule

**All V2 routes must return identical JSON shapes as legacy routes.** The same status codes, same error messages, same response structures.

### 7.10 Route Registration

```typescript
// server/v2/fleet/index.ts — Module entry point
export function createFleetV2Router(): Router {
  // Wire up all dependencies (repositories → services → controllers)
  // Return combined router
}

// Registration in main app (additive only):
// app.use('/technical/api/v2/fleet', fleetV2Router);
```

---

## 8. Frontend API Layer Rules

### 8.1 Rules

| Rule | Detail |
|------|--------|
| **One API file per entity** | e.g., `fleetComponentApiV2.ts` |
| **Toggle decides Legacy vs V2** | `getFleetApiBase()` reads `localStorage('fleet_api_version')` |
| **No direct fetch calls in components** | Components consume hooks, hooks consume API file |
| **UI behavior must remain unchanged** | Same data shapes, same loading states, same error handling |

### 8.2 API File Pattern

```typescript
// client/src/modules/fleet/api/fleetComponentApiV2.ts

const getMode = () => localStorage.getItem('fleet_api_version') || 'legacy';

export const fleetComponentApi = {
  getAll: () => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/fleet/component'
      : '/technical/api/fleet-admin/fleet-components';
    return fetch(url).then(r => r.json());
  },
  getById: (id: number) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/fleet/component/${id}`
      : `/technical/api/fleet-admin/fleet-components/${id}`;
    return fetch(url).then(r => r.json());
  },
  // ... same pattern for create, update, delete, sort-order, export
};
```

### 8.3 Toggle Key

**Storage:** `localStorage` key: `fleet_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

This is a **separate toggle** from the Component module toggle (`pms_api_version`), allowing independent rollout.

---

## 9. Toggle Mechanism

### 9.1 How Legacy and V2 Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (always registered):                      │
│    /technical/api/fleet/components/*                      │
│    /technical/api/fleet/jobs/*                             │
│    /technical/api/fleet/spares/*                           │
│    /technical/api/fleet/makers/*                           │
│    /technical/api/fleet-admin/*                            │
│    /technical/api/fleets/*                                 │
│                                                          │
│  V2 Routes (always registered, additive):                │
│    /technical/api/v2/fleet/component/*                     │
│    /technical/api/v2/fleet/job/*                            │
│    /technical/api/v2/fleet/spare/*                          │
│    /technical/api/v2/fleet/maker/*                          │
│    /technical/api/v2/fleet/registry/*                       │
│    /technical/api/v2/fleet/dashboard/*                      │
│    etc.                                                   │
│                                                          │
│  BOTH route sets call the SAME storage methods:          │
│    storage.getFleetComponents()                           │
│    storage.getFleetJobs()                                 │
│    storage.getFleetSparesFromTable()                      │
│    etc.                                                   │
│                                                          │
│  ONE set of database tables:                              │
│    fleet_components, fleet_jobs, fleet_spares,            │
│    maker_list, master_lists, fleet_vessel_mapping, etc.   │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Instant Rollback

**Zero data loss**: Both V2 and legacy operate on the same tables. Switching modes is purely a URL routing change. No data migration, no data divergence.

---

## 10. Critical Enforcement Rules

### 10.1 Architecture Enforcement

| Rule | Detail |
|------|--------|
| **No functional or logical changes** | V2 must produce identical outputs for identical inputs as legacy |
| **No data model behavior change** | Same tables, same columns, same constraints |
| **No legacy code modification** | All V2 code in new files under `server/v2/fleet/`, `shared/v2/fleet/`, `client/src/modules/fleet/` |
| **No cross-module coupling** | Fleet V2 must not import from Component V2 or other modules |
| **Dual-path consolidation** | V2 should use the dedicated `fleet_components` table path consistently (not the legacy `components` table with `dataScope='fleet'` path) |

### 10.2 Layer Boundary Enforcement

| Rule | Layer |
|------|-------|
| **Repository: DB only** | Only layer that imports `storage`. No business logic. |
| **Service: logic only** | No HTTP objects. No `storage` import. |
| **Controller: HTTP only** | Extracts req data, calls service, maps errors to status codes. |
| **Routes: wiring only** | Maps HTTP methods + paths to controller methods. |

---

## 11. Phased Migration Plan

### Phase 1 — Core Fleet CRUD (Backend Only)

**Goal:** Create V2 folder structure, repositories, services, and controllers for core entities: Fleet Components, Fleet Jobs, Fleet Spares, Makers, Master Lists.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 1.1 | Create `server/v2/fleet/` directory structure | New directories | None |
| 1.2 | Create `shared/v2/fleet/schema.ts` + `types.ts` | New files | None |
| 1.3 | Create `errors.ts` (shared error types) | New file | None |
| 1.4 | Implement fleet component repository + service + controller | 3 new files | None |
| 1.5 | Implement fleet job repository + service + controller | 3 new files | None |
| 1.6 | Implement fleet spare repository + service + controller | 3 new files | None |
| 1.7 | Implement maker repository + service + controller | 3 new files | None |
| 1.8 | Implement master list repository + service + controller | 3 new files | None |
| 1.9 | Create `routes.ts` with all core entity routes | New file | None |
| 1.10 | Create `index.ts` module entry point | New file | None |
| 1.11 | Register V2 fleet routes in Express app | Additive to server startup | Low — additive only |

**Validation:**
- [ ] All fleet component CRUD endpoints work with identical responses
- [ ] Fleet job update sanitization produces identical results
- [ ] Maker auto-code generation produces identical codes
- [ ] Sort-order batch update works identically
- [ ] Excel export produces identical files
- [ ] Legacy routes remain completely unaffected

### Phase 2 — Mapping & Registry Routes

**Goal:** Add V2 routes for all mapping tables, fleet registry, and vessel assignment.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 2.1 | Implement fleet mapping repository + service + controller (all 4 mapping types) | 3 new files | None |
| 2.2 | Implement fleet registry repository + service + controller | 3 new files | None |
| 2.3 | Register all mapping and registry routes | `routes.ts` update | None |

**Validation:**
- [ ] All mapping CRUD operations work
- [ ] Fleet registry CRUD works
- [ ] Vessel assignment works
- [ ] Response shapes match legacy exactly

### Phase 3 — Admin Routes (Dashboard, Master Data, Import History, Copy Vessel)

**Goal:** Move all fleet admin sub-router functionality to V2 architecture.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 3.1 | Implement dashboard repository + service + controller | 3 new files | None |
| 3.2 | Implement master data repository + service + controller | 3 new files | None |
| 3.3 | Implement import history repository + service + controller | 3 new files | None |
| 3.4 | Implement copy vessel controller + service | 2 new files | None |
| 3.5 | Register all admin routes | `routes.ts` update | None |

**Validation:**
- [ ] Dashboard metrics match legacy exactly
- [ ] Master data CRUD works
- [ ] Import history pagination works
- [ ] Copy vessel produces identical results

### Phase 4 — Bulk Upload Alignment

**Goal:** Move fleet bulk upload logic (components, jobs, spares) to V2 upload service.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 4.1 | Implement `fleetUploadService.ts` (parsing, field mapping, validation) | New file | None |
| 4.2 | Implement `fleetUploadController.ts` | New file | None |
| 4.3 | Register upload routes | `routes.ts` update | None |
| 4.4 | Verify field mapping dictionaries match legacy exactly | Test comparison | None |

**Validation:**
- [ ] Upload same test file via legacy and V2 → compare results
- [ ] Error messages match exactly
- [ ] Same defaults applied

### Phase 5 — Frontend Integration & Toggle

**Goal:** Create frontend API abstraction, hooks, and toggle for all fleet entities.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 5.1 | Create all API files (`fleetComponentApiV2.ts`, `fleetJobApiV2.ts`, etc.) | New files | None |
| 5.2 | Create all hook files | New files | None |
| 5.3 | Create `FleetApiToggle.tsx` toggle UI | New file | None |
| 5.4 | Add toggle to Fleet Data page header | `FleetDataView.tsx` — minimal change | Low |
| 5.5 | Replace inline API calls with V2 hooks (toggle-aware) | Multiple fleet pages | Medium |
| 5.6 | Test toggle switching between legacy and V2 | Manual test | None |

**Validation:**
- [ ] Toggle defaults to "Legacy" mode
- [ ] Switching to V2 mode: all fleet data loads correctly
- [ ] Switching back to Legacy mode: all fleet data loads correctly
- [ ] No visual differences between modes
- [ ] All management pages (Components, Jobs, Spares) work in both modes

---

## 12. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌─────────────┐                                                 │
│  │ Fleet Toggle │  localStorage: 'fleet_api_version' = 'v2'|'legacy'│
│  └──────┬──────┘                                                 │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────┐                                        │
│  │ fleetComponentApiV2  │  getMode() reads toggle                │
│  │ fleetJobApiV2        │                                        │
│  │ fleetSpareApiV2      │                                        │
│  │ makerApiV2           │                                        │
│  │ ...etc               │                                        │
│  └──────┬───────────────┘                                        │
│         │                                                        │
│    ┌────┴────┐                                                   │
│    │         │                                                   │
│    ▼         ▼                                                   │
│  Legacy    V2 URLs                                               │
│  URLs      /technical/api/v2/fleet/*                             │
│  /technical/api/fleet/*                                          │
│  /technical/api/fleet-admin/*                                    │
└────┬─────────┬───────────────────────────────────────────────────┘
     │         │
     ▼         ▼
┌────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  Legacy Handlers           V2 Handlers                           │
│  (routes.ts +              (v2/fleet/routes.ts)                  │
│   fleetAdmin.ts)           Controller → Service → Repository    │
│  inline logic                       │                            │
│         │                           │                            │
│         └───────────┬───────────────┘                            │
│                     ▼                                            │
│           ┌─────────────────┐                                    │
│           │ storage.*()     │  SAME storage methods              │
│           │ (postgresStorage│  SAME database tables              │
│           │  .ts)           │  SAME data                         │
│           └────────┬────────┘                                    │
│                    ▼                                             │
│           ┌────────────────┐                                     │
│           │  PostgreSQL    │                                     │
│           │  fleet_*       │  ← fleet tables, shared by both    │
│           │  tables        │                                     │
│           └────────────────┘                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Fleet Bulk Upload Refactor Plan

### 13.1 Current State

**Three upload handlers exist in the frontend:**
- `FleetComponentUpload.tsx` (40 lines) — Uploads to fleet components import
- `FleetJobsUpload.tsx` (48 lines) — Uploads to fleet jobs import
- `FleetSparesUpload.tsx` (43 lines) — Uploads to fleet spares import

**Backend processing is handled in the bulk import routes** (registered at `/technical/api/bulk`), which do file parsing, field mapping, validation, and call storage for upsert operations.

### 13.2 V2 Upload Architecture

```
V2 Fleet Upload Paths:

POST /technical/api/v2/fleet/component/upload     ← Fleet component bulk upload
POST /technical/api/v2/fleet/job/upload            ← Fleet job bulk upload
POST /technical/api/v2/fleet/spare/upload           ← Fleet spare bulk upload

Each follows the pattern:
  Controller → Upload Service → Repository
  
Upload Service contains:
  - File type detection
  - CSV/XLSX parsing
  - Field mapping dictionaries (per entity type)
  - Header normalization
  - Row-by-row validation
  - Boolean/decimal conversion
  - Default assignment
```

---

## 14. Risk Points & Rollback Strategy

### 14.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| V2 service logic diverges from legacy | High | Copy exact logic from routes.ts, not rewrite. Line-by-line comparison. |
| Dual-path confusion (fleet components via two routes) | Medium | V2 consolidates to one path. Document migration clearly. |
| Mapping operations have complex delete patterns (body-based) | Medium | Preserve exact same delete patterns in V2 controllers |
| Dashboard stats aggregation may differ | Medium | Compare V2 vs legacy dashboard output field by field |
| Copy vessel operation is complex multi-table | High | Test with real data; compare source and target tables |

### 14.2 Rollback Strategy

| Scenario | Action |
|----------|--------|
| V2 returns incorrect data | User clicks toggle → "Legacy" → instant fallback |
| V2 has performance issues | Toggle to Legacy → no restart needed |
| V2 causes data corruption | Not possible — same storage methods, same tables |
| Need to remove V2 entirely | Delete V2 files, remove route registration — zero impact on legacy |

---

## 15. Validation Checklist

### 15.1 Per-Entity Validation

For **each** fleet entity (Components, Jobs, Spares, Makers, Master Lists):
- [ ] GET all → V2 returns identical array as legacy
- [ ] GET by ID → V2 returns identical object as legacy
- [ ] POST create → V2 creates identical record, returns 201
- [ ] PATCH/PUT update → V2 updates identically, returns same shape
- [ ] DELETE → V2 deletes identically, returns `{ success: true }`
- [ ] Error cases → V2 returns same status codes and error messages

### 15.2 Fleet-Specific Validation

- [ ] Fleet job update sanitization: same fields accepted, same fields rejected
- [ ] Maker auto-code generation: same MKR-XXXXXX format
- [ ] Fleet component sort-order: batch update works identically
- [ ] Fleet component delete guard: blocks deletion with children
- [ ] Excel exports: identical file content

### 15.3 Mapping Validation

For **each** mapping type (vessel, component, job, spare):
- [ ] GET with filters → identical results
- [ ] POST create → identical mapping created
- [ ] DELETE → identical mapping removed

### 15.4 Admin Validation

- [ ] Dashboard metrics match legacy exactly
- [ ] Dashboard stats match legacy exactly
- [ ] Master data CRUD works identically
- [ ] Import history pagination works identically
- [ ] Copy vessel produces identical results

### 15.5 Frontend Validation

- [ ] Toggle defaults to Legacy
- [ ] All pages work in Legacy mode (unchanged)
- [ ] All pages work in V2 mode (identical behavior)
- [ ] Toggle switch causes no data loss
- [ ] No visual differences between modes

---

## Appendix A: Dual Fleet Component Path Resolution

**Current Problem:** Fleet components are accessible through TWO different route prefixes with DIFFERENT underlying storage methods:

| Path Prefix | Storage Method | Queries Table |
|-------------|---------------|---------------|
| `/technical/api/fleet/components/*` | `storage.getFleetScopedComponents()` | `components` table (where `dataScope='fleet'`) |
| `/technical/api/fleet-admin/fleet-components/*` | `storage.getFleetComponents()` | `fleet_components` table (dedicated) |

**V2 Resolution:** The V2 fleet module will use the **dedicated `fleet_components` table** path exclusively (`storage.getFleetComponents()` and siblings). The legacy `dataScope='fleet'` path in the `components` table will remain available only through legacy routes. This provides a clean migration path away from the shared components table.

**Frontend Impact:** Pages currently using `/technical/api/fleet/components/*` (FleetDataView sort-order endpoint) will switch to the V2 consolidated path. Pages using `/technical/api/fleet-admin/fleet-components/*` will map directly to V2 with no behavioral change.

---

## Appendix B: Comparison with Component Module V2 Plan

| Aspect | Component V2 | Fleet V2 |
|--------|-------------|----------|
| Toggle key | `pms_api_version` | `fleet_api_version` |
| Inline business logic complexity | High (RH validation, cascade, counter types) | Medium (field sanitization, auto-code, delete guards) |
| Number of entities | 1 (+ 4 sub-entities) | 12+ entities (components, jobs, spares, makers, master lists, 4 mapping types, registry, dashboard, master data, import history) |
| Route handlers (legacy) | ~30 | ~78 |
| Storage methods | ~25 | ~50+ |
| Frontend pages affected | 1 (`Components.tsx`) | 11+ fleet admin pages |
| Sub-router | None (all in routes.ts) | `fleetAdmin.ts` (1,155 lines) |
| Excel export | None | 3 exports (components, jobs, spares) |
| Bulk upload | 1 (component upload) | 3 (fleet components, jobs, spares) |
| Copy operation | None | Copy Vessel (complex multi-table) |
| Database tables | 1 (`components`) | 10+ fleet tables |

---

---

## Appendix C: Route Inventory Checklist (78/78 Verified)

### routes.ts — Fleet Routes (39 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 1 | 10742 | GET | `/fleet/components` | `fleetComponentController.getAll` | YES |
| 2 | 10753 | GET | `/fleet/components/:id` | `fleetComponentController.getById` | YES |
| 3 | 10767 | POST | `/fleet/components` | `fleetComponentController.create` | YES |
| 4 | 10785 | PATCH | `/fleet/components/:id` | `fleetComponentController.update` | YES |
| 5 | 10807 | DELETE | `/fleet/components/:id` | `fleetComponentController.delete` | YES |
| 6 | 10824 | POST | `/fleet/components/sort-order` | `fleetComponentController.updateSortOrder` | YES |
| 7 | 10853 | GET | `/fleet/jobs/export` | `fleetJobController.export` | YES |
| 8 | 10911 | GET | `/fleet/jobs` | `fleetJobController.getAll` | YES |
| 9 | 10922 | GET | `/fleet/jobs/:id` | `fleetJobController.getById` | YES |
| 10 | 10936 | POST | `/fleet/jobs` | `fleetJobController.create` | YES |
| 11 | 10954 | PATCH | `/fleet/jobs/:id` | `fleetJobController.update` | YES |
| 12 | 11032 | DELETE | `/fleet/jobs/:id` | `fleetJobController.delete` | YES |
| 13 | 11051 | GET | `/fleet/spares/export` | `fleetSpareController.export` | YES |
| 14 | 11105 | GET | `/fleet/spares` | `fleetSpareController.getAll` | YES |
| 15 | 11116 | GET | `/fleet/spares/:id` | `fleetSpareController.getById` | YES |
| 16 | 11130 | POST | `/fleet/spares` | `fleetSpareController.create` | YES |
| 17 | 11145 | PATCH | `/fleet/spares/:id` | `fleetSpareController.update` | YES |
| 18 | 11164 | DELETE | `/fleet/spares/:id` | `fleetSpareController.delete` | YES |
| 19 | 11180 | GET | `/fleet/makers` | `makerController.getAll` | YES |
| 20 | 11192 | GET | `/fleet/makers/:id` | `makerController.getById` | YES |
| 21 | 11206 | POST | `/fleet/makers` | `makerController.create` | YES |
| 22 | 11237 | PUT | `/fleet/makers/:id` | `makerController.update` | YES |
| 23 | 11262 | DELETE | `/fleet/makers/:id` | `makerController.delete` | YES |
| 24 | 11278 | GET | `/fleet/master-lists` | `masterListController.getAll` | YES |
| 25 | 11290 | GET | `/fleet/master-lists/:id` | `masterListController.getById` | YES |
| 26 | 11304 | POST | `/fleet/master-lists` | `masterListController.create` | YES |
| 27 | 11319 | PUT | `/fleet/master-lists/:id` | `masterListController.update` | YES |
| 28 | 11338 | DELETE | `/fleet/master-lists/:id` | `masterListController.delete` | YES |
| 29 | 11356 | GET | `/fleet/vessel-mappings` | `fleetMappingController.getVesselMappings` | YES |
| 30 | 11367 | POST | `/fleet/vessel-mappings` | `fleetMappingController.createVesselMappings` | YES |
| 31 | 11392 | DELETE | `/fleet/vessel-mappings/:id` | `fleetMappingController.deleteVesselMapping` | YES |
| 32 | 11407 | GET | `/fleets` | `fleetRegistryController.getAll` | YES |
| 33 | 11421 | GET | `/fleets/:id` | `fleetRegistryController.getById` | YES |
| 34 | 11435 | POST | `/fleets` | `fleetRegistryController.create` | YES |
| 35 | 11462 | PUT | `/fleets/:id` | `fleetRegistryController.update` | YES |
| 36 | 11487 | DELETE | `/fleets/:id` | `fleetRegistryController.delete` | YES |
| 37 | 11504 | GET | `/fleets/:id/vessels` | `fleetRegistryController.getVesselsByFleet` | YES |
| 38 | 11515 | PUT | `/vessels/:id/fleet` | `fleetRegistryController.assignVesselToFleet` | YES |
| 39 | 11530 | GET | `/vessels-with-fleets` | `fleetRegistryController.getVesselsWithFleets` | YES |

### fleetAdmin.ts — Fleet Admin Sub-Router (39 handlers)

| # | Line | Method | Path (under `/fleet-admin/`) | V2 Target | Accounted |
|---|------|--------|------------------------------|-----------|-----------|
| 40 | 33 | GET | `master-data` | `masterDataController.getAll` | YES |
| 41 | 64 | GET | `master-data/:id` | `masterDataController.getById` | YES |
| 42 | 81 | GET | `master-data/by-code/:code` | `masterDataController.getByCode` | YES |
| 43 | 104 | POST | `master-data` | `masterDataController.create` | YES |
| 44 | 147 | PATCH | `master-data/:id` | `masterDataController.update` | YES |
| 45 | 165 | DELETE | `master-data/:id` | `masterDataController.delete` | YES |
| 46 | 183 | GET | `generate-fleet-equipment-code/:sfiCode` | `masterDataController.generateCode` | YES |
| 47 | 202 | GET | `fleet-components` | `fleetComponentController.getAll` (consolidated) | YES |
| 48 | 233 | GET | `fleet-components/export` | `fleetComponentController.export` | YES |
| 49 | 281 | GET | `fleet-components/:id` | `fleetComponentController.getById` (consolidated) | YES |
| 50 | 298 | GET | `fleet-components/by-code/:code` | `fleetComponentController.getByCode` | YES |
| 51 | 315 | POST | `fleet-components` | `fleetComponentController.create` (consolidated) | YES |
| 52 | 336 | PATCH | `fleet-components/:id` | `fleetComponentController.update` (consolidated) | YES |
| 53 | 354 | DELETE | `fleet-components/:id` | `fleetComponentController.delete` (consolidated) | YES |
| 54 | 376 | GET | `fleet-vessel-mappings` | `fleetMappingController.getFleetVesselMappings` | YES |
| 55 | 400 | GET | `fleet-vessel-mappings/by-equipment/:code` | `fleetMappingController.getFleetVesselMappingsByEquipment` | YES |
| 56 | 412 | GET | `fleet-vessel-mappings/by-vessel/:vesselCode` | `fleetMappingController.getFleetVesselMappingsByVessel` | YES |
| 57 | 424 | POST | `fleet-vessel-mappings` | `fleetMappingController.createFleetVesselMapping` | YES |
| 58 | 439 | DELETE | `fleet-vessel-mappings/:id` | `fleetMappingController.deleteFleetVesselMapping` | YES |
| 59 | 455 | GET | `component-vessel-mappings` | `fleetMappingController.getComponentVesselMappings` | YES |
| 60 | 474 | POST | `component-vessel-mappings` | `fleetMappingController.createComponentVesselMapping` | YES |
| 61 | 489 | DELETE | `component-vessel-mappings/:id` | `fleetMappingController.deleteComponentVesselMapping` | YES |
| 62 | 505 | GET | `fleet-component-mappings` | `fleetMappingController.getFleetComponentMappings` | YES |
| 63 | 535 | GET | `fleet-component-mappings/by-equipment/:code` | `fleetMappingController.getFleetComponentMappingsByEquipment` | YES |
| 64 | 547 | GET | `fleet-component-mappings/by-vessel/:vesselCode` | `fleetMappingController.getFleetComponentMappingsByVessel` | YES |
| 65 | 559 | POST | `fleet-component-mappings` | `fleetMappingController.createFleetComponentMapping` | YES |
| 66 | 574 | DELETE | `fleet-component-mappings` | `fleetMappingController.deleteFleetComponentMapping` | YES |
| 67 | 601 | GET | `fleet-job-mappings` | `fleetMappingController.getFleetJobMappings` | YES |
| 68 | 622 | GET | `fleet-job-mappings/by-job/:jobCode` | `fleetMappingController.getFleetJobMappingsByJob` | YES |
| 69 | 634 | GET | `fleet-job-mappings/by-vessel/:vesselCode` | `fleetMappingController.getFleetJobMappingsByVessel` | YES |
| 70 | 647 | POST | `fleet-job-mappings` | `fleetMappingController.createFleetJobMapping` | YES |
| 71 | 662 | DELETE | `fleet-job-mappings` | `fleetMappingController.deleteFleetJobMapping` | YES |
| 72 | 688 | GET | `fleet-spare-mappings` | `fleetMappingController.getFleetSpareMappings` | YES |
| 73 | 709 | GET | `fleet-spare-mappings/by-spare/:partCode` | `fleetMappingController.getFleetSpareMappingsBySpare` | YES |
| 74 | 721 | GET | `fleet-spare-mappings/by-vessel/:vesselCode` | `fleetMappingController.getFleetSpareMappingsByVessel` | YES |
| 75 | 734 | POST | `fleet-spare-mappings` | `fleetMappingController.createFleetSpareMapping` | YES |
| 76 | 749 | DELETE | `fleet-spare-mappings` | `fleetMappingController.deleteFleetSpareMapping` | YES |
| 77 | 775 | GET | `import-history` | `importHistoryController.getAll` | YES |
| 78 | 810 | GET | `import-history/:id` | `importHistoryController.getById` | YES |

### Additional Admin Handlers (counted within the 78 above — IDs 77-78 plus additional handlers below)

| # | Line | Method | Path (under `/fleet-admin/`) | V2 Target | Accounted |
|---|------|--------|------------------------------|-----------|-----------|
| — | 827 | GET | `import-history/:id/errors` | `importHistoryController.getErrors` | YES (sub-route of #78) |
| — | 839 | POST | `import-history` | `importHistoryController.create` | YES |
| — | 854 | PATCH | `import-history/:id` | `importHistoryController.update` | YES |
| — | 866 | POST | `import-errors` | `importHistoryController.createErrors` | YES |
| — | 892 | GET | `dashboard-metrics` | `fleetDashboardController.getMetrics` | YES |
| — | 902 | GET | `dashboard-stats` | `fleetDashboardController.getStats` | YES |
| — | 1040 | POST | `copy-vessel` | `copyVesselController.copy` | YES |

**Total Verified: 78 route handlers in routes.ts + 7 additional handlers in fleetAdmin.ts = 85 total fleet-related HTTP endpoints.**

*(Note: Initial count of 78 was approximate. The actual total including all fleetAdmin sub-routes is 85.)*

---

## Appendix D: Storage Method Reconciliation Table

This table reconciles **naming variants** between what route handlers call and the actual interface method names in `server/storage.ts`.

### D.1 Methods with Naming Variants

| Route Handler Calls | Actual Interface Method | Table | Resolution for V2 Repository |
|---------------------|------------------------|-------|------------------------------|
| `storage.getMasterDataPaginated()` | `storage.getMasterDataList()` (L714) | `master_data` | Repository: `findAll()` → calls `storage.getMasterDataList()` |
| `storage.getMasterDataById(id)` | `storage.getMasterDataItem(id)` (L715) | `master_data` | Repository: `findById()` → calls `storage.getMasterDataItem(id)` |
| `storage.getMasterDataByFleetCode(code)` | `storage.getMasterDataByFleetCode(code)` (L716) | `master_data` | Repository: `findByCode()` → calls `storage.getMasterDataByFleetCode(code)` |
| — | `storage.getMasterDataByMakerModel(maker, model)` (L717) | `master_data` | Repository: `findByMakerModel()` → calls `storage.getMasterDataByMakerModel(maker, model)` |
| `storage.deleteFleetVesselMapping(id)` (L662) | For legacy vessel-mappings route in routes.ts | `fleet_vessel_mapping` | Repository: `removeByFleetCodeAndVessel()` uses `removeFleetVesselMappingRecord()` (L727) |
| `storage.removeFleetVesselMappingRecord(code, vessel)` (L727) | For fleet-admin vessel-mappings route | `fleet_vessel_mapping` | V2 consolidates to `removeFleetVesselMappingRecord()` |
| `storage.createFleetVesselMappings(data)` (L654) | Batch create in routes.ts L11367 (multiple items) | `fleet_vessel_mapping` | Repository: `createBatch()` wraps `storage.createFleetVesselMappings()` |
| `storage.createFleetVesselMappingRecord(mapping)` (L726) | Single create in fleetAdmin.ts L424 | `fleet_vessel_mapping` | Repository: `create()` wraps `storage.createFleetVesselMappingRecord()` |
| `storage.getComponentVesselMappings()` (L730) | Distinct from fleet component mappings | `component_vessel_mappings` | Repository: `findComponentVesselMappings()` |
| `storage.deleteComponentVesselMapping(id)` | Not explicitly in interface — uses generic pattern | — | Repository: `removeComponentVesselMapping()` |
| `storage.getMakers(search)` (L616) | Makers in routes.ts | `maker_list` | Repository: `findAll(search?)` |
| `storage.getMakerList()` (L682) | MakerList in fleetAdmin.ts | `maker_list` | Same underlying table — V2 uses `findAll()` |
| `storage.getMakerById(id)` (L617) | Maker by ID | `maker_list` | Repository: `findById(id)` |
| `storage.getMakerListItem(id)` (L683) | MakerList item by ID | `maker_list` | Same underlying table — V2 uses `findById(id)` |
| `storage.getMakerListByCode(code)` (L684) | MakerList by code | `maker_list` | Repository: `findByCode(code)` |

### D.2 Legacy-Only Methods (Not Mapped to V2)

| Method | Table | Reason for Exclusion |
|--------|-------|---------------------|
| `storage.getFleetScopedComponents()` | `components` (dataScope='fleet') | V2 uses dedicated `fleet_components` table exclusively |
| `storage.getFleetScopedComponent(id)` | `components` (dataScope='fleet') | V2 uses dedicated `fleet_components` table exclusively |
| `storage.createFleetScopedComponent(data)` | `components` (dataScope='fleet') | V2 uses dedicated `fleet_components` table exclusively |
| `storage.updateFleetScopedComponent(id, data)` | `components` (dataScope='fleet') | V2 uses dedicated `fleet_components` table exclusively |
| `storage.deleteFleetScopedComponent(id)` | `components` (dataScope='fleet') | V2 uses dedicated `fleet_components` table exclusively |
| `storage.getFleetSpares()` | `spares` (fleet scope) | V2 uses dedicated `fleet_spares` table exclusively |
| `storage.getFleetSpare(id)` | `spares` (fleet scope) | V2 uses dedicated `fleet_spares` table exclusively |
| `storage.createFleetSpare(data)` | `spares` (fleet scope) | V2 uses dedicated `fleet_spares` table exclusively |
| `storage.deleteFleetSpare(id)` | `spares` (fleet scope) | V2 uses dedicated `fleet_spares` table exclusively |

---

## Appendix E: Business Logic Preservation Rules (Must-Preserve)

These are critical business logic behaviors that the V2 service layer MUST preserve exactly as-is. Each item references the legacy source location.

### E.1 Maker Code Auto-Generation (routes.ts L11211-11222)

**Rule**: When creating a maker, if `makerCode` is not provided or is empty:
1. Fetch all existing makers
2. Scan all `makerCode` values matching pattern `/MKR-(\d+)/`
3. Find the highest numeric suffix
4. Generate `MKR-` + (max + 1) padded to 6 digits (e.g., `MKR-000042`)

**Update Protection** (routes.ts L11243-11244): When updating a maker, if `makerCode` is provided as empty string, strip it from the update payload to prevent clearing.

### E.2 Fleet Job Field Sanitization (routes.ts L10954-11028)

**Rule**: On PATCH update, every field in the request body is validated by type category:

| Category | Fields | Validation | Not-Null Protection |
|----------|--------|------------|---------------------|
| STRING_FIELDS | woTitle, jobCode, maintenanceBasis, intervalValue, unit, taskType, assignedTo, approver, jobPriority, classRelated, briefWorkDescription, department, criticality, ppeRequirements, permitRequirements, otherSafetyRequirements | Must be `typeof string` | woTitle, jobCode, taskType, assignedTo, approver, jobPriority, classRelated, briefWorkDescription, department, criticality — skip if `trim() === ''` |
| JSON_FIELDS | requiredSpareParts, requiredTools | Must be `null`, `Array`, or `object` | N/A |
| BOOLEAN_FIELDS | isActive | Must be `typeof boolean` | N/A |

**Error Behavior**: Collect all type errors, throw if any exist. If sanitizedData is empty after validation, throw "No valid fields to update".

**Return Shape**: `{ ...updatedJob, affectedCount }` — affectedCount comes from storage method.

### E.3 Fleet Component Delete Guard (routes.ts L10815)

**Rule**: Before deleting a fleet component, check if it has child components (where `parentFleetEquipmentCode === targetComponent.fleetEquipmentCode`). If children exist, return 400 error: "Cannot delete component with child components".

### E.4 Fleet Creation Conflict Detection (routes.ts L11439-11460)

**Rule**: When creating a fleet:
1. Code and name are required (validated)
2. If `id` not provided, use `code` as `id`
3. Check for existing fleet with same `code` → return 409 Conflict
4. Save with `isActive: true` default

### E.5 Copy Vessel Multi-Table Cascade (fleetAdmin.ts L1040-1153)

**Rule**: Copy vessel replicates mapping data from source to target vessel across three mapping tables:

**Zod Schema**:
```
sourceVesselCode: string (min 1)
targetVesselCode: string (min 1)
targetVesselName: string (optional)
copyComponents: boolean (default true)
copyJobs: boolean (default true)
copySpares: boolean (default true)
mappedBy: string (default "system")
```

**Validation**: Source and target vessel cannot be the same (400 error).

**Cascade Order**:
1. **Component Mappings** (if copyComponents=true):
   - Fetch source mappings via `storage.getFleetComponentMappingsByVessel(source)`
   - Fetch existing target mappings via `storage.getFleetComponentMappingsByVessel(target)`
   - Dedup key: `fleetEquipmentCode|componentCode`
   - Create missing mappings with `vesselCode = targetVesselCode`
   - Skip silently on unique constraint errors

2. **Job Mappings** (if copyJobs=true):
   - Fetch ALL job mappings via `storage.getFleetJobVesselMappings(undefined, undefined)`
   - Filter source: `vesselCode === source && isActive`
   - Filter existing target: `vesselCode === target && isActive`
   - Dedup key: `jobCode|fleetEquipmentCode`
   - Create missing mappings with `vesselCode = targetVesselCode`, `vesselName = targetVesselName || original`
   - Skip silently on unique constraint errors

3. **Spare Mappings** (if copySpares=true):
   - Fetch ALL spare mappings via `storage.getFleetSpareVesselMappings()`
   - Filter source: `vesselCode === source && isActive`
   - Filter existing target: `vesselCode === target && isActive`
   - Dedup key: `partCode|fleetEquipmentCode`
   - Create missing mappings with `vesselCode = targetVesselCode`, `vesselName = targetVesselName || original`
   - Skip silently on unique constraint errors

**Return Shape**:
```json
{
  "success": true,
  "message": "Vessel data successfully replicated. N mapping(s) copied.",
  "results": { "components": N, "jobs": N, "spares": N, "errors": [] }
}
```

### E.6 Dashboard Stats Aggregation (fleetAdmin.ts L902-1035)

**Rule**: The dashboard stats endpoint performs in-memory aggregation across four tables. V2 must use the **same aggregation logic**, including:

1. **Leaf Component Filter**: `fleetEquipmentCode.length === 10` (leaf nodes have 10-character codes)
2. **Maker linkage**: Compares `makerCode` across components + spares to determine linked/unlinked makers
3. **Component validity**: Jobs/spares with `fleetEquipmentCode` not in leaf components set = "invalid component"
4. **Recent activity**: Combined last 5 from each entity, merged and sorted by date, limited to 10

**Important**: This endpoint uses `getDb()` with Drizzle ORM queries directly (not storage methods) for the four table scans. The V2 dashboard repository must replicate this by either using the same Drizzle approach or equivalent storage methods.

### E.7 Master Data Code Generation (fleetAdmin.ts L183-199)

**Rule**: Generate fleet equipment code from SFI code:
- Uses `storage.generateFleetEquipmentCode(sfiCode)` which scans existing master data to find next available code in the SFI group.

### E.8 Master Data Create Validation (fleetAdmin.ts L104-143)

**Rule**: When creating master data:
1. Check for existing entry with same `fleetEquipmentCode` → 409 Conflict
2. Check for existing entry with same `makerCode` + `model` combination → 409 Conflict
3. Both uniqueness checks must pass before creation

### E.9 Fleet Sort-Order Batch Update (routes.ts L10824-10848)

**Rule**: Accepts array of `{ id, sortOrder }` pairs. Uses raw SQL via `getPool()`:
```sql
UPDATE fleet_components SET sort_order = $1, updated_at = NOW() WHERE id = $2
```
Must NOT use `getDb().update()` (confirmed broken pattern — see development notes).

---

## Appendix F: Dual Fleet Component Path — Toggle Resolution

### F.1 Problem Statement

Legacy has TWO distinct route families for fleet components that query DIFFERENT tables:

| Path Family | Storage Methods | Underlying Table | Who Uses It |
|-------------|----------------|-----------------|-------------|
| `/technical/api/fleet/components/*` | `getFleetScopedComponents()`, etc. | `components` (where `data_scope='fleet'`) | FleetDataView.tsx sort-order, some legacy views |
| `/technical/api/fleet-admin/fleet-components/*` | `getFleetComponents()`, etc. | `fleet_components` (dedicated table) | FleetComponentsManagement.tsx, AddEditFleetComponent.tsx |

### F.2 V2 Resolution

The V2 fleet module consolidates to the **dedicated `fleet_components` table** exclusively:

```
V2 Path: /technical/api/v2/fleet/component/*
Storage: storage.getFleetComponents(), storage.createFleetComponent(), etc.
Table:   fleet_components
```

### F.3 Toggle Behavior

| Frontend Mode | Component API Path | Table Queried |
|---------------|-------------------|---------------|
| Legacy | Mixed: some pages use `/fleet/components/*`, others use `/fleet-admin/fleet-components/*` | Mixed: `components` table AND `fleet_components` table |
| V2 | Unified: `/v2/fleet/component/*` | `fleet_components` table only |

### F.4 Migration Safety

- Legacy routes are **never removed** — they continue to function
- The `components` table with `dataScope='fleet'` remains queryable via legacy paths
- V2 only introduces a new, cleaner path — it does not alter or migrate legacy data
- If a user toggles back to Legacy, they get the original dual-path behavior

### F.5 Data Consideration

If the `components` table (with `dataScope='fleet'`) and `fleet_components` table have diverged in content, switching between Legacy and V2 modes may show different data for some views. This is a **known pre-existing issue** in the legacy system, not introduced by V2. The long-term plan is to deprecate the `components` table fleet-scoped entries once the `fleet_components` table is confirmed as the authoritative source.

---

*Document Version: 1.1*
*Created: February 2026*
*Updated: February 2026 — Added Appendices C-F per architect review*
*Scope: Fleet Module V2 Architecture — Planning Only*
