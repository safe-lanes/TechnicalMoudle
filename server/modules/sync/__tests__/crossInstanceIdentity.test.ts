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
    expect(Object.keys(PARENT_UUID_LINKS).sort()).toEqual(['change_request_approval', 'change_request_attachment', 'change_request_comment']);
  });

  it('comments/attachments: resolved by UUID when present; rows from before mig 181 (no UUID) keep their number', async () => {
    const withUuid: Record<string, any> = { change_request_id: 952, change_request_uuid: 'f724' };
    expect(await resolveParentLinks(pool({ f724: 1453 }), 'change_request_comment', withUuid)).toBeNull();
    expect(withUuid.change_request_id).toBe(1453);
    const legacy: Record<string, any> = { change_request_id: 952 };
    expect(await resolveParentLinks(pool({}), 'change_request_attachment', legacy)).toBeNull();
    expect(legacy.change_request_id).toBe(952);
    const notArrived: Record<string, any> = { change_request_id: 952, change_request_uuid: 'later' };
    expect(await resolveParentLinks(pool({}), 'change_request_comment', notArrived)).toMatch(/has not arrived/);
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

describe('component_documents — UUID identity across versions (mig 182)', () => {
  it('md5Uuid matches the Postgres md5()::uuid layout (8-4-4-4-12, lower case)', async () => {
    const { md5Uuid } = await import('../oneWayApplier');
    // Values checked against Postgres md5($1)::uuid::text on the pilot (13-Oct-2026).
    expect(md5Uuid('component_documents:1:601.016/manual.pdf')).toBe('beb5284b-d846-d932-af6c-c691dda065b3');
    expect(md5Uuid('component_documents:42:WKFV/Ä-über drawing (rev 2).PDF')).toBe('0b80ffd0-ed47-bffa-f2e0-fe1f9a1ccbb9');
  });

  it('an old sender\'s creating change derives the migration\'s UUID from file + component (NOT its integer id)', async () => {
    const { LEGACY_ID_KEYED, md5Uuid } = await import('../oneWayApplier');
    const logs = [
      { tableName: 'component_documents', rowUuid: '7', fieldName: 'fileKey', oldValue: null, newValue: '601.016/1_x.pdf', changedAt: '2026-10-13T10:00:00Z' },
      { tableName: 'component_documents', rowUuid: '7', fieldName: 'componentId', oldValue: null, newValue: 'c-uuid-1', changedAt: '2026-10-13T10:00:00Z' },
    ] as any[];
    const u = LEGACY_ID_KEYED.component_documents.derive('7', logs);
    expect(u).toBe(md5Uuid('component_documents:601.016/1_x.pdf:c-uuid-1:1'));
    // the same document under a DIFFERENT local id on the other side derives the same UUID
    expect(LEGACY_ID_KEYED.component_documents.derive('99', logs.map((l) => ({ ...l, rowUuid: '99' })))).toBe(u);
  });

  it('an old sender\'s edit without the file cannot be derived → waits', async () => {
    const { LEGACY_ID_KEYED } = await import('../oneWayApplier');
    const logs = [{ tableName: 'component_documents', rowUuid: '7', fieldName: 'notes', oldValue: 'a', newValue: 'b', changedAt: '2026-10-13T10:00:00Z' }] as any[];
    expect(LEGACY_ID_KEYED.component_documents.derive('7', logs)).toBeNull();
  });

  it('old ships are not sent UUID-keyed document changes; updated ships are', async () => {
    const { holdBackForOldShip, CAP_COMPONENT_DOCUMENTS_UUID } = await import('../service');
    const logs = [
      { tableName: 'component_documents', rowUuid: '9d5b14d1-5261-45af-9134-bf845c07410f' },
      { tableName: 'component_documents', rowUuid: '12' }, // legacy key — safe for an old ship
      { tableName: 'defects', rowUuid: 'a1' },
    ];
    expect(holdBackForOldShip(logs, undefined)).toEqual({ logs: [logs[1], logs[2]], heldBack: 1 });
    expect(holdBackForOldShip(logs, ['something-else']).heldBack).toBe(1);
    expect(holdBackForOldShip(logs, [CAP_COMPONENT_DOCUMENTS_UUID])).toEqual({ logs, heldBack: 0 });
  }, 30_000); // first import of the sync service module is slow under load
});

describe('provisioning — vessel_code-scoped tables (14-Oct-2026)', () => {
  it('matches vessel_code by the vessel UUID (what the app writes) and by vessels.id', async () => {
    const { vesselScopeValues } = await import('../provisioningService');
    expect(vesselScopeValues('vessel_code', '743ef9d1-841a-11ed-aa7c-7003bca91a86', 'WKFV'))
      .toEqual(['743ef9d1-841a-11ed-aa7c-7003bca91a86', 'WKFV']);
    expect(vesselScopeValues('vessel_id', '743ef9d1', 'WKFV')).toEqual(['743ef9d1']); // vessel_id scope unchanged
    expect(vesselScopeValues('vessel_code', 'same', 'same')).toEqual(['same']);
    expect(vesselScopeValues('vessel_code', null, '')).toEqual([]);
  });
});
