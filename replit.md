# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS), designed to manage equipment maintenance, scheduling, and performance tracking. It includes Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to provide a robust, scalable solution for technical management, enhancing operational efficiency and compliance in the maritime sector. Key capabilities include comprehensive technical data management, automated maintenance scheduling, compliance monitoring, and advanced reporting. The business vision is to minimize vessel downtime, optimize operational costs, and ensure regulatory adherence for maritime organizations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
-   **Module-Based Architecture**: Backend code is organized into domain-specific modules.
-   **UUID-Based Identity System**: Canonical UUID columns are used for primary identity in foreign key relationships.
-   **Immutable Tables**: Certain tables (e.g., `component_maintenance_history`) are INSERT-only audit trails.
-   **Dual Migration System**: Combines frozen code-based migrations (`server/migrations.ts`) with auto-generated Drizzle SQL migrations (`migrations/*.sql`). Schema changes are made in `shared/schema.ts`.
-   **Migration Discipline Rule**: Every new column in `shared/schema.ts` requires a corresponding, idempotent migration in `server/migrations.ts` in the same code change.
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
-   Mobile-first responsive design with consistent padding and spacing.
-   AG Charts React for visualizations and AG Grid Enterprise for data tables.
-   Delta UI Pattern for mapping/selection dialogs.
-   Work Order forms are single-page scrollable interfaces with numbered subsections.
-   Dashboard charts display real database data.
-   **Color Scheme**: Specific colors defined for navigation, text, borders, and backgrounds.
-   **Typography**: Defined font sizes and weights for titles, headers, and labels.
-   **Component Styling**: Standardized styling for various chart types and interactive elements.
-   **Table Styling**: Specific styling for overdue and dot matrix tables.
-   **Scrollbars**: Custom WebKit scrollbar styling.

### Feature Specifications
-   **Spare-Component Sibling Link Distribution**: Spares linked to a component are automatically linked to all sibling components.
-   **Fleet Table Schema Contract**: All `fleet_*` tables must include mandatory columns like `uuid`, `sortOrder`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, and `isSync`.
-   **Bulk Import Functionality**: Includes maker validation against `maker_list` and displays an `ImportSummaryModal` with statistics and row-by-row status after import.
-   **Equipment/System Department Validation**: Field restricted to 6 predefined, validated values.
-   **Maker Searchable Dropdown**: Auto-fills Maker Code from `maker_list`.
-   **Inventory Transaction Location Picker**: Interactive, searchable comboboxes for selecting and creating locations.
-   **Component Mandatory Field Validation**: Add/Edit Component forms enforce 10 mandatory fields with conditional logic.
-   **RH Counter Type & Source Selection**: Components can define `rhCounterType` and `rhMasterComponentId` with searchable dropdowns.
-   **Period-Based Utilization Rate**: Calculated using a two-point meter reading formula: `min(((currentRH - rhAtPeriodStart) / maxPeriodHours) × 100, 100)`. Uses rolling windows (7/30/90/365 days). Fallback logic: if no audit entry before period start, uses oldest available entry; if no audit history exists, uses 0 as baseline. Returns metadata (rhAtPeriodStart, periodStartDate, maxPossibleHours, dataQualityWarning, averageDailyHours) for detailed tooltip. Color coding: gray (0%), green (0.1-50%), yellow (51-75%), orange (76-90%), red (91-100%). Warning indicators for data quality issues (meter reset, capped at 100%, no baseline).
-   **Component Tree Management**: Supports drag-and-drop reordering and reparenting.
-   **Soft Delete for Entities**: Functionality for deactivating Components, Jobs, Spares, and Store Items, retaining data with specific rules for dependencies and visibility.
-   **Work Order Part B Validation & Integrity Rules**: Enforces 8 validation rules including read-only states, character limits, draft save logic, and audit trails.
-   **Work Order Attachment Display**: Attachments displayed with icon-only rows for download, view, and delete.
-   **Completed WO Read-Only Enforcement**: All Part B fields become read-only upon Work Order completion.
-   **Spares By Location Independent Sync**: `spare_location_stock` syncs Location A and Location B independently.
-   **Work Order B4 Spare Consumption Flow**: Consumption recorded at save, inventory deduction at approval.
-   **Skipped Cycle Detection (Layer 1)**: Calculates and stores `missed_cycles` on work order completion.
-   **Next Due Date Calculation**: `calculateNextDueDate()` uses the actual completion date as the base: `nextDueDate = completionDate + frequencyInterval`.
-   **Mandatory Backfill of Skipped Work Orders (Layer 3)**: Automatically creates SKIPPED history records for missed cycles in `component_maintenance_history`.
-   **Mandatory CE Justification for Skipped Cycles (Layer 4B)**: Requires a written justification from the Chief Engineer for approving WOs with missed cycles.
-   **Tiered Approval Workflow Hardening (Layer 5)**: Adds 4 approval tiers based on days late and missed cycles, with varying justification requirements and superintendent notifications. Includes a Superintendent dashboard page.
-   **Compliance Anomaly Detection (Layer 6)**: Dashboard-level panel surfacing red flags by analyzing work order patterns (Cycle Skip Rate, Backdating Frequency, Bulk Completion Events, Schedule Drift). Role-based visibility and detailed modals.
-   **Work Order Anomaly Detection System (Layer 6 Extension)**: Persistent anomaly detection system logging individual anomaly events (BACKDATING, MISSED_CYCLES, SUSPICIOUS_PATTERN) with severity (HIGH/MEDIUM/LOW) upon WO completion. High severity anomalies generate superintendent notifications.
-   **Running Hours Validation & Isolation (Layer 7)**: Work orders store read-only RH snapshots. Timeline-based validation uses forward + backward checks (max 24 hrs/day). High utilization requires mandatory justification. Includes real-time RH input validation, valid range helper text, and a RH Timeline Viewer.
-   **Live Missed Cycles on WO List**: `missedCycles` calculated on-the-fly for overdue/due WOs.
-   **Auto-Populated Maintenance History Remarks**: Remarks are auto-populated for maintenance history based on `missedCycles`.
-   **A4 Work History Display**: Displays the current WO's own maintenance history record and non-skipped records from other WOs.
-   **UI Role Detection (Single Source of Truth)**: UI role is determined by `mapLoggedRoleToUIRole(userType, profileRole)` for consistent role mapping.
-   **User Role System**: Supports 7 `UserRole` values ("Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin", "Vessel User").
-   **Role Master Table (admn_role_master)**: Seeds 15 role records during migration.

## External Dependencies

-   **Frontend Libraries**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`, `crypto-js`.
-   **Backend Libraries**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
-   **Development Tools**: `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **AI Services**: OpenAI GPT-4o.