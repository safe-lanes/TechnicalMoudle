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

4.  **Migration Tracking**:
    -   Rely exclusively on Drizzle's migration tracking
    -   Do NOT introduce or extend custom migration tracking logic
    -   Do NOT duplicate migration state between code and SQL

5.  **Workflow**:
    -   Update `shared/schema.ts` with schema changes first
    -   Run `drizzle-kit generate` to create the migration SQL file
    -   Review the generated SQL before applying

Note: Existing migrations 001-016 in `server/migrations.ts` remain functional for backward compatibility but no new code-based migrations should be added.

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

## V2 Architecture (Component Module) — SELF-CONTAINED (Zero Legacy Dependencies)
A detailed V2 modular architecture plan is documented at `docs/V2-Component-Module-Refactor-Plan.md`. Implementation status and key decisions:
- **Purely Architectural**: V2 uses 100% the same business rules, validations, and data as legacy. No functional rewrite.
- **V2 Namespace**: All V2 code lives under `server/v2/`, `shared/v2/`, and `client/src/modules/` — legacy code stays untouched.
- **Self-Contained Data Access**: V2 uses direct Drizzle ORM queries via `getDb()` — zero imports from `server/storage.ts`, `server/postgresStorage.ts`, or `shared/schema.ts`. Only infrastructure imports permitted: `getDb` (from `server/db.ts`) and `objectStorageClient` (from `server/objectStorage.ts`).
- **V2 Schema Duplication**: `shared/v2/components/schema.ts` contains its own pgTable definitions (v2Components, v2Jobs, etc.) referencing the same physical SQL tables. These are query-only references — all schema management/migrations remain in legacy `shared/schema.ts`.
- **Layer Separation**: Repository (direct Drizzle queries) → Service (business logic) → Controller (HTTP concerns, Zod validation) → Routes (RESTful patterns).
- **Route Prefix**: `/technical/api/v2/components/component/*` for V2 endpoints.
- **Frontend Toggle**: `localStorage('pms_api_version')` switches between legacy and V2 API endpoints at runtime. Toggle UI visible on Components page header.
- **Backward Compatibility**: Toggle defaults to "Legacy". Both route sets always registered. Instant rollback by switching toggle — same data, same database, zero data loss.
- **Scope**: Component module only (bulk upload + CRUD + sub-entities). Other modules to follow the same pattern.
- **Backend Files**: `server/v2/components/` (repository, services, controllers, routes), `shared/v2/components/` (schema, types).
- **Frontend Files**: `client/src/modules/components/` (api/componentApiV2.ts, hooks/useApiVersion.ts, components/ComponentApiToggle.tsx).
- **Toggle-Aware Queries**: Components page main queries (component list, maintenance history, documents, class-regulatory, requisitions) all use toggle-aware URL builders that switch between legacy and V2 endpoints based on localStorage toggle state.
- **Legacy→V2 Method Mapping** (Repository layer, 25+ methods):
  - `storage.getComponents()` → `repo.getComponents()` (direct `select().from(v2Components).where()`)
  - `storage.getComponentById()` → `repo.getComponentById()` (direct query with eq filter)
  - `storage.createComponent()` → `repo.createComponent()` (direct `insert().values().returning()`)
  - `storage.updateComponent()` → `repo.updateComponent()` (direct `update().set().where().returning()`)
  - `storage.inactivateComponent()` → `repo.inactivateComponent()` (cascade: updates children, unlinks jobs, sets status)
  - `storage.setRunningHours()` → `repo.setRunningHours()` (delta propagation to INHERITED children)
  - `storage.getInheritedComponents()` → `repo.getInheritedComponents()` (vessel isolation safeguard)
  - Document/ClassReg/Requisition/History CRUD → dedicated repo methods with direct Drizzle queries
  - Bulk upload → `repo.bulkCreateComponents()` with transaction support

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`