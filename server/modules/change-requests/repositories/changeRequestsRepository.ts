import { storage } from '../../../storage';
import type {
  ChangeRequest, InsertChangeRequest,
  ChangeRequestApproval, InsertChangeRequestApproval,
  ChangeRequestComment, InsertChangeRequestComment,
  ChangeRequestAttachment, InsertChangeRequestAttachment
} from '@shared/schema';

// ── Core Change Requests ──

export async function getChangeRequests(filters?: { category?: string; status?: string; q?: string; vesselId?: string; pendingForApprover?: string }): Promise<ChangeRequest[]> {
  return storage.getChangeRequests(filters);
}

export async function getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
  return storage.getChangeRequest(id);
}

export async function createChangeRequest(request: InsertChangeRequest): Promise<ChangeRequest> {
  return storage.createChangeRequest(request);
}

export async function updateChangeRequest(id: number, data: Partial<ChangeRequest>): Promise<ChangeRequest> {
  return storage.updateChangeRequest(id, data);
}

export async function deleteChangeRequest(id: number): Promise<void> {
  return storage.deleteChangeRequest(id);
}

// ── Workflow Actions ──

export async function approveChangeRequest(id: number, reviewerId: string, comment: string, role?: string, overriddenChanges?: Array<{ field: string; approverNewValue: string }>): Promise<ChangeRequest> {
  return storage.approveChangeRequest(id, reviewerId, comment, role, overriddenChanges);
}

export async function getAuditLogsByEntity(entityType: string, entityId: string): Promise<any[]> {
  return storage.getAuditLogsByEntity(entityType, entityId);
}

export async function rejectChangeRequest(id: number, reviewerId: string, comment: string, role?: string): Promise<ChangeRequest> {
  return storage.rejectChangeRequest(id, reviewerId, comment, role);
}

export async function returnChangeRequest(id: number, reviewerId: string, comment: string): Promise<ChangeRequest> {
  return storage.returnChangeRequest(id, reviewerId, comment);
}

export async function submitChangeRequest(id: number, userId: string): Promise<ChangeRequest> {
  return storage.submitChangeRequest(id, userId);
}

// ── Approval Steps ──

export async function getChangeRequestApprovalSteps(changeRequestId: number): Promise<ChangeRequestApproval[]> {
  return storage.getChangeRequestApprovalSteps(changeRequestId);
}

export async function createChangeRequestApprovalStep(step: InsertChangeRequestApproval): Promise<ChangeRequestApproval> {
  return storage.createChangeRequestApprovalStep(step);
}

export async function updateChangeRequestApprovalStep(id: number, data: Partial<ChangeRequestApproval>): Promise<ChangeRequestApproval> {
  return storage.updateChangeRequestApprovalStep(id, data);
}

// ── Approval Workflow Config ──

export async function getApprovalWorkflowConfig() {
  return storage.getApprovalWorkflowConfig();
}

// ── Comments ──

export async function getChangeRequestComments(changeRequestId: number): Promise<ChangeRequestComment[]> {
  return storage.getChangeRequestComments(changeRequestId);
}

export async function createChangeRequestComment(comment: InsertChangeRequestComment): Promise<ChangeRequestComment> {
  return storage.createChangeRequestComment(comment);
}

// ── Attachments ──

export async function getChangeRequestAttachments(changeRequestId: number): Promise<ChangeRequestAttachment[]> {
  return storage.getChangeRequestAttachments(changeRequestId);
}

export async function createChangeRequestAttachment(attachment: InsertChangeRequestAttachment): Promise<ChangeRequestAttachment> {
  return storage.createChangeRequestAttachment(attachment);
}

// ── Target Entity Resolution ──

export async function getComponent(id: string) {
  return storage.getComponent(id);
}

export async function getJob(id: string) {
  return storage.getJob(id);
}

export async function getWorkOrder(id: string) {
  return storage.getWorkOrder(id);
}

export async function getSpare(id: string) {
  return storage.getSpare(id);
}

export async function getStoresItem(id: string) {
  return storage.getStoresItem(id);
}
