import * as defectsRepo from '../repositories/defectsRepository';
import { insertDefectSchema, insertDefectActionSchema, insertDefectAttachmentSchema } from '@shared/schema';
import { generateDefectNumber } from '../../../utils/defectNumbering';
import { storage } from '../../../storage';
import {
  DEFECTS_EXTENSION_SCREEN, DEFECTS_REPEAT_EXTENSION_SCREEN, DEFECTS_VERIFICATION_SCREEN,
  DEFECT_CLASS_CRITICAL, DEFECT_CLASS_NORMAL, classifyDefect, deciderIdentity,
} from '../approvalCard';
import {
  activeWorkflowScoped, approvalActorCanDecide, approvalRequestsInScopes,
  isApprovalEngineAvailable, scopeFor,
} from '../../approvals/engineGateway';
import type { RequestRow, RequestSlotRow, StoredWorkflow } from '../../approval-engine';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { defects } from '@shared/schema';
import {
  apprvWorkflows, apprvWorkflowNodes, apprvNodeSlots,
  apprvRequests, apprvRequestSlots,
} from '../../approval-engine/db/schema';
import { getPostgresClient } from '../../../postgresClient';
import { getCurrentTenantContext } from '../../../utils/asyncLocalStorage';
import { resolveRoleApproverUserIds } from '../../approvals/approvalCard';

// ── Core Defects ──

export async function getDefects(filters: any) {
  return defectsRepo.getDefects(filters);
}

export async function getDefectsCount(filters: any) {
  return defectsRepo.getDefectsCount(filters);
}

export async function getDefectsCountSummary() {
  const activeCount = await defectsRepo.getDefectsCount({ statusView: 'active' });
  const resolvedCount = await defectsRepo.getDefectsCount({ statusView: 'resolved' });
  return { active: activeCount, resolved: resolvedCount };
}

export async function getRecurringDefectsCount() {
  const recurringDefects = await defectsRepo.getRecurringDefects({});
  return recurringDefects.length;
}

export async function getDefect(id: string) {
  return defectsRepo.getDefect(id);
}

export async function getDefectApprovalSettings() {
  const settings = await defectsRepo.getDefectApprovalSettings();
  if (!settings) {
    throw Object.assign(new Error('Defect approval settings row not found; run the generated migration'), { statusCode: 500 });
  }
  return settings;
}

export async function updateDefectApprovalSettings(
  values: { longExtensionDays: number; showRejectedClosuresOnReport: boolean },
  actorUserId?: string | null,
) {
  const previous = await getDefectApprovalSettings();
  const updated = await defectsRepo.upsertDefectApprovalSettings({
    ...values,
    updatedByUuid: actorUserId ?? null,
  });
  await defectsRepo.createAuditLog({
    userId: actorUserId || 'system',
    entityType: 'defect_approval_settings',
    entityId: updated.dasuuid,
    actionType: 'update',
    fieldName: 'approval_settings',
    oldValue: JSON.stringify({
      longExtensionDays: previous.longExtensionDays,
      showRejectedClosuresOnReport: previous.showRejectedClosuresOnReport,
    }),
    newValue: JSON.stringify(values),
    source: 'api',
    payload: { actor: actorUserId ?? null },
  });
  return updated;
}

export async function getDefectApprovalRouting(
  id: string,
  action: 'extension' | 'verification',
  newTargetDate: string | null,
  actorUserId?: string | null,
) {
  const { resolveDefectApprovalRouting } = await import('./defectsApprovalHooks');
  return resolveDefectApprovalRouting(id, action, newTargetDate, actorUserId, { auditFallback: false });
}

const DIAGNOSTIC_CLASSIFICATIONS = [DEFECT_CLASS_NORMAL, DEFECT_CLASS_CRITICAL] as const;
const DIAGNOSTIC_SCOPES = [
  DEFECTS_EXTENSION_SCREEN, DEFECTS_REPEAT_EXTENSION_SCREEN, DEFECTS_VERIFICATION_SCREEN,
] as const;
const diagnosticDb = () => getCurrentTenantContext()?.db ?? getPostgresClient().db;

/**
 * Bounded, read-only Defects approval health projection. The five base reads are
 * set-based; role membership is the only bounded cartesian operation (role ×
 * vessel), because the shared resolver is the server-authoritative membership
 * implementation.
 */
