# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS), offering a comprehensive solution for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. It includes a PMS Dashboard, equipment and task management, reporting, and administration features, focusing on Certificate & Surveys, Defect Reporting, and core PMS functionalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application uses a modern full-stack architecture with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) for a mobile-first, responsive frontend, and Express.js (TypeScript) for the backend.

**Storage Configuration**:
-   Currently uses `PersistentFileStorage` for file-based JSON persistence (`/home/runner/workspace/test-data.json`).
-   `PostgresStorage` is implemented and ready for activation upon resolution of environment variable loading issues.

**Component Hierarchy Design**:
-   Components use `parentId` field to establish parent-child relationships.
-   **CRITICAL**: `parentId` stores **component codes** (e.g., "411", "331"), NOT database IDs (e.g., "1763482263091_al0yxafgt").
-   When filtering children: `components.filter(c => c.parentId === parent.componentCode)` ✓
-   Never filter by: `components.filter(c => c.parentId === parent.id)` ✗

**UI/UX Decisions**:
-   Mobile-first responsive design.
-   Consistent UI/UX across the application.
-   PMS Dashboard visualizations built with AG Charts React for interactive, data-driven analytics (KPIs, various chart types) responsive to vessel and date filters.

**Key Features & Technical Implementations**:

*   **PMS Dashboard**: Professional analytics workspace with tabbed layout (Overview, Departments, Equipment, Compliance). Visualizations use AG Charts React and display data from real filtered work orders.
*   **PMS Submodules**: Includes CRUD for Components (hierarchical tree with critical filter and search), Work Orders (automatic status computation, comprehensive form management), Running Hours (with bulk update validation), Spares (inventory, transactions), Reports, Modify PMS, and Admin.
*   **Components Module Filtering**:
    *   **Critical Filter**: Dropdown with three options (All Items, Critical Only, Non-Critical) to filter components by critical status.
    *   **Search Filter**: Real-time search input that filters components by name or code (case-insensitive).
    *   **Combined Filtering**: Both filters work together with AND logic.
    *   **Tree Hierarchy Preservation**: Parent categories remain visible if they contain matching children.
    *   **Data Normalization**: Critical field normalized from "Yes"/"No" strings to boolean during tree building for consistent filter logic.
*   **Jobs vs. Work Orders Architecture**:
    *   **Jobs**: Template definitions for maintenance tasks linked to components (Part A data: job details, required spares/tools).
    *   **Work Orders**: Active and historical execution records, including execution-specific details (Part B data: due date, status, uploaded documents, consumed spares, completion details).
    *   Storage supports full CRUD for jobs, filtering by `vesselId` and `componentId`.
    *   Type-safe separation between `Job` (template) and `WorkOrder` (execution) ensures clarity.
*   **Work Order Automation**: Real-time status computation (Active/Due/Due (Grace P)/Overdue/Completed) based on due dates and grace periods. Backend augments API responses with `computedStatus`.
*   **Work Order Vessel Filtering**: Work orders are strictly filtered by `vesselId` across all modules:
    *   **Work Orders Page** (`WorkOrders.tsx`): Explicit `queryFn` passes `vesselId` query parameter to `/api/work-orders?vesselId=${vesselId}`.
    *   **Dashboard** (`Dashboard.tsx`): Filters work orders by vessel for analytics and KPI calculations.
    *   **Maintenance Records** (`MaintenanceRecords.tsx`): Fetches component's `vesselId` first, then filters work order templates by that vessel.
    *   **Components Module** (`Components.tsx`): Cache invalidation includes `vesselId` to ensure correct data refresh.
    *   Backend endpoint (`/api/work-orders`) filters by `vesselId` when provided in query parameters via `storage.getWorkOrders(vesselId)`.
*   **Work Order Form Enhancements**: Comprehensive form for managing work orders, supporting inline editing for template details (Part A) and execution details (Part B). Includes document management with Replit Object Storage integration for uploads, retrieval, and deletion.
*   **Template vs. Execution Workflow**:
    *   **Template Mode**: Component Tree displays work order templates.
    *   **History Mode**: Maintenance Records page shows completed work order executions, allowing viewing of merged template and execution data.
    *   Data stored in `workOrderExecutions` table, referencing `templateId`.
    *   Backend provides REST endpoints for fetching, creating, and updating work order executions.
