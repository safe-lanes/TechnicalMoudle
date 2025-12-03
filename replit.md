# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS), offering solutions for managing technical equipment maintenance, scheduling, and performance tracking. It focuses on Certificate & Surveys, Defect Reporting, and core PMS operations to provide a data-driven approach for improved efficiency and compliance in maritime maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application uses a modern full-stack architecture. The frontend is built with React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) for a mobile-first and responsive user experience. The backend is powered by Express.js (TypeScript).

**UI/UX Decisions**:
- Emphasizes a mobile-first, responsive design.
- Uses AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are single scrollable pages with numbered subsections and professional maritime styling.

**Technical Implementations & Key Features**:
- **Core PMS Business Logic**: Jobs are immutable templates; Work Orders are execution records generated from Jobs with a defined lifecycle.
- **Dual-Storage Architecture**: Dynamically switches between `PostgresStorage` (production) and `PersistentFileStorage` (development), managed by Drizzle ORM.
- **PersistentFileStorage**: All data is saved to `test-data.json` and persists across application restarts.
- **Vessel Context**: Dynamically fetches and auto-selects vessels.
- **Service Layer Architecture**: Organizes business logic by domain.
- **Component Hierarchy Design**: Components are structured hierarchically using a `parentId` field.
- **PMS Dashboard**: Professional analytics workspace with data visualizations.
- **PMS Submodules**: CRUD operations for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Per-Vessel PMS Settings**: Configurable lead times and grace periods per vessel.
- **Job Cycle Updates**: Automatic updates to job fields upon work order completion.
- **Running Hours Module (Delta Propagation)**: Updates to parent RH propagate delta to children's independent RH values. Child replacement resets RH to 0.
- **Spare Parts Consumed**: Pre-loads required spares, allows manual entry, tracks consumption, and triggers inventory alerts.
- **Defects Module**: Tracks Condition of Class, recurring defects, and integrates with SIRE VIQ 7.
- **Spares Module**: Inventory management with dual locations, ROB/Min/Max, bulk upload, and transaction history.
- **Work Order Sort Order**: Priority-based sorting.
- **Auto-Generation Scheduler**: Automatically generates work orders for calendar and RH-based jobs.
- **Components Module Job Display**: Displays relevant maintenance tasks from parent and descendant components.
- **Admin Module**: Bulk data import, data purging, and a Fleet Admin Dashboard.
- **Multi-Sheet Excel Bulk Import Templates**: 11-sheet system for Fleet and Vessel data with parsing for components, jobs, spares, and master data.
- **Role-Based Access Control (RBAC)**: Implements three user roles (Ship, Office, PMS Admin) with `AuthContext`, `RoleGuard` components, and backend middleware for authorization and data isolation.
- **Global Business Rules Compliance**: Enforces rules for Parent vs Sub-Component RH Authority, Jobs Belong to Sub-Components, Stores Module Isolation, Component Code Cascade Updates, Component Cascade Inactivate, RH Correction → WO Re-trigger, Grace Period → Overdue Transition, Job Frequency Change Impact, Spare Consumption Warning, and Multi-Department Approver Validation.
- **Fleet Admin Workflow Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema Enhancements**: Introduction of new tables and enhancements to existing tables.
- **Immutability Constraints**: PostgreSQL triggers enforce INSERT-only behavior for `component_maintenance_history`.
- **Backend Hydration**: Work order API endpoints automatically enrich responses with lead time values.
- **Master-Slave Parity Protocol**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) must maintain exact parity for fields, labels, and order to preserve the frozen snapshot rule for Work Order Part A. Part A of Work Orders is read-only for existing work orders.
- **Change Request Approval**: Approved changes are automatically applied to the target entity.
- **Component Is Active Toggle**: Component edit forms include "Is Active" dropdown, "Vessel Code", and "Is Parent" fields.
- **Bulk Import Type Routing**: Uses `UniformBulkUpload` component with `templateType` parameter for correct routing of Fleet Jobs and Fleet Spares imports.
- **Resilience Safeguards**: Includes Cache Invalidation Helpers, finite staleTime for eventual consistency, Write Mutex for file writes, Data Normalization, and Form Hydration Guard.

