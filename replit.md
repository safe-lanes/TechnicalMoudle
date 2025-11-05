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
- **Defects Module - VIQ Integration (Nov 5, 2024)**: Complete SIRE VIQ 7 reference tracking with B4. VIQ section in defect form
  - **Four VIQ Dropdowns**: VIQ Version (VIQ 7/SIRE 2.0), VIQ Reference (1.1-12.2), VIQ Chapter (12 chapters), VIQ Section (subsections)
  - **VIQ Reference Codes**: Comprehensive list from SIRE VIQ 7 PDF including all chapters (General Information, Certification and Documentation, Crew Management, Navigation and Communications, Safety Management, Pollution Prevention, Maritime Security, Cargo and Ballast Systems, Mooring and Anchoring, Machinery Spaces, General Appearance and Condition, Ice Operations)
  - **VIQ Sections**: Detailed subsections including Certification, Safety management procedures, Survey and repair history, Bridge Navigation Systems, Fire Fighting and Life Saving, Environmental Protection, Cargo Handling Equipment, Engine Room Systems, and more
  - **Schema Fields**: Added viqChapter and viqSection to defects table (alongside existing viqVersion and viqRef)
  - **Positioning**: VIQ section positioned after Root Cause boxes, before Actions section
  - **Styling**: Blue header "B4. VIQ", 4-column grid layout, consistent with SAIL design pattern
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
      - **Suffix Handling Fix** (Oct 28, 2024): Added stripSFISuffix() helper to properly handle codes with parentheses across all functions (validateSFICode, getParentSFICode, getSubGroupCode). System now correctly strips suffixes before validation and parent calculation while preserving them in Generated Code for unique component IDs. Parent Code always recalculated from clean Original SFI Code, ignoring Excel values. SFI naming now uses specific names from official CSV lookup (e.g., "711" → "LUBE OIL TRANSFER & DRAIN SYSTEMS") instead of generic subgroup names
      - **Multi-Sheet Excel Support** (Oct 29, 2024): Added sheet selection functionality for Excel files with multiple sheets. New `/api/bulk/sheets` endpoint detects all available sheets, UI shows dropdown selector for sheet selection, and users can choose which sheet to import from before running dry-run validation. CSV files continue to auto-validate without sheet selection.
      - **Main Group Codes (1-8)**: User selects number 1-8, auto-maps to full category name (6 → "6 Machinery Main Components")
      - **8 SFI Categories**: 1 Ship General, 2 Hull, 3 Equipment for Cargo, 4 Ship Equipment, 5 Equipment for Crew and Passengers, 6 Machinery Main Components, 7 Systems for Machinery Main Components, 8 Ship Common Systems
      - **Smart Validation**: SFI code format validation, Main Group Code must match first digit of SFI code, hierarchy depth sorting ensures parents created before children
      - **Import Modes**: Create Only/Update Only/Create & Update with dry-run validation
      - **Template Structure**: Row 1 headers, Row 2 example data, Row 3+ user data with Excel dropdowns for Main Group Code (1-8)
    - **Work Order Upload (Template 4)**: Bulk import system for work orders with auto-generated WO codes following format **WO-{ComponentCode}-{Year}-{Sequence}** (Oct 30, 2024), component code validation, Excel dropdowns for multiple fields
      - **Template Structure (Oct 30, 2024)**: Restructured to match user's preferred format with 14 columns using ExcelJS library for proper dropdown validations:
        - **Main Sheet (wo)**: Generated_Component_Code, Component_Name, Job_Code, Job_Title, Job_Description, Department, Responsible_Rank, Schedule_Type, Interval, Interval_Unit, Criticality, Estimated_Hours, Spares_Required, Safety_Permit_Required
        - **Reference Sheet (Lists)**: Contains dropdown values for Department, Responsible_Rank, Schedule_Type, Interval_Unit, Criticality, and Safety_Permit_Required
        - **Excel Data Validations**: 6 columns with dropdown validations referencing Lists sheet values for consistent data entry
        - **Field Mappings**: New columns map to existing schema (Schedule_Type → maintenanceBasis, Interval → frequencyValue, Interval_Unit → frequencyUnit, Responsible_Rank → assignedTo)
      - **Auto-Generated Template Codes** (Oct 30, 2024): Backend auto-generates template codes in format WO-{ComponentCode}-{Year}-{Sequence} when not provided. Sequences are per-component per-year with 2-digit padding (e.g., WO-711.003-2025-01, WO-711.003-2025-02). Frontend shows placeholder WO-{ComponentCode}-{Year}-XX for UX preview, backend assigns actual sequence on creation. Sequences reset annually for historical tracking.
      - **Pre-Populated Component Template (Nov 3, 2024)**: Work Order templates now pre-populate ONLY leaf node components (actual equipment), eliminating dropdown selection. Template generation is vessel-specific (defaults to V001), fetches all components via `/api/bulk/template?vesselId=V001`. Users systematically add work orders by filling in only the work order details (columns C-N) for components they want, leaving other rows empty. Validation logic skips rows without Job_Title, preventing null entries.
      - **Leaf Node Filtering (Nov 3, 2024)**: Template now includes ONLY 31 leaf node components (actual equipment like pumps, tanks, turbines) and excludes 13 parent category components. Filtering algorithm detects parent components using prefix matching: a component is a parent if its code (without suffix) is a prefix of another component's code (e.g., "220" is parent of "220.001", "71" is parent of "711"). This prevents users from creating work orders for organizational categories (2, 6, 7, 22, 60, 61, 71, 220, 601, 611, 711, 712, 713) and ensures work orders are only created for actual equipment. Template reduced from 44 to 31 components, improving usability and preventing confusion.
      - **Validation Logic**: Schedule_Type (Calendar/Running Hours) with Interval_Unit validation - Calendar requires user-provided units (Hours/Days/Weeks/Months/Years), Running Hours auto-defaults to Hours. All frequency units correctly persist to database.
      - **Component-Work Order Integration (Nov 3, 2024)**: Fixed WorkOrdersSection in Components.tsx to fetch and display linked work orders using useQuery hook. Component detail pages now show all work orders linked by componentCode in Section C (Work Orders), with loading states, empty states, and proper filtering. Successfully tested with WO-71-2025-01 displaying under component 71 (LUBE OIL SYSTEMS).
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