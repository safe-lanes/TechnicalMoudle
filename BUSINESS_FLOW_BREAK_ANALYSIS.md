# Business Flow Break Analysis (PostgreSQL Migration)

**Date**: December 18, 2025  
**Purpose**: Diagnose end-to-end functional flow breakages after migrating from file-based storage to PostgreSQL  
**Scope**: Pure analysis and explanation — NO fixes or code changes

---

## Executive Summary

### What Broke and Why

After migrating from file-based storage to PostgreSQL, **bulk upload flows work correctly at the database level** but **downstream UI modules do not display imported data**. 

**Root Cause**: The bulk upload system **directly populates entity tables** (components, jobs, spares, stores_items) in both storage modes. The issue is **NOT a missing transformation step** — it is likely one of the following:

1. **VesselId Mismatch**: Data is saved with a different vesselId than what the UI is querying
2. **isActive Flag**: Components/entities may be created with `isActive: false` or undefined
3. **Query Parameter Mismatch**: UI endpoints expect specific query parameters that don't match imported data
4. **Cache Invalidation**: Frontend TanStack Query cache not being invalidated after bulk import

The **import_history table is purely for audit/logging purposes** — it does NOT stage data for later processing.

---

## 1. File-Based Storage Flow (Historical - How It Worked)

### Architecture Overview

When using file-based storage (`memStorage.ts`), the system used a single JSON file (`test-data.json`) as the data store:

```
test-data.json
├── components: { [id]: Component }
├── jobs: { [id]: Job }
├── spares: { [id]: Spare }
├── storesItems: { [id]: StoresItem }
├── importHistory: { [id]: ImportHistory }
└── ...other entities
```

### Bulk Upload Flow (File-Based Mode)

```
Step 1: User uploads Excel file via POST /api/bulk/import
        ↓
Step 2: server/routes/bulk.ts receives file
        ↓
Step 3: File is parsed (XLSX → JSON rows)
        ↓
Step 4: Validation (validateBulkData function)
        ↓
Step 5: performImport() is called with validated data
        ↓
Step 6: For each entity type, entities are DIRECTLY created:
        - type='components' → storage.createComponent() called per row
        - type='jobs' → storage.createJob() called per row
        - type='spares' → storage.createSpare() called per row
        - type='stores' → storage.createStoresItem() called per row
        ↓
Step 7: storeImportHistory() records audit trail in import_history
        ↓
Step 8: Response returned with created/updated/skipped counts
```

### Key Observation: Direct Entity Population

In file-based mode, `memStorage.createComponent()` did:
```typescript
async createComponent(component: any): Promise<any> {
  if (!this.data.components) this.data.components = {};
  this.data.components[component.id] = component;  // DIRECTLY saves to components
  this.saveData();  // Writes to test-data.json
  return component;
}
```

**There was NO transformation layer**. Data flowed directly from Excel → Entity Tables.

### Why File-Based Mode "Worked"

1. **Single Source of Truth**: All data lived in one file
2. **Immediate Visibility**: `getComponents()` read from the same `this.data.components` object
3. **No Transaction Boundaries**: Changes were immediately visible
4. **Simple VesselId**: Often defaulted to 'V001' everywhere

---

## 2. PostgreSQL Flow (Current Implementation)

### Architecture Overview

After PostgreSQL migration, entities are stored in separate database tables:

```
PostgreSQL Database
├── components (table)
├── jobs (table)
├── spares (table)
├── stores_items (table)
├── import_history (table) ← Audit only
├── import_change_log (table) ← Change tracking
└── ...other tables
```

### Bulk Upload Flow (PostgreSQL Mode)

The flow is **architecturally identical** to file-based mode:

