import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isGlobalBulkImportType } from '../../../shared/bulkImportHistoryScope';

const fakeFiles = vi.hoisted(() => new Map<string, string>());
vi.mock('fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  promises: {
    mkdir: vi.fn(async () => undefined),
    readdir: vi.fn(async () => [...fakeFiles.keys()]),
    readFile: vi.fn(async (file: string) => {
      const content = fakeFiles.get(file.split('/').pop()!);
      if (content === undefined) throw new Error('Missing test file');
      return content;
    }),
  },
}));

import { getImportHistoryList } from '../fileBasedImportHistory';
import { getImportHistory } from '../../modules/bulk-upload/services/historyService';

function addRecord(id: string, vesselId: string | null | undefined, type = 'components', day = 1) {
  fakeFiles.set(`${id}.json`, JSON.stringify({
    id, vesselId, type, mode: 'upsert', userId: 'test-user',
    startedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    completedAt: `2026-10-${String(day).padStart(2, '0')}T12:01:00.000Z`,
    status: 'complete', created: 3, updated: 2, skipped: 1, archived: 0,
    originalName: 'Vessel-B-components.xlsx',
    storedFilePath: 'local:/test/original.xlsx', errorReport: null,
  }));
}

beforeEach(() => fakeFiles.clear());

describe('vessel-specific file-based import history', () => {
  it('isolates two vessels with the same template and does not infer ownership from filenames', async () => {
    addRecord('a', 'V-A');
    addRecord('b', 'V-B');
    expect((await getImportHistoryList('components', 50, 0, 'V-A')).items.map(r => r.id)).toEqual(['a']);
    expect((await getImportHistoryList('components', 50, 0, 'V-B')).items.map(r => r.id)).toEqual(['b']);
  });

  it('excludes unknown ownership and applies the template filter', async () => {
    addRecord('missing', undefined);
    addRecord('null', null);
    addRecord('blank', '');
    addRecord('a', 'V-A');
    addRecord('job', 'V-A', 'jobs');
    const history = await getImportHistoryList('components', 50, 0, 'V-A');
    expect(history.total).toBe(1);
    expect(history.items[0].id).toBe('a');
    expect((await getImportHistoryList('jobs', 50, 0, 'V-A')).items[0].id).toBe('job');
    expect(await getImportHistoryList('components', 50, 0, 'V-C')).toEqual({ items: [], total: 0 });
  });

  it('filters before counting, sorting and pagination', async () => {
    addRecord('a-old', 'V-A', 'components', 1);
    addRecord('b-new', 'V-B', 'components', 9);
    addRecord('a-new', 'V-A', 'components', 8);
    addRecord('a-mid', 'V-A', 'components', 4);
    addRecord('a-job', 'V-A', 'jobs', 10);
    const history = await getImportHistoryList('components', 1, 1, 'V-A');
    expect(history.total).toBe(3);
    expect(history.items.map(r => r.id)).toEqual(['a-mid']);
  });

  it.each([undefined, '', '   '])('never falls back to all vessels for missing selection %s', async (vesselId) => {
    addRecord('a', 'V-A');
    addRecord('b', 'V-B');
    expect(await getImportHistoryList('components', 50, 0, vesselId)).toEqual({ items: [], total: 0 });
    expect(await getImportHistoryList(undefined, 50, 0, vesselId)).toEqual({ items: [], total: 0 });
  });

  it.each(['makers', 'fleet-components', 'fleet-jobs', 'fleet-spares'])(
    'keeps global %s history available without a vessel',
    async (type) => {
      addRecord('global', undefined, type);
      addRecord('vessel', 'V-A');
      expect(isGlobalBulkImportType(type)).toBe(true);
      expect((await getImportHistoryList(type)).items.map(r => r.id)).toEqual(['global']);
      expect((await getImportHistoryList(undefined, 50, 0, 'V-A')).items.map(r => r.id)).toEqual(['vessel']);
    },
  );

  it('does not include global template records in a vessel-specific list even if they carry a vessel ID', async () => {
    addRecord('global', 'V-A', 'fleet-components');
    addRecord('vessel', 'V-A');
    expect((await getImportHistoryList(undefined, 50, 0, 'V-A')).items.map(r => r.id)).toEqual(['vessel']);
  });

  it('passes the vessel through the service and preserves action IDs, status, counts and original-file metadata', async () => {
    addRecord('a', 'V-A');
    addRecord('b', 'V-B');
    const history = await getImportHistory('components', 50, 0, 'V-A');
    expect(history.total).toBe(1);
    expect(history.items[0]).toMatchObject({
      id: 'a', status: 'complete', created: 3, updated: 2, skipped: 1,
      originalName: 'Vessel-B-components.xlsx', storedFilePath: 'local:/test/original.xlsx',
    });
  });
});

describe('history UI and endpoint wiring contracts', () => {
  const source = readFileSync(path.resolve('client/src/components/admin/UniformBulkUpload.tsx'), 'utf8');

  it('keys and sends history by the selected vessel without keeping previous-vessel placeholder data', () => {
    expect(source).toContain("queryKey: ['/technical/api/bulk/history', effectiveType, historyVesselId ?? null]");
    expect(source).toContain("params.set('vesselId', historyVesselId)");
    expect(source).toContain('enabled: canLoadHistory');
    expect(source).toContain('placeholderData: undefined');
    expect(source).toContain('Select a vessel to view import history.');
    expect(source).toContain('Unable to load import history. Please try again.');
  });

  it('retains prefix invalidation for import completion and Undo across vessel-specific keys', () => {
    expect(source.match(/invalidateQueries\(\{ queryKey: \['\/technical\/api\/bulk\/history', effectiveType\] \}\)/g)).toHaveLength(2);
    expect(source).toContain('/technical/api/bulk/history/${historyId}/download-original');
  });

  it('passes the request vessel filter from the endpoint into the history service', () => {
    const controller = readFileSync(path.resolve('server/modules/bulk-upload/controllers/bulkController.ts'), 'utf8');
    const historyHandler = controller.slice(controller.indexOf('export async function getHistoryList'), controller.indexOf('// ── Download Original'));
    expect(historyHandler).toContain('type, vesselId, limit');
    expect(historyHandler).toContain('vesselId as string | undefined');
  });
});
