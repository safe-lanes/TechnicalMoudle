import { eq, and, desc, sql, inArray, or, ilike, asc, gte, lte } from 'drizzle-orm';
import { getDb } from './db';
import {
  users,
  fleets,
  vessels,
  pmsVesselSettings,
  makers,
  masterLists,
  makerList,
  sfiDetails,
  masterData,
  components,
  componentDocuments,
  componentClassRegulatory,
  componentMaintenanceHistory,
  componentRequisitions,
  runningHoursAudit,
  jobs,
  workOrders,
  spares,
  sparesHistory,
  storesItems,
  storesLedger,
  defects,
  defectActions,
  defectAttachments,
  defectSequences,
  recurringDefects,
  recurringDefectLinks,
  alertPolicies,
  alertEvents,
  alertDeliveries,
  alertConfig,
  formDefinitions,
  formVersions,
  formVersionUsage,
  changeRequest,
  changeRequestAttachment,
  changeRequestComment,
  ihmItems,
  ihmMaintenanceLog,
  fleetVesselMapping,
  fleetComponentMapping,
  fleetJobVesselMapping,
  fleetSpareVesselMapping,
  certificates,
  surveys,
  workOrderExecutionDetails,
  workOrderExecutions,
  type User,
  type InsertUser,
  type Fleet,
  type InsertFleet,
  type Vessel,
  type InsertVessel,
  type PmsVesselSettings,
  type InsertPmsVesselSettings,
  type Maker,
  type InsertMaker,
  type MasterList,
  type InsertMasterList,
  type MakerList,
  type InsertMakerList,
  type SfiDetails,
  type InsertSfiDetails,
  type MasterData,
  type InsertMasterData,
  type Component,
  type InsertComponent,
  type ComponentDocument,
  type InsertComponentDocument,
  type ComponentClassRegulatory,
  type InsertComponentClassRegulatory,
  type ComponentMaintenanceHistory,
  type InsertComponentMaintenanceHistory,
  type ComponentRequisition,
  type InsertComponentRequisition,
  type RunningHoursAudit,
  type InsertRunningHoursAudit,
  type Job,
  type InsertJob,
  type WorkOrder,
  type InsertWorkOrder,
  type Spare,
  type InsertSpare,
  type SpareHistory,
  type InsertSpareHistory,
  type StoresItem,
  type InsertStoresItem,
  type StoresLedger,
  type InsertStoresLedger,
  type Defect,
  type InsertDefect,
  type DefectAction,
  type InsertDefectAction,
  type DefectAttachment,
  type InsertDefectAttachment,
  type RecurringDefect,
  type InsertRecurringDefect,
  type RecurringDefectLink,
  type InsertRecurringDefectLink,
  type AlertPolicy,
  type InsertAlertPolicy,
  type AlertEvent,
  type InsertAlertEvent,
  type AlertDelivery,
  type InsertAlertDelivery,
  type AlertConfig,
  type InsertAlertConfig,
  type FormDefinition,
  type InsertFormDefinition,
  type FormVersion,
  type InsertFormVersion,
  type FormVersionUsage,
  type InsertFormVersionUsage,
  type ChangeRequest,
  type InsertChangeRequest,
  type ChangeRequestAttachment,
  type InsertChangeRequestAttachment,
  type ChangeRequestComment,
  type InsertChangeRequestComment,
  type IhmItem,
  type InsertIhmItem,
  type IhmMaintenanceLog,
  type InsertIhmMaintenanceLog,
  type FleetVesselMapping,
  type InsertFleetVesselMapping,
  type FleetComponentMapping,
  type Certificate,
  type InsertCertificate,
  type Survey,
  type InsertSurvey,
  type WorkOrderExecutionDetails,
  type InsertWorkOrderExecutionDetails,
  type WorkOrderExecution,
  type InsertWorkOrderExecution,
  type InsertFleetComponentMapping,
  type FleetJobVesselMapping,
  type InsertFleetJobVesselMapping,
  type FleetSpareVesselMapping,
  type InsertFleetSpareVesselMapping,
  importHistory,
  importChangeLog,
  auditLog,
  bulkImportHistory,
  bulkImportErrors,
  type ImportHistory,
  type InsertImportHistory,
  type ImportChangeLog,
  type InsertImportChangeLog,
  type AuditLog,
  type InsertAuditLog,
  type BulkImportHistory,
  type InsertBulkImportHistory,
  type BulkImportError,
  type InsertBulkImportError,
  locations,
  spareComponentLinks,
  spareLocationStock,
  inventoryTransactions,
  jobComponentLinks,
  type Location,
  type InsertLocation,
  type SpareComponentLink,
  type InsertSpareComponentLink,
  type SpareLocationStock,
  type InsertSpareLocationStock,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  type InventoryEventType,
  type InventoryReferenceType,
  type SpareWithInventory,
  type JobComponentLink,
  type InsertJobComponentLink,
} from '@shared/schema';

/**
 * PostgreSQL Storage Implementation
 * Module 1: Core Reference Data (users, fleets, vessels, pms_vessel_settings)
 * 
 * This file implements IStorage methods using PostgreSQL via Drizzle ORM.
 * Additional modules will be added incrementally.
 */
export class PostgresStorage {
  
  // ============= USERS (Module 1) =============
  
