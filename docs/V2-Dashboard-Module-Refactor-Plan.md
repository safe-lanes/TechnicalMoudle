# V2 Modular Architecture Plan — Dashboard Module (PMS Dashboard)

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) Dashboard module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: The PMS Dashboard — a frontend-only aggregation page that fetches data from multiple existing module APIs (work orders, components, spares, stores) and computes KPIs, charts, and status summaries client-side.

**Critical Constraint**: The V2 architecture must produce 100% identical KPI values, chart data, and status classifications as the current client-side computations. This initiative moves aggregation server-side for performance and consistency, not a functional rewrite.

**Companion Document**: This plan follows the exact same conventions established in `V2-Fleet-Module-Refactor-Plan.md` (Fleet Module V2) and `V2-Component-Module-Refactor-Plan.md` (Component Module V2). All plans share identical layer rules, toggle mechanism, and enforcement policies.

**Module Size Note**: The Dashboard module is **significantly smaller** than Fleet (~78 routes) or Components (~30 routes). It has **zero dedicated legacy route handlers** — the V2 effort here creates *new* backend aggregation endpoints rather than refactoring existing ones. The frontend refactor involves a single page (1,085 lines). This plan follows the same format structure for consistency but is proportionally sized.

---

## Canonical V2 API Prefix

All V2 dashboard endpoints use this canonical base path:

