import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../modules/shared/errors';
import { ensureCompletedWorkOrderDate } from '../modules/work-orders/utils/completedWorkOrderDate';
import * as readingDate from '../modules/running-hours/utils/readingDate';

const p = createRequire(import.meta.url)('./helpers/lowImpactProbe.cjs');
const ranksFile = 'server/modules/ranks/service.ts';
const woFile = 'server/modules/work-orders/services/workOrderService.ts';
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const node = (nodeUuid: string, rankId: string, parentNodeUuid: string | null = null, isAssigned = true) =>
  ({ nodeUuid, rankId, parentNodeUuid, isAssigned });

describe('full rank scope and downstream work-order filtering', () => {
  function scopeRunner(nodes: unknown[], candidate: boolean) {
    const calls: string[] = [];
    const resolve = p.fn(ranksFile, 'resolveHierarchyScopeByRankId', {
      repo: { getVesselOrgChartNodes: async (vesselId: string) => { calls.push(vesselId); return nodes; } },
    }, candidate, {}, p.probe.functionText(ranksFile, 'createHttpError'));
    return { resolve, calls };
  }

  it.each([
    ['no mapping', [], [], [], false],
    ['unassigned self', [node('me', 'r-me', null, false)], [], [], false],
    ['self only', [node('me', 'r-me')], ['me'], ['r-me'], false],
    ['descendants, repeated ranks and unassigned node', [
      node('me', 'r-me'), node('child-a', 'r-child', 'me'), node('child-b', 'r-child', 'me'),
      node('leaf', 'r-leaf', 'child-a'), node('unassigned', 'r-other', 'me', false),
    ], ['me', 'child-b', 'child-a', 'leaf'], ['r-me', 'r-child', 'r-leaf'], true],
    ['cycle', [node('me', 'r-me', 'child'), node('child', 'r-child', 'me')],
      ['me', 'child'], ['r-me', 'r-child'], true],
    ['multiple self assignments', [node('me-a', 'r-me'), node('me-b', 'r-me'),
      node('child', 'r-child', 'me-a')],
      ['me-b', 'me-a', 'child'], ['r-me', 'r-child'], true],
  ])('preserves complete scope for %s', async (_name, nodes, uuids, rankIds, descendants) => {
    const before = scopeRunner(nodes as unknown[], false);
    const after = scopeRunner(nodes as unknown[], true);
    const result = plain(await after.resolve('ship-A', 'r-me'));
    expect(result).toEqual(plain(await before.resolve('ship-A', 'r-me')));
    expect(result.myTeam).toEqual({ nodeUuids: uuids, rankIds });
    expect(result.hasDescendants).toBe(descendants);
    expect(result.hasMapping).toBe((uuids as string[]).length > 0);
    expect(after.calls).toEqual(['ship-A']);
    expect(before.calls).toEqual(after.calls);
    expect(result.me.rankIds).toEqual((uuids as string[]).length ? ['r-me'] : []);
  });

  it.each([[undefined, 'r-me', 'vesselId required'], ['ship-A', undefined, 'rankId required']])(
    'preserves missing-input rejection without repository reads', async (vessel, rank, message) => {
      for (const candidate of [false, true]) {
        const f = scopeRunner([], candidate);
        await expect(f.resolve(vessel, rank)).rejects.toMatchObject({ message, statusCode: 400 });
        expect(f.calls).toEqual([]);
      }
    },
  );

  it.each(['me', 'myTeam'])('preserves %s work-order visibility and metadata', async mode => {
    async function run(candidate: boolean) {
      const f = scopeRunner([
        node('me', 'r-me'), node('child', 'r-child', 'me'), node('unassigned', 'r-other', 'me', false),
      ], candidate);
      const ranks = [
        { rankId: 'r-me', name: 'Chief Engineer', label: 'Chief' },
        { rankId: 'r-child', name: 'Second Engineer', label: 'Second' },
        { rankId: 'r-other', name: 'Master' },
      ];
      const calls: unknown[] = [];
      const imports = { '../../ranks/service': {
        resolveHierarchyScopeByRankName: async (vessel: string, name: string) => {
          calls.push(['scope', vessel, name]);
          return f.resolve(vessel, 'r-me');
        },
        getAllRanks: async () => ranks,
      } };
      const prefix = ['filterWorkOrdersByRankId', 'buildScopeRankNameSet', 'hasVesselWideAccess']
        .map(name => p.probe.functionText(woFile, name)).join('\n');
      const execute = p.fn(woFile, 'getScopedOperationData', {
        listWorkOrders: async (vessel: string) => {
          calls.push(['workOrders', vessel]);
          return [
            { wouuid: 'own', assignedToRankId: 'r-me' },
            { wouuid: 'child', assignedToRankId: 'r-child' },
            { wouuid: 'name-fallback', assignedToRankId: null, assignedTo: ' SECOND ' },
            { wouuid: 'outside', assignedToRankId: 'r-other', assignedTo: 'Master' },
            { wouuid: 'unassigned', assignedToRankId: null, assignedTo: 'Unassigned' },
          ];
        },
      }, candidate, imports, prefix);
      return plain({ result: await execute('ship-A', 'r-me', mode, 'Ship', 'ship-A', 'Chief Engineer'), calls });
    }
    const after = await run(true);
    expect(after).toEqual(await run(false));
    expect(after.result.workOrders.map((wo: any) => wo.wouuid))
      .toEqual(mode === 'me' ? ['own'] : ['own', 'child', 'name-fallback']);
    expect(after.result.scopeMeta).toEqual({
      hasMapping: true, hasDescendants: true, mode,
      appliedRankIds: mode === 'me' ? ['r-me'] : ['r-me', 'r-child'],
      vesselWideAccessGranted: true, fallbackMode: null,
    });
    expect(after.calls).toEqual([['scope', 'ship-A', 'Chief Engineer'], ['workOrders', 'ship-A']]);
  });
});