export async function getDefectApprovalDiagnostics() {
  const queryPlan = {
    fixedReads: 5,
    resolverQueriesPerPair: 3,
    description: 'Five bounded set-based reads plus strict role resolution for each distinct active-workflow role and vessel with a nondeleted defect.',
    formula: 'fixedReads + (distinctRoles × vesselsWithDefects × resolverQueriesPerPair)',
    conditionalReads: 'workflow nodes/slots reads are skipped when there are no active Defects workflows; pending requests and active slots always use one left-join read',
  };
  if (!isApprovalEngineAvailable()) {
    const workflowMatrix = DIAGNOSTIC_SCOPES.flatMap((scope) =>
      DIAGNOSTIC_CLASSIFICATIONS.map((classification) => ({
        scope, classification, configured: false,
        consequence: 'Approval Engine is unavailable; configuration could not be confirmed.',
      })));
    return {
      generatedAt: new Date().toISOString(),
      available: false,
      healthy: false,
      consequence: 'Approval Engine is unavailable on this instance; no engine diagnostics can be confirmed.',
      workflowMatrix,
      missingActiveWorkflows: [],
      roleCoverage: [],
      unresolvedApprovers: [],
      stalledRequests: [],
      orphanRequestedExtensions: [],
      summary: { workflowGaps: 0, unresolvedApprovers: 0, stalledRequests: 0, orphanRequestedExtensions: 0 },
      queryPlan: { ...queryPlan, resolverPairs: 0, expectedQueries: 0, currentExpectedQueries: 0 },
    };
  }

  const db = diagnosticDb();
  const workflows = await db.select({
    wfuuid: apprvWorkflows.wfuuid,
    screenId: apprvWorkflows.screenId,
    classification: apprvWorkflows.classification,
  }).from(apprvWorkflows).where(and(
    eq(apprvWorkflows.moduleId, 'defects'),
    inArray(apprvWorkflows.screenId, [...DIAGNOSTIC_SCOPES]),
    eq(apprvWorkflows.status, 'active'),
    eq(apprvWorkflows.isDeleted, false),
  ));
  const workflowIds = workflows.map((w) => w.wfuuid);
  const workflowNodes = workflowIds.length
    ? await db.select({ workflowWfuuid: apprvWorkflowNodes.workflowWfuuid, nodeKey: apprvWorkflowNodes.nodeKey })
      .from(apprvWorkflowNodes).where(and(inArray(apprvWorkflowNodes.workflowWfuuid, workflowIds), eq(apprvWorkflowNodes.type, 'approval-step')))
    : [];
  const workflowSlots = workflowIds.length
    ? await db.select({
      workflowWfuuid: apprvNodeSlots.workflowWfuuid,
      nodeKey: apprvNodeSlots.nodeKey,
      roleId: apprvNodeSlots.roleId,
      roleLabel: apprvNodeSlots.roleLabel,
    }).from(apprvNodeSlots).where(inArray(apprvNodeSlots.workflowWfuuid, workflowIds))
    : [];
  const defectRows: any[] = await db.select({
    duuid: defects.duuid, vesselId: defects.vesselId,
    status: defects.status, isDeleted: defects.isDeleted,
    targetDateExtensions: defects.targetDateExtensions,
  }).from(defects).where(or(eq(defects.isDeleted, false), isNull(defects.isDeleted)));
  const pendingWithSlots = await db.select({
    requuid: apprvRequests.requuid, subjectRef: apprvRequests.subjectRef,
    vesselId: apprvRequests.vesselId, submittedAt: apprvRequests.submittedAt,
    screenId: apprvRequests.screenId,
    slotRequuid: apprvRequestSlots.requuid, nodeKey: apprvRequestSlots.nodeKey,
    slotOrdinal: apprvRequestSlots.slotOrdinal, resolved: apprvRequestSlots.resolvedApproverIdsJson,
    slotStatus: apprvRequestSlots.status,
  }).from(apprvRequests).leftJoin(apprvRequestSlots, and(
    eq(apprvRequestSlots.requuid, apprvRequests.requuid),
    eq(apprvRequestSlots.status, 'active'),
  )).where(and(
    eq(apprvRequests.moduleId, 'defects'),
    inArray(apprvRequests.screenId, [...DIAGNOSTIC_SCOPES]),
    eq(apprvRequests.status, 'pending'),
  ));
  const pendingRequests = Array.from(new Map(pendingWithSlots.map((r) => [r.requuid, {
    requuid: r.requuid, subjectRef: r.subjectRef, vesselId: r.vesselId,
    submittedAt: r.submittedAt, screenId: r.screenId,
  }])).values());
  const activeSlots = pendingWithSlots.filter((r) => r.slotRequuid).map((r) => ({
    requuid: r.slotRequuid!, nodeKey: r.nodeKey, slotOrdinal: r.slotOrdinal,
    resolved: r.resolved, status: r.slotStatus,
  }));

  const vessels = Array.from(new Set(defectRows.map((d) => d.vesselId).filter(Boolean)));
  const roleMap = new Map<string, { roleId: string; roleLabel: string; workflowScopes: string[] }>();
  for (const slot of workflowSlots) {
    const workflow = workflows.find((w) => w.wfuuid === slot.workflowWfuuid);
    if (!workflow) continue;
    const existing = roleMap.get(slot.roleId) ?? {
      roleId: slot.roleId, roleLabel: slot.roleLabel, workflowScopes: [],
    };
    const scopeKey = `${workflow.screenId}:${workflow.classification}`;
    if (!existing.workflowScopes.includes(scopeKey)) existing.workflowScopes.push(scopeKey);
    roleMap.set(slot.roleId, existing);
  }
  const roleCoverage = [];
  for (const role of Array.from(roleMap.values())) {
    const zeroVessels: string[] = [];
    let resolvedPairs = 0;
    for (const vesselId of vessels) {
      const ids = await resolveRoleApproverUserIds(role.roleId, vesselId);
      if (ids.length === 0) zeroVessels.push(vesselId);
      else resolvedPairs++;
    }
    roleCoverage.push({
      ...role, vesselsChecked: vessels.length, resolvedVessels: resolvedPairs,
      zeroApproverVessels: zeroVessels,
      healthy: zeroVessels.length === 0,
      consequence: zeroVessels.length
        ? 'No approver resolves for one or more defect vessels; requests can stall until role assignment is fixed.'
        : null,
    });
  }

  const missingActiveWorkflows = DIAGNOSTIC_SCOPES.flatMap((screenId) =>
    DIAGNOSTIC_CLASSIFICATIONS.filter((classification) =>
      !workflows.some((w) => w.screenId === screenId && w.classification === classification))
      .map((classification) => ({
        screenId, classification,
        consequence: 'New requests in this scope/classification cannot enter an active approval chain.',
      })));
  const workflowMatrix = DIAGNOSTIC_SCOPES.flatMap((scope) =>
    DIAGNOSTIC_CLASSIFICATIONS.map((classification) => {
      const configured = workflows.some((w) => w.screenId === scope && w.classification === classification);
      return {
        scope, classification, configured,
        consequence: configured ? null : 'New requests in this scope/classification cannot enter an active approval chain.',
      };
    }));
  const defectById = new Map(defectRows.map((d) => [d.duuid, d]));
  const stalledRequests = pendingRequests.filter((r) =>
    activeSlots.filter((s) => s.requuid === r.requuid)
      .some((s) => !Array.isArray(s.resolved) || s.resolved.length === 0)
    && defectById.has(r.subjectRef))
    .map((r) => ({
      requestUuid: r.requuid, defectId: r.subjectRef, vesselId: r.vesselId ?? defectById.get(r.subjectRef)?.vesselId ?? null,
      screenId: r.screenId, submittedAt: r.submittedAt,
      daysPending: Math.max(0, Math.floor((Date.now() - new Date(r.submittedAt).getTime()) / 86_400_000)),
      consequence: 'The active approval step has no resolved approver; this request cannot advance until assignment is fixed.',
    }));
  const pendingExtensionIds = new Set(pendingRequests
    .filter((r) => r.screenId === DEFECTS_EXTENSION_SCREEN || r.screenId === DEFECTS_REPEAT_EXTENSION_SCREEN)
    .map((r) => r.subjectRef));
  const orphanRequestedExtensions = defectRows
    .filter((d) => d.status !== 'Closed' && d.status !== 'Resolved')
    .flatMap((d) => {
      const requested = (Array.isArray(d.targetDateExtensions) ? d.targetDateExtensions : [])
        .filter((e: any) => e?.status === 'Requested');
      const correspondingId = pendingExtensionIds.has(d.duuid) ? requested[0]?.id : null;
      return requested.filter((e: any) => e?.id !== correspondingId)
      .map((e: any) => ({
        defectId: d.duuid, vesselId: d.vesselId, entryId: e.id ?? null,
        requestedAt: e.requestedAt ?? null, newTargetDate: e.newTargetDate ?? null,
        consequence: 'Requested extension has no pending engine request; it does not block closeout and needs review.',
      }));
    });
  const unresolvedApprovers = roleCoverage.flatMap((role) =>
    role.zeroApproverVessels.map((vesselId) => ({
      roleId: role.roleId, roleLabel: role.roleLabel, vesselId,
      workflowScopes: role.workflowScopes,
      consequence: role.consequence,
    })));
  const resolverPairs = roleMap.size * vessels.length;
  const expectedQueries = queryPlan.fixedReads + resolverPairs * queryPlan.resolverQueriesPerPair;
  return {
    generatedAt: new Date().toISOString(),
    available: true, healthy: missingActiveWorkflows.length === 0 && roleCoverage.every((r) => r.healthy) &&
      stalledRequests.length === 0 && orphanRequestedExtensions.length === 0,
    consequence: missingActiveWorkflows.length || roleCoverage.some((r) => !r.healthy) || stalledRequests.length || orphanRequestedExtensions.length
      ? 'One or more approval configuration or data integrity issues require administrator review.'
      : null,
    workflowMatrix, missingActiveWorkflows, roleCoverage, unresolvedApprovers,
    stalledRequests, orphanRequestedExtensions,
    summary: {
      workflowGaps: missingActiveWorkflows.length,
      unresolvedApprovers: unresolvedApprovers.length,
      stalledRequests: stalledRequests.length,
      orphanRequestedExtensions: orphanRequestedExtensions.length,
    },
    queryPlan: { ...queryPlan, resolverPairs, expectedQueries, currentExpectedQueries: expectedQueries },
  };
}

