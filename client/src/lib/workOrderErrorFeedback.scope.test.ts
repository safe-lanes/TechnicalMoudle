import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const files = [
  "client/src/pages/pms/WorkOrders.tsx",
  "client/src/pages/pms/WorkOrderFormPage.tsx",
  "client/src/pages/pms/WorkOrderPlanner.tsx",
  "client/src/components/PostponeWorkOrderDialog.tsx",
  "client/src/components/RePostponeWorkOrderDialog.tsx",
  "client/src/components/UnplannedWorkOrderForm.tsx",
  "client/src/components/OverdueReasonDialog.tsx",
];

function extract(source: string, file: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const guards: string[] = [];
  const requests: string[] = [];
  const navigation: string[] = [];
  const callText = (node: ts.Node) => node.getText(ast).replace(/\s+/g, " ");
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node)) guards.push(callText(node.expression));
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast);
      if (["fetch", "apiRequest"].includes(name)) requests.push(callText(node));
      if (["navigate", "setLocation", "onClose"].includes(name)) navigation.push(callText(node));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { guards, requests, navigation };
}

// During development, prove presentation changes leave the existing workflow intact.
// Once committed, HEAD is the current source and these checks remain safe/read-only.
for (const file of files) {
  test(`${file}: validation decisions, requests and navigation remain unchanged`, () => {
    const original = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
    assert.deepEqual(extract(readFileSync(file, "utf8"), file), extract(original, file));
  });
}

test("first blocking validation and draft correction actions remain in place", () => {
  const source = readFileSync("client/src/pages/pms/WorkOrderFormPage.tsx", "utf8");
  assert.match(source, /description:\s*hardErrors\[0\]/);
  assert.match(source, /description:\s*submissionErrors\[0\]/);
  assert.match(source, /Use "Save Draft" to keep your progress/);
  assert.match(source, /Use "Save" to keep your progress as a draft/);
  assert.doesNotMatch(source, /Current Reading must be a positive number \(≥ 0\)/);
});

test("no backend, database schema/migrations or shared transport changes", () => {
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" }).trim().split("\n");
  assert.ok(changed.every(file =>
    !/^(?:server\/|shared\/|migrations\/)|drizzle|client\/src\/lib\/queryClient\.ts/.test(file)
  ));
});
