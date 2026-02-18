# V2 Modular Architecture Plan — Modify PMS / Change Requests Module

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) Change Requests module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: All Change Request entities — Change Requests (core CRUD, status transitions, approval/rejection workflow, apply approved changes), Change Request Attachments, Change Request Comments, Target Entity Resolution, Field Definitions, and Status Tracking Reports.

**Critical Constraint**: The V2 architecture must use 100% the same business rules, validations, calculations, and workflows as legacy. This initiative is purely an architectural re-organization, not a functional rewrite.

**Companion Document**: This plan follows the exact same conventions established in `V2-Fleet-Module-Refactor-Plan.md` (Fleet Module V2) and `V2-Component-Module-Refactor-Plan.md` (Component Module V2). All plans share identical layer rules, toggle mechanism, and enforcement policies.

---

## Canonical V2 API Prefix

All V2 change request endpoints use these canonical base paths:

```
/technical/api/v2/change-requests/field-definitions   ← Field definitions helper
/technical/api/v2/change-requests/target-entity        ← Target entity resolution helper
/technical/api/v2/change-requests/request              ← Change Requests entity (core CRUD + workflow)
/technical/api/v2/change-requests/report               ← Status tracking reports
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/change-requests/` — module name
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
| `server/routes/changeRequests.ts` | 319 | Change Requests sub-router (12 route handlers) | Clean sub-router, but inline business logic mixed with HTTP handling |
| `server/routes.ts` | 20,231 | ALL route handlers including 2 change request report handlers (L10906, L11073) | Monolithic — report routes for change requests embedded in massive file |
| `server/postgresStorage.ts` | 7,111+ | ALL database queries including change request storage methods | Monolithic — change request queries mixed with every other query |
| `server/storage.ts` | 933 | Storage interface definition | 25 change request methods in a shared interface (L391–L410) |
| `shared/schema.ts` | 2,825+ | ALL Drizzle schema definitions | Change request tables (L645–L728) alongside all other tables |
| `shared/changeRequestFields.ts` | varies | Field definitions per target type (shared module) | Well-isolated — no changes needed for V2 |
| `client/src/pages/pms/ModifyPMS.tsx` | 1,153 | Main Modify PMS interface | Inline API calls via `useQuery`, no API abstraction layer |
| `client/src/pages/modify-pms/JobsSelector.tsx` | 207 | Job selection component for targeting | Inline API calls |
| `client/src/pages/change-requests/ChangeRequestFormExact.tsx` | 914 | Detailed change request form with field-level diff | Inline API calls |
| `client/src/pages/change-requests/EditChangeRequestModal.tsx` | 477 | Edit dialog for existing change requests | Inline API calls |
| `client/src/pages/change-requests/ViewChangeRequestModal.tsx` | 548 | Read-only view of change request with diff display | Inline API calls |
| `client/src/pages/change-requests/ApproveRejectModal.tsx` | 353 | Approval/rejection dialog with comment | Inline API calls |
| `client/src/pages/change-requests/AddCommentModal.tsx` | 127 | Comment addition dialog | Inline API calls |

### 1.2 Change Request Route Inventory (Legacy)

#### 1.2.1 Change Requests Sub-Router — server/routes/changeRequests.ts (319 lines)

| Line | Method | Path (under `/technical/api/change-requests/`) | Purpose | Storage Method |
|------|--------|------------------------------------------------|---------|----------------|
| 11 | GET | `/field-definitions/:targetType` | Get field definitions for component/job/work_order/spare/store | `getFieldDefinitions()` from `shared/changeRequestFields` |
| 33 | GET | `/target-entity/:targetType/:targetId` | Get target entity data (populates oldValue / snapshotBeforeJson) | `storage.getComponent/getJob/getWorkOrder/getSpare/getStoresItem` |
| 89 | GET | `/` | List change requests with filters (category, status, q, vesselId) | `storage.getChangeRequests(filters)` |
| 126 | GET | `/:id` | Get change request by ID | `storage.getChangeRequest(id)` |
| 143 | POST | `/` | Create change request | `storage.createChangeRequest(data)` |
| 172 | PATCH | `/:id/status` | Update change request status | `storage.updateChangeRequest(id, data)` |
| 194 | GET | `/:id/comments` | Get comments for change request | `storage.getChangeRequestComments(id)` |
| 206 | POST | `/:id/comments` | Add comment to change request | `storage.createChangeRequestComment(data)` |
| 227 | GET | `/:id/attachments` | Get attachments for change request | `storage.getChangeRequestAttachments(id)` |
| 239 | POST | `/:id/attachments` | Upload attachment to change request | `storage.createChangeRequestAttachment(data)` |
| 260 | PUT | `/:id/approve` | Approve change request | `storage.approveChangeRequest(id, reviewerId, comment)` |
| 295 | PUT | `/:id/reject` | Reject change request | `storage.rejectChangeRequest(id, reviewerId, comment)` |

#### 1.2.2 Report Handlers — server/routes.ts

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 10906 | GET | `/technical/api/reports/change-requests-status-tracking` | Get change request tracking data with vessel aggregation | `storage.getChangeRequests(filters)` per vessel |
| 11073 | GET | `/technical/api/reports/change-requests-status-tracking/export` | Export change request tracking to Excel | Fetches data internally + `exceljs` |

**Mounted at:**
```typescript
// server/routes.ts L10898-10900
const changeRequestsRouter = createChangeRequestsRouter(storage);
app.use("/technical/api/change-requests", changeRequestsRouter);
```

**Total Legacy Change Request Routes: 14 route handlers** (12 in changeRequests.ts + 2 in routes.ts)

### 1.3 Storage Interface Methods (Change Request-Related)

From `server/storage.ts` (L391–L410), the change request-related interface methods (25 methods):

