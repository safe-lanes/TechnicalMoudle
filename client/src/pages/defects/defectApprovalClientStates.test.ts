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
  resolveVerificationDisplay,
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