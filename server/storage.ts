
import crypto from "crypto";
import { generateFleetEquipmentCode, generateFleetJobCode, generateFleetPartCode } from "./utils/codeGeneration";
import { 
  users, 
  type User, 
  type InsertUser,
  fleets,
  type Fleet,
  type InsertFleet,
  vessels,
  type Vessel,
  type InsertVessel,
  components,
  type Component,
  type InsertComponent,
  runningHoursAudit,
  type RunningHoursAudit,
  type InsertRunningHoursAudit,
  spares,
  type Spare,
  type InsertSpare,
  sparesHistory,
  type SpareHistory,
  type InsertSpareHistory,
  changeRequest,
  type ChangeRequest,
  type InsertChangeRequest,
  changeRequestAttachment,
  type ChangeRequestAttachment,
  type InsertChangeRequestAttachment,
  changeRequestComment,
  type ChangeRequestComment,
  type InsertChangeRequestComment,
  alertPolicies,
  type AlertPolicy,
  type InsertAlertPolicy,
  alertEvents,
  type AlertEvent,
  type InsertAlertEvent,
  alertDeliveries,
  type AlertDelivery,
  type InsertAlertDelivery,
  alertConfig,
  type AlertConfig,
  type InsertAlertConfig,
  formDefinitions,
  type FormDefinition,
  type InsertFormDefinition,
  formVersions,
  type FormVersion,
  type InsertFormVersion,
  formVersionUsage,
  type FormVersionUsage,
  type InsertFormVersionUsage,
  jobs,
  type Job,
  type InsertJob,
  workOrders,
  type WorkOrder,
  type InsertWorkOrder,
  workOrderExecutions,
  type WorkOrderExecution,
  type InsertWorkOrderExecution,
  defects,
  type Defect,
  type InsertDefect,
  defectActions,
  type DefectAction,
  type InsertDefectAction,
  defectAttachments,
  type DefectAttachment,
  type InsertDefectAttachment,
  recurringDefects,
  type RecurringDefect,
  type InsertRecurringDefect,
  recurringDefectLinks,
  type RecurringDefectLink,
  type InsertRecurringDefectLink,
  importHistory,
  type ImportHistory,
  type InsertImportHistory,
  importChangeLog,
  type ImportChangeLog,
  type InsertImportChangeLog,
  makers,
  type Maker,
  type InsertMaker,
  masterLists,
  type MasterList,
  type InsertMasterList,
  componentDocuments,
  type ComponentDocument,
  insertComponentDocumentSchema,
  componentClassRegulatory,
  type ComponentClassRegulatory,
  insertComponentClassRegulatorySchema,
  componentMaintenanceHistory,
  type ComponentMaintenanceHistory,
  storesItems,
  type StoresItem,
  type InsertStoresItem,
  storesLedger,
  type StoresLedger,
  type InsertStoresLedger,
  certificates,
  type Certificate,
  type InsertCertificate,
  surveys,
  type Survey,
  type InsertSurvey,
  workOrderExecutionDetails,
  type WorkOrderExecutionDetails,
  type InsertWorkOrderExecutionDetails,
  ihmItems,
  type IhmItem,
  ihmMaintenanceLog,
  type IhmMaintenanceLog,
  pmsVesselSettings,
  type PmsVesselSettings,
  type InsertPmsVesselSettings,
  makerList,
  type MakerList,
  type InsertMakerList,
  fleetComponents,
  type FleetComponents,
  type InsertFleetComponents,
  sfiDetails,
  type SfiDetails,
  type InsertSfiDetails,
  masterData,
  type MasterData,
  type InsertMasterData,
  fleetVesselMapping,
  type FleetVesselMapping,
  type InsertFleetVesselMapping,
  fleetComponentMapping,
  type FleetComponentMapping,
  type InsertFleetComponentMapping,
  fleetJobs,
  type FleetJobs,
  type InsertFleetJobs,
  fleetJobVesselMapping,
  type FleetJobVesselMapping,
  type InsertFleetJobVesselMapping,
  fleetSpareVesselMapping,
  type FleetSpareVesselMapping,
  type FleetSpares,
  type InsertFleetSpares,
  type InsertFleetSpareVesselMapping,
  bulkImportHistory,
  type BulkImportHistory,
  type InsertBulkImportHistory,
  bulkImportErrors,
  type BulkImportError,
  type InsertBulkImportError,
  type Location,
  type InsertLocation,
  type SpareComponentLink,
  type InsertSpareComponentLink,
  type SpareLocationStock,
  type JobComponentLink,
  type InsertJobComponentLink,
  type InsertSpareLocationStock,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  type InventoryEventType,
  type InventoryReferenceType,
  type SpareWithInventory,
  workOrderPostponements,
  type WorkOrderPostponement,
  type InsertWorkOrderPostponement,
} from "@shared/schema";

export function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
  }
  
  return obj;
}