**Core CRUD:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getChangeRequests(filters?)` | `ChangeRequest[]` | changeRequests.ts L89, routes.ts L10906 |
| `getChangeRequest(id)` | `ChangeRequest \| undefined` | changeRequests.ts L126, L260 |
| `createChangeRequest(request)` | `ChangeRequest` | changeRequests.ts L143 |
| `updateChangeRequest(id, data)` | `ChangeRequest` | changeRequests.ts L172 |
| `deleteChangeRequest(id)` | `void` | Not exposed via route (internal use) |

**Status Transitions:**
| Method | Returns | Used By |
|--------|---------|---------|
| `submitChangeRequest(id, userId)` | `ChangeRequest` | Frontend workflow |
| `approveChangeRequest(id, reviewerId, comment)` | `ChangeRequest` | changeRequests.ts L260 |
| `rejectChangeRequest(id, reviewerId, comment)` | `ChangeRequest` | changeRequests.ts L295 |
| `returnChangeRequest(id, reviewerId, comment)` | `ChangeRequest` | Frontend workflow |

**Target & Proposed Changes:**
| Method | Returns | Used By |
|--------|---------|---------|
| `updateChangeRequestTarget(id, targetType, targetId, snapshotBeforeJson)` | `ChangeRequest` | Frontend workflow |
| `updateChangeRequestProposed(id, proposedChangesJson, movePreviewJson?)` | `ChangeRequest` | Frontend workflow |

**Apply Changes:**
| Method | Returns | Used By |
|--------|---------|---------|
| `applyApprovedChanges(changeRequest)` | `{ appliedFieldCount: number }` | Approval workflow (atomic cross-entity mutation) |

**Attachments:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getChangeRequestAttachments(changeRequestId)` | `ChangeRequestAttachment[]` | changeRequests.ts L227 |
| `createChangeRequestAttachment(attachment)` | `ChangeRequestAttachment` | changeRequests.ts L239 |

**Comments:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getChangeRequestComments(changeRequestId)` | `ChangeRequestComment[]` | changeRequests.ts L194 |
| `createChangeRequestComment(comment)` | `ChangeRequestComment` | changeRequests.ts L206 |

**Cross-Module Dependencies (Target Entity Resolution):**
| Method | Returns | Used By |
|--------|---------|---------|
| `storage.getComponent(id)` | `Component \| undefined` | changeRequests.ts L41 (targetType='component') |
| `storage.getJob(id)` | `Job \| undefined` | changeRequests.ts L44 (targetType='job') |
| `storage.getWorkOrder(id)` | `WorkOrder \| undefined` | changeRequests.ts L47 (targetType='work_order') |
| `storage.getSpare(id)` | `Spare \| undefined` | changeRequests.ts L50 (targetType='spare') |
| `storage.getStoresItem(id)` | `StoresItem \| undefined` | changeRequests.ts L53 (targetType='store') |

**Report Support:**
| Method | Returns | Used By |
|--------|---------|---------|
| `storage.getVessels()` | `Vessel[]` | routes.ts L10910 (report aggregation) |
| `storage.getChangeRequests(filters)` | `ChangeRequest[]` | routes.ts L10915 (per-vessel iteration) |

### 1.4 Current Schema (Change Request Tables)

From `shared/schema.ts`:

**`change_request` Table (L645):** ~20 columns
- Core: `id` (integer PK, auto-gen), `vesselId` (text, NOT NULL)
- Classification: `category` (text, NOT NULL — 'components' | 'work_orders' | 'spares' | 'stores'), `title` (text, NOT NULL, max 120 chars)
- Content: `reason` (text, NOT NULL), `targetType` (text — 'component' | 'work_order' | 'spare' | 'store'), `targetId` (text)
- JSON Data: `snapshotBeforeJson` (json), `proposedChangesJson` (json — array of change objects), `movePreviewJson` (json)
- Workflow: `status` (text, NOT NULL, default 'draft' — 'draft' | 'submitted' | 'returned' | 'approved' | 'rejected')
- User Tracking: `requestedByUserId` (text, NOT NULL), `submittedAt` (timestamp), `reviewedByUserId` (text), `reviewedAt` (timestamp)
- Revision Tracking: `revisionNumber` (integer, NOT NULL, default 0), `revisionHistory` (json — array of revision objects)
- Timestamps: `createdAt` (timestamp, NOT NULL), `updatedAt` (timestamp, NOT NULL, auto-update)
- Indexes: `idx_vessel_category` (vesselId + category), `idx_change_request_status` (status)

**`change_request_attachment` Table (L692):** ~6 columns
- Core: `id` (integer PK, auto-gen), `changeRequestId` (integer, NOT NULL, FK)
- File: `filename` (text, NOT NULL), `url` (text, NOT NULL)
- User: `uploadedByUserId` (text, NOT NULL), `uploadedAt` (timestamp, NOT NULL)
- Index: `idx_change_request` (changeRequestId)

**`change_request_comment` Table (L712):** ~5 columns
- Core: `id` (integer PK, auto-gen), `changeRequestId` (integer, NOT NULL, FK)
- Content: `userId` (text, NOT NULL), `message` (text, NOT NULL)
- Timestamps: `createdAt` (timestamp, NOT NULL)
- Index: `idx_change_request_comment` (changeRequestId)

### 1.5 Key Business Logic in Route Handlers

The Change Requests module has **high-complexity business logic** centered around the approval workflow, cross-entity mutations, and status state machine:

**Status State Machine (changeRequests.ts + storage methods):**
```
Draft → Submitted → Under Review → Approved → Applied
                  ↘ Rejected
                  ↘ Returned → (back to Draft)
