# Seafarer Technical Management System

## Overview

This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). It aims to provide a comprehensive solution for managing technical equipment maintenance, scheduling, and performance tracking for maritime professionals. The system will feature a PMS Dashboard, equipment and task management, reporting, and an administration module.

## User Preferences

Preferred communication style: Simple, everyday language.

## Technical Module Context

The SAIL Technical Module manages three core aspects of cargo ship operations:

1. **Certificate & Surveys Management** - Ship's certification and survey tracking
2. **Defect Reporting** - Equipment, machinery and systems defect management  
3. **Planned Maintenance System (PMS)** - Compliance with classification society requirements (DNV, ABS)

### Module Hierarchy
- **Technical** (Module)
  - **PMS** (Submodule)
    - **Components** (Sub Submodule)
    - **Work Orders** (Sub Submodule) 
    - **Running Hrs** (Sub Submodule)
    - **Spares** (Sub Submodule)
    - **Reports** (Sub Submodule)
    - **Modify PMS** (Sub Submodule)
    - **Admin** (Sub Submodule)

## System Architecture

The application uses a modern full-stack architecture with a React frontend (TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) and an Express.js backend (TypeScript). It integrates with PostgreSQL via Drizzle ORM for database operations, with an in-memory storage fallback for development. The UI/UX prioritizes a consistent design system through shadcn/ui and Tailwind CSS, following a mobile-first responsive design approach. 

### Completed Modules:
- **Components Module**: Full CRUD operations with hierarchical component tree management
- **Running Hours Module**: Equipment tracking with utilization rate calculations and audit history
- **Spares Module**: Comprehensive inventory management with consumption/receive tracking, bulk updates, and complete transaction history
- **Stores Module**: Complete inventory management with transaction history and Excel export
- **Modify PMS - Change Requests Module (Phase 1.0)**: Complete request workflow (draft → submitted → approved/rejected/returned), filtering, CRUD operations
- **Modify PMS - Change Requests Module (Phase 1.1)**: Target Picker overlay functionality for selecting specific PMS items (Component/Work Order/Spare/Store) with snapshot capture
- **Modify PMS - Change Requests Module (Phase 1.2)**: Propose Changes functionality allowing field-specific modifications for selected targets, with review dialog, move preview for components, and impact previews (all read-only, no PMS data modifications)
- **Modify PMS - Change Requests Module (Phase 2.0)**: Cross-module change request system with unified modal workflow, field-level tracking, and modify mode components
- **Defects Module - Condition of Class (CoC) Feature**: Complete CoC tracking with checkbox in defect form (positioned below date fields for clean layout), blue CoC badges in lists, and dedicated CoC filtered view at /defects/coc with Active/Resolved tabs
- **Defects Module - Recurring Defects Feature**: Complete pattern detection for equipment failures (2+ occurrences across vessels), with time window filtering (6 months to 5 years), minimum occurrence filtering, CoC filtering, and comprehensive test data demonstrating KSB pump patterns across multiple vessels (Fixed deduplication for same-day/same-vessel defects)
- **Admin Module - 4-Tab Interface** (Oct 2024): Complete admin workspace with tabbed navigation:
  - **Bulk Data Imp Tab**: Left sidebar with template selection (Machinery Components, Stores, Spares, Work Orders), right panel for bulk upload operations
    - **Machinery Component Upload (SFI Standard)**: Complete bulk import system for CSV/Excel files with:
      - **SFI Code Support**: International maritime classification standard (SFI) with hierarchical component codes (e.g., 6, 61, 612, 612.005, 612.005.001)
      - **Auto-Hierarchy Building**: Component tree automatically constructed from SFI codes - parent-child relationships derived from code structure (612.005 → parent: 612)
      - **Automatic Intermediate Node Creation** (Oct 28, 2024): System automatically creates ALL missing parent nodes in hierarchy by iteratively trimming SFI codes (e.g., importing 612.005.001 auto-creates 612.005 → 612 → 61 → 6), ensuring complete tree structure with proper SFI standard names via official component tree CSV lookup (e.g., "71" → "LUBE OIL SYSTEMS", not generic "SFI 71")
      - **Complete Field Import** (Oct 28, 2024): Enhanced bulk import now reads and persists ALL 24 Excel columns:
        - **8 SFI Metadata Columns**: Main Group Code, Sub Group Code, Original SFI Code, Generated Code, Component Name, Parent Code, Main Group Name, Sub Group Name
        - **16 Component Form Fields**: Maker, Model, Serial No, Department, Location, Critical, Condition Based, Installation Date, Commissioned Date, Rating, No of Units, Eqpt/System Dept, Dimensions/Size, Notes, Running Hours, Date Updated
        - **SFI Name Lookup Utility** (server/utils/sfiLookup.ts): Loads official SFI component tree CSV with 3685 codes, provides O(1) lookups for proper SFI standard names during intermediate node creation
        - **Extended Component Schema**: Added 9 new fields to components table (department, installationDate, rating, conditionBased, noOfUnits, eqptSystemDept, parentComponent, dimensionsSize, notes) to store all imported data
      - **Generated Code Suffix Support** (Oct 28, 2024): Fixed validation logic to preserve Generated Code suffixes (e.g., 230(1), 230(2), 226.065(1)) for multiple equipment with same base SFI code. System now correctly treats each suffixed code as a separate component while using Original SFI Code for hierarchy building
      - **Duplicate Detection** (Oct 28, 2024): Dry-run validation detects duplicate SFI codes and warns users that only the last occurrence will be kept, preventing silent data overwrites
      - **Main Group Codes (1-8)**: User selects number 1-8, auto-maps to full category name (6 → "6 Machinery Main Components")
      - **8 SFI Categories**: 1 Ship General, 2 Hull, 3 Equipment for Cargo, 4 Ship Equipment, 5 Equipment for Crew and Passengers, 6 Machinery Main Components, 7 Systems for Machinery Main Components, 8 Ship Common Systems
      - **Smart Validation**: SFI code format validation, Main Group Code must match first digit of SFI code, hierarchy depth sorting ensures parents created before children
      - **Import Modes**: Create Only/Update Only/Create & Update with dry-run validation
      - **Template Structure**: Row 1 headers, Row 2 example data, Row 3+ user data with Excel dropdowns for Main Group Code (1-8)
    - **Work Order Upload (Template 4)**: Bulk import system for work orders with auto-generated WO codes (WO-{ComponentCode}-{Sequence}), component code validation, Excel dropdowns for Maintenance Basis (Calendar/Running Hours/Condition Based), Frequency Value/Unit, Task Type, Class Related, and Job Priority
  - **Alerts Tab**: Alert policy management and configuration system
  - **Forms Tab**: Form configuration and template management with FormConfigurationModal integration
  - **Admin 4 Tab**: Reserved for future administrative functionality

### Architecture Features:
- Shared component tree structure used across PMS modules for consistency
- RESTful API design with proper error handling and validation
- Real-time stock status calculations (OK/Low/Minimum)
- Audit trail for all inventory transactions with user tracking
- Optimistic UI updates with TanStack Query for smooth user experience

## External Dependencies

- **Frontend**:
    - `@radix-ui/*`
    - `@tanstack/react-query`
    - `wouter`
    - `tailwindcss`
    - `lucide-react`
- **Backend**:
    - `express`
    - `drizzle-orm`
    - `@neondatabase/serverless`
    - `connect-pg-simple`
- **Development**:
    - `vite`
    - `typescript`
    - `drizzle-kit`