## Recent Bug Fixes (December 2024)

| Issue | Problem | Solution | Files Modified |
|-------|---------|----------|----------------|
| #1 | Component edits not persisting | Fixed API endpoint to call storage.updateComponent() | server/routes.ts |
| #2 | New components not appearing in tree | Fixed parent ID lookup and tree refresh | server/persistentStorage.ts |
| #3 | Spares ROB history not tracking | Added transaction logging for ROB updates | server/routes.ts |
| #4 | Spares component tree not displaying | Fixed hierarchical tree rendering | SparesPage.tsx |
| #5 | Counter-based WO validation error | Fixed validation for Running Hours jobs | WorkOrderFormPage.tsx |
| #6 | Unplanned WO missing component list | Fixed component fetch for dropdown | WorkOrderFormPage.tsx |
| #7 | Unplanned WO save failing | Fixed save payload construction | server/routes.ts |
| #8 | Change request approval not applying | Added automatic entity update on approval | server/routes/modifyPms.ts |
| #9 | Running Hours delta propagation | Removed wrong inheritance logic, kept correct delta propagation | server/persistentStorage.ts |
| #10 | Missing Is Active toggle | Added dropdown to ComponentRegisterAddEdit.tsx | ComponentRegisterAddEdit.tsx |
| #11 | Bulk imports all going to components | Replaced mock implementations with UniformBulkUpload | FleetJobsUpload.tsx, FleetSparesUpload.tsx |
| #12 | Work Order Part A editable for existing WOs | Changed isPartAReadOnly to check for ANY workOrderId | WorkOrderFormPage.tsx |
| #13 | Duplicate "Assigned To" in Part A and Part B | Removed redundant editable "Assigned To" from Part B Section B2.1 | WorkOrderFormPage.tsx |
| #14 | Stores/Spares bulk import undo not working | Added storesItem and spare entity types to undo conflict detection, state capture, and undo operations | server/routes/bulk.ts |
| #15 | Component document uploads failing (Section F) | Fixed tree node IDs to use component.id, added storage methods for component documents, implemented local file storage fallback when object storage fails | ComponentRegisterAddEdit.tsx, persistentStorage.ts, routes.ts, localFileStorage.ts |
| #16 | Work order auto-generation ignoring configured lead times | Updated autoGenerateWorkOrdersFromJobs and processRunningHoursJobs to fetch vessel PMS settings and apply lead times (7d/14d for calendar, 50hrs/100hrs for RH). Added vesselId to duplicate keys, clamped RH trigger to prevent negative values | workOrderService.ts, jobDueScanner.ts |

## Component Document Storage (Section F: Drawings & Manuals)

**Technical Implementation**:
- Files are uploaded via POST /api/component-documents with multipart/form-data
- System first attempts object storage (Google Cloud Storage), falls back to local filesystem if authentication fails
- Local files saved to: `uploads/component-documents/{componentCode}/{timestamp}_{filename}`
- Document metadata includes `storageBackend` field ('object' | 'local') to track storage location
- Downloads check `storageBackend` and serve from appropriate location
- Storage methods: getComponentDocuments, getComponentDocument, createComponentDocument, updateComponentDocument, deleteComponentDocument

**Files Added/Modified**:
- `server/services/localFileStorage.ts` - LocalFileStorage utility for filesystem operations
- `server/persistentStorage.ts` - Added componentDocuments and componentClassRegulatory storage
- `server/routes.ts` - Updated upload/download routes with fallback logic
- `shared/schema.ts` - Added storageBackend field to componentDocuments table

## Part A vs Part B Field Separation (CRITICAL RULE)

**Work Order forms have TWO distinct sections with different purposes:**

