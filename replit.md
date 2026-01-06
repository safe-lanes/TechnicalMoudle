# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It manages technical equipment maintenance, scheduling, and performance tracking, with key capabilities in Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to enhance efficiency and compliance in maritime maintenance through a data-driven approach, streamlining operations, and ensuring regulatory adherence.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture with a mobile-first, responsive design. The frontend uses React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), and the backend is built with Express.js (TypeScript). All data is stored in PostgreSQL, with a strict "fail fast" policy if the database URL is not configured.

**UI/UX Decisions**:
- Mobile-first and responsive design is a core principle.
- Interactive data visualizations are used on the PMS Dashboard with AG Charts React.
- Work Order forms are designed as single scrollable pages with numbered subsections and professional maritime styling.
- Certificates & Surveys AG Grid Tables utilize AG Grid Enterprise with specific styling and inline date editing capabilities.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs serve as immutable templates, while Work Orders are execution records with a defined lifecycle.
- **Vessel Context**: The system supports dynamic fetching and auto-selection of vessels, including an "All Vessels" aggregate view.
- **Service Layer Architecture**: Business logic is organized by domain.
- **PMS Dashboard**: Provides a professional analytics workspace with data visualizations, including an "Outstanding Tasks" pie chart.
- **PMS Submodules**: Comprehensive CRUD operations are supported for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin functions.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic, with centralized status thresholds defined in `shared/workOrders/constants.ts`.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations. RH status is lead time-driven.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7, following specific naming conventions.
- **Spares Module (Enhanced Inventory System)**: Offers complete inventory management with many-to-many linking between spares and components, location registry, stock per location tracking (no negative stock), and a full audit trail via `inventory_transactions` (RECEIVE, CONSUME, ADJUST event types).
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates, enhanced validation UI, and duplicate component code checks), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implemented for authorization and data isolation across Ship, Office, and PMS Admin roles.
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: New tables and enhancements to existing tables, including PostgreSQL triggers for immutability constraints.
- **Work Order Naming Rules**: Strict naming conventions for Planned (`<JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>`) and Unplanned (`UWO-<VESSEL_CODE>-<YEAR>-<RUNNING_NUMBER>`) Work Orders.
- **Component Document Storage**: Handles file uploads using Replit Object Storage exclusively.
- **Centralized RH Update Architecture**: All running hours updates route through `server/postgresStorage.ts` for consistency and cascade updates.
- **Work Order Completion & Maintenance History**: Automated creation of maintenance history records and updates to job cycle dates upon work order approval.
- **Work Order Status Calculation**: Real-time status computation logic.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact parity for fields.
- **Part A Immutability Rule**: Work Order Part A is read-only for existing work orders.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix (e.g., `/technical/api/vessels`, `/technical/api/components/:vesselId`). This provides namespace separation and avoids routing conflicts.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`

## Issue Tracker (26-Dec-2025 Findings)
Progress tracking for issues from the 26-12-2025 findings document.

| Issue # | Description | Status | Date Completed |
|---------|-------------|--------|----------------|
| 1-6 | Various fixes | Completed | Prior sessions |
| 7 | Location-aware Consume/Receive for Spares | **Completed** | 05-Jan-2026 |
| 8-9 | Pending issues | Pending | - |
| 10 | Maintenance History not showing in Components D Section & Jobs Form A5 | **Completed** | 05-Jan-2026 |
| 11-14 | Pending issues | Pending | - |

### Issue #7 Details (Completed 05-Jan-2026)
**Multi-Location Inventory Tracking**: Added location selection for consuming and receiving spare parts.
- **Backend**: Added `consumeSpareWithLocation` and `receiveSpareToLocation` methods in `server/postgresStorage.ts`
- **API**: Added `/technical/api/spares/:id/consume` and `/technical/api/spares/:id/receive-to-location` endpoints
- **Frontend**: Updated Consume/Receive modals with Location dropdown (Location A/B with available stock display)
- **Validation**: Per-location stock validation prevents over-consumption
- **History**: Location tracked in remarks field as "(Location A)" or "(Location B)"

### Issue #10 Details (Completed 05-Jan-2026)
**Maintenance History Linking**: Fixed maintenance history not appearing in Components D Section and Jobs Form A5.
- **Schema**: Added `jobId` and `jobCode` columns to `component_maintenance_history` table with proper indexing
- **WO Completion**: Updated work order approval route to include job metadata (jobId, jobCode) in history records
- **API**: Added `/technical/api/job-maintenance-history/:jobId` endpoint for job-based history queries
- **Fallback Logic**: Component history query now uses `componentCode` as fallback when `componentId` doesn't match (handles legacy records)
- **Storage**: Added `getMaintenanceHistoryByJobId` and `getMaintenanceHistoryByComponentCode` methods

### Duplicate Work Order Prevention (Completed 05-Jan-2026)
**Root Cause**: Auto-generation scanner was using workOrderNo parsing instead of direct jobId matching, causing duplicate active WOs during server restarts.

**Three-Layer Protection Implemented**:
1. **Layer 1 - Application Logic** (`server/utils/workOrderStatus.ts`):
   - Modified `buildJobsWithActiveWOSet()` to return `ActiveWOBlockingSets` with both `byJobId` and `byJobNo` sets
   - Primary check uses `jobId` directly (reliable), fallback uses extracted `jobNo` (legacy compatibility)
   
2. **Layer 2 - Pre-Creation Validation** (`server/services/workOrderService.ts`):
   - Added duplicate check in `createWorkOrder()` using `isBlockingStatus()` before insert
   - Throws clear error message if active WO already exists for the same job
   
3. **Layer 3 - Database Constraint**:
   - Added partial unique index `idx_wo_unique_active_job` on `(job_id, vessel_id)`
   - WHERE clause excludes Completed/Cancelled/Rejected statuses
   - Provides ultimate protection at database level

**Data Cleanup**: Cancelled 17 duplicate work orders in V015, keeping earliest WO per job with explanatory remarks.

### Spare Parts Data Flow (Verified 06-Jan-2026)
**Complete Job → WO → Inventory Pipeline**:
1. **Job A2 (Required Spare Parts)** → Populated via `scripts/populateJobSpares.ts` (40 jobs × 4-5 spares each)
2. **WO A2 (Required Spare Parts)** ← Copied from job on WO creation (`workOrderService.ts` line 383)
3. **WO B4 (Spare Parts Consumed)** → User enters consumption with location selection
4. **Inventory Transactions** ← Auto-deduct with WO ID linkage (`routes.ts` lines 3104-3108):
   - `referenceType: 'WORK_ORDER'`
   - `referenceId: workOrder.id`
   - `referenceNote: 'WO: {workOrderNo} - {comments}'`

**Route Clarification**: Work Order form uses `/pms/work-order/:id` (NOT `/pms/wo/:id`)

### Many-to-Many Bulk Upload Support (Completed 06-Jan-2026)
**Problem**: Bulk upload system incorrectly treated jobs/spares-to-components as 1:1 relationships, causing duplicate job numbers for different components to be skipped.

**Solution**: Junction tables (`jobComponentLinks`, `spareComponentLinks`) are now the source of truth for all bulk upload operations.

**Key Changes**:
1. **Schema**: Made `componentId`, `componentCode`, `componentName` nullable on jobs table (deprecated in favor of link table)
2. **Job Bulk Upload** (add/update/upsert modes):
   - All modes now check existing links via `getJobComponentLinksByJob()`
   - Creates new `jobComponentLink` entries when needed
   - Same job can now link to multiple components without being skipped
   - Tracks `jobComponentLinksCreated` counter
   - **CRITICAL FIX**: Separated deprecated component fields (`componentId`, `componentCode`, `componentName`) from `jobData` to prevent overwrites during updates. Component fields are only included for NEW job creation (backwards compatibility), not for updates.
3. **Spare Bulk Upload** (add/upsert modes):
   - Changed from deprecated `componentId` comparison to checking via `spareComponentLinks` table
   - Same spare can now link to multiple components
   - Tracks `spareComponentLinksCreated` counter
4. **Cascade Inactivation**:
   - Updated to query jobs via both deprecated `componentId` AND `jobComponentLinks` table
   - Deduplicates job IDs using Sets before updating to prevent double-counting
5. **Result Output**: Final log message includes link counts: `{X} job-component links created, {Y} spare-component links created`

### Many-to-Many Job Display Fix (Completed 06-Jan-2026)
**Problem**: Jobs uploaded via bulk import were correctly creating junction table links, but the UI was filtering by the deprecated `componentCode` field (which only stores ONE component), so jobs only appeared under one component.

**Solution**: 
1. **Backend (GET /technical/api/jobs)**: Now hydrates each job with `linkedComponentCodes[]` array fetched from `job_component_links` junction table
2. **Frontend (Components.tsx)**: Filters jobs by checking if ANY of `linkedComponentCodes` matches the component tree
3. **Performance**: Batch fetches all links per vessel in ONE query, caches component lookups to avoid N+1

**Result**: Jobs now correctly appear under ALL linked components, not just the first one

### Multi-Linked Job Component Context Fix (Completed 06-Jan-2026)
**Problem**: When a job is linked to multiple components via `linkedComponentCodes[]`, clicking the job from component X would open the job bound to the wrong component (typically `linkedComponentCodes[0]` instead of component X).

**Root Cause**: The UI was navigating to `/pms/job/:id` without preserving which component the user clicked from. Downstream actions (viewing, generating WO) would use the job's stored `componentCode` field which doesn't represent the active viewing context.

**Solution - Explicit Component Binding**:
1. **Navigation**: `handleRowClick` now includes `activeComponentCode` as URL parameter: `/pms/job/:id?activeComponentCode=X`
2. **JobRow Component**: Accepts `activeComponentCode` prop, passes it to Generate WO API calls
3. **JobsFormPage**: Reads `activeComponentCode` from URL, uses it instead of `job.componentCode` for `templateData.componentCode`
4. **Backend API** (`POST /technical/api/jobs/:id/generate-wo`): Accepts optional `activeComponentCode` in request body
5. **Storage** (`generateOnDemandWorkOrder`): Uses `activeComponentCode` override if provided, ensuring WO is created with correct component context

**Key Files Changed**:
- `client/src/pages/pms/Components.tsx` - JobRow, WorkOrdersSection, handleRowClick
- `client/src/pages/pms/JobsFormPage.tsx` - activeComponentCode URL param handling
- `server/routes.ts` - generate-wo endpoint
- `server/storage.ts` - interface update
- `server/postgresStorage.ts` - implementation update

**Validation Scenario**: Job linked to components 651.003.05 and 401.005. User opens job from 651.003.05 → Job shows componentCode=651.003.05, not 401.005