```
Valid transitions are enforced by the storage methods (`submitChangeRequest`, `approveChangeRequest`, `rejectChangeRequest`, `returnChangeRequest`). Invalid transitions are rejected.

**Target Entity Resolution (changeRequests.ts L33–L86):**
1. Accepts `targetType` (component | job | work_order | spare | store) and `targetId`
2. Calls the appropriate storage method per target type (switch statement)
3. Retrieves the entity and builds a `fieldValues` map using `getFieldDefinitions()`
4. Returns the entity, field values, and metadata for the frontend diff display

**Approval Workflow (changeRequests.ts L260–L292):**
1. Validates comment is required for approval
2. Retrieves the existing change request to log its details
3. Calls `storage.approveChangeRequest(id, reviewerId, comment)`
4. The storage method internally calls `applyApprovedChanges()` which performs an atomic cross-entity mutation

**Apply Approved Changes — Cross-Entity Mutation (storage method):**
1. Reads `proposedChangesJson` from the change request
2. Based on `targetType`, updates the correct entity table:
   - `targetType='component'` → updates `components` table
   - `targetType='job'` → updates `jobs` table
   - `targetType='work_order'` → updates `work_orders` table
   - `targetType='spare'` → updates `spares` table
   - `targetType='store'` → updates `stores_items` table
3. This is an **atomic database transaction** — all or nothing
4. Sets the change request status to "applied"
5. Updates `revisionNumber` and appends to `revisionHistory`
6. Returns `{ appliedFieldCount: number }`

**Proposed Changes JSON Structure:**
```json
[
  {
    "fieldName": "name",
    "oldValue": "Old Component Name",
    "newValue": "New Component Name",
    "label": "Component Name"
  }
]
```

**Report Aggregation (routes.ts L10906–L11072):**
1. Fetches all vessels
2. If `vesselId` is specified, fetches change requests for that vessel only
3. Otherwise, iterates over ALL vessels, fetching change requests per vessel
4. Applies date range, status, and category filters
5. Aggregates counts by status and calculates aging metrics
6. Returns structured report data with vessel-level breakdowns

**Vessel-Wise Data Isolation (changeRequests.ts L89–L96):**
- `vesselId` is **mandatory** for listing change requests (returns 400 if missing)
- All change request operations are scoped to a vessel

### 1.6 Shared Module: changeRequestFields.ts

Located at `shared/changeRequestFields.ts`, this defines:
- Field definitions per target type (component, job, work_order, spare, store)
- Editable field lists per target type
- Field metadata (displayName, columnName, type, editable flag, validation rules)
- Used by **both frontend and backend** — V2 will re-use this module directly (no duplication)

---

## 2. V2 Folder Structure

```
server/v2/change-requests/
├── index.ts                                    # Module entry point — wires dependencies
├── routes.ts                                   # Route definitions (paths → controller methods)
├── types.ts                                    # V2-specific types (request/response shapes)
├── repositories/
│   ├── changeRequestRepository.ts              # DB operations for change_request table
│   ├── changeRequestAttachmentRepository.ts    # DB operations for change_request_attachment table
│   └── changeRequestCommentRepository.ts       # DB operations for change_request_comment table
├── services/
│   ├── changeRequestService.ts                 # Core CRUD + status transitions + filtering
│   ├── changeRequestWorkflowService.ts         # Approve/reject/return/apply logic
│   ├── targetEntityService.ts                  # Target entity resolution + field values
│   └── changeRequestReportService.ts           # Status tracking report + Excel export
└── controllers/
    ├── changeRequestController.ts              # HTTP layer for core CRUD + status
    ├── changeRequestAttachmentController.ts    # HTTP layer for attachments
    ├── changeRequestCommentController.ts       # HTTP layer for comments
    ├── changeRequestWorkflowController.ts      # HTTP layer for approve/reject/return
    └── changeRequestReportController.ts        # HTTP layer for reports

shared/v2/change-requests/
└── types.ts                                    # Re-exports from shared/changeRequestFields.ts

client/src/modules/change-requests/
├── api/
│   ├── changeRequestApi.ts                     # Toggle-aware API for core CRUD + workflow
│   ├── changeRequestAttachmentApi.ts           # Toggle-aware API for attachments
│   └── changeRequestCommentApi.ts              # Toggle-aware API for comments
└── hooks/
    └── useChangeRequestApi.ts                  # React hooks consuming API files
```

---

## 3. Layer Mapping: Current → V2

### 3.1 Change Request Core CRUD

| Current Location | Current Responsibility | V2 Layer | V2 File |
|-----------------|----------------------|----------|---------|
| `changeRequests.ts` L89–L123 | GET `/` — list with filters | Controller → Service → Repository | `changeRequestController.ts` → `changeRequestService.ts` → `changeRequestRepository.ts` |
| `changeRequests.ts` L126–L140 | GET `/:id` — get by ID | Controller → Service → Repository | Same chain |
| `changeRequests.ts` L143–L169 | POST `/` — create | Controller → Service → Repository | Same chain |
| `changeRequests.ts` L172–L191 | PATCH `/:id/status` — update status | Controller → Service → Repository | Same chain |
| `storage.ts` L397 | `deleteChangeRequest(id)` | Service → Repository | `changeRequestService.ts` → `changeRequestRepository.ts` |

### 3.2 Change Request Workflow (Approve/Reject/Return/Apply)

| Current Location | Current Responsibility | V2 Layer | V2 File |
|-----------------|----------------------|----------|---------|
| `changeRequests.ts` L260–L292 | PUT `/:id/approve` — approve | Controller → Service → Repository | `changeRequestWorkflowController.ts` → `changeRequestWorkflowService.ts` |
| `changeRequests.ts` L295–L317 | PUT `/:id/reject` — reject | Controller → Service → Repository | Same chain |
| `storage.ts` L398–L401 | `submitChangeRequest`, `returnChangeRequest` | Service → Repository | `changeRequestWorkflowService.ts` → `changeRequestRepository.ts` |
| `storage.ts` L402 | `applyApprovedChanges(changeRequest)` | Service → Repository | `changeRequestWorkflowService.ts` (cross-entity mutation) |

### 3.3 Target Entity Resolution

| Current Location | Current Responsibility | V2 Layer | V2 File |
|-----------------|----------------------|----------|---------|
| `changeRequests.ts` L11–L30 | GET `/field-definitions/:targetType` | Controller → Service | `changeRequestController.ts` → re-uses `shared/changeRequestFields.ts` |
| `changeRequests.ts` L33–L86 | GET `/target-entity/:targetType/:targetId` | Controller → Service → Repository | `changeRequestController.ts` → `targetEntityService.ts` |

### 3.4 Attachments & Comments

| Current Location | Current Responsibility | V2 Layer | V2 File |
|-----------------|----------------------|----------|---------|
| `changeRequests.ts` L194–L203 | GET `/:id/comments` | Controller → Service → Repository | `changeRequestCommentController.ts` → `changeRequestService.ts` → `changeRequestCommentRepository.ts` |
| `changeRequests.ts` L206–L224 | POST `/:id/comments` | Controller → Service → Repository | Same chain |
| `changeRequests.ts` L227–L236 | GET `/:id/attachments` | Controller → Service → Repository | `changeRequestAttachmentController.ts` → `changeRequestService.ts` → `changeRequestAttachmentRepository.ts` |
| `changeRequests.ts` L239–L257 | POST `/:id/attachments` | Controller → Service → Repository | Same chain |

### 3.5 Reports

| Current Location | Current Responsibility | V2 Layer | V2 File |
|-----------------|----------------------|----------|---------|
| `routes.ts` L10906–L11072 | GET `/reports/change-requests-status-tracking` | Controller → Service → Repository | `changeRequestReportController.ts` → `changeRequestReportService.ts` |
| `routes.ts` L11073+ | GET `/reports/change-requests-status-tracking/export` | Controller → Service | Same chain (Excel generation) |

---

## 4. Repository Layer Rules

### 4.1 Rules

| Rule | Detail |
|------|--------|
| **Only layer that touches storage** | Repository methods call `storage.*()` methods — no other layer may import `storage` |
| **No business logic** | Pure data access — no status validation, no field transformation |
| **No HTTP awareness** | No `req`, `res`, `next` — receives plain typed arguments |
| **Returns domain types** | Returns `ChangeRequest`, `ChangeRequestAttachment`, `ChangeRequestComment`, etc. |
| **One repository per table** | `changeRequestRepository.ts`, `changeRequestAttachmentRepository.ts`, `changeRequestCommentRepository.ts` |

### 4.2 Repository Method Mapping

**changeRequestRepository.ts:**
```typescript
getAll(filters?: { category?: string; status?: string; q?: string; vesselId?: string }): Promise<ChangeRequest[]>
  → calls storage.getChangeRequests(filters)