describe('full legacy work-order update keeps RH validation and audit isolation', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T09:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  async function run(candidate: boolean, input: Record<string, unknown>, componentOverride = {}, failAudit = false) {
    const component = {
      id: 'local-component', cuuid: 'component-canonical', name: 'Pump', componentCode: '601',
      vesselId: 'ship-A', currentCumulativeRH: '90', rhCurrentMaster: '90', rhCounterType: 'MASTER',
      ...componentOverride,
    };
    const wo = {
      id: 'local-wo', wouuid: 'wo-canonical', workOrderNo: 'WO-1',
      status: 'In Progress', component: 'Pump', componentCode: '601', vesselId: 'ship-A',
    };
    const writes: unknown[] = [];
    const audits: unknown[] = [];
    const validationCalls: unknown[] = [];
    const liveWrites = vi.fn(() => { throw Error('Live RH mutation forbidden'); });
    const storage = {
      getWorkOrder: async () => wo,
      getComponents: async () => [component],
      updateWorkOrder: async (id: string, update: unknown) => {
        writes.push([id, plain(update)]);
        return { ...wo, ...(update as object) };
      },
      createRunningHoursAudit: async (audit: unknown) => {
        audits.push(plain(audit));
        if (failAudit) throw Error('Fixture audit outage');
      },
      setComponentRunningHours: liveWrites,
      updateComponent: liveWrites,
    };
    const Subject = p.method('updateWorkOrder', { storage, ValidationError, ensureCompletedWorkOrderDate },
      candidate, 'server/services/workOrderService.ts', {
        '../modules/running-hours/services/rhTimelineValidationService': {
          validateRHEntry: async (...args: unknown[]) => {
            validationCalls.push(args);
            return { isValid: true, validRange: { min: 0, max: 90 },
              utilizationRate: 0, requiresJustification: false, anomalyFlags: [] };
          },
        },
        '../modules/running-hours/utils/readingDate': readingDate,
      });
    let error;
    let result;
    try { result = await new Subject().updateWorkOrder('request-wo', { ...input }); }
    catch (err: any) {
      error = { name: err.name, message: err.message, statusCode: err.statusCode,
        code: err.code, details: err.details };
    }
    expect(liveWrites).not.toHaveBeenCalled();
    return plain({ result, error, writes, audits, validationCalls });
  }

  it.each([
    [{ name: 'Pump' }, 'Pump'],
    [{ name: null }, '601'],
    [{ name: '' }, '601'],
    [{ rhCounterType: 'INHERITED', rhCurrentInheritedCached: '75' }, 'Pump'],
  ])('changes only the label when rejecting excessive RH for %j', async (component, label) => {
    const input = { status: 'Pending Approval', currentReading: '100', dateOfCompletion: '2026-10-05' };
    const before = await run(false, input, component);
    const after = await run(true, input, component);
    expect(after.error.details.componentName).toBe(label);
    const correctedBefore = { ...before,
      error: { ...before.error, details: { ...before.error.details, componentName: label } } };
    expect(after).toEqual(correctedBefore);
    expect(after.error.statusCode).toBe(400);
    expect(after.error.details.code).toBe('INVALID_RUNNING_HOURS');
    expect(after.error.details.componentId).toBe('component-canonical');
    expect(after.error.details.componentCode).toBe('601');
    expect(after.writes).toEqual([]);
    expect(after.audits).toEqual([]);
    expect(after.validationCalls).toEqual([]);
  });

  it.each(['80', '90'])('keeps valid RH %s audit-only and canonicalizes the date', async currentReading => {
    const input = { status: 'Pending Approval', currentReading,
      dateOfCompletion: '05-Oct-2026', performedBy: 'Engineer' };
    const before = await run(false, input);
    const after = await run(true, input);
    expect(after).toEqual(before);
    expect(after.error).toBeUndefined();
    expect(after.writes).toHaveLength(1);
    expect(after.audits).toEqual([{
      componentId: 'component-canonical', vesselId: 'ship-A', previousRH: '90',
      newRH: currentReading, cumulativeRH: currentReading, dateUpdatedLocal: '2026-10-05',
      dateUpdatedTZ: 'UTC', enteredAtUTC: '2026-10-05T09:00:00.000Z', userId: 'Engineer',
      source: 'workorder', notes: 'RH snapshot via WO save: WO-1 (ISOLATED)', meterReplaced: false,
    }]);
    expect(after.validationCalls).toEqual([['component-canonical', '2026-10-05', Number(currentReading)]]);
  });

  it('malformed supplied date still rejects before any audit or update', async () => {
    const input = { status: 'Pending Approval', currentReading: '80', dateOfCompletion: '2026-02-30' };
    const before = await run(false, input);
    const after = await run(true, input);
    expect(after).toEqual(before);
    expect(after.error.code).toBe('RH_INVALID_READING_DATE');
    expect(after.writes).toEqual([]);
    expect(after.audits).toEqual([]);
  });

  it('best-effort audit failure retains the existing successful save policy', async () => {
    const input = { status: 'Pending Approval', currentReading: '80', dateOfCompletion: '2026-10-05' };
    const after = await run(true, input, {}, true);
    expect(after).toEqual(await run(false, input, {}, true));
    expect(after.error).toBeUndefined();
    expect(after.writes).toHaveLength(1);
    expect(after.audits).toHaveLength(1);
  });

  it('non-approval update never enters RH validation/audit', async () => {
    const input = { remarks: 'Reviewed' };
    const after = await run(true, input);
    expect(after).toEqual(await run(false, input));
    expect(after.writes).toEqual([['request-wo', input]]);
    expect(after.audits).toEqual([]);
    expect(after.validationCalls).toEqual([]);
  });
});
