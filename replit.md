# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It manages technical equipment maintenance, scheduling, and performance tracking, with key capabilities in Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to enhance efficiency and compliance in maritime maintenance through a data-driven, data-driven approach.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture with a mobile-first, responsive design. The frontend uses React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), and the backend is built with Express.js (TypeScript). All data is stored in PostgreSQL, with a strict "fail fast" policy if the database URL is not configured.

**UI/UX Decisions**:
- Mobile-first and responsive design.
- Interactive data visualizations on the PMS Dashboard using AG Charts React.
- Work Order forms are single scrollable pages with numbered subsections and professional maritime styling.
- Certificates & Surveys AG Grid Tables use AG Grid Enterprise with specific styling and inline date editing capabilities.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs are immutable templates; Work Orders are execution records with a defined lifecycle.
- **Vessel Context**: Supports dynamic fetching and auto-selection of vessels, including an "All Vessels" aggregate view.
- **Service Layer Architecture**: Business logic is organized by domain.
- **PMS Dashboard**: Professional analytics workspace with data visualizations, including an "Outstanding Tasks" pie chart.
- **PMS Submodules**: CRUD operations for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Centralized Status Thresholds** → `shared/workOrders/constants.ts`: Single source of truth for all work order status thresholds. DO NOT modify unless explicitly requested. Values:
    - Calendar Lead Time: 30 days (Active → Due transition)
    - RH Lead Time: 720 hours (Active → Due transition)
    - RH Grace Period: 168 hours (Due → Overdue after grace)
    - Calendar Grace Period: 7 days (minimum)
    - All services import from this file - no hardcoded fallbacks allowed.
- **Running Hours Module** → `server/services/runningHoursService.ts`: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations. RH status is lead time-driven.
- **Defects Module** → `server/utils/defectNumbering.ts`: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7, following specific naming conventions.
- **Spares Module (Enhanced Inventory System)** → `server/postgresStorage.ts` (inventory methods):
    - Complete inventory management with many-to-many linking between spares and components.
    - Location registry and stock per location tracking with no negative stock.
    - Full audit trail via `inventory_transactions` with RECEIVE, CONSUME, and ADJUST event types.
    - `CONSUME` events require a work order reference.
    - Robust stock validation rules.
- **Auto-Generation Scheduler** → `server/services/jobDueScanner.ts`: Automatically generates work orders for calendar and RH-based jobs.
- **Admin Module**: Bulk data import (with multi-sheet Excel templates, enhanced validation UI, and duplicate component code checks), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implemented for authorization and data isolation across Ship, Office, and PMS Admin roles.
- **Global Business Rules Compliance** → `server/businessRules.ts`: Enforces rules for Parent vs Sub-Component RH Authority, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements** → `shared/schema.ts`: New tables and enhancements to existing tables, including PostgreSQL triggers for immutability constraints.
- **Work Order Naming Rules** → `server/utils/workOrderNumbering.ts`: Strict naming conventions for Planned and Unplanned Work Orders.
    - Planned WO Format: `<JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>` (e.g., MK-000041-711.001-2025-001)
    - Unplanned WO Format: `UWO-<VESSEL_CODE>-<YEAR>-<RUNNING_NUMBER>` (e.g., UWO-VESSEL01-2025-001)
    - Job Number Format: `MKR-<TYPE_CODE>-<5DIGIT>` (e.g., MKR-IN-00001)
- **Component Document Storage (Section F)** → `server/objectStorage.ts`: Handles file uploads using Replit Object Storage exclusively.
- **Centralized RH Update Architecture** → `server/postgresStorage.ts` (setComponentRunningHours): All running hours updates route through this method for consistency and cascade updates.
- **Work Order Completion & Maintenance History** → `server/services/workOrderService.ts`: Automated creation of maintenance history records and updates to job cycle dates upon work order approval.
- **Work Order Status Calculation** → `server/utils/workOrderStatus.ts` + `shared/workOrders/status.ts`: Real-time status computation logic.
- **Master-Slave Parity Protocol**: `client/src/pages/pms/JobsFormPage.tsx` (MASTER) and `client/src/pages/pms/WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact parity for fields.
- **Part A Immutability Rule**: Work Order Part A is read-only for existing work orders.
- **Component Service** → `server/services/componentService.ts`: Component CRUD, code generation, and cascade operations.
- **Job Service** → `server/services/jobService.ts`: Job template management and validation.
- **SFI Lookup** → `server/utils/sfiLookup.ts`: SFI code validation and lookup.
- **Code Generation** → `server/utils/codeGeneration.ts`: Auto-generation of component codes and other identifiers.
- **Date Utilities** → `shared/dateUtils.ts` + `shared/utils/dateCalculations.ts`: Centralized date handling and calculations.
- **Defect Status Logic** → `shared/defectStatus.ts`: Defect lifecycle and status transitions.
- **Change Request Schema** → `shared/changeRequestSchema.ts`: Change request data model and validation.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`

## Quick Reference: Implementation File Lookup

When looking for convention/rule implementations, check these files FIRST:

| Convention/Feature | Source File |
|-------------------|-------------|
| Work Order Naming | `server/utils/workOrderNumbering.ts` |
| Work Order Status | `server/utils/workOrderStatus.ts` + `shared/workOrders/status.ts` |
| Status Thresholds | `shared/workOrders/constants.ts` |
| Defect Numbering | `server/utils/defectNumbering.ts` |
| Code Generation | `server/utils/codeGeneration.ts` |
| SFI Lookup | `server/utils/sfiLookup.ts` |
| Business Rules | `server/businessRules.ts` |
| Database Schema | `shared/schema.ts` |
| Running Hours | `server/services/runningHoursService.ts` |
| Job Due Scanner | `server/services/jobDueScanner.ts` |
| Component Service | `server/services/componentService.ts` |
| Job Service | `server/services/jobService.ts` |
| Work Order Service | `server/services/workOrderService.ts` |
| Object Storage | `server/objectStorage.ts` |
| Date Utilities | `shared/dateUtils.ts` + `shared/utils/dateCalculations.ts` |
| Defect Status | `shared/defectStatus.ts` |
| Change Requests | `shared/changeRequestSchema.ts` |

**Lookup Order**: `replit.md` → Implementation file from table above → `shared/` for types → `server/` for logic