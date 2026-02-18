# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance, ultimately improving vessel operational readiness and safety.

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
The application employs a modern full-stack architecture with a mobile-first, responsive design, using React (TypeScript, Vite, Tailwind CSS) for the frontend and Express.js (TypeScript) for the backend. PostgreSQL is the primary data store. All API endpoints use the `/technical/api` prefix.

**UI/UX Decisions**:
- Mobile-first and responsive design.
- Interactive data visualizations with AG Charts React and data grids with AG Grid Enterprise (custom styling, inline editing).
- Single-page, scrollable Work Order forms with numbered subsections.
- Standardized UI components: `p-6` padding, `space-y-6` for vertical spacing, consistent headers, and specific color codes for action buttons.
- "Delta UI Pattern" for mapping/selection dialogs: gradient header, compact buttons, inline search, standardized table styling.

**Technical Implementations**:
- **Core PMS Logic**: Manages immutable Job templates and executable Work Orders with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Modular Services**: Business logic organized into domain-specific services.
- **PMS Modules**: Comprehensive CRUD for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7, with structured forms and target date extension.
- **Spares Module**: Inventory management with many-to-many linking, location-based stock tracking, and audit trails for RECEIVE, CONSUME, and ADJUSTMENT events.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Features bulk data import, data purging, Fleet Admin Dashboard, On-Demand WO Generation, and Postponed WO Reappearance.
- **Role-Based Access Control (RBAC)**: Authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Component Document Storage**: File uploads handled via Replit Object Storage.
- **Change Request Workflow**: Implements an "Apply Approved Changes" step with atomic database transactions.
- **Ship Certificates & Surveys Admin**: Manages requirements with 3-tab interfaces (Master, Company, Vessel), configurable categories/groups, and prefixed ID formats.
- **Standard Sequencing Component**: Number input for sequence reordering in Admin tables.
- **Fleet Component → Fleet Job Referential Integrity**: `fleet_jobs` links to `fleet_components_uuid`, validated during bulk import.
- **Database Migration Strategy**: Exclusively uses Drizzle file-based SQL migrations.
- **Vessel Data Source Strategy**: `useVessels()` hook prioritizes local PMS data, falling back to an external master-data API.
- **ROB Location Stock Synchronization**: Dual-write sync between legacy ROB fields and `spare_location_stock` for inventory consistency. Location resolution is lookup-only.
- **Pre-Registered Location Model**: Locations must be created via Location Admin before use; `findOrCreateLocation` replaced with `getLocationByName`. Location Admin UI at Admin > Locations with CRUD, bulk import, and template download.
- **Excel Report Standardization**: Standardized 18-column template for Maintenance & Work Order Excel exports with status-based row highlighting.
- **Job Postponement Log Report**: Tracks `work_order_postponements` history; 19-column Excel export.
- **Running Hours Anomaly Detection Report**: Analyzes `running_hours_audit` for 5 anomaly types; severity-based row coloring in Excel export.
- **Consumption Pattern Analysis Report**: Aggregates `spares_history` CONSUME events; 10-column PDF/Excel report.
- **IHM Inventory Status Report**: Interactive report combining `spares` and `stores_items` data with summary cards, filters, and PDF/Excel export.
- **AI Chatbot Assistant**: Floating chat panel using OpenAI GPT-4o with Replit AI Integration. Provides 29 function-calling tools for querying and analyzing work orders, spares, components, jobs, inventory, defects, and maintenance scheduling. Features structured analytical responses (Summary, Critical Insights, Priority Items, Recommendations), query classification, clarifying questions, and conversation history management.
- **V2 Modular Architecture Refactor Plans**: Planning documents (`docs/` and `attached_assets/`) detail a modular refactor for 6 modules (Fleet, Reports, CertSurvey, Defects, ModifyPMS, Dashboard) with independent toggle-based migration, adhering to Repository/Service/Controller pattern.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `AG Charts React`, `AG Grid Enterprise`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`, `OpenAI`
*   **Development**: `vite`, `typescript`, `drizzle-kit`