# Seafarer Technical Management System

## Overview
This project is a comprehensive full-stack Technical Module for a maritime Planned Maintenance System (PMS). It offers robust solutions for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. Key capabilities include a PMS Dashboard, equipment and task management, reporting, and administrative functionalities, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to provide a data-driven approach to maritime maintenance, improving efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), ensuring a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**Storage Configuration**:
- **Development Mode**: Uses `PersistentFileStorage` for file-based JSON persistence (`test-data.json`).
- **Production Mode**: Will automatically switch to `PostgresStorage` when deployed/published.
- **Dual-Storage Architecture**: `server/storage.ts` conditionally selects storage based on `DATABASE_URL` availability:
  - If `process.env.DATABASE_URL` is present → `PostgresStorage` (PostgreSQL)
  - If `process.env.DATABASE_URL` is absent → `PersistentFileStorage` (JSON file)
- **Known Limitation**: Replit secrets (including DATABASE_URL) are only available in deployed/published apps, not during local development (`npm run dev`). This is why development mode uses file-based storage.
- **PostgresStorage Readiness**: Fully implemented with all Component Section H methods (Maintenance History, Documents, Class/Regulatory) ready for production activation.
- Database migrations are configured using Drizzle ORM (`npm run db:push`).
- **PostgreSQL Runtime Resolver**: `server/postgresClient.ts` provides cached connection pooling with lazy initialization, preventing socket leaks and supporting dual-mode operation.

**Service Layer Architecture**:
- A dedicated service layer in `server/services/` organizes business logic by domain, including `jobService`, `workOrderService`, `runningHoursService`, and `componentService`. This layer provides a clean API and validation, with future plans to move orchestration logic fully into services.

**Component Hierarchy Design**:
- Components are structured hierarchically using a `parentId` field, storing component codes for parent-child relationships.

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Utilizes AG Charts React for interactive, data-driven visualizations on the PMS Dashboard.
- Work Order forms feature a single scrollable page layout, numbered subsections, and professional maritime styling for enhanced usability.

**Technical Implementations & Key Features**:
- **PMS Dashboard**: Professional analytics workspace with tabbed layouts and data visualizations.
- **PMS Submodules**: Includes CRUD operations for Components (hierarchical tree), Work Orders (automatic status computation), Running Hours, Spares, Reports, Modify PMS, and Admin functionalities.
- **Jobs vs. Work Orders Architecture**: `Jobs` define maintenance task templates, while `Work Orders` are active/historical execution records, ensuring clear separation.
- **Work Order Automation**: Real-time status computation and strict filtering by `vesselId`.
- **Defects Module**: Tracks Condition of Class, identifies recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management (dual locations, ROB/Min/Max levels), quick quantity adjustments, bulk upload, transaction history, and work order integration for consumption reconciliation.
- **Calendar-Based Job Automation**: Automatic `nextDueDate` calculation based on `lastDoneDate + interval`, with robust date normalization and guard logic. Work order completion automatically updates parent job's `lastDoneDate` and recalculates `nextDueDate` for calendar-based maintenance.
- **Running Hours Module**: Cascade update system for parent/child components, automatic work order generation, backend validation, and SFI Code navigation.
- **Components Module Job Display**: Hierarchical job loading to display relevant maintenance tasks from parent and descendant components.
- **Admin Module**: Bulk data import for various entities, data purge functionality, and a Fleet Admin Dashboard for master data management.
- **Role-Based Access Control (RBAC)**: Implements three user roles (Ship, Office, PMS Admin) with enhanced user schema, security measures, `AuthContext` for permission checking, `RoleGuard` components, and backend middleware for route authorization and vessel data isolation.

**Database Schema Enhancements**:
- **New Tables**: `fleet_equipment_master`, `component_running_hours_log`, `audit_log`, `component_documents`, `component_class_regulatory`, `component_maintenance_history`.
- **Enhanced Tables**: 
  - `jobs`: frequencyType, lead time fields (leadTimeValue, leadTimeUnit), audit tracking
  - `components`: componentCategory, makerCode, modelCode, conditionBased, isParent, audit tracking
  - `work_orders`: jobId field for reliable job linkage and lead time hydration
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only behavior for `component_maintenance_history` table (UPDATE/DELETE operations blocked with error message). Triggers are automatically created/verified on server startup when DATABASE_URL is configured.
- **Backend Hydration**: Work order API endpoints (`/api/work-orders`) automatically enrich responses with `leadTimeValue` and `leadTimeUnit` from linked jobs, using `jobId` for reliable matching (fallback to `templateCode === jobNo` for legacy data).

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`