# PMS Backend Application Architecture & Production Readiness Analysis

**Document Type:** Technical Architecture Analysis  
**Application:** Planned Maintenance System (PMS) for Maritime Vessels  
**Analysis Date:** February 2026  
**Technology Stack:** Node.js, Express.js, TypeScript, PostgreSQL, Drizzle ORM

---

## Table of Contents

1. [Folder & Project Structure](#1-folder--project-structure)
2. [RESTful API Design](#2-restful-api-design)
3. [Controllers / Route Handlers](#3-controllers--route-handlers)
4. [Service Layer (Business Logic)](#4-service-layer-business-logic)
5. [Data Access & Persistence](#5-data-access--persistence)
6. [Configuration & Environment Management](#6-configuration--environment-management)
7. [Error Handling & Logging](#7-error-handling--logging)
8. [Security & Access Control](#8-security--access-control)
9. [Scalability & Maintainability](#9-scalability--maintainability)
10. [Production Readiness Summary](#10-production-readiness-summary)
11. [End-to-End Request Lifecycle](#11-end-to-end-request-lifecycle)

---

## 1. Folder & Project Structure

### 1.1 Top-Level Directory Layout

```
/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route-based page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions and query client
│   │   ├── services/          # Frontend API service abstractions
│   │   ├── config/            # Feature flags and configuration
│   │   └── data/              # Static reference data
│   └── public/                # Static assets
│
├── server/                    # Backend Express application
│   ├── middleware/            # Express middleware (auth, validation)
│   ├── routes/                # Modular route handlers
│   ├── services/              # Business logic services
│   ├── utils/                 # Utility functions
│   ├── index.ts               # Application entry point
│   ├── routes.ts              # Main route registration (monolithic)
│   ├── storage.ts             # Storage interface definition (IStorage)
│   ├── postgresStorage.ts     # PostgreSQL implementation
│   ├── memStorage.ts          # File-based storage implementation
│   ├── storageFactory.ts      # Storage abstraction factory
│   ├── businessRules.ts       # Business rule definitions
│   ├── database.ts            # Database configuration
│   ├── db.ts                  # Database connection management
│   ├── migrations.ts          # Schema migration logic
│   ├── initDb.ts              # Database initialization
│   └── objectStorage.ts       # Object/file storage service
│
├── shared/                    # Shared code between frontend and backend
│   ├── schema.ts              # Drizzle ORM schemas and Zod validators
│   ├── dateUtils.ts           # Date manipulation utilities
│   ├── defectStatus.ts        # Defect status definitions
│   ├── workOrders/            # Work order business logic
│   └── utils/                 # Shared utility functions
│
├── migrations/                # SQL migration files
│   ├── 0000_*.sql             # Initial schema
│   ├── 0001_*.sql             # Incremental migrations
│   └── meta/                  # Migration metadata
│
├── scripts/                   # Utility scripts
├── tests/                     # Test files
└── docs/                      # Documentation
```

### 1.2 Architectural Separation

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **API/Routing** | `server/routes.ts`, `server/routes/` | HTTP request handling, route definitions |
| **Controllers** | Embedded in `server/routes.ts` | Request parsing, response formatting |
| **Services** | `server/services/` | Business logic, domain operations |
| **Data Access** | `server/postgresStorage.ts`, `server/storage.ts` | Database operations, persistence |
| **Shared Types** | `shared/schema.ts` | Type definitions, validation schemas |

### 1.3 Production Suitability Assessment

**Strengths:**
- Clear separation between frontend (`client/`) and backend (`server/`)
- Shared types ensure type safety across the full stack
- Modular route files in `server/routes/` for specific domains
- Dedicated services directory for business logic

**Weaknesses:**
- Main `routes.ts` file is monolithic (11,420 lines) - violates single responsibility
- Controller logic is embedded within route handlers rather than separate files
- No clear `controllers/` directory for request/response handling

---

## 2. RESTful API Design

### 2.1 REST Principles Compliance

| Principle | Implementation | Status |
|-----------|---------------|--------|
| **Resource-based URLs** | `/technical/api/components/:vesselId` | Implemented |
| **HTTP Verbs** | GET, POST, PUT, PATCH, DELETE used appropriately | Implemented |
| **Status Codes** | 200, 201, 400, 401, 403, 404, 500 | Implemented |
| **Consistent Naming** | `/technical/api/{resource}/{id}` pattern | Implemented |
| **API Versioning** | Not implemented | Missing |

### 2.2 Endpoint Naming Convention

The API follows a consistent pattern under the `/technical/api` prefix:

```
GET    /technical/api/components/:vesselId          # List components for vessel
GET    /technical/api/components/details/:id        # Get single component
POST   /technical/api/components/upload             # Upload components (CSV/Excel)
GET    /technical/api/work-orders/:vesselId         # List work orders
POST   /technical/api/work-orders                   # Create work order
PATCH  /technical/api/work-orders/:id               # Update work order
GET    /technical/api/defects/:vesselId             # List defects
POST   /technical/api/defects                       # Create defect
```

### 2.3 Modular Route Organization

Routes are organized by domain in `server/routes/`:

| File | Domain | Purpose |
|------|--------|---------|
| `alerts.ts` | Alerts | Alert policies and event management |
| `bulk.ts` | Bulk Operations | Mass import/export functionality |
| `changeRequests.ts` | Change Requests | MOC (Management of Change) workflow |
| `fleetAdmin.ts` | Fleet Admin | Fleet-level configuration |
| `forms.ts` | Forms | Dynamic form definitions |

### 2.4 Read/Write Separation

- **Read Operations:** Use GET with query parameters for filtering
- **Write Operations:** Use POST for creation, PATCH for updates, DELETE for removal
- **File Uploads:** Handled via POST with `multer` middleware

---

## 3. Controllers / Route Handlers

### 3.1 Location and Structure

Controllers are **embedded within route handlers** in:
- Primary: `server/routes.ts` (11,420 lines - monolithic)
- Modular: `server/routes/*.ts` (domain-specific routes)

### 3.2 Responsibilities

Route handlers in this codebase perform:
1. **Request Parsing:** Extract parameters, query strings, body data
2. **Validation:** Using Zod schemas from `@shared/schema`
3. **Delegation:** Call storage/service methods
4. **Response Formatting:** Return JSON responses with appropriate status codes
5. **Error Handling:** Try-catch blocks with error responses

### 3.3 Example Route Handler Pattern

```typescript
// From server/routes.ts
app.get("/technical/api/components/:vesselId", async (req, res) => {
  try {
    // 1. Parameter extraction
    const components = await storage.getComponents(req.params.vesselId);
    
    // 2. Logging
    console.log(`GET /technical/api/components/${req.params.vesselId} returning ${components.length} components`);
    
    // 3. Response
    res.json(components);
  } catch (error) {
    // 4. Error handling
    console.error("Error fetching components:", error);
    res.status(500).json({ error: "Failed to fetch components" });
  }
});
```

### 3.4 Request Validation Approach

Validation is handled via:
1. **Zod Schemas:** Defined in `shared/schema.ts` using `createInsertSchema` from `drizzle-zod`
2. **Validation Middleware:** `server/middleware/validation.ts` provides `validateBody`, `validateParams`, `validateQuery`
3. **Inline Validation:** Some routes use `safeParse()` directly

```typescript
// From shared/schema.ts
export const insertDefectSchema = createInsertSchema(defects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
```

### 3.5 Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Thin Controllers** | Partial | Some routes have embedded business logic |
| **Request Validation** | Good | Zod schemas with middleware support |
| **Response Formatting** | Good | Consistent JSON responses |
| **Separation of Concerns** | Needs Improvement | No dedicated controller layer |

---

## 4. Service Layer (Business Logic)

### 4.1 Service Layer Structure

Located in `server/services/`:

| Service | Lines | Purpose |
|---------|-------|---------|
| `jobDueScanner.ts` | 731 | Automated work order generation scheduler |
| `workOrderService.ts` | 498 | Work order CRUD and business logic |
| `workOrderStatusRecalculator.ts` | 235 | Status recalculation scheduler |
| `jobService.ts` | 281 | Job management operations |
| `componentService.ts` | 172 | Component-related operations |
| `runningHoursService.ts` | 93 | Running hours tracking |
| `fileBasedImportHistory.ts` | 108 | Import history for file storage mode |

### 4.2 Service Implementation Pattern

Services follow a class-based singleton pattern:

```typescript
// From server/services/jobDueScanner.ts
export class JobDueScannerService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanIntervalMs = 1 * 60 * 1000;

  start(intervalMs?: number): void { /* ... */ }
  stop(): void { /* ... */ }
  async runScan(): Promise<ScanResult> { /* ... */ }
}

export const jobDueScanner = new JobDueScannerService();
```

### 4.3 Business Rules Documentation

Comprehensive business rules are documented in `server/businessRules.ts` (1,018 lines):

```typescript
export const SYSTEM_ARCHITECTURE = {
  hierarchies: {
    components: { /* SFI-based equipment structure */ },
    runningHours: { /* RH tracking rules */ },
    jobs: { /* Maintenance task definitions */ }
  },
  inventoryTypes: {
    spares: { linkedTo: ["Components", "Work Orders", "Jobs"] },
    stores: { linkedTo: [] } // Completely isolated
  }
};
```

### 4.4 Service-to-Storage Interaction

Services interact with the storage layer via the `storage` singleton:

```typescript
import { storage } from "../storage";

// In workOrderService.ts
async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
  return await storage.createWorkOrder(data);
}
```

### 4.5 Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Dedicated Service Layer** | Exists | Located in `server/services/` |
| **Stateless Services** | Yes | Services don't maintain request state |
| **Business Rule Centralization** | Good | `businessRules.ts` documents all rules |
| **Reusability** | Good | Services are imported and reused across routes |
| **Background Processing** | Good | Scheduler services for async tasks |

---

## 5. Data Access & Persistence

### 5.1 Database Technology

- **Primary Database:** PostgreSQL (Neon-backed on Replit)
- **ORM:** Drizzle ORM with TypeScript
- **Schema Definition:** `shared/schema.ts` (2,596 lines)

### 5.2 Storage Architecture

The application uses a **Repository Pattern** via storage abstraction:

```
IStorage (Interface)
    ├── PostgresStorage (Production)
    └── MemStorage (Development/Preview)
```

**Storage Factory Pattern:**

```typescript
// server/storageFactory.ts
export async function initializeStorage(): Promise<IStorage> {
  if (isPostgresAvailable()) {
    return postgresStorage as IStorage;
  }
  return memStorage as IStorage; // Fallback for preview
}
```

### 5.3 Storage Interface (IStorage)

Defined in `server/storage.ts` (934 lines):

```typescript
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Components
  getComponents(vesselId: string): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, updates: Partial<Component>): Promise<Component>;
  
  // Work Orders, Jobs, Defects, Spares, etc.
  // ... 100+ methods
}
```

### 5.4 PostgreSQL Implementation

`server/postgresStorage.ts` (7,035 lines) implements all IStorage methods using Drizzle ORM:

```typescript
export class PostgresStorage {
  async getUser(id: number): Promise<User | undefined> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getComponents(vesselId: string): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(components)
      .where(eq(components.vesselId, vesselId))
      .orderBy(asc(components.componentCode));
  }
}
```

### 5.5 Schema Organization

Schemas in `shared/schema.ts` follow Drizzle patterns:

```typescript
// Table definition
export const components = pgTable("components", {
  id: text("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  name: text("name").notNull(),
  componentCode: text("component_code").notNull(),
  // ... more columns
}, (table) => ({
  vesselIdx: index("idx_components_vessel").on(table.vesselId),
}));

// Insert schema with Zod
export const insertComponentSchema = createInsertSchema(components).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type Component = typeof components.$inferSelect;
```

### 5.6 Transaction Handling

Transactions are managed within individual storage methods:

```typescript
// Example from postgresStorage.ts
async createWorkOrderWithExecution(woData, execData) {
  const db = await getDb();
  return await db.transaction(async (tx) => {
    const [workOrder] = await tx.insert(workOrders).values(woData).returning();
    const [execution] = await tx.insert(workOrderExecutions).values(execData).returning();
    return { workOrder, execution };
  });
}
```

### 5.7 Migration Management

Migrations are handled via:
- **SQL Files:** `migrations/*.sql`
- **Migration Runner:** `server/migrations.ts` (691 lines)
- **Drizzle Kit:** Configuration in `drizzle.config.ts`

### 5.8 Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Repository Pattern** | Implemented | IStorage interface with implementations |
| **ORM Usage** | Drizzle ORM | Type-safe queries |
| **SQL Isolation** | Good | Business logic separated from queries |
| **Transaction Support** | Implemented | Using Drizzle transactions |
| **Migration System** | Implemented | SQL-based migrations |

---

## 6. Configuration & Environment Management

### 6.1 Environment Variables

The application uses environment variables for configuration:

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (production) |
| `USE_FILE_STORAGE` | Force file-based storage | No (dev only) |
| `NODE_ENV` | Environment mode | No |

### 6.2 Storage Mode Selection

```typescript
// server/storageFactory.ts
export function isPostgresAvailable(): boolean {
  return !!process.env.DATABASE_URL && !isFileStorageForced();
}

export function isFileStorageForced(): boolean {
  return process.env.USE_FILE_STORAGE === 'true';
}
```

### 6.3 Configuration Files

| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Drizzle ORM configuration |
| `vite.config.ts` | Vite bundler configuration |
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `environment.example` | Environment variable template |

### 6.4 Hard-Coded Values Analysis

**Found hard-coded values:**

```typescript
// server/index.ts
const port = 5000; // Fixed port

// server/services/jobDueScanner.ts
private scanIntervalMs = 1 * 60 * 1000; // 1 minute interval

// shared/workOrders/constants.ts
export const WORK_ORDER_THRESHOLDS = {
  RH_LEAD_TIME_HOURS_CRITICAL: 100,
  RH_LEAD_TIME_HOURS_NON_CRITICAL: 50,
  // ...
};
```

### 6.5 Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Environment Variables** | Used | Database URL, storage mode |
| **Dev/Prod Separation** | Implemented | Storage factory pattern |
| **Hard-Coded Values** | Some Present | Port, intervals could be configurable |
| **Configuration Template** | Exists | `environment.example` provided |

---

## 7. Error Handling & Logging

### 7.1 Global Error Handler

Defined in `server/index.ts`:

```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err; // Re-throw for logging
});
```

### 7.2 Standardized API Response Format

Defined in `server/middleware/validation.ts`:

```typescript
export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}
```

### 7.3 Error Code Constants

```typescript
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATE: 'INVALID_STATE',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR'
} as const;
```

### 7.4 Async Error Handler

```typescript
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Route error:', error);
      
      if (error.message?.includes('not found')) {
        return res.status(404).json(createErrorResponse('NOT_FOUND', error.message));
      }
      // ... more error type handling
    });
  };
};
```

### 7.5 Logging Approach

**Current Implementation:**
- Console-based logging with emoji prefixes
- Request/response logging middleware in `server/index.ts`
- Service-level logging with prefixes (e.g., `[JobDueScanner]`)

```typescript
// server/index.ts - Request logging
res.on("finish", () => {
  const duration = Date.now() - start;
  if (path.startsWith("/api")) {
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    log(logLine);
  }
});

// Service logging
console.log('[JobDueScanner] Scheduler started');
console.error('[JobDueScanner] Error during scan:', err);
```

### 7.6 Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Global Error Handler** | Implemented | Catches unhandled errors |
| **Error Propagation** | Good | Consistent error response format |
| **Structured Logging** | Basic | Console-only, no log aggregation |
| **Production Debugging** | Limited | No structured log format (JSON) |
| **Error Codes** | Defined | Standardized error code constants |

---

## 8. Security & Access Control

### 8.1 Authentication Middleware

Located in `server/middleware/auth.ts`:

```typescript
export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized - Authentication required" });
  }
  next();
};
```

### 8.2 Role-Based Access Control (RBAC)

Three user roles defined:

| Role | Access Level | Vessel Scope |
|------|--------------|--------------|
| **Ship** | Vessel-specific operations | Assigned vessel only |
| **Office** | Cross-vessel read access | All vessels |
| **PMS Admin** | Full system access | All vessels + admin functions |

```typescript
export const userRoleEnum = pgEnum("user_role", ["Ship", "Office", "PMS Admin"]);

export const requireRole = (roles: UserRole | UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Forbidden - Insufficient permissions",
        required: allowedRoles,
        current: req.user.role
      });
    }
    next();
  };
};
```

### 8.3 Vessel Access Control

```typescript
export const requireVesselAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user.role === "PMS Admin" || req.user.role === "Office") {
    return next(); // Full access
  }

  const vesselId = req.params.vesselId || req.query.vesselId || req.body.vesselId;
  
  if (req.user.role === "Ship" && req.user.vesselId !== vesselId) {
    return res.status(403).json({ 
      error: "Forbidden - Can only access data for assigned vessel"
    });
  }
  next();
};
```

### 8.4 Convenience Middleware

```typescript
export const requirePMSAdmin = requireRole("PMS Admin");
export const requireOfficeOrAdmin = requireRole(["Office", "PMS Admin"]);
export const requireShipUser = requireRole("Ship");
```

### 8.5 Development Mode Authentication

**Security Concern:** Mock authentication is active in development:

```typescript
// Applied to all /technical/api routes
app.use('/technical/api', mockAuthMiddleware);

export const mockAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  req.user = {
    id: 1,
    username: "admin",
    fullName: "PMS Administrator",
    role: "PMS Admin", // Full admin access
    // ...
  };
  next();
};
```

### 8.6 Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Authentication** | Mock Only | No real auth in current codebase |
| **Authorization (RBAC)** | Implemented | Three-tier role system |
| **Vessel-Level Security** | Implemented | Ship users restricted to assigned vessel |
| **Middleware Pattern** | Good | Composable security middleware |
| **Production Security** | Not Ready | Mock auth must be replaced |

---

## 9. Scalability & Maintainability

### 9.1 Adding New Modules/APIs

**Positive Patterns:**
1. Modular route files in `server/routes/` - add new domain-specific routes
2. Service layer in `server/services/` - add new business logic services
3. Shared schemas in `shared/schema.ts` - add new entities with types

**Process to Add a New Module:**
1. Define schema in `shared/schema.ts`
2. Add storage methods to `IStorage` interface
3. Implement in `postgresStorage.ts` and `memStorage.ts`
4. Create service in `server/services/`
5. Add routes (modular file or in `routes.ts`)

### 9.2 Code Coupling Analysis

| Component | Coupling Level | Notes |
|-----------|---------------|-------|
| **Routes to Storage** | Low | Via storage interface |
| **Services to Storage** | Low | Via storage interface |
| **Schema to All** | High | Shared types everywhere (intentional) |
| **Routes to Services** | Medium | Direct imports |

### 9.3 Identified Anti-Patterns

1. **God File:** `routes.ts` at 11,420 lines violates single responsibility
2. **Mixed Concerns:** Some routes contain business logic instead of delegating to services
3. **Large Storage Files:** `postgresStorage.ts` at 7,035 lines
4. **No Controller Layer:** Request handling mixed with route definitions

### 9.4 Code Metrics

| File | Lines | Concern |
|------|-------|---------|
| `server/routes.ts` | 11,420 | Too large |
| `server/postgresStorage.ts` | 7,035 | Too large |
| `server/routes/bulk.ts` | 6,144 | Complex bulk operations |
| `shared/schema.ts` | 2,596 | Acceptable for schema definitions |
| `server/memStorage.ts` | 1,568 | Acceptable |
| `server/businessRules.ts` | 1,018 | Documentation file |

### 9.5 Maintainability Assessment

**Strengths:**
- TypeScript provides type safety
- Shared schema ensures consistency
- Service layer enables code reuse
- Storage abstraction allows swapping implementations

**Weaknesses:**
- Large monolithic files are hard to navigate
- No clear separation between controllers and routes
- Test coverage not evident in codebase structure

---

## 10. Production Readiness Summary

### 10.1 Key Strengths

| Area | Assessment |
|------|------------|
| **Type Safety** | Full TypeScript with shared schemas |
| **Data Layer** | Clean storage abstraction with PostgreSQL |
| **Validation** | Zod schemas with middleware support |
| **Business Rules** | Well-documented in dedicated file |
| **Background Jobs** | Scheduler services for async tasks |
| **RBAC** | Three-tier role system implemented |
| **Migration System** | SQL-based with Drizzle |

### 10.2 Critical Risks for Production

| Risk | Severity | Recommendation |
|------|----------|----------------|
| **Mock Authentication** | Critical | Implement real auth (OAuth, JWT) |
| **Monolithic Routes File** | Medium | Split into domain controllers |
| **Console-Only Logging** | Medium | Add structured logging (Winston/Pino) |
| **No API Versioning** | Medium | Add `/v1/` prefix to routes |
| **Large File Sizes** | Low-Medium | Refactor into smaller modules |

### 10.3 Well-Designed Areas

1. **Storage Abstraction:** Factory pattern with fallback for development
2. **Type System:** Shared schemas ensure frontend-backend consistency
3. **Validation Layer:** Comprehensive Zod schemas with insert/select types
4. **Background Processing:** Scheduler services with start/stop lifecycle
5. **Error Response Format:** Standardized API response structure

### 10.4 Fragile Areas

1. **Authentication:** Currently mock-only, no session management
2. **Routes.ts:** Single point of failure, hard to maintain
3. **Error Logging:** No log aggregation or monitoring integration
4. **Rate Limiting:** Not implemented
5. **API Documentation:** No OpenAPI/Swagger specs

### 10.5 Overall Readiness Assessment

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | 7/10 | Good patterns, needs refactoring for scale |
| **Security** | 4/10 | RBAC ready, but no real authentication |
| **Data Layer** | 9/10 | Excellent abstraction and type safety |
| **Error Handling** | 7/10 | Structured, but logging needs improvement |
| **Maintainability** | 6/10 | Type-safe, but large files hurt readability |
| **Scalability** | 7/10 | Good abstractions, but monolithic concerns |

**Overall Production Readiness: 65%**

The application has a solid foundation with good architectural patterns. Primary blockers for production are:
1. Replacing mock authentication with real auth
2. Splitting monolithic files for maintainability
3. Adding structured logging for production debugging

---

## 11. End-to-End Request Lifecycle

### 11.1 Complete Request Flow

```
+------------------------------------------------------------------------------+
|                         CLIENT REQUEST                                        |
|                    GET /technical/api/components/V001                         |
+------------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------------+
|  1. EXPRESS MIDDLEWARE CHAIN                                                  |
|  +-------------------------------------------------------------------------+ |
|  | express.json()          -> Parse JSON body                              | |
|  | express.urlencoded()    -> Parse URL-encoded data                       | |
|  | Request Logger          -> Log method, path, timing                     | |
|  | mockAuthMiddleware      -> Populate req.user (development)              | |
|  +-------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------------+
|  2. ROUTE HANDLER (server/routes.ts)                                          |
|  +-------------------------------------------------------------------------+ |
|  | app.get("/technical/api/components/:vesselId", async (req, res) => {    | |
|  |   try {                                                                 | |
|  |     // Extract parameters                                               | |
|  |     const vesselId = req.params.vesselId;                               | |
|  |                                                                         | |
|  |     // Call storage layer                                               | |
|  |     const components = await storage.getComponents(vesselId);           | |
|  |                                                                         | |
|  |     // Return response                                                  | |
|  |     res.json(components);                                               | |
|  |   } catch (error) {                                                     | |
|  |     res.status(500).json({ error: "Failed to fetch components" });      | |
|  |   }                                                                     | |
|  | });                                                                     | |
|  +-------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------------+
|  3. STORAGE INTERFACE (server/storage.ts)                                     |
|  +-------------------------------------------------------------------------+ |
|  | // Singleton storage instance                                           | |
|  | export let storage: IStorage;                                           | |
|  |                                                                         | |
|  | interface IStorage {                                                    | |
|  |   getComponents(vesselId: string): Promise<Component[]>;                | |
|  |   // ... 100+ methods                                                   | |
|  | }                                                                       | |
|  +-------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------------+
|  4. POSTGRES STORAGE (server/postgresStorage.ts)                              |
|  +-------------------------------------------------------------------------+ |
|  | async getComponents(vesselId: string): Promise<Component[]> {           | |
|  |   const db = await getDb();                                             | |
|  |   return await db.select()                                              | |
|  |     .from(components)                                                   | |
|  |     .where(eq(components.vesselId, vesselId))                           | |
|  |     .orderBy(asc(components.componentCode));                            | |
|  | }                                                                       | |
|  +-------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------------+
|  5. DATABASE (PostgreSQL via Drizzle ORM)                                     |
|  +-------------------------------------------------------------------------+ |
|  | SELECT * FROM components                                                | |
|  | WHERE vessel_id = 'V001'                                                | |
|  | ORDER BY component_code ASC;                                            | |
|  +-------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------------+
|  6. RESPONSE                                                                  |
|  +-------------------------------------------------------------------------+ |
|  | HTTP/1.1 200 OK                                                         | |
|  | Content-Type: application/json                                          | |
|  |                                                                         | |
|  | [                                                                       | |
|  |   {                                                                     | |
|  |     "id": "comp-001",                                                   | |
|  |     "vesselId": "V001",                                                 | |
|  |     "name": "Main Engine",                                              | |
|  |     "componentCode": "311.001"                                          | |
|  |   },                                                                    | |
|  |   ...                                                                   | |
|  | ]                                                                       | |
|  +-------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
```

### 11.2 Request Flow Summary

```
Request -> Express Middleware -> Auth Check -> Route Handler -> Storage Interface 
        -> PostgreSQL Storage -> Drizzle ORM -> PostgreSQL -> Response
```

### 11.3 Layer Responsibilities

| Layer | Responsibility | Files |
|-------|---------------|-------|
| **HTTP Layer** | Parse requests, send responses | Express.js |
| **Middleware** | Auth, logging, validation | `server/middleware/` |
| **Route Handler** | Request routing, parameter extraction | `server/routes.ts` |
| **Service Layer** | Business logic (when used) | `server/services/` |
| **Storage Interface** | Data access abstraction | `server/storage.ts` |
| **Implementation** | Database operations | `server/postgresStorage.ts` |
| **ORM** | SQL generation, type mapping | Drizzle ORM |
| **Database** | Data persistence | PostgreSQL |

---

## Appendix A: File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| `server/routes.ts` | 11,420 | Main API routes |
| `server/postgresStorage.ts` | 7,035 | PostgreSQL data access |
| `server/routes/bulk.ts` | 6,144 | Bulk import/export operations |
| `shared/schema.ts` | 2,596 | Database schemas and types |
| `server/memStorage.ts` | 1,568 | File-based storage |
| `server/businessRules.ts` | 1,018 | Business rule documentation |
| `server/storage.ts` | 934 | Storage interface definition |
| `server/services/jobDueScanner.ts` | 731 | Job scanning scheduler |
| `server/routes/fleetAdmin.ts` | 718 | Fleet admin routes |
| `server/migrations.ts` | 691 | Migration execution |

---

## Appendix B: Technology Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Neon) |
| **ORM** | Drizzle ORM |
| **Validation** | Zod |
| **File Upload** | Multer |
| **Excel Parsing** | XLSX, PapaParse |
| **Frontend** | React, Vite, TanStack Query |
| **Styling** | Tailwind CSS, shadcn/ui |

---

*Document generated from codebase analysis. No code modifications were made.*
