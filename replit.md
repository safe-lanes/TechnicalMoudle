# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations. The system aims to enhance operational efficiency, ensure compliance with maritime regulations, and provide a data-driven approach to maintenance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a modern full-stack architecture with a mobile-first, responsive design. The frontend is developed using React (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter), while the backend is powered by Express.js (TypeScript). PostgreSQL serves as the primary data store, with a critical dependency on a configured database URL.

**UI/UX Decisions**:
- Emphasizes a mobile-first and responsive design philosophy.
- Utilizes AG Charts React for interactive data visualizations on the PMS Dashboard.
- Work Order forms are single-page, scrollable designs with numbered subsections, styled to reflect professional maritime aesthetics.
- AG Grid Enterprise is used for Certificates & Surveys tables, featuring custom styling and inline date editing.

**Technical Implementations & Key Features**:
- **Core PMS Logic**: Distinguishes between immutable Job templates and executable Work Order records with defined lifecycles.
- **Vessel Context**: Supports dynamic vessel selection and an "All Vessels" aggregate view.
- **Service Layer**: Business logic is organized into domain-specific services.
- **PMS Dashboard**: Provides analytics and data visualizations, including an "Outstanding Tasks" pie chart.
- **PMS Submodules**: Offers comprehensive CRUD functionalities for Components, Work Orders, Running Hours, Spares, Reports, Modify PMS, and Admin.
- **Work Order Automation**: Features real-time status computation, vessel-specific filtering, numbering, lead time warnings, and grace period logic.
- **Running Hours Module**: Supports MASTER, INHERITED, and NOT_RH_DRIVEN counter types with delta propagation and safety validations.
- **Defects Module**: Tracks Condition of Class and recurring defects, integrating with SIRE VIQ 7.
- **Spares Module**: Comprehensive inventory management with many-to-many linking between spares and components, location-based stock tracking, and a full audit trail.
- **Auto-Generation Scheduler**: Automates work order creation for calendar and RH-based jobs.
- **Admin Module**: Includes bulk data import (with multi-sheet Excel templates and enhanced validation), data purging, and a Fleet Admin Dashboard.
- **Role-Based Access Control (RBAC)**: Implements authorization and data isolation for Ship, Office, and PMS Admin roles.
- **Global Business Rules**: Enforces critical rules like Parent vs Sub-Component RH Authority, Stores Module Isolation, and Work Order naming conventions.
- **Fleet Admin Enhancements**: Includes Fleet Vessel Mapping, On-Demand WO Generation, and Postponed WO Reappearance.
- **Database Schema**: Utilizes PostgreSQL triggers for immutability constraints and includes new tables/enhancements.
- **Component Document Storage**: Handles file uploads exclusively via Replit Object Storage.
- **Centralized RH Update Architecture**: All running hours updates are routed through `server/postgresStorage.ts` for consistency.
- **Work Order Completion**: Automates maintenance history creation and job cycle date updates upon approval.
- **Master-Slave Parity**: `JobsFormPage.tsx` (MASTER) and `WorkOrderFormPage.tsx` (SLAVE - Part A) maintain exact field parity.
- **Part A Immutability**: Work Order Part A is read-only for existing work orders.
- **API Route Prefix**: All API endpoints use the `/technical/api` prefix for namespace separation.

