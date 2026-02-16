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
- Interactive data visualizations with AG Charts React and tables with AG Grid Enterprise.
- Single-page, scrollable Work Order forms with numbered subsections.
- Standardized UI elements for padding, spacing, headers, buttons, menu items, and tabs.

**Technical Implementations**:
- **Core PMS Logic**: Manages immutable Job templates and executable Work Orders with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations.
- **PMS Submodules**: Comprehensive CRUD for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrates with SIRE VIQ 7, includes structured forms and target date extension workflow.
- **Spares Module**: Inventory management with many-to-many linking, location-based stock tracking, and audit trails.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import, data purging, and a Fleet Admin Dashboard with Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Component Document Storage**: File uploads handled via Replit Object Storage.
- **API Route Prefix**: All API endpoints use `/technical/api`.
- **Change Request Workflow**: Features an "Apply Approved Changes" step with atomic database transactions.
- **Ship Certificates/Surveys Admin Module**: Manages requirements with a 3-tab interface, configurable categories/groups, and prefixed ID formats.
- **Standard Sequencing Component**: Admin tables use a number input for reordering with automatic position adjustment.
- **Database Migration Strategy**: Exclusively uses Drizzle file-based SQL migrations.
- **Vessel Data Source Strategy**: Unified `useVessels()` hook prioritizes local PMS data with fallback to an external master-data API.
- **Identity Restructuring (Components, Jobs, Vessels, Work Orders, Spares — All Complete)**: Implemented UUID-based canonical identifiers (`cuuid`, `juuid`, `vuuid`, `wouuid`, `suuid`) for Components, Jobs, Vessels, Work Orders, and Spares, alongside serial integer primary keys. All five entities have completed their identity restructuring. Spares migration (Phases 1-3 only, Phase 4 not needed since `spares.id` was already INTEGER): `suuid` column (migration 0032), FK constraints on 4 child tables via `spare_uuid` column (migration 0033), full code refactoring of legacy `postgresStorage.ts`, V2 repository/service/controller/routes, and frontend. All server/frontend code uses `suuid` for identity lookups. Child tables (`spares_history`, `spare_component_links`, `spare_location_stock`, `inventory_transactions`) have parallel `spare_id` (integer, transition) and `spare_uuid` (UUID FK to `spares.suuid`) columns.
- **ROB Location Stock Synchronization**: Dual-write synchronization between legacy ROB fields and `spare_location_stock`.
- **V2 Modular Architecture**: A self-contained V2 architecture is implemented for Components, Bulk Upload, Jobs, Work Orders, Spares, Running Hours, and Stores modules. This architecture uses direct Drizzle ORM queries, avoids legacy dependencies, defines isolated `pgTable` schemas, and uses zero file-based storage (SFI data in-memory, dry-run cache in-memory, documents via Replit Object Storage). It features a repository-service-controller-routes layer separation and dedicated API prefixes (`/technical/api/v2/*`). A frontend toggle allows runtime switching between legacy and V2 APIs.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`