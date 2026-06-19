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

export async function getChangeRequests(query: { vesselId?: string; status?: string; category?: string; requestedBy?: string; periodFrom?: string; periodTo?: string; pendingForApprover?: string }) {
  const { vesselId, status, category, requestedBy, periodFrom, periodTo, pendingForApprover } = query;

  const filters: { vesselId?: string; pendingForApprover?: string } = {};
  if (vesselId) {
    filters.vesselId = vesselId;
  }
  if (pendingForApprover) {
    filters.pendingForApprover = pendingForApprover;
    // When filtering by approver, return directly — storage handles the filter
    return crRepo.getChangeRequests(filters);
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

  const submitAfterCreate = validatedData.status === 'submitted';

  const requestData = {
    ...validatedData,
    vesselId: validatedData.vesselId,
    targetId: resolvedTargetId,
    status: 'draft' as const,
    requestedByUserId: validatedData.requestedByUserId || 'system'
  };

  const created = await crRepo.createChangeRequest(requestData);

  if (submitAfterCreate) {
    return submitChangeRequestWorkflow(created.id, validatedData.requestedByUserId || 'system');
  }

  return created;
}

// ── Status Updates ──

export async function updateStatus(id: number, body: { status: string; reviewedByUserId?: string; reviewComments?: string }) {
  const { status, reviewedByUserId } = body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status');
  }

  // When transitioning to 'submitted', run the level-aware workflow setup
  if (status === 'submitted') {
    return submitChangeRequestWorkflow(id, reviewedByUserId || 'system');
  }

  return crRepo.updateChangeRequest(id, {
    status: status as any,
    reviewedByUserId,
    reviewedAt: new Date()
  });
}

// ── Submit Workflow ──
// Classifies the target component, reads the approval workflow config,
// snapshots it on the CR, and creates the required approval step rows.

