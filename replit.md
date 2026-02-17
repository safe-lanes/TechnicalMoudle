# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Development Rule - Drizzle-Only Migration Policy (Permanent)**:
All future database schema changes MUST follow this policy without exception:

1.  **Migration Type (Mandatory)**:
    -   Use Drizzle file-based SQL migrations ONLY
    -   All migrations must be generated using `drizzle-kit generate`
    -   Every schema change must result in a `.sql` file inside the `/migrations` directory

2.  **Prohibited Approaches (Never Use)**:
    -   No code-based migrations inside `server/migrations.ts`
    -   No JSON-driven or object-based migrations
    -   No embedded CREATE TABLE or ALTER TABLE SQL executed from TypeScript
    -   No "baseline" or full schema snapshot migrations for incremental changes

3.  **Incremental Migration Rules**:
    -   New tables → dedicated migration file
    -   New columns → ALTER TABLE ADD COLUMN
    -   Index changes → separate migration
    -   Enum updates → isolated migration
    -   One logical change per migration file

4.  **Migration Tracking (Unified System)**:
    -   All migrations (code-based and SQL file-based) are tracked in the `schema_migrations` table
    -   On server start, `runDrizzleMigrations()` scans `/migrations/*.sql` files
    -   Each SQL file is checked against `schema_migrations` by filename
    -   Untracked files are executed and recorded automatically
    -   This ensures pulled migration files from git are properly detected and applied

5.  **Workflow**:
    -   Update `shared/schema.ts` with schema changes first
    -   Run `drizzle-kit generate` to create the migration SQL file
    -   Review the generated SQL before applying

**IMPORTANT**: Existing migrations 001-016 in `server/migrations.ts` are frozen for backward compatibility. **No new code-based migrations will ever be added** - all future schema changes across PMS, Certificates & Surveys, and Defects modules must use Drizzle file-based SQL migrations exclusively.

**Critical Development Rule - Fleet Table Schema Contract (Permanent)**:
All future Fleet-related tables MUST include these mandatory columns with exact naming and behavior:

1.  **Mandatory Column Set (Required for ALL Fleet Tables)**:
    ```typescript
    {table_name}_uuid: text("{table_name}_uuid").default(sql`gen_random_uuid()`),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdByUuid: text("created_by_uuid"),   // FK → master_users.user_uuid
    updatedByUuid: text("updated_by_uuid"),   // FK → master_users.user_uuid
    isDeleted: boolean("is_deleted").default(false),
    isSync: boolean("is_sync").default(false),
    ```

2.  **Identifier & Relationship Rules**:
    -   `{table_name}_uuid` must be a UUID value with default generator
    -   This UUID column is the primary relational key for Fleet table relationships
    -   All Fleet table relationships must reference UUID columns ONLY
    -   Do NOT use numeric IDs, codes, or names for relations between Fleet tables

3.  **Consistency Enforcement**:
    -   Column names must not change from the defined pattern
    -   Data types and default behavior must remain consistent
    -   These columns must exist even if not immediately used by business logic
    -   Any Fleet table omitting or renaming these columns is considered invalid

4.  **Scope & Safety**:
    -   This rule applies ONLY to future Fleet tables
    -   Do NOT modify or migrate existing tables to match this pattern
    -   Do NOT alter existing business logic or queries
    -   This is a schema standardization guideline, not a refactor task

5.  **Fleet Table Identification**:
    -   Tables prefixed with `fleet_` (e.g., `fleet_vessel_mapping`, `fleet_component_mapping`)
    -   Tables that manage fleet-wide master data shared across vessels
    -   Tables referenced by the Fleet Admin module

6.  **Tables Updated to Match Fleet Schema Contract**:
    -   `maker_list` - Updated Feb 2026 with all mandatory columns (maker_list_uuid, sortOrder, createdByUuid, updatedByUuid, isDeleted, isSync). All future FK references to this table MUST use `maker_list_uuid` column only (not the numeric `id`)

## System Architecture
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store.

**UI/UX Decisions**:
- Emphasizes a mobile-first and responsive design philosophy.
- Utilizes AG Charts React for interactive data visualizations and AG Grid Enterprise for tables, with custom styling and inline editing.
- Work Order forms are single-page, scrollable designs with numbered subsections.
- Standardized UI layout includes `p-6` padding for main content, `<div className="space-y-6">` for vertical spacing, consistent header patterns, and specific color codes for action buttons.
- **Delta UI Pattern (Dialog Standard)**: All mapping/selection dialogs use a specific gradient header, compact buttons, inline search, and standardized table styling and sizing.