export function calculateRecordChecksum(record: any): string {
  try {
    // Exclude volatile fields that change between creation and retrieval
    const volatileFields = ['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'];
    const stableRecord = { ...record };
    for (const field of volatileFields) {
      delete stableRecord[field];
    }
    
    const sortedRecord = sortObjectKeys(stableRecord);
    const canonicalJson = JSON.stringify(sortedRecord, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
      }
      return value;
    });
    
    return crypto.createHash('sha256').update(canonicalJson).digest('hex');
  } catch (error) {
    console.error('Error calculating checksum:', error);
    return crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex');
  }
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  
  // Running Hours methods
  getComponents(vesselId: string): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, data: Partial<Component>): Promise<Component>;
  deleteComponent(id: string): Promise<void>;
  inactivateComponent(id: string, userId?: string, options?: { cascadeInactivate?: boolean }): Promise<{
    success: boolean;
    message: string;
    componentsInactivated: number;
    jobsInactivated: number;
    activeChildrenCount?: number;
  }>;
  createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit>;
  getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]>;
  getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<RunningHoursAudit[]>;
  
  // New: Get parent components with running-hour based child jobs
  getRunningHourParents(vesselId: string): Promise<Array<Component & { childCount: number; latestUpdate?: string }>>;
  
  // New: Cascade running hours update to parent and children
  cascadeRunningHoursUpdate(params: {
    parentComponentId: string;
    mode: 'setTotal' | 'addDelta';
    value: number;
    dateUpdated: string;
    comments?: string;
    meterReplaced?: boolean;
    oldMeterFinal?: string;
    newMeterStart?: string;
  }): Promise<{ 
    updatedComponents: number; 
    auditsCreated: number; 
    workOrdersGenerated: number;
    workOrders: any[];
  }>;
  
  // === RH Counter Type Methods (B7.B) ===
  // Get all MASTER components for a vessel (for RH source selection)
  getMasterComponents(vesselId: string): Promise<Component[]>;
  
  // Get all INHERITED components linked to a specific MASTER
  // vesselId parameter enforces vessel isolation to prevent cross-vessel RH aggregation
  getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]>;
  
  // Update RH counter type configuration for a component
  updateRHConfig(params: {
    componentId: string;
    rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN';
    rhMasterComponentId?: string | null;
    userId?: string;
  }): Promise<Component>;
  
  // Update MASTER running hours with automatic cascade to INHERITED components
  updateMasterRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
    userId: string;
    comments?: string;
  }): Promise<{ 
    masterUpdated: Component;
    inheritedUpdated: number;
  }>;
  
  // CENTRALIZED RH UPDATE: Set running hours for any component with automatic field sync
  // This is the ONLY method that should be used to update running hours to prevent field drift
  // It handles: syncing rhCurrentMaster/rhCurrentInheritedCached with currentCumulativeRH,
  // and propagating changes from MASTER to all INHERITED components
  setComponentRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION' | 'BULK_IMPORT' | 'WO_COMPLETION';
    userId: string;
    lastUpdatedDate?: string;
  }): Promise<{
    component: Component;
    inheritedUpdated: number;
  }>;
  
  // Fleet-Scoped Components (legacy - queries components table with dataScope='fleet')
  getFleetScopedComponents(): Promise<Component[]>;
  getFleetScopedComponent(id: string): Promise<Component | undefined>;
  createFleetScopedComponent(component: InsertComponent): Promise<Component>;
  updateFleetScopedComponent(id: string, data: Partial<Component>): Promise<Component>;
  deleteFleetScopedComponent(id: string): Promise<void>;
  
  // Spares methods
  getAllSpares(): Promise<Spare[]>;
  getSpares(vesselId: string): Promise<Spare[]>;
  getSpare(id: number): Promise<Spare | undefined>;
  createSpare(spare: InsertSpare): Promise<Spare>;
  updateSpare(id: number, data: Partial<Spare>): Promise<Spare>;
  deleteSpare(id: number): Promise<void>;
  consumeSpare(id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  consumeSpareFromLocation(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, workOrderRef?: string, dateLocal?: string): Promise<{
    spare: Spare;
    deducted: number;
    requested: number;
    shortageQty: number;
  }>;
  receiveSpare(id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  receiveSpareToLocation(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, supplierPO?: string, dateLocal?: string): Promise<{
    spare: Spare;
    received: number;
  }>;
  bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]>;
  adjustSpareQuantity(
    spareId: number,
    qtyChange: number,
    eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST',
    reference?: string,
    notes?: string
  ): Promise<Spare>;
  adjustSpareAtLocation(
    id: number,
    newRob: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<Spare>;
  transferSpareLocation(
    id: number,
    newRobLocationA: number,
    newRobLocationB: number,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<{ spare: Spare; isTransfer: boolean }>;
  
  // Fleet Spares methods (new fleet_spares table)
  getFleetSparesFromTable(): Promise<FleetSpares[]>;
  getFleetSpareFromTable(id: number): Promise<FleetSpares | undefined>;
  createFleetSpareInTable(spare: InsertFleetSpares): Promise<FleetSpares>;
  updateFleetSpareInTable(id: number, data: Partial<FleetSpares>): Promise<FleetSpares>;
  deleteFleetSpareFromTable(id: number): Promise<void>;
  getFleetSpareByPartCode(partCode: string): Promise<FleetSpares | undefined>;

  // Legacy Fleet Spares methods (spares table with dataScope='fleet')
  getFleetSpares(): Promise<Spare[]>;
  getFleetSpare(id: number): Promise<Spare | undefined>;
  createFleetSpare(spare: InsertSpare): Promise<Spare>;
  updateFleetSpare(id: number, data: Partial<Spare>): Promise<Spare>;
  deleteFleetSpare(id: number): Promise<void>;
  
  // Spares History methods
  getSpareHistory(vesselId: string): Promise<SpareHistory[]>;
  getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]>;
  createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory>;
  
  // Change Request methods
  getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string }): Promise<ChangeRequest[]>;
  getChangeRequest(id: number): Promise<ChangeRequest | undefined>;
  createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest>;
  updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest>;
  updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest>;
  updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest>;
  deleteChangeRequest(id: number): Promise<void>;
  submitChangeRequest(id: number, userId: string): Promise<ChangeRequest>;
  approveChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>;
  rejectChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>;
  returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>;
  applyApprovedChanges(changeRequest: ChangeRequest): Promise<{ appliedFieldCount: number }>;
  
  // Change Request Attachments
  getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]>;
  createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment>;
  
  // Change Request Comments
  getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]>;
  createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment>;
  
  // Bulk Import methods
  bulkCreateComponents(components: InsertComponent[]): Promise<Component[]>;
  bulkUpdateComponents(components: Array<{ id: string; data: Partial<Component> }>): Promise<Component[]>;
  bulkUpsertComponents(components: InsertComponent[]): Promise<{ created: number; updated: number }>;
  bulkCreateSpares(spares: InsertSpare[]): Promise<Spare[]>;
  bulkUpdateSparesByROB(spares: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]>;
  bulkUpsertSpares(spares: InsertSpare[]): Promise<{ created: number; updated: number }>;
  archiveComponentsByIds(ids: string[]): Promise<number>;
  archiveSparesByIds(ids: number[]): Promise<number>;
  
  // Bulk prefetch methods for performance
  getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, Component>>;
  getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, Job>>;
  getWorkOrdersByTemplateIds(templateIds: string[], vesselId?: string): Promise<Map<string, WorkOrder>>;
  
  // Individual archive methods
  archiveComponent(id: string): Promise<Component>;
  archiveJob(id: string): Promise<Job>;
  archiveWorkOrder(id: string): Promise<WorkOrder>;
  
  // Alert methods
  getAlertPolicies(): Promise<AlertPolicy[]>;
  getAlertPolicy(id: number): Promise<AlertPolicy | undefined>;
  createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy>;
  updateAlertPolicy(id: number, data: Partial<AlertPolicy>): Promise<AlertPolicy>;
  deleteAlertPolicy(id: number): Promise<void>;
  
  getAlertEvents(filters?: { startDate?: Date; endDate?: Date; alertType?: string; priority?: string; status?: string; vesselId?: string }): Promise<AlertEvent[]>;
  getAlertEvent(id: number): Promise<AlertEvent | undefined>;
  createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent>;
  acknowledgeAlertEvent(id: number, userId: string): Promise<AlertEvent>;
  
  getAlertDeliveries(eventId: number): Promise<AlertDelivery[]>;
  createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery>;
  updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery>;
  
  getAlertConfig(vesselId: string): Promise<AlertConfig | undefined>;
  createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig>;
  
  // Form Definition methods
  getFormDefinitions(): Promise<FormDefinition[]>;
  getFormDefinition(id: number): Promise<FormDefinition | undefined>;
  getFormDefinitionByName(name: string): Promise<FormDefinition | undefined>;
  createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition>;
  
  // Form Version methods
  getFormVersions(formId: number): Promise<FormVersion[]>;
  getFormVersion(id: number): Promise<FormVersion | undefined>;
  getLatestPublishedVersion(formId: number): Promise<FormVersion | undefined>;
  getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined>;
  createFormVersion(version: InsertFormVersion): Promise<FormVersion>;
  updateFormVersion(id: number, data: Partial<FormVersion>): Promise<FormVersion>;
  publishFormVersion(id: number, userId: string, changelog: string): Promise<FormVersion>;
  discardFormVersion(id: number): Promise<void>;
  
  // Form Version Usage methods
  createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage>;
  getFormVersionUsage(formVersionId: number): Promise<FormVersionUsage[]>;
  
  // Seed forms method
  seedForms(): Promise<void>;
  
  // IHM methods
  getIhmItem(id: string, type: 'component' | 'spare'): Promise<any | undefined>;
  upsertIhmItem(item: any): Promise<any>;
  getIhmMaintenanceLog(filters: any): Promise<any[]>;
  createIhmMaintenanceLogEntry(entry: any): Promise<any>;
  getIhmStatusReport(vesselId: string): Promise<any[]>;
  
  // Component Documents methods
  getComponentDocuments(componentId: string): Promise<any[]>;
  getComponentDocument(id: number): Promise<any | undefined>;
  createComponentDocument(doc: any): Promise<any>;
  updateComponentDocument(id: number, data: any): Promise<any>;
  deleteComponentDocument(id: number): Promise<void>;
  
  // Component Class Regulatory methods
  getComponentClassRegulatory(componentId: string): Promise<any[]>;
  getComponentClassRegulatoryItem(id: number): Promise<any | undefined>;
  createComponentClassRegulatory(item: any): Promise<any>;
  updateComponentClassRegulatory(id: number, data: any): Promise<any>;
  deleteComponentClassRegulatory(id: number): Promise<void>;
  
  // Component Maintenance History methods
  getAllComponentMaintenanceHistory(): Promise<any[]>;
  getComponentMaintenanceHistory(componentId: string): Promise<any[]>;
  getComponentMaintenanceHistoryByCode(componentCode: string, vesselCode: string): Promise<any[]>;
  getMaintenanceHistoryByJobId(jobId: string): Promise<any[]>;
  getMaintenanceHistoryByJobCode(jobCode: string): Promise<any[]>;
  getComponentMaintenanceHistoryItem(id: number): Promise<any | undefined>;
  getMaintenanceHistoryByWorkOrderId(workOrderId: string): Promise<any | undefined>;
  createComponentMaintenanceHistory(history: any): Promise<any>;
  
  // Component Requisitions methods (Section H)
  getComponentRequisitions(componentId: string): Promise<any[]>;
  getAllComponentRequisitions(vesselCode?: string): Promise<any[]>;
  getComponentRequisitionItem(id: number): Promise<any | undefined>;
  createComponentRequisition(item: any): Promise<any>;
  updateComponentRequisition(id: number, data: any): Promise<any>;
  deleteComponentRequisition(id: number): Promise<void>;
  
  // Jobs methods (Templates for maintenance jobs linked to components)
  getJobs(vesselId?: string, componentId?: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  bulkCreateJobs(jobs: InsertJob[]): Promise<Job[]>;
  bulkUpdateJobs(jobs: Array<{ jobNo: string; data: Partial<Job> }>): Promise<Job[]>;
  bulkUpsertJobs(jobs: InsertJob[]): Promise<{ created: number; updated: number }>;
  
  // Work Order methods
  getWorkOrders(vesselId?: string): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;
  bulkCreateWorkOrders(workOrders: InsertWorkOrder[]): Promise<WorkOrder[]>;
  bulkUpdateWorkOrders(workOrders: Array<{ templateCode: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]>;
  bulkUpsertWorkOrders(workOrders: InsertWorkOrder[]): Promise<{ created: number; updated: number }>;
  
  
  // Work Order Execution methods
  getWorkOrderExecutions(componentId: string): Promise<WorkOrderExecution[]>;
  getWorkOrderExecutionById(id: string): Promise<WorkOrderExecution | null>;
  createWorkOrderExecution(data: InsertWorkOrderExecution): Promise<WorkOrderExecution>;
  updateWorkOrderExecution(id: string, data: Partial<InsertWorkOrderExecution>): Promise<WorkOrderExecution>;
  
  // Defects methods
  getDefects(filters?: { 
    vesselId?: string; 
    status?: string; 
    statusView?: 'active' | 'resolved'; // Add support for active/resolved filtering
    category?: string; 
    critical?: boolean; 
    includeClosedDefects?: boolean;
    search?: string;
    period?: string;
    fleet?: string;
    group?: string;
    dueOverdue?: string;
  }): Promise<Defect[]>;
  getDefectsCount(filters?: { 
    statusView?: 'active' | 'resolved'; 
    vesselId?: string; 
    isCoC?: boolean;
    category?: string;
    search?: string;
    period?: string;
    fleet?: string;
    group?: string;
    dueOverdue?: string;
  }): Promise<number>;
  getDefect(id: string): Promise<Defect | undefined>;
  createDefect(defect: InsertDefect): Promise<Defect>;
  updateDefect(id: string, updates: Partial<InsertDefect>): Promise<Defect>;
  deleteDefect(id: string): Promise<void>;
  
  // Defect Actions methods
  getDefectActions(defectId: string): Promise<DefectAction[]>;
  createDefectAction(action: InsertDefectAction): Promise<DefectAction>;
  updateDefectAction(id: number, updates: Partial<InsertDefectAction>): Promise<DefectAction>;
  deleteDefectAction(id: number): Promise<void>;
  
  // Defect Attachments methods
  getDefectAttachments(defectId: string): Promise<DefectAttachment[]>;
  createDefectAttachment(attachment: InsertDefectAttachment): Promise<DefectAttachment>;
  deleteDefectAttachment(id: number): Promise<void>;
  
  // Defect Notes methods
  addDefectNote(defectId: string, note: { noteText: string; attachments: string[]; createdBy: string; }): Promise<Defect>;
  
  // Defect Linking methods
  linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect>;
  
  // Defect Closure methods
  closeDefect(defectId: string, closure: { closedBy: string; closureComment: string; closureFiles?: string[] }): Promise<Defect>;
  
  // Recurring Defects methods
  getRecurringDefects(filters?: { windowMonths?: number; minOccurrences?: number; hasCoc?: boolean; equipmentKey?: string }): Promise<RecurringDefect[]>;
  getRecurringDefect(id: number): Promise<RecurringDefect | undefined>;
  calculateAndUpdateRecurringDefects(equipmentKey: string, windowMonths?: number): Promise<RecurringDefect | null>;
  getRecurringDefectLinks(recurringId: number): Promise<RecurringDefectLink[]>;
  getDefectsForRecurring(recurringId: number): Promise<Defect[]>;
  recalculateAllRecurringDefects(): Promise<void>;
  
  // Seed helper methods
  getDefectBySeedId(seedId: string): Promise<Defect | undefined>;
  getVesselIdByName(vesselName: string): Promise<string | undefined>;
  createVessel(vessel: InsertVessel): Promise<Vessel>;
  
  // Import History methods
  createImportHistory(history: InsertImportHistory): Promise<ImportHistory>;
  getImportHistory(type?: string, limit?: number, offset?: number): Promise<{ items: ImportHistory[]; total: number }>;
  getImportHistoryById(id: string): Promise<ImportHistory | undefined>;
  updateImportHistory(id: string, data: Partial<ImportHistory>): Promise<ImportHistory>;
  
  // Import Change Log methods
  createImportChangeLog(log: InsertImportChangeLog): Promise<ImportChangeLog>;
  getImportChangeLogs(importHistoryId: string): Promise<ImportChangeLog[]>;
  deleteImportChangeLogs(importHistoryId: string): Promise<void>;
  
  // Fleet Admin - Makers methods (uses maker_list table)
  getMakers(search?: string): Promise<MakerList[]>;
  getMakerById(id: number): Promise<MakerList | undefined>;
  createMaker(maker: InsertMakerList): Promise<MakerList>;
  updateMaker(id: number, data: Partial<InsertMakerList>): Promise<MakerList>;
  deleteMaker(id: number): Promise<void>;
  
  // Fleet Admin - Master Lists methods
  getMasterLists(listType?: string): Promise<MasterList[]>;
  getMasterListById(id: number): Promise<MasterList | undefined>;
  getMasterListsByType(listType: string): Promise<MasterList[]>;
  createMasterList(list: InsertMasterList): Promise<MasterList>;
  updateMasterList(id: number, data: Partial<InsertMasterList>): Promise<MasterList>;
  deleteMasterList(id: number): Promise<void>;
  
  // Data Purge methods
  purgeJobsAndLinkedData(vesselId?: string): Promise<{
    deletedWorkOrderExecutions: number;
    deletedWorkOrders: number;
    deletedJobs: number;
    deletedRunningHoursAudits: number;
    componentsReset: number;
  }>;
  
  // Stores methods - ZERO PMS linkages (no componentId, workOrderId, jobId)
  getStoresItems(vesselId: string, itemType?: string): Promise<StoresItem[]>;
  getStoresItem(id: number): Promise<StoresItem | undefined>;
  createStoresItem(item: InsertStoresItem, userId?: string): Promise<StoresItem>;
  updateStoresItem(id: number, data: Partial<StoresItem>): Promise<StoresItem>;
  deleteStoresItem(id: number): Promise<void>;
  consumeStoresItem(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  receiveStoresItem(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, ref?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  transferStoresItemLocation(id: number, newRobLocationA: string, newRobLocationB: string, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<{ item: StoresItem; isTransfer: boolean }>;
  adjustStoresItem(id: number, newRob: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<StoresLedger[]>;
  getStoresItemHistory(itemId: number): Promise<StoresLedger[]>;
  
  // Fleet Vessel Mapping methods (Rule #16)
  getFleetVesselMappings(): Promise<any[]>;
  createFleetVesselMappings(data: {
    fleetEntityType: 'component' | 'job' | 'spare';
    fleetEntityIds: string[];
    vesselId: string;
    vesselEntityId?: string;
    vesselEntityCode?: string;
    mappedBy: string;
  }): Promise<any[]>;
  deleteFleetVesselMapping(id: string): Promise<void>;
  getVessels(): Promise<Array<{id: string, name: string, code: string}>>;
  
  // On-Demand Work Order Generation (Rule #4)
  // activeComponentCode: optional override for multi-linked jobs to bind WO to specific component context
  generateOnDemandWorkOrder(jobId: string, reason: 'Planning' | 'Breakdown' | 'Other', activeComponentCode?: string): Promise<WorkOrder>;
  
  // Postponed WO Reappearance (Rule #5)
  checkAndRevertPostponedWorkOrders(vesselId?: string): Promise<{
    revertedCount: number;
    revertedWorkOrders: WorkOrder[];
  }>;
  
  // PMS Vessel Settings - Lead Time & Grace Period Configuration
  getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined>;
  getAllPmsVesselSettings(): Promise<PmsVesselSettings[]>;
  createOrUpdatePmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings>;
  deletePmsVesselSettings(vesselId: string): Promise<void>;
  
  // Maker List - Master data for manufacturers
  getMakerList(): Promise<MakerList[]>;
  getMakerListItem(id: number): Promise<MakerList | undefined>;
  getMakerListByCode(makerCode: string): Promise<MakerList | undefined>;
  createMakerListItem(maker: InsertMakerList): Promise<MakerList>;
  updateMakerListItem(id: number, data: Partial<MakerList>): Promise<MakerList>;
  deleteMakerListItem(id: number): Promise<void>;
  
  // Fleet Components - Fleet Equipment Master Data
  getFleetComponents(): Promise<FleetComponents[]>;
  getFleetComponent(id: number): Promise<FleetComponents | undefined>;
  getFleetComponentByCode(fleetEquipmentCode: string): Promise<FleetComponents | undefined>;
  createFleetComponent(data: InsertFleetComponents): Promise<FleetComponents>;
  updateFleetComponent(id: number, data: Partial<FleetComponents>): Promise<FleetComponents>;
  deleteFleetComponent(id: number): Promise<void>;
  
  // Fleet Jobs - Fleet-level Job Master Data
  getFleetJobs(): Promise<FleetJobs[]>;
  getFleetJob(id: number): Promise<FleetJobs | undefined>;
  getFleetJobByCode(jobCode: string): Promise<FleetJobs | undefined>;
  createFleetJob(data: InsertFleetJobs): Promise<FleetJobs>;
  updateFleetJob(id: number, data: Partial<FleetJobs>): Promise<{ updatedJob: FleetJobs; affectedCount: number }>;
  deleteFleetJob(id: number): Promise<void>;
  
  // SFI Details - SFI Code lookup table
  getSfiDetails(): Promise<SfiDetails[]>;
  getSfiDetail(id: number): Promise<SfiDetails | undefined>;
  getSfiByCode(componentCode: string): Promise<SfiDetails | undefined>;
  createSfiDetail(sfi: InsertSfiDetails): Promise<SfiDetails>;
  updateSfiDetail(id: number, data: Partial<SfiDetails>): Promise<SfiDetails>;
  deleteSfiDetail(id: number): Promise<void>;
  
  // Master Data - Fleet Equipment Code generation and tracking
  getMasterDataList(): Promise<MasterData[]>;
  getMasterDataItem(id: number): Promise<MasterData | undefined>;
  getMasterDataByFleetCode(fleetEquipmentCode: string): Promise<MasterData | undefined>;
  getMasterDataByMakerModel(makerCode: string, model: string): Promise<MasterData | undefined>;
  createMasterData(data: InsertMasterData): Promise<MasterData>;
  updateMasterData(id: number, data: Partial<MasterData>): Promise<MasterData>;
  deleteMasterData(id: number): Promise<void>;
  generateFleetEquipmentCode(sfiCode: string): Promise<string>;
  
  // Fleet Vessel Mapping - Links Fleet Equipment to Vessels
  getFleetVesselMappings(fleetEquipmentCode?: string): Promise<FleetVesselMapping[]>;
  getFleetVesselMappingsByVessel(vesselCode: string): Promise<FleetVesselMapping[]>;
  createFleetVesselMappingRecord(mapping: InsertFleetVesselMapping): Promise<FleetVesselMapping>;
  removeFleetVesselMappingRecord(fleetEquipmentCode: string, vesselCode: string): Promise<void>;
  
  // Component Vessel Mapping - For Fleet Data View vessel mappings
  getComponentVesselMappings(): Promise<any[]>;
  createComponentVesselMapping(data: { 
    fleetEquipmentCode: string; 
    vesselCode: string; 
    vesselName: string; 
    componentCode?: string; 
    componentName?: string;
  }): Promise<any>;
  deleteComponentVesselMapping(id: number): Promise<void>;
  
  // Fleet Component Mapping - Links Fleet Equipment to Vessel Components
  getFleetComponentMappings(fleetEquipmentCode?: string): Promise<FleetComponentMapping[]>;
  getFleetComponentMappingsByVessel(vesselCode?: string): Promise<FleetComponentMapping[]>;
  createFleetComponentMappingRecord(mapping: InsertFleetComponentMapping): Promise<FleetComponentMapping>;
  removeFleetComponentMappingRecord(fleetEquipmentCode: string, vesselCode: string, componentCode: string): Promise<void>;
  
  // Fleet Job Vessel Mapping - Links Fleet Jobs to Vessels  
  getFleetJobVesselMappings(fleetEquipmentCode?: string, jobCode?: string): Promise<FleetJobVesselMapping[]>;
  createFleetJobVesselMappingRecord(mapping: InsertFleetJobVesselMapping): Promise<FleetJobVesselMapping>;
  removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string): Promise<void>;
  
  // Fleet Spare Vessel Mapping - Links Fleet Spares to Vessels
  getFleetSpareVesselMappings(fleetEquipmentCode?: string, partCode?: string): Promise<FleetSpareVesselMapping[]>;
  createFleetSpareVesselMappingRecord(mapping: InsertFleetSpareVesselMapping): Promise<FleetSpareVesselMapping>;
  removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string): Promise<void>;
  
  // Bulk Import History - Tracking all bulk imports
  getBulkImportHistory(vesselCode?: string, moduleType?: string): Promise<BulkImportHistory[]>;
  getBulkImportHistoryItem(id: number): Promise<BulkImportHistory | undefined>;
  createBulkImportHistory(history: InsertBulkImportHistory): Promise<BulkImportHistory>;
  updateBulkImportHistory(id: number, data: Partial<BulkImportHistory>): Promise<BulkImportHistory>;
  
  // Bulk Import Errors - Detailed error tracking
  getBulkImportErrors(importId: number): Promise<BulkImportError[]>;
  createBulkImportError(error: InsertBulkImportError): Promise<BulkImportError>;
  createBulkImportErrors(errors: InsertBulkImportError[]): Promise<BulkImportError[]>;
  
  // Fleet Admin Dashboard Metrics
  getFleetAdminMetrics(): Promise<{
    totalMakers: number;
    totalModels: number;
    totalFleetComponents: number;
    totalMasterLists: number;
  }>;
  
  // Fleet Management methods (for organizing vessels into fleets)
  getAllFleets(): Promise<Fleet[]>;
  getFleets(): Promise<Fleet[]>;
  getFleetById(id: string): Promise<Fleet | undefined>;
  createFleet(fleet: InsertFleet): Promise<Fleet>;
  updateFleet(id: string, data: Partial<Fleet>): Promise<Fleet>;
  deleteFleet(id: string): Promise<void>;
  getVesselsByFleet(fleetId: string): Promise<Vessel[]>;
  assignVesselToFleet(vesselId: string, fleetId: string | null): Promise<Vessel>;
  getVesselsWithFleets(): Promise<Array<Vessel & { fleetName?: string; fleetCode?: string }>>;
  updateVessel(id: string, data: Partial<Vessel>): Promise<Vessel>;
  
  // Certificate methods for Cert & Surveys module
  getCertificates(): Promise<Certificate[]>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, data: Partial<Certificate>): Promise<Certificate>;
  deleteCertificate(id: string): Promise<void>;
  
  // Survey methods for Cert & Surveys module
  getSurveys(): Promise<Survey[]>;
  getSurvey(id: string): Promise<Survey | undefined>;
  createSurvey(survey: InsertSurvey): Promise<Survey>;
  updateSurvey(id: string, data: Partial<Survey>): Promise<Survey>;
  deleteSurvey(id: string): Promise<void>;
  
  // Work Order Execution Details
  getWorkOrderExecutionDetails(workOrderId: string): Promise<WorkOrderExecutionDetails[]>;
  getWorkOrderExecutionDetailById(id: number): Promise<WorkOrderExecutionDetails | undefined>;
  createWorkOrderExecutionDetail(detail: InsertWorkOrderExecutionDetails): Promise<WorkOrderExecutionDetails>;
  updateWorkOrderExecutionDetail(id: number, data: Partial<WorkOrderExecutionDetails>): Promise<WorkOrderExecutionDetails>;
  
  // Work Order Postponements (History/Audit Table)
  getWorkOrderPostponements(vesselId: string, filters?: { 
    workOrderId?: string; 
    status?: string; 
    dateFrom?: string; 
    dateTo?: string;
  }): Promise<WorkOrderPostponement[]>;
  getWorkOrderPostponementById(id: string): Promise<WorkOrderPostponement | undefined>;
  getWorkOrderPostponementsByWorkOrderId(workOrderId: string): Promise<WorkOrderPostponement[]>;
  getWorkOrderPostponementCount(workOrderId: string): Promise<number>;
  createWorkOrderPostponement(postponement: InsertWorkOrderPostponement): Promise<WorkOrderPostponement>;
  updateWorkOrderPostponement(id: string, updates: Partial<InsertWorkOrderPostponement>): Promise<WorkOrderPostponement>;
  
  // ============= INVENTORY MANAGEMENT =============
  
  // Location Methods
  getLocations(vesselId: string): Promise<Location[]>;
  getLocationById(id: number): Promise<Location | undefined>;
  getLocationByName(vesselId: string, locationName: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  findOrCreateLocation(vesselId: string, locationName: string, createdBy: string): Promise<Location>;
  findLocationStrict(vesselId: string, locationName: string): Promise<Location>;
  updateLocation(id: number, data: Partial<Location>): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  
  // Spare-Component Link Methods
  getSpareComponentLinks(vesselId: string): Promise<SpareComponentLink[]>;
  getSpareComponentLinksBySpare(spareId: number): Promise<SpareComponentLink[]>;
  getSpareComponentLinksByComponent(componentId: string): Promise<SpareComponentLink[]>;
  createSpareComponentLink(link: InsertSpareComponentLink): Promise<SpareComponentLink>;
  deleteSpareComponentLink(spareId: number, componentId: string): Promise<void>;
  getLinkedComponentsForSpare(spareId: number): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>>;
  
  // Job-Component Link Methods (many-to-many for shared jobs)
  getJobComponentLinks(vesselId: string): Promise<JobComponentLink[]>;
  getAllJobComponentLinks(): Promise<JobComponentLink[]>;
  getJobComponentLinksByJob(jobId: string): Promise<JobComponentLink[]>;
  getJobComponentLinksByComponent(componentId: string): Promise<JobComponentLink[]>;
  createJobComponentLink(link: InsertJobComponentLink): Promise<JobComponentLink>;
  deleteJobComponentLink(jobId: string, componentId: string): Promise<void>;
  getLinkedComponentsForJob(jobId: string): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>>;
  getLinkedJobsForComponent(componentId: string): Promise<Array<{ jobId: string; jobNo: string; jobTitle: string }>>;
  // Get maintenance history for a specific job-component pair
  getMaintenanceHistoryByJobAndComponent(jobId: string, componentCode: string): Promise<any[]>;
  // Component-specific tracking updates (prevents data mixing between components)
  // VESSEL ISOLATION: vesselId is REQUIRED to prevent cross-vessel data contamination
  updateJobComponentLinkTracking(vesselId: string, jobId: string, componentId: string, updates: {
    lastDoneDate?: string;
    nextDueDate?: string;
    lastDoneRH?: string;
    nextDueRH?: string;
    updatedAt?: Date;
  }): Promise<JobComponentLink | null>;
  // VESSEL ISOLATION: vesselId is REQUIRED to prevent cross-vessel data contamination
  getJobComponentLinkWithTracking(vesselId: string, jobId: string, componentId: string): Promise<JobComponentLink | null>;
  
  // Spare Location Stock Methods
  getSpareLocationStock(spareId: number): Promise<SpareLocationStock[]>;
  getSpareLocationStockByLocation(locationId: number): Promise<SpareLocationStock[]>;
  getSpareLocationStockItem(spareId: number, locationId: number): Promise<SpareLocationStock | undefined>;
  upsertSpareLocationStock(data: InsertSpareLocationStock): Promise<SpareLocationStock>;
  updateSpareLocationStockQty(spareId: number, locationId: number, qtyChange: number): Promise<SpareLocationStock>;
  getSpareRobTotal(spareId: number): Promise<number>;
  getSpareLocationsWithQty(spareId: number): Promise<Array<{ locationId: number; locationName: string; qty: number }>>;
  getSparesAtLocation(locationId: number): Promise<Array<{ spareId: number; partCode: string; partName: string; qty: number }>>;
  getFullSparesAtLocation(locationId: number, vesselId: string): Promise<any[]>;
  getLocationsWithStock(vesselId: string): Promise<Array<{ id: number; locationName: string; sparesCount: number }>>;
  reconcileSpareLocationStock(vesselId: string, userId?: string): Promise<{ synced: number; errors: number }>;
  
  // Inventory Transaction Methods
  createInventoryTransaction(txn: InsertInventoryTransaction): Promise<InventoryTransaction>;
  getInventoryTransactions(vesselId: string, options?: {
    spareId?: number;
    locationId?: number;
    eventType?: InventoryEventType;
    limit?: number;
  }): Promise<InventoryTransaction[]>;
  performInventoryTransaction(input: {
    vesselId: string;
    spareId: number;
    locationId: number;
    eventType: InventoryEventType;
    qtyChange: number;
    referenceType: InventoryReferenceType;
    referenceId?: string;
    referenceNote?: string;
    userId: string;
  }): Promise<{ transaction: InventoryTransaction; newLocationQty: number; newTotalRob: number }>;
  
  // Enhanced Spare Data Methods
  getSpareWithInventory(spareId: number): Promise<SpareWithInventory | null>;
  getSparesWithInventoryByVessel(vesselId: string): Promise<SpareWithInventory[]>;
  getSparesWithInventoryByComponent(componentId: string): Promise<SpareWithInventory[]>;
  getSparesWithInventoryByComponentCode(vesselId: string, componentCode: string): Promise<SpareWithInventory[]>;
}

// Helper function to normalize and validate immediateCause structure
function normalizeImmediateCause(data: any): { unsafeAct: string[], unsafeCondition: string[] } | null {
  if (!data) return null;
  
  // If it's a string (for backward compatibility), return null to indicate no structured data
  if (typeof data === 'string') return null;
  
  // If it's already an object, validate and normalize
  if (typeof data === 'object') {
    return {
      unsafeAct: Array.isArray(data.unsafeAct) ? data.unsafeAct.filter((item: any) => typeof item === 'string') : [],
      unsafeCondition: Array.isArray(data.unsafeCondition) ? data.unsafeCondition.filter((item: any) => typeof item === 'string') : []
    };
  }
  
  return null;
}

// Helper function to normalize and validate rootCause structure
function normalizeRootCause(data: any): { individualFactor: string[], systemFactor: string[] } | string | null {
  if (!data) return null;
  
  // If it's a string (for backward compatibility), preserve it as-is
  if (typeof data === 'string') return data;
  
  // If it's already an object, validate and normalize
  if (typeof data === 'object') {
    return {
      individualFactor: Array.isArray(data.individualFactor) ? data.individualFactor.filter((item: any) => typeof item === 'string') : [],
      systemFactor: Array.isArray(data.systemFactor) ? data.systemFactor.filter((item: any) => typeof item === 'string') : []
    };
  }
  
  return null;
}

// Dynamic storage selection using StorageFactory
import { getStorage, initializeStorage } from "./storageFactory";

let _storage: IStorage | null = null;

// Getter for storage with validation
function getStorageInstance(): IStorage {
  if (!_storage) {
    throw new Error(
      'Storage not initialized. Call initStorage() before accessing storage. ' +
      'This error typically occurs when storage is accessed before server startup completes.'
    );
  }
  return _storage;
}

// Initialize storage using the factory
// Supports PostgreSQL (when DATABASE_URL set) or file-based fallback
async function initStorage(): Promise<void> {
  if (_storage !== null) return;
  
  console.log('🔧 Initializing storage...');
  console.log(`🔍 DATABASE_URL: ${process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND'}`);
  
  _storage = await initializeStorage();
  console.log('✅ Storage initialization complete');
}

// Create a proxy that lazily accesses the storage
// This allows importing the module without immediate initialization
const storage = new Proxy({} as IStorage, {
  get(_target, prop) {
    const instance = getStorageInstance();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

// Export initialization function for server startup
export { storage, initStorage };
// Note: calculateRecordChecksum and sortObjectKeys are already exported via 'export function' declarations above
