import { storage } from '../../../storage';

// ── Core Work Order Methods ──

export async function findWorkOrders(vesselId?: string) {
  return storage.getWorkOrders(vesselId);
}

export async function findById(id: string) {
  return storage.getWorkOrder(id);
}

export async function create(data: any) {
  return storage.createWorkOrder(data);
}

export async function update(id: string, data: any) {
  return storage.updateWorkOrder(id, data);
}

export async function remove(id: string) {
  return storage.deleteWorkOrder(id);
}

// ── Work Order Executions ──

export async function findExecutions(componentId: string) {
  return storage.getWorkOrderExecutions(componentId);
}

export async function findExecutionById(id: string) {
  return storage.getWorkOrderExecutionById(id);
}

export async function createExecution(data: any) {
  return storage.createWorkOrderExecution(data);
}

export async function updateExecution(id: string, data: any) {
  return storage.updateWorkOrderExecution(id, data);
}

// ── Cross-table lookups ──

export async function findJobs(vesselId?: string) {
  return storage.getJobs(vesselId);
}

export async function findJob(id: string) {
  return storage.getJob(id);
}

export async function updateJob(id: string, data: any) {
  return storage.updateJob(id, data);
}

export async function findJobsByVessel(vesselId: string) {
  return storage.getJobs(vesselId);
}

export async function findComponents(vesselId?: string) {
  return storage.getComponents(vesselId as string);
}

export async function findComponent(id: string) {
  return storage.getComponent(id);
}

export async function findComponentByCode(code: string, vesselId: string) {
  return storage.getComponentByCode(code, vesselId);
}

// ── Vessel Settings ──

export async function findPmsVesselSettings(vesselId: string) {
  return storage.getPmsVesselSettings(vesselId);
}

export async function findAllPmsVesselSettings() {
  return storage.getAllPmsVesselSettings();
}

// ── Running Hours ──

export async function findRunningHoursAudits(componentId: string) {
  return storage.getRunningHoursAudits(componentId);
}

export async function setComponentRunningHours(data: any) {
  return storage.setComponentRunningHours(data);
}

export async function createRunningHoursAudit(data: any) {
  return storage.createRunningHoursAudit(data);
}

// ── Inventory ──

export async function findSpareInventoryByPartCodes(vesselId: string, partCodes: string[]) {
  if (typeof (storage as any).getSpareInventoryByPartCodes === 'function') {
    return (storage as any).getSpareInventoryByPartCodes(vesselId, partCodes);
  }
  return new Map(); // MemStorage doesn't implement this method
}

export async function findSpareInventoryByPartNumbers(vesselId: string, partNumbers: string[]) {
  if (typeof (storage as any).getSpareInventoryByPartNumbers === 'function') {
    return (storage as any).getSpareInventoryByPartNumbers(vesselId, partNumbers);
  }
  return new Map(); // MemStorage doesn't implement this method
}

export async function findSpares(vesselId: string) {
  return storage.getSpares(vesselId);
}

export async function findOrCreateLocation(vesselId: string, name: string, userId: string) {
  return storage.findOrCreateLocation(vesselId, name, userId);
}

export async function performInventoryTransaction(data: any) {
  return storage.performInventoryTransaction(data);
}

// ── Maintenance History ──

export async function createMaintenanceHistory(data: any) {
  return storage.createComponentMaintenanceHistory(data);
}

export async function findMaintenanceHistoryByWorkOrderId(woId: string) {
  return storage.getMaintenanceHistoryByWorkOrderId(woId);
}

// ── Job Component Links ──

export async function updateJobComponentLinkTracking(vesselId: string, jobId: string, componentId: string, data: any) {
  return storage.updateJobComponentLinkTracking(vesselId, jobId, componentId, data);
}

export async function findLinkedComponentsForJob(jobId: string) {
  if (typeof storage.getLinkedComponentsForJob === 'function') {
    return storage.getLinkedComponentsForJob(jobId);
  }
  return []; // MemStorage doesn't implement this method
}

// ── Users ──

export async function findUser(userId: string) {
  return storage.getUser(parseInt(userId, 10));
}

// ── Postponements ──

export async function checkAndRevertPostponedWorkOrders(vesselId?: string) {
  return storage.checkAndRevertPostponedWorkOrders(vesselId);
}

// ── Audit Log ──

export async function createAuditLog(data: any) {
  return storage.createAuditLog(data);
}

// ── Storage reference (for WO numbering utilities) ──

export function getStorage() {
  return storage;
}
