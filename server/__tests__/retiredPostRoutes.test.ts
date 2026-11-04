import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');
const ast = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);

function memberNames(file: string, owner: string) {
  const declaration = ast(file).statements.find(node =>
    (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name?.text === owner);
  if (!declaration || !(ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration))) {
    throw Error(`Missing declaration: ${owner}`);
  }
  return declaration.members.map(member => member.name?.getText());
}

// Execute route registration only. No real controller, middleware, Express,
// storage or startup module is imported. All capabilities are inert and inline.
function routeTable(file: string) {
  type Row = { method: string; path: string; handlers: unknown[] };
  type Table = { rows: Row[]; mounts: Array<{ prefix: string; child: Table }> };
  const tables: Table[] = [];
  const noop = () => undefined;
  const inertNamespace = new Proxy({ __esModule: true }, {
    get: (_target, key) => key === '__esModule' ? true : noop,
  });
  const permission = () => noop;
  const Router = () => {
    const table: Table = { rows: [], mounts: [] };
    tables.push(table);
    const register = (method: string) => (path: string, ...handlers: unknown[]) => {
      table.rows.push({ method, path, handlers });
    };
    return {
      table,
      get: register('GET'), post: register('POST'), patch: register('PATCH'),
      put: register('PUT'), delete: register('DELETE'),
      use: (prefix: string, child?: { table: Table }) => {
        if (child) table.mounts.push({ prefix, child: child.table });
      },
    };
  };
  const multer = Object.assign(() => ({ single: () => noop }), { memoryStorage: noop });
  const imports = new Map<string, unknown>([
    ['express', { Router }],
    ['multer', multer],
    ['../shared/middleware', { asyncHandler: (handler: unknown) => handler }],
    ['../../middleware/auth', {
      requireAuth: noop, requirePMSAdmin: noop, requireOfficeOrAdmin: noop,
      requireRole: permission, requireApproverOrRole: permission,
    }],
    ['../../middleware/permissions', { requirePermission: permission }],
    ['./controllers/workOrderController', inertNamespace],
    ['./controllers/workOrderPagingController', inertNamespace],
    ['./controllers/woDocumentController', inertNamespace],
    ['../jobs/controllers/jobWorkInstructionController', inertNamespace],
    ['./controllers/componentController', inertNamespace],
    ['./controllers/subEntityController', inertNamespace],
    ['./controllers/fleetController', inertNamespace],
    ['./controllers/fleetAdminController', inertNamespace],
    ['./controllers/bulkController', inertNamespace],
  ]);
  const module = { exports: {} };
  const context = {
    module, exports: module.exports,
    require(id: string) {
      if (!imports.has(id)) throw Error(`Blocked route import: ${id}`);
      return imports.get(id);
    },
  };
  expect(runInNewContext(
    '[typeof process, typeof fetch, typeof setTimeout, typeof setInterval]',
    context,
  )).toEqual(['undefined', 'undefined', 'undefined', 'undefined']);
  expect(() => context.require('../db')).toThrow('Blocked route import');
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics).toEqual([]);
  runInNewContext(compiled.outputText, context, {
    timeout: 1000, codeGeneration: { strings: false, wasm: false },
  });
  function flatten(table: Table, prefix = ''): Row[] {
    return [
      ...table.rows.map(row => ({ ...row, path: prefix + row.path })),
      ...table.mounts.flatMap(mount => flatten(mount.child, prefix + mount.prefix)),
    ];
  }
  if (!tables[0]) throw Error(`No router registered: ${file}`);
  const rows = flatten(tables[0]);
  for (const row of rows) {
    expect(row.handlers.length).toBeGreaterThan(0);
    for (const handler of row.handlers) expect(typeof handler).toBe('function');
  }
  return rows.map(row => `${row.method} ${row.path}`);
}

