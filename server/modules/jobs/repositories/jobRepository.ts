import { storage } from '../../../storage';

// ── Core Job Methods ──

export async function findJobs(vesselId?: string, componentId?: string) {
  return storage.getJobs(vesselId, componentId);
}

export async function findById(id: string) {
  return storage.getJob(id);
}

export async function create(data: any) {
  return storage.createJob(data);
}

export async function update(id: string, data: any) {
  return storage.updateJob(id, data);
}

export async function remove(id: string) {
  return storage.deleteJob(id);
}

// ── Job Component Links ──

export async function findJobComponentLinks(vesselId: string) {
  return storage.getJobComponentLinks(vesselId);
}

// ── Cross-table lookups ──

export async function findComponent(id: string) {
  return storage.getComponent(id);
}

export async function findComponentByCode(code: string, vesselId: string) {
  return storage.getComponentByCode(code, vesselId);
}

export async function findComponents(vesselId: string) {
  return storage.getComponents(vesselId);
}

export async function findWorkOrdersByJobId(jobId: string) {
  return storage.getWorkOrdersByJobId(jobId);
}

export async function findWorkOrders(vesselId: string) {
  return storage.getWorkOrders(vesselId);
}

export async function findSpareInventoryByPartCodes(vesselId: string, partCodes: string[]) {
  return (storage as any).getSpareInventoryByPartCodes(vesselId, partCodes);
}

export async function findSpareInventoryByPartNumbers(vesselId: string, partNumbers: string[]) {
  return (storage as any).getSpareInventoryByPartNumbers(vesselId, partNumbers);
}

export async function findSpares(vesselId: string) {
  return storage.getSpares(vesselId);
}

export async function findPmsVesselSettings(vesselId: string) {
  return storage.getPmsVesselSettings(vesselId);
}

// ── Maintenance History ──

export async function findMaintenanceHistoryByJobId(jobId: string) {
  return storage.getMaintenanceHistoryByJobId(jobId);
}

export async function findMaintenanceHistoryByJobCode(jobNo: string) {
  return storage.getMaintenanceHistoryByJobCode(jobNo);
}

// ── Audit Log ──

export async function createAuditLog(data: any) {
  return storage.createAuditLog(data);
}
