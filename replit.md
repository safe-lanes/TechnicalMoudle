# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Development Rule - Drizzle-Only Migration Policy (Permanent)**:
All future database schema changes MUST follow this policy without exception:

1. **Migration Type (Mandatory)**:
   - Use Drizzle file-based SQL migrations ONLY
   - All migrations must be generated using `drizzle-kit generate`
   - Every schema change must result in a `.sql` file inside the `/migrations` directory

2. **Prohibited Approaches (Never Use)**:
   - No code-based migrations inside `server/migrations.ts`
   - No JSON-driven or object-based migrations
   - No embedded CREATE TABLE or ALTER TABLE SQL executed from TypeScript
   - No "baseline" or full schema snapshot migrations for incremental changes

3. **Incremental Migration Rules**:
   - New tables → dedicated migration file
   - New columns → ALTER TABLE ADD COLUMN
   - Index changes → separate migration
   - Enum updates → isolated migration
   - One logical change per migration file

4. **Migration Tracking**:
   - Rely exclusively on Drizzle's migration tracking
   - Do NOT introduce or extend custom migration tracking logic
   - Do NOT duplicate migration state between code and SQL

5. **Workflow**:
   - Update `shared/schema.ts` with schema changes first
   - Run `drizzle-kit generate` to create the migration SQL file
   - Review the generated SQL before applying

Note: Existing migrations 001-016 in `server/migrations.ts` remain functional for backward compatibility but no new code-based migrations should be added.

## System Architecture
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store.

**UI/UX Decisions**:
- Emphasizes a mobile-first and responsive design philosophy.
- Utilizes AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are single-page, scrollable designs with numbered subsections, styled to reflect professional maritime aesthetics.
- AG Grid Enterprise is used for Certificates & Surveys tables, featuring custom styling and inline date editing.

