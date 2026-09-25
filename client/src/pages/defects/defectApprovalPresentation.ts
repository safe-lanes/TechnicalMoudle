export type DefectApprovalAction = "extension" | "verification";

export type ExtensionHistoryEntry = {
  id: string;
  status?: string | null;
  requestedAt?: string | null;
};

export function orderExtensionHistory<T extends ExtensionHistoryEntry>(entries: T[]): T[] {
  const dated = entries.map((entry) => ({
    entry,
    requestedAt: Date.parse(String(entry.requestedAt ?? "")),
  }));
  const allDatesAreUsable = dated.every(({ requestedAt }) => Number.isFinite(requestedAt))
    && new Set(dated.map(({ requestedAt }) => requestedAt)).size === dated.length;
  if (!allDatesAreUsable) return [...entries];
  return dated.sort((a, b) => a.requestedAt - b.requestedAt).map(({ entry }) => entry);
}

export function formatDecidedSlotRemark(status?: string | null, remarks?: string | null): string {
  return ["approved", "rejected"].includes(String(status ?? "").toLowerCase()) && remarks?.trim()
    ? remarks.trim()
    : "";
}

export function formatInlineApprovalSlotRemark(status?: string | null, remarks?: string | null): string {
  return String(status ?? "").toLowerCase() === "rejected"
    ? ""
    : formatDecidedSlotRemark(status, remarks);
}

export function formatRejectionHeading(
  stepIndex: number | null,
  stepCount: number,
  attribution?: string | null,
): string {
  const step = stepIndex !== null && stepCount > 1 ? ` at Step ${stepIndex + 1}` : "";
  return `Rejected${step}${attribution ? ` by ${attribution}` : ""}`;
}