### Part A - Job Template Snapshot (READ-ONLY for existing WOs)
Contains the frozen job template information captured at work order creation:
- Job Title, Component Name, Component Code
- Job Code, Maintenance Basis, Frequency
- Task Type, **Assigned To (Rank)**, Approver (Rank)
- Job Priority, Class Related, Next Due Date/RH
- Department, Criticality, Is Active
- Brief Work Description
- Required Spare Parts, Required Tools, Safety Requirements

**Part A "Assigned To (Rank)"** = WHO the job is ASSIGNED TO per the job template (IMMUTABLE)

### Part B - Work Completion Record (EDITABLE)
Contains execution-time information recorded when completing work:
- Risk Assessment, Safety Checklists, Operational Forms
- Start Date/Time, Completion Date/Time
- **Performed By** = WHO ACTUALLY DID the work (NOT "Assigned To")
- No of Persons, Total Time Taken, Manhours
- Running Hours (if applicable)
- Work Carried Out, Job Experience Notes
- Spare Parts Consumed, Uploaded Documents

**CRITICAL**: Part B does NOT have an "Assigned To" field. The assignment is already captured in Part A. Part B only has "Performed By" to record who actually executed the work.

**DO NOT add "Assigned To" to Part B.** This was Bug #13 that was fixed by removing the duplicate field.

## Master-Slave Parity Protocol (MANDATORY)

**THIS IS A NON-NEGOTIABLE RULE. NO EXCEPTIONS.**

`JobsFormPage.tsx` is the **MASTER** template. `WorkOrderFormPage.tsx` Part A is the **SLAVE** that must mirror it exactly.

**Rule**: Any change to Jobs Form Part A MUST be immediately mirrored to Work Order Form Part A.

**Before completing ANY Part A modification:**
1. Modify Jobs Form (master template)
2. **Immediately** modify Work Order Form Part A (frozen snapshot) with identical changes
3. Verify both forms display the same fields, labels, and order
4. Never mark a Part A change as complete until BOTH forms are updated

**Affected files:**
- `client/src/pages/pms/JobsFormPage.tsx` (MASTER)
- `client/src/pages/pms/WorkOrderFormPage.tsx` (SLAVE - Part A section only)

## Part A Immutability Rule (CRITICAL)

**Work Order Part A is READ-ONLY for all existing work orders.**

- Part A contains the frozen snapshot of the job template
- Once a work order is created, Part A fields CANNOT be modified
- Only Part B (Work Completion Record) is editable
- Enforced by: `isPartAReadOnly = resolvedMode === 'template' || !!workOrderId`

**NEVER make Part A fields editable for existing work orders.**

## Database Persistence - JSON

Application should **ALWAYS** use `PersistentFileStorage` which saves all data to `test-data.json` file, data persists across application restarts.

**Technical Implementation:**
1. Use PersistentFileStorage Class:
   - Save all data to `test-data.json` in real-time
   - Load existing data on application startup
   - Handle all CRUD operations with automatic file updates

2. Storage Initialization:
   - Application should **ALWAYS** use `PersistentFileStorage`
   - Remove any fallback to `MemStorage`
   - Add clear logging to confirm which storage is active

## Error Prevention Strategies

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
- Avoid definitive claims without verification

**4. Honest acknowledgment:**
- When discovering a previous response was wrong, immediately acknowledge it
- Focus on fixing the actual problem rather than defending incorrect responses

**Testing:**
- During every test check if saved data **actually appears** on the screen after a page reload

## Root Cause Summary

The system can **SAVE** data perfectly (backend works fine), but the frontend **NEVER LOADS** the saved data back. It's like saving files to a hard drive but never reading them - they're there in `test-data.json`, but the UI doesn't know they exist.

**Always verify:**
1. Data saves to storage (check `test-data.json`)
2. API returns the saved data correctly
3. Frontend fetches and displays the data
4. Data persists after page reload

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`
