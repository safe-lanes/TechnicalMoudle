export type DefectApprovalAction = "extension" | "verification";

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

export function approvalDecisionApplyError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("callbackError" in payload)) return null;
  const callbackError = (payload as { callbackError?: unknown }).callbackError;
  if (!callbackError) return null;
  if (typeof callbackError === "string") return callbackError;
  if (callbackError instanceof Error) return callbackError.message;
  return "The approval was recorded, but the defect could not be updated.";
}