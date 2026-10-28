import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DefectApprovalDiagnosticsBody,
  type DefectApprovalDiagnostics,
} from "../../client/src/pages/admin/DefectApprovalDiagnosticsDetails";
import { projectDiagnosticsSummary } from "../../client/src/pages/defects/defectApprovalPresentation";

const fixture = (): DefectApprovalDiagnostics => ({
  generatedAt: "2026-10-28T00:00:00Z",
  available: true,
  healthy: false,
  consequence: "Review these approval issues.",
  queryPlan: "Fixture",
  summary: {
    returnedVerificationStillVerified: 1,
    stalledRequests: 1,
    orphanRequestedExtensions: 1,
    workflowGaps: 1,
    unresolvedApprovers: 2,
  },
  returnedVerificationStillVerified: [{
    requestUuid: "verification-request", defectId: "verified-defect-id",
    defectReportId: "VERIFIED-REPORT", vesselId: "vessel-one",
    vesselName: "First Vessel", finalizedAt: "2026-10-27T10:00:00Z",
    consequence: "Verification is inconsistent.",
  }],
  stalledRequests: [{
    requestUuid: "stalled-request", defectId: "stalled-defect-id",
    defectReportId: "STALLED-REPORT", vesselId: "vessel-one",
    vesselName: "First Vessel", screenId: "defects-verification",
    submittedAt: "2026-10-25T10:00:00Z", daysPending: 3,
    consequence: "No approver available.",
  }],
  orphanRequestedExtensions: [{
    defectId: "orphan-defect-id", defectReportId: "ORPHAN-REPORT",
    vesselId: "vessel-one", vesselName: "First Vessel", entryId: "extension-entry",
    requestedAt: "2026-10-25", newTargetDate: "2026-11-25",
    consequence: "Not submitted.",
  }],
  missingActiveWorkflows: [{
    screenId: "defects-extension", classification: "Normal", consequence: "Not configured.",
  }],
  unresolvedApprovers: ["First Vessel", "Second Vessel"].map((vesselName, index) => ({
    vesselId: `unresolved-vessel-${index}`, vesselName,
    roles: [
      { roleId: "removed-role", roleName: "Marine Manager", issue: "missing-workflow-role" as const },
      { roleId: "membership-role", roleName: "Master", issue: "missing-vessel-membership" as const },
    ],
    workflowScopes: ["defects-extension"], consequence: "Waiting for approvers.",
  })),
});

const render = (
  data?: DefectApprovalDiagnostics,
  overrides: Partial<React.ComponentProps<typeof DefectApprovalDiagnosticsBody>> = {},
) => renderToStaticMarkup(React.createElement(DefectApprovalDiagnosticsBody, {
  data, isLoading: false, ...overrides,
}));

test("all five categories retain problems, guidance, and expandable technical identifiers", () => {
  const html = render(fixture());
  for (const text of [
    "VERIFIED-REPORT", "STALLED-REPORT", "ORPHAN-REPORT",
    "Initial defect extension for Normal defects", "First Vessel", "Second Vessel",
    "verification-request", "verified-defect-id", "stalled-request",
    "stalled-defect-id", "orphan-defect-id", "extension-entry",
    "Impact", "What to do", "Technical details",
  ]) assert.ok(html.includes(text), `Missing: ${text}`);
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /reconcile these defects in SAILERP/i);
  assert.match(html, /submit them for approval or remove them/);
  assert.doesNotMatch(html, /Apply again|button-reapply/);
});

test("unresolved-vessel grouping keeps both removed-role and vessel-membership instructions", () => {
  const html = render(fixture());
  assert.match(html, /replace the removed Marine Manager role/);
  assert.match(html, /assign users holding the roles Master to these vessels/);
  assert.match(html, /sign out and back in/);
  assert.match(html, /unresolved-vessel-0/);
  assert.match(html, /unresolved-vessel-1/);
  assert.match(html, /removed-role/);
  assert.match(html, /membership-role/);
});

