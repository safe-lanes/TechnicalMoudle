import type { IStorage } from './storage';
import { PersistentFileStorage } from './persistentStorage';
import { PostgresStorage } from './postgresStorage';
import { resolvePostgres } from './postgresClient';
import type {
  User,
  InsertUser,
  Fleet,
  InsertFleet,
  Vessel,
  InsertVessel,
  PmsVesselSettings,
  InsertPmsVesselSettings,
  Maker,
  InsertMaker,
  MasterList,
  InsertMasterList,
  MakerList,
  InsertMakerList,
  SfiDetails,
  InsertSfiDetails,
  MasterData,
  InsertMasterData,
  Component,
  InsertComponent,
  ComponentDocument,
  InsertComponentDocument,
  ComponentClassRegulatory,
  InsertComponentClassRegulatory,
  ComponentMaintenanceHistory,
  InsertComponentMaintenanceHistory,
  ComponentRequisition,
  InsertComponentRequisition,
  RunningHoursAudit,
  InsertRunningHoursAudit,
  Job,
  InsertJob,
  WorkOrder,
  InsertWorkOrder,
  Spare,
  InsertSpare,
  SpareHistory,
  InsertSpareHistory,
} from '@shared/schema';

/**
 * HybridStorage - Routes Module 1, 2, 3, 4 & 5 operations to PostgreSQL, everything else to File Storage
 * 
 * Module 1 entities (routed to PostgresStorage):
 * - users
 * - fleets  
 * - vessels
 * - pms_vessel_settings
 * 
 * Module 2 entities (routed to PostgresStorage):
 * - makers
 * - master_lists
 * - maker_list
 * - sfi_details
 * - master_data
 * 
 * Module 3 entities (routed to PostgresStorage):
 * - components (vessel & fleet)
 * - component_documents
 * - component_class_regulatory
 * - component_maintenance_history (IMMUTABLE - INSERT ONLY)
 * - component_requisitions
 * - running_hours_audit
 * 
 * Module 4 entities (routed to PostgresStorage):
 * - jobs (vessel & fleet)
 * 
 * Module 5 entities (routed to PostgresStorage):
 * - work_orders (vessel & fleet)
 * 
 * Module 7 entities (routed to PostgresStorage):
 * - spares (vessel & fleet)
 * - spares_history
 * 
 * All other entities continue to use PersistentFileStorage until their modules are migrated.
 */
export class HybridStorage implements IStorage {
  private fileStorage: PersistentFileStorage;
  private postgresStorage: PostgresStorage;
  private postgresAvailable: boolean = false;

  constructor() {
    this.fileStorage = new PersistentFileStorage('test-data.json');
    this.postgresStorage = new PostgresStorage();
    
    this.bindFileStorageMethods();
  }

