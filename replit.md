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
- Utilizes AG Charts React for interactive data visualizations and AG Grid Enterprise for tables.
- Work Order forms are single-page, scrollable designs with numbered subsections, styled to reflect professional maritime aesthetics.

**Technical Implementations & Key Features**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **PMS Submodules**: Offers comprehensive CRUD functionalities for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7, and includes a target date extension workflow.
- **Spares Module**: Comprehensive inventory management with many-to-many linking, location-based stock tracking, and a full audit trail (RECEIVE, CONSUME, ADJUSTMENT event types).
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates and enhanced validation), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Fleet Admin Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema**: Utilizes PostgreSQL triggers for immutability constraints.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **Centralized RH Update Architecture**: All running hours updates are routed through `server/postgresStorage.ts`.
- **Work Order Completion**: Automates maintenance history creation and job cycle date updates upon approval.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix.
- **Change Request Workflow**: Implements an "Apply Approved Changes" step, automatically applying approved changes to target PMS entities within a database transaction.
- **ROB Lookup Reference Correction**: Fixed Remaining On Board (ROB) fetch logic to prioritize `partCode` for lookup, with fallback to `partNumber`.
- **Work Order Approval Spare Consumption**: Ensures spare parts listed for consumption are deducted from inventory upon work order approval.
- **Ship Certificates Admin Module**: Provides an admin sub-module for managing ship certificate requirements with master, company, and vessel-specific configurations.
- **AI-Powered PMS Chatbot**: Integrated AI assistant using OpenAI GPT-4o with function-calling tools for natural language queries of maintenance data, providing context-aware responses based on vesselId, currentPage, and userRole.

**Database Migration Strategy**:
The project uses a dual migration system:
1.  **Drizzle-generated baseline migrations** (`migrations/0000_*.sql`) - created once.
2.  **Custom ALTER migrations** (`server/migrations.ts`) - for incremental schema changes.
New columns **must** be added via ALTER TABLE migrations in `server/migrations.ts` and updated in `shared/schema.ts`. The baseline migration is frozen, and `drizzle-kit generate` should not be run after initial setup.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`, `openai`
*   **Development**: `vite`, `typescript`, `drizzle-kit`