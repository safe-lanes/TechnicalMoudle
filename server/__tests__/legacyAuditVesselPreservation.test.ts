/**
 * Isolated audit-block coverage, not an end-to-end missing-vessel rejection.
 * The full legacy method cannot reach this block with both vessel IDs missing.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../modules/shared/errors';

const source = readFileSync('server/services/workOrderService.ts', 'utf8');
const start = source.indexOf("              const previousRH = parseInt(component.currentCumulativeRH || '0');");
const end = source.indexOf('              console.log(', start);
if (start < 0 || end < start) throw new Error('Legacy audit block moved; review source probe');
const candidate = source.slice(start, end);
const guard = [
  '              const auditVesselId = wo.vesselId || component.vesselId;',
  '              if (!auditVesselId) {',
  "                throw new ValidationError('Vessel ID is required for the running hours audit');",
  '              }',
  '',
].join('\n');
const baseline = candidate.replace(guard, '').replace('vesselId: auditVesselId,',
  'vesselId: wo.vesselId || component.vesselId,');
const fixedTime = '2026-11-03T09:00:00.000Z';
class FixedDate extends Date {
  constructor() { super(fixedTime); }
}

async function run(text: string, woVessel: string | null, componentVessel: string | null) {
  const createRunningHoursAudit = vi.fn(async () => undefined);
  const module = { exports: {} };
  const compiled = ts.transpileModule(`module.exports = async function () { ${text} };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics).toEqual([]);
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, ValidationError, Date: FixedDate,
    storage: { createRunningHoursAudit },
    wo: { vesselId: woVessel, workOrderNo: 'WO-1', id: 'local-wo' },
    component: { cuuid: 'component-uuid', vesselId: componentVessel, currentCumulativeRH: '123' },
    runningHours: 150, completionDate: '2026-11-03', updatesAny: { performedBy: 'test-actor' },
    require(id: string) { throw new Error(`Blocked audit import: ${id}`); },
  }, { timeout: 5000 });
  return { execute: module.exports, createRunningHoursAudit };
}

describe('legacy RH audit vessel validation preserves available-vessel payloads', () => {
  it('reverses only the approved guard and payload substitution for baseline comparison', () => {
    expect(candidate.split(guard)).toHaveLength(2);
    expect(candidate).not.toBe(baseline);
    expect(source).toContain("const allComponents = wo.vesselId ? await storage.getComponents(wo.vesselId) : [];");
    expect(source).toContain("if (err instanceof ValidationError || err?.name === 'ValidationError' || err?.code === 'RH_INVALID_READING_DATE')");
  });

  it.each([
    ['work-order-vessel', 'component-vessel', 'work-order-vessel'],
    ['work-order-vessel', null, 'work-order-vessel'],
    [null, 'component-vessel', 'component-vessel'],
    ['', 'component-vessel', 'component-vessel'],
  ])('preserves audit payload and fallback precedence for %s / %s', async (woVessel, componentVessel, expected) => {
    const runs = [];
    for (const text of [baseline, candidate]) {
      const h = await run(text, woVessel, componentVessel);
      await h.execute();
      expect(h.createRunningHoursAudit).toHaveBeenCalledTimes(1);
      const payload = h.createRunningHoursAudit.mock.calls[0][0];
      const plain = JSON.parse(JSON.stringify(payload));
      expect(plain).toEqual({
        componentId: 'component-uuid', vesselId: expected, previousRH: '123',
        newRH: '150', cumulativeRH: '150', dateUpdatedLocal: '2026-11-03',
        dateUpdatedTZ: 'UTC', enteredAtUTC: fixedTime, userId: 'test-actor',
        source: 'workorder', notes: 'RH snapshot via WO save: WO-1 (ISOLATED)', meterReplaced: false,
      });
      runs.push(plain);
    }
    expect(runs[1]).toEqual(runs[0]);
  });

  it('rejects missing IDs before the insert in the isolated block only', async () => {
    const h = await run(candidate, null, null);
    await expect(h.execute()).rejects.toThrow(ValidationError);
    expect(h.createRunningHoursAudit).not.toHaveBeenCalled();
  });
});
