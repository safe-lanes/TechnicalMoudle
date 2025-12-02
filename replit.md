# Seafarer Technical Management System

## Overview
This project is a comprehensive full-stack Technical Module for a maritime Planned Maintenance System (PMS). It provides robust solutions for managing technical equipment maintenance, scheduling, and performance tracking, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to offer a data-driven approach to maritime maintenance, improving efficiency and compliance for maritime professionals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application utilizes a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) for a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Uses AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are designed as single scrollable pages with numbered subsections and professional maritime styling.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs are immutable templates defining maintenance tasks, frequency, assigned rank, and resources. Work Orders are execution records generated from Jobs, following a lifecycle from Auto-Generated to Completed/Rejected.
- **Dual-Storage Architecture**: Dynamically switches between `PostgresStorage` (production) and `PersistentFileStorage` (development), managed by Drizzle ORM.
- **Vessel Context**: Dynamically fetches and auto-selects vessels.
- **Service Layer Architecture**: Organizes business logic by domain.
- **Component Hierarchy Design**: Components are structured hierarchically using a `parentId` field.
- **PMS Dashboard**: Professional analytics workspace with data visualizations.
- **PMS Submodules**: CRUD operations for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Per-Vessel PMS Settings**: Configurable lead times and grace periods per vessel.
- **Job Cycle Updates**: Automatic updates to job fields (`lastDoneDate`, `nextDueDate`, `lastDoneRH`, `nextDueRH`) upon work order completion.
- **Running Hours Module (Delta Propagation)**: When parent RH is updated, the delta is propagated to children's independent RH values. Child replacement resets RH to 0.
- **Spare Parts Consumed**: Pre-loads required spares from jobs, allows manual entry, tracks consumption, and triggers inventory alerts.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management with dual locations, ROB/Min/Max, bulk upload, and transaction history.
- **Work Order Sort Order**: Priority-based sorting.
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Components Module Job Display**: Displays relevant maintenance tasks from parent and descendant components.
- **Admin Module**: Bulk data import, data purging, and a Fleet Admin Dashboard.
- **Multi-Sheet Excel Bulk Import Templates**: Comprehensive 11-sheet system for Fleet and Vessel data with parsing for components, jobs, spares, and master data.
- **Role-Based Access Control (RBAC)**: Implements three user roles (Ship, Office, PMS Admin) with `AuthContext`, `RoleGuard` components, and backend middleware for authorization and data isolation.
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Jobs Belong to Sub-Components, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: Introduction of new tables (e.g., `fleet_equipment_master`, `component_running_hours_log`, `audit_log`, `stores_items`, `pms_vessel_settings`) and enhancements to existing tables.
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only behavior for `component_maintenance_history`.
- **Backend Hydration**: Work order API endpoints automatically enrich responses with lead time values.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) must always maintain exact parity for fields, labels, and order to preserve the frozen snapshot rule for Work Order Part A.
- **Change Request Approval**: Approved changes are automatically applied to the target entity (component, spare, job, store).
- **Component Is Active Toggle**: Component edit forms include "Is Active" dropdown, "Vessel Code", and "Is Parent" fields.
- **Bulk Import Type Routing**: Uses `UniformBulkUpload` component with `templateType` parameter for correct routing of Fleet Jobs and Fleet Spares imports.
- **PersistentFileStorage**: The application uses `PersistentFileStorage` to save all data to `test-data.json`, ensuring data persists across application restarts.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`