export type DefectApprovalChainAction = 'extension' | 'verification';

type DefectApprovalChain = {
  hasActiveWorkflow: boolean;
  scope: string;
  classification: string;
  requestStatus: 'pending' | 'approved' | 'returned' | 'none';
  requestUuid: string | null;
  currentStepKey: string | null;
  steps: Array<{
    nodeKey: string;
    label: string;
    ordinal: number;
    quorumRule: string;
    status: 'pending' | 'active' | 'approved' | 'rejected' | 'skipped';
    slots: Array<{
      slotId: string;
      roleLabel: string;
      status: 'pending' | 'active' | 'approved' | 'rejected' | 'skipped';
      decidedByName: string | null;
      decidedByPosition: string | null;
      decidedAt: string | null;
      remarks: string | null;
    }>;
  }>;
  currentUserCanDecide: boolean;
  currentUserSlotId: string | null;
};

const requestDateForExtension = (defect: any): string | null => {
  const entries = Array.isArray(defect.targetDateExtensions) ? defect.targetDateExtensions : [];
  const requested = entries.find((entry: any) => entry?.status === 'Requested');
  return requested?.newTargetDate ?? null;
};

const extensionScopeForDefect = (defect: any) => {
  const entries = Array.isArray(defect.targetDateExtensions) ? defect.targetDateExtensions : [];
  return entries.some((entry: any) => entry?.status === 'Approved')
    ? scopeFor('defects', DEFECTS_REPEAT_EXTENSION_SCREEN)
    : scopeFor('defects', DEFECTS_EXTENSION_SCREEN);
};