## Recent Changes
- **Bulk Component Upload Explicit Parent Fix** (Jan 12, 2026): Fixed the bulk component upload to respect explicit Parent Component Codes provided in Excel. Previously, the system auto-inferred intermediate parents (e.g., uploading child 721.801.01 with explicit parent 721.001.01 would create unwanted 721.801). Now uses metadata tracking system (`__meta.explicitParentProvided`, `__meta.originalExplicitParent`) that survives through normalizeColumnNames → validateData → cache → performImport. Parent creation logic checks metadata: skips auto-inferred parents, creates explicit parents only if missing. Row sorting prioritizes rows referenced as explicit parents. Helper functions `getExplicitParentFromRow()` and `getExplicitParentFromRowEarly()` check all header variants for robustness.
- **Maintenance Planner Multi-Component Jobs Fix** (Jan 12, 2026): Fixed the Maintenance Planner to correctly display all job-component combinations. Previously, jobs were iterated only once using deprecated single-component fields (componentId, componentCode). Now the planner fetches `jobComponentLinks` for the vessel and creates a separate planner row for each job-component pair. Backward compatibility preserved via fallback to deprecated fields when no links exist. Job + Component + Vessel is now the true planner entity.
- **RH Validation for Inherited Components** (Jan 12, 2026): Added dual validation (frontend + backend) to prevent inherited components from having running hours exceeding their master component. Frontend shows warning that master RH must be updated first. Backend rejects approval if RH validation fails. Fixed component RH update logic on WO approval - inherited components now only update their own RH record (Section B), not the master. Master component RH is only updated via Running Hours module which cascades to children.
- **Stores History Display Fix** (Jan 12, 2026): Fixed frontend history mapping to use correct storesLedger schema fields (itemId, eventType, timestampUTC, qtyChangeBase, robAfterBase). Added formatEventType helper to convert ledger codes (CONSUME, RECEIVE, TRANSFER_IN) to user-friendly labels. Updated toast messages to show "Inventory Updated ±X from/to LocationName" instead of generic messages. Stores module workflow now matches Spares module behavior.
- **Stores ROB Location Transfer History** (Jan 12, 2026): Fixed missing history when transferring stock between Location A and Location B in the Stores module. New `transferStoresItemLocation()` method creates TRANSFER_OUT/TRANSFER_IN ledger entries for true transfers (where deltaA == -deltaB). Single-location adjustments and net ROB changes update without creating misleading transfer entries.
- **Components Pagination** (Jan 12, 2026): Added expand/collapse pagination to sections C (Jobs), D (Maintenance History), E (Spares), and F (Documents) in the Components submodule. Default view shows 2 rows; clicking expand reveals all data with pagination (10 rows per page). Uses consistent Button sizing with size="icon" for pagination controls.
- **Component RH Update on WO Approval** (Jan 12, 2026): Fixed bug where component running hours were not updating when RH-based work orders were approved. The PATCH endpoint now updates component RH using centralized `setComponentRunningHours()` with case-insensitive counter type handling and proper INHERITED→MASTER cascade fallback.
- **Maintenance History Viewer** (Jan 12, 2026): Clicking a maintenance history record now displays the exact same work order form UI in a sliding panel with embedded read-only mode. All mutation handlers are guarded to prevent modifications.

## Checkpoints
- **Eta** (Jan 9, 2026 - commit 15666f3): Parent-child RH consistency remediation. Fixed 102 inherited components on Vessel 2 where child RH exceeded same-vessel parent RH (historical cross-vessel corruption). All inherited components now correctly match their same-vessel parent's running hours.
- **Zeta** (Jan 9, 2026 - commit 84be7ad): RH display fix for inherited components. Backend `/running-hours/children` endpoint and frontend Components page now display `rhCurrentInheritedCached` (vessel-isolated value) for INHERITED components instead of `currentCumulativeRH`. One-time data remediation synced 49 corrupted inherited component records.
- **Epsilon** (Jan 9, 2026 - commit 9b32d00): RH vessel isolation fix. Running hours inheritance now enforced per-vessel. All 4 RH cascade paths (getInheritedComponents, updateMasterRunningHours, setComponentRunningHours, updateRunningHoursBulk) filter inherited components by master's vesselId. Safeguards skip cascade with warnings if vesselId cannot be determined, preventing cross-vessel data leaks when same component codes exist across fleet.
- **Delta** (Jan 9, 2026 - commit f1fc6f9): Work Order Form component display fix. API endpoint /work-orders/:id/context now uses workOrder.componentCode instead of job.componentCode, ensuring multi-component work orders display the correct component (e.g., FO separators No.02 shows 702.005.02 instead of No.01).
- **Gamma** (Jan 9, 2026 - commit 10e2609): Legacy WO protection hardened. Legacy fallback now checks by both jobId AND vessel-scoped jobNo. Cycle maps index both component-aware keys and legacy keys (empty componentCode) to prevent same-cycle regeneration on historical data.
- **Beta** (Jan 9, 2026 - commit ab3be09): Multi-component job WO generation fix. Jobs linked to multiple components via job_component_links now generate separate work orders for each linked component. Duplicate prevention checks jobId + componentCode with null normalization for backwards compatibility. Vessel-scoped component lookup prevents cross-vessel misassociation.
- **Alpha** (Jan 9, 2026 - commit b6b32f5): RH cascade fix complete. All three RH update paths now consistently match inherited components by UUID, component code, and rhCounterSource field. Verified: 601.001 (1000h→98 components), 651.001 (500h→68 components), 652.001 (450h→68 components).

## External Dependencies
*   **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`
*   **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
*   **Development**: `vite`, `typescript`, `drizzle-kit`