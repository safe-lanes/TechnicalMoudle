// @ts-nocheck
/**
 * @deprecated PostgresStorage is NOT FUNCTIONAL and requires a complete rewrite.
 * 
 * IMPORTANT: This file is preserved for reference only. DO NOT USE.
 * 
 * Current issues:
 * 1. Missing ~30 methods required by IStorage interface
 * 2. Relies on drizzle tables that may not match shared/schema.ts
 * 3. Contains numerous type errors and nullable issues
 * 4. Not synchronized with current application requirements
 * 
 * When production PostgreSQL support is needed:
 * 1. Design against current IStorage contract (see server/persistentStorage.ts)
 * 2. Ensure parity with shared/schema.ts
 * 3. Add comprehensive tests
 * 4. Remove @ts-nocheck after fixing all type errors
 * 
 * The application currently uses PersistentFileStorage exclusively.
 * See server/persistentStorage.ts for the working implementation.
 */

// Placeholder interface to avoid import errors
type IStorage = any;
type User = any;
type InsertUser = any;
type Component = any;
type InsertComponent = any;
type Job = any;
type InsertJob = any;
type WorkOrder = any;
type InsertWorkOrder = any;
type Spare = any;
type InsertSpare = any;
type SpareHistory = any;
type InsertSpareHistory = any;
type Defect = any;
type InsertDefect = any;
type RunningHoursEntry = any;
type InsertRunningHoursEntry = any;
type MasterData = any;
type InsertMasterData = any;
type MakerList = any;
type InsertMakerList = any;
type MasterList = any;
type InsertMasterList = any;
type Vessel = any;
type InsertVessel = any;
type Fleet = any;
type InsertFleet = any;
type ChangeRequest = any;
type InsertChangeRequest = any;
type ChangeRequestAttachment = any;
type InsertChangeRequestAttachment = any;
type ChangeRequestComment = any;
type InsertChangeRequestComment = any;
type ImportHistory = any;
type InsertImportHistory = any;
type BulkImportError = any;
type InsertBulkImportError = any;
type Attachment = any;
type InsertAttachment = any;
type Activity = any;
type InsertActivity = any;
type PmsVesselSettings = any;
type InsertPmsVesselSettings = any;

// Drizzle table references (placeholders)
const users: any = null;
const components: any = null;
const jobs: any = null;
const workOrders: any = null;
const spares: any = null;
const spareHistory: any = null;
const defects: any = null;
const runningHoursEntries: any = null;
const masterData: any = null;
const makerList: any = null;
const masterLists: any = null;
const vessels: any = null;
const fleets: any = null;
const changeRequest: any = null;
const changeRequestAttachment: any = null;
const changeRequestComment: any = null;
const importHistory: any = null;
const bulkImportErrors: any = null;
const attachments: any = null;
const activities: any = null;
const pmsVesselSettings: any = null;

/**
 * @deprecated See file header. This class is NOT FUNCTIONAL.
 */
export class PostgresStorage implements IStorage {
  private componentCodeIndex: Map<string, Map<string, string>> = new Map(); // vesselId → (componentCode → componentId)
  
  private async getDb() {
    const { db } = await import('./db');
    return db;
  }
  
  private async rebuildComponentCodeIndex(): Promise<void> {
    const db = await this.getDb();
    const allComponents = await db.select().from(components);
    
    this.componentCodeIndex.clear();
    for (const component of allComponents) {
      if (component.componentCode) {
        const vesselId = component.vesselId || 'global';
        if (!this.componentCodeIndex.has(vesselId)) {
          this.componentCodeIndex.set(vesselId, new Map());
        }
        this.componentCodeIndex.get(vesselId)!.set(component.componentCode, component.id);
      }
    }
  }

