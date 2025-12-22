/**
 * MINIMAL IN-MEMORY STORAGE FOR PREVIEW/DEVELOPMENT
 * 
 * This storage is used when DATABASE_URL is not configured.
 * It provides basic functionality for UI preview and flow validation.
 * 
 * For full functionality, configure DATABASE_URL to use PostgreSQL.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const DATA_FILE = path.join(process.cwd(), 'test-data.json');

interface TestData {
  [key: string]: any;
}

// Helper function to convert object map to array
function toArray(obj: any): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return Object.values(obj);
}

class MemStorage {
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
        // Initialize ID counters from existing data to ensure unique IDs
        this.initializeIdCounters();
      } else {
        console.log('[MemStorage] No test-data.json found, starting with empty data');
        this.data = {};
      }
    } catch (error) {
      console.error('[MemStorage] Error loading test-data.json:', error);
      this.data = {};
    }
  }
  
  private initializeIdCounters(): void {
    // Scan existing collections to find max IDs
    const collections = ['users', 'runningHoursAudits', 'audits'];
    for (const collection of collections) {
      const items = this.data[collection];
      if (items) {
        const itemsArray = Array.isArray(items) ? items : Object.values(items);
        let maxId = 0;
        for (const item of itemsArray as any[]) {
          if (typeof item.id === 'number' && item.id > maxId) {
            maxId = item.id;
          }
        }
        if (maxId > 0) {
          this.idCounters.set(collection, maxId);
        }
      }
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
    const users = toArray(this.data.users);
    return users.find((u: any) => u.id === id);
  }

  async getUserByUsername(username: string): Promise<any> {
    const users = toArray(this.data.users);
    return users.find((u: any) => u.username === username);
  }

  async createUser(user: any): Promise<any> {
    if (!this.data.users) this.data.users = {};
    const newUser = { ...user, id: this.getNextId('users') };
    this.data.users[newUser.id] = newUser;
    this.saveData();
    return newUser;
  }

  async getUsers(): Promise<any[]> {
    return toArray(this.data.users);
  }

  // Component methods
  async getComponents(vesselId: string): Promise<any[]> {
    return toArray(this.data.components).filter((c: any) => c.vesselId === vesselId);
  }

  async getComponent(id: string): Promise<any> {
    const components = toArray(this.data.components);
    return components.find((c: any) => c.id === id);
  }

  async getComponentByCode(componentCode: string, vesselId: string): Promise<any> {
    return toArray(this.data.components).find((c: any) => 
      c.componentCode === componentCode && c.vesselId === vesselId
    );
  }

  async createComponent(component: any): Promise<any> {
    if (!this.data.components) this.data.components = {};
    // Auto-generate ID if not provided: prefer componentCode for deterministic lookup, fallback to UUID
    const id = component.id || component.componentCode || randomUUID();
    const componentWithId = { ...component, id };
    this.data.components[id] = componentWithId;
    this.saveData();
    return componentWithId;
  }

  async updateComponent(id: string, data: any): Promise<any> {
    if (this.data.components && this.data.components[id]) {
      this.data.components[id] = { ...this.data.components[id], ...data };
      this.saveData();
      return this.data.components[id];
    }
    return undefined;
  }

  async deleteComponent(id: string): Promise<void> {
    if (this.data.components && this.data.components[id]) {
      delete this.data.components[id];
      this.saveData();
    }
  }

  async inactivateComponent(id: string, userId?: string, options?: any): Promise<any> {
    return { success: true, message: 'Preview mode - operation simulated', componentsInactivated: 0, jobsInactivated: 0 };
  }

  async createRunningHoursAudit(audit: any): Promise<any> { return { ...audit, id: this.getNextId('audits') }; }
  async getRunningHoursAudits(componentId: string, limit?: number): Promise<any[]> { return []; }
  async getRunningHoursAuditsInDateRange(componentId: string, startDate: Date, endDate: Date): Promise<any[]> { return []; }
  async getRunningHourParents(vesselId: string): Promise<any[]> { return []; }
  
  /**
   * Cascade running hours update - updates the MASTER component and cascades to INHERITED children
   */
  async cascadeRunningHoursUpdate(params: {
    parentComponentId: string;
    mode: 'setTotal' | 'addDelta';
    value: number;
    dateUpdated: string;
    dateUpdatedTZ?: string;
    comments?: string;
    meterReplaced?: boolean;
    oldMeterFinal?: string;
    newMeterStart?: string;
    userId?: string;
  }): Promise<any> {
    console.log('[MemStorage] cascadeRunningHoursUpdate called:', params);
    
    // Find the component by ID or component code
    let component = await this.getComponent(params.parentComponentId);
    
    // If not found by ID, try to find by component code across all vessels
    if (!component) {
      const allComponents = toArray(this.data.components);
      component = allComponents.find((c: any) => c.componentCode === params.parentComponentId);
    }
    
    if (!component) {
      console.error('[MemStorage] Component not found:', params.parentComponentId);
      throw new Error(`Component ${params.parentComponentId} not found`);
    }
    
    console.log('[MemStorage] Found component:', component.componentCode, 'current RH:', component.rhCurrentMaster || component.currentCumulativeRH);
    
    // Calculate the new RH value
    const currentRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
    let newRHValue: number;
    
    if (params.mode === 'setTotal') {
      newRHValue = params.value;
    } else {
      // addDelta mode
      newRHValue = currentRH + params.value;
    }
    
    console.log('[MemStorage] Updating RH from', currentRH, 'to', newRHValue);
    
    const now = new Date().toISOString();
    const updatedComponents: string[] = [];
    
    // Update the master component
    const updateData: any = {
      rhCurrentMaster: newRHValue.toString(),
      currentCumulativeRH: newRHValue.toString(),
      rhMasterUpdatedAt: now,
      rhMasterUpdatedBy: params.userId || 'admin',
      rhMasterUpdateSource: 'MANUAL',
      lastUpdated: params.dateUpdated || now,
      updatedAt: now,
    };
    
    // Handle meter replacement
    if (params.meterReplaced) {
      updateData.meterReplaced = true;
      updateData.oldMeterFinal = params.oldMeterFinal;
      updateData.newMeterStart = params.newMeterStart;
    }
    
    // Use the component's actual ID for update
    const componentId = component.id || component.componentCode;
    await this.updateComponent(componentId, updateData);
    updatedComponents.push(componentId);
    
    console.log('[MemStorage] Master component updated:', componentId);
    
    // Cascade delta to inherited components
    // INHERITED components maintain their own running hours and receive delta updates
    const inheritedComponents = await this.getInheritedComponents(componentId);
    console.log('[MemStorage] Found', inheritedComponents.length, 'inherited components to cascade');
    
    const delta = newRHValue - currentRH;
    
    for (const inherited of inheritedComponents) {
      // Get the inherited component's current RH value
      const inheritedCurrentRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
      // Apply the delta to their individual running hours
      const newInheritedRH = inheritedCurrentRH + delta;
      
      await this.updateComponent(inherited.id, {
        rhCurrentInheritedCached: newRHValue.toString(), // Cache the master's value for reference
        currentCumulativeRH: newInheritedRH.toString(), // Their individual RH + delta
        rhInheritedUpdatedAt: now,
        lastUpdated: now,
        updatedAt: now,
      });
      updatedComponents.push(inherited.id);
      console.log('[MemStorage] Inherited component updated:', inherited.id, 'from', inheritedCurrentRH, 'to', newInheritedRH, '(delta:', delta, ')');
    }
    
    // Create audit trail record
    if (!this.data.runningHoursAudits) this.data.runningHoursAudits = [];
    const auditRecord = {
      id: this.getNextId('runningHoursAudits'),
      componentId: componentId,
      previousValue: currentRH.toString(),
      newValue: newRHValue.toString(),
      delta: (newRHValue - currentRH).toString(),
      mode: params.mode,
      dateUpdated: params.dateUpdated,
      comments: params.comments,
      meterReplaced: params.meterReplaced || false,
      userId: params.userId || 'admin',
      createdAt: now,
    };
    this.data.runningHoursAudits.push(auditRecord);
    
    // Save all changes to disk
    this.saveData();
    
    console.log('[MemStorage] cascadeRunningHoursUpdate complete. Updated', updatedComponents.length, 'components');
    
    return { 
      success: true, 
      updatedComponents,
      newValue: newRHValue,
      previousValue: currentRH,
      auditId: auditRecord.id
    };
  }

  // RH Counter Type Methods (B7.B)
  async getMasterComponents(vesselId: string): Promise<any[]> {
    const components = toArray(this.data.components).filter(
      (c: any) => c.vesselId === vesselId && c.rhCounterType === 'MASTER'
    );
    return components;
  }

  async getInheritedComponents(masterComponentId: string): Promise<any[]> {
    return toArray(this.data.components).filter(
      (c: any) => c.rhMasterComponentId === masterComponentId && c.rhCounterType === 'INHERITED'
    );
  }

  async updateRHConfig(params: {
    componentId: string;
    rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN';
    rhMasterComponentId?: string | null;
    userId?: string;
  }): Promise<any> {
    const component = await this.getComponent(params.componentId);
    if (!component) throw new Error(`Component ${params.componentId} not found`);
    
    const updateData: any = {
      rhCounterType: params.rhCounterType,
      updatedAt: new Date().toISOString(),
    };

    if (params.rhCounterType === 'MASTER') {
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      if (!component.rhCurrentMaster) {
        updateData.rhCurrentMaster = '0';
        updateData.rhMasterUpdatedAt = new Date().toISOString();
      }
    } else if (params.rhCounterType === 'INHERITED') {
      updateData.rhMasterComponentId = params.rhMasterComponentId;
      updateData.rhCurrentMaster = null;
      const master = await this.getComponent(params.rhMasterComponentId!);
      if (master) {
        updateData.rhCurrentInheritedCached = master.rhCurrentMaster || '0';
        updateData.rhInheritedUpdatedAt = new Date().toISOString();
      }
    } else {
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentMaster = null;
      updateData.rhCurrentInheritedCached = null;
    }

    return this.updateComponent(params.componentId, updateData);
  }

  async updateMasterRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
    userId: string;
  }): Promise<{ masterUpdated: any; inheritedUpdated: number }> {
    const component = await this.getComponent(params.componentId);
    if (!component) throw new Error(`Component ${params.componentId} not found`);
    if (component.rhCounterType !== 'MASTER') {
      throw new Error(`Component ${params.componentId} is not a MASTER counter type`);
    }

    const now = new Date().toISOString();
    const masterUpdated = await this.updateComponent(params.componentId, {
      rhCurrentMaster: params.newRHValue.toString(),
      rhMasterUpdatedAt: now,
      rhMasterUpdatedBy: params.userId,
      rhMasterUpdateSource: params.updateSource,
    });

    // Cascade to inherited components
    const inheritedComponents = await this.getInheritedComponents(params.componentId);
    let inheritedUpdated = 0;
    for (const inherited of inheritedComponents) {
      await this.updateComponent(inherited.id, {
        rhCurrentInheritedCached: params.newRHValue.toString(),
        rhInheritedUpdatedAt: now,
      });
      inheritedUpdated++;
    }

    return { masterUpdated, inheritedUpdated };
  }

  // Fleet methods
  async getFleets(): Promise<any[]> { return toArray(this.data.fleets); }
  async getFleet(id: string): Promise<any> { 
    if (this.data.fleets && this.data.fleets[id]) return this.data.fleets[id];
    return toArray(this.data.fleets).find((f: any) => f.id === id); 
  }
  async createFleet(fleet: any): Promise<any> {
    if (!this.data.fleets) this.data.fleets = {};
    const id = fleet.id || `fleet-${this.getNextId('fleets')}`;
    const newFleet = { ...fleet, id };
    this.data.fleets[id] = newFleet;
    this.saveData();
    return newFleet;
  }
  async updateFleet(id: string, data: any): Promise<any> {
    if (this.data.fleets && this.data.fleets[id]) {
      this.data.fleets[id] = { ...this.data.fleets[id], ...data };
      this.saveData();
      return this.data.fleets[id];
    }
    return undefined;
  }
  async deleteFleet(id: string): Promise<void> {
    if (this.data.fleets && this.data.fleets[id]) {
      delete this.data.fleets[id];
      this.saveData();
    }
  }

  // Vessel methods
  async getVessels(): Promise<any[]> { return toArray(this.data.vessels); }
  async getVessel(id: string): Promise<any> { 
    if (this.data.vessels && this.data.vessels[id]) return this.data.vessels[id];
    return toArray(this.data.vessels).find((v: any) => v.id === id); 
  }
  async createVessel(vessel: any): Promise<any> {
    if (!this.data.vessels) this.data.vessels = {};
    this.data.vessels[vessel.id] = vessel;
    this.saveData();
    return vessel;
  }
  async updateVessel(id: string, data: any): Promise<any> {
    if (this.data.vessels && this.data.vessels[id]) {
      this.data.vessels[id] = { ...this.data.vessels[id], ...data };
      this.saveData();
      return this.data.vessels[id];
    }
    return undefined;
  }
  async deleteVessel(id: string): Promise<void> {
    if (this.data.vessels && this.data.vessels[id]) {
      delete this.data.vessels[id];
      this.saveData();
    }
  }

  // Job methods
  async getJobs(vesselId: string): Promise<any[]> { 
    return toArray(this.data.jobs).filter((j: any) => j.vesselId === vesselId); 
  }
  async getJob(id: string): Promise<any> { 
    if (this.data.jobs && this.data.jobs[id]) return this.data.jobs[id];
    return toArray(this.data.jobs).find((j: any) => j.id === id); 
  }
  async createJob(job: any): Promise<any> {
    if (!this.data.jobs) this.data.jobs = {};
    this.data.jobs[job.id] = job;
    this.saveData();
    return job;
  }
  async updateJob(id: string, data: any): Promise<any> {
    if (this.data.jobs && this.data.jobs[id]) {
      this.data.jobs[id] = { ...this.data.jobs[id], ...data };
      this.saveData();
      return this.data.jobs[id];
    }
    return undefined;
  }
  async deleteJob(id: string): Promise<void> {
    if (this.data.jobs && this.data.jobs[id]) {
      delete this.data.jobs[id];
      this.saveData();
    }
  }

  // Work Order methods
  async getWorkOrders(vesselId: string): Promise<any[]> { 
    return toArray(this.data.workOrders).filter((w: any) => w.vesselId === vesselId); 
  }
  async getWorkOrder(id: string): Promise<any> { 
    if (this.data.workOrders && this.data.workOrders[id]) return this.data.workOrders[id];
    return toArray(this.data.workOrders).find((w: any) => w.id === id); 
  }
  async createWorkOrder(workOrder: any): Promise<any> {
    if (!this.data.workOrders) this.data.workOrders = {};
    this.data.workOrders[workOrder.id] = workOrder;
    this.saveData();
    return workOrder;
  }
  async updateWorkOrder(id: string, data: any): Promise<any> {
    if (this.data.workOrders && this.data.workOrders[id]) {
      this.data.workOrders[id] = { ...this.data.workOrders[id], ...data };
      this.saveData();
      return this.data.workOrders[id];
    }
    return undefined;
  }
  async deleteWorkOrder(id: string): Promise<void> {
    if (this.data.workOrders && this.data.workOrders[id]) {
      delete this.data.workOrders[id];
      this.saveData();
    }
  }

  // Spares methods
  async getSpares(vesselId: string): Promise<any[]> { 
    return toArray(this.data.spares).filter((s: any) => s.vesselId === vesselId); 
  }
  async getSpare(id: string): Promise<any> { 
    if (this.data.spares && this.data.spares[id]) return this.data.spares[id];
    return toArray(this.data.spares).find((s: any) => s.id === id); 
  }
  async createSpare(spare: any): Promise<any> {
    if (!this.data.spares) this.data.spares = {};
    this.data.spares[spare.id] = spare;
    this.saveData();
    return spare;
  }
  async updateSpare(id: string, data: any): Promise<any> {
    if (this.data.spares && this.data.spares[id]) {
      this.data.spares[id] = { ...this.data.spares[id], ...data };
      this.saveData();
      return this.data.spares[id];
    }
    return undefined;
  }
  async deleteSpare(id: string): Promise<void> {
    if (this.data.spares && this.data.spares[id]) {
      delete this.data.spares[id];
      this.saveData();
    }
  }

  // Defect methods
  async getDefects(vesselId: string): Promise<any[]> { 
    return toArray(this.data.defects).filter((d: any) => d.vesselId === vesselId); 
  }
  async getDefect(id: string): Promise<any> { 
    if (this.data.defects && this.data.defects[id]) return this.data.defects[id];
    return toArray(this.data.defects).find((d: any) => d.id === id); 
  }
  async createDefect(defect: any): Promise<any> {
    if (!this.data.defects) this.data.defects = {};
    this.data.defects[defect.id] = defect;
    this.saveData();
    return defect;
  }
  async updateDefect(id: string, data: any): Promise<any> {
    if (this.data.defects && this.data.defects[id]) {
      this.data.defects[id] = { ...this.data.defects[id], ...data };
      this.saveData();
      return this.data.defects[id];
    }
    return undefined;
  }
  async deleteDefect(id: string): Promise<void> {
    if (this.data.defects && this.data.defects[id]) {
      delete this.data.defects[id];
      this.saveData();
    }
  }

  // Stub implementations for remaining methods
  async getAllDefects(): Promise<any[]> { return toArray(this.data.defects); }
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
  async calculateAndUpdateRecurringDefects(equipmentKey: string): Promise<any> { return null; }
  async recalculateAllRecurringDefects(): Promise<void> { 
    console.log('[MemStorage] recalculateAllRecurringDefects called - no-op in file mode');
  }

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
  async getMakers(): Promise<any[]> { return toArray(this.data.makers); }
  async getMaker(id: number): Promise<any> { 
    if (this.data.makers && this.data.makers[id]) return this.data.makers[id];
    return toArray(this.data.makers).find((m: any) => m.id === id); 
  }
  async createMaker(maker: any): Promise<any> { return { ...maker, id: this.getNextId('makers') }; }
  async updateMaker(id: number, data: any): Promise<any> { return data; }
  async deleteMaker(id: number): Promise<void> {}
  async getMasterLists(): Promise<any[]> { return toArray(this.data.masterLists); }
  async getMasterList(id: number): Promise<any> { return undefined; }
  async createMasterList(list: any): Promise<any> { return { ...list, id: this.getNextId('masterLists') }; }
  async updateMasterList(id: number, data: any): Promise<any> { return data; }
  async deleteMasterList(id: number): Promise<void> {}
  async getMakerLists(): Promise<any[]> { return []; }
  async getMakerList(): Promise<any[]> { return toArray(this.data.makerLists || []); }
  async getMakerListItem(id: number): Promise<any> { return undefined; }
  async getMakerListByCode(makerCode: string): Promise<any> { return undefined; }
  async createMakerList(list: any): Promise<any> { return { ...list, id: this.getNextId('makerLists') }; }
  async createMakerListItem(maker: any): Promise<any> { return { ...maker, id: this.getNextId('makerLists') }; }
  async updateMakerList(id: number, data: any): Promise<any> { return data; }
  async deleteMakerList(id: number): Promise<void> {}
  async getSfiDetails(): Promise<any[]> { return toArray(this.data.sfiDetails); }
  async getSfiDetail(id: number): Promise<any> { return undefined; }
  async createSfiDetail(detail: any): Promise<any> { return { ...detail, id: this.getNextId('sfiDetails') }; }
  async updateSfiDetail(id: number, data: any): Promise<any> { return data; }
  async deleteSfiDetail(id: number): Promise<void> {}
  async getMasterDataItems(): Promise<any[]> { return toArray(this.data.masterData); }
  async getMasterDataItem(id: number): Promise<any> { return undefined; }
  async createMasterDataItem(item: any): Promise<any> { return { ...item, id: this.getNextId('masterData') }; }
  async updateMasterDataItem(id: number, data: any): Promise<any> { return data; }
  async deleteMasterDataItem(id: number): Promise<void> {}

  // Stores methods
  async getStoresItems(vesselId: string): Promise<any[]> { 
    return toArray(this.data.storesItems).filter((s: any) => s.vesselId === vesselId); 
  }
  async getStoresItem(id: string): Promise<any> { 
    if (this.data.storesItems && this.data.storesItems[id]) return this.data.storesItems[id];
    return toArray(this.data.storesItems).find((s: any) => s.id === id); 
  }
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
  async getAllComponentMaintenanceHistory(): Promise<any[]> { return []; }
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
  async getImportHistory(type?: string, limit?: number, offset?: number): Promise<{ items: any[]; total: number }> { 
    return { items: [], total: 0 }; 
  }
  async getImportHistoryById(id: string): Promise<any> { return undefined; }
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

  // Additional methods
  async getJobByCode(jobCode: string, vesselId: string): Promise<any> {
    return toArray(this.data.jobs).find((j: any) => j.jobCode === jobCode && j.vesselId === vesselId);
  }

  async getSpareByCode(spareCode: string, vesselId: string): Promise<any> {
    return toArray(this.data.spares).find((s: any) => s.spareCode === spareCode && s.vesselId === vesselId);
  }

  async getWorkOrdersByJob(jobId: string): Promise<any[]> {
    return toArray(this.data.workOrders).filter((w: any) => w.jobId === jobId);
  }

  async getAllJobs(): Promise<any[]> { return toArray(this.data.jobs); }
  async getAllWorkOrders(): Promise<any[]> { return toArray(this.data.workOrders); }
  async getAllSpares(): Promise<any[]> { return toArray(this.data.spares); }
  async getAllComponents(): Promise<any[]> { return toArray(this.data.components); }

  // Bulk prefetch methods for performance
  async getComponentsByCodes(codes: string[], vesselId?: string): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const allComponents = toArray(this.data.components);
    for (const comp of allComponents) {
      if (codes.includes(comp.componentCode) && (!vesselId || comp.vesselId === vesselId)) {
        result.set(comp.componentCode, comp);
      }
    }
    return result;
  }

  async getJobsByJobNos(jobNos: string[], vesselId?: string): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const allJobs = toArray(this.data.jobs);
    for (const job of allJobs) {
      if (jobNos.includes(job.jobNo || job.jobCode) && (!vesselId || job.vesselId === vesselId)) {
        result.set(job.jobNo || job.jobCode, job);
      }
    }
    return result;
  }

  async getWorkOrdersByTemplateIds(templateIds: string[], vesselId?: string): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const allWorkOrders = toArray(this.data.workOrders);
    for (const wo of allWorkOrders) {
      if (templateIds.includes(wo.templateId || wo.jobId) && (!vesselId || wo.vesselId === vesselId)) {
        result.set(wo.templateId || wo.jobId, wo);
      }
    }
    return result;
  }

  // Fleet component methods
  async getFleetComponents(fleetId: string): Promise<any[]> { return []; }
  async getFleetComponent(id: number): Promise<any> { return undefined; }
  async createFleetComponent(component: any): Promise<any> { return { ...component, id: this.getNextId('fleetComponents') }; }
  async updateFleetComponent(id: number, data: any): Promise<any> { return data; }
  async deleteFleetComponent(id: number): Promise<void> {}

  // Fleet job methods
  async getFleetJobs(fleetId: string): Promise<any[]> { return []; }
  async getFleetJob(id: number): Promise<any> { return undefined; }
  async createFleetJob(job: any): Promise<any> { return { ...job, id: this.getNextId('fleetJobs') }; }
  async updateFleetJob(id: number, data: any): Promise<any> { return data; }
  async deleteFleetJob(id: number): Promise<void> {}

  // Fleet spare methods
  async getFleetSpares(fleetId: string): Promise<any[]> { return []; }
  async getFleetSpare(id: number): Promise<any> { return undefined; }
  async createFleetSpare(spare: any): Promise<any> { return { ...spare, id: this.getNextId('fleetSpares') }; }
  async updateFleetSpare(id: number, data: any): Promise<any> { return data; }
  async deleteFleetSpare(id: number): Promise<void> {}

  // Postponed work orders check
  async checkAndRevertPostponedWorkOrders(): Promise<{ checked: number; reverted: number }> {
    console.log('[MemStorage] checkAndRevertPostponedWorkOrders called - no-op in file mode');
    return { checked: 0, reverted: 0 };
  }
}

export const memStorage = new MemStorage();
