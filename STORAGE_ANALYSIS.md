# Seafarer PMS - Storage System Analysis

> Complete analysis of how the project uses storage, from persistent files to UI data flow.

---

## Table of Contents

1. [Current Persistent Storage](#1-current-persistent-storage)
2. [Storage Logic Implementation Files](#2-storage-logic-implementation-files)
3. [Backend Storage Usage](#3-backend-storage-usage)
4. [Storage to UI Data Flow](#4-storage-to-ui-data-flow)
5. [UI to Storage Write Flow](#5-ui-to-storage-write-flow)
6. [Caching Layers](#6-caching-layers)

---

## 1. Current Persistent Storage

### 1.1 Primary Storage File

| Property | Value |
|----------|-------|
| **File Path** | `test-data.json` (project root) |
| **Size** | Variable (grows with data) |
| **Format** | JSON |
| **Purpose** | Primary persistent storage for all application data |

### 1.2 Data Structure in `test-data.json`

The file stores a single JSON object with the following top-level keys:

```typescript
interface PersistentData {
  // Entity Collections (Record<id, Entity>)
  users: Record<number, User>;
  fleets: Record<string, Fleet>;
  vessels: Record<string, Vessel>;
  components: Record<string, Component>;
  spares: Record<number, Spare>;
  changeRequests: Record<number, ChangeRequest>;
  alertPolicies: Record<number, AlertPolicy>;
  alertEvents: Record<number, AlertEvent>;
  alertDeliveries: Record<number, AlertDelivery>;
  alertConfigs: Record<string, AlertConfig>;
  formDefinitions: Record<number, FormDefinition>;
  formVersions: Record<number, FormVersion>;
  jobs: Record<string, Job>;
  defects: Record<string, Defect>;
  recurringDefects: Record<number, RecurringDefect>;
  pmsVesselSettings: Record<string, PmsVesselSettings>;
  storesItems: Record<number, StoresItem>;
  makersList: Record<number, MakerList>;
  sfiDetailsList: Record<number, SfiDetails>;
  masterDataList: Record<number, MasterData>;
  fleetVesselMappings: Record<number, FleetVesselMapping>;
  fleetComponentMappings: Record<number, FleetComponentMapping>;
  fleetJobVesselMappings: Record<number, FleetJobVesselMapping>;
  fleetSpareVesselMappings: Record<number, FleetSpareVesselMapping>;
  bulkImportHistory: Record<number, BulkImportHistory>;
  componentMaintenanceHistory: Record<number, any>;
  componentDocuments: Record<number, any>;
  componentClassRegulatory: Record<number, any>;
  componentRequisitions: Record<number, any>;
  certificates: Record<string, any>;
  surveys: Record<string, any>;
  componentVesselMappings: Record<number, any>;
  
  // Array Collections
  runningHoursAudits: RunningHoursAudit[];
  sparesHistory: SpareHistory[];
  changeRequestAttachments: ChangeRequestAttachment[];
  changeRequestComments: ChangeRequestComment[];
  formVersionUsages: FormVersionUsage[];
  workOrders: WorkOrder[];           // NOTE: Array, not Record
  workOrderExecutions: WorkOrderExecution[];
  defectActions: DefectAction[];
  defectAttachments: DefectAttachment[];
  recurringDefectLinks: RecurringDefectLink[];
  importHistory: ImportHistory[];
  makers: Maker[];
  masterLists: MasterList[];
  auditLogs: AuditLog[];
  storesLedger: StoresLedger[];
  bulkImportErrors: BulkImportError[];
  
  // Counter State (auto-increment IDs)
  counters: {
    userId: number;
    auditId: number;
    spareId: number;
    historyId: number;
    changeRequestId: number;
    attachmentId: number;
    commentId: number;
    alertPolicyId: number;
    alertEventId: number;
    alertDeliveryId: number;
    alertConfigId: number;
    formDefinitionId: number;
    formVersionId: number;
    workOrderId: number;
    executionId: number;
    defectId: number;
    defectActionId: number;
    defectAttachmentId: number;
    recurringDefectId: number;
    auditLogId: number;
    pmsVesselSettingsId: number;
    storesItemId: number;
    storesLedgerId: number;
    makersListId: number;
    sfiDetailsListId: number;
    masterDataId: number;
    fleetVesselMappingId: number;
    fleetComponentMappingId: number;
    fleetJobVesselMappingId: number;
    fleetSpareVesselMappingId: number;
    bulkImportHistoryId: number;
    bulkImportErrorId: number;
    maintenanceHistoryId: number;
    componentDocumentId: number;
    componentClassRegulatoryId: number;
    componentRequisitionId: number;
  };
}
```

### 1.3 Secondary Storage Files

| File | Path | Purpose |
|------|------|---------|
| **Change Log** | `test-data-change-log.json` | Import change tracking (derived from main file) |
| **File Uploads** | `uploads/component-documents/**` | Binary file storage (documents, images) |

### 1.4 How the File is Loaded, Parsed, and Updated

```
┌──────────────────────────────────────────────────────────────────┐
│                    FILE LOADING (On Startup)                      │
├──────────────────────────────────────────────────────────────────┤
│  1. PersistentFileStorage constructor is called                  │
│  2. fs.existsSync() checks if test-data.json exists              │
│  3. If exists: fs.readFileSync() → JSON.parse() → this.data     │
│  4. If not exists: initializeSeedData() creates default data    │
│  5. Data normalization & backfill for legacy records             │
│  6. Component code index is built for fast lookups               │
│  7. Change logs loaded from test-data-change-log.json            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE (On Write)                    │
├──────────────────────────────────────────────────────────────────┤
│  1. Any storage method calls this.persistData()                  │
│  2. Write lock queued to prevent concurrent writes               │
│  3. Temp file created: test-data.json.tmp                        │
│  4. JSON.stringify(this.data, null, 2) → writeFileSync          │
│  5. Atomic rename: test-data.json.tmp → test-data.json          │
│  6. Change logs saved separately                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Key Loading Code** (`server/persistentStorage.ts`, line 415-524):
```typescript
private loadData(): PersistentData {
  if (fs.existsSync(this.dataFile)) {
    const fileContent = fs.readFileSync(this.dataFile, 'utf-8');
    const loadedData = JSON.parse(fileContent) as Partial<PersistentData>;
    // Merge with defaults, backfill missing fields...
    return result;
  }
  // Return empty data structure with seeds
}
```

**Key Persistence Code** (`server/persistentStorage.ts`, line 1211-1229):
```typescript
private persistData(): void {
  const writeId = ++this.writeCounter;
  this.writeLock = this.writeLock.then(() => {
    return new Promise<void>((resolve) => {
      try {
        const tempFile = `${this.dataFile}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2));
        fs.renameSync(tempFile, this.dataFile);
        this.saveChangeLogs();
        resolve();
      } catch (error) {
        console.error(`❌ Error persisting data (write #${writeId}):`, error);
        resolve();
      }
    });
  });
}
```

---

## 2. Storage Logic Implementation Files

### 2.1 `server/storage.ts` - Interface Layer

| Property | Value |
|----------|-------|
| **Path** | `server/storage.ts` |
| **Lines** | ~736 lines |
| **Purpose** | Defines `IStorage` interface and exports singleton storage instance |

**Key Exports:**
```typescript
// Interface defining all storage operations
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Component methods
  getComponents(vesselId: string): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, data: Partial<Component>): Promise<Component>;
  deleteComponent(id: string): Promise<void>;
  
  // ~150+ more CRUD methods for all entities...
}

// Singleton export used by all routes
export const storage: IStorage = new PersistentFileStorage();
```

**Helper Functions:**
```typescript
export function sortObjectKeys(obj: any): any;  // For checksum calculation
export function calculateRecordChecksum(record: any): string;  // SHA-256 hash
```

### 2.2 `server/persistentStorage.ts` - File Storage Implementation

| Property | Value |
|----------|-------|
| **Path** | `server/persistentStorage.ts` |
| **Lines** | ~8,047 lines |
| **Purpose** | Implements `IStorage` using JSON file storage |

**Class Structure:**
```typescript
export class PersistentFileStorage implements IStorage {
  private readonly dataFile: string;           // Path to test-data.json
  private readonly changeLogFile: string;      // Path to change log
  private data: PersistentData;                // In-memory data cache
  private importChangeLogs: ImportChangeLog[]; // Change tracking
  private writeLock: Promise<void>;            // Concurrency control
  private writeCounter: number;                // Write ID tracking
  private componentCodeIndex: Map<string, Map<string, string>>; // Fast lookup
  
  constructor(filePath: string = 'test-data.json', changeLogPath?: string);
  
  // File I/O
  private loadData(): PersistentData;
  private persistData(): void;
  private persistDataAsync(): Promise<void>;
  private loadChangeLogs(): ImportChangeLog[];
  private saveChangeLogs(): void;
  
  // Indexing
  private rebuildComponentCodeIndex(): void;
  
  // Seed data
  private initializeSeedData(data: PersistentData): void;
  
  // 150+ IStorage method implementations...
}
```

**Key Methods:**

| Method | Purpose | Read/Write |
|--------|---------|------------|
| `loadData()` | Load JSON file into memory | READ |
| `persistData()` | Write in-memory data to JSON file | WRITE |
| `getComponents()` | Return components from memory | READ |
| `createComponent()` | Add to memory + persistData() | WRITE |
| `updateComponent()` | Modify in memory + persistData() | WRITE |
| `deleteComponent()` | Remove from memory + persistData() | WRITE |

**Concurrency Handling:**
```typescript
private writeLock: Promise<void> = Promise.resolve();

private persistData(): void {
  // Queue writes to prevent concurrent file access
  this.writeLock = this.writeLock.then(() => {
    // Write temp file, then atomic rename
  });
}
```

**Error Handling:**
```typescript
class StorageInitializationError extends Error {
  constructor(
    message: string,
    public readonly targetPath: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) { ... }
}
```

### 2.3 `server/services/localFileStorage.ts` - Binary File Storage

| Property | Value |
|----------|-------|
| **Path** | `server/services/localFileStorage.ts` |
| **Lines** | 131 lines |
| **Purpose** | Handle binary file uploads (documents, images) |

**Storage Location:**
```typescript
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'component-documents');
```

**Methods:**
```typescript
export class LocalFileStorage {
  static async write(fileKey: string, buffer: Buffer, contentType?: string): Promise<string>;
  static async read(fileKey: string): Promise<{ buffer: Buffer; contentType: string }>;
  static async delete(fileKey: string): Promise<void>;
  static exists(fileKey: string): boolean;
  static getContentType(fileKey: string): string;
}
```

**Metadata Tracking:**
- Each file has a companion `.meta.json` file storing content type and creation date
- Example: `uploads/component-documents/ME001/12345_document.pdf.meta.json`

### 2.4 Storage Abstraction Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐                                          │
│  │   IStorage        │  ← Interface (storage.ts)                │
│  │   (Interface)     │                                          │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│  ┌───────────────────────────┐                                  │
│  │  PersistentFileStorage    │  ← Implementation                │
│  │  (persistentStorage.ts)   │     (persistentStorage.ts)       │
│  │                           │                                  │
│  │  ┌─────────────────────┐  │                                  │
│  │  │  this.data          │  │  ← In-memory cache               │
│  │  │  (PersistentData)   │  │                                  │
│  │  └─────────┬───────────┘  │                                  │
│  │            │              │                                  │
│  │            ▼              │                                  │
│  │  ┌─────────────────────┐  │                                  │
│  │  │  test-data.json     │  │  ← Persistent file               │
│  │  └─────────────────────┘  │                                  │
│  └───────────────────────────┘                                  │
│                                                                  │
│  ┌───────────────────────────┐                                  │
│  │  LocalFileStorage         │  ← Binary files                  │
│  │  (localFileStorage.ts)    │     (documents, images)          │
│  │                           │                                  │
│  │  ┌─────────────────────┐  │                                  │
│  │  │  uploads/           │  │  ← File system                   │
│  │  │  component-documents│  │                                  │
│  │  └─────────────────────┘  │                                  │
│  └───────────────────────────┘                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Storage Usage

### 3.1 Services Using Storage

| Service File | Purpose | Storage Methods Used |
|--------------|---------|----------------------|
| `server/services/componentService.ts` | Component CRUD operations | `getComponent`, `updateComponent`, `getComponents` |
| `server/services/jobService.ts` | Job template management | `getJob`, `createJob`, `updateJob`, `getJobs` |
| `server/services/workOrderService.ts` | Work order operations | `getWorkOrders`, `createWorkOrder`, `updateWorkOrder` |
| `server/services/runningHoursService.ts` | Running hours tracking | `cascadeRunningHoursUpdate`, `createRunningHoursAudit` |
| `server/services/jobDueScanner.ts` | Auto work order generation | `getJobs`, `getWorkOrders`, `createWorkOrder` |

### 3.2 Route Handlers Using Storage

#### Main Routes File: `server/routes.ts` (~244 storage calls)

| Route | Method | Storage Operation |
|-------|--------|-------------------|
| `/api/components/:vesselId` | GET | `storage.getComponents()` |
| `/api/components/details/:id` | GET | `storage.getComponent()` |
| `/api/components/:vesselId` | POST | `storage.createComponent()` |
| `/api/components/:id` | PUT | `storage.updateComponent()` |
| `/api/jobs` | GET | `storage.getJobs()` |
| `/api/jobs` | POST | `storage.createJob()` |
| `/api/jobs/:id` | PUT | `storage.updateJob()` |
| `/api/work-orders` | GET | `storage.getWorkOrders()` |
| `/api/work-orders` | POST | `storage.createWorkOrder()` |
| `/api/work-orders/:id` | PUT | `storage.updateWorkOrder()` |
| `/api/defects` | GET | `storage.getDefects()` |
| `/api/defects` | POST | `storage.createDefect()` |
| `/api/spares/:vesselId` | GET | `storage.getSpares()` |
| `/api/spares/:vesselId` | POST | `storage.createSpare()` |

#### Modular Route Files:

| Route File | Path | Storage Methods |
|------------|------|-----------------|
| `server/routes/alerts.ts` | `/api/alerts/*` | Alert policies, events, deliveries, configs |
| `server/routes/bulk.ts` | `/api/bulk/*` | `bulkCreateComponents`, `bulkUpsertJobs`, etc. |
| `server/routes/changeRequests.ts` | `/api/change-requests/*` | Change request CRUD |
| `server/routes/fleetAdmin.ts` | `/api/fleet-admin/*` | Fleet component/job/spare management |
| `server/routes/forms.ts` | `/api/forms/*` | Form definitions and versions |

### 3.3 Read vs Write Patterns

**Read Operations:**
- Read entire collection (e.g., `getComponents(vesselId)`) - returns filtered in-memory data
- Read single entity (e.g., `getComponent(id)`) - direct lookup in memory

**Write Operations:**
- Create: Add to in-memory structure → `persistData()` writes entire JSON
- Update: Modify in-memory object → `persistData()` writes entire JSON
- Delete: Remove from in-memory structure → `persistData()` writes entire JSON

> **Important:** Every write operation triggers a full JSON file rewrite. There is no delta/incremental persistence.

### 3.4 Initialization Logic

**File: `server/index.ts`**
```typescript
(async () => {
  const server = await registerRoutes(app);  // Storage initialized here
  // ...
})();
```

**File: `server/routes.ts`**
```typescript
import { storage } from "./storage";  // Singleton import triggers initialization

export async function registerRoutes(app: Express): Promise<Server> {
  // Storage already initialized via import
  // Start JobDueScanner which uses storage
  const { jobDueScanner } = await import("./services/jobDueScanner");
  jobDueScanner.start(60 * 60 * 1000);
  // ...
}
```

---

## 4. Storage to UI Data Flow

### 4.1 Complete Request→Response→Render Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: Storage → UI                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐                                          │
│  │  React Component  │  1. useQuery({ queryKey: ['/api/...'] }) │
│  │  (e.g., Spares)   │                                          │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  2. TanStack Query calls default queryFn            │
│  ┌───────────────────┐                                          │
│  │  queryClient.ts   │  fetch(queryKey[0], { credentials })     │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  3. HTTP GET /api/spares/:vesselId                  │
│  ┌───────────────────┐                                          │
│  │  Express Route    │  app.get('/api/spares/:vesselId', ...)   │
│  │  (routes.ts)      │                                          │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  4. storage.getSpares(vesselId)                     │
│  ┌───────────────────┐                                          │
│  │  PersistentFile   │  Returns Object.values(this.data.spares) │
│  │  Storage          │  filtered by vesselId                    │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  5. this.data (in-memory cache)                     │
│  ┌───────────────────┐                                          │
│  │  test-data.json   │  Loaded once at startup                  │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  6. res.json(spares)                                │
│  ┌───────────────────┐                                          │
│  │  HTTP Response    │  JSON array of spare objects             │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  7. React Query caches, re-renders component        │
│  ┌───────────────────┐                                          │
│  │  UI Renders Data  │  <SparesTable data={spares} />           │
│  └───────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Frontend Files

| File | Purpose | Storage Interaction |
|------|---------|---------------------|
| `client/src/lib/queryClient.ts` | Configure TanStack Query | Default fetcher with credentials |
| `client/src/pages/pms/Components.tsx` | Components list | `useQuery(['components', vesselId])` |
| `client/src/pages/spares/Spares.tsx` | Spares inventory | `useQuery(['/api/spares', vesselId])` |
| `client/src/pages/pms/WorkOrdersPage.tsx` | Work orders | `useQuery(['/api/work-orders', vesselId])` |
| `client/src/pages/defects/*` | Defects module | Multiple queries for defects data |

### 4.3 Query Client Configuration

**File: `client/src/lib/queryClient.ts`**
```typescript
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });
    // Handle 401, throw on error
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      staleTime: STALE_TIMES.CRITICAL,  // 2 minutes
      retry: false,
    },
  },
});
```

### 4.4 Example: Components Page Data Flow

**Frontend:** `client/src/pages/pms/Components.tsx`
```typescript
const { data: components, isLoading } = useQuery({
  queryKey: ['/api/components', vesselId],
});

// Renders AG Grid with components data
return <ComponentsTable data={components} />;
```

**Backend:** `server/routes.ts`
```typescript
app.get("/api/components/:vesselId", async (req, res) => {
  const components = await storage.getComponents(req.params.vesselId);
  res.json(components);
});
```

**Storage:** `server/persistentStorage.ts`
```typescript
async getComponents(vesselId: string): Promise<Component[]> {
  return Object.values(this.data.components)
    .filter(c => c.vesselId === vesselId && c.isActive !== false);
}
```

---

## 5. UI to Storage Write Flow

### 5.1 Complete UI Action → Storage Write Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: UI → Storage                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐                                          │
│  │  User Action      │  1. User fills form, clicks "Save"       │
│  │  (Form Submit)    │                                          │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  2. React Hook Form validates                       │
│  ┌───────────────────┐                                          │
│  │  Form onSubmit    │  form.handleSubmit(onSubmit)             │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  3. useMutation calls apiRequest                    │
│  ┌───────────────────┐                                          │
│  │  TanStack         │  mutate(formData)                        │
│  │  useMutation      │                                          │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  4. HTTP POST/PATCH with JSON body                  │
│  ┌───────────────────┐                                          │
│  │  apiRequest()     │  fetch(url, { method, body: JSON })      │
│  │  (queryClient.ts) │                                          │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  5. Express route receives request                  │
│  ┌───────────────────┐                                          │
│  │  Express Route    │  Zod validation → storage.create/update  │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  6. Storage modifies in-memory data                 │
│  ┌───────────────────┐                                          │
│  │  PersistentFile   │  this.data.entity[id] = newData          │
│  │  Storage          │  this.persistData()                      │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  7. JSON file written atomically                    │
│  ┌───────────────────┐                                          │
│  │  test-data.json   │  Temp file → rename                      │
│  └─────────┬─────────┘                                          │
│            │                                                     │
│            ▼  8. Response sent, cache invalidated                │
│  ┌───────────────────┐                                          │
│  │  onSuccess()      │  queryClient.invalidateQueries(['key'])  │
│  └───────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Example: Creating a Work Order

**Frontend Component:** `client/src/components/WorkOrderForm.tsx`
```typescript
const createMutation = useMutation({
  mutationFn: (data: InsertWorkOrder) => 
    apiRequest('POST', '/api/work-orders', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
    toast({ title: "Work order created" });
  },
});

const onSubmit = (data: FormData) => {
  createMutation.mutate(data);
};
```

**Backend Route:** `server/routes.ts`
```typescript
app.post("/api/work-orders", async (req, res) => {
  try {
    const validatedData = insertWorkOrderSchema.parse(req.body);
    const workOrder = await storage.createWorkOrder(validatedData);
    res.status(201).json(workOrder);
  } catch (error) {
    res.status(400).json({ error: "Invalid work order data" });
  }
});
```

**Storage Method:** `server/persistentStorage.ts`
```typescript
async createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder> {
  const id = this.data.counters.workOrderId++;
  const workOrderNo = normalizeWorkOrderNumber(workOrder, this.data.workOrders);
  
  const newWorkOrder: WorkOrder = {
    ...workOrder,
    id: String(id),
    workOrderNo,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  this.data.workOrders.push(newWorkOrder);
  this.persistData();  // ← Writes entire JSON file
  return newWorkOrder;
}
```

### 5.3 Components That Trigger Storage Writes

| Component | Path | Write Operations |
|-----------|------|------------------|
| `WorkOrderForm.tsx` | `client/src/components/WorkOrderForm.tsx` | Create/update work orders |
| `AddEditComponentForm.tsx` | `client/src/components/AddEditComponentForm.tsx` | Create/update components |
| `SparesNew.tsx` | `client/src/pages/spares/SparesNew.tsx` | Create/update spares |
| `DefectFormWizard.tsx` | `client/src/pages/defects/DefectFormWizard.tsx` | Create/update defects |
| `ComponentRegisterAddEdit.tsx` | `client/src/components/ComponentRegisterAddEdit.tsx` | Component registration |
| `Stores.tsx` | `client/src/pages/stores/Stores.tsx` | Store items management |

---

## 6. Caching Layers

### 6.1 Backend Caching

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND CACHING                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PersistentFileStorage.data (In-Memory Cache)              │  │
│  │                                                             │  │
│  │  • Loaded ONCE at server startup                           │  │
│  │  • All reads come from this.data (never re-read file)     │  │
│  │  • All writes update this.data THEN write to file         │  │
│  │  • Acts as the source of truth during runtime             │  │
│  │                                                             │  │
│  │  Implications:                                              │  │
│  │  ✓ Fast reads (O(1) memory access)                         │  │
│  │  ✗ Server restart required to pick up external file edits │  │
│  │  ✗ Large datasets consume memory                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Component Code Index (Secondary Cache)                    │  │
│  │                                                             │  │
│  │  Map<vesselId, Map<componentCode, componentId>>            │  │
│  │                                                             │  │
│  │  • Built during startup via rebuildComponentCodeIndex()   │  │
│  │  • Enables O(1) component lookup by code                  │  │
│  │  • Updated when components are created/updated            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Frontend Caching

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND CACHING                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  TanStack Query Cache                                       │  │
│  │                                                             │  │
│  │  Configuration (from queryClient.ts):                       │  │
│  │  • staleTime: 2 minutes (CRITICAL data)                    │  │
│  │  • staleTime: 5 minutes (REFERENCE data)                   │  │
│  │  • staleTime: 30 minutes (STATIC data)                     │  │
│  │  • refetchOnWindowFocus: false                             │  │
│  │  • refetchInterval: false                                  │  │
│  │                                                             │  │
│  │  Cache Invalidation:                                        │  │
│  │  queryClient.invalidateQueries({ queryKey: ['/api/...'] }) │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  localStorage (Auth State Only)                            │  │
│  │                                                             │  │
│  │  Key: 'currentUser'                                        │  │
│  │  Value: JSON serialized PublicUser                         │  │
│  │                                                             │  │
│  │  Used by AuthContext for session persistence               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  IndexedDB (Offline Mode)                                  │  │
│  │                                                             │  │
│  │  Used by OfflineContext for offline-first capabilities    │  │
│  │  Stores queued operations when offline                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 In-Memory Data Service (Legacy)

**File: `client/src/services/changeRequestService.ts`**

This file maintains its own in-memory cache separate from backend storage:

```typescript
// In-memory storage for change requests
let changeRequests: ChangeRequest[] = [...];
let changeLogs: ChangeLog[] = [];
let nextId = 4;

export const changeRequestService = {
  getAllChangeRequests: () => [...changeRequests],
  createChangeRequest: (request) => {
    changeRequests.push({ ...request, id: nextId++ });
  },
  // ...
};
```

> **Note:** This is a legacy pattern. Most data now flows through the backend storage.

### 6.4 Cache Consistency Model

```
Write Path:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Frontend mutation → HTTP POST → Backend route               │
│ 2. Backend validates → storage.create() → in-memory update     │
│ 3. storage.persistData() → JSON file write                     │
│ 4. Response → onSuccess → queryClient.invalidateQueries()      │
│ 5. TanStack Query refetches → UI updates                       │
└─────────────────────────────────────────────────────────────────┘

Read Path:
┌─────────────────────────────────────────────────────────────────┐
│ 1. useQuery triggers if cache stale/invalid                    │
│ 2. HTTP GET → Backend route → storage.get()                    │
│ 3. storage returns from this.data (in-memory)                  │
│ 4. Response → TanStack Query caches → UI renders               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Primary Storage** | `test-data.json` (JSON file) |
| **Storage Interface** | `IStorage` in `server/storage.ts` |
| **Storage Implementation** | `PersistentFileStorage` in `server/persistentStorage.ts` |
| **Binary Files** | `LocalFileStorage` → `uploads/component-documents/` |
| **Backend Cache** | In-memory `this.data` loaded at startup |
| **Frontend Cache** | TanStack Query with 2-5 minute staleTime |
| **Write Pattern** | Full JSON file rewrite on every change |
| **Read Pattern** | Direct memory access (O(1)) |
| **Concurrency** | Write lock queue prevents race conditions |
| **Atomicity** | Temp file + rename for crash safety |

---

*Last Updated: December 2025*
