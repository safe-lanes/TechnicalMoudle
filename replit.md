# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It provides solutions for managing technical equipment maintenance, scheduling, and performance tracking, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to enhance efficiency and compliance in maritime maintenance through a data-driven approach.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture. The frontend is developed with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) ensuring a mobile-first and responsive user experience. The backend is built using Express.js (TypeScript).

**UI/UX Decisions**:
- Emphasis on mobile-first, responsive design.
- Interactive data visualizations on the PMS Dashboard using AG Charts React.
- Work Order forms are single scrollable pages with numbered subsections and professional maritime styling.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs are immutable templates; Work Orders are execution records with a defined lifecycle.
- **PersistentFileStorage**: All data is saved to `test-data.json` and persists across application restarts.
- **Vessel Context**: Dynamic fetching and auto-selection of vessels.
- **Service Layer Architecture**: Business logic is organized by domain.
- **Component Hierarchy**: Components are structured using a `parentId` field.
- **PMS Dashboard**: Professional analytics workspace with data visualizations.
- **PMS Submodules**: CRUD operations for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Per-Vessel PMS Settings**: Configurable lead times and grace periods per vessel.
- **Running Hours Module (Delta Propagation)**: Updates to parent RH propagate delta to children's independent RH values.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management with dual locations, ROB/Min/Max, bulk upload, and transaction history.
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Admin Module**: Bulk data import, data purging, and a Fleet Admin Dashboard.
- **Multi-Sheet Excel Bulk Import Templates**: 11-sheet system for Fleet and Vessel data.
- **Role-Based Access Control (RBAC)**: Implemented with `AuthContext`, `RoleGuard` components, and backend middleware for authorization and data isolation across three user roles (Ship, Office, PMS Admin).
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: New tables and enhancements to existing tables.
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only for `component_maintenance_history`.
- **Backend Hydration**: Work order API endpoints automatically enrich responses with lead time values.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) must maintain exact parity for fields, labels, and order.
- **Part A Immutability Rule**: Work Order Part A is READ-ONLY for all existing work orders, capturing a frozen snapshot of the job template.
- **Component Document Storage (Section F)**: Handles file uploads with an object storage fallback to the local filesystem.
- **Work Order Naming Rules**: All work orders must follow naming conventions: Planned = `<JOB CODE>.WO-<YEAR>-<NNN>` (e.g., `MKR-SE-00005.WO-2025-001`), Unplanned = `UWO-<VESSEL>-<YEAR>-<NNN>`. Use `generatePlannedWorkOrderNumber()` and `generateUnplannedWorkOrderNumber()` from `server/utils/workOrderNumbering.ts`. Storage layer logs warnings for non-compliant names but preserves data to maintain historical integrity.
- **Error Prevention Strategies**: Emphasizes verification-first, systematic data persistence checking, appropriate confidence levels, and honest acknowledgment of errors.
- **Root Cause Summary**: Focus on ensuring frontend correctly loads and displays data saved to `test-data.json` after page reloads.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`