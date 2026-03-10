# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS), designed to manage technical equipment maintenance, scheduling, and performance tracking. It includes Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to provide a robust, scalable solution for technical management, enhancing operational efficiency and compliance in the maritime sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
-   **Module-Based Architecture**: Backend code is organized into domain-specific modules.
-   **UUID-Based Identity System**: Canonical UUID columns are used for primary identity in foreign key relationships.
-   **Immutable Tables**: Certain tables (e.g., `component_maintenance_history`) are INSERT-only audit trails enforced by database triggers.
-   **Dual Migration System**: Combines frozen code-based migrations (`server/migrations.ts`) with auto-generated Drizzle SQL migrations (`migrations/*.sql`). Schema changes are made in `shared/schema.ts`.
-   **Migration Discipline Rule**: Every new column in `shared/schema.ts` requires a corresponding, idempotent migration in `server/migrations.ts`.
-   **Database Safety Patterns**: Migrations include safety guards (`IF NOT EXISTS`, `IF EXISTS`) and orphan cleanup.
-   **API Route Prefix**: All API endpoints use the `/technical/api` prefix.
-   **Vessel Data Source Strategy**: Supports fetching vessel data from local and external sources with fallback.
-   **Domain Parameter Requirement**: All external master data API calls require an explicit `domain` parameter.

### Tech Stack
-   **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter.
-   **Backend**: Express.js, TypeScript, Drizzle ORM.
-   **Database**: PostgreSQL 16.
-   **AI**: OpenAI GPT-4o.
-   **Storage**: Replit Object Storage.

### UI/UX Standards
-   Mobile-first responsive design.
-   AG Charts React for visualizations and AG Grid Enterprise for data tables.
-   Consistent `p-6` padding and `space-y-6` vertical spacing.
-   Delta UI Pattern for mapping/selection dialogs.
-   Work Order forms are single-page scrollable interfaces with numbered subsections.
-   Dashboard charts display real database data.
-   **Color Scheme**: Specific colors defined for navigation, text, borders, and backgrounds.
-   **Typography**: Defined font sizes and weights for titles, headers, and labels.
-   **Component Styling**: Standardized styling for gauge, donut, and trend charts.
-   **Table Styling**: Specific styling for overdue and dot matrix tables including headers and zebra striping.
-   **Interactive Elements**: Toggles use pill shapes; cards have white backgrounds and subtle shadows.
-   **Scrollbars**: Custom WebKit scrollbar styling.

### Feature Specifications
-   **Spare-Component Sibling Link Distribution**: Spares linked to a component are automatically linked to all sibling components.
-   **Fleet Table Schema Contract**: All `fleet_*` tables must include mandatory columns like `uuid`, `sortOrder`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, and `isSync`.
-   **Bulk Import Maker Validation**: Component bulk import validates makers against `maker_list`, preventing new maker creation.
-   **Bulk Import Summary Report**: After any bulk import, an `ImportSummaryModal` displays statistics, row-by-row status, and an option to export to Excel.
-   **Equipment/System Department Validation**: The Equipment / System Department field is restricted to 6 predefined values, validated both frontend and backend.
-   **Maker Searchable Dropdown**: Maker fields across all Spares forms use a searchable dropdown linked to `maker_list`, auto-filling Maker Code.
-   **Inventory Transaction Location Picker**: Features interactive, searchable combobox dropdowns for selecting and creating locations.
-   **Component Mandatory Field Validation**: Add/Edit Component forms enforce 10 mandatory fields with conditional logic.
-   **RH Counter Type & Source Selection**: Components can define `rhCounterType` and `rhMasterComponentId`, with searchable dropdowns for source selection when "Inherited".
-   **Component Tree Sort Order & Cross-Level Drag-Drop**: Supports drag-and-drop reordering and reparenting in the component tree.
-   **Component, Job, Spare, and Store Item Deactivation (Soft Delete)**: Functionality for soft-deleting various entities, making them inactive but retaining data, with specific rules for dependencies and visibility. Reactivation is possible for spares and store items.
-   **Work Order Part B Validation & Integrity Rules**: Enforces 8 validation rules including read-only states, character limits, draft save logic, and audit trails.
-   **Work Order B1 Field Name Mapping**: Frontend state keys map to different DB schema column names for B1 fields.
-   **Work Order Attachment Display**: Attachments are displayed with icon-only rows for download, view, and delete.
-   **Completed WO Read-Only Enforcement**: When a Work Order is "Completed", all Part B fields become read-only.
-   **Spares By Location Independent Sync**: `spare_location_stock` syncs Location A and Location B independently.
-   **Work Order B4 Spare Consumption Flow**: Spare consumption is recorded at save but inventory deduction occurs at approval time.
-   **Skipped Cycle Detection (Layer 1)**: Calculates and stores `missed_cycles` on work order completion.
-   **Next Due Date Correction (Layer 2)**: Calculates `nextDueDate` using `originalDueDate` to prevent schedule drift.
-   **Mandatory Backfill of Skipped Work Orders (Layer 3)**: Automatically creates SKIPPED history records for missed cycles in `component_maintenance_history`.
-   **Mandatory CE Justification for Skipped Cycles (Layer 4B)**: Requires a written justification from the Chief Engineer for approving WOs with missed cycles.
-   **Live Missed Cycles on WO List**: `missedCycles` calculated on-the-fly for overdue/due WOs in the list view.
-   **Auto-Populated Maintenance History Remarks**: Remarks are auto-populated for maintenance history based on `missedCycles`.
-   **Next Due Date Roll-Forward**: `calculateNextDueDate()` rolls forward to ensure next due dates are always in the future.
-   **Read-Only AES-Encrypted LocalStorage**: Auth system reads AES-encrypted keys from `localStorage` but does not write to it.
-   **Automatic UI Role Detection**: UI role is auto-detected on load with a priority chain and can be overridden by a dropdown switcher.
-   **User Role System**: Supports `UserRole` types ("Ship", "Office", "PMS Admin", "Sail Admin") with specific permissions.

## External Dependencies

-   **Frontend Libraries**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`, `crypto-js`.
-   **Backend Libraries**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
-   **Development Tools**: `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **AI Services**: OpenAI GPT-4o.