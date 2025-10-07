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