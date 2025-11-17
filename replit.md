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

**UI/UX Decisions**:
-   Mobile-first responsive design.
-   Consistent UI/UX across the application.
-   PMS Dashboard visualizations built with AG Charts React for interactive, data-driven analytics (KPIs, various chart types) responsive to vessel and date filters.

**Key Features & Technical Implementations**:

*   **PMS Dashboard**: Professional analytics workspace with tabbed layout (Overview, Departments, Equipment, Compliance). Visualizations use AG Charts React and display data from real filtered work orders.
*   **PMS Submodules**: Includes CRUD for Components (hierarchical tree), Work Orders (automatic status computation, comprehensive form management), Running Hours, Spares (inventory, transactions), Reports, Modify PMS, and Admin.
*   **Jobs vs. Work Orders Architecture**:
    *   **Jobs**: Template definitions for maintenance tasks linked to components (Part A data: job details, required spares/tools).
    *   **Work Orders**: Active and historical execution records, including execution-specific details (Part B data: due date, status, uploaded documents, consumed spares, completion details).
    *   Storage supports full CRUD for jobs, filtering by `vesselId` and `componentId`.
    *   Type-safe separation between `Job` (template) and `WorkOrder` (execution) ensures clarity.
*   **Work Order Automation**: Real-time status computation (Active/Due/Due (Grace P)/Overdue/Completed) based on due dates and grace periods. Backend augments API responses with `computedStatus`.
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
    *   **Inventory Management**: ROB/Min/Max tracking with RED/ORANGE/GREEN stock indicators (RED: ROB < Min, ORANGE: ROB = Min, GREEN: ROB > Min).
    *   **Bulk Upload**: CSV/Excel import with auto-generated PT-XXXXXX codes, three modes (Add/Update/Upsert), Component Code validation, and duplicate detection.
    *   **Transaction History**: Complete audit trail of all inventory movements (CONSUME, RECEIVE, ADJUST, CREATE, EDIT).
    *   **Work Order Integration (Part B4)**: Differential reconciliation system for consumed spares:
        *   Uses `sparesHistory` as source of truth to track net consumption per work order execution.
        *   Supports add/edit/remove of consumed spares with automatic inventory adjustments.
        *   On save: compares new consumption vs. prior history, applies only deltas (positive for additional consumption, negative for restocking).
        *   CONSUME entries created for increases (with ROB validation), ADJUST entries for decreases/removals.
        *   Prevents double-consumption and maintains accurate ROB across all updates.
        *   Full audit trail with work order reference linking in `sparesHistory`.
*   **Admin Module**:
    *   **Bulk Data Import**: Supports CSV/Excel import for Machinery Components (with SFI hierarchy, validation, duplicate detection, multi-vessel support), Jobs, and Spares.
        *   **Multi-Vessel Support**: Explicit vessel selection for bulk uploads.
        *   **Error Viewing & Partial Import**: Enhanced UX for handling validation errors, allowing viewing of errors and selective import of valid rows.
    *   **Alerts Tab**: Alert policy management.
    *   **Forms Tab**: Form configuration.
    *   **Fleet Admin Dashboard**: Master data management for makers, master lists, fleet components (hierarchical SFI), fleet jobs, and fleet spares. Uses a federated schema design with a `dataScope` discriminator.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`