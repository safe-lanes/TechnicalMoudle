export type DefectApprovalAction = "extension" | "verification";

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