describe('retired POST chains stay absent while supported alternatives remain', () => {
  it('removes exactly the retired route registrations, retaining readers and imports', () => {
    const wo = routeTable('server/modules/work-orders/routes.ts');
    expect(wo).not.toContain('POST /work-order-executions');
    for (const route of [
      'GET /work-order-executions/:componentId',
      'GET /work-order-executions/details/:id',
      'PATCH /work-order-executions/:id',
    ]) expect(wo).toContain(route);
    const components = routeTable('server/modules/components/routes.ts');
    expect(components).not.toContain('POST /components/upload');
    for (const route of [
      'POST /components', 'PATCH /components/:id', 'DELETE /components/:id',
      'POST /component-documents', 'PUT /component-documents/:id',
    ]) expect(components).toContain(route);
    const bulk = routeTable('server/modules/bulk-upload/routes.ts');
    expect(bulk).toContain('POST /bulk/import');
    expect(bulk).toContain('POST /bulk/import-stream');
    const fleet = routeTable('server/modules/fleet/routes.ts');
    expect(fleet).not.toContain('POST /fleet/vessel-mappings');
    for (const route of [
      'GET /fleet/vessel-mappings', 'DELETE /fleet/vessel-mappings/:id',
      'POST /fleet-admin/fleet-vessel-mappings',
      'GET /fleet-admin/fleet-vessel-mappings',
      'GET /fleet-admin/fleet-vessel-mappings/by-equipment/:code',
      'GET /fleet-admin/fleet-vessel-mappings/by-vessel/:vesselCode',
    ]) expect(fleet).toContain(route);
  });

  it('removes the three storage contracts, preserving supported storage operations', () => {
    for (const [file, owner] of [
      ['server/storage.ts', 'IStorage'],
      ['server/postgresStorage.ts', 'PostgresStorage'],
    ]) {
      const names = memberNames(file, owner);
      for (const name of [
        'createWorkOrderExecution', 'bulkUpsertComponents', 'createFleetVesselMappings',
      ]) expect(names).not.toContain(name);
      for (const name of [
        'createComponent', 'bulkCreateComponents', 'bulkUpdateComponents',
        'createFleetVesselMappingRecord', 'getWorkOrderExecutions',
        'getWorkOrderExecutionById', 'updateWorkOrderExecution',
        'createWorkOrderExecutionDetail', 'getFleetVesselMappings',
        'deleteFleetVesselMapping',
      ]) expect(names).toContain(name);
    }
    expect(memberNames('server/services/workOrderService.ts', 'WorkOrderService'))
      .toContain('getWorkOrderExecution');
  });

  it('removes wrappers and upload modules without importing any application chain', () => {
    for (const file of [
      'server/modules/components/controllers/componentUploadController.ts',
      'server/modules/components/services/componentUploadService.ts',
    ]) expect(existsSync(file)).toBe(false);
    for (const [file, removed] of [
      ['server/modules/work-orders/controllers/workOrderController.ts', 'createExecution'],
      ['server/modules/work-orders/services/executionService.ts', 'createExecution'],
      ['server/modules/work-orders/repositories/workOrderRepository.ts', 'createExecution'],
      ['server/modules/components/repositories/componentRepository.ts', 'bulkUpsert'],
      ['server/modules/fleet/controllers/fleetController.ts', 'createFleetVesselMappings'],
      ['server/modules/fleet/services/fleetService.ts', 'createFleetVesselMappings'],
      ['server/modules/fleet/repositories/fleetRepository.ts', 'createFleetVesselMappings'],
    ]) {
      const names = ast(file).statements
        .filter(ts.isFunctionDeclaration).map(node => node.name?.text);
      expect(names).not.toContain(removed);
    }
    expect(memberNames('server/services/workOrderService.ts', 'WorkOrderService'))
      .not.toContain('createWorkOrderExecution');
    expect(memberNames('server/services/componentService.ts', 'ComponentService'))
      .not.toContain('bulkUpsertComponents');
    expect(read('server/modules/components/routes.ts')).toContain('multer.memoryStorage()');
    expect(read('server/modules/components/routes.ts')).toContain('10 * 1024 * 1024');
    expect(read('server/modules/work-orders/services/executionService.ts'))
      .not.toContain('linkDocumentsToExecution');
  });

  it('keeps the existing JSON API 404 ahead of both SPA fallbacks', () => {
    const routes = read('server/routes.ts');
    expect(routes).toMatch(/app\.use\('\/technical\/api',[\s\S]*?res\.status\(404\)\.json\(\{ error: 'API route not found', path: req\.path \}\)/);
    const entry = read('server/index.ts');
    const register = entry.indexOf('await registerRoutes(app)');
    expect(register).toBeGreaterThan(-1);
    expect(entry.indexOf('await setupVite(', register)).toBeGreaterThan(register);
    expect(entry.indexOf('serveStatic(', register)).toBeGreaterThan(register);
  });
});
