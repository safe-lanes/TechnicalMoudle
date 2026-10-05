import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getVessels: vi.fn(),
  getSpares: vi.fn(),
  getStoresItems: vi.fn(),
}));
vi.mock('../repositories/reportRepository', () => repo);
vi.mock('../../../db', () => ({
  getDb: vi.fn(() => { throw new Error('These read-only fixture tests must not access a database'); }),
}));

import { getIhmInventoryStatus, exportIhmInventoryStatusExcel } from '../services/complianceReportService';

const root = process.cwd();
const maintenancePath = 'client/src/pages/reports/MaintenanceReports.tsx';
const formPath = 'client/src/components/admin/FormConfigurationModal.tsx';
const archivePath = 'client/src/pages/_archived/change-requests/ChangeRequestsLogWithTabs.tsx';
const source = (file: string) => readFileSync(path.join(root, file), 'utf8');

// Exercise the actual local functions without mounting unrelated application
// providers. AST extraction avoids copying the implementation into the test.
function initializer(file: string, name: string): string {
  const tree = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      expression = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!expression) throw new Error(`Missing initializer: ${name}`);
  return ts.transpileModule(`(${expression.getText(tree)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.getVessels.mockResolvedValue([
    { id: 'vessel-a', name: 'Vessel A' },
    { id: 'vessel-b', name: 'Vessel B' },
  ]);
  repo.getSpares.mockImplementation(async (vesselId: string) => [
    { id: 17, spuuid: `${vesselId}-spare`, vesselId, partCode: `${vesselId}-PART`,
      partName: 'Pump spare', ihmPresence: 'YES', rob: 4 },
    { id: 18, vesselId, partCode: 'DELETED', ihmPresence: 'YES', deleted: true },
    { id: 19, vesselId, partCode: 'FLEET', ihmPresence: 'YES', dataScope: 'fleet' },
    { id: 20, vesselId, partCode: 'NO-IHM', ihmPresence: 'NO' },
  ]);
  repo.getStoresItems.mockImplementation(async (vesselId: string) => [
    { id: 17, suuid: `${vesselId}-store`, vesselId, itemCode: `${vesselId}-STORE`,
      itemName: 'Paint', ihmPresence: 'Present', rob: '3', itemType: 'stores' },
    { id: 18, vesselId, itemCode: 'INACTIVE', ihmPresence: 'Present', isActive: false },
  ]);
});

describe('IHM report identities and unchanged read-only exports', () => {
  it('keeps UUIDs, item kinds and colliding local IDs distinct on the selected vessel', async () => {
    const result = await getIhmInventoryStatus('vessel-a');
    expect(result.items).toHaveLength(2);
    expect(result.items.find(item => item.itemType === 'spare')).toMatchObject({
      id: 17, spareId: 'vessel-a-spare', vesselId: 'vessel-a', vesselName: 'Vessel A',
    });
    expect(result.items.find(item => item.itemType === 'store')).toMatchObject({
      id: 1000017, itemId: 'vessel-a-store', vesselId: 'vessel-a', vesselName: 'Vessel A',
    });
    expect(repo.getSpares).toHaveBeenCalledWith('vessel-a');
    expect(repo.getStoresItems).toHaveBeenCalledWith('vessel-a');
  });

  it('preserves numeric spare and numeric/string store fallback identities', async () => {
    repo.getSpares.mockResolvedValue([{ id: 17, vesselId: 'vessel-a', ihmPresence: 'YES' }]);
    repo.getStoresItems.mockResolvedValue([
      { id: 17, vesselId: 'vessel-a', ihmPresence: 'Present' },
      { id: 18, storeItemId: 'legacy-store', vesselId: 'vessel-a', ihmPresence: 'Present' },
    ]);
    const result = await getIhmInventoryStatus('vessel-a');
    expect(result.items.find(item => item.itemType === 'spare')?.spareId).toBe(17);
    expect(result.items.filter(item => item.itemType === 'store').map(item => item.itemId))
      .toEqual([17, 'legacy-store']);
  });

  it('keeps all-vessel selection scoped to the requested vessel subset', async () => {
    const result = await getIhmInventoryStatus('all', 'all', 'all', '', 'itemCode', 'asc', 1, 50, ['vessel-b']);
    expect(result.items).toHaveLength(2);
    expect(result.items.every(item => item.vesselId === 'vessel-b')).toBe(true);
    expect(repo.getSpares).toHaveBeenCalledTimes(1);
    expect(repo.getSpares).toHaveBeenCalledWith('vessel-b');
  });

  it('retains item-type/search filters and emits both spare/store rows in Excel', async () => {
    const filtered = await getIhmInventoryStatus('vessel-a', 'all', 'store', 'Paint');
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].itemId).toBe('vessel-a-store');
    const exported = await exportIhmInventoryStatusExcel('all', 'all', 'all', '', '', ['vessel-b']);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.buffer);
    const cells: string[] = [];
    workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => cells.push(String(cell.value)))));
    expect(cells).toContain('vessel-b-PART');
    expect(cells).toContain('vessel-b-STORE');
    expect(cells).not.toContain('vessel-a-PART');
    expect(cells).not.toContain('DELETED');
    expect(cells).not.toContain('INACTIVE');
  });
});

describe('critical-equipment metadata from the actual filtered report flow', () => {
  const rows = [
    { componentCode: 'PUMP-A', componentName: 'Pump', department: 'Engine', isCritical: 'Yes',
      isClassItem: 'No', overdueJobs: 3, totalWorkOrders: 8, dueSoonJobs: 1, nextDueDate: null, daysUntilDue: null },
    { componentCode: 'PUMP-B', componentName: 'Pump', department: 'Engine', isCritical: 'Yes',
      isClassItem: 'Yes', overdueJobs: 2, totalWorkOrders: 6, dueSoonJobs: 0, nextDueDate: null, daysUntilDue: null },
    { componentCode: 'CRANE-A', componentName: 'Crane', department: 'Deck', isCritical: 'No',
      isClassItem: 'Yes', overdueJobs: 9, totalWorkOrders: 12, dueSoonJobs: 0, nextDueDate: null, daysUntilDue: null },
  ];

  function report(data = rows, component = '', department = '', dateRange: { from: Date | null; to: Date | null } = { from: null, to: null }) {
    const generateCriticalEquipmentReport = vi.fn();
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({
      data, metadata: { totalOverdueJobs: 999, totalTrackedWorkOrders: 999 },
    }) }));
    const generate = runInNewContext(initializer(maintenancePath, 'generateMaintenancePDF'), {
      globalFilters: { vessels: ['vessel-a'], component, department, dateRange },
      effectiveVesselId: 'vessel-a', categoryFilters: { dateRange },
      vessels: [{ id: 'vessel-a', name: 'Vessel A' }], filteredWorkOrders: [],
      fetch, pdfReportGenerator: { generateCriticalEquipmentReport },
      formatDate: (value: string) => value,
      formatReportDateRange: () => 'All Time',
      toLocalDateStr: (value: Date) => value.toISOString().slice(0, 10),
    });
    return { generate, generateCriticalEquipmentReport, fetch };
  }

  it('sums work orders rather than equipment counts and ignores unfiltered server totals', async () => {
    const fixture = report(rows, 'pump', 'Engine');
    await fixture.generate('critical-equipment', 'download');
    const [, , data, metadata] = fixture.generateCriticalEquipmentReport.mock.calls[0];
    expect(data).toHaveLength(2);
    expect(metadata).toMatchObject({
      totalCriticalEquipment: 2, equipmentWithOverdue: 2, totalOverdueJobs: 5, totalTrackedWorkOrders: 14,
    });
  });

  it('uses the same filtered work-order totals in preview without triggering a PDF download', async () => {
    const fixture = report(rows, 'pump', 'Engine');
    const preview = await fixture.generate('critical-equipment', 'preview');
    expect(preview.data).toHaveLength(2);
    expect(preview.summary).toContainEqual({ label: 'Total Overdue WOs', value: 5 });
    expect(preview.summary).toContainEqual({ label: 'Total Tracked WOs', value: 14 });
    expect(fixture.generateCriticalEquipmentReport).not.toHaveBeenCalled();
  });

  it('retains date-range query parameters while calculating component-filtered totals', async () => {
    const fixture = report(rows, 'PUMP-A', '', {
      from: new Date('2026-09-01T12:00:00Z'), to: new Date('2026-09-30T12:00:00Z'),
    });
    await fixture.generate('critical-equipment', 'download');
    expect(fixture.fetch).toHaveBeenCalledWith(
      '/technical/api/reports/critical-equipment-status?vesselId=vessel-a&startDate=2026-09-01&endDate=2026-09-30'
    );
    expect(fixture.generateCriticalEquipmentReport.mock.calls[0][3]).toMatchObject({
      totalCriticalEquipment: 1, totalOverdueJobs: 3, totalTrackedWorkOrders: 8,
    });
  });

  it.each(['empty', 'filtered-out', 'no-overdue'])('calculates valid totals for %s data', async kind => {
    const data = kind === 'empty' ? [] : kind === 'no-overdue' ? [{ ...rows[0], overdueJobs: 0 }] : rows;
    const fixture = report(data, kind === 'filtered-out' ? 'missing-component' : '');
    await fixture.generate('critical-equipment', 'download');
    const metadata = fixture.generateCriticalEquipmentReport.mock.calls[0][3];
    expect(metadata.totalOverdueJobs).toBe(0);
    expect(metadata.totalTrackedWorkOrders).toBe(kind === 'no-overdue' ? 8 : 0);
    expect(metadata.equipmentWithOverdue).toBe(0);
  });
});

describe('local form-version snapshots retain the existing section map', () => {
  it('saves and restores multiple sections, deletion flags and labels without a storage migration', () => {
    const fields = { A: [{ id: 'a', label: 'Maker' }], B: [{ id: 'b', label: 'Notes' }], custom: [] };
    const sandbox = {
      versions: [], versionComment: 'Fixture version', formName: 'Component Register',
      fieldLabels: { maker: 'Manufacturer' }, deletedFields: new Set(['rating']),
      customFields: fields, customSections: [{ id: 'custom' }], componentData: { name: 'Pump' },
      setVersions: vi.fn(), setCurrentVersionId: vi.fn(), setShowSaveVersion: vi.fn(),
      setVersionComment: vi.fn(), toast: vi.fn(), localStorage: { setItem: vi.fn() },
      setFieldLabels: vi.fn(), setDeletedFields: vi.fn(), setCustomFields: vi.fn(),
      setCustomSections: vi.fn(), setComponentData: vi.fn(), setShowVersionHistory: vi.fn(),
    };
    runInNewContext(initializer(formPath, 'saveVersion'), sandbox)();
    const version = sandbox.setVersions.mock.calls[0][0][0];
    expect(version.customFields).toEqual(fields);
    expect(Array.isArray(version.customFields)).toBe(false);
    const [key, serialized] = sandbox.localStorage.setItem.mock.calls[0];
    expect(key).toBe('form-versions-Component Register');
    expect(JSON.parse(serialized)[0]).toMatchObject({
      customFields: fields, deletedFields: ['rating'], fieldLabels: sandbox.fieldLabels,
    });
    runInNewContext(initializer(formPath, 'loadVersion'), sandbox)(version);
    expect(sandbox.setCustomFields).toHaveBeenCalledWith(fields);
    expect(sandbox.setFieldLabels).toHaveBeenCalledWith(sandbox.fieldLabels);
    expect(Array.from(sandbox.setDeletedFields.mock.calls[0][0])).toEqual(['rating']);
    expect(source(formPath)).not.toMatch(/localStorage\.getItem/);
  });
});

describe('archived imports resolve without activating the screen', () => {
  it('resolves all five imports to existing active implementations', () => {
    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const tree = ts.createSourceFile(archivePath, source(archivePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const targets = tree.statements.filter(ts.isImportDeclaration)
      .map(node => ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '')
      .filter(name => name.startsWith('@/pages/change-requests/'));
    expect(targets).toHaveLength(5);
    for (const target of targets) {
      const result = ts.resolveModuleName(target, path.join(root, archivePath), options, ts.sys);
      expect(result.resolvedModule?.resolvedFileName).toBe(path.join(root, `${target.replace('@/', 'client/src/')}.tsx`));
    }
  });

  it('has no import or route reference outside the archive', () => {
    function checkDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '_archived') continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) checkDirectory(file);
        else if (/\.[jt]sx?$/.test(entry.name)) {
          expect(readFileSync(file, 'utf8'), file).not.toContain('ChangeRequestsLogWithTabs');
        }
      }
    }
    checkDirectory(path.join(root, 'client/src'));
  });
});
