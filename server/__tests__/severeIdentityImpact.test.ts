import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const probe = createRequire(import.meta.url)('./helpers/severeSourceProbe.cjs');
const storagePath = 'server/postgresStorage.ts';
const inventoryPath = 'server/modules/spares/services/inventoryService.ts';
const documentPath = 'server/modules/work-orders/controllers/woDocumentController.ts';

class ValidationError extends Error {
  constructor(message: string, public details?: unknown) { super(message); }
}

describe('severe review: isolated source probes (not full API/database tests)', () => {
  it('denies imports not explicitly supplied and has no network/process globals', () => {
    expect(() => probe.evaluate("require('../db')")).toThrow('blocked import');
    expect(probe.evaluate('module.exports = [typeof fetch, typeof process];'))
      .toEqual(['undefined', 'undefined']);
  });

  it('factory UUID belongs to the factory, including when callers supply one', async () => {
    const insert = vi.fn((data: unknown) => ({ returning: async () => [data] }));
    const Factory = probe.method('createComponent', {
      getDb: async () => ({ insert: () => ({ values: insert }) }),
      components: {}, randomUUID: () => 'component-canonical',
    });
    for (const cuuid of [undefined, 'caller-disposable']) {
      const result = await new Factory().createComponent({ name: 'Pump', id: 'local-7', cuuid });
      expect(result).toMatchObject({ id: 'local-7', cuuid: 'component-canonical' });
    }
  });

  it('candidate factory input declaration emits identical executable method', () => {
    const before = probe.methodText('createComponent');
    const after = before.replace('component: InsertComponent',
      "component: Omit<InsertComponent, 'cuuid'> & { cuuid?: string }");
    expect(after).not.toBe(before);
    expect(probe.compile(`class Factory { ${after} }`))
      .toBe(probe.compile(`class Factory { ${before} }`));
  });

  function inventory(candidate = false, spareId = 7, locationId = 10) {
    const spare = { id: spareId, suuid: 'spare-canonical', vesselId: 'ship-A', isDeleted: false };
    const upsert = vi.fn(async (row: unknown) => row);
    const locationLookup = vi.fn(async () => ({ id: locationId, vesselId: 'ship-A' }));
    let text = probe.functionText(inventoryPath, 'requireOperationalSpare')
      + '\n' + probe.functionText(inventoryPath, 'upsertStock');
    if (candidate) {
      text = text.replace('await requireOperationalSpare(spareId, vesselId);',
        'const spare = await requireOperationalSpare(spareId, vesselId);')
        .replace('    spareId,', '    spareId,\n    spareUuid: spare.suuid,');
    }
    return {
      spare, upsert, spareId, locationId, locationLookup,
      run: probe.exported(text, 'upsertStock', {
        repo: { getSpare: async () => spare, upsertSpareLocationStock: upsert,
          getLocationById: locationLookup },
      }),
    };
  }

  it.fails('[KNOWN DEFECT] current stock caller should supply verified parent UUID', async () => {
    const f = inventory();
    await f.run(f.spareId, f.locationId, { qty: 4, vesselId: 'ship-A' });
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ spareUuid: 'spare-canonical' }));
  });

  it.each([[7, 10], [700, 1000]])(
    'in-memory stock candidate keeps canonical parent across local IDs %s/%s', async (spareId, locationId) => {
      const f = inventory(true, spareId, locationId);
      expect(await f.run(spareId, locationId, { qty: 4, vesselId: 'ship-A' }))
        .toEqual({ spareId, locationId, qty: 4, vesselId: 'ship-A', spareUuid: 'spare-canonical' });
    },
  );

  it.each([false, true])('stock guard retains rejection before writes (candidate %s)', async candidate => {
    const f = inventory(candidate);
    await expect(f.run(7, 10, { qty: 4, vesselId: 'ship-B' })).rejects.toThrow('Access denied');
    f.spare.isDeleted = true;
    await expect(f.run(7, 10, { qty: 4, vesselId: 'ship-A' })).rejects.toThrow('not found');
    expect(f.upsert).not.toHaveBeenCalled();
  });

  it('new stock enforces mocked NOT NULL; existing quantity update retains UUID and logging', async () => {
    let existing: any = null;
    const log = vi.fn();
    const db = {
      insert: () => ({ values: (row: any) => ({ returning: async () => {
        if (!row.spareUuid) throw new Error('Fixture: spare_uuid NOT NULL');
        return [{ ...row, slsuuid: 'stock-canonical' }];
      } }) }),
      update: () => ({ set: (row: any) => ({ where: () => ({
        returning: async () => [{ ...existing, ...row }],
      }) }) }),
    };
    const Stock = probe.method('upsertSpareLocationStock', {
      getDb: async () => db, spareLocationStock: { id: 'id' }, eq: (...args: unknown[]) => args,
      logFieldChanges: log,
    });
    const stock = new Stock();
    stock.getLocationById = async () => ({ luuid: 'location-canonical' });
    stock.getSpareLocationStockItem = async () => existing;
    const input = { vesselId: 'ship-A', spareId: 7, locationId: 10, qty: 4 };
    await expect(stock.upsertSpareLocationStock(input)).rejects.toThrow('NOT NULL');
    expect(log).not.toHaveBeenCalled();
    existing = { ...input, id: 90, qty: 2, spareUuid: 'spare-canonical', slsuuid: 'stock-canonical' };
    expect(await stock.upsertSpareLocationStock(input)).toMatchObject({
      spareUuid: 'spare-canonical', qty: 4, locationUuid: 'location-canonical',
    });
    expect(log).toHaveBeenCalledWith('spare_location_stock', 'stock-canonical', 'ship-A',
      existing, expect.objectContaining({ qty: 4 }), 'system');
  });

  it('UUID-only candidate still does not establish location ownership', async () => {
    const f = inventory(true);
    f.locationLookup.mockResolvedValue({ id: 10, vesselId: 'ship-B' });
    // The caller never reads a location. A supplied parent UUID is not an
    // ownership proof, even when that location exists in another vessel.
    f.upsert.mockImplementation(async (row: any) => ({
      ...row, locationUuid: 'location-from-ship-B',
    }));
    const row = await f.run(7, 10, { qty: 4, vesselId: 'ship-A' });
    expect(row).toMatchObject({ vesselId: 'ship-A', locationUuid: 'location-from-ship-B' });
    expect(f.locationLookup).not.toHaveBeenCalled();
  });

  function deletion(status: string | null, candidate = false, parentVessel = 'ship-A') {
    const remove = vi.fn(), lookup = vi.fn(async () => status ? { status, vesselId: parentVessel } : undefined);
    const text = probe.functionText(documentPath, 'deleteDocument');
    const run = probe.exported(candidate ? text.replaceAll('workOrderUuid', 'workOrderId') : text,
      'deleteDocument', {
        findDocById: async () => ({ workOrderId: 'wo-canonical', vesselId: 'ship-A' }),
        woRepo: { findById: lookup }, woDocService: { deleteDocument: remove },
        isCompletedStatus: (value: string) => value.toLowerCase() === 'completed',
      });
    const res = { code: 200, status(code: number) { this.code = code; return this; }, json: vi.fn() };
    return { remove, lookup, res, run: () => run({ params: { documentId: 'doc-1' } }, res) };
  }

  it.fails('[KNOWN DEFECT] current completed-parent deletion should be blocked', async () => {
    const f = deletion('Completed');
    await f.run();
    expect(f.remove).not.toHaveBeenCalled();
  });

  it('in-memory field correction blocks completed parents before any deletion', async () => {
    const f = deletion('Completed', true);
    await f.run();
    expect(f.lookup).toHaveBeenCalledWith('wo-canonical');
    expect(f.remove).not.toHaveBeenCalled();
    expect(f.res.code).toBe(403);
  });

  it.each(['In Progress', null])('field-only candidate retains deletion for parent %s', async status => {
    const f = deletion(status, true);
    await f.run();
    expect(f.remove).toHaveBeenCalledWith('doc-1');
    expect(f.res.code).toBe(200); // Orphan behavior remains an unapproved policy decision.
  });

  it('field-only document candidate does not validate parent/document vessel agreement', async () => {
    const f = deletion('In Progress', true, 'ship-B');
    await f.run();
    expect(f.remove).toHaveBeenCalledWith('doc-1');
    expect(f.res.code).toBe(200);
  });

  it.each([[null, null, true], ['ship-A', 'ship-A', true], ['ship-A', 'ship-B', false]])(
    'inheritance direct-ID behavior child %s/master %s is preserved', async (childVessel, masterVessel, allowed) => {
      const lookup = probe.exported(probe.functionText(
        'server/modules/components/repositories/componentRepository.ts', 'findByIdOrCode'),
      'findByIdOrCode', {
        storage: {
          getComponent: async () => ({ vesselId: masterVessel, rhCounterType: 'MASTER' }),
          getComponentByCode: () => { throw new Error('Unexpected code fallback'); },
        },
        augmentWithSortOrder: async (rows: unknown[]) => rows,
      });
      const run = probe.exported(`async function probe(id, data, existingComponent) {
        ${probe.inheritanceGuard()}
      }`, 'probe', { repo: { findByIdOrCode: lookup }, ValidationError });
      const result = run('child', { rhCounterType: 'INHERITED', rhMasterComponentId: 'master' },
        { vesselId: childVessel });
      if (allowed) await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow('same vessel');
    },
  );

  it('numbering already rejects null vessel without allocation/storage reads', async () => {
    const numbering = probe.evaluate(probe.source('server/utils/workOrderNumbering.ts'), {},
      { '../modules/shared/errors': { ValidationError } });
    const getVessel = vi.fn();
    await expect(numbering.generateUnplannedWorkOrderNumber({ getVessel }, null, 'C1'))
      .rejects.toThrow('Vessel ID is required');
    expect(getVessel).not.toHaveBeenCalled();
  });

  it('component lookup with null vessel builds all-vessel predicate, not a scoped one', async () => {
    let predicate: unknown;
    const Lookup = probe.method('getComponents', {
      getDb: async () => ({ select: () => ({ from: () => ({ where: async (value: unknown) => {
        predicate = value; return [];
      } }) }) }),
      components: { vesselId: 'vessel_id', dataScope: 'data_scope', isDeleted: 'is_deleted' },
      eq: (...args: unknown[]) => args, and: (...args: unknown[]) => args,
      or: (...args: unknown[]) => args, isNull: (value: unknown) => value,
    });
    await new Lookup().getComponents(null);
    expect(JSON.stringify(predicate)).not.toContain('vessel_id');
    await new Lookup().getComponents('ship-A');
    expect(JSON.stringify(predicate)).toContain('vessel_id');
  });

  it.each([[null, null, null], ['ship-A', 'ship-B', 'ship-A']])(
    'legacy audit expression exposes vessel policy for %s/%s', async (woVessel, componentVessel, expected) => {
      const call = probe.extract('server/services/workOrderService.ts', (node: any) =>
        probe.ts.isCallExpression(node) && node.expression.getText() === 'storage.createRunningHoursAudit');
      const write = vi.fn();
      const run = probe.exported(`async function probe(wo, component) {
        const previousRH=100, runningHours=120, completionDate='2026-01-01', updatesAny={};
        await ${call};
      }`, 'probe', { storage: { createRunningHoursAudit: write } });
      await run({ id: 'wo-local', vesselId: woVessel }, { cuuid: 'component-canonical', vesselId: componentVessel });
      expect(write).toHaveBeenCalledWith(expect.objectContaining({ vesselId: expected, newRH: '120' }));
    },
  );

  it('legacy feedback uses the actual component name and preserves code fallbacks', () => {
    const prop = probe.extract('server/services/workOrderService.ts', (node: any) =>
      probe.ts.isPropertyAssignment(node) && node.name.getText() === 'componentName'
      && node.initializer.getText().includes('component.name || component.componentCode'));
    const expression = prop.slice(prop.indexOf(':') + 1);
    for (const [name, expected] of [['Main Pump', 'Main Pump'], [null, 'C1'], ['', 'C1']]) {
      const context = { component: { name, componentCode: 'C1' }, existingWO: {} };
      expect(probe.evaluate(`module.exports=${expression}`, context)).toBe(expected);
    }
  });

  it('generic PATCH history guard treats SKIPPED as existing history (block-level reproduction)', async () => {
    const skipped = { workOrderId: 'wo-canonical', status: 'SKIPPED', isSkipped: true };
    const Lookup = probe.method('getMaintenanceHistoryByWorkOrderId', {
      getDb: async () => ({ select: () => ({ from: () => ({
        where: async () => [skipped],
      }) }) }),
      componentMaintenanceHistory: { workOrderId: 'work_order_id' },
      eq: (...args: unknown[]) => args,
    });
    const existingHistory = await new Lookup().getMaintenanceHistoryByWorkOrderId('wo-canonical');
    const text = probe.extract('server/modules/work-orders/services/workOrderService.ts', (node: any) =>
      probe.ts.isIfStatement(node) && node.expression.getText() === 'existingHistory'
      && node.getText().includes('freshWorkOrder.id'));
    const createMaintenanceHistory = vi.fn();
    await probe.exported(`async function probe() { ${text} }`, 'probe', {
      existingHistory, freshWorkOrder: { id: 'wo-local' },
      repo: { createMaintenanceHistory },
    })();
    expect(existingHistory.status).toBe('SKIPPED');
    expect(createMaintenanceHistory).not.toHaveBeenCalled();
  });
});
