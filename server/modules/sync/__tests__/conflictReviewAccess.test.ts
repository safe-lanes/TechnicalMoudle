import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Read the actual client mapping literals so these checks fail if either lookup
// used by the shared ship/shore UI loses the Conflict Review identity.
const contextSource = readFileSync(resolve("client/src/contexts/PermissionsContext.tsx"), "utf8");
const contextFile = ts.createSourceFile("PermissionsContext.tsx", contextSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function objectLiteral(name: string): ts.ObjectLiteralExpression {
  for (const statement of contextFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(contextFile) === name && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
        return declaration.initializer;
      }
    }
  }
  throw new Error(`Missing ${name} permission map`);
}

function property(object: ts.ObjectLiteralExpression, key: string): ts.Expression {
  const entry = object.properties.find((p) =>
    ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) && p.name.text === key
  );
  if (!entry || !ts.isPropertyAssignment(entry)) throw new Error(`Missing permission mapping: ${key}`);
  return entry.initializer;
}

function stringProperty(object: ts.ObjectLiteralExpression, key: string): string {
  const value = property(object, key);
  if (!ts.isStringLiteral(value)) throw new Error(`Expected string permission mapping: ${key}`);
  return value.text;
}

const adminMap = property(objectLiteral("MENU_NAME_MAP"), "admin");
if (!ts.isObjectLiteralExpression(adminMap)) throw new Error("Missing Admin permission mappings");
const routeMap = objectLiteral("ROUTE_TO_MENU_NAME");

describe("Sync Conflict Review permission wiring (shared shore/vessel UI)", () => {
  it("uses the same existing permission identity for the sidebar and direct/dashboard URL", () => {
    expect(stringProperty(adminMap, "sync-conflicts")).toBe("admin-sync-conflicts");
    expect(stringProperty(routeMap, "/admin/sync-conflicts")).toBe("admin-sync-conflicts");

    const sidebar = readFileSync(resolve("client/src/components/SideMenuBar.tsx"), "utf8");
    const dashboard = readFileSync(resolve("client/src/pages/admin/SyncDashboard.tsx"), "utf8");
    const module = readFileSync(resolve("client/src/pages/TechnicalModule.tsx"), "utf8");
    expect(sidebar).toMatch(/id: "sync-conflicts", label: "Conflict Review"/);
    expect(sidebar).toContain("return canViewSidebarItem(subModule, item.id)");
    expect(module).toContain('selectedMenuItem === "sync-conflicts"');
    expect(module).toContain("!canViewSidebarItem(selectedSubModule, selectedMenuItem)");
    expect(dashboard).toMatch(/setLocation\("\/admin\/sync-conflicts"\)/);
  });

  it("allows a view grant, denies a configured role without it, and leaves other Admin items independent", () => {
    const conflict = stringProperty(adminMap, "sync-conflicts");
    const dashboard = stringProperty(adminMap, "sync-dashboard");
    const provisioning = stringProperty(adminMap, "sync-provisioning");
    expect(dashboard).toBe("admin-sync-dashboard");
    expect(provisioning).toBe("admin-sync-provisioning");

    // Matches the configured-role lookup: a missing or false grant denies view.
    const canView = (grants: Map<string, boolean>, menu: string) => grants.get(menu) ?? false;
    const withGrant = new Map([[conflict, true], [dashboard, true], [provisioning, false]]);
    const withoutGrant = new Map([[dashboard, true], [provisioning, false]]);
    for (const grants of [withGrant, withoutGrant]) {
      expect(canView(grants, stringProperty(routeMap, "/admin/sync-conflicts")))
        .toBe(canView(grants, stringProperty(adminMap, "sync-conflicts")));
      expect(canView(grants, dashboard)).toBe(true);
      expect(canView(grants, provisioning)).toBe(false);
    }
    expect(canView(withGrant, conflict)).toBe(true);
    expect(canView(withoutGrant, conflict)).toBe(false);
  });

  it("keeps resolution actions behind the separate edit grant", () => {
    const review = readFileSync(resolve("client/src/pages/admin/SyncConflictReview.tsx"), "utf8");
    const routes = readFileSync(resolve("server/modules/sync/routes.ts"), "utf8");
    expect(review).toContain('canEdit("admin-sync-conflicts")');
    expect(review).toMatch(/\{canEditConflicts && \(\s*<>[\s\S]*?Apply incoming value[\s\S]*?Dismiss/);
    for (const handler of ["applyIncomingHandler", "dismissHandler"]) {
      expect(routes).toContain(`requirePermission('admin-sync-conflicts', 'edit', { enforce: true }), asyncHandler(conflictReviewCtrl.${handler})`);
    }
    expect(routes).toContain("requirePermission('admin-sync-conflicts', 'edit', { enforce: true }), asyncHandler(syncController.resolveConflictHandler)");
    expect(routes).toContain("requirePermission('admin-sync-dashboard', 'view', { enforce: true }), asyncHandler(conflictReviewCtrl.countConflictsHandler)");
    for (const handler of ["conflictTablesHandler", "listConflictsHandler", "getConflictHandler"]) {
      expect(routes).toContain(`requirePermission('admin-sync-conflicts', 'view', { enforce: true }), asyncHandler(conflictReviewCtrl.${handler})`);
    }
    expect(routes).toContain("router.post('/sync/push', syncTenantGuard");
    expect(routes).toContain("router.post('/sync/pull', syncTenantGuard");
  });

  it("does not show navigation or resolution to users lacking the respective grants", () => {
    const dashboard = readFileSync(resolve("client/src/pages/admin/SyncDashboard.tsx"), "utf8");
    expect(dashboard).toContain('canViewMenu("admin-sync-conflicts")');
    expect(dashboard).toContain('canEdit("admin-sync-conflicts")');
    expect(dashboard).toContain('role={canViewConflicts ? "link" : undefined}');
    expect(dashboard).toContain('{canViewConflicts && <Button');
    expect(dashboard).toContain('{canEditConflicts && (');
    expect(dashboard).toContain('canViewConflicts && countReady && conflicts.length > 0');
    expect(dashboard).toContain('Conflicts (selected vessel)');
    const review = readFileSync(resolve("client/src/pages/admin/SyncConflictReview.tsx"), "utf8");
    expect(review).toContain("full fleet");
  });

  it("keeps loading, errors, empty filters and stale counts separate in both ship and shore UI", () => {
    const review = readFileSync(resolve("client/src/pages/admin/SyncConflictReview.tsx"), "utf8");
    const dashboard = readFileSync(resolve("client/src/pages/admin/SyncDashboard.tsx"), "utf8");
    expect(review).toContain("if (!res.ok) throw new Error(`${res.status}`)");
    expect(review).toContain("tablesQuery.isError");
    expect(review).toContain("conflictsQuery.isError");
    expect(review).toContain('reviewEmptyTitle(statusFilter');
    expect(review).toContain("resultState(conflictsQuery)");
    expect(dashboard).toContain("countState(selectedVesselId, conflictCountQuery)");
    expect(dashboard).toContain("conflictCountQuery.isError");
    expect(dashboard).toContain("countReady && totalConflictCount === 0");
    expect(dashboard).toContain('resultState(conflictsQuery) === "error"');
    expect(dashboard).toContain("isShip && selectedVesselId");
    expect(dashboard).toContain("vesselId=${selectedVesselId}");
  });
});