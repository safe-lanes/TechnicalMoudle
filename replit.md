# Seafarer Technical Management System

## Overview
This project is a comprehensive full-stack Technical Module for a maritime Planned Maintenance System (PMS). It offers robust solutions for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. Key capabilities include a PMS Dashboard, equipment and task management, reporting, and administrative functionalities, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to provide a data-driven approach to maritime maintenance, improving efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), ensuring a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**Storage Configuration**:
- **Development Mode**: Uses `PersistentFileStorage` for file-based JSON persistence (`test-data.json`).
- **Production Mode**: Will automatically switch to `PostgresStorage` when deployed/published.
- **Dual-Storage Architecture**: `server/storage.ts` conditionally selects storage based on `DATABASE_URL` availability:
  - If `process.env.DATABASE_URL` is present → `PostgresStorage` (PostgreSQL)
  - If `process.env.DATABASE_URL` is absent → `PersistentFileStorage` (JSON file)
- **Known Limitation**: Replit secrets (including DATABASE_URL) are only available in deployed/published apps, not during local development (`npm run dev`). This is why development mode uses file-based storage.
- **PostgresStorage Readiness**: Fully implemented with all Component Section H methods (Maintenance History, Documents, Class/Regulatory) ready for production activation.
- Database migrations are configured using Drizzle ORM (`npm run db:push`).
- **PostgreSQL Runtime Resolver**: `server/postgresClient.ts` provides cached connection pooling with lazy initialization, preventing socket leaks and supporting dual-mode operation.

**Service Layer Architecture**:
- A dedicated service layer in `server/services/` organizes business logic by domain, including `jobService`, `workOrderService`, `runningHoursService`, and `componentService`. This layer provides a clean API and validation, with future plans to move orchestration logic fully into services.

**Component Hierarchy Design**:
- Components are structured hierarchically using a `parentId` field, storing component codes for parent-child relationships.

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Utilizes AG Charts React for interactive, data-driven visualizations on the PMS Dashboard.
- Work Order forms feature a single scrollable page layout, numbered subsections, and professional maritime styling for enhanced usability.

