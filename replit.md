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

### Feature Specifications
-   **Spare-Component Sibling Link Distribution**: When a spare is linked to a component, it is automatically linked to all sibling components (components sharing the same `parentId`). An idempotent backfill endpoint is available for batch processing.
-   **Fleet Table Schema Contract**: All `fleet_*` tables must include mandatory columns such as `uuid`, `sortOrder`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, and `isSync`.
-   **Bulk Import Maker Validation**: Component bulk import now validates that makers specified in the import sheet already exist in `maker_list`, preventing automatic creation of new makers.
-   **Inventory Transaction Location Picker**: The Inventory Transaction dialog features interactive, searchable combobox dropdowns for selecting and creating locations directly from the `locations` table.

## External Dependencies

-   **Frontend Libraries**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`.
-   **Backend Libraries**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
-   **Development Tools**: `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **AI Services**: OpenAI GPT-4o (integrated via Replit AI).