async function submitChangeRequestWorkflow(id: number, userId: string) {
  const cr = await crRepo.getChangeRequest(id);
  if (!cr) throw new NotFoundError('Change request not found');

  // Only allow submission from draft or returned status
  if (cr.status !== 'draft' && cr.status !== 'returned') {
    throw new ValidationError(`Cannot submit a change request with status '${cr.status}'. Only draft or returned CRs can be submitted.`);
  }

  let equipmentClassification: 'normal' | 'critical' | 'unknown' = 'unknown';
  let spareClassification: 'normal' | 'critical' | 'unknown' = 'unknown';
  let jobClassification: 'criticalEquipment' | 'critical' | 'normal' | 'unknown' = 'unknown';

  // Classify the target component
  if (cr.targetType === 'component' && cr.targetId) {
    const component = await crRepo.getComponent(cr.targetId);
    if (component) {
      const isCritical = (component as any).critical === true || (component as any).classItem === true;
      equipmentClassification = isCritical ? 'critical' : 'normal';
    }
  }

  // Classify the target spare using its own critical TEXT field
  if (cr.targetType === 'spare' && cr.targetId) {
    const spare = await crRepo.getSpare(cr.targetId);
    if (spare) {
      const isCritical = spare.critical === 'Critical' || spare.critical === 'Yes';
      spareClassification = isCritical ? 'critical' : 'normal';
    }
  }

  // Classify a job CR:
  //   Priority 1 — Critical Equipment Jobs: job's component has critical = true
  //   Priority 2 — Critical Jobs: job itself has criticality = 'Yes'
  //   Default    — Normal Jobs
  if (cr.targetType === 'job' && cr.targetId) {
    const job = await crRepo.getJob(cr.targetId);
    if (job) {
      let isOnCriticalEquipment = false;
      if (job.componentId) {
        const comp = await crRepo.getComponent(job.componentId);
        isOnCriticalEquipment = (comp as any)?.critical === true;
      }
      if (isOnCriticalEquipment) {
        jobClassification = 'criticalEquipment';
      } else if (job.criticality === 'Yes') {
        jobClassification = 'critical';
      } else {
        jobClassification = 'normal';
      }
    }
  }

  // Look up the approval workflow config for this CR category
  let level1Enabled = false;
  let level2Enabled = false;

  if (cr.targetType === 'spare' && spareClassification !== 'unknown') {
    const allConfigs = await crRepo.getApprovalWorkflowConfig();
    const variableName = spareClassification === 'critical' ? 'Critical Spares' : 'Normal Spares';
    const config = allConfigs.find(
      c => c.functionId === 'pms-spares-cr' && c.variableName === variableName && !c.isDeleted
    );
    if (config) {
      level1Enabled = config.level1Enabled;
      level2Enabled = config.level2Enabled;
    }
  } else if (cr.targetType === 'store') {
    // Stores have no classification split — one flat config row covers all store items
    const allConfigs = await crRepo.getApprovalWorkflowConfig();
    const config = allConfigs.find(
      c => c.functionId === 'pms-stores-cr' && c.variableName === 'Store Items' && !c.isDeleted
    );
    if (config) {
      level1Enabled = config.level1Enabled;
      level2Enabled = config.level2Enabled;
    }
  } else if (cr.targetType === 'job' && jobClassification !== 'unknown') {
    const allConfigs = await crRepo.getApprovalWorkflowConfig();
    const variableName =
      jobClassification === 'criticalEquipment' ? 'Critical Equipment Jobs'
      : jobClassification === 'critical'        ? 'Critical Jobs'
      :                                           'Normal Jobs';
    const config = allConfigs.find(
      c => c.functionId === 'pms-jobs-cr' && c.variableName === variableName && !c.isDeleted
    );
    if (config) {
      level1Enabled = config.level1Enabled;
      level2Enabled = config.level2Enabled;
    }
  } else if (equipmentClassification !== 'unknown') {
    const allConfigs = await crRepo.getApprovalWorkflowConfig();
    const variableName = equipmentClassification === 'normal' ? 'Normal Equipment' : 'Critical Equipment';
    const config = allConfigs.find(
      c => c.functionId === 'pms-components-cr' && c.variableName === variableName && !c.isDeleted
    );
    if (config) {
      level1Enabled = config.level1Enabled;
      level2Enabled = config.level2Enabled;
    }
  }

  // Build snapshot — each CR category records its classification key
  const snapshot = cr.targetType === 'spare'
    ? { level1Enabled, level2Enabled, spareClassification }
    : cr.targetType === 'store'
    ? { level1Enabled, level2Enabled, storeClassification: 'standard' as const }
    : cr.targetType === 'job'
    ? { level1Enabled, level2Enabled, jobClassification: jobClassification as 'criticalEquipment' | 'critical' | 'normal' }
    : { level1Enabled, level2Enabled, equipmentClassification };

  // Update CR to submitted with snapshot
  const updated = await crRepo.updateChangeRequest(id, {
    status: 'submitted',
    submittedAt: new Date(),
    requestedByUserId: userId,
    approvalWorkflowSnapshot: snapshot
  } as any);

  // Create approval step rows
  if (level1Enabled) {
    await crRepo.createChangeRequestApprovalStep({
      changeRequestId: id,
      changeRequestUuid: cr.cruuid,
      approvalLevel: 'Level 1',
      status: 'Pending',
    });
  }
  if (level2Enabled) {
    await crRepo.createChangeRequestApprovalStep({
      changeRequestId: id,
      changeRequestUuid: cr.cruuid,
      approvalLevel: 'Level 2',
      status: 'Pending',
    });
  }

  const classLabel = cr.targetType === 'spare' ? spareClassification
    : cr.targetType === 'store' ? 'standard'
    : cr.targetType === 'job' ? jobClassification
    : equipmentClassification;
  console.log(`[CR_WORKFLOW] CR ${id} (${cr.targetType}) submitted — classification: ${classLabel}, L1: ${level1Enabled}, L2: ${level2Enabled}`);
  return updated;
}

// ── Approve / Reject ──

export async function approveChangeRequest(id: number, body: { comment: string; reviewerId?: string; role?: string }) {
  const { comment, reviewerId, role } = body;

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

  const updated = await crRepo.approveChangeRequest(id, reviewerId || 'reviewer', comment, role);
  console.log(`[CR_SERVICE] Approval complete, status: ${updated.status}`);
  return updated;
}

export async function rejectChangeRequest(id: number, body: { comment: string; reviewerId?: string; role?: string }) {
  const { comment, reviewerId, role } = body;

  if (!comment) {
    throw new ValidationError('Comment is required for rejection');
  }

  console.log('Rejecting change request:', id, 'with comment:', comment);
  const updated = await crRepo.rejectChangeRequest(id, reviewerId || 'reviewer', comment, role);
  console.log('Successfully rejected request:', updated);
  return updated;
}

// ── Approval Steps ──

export async function getApprovalSteps(changeRequestId: number) {
  const cr = await crRepo.getChangeRequest(changeRequestId);
  if (!cr) throw new NotFoundError('Change request not found');
  return crRepo.getChangeRequestApprovalSteps(changeRequestId);
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
