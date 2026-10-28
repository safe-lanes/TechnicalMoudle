import fs from 'node:fs';
import { transformSync } from 'esbuild';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/certificateRepository', async () => {
  const { createCertificateRepositoryMock } = await import('./fixtures/certificateRepositoryMock');
  return createCertificateRepositoryMock();
});
vi.mock('../../sync', () => ({ logFieldChanges: vi.fn() }));

import * as repo from '../repositories/certificateRepository';
import { getCertificates } from '../services/certificateService';
import { getLegacyCertificates } from './fixtures/legacyCertificateList';

const mocked = vi.mocked(repo);
const names = ['  Vessel 10 ', 'Vessel 2', 'VESSEL 1'];
const masters = Array.from({ length: 82 }, (_, i) => ({
  masterId: `master-${i}`, companyId: i % 5 ? `CERT-${i}` : '',
  certificateName: ['Alpha 2', 'alpha 10', 'Éngine', ''][i % 4],
  certificateLabel: i % 3 ? '' : `Label ${i}`,
  companyGroup: i % 2 ? 'A' : '', companySequence: i % 7 ? i % 9 : null,
  sequence: i % 11,
}));
const apps = names.flatMap((vesselName, v) =>
  masters.map(master => ({ vesselId: `v${v}`, vesselName, masterId: master.masterId })));
const data = apps.filter((_, i) => i % 3 === 0).map((app, i) => ({
  ...app, id: i + 1, certificateNumber: ['CERT-2', 'cert-10', '', null][i % 4],
  expiryDate: ['01 Jan 2027', '2026-10-01', '', null][i % 4],
  issueDate: i % 2 ? '02 Jan 2025' : '',
  nextAnnual: i % 2 ? '10 Jan 2027' : '2 Jan 2027',
  attachments: [{ id: `file-${i}`, name: 'file.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,SGk=' }],
}));

function setup() {
  mocked.getApplicableCertificates.mockResolvedValue(apps as any);
  mocked.getMasterCertificatesByIds.mockResolvedValue(masters as any);
  mocked.getAllVesselCertificateData.mockResolvedValue(data as any);
}

