# Components Table ↔ UI Mapping Analysis

This document explains how the **Components UI sub-module** is backed by the database, focusing on the `components` table and related tables. This is for analysis and debugging purposes only.

---

## Table of Contents
1. [Components Table Overview](#1-components-table-overview)
2. [UI → API → DB Flow](#2-ui--api--db-flow)
3. [Component Tree Construction Logic](#3-component-tree-construction-logic)
4. [Relationship to Other Sub-Sections](#4-relationship-to-other-sub-sections)
5. [Common Failure/Mismatch Points](#5-common-failuremismatch-points)

---

## 1. Components Table Overview

### Purpose
The `components` table stores all vessel equipment/machinery data in the PMS system. It supports:
- **Vessel-specific components** (`dataScope = 'vessel'`) - actual equipment on a specific vessel
- **Fleet template components** (`dataScope = 'fleet'`) - master templates for fleet-wide equipment

### Schema Definition

```typescript
// Located in: shared/schema.ts (lines 132-189)
export const components = pgTable("components", {
  id: text("id").primaryKey(),
  name: text("name"),                              // Component display name
  componentCode: text("component_code"),           // SFI-based code (e.g., "401.005")
  parentId: text("parent_id"),                     // Parent component code (for hierarchy)
  category: text("category"),                      // Category classification
  currentCumulativeRH: decimal(...),               // Current running hours
  lastUpdated: text("last_updated"),
  vesselId: text("vessel_id"),                     // Foreign key to vessels table
  vesselCode: text("vessel_code"),
  dataScope: text("data_scope").default("vessel"), // 'fleet' | 'vessel' discriminator
  
  // Fleet Equipment fields
  fleetEquipmentCode: text("fleet_equipment_code"),
  fleetEquipmentName: text("fleet_equipment_name"),
  parentFleetEquipmentCode: text("parent_fleet_equipment_code"),
  
  // Maker and Model
  maker: text("maker"),
  makerCode: text("maker_code"),
  model: text("model"),
  modelNumber: text("model_number"),
  modelCode: text("model_code"),
  serialNo: text("serial_no"),
  drawingNo: text("drawing_no"),
  
  // Department and categorization
  department: text("department"),
  deptCategory: text("dept_category"),
  componentCategory: text("component_category"),
  location: text("location"),
  eqptSystemDept: text("eqpt_system_dept"),
  
  // Dates
  commissionedDate: text("commissioned_date"),     // DD-MM-YYYY format
  installationDate: text("installation_date"),
  
  // Status flags (boolean)
  critical: boolean("critical").default(false),
  classItem: boolean("class_item").default(false),
  conditionBased: boolean("condition_based").default(false),
  isActive: boolean("is_active").default(true),
  isParent: boolean("is_parent").default(false),  // Has children
  
  // Technical specifications
  rating: text("rating"),
  noOfUnits: text("no_of_units"),
  parentComponent: text("parent_component"),
  dimensionsSize: text("dimensions_size"),
  notes: text("notes"),
  runningHours: decimal("running_hours"),
  
  // Fleet-specific
  applicableVesselIds: text("applicable_vessel_ids").array(),
  scopeNotes: text("scope_notes"),
  
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

### Key Columns and UI Representation

| Column | Mandatory | UI Location | Description |
|--------|-----------|-------------|-------------|
| `id` | Yes | Internal | Primary key (auto-generated or from import) |
| `componentCode` | Yes* | Left tree + Detail panel Row 1 | SFI-based code (e.g., "401.005") |
| `name` | Yes* | Left tree + Detail panel Row 2 | Display name in tree and header |
| `vesselId` | Yes* | Filtered by vessel dropdown | Associates component with vessel |
| `vesselCode` | No | Detail panel Row 5 | Vessel code display |
| `parentId` | No | Detail panel Row 1 | Parent component code for hierarchy |
| `componentCategory` | No | Detail panel Row 2 | Category from SFI classification |
| `critical` | No | Detail panel Row 4 | Red badge if "Yes" |
| `conditionBased` | No | Detail panel Row 4 | Blue badge if "Yes" |
| `maker`, `makerCode` | No | Detail panel Row 2 | Manufacturer info |
| `model`, `modelCode` | No | Detail panel Row 3 | Equipment model info |
| `serialNo`, `drawingNo` | No | Detail panel Row 3 | Technical identifiers |
| `location` | No | Detail panel Row 4 | Physical location |
| `installationDate` | No | Detail panel Row 4 | Date component installed |
| `commissionedDate` | No | Detail panel Row 5 | Date commissioned |
| `rating` | No | Detail panel Row 5 | Capacity/rating |
| `eqptSystemDept` | No | Detail panel Row 5 | Equipment/System Department |
| `currentCumulativeRH` | No | Detail panel Row 5 | Running hours display |
| `isActive` | No | Detail panel Row 5 | Active status badge |
| `dataScope` | Yes | Internal | 'vessel' for vessel components |

*Mandatory when `dataScope = 'vessel'`

### Hierarchy Representation

Parent-child relationships are represented using `parentId`:

```
parentId = "401"      →  Component belongs to parent with componentCode "401"
parentId = null/empty →  Root-level component (or main category)
parentId = "0"        →  Also treated as root-level
```

**Important**: `parentId` stores the **componentCode** of the parent, NOT the `id`.

---

## 2. UI → API → DB Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPONENTS UI                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌─────────────────┐    ┌────────────────────────┐  │
│  │ Vessel Dropdown  │    │ Component Tree  │    │ Component Detail Panel │  │
│  │                  │    │ (Left Side)     │    │ (Right Side)           │  │
│  └────────┬─────────┘    └────────┬────────┘    └───────────┬────────────┘  │
│           │                       │                         │               │
└───────────┼───────────────────────┼─────────────────────────┼───────────────┘
            │                       │                         │
            ▼                       ▼                         ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                                API LAYER                                       │
├───────────────────────────────────────────────────────────────────────────────┤
│  GET /api/components/:vesselId     GET /api/components/details/:id            │
│  GET /api/vessels                  GET /api/jobs?componentId=X                │
│                                    GET /api/spares?componentId=X              │
│                                    GET /api/component-documents/:id           │
│                                    GET /api/component-class-regulatory/:id    │
│                                    GET /api/component-requisitions/:id        │
│                                    GET /api/component-maintenance-history/:id │
└───────────────────────────────────────────────────────────────────────────────┘
            │                       │                         │
            ▼                       ▼                         ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                     │
├───────────────────────────────────────────────────────────────────────────────┤
│  server/routes.ts                 server/services/componentService.ts         │
│  server/storage.ts                                                            │
└───────────────────────────────────────────────────────────────────────────────┘
            │                       │                         │
            ▼                       ▼                         ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (PostgreSQL)                                │
├───────────────────────────────────────────────────────────────────────────────┤
│  components table     │  jobs table        │  spares table                    │
│  vessels table        │  work_orders table │  component_documents             │
│                       │                    │  component_class_regulatory      │
│                       │                    │  component_maintenance_history   │
│                       │                    │  component_requisitions          │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: User Selects a Vessel from Dropdown

**Frontend (Components.tsx):**
```tsx
const { vesselId, setVesselId } = useVessel();
const { data: vessels = [] } = useVessels();

// Vessel selection triggers component fetch
const { data: fetchedComponents = [], isLoading } = useQuery<any[]>({
  queryKey: [`/api/components/${vesselId}`],
});
```

**API Endpoint:**
```
GET /api/components/:vesselId
Example: GET /api/components/V001
```

**Route Handler (server/routes.ts, line 72-85):**
```typescript
app.get("/api/components/:vesselId", async (req, res) => {
  try {
    const components = await storage.getComponents(req.params.vesselId);
    console.log(`📋 GET /api/components/${req.params.vesselId} returning ${components.length} components`);
    res.json(components);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch components" });
  }
});
```

**Storage Query (server/postgresStorage.ts, line 653-660):**
```typescript
async getComponents(vesselId: string): Promise<Component[]> {
  const db = await getDb();
  return await db.select().from(components)
    .where(and(
      eq(components.vesselId, vesselId),      // Filter by vessel
      eq(components.dataScope, 'vessel')       // Only vessel-scope components
    ));
}
```

**SQL Executed:**
```sql
SELECT * FROM components 
WHERE vessel_id = 'V001' 
AND data_scope = 'vessel';
```

### Step 2: User Views Component Tree (Left Side)

The tree is built **entirely in frontend JavaScript** from the fetched components array.

**Tree Construction (Components.tsx, lines 1941-2020):**
```tsx
const componentTreeData = React.useMemo(() => {
  // 1. Start with 8 hardcoded SFI main categories
  const mainCategories: ComponentNode[] = [
    { id: "1", code: "1", name: "1 Ship General", children: [] },
    { id: "2", code: "2", name: "2 Hull", children: [] },
    // ... categories 3-8
  ];
  
  // 2. Build component map for quick lookup
  const componentMap = new Map<string, ComponentNode>();
  mainCategories.forEach(cat => componentMap.set(cat.code, cat));
  
  // 3. Convert fetched components to tree nodes
  clonedComponents.forEach((comp: any) => {
    const code = comp.componentCode || comp.id;
    if (code.match(/^[1-8]$/)) return; // Skip main categories
    
    const node: ComponentNode = {
      ...comp,
      id: code,
      code: code,
      name: comp.name,
      critical: comp.critical === "Yes" || comp.critical === true,
      children: []
    };
    componentMap.set(node.code, node);
  });
  
  // 4. Build parent-child relationships using parentId
  clonedComponents.forEach((comp: any) => {
    if (comp.parentId) {
      let parent = componentMap.get(comp.parentId);
      if (parent) {
        parent.children.push(componentMap.get(comp.componentCode));
      }
    }
  });
  
  return mainCategories;
}, [fetchedComponents]);
```

### Step 3: User Clicks Component for Detail Panel

**Frontend State Update:**
```tsx
const [selectedComponent, setSelectedComponent] = useState<ComponentNode | null>(null);

// On tree node click
onClick={() => setSelectedComponent(node)}
```

**Detail Sections Fetch Related Data:**

| Section | API Endpoint | Query Key |
|---------|--------------|-----------|
| Section A: Component Info | Already in `selectedComponent` | N/A |
| Section B: Jobs | `GET /api/jobs?componentId=X` | `['/api/jobs', { componentId }]` |
| Section C: Running Hours | `GET /api/running-hours/:vesselId` | `['/api/running-hours', vesselId]` |
| Section D: Spares | `GET /api/spares/:vesselId` + filter | `['/api/spares', vesselId]` |
| Section E: Documents | `GET /api/component-documents/:id` | `['/api/component-documents', id]` |
| Section F: Class/Regulatory | `GET /api/component-class-regulatory/:id` | `['/api/component-class-regulatory', id]` |
| Section G: Maintenance History | `GET /api/component-maintenance-history/:id` | `['/api/component-maintenance-history', id]` |
| Section H: Requisitions | `GET /api/component-requisitions/:id` | `['/api/component-requisitions', id]` |

---

## 3. Component Tree Construction Logic

### Approach: Hybrid (DB provides flat data, Frontend builds tree)

The tree construction is a **frontend-only operation**. The database returns a flat list of components, and the frontend builds the hierarchical tree structure.

### Algorithm Steps

```
1. FETCH: Retrieve all components for vessel (flat array)
   ↓
2. INITIALIZE: Create 8 hardcoded SFI main categories as root nodes
   ↓
3. MAP: Build a Map<componentCode, ComponentNode> for O(1) lookups
   ↓
4. ATTACH: For each component with parentId:
   - Find parent in map using parentId
   - Push component to parent.children array
   ↓
5. FALLBACK: Components without matching parent:
   - Derive parent from componentCode prefix (e.g., "401.005" → parent "401")
   - Or attach to main category (e.g., "4" for "4xx.xxx" codes)
```

### Parent-Child Resolution

```typescript
// Primary resolution: Use explicit parentId
if (comp.parentId) {
  let parent = componentMap.get(comp.parentId);
  if (parent) {
    parent.children.push(node);
    placed = true;
  }
}

// Fallback: Derive from componentCode pattern
if (!placed) {
  const code = comp.componentCode;
  if (code && code.includes('.')) {
    // "401.005" → try parent "401"
    const parentCode = code.substring(0, code.lastIndexOf('.'));
    const parent = componentMap.get(parentCode);
    if (parent) {
      parent.children.push(node);
      placed = true;
    }
  }
}

// Final fallback: Attach to main category
if (!placed) {
  const mainCat = code.charAt(0); // "4" from "401.005"
  const mainCategory = componentMap.get(mainCat);
  if (mainCategory) {
    mainCategory.children.push(node);
  }
}
```

### Important Notes

- **No SQL JOINs** for tree building - all in JavaScript
- **8 Main Categories** are hardcoded and always displayed (even if empty)
- **SFI Code Pattern**: Components follow SFI 2.0 coding (XXX.XXX.XX format)
- **Performance**: Uses `React.useMemo` to avoid rebuilding on every render

---

## 4. Relationship to Other Sub-Sections

When a component is selected, the UI fetches related data from multiple tables using the component's identifiers.

### Jobs Relationship

**Foreign Key:** `jobs.componentId` → `components.id`

```typescript
// Query
const jobs = await storage.getJobs(vesselId, componentId);

// SQL
SELECT * FROM jobs 
WHERE component_id = :componentId 
AND vessel_id = :vesselId;
```

| Jobs Column | Description |
|-------------|-------------|
| `componentId` | Links to `components.id` |
| `componentCode` | Denormalized for display |
| `componentName` | Denormalized for display |

### Running Hours Relationship

**Foreign Key:** `running_hours_audit.componentId` → `components.id`

```typescript
// Query
const audits = await storage.getRunningHoursAudits(componentId);

// SQL
SELECT * FROM running_hours_audit 
WHERE component_id = :componentId 
ORDER BY entered_at_utc DESC;
```

The component's `currentCumulativeRH` field stores the latest running hours value.

### Spares Relationship

**Foreign Key:** `spares.componentId` → `components.id`

```typescript
// Query
const spares = await storage.getSpares(vesselId);
// Frontend filters by componentId

// SQL
SELECT * FROM spares 
WHERE vessel_id = :vesselId 
AND deleted = false;

// Frontend filter
spares.filter(s => s.componentId === selectedComponentId)
```

| Spares Column | Description |
|---------------|-------------|
| `componentId` | Links to `components.id` |
| `componentCode` | Denormalized for display |
| `componentName` | Denormalized for display |
| `componentSpareCode` | Format: SP-<ComponentCode>-<NNN> |

### Work Orders Relationship

**Foreign Key:** `work_orders.component` or `work_orders.componentCode`

```typescript
// Query (via job linkage)
const workOrders = await storage.getWorkOrdersByJobId(jobId);

// Or direct query
SELECT * FROM work_orders 
WHERE component_code = :componentCode 
AND vessel_id = :vesselId;
```

### Maintenance History Relationship

**Foreign Key:** `component_maintenance_history.componentId` → `components.id`

```typescript
// Query
const history = await storage.getComponentMaintenanceHistory(componentId);

// SQL
SELECT * FROM component_maintenance_history 
WHERE component_id = :componentId 
ORDER BY date_completed DESC;
```

**Note:** This table is **IMMUTABLE** - no updates or deletes allowed.

### Documents Relationship

**Foreign Key:** `component_documents.componentId` → `components.id`

```typescript
// Query
const docs = await storage.getComponentDocuments(componentId);

// SQL
SELECT * FROM component_documents 
WHERE component_id = :componentId;
```

### Class/Regulatory Relationship

**Foreign Key:** `component_class_regulatory.componentId` → `components.id`

```typescript
// Query
const classData = await storage.getComponentClassRegulatory(componentId);

// SQL
SELECT * FROM component_class_regulatory 
WHERE component_id = :componentId;
```

### Requisitions Relationship

**Foreign Key:** `component_requisitions.componentId` → `components.id`

```typescript
// Query
const reqs = await storage.getComponentRequisitions(componentId);

// SQL
SELECT * FROM component_requisitions 
WHERE component_id = :componentId;
```

### Defects Relationship

**Foreign Key:** `defects.componentId` → `components.id`

```typescript
// Query
const defects = await storage.getDefects({ componentId });

// SQL
SELECT * FROM defects 
WHERE component_id = :componentId;
```

### Entity Relationship Diagram

```
                    ┌─────────────────────┐
                    │      components     │
                    │─────────────────────│
                    │ id (PK)             │
                    │ componentCode       │
                    │ vesselId (FK)       │
                    │ parentId            │
                    │ dataScope           │
                    │ ...                 │
                    └─────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────────┐
        │                     │                         │
        ▼                     ▼                         ▼
┌───────────────┐    ┌───────────────┐         ┌───────────────┐
│     jobs      │    │    spares     │         │    defects    │
│───────────────│    │───────────────│         │───────────────│
│ componentId   │    │ componentId   │         │ componentId   │
│ componentCode │    │ componentCode │         │               │
│ vesselId      │    │ vesselId      │         │ vesselId      │
└───────┬───────┘    └───────────────┘         └───────────────┘
        │
        ▼
┌───────────────┐
│  work_orders  │
│───────────────│
│ jobId         │
│ component     │
│ componentCode │
│ vesselId      │
└───────────────┘
        │
        ▼
┌───────────────────────────────┐
│ component_maintenance_history │
│───────────────────────────────│
│ componentId                   │
│ workOrderId                   │
│ (IMMUTABLE)                   │
└───────────────────────────────┘

┌─────────────────────────────┐     ┌───────────────────────────┐
│    component_documents      │     │ component_class_regulatory│
│─────────────────────────────│     │───────────────────────────│
│ componentId                 │     │ componentId               │
│ componentCode               │     │ componentCode             │
│ vesselCode                  │     │ vesselCode                │
└─────────────────────────────┘     └───────────────────────────┘

┌─────────────────────────────┐     ┌───────────────────────────┐
│   component_requisitions    │     │   running_hours_audit     │
│─────────────────────────────│     │───────────────────────────│
│ componentId                 │     │ componentId               │
│ componentCode               │     │ vesselId                  │
│ vesselCode                  │     │                           │
└─────────────────────────────┘     └───────────────────────────┘
```

---

## 5. Common Failure/Mismatch Points

### 5.1 Components Appearing Under Wrong Vessel

**Root Causes:**

1. **Missing/Incorrect `vesselId`**: Component has wrong or null `vesselId`
   ```sql
   -- Check
   SELECT id, component_code, vessel_id, data_scope 
   FROM components 
   WHERE vessel_id IS NULL OR vessel_id = '';
   ```

2. **DataScope Mismatch**: Component has `dataScope = 'fleet'` instead of `'vessel'`
   ```sql
   -- Check
   SELECT * FROM components 
   WHERE data_scope != 'vessel' 
   AND vessel_id = 'V001';
   ```

3. **Import Error**: Bulk import assigned wrong vessel code
   - Check `import_history` and `import_change_log` tables for the import record

**Code Assumption:**
```typescript
// postgresStorage.ts line 656-658
.where(and(
  eq(components.vesselId, vesselId),     // ← vesselId MUST match
  eq(components.dataScope, 'vessel')      // ← dataScope MUST be 'vessel'
))
```

### 5.2 Component Showing Data Not Belonging to Selected Component

**Root Causes:**

1. **Incorrect `componentId` in Related Tables**: Related data has wrong `componentId`
   ```sql
   -- Check jobs for component
   SELECT * FROM jobs WHERE component_id = 'WRONG-ID';
   
   -- Check spares
   SELECT * FROM spares WHERE component_id = 'WRONG-ID';
   ```

2. **Frontend Filter Bug**: Not filtering by `componentId` after fetch
   ```tsx
   // Incorrect: No filter
   const spares = data.spares;
   
   // Correct: Filter by component
   const spares = data.spares.filter(s => s.componentId === selectedComponent.id);
   ```

3. **ID vs Code Confusion**: Using `componentCode` where `id` is expected or vice versa
   ```typescript
   // Common mistake
   storage.getJobs(vesselId, selectedComponent.code);  // ← Passing code
   
   // Should be
   storage.getJobs(vesselId, selectedComponent.id);    // ← Passing id
   ```

### 5.3 Components Not Appearing in Tree

**Root Causes:**

1. **Invalid Parent Reference**: `parentId` references non-existent component
   ```sql
   -- Find orphaned components
   SELECT c1.id, c1.component_code, c1.parent_id
   FROM components c1
   LEFT JOIN components c2 ON c1.parent_id = c2.component_code 
                          AND c1.vessel_id = c2.vessel_id
   WHERE c1.parent_id IS NOT NULL 
   AND c1.parent_id != '0'
   AND c1.parent_id NOT IN ('1','2','3','4','5','6','7','8')
   AND c2.id IS NULL;
   ```

2. **ComponentCode Format Mismatch**: Code doesn't match expected SFI pattern
   ```typescript
   // Tree construction expects codes like "4", "401", "401.005"
   // Non-matching codes may not be placed correctly
   ```

3. **isActive = false**: Component marked inactive (may be filtered out)
   ```sql
   SELECT * FROM components WHERE is_active = false AND vessel_id = 'V001';
   ```

### 5.4 Related Jobs/Spares Not Loading

**Root Causes:**

1. **ComponentId Mismatch**: Job has different `componentId` than expected
   ```sql
   -- Verify linkage
   SELECT j.job_no, j.component_id, c.id as component_id, c.component_code
   FROM jobs j
   LEFT JOIN components c ON j.component_id = c.id
   WHERE c.id IS NULL;
   ```

2. **Vessel Filter**: Job belongs to different vessel
   ```sql
   SELECT * FROM jobs 
   WHERE component_id = 'COMP-123' 
   AND vessel_id != 'V001';
   ```

3. **DataScope**: Job has `dataScope = 'fleet'`
   ```sql
   SELECT * FROM jobs 
   WHERE component_id = 'COMP-123' 
   AND data_scope = 'fleet';
   ```

### 5.5 Running Hours Not Cascading

**Root Causes:**

1. **Parent Component Not Found**: Child's `parentId` doesn't match parent's `componentCode`
   ```typescript
   // Cascade logic expects:
   child.parentId === parent.componentCode  // Must be equal
   ```

2. **MaintenanceBasis Mismatch**: Job is Calendar-based, not Running Hours-based
   ```sql
   SELECT * FROM jobs 
   WHERE component_id = 'COMP-123' 
   AND maintenance_basis != 'Running Hours';
   ```

### 5.6 Key Code Assumptions

| Assumption | Location | Impact if Violated |
|------------|----------|-------------------|
| `vesselId` is always provided for vessel components | `getComponents()` | Returns empty array |
| `dataScope` defaults to 'vessel' | Schema definition | Fleet components may appear in vessel queries |
| `parentId` stores `componentCode`, not `id` | Tree construction | Tree hierarchy breaks |
| Main categories 1-8 are hardcoded | Frontend tree builder | Missing top-level nodes |
| `componentCode` follows SFI pattern | Tree fallback logic | Components placed incorrectly |
| `id` is used for related table lookups | Storage methods | Wrong data returned |
| Boolean fields may be stored as "Yes"/"No" strings | Import logic | Badge display issues |

### 5.7 Debugging Checklist

```
□ Verify component has correct vesselId
□ Verify component has dataScope = 'vessel'
□ Verify parentId matches parent's componentCode (not id)
□ Verify related jobs have matching componentId
□ Verify related spares have matching componentId
□ Check if component.isActive = true
□ Check browser console for API errors
□ Check server logs for SQL errors
□ Verify component was imported with correct vessel mapping
```

---

## Appendix: File References

| File | Purpose |
|------|---------|
| `shared/schema.ts` (lines 132-189) | Components table schema definition |
| `server/routes.ts` (lines 72-99) | Components API endpoints |
| `server/postgresStorage.ts` (lines 653-700) | Component database queries |
| `server/services/componentService.ts` | Component business logic |
| `server/storage.ts` | Storage interface definition |
| `client/src/pages/pms/Components.tsx` | Components UI page |
| `client/src/pages/pms/Components.tsx` (lines 1941-2020) | Tree construction logic |

---

*Document generated for analysis purposes only. No code changes made.*