  private bindFileStorageMethods(): void {
    const fs = this.fileStorage;
    
    // Module 3 methods (Components, Running Hours Audit) now have explicit PostgreSQL routing below
    // Keep only methods NOT migrated to PostgresStorage
    this.getRunningHourParents = fs.getRunningHourParents.bind(fs);
    this.cascadeRunningHoursUpdate = fs.cascadeRunningHoursUpdate.bind(fs);
    
    // Module 7 Spares methods - now have explicit PostgreSQL routing below
    // archiveSparesByIds remains in file storage for now (complex bulk operation)
    this.archiveSparesByIds = fs.archiveSparesByIds.bind(fs);
    
    this.getChangeRequests = fs.getChangeRequests.bind(fs);
    this.getChangeRequest = fs.getChangeRequest.bind(fs);
    this.createChangeRequest = fs.createChangeRequest.bind(fs);
    this.updateChangeRequest = fs.updateChangeRequest.bind(fs);
    this.updateChangeRequestTarget = fs.updateChangeRequestTarget.bind(fs);
    this.updateChangeRequestProposed = fs.updateChangeRequestProposed.bind(fs);
    this.deleteChangeRequest = fs.deleteChangeRequest.bind(fs);
    this.submitChangeRequest = fs.submitChangeRequest.bind(fs);
    this.approveChangeRequest = fs.approveChangeRequest.bind(fs);
    this.rejectChangeRequest = fs.rejectChangeRequest.bind(fs);
    this.returnChangeRequest = fs.returnChangeRequest.bind(fs);
    
    this.getChangeRequestAttachments = fs.getChangeRequestAttachments.bind(fs);
    this.createChangeRequestAttachment = fs.createChangeRequestAttachment.bind(fs);
    
    this.getChangeRequestComments = fs.getChangeRequestComments.bind(fs);
    this.createChangeRequestComment = fs.createChangeRequestComment.bind(fs);
    
    this.bulkCreateComponents = fs.bulkCreateComponents.bind(fs);
    this.bulkUpdateComponents = fs.bulkUpdateComponents.bind(fs);
    this.bulkUpsertComponents = fs.bulkUpsertComponents.bind(fs);
    // bulkCreateSpares, bulkUpdateSparesByROB, bulkUpsertSpares now have explicit PostgreSQL routing below
    this.archiveComponentsByIds = fs.archiveComponentsByIds.bind(fs);
    // archiveSparesByIds bound above with other spares methods
    
    this.getComponentsByCodes = fs.getComponentsByCodes.bind(fs);
    // getJobsByJobNos now has explicit PostgreSQL routing below
    // getWorkOrdersByTemplateIds now has explicit PostgreSQL routing below
    
    this.archiveComponent = fs.archiveComponent.bind(fs);
    this.archiveJob = fs.archiveJob.bind(fs);
    this.archiveWorkOrder = fs.archiveWorkOrder.bind(fs);
    
    this.getAlertPolicies = fs.getAlertPolicies.bind(fs);
    this.getAlertPolicy = fs.getAlertPolicy.bind(fs);
    this.createAlertPolicy = fs.createAlertPolicy.bind(fs);
    this.updateAlertPolicy = fs.updateAlertPolicy.bind(fs);
    this.deleteAlertPolicy = fs.deleteAlertPolicy.bind(fs);
    
    this.getAlertEvents = fs.getAlertEvents.bind(fs);
    this.getAlertEvent = fs.getAlertEvent.bind(fs);
    this.createAlertEvent = fs.createAlertEvent.bind(fs);
    this.acknowledgeAlertEvent = fs.acknowledgeAlertEvent.bind(fs);
    
    this.getAlertDeliveries = fs.getAlertDeliveries.bind(fs);
    this.createAlertDelivery = fs.createAlertDelivery.bind(fs);
    this.updateAlertDeliveryStatus = fs.updateAlertDeliveryStatus.bind(fs);
    
    this.getAlertConfig = fs.getAlertConfig.bind(fs);
    this.createOrUpdateAlertConfig = fs.createOrUpdateAlertConfig.bind(fs);
    
    this.getFormDefinitions = fs.getFormDefinitions.bind(fs);
    this.getFormDefinition = fs.getFormDefinition.bind(fs);
    this.getFormDefinitionByName = fs.getFormDefinitionByName.bind(fs);
    this.createFormDefinition = fs.createFormDefinition.bind(fs);
    
    this.getFormVersions = fs.getFormVersions.bind(fs);
    this.getFormVersion = fs.getFormVersion.bind(fs);
    this.getLatestPublishedVersion = fs.getLatestPublishedVersion.bind(fs);
    this.getLatestPublishedVersionByName = fs.getLatestPublishedVersionByName.bind(fs);
    this.createFormVersion = fs.createFormVersion.bind(fs);
    this.updateFormVersion = fs.updateFormVersion.bind(fs);
    this.publishFormVersion = fs.publishFormVersion.bind(fs);
    this.discardFormVersion = fs.discardFormVersion.bind(fs);
    
    this.createFormVersionUsage = fs.createFormVersionUsage.bind(fs);
    this.getFormVersionUsage = fs.getFormVersionUsage.bind(fs);
    
    this.seedForms = fs.seedForms.bind(fs);
    
    this.getIhmItem = fs.getIhmItem.bind(fs);
    this.upsertIhmItem = fs.upsertIhmItem.bind(fs);
    this.getIhmMaintenanceLog = fs.getIhmMaintenanceLog.bind(fs);
    this.createIhmMaintenanceLogEntry = fs.createIhmMaintenanceLogEntry.bind(fs);
    this.getIhmStatusReport = fs.getIhmStatusReport.bind(fs);
    
    // Module 3 methods (ComponentDocuments, ClassRegulatory, MaintenanceHistory, Requisitions)
    // now have explicit PostgreSQL routing below
    
    // Module 4 Jobs methods - now have explicit PostgreSQL routing below
    
    // Module 5 Work Orders methods - now have explicit PostgreSQL routing below
    
    this.getWorkOrderExecutions = fs.getWorkOrderExecutions.bind(fs);
    this.getWorkOrderExecutionById = fs.getWorkOrderExecutionById.bind(fs);
    this.createWorkOrderExecution = fs.createWorkOrderExecution.bind(fs);
    this.updateWorkOrderExecution = fs.updateWorkOrderExecution.bind(fs);
    
    this.getDefects = fs.getDefects.bind(fs);
    this.getDefectsCount = fs.getDefectsCount.bind(fs);
    this.getDefect = fs.getDefect.bind(fs);
    this.createDefect = fs.createDefect.bind(fs);
    this.updateDefect = fs.updateDefect.bind(fs);
    this.deleteDefect = fs.deleteDefect.bind(fs);
    
    this.getDefectActions = fs.getDefectActions.bind(fs);
    this.createDefectAction = fs.createDefectAction.bind(fs);
    this.updateDefectAction = fs.updateDefectAction.bind(fs);
    this.deleteDefectAction = fs.deleteDefectAction.bind(fs);
    
    this.getDefectAttachments = fs.getDefectAttachments.bind(fs);
    this.createDefectAttachment = fs.createDefectAttachment.bind(fs);
    this.deleteDefectAttachment = fs.deleteDefectAttachment.bind(fs);
    
    this.addDefectNote = fs.addDefectNote.bind(fs);
    this.linkDefects = fs.linkDefects.bind(fs);
    this.closeDefect = fs.closeDefect.bind(fs);
    
    this.getRecurringDefects = fs.getRecurringDefects.bind(fs);
    this.getRecurringDefect = fs.getRecurringDefect.bind(fs);
    this.calculateAndUpdateRecurringDefects = fs.calculateAndUpdateRecurringDefects.bind(fs);
    this.getRecurringDefectLinks = fs.getRecurringDefectLinks.bind(fs);
    this.getDefectsForRecurring = fs.getDefectsForRecurring.bind(fs);
    this.recalculateAllRecurringDefects = fs.recalculateAllRecurringDefects.bind(fs);
    
    this.getDefectBySeedId = fs.getDefectBySeedId.bind(fs);
    
    this.createImportHistory = fs.createImportHistory.bind(fs);
    this.getImportHistory = fs.getImportHistory.bind(fs);
    this.getImportHistoryById = fs.getImportHistoryById.bind(fs);
    this.updateImportHistory = fs.updateImportHistory.bind(fs);
    
    this.createImportChangeLog = fs.createImportChangeLog.bind(fs);
    this.getImportChangeLogs = fs.getImportChangeLogs.bind(fs);
    this.deleteImportChangeLogs = fs.deleteImportChangeLogs.bind(fs);
    
    // Module 2 methods (Makers, MasterLists) now have explicit PostgreSQL routing below
    
    this.purgeJobsAndLinkedData = fs.purgeJobsAndLinkedData.bind(fs);
    
    this.getStoresItems = fs.getStoresItems.bind(fs);
    this.getStoresItem = fs.getStoresItem.bind(fs);
    this.createStoresItem = fs.createStoresItem.bind(fs);
    this.updateStoresItem = fs.updateStoresItem.bind(fs);
    this.deleteStoresItem = fs.deleteStoresItem.bind(fs);
    this.consumeStoresItem = fs.consumeStoresItem.bind(fs);
    this.receiveStoresItem = fs.receiveStoresItem.bind(fs);
    this.getStoresTransactionHistory = fs.getStoresTransactionHistory.bind(fs);
    this.getStoresItemHistory = fs.getStoresItemHistory.bind(fs);
    
    this.getFleetVesselMappings = fs.getFleetVesselMappings.bind(fs);
    this.createFleetVesselMappings = fs.createFleetVesselMappings.bind(fs);
    this.deleteFleetVesselMapping = fs.deleteFleetVesselMapping.bind(fs);
    
    this.generateOnDemandWorkOrder = fs.generateOnDemandWorkOrder.bind(fs);
    this.checkAndRevertPostponedWorkOrders = fs.checkAndRevertPostponedWorkOrders.bind(fs);
    
    // Module 2 methods (MakerList, SfiDetails, MasterData) have explicit PostgreSQL routing below
    
    this.getFleetVesselMappingsByVessel = fs.getFleetVesselMappingsByVessel.bind(fs);
    this.createFleetVesselMappingRecord = fs.createFleetVesselMappingRecord.bind(fs);
    this.removeFleetVesselMappingRecord = fs.removeFleetVesselMappingRecord.bind(fs);
    
    this.getComponentVesselMappings = fs.getComponentVesselMappings.bind(fs);
    this.createComponentVesselMapping = fs.createComponentVesselMapping.bind(fs);
    this.deleteComponentVesselMapping = fs.deleteComponentVesselMapping.bind(fs);
    
    this.getFleetComponentMappings = fs.getFleetComponentMappings.bind(fs);
    this.getFleetComponentMappingsByVessel = fs.getFleetComponentMappingsByVessel.bind(fs);
    this.createFleetComponentMappingRecord = fs.createFleetComponentMappingRecord.bind(fs);
    this.removeFleetComponentMappingRecord = fs.removeFleetComponentMappingRecord.bind(fs);
    
    this.getFleetJobVesselMappings = fs.getFleetJobVesselMappings.bind(fs);
    this.createFleetJobVesselMappingRecord = fs.createFleetJobVesselMappingRecord.bind(fs);
    this.removeFleetJobVesselMappingRecord = fs.removeFleetJobVesselMappingRecord.bind(fs);
    
    this.getFleetSpareVesselMappings = fs.getFleetSpareVesselMappings.bind(fs);
    this.createFleetSpareVesselMappingRecord = fs.createFleetSpareVesselMappingRecord.bind(fs);
    this.removeFleetSpareVesselMappingRecord = fs.removeFleetSpareVesselMappingRecord.bind(fs);
    
    this.getBulkImportHistory = fs.getBulkImportHistory.bind(fs);
    this.getBulkImportHistoryItem = fs.getBulkImportHistoryItem.bind(fs);
    this.createBulkImportHistory = fs.createBulkImportHistory.bind(fs);
    this.updateBulkImportHistory = fs.updateBulkImportHistory.bind(fs);
    
    this.getBulkImportErrors = fs.getBulkImportErrors.bind(fs);
    this.createBulkImportError = fs.createBulkImportError.bind(fs);
    this.createBulkImportErrors = fs.createBulkImportErrors.bind(fs);
    
    this.getFleetAdminMetrics = fs.getFleetAdminMetrics.bind(fs);
    
    this.getCertificates = fs.getCertificates.bind(fs);
    this.getCertificate = fs.getCertificate.bind(fs);
    this.createCertificate = fs.createCertificate.bind(fs);
    this.updateCertificate = fs.updateCertificate.bind(fs);
    this.deleteCertificate = fs.deleteCertificate.bind(fs);
    
    this.getSurveys = fs.getSurveys.bind(fs);
    this.getSurvey = fs.getSurvey.bind(fs);
    this.createSurvey = fs.createSurvey.bind(fs);
    this.updateSurvey = fs.updateSurvey.bind(fs);
    this.deleteSurvey = fs.deleteSurvey.bind(fs);
    
    this.getVesselsByFleet = fs.getVesselsByFleet.bind(fs);
    this.getVesselsWithFleets = fs.getVesselsWithFleets.bind(fs);
  }

