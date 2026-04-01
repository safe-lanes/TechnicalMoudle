import { randomUUID } from 'crypto';
import { eq, and, desc, sql, inArray, or, ilike, asc, gte, lte, lt, gt } from 'drizzle-orm';
import { getDb } from './db';
import {
  users,
  fleets,
  fleetClasses,
  vessels,
  pmsVesselSettings,
  companyStandardGraceSettings,
  makers,
  masterLists,
  makerList,
  fleetComponents,
  fleetJobs,
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
  type FleetClass,
  type InsertFleetClass,
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
  type FleetComponents,
  type InsertFleetComponents,
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
  workOrderPostponements,
  type WorkOrderPostponement,
  type InsertWorkOrderPostponement,
  fleetSpares,
  type FleetSpares,
  type InsertFleetSpares,
  superintendentNotifications,
  type SuperintendentNotification,
  type InsertSuperintendentNotification,
  workOrderAnomalies,
  type WorkOrderAnomaly,
  type InsertWorkOrderAnomaly,
  admnRoleMaster,
  admMenumasterAc,
  admRoleMenuAccess,
  type AdmnRoleMaster,
  type AdmMenumasterAc,
  type AdmRoleMenuAccess,
} from '@shared/schema';

/**
 * PostgreSQL Storage Implementation
 * Module 1: Core Reference Data (users, fleets, vessels, pms_vessel_settings)
 * 
 * This file implements IStorage methods using PostgreSQL via Drizzle ORM.
 * Additional modules will be added incrementally.
 */
export class PostgresStorage {

  private async insertWithSequenceRepair<T>(
    tableName: string,
    insertFn: () => Promise<T>
  ): Promise<T> {
    try {
      return await insertFn();
    } catch (error: any) {
      const isPkeyViolation =
        error?.code === '23505' &&
        error?.constraint?.endsWith('_pkey');
      if (!isPkeyViolation) throw error;

      console.warn(
        `[SequenceRepair] Primary key collision on "${tableName}" — resetting sequence`
      );
      const db = await getDb();
      await db.execute(
        sql.raw(
          `SELECT setval('${tableName}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM "${tableName}"))`
        )
      );
      return await insertFn();
    }
  }

  private async insertStoresLedgerEntry(values: InsertStoresLedger): Promise<void> {
    await this.insertWithSequenceRepair('stores_ledger', async () => {
      const db = await getDb();
      await db.insert(storesLedger).values(values);
      return undefined;
    });
  }

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

  // ============= FLEET CLASSES (Module 1) =============

  async getFleetClasses(fleetId: string): Promise<FleetClass[]> {
    const db = await getDb();
    return await db.select().from(fleetClasses)
      .where(and(eq(fleetClasses.fleetId, fleetId), eq(fleetClasses.isDeleted, false)));
  }

  async createFleetClass(data: InsertFleetClass): Promise<FleetClass> {
    const db = await getDb();
    const result = await db.insert(fleetClasses).values(data).returning();
    return result[0];
  }

