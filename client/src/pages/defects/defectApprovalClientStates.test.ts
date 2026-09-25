import { describe, expect, it } from "vitest";
import {
  hasPendingExtensionApproval,
  hasPendingExtensionForEntries,
  isOrphanedRequestedExtension,
  isOrphanedRequestedExtensionAt,
  resolveDefectApprovalPresentation,
  resolveDiagnosticsGroupState,
  resolveDiagnosticsHealth,
  resolveDiagnosticsStatus,
  formatDiagnosticsOrphan,
  formatDiagnosticsStalled,
  formatDiagnosticsUnresolved,
  formatDiagnosticsReturnedVerificationStillVerified,
  projectRejectedClosureHistory,
  projectRejectedClosureAuditFields,
  resolveVerificationDisplay,
  formatAuditIdentity,
  hasAuditDisplayValue,
  shouldRenderVerificationApproval,
} from "./defectApprovalPresentation";

describe("Defect approval client presentation states", () => {
  it("requires a request UUID and pending status", () => {
    expect(hasPendingExtensionApproval({ requestUuid: "r1", requestStatus: "pending" })).toBe(true);
    expect(hasPendingExtensionApproval({ requestUuid: null, requestStatus: "pending" })).toBe(false);
    expect(hasPendingExtensionApproval({ requestUuid: "r1", requestStatus: "approved" })).toBe(false);
  });
  it("marks only Requested entries without a request as orphaned", () => {
    expect(isOrphanedRequestedExtension({ status: "Requested" }, { requestUuid: null })).toBe(true);
    expect(isOrphanedRequestedExtension({ status: "Approved" }, { requestUuid: null })).toBe(false);
    expect(isOrphanedRequestedExtension({ status: "Requested" }, { requestUuid: "r1" })).toBe(false);
  });
  it("uses the first Requested entry as the governed one", () => {
    const entries = [{ status: "Approved" }, { status: "Requested" }, { status: "Requested" }];
    const chain = { requestUuid: "r1", requestStatus: "pending" };
    expect(hasPendingExtensionForEntries(entries, chain)).toBe(true);
    expect(isOrphanedRequestedExtensionAt(entries, 1, chain)).toBe(false);
    expect(isOrphanedRequestedExtensionAt(entries, 2, chain)).toBe(true);
    expect(hasPendingExtensionForEntries([], chain)).toBe(false);
    expect(isOrphanedRequestedExtensionAt(entries, 1, { requestUuid: null, requestStatus: "none" })).toBe(true);
  });
  it("distinguishes no-workflow, loading, error, and unavailable", () => {
    expect(resolveDefectApprovalPresentation({ isLoading: false, error: null, data: { hasActiveWorkflow: false, currentUserCanDecide: false } }, true).state).toBe("no-workflow");
    expect(resolveDefectApprovalPresentation({ isLoading: true, error: null }, true).state).toBe("loading");
    expect(resolveDefectApprovalPresentation({ isLoading: false, error: new Error("x") }, true).state).toBe("error");
    expect(resolveDefectApprovalPresentation({ isLoading: false, error: { status: 503, code: "APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE" } }, true).state).toBe("ship-unavailable");
  });
  it("preserves legacy verification display", () => {
    expect(resolveVerificationDisplay({ requestUuid: null, requestStatus: "none" }, { verified: true, verifiedDate: "2026-01-02", verifiedByName: "Master", verifiedByOfficePosition: "Master" })).toMatchObject({ date: "2026-01-02", isLegacyVerification: true });
  });
  it("suppresses only stale rejected or returned verification after reopen", () => {
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: false, chain: { requestUuid: "r1", requestStatus: "rejected" } })).toBe(false);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: false, chain: { requestUuid: "r1", requestStatus: "returned" } })).toBe(false);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: false, chain: { requestUuid: "r1", requestStatus: "pending" } })).toBe(true);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: false, chain: { requestUuid: "r1", requestStatus: "approved" } })).toBe(true);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: false, chain: { requestUuid: null, requestStatus: "none" } })).toBe(false);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: true, chain: { requestUuid: null, requestStatus: "none" } })).toBe(true);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: true, chain: { requestUuid: "old", requestStatus: "rejected" } })).toBe(false);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: true, chain: { requestUuid: "old", requestStatus: "returned" } })).toBe(false);
    expect(shouldRenderVerificationApproval({ c1CloseoutComplete: true, chain: { requestUuid: "r2", requestStatus: "pending" } })).toBe(true);
  });
  it("keeps closure-history identities separate and omits empty values", () => {
    expect(formatAuditIdentity("Master One", "Master")).toBe("Master One · Master");
    expect(formatAuditIdentity(null, "Chief Officer")).toBe("Chief Officer");
    expect(formatAuditIdentity("  ", null)).toBe("");
    expect(hasAuditDisplayValue(null)).toBe(false);
    expect(hasAuditDisplayValue("  ")).toBe(false);
    expect(hasAuditDisplayValue([])).toBe(false);
    expect(hasAuditDisplayValue(["", "legacy.pdf"])).toBe(true);
    expect(hasAuditDisplayValue(false)).toBe(true);
    const authoritative = formatAuditIdentity("Authoritative Name", "Master");
    const closeoutSubmitter = formatAuditIdentity("Submitter Name", "Chief Officer");
    const legacyClosedBy = "legacy-caller-value";
    expect(authoritative).toBe("Authoritative Name · Master");
    expect(closeoutSubmitter).toBe("Submitter Name · Chief Officer");
    expect(legacyClosedBy).not.toBe(authoritative);
    expect(projectRejectedClosureAuditFields({
      closedOutByName: "Submitter Name",
      closedOutByRank: "Chief Officer",
      closedByName: "Authoritative Name",
      closedByRank: "Master",
      closedBy: "legacy-caller-value",
      closedOn: null,
      closureComment: " ",
      closureFiles: ["", " evidence.pdf "],
    })).toMatchObject({
      closeoutSubmittedBy: "Submitter Name · Chief Officer",
      closedBy: "Authoritative Name · Master",
      legacyClosedBy: "legacy-caller-value",
      closedOn: "",
      closureComment: "",
      closureFiles: ["evidence.pdf"],
    });
  });
  it("projects diagnostics healthy, warnings, and unavailable", () => {
    expect(resolveDiagnosticsHealth({})).toBe("healthy");
    expect(resolveDiagnosticsHealth({ orphanRequestedExtensions: 1 })).toBe("warnings");
    expect(resolveDiagnosticsHealth({ unavailable: true })).toBe("unavailable");
    expect(resolveDiagnosticsStatus({ available: false, healthy: true })).toBe("unavailable");
    expect(resolveDiagnosticsStatus({ available: true, healthy: false, consequence: "blocked" })).toBe("warnings");
    expect(resolveDiagnosticsStatus({ available: true, healthy: true })).toBe("healthy");
    expect(resolveDiagnosticsGroupState([], true)).toBe("unavailable");
  });
  it("formats every diagnostic group's actionable identifiers and consequence", () => {
    expect(formatDiagnosticsUnresolved({ vesselId: "V1", roleId: "R1", roleLabel: "Master", workflowScopes: ["verify"], consequence: "cannot approve" })).toContain("V1");
    expect(formatDiagnosticsUnresolved({ vesselId: "V1", roleId: "R1", roleLabel: "Master", workflowScopes: ["verify"], consequence: "cannot approve" })).toContain("cannot approve");
    expect(formatDiagnosticsOrphan({ defectId: "D1", vesselId: "V1", entryId: "E1", requestedAt: "2026-01-01", newTargetDate: "2026-02-01", consequence: "does not block" })).toContain("E1");
    expect(formatDiagnosticsOrphan({ defectId: "D1", vesselId: "V1", entryId: "E1", requestedAt: "2026-01-01", newTargetDate: "2026-02-01", consequence: "does not block" })).toContain("does not block");
    expect(formatDiagnosticsStalled({ requestUuid: "Q1", defectId: "D1", vesselId: "V1", screenId: "verify", submittedAt: "2026-01-01", daysPending: 4, consequence: "blocked" })).toContain("4 days pending");
    expect(formatDiagnosticsReturnedVerificationStillVerified({ requestUuid: "Q1", defectId: "D1", vesselId: "V1", finalizedAt: "2026-01-02", consequence: "verification must be cleared" })).toContain("verification must be cleared");
  });
  it("orders rejected closure attempts oldest first and expands only a single entry", () => {
    expect(projectRejectedClosureHistory([
      { id: "third", attemptNumber: 3 },
      { id: "first", attemptNumber: 1 },
      { id: "second", attemptNumber: 2 },
    ])).toEqual({
      attempts: [
        { id: "first", attemptNumber: 1 },
        { id: "second", attemptNumber: 2 },
        { id: "third", attemptNumber: 3 },
      ],
      defaultExpandedIds: [],
    });
    expect(projectRejectedClosureHistory([
      { id: "only", attemptNumber: 1 },
    ]).defaultExpandedIds).toEqual(["only"]);
  });
  it("formats unresolved approvers safely with or without workflow scopes", () => {
    const base = { vesselId: "V1", roleId: "R1", roleLabel: "Master", consequence: "cannot approve" };
    expect(() => formatDiagnosticsUnresolved({ ...base, workflowScopes: ["verify"] })).not.toThrow();
    expect(formatDiagnosticsUnresolved({ ...base, workflowScopes: ["verify"] })).toContain("V1");
    expect(formatDiagnosticsUnresolved({ ...base, workflowScopes: ["verify"] })).toContain("Master");
    expect(formatDiagnosticsUnresolved({ ...base, workflowScopes: ["verify"] })).toContain("cannot approve");
    expect(() => formatDiagnosticsUnresolved(base)).not.toThrow();
    expect(formatDiagnosticsUnresolved(base)).toContain("V1");
    expect(formatDiagnosticsUnresolved(base)).toContain("Master");
    expect(formatDiagnosticsUnresolved(base)).toContain("cannot approve");
  });
});