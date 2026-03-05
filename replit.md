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
-   **Domain Parameter Requirement**: All external master data API calls require an explicit `domain` parameter. The frontend reads domain from `localStorage.getItem('domain')` (set by the parent Sail-ERP app) and passes it as a query parameter to the backend. No hardcoded domain fallbacks are used — backend returns 400 if domain is missing.

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
-   **Top Navbar**: Pure white background (`#ffffff`), no shadow, active tab has 3px blue bottom-border underline (`#1a6eb5`), active tab text/icon `#1a6eb5`, inactive tabs `#4b5563`, separator `1px solid #e5e7eb`.
-   **Left Sidebar**: Medium blue background (`#1565c0`); active item uses `rgba(255,255,255,0.12)` overlay + `3px solid rgba(255,255,255,0.9)` left border; active text/icon full white; inactive text/icon `rgba(255,255,255,0.75)`.
-   **Section Headers**: Plain blue uppercase text labels (`#1a6eb5`, 11px, bold, 0.8px letter-spacing), padding `16px 4px 12px 4px`, transparent background.
-   **Gauge Charts**: Gray arc (`#d1d5db`), thin stroke (`strokeWidth: 10`), **number text** carries semantic color via `color` prop (overdue=`#e74c3c` red, completion=`#16a34a` green, outstanding=`#f59e0b` amber), track `#e5e7eb`.
-   **Donut Charts**: Thin ring style (`innerRadiusRatio: 0.82`), white background containers.
-   **Trend Charts**: Hardcoded static data (values 30–49%), multi-line LineChart with CartesianGrid (horizontal only, stroke `#f0f4f8`), percentage Y-axis domain `[0,100]` ticks `[0,25,50,75,100]`, chart height 220px.
-   **KPI List**: Label text 13px `#374151`, value text 14px bold, separators `1px solid #f1f5f9`.
-   **Overview/Management Toggle**: Pill 13px (20px radius); active = `#1a2b4a` bg white text, no border; inactive = `#e2e8f0` bg `#64748b` text, no border.
-   **All Vessel/My Vessel Toggle**: Pill 13px (20px radius); active = `#1a2b4a` bg white text, no border; inactive = white bg `#374151` text, `1px solid #e2e8f0` border.
-   **Dashboard Title**: 20px, fontWeight 600, `#1a2b4a`. Year: 18px, bold, `#1a2b4a`.
-   **Overdue Table**: Dark navy header (`#1a2b4a`), table minWidth 500px, column min-widths (WO 160px, Equipment 200px, Status 90px), status badge `#fee2e2`/`#dc2626` 4px radius whiteSpace nowrap, row text 12px `#374151`, zebra `#ffffff`/`#fafafa`, separator `1px solid #f1f5f9`.
-   **Watch List Badges**: Overdue = `#fee2e2`/`#dc2626`, Critical = `#fff7ed`/`#ea580c`, both 4px radius, 11px font. View All link `#1a6eb5` 12px with top border.
-   **Cards**: White bg, `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`, `border: 1px solid #f1f5f9`, border-radius 8px.
-   **Page Background**: `#f8fafc` (subtle blue-gray tint).
-   **Dot Matrix**: Table minWidth 500px, metric column 110px 12px `#374151`, vessel headers 55px 11px `#6b7280`, row borders `1px solid #f1f5f9`.
-   **Chat FAB**: White circle with `#1a6eb5` border/icon.
-   **Custom Scrollbar CSS**: `.overflow-x-auto` elements use 3px WebKit scrollbar with `#cbd5e1` thumb on transparent track.

