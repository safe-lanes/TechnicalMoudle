# Seafarer Technical Management System - Local Development Setup Guide

> Complete Local Development Setup Guide for setting up the entire codebase in VS Code

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Project Structure Overview](#2-project-structure-overview)
3. [Full Architectural Flow](#3-full-architectural-flow)
4. [Developer Productivity Guide](#4-developer-productivity-guide)
5. [Common Commands Reference](#5-common-commands-reference)

---

## 1. Environment Setup

### 1.1 Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v20.x or higher | JavaScript runtime |
| npm | v10.x or higher | Package manager (comes with Node.js) |
| PostgreSQL | v15.x or higher | Database (optional - system uses file storage by default) |
| Git | Latest | Version control |

### 1.2 Global Packages Required

```bash
# Required global packages
npm install -g tsx                  # TypeScript execution
npm install -g drizzle-kit          # Database migrations (if using PostgreSQL)
npm install -g typescript           # TypeScript compiler (optional, project has local)
```

### 1.3 VS Code Extensions Required

Install the following extensions for optimal development experience:

| Extension | Extension ID | Purpose |
|-----------|--------------|---------|
| ESLint | `dbaeumer.vscode-eslint` | JavaScript/TypeScript linting |
| Prettier | `esbenp.prettier-vscode` | Code formatting |
| ES7+ React/Redux Snippets | `dsznajder.es7-react-js-snippets` | React code snippets |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind CSS autocomplete |
| PostCSS Language Support | `csstools.postcss` | PostCSS syntax highlighting |
| Path Intellisense | `christian-kohler.path-intellisense` | File path autocomplete |
| Auto Rename Tag | `formulahendry.auto-rename-tag` | HTML/JSX tag renaming |
| Thunder Client | `rangav.vscode-thunder-client` | API testing (alternative to Postman) |
| GitLens | `eamodio.gitlens` | Git integration |
| Error Lens | `usernamehw.errorlens` | Inline error display |
| JavaScript and TypeScript Nightly | `ms-vscode.vscode-typescript-next` | Latest TypeScript features |

### 1.4 Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/your-org/seafarer-pms.git

# Or clone via SSH
git clone git@github.com:your-org/seafarer-pms.git

# Navigate to project directory
cd seafarer-pms
```

### 1.5 Install Dependencies

```bash
# Install all dependencies (frontend + backend)
npm install
```

This single command installs all dependencies for both the frontend (client) and backend (server) as they share a unified `package.json`.

### 1.6 Environment Configuration

Create a `.env` file in the project root:

```bash
# Copy the sample environment file
cp .env.example .env
```

#### Sample `.env` Configuration

```env
# ==============================================
# Server Configuration
# ==============================================
NODE_ENV=development
PORT=5000

# ==============================================
# Database Configuration (Optional)
# System uses file-based storage (test-data.json) by default
# Uncomment and configure to use PostgreSQL
# ==============================================
# DATABASE_URL=postgresql://username:password@localhost:5432/seafarer_pms
# PGHOST=localhost
# PGPORT=5432
# PGUSER=your_username
# PGPASSWORD=your_password
# PGDATABASE=seafarer_pms

# ==============================================
# Session Configuration
# ==============================================
SESSION_SECRET=your-super-secret-session-key-change-in-production

# ==============================================
# Object Storage (Optional)
# For file uploads - falls back to local filesystem
# ==============================================
# OBJECT_STORAGE_BUCKET=your-bucket-name
# PUBLIC_OBJECT_SEARCH_PATHS=public
# PRIVATE_OBJECT_DIR=.private

# ==============================================
# Frontend Environment Variables
# Must be prefixed with VITE_ to be accessible
# ==============================================
VITE_API_BASE_URL=http://localhost:5000
```

### 1.7 Run the Development Server

```bash
# Start both frontend and backend development servers
npm run dev
```

This command starts:
- **Backend**: Express.js server with hot-reload via `tsx watch`
- **Frontend**: Vite development server with HMR

The application will be available at: `http://localhost:5000`

### 1.8 Database Setup (Optional - PostgreSQL Mode)

If using PostgreSQL instead of file storage:

```bash
# Generate database migrations
npm run db:generate

# Push schema to database
npm run db:push
```

### 1.9 Seed Data / Utility Scripts

The application uses file-based storage (`test-data.json`) by default. Sample data is automatically loaded on first run.

```bash
# Recalculate next due dates for all jobs
npx tsx server/recalculate-next-due-dates.ts

# Fix corrupted date formats in data
npx tsx server/fix-corrupted-dates.ts

# Test date utilities
npx tsx server/test-date-utils.ts
```

### 1.10 Linting, Formatting, and Build

```bash
# Type checking
npm run check

# Build for production
npm run build

# Start production server
npm run start
```

---

## 2. Project Structure Overview

```
seafarer-pms/
├── client/                          # Frontend (React + Vite)
│   ├── public/                      # Static assets
│   │   └── figmaAssets/            # Design assets from Figma
│   └── src/
│       ├── components/             # React components
│       │   ├── admin/              # Admin module components
│       │   ├── AgGrid/             # AG Grid configurations
│       │   ├── alerts/             # Alert system components
│       │   ├── change-request-forms/ # Change request form components
│       │   ├── filters/            # Filter components
│       │   ├── modals/             # Modal dialog components
│       │   ├── modify/             # Modify PMS components
│       │   ├── modifyPms/          # PMS modification components
│       │   ├── reports/            # Report generation components
│       │   └── ui/                 # shadcn/ui components
│       ├── config/                 # Frontend configuration
│       ├── contexts/               # React Context providers
│       │   ├── AuthContext.tsx     # Authentication state
│       │   ├── VesselContext.tsx   # Vessel selection state
│       │   ├── OfflineContext.tsx  # Offline mode state
│       │   ├── ChangeRequestContext.tsx # Change request state
│       │   └── ChangeModeContext.tsx    # Change mode state
│       ├── data/                   # Static data files
│       ├── hooks/                  # Custom React hooks
│       ├── lib/                    # Utility libraries
│       │   └── queryClient.ts      # TanStack Query configuration
│       ├── micro-frontend/         # Micro-frontend configuration
│       ├── pages/                  # Page components (routes)
│       │   ├── admin/              # Admin pages
│       │   ├── cert-surveys/       # Certificates & Surveys pages
│       │   ├── change-requests/    # Change request pages
│       │   ├── defects/            # Defects module pages
│       │   ├── modify-pms/         # Modify PMS pages
│       │   ├── pms/                # Core PMS pages
│       │   ├── reports/            # Reports pages
│       │   ├── spares/             # Spares module pages
│       │   └── stores/             # Stores module pages
│       ├── services/               # Frontend API services
│       ├── styles/                 # Global styles
│       ├── utils/                  # Utility functions
│       ├── App.tsx                 # Main application component
│       ├── index.css               # Global CSS (Tailwind)
│       └── main.tsx                # Application entry point
│
├── server/                          # Backend (Express.js + TypeScript)
│   ├── middleware/                 # Express middleware
│   │   ├── auth.ts                 # Authentication/authorization
│   │   └── validation.ts           # Request validation
│   ├── routes/                     # API route handlers
│   │   ├── alerts.ts               # Alert system routes
│   │   ├── bulk.ts                 # Bulk operations routes
│   │   ├── changeRequests.ts       # Change request routes
│   │   ├── fleetAdmin.ts           # Fleet admin routes
│   │   └── forms.ts                # Dynamic forms routes
│   ├── scripts/                    # Server-side scripts
│   ├── services/                   # Business logic services
│   │   ├── componentService.ts     # Component operations
│   │   ├── jobDueScanner.ts        # Auto WO generation scheduler
│   │   ├── jobService.ts           # Job operations
│   │   ├── localFileStorage.ts     # Local file storage service
│   │   ├── runningHoursService.ts  # Running hours operations
│   │   └── workOrderService.ts     # Work order operations
│   ├── utils/                      # Server utilities
│   ├── businessRules.ts            # Global business rules
│   ├── database.ts                 # Database connection (PostgreSQL)
│   ├── db.ts                       # Database instance
│   ├── index.ts                    # Server entry point
│   ├── initDb.ts                   # Database initialization
│   ├── objectStorage.ts            # Object storage service
│   ├── persistentStorage.ts        # File-based persistent storage
│   ├── routes.ts                   # Main API routes registration
│   ├── runningHoursRoutes.ts       # Running hours API routes
│   ├── storage.ts                  # Storage interface (IStorage)
│   └── vite.ts                     # Vite integration for SSR
│
├── shared/                          # Shared code (Frontend + Backend)
│   ├── utils/                      # Shared utilities
│   ├── workOrders/                 # Work order shared logic
│   │   └── status.ts               # Status computation
│   ├── changeRequestSchema.ts      # Change request Zod schemas
│   ├── dateUtils.ts                # Date utility functions
│   ├── defectStatus.ts             # Defect status logic
│   └── schema.ts                   # Database schema (Drizzle ORM)
│
├── attached_assets/                 # Uploaded/attached files
│
├── scripts/                         # Build/setup scripts
│
├── test-data.json                   # File-based data storage
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── drizzle.config.ts                # Drizzle ORM configuration
└── replit.md                        # Project documentation
```

### 2.1 Directory Purpose Details

#### `/client` - Frontend Application

| Directory | Purpose |
|-----------|---------|
| `components/ui/` | shadcn/ui components (Button, Dialog, Form, etc.) |
| `components/` | Business-specific components (forms, tables, modals) |
| `contexts/` | React Context providers for global state management |
| `hooks/` | Custom React hooks (useToast, useVessel, etc.) |
| `lib/` | Utility libraries and configurations |
| `pages/` | Route-based page components |
| `services/` | API service functions |
| `utils/` | Helper utility functions |

#### `/server` - Backend Application

| Directory | Purpose |
|-----------|---------|
| `middleware/` | Express middleware (auth, validation, error handling) |
| `routes/` | Modular API route handlers |
| `services/` | Business logic layer (domain-specific operations) |
| `utils/` | Server-side utility functions |

#### `/shared` - Shared Code

| File/Directory | Purpose |
|----------------|---------|
| `schema.ts` | Drizzle ORM database schema + Zod validation schemas |
| `dateUtils.ts` | Date parsing and formatting utilities |
| `workOrders/` | Work order status computation logic |

---

## 3. Full Architectural Flow

### 3.1 Application Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  React 18 + TypeScript + Vite                                │   │
│  │  ├── Tailwind CSS + shadcn/ui (Styling)                     │   │
│  │  ├── TanStack Query (Data Fetching & Caching)               │   │
│  │  ├── Wouter (Client-side Routing)                           │   │
│  │  ├── React Hook Form + Zod (Form Handling & Validation)     │   │
│  │  ├── AG Grid Enterprise (Data Tables)                       │   │
│  │  └── AG Charts (Data Visualization)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│                    HTTP/REST API (fetch)                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Express.js + TypeScript                                     │   │
│  │  ├── Middleware Layer (Auth, Validation, Error Handling)    │   │
│  │  ├── Routes Layer (API Endpoints)                           │   │
│  │  ├── Service Layer (Business Logic)                         │   │
│  │  └── Storage Layer (Data Access)                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Storage (Configurable)                                      │   │
│  │  ├── PersistentFileStorage (test-data.json) - DEFAULT       │   │
│  │  └── PostgreSQL (Drizzle ORM) - OPTIONAL                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend Framework** | React 18, TypeScript, Vite |
| **UI Components** | shadcn/ui, Radix UI Primitives |
| **Styling** | Tailwind CSS v3 |
| **State Management** | TanStack Query, React Context |
| **Routing** | Wouter |
| **Forms** | React Hook Form, Zod |
| **Data Tables** | AG Grid Enterprise |
| **Charts** | AG Charts, Recharts |
| **Backend Framework** | Express.js, TypeScript |
| **ORM** | Drizzle ORM |
| **Database** | PostgreSQL (optional), File Storage (default) |
| **Authentication** | Session-based (express-session) |
| **File Upload** | Multer |
| **Build Tool** | Vite, esbuild |

### 3.3 API Communication Flow

```
┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   React Query    │───▶│  fetch() API    │───▶│  Express Routes  │
│   useQuery()     │    │  /api/*         │    │  req → res       │
│   useMutation()  │◀───│  JSON Response  │◀───│                  │
└──────────────────┘    └─────────────────┘    └──────────────────┘
```

#### Request Flow Example

```typescript
// Frontend: client/src/pages/pms/ComponentsPage.tsx
const { data: components, isLoading } = useQuery({
  queryKey: ['/api/components', vesselId],
});

// Backend: server/routes.ts
app.get("/api/components/:vesselId", async (req, res) => {
  const components = await storage.getComponents(req.params.vesselId);
  res.json(components);
});
```

### 3.4 Authentication/Authorization Flow

The system implements Role-Based Access Control (RBAC) with three user roles:

| Role | Access Level | Description |
|------|--------------|-------------|
| **Ship** | Limited | Vessel-based user, limited to assigned vessel |
| **Office** | Moderate | Shore-based user, cross-vessel access |
| **PMS Admin** | Full | System administrator, full access |

#### Authentication Flow

```
┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   AuthContext  │    │  localStorage   │    │  Backend Mock    │
│   (Frontend)   │───▶│  currentUser    │    │  Auth Middleware │
└────────────────┘    └─────────────────┘    └──────────────────┘
        │                                             │
        ▼                                             ▼
┌────────────────────────────────────────────────────────────────┐
│  RoleGuard Component                                            │
│  - Wraps protected routes                                       │
│  - Checks user role against required roles                      │
│  - Renders children or redirect/403                             │
└────────────────────────────────────────────────────────────────┘
```

#### Backend Authorization Middleware

```typescript
// server/middleware/auth.ts
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
```

### 3.5 Module-Level Flow Details

#### 3.5.1 Components Module

**Purpose**: Manage vessel equipment hierarchy and component registry.

```
Frontend Flow:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ ComponentsPage  │───▶│ ComponentTable   │───▶│ useQuery        │
│ (Page)          │    │ (AG Grid)        │    │ /api/components │
└─────────────────┘    └──────────────────┘    └─────────────────┘

Backend Flow:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ GET /api/       │───▶│ storage.         │───▶│ PersistentFile  │
│ components/:id  │    │ getComponents()  │    │ Storage.read()  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

#### 3.5.2 Work Orders Module

**Purpose**: Execute maintenance tasks based on job templates.

**Data Flow Lifecycle**:

```
1. Request → User clicks "Create Work Order" button
   
2. Process → Frontend sends POST to /api/work-orders
   - Includes job template data, vessel, component, due date
   
3. Validate → Backend validates with Zod schema
   - insertWorkOrderSchema.parse(req.body)
   
4. Persist → Storage layer saves to test-data.json
   - storage.createWorkOrder(workOrder)
   
5. Respond → JSON response with created work order
   - res.status(201).json(createdWorkOrder)
```

**Status Computation** (Shared Logic):
```typescript
// shared/workOrders/status.ts
export function computeWorkOrderStatus(workOrder: WorkOrder): ComputedStatus {
  // Real-time status based on dates, completion, postponement
  // Returns: 'Due Now' | 'Overdue' | 'Completed' | 'Postponed' | etc.
}
```

#### 3.5.3 Jobs Module (Modify PMS)

**Purpose**: Manage job templates that generate work orders.

**Component → Service → API Flow**:

```typescript
// 1. Component: client/src/pages/pms/JobsFormPage.tsx
const { mutate: saveJob } = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/jobs', data),
  onSuccess: () => queryClient.invalidateQueries(['jobs'])
});

// 2. API Route: server/routes.ts
app.post("/api/jobs", async (req, res) => {
  const validatedData = insertJobSchema.parse(req.body);
  const job = await storage.createJob(validatedData);
  res.status(201).json(job);
});

// 3. Storage: server/storage.ts
async createJob(data: InsertJob): Promise<Job> {
  // Persist to test-data.json
}
```

#### 3.5.4 Defects Module

**Purpose**: Track and manage equipment defects and corrective actions.

**Form Wizard Flow**:

```
Step 1: Basic Info    → Step 2: Details    → Step 3: Actions → Step 4: Closure
   │                        │                    │                  │
   ▼                        ▼                    ▼                  ▼
DefectFormWizard.tsx handles multi-step state management
```

#### 3.5.5 Spares Module

**Purpose**: Inventory management for spare parts.

**Features**:
- Dual location tracking (ROB Location A, Location B)
- Minimum/Maximum stock levels
- Transaction history (consume, receive, adjust)
- Bulk upload via Excel

#### 3.5.6 Running Hours Module

**Purpose**: Track equipment running hours with delta propagation.

**Delta Propagation Flow**:

```
Parent Component RH Update
         │
         ▼
Calculate Delta (newRH - oldRH)
         │
         ▼
Cascade to Child Components
         │
         ▼
Re-evaluate Due Jobs (RH-based)
         │
         ▼
Trigger Work Order Generation if Due
```

### 3.6 State Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application State                            │
├──────────────────────┬──────────────────────────────────────────┤
│   Server State       │   Client State                           │
│   (TanStack Query)   │   (React Context)                        │
├──────────────────────┼──────────────────────────────────────────┤
│ • Components         │ • AuthContext (current user)             │
│ • Work Orders        │ • VesselContext (selected vessel)        │
│ • Jobs               │ • OfflineContext (offline mode)          │
│ • Defects            │ • ChangeRequestContext (CR state)        │
│ • Spares             │ • ChangeModeContext (edit mode)          │
│ • Alerts             │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

### 3.7 Error Handling Architecture

```
Frontend:
┌─────────────────────────────────────────────────────────────────┐
│ TanStack Query Error Handling                                    │
│ • onError callbacks in mutations                                 │
│ • Error boundaries for component crashes                         │
│ • Toast notifications (useToast hook)                            │
└─────────────────────────────────────────────────────────────────┘

Backend:
┌─────────────────────────────────────────────────────────────────┐
│ Express Error Handling                                           │
│ • try-catch in route handlers                                    │
│ • Zod validation errors → 400 Bad Request                        │
│ • Not found → 404                                                │
│ • Server errors → 500 with error message                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.8 Auto-Generation Scheduler

The Job Due Scanner runs hourly to auto-generate work orders:

```typescript
// server/services/jobDueScanner.ts
class JobDueScanner {
  start(intervalMs: number) {
    setInterval(() => this.scan(), intervalMs);
  }
  
  async scan() {
    // 1. Get all active jobs
    // 2. Check if due (calendar or running hours)
    // 3. Generate work orders for due jobs
    // 4. Log results
  }
}
```

---

## 4. Developer Productivity Guide

### 4.1 VS Code Settings

Create/update `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  }
}
```

### 4.2 Debugging Guide

#### Frontend Debugging (Chrome DevTools)

1. Open Chrome DevTools (F12)
2. Go to **Sources** tab
3. Navigate to `client/src/`
4. Set breakpoints in TypeScript files
5. Use React DevTools extension for component state

#### Backend Debugging (VS Code)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["tsx", "server/index.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

#### Console Logging Patterns

```typescript
// Frontend
console.log('📋 Components loaded:', components.length);
console.error('❌ Failed to save:', error);

// Backend
console.log('[ComponentService] Processing update');
console.log('[JobDueScanner] Found due jobs:', dueJobs.length);
```

### 4.3 Folder Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `WorkOrderForm.tsx` |
| Pages | PascalCase | `TechnicalModule.tsx` |
| Hooks | camelCase with `use` prefix | `useToast.ts` |
| Utilities | camelCase | `dateUtils.ts` |
| Services | camelCase with suffix | `workOrderService.ts` |
| Routes | camelCase | `changeRequests.ts` |
| Contexts | PascalCase with `Context` suffix | `AuthContext.tsx` |

### 4.4 Code Style Rules

#### TypeScript Conventions

```typescript
// Use type inference where possible
const items = getItems(); // Not: const items: Item[] = getItems();

// Prefer interfaces for object shapes
interface WorkOrder {
  id: string;
  status: string;
}

// Use type for unions/intersections
type Status = 'Pending' | 'Completed' | 'Overdue';

// Export types alongside implementations
export type { WorkOrder, Status };
```

#### React Component Conventions

```tsx
// Use function components with arrow syntax
export function ComponentName({ prop1, prop2 }: Props) {
  // Hooks at the top
  const [state, setState] = useState(initialValue);
  const { data } = useQuery({ queryKey: ['key'] });
  
  // Event handlers
  const handleClick = () => {};
  
  // Early returns for loading/error states
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage />;
  
  // Main render
  return <div>...</div>;
}
```

#### Import Order

```typescript
// 1. React/external libraries
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal components (@/ alias)
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// 3. Shared code (@shared/ alias)
import type { WorkOrder } from '@shared/schema';

// 4. Relative imports
import { localHelper } from './utils';
```

### 4.5 Common Development Commands

```bash
# Development
npm run dev              # Start dev server (frontend + backend)

# Type Checking
npm run check            # Run TypeScript type checker

# Database (PostgreSQL mode)
npm run db:generate      # Generate Drizzle migrations
npm run db:push          # Push schema to database

# Production
npm run build            # Build for production
npm run start            # Start production server

# Utility Scripts
npx tsx server/recalculate-next-due-dates.ts  # Recalculate job due dates
npx tsx server/fix-corrupted-dates.ts         # Fix date format issues
```

### 4.6 API Testing with Thunder Client

Example requests:

```
# Get all components for vessel
GET http://localhost:5000/api/components/V001

# Create work order
POST http://localhost:5000/api/work-orders
Content-Type: application/json

{
  "vesselId": "V001",
  "componentId": "comp-001",
  "jobNo": "JOB-001",
  "status": "Open"
}

# Update work order status
PATCH http://localhost:5000/api/work-orders/wo-001
Content-Type: application/json

{
  "status": "Completed",
  "completionDateTime": "2025-12-09T10:00:00Z"
}
```

---

## 5. Common Commands Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push DB schema changes |
| `npm run db:generate` | Generate DB migrations |

---

## Appendix

### A. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | Environment mode (development/production) |
| `PORT` | No | Server port (default: 5000) |
| `DATABASE_URL` | No | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption key |

### B. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port 5000 in use | Kill process: `lsof -ti:5000 | xargs kill` |
| Module not found | Run `npm install` |
| Type errors | Run `npm run check` to see details |
| Data not persisting | Check `test-data.json` write permissions |

### C. Useful Links

- [React Documentation](https://react.dev)
- [TanStack Query](https://tanstack.com/query)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Drizzle ORM](https://orm.drizzle.team)
- [AG Grid](https://ag-grid.com)

---

*Last Updated: December 2025*
