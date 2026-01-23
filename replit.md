# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Development Rule**: Whenever adding new database columns for any feature update, change, or addition, ALWAYS add a corresponding migration file to the `migrations/` folder. This ensures schema changes are tracked and can be applied automatically to any environment.

## System Architecture
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store.

**UI/UX Decisions**:
- Emphasizes a mobile-first and responsive design philosophy.
- Utilizes AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are single-page, scrollable designs with numbered subsections, styled to reflect professional maritime aesthetics.
- AG Grid Enterprise is used for Certificates & Surveys tables, featuring custom styling and inline date editing.

**Technical Implementations & Key Features**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations.
- **PMS Submodules**: Offers comprehensive CRUD functionalities for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7. Features a Part A/B/C structured form with target date extension workflow.
- **Spares Module**: Comprehensive inventory management with many-to-many linking between spares and components, location-based stock tracking, and a full audit trail. Uses three event types: RECEIVE (inbound), CONSUME (outbound), and ADJUSTMENT (stock corrections).
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates and enhanced validation), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Fleet Admin Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema**: Utilizes PostgreSQL triggers for immutability constraints and includes new tables/enhancements.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **Centralized RH Update Architecture**: All running hours updates are routed through `server/postgresStorage.ts`.
- **Work Order Completion**: Automates maintenance history creation and job cycle date updates upon approval.
- **Master-Slave Parity**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact field parity.
- **Part A Immutability**: Work Order Part A is read-only for existing work orders.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix for namespace separation.
- **Change Request Workflow**: Implements an "Apply Approved Changes" step where approved changes are automatically applied to the target PMS entity within a database transaction for atomicity.
- **ROB Lookup Reference Correction**: Fixed ROB fetch logic to use `PartCode` as the primary lookup key, with fallback to `PartNumber` for backward compatibility.
- **Work Order Approval Spare Consumption Fix**: Ensured spare parts listed in B4 (Consumed Spare Parts) are deducted from inventory upon work order approval by adding consumption logic to the PATCH `/technical/api/work-orders/:id` route.
- **Ship Certificates Admin Module**: Admin sub-module for managing ship certificate requirements with a 3-tab interface (Master, Company, Vessel), including configurable categories, groups, and company labels. Company tab persists company-specific fields (Company ID, Company Group, Company Sequence) to the database. Vessel tab features a searchable multi-select dropdown that fetches vessel options from Vessel Master (Admin > Masters, ID:001), with "All Vessels" toggle and auto-selection on load.
- **Database Migration Strategy**: Uses a dual migration system with Drizzle-generated baseline migrations and custom `ALTER TABLE` migrations managed in `server/migrations.ts` for incremental schema changes. New columns must be added to both `shared/schema.ts` and `server/migrations.ts`.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`