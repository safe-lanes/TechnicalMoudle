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
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations. RH status is lead time-driven.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7, following specific naming conventions.
- **Spares Module (Enhanced Inventory System)**:
    - Complete inventory management with many-to-many linking between spares and components.
    - Location registry and stock per location tracking with no negative stock.
    - Full audit trail via `inventory_transactions` with RECEIVE, CONSUME, and ADJUST event types.
    - `CONSUME` events require a work order reference.
    - Robust stock validation rules.
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Admin Module**: Bulk data import (with multi-sheet Excel templates, enhanced validation UI, and duplicate component code checks), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implemented for authorization and data isolation across Ship, Office, and PMS Admin roles.
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: New tables and enhancements to existing tables, including PostgreSQL triggers for immutability constraints.
- **Work Order Naming Rules**: Strict naming conventions for Planned and Unplanned Work Orders.
- **Component Document Storage (Section F)**: Handles file uploads using Replit Object Storage exclusively.
- **Centralized RH Update Architecture**: All running hours updates route through `storage.setComponentRunningHours()` for consistency and cascade updates.
- **Work Order Completion & Maintenance History**: Automated creation of maintenance history records and updates to job cycle dates upon work order approval.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact parity for fields.
- **Part A Immutability Rule**: Work Order Part A is read-only for existing work orders.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`