**UI Layout Standardization (January 2026)**:
- TechnicalModule provides `p-6` padding to the main content area - individual pages should NOT add extra p-6
- Standard page root: `<div className="space-y-6">` for consistent 24px vertical spacing
- Standard header: `<div className="flex items-center justify-between">` with title left, action buttons right
- Primary action buttons: Green (#5dc86f) for add/create actions
- Secondary action buttons: Blue (#52baf3) for sync/export actions
- TopMenuBar: All menu items have fixed 110px width to prevent dropdown position shifts
- Centered pill-style tabs: `bg-gray-100` background with blue (#52baf3) active state
- Full-height flex layouts (like Defects, Cert & Surveys): Use `h-full flex flex-col` with `mb-4` or `mb-6` for header spacing

**Technical Implementations & Key Features**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations.
- **PMS Submodules**: Offers comprehensive CRUD functionalities for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7. Features a Part A/B/C structured form with target date extension workflow.
- **Spares Module**: Comprehensive inventory management with many-to-many linking between spares and components, location-based stock tracking, and a full audit trail. Uses three event types: RECEIVE (inbound), CONSUME (outbound), and ADJUSTMENT (stock corrections).
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates and enhanced validation), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Fleet Admin Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema**: Utilizes PostgreSQL triggers for immutability constraints and includes new tables/enhancements.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **Centralized RH Update Architecture**: All running hours updates are routed through `server/postgresStorage.ts`.
- **Work Order Completion**: Automates maintenance history creation and job cycle date updates upon approval.
- **Master-Slave Parity**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact field parity.
- **Part A Immutability**: Work Order Part A is read-only for existing work orders.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix for namespace separation.
- **Change Request Workflow**: Implements an "Apply Approved Changes" step where approved changes are automatically applied to the target PMS entity within a database transaction for atomicity.
- **ROB Lookup Reference Correction**: Fixed ROB fetch logic to use `PartCode` as the primary lookup key, with fallback to `PartNumber` for backward compatibility.
- **Work Order Approval Spare Consumption Fix**: Ensured spare parts listed in B4 (Consumed Spare Parts) are deducted from inventory upon work order approval by adding consumption logic to the PATCH `/technical/api/work-orders/:id` route.
- **Ship Certificates Admin Module**: Admin sub-module for managing ship certificate requirements with a 3-tab interface (Master, Company, Vessel), including configurable categories, groups, and company labels. Company tab persists company-specific fields (Company ID, Company Group, Company Sequence) to the database. Vessel tab features a searchable multi-select dropdown that fetches vessel options from Vessel Master (Admin > Masters, ID:001), with "All Vessels" toggle and auto-selection on load. Vessel tab shows Company certificates with interactive "Applicable" checkbox - all certificates default to checked (applicable) for new vessels, stored in vessel_certificate_applicability table. Multi-vessel conflict detection displays warning when selected vessels have different applicability settings and disables editing until vessels with matching configurations are selected.

- **Certificate ID Format (January 2026)**: Certificate Master IDs use prefixes to distinguish origin and prevent conflicts:
  - **Master certificates**: Format `{category}-{seq}` (e.g., `A1-001`, `B10-004`) - from central Master list
  - **Company certificates**: Format `CMP-{seq}` (e.g., `CMP-001`, `CMP-002`) - company-specific additions with auto-generated IDs
  - **Vessel certificates**: Format `VES-{seq}` (e.g., `VES-001`, `VES-002`) - vessel-specific additions with auto-generated IDs
  This prefixed ID system ensures no conflicts between Master, Company, and Vessel-added certificates. When a company adds a new certificate, the system auto-generates the next `CMP-` ID and automatically creates applicability records for all vessels with `is_applicable=true`. When a vessel-specific certificate is added, the system auto-generates the next `VES-` ID and creates applicability records only for the selected vessels.
- **Certificates Display Integration (January 2026)**: The Cert & Surveys Certificates page now displays certificates from the Admin module configuration. Data is sourced from three joined tables: `vessel_certificate_applicability` (which certs are applicable per vessel), `ship_certificates_master` (certificate details with Company ID, Name, Company Group, Company Sequence), and `vessel_certificate_data` (per-vessel dates and attachments). Only applicable certificates are displayed, ordered by Company Sequence. API returns paginated results (default 100 entries) with format `{ certificates: [], total, page, limit, totalPages }`. Certificate updates use compound key format `vesselId-masterId` for PATCH operations. Column headers: "Company ID" (from companyId), "Name of Certificate" (certificateLabel), "Company Group" (companyGroup). Date edits and attachments are stored in `vessel_certificate_data` table.
- **Ship Surveys Admin Module (January 2026)**: Admin sub-module for managing ship survey requirements with a 3-tab interface (Master, Company, Vessel). Master tab features full CRUD functionality with HTML table, search/category/group filters, edit mode with inline editing, and Configure Labels modal for customizing category/group labels. Survey IDs follow same prefixed format as certificates (`{category}-{seq}` for Master, `CMP-{seq}` for Company, `VES-{seq}` for Vessel). Database uses 4 tables: `ship_surveys_master`, `ship_surveys_labels_config`, `vessel_survey_applicability`, `vessel_survey_data`. Key features: masterId recomputed after sequence changes, delete operations persist with error handling. Vessel tab features multi-select vessel dropdown (from Vessel Master), conflict detection for differing applicability settings across selected vessels, and "Add Survey" functionality for vessel-specific VES-xxx surveys. VES-xxx surveys are persisted to ship_surveys_master with auto-generated applicability records for target vessels only.
- **Surveys Display Integration (January 2026)**: The Cert & Surveys Surveys page now displays surveys from the Admin module configuration, following the same pattern as Certificates. Data is sourced from three joined tables: `vessel_survey_applicability` (which surveys are applicable per vessel), `ship_surveys_master` (survey details with Company ID, Name, Company Group, Company Sequence), and `vessel_survey_data` (per-vessel dates and attachments). Only applicable surveys are displayed, ordered by Company Sequence. API returns paginated results with format `{ surveys: [], total, page, limit, totalPages }`. Survey updates use compound key format `vesselId-masterId` for PATCH operations. Date columns: surveyDate, dueDate, firstRangeDate, secondRangeDate, postponed.
- **Standard Sequencing Component (January 2026)**: Both Ship Certificates Admin and Ship Surveys Admin use a **number input field** for sequence reordering in edit mode. This is the standard pattern for all admin tables: a "Sequence" column header with an `<Input type="number">` that allows users to type a sequence number directly. When the value changes (on blur), the system automatically reorders other items to accommodate the new position. The old up/down arrow buttons pattern is deprecated and should not be used for future implementations.
- **Database Migration Strategy**: Uses a dual migration system with Drizzle-generated baseline migrations and custom `ALTER TABLE` migrations managed in `server/migrations.ts` for incremental schema changes. New columns must be added to both `shared/schema.ts` and `server/migrations.ts`.
=======
- **Database Migration Strategy**: Uses Drizzle file-based SQL migrations exclusively. All schema changes require updating `shared/schema.ts` first, then running `drizzle-kit generate` to create migration files. Legacy migrations 001-016 in `server/migrations.ts` remain for backward compatibility only - no new code-based migrations should be added.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`