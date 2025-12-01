# Seafarer Technical Management System

## Overview
This project is a comprehensive full-stack Technical Module for a maritime Planned Maintenance System (PMS). It provides robust solutions for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. Key capabilities include a PMS Dashboard, equipment and task management, reporting, and administrative functionalities, with a focus on Certificate & Surveys, Defect Reporting, and core PMS operations. The system aims to offer a data-driven approach to maritime maintenance, improving efficiency and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application utilizes a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) for a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Uses AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are designed as single scrollable pages with numbered subsections and professional maritime styling.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs are immutable templates for maintenance tasks, defining details, frequency (calendar or running hours), assigned rank, and required resources. Work Orders are execution records generated from Jobs, with a frozen Part A (snapshot of the Job) and an editable Part B. Work Orders follow a lifecycle: Auto-Generated -> Due -> Active -> Pending Approval -> Completed (immutable audit record) or Rejected.
- **Dual-Storage Architecture**: Dynamically switches between `PostgresStorage` (production) and `PersistentFileStorage` (development). Drizzle ORM manages database migrations.
- **Vessel Context**: Dynamically fetches vessels and auto-selects to prevent data loading issues.
- **Service Layer Architecture**: Organizes business logic by domain (e.g., `jobService`, `workOrderService`).
- **Component Hierarchy Design**: Components are structured hierarchically using a `parentId` field.
- **PMS Dashboard**: Professional analytics workspace with data visualizations.
- **PMS Submodules**: CRUD operations for Components (hierarchical), Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, spec-compliant numbering, lead time warnings, and grace period logic (Company Standard or Custom Days).
- **Per-Vessel PMS Settings**: Configurable lead times and grace periods per vessel via `pms_vessel_settings` table.
- **Job Cycle Updates**: Automatic updates to job fields (`lastDoneDate`, `nextDueDate`, `lastDoneRH`, `nextDueRH`) upon work order completion.
- **Running Hours Module**: Handles previous and current readings for sub-components with strict validation rules.
- **Spare Parts Consumed**: Pre-loads required spares from jobs, allows manual entry, tracks consumption, and triggers inventory deduction/low-stock alerts.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management with dual locations, ROB/Min/Max, bulk upload, and transaction history.
- **Work Order Sort Order**: Priority-based sorting (Overdue → Grace P → Due → Postponed → Pending Approval → Active → Completed → Rejected).
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Components Module Job Display**: Displays relevant maintenance tasks from parent and descendant components.
- **Admin Module**: Bulk data import, data purging, and a Fleet Admin Dashboard.
- **Multi-Sheet Excel Bulk Import Templates**: Comprehensive 11-sheet system for Fleet and Vessel data, including components, jobs, spares, and master data, with parsing of semicolon-separated values into structured objects.
- **Role-Based Access Control (RBAC)**: Implements three user roles (Ship, Office, PMS Admin) with enhanced user schema, `AuthContext`, `RoleGuard` components, and backend middleware for authorization and data isolation.
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Jobs Belong to Sub-Components, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning (Rule #9), and Multi-Department Approver Validation (Rule #19).
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: Introduction of new tables (`fleet_equipment_master`, `component_running_hours_log`, `audit_log`, `component_documents`, `component_class_regulatory`, `component_maintenance_history`, `stores_items`, `stores_ledger`, `pms_vessel_settings`) and enhancements to existing tables for robust data management.
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only behavior for `component_maintenance_history`.
- **Backend Hydration**: Work order API endpoints automatically enrich responses with lead time values from linked jobs.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) must always be kept in exact parity for fields, labels, and order to maintain the frozen snapshot rule for Work Order Part A.
- **Change Request Approval (Issue #8)**: When change requests are approved, the approved changes are automatically applied to the target entity (component, spare, job, store). Field names with prefixes (e.g., `componentInfo.notes`) are normalized before update. Fallback lookup by componentCode respects vesselId. Hardcoded main categories (IDs 1-8) cannot be modified since they're organizational placeholders.

## Master-Slave Parity Protocol (MANDATORY)

**THIS IS A NON-NEGOTIABLE RULE. NO EXCEPTIONS.**

Jobs Form (`JobsFormPage.tsx`) is the **MASTER** template. Work Order Form Part A (`WorkOrderFormPage.tsx`) is the **SLAVE** that must mirror it exactly.

**Rule**: Any change to Jobs Form Part A MUST be immediately mirrored to Work Order Form Part A in the SAME action.

**Before completing ANY Part A modification:**
1. Modify Jobs Form (master template)
2. **Immediately** modify Work Order Form Part A (frozen snapshot) with identical changes
3. Verify both forms display the same fields, labels, and order
4. Never mark a Part A change as complete until BOTH forms are updated

**Affected files that must always be updated together:**
- `client/src/pages/pms/JobsFormPage.tsx` (master)
- `client/src/pages/pms/WorkOrderFormPage.tsx` (slave - Part A section only)

**Checklist for Part A changes:**
- [ ] Jobs Form templateData state updated
- [ ] Work Order Form templateData state updated (identical fields)
- [ ] Jobs Form labels updated
- [ ] Work Order Form Part A labels updated (identical labels)
- [ ] Jobs Form field order matches Work Order Form Part A field order
- [ ] Both forms tested visually to confirm parity

**Rationale**: Work Order Part A is a frozen snapshot of the Job template at creation time. If the forms diverge, the snapshot will be incomplete or inconsistent, violating the core PMS business logic.

## Database Persistence Prompt - JSON

Application should **ALWAYS** use `PersistentFileStorage` which saves all data to `test-data.json` file, data persists across application restarts.

**Technical Implementation:**
1. Use PersistentFileStorage Class:
   - Save all data to `test-data.json` in real-time
   - Load existing data on application startup
   - Handle all CRUD operations with automatic file updates

2. Storage Initialization (Foolproof):
   - Application should **ALWAYS** use `PersistentFileStorage`
   - Remove any fallback to `MemStorage`
   - Add clear logging to confirm which storage is active

## Replit Error Prevention Strategies

**1. Verification-first approach:**
- Always check actual code implementation before making claims about functionality
- Test critical user workflows when possible rather than assuming they work
- Use phrases like "Let me verify this" or "Based on the code I can examine" instead of definitive statements

**2. Systematic checking for data persistence claims:**
- Frontend: Verify save functions actually make API calls
- Backend: Confirm API endpoints exist and persist to storage
- Storage: Check that data actually gets written to `test-data.json`
- End-to-end: Verify data survives application restarts

**3. Appropriate confidence levels:**
- Use "I can see that..." for things I can directly observe in code
- Use "Let me check..." for things that need verification
- Avoid definitive claims without verification, especially for critical functionality like data persistence

**4. Honest acknowledgment:**
- When I discover my previous response was wrong, immediately acknowledge it
- Explain what I missed in my analysis
- Focus on fixing the actual problem rather than defending the incorrect response

**Testing:**
- During every test check if the saved data **actually appears** on the screen after a page reload
- Be mindful of below root cause summary during testing

**Root Cause Summary:**
The system can **SAVE** data perfectly (backend works fine), but the frontend **NEVER LOADS** the saved data back. It's like saving files to a hard drive but never reading them - they're there in `test-data.json`, but the UI doesn't know they exist.

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`