  async getUser(id: number): Promise<User | undefined> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const db = await getDb();
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    const db = await getDb();
    return await db.select().from(users);
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const db = await getDb();
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`User ${id} not found`);
    }
    return result[0];
  }

  async deleteUser(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(users).where(eq(users.id, id));
  }

  // ============= FLEETS (Module 1) =============

  async getFleets(): Promise<Fleet[]> {
    const db = await getDb();
    return await db.select().from(fleets);
  }

  async getFleet(id: string): Promise<Fleet | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleets).where(eq(fleets.id, id));
    return result[0];
  }

  async getFleetByCode(code: string): Promise<Fleet | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleets).where(eq(fleets.code, code));
    return result[0];
  }

  async createFleet(fleet: InsertFleet): Promise<Fleet> {
    const db = await getDb();
    const result = await db.insert(fleets).values(fleet).returning();
    return result[0];
  }

  async updateFleet(id: string, data: Partial<Fleet>): Promise<Fleet> {
    const db = await getDb();
    const result = await db.update(fleets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fleets.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Fleet ${id} not found`);
    }
    return result[0];
  }

  async deleteFleet(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(fleets).where(eq(fleets.id, id));
  }

  // ============= VESSELS (Module 1) =============

  async getVessels(): Promise<Array<{id: string, name: string, code: string}>> {
    const db = await getDb();
    const result = await db.select().from(vessels);
    return result.map(v => ({
      id: v.id,
      name: v.name,
      code: v.code
    }));
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.id, id));
    return result[0];
  }

  async getVesselByCode(code: string): Promise<Vessel | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.code, code));
    return result[0];
  }

  async getVesselIdByName(vesselName: string): Promise<string | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.name, vesselName));
    return result[0]?.id;
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    const db = await getDb();
    const result = await db.insert(vessels).values(vessel).returning();
    return result[0];
  }

  async updateVessel(id: string, data: Partial<Vessel>): Promise<Vessel> {
    const db = await getDb();
    const result = await db.update(vessels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vessels.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Vessel ${id} not found`);
    }
    return result[0];
  }

  async deleteVessel(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(vessels).where(eq(vessels.id, id));
  }

  // ============= PMS VESSEL SETTINGS (Module 1) =============

  async getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined> {
    const db = await getDb();
    const result = await db.select().from(pmsVesselSettings)
      .where(eq(pmsVesselSettings.vesselId, vesselId));
    return result[0];
  }

  async getAllPmsVesselSettings(): Promise<PmsVesselSettings[]> {
    const db = await getDb();
    return await db.select().from(pmsVesselSettings);
  }

  async createPmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    const db = await getDb();
    const result = await db.insert(pmsVesselSettings).values(settings).returning();
    return result[0];
  }

  async updatePmsVesselSettings(id: number, data: Partial<PmsVesselSettings>): Promise<PmsVesselSettings> {
    const db = await getDb();
    const result = await db.update(pmsVesselSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pmsVesselSettings.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`PMS Vessel Settings ${id} not found`);
    }
    return result[0];
  }

  async upsertPmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    const existing = await this.getPmsVesselSettings(settings.vesselId);
    
    if (existing) {
      return await this.updatePmsVesselSettings(existing.id, settings);
    } else {
      return await this.createPmsVesselSettings(settings);
    }
  }

  async deletePmsVesselSettings(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(pmsVesselSettings).where(eq(pmsVesselSettings.id, id));
  }

  // ============= MODULE 2: MAKERS =============

  async getMakers(search?: string): Promise<Maker[]> {
    const db = await getDb();
    if (search) {
      const searchPattern = `%${search}%`;
      const result = await db.select().from(makers)
        .where(or(
          ilike(makers.makerName, searchPattern),
          ilike(makers.makerCode, searchPattern)
        ))
        .orderBy(asc(makers.makerName));
      return result;
    }
    return await db.select().from(makers).orderBy(asc(makers.makerName));
  }

  async getMakerById(id: number): Promise<Maker | undefined> {
    const db = await getDb();
    const result = await db.select().from(makers).where(eq(makers.id, id));
    return result[0];
  }

  async createMaker(maker: InsertMaker): Promise<Maker> {
    const db = await getDb();
    // Generate makerCode if not provided
    let makerCode = maker.makerCode;
    if (!makerCode) {
      const allMakers = await db.select({ id: makers.id }).from(makers);
      const nextId = allMakers.length > 0 ? Math.max(...allMakers.map(m => m.id)) + 1 : 1;
      makerCode = `MKR-${String(nextId).padStart(6, '0')}`;
    }
    const result = await db.insert(makers).values({
      ...maker,
      makerCode,
    }).returning();
    return result[0];
  }

  async updateMaker(id: number, data: Partial<InsertMaker>): Promise<Maker> {
    const db = await getDb();
    const result = await db.update(makers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(makers.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Maker with id ${id} not found`);
    }
    return result[0];
  }

  async deleteMaker(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(makers).where(eq(makers.id, id));
  }

  // ============= MODULE 2: MASTER LISTS =============

  async getMasterLists(listType?: string): Promise<MasterList[]> {
    const db = await getDb();
    if (listType) {
      return await db.select().from(masterLists)
        .where(and(eq(masterLists.listType, listType), eq(masterLists.isActive, true)))
        .orderBy(asc(masterLists.listType), asc(masterLists.displayOrder));
    }
    return await db.select().from(masterLists)
      .where(eq(masterLists.isActive, true))
      .orderBy(asc(masterLists.listType), asc(masterLists.displayOrder));
  }

  async getMasterListById(id: number): Promise<MasterList | undefined> {
    const db = await getDb();
    const result = await db.select().from(masterLists).where(eq(masterLists.id, id));
    return result[0];
  }

  async getMasterListsByType(listType: string): Promise<MasterList[]> {
    return this.getMasterLists(listType);
  }

  async createMasterList(list: InsertMasterList): Promise<MasterList> {
    const db = await getDb();
    const result = await db.insert(masterLists).values(list).returning();
    return result[0];
  }

  async updateMasterList(id: number, data: Partial<InsertMasterList>): Promise<MasterList> {
    const db = await getDb();
    const result = await db.update(masterLists)
      .set(data)
      .where(eq(masterLists.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Master list with id ${id} not found`);
    }
    return result[0];
  }

  async deleteMasterList(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(masterLists).where(eq(masterLists.id, id));
  }

  // ============= MODULE 2: MAKER LIST =============

  async getMakerList(): Promise<MakerList[]> {
    const db = await getDb();
    return await db.select().from(makerList).where(eq(makerList.isActive, true));
  }

  async getMakerListItem(id: number): Promise<MakerList | undefined> {
    const db = await getDb();
    const result = await db.select().from(makerList).where(eq(makerList.id, id));
    return result[0];
  }

  async getMakerListByCode(makerCode: string): Promise<MakerList | undefined> {
    const db = await getDb();
    const result = await db.select().from(makerList).where(eq(makerList.makerCode, makerCode));
    return result[0];
  }

  async createMakerListItem(maker: InsertMakerList): Promise<MakerList> {
    const db = await getDb();
    const result = await db.insert(makerList).values({
      makerCode: maker.makerCode,
      makerName: maker.makerName,
      address: maker.address || null,
      addressId: maker.addressId || null,
      isActive: maker.isActive ?? true,
    }).returning();
    return result[0];
  }

  async updateMakerListItem(id: number, data: Partial<MakerList>): Promise<MakerList> {
    const db = await getDb();
    const result = await db.update(makerList)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(makerList.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Maker list item with id ${id} not found`);
    }
    return result[0];
  }

  async deleteMakerListItem(id: number): Promise<void> {
    const db = await getDb();
    // Soft delete by setting isActive to false
    await db.update(makerList)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(makerList.id, id));
  }

  // ============= MODULE 2: SFI DETAILS =============

  async getSfiDetails(): Promise<SfiDetails[]> {
    const db = await getDb();
    return await db.select().from(sfiDetails).where(eq(sfiDetails.isActive, true));
  }

  async getSfiDetail(id: number): Promise<SfiDetails | undefined> {
    const db = await getDb();
    const result = await db.select().from(sfiDetails).where(eq(sfiDetails.id, id));
    return result[0];
  }

  async getSfiByCode(componentCode: string): Promise<SfiDetails | undefined> {
    const db = await getDb();
    const result = await db.select().from(sfiDetails)
      .where(eq(sfiDetails.componentCode, componentCode));
    return result[0];
  }

  async createSfiDetail(sfi: InsertSfiDetails): Promise<SfiDetails> {
    const db = await getDb();
    const result = await db.insert(sfiDetails).values({
      componentCode: sfi.componentCode,
      componentName: sfi.componentName,
      description: sfi.description || null,
      isActive: sfi.isActive ?? true,
    }).returning();
    return result[0];
  }

  async updateSfiDetail(id: number, data: Partial<SfiDetails>): Promise<SfiDetails> {
    const db = await getDb();
    const result = await db.update(sfiDetails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sfiDetails.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`SFI Detail with id ${id} not found`);
    }
    return result[0];
  }

  async deleteSfiDetail(id: number): Promise<void> {
    const db = await getDb();
    // Soft delete by setting isActive to false
    await db.update(sfiDetails)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sfiDetails.id, id));
  }

  // ============= MODULE 2: MASTER DATA =============

  async getMasterDataList(): Promise<MasterData[]> {
    const db = await getDb();
    return await db.select().from(masterData).where(eq(masterData.isActive, true));
  }

  async getMasterDataItem(id: number): Promise<MasterData | undefined> {
    const db = await getDb();
    const result = await db.select().from(masterData).where(eq(masterData.id, id));
    return result[0];
  }

  async getMasterDataByFleetCode(fleetEquipmentCode: string): Promise<MasterData | undefined> {
    const db = await getDb();
    const result = await db.select().from(masterData)
      .where(eq(masterData.fleetEquipmentCode, fleetEquipmentCode));
    return result[0];
  }

  async getMasterDataByMakerModel(makerCode: string, model: string): Promise<MasterData | undefined> {
    const db = await getDb();
    const result = await db.select().from(masterData)
      .where(and(eq(masterData.makerCode, makerCode), eq(masterData.model, model)));
    return result[0];
  }

  async createMasterData(data: InsertMasterData): Promise<MasterData> {
    const db = await getDb();
    const result = await db.insert(masterData).values({
      slNo: data.slNo ?? null,
      makerName: data.makerName,
      makerCode: data.makerCode,
      countMaker: data.countMaker ?? null,
      model: data.model,
      modelCode: data.modelCode,
      countSfiCode: data.countSfiCode ?? null,
      fleetEquipmentCode: data.fleetEquipmentCode,
      sfiCode: data.sfiCode,
      assignedSubCode: data.assignedSubCode ?? null,
      vesselName: data.vesselName ?? null,
      vesselCode: data.vesselCode ?? null,
      equipmentName: data.equipmentName,
      isActive: data.isActive ?? true,
    }).returning();
    return result[0];
  }

  async updateMasterData(id: number, data: Partial<MasterData>): Promise<MasterData> {
    const db = await getDb();
    const result = await db.update(masterData)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(masterData.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Master Data with id ${id} not found`);
    }
    return result[0];
  }

  async deleteMasterData(id: number): Promise<void> {
    const db = await getDb();
    // Soft delete by setting isActive to false
    await db.update(masterData)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(masterData.id, id));
  }

  async generateFleetEquipmentCode(sfiCode: string): Promise<string> {
    const db = await getDb();
    const existingCodes = await db.select({ fleetEquipmentCode: masterData.fleetEquipmentCode })
      .from(masterData)
      .where(eq(masterData.sfiCode, sfiCode));
    
    const codes = existingCodes.map(r => r.fleetEquipmentCode);
    const seqNumbers = codes.map(code => {
      const parts = code.split('.');
      if (parts.length >= 2) {
        const seqPart = parts[1];
        return parseInt(seqPart, 10) || 0;
      }
      return 0;
    });
    
    const nextSeq = Math.max(0, ...seqNumbers) + 1;
    const seqStr = nextSeq.toString().padStart(3, '0');
    
    const subCodeIndex = codes.filter(c => c.startsWith(`${sfiCode}.${seqStr}`)).length;
    const subCode = String.fromCharCode(65 + Math.floor(subCodeIndex / 26)) + 
                    String.fromCharCode(65 + (subCodeIndex % 26));
    
    return `${sfiCode}.${seqStr}.${subCode}`;
  }

  // ============= MODULE 3: COMPONENTS =============

  async getComponents(vesselId: string): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(components)
      .where(and(
        eq(components.vesselId, vesselId),
        eq(components.dataScope, 'vessel')
      ));
  }

  async getComponent(id: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(components).where(eq(components.id, id));
    return result[0];
  }

  async getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(components)
      .where(and(
        eq(components.componentCode, componentCode),
        eq(components.vesselId, vesselId)
      ));
    return result[0];
  }

  async createComponent(component: InsertComponent): Promise<Component> {
    const db = await getDb();
    const id = component.id || `COMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(components).values({
      ...component,
      id,
      dataScope: component.dataScope || 'vessel',
    }).returning();
    return result[0];
  }

  async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
    const db = await getDb();
    const result = await db.update(components)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(components.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component ${id} not found`);
    }
    return result[0];
  }

  async deleteComponent(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(components).where(eq(components.id, id));
  }

  async inactivateComponent(id: string, userId?: string, options?: { cascadeInactivate?: boolean }): Promise<{
    success: boolean;
    message: string;
    componentsInactivated: number;
    jobsInactivated: number;
    activeChildrenCount?: number;
  }> {
    const db = await getDb();
    
    // Get the component
    const componentResult = await db.select().from(components)
      .where(eq(components.id, id))
      .limit(1);
    
    if (componentResult.length === 0) {
      return {
        success: false,
        message: `Component not found: ${id}`,
        componentsInactivated: 0,
        jobsInactivated: 0,
      };
    }
    
    const component = componentResult[0];
    
    // Check for active children
    const activeChildren = await db.select().from(components)
      .where(and(
        eq(components.parentId, id),
        eq(components.isActive, true)
      ));
    
    // If cascade is not requested and there are active children, return warning
    if (!options?.cascadeInactivate && activeChildren.length > 0) {
      return {
        success: false,
        message: `Component has ${activeChildren.length} active children. Set cascadeInactivate to true to inactivate them all.`,
        componentsInactivated: 0,
        jobsInactivated: 0,
        activeChildrenCount: activeChildren.length,
      };
    }
    
    let componentsInactivated = 0;
    let jobsInactivated = 0;
    
    // Cascade inactivate children if requested
    if (options?.cascadeInactivate && activeChildren.length > 0) {
      const childIds = activeChildren.map(c => c.id);
      await db.update(components)
        .set({ isActive: false })
        .where(inArray(components.id, childIds));
      componentsInactivated += childIds.length;
      
      // Inactivate jobs linked to children (via direct componentId and jobComponentLinks)
      // Collect all unique job IDs to avoid duplicate updates/counts
      const childJobIdsToInactivate = new Set<string>();
      
      for (const childId of childIds) {
        // Jobs linked via deprecated componentId field
        const directJobs = await db.select().from(jobs)
          .where(eq(jobs.componentId, childId));
        for (const job of directJobs) {
          childJobIdsToInactivate.add(job.id);
        }
        // Jobs linked via jobComponentLinks table (many-to-many)
        const linkedJobIds = await this.getJobComponentLinksByComponent(childId);
        for (const link of linkedJobIds) {
          childJobIdsToInactivate.add(link.jobId);
        }
      }
      
      // Batch update all unique jobs
      for (const jobId of childJobIdsToInactivate) {
        await db.update(jobs)
          .set({ isActive: false })
          .where(eq(jobs.id, jobId));
      }
      jobsInactivated += childJobIdsToInactivate.size;
    }
    
    // Inactivate the main component
    await db.update(components)
      .set({ isActive: false })
      .where(eq(components.id, id));
    componentsInactivated++;
    
    // Inactivate jobs linked to main component (via direct componentId and jobComponentLinks)
    // Collect all unique job IDs to avoid duplicate updates/counts
    const mainJobIdsToInactivate = new Set<string>();
    
    const directJobs = await db.select().from(jobs)
      .where(eq(jobs.componentId, id));
    for (const job of directJobs) {
      mainJobIdsToInactivate.add(job.id);
    }
    // Jobs linked via jobComponentLinks table (many-to-many)
    const linkedJobIds = await this.getJobComponentLinksByComponent(id);
    for (const link of linkedJobIds) {
      mainJobIdsToInactivate.add(link.jobId);
    }
    
    // Batch update all unique jobs
    for (const jobId of mainJobIdsToInactivate) {
      await db.update(jobs)
        .set({ isActive: false })
        .where(eq(jobs.id, jobId));
    }
    jobsInactivated += mainJobIdsToInactivate.size;
    
    return {
      success: true,
      message: `Component and ${componentsInactivated - 1} children inactivated, along with ${jobsInactivated} linked jobs.`,
      componentsInactivated,
      jobsInactivated,
    };
  }

  // Fleet Components
  async getFleetComponents(): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(components)
      .where(eq(components.dataScope, 'fleet'));
  }

  async getFleetComponent(id: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(components)
      .where(and(
        eq(components.id, id),
        eq(components.dataScope, 'fleet')
      ));
    return result[0];
  }

  async createFleetComponent(component: InsertComponent): Promise<Component> {
    const db = await getDb();
    const id = component.id || `FC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(components).values({
      ...component,
      id,
      dataScope: 'fleet',
    }).returning();
    return result[0];
  }

  async updateFleetComponent(id: string, data: Partial<Component>): Promise<Component> {
    return this.updateComponent(id, data);
  }

  async deleteFleetComponent(id: string): Promise<void> {
    return this.deleteComponent(id);
  }

  // ============= RH COUNTER TYPE METHODS (B7.B) =============
  
  // Get all MASTER components for a vessel (for RH source selection dropdown)
  async getMasterComponents(vesselId: string): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(components)
      .where(and(
        eq(components.vesselId, vesselId),
        eq(components.rhCounterType, 'MASTER'),
        eq(components.dataScope, 'vessel')
      ));
  }

  // Get all INHERITED components linked to a specific MASTER
  // IMPORTANT: vesselId parameter enforces vessel isolation to prevent cross-vessel aggregation
  // If vesselId cannot be determined, returns empty array to prevent cross-vessel data leaks
  async getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]> {
    const db = await getDb();
    
    // First try to get the master component to find its component code and vesselId
    let masterComponent = await this.getComponent(masterComponentId);
    
    // If not found by ID, try finding by component code
    if (!masterComponent) {
      const byCode = await db.select().from(components)
        .where(eq(components.componentCode, masterComponentId))
        .limit(1);
      masterComponent = byCode[0] || null;
    }
    
    const masterComponentCode = masterComponent?.componentCode || masterComponentId;
    const masterComponentFullId = masterComponent?.id || masterComponentId;
    // Use provided vesselId, or derive from master component for vessel isolation
    const effectiveVesselId = vesselId || masterComponent?.vesselId;
    
    // CRITICAL SAFEGUARD: If we cannot determine the vesselId, return empty array
    // This prevents cross-vessel data leakage when master lookup fails (e.g., legacy/deleted records)
    if (!effectiveVesselId) {
      console.warn(`⚠️ [getInheritedComponents] Cannot determine vesselId for master "${masterComponentId}" - returning empty to prevent cross-vessel leak`);
      return [];
    }
    
    // Match inherited components that reference:
    // 1. The exact master component ID (e.g., "V015-601.001")
    // 2. The master's component code (e.g., "601.001") - for legacy data compatibility
    // 3. The original masterComponentId parameter (in case it's a code, not ID)
    // 4. MUST be in the same vessel as the master component (ALWAYS enforced)
    return await db.select().from(components)
      .where(and(
        eq(components.rhCounterType, 'INHERITED'),
        eq(components.vesselId, effectiveVesselId),
        or(
          eq(components.rhMasterComponentId, masterComponentFullId),
          eq(components.rhMasterComponentId, masterComponentCode),
          eq(components.rhMasterComponentId, masterComponentId)
        )
      ));
  }

  // Update RH counter type configuration for a component
  async updateRHConfig(params: {
    componentId: string;
    rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN';
    rhMasterComponentId?: string | null;
    userId?: string;
  }): Promise<Component> {
    const db = await getDb();
    const now = new Date();
    
    // Build update data based on RH counter type
    const updateData: Partial<Component> = {
      rhCounterType: params.rhCounterType,
      updatedAt: now,
    };

    if (params.rhCounterType === 'MASTER') {
      // For MASTER: clear inherited fields, initialize master fields if not set
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
      // Initialize rhCurrentMaster to 0 if not already set
      const existing = await this.getComponent(params.componentId);
      if (!existing?.rhCurrentMaster) {
        updateData.rhCurrentMaster = '0';
        updateData.rhMasterUpdatedAt = now;
        updateData.rhMasterUpdatedBy = params.userId || 'system';
        updateData.rhMasterUpdateSource = 'MANUAL';
      }
    } else if (params.rhCounterType === 'INHERITED') {
      // For INHERITED: set master reference, clear master fields
      if (!params.rhMasterComponentId) {
        throw new Error('rhMasterComponentId is required for INHERITED counter type');
      }
      updateData.rhMasterComponentId = params.rhMasterComponentId;
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdatedBy = null;
      updateData.rhMasterUpdateSource = null;
      
      // Initialize cached value from master
      const masterComponent = await this.getComponent(params.rhMasterComponentId);
      if (masterComponent) {
        updateData.rhCurrentInheritedCached = masterComponent.rhCurrentMaster || '0';
        updateData.rhInheritedUpdatedAt = now;
      }
    } else {
      // For NOT_RH_DRIVEN: clear all RH fields
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdatedBy = null;
      updateData.rhMasterUpdateSource = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
    }

    const result = await db.update(components)
      .set(updateData)
      .where(eq(components.id, params.componentId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Component ${params.componentId} not found`);
    }
    return result[0];
  }

  // Update MASTER running hours with automatic cascade to INHERITED components
  async updateMasterRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
    userId: string;
    comments?: string;
  }): Promise<{ masterUpdated: Component; inheritedUpdated: number }> {
    const db = await getDb();
    const now = new Date();
    
    // Verify component exists and is a MASTER
    const component = await this.getComponent(params.componentId);
    if (!component) {
      throw new Error(`Component ${params.componentId} not found`);
    }
    if (component.rhCounterType !== 'MASTER') {
      throw new Error(`Component ${params.componentId} is not a MASTER counter type. Cannot update RH directly.`);
    }

    // Update the MASTER component - update both rhCurrentMaster and currentCumulativeRH for compatibility
    const masterResult = await db.update(components)
      .set({
        rhCurrentMaster: params.newRHValue.toString(),
        currentCumulativeRH: params.newRHValue.toString(),
        rhMasterUpdatedAt: now,
        rhMasterUpdatedBy: params.userId,
        rhMasterUpdateSource: params.updateSource,
        lastUpdated: now.toISOString(),
        updatedAt: now,
      })
      .where(eq(components.id, params.componentId))
      .returning();

    if (!masterResult[0]) {
      throw new Error(`Failed to update MASTER component ${params.componentId}`);
    }

    // Cascade update to all INHERITED components IN THE SAME VESSEL
    // Update BOTH rhCurrentInheritedCached (RH config system) AND currentCumulativeRH (legacy field used by WO status calculation)
    // Match by BOTH component ID and component code (legacy data uses component code in rhMasterComponentId)
    // CRITICAL: Filter by vesselId to prevent cross-vessel RH aggregation
    const masterComponentCode = component.componentCode || '';
    const masterVesselId = component.vesselId;
    
    // CRITICAL SAFEGUARD: Skip cascade if vesselId cannot be determined
    if (!masterVesselId) {
      console.warn(`⚠️ [updateMasterRunningHours] Cannot determine vesselId for master "${params.componentId}" - skipping cascade to prevent cross-vessel leak`);
      return {
        masterUpdated: masterResult[0],
        inheritedUpdated: 0,
      };
    }
    
    // Cascade to inherited components in the same vessel
    const inheritedResult = await db.update(components)
      .set({
        rhCurrentInheritedCached: params.newRHValue.toString(),
        currentCumulativeRH: params.newRHValue.toString(),
        rhInheritedUpdatedAt: now,
        lastUpdated: now.toISOString(),
        updatedAt: now,
      })
      .where(and(
        eq(components.rhCounterType, 'INHERITED'),
        eq(components.vesselId, masterVesselId),
        or(
          eq(components.rhMasterComponentId, params.componentId),
          eq(components.rhMasterComponentId, masterComponentCode),
          eq(components.rhCounterSource, masterComponentCode)
        )
      ))
      .returning();

    return {
      masterUpdated: masterResult[0],
      inheritedUpdated: inheritedResult.length,
    };
  }

  // CENTRALIZED RH UPDATE: Set running hours for any component with automatic field sync
  // This is the SINGLE SOURCE OF TRUTH for all running hours updates
  async setComponentRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION' | 'BULK_IMPORT' | 'WO_COMPLETION';
    userId: string;
    lastUpdatedDate?: string; // Optional: use this date instead of now for lastUpdated field (e.g., WO completion date)
  }): Promise<{ component: Component; inheritedUpdated: number }> {
    const db = await getDb();
    const now = new Date();
    const lastUpdatedValue = params.lastUpdatedDate || now.toISOString();
    
    // Get the component to determine its counter type
    const component = await this.getComponent(params.componentId);
    if (!component) {
      throw new Error(`Component ${params.componentId} not found`);
    }

    const rhValueStr = params.newRHValue.toString();
    let inheritedUpdated = 0;

    if (component.rhCounterType === 'MASTER') {
      // For MASTER components: update rhCurrentMaster AND currentCumulativeRH, then cascade
      const result = await db.update(components)
        .set({
          rhCurrentMaster: rhValueStr,
          currentCumulativeRH: rhValueStr,
          rhMasterUpdatedAt: now,
          rhMasterUpdatedBy: params.userId,
          rhMasterUpdateSource: params.updateSource,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(components.id, params.componentId))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update MASTER component ${params.componentId}`);
      }

      // Cascade to all INHERITED components IN THE SAME VESSEL
      // Match by BOTH component ID and component code (legacy data uses component code in rhMasterComponentId)
      // CRITICAL: Filter by vesselId to prevent cross-vessel RH aggregation
      const masterComponentCode = component.componentCode || '';
      const masterVesselId = component.vesselId;
      
      // CRITICAL SAFEGUARD: Skip cascade if vesselId cannot be determined
      if (!masterVesselId) {
        console.warn(`⚠️ [setComponentRunningHours] Cannot determine vesselId for master "${params.componentId}" - skipping cascade to prevent cross-vessel leak`);
        return { component: result[0], inheritedUpdated: 0 };
      }
      
      // Cascade to inherited components in the same vessel
      const inheritedResult = await db.update(components)
        .set({
          rhCurrentInheritedCached: rhValueStr,
          currentCumulativeRH: rhValueStr,
          rhInheritedUpdatedAt: now,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(and(
          eq(components.rhCounterType, 'INHERITED'),
          eq(components.vesselId, masterVesselId),
          or(
            eq(components.rhMasterComponentId, params.componentId),
            eq(components.rhMasterComponentId, masterComponentCode),
            eq(components.rhCounterSource, masterComponentCode)
          )
        ))
        .returning();

      inheritedUpdated = inheritedResult.length;
      return { component: result[0], inheritedUpdated };

    } else if (component.rhCounterType === 'INHERITED') {
      // For INHERITED components: update rhCurrentInheritedCached AND currentCumulativeRH
      // Note: This is typically only used for component replacement scenarios (reset to 0)
      const result = await db.update(components)
        .set({
          rhCurrentInheritedCached: rhValueStr,
          currentCumulativeRH: rhValueStr,
          rhInheritedUpdatedAt: now,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(components.id, params.componentId))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update INHERITED component ${params.componentId}`);
      }
      return { component: result[0], inheritedUpdated: 0 };

    } else {
      // For NOT_RH_DRIVEN or unknown: just update currentCumulativeRH for backward compatibility
      const result = await db.update(components)
        .set({
          currentCumulativeRH: rhValueStr,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(components.id, params.componentId))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update component ${params.componentId}`);
      }
      return { component: result[0], inheritedUpdated: 0 };
    }
  }

  // ============= MODULE 3: COMPONENT DOCUMENTS =============

  async getComponentDocuments(componentId: string): Promise<ComponentDocument[]> {
    const db = await getDb();
    return await db.select().from(componentDocuments)
      .where(eq(componentDocuments.componentId, componentId));
  }

  async getComponentDocument(id: number): Promise<ComponentDocument | undefined> {
    const db = await getDb();
    const result = await db.select().from(componentDocuments)
      .where(eq(componentDocuments.id, id));
    return result[0];
  }

  async createComponentDocument(doc: InsertComponentDocument): Promise<ComponentDocument> {
    const db = await getDb();
    const result = await db.insert(componentDocuments).values(doc).returning();
    return result[0];
  }

  async updateComponentDocument(id: number, data: Partial<ComponentDocument>): Promise<ComponentDocument> {
    const db = await getDb();
    const result = await db.update(componentDocuments)
      .set(data)
      .where(eq(componentDocuments.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component document ${id} not found`);
    }
    return result[0];
  }

  async deleteComponentDocument(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(componentDocuments).where(eq(componentDocuments.id, id));
  }

  // ============= MODULE 3: COMPONENT CLASS REGULATORY =============

  async getComponentClassRegulatory(componentId: string): Promise<ComponentClassRegulatory[]> {
    const db = await getDb();
    return await db.select().from(componentClassRegulatory)
      .where(eq(componentClassRegulatory.componentId, componentId));
  }

  async getComponentClassRegulatoryItem(id: number): Promise<ComponentClassRegulatory | undefined> {
    const db = await getDb();
    const result = await db.select().from(componentClassRegulatory)
      .where(eq(componentClassRegulatory.id, id));
    return result[0];
  }

  async createComponentClassRegulatory(item: InsertComponentClassRegulatory): Promise<ComponentClassRegulatory> {
    const db = await getDb();
    const result = await db.insert(componentClassRegulatory).values(item).returning();
    return result[0];
  }

  async updateComponentClassRegulatory(id: number, data: Partial<ComponentClassRegulatory>): Promise<ComponentClassRegulatory> {
    const db = await getDb();
    const result = await db.update(componentClassRegulatory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(componentClassRegulatory.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component class regulatory ${id} not found`);
    }
    return result[0];
  }

  async deleteComponentClassRegulatory(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(componentClassRegulatory).where(eq(componentClassRegulatory.id, id));
  }

  // ============= MODULE 3: COMPONENT MAINTENANCE HISTORY (IMMUTABLE) =============

  async getAllComponentMaintenanceHistory(vesselCode?: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    if (vesselCode) {
      return await db.select().from(componentMaintenanceHistory)
        .where(eq(componentMaintenanceHistory.vesselCode, vesselCode))
        .orderBy(desc(componentMaintenanceHistory.createdAt));
    }
    return await db.select().from(componentMaintenanceHistory)
      .orderBy(desc(componentMaintenanceHistory.createdAt));
  }

  async getComponentMaintenanceHistory(componentId: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.componentId, componentId))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
  }

  async getComponentMaintenanceHistoryByCode(componentCode: string, vesselCode: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(componentMaintenanceHistory)
      .where(and(
        eq(componentMaintenanceHistory.componentCode, componentCode),
        eq(componentMaintenanceHistory.vesselCode, vesselCode)
      ))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
  }

  async getMaintenanceHistoryByJobId(jobId: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.jobId, jobId))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
  }

  async getMaintenanceHistoryByJobCode(jobCode: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.jobCode, jobCode))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
  }

  async getComponentMaintenanceHistoryItem(id: number): Promise<ComponentMaintenanceHistory | undefined> {
    const db = await getDb();
    const result = await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.id, id));
    return result[0];
  }

  async getMaintenanceHistoryByWorkOrderId(workOrderId: string): Promise<ComponentMaintenanceHistory | undefined> {
    const db = await getDb();
    const result = await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.workOrderId, workOrderId));
    return result[0];
  }

  // INSERT ONLY - No update or delete methods per immutability requirement
  async createComponentMaintenanceHistory(history: InsertComponentMaintenanceHistory): Promise<ComponentMaintenanceHistory> {
    const db = await getDb();
    const result = await db.insert(componentMaintenanceHistory).values(history).returning();
    return result[0];
  }

  // ============= MODULE 3: COMPONENT REQUISITIONS =============

  async getComponentRequisitions(componentId: string): Promise<ComponentRequisition[]> {
    const db = await getDb();
    return await db.select().from(componentRequisitions)
      .where(eq(componentRequisitions.componentId, componentId))
      .orderBy(desc(componentRequisitions.createdAt));
  }

  async getAllComponentRequisitions(vesselCode?: string): Promise<ComponentRequisition[]> {
    const db = await getDb();
    if (vesselCode) {
      return await db.select().from(componentRequisitions)
        .where(eq(componentRequisitions.vesselCode, vesselCode))
        .orderBy(desc(componentRequisitions.createdAt));
    }
    return await db.select().from(componentRequisitions)
      .orderBy(desc(componentRequisitions.createdAt));
  }

  async getComponentRequisitionItem(id: number): Promise<ComponentRequisition | undefined> {
    const db = await getDb();
    const result = await db.select().from(componentRequisitions)
      .where(eq(componentRequisitions.id, id));
    return result[0];
  }

  async createComponentRequisition(item: InsertComponentRequisition): Promise<ComponentRequisition> {
    const db = await getDb();
    const result = await db.insert(componentRequisitions).values(item).returning();
    return result[0];
  }

  async updateComponentRequisition(id: number, data: Partial<ComponentRequisition>): Promise<ComponentRequisition> {
    const db = await getDb();
    const result = await db.update(componentRequisitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(componentRequisitions.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component requisition ${id} not found`);
    }
    return result[0];
  }

  async deleteComponentRequisition(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(componentRequisitions).where(eq(componentRequisitions.id, id));
  }

  // ============= MODULE 3: RUNNING HOURS AUDIT =============

  async createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    const db = await getDb();
    const result = await db.insert(runningHoursAudit).values(audit).returning();
    return result[0];
  }

  async getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    const db = await getDb();
    let query = db.select().from(runningHoursAudit)
      .where(eq(runningHoursAudit.componentId, componentId))
      .orderBy(desc(runningHoursAudit.enteredAtUTC));
    
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getRunningHoursAuditsInDateRange(
    componentId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<RunningHoursAudit[]> {
    const db = await getDb();
    return await db.select().from(runningHoursAudit)
      .where(and(
        eq(runningHoursAudit.componentId, componentId),
        gte(runningHoursAudit.enteredAtUTC, startDate),
        lte(runningHoursAudit.enteredAtUTC, endDate)
      ))
      .orderBy(desc(runningHoursAudit.enteredAtUTC));
  }

  // ============= MODULE 4: JOBS =============

  async getJobs(vesselId?: string, componentId?: string): Promise<Job[]> {
    const db = await getDb();
    
    if (vesselId && componentId) {
      // MANY-TO-MANY SUPPORT: Get jobs directly assigned to component
      // AND jobs linked via job_component_links table
      const directJobs = await db.select().from(jobs)
        .where(and(
          eq(jobs.vesselId, vesselId),
          eq(jobs.componentId, componentId),
          eq(jobs.dataScope, 'vessel')
        ))
        .orderBy(asc(jobs.jobNo));
      
      // Get jobs linked via job_component_links
      const linkedJobIds = await this.getJobComponentLinksByComponent(componentId);
      const linkedJobs: Job[] = [];
      
      for (const link of linkedJobIds) {
        const job = await this.getJob(link.jobId);
        if (job && job.vesselId === vesselId && job.dataScope === 'vessel') {
          linkedJobs.push(job);
        }
      }
      
      // Combine and deduplicate by job ID
      const jobMap = new Map<string, Job>();
      for (const job of directJobs) {
        jobMap.set(job.id, job);
      }
      for (const job of linkedJobs) {
        if (!jobMap.has(job.id)) {
          jobMap.set(job.id, job);
        }
      }
      
      // Sort by jobNo and return
      return Array.from(jobMap.values()).sort((a, b) => 
        (a.jobNo || '').localeCompare(b.jobNo || '')
      );
    }
    
    if (vesselId) {
      return await db.select().from(jobs)
        .where(and(
          eq(jobs.vesselId, vesselId),
          eq(jobs.dataScope, 'vessel')
        ))
        .orderBy(asc(jobs.jobNo));
    }
    
    return await db.select().from(jobs)
      .where(eq(jobs.dataScope, 'vessel'))
      .orderBy(asc(jobs.jobNo));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const db = await getDb();
    const result = await db.select().from(jobs).where(eq(jobs.id, id));
    return result[0];
  }

  async getJobByJobNo(jobNo: string): Promise<Job | undefined> {
    const db = await getDb();
    const result = await db.select().from(jobs).where(eq(jobs.jobNo, jobNo));
    return result[0];
  }

  async createJob(job: InsertJob): Promise<Job> {
    const db = await getDb();
    const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(jobs).values({
      ...job,
      id,
      dataScope: job.dataScope || 'vessel',
    }).returning();
    return result[0];
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job> {
    const db = await getDb();
    const result = await db.update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Job ${id} not found`);
    }
    return result[0];
  }

  async deleteJob(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async bulkCreateJobs(jobList: InsertJob[]): Promise<Job[]> {
    if (jobList.length === 0) return [];
    const db = await getDb();
    const results: Job[] = [];
    
    for (const job of jobList) {
      const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await db.insert(jobs).values({
        ...job,
        id,
        dataScope: job.dataScope || 'vessel',
      }).returning();
      results.push(result[0]);
    }
    
    return results;
  }

  async bulkUpdateJobs(updates: Array<{ jobNo: string; data: Partial<Job> }>): Promise<Job[]> {
    const db = await getDb();
    const results: Job[] = [];
    
    for (const { jobNo, data } of updates) {
      const result = await db.update(jobs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(jobs.jobNo, jobNo))
        .returning();
      if (result[0]) {
        results.push(result[0]);
      }
    }
    
    return results;
  }

  async bulkUpsertJobs(jobList: InsertJob[]): Promise<{ created: number; updated: number }> {
    const db = await getDb();
    let created = 0;
    let updated = 0;
    
    for (const job of jobList) {
      const existing = job.jobNo ? await this.getJobByJobNo(job.jobNo) : null;
      
      if (existing) {
        await db.update(jobs)
          .set({ ...job, updatedAt: new Date() })
          .where(eq(jobs.id, existing.id));
        updated++;
      } else {
        const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(jobs).values({
          ...job,
          id,
          dataScope: job.dataScope || 'vessel',
        });
        created++;
      }
    }
    
    return { created, updated };
  }

  async getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, Job>> {
    if (jobNos.length === 0) return new Map();
    const db = await getDb();
    
    let result: Job[];
    if (vesselId) {
      result = await db.select().from(jobs)
        .where(and(
          inArray(jobs.jobNo, jobNos),
          eq(jobs.vesselId, vesselId)
        ));
    } else {
      result = await db.select().from(jobs)
        .where(inArray(jobs.jobNo, jobNos));
    }
    
    const map = new Map<string, Job>();
    for (const job of result) {
      map.set(job.jobNo, job);
    }
    return map;
  }

  // Fleet Jobs
  async getFleetJobs(): Promise<Job[]> {
    const db = await getDb();
    return await db.select().from(jobs)
      .where(eq(jobs.dataScope, 'fleet'))
      .orderBy(asc(jobs.jobNo));
  }

  async getFleetJob(id: string): Promise<Job | undefined> {
    const db = await getDb();
    const result = await db.select().from(jobs)
      .where(and(
        eq(jobs.id, id),
        eq(jobs.dataScope, 'fleet')
      ));
    return result[0];
  }

  async createFleetJob(job: InsertJob): Promise<Job> {
    const db = await getDb();
    const id = `FJ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(jobs).values({
      ...job,
      id,
      dataScope: 'fleet',
    }).returning();
    return result[0];
  }

  async updateFleetJob(id: string, data: Partial<InsertJob>): Promise<Job> {
    return this.updateJob(id, data);
  }

  async deleteFleetJob(id: string): Promise<void> {
    return this.deleteJob(id);
  }

  // ============= MODULE 5: WORK ORDERS =============

  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    const db = await getDb();
    
    if (vesselId) {
      return await db.select().from(workOrders)
        .where(and(
          eq(workOrders.vesselId, vesselId),
          eq(workOrders.dataScope, 'vessel')
        ))
        .orderBy(desc(workOrders.createdAt));
    }
    
    return await db.select().from(workOrders)
      .where(eq(workOrders.dataScope, 'vessel'))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return result[0];
  }

  async getWorkOrderByWorkOrderNo(workOrderNo: string): Promise<WorkOrder | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrders).where(eq(workOrders.workOrderNo, workOrderNo));
    return result[0];
  }

  async getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]> {
    const db = await getDb();
    return await db.select().from(workOrders)
      .where(eq(workOrders.jobId, jobId))
      .orderBy(desc(workOrders.createdAt));
  }

  async createWorkOrder(wo: InsertWorkOrder): Promise<WorkOrder> {
    const db = await getDb();
    const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(workOrders).values({
      ...wo,
      id,
      dataScope: wo.dataScope || 'vessel',
    }).returning();
    return result[0];
  }

  async updateWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    const db = await getDb();
    
    // Sanitize data: convert empty strings to null for integer fields
    // PostgreSQL cannot cast empty strings to integers
    const integerFields = ['maintenanceIntervalValue', 'intervalRunningHour'];
    const sanitizedData = { ...data };
    
    for (const field of integerFields) {
      if (field in sanitizedData && sanitizedData[field as keyof typeof sanitizedData] === '') {
        (sanitizedData as any)[field] = null;
      }
    }
    
    const result = await db.update(workOrders)
      .set({ ...sanitizedData, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Work order ${id} not found`);
    }
    return result[0];
  }

  async deleteWorkOrder(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(workOrders).where(eq(workOrders.id, id));
  }

  async bulkCreateWorkOrders(woList: InsertWorkOrder[]): Promise<WorkOrder[]> {
    if (woList.length === 0) return [];
    const db = await getDb();
    const results: WorkOrder[] = [];
    
    for (const wo of woList) {
      const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await db.insert(workOrders).values({
        ...wo,
        id,
        dataScope: wo.dataScope || 'vessel',
      }).returning();
      results.push(result[0]);
    }
    
    return results;
  }

  async bulkUpdateWorkOrders(updates: Array<{ templateCode: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    const db = await getDb();
    const results: WorkOrder[] = [];
    
    for (const { templateCode, data } of updates) {
      const result = await db.update(workOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(workOrders.templateId, templateCode))
        .returning();
      if (result[0]) {
        results.push(result[0]);
      }
    }
    
    return results;
  }

  async bulkUpsertWorkOrders(woList: InsertWorkOrder[]): Promise<{ created: number; updated: number }> {
    const db = await getDb();
    let created = 0;
    let updated = 0;
    
    for (const wo of woList) {
      const existing = wo.workOrderNo ? await this.getWorkOrderByWorkOrderNo(wo.workOrderNo) : null;
      
      if (existing) {
        await db.update(workOrders)
          .set({ ...wo, updatedAt: new Date() })
          .where(eq(workOrders.id, existing.id));
        updated++;
      } else {
        const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(workOrders).values({
          ...wo,
          id,
          dataScope: wo.dataScope || 'vessel',
        });
        created++;
      }
    }
    
    return { created, updated };
  }

  async getWorkOrdersByTemplateIds(templateIds: string[], vesselId?: string): Promise<Map<string, WorkOrder>> {
    if (templateIds.length === 0) return new Map();
    const db = await getDb();
    
    let results: WorkOrder[];
    if (vesselId) {
      results = await db.select().from(workOrders)
        .where(and(
          inArray(workOrders.templateId, templateIds),
          eq(workOrders.vesselId, vesselId)
        ));
    } else {
      results = await db.select().from(workOrders)
        .where(inArray(workOrders.templateId, templateIds));
    }
    
    const resultMap = new Map<string, WorkOrder>();
    for (const wo of results) {
      if (wo.templateId) {
        resultMap.set(wo.templateId, wo);
      }
    }
    return resultMap;
  }

  // Fleet Work Orders
  async getFleetWorkOrders(): Promise<WorkOrder[]> {
    const db = await getDb();
    return await db.select().from(workOrders)
      .where(eq(workOrders.dataScope, 'fleet'))
      .orderBy(desc(workOrders.createdAt));
  }

  async getFleetWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrders)
      .where(and(
        eq(workOrders.id, id),
        eq(workOrders.dataScope, 'fleet')
      ));
    return result[0];
  }

  async createFleetWorkOrder(wo: InsertWorkOrder): Promise<WorkOrder> {
    const db = await getDb();
    const id = wo.id || `FWO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(workOrders).values({
      ...wo,
      id,
      dataScope: 'fleet',
    }).returning();
    return result[0];
  }

  async updateFleetWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    return this.updateWorkOrder(id, data);
  }

  async deleteFleetWorkOrder(id: string): Promise<void> {
    return this.deleteWorkOrder(id);
  }

  // ============= MODULE 7: SPARES =============

  async getAllSpares(): Promise<Spare[]> {
    const db = await getDb();
    return await db.select().from(spares)
      .where(eq(spares.deleted, false));
  }

  async getSpares(vesselId: string): Promise<Spare[]> {
    const db = await getDb();
    return await db.select().from(spares)
      .where(and(
        eq(spares.vesselId, vesselId),
        eq(spares.dataScope, 'vessel'),
        eq(spares.deleted, false)
      ));
  }

  async getSpare(id: number): Promise<Spare | undefined> {
    const db = await getDb();
    const result = await db.select().from(spares).where(eq(spares.id, id));
    return result[0];
  }

  async createSpare(spare: InsertSpare): Promise<Spare> {
    const db = await getDb();
    const result = await db.insert(spares).values({
      ...spare,
      dataScope: spare.dataScope || 'vessel',
      rob: spare.rob ?? 0,
      robLocationA: spare.robLocationA ?? 0,
      robLocationB: spare.robLocationB ?? 0,
      min: spare.min ?? 0,
    }).returning();
    return result[0];
  }

  async updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    const db = await getDb();
    const result = await db.update(spares)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(spares.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Spare ${id} not found`);
    }
    return result[0];
  }

  async deleteSpare(id: number): Promise<void> {
    const db = await getDb();
    await db.update(spares)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(spares.id, id));
  }

  async consumeSpare(
    id: number, 
    quantity: number, 
    userId: string, 
    remarks?: string, 
    place?: string, 
    dateLocal?: string, 
    tz?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const newRob = (spare.rob ?? 0) - quantity;
    const newRobA = (spare.robLocationA ?? 0) - quantity;
    
    const updated = await db.update(spares)
      .set({
        rob: newRob,
        robLocationA: newRobA < 0 ? 0 : newRobA,
        updatedAt: new Date()
      })
      .where(eq(spares.id, id))
      .returning();
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'CONSUME',
      qtyChange: -quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ?? null,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });
    
    return updated[0];
  }

  async consumeSpareFromLocation(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    workOrderRef?: string
  ): Promise<{ spare: Spare; deducted: number; requested: number; shortageQty: number }> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const currentRobA = spare.robLocationA ?? 0;
    const currentRobB = spare.robLocationB ?? 0;
    const currentRob = spare.rob ?? 0;
    
    // Calculate available quantity in the specified location
    const availableInLocation = location === 'A' ? currentRobA : currentRobB;
    const deducted = Math.min(quantity, availableInLocation);
    const shortageQty = Math.max(0, quantity - availableInLocation);
    
    let newRobA = currentRobA;
    let newRobB = currentRobB;
    
    if (location === 'A') {
      newRobA = Math.max(0, currentRobA - deducted);
    } else {
      newRobB = Math.max(0, currentRobB - deducted);
    }
    
    const newRob = Math.max(0, currentRob - deducted);
    
    const updated = await db.update(spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        robLocationB: newRobB,
        updatedAt: new Date()
      })
      .where(eq(spares.id, id))
      .returning();
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'CONSUME',
      qtyChange: -deducted,
      robAfter: newRob,
      userId,
      remarks: remarks ? `${remarks} (Location ${location})${workOrderRef ? ` WO: ${workOrderRef}` : ''}` : `Location ${location}`,
      reference: workOrderRef ?? null,
      dateLocal: null,
      tz: null,
      place: null,
    });
    
    return {
      spare: updated[0],
      deducted,
      requested: quantity,
      shortageQty,
    };
  }

  async receiveSpareToLocation(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    supplierPO?: string,
    dateLocal?: string
  ): Promise<{ spare: Spare; received: number }> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const currentRobA = spare.robLocationA ?? 0;
    const currentRobB = spare.robLocationB ?? 0;
    const currentRob = spare.rob ?? 0;
    
    let newRobA = currentRobA;
    let newRobB = currentRobB;
    
    if (location === 'A') {
      newRobA = currentRobA + quantity;
    } else {
      newRobB = currentRobB + quantity;
    }
    
    const newRob = currentRob + quantity;
    
    const updated = await db.update(spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        robLocationB: newRobB,
        lastOrderDate: dateLocal ?? null,
        updatedAt: new Date()
      })
      .where(eq(spares.id, id))
      .returning();
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'RECEIVE',
      qtyChange: quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ? `${remarks} (Location ${location})${supplierPO ? ` PO: ${supplierPO}` : ''}` : `Location ${location}`,
      reference: supplierPO ?? null,
      dateLocal: dateLocal ?? null,
      tz: null,
      place: null,
    });
    
    return {
      spare: updated[0],
      received: quantity,
    };
  }

  async receiveSpare(
    id: number, 
    quantity: number, 
    userId: string, 
    remarks?: string, 
    supplierPO?: string, 
    place?: string, 
    dateLocal?: string, 
    tz?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const newRob = (spare.rob ?? 0) + quantity;
    const newRobA = (spare.robLocationA ?? 0) + quantity;
    
    const updated = await db.update(spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        lastOrderDate: dateLocal ?? null,
        updatedAt: new Date()
      })
      .where(eq(spares.id, id))
      .returning();
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'RECEIVE',
      qtyChange: quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ?? null,
      reference: supplierPO ?? null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });
    
    return updated[0];
  }

  async adjustSpareQuantity(
    spareId: number,
    qtyChange: number,
    eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST',
    reference?: string,
    notes?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(spareId);
    if (!spare) {
      throw new Error(`Spare ${spareId} not found`);
    }
    
    const currentRob = spare.rob ?? 0;
    const currentRobA = spare.robLocationA ?? 0;
    
    // Calculate new values based on quantity change
    const newRob = Math.max(0, currentRob + qtyChange);
    const newRobA = Math.max(0, currentRobA + qtyChange); // Apply to location A by default
    
    const updated = await db.update(spares)
      .set({
        rob: newRob,
        robLocationA: newRobA,
        updatedAt: new Date()
      })
      .where(eq(spares.id, spareId))
      .returning();
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType,
      qtyChange,
      robAfter: newRob,
      userId: 'system',
      remarks: notes ?? null,
      reference: reference ?? null,
      dateLocal: null,
      tz: null,
      place: null,
    });
    
    return updated[0];
  }

  async bulkUpdateSpares(
    updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>,
    userId: string,
    remarks?: string
  ): Promise<Spare[]> {
    const results: Spare[] = [];
    
    for (const update of updates) {
      const spare = await this.getSpare(update.id);
      if (!spare) continue;
      
      if (update.consumed && update.consumed > 0) {
        const result = await this.consumeSpare(
          update.id, 
          update.consumed, 
          userId, 
          remarks
        );
        results.push(result);
      } else if (update.received && update.received > 0) {
        const result = await this.receiveSpare(
          update.id, 
          update.received, 
          userId, 
          remarks, 
          undefined,
          update.receivedPlace,
          update.receivedDate
        );
        results.push(result);
      }
    }
    
    return results;
  }

  // Fleet Spares
  async getFleetSpares(): Promise<Spare[]> {
    const db = await getDb();
    return await db.select().from(spares)
      .where(and(
        eq(spares.dataScope, 'fleet'),
        eq(spares.deleted, false)
      ));
  }

  async getFleetSpare(id: number): Promise<Spare | undefined> {
    const db = await getDb();
    const result = await db.select().from(spares)
      .where(and(
        eq(spares.id, id),
        eq(spares.dataScope, 'fleet')
      ));
    return result[0];
  }

  async createFleetSpare(spare: InsertSpare): Promise<Spare> {
    const db = await getDb();
    const result = await db.insert(spares).values({
      ...spare,
      dataScope: 'fleet',
      rob: spare.rob ?? 0,
      robLocationA: spare.robLocationA ?? 0,
      robLocationB: spare.robLocationB ?? 0,
      min: spare.min ?? 0,
    }).returning();
    return result[0];
  }

  async updateFleetSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    return this.updateSpare(id, data);
  }

  async deleteFleetSpare(id: number): Promise<void> {
    return this.deleteSpare(id);
  }

  async bulkCreateSpares(sparesList: InsertSpare[]): Promise<Spare[]> {
    if (sparesList.length === 0) return [];
    const db = await getDb();
    const results: Spare[] = [];
    
    for (const spare of sparesList) {
      const result = await db.insert(spares).values({
        ...spare,
        dataScope: spare.dataScope || 'vessel',
        rob: spare.rob ?? 0,
        robLocationA: spare.robLocationA ?? 0,
        robLocationB: spare.robLocationB ?? 0,
        min: spare.min ?? 0,
      }).returning();
      results.push(result[0]);
    }
    
    return results;
  }

  async bulkUpdateSparesByROB(updates: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]> {
    const db = await getDb();
    const results: Spare[] = [];
    
    for (const { robId, data } of updates) {
      const id = parseInt(robId, 10);
      if (isNaN(id)) continue;
      
      const result = await db.update(spares)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(spares.id, id))
        .returning();
      if (result[0]) {
        results.push(result[0]);
      }
    }
    
    return results;
  }

  async bulkUpsertSpares(sparesList: InsertSpare[]): Promise<{ created: number; updated: number }> {
    const db = await getDb();
    let created = 0;
    let updated = 0;
    
    for (const spare of sparesList) {
      const existing = spare.partCode && spare.vesselId
        ? await db.select().from(spares)
            .where(and(
              eq(spares.partCode, spare.partCode),
              eq(spares.vesselId, spare.vesselId),
              eq(spares.deleted, false)
            ))
            .then(r => r[0])
        : null;
      
      if (existing) {
        await db.update(spares)
          .set({ ...spare, updatedAt: new Date() })
          .where(eq(spares.id, existing.id));
        updated++;
      } else {
        await db.insert(spares).values({
          ...spare,
          dataScope: spare.dataScope || 'vessel',
          rob: spare.rob ?? 0,
          robLocationA: spare.robLocationA ?? 0,
          robLocationB: spare.robLocationB ?? 0,
          min: spare.min ?? 0,
        });
        created++;
      }
    }
    
    return { created, updated };
  }

  // ============= MODULE 7: SPARES HISTORY =============

  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    const db = await getDb();
    return await db.select().from(sparesHistory)
      .where(eq(sparesHistory.vesselId, vesselId))
      .orderBy(desc(sparesHistory.timestampUTC));
  }

  async getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
    const db = await getDb();
    return await db.select().from(sparesHistory)
      .where(eq(sparesHistory.spareId, spareId))
      .orderBy(desc(sparesHistory.timestampUTC));
  }

  async createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory> {
    const db = await getDb();
    const result = await db.insert(sparesHistory).values(history).returning();
    return result[0];
  }

  // ============= MODULE 8: STORES ITEMS =============

  async getStoresItems(vesselId: string, itemType?: string): Promise<StoresItem[]> {
    const db = await getDb();
    if (itemType) {
      return await db.select().from(storesItems)
        .where(and(
          eq(storesItems.vesselId, vesselId),
          eq(storesItems.itemType, itemType),
          eq(storesItems.deleted, false)
        ));
    }
    return await db.select().from(storesItems)
      .where(and(
        eq(storesItems.vesselId, vesselId),
        eq(storesItems.deleted, false)
      ));
  }

  async getStoresItem(id: number): Promise<StoresItem | undefined> {
    const db = await getDb();
    const result = await db.select().from(storesItems).where(eq(storesItems.id, id));
    return result[0];
  }

  async createStoresItem(item: InsertStoresItem): Promise<StoresItem> {
    const db = await getDb();
    const result = await db.insert(storesItems).values({
      ...item,
      rob: item.rob || '0',
      robLocationA: item.robLocationA || '0',
      robLocationB: item.robLocationB || '0',
      min: item.min || '0',
    }).returning();
    return result[0];
  }

  async updateStoresItem(id: number, data: Partial<StoresItem>): Promise<StoresItem> {
    const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    
    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA || 0) : Number(item.robLocationB || 0);
    const actualConsumed = Math.min(qtyNum, locationRob);
    const newLocationRob = Math.max(0, locationRob - qtyNum);
    const newTotalRob = Math.max(0, Number(item.rob || 0) - actualConsumed);

    const updated = await db.update(storesItems)
      .set({
        rob: String(newTotalRob),
        ...(location === 'A' ? { robLocationA: String(newLocationRob) } : { robLocationB: String(newLocationRob) }),
        updatedAt: new Date()
      })
      .where(eq(storesItems.id, id))
      .returning();

    await db.insert(storesLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'CONSUME',
      qtyChangeBase: String(-actualConsumed),
      qtyDisplay: String(-actualConsumed),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString(),
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      userId: userId,
      remarks: remarks,
    });

    return updated[0];
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
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    
    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA || 0) : Number(item.robLocationB || 0);
    const newLocationRob = locationRob + qtyNum;
    const newTotalRob = Number(item.rob || 0) + qtyNum;

    const updated = await db.update(storesItems)
      .set({
        rob: String(newTotalRob),
        ...(location === 'A' ? { robLocationA: String(newLocationRob) } : { robLocationB: String(newLocationRob) }),
        updatedAt: new Date()
      })
      .where(eq(storesItems.id, id))
      .returning();

    await db.insert(storesLedger).values({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: id,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'RECEIVE',
      qtyChangeBase: String(qtyNum),
      qtyDisplay: String(qtyNum),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString(),
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      ref: ref,
      userId: userId,
      remarks: remarks,
    });

    return updated[0];
  }

  // ============= MODULE 8: STORES LEDGER =============

  async getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<StoresLedger[]> {
    const db = await getDb();
    if (itemType) {
      return await db.select().from(storesLedger)
        .where(and(
          eq(storesLedger.vesselId, vesselId),
          eq(storesLedger.section, itemType)
        ))
        .orderBy(desc(storesLedger.timestampUTC));
    }
    return await db.select().from(storesLedger)
      .where(eq(storesLedger.vesselId, vesselId))
      .orderBy(desc(storesLedger.timestampUTC));
  }

  async getStoresItemHistory(itemId: number): Promise<StoresLedger[]> {
    const db = await getDb();
    return await db.select().from(storesLedger)
      .where(eq(storesLedger.itemId, itemId))
      .orderBy(desc(storesLedger.timestampUTC));
  }

  // ============= MODULE 9: DEFECTS =============

  async getDefects(filters?: { 
    statusView?: 'active' | 'resolved';
    vesselId?: string;
    isCoC?: boolean;
    category?: string;
    priority?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Defect[]> {
    const db = await getDb();
    const conditions: any[] = [];
    
    if (filters?.vesselId && filters.vesselId !== 'all') {
      conditions.push(eq(defects.vesselId, filters.vesselId));
    }
    
    if (filters?.statusView === 'active') {
      conditions.push(or(
        eq(defects.status, 'Open'),
        eq(defects.status, 'Pending'),
        eq(defects.status, 'In-Progress'),
        eq(defects.status, 'Awaiting Parts'),
        eq(defects.status, 'Deferred')
      ));
    } else if (filters?.statusView === 'resolved') {
      conditions.push(or(
        eq(defects.status, 'Closed'),
        eq(defects.status, 'Cancelled')
      ));
    }
    
    if (filters?.isCoC !== undefined) {
      conditions.push(eq(defects.is_coc, filters.isCoC));
    }
    
    if (filters?.category) {
      conditions.push(eq(defects.category, filters.category));
    }
    
    if (filters?.priority) {
      conditions.push(eq(defects.priority, filters.priority));
    }
    
    let query = db.select().from(defects);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(defects.issueDate)) as any;
    
    if (filters?.page !== undefined && filters?.pageSize !== undefined) {
      const offset = (filters.page - 1) * filters.pageSize;
      query = query.limit(filters.pageSize).offset(offset) as any;
    }
    
    return await query;
  }

  async getDefectsCount(filters?: { statusView?: 'active' | 'resolved'; vesselId?: string; isCoC?: boolean }): Promise<number> {
    const db = await getDb();
    const conditions: any[] = [];
    
    if (filters?.vesselId && filters.vesselId !== 'all') {
      conditions.push(eq(defects.vesselId, filters.vesselId));
    }
    
    if (filters?.statusView === 'active') {
      conditions.push(or(
        eq(defects.status, 'Open'),
        eq(defects.status, 'Pending'),
        eq(defects.status, 'In-Progress'),
        eq(defects.status, 'Awaiting Parts'),
        eq(defects.status, 'Deferred')
      ));
    } else if (filters?.statusView === 'resolved') {
      conditions.push(or(
        eq(defects.status, 'Closed'),
        eq(defects.status, 'Cancelled')
      ));
    }
    
    if (filters?.isCoC !== undefined) {
      conditions.push(eq(defects.is_coc, filters.isCoC));
    }
    
    let query = db.select({ count: sql<number>`count(*)` }).from(defects);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const result = await query;
    return Number(result[0]?.count || 0);
  }

  async getDefect(id: string): Promise<Defect | undefined> {
    const db = await getDb();
    const result = await db.select().from(defects).where(eq(defects.id, id));
    return result[0];
  }

  async getDefectBySeedId(seedId: string): Promise<Defect | undefined> {
    const db = await getDb();
    const result = await db.select().from(defects).where(eq(defects.seedId, seedId));
    return result[0];
  }

  async createDefect(defect: InsertDefect): Promise<Defect> {
    const db = await getDb();
    
    // Generate semantic defect ID: D{VesselCode}-{YY}-{Seq}
    // Example: D019-26-0023 (19th vessel, 2026, 23rd defect)
    const vesselId = defect.vesselId;
    const currentYear = new Date().getFullYear();
    const yearShort = currentYear % 100; // 2026 -> 26
    
    // Get vessel sequence number (based on creation order)
    // First try from vessels table
    const vesselResult = await db.select({ vesselSequence: vessels.vesselSequence })
      .from(vessels)
      .where(eq(vessels.id, vesselId));
    
    let vesselSeq = vesselResult[0]?.vesselSequence;
    
    // If vessel exists but doesn't have a sequence yet, assign one
    if (vesselResult.length > 0 && !vesselSeq) {
      const maxSeqResult = await db.select({ max: sql<number>`COALESCE(MAX(vessel_sequence), 0)` })
        .from(vessels);
      vesselSeq = (maxSeqResult[0]?.max || 0) + 1;
      await db.update(vessels)
        .set({ vesselSequence: vesselSeq })
        .where(eq(vessels.id, vesselId));
    }
    
    // If vessel doesn't exist in vessels table, derive sequence from defect_sequences or defects
    // This handles legacy data where vessel records may not exist
    if (!vesselSeq) {
      // Check if this vessel already has any defect sequences
      const existingVesselSeqs = await db.execute(sql`
        SELECT DISTINCT vessel_id FROM defect_sequences ORDER BY vessel_id
      `);
      const vesselIds = (existingVesselSeqs.rows as any[]).map(r => r.vessel_id);
      const existingIndex = vesselIds.indexOf(vesselId);
      
      if (existingIndex >= 0) {
        vesselSeq = existingIndex + 1;
      } else {
        // New vessel - assign next available sequence
        vesselSeq = vesselIds.length + 1;
      }
    }
    
    // Get or create defect sequence for this vessel/year
    const existingSeq = await db.select()
      .from(defectSequences)
      .where(and(
        eq(defectSequences.vesselId, vesselId),
        eq(defectSequences.year, currentYear)
      ));
    
    let nextSeq: number;
    if (existingSeq.length === 0) {
      // Create new sequence for this vessel/year starting at 1
      await db.insert(defectSequences).values({
        vesselId,
        year: currentYear,
        lastSequence: 1,
      });
      nextSeq = 1;
    } else {
      // Increment existing sequence
      nextSeq = existingSeq[0].lastSequence + 1;
      await db.update(defectSequences)
        .set({ lastSequence: nextSeq })
        .where(and(
          eq(defectSequences.vesselId, vesselId),
          eq(defectSequences.year, currentYear)
        ));
    }
    
    // Format: D{VesselCode 3 digits}-{Year 2 digits}-{Seq 4 digits}
    const vesselCode = String(vesselSeq).padStart(3, '0');
    const yearCode = String(yearShort).padStart(2, '0');
    const seqCode = String(nextSeq).padStart(4, '0');
    const id = `D${vesselCode}-${yearCode}-${seqCode}`;
    
    const result = await db.insert(defects).values({
      ...defect,
      id,
    }).returning();
    return result[0];
  }

  async updateDefect(id: string, data: Partial<InsertDefect>): Promise<Defect> {
    const db = await getDb();
    const result = await db.update(defects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(defects.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Defect ${id} not found`);
    }
    return result[0];
  }

  async deleteDefect(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(defects).where(eq(defects.id, id));
  }

  async addDefectNote(defectId: string, note: { noteText: string; attachments: string[]; createdBy: string }): Promise<Defect> {
    const db = await getDb();
    const defect = await this.getDefect(defectId);
    if (!defect) {
      throw new Error(`Defect ${defectId} not found`);
    }
    
    const newNote = {
      noteId: `NOTE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      noteText: note.noteText,
      attachments: note.attachments,
      createdBy: note.createdBy,
      createdOn: new Date().toISOString(),
    };
    
    const existingNotes = Array.isArray(defect.notes) ? defect.notes : [];
    const updatedNotes = [...existingNotes, newNote];
    
    const result = await db.update(defects)
      .set({ notes: updatedNotes, updatedAt: new Date() })
      .where(eq(defects.id, defectId))
      .returning();
    
    return result[0];
  }

  async linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect> {
    const db = await getDb();
    const defect = await this.getDefect(defectId);
    if (!defect) {
      throw new Error(`Defect ${defectId} not found`);
    }
    
    const existingLinks = Array.isArray(defect.linkedDefects) ? defect.linkedDefects : [];
    const mergedLinks = [...new Set([...existingLinks, ...linkedDefectIds])];
    
    const result = await db.update(defects)
      .set({ linkedDefects: mergedLinks, updatedAt: new Date() })
      .where(eq(defects.id, defectId))
      .returning();
    
    return result[0];
  }

  async closeDefect(defectId: string, closure: { 
    closedBy: string; 
    closureComment?: string; 
    closureFiles?: string[];
  }): Promise<Defect> {
    const db = await getDb();
    const result = await db.update(defects)
      .set({
        status: 'Closed',
        closedBy: closure.closedBy,
        closedOn: new Date().toISOString(),
        closureComment: closure.closureComment,
        closureFiles: closure.closureFiles,
        dateCompleted: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(defects.id, defectId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Defect ${defectId} not found`);
    }
    return result[0];
  }

  // ============= MODULE 9: DEFECT ACTIONS =============

  async getDefectActions(defectId: string): Promise<DefectAction[]> {
    const db = await getDb();
    return await db.select().from(defectActions)
      .where(eq(defectActions.defectId, defectId))
      .orderBy(desc(defectActions.createdAt));
  }

  async createDefectAction(action: InsertDefectAction): Promise<DefectAction> {
    const db = await getDb();
    const result = await db.insert(defectActions).values(action).returning();
    return result[0];
  }

  async updateDefectAction(id: number, updates: Partial<InsertDefectAction>): Promise<DefectAction> {
    const db = await getDb();
    const result = await db.update(defectActions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(defectActions.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Defect action ${id} not found`);
    }
    return result[0];
  }

  async deleteDefectAction(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(defectActions).where(eq(defectActions.id, id));
  }

  // ============= MODULE 9: DEFECT ATTACHMENTS =============

  async getDefectAttachments(defectId: string): Promise<DefectAttachment[]> {
    const db = await getDb();
    return await db.select().from(defectAttachments)
      .where(eq(defectAttachments.defectId, defectId));
  }

  async createDefectAttachment(attachment: InsertDefectAttachment): Promise<DefectAttachment> {
    const db = await getDb();
    const result = await db.insert(defectAttachments).values(attachment).returning();
    return result[0];
  }

  async deleteDefectAttachment(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(defectAttachments).where(eq(defectAttachments.id, id));
  }

  // ============= MODULE 9: RECURRING DEFECTS =============

  async getRecurringDefects(filters?: { 
    windowMonths?: number; 
    minOccurrences?: number; 
    hasCoc?: boolean; 
    equipmentKey?: string 
  }): Promise<RecurringDefect[]> {
    const db = await getDb();
    const conditions: any[] = [];
    
    if (filters?.windowMonths !== undefined) {
      conditions.push(eq(recurringDefects.windowMonths, filters.windowMonths));
    }
    
    if (filters?.minOccurrences !== undefined) {
      conditions.push(gte(recurringDefects.occurrenceCount, filters.minOccurrences));
    }
    
    if (filters?.hasCoc !== undefined) {
      conditions.push(eq(recurringDefects.hasCoc, filters.hasCoc));
    }
    
    if (filters?.equipmentKey) {
      conditions.push(eq(recurringDefects.equipmentKey, filters.equipmentKey));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(recurringDefects)
        .where(and(...conditions))
        .orderBy(desc(recurringDefects.occurrenceCount));
    }
    
    return await db.select().from(recurringDefects)
      .orderBy(desc(recurringDefects.occurrenceCount));
  }

  async getRecurringDefect(id: number): Promise<RecurringDefect | undefined> {
    const db = await getDb();
    const result = await db.select().from(recurringDefects).where(eq(recurringDefects.id, id));
    return result[0];
  }

  async createRecurringDefect(recurring: InsertRecurringDefect): Promise<RecurringDefect> {
    const db = await getDb();
    const result = await db.insert(recurringDefects).values(recurring).returning();
    return result[0];
  }

  async updateRecurringDefect(id: number, data: Partial<InsertRecurringDefect>): Promise<RecurringDefect> {
    const db = await getDb();
    const result = await db.update(recurringDefects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recurringDefects.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Recurring defect ${id} not found`);
    }
    return result[0];
  }

  async deleteRecurringDefect(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(recurringDefects).where(eq(recurringDefects.id, id));
  }

  // ============= MODULE 9: RECURRING DEFECT LINKS =============

  async getRecurringDefectLinks(recurringId: number): Promise<RecurringDefectLink[]> {
    const db = await getDb();
    return await db.select().from(recurringDefectLinks)
      .where(eq(recurringDefectLinks.recurringId, recurringId));
  }

  async getDefectsForRecurring(recurringId: number): Promise<Defect[]> {
    const db = await getDb();
    const links = await this.getRecurringDefectLinks(recurringId);
    if (links.length === 0) {
      return [];
    }
    const defectIds = links.map(l => l.defectId);
    return await db.select().from(defects)
      .where(inArray(defects.id, defectIds))
      .orderBy(desc(defects.issueDate));
  }

  async createRecurringDefectLink(link: InsertRecurringDefectLink): Promise<RecurringDefectLink> {
    const db = await getDb();
    const result = await db.insert(recurringDefectLinks).values(link).returning();
    return result[0];
  }

  async deleteRecurringDefectLink(recurringId: number, defectId: string): Promise<void> {
    const db = await getDb();
    await db.delete(recurringDefectLinks)
      .where(and(
        eq(recurringDefectLinks.recurringId, recurringId),
        eq(recurringDefectLinks.defectId, defectId)
      ));
  }

  // ============= MODULE 10: ALERT POLICIES =============

  async getAlertPolicies(): Promise<AlertPolicy[]> {
    const db = await getDb();
    return await db.select().from(alertPolicies).orderBy(desc(alertPolicies.createdAt));
  }

  async getAlertPolicy(id: number): Promise<AlertPolicy | undefined> {
    const db = await getDb();
    const result = await db.select().from(alertPolicies).where(eq(alertPolicies.id, id));
    return result[0];
  }

  async createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy> {
    const db = await getDb();
    const result = await db.insert(alertPolicies).values(policy).returning();
    return result[0];
  }

  async updateAlertPolicy(id: number, data: Partial<AlertPolicy>): Promise<AlertPolicy> {
    const db = await getDb();
    const result = await db.update(alertPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertPolicies.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Alert policy ${id} not found`);
    }
    return result[0];
  }

  async deleteAlertPolicy(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(alertPolicies).where(eq(alertPolicies.id, id));
  }

  // ============= MODULE 10: ALERT EVENTS =============

  async getAlertEvents(filters?: {
    policyId?: number;
    alertType?: string;
    vesselId?: string;
    acknowledged?: boolean;
  }): Promise<AlertEvent[]> {
    const db = await getDb();
    const conditions: any[] = [];
    
    if (filters?.policyId !== undefined) {
      conditions.push(eq(alertEvents.policyId, filters.policyId));
    }
    
    if (filters?.alertType) {
      conditions.push(eq(alertEvents.alertType, filters.alertType));
    }
    
    if (filters?.vesselId) {
      conditions.push(eq(alertEvents.vesselId, filters.vesselId));
    }
    
    if (filters?.acknowledged !== undefined) {
      if (filters.acknowledged) {
        conditions.push(sql`${alertEvents.ackBy} IS NOT NULL`);
      } else {
        conditions.push(sql`${alertEvents.ackBy} IS NULL`);
      }
    }
    
    if (conditions.length > 0) {
      return await db.select().from(alertEvents)
        .where(and(...conditions))
        .orderBy(desc(alertEvents.createdAt));
    }
    
    return await db.select().from(alertEvents).orderBy(desc(alertEvents.createdAt));
  }

  async getAlertEvent(id: number): Promise<AlertEvent | undefined> {
    const db = await getDb();
    const result = await db.select().from(alertEvents).where(eq(alertEvents.id, id));
    return result[0];
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    const db = await getDb();
    const result = await db.insert(alertEvents).values(event).returning();
    return result[0];
  }

  async acknowledgeAlertEvent(id: number, userId: string): Promise<AlertEvent> {
    const db = await getDb();
    const result = await db.update(alertEvents)
      .set({ ackBy: userId, ackAt: new Date() })
      .where(eq(alertEvents.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Alert event ${id} not found`);
    }
    return result[0];
  }

  // ============= MODULE 10: ALERT DELIVERIES =============

  async getAlertDeliveries(eventId: number): Promise<AlertDelivery[]> {
    const db = await getDb();
    return await db.select().from(alertDeliveries)
      .where(eq(alertDeliveries.eventId, eventId))
      .orderBy(desc(alertDeliveries.createdAt));
  }

  async createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery> {
    const db = await getDb();
    const result = await db.insert(alertDeliveries).values(delivery).returning();
    return result[0];
  }

  async updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery> {
    const db = await getDb();
    const updateData: any = { status };
    
    if (status === 'sent') {
      updateData.sentAt = new Date();
    }
    
    if (status === 'acknowledged') {
      updateData.acknowledgedAt = new Date();
    }
    
    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }
    
    const result = await db.update(alertDeliveries)
      .set(updateData)
      .where(eq(alertDeliveries.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Alert delivery ${id} not found`);
    }
    return result[0];
  }

  // ============= MODULE 10: ALERT CONFIG =============

  async getAlertConfig(vesselId: string): Promise<AlertConfig | undefined> {
    const db = await getDb();
    const result = await db.select().from(alertConfig)
      .where(eq(alertConfig.vesselId, vesselId));
    return result[0];
  }

  async createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig> {
    const db = await getDb();
    const existing = await this.getAlertConfig(config.vesselId);
    
    if (existing) {
      const result = await db.update(alertConfig)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(alertConfig.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(alertConfig).values(config).returning();
      return result[0];
    }
  }

  // ============= MODULE 11: FORM DEFINITIONS =============

  async getFormDefinitions(): Promise<FormDefinition[]> {
    const db = await getDb();
    return await db.select().from(formDefinitions);
  }

  async getFormDefinition(id: number): Promise<FormDefinition | undefined> {
    const db = await getDb();
    const result = await db.select().from(formDefinitions)
      .where(eq(formDefinitions.id, id));
    return result[0];
  }

  async getFormDefinitionByName(name: string): Promise<FormDefinition | undefined> {
    const db = await getDb();
    const result = await db.select().from(formDefinitions)
      .where(eq(formDefinitions.name, name));
    return result[0];
  }

  async createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition> {
    const db = await getDb();
    const result = await db.insert(formDefinitions).values(form).returning();
    return result[0];
  }

  // ============= MODULE 11: FORM VERSIONS =============

  async getFormVersions(formId: number): Promise<FormVersion[]> {
    const db = await getDb();
    return await db.select().from(formVersions)
      .where(eq(formVersions.formId, formId))
      .orderBy(desc(formVersions.versionNo));
  }

  async getFormVersion(id: number): Promise<FormVersion | undefined> {
    const db = await getDb();
    const result = await db.select().from(formVersions)
      .where(eq(formVersions.id, id));
    return result[0];
  }

  async getLatestPublishedVersion(formId: number): Promise<FormVersion | undefined> {
    const db = await getDb();
    const result = await db.select().from(formVersions)
      .where(and(
        eq(formVersions.formId, formId),
        eq(formVersions.status, 'PUBLISHED')
      ))
      .orderBy(desc(formVersions.versionNo))
      .limit(1);
    return result[0];
  }

  async getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined> {
    const form = await this.getFormDefinitionByName(name);
    if (!form) return undefined;
    return this.getLatestPublishedVersion(form.id);
  }

  async createFormVersion(version: InsertFormVersion): Promise<FormVersion> {
    const db = await getDb();
    const result = await db.insert(formVersions).values(version).returning();
    return result[0];
  }

  async updateFormVersion(id: number, data: Partial<FormVersion>): Promise<FormVersion> {
    const db = await getDb();
    const result = await db.update(formVersions)
      .set(data)
      .where(eq(formVersions.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Form version ${id} not found`);
    }
    return result[0];
  }

  async publishFormVersion(id: number, userId: string, changelog: string): Promise<FormVersion> {
    const db = await getDb();
    const result = await db.update(formVersions)
      .set({ 
        status: 'PUBLISHED',
        authorUserId: userId,
        changelog,
        versionDate: new Date()
      })
      .where(eq(formVersions.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Form version ${id} not found`);
    }
    return result[0];
  }

  async discardFormVersion(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(formVersions).where(eq(formVersions.id, id));
  }

  // ============= MODULE 11: FORM VERSION USAGE =============

  async createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage> {
    const db = await getDb();
    const result = await db.insert(formVersionUsage).values(usage).returning();
    return result[0];
  }

  async getFormVersionUsage(formVersionId: number): Promise<FormVersionUsage[]> {
    const db = await getDb();
    return await db.select().from(formVersionUsage)
      .where(eq(formVersionUsage.formVersionId, formVersionId));
  }

  async seedForms(): Promise<void> {
    // Check if forms already exist
    const existingForms = await this.getFormDefinitions();
    if (existingForms.length > 0) {
      return; // Already seeded
    }
    
    // Seed default form definitions
    const defaultForms = [
      { name: 'ADD_COMPONENT', subgroup: 'components' },
      { name: 'EDIT_COMPONENT', subgroup: 'components' },
      { name: 'WO_PLANNED', subgroup: 'work_orders' },
      { name: 'WO_UNPLANNED', subgroup: 'work_orders' },
      { name: 'ADD_JOB', subgroup: 'jobs' },
      { name: 'EDIT_JOB', subgroup: 'jobs' },
    ];
    
    for (const form of defaultForms) {
      await this.createFormDefinition(form);
    }
  }

  // ============= MODULE 12: CHANGE REQUESTS =============

  async getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string }): Promise<ChangeRequest[]> {
    const db = await getDb();
    let conditions: any[] = [];
    
    if (filters?.category) {
      conditions.push(eq(changeRequest.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(changeRequest.status, filters.status));
    }
    if (filters?.vesselId) {
      conditions.push(eq(changeRequest.vesselId, filters.vesselId));
    }
    if (filters?.q) {
      conditions.push(ilike(changeRequest.title, `%${filters.q}%`));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(changeRequest)
        .where(and(...conditions))
        .orderBy(desc(changeRequest.createdAt));
    }
    return await db.select().from(changeRequest).orderBy(desc(changeRequest.createdAt));
  }

  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    const db = await getDb();
    const result = await db.select().from(changeRequest)
      .where(eq(changeRequest.id, id));
    return result[0];
  }

  async createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest> {
    const db = await getDb();
    const result = await db.insert(changeRequest).values({
      ...request,
      targetType: request.targetType || null,
      targetId: request.targetId || null,
      snapshotBeforeJson: request.snapshotBeforeJson || null,
      proposedChangesJson: request.proposedChangesJson || null,
      movePreviewJson: request.movePreviewJson || null,
      submittedAt: request.submittedAt || null,
      reviewedByUserId: request.reviewedByUserId || null,
      reviewedAt: request.reviewedAt || null,
    }).returning();
    return result[0];
  }

  async updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest> {
    const db = await getDb();
    const result = await db.update(changeRequest)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(changeRequest.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Change request ${id} not found`);
    }
    return result[0];
  }

  async updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest> {
    return this.updateChangeRequest(id, { targetType, targetId, snapshotBeforeJson });
  }

  async updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest> {
    return this.updateChangeRequest(id, { proposedChangesJson, movePreviewJson });
  }

  async deleteChangeRequest(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(changeRequest).where(eq(changeRequest.id, id));
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
    if (!existing) throw new Error('Change request not found');
    
    const now = new Date();
    const newRevisionNumber = (existing.revisionNumber || 0) + 1;
    const revisionHistoryEntry = {
      revisionNumber: newRevisionNumber,
      approvedBy: reviewerId,
      approvedAt: now.toISOString(),
      appliedChanges: existing.proposedChangesJson || [],
      comments: comment
    };
    const updatedHistory = [...(existing.revisionHistory || []), revisionHistoryEntry];
    
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

  // ============= MODULE 12: CHANGE REQUEST ATTACHMENTS =============

  async getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]> {
    const db = await getDb();
    return await db.select().from(changeRequestAttachment)
      .where(eq(changeRequestAttachment.changeRequestId, changeRequestId));
  }

  async createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment> {
    const db = await getDb();
    const result = await db.insert(changeRequestAttachment).values(attachment).returning();
    return result[0];
  }

  // ============= MODULE 12: CHANGE REQUEST COMMENTS =============

  async getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]> {
    const db = await getDb();
    return await db.select().from(changeRequestComment)
      .where(eq(changeRequestComment.changeRequestId, changeRequestId))
      .orderBy(asc(changeRequestComment.createdAt));
  }

  async createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment> {
    const db = await getDb();
    const result = await db.insert(changeRequestComment).values(comment).returning();
    return result[0];
  }

  // ============= MODULE 13: IHM ITEMS =============

  async getIhmItem(id: string, type: 'component' | 'spare'): Promise<IhmItem | undefined> {
    const db = await getDb();
    let result: IhmItem[];
    
    if (type === 'component') {
      result = await db.select().from(ihmItems).where(eq(ihmItems.componentId, id));
    } else {
      result = await db.select().from(ihmItems).where(eq(ihmItems.spareId, id));
    }
    
    return result[0];
  }

  async getIhmItems(vesselId?: string): Promise<IhmItem[]> {
    const db = await getDb();
    if (vesselId) {
      return await db.select().from(ihmItems).where(eq(ihmItems.vesselId, vesselId));
    }
    return await db.select().from(ihmItems);
  }

  async upsertIhmItem(item: InsertIhmItem): Promise<IhmItem> {
    const db = await getDb();
    
    // Check if item exists
    let existing: IhmItem | undefined;
    if (item.componentId) {
      const results = await db.select().from(ihmItems).where(eq(ihmItems.componentId, item.componentId));
      existing = results[0];
    } else if (item.spareId) {
      const results = await db.select().from(ihmItems).where(eq(ihmItems.spareId, item.spareId));
      existing = results[0];
    }
    
    if (existing) {
      // Update existing item
      const result = await db.update(ihmItems)
        .set({ ...item, updatedAt: new Date() })
        .where(eq(ihmItems.id, existing.id))
        .returning();
      return result[0];
    } else {
      // Insert new item
      const result = await db.insert(ihmItems).values(item).returning();
      return result[0];
    }
  }

  async deleteIhmItem(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(ihmItems).where(eq(ihmItems.id, id));
  }

  // ============= MODULE 13: IHM MAINTENANCE LOG =============

  async getIhmMaintenanceLog(filters: { vesselId?: string; componentId?: string; spareId?: string; workOrderId?: string }): Promise<IhmMaintenanceLog[]> {
    const db = await getDb();
    let conditions: any[] = [];
    
    if (filters.vesselId) {
      conditions.push(eq(ihmMaintenanceLog.vesselId, filters.vesselId));
    }
    if (filters.componentId) {
      conditions.push(eq(ihmMaintenanceLog.targetComponent, filters.componentId));
    }
    if (filters.spareId) {
      conditions.push(eq(ihmMaintenanceLog.targetSpare, filters.spareId));
    }
    if (filters.workOrderId) {
      conditions.push(eq(ihmMaintenanceLog.workOrderId, filters.workOrderId));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(ihmMaintenanceLog)
        .where(and(...conditions))
        .orderBy(desc(ihmMaintenanceLog.createdAt));
    }
    return await db.select().from(ihmMaintenanceLog).orderBy(desc(ihmMaintenanceLog.createdAt));
  }

  async createIhmMaintenanceLogEntry(entry: InsertIhmMaintenanceLog): Promise<IhmMaintenanceLog> {
    const db = await getDb();
    const result = await db.insert(ihmMaintenanceLog).values(entry).returning();
    return result[0];
  }

  async getIhmStatusReport(vesselId: string): Promise<IhmItem[]> {
    const db = await getDb();
    return await db.select().from(ihmItems)
      .where(eq(ihmItems.vesselId, vesselId));
  }

  // ============= MODULE 14: FLEET VESSEL MAPPING =============

  async getFleetVesselMappings(fleetEquipmentCode?: string): Promise<FleetVesselMapping[]> {
    const db = await getDb();
    if (fleetEquipmentCode) {
      return await db.select().from(fleetVesselMapping)
        .where(and(
          eq(fleetVesselMapping.fleetEquipmentCode, fleetEquipmentCode),
          eq(fleetVesselMapping.isActive, true)
        ));
    }
    return await db.select().from(fleetVesselMapping)
      .where(eq(fleetVesselMapping.isActive, true));
  }

  async getFleetVesselMappingsByVessel(vesselCode: string): Promise<FleetVesselMapping[]> {
    const db = await getDb();
    return await db.select().from(fleetVesselMapping)
      .where(and(
        eq(fleetVesselMapping.vesselCode, vesselCode),
        eq(fleetVesselMapping.isActive, true)
      ));
  }

  async createFleetVesselMappingRecord(mapping: InsertFleetVesselMapping): Promise<FleetVesselMapping> {
    const db = await getDb();
    const result = await db.insert(fleetVesselMapping).values({
      fleetEquipmentCode: mapping.fleetEquipmentCode,
      vesselCode: mapping.vesselCode,
      vesselName: mapping.vesselName ?? null,
      mappedBy: mapping.mappedBy,
      isActive: mapping.isActive ?? true,
    }).returning();
    return result[0];
  }

  async removeFleetVesselMappingRecord(fleetEquipmentCode: string, vesselCode: string): Promise<void> {
    const db = await getDb();
    await db.update(fleetVesselMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetVesselMapping.fleetEquipmentCode, fleetEquipmentCode),
        eq(fleetVesselMapping.vesselCode, vesselCode)
      ));
  }

  // ============= MODULE 14: FLEET COMPONENT MAPPING =============

  async getFleetComponentMappings(fleetEquipmentCode: string): Promise<FleetComponentMapping[]> {
    const db = await getDb();
    return await db.select().from(fleetComponentMapping)
      .where(and(
        eq(fleetComponentMapping.fleetEquipmentCode, fleetEquipmentCode),
        eq(fleetComponentMapping.isActive, true)
      ));
  }

  async getFleetComponentMappingsByVessel(vesselCode: string): Promise<FleetComponentMapping[]> {
    const db = await getDb();
    return await db.select().from(fleetComponentMapping)
      .where(and(
        eq(fleetComponentMapping.vesselCode, vesselCode),
        eq(fleetComponentMapping.isActive, true)
      ));
  }

  async createFleetComponentMappingRecord(mapping: InsertFleetComponentMapping): Promise<FleetComponentMapping> {
    const db = await getDb();
    const result = await db.insert(fleetComponentMapping).values({
      fleetEquipmentCode: mapping.fleetEquipmentCode,
      vesselCode: mapping.vesselCode,
      componentCode: mapping.componentCode,
      componentId: mapping.componentId ?? null,
      componentName: mapping.componentName ?? null,
      mappedBy: mapping.mappedBy,
      isActive: mapping.isActive ?? true,
    }).returning();
    return result[0];
  }

  async removeFleetComponentMappingRecord(fleetEquipmentCode: string, vesselCode: string, componentCode: string): Promise<void> {
    const db = await getDb();
    await db.update(fleetComponentMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetComponentMapping.fleetEquipmentCode, fleetEquipmentCode),
        eq(fleetComponentMapping.vesselCode, vesselCode),
        eq(fleetComponentMapping.componentCode, componentCode)
      ));
  }

  // ============= MODULE 14: FLEET JOB VESSEL MAPPING =============

  async getFleetJobVesselMappings(fleetEquipmentCode?: string, jobCode?: string): Promise<FleetJobVesselMapping[]> {
    const db = await getDb();
    let conditions: any[] = [eq(fleetJobVesselMapping.isActive, true)];
    
    if (fleetEquipmentCode) {
      conditions.push(eq(fleetJobVesselMapping.fleetEquipmentCode, fleetEquipmentCode));
    }
    if (jobCode) {
      conditions.push(eq(fleetJobVesselMapping.jobCode, jobCode));
    }
    
    return await db.select().from(fleetJobVesselMapping)
      .where(and(...conditions));
  }

  async createFleetJobVesselMappingRecord(mapping: InsertFleetJobVesselMapping): Promise<FleetJobVesselMapping> {
    const db = await getDb();
    const result = await db.insert(fleetJobVesselMapping).values({
      fleetEquipmentCode: mapping.fleetEquipmentCode,
      jobCode: mapping.jobCode,
      jobId: mapping.jobId ?? null,
      vesselCode: mapping.vesselCode,
      vesselName: mapping.vesselName ?? null,
      mappedBy: mapping.mappedBy,
      isActive: mapping.isActive ?? true,
    }).returning();
    return result[0];
  }

  async removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string): Promise<void> {
    const db = await getDb();
    await db.update(fleetJobVesselMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetJobVesselMapping.jobCode, jobCode),
        eq(fleetJobVesselMapping.vesselCode, vesselCode)
      ));
  }

  // ============= MODULE 14: FLEET SPARE VESSEL MAPPING =============

  async getFleetSpareVesselMappings(fleetEquipmentCode?: string, partCode?: string): Promise<FleetSpareVesselMapping[]> {
    const db = await getDb();
    let conditions: any[] = [eq(fleetSpareVesselMapping.isActive, true)];
    
    if (fleetEquipmentCode) {
      conditions.push(eq(fleetSpareVesselMapping.fleetEquipmentCode, fleetEquipmentCode));
    }
    if (partCode) {
      conditions.push(eq(fleetSpareVesselMapping.partCode, partCode));
    }
    
    return await db.select().from(fleetSpareVesselMapping)
      .where(and(...conditions));
  }

  async createFleetSpareVesselMappingRecord(mapping: InsertFleetSpareVesselMapping): Promise<FleetSpareVesselMapping> {
    const db = await getDb();
    const result = await db.insert(fleetSpareVesselMapping).values({
      fleetEquipmentCode: mapping.fleetEquipmentCode,
      partCode: mapping.partCode,
      spareId: mapping.spareId ?? null,
      vesselCode: mapping.vesselCode,
      vesselName: mapping.vesselName ?? null,
      mappedBy: mapping.mappedBy,
      isActive: mapping.isActive ?? true,
    }).returning();
    return result[0];
  }

  async removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string): Promise<void> {
    const db = await getDb();
    await db.update(fleetSpareVesselMapping)
      .set({ isActive: false })
      .where(and(
        eq(fleetSpareVesselMapping.partCode, partCode),
        eq(fleetSpareVesselMapping.vesselCode, vesselCode)
      ));
  }

  // ============= MODULE 15: IMPORT ENGINE =============

  async createImportHistory(history: InsertImportHistory): Promise<ImportHistory> {
    const db = await getDb();
    const result = await db.insert(importHistory).values({
      id: history.id,
      type: history.type,
      mode: history.mode,
      archiveMissing: history.archiveMissing ?? false,
      userId: history.userId,
      vesselId: history.vesselId ?? null,
      created: history.created ?? 0,
      updated: history.updated ?? 0,
      skipped: history.skipped ?? 0,
      archived: history.archived ?? 0,
      status: history.status,
      originalName: history.originalName ?? null,
      fileSize: history.fileSize ?? null,
      storedFilePath: history.storedFilePath ?? null,
      undoneAt: history.undoneAt ?? null,
      errorMessage: history.errorMessage ?? null,
    }).returning();
    return result[0];
  }

  async getImportHistory(type?: string, limit: number = 20, offset: number = 0): Promise<{ items: ImportHistory[]; total: number }> {
    const db = await getDb();
    
    let query = db.select().from(importHistory);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(importHistory);
    
    if (type) {
      query = query.where(eq(importHistory.type, type)) as typeof query;
      countQuery = countQuery.where(eq(importHistory.type, type)) as typeof countQuery;
    }
    
    const items = await query
      .orderBy(desc(importHistory.startedAt))
      .limit(limit)
      .offset(offset);
    
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count ?? 0);
    
    return { items, total };
  }

  async getImportHistoryById(id: string): Promise<ImportHistory | undefined> {
    const db = await getDb();
    const result = await db.select().from(importHistory)
      .where(eq(importHistory.id, id));
    return result[0];
  }

  async updateImportHistory(id: string, data: Partial<ImportHistory>): Promise<ImportHistory> {
    const db = await getDb();
    const result = await db.update(importHistory)
      .set(data)
      .where(eq(importHistory.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Import history with id ${id} not found`);
    }
    return result[0];
  }

  async createImportChangeLog(log: InsertImportChangeLog): Promise<ImportChangeLog> {
    const db = await getDb();
    const result = await db.insert(importChangeLog).values({
      id: log.id,
      importHistoryId: log.importHistoryId,
      entityType: log.entityType,
      entityId: log.entityId,
      operation: log.operation,
      previousData: log.previousData ?? null,
      newData: log.newData ?? null,
      checksum: log.checksum,
    }).returning();
    return result[0];
  }

  async getImportChangeLogs(importHistoryId: string): Promise<ImportChangeLog[]> {
    const db = await getDb();
    return await db.select().from(importChangeLog)
      .where(eq(importChangeLog.importHistoryId, importHistoryId))
      .orderBy(desc(importChangeLog.createdAt));
  }

  async deleteImportChangeLogs(importHistoryId: string): Promise<void> {
    const db = await getDb();
    await db.delete(importChangeLog)
      .where(eq(importChangeLog.importHistoryId, importHistoryId));
  }

  // ============= MODULE 16: BULK IMPORT =============

  async getBulkImportHistory(vesselCode?: string, moduleType?: string): Promise<BulkImportHistory[]> {
    const db = await getDb();
    let conditions: any[] = [];
    
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
    const db = await getDb();
    const result = await db.select().from(bulkImportHistory)
      .where(eq(bulkImportHistory.id, id));
    return result[0];
  }

  async createBulkImportHistory(history: InsertBulkImportHistory): Promise<BulkImportHistory> {
    const db = await getDb();
    const result = await db.insert(bulkImportHistory).values({
      vesselCode: history.vesselCode ?? null,
      vesselName: history.vesselName ?? null,
      moduleType: history.moduleType,
      sheetName: history.sheetName ?? null,
      fileName: history.fileName,
      fileSize: history.fileSize ?? null,
      uploadedBy: history.uploadedBy,
      uploadedByName: history.uploadedByName ?? null,
      totalRows: history.totalRows ?? 0,
      successCount: history.successCount ?? 0,
      failedCount: history.failedCount ?? 0,
      skippedCount: history.skippedCount ?? 0,
      status: history.status ?? 'Processing',
      errorSummary: history.errorSummary ?? null,
      isFleetImport: history.isFleetImport ?? false,
      templateVersion: history.templateVersion ?? null,
      processingTimeMs: history.processingTimeMs ?? null,
    }).returning();
    return result[0];
  }

  async updateBulkImportHistory(id: number, data: Partial<BulkImportHistory>): Promise<BulkImportHistory> {
    const db = await getDb();
    const result = await db.update(bulkImportHistory)
      .set(data)
      .where(eq(bulkImportHistory.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Bulk Import History with id ${id} not found`);
    }
    return result[0];
  }

  async getBulkImportErrors(importId: number): Promise<BulkImportError[]> {
    const db = await getDb();
    return await db.select().from(bulkImportErrors)
      .where(eq(bulkImportErrors.importId, importId))
      .orderBy(asc(bulkImportErrors.rowNumber));
  }

  async createBulkImportError(error: InsertBulkImportError): Promise<BulkImportError> {
    const db = await getDb();
    const result = await db.insert(bulkImportErrors).values({
      importId: error.importId,
      rowNumber: error.rowNumber,
      fieldName: error.fieldName ?? null,
      fieldValue: error.fieldValue ?? null,
      errorType: error.errorType,
      errorDescription: error.errorDescription,
      recommendedFix: error.recommendedFix ?? null,
      severity: error.severity ?? 'Error',
      rawRowData: error.rawRowData ?? null,
    }).returning();
    return result[0];
  }

  async createBulkImportErrors(errors: InsertBulkImportError[]): Promise<BulkImportError[]> {
    if (errors.length === 0) return [];
    const db = await getDb();
    const results: BulkImportError[] = [];
    
    for (const error of errors) {
      const result = await this.createBulkImportError(error);
      results.push(result);
    }
    
    return results;
  }

  // ============= MODULE 17: AUDIT LOG =============

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const db = await getDb();
    const result = await db.insert(auditLog).values({
      userId: data.userId,
      vesselCode: data.vesselCode ?? null,
      componentCode: data.componentCode ?? null,
      entityType: data.entityType,
      entityId: data.entityId,
      actionType: data.actionType,
      fieldName: data.fieldName ?? null,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
      source: data.source,
      payload: data.payload ?? null,
    }).returning();
    return result[0];
  }

  async getAuditLogs(filters?: {
    vesselCode?: string;
    componentCode?: string;
    entityType?: string;
    entityId?: string;
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const db = await getDb();
    let conditions: any[] = [];
    
    if (filters) {
      if (filters.vesselCode) {
        conditions.push(eq(auditLog.vesselCode, filters.vesselCode));
      }
      if (filters.componentCode) {
        conditions.push(eq(auditLog.componentCode, filters.componentCode));
      }
      if (filters.entityType) {
        conditions.push(eq(auditLog.entityType, filters.entityType));
      }
      if (filters.entityId) {
        conditions.push(eq(auditLog.entityId, filters.entityId));
      }
      if (filters.actionType) {
        conditions.push(eq(auditLog.actionType, filters.actionType));
      }
      if (filters.startDate) {
        conditions.push(gte(auditLog.timestamp, filters.startDate));
      }
      if (filters.endDate) {
        conditions.push(lte(auditLog.timestamp, filters.endDate));
      }
    }
    
    let query = db.select().from(auditLog);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    query = query.orderBy(desc(auditLog.timestamp)) as typeof query;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return await query;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    const db = await getDb();
    return await db.select().from(auditLog)
      .where(and(
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId)
      ))
      .orderBy(desc(auditLog.timestamp));
  }

  async getAuditLogsByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    const db = await getDb();
    return await db.select().from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);
  }

  // ============= WORK ORDER EXECUTIONS (Original) =============
  
  async getWorkOrderExecutions(componentId: string): Promise<WorkOrderExecution[]> {
    const db = await getDb();
    return await db.select().from(workOrderExecutions)
      .where(eq(workOrderExecutions.componentId, componentId))
      .orderBy(desc(workOrderExecutions.createdAt));
  }

  async getWorkOrderExecutionById(id: string): Promise<WorkOrderExecution | null> {
    const db = await getDb();
    const result = await db.select().from(workOrderExecutions)
      .where(eq(workOrderExecutions.id, id))
      .limit(1);
    return result[0] || null;
  }

  async createWorkOrderExecution(data: InsertWorkOrderExecution): Promise<WorkOrderExecution> {
    const db = await getDb();
    const result = await db.insert(workOrderExecutions).values(data).returning();
    return result[0];
  }

  async updateWorkOrderExecution(id: string, data: Partial<InsertWorkOrderExecution>): Promise<WorkOrderExecution> {
    const db = await getDb();
    const result = await db.update(workOrderExecutions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workOrderExecutions.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`WorkOrderExecution not found: ${id}`);
    }
    return result[0];
  }

  // ============= CERTIFICATES =============
  
  async getCertificates(): Promise<Certificate[]> {
    const db = await getDb();
    return await db.select().from(certificates)
      .where(eq(certificates.isActive, true))
      .orderBy(asc(certificates.certificateName));
  }

  async getCertificate(id: string): Promise<Certificate | undefined> {
    const db = await getDb();
    const result = await db.select().from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    return result[0];
  }

  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const db = await getDb();
    const result = await db.insert(certificates).values({
      ...certificate,
      attachments: certificate.attachments || [],
    }).returning();
    return result[0];
  }

  async updateCertificate(id: string, data: Partial<Certificate>): Promise<Certificate> {
    const db = await getDb();
    const { id: _, createdAt: __, ...updateData } = data as any;
    const result = await db.update(certificates)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(certificates.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Certificate not found: ${id}`);
    }
    return result[0];
  }

  async deleteCertificate(id: string): Promise<void> {
    const db = await getDb();
    await db.update(certificates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(certificates.id, id));
  }

  // ============= SURVEYS =============
  
  async getSurveys(): Promise<Survey[]> {
    const db = await getDb();
    return await db.select().from(surveys)
      .where(eq(surveys.isActive, true))
      .orderBy(asc(surveys.surveyName));
  }

  async getSurvey(id: string): Promise<Survey | undefined> {
    const db = await getDb();
    const result = await db.select().from(surveys)
      .where(eq(surveys.id, id))
      .limit(1);
    return result[0];
  }

  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    const db = await getDb();
    const result = await db.insert(surveys).values({
      ...survey,
      attachments: survey.attachments || [],
    }).returning();
    return result[0];
  }

  async updateSurvey(id: string, data: Partial<Survey>): Promise<Survey> {
    const db = await getDb();
    const { id: _, createdAt: __, ...updateData } = data as any;
    const result = await db.update(surveys)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(surveys.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Survey not found: ${id}`);
    }
    return result[0];
  }

  async deleteSurvey(id: string): Promise<void> {
    const db = await getDb();
    await db.update(surveys)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(surveys.id, id));
  }

  // ============= WORK ORDER EXECUTION DETAILS =============
  
  async getWorkOrderExecutionDetails(workOrderId: string): Promise<WorkOrderExecutionDetails[]> {
    const db = await getDb();
    return await db.select().from(workOrderExecutionDetails)
      .where(eq(workOrderExecutionDetails.workOrderId, workOrderId))
      .orderBy(desc(workOrderExecutionDetails.createdAt));
  }

  async getWorkOrderExecutionDetailById(id: number): Promise<WorkOrderExecutionDetails | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrderExecutionDetails)
      .where(eq(workOrderExecutionDetails.id, id))
      .limit(1);
    return result[0];
  }

  async createWorkOrderExecutionDetail(detail: InsertWorkOrderExecutionDetails): Promise<WorkOrderExecutionDetails> {
    const db = await getDb();
    const result = await db.insert(workOrderExecutionDetails).values(detail).returning();
    return result[0];
  }

  async updateWorkOrderExecutionDetail(id: number, data: Partial<WorkOrderExecutionDetails>): Promise<WorkOrderExecutionDetails> {
    const db = await getDb();
    const { id: _, createdAt: __, ...updateData } = data as any;
    const result = await db.update(workOrderExecutionDetails)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(workOrderExecutionDetails.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`WorkOrderExecutionDetail not found: ${id}`);
    }
    return result[0];
  }

  // ============= REMAINING FILE-BOUND METHODS =============
  
  async getRunningHourParents(vesselId: string): Promise<Array<Component & { childCount: number; latestUpdate?: string }>> {
    const db = await getDb();
    
    // Get parent components
    const parents = await db.select().from(components)
      .where(and(
        eq(components.vesselId, vesselId),
        eq(components.isParent, true),
        eq(components.isActive, true)
      ))
      .orderBy(asc(components.name));
    
    // Enhance with child counts
    const result: Array<Component & { childCount: number; latestUpdate?: string }> = [];
    
    for (const parent of parents) {
      const children = await db.select().from(components)
        .where(eq(components.parentId, parent.id));
      
      result.push({
        ...parent,
        childCount: children.length,
        latestUpdate: parent.lastUpdated || undefined,
      });
    }
    
    return result;
  }

  async cascadeRunningHoursUpdate(params: {
    parentComponentId: string;
    mode: 'setTotal' | 'addDelta';
    value: number;
    dateUpdated: string;
    comments?: string;
    meterReplaced?: boolean;
    oldMeterFinal?: string;
    newMeterStart?: string;
  }): Promise<{ updatedComponents: number; auditsCreated: number; workOrdersGenerated: number; workOrders: any[] }> {
    const db = await getDb();
    const { parentComponentId, mode, value, dateUpdated, comments } = params;
    const now = new Date();
    
    // Get all child components (by parentId - structural hierarchy)
    const children = await db.select().from(components)
      .where(eq(components.parentId, parentComponentId));
    
    // Update parent component
    const parentResult = await db.select().from(components)
      .where(eq(components.id, parentComponentId))
      .limit(1);
    
    let updatedComponents = 0;
    let auditsCreated = 0;
    let newRH = 0;
    
    if (parentResult.length > 0) {
      const parent = parentResult[0];
      const currentRH = parseFloat(parent.currentCumulativeRH || parent.rhCurrentMaster || '0');
      newRH = mode === 'addDelta' ? currentRH + value : value;
      
      // Build update object - always update currentCumulativeRH
      const updateData: any = { 
        currentCumulativeRH: newRH.toString(),
        lastUpdated: dateUpdated,
        updatedAt: now
      };
      
      // If this component is a MASTER type, also update rhCurrentMaster
      if (parent.rhCounterType === 'MASTER') {
        updateData.rhCurrentMaster = newRH.toString();
        updateData.rhMasterUpdatedAt = now;
        updateData.rhMasterUpdateSource = 'MANUAL';
      }
      
      await db.update(components)
        .set(updateData)
        .where(eq(components.id, parentComponentId));
      
      // Log audit for parent
      await db.insert(runningHoursAudit).values({
        vesselId: parent.vesselId || 'unknown',
        componentId: parentComponentId,
        previousRH: currentRH.toString(),
        newRH: newRH.toString(),
        cumulativeRH: newRH.toString(),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: now,
        userId: 'system',
        source: 'cascade',
        comments: comments,
      });
      
      updatedComponents++;
      auditsCreated++;
      
      // If parent is MASTER, also update all INHERITED components that reference this master IN THE SAME VESSEL
      // Match by BOTH component ID and component code (legacy data uses component code in rhMasterComponentId/rhCounterSource)
      // CRITICAL: Filter by vesselId to prevent cross-vessel RH aggregation
      if (parent.rhCounterType === 'MASTER') {
        const masterComponentCode = parent.componentCode || '';
        const masterVesselId = parent.vesselId;
        
        // CRITICAL SAFEGUARD: Skip cascade if vesselId cannot be determined
        if (!masterVesselId) {
          console.warn(`⚠️ [updateRunningHoursBulk] Cannot determine vesselId for master "${parentComponentId}" - skipping inherited cascade to prevent cross-vessel leak`);
        } else {
          // Cascade to inherited components in the same vessel only
          const inheritedComponents = await db.select().from(components)
            .where(and(
              eq(components.rhCounterType, 'INHERITED'),
              eq(components.vesselId, masterVesselId),
              or(
                eq(components.rhMasterComponentId, parentComponentId),
                eq(components.rhMasterComponentId, masterComponentCode),
                eq(components.rhCounterSource, masterComponentCode)
              )
            ));
        
          // Calculate the delta from master's change
          const delta = newRH - currentRH;
          
          for (const inherited of inheritedComponents) {
            // Get inherited component's current individual RH
            const inheritedCurrentRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
            // Apply delta to their individual running hours (they maintain their own offset)
            const newInheritedRH = inheritedCurrentRH + delta;
            
            await db.update(components)
              .set({
                rhCurrentInheritedCached: newRH.toString(), // Cache master's absolute value for reference
                rhInheritedUpdatedAt: now,
                currentCumulativeRH: newInheritedRH.toString(), // Their individual RH + delta
                lastUpdated: dateUpdated,
                updatedAt: now
              })
              .where(eq(components.id, inherited.id));
            
            // Log audit for inherited component
            await db.insert(runningHoursAudit).values({
              vesselId: inherited.vesselId || 'unknown',
              componentId: inherited.id,
              previousRH: inheritedCurrentRH.toString(),
              newRH: newInheritedRH.toString(),
              cumulativeRH: newInheritedRH.toString(),
              dateUpdatedLocal: dateUpdated,
              dateUpdatedTZ: 'UTC',
              enteredAtUTC: now,
              userId: 'system',
              source: 'inherited_cascade',
              comments: `Inherited delta ${delta} from MASTER ${parent.componentCode || parent.name}`,
            });
            
            updatedComponents++;
            auditsCreated++;
          }
        }
      }
    }
    
    // Calculate delta for structural children 
    const structuralDelta = mode === 'addDelta' ? value : (newRH - parseFloat(parentResult[0]?.currentCumulativeRH || '0'));
    
    // Update all structural children (by parentId hierarchy)
    for (const child of children) {
      const childCurrentRH = parseFloat(child.currentCumulativeRH || '0');
      const childNewRH = childCurrentRH + structuralDelta;
      
      const childUpdateData: any = { 
        currentCumulativeRH: childNewRH.toString(),
        lastUpdated: dateUpdated,
        updatedAt: now
      };
      
      // If child is also MASTER type, update its rhCurrentMaster too
      if (child.rhCounterType === 'MASTER') {
        childUpdateData.rhCurrentMaster = childNewRH.toString();
        childUpdateData.rhMasterUpdatedAt = now;
      }
      
      // If child is INHERITED and its master was updated, cache master's absolute value
      if (child.rhCounterType === 'INHERITED' && child.rhMasterComponentId === parentComponentId) {
        childUpdateData.rhCurrentInheritedCached = newRH.toString();
        childUpdateData.rhInheritedUpdatedAt = now;
      }
      
      await db.update(components)
        .set(childUpdateData)
        .where(eq(components.id, child.id));
      
      // Log audit for child
      await db.insert(runningHoursAudit).values({
        vesselId: child.vesselId || 'unknown',
        componentId: child.id,
        previousRH: childCurrentRH.toString(),
        newRH: childNewRH.toString(),
        cumulativeRH: childNewRH.toString(),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: now,
        userId: 'system',
        source: 'cascade',
        comments: comments,
      });
      
      updatedComponents++;
      auditsCreated++;
    }
    
    return { 
      updatedComponents, 
      auditsCreated,
      workOrdersGenerated: 0, 
      workOrders: [] 
    };
  }

  async bulkCreateComponents(componentsData: InsertComponent[]): Promise<Component[]> {
    if (componentsData.length === 0) return [];
    const db = await getDb();
    const result = await db.insert(components).values(componentsData).returning();
    return result;
  }

  async bulkUpdateComponents(updates: { id: string; data: Partial<Component> }[]): Promise<Component[]> {
    const db = await getDb();
    const results: Component[] = [];
    
    for (const update of updates) {
      const { id: _, ...updateData } = update.data as any;
      const result = await db.update(components)
        .set(updateData)
        .where(eq(components.id, update.id))
        .returning();
      if (result.length > 0) {
        results.push(result[0]);
      }
    }
    
    return results;
  }

  async bulkUpsertComponents(componentsData: InsertComponent[]): Promise<{ created: number; updated: number }> {
    const db = await getDb();
    let created = 0;
    let updated = 0;
    
    for (const comp of componentsData) {
      const existing = await db.select().from(components)
        .where(eq(components.id, comp.id))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(components)
          .set(comp)
          .where(eq(components.id, comp.id));
        updated++;
      } else {
        await db.insert(components).values(comp);
        created++;
      }
    }
    
    return { created, updated };
  }

  async archiveComponentsByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await getDb();
    const result = await db.update(components)
      .set({ isActive: false })
      .where(inArray(components.id, ids))
      .returning();
    return result.length;
  }

  async archiveSparesByIds(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await getDb();
    const result = await db.update(spares)
      .set({ isActive: false })
      .where(inArray(spares.id, ids))
      .returning();
    return result.length;
  }

  async getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, Component>> {
    if (codes.length === 0) return new Map();
    const db = await getDb();
    
    let results: Component[];
    if (vesselId) {
      results = await db.select().from(components)
        .where(and(
          inArray(components.componentCode, codes),
          eq(components.vesselId, vesselId)
        ));
    } else {
      results = await db.select().from(components)
        .where(inArray(components.componentCode, codes));
    }
    
    const resultMap = new Map<string, Component>();
    for (const comp of results) {
      if (comp.componentCode) {
        resultMap.set(comp.componentCode, comp);
      }
    }
    return resultMap;
  }

  async archiveComponent(id: string): Promise<Component> {
    const db = await getDb();
    const result = await db.update(components)
      .set({ isActive: false })
      .where(eq(components.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Component not found: ${id}`);
    }
    return result[0];
  }

  async archiveJob(id: string): Promise<Job> {
    const db = await getDb();
    const result = await db.update(jobs)
      .set({ isActive: false })
      .where(eq(jobs.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Job not found: ${id}`);
    }
    return result[0];
  }

  async archiveWorkOrder(id: string): Promise<WorkOrder> {
    const db = await getDb();
    const result = await db.update(workOrders)
      .set({ isActive: false })
      .where(eq(workOrders.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`WorkOrder not found: ${id}`);
    }
    return result[0];
  }

  async calculateAndUpdateRecurringDefects(vesselId: string): Promise<void> {
    // Recalculate recurring defects for a vessel
    const db = await getDb();
    const vesselDefects = await db.select().from(defects)
      .where(eq(defects.vesselId, vesselId));
    
    // Group defects by defect type/category to find recurrences
    const defectGroups = new Map<string, typeof vesselDefects>();
    
    for (const defect of vesselDefects) {
      const key = `${defect.vesselId}-${defect.defectCategory || 'uncategorized'}`;
      if (!defectGroups.has(key)) {
        defectGroups.set(key, []);
      }
      defectGroups.get(key)!.push(defect);
    }
    
    // Mark groups with 2+ defects as recurring
    for (const [key, group] of defectGroups) {
      if (group.length >= 2) {
        for (const defect of group) {
          await db.update(defects)
            .set({ isRecurring: true })
            .where(eq(defects.id, defect.id));
        }
      }
    }
  }

  async recalculateAllRecurringDefects(): Promise<void> {
    const db = await getDb();
    const allVessels = await db.select().from(vessels);
    
    for (const vessel of allVessels) {
      await this.calculateAndUpdateRecurringDefects(vessel.id);
    }
  }

  async purgeJobsAndLinkedData(vesselId: string): Promise<{ jobsDeleted: number; workOrdersDeleted: number }> {
    const db = await getDb();
    
    // Get all jobs for this vessel
    const vesselJobs = await db.select().from(jobs)
      .where(eq(jobs.vesselId, vesselId));
    
    const jobIds = vesselJobs.map(j => j.id);
    let workOrdersDeleted = 0;
    
    // Delete work orders linked to these jobs
    if (jobIds.length > 0) {
      const woResult = await db.delete(workOrders)
        .where(inArray(workOrders.jobId, jobIds))
        .returning();
      workOrdersDeleted = woResult.length;
    }
    
    // Delete the jobs
    const jobResult = await db.delete(jobs)
      .where(eq(jobs.vesselId, vesselId))
      .returning();
    
    return { jobsDeleted: jobResult.length, workOrdersDeleted };
  }

  async getVesselsByFleet(fleetId: string): Promise<Vessel[]> {
    const db = await getDb();
    return await db.select().from(vessels)
      .where(eq(vessels.fleetId, fleetId));
  }

  async getVesselsWithFleets(): Promise<Array<Vessel & { fleetName?: string; fleetCode?: string }>> {
    const db = await getDb();
    const allVessels = await db.select().from(vessels);
    const allFleets = await db.select().from(fleets);
    
    const fleetMap = new Map(allFleets.map(f => [f.id, f]));
    
    return allVessels.map(vessel => {
      const fleet = vessel.fleetId ? fleetMap.get(vessel.fleetId) : undefined;
      return {
        ...vessel,
        fleetName: fleet?.name,
        fleetCode: fleet?.code,
      };
    });
  }

  async getFleetAdminMetrics(): Promise<{
    totalMakers: number;
    totalModels: number;
    totalFleetComponents: number;
    totalMasterLists: number;
  }> {
    const db = await getDb();
    
    const makersResult = await db.select({ count: sql<number>`count(*)` }).from(makers);
    const masterListsResult = await db.select({ count: sql<number>`count(*)` }).from(masterLists);
    const fleetComponentsResult = await db.select({ count: sql<number>`count(*)` })
      .from(components)
      .where(eq(components.dataScope, 'fleet'));
    
    // Count unique models from components
    const modelsResult = await db.select({ count: sql<number>`count(distinct model)` })
      .from(components)
      .where(sql`model is not null`);
    
    return {
      totalMakers: Number(makersResult[0]?.count || 0),
      totalModels: Number(modelsResult[0]?.count || 0),
      totalFleetComponents: Number(fleetComponentsResult[0]?.count || 0),
      totalMasterLists: Number(masterListsResult[0]?.count || 0),
    };
  }

  // ============= FLEET VESSEL MAPPING (Rule #16) =============
  
  async createFleetVesselMappings(data: {
    fleetEntityType: 'component' | 'job' | 'spare';
    fleetEntityIds: string[];
    vesselId: string;
    vesselEntityId?: string;
    vesselEntityCode?: string;
    mappedBy: string;
  }): Promise<any[]> {
    const db = await getDb();
    const results: any[] = [];
    
    for (const fleetEntityId of data.fleetEntityIds) {
      const result = await db.insert(fleetVesselMapping).values({
        fleetEquipmentCode: fleetEntityId,
        vesselCode: data.vesselId,
        vesselComponentCode: data.vesselEntityCode,
        createdBy: data.mappedBy,
      }).returning();
      if (result.length > 0) results.push(result[0]);
    }
    
    return results;
  }

  async deleteFleetVesselMapping(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(fleetVesselMapping)
      .where(eq(fleetVesselMapping.id, parseInt(id)));
  }

  // ============= ON-DEMAND WORK ORDER GENERATION (Rule #4) =============
  
  async generateOnDemandWorkOrder(jobId: string, reason: 'Planning' | 'Breakdown' | 'Other', activeComponentCode?: string): Promise<WorkOrder> {
    const db = await getDb();
    
    // Get the job
    const jobResult = await db.select().from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    
    if (jobResult.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    const job = jobResult[0];
    const today = new Date();
    const year = today.getFullYear();
    
    // Generate work order number using the correct field name (workOrderNo matches schema)
    const existingWOs = await db.select().from(workOrders)
      .where(eq(workOrders.jobId, jobId));
    const woCount = existingWOs.length + 1;
    const workOrderNo = `${job.jobNo}.WO-${year}-${String(woCount).padStart(3, '0')}`;
    
    // FIX: Resolve component details from activeComponentCode if provided
    // This ensures WO is bound to the correct component context for multi-linked jobs
    let effectiveComponentCode = activeComponentCode || job.componentCode;
    let effectiveComponentName = job.componentName || '';
    
    // If activeComponentCode is provided, look up the correct component details
    // IMPORTANT: Scope by vesselId to avoid matching wrong component in multi-vessel setup
    if (activeComponentCode && job.vesselId) {
      const componentResult = await db.select().from(components)
        .where(and(
          eq(components.componentCode, activeComponentCode),
          eq(components.vesselId, job.vesselId)
        ))
        .limit(1);
      if (componentResult.length > 0) {
        effectiveComponentName = componentResult[0].name || effectiveComponentName;
      }
    } else if (activeComponentCode) {
      // Fallback without vessel scope if vesselId is not available
      const componentResult = await db.select().from(components)
        .where(eq(components.componentCode, activeComponentCode))
        .limit(1);
      if (componentResult.length > 0) {
        effectiveComponentName = componentResult[0].name || effectiveComponentName;
      }
    }
    
    // Create the work order
    const newWorkOrder: InsertWorkOrder = {
      id: `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vesselId: job.vesselId,
      vesselName: job.vesselName || '',
      workOrderNo,
      templateCode: workOrderNo,
      jobId: job.id,
      jobTitle: job.jobTitle,
      component: effectiveComponentName,
      componentCode: effectiveComponentCode,
      status: 'Active',
      dueDate: job.nextDueDate || new Date().toISOString().split('T')[0],
      remarks: `On-demand work order generated. Reason: ${reason}`,
      isActive: true,
      workOrderType: 'Planned',
      maintenanceBasis: job.maintenanceBasis,
      taskType: job.maintenanceType,
      assignedTo: job.assignedTo || 'Unassigned',
    };
    
    const result = await db.insert(workOrders).values(newWorkOrder).returning();
    return result[0];
  }

  // ============= POSTPONED WO REAPPEARANCE (Rule #5) =============
  
  async checkAndRevertPostponedWorkOrders(vesselId?: string): Promise<{
    revertedCount: number;
    revertedWorkOrders: WorkOrder[];
  }> {
    const db = await getDb();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Find postponed work orders past their postponed date
    let query = db.select().from(workOrders)
      .where(and(
        eq(workOrders.status, 'Postponed'),
        eq(workOrders.isActive, true)
      ));
    
    const postponedWOs = await query;
    const revertedWorkOrders: WorkOrder[] = [];
    
    for (const wo of postponedWOs) {
      // Check if vessel filter applies
      if (vesselId && wo.vesselId !== vesselId) continue;
      
      // Check if postponed date has passed
      if (wo.postponedDate && wo.postponedDate <= todayStr) {
        const result = await db.update(workOrders)
          .set({ 
            status: 'Pending',
            postponedDate: null,
            updatedAt: new Date()
          })
          .where(eq(workOrders.id, wo.id))
          .returning();
        
        if (result.length > 0) {
          revertedWorkOrders.push(result[0]);
        }
      }
    }
    
    return {
      revertedCount: revertedWorkOrders.length,
      revertedWorkOrders,
    };
  }

  // ============= COMPONENT VESSEL MAPPING =============
  
  async getComponentVesselMappings(): Promise<any[]> {
    const db = await getDb();
    return await db.select().from(fleetComponentMapping);
  }

  async createComponentVesselMapping(data: { 
    fleetEquipmentCode: string; 
    vesselCode: string; 
    vesselName: string; 
    componentCode?: string; 
    componentName?: string;
  }): Promise<any> {
    const db = await getDb();
    const result = await db.insert(fleetComponentMapping).values({
      fleetEquipmentCode: data.fleetEquipmentCode,
      vesselCode: data.vesselCode,
      vesselComponentCode: data.componentCode,
    }).returning();
    return result[0];
  }

  async deleteComponentVesselMapping(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(fleetComponentMapping)
      .where(eq(fleetComponentMapping.id, id));
  }

  // ============= PMS VESSEL SETTINGS =============
  
  async createOrUpdatePmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    const db = await getDb();
    
    // Check if settings exist for this vessel
    const existing = await db.select().from(pmsVesselSettings)
      .where(eq(pmsVesselSettings.vesselId, settings.vesselId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing
      const result = await db.update(pmsVesselSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(pmsVesselSettings.vesselId, settings.vesselId))
        .returning();
      return result[0];
    } else {
      // Create new
      const result = await db.insert(pmsVesselSettings).values(settings).returning();
      return result[0];
    }
  }

  // ============= FLEET MANAGEMENT =============
  
  async getAllFleets(): Promise<Fleet[]> {
    const db = await getDb();
    return await db.select().from(fleets)
      .orderBy(asc(fleets.name));
  }

  async getFleetById(id: string): Promise<Fleet | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleets)
      .where(eq(fleets.id, id))
      .limit(1);
    return result[0];
  }

  async assignVesselToFleet(vesselId: string, fleetId: string | null): Promise<Vessel> {
    const db = await getDb();
    const result = await db.update(vessels)
      .set({ fleetId: fleetId, updatedAt: new Date() })
      .where(eq(vessels.id, vesselId))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Vessel not found: ${vesselId}`);
    }
    return result[0];
  }

  // ============= INVENTORY MANAGEMENT: LOCATIONS =============

  async getLocations(vesselId: string): Promise<Location[]> {
    const db = await getDb();
    return await db.select().from(locations)
      .where(eq(locations.vesselId, vesselId))
      .orderBy(asc(locations.locationName));
  }

  async getLocationById(id: number): Promise<Location | undefined> {
    const db = await getDb();
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0];
  }

  async getLocationByName(vesselId: string, locationName: string): Promise<Location | undefined> {
    const db = await getDb();
    const normalizedName = locationName.trim().toUpperCase();
    const result = await db.select().from(locations)
      .where(and(
        eq(locations.vesselId, vesselId),
        sql`UPPER(TRIM(${locations.locationName})) = ${normalizedName}`
      ));
    return result[0];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const db = await getDb();
    const normalizedName = location.locationName.trim();
    const result = await db.insert(locations).values({
      ...location,
      locationName: normalizedName,
    }).returning();
    return result[0];
  }

  async findOrCreateLocation(vesselId: string, locationName: string, createdBy: string): Promise<Location> {
    const existing = await this.getLocationByName(vesselId, locationName);
    if (existing) {
      return existing;
    }
    return await this.createLocation({
      vesselId,
      locationName: locationName.trim(),
      createdBy,
    });
  }

  async updateLocation(id: number, data: Partial<Location>): Promise<Location> {
    const db = await getDb();
    const result = await db.update(locations)
      .set(data)
      .where(eq(locations.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Location ${id} not found`);
    }
    return result[0];
  }

  // ============= INVENTORY MANAGEMENT: SPARE-COMPONENT LINKS =============

  async getSpareComponentLinks(vesselId: string): Promise<SpareComponentLink[]> {
    const db = await getDb();
    return await db.select().from(spareComponentLinks)
      .where(eq(spareComponentLinks.vesselId, vesselId));
  }

  async getSpareComponentLinksBySpare(spareId: number): Promise<SpareComponentLink[]> {
    const db = await getDb();
    return await db.select().from(spareComponentLinks)
      .where(eq(spareComponentLinks.spareId, spareId));
  }

  async getSpareComponentLinksByComponent(componentId: string): Promise<SpareComponentLink[]> {
    const db = await getDb();
    return await db.select().from(spareComponentLinks)
      .where(eq(spareComponentLinks.componentId, componentId));
  }

  async createSpareComponentLink(link: InsertSpareComponentLink): Promise<SpareComponentLink> {
    const db = await getDb();
    const result = await db.insert(spareComponentLinks).values(link).returning();
    return result[0];
  }

  async deleteSpareComponentLink(spareId: number, componentId: string): Promise<void> {
    const db = await getDb();
    await db.delete(spareComponentLinks)
      .where(and(
        eq(spareComponentLinks.spareId, spareId),
        eq(spareComponentLinks.componentId, componentId)
      ));
  }

  async getLinkedComponentsForSpare(spareId: number): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>> {
    const db = await getDb();
    const links = await db.select({
      componentId: spareComponentLinks.componentId,
      componentCode: components.componentCode,
      componentName: components.name,
    })
    .from(spareComponentLinks)
    .innerJoin(components, eq(spareComponentLinks.componentId, components.id))
    .where(eq(spareComponentLinks.spareId, spareId));
    
    return links.map(l => ({
      componentId: l.componentId,
      componentCode: l.componentCode || '',
      componentName: l.componentName || '',
    }));
  }

  // ============= JOB-COMPONENT LINKS (Many-to-Many for Shared Jobs) =============

  async getJobComponentLinks(vesselId: string): Promise<JobComponentLink[]> {
    const db = await getDb();
    return await db.select().from(jobComponentLinks)
      .where(eq(jobComponentLinks.vesselId, vesselId));
  }

  async getJobComponentLinksByJob(jobId: string): Promise<JobComponentLink[]> {
    const db = await getDb();
    return await db.select().from(jobComponentLinks)
      .where(eq(jobComponentLinks.jobId, jobId));
  }

  async getJobComponentLinksByComponent(componentId: string): Promise<JobComponentLink[]> {
    const db = await getDb();
    return await db.select().from(jobComponentLinks)
      .where(eq(jobComponentLinks.componentId, componentId));
  }

  async createJobComponentLink(link: InsertJobComponentLink): Promise<JobComponentLink> {
    const db = await getDb();
    const result = await db.insert(jobComponentLinks).values(link).returning();
    return result[0];
  }

  async deleteJobComponentLink(jobId: string, componentId: string): Promise<void> {
    const db = await getDb();
    await db.delete(jobComponentLinks)
      .where(and(
        eq(jobComponentLinks.jobId, jobId),
        eq(jobComponentLinks.componentId, componentId)
      ));
  }

  async getLinkedComponentsForJob(jobId: string): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>> {
    const db = await getDb();
    const links = await db.select({
      componentId: jobComponentLinks.componentId,
      componentCode: components.componentCode,
      componentName: components.name,
    })
    .from(jobComponentLinks)
    .innerJoin(components, eq(jobComponentLinks.componentId, components.id))
    .where(eq(jobComponentLinks.jobId, jobId));
    
    return links.map(l => ({
      componentId: l.componentId,
      componentCode: l.componentCode || '',
      componentName: l.componentName || '',
    }));
  }

  async getLinkedJobsForComponent(componentId: string): Promise<Array<{ jobId: string; jobNo: string; jobTitle: string }>> {
    const db = await getDb();
    const links = await db.select({
      jobId: jobComponentLinks.jobId,
      jobNo: jobs.jobNo,
      jobTitle: jobs.jobTitle,
    })
    .from(jobComponentLinks)
    .innerJoin(jobs, eq(jobComponentLinks.jobId, jobs.id))
    .where(eq(jobComponentLinks.componentId, componentId));
    
    return links.map(l => ({
      jobId: l.jobId,
      jobNo: l.jobNo || '',
      jobTitle: l.jobTitle || '',
    }));
  }

  // ============= INVENTORY MANAGEMENT: SPARE LOCATION STOCK =============

  async getSpareLocationStock(spareId: number): Promise<SpareLocationStock[]> {
    const db = await getDb();
    return await db.select().from(spareLocationStock)
      .where(eq(spareLocationStock.spareId, spareId));
  }

  async getSpareLocationStockByLocation(locationId: number): Promise<SpareLocationStock[]> {
    const db = await getDb();
    return await db.select().from(spareLocationStock)
      .where(eq(spareLocationStock.locationId, locationId));
  }

  async getSpareLocationStockItem(spareId: number, locationId: number): Promise<SpareLocationStock | undefined> {
    const db = await getDb();
    const result = await db.select().from(spareLocationStock)
      .where(and(
        eq(spareLocationStock.spareId, spareId),
        eq(spareLocationStock.locationId, locationId)
      ));
    return result[0];
  }

  async upsertSpareLocationStock(data: InsertSpareLocationStock): Promise<SpareLocationStock> {
    const db = await getDb();
    const existing = await this.getSpareLocationStockItem(data.spareId, data.locationId);
    
    if (existing) {
      const result = await db.update(spareLocationStock)
        .set({ qty: data.qty })
        .where(eq(spareLocationStock.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(spareLocationStock).values(data).returning();
      return result[0];
    }
  }

  async updateSpareLocationStockQty(spareId: number, locationId: number, qtyChange: number): Promise<SpareLocationStock> {
    const db = await getDb();
    const existing = await this.getSpareLocationStockItem(spareId, locationId);
    
    if (!existing) {
      throw new Error(`No stock record found for spare ${spareId} at location ${locationId}`);
    }
    
    const newQty = existing.qty + qtyChange;
    if (newQty < 0) {
      throw new Error(`Cannot reduce stock below zero. Current: ${existing.qty}, Requested change: ${qtyChange}`);
    }
    
    const result = await db.update(spareLocationStock)
      .set({ qty: newQty })
      .where(eq(spareLocationStock.id, existing.id))
      .returning();
    return result[0];
  }

  async getSpareRobTotal(spareId: number): Promise<number> {
    const stockRecords = await this.getSpareLocationStock(spareId);
    return stockRecords.reduce((sum, s) => sum + s.qty, 0);
  }

  async getSpareLocationsWithQty(spareId: number): Promise<Array<{ locationId: number; locationName: string; qty: number }>> {
    const db = await getDb();
    const result = await db.select({
      locationId: spareLocationStock.locationId,
      locationName: locations.locationName,
      qty: spareLocationStock.qty,
    })
    .from(spareLocationStock)
    .innerJoin(locations, eq(spareLocationStock.locationId, locations.id))
    .where(eq(spareLocationStock.spareId, spareId));
    
    return result;
  }

  async getSparesAtLocation(locationId: number): Promise<Array<{ spareId: number; partCode: string; partName: string; qty: number }>> {
    const db = await getDb();
    const result = await db.select({
      spareId: spareLocationStock.spareId,
      partCode: spares.partCode,
      partName: spares.partName,
      qty: spareLocationStock.qty,
    })
    .from(spareLocationStock)
    .innerJoin(spares, eq(spareLocationStock.spareId, spares.id))
    .where(eq(spareLocationStock.locationId, locationId));
    
    return result;
  }

  // ============= INVENTORY MANAGEMENT: TRANSACTIONS =============

  async createInventoryTransaction(txn: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const db = await getDb();
    const result = await db.insert(inventoryTransactions).values(txn).returning();
    return result[0];
  }

  async getInventoryTransactions(vesselId: string, options?: {
    spareId?: number;
    locationId?: number;
    eventType?: InventoryEventType;
    limit?: number;
  }): Promise<InventoryTransaction[]> {
    const db = await getDb();
    
    const conditions = [eq(inventoryTransactions.vesselId, vesselId)];
    
    if (options?.spareId) {
      conditions.push(eq(inventoryTransactions.spareId, options.spareId));
    }
    if (options?.locationId) {
      conditions.push(eq(inventoryTransactions.locationId, options.locationId));
    }
    if (options?.eventType) {
      conditions.push(eq(inventoryTransactions.eventType, options.eventType));
    }
    
    let query = db.select().from(inventoryTransactions)
      .where(and(...conditions))
      .orderBy(desc(inventoryTransactions.txnDatetime));
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    
    return await query;
  }

  async performInventoryTransaction(input: {
    vesselId: string;
    spareId: number;
    locationId: number;
    eventType: InventoryEventType;
    qtyChange: number;
    referenceType: InventoryReferenceType;
    referenceId?: string;
    referenceNote?: string;
    userId: string;
  }): Promise<{ transaction: InventoryTransaction; newLocationQty: number; newTotalRob: number }> {
    const db = await getDb();
    
    // Validate reference requirements based on event type
    // CONSUME events MUST have WORK_ORDER reference type for full traceability
    if (input.eventType === 'CONSUME') {
      if (input.referenceType !== 'WORK_ORDER') {
        throw new Error('CONSUME events require referenceType WORK_ORDER for traceability');
      }
      if (!input.referenceId) {
        throw new Error('CONSUME events require a valid work order reference ID');
      }
    }
    
    // Validate location exists
    const location = await this.getLocationById(input.locationId);
    if (!location) {
      throw new Error(`Location ${input.locationId} not found`);
    }
    
    // Get current stock levels
    const currentLocationStock = await this.getSpareLocationStockItem(input.spareId, input.locationId);
    const currentLocationQty = currentLocationStock?.qty ?? 0;
    const currentTotalRob = await this.getSpareRobTotal(input.spareId);
    
    // Calculate new values
    const newLocationQty = currentLocationQty + input.qtyChange;
    const newTotalRob = currentTotalRob + input.qtyChange;
    
    // CRITICAL: Enforce no negative stock at any level
    if (newLocationQty < 0) {
      throw new Error(`NEGATIVE_STOCK_PREVENTED: Cannot consume ${Math.abs(input.qtyChange)} from location. Current stock: ${currentLocationQty}`);
    }
    
    if (newTotalRob < 0) {
      throw new Error(`NEGATIVE_STOCK_PREVENTED: Transaction would result in negative total ROB. Current total: ${currentTotalRob}, Change: ${input.qtyChange}`);
    }
    
    // Additional validation for CONSUME: ensure consume qty doesn't exceed location stock
    if (input.eventType === 'CONSUME') {
      const consumeQty = Math.abs(input.qtyChange);
      if (currentLocationQty < consumeQty) {
        throw new Error(`INSUFFICIENT_STOCK: Available at location: ${currentLocationQty}, Requested: ${consumeQty}`);
      }
    }
    
    // Get spare info for updating legacy ROB fields
    const spare = await this.getSpare(input.spareId);
    if (!spare) {
      throw new Error(`Spare ${input.spareId} not found`);
    }
    
    // Upsert location stock
    await this.upsertSpareLocationStock({
      vesselId: input.vesselId,
      spareId: input.spareId,
      locationId: input.locationId,
      qty: newLocationQty,
    });
    
    // Create transaction record
    const transaction = await this.createInventoryTransaction({
      vesselId: input.vesselId,
      spareId: input.spareId,
      locationId: input.locationId,
      eventType: input.eventType,
      qtyChange: input.qtyChange,
      robTotalBefore: currentTotalRob,
      robTotalAfter: newTotalRob,
      robLocationBefore: currentLocationQty,
      robLocationAfter: newLocationQty,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceNote: input.referenceNote,
      userId: input.userId,
    });
    
    // Update legacy ROB field on spare table for backwards compatibility
    await db.update(spares)
      .set({ rob: newTotalRob, updatedAt: new Date(), updatedBy: input.userId })
      .where(eq(spares.id, input.spareId));
    
    return {
      transaction,
      newLocationQty,
      newTotalRob,
    };
  }

  async getSpareWithInventory(spareId: number): Promise<SpareWithInventory | null> {
    const spare = await this.getSpare(spareId);
    if (!spare) return null;
    
    const robTotal = await this.getSpareRobTotal(spareId);
    const locationsWithQty = await this.getSpareLocationsWithQty(spareId);
    const linkedComponents = await this.getLinkedComponentsForSpare(spareId);
    
    const stockStatus: "OK" | "At Min" = robTotal <= (spare.min ?? 0) ? "At Min" : "OK";
    
    return {
      spare,
      robTotal,
      stockStatus,
      locations: locationsWithQty,
      linkedComponents,
    };
  }

  async getSparesWithInventoryByVessel(vesselId: string): Promise<SpareWithInventory[]> {
    const sparesInVessel = await this.getSpares(vesselId);
    const results: SpareWithInventory[] = [];
    
    for (const spare of sparesInVessel) {
      const withInventory = await this.getSpareWithInventory(spare.id);
      if (withInventory) {
        results.push(withInventory);
      }
    }
    
    return results;
  }

  async getSparesWithInventoryByComponent(componentId: string): Promise<SpareWithInventory[]> {
    const db = await getDb();
    
    // MANY-TO-MANY SUPPORT: Get spares directly assigned to component
    // AND spares linked via spare_component_links table
    const directSpares = await db.select().from(spares)
      .where(eq(spares.componentId, componentId));
    
    // Get spares linked via spare_component_links
    const links = await this.getSpareComponentLinksByComponent(componentId);
    
    // Combine and deduplicate by spare ID
    const spareIdSet = new Set<number>();
    const results: SpareWithInventory[] = [];
    
    // Add direct spares first
    for (const spare of directSpares) {
      if (!spareIdSet.has(spare.id)) {
        spareIdSet.add(spare.id);
        const withInventory = await this.getSpareWithInventory(spare.id);
        if (withInventory) {
          results.push(withInventory);
        }
      }
    }
    
    // Add linked spares (deduplicated)
    for (const link of links) {
      if (!spareIdSet.has(link.spareId)) {
        spareIdSet.add(link.spareId);
        const withInventory = await this.getSpareWithInventory(link.spareId);
        if (withInventory) {
          results.push(withInventory);
        }
      }
    }
    
    return results;
  }

  async getSpareInventoryByPartNumbers(vesselId: string, partNumbers: string[]): Promise<Map<string, { rob: number; robLocationA: number; robLocationB: number }>> {
    const db = await getDb();
    const result = new Map<string, { rob: number; robLocationA: number; robLocationB: number }>();
    
    if (!partNumbers || partNumbers.length === 0) {
      return result;
    }
    
    const matchingSpares = await db.select({
      partNumber: spares.partNumber,
      rob: spares.rob,
      robLocationA: spares.robLocationA,
      robLocationB: spares.robLocationB
    })
    .from(spares)
    .where(
      and(
        eq(spares.vesselId, vesselId),
        inArray(spares.partNumber, partNumbers)
      )
    );
    
    for (const spare of matchingSpares) {
      if (spare.partNumber) {
        result.set(spare.partNumber, {
          rob: spare.rob,
          robLocationA: spare.robLocationA,
          robLocationB: spare.robLocationB
        });
      }
    }
    
    return result;
  }
}

export const postgresStorage = new PostgresStorage();
