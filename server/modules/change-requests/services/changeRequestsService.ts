import * as crRepo from '../repositories/changeRequestsRepository';
import { insertChangeRequestSchema, insertChangeRequestCommentSchema, insertChangeRequestAttachmentSchema } from '@shared/schema';
import { getFieldDefinitions, getEditableFields, type TargetType } from '@shared/changeRequestFields';
import { ValidationError, NotFoundError } from '../../shared/errors';

const VALID_TARGET_TYPES: TargetType[] = ['component', 'job', 'work_order', 'spare', 'store'];
const VALID_STATUSES = ['draft', 'submitted', 'returned', 'approved', 'rejected'];

// ── Target ID Resolution ──
// Resolves any target_id (legacy or UUID) to the canonical UUID column value.
// This ensures change_request.target_id always stores UUID values.

async function resolveTargetIdToUuid(targetType: string, targetId: string): Promise<string> {
  switch (targetType) {
    case 'component': {
      const entity = await crRepo.getComponent(targetId);
      return entity?.cuuid || targetId;
    }
    case 'job': {
      const entity = await crRepo.getJob(targetId);
      return entity?.juuid || targetId;
    }
    case 'work_order': {
      const entity = await crRepo.getWorkOrder(targetId);
      return entity?.wouuid || targetId;
    }
    case 'spare': {
      const entity = await crRepo.getSpare(targetId);
      return entity?.suuid || targetId;
    }
    case 'store': {
      const entity = await crRepo.getStoresItem(targetId);
      return entity?.stuuid || targetId;
    }
    default:
      return targetId;
  }
}

// ── Field Definitions ──

export function getFieldDefs(targetType: string, editableOnly: boolean) {
  if (!VALID_TARGET_TYPES.includes(targetType as TargetType)) {
    throw new ValidationError(`Invalid target type: ${targetType}`);
  }

  return editableOnly
    ? getEditableFields(targetType as TargetType)
    : getFieldDefinitions(targetType as TargetType);
}

// ── Target Entity Resolution ──

export async function getTargetEntity(targetType: string, targetId: string) {
  let entity: any = null;

  switch (targetType) {
    case 'component':
      entity = await crRepo.getComponent(targetId);
      break;
    case 'job':
      entity = await crRepo.getJob(targetId);
      break;
    case 'work_order':
      entity = await crRepo.getWorkOrder(targetId);
      break;
    case 'spare':
      entity = await crRepo.getSpare(targetId);
      break;
    case 'store':
      entity = await crRepo.getStoresItem(targetId);
      break;
    default:
      throw new ValidationError(`Invalid target type: ${targetType}`);
  }

  if (!entity) {
    throw new NotFoundError(`${targetType} with ID ${targetId} not found`);
  }

  // Resolve to canonical UUID so frontend always gets the UUID back
  const resolvedTargetId = await resolveTargetIdToUuid(targetType, targetId);

  // Build field values map
  const fields = getFieldDefinitions(targetType as TargetType);
  const fieldValues: Record<string, { displayName: string; currentValue: any; editable: boolean; type: string }> = {};

  for (const field of fields) {
    fieldValues[field.columnName] = {
      displayName: field.displayName,
      currentValue: entity[field.columnName] ?? null,
      editable: field.editable,
      type: field.type
    };
  }

  return { entity, fieldValues, targetType, targetId: resolvedTargetId };
}

// ── Change Request CRUD ──

export async function getChangeRequests(query: { vesselId?: string; status?: string; category?: string; requestedBy?: string; periodFrom?: string; periodTo?: string }) {
  const { vesselId, status, category, requestedBy, periodFrom, periodTo } = query;

  const filters: { vesselId?: string } = {};
  if (vesselId) {
    filters.vesselId = vesselId;
  }

  let requests = await crRepo.getChangeRequests(filters);

  if (status) {
    requests = requests.filter(r => r.status === status);
  }
  if (category) {
    requests = requests.filter(r => r.category === category);
  }
  if (requestedBy) {
    requests = requests.filter(r => r.requestedByUserId === requestedBy);
  }
  if (periodFrom) {
    const from = new Date(periodFrom);
    requests = requests.filter(r => {
      const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
      return created >= from;
    });
  }
  if (periodTo) {
    const to = new Date(periodTo);
    requests = requests.filter(r => {
      const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
      return created <= to;
    });
  }

  requests.sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  return requests;
}

export async function getChangeRequest(id: number) {
  const request = await crRepo.getChangeRequest(id);
  if (!request) {
    throw new NotFoundError('Change request not found');
  }
  return request;
}

