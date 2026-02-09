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
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store.

**UI/UX Decisions**:
- Emphasizes a mobile-first and responsive design philosophy.
- Utilizes AG Charts React for interactive data visualizations and AG Grid Enterprise for tables, with custom styling and inline editing.
- Work Order forms are single-page, scrollable designs with numbered subsections.
- Standardized UI layout includes `p-6` padding for main content, `<div className="space-y-6">` for vertical spacing, consistent header patterns, and specific color codes for action buttons.
- Menu items have fixed widths, and tabs use a specific background and active state styling.

**Technical Implementations**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations.
- **PMS Submodules**: Offers comprehensive CRUD for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7, with a structured form and target date extension workflow.
- **Spares Module**: Comprehensive inventory management with many-to-many linking, location-based stock tracking, and audit trails using RECEIVE, CONSUME, and ADJUSTMENT event types.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import, data purging, and a Fleet Admin Dashboard with Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix.
- **Change Request Workflow**: Implements an "Apply Approved Changes" step with atomic database transactions.
- **Ship Certificates Admin Module**: Manages ship certificate requirements with a 3-tab interface (Master, Company, Vessel), configurable categories/groups, and prefixed ID formats (`{category}-{seq}`, `CMP-{seq}`, `VES-{seq}`). Integrates with `vessel_certificate_applicability`, `ship_certificates_master`, and `vessel_certificate_data` for display on the Cert & Surveys page.
- **Ship Surveys Admin Module**: Manages ship survey requirements with a similar 3-tab interface, CRUD functionality, and prefixed ID formats as certificates. Integrates with `vessel_survey_applicability`, `ship_surveys_master`, and `vessel_survey_data` for display on the Cert & Surveys page.
- **Standard Sequencing Component**: Admin tables use a number input field for sequence reordering, automatically adjusting positions on blur.
- **Database Migration Strategy**: Exclusively uses Drizzle file-based SQL migrations.
- **Vessel Data Source Strategy**: Employs a unified `useVessels()` hook prioritizing local PMS data with fallback to an external master-data API.
- **ROB Location Stock Synchronization**: Implemented dual-write synchronization between legacy ROB fields and the normalized `spare_location_stock` table for consistent inventory.
- **Excel Report Standardization**: All Maintenance & Work Order Excel exports use a standardized 18-column template (`STANDARD_WORK_ORDER_COLUMNS` in `server/lib/excelReportStyles.ts`) with status-based full-row highlighting. Color scheme: Light/Dark Orange (due), Light/Dark Red (overdue), Light/Dark Green (completed), Light/Dark Yellow (unplanned), Light/Dark Blue (postponed). Critical Equipment rows use darker color variants. Key rules: Days Left vs Days Overdue are mutually exclusive (show "-" for the other); Running Hours columns show "-" for Calendar-based jobs.
- **Job Postponement Log Report (Report 1.7)**: Uses dedicated `work_order_postponements` history/audit table to track all postponements. Custom 19-column format includes postponement number, original/new due dates, duration, reason, authorization, approval status, and office notification. Supports multiple postponements per work order as audit trail. Excel export at `/technical/api/reports/postponement-log` with Sky Blue highlighting for postponed rows.
- **Running Hours Anomaly Detection Report**: Analyzes `running_hours_audit` table to identify unusual patterns. Detects 5 anomaly types: High Increment (>24 hrs/day = Critical), Negative Delta (Critical), Zero Change >7 days (Warning), Irregular Pattern 3x spike (Warning), and Meter Replacement (Info). API at `/technical/api/reports/running-hours-anomaly-detection` with Excel export via POST. Uses severity-based row coloring (red=Critical, yellow=Warning, blue=Info). **Critical note**: Drizzle schema field names are case-sensitive - use `enteredAtUTC`, `previousRH`, `newRH` (not lowercase variants).
- **Chemicals Inventory & Expiry Tracking**: Extended `stores_items` table with 16 chemical-specific fields (expiry/manufacture dates, batch/lot numbers, shelf life, SDS reference/URL/last updated, hazard classification, UN number, flash point, storage temp range, disposal instructions, PPE requirements, emergency contact). All fields are nullable for backward compatibility. API endpoint at `/technical/api/reports/chemicals-expiry/:vesselId` returns enriched items with computed fields (daysUntilExpiry, expiryStatus, stockStatus, hasSds). Stores.tsx Add/Edit forms show chemical-specific sections (Expiry & Date Info, SDS, Storage & Safety) only when chemicals tab is active. Full report page at `ChemicalsExpiryReport.tsx` with summary cards, expired/expiring alerts, sortable inventory table, SDS compliance tracking, hazard classification breakdown, and PDF export.
- **Consumption Pattern Analysis Report (Tile 4.3)**: Aggregates `spares_history` CONSUME events joined with `spares` master data. API at `/technical/api/reports/consumption-analysis/:vesselId` (GET for JSON, POST `/excel` for Excel export). Exactly 10 columns: S.No, Part Code, Part Name, Component, Total Consumed, Consumption Events, Current ROB, Min Stock, Status (Critical/Normal), Last Consumed (DD-MMM-YYYY). Sorted by Total Consumed DESC then Part Code ASC. PDF generated client-side via `pdfReportGenerator` in landscape orientation. Both PDF and Excel use the same API data source ensuring identical output.
- **Low Stock Alert Report (Stores/Lubes/Chemicals)**: Monitors stores inventory items below minimum stock levels. API at `/technical/api/reports/stores-low-stock-alert/:vesselId` (GET for JSON with category/priority/location query filters, POST `/excel` for Excel export). Priority classification: Critical (ROB=0), High (ROB < 50% of Min), Medium (ROB >= 50% of Min and <= Min). Calculates average monthly consumption from `stores_ledger` CONSUME events (last 90 days), days until stockout, deficit quantities, and estimated reorder costs. Frontend at `LowStockAlertReport.tsx` with 8 summary cards (2 rows), 3 priority alert sections (Critical/High/Medium with colored alert boxes), full sortable table with 15 columns, category breakdown visual bars, recommended actions box, and PDF/Excel export. **Important**: `stores_items.item_type` uses 'lubes' (not 'lubricants') in the database - all filters and counts handle both variants. Note: A separate spares-based low-stock endpoint exists at `/technical/api/reports/low-stock-alert/:vesselId` for the Spares module.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`