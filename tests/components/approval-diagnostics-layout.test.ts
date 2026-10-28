import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalDiagnosticsBody,
  type SharedDiagnostics,
} from "../../client/src/pages/admin/ApprovalDiagnosticsDetails";

const group = (key: string, count = 1): SharedDiagnostics["groups"][number] => ({
  key,
  title: `Category ${key}`,
  consequence: `Impact of ${key}`,
  instruction: `Corrective action for ${key}`,
  rows: Array.from({ length: count }, (_, index) => ({
    text: `Problem ${key} ${index}`,
    detail: `Supporting detail ${key} ${index}`,
    requuid: `${key}-request-${index}`,
  })),
});
const diagnostics = (groups: SharedDiagnostics["groups"]): SharedDiagnostics => ({
  available: true,
  healthy: groups.length === 0,
  groups,
});
const render = (
  data?: SharedDiagnostics,
  overrides: Partial<React.ComponentProps<typeof ApprovalDiagnosticsBody>> = {},
) => renderToStaticMarkup(React.createElement(ApprovalDiagnosticsBody, {
  data,
  isLoading: false,
  messages: {},
  isPending: false,
  onReapply: () => {},
  ...overrides,
}));

test("all diagnostic categories preserve every problem, detail, impact, and instruction", () => {
  const groups = ["blockedActions", "rolesWithoutApprover", "stalled", "failedUpdates"].map(key => group(key, 2));
  const html = render(diagnostics(groups));
  for (const item of groups) {
    assert.ok(html.includes(item.title));
    assert.ok(html.includes(item.consequence));
    assert.ok(html.includes(item.instruction));
    for (const row of item.rows) {
      assert.ok(html.includes(row.text));
      assert.ok(html.includes(row.detail!));
    }
  }
  assert.match(html, /Impact/);
  assert.match(html, /What to do/);
});

test("summary counts report issue rows rather than vessel names in the text", () => {
  const html = render(diagnostics([group("blockedActions", 3), group("rolesWithoutApprover", 1)]));
  assert.match(html, /data-testid="approval-diagnostics-count-blockedActions"[^]*?<strong[^>]*>3<\/strong>/);
  assert.match(html, /data-testid="approval-diagnostics-count-rolesWithoutApprover"[^]*?<strong[^>]*>1<\/strong>/);
  assert.match(html, /not unique vessels or people/);
});

test("only failed-update rows with a request identifier offer recovery", () => {
  const failed = group("failedUpdates", 2);
  delete failed.rows[1].requuid;
  const html = render(diagnostics([
    group("blockedActions"),
    group("rolesWithoutApprover"),
    group("stalled"),
    failed,
  ]));
  assert.equal(html.match(/data-testid="button-reapply-/g)?.length, 1);
  assert.match(html, /button-reapply-failedUpdates-request-0/);
  assert.doesNotMatch(html, /button-reapply-stalled|button-reapply-blockedActions|button-reapply-rolesWithoutApprover/);
});

test("pending recovery prevents duplicate submissions and feedback stays on its row", () => {
  const data = diagnostics([group("failedUpdates", 2)]);
  const html = render(data, {
    isPending: true,
    pendingRequestId: "failedUpdates-request-0",
  });
  const buttons = html.match(/<button\b[^>]*data-testid="button-reapply-[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  for (const button of buttons) assert.match(button, /disabled/);
  const denied = render(data, {
    messages: { "failedUpdates-request-0": "You do not have permission to apply this approval." },
  });
  assert.match(denied, /You do not have permission to apply this approval/);
  const success = render(data, { messages: { "failedUpdates-request-0": "Applied." } });
  assert.match(success, /Applied\./);
  assert.doesNotMatch(render(data, { pendingRequestId: "failedUpdates-request-0" }), /Applying/);
});

test("long unbroken text, all vessels, and more than 25 issues remain accessible", () => {
  const item = group("rolesWithoutApprover", 31);
  const long = "VesselIdentifier".repeat(80);
  item.rows[0].text = long;
  item.rows[0].detail = Array.from({ length: 70 }, (_, i) => `Vessel ${i}`).join(", ");
  const html = render(diagnostics([item]));
  assert.ok(html.includes(long));
  assert.ok(html.includes("Vessel 69"));
  assert.ok(html.includes("Problem rolesWithoutApprover 30"));
  assert.doesNotMatch(html, /line-clamp|truncate/);
});

test("loading, unavailable, and failed refetch hide stale recovery controls", () => {
  const data = diagnostics([group("failedUpdates")]);
  for (const html of [
    render(data, { isLoading: true }),
    render(data, { error: new Error("HTTP 403") }),
    render({ ...data, available: false }),
    render(),
  ]) {
    assert.doesNotMatch(html, /button-reapply-|Problem failedUpdates/);
    assert.match(html, /loading|checking|unavailable|unable|could not|not currently available/i);
  }
});

test("healthy and newly empty diagnostics show a clear non-actionable state", () => {
  for (const data of [
    diagnostics([]),
    { available: true, healthy: false, groups: [] },
  ]) {
    const html = render(data);
    assert.match(html, /no .*?(issues|problems|issue rows)|no items requiring action/i);
    assert.doesNotMatch(html, /button-reapply-/);
  }
});

test("integration keeps recovery endpoints and invalidation with bounded dialog and focus restoration", () => {
  const panel = readFileSync("client/src/pages/admin/ApprovalAdminPanels.tsx", "utf8");
  const details = readFileSync("client/src/pages/admin/ApprovalDiagnosticsDetails.tsx", "utf8");
  assert.ok(panel.includes('fetch("/technical/api/approvals/diagnostics")'));
  assert.ok(panel.includes('/technical/api/approvals/diagnostics/${encodeURIComponent(requuid)}/reapply'));
  assert.ok(panel.includes('queryClient.invalidateQueries({ queryKey: key })'));
  assert.ok(panel.includes('if (reapply.isPending) return'));
  assert.ok(details.includes('onCloseAutoFocus='));
  assert.ok(details.includes('DialogTitle'));
  assert.ok(details.includes('overflow-y-auto'));
  assert.ok(details.includes('min-h-0'));
  assert.ok(details.includes('overflowWrap: "anywhere"'));
  assert.ok(details.includes('w-[calc(100vw-24px)]'));
});