  // ============= USERS =============
  async getUser(id: number): Promise<User | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const db = await this.getDb();
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    const db = await this.getDb();
    return await db.select().from(users);
  }

  // ============= COMPONENTS =============
  async getComponents(vesselId: string): Promise<Component[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    return await db.select().from(components)
      .where(and(eq(components.vesselId, vesselId), eq(components.dataScope, 'vessel')));
  }

  async getComponent(id: string): Promise<Component | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(components).where(eq(components.id, id));
    return result[0];
  }

  async getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(components)
      .where(and(
        eq(components.componentCode, componentCode),
        eq(components.vesselId, vesselId)
      ));
    return result[0];
  }

  async createComponent(component: InsertComponent): Promise<Component> {
    const db = await this.getDb();
    const { nanoid } = await import('nanoid');
    const id = nanoid();
    const result = await db.insert(components).values({ ...component, id }).returning();
    const created = result[0];
    
    // Update index
    if (created.componentCode) {
      const vesselId = created.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(created.componentCode, created.id);
    }
    
    return created;
  }

  async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    // Get existing component to handle index updates
    const existing = await this.getComponent(id);
    if (existing && existing.componentCode && (data.componentCode !== undefined || data.vesselId !== undefined)) {
      const oldVesselId = existing.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(oldVesselId);
      if (vesselIndex) {
        vesselIndex.delete(existing.componentCode);
      }
    }
    
    const result = await db.update(components)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(components.id, id))
      .returning();
    const updated = result[0];
    
    // Add new index entry
    if (updated.componentCode) {
      const vesselId = updated.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(updated.componentCode, updated.id);
    }
    
    return updated;
  }

  async deleteComponent(id: string): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    // Get component to remove from index
    const component = await this.getComponent(id);
    if (component && component.componentCode) {
      const vesselId = component.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(vesselId);
      if (vesselIndex) {
        vesselIndex.delete(component.componentCode);
      }
    }
    
    await db.delete(components).where(eq(components.id, id));
  }

  /**
   * C2 INACTIVATE COMPONENT (Rule #14) - PostgreSQL version
   * Sets component status to INACTIVE instead of hard delete.
   * Option A (default): Block if any child is ACTIVE
   * Option B (cascadeInactivate=true): Cascade inactivate all descendants
   */
  async inactivateComponent(
    id: string, 
    userId: string = 'system',
    options: { cascadeInactivate?: boolean } = {}
  ): Promise<{ 
    success: boolean; 
    message: string; 
    componentsInactivated: number;
    jobsInactivated: number;
    activeChildrenCount?: number;
  }> {
    const db = await this.getDb();
    const { eq, and, or, inArray } = await import('drizzle-orm');
    
    const component = await this.getComponent(id);
    if (!component) {
      return { 
        success: false, 
        message: `Component ${id} not found`,
        componentsInactivated: 0,
        jobsInactivated: 0
      };
    }
    
    if (component.isActive === false) {
      return {
        success: true,
        message: 'Component is already inactive',
        componentsInactivated: 0,
        jobsInactivated: 0
      };
    }
    
    const componentCode = component.componentCode;
    const componentId = component.id;
    
    // Find all descendants recursively
    const descendants: Component[] = [];
    const findDescendants = async (parentCode: string | null) => {
      if (!parentCode) return;
      const children = await db.select().from(components)
        .where(eq(components.parentId, parentCode));
      for (const child of children) {
        if (child.id !== componentId) {
          descendants.push(child);
          if (child.componentCode) {
            await findDescendants(child.componentCode);
          }
        }
      }
    };
    if (componentCode) {
      await findDescendants(componentCode);
    }
    
    // C2 Option A: Block if any child is ACTIVE (default behavior)
    if (!options.cascadeInactivate) {
      const activeChildren = descendants.filter(d => d.isActive !== false);
      if (activeChildren.length > 0) {
        return {
          success: false,
          message: `Component has ${activeChildren.length} active children. Inactivate or reassign them first.`,
          componentsInactivated: 0,
          jobsInactivated: 0,
          activeChildrenCount: activeChildren.length
        };
      }
    }
    
    // Proceed with inactivation
    let componentsInactivated = 0;
    let jobsInactivated = 0;
    
    // Collect all component codes/ids to process
    const allCodesToProcess: string[] = componentCode ? [componentCode] : [];
    const allIdsToProcess: string[] = [componentId];
    
    // C2 Option B: Cascade inactivate all descendants
    if (options.cascadeInactivate) {
      for (const descendant of descendants) {
        if (descendant.isActive !== false) {
          await db.update(components)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(components.id, descendant.id));
          componentsInactivated++;
          if (descendant.componentCode) {
            allCodesToProcess.push(descendant.componentCode);
          }
          allIdsToProcess.push(descendant.id);
        }
      }
    }
    
    // Inactivate the target component
    await db.update(components)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(components.id, id));
    componentsInactivated++;
    
    // Inactivate all linked Jobs if we have any codes/ids to process
    if (allCodesToProcess.length > 0 || allIdsToProcess.length > 0) {
      const jobsToUpdate = await db.select().from(jobs)
        .where(or(
          inArray(jobs.componentId, allIdsToProcess),
          inArray(jobs.componentCode, allCodesToProcess)
        ));
      
      for (const job of jobsToUpdate) {
        if (job.isActive !== false) {
          await db.update(jobs)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(jobs.id, job.id));
          jobsInactivated++;
        }
      }
    }
    
    console.log(`[INACTIVATE] Component ${id} inactivated:`, { componentsInactivated, jobsInactivated });
    
    return {
      success: true,
      message: `Component inactivated successfully. ${componentsInactivated} component(s) and ${jobsInactivated} job(s) affected.`,
      componentsInactivated,
      jobsInactivated
    };
  }

  // ============= FLEET COMPONENTS =============
  async getFleetComponents(): Promise<Component[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(components).where(eq(components.dataScope, 'fleet'));
  }

  async getFleetComponent(id: string): Promise<Component | undefined> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(components)
      .where(and(eq(components.id, id), eq(components.dataScope, 'fleet')));
    return result[0];
  }

  async createFleetComponent(component: InsertComponent): Promise<Component> {
    const db = await this.getDb();
    const { nanoid } = await import('nanoid');
    const fleetEquipmentCode = await generateFleetEquipmentCode();
    const id = nanoid();
    const result = await db.insert(components).values({
      ...component,
      id,
      dataScope: 'fleet',
      fleetEquipmentCode,
    }).returning();
    const created = result[0];
    
    // Update index
    if (created.componentCode) {
      const vesselId = created.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(created.componentCode, created.id);
    }
    
    return created;
  }

  async updateFleetComponent(id: string, data: Partial<Component>): Promise<Component> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    // Get existing component to handle index updates
    const existing = await this.getFleetComponent(id);
    if (existing && existing.componentCode && data.componentCode !== undefined) {
      const oldVesselId = existing.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(oldVesselId);
      if (vesselIndex) {
        vesselIndex.delete(existing.componentCode);
      }
    }
    
    const result = await db.update(components)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(components.id, id))
      .returning();
    const updated = result[0];
    
    // Add new index entry
    if (updated.componentCode) {
      const vesselId = updated.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(updated.componentCode, updated.id);
    }
    
    return updated;
  }

  async deleteFleetComponent(id: string): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    // Get component to remove from index
    const component = await this.getFleetComponent(id);
    if (component && component.componentCode) {
      const vesselId = component.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(vesselId);
      if (vesselIndex) {
        vesselIndex.delete(component.componentCode);
      }
    }
    
    await db.delete(components).where(eq(components.id, id));
  }

  // ============= RUNNING HOURS AUDITS =============
  async createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    const db = await this.getDb();
    const result = await db.insert(runningHoursAudit).values(audit).returning();
    return result[0];
  }

  async getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    const db = await this.getDb();
    const { eq, desc } = await import('drizzle-orm');
    const query = db.select().from(runningHoursAudit)
      .where(eq(runningHoursAudit.componentId, componentId))
      .orderBy(desc(runningHoursAudit.enteredAtUTC));
    
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<RunningHoursAudit[]> {
    const db = await this.getDb();
    const { eq, and, gte, lte, desc } = await import('drizzle-orm');
    return await db.select().from(runningHoursAudit)
      .where(and(
        eq(runningHoursAudit.componentId, componentId),
        gte(runningHoursAudit.enteredAtUTC, startDate),
        lte(runningHoursAudit.enteredAtUTC, endDate)
      ))
      .orderBy(desc(runningHoursAudit.enteredAtUTC));
  }

  // ============= SPARES =============
  async getSpares(vesselId: string): Promise<Spare[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    return await db.select().from(spares)
      .where(and(eq(spares.vesselId, vesselId), eq(spares.dataScope, 'vessel'), eq(spares.deleted, false)));
  }

  async getSpare(id: number): Promise<Spare | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(spares).where(eq(spares.id, id));
    return result[0];
  }

  async createSpare(spare: InsertSpare): Promise<Spare> {
    const db = await this.getDb();
    const result = await db.insert(spares).values(spare).returning();
    return result[0];
  }

  async updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(spares)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(spares.id, id))
      .returning();
    return result[0];
  }

  async deleteSpare(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(spares)
      .set({ deleted: true })
      .where(eq(spares.id, id));
  }

  async consumeSpare(id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const spare = await this.getSpare(id);
    if (!spare) throw new Error(`Spare ${id} not found`);

    const newRob = spare.rob - quantity;
    const updated = await db.update(spares)
      .set({ rob: newRob, updatedAt: new Date() })
      .where(eq(spares.id, id))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || '',
      spareId: id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode || '',
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode || '',
      eventType: 'CONSUME',
      qtyChange: -quantity,
      robAfter: newRob,
      userId,
      remarks,
      dateLocal,
      tz,
      place,
    });

    return updated[0];
  }

  /**
   * Rule A3: Location-aware spare consumption with negative prevention (PostgreSQL)
   * Deducts from specified location, never goes negative, logs shortage if any
   */
  async consumeSpareFromLocation(
    id: number, 
    quantity: number, 
    location: 'A' | 'B', 
    userId: string, 
    remarks?: string, 
    workOrderRef?: string
  ): Promise<{
    spare: Spare;
    deducted: number;
    requested: number;
    shortageQty: number;
  }> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    // Get the location-specific ROB
    const currentLocationRob = location === 'A' 
      ? parseFloat(String(spare.robLocationA || 0))
      : parseFloat(String(spare.robLocationB || 0));
    
    // Rule A3: ROB never goes negative - deduct only what's available
    const deducted = Math.min(quantity, currentLocationRob);
    const shortageQty = quantity - deducted;
    
    if (deducted > 0) {
      // Update location-specific ROB and total ROB
      const newLocationRob = currentLocationRob - deducted;
      const currentTotalRob = parseFloat(String(spare.rob || 0));
      const newTotalRob = Math.max(0, currentTotalRob - deducted);
      
      const updateData = location === 'A'
        ? { robLocationA: String(newLocationRob), rob: newTotalRob, updatedAt: new Date() }
        : { robLocationB: String(newLocationRob), rob: newTotalRob, updatedAt: new Date() };
      
      const updated = await db.update(spares)
        .set(updateData)
        .where(eq(spares.id, id))
        .returning();
      
      // Create history entry
      await this.createSpareHistory({
        timestampUTC: new Date(),
        vesselId: spare.vesselId || '',
        spareId: id,
        partCode: spare.partCode,
        partName: spare.partName,
        componentId: spare.componentId || '',
        componentCode: spare.componentCode || '',
        componentName: spare.componentName,
        componentSpareCode: spare.componentSpareCode || '',
        eventType: 'CONSUME',
        qtyChange: -deducted,
        robAfter: newTotalRob,
        userId,
        remarks: shortageQty > 0 
          ? `${remarks || ''} [SHORTAGE: Requested ${quantity}, only ${deducted} available at Location ${location}]`.trim()
          : remarks || undefined,
        reference: workOrderRef,
        place: `Location ${location}`,
        dateLocal: new Date().toISOString().split('T')[0],
        tz: 'UTC'
      });
      
      return {
        spare: updated[0],
        deducted,
        requested: quantity,
        shortageQty
      };
    }
    
    // Nothing to deduct - location has 0 stock
    return {
      spare,
      deducted: 0,
      requested: quantity,
      shortageQty: quantity
    };
  }

  async receiveSpare(id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const spare = await this.getSpare(id);
    if (!spare) throw new Error(`Spare ${id} not found`);

    const newRob = spare.rob + quantity;
    const updated = await db.update(spares)
      .set({ rob: newRob, updatedAt: new Date() })
      .where(eq(spares.id, id))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || '',
      spareId: id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode || '',
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode || '',
      eventType: 'RECEIVE',
      qtyChange: quantity,
      robAfter: newRob,
      userId,
      remarks,
      reference: supplierPO,
      dateLocal,
      tz,
      place,
    });

    return updated[0];
  }

  // ============= FLEET SPARES =============
  async getFleetSpares(): Promise<Spare[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    return await db.select().from(spares)
      .where(and(eq(spares.dataScope, 'fleet'), eq(spares.deleted, false)));
  }

  async getFleetSpare(id: number): Promise<Spare | undefined> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(spares)
      .where(and(eq(spares.id, id), eq(spares.dataScope, 'fleet')));
    return result[0];
  }

  async createFleetSpare(spare: InsertSpare): Promise<Spare> {
    const db = await this.getDb();
    const fleetPartCode = await generateFleetPartCode();
    const result = await db.insert(spares).values({
      ...spare,
      dataScope: 'fleet',
      fleetPartCode,
    }).returning();
    return result[0];
  }

  async updateFleetSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(spares)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(spares.id, id))
      .returning();
    return result[0];
  }

  async deleteFleetSpare(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(spares)
      .set({ deleted: true })
      .where(eq(spares.id, id));
  }

  // ============= SPARES HISTORY =============
  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    const db = await this.getDb();
    const { eq, desc } = await import('drizzle-orm');
    return await db.select().from(sparesHistory)
      .where(eq(sparesHistory.vesselId, vesselId))
      .orderBy(desc(sparesHistory.timestampUTC));
  }

  async getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
    const db = await this.getDb();
    const { eq, desc } = await import('drizzle-orm');
    return await db.select().from(sparesHistory)
      .where(eq(sparesHistory.spareId, spareId))
      .orderBy(desc(sparesHistory.timestampUTC));
  }

  async createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory> {
    const db = await this.getDb();
    const result = await db.insert(sparesHistory).values(history).returning();
    return result[0];
  }

  // ============= WORK ORDERS =============
  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    if (vesselId) {
      return await db.select().from(workOrders)
        .where(and(eq(workOrders.vesselId, vesselId), eq(workOrders.dataScope, 'vessel')));
    }
    return await db.select().from(workOrders);
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return result[0];
  }

  async getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(workOrders).where(eq(workOrders.jobId, jobId));
  }

  async createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const db = await this.getDb();
    const { nanoid } = await import('nanoid');
    const id = nanoid();
    const result = await db.insert(workOrders).values({ ...workOrder, id }).returning();
    return result[0];
  }

  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(workOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkOrder(id: string): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(workOrders).where(eq(workOrders.id, id));
  }

  // ============= DEFECTS =============
  async getDefects(filters?: {
    vesselId?: string;
    status?: string;
    statusView?: 'active' | 'resolved';
    category?: string;
    critical?: boolean;
    includeClosedDefects?: boolean;
    search?: string;
    period?: string;
    fleet?: string;
    group?: string;
    dueOverdue?: string;
  }): Promise<Defect[]> {
    const db = await this.getDb();
    const { eq, and, or, like, isNull, isNotNull } = await import('drizzle-orm');
    const conditions = [];

    if (filters?.vesselId) {
      conditions.push(eq(defects.vesselId, filters.vesselId));
    }

    if (filters?.statusView === 'active') {
      conditions.push(or(
        eq(defects.status, 'open'),
        eq(defects.status, 'in_progress'),
        eq(defects.status, 'pending_approval')
      ));
    } else if (filters?.statusView === 'resolved') {
      conditions.push(eq(defects.status, 'closed'));
    } else if (filters?.status) {
      conditions.push(eq(defects.status, filters.status));
    }

    if (filters?.category) {
      conditions.push(eq(defects.category, filters.category));
    }

    if (filters?.critical !== undefined) {
      conditions.push(eq(defects.critical, filters.critical));
    }

    if (filters?.search) {
      conditions.push(or(
        like(defects.title, `%${filters.search}%`),
        like(defects.description, `%${filters.search}%`)
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(defects).where(whereClause);
  }

  async getDefectsCount(filters?: {
    statusView?: 'active' | 'resolved';
    vesselId?: string;
    isCoC?: boolean;
    category?: string;
    search?: string;
    period?: string;
    fleet?: string;
    group?: string;
    dueOverdue?: string;
  }): Promise<number> {
    const db = await this.getDb();
    const { eq, and, or, like } = await import('drizzle-orm');
    const { sql } = await import('drizzle-orm');
    const conditions = [];

    if (filters?.vesselId) {
      conditions.push(eq(defects.vesselId, filters.vesselId));
    }

    if (filters?.statusView === 'active') {
      conditions.push(or(
        eq(defects.status, 'open'),
        eq(defects.status, 'in_progress'),
        eq(defects.status, 'pending_approval')
      ));
    } else if (filters?.statusView === 'resolved') {
      conditions.push(eq(defects.status, 'closed'));
    }

    if (filters?.isCoC !== undefined) {
      conditions.push(eq(defects.isCoC, filters.isCoC));
    }

    if (filters?.category) {
      conditions.push(eq(defects.category, filters.category));
    }

    if (filters?.search) {
      conditions.push(or(
        like(defects.title, `%${filters.search}%`),
        like(defects.description, `%${filters.search}%`)
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const result = await db.select({ count: sql<number>`count(*)` }).from(defects).where(whereClause);
    return result[0]?.count || 0;
  }

  async getDefect(id: string): Promise<Defect | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(defects).where(eq(defects.id, id));
    return result[0];
  }

  async createDefect(defect: InsertDefect): Promise<Defect> {
    const db = await this.getDb();
    const { nanoid } = await import('nanoid');
    const id = nanoid();
    const result = await db.insert(defects).values({ ...defect, id }).returning();
    return result[0];
  }

  async updateDefect(id: string, updates: Partial<InsertDefect>): Promise<Defect> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(defects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(defects.id, id))
      .returning();
    return result[0];
  }

  async deleteDefect(id: string): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(defects).where(eq(defects.id, id));
  }

  // ============= DEFECT ACTIONS =============
  async getDefectActions(defectId: string): Promise<DefectAction[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(defectActions).where(eq(defectActions.defectId, defectId));
  }

  async createDefectAction(action: InsertDefectAction): Promise<DefectAction> {
    const db = await this.getDb();
    const result = await db.insert(defectActions).values(action).returning();
    return result[0];
  }

  async updateDefectAction(id: number, updates: Partial<InsertDefectAction>): Promise<DefectAction> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(defectActions)
      .set(updates)
      .where(eq(defectActions.id, id))
      .returning();
    return result[0];
  }

  async deleteDefectAction(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(defectActions).where(eq(defectActions.id, id));
  }

  // ============= DEFECT ATTACHMENTS =============
  async getDefectAttachments(defectId: string): Promise<DefectAttachment[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(defectAttachments).where(eq(defectAttachments.defectId, defectId));
  }

  async createDefectAttachment(attachment: InsertDefectAttachment): Promise<DefectAttachment> {
    const db = await this.getDb();
    const result = await db.insert(defectAttachments).values(attachment).returning();
    return result[0];
  }

  async deleteDefectAttachment(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(defectAttachments).where(eq(defectAttachments.id, id));
  }

  // ============= CHANGE REQUESTS =============
  async getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string }): Promise<ChangeRequest[]> {
    const db = await this.getDb();
    const { eq, and, like, desc } = await import('drizzle-orm');
    const conditions = [];

    if (filters?.vesselId) {
      conditions.push(eq(changeRequest.vesselId, filters.vesselId));
    }
    if (filters?.category) {
      conditions.push(eq(changeRequest.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(changeRequest.status, filters.status));
    }
    if (filters?.q) {
      conditions.push(like(changeRequest.title, `%${filters.q}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(changeRequest)
      .where(whereClause)
      .orderBy(desc(changeRequest.createdAt));
  }

  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(changeRequest).where(eq(changeRequest.id, id));
    return result[0];
  }

  async createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest> {
    const db = await this.getDb();
    const result = await db.insert(changeRequest).values(request).returning();
    return result[0];
  }

  async updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(changeRequest)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(changeRequest.id, id))
      .returning();
    return result[0];
  }

  // ============= IMPORT HISTORY =============
  async createImportHistory(history: InsertImportHistory): Promise<ImportHistory> {
    const db = await this.getDb();
    const result = await db.insert(importHistory).values(history).returning();
    return result[0];
  }

  async getImportHistory(type?: string, limit?: number, offset?: number): Promise<{ items: ImportHistory[]; total: number }> {
    const db = await this.getDb();
    const { eq, desc, sql } = await import('drizzle-orm');
    
    const whereClause = type ? eq(importHistory.importType, type) : undefined;
    
    const items = await db.select().from(importHistory)
      .where(whereClause)
      .orderBy(desc(importHistory.importedAt))
      .limit(limit || 50)
      .offset(offset || 0);

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(importHistory)
      .where(whereClause);

    return {
      items,
      total: totalResult[0]?.count || 0,
    };
  }

  async getImportHistoryById(id: string): Promise<ImportHistory | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(importHistory).where(eq(importHistory.id, id));
    return result[0];
  }

  async updateImportHistory(id: string, data: Partial<ImportHistory>): Promise<ImportHistory> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(importHistory)
      .set(data)
      .where(eq(importHistory.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Import history with id ${id} not found`);
    }
    return result[0];
  }

  // ============= IMPORT CHANGE LOG =============
  async createImportChangeLog(log: InsertImportChangeLog): Promise<ImportChangeLog> {
    const db = await this.getDb();
    const result = await db.insert(importChangeLog).values(log).returning();
    return result[0];
  }

  async getImportChangeLogs(importHistoryId: string): Promise<ImportChangeLog[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(importChangeLog)
      .where(eq(importChangeLog.importHistoryId, importHistoryId));
  }

  async deleteImportChangeLogs(importHistoryId: string): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(importChangeLog)
      .where(eq(importChangeLog.importHistoryId, importHistoryId));
  }

  // ============= RECURRING DEFECTS =============
  async getRecurringDefects(filters?: { windowMonths?: number; minOccurrences?: number; hasCoc?: boolean; equipmentKey?: string }): Promise<RecurringDefect[]> {
    const db = await this.getDb();
    const { eq, and, gte } = await import('drizzle-orm');
    const conditions = [];

    if (filters?.equipmentKey) {
      conditions.push(eq(recurringDefects.equipmentKey, filters.equipmentKey));
    }
    if (filters?.minOccurrences) {
      conditions.push(gte(recurringDefects.occurrenceCount, filters.minOccurrences));
    }
    if (filters?.hasCoc !== undefined) {
      conditions.push(eq(recurringDefects.hasCoc, filters.hasCoc));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(recurringDefects).where(whereClause);
  }

  async getRecurringDefect(id: number): Promise<RecurringDefect | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(recurringDefects).where(eq(recurringDefects.id, id));
    return result[0];
  }

  async getRecurringDefectLinks(recurringId: number): Promise<RecurringDefectLink[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(recurringDefectLinks).where(eq(recurringDefectLinks.recurringId, recurringId));
  }

  // ============= MAKERS =============
  async getMakers(search?: string): Promise<Maker[]> {
    const db = await this.getDb();
    const { like, or } = await import('drizzle-orm');
    if (search) {
      return await db.select().from(makers)
        .where(or(
          like(makers.makerName, `%${search}%`),
          like(makers.makerCode, `%${search}%`)
        ));
    }
    return await db.select().from(makers);
  }

  async getMakerById(id: number): Promise<Maker | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(makers).where(eq(makers.id, id));
    return result[0];
  }

  async createMaker(maker: InsertMaker): Promise<Maker> {
    const db = await this.getDb();
    const result = await db.insert(makers).values(maker).returning();
    return result[0];
  }

  async updateMaker(id: number, data: Partial<InsertMaker>): Promise<Maker> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(makers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(makers.id, id))
      .returning();
    return result[0];
  }

  async deleteMaker(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(makers).where(eq(makers.id, id));
  }

  // ============= MASTER LISTS =============
  async getMasterLists(listType?: string): Promise<MasterList[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    if (listType) {
      return await db.select().from(masterLists)
        .where(and(eq(masterLists.listType, listType), eq(masterLists.isActive, true)));
    }
    return await db.select().from(masterLists).where(eq(masterLists.isActive, true));
  }

  async getMasterListById(id: number): Promise<MasterList | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(masterLists).where(eq(masterLists.id, id));
    return result[0];
  }

  async getMasterListsByType(listType: string): Promise<MasterList[]> {
    return this.getMasterLists(listType);
  }

  async createMasterList(list: InsertMasterList): Promise<MasterList> {
    const db = await this.getDb();
    const result = await db.insert(masterLists).values(list).returning();
    return result[0];
  }

  async updateMasterList(id: number, data: Partial<InsertMasterList>): Promise<MasterList> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(masterLists)
      .set(data)
      .where(eq(masterLists.id, id))
      .returning();
    return result[0];
  }

  async deleteMasterList(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(masterLists).where(eq(masterLists.id, id));
  }

  // ============= CHANGE REQUEST OPERATIONS (PostgreSQL) =============
  
  async bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const updatedSpares: Spare[] = [];
    
    for (const update of updates) {
      const spare = await this.getSpare(update.id);
      if (!spare) continue;
      
      let netChange = 0;
      if (update.consumed) {
        netChange -= update.consumed;
      }
      if (update.received) {
        netChange += update.received;
      }
      
      if (netChange !== 0) {
        const newRob = Math.max(0, spare.rob + netChange);
        const updated = await db.update(spares)
          .set({ rob: newRob, updatedAt: new Date() })
          .where(eq(spares.id, update.id))
          .returning();
        
        await this.createSpareHistory({
          timestampUTC: new Date(),
          vesselId: spare.vesselId || '',
          spareId: update.id,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: spare.componentId || '',
          componentCode: spare.componentCode || '',
          componentName: spare.componentName,
          componentSpareCode: spare.componentSpareCode || '',
          eventType: netChange > 0 ? 'RECEIVE' : 'CONSUME',
          qtyChange: netChange,
          robAfter: newRob,
          userId,
          remarks,
          place: update.receivedPlace,
          dateLocal: update.receivedDate,
          tz: 'UTC'
        });
        
        if (updated[0]) updatedSpares.push(updated[0]);
      }
    }
    
    return updatedSpares;
  }

  async updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(changeRequests)
      .set({ targetType, targetId, snapshotBeforeJson, updatedAt: new Date() })
      .where(eq(changeRequests.id, id))
      .returning();
    if (!result[0]) throw new Error(`Change request ${id} not found`);
    return result[0];
  }

  async updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const updateData: any = { proposedChangesJson, updatedAt: new Date() };
    if (movePreviewJson !== undefined) {
      updateData.movePreviewJson = movePreviewJson;
    }
    const result = await db.update(changeRequests)
      .set(updateData)
      .where(eq(changeRequests.id, id))
      .returning();
    if (!result[0]) throw new Error(`Change request ${id} not found`);
    return result[0];
  }

  async deleteChangeRequest(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(changeRequests).where(eq(changeRequests.id, id));
  }

  async submitChangeRequest(id: number, userId: string): Promise<ChangeRequest> {
    return this.updateChangeRequest(id, { 
      status: 'submitted', 
      submittedAt: new Date(), 
      requestedByUserId: userId 
    });
  }

  async approveChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    const existing = await this.getChangeRequest(id);
    if (!existing) throw new Error(`Change request ${id} not found`);
    
    const now = new Date();
    
    // Rule #17: Increment revision number and add to history
    const newRevisionNumber = (existing.revisionNumber || 0) + 1;
    const revisionHistoryEntry = {
      revisionNumber: newRevisionNumber,
      approvedBy: reviewerId,
      approvedAt: now.toISOString(),
      appliedChanges: existing.proposedChangesJson || [],
      comments: comment
    };
    const updatedHistory = [...(existing.revisionHistory as any[] || []), revisionHistoryEntry];
    
    console.log(`[RULE #17] Change request ${id} approved - Revision #${newRevisionNumber}`);
    
    return this.updateChangeRequest(id, { 
      status: 'approved', 
      reviewedByUserId: reviewerId, 
      reviewedAt: now,
      revisionNumber: newRevisionNumber,
      revisionHistory: updatedHistory
    });
  }

  async rejectChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    return this.updateChangeRequest(id, { 
      status: 'rejected', 
      reviewedByUserId: reviewerId, 
      reviewedAt: new Date() 
    });
  }

  async returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    return this.updateChangeRequest(id, { 
      status: 'returned', 
      reviewedByUserId: reviewerId, 
      reviewedAt: new Date() 
    });
  }

  async getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(changeRequestAttachments)
      .where(eq(changeRequestAttachments.changeRequestId, changeRequestId));
  }

  async createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment> {
    const db = await this.getDb();
    const result = await db.insert(changeRequestAttachments)
      .values({ ...attachment, uploadedAt: new Date() })
      .returning();
    return result[0];
  }

  async getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(changeRequestComments)
      .where(eq(changeRequestComments.changeRequestId, changeRequestId));
  }

  async createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment> {
    const db = await this.getDb();
    const result = await db.insert(changeRequestComments)
      .values({ ...comment, createdAt: new Date() })
      .returning();
    return result[0];
  }

  // ============= BULK OPERATIONS (PostgreSQL) =============

  async bulkCreateComponents(inputComponents: InsertComponent[]): Promise<Component[]> {
    const db = await this.getDb();
    if (inputComponents.length === 0) return [];
    
    const componentsWithDefaults = inputComponents.map(c => ({
      ...c,
      isActive: c.isActive ?? true,
      critical: c.critical ?? false,
      classItem: c.classItem ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    const result = await db.insert(components).values(componentsWithDefaults).returning();
    
    // Update index
    for (const comp of result) {
      if (comp.componentCode) {
        const vesselKey = comp.vesselId || 'global';
        if (!this.componentCodeIndex.has(vesselKey)) {
          this.componentCodeIndex.set(vesselKey, new Map());
        }
        this.componentCodeIndex.get(vesselKey)!.set(comp.componentCode, comp.id);
      }
    }
    
    return result;
  }

  async bulkUpdateComponents(updates: Array<{ id: string; data: Partial<Component> }>): Promise<Component[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const results: Component[] = [];
    
    for (const { id, data } of updates) {
      const result = await db.update(components)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(components.id, id))
        .returning();
      if (result[0]) results.push(result[0]);
    }
    
    return results;
  }

  async bulkUpsertComponents(inputComponents: InsertComponent[]): Promise<{ created: number; updated: number }> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    let created = 0;
    let updated = 0;
    
    for (const comp of inputComponents) {
      if (comp.id) {
        const existing = await this.getComponent(comp.id);
        if (existing) {
          await db.update(components)
            .set({ ...comp, updatedAt: new Date() })
            .where(eq(components.id, comp.id));
          updated++;
          continue;
        }
      }
      
      await db.insert(components).values({
        ...comp,
        isActive: comp.isActive ?? true,
        critical: comp.critical ?? false,
        classItem: comp.classItem ?? false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      created++;
    }
    
    return { created, updated };
  }

  async bulkCreateSpares(inputSpares: InsertSpare[]): Promise<Spare[]> {
    const db = await this.getDb();
    if (inputSpares.length === 0) return [];
    
    const sparesWithDefaults = inputSpares.map(s => ({
      ...s,
      rob: s.rob ?? 0,
      robLocationA: s.robLocationA ?? '0',
      robLocationB: s.robLocationB ?? '0',
      min: s.min ?? '0',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    return await db.insert(spares).values(sparesWithDefaults).returning();
  }

  async bulkUpdateSparesByROB(updates: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const results: Spare[] = [];
    
    for (const { robId, data } of updates) {
      const existingSpares = await db.select().from(spares).where(eq(spares.robId, robId));
      if (existingSpares[0]) {
        const result = await db.update(spares)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(spares.robId, robId))
          .returning();
        if (result[0]) results.push(result[0]);
      }
    }
    
    return results;
  }

  async bulkUpsertSpares(inputSpares: InsertSpare[]): Promise<{ created: number; updated: number }> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    let created = 0;
    let updated = 0;
    
    for (const spare of inputSpares) {
      if (spare.robId) {
        const existingByRobId = await db.select().from(spares).where(eq(spares.robId, spare.robId));
        if (existingByRobId[0]) {
          await db.update(spares)
            .set({ ...spare, updatedAt: new Date() })
            .where(eq(spares.robId, spare.robId));
          updated++;
          continue;
        }
      }
      
      await db.insert(spares).values({
        ...spare,
        rob: spare.rob ?? 0,
        robLocationA: spare.robLocationA ?? '0',
        robLocationB: spare.robLocationB ?? '0',
        min: spare.min ?? '0',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      created++;
    }
    
    return { created, updated };
  }

  async archiveComponentsByIds(ids: string[]): Promise<number> {
    const db = await this.getDb();
    const { inArray } = await import('drizzle-orm');
    if (ids.length === 0) return 0;
    
    const result = await db.update(components)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(components.id, ids))
      .returning();
    
    return result.length;
  }

  async archiveSparesByIds(ids: number[]): Promise<number> {
    const db = await this.getDb();
    const { inArray } = await import('drizzle-orm');
    if (ids.length === 0) return 0;
    
    const result = await db.update(spares)
      .set({ deleted: true, updatedAt: new Date() })
      .where(inArray(spares.id, ids))
      .returning();
    
    return result.length;
  }

  async getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, Component>> {
    // Lazy initialization: rebuild index if empty
    if (this.componentCodeIndex.size === 0) {
      await this.rebuildComponentCodeIndex();
    }
    
    const result = new Map<string, Component>();
    const vesselKey = vesselId || 'global';
    const vesselIndex = this.componentCodeIndex.get(vesselKey);
    
    if (!vesselIndex) {
      return result;
    }
    
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    for (const code of codes) {
      const componentId = vesselIndex.get(code);
      if (componentId) {
        const results = await db.select().from(components).where(eq(components.id, componentId));
        if (results[0]) {
          result.set(code, results[0]);
        }
      }
    }
    return result;
  }

  async getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, Job>> {
    const db = await this.getDb();
    const { eq, and, inArray } = await import('drizzle-orm');
    
    const conditions = [inArray(jobs.jobNo, jobNos)];
    if (vesselId) {
      conditions.push(eq(jobs.vesselId, vesselId));
    }
    
    const results = await db.select().from(jobs).where(and(...conditions));
    const map = new Map<string, Job>();
    for (const job of results) {
      if (job.jobNo) {
        map.set(job.jobNo, job);
      }
    }
    return map;
  }

  async getWorkOrdersByTemplateIds(templateIds: string[], vesselId?: string): Promise<Map<string, WorkOrder>> {
    const db = await this.getDb();
    const { eq, and, inArray } = await import('drizzle-orm');
    
    const conditions = [inArray(workOrders.templateCode, templateIds)];
    if (vesselId) {
      conditions.push(eq(workOrders.vesselId, vesselId));
    }
    
    const results = await db.select().from(workOrders).where(and(...conditions));
    const map = new Map<string, WorkOrder>();
    for (const workOrder of results) {
      if (workOrder.templateCode) {
        map.set(workOrder.templateCode, workOrder);
      }
    }
    return map;
  }

  async archiveComponent(id: string): Promise<Component> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(components)
      .set({ isActive: false })
      .where(eq(components.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component not found: ${id}`);
    }
    return result[0];
  }

  async archiveJob(id: string): Promise<Job> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(jobs)
      .set({ isActive: false })
      .where(eq(jobs.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Job not found: ${id}`);
    }
    return result[0];
  }

  async archiveWorkOrder(id: string): Promise<WorkOrder> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(workOrders)
      .set({ isActive: false })
      .where(eq(workOrders.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`WorkOrder not found: ${id}`);
    }
    return result[0];
  }

  // ============= COMPONENT SECTION H - MAINTENANCE HISTORY =============
  async getComponentMaintenanceHistory(componentId: string): Promise<any[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.componentId, componentId))
      .orderBy(componentMaintenanceHistory.dateCompleted);
  }

  async getComponentMaintenanceHistoryItem(id: number): Promise<any | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.id, id));
    return result[0];
  }

  async createComponentMaintenanceHistory(history: any): Promise<any> {
    const db = await this.getDb();
    const result = await db.insert(componentMaintenanceHistory)
      .values(history)
      .returning();
    return result[0];
  }

  // ============= COMPONENT SECTION H - DOCUMENTS =============
  async getComponentDocuments(componentId: string): Promise<any[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(componentDocuments)
      .where(eq(componentDocuments.componentId, componentId));
  }

  async getComponentDocument(id: number): Promise<any | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(componentDocuments)
      .where(eq(componentDocuments.id, id));
    return result[0];
  }

  async createComponentDocument(doc: any): Promise<any> {
    const db = await this.getDb();
    const result = await db.insert(componentDocuments)
      .values(doc)
      .returning();
    return result[0];
  }

  async updateComponentDocument(id: number, data: any): Promise<any> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(componentDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(componentDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteComponentDocument(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(componentDocuments)
      .where(eq(componentDocuments.id, id));
  }

  // ============= COMPONENT SECTION H - CLASS/REGULATORY =============
  async getComponentClassRegulatory(componentId: string): Promise<any[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(componentClassRegulatory)
      .where(eq(componentClassRegulatory.componentId, componentId));
  }

  async getComponentClassRegulatoryItem(id: number): Promise<any | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(componentClassRegulatory)
      .where(eq(componentClassRegulatory.id, id));
    return result[0];
  }

  async createComponentClassRegulatory(item: any): Promise<any> {
    const db = await this.getDb();
    const result = await db.insert(componentClassRegulatory)
      .values(item)
      .returning();
    return result[0];
  }

  async updateComponentClassRegulatory(id: number, data: any): Promise<any> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(componentClassRegulatory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(componentClassRegulatory.id, id))
      .returning();
    return result[0];
  }

  async deleteComponentClassRegulatory(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(componentClassRegulatory)
      .where(eq(componentClassRegulatory.id, id));
  }

  // ============= ALERT POLICIES (PostgreSQL) =============
  async getAlertPolicies(): Promise<AlertPolicy[]> {
    const db = await this.getDb();
    return await db.select().from(alertPolicies);
  }

  async getAlertPolicy(id: number): Promise<AlertPolicy | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(alertPolicies).where(eq(alertPolicies.id, id));
    return result[0];
  }

  async createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy> {
    const db = await this.getDb();
    const result = await db.insert(alertPolicies).values(policy).returning();
    return result[0];
  }

  async updateAlertPolicy(id: number, data: Partial<AlertPolicy>): Promise<AlertPolicy> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(alertPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertPolicies.id, id))
      .returning();
    if (!result[0]) throw new Error(`Alert policy ${id} not found`);
    return result[0];
  }

  async deleteAlertPolicy(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(alertPolicies).where(eq(alertPolicies.id, id));
  }

  async getAlertEvents(filters?: { startDate?: Date; endDate?: Date; alertType?: string; priority?: string; status?: string; vesselId?: string }): Promise<AlertEvent[]> {
    const db = await this.getDb();
    const { eq, and, gte, lte } = await import('drizzle-orm');
    
    const conditions = [];
    if (filters?.alertType) conditions.push(eq(alertEvents.alertType, filters.alertType));
    if (filters?.priority) conditions.push(eq(alertEvents.priority, filters.priority));
    if (filters?.status) conditions.push(eq(alertEvents.status, filters.status));
    if (filters?.vesselId) conditions.push(eq(alertEvents.vesselId, filters.vesselId));
    if (filters?.startDate) conditions.push(gte(alertEvents.triggeredAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(alertEvents.triggeredAt, filters.endDate));
    
    if (conditions.length === 0) {
      return await db.select().from(alertEvents);
    }
    return await db.select().from(alertEvents).where(and(...conditions));
  }

  async getAlertEvent(id: number): Promise<AlertEvent | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(alertEvents).where(eq(alertEvents.id, id));
    return result[0];
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    const db = await this.getDb();
    const result = await db.insert(alertEvents).values(event).returning();
    return result[0];
  }

  async acknowledgeAlertEvent(id: number, userId: string): Promise<AlertEvent> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(alertEvents)
      .set({ status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedBy: userId })
      .where(eq(alertEvents.id, id))
      .returning();
    if (!result[0]) throw new Error(`Alert event ${id} not found`);
    return result[0];
  }

  async getAlertDeliveries(eventId: number): Promise<AlertDelivery[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(alertDeliveries).where(eq(alertDeliveries.alertEventId, eventId));
  }

  async createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery> {
    const db = await this.getDb();
    const result = await db.insert(alertDeliveries).values(delivery).returning();
    return result[0];
  }

  async updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const updateData: any = { status };
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (status === 'sent') updateData.sentAt = new Date();
    
    const result = await db.update(alertDeliveries)
      .set(updateData)
      .where(eq(alertDeliveries.id, id))
      .returning();
    if (!result[0]) throw new Error(`Alert delivery ${id} not found`);
    return result[0];
  }

  async getAlertConfig(vesselId: string): Promise<AlertConfig | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(alertConfigs).where(eq(alertConfigs.vesselId, vesselId));
    return result[0];
  }

  async createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const existing = await this.getAlertConfig(config.vesselId);
    if (existing) {
      const result = await db.update(alertConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(alertConfigs.vesselId, config.vesselId))
        .returning();
      return result[0];
    }
    
    const result = await db.insert(alertConfigs).values(config).returning();
    return result[0];
  }

  // ============= FORM DEFINITIONS (PostgreSQL) =============
  async getFormDefinitions(): Promise<FormDefinition[]> {
    const db = await this.getDb();
    return await db.select().from(formDefinitions);
  }

  async getFormDefinition(id: number): Promise<FormDefinition | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(formDefinitions).where(eq(formDefinitions.id, id));
    return result[0];
  }

  async getFormDefinitionByName(name: string): Promise<FormDefinition | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(formDefinitions).where(eq(formDefinitions.name, name));
    return result[0];
  }

  async createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition> {
    const db = await this.getDb();
    const result = await db.insert(formDefinitions).values(form).returning();
    return result[0];
  }

  async getFormVersions(formId: number): Promise<FormVersion[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(formVersions).where(eq(formVersions.formDefinitionId, formId));
  }

  async getFormVersion(id: number): Promise<FormVersion | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(formVersions).where(eq(formVersions.id, id));
    return result[0];
  }

  async getLatestPublishedVersion(formId: number): Promise<FormVersion | undefined> {
    const db = await this.getDb();
    const { eq, and, desc } = await import('drizzle-orm');
    const result = await db.select().from(formVersions)
      .where(and(eq(formVersions.formDefinitionId, formId), eq(formVersions.status, 'published')))
      .orderBy(desc(formVersions.versionNumber))
      .limit(1);
    return result[0];
  }

  async getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined> {
    const definition = await this.getFormDefinitionByName(name);
    if (!definition) return undefined;
    return await this.getLatestPublishedVersion(definition.id);
  }

  async createFormVersion(version: InsertFormVersion): Promise<FormVersion> {
    const db = await this.getDb();
    const result = await db.insert(formVersions).values(version).returning();
    return result[0];
  }

  async updateFormVersion(id: number, data: Partial<FormVersion>): Promise<FormVersion> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(formVersions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(formVersions.id, id))
      .returning();
    if (!result[0]) throw new Error(`Form version ${id} not found`);
    return result[0];
  }

  async publishFormVersion(id: number, userId: string, changelog: string): Promise<FormVersion> {
    return this.updateFormVersion(id, {
      status: 'published',
      publishedAt: new Date(),
      publishedBy: userId,
      changelog
    });
  }

  async discardFormVersion(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(formVersions).where(eq(formVersions.id, id));
  }

  async createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage> {
    const db = await this.getDb();
    const result = await db.insert(formVersionUsages).values(usage).returning();
    return result[0];
  }

  async getFormVersionUsage(formVersionId: number): Promise<FormVersionUsage[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(formVersionUsages).where(eq(formVersionUsages.formVersionId, formVersionId));
  }

  async seedForms(): Promise<void> {
    // Seed default form definitions if needed
    const workOrderForm = await this.getFormDefinitionByName('work_order');
    if (!workOrderForm) {
      await this.createFormDefinition({
        name: 'work_order',
        displayName: 'Work Order Form',
        description: 'Standard work order form for maritime PMS',
        category: 'pms'
      });
    }
  }

  // ============= IHM ITEMS (PostgreSQL) =============
  async getIhmItem(id: string, type: 'component' | 'spare'): Promise<any | undefined> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(ihmItems)
      .where(and(eq(ihmItems.itemId, id), eq(ihmItems.itemType, type)));
    return result[0];
  }

  async upsertIhmItem(item: any): Promise<any> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    const existing = await this.getIhmItem(item.itemId, item.itemType);
    if (existing) {
      const result = await db.update(ihmItems)
        .set({ ...item, updatedAt: new Date() })
        .where(and(eq(ihmItems.itemId, item.itemId), eq(ihmItems.itemType, item.itemType)))
        .returning();
      return result[0];
    }
    
    const result = await db.insert(ihmItems).values(item).returning();
    return result[0];
  }

  async getIhmMaintenanceLog(filters: any): Promise<any[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    const conditions = [];
    if (filters?.vesselId) conditions.push(eq(ihmMaintenanceLog.vesselId, filters.vesselId));
    if (filters?.itemType) conditions.push(eq(ihmMaintenanceLog.itemType, filters.itemType));
    
    if (conditions.length === 0) {
      return await db.select().from(ihmMaintenanceLog);
    }
    return await db.select().from(ihmMaintenanceLog).where(and(...conditions));
  }

  async createIhmMaintenanceLogEntry(entry: any): Promise<any> {
    const db = await this.getDb();
    const result = await db.insert(ihmMaintenanceLog).values(entry).returning();
    return result[0];
  }

  async getIhmStatusReport(vesselId: string): Promise<any[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(ihmItems).where(eq(ihmItems.vesselId, vesselId));
  }

  // ============= BULK WORK ORDERS (PostgreSQL) =============
  async bulkCreateWorkOrders(inputWorkOrders: InsertWorkOrder[]): Promise<WorkOrder[]> {
    const db = await this.getDb();
    if (inputWorkOrders.length === 0) return [];
    
    const ordersWithDefaults = inputWorkOrders.map(wo => ({
      ...wo,
      status: wo.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    return await db.insert(workOrders).values(ordersWithDefaults).returning();
  }

  async bulkUpdateWorkOrders(updates: Array<{ templateCode: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const results: WorkOrder[] = [];
    
    for (const { templateCode, data } of updates) {
      const existing = await db.select().from(workOrders).where(eq(workOrders.templateCode, templateCode));
      if (existing[0]) {
        const result = await db.update(workOrders)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(workOrders.templateCode, templateCode))
          .returning();
        if (result[0]) results.push(result[0]);
      }
    }
    
    return results;
  }

  async bulkUpsertWorkOrders(inputWorkOrders: InsertWorkOrder[]): Promise<{ created: number; updated: number }> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    let created = 0;
    let updated = 0;
    
    for (const wo of inputWorkOrders) {
      if (wo.id) {
        const existing = await this.getWorkOrder(wo.id);
        if (existing) {
          await db.update(workOrders)
            .set({ ...wo, updatedAt: new Date() })
            .where(eq(workOrders.id, wo.id));
          updated++;
          continue;
        }
      }
      
      await db.insert(workOrders).values({
        ...wo,
        status: wo.status || 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      created++;
    }
    
    return { created, updated };
  }

  // ============= FLEET JOBS (PostgreSQL) =============
  async getFleetJobs(): Promise<WorkOrder[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(workOrders).where(eq(workOrders.isFleetTemplate, true));
  }

  async getFleetJob(id: string): Promise<WorkOrder | undefined> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.isFleetTemplate, true)));
    return result[0];
  }

  async createFleetJob(job: InsertWorkOrder): Promise<WorkOrder> {
    const db = await this.getDb();
    const result = await db.insert(workOrders)
      .values({ ...job, isFleetTemplate: true, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return result[0];
  }

  async updateFleetJob(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.update(workOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workOrders.id, id), eq(workOrders.isFleetTemplate, true)))
      .returning();
    if (!result[0]) throw new Error(`Fleet job ${id} not found`);
    return result[0];
  }

  async deleteFleetJob(id: string): Promise<void> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    await db.delete(workOrders).where(and(eq(workOrders.id, id), eq(workOrders.isFleetTemplate, true)));
  }

  // ============= DEFECT OPERATIONS (PostgreSQL) =============
  async addDefectNote(defectId: string, note: { noteText: string; attachments: string[]; createdBy: string; }): Promise<Defect> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const defect = await this.getDefect(defectId);
    if (!defect) throw new Error(`Defect ${defectId} not found`);
    
    const existingNotes = (defect.notes as any[]) || [];
    const newNote = {
      id: `note_${Date.now()}`,
      noteText: note.noteText,
      attachments: note.attachments,
      createdBy: note.createdBy,
      createdAt: new Date().toISOString()
    };
    
    const result = await db.update(defects)
      .set({ notes: [...existingNotes, newNote], updatedAt: new Date() })
      .where(eq(defects.id, defectId))
      .returning();
    
    return result[0];
  }

  async linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const defect = await this.getDefect(defectId);
    if (!defect) throw new Error(`Defect ${defectId} not found`);
    
    const existingLinks = (defect.linkedDefects as string[]) || [];
    const uniqueLinks = [...new Set([...existingLinks, ...linkedDefectIds])];
    
    const result = await db.update(defects)
      .set({ linkedDefects: uniqueLinks, updatedAt: new Date() })
      .where(eq(defects.id, defectId))
      .returning();
    
    return result[0];
  }

  async closeDefect(defectId: string, closure: { closedBy: string; closureComment: string; closureFiles?: string[] }): Promise<Defect> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const result = await db.update(defects)
      .set({
        status: 'closed',
        closedBy: closure.closedBy,
        closedAt: new Date(),
        closureComment: closure.closureComment,
        closureFiles: closure.closureFiles || [],
        updatedAt: new Date()
      })
      .where(eq(defects.id, defectId))
      .returning();
    
    if (!result[0]) throw new Error(`Defect ${defectId} not found`);
    return result[0];
  }

  async calculateAndUpdateRecurringDefects(equipmentKey: string, windowMonths: number = 12): Promise<RecurringDefect | null> {
    const db = await this.getDb();
    const { eq, and, gte } = await import('drizzle-orm');
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - windowMonths);
    
    // Find defects for this equipment within the window
    const equipmentDefects = await db.select().from(defects)
      .where(and(
        eq(defects.equipmentKey, equipmentKey),
        gte(defects.reportedDate, cutoffDate)
      ));
    
    // Need at least 2 defects to be considered recurring
    if (equipmentDefects.length < 2) {
      return null;
    }
    
    // Check if recurring defect record exists
    const existingRecurring = await db.select().from(recurringDefects)
      .where(eq(recurringDefects.equipmentKey, equipmentKey));
    
    const recurringData = {
      equipmentKey,
      occurrenceCount: equipmentDefects.length,
      firstOccurrence: equipmentDefects[0]?.reportedDate || new Date(),
      lastOccurrence: equipmentDefects[equipmentDefects.length - 1]?.reportedDate || new Date(),
      status: 'active' as const,
      updatedAt: new Date()
    };
    
    if (existingRecurring[0]) {
      const result = await db.update(recurringDefects)
        .set(recurringData)
        .where(eq(recurringDefects.id, existingRecurring[0].id))
        .returning();
      return result[0];
    }
    
    const result = await db.insert(recurringDefects)
      .values({ ...recurringData, createdAt: new Date() })
      .returning();
    return result[0];
  }

  async getDefectsForRecurring(recurringId: number): Promise<Defect[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const recurring = await db.select().from(recurringDefects).where(eq(recurringDefects.id, recurringId));
    if (!recurring[0]) return [];
    
    return await db.select().from(defects).where(eq(defects.equipmentKey, recurring[0].equipmentKey));
  }

  async recalculateAllRecurringDefects(): Promise<void> {
    const db = await this.getDb();
    
    // Get all unique equipment keys
    const allDefects = await db.select({ equipmentKey: defects.equipmentKey }).from(defects);
    const uniqueKeys = [...new Set(allDefects.map(d => d.equipmentKey).filter(Boolean))];
    
    console.log(`🔄 Starting recalculation of all recurring defects...`);
    console.log(`📊 Total defects to check: ${allDefects.length}`);
    console.log(`🔧 Found ${uniqueKeys.length} unique equipment keys`);
    
    let groupsCreated = 0;
    for (const key of uniqueKeys) {
      if (key) {
        const result = await this.calculateAndUpdateRecurringDefects(key);
        if (result) groupsCreated++;
      }
    }
    
    console.log(`✅ Recalculation complete: ${groupsCreated} recurring defect groups created from ${uniqueKeys.length} equipment keys`);
  }

  async getDefectBySeedId(seedId: string): Promise<Defect | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(defects).where(eq(defects.seedId, seedId));
    return result[0];
  }

  // ============= VESSEL OPERATIONS (PostgreSQL) =============
  // Vessels are managed as static list in the frontend, these methods provide
  // compatibility with the storage interface using component vesselId lookups
  async getVesselIdByName(vesselName: string): Promise<string | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    // Look up vessel ID from components that have this vessel name
    const result = await db.select({ vesselId: components.vesselId })
      .from(components)
      .where(eq(components.vesselId, vesselName))
      .limit(1);
    
    if (result[0]?.vesselId) return result[0].vesselId;
    
    // Try matching common patterns
    const commonVessels: Record<string, string> = {
      'MV SEAFARER': 'V001',
      'MV VOYAGER': 'V002', 
      'MV EXPLORER': 'V003'
    };
    return commonVessels[vesselName.toUpperCase()];
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    const db = await this.getDb();
    const { vessels } = await import('@shared/schema');
    
    const now = new Date();
    const newVessel: Vessel = {
      id: vessel.id,
      name: vessel.name,
      code: vessel.code || vessel.id,
      fleetId: vessel.fleetId || null,
      imoNumber: vessel.imoNumber || null,
      vesselType: vessel.vesselType || null,
      flag: vessel.flag || null,
      isActive: vessel.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(vessels).values(newVessel);
    console.log(`[VESSEL] Created vessel: ${vessel.id} - ${vessel.name}`);
    return newVessel;
  }

  // ============= STORES METHODS - ZERO PMS LINKAGES =============
  async getStoresItems(vesselId: string, itemType?: string): Promise<StoresItem[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const { storesItems } = await import('@shared/schema');
    
    let query = db.select().from(storesItems)
      .where(
        and(
          eq(storesItems.vesselId, vesselId),
          eq(storesItems.deleted, false),
          itemType ? eq(storesItems.itemType, itemType) : undefined
        )
      );
    
    return await query;
  }

  async getStoresItem(id: number): Promise<StoresItem | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const { storesItems } = await import('@shared/schema');
    
    const result = await db.select().from(storesItems)
      .where(eq(storesItems.id, id));
    return result[0];
  }

  async createStoresItem(item: InsertStoresItem): Promise<StoresItem> {
    const db = await this.getDb();
    const { storesItems } = await import('@shared/schema');
    
    const result = await db.insert(storesItems)
      .values({
        ...item,
        rob: item.rob || "0",
        robLocationA: item.robLocationA || "0",
        robLocationB: item.robLocationB || "0",
        min: item.min || "0",
      })
      .returning();
    return result[0];
  }

  async updateStoresItem(id: number, data: Partial<StoresItem>): Promise<StoresItem> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const { storesItems } = await import('@shared/schema');
    
    const result = await db.update(storesItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(storesItems.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    return result[0];
  }

  async deleteStoresItem(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const { storesItems } = await import('@shared/schema');
    
    await db.update(storesItems)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(storesItems.id, id));
  }

  async consumeStoresItem(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<StoresItem> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const { storesItems, storesLedger } = await import('@shared/schema');
    
    const [item] = await db.select().from(storesItems).where(eq(storesItems.id, id));
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA) : Number(item.robLocationB);
    
    if (qtyNum > locationRob) {
      console.warn(`Insufficient stock at location ${location}. Consuming all available.`);
    }

    const actualConsumed = Math.min(qtyNum, locationRob);
    const newLocationRob = Math.max(0, locationRob - qtyNum);
    const newTotalRob = Number(item.rob) - actualConsumed;

    const [updated] = await db.update(storesItems)
      .set({
        rob: String(Math.max(0, newTotalRob)),
        robLocationA: location === 'A' ? String(newLocationRob) : item.robLocationA,
        robLocationB: location === 'B' ? String(newLocationRob) : item.robLocationB,
        updatedAt: new Date(),
      })
      .where(eq(storesItems.id, id))
      .returning();

    // Create ledger entry
    await db.insert(storesLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom || '',
      eventType: 'CONSUME',
      qtyChangeBase: String(-actualConsumed),
      qtyDisplay: String(-actualConsumed),
      uomDisplay: item.uom || '',
      robAfterBase: updated.rob,
      dateLocal: dateLocal || new Date().toISOString(),
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place || '',
      userId,
      remarks: remarks || '',
    });

    return updated;
  }

  async receiveStoresItem(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    ref?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<StoresItem> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const { storesItems, storesLedger } = await import('@shared/schema');
    
    const [item] = await db.select().from(storesItems).where(eq(storesItems.id, id));
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA) : Number(item.robLocationB);
    const newLocationRob = locationRob + qtyNum;
    const newTotalRob = Number(item.rob) + qtyNum;

    const [updated] = await db.update(storesItems)
      .set({
        rob: String(newTotalRob),
        robLocationA: location === 'A' ? String(newLocationRob) : item.robLocationA,
        robLocationB: location === 'B' ? String(newLocationRob) : item.robLocationB,
        updatedAt: new Date(),
      })
      .where(eq(storesItems.id, id))
      .returning();

    // Create ledger entry
    await db.insert(storesLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom || '',
      eventType: 'RECEIVE',
      qtyChangeBase: String(qtyNum),
      qtyDisplay: String(qtyNum),
      uomDisplay: item.uom || '',
      robAfterBase: updated.rob,
      dateLocal: dateLocal || new Date().toISOString(),
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place || '',
      ref: ref || '',
      userId,
      remarks: remarks || '',
    });

    return updated;
  }

  async getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<StoresLedger[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const { storesLedger } = await import('@shared/schema');
    
    return await db.select().from(storesLedger)
      .where(
        and(
          eq(storesLedger.vesselId, vesselId),
          itemType ? eq(storesLedger.section, itemType) : undefined
        )
      );
  }

  async getStoresItemHistory(itemId: number): Promise<StoresLedger[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const { storesLedger } = await import('@shared/schema');
    
    return await db.select().from(storesLedger)
      .where(eq(storesLedger.itemId, itemId));
  }
  
  async purgeJobsAndLinkedData(vesselId?: string): Promise<{
    deletedWorkOrderExecutions: number;
    deletedWorkOrders: number;
    deletedJobs: number;
    deletedRunningHoursAudits: number;
    componentsReset: number;
  }> {
    const db = await this.getDb();
    const { eq, inArray } = await import('drizzle-orm');
    
    let result = {
      deletedWorkOrderExecutions: 0,
      deletedWorkOrders: 0,
      deletedJobs: 0,
      deletedRunningHoursAudits: 0,
      componentsReset: 0
    };
    
    if (vesselId) {
      // Get jobs for this vessel
      const vesselJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.vesselId, vesselId));
      const jobIds = vesselJobs.map(j => j.id);
      
      if (jobIds.length > 0) {
        // Get work orders for these jobs
        const vesselWorkOrders = await db.select({ id: workOrders.id })
          .from(workOrders)
          .where(inArray(workOrders.jobId, jobIds));
        const woIds = vesselWorkOrders.map(wo => wo.id);
        
        if (woIds.length > 0) {
          // Delete work order executions
          const deletedExecs = await db.delete(workOrderExecutions)
            .where(inArray(workOrderExecutions.workOrderId, woIds))
            .returning();
          result.deletedWorkOrderExecutions = deletedExecs.length;
          
          // Delete work orders
          const deletedWOs = await db.delete(workOrders)
            .where(inArray(workOrders.id, woIds))
            .returning();
          result.deletedWorkOrders = deletedWOs.length;
        }
        
        // Delete jobs
        const deletedJobs = await db.delete(jobs)
          .where(inArray(jobs.id, jobIds))
          .returning();
        result.deletedJobs = deletedJobs.length;
      }
      
      // Delete running hours audits for vessel
      const deletedRHA = await db.delete(runningHoursAudit)
        .where(eq(runningHoursAudit.vesselId, vesselId))
        .returning();
      result.deletedRunningHoursAudits = deletedRHA.length;
      
      // Reset components - clear running hours fields
      const updatedComps = await db.update(components)
        .set({ 
          runningHours: null, 
          previousRunningHours: null,
          updatedAt: new Date() 
        })
        .where(eq(components.vesselId, vesselId))
        .returning();
      result.componentsReset = updatedComps.length;
    } else {
      // Purge all - dangerous operation
      const allExecs = await db.delete(workOrderExecutions).returning();
      result.deletedWorkOrderExecutions = allExecs.length;
      
      const allWOs = await db.delete(workOrders).returning();
      result.deletedWorkOrders = allWOs.length;
      
      const allJobs = await db.delete(jobs).returning();
      result.deletedJobs = allJobs.length;
      
      const allRHA = await db.delete(runningHoursAudit).returning();
      result.deletedRunningHoursAudits = allRHA.length;
      
      const allComps = await db.update(components)
        .set({ 
          runningHours: null, 
          previousRunningHours: null,
          updatedAt: new Date() 
        })
        .returning();
      result.componentsReset = allComps.length;
    }
    
    console.log(`[PURGE] Jobs and linked data purged: ${JSON.stringify(result)}`);
    return result;
  }

  // ============= PMS VESSEL SETTINGS =============
  async getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, vesselId));
    return result[0];
  }

  async getAllPmsVesselSettings(): Promise<PmsVesselSettings[]> {
    const db = await this.getDb();
    return await db.select().from(pmsVesselSettings);
  }

  async createOrUpdatePmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    
    const existing = await db.select().from(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, settings.vesselId));
    
    if (existing.length > 0) {
      const result = await db.update(pmsVesselSettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(pmsVesselSettings.vesselId, settings.vesselId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(pmsVesselSettings).values({
        ...settings,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      return result[0];
    }
  }

  async deletePmsVesselSettings(vesselId: string): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.delete(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, vesselId));
  }
  
  // =====================================================
  // MAKER LIST - Master data for manufacturers
  // =====================================================
  
  async getMakerList(): Promise<MakerList[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(makerList).where(eq(makerList.isActive, true));
  }
  
  async getMaker(id: number): Promise<MakerList | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(makerList).where(eq(makerList.id, id));
    return result[0];
  }
  
  async getMakerByCode(makerCode: string): Promise<MakerList | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(makerList).where(eq(makerList.makerCode, makerCode));
    return result[0];
  }
  
  async createMaker(maker: InsertMakerList): Promise<MakerList> {
    const db = await this.getDb();
    const result = await db.insert(makerList).values({
      ...maker,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async updateMaker(id: number, data: Partial<MakerList>): Promise<MakerList> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(makerList)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(makerList.id, id))
      .returning();
    return result[0];
  }
  
  async deleteMaker(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(makerList)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(makerList.id, id));
  }
  
  // =====================================================
  // SFI DETAILS - SFI Code lookup table
  // =====================================================
  
  async getSfiDetails(): Promise<SfiDetails[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(sfiDetails).where(eq(sfiDetails.isActive, true));
  }
  
  async getSfiDetail(id: number): Promise<SfiDetails | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(sfiDetails).where(eq(sfiDetails.id, id));
    return result[0];
  }
  
  async getSfiByCode(componentCode: string): Promise<SfiDetails | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(sfiDetails).where(eq(sfiDetails.componentCode, componentCode));
    return result[0];
  }
  
  async createSfiDetail(sfi: InsertSfiDetails): Promise<SfiDetails> {
    const db = await this.getDb();
    const result = await db.insert(sfiDetails).values({
      ...sfi,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async updateSfiDetail(id: number, data: Partial<SfiDetails>): Promise<SfiDetails> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(sfiDetails)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(sfiDetails.id, id))
      .returning();
    return result[0];
  }
  
  async deleteSfiDetail(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(sfiDetails)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sfiDetails.id, id));
  }
  
  // =====================================================
  // MASTER DATA - Fleet Equipment Code generation and tracking
  // =====================================================
  
  async getMasterDataList(): Promise<MasterData[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(masterData).where(eq(masterData.isActive, true));
  }
  
  async getMasterDataItem(id: number): Promise<MasterData | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(masterData).where(eq(masterData.id, id));
    return result[0];
  }
  
  async getMasterDataByFleetCode(fleetEquipmentCode: string): Promise<MasterData | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(masterData).where(eq(masterData.fleetEquipmentCode, fleetEquipmentCode));
    return result[0];
  }
  
  async getMasterDataByMakerModel(makerCode: string, model: string): Promise<MasterData | undefined> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(masterData)
      .where(and(
        eq(masterData.makerCode, makerCode),
        eq(masterData.model, model),
        eq(masterData.isActive, true)
      ));
    return result[0];
  }
  
  async createMasterData(data: InsertMasterData): Promise<MasterData> {
    const db = await this.getDb();
    const result = await db.insert(masterData).values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async updateMasterData(id: number, data: Partial<MasterData>): Promise<MasterData> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(masterData)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(masterData.id, id))
      .returning();
    return result[0];
  }
  
  async deleteMasterData(id: number): Promise<void> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(masterData)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(masterData.id, id));
  }
  
  async generateFleetEquipmentCode(sfiCode: string): Promise<string> {
    const db = await this.getDb();
    const { eq, like } = await import('drizzle-orm');
    
    // Find existing codes with this SFI prefix
    const existingRecords = await db.select({ fleetEquipmentCode: masterData.fleetEquipmentCode })
      .from(masterData)
      .where(eq(masterData.sfiCode, sfiCode));
    
    const existingCodes = existingRecords.map(r => r.fleetEquipmentCode);
    
    // Parse existing sequence numbers
    const seqNumbers = existingCodes.map(code => {
      const parts = code.split('.');
      if (parts.length >= 2) {
        const seqPart = parts[1];
        return parseInt(seqPart, 10) || 0;
      }
      return 0;
    });
    
    const nextSeq = Math.max(0, ...seqNumbers) + 1;
    const seqStr = nextSeq.toString().padStart(3, '0');
    
    // Generate sub-code (AA, AB, AC, etc.)
    const subCodeIndex = existingCodes.filter(c => c.startsWith(`${sfiCode}.${seqStr}`)).length;
    const subCode = String.fromCharCode(65 + Math.floor(subCodeIndex / 26)) + 
                    String.fromCharCode(65 + (subCodeIndex % 26));
    
    return `${sfiCode}.${seqStr}.${subCode}`;
  }
  
  // =====================================================
  // FLEET VESSEL MAPPING
  // =====================================================
  
  async getFleetVesselMappings(fleetEquipmentCode?: string): Promise<FleetVesselMapping[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    if (fleetEquipmentCode) {
      return await db.select().from(fleetVesselMapping)
        .where(and(
          eq(fleetVesselMapping.fleetEquipmentCode, fleetEquipmentCode),
          eq(fleetVesselMapping.isActive, true)
        ));
    }
    return await db.select().from(fleetVesselMapping).where(eq(fleetVesselMapping.isActive, true));
  }
  
  async getFleetVesselMappingsByVessel(vesselCode: string): Promise<FleetVesselMapping[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    return await db.select().from(fleetVesselMapping)
      .where(and(
        eq(fleetVesselMapping.vesselCode, vesselCode),
        eq(fleetVesselMapping.isActive, true)
      ));
  }
  
  async createFleetVesselMappingRecord(mapping: InsertFleetVesselMapping): Promise<FleetVesselMapping> {
    const db = await this.getDb();
    const result = await db.insert(fleetVesselMapping).values({
      ...mapping,
      mappedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async removeFleetVesselMappingRecord(fleetEquipmentCode: string, vesselCode: string): Promise<void> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    await db.update(fleetVesselMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetVesselMapping.fleetEquipmentCode, fleetEquipmentCode),
        eq(fleetVesselMapping.vesselCode, vesselCode)
      ));
  }
  
  // =====================================================
  // FLEET COMPONENT MAPPING
  // =====================================================
  
  async getFleetComponentMappings(fleetEquipmentCode?: string): Promise<FleetComponentMapping[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    const conditions = [eq(fleetComponentMapping.isActive, true)];
    if (fleetEquipmentCode) {
      conditions.push(eq(fleetComponentMapping.fleetEquipmentCode, fleetEquipmentCode));
    }
    
    return await db.select().from(fleetComponentMapping).where(and(...conditions));
  }
  
  async getFleetComponentMappingsByVessel(vesselCode?: string): Promise<FleetComponentMapping[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    const conditions = [eq(fleetComponentMapping.isActive, true)];
    if (vesselCode) {
      conditions.push(eq(fleetComponentMapping.vesselCode, vesselCode));
    }
    
    return await db.select().from(fleetComponentMapping).where(and(...conditions));
  }
  
  async createFleetComponentMappingRecord(mapping: InsertFleetComponentMapping): Promise<FleetComponentMapping> {
    const db = await this.getDb();
    const result = await db.insert(fleetComponentMapping).values({
      ...mapping,
      mappedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async removeFleetComponentMappingRecord(fleetEquipmentCode: string, vesselCode: string, componentCode: string): Promise<void> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    await db.update(fleetComponentMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetComponentMapping.fleetEquipmentCode, fleetEquipmentCode),
        eq(fleetComponentMapping.vesselCode, vesselCode),
        eq(fleetComponentMapping.componentCode, componentCode)
      ));
  }
  
  // =====================================================
  // FLEET JOB VESSEL MAPPING
  // =====================================================
  
  async getFleetJobVesselMappings(fleetEquipmentCode?: string, jobCode?: string): Promise<FleetJobVesselMapping[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    const conditions = [eq(fleetJobVesselMapping.isActive, true)];
    if (fleetEquipmentCode) {
      conditions.push(eq(fleetJobVesselMapping.fleetEquipmentCode, fleetEquipmentCode));
    }
    if (jobCode) {
      conditions.push(eq(fleetJobVesselMapping.jobCode, jobCode));
    }
    
    return await db.select().from(fleetJobVesselMapping).where(and(...conditions));
  }
  
  async createFleetJobVesselMappingRecord(mapping: InsertFleetJobVesselMapping): Promise<FleetJobVesselMapping> {
    const db = await this.getDb();
    const result = await db.insert(fleetJobVesselMapping).values({
      ...mapping,
      mappedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string): Promise<void> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    await db.update(fleetJobVesselMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetJobVesselMapping.jobCode, jobCode),
        eq(fleetJobVesselMapping.vesselCode, vesselCode)
      ));
  }
  
  // =====================================================
  // FLEET SPARE VESSEL MAPPING
  // =====================================================
  
  async getFleetSpareVesselMappings(fleetEquipmentCode?: string, partCode?: string): Promise<FleetSpareVesselMapping[]> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    const conditions = [eq(fleetSpareVesselMapping.isActive, true)];
    if (fleetEquipmentCode) {
      conditions.push(eq(fleetSpareVesselMapping.fleetEquipmentCode, fleetEquipmentCode));
    }
    if (partCode) {
      conditions.push(eq(fleetSpareVesselMapping.partCode, partCode));
    }
    
    return await db.select().from(fleetSpareVesselMapping).where(and(...conditions));
  }
  
  async createFleetSpareVesselMappingRecord(mapping: InsertFleetSpareVesselMapping): Promise<FleetSpareVesselMapping> {
    const db = await this.getDb();
    const result = await db.insert(fleetSpareVesselMapping).values({
      ...mapping,
      mappedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string): Promise<void> {
    const db = await this.getDb();
    const { eq, and } = await import('drizzle-orm');
    
    await db.update(fleetSpareVesselMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetSpareVesselMapping.partCode, partCode),
        eq(fleetSpareVesselMapping.vesselCode, vesselCode)
      ));
  }
  
  // =====================================================
  // BULK IMPORT HISTORY
  // =====================================================
  
  async getBulkImportHistory(vesselCode?: string, moduleType?: string): Promise<BulkImportHistory[]> {
    const db = await this.getDb();
    const { eq, and, desc } = await import('drizzle-orm');
    
    const conditions = [];
    if (vesselCode) {
      conditions.push(eq(bulkImportHistory.vesselCode, vesselCode));
    }
    if (moduleType) {
      conditions.push(eq(bulkImportHistory.moduleType, moduleType));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(bulkImportHistory)
        .where(and(...conditions))
        .orderBy(desc(bulkImportHistory.uploadedAt));
    }
    
    return await db.select().from(bulkImportHistory)
      .orderBy(desc(bulkImportHistory.uploadedAt));
  }
  
  async getBulkImportHistoryItem(id: number): Promise<BulkImportHistory | undefined> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.select().from(bulkImportHistory).where(eq(bulkImportHistory.id, id));
    return result[0];
  }
  
  async createBulkImportHistory(history: InsertBulkImportHistory): Promise<BulkImportHistory> {
    const db = await this.getDb();
    const result = await db.insert(bulkImportHistory).values({
      ...history,
      uploadedAt: new Date()
    }).returning();
    return result[0];
  }
  
  async updateBulkImportHistory(id: number, data: Partial<BulkImportHistory>): Promise<BulkImportHistory> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    const result = await db.update(bulkImportHistory)
      .set(data)
      .where(eq(bulkImportHistory.id, id))
      .returning();
    return result[0];
  }
  
  // =====================================================
  // BULK IMPORT ERRORS
  // =====================================================
  
  async getBulkImportErrors(importId: number): Promise<BulkImportError[]> {
    const db = await this.getDb();
    const { eq } = await import('drizzle-orm');
    return await db.select().from(bulkImportErrors).where(eq(bulkImportErrors.importId, importId));
  }
  
  async createBulkImportError(error: InsertBulkImportError): Promise<BulkImportError> {
    const db = await this.getDb();
    const result = await db.insert(bulkImportErrors).values({
      ...error,
      createdAt: new Date()
    }).returning();
    return result[0];
  }
  
  async createBulkImportErrors(errors: InsertBulkImportError[]): Promise<BulkImportError[]> {
    if (errors.length === 0) return [];
    const db = await this.getDb();
    const result = await db.insert(bulkImportErrors).values(
      errors.map(e => ({ ...e, createdAt: new Date() }))
    ).returning();
    return result;
  }
  
  // =====================================================
  // FLEET ADMIN DASHBOARD METRICS
  // =====================================================
  
  async getFleetAdminMetrics(): Promise<{
    totalMakers: number;
    totalModels: number;
    totalFleetComponents: number;
    totalMasterLists: number;
  }> {
    const db = await this.getDb();
    const { eq, count, sql } = await import('drizzle-orm');
    
    const [makersResult] = await db.select({ count: count() }).from(makerList).where(eq(makerList.isActive, true));
    const [modelsResult] = await db.select({ count: count() }).from(masterData).where(eq(masterData.isActive, true));
    const [fleetCompResult] = await db.select({ count: count() }).from(components).where(eq(components.dataScope, 'fleet'));
    const [masterListResult] = await db.select({ count: count() }).from(masterLists).where(eq(masterLists.isActive, true));
    
    return {
      totalMakers: makersResult?.count || 0,
      totalModels: modelsResult?.count || 0,
      totalFleetComponents: fleetCompResult?.count || 0,
      totalMasterLists: masterListResult?.count || 0,
    };
  }
}

// Dynamic storage selection based on DATABASE_URL availability
import { PersistentFileStorage } from "./persistentStorage";

let storage: IStorage;

// Debug: Check if DATABASE_URL is available
console.log(`🔍 DATABASE_URL check: ${process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND'}`);
if (process.env.DATABASE_URL) {
  console.log(`📊 DATABASE_URL length: ${process.env.DATABASE_URL.length} characters`);
}

if (process.env.DATABASE_URL) {
  storage = new PostgresStorage();
  console.log("✅ Application configured with PostgresStorage - connected to PostgreSQL database");
} else {
  storage = new PersistentFileStorage('test-data.json');
  console.log("✅ Application configured with PersistentFileStorage - all data will persist to test-data.json");
}

export { storage };