const slotViewStatus = (status: RequestSlotRow['status'] | undefined): DefectApprovalChain['steps'][number]['slots'][number]['status'] => {
  if (status === 'superseded') return 'skipped';
  return status ?? 'pending';
};

/**
 * Read-only approval chain projection for Defects. Existing requests are selected from the
 * engine's persisted request history first; only a subject with no request is routed through
 * the same Stage 1 classification/scope resolver used by submission.
 */
export async function getDefectApprovalChain(
  id: string,
  action: DefectApprovalChainAction,
  actorUserId?: string | null,
  actorRole?: string | null,
): Promise<DefectApprovalChain> {
  const defect: any = await defectsRepo.getDefect(id);
  if (!defect) throw Object.assign(new Error(`Defect ${id} not found`), { statusCode: 404 });
  if (!isApprovalEngineAvailable()) {
    throw Object.assign(new Error('Approval status is unavailable on this instance'), {
      statusCode: 503,
      code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE',
    });
  }

  const candidateScopes = action === 'verification'
    ? [scopeFor('defects', DEFECTS_VERIFICATION_SCREEN)]
    : [
      scopeFor('defects', DEFECTS_EXTENSION_SCREEN),
      scopeFor('defects', DEFECTS_REPEAT_EXTENSION_SCREEN),
    ];
  const requests = await approvalRequestsInScopes(candidateScopes, defect.duuid);
  const sortedRequests = requests.slice().sort((a, b) =>
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  // A pending request always wins over terminal history, even if a clock or scope causes
  // submittedAt ordering to be surprising.
  const request = sortedRequests.find((row) => row.status === 'pending') ?? sortedRequests[0] ?? null;

  let classification: string;
  let scope = candidateScopes[0];
  let workflow: Pick<StoredWorkflow, 'nodes'> | null = null;
  if (request) {
    // The request snapshot is immutable and is authoritative for an existing chain.
    classification = request.classification;
    scope = request.scope;
    workflow = request.snapshot;
  } else {
    const { resolveDefectApprovalRouting } = await import('./defectsApprovalHooks');
    const extensionDate = action === 'extension' ? requestDateForExtension(defect) : null;
    if (action === 'verification' || extensionDate) {
      const routing = await resolveDefectApprovalRouting(id, action, extensionDate, actorUserId, { auditFallback: false });
      classification = routing.classification;
      scope = routing.scope;
    } else {
      // There is no extension request to supply a new date yet. Keep Stage 1's
      // classification predicate authoritative, while selecting its initial/repeat scope.
      classification = await classifyDefect(defect.duuid);
      scope = extensionScopeForDefect(defect);
    }
    workflow = await activeWorkflowScoped(scope, classification);
  }

  const activeRequest = request?.status === 'pending' ? request : null;
  const actorDecision = activeRequest
    ? approvalActorCanDecide(activeRequest, actorUserId, actorRole)
    : { canDecide: false, slotId: null };
  const requestSlots = request?.slots ?? [];
  const nodes = (workflow?.nodes ?? [])
    .filter((node) => node.type === 'approval-step')
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal);
  const currentOrdinal = request?.currentNodeKey == null
    ? null
    : nodes.find((node) => node.key === request.currentNodeKey)?.ordinal ?? null;

  const decidedByIds = Array.from(new Set(requestSlots.map((slot) => slot.decidedBy).filter((id): id is string => !!id)));
  const identities = new Map<string, { name: string; roleLabel: string }>();
  await Promise.all(decidedByIds.map(async (userUuid) => identities.set(userUuid, await deciderIdentity(userUuid))));

  const steps = nodes.map((node) => {
    const nodeSlots = requestSlots.filter((slot) => slot.nodeKey === node.key);
    let status: DefectApprovalChain['steps'][number]['status'] = 'pending';
    if (request) {
      if (request.status === 'pending') {
        if (request.currentNodeKey === node.key || nodeSlots.some((slot) => slot.status === 'active')) {
          status = 'active';
        } else if (nodeSlots.some((slot) => slot.status === 'approved') ||
                   (currentOrdinal !== null && node.ordinal < currentOrdinal)) {
          status = 'approved';
        }
      } else {
        if (nodeSlots.some((slot) => slot.status === 'rejected')) status = 'rejected';
        else if (nodeSlots.some((slot) => slot.status === 'approved')) status = 'approved';
        else status = 'skipped';
      }
    }
    const slots = (node.slots ?? []).map((slot, slotOrdinal) => {
      const persisted = nodeSlots.find((candidate) => candidate.slotOrdinal === slotOrdinal);
      const identity = persisted?.decidedBy ? identities.get(persisted.decidedBy) : undefined;
      return {
        slotId: `${node.key}:${slotOrdinal}`,
        roleLabel: persisted?.roleLabel ?? slot.roleLabel,
        status: slotViewStatus(persisted?.status),
        decidedByName: identity?.name ?? null,
        decidedByPosition: identity?.roleLabel ?? null,
        decidedAt: persisted?.decidedAt ?? null,
        remarks: persisted?.remarks ?? null,
      };
    });
    return {
      nodeKey: node.key,
      label: node.label || node.key,
      ordinal: node.ordinal,
      quorumRule: node.quorum?.rule ?? 'all',
      status,
      slots,
    };
  });

  return {
    hasActiveWorkflow: !!workflow || !!request,
    scope: scope.screenId,
    classification,
    requestStatus: request?.status ?? 'none',
    requestUuid: request?.requuid ?? null,
    currentStepKey: request?.currentNodeKey ?? null,
    steps,
    currentUserCanDecide: actorDecision.canDecide,
    currentUserSlotId: actorDecision.slotId,
  };
}

