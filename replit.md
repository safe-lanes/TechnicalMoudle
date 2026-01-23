# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Development Rule**: Whenever adding new database columns for any feature update, change, or addition, ALWAYS add a corresponding migration file to the `migrations/` folder. This ensures schema changes are tracked and can be applied automatically to any environment.

## System Architecture
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store.

**UI/UX Decisions**:
- Emphasizes a mobile-first and responsive design philosophy.
- Utilizes AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are single-page, scrollable designs with numbered subsections, styled to reflect professional maritime aesthetics.
- AG Grid Enterprise is used for Certificates & Surveys tables, featuring custom styling and inline date editing.

**Technical Implementations & Key Features**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations, including an "Outstanding Tasks" pie chart.
- **PMS Submodules**: Offers comprehensive CRUD functionalities for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations. Includes daily increase limit validation (max 25 hours × number of days since last update), same-day duplicate prevention (only one update per component per day allowed), and PMS Admin override capability for exceptional cases.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7. Features Part A/B/C structured form with target date extension workflow (B5 section) enabling ship staff to request deadline extensions from office users with approval tracking.
- **Spares Module**: Comprehensive inventory management with many-to-many linking between spares and components, location-based stock tracking, and a full audit trail. Uses three event types: RECEIVE (inbound), CONSUME (outbound), and ADJUSTMENT (stock corrections). Direct ROB edits that change net total create ADJUSTMENT events; transfers between locations without net change create TRANSFER events.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates and enhanced validation), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Fleet Admin Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema**: Utilizes PostgreSQL triggers for immutability constraints and includes new tables/enhancements.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **Centralized RH Update Architecture**: All running hours updates are routed through `server/postgresStorage.ts` for consistency.
- **Work Order Completion**: Automates maintenance history creation and job cycle date updates upon approval.
- **Master-Slave Parity**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact field parity.
- **Part A Immutability**: Work Order Part A is read-only for existing work orders.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix for namespace separation.
- **Change Request Workflow** (2026-01-21): Complete implementation of "Apply Approved Changes" step. When a Change Request is approved, the system now automatically applies the proposed changes to the target PMS entity (Component, Job, Work Order, Spare, or Store). The entire approval + apply workflow is wrapped in a database transaction for atomicity - if any step fails, all changes are rolled back. The revision history tracks applied status (success/failed), timestamp, field count, and any error messages. Key implementation details:
  - **Field Definitions** (`shared/changeRequestFields.ts`): Maps display names to actual database column names (camelCase matching Drizzle schema property names) for Components, Jobs, Work Orders, Spares, and Stores
  - **Target Entity API**: `/technical/api/change-requests/target-entity/:type/:id` returns entity data with current field values for form auto-population
  - **Legacy Field Translation**: The apply handler translates old-style nested field paths (e.g., `componentInfo.serialNo`) to direct column names (e.g., `serialNo`) for backward compatibility
  - **Before/After Verification**: All apply handlers use `.returning()` to verify updates succeeded and log field-by-field comparisons
  - **ROB Protection**: Spares and Stores ROB fields are marked as non-editable to enforce use of dedicated adjustment methods
