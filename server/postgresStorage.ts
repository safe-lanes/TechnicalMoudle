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

  async inactivateComponent(id: string): Promise<Component> {
    return this.updateComponent(id, { isActive: false });
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

  async getComponentMaintenanceHistoryItem(id: number): Promise<ComponentMaintenanceHistory | undefined> {
    const db = await getDb();
    const result = await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.id, id));
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
      return await db.select().from(jobs)
        .where(and(
          eq(jobs.vesselId, vesselId),
          eq(jobs.componentId, componentId),
          eq(jobs.dataScope, 'vessel')
        ))
        .orderBy(asc(jobs.jobNo));
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
    const result = await db.update(workOrders)
      .set({ ...data, updatedAt: new Date() })
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

  async bulkUpdateWorkOrders(updates: Array<{ workOrderNo: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    const db = await getDb();
    const results: WorkOrder[] = [];
    
    for (const { workOrderNo, data } of updates) {
      const result = await db.update(workOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(workOrders.workOrderNo, workOrderNo))
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

  async getWorkOrdersByTemplateIds(templateIds: string[]): Promise<WorkOrder[]> {
    if (templateIds.length === 0) return [];
    const db = await getDb();
    return await db.select().from(workOrders)
      .where(inArray(workOrders.templateId, templateIds));
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
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<Spare> {
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
      newRobA = Math.max(0, currentRobA - quantity);
    } else {
      newRobB = Math.max(0, currentRobB - quantity);
    }
    
    const newRob = Math.max(0, currentRob - quantity);
    
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
      qtyChange: -quantity,
      robAfter: newRob,
      userId,
      remarks: remarks ? `${remarks} (Location ${location})` : `Location ${location}`,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });
    
    return updated[0];
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
    id: number,
    newRob: number,
    newRobA: number,
    newRobB: number,
    userId: string,
    remarks?: string
  ): Promise<Spare> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const qtyChange = newRob - (spare.rob ?? 0);
    
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
      eventType: 'ADJUST',
      qtyChange,
      robAfter: newRob,
      userId,
      remarks: remarks ?? null,
      reference: null,
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
}

export const postgresStorage = new PostgresStorage();
