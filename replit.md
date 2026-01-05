# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It manages technical equipment maintenance, scheduling, and performance tracking, with key capabilities in Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to enhance efficiency and compliance in maritime maintenance through a data-driven approach, streamlining operations, and ensuring regulatory adherence.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture with a mobile-first, responsive design. The frontend uses React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), and the backend is built with Express.js (TypeScript). All data is stored in PostgreSQL, with a strict "fail fast" policy if the database URL is not configured.

**UI/UX Decisions**:
- Mobile-first and responsive design is a core principle.
- Interactive data visualizations are used on the PMS Dashboard with AG Charts React.
- Work Order forms are designed as single scrollable pages with numbered subsections and professional maritime styling.
- Certificates & Surveys AG Grid Tables utilize AG Grid Enterprise with specific styling and inline date editing capabilities.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs serve as immutable templates, while Work Orders are execution records with a defined lifecycle.
- **Vessel Context**: The system supports dynamic fetching and auto-selection of vessels, including an "All Vessels" aggregate view.
- **Service Layer Architecture**: Business logic is organized by domain.
- **PMS Dashboard**: Provides a professional analytics workspace with data visualizations, including an "Outstanding Tasks" pie chart.
- **PMS Submodules**: Comprehensive CRUD operations are supported for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin functions.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic, with centralized status thresholds defined in `shared/workOrders/constants.ts`.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations. RH status is lead time-driven.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7, following specific naming conventions.
- **Spares Module (Enhanced Inventory System)**: Offers complete inventory management with many-to-many linking between spares and components, location registry, stock per location tracking (no negative stock), and a full audit trail via `inventory_transactions` (RECEIVE, CONSUME, ADJUST event types).
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates, enhanced validation UI, and duplicate component code checks), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implemented for authorization and data isolation across Ship, Office, and PMS Admin roles.
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: New tables and enhancements to existing tables, including PostgreSQL triggers for immutability constraints.
- **Work Order Naming Rules**: Strict naming conventions for Planned (`<JOB_CODE>-<COMPONENT_CODE>-<YYYY>-<RUNNING_3DIGIT>`) and Unplanned (`UWO-<VESSEL_CODE>-<YEAR>-<RUNNING_NUMBER>`) Work Orders.
- **Component Document Storage**: Handles file uploads using Replit Object Storage exclusively.
- **Centralized RH Update Architecture**: All running hours updates route through `server/postgresStorage.ts` for consistency and cascade updates.
- **Work Order Completion & Maintenance History**: Automated creation of maintenance history records and updates to job cycle dates upon work order approval.
- **Work Order Status Calculation**: Real-time status computation logic.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact parity for fields.
- **Part A Immutability Rule**: Work Order Part A is read-only for existing work orders.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix (e.g., `/technical/api/vessels`, `/technical/api/components/:vesselId`). This provides namespace separation and avoids routing conflicts.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`

## Issue Tracker (26-Dec-2025 Findings)
Progress tracking for issues from the 26-12-2025 findings document.

| Issue # | Description | Status | Date Completed |
|---------|-------------|--------|----------------|
| 1-6 | Various fixes | Completed | Prior sessions |
| 7 | Location-aware Consume/Receive for Spares | **Completed** | 05-Jan-2026 |
| 8-14 | Pending issues | Pending | - |

### Issue #7 Details (Completed 05-Jan-2026)
**Multi-Location Inventory Tracking**: Added location selection for consuming and receiving spare parts.
- **Backend**: Added `consumeSpareWithLocation` and `receiveSpareToLocation` methods in `server/postgresStorage.ts`
- **API**: Added `/technical/api/spares/:id/consume` and `/technical/api/spares/:id/receive-to-location` endpoints
- **Frontend**: Updated Consume/Receive modals with Location dropdown (Location A/B with available stock display)
- **Validation**: Per-location stock validation prevents over-consumption
- **History**: Location tracked in remarks field as "(Location A)" or "(Location B)"