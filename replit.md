# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The project aims to provide a robust, scalable solution for maritime technical management, improving operational efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The system is built with a modular, domain-driven approach, organizing backend code into specific feature modules. It utilizes a UUID-based identity system for primary keys and foreign key relationships across the database, moving away from legacy ID formats. A dual migration system (code-based and Drizzle SQL) ensures controlled and safe database schema evolution, with strict rules against manual modification of migration files or existing schema definitions. Immutability rules are enforced for critical audit tables like `component_maintenance_history`.

**Key Architectural Principles:**
-   **Module-Based Backend:** All backend features are organized into domain-specific modules (`server/modules/`), each with its own routes, schemas, and services.
-   **UUID-Based Identity:** Canonical UUID columns are used as primary identifiers for all core entities (vessels, components, jobs, work orders) and for foreign key references.
-   **Dual Migration System:** A robust system that runs both code-based and Drizzle SQL migrations automatically on startup, ensuring schema consistency and preventing manual errors.
-   **Immutable Tables:** Certain tables, like `component_maintenance_history`, are designed as insert-only audit trails, preventing runtime updates or deletions.
-   **API Route Prefixing:** All API endpoints are uniformly prefixed with `/technical/api`.
-   **Vessel Data Sourcing:** A flexible data handling strategy for vessel information accommodates data from both internal and external sources.
-   **Database Safety:** Migrations incorporate `IF NOT EXISTS` / `IF EXISTS` guards and orphan cleanup procedures to ensure idempotent and safe schema changes.
-   **Production/Development Detection:** Automatic detection logic differentiates between development (Vite hot reload) and production (static file serving) environments.
-   **Fleet Table Contract:** All `fleet_*` tables must adhere to a strict schema contract including standard audit and state columns (e.g., `_uuid`, `createdAt`, `updatedAt`, `isDeleted`, `isSync`).

**UI/UX Decisions:**
-   **Responsive Design:** Mobile-first approach for all user interfaces.
-   **Data Visualization & Grids:** AG Charts React for interactive visualizations and AG Grid Enterprise for robust data table management.
-   **Layout & Spacing:** Consistent `p-6` padding for main content areas and `space-y-6` for vertical element spacing.
-   **Interaction Patterns:** "Delta UI Pattern" for mapping and selection dialogs.
-   **Forms:** Work Order forms are single-page, scrollable interfaces with clearly numbered subsections.
-   **Data Integrity:** All dashboard charts display real-time data from the database, avoiding hardcoded or mock data.
-   **Work Order Document Upload:** Multi-file upload functionality with server-side image compression, dual storage backend (local filesystem when `PRIVATE_OBJECT_DIR` is not set, Replit Object Storage when available), and metadata management in `work_order_documents` table. Backend code in `server/modules/work-orders/` (repositories/documentRepository.ts, services/woDocumentService.ts, controllers/woDocumentController.ts).

## External API Configuration
-   **Environment Detection:** The system uses `APP_ENV` (values: `local`, `dev`, `production`) to determine which external API URL to use. If `APP_ENV` is not set, it is inferred from `NODE_ENV` with a warning.
-   **Environment Variables:**
    -   `APP_ENV` — Explicit environment identifier (`local` | `dev` | `production`).
    -   `EXTERNAL_MASTER_DATA_URL_DEV` — Used when `APP_ENV` is `local` or `dev`.
    -   `EXTERNAL_MASTER_DATA_URL_PROD` — Used when `APP_ENV` is `production`.
    -   The server will **not start** if the required URL variable is missing (fail-fast, no fallback defaults).
-   **Configuration file:** `server/config/externalApi.ts` — centralized config that validates `APP_ENV`, selects the correct URL, and exports a `buildExternalMasterDataUrl()` helper. Imported at the top of `server/index.ts` so environment info logs before anything else.
-   **Proxy pattern:** Frontend hooks (`client/src/hooks/useExternalMasterData.ts`) call the backend proxy at `/technical/api/external/master-data/:endpoint` instead of calling the external API directly. This avoids CORS issues and keeps the external URL server-side only.
-   **Deployment per environment:**
    -   Local: `APP_ENV=local`, set `EXTERNAL_MASTER_DATA_URL_DEV` only.
    -   Dev server: `APP_ENV=dev`, set `EXTERNAL_MASTER_DATA_URL_DEV` only.
    -   Production: `APP_ENV=production`, set `EXTERNAL_MASTER_DATA_URL_PROD` only.

## External Dependencies
-   **Frontend Libraries:** `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`.
-   **Backend Libraries:** `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`, `sharp`.
-   **Development Tools:** `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **Database:** PostgreSQL 16.
-   **AI Integration:** OpenAI GPT-4o (via Replit AI Integration).
-   **Object Storage:** Replit Object Storage (for document uploads).