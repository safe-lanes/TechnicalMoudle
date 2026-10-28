import { describe, expect, it, vi } from 'vitest';
import { surveyClientDeclaration as declaration, surveyClientFunction as client } from './fixtures/surveyClientFunctions';

const dates = ['27 Oct 2026', '2026-10-28', '10 Nov 2026', '10 Dec 2026', '10 Jan 2027', '', 'invalid'];
const rows = dates.map((dueDate, i) => ({
  id: `v${i % 2}::m${i}`, vesselId: `v${i % 2}`, masterId: `m${i}`,
  vessel: i % 2 ? 'Vessel 2' : 'Vessel 1', companyId: `C"${i}`,
  surveyName: i === 0 ? 'Survey,\n"quoted"' : `Survey ${i}`, type: 'A',
  surveyDate: '', dueDate, firstRangeDate: '', secondRangeDate: '', postponed: '',
  lastEdit: '', attachments: [{ id: `file-${i}`, type: 'application/pdf',
    data: 'data:application/pdf;base64,SGk=', name: 'fixture.pdf', size: 2 }],
}));
const fixedClock = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
};

describe('Unchanged Survey browser contracts', () => {
  it.each([
    ['all', 7], ['overdue', 1], ['1month', 3], ['2months', 4], ['3months', 5],
  ])('retains Due In semantics and post-page priority order: %s', (dueInFilter, length) => {
    fixedClock();
    try {
      const input = [...rows].reverse();
      const before = [...input];
      const result = client('filter', { surveys: input, selectedVesselNames: [], dueInFilter })();
      expect(result).toHaveLength(length);
      expect(result[0].id).toBe(rows[0].id);
      if (dueInFilter !== 'all') expect(result.every((r: any) => r.dueDate && r.dueDate !== 'invalid')).toBe(true);
      expect(input).toEqual(before);
    } finally { vi.useRealTimers(); }
  });

  it('retains existing substring vessel checks without changing matching rules', () => {
    const result = client('filter', { surveys: rows, selectedVesselNames: [' VESSEL 2 suffix '], dueInFilter: 'all' })();
    expect(result).toHaveLength(3);
    expect(result.every((r: any) => r.vessel === 'Vessel 2')).toBe(true);
  });

  it.each(['all', 'overdue', '1month', '2months', '3months'])(
    'retains export request and selection separate from page sorting: %s', async dueInFilter => {
      fixedClock();
      try {
        const reversed = [...rows].reverse();
        const fetch = vi.fn(async (url: string) => {
          const params = new URL(url, 'http://test').searchParams;
          expect(params.get('page')).toBe('1');
          expect(params.get('limit')).toBe('100000');
          expect(params.get('vesselNames')).toBe('Vessel 1,Vessel 2');
          expect(params.has('sortBy')).toBe(false);
          expect(params.has('dueIn')).toBe(false);
          return { ok: true, json: async () => ({ surveys: reversed }) };
        });
        const result = await client('export', {
          fetch, selectedVesselNames: ['Vessel 1', 'Vessel 2'], dueInFilter,
        })();
        expect(fetch).toHaveBeenCalledOnce();
        if (dueInFilter === 'all') expect(result).toEqual(reversed);
        else {
          const display = client('filter', { surveys: rows, selectedVesselNames: [], dueInFilter })();
          expect(new Set(result.map((r: any) => r.id))).toEqual(new Set(display.map((r: any) => r.id)));
          expect(result.at(-1).id).toBe(rows[0].id);
        }
      } finally { vi.useRealTimers(); }
    });

  it.each(['Pdf', 'Csv', 'Excel'])('checks actual %s export output independently', async format => {
    const generateReport = vi.fn(), click = vi.fn(), toast = vi.fn(), blobs: Blob[] = [];
    const link: any = { click };
    const next = format === 'Pdf' ? 'const handleExportCsv'
      : format === 'Csv' ? 'const handleExportExcel' : '\n  return (';
    await declaration(`handleExport${format}`, next, {
      fetchAllSurveys: async () => rows,
      pdfReportGenerator: { generateReport }, toast,
      document: { createElement: () => link },
      URL: { createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:isolated'; }, revokeObjectURL: vi.fn() },
    })();
    expect(toast).not.toHaveBeenCalled();
    if (format === 'Pdf') {
      expect(generateReport).toHaveBeenCalledOnce();
      const [options, columns, data] = generateReport.mock.calls[0];
      expect(options).toEqual({ title: 'Surveys', subtitle: 'Total: 7 surveys', orientation: 'landscape' });
      expect(columns.map((c: any) => c.field)).toEqual([
        'companyId', 'surveyName', 'type', 'vessel', 'surveyDate', 'dueDate',
        'firstRangeDate', 'secondRangeDate', 'postponed', 'lastEdit',
      ]);
      expect(data.map((r: any) => r.companyId)).toEqual(rows.map(r => r.companyId));
      expect(data[0].surveyDate).toBe('-');
    } else {
      expect(click).toHaveBeenCalledOnce();
      expect(link.download).toBe(format === 'Csv' ? 'surveys-export.csv' : 'surveys-export.xls');
      const bytes = Buffer.from(await blobs[0].arrayBuffer());
      if (format === 'Excel') expect(bytes.subarray(0, 3).toString('hex')).toBe('efbbbf');
      const csv = (format === 'Excel' ? bytes.subarray(3) : bytes).toString('utf8');
      expect(csv).toContain('"Company ID","Survey","Company Group","Vessel"');
      expect(csv).toContain('"C""0","Survey,\n""quoted"""');
      expect(csv).toContain('""'); // retain empty fields
    }
  });

  it('keeps vessel selection/query keys/page reset and existing local grid search/filter wiring', () => {
    const setters = { setFilterValue: vi.fn(), setSelectedVesselNames: vi.fn(), setCurrentPage: vi.fn() };
    const selection = { mode: 'fleet', selectedVessels: [], selectedFleets: ['f1'],
      selectedGroups: [], selectedVesselNames: ['Vessel 2'] };
    declaration('handleFilterChange', 'const filteredSurveys', setters)(selection);
    expect(setters.setCurrentPage).toHaveBeenCalledWith(1);
    expect(setters.setSelectedVesselNames).toHaveBeenCalledWith(['Vessel 2']);
    const url = declaration('apiUrl', 'const { data: surveysResponse', {
      currentPage: 2, pageSize: 100, selectedVesselNames: ['Vessel 2'],
    });
    expect(url).toBe('/technical/api/surveys?page=2&limit=100&vesselName=Vessel+2');
  });

  it('preserves compound cache targeting, Last Edit, timer reset and unmount cleanup', async () => {
    fixedClock();
    try {
      const timer = { current: null as any };
      let cleanup = () => {};
      declaration('surveyInvalidateTimer', '// Build API URL', {
        useRef: () => timer, useEffect: (effect: () => () => void) => { cleanup = effect(); },
      });
      let cached = { surveys: [rows[0], { ...rows[0], id: 'v9::m0', vesselId: 'v9' }],
        total: 2, page: 1, limit: 100, totalPages: 1 };
      const invalidateQueries = vi.fn();
      const queryClient = { invalidateQueries, setQueriesData: vi.fn((filter, update) => {
        expect(filter).toEqual({ queryKey: ['/technical/api/surveys'] });
        expect(update(undefined)).toBeUndefined();
        cached = update(cached);
      }) };
      const apiRequest = vi.fn(async () => ({ json: async () => ({ lastEditUpload: '28 Oct 2026' }) }));
      const config = declaration('updateSurveyMutation', 'const handleOpenAttachments', {
        apiRequest, queryClient, toast: vi.fn(), surveyInvalidateTimer: timer,
      });
      const variables = { id: rows[0].id, updates: { dueDate: '10 Nov 2026' } };
      const server = await config.mutationFn(variables);
      expect(apiRequest).toHaveBeenCalledWith('PATCH', `/technical/api/surveys/${rows[0].id}`, variables.updates);
      config.onSuccess(server, variables);
      expect(cached.surveys[0].lastEdit).toBe('28 Oct 2026');
      expect(cached.surveys[1].dueDate).toBe(rows[0].dueDate);
      expect(cached.total).toBe(2);
      await vi.advanceTimersByTimeAsync(1499);
      expect(invalidateQueries).not.toHaveBeenCalled();
      config.onSuccess({ last_edit_upload: '29 Oct 2026' }, variables);
      await vi.advanceTimersByTimeAsync(1499);
      expect(invalidateQueries).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: ['/technical/api/surveys'] });
      expect(cached.surveys[0].lastEdit).toBe('29 Oct 2026');
      config.onSuccess(server, variables);
      cleanup();
      await vi.advanceTimersByTimeAsync(1500);
      expect(invalidateQueries).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it.each(['surveyDate', 'dueDate', 'firstRangeDate', 'secondRangeDate', 'postponed'])(
    'preserves isolated %s edits, read-only column settings and duplicate-save avoidance', field => {
      const mutate = vi.fn();
      declaration('handleDateChange', 'const gridContext', { updateSurveyMutation: { mutate } })(
        rows[0].id, field, '02 Nov 2026',
      );
      expect(mutate).toHaveBeenCalledExactlyOnceWith({ id: rows[0].id, updates: { [field]: '02 Nov 2026' } });
      declaration('handleCellEditingStopped', 'const handleDateChange', {
        updateSurveyMutation: { mutate },
        EDITABLE_DATE_FIELDS: ['surveyDate', 'dueDate', 'firstRangeDate', 'secondRangeDate', 'postponed'],
      })({ data: rows[0], colDef: { field }, value: '02 Nov 2026', oldValue: '' });
      expect(mutate).toHaveBeenCalledOnce();
      for (const canEditSurvey of [false, true]) {
        const columns = declaration('columnDefs', 'const onGridReady', {
          canEditSurvey, DateCellEditor: () => null, ActionsCellRenderer: () => null,
        });
        expect(columns.find((c: any) => c.field === field).editable).toBe(canEditSurvey);
      }
    });

  it('retains complete attachment viewing, compound-key add/remove and permission refusal', () => {
    const setSelectedSurvey = vi.fn(), setAttachmentSheetOpen = vi.fn(), mutate = vi.fn();
    declaration('handleOpenAttachments', 'const handleAttachmentsChange', { setSelectedSurvey, setAttachmentSheetOpen })(rows[0]);
    expect(setSelectedSurvey).toHaveBeenCalledWith(rows[0]);
    expect(setAttachmentSheetOpen).toHaveBeenCalledWith(true);
    expect(rows[0].attachments[0].data).toMatch(/^data:application\/pdf;base64,/);
    for (const attachments of [[...rows[0].attachments, { id: 'new', data: 'isolated' }], []]) {
      declaration('handleAttachmentsChange', 'const handleCellEditingStopped', {
        canEditSurvey: true, selectedSurvey: rows[0], updateSurveyMutation: { mutate }, setSelectedSurvey,
      })(attachments);
      expect(mutate).toHaveBeenLastCalledWith({ id: rows[0].id, updates: { attachments } });
      expect(setSelectedSurvey.mock.calls.at(-1)![0](rows[0]).attachments).toEqual(attachments);
    }
    mutate.mockClear();
    declaration('handleAttachmentsChange', 'const handleCellEditingStopped', {
      canEditSurvey: false, selectedSurvey: rows[0], updateSurveyMutation: { mutate }, setSelectedSurvey,
    })([]);
    expect(mutate).not.toHaveBeenCalled();
  });
});