  async updateFleetClass(fcuuid: string, data: Partial<FleetClass>): Promise<FleetClass> {
    const db = await getDb();
    const result = await db.update(fleetClasses)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(fleetClasses.fcuuid, fcuuid), eq(fleetClasses.isDeleted, false)))
      .returning();
    if (!result[0]) {
      throw new Error(`Fleet class ${fcuuid} not found`);
    }
    return result[0];
  }

  async deleteFleetClass(fcuuid: string): Promise<void> {
    const db = await getDb();
    const existing = await db.select().from(fleetClasses)
      .where(and(eq(fleetClasses.fcuuid, fcuuid), eq(fleetClasses.isDeleted, false)));
    if (!existing[0]) {
      throw new Error(`Fleet class ${fcuuid} not found`);
    }
    await db.update(fleetClasses)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(fleetClasses.fcuuid, fcuuid));
    await db.update(vessels)
      .set({ classId: null, updatedAt: new Date() })
      .where(eq(vessels.classId, fcuuid));
  }

  async assignVesselToClass(vesselId: string, classId: string | null): Promise<Vessel> {
    const db = await getDb();
    const vesselResult = await db.select().from(vessels).where(eq(vessels.vuuid, vesselId));
    if (!vesselResult[0]) {
      throw new Error(`Vessel ${vesselId} not found`);
    }
    const vessel = vesselResult[0];

    if (classId) {
      const classResult = await db.select().from(fleetClasses)
        .where(and(eq(fleetClasses.fcuuid, classId), eq(fleetClasses.isDeleted, false)));
      if (!classResult[0]) {
        throw new Error(`Fleet class ${classId} not found`);
      }
      const fc = classResult[0];
      const fleetResult = await db.select().from(fleets).where(eq(fleets.fuuid, fc.fleetId));
      if (!fleetResult[0] || fleetResult[0].id !== vessel.fleetId) {
        throw new Error(`Class does not belong to the vessel's fleet`);
      }
    }

    const result = await db.update(vessels)
      .set({ classId, updatedAt: new Date() })
      .where(eq(vessels.vuuid, vesselId))
      .returning();
    return result[0];
  }

  // ============= VESSELS (Module 1) =============

  async getVessels(): Promise<Array<{id: string, vuuid: string, name: string, code: string}>> {
    const db = await getDb();
    const result = await db.select().from(vessels);
    return result.map(v => ({
      id: v.id,
      vuuid: v.vuuid,
      name: v.name,
      code: v.code
    }));
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.vuuid, id));
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
    return result[0]?.vuuid;
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
      .where(eq(vessels.vuuid, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Vessel ${id} not found`);
    }
    return result[0];
  }

  async deleteVessel(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(vessels).where(eq(vessels.vuuid, id));
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

  // ============= MODULE 2: MAKERS (using maker_list table) =============

  async getMakers(search?: string): Promise<MakerList[]> {
    const db = await getDb();
    if (search) {
      const searchPattern = `%${search}%`;
      const result = await db.select().from(makerList)
        .where(or(
          ilike(makerList.makerName, searchPattern),
          ilike(makerList.makerCode, searchPattern)
        ))
        .orderBy(asc(makerList.makerName));
      return result;
    }
    return await db.select().from(makerList).orderBy(asc(makerList.makerName));
  }

  async getMakerById(id: number): Promise<MakerList | undefined> {
    const db = await getDb();
    const result = await db.select().from(makerList).where(eq(makerList.id, id));
    return result[0];
  }

  async createMaker(maker: InsertMakerList): Promise<MakerList> {
    const db = await getDb();
    // Generate makerCode if not provided
    let makerCode = maker.makerCode;
    if (!makerCode) {
      const allMakers = await db.select({ id: makerList.id }).from(makerList);
      const nextId = allMakers.length > 0 ? Math.max(...allMakers.map(m => m.id)) + 1 : 1;
      makerCode = `MKR-${String(nextId).padStart(6, '0')}`;
    }
    const result = await db.insert(makerList).values({
      ...maker,
      makerCode,
    }).returning();
    return result[0];
  }

  async updateMaker(id: number, data: Partial<InsertMakerList>): Promise<MakerList> {
    const db = await getDb();
    const result = await db.update(makerList)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(makerList.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Maker with id ${id} not found`);
    }
    return result[0];
  }

  async deleteMaker(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(makerList).where(eq(makerList.id, id));
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

  // ============= MODULE 2A: FLEET COMPONENTS =============

  async getFleetComponents(): Promise<FleetComponents[]> {
    const db = await getDb();
    return await db.select().from(fleetComponents)
      .where(and(eq(fleetComponents.isActive, true), eq(fleetComponents.isDeleted, false)));
  }

  async getFleetComponent(id: number): Promise<FleetComponents | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleetComponents).where(eq(fleetComponents.id, id));
    return result[0];
  }

  async getFleetComponentByCode(fleetEquipmentCode: string): Promise<FleetComponents | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleetComponents)
      .where(eq(fleetComponents.fleetEquipmentCode, fleetEquipmentCode));
    return result[0];
  }

  async createFleetComponent(data: InsertFleetComponents): Promise<FleetComponents> {
    const db = await getDb();
    const result = await db.insert(fleetComponents).values({
      parentFleetEquipmentCode: data.parentFleetEquipmentCode || null,
      fleetEquipmentCode: data.fleetEquipmentCode,
      fleetEquipmentName: data.fleetEquipmentName,
      componentCategory: data.componentCategory || null,
      makerName: data.makerName || null,
      makerCode: data.makerCode || null,
      model: data.model || null,
      modelCode: data.modelCode || null,
      location: data.location || null,
      rating: data.rating || null,
      eqptSystemDept: data.eqptSystemDept || null,
      notes: data.notes || null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder || 0,
      createdByUuid: data.createdByUuid || null,
      updatedByUuid: data.updatedByUuid || null,
      isDeleted: data.isDeleted || false,
      isSync: data.isSync || false,
    }).returning();
    return result[0];
  }

  async updateFleetComponent(id: number, data: Partial<FleetComponents>): Promise<FleetComponents> {
    const db = await getDb();
    const result = await db.update(fleetComponents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fleetComponents.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Fleet component with id ${id} not found`);
    }
    return result[0];
  }

  async deleteFleetComponent(id: number): Promise<void> {
    const db = await getDb();
    await db.update(fleetComponents)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(fleetComponents.id, id));
  }

  // ============= FLEET JOBS =============

  async getFleetJobs(): Promise<any[]> {
    const db = await getDb();
    return await db.select().from(fleetJobs)
      .where(and(eq(fleetJobs.isActive, true), eq(fleetJobs.isDeleted, false)));
  }

  async getFleetJob(id: number): Promise<any | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleetJobs).where(eq(fleetJobs.id, id));
    return result[0];
  }

  async getFleetJobByCode(jobCode: string): Promise<any | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleetJobs)
      .where(eq(fleetJobs.jobCode, jobCode));
    return result[0];
  }

  async createFleetJob(data: any): Promise<any> {
    const db = await getDb();
    const result = await db.insert(fleetJobs).values({
      jobCode: data.jobCode,
      fleetComponentsUuid: data.fleetComponentsUuid || null,
      fleetEquipmentCode: data.fleetEquipmentCode,
      fleetEquipmentName: data.fleetEquipmentName,
      woTitle: data.woTitle,
      maintenanceBasis: data.maintenanceBasis || null,
      intervalValue: data.intervalValue || null,
      unit: data.unit || null,
      taskType: data.taskType,
      assignedTo: data.assignedTo,
      approver: data.approver,
      jobPriority: data.jobPriority,
      classRelated: data.classRelated,
      briefWorkDescription: data.briefWorkDescription,
      department: data.department,
      criticality: data.criticality,
      isActive: data.isActive ?? true,
      requiredSpareParts: data.requiredSpareParts || [],
      requiredTools: data.requiredTools || [],
      ppeRequirements: data.ppeRequirements || null,
      permitRequirements: data.permitRequirements || null,
      otherSafetyRequirements: data.otherSafetyRequirements || null,
      sortOrder: data.sortOrder || 0,
      createdByUuid: data.createdByUuid || null,
      updatedByUuid: data.updatedByUuid || null,
      isDeleted: data.isDeleted || false,
      isSync: data.isSync || false,
    }).returning();
    return result[0];
  }

  async updateFleetJob(id: number, data: Partial<any>): Promise<{ updatedJob: any; affectedCount: number }> {
    const db = await getDb();

    const GLOBAL_FIELDS = [
      'woTitle', 'maintenanceBasis', 'intervalValue', 'unit',
      'taskType', 'assignedTo', 'approver', 'jobPriority',
      'classRelated', 'briefWorkDescription', 'department',
      'criticality', 'isActive',
      'ppeRequirements', 'permitRequirements', 'otherSafetyRequirements',
      'requiredSpareParts', 'requiredTools',
    ];

    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(fleetJobs).where(eq(fleetJobs.id, id));
      if (!existing) {
        throw new Error(`Fleet job with id ${id} not found`);
      }

      const jobCode = existing.jobCode;

      const globalUpdate: Record<string, any> = { updatedAt: new Date() };
      for (const field of GLOBAL_FIELDS) {
        if (field in data) {
          globalUpdate[field] = (data as any)[field];
        }
      }

      const results = await tx.update(fleetJobs)
        .set(globalUpdate)
        .where(eq(fleetJobs.jobCode, jobCode))
        .returning();

      const updatedJob = results.find(r => r.id === id) || results[0];

      return { updatedJob, affectedCount: results.length };
    });
  }

  async deleteFleetJob(id: number): Promise<void> {
    const db = await getDb();
    await db.update(fleetJobs)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(fleetJobs.id, id));
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
    const result = await db.select().from(components).where(
      or(eq(components.cuuid, id), eq(components.id, id))
    );
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
      cuuid: randomUUID(),
      dataScope: component.dataScope || 'vessel',
    }).returning();
    return result[0];
  }

  async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
    const db = await getDb();
    const result = await db.update(components)
      .set({ ...data, updatedAt: new Date() })
      .where(or(eq(components.cuuid, id), eq(components.id, id)))
      .returning();
    if (!result[0]) {
      throw new Error(`Component ${id} not found`);
    }
    return result[0];
  }

  async deleteComponent(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(components).where(or(eq(components.cuuid, id), eq(components.id, id)));
  }

  async inactivateComponent(id: string, vesselId: string, userId?: string): Promise<{
    success: boolean;
    message: string;
    code?: string;
    componentsInactivated: number;
    activeChildrenCount?: number;
    activeJobsCount?: number;
    linkedSparesCount?: number;
    activeWorkOrdersCount?: number;
  }> {
    const db = await getDb();
    
    const componentResult = await db.select().from(components)
      .where(and(
        or(eq(components.cuuid, id), eq(components.id, id)),
        eq(components.vesselId, vesselId)
      ))
      .limit(1);
    
    if (componentResult.length === 0) {
      return {
        success: false,
        message: `Component not found: ${id}`,
        componentsInactivated: 0,
      };
    }
    
    const component = componentResult[0];
    
    const activeChildren = await db.select().from(components)
      .where(and(
        or(eq(components.parentId, component.cuuid), eq(components.parentId, component.id)),
        eq(components.isActive, true),
        eq(components.vesselId, vesselId)
      ));
    
    if (activeChildren.length > 0) {
      return {
        success: false,
        message: `Component has ${activeChildren.length} active child component(s). Please deactivate the child components first.`,
        code: 'ACTIVE_CHILDREN',
        componentsInactivated: 0,
        activeChildrenCount: activeChildren.length,
      };
    }
    
    const activeJobIds = new Set<string>();
    const componentCode = component.componentCode;
    const directJobs = await db.select().from(jobs)
      .where(and(
        or(
          eq(jobs.componentId, component.cuuid),
          eq(jobs.componentId, component.id),
          ...(componentCode ? [eq(jobs.componentCode, componentCode)] : [])
        ),
        eq(jobs.isActive, true),
        eq(jobs.vesselId, vesselId)
      ));
    for (const job of directJobs) {
      activeJobIds.add(job.juuid);
    }
    const linkedJobsByCuuid = await this.getJobComponentLinksByComponent(component.cuuid);
    const linkedJobsById = component.id !== component.cuuid ? await this.getJobComponentLinksByComponent(component.id) : [];
    const linkedJobsMap = new Map<string, typeof linkedJobsByCuuid[0]>();
    for (const link of [...linkedJobsByCuuid, ...linkedJobsById]) {
      linkedJobsMap.set(link.jobId, link);
    }
    const linkedJobs = Array.from(linkedJobsMap.values());
    for (const link of linkedJobs) {
      const jobResult = await db.select().from(jobs)
        .where(and(eq(jobs.juuid, link.jobId), eq(jobs.isActive, true), eq(jobs.vesselId, vesselId)))
        .limit(1);
      if (jobResult.length > 0) {
        activeJobIds.add(link.jobId);
      }
    }
    
    if (activeJobIds.size > 0) {
      return {
        success: false,
        message: `Component cannot be deleted because ${activeJobIds.size} active Job(s) are linked. Please deactivate or delete the linked Jobs before deleting the component.`,
        code: 'ACTIVE_JOBS',
        componentsInactivated: 0,
        activeJobsCount: activeJobIds.size,
      };
    }
    
    const activeSpareIds = new Set<number>();
    
    const directSpares = await db.select({ id: spares.id }).from(spares)
      .where(and(
        or(
          eq(spares.componentId, component.cuuid),
          ...(componentCode ? [eq(spares.componentCode, componentCode)] : [])
        ),
        eq(spares.isActive, true),
        eq(spares.vesselId, vesselId)
      ));
    for (const s of directSpares) {
      activeSpareIds.add(s.id);
    }
    
    const linkedActiveSpares = await db.select({ id: spares.id }).from(spareComponentLinks)
      .innerJoin(spares, and(
        or(
          eq(spares.suuid, spareComponentLinks.spareUuid),
          eq(spares.id, spareComponentLinks.spareId)
        ),
        eq(spares.isActive, true),
        eq(spares.vesselId, vesselId)
      ))
      .where(or(
        eq(spareComponentLinks.componentId, component.cuuid),
        ...(component.id !== component.cuuid ? [eq(spareComponentLinks.componentId, component.id)] : [])
      ));
    for (const row of linkedActiveSpares) {
      activeSpareIds.add(row.id);
    }
    
    if (activeSpareIds.size > 0) {
      return {
        success: false,
        message: `Component cannot be deleted because ${activeSpareIds.size} active Spare(s) are linked. Please deactivate or delete the linked Spares before deleting the component.`,
        code: 'ACTIVE_SPARES',
        componentsInactivated: 0,
        linkedSparesCount: activeSpareIds.size,
      };
    }
    
    let activeWorkOrdersCount = 0;
    if (componentCode) {
      const woResults = await db.select().from(workOrders)
        .where(and(
          eq(workOrders.componentCode, componentCode),
          eq(workOrders.vesselId, vesselId)
        ));
      const { isBlockingStatus } = await import('./utils/workOrderStatus');
      activeWorkOrdersCount = woResults.filter(wo => isBlockingStatus(wo.status)).length;
    }
    
    await db.update(components)
      .set({ isActive: false })
      .where(and(
        eq(components.cuuid, component.cuuid),
        eq(components.vesselId, vesselId)
      ));
    
    return {
      success: true,
      message: activeWorkOrdersCount > 0
        ? `Component deactivated. ${activeWorkOrdersCount} active Work Order(s) will continue to completion but no new ones will be generated.`
        : `Component deactivated successfully.`,
      componentsInactivated: 1,
      activeWorkOrdersCount,
    };
  }

  // Fleet-Scoped Components (legacy - queries components table with dataScope='fleet')
  async getFleetScopedComponents(): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(components)
      .where(eq(components.dataScope, 'fleet'));
  }

  async getFleetScopedComponent(id: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(components)
      .where(and(
        or(eq(components.cuuid, id), eq(components.id, id)),
        eq(components.dataScope, 'fleet')
      ));
    return result[0];
  }

  async createFleetScopedComponent(component: InsertComponent): Promise<Component> {
    const db = await getDb();
    const id = component.id || `FC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(components).values({
      ...component,
      id,
      dataScope: 'fleet',
    }).returning();
    return result[0];
  }

  async updateFleetScopedComponent(id: string, data: Partial<Component>): Promise<Component> {
    return this.updateComponent(id, data);
  }

  async deleteFleetScopedComponent(id: string): Promise<void> {
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
    // 4. rhCounterSource field (legacy data may use this instead of rhMasterComponentId)
    // 5. MUST be in the same vessel as the master component (ALWAYS enforced)
    return await db.select().from(components)
      .where(and(
        eq(components.rhCounterType, 'INHERITED'),
        eq(components.vesselId, effectiveVesselId),
        or(
          eq(components.rhMasterComponentId, masterComponentFullId),
          eq(components.rhMasterComponentId, masterComponentCode),
          eq(components.rhMasterComponentId, masterComponentId),
          eq(components.rhCounterSource, masterComponentCode)
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
      .where(eq(components.cuuid, params.componentId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Component ${params.componentId} not found`);
    }
    return result[0];
  }

  // Update MASTER running hours with automatic cascade to INHERITED components
  // DELTA-BASED: Inherited components receive the change amount, not the absolute value
  async updateMasterRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
    userId: string;
    userUuid?: string;
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

    // Calculate delta: difference between new and old master RH value
    const previousMasterRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
    const delta = params.newRHValue - previousMasterRH;

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
      .where(eq(components.cuuid, component.cuuid))
      .returning();

    if (!masterResult[0]) {
      throw new Error(`Failed to update MASTER component ${params.componentId}`);
    }

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
    
    // Get all inherited components linked to this master
    const inheritedComponents = await this.getInheritedComponents(component.cuuid, masterVesselId);

    await db.insert(runningHoursAudit).values({
      vesselId: masterVesselId,
      componentId: component.cuuid,
      previousRH: previousMasterRH.toFixed(2),
      newRH: params.newRHValue.toFixed(2),
      cumulativeRH: params.newRHValue.toFixed(2),
      dateUpdatedLocal: now.toISOString().split('T')[0],
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: now,
      userId: params.userId,
      updatedByUuid: params.userUuid || null,
      source: params.updateSource.toLowerCase(),
      notes: params.comments || null,
      meterReplaced: false,
      version: 1,
      componentCode: masterComponentCode,
      componentName: component.name || null,
    });

    // Apply DELTA to each inherited component's currentCumulativeRH (actual running hours)
    // rhCurrentInheritedCached stores the master's absolute value (for display/config)
    // currentCumulativeRH tracks the child's individual running hours (delta-based)
    let inheritedUpdated = 0;
    for (const inherited of inheritedComponents) {
      // Get child's current actual running hours (use currentCumulativeRH as the source of truth)
      const currentChildRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
      const newChildRH = Math.max(0, currentChildRH + delta); // Apply delta, ensure non-negative
      
      await db.update(components)
        .set({
          rhCurrentInheritedCached: params.newRHValue.toString(), // Cache master's absolute value
          currentCumulativeRH: newChildRH.toString(), // Child's actual RH with delta applied
          rhInheritedUpdatedAt: now,
          lastUpdated: now.toISOString(),
          updatedAt: now,
        })
        .where(eq(components.cuuid, inherited.cuuid));
      
      inheritedUpdated++;
    }

    return {
      masterUpdated: masterResult[0],
      inheritedUpdated,
    };
  }

  // CENTRALIZED RH UPDATE: Set running hours for any component with automatic field sync
  // This is the SINGLE SOURCE OF TRUTH for all running hours updates
  // DELTA-BASED: Inherited components receive the change amount, not the absolute value
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
      // Calculate delta: difference between new and old master RH value
      const previousMasterRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
      const delta = params.newRHValue - previousMasterRH;

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
        .where(eq(components.cuuid, component.cuuid))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update MASTER component ${params.componentId}`);
      }

      // CRITICAL: Filter by vesselId to prevent cross-vessel RH aggregation
      const masterVesselId = component.vesselId;

      // CRITICAL SAFEGUARD: Skip cascade if vesselId cannot be determined
      if (!masterVesselId) {
        console.warn(`⚠️ [setComponentRunningHours] Cannot determine vesselId for master "${params.componentId}" - skipping cascade to prevent cross-vessel leak`);
        return { component: result[0], inheritedUpdated: 0 };
      }

      // Get all inherited components linked to this master
      const inheritedComponents = await this.getInheritedComponents(component.cuuid, masterVesselId);
      
      // Apply DELTA to each inherited component's currentCumulativeRH (actual running hours)
      // rhCurrentInheritedCached stores the master's absolute value (for display/config)
      // currentCumulativeRH tracks the child's individual running hours (delta-based)
      for (const inherited of inheritedComponents) {
        const currentChildRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
        const newChildRH = Math.max(0, currentChildRH + delta); // Apply delta, ensure non-negative
        
        await db.update(components)
          .set({
            rhCurrentInheritedCached: params.newRHValue.toString(), // Cache master's absolute value
            currentCumulativeRH: newChildRH.toString(), // Child's actual RH with delta applied
            rhInheritedUpdatedAt: now,
            lastUpdated: lastUpdatedValue,
            updatedAt: now,
          })
          .where(eq(components.cuuid, inherited.cuuid));
        
        inheritedUpdated++;
      }

      return { component: result[0], inheritedUpdated };

    } else if (component.rhCounterType === 'INHERITED') {
      // For INHERITED components: only update currentCumulativeRH (child's actual hours)
      // Do NOT update rhCurrentInheritedCached as it stores the master's value
      // This is typically used for component replacement scenarios (reset to 0) or manual adjustments
      const result = await db.update(components)
        .set({
          currentCumulativeRH: rhValueStr,
          rhInheritedUpdatedAt: now,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(components.cuuid, component.cuuid))
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
        .where(eq(components.cuuid, component.cuuid))
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

  async getMaintenanceHistoryByVessel(vesselId: string): Promise<any[]> {
    const db = await getDb();
    const history = await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.vesselCode, vesselId))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
    if (history.length === 0) return [];

    const workOrderIds = [...new Set(history.map(h => h.workOrderId))];
    const anomalies = await db.select({
      workOrderId: workOrderAnomalies.workOrderId,
      daysLate: workOrderAnomalies.daysLate,
    }).from(workOrderAnomalies)
      .where(
        and(
          eq(workOrderAnomalies.anomalyType, 'BACKDATING'),
          sql`${workOrderAnomalies.workOrderId} = ANY(ARRAY[${sql.join(workOrderIds.map(id => sql`${id}`), sql`, `)}]::text[])`
        )
      );

    const backdatingMap = new Map<string, number>();
    for (const a of anomalies) {
      const existing = backdatingMap.get(a.workOrderId) ?? 0;
      backdatingMap.set(a.workOrderId, Math.max(existing, a.daysLate ?? 0));
    }

    return history.map(h => ({
      ...h,
      backdatingDays: backdatingMap.get(h.workOrderId) ?? 0,
    }));
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

  async getEarliestAuditTimestamp(vesselId: string): Promise<Date | null> {
    const db = await getDb();
    const result = await db.select({ earliest: sql<Date>`MIN(${runningHoursAudit.enteredAtUTC})` })
      .from(runningHoursAudit)
      .where(eq(runningHoursAudit.vesselId, vesselId));
    return result[0]?.earliest || null;
  }

  async getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    const db = await getDb();
    // Resolve componentId to cuuid (dual-lookup support)
    const comp = await this.getComponent(componentId);
    const resolvedId = comp ? comp.cuuid : componentId;
    let query = db.select().from(runningHoursAudit)
      .where(or(eq(runningHoursAudit.componentId, resolvedId), eq(runningHoursAudit.componentId, componentId)))
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
    const comp = await this.getComponent(componentId);
    const resolvedId = comp ? comp.cuuid : componentId;
    return await db.select().from(runningHoursAudit)
      .where(and(
        or(eq(runningHoursAudit.componentId, resolvedId), eq(runningHoursAudit.componentId, componentId)),
        gte(runningHoursAudit.enteredAtUTC, startDate),
        lte(runningHoursAudit.enteredAtUTC, endDate)
      ))
      .orderBy(desc(runningHoursAudit.enteredAtUTC));
  }

  async sumPositiveDeltasInPeriod(
    componentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const db = await getDb();
    const comp = await this.getComponent(componentId);
    const resolvedId = comp ? comp.cuuid : componentId;
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(CASE WHEN (CAST(${runningHoursAudit.newRH} AS numeric) - CAST(${runningHoursAudit.previousRH} AS numeric)) > 0 THEN (CAST(${runningHoursAudit.newRH} AS numeric) - CAST(${runningHoursAudit.previousRH} AS numeric)) ELSE 0 END), 0)`
    })
      .from(runningHoursAudit)
      .where(and(
        or(eq(runningHoursAudit.componentId, resolvedId), eq(runningHoursAudit.componentId, componentId)),
        gte(runningHoursAudit.enteredAtUTC, startDate),
        lte(runningHoursAudit.enteredAtUTC, endDate)
      ));
    return parseFloat(result[0]?.total || '0');
  }

  async getRunningHoursAtDate(
    componentId: string,
    targetDate: Date
  ): Promise<{ runningHours: number; enteredAtUTC: Date; isFallback?: boolean } | null> {
    const db = await getDb();
    const comp = await this.getComponent(componentId);
    const resolvedId = comp ? comp.cuuid : componentId;

    const parsedDateExpr = sql`CASE 
      WHEN ${runningHoursAudit.dateUpdatedLocal} ~ '^\d{4}-\d{2}-\d{2}' 
        THEN TO_TIMESTAMP(${runningHoursAudit.dateUpdatedLocal}, 'YYYY-MM-DD')
      ELSE TO_TIMESTAMP(REPLACE(${runningHoursAudit.dateUpdatedLocal}, ' ', '-'), 'DD-Mon-YYYY-HH24:MI')
    END`;

    const idCondition = or(eq(runningHoursAudit.componentId, resolvedId), eq(runningHoursAudit.componentId, componentId));

    const result = await db.select({
      runningHours: runningHoursAudit.cumulativeRH,
      enteredAtUTC: runningHoursAudit.enteredAtUTC
    })
      .from(runningHoursAudit)
      .where(and(
        idCondition,
        sql`${parsedDateExpr} <= ${targetDate}`
      ))
      .orderBy(sql`${parsedDateExpr} DESC`)
      .limit(1);

    if (result.length > 0) {
      return {
        runningHours: parseFloat(result[0].runningHours || '0'),
        enteredAtUTC: result[0].enteredAtUTC,
        isFallback: false
      };
    }

    const fallback = await db.select({
      runningHours: runningHoursAudit.cumulativeRH,
      enteredAtUTC: runningHoursAudit.enteredAtUTC
    })
      .from(runningHoursAudit)
      .where(and(
        idCondition,
        sql`${parsedDateExpr} > ${targetDate}`
      ))
      .orderBy(sql`${parsedDateExpr} ASC`)
      .limit(1);

    if (fallback.length > 0) {
      return {
        runningHours: parseFloat(fallback[0].runningHours || '0'),
        enteredAtUTC: fallback[0].enteredAtUTC,
        isFallback: true
      };
    }

    return null;
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
        jobMap.set(job.juuid, job);
      }
      for (const job of linkedJobs) {
        if (!jobMap.has(job.juuid)) {
          jobMap.set(job.juuid, job);
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
    const result = await db.select().from(jobs).where(
      or(eq(jobs.juuid, id), eq(jobs.id, id))
    );
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
      juuid: randomUUID(),
      dataScope: job.dataScope || 'vessel',
    }).returning();
    return result[0];
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job> {
    const db = await getDb();
    const result = await db.update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(or(eq(jobs.juuid, id), eq(jobs.id, id)))
      .returning();
    if (!result[0]) {
      throw new Error(`Job ${id} not found`);
    }
    return result[0];
  }

  async deleteJob(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(jobs).where(or(eq(jobs.juuid, id), eq(jobs.id, id)));
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
        juuid: randomUUID(),
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
          .where(eq(jobs.juuid, existing.juuid));
        updated++;
      } else {
        const id = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(jobs).values({
          ...job,
          id,
          juuid: randomUUID(),
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
    const result = await db.select().from(workOrders).where(
      or(eq(workOrders.wouuid, id), eq(workOrders.id, id))
    );
    return result[0];
  }

  async getWorkOrderByWorkOrderNo(workOrderNo: string): Promise<WorkOrder | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrders).where(eq(workOrders.workOrderNo, workOrderNo));
    return result[0];
  }

  async getWorkOrderByCode(code: string): Promise<WorkOrder | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrders).where(eq(workOrders.workOrderNo, code));
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
      wouuid: randomUUID(),
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
      .where(or(eq(workOrders.wouuid, id), eq(workOrders.id, id)))
      .returning();
    if (!result[0]) {
      throw new Error(`Work order ${id} not found`);
    }
    return result[0];
  }

  async deleteWorkOrder(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(workOrders).where(or(eq(workOrders.wouuid, id), eq(workOrders.id, id)));
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
        wouuid: randomUUID(),
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
          .where(eq(workOrders.wouuid, existing.wouuid));
        updated++;
      } else {
        const id = wo.id || `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(workOrders).values({
          ...wo,
          id,
          wouuid: randomUUID(),
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
        or(eq(workOrders.wouuid, id), eq(workOrders.id, id)),
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
      wouuid: randomUUID(),
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

  async getSpare(id: string): Promise<Spare | undefined> {
    const db = await getDb();
    const numId = Number(id);
    const result = await db.select().from(spares).where(
      or(eq(spares.suuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(spares.id, numId)] : []))
    );
    return result[0];
  }

  async createSpare(spare: InsertSpare, skipSiblingSync: boolean = false): Promise<Spare> {
    const db = await getDb();
    const robA = spare.robLocationA ?? 0;
    const robB = spare.robLocationB ?? 0;
    const ihmSynced = spare.ihm === 'Yes' ? 'YES' : spare.ihm === 'No' ? 'NO' : spare.ihmPresence;
    const result = await db.insert(spares).values({
      ...spare,
      suuid: randomUUID(),
      dataScope: spare.dataScope || 'vessel',
      rob: spare.rob ?? 0,
      robLocationA: robA,
      robLocationB: robB,
      min: spare.min ?? 0,
      ihmPresence: ihmSynced || 'UNKNOWN',
    }).returning();

    const createdSpare = result[0];

    // SYNC: Create spare_component_links entry when componentId is present
    // When skipSiblingSync=true (bulk import), skip entirely — processSpareInventory() handles link creation
    if (!skipSiblingSync && createdSpare.componentId && createdSpare.vesselId) {
      try {
        const existingLinks = await this.getSpareComponentLinksBySpare(createdSpare.id);
        const alreadyLinked = existingLinks.some((link: any) => link.componentId === createdSpare.componentId);
        if (!alreadyLinked) {
          await this.createSpareComponentLink({
            spareId: createdSpare.id,
            spareUuid: createdSpare.suuid,
            componentId: createdSpare.componentId,
            vesselId: createdSpare.vesselId,
            linkedBy: spare.createdBy || 'System',
          });
        }
      } catch (linkError: any) {
        console.warn(`[createSpare] Failed to create spare_component_link for spare ${createdSpare.id} → component ${createdSpare.componentId}: ${linkError.message}`);
      }
    }

    // SYNC: Create spare_location_stock entries independently for each assigned location
    if (createdSpare.vesselId) {
      const vesselId = createdSpare.vesselId;

      if (createdSpare.location) {
        try {
          const locationAObj = await this.findLocationStrict(vesselId, createdSpare.location);
          await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, spareUuid: createdSpare.suuid, locationId: locationAObj.id, qty: robA });
        } catch (syncError: any) {
          console.warn(`[createSpare] Failed to sync Location A spare_location_stock for spare ${createdSpare.id}: ${syncError.message}`);
        }
      }
      if (createdSpare.location2) {
        try {
          const locationBObj = await this.findLocationStrict(vesselId, createdSpare.location2);
          await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, spareUuid: createdSpare.suuid, locationId: locationBObj.id, qty: robB });
        } catch (syncError: any) {
          console.warn(`[createSpare] Failed to sync Location B spare_location_stock for spare ${createdSpare.id}: ${syncError.message}`);
        }
      }
    }
    
    return createdSpare;
  }

  async updateSpare(id: string, data: Partial<Spare>, skipSiblingSync: boolean = false): Promise<Spare> {
    const db = await getDb();
    // Filter out undefined/null partCode to prevent NOT NULL constraint violation
    const { partCode, ...restData } = data;
    const updateData = partCode != null ? { ...restData, partCode, updatedAt: new Date() } : { ...restData, updatedAt: new Date() };
    if (updateData.ihm === 'Yes') updateData.ihmPresence = 'YES';
    else if (updateData.ihm === 'No') updateData.ihmPresence = 'NO';
    if (updateData.ihmPresence === 'YES' && !updateData.ihm) updateData.ihm = 'Yes';
    else if (updateData.ihmPresence === 'NO' && !updateData.ihm) updateData.ihm = 'No';
    
    const numId = Number(id);
    const result = await db.update(spares)
      .set(updateData)
      .where(or(eq(spares.suuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(spares.id, numId)] : [])))
      .returning();
    if (!result[0]) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const updatedSpare = result[0];

    // SYNC: Create spare_component_links entry when componentId is updated
    // When skipSiblingSync=true (bulk import), skip entirely — processSpareInventory() handles link creation
    if (!skipSiblingSync && data.componentId && updatedSpare.vesselId) {
      try {
        const existingLinks = await this.getSpareComponentLinksBySpare(updatedSpare.id);
        const alreadyLinked = existingLinks.some((link: any) => link.componentId === data.componentId);
        if (!alreadyLinked) {
          await this.createSpareComponentLink({
            spareId: updatedSpare.id,
            spareUuid: updatedSpare.suuid,
            componentId: data.componentId,
            vesselId: updatedSpare.vesselId,
            linkedBy: data.updatedBy || 'System',
          });
        }
      } catch (linkError: any) {
        console.warn(`[updateSpare] Failed to create spare_component_link for spare ${id} → component ${data.componentId}: ${linkError.message}`);
      }
    }

    // SYNC: Update spare_location_stock if ROB values or location fields changed
    const robChanged = data.robLocationA !== undefined || data.robLocationB !== undefined;
    const locationChanged = data.location !== undefined || data.location2 !== undefined;
    if ((robChanged || locationChanged) && updatedSpare.vesselId) {
      const vesselId = updatedSpare.vesselId;
      const robA = updatedSpare.robLocationA ?? 0;
      const robB = updatedSpare.robLocationB ?? 0;

      if (updatedSpare.location) {
        try {
          const locationAObj = await this.findLocationStrict(vesselId, updatedSpare.location);
          await this.upsertSpareLocationStock({ vesselId, spareId: updatedSpare.id, spareUuid: updatedSpare.suuid, locationId: locationAObj.id, qty: robA });
        } catch (syncError: any) {
          console.warn(`[updateSpare] Failed to sync Location A spare_location_stock for spare ${id}: ${syncError.message}`);
        }
      }
      if (updatedSpare.location2) {
        try {
          const locationBObj = await this.findLocationStrict(vesselId, updatedSpare.location2);
          await this.upsertSpareLocationStock({ vesselId, spareId: updatedSpare.id, spareUuid: updatedSpare.suuid, locationId: locationBObj.id, qty: robB });
        } catch (syncError: any) {
          console.warn(`[updateSpare] Failed to sync Location B spare_location_stock for spare ${id}: ${syncError.message}`);
        }
      }

      const activeLocationIds: number[] = [];
      if (updatedSpare.location) {
        try {
          const locA = await this.findLocationStrict(vesselId, updatedSpare.location);
          activeLocationIds.push(locA.id);
        } catch (_) {}
      }
      if (updatedSpare.location2) {
        try {
          const locB = await this.findLocationStrict(vesselId, updatedSpare.location2);
          activeLocationIds.push(locB.id);
        } catch (_) {}
      }
      try {
        const allStockRows = await this.getSpareLocationStock(updatedSpare.id);
        const orphanedRows = allStockRows.filter(r => !activeLocationIds.includes(r.locationId));
        for (const orphan of orphanedRows) {
          await db.delete(spareLocationStock).where(
            and(
              eq(spareLocationStock.spareId, updatedSpare.id),
              eq(spareLocationStock.locationId, orphan.locationId)
            )
          );
        }
        if (orphanedRows.length > 0) {
          console.log(`[updateSpare] Cleaned up ${orphanedRows.length} orphaned spare_location_stock entries for spare ${id}`);
        }
      } catch (cleanupError: any) {
        console.warn(`[updateSpare] Failed to cleanup orphaned spare_location_stock for spare ${id}: ${cleanupError.message}`);
      }
    }
    
    return updatedSpare;
  }

  async deleteSpare(id: string): Promise<void> {
    const db = await getDb();
    const numId = Number(id);
    await db.update(spares)
      .set({ isActive: false, updatedAt: new Date() })
      .where(or(eq(spares.suuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(spares.id, numId)] : [])));
  }

  async consumeSpare(
    id: string,
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
      .where(eq(spares.suuid, spare.suuid))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
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

    // SYNC: Update normalized spare_location_stock table independently per location
    const vesselId = spare.vesselId || 'V001';
    if (spare.location) {
      try {
        const locationA = await this.findLocationStrict(vesselId, spare.location);
        await this.upsertSpareLocationStock({
          vesselId,
          spareId: spare.id,
          spareUuid: spare.suuid,
          locationId: locationA.id,
          qty: newRobA < 0 ? 0 : newRobA,
        });
      } catch (syncError: any) {
        console.warn(`[consumeSpare] Failed to sync Location A spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }

    return updated[0];
  }

  async consumeSpareFromLocation(
    id: string,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    workOrderRef?: string,
    dateLocal?: string
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
      .where(eq(spares.suuid, spare.suuid))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
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
      dateLocal: dateLocal ?? null,
      tz: null,
      place: null,
    });
    
    // SYNC: Update normalized spare_location_stock table independently per location
    const vesselId = spare.vesselId || 'V001';
    if (spare.location) {
      try {
        const locationAObj = await this.findLocationStrict(vesselId, spare.location);
        await this.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationAObj.id, qty: newRobA });
      } catch (syncError: any) {
        console.warn(`[consumeSpareFromLocation] Failed to sync Location A spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }
    if (spare.location2) {
      try {
        const locationBObj = await this.findLocationStrict(vesselId, spare.location2);
        await this.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationBObj.id, qty: newRobB });
      } catch (syncError: any) {
        console.warn(`[consumeSpareFromLocation] Failed to sync Location B spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }
    
    return {
      spare: updated[0],
      deducted,
      requested: quantity,
      shortageQty,
    };
  }

  async receiveSpareToLocation(
    id: string,
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
      .where(eq(spares.suuid, spare.suuid))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
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
    
    // SYNC: Update normalized spare_location_stock table independently per location
    const vesselId = spare.vesselId || 'V001';
    if (spare.location) {
      try {
        const locationAObj = await this.findLocationStrict(vesselId, spare.location);
        await this.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationAObj.id, qty: newRobA });
      } catch (syncError: any) {
        console.warn(`[receiveSpareToLocation] Failed to sync Location A spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }
    if (spare.location2) {
      try {
        const locationBObj = await this.findLocationStrict(vesselId, spare.location2);
        await this.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationBObj.id, qty: newRobB });
      } catch (syncError: any) {
        console.warn(`[receiveSpareToLocation] Failed to sync Location B spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }
    
    return {
      spare: updated[0],
      received: quantity,
    };
  }

  async adjustSpareAtLocation(
    id: string,
    newRob: number,
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
    
    if (isNaN(newRob) || newRob < 0) {
      throw new Error('newRob must be a valid non-negative number');
    }
    
    const oldLocA = spare.robLocationA ?? 0;
    const oldLocB = spare.robLocationB ?? 0;
    const oldTotal = oldLocA + oldLocB;
    
    let newLocA = oldLocA;
    let newLocB = oldLocB;
    
    if (location === 'A') {
      newLocA = newRob;
    } else {
      newLocB = newRob;
    }
    
    const newTotal = newLocA + newLocB;
    const netChange = newTotal - oldTotal;
    
    if (netChange === 0) {
      return spare;
    }
    
    const updated = await db.update(spares)
      .set({
        rob: newTotal,
        robLocationA: newLocA,
        robLocationB: newLocB,
        updatedAt: new Date()
      })
      .where(eq(spares.suuid, spare.suuid))
      .returning();

    const adjustmentRemarks = remarks || `Adjustment at Location ${location}: ${location === 'A' ? oldLocA : oldLocB}→${newRob}`;

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType: 'ADJUST',
      qtyChange: netChange,
      robAfter: newTotal,
      userId,
      remarks: adjustmentRemarks,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });

    // SYNC: Update normalized spare_location_stock table independently per location
    const vesselId = spare.vesselId || 'V001';
    if (spare.location) {
      try {
        const locationAObj = await this.findLocationStrict(vesselId, spare.location);
        await this.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationAObj.id, qty: newLocA });
      } catch (syncError: any) {
        console.warn(`[adjustSpareAtLocation] Failed to sync Location A spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }
    if (spare.location2) {
      try {
        const locationBObj = await this.findLocationStrict(vesselId, spare.location2);
        await this.upsertSpareLocationStock({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationBObj.id, qty: newLocB });
      } catch (syncError: any) {
        console.warn(`[adjustSpareAtLocation] Failed to sync Location B spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }

    return updated[0];
  }

  async transferSpareLocation(
    id: string,
    newRobLocationA: number,
    newRobLocationB: number,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<{ spare: Spare; isTransfer: boolean }> {
    const db = await getDb();
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    const oldLocA = spare.robLocationA ?? 0;
    const oldLocB = spare.robLocationB ?? 0;
    const newLocA = Number(newRobLocationA) || 0;
    const newLocB = Number(newRobLocationB) || 0;
    
    // Validate numeric inputs
    if (isNaN(newLocA) || newLocA < 0) {
      throw new Error('robLocationA must be a valid non-negative number');
    }
    if (isNaN(newLocB) || newLocB < 0) {
      throw new Error('robLocationB must be a valid non-negative number');
    }
    
    const deltaA = newLocA - oldLocA;
    const deltaB = newLocB - oldLocB;
    
    if (deltaA === 0 && deltaB === 0) {
      return { spare, isTransfer: false };
    }
    
    const newTotalRob = newLocA + newLocB;
    
    const updated = await db.update(spares)
      .set({
        rob: newTotalRob,
        robLocationA: newLocA,
        robLocationB: newLocB,
        updatedAt: new Date()
      })
      .where(eq(spares.suuid, spare.suuid))
      .returning();

    // SYNC: Update normalized spare_location_stock table independently per location
    const vesselId = spare.vesselId || 'V001';

    if (spare.location) {
      try {
        const locationA = await this.findLocationStrict(vesselId, spare.location);
        await this.upsertSpareLocationStock({
          vesselId,
          spareId: spare.id,
          spareUuid: spare.suuid,
          locationId: locationA.id,
          qty: newLocA,
        });
        console.log(`[transferSpareLocation] Synced Location A spare_location_stock for spare ${id}: ${spare.location}=${newLocA}`);
      } catch (syncError: any) {
        console.warn(`[transferSpareLocation] Failed to sync Location A spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }
    if (spare.location2) {
      try {
        const locationB = await this.findLocationStrict(vesselId, spare.location2);
        await this.upsertSpareLocationStock({
          vesselId,
          spareId: spare.id,
          spareUuid: spare.suuid,
          locationId: locationB.id,
          qty: newLocB,
        });
        console.log(`[transferSpareLocation] Synced Location B spare_location_stock for spare ${id}: ${spare.location2}=${newLocB}`);
      } catch (syncError: any) {
        console.warn(`[transferSpareLocation] Failed to sync Location B spare_location_stock for spare ${id}: ${syncError.message}`);
      }
    }

    // Only create transfer history entries if this is a true transfer
    // (total ROB unchanged AND stock moved between locations)
    const oldTotalRob = oldLocA + oldLocB;
    const isTrueTransfer = deltaA !== 0 && deltaB !== 0 && newTotalRob === oldTotalRob;
    
    if (isTrueTransfer) {
      const transferQty = Math.abs(deltaA);
      const fromLocation = deltaA < 0 ? 'A' : 'B';
      const toLocation = deltaA < 0 ? 'B' : 'A';
      const transferRemarks = remarks || `Transfer ${transferQty} from Location ${fromLocation} to Location ${toLocation}`;

      await this.createSpareHistory({
        timestampUTC: new Date(),
        vesselId: spare.vesselId || 'V001',
        spareId: spare.id,
        spareUuid: spare.suuid,
        partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
        partName: spare.partName,
        componentId: spare.componentId || '',
        componentCode: spare.componentCode ?? null,
        componentName: spare.componentName,
        componentSpareCode: spare.componentSpareCode ?? null,
        eventType: 'TRANSFER',
        qtyChange: 0,
        robAfter: newTotalRob,
        userId,
        remarks: transferRemarks,
        reference: null,
        dateLocal: dateLocal ?? null,
        tz: tz ?? null,
        place: place ?? null,
      });
      
      return { spare: updated[0], isTransfer: true };
    }
    
    // Not a true transfer - classify based on net ROB change direction
    const netChange = (newLocA + newLocB) - (oldLocA + oldLocB);
    let eventType: string;
    let eventRemarks: string;

    if (netChange < 0) {
      eventType = 'CONSUME';
      eventRemarks = remarks || `Consumed ${Math.abs(netChange)} units (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`;
    } else if (netChange > 0) {
      eventType = 'RECEIVE';
      eventRemarks = remarks || `Received ${netChange} units (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`;
    } else {
      eventType = 'ADJUSTMENT';
      eventRemarks = remarks || `Adjustment (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`;
    }
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
      partName: spare.partName,
      componentId: spare.componentId || '',
      componentCode: spare.componentCode ?? null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode ?? null,
      eventType,
      qtyChange: netChange,
      robAfter: newTotalRob,
      userId,
      remarks: eventRemarks,
      reference: null,
      dateLocal: dateLocal ?? null,
      tz: tz ?? null,
      place: place ?? null,
    });
    
    return { spare: updated[0], isTransfer: false };
  }

  async receiveSpare(
    id: string,
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
      .where(eq(spares.suuid, spare.suuid))
      .returning();

    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
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
    spareId: string,
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
      .where(eq(spares.suuid, spare.suuid))
      .returning();
    
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: spare.id,
      spareUuid: spare.suuid,
      partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
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
    updates: Array<{id: string, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>,
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

  // Fleet Spares - New fleet_spares table methods
  async getFleetSparesFromTable(): Promise<FleetSpares[]> {
    const db = await getDb();
    return await db.select().from(fleetSpares)
      .where(eq(fleetSpares.isDeleted, false));
  }

  async getFleetSpareFromTable(id: number): Promise<FleetSpares | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleetSpares)
      .where(and(
        eq(fleetSpares.id, id),
        eq(fleetSpares.isDeleted, false)
      ));
    return result[0];
  }

  async createFleetSpareInTable(spare: InsertFleetSpares): Promise<FleetSpares> {
    const db = await getDb();
    const result = await db.insert(fleetSpares).values({
      ...spare,
    }).returning();
    return result[0];
  }

  async updateFleetSpareInTable(id: number, data: Partial<FleetSpares>): Promise<FleetSpares> {
    const db = await getDb();
    const result = await db.update(fleetSpares)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fleetSpares.id, id))
      .returning();
    return result[0];
  }

  async deleteFleetSpareFromTable(id: number): Promise<void> {
    const db = await getDb();
    await db.update(fleetSpares)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(fleetSpares.id, id));
  }

  async getFleetSpareByPartCode(partCode: string): Promise<FleetSpares | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleetSpares)
      .where(and(
        eq(fleetSpares.partCode, partCode),
        eq(fleetSpares.isDeleted, false)
      ));
    return result[0];
  }

  // Legacy Fleet Spares (spares table with dataScope='fleet')
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
        or(eq(spares.id, id), eq(spares.suuid, String(id))),
        eq(spares.dataScope, 'fleet')
      ));
    return result[0];
  }

  async createFleetSpare(spare: InsertSpare): Promise<Spare> {
    const db = await getDb();
    const result = await db.insert(spares).values({
      ...spare,
      suuid: randomUUID(),
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
      const robA = spare.robLocationA ?? 0;
      const robB = spare.robLocationB ?? 0;
      const result = await db.insert(spares).values({
        ...spare,
        suuid: randomUUID(),
        dataScope: spare.dataScope || 'vessel',
        rob: spare.rob ?? 0,
        robLocationA: robA,
        robLocationB: robB,
        min: spare.min ?? 0,
      }).returning();
      const createdSpare = result[0];
      results.push(createdSpare);
      
      // SYNC: Create spare_location_stock entries independently for each assigned location
      if (createdSpare.vesselId) {
        const vesselId = createdSpare.vesselId;

        if (createdSpare.location) {
          try {
            const locationAObj = await this.findLocationStrict(vesselId, createdSpare.location);
            await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, locationId: locationAObj.id, qty: robA });
          } catch (syncError: any) {
            console.warn(`[bulkCreateSpares] Failed to sync Location A spare_location_stock for spare ${createdSpare.id}: ${syncError.message}`);
          }
        }
        if (createdSpare.location2) {
          try {
            const locationBObj = await this.findLocationStrict(vesselId, createdSpare.location2);
            await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, locationId: locationBObj.id, qty: robB });
          } catch (syncError: any) {
            console.warn(`[bulkCreateSpares] Failed to sync Location B spare_location_stock for spare ${createdSpare.id}: ${syncError.message}`);
          }
        }
      }
    }
    
    return results;
  }

  async bulkUpdateSparesByROB(updates: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]> {
    const db = await getDb();
    const results: Spare[] = [];

    for (const { robId, data } of updates) {
      const numId = parseInt(robId, 10);
      if (isNaN(numId)) continue;

      // Filter out undefined/null partCode to prevent NOT NULL constraint violation
      const { partCode, ...restData } = data;
      const updateData = partCode != null ? { ...restData, partCode, updatedAt: new Date() } : { ...restData, updatedAt: new Date() };

      const result = await db.update(spares)
        .set(updateData)
        .where(or(eq(spares.id, numId), eq(spares.suuid, robId)))
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
        // Filter out undefined/null partCode to preserve existing value and prevent NOT NULL constraint violation
        const { partCode, ...restSpare } = spare;
        const updateData = partCode != null ? { ...restSpare, partCode, updatedAt: new Date() } : { ...restSpare, updatedAt: new Date() };
        
        await db.update(spares)
          .set(updateData)
          .where(eq(spares.suuid, existing.suuid));
        updated++;

        // SYNC: Update spare_location_stock independently per location if ROB values changed
        const newRobA = spare.robLocationA ?? existing.robLocationA ?? 0;
        const newRobB = spare.robLocationB ?? existing.robLocationB ?? 0;
        if (spare.vesselId && (spare.robLocationA !== undefined || spare.robLocationB !== undefined)) {
          const locationAName = spare.location || existing.location;
          const locationBName = spare.location2 || existing.location2;

          if (locationAName) {
            try {
              const locationAObj = await this.findLocationStrict(spare.vesselId, locationAName);
              await this.upsertSpareLocationStock({ vesselId: spare.vesselId, spareId: existing.id, spareUuid: existing.suuid, locationId: locationAObj.id, qty: newRobA });
            } catch (syncError: any) {
              console.warn(`[bulkUpsertSpares] Failed to sync Location A spare_location_stock for spare ${existing.id}: ${syncError.message}`);
            }
          }
          if (locationBName) {
            try {
              const locationBObj = await this.findLocationStrict(spare.vesselId, locationBName);
              await this.upsertSpareLocationStock({ vesselId: spare.vesselId, spareId: existing.id, spareUuid: existing.suuid, locationId: locationBObj.id, qty: newRobB });
            } catch (syncError: any) {
              console.warn(`[bulkUpsertSpares] Failed to sync Location B spare_location_stock for spare ${existing.id}: ${syncError.message}`);
            }
          }
        }
      } else {
        // For inserts, partCode is required - fail early if not provided
        if (!spare.partCode) {
          throw new Error('partCode is required when creating a new spare');
        }
        const robA = spare.robLocationA ?? 0;
        const robB = spare.robLocationB ?? 0;
        const result = await db.insert(spares).values({
          ...spare,
          suuid: randomUUID(),
          dataScope: spare.dataScope || 'vessel',
          rob: spare.rob ?? 0,
          robLocationA: robA,
          robLocationB: robB,
          min: spare.min ?? 0,
        }).returning();
        created++;
        
        // SYNC: Create spare_location_stock entries independently for each assigned location
        const createdSpare = result[0];
        if (createdSpare?.vesselId) {
          const vesselId = createdSpare.vesselId;

          if (createdSpare.location) {
            try {
              const locationAObj = await this.findLocationStrict(vesselId, createdSpare.location);
              await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, locationId: locationAObj.id, qty: robA });
            } catch (syncError: any) {
              console.warn(`[bulkUpsertSpares] Failed to sync Location A spare_location_stock for new spare ${createdSpare.id}: ${syncError.message}`);
            }
          }
          if (createdSpare.location2) {
            try {
              const locationBObj = await this.findLocationStrict(vesselId, createdSpare.location2);
              await this.upsertSpareLocationStock({ vesselId, spareId: createdSpare.id, locationId: locationBObj.id, qty: robB });
            } catch (syncError: any) {
              console.warn(`[bulkUpsertSpares] Failed to sync Location B spare_location_stock for new spare ${createdSpare.id}: ${syncError.message}`);
            }
          }
        }
      }
    }
    
    return { created, updated };
  }

  // ============= MODULE 7: SPARES HISTORY =============

  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    const db = await getDb();
    const rows = await db.select({
      history: sparesHistory,
      partNumber: spares.partNumber,
    }).from(sparesHistory)
      .leftJoin(spares, eq(sparesHistory.spareUuid, spares.suuid))
      .where(eq(sparesHistory.vesselId, vesselId))
      .orderBy(desc(sparesHistory.timestampUTC));
    return rows.map(r => ({
      ...r.history,
      partNumber: r.partNumber ?? null,
    })) as SpareHistory[];
  }

  async getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
    const db = await getDb();
    const rows = await db.select({
      history: sparesHistory,
      partNumber: spares.partNumber,
    }).from(sparesHistory)
      .leftJoin(spares, eq(sparesHistory.spareUuid, spares.suuid))
      .where(eq(sparesHistory.spareId, spareId))
      .orderBy(desc(sparesHistory.timestampUTC));
    return rows.map(r => ({
      ...r.history,
      partNumber: r.partNumber ?? null,
    })) as SpareHistory[];
  }

  async createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory> {
    return this.insertWithSequenceRepair('spares_history', async () => {
      const db = await getDb();
      const result = await db.insert(sparesHistory).values(history).returning();
      return result[0];
    });
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

  async inactivateStoresItem(id: string, vesselId?: string): Promise<void> {
    const db = await getDb();
    const numId = Number(id);
    const idCondition = or(eq(storesItems.stuuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(storesItems.id, numId)] : []));
    const condition = vesselId ? and(idCondition, eq(storesItems.vesselId, vesselId)) : idCondition;
    await db.update(storesItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(condition);
  }

  async getStoresItem(id: string): Promise<StoresItem | undefined> {
    const db = await getDb();
    const numId = Number(id);
    const result = await db.select().from(storesItems).where(
      or(eq(storesItems.stuuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(storesItems.id, numId)] : []))
    );
    return result[0];
  }

  async createStoresItem(item: InsertStoresItem, userId?: string): Promise<StoresItem> {
    const db = await getDb();
    const robLocationA = Number(item.robLocationA || 0);
    const robLocationB = Number(item.robLocationB || 0);
    
    // Validate numeric inputs - reject NaN
    if (isNaN(robLocationA) || robLocationA < 0) {
      throw new Error('robLocationA must be a valid non-negative number');
    }
    if (isNaN(robLocationB) || robLocationB < 0) {
      throw new Error('robLocationB must be a valid non-negative number');
    }
    
    const totalRob = robLocationA + robLocationB;
    
    const result = await db.insert(storesItems).values({
      ...item,
      stuuid: randomUUID(),
      rob: String(totalRob),
      robLocationA: String(robLocationA),
      robLocationB: String(robLocationB),
      min: item.min || '0',
    }).returning();
    
    const created = result[0];
    
    // Create initial ledger entry if starting with non-zero ROB
    if (totalRob > 0) {
      await this.insertStoresLedgerEntry({
        vesselId: created.vesselId,
        section: created.itemType,
        itemId: created.id,
        storeUuid: created.stuuid,
        partCode: created.itemCode,
        itemName: created.itemName,
        uom: created.uom,
        eventType: 'INITIAL',
        qtyChangeBase: String(totalRob),
        qtyDisplay: String(totalRob),
        robAfterBase: String(totalRob),
        dateLocal: new Date().toISOString().split('T')[0],
        tz: 'UTC',
        timestampUTC: new Date(),
        place: `Location A: ${robLocationA}, Location B: ${robLocationB}`,
        userId: userId || 'System',
        remarks: 'Initial stock on item creation',
      });
    }
    
    return created;
  }

  async updateStoresItem(id: string, data: Partial<StoresItem>): Promise<StoresItem> {
    const db = await getDb();
    
    // Block direct ROB updates - these must go through dedicated methods
    // (consumeStoresItem, receiveStoresItem, transferStoresItemLocation, adjustStoresItem)
    const blockedFields = ['rob', 'robLocationA', 'robLocationB'];
    const attemptedRobUpdate = blockedFields.some(field => field in data && data[field as keyof StoresItem] !== undefined);
    if (attemptedRobUpdate) {
      throw new Error('Direct ROB updates are not allowed. Use consume, receive, transfer, or adjust methods to modify stock quantities.');
    }
    
    const numId = Number(id);
    const idCondition = or(eq(storesItems.stuuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(storesItems.id, numId)] : []));
    const result = await db.update(storesItems)
      .set({ ...data, updatedAt: new Date() })
      .where(idCondition)
      .returning();
    if (!result[0]) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    return result[0];
  }

  async deleteStoresItem(id: string): Promise<void> {
    const db = await getDb();
    const numId = Number(id);
    await db.update(storesItems)
      .set({ deleted: true, updatedAt: new Date() })
      .where(or(eq(storesItems.stuuid, id), ...(Number.isInteger(numId) && numId > 0 ? [eq(storesItems.id, numId)] : [])));
  }

  async consumeStoresItem(
    id: string,
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
      .where(eq(storesItems.stuuid, item.stuuid))
      .returning();

    await this.insertStoresLedgerEntry({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: item.id,
      storeUuid: item.stuuid,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'CONSUME',
      qtyChangeBase: String(-actualConsumed),
      qtyDisplay: String(-actualConsumed),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      userId: userId,
      remarks: remarks,
    });

    return updated[0];
  }

  async receiveStoresItem(
    id: string,
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
      .where(eq(storesItems.stuuid, item.stuuid))
      .returning();

    await this.insertStoresLedgerEntry({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: item.id,
      storeUuid: item.stuuid,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'RECEIVE',
      qtyChangeBase: String(qtyNum),
      qtyDisplay: String(qtyNum),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      ref: ref,
      userId: userId,
      remarks: remarks,
    });

    return updated[0];
  }

  async transferStoresItemLocation(
    id: string,
    newRobLocationA: string,
    newRobLocationB: string,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<{ item: StoresItem; isTransfer: boolean }> {
    const db = await getDb();
    const item = await this.getStoresItem(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    
    const oldLocA = Number(item.robLocationA || 0);
    const oldLocB = Number(item.robLocationB || 0);
    const newLocA = Number(newRobLocationA || 0);
    const newLocB = Number(newRobLocationB || 0);
    
    // Validate numeric inputs - reject NaN
    if (isNaN(newLocA) || newLocA < 0) {
      throw new Error('robLocationA must be a valid non-negative number');
    }
    if (isNaN(newLocB) || newLocB < 0) {
      throw new Error('robLocationB must be a valid non-negative number');
    }
    
    const deltaA = newLocA - oldLocA;
    const deltaB = newLocB - oldLocB;
    
    if (deltaA === 0 && deltaB === 0) {
      return { item, isTransfer: false };
    }
    
    const newTotalRob = newLocA + newLocB;
    
    const updated = await db.update(storesItems)
      .set({
        rob: String(newTotalRob),
        robLocationA: String(newLocA),
        robLocationB: String(newLocB),
        updatedAt: new Date()
      })
      .where(eq(storesItems.stuuid, item.stuuid))
      .returning();

    // Only create transfer ledger entries if this is a true transfer
    // (deltaA == -deltaB means total ROB unchanged, stock moved between locations)
    const isTrueTransfer = deltaA !== 0 && deltaB !== 0 && deltaA === -deltaB;
    
    if (isTrueTransfer) {
      const transferQty = Math.abs(deltaA);
      const fromLocation = deltaA < 0 ? 'A' : 'B';
      const toLocation = deltaA < 0 ? 'B' : 'A';
      const transferRemarks = remarks || `Transfer ${transferQty} from Location ${fromLocation} to Location ${toLocation}`;

      await this.insertStoresLedgerEntry({
        vesselId: item.vesselId,
        section: item.itemType,
        itemId: item.id,
        storeUuid: item.stuuid,
        partCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        eventType: 'TRANSFER_OUT',
        qtyChangeBase: String(-transferQty),
        qtyDisplay: String(-transferQty),
        robAfterBase: String(newTotalRob),
        dateLocal: dateLocal || new Date().toISOString().split('T')[0],
        tz: tz || 'UTC',
        timestampUTC: new Date(),
        place: place || `Location ${fromLocation}`,
        userId: userId,
        remarks: transferRemarks,
      });

      await this.insertStoresLedgerEntry({
        vesselId: item.vesselId,
        section: item.itemType,
        itemId: item.id,
        storeUuid: item.stuuid,
        partCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        eventType: 'TRANSFER_IN',
        qtyChangeBase: String(transferQty),
        qtyDisplay: String(transferQty),
        robAfterBase: String(newTotalRob),
        dateLocal: dateLocal || new Date().toISOString().split('T')[0],
        tz: tz || 'UTC',
        timestampUTC: new Date(),
        place: place || `Location ${toLocation}`,
        userId: userId,
        remarks: transferRemarks,
      });
      
      return { item: updated[0], isTransfer: true };
    }
    
    // Not a true transfer - classify based on net ROB change direction
    const netChange = (newLocA + newLocB) - (oldLocA + oldLocB);
    let eventType: string;
    let eventRemarks: string;

    if (netChange < 0) {
      eventType = 'CONSUME';
      eventRemarks = remarks || `Consumed ${Math.abs(netChange)} units (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`;
    } else if (netChange > 0) {
      eventType = 'RECEIVE';
      eventRemarks = remarks || `Received ${netChange} units (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`;
    } else {
      eventType = 'ADJUSTMENT';
      eventRemarks = remarks || `Adjustment (Location A: ${oldLocA}→${newLocA}, Location B: ${oldLocB}→${newLocB})`;
    }
    
    await this.insertStoresLedgerEntry({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: item.id,
      storeUuid: item.stuuid,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType,
      qtyChangeBase: String(netChange),
      qtyDisplay: String(netChange),
      robAfterBase: String(newTotalRob),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place,
      userId: userId,
      remarks: eventRemarks,
    });

    return { item: updated[0], isTransfer: false };
  }

  async adjustStoresItem(
    id: string,
    newRob: number,
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
    
    // Validate numeric input - reject NaN
    if (isNaN(newRob) || newRob < 0) {
      throw new Error('newRob must be a valid non-negative number');
    }
    
    const oldLocA = Number(item.robLocationA || 0);
    const oldLocB = Number(item.robLocationB || 0);
    const oldTotal = oldLocA + oldLocB;
    
    let newLocA = oldLocA;
    let newLocB = oldLocB;
    
    if (location === 'A') {
      newLocA = newRob;
    } else {
      newLocB = newRob;
    }
    
    const newTotal = newLocA + newLocB;
    const netChange = newTotal - oldTotal;
    
    if (netChange === 0) {
      return item;
    }
    
    const updated = await db.update(storesItems)
      .set({
        rob: String(newTotal),
        robLocationA: String(newLocA),
        robLocationB: String(newLocB),
        updatedAt: new Date()
      })
      .where(eq(storesItems.stuuid, item.stuuid))
      .returning();

    const adjustmentRemarks = remarks || `Adjustment at Location ${location}: ${location === 'A' ? oldLocA : oldLocB}→${newRob}`;
    
    await this.insertStoresLedgerEntry({
      vesselId: item.vesselId,
      section: item.itemType,
      itemId: item.id,
      storeUuid: item.stuuid,
      partCode: item.itemCode,
      itemName: item.itemName,
      uom: item.uom,
      eventType: 'ADJUSTMENT',
      qtyChangeBase: String(netChange),
      qtyDisplay: String(netChange),
      robAfterBase: String(newTotal),
      dateLocal: dateLocal || new Date().toISOString().split('T')[0],
      tz: tz || 'UTC',
      timestampUTC: new Date(),
      place: place || `Location ${location}`,
      userId: userId,
      remarks: adjustmentRemarks,
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

  async getStoresItemHistory(itemId: string): Promise<StoresLedger[]> {
    const db = await getDb();
    return await db.select().from(storesLedger)
      .where(eq(storesLedger.storeUuid, itemId))
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
    dueOverdue?: string;
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
    
    if (filters?.dueOverdue === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      conditions.push(lt(defects.targetCloseDate, todayStr));
      conditions.push(sql`(${defects.verified} IS NULL OR ${defects.verified} = false)`);
    } else if (filters?.dueOverdue === 'due') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      conditions.push(gte(defects.targetCloseDate, todayStr));
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
    const result = await db.select().from(defects).where(
      or(eq(defects.duuid, id), eq(defects.id, id))
    );
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
      .where(eq(vessels.vuuid, vesselId));
    
    let vesselSeq = vesselResult[0]?.vesselSequence;
    
    // If vessel exists but doesn't have a sequence yet, assign one
    if (vesselResult.length > 0 && !vesselSeq) {
      const maxSeqResult = await db.select({ max: sql<number>`COALESCE(MAX(vessel_sequence), 0)` })
        .from(vessels);
      vesselSeq = (maxSeqResult[0]?.max || 0) + 1;
      await db.update(vessels)
        .set({ vesselSequence: vesselSeq })
        .where(eq(vessels.vuuid, vesselId));
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
      duuid: randomUUID(),
    }).returning();
    return result[0];
  }

  async updateDefect(id: string, data: Partial<InsertDefect>): Promise<Defect> {
    const db = await getDb();
    const result = await db.update(defects)
      .set({ ...data, updatedAt: new Date() })
      .where(or(eq(defects.duuid, id), eq(defects.id, id)))
      .returning();
    if (!result[0]) {
      throw new Error(`Defect ${id} not found`);
    }
    return result[0];
  }

  async deleteDefect(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(defects).where(or(eq(defects.duuid, id), eq(defects.id, id)));
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
      .where(eq(defects.duuid, defect.duuid))
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
      .where(eq(defects.duuid, defect.duuid))
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
      .where(or(eq(defects.duuid, defectId), eq(defects.id, defectId)))
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
      .where(inArray(defects.duuid, defectIds))
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

  async getAlertPolicy(id: string): Promise<AlertPolicy | undefined> {
    const db = await getDb();
    const result = await db.select().from(alertPolicies).where(eq(alertPolicies.apuuid, id));
    return result[0];
  }

  async createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy> {
    const db = await getDb();
    const result = await db.insert(alertPolicies).values({
      ...policy,
      apuuid: randomUUID(),
    }).returning();
    return result[0];
  }

  async updateAlertPolicy(id: string, data: Partial<AlertPolicy>): Promise<AlertPolicy> {
    const db = await getDb();
    const result = await db.update(alertPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertPolicies.apuuid, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Alert policy ${id} not found`);
    }
    return result[0];
  }

  async deleteAlertPolicy(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(alertPolicies).where(eq(alertPolicies.apuuid, id));
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

  async getAlertEvent(id: string): Promise<AlertEvent | undefined> {
    const db = await getDb();
    const result = await db.select().from(alertEvents).where(eq(alertEvents.aeuuid, id));
    return result[0];
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    const db = await getDb();
    const result = await db.insert(alertEvents).values({
      ...event,
      aeuuid: randomUUID(),
    }).returning();
    return result[0];
  }

  async acknowledgeAlertEvent(id: string, userId: string): Promise<AlertEvent> {
    const db = await getDb();
    const result = await db.update(alertEvents)
      .set({ ackBy: userId, ackAt: new Date() })
      .where(eq(alertEvents.aeuuid, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Alert event ${id} not found`);
    }
    return result[0];
  }

  // ============= MODULE 10: ALERT DELIVERIES =============

  async getAlertDeliveries(eventId: string): Promise<AlertDelivery[]> {
    const db = await getDb();
    return await db.select().from(alertDeliveries)
      .where(eq(alertDeliveries.eventUuid, eventId))
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

  async getFormDefinition(id: string): Promise<FormDefinition | undefined> {
    const db = await getDb();
    const result = await db.select().from(formDefinitions)
      .where(eq(formDefinitions.fduuid, id));
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
    const result = await db.insert(formDefinitions).values({
      ...form,
      fduuid: randomUUID(),
    }).returning();
    return result[0];
  }

  // ============= MODULE 11: FORM VERSIONS =============

  async getFormVersions(formId: string): Promise<FormVersion[]> {
    const db = await getDb();
    return await db.select().from(formVersions)
      .where(eq(formVersions.formDefinitionUuid, formId))
      .orderBy(desc(formVersions.versionNo));
  }

  async getFormVersion(id: string): Promise<FormVersion | undefined> {
    const db = await getDb();
    const result = await db.select().from(formVersions)
      .where(eq(formVersions.fvuuid, id));
    return result[0];
  }

  async getLatestPublishedVersion(formId: string): Promise<FormVersion | undefined> {
    const db = await getDb();
    const result = await db.select().from(formVersions)
      .where(and(
        eq(formVersions.formDefinitionUuid, formId),
        eq(formVersions.status, 'PUBLISHED')
      ))
      .orderBy(desc(formVersions.versionNo))
      .limit(1);
    return result[0];
  }

  async getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined> {
    const form = await this.getFormDefinitionByName(name);
    if (!form) return undefined;
    return this.getLatestPublishedVersion(form.fduuid);
  }

  async createFormVersion(version: InsertFormVersion): Promise<FormVersion> {
    const db = await getDb();
    const result = await db.insert(formVersions).values({
      ...version,
      fvuuid: randomUUID(),
    }).returning();
    return result[0];
  }

  async updateFormVersion(id: string, data: Partial<FormVersion>): Promise<FormVersion> {
    const db = await getDb();
    const result = await db.update(formVersions)
      .set(data)
      .where(eq(formVersions.fvuuid, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Form version ${id} not found`);
    }
    return result[0];
  }

  async publishFormVersion(id: string, userId: string, changelog: string): Promise<FormVersion> {
    const db = await getDb();
    const result = await db.update(formVersions)
      .set({
        status: 'PUBLISHED',
        authorUserId: userId,
        changelog,
        versionDate: new Date()
      })
      .where(eq(formVersions.fvuuid, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Form version ${id} not found`);
    }
    return result[0];
  }

  async discardFormVersion(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(formVersions).where(eq(formVersions.fvuuid, id));
  }

  // ============= MODULE 11: FORM VERSION USAGE =============

  async createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage> {
    const db = await getDb();
    const result = await db.insert(formVersionUsage).values(usage).returning();
    return result[0];
  }

  async getFormVersionUsage(formVersionId: string): Promise<FormVersionUsage[]> {
    const db = await getDb();
    return await db.select().from(formVersionUsage)
      .where(eq(formVersionUsage.formVersionUuid, formVersionId));
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
    const db = await getDb();
    const existing = await this.getChangeRequest(id);
    if (!existing) throw new Error('Change request not found');
    
    const now = new Date();
    const newRevisionNumber = (existing.revisionNumber || 0) + 1;
    
    // Execute entire approval workflow within a single transaction
    // If any step fails, all changes are rolled back automatically
    try {
      const result = await db.transaction(async (tx) => {
        // Apply the proposed changes to the target entity within the transaction
        const appliedChangesResult = await this.applyApprovedChangesInTx(tx, existing);
        
        // Build revision history entry with applied status
        const revisionHistoryEntry = {
          revisionNumber: newRevisionNumber,
          approvedBy: reviewerId,
          approvedAt: now.toISOString(),
          appliedChanges: Array.isArray(existing.proposedChangesJson) ? existing.proposedChangesJson : [],
          appliedStatus: 'success' as const,
          appliedAt: now.toISOString(),
          appliedFieldCount: appliedChangesResult.appliedFieldCount,
          comments: comment
        };
        const updatedHistory = [...(existing.revisionHistory || []), revisionHistoryEntry];
        
        // Update the change request status within the same transaction
        const updateResult = await tx.update(changeRequest)
          .set({ 
            status: 'approved', 
            reviewedByUserId: reviewerId, 
            reviewedAt: now,
            revisionNumber: newRevisionNumber,
            revisionHistory: updatedHistory,
            updatedAt: now
          })
          .where(eq(changeRequest.id, id))
          .returning();
        
        if (!updateResult[0]) {
          throw new Error('Failed to update change request status');
        }
        
        return updateResult[0];
      });
      
      console.log(`[CR_APPLY] Successfully approved and applied CR ${id}`);
      return result;
    } catch (error: any) {
      console.error(`[CR_APPLY] Transaction failed for CR ${id}, all changes rolled back:`, error);
      // Transaction failed - all changes are automatically rolled back
      // Do NOT update the change request status here as that would be outside the transaction
      throw new Error(`Failed to approve change request: ${error.message}`);
    }
  }

  /**
   * Apply approved changes to the target PMS entity (non-transactional version)
   * Routes changes to the correct handler based on targetType
   * Note: For transactional safety, use applyApprovedChangesInTx instead
   */
  async applyApprovedChanges(changeRequest: ChangeRequest): Promise<{ appliedFieldCount: number }> {
    const db = await getDb();
    return this.applyApprovedChangesInTx(db, changeRequest);
  }

  /**
   * Apply approved changes within a transaction context
   * Routes changes to the correct handler based on targetType
   * All updates use the provided transaction for atomicity
   */
  private async applyApprovedChangesInTx(tx: any, changeRequest: ChangeRequest): Promise<{ appliedFieldCount: number }> {
    const { targetType, targetId, proposedChangesJson } = changeRequest;
    
    if (!targetType || !targetId) {
      console.log(`[CR_APPLY] No target specified for CR ${changeRequest.id}, skipping apply`);
      return { appliedFieldCount: 0 };
    }
    
    if (!proposedChangesJson || !Array.isArray(proposedChangesJson) || proposedChangesJson.length === 0) {
      console.log(`[CR_APPLY] No proposed changes for CR ${changeRequest.id}, skipping apply`);
      return { appliedFieldCount: 0 };
    }
    
    console.log(`[CR_APPLY] Applying ${proposedChangesJson.length} changes to ${targetType} ${targetId}`);
    
    // Build update object from proposed changes
    // Each change has structure: { id, field, oldValue, newValue, justification }
    // Handle both old-style nested field names (e.g., "componentInfo.serialNo") 
    // and new direct column names (e.g., "serialNo")
    const updateData: Record<string, any> = {};
    for (const change of proposedChangesJson as Array<{ field: string; newValue: any }>) {
      if (change.field && change.newValue !== undefined) {
        // Extract the actual column name from the field path
        // e.g., "componentInfo.serialNo" -> "serialNo"
        // e.g., "partName" -> "partName"
        const fieldPath = change.field;
        let columnName = fieldPath;
        
        // If field path contains a dot, extract the last segment as the column name
        if (fieldPath.includes('.')) {
          const segments = fieldPath.split('.');
          columnName = segments[segments.length - 1];
          console.log(`[CR_APPLY] Translated nested field "${fieldPath}" -> "${columnName}"`);
        }
        
        updateData[columnName] = change.newValue;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      console.log(`[CR_APPLY] No valid field updates extracted for CR ${changeRequest.id}`);
      return { appliedFieldCount: 0 };
    }
    
    // Route to appropriate update handler based on target type
    switch (targetType) {
      case 'component':
        await this.applyComponentChangesInTx(tx, targetId, updateData);
        break;
      case 'job':
        await this.applyJobChangesInTx(tx, targetId, updateData);
        break;
      case 'work_order':
        await this.applyWorkOrderChangesInTx(tx, targetId, updateData);
        break;
      case 'spare':
        await this.applySpareChangesInTx(tx, targetId, updateData);
        break;
      case 'store':
        await this.applyStoreChangesInTx(tx, targetId, updateData);
        break;
      default:
        console.warn(`[CR_APPLY] Unknown target type: ${targetType}`);
        throw new Error(`Unknown target type: ${targetType}`);
    }
    
    console.log(`[CR_APPLY] Successfully applied ${Object.keys(updateData).length} field changes to ${targetType} ${targetId}`);
    return { appliedFieldCount: Object.keys(updateData).length };
  }

  /**
   * Apply changes to a Component record within a transaction
   */
  private async applyComponentChangesInTx(tx: any, componentId: string, updateData: Record<string, any>): Promise<void> {
    // Verify component exists using dual-lookup (UUID or legacy ID)
    const existing = await tx.select().from(components).where(
      or(eq(components.cuuid, componentId), eq(components.id, componentId))
    );
    if (!existing[0]) {
      throw new Error(`Component ${componentId} not found`);
    }
    const beforeState = existing[0];
    const resolvedCuuid = beforeState.cuuid;

    // Filter out fields that shouldn't be updated directly
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.vesselId;

    if (Object.keys(safeUpdateData).length === 0) {
      console.log(`[CR_APPLY] Component ${componentId}: No valid fields to update`);
      return;
    }

    // Log before values for each field being updated
    console.log(`[CR_APPLY] Component ${componentId} (resolved cuuid: ${resolvedCuuid}) BEFORE update:`);
    for (const field of Object.keys(safeUpdateData)) {
      console.log(`  - ${field}: "${beforeState[field]}" -> "${safeUpdateData[field]}"`);
    }

    const result = await tx.update(components)
      .set({ ...safeUpdateData, updatedAt: new Date() })
      .where(eq(components.cuuid, resolvedCuuid))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Failed to update component ${componentId} - no rows returned`);
    }
    
    // Verify the update by comparing returned values
    const afterState = result[0];
    console.log(`[CR_APPLY] Component ${componentId} AFTER update:`);
    for (const field of Object.keys(safeUpdateData)) {
      const applied = afterState[field];
      const expected = safeUpdateData[field];
      const success = String(applied) === String(expected);
      console.log(`  - ${field}: "${applied}" (${success ? 'OK' : 'MISMATCH - expected: ' + expected})`);
      if (!success) {
        console.warn(`[CR_APPLY] WARNING: Field ${field} was not updated correctly`);
      }
    }
  }

  /**
   * Apply changes to a Job record within a transaction
   */
  private async applyJobChangesInTx(tx: any, jobId: string, updateData: Record<string, any>): Promise<void> {
    // Verify job exists using dual-lookup (UUID or legacy ID)
    const existing = await tx.select().from(jobs).where(
      or(eq(jobs.juuid, jobId), eq(jobs.id, jobId))
    );
    if (!existing[0]) {
      throw new Error(`Job ${jobId} not found`);
    }
    const beforeState = existing[0];
    const resolvedJuuid = beforeState.juuid;

    // Filter out fields that shouldn't be updated directly
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.vesselId;

    // Legacy field translations for jobs - UI uses different field names than schema
    // woTitle -> jobTitle (UI uses woTitle for display, schema uses jobTitle)
    if ('woTitle' in safeUpdateData) {
      console.log(`[CR_APPLY] Job field translation: woTitle -> jobTitle`);
      safeUpdateData.jobTitle = safeUpdateData.woTitle;
      delete safeUpdateData.woTitle;
    }

    // taskType -> maintenanceType (UI uses taskType, schema uses maintenanceType)
    if ('taskType' in safeUpdateData) {
      console.log(`[CR_APPLY] Job field translation: taskType -> maintenanceType`);
      safeUpdateData.maintenanceType = safeUpdateData.taskType;
      delete safeUpdateData.taskType;
    }

    // Remove any fields that don't exist in the jobs table schema
    const invalidFields = ['woTemplateCode', 'componentName', 'componentCode', 'nextDueReading'];
    for (const field of invalidFields) {
      if (field in safeUpdateData) {
        console.log(`[CR_APPLY] Removing invalid job field: ${field}`);
        delete safeUpdateData[field];
      }
    }

    if (Object.keys(safeUpdateData).length === 0) {
      console.log(`[CR_APPLY] Job ${jobId}: No valid fields to update`);
      return;
    }

    // Log before values for each field being updated
    console.log(`[CR_APPLY] Job ${jobId} (resolved juuid: ${resolvedJuuid}) BEFORE update:`);
    for (const field of Object.keys(safeUpdateData)) {
      console.log(`  - ${field}: "${beforeState[field]}" -> "${safeUpdateData[field]}"`);
    }

    const result = await tx.update(jobs)
      .set({ ...safeUpdateData, updatedAt: new Date() })
      .where(eq(jobs.juuid, resolvedJuuid))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Failed to update job ${jobId} - no rows returned`);
    }
    
    // Verify the update by comparing returned values
    const afterState = result[0];
    console.log(`[CR_APPLY] Job ${jobId} AFTER update:`);
    for (const field of Object.keys(safeUpdateData)) {
      const applied = afterState[field];
      const expected = safeUpdateData[field];
      const success = String(applied) === String(expected);
      console.log(`  - ${field}: "${applied}" (${success ? 'OK' : 'MISMATCH - expected: ' + expected})`);
    }
  }

  /**
   * Apply changes to a Work Order record within a transaction
   */
  private async applyWorkOrderChangesInTx(tx: any, workOrderId: string, updateData: Record<string, any>): Promise<void> {
    // Verify work order exists using dual-lookup (UUID or legacy ID)
    const existing = await tx.select().from(workOrders).where(
      or(eq(workOrders.wouuid, workOrderId), eq(workOrders.id, workOrderId))
    );
    if (!existing[0]) {
      throw new Error(`Work Order ${workOrderId} not found`);
    }
    const beforeState = existing[0];
    const resolvedWouuid = beforeState.wouuid;

    // Filter out fields that shouldn't be updated directly
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.vesselId;
    delete safeUpdateData.status; // Status changes should go through dedicated workflow

    if (Object.keys(safeUpdateData).length === 0) {
      console.log(`[CR_APPLY] Work Order ${workOrderId}: No valid fields to update`);
      return;
    }

    // Log before values for each field being updated
    console.log(`[CR_APPLY] Work Order ${workOrderId} (resolved wouuid: ${resolvedWouuid}) BEFORE update:`);
    for (const field of Object.keys(safeUpdateData)) {
      console.log(`  - ${field}: "${beforeState[field]}" -> "${safeUpdateData[field]}"`);
    }

    const result = await tx.update(workOrders)
      .set({ ...safeUpdateData, updatedAt: new Date() })
      .where(eq(workOrders.wouuid, resolvedWouuid))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Failed to update work order ${workOrderId} - no rows returned`);
    }
    
    // Verify the update by comparing returned values
    const afterState = result[0];
    console.log(`[CR_APPLY] Work Order ${workOrderId} AFTER update:`);
    for (const field of Object.keys(safeUpdateData)) {
      const applied = afterState[field];
      const expected = safeUpdateData[field];
      const success = String(applied) === String(expected);
      console.log(`  - ${field}: "${applied}" (${success ? 'OK' : 'MISMATCH - expected: ' + expected})`);
    }
  }

  /**
   * Apply changes to a Spare record within a transaction
   */
  private async applySpareChangesInTx(tx: any, spareId: string, updateData: Record<string, any>): Promise<void> {
    // Verify spare exists using dual-lookup (UUID or legacy integer ID)
    const numId = Number(spareId);
    const existing = await tx.select().from(spares).where(
      or(eq(spares.suuid, spareId), ...(Number.isInteger(numId) && numId > 0 ? [eq(spares.id, numId)] : []))
    );
    if (!existing[0]) {
      throw new Error(`Spare ${spareId} not found`);
    }
    const beforeState = existing[0];
    const resolvedSuuid = beforeState.suuid;

    // Filter out fields that shouldn't be updated directly
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.vesselId;

    // Handle ROB-related fields through proper methods if present
    const robFields = ['rob', 'robLocationA', 'robLocationB'];
    const hasRobChanges = robFields.some(f => f in safeUpdateData);

    if (hasRobChanges) {
      console.log(`[CR_APPLY] Spare ${spareId} has ROB changes - these require dedicated adjustment methods`);
      robFields.forEach(f => delete safeUpdateData[f]);
    }

    if (Object.keys(safeUpdateData).length === 0) {
      console.log(`[CR_APPLY] Spare ${spareId}: No valid fields to update`);
      return;
    }

    // Log before values for each field being updated
    console.log(`[CR_APPLY] Spare ${spareId} (resolved suuid: ${resolvedSuuid}) BEFORE update:`);
    for (const field of Object.keys(safeUpdateData)) {
      console.log(`  - ${field}: "${beforeState[field]}" -> "${safeUpdateData[field]}"`);
    }

    const result = await tx.update(spares)
      .set({ ...safeUpdateData, updatedAt: new Date() })
      .where(eq(spares.suuid, resolvedSuuid))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Failed to update spare ${spareId} - no rows returned`);
    }
    
    // Verify the update
    const afterState = result[0];
    console.log(`[CR_APPLY] Spare ${spareId} AFTER update:`);
    for (const field of Object.keys(safeUpdateData)) {
      const applied = afterState[field];
      const expected = safeUpdateData[field];
      const success = String(applied) === String(expected);
      console.log(`  - ${field}: "${applied}" (${success ? 'OK' : 'MISMATCH - expected: ' + expected})`);
    }
  }

  /**
   * Apply changes to a Store Item record within a transaction
   */
  private async applyStoreChangesInTx(tx: any, storeId: string, updateData: Record<string, any>): Promise<void> {
    // Verify store item exists using dual-lookup (UUID or legacy integer ID)
    const numId = Number(storeId);
    const existing = await tx.select().from(storesItems).where(
      or(eq(storesItems.stuuid, storeId), ...(Number.isInteger(numId) && numId > 0 ? [eq(storesItems.id, numId)] : []))
    );
    if (!existing[0]) {
      throw new Error(`Store item ${storeId} not found`);
    }
    const beforeState = existing[0];
    const resolvedStuuid = beforeState.stuuid;

    // Filter out fields that shouldn't be updated directly
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.vesselId;

    // Handle ROB-related fields through proper methods if present
    const robFields = ['rob', 'robLocationA', 'robLocationB'];
    const hasRobChanges = robFields.some(f => f in safeUpdateData);

    if (hasRobChanges) {
      console.log(`[CR_APPLY] Store ${storeId} has ROB changes - these require dedicated adjustment methods`);
      robFields.forEach(f => delete safeUpdateData[f]);
    }

    if (Object.keys(safeUpdateData).length === 0) {
      console.log(`[CR_APPLY] Store ${storeId}: No valid fields to update`);
      return;
    }

    // Log before values for each field being updated
    console.log(`[CR_APPLY] Store ${storeId} (resolved stuuid: ${resolvedStuuid}) BEFORE update:`);
    for (const field of Object.keys(safeUpdateData)) {
      console.log(`  - ${field}: "${beforeState[field]}" -> "${safeUpdateData[field]}"`);
    }

    const result = await tx.update(storesItems)
      .set({ ...safeUpdateData, updatedAt: new Date() })
      .where(eq(storesItems.stuuid, resolvedStuuid))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Failed to update store item ${storeId} - no rows returned`);
    }
    
    // Verify the update
    const afterState = result[0];
    console.log(`[CR_APPLY] Store ${storeId} AFTER update:`);
    for (const field of Object.keys(safeUpdateData)) {
      const applied = afterState[field];
      const expected = safeUpdateData[field];
      const success = String(applied) === String(expected);
      console.log(`  - ${field}: "${applied}" (${success ? 'OK' : 'MISMATCH - expected: ' + expected})`);
    }
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

  async removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string, jobId?: string): Promise<void> {
    const db = await getDb();
    const conditions = [
      eq(fleetJobVesselMapping.jobCode, jobCode),
      eq(fleetJobVesselMapping.vesselCode, vesselCode),
    ];
    if (jobId) {
      conditions.push(eq(fleetJobVesselMapping.jobId, jobId));
    }
    await db.update(fleetJobVesselMapping)
      .set({ isActive: false })
      .where(and(...conditions));
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

  async removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string, spareId?: string): Promise<void> {
    const db = await getDb();
    const conditions = [
      eq(fleetSpareVesselMapping.partCode, partCode),
      eq(fleetSpareVesselMapping.vesselCode, vesselCode),
    ];
    if (spareId) {
      conditions.push(eq(fleetSpareVesselMapping.spareId, spareId));
    }
    await db.update(fleetSpareVesselMapping)
      .set({ isActive: false })
      .where(and(...conditions));
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

  async getBulkImportHistoryItem(id: string): Promise<BulkImportHistory | undefined> {
    const db = await getDb();
    const result = await db.select().from(bulkImportHistory)
      .where(eq(bulkImportHistory.biuuid, id));
    return result[0];
  }

  async createBulkImportHistory(history: InsertBulkImportHistory): Promise<BulkImportHistory> {
    const db = await getDb();
    const result = await db.insert(bulkImportHistory).values({
      biuuid: randomUUID(),
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

  async updateBulkImportHistory(id: string, data: Partial<BulkImportHistory>): Promise<BulkImportHistory> {
    const db = await getDb();
    const result = await db.update(bulkImportHistory)
      .set(data)
      .where(eq(bulkImportHistory.biuuid, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Bulk Import History with id ${id} not found`);
    }
    return result[0];
  }

  async getBulkImportErrors(importId: string): Promise<BulkImportError[]> {
    const db = await getDb();
    return await db.select().from(bulkImportErrors)
      .where(eq(bulkImportErrors.importUuid, importId))
      .orderBy(asc(bulkImportErrors.rowNumber));
  }

  async createBulkImportError(error: InsertBulkImportError): Promise<BulkImportError> {
    const db = await getDb();
    const result = await db.insert(bulkImportErrors).values({
      importId: error.importId,
      importUuid: error.importUuid,
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

  // ============= SUPERINTENDENT NOTIFICATIONS (Layer 5) =============

  async createSuperintendentNotification(notification: InsertSuperintendentNotification): Promise<SuperintendentNotification> {
    const db = await getDb();
    const [result] = await db.insert(superintendentNotifications).values(notification).returning();
    return result;
  }

  async getSuperintendentNotifications(vesselName?: string): Promise<SuperintendentNotification[]> {
    const db = await getDb();
    const conditions = [eq(superintendentNotifications.isAcknowledged, false)];
    if (vesselName) {
      conditions.push(eq(superintendentNotifications.vesselName, vesselName));
    }
    return await db.select().from(superintendentNotifications)
      .where(and(...conditions))
      .orderBy(desc(superintendentNotifications.createdAt));
  }

  async getAllSuperintendentNotifications(vesselName?: string): Promise<SuperintendentNotification[]> {
    const db = await getDb();
    return await db.select().from(superintendentNotifications)
      .where(vesselName ? eq(superintendentNotifications.vesselName, vesselName) : undefined)
      .orderBy(desc(superintendentNotifications.createdAt));
  }

  async acknowledgeSuperintendentNotification(id: number): Promise<SuperintendentNotification> {
    const db = await getDb();
    const [result] = await db.update(superintendentNotifications)
      .set({ isAcknowledged: true, acknowledgedAt: new Date() })
      .where(eq(superintendentNotifications.id, id))
      .returning();
    return result;
  }

  // ============= WORK ORDER ANOMALIES (Layer 6) =============

  async createWorkOrderAnomaly(anomaly: InsertWorkOrderAnomaly): Promise<WorkOrderAnomaly> {
    const db = await getDb();
    const [result] = await db.insert(workOrderAnomalies).values(anomaly).returning();
    return result;
  }

  async getWorkOrderAnomalies(filters?: {
    status?: string;
    severity?: string;
    vesselId?: string;
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<WorkOrderAnomaly[]> {
    const db = await getDb();
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(workOrderAnomalies.status, filters.status));
    }
    if (filters?.severity) {
      conditions.push(eq(workOrderAnomalies.severity, filters.severity));
    }
    if (filters?.vesselId) {
      conditions.push(eq(workOrderAnomalies.vesselId, filters.vesselId));
    }
    if (filters?.dateFrom) {
      conditions.push(sql`${workOrderAnomalies.detectedAt} >= ${filters.dateFrom}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${workOrderAnomalies.detectedAt} <= ${filters.dateTo}`);
    }

    const query = db.select().from(workOrderAnomalies);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const results = whereClause
      ? await query.where(whereClause)
          .orderBy(
            sql`CASE ${workOrderAnomalies.severity} WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END`,
            desc(workOrderAnomalies.detectedAt)
          )
          .limit(filters?.limit || 50)
      : await query
          .orderBy(
            sql`CASE ${workOrderAnomalies.severity} WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END`,
            desc(workOrderAnomalies.detectedAt)
          )
          .limit(filters?.limit || 50);
    return results;
  }

  async getWorkOrderAnomalyByWorkOrderId(workOrderId: string): Promise<WorkOrderAnomaly[]> {
    const db = await getDb();
    return await db.select().from(workOrderAnomalies)
      .where(eq(workOrderAnomalies.workOrderId, workOrderId))
      .orderBy(desc(workOrderAnomalies.detectedAt));
  }

  async acknowledgeWorkOrderAnomaly(id: number, reviewedBy: string, notes?: string): Promise<WorkOrderAnomaly> {
    const db = await getDb();
    const [result] = await db.update(workOrderAnomalies)
      .set({
        status: 'ACKNOWLEDGED',
        reviewedBy,
        reviewedAt: new Date(),
        justification: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(workOrderAnomalies.id, id))
      .returning();
    return result;
  }

  async getWorkOrderAnomalyStatistics(vesselId?: string): Promise<{
    totalPending: number;
    totalHigh: number;
    totalMedium: number;
    totalLow: number;
    lastDetected: Date | null;
    trendPercentage: number;
  }> {
    const db = await getDb();
    const conditions: any[] = [];
    if (vesselId) {
      conditions.push(eq(workOrderAnomalies.vesselId, vesselId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const allAnomalies = whereClause
      ? await db.select().from(workOrderAnomalies).where(whereClause)
      : await db.select().from(workOrderAnomalies);

    const pending = allAnomalies.filter(a => a.status === 'PENDING_REVIEW');
    const lastDetected = allAnomalies.length > 0
      ? allAnomalies.reduce((latest, a) => {
          const d = a.detectedAt ? new Date(a.detectedAt) : new Date(0);
          return d > latest ? d : latest;
        }, new Date(0))
      : null;

    const now = new Date();
    const thisMonth = allAnomalies.filter(a => {
      const d = a.detectedAt ? new Date(a.detectedAt) : null;
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = allAnomalies.filter(a => {
      const d = a.detectedAt ? new Date(a.detectedAt) : null;
      return d && d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    }).length;
    const trendPercentage = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : thisMonth > 0 ? 100 : 0;

    return {
      totalPending: pending.length,
      totalHigh: pending.filter(a => a.severity === 'HIGH').length,
      totalMedium: pending.filter(a => a.severity === 'MEDIUM').length,
      totalLow: pending.filter(a => a.severity === 'LOW').length,
      lastDetected: lastDetected && lastDetected.getTime() > 0 ? lastDetected : null,
      trendPercentage,
    };
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

  // ============= WORK ORDER POSTPONEMENTS (History/Audit Table) =============

  async getWorkOrderPostponements(vesselId: string, filters?: { 
    workOrderId?: string; 
    status?: string; 
    dateFrom?: string; 
    dateTo?: string;
  }): Promise<WorkOrderPostponement[]> {
    const db = await getDb();
    
    const conditions: any[] = [eq(workOrderPostponements.vesselId, vesselId)];
    
    if (filters?.workOrderId) {
      conditions.push(eq(workOrderPostponements.workOrderId, filters.workOrderId));
    }
    if (filters?.status && filters.status !== 'All') {
      conditions.push(eq(workOrderPostponements.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(workOrderPostponements.submittedDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(workOrderPostponements.submittedDate, filters.dateTo));
    }
    
    return await db.select().from(workOrderPostponements)
      .where(and(...conditions))
      .orderBy(desc(workOrderPostponements.submittedDate));
  }

  async getWorkOrderPostponementById(id: string): Promise<WorkOrderPostponement | undefined> {
    const db = await getDb();
    const result = await db.select().from(workOrderPostponements)
      .where(eq(workOrderPostponements.id, id));
    return result[0];
  }

  async getWorkOrderPostponementsByWorkOrderId(workOrderId: string): Promise<WorkOrderPostponement[]> {
    const db = await getDb();
    return await db.select().from(workOrderPostponements)
      .where(eq(workOrderPostponements.workOrderId, workOrderId))
      .orderBy(desc(workOrderPostponements.postponementNumber));
  }

  async getWorkOrderPostponementCount(workOrderId: string): Promise<number> {
    const db = await getDb();
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(workOrderPostponements)
      .where(eq(workOrderPostponements.workOrderId, workOrderId));
    return Number(result[0]?.count || 0);
  }

  async createWorkOrderPostponement(postponement: InsertWorkOrderPostponement): Promise<WorkOrderPostponement> {
    const db = await getDb();
    const result = await db.insert(workOrderPostponements).values(postponement).returning();
    return result[0];
  }

  async updateWorkOrderPostponement(id: string, updates: Partial<InsertWorkOrderPostponement>): Promise<WorkOrderPostponement> {
    const db = await getDb();
    const { id: _, ...updateData } = updates as any;
    const result = await db.update(workOrderPostponements)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(workOrderPostponements.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`WorkOrderPostponement not found: ${id}`);
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
    userId?: string;
    userUuid?: string;
    meterReplaced?: boolean;
    oldMeterFinal?: string;
    newMeterStart?: string;
    isRenewalReset?: boolean;
    renewalActionType?: string;
    renewalReason?: string;
    renewalReference?: string;
    renewalEvidenceUrls?: string[];
  }): Promise<{ updatedComponents: number; auditsCreated: number; workOrdersGenerated: number; workOrders: any[] }> {
    const db = await getDb();
    const { parentComponentId, mode, value, dateUpdated, comments, userId, userUuid, meterReplaced, oldMeterFinal, newMeterStart, isRenewalReset, renewalActionType, renewalReason, renewalReference, renewalEvidenceUrls } = params;
    const now = new Date();
    
    // First resolve the parent component (dual-lookup: cuuid or legacy id)
    const parentResult = await db.select().from(components)
      .where(or(eq(components.cuuid, parentComponentId), eq(components.id, parentComponentId)))
      .limit(1);

    // Use resolved cuuid for all subsequent queries
    const resolvedParentId = parentResult.length > 0 ? parentResult[0].cuuid : parentComponentId;

    // Get all child components (by parentId - structural hierarchy)
    const children = await db.select().from(components)
      .where(or(eq(components.parentId, resolvedParentId), eq(components.parentId, parentComponentId)));
    
    let updatedComponents = 0;
    let auditsCreated = 0;
    let newRH = 0;
    
    if (parentResult.length > 0) {
      const parent = parentResult[0];
      const currentRH = parseFloat(parent.currentCumulativeRH || parent.rhCurrentMaster || '0');
      
      // VALIDATION 1: Date Rule - Check if entry date is not earlier than latest saved RH entry date
      const latestAudit = await db.select()
        .from(runningHoursAudit)
        .where(or(eq(runningHoursAudit.componentId, resolvedParentId), eq(runningHoursAudit.componentId, parentComponentId)))
        .orderBy(desc(runningHoursAudit.enteredAtUTC))
        .limit(1);
      
      if (latestAudit.length > 0) {
        const latestDate = latestAudit[0].dateUpdatedLocal;
        // Parse dates for comparison (format: DD-MMM-YYYY HH:mm)
        const parseDate = (dateStr: string): Date => {
          const months: Record<string, number> = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
          const parts = dateStr.match(/(\d{2})-([A-Za-z]{3})-(\d{4})\s*(\d{2})?:?(\d{2})?/);
          if (parts) {
            const [, day, month, year, hours = '00', minutes = '00'] = parts;
            return new Date(parseInt(year), months[month], parseInt(day), parseInt(hours), parseInt(minutes));
          }
          return new Date(dateStr);
        };
        
        const latestParsedDate = parseDate(latestDate);
        const newParsedDate = parseDate(dateUpdated);
        
        if (newParsedDate < latestParsedDate) {
          throw new Error(`Invalid date. You cannot add a Running Hours entry earlier than the latest saved entry date (${latestDate}).`);
        }
      }
      
      // VALIDATION 2: Value Rule - RH must never go backwards (except when isRenewalReset is true for 0)
      if (mode === 'setTotal' && value < currentRH && !isRenewalReset) {
        throw new Error(`Invalid Running Hours. Reading cannot be less than the last saved reading (Last: ${currentRH}).`);
      }
      
      // VALIDATION 3: When value is 0, isRenewalReset must be true
      if (mode === 'setTotal' && value === 0 && !isRenewalReset) {
        throw new Error('Running Hours cannot be set to 0 without confirming renewal/replacement.');
      }
      
      // Handle meter replacement logic
      // When meter is replaced, store the current cumulative total in meterReplacedLastRh
      // The new meter reading starts fresh, but Total = meterReplacedLastRh + new reading
      let previousTotalForReplacement = 0;
      if (meterReplaced) {
        // Calculate the previous total (existing meterReplacedLastRh + current reading)
        const existingMeterReplacedLastRh = parseFloat(parent.meterReplacedLastRh || '0');
        previousTotalForReplacement = existingMeterReplacedLastRh + currentRH;
        // The new meter starts at the provided value (usually 0 or initial reading of new meter)
        newRH = value;
      } else {
        newRH = mode === 'addDelta' ? currentRH + value : value;
      }
      
      // Build update object - always update currentCumulativeRH
      const updateData: any = { 
        currentCumulativeRH: newRH.toString(),
        lastUpdated: dateUpdated,
        updatedAt: now
      };
      
      // If meter was replaced, update the meter replacement tracking fields
      if (meterReplaced) {
        updateData.meterReplacedLastRh = previousTotalForReplacement.toString();
        updateData.meterReplacedDate = now;
      }
      
      // If this component is a MASTER type, also update rhCurrentMaster
      if (parent.rhCounterType === 'MASTER') {
        updateData.rhCurrentMaster = newRH.toString();
        updateData.rhMasterUpdatedAt = now;
        updateData.rhMasterUpdateSource = 'MANUAL';
      }
      
      await db.update(components)
        .set(updateData)
        .where(eq(components.cuuid, resolvedParentId));
      
      // Log audit for parent
      // Calculate the total cumulative RH (includes meter replacement history)
      const totalCumulativeRH = meterReplaced 
        ? previousTotalForReplacement + newRH 
        : (parseFloat(parent.meterReplacedLastRh || '0') + newRH);
      
      await db.insert(runningHoursAudit).values({
        vesselId: parent.vesselId || 'unknown',
        componentId: resolvedParentId,
        previousRH: currentRH.toString(),
        newRH: newRH.toString(),
        cumulativeRH: totalCumulativeRH.toString(),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: now,
        userId: userId || 'system',
        updatedByUuid: userUuid || null,
        source: 'cascade',
        notes: meterReplaced 
          ? `Meter replaced. Old meter final: ${oldMeterFinal || currentRH}. New meter start: ${newMeterStart || value}. ${comments || ''}`
          : comments,
        meterReplaced: meterReplaced || false,
        isRenewalReset: isRenewalReset || false,
        renewalActionType: renewalActionType || null,
        renewalReason: renewalReason || null,
        renewalReference: renewalReference || null,
        renewalEvidenceUrls: renewalEvidenceUrls || null,
        componentCode: parent.componentCode || null,
        componentName: parent.name || null,
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
                eq(components.rhMasterComponentId, resolvedParentId),
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
              .where(eq(components.cuuid, inherited.cuuid));
            
            // Log audit for inherited component
            await db.insert(runningHoursAudit).values({
              vesselId: inherited.vesselId || 'unknown',
              componentId: inherited.cuuid,
              previousRH: inheritedCurrentRH.toString(),
              newRH: newInheritedRH.toString(),
              cumulativeRH: newInheritedRH.toString(),
              dateUpdatedLocal: dateUpdated,
              dateUpdatedTZ: 'UTC',
              enteredAtUTC: now,
              userId: userId || 'system',
              updatedByUuid: userUuid || null,
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
        .where(eq(components.cuuid, child.cuuid));
      
      await db.insert(runningHoursAudit).values({
        vesselId: child.vesselId || 'unknown',
        componentId: child.cuuid,
        previousRH: childCurrentRH.toString(),
        newRH: childNewRH.toString(),
        cumulativeRH: childNewRH.toString(),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        enteredAtUTC: now,
        userId: userId || 'system',
        updatedByUuid: userUuid || null,
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
        .where(eq(components.cuuid, update.cuuid))
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
        .where(eq(components.cuuid, comp.cuuid))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(components)
          .set(comp)
          .where(eq(components.cuuid, comp.cuuid));
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
      .where(inArray(components.cuuid, ids))
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
      .where(or(eq(components.cuuid, id), eq(components.id, id)))
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
      .where(or(eq(jobs.juuid, id), eq(jobs.id, id)))
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
      .where(or(eq(workOrders.wouuid, id), eq(workOrders.id, id)))
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
            .where(eq(defects.duuid, defect.duuid));
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
    
    const jobIds = vesselJobs.map(j => j.juuid);
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
    
    // Import shared utilities for consistent blocking status checks
    const { isBlockingStatus } = await import('./utils/workOrderStatus');
    const { computeWorkOrderStatus } = await import('@shared/workOrders/status');
    const { WORK_ORDER_THRESHOLDS } = await import('@shared/workOrders/constants');
    const { generatePlannedWorkOrderNumber } = await import('./utils/workOrderNumbering');
    
    // Get the job
    const jobResult = await db.select().from(jobs)
      .where(eq(jobs.juuid, jobId))
      .limit(1);
    
    if (jobResult.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    const job = jobResult[0];
    
    // Determine the component code to use for WO number generation
    // Priority: activeComponentCode (from Section C context) > job.componentCode
    const componentCodeForWO = activeComponentCode || job.componentCode;
    
    if (!componentCodeForWO) {
      throw new Error(`Component code is required for work order generation. Job: ${jobId}`);
    }
    
    // ============= DUPLICATE PROTECTION (Rule #1) =============
    // Vessel-scoped check for existing blocking WOs for this job + component
    // Match behavior from auto-generation: check ALL WOs for vessel, not just isActive=true
    const allVesselWOs = job.vesselId 
      ? await db.select().from(workOrders).where(eq(workOrders.vesselId, job.vesselId))
      : await db.select().from(workOrders).where(eq(workOrders.jobId, jobId));
    
    // Find any blocking WO for this job + component combination
    const blockingWO = allVesselWOs.find(wo => {
      if (!isBlockingStatus(wo.status)) return false;
      
      // Match by jobId
      if (wo.jobId !== jobId) return false;
      
      // Match by componentCode (exact match, including both being null)
      const woComponentCode = wo.componentCode || null;
      const targetComponentCode = componentCodeForWO || null;
      return woComponentCode === targetComponentCode;
    });
    
    if (blockingWO) {
      throw new Error(`Work Order already exists for this job and component: ${blockingWO.workOrderNo}. Only one active work order is allowed per job-component combination.`);
    }
    
    // Resolve component details from activeComponentCode if provided
    let effectiveComponentCode = activeComponentCode || job.componentCode;
    let effectiveComponentName = job.componentName || '';
    let componentData: any = null;
    
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
        componentData = componentResult[0];
        effectiveComponentName = componentData.name || effectiveComponentName;
      }
    } else if (activeComponentCode) {
      const componentResult = await db.select().from(components)
        .where(eq(components.componentCode, activeComponentCode))
        .limit(1);
      if (componentResult.length > 0) {
        componentData = componentResult[0];
        effectiveComponentName = componentData.name || effectiveComponentName;
      }
    } else if (job.componentId) {
      const componentResult = await db.select().from(components)
        .where(eq(components.cuuid, job.componentId))
        .limit(1);
      if (componentResult.length > 0) {
        componentData = componentResult[0];
      }
    }
    
    // Get vessel PMS settings for lead time and grace period configuration
    let vesselSettings: PmsVesselSettings | null = null;
    if (job.vesselId) {
      const settingsResult = await db.select().from(pmsVesselSettings)
        .where(eq(pmsVesselSettings.vesselId, job.vesselId))
        .limit(1);
      if (settingsResult.length > 0) {
        vesselSettings = settingsResult[0];
      }
    }
    
    // Determine if job is critical (Critical or High priority)
    const isJobCritical = (job.jobPriority?.toLowerCase() === 'critical' || job.jobPriority?.toLowerCase() === 'high');
    
    // ============= BUILD CYCLE SNAPSHOTS AND RH FIELDS =============
    let cycleSnapshots: Partial<InsertWorkOrder> = {};
    let rhFields: Partial<InsertWorkOrder> = {};
    let dueRH: number | null = null;
    let currentRH: number | null = null;
    let rhLeadTimeHours: number | undefined = undefined;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (job.maintenanceBasis === 'Running Hours') {
      // Get lead time hours based on criticality (use centralized thresholds as fallback)
      rhLeadTimeHours = isJobCritical
        ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
        : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL);
      
      // Get current RH from component
      let rhEffectiveCurrent = 0;
      if (componentData) {
        const rhCounterType = componentData.rhCounterType;
        if (rhCounterType === 'MASTER') {
          rhEffectiveCurrent = parseFloat(componentData.rhCurrentMaster || '0');
        } else if (rhCounterType === 'INHERITED') {
          rhEffectiveCurrent = parseFloat(componentData.rhCurrentInheritedCached || '0');
        } else {
          rhEffectiveCurrent = parseFloat(componentData.runningHours || '0');
        }
      }
      
      // Calculate RH due
      const rhLastDone = parseFloat(job.lastDoneRH || '0');
      const frequencyRH = job.intervalRunningHour || 0;
      const rhDueValue = rhLastDone + frequencyRH;
      // Use FIXED 720-hour generation advance (business rule: generation is fixed, not vessel-driven)
      const rhGenerate = Math.max(0, rhDueValue - WORK_ORDER_THRESHOLDS.RH_GENERATION_ADVANCE_HOURS);
      
      dueRH = rhDueValue;
      currentRH = rhEffectiveCurrent;
      
      // Set RH cycle snapshots (matching auto-gen format)
      cycleSnapshots = {
        driverType: 'RH',
        cycleDueRhSnapshot: String(rhDueValue),
        generateRhSnapshot: String(rhGenerate),
        dueRhSnapshot: String(rhDueValue),
        effectiveRhAtGeneration: String(rhEffectiveCurrent),
        rhLastDoneSnapshot: String(rhLastDone),
      };
      
      rhFields = {
        nextDueReading: String(rhDueValue),
        currentReading: String(rhEffectiveCurrent),
        intervalRunningHour: job.intervalRunningHour,
      };
      
      console.log(`[Manual Generate WO] RH Job: RH_last_done=${rhLastDone}, F=${frequencyRH}, LT=${rhLeadTimeHours}hrs`);
      console.log(`   RH_due=${rhDueValue}, RH_current=${rhEffectiveCurrent}`);
      
    } else {
      // Calendar-based: compute cycle snapshots using fixed 30-day generation advance
      const dueDate = job.nextDueDate ? new Date(job.nextDueDate) : new Date();
      dueDate.setHours(0, 0, 0, 0);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // Use FIXED 30-day generation advance (business rule: generation is fixed, not vessel-driven)
      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - WORK_ORDER_THRESHOLDS.CALENDAR_GENERATION_ADVANCE_DAYS);
      const generateDateStr = generateDate.toISOString().split('T')[0];
      
      // Set Calendar cycle snapshots (matching auto-gen format)
      cycleSnapshots = {
        driverType: 'CALENDAR',
        cycleDueDateSnapshot: dueDateStr,
        generateDateSnapshot: generateDateStr,
        dueDateSnapshot: dueDateStr,
        lastDoneDateSnapshot: job.lastDoneDate || null,
      };
      
      console.log(`[Manual Generate WO] Calendar Job: due=${dueDateStr}, LT=${leadTimeDays}d`);
    }
    
    // ============= COMPUTE STATUS USING SHARED UTILITY =============
    // Build vessel grace settings for the shared status computation function
    const vesselGraceSettings = vesselSettings ? {
      calendarGraceMode: (vesselSettings.calendarGraceMode as 'COMPANY_STANDARD' | 'CUSTOM_DAYS') || 'COMPANY_STANDARD',
      calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
      rhLeadTimeHours: rhLeadTimeHours
    } : undefined;
    
    // Compute calendar lead time for status calculation (vessel-configured, for Planned → Due)
    const calendarLeadTimeDays = job.maintenanceBasis !== 'Running Hours' && vesselSettings
      ? (isJobCritical
          ? vesselSettings.calendarLeadDaysCritical
          : vesselSettings.calendarLeadDaysNonCritical)
      : undefined;

    // Use the shared computeWorkOrderStatus function for spec-compliant status
    const computedStatusResult = computeWorkOrderStatus({
      dueDate: job.nextDueDate,
      dueRH,
      currentRH,
      isExecution: false,
      status: undefined, // New WO, no existing status
      completionDateTime: null,
      maintenanceBasis: job.maintenanceBasis || undefined,
      vesselGraceSettings,
      rhLeadTimeHours,
      calendarLeadTimeDays
    });
    
    // Map computed status to database status field
    // The computeWorkOrderStatus returns: Active, Due, Due (Grace P), Overdue, Completed, Pending Approval, Rejected, Postponed
    // For new WOs, we want to use the timing-based status (Active, Due, Overdue)
    // Note: "Due (Grace P)" maps to "Due" in the database status field (grace is a display concept)
    let dbStatus: string;
    if (computedStatusResult === 'Due (Grace P)') {
      dbStatus = 'Due'; // Store as Due, grace is handled at display time
    } else {
      dbStatus = computedStatusResult;
    }
    
    console.log(`   Computed status: ${computedStatusResult} → DB status: ${dbStatus}`);
    
    // Generate WO number
    const workOrderNo = await generatePlannedWorkOrderNumber(this, job.jobNo, componentCodeForWO, job.vesselId || undefined);
    
    // Create the work order with proper status and cycle snapshots
    const newWorkOrder: InsertWorkOrder = {
      id: `WO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vesselId: job.vesselId,
      vesselName: job.vesselName || '',
      workOrderNo,
      templateCode: workOrderNo,
      jobId: job.juuid,
      jobTitle: job.jobTitle,
      component: effectiveComponentName,
      componentCode: effectiveComponentCode,
      status: dbStatus, // Use computed status from shared utility
      dueDate: job.nextDueDate || new Date().toISOString().split('T')[0],
      remarks: `On-demand work order generated. Reason: ${reason}`,
      isActive: true,
      workOrderType: 'Planned',
      maintenanceBasis: job.maintenanceBasis,
      taskType: job.maintenanceType,
      assignedTo: job.assignedTo || 'Unassigned',
      jobPriority: job.jobPriority,
      classRelated: job.classRelated,
      briefWorkDescription: job.briefWorkDescription,
      department: job.department,
      frequencyValue: job.frequencyValue?.toString(),
      frequencyUnit: job.frequencyUnit,
      requiredSpareParts: job.requiredSpareParts || [],
      requiredTools: job.requiredTools || [],
      safetyRequirements: job.safetyRequirements || {
        ppeRequirements: [],
        permitRequirements: [],
        otherRequirements: []
      },
      // Spread cycle snapshots and RH fields
      ...cycleSnapshots,
      ...rhFields,
    };
    
    const result = await db.insert(workOrders).values(newWorkOrder).returning();
    console.log(`✅ [Manual Generate WO] Created ${workOrderNo} with status: ${dbStatus}`);
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
          .where(eq(workOrders.wouuid, wo.wouuid))
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

  // ============= COMPANY STANDARD GRACE SETTINGS =============

  async getCompanyStandardGraceSettings(): Promise<CompanyStandardGraceSettings | undefined> {
    const db = await getDb();
    const result = await db.select().from(companyStandardGraceSettings).limit(1);
    return result[0];
  }

  async upsertCompanyStandardGraceSettings(settings: InsertCompanyStandardGraceSettings): Promise<CompanyStandardGraceSettings> {
    const db = await getDb();
    const existing = await db.select().from(companyStandardGraceSettings).limit(1);
    
    if (existing.length > 0) {
      const result = await db.update(companyStandardGraceSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(companyStandardGraceSettings.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(companyStandardGraceSettings).values(settings).returning();
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
      .where(eq(vessels.vuuid, vesselId))
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

  async findLocationStrict(vesselId: string, locationName: string): Promise<Location> {
    const existing = await this.getLocationByName(vesselId, locationName);
    if (!existing) {
      throw new Error(`Location "${locationName}" not found for this vessel. Please import or add the location first.`);
    }
    return existing;
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

  async deleteLocation(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(locations).where(eq(locations.id, id));
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

  async getSpareComponentLinkCountByVessel(vesselId: string): Promise<number> {
    const db = await getDb();
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(spareComponentLinks)
      .where(eq(spareComponentLinks.vesselId, vesselId));
    return Number(result[0]?.count ?? 0);
  }

  async getSpareComponentLinksByComponent(componentId: string): Promise<SpareComponentLink[]> {
    const db = await getDb();
    return await db.select().from(spareComponentLinks)
      .where(eq(spareComponentLinks.componentId, componentId));
  }

  async createSpareComponentLink(link: InsertSpareComponentLink, skipSiblingSync: boolean = false): Promise<SpareComponentLink> {
    const db = await getDb();

    try {
      const result = await db.insert(spareComponentLinks).values(link)
        .onConflictDoNothing({ target: [spareComponentLinks.spareId, spareComponentLinks.componentId, spareComponentLinks.vesselId] })
        .returning();

      if (result.length === 0) {
        const existing = await db.select().from(spareComponentLinks).where(
          and(
            eq(spareComponentLinks.spareId, link.spareId),
            eq(spareComponentLinks.componentId, link.componentId),
            eq(spareComponentLinks.vesselId, link.vesselId)
          )
        );
        return existing[0];
      }

      const created = result[0];

      if (!skipSiblingSync && link.componentId && link.vesselId) {
        try {
          await this.createSiblingLinks(link.spareId, link.spareUuid, link.componentId, link.vesselId, link.linkedBy);
        } catch (siblingError: any) {
          console.warn(`[createSpareComponentLink] Sibling sync failed for spare ${link.spareId}: ${siblingError.message}`);
        }
      }

      return created;
    } catch (insertError: any) {
      if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
        const existing = await db.select().from(spareComponentLinks).where(
          and(
            eq(spareComponentLinks.spareId, link.spareId),
            eq(spareComponentLinks.componentId, link.componentId),
            eq(spareComponentLinks.vesselId, link.vesselId)
          )
        );
        if (existing.length > 0) return existing[0];
      }
      throw insertError;
    }
  }

  async getComponentSiblings(componentId: string): Promise<Array<{ cuuid: string; name: string }>> {
    const db = await getDb();
    const comp = await db.select().from(components).where(
      or(eq(components.cuuid, componentId), eq(components.id, componentId))
    );
    if (!comp[0] || !comp[0].parentId) return [];

    const siblings = await db.select({ cuuid: components.cuuid, name: components.name })
      .from(components)
      .where(and(
        eq(components.parentId, comp[0].parentId),
        sql`${components.cuuid} != ${componentId}`
      ));
    return siblings;
  }

  private async createSiblingLinks(
    spareId: number, spareUuid: string, componentId: string,
    vesselId: string, linkedBy: string
  ): Promise<number> {
    const siblings = await this.getComponentSiblings(componentId);
    if (siblings.length === 0) return 0;

    const existingLinks = await this.getSpareComponentLinksBySpare(spareId);
    const existingCompIds = new Set(existingLinks.map(l => l.componentId));
    let created = 0;

    for (const sibling of siblings) {
      if (existingCompIds.has(sibling.cuuid)) continue;
      try {
        await this.createSpareComponentLink({
          spareId,
          spareUuid,
          componentId: sibling.cuuid,
          vesselId,
          linkedBy,
        }, true);
        created++;
      } catch (e: any) {
        if (!e.message?.includes('duplicate')) {
          console.warn(`[createSiblingLinks] Failed to link spare ${spareId} → sibling ${sibling.cuuid}: ${e.message}`);
        }
      }
    }
    return created;
  }

  async backfillSiblingLinks(vesselId: string): Promise<{ linksCreated: number; sparesProcessed: number; errors: number }> {
    const db = await getDb();

    const result = await db.execute(sql`
      WITH existing_links AS (
        SELECT scl.spare_id, scl.spare_uuid, scl.component_id, scl.vessel_id, c.parent_id
        FROM spare_component_links scl
        JOIN components c ON c.cuuid = scl.component_id
        WHERE scl.vessel_id = ${vesselId} AND c.parent_id IS NOT NULL
      ),
      sibling_pairs AS (
        SELECT DISTINCT
          el.spare_id, el.spare_uuid, sib.cuuid AS sibling_cuuid, el.vessel_id
        FROM existing_links el
        JOIN components sib ON sib.parent_id = el.parent_id AND sib.cuuid != el.component_id
        WHERE NOT EXISTS (
          SELECT 1 FROM spare_component_links x
          WHERE x.spare_id = el.spare_id AND x.component_id = sib.cuuid
        )
      ),
      inserted AS (
        INSERT INTO spare_component_links (spare_id, spare_uuid, component_id, vessel_id, linked_by)
        SELECT spare_id, spare_uuid, sibling_cuuid, vessel_id, 'system-sibling-backfill'
        FROM sibling_pairs
        ON CONFLICT (spare_id, component_id, vessel_id) DO NOTHING
        RETURNING spare_id
      )
      SELECT
        (SELECT COUNT(*) FROM inserted) AS links_created,
        (SELECT COUNT(DISTINCT spare_id) FROM existing_links) AS spares_processed
    `);

    const row = (result as any).rows?.[0] || (result as any)[0] || {};
    return {
      linksCreated: Number(row.links_created || 0),
      sparesProcessed: Number(row.spares_processed || 0),
      errors: 0,
    };
  }

  async deleteSpareComponentLink(spareId: number, componentId: string): Promise<void> {
    const db = await getDb();
    await db.delete(spareComponentLinks)
      .where(and(
        eq(spareComponentLinks.spareId, spareId),
        eq(spareComponentLinks.componentId, componentId)
      ));
  }

  async getLinkedComponentsForSpare(spareId: number, vesselId?: string): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>> {
    const db = await getDb();
    const conditions = [eq(spareComponentLinks.spareId, spareId)];
    if (vesselId) {
      conditions.push(eq(components.vesselId, vesselId));
    }
    const links = await db.select({
      componentId: spareComponentLinks.componentId,
      componentCode: components.componentCode,
      componentName: components.name,
    })
    .from(spareComponentLinks)
    .innerJoin(components, eq(spareComponentLinks.componentId, components.cuuid))
    .where(and(...conditions));
    
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

  async getAllJobComponentLinks(): Promise<JobComponentLink[]> {
    const db = await getDb();
    return await db.select().from(jobComponentLinks);
  }

  async getMaintenanceHistoryByJobAndComponent(jobId: string, componentCode: string): Promise<any[]> {
    const db = await getDb();
    
    // First try to match by jobId directly
    let results = await db.select().from(componentMaintenanceHistory)
      .where(and(
        eq(componentMaintenanceHistory.jobId, jobId),
        eq(componentMaintenanceHistory.componentCode, componentCode)
      ))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
    
    if (results.length > 0) return results;
    
    // Fallback: Match by jobNo in work_order_no (for legacy records without jobId)
    // WO format: "MKR-IN-00063-601.004.03-2026-001" -> jobNo is "MKR-IN-00063"
    const job = await db.select().from(jobs).where(eq(jobs.juuid, jobId)).limit(1);
    if (job.length === 0 || !job[0].jobNo) return [];
    
    const jobNo = job[0].jobNo;
    
    // Get all maintenance history for this component, then filter by jobNo match
    const allRecords = await db.select().from(componentMaintenanceHistory)
      .where(eq(componentMaintenanceHistory.componentCode, componentCode))
      .orderBy(desc(componentMaintenanceHistory.dateCompleted));
    
    // Filter records where work_order_no starts with the jobNo
    return allRecords.filter(record => {
      if (!record.workOrderNo) return false;
      // Work order format: "JOBNO-COMPCODE-YEAR-SEQ" 
      // e.g., "MKR-IN-00063-601.004.03-2026-001"
      // JobNo is at the start, before the component code
      return record.workOrderNo.startsWith(jobNo + '-');
    });
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

  async getLinkedComponentsForJob(jobId: string): Promise<Array<{ componentId: string; componentCode: string; componentName: string; lastDoneRH?: string | null; nextDueRH?: string | null }>> {
    const db = await getDb();
    const links = await db.select({
      componentId: jobComponentLinks.componentId,
      componentCode: components.componentCode,
      componentName: components.name,
      lastDoneRH: jobComponentLinks.lastDoneRH,
      nextDueRH: jobComponentLinks.nextDueRH,
    })
    .from(jobComponentLinks)
    .innerJoin(components, eq(jobComponentLinks.componentId, components.cuuid))
    .where(eq(jobComponentLinks.jobId, jobId));
    
    return links.map(l => ({
      componentId: l.componentId,
      componentCode: l.componentCode || '',
      componentName: l.componentName || '',
      lastDoneRH: l.lastDoneRH,
      nextDueRH: l.nextDueRH,
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
    .innerJoin(jobs, eq(jobComponentLinks.jobId, jobs.juuid))
    .where(eq(jobComponentLinks.componentId, componentId));
    
    return links.map(l => ({
      jobId: l.jobId,
      jobNo: l.jobNo || '',
      jobTitle: l.jobTitle || '',
    }));
  }

  // Component-specific tracking updates (prevents data mixing between components sharing the same job)
  // VESSEL ISOLATION: vesselId is REQUIRED to prevent cross-vessel data contamination
  async updateJobComponentLinkTracking(vesselId: string, jobId: string, componentId: string, updates: {
    lastDoneDate?: string;
    nextDueDate?: string;
    lastDoneRH?: string;
    nextDueRH?: string;
    updatedAt?: Date;
  }): Promise<JobComponentLink | null> {
    if (!vesselId) {
      throw new Error('vesselId is required for updateJobComponentLinkTracking to ensure vessel isolation');
    }
    const db = await getDb();
    const result = await db.update(jobComponentLinks)
      .set(updates)
      .where(and(
        eq(jobComponentLinks.vesselId, vesselId),
        eq(jobComponentLinks.jobId, jobId),
        eq(jobComponentLinks.componentId, componentId)
      ))
      .returning();
    return result[0] || null;
  }

  // VESSEL ISOLATION: vesselId is REQUIRED to prevent cross-vessel data contamination
  async getJobComponentLinkWithTracking(vesselId: string, jobId: string, componentId: string): Promise<JobComponentLink | null> {
    if (!vesselId) {
      throw new Error('vesselId is required for getJobComponentLinkWithTracking to ensure vessel isolation');
    }
    const db = await getDb();
    const result = await db.select().from(jobComponentLinks)
      .where(and(
        eq(jobComponentLinks.vesselId, vesselId),
        eq(jobComponentLinks.jobId, jobId),
        eq(jobComponentLinks.componentId, componentId)
      ));
    return result[0] || null;
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

  async getSpareLocationsWithQty(spareId: number, activeLocationNames?: string[]): Promise<Array<{ locationId: number; locationName: string; qty: number }>> {
    const db = await getDb();
    const result = await db.select({
      locationId: spareLocationStock.locationId,
      locationName: locations.locationName,
      qty: spareLocationStock.qty,
    })
    .from(spareLocationStock)
    .innerJoin(locations, eq(spareLocationStock.locationId, locations.id))
    .where(eq(spareLocationStock.spareId, spareId));
    
    if (activeLocationNames && activeLocationNames.length > 0) {
      const normalizedNames = activeLocationNames.map(n => n.toLowerCase().trim());
      return result.filter(r => normalizedNames.includes(r.locationName.toLowerCase().trim()));
    }
    
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
    .innerJoin(spares, eq(spareLocationStock.spareUuid, spares.suuid))
    .where(eq(spareLocationStock.locationId, locationId));
    
    return result;
  }

  async getFullSparesAtLocation(locationId: number, vesselId: string): Promise<any[]> {
    const db = await getDb();
    const result = await db.select({
      id: spares.id,
      partCode: spares.partCode,
      partName: spares.partName,
      componentId: spares.componentId,
      componentName: spares.componentName,
      componentCode: spares.componentCode,
      partNumber: spares.partNumber,
      critical: spares.critical,
      rob: spares.rob,
      min: spares.min,
      max: spares.max,
      location: spares.location,
      location2: spares.location2,
      robLocationA: spares.robLocationA,
      robLocationB: spares.robLocationB,
      vesselId: spares.vesselId,
      uom: spares.uom,
      ihm: spares.ihm,
      remarks: spares.remarks,
      criticality: spares.criticality,
      specification: spares.specification,
      maker: spares.maker,
      makerCode: spares.makerCode,
      drawingNumber: spares.drawingNumber,
      positionNumber: spares.positionNumber,
      note: spares.note,
      isActive: spares.isActive,
      locationQty: spareLocationStock.qty,
    })
    .from(spareLocationStock)
    .innerJoin(spares, eq(spareLocationStock.spareUuid, spares.suuid))
    .where(and(
      eq(spareLocationStock.locationId, locationId),
      eq(spares.vesselId, vesselId),
      gt(spareLocationStock.qty, 0)
    ));
    
    return result;
  }

  async getLocationsWithStock(vesselId: string): Promise<Array<{ id: number; locationName: string; sparesCount: number }>> {
    const db = await getDb();
    const result = await db.select({
      id: locations.id,
      locationName: locations.locationName,
      sparesCount: sql<number>`count(distinct ${spareLocationStock.spareId})`.as('spares_count'),
    })
    .from(spareLocationStock)
    .innerJoin(locations, eq(spareLocationStock.locationId, locations.id))
    .innerJoin(spares, eq(spareLocationStock.spareUuid, spares.suuid))
    .where(and(
      eq(spares.vesselId, vesselId),
      gt(spareLocationStock.qty, 0)
    ))
    .groupBy(locations.id, locations.locationName)
    .orderBy(asc(locations.locationName));
    
    return result;
  }

  // ============= INVENTORY MANAGEMENT: TRANSACTIONS =============

  async createInventoryTransaction(txn: InsertInventoryTransaction): Promise<InventoryTransaction> {
    return this.insertWithSequenceRepair('inventory_transactions', async () => {
      const db = await getDb();
      const result = await db.insert(inventoryTransactions).values(txn).returning();
      return result[0];
    });
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
    
    // Validate location exists
    const location = await this.getLocationById(input.locationId);
    if (!location) {
      throw new Error(`Location ${input.locationId} not found`);
    }
    
    // Get current stock levels — with auto-sync from legacy fields if no record exists
    let currentLocationStock = await this.getSpareLocationStockItem(input.spareId, input.locationId);
    
    if (!currentLocationStock) {
      const spareForSync = await db.select().from(spares).where(eq(spares.id, input.spareId));
      const spareLegacy = spareForSync[0];
      if (spareLegacy) {
        const locName = (location.locationName || '').toLowerCase().trim();
        const spareLegacyLocA = (spareLegacy.location || '').toLowerCase().trim();
        const spareLegacyLocB = (spareLegacy.location2 || '').toLowerCase().trim();
        
        let seedQty: number | null = null;
        if (spareLegacyLocA && locName === spareLegacyLocA) {
          seedQty = spareLegacy.robLocationA ?? 0;
        } else if (spareLegacyLocB && locName === spareLegacyLocB) {
          seedQty = spareLegacy.robLocationB ?? 0;
        } else if (spareLegacyLocA && !spareLegacyLocB) {
          seedQty = spareLegacy.robLocationA ?? 0;
        } else if (!spareLegacyLocA && spareLegacyLocB) {
          seedQty = spareLegacy.robLocationB ?? 0;
        } else if (!spareLegacyLocA && !spareLegacyLocB) {
          seedQty = spareLegacy.rob ?? 0;
        }
        
        if (seedQty !== null) {
          console.log(`[performInventoryTransaction] AUTO-SYNC: No spare_location_stock record for spare ${input.spareId} at location ${input.locationId}. Seeding from legacy ROB: ${seedQty}`);
          await this.upsertSpareLocationStock({
            vesselId: input.vesselId,
            spareId: input.spareId,
            spareUuid: spareLegacy.suuid,
            locationId: input.locationId,
            qty: seedQty,
          });
          currentLocationStock = await this.getSpareLocationStockItem(input.spareId, input.locationId);
        }
      }
    }
    
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
    const spareResult = await db.select().from(spares).where(eq(spares.id, input.spareId));
    const spare = spareResult[0];
    if (!spare) {
      throw new Error(`Spare ${input.spareId} not found`);
    }
    
    // Upsert location stock
    await this.upsertSpareLocationStock({
      vesselId: input.vesselId,
      spareId: input.spareId,
      spareUuid: spare.suuid,
      locationId: input.locationId,
      qty: newLocationQty,
    });
    
    // Create transaction record
    const transaction = await this.createInventoryTransaction({
      vesselId: input.vesselId,
      spareId: input.spareId,
      spareUuid: spare.suuid,
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
    
    // ========== CALCULATE LEGACY ROB VALUES FIRST ==========
    // Calculate these BEFORE creating history to ensure correct ROB After value
    // The legacy spares table (robLocationA, robLocationB) is the authoritative source for ROB
    // 
    // LOCATION MAPPING STRATEGY:
    // The vessel has exactly 2 fixed locations (A and B) as per business rules.
    // We use STRICT NAME MATCHING ONLY to ensure correct A/B designation:
    // - spare.location = text label for Location A
    // - spare.location2 = text label for Location B
    // If the transaction's location name matches one of these, we update that location's ROB.
    // If it matches neither, the transaction fails to prevent inventory corruption.
    
    const locationName = (location.locationName || '').toLowerCase().trim();
    const spareLocationA = (spare.location || '').toLowerCase().trim();
    const spareLocationB = (spare.location2 || '').toLowerCase().trim();
    
    // Determine which location (A or B) this transaction applies to using STRICT NAME MATCHING
    let targetLocation: 'A' | 'B' | null = null;
    
    if (spareLocationA && locationName === spareLocationA) {
      targetLocation = 'A';
    } else if (spareLocationB && locationName === spareLocationB) {
      targetLocation = 'B';
    }
    
    // Special case: If spare has only one location configured, use that
    if (!targetLocation) {
      if (spareLocationA && !spareLocationB) {
        // Spare only has Location A configured
        targetLocation = 'A';
        console.log(`[performInventoryTransaction] Spare ${input.spareId} has only Location A configured ("${spareLocationA}"). Using Location A.`);
      } else if (!spareLocationA && spareLocationB) {
        // Spare only has Location B configured
        targetLocation = 'B';
        console.log(`[performInventoryTransaction] Spare ${input.spareId} has only Location B configured ("${spareLocationB}"). Using Location B.`);
      } else if (!spareLocationA && !spareLocationB) {
        // Spare has no legacy locations configured - use A as default (backward compatibility)
        targetLocation = 'A';
        console.warn(`[performInventoryTransaction] Spare ${input.spareId} has no legacy locations configured. Defaulting to Location A.`);
      }
    }
    
    // If name matching failed and spare has both locations configured, fail the transaction
    // This is a data integrity safeguard - ambiguous location mapping must be resolved
    if (!targetLocation) {
      const errorMsg = `LOCATION_MAPPING_FAILED: Location name "${locationName}" does not match ` +
        `spare's configured locations: A="${spareLocationA}", B="${spareLocationB}". ` +
        `Please ensure location names are consistent between the locations table and spare configuration. ` +
        `Spare ID: ${input.spareId}, Location ID: ${input.locationId}.`;
      console.error(`[performInventoryTransaction] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // Calculate the new location-specific ROB values from legacy spares table (authoritative source)
    const currentRobA = spare.robLocationA ?? 0;
    const currentRobB = spare.robLocationB ?? 0;
    
    let newRobA = currentRobA;
    let newRobB = currentRobB;
    
    if (targetLocation === 'A') {
      newRobA = Math.max(0, currentRobA + input.qtyChange);
    } else {
      newRobB = Math.max(0, currentRobB + input.qtyChange);
    }
    
    // Total ROB is the sum of both locations (derived value) - THIS IS THE CORRECT ROB AFTER
    const calculatedTotalRob = newRobA + newRobB;
    
    // Consistency check: Verify the calculated total matches what we expect
    // This helps catch any discrepancies between the new inventory system and legacy fields
    if (calculatedTotalRob !== newTotalRob) {
      console.warn(`[performInventoryTransaction] CONSISTENCY_WARNING: Calculated legacy ROB (${calculatedTotalRob}) ` +
        `differs from new inventory system ROB (${newTotalRob}) for spare ${input.spareId}. ` +
        `Using legacy calculated value for data integrity.`);
    }
    // ========== END LEGACY ROB CALCULATION ==========
    
    // ========== UPDATE LEGACY ROB FIELDS FIRST ==========
    // Update legacy fields BEFORE creating history to ensure data consistency
    await db.update(spares)
      .set({ 
        rob: calculatedTotalRob,
        robLocationA: newRobA,
        robLocationB: newRobB,
        updatedAt: new Date(), 
        updatedBy: input.userId 
      })
      .where(eq(spares.id, input.spareId));
    
    console.log(`[performInventoryTransaction] Updated legacy ROB fields for spare ${input.spareId}: ` +
      `Location ${targetLocation} (${locationName}), ` +
      `robLocationA: ${currentRobA} → ${newRobA}, robLocationB: ${currentRobB} → ${newRobB}, ` +
      `total ROB: ${calculatedTotalRob}`);
    // ========== END LEGACY ROB UPDATE ==========
    
    // ========== CREATE SPARES HISTORY RECORD ==========
    // This ensures Work Order consumption (and all inventory transactions) appear in Spares History
    // IMPORTANT: Created AFTER legacy update to ensure consistency
    // Uses calculatedTotalRob (from legacy spares table) for robAfter, NOT newTotalRob
    try {
      // For reference field: prefer the referenceNote (contains WO number) over referenceId (internal ID)
      // referenceNote format: "WO Approval: WO-2024-001 - comments" or "Consumed during work approval"
      // Extract work order number from referenceNote if available, otherwise use referenceId
      let historyReference = input.referenceId ?? null;
      if (input.referenceNote) {
        // Extract WO number from note like "WO Approval: WO-2024-001 - ..."
        const woMatch = input.referenceNote.match(/WO[- ]?\d+[-/]?\d*/i);
        if (woMatch) {
          historyReference = woMatch[0]; // Use extracted WO number
        } else if (input.referenceType === 'WORK_ORDER') {
          historyReference = input.referenceNote; // Use the full note as reference
        }
      }
      
      await this.createSpareHistory({
        timestampUTC: new Date(),
        vesselId: input.vesselId,
        spareId: input.spareId,
        spareUuid: spare.suuid,
        partCode: spare.partCode ?? spare.componentSpareCode ?? `SP-${spare.id}`,
        partName: spare.partName,
        componentId: spare.componentId || '',
        componentCode: spare.componentCode ?? null,
        componentName: spare.componentName,
        componentSpareCode: spare.componentSpareCode ?? null,
        eventType: input.eventType, // 'CONSUME', 'RECEIVE', 'ADJUST', etc.
        qtyChange: input.qtyChange,
        robAfter: calculatedTotalRob, // Total ROB across all locations AFTER transaction (from authoritative legacy source)
        userId: input.userId,
        remarks: input.referenceNote ?? null, // Full note with details
        reference: historyReference, // Work Order number for display
        dateLocal: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        tz: null,
        place: location.locationName ?? null, // Storage location name
      });
      console.log(`[performInventoryTransaction] Created spares_history entry for spare ${input.spareId}, event: ${input.eventType}, qty: ${input.qtyChange}, robAfter: ${calculatedTotalRob}, ref: ${historyReference || 'N/A'}`);
    } catch (historyError) {
      // Log but don't fail the transaction if history creation fails
      console.error(`[performInventoryTransaction] Failed to create spares_history entry:`, historyError);
    }
    // ========== END SPARES HISTORY RECORD ==========
    
    return {
      transaction,
      newLocationQty,
      newTotalRob: calculatedTotalRob,
    };
  }

  async getSpareWithInventory(spareId: string): Promise<SpareWithInventory | null> {
    const spare = await this.getSpare(spareId);
    if (!spare) return null;
    
    const activeLocationNames = [spare.location, spare.location2].filter((n): n is string => !!n && n.trim() !== '');
    const locationsWithQty = activeLocationNames.length > 0
      ? await this.getSpareLocationsWithQty(spare.id, activeLocationNames)
      : [];
    const robTotal = locationsWithQty.reduce((sum, l) => sum + l.qty, 0);
    const linkedComponents = await this.getLinkedComponentsForSpare(spare.id, spare.vesselId || undefined);
    
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
      const withInventory = await this.getSpareWithInventory(spare.suuid);
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
        const withInventory = await this.getSpareWithInventory(spare.suuid);
        if (withInventory) {
          results.push(withInventory);
        }
      }
    }
    
    // Add linked spares (deduplicated)
    for (const link of links) {
      if (!spareIdSet.has(link.spareId)) {
        spareIdSet.add(link.spareId);
        // Look up spare by integer ID to get suuid for getSpareWithInventory
        const linkedSpareResult = await db.select().from(spares).where(eq(spares.id, link.spareId));
        const linkedSpare = linkedSpareResult[0];
        if (linkedSpare) {
          const withInventory = await this.getSpareWithInventory(linkedSpare.suuid);
          if (withInventory) {
            results.push(withInventory);
          }
        }
      }
    }

    return results;
  }

  async getSparesWithInventoryByComponentCode(vesselId: string, componentCode: string): Promise<SpareWithInventory[]> {
    const db = await getDb();
    
    // Get spares that match the componentCode for this vessel (direct assignment)
    const matchingSpares = await db.select().from(spares)
      .where(
        and(
          eq(spares.vesselId, vesselId),
          eq(spares.componentCode, componentCode)
        )
      );
    
    // Also get spares linked via spare_component_links by joining with components table
    // (spare_component_links has componentId, so we need to join with components to match by componentCode)
    const linkedSpares = await db.select({
      spareId: spareComponentLinks.spareId
    })
    .from(spareComponentLinks)
    .innerJoin(components, eq(spareComponentLinks.componentId, components.cuuid))
    .where(
      and(
        eq(components.componentCode, componentCode),
        eq(spareComponentLinks.vesselId, vesselId)
      )
    );
    
    const linkedSpareIds = new Set(linkedSpares.map(l => l.spareId));
    
    // Combine and deduplicate by spare ID
    const spareIdSet = new Set<number>();
    const results: SpareWithInventory[] = [];
    
    // Add direct spares first
    for (const spare of matchingSpares) {
      if (!spareIdSet.has(spare.id)) {
        spareIdSet.add(spare.id);
        const withInventory = await this.getSpareWithInventory(spare.suuid);
        if (withInventory) {
          results.push(withInventory);
        }
      }
    }
    
    // Add linked spares (deduplicated)
    for (const spareId of linkedSpareIds) {
      if (!spareIdSet.has(spareId)) {
        spareIdSet.add(spareId);
        // Look up spare by integer ID to get suuid for getSpareWithInventory
        const linkedSpareResult = await db.select().from(spares).where(eq(spares.id, spareId));
        const linkedSpare = linkedSpareResult[0];
        if (linkedSpare) {
          const withInventory = await this.getSpareWithInventory(linkedSpare.suuid);
          if (withInventory) {
            results.push(withInventory);
          }
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

  async getSpareInventoryByPartCodes(vesselId: string, partCodes: string[]): Promise<Map<string, { rob: number; robLocationA: number; robLocationB: number; partNumber: string | null }>> {
    const db = await getDb();
    const result = new Map<string, { rob: number; robLocationA: number; robLocationB: number; partNumber: string | null }>();
    
    if (!partCodes || partCodes.length === 0) {
      return result;
    }
    
    const matchingSpares = await db.select({
      partCode: spares.partCode,
      partNumber: spares.partNumber,
      rob: spares.rob,
      robLocationA: spares.robLocationA,
      robLocationB: spares.robLocationB
    })
    .from(spares)
    .where(
      and(
        eq(spares.vesselId, vesselId),
        inArray(spares.partCode, partCodes)
      )
    );
    
    for (const spare of matchingSpares) {
      result.set(spare.partCode, {
        rob: spare.rob,
        robLocationA: spare.robLocationA,
        robLocationB: spare.robLocationB,
        partNumber: spare.partNumber
      });
    }
    
    return result;
  }

  // RECONCILIATION: Resync normalized spare_location_stock from legacy ROB fields
  // This should be run to fix any data drift caused by previous sync failures
  async reconcileSpareLocationStock(vesselId: string, userId: string = 'System'): Promise<{ synced: number; errors: number }> {
    const db = await getDb();
    const sparesInVessel = await this.getSpares(vesselId);
    let synced = 0;
    let errors = 0;

    for (const spare of sparesInVessel) {
      try {
        const robA = spare.robLocationA ?? 0;
        const robB = spare.robLocationB ?? 0;

        await db.delete(spareLocationStock).where(eq(spareLocationStock.spareId, spare.id));

        let locationSynced = false;
        if (spare.location) {
          try {
            const locationAObj = await this.findLocationStrict(vesselId, spare.location);
            await db.insert(spareLocationStock).values({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationAObj.id, qty: robA });
            locationSynced = true;
          } catch (locErr: any) {
            console.warn(`[reconcileSpareLocationStock] Failed to sync Location A for spare ${spare.id}: ${locErr.message}`);
          }
        }
        if (spare.location2) {
          try {
            const locationBObj = await this.findLocationStrict(vesselId, spare.location2);
            await db.insert(spareLocationStock).values({ vesselId, spareId: spare.id, spareUuid: spare.suuid, locationId: locationBObj.id, qty: robB });
            locationSynced = true;
          } catch (locErr: any) {
            console.warn(`[reconcileSpareLocationStock] Failed to sync Location B for spare ${spare.id}: ${locErr.message}`);
          }
        }
        if (locationSynced) synced++;
      } catch (err: any) {
        console.warn(`[reconcileSpareLocationStock] Failed to sync spare ${spare.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`[reconcileSpareLocationStock] Vessel ${vesselId}: synced ${synced} spares, ${errors} errors`);
    return { synced, errors };
  }

  async getRoleByName(roleName: string): Promise<AdmnRoleMaster | undefined> {
    const db = await getDb();
    const result = await db
      .select()
      .from(admnRoleMaster)
      .where(and(eq(admnRoleMaster.assignedRole, roleName), eq(admnRoleMaster.isActive, true)));
    return result[0];
  }

  async getActiveRoles(): Promise<AdmnRoleMaster[]> {
    const db = await getDb();
    return db
      .select()
      .from(admnRoleMaster)
      .where(eq(admnRoleMaster.isActive, true))
      .orderBy(asc(admnRoleMaster.sortOrder));
  }

  async getActiveMenuItems(): Promise<AdmMenumasterAc[]> {
    const db = await getDb();
    return db
      .select()
      .from(admMenumasterAc)
      .where(eq(admMenumasterAc.isActive, true))
      .orderBy(asc(admMenumasterAc.sortOrder));
  }

  async getRoleMenuPermissions(roleRuid: string): Promise<AdmRoleMenuAccess[]> {
    const db = await getDb();
    return db
      .select()
      .from(admRoleMenuAccess)
      .where(eq(admRoleMenuAccess.roleRuid, roleRuid));
  }

  async saveRoleMenuPermissions(roleRuid: string, permissions: Array<{
    menuMuid: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>): Promise<{ count: number }> {
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(admRoleMenuAccess).where(eq(admRoleMenuAccess.roleRuid, roleRuid));
      if (permissions.length > 0) {
        const rows = permissions.map((p) => ({
          roleRuid,
          menuMuid: p.menuMuid,
          canView: p.canView ?? false,
          canCreate: p.canCreate ?? false,
          canEdit: p.canEdit ?? false,
          canDelete: p.canDelete ?? false,
          updatedAt: new Date(),
        }));
        await tx.insert(admRoleMenuAccess).values(rows);
      }
    });
    return { count: permissions.length };
  }
}

export const postgresStorage = new PostgresStorage();
