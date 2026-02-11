# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It manages technical equipment maintenance, scheduling, and performance tracking, including Certificate & Surveys and Defect Reporting. The system aims to enhance operational efficiency, ensure regulatory compliance, and provide data-driven maintenance within the maritime industry.

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

4.  **Migration Tracking**:
    -   Rely exclusively on Drizzle's migration tracking
    -   Do NOT introduce or extend custom migration tracking logic
    -   Do NOT duplicate migration state between code and SQL

5.  **Workflow**:
    -   Update `shared/schema.ts` with schema changes first
    -   Run `drizzle-kit generate` to create the migration SQL file
    -   Review the generated SQL before applying

## System Architecture
The application features a full-stack architecture with a mobile-first, responsive design. The frontend uses React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is built with Express.js (TypeScript). PostgreSQL is the primary database.

**UI/UX Decisions**:
- Mobile-first and responsive design.
- Interactive data visualizations with AG Charts React and tables with AG Grid Enterprise (custom styling, inline editing).
- Single-page, scrollable Work Order forms with numbered subsections.
- Standardized UI elements: `p-6` padding, `space-y-6` for vertical spacing, consistent headers, specific button color codes, fixed-width menu items, and distinct tab styling.

**Technical Implementations**:
- **Core PMS Logic**: Manages immutable Job templates and executable Work Orders with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations.
- **PMS Submodules**: Comprehensive CRUD for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrates with SIRE VIQ 7, includes structured forms and target date extension workflow.
- **Spares Module**: Inventory management with many-to-many linking, location-based stock tracking, and audit trails (RECEIVE, CONSUME, ADJUSTMENT events).
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import, data purging, and a Fleet Admin Dashboard with Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Component Document Storage**: File uploads handled via Replit Object Storage.
- **API Route Prefix**: All API endpoints use `/technical/api`.
- **Change Request Workflow**: Features an "Apply Approved Changes" step with atomic database transactions.
- **Ship Certificates/Surveys Admin Module**: Manages requirements with a 3-tab interface (Master, Company, Vessel), configurable categories/groups, and prefixed ID formats, integrating with relevant `vessel_` and `ship_` tables.
- **Standard Sequencing Component**: Admin tables use a number input for reordering with automatic position adjustment.
- **Database Migration Strategy**: Exclusively uses Drizzle file-based SQL migrations.
- **Vessel Data Source Strategy**: Unified `useVessels()` hook prioritizes local PMS data with fallback to an external master-data API.
- **Vessel Identity Restructure (In Progress)**: Added `vuuid` TEXT column (UNIQUE) to vessels table to separate external UUID identity from internal id. Currently both `id` and `vuuid` hold the same UUID values for backward compatibility. Sync-masters endpoint now matches on `vuuid` for upsert operations. Migration: `0008_daily_havok.sql`. Full refactor to change `id` to INTEGER auto-increment is planned but not yet implemented — requires updating 31 tables with vessel_id foreign keys and 149 files (60 server + 89 frontend).
- **ROB Location Stock Synchronization**: Dual-write synchronization between legacy ROB fields and `spare_location_stock` for consistent inventory.
- **V2 Modular Architecture**: A self-contained V2 architecture is implemented for Components, Bulk Upload, Jobs, Work Orders, Spares, Running Hours, and Stores modules. This V2 architecture uses direct Drizzle ORM queries via `getDb()`, avoids legacy dependencies, defines actual pgTable schemas in `shared/v2/` for isolation, and uses zero file-based storage (SFI data is embedded in-memory, dry-run cache uses in-memory Map with 30-min TTL, documents use Replit Object Storage). V2 schema dependency chain: Components (root definitions in `shared/v2/components/schema.ts`) → Jobs (re-exports from components) → Spares (defines v2Spares, v2SparesHistory, v2Locations, v2SpareLocationStock, v2SpareComponentLinks, v2InventoryTransactions with re-exports from components) → Work Orders (re-exports from components/jobs/spares + defines v2WorkOrders, v2WorkOrderExecutions, v2WorkOrderExecutionDetails, v2PmsVesselSettings) → Bulk (re-exports v2Components from components + defines v2MakerList, v2ImportHistory, v2ImportChangeLog, v2SfiDetails). Spare-related tables (locations, spare_component_links, spare_location_stock, inventory_transactions) are defined exclusively in the Spares schema and re-exported by Work Orders — no duplicate pgTable definitions. Server modules import exclusively from `@shared/v2/*/schema` — no server-side schema files. It features a repository-service-controller-routes layer separation and dedicated API prefixes (`/technical/api/v2/*`). A frontend toggle (`localStorage 'pms_api_version'`) allows runtime switching between legacy and V2 APIs, ensuring backward compatibility and instant rollback. The V2 Work Orders module (`server/v2/work-orders/`) includes 12 endpoints covering list, CRUD, bulk approve/reject, atomic completion with RH cascade, auto-generation with duplicate protection, status recalculation, and postponement reappearance. The V2 Spares module (`server/v2/spares/`) includes 18 endpoints covering list, CRUD, location-aware consume/receive with shortage tracking, adjust, transfer, bulk-update, history, low-stock alerts, and batch consume/receive operations. The V2 Running Hours module (`server/v2/running-hours/`) includes 10 endpoints covering parents list, children list, child RH update with 25hr/day validation, child RH reset, RH config CRUD, master RH update with delta cascade to inherited components, inherited components list, and one-time propagation. Schema in `shared/v2/running-hours/schema.ts` re-exports v2Components and defines v2RunningHoursAudit + v2ComponentRunningHoursLog. Frontend integration uses toggle-aware URL builders in `client/src/modules/components/api/workOrdersApiV2.ts` and `client/src/modules/components/api/sparesApiV2.ts` with consumer files updated (SparesNew.tsx, BulkUpdateSpares.tsx). The V2 Stores module (`server/v2/stores/`) includes 11 endpoints covering list, getById, create, update, patch, delete, consume, receive, transfer, adjust, and history (vessel-wide + per-item). Schema in `shared/v2/stores/schema.ts` defines v2StoresItems + v2StoresLedger tables with ledger-based stock tracking (CONSUME, RECEIVE, TRANSFER_IN/OUT, ADJUSTMENT, INITIAL event types). Dual-location ROB support (locationA/locationB). V2 bulk module extended for stores type with 11-column import format, validation, and template generation (?type=stores query param). Categories validated: General Stores, Electrical, Mechanical, Safety.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`