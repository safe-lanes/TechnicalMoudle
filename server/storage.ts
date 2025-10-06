
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
  workOrders,
  type WorkOrder,
  type InsertWorkOrder,
  defects,
  type Defect,
  type InsertDefect,
  defectActions,
  type DefectAction,
  type InsertDefectAction,
  defectAttachments,
  type DefectAttachment,
  type InsertDefectAttachment
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Running Hours methods
  getComponents(vesselId: string): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  updateComponent(id: string, data: Partial<Component>): Promise<Component>;
  createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit>;
  getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]>;
  getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<RunningHoursAudit[]>;
  
  // Spares methods
  getSpares(vesselId: string): Promise<Spare[]>;
  getSpare(id: number): Promise<Spare | undefined>;
  createSpare(spare: InsertSpare): Promise<Spare>;
  updateSpare(id: number, data: Partial<Spare>): Promise<Spare>;
  deleteSpare(id: number): Promise<void>;
  consumeSpare(id: number, quantity: number, userId: string, remarks?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  receiveSpare(id: number, quantity: number, userId: string, remarks?: string, supplierPO?: string, place?: string, dateLocal?: string, tz?: string): Promise<Spare>;
  bulkUpdateSpares(updates: Array<{id: number, consumed?: number, received?: number, receivedDate?: string, receivedPlace?: string}>, userId: string, remarks?: string): Promise<Spare[]>;
  
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
  
  // Work Order methods
  getWorkOrders(vesselId?: string): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;
  
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
  private workOrders: Map<string, WorkOrder>;
  private currentWorkOrderId: number;
  private defects: Map<string, Defect>;
  private currentDefectId: number;
  private defectActions: Map<number, DefectAction>;
  private currentDefectActionId: number;
  private defectAttachments: Map<number, DefectAttachment>;
  private currentDefectAttachmentId: number;

  constructor() {
    this.users = new Map();
    this.currentUserId = 1;
    this.components = new Map();
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
    this.workOrders = new Map();
    this.currentWorkOrderId = 1;
    this.defects = new Map();
    this.currentDefectId = 1;
    this.defectActions = new Map();
    this.currentDefectActionId = 1;
    this.defectAttachments = new Map();
    this.currentDefectAttachmentId = 1;
    
    // Initialize sample components and spares
    this.initializeComponents();
    this.initializeSpares();
    this.initializeAlertPolicies();
    this.initializeFormDefinitions();
    this.initializeWorkOrders();
    this.initializeDefects();
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

  private initializeComponents() {
    // Create hierarchical component structure for MV Test Vessel
    const sampleComponents: Component[] = [
      // Top level - Ship groups
      { id: "1", name: "Ship General", componentCode: "1", parentId: null, vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "2", name: "Hull", componentCode: "2", parentId: null, vesselId: "MV Test Vessel", category: "Hull", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "3", name: "Equipment for Cargo", componentCode: "3", parentId: null, vesselId: "MV Test Vessel", category: "Equipment for Cargo", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "4", name: "Ship's Equipment", componentCode: "4", parentId: null, vesselId: "MV Test Vessel", category: "Ship's Equipment", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "5", name: "Equipment for Crew & Passengers", componentCode: "5", parentId: null, vesselId: "MV Test Vessel", category: "Equipment for Crew & Passengers", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "6", name: "Machinery Main Components", componentCode: "6", parentId: null, vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "7", name: "Systems for Machinery Main Components", componentCode: "7", parentId: null, vesselId: "MV Test Vessel", category: "Systems for Machinery Main Components", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "8", name: "Ship Common Systems", componentCode: "8", parentId: null, vesselId: "MV Test Vessel", category: "Ship Common Systems", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      
      // Level 2 - Under Ship General
      { id: "1.1", name: "Fresh Water System", componentCode: "1.1", parentId: "1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "1.2", name: "Sewage Treatment System", componentCode: "1.2", parentId: "1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "1.3", name: "HVAC – Accommodation", componentCode: "1.3", parentId: "1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      
      // Level 3 - Under Fresh Water System
      { id: "1.1.1", name: "Hydrophore Unit", componentCode: "1.1.1", parentId: "1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "1.1.2", name: "Potable Water Maker", componentCode: "1.1.2", parentId: "1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "1.1.3", name: "UV Sterilizer", componentCode: "1.1.3", parentId: "1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      
      // Level 4 - Under Hydrophore Unit
      { id: "1.1.1.1", name: "Pressure Vessel", componentCode: "1.1.1.1", parentId: "1.1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025",
        maker: "ACME Marine", model: "PV-2000", serialNo: "PV2024001", deptCategory: "Engineering", componentCategory: "Ship General", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: false },
      { id: "1.1.1.2", name: "Feed Pump", componentCode: "1.1.1.2", parentId: "1.1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "12450", lastUpdated: "02-Jun-2025",
        maker: "Grundfos", model: "CR32-4", serialNo: "GF2024002", deptCategory: "Engineering", componentCategory: "Ship General", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true },
      { id: "1.1.1.3", name: "Pressure Switch", componentCode: "1.1.1.3", parentId: "1.1.1", vesselId: "MV Test Vessel", category: "Ship General", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025",
        maker: "Danfoss", model: "KP35", serialNo: "DF2024003", deptCategory: "Engineering", componentCategory: "Ship General", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: false, classItem: false },
      
      // Level 2 - Under Machinery Main Components
      { id: "6.1", name: "Diesel Engines", componentCode: "6.1", parentId: "6", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "6.2", name: "Turbines", componentCode: "6.2", parentId: "6", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "0", lastUpdated: "02-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      
      // Level 3 - Under Diesel Engines
      { id: "6.1.1", name: "Main Engine", componentCode: "6.1.1", parentId: "6.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "6.1.2", name: "Auxiliary Engine #1", componentCode: "6.1.2", parentId: "6.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "15670", lastUpdated: "09-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      { id: "6.1.3", name: "Auxiliary Engine #2", componentCode: "6.1.3", parentId: "6.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "14980", lastUpdated: "16-Jun-2025", maker: null, model: null, serialNo: null, deptCategory: null, componentCategory: null, location: null, commissionedDate: null, critical: false, classItem: false },
      
      // Level 4 - Under Main Engine
      { id: "6.1.1.1", name: "Crankshaft", componentCode: "6.1.1.1", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "6S60MC-C", serialNo: "MB2020001", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true },
      { id: "6.1.1.2", name: "Cylinder Liners", componentCode: "6.1.1.2", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "CL-600", serialNo: "MB2020002", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true },
      { id: "6.1.1.3", name: "Piston & Piston Rod", componentCode: "6.1.1.3", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "PR-600", serialNo: "MB2020003", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: true },
      { id: "6.1.1.4", name: "Connecting Rod", componentCode: "6.1.1.4", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "CR-600", serialNo: "MB2020004", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: false },
      { id: "6.1.1.5", name: "Camshaft", componentCode: "6.1.1.5", parentId: "6.1.1", vesselId: "MV Test Vessel", category: "Machinery Main Components", currentCumulativeRH: "12580", lastUpdated: "30-Jun-2025",
        maker: "MAN B&W", model: "CS-600", serialNo: "MB2020005", deptCategory: "Engineering", componentCategory: "Machinery Main Components", location: "Engine Room", commissionedDate: "01-Jan-2020", critical: true, classItem: false }
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

  // Running Hours methods
  async getComponents(vesselId: string): Promise<Component[]> {
    return Array.from(this.components.values()).filter(c => c.vesselId === vesselId);
  }

  async getComponent(id: string): Promise<Component | undefined> {
    return this.components.get(id);
  }

  async updateComponent(id: string, data: Partial<Component>): Promise<Component> {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component ${id} not found`);
    }
    const updated = { ...component, ...data };
    this.components.set(id, updated);
    return updated;
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
    const updated = {
      ...request,
      status: 'approved' as const,
      reviewedByUserId: reviewerId,
      reviewedAt: now,
      updatedAt: now
    };
    this.changeRequests.set(id, updated);
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
      created.push(newComp);
    }
    return created;
  }

  async bulkUpdateComponents(updates: Array<{ id: string; data: Partial<Component> }>): Promise<Component[]> {
    const updated: Component[] = [];
    for (const { id, data } of updates) {
      const existing = this.components.get(id);
      if (existing) {
        const updatedComp = { ...existing, ...data };
        this.components.set(id, updatedComp);
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
        this.components.set(id, { ...existing, ...comp });
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
}

// Use in-memory storage for Technical Module
// Import PersistentFileStorage instead of using MemStorage
import { PersistentFileStorage } from "./persistentStorage";

// ALWAYS use PersistentFileStorage - no fallback to MemStorage
const storage: IStorage = new PersistentFileStorage('test-data.json');
console.log("✅ Application configured with PersistentFileStorage - all data will persist to test-data.json");

export { storage };