### Feature Specifications
-   **Spare-Component Sibling Link Distribution**: When a spare is linked to a component, it is automatically linked to all sibling components (components sharing the same `parentId`). An idempotent backfill endpoint is available for batch processing.
-   **Fleet Table Schema Contract**: All `fleet_*` tables must include mandatory columns such as `uuid`, `sortOrder`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, and `isSync`.
-   **Bulk Import Maker Validation**: Component bulk import now validates that makers specified in the import sheet already exist in `maker_list`, preventing automatic creation of new makers.
-   **Inventory Transaction Location Picker**: The Inventory Transaction dialog features interactive, searchable combobox dropdowns for selecting and creating locations directly from the `locations` table.
-   **Component Mandatory Field Validation**: The Add/Edit Component forms (`ComponentRegisterAddEdit.tsx`, `AddEditComponentForm.tsx`) enforce 10 mandatory fields (Parent Component Code, Component Code, Component Name, Component Category, Model, Model Code, Criticality, Condition Based, Equipment/System Department, Is Active) with red asterisks, red border highlights, inline error messages, and a validation toast on Save. Backend validation in `componentService.ts` also rejects missing mandatory fields on both create and update.
-   **Component Tree Sort Order & Cross-Level Drag-Drop**: The component tree supports drag-and-drop reordering via Edit mode, including cross-level moves (reparenting). The `sort_order` column was added to `components` via raw SQL in `initDb.ts` (not in the Drizzle schema). `componentRepository.ts` augments fetch results with a raw SQL query for `sort_order`. Backend `updateHierarchyAndSortOrder()` handles both `sort_order` and `parent_id` changes in a single DB transaction with circular hierarchy prevention. Note: `parent_id` stores the parent's `componentCode` (not UUID). Frontend `collectReparents()` detects parent changes by comparing edit tree to original, sends `reparents` array alongside sort updates.
-   **Work Order Part B Validation & Integrity Rules**: The WO form enforces 8 validation rules: (1) `isPartBReadOnly` disables all Part B fields when status is Completed or Pending Approval, (2) `maxLength` + character counters on textareas (2000 chars for Work Carried Out / Job Experience, 500 for Remarks), (3) Draft save flow — `handleSave` splits validation into "hard errors" (format, safety) vs "missing fields" (required-for-submission), allowing partial saves as draft without status change, (4) Audit trail via `audit_log` table on every WO save with diff snapshot, (5) Backend `validateNumericField` for totalTimeHours/manhours/runningHours/currentReading/noOfPersons. These rules are implemented in both `WorkOrderFormPage.tsx` and `WorkOrderForm.tsx` (frontend) and `workOrderService.ts` (backend).
-   **Work Order B1 Field Name Mapping**: The DB schema uses `riskAssessmentStatus`, `safetyChecklistsStatus`, `operationalFormsStatus` columns, but the frontend state uses shorter keys `riskAssessment`, `safetyChecklists`, `operationalForms`. Both `WorkOrderFormPage.tsx` and `WorkOrderForm.tsx` map between these on save (adding `*Status` suffix) and load (stripping `*Status` suffix). Upload controls for each B1 field only render when the corresponding radio is set to "Yes".
-   **Work Order Attachment Display**: All attachment sections in work order forms display icon-only rows (Paperclip + Eye + Trash2) without file names or file sizes. The **Paperclip icon** is clickable and triggers a file download (via temp `<a>` element with `download` attribute). The **View (Eye) icon** opens the document in a new browser tab by converting the base64 `dataUrl` to a Blob via `URL.createObjectURL()` (direct `data:` URLs are blocked by browsers). Both use a shared `dataUrlToBlob()` helper. Object URLs from View are auto-revoked after 60 seconds. The Delete icon shows a confirmation dialog. This applies to all 4 attachment areas in `WorkOrderFormPage.tsx` and all 3 in `WorkOrderForm.tsx`.
-   **Spares By Location Independent Sync**: All `spare_location_stock` SYNC blocks in `postgresStorage.ts` (8 methods: createSpare, updateSpare, consumeSpare, consumeSpareFromLocation, receiveSpareToLocation, adjustSpareAtLocation, transferSpareLocation, reconcileSpareLocationStock) sync Location A and Location B independently. Each location has its own try/catch block and only syncs if the spare actually has that location assigned (truthy `location`/`location2`). This ensures a spare with only one location still appears in the "Spares By Location" tab.

-   **Read-Only AES-Encrypted LocalStorage (Secure Auth Storage)**: The auth system is **read-only** for localStorage — it never writes to localStorage. It reads 5 AES-encrypted keys (`userProfile`, `userRole`, `userType`, `credentials`, `Role_Access_Data`) via `secureGetItem` from `client/src/utils/secureStorage.ts` using `crypto-js`. If localStorage is empty (Replit/demo mode), a static default user (Office/Client_Admin) is used in React state/memory only. The role switcher updates React state only, not localStorage. The `roleAccessData.ts` utility generates granular permission matrices (module-level and action-level) based on user role, kept in memory. The `localStorageAnalyzer.ts` utility can detect and decrypt AES values for dev diagnostics. The secret key is sourced from `VITE_STORAGE_SECRET` env var. Legacy keys (`currentUser`, `sail_ui_role`) have been completely removed.

## External Dependencies

-   **Frontend Libraries**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`, `crypto-js`.
-   **Backend Libraries**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`.
-   **Development Tools**: `vite`, `typescript`, `drizzle-kit`, `tsx`.
-   **AI Services**: OpenAI GPT-4o (integrated via Replit AI).