```
Step 1: User uploads Excel file via POST /api/bulk/import
        ↓
Step 2: server/routes/bulk.ts receives file
        ↓
Step 3: File is parsed (XLSX → JSON rows)
        ↓
Step 4: Validation (validateBulkData function)
        ↓
Step 5: performImport() is called with validated data
        ↓
Step 6: For each entity type, entities are DIRECTLY created:
        - type='components' → storage.createComponent() → PostgreSQL INSERT
        - type='jobs' → storage.createJob() → PostgreSQL INSERT
        - type='spares' → storage.createSpare() → PostgreSQL INSERT
        - type='stores' → storage.createStoresItem() → PostgreSQL INSERT
        ↓
Step 7: storeImportHistory() records audit in import_history table
        ↓
Step 8: Response returned with created/updated/skipped counts
```

### PostgreSQL Storage Implementation

From `postgresStorage.ts`:
```typescript
async createComponent(component: InsertComponent): Promise<Component> {
  const db = await getDb();
  const result = await db.insert(components).values({
    ...component,
    id: component.id || uuidv4(),
    // ... field mappings
  }).returning();
  return result[0];  // DIRECTLY returns created component
}
```

### Role of Tables

| Table | Purpose | Role in Flow |
|-------|---------|--------------|
| `components` | Entity storage | **Authoritative** - WHERE components live |
| `jobs` | Entity storage | **Authoritative** - WHERE jobs live |
| `spares` | Entity storage | **Authoritative** - WHERE spares live |
| `stores_items` | Entity storage | **Authoritative** - WHERE stores live |
| `import_history` | Audit logging | **Metadata only** - WHO imported WHAT WHEN |
| `import_change_log` | Change tracking | **Undo support** - Captures before/after for rollback |

**Critical Point**: `import_history` and `import_change_log` are for **audit and undo** functionality only. They do NOT stage data for later processing.

---

## 3. Gap Analysis: The Exact Problem

### What IS Happening

Based on code analysis:

1. **Bulk upload API is called** ✅
2. **Data IS being saved to entity tables** ✅ (confirmed by logs showing "created: X, updated: Y")
3. **Import history IS being recorded** ✅ (visible via GET /api/bulk/history)
4. **UI fetch endpoints return empty results** ❌

### What IS NOT Happening

The gap is NOT in the bulk upload process itself. The bulk upload **DOES populate entity tables directly**.

### Likely Causes of UI Not Showing Data

#### Cause 1: VesselId Mismatch

**File: `server/routes/bulk.ts` lines 3358-3359**:
```typescript
const parentComponent = await storage.createComponent({
  // ...
  vesselId: vesselId || 'V001',  // Uses passed vesselId OR defaults to 'V001'
```

**File: `server/routes.ts` line 72-74**:
```typescript
app.get("/api/components/:vesselId", async (req, res) => {
  const components = await storage.getComponents(req.params.vesselId);
```

**Gap**: If bulk upload uses `vesselId: 'V001'` but UI queries `/api/components/V002`, data won't appear.

#### Cause 2: isActive Flag Filtering

**From PostgreSQL storage**:
```typescript
async getComponents(vesselId: string): Promise<Component[]> {
  const db = await getDb();
  return await db.select().from(components)
    .where(and(
      eq(components.vesselId, vesselId),
      eq(components.isActive, true)  // Only returns active components
    ));
}
```

**Gap**: If bulk import creates components with `isActive: undefined` or `false`, they won't appear.

#### Cause 3: Query Parameter Issues

The API has multiple component endpoints:
- `GET /api/components/:vesselId` - Expects vesselId as path param
- `GET /api/components` - Returns all for default vessel
- `GET /api/components/:id` - Single component by ID

**Gap**: UI might be calling wrong endpoint or with wrong parameters.

#### Cause 4: Frontend Cache Not Invalidated

After bulk import, the frontend needs to invalidate TanStack Query cache:
```typescript
queryClient.invalidateQueries({ queryKey: ['/api/components'] });
```

**Gap**: If cache invalidation isn't triggered, UI shows stale (empty) data.

---

## 4. Module-by-Module Impact Analysis

### Components Module

| Aspect | Expected Behavior | Actual Behavior | Root Cause |
|--------|-------------------|-----------------|------------|
| Bulk Import | Excel rows → `components` table | Data IS saved to DB | Working |
| UI Fetch | GET `/api/components/V001` → Components list | Empty or wrong data | VesselId mismatch OR isActive filter |
| Import History | Visible in bulk history UI | Working | N/A |