export async function createChangeRequest(body: any) {
  const validatedData = insertChangeRequestSchema.parse(body);

  if (!validatedData.vesselId) {
    throw new ValidationError('vesselId is required for change requests');
  }

  // Resolve target_id to canonical UUID before storing
  let resolvedTargetId = validatedData.targetId || null;
  if (validatedData.targetType && validatedData.targetId) {
    resolvedTargetId = await resolveTargetIdToUuid(validatedData.targetType, validatedData.targetId);
    if (resolvedTargetId !== validatedData.targetId) {
      console.log(`[CR_CREATE] Resolved target_id from "${validatedData.targetId}" to UUID "${resolvedTargetId}"`);
    }
  }

  const requestData = {
    ...validatedData,
    vesselId: validatedData.vesselId,
    targetId: resolvedTargetId,
    status: validatedData.status || 'draft' as const,
    requestedByUserId: validatedData.requestedByUserId || 'system'
  };

  return crRepo.createChangeRequest(requestData);
}

// ── Status Updates ──

export async function updateStatus(id: number, body: { status: string; reviewedByUserId?: string; reviewComments?: string }) {
  const { status, reviewedByUserId } = body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status');
  }

  return crRepo.updateChangeRequest(id, {
    status: status as any,
    reviewedByUserId,
    reviewedAt: new Date()
  });
}

// ── Approve / Reject ──

export async function approveChangeRequest(id: number, body: { comment: string; reviewerId?: string }) {
  const { comment, reviewerId } = body;

  if (!comment) {
    throw new ValidationError('Comment is required for approval');
  }

  const existing = await crRepo.getChangeRequest(id);
  console.log(`[CR_SERVICE] Approving change request ${id}`, {
    id: existing?.id,
    targetType: existing?.targetType,
    targetId: existing?.targetId,
    proposedChangesCount: Array.isArray(existing?.proposedChangesJson) ? existing.proposedChangesJson.length : 0
  });

  const updated = await crRepo.approveChangeRequest(id, reviewerId || 'reviewer', comment);
  console.log(`[CR_SERVICE] Approval complete, status: ${updated.status}`);
  return updated;
}

export async function rejectChangeRequest(id: number, body: { comment: string; reviewerId?: string }) {
  const { comment, reviewerId } = body;

  if (!comment) {
    throw new ValidationError('Comment is required for rejection');
  }

  console.log('Rejecting change request:', id, 'with comment:', comment);
  const updated = await crRepo.rejectChangeRequest(id, reviewerId || 'reviewer', comment);
  console.log('Successfully rejected request:', updated);
  return updated;
}

// ── Rejection History ──

export async function getRejectionHistory(id: number) {
  const existing = await crRepo.getChangeRequest(id);
  if (!existing) {
    throw new NotFoundError('Change request not found');
  }

  const entityIds = Array.from(
    new Set([existing.cruuid, String(existing.id)].filter(Boolean) as string[])
  );

  const logs: any[] = [];
  for (const eid of entityIds) {
    const entries = await crRepo.getAuditLogsByEntity('change_request', eid);
    logs.push(...entries);
  }

  const rejections = logs
    .filter((entry: any) => entry.actionType === 'reject')
    .map((entry: any) => {
      const payload = entry.payload || {};
      return {
        rejectedAt: payload.rejectedAt || entry.timestamp,
        rejectedBy: entry.userId,
        rejectionComments: payload.rejectionComments ?? null,
      };
    })
    .sort((a, b) => {
      const ta = new Date(a.rejectedAt).getTime();
      const tb = new Date(b.rejectedAt).getTime();
      return tb - ta;
    });

  return rejections;
}

// ── Comments ──

export async function getComments(changeRequestId: number) {
  return crRepo.getChangeRequestComments(changeRequestId);
}

export async function createComment(changeRequestId: number, body: any) {
  const commentData = { ...body, changeRequestId };
  const validatedData = insertChangeRequestCommentSchema.parse(commentData);
  return crRepo.createChangeRequestComment(validatedData);
}

// ── Attachments ──

export async function getAttachments(changeRequestId: number) {
  return crRepo.getChangeRequestAttachments(changeRequestId);
}

export async function createAttachment(changeRequestId: number, body: any) {
  const attachmentData = { ...body, changeRequestId };
  const validatedData = insertChangeRequestAttachmentSchema.parse(attachmentData);
  return crRepo.createChangeRequestAttachment(validatedData);
}