export async function hasActiveUserVesselAssignment(userUuid: string, vesselId: string) {
  return defectsRepo.hasActiveUserVesselAssignment(userUuid, vesselId);
}

export async function createDefect(body: any, _actor?: import('./defectsApprovalHooks').DefectActor) {
  const validatedData = insertDefectSchema.parse(body);
  const { assertDefectCreationApprovalStateAllowed } = await import('./defectsApprovalHooks');
  assertDefectCreationApprovalStateAllowed(validatedData);

  // Generate proper defect ID using naming convention
  const vesselId = validatedData.vesselId || 'UNKNOWN';
  const generatedId = await generateDefectNumber(storage, vesselId);

  // Create defect with generated ID
  const defectWithId = {
    ...validatedData,
    id: generatedId
  };

  console.log(`[DefectRoutes] Creating defect with generated ID: ${generatedId} for vessel: ${vesselId}`);

  return defectsRepo.createDefect(defectWithId);
}

export async function updateDefect(id: string, body: any, actor?: import('./defectsApprovalHooks').DefectActor) {
  // Approval gate (B2a, 03-Sep-2026): the generic PATCH is Defects' ONLY live write path,
  // so extension/verification approval writes are detected and routed engine-first HERE,
  // and Part C1 closeout writes enforce the Master-only rule. With no chain configured the
  // gate passes everything through byte-identically (sacred fallback) — see
  // defectsApprovalHooks.ts for the one product-approved ship-side deviation.
  const current = await defectsRepo.getDefect(id);
  if (!current) {
    throw Object.assign(new Error(`Defect ${id} not found`), { statusCode: 404 });
  }
  const { gateDefectUpdate, afterDefectUpdate } = await import('./defectsApprovalHooks');
  const gated = await gateDefectUpdate(current, body, actor ?? {});
  const partialDefectSchema = insertDefectSchema.partial();
  const validatedData = partialDefectSchema.parse(gated.body);
  const updated = await defectsRepo.updateDefect(id, validatedData);
  const approvalSubmissions: Array<import('./defectsApprovalHooks').ExtensionSubmissionOutcome> = [];
  const recordSubmissionFailure = async (payload: any) => {
    try {
      await defectsRepo.createAuditLog({
        userId: actor?.userUuid || 'system',
        entityType: 'defect_extension_approval',
        entityId: id,
        actionType: 'submission_failed',
        fieldName: 'targetDateExtensions',
        oldValue: null,
        newValue: null,
        source: 'approval-engine',
        payload,
      });
    } catch (auditError) {
      // Audit persistence is best effort after the defect has been saved.
      console.error('[approvals] defects submission-failure audit write failed:', auditError);
    }
  };
  for (const task of gated.postSave) {
    try {
      const outcome = await task();
      approvalSubmissions.push(outcome);
      if (outcome.status === 'error') {
        await recordSubmissionFailure({
          status: outcome.status,
          error: outcome.error ?? 'Approval engine submission failed',
        });
      }
    } catch (e: any) {
      // The extension was intentionally persisted before this task. Surface a
      // structured failure rather than converting a successful save into a 500.
      console.error('[approvals] defects post-save submit failed (legacy continues):', e);
      const outcome = {
        status: 'error' as const,
        error: 'The extension was saved, but approval submission failed. Contact an administrator.',
      };
      approvalSubmissions.push(outcome);
      await recordSubmissionFailure({ ...outcome, internalError: String(e?.message ?? e) });
    }
  }
  try { await afterDefectUpdate(current, updated, actor ?? {}); } catch (e) {
    console.error('[approvals] defects post-update hook failed (non-fatal):', e);
  }
  return { defect: updated, approvalSubmissions };
}