**UI Endpoint**: `GET /api/components/:vesselId`
**Storage Method**: `storage.getComponents(vesselId)` filters by `vesselId` AND `isActive: true`

### Jobs Module

| Aspect | Expected Behavior | Actual Behavior | Root Cause |
|--------|-------------------|-----------------|------------|
| Bulk Import | Excel rows → `jobs` table | Data IS saved to DB | Working |
| UI Fetch | GET `/api/jobs?vesselId=X` → Jobs list | Empty or wrong data | ComponentId linkage OR vesselId filter |
| Component Reference | Jobs linked to valid components | May fail if component doesn't exist | Validation gap |

**Key Dependency**: Jobs require valid `componentId` reference. If component upload fails or uses different vesselId, job linkage breaks.

### Spares Module

| Aspect | Expected Behavior | Actual Behavior | Root Cause |
|--------|-------------------|-----------------|------------|
| Bulk Import | Excel rows → `spares` table | Data IS saved to DB | Working |
| UI Fetch | GET `/api/spares?vesselId=X` → Spares list | Empty or wrong data | ComponentId linkage OR vesselId filter |
| Component Reference | Spares linked to valid components | May fail if component doesn't exist | Validation gap |

**Key Dependency**: Spares require valid `componentId` and `componentCode`. From bulk.ts line 3501:
```typescript
const component = componentsByCode.get(componentCode);
if (!component) {
  console.warn(`⚠️ Component ${componentCode} not found in system, skipping spare`);
  result.skipped++;
  continue;
}
```

### Stores Module

| Aspect | Expected Behavior | Actual Behavior | Root Cause |
|--------|-------------------|-----------------|------------|
| Bulk Import | Excel rows → `stores_items` table | Data IS saved to DB | Working |
| UI Fetch | GET `/api/stores-items?vesselId=X` → Items list | Empty or wrong data | VesselId filter |
| Independent Entity | No component dependency | N/A | N/A |

**Stores are independent** - they don't require component references, so if spares fail but stores also fail, the issue is likely vesselId or isActive filtering.

---

## 5. Why Data Exists in DB But Does Not Appear in UI

### Primary Statement

**"Data exists in database but does not appear in UI"** can occur due to:

1. **VesselId Filtering Mismatch**
   - Bulk import saves with vesselId X
   - UI queries with vesselId Y
   - Result: Empty response

2. **isActive Flag Filtering**
   - Entities created with `isActive: false` or `null`
   - `getComponents()`, `getJobs()`, `getSpares()` filter by `isActive: true`
   - Result: Data exists but is filtered out

3. **Frontend Cache Staleness**
   - Data successfully saved to PostgreSQL
   - Frontend TanStack Query cache not invalidated
   - UI shows cached (pre-import) state
   - Result: Appears empty until cache expires or page refresh

4. **Component Dependency Chain Failure**
   - Components import fails or uses wrong vesselId
   - Jobs/Spares import succeeds but references invalid componentId
   - Jobs/Spares exist in DB but show errors in UI

