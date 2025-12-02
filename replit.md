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
- **Core PMS Business Logic**: Jobs are IMMUTABLE templates defining maintenance tasks, frequency, assigned rank, and resources. Work Orders are execution records generated from Jobs, following a lifecycle from Auto-Generated to Completed/Rejected.
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

## Recent Bug Fixes (December 2024) - VERIFIED

The following 12 issues were identified, fixed, and verified via end-to-end testing:

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
| #9 | Running Hours delta propagation | Removed wrong inheritance logic, kept correct delta propagation in cascadeRunningHours | server/persistentStorage.ts |
| #10 | Missing Is Active toggle | Added dropdown to ComponentRegisterAddEdit.tsx | ComponentRegisterAddEdit.tsx |
| #11 | Bulk imports all going to components | Replaced mock implementations with UniformBulkUpload | FleetJobsUpload.tsx, FleetSparesUpload.tsx |
| #12 | Work Order Part A editable for existing WOs | Changed isPartAReadOnly to check for ANY workOrderId, not just linked jobs | WorkOrderFormPage.tsx |

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
- `client/src/pages/pms/JobsFormPage.tsx` (MASTER)
- `client/src/pages/pms/WorkOrderFormPage.tsx` (SLAVE - Part A section only)

**Checklist for Part A changes:**
- [ ] Jobs Form templateData state updated
- [ ] Work Order Form templateData state updated (identical fields)
- [ ] Jobs Form labels updated
- [ ] Work Order Form Part A labels updated (identical labels)
- [ ] Jobs Form field order matches Work Order Form Part A field order
- [ ] Both forms tested visually to confirm parity

**Rationale**: Work Order Part A is a frozen snapshot of the Job template at creation time. If the forms diverge, the snapshot will be incomplete or inconsistent, violating the core PMS business logic.

## Part A Immutability Rule (CRITICAL)

**Work Order Part A (Section A) is READ-ONLY for all existing work orders.**

- Part A contains the frozen snapshot of the job template
- Once a work order is created, Part A fields CANNOT be modified
- Only Part B (Work Completion Record) is editable
- This is enforced by `isPartAReadOnly = resolvedMode === 'template' || !!workOrderId`
- Part A is ONLY editable when creating a NEW work order (before first save)

**NEVER modify Part A fields in WorkOrderFormPage.tsx to make them editable for existing work orders.**

## Resilience Safeguards (December 2024)

The following safeguards were implemented to prevent functionality regressions:

| Safeguard | Location | Purpose |
|-----------|----------|---------|
| Cache Invalidation Helpers | `client/src/lib/cacheInvalidation.ts` | Domain-specific cache invalidation using predicate matching to catch all query patterns |
| Finite staleTime | `client/src/lib/queryClient.ts` | Changed from Infinity to 2 minutes for eventual consistency |
| Write Mutex | `server/persistentStorage.ts` | Queues file writes to prevent concurrent access corruption |
| Data Normalization | `server/persistentStorage.ts` | Backfills missing fields in legacy records on load |
| Form Hydration Guard | `client/src/pages/pms/WorkOrderFormPage.tsx` | Prevents late async data from overwriting user edits |

**Usage after bulk imports/mutations:**
```typescript
import { invalidateAfterBulkImport } from '@/lib/cacheInvalidation';
// After import succeeds:
invalidateAfterBulkImport(templateType, vesselId);
```

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
- Avoid definitive claims without verification, especially for critical functionality like data persistence

**Testing:**
- During every test check if the saved data **actually appears** on the screen after a page reload
- Be mindful of below root cause summary during testing

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`