export async function deleteDefect(id: string) {
  return defectsRepo.deleteDefect(id);
}

// ── Defect Actions ──

export async function getDefectActions(defectId: string) {
  return defectsRepo.getDefectActions(defectId);
}

export async function createDefectAction(defectId: string, body: any) {
  const actionData = {
    ...body,
    defectId
  };
  const validatedData = insertDefectActionSchema.parse(actionData);
  return defectsRepo.createDefectAction(validatedData);
}

export async function updateDefectAction(actionId: number, body: any) {
  const partialActionSchema = insertDefectActionSchema.partial();
  const validatedData = partialActionSchema.parse(body);
  return defectsRepo.updateDefectAction(actionId, validatedData);
}

export async function deleteDefectAction(actionId: number) {
  return defectsRepo.deleteDefectAction(actionId);
}

// ── Defect Attachments ──

export async function getDefectAttachments(defectId: string) {
  return defectsRepo.getDefectAttachments(defectId);
}

export async function createDefectAttachment(defectId: string, body: any) {
  const attachmentData = {
    ...body,
    defectId
  };
  const validatedData = insertDefectAttachmentSchema.parse(attachmentData);
  return defectsRepo.createDefectAttachment(validatedData);
}

export async function deleteDefectAttachment(attachmentId: number) {
  return defectsRepo.deleteDefectAttachment(attachmentId);
}