**Technical Implementations**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Modules**: Comprehensive CRUD for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7, with a structured form and target date extension workflow.
- **Spares Module**: Comprehensive inventory management with many-to-many linking, location-based stock tracking, and audit trails using RECEIVE, CONSUME, and ADJUSTMENT event types.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import, data purging, and a Fleet Admin Dashboard with Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix.
- **Change Request Workflow**: Implements an "Apply Approved Changes" step with atomic database transactions.
- **Ship Certificates & Surveys Admin Modules**: Manage requirements with 3-tab interfaces (Master, Company, Vessel), configurable categories/groups, and prefixed ID formats.
- **Standard Sequencing Component**: Admin tables use a number input for sequence reordering.
- **Fleet Component → Fleet Job Referential Integrity**: `fleet_jobs` table links to `fleet_components_uuid` for integrity, validated during bulk import.
- **Database Migration Strategy**: Exclusively uses Drizzle file-based SQL migrations.
- **Vessel Data Source Strategy**: Employs a unified `useVessels()` hook prioritizing local PMS data with fallback to an external master-data API.
- **ROB Location Stock Synchronization**: Dual-write synchronization between legacy ROB fields and `spare_location_stock` for inventory consistency.
- **Excel Report Standardization**: All Maintenance & Work Order Excel exports use a standardized 18-column template with status-based full-row highlighting.
- **Job Postponement Log Report**: Uses `work_order_postponements` history table for tracking, with a custom 19-column Excel export.
- **Running Hours Anomaly Detection Report**: Analyzes `running_hours_audit` to identify 5 anomaly types, with severity-based row coloring in Excel export.
- **Consumption Pattern Analysis Report**: Aggregates `spares_history` CONSUME events, providing a 10-column PDF/Excel report.
- **IHM Inventory Status Report**: Interactive report combining `spares` and `stores_items` data, with summary cards, filters, and PDF/Excel export.

- **AI Chatbot Assistant**: Floating chat panel (bottom-right) powered by OpenAI GPT-4o with function calling via Replit AI Integration (no external API key needed - uses AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL). Features 15 tools for querying work orders, spares, components, jobs, stores/lubricants/chemicals inventory, defects (active/resolved/recurring), consumption pattern analysis, and maintenance calendar/scheduling. Uses lazy-initialized OpenAI client. Frontend uses react-markdown for safe rendering. Files: `server/services/chatbotService.ts`, `server/routes/chatbot.ts`, `client/src/hooks/useChat.ts`, `client/src/components/chat/`.
- **Chatbot Analytical Upgrade (Feb 2026)**: Enhanced from data-dump to intelligent analyst. System prompt enforces structured responses (Summary → Critical Insights → Priority Items → Recommendations). 5 core analytical tools: `get_maintenance_insights` (KPIs, compliance rate, overdue aging), `get_spare_coverage_analysis` (shortage risk, reorder urgency, stockout estimates), `get_workload_analysis` (backlog aging buckets, department distribution), `get_component_health_score` (risk scoring combining defects + overdue + criticality), `get_performance_trends` (completion rates, resolution times, trend direction). 9 specialized analytical tools: `get_running_hours_analytics` (RH accumulation, anomaly detection), `get_maintenance_planner` (weekly breakdown, critical path), `get_rob_analysis` (stockout estimates, procurement), `get_change_request_analysis` (status/aging/approval metrics), `get_recurring_defect_analysis` (MTBF, COC, multi-vessel), `get_compliance_alerts` (certificate/survey expiry tracking), `get_equipment_comparison` (side-by-side health scoring), `get_cost_impact_estimate` (risk-scored deferred maintenance), `get_workload_forecast` (historical projection, bottleneck risk). Existing tools enhanced with analytical summaries. Natural language date handling in system prompt. Config: max_tokens=4000, maxIterations=8, temperature=0.4. Total: 29 function-calling tools.
- **Chatbot Intelligence Phase 1 (Feb 2026)**: Added 3 few-shot example responses in system prompt (multi-tool prioritization, clarifying question for ambiguous queries, direct fleet answer). Added query classification decision tree mapping 8 question categories to specific multi-tool chain patterns (priorities, status, equipment, inventory, scheduling, compliance, ambiguous, simple). Added clarifying question behavior rules with examples of when to ask vs answer directly. Added conversation history trimming (MAX_HISTORY=20 messages) with context summary injection when older messages are trimmed.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`