# V2 Architecture Migration Playbook

**Purpose**: This document is a self-contained reference for building V2 modules in the Seafarer Technical Management System. Hand this to any builder (human or AI) as the starting brief — it contains all patterns, rules, and decisions needed to create V2 modules and eventually retire the legacy codebase.

**Golden Rule**: Legacy code stays completely untouched until Phase 4 of the cutover plan. V2 modules are additive — they run alongside legacy with a frontend toggle for switching.

---

## Table of Contents

1. [V2 Architecture Overview](#1-v2-architecture-overview)
2. [Legacy-to-V2 Toggle Mechanism](#2-legacy-to-v2-toggle-mechanism)
3. [Step-by-Step: Building a V2 Module](#3-step-by-step-building-a-v2-module)
4. [Critical Rules](#4-critical-rules)
5. [4-Phase Cutover Plan](#5-4-phase-cutover-plan)

---

## 1. V2 Architecture Overview

### Layer Separation

Every V2 module follows a strict 4-layer architecture:

```
server/v2/<module-name>/
├── repositories/        # Direct Drizzle ORM queries via getDb()
│   └── <name>Repository.ts
├── services/            # Business logic, validation, orchestration
│   ├── <name>Service.ts
│   └── errors.ts        # Shared error classes (or import from components)
├── controllers/         # HTTP request/response handling
│   └── <name>Controller.ts
├── routes.ts            # Express router with asyncHandler wrapper
└── index.ts             # Module factory — wires layers together, exports router
```

### Schema Location

All V2 schemas live in `shared/v2/<module-name>/schema.ts` and use Drizzle `pgTable` definitions that point to the **same database tables** as legacy code. V2 schemas are isolated — they do NOT import from `shared/schema.ts` (the legacy schema file).

### Schema Dependency Chain

Schemas re-export from parent modules to avoid duplicate `pgTable` definitions. The actual dependency graph is:

```
Components (root — defines v2Components, v2Jobs, v2JobComponentLinks,
            v2ComponentDocuments, v2ComponentClassRegulatory,
            v2ComponentMaintenanceHistory, v2ComponentRequisitions)
  ├→ Jobs (re-exports v2Components/v2Jobs/v2JobComponentLinks from components,
  │        defines v2Spares re-export)
  ├→ Spares (re-exports v2Components from components,
  │          defines v2Spares, v2SparesHistory, v2Locations,
  │          v2SpareLocationStock, v2SpareComponentLinks, v2InventoryTransactions)
  ├→ Work Orders (re-exports from components + jobs + spares,
  │               defines v2WorkOrders, v2WorkOrderExecutions,
  │               v2WorkOrderExecutionDetails, v2PmsVesselSettings)
  ├→ Bulk (re-exports v2Components from components,
  │        defines v2MakerList, v2ImportHistory, v2ImportChangeLog, v2SfiDetails)
  ├→ Running Hours (re-exports v2Components from components,
  │                 defines v2RunningHoursAudit, v2ComponentRunningHoursLog)
  └→ Stores (standalone — defines v2StoresItems, v2StoresLedger)
```

When your new module needs a table already defined in another V2 schema, **re-export** it — never redefine the same `pgTable`. Check what's already exported before defining anything new.

### API Prefix

All V2 endpoints use the prefix: `/technical/api/v2/<module-name>/`

Legacy endpoints use: `/technical/api/<module-name>/`

### Database Access

V2 modules use `getDb()` from `server/db.ts` for all database access. Never use the legacy storage interface.

```typescript
import { getDb } from '../../../db';

export class ExampleRepository {
  async findAll(): Promise<Example[]> {
    const db = await getDb();
    return await db.select().from(v2Examples).where(...);
  }
}
```

---

## 2. Legacy-to-V2 Toggle Mechanism

The system supports runtime switching between legacy and V2 APIs via a `localStorage` toggle. This allows testing V2 alongside legacy without code changes.

### How It Works

**Storage Key**: `localStorage` item `pms_api_version` — value is either `'legacy'` (default) or `'v2'`.

**Core Functions** (in `client/src/modules/components/api/componentApiV2.ts`):

```typescript
const STORAGE_KEY = 'pms_api_version';
export type ApiMode = 'legacy' | 'v2';

export function getApiMode(): ApiMode {
  const mode = localStorage.getItem(STORAGE_KEY);
  return mode === 'v2' ? 'v2' : 'legacy';
}

export function setApiMode(mode: ApiMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}
```

**React Hook** (in `client/src/modules/components/hooks/useApiVersion.ts`):

```typescript
export function useApiVersion() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggleMode = useCallback(() => {
    const newMode: ApiMode = mode === 'legacy' ? 'v2' : 'legacy';
    setApiModeAndNotify(newMode);

    // Invalidate all affected query caches so data re-fetches from the new API
    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      return key.startsWith('/technical/api/<module>') ||
             key.startsWith('/technical/api/v2/<module>');
    }});
  }, [mode]);

  return { mode, toggleMode, isV2: mode === 'v2' };
}
```

**Important**: When adding a new V2 module, you must add its query key prefixes (both legacy and V2) to the `invalidateQueries` predicate in `useApiVersion.ts` so the cache is properly cleared on toggle.

### Frontend URL Builders

Each module has a dedicated `*ApiV2.ts` file (e.g., `sparesApiV2.ts`) that provides URL builder functions. These check `getApiMode()` and return the correct URL:

```typescript
// client/src/modules/components/api/sparesApiV2.ts
import { getApiMode } from './componentApiV2';

const V2_BASE = '/technical/api/v2/spares';
const LEGACY_BASE = '/technical/api/spares';

export function getSparesListUrl(vesselId: string): string {
  return getApiMode() === 'v2'
    ? `${V2_BASE}/${vesselId}`
    : `${LEGACY_BASE}/${vesselId}`;
}

export function getSparesListQueryKey(vesselId: string): (string | undefined)[] {
  return getApiMode() === 'v2'
    ? [V2_BASE, vesselId]
    : [LEGACY_BASE, vesselId];
}
```

Frontend pages import these URL builders instead of hardcoding API paths. This means pages work with both legacy and V2 without conditional logic scattered through components.

---

## 3. Step-by-Step: Building a V2 Module

Use this exact sequence when creating a new V2 module. Examples reference the Components module as the reference implementation.

### Step 1: Define the Schema

Create `shared/v2/<module-name>/schema.ts`:

```typescript
import { pgTable, text, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export dependencies from parent modules (don't redefine tables)
export { v2Components } from "../components/schema";
import { v2Components } from "../components/schema";
export type { Component } from "../components/schema";

// Define tables unique to this module
export const v2Examples = pgTable("examples", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  vesselId: text("vessel_id"),
  // FK references use cuuid for components, vuuid for vessels
  componentId: text("component_id").references(() => v2Components.cuuid,
    { onDelete: "restrict", onUpdate: "cascade" }),
});

// Insert schema (omit auto-generated fields)
export const insertExampleSchema = createInsertSchema(v2Examples).omit({ id: true });
export type Example = typeof v2Examples.$inferSelect;
export type InsertExample = z.infer<typeof insertExampleSchema>;
```

### Step 2: Create the Repository

Create `server/v2/<module-name>/repositories/<name>Repository.ts`:

```typescript
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { v2Examples, type Example, type InsertExample } from '@shared/v2/<module-name>/schema';
import { v2Components } from '@shared/v2/components/schema';

export class ExampleRepository {
  async findByVesselId(vesselId: string): Promise<Example[]> {
    const db = await getDb();
    return await db.select().from(v2Examples)
      .where(eq(v2Examples.vesselId, vesselId));
  }

  async findById(id: number): Promise<Example | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2Examples)
      .where(eq(v2Examples.id, id));
    return result[0];
  }

  async create(data: InsertExample): Promise<Example> {
    const db = await getDb();
    const result = await db.insert(v2Examples).values(data).returning();
    return result[0];
  }

  async update(id: number, data: Partial<InsertExample>): Promise<Example | undefined> {
    const db = await getDb();
    const result = await db.update(v2Examples)
      .set(data)
      .where(eq(v2Examples.id, id))
      .returning();
    return result[0];
  }

  async delete(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(v2Examples).where(eq(v2Examples.id, id));
  }
}
```

### Step 3: Create Error Classes

Create `server/v2/<module-name>/services/errors.ts` (or import from the components module):

```typescript
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
```

### Step 4: Create the Service

Create `server/v2/<module-name>/services/<name>Service.ts`:

```typescript
import type { Example, InsertExample } from "@shared/v2/<module-name>/schema";
import type { ExampleRepository } from "../repositories/exampleRepository";
import { NotFoundError, ValidationError } from "./errors";

export class ExampleService {
  constructor(private repository: ExampleRepository) {}

  async getByVesselId(vesselId: string): Promise<Example[]> {
    return this.repository.findByVesselId(vesselId);
  }

  async getById(id: number): Promise<Example> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundError("Example not found");
    }
    return item;
  }

  async create(data: InsertExample): Promise<Example> {
    // Add business logic validations here
    return this.repository.create(data);
  }
}
```

### Step 5: Create the Controller

Create `server/v2/<module-name>/controllers/<name>Controller.ts`:

```typescript
import type { Request, Response } from "express";
import type { ExampleService } from "../services/exampleService";
import { insertExampleSchema } from "@shared/v2/<module-name>/schema";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    role: string;
    vesselId: string | null;
    isActive: boolean;
  };
}

export class ExampleController {
  constructor(private service: ExampleService) {}

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const items = await this.service.getByVesselId(req.params.vesselId);
    res.json({ success: true, data: items });
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const item = await this.service.getById(Number(req.params.id));
    res.json({ success: true, data: item });
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const parsed = insertExampleSchema.parse(req.body);
    const item = await this.service.create(parsed);
    res.status(201).json({ success: true, data: item });
  }
}
```

### Step 6: Create Routes

Create `server/v2/<module-name>/routes.ts`:

```typescript
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { ExampleController } from "./controllers/exampleController";
import { NotFoundError, ValidationError, ForbiddenError } from "./services/errors";
import { requireAuth } from "../../middleware/auth";

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((error: any) => {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof ForbiddenError) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("V2 Example Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
}

export function createExampleRouter(controller: ExampleController): Router {
  const router = Router();

  router.get('/vessel/:vesselId', asyncHandler((req, res) => controller.list(req, res)));
  router.get('/:id', asyncHandler((req, res) => controller.getById(req, res)));
  router.post('/', asyncHandler((req, res) => controller.create(req, res)));

  return router;
}
```

### Step 7: Create Module Factory (index.ts)

Create `server/v2/<module-name>/index.ts`:

```typescript
import { ExampleRepository } from "./repositories/exampleRepository";
import { ExampleService } from "./services/exampleService";
import { ExampleController } from "./controllers/exampleController";
import { createExampleRouter } from "./routes";

export function createV2ExampleModule() {
  const repository = new ExampleRepository();
  const service = new ExampleService(repository);
  const controller = new ExampleController(service);
  const router = createExampleRouter(controller);

  return { router, repository, service, controller };
}
```

### Step 8: Register in server/routes.ts

Add this alongside (not replacing) existing V2 module registrations:

```typescript
const { createV2ExampleModule } = await import("./v2/<module-name>/index");
const v2Example = createV2ExampleModule();
app.use('/technical/api/v2/<module-name>', v2Example.router);
console.log('V2 Example module registered at /technical/api/v2/<module-name>/*');
```

### Step 9: Create Frontend URL Builder

Create `client/src/modules/components/api/<moduleName>ApiV2.ts`:

**Important**: Legacy URL structures vary by module — some use `/technical/api/<module>`, others use `/technical/api/inventory/...` or nested paths. Always check the actual legacy route in `server/routes.ts` before writing the URL builder.

```typescript
import { getApiMode } from './componentApiV2';

// V2 base is always consistent: /technical/api/v2/<module-name>
const V2_BASE = '/technical/api/v2/<module-name>';

// Legacy base varies by module — match the actual legacy route pattern:
// Components: '/technical/api/components'
// Spares:     '/technical/api/spares' + '/technical/api/inventory/spares-with-inventory'
// Defects:    '/technical/api/defects'
const LEGACY_BASE = '/technical/api/<legacy-prefix>';

export function getExampleListUrl(vesselId: string): string {
  return getApiMode() === 'v2'
    ? `${V2_BASE}/vessel/${vesselId}`
    : `${LEGACY_BASE}/${vesselId}`;
}

export function getExampleListQueryKey(vesselId: string): (string | undefined)[] {
  return getApiMode() === 'v2'
    ? [V2_BASE, vesselId]
    : [LEGACY_BASE, vesselId];
}

export function getExampleByIdUrl(id: number | string): string {
  return getApiMode() === 'v2'
    ? `${V2_BASE}/${id}`
    : `${LEGACY_BASE}/${id}`;
}
```

### Step 10: Update Cache Invalidation

In `client/src/modules/components/hooks/useApiVersion.ts`, add the new module's query key prefixes to the `invalidateQueries` predicate:

```typescript
return key.startsWith('/technical/api/<legacy-prefix>') ||
       key.startsWith('/technical/api/v2/<module-name>');
```

### Step 11: Wire Frontend Pages

In the page files that consume this module's data, replace hardcoded API URLs with the URL builder functions. The project uses TanStack Query v5 with a default fetcher already configured — do NOT define a custom `queryFn`:

```typescript
import { getExampleListUrl, getExampleListQueryKey } from "@/modules/components/api/exampleApiV2";

// The default fetcher handles GET requests automatically
const { data } = useQuery({
  queryKey: getExampleListQueryKey(vesselId),
});

// For mutations, use apiRequest from queryClient:
import { apiRequest, queryClient } from "@/lib/queryClient";

const mutation = useMutation({
  mutationFn: (newItem) => apiRequest("POST", getExampleCreateUrl(), newItem),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getExampleListQueryKey(vesselId) });
  },
});
```

---

## 4. Critical Rules

### 4.1 Identity Columns — cuuid and vuuid

After the identity restructure migrations:

| Table | `id` column | UUID column | Use for lookups |
|-------|-------------|-------------|-----------------|
| `components` | `SERIAL` (integer, auto-increment) | `cuuid` (TEXT, unique) | Always use `cuuid` |
| `vessels` | `SERIAL` (integer, auto-increment) | `vuuid` (TEXT, unique) | Always use `vuuid` |

**All child table FK columns** (`component_id`, `vessel_id`) store the UUID value and reference the UUID column. Never look up components/vessels by `id` — always use `cuuid`/`vuuid`.

```typescript
// CORRECT
const component = await db.select().from(v2Components)
  .where(eq(v2Components.cuuid, componentUuid));

// WRONG — id is now an integer, not a UUID
const component = await db.select().from(v2Components)
  .where(eq(v2Components.id, componentUuid));
```

See `docs/component-migration-guide.md` and `docs/vessel-migration-guide.md` for full details.

### 4.2 Drizzle-Only Migration Policy

All database schema changes must follow this policy:

1. Update `shared/schema.ts` (or the relevant `shared/v2/*/schema.ts`) first
2. Run `drizzle-kit generate` to create a `.sql` migration file in `/migrations`
3. Review the generated SQL before applying
4. One logical change per migration file
5. Never write raw SQL migrations by hand
6. Never use code-based migrations in TypeScript

### 4.3 No Legacy Imports in V2

V2 server modules must **never** import from:
- `server/services/` (legacy service layer)
- `server/storage.ts` (legacy storage interface)
- `shared/schema.ts` (legacy schema — use `shared/v2/*/schema.ts` instead)

V2 modules import exclusively from `@shared/v2/*/schema` for types and table definitions.

### 4.4 Storage Strategy in V2

- **Document storage**: Use Replit Object Storage (not local filesystem)
- **SFI reference data**: Embedded in-memory constants (not file-based)
- **Temporary caches** (e.g., dry-run results): In-memory `Map` with TTL expiry
- **File uploads** (e.g., bulk import spreadsheets): Processed in-memory via `multer.memoryStorage()` — files are parsed and discarded, not written to disk

### 4.5 Legacy Code Stays Untouched

During V2 development (Phases 1-3), legacy code is **read-only reference material**. Do not modify, refactor, or delete any legacy routes, services, or schemas. V2 is purely additive.

### 4.6 Response Format

V2 endpoints must match the response shape that the frontend page expects. There is no single mandatory wrapper — different modules use different formats:

- **Components**: Returns raw arrays/objects directly (e.g., `res.json(components)`)
- **Spares, Stores**: Returns `{ success: true, data: [...] }` wrapper
- **Errors**: Always return `{ error: "message" }` (handled by `asyncHandler`)

When building a new V2 module, check what the frontend page currently parses from the legacy response and match that shape exactly. This ensures the toggle works seamlessly.

### 4.7 Error Handling Pattern

All V2 routes use the `asyncHandler` wrapper that catches typed errors:

- `NotFoundError` → 404
- `ValidationError` → 400
- `ForbiddenError` → 403
- `z.ZodError` → 400 with details
- Unhandled → 500

### 4.8 Authentication

V2 routes use the same auth middleware as legacy:

```typescript
import { requireAuth, requirePMSAdmin } from "../../middleware/auth";

router.get('/protected', requireAuth, asyncHandler(...));
router.post('/admin-only', requirePMSAdmin, asyncHandler(...));
```

---

## 5. 4-Phase Cutover Plan

### Phase 1: Complete V2 Backend Coverage

Build V2 modules for every legacy module that doesn't yet have one. Follow the step-by-step guide in Section 3. Each new module should:

- Pass the same data as the legacy endpoint (verify with side-by-side comparison)
- Include all CRUD operations the frontend uses
- Support vessel-scoped queries where applicable
- Handle business logic validations in the service layer

**Legacy code remains untouched during this phase.**

### Phase 2: Frontend Wiring

For each V2 module built in Phase 1:

1. Create the `*ApiV2.ts` URL builder file
2. Update `useApiVersion.ts` cache invalidation to include the new module's prefixes
3. Update frontend pages to use URL builders instead of hardcoded paths
4. Test with the toggle — verify both legacy and V2 return the same data

**Legacy code remains untouched during this phase.**

### Phase 3: Default to V2

Once all modules have V2 versions and have been tested:

1. Change the default in `getApiMode()` from `'legacy'` to `'v2'`:
   ```typescript
   export function getApiMode(): ApiMode {
     const mode = localStorage.getItem(STORAGE_KEY);
     return mode === 'legacy' ? 'legacy' : 'v2';  // Default flipped to v2
   }
   ```
2. Keep the toggle available for rollback during a testing/stabilization period
3. Monitor for issues — if any V2 endpoint has problems, users can toggle back to legacy

**Legacy code remains untouched during this phase.**

### Phase 4: Remove Legacy Code

Only after V2 has been the default for a sufficient stabilization period:

1. **Remove legacy route registrations** from `server/routes.ts` (all routes not under `/v2/`)
2. **Remove legacy services** (`server/services/`)
3. **Remove the toggle mechanism**:
   - Delete `useApiVersion.ts` hook
   - Delete `ComponentApiToggle.tsx` component
   - Simplify all `*ApiV2.ts` files to only return V2 URLs (remove `getApiMode()` branching)
   - Remove `localStorage` key usage
4. **Clean up legacy schemas** — if `shared/schema.ts` has types only used by legacy code, remove them
5. **Optional**: Rename `/technical/api/v2/` prefix to `/technical/api/` if desired (update all frontend URL builders and route registrations)
6. **Remove the legacy storage interface** (`server/storage.ts`) if no longer referenced

**This is the only phase where legacy code is modified or deleted.**

---

## Appendix A: File Locations Reference

| Purpose | Location |
|---------|----------|
| V2 backend modules | `server/v2/<module-name>/` |
| V2 schema definitions | `shared/v2/<module-name>/schema.ts` |
| Legacy schema | `shared/schema.ts` |
| Legacy routes | `server/routes.ts` (main file) |
| V2 route registration | `server/routes.ts` (top of file, imports from `server/v2/`) |
| Frontend URL builders | `client/src/modules/components/api/*ApiV2.ts` |
| API toggle hook | `client/src/modules/components/hooks/useApiVersion.ts` |
| Toggle UI component | `client/src/modules/components/components/ComponentApiToggle.tsx` |
| Database access helper | `server/db.ts` (`getDb()`) |
| Auth middleware | `server/middleware/auth.ts` |
| Migration files | `migrations/*.sql` |
| Migration guides | `docs/component-migration-guide.md`, `docs/vessel-migration-guide.md` |

## Appendix B: Legacy Route Prefixes

These are the top-level route groups in the legacy API. Each represents a potential V2 module:

```
admin, alerts, bulk, certificates, change-requests,
component-class-regulatory, component-documents, component-maintenance-history,
component-requisitions, components, defect-categories, defect-types, defects,
documents, equipment-categories, fleet, fleet-admin, fleets, forms, inventory,
job-maintenance-history, jobs, maintenance-planner, me, pms-vessel-settings,
recurring-defects, reports, running-hours, spares, stores, surveys,
template-builder, upload-document, users, vessel-location-names, vessels,
vessels-with-fleets, work-order-executions, work-orders
```

Not every legacy prefix needs its own V2 module — related prefixes can be grouped (e.g., `defects`, `defect-categories`, `defect-types`, `recurring-defects` could be one V2 Defects module).
