import { storage } from '../../../storage';
import type { InsertRunningHoursAudit, RunningHoursAudit, Component } from '@shared/schema';

// ── Component Queries ──

export async function getComponents(vesselId: string): Promise<Component[]> {
  return storage.getComponents(vesselId);
}

export async function getComponent(id: string): Promise<Component | undefined> {
  return storage.getComponent(id);
}

export async function updateComponent(id: string, data: Partial<Component>): Promise<Component> {
  return storage.updateComponent(id, data);
}

// ── Utilization Rate ──

export async function getEarliestAuditTimestamp(vesselId: string): Promise<Date | null> {
  return storage.getEarliestAuditTimestamp(vesselId);
}

// ── Running Hours Audit ──

export async function getRunningHoursAudits(componentId: string, limit?: number): Promise<RunningHoursAudit[]> {
  return storage.getRunningHoursAudits(componentId, limit);
}

export async function createRunningHoursAudit(audit: InsertRunningHoursAudit): Promise<RunningHoursAudit> {
  return storage.createRunningHoursAudit(audit);
}

// ── Cascade ──

export async function cascadeRunningHoursUpdate(params: {
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
  return storage.cascadeRunningHoursUpdate(params);
}

// ── RH Counter Type / Config ──

export async function getMasterComponents(vesselId: string): Promise<Component[]> {
  return storage.getMasterComponents(vesselId);
}

export async function getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]> {
  return storage.getInheritedComponents(masterComponentId, vesselId);
}

export async function updateRHConfig(params: {
  componentId: string;
  rhCounterType: 'MASTER' | 'INHERITED' | 'NOT_RH_DRIVEN';
  rhMasterComponentId?: string | null;
  userId?: string;
}): Promise<Component> {
  return storage.updateRHConfig(params);
}

export async function updateMasterRunningHours(params: {
  componentId: string;
  newRHValue: number;
  updateSource: 'MANUAL' | 'IMPORT' | 'AUTOMATION';
  userId: string;
  comments?: string;
}): Promise<{
  masterUpdated: Component;
  inheritedUpdated: number;
}> {
  return storage.updateMasterRunningHours(params);
}