const UTC_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Defects compliance timestamp display. Date-only values must remain date-only. */
export function formatMaritimeUtcDateTime(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = UTC_MONTHS[parsed.getUTCMonth()];
  const year = parsed.getUTCFullYear();
  const hours = String(parsed.getUTCHours()).padStart(2, "0");
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}${minutes} Z`;
}

export function formatDefectAuditTimestamp(value: string, kind: "decision" | "record"): string {
  if (kind === "decision") return formatMaritimeUtcDateTime(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function extensionEntryPermissions(entry: ExtensionHistoryEntry, index: number, total: number, canEdit: boolean) {
  const current = index === total - 1;
  const terminal = ["approved", "rejected", "returned"].includes(String(entry.status ?? "").toLowerCase());
  return {
    current,
    terminal,
    canEdit: Boolean(canEdit && current && !terminal),
    canDecide: Boolean(current && !terminal && String(entry.status ?? "").toLowerCase() === "requested"),
  };
}

export function projectExtensionCardPresentation(input: {
  index: number;
  total: number;
  current: boolean;
  status?: string | null;
  reasonForExtension?: string | null;
}) {
  const normalizedStatus = String(input.status || "Requested").toUpperCase();
  return {
    title: input.total === 1
      ? `Extension — ${normalizedStatus}`
      : `Extension ${input.index + 1} of ${input.total} — ${normalizedStatus}`,
    expanded: input.current || input.total === 1,
    readOnly: ["APPROVED", "REJECTED", "RETURNED"].includes(normalizedStatus),
    reasonForExtension: input.reasonForExtension || "Not recorded",
  };
}

export function projectExtensionHistory<T extends ExtensionHistoryEntry>(
  entries: T[],
  chainMap: Record<string, unknown> | undefined,
  canEdit: boolean,
) {
  const ordered = orderExtensionHistory(entries);
  const hasChainMap = chainMap !== undefined;
  return ordered.map((entry, index) => ({
    entry,
    label: `Extension ${index + 1} of ${ordered.length} — ${String(entry.status ?? "Requested").toUpperCase()}`,
    expanded: index === ordered.length - 1,
    chain: hasChainMap ? chainMap[entry.id] : undefined,
    chainId: hasChainMap ? (chainMap[entry.id] as { requestUuid?: string } | undefined)?.requestUuid ?? null : null,
    attribution: {
      approvalDate: (entry as T & { approvalDate?: string }).approvalDate ?? "",
      electronicConfirmation: (entry as T & { electronicConfirmation?: string }).electronicConfirmation ?? "",
      intendedApprover: (entry as T & { submitForApprovalToName?: string }).submitForApprovalToName ?? "",
      approverComments: (entry as T & { approverComments?: string }).approverComments ?? "",
    },
    permissions: extensionEntryPermissions(entry, index, ordered.length, canEdit),
  }));
}

export type ApprovalPreviewStep = {
  label: string;
  roles: string[];
};

export type DefectApprovalRoutingPreview = {
  scope: string;
  classification: string;
  activeWorkflowExists: boolean;
  fellBackFromRepeatScope: boolean;
  factors?: {
    extensionDays?: number | null;
    longExtensionThreshold?: number | null;
    exceedsThreshold?: boolean;
  };
};

export type DefectExtensionUiState =
  | "no-request"
  | "draft-preview"
  | "requester-pending"
  | "approver-pending"
  | "approved"
  | "rejected";

export function resolveEffectiveExtensionRequestStatus(
  localStatus?: string | null,
  chainStatus?: string | null,
): string | null {
  const normalizedChain = chainStatus ? chainStatus.toLowerCase() : null;
  if (normalizedChain && ["approved", "rejected", "returned"].includes(normalizedChain)) {
    return normalizedChain;
  }
  if (localStatus?.toLowerCase() === "requested") return "pending";
  return normalizedChain ?? localStatus?.toLowerCase() ?? null;
}

export function resolveDefectExtensionUi(input: {
  formOpen: boolean;
  hasStoredExtension: boolean;
  requestStatus?: string | null;
  currentUserCanDecide?: boolean;
  canEdit: boolean;
}): {
  state: DefectExtensionUiState;
  showContainer: boolean;
  fieldsReadOnly: boolean;
  showSubmit: boolean;
} {
  const status = String(input.requestStatus ?? "pending").toLowerCase();
  const isTerminal = status === "approved" || status === "rejected" || status === "returned";
  if (input.formOpen && (!input.hasStoredExtension || isTerminal)) {
    return {
      state: "draft-preview",
      showContainer: true,
      fieldsReadOnly: !input.canEdit,
      showSubmit: input.canEdit,
    };
  }
  if (!input.hasStoredExtension) {
    if (!input.formOpen) {
      return { state: "no-request", showContainer: false, fieldsReadOnly: true, showSubmit: false };
    }
    return { state: "no-request", showContainer: false, fieldsReadOnly: true, showSubmit: false };
  }
  if (status === "approved") {
    return { state: "approved", showContainer: true, fieldsReadOnly: true, showSubmit: false };
  }
  if (status === "rejected" || status === "returned") {
    return { state: "rejected", showContainer: true, fieldsReadOnly: true, showSubmit: false };
  }
  return {
    state: input.currentUserCanDecide ? "approver-pending" : "requester-pending",
    showContainer: true,
    fieldsReadOnly: true,
    showSubmit: false,
  };
}

export type DefectApprovalPresentation =
  | { state: "idle"; showDecisionControls: false }
  | { state: "loading"; showDecisionControls: false }
  | { state: "ship-unavailable"; message: "Approval is handled ashore. This request will be reviewed after the next sync."; showDecisionControls: false }
  | { state: "error"; message: "Could not load approval status. Retry."; showDecisionControls: false }
  | { state: "no-workflow"; showDecisionControls: false }
  | { state: "loaded"; showDecisionControls: boolean };

type ApprovalQueryState = {
  isLoading: boolean;
  error: unknown;
  data?: {
    hasActiveWorkflow: boolean;
    requestStatus?: string | null;
    steps?: unknown[];
    currentUserCanDecide: boolean;
    requestUuid?: string | null;
  };
};

/**
 * Keep fetch failure separate from an absent workflow. Both Defect sections use this
 * projection, so neither can accidentally expose decision controls before a chain loads.
 */
export function resolveDefectApprovalPresentation(
  approval: ApprovalQueryState,
  canEdit: boolean,
): DefectApprovalPresentation {
  if (approval.isLoading) return { state: "loading", showDecisionControls: false };
  if (approval.error) {
    if (
      typeof approval.error === "object" &&
      approval.error !== null &&
      "code" in approval.error &&
      approval.error.code === "APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE" &&
      "status" in approval.error &&
      approval.error.status === 503
    ) {
      return {
        state: "ship-unavailable",
        message: "Approval is handled ashore. This request will be reviewed after the next sync.",
        showDecisionControls: false,
      };
    }
    return {
      state: "error",
      message: "Could not load approval status. Retry.",
      showDecisionControls: false,
    };
  }
  if (!approval.data) return { state: "idle", showDecisionControls: false };

  const chain = approval.data;
  const isRejected = ["rejected", "returned"].includes(
    String(chain?.requestStatus).toLowerCase(),
  );
  if (!chain?.hasActiveWorkflow && !chain?.steps?.length && !isRejected) {
    return { state: "no-workflow", showDecisionControls: false };
  }

  return {
    state: "loaded",
    showDecisionControls: Boolean(
      canEdit &&
      chain?.currentUserCanDecide &&
      chain?.requestUuid &&
      String(chain.requestStatus).toLowerCase() === "pending",
    ),
  };
}

export function hasPersistedApprovalRequest(
  chain: { requestUuid?: string | null } | null | undefined,
): boolean {
  return Boolean(chain?.requestUuid);
}

/** A requested B5 entry is governed only when the engine has persisted a request. */
export function hasPendingExtensionApproval(
  chain: { requestUuid?: string | null; requestStatus?: string | null } | null | undefined,
): boolean {
  return Boolean(
    chain?.requestUuid &&
    String(chain.requestStatus ?? "").toLowerCase() === "pending",
  );
}

export function hasPendingExtensionForEntries(
  entries: Array<{ status?: string | null }> | null | undefined,
  chain: { requestUuid?: string | null; requestStatus?: string | null } | null | undefined,
): boolean {
  return hasPendingExtensionApproval(chain) &&
    (entries ?? []).some((entry) => String(entry.status ?? "").toLowerCase() === "requested");
}

/** Stored Requested entries without a persisted request are visible orphan warnings,
 * not approval blocks. */
export function isOrphanedRequestedExtension(
  extension: { status?: string | null } | null | undefined,
  chain: { requestUuid?: string | null } | null | undefined,
): boolean {
  return String(extension?.status ?? "").toLowerCase() === "requested" &&
    !hasPersistedApprovalRequest(chain);
}

export function isOrphanedRequestedExtensionAt(
  entries: Array<{ status?: string | null }> | null | undefined,
  index: number,
  chain: { requestUuid?: string | null; requestStatus?: string | null } | null | undefined,
): boolean {
  if (String(entries?.[index]?.status ?? "").toLowerCase() !== "requested") return false;
  const firstRequested = (entries ?? []).findIndex((entry) => String(entry.status ?? "").toLowerCase() === "requested");
  return !hasPendingExtensionApproval(chain) || index !== firstRequested;
}

export function isC1CloseoutComplete(values: {
  confirmCompleted?: boolean | null;
  dateCompleted?: string | null;
  closedByName?: string | null;
  closedByRank?: string | null;
}): boolean {
  return Boolean(
    values.confirmCompleted &&
    values.dateCompleted?.trim() &&
    values.closedByName?.trim() &&
    values.closedByRank?.trim(),
  );
}

export function approvalPreviewMessage(
  routing: DefectApprovalRoutingPreview,
  steps: ApprovalPreviewStep[],
): string {
  if (!routing.activeWorkflowExists || steps.length === 0) {
    return `No approval workflow is configured for ${routing.classification}. Contact your administrator.`;
  }
  const stepList = steps.map((step, index) => {
    const roles = step.roles.length > 0 ? step.roles.join(" / ") : step.label;
    return `Step ${index + 1} - ${roles}`;
  }).join(", ");
  const approvalCount = `${steps.length} approval${steps.length === 1 ? "" : "s"}`;
  if (routing.factors?.exceedsThreshold) {
    const threshold = routing.factors.longExtensionThreshold ?? 90;
    return `This extension exceeds ${threshold} days and will require ${approvalCount}: ${stepList}.`;
  }
  return `This request will require ${approvalCount}: ${stepList}.`;
}

export function resolveVerificationDisplay(
  chain: {
    requestUuid?: string | null;
    requestStatus?: string | null;
  } | null | undefined,
  defect: {
    verified?: boolean | null;
    dateVerified?: string | null;
    verifiedDate?: string | null;
    verifiedByName?: string | null;
    verifiedByOfficePosition?: string | null;
  } | null | undefined,
) {
  if (!chain) {
    return { date: "", name: "", position: "" };
  }
  const hasEngineRequest = Boolean(chain.requestUuid);
  if (hasEngineRequest && String(chain.requestStatus ?? "").toLowerCase() !== "approved") {
    return { date: "", name: "", position: "" };
  }
  const isLegacyVerification = !hasEngineRequest && defect?.verified === true;
  if (!hasEngineRequest && !isLegacyVerification) return { date: "", name: "", position: "" };
  return {
    date: defect?.dateVerified || defect?.verifiedDate || "",
    name: defect?.verifiedByName || "",
    position: defect?.verifiedByOfficePosition || "",
    isLegacyVerification,
  };
}

export function shouldRenderVerificationApproval(input: {
  c1CloseoutComplete: boolean;
  chain?: {
    requestUuid?: string | null;
    requestStatus?: string | null;
  } | null;
}): boolean {
  const hasRequest = Boolean(input.chain?.requestUuid);
  const requestStatus = String(input.chain?.requestStatus ?? "").toLowerCase();
  const reopenedAfterRejection = hasRequest
    && ["rejected", "returned"].includes(requestStatus);
  return !reopenedAfterRejection && (input.c1CloseoutComplete || hasRequest);
}

export function hasAuditDisplayValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasAuditDisplayValue);
  return true;
}

export function formatAuditIdentity(name?: string | null, rank?: string | null): string {
  return [name, rank]
    .filter((value): value is string => hasAuditDisplayValue(value))
    .map((value) => value.trim())
    .join(" · ");
}

export function projectRejectedClosureAuditFields(attempt: {
  priorStatus?: string | null;
  approvalRequestUuid?: string | null;
  closedOutByName?: string | null;
  closedOutByRank?: string | null;
  dateCompleted?: string | null;
  confirmCompleted?: boolean | null;
  closedByName?: string | null;
  closedByRank?: string | null;
  closedBy?: string | null;
  closedOn?: string | null;
  rejectedByName?: string | null;
  rejectedByPosition?: string | null;
  rejectedAt?: string | null;
  closureComment?: string | null;
  rejectionReason?: string | null;
  closureFiles?: string[] | null;
}) {
  const text = (value?: string | null) => hasAuditDisplayValue(value) ? value!.trim() : "";
  return {
    priorStatus: text(attempt.priorStatus),
    approvalRequestUuid: text(attempt.approvalRequestUuid),
    closeoutSubmittedBy: formatAuditIdentity(attempt.closedOutByName, attempt.closedOutByRank),
    showCloseoutCompleted: hasAuditDisplayValue(attempt.dateCompleted)
      || attempt.confirmCompleted !== null && attempt.confirmCompleted !== undefined,
    dateCompleted: text(attempt.dateCompleted),
    confirmCompleted: attempt.confirmCompleted,
    closedBy: formatAuditIdentity(attempt.closedByName, attempt.closedByRank),
    legacyClosedBy: text(attempt.closedBy),
    closedOn: text(attempt.closedOn),
    rejectedBy: formatAuditIdentity(attempt.rejectedByName, attempt.rejectedByPosition),
    rejectedAt: text(attempt.rejectedAt),
    closureComment: text(attempt.closureComment),
    rejectionReason: text(attempt.rejectionReason),
    closureFiles: (attempt.closureFiles ?? [])
      .filter((file) => hasAuditDisplayValue(file))
      .map((file) => file.trim()),
  };
}

export function approvalDecisionApplyError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("callbackError" in payload)) return null;
  const callbackError = (payload as { callbackError?: unknown }).callbackError;
  if (!callbackError) return null;
  if (typeof callbackError === "string") return callbackError;
  if (callbackError instanceof Error) return callbackError.message;
  return "The approval was recorded, but the defect could not be updated.";
}

export type DiagnosticsHealth = "healthy" | "warnings" | "unavailable";

export function resolveDiagnosticsStatus(input: {
  available?: boolean;
  healthy?: boolean;
  consequence?: string;
} | null | undefined): DiagnosticsHealth {
  if (!input || input.available === false) return "unavailable";
  return input.healthy ? "healthy" : "warnings";
}

/** Pure status projection shared by the admin diagnostics presentation and tests. */
export function resolveDiagnosticsHealth(input: {
  unavailable?: boolean;
  unresolvedApprovers?: number;
  orphanRequestedExtensions?: number;
  stalledRequests?: number;
  missingWorkflows?: number;
  returnedVerificationStillVerified?: number;
} | null | undefined): DiagnosticsHealth {
  if (!input || input.unavailable) return "unavailable";
  return (input.unresolvedApprovers ?? 0) +
    (input.orphanRequestedExtensions ?? 0) +
    (input.stalledRequests ?? 0) +
    (input.missingWorkflows ?? 0) +
    (input.returnedVerificationStillVerified ?? 0) > 0 ? "warnings" : "healthy";
}

export type DiagnosticsSummaryProjection = {
  healthy: boolean;
  chips: Array<{ key: "workflowGaps" | "unresolvedApprovers" | "stalledRequests" | "orphanRequestedExtensions" | "returnedVerificationStillVerified"; label: string; count: number }>;
};

export function projectDiagnosticsSummary(summary: {
  workflowGaps?: number;
  /** Legacy response alias retained for older installations. */
  missingWorkflows?: number;
  unresolvedApprovers?: number;
  stalledRequests?: number;
  orphanRequestedExtensions?: number;
  returnedVerificationStillVerified?: number;
} | null | undefined): DiagnosticsSummaryProjection {
  const allChips = [
    { key: "returnedVerificationStillVerified" as const, label: "defects have an incorrect verification state", count: summary?.returnedVerificationStillVerified ?? 0 },
    { key: "stalledRequests" as const, label: "approvals are waiting with nobody able to approve them", count: summary?.stalledRequests ?? 0 },
    { key: "orphanRequestedExtensions" as const, label: "extension requests were never sent for approval", count: summary?.orphanRequestedExtensions ?? 0 },
    { key: "workflowGaps" as const, label: "approval steps are not set up", count: summary?.workflowGaps ?? summary?.missingWorkflows ?? 0 },
    { key: "unresolvedApprovers" as const, label: "vessels need approvers", count: summary?.unresolvedApprovers ?? 0 },
  ];
  return { healthy: allChips.every((chip) => chip.count === 0), chips: allChips.filter((chip) => chip.count > 0) };
}

export function resolveDiagnosticsGroupState(
  rows: unknown[] | null | undefined,
  unavailable = false,
): "healthy" | "warnings" | "unavailable" {
  if (unavailable) return "unavailable";
  return rows?.length ? "warnings" : "healthy";
}

export type DiagnosticsUnresolvedRow = {
  vesselId: string;
  vesselName: string;
  roles: Array<{ roleId: string; roleName: string; issue: "missing-workflow-role" | "missing-vessel-membership" }>;
  workflowScopes?: string[];
  consequence: string;
};

export type DiagnosticsUnresolvedBlock = {
  key: string;
  vesselNames: string[];
  roles: DiagnosticsUnresolvedRow["roles"];
  rows: DiagnosticsUnresolvedRow[];
  consequence: string;
  instructions: string[];
};

function joinNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

export function projectDiagnosticsUnresolvedBlocks(rows: DiagnosticsUnresolvedRow[]): DiagnosticsUnresolvedBlock[] {
  const grouped = new Map<string, DiagnosticsUnresolvedRow[]>();
  for (const row of rows) {
    const key = [...row.roles]
      .sort((a, b) => `${a.issue}:${a.roleName}:${a.roleId}`.localeCompare(`${b.issue}:${b.roleName}:${b.roleId}`))
      .map((role) => `${role.issue}:${role.roleId}`)
      .join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.entries()).map(([key, blockRows]) => {
    const roles = [...blockRows[0].roles];
    const missingRoles = roles.filter((role) => role.issue === "missing-workflow-role").map((role) => role.roleName);
    const membershipRoles = roles.filter((role) => role.issue === "missing-vessel-membership").map((role) => role.roleName);
    return {
      key,
      vesselNames: blockRows.map((row) => row.vesselName).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      roles,
      rows: blockRows,
      consequence: "Approval requests for these vessels will wait with nobody able to action them.",
      instructions: [
        missingRoles.length
          ? `What to do: replace the removed ${joinNames(missingRoles)} ${missingRoles.length === 1 ? "role" : "roles"} in the Approval Engine builder on this page and save a new workflow version.`
          : "",
        membershipRoles.length
          ? `What to do: in SAILERP, assign users holding the roles ${joinNames(membershipRoles)} to these vessels, then ask them to sign out and back in.`
          : "",
      ].filter(Boolean),
    };
  });
}

export function formatDiagnosticsOrphan(row: {
  defectReportId: string; vesselName: string; requestedAt: string; newTargetDate: string; consequence: string;
}): string {
  return `${row.defectReportId} on ${row.vesselName}${row.requestedAt ? ` — requested ${row.requestedAt}` : ""}`;
}

export function formatDiagnosticsStalled(row: {
  defectReportId: string; vesselName: string; submittedAt: string; daysPending: number; consequence: string;
}): string {
  return `${row.defectReportId} on ${row.vesselName} — waiting ${row.daysPending} days`;
}

export function formatDiagnosticsReturnedVerificationStillVerified(row: {
  defectReportId: string;
  vesselName: string;
  finalizedAt: string;
  consequence: string;
}): string {
  return `${row.defectReportId} on ${row.vesselName}`;
}

const DIAGNOSTIC_WORKFLOW_NAMES: Record<string, string> = {
  "defects-extension": "Initial defect extension",
  "defects-repeat-extension": "Repeat defect extension",
  "defects-verification": "Defect verification",
};

export function formatDiagnosticsMissingWorkflow(row: {
  screenId: string;
  classification: string;
}): string {
  const workflowName = DIAGNOSTIC_WORKFLOW_NAMES[row.screenId] ?? "Unknown approval step";
  return `${workflowName} for ${row.classification} defects`;
}

export function projectRejectedClosureHistory<T extends { id: string | number; attemptNumber?: number | null }>(
  attempts: T[] | null | undefined,
): { attempts: T[]; defaultExpandedIds: string[] } {
  const ordered = [...(attempts ?? [])].sort((left, right) =>
    (left.attemptNumber ?? Number.MAX_SAFE_INTEGER) -
    (right.attemptNumber ?? Number.MAX_SAFE_INTEGER));
  return {
    attempts: ordered,
    defaultExpandedIds: ordered.length === 1 ? [String(ordered[0].id)] : [],
  };
}