*   **Modify PMS - Change Requests**: Workflow for managing change requests (draft to approved/rejected) with target selection (Components/Work Orders/Spares/Stores) and impact previews.
*   **Defects Module**:
    *   Tracks Condition of Class (CoC), identifies recurring defects, and integrates with SIRE VIQ 7 references.
    *   Multi-step defect reporting form with persistent data and action management.
    *   Streamlined defect closure workflow, automatically setting status to 'Closed' and moving to 'Resolved' tab.
    *   Uses TanStack Query for cache invalidation with `exact: false` for hierarchical query keys.
*   **Spares Module with Full Integration**:
    *   **Dual-Location Tracking**: Supports two storage locations (Location A and Location B) via `location` and `location2` fields for spares stored in multiple locations.
    *   **Inventory Management**: ROB/Min/Max tracking with RED/ORANGE/GREEN stock indicators (RED: ROB < Min, ORANGE: ROB = Min, GREEN: ROB > Min).
    *   **Quick Quantity Adjustments**: +/- buttons for immediate inventory adjustments with automatic validation and history tracking.
        *   POST `/api/spares/:vesselId/:id/adjust` endpoint with signed qtyChange parameter (negative for CONSUME, positive for RECEIVE).
        *   Frontend disables minus button when ROB ≤ 0.
        *   Backend validates ROB won't go negative for CONSUME events.
        *   Automatic creation of sparesHistory entries with complete audit trail.
    *   **Bulk Upload**: CSV/Excel import with auto-generated PT-XXXXXX codes, three modes (Add/Update/Upsert), Component Code validation, and duplicate detection.
    *   **Transaction History**: Complete audit trail of all inventory movements (CONSUME, RECEIVE, ADJUST, CREATE, EDIT).
    *   **Work Order Integration (Part B4)**: Differential reconciliation system for consumed spares:
        *   Uses `sparesHistory` as source of truth to track net consumption per work order execution.
        *   Supports add/edit/remove of consumed spares with automatic inventory adjustments.
        *   On save: compares new consumption vs. prior history, applies only deltas (positive for additional consumption, negative for restocking).
        *   CONSUME entries created for increases (with ROB validation), ADJUST entries for decreases/removals.
        *   Prevents double-consumption and maintains accurate ROB across all updates.
        *   Full audit trail with work order reference linking in `sparesHistory`.
*   **Calendar-Based Job Automation**:
    *   **Next Due Date Calculation**: Automatic calculation of `nextDueDate` for Calendar-based jobs using `lastDoneDate + intervalValue + unit`.
        *   Date normalization utility (`normalizeDateToDDMMMYYYY`) handles Excel serial numbers, ISO strings, Date objects, and locale strings.
        *   Converts all date formats to standardized DD-MMM-YYYY format before calculation.
        *   Calculation logic in `shared/dateUtils.ts` using `date-fns` library.
    *   **Bulk Upload Integration**: Jobs template import (21-column format) automatically calculates and persists `nextDueDate` for Calendar jobs with `Last Done` dates.
        *   Column 16: "Last Done" (normalized from various Excel formats)
        *   Column 8: "Interval Value" (e.g., "3", "6", "12")
        *   Column 10: "Unit" (Days/Weeks/Months/Years)
        *   Storage persistence updated: `createJob`, `bulkCreateJobs`, `bulkUpsertJobs` all persist both fields.
    *   **Auto-Generation Endpoint** (`POST /api/work-orders/auto-generate`):
        *   Checks all active Calendar-based jobs for the specified vessel.
        *   Generates work orders when `nextDueDate` is reached (today or past).
        *   O(n) performance using Set-based duplicate prevention (`componentCode|jobTitle` keys).
        *   Status whitelist: Active, Due, Due (Grace P), Overdue, Pending Approval.
        *   Prevents duplicates within same invocation by updating Set after each creation.
        *   Returns statistics: `{checked, generated, workOrders[]}`.
