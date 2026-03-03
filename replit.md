# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to provide a robust, scalable solution for technical management in the maritime sector, improving operational efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
-   **Module-Based Architecture**: All backend code is organized into domain-specific modules under `server/modules/` (e.g., `alerts`, `fleet`, `spares`, `vessels`, `work-orders`). New features must adhere to this structure, with each module typically containing `routes.ts` and optional `schemas.ts`.
-   **UUID-Based Identity System**: The system primarily uses canonical UUID columns (e.g., `vuuid`, `cuuid`, `juuid`, `wouuid`) as the primary identity for foreign key relationships, deprecating older `id` formats for new references.
-   **Immutable Tables**: Certain tables like `component_maintenance_history` are designed as INSERT-only audit trails, enforced by database triggers.
-   **Dual Migration System**: A robust migration system combines 52 frozen code-based migrations (`server/migrations.ts`) with auto-generated Drizzle SQL migrations (`migrations/*.sql`). Schema changes are made in `shared/schema.ts`, and new SQL migration files are automatically generated.
-   **Database Safety Patterns**: Migrations include safety guards (`IF NOT EXISTS`, `IF EXISTS`) and orphan cleanup procedures before adding foreign key constraints.
-   **API Route Prefix**: All API endpoints must use the `/technical/api` prefix.
-   **Vessel Data Source Strategy**: The system supports fetching vessel data from both local and external sources, with a robust fallback mechanism for identifying vessels by various ID formats.

### Tech Stack
-   **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter.
-   **Backend**: Express.js, TypeScript, Drizzle ORM.
-   **Database**: PostgreSQL 16.
-   **AI**: OpenAI GPT-4o (via Replit AI Integration).
-   **Storage**: Replit Object Storage (for document uploads).

### UI/UX Standards
-   Mobile-first responsive design.
-   AG Charts React for visualizations and AG Grid Enterprise for data tables.
-   Consistent `p-6` padding for main content and `space-y-6` for vertical spacing.
-   Delta UI Pattern for mapping/selection dialogs.
-   Work Order forms are designed as single-page scrollable interfaces with numbered subsections.
-   All dashboard charts display real database data.

### Dashboard Visual Design Language (Audit-Reference Style)
-   **Top Navbar**: Pure white background (`#ffffff`), no shadow, active tab has 3px blue bottom-border underline (`#1a6eb5`), active tab text/icon `#1a6eb5`, inactive tabs in dark gray (`#374151`), separator `1px solid #e5e7eb`.
-   **Left Sidebar**: Medium blue background (`#1565c0`) with white icons/text; active item uses subtle `rgba(255,255,255,0.15)` overlay + `3px solid #ffffff` left border (not bright cyan).
-   **Section Headers**: Plain blue uppercase text labels (`#1a6eb5`, 11px, bold, 0.8px letter-spacing) on white background — no dark banner bars.
-   **Gauge Charts**: Dark navy arc color (`#1d3557`), thin stroke (`strokeWidth: 10`), dark navy value text (`#1a2b4a`, 28px, bold), light gray background track (`#E8E8E8`).
-   **Donut Charts**: Thin ring style (`innerRadiusRatio: 0.78`), white background containers.
-   **Trend Charts**: Multi-line LineChart (green/orange/red) with CartesianGrid, percentage-based Y-axis (0–100%), all three lines use percent data keys (`completedPercent`, `outstandingPercent`, `overduePercent`).
-   **KPI Badges**: Plain bold text (dark navy `#1a2b4a` or red `#e74c3c`) — no colored background badges.
-   **Overview/Management Toggle**: Pill-shaped (20px radius); active = `#1a2b4a` bg white text, no border; inactive = `#f3f4f6` bg `#374151` text, no border.
-   **All Vessel/My Vessel Toggle**: Pill-shaped (20px radius); active = `#1a2b4a` bg white text, no border; inactive = white bg `#374151` text, `1px solid #d1d5db` border.
-   **Overdue Table Status Badge**: Light red bg (`#fee2e2`), red text (`#dc2626`), 4px radius, 11px font. Status column `minWidth: 90px`.
-   **Cards**: White background, `box-shadow: 0 1px 4px rgba(0,0,0,0.08)`, border-radius 8px.
-   **Typography**: Section labels in blue `#1a6eb5`, supporting text in gray `#6b7280`, helper text (e.g. "Click segments to filter") in `#9ca3af`.
-   **Dot Matrix**: Default neutral gray (`#9ca3af`), colored only for significant signals (red/amber). Table has thin scrollbar styling, metric column `minWidth: 100px`, vessel columns `minWidth: 50px`.
-   **Chat FAB**: Subtle white circle with blue border/icon, not filled primary button.
-   **Custom Scrollbar CSS**: `.overflow-x-auto` elements use thin 4px WebKit scrollbar with `#cbd5e1` thumb on `#f1f5f9` track (in `index.css`).

### Feature Specifications
-   **Spare-Component Sibling Link Distribution**: When a spare is linked to a component, it is automatically linked to all sibling components (components sharing the same `parentId`). An idempotent backfill endpoint is available for batch processing.
-   **Fleet Table Schema Contract**: All `fleet_*` tables must include mandatory columns such as `uuid`, `sortOrder`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, and `isSync`.
-   **Bulk Import Maker Validation**: Component bulk import now validates that makers specified in the import sheet already exist in `maker_list`, preventing automatic creation of new makers.
-   **Inventory Transaction Location Picker**: The Inventory Transaction dialog features interactive, searchable combobox dropdowns for selecting and creating locations directly from the `locations` table.
-   **Component Mandatory Field Validation**: The Add/Edit Component forms (`ComponentRegisterAddEdit.tsx`, `AddEditComponentForm.tsx`) enforce 10 mandatory fields (Parent Component Code, Component Code, Component Name, Component Category, Model, Model Code, Criticality, Condition Based, Equipment/System Department, Is Active) with red asterisks, red border highlights, inline error messages, and a validation toast on Save. Backend validation in `componentService.ts` also rejects missing mandatory fields on both create and update.

## External Dependencies

-   **Frontend Libraries**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`.
-   **Backend Libraries**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
-   **Development Tools**: `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **AI Services**: OpenAI GPT-4o (integrated via Replit AI).