5. **Transaction Isolation**
   - PostgreSQL may have uncommitted transactions
   - Queries on different connections don't see uncommitted data
   - Result: Temporary invisibility (rare in current implementation)

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BULK UPLOAD FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   UPLOAD                    PROCESS                      STORAGE             │
│  ┌───────┐               ┌──────────┐               ┌──────────────┐        │
│  │ Excel │───────────────│ bulk.ts  │───────────────│ PostgreSQL   │        │
│  │ File  │  POST /bulk/  │ parseXLS │  performImport│ ┌──────────┐ │        │
│  └───────┘   import      │ validate │───────────────│ │components│ │        │
│                          │          │  createComp() │ └──────────┘ │        │
│                          │          │               │ ┌──────────┐ │        │
│                          │          │───────────────│ │   jobs   │ │        │
│                          │          │  createJob()  │ └──────────┘ │        │
│                          │          │               │ ┌──────────┐ │        │
│                          │          │───────────────│ │  spares  │ │        │
│                          │          │  createSpare()│ └──────────┘ │        │
│                          │          │               │ ┌──────────┐ │        │
│                          │          │───────────────│ │  stores  │ │        │
│                          │          │ createStores()│ └──────────┘ │        │
│                          │          │               │              │        │
│                          │          │               │ ┌──────────┐ │        │
│                          │          │───────────────│ │ import_  │ │        │
│                          └──────────┘ storeHistory()│ │ history  │ │        │
│                                                     │ └──────────┘ │        │
│                                                     └──────────────┘        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                            UI FETCH FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   UI PAGE                   API                        STORAGE              │
│  ┌───────────┐          ┌──────────┐               ┌──────────────┐         │
│  │Components │──────────│GET /api/ │───────────────│ PostgreSQL   │         │
│  │  Page     │  query   │components│ getComponents │ ┌──────────┐ │         │
│  └───────────┘  params: │/:vesselId│ (vesselId,    │ │components│ │         │
│                 vesselId└──────────┘  isActive:true)│ └──────────┘ │         │
│                                                     └──────────────┘         │
│                                                                              │
│  ⚠️ POTENTIAL GAPS:                                                          │
│     1. vesselId in query ≠ vesselId in data                                 │
│     2. isActive filter excludes data                                        │
│     3. Frontend cache not invalidated                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. What Logic Existed in File-Based Storage That May Be Missing

### The Answer: NONE

There was **no transformation layer** in file-based storage. Both modes use the same flow:

1. `performImport()` calls `storage.createComponent()`
2. Entity is saved to storage (file or PostgreSQL)
3. `getComponents()` reads from storage

The difference is in **how the storage layer queries data**:

| Aspect | File-Based (memStorage) | PostgreSQL (postgresStorage) |
|--------|-------------------------|------------------------------|
| Read All | `Object.values(this.data.components)` | `SELECT * FROM components WHERE ...` |
| Filtering | `.filter(c => c.vesselId === vesselId)` | `WHERE vesselId = $1 AND isActive = true` |
| VesselId Default | Often all matched 'V001' | Must match exactly |
| isActive | Not consistently filtered | Filtered by default |

### Critical Difference: PostgreSQL is Stricter

PostgreSQL implementation adds **isActive filtering** that file-based mode didn't have:

```typescript
// postgresStorage.ts getComponents
.where(and(
  eq(components.vesselId, vesselId),
  eq(components.isActive, true)  // ← This filter didn't exist in memStorage
))
```

---

## 8. Verification Queries

To verify this analysis, run these PostgreSQL queries:

### Check if data exists in components table:
```sql
SELECT id, component_code, name, vessel_id, is_active 
FROM components 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check vesselId distribution:
```sql
SELECT vessel_id, COUNT(*) as count 
FROM components 
GROUP BY vessel_id;
```

### Check isActive distribution:
```sql
SELECT is_active, COUNT(*) as count 
FROM components 
GROUP BY is_active;
```

### Check import_history records:
```sql
SELECT id, type, status, created, updated, skipped 
FROM import_history 
ORDER BY started_at DESC 
LIMIT 10;
```

---

## 9. Summary

| Question | Answer |
|----------|--------|
| Is there a missing transformation step? | **NO** - Data flows directly to entity tables |
| Is there a missing service method? | **NO** - All CRUD methods exist |
| Is there a missing background processor? | **NO** - No staging/processing pattern exists |
| What is actually wrong? | **Query filters don't match imported data** |
| Why did file-based work? | **Less strict filtering, single vesselId** |
| Why does PostgreSQL fail? | **Stricter WHERE clauses (vesselId + isActive)** |

---

## ⛔ Next Steps (Awaiting Your Instruction)

This analysis is complete. I will **NOT**:
- Fix anything
- Generate code
- Propose solutions
- Modify schema

**Awaiting your explicit instruction to proceed.**

When ready, you may say:
> "Proceed to fix bulk-upload orchestration for Postgres"