*   **Running Hours Module with Automatic Work Order Generation**:
    *   **Cascade Update System** (`POST /api/running-hours/cascade`):
        *   Updates parent component running hours, then automatically cascades delta to ALL child components.
        *   Uses parent's component code (not database ID) to find children where `parentId === parent.componentCode`.
        *   For each child, checks jobs with `maintenanceBasis === "Running Hours"`.
        *   **Automatic Work Order Generation**: When child's new running hours exceed job's `intervalRunningHour` threshold AND no active work order exists, auto-generates new work order.
        *   Handles multiple threshold crossings (e.g., if RH jumps 500 hrs with 300-hr interval, generates 1 WO and queues future).
        *   Returns statistics: `{updatedComponents, auditsCreated, workOrdersGenerated, workOrders[]}`.
    *   **Backend Validation**: 
        *   Rejects decreases in running hours (unless meter was replaced).
        *   Validates realistic hourly deltas based on date differences (max 25 hrs/day to account for timezone changes).
        *   Clear, actionable error messages explaining validation failures.
    *   **Audit Trail**: Dual timestamps - user-entered `dateUpdatedLocal` and system-captured `enteredAtUTC` for complete audit trail.
    *   **Work Order Integration**: 
        *   Full-page Work Order form at `/pms/work-order/:id` (migrated from dialog popup).
        *   Date of Completion and Running Hours fields in Part B2 section.
        *   Context endpoint (`/api/work-orders/:id/context`) fetches component hierarchy data for validation.
        *   Completion endpoint (`/api/work-orders/:id/complete`) performs atomic work order + running hours update.
        *   Frontend validation enforces: child RH ≤ parent RH, no decrease, max 25 hrs/day realistic delta.
        *   Backend validation duplicates all frontend checks for security.
        *   Automatic delta cascading to all child components recursively.
        *   Complete audit trail for component and all children with work order reference.
        *   Separate workflows for draft saves (PATCH) vs. completions (POST /complete).
*   **Admin Module**:
    *   **Bulk Data Import**: Supports CSV/Excel import for Machinery Components (with SFI hierarchy, validation, duplicate detection, multi-vessel support), Jobs, and Spares.
        *   **Multi-Vessel Support**: Explicit vessel selection for bulk uploads.
        *   **Error Viewing & Partial Import**: Enhanced UX for handling validation errors, allowing viewing of errors and selective import of valid rows.
        *   **Jobs Template Format (21 columns)**: Job Code, Fleet Equipment Code, Fleet Equipment Name, WO Title, Component Code, Component Name, Maintenance Basis, Interval Value, Interval Running Hours, Unit, Task Type, Assigned To, Approver, Job Priority, Class Related, Last Done, Brief Work Description, Department, Criticality, Is Active, Vessel Code.
            *   Pre-populated with 100 leaf node components (actual equipment) for data entry convenience.
            *   Dropdown validations for Maintenance Basis, Interval Value, Unit, Task Type, Job Priority, Department, Criticality.
            *   Field mapping: "WO Title" (was "Maintenance Task"), "Interval Value" (was "Frequency Value"), "Assigned To" (was "Person In Charge"), "Brief Work Description" (was "Brief Job Description").
    *   **Data Purge Functionality** (`POST /api/admin/purge-jobs`): Admin endpoint for safe deletion of all jobs and linked data for a specific vessel or entire system.
        *   Deletes in dependency order: workOrderExecutions → workOrders → jobs → runningHoursAudits.
        *   Resets all component `currentCumulativeRH` to '0.00'.
        *   Clears job-related import history (preserves other import types).
        *   Returns detailed statistics: deletedWorkOrderExecutions, deletedWorkOrders, deletedJobs, deletedRunningHoursAudits, componentsReset.
        *   Supports optional `vesselId` parameter for targeted purge (omit for system-wide purge).
        *   Complete audit trail logged to console with total records affected.
    *   **Alerts Tab**: Alert policy management.
    *   **Forms Tab**: Form configuration.
    *   **Fleet Admin Dashboard**: Master data management for makers, master lists, fleet components (hierarchical SFI), fleet jobs, and fleet spares. Uses a federated schema design with a `dataScope` discriminator.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`