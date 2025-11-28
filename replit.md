# Seafarer Technical Management System

## Overview
This project is a comprehensive full-stack Technical Module for a maritime Planned Maintenance System (PMS). It provides robust solutions for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. Key capabilities include a PMS Dashboard, equipment and task management, reporting, and administrative functionalities, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to offer a data-driven approach to maritime maintenance, improving efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application utilizes a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) for a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**Storage Configuration**:
- **Dual-Storage Architecture**: The system dynamically switches between `PostgresStorage` (for production with `DATABASE_URL`) and `PersistentFileStorage` (for development using `test-data.json`).
- Database migrations are managed with Drizzle ORM.
- `server/postgresClient.ts` provides cached connection pooling for PostgreSQL.
- **Data Persistence Verification**: The `PersistentFileStorage` class logs data counts on startup (users, components, spares, jobs) to confirm data was loaded correctly.

**Vessel Context**:
- `VesselContext` dynamically fetches vessels from `/api/vessels` and auto-selects the first available vessel if the stored vessel ID is invalid or doesn't exist.
- This prevents data loading issues caused by stale localStorage values that don't match actual vessel data.

**Service Layer Architecture**:
- A dedicated service layer (`server/services/`) organizes business logic by domain (e.g., `jobService`, `workOrderService`, `componentService`), providing clean APIs and validation.

**Component Hierarchy Design**:
- Components are structured hierarchically using a `parentId` field to define parent-child relationships.

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Uses AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are designed as single scrollable pages with numbered subsections and professional maritime styling.

**Technical Implementations & Key Features**:
- **PMS Dashboard**: Professional analytics workspace with data visualizations.
- **PMS Submodules**: Includes CRUD for Components (hierarchical), Work Orders (automatic status), Running Hours, Spares, Reports, Modify PMS, and Admin functionalities.
- **Jobs vs. Work Orders**: `Jobs` define maintenance task templates; `Work Orders` are execution records.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, and spec-compliant numbering.
- **Lead Time Warnings**: Color-coded indicators for work order due dates.
- **Grace Period Logic**: Fully implemented grace period calculations for Calendar and Running Hours jobs. Supports Company Standard rule (end-of-month or 7-day grace depending on due date position) and Custom Days mode per vessel.
- **Per-Vessel PMS Settings**: Configurable lead times and grace periods per vessel via `pms_vessel_settings` table. Includes Calendar lead times (Critical/Non-Critical), Running Hours lead times, and grace period modes.
- **Job Cycle Updates**: Automatic updates to job fields (`lastDoneDate`, `nextDueDate`, `lastDoneRH`, `nextDueRH`) upon work order completion.
- **Running Hours Module**: Handles previous and current readings for sub-components, with strict business rules for updating Running Hours (sub-components only, never exceeding parent, no backward movement).
- **Spare Parts Consumed**: Pre-loads required spares from jobs, allows manual entry, tracks consumption by location, and triggers automatic inventory deduction and low-stock alerts.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management (dual locations, ROB/Min/Max, bulk upload, transaction history, work order integration).
- **Work Order Sort Order**: Priority-based sorting (Overdue → Grace P → Due → Postponed → Pending Approval → Active → Completed → Rejected) with secondary sorting by due date.
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar-based and RH-based jobs.
- **Running Hours Module**: Cascade update system for parent/child components, automatic work order generation, and backend validation.
- **Components Module Job Display**: Displays relevant maintenance tasks from parent and descendant components.
- **Admin Module**: Bulk data import, data purging, and a Fleet Admin Dashboard for master data management.
- **Multi-Sheet Excel Bulk Import Templates**: Comprehensive 11-sheet template system for Fleet and Vessel data:
    - **Master_Sheet**: Import instructions and guidance
    - **Maker List**: 3 columns (Maker Code, Maker Name, Address) with CRUD API
    - **SFI Details**: 2 columns (Component Code, Component Name) with CRUD API
    - **Fleet_Component**: 13 columns including IS Parent Yes/No, Critical, Condition Based
    - **Fleet_Job**: 21 columns with dual frequency support (Calendar Interval + RH Interval)
    - **Fleet_Spare**: 19 columns for fleet-level spare parts master data
    - **Vessel_Component**: 24 columns (no IS Parent) for vessel-specific equipment
    - **Vessel_Job**: 26 columns for vessel-specific maintenance tasks (21 original + 5 Part A fields):
      - Part A fields: Required Spare Parts, Required Tools, PPE Requirements, Permit Requirements, Other Safety Requirements
      - Spare parts/tools entered as semicolon-separated lists are parsed into structured objects
    - **Vessel_Spare**: 27 columns with ROB by Location (Deck Store, Engine Store, Store 1, Store 2)
    - **Vessel_Stores**: 12 columns including IMPA Code for stores inventory
    - **Master Data**: Dropdown reference values for consistent data entry
    - Fleet Equipment Code linkage between fleet master data and vessel-specific records
- **Role-Based Access Control (RBAC)**: Implements three user roles (Ship, Office, PMS Admin) with enhanced user schema, `AuthContext`, `RoleGuard` components, and backend middleware for authorization and data isolation.
- **Global Business Rules Compliance**:
    - Enforces rules for Parent vs Sub-Component RH Authority, Jobs Belong to Sub-Components, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning (Rule #9), and Multi-Department Approver Validation (Rule #19).
    - Rule #9: Toast warning displayed when spare quantity consumed is 0 or blank, informing user no ROB deduction will occur.
    - Rule #19: Backend validation ensures approver's department matches the job's assigned department during work order completion.
    - Offline Mode is currently parked for future development.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: Introduction of new tables (`fleet_equipment_master`, `component_running_hours_log`, `audit_log`, `component_documents`, `component_class_regulatory`, `component_maintenance_history`, `stores_items`, `stores_ledger`, `pms_vessel_settings`) and enhancements to existing tables (`jobs`, `components`, `work_orders`, `consumedSpareParts`).
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only behavior for `component_maintenance_history`.
- **Backend Hydration**: Work order API endpoints automatically enrich responses with lead time values from linked jobs.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`