  async initialize(): Promise<boolean> {
    try {
      const postgres = await resolvePostgres();
      if (postgres) {
        this.postgresAvailable = true;
        console.log('✅ HybridStorage: PostgreSQL connection verified - Module 1 will use database');
        return true;
      }
      console.warn('⚠️ HybridStorage: PostgreSQL not available - falling back to file storage for all operations');
      return false;
    } catch (error: any) {
      console.error('❌ HybridStorage: PostgreSQL connection failed:', error.message);
      this.postgresAvailable = false;
      return false;
    }
  }

  // ============= MODULE 1: USERS (PostgreSQL) =============

  async getUser(id: number): Promise<User | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getUser(id);
    }
    return this.fileStorage.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getUserByUsername(username);
    }
    return this.fileStorage.getUserByUsername(username);
  }

  async createUser(user: InsertUser): Promise<User> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createUser(user);
    }
    return this.fileStorage.createUser(user);
  }

  async getUsers(): Promise<User[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getUsers();
    }
    return this.fileStorage.getUsers();
  }

  // ============= MODULE 1: FLEETS (PostgreSQL) =============

  async getAllFleets(): Promise<Fleet[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleets();
    }
    return this.fileStorage.getAllFleets();
  }

  async getFleets(): Promise<Fleet[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleets();
    }
    return this.fileStorage.getFleets();
  }

  async getFleetById(id: string): Promise<Fleet | undefined> {
    if (this.postgresAvailable) {
      const result = await this.postgresStorage.getFleet(id);
      return result ?? undefined;
    }
    return this.fileStorage.getFleetById(id);
  }

  async createFleet(fleet: InsertFleet): Promise<Fleet> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleet(fleet);
    }
    return this.fileStorage.createFleet(fleet);
  }

  async updateFleet(id: string, data: Partial<Fleet>): Promise<Fleet> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateFleet(id, data);
    }
    return this.fileStorage.updateFleet(id, data);
  }

  async deleteFleet(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteFleet(id);
    }
    return this.fileStorage.deleteFleet(id);
  }

  // ============= MODULE 1: VESSELS (PostgreSQL) =============

  async getVessels(): Promise<Array<{id: string, name: string, code: string}>> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getVessels();
    }
    return this.fileStorage.getVessels();
  }

  async getVesselIdByName(vesselName: string): Promise<string | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getVesselIdByName(vesselName);
    }
    return this.fileStorage.getVesselIdByName(vesselName);
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    if (this.postgresAvailable) {
      console.log('🗄️ [HybridStorage] Creating vessel in PostgreSQL:', vessel.name);
      return this.postgresStorage.createVessel(vessel);
    }
    return this.fileStorage.createVessel(vessel);
  }

  async updateVessel(id: string, data: Partial<Vessel>): Promise<Vessel> {
    if (this.postgresAvailable) {
      console.log('🗄️ [HybridStorage] Updating vessel in PostgreSQL:', id);
      return this.postgresStorage.updateVessel(id, data);
    }
    return this.fileStorage.updateVessel(id, data);
  }

  async assignVesselToFleet(vesselId: string, fleetId: string | null): Promise<Vessel> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateVessel(vesselId, { fleetId });
    }
    return this.fileStorage.assignVesselToFleet(vesselId, fleetId);
  }

  // ============= MODULE 1: PMS VESSEL SETTINGS (PostgreSQL) =============

  async getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getPmsVesselSettings(vesselId);
    }
    return this.fileStorage.getPmsVesselSettings(vesselId);
  }

  async getAllPmsVesselSettings(): Promise<PmsVesselSettings[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAllPmsVesselSettings();
    }
    return this.fileStorage.getAllPmsVesselSettings();
  }

  async createOrUpdatePmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    if (this.postgresAvailable) {
      return this.postgresStorage.upsertPmsVesselSettings(settings);
    }
    return this.fileStorage.createOrUpdatePmsVesselSettings(settings);
  }

  async deletePmsVesselSettings(vesselId: string): Promise<void> {
    if (this.postgresAvailable) {
      const settings = await this.postgresStorage.getPmsVesselSettings(vesselId);
      if (settings) {
        return this.postgresStorage.deletePmsVesselSettings(settings.id);
      }
      return;
    }
    return this.fileStorage.deletePmsVesselSettings(vesselId);
  }

  // ============= MODULE 2: MAKERS (PostgreSQL) =============

  async getMakers(search?: string): Promise<Maker[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMakers(search);
    }
    return this.fileStorage.getMakers(search);
  }

  async getMakerById(id: number): Promise<Maker | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMakerById(id);
    }
    return this.fileStorage.getMakerById(id);
  }

  async createMaker(maker: InsertMaker): Promise<Maker> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createMaker(maker);
    }
    return this.fileStorage.createMaker(maker);
  }

  async updateMaker(id: number, data: Partial<InsertMaker>): Promise<Maker> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateMaker(id, data);
    }
    return this.fileStorage.updateMaker(id, data);
  }

  async deleteMaker(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteMaker(id);
    }
    return this.fileStorage.deleteMaker(id);
  }

  // ============= MODULE 2: MASTER LISTS (PostgreSQL) =============

  async getMasterLists(listType?: string): Promise<MasterList[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterLists(listType);
    }
    return this.fileStorage.getMasterLists(listType);
  }

  async getMasterListById(id: number): Promise<MasterList | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterListById(id);
    }
    return this.fileStorage.getMasterListById(id);
  }

  async getMasterListsByType(listType: string): Promise<MasterList[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterListsByType(listType);
    }
    return this.fileStorage.getMasterListsByType(listType);
  }

  async createMasterList(list: InsertMasterList): Promise<MasterList> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createMasterList(list);
    }
    return this.fileStorage.createMasterList(list);
  }

  async updateMasterList(id: number, data: Partial<InsertMasterList>): Promise<MasterList> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateMasterList(id, data);
    }
    return this.fileStorage.updateMasterList(id, data);
  }

  async deleteMasterList(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteMasterList(id);
    }
    return this.fileStorage.deleteMasterList(id);
  }

  // ============= MODULE 2: MAKER LIST (PostgreSQL) =============

  async getMakerList(): Promise<MakerList[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMakerList();
    }
    return this.fileStorage.getMakerList();
  }

  async getMakerListItem(id: number): Promise<MakerList | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMakerListItem(id);
    }
    return this.fileStorage.getMakerListItem(id);
  }

  async getMakerListByCode(makerCode: string): Promise<MakerList | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMakerListByCode(makerCode);
    }
    return this.fileStorage.getMakerListByCode(makerCode);
  }

  async createMakerListItem(maker: InsertMakerList): Promise<MakerList> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createMakerListItem(maker);
    }
    return this.fileStorage.createMakerListItem(maker);
  }

  async updateMakerListItem(id: number, data: Partial<MakerList>): Promise<MakerList> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateMakerListItem(id, data);
    }
    return this.fileStorage.updateMakerListItem(id, data);
  }

  async deleteMakerListItem(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteMakerListItem(id);
    }
    return this.fileStorage.deleteMakerListItem(id);
  }

  // ============= MODULE 2: SFI DETAILS (PostgreSQL) =============

  async getSfiDetails(): Promise<SfiDetails[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSfiDetails();
    }
    return this.fileStorage.getSfiDetails();
  }

  async getSfiDetail(id: number): Promise<SfiDetails | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSfiDetail(id);
    }
    return this.fileStorage.getSfiDetail(id);
  }

  async getSfiByCode(componentCode: string): Promise<SfiDetails | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSfiByCode(componentCode);
    }
    return this.fileStorage.getSfiByCode(componentCode);
  }

  async createSfiDetail(sfi: InsertSfiDetails): Promise<SfiDetails> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createSfiDetail(sfi);
    }
    return this.fileStorage.createSfiDetail(sfi);
  }

  async updateSfiDetail(id: number, data: Partial<SfiDetails>): Promise<SfiDetails> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateSfiDetail(id, data);
    }
    return this.fileStorage.updateSfiDetail(id, data);
  }

  async deleteSfiDetail(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteSfiDetail(id);
    }
    return this.fileStorage.deleteSfiDetail(id);
  }

  // ============= MODULE 2: MASTER DATA (PostgreSQL) =============

  async getMasterDataList(): Promise<MasterData[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterDataList();
    }
    return this.fileStorage.getMasterDataList();
  }

  async getMasterDataItem(id: number): Promise<MasterData | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterDataItem(id);
    }
    return this.fileStorage.getMasterDataItem(id);
  }

  async getMasterDataByFleetCode(fleetEquipmentCode: string): Promise<MasterData | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterDataByFleetCode(fleetEquipmentCode);
    }
    return this.fileStorage.getMasterDataByFleetCode(fleetEquipmentCode);
  }

  async getMasterDataByMakerModel(makerCode: string, model: string): Promise<MasterData | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getMasterDataByMakerModel(makerCode, model);
    }
    return this.fileStorage.getMasterDataByMakerModel(makerCode, model);
  }

  async createMasterData(data: InsertMasterData): Promise<MasterData> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createMasterData(data);
    }
    return this.fileStorage.createMasterData(data);
  }

  async updateMasterData(id: number, data: Partial<MasterData>): Promise<MasterData> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateMasterData(id, data);
    }
    return this.fileStorage.updateMasterData(id, data);
  }

  async deleteMasterData(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteMasterData(id);
    }
    return this.fileStorage.deleteMasterData(id);
  }

  async generateFleetEquipmentCode(sfiCode: string): Promise<string> {
    if (this.postgresAvailable) {
      return this.postgresStorage.generateFleetEquipmentCode(sfiCode);
    }
    return this.fileStorage.generateFleetEquipmentCode(sfiCode);
  }

  // ============= MODULE 3: COMPONENTS (PostgreSQL) =============

  async getComponents(vesselId: string): Promise<Component[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponents(vesselId);
    }
    return this.fileStorage.getComponents(vesselId);
  }

  async getComponent(id: string): Promise<Component | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponent(id);
    }
    return this.fileStorage.getComponent(id);
  }

  async getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentByCode(componentCode, vesselId);
    }
    return this.fileStorage.getComponentByCode(componentCode, vesselId);
  }

  async createComponent(component: InsertComponent): Promise<Component> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createComponent(component);
    }
    return this.fileStorage.createComponent(component);
  }

  async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateComponent(id, data);
    }
    return this.fileStorage.updateComponent(id, data);
  }

  async deleteComponent(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteComponent(id);
    }
    return this.fileStorage.deleteComponent(id);
  }

  async inactivateComponent(id: string): Promise<Component> {
    if (this.postgresAvailable) {
      return this.postgresStorage.inactivateComponent(id);
    }
    return this.fileStorage.inactivateComponent(id);
  }

  // ============= MODULE 3: FLEET COMPONENTS (PostgreSQL) =============

  async getFleetComponents(): Promise<Component[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetComponents();
    }
    return this.fileStorage.getFleetComponents();
  }

  async getFleetComponent(id: string): Promise<Component | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetComponent(id);
    }
    return this.fileStorage.getFleetComponent(id);
  }

  async createFleetComponent(component: InsertComponent): Promise<Component> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetComponent(component);
    }
    return this.fileStorage.createFleetComponent(component);
  }

  async updateFleetComponent(id: string, data: Partial<Component>): Promise<Component> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateFleetComponent(id, data);
    }
    return this.fileStorage.updateFleetComponent(id, data);
  }

  async deleteFleetComponent(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteFleetComponent(id);
    }
    return this.fileStorage.deleteFleetComponent(id);
  }

  // ============= MODULE 3: COMPONENT DOCUMENTS (PostgreSQL) =============

  async getComponentDocuments(componentId: string): Promise<ComponentDocument[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentDocuments(componentId);
    }
    return this.fileStorage.getComponentDocuments(componentId);
  }

  async getComponentDocument(id: number): Promise<ComponentDocument | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentDocument(id);
    }
    return this.fileStorage.getComponentDocument(id);
  }

  async createComponentDocument(doc: InsertComponentDocument): Promise<ComponentDocument> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createComponentDocument(doc);
    }
    return this.fileStorage.createComponentDocument(doc);
  }

  async updateComponentDocument(id: number, data: Partial<ComponentDocument>): Promise<ComponentDocument> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateComponentDocument(id, data);
    }
    return this.fileStorage.updateComponentDocument(id, data);
  }

  async deleteComponentDocument(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteComponentDocument(id);
    }
    return this.fileStorage.deleteComponentDocument(id);
  }

  // ============= MODULE 3: COMPONENT CLASS REGULATORY (PostgreSQL) =============

  async getComponentClassRegulatory(componentId: string): Promise<ComponentClassRegulatory[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentClassRegulatory(componentId);
    }
    return this.fileStorage.getComponentClassRegulatory(componentId);
  }

  async getComponentClassRegulatoryItem(id: number): Promise<ComponentClassRegulatory | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentClassRegulatoryItem(id);
    }
    return this.fileStorage.getComponentClassRegulatoryItem(id);
  }

  async createComponentClassRegulatory(item: InsertComponentClassRegulatory): Promise<ComponentClassRegulatory> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createComponentClassRegulatory(item);
    }
    return this.fileStorage.createComponentClassRegulatory(item);
  }

  async updateComponentClassRegulatory(id: number, data: Partial<ComponentClassRegulatory>): Promise<ComponentClassRegulatory> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateComponentClassRegulatory(id, data);
    }
    return this.fileStorage.updateComponentClassRegulatory(id, data);
  }

  async deleteComponentClassRegulatory(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteComponentClassRegulatory(id);
    }
    return this.fileStorage.deleteComponentClassRegulatory(id);
  }

  // ============= MODULE 3: COMPONENT MAINTENANCE HISTORY (PostgreSQL - IMMUTABLE) =============

  async getAllComponentMaintenanceHistory(vesselCode?: string): Promise<ComponentMaintenanceHistory[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAllComponentMaintenanceHistory(vesselCode);
    }
    return this.fileStorage.getAllComponentMaintenanceHistory(vesselCode);
  }

  async getComponentMaintenanceHistory(componentId: string): Promise<ComponentMaintenanceHistory[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentMaintenanceHistory(componentId);
    }
    return this.fileStorage.getComponentMaintenanceHistory(componentId);
  }

  async getComponentMaintenanceHistoryItem(id: number): Promise<ComponentMaintenanceHistory | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentMaintenanceHistoryItem(id);
    }
    return this.fileStorage.getComponentMaintenanceHistoryItem(id);
  }

  async createComponentMaintenanceHistory(history: InsertComponentMaintenanceHistory): Promise<ComponentMaintenanceHistory> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createComponentMaintenanceHistory(history);
    }
    return this.fileStorage.createComponentMaintenanceHistory(history);
  }

  // ============= MODULE 3: COMPONENT REQUISITIONS (PostgreSQL) =============

  async getComponentRequisitions(componentId: string): Promise<ComponentRequisition[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentRequisitions(componentId);
    }
    return this.fileStorage.getComponentRequisitions(componentId);
  }

  async getAllComponentRequisitions(vesselCode?: string): Promise<ComponentRequisition[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAllComponentRequisitions(vesselCode);
    }
    return this.fileStorage.getAllComponentRequisitions(vesselCode);
  }

  async getComponentRequisitionItem(id: number): Promise<ComponentRequisition | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getComponentRequisitionItem(id);
    }
    return this.fileStorage.getComponentRequisitionItem(id);
  }

  async createComponentRequisition(item: InsertComponentRequisition): Promise<ComponentRequisition> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createComponentRequisition(item);
    }
    return this.fileStorage.createComponentRequisition(item);
  }

  async updateComponentRequisition(id: number, data: Partial<ComponentRequisition>): Promise<ComponentRequisition> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateComponentRequisition(id, data);
    }
    return this.fileStorage.updateComponentRequisition(id, data);
  }

  async deleteComponentRequisition(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteComponentRequisition(id);
    }
    return this.fileStorage.deleteComponentRequisition(id);
  }

  // ============= MODULE 3: RUNNING HOURS AUDIT (PostgreSQL) =============

  async createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createRunningHoursAudit(audit);
    }
    return this.fileStorage.createRunningHoursAudit(audit);
  }

  async getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getRunningHoursAudits(componentId, limit);
    }
    return this.fileStorage.getRunningHoursAudits(componentId, limit);
  }

  async getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<RunningHoursAudit[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getRunningHoursAuditsInDateRange(componentId, startDate, endDate);
    }
    return this.fileStorage.getRunningHoursAuditsInDateRange(componentId, startDate, endDate);
  }

  // ============= MODULE 4: JOBS (PostgreSQL) =============

  async getJobs(vesselId?: string, componentId?: string): Promise<Job[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getJobs(vesselId, componentId);
    }
    return this.fileStorage.getJobs(vesselId, componentId);
  }

  async getJob(id: string): Promise<Job | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getJob(id);
    }
    return this.fileStorage.getJob(id);
  }

  async createJob(job: InsertJob): Promise<Job> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createJob(job);
    }
    return this.fileStorage.createJob(job);
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateJob(id, data);
    }
    return this.fileStorage.updateJob(id, data);
  }

  async deleteJob(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteJob(id);
    }
    return this.fileStorage.deleteJob(id);
  }

  async bulkCreateJobs(jobList: InsertJob[]): Promise<Job[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkCreateJobs(jobList);
    }
    return this.fileStorage.bulkCreateJobs(jobList);
  }

  async bulkUpdateJobs(updates: Array<{ jobNo: string; data: Partial<Job> }>): Promise<Job[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpdateJobs(updates);
    }
    return this.fileStorage.bulkUpdateJobs(updates);
  }

  async bulkUpsertJobs(jobList: InsertJob[]): Promise<{ created: number; updated: number }> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpsertJobs(jobList);
    }
    return this.fileStorage.bulkUpsertJobs(jobList);
  }

  async getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, Job>> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getJobsByJobNos(jobNos, vesselId);
    }
    return this.fileStorage.getJobsByJobNos(jobNos, vesselId);
  }

  // Fleet Jobs
  async getFleetJobs(): Promise<Job[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetJobs();
    }
    return this.fileStorage.getFleetJobs();
  }

  async getFleetJob(id: string): Promise<Job | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetJob(id);
    }
    return this.fileStorage.getFleetJob(id);
  }

  async createFleetJob(job: InsertJob): Promise<Job> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetJob(job);
    }
    return this.fileStorage.createFleetJob(job);
  }

  async updateFleetJob(id: string, data: Partial<InsertJob>): Promise<Job> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateFleetJob(id, data);
    }
    return this.fileStorage.updateFleetJob(id, data);
  }

  async deleteFleetJob(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteFleetJob(id);
    }
    return this.fileStorage.deleteFleetJob(id);
  }

  // ============= MODULE 5: WORK ORDERS (PostgreSQL) =============

  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getWorkOrders(vesselId);
    }
    return this.fileStorage.getWorkOrders(vesselId);
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getWorkOrder(id);
    }
    return this.fileStorage.getWorkOrder(id);
  }

  async getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getWorkOrdersByJobId(jobId);
    }
    return this.fileStorage.getWorkOrdersByJobId(jobId);
  }

  async createWorkOrder(wo: InsertWorkOrder): Promise<WorkOrder> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createWorkOrder(wo);
    }
    return this.fileStorage.createWorkOrder(wo);
  }

  async updateWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateWorkOrder(id, data);
    }
    return this.fileStorage.updateWorkOrder(id, data);
  }

  async deleteWorkOrder(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteWorkOrder(id);
    }
    return this.fileStorage.deleteWorkOrder(id);
  }

  async bulkCreateWorkOrders(woList: InsertWorkOrder[]): Promise<WorkOrder[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkCreateWorkOrders(woList);
    }
    return this.fileStorage.bulkCreateWorkOrders(woList);
  }

  async bulkUpdateWorkOrders(updates: Array<{ workOrderNo: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpdateWorkOrders(updates);
    }
    return this.fileStorage.bulkUpdateWorkOrders(updates);
  }

  async bulkUpsertWorkOrders(woList: InsertWorkOrder[]): Promise<{ created: number; updated: number }> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpsertWorkOrders(woList);
    }
    return this.fileStorage.bulkUpsertWorkOrders(woList);
  }

  async getWorkOrdersByTemplateIds(templateIds: string[]): Promise<WorkOrder[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getWorkOrdersByTemplateIds(templateIds);
    }
    return this.fileStorage.getWorkOrdersByTemplateIds(templateIds);
  }

  // Fleet Work Orders
  async getFleetWorkOrders(): Promise<WorkOrder[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetWorkOrders();
    }
    return this.fileStorage.getFleetWorkOrders();
  }

  async getFleetWorkOrder(id: string): Promise<WorkOrder | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetWorkOrder(id);
    }
    return this.fileStorage.getFleetWorkOrder(id);
  }

  async createFleetWorkOrder(wo: InsertWorkOrder): Promise<WorkOrder> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetWorkOrder(wo);
    }
    return this.fileStorage.createFleetWorkOrder(wo);
  }

  async updateFleetWorkOrder(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateFleetWorkOrder(id, data);
    }
    return this.fileStorage.updateFleetWorkOrder(id, data);
  }

  async deleteFleetWorkOrder(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteFleetWorkOrder(id);
    }
    return this.fileStorage.deleteFleetWorkOrder(id);
  }

  // ============= MODULE 7: SPARES (PostgreSQL) =============

  async getAllSpares(): Promise<Spare[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAllSpares();
    }
    return this.fileStorage.getAllSpares();
  }

  async getSpares(vesselId: string): Promise<Spare[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSpares(vesselId);
    }
    return this.fileStorage.getSpares(vesselId);
  }

  async getSpare(id: number): Promise<Spare | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSpare(id);
    }
    return this.fileStorage.getSpare(id);
  }

  async createSpare(spare: InsertSpare): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createSpare(spare);
    }
    return this.fileStorage.createSpare(spare);
  }

  async updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateSpare(id, data);
    }
    return this.fileStorage.updateSpare(id, data);
  }

  async deleteSpare(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteSpare(id);
    }
    return this.fileStorage.deleteSpare(id);
  }

  async consumeSpare(id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.consumeSpare(id, quantity, userId, remarks, place, dateLocal, tz);
    }
    return this.fileStorage.consumeSpare(id, quantity, userId, remarks, place, dateLocal, tz);
  }

  async consumeSpareFromLocation(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.consumeSpareFromLocation(id, quantity, location, userId, remarks, place, dateLocal, tz);
    }
    return this.fileStorage.consumeSpareFromLocation(id, quantity, location, userId, remarks, place, dateLocal, tz);
  }

  async receiveSpare(id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.receiveSpare(id, quantity, userId, remarks, supplierPO, place, dateLocal, tz);
    }
    return this.fileStorage.receiveSpare(id, quantity, userId, remarks, supplierPO, place, dateLocal, tz);
  }

  async bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpdateSpares(updates, userId, remarks);
    }
    return this.fileStorage.bulkUpdateSpares(updates, userId, remarks);
  }

  async adjustSpareQuantity(id: number, newRob: number, newRobA: number, newRobB: number, userId: string, remarks?: string): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.adjustSpareQuantity(id, newRob, newRobA, newRobB, userId, remarks);
    }
    return this.fileStorage.adjustSpareQuantity(id, newRob, newRobA, newRobB, userId, remarks);
  }

  // Fleet Spares
  async getFleetSpares(): Promise<Spare[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetSpares();
    }
    return this.fileStorage.getFleetSpares();
  }

  async getFleetSpare(id: number): Promise<Spare | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetSpare(id);
    }
    return this.fileStorage.getFleetSpare(id);
  }

  async createFleetSpare(spare: InsertSpare): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetSpare(spare);
    }
    return this.fileStorage.createFleetSpare(spare);
  }

  async updateFleetSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateFleetSpare(id, data);
    }
    return this.fileStorage.updateFleetSpare(id, data);
  }

  async deleteFleetSpare(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteFleetSpare(id);
    }
    return this.fileStorage.deleteFleetSpare(id);
  }

  // Bulk Spares Operations
  async bulkCreateSpares(sparesList: InsertSpare[]): Promise<Spare[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkCreateSpares(sparesList);
    }
    return this.fileStorage.bulkCreateSpares(sparesList);
  }

  async bulkUpdateSparesByROB(updates: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpdateSparesByROB(updates);
    }
    return this.fileStorage.bulkUpdateSparesByROB(updates);
  }

  async bulkUpsertSpares(sparesList: InsertSpare[]): Promise<{ created: number; updated: number }> {
    if (this.postgresAvailable) {
      return this.postgresStorage.bulkUpsertSpares(sparesList);
    }
    return this.fileStorage.bulkUpsertSpares(sparesList);
  }

  // Spares History
  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSpareHistory(vesselId);
    }
    return this.fileStorage.getSpareHistory(vesselId);
  }

  async getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getSpareHistoryBySpareId(spareId);
    }
    return this.fileStorage.getSpareHistoryBySpareId(spareId);
  }

  async createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createSpareHistory(history);
    }
    return this.fileStorage.createSpareHistory(history);
  }

  // ============= DELEGATED METHODS (File Storage) =============
  // These are assigned in bindFileStorageMethods() and will be migrated
  // to PostgresStorage in future modules
  
  // Module 3: Methods NOT in PostgresStorage (remain delegated)
  getRunningHourParents!: IStorage['getRunningHourParents'];
  cascadeRunningHoursUpdate!: IStorage['cascadeRunningHoursUpdate'];
  
  // Module 7: Spares - now have explicit PostgreSQL routing above
  // archiveSparesByIds remains delegated (bound in bindFileStorageMethods)
  
  getChangeRequests!: IStorage['getChangeRequests'];
  getChangeRequest!: IStorage['getChangeRequest'];
  createChangeRequest!: IStorage['createChangeRequest'];
  updateChangeRequest!: IStorage['updateChangeRequest'];
  updateChangeRequestTarget!: IStorage['updateChangeRequestTarget'];
  updateChangeRequestProposed!: IStorage['updateChangeRequestProposed'];
  deleteChangeRequest!: IStorage['deleteChangeRequest'];
  submitChangeRequest!: IStorage['submitChangeRequest'];
  approveChangeRequest!: IStorage['approveChangeRequest'];
  rejectChangeRequest!: IStorage['rejectChangeRequest'];
  returnChangeRequest!: IStorage['returnChangeRequest'];
  
  getChangeRequestAttachments!: IStorage['getChangeRequestAttachments'];
  createChangeRequestAttachment!: IStorage['createChangeRequestAttachment'];
  
  getChangeRequestComments!: IStorage['getChangeRequestComments'];
  createChangeRequestComment!: IStorage['createChangeRequestComment'];
  
  bulkCreateComponents!: IStorage['bulkCreateComponents'];
  bulkUpdateComponents!: IStorage['bulkUpdateComponents'];
  bulkUpsertComponents!: IStorage['bulkUpsertComponents'];
  // bulkCreateSpares, bulkUpdateSparesByROB, bulkUpsertSpares - now have explicit PostgreSQL routing above
  archiveComponentsByIds!: IStorage['archiveComponentsByIds'];
  archiveSparesByIds!: IStorage['archiveSparesByIds'];
  
  getComponentsByCodes!: IStorage['getComponentsByCodes'];
  getJobsByJobNos!: IStorage['getJobsByJobNos'];
  // getWorkOrdersByTemplateIds - now has explicit PostgreSQL routing above
  
  archiveComponent!: IStorage['archiveComponent'];
  archiveJob!: IStorage['archiveJob'];
  archiveWorkOrder!: IStorage['archiveWorkOrder'];
  
  getAlertPolicies!: IStorage['getAlertPolicies'];
  getAlertPolicy!: IStorage['getAlertPolicy'];
  createAlertPolicy!: IStorage['createAlertPolicy'];
  updateAlertPolicy!: IStorage['updateAlertPolicy'];
  deleteAlertPolicy!: IStorage['deleteAlertPolicy'];
  
  getAlertEvents!: IStorage['getAlertEvents'];
  getAlertEvent!: IStorage['getAlertEvent'];
  createAlertEvent!: IStorage['createAlertEvent'];
  acknowledgeAlertEvent!: IStorage['acknowledgeAlertEvent'];
  
  getAlertDeliveries!: IStorage['getAlertDeliveries'];
  createAlertDelivery!: IStorage['createAlertDelivery'];
  updateAlertDeliveryStatus!: IStorage['updateAlertDeliveryStatus'];
  
  getAlertConfig!: IStorage['getAlertConfig'];
  createOrUpdateAlertConfig!: IStorage['createOrUpdateAlertConfig'];
  
  getFormDefinitions!: IStorage['getFormDefinitions'];
  getFormDefinition!: IStorage['getFormDefinition'];
  getFormDefinitionByName!: IStorage['getFormDefinitionByName'];
  createFormDefinition!: IStorage['createFormDefinition'];
  
  getFormVersions!: IStorage['getFormVersions'];
  getFormVersion!: IStorage['getFormVersion'];
  getLatestPublishedVersion!: IStorage['getLatestPublishedVersion'];
  getLatestPublishedVersionByName!: IStorage['getLatestPublishedVersionByName'];
  createFormVersion!: IStorage['createFormVersion'];
  updateFormVersion!: IStorage['updateFormVersion'];
  publishFormVersion!: IStorage['publishFormVersion'];
  discardFormVersion!: IStorage['discardFormVersion'];
  
  createFormVersionUsage!: IStorage['createFormVersionUsage'];
  getFormVersionUsage!: IStorage['getFormVersionUsage'];
  
  seedForms!: IStorage['seedForms'];
  
  getIhmItem!: IStorage['getIhmItem'];
  upsertIhmItem!: IStorage['upsertIhmItem'];
  getIhmMaintenanceLog!: IStorage['getIhmMaintenanceLog'];
  createIhmMaintenanceLogEntry!: IStorage['createIhmMaintenanceLogEntry'];
  getIhmStatusReport!: IStorage['getIhmStatusReport'];
  
  // Module 3 methods (ComponentDocuments, ClassRegulatory, MaintenanceHistory, Requisitions)
  // are now explicitly routed to PostgresStorage above
  
  // Module 4: Jobs - now have explicit PostgreSQL routing above
  // Module 5: Work Orders - now have explicit PostgreSQL routing above
  
  getWorkOrderExecutions!: IStorage['getWorkOrderExecutions'];
  getWorkOrderExecutionById!: IStorage['getWorkOrderExecutionById'];
  createWorkOrderExecution!: IStorage['createWorkOrderExecution'];
  updateWorkOrderExecution!: IStorage['updateWorkOrderExecution'];
  
  getDefects!: IStorage['getDefects'];
  getDefectsCount!: IStorage['getDefectsCount'];
  getDefect!: IStorage['getDefect'];
  createDefect!: IStorage['createDefect'];
  updateDefect!: IStorage['updateDefect'];
  deleteDefect!: IStorage['deleteDefect'];
  
  getDefectActions!: IStorage['getDefectActions'];
  createDefectAction!: IStorage['createDefectAction'];
  updateDefectAction!: IStorage['updateDefectAction'];
  deleteDefectAction!: IStorage['deleteDefectAction'];
  
  getDefectAttachments!: IStorage['getDefectAttachments'];
  createDefectAttachment!: IStorage['createDefectAttachment'];
  deleteDefectAttachment!: IStorage['deleteDefectAttachment'];
  
  addDefectNote!: IStorage['addDefectNote'];
  linkDefects!: IStorage['linkDefects'];
  closeDefect!: IStorage['closeDefect'];
  
  getRecurringDefects!: IStorage['getRecurringDefects'];
  getRecurringDefect!: IStorage['getRecurringDefect'];
  calculateAndUpdateRecurringDefects!: IStorage['calculateAndUpdateRecurringDefects'];
  getRecurringDefectLinks!: IStorage['getRecurringDefectLinks'];
  getDefectsForRecurring!: IStorage['getDefectsForRecurring'];
  recalculateAllRecurringDefects!: IStorage['recalculateAllRecurringDefects'];
  
  getDefectBySeedId!: IStorage['getDefectBySeedId'];
  
  createImportHistory!: IStorage['createImportHistory'];
  getImportHistory!: IStorage['getImportHistory'];
  getImportHistoryById!: IStorage['getImportHistoryById'];
  updateImportHistory!: IStorage['updateImportHistory'];
  
  createImportChangeLog!: IStorage['createImportChangeLog'];
  getImportChangeLogs!: IStorage['getImportChangeLogs'];
  deleteImportChangeLogs!: IStorage['deleteImportChangeLogs'];
  
  
  purgeJobsAndLinkedData!: IStorage['purgeJobsAndLinkedData'];
  
  getStoresItems!: IStorage['getStoresItems'];
  getStoresItem!: IStorage['getStoresItem'];
  createStoresItem!: IStorage['createStoresItem'];
  updateStoresItem!: IStorage['updateStoresItem'];
  deleteStoresItem!: IStorage['deleteStoresItem'];
  consumeStoresItem!: IStorage['consumeStoresItem'];
  receiveStoresItem!: IStorage['receiveStoresItem'];
  getStoresTransactionHistory!: IStorage['getStoresTransactionHistory'];
  getStoresItemHistory!: IStorage['getStoresItemHistory'];
  
  getFleetVesselMappings!: IStorage['getFleetVesselMappings'];
  createFleetVesselMappings!: IStorage['createFleetVesselMappings'];
  deleteFleetVesselMapping!: IStorage['deleteFleetVesselMapping'];
  
  generateOnDemandWorkOrder!: IStorage['generateOnDemandWorkOrder'];
  checkAndRevertPostponedWorkOrders!: IStorage['checkAndRevertPostponedWorkOrders'];
  
  
  getFleetVesselMappingsByVessel!: IStorage['getFleetVesselMappingsByVessel'];
  createFleetVesselMappingRecord!: IStorage['createFleetVesselMappingRecord'];
  removeFleetVesselMappingRecord!: IStorage['removeFleetVesselMappingRecord'];
  
  getComponentVesselMappings!: IStorage['getComponentVesselMappings'];
  createComponentVesselMapping!: IStorage['createComponentVesselMapping'];
  deleteComponentVesselMapping!: IStorage['deleteComponentVesselMapping'];
  
  getFleetComponentMappings!: IStorage['getFleetComponentMappings'];
  getFleetComponentMappingsByVessel!: IStorage['getFleetComponentMappingsByVessel'];
  createFleetComponentMappingRecord!: IStorage['createFleetComponentMappingRecord'];
  removeFleetComponentMappingRecord!: IStorage['removeFleetComponentMappingRecord'];
  
  getFleetJobVesselMappings!: IStorage['getFleetJobVesselMappings'];
  createFleetJobVesselMappingRecord!: IStorage['createFleetJobVesselMappingRecord'];
  removeFleetJobVesselMappingRecord!: IStorage['removeFleetJobVesselMappingRecord'];
  
  getFleetSpareVesselMappings!: IStorage['getFleetSpareVesselMappings'];
  createFleetSpareVesselMappingRecord!: IStorage['createFleetSpareVesselMappingRecord'];
  removeFleetSpareVesselMappingRecord!: IStorage['removeFleetSpareVesselMappingRecord'];
  
  getBulkImportHistory!: IStorage['getBulkImportHistory'];
  getBulkImportHistoryItem!: IStorage['getBulkImportHistoryItem'];
  createBulkImportHistory!: IStorage['createBulkImportHistory'];
  updateBulkImportHistory!: IStorage['updateBulkImportHistory'];
  
  getBulkImportErrors!: IStorage['getBulkImportErrors'];
  createBulkImportError!: IStorage['createBulkImportError'];
  createBulkImportErrors!: IStorage['createBulkImportErrors'];
  
  getFleetAdminMetrics!: IStorage['getFleetAdminMetrics'];
  
  getCertificates!: IStorage['getCertificates'];
  getCertificate!: IStorage['getCertificate'];
  createCertificate!: IStorage['createCertificate'];
  updateCertificate!: IStorage['updateCertificate'];
  deleteCertificate!: IStorage['deleteCertificate'];
  
  getSurveys!: IStorage['getSurveys'];
  getSurvey!: IStorage['getSurvey'];
  createSurvey!: IStorage['createSurvey'];
  updateSurvey!: IStorage['updateSurvey'];
  deleteSurvey!: IStorage['deleteSurvey'];
  
  getVesselsByFleet!: IStorage['getVesselsByFleet'];
  getVesselsWithFleets!: IStorage['getVesselsWithFleets'];
}

/**
 * Factory function to create and initialize HybridStorage
 */
export async function createHybridStorage(): Promise<HybridStorage> {
  const storage = new HybridStorage();
  await storage.initialize();
  return storage;
}
