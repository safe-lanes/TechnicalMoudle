# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Development Rule - Drizzle-Only Migration Policy (Permanent)**:
All future database schema changes MUST follow this policy without exception:

1.  **Migration Type (Mandatory)**:
    -   Use Drizzle file-based SQL migrations ONLY
    -   All migrations must be generated using `drizzle-kit generate`
    -   Every schema change must result in a `.sql` file inside the `/migrations` directory

2.  **Prohibited Approaches (Never Use)**:
    -   No code-based migrations inside `server/migrations.ts`
    -   No JSON-driven or object-based migrations
    -   No embedded CREATE TABLE or ALTER TABLE SQL executed from TypeScript
    -   No "baseline" or full schema snapshot migrations for incremental changes

3.  **Incremental Migration Rules**:
    -   New tables → dedicated migration file
    -   New columns → ALTER TABLE ADD COLUMN
    -   Index changes → separate migration
    -   Enum updates → isolated migration
    -   One logical change per migration file

4.  **Migration Tracking (Unified System)**:
    -   All migrations (code-based and SQL file-based) are tracked in the `schema_migrations` table
    -   On server start, `runDrizzleMigrations()` scans `/migrations/*.sql` files
    -   Each SQL file is checked against `schema_migrations` by filename
    -   Untracked files are executed and recorded automatically
    -   This ensures pulled migration files from git are properly detected and applied

5.  **Workflow**:
    -   Update `shared/schema.ts` with schema changes first
    -   Run `drizzle-kit generate` to create the migration SQL file
    -   Review the generated SQL before applying

**IMPORTANT**: Existing migrations 001-016 in `server/migrations.ts` are frozen for backward compatibility. **No new code-based migrations will ever be added** - all future schema changes across PMS, Certificates & Surveys, and Defects modules must use Drizzle file-based SQL migrations exclusively.

**Critical Development Rule - Fleet Table Schema Contract (Permanent)**:
All future Fleet-related tables MUST include these mandatory columns with exact naming and behavior:

1.  **Mandatory Column Set (Required for ALL Fleet Tables)**:
    ```typescript
    {table_name}_uuid: text("{table_name}_uuid").default(sql`gen_random_uuid()`),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdByUuid: text("created_by_uuid"),   // FK → master_users.user_uuid
    updatedByUuid: text("updated_by_uuid"),   // FK → master_users.user_uuid
    isDeleted: boolean("is_deleted").default(false),
    isSync: boolean("is_sync").default(false),
    ```

2.  **Identifier & Relationship Rules**:
    -   `{table_name}_uuid` must be a UUID value with default generator
    -   This UUID column is the primary relational key for Fleet table relationships
    -   All Fleet table relationships must reference UUID columns ONLY
    -   Do NOT use numeric IDs, codes, or names for relations between Fleet tables

3.  **Consistency Enforcement**:
    -   Column names must not change from the defined pattern
    -   Data types and default behavior must remain consistent
    -   These columns must exist even if not immediately used by business logic
    -   Any Fleet table omitting or renaming these columns is considered invalid

4.  **Scope & Safety**:
    -   This rule applies ONLY to future Fleet tables
    -   Do NOT modify or migrate existing tables to match this pattern
    -   Do NOT alter existing business logic or queries
    -   This is a schema standardization guideline, not a refactor task

5.  **Fleet Table Identification**:
    -   Tables prefixed with `fleet_` (e.g., `fleet_vessel_mapping`, `fleet_component_mapping`)
    -   Tables that manage fleet-wide master data shared across vessels
    -   Tables referenced by the Fleet Admin module

6.  **Tables Updated to Match Fleet Schema Contract**:
    -   `maker_list` - Updated Feb 2026 with all mandatory columns (maker_list_uuid, sortOrder, createdByUuid, updatedByUuid, isDeleted, isSync). All future FK references to this table MUST use `maker_list_uuid` column only (not the numeric `id`)

## System Architecture
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store. All API endpoints use the `/technical/api` prefix.

**UI/UX Decisions**:
- Mobile-first, responsive design with consistent padding (`p-6`) and vertical spacing (`space-y-6`).
- Interactive data visualizations with AG Charts React and AG Grid Enterprise for tables.
- Single-page, scrollable Work Order forms with numbered subsections.
- Standardized color codes for action buttons, fixed-width menu items, and specific tab styling.

**Technical Implementations**:
- **Core PMS Logic**: Manages immutable Job templates and executable Work Orders.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Organizes business logic into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations.
- **PMS Submodules**: Comprehensive CRUD for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, and lead time/grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7, including a structured form and target date extension workflow.
- **Spares Module**: Inventory management with many-to-many linking, location-based stock tracking, and audit trails for RECEIVE, CONSUME, ADJUSTMENT events.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Features bulk data import, data purging, and a Fleet Admin Dashboard with Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Component Document Storage**: File uploads are exclusively handled via Replit Object Storage.
- **Change Request Workflow**: Includes an "Apply Approved Changes" step with atomic database transactions.
- **Certificates & Surveys Admin Modules**: Manage ship certificate and survey requirements via 3-tab interfaces (Master, Company, Vessel), configurable categories/groups, and prefixed ID formats (`{category}-{seq}`, `CMP-{seq}`, `VES-{seq}`). Integrate with `vessel_certificate_applicability`, `ship_certificates_master`, `vessel_certificate_data`, `vessel_survey_applicability`, `ship_surveys_master`, and `vessel_survey_data`.
- **Standard Sequencing Component**: Admin tables use a number input for sequence reordering with automatic adjustments.
- **Database Migration Strategy**: Exclusively uses Drizzle file-based SQL migrations.
- **Vessel Data Source Strategy**: `useVessels()` hook prioritizes local PMS data with fallback to an external master-data API.
- **ROB Location Stock Synchronization**: Dual-write synchronization between legacy ROB fields and `spare_location_stock` table.
- **Excel Report Standardization**: All Maintenance & Work Order Excel exports use a standardized 18-column template with status-based full-row highlighting and a defined color scheme (Orange, Red, Green, Yellow, Blue).
- **Job Postponement Log Report**: Uses `work_order_postponements` table to track all postponements, with a 19-column Excel export including audit trail.
- **Running Hours Anomaly Detection Report**: Analyzes `running_hours_audit` for 5 anomaly types (High Increment, Negative Delta, Zero Change, Irregular Pattern, Meter Replacement) with severity-based coloring in Excel export.
- **Chemicals Inventory & Expiry Tracking**: Extends `stores_items` with 16 chemical-specific fields. Provides an expiry report with computed fields, summary cards, alerts, and PDF export.
- **Consumption Pattern Analysis Report**: Aggregates `spares_history` CONSUME events, generating a 10-column report with total consumed, consumption events, current ROB, min stock, status, and last consumed date. Supports PDF and Excel export.
- **Low Stock Alert Report (Stores/Lubes/Chemicals)**: Monitors inventory below minimum levels, classifying alerts (Critical, High, Medium). Calculates average monthly consumption, days until stockout, deficit quantities, and estimated reorder costs. Supports PDF, Excel, and JSON output with a 13-column format and a comprehensive frontend display including summary cards and priority alerts.
- **Report Snapshot Audit Trail**: `report_snapshots` table stores a complete record of report generations/exports, including filters, summary, and item-level data. Snapshots are saved asynchronously, with a history API for retrieval and detailed viewing.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`