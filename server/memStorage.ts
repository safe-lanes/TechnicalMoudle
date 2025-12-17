/**
 * MINIMAL IN-MEMORY STORAGE FOR PREVIEW/DEVELOPMENT
 * 
 * This storage is used when DATABASE_URL is not configured.
 * It provides basic functionality for UI preview and flow validation.
 * Data is not persisted - this is intentional for preview mode.
 * 
 * For full functionality, configure DATABASE_URL to use PostgreSQL.
 */

import { type IStorage } from './storage';
import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.join(process.cwd(), 'test-data.json');

interface TestData {
  users?: any[];
  fleets?: any[];
  vessels?: any[];
  components?: any[];
  jobs?: any[];
  workOrders?: any[];
  spares?: any[];
  defects?: any[];
  [key: string]: any;
}

class MemStorage implements IStorage {
  private data: TestData = {};
  private idCounters: Map<string, number> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(content);
        console.log('[MemStorage] Loaded data from test-data.json');
      } else {
        console.log('[MemStorage] No test-data.json found, starting with empty data');
        this.data = {};
      }
    } catch (error) {
      console.error('[MemStorage] Error loading test-data.json:', error);
      this.data = {};
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('[MemStorage] Error saving data:', error);
    }
  }

  private getNextId(collection: string): number {
    const current = this.idCounters.get(collection) || 0;
    const next = current + 1;
    this.idCounters.set(collection, next);
    return next;
  }

  // User methods
  async getUser(id: number): Promise<any> {
    return this.data.users?.find((u: any) => u.id === id);
  }

  async getUserByUsername(username: string): Promise<any> {
    return this.data.users?.find((u: any) => u.username === username);
  }

  async createUser(user: any): Promise<any> {
    if (!this.data.users) this.data.users = [];
    const newUser = { ...user, id: this.getNextId('users') };
    this.data.users.push(newUser);
    this.saveData();
    return newUser;
  }

  async getUsers(): Promise<any[]> {
    return this.data.users || [];
  }

  // Component methods
  async getComponents(vesselId: string): Promise<any[]> {
    return (this.data.components || []).filter((c: any) => c.vesselId === vesselId);
  }

  async getComponent(id: string): Promise<any> {
    return (this.data.components || []).find((c: any) => c.id === id);
  }

  async getComponentByCode(componentCode: string, vesselId: string): Promise<any> {
    return (this.data.components || []).find((c: any) => 
      c.componentCode === componentCode && c.vesselId === vesselId
    );
  }

  async createComponent(component: any): Promise<any> {
    if (!this.data.components) this.data.components = [];
    const newComponent = { ...component };
    this.data.components.push(newComponent);
    this.saveData();
    return newComponent;
  }

  async updateComponent(id: string, data: any): Promise<any> {
    const components = this.data.components || [];
    const index = components.findIndex((c: any) => c.id === id);
    if (index >= 0) {
      components[index] = { ...components[index], ...data };
      this.saveData();
      return components[index];
    }
    return undefined as any;
  }

  async deleteComponent(id: string): Promise<void> {
    if (this.data.components) {
      this.data.components = this.data.components.filter((c: any) => c.id !== id);
      this.saveData();
    }
  }

  // Generic stub methods - return empty arrays/objects for unimplemented methods
  // These allow the app to start and show UI without full database functionality

  async inactivateComponent(id: string, userId?: string, options?: any): Promise<any> {
    return { success: true, message: 'Preview mode - operation simulated', componentsInactivated: 0, jobsInactivated: 0 };
  }

  async createRunningHoursAudit(audit: any): Promise<any> { return { ...audit, id: this.getNextId('audits') }; }
  async getRunningHoursAudits(componentId: string, limit?: number): Promise<any[]> { return []; }
  async getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<any[]> { return []; }
  async getRunningHourParents(vesselId: string): Promise<any[]> { return []; }
  async cascadeRunningHoursUpdate(params: any): Promise<any> { return { success: true, updatedComponents: [] }; }

  // Fleet methods
  async getFleets(): Promise<any[]> { return this.data.fleets || []; }
  async getFleet(id: string): Promise<any> { return (this.data.fleets || []).find((f: any) => f.id === id); }
  async createFleet(fleet: any): Promise<any> {
    if (!this.data.fleets) this.data.fleets = [];
    const newFleet = { ...fleet, id: fleet.id || `fleet-${this.getNextId('fleets')}` };
    this.data.fleets.push(newFleet);
    this.saveData();
    return newFleet;
  }
  async updateFleet(id: string, data: any): Promise<any> {
    const fleets = this.data.fleets || [];
    const index = fleets.findIndex((f: any) => f.id === id);
    if (index >= 0) {
      fleets[index] = { ...fleets[index], ...data };
      this.saveData();
      return fleets[index];
    }
    return undefined as any;
  }
  async deleteFleet(id: string): Promise<void> {
    if (this.data.fleets) {
      this.data.fleets = this.data.fleets.filter((f: any) => f.id !== id);
      this.saveData();
    }
  }

  // Vessel methods
  async getVessels(): Promise<any[]> { return this.data.vessels || []; }
  async getVessel(id: string): Promise<any> { return (this.data.vessels || []).find((v: any) => v.id === id); }
  async createVessel(vessel: any): Promise<any> {
    if (!this.data.vessels) this.data.vessels = [];
    const newVessel = { ...vessel };
    this.data.vessels.push(newVessel);
    this.saveData();
    return newVessel;
  }
  async updateVessel(id: string, data: any): Promise<any> {
    const vessels = this.data.vessels || [];
    const index = vessels.findIndex((v: any) => v.id === id);
    if (index >= 0) {
      vessels[index] = { ...vessels[index], ...data };
      this.saveData();
      return vessels[index];
    }
    return undefined as any;
  }
  async deleteVessel(id: string): Promise<void> {
    if (this.data.vessels) {
      this.data.vessels = this.data.vessels.filter((v: any) => v.id !== id);
      this.saveData();
    }
  }

  // Job methods
  async getJobs(vesselId: string): Promise<any[]> { return (this.data.jobs || []).filter((j: any) => j.vesselId === vesselId); }
  async getJob(id: string): Promise<any> { return (this.data.jobs || []).find((j: any) => j.id === id); }
  async createJob(job: any): Promise<any> {
    if (!this.data.jobs) this.data.jobs = [];
    const newJob = { ...job };
    this.data.jobs.push(newJob);
    this.saveData();
    return newJob;
  }
  async updateJob(id: string, data: any): Promise<any> {
    const jobs = this.data.jobs || [];
    const index = jobs.findIndex((j: any) => j.id === id);
    if (index >= 0) {
      jobs[index] = { ...jobs[index], ...data };
      this.saveData();
      return jobs[index];
    }
    return undefined as any;
  }
  async deleteJob(id: string): Promise<void> {
    if (this.data.jobs) {
      this.data.jobs = this.data.jobs.filter((j: any) => j.id !== id);
      this.saveData();
    }
  }

  // Work Order methods
  async getWorkOrders(vesselId: string): Promise<any[]> { return (this.data.workOrders || []).filter((w: any) => w.vesselId === vesselId); }
  async getWorkOrder(id: string): Promise<any> { return (this.data.workOrders || []).find((w: any) => w.id === id); }
  async createWorkOrder(workOrder: any): Promise<any> {
    if (!this.data.workOrders) this.data.workOrders = [];
    const newWorkOrder = { ...workOrder };
    this.data.workOrders.push(newWorkOrder);
    this.saveData();
    return newWorkOrder;
  }
  async updateWorkOrder(id: string, data: any): Promise<any> {
    const workOrders = this.data.workOrders || [];
    const index = workOrders.findIndex((w: any) => w.id === id);
    if (index >= 0) {
      workOrders[index] = { ...workOrders[index], ...data };
      this.saveData();
      return workOrders[index];
    }
    return undefined as any;
  }
  async deleteWorkOrder(id: string): Promise<void> {
    if (this.data.workOrders) {
      this.data.workOrders = this.data.workOrders.filter((w: any) => w.id !== id);
      this.saveData();
    }
  }

  // Spares methods
  async getSpares(vesselId: string): Promise<any[]> { return (this.data.spares || []).filter((s: any) => s.vesselId === vesselId); }
  async getSpare(id: string): Promise<any> { return (this.data.spares || []).find((s: any) => s.id === id); }
  async createSpare(spare: any): Promise<any> {
    if (!this.data.spares) this.data.spares = [];
    const newSpare = { ...spare };
    this.data.spares.push(newSpare);
    this.saveData();
    return newSpare;
  }
  async updateSpare(id: string, data: any): Promise<any> {
    const spares = this.data.spares || [];
    const index = spares.findIndex((s: any) => s.id === id);
    if (index >= 0) {
      spares[index] = { ...spares[index], ...data };
      this.saveData();
      return spares[index];
    }
    return undefined as any;
  }
  async deleteSpare(id: string): Promise<void> {
    if (this.data.spares) {
      this.data.spares = this.data.spares.filter((s: any) => s.id !== id);
      this.saveData();
    }
  }

  // Defect methods
  async getDefects(vesselId: string): Promise<any[]> { return (this.data.defects || []).filter((d: any) => d.vesselId === vesselId); }
  async getDefect(id: string): Promise<any> { return (this.data.defects || []).find((d: any) => d.id === id); }
  async createDefect(defect: any): Promise<any> {
    if (!this.data.defects) this.data.defects = [];
    const newDefect = { ...defect };
    this.data.defects.push(newDefect);
    this.saveData();
    return newDefect;
  }
  async updateDefect(id: string, data: any): Promise<any> {
    const defects = this.data.defects || [];
    const index = defects.findIndex((d: any) => d.id === id);
    if (index >= 0) {
      defects[index] = { ...defects[index], ...data };
      this.saveData();
      return defects[index];
    }
    return undefined as any;
  }
  async deleteDefect(id: string): Promise<void> {
    if (this.data.defects) {
      this.data.defects = this.data.defects.filter((d: any) => d.id !== id);
      this.saveData();
    }
  }

  // Stub implementations for remaining IStorage methods
  // These return empty results to allow the app to function in preview mode

  async getAllDefects(): Promise<any[]> { return this.data.defects || []; }
  async getDefectActions(defectId: string): Promise<any[]> { return []; }
  async createDefectAction(action: any): Promise<any> { return { ...action, id: this.getNextId('defectActions') }; }
  async updateDefectAction(id: string, data: any): Promise<any> { return data; }
  async deleteDefectAction(id: string): Promise<void> {}
  async getDefectAttachments(defectId: string): Promise<any[]> { return []; }
  async createDefectAttachment(attachment: any): Promise<any> { return { ...attachment, id: this.getNextId('defectAttachments') }; }
  async deleteDefectAttachment(id: string): Promise<void> {}
  async getRecurringDefects(vesselId: string): Promise<any[]> { return []; }
  async getRecurringDefect(id: string): Promise<any> { return undefined; }
  async createRecurringDefect(defect: any): Promise<any> { return { ...defect, id: this.getNextId('recurringDefects') }; }
  async updateRecurringDefect(id: string, data: any): Promise<any> { return data; }
  async deleteRecurringDefect(id: string): Promise<void> {}
  async getRecurringDefectLinks(recurringDefectId: string): Promise<any[]> { return []; }
  async createRecurringDefectLink(link: any): Promise<any> { return { ...link, id: this.getNextId('links') }; }
  async deleteRecurringDefectLink(id: string): Promise<void> {}

  // Alert methods
  async getAlertPolicies(vesselId: string): Promise<any[]> { return []; }
  async getAlertPolicy(id: number): Promise<any> { return undefined; }
  async createAlertPolicy(policy: any): Promise<any> { return { ...policy, id: this.getNextId('alertPolicies') }; }
  async updateAlertPolicy(id: number, data: any): Promise<any> { return data; }
  async deleteAlertPolicy(id: number): Promise<void> {}
  async getAlertEvents(vesselId: string): Promise<any[]> { return []; }
  async getAlertEvent(id: number): Promise<any> { return undefined; }
  async createAlertEvent(event: any): Promise<any> { return { ...event, id: this.getNextId('alertEvents') }; }
  async updateAlertEvent(id: number, data: any): Promise<any> { return data; }
  async getAlertDeliveries(eventId: number): Promise<any[]> { return []; }
  async createAlertDelivery(delivery: any): Promise<any> { return { ...delivery, id: this.getNextId('alertDeliveries') }; }
  async updateAlertDelivery(id: number, data: any): Promise<any> { return data; }
  async getAlertConfig(vesselId: string): Promise<any> { return undefined; }
  async upsertAlertConfig(config: any): Promise<any> { return { ...config, id: this.getNextId('alertConfig') }; }

  // Form methods
  async getFormDefinitions(): Promise<any[]> { return []; }
  async getFormDefinition(id: number): Promise<any> { return undefined; }
  async createFormDefinition(form: any): Promise<any> { return { ...form, id: this.getNextId('forms') }; }
  async updateFormDefinition(id: number, data: any): Promise<any> { return data; }
  async deleteFormDefinition(id: number): Promise<void> {}
  async getFormVersions(formId: number): Promise<any[]> { return []; }
  async getFormVersion(id: number): Promise<any> { return undefined; }
  async getLatestFormVersion(formId: number): Promise<any> { return undefined; }
  async createFormVersion(version: any): Promise<any> { return { ...version, id: this.getNextId('formVersions') }; }
  async updateFormVersion(id: number, data: any): Promise<any> { return data; }
  async getFormVersionUsage(formId: number): Promise<any[]> { return []; }
  async createFormVersionUsage(usage: any): Promise<any> { return { ...usage, id: this.getNextId('formVersionUsage') }; }

  // Change Request methods
  async getChangeRequests(vesselId?: string): Promise<any[]> { return []; }
  async getChangeRequest(id: string): Promise<any> { return undefined; }
  async createChangeRequest(request: any): Promise<any> { return { ...request, id: `cr-${this.getNextId('changeRequests')}` }; }
  async updateChangeRequest(id: string, data: any): Promise<any> { return data; }
  async deleteChangeRequest(id: string): Promise<void> {}
  async getChangeRequestAttachments(requestId: string): Promise<any[]> { return []; }
  async createChangeRequestAttachment(attachment: any): Promise<any> { return { ...attachment, id: this.getNextId('crAttachments') }; }
  async deleteChangeRequestAttachment(id: number): Promise<void> {}
  async getChangeRequestComments(requestId: string): Promise<any[]> { return []; }
  async createChangeRequestComment(comment: any): Promise<any> { return { ...comment, id: this.getNextId('crComments') }; }

  // IHM methods
  async getIhmItems(vesselId: string): Promise<any[]> { return []; }
  async getIhmItem(id: string): Promise<any> { return undefined; }
  async createIhmItem(item: any): Promise<any> { return { ...item }; }
  async updateIhmItem(id: string, data: any): Promise<any> { return data; }
  async deleteIhmItem(id: string): Promise<void> {}
  async getIhmMaintenanceLogs(vesselId: string): Promise<any[]> { return []; }
  async createIhmMaintenanceLog(log: any): Promise<any> { return { ...log, id: this.getNextId('ihmLogs') }; }

  // Fleet mapping methods
  async getFleetVesselMappings(fleetId: string): Promise<any[]> { return []; }
  async createFleetVesselMapping(mapping: any): Promise<any> { return { ...mapping, id: this.getNextId('fvm') }; }
  async deleteFleetVesselMapping(id: number): Promise<void> {}
  async getFleetComponentMappings(fleetId: string): Promise<any[]> { return []; }
  async createFleetComponentMapping(mapping: any): Promise<any> { return { ...mapping, id: this.getNextId('fcm') }; }
  async deleteFleetComponentMapping(id: number): Promise<void> {}
  async getFleetJobVesselMappings(fleetId: string): Promise<any[]> { return []; }
  async createFleetJobVesselMapping(mapping: any): Promise<any> { return { ...mapping, id: this.getNextId('fjvm') }; }
  async deleteFleetJobVesselMapping(id: number): Promise<void> {}
  async getFleetSpareVesselMappings(fleetId: string): Promise<any[]> { return []; }
  async createFleetSpareVesselMapping(mapping: any): Promise<any> { return { ...mapping, id: this.getNextId('fsvm') }; }
  async deleteFleetSpareVesselMapping(id: number): Promise<void> {}

  // Master data methods
  async getMakers(): Promise<any[]> { return this.data.makers || []; }
  async getMaker(id: number): Promise<any> { return (this.data.makers || []).find((m: any) => m.id === id); }
  async createMaker(maker: any): Promise<any> { return { ...maker, id: this.getNextId('makers') }; }
  async updateMaker(id: number, data: any): Promise<any> { return data; }
  async deleteMaker(id: number): Promise<void> {}
  async getMasterLists(): Promise<any[]> { return this.data.masterLists || []; }
  async getMasterList(id: number): Promise<any> { return undefined; }
  async createMasterList(list: any): Promise<any> { return { ...list, id: this.getNextId('masterLists') }; }
  async updateMasterList(id: number, data: any): Promise<any> { return data; }
  async deleteMasterList(id: number): Promise<void> {}
  async getMakerLists(): Promise<any[]> { return []; }
  async getMakerList(id: number): Promise<any> { return undefined; }
  async createMakerList(list: any): Promise<any> { return { ...list, id: this.getNextId('makerLists') }; }
  async updateMakerList(id: number, data: any): Promise<any> { return data; }
  async deleteMakerList(id: number): Promise<void> {}
  async getSfiDetails(): Promise<any[]> { return this.data.sfiDetails || []; }
  async getSfiDetail(id: number): Promise<any> { return undefined; }
  async createSfiDetail(detail: any): Promise<any> { return { ...detail, id: this.getNextId('sfiDetails') }; }
  async updateSfiDetail(id: number, data: any): Promise<any> { return data; }
  async deleteSfiDetail(id: number): Promise<void> {}
  async getMasterDataItems(): Promise<any[]> { return this.data.masterData || []; }
  async getMasterDataItem(id: number): Promise<any> { return undefined; }
  async createMasterDataItem(item: any): Promise<any> { return { ...item, id: this.getNextId('masterData') }; }
  async updateMasterDataItem(id: number, data: any): Promise<any> { return data; }
  async deleteMasterDataItem(id: number): Promise<void> {}

  // Stores methods
  async getStoresItems(vesselId: string): Promise<any[]> { return (this.data.storesItems || []).filter((s: any) => s.vesselId === vesselId); }
  async getStoresItem(id: string): Promise<any> { return (this.data.storesItems || []).find((s: any) => s.id === id); }
  async createStoresItem(item: any): Promise<any> { return { ...item }; }
  async updateStoresItem(id: string, data: any): Promise<any> { return data; }
  async deleteStoresItem(id: string): Promise<void> {}
  async getStoresLedger(itemId: string): Promise<any[]> { return []; }
  async createStoresLedgerEntry(entry: any): Promise<any> { return { ...entry, id: this.getNextId('storesLedger') }; }

  // Spares history
  async getSparesHistory(spareId: string): Promise<any[]> { return []; }
  async createSparesHistory(history: any): Promise<any> { return { ...history, id: this.getNextId('sparesHistory') }; }

  // Certificate/Survey methods
  async getCertificates(vesselId: string): Promise<any[]> { return []; }
  async getCertificate(id: number): Promise<any> { return undefined; }
  async createCertificate(cert: any): Promise<any> { return { ...cert, id: this.getNextId('certificates') }; }
  async updateCertificate(id: number, data: any): Promise<any> { return data; }
  async deleteCertificate(id: number): Promise<void> {}
  async getSurveys(vesselId: string): Promise<any[]> { return []; }
  async getSurvey(id: number): Promise<any> { return undefined; }
  async createSurvey(survey: any): Promise<any> { return { ...survey, id: this.getNextId('surveys') }; }
  async updateSurvey(id: number, data: any): Promise<any> { return data; }
  async deleteSurvey(id: number): Promise<void> {}

  // PMS Vessel Settings
  async getPmsVesselSettings(vesselId: string): Promise<any> { return undefined; }
  async upsertPmsVesselSettings(settings: any): Promise<any> { return settings; }

  // Component Documents
  async getComponentDocuments(componentId: string): Promise<any[]> { return []; }
  async getComponentDocument(id: number): Promise<any> { return undefined; }
  async createComponentDocument(doc: any): Promise<any> { return { ...doc, id: this.getNextId('componentDocs') }; }
  async updateComponentDocument(id: number, data: any): Promise<any> { return data; }
  async deleteComponentDocument(id: number): Promise<void> {}

  // Component Class Regulatory
  async getComponentClassRegulatory(componentId: string): Promise<any[]> { return []; }
  async createComponentClassRegulatory(item: any): Promise<any> { return { ...item, id: this.getNextId('classReg') }; }
  async updateComponentClassRegulatory(id: number, data: any): Promise<any> { return data; }
  async deleteComponentClassRegulatory(id: number): Promise<void> {}

  // Component Maintenance History
  async getComponentMaintenanceHistory(componentId: string): Promise<any[]> { return []; }
  async createComponentMaintenanceHistory(item: any): Promise<any> { return { ...item, id: this.getNextId('maintHistory') }; }

  // Component Requisitions
  async getComponentRequisitions(componentId: string): Promise<any[]> { return []; }
  async createComponentRequisition(req: any): Promise<any> { return { ...req, id: this.getNextId('requisitions') }; }
  async updateComponentRequisition(id: number, data: any): Promise<any> { return data; }
  async deleteComponentRequisition(id: number): Promise<void> {}

  // Work Order Execution Details
  async getWorkOrderExecutionDetails(workOrderId: string): Promise<any[]> { return []; }
  async createWorkOrderExecutionDetails(details: any): Promise<any> { return { ...details, id: this.getNextId('woDetails') }; }
  async updateWorkOrderExecutionDetails(id: number, data: any): Promise<any> { return data; }

  // Import History
  async getImportHistory(vesselId?: string): Promise<any[]> { return []; }
  async getImportHistoryItem(id: number): Promise<any> { return undefined; }
  async createImportHistory(item: any): Promise<any> { return { ...item, id: this.getNextId('importHistory') }; }
  async updateImportHistory(id: number, data: any): Promise<any> { return data; }
  async getImportChangeLogs(importId: number): Promise<any[]> { return []; }
  async createImportChangeLog(log: any): Promise<any> { return { ...log, id: this.getNextId('importChangeLogs') }; }

  // Work Order Executions
  async getWorkOrderExecutions(workOrderId: string): Promise<any[]> { return []; }
  async getWorkOrderExecution(id: string): Promise<any> { return undefined; }
  async createWorkOrderExecution(execution: any): Promise<any> { return { ...execution }; }
  async updateWorkOrderExecution(id: string, data: any): Promise<any> { return data; }
  async deleteWorkOrderExecution(id: string): Promise<void> {}

  // Additional methods that might be needed
  async getJobByCode(jobCode: string, vesselId: string): Promise<any> {
    return (this.data.jobs || []).find((j: any) => j.jobCode === jobCode && j.vesselId === vesselId);
  }

  async getSpareByCode(spareCode: string, vesselId: string): Promise<any> {
    return (this.data.spares || []).find((s: any) => s.spareCode === spareCode && s.vesselId === vesselId);
  }

  async getWorkOrdersByJob(jobId: string): Promise<any[]> {
    return (this.data.workOrders || []).filter((w: any) => w.jobId === jobId);
  }

  async getAllJobs(): Promise<any[]> { return this.data.jobs || []; }
  async getAllWorkOrders(): Promise<any[]> { return this.data.workOrders || []; }
  async getAllSpares(): Promise<any[]> { return this.data.spares || []; }
  async getAllComponents(): Promise<any[]> { return this.data.components || []; }
}

export const memStorage = new MemStorage();
