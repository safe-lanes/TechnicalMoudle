# Seafarer Technical Management System

## Overview
This project is a comprehensive full-stack Technical Module for a maritime Planned Maintenance System (PMS). It offers robust solutions for managing technical equipment maintenance, scheduling, and performance tracking, primarily for maritime professionals. Key capabilities include a PMS Dashboard, equipment and task management, reporting, and administrative functionalities, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to provide a data-driven approach to maritime maintenance, improving efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) ensuring a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**Storage Configuration**:
- Primary storage currently uses `PersistentFileStorage` for file-based JSON persistence (`/home/runner/workspace/test-data.json`).
- `PostgresStorage` is implemented and will be activated upon resolution of environment variable loading.
- **Database Migration Configuration**: Created `drizzle.postgres.config.ts` for PostgreSQL migrations to complement immutable `drizzle.config.ts` (MySQL). Run migrations with: `npx drizzle-kit push --config drizzle.postgres.config.ts`

**Service Layer Architecture** (November 2025):
- Created dedicated service layer in `server/services/` to organize business logic by domain
- **jobService.ts**: Job CRUD operations, validation, next due date calculation, bulk operations, and Calendar-based job filtering
- **workOrderService.ts**: Work order operations, status computation, auto-generation from due jobs, duplicate prevention
- **runningHoursService.ts**: Running hours tracking, cascade updates delegation, validation helpers
- **componentService.ts**: Hierarchical component queries with full tree assembly, navigation, parent-child relationships
- **index.ts**: Central export point for all services
- **Current Architecture Note**: Service layer provides a clean API and validation layer but currently delegates core business logic to storage layer. Future enhancement would move orchestration logic (cascade updates, work order generation) fully into services for better separation of concerns.

**Component Hierarchy Design**:
- Components are structured hierarchically using a `parentId` field, which stores **component codes** (e.g., "411") for establishing parent-child relationships, not database IDs.

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Utilizes AG Charts React for interactive, data-driven visualizations on the PMS Dashboard, offering KPIs and various chart types responsive to vessel and date filters.

**Technical Implementations & Key Features**:
- **PMS Dashboard**: Professional analytics workspace with tabbed layouts (Overview, Departments, Equipment, Compliance) and visualizations from filtered work order data.
- **PMS Submodules**: Includes CRUD operations for Components (hierarchical tree with critical filter and search), Work Orders (automatic status computation, comprehensive form management), Running Hours (with bulk update validation), Spares (inventory, transactions), Reports, Modify PMS, and Admin functionalities.
- **Components Module Filtering**: Supports combined critical status and real-time search filtering, preserving tree hierarchy for relevant parent categories.
- **Jobs vs. Work Orders Architecture**: `Jobs` define maintenance task templates, while `Work Orders` are active/historical execution records. This ensures type-safe separation and clear distinction between planned tasks and their execution.
- **Work Order Automation**: Real-time status computation (Active/Due/Due (Grace P)/Overdue/Completed) and strict filtering by `vesselId` across all modules.
- **Work Order Form Redesign (November 2025)**: Complete UI/UX overhaul matching maritime industry reference designs:
    - **Single Scrollable Page Layout**: Part A (Work Order Details) and Part B (Work Completion Record) sections on one continuous page
    - **Minimal A/B Navigation**: Circular step indicators with IntersectionObserver-based scroll tracking for automatic active step highlighting
    - **Numbered Subsections**: Part A sections (A1-A5): Work Order Information, Required Spare Parts, Required Tools & Equipment, Safety Requirements, Work History; Part B sections (B1-B2): Risk Assessment/Checklist/Remarks, Document Management
    - **Professional Maritime Styling**: Light-blue framing (`bg-blue-50`) with white inner headers, blue horizontal rules, 3-column responsive field layouts for A1 Work Order Information section, simplified tables (exact column matching), blue bullet lists for safety requirements
    - **Enhanced Header**: Work Instructions access button only, Save button relocated to bottom after Document Management section
    - **Document Management Integration**: Fully integrated into Part B (B2) with upload/view/delete for risk assessments, safety checklists, and operational forms
    - **Mobile-First Responsive**: Adapts seamlessly from desktop (20px sidebar) to mobile (sheet menu) with preserved functionality
    - **Maintenance Basis & Frequency Validation**: Only Calendar and Running Hours options; frequency requires positive integers; dynamic unit dropdown (Hours for Running Hours, Days/Weeks/Months/Years for Calendar) with preservation of Calendar unit selection when toggling