```
/technical/api/v2/dashboard/metrics/:vesselId   ← All dashboard KPIs for a single vessel
/technical/api/v2/dashboard/summary             ← Fleet-wide summary (all vessels aggregated)
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/dashboard/` — module name
- `/{action}` — action name

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [V2 Folder Structure](#2-v2-folder-structure)
3. [Layer Mapping: Current → V2](#3-layer-mapping-current--v2)
4. [Repository Layer Rules](#4-repository-layer-rules)
5. [Service Layer Rules](#5-service-layer-rules)
6. [Controller Layer Rules](#6-controller-layer-rules)
7. [RESTful Route Patterns](#7-restful-route-patterns)
8. [Frontend API Layer Rules](#8-frontend-api-layer-rules)
9. [Toggle Mechanism](#9-toggle-mechanism)
10. [Critical Enforcement Rules](#10-critical-enforcement-rules)
11. [Phased Migration Plan](#11-phased-migration-plan)
12. [Toggle-Based Flow Diagram](#12-toggle-based-flow-diagram)
13. [Risk Points & Rollback Strategy](#13-risk-points--rollback-strategy)
14. [Validation Checklist](#14-validation-checklist)

---

## 1. Current State Analysis

### 1.1 Module Characteristics

The Dashboard module is **unique** among V2 modules because:

| Characteristic | Dashboard | Typical Module (e.g., Fleet) |
|---------------|-----------|------------------------------|
| Dedicated route handlers | **0** | 30–78 |
| Dedicated database tables | **0** | 1–10+ |
| Dedicated storage methods | **0** | 5–50+ |
| Frontend pages | **1** (1,085 lines) | 1–11+ |
| Data source | Aggregates from **other module APIs** | Own tables |
| Business logic location | **Client-side** (useMemo hooks) | Server-side (route handlers) |

### 1.2 Frontend File Analysis

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `client/src/pages/pms/Dashboard.tsx` | 1,085 | PMS Dashboard — KPI cards, charts, status summaries, navigation | Makes 4+ separate API calls, performs all KPI computation client-side via `useMemo` |

### 1.3 Current API Calls Made by Dashboard.tsx

The dashboard does **not** have its own backend routes. It fetches raw data from existing module endpoints and computes everything client-side:

| API Endpoint | Purpose | Dashboard Usage |
|-------------|---------|----------------|
| `GET /technical/api/work-orders?vesselId=X` | Fetch all work orders | Work order KPIs (overdue, due, pending approval, completed, active/planned) |
| `GET /technical/api/work-orders` (no vesselId) | Fetch all work orders (all vessels) | Fleet-wide work order aggregation |
| `GET /technical/api/spares/:vesselId` | Fetch spares for vessel | Spares KPIs (total, low stock, critical) |
| `GET /technical/api/stores/:vesselId` | Fetch stores for vessel | Stores KPIs (total, low stock, by type breakdown) |
| `GET /technical/api/components/:vesselId` | Fetch components for vessel | Components KPIs (total, active) |
| `GET /technical/api/vessels` | Fetch vessel list | Vessel selector, "all vessels" iteration |

**"All Vessels" Problem (L96–L169):** When `vesselId === 'all'`, the dashboard iterates over every vessel and makes individual API calls for spares, stores, and components. This creates N+1 request patterns that scale poorly with fleet size.

### 1.4 Client-Side KPI Computations (Dashboard.tsx)

#### 1.4.1 Work Order KPIs (L183–L217)

```typescript
// Extracted from Dashboard.tsx useMemo
const workOrderKPIs = useMemo(() => {
  const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined);
  
  const due = safeWOs.filter(wo => 
    ((wo as any).computedStatus === 'Due' || (wo as any).computedStatus === 'Due (Grace P)') && !wo.isExecution
  );
  const overdue = safeWOs.filter(wo => 
    (wo as any).computedStatus === 'Overdue' && !wo.isExecution
  );
  const pendingApproval = safeWOs.filter(wo => 
    (wo as any).computedStatus === 'Pending Approval'
  );
  const completed = safeWOs.filter(wo => 
    (wo as any).computedStatus === 'Completed'
  );
  const planned = safeWOs.filter(wo => 
    ((wo as any).computedStatus === 'Active' || (wo as any).computedStatus === 'Postponed') && !wo.isExecution
  );

  return {
    total: safeWOs.filter(wo => !wo.isExecution).length,
    overdue: overdue.length,
    overdueList: overdue.slice(0, 5),
    due: due.length,
    dueList: due.slice(0, 5),
    pendingApproval: pendingApproval.length,
    pendingApprovalList: pendingApproval.slice(0, 5),
    pendingApprovalFull: pendingApproval,
    completed: completed.length,
    active: planned.length
  };
}, [workOrdersData]);
```

**Key business rules:**
- `Due` includes both `'Due'` and `'Due (Grace P)'` statuses, excludes execution records
- `Overdue` only includes `'Overdue'` status, excludes execution records
- `Planned` includes both `'Active'` and `'Postponed'` statuses, excludes execution records
- `total` counts all non-execution work orders
- Lists are capped at 5 items for display (full list retained for bulk operations)

#### 1.4.2 Spares KPIs (L257–L277)

```typescript
const sparesKPIs = useMemo(() => {
  const lowStockSpares = sparesData.filter(spare => {
    const status = getStockStatus(spare.rob, spare.min);
    return status.isLow;
  });
  const criticalSpares = sparesData.filter(spare => 
    spare.critical === 'Critical' || spare.critical === 'Yes'
  );
  const criticalLowStock = lowStockSpares.filter(spare => 
    spare.critical === 'Critical' || spare.critical === 'Yes'
  );
  return {
    total: sparesData.length,
    lowStock: lowStockSpares.length,
    lowStockList: lowStockSpares.slice(0, 5),
    critical: criticalSpares.length,
    criticalLowStock: criticalLowStock.length,
    criticalLowStockList: criticalLowStock.slice(0, 5)
  };
}, [sparesData]);
```

**Stock status logic (L172–L176):**
```typescript
const getStockStatus = (rob: number, min: number): { label: string; isLow: boolean } => {
  if (rob < min) return { label: 'Low', isLow: true };
  if (rob === min) return { label: 'At Min', isLow: true };
  return { label: 'OK', isLow: false };
};
```

#### 1.4.3 Stores KPIs (L280–L295)

```typescript
const storesKPIs = useMemo(() => {
  const lowStockStores = storesData.filter(item => {
    const status = getStockStatus(item.rob, item.min);
    return status.isLow;
  });
  return {
    total: storesData.length,
    lowStock: lowStockStores.length,
    lowStockList: lowStockStores.slice(0, 5),
    stores: storesData.filter(i => i.itemType === 'stores').length,
    lubes: storesData.filter(i => i.itemType === 'lubes').length,
    chemicals: storesData.filter(i => i.itemType === 'chemicals').length,
    others: storesData.filter(i => i.itemType === 'others').length
  };
}, [storesData]);
```

#### 1.4.4 Components KPIs (L298–L304)

```typescript
const componentsKPIs = useMemo(() => {
  const activeComponents = componentsData.filter(c => c.isActive !== false);
  return {
    total: componentsData.length,
    active: activeComponents.length
  };
}, [componentsData]);
```

#### 1.4.5 Outstanding Tasks Percentage (L356–L401)

```typescript
// Calculates outstanding tasks as percentage of monthly planned maintenance
const outstandingTasksChartData = useMemo(() => {
  const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthlyPlannedTasks = safeWOs.filter(wo => {
    if (wo.isExecution) return false;
    const dueDate = parseFlexibleDate(wo.dueDate);
    if (!dueDate) return false;
    return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
  });
  
  const outstandingTasks = monthlyPlannedTasks.filter(wo => {
    const status = (wo as any).computedStatus;
    return status !== 'Completed';
  });
  
  const completedTasks = monthlyPlannedTasks.filter(wo => {
    const status = (wo as any).computedStatus;
    return status === 'Completed';
  });
  
  // ... percentage calculations
}, [workOrdersData]);
```

#### 1.4.6 Chart Data Computations (L308–L328)

**Work Order Status Distribution (L308–L315):**
- Produces donut chart data with 4 segments: Overdue (red), Due (amber), Pending Approval (blue), Completed (green)
- Filters out segments with count = 0

**Spares Stock Status (L318–L328):**
- Produces donut chart data with 3 segments: OK (green), At Min (amber), Low (red)
- Uses `getStockStatus()` helper for classification
- Filters out segments with count = 0

### 1.5 Schema Tables (None Dedicated)

The Dashboard module has **no dedicated database tables**. It aggregates data from tables owned by other modules:

| Table | Owner Module | Dashboard Usage |
|-------|-------------|----------------|
| `work_orders` | Work Orders | Status counts, overdue detection, compliance rate |
| `components` | Components | Total/active counts |
| `spares` | Spares | Stock status, critical parts |
| `stores_items` | Stores | Inventory breakdown by type |
| `vessels` | Core | Vessel selector, multi-vessel iteration |

### 1.6 Storage Methods (None Dedicated)

The Dashboard uses **no dedicated storage methods**. The V2 repository will call existing storage methods from other modules:

| Existing Storage Method | Owner Module | Dashboard V2 Usage |
|------------------------|-------------|-------------------|
| `storage.getWorkOrders(vesselId?)` | Work Orders | Work order KPIs |
| `storage.getComponents(vesselId)` | Components | Component counts |
| `storage.getSpares(vesselId)` | Spares | Spares stock status |
| `storage.getStoresItems(vesselId)` | Stores | Stores breakdown |
| `storage.getVessels()` | Core | Multi-vessel aggregation |

---

## 2. V2 Folder Structure

```
server/v2/dashboard/
├── index.ts                              # Module entry point — createDashboardV2Router()
├── routes.ts                             # 2 route definitions
├── repositories/
│   └── dashboardRepository.ts            # Calls existing storage methods from other modules
├── services/
│   └── dashboardService.ts               # KPI aggregation + calculation logic (extracted from Dashboard.tsx)
├── controllers/
│   └── dashboardController.ts            # HTTP layer — req/res handling
└── types.ts                              # Dashboard-specific response types

client/src/modules/dashboard/
├── api/
│   └── dashboardApi.ts                   # Toggle-aware API (legacy multi-call vs V2 single-call)
└── hooks/
    └── useDashboard.ts                   # Single hook replacing 4+ useQuery calls
```

**File count: 9 new files** (7 backend + 2 frontend)

This is intentionally minimal compared to Fleet V2 (~40+ files) because the Dashboard module has no CRUD operations, no upload logic, and only 2 endpoints.

---

## 3. Layer Mapping: Current → V2

### 3.1 Current Architecture (No Layering)

```
Dashboard.tsx
  ├── useQuery → fetch('/technical/api/work-orders?vesselId=X')
  ├── useQuery → fetch('/technical/api/spares/:vesselId')
  ├── useQuery → fetch('/technical/api/stores/:vesselId')
  ├── useQuery → fetch('/technical/api/components/:vesselId')
  └── useMemo  → Client-side KPI calculations (5 separate computations)
```

**Problems:**
1. **Multiple round-trips**: 4+ API calls per dashboard load, N+1 for "all vessels"
2. **Client-side computation drift**: KPI formulas live only in frontend code; any copy/paste to other views risks divergence
3. **No caching**: Every dashboard visit re-fetches all raw data and re-computes
4. **Payload waste**: Full work order/spare/component records fetched when only counts are needed

### 3.2 V2 Architecture (Layered)

```
Dashboard.tsx
  └── useDashboard hook
       └── dashboardApi.ts (toggle-aware)
            ├── Legacy mode: 4+ fetch calls → client-side computation (unchanged)
            └── V2 mode: 1 fetch call → pre-computed KPIs from server
                 └── GET /technical/api/v2/dashboard/metrics/:vesselId
                      └── dashboardController.getMetrics()
                           └── dashboardService.computeMetrics(vesselId)
                                └── dashboardRepository
                                     ├── .getWorkOrders(vesselId)    → storage.getWorkOrders()
                                     ├── .getSpares(vesselId)        → storage.getSpares()
                                     ├── .getStores(vesselId)        → storage.getStoresItems()
                                     └── .getComponents(vesselId)    → storage.getComponents()
```

---

## 4. Repository Layer Rules

### 4.1 Rules

| Rule | Detail |
|------|--------|
| **Only layer that imports `storage`** | Repository is the only layer that touches the storage interface |
| **No business logic** | No KPI calculations, no filtering — just data retrieval |
| **Returns raw data** | Returns full arrays from existing storage methods |
| **No HTTP objects** | No `req`, `res`, `next` |
| **Reuses existing storage methods** | Does NOT create new storage methods — calls existing ones from other modules |

### 4.2 Repository Methods

```typescript
// server/v2/dashboard/repositories/dashboardRepository.ts

import { storage } from "../../../storage";

export class DashboardRepository {
  async getWorkOrders(vesselId?: string) {
    return storage.getWorkOrders(vesselId);
  }

  async getSpares(vesselId: string) {
    return storage.getSpares(vesselId);
  }

  async getStoresItems(vesselId: string) {
    // Uses existing stores storage method
    return storage.getStoresItems(vesselId);
  }

  async getComponents(vesselId: string) {
    return storage.getComponents(vesselId);
  }

  async getVessels() {
    return storage.getVessels();
  }
}
```

**Note:** Unlike other V2 modules, the Dashboard repository creates **no new storage methods**. It is a thin wrapper around existing methods from Components, Spares, Stores, and Work Orders modules.

---

## 5. Service Layer Rules

### 5.1 Rules

| Rule | Detail |
|------|--------|
| **All KPI logic lives here** | Extract exact computation formulas from Dashboard.tsx `useMemo` hooks |
| **No HTTP objects** | No `req`, `res`, `next` |
| **No `storage` import** | Receives data from repository via dependency injection |
| **Pure functions where possible** | KPI calculations should be testable without I/O |
| **Response shape must match current client expectations** | V2 API returns objects shaped identically to what Dashboard.tsx currently computes |

### 5.2 Service Methods

```typescript
// server/v2/dashboard/services/dashboardService.ts

export class DashboardService {
  constructor(private repo: DashboardRepository) {}

  /**
   * Compute all dashboard metrics for a single vessel.
   * Mirrors exactly what Dashboard.tsx computes client-side.
   */
  async computeMetrics(vesselId: string): Promise<DashboardMetrics> {
    const [workOrders, spares, stores, components] = await Promise.all([
      this.repo.getWorkOrders(vesselId),
      this.repo.getSpares(vesselId),
      this.repo.getStoresItems(vesselId),
      this.repo.getComponents(vesselId),
    ]);

    return {
      workOrderKPIs: this.computeWorkOrderKPIs(workOrders),
      sparesKPIs: this.computeSparesKPIs(spares),
      storesKPIs: this.computeStoresKPIs(stores),
      componentsKPIs: this.computeComponentsKPIs(components),
      outstandingTasks: this.computeOutstandingTasks(workOrders),
      workOrderStatusChart: this.computeWorkOrderStatusChart(workOrders),
      sparesStockChart: this.computeSparesStockChart(spares),
    };
  }

  /**
   * Compute fleet-wide summary across all vessels.
   * Replaces the N+1 "all vessels" iteration in Dashboard.tsx L96–L169.
   */
  async computeSummary(): Promise<DashboardMetrics> {
    const [workOrders, vessels] = await Promise.all([
      this.repo.getWorkOrders(),  // All work orders, no vessel filter
      this.repo.getVessels(),
    ]);

    // Aggregate spares, stores, components across all vessels
    const allSpares = [];
    const allStores = [];
    const allComponents = [];
    for (const vessel of vessels) {
      const [spares, stores, components] = await Promise.all([
        this.repo.getSpares(vessel.id),
        this.repo.getStoresItems(vessel.id),
        this.repo.getComponents(vessel.id),
      ]);
      allSpares.push(...spares);
      allStores.push(...stores);
      allComponents.push(...components);
    }

    return {
      workOrderKPIs: this.computeWorkOrderKPIs(workOrders),
      sparesKPIs: this.computeSparesKPIs(allSpares),
      storesKPIs: this.computeStoresKPIs(allStores),
      componentsKPIs: this.computeComponentsKPIs(allComponents),
      outstandingTasks: this.computeOutstandingTasks(workOrders),
      workOrderStatusChart: this.computeWorkOrderStatusChart(workOrders),
      sparesStockChart: this.computeSparesStockChart(allSpares),
    };
  }

  // --- Private KPI computation methods (extracted from Dashboard.tsx) ---

  private computeWorkOrderKPIs(workOrders: any[]): WorkOrderKPIs { /* ... */ }
  private computeSparesKPIs(spares: any[]): SparesKPIs { /* ... */ }
  private computeStoresKPIs(stores: any[]): StoresKPIs { /* ... */ }
  private computeComponentsKPIs(components: any[]): ComponentsKPIs { /* ... */ }
  private computeOutstandingTasks(workOrders: any[]): OutstandingTasksData { /* ... */ }
  private computeWorkOrderStatusChart(workOrders: any[]): ChartDataPoint[] { /* ... */ }
  private computeSparesStockChart(spares: any[]): ChartDataPoint[] { /* ... */ }
  private getStockStatus(rob: number, min: number): StockStatus { /* ... */ }
  private parseFlexibleDate(dateStr: string | null | undefined): Date | null { /* ... */ }
}
```

### 5.3 Critical Extraction Rules

The following formulas **MUST** be extracted line-by-line from Dashboard.tsx with zero modifications:

| Formula | Source Location | Notes |
|---------|----------------|-------|
| Work Order status filtering | L183–L217 | `computedStatus` field matching, `isExecution` exclusion |
| Stock status classification | L172–L176 | `rob < min` = Low, `rob === min` = At Min, else OK |
| Critical spare detection | L262–L266 | `critical === 'Critical' \|\| critical === 'Yes'` |
| Outstanding tasks percentage | L356–L401 | Current month filter, `parseFlexibleDate` for date handling |
| Stores type breakdown | L290–L294 | `itemType` field matching: 'stores', 'lubes', 'chemicals', 'others' |

---

## 6. Controller Layer Rules

### 6.1 Rules

| Rule | Detail |
|------|--------|
| **HTTP-only layer** | Extracts params/query, calls service, maps errors to status codes |
| **No business logic** | No KPI computation — delegates entirely to service |
| **No storage import** | No direct database access |
| **Consistent error handling** | Try/catch with appropriate HTTP status codes |

### 6.2 Controller Methods

```typescript
// server/v2/dashboard/controllers/dashboardController.ts

export class DashboardController {
  constructor(private service: DashboardService) {}

  getMetrics = async (req: Request, res: Response) => {
    try {
      const { vesselId } = req.params;
      if (!vesselId) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      const metrics = await this.service.computeMetrics(vesselId);
      res.json(metrics);
    } catch (error: any) {
      console.error("Error computing dashboard metrics:", error);
      res.status(500).json({ error: "Failed to compute dashboard metrics" });
    }
  };

  getSummary = async (req: Request, res: Response) => {
    try {
      const summary = await this.service.computeSummary();
      res.json(summary);
    } catch (error: any) {
      console.error("Error computing dashboard summary:", error);
      res.status(500).json({ error: "Failed to compute dashboard summary" });
    }
  };
}
```

---

## 7. RESTful Route Patterns

### 7.1 V2 Dashboard Routes (2 routes)

```
# Dashboard Aggregation
GET    /technical/api/v2/dashboard/metrics/:vesselId   ← All KPIs for a single vessel
GET    /technical/api/v2/dashboard/summary              ← Fleet-wide summary (all vessels)
```

This is intentionally minimal. The Dashboard module is read-only — no CRUD, no uploads, no mutations.

### 7.2 Route Response Contract Rule

**V2 routes must return JSON shapes that match the current client-side computed objects exactly.** The response types defined in `types.ts` must mirror what `useMemo` hooks currently produce in Dashboard.tsx.

### 7.3 Route Registration

```typescript
// server/v2/dashboard/index.ts — Module entry point
export function createDashboardV2Router(): Router {
  const repository = new DashboardRepository();
  const service = new DashboardService(repository);
  const controller = new DashboardController(service);
  
  const router = Router();
  router.get('/metrics/:vesselId', controller.getMetrics);
  router.get('/summary', controller.getSummary);
  
  return router;
}

// Registration in main app (additive only):
// app.use('/technical/api/v2/dashboard', dashboardV2Router);
```

---

## 8. Frontend API Layer Rules

### 8.1 Rules

| Rule | Detail |
|------|--------|
| **One API file for dashboard** | `dashboardApi.ts` |
| **Toggle decides Legacy vs V2** | `getDashboardApiMode()` reads `localStorage('dashboard_api_version')` |
| **No direct fetch calls in Dashboard.tsx** | Dashboard consumes `useDashboard` hook, hook consumes API file |
| **UI behavior must remain unchanged** | Same KPI values, same chart data, same loading states |

### 8.2 API File Pattern

```typescript
// client/src/modules/dashboard/api/dashboardApi.ts

const getMode = () => localStorage.getItem('dashboard_api_version') || 'legacy';

export const dashboardApi = {
  getMetrics: async (vesselId: string) => {
    if (getMode() === 'v2') {
      // V2: Single call returns all pre-computed KPIs
      const res = await fetch(`/technical/api/v2/dashboard/metrics/${vesselId}`);
      return res.json();
    }
    // Legacy: Multiple calls + client-side computation (existing behavior)
    return null; // Signal to hook to use legacy multi-query pattern
  },

  getSummary: async () => {
    if (getMode() === 'v2') {
      const res = await fetch('/technical/api/v2/dashboard/summary');
      return res.json();
    }
    return null;
  },
};
```

### 8.3 Hook Pattern

```typescript
// client/src/modules/dashboard/hooks/useDashboard.ts

export function useDashboard(vesselId: string) {
  const mode = localStorage.getItem('dashboard_api_version') || 'legacy';
  const isAllVessels = vesselId === 'all';

  if (mode === 'v2') {
    // V2 mode: Single query returns all metrics
    const endpoint = isAllVessels
      ? '/technical/api/v2/dashboard/summary'
      : `/technical/api/v2/dashboard/metrics/${vesselId}`;

    return useQuery({
      queryKey: ['/technical/api/v2/dashboard', vesselId],
      queryFn: () => fetch(endpoint).then(r => r.json()),
      enabled: !!vesselId,
    });
  }

  // Legacy mode: Multiple queries + client-side computation (unchanged from current Dashboard.tsx)
  // ... existing useQuery calls preserved exactly as-is
}
```

### 8.4 Toggle Key

**Storage:** `localStorage` key: `dashboard_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

This is a **separate toggle** from the Fleet module toggle (`fleet_api_version`) and Component module toggle (`pms_api_version`), allowing independent rollout.

---

## 9. Toggle Mechanism

### 9.1 How Legacy and V2 Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (always registered):                      │
│    /technical/api/work-orders*                            │
│    /technical/api/spares/*                                │
│    /technical/api/stores/*                                │
│    /technical/api/components/*                            │
│    /technical/api/vessels                                 │
│    (Dashboard has NO dedicated legacy routes)             │
│                                                          │
│  V2 Routes (always registered, additive):                │
│    /technical/api/v2/dashboard/metrics/:vesselId          │
│    /technical/api/v2/dashboard/summary                    │
│                                                          │
│  V2 routes call the SAME storage methods                 │
│  as the existing module routes:                          │
│    storage.getWorkOrders()                                │
│    storage.getSpares()                                    │
│    storage.getComponents()                                │
│    storage.getStoresItems()                               │
│                                                          │
│  ZERO new database tables:                               │
│    Uses work_orders, components, spares,                  │
│    stores_items, vessels — all existing                   │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Key Difference from Other Modules

Unlike Fleet or Component V2 modules, the Dashboard toggle does **not** switch between two sets of routes that perform the same operation. Instead:

- **Legacy mode**: Dashboard.tsx makes 4+ individual API calls to existing module endpoints and computes KPIs client-side (unchanged behavior)
- **V2 mode**: Dashboard.tsx makes 1 API call to a *new* aggregation endpoint that returns pre-computed KPIs from the server

Both modes produce **identical KPI values**. The difference is where computation happens (client vs server).

### 9.3 Instant Rollback

**Zero data loss**: V2 dashboard endpoints are read-only aggregation endpoints. They create no data, modify no tables. Switching modes is purely a URL routing change. No data migration, no data divergence.

---

## 10. Critical Enforcement Rules

### 10.1 Architecture Enforcement

| Rule | Detail |
|------|--------|
| **No functional or logical changes** | V2 KPI values must be bit-for-bit identical to client-side computations |
| **No data model changes** | No new tables, no new columns — purely aggregation |
| **No legacy code modification** | All V2 code in new files under `server/v2/dashboard/`, `client/src/modules/dashboard/` |
| **No cross-module coupling** | Dashboard V2 must not import from Fleet V2 or Component V2 modules |
| **Additive only** | V2 routes are registered alongside existing routes, not replacing them |

### 10.2 Layer Boundary Enforcement

| Rule | Layer |
|------|-------|
| **Repository: DB only** | Only layer that imports `storage`. No business logic. |
| **Service: logic only** | No HTTP objects. No `storage` import. KPI formulas only. |
| **Controller: HTTP only** | Extracts req params, calls service, maps errors to status codes. |
| **Routes: wiring only** | Maps HTTP methods + paths to controller methods. |

### 10.3 KPI Parity Enforcement

| Rule | Detail |
|------|--------|
| **Formula extraction** | Service methods must be line-by-line copies of Dashboard.tsx `useMemo` logic |
| **No formula "improvements"** | Do not fix perceived bugs in KPI calculations during V2 migration |
| **Same edge cases** | Null filtering (`wo !== null && wo !== undefined`), same default values |
| **Same date parsing** | `parseFlexibleDate` must handle both ISO and DD-MMM-YYYY formats identically |

---

## 11. Phased Migration Plan

### Phase 1 — Backend Aggregation Endpoint (Server Only)

**Goal:** Create V2 folder structure, repository, service, controller, and routes for dashboard metrics aggregation. Extract KPI computation logic from Dashboard.tsx to server-side service.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 1.1 | Create `server/v2/dashboard/` directory structure | New directories | None |
| 1.2 | Create `types.ts` with response type definitions matching current client-side computed shapes | New file | None |
| 1.3 | Implement `dashboardRepository.ts` — thin wrapper around existing storage methods | New file | None |
| 1.4 | Implement `dashboardService.ts` — extract all KPI formulas from Dashboard.tsx useMemo hooks | New file | None |
| 1.5 | Implement `dashboardController.ts` — HTTP handler for metrics and summary | New file | None |
| 1.6 | Create `routes.ts` with 2 route definitions | New file | None |
| 1.7 | Create `index.ts` module entry point | New file | None |
| 1.8 | Register V2 dashboard routes in Express app | Additive to server startup | Low — additive only |

**Validation:**
- [ ] `GET /technical/api/v2/dashboard/metrics/:vesselId` returns JSON with all KPI fields
- [ ] Work order KPIs match client-side computation exactly (compare field by field)
- [ ] Spares KPIs match: total, lowStock, critical, criticalLowStock counts identical
- [ ] Stores KPIs match: total, lowStock, stores/lubes/chemicals/others breakdown identical
- [ ] Components KPIs match: total, active counts identical
- [ ] Outstanding tasks percentage matches client-side computation
- [ ] Chart data arrays match (same segments, same counts, same colors)
- [ ] `GET /technical/api/v2/dashboard/summary` returns fleet-wide aggregation
- [ ] Summary results match the "all vessels" iteration pattern in Dashboard.tsx
- [ ] Legacy routes remain completely unaffected

### Phase 2 — Frontend API Layer + Hook

**Goal:** Create toggle-aware frontend API and unified dashboard hook that replaces 4+ separate `useQuery` calls.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 2.1 | Create `client/src/modules/dashboard/api/dashboardApi.ts` | New file | None |
| 2.2 | Create `client/src/modules/dashboard/hooks/useDashboard.ts` | New file | None |
| 2.3 | Update `Dashboard.tsx` to use `useDashboard` hook (toggle-aware) | Minimal change to existing file | Low — only import/hook swap |

**Validation:**
- [ ] In Legacy mode: Dashboard.tsx behaves exactly as before (4+ API calls, client-side computation)
- [ ] In V2 mode: Dashboard.tsx makes single API call, displays pre-computed KPIs
- [ ] All KPI cards show identical values in both modes
- [ ] All charts render identically in both modes
- [ ] Loading states work correctly in both modes
- [ ] "All Vessels" aggregation works in both modes

### Phase 3 — Toggle Integration & Validation

**Goal:** Add toggle UI, final validation, and documentation.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 3.1 | Create `DashboardApiToggle.tsx` toggle UI component | New file | None |
| 3.2 | Add toggle to Dashboard page header | `Dashboard.tsx` — minimal change | Low |
| 3.3 | End-to-end testing: toggle between modes, verify KPI parity | Manual test | None |
| 3.4 | Performance comparison: measure load times Legacy vs V2 | Manual test | None |

**Validation:**
- [ ] Toggle defaults to "Legacy" mode
- [ ] Switching to V2 mode: dashboard loads correctly with single API call
- [ ] Switching back to Legacy mode: dashboard loads correctly with multiple API calls
- [ ] No visual differences between modes
- [ ] V2 mode shows measurable performance improvement (fewer network requests)
- [ ] Bulk approve functionality works identically in both modes
- [ ] Navigation handlers (to work orders, spares, stores, etc.) work identically in both modes

---

## 12. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌─────────────────┐                                             │
│  │ Dashboard Toggle │  localStorage: 'dashboard_api_version'     │
│  │                  │  = 'v2' | 'legacy'                         │
│  └──────┬──────────┘                                             │
│         │                                                        │
│         ▼                                                        │
│  ┌────────────────────┐                                          │
│  │ useDashboard hook  │  reads toggle to decide fetch strategy   │
│  └──────┬─────────────┘                                          │
│         │                                                        │
│    ┌────┴────┐                                                   │
│    │         │                                                   │
│    ▼         ▼                                                   │
│  Legacy    V2 URL                                                │
│  (4+ calls)  /technical/api/v2/dashboard/metrics/:vesselId       │
│  /technical/api/work-orders?vesselId=X                           │
│  /technical/api/spares/:vesselId                                 │
│  /technical/api/stores/:vesselId                                 │
│  /technical/api/components/:vesselId                             │
└────┬─────────┬───────────────────────────────────────────────────┘
     │         │
     ▼         ▼
┌────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  Legacy Handlers              V2 Handler                         │
│  (routes.ts — existing        (v2/dashboard/routes.ts)           │
│   module endpoints)           Controller → Service → Repository  │
│  Return raw data                      │                          │
│         │                             │                          │
│         └──────────┬──────────────────┘                          │
│                    ▼                                             │
│          ┌─────────────────┐                                     │
│          │ storage.*()     │  SAME storage methods                │
│          │ getWorkOrders() │  SAME database tables                │
│          │ getSpares()     │  SAME data                           │
│          │ getComponents() │                                      │
│          └────────┬────────┘                                     │
│                   ▼                                              │
│          ┌────────────────┐                                      │
│          │  PostgreSQL    │                                       │
│          │  work_orders   │  ← existing tables, shared           │
│          │  spares        │                                       │
│          │  components    │                                       │
│          │  stores_items  │                                       │
│          └────────────────┘                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Risk Points & Rollback Strategy

### 13.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| KPI calculation logic drift between FE and BE | Medium | Extract exact formulas from Dashboard.tsx `useMemo` hooks to `dashboardService.ts` — line-by-line copy, no "improvements" |
| Response shape differs from current client-side computed objects | Medium | Define TypeScript types in `types.ts` matching current client-side shapes; validate field-by-field |
| Performance regression with large datasets | Medium | Server-side aggregation should be faster than client-side; add caching with TTL if needed |
| Vessel "all" aggregation correctness | Medium | Test with multi-vessel data; compare V2 summary output against Legacy "all vessels" iteration |
| `parseFlexibleDate` divergence | Low | Copy the exact function from Dashboard.tsx L331–L353 to service layer |
| `computedStatus` field availability | Low | Verify work orders returned by storage include `computedStatus` field (may need hydration) |

### 13.2 Rollback Strategy

| Scenario | Action |
|----------|--------|
| V2 returns incorrect KPI values | User clicks toggle → "Legacy" → instant fallback to client-side computation |
| V2 has performance issues | Toggle to Legacy → no restart needed |
| V2 causes errors | Not possible to corrupt data — endpoints are read-only aggregation |
| Need to remove V2 entirely | Delete V2 files, remove route registration — zero impact on legacy |

---

## 14. Validation Checklist

### 14.1 KPI Parity Validation

For each KPI, compare V2 API response against client-side `useMemo` output:

**Work Order KPIs:**
- [ ] `total` count matches (non-execution work orders)
- [ ] `overdue` count matches (`computedStatus === 'Overdue'`, not execution)
- [ ] `due` count matches (`computedStatus === 'Due' || 'Due (Grace P)'`, not execution)
- [ ] `pendingApproval` count matches (`computedStatus === 'Pending Approval'`)
- [ ] `completed` count matches (`computedStatus === 'Completed'`)
- [ ] `active` count matches (`computedStatus === 'Active' || 'Postponed'`, not execution)
- [ ] `overdueList` contains first 5 overdue items
- [ ] `dueList` contains first 5 due items
- [ ] `pendingApprovalList` contains first 5 pending approval items
- [ ] `pendingApprovalFull` contains all pending approval items (for bulk approve)

**Spares KPIs:**
- [ ] `total` count matches
- [ ] `lowStock` count matches (rob < min OR rob === min)
- [ ] `critical` count matches (critical === 'Critical' OR 'Yes')
- [ ] `criticalLowStock` count matches (intersection of low stock and critical)
- [ ] `lowStockList` contains first 5 low stock items
- [ ] `criticalLowStockList` contains first 5 critical low stock items

**Stores KPIs:**
- [ ] `total` count matches
- [ ] `lowStock` count matches
- [ ] `stores` count matches (itemType === 'stores')
- [ ] `lubes` count matches (itemType === 'lubes')
- [ ] `chemicals` count matches (itemType === 'chemicals')
- [ ] `others` count matches (itemType === 'others')

**Components KPIs:**
- [ ] `total` count matches
- [ ] `active` count matches (isActive !== false)

**Outstanding Tasks:**
- [ ] Current month filter works correctly
- [ ] Outstanding count matches (non-completed tasks due in current month)
- [ ] Completed count matches
- [ ] Percentage calculation matches

**Chart Data:**
- [ ] Work order status chart segments match (status, count, color)
- [ ] Spares stock chart segments match (status, count, color)
- [ ] Zero-count segments filtered out in both modes

### 14.2 "All Vessels" Aggregation Validation

- [ ] V2 summary endpoint returns same totals as Legacy "all vessels" iteration
- [ ] No duplicate counting across vessels
- [ ] Performance is equal or better than N+1 sequential calls

### 14.3 Frontend Validation

- [ ] Toggle defaults to Legacy
- [ ] Dashboard works in Legacy mode (unchanged from current behavior)
- [ ] Dashboard works in V2 mode (single API call, pre-computed KPIs)
- [ ] Toggle switch causes no data loss or visual glitches
- [ ] No visual differences between modes
- [ ] All clickable KPI cards navigate correctly in both modes
- [ ] Vessel selector works in both modes
- [ ] Bulk approve modal works in both modes (receives full pending approval list)
- [ ] Loading/skeleton states display correctly in both modes

---

## Appendix A: Comparison with Other V2 Modules

| Aspect | Component V2 | Fleet V2 | Dashboard V2 |
|--------|-------------|----------|-------------|
| Toggle key | `pms_api_version` | `fleet_api_version` | `dashboard_api_version` |
| Inline business logic complexity | High (RH validation, cascade) | Medium (field sanitization, auto-code) | Low (KPI aggregation only) |
| Number of entities | 1 (+ 4 sub-entities) | 12+ entities | 0 (aggregation only) |
| Route handlers (legacy) | ~30 | ~78 | **0** (no dedicated routes) |
| Route handlers (V2) | ~30 | ~78 | **2** |
| Storage methods (dedicated) | ~25 | ~50+ | **0** (reuses existing) |
| Frontend pages affected | 1 (`Components.tsx`) | 11+ fleet admin pages | **1** (`Dashboard.tsx`) |
| Database tables (dedicated) | 1 (`components`) | 10+ fleet tables | **0** |
| Excel export | None | 3 exports | None |
| Bulk upload | 1 | 3 | None |
| CRUD operations | Full CRUD | Full CRUD | **Read-only** (aggregation) |
| V2 file count | ~20+ | ~40+ | **9** |
| Migration phases | 5 | 5 | **3** |

---

## Appendix B: Response Type Definitions

```typescript
// server/v2/dashboard/types.ts

export interface StockStatus {
  label: 'OK' | 'At Min' | 'Low';
  isLow: boolean;
}

export interface ChartDataPoint {
  status: string;
  count: number;
  color: string;
}

export interface WorkOrderKPIs {
  total: number;
  overdue: number;
  overdueList: any[];          // First 5 overdue work orders
  due: number;
  dueList: any[];              // First 5 due work orders
  pendingApproval: number;
  pendingApprovalList: any[];  // First 5 pending approval work orders
  pendingApprovalFull: any[];  // All pending approval work orders (for bulk approve)
  completed: number;
  active: number;              // Planned (Active + Postponed)
}

export interface SparesKPIs {
  total: number;
  lowStock: number;
  lowStockList: any[];         // First 5 low stock spares
  critical: number;
  criticalLowStock: number;
  criticalLowStockList: any[]; // First 5 critical low stock spares
}

export interface StoresKPIs {
  total: number;
  lowStock: number;
  lowStockList: any[];         // First 5 low stock stores items
  stores: number;              // Count of itemType === 'stores'
  lubes: number;               // Count of itemType === 'lubes'
  chemicals: number;           // Count of itemType === 'chemicals'
  others: number;              // Count of itemType === 'others'
}

export interface ComponentsKPIs {
  total: number;
  active: number;              // isActive !== false
}

export interface OutstandingTasksData {
  data: Array<{
    status: string;
    count: number;
    percent: number;
    color: string;
  }>;
  totalMonthly: number;
  outstandingCount: number;
  completedCount: number;
  outstandingPercent: number;
}

export interface DashboardMetrics {
  workOrderKPIs: WorkOrderKPIs;
  sparesKPIs: SparesKPIs;
  storesKPIs: StoresKPIs;
  componentsKPIs: ComponentsKPIs;
  outstandingTasks: OutstandingTasksData;
  workOrderStatusChart: ChartDataPoint[];
  sparesStockChart: ChartDataPoint[];
}
```

---

## Appendix C: Dashboard.tsx — Key Business Logic Reference

### C.1 Date Parsing (L331–L353)

```typescript
const parseFlexibleDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr || dateStr === '' || dateStr === '—') return null;
  
  // Try ISO format first (YYYY-MM-DD or full ISO timestamp)
  let parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // Try DD-MMM-YYYY format (e.g., "22-Nov-2025")
  const legacyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (legacyMatch) {
    const [, day, monthStr, year] = legacyMatch;
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const month = monthMap[monthStr];
    if (month !== undefined) {
      return new Date(parseInt(year), month, parseInt(day));
    }
  }
  
  return null;
};
```

This function **MUST** be copied exactly to `dashboardService.ts` to ensure date handling parity.

### C.2 Work Order Status Semantics

The dashboard groups work orders by `computedStatus` field values:

| computedStatus Value | Dashboard Category | Included in Total? | Excludes Execution? |
|---------------------|-------------------|--------------------|--------------------|
| `'Overdue'` | Overdue | Yes | Yes |
| `'Due'` | Due | Yes | Yes |
| `'Due (Grace P)'` | Due | Yes | Yes |
| `'Pending Approval'` | Pending Approval | Yes | No |
| `'Completed'` | Completed | Yes | No |
| `'Active'` | Planned | Yes | Yes |
| `'Postponed'` | Planned | Yes | Yes |

### C.3 Stock Status Logic

```
rob < min  → { label: 'Low',    isLow: true  }
rob === min → { label: 'At Min', isLow: true  }
rob > min  → { label: 'OK',     isLow: false }
```

This applies identically to both Spares and Stores items.