// Execute the unchanged frontend functions, not a rewritten approximation.
const frontend = fs.readFileSync('client/src/pages/cert-surveys/CertificatesPage.tsx', 'utf8');
const parser = frontend.slice(frontend.indexOf('const parseDisplayDate ='), frontend.indexOf('const isIssueExpiryOrderValid'));
function clientFunction(name: 'filter' | 'export', state: Record<string, unknown>) {
  const prefix = name === 'filter'
    ? 'const filteredCertificates = useMemo(() => {'
    : 'const fetchAllCertificates = useCallback(async () => {';
  const suffix = name === 'filter'
    ? '}, [certificates, selectedVesselNames, dueInFilter]);'
    : '}, [selectedVesselNames, sortBy, sortOrder, dueInFilter]);';
  const start = frontend.indexOf(prefix) + prefix.length;
  const end = frontend.indexOf(suffix, start);
  if (start < prefix.length || end < 0) throw new Error('Certificate frontend function moved');
  const code = transformSync(`${parser}\nexports.run = ${name === 'export' ? 'async ' : ''}function() {
    ${frontend.slice(start, end)}
  };`, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const exports: any = {};
  new Function('exports', ...Object.keys(state), code)(exports, ...Object.values(state));
  return exports.run;
}

function clientDeclaration(name: string, next: string, state: Record<string, unknown>) {
  const start = frontend.indexOf(`const ${name} =`);
  const end = frontend.indexOf(next, start);
  if (start < 0 || end < 0) throw new Error('Certificate frontend declaration moved');
  const code = transformSync(`${frontend.slice(start, end)}\nexports.run = ${name};`,
    { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const exports: any = {};
  new Function('exports', 'useCallback', 'useMutation', ...Object.keys(state), code)(
    exports, (fn: unknown) => fn, (config: unknown) => config, ...Object.values(state));
  return exports.run;
}

describe('Certificate loading compatibility', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it.each([1, 2, 3, 4])('matches the frozen legacy page %s including attachments and metadata', async page => {
    const filters = { page, limit: 100 };
    expect(await getCertificates(filters)).toEqual(await getLegacyCertificates(filters));
    expect(mocked.withCertificateReadSnapshot).toHaveBeenCalled();
  });

  it.each([
    { vesselId: 'v1' }, { vesselId: 'all', vesselIds: ['v2', 'v0'] },
    { vesselName: ' vessel 10 ' }, { vesselNames: 'VESSEL 2, vessel 1' },
    { vesselId: 'v1', vesselName: 'Vessel 1' },
    { vesselId: 'all', vesselIds: [], vesselName: 'Vessel 2' },
    { vesselIds: ['v1'] }, { vesselName: 'no match' },
  ])('preserves scope precedence: %j', async scope => {
    const filters = { ...scope, limit: 100, page: 1 };
    expect(await getCertificates(filters)).toEqual(await getLegacyCertificates(filters));
  });

  const fields = [
    'id', 'companyId', 'certificateName', 'name', 'vessel', 'certificateNumber',
    'type', 'companyGroup', 'issueDate', 'expiryDate', 'lastAnnual', 'nextAnnual',
    'lastInterm', 'nextInterm', 'endorsementDate', 'companySequence', 'unknown',
  ];
  it.each(fields.flatMap(sortBy => ['asc', 'desc'].map(sortOrder => ({ sortBy, sortOrder }))))(
    'retains exact string/numeric sorting and page boundaries: %j', async sort => {
      const filters = { ...sort, page: 2, limit: 100 };
      expect(await getCertificates(filters)).toEqual(await getLegacyCertificates(filters));
    });

  it('retains Certificates with no saved vessel data and strips the internal hydration ID', async () => {
    mocked.getAllVesselCertificateData.mockResolvedValue([]);
    const result = await getCertificates({ page: 2, limit: 100 });
    expect(result.total).toBe(apps.length);
    expect(result.certificates).toHaveLength(100);
    for (const row of result.certificates) {
      expect(row.certificateNumber).toBe('');
      expect(row.attachments).toEqual([]);
      expect(row).not.toHaveProperty('_certificateDataId');
    }
  });

  it('retains the last mapped duplicate data record, without multiplying rows', async () => {
    mocked.getAllVesselCertificateData.mockResolvedValue([
      ...data, { ...data[0], id: 999, certificateNumber: 'last record', attachments: [] },
    ] as any);
    expect(await getCertificates({})).toEqual(await getLegacyCertificates({}));
  });

  it.each(['no applicability', 'no active master', 'empty scope'])('retains empty metadata: %s', async kind => {
    if (kind === 'no applicability') mocked.getApplicableCertificates.mockResolvedValue([]);
    if (kind === 'no active master') mocked.getMasterCertificatesByIds.mockResolvedValue([]);
    const filters = kind === 'empty scope' ? { vesselId: 'none' } : {};
    expect(await getCertificates(filters)).toEqual(await getLegacyCertificates(filters));
  });

  it.each(['all', 'overdue', '1month', '2months', '3months'])(
    'preserves the actual browser Due In filter and page ordering: %s', async dueInFilter => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
      try {
        const current = await getCertificates({ page: 2 });
        const previous = await getLegacyCertificates({ page: 2 });
        const run = (certificates: unknown) => clientFunction('filter', {
          certificates, selectedVesselNames: [], dueInFilter,
        })();
        expect(run(current.certificates)).toEqual(run(previous.certificates));
      } finally { vi.useRealTimers(); }
    });

  it.each(['all', 'overdue', '1month', '2months', '3months'])(
    'preserves the actual shared PDF/CSV/Excel export selection: %s', async dueInFilter => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
      try {
        const run = async (read: typeof getCertificates) => {
          const fetch = vi.fn(async (url: string) => {
            const params = new URL(url, 'http://test').searchParams;
            expect(params.get('page')).toBe('1');
            expect(params.get('limit')).toBe('100000');
            return { ok: true, json: () => read({
              vesselNames: params.get('vesselNames') || undefined,
              page: Number(params.get('page')), limit: Number(params.get('limit')),
              sortBy: params.get('sortBy') || undefined, sortOrder: params.get('sortOrder') || undefined,
            }) };
          });
          return clientFunction('export', {
            fetch, selectedVesselNames: ['Vessel 2', 'Vessel 1'],
            dueInFilter, sortBy: 'nextAnnual', sortOrder: 'desc',
          })();
        };
        expect(await run(getCertificates)).toEqual(await run(getLegacyCertificates));
      } finally { vi.useRealTimers(); }
    });

  it('uses compound edit identity and patches matching cached rows before the unchanged delayed refresh', async () => {
    const current = await getCertificates({ page: 1 });
    const target = current.certificates.find(row => row.vesselId === 'v0' && row.masterId === 'master-0')!;
    const cached = [current, await getCertificates({ page: 2 })];
    const getId = clientDeclaration('getCertificateApiId', 'const handleOpenAttachments', {});
    const id = getId(target);
    expect(id).toBe('v0::master-0');
    const apiRequest = vi.fn().mockResolvedValue({});
    const invalidateByUrlPrefix = vi.fn();
    const queryClient = { setQueriesData: vi.fn((filter, update) => {
      expect(filter).toEqual({ queryKey: ['/technical/api/certificates'] });
      expect(update(undefined)).toBeUndefined();
      cached.forEach((page, i) => { cached[i] = update(page); });
    }) };
    const config = clientDeclaration('updateCertificateMutation', '// Certificate ID format', {
      apiRequest, queryClient, invalidateByUrlPrefix, toast: vi.fn(),
      certInvalidateTimer: { current: null },
    });
    vi.useFakeTimers();
    try {
      const variables = { id, updates: { certificateNumber: 'isolated update' } };
      await config.mutationFn(variables);
      expect(apiRequest).toHaveBeenCalledWith('PATCH',
        '/technical/api/certificates/v0::master-0', variables.updates);
      config.onSuccess({}, variables);
      const rows = cached.flatMap(page => page.certificates);
      expect(rows.filter(row => row.certificateNumber === 'isolated update')).toHaveLength(1);
      expect(rows.find(row => row.vesselId === 'v1' && row.masterId === target.masterId)?.certificateNumber)
        .not.toBe('isolated update');
      await vi.advanceTimersByTimeAsync(4999);
      expect(invalidateByUrlPrefix).not.toHaveBeenCalled();
      // A second edit resets the same refresh timer.
      config.onSuccess({}, variables);
      await vi.advanceTimersByTimeAsync(4999);
      expect(invalidateByUrlPrefix).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(invalidateByUrlPrefix).toHaveBeenCalledExactlyOnceWith('/technical/api/certificates');
    } finally { vi.useRealTimers(); }
  });

  it.each(['Pdf', 'Csv', 'Excel'])('preserves the actual %s handler output independently', async format => {
    const run = async (read: typeof getCertificates) => {
      const generateReport = vi.fn(), click = vi.fn(), toast = vi.fn();
      const blobs: Blob[] = [];
      const link: any = { click };
      const next = format === 'Pdf' ? 'const handleExportCsv'
        : format === 'Csv' ? 'const handleExportExcel' : '\n  return (';
      const handler = clientDeclaration(`handleExport${format}`, next, {
        fetchAllCertificates: async () => (await read({ page: 1, limit: 100000 })).certificates,
        formatCompanyGroup: (value: unknown) => String(value ?? ''),
        pdfReportGenerator: { generateReport }, toast,
        document: { createElement: () => link },
        URL: {
          createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:isolated-test'; },
          revokeObjectURL: vi.fn(),
        },
      });
      await handler();
      expect(toast).not.toHaveBeenCalled();
      if (format === 'Pdf') {
        expect(generateReport).toHaveBeenCalledOnce();
        return generateReport.mock.calls[0];
      }
      expect(click).toHaveBeenCalledOnce();
      expect(blobs).toHaveLength(1);
      return { filename: link.download, bytes: Buffer.from(await blobs[0].arrayBuffer()) };
    };
    expect(await run(getCertificates)).toEqual(await run(getLegacyCertificates));
  });

  it('passes complete page attachments to viewing and compound-key save operations, without real writes', async () => {
    const current = await getCertificates({});
    const target = current.certificates.find(row => row.attachments.length > 0)!;
    const setSelectedCertificate = vi.fn(), setAttachmentSheetOpen = vi.fn();
    const open = clientDeclaration('handleOpenAttachments', 'const handleAttachmentsChange', {
      setSelectedCertificate, setAttachmentSheetOpen,
    });
    open(target);
    expect(setSelectedCertificate).toHaveBeenCalledWith(target);
    expect(setSelectedCertificate.mock.calls[0][0].attachments[0].data).toMatch(/^data:application\/pdf;base64,/);
    expect(setAttachmentSheetOpen).toHaveBeenCalledWith(true);
    const getCertificateApiId = clientDeclaration('getCertificateApiId', 'const handleOpenAttachments', {});
    const mutate = vi.fn();
    for (const attachments of [[...target.attachments, { id: 'new', data: 'isolated-file' }], []]) {
      const save = clientDeclaration('handleAttachmentsChange', 'const handleCellEditingStopped', {
        canEditCert: true, selectedCertificate: target, getCertificateApiId,
        updateCertificateMutation: { mutate }, setSelectedCertificate,
      });
      save(attachments);
      expect(mutate).toHaveBeenLastCalledWith({
        id: `${target.vesselId}::${target.masterId}`, updates: { attachments },
      });
      expect(setSelectedCertificate.mock.calls.at(-1)![0](target).attachments).toEqual(attachments);
    }
    const readOnlySave = clientDeclaration('handleAttachmentsChange', 'const handleCellEditingStopped', {
      canEditCert: false, selectedCertificate: target, getCertificateApiId,
      updateCertificateMutation: { mutate }, setSelectedCertificate,
    });
    mutate.mockClear();
    readOnlySave([]);
    expect(mutate).not.toHaveBeenCalled();
  });
});
