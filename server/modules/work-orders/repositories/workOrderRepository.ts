import { storage } from '../../../storage';

// ── Core Work Order Methods ──

export async function findWorkOrders(vesselId?: string, vesselIds?: string[]) {
  return storage.getWorkOrders(vesselId, vesselIds);
}

// Alert-scan candidates: vessel-scoped rows whose authored status can still compute
// to a derived band (see getOverdueVesselWorkOrdersForAlerts in the service).
export async function findAlertCandidateWorkOrders() {
  return storage.getAlertCandidateWorkOrders();
}

export async function findById(id: string) {
  return storage.getWorkOrder(id);
}

export async function findByCode(code: string) {
  return storage.getWorkOrderByCode(code);
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

export async function findWorkOrdersByJobId(jobId: string) {
  return storage.getWorkOrdersByJobId(jobId);
}

export async function findWorkOrdersByComponent(componentIdOrCode: string, vesselId?: string) {
  const allWOs = await storage.getWorkOrders(vesselId);
  return allWOs.filter((wo: any) =>
    wo.component === componentIdOrCode ||
    wo.componentCode === componentIdOrCode ||
    wo.component === componentIdOrCode.split('.').pop()
  );
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
  return storage.getSpareInventoryByPartCodes(vesselId, partCodes);
}

export async function findSpareInventoryByPartNumbers(vesselId: string, partNumbers: string[]) {
  return storage.getSpareInventoryByPartNumbers(vesselId, partNumbers);
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

export async function getSpareLocationStockItem(spareId: number, locationId: number) {
  return storage.getSpareLocationStockItem(spareId, locationId);
}

export async function upsertSpareLocationStock(data: any) {
  return storage.upsertSpareLocationStock(data);
}

export async function getLocationById(id: number) {
  return storage.getLocationById(id);
}

export async function getInventoryTransactions(vesselId: string, options?: any) {
  return storage.getInventoryTransactions(vesselId, options);
}

// ── Maintenance History ──

export async function createMaintenanceHistory(data: any) {
  return storage.createComponentMaintenanceHistory(data);
}

export async function findMaintenanceHistoryByWorkOrderId(woId: string) {
  return storage.getMaintenanceHistoryByWorkOrderId(woId);
}

export async function findMaintenanceHistoryByJobId(jobId: string) {
  return storage.getMaintenanceHistoryByJobId(jobId);
}

// ── Job Component Links ──

export async function updateJobComponentLinkTracking(vesselId: string, jobId: string, componentId: string, data: any) {
  return storage.updateJobComponentLinkTracking(vesselId, jobId, componentId, data);
}

export async function findAllJobComponentLinks() {
  return storage.getAllJobComponentLinks();
}

export async function findLinkedComponentsForJob(jobId: string) {
  return storage.getLinkedComponentsForJob(jobId);
}

// ── Users ──

export async function findUser(userId: string) {
  return storage.getUser(parseInt(userId, 10));
}

// ── Postponements ──

export async function checkAndRevertPostponedWorkOrders(vesselId?: string) {
  return storage.checkAndRevertPostponedWorkOrders(vesselId);
}

export async function findPostponementsByWorkOrderId(workOrderId: string) {
  return storage.getWorkOrderPostponementsByWorkOrderId(workOrderId);
}

export async function createPostponement(data: any) {
  return storage.createWorkOrderPostponement(data);
}

export async function getMaxPostponementNumber(workOrderId: string): Promise<number> {
  const rows = await storage.getWorkOrderPostponementsByWorkOrderId(workOrderId);
  if (!rows || rows.length === 0) return 0;
  return Math.max(...rows.map((r: any) => r.postponementNumber || 1));
}

// ── WO Postponement Approval Steps ──

export async function getWoPostponementApprovalSteps(postponementId: string) {
  return storage.getWoPostponementApprovalSteps(postponementId);
}

export async function createWoPostponementApprovalStep(data: any) {
  return storage.createWoPostponementApprovalStep(data);
}

export async function updateWoPostponementApprovalStep(id: number, data: any) {
  return storage.updateWoPostponementApprovalStep(id, data);
}

export async function getLatestAwaitingPostponement(workOrderId: string) {
  return storage.getLatestAwaitingPostponement(workOrderId);
}

/** Phase 0 / P0.3d — one-transaction postponement-approval finalize (see postgresStorage). */
export async function finalizePostponementApproval(params: Parameters<typeof storage.finalizePostponementApproval>[0]) {
  return storage.finalizePostponementApproval(params);
}

export async function verifyApproverForLevel(reviewerId: string, approvalLevel: string) {
  return storage.verifyApproverForLevel(reviewerId, approvalLevel);
}

// ── Audit Log ──

export async function createAuditLog(data: any) {
  return storage.createAuditLog(data);
}

export async function getAuditLogsByEntity(entityType: string, entityId: string) {
  return storage.getAuditLogsByEntity(entityType, entityId);
}

// ── Storage reference (for WO numbering utilities) ──

export function getStorage() {
  return storage;
}