- **Modify PMS - Change Requests**: Manages change requests from draft to approved/rejected status, including target selection and impact previews.
- **Defects Module**: Tracks Condition of Class, identifies recurring defects, integrates with SIRE VIQ 7, features a multi-step reporting form, and streamlined closure workflow.
- **Spares Module**:
    - **Inventory Management**: Tracks dual storage locations (`location`, `location2`), ROB/Min/Max levels with color-coded stock indicators.
    - **Quick Quantity Adjustments**: Supports immediate inventory changes with validation and audit trails.
    - **Bulk Upload**: CSV/Excel import with auto-code generation, validation, and multi-mode (Add/Update/Upsert) functionality.
    - **Transaction History**: Provides a complete audit trail of all inventory movements.
    - **Work Order Integration**: Implements a differential reconciliation system for consumed spares within work orders, ensuring accurate inventory adjustments and audit trails.
- **Calendar-Based Job Automation**:
    - **Next Due Date Calculation**: Automatic calculation of `nextDueDate` for Calendar-based jobs based on `lastDoneDate + interval`, with robust date normalization.
    - **CRITICAL BUSINESS RULE**: Calendar-based jobs MUST ALWAYS have `nextDueDate` calculated as `lastDoneDate + frequencyValue + frequencyUnit`. This field is automatically computed and MUST NOT be null for Calendar jobs.
    - **Input Format Flexibility**: `calculateNextDueDate()` function accepts any date format (DD-MMM-YYYY, ISO strings, Excel serials) and normalizes before calculation to prevent errors.
    - **Guard Logic**: Service layer validates and preserves existing `nextDueDate` values when recalculation fails, preventing null overwrites.
    - **Bulk Upload Integration**: Jobs template import automatically calculates and persists `nextDueDate`, using component `installationDate` as a fallback.
    - **Auto-Generation Endpoint**: Generates work orders for active Calendar-based jobs when `nextDueDate` is reached.
    - **Date Format Handling**: All dates use DD-MMM-YYYY format (e.g., "13-Nov-2024") with Excel 1900 leap year bug fix applied (serials >= 60 require -1 day adjustment).
- **Running Hours Module with Automatic Work Order Generation**:
    - **Cascade Update System**: Updates parent component running hours and automatically cascades deltas to all child components.
    - **Automatic Work Order Generation**: Triggers new work order generation when child component running hours exceed job `intervalRunningHour` thresholds.
    - **Backend Validation**: Enforces checks against decreasing running hours, realistic hourly deltas, and maintains an audit trail.
    - **Work Order Integration**: Full-page Work Order form with fields for completion date and running hours, including comprehensive frontend and backend validation for atomic updates and recursive delta cascading.
    - **SFI Code Navigation**: Table includes SFI Code column (between Component and Component Category) with clickable blue hyperlinks that navigate to Components page with auto-selection of the corresponding component via sessionStorage.
    - **SFI Code Display**: Backend endpoint explicitly maps `componentCode` as `sfiCode` in API responses to ensure proper display in Running Hours table.
- **Components Module Job Display**:
    - **Hierarchical Job Loading**: WorkOrdersSection recursively finds all child component codes and displays jobs from both parent and descendant components, ensuring parent components (shown in Running Hours for having children with RH jobs) correctly display all relevant maintenance tasks.
