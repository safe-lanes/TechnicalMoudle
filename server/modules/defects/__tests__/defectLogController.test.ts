import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('../paging/defectLogReader', () => ({ readDefectLog: vi.fn() }));
import { readDefectLog } from '../paging/defectLogReader';
import { getDefectLogPage } from '../paging/defectLogController';

const match = { locale: 'en-US', timeZone: 'Asia/Kolkata', now: '2026-10-29T12:00:00Z' };
const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};
beforeEach(() => vi.resetAllMocks());

describe('Defect Log opt-in controller', () => {
  it('bounds pages to 100 and forwards browser/vessel scope, not ignored filters', async () => {
    const res = response();
    vi.mocked(readDefectLog).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 });
    await getDefectLogPage({ query: {
      page: '2', pageSize: '999999', vesselId: 'a', vesselIds: 'b,c,',
      match: JSON.stringify({ ...match, search: 'valve', type: 'ignored', fleet: 'ignored' }),
    } } as any, res as any);
    expect(readDefectLog).toHaveBeenCalledWith({
      page: 2, pageSize: 100, vesselId: 'a', vesselIds: ['b', 'c'], match: { ...match, search: 'valve' },
    }, false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });
  it('requires explicit export=true and defaults ordinary navigation to page 1', async () => {
    for (const flag of [undefined, 'false', '1', 'true']) {
      await getDefectLogPage({ query: { export: flag, match: JSON.stringify(match) } } as any, response() as any);
      expect(vi.mocked(readDefectLog).mock.calls.at(-1))
        .toEqual([expect.objectContaining({ page: 1, pageSize: 100 }), flag === 'true']);
    }
  });
  it.each(['0', '-1', '1.5', 'NaN', '1000001'])('rejects invalid page %s before a read', async page => {
    const res = response();
    await getDefectLogPage({ query: { page, match: JSON.stringify(match) } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(readDefectLog).not.toHaveBeenCalled();
  });
  it.each([
    '{broken', '{}', JSON.stringify({ ...match, now: 'invalid' }),
    JSON.stringify({ ...match, timeZone: 'Not/AZone' }),
    JSON.stringify({ ...match, locale: '?' }),
  ])('rejects invalid browser context without defaults: %s', async invalid => {
    const res = response();
    await getDefectLogPage({ query: { match: invalid } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(readDefectLog).not.toHaveBeenCalled();
  });
  it('returns an explicit error, not an empty or partial export, when a batch read fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(readDefectLog).mockRejectedValue(new Error('Fixture batch failure'));
      const res = response();
      await getDefectLogPage({ query: { export: 'true', match: JSON.stringify(match) } } as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledExactlyOnceWith({ error: 'Failed to fetch Defect Log records' });
    } finally { log.mockRestore(); }
  });
});
