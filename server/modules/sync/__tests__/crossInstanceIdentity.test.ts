// 13-Oct-2026 — Testvessel sync fixes. Unit level (no database): parent links resolved by UUID, and the
// office/ship defect number series. The end-to-end behaviour is proven on the shore+ship pilot separately.
import { describe, expect, it } from 'vitest';
import { NEVER_MERGE_ON_CONFLICT, PARENT_UUID_LINKS, resolveParentLinks } from '../oneWayApplier';
import { defectSeriesPrefix, formatDefectNumber, highestInSeries, OFFICE_DEFECT_SERIES_MARK } from '../../../utils/defectNumberSeries';

/** Fake pool: change_request rows keyed by cruuid → local id. */
function pool(crs: Record<string, number>) {
  const calls: Array<{ text: string; values?: any[] }> = [];
  return {
    calls,
    query: async (text: string, values?: any[]) => {
      calls.push({ text, values });
      const id = crs[String(values?.[0])];
      return { rows: id === undefined ? [] : [{ id }] };
    },
  };
}

describe('resolveParentLinks — change_request_approval', () => {
  it('replaces the SENDER\'s change_request_id with THIS instance\'s id, found by change_request_uuid', async () => {
    // Testvessel: the office says "74", the ship knows the same change request as 2.
    const row: Record<string, any> = { crauuid: 'a1', change_request_id: 74, change_request_uuid: '435cc702' };
    const wait = await resolveParentLinks(pool({ '435cc702': 2 }), 'change_request_approval', row);
    expect(wait).toBeNull();
    expect(row.change_request_id).toBe(2);
  });

  it('parent not arrived yet → waits (never keeps the sender\'s number, never blanks it)', async () => {
    const row: Record<string, any> = { crauuid: 'a1', change_request_id: 74, change_request_uuid: 'not-here' };
    const wait = await resolveParentLinks(pool({}), 'change_request_approval', row);
    expect(wait).toMatch(/has not arrived/);
    expect(row.change_request_id).toBe(74); // unchanged; the caller does not write the row
  });

  it('a sender number that happens to exist locally is NOT trusted — the UUID decides', async () => {
    // Local CR 74 is a different change request; the approval belongs to cruuid X, local id 5.
    const row: Record<string, any> = { change_request_id: 74, change_request_uuid: 'X' };
    await resolveParentLinks(pool({ X: 5, other: 74 }), 'change_request_approval', row);
    expect(row.change_request_id).toBe(5);
  });

  it('no change_request_uuid → waits', async () => {
    const row: Record<string, any> = { change_request_id: 74 };
    expect(await resolveParentLinks(pool({}), 'change_request_approval', row)).toMatch(/no change_request_uuid/);
  });

  it('camelCase rows (full-row payloads) are resolved too', async () => {
    const row: Record<string, any> = { changeRequestId: 74, changeRequestUuid: 'X' };
    expect(await resolveParentLinks(pool({ X: 9 }), 'change_request_approval', row)).toBeNull();
    expect(row.changeRequestId).toBe(9);
    expect(row.change_request_id).toBe(9);
  });

  it('tables without parent links are untouched and query nothing', async () => {
    const p = pool({});
    const row = { id: 1 };
    expect(await resolveParentLinks(p, 'defects', row)).toBeNull();
    expect(p.calls).toHaveLength(0);
    expect(Object.keys(PARENT_UUID_LINKS)).toEqual(['change_request_approval']);
  });

  it('defects are never merged on a number clash', () => {
    expect(NEVER_MERGE_ON_CONFLICT.has('defects')).toBe(true);
    expect(NEVER_MERGE_ON_CONFLICT.has('vessel_certificate_data')).toBe(false); // that fallback is intended there
  });
});

describe('defect number series — ship and office never overlap', () => {
  const ship = defectSeriesPrefix(48, 26, 'ship');
  const office = defectSeriesPrefix(48, 26, 'shore');

  it('formats: ship unchanged, office carries the mark', () => {
    expect(formatDefectNumber(ship, 4)).toBe('D048-26-0004');
    expect(formatDefectNumber(office, 1)).toBe(`D048-26-${OFFICE_DEFECT_SERIES_MARK}0001`);
    expect(formatDefectNumber(office, 1)).toBe('D048-26-O0001');
  });

  it('each series counts only its own numbers', () => {
    const ids = ['D048-26-0001', 'D048-26-0002', 'D048-26-0003', 'D048-26-O0001', 'D048-26-O0007', 'D049-26-0099', 'D048-25-0050'];
    expect(highestInSeries(ids, ship)).toBe(3);
    expect(highestInSeries(ids, office)).toBe(7);
    expect(highestInSeries([], office)).toBe(0);
  });

  it('the two series can never produce the same number', () => {
    const shipNums = new Set(Array.from({ length: 200 }, (_, i) => formatDefectNumber(ship, i + 1)));
    for (let i = 1; i <= 200; i++) expect(shipNums.has(formatDefectNumber(office, i))).toBe(false);
  });

  it('numbers above 9999 still sort into their own series', () => {
    expect(highestInSeries(['D048-26-12345', 'D048-26-O0002'], ship)).toBe(12345);
  });
});