- **Admin Module**:
    - **Bulk Data Import**: Supports CSV/Excel import for Machinery Components (SFI hierarchy, validation, multi-vessel support), Jobs, and Spares with enhanced error viewing and partial import capabilities.
    - **Data Purge Functionality**: Admin endpoint for safe deletion of jobs and linked data for a specific vessel or the entire system, adhering to dependency order.
    - **Fleet Admin Dashboard**: Manages master data for makers, fleet components, jobs, and spares using a federated schema design.
- **Role-Based Access Control (RBAC)** (November 2025):
    - **Three User Roles**: Ship (vessel-based), Office (shore-based), PMS Admin (full system access)
    - **User Schema Enhancement**: Enhanced `users` table with role enum, vesselId, fullName, email, isActive, and audit timestamps
    - **Security**: PublicUser type (password excluded) for client-side use with runtime sanitization to prevent credential leakage
    - **AuthContext**: Provides role checking (hasRole, isShipUser, isOfficeUser, isPMSAdmin), document access control (canViewDocument, canDownloadDocument), and data modification permissions
    - **RoleGuard Components**: Generic RoleGuard with requireAll support (AND/OR semantics), AdminOnly, OfficeOrAdmin, ShipOnly convenience components
    - **Backend Middleware**: requireAuth, requireRole, requirePMSAdmin, requireOfficeOrAdmin, requireVesselAccess for route authorization
    - **Vessel Data Isolation**: Ship users can only access data for their assigned vessel; Office/Admin have fleet-wide access

## Database Schema Enhancements for 100% PMS Specification Compliance (November 2025)

**New Tables Added** (defined in `shared/schema.ts`):
1. **fleet_equipment_master** - Fleet-level master data for equipment codes, makers, models, and descriptions with full audit trail (created_by, created_at, updated_by, updated_at)
2. **component_running_hours_log** - Detailed audit trail for ALL running hours updates capturing vessel_code, component_code, previous_rh, new_rh, delta_rh, updated_by, update_source (manual/cascade/bulk_import/work_order)
3. **audit_log** - System-wide audit logging for ALL data changes across entities (components, jobs, work_orders, spares, documents, surveys, maintenance_history) with timestamp, user_id, vessel_code, entity_type, action_type, old_value, new_value, source
4. **component_documents** - Drawings, manuals, and technical documents with role-based access control (can_ship_view, can_ship_download), fleet_equipment_code linking, file_type categorization, version tracking
5. **component_class_regulatory** - Classification society and regulatory survey data supporting MULTIPLE survey rows per component with classification_society dropdown (DNV, ABS, Lloyd's Register, ClassNK, RINA, IRS), survey_type dropdown (Annual/5-Year/Intermediate/Damage/OEM Test/Statutory/Internal), certificate tracking, and expiry management
6. **component_maintenance_history** - Immutable maintenance records (NO EDITS/DELETES ALLOWED) auto-populated from approved work orders with work_description, spares_used, component replacement flag, and approval workflow integration

**Enhanced Tables**:
- **jobs**: Added `frequencyType`, `leadTimeValue`, `leadTimeUnit`, `createdBy`, `updatedBy` fields for lead time configuration and full audit trail
- **components**: Already contains required fields (componentCategory, makerCode, modelCode, conditionBased, isParent, createdAt, updatedAt)

**Database Immutability Constraints** (Pending Implementation - Task 8):
- PostgreSQL trigger/policy to prevent UPDATE/DELETE operations on component_maintenance_history table after row creation
- Ensures maintenance history integrity - not even PMS Admin can modify historical records

**Migration Status**:
- Schema definitions complete in `shared/schema.ts`
- Migration config created: `drizzle.postgres.config.ts` (PostgreSQL-specific)
- Awaiting DATABASE_URL environment variable availability in npm script context
- To sync: `npx drizzle-kit push --config drizzle.postgres.config.ts`

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`