# Backend Module Architecture

## Overview

The backend was refactored from a monolithic `server/routes.ts` (21,144 lines) into 17 domain modules under `server/modules/`. Each module follows a layered architecture pattern.

## Refactoring Impact

| Metric | Before | After |
|--------|--------|-------|
| `server/routes.ts` lines | 21,144 | 843 |
| Module files | 0 | 121 |
| Total module lines | 0 | 35,116 |
| Total endpoints | 339 | 339 |

## Module Registry

All modules are registered in `server/modules/index.ts` and mounted at `/technical/api` via `moduleRouter`.

| # | Module | Files | Lines | Endpoints | Description |
|---|--------|-------|-------|-----------|-------------|
| 1 | vessels | 5 | 540 | 17 | Vessel CRUD, fleet registry, PMS settings |
| 2 | components | 10 | 1,474 | 31 | Component tree, sub-entities, documents |
| 3 | jobs | 6 | 1,229 | 10 | Job CRUD, maintenance planner, context |
| 4 | work-orders | 9 | 2,441 | 17 | WO lifecycle, execution, completion, bulk ops |
| 5 | running-hours | 5 | 1,055 | 13 | RH tracking, parent/child cascade, config |
| 6 | spares | 8 | 1,692 | 38 | Spare parts, inventory, location stock |
| 7 | stores | 4 | 517 | 11 | Stores requisitions and ledger |
| 8 | defects | 7 | 1,279 | 35 | Defect management, recurring analysis, admin |
| 9 | cert-surveys | 13 | 2,546 | 24 | Certificates, surveys, admin config |
| 10 | fleet | 7 | 2,965 | 31 | Fleet-wide ops, master lists, vessel mappings |
| 11 | reports | 18 | 9,797 | 43 | All report types (maintenance, spares, compliance, etc.) |
| 12 | change-requests | 4 | 419 | 12 | Change request workflow |
| 13 | bulk-upload | 9 | 7,750 | 26 | Excel/CSV import, validation, undo |
| 14 | alerts | 4 | 299 | 10 | Alert policies, events, notifications |
| 15 | forms | 4 | 299 | 10 | Form definitions, versioning, runtime |
| 16 | chatbot | 2 | 59 | 1 | AI chatbot integration |
| 17 | misc | 3 | 637 | 10 | Document storage, admin utilities |
| | **shared** | 2 | 77 | - | `asyncHandler` middleware, `AppError` class |

## Layer Structure

Each module follows a 4-layer architecture:

```
server/modules/<module>/
  routes.ts            # Express Router — wires HTTP verbs to controllers
  controllers/         # HTTP layer — parse req, call service, send res
  services/            # Business logic — no HTTP objects (req/res)
  repositories/        # Data access — wraps storage.* calls
```

### Layer Rules

1. **Routes** (`routes.ts`)
   - Defines Express routes using `router.get/post/put/patch/delete`
   - Wraps controllers with `asyncHandler` for error handling
   - Applies middleware (auth, multer, etc.)
   - No business logic

2. **Controllers** (`controllers/*.ts`)
   - Accept `(req: Request, res: Response)` or `(req: AuthenticatedRequest, res: Response)`
   - Extract params/body/query from request
   - Call service methods
   - Return JSON responses with appropriate status codes
   - No direct `storage.*` calls

3. **Services** (`services/*.ts`)
   - Pure business logic functions
   - No `Request`/`Response` imports
   - Call repository methods for data access
   - Throw `AppError` for domain errors
   - May call other services within the same module

4. **Repositories** (`repositories/*.ts`)
   - Thin wrappers around `storage.*` methods
   - Import `storage` from `../../storage` (relative to module root)
   - No business logic, just data access delegation

### Exception: Simpler Modules

Some smaller modules (chatbot, misc) skip the repository layer when the service layer directly delegates to existing services or the operations are simple enough.

## Shared Infrastructure

| File | Purpose |
|------|---------|
| `server/modules/shared/middleware.ts` | `asyncHandler` — catches errors from async controllers |
| `server/modules/shared/errors.ts` | `AppError` class with statusCode for HTTP error responses |
| `server/modules/index.ts` | Module router registry — all modules registered here |

## What Remains in routes.ts

`server/routes.ts` now contains only:

1. **Server setup** — `registerRoutes()` function
2. **Middleware** — `mockAuthMiddleware`, immutability check
3. **Module mount** — `app.use('/technical/api', moduleRouter)`
4. **Non-API endpoint** — `/download/docs/:filename` (outside `/technical/api`)
5. **Schedulers** — JobDueScanner, WorkOrderStatusRecalculator
6. **Dev seed endpoints** — `/dev/seed/recurring-defects` (development only)
7. **Startup backfill tasks** — job nextDueDate/RH, maintenance history, postponement checks
8. **Server lifecycle** — HTTP server creation, shutdown handlers

## Dependency Flow

```
routes.ts
  └── modules/index.ts (moduleRouter)
        └── <module>/routes.ts
              └── <module>/controllers/*.ts
                    └── <module>/services/*.ts
                          └── <module>/repositories/*.ts
                                └── server/storage.ts (IStorage interface)
                                      └── server/postgresStorage.ts (implementation)
```

Cross-module dependencies:
- Modules do NOT import from each other
- All data access goes through `storage` (IStorage interface)
- Shared utilities (`@shared/*`) are used for date/status calculations
- Auth middleware (`server/middleware/auth.ts`) is shared across modules

## How to Add a New Endpoint

1. **Identify the module** — which domain does this endpoint belong to?
2. **Add repository method** (if new storage call needed) in `<module>/repositories/`
3. **Add service method** with business logic in `<module>/services/`
4. **Add controller handler** in `<module>/controllers/`
5. **Add route** in `<module>/routes.ts` using `asyncHandler(controller.method)`
6. No changes needed to `routes.ts` or `modules/index.ts`

### Example: Adding `GET /technical/api/spares/:id/history`

```typescript
// 1. repositories/sparesRepository.ts
export function getSpareHistory(spareId: string) {
  return storage.getSpareHistory(spareId);
}

// 2. services/sparesService.ts
export async function getSpareHistory(spareId: string) {
  const history = await sparesRepo.getSpareHistory(spareId);
  if (!history) throw new AppError(404, 'Spare not found');
  return history;
}

// 3. controllers/sparesController.ts
export async function getSpareHistory(req: Request, res: Response) {
  const result = await sparesService.getSpareHistory(req.params.id);
  res.json(result);
}

// 4. routes.ts
router.get('/spares/:id/history', asyncHandler(sparesCtrl.getSpareHistory));
```