// ── Defect Workflow (Notes, Linking, Closure) ──

export async function addDefectNote(defectId: string, body: any) {
  const { noteText, attachments, createdBy } = body;

  if (!noteText || noteText.length < 10) {
    throw Object.assign(new Error("Note text must be at least 10 characters"), { statusCode: 400 });
  }

  const note = {
    noteId: Date.now().toString(),
    noteText,
    attachments: attachments || [],
    createdBy: createdBy || 'Anonymous',
    createdOn: new Date().toISOString()
  };

  return defectsRepo.addDefectNote(defectId, note);
}

export async function linkDefects(defectId: string, body: any) {
  const { linkedDefects } = body;

  if (!linkedDefects || !Array.isArray(linkedDefects) || linkedDefects.length === 0) {
    throw Object.assign(new Error("linkedDefects must be a non-empty array"), { statusCode: 400 });
  }

  return defectsRepo.linkDefects(defectId, linkedDefects);
}

export async function closeDefect(defectId: string, body: any, actor?: import('./defectsApprovalHooks').DefectActor) {
  // Master-only closure rule (03-Sep-2026). This route has no live UI caller (Phase A:
  // DefectsActive/DefectsLog are not rendered) but stays HTTP-reachable — an ungated
  // side door around the PATCH gate is not acceptable, so the same rule applies here.
  const current = await defectsRepo.getDefect(defectId);
  if (!current) throw Object.assign(new Error(`Defect ${defectId} not found`), { statusCode: 404 });
  const { assertDefectCloseoutAllowed } = await import('./defectsApprovalHooks');
  await assertDefectCloseoutAllowed(current, actor ?? {});
  const { closedBy, closureComment, closureFiles, actionTakenRequested, targetCloseDate, dateCompleted } = body;

  // Validate all required fields
  if (!closureComment || closureComment.trim().length === 0) {
    throw Object.assign(new Error("Closure comment is required"), { statusCode: 400 });
  }

  if (!actionTakenRequested || actionTakenRequested.trim().length === 0) {
    throw Object.assign(new Error("Action taken is required to close the defect"), { statusCode: 400 });
  }

  if (!targetCloseDate) {
    throw Object.assign(new Error("Target date is required"), { statusCode: 400 });
  }

  if (!dateCompleted) {
    throw Object.assign(new Error("Completion date is required"), { statusCode: 400 });
  }

  return defectsRepo.closeDefect(defectId, {
    closedBy: closedBy || 'System',
    closureComment,
    closureFiles: closureFiles || []
  });
}

// ── Defect Reports ──

