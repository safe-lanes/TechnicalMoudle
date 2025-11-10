# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It provides a comprehensive solution for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. The system includes a PMS Dashboard, equipment and task management, reporting, and an administration module. It manages Certificate & Surveys, Defect Reporting, and the core PMS functionalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application utilizes a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), focusing on a mobile-first responsive design and consistent UI/UX. The backend uses Express.js (TypeScript) and integrates with PostgreSQL via Drizzle ORM, with an in-memory fallback for development.

**Key Modules & Features:**
-   **PMS Submodules**: Components (CRUD, hierarchical tree), Work Orders, Running Hours (tracking, utilization, audit), Spares (inventory, transactions, bulk updates), Reports, Modify PMS, and Admin.
-   **Modify PMS - Change Requests**: Comprehensive workflow for change requests (draft to approved/rejected), including target selection (Components/Work Orders/Spares/Stores), proposed field-specific modifications, and impact previews.
-   **Defects Module**:
    -   **Condition of Class (CoC)**: Tracking and filtered views.
    -   **Recurring Defects**: Pattern detection across vessels with filtering.
    -   **VIQ Integration**: SIRE VIQ 7 reference tracking with detailed dropdowns for chapters and sections.
    -   **Form Wizard**: Multi-step defect reporting with persistent data, view/edit modes, and action management (add/edit/delete).
    -   **Defect Closure Workflow**: Streamlined closure process where clicking the close button in Defect Log opens the 3-step DefectFormWizard at Section 3 (Closeout). User fills Date Completed, which auto-sets status to 'Closed' and moves defect to Resolved tab. DefectFormWizard supports both route-based and embedded (props-based) usage with initialStep parameter.
    -   **Query Management**: TanStack Query v5 cache invalidation uses `exact: false` for prefix matching to ensure proper refetching of hierarchical query keys (active/resolved lists and badge counts).
-   **Admin Module**:
    -   **Bulk Data Import**: Supports Machinery Components (CSV/Excel with SFI code hierarchy, auto-creation of intermediate nodes, multi-sheet support, smart validation, duplicate detection, and 24 field import), and Work Orders (auto-generated WO codes, pre-populated leaf node components, and Excel dropdowns with validations).
    -   **Alerts Tab**: Alert policy management.
    -   **Forms Tab**: Form configuration.
-   **Shared Architecture Features**: Consistent component tree structure, RESTful API with error handling, real-time stock status, and audit trails for inventory.

## External Dependencies
-   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
-   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
-   **Development**: `vite`, `typescript`, `drizzle-kit`