**Technical Implementations & Key Features**:
- **PMS Dashboard**: Professional analytics workspace with tabbed layouts and data visualizations.
- **PMS Submodules**: Includes CRUD operations for Components (hierarchical tree), Work Orders (automatic status computation), Running Hours, Spares, Reports, Modify PMS, and Admin functionalities.
- **Jobs vs. Work Orders Architecture**: `Jobs` define maintenance task templates, while `Work Orders` are active/historical execution records, ensuring clear separation.
- **Work Order Automation**: Real-time status computation and strict filtering by `vesselId`.
- **Spec-Compliant WO Numbering**: Planned WOs use format `<JOB CODE>.WO-<YEAR>-<RUNNING NUMBER>` (e.g., JOB-ABC1234.WO-2025-001). Unplanned WOs use format `UWO-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>` (e.g., UWO-VESSEL01-2025-001). Sequential running numbers are per-job-per-year for planned and per-vessel-per-year for unplanned. Work order type ('Planned'/'Unplanned') is determined by job linkage presence.
- **Lead Time Warnings**: Color-coded indicators (red ≤3 days, orange ≤7 days, yellow >7 days) display days until work order due date. All work order creation paths (manual, auto-generation, bulk import) persist `jobId` for reliable job linkage. Backend automatically hydrates work orders with `leadTimeValue` and `leadTimeUnit` from linked jobs.
- **Grace Period Logic**: Fully implemented spec-compliant grace periods in `shared/workOrders/status.ts` with proper data hydration: Calendar jobs get grace until end of month OR 7 days after due date (whichever is longer). Running Hours jobs get 168-hour grace. Backend endpoints hydrate component currentRH, job dueRH/nextDueRH, and maintenanceBasis with robust numeric parsing (handles strings, decimals, empty values).
- **Job Cycle Updates on WO Approval**: Fully working automatic updates to parent job fields when work orders are completed. Calendar jobs: `lastDoneDate` and recalculated `nextDueDate` using `calculateNextDueDate` utility (formula: lastDoneDate + frequencyValue × frequencyUnit). Running Hours jobs: `lastDoneRH` and recalculated `nextDueRH` using currentReading from `runningHours` field.
- **Part B Section B3 (Running Hours)**: Work Order form displays Previous Reading (read-only, auto-filled from component's currentCumulativeRH) and Current Reading (editable). **GLOBAL BUSINESS RULES COMPLIANT**: WO completion updates ONLY sub-component RH (never parent RH). Only the Running Hours module has authority to update parent component RH. Sub-component RH must never exceed parent RH and cannot go backward.
- **Part B Section B4 (Spare Parts Consumed)**: Table pre-loads required spares from Part A with editable Quantity Consumed and Comments columns. Supports manual spare entry with Add Spare button. Includes caption explaining automatic inventory deduction on approval with ROB update and low-stock alerts.
- **Legacy Data Migration**: Backfill endpoint (`POST /api/work-orders/backfill-job-ids`) safely migrates legacy work orders by matching component + jobTitle to link them with parent jobs.
- **Defects Module**: Tracks Condition of Class, identifies recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management (dual locations, ROB/Min/Max levels), quick quantity adjustments, bulk upload, transaction history, and work order integration for consumption reconciliation. Automatic ROB deduction on work order completion with low-stock alerts.
- **Work Order Sort Order**: Spec-compliant priority-based sorting (Overdue → Grace P → Due → Postponed → Pending Approval → Active → Completed → Rejected) with secondary sort by nearest due date within each status group.
- **Auto-Generation Scheduler**: Endpoint (`POST /api/work-orders/auto-generate`) automatically generates work orders for both calendar-based jobs (when nextDueDate reached) and RH-based jobs (when currentRH >= nextDueRH - leadTime).
- **Calendar-Based Job Automation**: Automatic `nextDueDate` calculation based on `lastDoneDate + interval`, with robust date normalization and guard logic.
- **Running Hours Module**: Cascade update system for parent/child components, automatic work order generation, backend validation, and SFI Code navigation.
- **Components Module Job Display**: Hierarchical job loading to display relevant maintenance tasks from parent and descendant components.
- **Admin Module**: Bulk data import for various entities, data purge functionality, and a Fleet Admin Dashboard for master data management.
- **Role-Based Access Control (RBAC)**: Implements three user roles (Ship, Office, PMS Admin) with enhanced user schema, security measures, `AuthContext` for permission checking, `RoleGuard` components, and backend middleware for route authorization and vessel data isolation.

**Global Business Rules Compliance** (8/8 Rules Enforced):
- **Parent vs Sub-Component RH Authority** (Sections 5.5, 8.1, 8.2): ✅ Work Order completion handler enforces sub-component-only RH updates with strict validation. Parent component RH updates are exclusively reserved for the Running Hours module. WO completion validates component has `parentId` (rejects parent components) and ensures sub-component RH ≤ parent RH.
- **Jobs Belong to Sub-Components** (Section 3.3): ✅ Job creation/update endpoints validate that jobs can only be assigned to sub-components (components with `parentId`). Parent components cannot have jobs directly assigned.
- **Stores Module Isolation** (Section 7.2): ✅ 100% COMPLIANT - Dedicated `storesItems` and `storesLedger` tables with ZERO PMS linkages (no componentId, workOrderId, jobId fields). Complete architectural isolation from Components/Jobs/Work Orders modules. All Stores endpoints use dedicated storage methods operating exclusively on Stores tables.
- **Component Code Cascade Updates** (Rule #12): ✅ IMPLEMENTED - When componentCode is modified, system automatically updates all references in Jobs (componentCode, componentId), Work Orders (componentCode), Spares (componentCode, componentSpareCode), and child components (parentId). Creates audit entries for code renumbering in spares history.
- **Component Cascade Inactivate** (Rule #14): ✅ IMPLEMENTED - When a component is inactivated (not hard deleted), system uses Option A by default: blocks if any child is ACTIVE with clear error message. Option B (cascadeInactivate=true) recursively inactivates all descendants. Linked Jobs are marked inactive (isActive=false). Work Orders remain in history (no new WOs generated). Audit logging records all inactivation operations with affected component count.
- **Offline Mode** (Rule #20): ⏸️ PARKED FOR FUTURE - Current version does not support offline editing or queued sync. All write operations require active connection. Infrastructure exists (IndexedDB, OfflineContext) but is not wired into mutation flows. Forms will error out with "No network" if request fails. Full offline design (sync queue + conflict resolution) is parked for a future phase.
- **RH Correction → WO Re-trigger** (Rule #3): ✅ IMPLEMENTED - When running hours are updated (via cascadeRunningHoursUpdate), system automatically scans all RH-based jobs on affected components, identifies jobs that now meet due criteria (currentRH >= nextDueRH - leadTime), and auto-generates work orders for newly-due jobs with correct status (Due/Overdue/Grace P).

**Database Schema Enhancements**:
- **New Tables**: `fleet_equipment_master`, `component_running_hours_log`, `audit_log`, `component_documents`, `component_class_regulatory`, `component_maintenance_history`, `stores_items`, `stores_ledger`.
- **Stores Tables** (Global Business Rule Section 7.2 Compliance):
  - `stores_items`: Vessel stores inventory (itemCode, itemName, itemType, ROB/locations, IHM flag) - ZERO PMS linkages
  - `stores_ledger`: Transaction history for all stores movements (RECEIVE/CONSUME/ADJUST/TRANSFER) - Complete isolation from Components/Jobs/Work Orders
- **Enhanced Tables**: 
  - `jobs`: frequencyType, lead time fields (leadTimeValue, leadTimeUnit), RH cycle tracking (lastDoneRH, nextDueRH), audit tracking
  - `components`: componentCategory, makerCode, modelCode, conditionBased, isParent, audit tracking
  - `work_orders`: jobId field for reliable job linkage and lead time hydration
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only behavior for `component_maintenance_history` table (UPDATE/DELETE operations blocked with error message). Triggers are automatically created/verified on server startup when DATABASE_URL is configured.
- **Backend Hydration**: Work order API endpoints (`/api/work-orders`) automatically enrich responses with `leadTimeValue` and `leadTimeUnit` from linked jobs, using `jobId` for reliable matching (fallback to `templateCode === jobNo` for legacy data).

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`