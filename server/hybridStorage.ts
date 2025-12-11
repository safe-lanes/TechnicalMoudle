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
} from '@shared/schema';

/**
 * HybridStorage - Routes Module 1 operations to PostgreSQL, everything else to File Storage
 * 
 * Module 1 entities (routed to PostgresStorage):
 * - users
 * - fleets  
 * - vessels
 * - pms_vessel_settings
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
    
    this.getComponents = fs.getComponents.bind(fs);
    this.getComponent = fs.getComponent.bind(fs);
    this.getComponentByCode = fs.getComponentByCode.bind(fs);
    this.createComponent = fs.createComponent.bind(fs);
    this.updateComponent = fs.updateComponent.bind(fs);
    this.deleteComponent = fs.deleteComponent.bind(fs);
    this.inactivateComponent = fs.inactivateComponent.bind(fs);
    this.createRunningHoursAudit = fs.createRunningHoursAudit.bind(fs);
    this.getRunningHoursAudits = fs.getRunningHoursAudits.bind(fs);
    this.getRunningHoursAuditsInDateRange = fs.getRunningHoursAuditsInDateRange.bind(fs);
    this.getRunningHourParents = fs.getRunningHourParents.bind(fs);
    this.cascadeRunningHoursUpdate = fs.cascadeRunningHoursUpdate.bind(fs);
    
    this.getFleetComponents = fs.getFleetComponents.bind(fs);
    this.getFleetComponent = fs.getFleetComponent.bind(fs);
    this.createFleetComponent = fs.createFleetComponent.bind(fs);
    this.updateFleetComponent = fs.updateFleetComponent.bind(fs);
    this.deleteFleetComponent = fs.deleteFleetComponent.bind(fs);
    
    this.getAllSpares = fs.getAllSpares.bind(fs);
    this.getSpares = fs.getSpares.bind(fs);
    this.getSpare = fs.getSpare.bind(fs);
    this.createSpare = fs.createSpare.bind(fs);
    this.updateSpare = fs.updateSpare.bind(fs);
    this.deleteSpare = fs.deleteSpare.bind(fs);
    this.consumeSpare = fs.consumeSpare.bind(fs);
    this.consumeSpareFromLocation = fs.consumeSpareFromLocation.bind(fs);
    this.receiveSpare = fs.receiveSpare.bind(fs);
    this.bulkUpdateSpares = fs.bulkUpdateSpares.bind(fs);
    this.adjustSpareQuantity = fs.adjustSpareQuantity.bind(fs);
    
    this.getFleetSpares = fs.getFleetSpares.bind(fs);
    this.getFleetSpare = fs.getFleetSpare.bind(fs);
    this.createFleetSpare = fs.createFleetSpare.bind(fs);
    this.updateFleetSpare = fs.updateFleetSpare.bind(fs);
    this.deleteFleetSpare = fs.deleteFleetSpare.bind(fs);
    
    this.getSpareHistory = fs.getSpareHistory.bind(fs);
    this.getSpareHistoryBySpareId = fs.getSpareHistoryBySpareId.bind(fs);
    this.createSpareHistory = fs.createSpareHistory.bind(fs);
    
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
    this.bulkCreateSpares = fs.bulkCreateSpares.bind(fs);
    this.bulkUpdateSparesByROB = fs.bulkUpdateSparesByROB.bind(fs);
    this.bulkUpsertSpares = fs.bulkUpsertSpares.bind(fs);
    this.archiveComponentsByIds = fs.archiveComponentsByIds.bind(fs);
    this.archiveSparesByIds = fs.archiveSparesByIds.bind(fs);
    
    this.getComponentsByCodes = fs.getComponentsByCodes.bind(fs);
    this.getJobsByJobNos = fs.getJobsByJobNos.bind(fs);
    this.getWorkOrdersByTemplateIds = fs.getWorkOrdersByTemplateIds.bind(fs);
    
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
    
    this.getComponentDocuments = fs.getComponentDocuments.bind(fs);
    this.getComponentDocument = fs.getComponentDocument.bind(fs);
    this.createComponentDocument = fs.createComponentDocument.bind(fs);
    this.updateComponentDocument = fs.updateComponentDocument.bind(fs);
    this.deleteComponentDocument = fs.deleteComponentDocument.bind(fs);
    
    this.getComponentClassRegulatory = fs.getComponentClassRegulatory.bind(fs);
    this.getComponentClassRegulatoryItem = fs.getComponentClassRegulatoryItem.bind(fs);
    this.createComponentClassRegulatory = fs.createComponentClassRegulatory.bind(fs);
    this.updateComponentClassRegulatory = fs.updateComponentClassRegulatory.bind(fs);
    this.deleteComponentClassRegulatory = fs.deleteComponentClassRegulatory.bind(fs);
    
    this.getAllComponentMaintenanceHistory = fs.getAllComponentMaintenanceHistory.bind(fs);
    this.getComponentMaintenanceHistory = fs.getComponentMaintenanceHistory.bind(fs);
    this.getComponentMaintenanceHistoryItem = fs.getComponentMaintenanceHistoryItem.bind(fs);
    this.createComponentMaintenanceHistory = fs.createComponentMaintenanceHistory.bind(fs);
    
    this.getComponentRequisitions = fs.getComponentRequisitions.bind(fs);
    this.getAllComponentRequisitions = fs.getAllComponentRequisitions.bind(fs);
    this.getComponentRequisitionItem = fs.getComponentRequisitionItem.bind(fs);
    this.createComponentRequisition = fs.createComponentRequisition.bind(fs);
    this.updateComponentRequisition = fs.updateComponentRequisition.bind(fs);
    this.deleteComponentRequisition = fs.deleteComponentRequisition.bind(fs);
    
    this.getJobs = fs.getJobs.bind(fs);
    this.getJob = fs.getJob.bind(fs);
    this.createJob = fs.createJob.bind(fs);
    this.updateJob = fs.updateJob.bind(fs);
    this.deleteJob = fs.deleteJob.bind(fs);
    this.bulkCreateJobs = fs.bulkCreateJobs.bind(fs);
    this.bulkUpdateJobs = fs.bulkUpdateJobs.bind(fs);
    this.bulkUpsertJobs = fs.bulkUpsertJobs.bind(fs);
    
    this.getWorkOrders = fs.getWorkOrders.bind(fs);
    this.getWorkOrder = fs.getWorkOrder.bind(fs);
    this.getWorkOrdersByJobId = fs.getWorkOrdersByJobId.bind(fs);
    this.createWorkOrder = fs.createWorkOrder.bind(fs);
    this.updateWorkOrder = fs.updateWorkOrder.bind(fs);
    this.deleteWorkOrder = fs.deleteWorkOrder.bind(fs);
    this.bulkCreateWorkOrders = fs.bulkCreateWorkOrders.bind(fs);
    this.bulkUpdateWorkOrders = fs.bulkUpdateWorkOrders.bind(fs);
    this.bulkUpsertWorkOrders = fs.bulkUpsertWorkOrders.bind(fs);
    
    this.getFleetJobs = fs.getFleetJobs.bind(fs);
    this.getFleetJob = fs.getFleetJob.bind(fs);
    this.createFleetJob = fs.createFleetJob.bind(fs);
    this.updateFleetJob = fs.updateFleetJob.bind(fs);
    this.deleteFleetJob = fs.deleteFleetJob.bind(fs);
    
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
    
    this.getMakers = fs.getMakers.bind(fs);
    this.getMakerById = fs.getMakerById.bind(fs);
    this.createMaker = fs.createMaker.bind(fs);
    this.updateMaker = fs.updateMaker.bind(fs);
    this.deleteMaker = fs.deleteMaker.bind(fs);
    
    this.getMasterLists = fs.getMasterLists.bind(fs);
    this.getMasterListById = fs.getMasterListById.bind(fs);
    this.getMasterListsByType = fs.getMasterListsByType.bind(fs);
    this.createMasterList = fs.createMasterList.bind(fs);
    this.updateMasterList = fs.updateMasterList.bind(fs);
    this.deleteMasterList = fs.deleteMasterList.bind(fs);
    
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
    
    this.getMakerList = fs.getMakerList.bind(fs);
    this.getMakerListItem = fs.getMakerListItem.bind(fs);
    this.getMakerListByCode = fs.getMakerListByCode.bind(fs);
    this.createMakerListItem = fs.createMakerListItem.bind(fs);
    this.updateMakerListItem = fs.updateMakerListItem.bind(fs);
    this.deleteMakerListItem = fs.deleteMakerListItem.bind(fs);
    
    this.getSfiDetails = fs.getSfiDetails.bind(fs);
    this.getSfiDetail = fs.getSfiDetail.bind(fs);
    this.getSfiByCode = fs.getSfiByCode.bind(fs);
    this.createSfiDetail = fs.createSfiDetail.bind(fs);
    this.updateSfiDetail = fs.updateSfiDetail.bind(fs);
    this.deleteSfiDetail = fs.deleteSfiDetail.bind(fs);
    
    this.getMasterDataList = fs.getMasterDataList.bind(fs);
    this.getMasterDataItem = fs.getMasterDataItem.bind(fs);
    this.getMasterDataByFleetCode = fs.getMasterDataByFleetCode.bind(fs);
    this.getMasterDataByMakerModel = fs.getMasterDataByMakerModel.bind(fs);
    this.createMasterData = fs.createMasterData.bind(fs);
    this.updateMasterData = fs.updateMasterData.bind(fs);
    this.deleteMasterData = fs.deleteMasterData.bind(fs);
    this.generateFleetEquipmentCode = fs.generateFleetEquipmentCode.bind(fs);
    
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

  // ============= DELEGATED METHODS (File Storage) =============
  // These are assigned in bindFileStorageMethods() and will be migrated
  // to PostgresStorage in future modules
  
  getComponents!: IStorage['getComponents'];
  getComponent!: IStorage['getComponent'];
  getComponentByCode!: IStorage['getComponentByCode'];
  createComponent!: IStorage['createComponent'];
  updateComponent!: IStorage['updateComponent'];
  deleteComponent!: IStorage['deleteComponent'];
  inactivateComponent!: IStorage['inactivateComponent'];
  createRunningHoursAudit!: IStorage['createRunningHoursAudit'];
  getRunningHoursAudits!: IStorage['getRunningHoursAudits'];
  getRunningHoursAuditsInDateRange!: IStorage['getRunningHoursAuditsInDateRange'];
  getRunningHourParents!: IStorage['getRunningHourParents'];
  cascadeRunningHoursUpdate!: IStorage['cascadeRunningHoursUpdate'];
  
  getFleetComponents!: IStorage['getFleetComponents'];
  getFleetComponent!: IStorage['getFleetComponent'];
  createFleetComponent!: IStorage['createFleetComponent'];
  updateFleetComponent!: IStorage['updateFleetComponent'];
  deleteFleetComponent!: IStorage['deleteFleetComponent'];
  
  getAllSpares!: IStorage['getAllSpares'];
  getSpares!: IStorage['getSpares'];
  getSpare!: IStorage['getSpare'];
  createSpare!: IStorage['createSpare'];
  updateSpare!: IStorage['updateSpare'];
  deleteSpare!: IStorage['deleteSpare'];
  consumeSpare!: IStorage['consumeSpare'];
  consumeSpareFromLocation!: IStorage['consumeSpareFromLocation'];
  receiveSpare!: IStorage['receiveSpare'];
  bulkUpdateSpares!: IStorage['bulkUpdateSpares'];
  adjustSpareQuantity!: IStorage['adjustSpareQuantity'];
  
  getFleetSpares!: IStorage['getFleetSpares'];
  getFleetSpare!: IStorage['getFleetSpare'];
  createFleetSpare!: IStorage['createFleetSpare'];
  updateFleetSpare!: IStorage['updateFleetSpare'];
  deleteFleetSpare!: IStorage['deleteFleetSpare'];
  
  getSpareHistory!: IStorage['getSpareHistory'];
  getSpareHistoryBySpareId!: IStorage['getSpareHistoryBySpareId'];
  createSpareHistory!: IStorage['createSpareHistory'];
  
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
  bulkCreateSpares!: IStorage['bulkCreateSpares'];
  bulkUpdateSparesByROB!: IStorage['bulkUpdateSparesByROB'];
  bulkUpsertSpares!: IStorage['bulkUpsertSpares'];
  archiveComponentsByIds!: IStorage['archiveComponentsByIds'];
  archiveSparesByIds!: IStorage['archiveSparesByIds'];
  
  getComponentsByCodes!: IStorage['getComponentsByCodes'];
  getJobsByJobNos!: IStorage['getJobsByJobNos'];
  getWorkOrdersByTemplateIds!: IStorage['getWorkOrdersByTemplateIds'];
  
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
  
  getComponentDocuments!: IStorage['getComponentDocuments'];
  getComponentDocument!: IStorage['getComponentDocument'];
  createComponentDocument!: IStorage['createComponentDocument'];
  updateComponentDocument!: IStorage['updateComponentDocument'];
  deleteComponentDocument!: IStorage['deleteComponentDocument'];
  
  getComponentClassRegulatory!: IStorage['getComponentClassRegulatory'];
  getComponentClassRegulatoryItem!: IStorage['getComponentClassRegulatoryItem'];
  createComponentClassRegulatory!: IStorage['createComponentClassRegulatory'];
  updateComponentClassRegulatory!: IStorage['updateComponentClassRegulatory'];
  deleteComponentClassRegulatory!: IStorage['deleteComponentClassRegulatory'];
  
  getAllComponentMaintenanceHistory!: IStorage['getAllComponentMaintenanceHistory'];
  getComponentMaintenanceHistory!: IStorage['getComponentMaintenanceHistory'];
  getComponentMaintenanceHistoryItem!: IStorage['getComponentMaintenanceHistoryItem'];
  createComponentMaintenanceHistory!: IStorage['createComponentMaintenanceHistory'];
  
  getComponentRequisitions!: IStorage['getComponentRequisitions'];
  getAllComponentRequisitions!: IStorage['getAllComponentRequisitions'];
  getComponentRequisitionItem!: IStorage['getComponentRequisitionItem'];
  createComponentRequisition!: IStorage['createComponentRequisition'];
  updateComponentRequisition!: IStorage['updateComponentRequisition'];
  deleteComponentRequisition!: IStorage['deleteComponentRequisition'];
  
  getJobs!: IStorage['getJobs'];
  getJob!: IStorage['getJob'];
  createJob!: IStorage['createJob'];
  updateJob!: IStorage['updateJob'];
  deleteJob!: IStorage['deleteJob'];
  bulkCreateJobs!: IStorage['bulkCreateJobs'];
  bulkUpdateJobs!: IStorage['bulkUpdateJobs'];
  bulkUpsertJobs!: IStorage['bulkUpsertJobs'];
  
  getWorkOrders!: IStorage['getWorkOrders'];
  getWorkOrder!: IStorage['getWorkOrder'];
  getWorkOrdersByJobId!: IStorage['getWorkOrdersByJobId'];
  createWorkOrder!: IStorage['createWorkOrder'];
  updateWorkOrder!: IStorage['updateWorkOrder'];
  deleteWorkOrder!: IStorage['deleteWorkOrder'];
  bulkCreateWorkOrders!: IStorage['bulkCreateWorkOrders'];
  bulkUpdateWorkOrders!: IStorage['bulkUpdateWorkOrders'];
  bulkUpsertWorkOrders!: IStorage['bulkUpsertWorkOrders'];
  
  getFleetJobs!: IStorage['getFleetJobs'];
  getFleetJob!: IStorage['getFleetJob'];
  createFleetJob!: IStorage['createFleetJob'];
  updateFleetJob!: IStorage['updateFleetJob'];
  deleteFleetJob!: IStorage['deleteFleetJob'];
  
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
  
  getMakers!: IStorage['getMakers'];
  getMakerById!: IStorage['getMakerById'];
  createMaker!: IStorage['createMaker'];
  updateMaker!: IStorage['updateMaker'];
  deleteMaker!: IStorage['deleteMaker'];
  
  getMasterLists!: IStorage['getMasterLists'];
  getMasterListById!: IStorage['getMasterListById'];
  getMasterListsByType!: IStorage['getMasterListsByType'];
  createMasterList!: IStorage['createMasterList'];
  updateMasterList!: IStorage['updateMasterList'];
  deleteMasterList!: IStorage['deleteMasterList'];
  
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
  
  getMakerList!: IStorage['getMakerList'];
  getMakerListItem!: IStorage['getMakerListItem'];
  getMakerListByCode!: IStorage['getMakerListByCode'];
  createMakerListItem!: IStorage['createMakerListItem'];
  updateMakerListItem!: IStorage['updateMakerListItem'];
  deleteMakerListItem!: IStorage['deleteMakerListItem'];
  
  getSfiDetails!: IStorage['getSfiDetails'];
  getSfiDetail!: IStorage['getSfiDetail'];
  getSfiByCode!: IStorage['getSfiByCode'];
  createSfiDetail!: IStorage['createSfiDetail'];
  updateSfiDetail!: IStorage['updateSfiDetail'];
  deleteSfiDetail!: IStorage['deleteSfiDetail'];
  
  getMasterDataList!: IStorage['getMasterDataList'];
  getMasterDataItem!: IStorage['getMasterDataItem'];
  getMasterDataByFleetCode!: IStorage['getMasterDataByFleetCode'];
  getMasterDataByMakerModel!: IStorage['getMasterDataByMakerModel'];
  createMasterData!: IStorage['createMasterData'];
  updateMasterData!: IStorage['updateMasterData'];
  deleteMasterData!: IStorage['deleteMasterData'];
  generateFleetEquipmentCode!: IStorage['generateFleetEquipmentCode'];
  
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