export async function generateReport(reportKey: string, filters: any) {
  // Get defects based on filters
  const defects = await defectsRepo.getDefects(filters);

  // Generate report based on report key
  let reportData: any = {
    title: '',
    generatedAt: new Date().toISOString(),
    filters,
    data: []
  };

  switch(reportKey) {
    case 'status-summary':
      reportData.title = 'Defects Status Summary';
      // Group defects by status
      const statusGroups = defects.reduce((acc: any, defect) => {
        if (!acc[defect.status]) {
          acc[defect.status] = { count: 0, defects: [] };
        }
        acc[defect.status].count++;
        acc[defect.status].defects.push(defect);
        return acc;
      }, {});
      reportData.data = Object.entries(statusGroups).map(([status, data]: [string, any]) => ({
        status,
        count: data.count,
        percentage: ((data.count / defects.length) * 100).toFixed(1) + '%'
      }));
      break;

    case 'overdue':
      reportData.title = 'Overdue Defects';
      const today = new Date().toISOString().split('T')[0];
      reportData.data = defects.filter((d: any) =>
        d.status === 'Open' &&
        d.targetCloseDate &&
        new Date(d.targetCloseDate.split('-').reverse().join('-')) < new Date(today)
      );
      break;

    case 'critical':
      reportData.title = 'Critical Defects';
      reportData.data = defects.filter((d: any) => d.critical || d.is_coc);
      break;

    case 'by-vessel':
      reportData.title = 'Defects by Vessel';
      const vesselGroups = defects.reduce((acc: any, defect) => {
        if (!acc[defect.vesselName]) {
          acc[defect.vesselName] = { count: 0, open: 0, closed: 0 };
        }
        acc[defect.vesselName].count++;
        if (defect.status === 'Open') {
          acc[defect.vesselName].open++;
        } else if (defect.status === 'Closed') {
          acc[defect.vesselName].closed++;
        }
        return acc;
      }, {});
      reportData.data = Object.entries(vesselGroups).map(([vessel, stats]: [string, any]) => ({
        vessel,
        total: stats.count,
        open: stats.open,
        closed: stats.closed
      }));
      break;

    case 'by-equipment':
      reportData.title = 'Defects by Equipment';
      const equipmentGroups = defects.reduce((acc: any, defect) => {
        const equipment = defect.equipmentCategory || 'Not Specified';
        if (!acc[equipment]) {
          acc[equipment] = { count: 0, defects: [] };
        }
        acc[equipment].count++;
        acc[equipment].defects.push(defect);
        return acc;
      }, {});
      reportData.data = Object.entries(equipmentGroups).map(([equipment, data]: [string, any]) => ({
        equipment,
        count: data.count,
        percentage: ((data.count / defects.length) * 100).toFixed(1) + '%'
      }));
      break;

    case 'monthly-trend':
      reportData.title = 'Monthly Trend';
      // Group by month
      const monthGroups = defects.reduce((acc: any, defect) => {
        const dateStr = defect.issueDate; // DD-MM-YYYY
        if (!dateStr) return acc;
        const [day, month, year] = dateStr.split('-');
        const monthKey = `${year}-${month}`;
        if (!acc[monthKey]) {
          acc[monthKey] = { created: 0, closed: 0 };
        }
        acc[monthKey].created++;
        if (defect.status === 'Closed' && defect.dateCompleted) {
          const [cDay, cMonth, cYear] = defect.dateCompleted.split('-');
          const closedMonthKey = `${cYear}-${cMonth}`;
          if (!acc[closedMonthKey]) {
            acc[closedMonthKey] = { created: 0, closed: 0 };
          }
          acc[closedMonthKey].closed++;
        }
        return acc;
      }, {});
      reportData.data = Object.entries(monthGroups).map(([month, stats]: [string, any]) => ({
        month,
        created: stats.created,
        closed: stats.closed,
        net: stats.created - stats.closed
      })).sort((a, b) => a.month.localeCompare(b.month));
      break;

    default:
      reportData.title = 'Defects Report';
      reportData.data = defects;
  }

  return reportData;
}

// ── Recurring Defects ──

export async function getRecurringDefectsShortcut(filters: any) {
  return defectsRepo.getRecurringDefects(filters);
}

export async function getRecurringDefectsWithAutoCalc(filters: any) {
  // Check if ANY recurring defects exist at all (without filters)
  const allRecurringDefects = await defectsRepo.getRecurringDefects();

  // If no recurring defects have been calculated yet, calculate them for all time windows
  if (allRecurringDefects.length === 0) {
    // Get all unique equipment keys from defects
    const allDefects = await defectsRepo.getDefects({ includeClosedDefects: true });
    const equipmentKeys = new Set<string>();

    for (const defect of allDefects) {
      if ((defect as any).equipment_key) {
        equipmentKeys.add((defect as any).equipment_key);
      }
    }

    // Calculate recurring defects for multiple time windows
    const timeWindows = [6, 12, 24, 36, 48, 60]; // 6 months to 5 years

    // Use Array.from() to iterate over Set
    for (const equipmentKey of Array.from(equipmentKeys)) {
      for (const windowMonths of timeWindows) {
        await defectsRepo.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths);
      }
    }
  }

  // Now fetch the recurring defects with the requested filters
  return defectsRepo.getRecurringDefects(filters);
}

export async function getRecurringDefect(id: number) {
  return defectsRepo.getRecurringDefect(id);
}

export async function getDefectsForRecurring(recurringId: number) {
  return defectsRepo.getDefectsForRecurring(recurringId);
}

export async function recalculateRecurringDefects(equipmentKey: string, windowMonths?: number) {
  if (!equipmentKey) {
    throw Object.assign(new Error("equipmentKey is required"), { statusCode: 400 });
  }
  return defectsRepo.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths || 12);
}
