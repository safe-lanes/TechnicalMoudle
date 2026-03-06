# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to provide a robust, scalable solution for technical management in the maritime sector, improving operational efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
-   **Module-Based Architecture**: Backend code is organized into domain-specific modules (`server/modules/`) with `routes.ts` and optional `schemas.ts`.
-   **UUID-Based Identity System**: Uses canonical UUID columns for primary identity in foreign key relationships.
-   **Immutable Tables**: Certain tables (e.g., `component_maintenance_history`) are INSERT-only audit trails enforced by database triggers.
-   **Dual Migration System**: Combines 52 frozen code-based migrations (`server/migrations.ts`) with auto-generated Drizzle SQL migrations (`migrations/*.sql`). Schema changes are made in `shared/schema.ts`.
-   **Database Safety Patterns**: Migrations include safety guards (`IF NOT EXISTS`, `IF EXISTS`) and orphan cleanup.
-   **API Route Prefix**: All API endpoints use the `/technical/api` prefix.
-   **Vessel Data Source Strategy**: Supports fetching vessel data from local and external sources with fallback mechanisms.
-   **Domain Parameter Requirement**: All external master data API calls require an explicit `domain` parameter from the frontend.

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

### Dashboard Visual Design Language (Audit-Reference Style)
-   **Color Scheme**: Specific colors defined for navigation (white, medium blue), text, borders, and backgrounds.
-   **Typography**: Defined font sizes and weights for titles, headers, and labels.
-   **Component Styling**: Gauge charts use gray arcs and semantic colors; donut charts have a thin ring style; trend charts are line charts with CartesianGrid.
-   **Table Styling**: Overdue table has a dark navy header, specific column widths, and zebra striping. Dot matrix tables have distinct metric and vessel header styling.
-   **Interactive Elements**: Toggles use pill shapes with distinct active/inactive styles. Cards have white backgrounds and subtle shadows.
-   **Scrollbars**: Custom WebKit scrollbar styling for `overflow-x-auto` elements.

### Feature Specifications
-   **Spare-Component Sibling Link Distribution**: Spares linked to a component are automatically linked to all sibling components.
-   **Fleet Table Schema Contract**: All `fleet_*` tables must include mandatory columns like `uuid`, `sortOrder`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, and `isSync`.
-   **Bulk Import Maker Validation**: Component bulk import validates makers against `maker_list`, preventing new maker creation.
-   **Bulk Import Summary Report**: After any bulk import, an `ImportSummaryModal` displays statistics, row-by-row status, and an option to export to Excel.
-   **Equipment/System Department Validation**: The Equipment / System Department field is restricted to 6 predefined values, validated both frontend and backend.
-   **Maker Searchable Dropdown**: Maker fields use a searchable dropdown linked to `maker_list`, auto-filling Maker Code.
-   **Inventory Transaction Location Picker**: Features interactive, searchable combobox dropdowns for selecting and creating locations.
-   **Component Mandatory Field Validation**: Add/Edit Component forms enforce 10 mandatory fields with conditional logic for parent components.
-   **RH Counter Type & Source Selection**: Components can define `rhCounterType` and `rhMasterComponentId`, with searchable dropdowns for source selection when "Inherited".
-   **Component Tree Sort Order & Cross-Level Drag-Drop**: Supports drag-and-drop reordering and reparenting in the component tree, updating `sort_order` and `parent_id`.
-   **Work Order Part B Validation & Integrity Rules**: Enforces 8 validation rules including read-only states, character limits, draft save logic, audit trails, and numeric field validation.
-   **Work Order B1 Field Name Mapping**: Frontend state keys map to different DB schema column names for B1 fields.
-   **Work Order Attachment Display**: Attachments are displayed with icon-only rows for download, view, and delete.
-   **Completed WO Read-Only Enforcement**: When a Work Order is "Completed", all Part B fields become read-only, and upload/delete buttons are hidden.
-   **Spares By Location Independent Sync**: `spare_location_stock` syncs Location A and Location B independently.
-   **Work Order B4 Spare Consumption Flow**: Spare consumption is recorded at save but inventory deduction occurs at approval time.
-   **Read-Only AES-Encrypted LocalStorage (Secure Auth Storage)**: The auth system reads AES-encrypted keys from `localStorage` but never writes to it. Static default users are used if `localStorage` is empty.

## External Dependencies

-   **Frontend Libraries**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`, `crypto-js`.
-   **Backend Libraries**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
-   **Development Tools**: `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **AI Services**: OpenAI GPT-4o.