test("summary counts use the existing projection including the legacy missing-workflow alias", () => {
  const data = fixture();
  data.summary = { missingWorkflows: 7, unresolvedApprovers: 2 };
  const projected = projectDiagnosticsSummary(data.summary);
  assert.deepEqual(projected.chips.map(({ key, count }) => [key, count]), [
    ["workflowGaps", 7], ["unresolvedApprovers", 2],
  ]);
  const html = render(data);
  for (const chip of projected.chips) {
    assert.match(html, new RegExp(`data-testid="defects-diagnostics-count-${chip.key}"[^]*?<strong[^>]*>${chip.count}</strong>`));
  }
  assert.match(html, /2 vessels/);
});

test("more than 25 problems and technical identifiers are not silently omitted", () => {
  const data = fixture();
  data.stalledRequests = Array.from({ length: 32 }, (_, index) => ({
    ...data.stalledRequests[0],
    requestUuid: `long-list-request-${index}`,
    defectReportId: `LONG-LIST-REPORT-${index}`,
  }));
  data.summary.stalledRequests = 32;
  const html = render(data);
  assert.match(html, /LONG-LIST-REPORT-31/);
  assert.match(html, /long-list-request-31/);
});

test("long vessel names and identifiers remain complete instead of truncated", () => {
  const data = fixture();
  const vessel = "LongUnbrokenVesselName".repeat(40);
  const request = "LongUnbrokenRequestIdentifier".repeat(40);
  data.stalledRequests[0].vesselName = vessel;
  data.stalledRequests[0].requestUuid = request;
  const html = render(data);
  assert.ok(html.includes(vessel));
  assert.ok(html.includes(request));
  assert.doesNotMatch(html, /line-clamp|truncate/);
});

test("loading, error, unavailable, and missing responses do not show stale issues", () => {
  const data = fixture();
  for (const html of [
    render(data, { isLoading: true }),
    render(data, { error: new Error("HTTP 403") }),
    render({ ...data, available: false }),
    render(),
  ]) {
    assert.doesNotMatch(html, /VERIFIED-REPORT|STALLED-REPORT|ORPHAN-REPORT/);
    assert.match(html, /checking|loading|unavailable|not.*available|could not/i);
  }
});

test("healthy and empty-after-refresh states do not leave old categories visible", () => {
  const data = fixture();
  data.summary = {};
  data.returnedVerificationStillVerified = [];
  data.stalledRequests = [];
  data.orphanRequestedExtensions = [];
  data.missingActiveWorkflows = [];
  data.unresolvedApprovers = [];
  for (const healthy of [true, false]) {
    const html = render({ ...data, healthy });
    assert.match(html, /no .*?(issues|problems|items)|no current issue|set up correctly/i);
    assert.doesNotMatch(html, /VERIFIED-REPORT|STALLED-REPORT|ORPHAN-REPORT/);
  }
});

test("warnings with no returned details are not described as a healthy setup", () => {
  const data = fixture();
  data.returnedVerificationStillVerified = [];
  data.stalledRequests = [];
  data.orphanRequestedExtensions = [];
  data.missingActiveWorkflows = [];
  data.unresolvedApprovers = [];
  const html = render(data);
  assert.match(html, /summary reports approval issues/);
  assert.doesNotMatch(html, /setup is ready|no items requiring action/);
});

test("Defects integration remains read-only with bounded content and close-focus restoration", () => {
  const panel = readFileSync("client/src/pages/admin/ApprovalAdminPanels.tsx", "utf8");
  const details = readFileSync("client/src/pages/admin/DefectApprovalDiagnosticsDetails.tsx", "utf8");
  const defectPanel = panel.slice(panel.indexOf("export function DefectApprovalDiagnosticsPanel"), panel.indexOf("// F4:"));
  assert.ok(defectPanel.includes('"/technical/api/defects/approval-diagnostics"'));
  assert.ok(defectPanel.includes("enabled: !!currentUser"));
  assert.doesNotMatch(defectPanel, /useMutation|method: "POST"|method: "PUT"/);
  assert.doesNotMatch(details, /slice\(0,\s*25\)|Apply again/);
  assert.ok(details.includes("onCloseAutoFocus"));
  assert.ok(details.includes("overflow-y-auto"));
  assert.ok(details.includes("min-h-0"));
  assert.ok(details.includes('overflowWrap: "anywhere"'));
});
