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
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7. Features Part A/B/C structured form with target date extension workflow (B5 section) enabling ship staff to request deadline extensions from office users with approval tracking.
- **Spares Module**: Comprehensive inventory management with many-to-many linking between spares and components, location-based stock tracking, and a full audit trail.
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