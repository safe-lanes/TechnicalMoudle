
import crypto from "crypto";
import { generateFleetEquipmentCode, generateFleetJobCode, generateFleetPartCode } from "./utils/codeGeneration";
import { 
  users, 
  type User, 
  type InsertUser,
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
  type InsertStoresLedger
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
  
  // Fleet Components methods
  getFleetComponents(): Promise<Component[]>;
  getFleetComponent(id: string): Promise<Component | undefined>;
  createFleetComponent(component: InsertComponent): Promise<Component>;
  updateFleetComponent(id: string, data: Partial<Component>): Promise<Component>;
  deleteFleetComponent(id: string): Promise<void>;
  
  // Spares methods
  getSpares(vesselId: string): Promise<Spare[]>;
  getSpare(id: number): Promise<Spare | undefined>;
  createSpare(spare: InsertSpare): Promise<Spare>;
  updateSpare(id: number, data: Partial<Spare>): Promise<Spare>;
  deleteSpare(id: number): Promise<void>;
  consumeSpare(id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  receiveSpare(id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]>;
  adjustSpareQuantity(
    spareId: number,
    qtyChange: number,
    eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST',
    reference?: string,
    notes?: string
  ): Promise<Spare>;
  
  // Fleet Spares methods
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
  getComponentMaintenanceHistory(componentId: string): Promise<any[]>;
  getComponentMaintenanceHistoryItem(id: number): Promise<any | undefined>;
  createComponentMaintenanceHistory(history: any): Promise<any>;
  
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
  
  // Fleet Jobs methods
  getFleetJobs(): Promise<WorkOrder[]>;
  getFleetJob(id: string): Promise<WorkOrder | undefined>;
  createFleetJob(job: InsertWorkOrder): Promise<WorkOrder>;
  updateFleetJob(id: string, data: Partial<WorkOrder>): Promise<WorkOrder>;
  deleteFleetJob(id: string): Promise<void>;
  
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
  createVessel(vessel: { id: string; name: string; type: string }): Promise<void>;
  
  // Import History methods
  createImportHistory(history: InsertImportHistory): Promise<ImportHistory>;
  getImportHistory(type?: string, limit?: number, offset?: number): Promise<{ items: ImportHistory[]; total: number }>;
  getImportHistoryById(id: string): Promise<ImportHistory | undefined>;
  updateImportHistory(id: string, data: Partial<ImportHistory>): Promise<ImportHistory>;
  
  // Import Change Log methods
  createImportChangeLog(log: InsertImportChangeLog): Promise<ImportChangeLog>;
  getImportChangeLogs(importHistoryId: string): Promise<ImportChangeLog[]>;
  deleteImportChangeLogs(importHistoryId: string): Promise<void>;
  
  // Fleet Admin - Makers methods
  getMakers(search?: string): Promise<Maker[]>;
  getMakerById(id: number): Promise<Maker | undefined>;
  createMaker(maker: InsertMaker): Promise<Maker>;
  updateMaker(id: number, data: Partial<InsertMaker>): Promise<Maker>;
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
  createStoresItem(item: InsertStoresItem): Promise<StoresItem>;
  updateStoresItem(id: number, data: Partial<StoresItem>): Promise<StoresItem>;
  deleteStoresItem(id: number): Promise<void>;
  consumeStoresItem(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
  receiveStoresItem(id: number, quantity: number, location: 'A' | 'B', userId: string, remarks?: string, ref?: string, place?: string, dateLocal?: string, tz?: string): Promise<StoresItem>;
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
  generateOnDemandWorkOrder(jobId: string, reason: 'Planning' | 'Breakdown' | 'Other'): Promise<WorkOrder>;
  
  // Postponed WO Reappearance (Rule #5)
  checkAndRevertPostponedWorkOrders(vesselId?: string): Promise<{
    revertedCount: number;
    revertedWorkOrders: WorkOrder[];
  }>;
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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private currentUserId: number;
  private components: Map<string, Component>;
  private componentCodeIndex: Map<string, Map<string, string>>; // vesselId → (componentCode → componentId)
  private runningHoursAudits: RunningHoursAudit[];
  private currentAuditId: number;
  private spares: Map<number, Spare>;
  private currentSpareId: number;
  private sparesHistory: SpareHistory[];
  private currentHistoryId: number;
  private changeRequests: Map<number, ChangeRequest>;
  private currentChangeRequestId: number;
  private changeRequestAttachments: ChangeRequestAttachment[];
  private currentAttachmentId: number;
  private changeRequestComments: ChangeRequestComment[];
  private currentCommentId: number;
  private alertPolicies: Map<number, AlertPolicy>;
  private currentAlertPolicyId: number;
  private alertEvents: Map<number, AlertEvent>;
  private currentAlertEventId: number;
  private alertDeliveries: Map<number, AlertDelivery>;
  private currentAlertDeliveryId: number;
  private alertConfigs: Map<string, AlertConfig>;
  private currentAlertConfigId: number;
  private formDefinitions: Map<number, FormDefinition>;
  private currentFormDefinitionId: number;
  private formVersions: Map<number, FormVersion>;
  private currentFormVersionId: number;
  private formVersionUsages: FormVersionUsage[];
  private currentFormUsageId: number;
  private jobs: Map<string, Job>;
  private workOrders: Map<string, WorkOrder>;
  private currentWorkOrderId: number;
  private workOrderExecutions: Map<string, WorkOrderExecution>;
  private currentExecutionId: number;
  private defects: Map<string, Defect>;
  private currentDefectId: number;
  private defectActions: Map<number, DefectAction>;
  private currentDefectActionId: number;
  private defectAttachments: Map<number, DefectAttachment>;
  private currentDefectAttachmentId: number;
  private importHistory: ImportHistory[];
  private importChangeLogs: ImportChangeLog[];
  private makers: Map<number, Maker>;
  private currentMakerId: number;
  private masterLists: Map<number, MasterList>;
  private currentMasterListId: number;
  private storesItems: Map<number, StoresItem>;
  private currentStoresItemId: number;
  private storesLedger: StoresLedger[];
  private currentStoresLedgerId: number;

  constructor() {
    this.users = new Map();
    this.currentUserId = 1;
    this.components = new Map();
    this.componentCodeIndex = new Map();
    this.runningHoursAudits = [];
    this.currentAuditId = 1;
    this.spares = new Map();
    this.currentSpareId = 1;
    this.sparesHistory = [];
    this.currentHistoryId = 1;
    this.changeRequests = new Map();
    this.currentChangeRequestId = 1;
    this.changeRequestAttachments = [];
    this.currentAttachmentId = 1;
    this.changeRequestComments = [];
    this.currentCommentId = 1;
    this.alertPolicies = new Map();
    this.currentAlertPolicyId = 1;
    this.alertEvents = new Map();
    this.currentAlertEventId = 1;
    this.alertDeliveries = new Map();
    this.currentAlertDeliveryId = 1;
    this.alertConfigs = new Map();
    this.currentAlertConfigId = 1;
    this.formDefinitions = new Map();
    this.currentFormDefinitionId = 1;
    this.formVersions = new Map();
    this.currentFormVersionId = 1;
    this.formVersionUsages = [];
    this.currentFormUsageId = 1;
    this.jobs = new Map();
    this.workOrders = new Map();
    this.currentWorkOrderId = 1;
    this.workOrderExecutions = new Map();
    this.currentExecutionId = 1;
    this.defects = new Map();
    this.currentDefectId = 1;
    this.defectActions = new Map();
    this.currentDefectActionId = 1;
    this.defectAttachments = new Map();
    this.currentDefectAttachmentId = 1;
    this.importHistory = [];
    this.importChangeLogs = [];
    this.makers = new Map();
    this.currentMakerId = 1;
    this.masterLists = new Map();
    this.currentMasterListId = 1;
    this.storesItems = new Map();
    this.currentStoresItemId = 1;
    this.storesLedger = [];
    this.currentStoresLedgerId = 1;
    
    // Initialize sample components and spares
    this.initializeComponents();
    this.initializeSpares();
    this.initializeAlertPolicies();
    this.initializeFormDefinitions();
    this.initializeWorkOrders();
    this.initializeDefects();
    this.rebuildComponentCodeIndex();
  }
  
  private rebuildComponentCodeIndex(): void {
    this.componentCodeIndex.clear();
    for (const component of this.components.values()) {
      if (component && component.componentCode) {
        const vesselId = component.vesselId || 'global';
        if (!this.componentCodeIndex.has(vesselId)) {
          this.componentCodeIndex.set(vesselId, new Map());
        }
        this.componentCodeIndex.get(vesselId)!.set(component.componentCode, component.id);
      }
    }
  }
  
  private async initializeFormDefinitions() {
    // Bootstrap form definitions with exact live schemas
    const forms = [
      { name: 'ADD_COMPONENT', subgroup: 'Component Register' },
      { name: 'WO_PLANNED', subgroup: 'New Work Order (Planned)' },
      { name: 'WO_UNPLANNED', subgroup: 'Unplanned Work Order' }
    ];
    
    for (const form of forms) {
      const formDef = await this.createFormDefinition(form);
      
      // Create initial published version with exact live schema
      const schemaJson = this.getInitialFormSchema(form.name);
      await this.createFormVersion({
        formId: formDef.id,
        versionNo: 1,
        versionDate: new Date(),
        status: 'PUBLISHED',
        authorUserId: 'system',
        changelog: 'Initial version from live form',
        schemaJson: JSON.stringify(schemaJson)
      });
    }
  }
  
  private getInitialFormSchema(formName: string) {
    // Return exact schema from current live forms
    if (formName === 'ADD_COMPONENT') {
      return {
        title: "Add Component Form",
        sections: [
          {
            key: "A",
            title: "A. Component Information",
            layout: "grid-4",
            fields: [
              { key: "origin", label: "Origin", type: "text", required: false },
              { key: "supplier", label: "Supplier", type: "text", required: false },
              { key: "partNo", label: "Part No", type: "text", required: false },
              { key: "createdOn", label: "Created On", type: "date", required: false },
              { key: "component", label: "Component", type: "text", required: true },
              { key: "maker", label: "Maker / Maker Designator", type: "text", required: false },
              { key: "serialNo", label: "Serial No", type: "text", required: false },
              { key: "installedDate", label: "Installed Date", type: "date", required: false },
              { key: "componentCode", label: "Component Code", type: "text", required: false },
              { key: "type", label: "Type", type: "text", required: false },
              { key: "blackoutComponent", label: "Blackout Component", type: "text", required: false },
              { key: "modelSpecification", label: "Model Specification", type: "text", required: false },
              { key: "warrantyInfo", label: "Warranty Info", type: "text", required: false },
              { key: "warrantyDays", label: "Warranty Days", type: "text", required: false },
              { key: "warrantyDate", label: "Warranty Date", type: "date", required: false },
              { key: "lastUsed", label: "Last Used", type: "text", required: false }
            ]
          },
          {
            key: "B",
            title: "B. Running Hours & Condition Monitoring Metrics",
            layout: "grid-3",
            fields: [
              { key: "runningHours", label: "Running Hours", type: "number", required: false },
              { key: "conditionMetrics", label: "Condition Monitoring Metrics", type: "repeater", required: false }
            ]
          },
          {
            key: "C",
            title: "C. Work Orders",
            layout: "grid-5",
            fields: [
              { key: "workBy", label: "Work By", type: "text", required: false },
              { key: "jobTitle", label: "Job Title", type: "text", required: false },
              { key: "assignedTo", label: "Assigned To", type: "text", required: false },
              { key: "dueDate", label: "Due Date", type: "date", required: false },
              { key: "status", label: "Status", type: "text", required: false }
            ]
          },
          {
            key: "D",
            title: "D. Maintenance History",
            layout: "grid-4",
            fields: [
              { key: "workOrderNo", label: "Work Order No", type: "text", required: false },
              { key: "performedBy", label: "Performed By", type: "text", required: false },
              { key: "nextDueDate", label: "Next Due Date", type: "date", required: false },
              { key: "completionDate", label: "Completion Date", type: "date", required: false }
            ]
          },
          {
            key: "E",
            title: "E. Spares",
            layout: "grid-5",
            fields: [
              { key: "sparePart", label: "Spare Part", type: "text", required: false },
              { key: "partName", label: "Part Name", type: "text", required: false },
              { key: "qty", label: "Qty", type: "number", required: false },
              { key: "critical", label: "Critical", type: "text", required: false },
              { key: "location", label: "Location", type: "text", required: false }
            ]
          },
          {
            key: "F",
            title: "F. Drawings & Manuals",
            layout: "file-upload",
            fields: []
          },
          {
            key: "G",
            title: "G. Classification & Regulatory Data",
            layout: "grid-4",
            fields: [
              { key: "classificationSociety", label: "Classification Society", type: "text", required: false },
              { key: "certificateNo", label: "Certificate No", type: "text", required: false },
              { key: "lastClassDate", label: "Last Class Date", type: "date", required: false },
              { key: "nextClassDate", label: "Next Class Date", type: "date", required: false },
              { key: "classCode", label: "Class Code", type: "text", required: false },
              { key: "classRemarks", label: "Class Remarks", type: "text", required: false }
            ]
          },
          {
            key: "H",
            title: "H. New Service Notes",
            layout: "grid-4",
            fields: [
              { key: "serviceNote", label: "Service Note", type: "text", required: false },
              { key: "noteDate", label: "Note Date", type: "date", required: false },
              { key: "nextNote", label: "Next Note", type: "date", required: false },
              { key: "noteLevel", label: "Note Level", type: "text", required: false }
            ]
          }
        ]
      };
    } else if (formName === 'WO_PLANNED') {
      return {
        title: "Work Order Form (Planned)",
        sections: [
          {
            key: "partA",
            title: "Part A - Work Order Details",
            layout: "grid-3",
            fields: [
              { key: "woNumber", label: "WO Number", type: "text", required: true },
              { key: "component", label: "Component", type: "select", required: true },
              { key: "jobTitle", label: "Job Title", type: "text", required: true },
              { key: "workBy", label: "Work By", type: "select", required: true },
              { key: "assignedTo", label: "Assigned To", type: "select", required: false },
              { key: "priority", label: "Priority", type: "select", required: true },
              { key: "plannedDate", label: "Planned Date", type: "date", required: true },
              { key: "estimatedHours", label: "Estimated Hours", type: "number", required: false }
            ]
          },
          {
            key: "partB",
            title: "Part B - Job Description & Instructions",
            layout: "grid-1",
            fields: [
              { key: "description", label: "Description", type: "textarea", required: true },
              { key: "instructions", label: "Instructions", type: "textarea", required: false },
              { key: "safetyPrecautions", label: "Safety Precautions", type: "textarea", required: false },
              { key: "requiredSpares", label: "Required Spares", type: "repeater", required: false }
            ]
          }
        ]
      };
    } else if (formName === 'WO_UNPLANNED') {
      return {
        title: "Work Order Form (Unplanned)",
        sections: [
          {
            key: "partA",
            title: "Part A - Breakdown Details",
            layout: "grid-3",
            fields: [
              { key: "woNumber", label: "WO Number", type: "text", required: true },
              { key: "component", label: "Component", type: "select", required: true },
              { key: "breakdownDate", label: "Breakdown Date", type: "datetime", required: true },
              { key: "reportedBy", label: "Reported By", type: "text", required: true },
              { key: "severity", label: "Severity", type: "select", required: true },
              { key: "impactOnOperation", label: "Impact on Operation", type: "select", required: true }
            ]
          },
          {
            key: "partB",
            title: "Part B - Corrective Action",
            layout: "grid-1",
            fields: [
              { key: "failureDescription", label: "Failure Description", type: "textarea", required: true },
              { key: "rootCause", label: "Root Cause", type: "textarea", required: false },
              { key: "correctiveAction", label: "Corrective Action", type: "textarea", required: true },
              { key: "preventiveAction", label: "Preventive Action", type: "textarea", required: false },
              { key: "actualSpares", label: "Actual Spares Used", type: "repeater", required: false }
            ]
          }
        ]
      };
    }
    return {};
  }

  // Helper to create vessel component with all required fields
  private createVesselComponent(data: Partial<Component> & { id: string; name: string; category: string }): Component {
    const now = new Date();
    return {
      id: data.id,
      name: data.name,
      componentCode: data.componentCode || null,
      parentId: data.parentId || null,
      category: data.category,
      currentCumulativeRH: data.currentCumulativeRH || "0",
      lastUpdated: data.lastUpdated || null,
      vesselId: data.vesselId || null,
      vesselCode: data.vesselCode || null,
      dataScope: "vessel", // All these are vessel-level components
      fleetEquipmentCode: data.fleetEquipmentCode || null,
      fleetEquipmentName: data.fleetEquipmentName || null,
      parentFleetEquipmentCode: data.parentFleetEquipmentCode || null,
      maker: data.maker || null,
      makerCode: data.makerCode || null,
      model: data.model || null,
      modelNumber: data.modelNumber || null,
      modelCode: data.modelCode || null,
      serialNo: data.serialNo || null,
      drawingNo: data.drawingNo || null,
      department: data.department || null,
      deptCategory: data.deptCategory || null,
      componentCategory: data.componentCategory || null,
      location: data.location || null,
      eqptSystemDept: data.eqptSystemDept || null,
      commissionedDate: data.commissionedDate || null,
      installationDate: data.installationDate || null,
      critical: data.critical || false,
      classItem: data.classItem || false,
      conditionBased: data.conditionBased || false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      rating: data.rating || null,
      noOfUnits: data.noOfUnits || null,
      parentComponent: data.parentComponent || null,
      dimensionsSize: data.dimensionsSize || null,
      notes: data.notes || null,
      runningHours: data.runningHours || null,
      applicableVesselIds: data.applicableVesselIds || null,
      scopeNotes: data.scopeNotes || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private initializeComponents() {
    // Create hierarchical component structure for MV Test Vessel
    const sampleComponents: Component[] = [
      // Top level - Ship groups
      this.createVesselComponent({ id: "1", name: "Ship General", componentCode: "1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "2", name: "Hull", componentCode: "2", vesselId: "MV Test Vessel", category: "Hull", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "3", name: "Equipment for Cargo", componentCode: "3", vesselId: "MV Test Vessel", category: "Equipment for Cargo", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "4", name: "Ship's Equipment", componentCode: "4", vesselId: "MV Test Vessel", category: "Ship's Equipment", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "5", name: "Equipment for Crew & Passengers", componentCode: "5", vesselId: "MV Test Vessel", category: "Equipment for Crew & Passengers", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "6", name: "Machinery Main Components", componentCode: "6", vesselId: "MV Test Vessel", category: "Machinery Main Components", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "7", name: "Systems for Machinery Main Components", componentCode: "7", vesselId: "MV Test Vessel", category: "Systems for Machinery Main Components", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "8", name: "Ship Common Systems", componentCode: "8", vesselId: "MV Test Vessel", category: "Ship Common Systems", lastUpdated: "02-Jun-2025" }),
      
      // Level 2 - Under Ship General
      this.createVesselComponent({ id: "1.1", name: "Fresh Water System", componentCode: "1.1", parentId: "1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "1.2", name: "Sewage Treatment System", componentCode: "1.2", parentId: "1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "1.3", name: "HVAC – Accommodation", componentCode: "1.3", parentId: "1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      
      // Level 3 - Under Fresh Water System
      this.createVesselComponent({ id: "1.1.1", name: "Hydrophore Unit", componentCode: "1.1.1", parentId: "1.1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "1.1.2", name: "Potable Water Maker", componentCode: "1.1.2", parentId: "1.1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "1.1.3", name: "UV Sterilizer", componentCode: "1.1.3", parentId: "1.1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025" }),
      
      // Level 4 - Under Hydrophore Unit
      this.createVesselComponent({ id: "1.1.1.1", name: "Pressure Vessel", componentCode: "1.1.1.1", parentId: "1.1.1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025",
        maker: "ACME Marine", model: "PV-2000", serialNo: "PV2024001", deptCategory: "Engineering", componentCategory: "Ship General", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true }),
      this.createVesselComponent({ id: "1.1.1.2", name: "Feed Pump", componentCode: "1.1.1.2", parentId: "1.1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "12450", lastUpdated: "02-Jun-2025",
        maker: "Grundfos", model: "CR32-4", serialNo: "GF2024002", deptCategory: "Engineering", componentCategory: "Ship General", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true }),
      this.createVesselComponent({ id: "1.1.1.3", name: "Pressure Switch", componentCode: "1.1.1.3", parentId: "1.1.1", vesselId: "MV Test Vessel", category: "Ship General", lastUpdated: "02-Jun-2025",
        maker: "Danfoss", model: "KP35", serialNo: "DF2024003", deptCategory: "Engineering", componentCategory: "Ship General", location: "Engine Room", commissionedDate: "01-Jan-2020" }),
      
      // Level 2 - Under Machinery Main Components
      this.createVesselComponent({ id: "6.1", name: "Diesel Engines", componentCode: "6.1", parentId: "6", vesselId: "MV Test Vessel", category: "Machinery Main Components", lastUpdated: "02-Jun-2025" }),
      this.createVesselComponent({ id: "6.2", name: "Turbines", componentCode: "6.2", parentId: "6", vesselId: "MV Test Vessel", category: "Machinery Main Components", lastUpdated: "02-Jun-2025" }),
      
      // Level 3 - Under Diesel Engines
      this.createVesselComponent({ id: "6.1.1", name: "Main Engine", componentCode: "6.1.1", parentId: "6.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025" }),
      this.createVesselComponent({ id: "6.1.2", name: "Auxiliary Engine #1", componentCode: "6.1.2", parentId: "6.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "15670", lastUpdated: "09-Jun-2025" }),
      this.createVesselComponent({ id: "6.1.3", name: "Auxiliary Engine #2", componentCode: "6.1.3", parentId: "6.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "14980", lastUpdated: "16-Jun-2025" }),
      
      // Level 4 - Under Main Engine
      this.createVesselComponent({ id: "6.1.1.1", name: "Crankshaft", componentCode: "6.1.1.1", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "6S60MC-C", serialNo: "MB2020001", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true }),
      this.createVesselComponent({ id: "6.1.1.2", name: "Cylinder Liners", componentCode: "6.1.1.2", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "CL-600", serialNo: "MB2020002", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true }),
      this.createVesselComponent({ id: "6.1.1.3", name: "Piston & Piston Rod", componentCode: "6.1.1.3", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "PR-600", serialNo: "MB2020003", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true }),
      this.createVesselComponent({ id: "6.1.1.4", name: "Connecting Rod", componentCode: "6.1.1.4", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "CR-600", serialNo: "MB2020004", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true }),
      this.createVesselComponent({ id: "6.1.1.5", name: "Camshaft", componentCode: "6.1.1.5", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "CS-600", serialNo: "MB2020005", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true })
    ];
    
    sampleComponents.forEach(comp => this.components.set(comp.id, comp));
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Running Hours methods
  async getComponents(vesselId: string): Promise<Component[]> {
    return Array.from(this.components.values()).filter(c => c.vesselId === vesselId);
  }

  async getComponent(id: string): Promise<Component | undefined> {
    return this.components.get(id);
  }

  async getComponentByCode(componentCode: string, vesselId: string): Promise<Component | undefined> {
    // Use componentCodeIndex for efficient lookup
    const vesselKey = vesselId || 'global';
    const vesselIndex = this.componentCodeIndex.get(vesselKey);
    
    if (vesselIndex) {
      const componentId = vesselIndex.get(componentCode);
      if (componentId) {
        return this.components.get(componentId);
      }
    }
    
    // Fallback: linear search if not in index
    return Array.from(this.components.values()).find(
      c => c.componentCode === componentCode && c.vesselId === vesselId
    );
  }

  async createComponent(insertComponent: InsertComponent): Promise<Component> {
    const now = new Date();
    const component: Component = {
      ...insertComponent,
      id: insertComponent.componentCode || insertComponent.id,
      currentCumulativeRH: insertComponent.currentCumulativeRH || "0",
      lastUpdated: new Date().toISOString(),
      critical: insertComponent.critical ?? false,
      classItem: insertComponent.classItem ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.components.set(component.id, component);
    
    // Update index
    if (component.componentCode) {
      const vesselId = component.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(component.componentCode, component.id);
    }
    
    return component;
  }

  async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component ${id} not found`);
    }
    
    const oldComponentCode = component.componentCode;
    const newComponentCode = data.componentCode;
    const componentCodeChanged = newComponentCode !== undefined && newComponentCode !== oldComponentCode;
    
    // Remove old index entry if componentCode or vesselId changed
    if (component.componentCode && (data.componentCode !== undefined || data.vesselId !== undefined)) {
      const oldVesselId = component.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(oldVesselId);
      if (vesselIndex) {
        vesselIndex.delete(component.componentCode);
      }
    }
    
    const updated = { ...component, ...data, updatedAt: new Date() };
    this.components.set(id, updated);
    
    // Add new index entry
    if (updated.componentCode) {
      const vesselId = updated.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(updated.componentCode, updated.id);
    }
    
    // CASCADE UPDATE: When componentCode changes, update all linked records (Rule #12)
    if (componentCodeChanged && oldComponentCode && newComponentCode) {
      const cascadeResult = await this.cascadeComponentCodeUpdate(
        id,
        oldComponentCode, 
        newComponentCode, 
        component.vesselId || 'V001',
        updated.name || oldComponentCode
      );
      console.log(`[CASCADE] Component code changed from ${oldComponentCode} to ${newComponentCode}:`, cascadeResult);
    }
    
    return updated;
  }
  
  /**
   * CASCADE UPDATE: Updates all linked records when component code changes (Rule #12)
   * Updates: Jobs, Work Orders, Spares, and child components' parentId
   */
  private async cascadeComponentCodeUpdate(
    componentId: string,
    oldCode: string,
    newCode: string,
    vesselId: string,
    componentName: string
  ): Promise<{ jobsUpdated: number; workOrdersUpdated: number; sparesUpdated: number; childrenUpdated: number }> {
    let jobsUpdated = 0;
    let workOrdersUpdated = 0;
    let sparesUpdated = 0;
    let childrenUpdated = 0;
    
    // 1. Update all Jobs linked to this component
    for (const [jobId, job] of this.jobs) {
      if (job.componentCode === oldCode || job.componentId === componentId) {
        const updatedJob = {
          ...job,
          componentCode: newCode,
          componentId: componentId,
          updatedAt: new Date()
        };
        this.jobs.set(jobId, updatedJob);
        jobsUpdated++;
      }
    }
    
    // 2. Update all Work Orders linked to this component
    for (const [woId, wo] of this.workOrders) {
      if (wo.componentCode === oldCode) {
        const updatedWO = {
          ...wo,
          componentCode: newCode
        };
        this.workOrders.set(woId, updatedWO);
        workOrdersUpdated++;
      }
    }
    
    // 3. Update all Spares linked to this component
    for (const [spareId, spare] of this.spares) {
      if (spare.componentCode === oldCode || spare.componentId === componentId) {
        const newComponentSpareCode = spare.componentSpareCode 
          ? spare.componentSpareCode.replace(oldCode, newCode)
          : null;
        const updatedSpare = {
          ...spare,
          componentCode: newCode,
          componentId: componentId,
          componentSpareCode: newComponentSpareCode
        };
        this.spares.set(spareId, updatedSpare);
        sparesUpdated++;
        
        // Create history entry for code renumbering
        await this.createSpareHistory({
          timestampUTC: new Date(),
          vesselId: vesselId,
          spareId: spareId,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: componentId,
          componentCode: newCode,
          componentName: componentName,
          componentSpareCode: newComponentSpareCode,
          eventType: 'CODE_RENUMBERED',
          qtyChange: 0,
          robAfter: spare.rob || 0,
          userId: 'system',
          remarks: `Component code changed from ${oldCode} to ${newCode}`,
          reference: null
        });
      }
    }
    
    // 4. Update all child components whose parentId references the old code
    for (const [childId, child] of this.components) {
      if (child.parentId === oldCode) {
        const updatedChild = {
          ...child,
          parentId: newCode,
          updatedAt: new Date()
        };
        this.components.set(childId, updatedChild);
        childrenUpdated++;
      }
    }
    
    return { jobsUpdated, workOrdersUpdated, sparesUpdated, childrenUpdated };
  }

  async deleteComponent(id: string): Promise<void> {
    const component = this.components.get(id);
    if (!component) {
      return; // Component already deleted or doesn't exist
    }
    
    // CASCADE DELETE (Rule #14): Recursively delete all descendants
    const cascadeResult = await this.cascadeDeleteComponent(component);
    console.log(`[CASCADE DELETE] Component ${id} deleted with cascade:`, cascadeResult);
  }
  
  /**
   * CASCADE DELETE: Recursively deletes component and all descendants (Rule #14)
   * Also handles linked Jobs (soft delete), Work Orders (keep for history), and Spares
   */
  private async cascadeDeleteComponent(
    component: Component
  ): Promise<{ 
    componentsDeleted: number; 
    jobsDeleted: number; 
    workOrdersAffected: number; 
    sparesDeleted: number 
  }> {
    let componentsDeleted = 0;
    let jobsDeleted = 0;
    let workOrdersAffected = 0;
    let sparesDeleted = 0;
    
    const componentCode = component.componentCode;
    const componentId = component.id;
    const vesselId = component.vesselId || 'global';
    
    // 1. Find all descendants (children, grandchildren, etc.) by traversing parentId chain
    const descendantIds: string[] = [];
    const descendantCodes: string[] = [];
    
    const findDescendants = (parentCode: string | null) => {
      if (!parentCode) return;
      
      for (const [childId, child] of this.components) {
        if (child.parentId === parentCode && childId !== componentId) {
          descendantIds.push(childId);
          if (child.componentCode) {
            descendantCodes.push(child.componentCode);
          }
          // Recursively find grandchildren
          if (child.componentCode) {
            findDescendants(child.componentCode);
          }
        }
      }
    };
    
    // Start finding descendants from this component's code
    if (componentCode) {
      findDescendants(componentCode);
    }
    
    // 2. Delete all descendant components first (bottom-up would be ideal, but order doesn't matter for Maps)
    for (const descendantId of descendantIds) {
      const descendant = this.components.get(descendantId);
      if (descendant) {
        // Remove from index
        if (descendant.componentCode) {
          const descVesselId = descendant.vesselId || 'global';
          const vesselIndex = this.componentCodeIndex.get(descVesselId);
          if (vesselIndex) {
            vesselIndex.delete(descendant.componentCode);
          }
        }
        this.components.delete(descendantId);
        componentsDeleted++;
      }
    }
    
    // 3. Delete the target component itself
    if (componentCode) {
      const vesselIndex = this.componentCodeIndex.get(vesselId);
      if (vesselIndex) {
        vesselIndex.delete(componentCode);
      }
    }
    this.components.delete(componentId);
    componentsDeleted++;
    
    // 4. Collect all component codes to process (target + descendants)
    const allCodesToProcess = componentCode ? [componentCode, ...descendantCodes] : descendantCodes;
    const allIdsToProcess = [componentId, ...descendantIds];
    
    // 5. Soft-delete all linked Jobs (set isActive = false)
    for (const [jobId, job] of this.jobs) {
      if (allIdsToProcess.includes(job.componentId) || 
          (job.componentCode && allCodesToProcess.includes(job.componentCode))) {
        const updatedJob = {
          ...job,
          isActive: false,
          updatedAt: new Date()
        };
        this.jobs.set(jobId, updatedJob);
        jobsDeleted++;
      }
    }
    
    // 6. Mark Work Orders as affected (keep for history, but update status note)
    for (const [woId, wo] of this.workOrders) {
      if (wo.componentCode && allCodesToProcess.includes(wo.componentCode)) {
        // Only update if not already completed
        if (wo.status !== 'Completed' && wo.status !== 'Rejected') {
          const updatedWO = {
            ...wo,
            approverRemarks: (wo.approverRemarks || '') + ' [Component deleted]'
          };
          this.workOrders.set(woId, updatedWO);
          workOrdersAffected++;
        }
      }
    }
    
    // 7. Soft-delete all linked Spares
    for (const [spareId, spare] of this.spares) {
      if (allIdsToProcess.includes(spare.componentId || '') ||
          (spare.componentCode && allCodesToProcess.includes(spare.componentCode))) {
        const updatedSpare = {
          ...spare,
          deleted: true
        };
        this.spares.set(spareId, updatedSpare);
        sparesDeleted++;
      }
    }
    
    return { componentsDeleted, jobsDeleted, workOrdersAffected, sparesDeleted };
  }

  // Fleet Components methods
  async getFleetComponents(): Promise<Component[]> {
    return Array.from(this.components.values()).filter(c => c.dataScope === 'fleet');
  }

  async getFleetComponent(id: string): Promise<Component | undefined> {
    const component = this.components.get(id);
    if (component && component.dataScope === 'fleet') {
      return component;
    }
    return undefined;
  }

  async createFleetComponent(insertComponent: InsertComponent): Promise<Component> {
    const now = new Date();
    
    if (insertComponent.dataScope && insertComponent.dataScope !== 'fleet') {
      throw new Error('Fleet component must have dataScope="fleet"');
    }
    if (insertComponent.vesselId) {
      throw new Error('Fleet component cannot have vesselId');
    }
    
    if (insertComponent.parentFleetEquipmentCode) {
      const parent = Array.from(this.components.values()).find(
        c => c.dataScope === 'fleet' && c.fleetEquipmentCode === insertComponent.parentFleetEquipmentCode
      );
      if (!parent) {
        throw new Error(`Parent fleet component ${insertComponent.parentFleetEquipmentCode} not found`);
      }
    }
    
    const fleetEquipmentCode = insertComponent.fleetEquipmentCode || generateFleetEquipmentCode(insertComponent.parentFleetEquipmentCode ?? null);
    
    const component: Component = {
      ...insertComponent,
      id: insertComponent.id || fleetEquipmentCode,
      dataScope: 'fleet',
      vesselId: null,
      fleetEquipmentCode,
      currentCumulativeRH: insertComponent.currentCumulativeRH || "0",
      lastUpdated: new Date().toISOString(),
      critical: insertComponent.critical ?? false,
      classItem: insertComponent.classItem ?? false,
      createdAt: now,
      updatedAt: now
    };
    
    this.components.set(component.id, component);
    
    // Update index
    if (component.componentCode) {
      const vesselId = component.vesselId || 'global';
      if (!this.componentCodeIndex.has(vesselId)) {
        this.componentCodeIndex.set(vesselId, new Map());
      }
      this.componentCodeIndex.get(vesselId)!.set(component.componentCode, component.id);
    }
    
    return component;
  }

  async updateFleetComponent(id: string, data: Partial<Component>): Promise<Component> {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component ${id} not found`);
    }
    if (component.dataScope !== 'fleet') {
      throw new Error(`Component ${id} is not a fleet component`);
    }
    if (data.dataScope && data.dataScope !== 'fleet') {
      throw new Error('Cannot change dataScope from fleet to vessel');
    }
    if (data.vesselId) {
      throw new Error('Cannot assign vesselId to fleet component');
    }
    
    if (data.parentFleetEquipmentCode && data.parentFleetEquipmentCode !== component.parentFleetEquipmentCode) {
      const parent = Array.from(this.components.values()).find(
        c => c.dataScope === 'fleet' && c.fleetEquipmentCode === data.parentFleetEquipmentCode
      );
      if (!parent) {
        throw new Error(`Parent fleet component ${data.parentFleetEquipmentCode} not found`);
      }
    }
    
    // Remove old index entry if componentCode changed
    if (component.componentCode && data.componentCode !== undefined) {
      const oldVesselId = component.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(oldVesselId);
      if (vesselIndex) {
        vesselIndex.delete(component.componentCode);
      }
    }
    
    const updated = { 
      ...component, 
      ...data, 
      dataScope: 'fleet',
      vesselId: null,
      updatedAt: new Date()
    };
    this.components.set(id, updated);
    
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
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component ${id} not found`);
    }
    if (component.dataScope !== 'fleet') {
      throw new Error(`Component ${id} is not a fleet component`);
    }
    
    const hasChildren = Array.from(this.components.values()).some(
      c => c.dataScope === 'fleet' && c.parentFleetEquipmentCode === component.fleetEquipmentCode
    );
    if (hasChildren) {
      throw new Error(`Cannot delete fleet component ${id} with child components`);
    }
    
    // Remove from index
    if (component.componentCode) {
      const vesselId = component.vesselId || 'global';
      const vesselIndex = this.componentCodeIndex.get(vesselId);
      if (vesselIndex) {
        vesselIndex.delete(component.componentCode);
      }
    }
    
    this.components.delete(id);
  }

  async createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
    const id = this.currentAuditId++;
    const fullAudit: RunningHoursAudit = { 
      ...audit, 
      id,
      previousRH: audit.previousRH.toString(),
      newRH: audit.newRH.toString(),
      cumulativeRH: audit.cumulativeRH.toString(),
      oldMeterFinal: audit.oldMeterFinal?.toString() || null,
      newMeterStart: audit.newMeterStart?.toString() || null,
      enteredAtUTC: audit.enteredAtUTC || new Date(),
      notes: audit.notes || null,
      version: audit.version || 1,
      meterReplaced: audit.meterReplaced ?? false
    };
    this.runningHoursAudits.push(fullAudit);
    return fullAudit;
  }

  async getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
    const audits = this.runningHoursAudits
      .filter(a => a.componentId === componentId)
      .sort((a, b) => b.enteredAtUTC.getTime() - a.enteredAtUTC.getTime());
    
    return limit ? audits.slice(0, limit) : audits;
  }

  async getRunningHoursAuditsInDateRange(
    componentId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<RunningHoursAudit[]> {
    return this.runningHoursAudits.filter(a => {
      if (a.componentId !== componentId) return false;
      const auditDate = new Date(a.dateUpdatedLocal);
      return auditDate >= startDate && auditDate <= endDate;
    });
  }

  /**
   * Get parent components that have running-hour based child jobs
   */
  async getRunningHourParents(vesselId: string): Promise<Array<Component & { childCount: number; latestUpdate?: string }>> {
    const components = Array.from(this.components.values())
      .filter(c => c.vesselId === vesselId && !c.parentId && c.dataScope !== 'fleet');
    
    const result = components.map(parent => {
      const children = Array.from(this.components.values())
        .filter(c => c.parentId === parent.componentCode && c.vesselId === vesselId);
      
      const audits = this.runningHoursAudits
        .filter(a => a.componentId === parent.id)
        .sort((a, b) => b.enteredAtUTC.getTime() - a.enteredAtUTC.getTime());
      
      return {
        ...parent,
        childCount: children.length,
        latestUpdate: audits[0]?.dateUpdatedLocal
      };
    });
    
    return result;
  }

  /**
   * CASCADE RUNNING HOURS UPDATE with WO Re-trigger (Rule #3)
   * Updates parent RH, cascades delta to children, and auto-generates work orders for due jobs
   */
  async cascadeRunningHoursUpdate(params: {
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
  }> {
    const { parentComponentId, mode, value, dateUpdated, comments, meterReplaced, oldMeterFinal, newMeterStart } = params;
    
    const parent = this.components.get(parentComponentId);
    if (!parent) {
      throw new Error(`Parent component ${parentComponentId} not found`);
    }
    
    const oldParentRH = parseFloat(parent.currentCumulativeRH || '0');
    let newParentRH: number;
    let delta: number;
    
    if (meterReplaced) {
      newParentRH = parseFloat(newMeterStart || '0');
      delta = 0;
    } else if (mode === 'setTotal') {
      newParentRH = value;
      delta = value - oldParentRH;
    } else {
      delta = value;
      newParentRH = oldParentRH + delta;
    }
    
    if (!meterReplaced && newParentRH < oldParentRH) {
      throw new Error('Running hours cannot decrease without meter replacement');
    }
    
    let updatedComponents = 0;
    let auditsCreated = 0;
    const workOrdersGenerated: WorkOrder[] = [];
    
    const updatedParent = {
      ...parent,
      currentCumulativeRH: String(newParentRH),
      lastUpdated: dateUpdated,
      updatedAt: new Date()
    };
    this.components.set(parentComponentId, updatedParent);
    updatedComponents++;
    
    const parentAudit: InsertRunningHoursAudit = {
      componentId: parentComponentId,
      componentCode: parent.componentCode || parent.id,
      previousReading: String(oldParentRH),
      newReading: String(newParentRH),
      deltaValue: String(delta),
      dateUpdatedLocal: dateUpdated,
      dateUpdatedTZ: 'UTC',
      updateSource: meterReplaced ? 'Meter Replacement' : 'Running Hours Module',
      userId: 'system',
      notes: comments,
      enteredAtUTC: new Date(),
      meterReplaced: meterReplaced || false,
      oldMeterFinal: oldMeterFinal || null,
      newMeterStart: newMeterStart || null
    };
    await this.createRunningHoursAudit(parentAudit);
    auditsCreated++;
    
    const children = Array.from(this.components.values())
      .filter(c => c.parentId === parent.componentCode && c.vesselId === parent.vesselId);
    
    for (const child of children) {
      const oldChildRH = parseFloat(child.currentCumulativeRH || '0');
      let newChildRH: number;
      
      if (meterReplaced) {
        newChildRH = 0;
      } else {
        newChildRH = oldChildRH + delta;
        if (newChildRH > newParentRH) {
          newChildRH = newParentRH;
        }
      }
      
      const updatedChild = {
        ...child,
        currentCumulativeRH: String(newChildRH),
        lastUpdated: dateUpdated,
        updatedAt: new Date()
      };
      this.components.set(child.id, updatedChild);
      updatedComponents++;
      
      const childAudit: InsertRunningHoursAudit = {
        componentId: child.id,
        componentCode: child.componentCode || child.id,
        previousReading: String(oldChildRH),
        newReading: String(newChildRH),
        deltaValue: String(newChildRH - oldChildRH),
        dateUpdatedLocal: dateUpdated,
        dateUpdatedTZ: 'UTC',
        updateSource: 'Cascade from Parent',
        userId: 'system',
        notes: `Cascaded from parent: ${parent.componentCode}`,
        enteredAtUTC: new Date(),
        meterReplaced: meterReplaced || false
      };
      await this.createRunningHoursAudit(childAudit);
      auditsCreated++;
      
      const childNewWOs = await this.checkAndGenerateRHWorkOrders(child, newChildRH, parent.vesselId || 'V001');
      workOrdersGenerated.push(...childNewWOs);
    }
    
    const parentNewWOs = await this.checkAndGenerateRHWorkOrders(parent, newParentRH, parent.vesselId || 'V001');
    workOrdersGenerated.push(...parentNewWOs);
    
    // Rule #6: Update existing WO statuses for Grace P → Overdue transition
    const updatedWOStatuses = await this.updateExistingRHWorkOrderStatuses(parent, newParentRH);
    for (const child of children) {
      const childRH = parseFloat(child.currentCumulativeRH || '0');
      await this.updateExistingRHWorkOrderStatuses(child, childRH);
    }
    
    console.log(`[RH CASCADE] Updated ${updatedComponents} components, created ${auditsCreated} audits, generated ${workOrdersGenerated.length} work orders, updated ${updatedWOStatuses} WO statuses`);
    
    return {
      updatedComponents,
      auditsCreated,
      workOrdersGenerated: workOrdersGenerated.length,
      workOrders: workOrdersGenerated
    };
  }

  /**
   * RULE #6: GRACE PERIOD → OVERDUE TRANSITION
   * Updates existing RH-based work order statuses when running hours change
   * Promotes "Due (Grace P)" → "Overdue" immediately when RH exceeds threshold
   */
  private async updateExistingRHWorkOrderStatuses(
    component: Component,
    currentRH: number
  ): Promise<number> {
    let updatedCount = 0;
    
    // Find all active RH-based work orders for this component
    const activeWOs = Array.from(this.workOrders.values()).filter(wo =>
      wo.componentCode === component.componentCode &&
      wo.maintenanceBasis === 'Running Hours' &&
      wo.status !== 'Completed' &&
      wo.status !== 'Rejected' &&
      wo.status !== 'Postponed'
    );
    
    for (const wo of activeWOs) {
      // Get the linked job to determine thresholds - fallback to jobNo for legacy WOs
      let job = wo.jobId ? this.jobs.get(wo.jobId) : undefined;
      if (!job && wo.jobNo) {
        job = Array.from(this.jobs.values()).find(j => j.jobNo === wo.jobNo);
      }
      if (!job) continue;
      
      const nextDueRH = parseFloat(job.nextDueRH || wo.nextDueReading || '0');
      if (nextDueRH <= 0) continue;
      
      // Calculate lead time trigger point (grace period starts here)
      const leadTimeValue = job.leadTimeValue || 0;
      let triggerRH = nextDueRH;
      if (job.leadTimeUnit === 'Hours' && leadTimeValue > 0) {
        triggerRH = nextDueRH - leadTimeValue;
      }
      
      // Determine the correct status based on current RH
      let newStatus = wo.status;
      if (currentRH >= nextDueRH) {
        // Past due date - should be Overdue
        newStatus = 'Overdue';
      } else if (currentRH >= triggerRH && triggerRH > 0) {
        // Within grace period - should be Grace P (Due)
        newStatus = 'Due (Grace P)';
      }
      
      // Update if status changed
      if (newStatus !== wo.status) {
        const prevStatus = wo.status;
        const updatedWO = {
          ...wo,
          status: newStatus,
          currentReading: String(currentRH),
          updatedAt: new Date()
        };
        this.workOrders.set(wo.id, updatedWO);
        updatedCount++;
        console.log(`[RULE #6] WO ${wo.workOrderNo} status updated: ${prevStatus} → ${newStatus} (RH: ${currentRH}, Due RH: ${nextDueRH})`);
      }
    }
    
    return updatedCount;
  }

  /**
   * RH CORRECTION → WO RE-TRIGGER (Rule #3)
   * Checks RH-based jobs and generates work orders for any that are now due
   */
  private async checkAndGenerateRHWorkOrders(
    component: Component,
    currentRH: number,
    vesselId: string
  ): Promise<WorkOrder[]> {
    const generatedWOs: WorkOrder[] = [];
    
    const rhJobs = Array.from(this.jobs.values()).filter(job => 
      job.componentId === component.id && 
      job.maintenanceBasis === 'Running Hours' &&
      job.isActive !== false
    );
    
    for (const job of rhJobs) {
      const nextDueRH = parseFloat(job.nextDueRH || '0');
      const leadTimeRH = (job.leadTimeValue || 0) * (job.leadTimeUnit === 'Hours' ? 1 : 0);
      const leadTimeValue = job.leadTimeValue || 0;
      
      let triggerRH = nextDueRH;
      if (job.leadTimeUnit === 'Hours' && leadTimeValue > 0) {
        triggerRH = nextDueRH - leadTimeValue;
      }
      
      if (currentRH >= triggerRH && triggerRH > 0) {
        const existingWO = Array.from(this.workOrders.values()).find(wo =>
          wo.jobId === job.id &&
          wo.componentCode === component.componentCode &&
          wo.status !== 'Completed' &&
          wo.status !== 'Rejected'
        );
        
        if (!existingWO) {
          const year = new Date().getFullYear();
          const existingJobWOs = Array.from(this.workOrders.values())
            .filter(wo => wo.jobId === job.id && wo.workOrderNo?.includes(`${year}`));
          const runningNumber = String(existingJobWOs.length + 1).padStart(3, '0');
          
          const workOrderNo = `${job.jobNo}.WO-${year}-${runningNumber}`;
          const woId = `wo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          let status = 'Due';
          if (currentRH >= nextDueRH) {
            status = 'Overdue';
          } else if (currentRH >= triggerRH) {
            status = 'Due (Grace P)';
          }
          
          const newWO: WorkOrder = {
            id: woId,
            vesselId: vesselId,
            component: component.name || component.componentCode || component.id,
            componentCode: component.componentCode || null,
            jobId: job.id,
            workOrderNo,
            workOrderType: 'Planned',
            templateCode: job.jobNo,
            jobTitle: job.jobTitle,
            assignedTo: job.assignedTo || 'Chief Engineer',
            dueDate: null,
            status,
            maintenanceBasis: 'Running Hours',
            frequencyValue: job.frequencyValue,
            frequencyUnit: job.frequencyUnit,
            intervalRunningHour: job.intervalRunningHour,
            nextDueReading: String(nextDueRH),
            currentReading: String(currentRH),
            requiredSpareParts: job.requiredSpareParts || [],
            requiredTools: job.requiredTools || [],
            safetyRequirements: job.safetyRequirements || {},
            dataScope: 'vessel',
            isActive: true,
            briefWorkDescription: job.briefWorkDescription || null,
            classRelated: job.classRelated || null,
            jobPriority: job.jobPriority || null,
            department: job.department || null
          };
          
          this.workOrders.set(woId, newWO);
          generatedWOs.push(newWO);
          
          console.log(`[WO RE-TRIGGER] Generated WO ${workOrderNo} for job ${job.jobNo} at RH ${currentRH} (due at ${nextDueRH})`);
        }
      }
    }
    
    return generatedWOs;
  }

  // Generate Component Spare Code
  private generateComponentSpareCode(vesselId: string, componentCode: string): string {
    // Get all existing spares for this component in this vessel
    const existingSpares = Array.from(this.spares.values())
      .filter(s => s.vesselId === vesselId && s.componentCode === componentCode && s.componentSpareCode)
      .map(s => s.componentSpareCode);
    
    // Extract existing sequence numbers for this component
    const prefix = `SP-${componentCode}-`;
    const existingNumbers = existingSpares
      .filter(code => code?.startsWith(prefix))
      .map(code => {
        const parts = code!.split('-');
        const nnn = parts[parts.length - 1];
        return parseInt(nnn, 10);
      })
      .filter(n => !isNaN(n));
    
    // Find the next available number
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    
    // Format with zero padding
    const nnn = String(nextNumber).padStart(3, '0');
    return `${prefix}${nnn}`;
  }

  private initializeSpares() {
    const sampleSpares: Spare[] = [
      { id: 1, partCode: "SP-ME-001", partName: "Fuel Injector", componentId: "6.1", componentCode: "6.1", componentName: "Main Engine", componentSpareCode: "SP-6.1-001", critical: "Critical", rob: 2, min: 1, location: "Store Room A", vesselId: "V001", deleted: false },
      { id: 2, partCode: "SP-ME-002", partName: "Cylinder Head Gasket", componentId: "6.1.1", componentCode: "6.1.1", componentName: "Cylinder Head", componentSpareCode: "SP-6.1.1-001", critical: "No", rob: 2, min: 1, location: "Store Room B", vesselId: "V001", deleted: false },
      { id: 3, partCode: "SP-ME-003", partName: "Piston Ring Set", componentId: "6.1", componentCode: "6.1", componentName: "Main Engine", componentSpareCode: "SP-6.1-002", critical: "No", rob: 3, min: 1, location: "Store Room B", vesselId: "V001", deleted: false },
      { id: 4, partCode: "SP-ME-004", partName: "Main Bearing", componentId: "6.1.2", componentCode: "6.1.2", componentName: "Main Bearings", componentSpareCode: "SP-6.1.2-001", critical: "Critical", rob: 4, min: 2, location: "Store Room C", vesselId: "V001", deleted: false },
      { id: 5, partCode: "SP-COOL-001", partName: "Cooling Pump Seal", componentId: "7.3", componentCode: "7.3", componentName: "Cooling Water System", componentSpareCode: "SP-7.3-001", critical: "Critical", rob: 4, min: 2, location: "Store Room D", vesselId: "V001", deleted: false },
      { id: 6, partCode: "SP-CC-001", partName: "Cylinder Cover Assembly", componentId: "6.1.1.1", componentCode: "6.1.1.1", componentName: "Valve Seats", componentSpareCode: "SP-6.1.1.1-001", critical: "Critical", rob: 2, min: 1, location: "Store Room A", vesselId: "V001", deleted: false },
      { id: 7, partCode: "SP-CC-002", partName: "Inlet Valve", componentId: "6.1.1.1", componentCode: "6.1.1.1", componentName: "Valve Seats", componentSpareCode: "SP-6.1.1.1-002", critical: "Critical", rob: 4, min: 2, location: "Store Room A", vesselId: "V001", deleted: false },
      { id: 8, partCode: "SP-CC-003", partName: "Exhaust Valve", componentId: "6.1.1.1", componentCode: "6.1.1.1", componentName: "Valve Seats", componentSpareCode: "SP-6.1.1.1-003", critical: "Critical", rob: 4, min: 2, location: "Store Room A", vesselId: "V001", deleted: false },
      { id: 9, partCode: "SP-CC-004", partName: "Valve Spring", componentId: "6.1.1.2", componentCode: "6.1.1.2", componentName: "Injector Sleeve", componentSpareCode: "SP-6.1.1.2-001", critical: "No", rob: 8, min: 4, location: "Store Room B", vesselId: "V001", deleted: false },
      { id: 10, partCode: "SP-CC-005", partName: "Valve Guide", componentId: "6.1.1.3", componentCode: "6.1.1.3", componentName: "Rocker Arm", componentSpareCode: "SP-6.1.1.3-001", critical: "No", rob: 1, min: 2, location: "Store Room B", vesselId: "V001", deleted: false },
    ];
    
    sampleSpares.forEach(spare => this.spares.set(spare.id, spare));
    this.currentSpareId = 11;
  }

  // Spares methods
  async getSpares(vesselId: string): Promise<Spare[]> {
    return Array.from(this.spares.values())
      .filter(s => s.vesselId === vesselId && !s.deleted);
  }

  async getSpare(id: number): Promise<Spare | undefined> {
    const spare = this.spares.get(id);
    return spare && !spare.deleted ? spare : undefined;
  }

  async createSpare(spare: InsertSpare): Promise<Spare> {
    const id = this.currentSpareId++;
    
    // Generate component spare code if not provided
    const componentSpareCode = spare.componentSpareCode || 
      (spare.componentCode ? this.generateComponentSpareCode(spare.vesselId || 'V001', spare.componentCode) : null);
    
    const newSpare: Spare = { 
      ...spare, 
      id, 
      vesselId: spare.vesselId || 'V001',
      componentCode: spare.componentCode || null,
      location: spare.location || null,
      componentSpareCode,
      rob: spare.rob || 0,
      min: spare.min || 0,
      deleted: false 
    };
    this.spares.set(id, newSpare);
    
    // Create history entry
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId || 'V001',
      spareId: id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId,
      componentCode: spare.componentCode || null,
      componentName: spare.componentName,
      componentSpareCode: componentSpareCode,
      eventType: 'LINK_CREATED',
      qtyChange: spare.rob || 0,
      robAfter: spare.rob || 0,
      userId: 'system',
      remarks: 'Initial creation',
      reference: null
    });
    
    return newSpare;
  }

  async updateSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    const spare = this.spares.get(id);
    if (!spare || spare.deleted) {
      throw new Error(`Spare ${id} not found`);
    }
    const updated = { ...spare, ...data };
    this.spares.set(id, updated);
    
    // Create history entry if ROB changed
    if (data.rob !== undefined && data.rob !== spare.rob) {
      await this.createSpareHistory({
        timestampUTC: new Date(),
        vesselId: spare.vesselId,
        spareId: id,
        partCode: spare.partCode,
        partName: spare.partName,
        componentId: spare.componentId,
        componentCode: spare.componentCode || null,
        componentName: spare.componentName,
        componentSpareCode: spare.componentSpareCode || null,
        eventType: 'EDIT',
        qtyChange: data.rob - spare.rob,
        robAfter: data.rob,
        userId: 'system',
        remarks: 'Updated via edit',
        reference: null
      });
    }
    
    return updated;
  }

  async deleteSpare(id: number): Promise<void> {
    const spare = this.spares.get(id);
    if (spare) {
      spare.deleted = true;
      this.spares.set(id, spare);
    }
  }

  // Fleet Spares methods
  async getFleetSpares(): Promise<Spare[]> {
    return Array.from(this.spares.values()).filter(s => s.dataScope === 'fleet' && !s.deleted);
  }

  async getFleetSpare(id: number): Promise<Spare | undefined> {
    const spare = this.spares.get(id);
    if (spare && spare.dataScope === 'fleet' && !spare.deleted) {
      return spare;
    }
    return undefined;
  }

  async createFleetSpare(insertSpare: InsertSpare): Promise<Spare> {
    const now = new Date();
    
    // Validation
    if (insertSpare.dataScope && insertSpare.dataScope !== 'fleet') {
      throw new Error('Fleet spare must have dataScope="fleet"');
    }
    if (insertSpare.vesselId) {
      throw new Error('Fleet spare cannot have vesselId');
    }
    
    // Validate fleetEquipmentCode references if provided
    if (insertSpare.fleetEquipmentCode) {
      const component = Array.from(this.components.values()).find(
        c => c.dataScope === 'fleet' && c.fleetEquipmentCode === insertSpare.fleetEquipmentCode
      );
      if (!component) {
        throw new Error(`Fleet component ${insertSpare.fleetEquipmentCode} not found`);
      }
    }
    
    // Auto-generate fleetPartCode
    const fleetPartCode = insertSpare.fleetPartCode || generateFleetPartCode();
    
    // Create spare
    const id = this.currentSpareId++;
    const spare: Spare = {
      ...insertSpare,
      id,
      dataScope: 'fleet',
      vesselId: null,
      fleetPartCode,
      componentCode: insertSpare.componentCode || null,
      location: insertSpare.location || null,
      componentSpareCode: insertSpare.componentSpareCode || null,
      rob: insertSpare.rob || 0,
      min: insertSpare.min || 0,
      deleted: false,
      createdAt: now,
      updatedAt: now
    };
    
    this.spares.set(id, spare);
    return spare;
  }

  async updateFleetSpare(id: number, data: Partial<Spare>): Promise<Spare> {
    const spare = this.spares.get(id);
    if (!spare || spare.deleted) {
      throw new Error(`Spare ${id} not found`);
    }
    if (spare.dataScope !== 'fleet') {
      throw new Error(`Spare ${id} is not a fleet spare`);
    }
    if (data.dataScope && data.dataScope !== 'fleet') {
      throw new Error('Cannot change dataScope from fleet to vessel');
    }
    if (data.vesselId) {
      throw new Error('Cannot assign vesselId to fleet spare');
    }
    
    // Validate fleetEquipmentCode if changing
    if (data.fleetEquipmentCode && data.fleetEquipmentCode !== spare.fleetEquipmentCode) {
      const component = Array.from(this.components.values()).find(
        c => c.dataScope === 'fleet' && c.fleetEquipmentCode === data.fleetEquipmentCode
      );
      if (!component) {
        throw new Error(`Fleet component ${data.fleetEquipmentCode} not found`);
      }
    }
    
    const updated = {
      ...spare,
      ...data,
      dataScope: 'fleet',
      vesselId: null,
      updatedAt: new Date()
    };
    this.spares.set(id, updated);
    return updated;
  }

  async deleteFleetSpare(id: number): Promise<void> {
    const spare = this.spares.get(id);
    if (!spare || spare.deleted) {
      throw new Error(`Spare ${id} not found`);
    }
    if (spare.dataScope !== 'fleet') {
      throw new Error(`Spare ${id} is not a fleet spare`);
    }
    
    // Hard delete
    this.spares.delete(id);
  }

  async consumeSpare(id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    if (spare.rob < quantity) {
      throw new Error('Insufficient stock');
    }
    
    spare.rob -= quantity;
    this.spares.set(id, spare);
    
    // Create history entry
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId,
      spareId: id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId,
      componentCode: spare.componentCode || null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode || null,
      eventType: 'CONSUME',
      qtyChange: -quantity,
      robAfter: spare.rob,
      userId,
      remarks: remarks || null,
      reference: place || null,
      dateLocal: dateLocal || null,
      tz: tz || null
    });
    
    return spare;
  }

  async receiveSpare(id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare> {
    const spare = await this.getSpare(id);
    if (!spare) {
      throw new Error(`Spare ${id} not found`);
    }
    
    spare.rob += quantity;
    this.spares.set(id, spare);
    
    // Create history entry
    await this.createSpareHistory({
      timestampUTC: new Date(),
      vesselId: spare.vesselId,
      spareId: id,
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId,
      componentCode: spare.componentCode || null,
      componentName: spare.componentName,
      componentSpareCode: spare.componentSpareCode || null,
      eventType: 'RECEIVE',
      qtyChange: quantity,
      robAfter: spare.rob,
      userId,
      remarks: remarks || null,
      reference: supplierPO || null,
      place: place || null,
      dateLocal: dateLocal || null,
      tz: tz || null
    });
    
    return spare;
  }

  async bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]> {
    const updatedSpares: Spare[] = [];
    
    for (const update of updates) {
      const spare = await this.getSpare(update.id);
      if (!spare) continue;
      
      let netChange = 0;
      if (update.consumed) {
        if (spare.rob < update.consumed) {
          throw new Error(`Insufficient stock for ${spare.partCode}`);
        }
        netChange -= update.consumed;
      }
      if (update.received) {
        netChange += update.received;
      }
      
      if (netChange !== 0) {
        spare.rob += netChange;
        this.spares.set(update.id, spare);
        
        // Create history entry
        await this.createSpareHistory({
          timestampUTC: new Date(),
          vesselId: spare.vesselId,
          spareId: update.id,
          partCode: spare.partCode,
          partName: spare.partName,
          componentId: spare.componentId,
          componentCode: spare.componentCode || null,
          componentName: spare.componentName,
          componentSpareCode: spare.componentSpareCode || null,
          eventType: 'ADJUST',
          qtyChange: netChange,
          robAfter: spare.rob,
          userId,
          remarks: remarks || 'Bulk update',
          reference: null,
          dateLocal: update.receivedDate || null,
          place: update.receivedPlace || null,
          tz: update.receivedDate ? Intl.DateTimeFormat().resolvedOptions().timeZone : null
        });
        
        updatedSpares.push(spare);
      }
    }
    
    return updatedSpares;
  }

  // Spares History methods
  async getSpareHistory(vesselId: string): Promise<SpareHistory[]> {
    return this.sparesHistory
      .filter(h => h.vesselId === vesselId)
      .sort((a, b) => b.timestampUTC.getTime() - a.timestampUTC.getTime());
  }

  async getSpareHistoryBySpareId(spareId: number): Promise<SpareHistory[]> {
    return this.sparesHistory
      .filter(h => h.spareId === spareId)
      .sort((a, b) => b.timestampUTC.getTime() - a.timestampUTC.getTime());
  }

  async createSpareHistory(history: InsertSpareHistory): Promise<SpareHistory> {
    const id = this.currentHistoryId++;
    const fullHistory: SpareHistory = { 
      ...history, 
      id,
      componentCode: history.componentCode ?? null,
      componentSpareCode: history.componentSpareCode ?? null,
      remarks: history.remarks ?? null,
      reference: history.reference ?? null,
      dateLocal: history.dateLocal ?? null,
      tz: history.tz ?? null,
      place: history.place ?? null
    };
    this.sparesHistory.push(fullHistory);
    return fullHistory;
  }

  // Change Request methods
  async getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string }): Promise<ChangeRequest[]> {
    let requests = Array.from(this.changeRequests.values());
    
    if (filters) {
      if (filters.category) {
        requests = requests.filter(r => r.category === filters.category);
      }
      if (filters.status) {
        requests = requests.filter(r => r.status === filters.status);
      }
      if (filters.vesselId) {
        requests = requests.filter(r => r.vesselId === filters.vesselId);
      }
      if (filters.q) {
        const search = filters.q.toLowerCase();
        requests = requests.filter(r => 
          r.title.toLowerCase().includes(search) || 
          r.status.toLowerCase().includes(search)
        );
      }
    }
    
    return requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    return this.changeRequests.get(id);
  }

  async createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest> {
    const id = this.currentChangeRequestId++;
    const now = new Date();
    const fullRequest: ChangeRequest = {
      ...request,
      id,
      status: request.status || 'draft',
      targetType: request.targetType || null,
      targetId: request.targetId || null,
      snapshotBeforeJson: request.snapshotBeforeJson || null,
      proposedChangesJson: request.proposedChangesJson || null,
      movePreviewJson: request.movePreviewJson || null,
      submittedAt: request.submittedAt || null,
      reviewedByUserId: request.reviewedByUserId || null,
      reviewedAt: request.reviewedAt || null,
      createdAt: now,
      updatedAt: now
    };
    this.changeRequests.set(id, fullRequest);
    return fullRequest;
  }

  async updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    
    const updated = {
      ...request,
      ...data,
      updatedAt: new Date()
    };
    this.changeRequests.set(id, updated);
    return updated;
  }

  async updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    
    if (request.status !== 'draft' && request.status !== 'returned') {
      throw new Error('Can only update target for draft or returned requests');
    }
    
    const updated = {
      ...request,
      targetType,
      targetId,
      snapshotBeforeJson,
      updatedAt: new Date()
    };
    this.changeRequests.set(id, updated);
    return updated;
  }

  async updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    
    if (request.status !== 'draft' && request.status !== 'returned') {
      throw new Error('Can only update proposed changes for draft or returned requests');
    }
    
    const updated = {
      ...request,
      proposedChangesJson,
      movePreviewJson: movePreviewJson || null,
      updatedAt: new Date()
    };
    this.changeRequests.set(id, updated);
    return updated;
  }

  async deleteChangeRequest(id: number): Promise<void> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    if (request.status !== 'draft') {
      throw new Error('Only draft requests can be deleted');
    }
    this.changeRequests.delete(id);
  }

  async submitChangeRequest(id: number, userId: string): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    
    const now = new Date();
    const updated = {
      ...request,
      status: 'submitted' as const,
      submittedAt: now,
      requestedByUserId: userId,
      updatedAt: now
    };
    this.changeRequests.set(id, updated);
    return updated;
  }

  async approveChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    if (request.status !== 'submitted') {
      throw new Error('Only submitted requests can be approved');
    }
    
    // Add comment
    await this.createChangeRequestComment({
      changeRequestId: id,
      userId: reviewerId,
      message: `APPROVED: ${comment}`
    });
    
    const now = new Date();
    
    // Rule #17: Increment revision number and add to history
    const newRevisionNumber = (request.revisionNumber || 0) + 1;
    const revisionHistoryEntry = {
      revisionNumber: newRevisionNumber,
      approvedBy: reviewerId,
      approvedAt: now.toISOString(),
      appliedChanges: request.proposedChangesJson || [],
      comments: comment
    };
    const updatedHistory = [...(request.revisionHistory || []), revisionHistoryEntry];
    
    const updated = {
      ...request,
      status: 'approved' as const,
      reviewedByUserId: reviewerId,
      reviewedAt: now,
      revisionNumber: newRevisionNumber,
      revisionHistory: updatedHistory,
      updatedAt: now
    };
    this.changeRequests.set(id, updated);
    console.log(`[RULE #17] Change request ${id} approved - Revision #${newRevisionNumber}`);
    return updated;
  }

  async rejectChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    if (request.status !== 'submitted') {
      throw new Error('Only submitted requests can be rejected');
    }
    
    // Add comment
    await this.createChangeRequestComment({
      changeRequestId: id,
      userId: reviewerId,
      message: `REJECTED: ${comment}`
    });
    
    const now = new Date();
    const updated = {
      ...request,
      status: 'rejected' as const,
      reviewedByUserId: reviewerId,
      reviewedAt: now,
      updatedAt: now
    };
    this.changeRequests.set(id, updated);
    return updated;
  }

  async returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    const request = this.changeRequests.get(id);
    if (!request) throw new Error('Change request not found');
    if (request.status !== 'submitted') {
      throw new Error('Only submitted requests can be returned');
    }
    
    // Add comment
    await this.createChangeRequestComment({
      changeRequestId: id,
      userId: reviewerId,
      message: `RETURNED FOR CLARIFICATION: ${comment}`
    });
    
    const now = new Date();
    const updated = {
      ...request,
      status: 'returned' as const,
      reviewedByUserId: reviewerId,
      reviewedAt: now,
      updatedAt: now
    };
    this.changeRequests.set(id, updated);
    return updated;
  }

  // Change Request Attachments
  async getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]> {
    return this.changeRequestAttachments.filter(a => a.changeRequestId === changeRequestId);
  }

  async createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment> {
    const id = this.currentAttachmentId++;
    const fullAttachment: ChangeRequestAttachment = {
      ...attachment,
      id,
      uploadedAt: new Date()
    };
    this.changeRequestAttachments.push(fullAttachment);
    return fullAttachment;
  }

  // Change Request Comments
  async getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]> {
    return this.changeRequestComments
      .filter(c => c.changeRequestId === changeRequestId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment> {
    const id = this.currentCommentId++;
    const fullComment: ChangeRequestComment = {
      ...comment,
      id,
      createdAt: new Date()
    };
    this.changeRequestComments.push(fullComment);
    return fullComment;
  }
  
  // Bulk Import methods
  async bulkCreateComponents(components: InsertComponent[]): Promise<Component[]> {
    const created: Component[] = [];
    for (const comp of components) {
      const newComp: Component = {
        ...comp,
        id: comp.id || String(Date.now() + Math.random()),
        vesselId: comp.vesselId ?? 'V001',
        currentCumulativeRH: comp.currentCumulativeRH ?? "0",
        lastUpdated: comp.lastUpdated ?? new Date().toISOString().split('T')[0],
        componentCode: comp.componentCode ?? null,
        parentId: comp.parentId ?? null,
        maker: comp.maker ?? null,
        model: comp.model ?? null,
        serialNo: comp.serialNo ?? null,
        deptCategory: comp.deptCategory ?? null,
        componentCategory: comp.componentCategory ?? null,
        location: comp.location ?? null,
        commissionedDate: comp.commissionedDate ?? null,
        critical: comp.critical ?? false,
        classItem: comp.classItem ?? false
      };
      this.components.set(newComp.id, newComp);
      
      // Update index
      if (newComp.componentCode) {
        const vesselId = newComp.vesselId || 'global';
        if (!this.componentCodeIndex.has(vesselId)) {
          this.componentCodeIndex.set(vesselId, new Map());
        }
        this.componentCodeIndex.get(vesselId)!.set(newComp.componentCode, newComp.id);
      }
      
      created.push(newComp);
    }
    return created;
  }

  async bulkUpdateComponents(updates: Array<{ id: string; data: Partial<Component> }>): Promise<Component[]> {
    const updated: Component[] = [];
    for (const { id, data } of updates) {
      const existing = this.components.get(id);
      if (existing) {
        // Remove old index entry if componentCode or vesselId changed
        if (existing.componentCode && (data.componentCode !== undefined || data.vesselId !== undefined)) {
          const oldVesselId = existing.vesselId || 'global';
          const vesselIndex = this.componentCodeIndex.get(oldVesselId);
          if (vesselIndex) {
            vesselIndex.delete(existing.componentCode);
          }
        }
        
        const updatedComp = { ...existing, ...data };
        this.components.set(id, updatedComp);
        
        // Add new index entry
        if (updatedComp.componentCode) {
          const vesselId = updatedComp.vesselId || 'global';
          if (!this.componentCodeIndex.has(vesselId)) {
            this.componentCodeIndex.set(vesselId, new Map());
          }
          this.componentCodeIndex.get(vesselId)!.set(updatedComp.componentCode, updatedComp.id);
        }
        
        updated.push(updatedComp);
      }
    }
    return updated;
  }

  async bulkUpsertComponents(components: InsertComponent[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    for (const comp of components) {
      const id = comp.id || comp.componentCode;
      if (!id) continue;
      
      if (this.components.has(id)) {
        const existing = this.components.get(id)!;
        
        // Remove old index entry if componentCode or vesselId changed
        if (existing.componentCode && (comp.componentCode !== undefined || comp.vesselId !== undefined)) {
          const oldVesselId = existing.vesselId || 'global';
          const vesselIndex = this.componentCodeIndex.get(oldVesselId);
          if (vesselIndex) {
            vesselIndex.delete(existing.componentCode);
          }
        }
        
        const updatedComp = { ...existing, ...comp };
        this.components.set(id, updatedComp);
        
        // Add new index entry
        if (updatedComp.componentCode) {
          const vesselId = updatedComp.vesselId || 'global';
          if (!this.componentCodeIndex.has(vesselId)) {
            this.componentCodeIndex.set(vesselId, new Map());
          }
          this.componentCodeIndex.get(vesselId)!.set(updatedComp.componentCode, updatedComp.id);
        }
        
        updated++;
      } else {
        const newComp: Component = {
          ...comp,
          id,
          vesselId: comp.vesselId ?? 'V001',
          currentCumulativeRH: comp.currentCumulativeRH ?? "0",
          lastUpdated: comp.lastUpdated ?? new Date().toISOString().split('T')[0],
          componentCode: comp.componentCode ?? null,
          parentId: comp.parentId ?? null,
          maker: comp.maker ?? null,
          model: comp.model ?? null,
          serialNo: comp.serialNo ?? null,
          deptCategory: comp.deptCategory ?? null,
          componentCategory: comp.componentCategory ?? null,
          location: comp.location ?? null,
          commissionedDate: comp.commissionedDate ?? null,
          critical: comp.critical ?? false,
          classItem: comp.classItem ?? false
        };
        this.components.set(id, newComp);
        
        // Update index
        if (newComp.componentCode) {
          const vesselId = newComp.vesselId || 'global';
          if (!this.componentCodeIndex.has(vesselId)) {
            this.componentCodeIndex.set(vesselId, new Map());
          }
          this.componentCodeIndex.get(vesselId)!.set(newComp.componentCode, newComp.id);
        }
        
        created++;
      }
    }
    
    return { created, updated };
  }

  async bulkCreateSpares(spares: InsertSpare[]): Promise<Spare[]> {
    const created: Spare[] = [];
    for (const spare of spares) {
      const id = this.currentSpareId++;
      const newSpare: Spare = {
        ...spare,
        id,
        vesselId: spare.vesselId ?? 'V001',
        rob: spare.rob ?? 0,
        min: spare.min ?? 0,
        componentCode: spare.componentCode ?? null,
        componentSpareCode: spare.componentSpareCode ?? null,
        location: spare.location ?? null,
        deleted: false
      };
      this.spares.set(id, newSpare);
      created.push(newSpare);
    }
    return created;
  }

  async bulkUpdateSparesByROB(updates: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]> {
    const updated: Spare[] = [];
    for (const { robId, data } of updates) {
      // Find spare by componentSpareCode (since robId doesn't exist in schema)
      const existingEntry = Array.from(this.spares.entries()).find(([_, spare]) => spare.componentSpareCode === robId);
      if (existingEntry) {
        const [id, existing] = existingEntry;
        const updatedSpare = { ...existing, ...data };
        this.spares.set(id, updatedSpare);
        updated.push(updatedSpare);
      }
    }
    return updated;
  }

  async bulkUpsertSpares(spares: InsertSpare[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    for (const spare of spares) {
      // Try to find existing spare by componentSpareCode
      const existingEntry = Array.from(this.spares.entries()).find(([_, s]) => 
        s.componentSpareCode === spare.componentSpareCode && spare.componentSpareCode
      );
      
      if (existingEntry) {
        const [id, existing] = existingEntry;
        const updatedSpare = {
          ...existing,
          ...spare,
          vesselId: spare.vesselId ?? existing.vesselId,
          componentCode: spare.componentCode ?? existing.componentCode,
          componentSpareCode: spare.componentSpareCode ?? existing.componentSpareCode,
          location: spare.location ?? existing.location
        };
        this.spares.set(id, updatedSpare);
        updated++;
      } else {
        const id = this.currentSpareId++;
        const newSpare: Spare = {
          ...spare,
          id,
          vesselId: spare.vesselId ?? 'V001',
          rob: spare.rob ?? 0,
          min: spare.min ?? 0,
          componentCode: spare.componentCode ?? null,
          componentSpareCode: spare.componentSpareCode ?? null,
          location: spare.location ?? null,
          deleted: false
        };
        this.spares.set(id, newSpare);
        created++;
      }
    }
    
    return { created, updated };
  }

  async archiveComponentsByIds(ids: string[]): Promise<number> {
    let archived = 0;
    for (const id of ids) {
      if (this.components.has(id)) {
        // Note: Component schema doesn't have status field, so we just delete them
        this.components.delete(id);
        archived++;
      }
    }
    return archived;
  }

  async archiveSparesByIds(ids: number[]): Promise<number> {
    let archived = 0;
    for (const id of ids) {
      if (this.spares.has(id)) {
        const spare = this.spares.get(id)!;
        this.spares.set(id, { ...spare, deleted: true });
        archived++;
      }
    }
    return archived;
  }

  async getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, Component>> {
    const result = new Map<string, Component>();
    const vesselKey = vesselId || 'global';
    const vesselIndex = this.componentCodeIndex.get(vesselKey);
    
    if (!vesselIndex) {
      return result;
    }
    
    for (const code of codes) {
      const componentId = vesselIndex.get(code);
      if (componentId) {
        const component = this.components.get(componentId);
        if (component) {
          result.set(code, component);
        }
      }
    }
    return result;
  }

  async getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, Job>> {
    const result = new Map<string, Job>();
    for (const jobNo of jobNos) {
      const job = Array.from(this.jobs.values()).find(
        j => j.jobNo === jobNo && (!vesselId || j.vesselId === vesselId)
      );
      if (job) {
        result.set(jobNo, job);
      }
    }
    return result;
  }

  async getWorkOrdersByTemplateIds(templateIds: string[], vesselId?: string): Promise<Map<string, WorkOrder>> {
    const result = new Map<string, WorkOrder>();
    for (const templateId of templateIds) {
      const workOrder = Array.from(this.workOrders.values()).find(
        wo => wo.templateCode === templateId && (!vesselId || wo.vesselId === vesselId)
      );
      if (workOrder) {
        result.set(templateId, workOrder);
      }
    }
    return result;
  }

  async archiveComponent(id: string): Promise<Component> {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component not found: ${id}`);
    }
    const archived = { ...component, isActive: false };
    this.components.set(id, archived);
    return archived;
  }

  async archiveJob(id: string): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }
    const archived = { ...job, isActive: false };
    this.jobs.set(id, archived);
    return archived;
  }

  async archiveWorkOrder(id: string): Promise<WorkOrder> {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) {
      throw new Error(`WorkOrder not found: ${id}`);
    }
    const archived = { ...workOrder, isActive: false };
    this.workOrders.set(id, archived);
    return archived;
  }

  private calculateStockStatus(rob: number, min: number): string {
    if (rob === 0) return 'Out of Stock';
    if (rob < min) return 'Minimum';
    if (rob < min * 1.5) return 'Low';
    return 'OK';
  }

  private initializeAlertPolicies() {
    // Initialize default alert policies
    const defaultPolicies = [
      {
        alertType: 'maintenance_due',
        enabled: true,
        priority: 'medium',
        emailEnabled: false,
        inAppEnabled: true,
        thresholds: JSON.stringify({
          daysBeforeDue: 7,
          includePendingApproval: false,
          onlyCritical: false
        }),
        scopeFilters: JSON.stringify({}),
        recipients: JSON.stringify({
          roles: ['Chief Engineer', '2nd Engineer'],
          users: []
        }),
        createdBy: 'system',
        updatedBy: 'system'
      },
      {
        alertType: 'critical_inventory',
        enabled: true,
        priority: 'high',
        emailEnabled: true,
        inAppEnabled: true,
        thresholds: JSON.stringify({
          bufferQty: 0,
          includeNonCritical: false
        }),
        scopeFilters: JSON.stringify({}),
        recipients: JSON.stringify({
          roles: ['Chief Engineer', 'Tech Superintendent'],
          users: []
        }),
        createdBy: 'system',
        updatedBy: 'system'
      },
      {
        alertType: 'running_hours',
        enabled: true,
        priority: 'medium',
        emailEnabled: false,
        inAppEnabled: true,
        thresholds: JSON.stringify({
          hoursBeforeService: 100,
          utilizationSpikePercent: null
        }),
        scopeFilters: JSON.stringify({}),
        recipients: JSON.stringify({
          roles: ['Chief Engineer'],
          users: []
        }),
        createdBy: 'system',
        updatedBy: 'system'
      },
      {
        alertType: 'certificate_expiration',
        enabled: true,
        priority: 'high',
        emailEnabled: true,
        inAppEnabled: true,
        thresholds: JSON.stringify({
          daysBeforeExpiry: 30,
          types: ['Class Certificates', 'Flag', 'Insurance']
        }),
        scopeFilters: JSON.stringify({}),
        recipients: JSON.stringify({
          roles: ['Tech Superintendent', 'Office'],
          users: []
        }),
        createdBy: 'system',
        updatedBy: 'system'
      },
      {
        alertType: 'system_backup',
        enabled: true,
        priority: 'low',
        emailEnabled: false,
        inAppEnabled: true,
        thresholds: JSON.stringify({
          requireDailySuccess: true,
          maxAgeHours: 26
        }),
        scopeFilters: JSON.stringify({}),
        recipients: JSON.stringify({
          roles: ['Tech Superintendent'],
          users: []
        }),
        createdBy: 'system',
        updatedBy: 'system'
      }
    ];

    defaultPolicies.forEach((policy, index) => {
      const newPolicy: AlertPolicy = {
        id: index + 1,
        ...policy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.alertPolicies.set(newPolicy.id, newPolicy);
      this.currentAlertPolicyId = index + 2;
    });
  }

  // Alert Policy methods
  async getAlertPolicies(): Promise<AlertPolicy[]> {
    return Array.from(this.alertPolicies.values());
  }

  async getAlertPolicy(id: number): Promise<AlertPolicy | undefined> {
    return this.alertPolicies.get(id);
  }

  async createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy> {
    const newPolicy: AlertPolicy = {
      id: this.currentAlertPolicyId++,
      ...policy,
      enabled: policy.enabled ?? true,
      priority: policy.priority ?? 'medium',
      emailEnabled: policy.emailEnabled ?? false,
      inAppEnabled: policy.inAppEnabled ?? true,
      thresholds: policy.thresholds ?? '{}',
      scopeFilters: policy.scopeFilters ?? '{}',
      recipients: policy.recipients ?? '{}',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.alertPolicies.set(newPolicy.id, newPolicy);
    return newPolicy;
  }

  async updateAlertPolicy(id: number, data: Partial<AlertPolicy>): Promise<AlertPolicy> {
    const policy = this.alertPolicies.get(id);
    if (!policy) {
      throw new Error(`Alert policy ${id} not found`);
    }
    const updated = {
      ...policy,
      ...data,
      updatedAt: new Date()
    };
    this.alertPolicies.set(id, updated);
    return updated;
  }

  async deleteAlertPolicy(id: number): Promise<void> {
    this.alertPolicies.delete(id);
  }

  // Alert Event methods
  async getAlertEvents(filters?: { 
    startDate?: Date; 
    endDate?: Date; 
    alertType?: string; 
    priority?: string; 
    status?: string; 
    vesselId?: string 
  }): Promise<AlertEvent[]> {
    let events = Array.from(this.alertEvents.values());
    
    if (filters) {
      if (filters.startDate) {
        events = events.filter(e => e.createdAt >= filters.startDate!);
      }
      if (filters.endDate) {
        events = events.filter(e => e.createdAt <= filters.endDate!);
      }
      if (filters.alertType) {
        events = events.filter(e => e.alertType === filters.alertType);
      }
      if (filters.priority) {
        events = events.filter(e => e.priority === filters.priority);
      }
      if (filters.vesselId) {
        events = events.filter(e => e.vesselId === filters.vesselId);
      }
    }
    
    return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAlertEvent(id: number): Promise<AlertEvent | undefined> {
    return this.alertEvents.get(id);
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    const newEvent: AlertEvent = {
      id: this.currentAlertEventId++,
      ...event,
      vesselId: event.vesselId ?? null,
      objectType: event.objectType ?? null,
      objectId: event.objectId ?? null,
      state: event.state ?? null,
      ackBy: event.ackBy ?? null,
      ackAt: event.ackAt ?? null,
      createdAt: new Date()
    };
    this.alertEvents.set(newEvent.id, newEvent);
    return newEvent;
  }

  async acknowledgeAlertEvent(id: number, userId: string): Promise<AlertEvent> {
    const event = this.alertEvents.get(id);
    if (!event) {
      throw new Error(`Alert event ${id} not found`);
    }
    const updated = {
      ...event,
      ackBy: userId,
      ackAt: new Date()
    };
    this.alertEvents.set(id, updated);
    return updated;
  }

  // Alert Delivery methods
  async getAlertDeliveries(eventId: number): Promise<AlertDelivery[]> {
    return Array.from(this.alertDeliveries.values())
      .filter(d => d.eventId === eventId);
  }

  async createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery> {
    const newDelivery: AlertDelivery = {
      id: this.currentAlertDeliveryId++,
      ...delivery,
      status: delivery.status ?? 'pending',
      errorMessage: delivery.errorMessage ?? null,
      sentAt: delivery.sentAt ?? null,
      acknowledgedAt: delivery.acknowledgedAt ?? null,
      createdAt: new Date()
    };
    this.alertDeliveries.set(newDelivery.id, newDelivery);
    return newDelivery;
  }

  async updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery> {
    const delivery = this.alertDeliveries.get(id);
    if (!delivery) {
      throw new Error(`Alert delivery ${id} not found`);
    }
    const updated = {
      ...delivery,
      status,
      errorMessage: errorMessage ?? null,
      sentAt: status === 'sent' ? new Date() : delivery.sentAt,
      acknowledgedAt: status === 'acknowledged' ? new Date() : delivery.acknowledgedAt
    };
    this.alertDeliveries.set(id, updated);
    return updated;
  }

  // Alert Config methods
  async getAlertConfig(vesselId: string): Promise<AlertConfig | undefined> {
    return this.alertConfigs.get(vesselId);
  }

  async createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig> {
    const existing = this.alertConfigs.get(config.vesselId);
    
    if (existing) {
      const updated = {
        ...existing,
        ...config,
        updatedAt: new Date()
      };
      this.alertConfigs.set(config.vesselId, updated);
      return updated;
    } else {
      const newConfig: AlertConfig = {
        id: this.currentAlertConfigId++,
        ...config,
        quietHoursEnabled: config.quietHoursEnabled ?? false,
        quietHoursStart: config.quietHoursStart ?? null,
        quietHoursEnd: config.quietHoursEnd ?? null,
        escalationEnabled: config.escalationEnabled ?? false,
        escalationHours: config.escalationHours ?? 24,
        escalationRecipients: config.escalationRecipients ?? '[]',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.alertConfigs.set(config.vesselId, newConfig);
      return newConfig;
    }
  }

  // Form Definition methods
  async getFormDefinitions(): Promise<FormDefinition[]> {
    return Array.from(this.formDefinitions.values());
  }

  async getFormDefinition(id: number): Promise<FormDefinition | undefined> {
    return this.formDefinitions.get(id);
  }

  async getFormDefinitionByName(name: string): Promise<FormDefinition | undefined> {
    return Array.from(this.formDefinitions.values()).find(f => f.name === name);
  }

  async createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition> {
    const newForm: FormDefinition = {
      id: this.currentFormDefinitionId++,
      ...form,
      subgroup: form.subgroup ?? null
    };
    this.formDefinitions.set(newForm.id, newForm);
    return newForm;
  }

  // Form Version methods
  async getFormVersions(formId: number): Promise<FormVersion[]> {
    return Array.from(this.formVersions.values())
      .filter(v => v.formId === formId)
      .sort((a, b) => b.versionNo - a.versionNo);
  }

  async getFormVersion(id: number): Promise<FormVersion | undefined> {
    return this.formVersions.get(id);
  }

  async getLatestPublishedVersion(formId: number): Promise<FormVersion | undefined> {
    const versions = await this.getFormVersions(formId);
    return versions.find(v => v.status === 'PUBLISHED');
  }

  async getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined> {
    const form = await this.getFormDefinitionByName(name);
    if (!form) return undefined;
    return this.getLatestPublishedVersion(form.id);
  }

  async createFormVersion(version: InsertFormVersion): Promise<FormVersion> {
    const newVersion: FormVersion = {
      id: this.currentFormVersionId++,
      ...version,
      versionDate: version.versionDate || new Date(),
      changelog: version.changelog ?? null
    };
    this.formVersions.set(newVersion.id, newVersion);
    return newVersion;
  }

  async updateFormVersion(id: number, data: Partial<FormVersion>): Promise<FormVersion> {
    const version = this.formVersions.get(id);
    if (!version) throw new Error('Form version not found');
    
    if (version.status !== 'DRAFT') {
      throw new Error('Can only update draft versions');
    }
    
    const updated = { ...version, ...data };
    this.formVersions.set(id, updated);
    return updated;
  }

  async publishFormVersion(id: number, userId: string, changelog: string): Promise<FormVersion> {
    const version = this.formVersions.get(id);
    if (!version) throw new Error('Form version not found');
    
    if (version.status !== 'DRAFT') {
      throw new Error('Can only publish draft versions');
    }
    
    // Archive current published version
    const currentPublished = await this.getLatestPublishedVersion(version.formId);
    if (currentPublished) {
      this.formVersions.set(currentPublished.id, {
        ...currentPublished,
        status: 'ARCHIVED'
      });
    }
    
    // Publish new version
    const published = {
      ...version,
      status: 'PUBLISHED' as const,
      authorUserId: userId,
      changelog,
      versionDate: new Date()
    };
    this.formVersions.set(id, published);
    return published;
  }

  async discardFormVersion(id: number): Promise<void> {
    const version = this.formVersions.get(id);
    if (!version) throw new Error('Form version not found');
    
    if (version.status !== 'DRAFT') {
      throw new Error('Can only discard draft versions');
    }
    
    this.formVersions.delete(id);
  }

  // Form Version Usage methods
  async createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage> {
    const newUsage: FormVersionUsage = {
      id: this.currentFormUsageId++,
      ...usage,
      usedAt: usage.usedAt || new Date()
    };
    this.formVersionUsages.push(newUsage);
    return newUsage;
  }

  async getFormVersionUsage(formVersionId: number): Promise<FormVersionUsage[]> {
    return this.formVersionUsages.filter(u => u.formVersionId === formVersionId);
  }

  // Seed forms method
  async seedForms(): Promise<void> {
    // Check if forms already exist
    if (this.formDefinitions.size > 0) {
      return; // Already seeded
    }
    
    // Re-initialize forms
    await this.initializeFormDefinitions();
  }
  
  // IHM methods implementation
  private ihmItems: Map<string, any> = new Map();
  private ihmMaintenanceLog: any[] = [];
  private currentIhmItemId: number = 1;
  private currentIhmLogId: number = 1;
  
  async getIhmItem(id: string, type: 'component' | 'spare'): Promise<any | undefined> {
    const key = `${type}_${id}`;
    return this.ihmItems.get(key);
  }
  
  async upsertIhmItem(item: any): Promise<any> {
    const key = item.spareId ? `spare_${item.spareId}` : `component_${item.componentId}`;
    const existing = this.ihmItems.get(key);
    
    if (existing) {
      const updated = { ...existing, ...item, updatedAt: new Date() };
      this.ihmItems.set(key, updated);
      return updated;
    } else {
      const newItem = { 
        id: this.currentIhmItemId++, 
        ...item, 
        createdAt: new Date(), 
        updatedAt: new Date() 
      };
      this.ihmItems.set(key, newItem);
      return newItem;
    }
  }
  
  async getIhmMaintenanceLog(filters: any): Promise<any[]> {
    let logs = [...this.ihmMaintenanceLog];
    
    if (filters.vesselId) {
      logs = logs.filter(log => log.vesselId === filters.vesselId);
    }
    if (filters.from) {
      const fromDate = new Date(filters.from);
      logs = logs.filter(log => new Date(log.createdAt) >= fromDate);
    }
    if (filters.to) {
      const toDate = new Date(filters.to);
      logs = logs.filter(log => new Date(log.createdAt) <= toDate);
    }
    if (filters.action) {
      logs = logs.filter(log => log.action === filters.action);
    }
    if (filters.component) {
      logs = logs.filter(log => log.targetComponent === filters.component);
    }
    if (filters.spare) {
      logs = logs.filter(log => log.targetSpare === filters.spare);
    }
    
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async createIhmMaintenanceLogEntry(entry: any): Promise<any> {
    const newEntry = {
      id: this.currentIhmLogId++,
      ...entry,
      createdAt: new Date()
    };
    this.ihmMaintenanceLog.push(newEntry);
    return newEntry;
  }
  
  async getIhmStatusReport(vesselId: string): Promise<any[]> {
    const report: any[] = [];
    
    // Get all components for this vessel
    const components = await this.getComponents(vesselId);
    
    for (const component of components) {
      const ihmItem = await this.getIhmItem(component.id, 'component');
      if (ihmItem) {
        report.push({
          componentId: component.id,
          componentName: component.name,
          componentCode: component.componentCode,
          presence: ihmItem.presence,
          materials: ihmItem.materials || [],
          evidenceType: ihmItem.evidenceType,
          evidenceFileName: ihmItem.evidenceFileName,
          verifiedDate: ihmItem.verifiedDate,
          supplier: ihmItem.supplier,
          remarks: ihmItem.remarks
        });
      }
    }
    
    return report;
  }
  
  // Component Documents implementation
  private componentDocuments: any[] = [];
  private currentComponentDocumentId = 1;
  
  async getComponentDocuments(componentId: string): Promise<any[]> {
    return this.componentDocuments.filter(doc => doc.componentId === componentId && !doc.deleted);
  }
  
  async getComponentDocument(id: number): Promise<any | undefined> {
    return this.componentDocuments.find(doc => doc.id === id && !doc.deleted);
  }
  
  async createComponentDocument(doc: any): Promise<any> {
    const newDoc = {
      id: this.currentComponentDocumentId++,
      ...doc,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false
    };
    this.componentDocuments.push(newDoc);
    return newDoc;
  }
  
  async updateComponentDocument(id: number, data: any): Promise<any> {
    const doc = this.componentDocuments.find(d => d.id === id);
    if (!doc) throw new Error('Document not found');
    Object.assign(doc, data, { updatedAt: new Date() });
    return doc;
  }
  
  async deleteComponentDocument(id: number): Promise<void> {
    const doc = this.componentDocuments.find(d => d.id === id);
    if (doc) {
      doc.deleted = true;
      doc.updatedAt = new Date();
    }
  }
  
  // Component Class Regulatory implementation
  private componentClassRegulatory: any[] = [];
  private currentClassRegulatoryId = 1;
  
  async getComponentClassRegulatory(componentId: string): Promise<any[]> {
    return this.componentClassRegulatory.filter(item => item.componentId === componentId && !item.deleted);
  }
  
  async getComponentClassRegulatoryItem(id: number): Promise<any | undefined> {
    return this.componentClassRegulatory.find(item => item.id === id && !item.deleted);
  }
  
  async createComponentClassRegulatory(item: any): Promise<any> {
    const newItem = {
      id: this.currentClassRegulatoryId++,
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false
    };
    this.componentClassRegulatory.push(newItem);
    return newItem;
  }
  
  async updateComponentClassRegulatory(id: number, data: any): Promise<any> {
    const item = this.componentClassRegulatory.find(i => i.id === id);
    if (!item) throw new Error('Class regulatory item not found');
    Object.assign(item, data, { updatedAt: new Date() });
    return item;
  }
  
  async deleteComponentClassRegulatory(id: number): Promise<void> {
    const item = this.componentClassRegulatory.find(i => i.id === id);
    if (item) {
      item.deleted = true;
      item.updatedAt = new Date();
    }
  }
  
  // Component Maintenance History implementation (read-only, populated from work orders)
  private componentMaintenanceHistory: any[] = [];
  
  async getComponentMaintenanceHistory(componentId: string): Promise<any[]> {
    return this.componentMaintenanceHistory.filter(item => item.componentId === componentId);
  }
  
  async getComponentMaintenanceHistoryItem(id: number): Promise<any | undefined> {
    return this.componentMaintenanceHistory.find(item => item.id === id);
  }
  
  async createComponentMaintenanceHistory(history: any): Promise<any> {
    const id = this.componentMaintenanceHistory.length > 0 
      ? Math.max(...this.componentMaintenanceHistory.map(h => h.id)) + 1 
      : 1;
    
    const newHistory = {
      ...history,
      id,
      createdAt: new Date()
    };
    
    this.componentMaintenanceHistory.push(newHistory);
    return newHistory;
  }
  
  private initializeWorkOrders() {
    const initialWorkOrders = [
      {
        id: "1",
        vesselId: "V001",
        component: "Main Engine",
        componentCode: "6.1.1",
        templateCode: "WO-6.1.1-OHM6",
        workOrderNo: "WO-2025-03",
        jobTitle: "Main Engine Overhaul - Replace Main Bearings",
        assignedTo: "Chief Engineer",
        dueDate: "02-Jun-2025",
        status: "Completed",
        dateCompleted: "02-Jun-2025",
        taskType: "Overhaul",
        maintenanceBasis: "Calendar",
        frequencyValue: "6",
        frequencyUnit: "Months",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "2",
        vesselId: "V001",
        component: "Diesel Generator 1",
        componentCode: "6.2.1",
        templateCode: "WO-6.2.1-SRVM3",
        workOrderNo: "WO-2025-17",
        jobTitle: "DG1 - Replace Fuel Injectors",
        assignedTo: "2nd Engineer",
        dueDate: "05-Jun-2025",
        status: "Due (Grace P)",
        taskType: "Service",
        maintenanceBasis: "Calendar",
        frequencyValue: "3",
        frequencyUnit: "Months",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "3",
        vesselId: "V001",
        component: "Steering Gear",
        componentCode: "1.5.1",
        templateCode: "WO-1.5.1-INSM3",
        workOrderNo: "WO-2025-54",
        jobTitle: "Steering Gear - 3 Monthly XXX",
        assignedTo: "2nd Engineer",
        dueDate: "16-Jun-2025",
        status: "Due",
        taskType: "Inspection",
        maintenanceBasis: "Calendar",
        frequencyValue: "3",
        frequencyUnit: "Months",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "4",
        vesselId: "V001",
        component: "Main Cooling Seawater Pump",
        componentCode: "7.1.2.1",
        templateCode: "WO-7.1.2.1-SRVRH2000",
        workOrderNo: "WO-2025-19",
        jobTitle: "MCSP - Replace Mechanical Seal",
        assignedTo: "3rd Engineer",
        dueDate: "23-Jun-2025",
        status: "Due",
        taskType: "Service",
        maintenanceBasis: "Running Hours",
        frequencyValue: "2000",
        frequencyUnit: "",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "5",
        vesselId: "V001",
        component: "Main Air Compressor",
        componentCode: "7.4.1",
        templateCode: "WO-7.4.1-OHRH1000",
        workOrderNo: "WO-2025-03",
        jobTitle: "Main Air Compressor - Work Order XXX",
        assignedTo: "3rd Engineer",
        dueDate: "30-Jun-2025",
        status: "Completed",
        dateCompleted: "30-Jun-2025",
        taskType: "Overhaul",
        maintenanceBasis: "Running Hours",
        frequencyValue: "1000",
        frequencyUnit: "",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "6",
        vesselId: "V001",
        component: "Mooring Winch Forward",
        componentCode: "3.3.1",
        templateCode: "WO-3.3.1-INSM6",
        workOrderNo: "WO-2025-17",
        jobTitle: "Mooring Winch Forward - Work Order XXX",
        assignedTo: "2nd Engineer",
        dueDate: "02-Jun-2025",
        status: "Overdue",
        taskType: "Inspection",
        maintenanceBasis: "Calendar",
        frequencyValue: "6",
        frequencyUnit: "Months",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "7",
        vesselId: "V001",
        component: "Bow Thruster",
        componentCode: "5.2.1",
        templateCode: "WO-5.2.1-OHY1",
        workOrderNo: "WO-2025-54",
        jobTitle: "Bow Thruster - Work Order XXX",
        assignedTo: "Chief Engineer",
        dueDate: "09-Jun-2025",
        status: "Postponed",
        taskType: "Overhaul",
        maintenanceBasis: "Calendar",
        frequencyValue: "1",
        frequencyUnit: "Years",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "8",
        vesselId: "V001",
        component: "Fire Pump",
        componentCode: "8.1.2",
        templateCode: "WO-8.1.2-TSTM1",
        workOrderNo: "WO-2025-13",
        jobTitle: "Fire Pump - Work Order XXX",
        assignedTo: "2nd Engineer",
        dueDate: "16-Jun-2025",
        status: "Completed",
        dateCompleted: "16-Jun-2025",
        taskType: "Testing",
        maintenanceBasis: "Calendar",
        frequencyValue: "1",
        frequencyUnit: "Months",
        isExecution: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    for (const workOrder of initialWorkOrders) {
      this.workOrders.set(workOrder.id, workOrder as WorkOrder);
    }
    
    this.currentWorkOrderId = 9;
  }
  
  // WorkOrder CRUD methods
  async getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
    const allWorkOrders = Array.from(this.workOrders.values());
    if (vesselId) {
      return allWorkOrders.filter(wo => wo.vesselId === vesselId);
    }
    return allWorkOrders;
  }
  
  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    return this.workOrders.get(id);
  }

  async getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]> {
    // Rule #15: Get work orders for a job - must check both jobId AND jobNo for legacy data
    const job = this.jobs.get(jobId);
    const jobNo = job?.jobNo;
    
    // Search by both jobId match OR jobNo match (for legacy WOs without jobId)
    // Important: The OR condition must work even if one side is undefined
    return Array.from(this.workOrders.values()).filter(wo => {
      // Primary: Match by jobId
      if (wo.jobId === jobId) return true;
      // Fallback: Match by jobNo (for legacy WOs created before jobId was added)
      if (jobNo && wo.jobNo === jobNo) return true;
      return false;
    });
  }
  
  async createWorkOrder(workOrderData: InsertWorkOrder): Promise<WorkOrder> {
    const workOrder: WorkOrder = {
      ...workOrderData,
      isExecution: workOrderData.isExecution ?? false,
      id: this.currentWorkOrderId.toString(),
      componentCode: workOrderData.componentCode ?? null,
      templateCode: workOrderData.templateCode ?? null,
      executionId: workOrderData.executionId ?? null,
      vesselId: workOrderData.vesselId ?? 'V001',
      dateCompleted: workOrderData.dateCompleted ?? null,
      submittedDate: workOrderData.submittedDate ?? null,
      formData: workOrderData.formData ?? null,
      taskType: workOrderData.taskType ?? null,
      maintenanceBasis: workOrderData.maintenanceBasis ?? null,
      frequencyValue: workOrderData.frequencyValue ?? null,
      frequencyUnit: workOrderData.frequencyUnit ?? null,
      approverRemarks: workOrderData.approverRemarks ?? null,
      templateId: workOrderData.templateId ?? null,
      approver: workOrderData.approver ?? null,
      approvalDate: workOrderData.approvalDate ?? null,
      rejectionDate: workOrderData.rejectionDate ?? null,
      nextDueDate: workOrderData.nextDueDate ?? null,
      nextDueReading: workOrderData.nextDueReading ?? null,
      currentReading: workOrderData.currentReading ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.workOrders.set(workOrder.id, workOrder);
    this.currentWorkOrderId++;
    return workOrder;
  }
  
  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    const existing = this.workOrders.get(id);
    if (!existing) {
      throw new Error(`WorkOrder with id ${id} not found`);
    }
    
    const updated: WorkOrder = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    
    this.workOrders.set(id, updated);
    return updated;
  }
  
  async deleteWorkOrder(id: string): Promise<void> {
    if (!this.workOrders.has(id)) {
      throw new Error(`WorkOrder with id ${id} not found`);
    }
    this.workOrders.delete(id);
  }

  // Fleet Jobs methods
  async getFleetJobs(): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(wo => wo.dataScope === 'fleet');
  }

  async getFleetJob(id: string): Promise<WorkOrder | undefined> {
    const workOrder = this.workOrders.get(id);
    if (workOrder && workOrder.dataScope === 'fleet') {
      return workOrder;
    }
    return undefined;
  }

  async createFleetJob(insertJob: InsertWorkOrder): Promise<WorkOrder> {
    const now = new Date();
    
    // Validation
    if (insertJob.dataScope && insertJob.dataScope !== 'fleet') {
      throw new Error('Fleet job must have dataScope="fleet"');
    }
    if (insertJob.vesselId) {
      throw new Error('Fleet job cannot have vesselId');
    }
    
    // Validate fleetEquipmentCode references if provided
    if (insertJob.fleetEquipmentCode) {
      const component = Array.from(this.components.values()).find(
        c => c.dataScope === 'fleet' && c.fleetEquipmentCode === insertJob.fleetEquipmentCode
      );
      if (!component) {
        throw new Error(`Fleet component ${insertJob.fleetEquipmentCode} not found`);
      }
    }
    
    // Auto-generate fleetJobCode
    const fleetJobCode = insertJob.fleetJobCode || generateFleetJobCode();
    
    // Create work order
    const id = this.currentWorkOrderId.toString();
    this.currentWorkOrderId++;
    
    const workOrder: WorkOrder = {
      ...insertJob,
      id,
      dataScope: 'fleet',
      vesselId: null,
      fleetJobCode,
      isExecution: insertJob.isExecution ?? false,
      componentCode: insertJob.componentCode ?? null,
      templateCode: insertJob.templateCode ?? null,
      executionId: insertJob.executionId ?? null,
      dateCompleted: insertJob.dateCompleted ?? null,
      submittedDate: insertJob.submittedDate ?? null,
      formData: insertJob.formData ?? null,
      taskType: insertJob.taskType ?? null,
      maintenanceBasis: insertJob.maintenanceBasis ?? null,
      frequencyValue: insertJob.frequencyValue ?? null,
      frequencyUnit: insertJob.frequencyUnit ?? null,
      approverRemarks: insertJob.approverRemarks ?? null,
      templateId: insertJob.templateId ?? null,
      approver: insertJob.approver ?? null,
      approvalDate: insertJob.approvalDate ?? null,
      rejectionDate: insertJob.rejectionDate ?? null,
      nextDueDate: insertJob.nextDueDate ?? null,
      nextDueReading: insertJob.nextDueReading ?? null,
      currentReading: insertJob.currentReading ?? null,
      createdAt: now,
      updatedAt: now
    };
    
    this.workOrders.set(id, workOrder);
    return workOrder;
  }

  async updateFleetJob(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) {
      throw new Error(`WorkOrder ${id} not found`);
    }
    if (workOrder.dataScope !== 'fleet') {
      throw new Error(`WorkOrder ${id} is not a fleet job`);
    }
    if (data.dataScope && data.dataScope !== 'fleet') {
      throw new Error('Cannot change dataScope from fleet to vessel');
    }
    if (data.vesselId) {
      throw new Error('Cannot assign vesselId to fleet job');
    }
    
    // Validate fleetEquipmentCode if changing
    if (data.fleetEquipmentCode && data.fleetEquipmentCode !== workOrder.fleetEquipmentCode) {
      const component = Array.from(this.components.values()).find(
        c => c.dataScope === 'fleet' && c.fleetEquipmentCode === data.fleetEquipmentCode
      );
      if (!component) {
        throw new Error(`Fleet component ${data.fleetEquipmentCode} not found`);
      }
    }
    
    const updated: WorkOrder = {
      ...workOrder,
      ...data,
      dataScope: 'fleet',
      vesselId: null,
      updatedAt: new Date()
    };
    
    this.workOrders.set(id, updated);
    return updated;
  }

  async deleteFleetJob(id: string): Promise<void> {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) {
      throw new Error(`WorkOrder ${id} not found`);
    }
    if (workOrder.dataScope !== 'fleet') {
      throw new Error(`WorkOrder ${id} is not a fleet job`);
    }
    
    // Hard delete
    this.workOrders.delete(id);
  }

  async bulkCreateWorkOrders(workOrdersData: InsertWorkOrder[]): Promise<WorkOrder[]> {
    const createdWorkOrders: WorkOrder[] = [];
    
    for (const woData of workOrdersData) {
      const workOrder = await this.createWorkOrder(woData);
      createdWorkOrders.push(workOrder);
    }
    
    return createdWorkOrders;
  }

  async bulkUpdateWorkOrders(workOrders: Array<{ templateCode: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    const updatedWorkOrders: WorkOrder[] = [];
    
    for (const { templateCode, data } of workOrders) {
      const existing = Array.from(this.workOrders.values()).find(wo => wo.templateCode === templateCode);
      if (existing) {
        const updated = await this.updateWorkOrder(existing.id, data);
        updatedWorkOrders.push(updated);
      }
    }
    
    return updatedWorkOrders;
  }

  async bulkUpsertWorkOrders(workOrdersData: InsertWorkOrder[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    for (const woData of workOrdersData) {
      const existing = Array.from(this.workOrders.values()).find(
        wo => wo.templateCode === woData.templateCode && wo.vesselId === woData.vesselId
      );
      
      if (existing) {
        await this.updateWorkOrder(existing.id, woData);
        updated++;
      } else {
        await this.createWorkOrder(woData);
        created++;
      }
    }
    
    return { created, updated };
  }

  async getWorkOrderExecutions(componentId: string): Promise<WorkOrderExecution[]> {
    return Array.from(this.workOrderExecutions.values())
      .filter(exec => exec.componentId === componentId)
      .sort((a, b) => {
        const dateA = a.dateCompleted ? new Date(a.dateCompleted).getTime() : 0;
        const dateB = b.dateCompleted ? new Date(b.dateCompleted).getTime() : 0;
        return dateB - dateA; // Most recent first
      });
  }

  async getWorkOrderExecutionById(id: string): Promise<WorkOrderExecution | null> {
    return this.workOrderExecutions.get(id) || null;
  }

  async createWorkOrderExecution(data: InsertWorkOrderExecution): Promise<WorkOrderExecution> {
    const executionId = `WOE-${String(this.currentExecutionId).padStart(7, '0')}`;
    const id = `${data.componentId}-${executionId}`;
    this.currentExecutionId++;
    
    const newExecution: WorkOrderExecution = {
      ...data,
      id,
      executionId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.workOrderExecutions.set(id, newExecution);
    return newExecution;
  }

  async updateWorkOrderExecution(id: string, data: Partial<InsertWorkOrderExecution>): Promise<WorkOrderExecution> {
    const execution = this.workOrderExecutions.get(id);
    if (!execution) {
      throw new Error(`Work order execution ${id} not found`);
    }
    
    const updated: WorkOrderExecution = {
      ...execution,
      ...data,
      id: execution.id, // Prevent ID override
      executionId: execution.executionId, // Prevent execution ID override
      createdAt: execution.createdAt, // Preserve creation date
      updatedAt: new Date()
    };
    
    this.workOrderExecutions.set(id, updated);
    return updated;
  }

  private initializeDefects() {
    // Add sample defects data matching the screenshot
    const sampleDefects = [
      {
        id: "22/111/999",
        vesselId: "V001",
        vesselName: "Vessel Name Extra Long 1",
        issueDate: "01-Sep-2019",
        category: "Defect",
        description: "S-Band was observed to be defective. There was no trace coming on the",
        actionTakenRequested: "Requisition raised for shore Service. Expected at",
        targetDate: "01-Sep-2024",
        dateCompleted: "01-Sep-2024",
        status: "Open",
        priority: "High",
        critical: false,
        reportedBy: "Chief Engineer",
        createdAt: new Date("2019-09-01"),
        updatedAt: new Date("2024-09-01")
      },
      {
        id: "22/112/999",
        vesselId: "V001", 
        vesselName: "Vessel Name Extra Long 2",
        issueDate: "01-Sep-2019",
        category: "COC",
        description: "",
        actionTakenRequested: "",
        targetDate: null,
        dateCompleted: null,
        status: "Open",
        priority: "Medium",
        critical: true,
        reportedBy: "Chief Officer",
        createdAt: new Date("2019-09-01"),
        updatedAt: new Date("2019-09-01")
      }
    ];

    sampleDefects.forEach((defect) => {
      this.defects.set(defect.id, defect as Defect);
    });
  }

  // Defects CRUD methods
  async getDefects(filters?: { 
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
  }): Promise<Defect[]> {
    let defects = Array.from(this.defects.values());
    
    if (filters) {
      // Vessel filter
      if (filters.vesselId) {
        defects = defects.filter(d => d.vesselId === filters.vesselId);
      }
      
      // StatusView filter for Active/Resolved views
      if (filters.statusView) {
        if (filters.statusView === 'active') {
          // Active: status IN {Open, Pending, In-Progress, Awaiting Parts, Deferred}
          const activeStatuses = ['Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred'];
          defects = defects.filter(d => activeStatuses.includes(d.status));
        } else if (filters.statusView === 'resolved') {
          // Resolved: status IN {Closed, Cancelled}
          const resolvedStatuses = ['Closed', 'Cancelled'];
          defects = defects.filter(d => resolvedStatuses.includes(d.status));
        }
      }
      
      // Status filter
      if (filters.status) {
        defects = defects.filter(d => d.status === filters.status);
      }
      
      // Category filter
      if (filters.category) {
        defects = defects.filter(d => d.category === filters.category);
      }
      
      // Critical filter
      if (filters.critical !== undefined) {
        defects = defects.filter(d => d.critical === filters.critical);
      }
      
      // Text search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        defects = defects.filter(d => 
          d.id.toLowerCase().includes(searchTerm) ||
          d.description.toLowerCase().includes(searchTerm) ||
          (d.actionTakenRequested && d.actionTakenRequested.toLowerCase().includes(searchTerm)) ||
          d.vesselName.toLowerCase().includes(searchTerm)
        );
      }
      
      // Period filter
      if (filters.period) {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0); // All time
        }
        
        if (filters.period !== 'all') {
          defects = defects.filter(d => new Date(d.issueDate) >= startDate);
        }
      }
      
      // Due/Overdue filter
      if (filters.dueOverdue) {
        const now = new Date();
        if (filters.dueOverdue === 'due') {
          defects = defects.filter(d => d.targetDate && new Date(d.targetDate) >= now && d.status !== 'Closed');
        } else if (filters.dueOverdue === 'overdue') {
          defects = defects.filter(d => d.targetDate && new Date(d.targetDate) < now && d.status !== 'Closed');
        }
      }
      
      // Fleet filter (simplified implementation)
      if (filters.fleet) {
        // In a real system, this would filter by fleet assignment
        // For now, we'll just show all defects if a fleet is selected
      }
      
      // Group filter (simplified implementation)  
      if (filters.group) {
        // In a real system, this would group by department or equipment category
        // For now, we'll filter by equipment category if available
        if (filters.group === 'department' && defects.length > 0) {
          defects = defects.filter(d => d.equipmentCategory);
        }
      }
      
      // Include closed defects filter
      if (!filters.includeClosedDefects) {
        defects = defects.filter(d => d.status !== 'Closed');
      }
    }
    
    return defects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getDefectsCount(filters?: { statusView?: 'active' | 'resolved'; vesselId?: string; isCoC?: boolean }): Promise<number> {
    let defects = await this.getDefects(filters);
    
    // Apply isCoC filter if specified
    if (filters?.isCoC !== undefined) {
      defects = defects.filter(d => d.is_coc === filters.isCoC);
    }
    
    return defects.length;
  }

  async getDefect(id: string): Promise<Defect | undefined> {
    return this.defects.get(id);
  }

  async createDefect(defectData: InsertDefect): Promise<Defect> {
    const defect: Defect = {
      ...defectData,
      status: defectData.status || "Open",
      priority: defectData.priority || "Medium",
      critical: defectData.critical || false,
      severity: defectData.severity || 1,
      source: defectData.source || null,
      defectType: defectData.defectType || null,
      actionTakenRequested: defectData.actionTakenRequested || null,
      targetDate: defectData.targetDate || null,
      dateCompleted: defectData.dateCompleted || null,
      equipmentCategory: defectData.equipmentCategory || null,
      equipmentType: defectData.equipmentType || null,
      equipmentMake: defectData.equipmentMake || null,
      equipmentModel: defectData.equipmentModel || null,
      equipmentSerialNo: defectData.equipmentSerialNo || null,
      equipmentLocation: defectData.equipmentLocation || null,
      equipmentSystem: defectData.equipmentSystem || null,
      componentId: defectData.componentId || null,
      purchaseOrderRef: defectData.purchaseOrderRef || null,
      viqRef: defectData.viqRef || null,
      sfiCodeRef: defectData.sfiCodeRef || null,
      immediateCause: normalizeImmediateCause(defectData.immediateCause),
      rootCause: normalizeRootCause(defectData.rootCause),
      holdReason: defectData.holdReason || null,
      nextReviewDate: defectData.nextReviewDate || null,
      responsibleDept: defectData.responsibleDept || null,
      verifiedDate: defectData.verifiedDate || null,
      defectCategory: defectData.defectCategory || null,
      viqVersion: defectData.viqVersion || null,
      immediateCauseExplanation: defectData.immediateCauseExplanation || null,
      rootCauseExplanation: defectData.rootCauseExplanation || null,
      assignedTo: defectData.assignedTo || null,
      reviewedBy: defectData.reviewedBy || null,
      defermentFlag: defectData.defermentFlag || false,
      defermentReason: defectData.defermentReason || null,
      reportedTo: defectData.reportedTo || null,
      operatingState: defectData.operatingState || null,
      routineBreakdown: defectData.routineBreakdown || null,
      raisedByUserId: defectData.raisedByUserId || null,
      // Closure fields
      closedBy: defectData.closedBy || null,
      closedOn: defectData.closedOn || null,
      closureComment: defectData.closureComment || null,
      closureFiles: defectData.closureFiles || null,
      // Linked defects
      linkedDefects: defectData.linkedDefects || null,
      // Notes and audit
      notes: (defectData.notes || []) as Array<{
        noteId: string;
        noteText: string;
        attachments: string[];
        createdBy: string;
        createdOn: string;
      }>,
      auditTrail: (defectData.auditTrail || []) as Array<{
        action: string;
        userId: string;
        userName: string;
        timestamp: string;
        details?: any;
      }>,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.defects.set(defect.id, defect);
    return defect;
  }

  async updateDefect(id: string, updates: Partial<InsertDefect>): Promise<Defect> {
    const existing = this.defects.get(id);
    if (!existing) {
      throw new Error(`Defect with id ${id} not found`);
    }
    
    // Normalize immediateCause and rootCause if they're being updated
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.immediateCause !== undefined) {
      normalizedUpdates.immediateCause = normalizeImmediateCause(normalizedUpdates.immediateCause);
    }
    if (normalizedUpdates.rootCause !== undefined) {
      normalizedUpdates.rootCause = normalizeRootCause(normalizedUpdates.rootCause);
    }
    
    const updated: Defect = {
      ...existing,
      ...normalizedUpdates,
      notes: normalizedUpdates.notes ? (normalizedUpdates.notes as Array<{
        noteId: string;
        noteText: string;
        attachments: string[];
        createdBy: string;
        createdOn: string;
      }>) : existing.notes,
      auditTrail: normalizedUpdates.auditTrail ? (normalizedUpdates.auditTrail as Array<{
        action: string;
        userId: string;
        userName: string;
        timestamp: string;
        details?: any;
      }>) : existing.auditTrail,
      updatedAt: new Date()
    };
    
    this.defects.set(id, updated);
    return updated;
  }

  async deleteDefect(id: string): Promise<void> {
    if (!this.defects.has(id)) {
      throw new Error(`Defect with id ${id} not found`);
    }
    this.defects.delete(id);
  }

  // Defect Actions CRUD methods
  async getDefectActions(defectId: string): Promise<DefectAction[]> {
    return Array.from(this.defectActions.values())
      .filter(action => action.defectId === defectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createDefectAction(actionData: InsertDefectAction): Promise<DefectAction> {
    const action: DefectAction = {
      ...actionData,
      id: this.currentDefectActionId,
      status: actionData.status || "Open",
      dateCompleted: actionData.dateCompleted || null,
      justification: actionData.justification || null,
      attachmentUrls: actionData.attachmentUrls || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.defectActions.set(this.currentDefectActionId, action);
    this.currentDefectActionId++;
    return action;
  }

  async updateDefectAction(id: number, updates: Partial<InsertDefectAction>): Promise<DefectAction> {
    const existing = this.defectActions.get(id);
    if (!existing) {
      throw new Error(`DefectAction with id ${id} not found`);
    }
    
    const updated: DefectAction = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    
    this.defectActions.set(id, updated);
    return updated;
  }

  async deleteDefectAction(id: number): Promise<void> {
    if (!this.defectActions.has(id)) {
      throw new Error(`DefectAction with id ${id} not found`);
    }
    this.defectActions.delete(id);
  }

  // Defect Attachments CRUD methods
  async getDefectAttachments(defectId: string): Promise<DefectAttachment[]> {
    return Array.from(this.defectAttachments.values())
      .filter(attachment => attachment.defectId === defectId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async createDefectAttachment(attachmentData: InsertDefectAttachment): Promise<DefectAttachment> {
    const attachment: DefectAttachment = {
      ...attachmentData,
      id: this.currentDefectAttachmentId,
      uploadedAt: new Date()
    };
    
    this.defectAttachments.set(this.currentDefectAttachmentId, attachment);
    this.currentDefectAttachmentId++;
    return attachment;
  }

  async deleteDefectAttachment(id: number): Promise<void> {
    if (!this.defectAttachments.has(id)) {
      throw new Error(`DefectAttachment with id ${id} not found`);
    }
    this.defectAttachments.delete(id);
  }

  // Add note to defect
  async addDefectNote(defectId: string, note: { noteText: string; attachments: string[]; createdBy: string; }): Promise<Defect> {
    const defect = await this.getDefect(defectId);
    if (!defect) {
      throw new Error(`Defect with id ${defectId} not found`);
    }

    const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNote = {
      noteId,
      noteText: note.noteText,
      attachments: note.attachments,
      createdBy: note.createdBy,
      createdOn: new Date().toISOString()
    };

    const notes = defect.notes || [];
    notes.push(newNote);

    // Add audit entry
    const auditTrail = defect.auditTrail || [];
    auditTrail.push({
      action: 'ADD_NOTE',
      userId: note.createdBy,
      userName: note.createdBy,
      timestamp: new Date().toISOString(),
      details: { noteId }
    });

    const updatedDefect = {
      ...defect,
      notes,
      auditTrail,
      updatedAt: new Date()
    };

    this.defects.set(defectId, updatedDefect);
    return updatedDefect;
  }

  // Link related defects
  async linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect> {
    const defect = await this.getDefect(defectId);
    if (!defect) {
      throw new Error(`Defect with id ${defectId} not found`);
    }

    // Update main defect
    const currentLinks = defect.linkedDefects || [];
    const newLinks = Array.from(new Set([...currentLinks, ...linkedDefectIds]));
    
    // Add audit entry
    const auditTrail = defect.auditTrail || [];
    auditTrail.push({
      action: 'LINK',
      userId: 'system',
      userName: 'System',
      timestamp: new Date().toISOString(),
      details: { linkedDefects: linkedDefectIds }
    });

    const updatedDefect = {
      ...defect,
      linkedDefects: newLinks,
      auditTrail,
      updatedAt: new Date()
    };

    this.defects.set(defectId, updatedDefect);

    // Add reciprocal links to all linked defects
    for (const linkedId of linkedDefectIds) {
      const linkedDefect = await this.getDefect(linkedId);
      if (linkedDefect && linkedId !== defectId) {
        const linkedDefectLinks = linkedDefect.linkedDefects || [];
        if (!linkedDefectLinks.includes(defectId)) {
          linkedDefectLinks.push(defectId);
          const linkedAuditTrail = linkedDefect.auditTrail || [];
          linkedAuditTrail.push({
            action: 'LINK',
            userId: 'system',
            userName: 'System',
            timestamp: new Date().toISOString(),
            details: { linkedFrom: defectId }
          });
          this.defects.set(linkedId, {
            ...linkedDefect,
            linkedDefects: linkedDefectLinks,
            auditTrail: linkedAuditTrail,
            updatedAt: new Date()
          });
        }
      }
    }

    return updatedDefect;
  }

  // Close defect
  async closeDefect(defectId: string, closure: { closedBy: string; closureComment: string; closureFiles?: string[] }): Promise<Defect> {
    const defect = await this.getDefect(defectId);
    if (!defect) {
      throw new Error(`Defect with id ${defectId} not found`);
    }

    // Add audit entry
    const auditTrail = defect.auditTrail || [];
    auditTrail.push({
      action: 'CLOSE',
      userId: closure.closedBy,
      userName: closure.closedBy,
      timestamp: new Date().toISOString(),
      details: { comment: closure.closureComment }
    });

    const updatedDefect = {
      ...defect,
      status: 'Closed',
      closedBy: closure.closedBy,
      closedOn: new Date().toISOString(),
      closureComment: closure.closureComment,
      closureFiles: closure.closureFiles || [],
      auditTrail,
      updatedAt: new Date()
    };

    this.defects.set(defectId, updatedDefect);
    return updatedDefect;
  }

  // Recurring Defects methods (stub implementations)
  async getRecurringDefects(filters?: { windowMonths?: number; minOccurrences?: number; hasCoc?: boolean; equipmentKey?: string }): Promise<RecurringDefect[]> {
    return [];
  }

  async getRecurringDefect(id: number): Promise<RecurringDefect | undefined> {
    return undefined;
  }

  async calculateAndUpdateRecurringDefects(equipmentKey: string, windowMonths?: number): Promise<RecurringDefect | null> {
    return null;
  }

  async getRecurringDefectLinks(recurringId: number): Promise<RecurringDefectLink[]> {
    return [];
  }

  async getDefectsForRecurring(recurringId: number): Promise<Defect[]> {
    return [];
  }

  async recalculateAllRecurringDefects(): Promise<void> {
    // Stub implementation for MemStorage
  }

  // Seed helper methods (stub implementations)
  async getDefectBySeedId(seedId: string): Promise<Defect | undefined> {
    return undefined;
  }

  async getVesselIdByName(vesselName: string): Promise<string | undefined> {
    return undefined;
  }

  async createVessel(vessel: { id: string; name: string; type: string }): Promise<void> {
    // Stub implementation
  }

  // Import History methods
  async createImportHistory(history: InsertImportHistory): Promise<ImportHistory> {
    const newHistory: ImportHistory = {
      ...history,
      startedAt: history.startedAt || new Date(),
      finishedAt: history.finishedAt || null,
      created: history.created || 0,
      updated: history.updated || 0,
      skipped: history.skipped || 0,
      archived: history.archived || 0,
      vesselId: history.vesselId || null,
      originalName: history.originalName || null,
      archiveMissing: history.archiveMissing || false
    };
    this.importHistory.push(newHistory);
    return newHistory;
  }

  async getImportHistory(type?: string, limit: number = 20, offset: number = 0): Promise<{ items: ImportHistory[]; total: number }> {
    let filtered = [...this.importHistory];
    
    // Filter by type if provided
    if (type) {
      filtered = filtered.filter(h => h.type === type);
    }
    
    // Sort by startedAt descending (newest first)
    filtered.sort((a, b) => {
      const dateA = a.startedAt instanceof Date ? a.startedAt : new Date(a.startedAt);
      const dateB = b.startedAt instanceof Date ? b.startedAt : new Date(b.startedAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    
    return { items, total };
  }

  async getImportHistoryById(id: string): Promise<ImportHistory | undefined> {
    return this.importHistory.find(h => h.id === id);
  }

  async updateImportHistory(id: string, data: Partial<ImportHistory>): Promise<ImportHistory> {
    const index = this.importHistory.findIndex(h => h.id === id);
    if (index === -1) {
      throw new Error(`Import history with id ${id} not found`);
    }
    
    const updated: ImportHistory = {
      ...this.importHistory[index],
      ...data
    };
    
    this.importHistory[index] = updated;
    return updated;
  }

  // Import Change Log methods
  async createImportChangeLog(log: InsertImportChangeLog): Promise<ImportChangeLog> {
    const newLog: ImportChangeLog = {
      ...log,
      createdAt: new Date()
    };
    this.importChangeLogs.push(newLog);
    return newLog;
  }

  async getImportChangeLogs(importHistoryId: string): Promise<ImportChangeLog[]> {
    return this.importChangeLogs.filter(log => log.importHistoryId === importHistoryId);
  }

  async deleteImportChangeLogs(importHistoryId: string): Promise<void> {
    this.importChangeLogs = this.importChangeLogs.filter(log => log.importHistoryId !== importHistoryId);
  }

  // Fleet Admin - Makers methods
  async getMakers(search?: string): Promise<Maker[]> {
    let filtered = Array.from(this.makers.values());
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(m => 
        m.makerName.toLowerCase().includes(searchLower) ||
        m.makerCode.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => a.makerName.localeCompare(b.makerName));
  }

  async getMakerById(id: number): Promise<Maker | undefined> {
    return this.makers.get(id);
  }

  async createMaker(maker: InsertMaker): Promise<Maker> {
    const id = this.currentMakerId++;
    const makerCode = `MKR-${String(id).padStart(6, '0')}`;
    
    const newMaker: Maker = {
      id,
      makerCode,
      ...maker,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.makers.set(id, newMaker);
    return newMaker;
  }

  async updateMaker(id: number, data: Partial<InsertMaker>): Promise<Maker> {
    const existing = this.makers.get(id);
    if (!existing) {
      throw new Error(`Maker with id ${id} not found`);
    }
    
    const updated: Maker = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    
    this.makers.set(id, updated);
    return updated;
  }

  async deleteMaker(id: number): Promise<void> {
    this.makers.delete(id);
  }

  // Fleet Admin - Master Lists methods
  async getMasterLists(listType?: string): Promise<MasterList[]> {
    let filtered = Array.from(this.masterLists.values());
    
    if (listType) {
      filtered = filtered.filter(m => m.listType === listType && m.isActive);
    } else {
      filtered = filtered.filter(m => m.isActive);
    }
    
    return filtered.sort((a, b) => {
      // First sort by listType, then by displayOrder
      if (a.listType !== b.listType) {
        return a.listType.localeCompare(b.listType);
      }
      return a.displayOrder - b.displayOrder;
    });
  }

  async getMasterListById(id: number): Promise<MasterList | undefined> {
    return this.masterLists.get(id);
  }

  async getMasterListsByType(listType: string): Promise<MasterList[]> {
    return this.getMasterLists(listType);
  }

  async createMasterList(list: InsertMasterList): Promise<MasterList> {
    const id = this.currentMasterListId++;
    
    const newList: MasterList = {
      id,
      ...list,
      createdAt: new Date(),
    };
    
    this.masterLists.set(id, newList);
    return newList;
  }

  async updateMasterList(id: number, data: Partial<InsertMasterList>): Promise<MasterList> {
    const existing = this.masterLists.get(id);
    if (!existing) {
      throw new Error(`Master list with id ${id} not found`);
    }
    
    const updated: MasterList = {
      ...existing,
      ...data,
    };
    
    this.masterLists.set(id, updated);
    return updated;
  }

  async deleteMasterList(id: number): Promise<void> {
    this.masterLists.delete(id);
  }

  // ============= STORES METHODS - ZERO PMS LINKAGES =============
  async getStoresItems(vesselId: string, itemType?: string): Promise<StoresItem[]> {
    const items = Array.from(this.storesItems.values()).filter(
      (item) => item.vesselId === vesselId && !item.deleted && (itemType ? item.itemType === itemType : true)
    );
    return items;
  }

  async getStoresItem(id: number): Promise<StoresItem | undefined> {
    return this.storesItems.get(id);
  }

  async createStoresItem(item: InsertStoresItem): Promise<StoresItem> {
    const id = this.currentStoresItemId++;
    const now = new Date();
    const newItem: StoresItem = {
      id,
      ...item,
      rob: item.rob || "0",
      robLocationA: item.robLocationA || "0",
      robLocationB: item.robLocationB || "0",
      min: item.min || "0",
      deleted: false,
      isActive: item.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.storesItems.set(id, newItem);
    return newItem;
  }

  async updateStoresItem(id: number, data: Partial<StoresItem>): Promise<StoresItem> {
    const existing = this.storesItems.get(id);
    if (!existing) {
      throw new Error(`Stores item with id ${id} not found`);
    }
    const updated: StoresItem = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.storesItems.set(id, updated);
    return updated;
  }

  async deleteStoresItem(id: number): Promise<void> {
    const existing = this.storesItems.get(id);
    if (existing) {
      existing.deleted = true;
      existing.updatedAt = new Date();
      this.storesItems.set(id, existing);
    }
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
    const item = this.storesItems.get(id);
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

    const updated: StoresItem = {
      ...item,
      rob: String(Math.max(0, newTotalRob)),
      robLocationA: location === 'A' ? String(newLocationRob) : item.robLocationA,
      robLocationB: location === 'B' ? String(newLocationRob) : item.robLocationB,
      updatedAt: new Date(),
    };

    this.storesItems.set(id, updated);

    // Create ledger entry
    const ledgerEntry: StoresLedger = {
      id: this.currentStoresLedgerId++,
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
    };
    this.storesLedger.push(ledgerEntry);

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
    const item = this.storesItems.get(id);
    if (!item) {
      throw new Error(`Stores item with id ${id} not found`);
    }

    const qtyNum = Number(quantity);
    const locationRob = location === 'A' ? Number(item.robLocationA) : Number(item.robLocationB);
    const newLocationRob = locationRob + qtyNum;
    const newTotalRob = Number(item.rob) + qtyNum;

    const updated: StoresItem = {
      ...item,
      rob: String(newTotalRob),
      robLocationA: location === 'A' ? String(newLocationRob) : item.robLocationA,
      robLocationB: location === 'B' ? String(newLocationRob) : item.robLocationB,
      updatedAt: new Date(),
    };

    this.storesItems.set(id, updated);

    // Create ledger entry
    const ledgerEntry: StoresLedger = {
      id: this.currentStoresLedgerId++,
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
    };
    this.storesLedger.push(ledgerEntry);

    return updated;
  }

  async getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<StoresLedger[]> {
    return this.storesLedger.filter(
      (entry) => entry.vesselId === vesselId && (itemType ? entry.section === itemType : true)
    );
  }

  async getStoresItemHistory(itemId: number): Promise<StoresLedger[]> {
    return this.storesLedger.filter((entry) => entry.itemId === itemId);
  }

  async purgeJobsAndLinkedData(vesselId?: string): Promise<{
    deletedWorkOrderExecutions: number;
    deletedWorkOrders: number;
    deletedJobs: number;
    deletedRunningHoursAudits: number;
    componentsReset: number;
  }> {
    // Not implemented in MemStorage
    return {
      deletedWorkOrderExecutions: 0,
      deletedWorkOrders: 0,
      deletedJobs: 0,
      deletedRunningHoursAudits: 0,
      componentsReset: 0,
    };
  }
}

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

  // ============= STUBS FOR NON-PRIORITY METHODS =============
  
  async bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]> {
    throw new Error("Bulk update spares not yet migrated to PostgreSQL");
  }

  async updateChangeRequestTarget(id: number, targetType: string | null, targetId: string | null, snapshotBeforeJson: any): Promise<ChangeRequest> {
    throw new Error("Update change request target not yet migrated to PostgreSQL");
  }

  async updateChangeRequestProposed(id: number, proposedChangesJson: any, movePreviewJson?: any): Promise<ChangeRequest> {
    throw new Error("Update change request proposed not yet migrated to PostgreSQL");
  }

  async deleteChangeRequest(id: number): Promise<void> {
    throw new Error("Delete change request not yet migrated to PostgreSQL");
  }

  async submitChangeRequest(id: number, userId: string): Promise<ChangeRequest> {
    throw new Error("Submit change request not yet migrated to PostgreSQL");
  }

  async approveChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    throw new Error("Approve change request not yet migrated to PostgreSQL");
  }

  async rejectChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    throw new Error("Reject change request not yet migrated to PostgreSQL");
  }

  async returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
    throw new Error("Return change request not yet migrated to PostgreSQL");
  }

  async getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]> {
    throw new Error("Change request attachments not yet migrated to PostgreSQL");
  }

  async createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment> {
    throw new Error("Create change request attachment not yet migrated to PostgreSQL");
  }

  async getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]> {
    throw new Error("Change request comments not yet migrated to PostgreSQL");
  }

  async createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment> {
    throw new Error("Create change request comment not yet migrated to PostgreSQL");
  }

  async bulkCreateComponents(components: InsertComponent[]): Promise<Component[]> {
    throw new Error("Bulk create components not yet migrated to PostgreSQL");
  }

  async bulkUpdateComponents(components: Array<{ id: string; data: Partial<Component> }>): Promise<Component[]> {
    throw new Error("Bulk update components not yet migrated to PostgreSQL");
  }

  async bulkUpsertComponents(components: InsertComponent[]): Promise<{ created: number; updated: number }> {
    throw new Error("Bulk upsert components not yet migrated to PostgreSQL");
  }

  async bulkCreateSpares(spares: InsertSpare[]): Promise<Spare[]> {
    throw new Error("Bulk create spares not yet migrated to PostgreSQL");
  }

  async bulkUpdateSparesByROB(spares: Array<{ robId: string; data: Partial<Spare> }>): Promise<Spare[]> {
    throw new Error("Bulk update spares by ROB not yet migrated to PostgreSQL");
  }

  async bulkUpsertSpares(spares: InsertSpare[]): Promise<{ created: number; updated: number }> {
    throw new Error("Bulk upsert spares not yet migrated to PostgreSQL");
  }

  async archiveComponentsByIds(ids: string[]): Promise<number> {
    throw new Error("Archive components not yet migrated to PostgreSQL");
  }

  async archiveSparesByIds(ids: number[]): Promise<number> {
    throw new Error("Archive spares not yet migrated to PostgreSQL");
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

  async getAlertPolicies(): Promise<AlertPolicy[]> {
    throw new Error("Alert policies not yet migrated to PostgreSQL");
  }

  async getAlertPolicy(id: number): Promise<AlertPolicy | undefined> {
    throw new Error("Alert policy not yet migrated to PostgreSQL");
  }

  async createAlertPolicy(policy: InsertAlertPolicy): Promise<AlertPolicy> {
    throw new Error("Create alert policy not yet migrated to PostgreSQL");
  }

  async updateAlertPolicy(id: number, data: Partial<AlertPolicy>): Promise<AlertPolicy> {
    throw new Error("Update alert policy not yet migrated to PostgreSQL");
  }

  async deleteAlertPolicy(id: number): Promise<void> {
    throw new Error("Delete alert policy not yet migrated to PostgreSQL");
  }

  async getAlertEvents(filters?: { startDate?: Date; endDate?: Date; alertType?: string; priority?: string; status?: string; vesselId?: string }): Promise<AlertEvent[]> {
    throw new Error("Alert events not yet migrated to PostgreSQL");
  }

  async getAlertEvent(id: number): Promise<AlertEvent | undefined> {
    throw new Error("Alert event not yet migrated to PostgreSQL");
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    throw new Error("Create alert event not yet migrated to PostgreSQL");
  }

  async acknowledgeAlertEvent(id: number, userId: string): Promise<AlertEvent> {
    throw new Error("Acknowledge alert event not yet migrated to PostgreSQL");
  }

  async getAlertDeliveries(eventId: number): Promise<AlertDelivery[]> {
    throw new Error("Alert deliveries not yet migrated to PostgreSQL");
  }

  async createAlertDelivery(delivery: InsertAlertDelivery): Promise<AlertDelivery> {
    throw new Error("Create alert delivery not yet migrated to PostgreSQL");
  }

  async updateAlertDeliveryStatus(id: number, status: string, errorMessage?: string): Promise<AlertDelivery> {
    throw new Error("Update alert delivery status not yet migrated to PostgreSQL");
  }

  async getAlertConfig(vesselId: string): Promise<AlertConfig | undefined> {
    throw new Error("Alert config not yet migrated to PostgreSQL");
  }

  async createOrUpdateAlertConfig(config: InsertAlertConfig): Promise<AlertConfig> {
    throw new Error("Create/update alert config not yet migrated to PostgreSQL");
  }

  async getFormDefinitions(): Promise<FormDefinition[]> {
    throw new Error("Form definitions not yet migrated to PostgreSQL");
  }

  async getFormDefinition(id: number): Promise<FormDefinition | undefined> {
    throw new Error("Form definition not yet migrated to PostgreSQL");
  }

  async getFormDefinitionByName(name: string): Promise<FormDefinition | undefined> {
    throw new Error("Form definition by name not yet migrated to PostgreSQL");
  }

  async createFormDefinition(form: InsertFormDefinition): Promise<FormDefinition> {
    throw new Error("Create form definition not yet migrated to PostgreSQL");
  }

  async getFormVersions(formId: number): Promise<FormVersion[]> {
    throw new Error("Form versions not yet migrated to PostgreSQL");
  }

  async getFormVersion(id: number): Promise<FormVersion | undefined> {
    throw new Error("Form version not yet migrated to PostgreSQL");
  }

  async getLatestPublishedVersion(formId: number): Promise<FormVersion | undefined> {
    throw new Error("Latest published version not yet migrated to PostgreSQL");
  }

  async getLatestPublishedVersionByName(name: string): Promise<FormVersion | undefined> {
    throw new Error("Latest published version by name not yet migrated to PostgreSQL");
  }

  async createFormVersion(version: InsertFormVersion): Promise<FormVersion> {
    throw new Error("Create form version not yet migrated to PostgreSQL");
  }

  async updateFormVersion(id: number, data: Partial<FormVersion>): Promise<FormVersion> {
    throw new Error("Update form version not yet migrated to PostgreSQL");
  }

  async publishFormVersion(id: number, userId: string, changelog: string): Promise<FormVersion> {
    throw new Error("Publish form version not yet migrated to PostgreSQL");
  }

  async discardFormVersion(id: number): Promise<void> {
    throw new Error("Discard form version not yet migrated to PostgreSQL");
  }

  async createFormVersionUsage(usage: InsertFormVersionUsage): Promise<FormVersionUsage> {
    throw new Error("Create form version usage not yet migrated to PostgreSQL");
  }

  async getFormVersionUsage(formVersionId: number): Promise<FormVersionUsage[]> {
    throw new Error("Form version usage not yet migrated to PostgreSQL");
  }

  async seedForms(): Promise<void> {
    throw new Error("Seed forms not yet migrated to PostgreSQL");
  }

  async getIhmItem(id: string, type: 'component' | 'spare'): Promise<any | undefined> {
    throw new Error("IHM items not yet migrated to PostgreSQL");
  }

  async upsertIhmItem(item: any): Promise<any> {
    throw new Error("Upsert IHM item not yet migrated to PostgreSQL");
  }

  async getIhmMaintenanceLog(filters: any): Promise<any[]> {
    throw new Error("IHM maintenance log not yet migrated to PostgreSQL");
  }

  async createIhmMaintenanceLogEntry(entry: any): Promise<any> {
    throw new Error("Create IHM maintenance log entry not yet migrated to PostgreSQL");
  }

  async getIhmStatusReport(vesselId: string): Promise<any[]> {
    throw new Error("IHM status report not yet migrated to PostgreSQL");
  }

  async bulkCreateWorkOrders(workOrders: InsertWorkOrder[]): Promise<WorkOrder[]> {
    throw new Error("Bulk create work orders not yet migrated to PostgreSQL");
  }

  async bulkUpdateWorkOrders(workOrders: Array<{ templateCode: string; data: Partial<WorkOrder> }>): Promise<WorkOrder[]> {
    throw new Error("Bulk update work orders not yet migrated to PostgreSQL");
  }

  async bulkUpsertWorkOrders(workOrders: InsertWorkOrder[]): Promise<{ created: number; updated: number }> {
    throw new Error("Bulk upsert work orders not yet migrated to PostgreSQL");
  }

  async getFleetJobs(): Promise<WorkOrder[]> {
    throw new Error("Fleet jobs not yet migrated to PostgreSQL");
  }

  async getFleetJob(id: string): Promise<WorkOrder | undefined> {
    throw new Error("Fleet job not yet migrated to PostgreSQL");
  }

  async createFleetJob(job: InsertWorkOrder): Promise<WorkOrder> {
    throw new Error("Create fleet job not yet migrated to PostgreSQL");
  }

  async updateFleetJob(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    throw new Error("Update fleet job not yet migrated to PostgreSQL");
  }

  async deleteFleetJob(id: string): Promise<void> {
    throw new Error("Delete fleet job not yet migrated to PostgreSQL");
  }

  async addDefectNote(defectId: string, note: { noteText: string; attachments: string[]; createdBy: string; }): Promise<Defect> {
    throw new Error("Add defect note not yet migrated to PostgreSQL");
  }

  async linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect> {
    throw new Error("Link defects not yet migrated to PostgreSQL");
  }

  async closeDefect(defectId: string, closure: { closedBy: string; closureComment: string; closureFiles?: string[] }): Promise<Defect> {
    throw new Error("Close defect not yet migrated to PostgreSQL");
  }

  async calculateAndUpdateRecurringDefects(equipmentKey: string, windowMonths?: number): Promise<RecurringDefect | null> {
    throw new Error("Calculate recurring defects not yet migrated to PostgreSQL");
  }

  async getDefectsForRecurring(recurringId: number): Promise<Defect[]> {
    throw new Error("Get defects for recurring not yet migrated to PostgreSQL");
  }

  async recalculateAllRecurringDefects(): Promise<void> {
    throw new Error("Recalculate all recurring defects not yet migrated to PostgreSQL");
  }

  async getDefectBySeedId(seedId: string): Promise<Defect | undefined> {
    throw new Error("Get defect by seed ID not yet migrated to PostgreSQL");
  }

  async getVesselIdByName(vesselName: string): Promise<string | undefined> {
    throw new Error("Get vessel ID by name not yet migrated to PostgreSQL");
  }

  async createVessel(vessel: { id: string; name: string; type: string }): Promise<void> {
    throw new Error("Create vessel not yet migrated to PostgreSQL");
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
    throw new Error("Purge jobs and linked data not yet migrated to PostgreSQL");
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
