# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It provides a comprehensive solution for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. The system includes a PMS Dashboard, equipment and task management, reporting, and an administration module. It manages Certificate & Surveys, Defect Reporting, and the core PMS functionalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application utilizes a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), focusing on a mobile-first responsive design and consistent UI/UX. The backend uses Express.js (TypeScript).

**Current Storage Configuration (November 2025)**:
- **Active Storage**: PersistentFileStorage - File-based JSON persistence to `/home/runner/workspace/test-data.json`
- **Status**: Fully operational with all CRUD operations persisting to disk
- **Migration Blocker**: PostgreSQL integration incomplete due to DATABASE_URL environment variable not loading into process.env at runtime. PostgresStorage class is implemented in server/storage.ts and ready for activation once environment variable issue is resolved.
- **Seeded Data**: 8 SFI category components (1-Ship General through 8-Ship Common Systems) for vessel V001

**Key Modules & Features:**
-   **PMS Dashboard**: Professional analytics workspace with tabbed layout (Overview, Departments, Equipment, Compliance). All visualizations built exclusively with AG Charts React (`ag-charts-react`), featuring interactive legends, detailed tooltips, and responsive design. Charts derive data from real filtered work orders with no mock/random data. Includes KPI cards with sparklines, stacked bar charts, line/area charts, pie charts, scatter/bubble plots, bubble-based heatmaps, and grouped bar charts (hierarchical cost views). All visualizations respond to vessel and date range filters. Financial analytics and cost-related charts planned for future phase.
-   **PMS Submodules**: Components (CRUD, hierarchical tree), Work Orders (with automatic status computation and comprehensive form management), Running Hours (tracking, utilization, audit), Spares (inventory, transactions, bulk updates), Reports, Modify PMS, and Admin.
-   **Jobs vs Work Orders Architecture (November 2025)**: Critical separation between job templates and work order executions:
    -   **Jobs Table**: Template-only maintenance job definitions linked to components. Contains Part A data (jobNo, jobTitle, maintenanceType, frequencyValue/Unit, requiredSpareParts, requiredTools, safetyRequirements). Auto-generated JOB-XXXXXXX codes. Accessed via `/api/jobs` endpoints with full CRUD operations.
    -   **Component Form Section C**: Renamed from "Work Orders" to "Jobs" to reflect template nature. Displays job templates associated with each component, avoiding confusion with active work orders.
    -   **Work Orders Table**: Active and historical work order executions (Part A + Part B data). Contains execution-specific fields (dueDate, status, uploadedDocuments, consumedSpareParts, dateCompleted, performedBy).
    -   **Storage Layer**: PersistentFileStorage implements full CRUD for jobs (getJobs, createJob, updateJob, deleteJob, bulkCreateJobs, bulkUpdateJobs, bulkUpsertJobs) with filtering by vesselId and componentId.
    -   **Data Flow**: Jobs (templates in Component Tree) → triggered to create Work Orders (executions in Work Orders module) → completed Work Orders archived in Maintenance Records (read-only history).
    -   **Type Safety**: Separate TypeScript types (Job, InsertJob from jobs table; WorkOrder, InsertWorkOrder from workOrders table) ensure clear boundaries between templates and executions.
-   **Work Order Automation (November 2025)**: Fully automatic status computation eliminates manual status updates. Work order status (Active/Due/Due (Grace P)/Overdue/Completed) is calculated in real-time by comparing due dates to current date. Grace period thresholds: Due Horizon (30 days), Grace Period (7 days). Backend augments all API responses with `computedStatus` field; frontend tabs, badges, and filtering use computed status exclusively. Stored status field maintained for audit/historical purposes only.
-   **Work Order Form Enhancements (November 2025)**: Comprehensive WorkOrderForm with 13 fully functional management buttons:
    -   **Part A (Template)**: Inline editing for Required Spare Parts (A2), Required Tools (A3), and Safety Requirements (A4) with add/edit/delete functionality
    -   **Part B (Execution)**: Document management system with Upload/View/Delete buttons for Risk Assessment, Safety Checklist, and Operational Form documents using Replit Object Storage
    -   **Part B4**: Consumed Spare Parts tracking with inline add/edit/delete
    -   **Data Persistence**: All form data stored as JSON fields in work orders table (requiredSpareParts, requiredTools, safetyRequirements, uploadedDocuments, consumedSpareParts)
    -   **Object Storage Integration**: Backend uses ObjectStorageService with proper Replit SDK for secure document upload, retrieval, and deletion via `/api/upload-document` and `/api/documents/:fileKey` endpoints
