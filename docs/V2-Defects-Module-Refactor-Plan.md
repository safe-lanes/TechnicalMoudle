# V2 Modular Architecture Plan — Defects Module

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) Defects module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: All Defect-specific entities — Defects (CRUD, CoC, counts), Defect Actions, Defect Attachments, Defect Workflow (Notes, Linking, Closure), Defect Reports, Defect Admin (Categories & Types), and Recurring Defects.

**Critical Constraint**: The V2 architecture must use 100% the same business rules, validations, calculations, and workflows as legacy. This initiative is purely an architectural re-organization, not a functional rewrite.

**Companion Document**: This plan follows the exact same conventions established in `V2-Fleet-Module-Refactor-Plan.md` (Fleet Module V2) and `V2-Component-Module-Refactor-Plan.md` (Component Module V2). All plans share identical layer rules, toggle mechanism, and enforcement policies.

---

## Canonical V2 API Prefix

All V2 defects endpoints use these canonical base paths:

```
/technical/api/v2/defects/defect          ← Core Defects entity (CRUD, CoC, counts)
/technical/api/v2/defects/action          ← Defect Actions (standalone by actionId)
/technical/api/v2/defects/attachment      ← Defect Attachments (standalone by attachmentId)
/technical/api/v2/defects/report          ← Defect Reports
/technical/api/v2/defects/admin/category  ← Defect Categories (admin)
/technical/api/v2/defects/admin/type      ← Defect Types (admin)
/technical/api/v2/defects/recurring       ← Recurring Defects
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/defects/` — module name
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
13. [Risk Points & Rollback Strategy](#13-risk-points--rollback-strategy)
14. [Validation Checklist](#14-validation-checklist)

---

## 1. Current State Analysis

### 1.1 Backend File Sizes & Responsibility Mapping

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `server/routes.ts` | 20,231 | ALL route handlers including defect routes (L5734–L6507 and L11238–L11307) | Monolithic — defect routes mixed with every other module |
| `server/postgresStorage.ts` | 7,111+ | ALL database queries including defect storage methods | Monolithic — defect queries mixed with every other query |
| `server/storage.ts` | 976 | Storage interface definition | 47+ defect-specific methods in a single interface |
| `shared/schema.ts` | 2,825+ | ALL Drizzle schema definitions | All defect tables defined alongside all other tables |
| `client/src/pages/defects/DefectFormExact.tsx` | 1,841 | Main defect form (structured form) | Inline API calls via `useQuery`, no API abstraction layer |
| `client/src/pages/defects/DefectFormWizard.tsx` | 2,195 | Step-by-step defect creation wizard | Inline API calls |
| `client/src/pages/defects/DefectsLogWithTabs.tsx` | 1,047 | Tabbed defects log view | Inline API calls |
| `client/src/pages/defects/DefectsLog.tsx` | 788 | Basic defects log | Inline API calls |
| `client/src/pages/defects/DefectsCoC.tsx` | 880 | Condition of Class view | Inline API calls |
| `client/src/pages/defects/DefectsDashboard.tsx` | 619 | Defects dashboard/summary | Inline API calls |
| `client/src/pages/defects/DefectsActive.tsx` | 578 | Active defects view | Inline API calls |
| `client/src/pages/defects/DefectsReports.tsx` | 419 | Defects reports interface | Inline API calls |
| `client/src/pages/defects/DefectsResolved.tsx` | 323 | Resolved defects view | Inline API calls |
| `client/src/pages/defects/DefectsListModal.tsx` | 288 | Defect selection modal | Inline API calls |
| `client/src/pages/defects/LinkDefectsModal.tsx` | 261 | Link defects dialog | Inline API calls |
| `client/src/pages/defects/AddNoteModal.tsx` | 235 | Add note dialog | Inline API calls |
| `client/src/pages/defects/DefectModal.tsx` | 110 | Defect detail modal | Inline API calls |

### 1.2 Defect Route Inventory (Legacy)

**Total Legacy Defect Routes: 37 route handlers** (33 in L5734–L6507 + 4 in L11238–L11307)

#### 1.2.1 Core Defects CRUD — routes.ts (L5734–L5935)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 5734 | GET | `/technical/api/defects` | List defects with comprehensive filters (vesselId, status, statusView, priority, critical, isCoC, dateFrom, dateTo, search, includeClosedDefects, dueOverdue) | `storage.getDefects(filters)` |
| 5760 | GET | `/technical/api/defects/coc` | List Condition of Class defects | `storage.getDefects({ isCoC: true, ...filters })` |
| 5782 | GET | `/technical/api/defects/recurring` | List recurring defects (shortcut) | `storage.getRecurringDefects(filters)` |
| 5799 | GET | `/technical/api/defects/count` | Get defect counts with filters | `storage.getDefectsCount(filters)` |
| 5823 | GET | `/technical/api/defects/count/recurring` | Get recurring defect count | `storage.getRecurringDefects()` + count |
| 5833 | GET | `/technical/api/defects/:id` | Get single defect by ID | `storage.getDefect(id)` |
| 5846 | POST | `/technical/api/defects` | Create defect with auto-numbering (generateDefectNumber) | `storage.createDefect(defect)` |
| 5875 | PATCH | `/technical/api/defects/:id` | Update defect | `storage.updateDefect(id, updates)` |
| 5893 | DELETE | `/technical/api/defects/:id` | Delete defect | `storage.deleteDefect(id)` |
| 5906 | DELETE | `/technical/api/defects-clear-all` | Clear all defects (test/admin) | Direct DB operation |
| 5914 | POST | `/technical/api/defects-seed-e2e-test` | Seed E2E test data | Custom seed logic |
| 5922 | GET | `/technical/api/defects-count` | Alternative count endpoint | `storage.getDefectsCount(filters)` |

#### 1.2.2 Defect Actions — routes.ts (L5937–L5993)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 5937 | GET | `/technical/api/defects/:defectId/actions` | List actions for defect | `storage.getDefectActions(defectId)` |
| 5947 | POST | `/technical/api/defects/:defectId/actions` | Create defect action | `storage.createDefectAction(action)` |
| 5965 | PATCH | `/technical/api/defects/actions/:actionId` | Update defect action | `storage.updateDefectAction(id, updates)` |
| 5983 | DELETE | `/technical/api/defects/actions/:actionId` | Delete defect action | `storage.deleteDefectAction(id)` |

#### 1.2.3 Defect Attachments — routes.ts (L5996–L6035)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 5996 | GET | `/technical/api/defects/:defectId/attachments` | List attachments for defect | `storage.getDefectAttachments(defectId)` |
| 6006 | POST | `/technical/api/defects/:defectId/attachments` | Upload defect attachment | `storage.createDefectAttachment(attachment)` |
| 6024 | DELETE | `/technical/api/defects/attachments/:attachmentId` | Delete defect attachment | `storage.deleteDefectAttachment(id)` |

#### 1.2.4 Defect Workflow — routes.ts (L6037–L6109)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 6037 | POST | `/technical/api/defects/:id/notes` | Add note to defect | `storage.addDefectNote(id, note)` |
| 6061 | PATCH | `/technical/api/defects/:id/link` | Link defects together | `storage.linkDefects(id, linkedDefectIds)` |
| 6077 | PATCH | `/technical/api/defects/:id/close` | Close defect with closure data | `storage.closeDefect(id, closure)` |

#### 1.2.5 Defect Reports — routes.ts (L6111–L6336)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 6111 | POST | `/technical/api/defects/reports/:reportKey` | Generate defect report by key (multiple report types) | `storage.getDefects(filters)` + report generation logic |

#### 1.2.6 Defect Admin — Categories & Types — routes.ts (L6338–L6507)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 6338 | GET | `/technical/api/defect-categories` | List defect categories | Direct DB query on `defectCategories` table |
| 6350 | POST | `/technical/api/defect-categories` | Create defect category | Direct DB insert |
| 6376 | PATCH | `/technical/api/defect-categories/:id` | Update defect category | Direct DB update |
| 6413 | DELETE | `/technical/api/defect-categories/:id` | Delete defect category | Direct DB delete |
| 6432 | GET | `/technical/api/defect-types` | List defect types | Direct DB query on `defectTypes` table |
| 6444 | POST | `/technical/api/defect-types` | Create defect type | Direct DB insert |
| 6470 | PATCH | `/technical/api/defect-types/:id` | Update defect type | Direct DB update |
| 6507 | DELETE | `/technical/api/defect-types/:id` | Delete defect type | Direct DB delete |

#### 1.2.7 Recurring Defects — routes.ts (L11238–L11307)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 11238 | GET | `/technical/api/recurring-defects` | List recurring defects with filters (windowMonths, minOccurrences, hasCoc, equipmentKey) | `storage.getRecurringDefects(filters)` |
| 11282 | GET | `/technical/api/recurring-defects/:id` | Get recurring defect by ID | `storage.getRecurringDefect(id)` |
| 11296 | GET | `/technical/api/recurring-defects/:id/defects` | Get defects linked to recurring pattern | `storage.getDefectsForRecurring(id)` |
| 11307 | POST | `/technical/api/recurring-defects/recalculate` | Recalculate all recurring defects | `storage.recalculateAllRecurringDefects()` |

### 1.3 Storage Interface Methods (Defect-Related)

From `server/storage.ts`, the defect-related interface methods (47+ methods, L541–L600):

**Core Defects:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getDefects(filters?)` | `Defect[]` | routes.ts L5734, L5760, L5782 |
| `getDefectsCount(filters?)` | `number` | routes.ts L5799, L5922 |
| `getDefect(id)` | `Defect \| undefined` | routes.ts L5833 |
| `createDefect(defect)` | `Defect` | routes.ts L5846 |
| `updateDefect(id, updates)` | `Defect` | routes.ts L5875 |
| `deleteDefect(id)` | `void` | routes.ts L5893 |

**Defect Actions:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getDefectActions(defectId)` | `DefectAction[]` | routes.ts L5937 |
| `createDefectAction(action)` | `DefectAction` | routes.ts L5947 |
| `updateDefectAction(id, updates)` | `DefectAction` | routes.ts L5965 |
| `deleteDefectAction(id)` | `void` | routes.ts L5983 |

**Defect Attachments:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getDefectAttachments(defectId)` | `DefectAttachment[]` | routes.ts L5996 |
| `createDefectAttachment(attachment)` | `DefectAttachment` | routes.ts L6006 |
| `deleteDefectAttachment(id)` | `void` | routes.ts L6024 |

**Defect Workflow (Notes, Linking, Closure):**
| Method | Returns | Used By |
|--------|---------|---------|
| `addDefectNote(defectId, note)` | `Defect` | routes.ts L6037 |
| `linkDefects(defectId, linkedDefectIds)` | `Defect` | routes.ts L6061 |
| `closeDefect(defectId, closure)` | `Defect` | routes.ts L6077 |

**Recurring Defects:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getRecurringDefects(filters?)` | `RecurringDefect[]` | routes.ts L11238 |
| `getRecurringDefect(id)` | `RecurringDefect \| undefined` | routes.ts L11282 |
| `calculateAndUpdateRecurringDefects(equipmentKey, windowMonths?)` | `RecurringDefect \| null` | Various |
| `getRecurringDefectLinks(recurringId)` | `RecurringDefectLink[]` | Various |
| `getDefectsForRecurring(recurringId)` | `Defect[]` | routes.ts L11296 |
| `recalculateAllRecurringDefects()` | `void` | routes.ts L11307 |

**Seed/Test Helpers:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getDefectBySeedId(seedId)` | `Defect \| undefined` | routes.ts L5914 |

### 1.4 Current Schema (Defect Tables)

From `shared/schema.ts`:

**`defect_sequences` Table (L81):** 4 columns
- Core: `id` (integer PK, auto-gen)
- Data: `vesselId` (text, NOT NULL), `year` (integer, NOT NULL), `lastSequence` (integer, NOT NULL, default 0)
- Index: composite index on (vesselId, year) for unique vessel/year lookup

**`defects` Table (L1084):** ~50 columns
- Core: `id` (text PK), `defectNumber` (text, unique), `seedId` (text, unique)
- Vessel: `vesselId` (text, NOT NULL), `vesselName` (text)
- Classification: `status` (text), `priority` (text), `critical` (boolean), `isCoC` (boolean)
- Description: `title` (text, NOT NULL), `description` (text), `category` (text), `defectType` (text)
- Equipment: `equipmentKey` (text), `equipmentName` (text), `componentCode` (text)
- SIRE VIQ 7: `sireViq7Category` (text), `sireViq7SubCategory` (text), `sireViq7Question` (text)
- Dates: `reportedDate` (text), `targetDate` (text), `closedDate` (text), `extendedTargetDate` (text)
- People: `reportedBy` (text), `assignedTo` (text), `closedBy` (text)
- Closure: `closureComment` (text), `closureFiles` (json)
- Notes: `notes` (jsonb) — array of timestamped note objects
- Linked: `linkedDefectIds` (text array) — many-to-many linking
- Recurring: `recurringDefectId` (integer)
- Timestamps: `createdAt`, `updatedAt`

**`defect_actions` Table (L1292):** ~15 columns
- Core: `id` (integer PK, auto-gen), `defectId` (text, NOT NULL)
- Action Data: `actionDescription` (text), `assignedTo` (text), `status` (text), `targetDate` (text), `completedDate` (text)
- Timestamps: `createdAt`, `updatedAt`

**`defect_attachments` Table (L1323):** ~10 columns
- Core: `id` (integer PK, auto-gen), `defectId` (text, NOT NULL)
- File Data: `fileName` (text), `fileUrl` (text), `fileType` (text), `fileSize` (integer)
- Metadata: `uploadedBy` (text), `createdAt`

**`recurring_defects` Table (L1345):** ~15 columns
- Core: `id` (integer PK, auto-gen)
- Pattern: `equipmentKey` (text), `equipmentName` (text), `defectCategory` (text)
- Metrics: `occurrenceCount` (integer), `mtbf` (decimal), `windowMonths` (integer)
- Flags: `hasCoc` (boolean), `isActive` (boolean)
- Timestamps: `createdAt`, `updatedAt`

**`recurring_defect_links` Table (L1370):** ~5 columns
- Core: `id` (integer PK, auto-gen)
- Links: `recurringDefectId` (integer), `defectId` (text)
- Timestamps: `createdAt`

**`defect_categories` Table (L2510):** Category definitions
- Core: `id` (integer PK, auto-gen), `name` (text, NOT NULL), `description` (text)
- Status: `isActive` (boolean, default true)
- Ordering: `sortOrder` (integer)

**`defect_types` Table (L2529):** Type definitions
- Core: `id` (integer PK, auto-gen), `name` (text, NOT NULL), `description` (text)
- Status: `isActive` (boolean, default true)
- Ordering: `sortOrder` (integer)

### 1.5 Key Business Logic in Route Handlers

The defects module has **significant inline business logic** in route handlers. These important patterns exist:

**Auto-Numbering (routes.ts L5846–L5873):**
1. `generateDefectNumber()` imported from `server/utils/defectNumbering`
2. Uses `defectSequences` table for vessel/year-based numbering
3. Format: `DEF-V001-2024-0001` (prefix-vesselSequence-year-sequence)
4. Atomically increments sequence per vessel per year
5. Must be preserved exactly in V2 — sequence integrity is critical

**Closure Workflow (routes.ts L6077–L6109):**
1. `closeDefect()` sets `status` to 'Closed'
2. Records `closedBy`, `closureComment`, `closureFiles`, `closedDate`
3. Status transition must be atomic — partial closure must not be possible
4. Linked defects are NOT auto-closed — independent lifecycle

**CoC (Condition of Class) Filtering (routes.ts L5760–L5780):**
1. Separate endpoint `/defects/coc` filters by `isCoC` flag
2. Same underlying `getDefects()` method with `isCoC: true` filter
3. Used for regulatory compliance tracking

**SIRE VIQ 7 Integration:**
1. Defects reference SIRE VIQ 7 categories for industry-standard classification
2. Fields: `sireViq7Category`, `sireViq7SubCategory`, `sireViq7Question`
3. Read-only reference — no cascade behavior

**Recurring Defect Calculation (routes.ts L11238–L11307):**
1. MTBF (Mean Time Between Failures) calculation across equipment/time windows
2. Pattern detection: identifies equipment with repeated defects
3. `recalculateAllRecurringDefects()` scans all defects and updates patterns
4. Links individual defects to recurring patterns via `recurringDefectLinks`

**Notes System (routes.ts L6037–L6059):**
1. JSONB array of timestamped notes with attachments
2. Append-only behavior — notes are never deleted, only added
3. Each note has: `noteText`, `attachments[]`, `createdBy`, `createdAt`

**Defect Linking (routes.ts L6061–L6075):**
1. Many-to-many linking via `linkedDefectIds` text array
2. Bidirectional — linking A→B should also reflect in B→A
3. Deduplication: prevents duplicate links

**Multi-Report Handler (routes.ts L6111–L6336):**
1. Single `POST /defects/reports/:reportKey` handles multiple report types
2. Report key determines which Excel/PDF template to generate
3. Each report type has different data aggregation and formatting

**Target Date Extension:**
1. `extendedTargetDate` field for due date extensions
2. Due/overdue tracking based on `targetDate` vs current date
3. `dueOverdue` filter parameter for querying

---

## 2. V2 Folder Structure

```
server/v2/defects/
├── index.ts                               # Module entry point — wires all dependencies
├── routes.ts                              # Route definitions (HTTP method + path → controller)
├── types.ts                               # Shared V2 types, DTOs, error types
├── repositories/
│   ├── defectRepository.ts                # Core defect CRUD DB operations
│   ├── defectActionRepository.ts          # Defect action CRUD DB operations
│   ├── defectAttachmentRepository.ts      # Defect attachment CRUD DB operations
│   ├── recurringDefectRepository.ts       # Recurring defect DB operations
│   └── defectAdminRepository.ts           # Categories & Types DB operations
├── services/
│   ├── defectService.ts                   # Core defect business logic (auto-numbering, filtering)
│   ├── defectActionService.ts             # Defect action business logic
│   ├── defectAttachmentService.ts         # Defect attachment business logic
│   ├── defectWorkflowService.ts           # Notes, linking, closure workflows
│   ├── defectReportService.ts             # Report generation logic
│   ├── recurringDefectService.ts          # Recurring defect MTBF calculation
│   └── defectAdminService.ts              # Categories & Types admin logic
├── controllers/
│   ├── defectController.ts                # Core defect HTTP handlers
│   ├── defectActionController.ts          # Defect action HTTP handlers
│   ├── defectAttachmentController.ts      # Defect attachment HTTP handlers
│   ├── defectWorkflowController.ts        # Notes, linking, closure HTTP handlers
│   ├── defectReportController.ts          # Report generation HTTP handlers
│   ├── recurringDefectController.ts       # Recurring defect HTTP handlers
│   └── defectAdminController.ts           # Categories & Types HTTP handlers
└── errors.ts                              # Shared error types for the module

client/src/modules/defects/
├── api/
│   ├── defectApi.ts                       # Core defect API (toggle-aware)
│   ├── defectActionApi.ts                 # Defect action API (toggle-aware)
│   ├── defectAttachmentApi.ts             # Defect attachment API (toggle-aware)
│   ├── recurringDefectApi.ts              # Recurring defect API (toggle-aware)
│   └── defectAdminApi.ts                  # Categories & Types API (toggle-aware)
└── hooks/
    └── useDefectApi.ts                    # React hooks wrapping API layer
```

---

## 3. Layer Mapping: Current → V2

| Current Location | Current Role | V2 Location | V2 Role |
|------------------|-------------|-------------|---------|
| `server/routes.ts` L5734–L5935 | Core defect route handlers + inline logic | `controllers/defectController.ts` + `services/defectService.ts` + `repositories/defectRepository.ts` | Separated into 3 layers |
| `server/routes.ts` L5937–L5993 | Defect action handlers | `controllers/defectActionController.ts` + `services/defectActionService.ts` + `repositories/defectActionRepository.ts` | Separated into 3 layers |
| `server/routes.ts` L5996–L6035 | Defect attachment handlers | `controllers/defectAttachmentController.ts` + `services/defectAttachmentService.ts` + `repositories/defectAttachmentRepository.ts` | Separated into 3 layers |
| `server/routes.ts` L6037–L6109 | Workflow handlers (notes, linking, closure) | `controllers/defectWorkflowController.ts` + `services/defectWorkflowService.ts` | Separated into 2+ layers |
| `server/routes.ts` L6111–L6336 | Report generation handler | `controllers/defectReportController.ts` + `services/defectReportService.ts` | Separated into 2 layers |
| `server/routes.ts` L6338–L6507 | Admin category/type handlers | `controllers/defectAdminController.ts` + `services/defectAdminService.ts` + `repositories/defectAdminRepository.ts` | Separated into 3 layers |
| `server/routes.ts` L11238–L11307 | Recurring defect handlers | `controllers/recurringDefectController.ts` + `services/recurringDefectService.ts` + `repositories/recurringDefectRepository.ts` | Separated into 3 layers |
| `server/storage.ts` L541–L600 | Storage interface (defect methods) | `repositories/*.ts` | Each repository wraps relevant `storage.*` methods |
| `server/postgresStorage.ts` | DB query implementation | No change | Repositories call `storage.*` — DB layer untouched |
| `shared/schema.ts` L81, L1084–L1370, L2510–L2549 | Drizzle schema + types | No change (reused) | Same schema, same types |
| `client/src/pages/defects/*.tsx` (13 files) | Inline `useQuery`/`fetch` calls | `client/src/modules/defects/api/*.ts` + `hooks/useDefectApi.ts` | API abstraction layer with toggle |

---

## 4. Repository Layer Rules

### 4.1 Rules

| Rule | Detail |
|------|--------|
| **Wraps `storage.*` only** | No raw SQL, no `getPool()`, no `getDb()` |
| **No business logic** | No validation, no auto-numbering, no status transitions |
| **No HTTP objects** | No `req`, `res`, no status codes |
| **Returns typed results** | Uses types from `@shared/schema.ts` |
| **One repository per entity group** | e.g., `defectRepository.ts` covers core defect CRUD |

### 4.2 Repository Pattern

```typescript
// server/v2/defects/repositories/defectRepository.ts

import { storage } from '../../../storage';
import type { Defect, InsertDefect } from '@shared/schema';

export class DefectRepository {
  async getAll(filters?: {
    vesselId?: string;
    status?: string;
    statusView?: 'active' | 'resolved';
    category?: string;
    critical?: boolean;
    includeClosedDefects?: boolean;
    search?: string;
    period?: string;
    fleet?: string;
    group?: string;
    dueOverdue?: string;
  }): Promise<Defect[]> {
    return storage.getDefects(filters);
  }

  async getCount(filters?: {
    statusView?: 'active' | 'resolved';
    vesselId?: string;
    isCoC?: boolean;
    category?: string;
    search?: string;
    period?: string;
    fleet?: string;
    group?: string;
    dueOverdue?: string;
  }): Promise<number> {
    return storage.getDefectsCount(filters);
  }

  async getById(id: string): Promise<Defect | undefined> {
    return storage.getDefect(id);
  }

  async create(defect: InsertDefect): Promise<Defect> {
    return storage.createDefect(defect);
  }

  async update(id: string, updates: Partial<InsertDefect>): Promise<Defect> {
    return storage.updateDefect(id, updates);
  }

  async delete(id: string): Promise<void> {
    return storage.deleteDefect(id);
  }

  async getBySeedId(seedId: string): Promise<Defect | undefined> {
    return storage.getDefectBySeedId(seedId);
  }
}
```

---

## 5. Service Layer Rules

### 5.1 Rules

| Rule | Detail |
|------|--------|
| **Contains all business logic** | Auto-numbering, closure workflow, MTBF calculation, CoC filtering |
| **No HTTP objects** | No `req`, `res`, no status codes, no headers |
| **No direct `storage.*` calls** | Receives repository instance via constructor injection |
| **Pure functions where possible** | Input → output, no side effects beyond repository calls |
| **Preserves exact legacy behavior** | Same validation rules, same error messages, same data transformations |

### 5.2 Service Pattern

```typescript
// server/v2/defects/services/defectService.ts

import { DefectRepository } from '../repositories/defectRepository';
import type { Defect, InsertDefect } from '@shared/schema';

export class DefectService {
  constructor(private repo: DefectRepository) {}

  async listDefects(filters?: { ... }): Promise<Defect[]> {
    return this.repo.getAll(filters);
  }

  async listCoCDefects(filters?: { ... }): Promise<Defect[]> {
    return this.repo.getAll({ ...filters, isCoC: true });
  }

  async getDefectCount(filters?: { ... }): Promise<number> {
    return this.repo.getCount(filters);
  }

  async getDefect(id: string): Promise<Defect | undefined> {
    return this.repo.getById(id);
  }

  async createDefect(defect: InsertDefect): Promise<Defect> {
    // Auto-numbering logic — EXACT same as legacy
    // generateDefectNumber() call preserved
    return this.repo.create(defect);
  }

  async updateDefect(id: string, updates: Partial<InsertDefect>): Promise<Defect> {
    return this.repo.update(id, updates);
  }

  async deleteDefect(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
```

---

## 6. Controller Layer Rules

### 6.1 Rules

| Rule | Detail |
|------|--------|
| **HTTP layer only** | Extracts params from `req`, calls service, sends `res` |
| **No business logic** | No validation beyond parsing, no auto-numbering |
| **No direct `storage.*` calls** | Calls service methods only |
| **Maps errors to HTTP status codes** | Service throws → controller catches → sends status code |
| **Identical response shapes** | Must return exact same JSON structure as legacy |

### 6.2 Controller Pattern

```typescript
// server/v2/defects/controllers/defectController.ts

import { Request, Response } from 'express';
import { DefectService } from '../services/defectService';

export class DefectController {
  constructor(private service: DefectService) {}

  getAll = async (req: Request, res: Response) => {
    try {
      const filters = {
        vesselId: req.query.vesselId as string,
        status: req.query.status as string,
        statusView: req.query.statusView as 'active' | 'resolved',
        // ... same filter extraction as legacy L5734
      };
      const defects = await this.service.listDefects(filters);
      res.json(defects);
    } catch (error) {
      console.error("Error fetching defects:", error);
      res.status(500).json({ error: "Failed to fetch defects" });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const defect = await this.service.getDefect(req.params.id);
      if (!defect) {
        return res.status(404).json({ error: "Defect not found" });
      }
      res.json(defect);
    } catch (error) {
      console.error("Error fetching defect:", error);
      res.status(500).json({ error: "Failed to fetch defect" });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const defect = await this.service.createDefect(req.body);
      res.status(201).json(defect);
    } catch (error) {
      console.error("Error creating defect:", error);
      res.status(500).json({ error: "Failed to create defect" });
    }
  };

  // ... same pattern for update, delete, getCoCDefects, getCount, etc.
}
```

---

## 7. RESTful Route Patterns

### 7.1 Core Defects Routes

```
GET    /technical/api/v2/defects/defect                     ← List with filters
GET    /technical/api/v2/defects/defect/coc                 ← CoC defects
GET    /technical/api/v2/defects/defect/count               ← Defect counts
GET    /technical/api/v2/defects/defect/count/recurring     ← Recurring defect count
GET    /technical/api/v2/defects/defect/:id                 ← Get by ID
POST   /technical/api/v2/defects/defect                     ← Create (auto-number)
PATCH  /technical/api/v2/defects/defect/:id                 ← Update
DELETE /technical/api/v2/defects/defect/:id                 ← Delete
```

### 7.2 Defect Actions Routes

```
GET    /technical/api/v2/defects/defect/:defectId/action    ← List actions
POST   /technical/api/v2/defects/defect/:defectId/action    ← Create action
PATCH  /technical/api/v2/defects/action/:actionId           ← Update action
DELETE /technical/api/v2/defects/action/:actionId           ← Delete action
```

### 7.3 Defect Attachments Routes

```
GET    /technical/api/v2/defects/defect/:defectId/attachment ← List attachments
POST   /technical/api/v2/defects/defect/:defectId/attachment ← Upload
DELETE /technical/api/v2/defects/attachment/:attachmentId    ← Delete
```

### 7.4 Defect Workflow Routes

```
POST   /technical/api/v2/defects/defect/:id/note           ← Add note
PATCH  /technical/api/v2/defects/defect/:id/link           ← Link defects
PATCH  /technical/api/v2/defects/defect/:id/close          ← Close defect
```

### 7.5 Defect Reports Routes

```
POST   /technical/api/v2/defects/report/:reportKey         ← Generate report
```

### 7.6 Defect Admin Routes

```
GET    /technical/api/v2/defects/admin/category             ← List categories
POST   /technical/api/v2/defects/admin/category             ← Create category
PATCH  /technical/api/v2/defects/admin/category/:id         ← Update category
DELETE /technical/api/v2/defects/admin/category/:id         ← Delete category
GET    /technical/api/v2/defects/admin/type                 ← List types
POST   /technical/api/v2/defects/admin/type                 ← Create type
PATCH  /technical/api/v2/defects/admin/type/:id             ← Update type
DELETE /technical/api/v2/defects/admin/type/:id             ← Delete type
```

### 7.7 Recurring Defects Routes

```
GET    /technical/api/v2/defects/recurring                  ← List recurring
GET    /technical/api/v2/defects/recurring/:id              ← Get by ID
GET    /technical/api/v2/defects/recurring/:id/defects      ← Get linked defects
POST   /technical/api/v2/defects/recurring/recalculate      ← Recalculate all
```

### 7.8 Test/Admin Routes

```
DELETE /technical/api/v2/defects/admin/clear-all            ← Clear all defects (test/admin)
POST   /technical/api/v2/defects/admin/seed-e2e             ← Seed E2E test data
GET    /technical/api/v2/defects/defect/alt-count           ← Alternative count endpoint
```

### 7.9 Route Response Contract Rule

**All V2 routes must return identical JSON shapes as legacy routes.** The same status codes, same error messages, same response structures.

### 7.10 Route Registration

```typescript
// server/v2/defects/index.ts — Module entry point
export function createDefectsV2Router(): Router {
  // Wire up all dependencies (repositories → services → controllers)
  // Return combined router
}

// Registration in main app (additive only):
// app.use('/technical/api/v2/defects', defectsV2Router);
```

---

## 8. Frontend API Layer Rules

### 8.1 Rules

| Rule | Detail |
|------|--------|
| **One API file per entity** | e.g., `defectApi.ts`, `defectActionApi.ts` |
| **Toggle decides Legacy vs V2** | `getDefectsApiBase()` reads `localStorage('defects_api_version')` |
| **No direct fetch calls in components** | Components consume hooks, hooks consume API file |
| **UI behavior must remain unchanged** | Same data shapes, same loading states, same error handling |

### 8.2 API File Pattern

```typescript
// client/src/modules/defects/api/defectApi.ts

const getMode = () => localStorage.getItem('defects_api_version') || 'legacy';

export const defectApi = {
  getAll: (filters?: Record<string, string>) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/defects/defect'
      : '/technical/api/defects';
    return fetch(url + '?' + new URLSearchParams(filters || {})).then(r => r.json());
  },
  getById: (id: string) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/defects/defect/${id}`
      : `/technical/api/defects/${id}`;
    return fetch(url).then(r => r.json());
  },
  getCoCDefects: (filters?: Record<string, string>) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/defects/defect/coc'
      : '/technical/api/defects/coc';
    return fetch(url + '?' + new URLSearchParams(filters || {})).then(r => r.json());
  },
  create: (defect: any) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/defects/defect'
      : '/technical/api/defects';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(defect) }).then(r => r.json());
  },
  // ... same pattern for update, delete, getCount, close, addNote, linkDefects
};
```

### 8.3 Toggle Key

**Storage:** `localStorage` key: `defects_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

This is a **separate toggle** from the Component module toggle (`pms_api_version`) and Fleet module toggle (`fleet_api_version`), allowing independent rollout.

---

## 9. Toggle Mechanism

### 9.1 How Legacy and V2 Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (always registered):                      │
│    /technical/api/defects/*                               │
│    /technical/api/defect-categories/*                     │
│    /technical/api/defect-types/*                          │
│    /technical/api/defects-clear-all                       │
│    /technical/api/defects-count                           │
│    /technical/api/recurring-defects/*                     │
│                                                          │
│  V2 Routes (always registered, additive):                │
│    /technical/api/v2/defects/defect/*                     │
│    /technical/api/v2/defects/action/*                     │
│    /technical/api/v2/defects/attachment/*                  │
│    /technical/api/v2/defects/report/*                     │
│    /technical/api/v2/defects/admin/*                      │
│    /technical/api/v2/defects/recurring/*                  │
│                                                          │
│  BOTH route sets call the SAME storage methods:          │
│    storage.getDefects()                                  │
│    storage.getDefectsCount()                             │
│    storage.createDefect()                                │
│    storage.closeDefect()                                 │
│    storage.getRecurringDefects()                         │
│    etc.                                                  │
│                                                          │
│  ONE set of database tables:                              │
│    defects, defect_actions, defect_attachments,           │
│    defect_sequences, recurring_defects,                   │
│    recurring_defect_links, defect_categories,             │
│    defect_types                                          │
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
| **No legacy code modification** | All V2 code in new files under `server/v2/defects/`, `client/src/modules/defects/` |
| **No cross-module coupling** | Defects V2 must not import from Component V2, Fleet V2, or other modules |
| **Auto-numbering integrity** | V2 must use the same `generateDefectNumber()` utility — no reimplementation |

### 10.2 Layer Boundary Enforcement

| Rule | Layer |
|------|-------|
| **Repository: DB only** | Only layer that imports `storage`. No business logic. |
| **Service: logic only** | No HTTP objects. No `storage` import. |
| **Controller: HTTP only** | Extracts req data, calls service, maps errors to status codes. |
| **Routes: wiring only** | Maps HTTP methods + paths to controller methods. |

---

## 11. Phased Migration Plan

### Phase 1 — Core Defects CRUD + Count Endpoints (Backend Only) — 12 routes

**Goal:** Create V2 folder structure, repositories, services, and controllers for core defect CRUD: list (with filters), CoC, recurring shortcut, counts, get by ID, create (with auto-numbering), update, delete, plus test/admin endpoints.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 1.1 | Create `server/v2/defects/` directory structure | New directories | None |
| 1.2 | Create `types.ts` + `errors.ts` (shared types) | New files | None |
| 1.3 | Implement `defectRepository.ts` | New file | None |
| 1.4 | Implement `defectService.ts` (auto-numbering, filtering, CoC) | New file | None |
| 1.5 | Implement `defectController.ts` | New file | None |
| 1.6 | Create `routes.ts` with core defect routes | New file | None |
| 1.7 | Create `index.ts` module entry point | New file | None |
| 1.8 | Register V2 defects routes in Express app | Additive to server startup | Low — additive only |

**Validation:**
- [ ] GET all defects → V2 returns identical array as legacy (with same filter support)
- [ ] GET CoC defects → V2 returns identical filtered results
- [ ] GET defect count → V2 returns identical count
- [ ] GET defect by ID → V2 returns identical object
- [ ] POST create defect → V2 generates identical defect number, returns 201
- [ ] PATCH update defect → V2 updates identically
- [ ] DELETE defect → V2 deletes identically
- [ ] Auto-numbering: sequence integrity maintained under concurrent creation
- [ ] Legacy routes remain completely unaffected

### Phase 2 — Actions + Attachments + Workflow (Backend Only) — 10 routes

**Goal:** Add V2 routes for defect actions CRUD, attachments CRUD, and workflow operations (notes, linking, closure).

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 2.1 | Implement `defectActionRepository.ts` + `defectActionService.ts` + `defectActionController.ts` | 3 new files | None |
| 2.2 | Implement `defectAttachmentRepository.ts` + `defectAttachmentService.ts` + `defectAttachmentController.ts` | 3 new files | None |
| 2.3 | Implement `defectWorkflowService.ts` + `defectWorkflowController.ts` (notes, linking, closure) | 2 new files | None |
| 2.4 | Register all action, attachment, and workflow routes | `routes.ts` update | None |

**Validation:**
- [ ] Defect actions CRUD works identically (create, read, update, delete)
- [ ] Defect attachments CRUD works identically (upload, list, delete)
- [ ] Add note → JSONB array append-only behavior preserved exactly
- [ ] Link defects → bidirectional linking preserved exactly
- [ ] Close defect → closure workflow produces identical state transitions
- [ ] Response shapes match legacy exactly for all 10 endpoints

### Phase 3 — Reports + Admin (Categories/Types) (Backend Only) — 9 routes

**Goal:** Add V2 routes for defect report generation and defect category/type admin CRUD.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 3.1 | Implement `defectReportService.ts` + `defectReportController.ts` | 2 new files | None |
| 3.2 | Implement `defectAdminRepository.ts` + `defectAdminService.ts` + `defectAdminController.ts` | 3 new files | None |
| 3.3 | Register all report and admin routes | `routes.ts` update | None |

**Validation:**
- [ ] All report keys produce identical report output via V2
- [ ] Defect categories CRUD works identically
- [ ] Defect types CRUD works identically
- [ ] Error cases return same status codes and error messages

### Phase 4 — Recurring Defects (Backend Only) — 4 routes

**Goal:** Add V2 routes for recurring defect listing, detail, linked defects, and recalculation.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 4.1 | Implement `recurringDefectRepository.ts` + `recurringDefectService.ts` + `recurringDefectController.ts` | 3 new files | None |
| 4.2 | Register all recurring defect routes | `routes.ts` update | None |

**Validation:**
- [ ] List recurring defects with filters → identical results
- [ ] Get recurring defect by ID → identical object
- [ ] Get linked defects → identical array
- [ ] Recalculate all → identical MTBF values and pattern detection
- [ ] Response shapes match legacy exactly

### Phase 5 — Frontend Integration & Toggle — 13 pages

**Goal:** Create frontend API abstraction, hooks, and toggle for all defect entities.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 5.1 | Create all API files (`defectApi.ts`, `defectActionApi.ts`, `defectAttachmentApi.ts`, `recurringDefectApi.ts`, `defectAdminApi.ts`) | 5 new files | None |
| 5.2 | Create hook file (`useDefectApi.ts`) | 1 new file | None |
| 5.3 | Create `DefectsApiToggle.tsx` toggle UI | New file | None |
| 5.4 | Add toggle to Defects page header | `DefectsLogWithTabs.tsx` — minimal change | Low |
| 5.5 | Replace inline API calls with V2 hooks (toggle-aware) in all 13 pages | Multiple defect pages | Medium |
| 5.6 | Test toggle switching between legacy and V2 | Manual test | None |

**Validation:**
- [ ] Toggle defaults to "Legacy" mode
- [ ] Switching to V2 mode: all defect data loads correctly
- [ ] Switching back to Legacy mode: all defect data loads correctly
- [ ] No visual differences between modes
- [ ] All 13 pages work in both modes (forms, logs, dashboard, modals, reports)
- [ ] Defect creation wizard works identically in V2 mode
- [ ] Defect closure workflow works identically in V2 mode

---

## 12. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌───────────────┐                                               │
│  │ Defects Toggle │  localStorage: 'defects_api_version' = 'v2'|'legacy'│
│  └───────┬───────┘                                               │
│          │                                                       │
│          ▼                                                       │
│  ┌──────────────────────┐                                        │
│  │ defectApi             │  getMode() reads toggle               │
│  │ defectActionApi       │                                       │
│  │ defectAttachmentApi   │                                       │
│  │ recurringDefectApi    │                                       │
│  │ defectAdminApi        │                                       │
│  └──────┬───────────────┘                                        │
│         │                                                        │
│    ┌────┴────┐                                                   │
│    │         │                                                   │
│    ▼         ▼                                                   │
│  Legacy    V2 URLs                                               │
│  URLs      /technical/api/v2/defects/*                           │
│  /technical/api/defects/*                                        │
│  /technical/api/defect-categories/*                              │
│  /technical/api/defect-types/*                                   │
│  /technical/api/recurring-defects/*                              │
└────┬─────────┬───────────────────────────────────────────────────┘
     │         │
     ▼         ▼
┌────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  Legacy Handlers           V2 Handlers                           │
│  (routes.ts                (v2/defects/routes.ts)               │
│   L5734-L6507,             Controller → Service → Repository   │
│   L11238-L11307)                    │                            │
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
│           │  defect_*      │  ← defect tables, shared by both   │
│           │  tables        │                                     │
│           └────────────────┘                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Risk Points & Rollback Strategy

### 13.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Auto-numbering sequence integrity | High | Test concurrent creation, verify sequence gaps. V2 must use the same `generateDefectNumber()` utility — no reimplementation. |
| Closure workflow side effects | High | Preserve exact field updates and status transitions. Line-by-line comparison of legacy closure handler vs V2 service. |
| Recurring defect MTBF calculation | High | Compare outputs for identical input data. Run both legacy and V2 recalculation and diff results. |
| Multi-report handler (:reportKey) | Medium | Map all report keys to V2 equivalents. Enumerate all valid reportKey values and test each. |
| CoC filtering edge cases | Medium | Test with mixed CoC/non-CoC data. Verify `isCoC` flag is correctly applied in all filter combinations. |
| Notes JSONB array manipulation | Medium | Verify append-only behavior preserved. Test that existing notes are never mutated or deleted. |
| Defect linking bidirectionality | Medium | Verify linking A→B also reflects in B→A. Test with chain linking (A→B→C). |
| Target date extension workflow | Medium | Verify `extendedTargetDate` field updates and due/overdue calculation unchanged. |
| Test/admin endpoints (clear-all, seed) | Low | Include but gate behind admin auth. Ensure E2E seed data matches legacy exactly. |

### 13.2 Rollback Strategy

| Scenario | Action |
|----------|--------|
| V2 returns incorrect data | User clicks toggle → "Legacy" → instant fallback |
| V2 has performance issues | Toggle to Legacy → no restart needed |
| V2 causes data corruption | Not possible — same storage methods, same tables |
| Need to remove V2 entirely | Delete V2 files, remove route registration — zero impact on legacy |

---

## 14. Validation Checklist

### 14.1 Per-Entity Validation

For **each** defect entity (Defects, Actions, Attachments, Categories, Types, Recurring):
- [ ] GET all → V2 returns identical array as legacy
- [ ] GET by ID → V2 returns identical object as legacy
- [ ] POST create → V2 creates identical record, returns 201
- [ ] PATCH update → V2 updates identically, returns same shape
- [ ] DELETE → V2 deletes identically, returns `{ success: true }`
- [ ] Error cases → V2 returns same status codes and error messages

### 14.2 Defect-Specific Validation

- [ ] Auto-numbering: `DEF-V001-2024-0001` format preserved exactly
- [ ] Auto-numbering: concurrent creation does not produce sequence gaps or duplicates
- [ ] Vessel isolation: defect queries always filtered by vesselId
- [ ] CoC endpoint: returns only defects with `isCoC: true`
- [ ] Status views: `active` vs `resolved` filtering works identically
- [ ] Due/overdue filtering: `dueOverdue` parameter produces identical results
- [ ] Search: full-text search returns identical results

### 14.3 Workflow Validation

- [ ] Closure workflow: sets status, closedBy, closureComment, closureFiles, closedDate atomically
- [ ] Notes: JSONB append-only — new notes added, existing notes never modified
- [ ] Linking: bidirectional linking preserved — linking A→B updates both A and B
- [ ] Linking: deduplication — no duplicate links

### 14.4 Report Validation

- [ ] All report keys produce identical output via V2
- [ ] Excel/PDF formatting matches legacy exactly
- [ ] Report data aggregation matches legacy exactly

### 14.5 Recurring Defects Validation

- [ ] MTBF calculation produces identical values
- [ ] Pattern detection identifies same recurring patterns
- [ ] Recalculate all produces identical results
- [ ] Linked defects list matches legacy exactly

### 14.6 Admin Validation

- [ ] Defect categories CRUD works identically
- [ ] Defect types CRUD works identically
- [ ] Sort order preserved

### 14.7 Frontend Validation

- [ ] Toggle defaults to Legacy
- [ ] All 13 pages work in Legacy mode (unchanged)
- [ ] All 13 pages work in V2 mode (identical behavior)
- [ ] Toggle switch causes no data loss
- [ ] No visual differences between modes
- [ ] DefectFormExact (structured form) works identically in both modes
- [ ] DefectFormWizard (step-by-step) works identically in both modes
- [ ] DefectsLogWithTabs works identically in both modes
- [ ] DefectsCoC works identically in both modes
- [ ] DefectsDashboard works identically in both modes
- [ ] DefectsReports works identically in both modes
- [ ] Modal dialogs (DefectModal, LinkDefectsModal, AddNoteModal, DefectsListModal) work identically

---

## Appendix A: Key Business Logic Locations

### A.1 Auto-Numbering (routes.ts L5846–L5873)

```
1. Import generateDefectNumber from server/utils/defectNumbering
2. generateDefectNumber(vesselId) → atomically increments defectSequences table
3. Format: DEF-{vesselSequence}-{2-digit-year}-{4-digit-sequence}
4. Example: DEF-V001-24-0001, DEF-V001-24-0002
5. V2 MUST use the same utility function — no reimplementation
```

### A.2 Closure Workflow (routes.ts L6077–L6109)

```
1. storage.closeDefect(id, { closedBy, closureComment, closureFiles })
2. Sets: status = 'Closed', closedDate = new Date(), closedBy, closureComment, closureFiles
3. V2 MUST preserve exact same field updates
4. V2 MUST NOT auto-close linked defects
```

### A.3 Notes System (routes.ts L6037–L6059)

```
1. storage.addDefectNote(id, { noteText, attachments, createdBy })
2. Appends to JSONB notes array: { noteText, attachments, createdBy, createdAt }
3. Append-only — no mutation or deletion of existing notes
4. V2 MUST preserve append-only behavior
```

### A.4 Recurring Defect Calculation (routes.ts L11238–L11307)

```
1. storage.getRecurringDefects(filters) — filters: windowMonths, minOccurrences, hasCoc, equipmentKey
2. storage.recalculateAllRecurringDefects() — scans all defects, updates patterns
3. MTBF (Mean Time Between Failures) calculation
4. Links individual defects to patterns via recurring_defect_links table
5. V2 MUST produce identical MTBF values and pattern detection
```

---

## Appendix B: Comparison with Fleet Module V2 Plan

| Aspect | Fleet V2 | Defects V2 |
|--------|----------|------------|
| Toggle key | `fleet_api_version` | `defects_api_version` |
| Inline business logic complexity | Medium (field sanitization, auto-code, delete guards) | High (auto-numbering, closure workflow, MTBF calculation, notes JSONB) |
| Number of entities | 12+ entities | 7 entity groups (defects, actions, attachments, workflow, reports, admin, recurring) |
| Route handlers (legacy) | 78 | 37 |
| Storage methods | 50+ | 47+ |
| Frontend pages affected | 11+ fleet admin pages | 13 defect pages |
| Sub-router | `fleetAdmin.ts` (1,155 lines) | None (all in routes.ts) |
| Excel export/reports | 3 exports | Multi-report handler (1 endpoint, multiple report types) |
| Bulk upload | 3 (fleet components, jobs, spares) | None |
| Complex workflow | Copy Vessel (complex multi-table) | Closure workflow, Notes JSONB, Defect Linking |
| Database tables | 10+ fleet tables | 8 defect tables |
| Auto-numbering | None | defectSequences table for vessel/year-based numbering |
| Recurring pattern detection | None | MTBF calculation across equipment/time windows |

---

## Appendix C: Route Inventory Checklist (37/37 Verified)

### routes.ts — Core Defects (L5734–L5935) — 12 handlers

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 1 | 5734 | GET | `/defects` | `defectController.getAll` | YES |
| 2 | 5760 | GET | `/defects/coc` | `defectController.getCoCDefects` | YES |
| 3 | 5782 | GET | `/defects/recurring` | `recurringDefectController.getAll` (shortcut) | YES |
| 4 | 5799 | GET | `/defects/count` | `defectController.getCount` | YES |
| 5 | 5823 | GET | `/defects/count/recurring` | `recurringDefectController.getCount` | YES |
| 6 | 5833 | GET | `/defects/:id` | `defectController.getById` | YES |
| 7 | 5846 | POST | `/defects` | `defectController.create` | YES |
| 8 | 5875 | PATCH | `/defects/:id` | `defectController.update` | YES |
| 9 | 5893 | DELETE | `/defects/:id` | `defectController.delete` | YES |
| 10 | 5906 | DELETE | `/defects-clear-all` | `defectAdminController.clearAll` | YES |
| 11 | 5914 | POST | `/defects-seed-e2e-test` | `defectAdminController.seedE2E` | YES |
| 12 | 5922 | GET | `/defects-count` | `defectController.getAltCount` | YES |

### routes.ts — Defect Actions (L5937–L5993) — 4 handlers

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 13 | 5937 | GET | `/defects/:defectId/actions` | `defectActionController.getAll` | YES |
| 14 | 5947 | POST | `/defects/:defectId/actions` | `defectActionController.create` | YES |
| 15 | 5965 | PATCH | `/defects/actions/:actionId` | `defectActionController.update` | YES |
| 16 | 5983 | DELETE | `/defects/actions/:actionId` | `defectActionController.delete` | YES |

### routes.ts — Defect Attachments (L5996–L6035) — 3 handlers

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 17 | 5996 | GET | `/defects/:defectId/attachments` | `defectAttachmentController.getAll` | YES |
| 18 | 6006 | POST | `/defects/:defectId/attachments` | `defectAttachmentController.upload` | YES |
| 19 | 6024 | DELETE | `/defects/attachments/:attachmentId` | `defectAttachmentController.delete` | YES |

### routes.ts — Defect Workflow (L6037–L6109) — 3 handlers

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 20 | 6037 | POST | `/defects/:id/notes` | `defectWorkflowController.addNote` | YES |
| 21 | 6061 | PATCH | `/defects/:id/link` | `defectWorkflowController.linkDefects` | YES |
| 22 | 6077 | PATCH | `/defects/:id/close` | `defectWorkflowController.closeDefect` | YES |

### routes.ts — Defect Reports (L6111–L6336) — 1 handler

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 23 | 6111 | POST | `/defects/reports/:reportKey` | `defectReportController.generateReport` | YES |

### routes.ts — Defect Admin (L6338–L6507) — 8 handlers

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 24 | 6338 | GET | `/defect-categories` | `defectAdminController.getCategories` | YES |
| 25 | 6350 | POST | `/defect-categories` | `defectAdminController.createCategory` | YES |
| 26 | 6376 | PATCH | `/defect-categories/:id` | `defectAdminController.updateCategory` | YES |
| 27 | 6413 | DELETE | `/defect-categories/:id` | `defectAdminController.deleteCategory` | YES |
| 28 | 6432 | GET | `/defect-types` | `defectAdminController.getTypes` | YES |
| 29 | 6444 | POST | `/defect-types` | `defectAdminController.createType` | YES |
| 30 | 6470 | PATCH | `/defect-types/:id` | `defectAdminController.updateType` | YES |
| 31 | 6507 | DELETE | `/defect-types/:id` | `defectAdminController.deleteType` | YES |

### routes.ts — Recurring Defects (L11238–L11307) — 4 handlers

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 32 | 11238 | GET | `/recurring-defects` | `recurringDefectController.getAll` | YES |
| 33 | 11282 | GET | `/recurring-defects/:id` | `recurringDefectController.getById` | YES |
| 34 | 11296 | GET | `/recurring-defects/:id/defects` | `recurringDefectController.getLinkedDefects` | YES |
| 35 | 11307 | POST | `/recurring-defects/recalculate` | `recurringDefectController.recalculate` | YES |

### Test/Admin Endpoints (counted in Core section above)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 36 | 5906 | DELETE | `/defects-clear-all` | `defectAdminController.clearAll` | YES |
| 37 | 5914 | POST | `/defects-seed-e2e-test` | `defectAdminController.seedE2E` | YES |

**TOTAL: 37/37 route handlers verified and mapped to V2 targets.**

---

## Appendix D: Schema Table Quick Reference

| Table | Columns | Purpose | Key Relationships |
|-------|---------|---------|-------------------|
| `defect_sequences` | 4 | Auto-increment sequences per vessel/year | vesselId → vessels |
| `defects` | ~50 | Main defects table | vesselId → vessels, recurringDefectId → recurring_defects |
| `defect_actions` | ~15 | Corrective actions for defects | defectId → defects |
| `defect_attachments` | ~10 | File attachments for defects | defectId → defects |
| `recurring_defects` | ~15 | Recurring defect patterns (MTBF) | standalone |
| `recurring_defect_links` | ~5 | Links recurring patterns ↔ individual defects | recurringDefectId → recurring_defects, defectId → defects |
| `defect_categories` | ~5 | Defect category definitions | standalone |
| `defect_types` | ~5 | Defect type definitions | standalone |

---

## Appendix E: Frontend Page Impact Matrix

| Page | Lines | V2 API Files Used | Toggle Impact | Risk |
|------|-------|-------------------|---------------|------|
| DefectFormExact.tsx | 1,841 | defectApi, defectActionApi, defectAttachmentApi | High — core form | Medium |
| DefectFormWizard.tsx | 2,195 | defectApi | High — creation wizard | Medium |
| DefectsLogWithTabs.tsx | 1,047 | defectApi | Medium — toggle host | Low |
| DefectsLog.tsx | 788 | defectApi | Medium — list view | Low |
| DefectsCoC.tsx | 880 | defectApi | Medium — CoC filtering | Low |
| DefectsDashboard.tsx | 619 | defectApi | Medium — dashboard counts | Low |
| DefectsActive.tsx | 578 | defectApi | Medium — active filter | Low |
| DefectsReports.tsx | 419 | defectApi | Medium — report generation | Medium |
| DefectsResolved.tsx | 323 | defectApi | Low — resolved filter | Low |
| DefectsListModal.tsx | 288 | defectApi | Low — selection modal | Low |
| LinkDefectsModal.tsx | 261 | defectApi | Low — linking modal | Low |
| AddNoteModal.tsx | 235 | defectApi | Low — note modal | Low |
| DefectModal.tsx | 110 | defectApi | Low — detail modal | Low |
