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
  StoresItem,
  InsertStoresItem,
  StoresLedger,
  Defect,
  InsertDefect,
  DefectAction,
  InsertDefectAction,
  DefectAttachment,
  InsertDefectAttachment,
  RecurringDefect,
  InsertRecurringDefect,
  RecurringDefectLink,
  AlertPolicy,
  InsertAlertPolicy,
  AlertEvent,
  InsertAlertEvent,
  AlertDelivery,
  InsertAlertDelivery,
  AlertConfig,
  InsertAlertConfig,
  FormDefinition,
  InsertFormDefinition,
  FormVersion,
  InsertFormVersion,
  FormVersionUsage,
  InsertFormVersionUsage,
  ChangeRequest,
  InsertChangeRequest,
  ChangeRequestAttachment,
  InsertChangeRequestAttachment,
  ChangeRequestComment,
  InsertChangeRequestComment,
  IhmItem,
  InsertIhmItem,
  IhmMaintenanceLog,
  InsertIhmMaintenanceLog,
  FleetVesselMapping,
  InsertFleetVesselMapping,
  FleetComponentMapping,
  InsertFleetComponentMapping,
  FleetJobVesselMapping,
  InsertFleetJobVesselMapping,
  FleetSpareVesselMapping,
  InsertFleetSpareVesselMapping,
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
 * Module 8 entities (routed to PostgresStorage):
 * - stores_items
 * - stores_ledger
 * 
 * Module 9 entities (routed to PostgresStorage):
 * - defects
 * - defect_actions
 * - defect_attachments
 * - recurring_defects
 * - recurring_defect_links
 * 
 * Module 10 entities (routed to PostgresStorage):
 * - alert_policies
 * - alert_events
 * - alert_deliveries
 * - alert_config
 * 
 * Module 11 entities (routed to PostgresStorage):
 * - form_definitions
 * - form_versions
 * - form_version_usage
 * 
 * Module 12 entities (routed to PostgresStorage):
 * - change_request
 * - change_request_attachment
 * - change_request_comment
 * 
 * Module 13 entities (routed to PostgresStorage):
 * - ihm_items
 * - ihm_maintenance_log
 * 
 * Module 14 entities (routed to PostgresStorage):
 * - fleet_vessel_mapping
 * - fleet_component_mapping
 * - fleet_job_vessel_mapping
 * - fleet_spare_vessel_mapping
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
    
    // Module 12 Change Requests methods - now have explicit PostgreSQL routing below
    
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
    
    // Module 10 Alerts methods - now have explicit PostgreSQL routing below
    
    // Module 11 Forms methods - now have explicit PostgreSQL routing below
    
    // Module 13 IHM methods - now have explicit PostgreSQL routing below
    
    // Module 3 methods (ComponentDocuments, ClassRegulatory, MaintenanceHistory, Requisitions)
    // now have explicit PostgreSQL routing below
    
    // Module 4 Jobs methods - now have explicit PostgreSQL routing below
    
    // Module 5 Work Orders methods - now have explicit PostgreSQL routing below
    
    this.getWorkOrderExecutions = fs.getWorkOrderExecutions.bind(fs);
    this.getWorkOrderExecutionById = fs.getWorkOrderExecutionById.bind(fs);
    this.createWorkOrderExecution = fs.createWorkOrderExecution.bind(fs);
    this.updateWorkOrderExecution = fs.updateWorkOrderExecution.bind(fs);
    
    // Module 9 Defects methods - now have explicit PostgreSQL routing below
    // Only complex recalculation methods remain delegated
    this.calculateAndUpdateRecurringDefects = fs.calculateAndUpdateRecurringDefects.bind(fs);
    this.recalculateAllRecurringDefects = fs.recalculateAllRecurringDefects.bind(fs);
    
    this.createImportHistory = fs.createImportHistory.bind(fs);
    this.getImportHistory = fs.getImportHistory.bind(fs);
    this.getImportHistoryById = fs.getImportHistoryById.bind(fs);
    this.updateImportHistory = fs.updateImportHistory.bind(fs);
    
    this.createImportChangeLog = fs.createImportChangeLog.bind(fs);
    this.getImportChangeLogs = fs.getImportChangeLogs.bind(fs);
    this.deleteImportChangeLogs = fs.deleteImportChangeLogs.bind(fs);
    
    // Module 2 methods (Makers, MasterLists) now have explicit PostgreSQL routing below
    
    this.purgeJobsAndLinkedData = fs.purgeJobsAndLinkedData.bind(fs);
    
    // Module 8 Stores methods - now have explicit PostgreSQL routing below
    
    // Legacy fleet vessel mappings (kept on file storage for compatibility)
    this.createFleetVesselMappings = fs.createFleetVesselMappings.bind(fs);
    this.deleteFleetVesselMapping = fs.deleteFleetVesselMapping.bind(fs);
    
    this.generateOnDemandWorkOrder = fs.generateOnDemandWorkOrder.bind(fs);
    this.checkAndRevertPostponedWorkOrders = fs.checkAndRevertPostponedWorkOrders.bind(fs);
    
    // Module 2 methods (MakerList, SfiDetails, MasterData) have explicit PostgreSQL routing below
    
    // Module 14 Fleet Mappings - now have explicit PostgreSQL routing below
    
    // Legacy component vessel mappings (kept on file storage for compatibility)
    this.getComponentVesselMappings = fs.getComponentVesselMappings.bind(fs);
    this.createComponentVesselMapping = fs.createComponentVesselMapping.bind(fs);
    this.deleteComponentVesselMapping = fs.deleteComponentVesselMapping.bind(fs);
    
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
        console.log('✅ HybridStorage: PostgreSQL connection verified - Modules 1-7 will use database');
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

  // ============= MODULE 8: STORES (PostgreSQL) =============

  async getStoresItems(vesselId: string, itemType?: string): Promise<StoresItem[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getStoresItems(vesselId, itemType);
    }
    return this.fileStorage.getStoresItems(vesselId, itemType);
  }

  async getStoresItem(id: number): Promise<StoresItem | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getStoresItem(id);
    }
    return this.fileStorage.getStoresItem(id);
  }

  async createStoresItem(item: InsertStoresItem): Promise<StoresItem> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createStoresItem(item);
    }
    return this.fileStorage.createStoresItem(item);
  }

  async updateStoresItem(id: number, data: Partial<StoresItem>): Promise<StoresItem> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateStoresItem(id, data);
    }
    return this.fileStorage.updateStoresItem(id, data);
  }

  async deleteStoresItem(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteStoresItem(id);
    }
    return this.fileStorage.deleteStoresItem(id);
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
    if (this.postgresAvailable) {
      return this.postgresStorage.consumeStoresItem(id, quantity, location, userId, remarks, place, dateLocal, tz);
    }
    return this.fileStorage.consumeStoresItem(id, quantity, location, userId, remarks, place, dateLocal, tz);
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
    if (this.postgresAvailable) {
      return this.postgresStorage.receiveStoresItem(id, quantity, location, userId, remarks, ref, place, dateLocal, tz);
    }
    return this.fileStorage.receiveStoresItem(id, quantity, location, userId, remarks, ref, place, dateLocal, tz);
  }

  async getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<StoresLedger[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getStoresTransactionHistory(vesselId, itemType);
    }
    return this.fileStorage.getStoresTransactionHistory(vesselId, itemType);
  }

  async getStoresItemHistory(itemId: number): Promise<StoresLedger[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getStoresItemHistory(itemId);
    }
    return this.fileStorage.getStoresItemHistory(itemId);
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
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefects(filters);
    }
    return this.fileStorage.getDefects(filters);
  }

  async getDefectsCount(filters?: { statusView?: 'active' | 'resolved'; vesselId?: string; isCoC?: boolean }): Promise<number> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefectsCount(filters);
    }
    return this.fileStorage.getDefectsCount(filters);
  }

  async getDefect(id: string): Promise<Defect | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefect(id);
    }
    return this.fileStorage.getDefect(id);
  }

  async getDefectBySeedId(seedId: string): Promise<Defect | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefectBySeedId(seedId);
    }
    return this.fileStorage.getDefectBySeedId(seedId);
  }

  async createDefect(defect: InsertDefect): Promise<Defect> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createDefect(defect);
    }
    return this.fileStorage.createDefect(defect);
  }

  async updateDefect(id: string, data: Partial<InsertDefect>): Promise<Defect> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateDefect(id, data);
    }
    return this.fileStorage.updateDefect(id, data);
  }

  async deleteDefect(id: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteDefect(id);
    }
    return this.fileStorage.deleteDefect(id);
  }

  async addDefectNote(defectId: string, note: { noteText: string; attachments: string[]; createdBy: string }): Promise<Defect> {
    if (this.postgresAvailable) {
      return this.postgresStorage.addDefectNote(defectId, note);
    }
    return this.fileStorage.addDefectNote(defectId, note);
  }

  async linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect> {
    if (this.postgresAvailable) {
      return this.postgresStorage.linkDefects(defectId, linkedDefectIds);
    }
    return this.fileStorage.linkDefects(defectId, linkedDefectIds);
  }

  async closeDefect(defectId: string, closure: { closedBy: string; closureComment?: string; closureFiles?: string[] }): Promise<Defect> {
    if (this.postgresAvailable) {
      return this.postgresStorage.closeDefect(defectId, closure);
    }
    return this.fileStorage.closeDefect(defectId, closure);
  }

  // ============= MODULE 9: DEFECT ACTIONS =============

  async getDefectActions(defectId: string): Promise<DefectAction[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefectActions(defectId);
    }
    return this.fileStorage.getDefectActions(defectId);
  }

  async createDefectAction(action: InsertDefectAction): Promise<DefectAction> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createDefectAction(action);
    }
    return this.fileStorage.createDefectAction(action);
  }

  async updateDefectAction(id: number, updates: Partial<InsertDefectAction>): Promise<DefectAction> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateDefectAction(id, updates);
    }
    return this.fileStorage.updateDefectAction(id, updates);
  }

  async deleteDefectAction(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteDefectAction(id);
    }
    return this.fileStorage.deleteDefectAction(id);
  }

  // ============= MODULE 9: DEFECT ATTACHMENTS =============

  async getDefectAttachments(defectId: string): Promise<DefectAttachment[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefectAttachments(defectId);
    }
    return this.fileStorage.getDefectAttachments(defectId);
  }

  async createDefectAttachment(attachment: InsertDefectAttachment): Promise<DefectAttachment> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createDefectAttachment(attachment);
    }
    return this.fileStorage.createDefectAttachment(attachment);
  }

  async deleteDefectAttachment(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteDefectAttachment(id);
    }
    return this.fileStorage.deleteDefectAttachment(id);
  }

  // ============= MODULE 9: RECURRING DEFECTS =============

  async getRecurringDefects(filters?: { windowMonths?: number; minOccurrences?: number; hasCoc?: boolean; equipmentKey?: string }): Promise<RecurringDefect[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getRecurringDefects(filters);
    }
    return this.fileStorage.getRecurringDefects(filters);
  }

  async getRecurringDefect(id: number): Promise<RecurringDefect | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getRecurringDefect(id);
    }
    return this.fileStorage.getRecurringDefect(id);
  }

  async getRecurringDefectLinks(recurringId: number): Promise<RecurringDefectLink[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getRecurringDefectLinks(recurringId);
    }
    return this.fileStorage.getRecurringDefectLinks(recurringId);
  }

  async getDefectsForRecurring(recurringId: number): Promise<Defect[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getDefectsForRecurring(recurringId);
    }
    return this.fileStorage.getDefectsForRecurring(recurringId);
  }

  // ============= MODULE 10: ALERT POLICIES (PostgreSQL) =============

  async getAlertPolicies(): Promise<AlertPolicy[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAlertPolicies();
    }
    return this.fileStorage.getAlertPolicies();
  }

  async getAlertPolicy(id: number): Promise<AlertPolicy | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAlertPolicy(id);
    }
    return this.fileStorage.getAlertPolicy(id);
  }

  async createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createAlertPolicy(policy);
    }
    return this.fileStorage.createAlertPolicy(policy);
  }

  async updateAlertPolicy(id: number, data: Partial<AlertPolicy>): Promise<AlertPolicy> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateAlertPolicy(id, data);
    }
    return this.fileStorage.updateAlertPolicy(id, data);
  }

  async deleteAlertPolicy(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteAlertPolicy(id);
    }
    return this.fileStorage.deleteAlertPolicy(id);
  }

  // ============= MODULE 10: ALERT EVENTS (PostgreSQL) =============

  async getAlertEvents(filters?: any): Promise<AlertEvent[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAlertEvents(filters);
    }
    return this.fileStorage.getAlertEvents(filters);
  }

  async getAlertEvent(id: number): Promise<AlertEvent | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAlertEvent(id);
    }
    return this.fileStorage.getAlertEvent(id);
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createAlertEvent(event);
    }
    return this.fileStorage.createAlertEvent(event);
  }

  async acknowledgeAlertEvent(id: number, userId: string): Promise<AlertEvent> {
    if (this.postgresAvailable) {
      return this.postgresStorage.acknowledgeAlertEvent(id, userId);
    }
    return this.fileStorage.acknowledgeAlertEvent(id, userId);
  }

  // ============= MODULE 10: ALERT DELIVERIES (PostgreSQL) =============

  async getAlertDeliveries(eventId: number): Promise<AlertDelivery[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAlertDeliveries(eventId);
    }
    return this.fileStorage.getAlertDeliveries(eventId);
  }

  async createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createAlertDelivery(delivery);
    }
    return this.fileStorage.createAlertDelivery(delivery);
  }

  async updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateAlertDeliveryStatus(id, status, errorMessage);
    }
    return this.fileStorage.updateAlertDeliveryStatus(id, status, errorMessage);
  }

  // ============= MODULE 10: ALERT CONFIG (PostgreSQL) =============

  async getAlertConfig(vesselId: string): Promise<AlertConfig | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getAlertConfig(vesselId);
    }
    return this.fileStorage.getAlertConfig(vesselId);
  }

  async createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createOrUpdateAlertConfig(config);
    }
    return this.fileStorage.createOrUpdateAlertConfig(config);
  }

  // ============= MODULE 11: FORM DEFINITIONS (PostgreSQL) =============

  async getFormDefinitions(): Promise<FormDefinition[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFormDefinitions();
    }
    return this.fileStorage.getFormDefinitions();
  }

  async getFormDefinition(id: number): Promise<FormDefinition | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFormDefinition(id);
    }
    return this.fileStorage.getFormDefinition(id);
  }

  async getFormDefinitionByName(name: string): Promise<FormDefinition | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFormDefinitionByName(name);
    }
    return this.fileStorage.getFormDefinitionByName(name);
  }

  async createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFormDefinition(form);
    }
    return this.fileStorage.createFormDefinition(form);
  }

  // ============= MODULE 11: FORM VERSIONS (PostgreSQL) =============

  async getFormVersions(formId: number): Promise<FormVersion[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFormVersions(formId);
    }
    return this.fileStorage.getFormVersions(formId);
  }

  async getFormVersion(id: number): Promise<FormVersion | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFormVersion(id);
    }
    return this.fileStorage.getFormVersion(id);
  }

  async getLatestPublishedVersion(formId: number): Promise<FormVersion | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getLatestPublishedVersion(formId);
    }
    return this.fileStorage.getLatestPublishedVersion(formId);
  }

  async getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getLatestPublishedVersionByName(name);
    }
    return this.fileStorage.getLatestPublishedVersionByName(name);
  }

  async createFormVersion(version: InsertFormVersion): Promise<FormVersion> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFormVersion(version);
    }
    return this.fileStorage.createFormVersion(version);
  }

  async updateFormVersion(id: number, data: Partial<FormVersion>): Promise<FormVersion> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateFormVersion(id, data);
    }
    return this.fileStorage.updateFormVersion(id, data);
  }

  async publishFormVersion(id: number, userId: string, changelog: string): Promise<FormVersion> {
    if (this.postgresAvailable) {
      return this.postgresStorage.publishFormVersion(id, userId, changelog);
    }
    return this.fileStorage.publishFormVersion(id, userId, changelog);
  }

  async discardFormVersion(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.discardFormVersion(id);
    }
    return this.fileStorage.discardFormVersion(id);
  }

  // ============= MODULE 11: FORM VERSION USAGE (PostgreSQL) =============

  async createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFormVersionUsage(usage);
    }
    return this.fileStorage.createFormVersionUsage(usage);
  }

  async getFormVersionUsage(formVersionId: number): Promise<FormVersionUsage[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFormVersionUsage(formVersionId);
    }
    return this.fileStorage.getFormVersionUsage(formVersionId);
  }

  async seedForms(): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.seedForms();
    }
    return this.fileStorage.seedForms();
  }

  // ============= MODULE 12: CHANGE REQUESTS (PostgreSQL) =============

  async getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string }): Promise<ChangeRequest[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getChangeRequests(filters);
    }
    return this.fileStorage.getChangeRequests(filters);
  }

  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getChangeRequest(id);
    }
    return this.fileStorage.getChangeRequest(id);
  }

  async createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createChangeRequest(request);
    }
    return this.fileStorage.createChangeRequest(request);
  }

  async updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateChangeRequest(id, data);
    }
    return this.fileStorage.updateChangeRequest(id, data);
  }

  async updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateChangeRequestTarget(id, targetType, targetId, snapshotBeforeJson);
    }
    return this.fileStorage.updateChangeRequestTarget(id, targetType, targetId, snapshotBeforeJson);
  }

  async updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.updateChangeRequestProposed(id, proposedChangesJson, movePreviewJson);
    }
    return this.fileStorage.updateChangeRequestProposed(id, proposedChangesJson, movePreviewJson);
  }

  async deleteChangeRequest(id: number): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.deleteChangeRequest(id);
    }
    return this.fileStorage.deleteChangeRequest(id);
  }

  async submitChangeRequest(id: number, userId: string): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.submitChangeRequest(id, userId);
    }
    return this.fileStorage.submitChangeRequest(id, userId);
  }

  async approveChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.approveChangeRequest(id, reviewerId, comment);
    }
    return this.fileStorage.approveChangeRequest(id, reviewerId, comment);
  }

  async rejectChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.rejectChangeRequest(id, reviewerId, comment);
    }
    return this.fileStorage.rejectChangeRequest(id, reviewerId, comment);
  }

  async returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    if (this.postgresAvailable) {
      return this.postgresStorage.returnChangeRequest(id, reviewerId, comment);
    }
    return this.fileStorage.returnChangeRequest(id, reviewerId, comment);
  }

  // ============= MODULE 12: CHANGE REQUEST ATTACHMENTS (PostgreSQL) =============

  async getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getChangeRequestAttachments(changeRequestId);
    }
    return this.fileStorage.getChangeRequestAttachments(changeRequestId);
  }

  async createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createChangeRequestAttachment(attachment);
    }
    return this.fileStorage.createChangeRequestAttachment(attachment);
  }

  // ============= MODULE 12: CHANGE REQUEST COMMENTS (PostgreSQL) =============

  async getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getChangeRequestComments(changeRequestId);
    }
    return this.fileStorage.getChangeRequestComments(changeRequestId);
  }

  async createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createChangeRequestComment(comment);
    }
    return this.fileStorage.createChangeRequestComment(comment);
  }

  // ============= MODULE 13: IHM ITEMS (PostgreSQL) =============

  async getIhmItem(id: string, type: 'component' | 'spare'): Promise<IhmItem | undefined> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getIhmItem(id, type);
    }
    return this.fileStorage.getIhmItem(id, type);
  }

  async upsertIhmItem(item: InsertIhmItem): Promise<IhmItem> {
    if (this.postgresAvailable) {
      return this.postgresStorage.upsertIhmItem(item);
    }
    return this.fileStorage.upsertIhmItem(item);
  }

  // ============= MODULE 13: IHM MAINTENANCE LOG (PostgreSQL) =============

  async getIhmMaintenanceLog(filters: { vesselId?: string; componentId?: string; spareId?: string; workOrderId?: string }): Promise<IhmMaintenanceLog[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getIhmMaintenanceLog(filters);
    }
    return this.fileStorage.getIhmMaintenanceLog(filters);
  }

  async createIhmMaintenanceLogEntry(entry: InsertIhmMaintenanceLog): Promise<IhmMaintenanceLog> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createIhmMaintenanceLogEntry(entry);
    }
    return this.fileStorage.createIhmMaintenanceLogEntry(entry);
  }

  async getIhmStatusReport(vesselId: string): Promise<IhmItem[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getIhmStatusReport(vesselId);
    }
    return this.fileStorage.getIhmStatusReport(vesselId);
  }

  // ============= MODULE 14: FLEET VESSEL MAPPING (PostgreSQL) =============

  async getFleetVesselMappings(fleetEquipmentCode?: string): Promise<FleetVesselMapping[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetVesselMappings(fleetEquipmentCode);
    }
    return this.fileStorage.getFleetVesselMappings(fleetEquipmentCode);
  }

  async getFleetVesselMappingsByVessel(vesselCode: string): Promise<FleetVesselMapping[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetVesselMappingsByVessel(vesselCode);
    }
    return this.fileStorage.getFleetVesselMappingsByVessel(vesselCode);
  }

  async createFleetVesselMappingRecord(mapping: InsertFleetVesselMapping): Promise<FleetVesselMapping> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetVesselMappingRecord(mapping);
    }
    return this.fileStorage.createFleetVesselMappingRecord(mapping);
  }

  async removeFleetVesselMappingRecord(fleetEquipmentCode: string, vesselCode: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.removeFleetVesselMappingRecord(fleetEquipmentCode, vesselCode);
    }
    return this.fileStorage.removeFleetVesselMappingRecord(fleetEquipmentCode, vesselCode);
  }

  // ============= MODULE 14: FLEET COMPONENT MAPPING (PostgreSQL) =============

  async getFleetComponentMappings(fleetEquipmentCode: string): Promise<FleetComponentMapping[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetComponentMappings(fleetEquipmentCode);
    }
    return this.fileStorage.getFleetComponentMappings(fleetEquipmentCode);
  }

  async getFleetComponentMappingsByVessel(vesselCode: string): Promise<FleetComponentMapping[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetComponentMappingsByVessel(vesselCode);
    }
    return this.fileStorage.getFleetComponentMappingsByVessel(vesselCode);
  }

  async createFleetComponentMappingRecord(mapping: InsertFleetComponentMapping): Promise<FleetComponentMapping> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetComponentMappingRecord(mapping);
    }
    return this.fileStorage.createFleetComponentMappingRecord(mapping);
  }

  async removeFleetComponentMappingRecord(fleetEquipmentCode: string, vesselCode: string, componentCode: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.removeFleetComponentMappingRecord(fleetEquipmentCode, vesselCode, componentCode);
    }
    return this.fileStorage.removeFleetComponentMappingRecord(fleetEquipmentCode, vesselCode, componentCode);
  }

  // ============= MODULE 14: FLEET JOB VESSEL MAPPING (PostgreSQL) =============

  async getFleetJobVesselMappings(fleetEquipmentCode?: string, jobCode?: string): Promise<FleetJobVesselMapping[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetJobVesselMappings(fleetEquipmentCode, jobCode);
    }
    return this.fileStorage.getFleetJobVesselMappings(fleetEquipmentCode, jobCode);
  }

  async createFleetJobVesselMappingRecord(mapping: InsertFleetJobVesselMapping): Promise<FleetJobVesselMapping> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetJobVesselMappingRecord(mapping);
    }
    return this.fileStorage.createFleetJobVesselMappingRecord(mapping);
  }

  async removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.removeFleetJobVesselMappingRecord(jobCode, vesselCode);
    }
    return this.fileStorage.removeFleetJobVesselMappingRecord(jobCode, vesselCode);
  }

  // ============= MODULE 14: FLEET SPARE VESSEL MAPPING (PostgreSQL) =============

  async getFleetSpareVesselMappings(fleetEquipmentCode?: string, partCode?: string): Promise<FleetSpareVesselMapping[]> {
    if (this.postgresAvailable) {
      return this.postgresStorage.getFleetSpareVesselMappings(fleetEquipmentCode, partCode);
    }
    return this.fileStorage.getFleetSpareVesselMappings(fleetEquipmentCode, partCode);
  }

  async createFleetSpareVesselMappingRecord(mapping: InsertFleetSpareVesselMapping): Promise<FleetSpareVesselMapping> {
    if (this.postgresAvailable) {
      return this.postgresStorage.createFleetSpareVesselMappingRecord(mapping);
    }
    return this.fileStorage.createFleetSpareVesselMappingRecord(mapping);
  }

  async removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string): Promise<void> {
    if (this.postgresAvailable) {
      return this.postgresStorage.removeFleetSpareVesselMappingRecord(partCode, vesselCode);
    }
    return this.fileStorage.removeFleetSpareVesselMappingRecord(partCode, vesselCode);
  }

  // ============= DELEGATED METHODS (File Storage) =============
  // These are assigned in bindFileStorageMethods() and will be migrated
  // to PostgresStorage in future modules
  
  // Module 3: Methods NOT in PostgresStorage (remain delegated)
  getRunningHourParents!: IStorage['getRunningHourParents'];
  cascadeRunningHoursUpdate!: IStorage['cascadeRunningHoursUpdate'];
  
  // Module 7: Spares - now have explicit PostgreSQL routing above
  // archiveSparesByIds remains delegated (bound in bindFileStorageMethods)
  
  // Module 12 Change Requests - now have explicit PostgreSQL routing above
  
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
  
  // Module 10 Alerts - now have explicit PostgreSQL routing above
  // Module 11 Forms - now have explicit PostgreSQL routing above
  
  // Module 13 IHM - now have explicit PostgreSQL routing above
  
  // Module 3 methods (ComponentDocuments, ClassRegulatory, MaintenanceHistory, Requisitions)
  // are now explicitly routed to PostgresStorage above
  
  // Module 4: Jobs - now have explicit PostgreSQL routing above
  // Module 5: Work Orders - now have explicit PostgreSQL routing above
  
  getWorkOrderExecutions!: IStorage['getWorkOrderExecutions'];
  getWorkOrderExecutionById!: IStorage['getWorkOrderExecutionById'];
  createWorkOrderExecution!: IStorage['createWorkOrderExecution'];
  updateWorkOrderExecution!: IStorage['updateWorkOrderExecution'];
  
  // Module 9: Defects - now have explicit PostgreSQL routing above
  // Remaining delegated methods for recurring defect recalculation (complex logic in file storage)
  calculateAndUpdateRecurringDefects!: IStorage['calculateAndUpdateRecurringDefects'];
  recalculateAllRecurringDefects!: IStorage['recalculateAllRecurringDefects'];
  
  createImportHistory!: IStorage['createImportHistory'];
  getImportHistory!: IStorage['getImportHistory'];
  getImportHistoryById!: IStorage['getImportHistoryById'];
  updateImportHistory!: IStorage['updateImportHistory'];
  
  createImportChangeLog!: IStorage['createImportChangeLog'];
  getImportChangeLogs!: IStorage['getImportChangeLogs'];
  deleteImportChangeLogs!: IStorage['deleteImportChangeLogs'];
  
  
  purgeJobsAndLinkedData!: IStorage['purgeJobsAndLinkedData'];
  
  // Module 8 Stores methods - now have explicit PostgreSQL routing above
  
  // Legacy fleet vessel mappings (kept delegated for compatibility)
  createFleetVesselMappings!: IStorage['createFleetVesselMappings'];
  deleteFleetVesselMapping!: IStorage['deleteFleetVesselMapping'];
  
  generateOnDemandWorkOrder!: IStorage['generateOnDemandWorkOrder'];
  checkAndRevertPostponedWorkOrders!: IStorage['checkAndRevertPostponedWorkOrders'];
  
  // Module 14 Fleet Mappings - now have explicit PostgreSQL routing above
  
  // Legacy component vessel mappings (kept delegated for compatibility)
  getComponentVesselMappings!: IStorage['getComponentVesselMappings'];
  createComponentVesselMapping!: IStorage['createComponentVesselMapping'];
  deleteComponentVesselMapping!: IStorage['deleteComponentVesselMapping'];
  
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