getById(id: number): Promise<ChangeRequest | undefined>
  → calls storage.getChangeRequest(id)

create(data: InsertChangeRequest): Promise<ChangeRequest>
  → calls storage.createChangeRequest(data)

update(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest>
  → calls storage.updateChangeRequest(id, data)

delete(id: number): Promise<void>
  → calls storage.deleteChangeRequest(id)

submit(id: number, userId: string): Promise<ChangeRequest>
  → calls storage.submitChangeRequest(id, userId)

approve(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>
  → calls storage.approveChangeRequest(id, reviewerId, comment)

reject(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>
  → calls storage.rejectChangeRequest(id, reviewerId, comment)

return(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>
  → calls storage.returnChangeRequest(id, reviewerId, comment)

updateTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest>
  → calls storage.updateChangeRequestTarget(id, targetType, targetId, snapshotBeforeJson)

updateProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest>
  → calls storage.updateChangeRequestProposed(id, proposedChangesJson, movePreviewJson)

applyApprovedChanges(changeRequest: ChangeRequest): Promise<{ appliedFieldCount: number }>
  → calls storage.applyApprovedChanges(changeRequest)
```

**changeRequestAttachmentRepository.ts:**
```typescript
getByChangeRequestId(changeRequestId: number): Promise<ChangeRequestAttachment[]>
  → calls storage.getChangeRequestAttachments(changeRequestId)

create(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment>
  → calls storage.createChangeRequestAttachment(attachment)
```

**changeRequestCommentRepository.ts:**
```typescript
getByChangeRequestId(changeRequestId: number): Promise<ChangeRequestComment[]>
  → calls storage.getChangeRequestComments(changeRequestId)

create(comment: InsertChangeRequestComment): Promise<ChangeRequestComment>
  → calls storage.createChangeRequestComment(comment)
```

---

## 5. Service Layer Rules

### 5.1 Rules

| Rule | Detail |
|------|--------|
| **No HTTP awareness** | No `req`, `res`, `next` — receives plain typed arguments |
| **No storage imports** | Only uses injected repository instances |
| **Contains business logic** | Status validation, transition checks, filtering, sorting |
| **Throws typed errors** | Throws custom error types (e.g., `NotFoundError`, `ValidationError`) |
| **One service per concern** | Core CRUD, workflow, target entity, reports |

### 5.2 Service Method Mapping

**changeRequestService.ts:**
- `listChangeRequests(filters)` — fetches, filters (category, status, requestedBy), sorts by most recent first
- `getChangeRequestById(id)` — fetches, throws `NotFoundError` if not found
- `createChangeRequest(data)` — validates vesselId is present, sets defaults (status='draft', requestedByUserId fallback)
- `updateChangeRequestStatus(id, status, reviewedByUserId)` — validates status is valid enum, calls repository
- `deleteChangeRequest(id)` — calls repository

**changeRequestWorkflowService.ts:**
- `approveChangeRequest(id, reviewerId, comment)` — validates comment required, retrieves existing, calls repository approve
- `rejectChangeRequest(id, reviewerId, comment)` — validates comment required, calls repository reject
- `returnChangeRequest(id, reviewerId, comment)` — validates comment required, calls repository return
- `submitChangeRequest(id, userId)` — calls repository submit
- `applyApprovedChanges(id)` — retrieves change request, calls repository applyApprovedChanges (atomic cross-entity mutation)

**targetEntityService.ts:**
- `getFieldDefinitions(targetType, editableOnly?)` — validates target type, delegates to `shared/changeRequestFields.ts`
- `getTargetEntity(targetType, targetId)` — resolves entity from correct table based on target type, builds field values map

**changeRequestReportService.ts:**
- `getStatusTrackingReport(filters)` — fetches all vessels, iterates per vessel, aggregates change request data by status and aging
- `exportStatusTrackingReport(filters)` — generates Excel workbook using `exceljs`

---

## 6. Controller Layer Rules

### 6.1 Rules

| Rule | Detail |
|------|--------|
| **HTTP translation only** | Extract params/query/body from `req`, call service, map result to `res` |
| **No business logic** | No filtering, no validation beyond parsing |
| **Maps errors to HTTP status codes** | `NotFoundError` → 404, `ValidationError` → 400, `ZodError` → 400, generic → 500 |
| **One controller per concern** | Mirrors service structure |

### 6.2 Controller Method Mapping

**changeRequestController.ts:**
- `getFieldDefinitions(req, res)` — extracts `targetType` param, `editableOnly` query, calls service
- `getTargetEntity(req, res)` — extracts `targetType` + `targetId` params, calls service
- `list(req, res)` — extracts query filters, calls service
- `getById(req, res)` — extracts `id` param, calls service
- `create(req, res)` — extracts body, validates with Zod, calls service, returns 201
- `updateStatus(req, res)` — extracts `id` param + body, calls service

**changeRequestWorkflowController.ts:**
- `approve(req, res)` — extracts `id` param + body (comment, reviewerId), calls service
- `reject(req, res)` — extracts `id` param + body (comment, reviewerId), calls service

**changeRequestCommentController.ts:**
- `list(req, res)` — extracts `id` param (changeRequestId), calls service
- `create(req, res)` — extracts `id` param + body, validates with Zod, calls service, returns 201

**changeRequestAttachmentController.ts:**
- `list(req, res)` — extracts `id` param (changeRequestId), calls service
- `create(req, res)` — extracts `id` param + body, validates with Zod, calls service, returns 201

**changeRequestReportController.ts:**
- `getStatusTracking(req, res)` — extracts query filters, calls service
- `exportStatusTracking(req, res)` — extracts query filters, calls service, streams Excel file

---

## 7. RESTful Route Patterns

### 7.1 Naming Convention

| Element | Convention | Example |
|---------|-----------|---------|
| Module prefix | `/v2/{module}/` | `/v2/change-requests/` |
| Entity name | Singular noun | `/request` |
| Sub-resource | `/:id/{sub-resource}` | `/request/:id/comment` |
| Action | Verb for non-CRUD | `/request/:id/approve` |
| Report | `/report/{report-name}` | `/report/status-tracking` |

### 7.2 HTTP Method Usage

| Method | Usage | Example |
|--------|-------|---------|
| GET | Read / list | `GET /request` (list), `GET /request/:id` (detail) |
| POST | Create | `POST /request` (create), `POST /request/:id/comment` (add comment) |
| PATCH | Partial update | `PATCH /request/:id/status` (update status) |
| PUT | Full update / action | `PUT /request/:id/approve` (approve action) |
| DELETE | Not currently exposed | Reserved for future use |

### 7.3 Complete V2 Route Map

```
# Field Definitions (Helpers)
GET    /technical/api/v2/change-requests/field-definitions/:targetType
GET    /technical/api/v2/change-requests/target-entity/:targetType/:targetId

# Core CRUD
GET    /technical/api/v2/change-requests/request                 ← List with filters
GET    /technical/api/v2/change-requests/request/:id             ← Get by ID
POST   /technical/api/v2/change-requests/request                 ← Create
PATCH  /technical/api/v2/change-requests/request/:id/status      ← Update status

# Comments
GET    /technical/api/v2/change-requests/request/:id/comment     ← List comments
POST   /technical/api/v2/change-requests/request/:id/comment     ← Add comment

# Attachments
GET    /technical/api/v2/change-requests/request/:id/attachment  ← List attachments
POST   /technical/api/v2/change-requests/request/:id/attachment  ← Upload attachment

# Workflow (Approve/Reject)
PUT    /technical/api/v2/change-requests/request/:id/approve     ← Approve
PUT    /technical/api/v2/change-requests/request/:id/reject      ← Reject

# Reports (moved from routes.ts into change-requests module)
GET    /technical/api/v2/change-requests/report/status-tracking           ← Status tracking data
GET    /technical/api/v2/change-requests/report/status-tracking/export    ← Excel export
```

### 7.4 Route Response Contract Rule

**All V2 routes must return identical JSON shapes as legacy routes.** The same status codes, same error messages, same response structures.

### 7.5 Route Registration

```typescript
// server/v2/change-requests/index.ts — Module entry point
export function createChangeRequestsV2Router(): Router {
  // Wire up all dependencies (repositories → services → controllers)
  // Return combined router
}

// Registration in main app (additive only):
// app.use('/technical/api/v2/change-requests', changeRequestsV2Router);
```

---

## 8. Frontend API Layer Rules

### 8.1 Rules

| Rule | Detail |
|------|--------|
| **One API file per entity** | e.g., `changeRequestApi.ts`, `changeRequestAttachmentApi.ts`, `changeRequestCommentApi.ts` |
| **Toggle decides Legacy vs V2** | `getChangeRequestsApiBase()` reads `localStorage('change_requests_api_version')` |
| **No direct fetch calls in components** | Components consume hooks, hooks consume API file |
| **UI behavior must remain unchanged** | Same data shapes, same loading states, same error handling |

### 8.2 API File Pattern

```typescript
// client/src/modules/change-requests/api/changeRequestApi.ts

const getMode = () => localStorage.getItem('change_requests_api_version') || 'legacy';

export const changeRequestApi = {
  getAll: (filters: { vesselId: string; status?: string; category?: string }) => {
    const base = getMode() === 'v2'
      ? '/technical/api/v2/change-requests/request'
      : '/technical/api/change-requests';
    const params = new URLSearchParams(filters as any);
    return fetch(`${base}?${params}`).then(r => r.json());
  },
  getById: (id: number) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/change-requests/request/${id}`
      : `/technical/api/change-requests/${id}`;
    return fetch(url).then(r => r.json());
  },
  create: (data: any) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/change-requests/request'
      : '/technical/api/change-requests';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
  },
  approve: (id: number, data: { comment: string; reviewerId: string }) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/change-requests/request/${id}/approve`
      : `/technical/api/change-requests/${id}/approve`;
    return fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
  },
  // ... same pattern for reject, updateStatus, getFieldDefinitions, getTargetEntity
};
```

### 8.3 Toggle Key

**Storage:** `localStorage` key: `change_requests_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

This is a **separate toggle** from the Component module toggle (`pms_api_version`) and the Fleet module toggle (`fleet_api_version`), allowing independent rollout.

---

## 9. Toggle Mechanism

### 9.1 How Legacy and V2 Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (always registered):                      │
│    /technical/api/change-requests/*                       │
│    /technical/api/reports/change-requests-status-tracking │
│                                                          │
│  V2 Routes (always registered, additive):                │
│    /technical/api/v2/change-requests/request/*            │
│    /technical/api/v2/change-requests/field-definitions/*  │
│    /technical/api/v2/change-requests/target-entity/*      │
│    /technical/api/v2/change-requests/report/*             │
│                                                          │
│  BOTH route sets call the SAME storage methods:          │
│    storage.getChangeRequests()                           │
│    storage.getChangeRequest()                            │
│    storage.createChangeRequest()                         │
│    storage.approveChangeRequest()                        │
│    storage.applyApprovedChanges()                        │
│    etc.                                                  │
│                                                          │
│  ONE set of database tables:                              │
│    change_request, change_request_attachment,             │
│    change_request_comment                                │
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
| **No legacy code modification** | All V2 code in new files under `server/v2/change-requests/`, `shared/v2/change-requests/`, `client/src/modules/change-requests/` |
| **No cross-module coupling** | Change Requests V2 must not import from Component V2, Fleet V2, or other V2 modules |
| **Re-use shared module** | V2 must re-use `shared/changeRequestFields.ts` directly — no duplication of field definitions |

### 10.2 Layer Boundary Enforcement

| Rule | Layer |
|------|-------|
| **Repository: DB only** | Only layer that imports `storage`. No business logic. |
| **Service: logic only** | No HTTP objects. No `storage` import. |
| **Controller: HTTP only** | Extracts req data, calls service, maps errors to status codes. |
| **Routes: wiring only** | Maps HTTP methods + paths to controller methods. |

### 10.3 Cross-Entity Mutation Rule

The `applyApprovedChanges()` operation writes to entity tables (components, jobs, work_orders, spares, stores_items) outside the change request module. This cross-entity mutation is handled **within the storage layer** and must remain there. The V2 repository simply delegates to `storage.applyApprovedChanges()` — it does NOT attempt to directly write to other entity tables.

---

## 11. Phased Migration Plan

### Phase 1 — Core CRUD + Helpers (Backend Only)

**Goal:** Create V2 folder structure, repositories, services, and controllers for core change request CRUD and helper endpoints (field definitions, target entity resolution).

**Routes covered: 6**

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 1.1 | Create `server/v2/change-requests/` directory structure | New directories | None |
| 1.2 | Create `shared/v2/change-requests/types.ts` | New file | None |
| 1.3 | Create `types.ts` and `errors.ts` (shared error types) | New files | None |
| 1.4 | Implement `changeRequestRepository.ts` (core CRUD methods only) | New file | None |
| 1.5 | Implement `targetEntityService.ts` (field definitions + entity resolution) | New file | None |
| 1.6 | Implement `changeRequestService.ts` (list, getById, create, updateStatus) | New file | None |
| 1.7 | Implement `changeRequestController.ts` (6 handler methods) | New file | None |
| 1.8 | Create `routes.ts` with core CRUD + helper routes | New file | None |
| 1.9 | Create `index.ts` module entry point | New file | None |
| 1.10 | Register V2 change-requests routes in Express app | Additive to server startup | Low — additive only |

**Validation:**
- [ ] `GET /v2/change-requests/field-definitions/:targetType` returns identical field definitions as legacy
- [ ] `GET /v2/change-requests/target-entity/:targetType/:targetId` returns identical entity + fieldValues as legacy
- [ ] `GET /v2/change-requests/request?vesselId=...` returns identical list (same order, same filters) as legacy
- [ ] `GET /v2/change-requests/request/:id` returns identical object as legacy
- [ ] `POST /v2/change-requests/request` creates identical record, returns 201
- [ ] `PATCH /v2/change-requests/request/:id/status` updates status identically
- [ ] Error cases: returns same status codes (400 for missing vesselId, 404 for not found, 400 for invalid status)
- [ ] Legacy routes remain completely unaffected

### Phase 2 — Comments + Attachments + Workflow (Backend Only)

**Goal:** Add V2 routes for comments, attachments, and the approval/rejection workflow.

**Routes covered: 6**

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 2.1 | Implement `changeRequestCommentRepository.ts` | New file | None |
| 2.2 | Implement `changeRequestAttachmentRepository.ts` | New file | None |
| 2.3 | Implement `changeRequestWorkflowService.ts` (approve, reject, return, apply) | New file | None |
| 2.4 | Implement `changeRequestCommentController.ts` | New file | None |
| 2.5 | Implement `changeRequestAttachmentController.ts` | New file | None |
| 2.6 | Implement `changeRequestWorkflowController.ts` | New file | None |
| 2.7 | Register all comment, attachment, and workflow routes | `routes.ts` update | None |

**Validation:**
- [ ] `GET /v2/change-requests/request/:id/comment` returns identical comments as legacy
- [ ] `POST /v2/change-requests/request/:id/comment` creates identical comment, returns 201
- [ ] `GET /v2/change-requests/request/:id/attachment` returns identical attachments as legacy
- [ ] `POST /v2/change-requests/request/:id/attachment` creates identical attachment, returns 201
- [ ] `PUT /v2/change-requests/request/:id/approve` approves identically (including cross-entity mutation)
- [ ] `PUT /v2/change-requests/request/:id/reject` rejects identically
- [ ] Comment validation: 400 if comment missing for approve/reject
- [ ] Cross-entity mutation: test approval + apply for all 5 target types (component, job, work_order, spare, store)
- [ ] Response shapes match legacy exactly

### Phase 3 — Reports (Backend Only)

**Goal:** Move the 2 status tracking report handlers from `routes.ts` into the V2 change-requests module.

**Routes covered: 2**

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 3.1 | Implement `changeRequestReportService.ts` (status tracking + Excel export) | New file | None |
| 3.2 | Implement `changeRequestReportController.ts` | New file | None |
| 3.3 | Register report routes | `routes.ts` update | None |

**Validation:**
- [ ] `GET /v2/change-requests/report/status-tracking` returns identical aggregated data as legacy `GET /reports/change-requests-status-tracking`
- [ ] `GET /v2/change-requests/report/status-tracking/export` produces identical Excel file as legacy
- [ ] Per-vessel aggregation produces identical results
- [ ] Date range, status, and category filters work identically
- [ ] Legacy report routes remain completely unaffected

### Phase 4 — Frontend Integration & Toggle

**Goal:** Create frontend API abstraction, hooks, and toggle for all 7 change request pages.

**Pages covered: 7**

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 4.1 | Create `changeRequestApi.ts` (toggle-aware API) | New file | None |
| 4.2 | Create `changeRequestAttachmentApi.ts` | New file | None |
| 4.3 | Create `changeRequestCommentApi.ts` | New file | None |
| 4.4 | Create `useChangeRequestApi.ts` hook | New file | None |
| 4.5 | Create `ChangeRequestApiToggle.tsx` toggle UI component | New file | None |
| 4.6 | Add toggle to ModifyPMS.tsx page header | `ModifyPMS.tsx` — minimal change | Low |
| 4.7 | Replace inline API calls with V2 hooks (toggle-aware) across all 7 pages | Multiple change request pages | Medium |
| 4.8 | Test toggle switching between legacy and V2 | Manual test | None |

**Validation:**
- [ ] Toggle defaults to "Legacy" mode
- [ ] Switching to V2 mode: all change request data loads correctly
- [ ] Switching back to Legacy mode: all change request data loads correctly
- [ ] No visual differences between modes
- [ ] ModifyPMS.tsx: creating, editing, viewing change requests works in both modes
- [ ] ChangeRequestFormExact.tsx: field-level diff display works in both modes
- [ ] ApproveRejectModal.tsx: approval/rejection workflow works in both modes
- [ ] ViewChangeRequestModal.tsx: read-only view with diff works in both modes
- [ ] AddCommentModal.tsx: comment addition works in both modes
- [ ] EditChangeRequestModal.tsx: editing existing change requests works in both modes
- [ ] JobsSelector.tsx: job selection for targeting works in both modes

---

## 12. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │ CR API Toggle    │  localStorage: 'change_requests_api_version'│
│  │                  │  = 'v2' | 'legacy'                         │
│  └──────┬───────────┘                                            │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────┐                                    │
│  │ changeRequestApi         │  getMode() reads toggle            │
│  │ changeRequestAttachmentApi│                                   │
│  │ changeRequestCommentApi  │                                    │
│  └──────┬───────────────────┘                                    │
│         │                                                        │
│    ┌────┴────┐                                                   │
│    │         │                                                   │
│    ▼         ▼                                                   │
│  Legacy    V2 URLs                                               │
│  URLs      /technical/api/v2/change-requests/*                   │
│  /technical/api/change-requests/*                                │
│  /technical/api/reports/change-requests-status-tracking           │
└────┬─────────┬───────────────────────────────────────────────────┘
     │         │
     ▼         ▼
┌────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  Legacy Handlers           V2 Handlers                           │
│  (changeRequests.ts +      (v2/change-requests/routes.ts)       │
│   routes.ts reports)       Controller → Service → Repository    │
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
│           │  change_request│  ← change request tables,          │
│           │  tables        │    shared by both                   │
│           └────────────────┘                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Risk Points & Rollback Strategy

### 13.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `applyApprovedChanges` cross-entity mutation diverges from legacy | High | Test with real data for all 5 target types (component, job, work_order, spare, store), verify atomic transaction behavior |
| Status state machine transitions not replicated exactly | High | Copy exact valid transition checks from storage methods. Line-by-line comparison. |
| `snapshotBeforeJson` capture timing differs | Medium | Verify snapshot matches entity state at request creation time in both modes |
| Cross-module storage dependencies (getComponent, getJob, etc.) | Medium | Document all external storage calls; V2 repository delegates to same storage methods |
| Report aggregation (per-vessel iteration) produces different results | Medium | Compare V2 vs legacy report output field by field for multi-vessel data |
| Field definitions shared module divergence | Low | V2 re-uses same `shared/changeRequestFields.ts` — no duplication, zero risk |
| Revision history JSON structure mismatch | Medium | Verify `revisionNumber` increment and `revisionHistory` append produce identical JSON |

### 13.2 Rollback Strategy

| Scenario | Action |
|----------|--------|
| V2 returns incorrect data | User clicks toggle → "Legacy" → instant fallback |
| V2 has performance issues | Toggle to Legacy → no restart needed |
| V2 causes data corruption | Not possible — same storage methods, same tables |
| V2 approval workflow fails | Toggle to Legacy → approve via legacy route → same data |
| Need to remove V2 entirely | Delete V2 files, remove route registration — zero impact on legacy |

---

## 14. Validation Checklist

### 14.1 Core CRUD Validation

For the change request entity:
- [ ] GET all (with vesselId filter) → V2 returns identical array as legacy (same order, same shape)
- [ ] GET all (missing vesselId) → V2 returns 400 with identical error message
- [ ] GET by ID → V2 returns identical object as legacy
- [ ] GET by ID (not found) → V2 returns 404 with identical error message
- [ ] POST create → V2 creates identical record, returns 201 with same shape
- [ ] POST create (validation failure) → V2 returns 400 with identical Zod error details
- [ ] PATCH status update → V2 updates identically, returns same shape
- [ ] PATCH status update (invalid status) → V2 returns 400 with identical error
- [ ] Error cases → V2 returns same status codes and error messages

### 14.2 Helper Endpoints Validation

- [ ] GET field definitions (component) → identical field list
- [ ] GET field definitions (job) → identical field list
- [ ] GET field definitions (work_order) → identical field list
- [ ] GET field definitions (spare) → identical field list
- [ ] GET field definitions (store) → identical field list
- [ ] GET field definitions (invalid type) → 400 with identical error
- [ ] GET field definitions (editableOnly=true) → identical filtered field list
- [ ] GET target entity (component) → identical entity + fieldValues
- [ ] GET target entity (job) → identical entity + fieldValues
- [ ] GET target entity (work_order) → identical entity + fieldValues
- [ ] GET target entity (spare) → identical entity + fieldValues
- [ ] GET target entity (store) → identical entity + fieldValues
- [ ] GET target entity (not found) → 404 with identical error

### 14.3 Comment & Attachment Validation

- [ ] GET comments → identical array as legacy
- [ ] POST comment → identical record created, returns 201
- [ ] POST comment (validation failure) → 400 with identical error
- [ ] GET attachments → identical array as legacy
- [ ] POST attachment → identical record created, returns 201
- [ ] POST attachment (validation failure) → 400 with identical error

### 14.4 Workflow Validation

- [ ] PUT approve (with comment) → identical approval behavior
- [ ] PUT approve (missing comment) → 400 with identical error
- [ ] PUT approve → cross-entity mutation applies to correct table (test all 5 target types)
- [ ] PUT approve → `revisionNumber` incremented identically
- [ ] PUT approve → `revisionHistory` appended identically
- [ ] PUT reject (with comment) → identical rejection behavior
- [ ] PUT reject (missing comment) → 400 with identical error
- [ ] Status transitions → same transitions allowed/rejected as legacy

### 14.5 Report Validation

- [ ] GET status tracking (all vessels) → identical aggregation as legacy
- [ ] GET status tracking (single vessel) → identical data as legacy
- [ ] GET status tracking (with date range filter) → identical filtering
- [ ] GET status tracking (with status filter) → identical filtering
- [ ] GET status tracking export → identical Excel file content

### 14.6 Frontend Validation

- [ ] Toggle defaults to Legacy
- [ ] All pages work in Legacy mode (unchanged)
- [ ] All pages work in V2 mode (identical behavior)
- [ ] Toggle switch causes no data loss
- [ ] No visual differences between modes
- [ ] Creating new change requests works in both modes
- [ ] Editing existing change requests works in both modes
- [ ] Approval/rejection workflow works in both modes
- [ ] Comment addition works in both modes
- [ ] Field-level diff display works in both modes

---

## Appendix A: Cross-Entity Mutation Map

**Problem:** The `applyApprovedChanges()` method writes to tables outside the change request module based on `targetType`. This is the highest-risk operation in the module.

| targetType | Target Table | Storage Method Called | Fields Updated |
|------------|-------------|---------------------|----------------|
| `component` | `components` | `storage.updateComponent(id, data)` | Any editable component field |
| `job` | `jobs` | `storage.updateJob(id, data)` | Any editable job field |
| `work_order` | `work_orders` | `storage.updateWorkOrder(id, data)` | Any editable work order field |
| `spare` | `spares` | `storage.updateSpare(id, data)` | Any editable spare field |
| `store` | `stores_items` | `storage.updateStoresItem(id, data)` | Any editable store field |

**V2 Rule:** The V2 repository calls `storage.applyApprovedChanges()` exactly as legacy does. The cross-entity mutation logic remains in the storage layer. V2 does NOT attempt to replicate or re-implement this logic.

---

## Appendix B: Comparison with Fleet Module V2 Plan

| Aspect | Fleet V2 | Change Requests V2 |
|--------|---------|-------------------|
| Toggle key | `fleet_api_version` | `change_requests_api_version` |
| Inline business logic complexity | Medium (field sanitization, auto-code, delete guards) | High (status state machine, cross-entity mutation, approval workflow) |
| Number of entities | 12+ entities (components, jobs, spares, makers, etc.) | 3 entities (change_request, attachment, comment) + 2 helpers |
| Route handlers (legacy) | ~78 | 14 |
| Storage methods | ~50+ | 25 (including cross-module dependencies) |
| Frontend pages affected | 11+ fleet admin pages | 7 change request pages |
| Sub-router | `fleetAdmin.ts` (1,155 lines) | `changeRequests.ts` (319 lines) |
| Excel export | 3 exports (components, jobs, spares) | 1 export (status tracking report) |
| Bulk upload | 3 (fleet components, jobs, spares) | None |
| Cross-entity mutation | None | Yes — `applyApprovedChanges()` writes to 5 different entity tables |
| Database tables | 10+ fleet tables | 3 change request tables |
| Shared module re-use | None (self-contained) | `shared/changeRequestFields.ts` (field definitions) |

---

## Appendix C: Route Inventory Checklist (14/14 Verified)

### changeRequests.ts — Change Request Sub-Router (12 handlers)

| # | Line | Method | Path (under `/change-requests/`) | V2 Target | Accounted |
|---|------|--------|----------------------------------|-----------|-----------|
| 1 | 11 | GET | `/field-definitions/:targetType` | `changeRequestController.getFieldDefinitions` | YES |
| 2 | 33 | GET | `/target-entity/:targetType/:targetId` | `changeRequestController.getTargetEntity` | YES |
| 3 | 89 | GET | `/` | `changeRequestController.list` | YES |
| 4 | 126 | GET | `/:id` | `changeRequestController.getById` | YES |
| 5 | 143 | POST | `/` | `changeRequestController.create` | YES |
| 6 | 172 | PATCH | `/:id/status` | `changeRequestController.updateStatus` | YES |
| 7 | 194 | GET | `/:id/comments` | `changeRequestCommentController.list` | YES |
| 8 | 206 | POST | `/:id/comments` | `changeRequestCommentController.create` | YES |
| 9 | 227 | GET | `/:id/attachments` | `changeRequestAttachmentController.list` | YES |
| 10 | 239 | POST | `/:id/attachments` | `changeRequestAttachmentController.create` | YES |
| 11 | 260 | PUT | `/:id/approve` | `changeRequestWorkflowController.approve` | YES |
| 12 | 295 | PUT | `/:id/reject` | `changeRequestWorkflowController.reject` | YES |

### routes.ts — Report Handlers (2 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 13 | 10906 | GET | `/reports/change-requests-status-tracking` | `changeRequestReportController.getStatusTracking` | YES |
| 14 | 11073 | GET | `/reports/change-requests-status-tracking/export` | `changeRequestReportController.exportStatusTracking` | YES |

**Total: 14/14 route handlers accounted for in V2 plan.**

---

## Appendix D: Status State Machine Transition Rules

```
┌─────────────────────────────────────────────────────────────┐
│                   Status State Machine                       │
│                                                              │
│   ┌───────┐    submit()    ┌───────────┐                     │
│   │ Draft │ ──────────────→│ Submitted │                     │
│   └───────┘                └─────┬─────┘                     │
│       ▲                         │                            │
│       │     return()            │  review                    │
│       │    ┌────────────────────┤                            │
│       │    │                    │                            │
│       │    ▼                    ▼                            │
│   ┌──────────┐          ┌──────────────┐                     │
│   │ Returned │          │ Under Review │                     │
│   └──────────┘          └──────┬───────┘                     │
│                                │                            │
│                    ┌───────────┼───────────┐                 │
│                    │           │           │                 │
│                    ▼           ▼           ▼                 │
│              ┌──────────┐ ┌─────────┐ ┌──────────┐          │
│              │ Rejected │ │Approved │ │ Returned │          │
│              └──────────┘ └────┬────┘ └──────────┘          │
│                                │                            │
│                          apply()                            │
│                                │                            │
│                                ▼                            │
│                          ┌─────────┐                        │
│                          │ Applied │                        │
│                          └─────────┘                        │
│                                                              │
│  Valid Status Values:                                        │
│    draft, submitted, returned, approved, rejected            │
│                                                              │
│  Terminal States:                                            │
│    rejected (no further transitions)                        │
│    applied (change request fully processed)                 │
└─────────────────────────────────────────────────────────────┘
```

**Enforcement:** Status transitions are validated in storage methods. The V2 service layer must delegate to the same storage methods to ensure identical transition enforcement.

---

## Appendix E: Proposed Changes JSON Structure

### E.1 proposedChangesJson Format

```json
[
  {
    "fieldName": "name",
    "oldValue": "Main Engine No.1",
    "newValue": "Main Engine No.1 (Overhauled)",
    "label": "Component Name"
  },
  {
    "fieldName": "rating",
    "oldValue": "5000 kW",
    "newValue": "5200 kW",
    "label": "Rating"
  }
]
```

### E.2 snapshotBeforeJson Format

Contains a complete snapshot of the target entity at the time of change request creation. This is a plain JSON object with all entity fields:

```json
{
  "id": "COMP-001",
  "name": "Main Engine No.1",
  "componentCode": "ME-001",
  "rating": "5000 kW",
  "...": "all other entity fields"
}
```

### E.3 revisionHistory Format

```json
[
  {
    "revisionNumber": 1,
    "approvedBy": "admin",
    "approvedAt": "2026-02-18T10:30:00.000Z",
    "appliedChanges": [
      { "fieldName": "name", "oldValue": "Old Name", "newValue": "New Name" }
    ],
    "comments": "Approved - verified correct",
    "appliedStatus": "success",
    "appliedAt": "2026-02-18T10:30:01.000Z",
    "appliedFieldCount": 1
  }
]
```

### E.4 movePreviewJson Format (Component Move)

```json
{
  "targetComponentId": "COMP-002",
  "targetComponentName": "Auxiliary Engine",
  "currentParentId": "COMP-001",
  "currentParentName": "Main Engine",
  "newParentId": "COMP-003",
  "newParentName": "Generator Room"
}
```

**V2 Rule:** All JSON structures must be preserved exactly. V2 does not alter, transform, or re-format any JSON field.