-   **Template vs Execution Workflow (November 2025)**: Comprehensive work order lifecycle management with clear separation between templates and executions:
    -   **Template Mode**: Component Tree displays work order templates with Section A only (job description, maintenance intervals, required spares/tools, safety requirements). "Maintenance Records" button provides access to historical executions.
    -   **History Mode**: Maintenance Records page displays completed work order executions in a full-screen data table with date filters (All Time, Last Month, Last Quarter, Last Year, Custom Range) and search functionality. Clicking a row opens WorkOrderForm in read-only mode showing merged data: Section A from template + Section B from execution (uploaded documents, consumed spares, work description, completion details).
    -   **Data Architecture**: workOrderExecutions table stores historical maintenance records with templateId reference, componentId/vesselId tracking, and top-level fields (workDescription, remarks, uploadedDocuments, consumedSpareParts, performedBy, approvedBy, dateCompleted, status).
    -   **Type Safety**: Full TypeScript integration with HistoryWorkOrderPayload type, WorkOrder and WorkOrderExecution types from schema, and proper state management in MaintenanceRecords component. **Bug Fix (Nov 12, 2025)**: Corrected template matching in handleRowClick to use `execution.componentId` (matches WorkOrderExecution schema) instead of non-existent `execution.componentCode` field.
    -   **Backend API**: Complete REST endpoints - GET /api/work-order-executions/:componentId for fetching executions, POST /api/work-order-executions for creating records, PATCH /api/work-order-executions/:id for updates. GET /api/components/details/:id for component information.
    -   **UI/UX**: Toast notifications for missing templates, data-testid attributes for testing, graceful error handling with user feedback, and automatic section navigation to Part B when viewing history.
-   **Modify PMS - Change Requests**: Comprehensive workflow for change requests (draft to approved/rejected), including target selection (Components/Work Orders/Spares/Stores), proposed field-specific modifications, and impact previews.
-   **Defects Module**:
    -   **Condition of Class (CoC)**: Tracking and filtered views.
    -   **Recurring Defects**: Pattern detection across vessels with filtering.
    -   **VIQ Integration**: SIRE VIQ 7 reference tracking with detailed dropdowns for chapters and sections.
    -   **Form Wizard**: Multi-step defect reporting with persistent data, view/edit modes, and action management (add/edit/delete).
    -   **Defect Closure Workflow**: Streamlined closure process where clicking the close button in Defect Log opens the 3-step DefectFormWizard at Section 3 (Closeout). User fills Date Completed, which auto-sets status to 'Closed' and moves defect to Resolved tab. DefectFormWizard supports both route-based and embedded (props-based) usage with initialStep parameter.
    -   **Query Management**: TanStack Query v5 cache invalidation uses `exact: false` for prefix matching to ensure proper refetching of hierarchical query keys (active/resolved lists and badge counts).
-   **Admin Module**:
    -   **Bulk Data Import**: Supports Machinery Components (CSV/Excel with SFI code hierarchy, auto-creation of intermediate nodes, multi-sheet support, smart validation, duplicate detection, and 24 field import including Vessel Code and Component Category fields), and Work Orders (auto-generated WO codes, pre-populated leaf node components, and Excel dropdowns with validations). **Critical Fix (Nov 2025)**: Corrected field mapping in server/routes/bulk.ts to populate both `vesselId` (FK reference) and `vesselCode` (display field) from Excel 'Vessel Code' column, ensuring proper vessel tracking throughout the system. **Multi-Vessel Support (Nov 13, 2025)**: Implemented explicit vessel selection with dropdown in BulkDataImport page header (V001/V002/V003). Frontend propagates selected vesselId to all upload components (JobUpload, MachineryComponentUpload) via props. Backend dry-run validation enforces Vessel Code matching only for types with Vessel Code field (components, jobs), skipping work-orders/spares/stores. Template generation, dry-run validation, and import all use vesselId parameter. Routing: Admin sidebar "Data Management" → /admin/bulk-data-import via TechnicalModule. E2E tested: vessel selection, navigation, template download, tab switching all verified.
    -   **Alerts Tab**: Alert policy management.
    -   **Forms Tab**: Form configuration.
    -   **Fleet Admin Dashboard (Admin 4)**: Comprehensive fleet-level master data management with federated schema design using dataScope discriminator ('fleet' | 'vessel') to distinguish fleet templates from vessel instances:
        -   **Makers Management**: CRUD for manufacturer/vendor master data with company details.
        -   **Master Lists Management**: Configuration repository for dropdown options and system reference data.
        -   **Fleet Components Management**: Hierarchical tree view with SFI code structure, auto-generated Fleet Equipment Codes (XXX.XXX.XX format), full CRUD, and Excel export capabilities.
        -   **Fleet Jobs Management**: Template work order definitions with equipment linkage, maintenance intervals, auto-generated WO codes (WO-XXXXXXX), and bulk operations.
        -   **Fleet Spares Management**: Parts catalog with component associations, auto-generated Part Codes (PT-XXXXXXX), criticality classification, and inventory templates.
        -   **Architecture**: All fleet entities use nullable vesselId, optional name/category fields for flexible hierarchy, auto-generated IDs, and consistent timestamp tracking. Backend provides 15 RESTful endpoints with Zod validation and dataScope enforcement.
-   **Shared Architecture Features**: Consistent component tree structure, RESTful API with error handling, real-time stock status, and audit trails for inventory.

## External Dependencies
-   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
-   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
-   **Development**: `vite`, `typescript`, `drizzle-kit`