
import crypto from "crypto";
import { generateFleetEquipmentCode, generateFleetJobCode, generateFleetPartCode } from "./utils/codeGeneration";
import { 
  users, 
  type User, 
  type InsertUser,
  fleets,
  type Fleet,
  type InsertFleet,
  fleetClasses,
  type FleetClass,
  type InsertFleetClass,
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
  type ChangeRequestApproval,
  type InsertChangeRequestApproval,
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
  type MasterListType,
  type InsertMasterListType,
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
  companyStandardGraceSettings,
  type CompanyStandardGraceSettings,
  type InsertCompanyStandardGraceSettings,
  type CompanyApprovalSettings,
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
  woPostponementApprovals,
  type WoPostponementApproval,
  type InsertWoPostponementApproval,
  superintendentNotifications,
  type SuperintendentNotification,
  type InsertSuperintendentNotification,
  type WorkOrderAnomaly,
  type InsertWorkOrderAnomaly,
  type AdmnRoleMaster,
  type AdmMenumasterAc,
  type AdmRoleMenuAccess,
  type ApprovalWorkflowConfig,
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
  getComponents(vesselId: string, vesselIds?: string[]): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, data: Partial<Component>): Promise<Component>;
  deleteComponent(id: string, userId?: string): Promise<void>;
  inactivateComponent(id: string, vesselId: string, userId?: string, apply?: boolean): Promise<{
    success: boolean;
    message: string;
    code?: string;
    componentsInactivated: number;
    activeChildrenCount?: number;
    activeJobsCount?: number;
    linkedSparesCount?: number;
    activeWorkOrdersCount?: number;
  }>;
  createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit>;
  getEarliestAuditTimestamp(vesselId: string): Promise<Date | null>;
  getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]>;
  getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<RunningHoursAudit[]>;
  sumPositiveDeltasInPeriod(componentId: string, startDate: Date, endDate: Date): Promise<number>;
  getRunningHoursAtDate(componentId: string, targetDate: Date): Promise<{ runningHours: number; enteredAtUTC: Date; isFallback?: boolean } | null>;
  
  // New: Get parent components with running-hour based child jobs
  getRunningHourParents(vesselId: string): Promise<Array<Component & { childCount: number; latestUpdate?: string }>>;
  
  // New: Cascade running hours update to parent and children
  cascadeRunningHoursUpdate(params: {
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
  accrueInstalledStampRh(params: {
    vesselId: string | null;
    currentStamp: string | null;
    delta: number;
    readingDateIso: string;
    userId: string | null;
  }): Promise<void>;

  // Atomic child (INHERITED) RH update with per-component lock + in-tx delta (Task #374)
  updateChildRhWithStampAccrual(params: {
    componentId: string;
    newRHValue: number;
    lastUpdated: string;
    readingDateIso: string;
    userId: string | null;
  }): Promise<{ previousRH: number }>;

  updateMasterRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION' | 'WORKORDER';
    userId: string;
    userUuid?: string;
    comments?: string;
    // Reading date (the date the running hours were observed), e.g. a WO completion date or
    // the "Date Updated" picked in the RH Section. Used for the stored reading date and the
    // component's last-updated stamps. Falls back to "now" when omitted/unparseable.
    dateUpdated?: string;
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
  getSpares(vesselId: string, vesselIds?: string[]): Promise<Spare[]>;
  getSpare(id: string): Promise<Spare | undefined>;
  createSpare(spare: InsertSpare, skipSiblingSync?: boolean): Promise<Spare>;
  updateSpare(id: string, data: Partial<Spare>, skipSiblingSync?: boolean): Promise<Spare>;
  deleteSpare(id: string): Promise<void>;
  consumeSpare(id: string, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  consumeSpareFromLocation(id: string, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, workOrderRef?: string, dateLocal?: string): Promise<{
    spare: Spare;
    deducted: number;
    requested: number;
    shortageQty: number;
  }>;
  receiveSpare(id: string, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  receiveSpareToLocation(id: string, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, supplierPO?: string, dateLocal?: string): Promise<{
    spare: Spare;
    received: number;
  }>;
  bulkUpdateSpares(updates: Array<{id: string, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]>;
  adjustSpareQuantity(
    spareId: string,
    qtyChange: number,
    eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST',
    reference?: string,
    notes?: string
  ): Promise<Spare>;
  adjustSpareAtLocation(
    id: string,
    newRob: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<Spare>;
  transferSpareLocation(
    id: string,
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
  getSpareHistory(vesselId: string, vesselIds?: string[]): Promise<SpareHistory[]>;
  getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]>;
  createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory>;
  createStoresLedgerEntryForImport(values: InsertStoresLedger): Promise<void>;
  
  // Change Request methods
  getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string; pendingForApprover?: string }): Promise<ChangeRequest[]>;
  getChangeRequest(id: number): Promise<ChangeRequest | undefined>;
  createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest>;
  updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest>;
  updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest>;
  updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest>;
  deleteChangeRequest(id: number): Promise<void>;
  submitChangeRequest(id: number, userId: string): Promise<ChangeRequest>;
  approveChangeRequest(id: number, reviewerId: string, comment: string, role?: string, overriddenChanges?: Array<{ field: string; approverNewValue: string }>): Promise<ChangeRequest>;
  rejectChangeRequest(id: number, reviewerId: string, comment: string, role?: string): Promise<ChangeRequest>;
  returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest>;
  applyApprovedChanges(changeRequest: ChangeRequest): Promise<{ appliedFieldCount: number }>;
  // Change Request Approval Steps
  getChangeRequestApprovalSteps(changeRequestId: number): Promise<ChangeRequestApproval[]>;
  createChangeRequestApprovalStep(step: InsertChangeRequestApproval): Promise<ChangeRequestApproval>;
  updateChangeRequestApprovalStep(id: number, data: Partial<ChangeRequestApproval>): Promise<ChangeRequestApproval>;
  
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
  bulkUpsertSpares(spares: InsertSpare[]): Promise<{ created: number; updated: number }>;
  archiveComponentsByIds(ids: string[]): Promise<number>;

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
  getAlertPolicy(id: string): Promise<AlertPolicy | undefined>;
  createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy>;
  updateAlertPolicy(id: string, data: Partial<AlertPolicy>): Promise<AlertPolicy>;
  deleteAlertPolicy(id: string): Promise<void>;

  getAlertEvents(filters?: { startDate?: Date; endDate?: Date; alertType?: string; priority?: string; status?: string; vesselId?: string }): Promise<AlertEvent[]>;
  getAlertEvent(id: string): Promise<AlertEvent | undefined>;
  createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent>;
  acknowledgeAlertEvent(id: string, userId: string): Promise<AlertEvent>;

  getAlertDeliveries(eventId: string): Promise<AlertDelivery[]>;
  createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery>;
  updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery>;
  
  getAlertConfig(vesselId: string): Promise<AlertConfig | undefined>;
  createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig>;
  
  // Form Definition methods
  getFormDefinitions(): Promise<FormDefinition[]>;
  getFormDefinition(id: string): Promise<FormDefinition | undefined>;
  getFormDefinitionByName(name: string): Promise<FormDefinition | undefined>;
  createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition>;

  // Form Version methods
  getFormVersions(formId: string): Promise<FormVersion[]>;
  getFormVersion(id: string): Promise<FormVersion | undefined>;
  getLatestPublishedVersion(formId: string): Promise<FormVersion | undefined>;
  getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined>;
  createFormVersion(version: InsertFormVersion): Promise<FormVersion>;
  updateFormVersion(id: string, data: Partial<FormVersion>): Promise<FormVersion>;
  publishFormVersion(id: string, userId: string, changelog: string): Promise<FormVersion>;
  discardFormVersion(id: string): Promise<void>;

  // Form Version Usage methods
  createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage>;
  getFormVersionUsage(formVersionId: string): Promise<FormVersionUsage[]>;
  
  // Seed forms method
  seedForms(): Promise<void>;
  
  // IHM methods
  getIhmItem(id: string, type: 'component' | 'spare'): Promise<any | undefined>;
  upsertIhmItem(item: any): Promise<any>;
  getIhmMaintenanceLog(filters: any): Promise<any[]>;
  createIhmMaintenanceLogEntry(entry: any): Promise<any>;
  getIhmStatusReport(vesselId: string, vesselIds?: string[]): Promise<any[]>;
  
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
  getMaintenanceHistoryByVessel(vesselId: string): Promise<any[]>;
  createComponentMaintenanceHistory(history: any): Promise<any>;
  
  // Component Requisitions methods (Section H)
  getComponentRequisitions(componentId: string): Promise<any[]>;
  getAllComponentRequisitions(vesselCode?: string): Promise<any[]>;
  getComponentRequisitionItem(id: number): Promise<any | undefined>;
  createComponentRequisition(item: any): Promise<any>;
  updateComponentRequisition(id: number, data: any): Promise<any>;
  deleteComponentRequisition(id: number): Promise<void>;
  
  // Jobs methods (Templates for maintenance jobs linked to components)
  getJobs(vesselId?: string, componentId?: string, vesselIds?: string[]): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  bulkCreateJobs(jobs: InsertJob[]): Promise<Job[]>;
  bulkUpdateJobs(jobs: Array<{ jobNo: string; data: Partial<Job> }>): Promise<Job[]>;
  bulkUpsertJobs(jobs: InsertJob[]): Promise<{ created: number; updated: number }>;
  
  // Work Order methods
  getWorkOrders(vesselId?: string, vesselIds?: string[]): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  getWorkOrderByCode(code: string): Promise<WorkOrder | undefined>;
  getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;
  bulkCreateWorkOrders(workOrders: InsertWorkOrder[]): Promise<WorkOrder[]>;

  // Superintendent Notification methods
  createSuperintendentNotification(notification: InsertSuperintendentNotification): Promise<SuperintendentNotification>;
  getSuperintendentNotifications(vesselName?: string): Promise<SuperintendentNotification[]>;
  getAllSuperintendentNotifications(vesselName?: string): Promise<SuperintendentNotification[]>;
  acknowledgeSuperintendentNotification(id: number): Promise<SuperintendentNotification>;

  // Work Order Anomaly methods (Layer 6)
  createWorkOrderAnomaly(anomaly: InsertWorkOrderAnomaly): Promise<WorkOrderAnomaly>;
  getWorkOrderAnomalies(filters?: {
    status?: string;
    severity?: string;
    vesselId?: string;
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<WorkOrderAnomaly[]>;
  getWorkOrderAnomalyByWorkOrderId(workOrderId: string): Promise<WorkOrderAnomaly[]>;
  acknowledgeWorkOrderAnomaly(id: number, reviewedBy: string, notes?: string): Promise<WorkOrderAnomaly>;
  getWorkOrderAnomalyStatistics(vesselId?: string): Promise<{
    totalPending: number;
    totalHigh: number;
    totalMedium: number;
    totalLow: number;
    lastDetected: Date | null;
    trendPercentage: number;
  }>;

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
  getVesselIdByName(vesselName: string, options?: { includeDeleted?: boolean }): Promise<string | undefined>;
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

  // Fleet Admin - Master List Types methods (DB-backed registry + Section mapping)
  getMasterListTypes(section?: string): Promise<MasterListType[]>;
  getAllMasterListTypesIncludingInactive(section?: string): Promise<MasterListType[]>;
  getMasterListTypeById(id: number): Promise<MasterListType | undefined>;
  getMasterListTypeByKey(key: string): Promise<MasterListType | undefined>;
  createMasterListType(data: InsertMasterListType & { createdByUuid?: string | null }): Promise<MasterListType>;
  updateMasterListType(id: number, data: Partial<InsertMasterListType> & { updatedByUuid?: string | null }): Promise<MasterListType>;
  softDeleteMasterListType(id: number, userUuid?: string | null): Promise<void>;
  countMasterListItemsByType(listTypeKey: string): Promise<number>;
  
  // Data Purge methods
  purgeJobsAndLinkedData(vesselId?: string): Promise<{
    deletedWorkOrderExecutions: number;
    deletedWorkOrders: number;
    deletedJobs: number;
    deletedRunningHoursAudits: number;
    componentsReset: number;
  }>;
  
  // Stores methods - ZERO PMS linkages (no componentId, workOrderId, jobId)
  getStoresItems(vesselId: string, itemType?: string, vesselIds?: string[]): Promise<StoresItem[]>;
  getStoresItem(id: string): Promise<StoresItem | undefined>;
  createStoresItem(item: InsertStoresItem, userId?: string): Promise<StoresItem>;
  updateStoresItem(id: string, data: Partial<StoresItem>): Promise<StoresItem>;
  deleteStoresItem(id: string): Promise<void>;
  inactivateStoresItem(id: string, vesselId?: string): Promise<void>;
  consumeStoresItem(id: string, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  receiveStoresItem(id: string, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, ref?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  transferStoresItemLocation(id: string, newRobLocationA: string, newRobLocationB: string, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<{ item: StoresItem; isTransfer: boolean }>;
  adjustStoresItem(id: string, newRob: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  getStoresTransactionHistory(vesselId: string, itemType?: string, vesselIds?: string[]): Promise<StoresLedger[]>;
  getStoresItemHistory(itemId: string): Promise<StoresLedger[]>;
  
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
  getVessel(id: string, options?: { includeDeleted?: boolean }): Promise<Vessel | undefined>;
  getVessels(options?: { includeDeleted?: boolean }): Promise<Array<{id: string, vuuid: string, name: string, code: string, vCode: string | null, imoNumber: string | null, vesselType: string | null}>>;
  
  // On-Demand Work Order Generation (Rule #4)
  // activeComponentCode: optional override for multi-linked jobs to bind WO to specific component context
  
  // Postponed WO Reappearance (Rule #5)
  checkAndRevertPostponedWorkOrders(vesselId?: string): Promise<{
    revertedCount: number;
    revertedWorkOrders: WorkOrder[];
  }>;
  
  // Audit Log
  createAuditLog(data: any): Promise<any>;
  getAuditLogs(filters?: any): Promise<any[]>;
  countAuditLogs(filters?: any): Promise<number>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<any[]>;

  // PMS Vessel Settings - Lead Time & Grace Period Configuration
  getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined>;
  getAllPmsVesselSettings(): Promise<PmsVesselSettings[]>;
  createOrUpdatePmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings>;
  deletePmsVesselSettings(vesselId: string): Promise<void>;

  // Company Standard Grace Settings - Singleton company-wide grace rule
  getCompanyStandardGraceSettings(): Promise<CompanyStandardGraceSettings | undefined>;
  upsertCompanyStandardGraceSettings(settings: InsertCompanyStandardGraceSettings): Promise<CompanyStandardGraceSettings>;

  // Company Approval Settings - Singleton approval policy (superintendent lock toggle)
  getCompanyApprovalSettings(): Promise<CompanyApprovalSettings | undefined>;
  upsertCompanyApprovalSettings(settings: { superintendentLockEnabled: boolean; updatedBy?: string | null }): Promise<CompanyApprovalSettings>;
  
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
  removeFleetJobVesselMappingRecord(jobCode: string, vesselCode: string, jobId?: string): Promise<void>;
  
  // Fleet Spare Vessel Mapping - Links Fleet Spares to Vessels
  getFleetSpareVesselMappings(fleetEquipmentCode?: string, partCode?: string): Promise<FleetSpareVesselMapping[]>;
  createFleetSpareVesselMappingRecord(mapping: InsertFleetSpareVesselMapping): Promise<FleetSpareVesselMapping>;
  removeFleetSpareVesselMappingRecord(partCode: string, vesselCode: string, spareId?: string): Promise<void>;
  
  // Bulk Import History - Tracking all bulk imports
  getBulkImportHistory(vesselCode?: string, moduleType?: string): Promise<BulkImportHistory[]>;
  getBulkImportHistoryItem(id: string): Promise<BulkImportHistory | undefined>;
  createBulkImportHistory(history: InsertBulkImportHistory): Promise<BulkImportHistory>;
  updateBulkImportHistory(id: string, data: Partial<BulkImportHistory>): Promise<BulkImportHistory>;

  // Bulk Import Errors - Detailed error tracking
  getBulkImportErrors(importId: string): Promise<BulkImportError[]>;
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
  getVesselsByFleet(fleetId: string, options?: { includeDeleted?: boolean }): Promise<Vessel[]>;
  assignVesselToFleet(vesselId: string, fleetId: string | null): Promise<Vessel>;
  getVesselsWithFleets(options?: { includeDeleted?: boolean }): Promise<Array<Vessel & { fleetName?: string; fleetCode?: string }>>;
  updateVessel(id: string, data: Partial<Vessel>): Promise<Vessel>;

  getFleetClasses(fleetId: string): Promise<FleetClass[]>;
  createFleetClass(data: InsertFleetClass): Promise<FleetClass>;
  updateFleetClass(fcuuid: string, data: Partial<FleetClass>): Promise<FleetClass>;
  deleteFleetClass(fcuuid: string): Promise<void>;
  assignVesselToClass(vesselId: string, classId: string | null): Promise<Vessel>;
  
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
  }, vesselIds?: string[]): Promise<WorkOrderPostponement[]>;
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
  getSpareComponentLinkCountByVessel(vesselId: string): Promise<number>;
  createSpareComponentLink(link: InsertSpareComponentLink, skipSiblingSync?: boolean): Promise<SpareComponentLink>;
  deleteSpareComponentLink(spareId: number, componentId: string): Promise<void>;
  getLinkedComponentsForSpare(spareId: number, vesselId?: string): Promise<Array<{ componentId: string; componentCode: string; componentName: string }>>;
  getComponentSiblings(componentId: string): Promise<Array<{ cuuid: string; name: string }>>;
  backfillSiblingLinks(vesselId: string): Promise<{ linksCreated: number; sparesProcessed: number; errors: number }>;
  
  // Job-Component Link Methods (many-to-many for shared jobs)
  getJobComponentLinks(vesselId: string): Promise<JobComponentLink[]>;
  getAllJobComponentLinks(): Promise<JobComponentLink[]>;
  getJobComponentLinksByJob(jobId: string): Promise<JobComponentLink[]>;
  getJobComponentLinksByComponent(componentId: string): Promise<JobComponentLink[]>;
  createJobComponentLink(link: InsertJobComponentLink): Promise<JobComponentLink>;
  deleteJobComponentLink(jobId: string, componentId: string): Promise<void>;
  getLinkedComponentsForJob(jobId: string): Promise<Array<{ componentId: string; componentCode: string; componentName: string; lastDoneRH?: string | null; nextDueRH?: string | null }>>;
  getLinkedComponentsForJobs(jobIds: string[]): Promise<Map<string, Array<{ componentId: string; componentCode: string; componentName: string; lastDoneRH?: string | null; nextDueRH?: string | null }>>>;
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
  getSpareLocationsWithQty(spareId: number, activeLocationNames?: string[]): Promise<Array<{ locationId: number; locationName: string; qty: number }>>;
  getSparesAtLocation(locationId: number): Promise<Array<{ spareId: number; partCode: string; partName: string; qty: number }>>;
  getFullSparesAtLocation(locationId: number, vesselId: string): Promise<any[]>;
  getLocationsWithStock(vesselId: string): Promise<Array<{ id: number; locationName: string; sparesCount: number }>>;
  reconcileSpareLocationStock(vesselId: string, userId?: string): Promise<{ synced: number; errors: number }>;
  
  // Spare Inventory Lookup Methods
  getSpareInventoryByPartCodes(vesselId: string, partCodes: string[]): Promise<Map<string, { rob: number; robLocationA: number; robLocationB: number; partNumber: string | null }>>;
  getSpareInventoryByPartNumbers(vesselId: string, partNumbers: string[]): Promise<Map<string, { rob: number; robLocationA: number; robLocationB: number }>>;

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
    spareUuid?: string;
    locationId: number;
    eventType: InventoryEventType;
    qtyChange: number;
    referenceType: InventoryReferenceType;
    referenceId?: string;
    referenceNote?: string;
    userId: string;
  }): Promise<{ transaction: InventoryTransaction; newLocationQty: number; newTotalRob: number }>;
  
  // Enhanced Spare Data Methods
  getSpareWithInventory(spareId: string): Promise<SpareWithInventory | null>;
  getSparesWithInventoryByVessel(vesselId: string): Promise<SpareWithInventory[]>;
  getSparesWithInventoryByVesselPaged(vesselId: string, opts: {
    page: number;
    pageSize: number;
    search?: string;
    criticality?: 'Critical' | 'Non-critical';
    rotation?: 'Rotation Items' | 'Non-Rotation Items';
    stockStatus?: 'OK' | 'Low' | 'At Min';
    sortBy?: 'partCode';
    sortDir?: 'asc' | 'desc';
    activeOnly?: boolean;
    componentId?: string;
  }): Promise<{ items: SpareWithInventory[]; total: number; page: number; pageSize: number }>;
  getSparesWithInventoryByComponent(componentId: string): Promise<SpareWithInventory[]>;
  getSparesWithInventoryByComponentCode(vesselId: string, componentCode: string): Promise<SpareWithInventory[]>;

  getRoleByName(roleName: string): Promise<AdmnRoleMaster | undefined>;
  getActiveRoles(): Promise<AdmnRoleMaster[]>;
  getActiveMenuItems(): Promise<AdmMenumasterAc[]>;
  getRoleMenuPermissions(roleRuid: string): Promise<AdmRoleMenuAccess[]>;
  saveRoleMenuPermissions(roleRuid: string, permissions: Array<{
    menuMuid: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>): Promise<{ count: number }>;

  // Approval Workflow Config methods
  getApprovalWorkflowConfig(): Promise<ApprovalWorkflowConfig[]>;
  upsertApprovalWorkflowConfig(
    rows: Array<{
      moduleId: string;
      subModuleId: string;
      functionId: string;
      variableName: string;
      level1Enabled: boolean;
      level2Enabled: boolean;
    }>,
    updatedByUuid?: string
  ): Promise<ApprovalWorkflowConfig[]>;

  // MOC Approvers (local table)
  getLocalApprovers(): Promise<any[]>;

  // WO Postponement Approval Steps
  getWoPostponementApprovalSteps(postponementId: string): Promise<WoPostponementApproval[]>;
  createWoPostponementApprovalStep(step: InsertWoPostponementApproval): Promise<WoPostponementApproval>;
  updateWoPostponementApprovalStep(id: number, data: Partial<WoPostponementApproval>): Promise<WoPostponementApproval>;
  getLatestAwaitingPostponement(workOrderId: string): Promise<WorkOrderPostponement | undefined>;
  /** Phase 0 / P0.3d — transactional postponement-approval finalize (WO update + request row + decision row, tx-joined logs). */
  finalizePostponementApproval(params: {
    workOrderId: string;
    woUpdates: Partial<InsertWorkOrder>;
    awaitingPostponementId: string | null;
    awaitingUpdates: Partial<InsertWorkOrderPostponement>;
    decisionRow: InsertWorkOrderPostponement;
    actor: string;
  }): Promise<WorkOrder>;
  verifyApproverForLevel(reviewerId: string, approvalLevel: string): Promise<boolean>;
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
// Supports PostgreSQL (requires DATABASE_URL)
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