- **ROB Lookup Reference Correction** (2026-01-22): Fixed ROB (Remaining On Board) fetch logic to use Part Code instead of Part Number as the primary lookup key. This resolves issues where spares with empty/NULL Part Numbers couldn't have their inventory data fetched. Key implementation details:
  - **Primary Key**: `partCode` is the required unique identifier in the spares table; `partNumber` is optional (manufacturer's reference)
  - **Dual Lookup Strategy**: ROB enrichment first tries Part Code lookup, then falls back to Part Number for backward compatibility with legacy data
  - **Storage Function**: `getSpareInventoryByPartCodes()` added to postgresStorage.ts for efficient Part Code-based inventory queries
  - **Bulk Import Update**: `parseSpareParts()` now stores `partCode` as a proper field in requiredSpareParts JSON structure
  - **Backward Compatibility**: Legacy jobs with only `partNo` stored continue to work via the Part Number fallback mechanism

- **Work Order Approval Spare Consumption Fix** (2026-01-23): Fixed critical bug where spare parts listed in B4 (Consumed Spare Parts) were not being deducted from inventory when work orders were approved. The fix adds spare consumption logic to the PATCH `/technical/api/work-orders/:id` route that mirrors the existing POST `/complete` route. Key implementation details:
  - **Root Cause**: Frontend uses PATCH route for approvals but spare consumption only existed in POST /complete route
  - **Multi-Step Lookup**: Consumes use partCode → partNo as partCode → partNo as partNumber lookup strategy for backward compatibility
  - **Transaction Creation**: Creates CONSUME inventory_transactions with WORK_ORDER reference and work order ID
  - **Error Handling**: Logs warnings for missing locationId, insufficient stock, or unfound spares but doesn't fail approval
  - **Location**: `server/routes.ts` lines 3336-3423 (approx) - inside PATCH approval+completed condition block

- **Ship Certificates Admin Module** (2026-01-23): Admin sub-module for managing ship certificate requirements with 3-tab interface (Master, Company, Vessel). Key implementation details:
  - **Database Schema**: `ship_certificates_master` table stores admin configuration for master certificate definitions
  - **CSV Starter Kit**: Pre-populated with 71 standard maritime certificates when database is empty
  - **Master ID Format**: Auto-generated as CategoryLetter + GroupNumber + "-" + 3-digit sequence (e.g., A1-001, B10-004)
  - **API Endpoints**: GET/POST/DELETE at `/technical/api/admin/ship-certificates-master` for CRUD operations
  - **Data Persistence**: React Query handles data fetching with cache invalidation; Save button with loading state and toast notifications
  - **Immutability Rule**: Master ID and Certificate Name are read-only after creation


## Bulk Import Format Rules

### Job Import - Required Spare Parts (Column U)
**Format**: `PartCode:Qty, PartCode:Qty, PartCode:Qty` (comma-separated)

**Rules**:
1. **Separator**: Use comma (`,`) to separate multiple spare parts (semicolon `;` also supported for legacy compatibility)
2. **Format per spare**: `PartCode:Quantity` where colon (`:`) separates Part Code from quantity
3. **Part Code**: Must match existing `partCode` in `spares` table
4. **Quantity**: Integer value; defaults to 1 if missing or invalid
5. **Lookup**: System looks up each Part Code in Spares table to retrieve Part Number, Part Name

**Example**:
```
PC-001:2, PC-002:1, PC-003:4
```
This creates 3 spare parts entries:
- PC-001 with Qty Required = 2
- PC-002 with Qty Required = 1  
- PC-003 with Qty Required = 4

**Data Flow (Column U → Job A.2)**:
| Excel Input | Job A.2 Field | Source |
|-------------|---------------|--------|
| `PC-001` (before colon) | Part Number | `spares.partNumber` lookup via `partCode` |
| `PC-001` (before colon) | Description | `spares.partName` lookup via `partCode` |
| `2` (after colon) | Qty Required | From Excel input |
| N/A | ROB | Dynamic lookup from `spares.rob` at view time |
| N/A | Status | Calculated: ROB vs Qty Required |

**Important Notes**:
- ROB is **read-only** and **dynamically fetched** from Spare Master when viewing Job A.2
- Import does **NOT** consume, reserve, or create inventory transactions
- Invalid Part Codes show as `[NOT FOUND: {PartCode}]` but do not block import

**Code Location**: `server/routes/bulk.ts` - `parseStringList()` and `parseSpareParts()` functions

## Database Migration Strategy

### Migration Architecture
This project uses a **dual migration system**:
1. **Drizzle-generated baseline migrations** (`migrations/0000_*.sql`) - Created once during initial schema setup via `drizzle-kit generate`
2. **Custom ALTER migrations** (`server/migrations.ts`) - Incremental changes registered in a TypeScript migrations array

### Critical Rules for Schema Changes
1. **NEVER regenerate Drizzle baseline migrations** (`0000_overrated_natasha_romanoff.sql`) after initial database setup
2. **ALWAYS add new columns via ALTER TABLE migrations** in `server/migrations.ts`
3. **Schema definition (`shared/schema.ts`) must match database state** - add columns to both schema AND migration

### How to Add New Columns (Required Workflow)
1. Add the column definition to the appropriate table in `shared/schema.ts`
2. Add a new migration entry to the `migrations` array in `server/migrations.ts`:
```typescript
{
  id: 'NNN_descriptive_name',
  name: 'Short description',
  description: 'Detailed explanation',
  sql: `ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value`
}
```
3. Optionally create a standalone `.sql` file in `migrations/` folder for documentation

### Root Cause of 16-01-2026 Migration Issues
The `running_hours_audit` renewal columns were added to `shared/schema.ts` but Drizzle absorbed them into the baseline `CREATE TABLE` migration instead of generating separate `ALTER TABLE` migrations. This happened because:
1. Drizzle's `generate` command compares schema to existing migrations and creates comprehensive diffs
2. When run on a schema with new columns but no matching migration history, Drizzle treats changes as part of the baseline
3. The project's migration tracking in `schema_migrations` table wasn't connected to Drizzle's own tracking

### Prevention Strategy
1. All schema evolution now goes through `server/migrations.ts` (runtime ALTER migrations)
2. Never run `drizzle-kit generate` after initial setup
3. The `0000_overrated_natasha_romanoff.sql` baseline is frozen and should not be modified
4. Each new column requires BOTH schema update AND corresponding migration entry

### Migration History (Recent Changes)
- **011_c1_c2_closeout_columns** (2026-01-16): Added C1 Closeout and C2 Verification columns to `defects` table
  - `closed_out_by_name` (text)
  - `closed_out_by_rank` (text)
  - `verified` (boolean, default false)
  - `date_verified` (text)
  - `verified_by_name` (text)
  - `verified_by_office_position` (text)

- **012_running_hours_renewal_columns** (2026-01-19): Added renewal tracking columns to `running_hours_audit` table
  - `is_renewal_reset` (boolean, NOT NULL, default false)
  - `renewal_action_type` (text)
  - `renewal_reason` (text)
  - `renewal_reference` (text)
  - `renewal_evidence_urls` (json)
  - `component_code` (text)
  - `component_name` (text)
  - Index: `idx_renewal_reset` on (is_renewal_reset, vessel_id)

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`