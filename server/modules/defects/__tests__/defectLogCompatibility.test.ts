import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright';
import { matchesDefectLog, type LogMatchOptions } from '../paging/compatibility';

const dates = [
  '2026-03-07', '2026-03-08', '2026-04-07', '2026-05-07', '2026-05-08',
  '08-03-2026', '2026-02-31', '2026-13-01', 'not a date', '',
  '2026-03-08T00:00:00Z', '2026-03-08T01:30:00', 'March 8, 2026',
  '03/08/2026', '2026-03-08T23:00:00-05:00', '2026', '2026-03', '0099-03-08',
  'March 8, 2026 23:30 -5', 'March 8, 2026 GMT 23:30', 'March 8, 2026 EST (comment)',
  '2026-03-08T02:30:00', '2026-11-01T01:30:00', '2026-03-08T23:30:00',
  'March 8 2026 GMT0000', '10:00 +0000 March 8 2026', 'March 8 2026 1:1+0',
];
const html = [
  '<p>Pump &amp; valve &#x1F6A2;</p>', '<!-- hidden -->alpha<br>beta',
  '<span title=">">fault &copy;</span>', '<script>a<b</script><p>visible</p>',
  '<template>hidden template</template>outside', '<textarea>&lt;b&gt;</textarea>',
  '<table>outside<tr><td>inside</td></tr></table>', '<p>İ Σ ß &nbsp;</p>',
];
export const rows = Array.from({ length: 237 }, (_, i) => ({
  id: `D-${String(i).padStart(4, '0')}`, vesselId: i % 2 ? 'vessel-a' : 'vessel-b',
  vesselName: i % 2 ? 'Alpha Vessel' : 'Beta Vessel', issueDate: dates[i % dates.length],
  description: html[i % html.length], category: i % 3 ? 'Defect' : '',
  is_coc: i % 4 === 0, componentHardwareLevel3: i % 3 ? 'Main Pump' : '',
  priority: i % 2 ? 'High' : '', targetCloseDate: dates[(i + 3) % dates.length],
  dateCompleted: i % 7 === 0 ? dates[(i + 2) % dates.length] : '',
  verified: i % 11 === 0, isDeferred: i % 5 === 0,
  actions: i % 3 ? [{ actionDescription: 'First & action' }] : [],
}));

describe('Defect Log browser compatibility (independent legacy oracle)', () => {
  let browser: Browser;
  let bundle: string;
  beforeAll(async () => {
    bundle = (await build({
      entryPoints: ['server/modules/defects/__tests__/fixtures/legacyDefectLog.ts'],
      bundle: true, write: false, format: 'iife', globalName: 'LegacyLog', platform: 'browser',
      alias: { '@': `${process.cwd()}/client/src`, '@shared': `${process.cwd()}/shared` },
    })).outputFiles[0].text;
    browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', args: ['--no-sandbox'], headless: true });
  }, 30_000);
  afterAll(async () => { await browser?.close(); });

  for (const [timeZone, locale] of [
    ['UTC', 'en-US'], ['Asia/Kolkata', 'en-US'], ['America/New_York', 'en-US'],
    ['Pacific/Auckland', 'en-US'], ['Europe/Istanbul', 'tr-TR'],
  ]) {
    it(`matches legacy search/period/due/vessel results in ${timeZone}/${locale}`, async () => {
      const context = await browser.newContext({ timezoneId: timeZone, locale });
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-03-08T12:00:00Z') });
      await page.addScriptTag({ content: bundle });
      const base = { timeZone, locale, now: '2026-03-08T12:00:00Z' };
      const scenarios = [
        {}, ...['pump & valve', ' alpha ', '08 Mar 2026', '(CoC)', 'Main Pump', 'Verified',
          'Closed', 'Overdue', 'Extended', 'In Progress', 'Reported', 'İ', 'Σ', 'outside',
          'hidden', 'fault ©', '🚢', 'High', '-', '31 Feb 2026', '07 Mar 2026', '09 Mar 2026'].map(search => ({ search })),
        ...['overdue', 'due1month', 'due2months', 'due', 'all'].map(dueOverdue => ({ dueOverdue })),
        ...['overdue', 'due1month', 'due2months'].map(dueOverdue => ({ dueOverdue, now: '2026-08-03T12:00:00Z' })),
        ...[
          { mode: 'yearQuarterMonth', year: 2026 }, { mode: 'yearQuarterMonth', year: 2026, month: 2 },
          { mode: 'yearQuarterMonth', year: 2026, quarter: 1 },
          { mode: 'dateRange', dateFrom: '2026-03-08', dateTo: '2026-04-07' },
          { mode: 'dateRange', dateFrom: 'invalid', dateTo: 'invalid' },
        ].map(periodValue => ({ periodValue })),
        { selectedVessel: 'missing-id', selectedVesselName: 'alpha vessel' },
        { selectedVesselNames: ['vessel-a'] }, { selectedVesselNames: ['a'] },
        { selectedVessel: 'vessel-a', selectedVesselNames: ['vessel-b'] },
        { selectedVessel: 'vessel-a', search: 'pump', dueOverdue: 'due2months', periodValue: { mode: 'yearQuarterMonth', year: 2026 } },
      ];
      try {
        for (const scenario of scenarios) {
          const options = { ...base, ...scenario } as LogMatchOptions;
          const expected = await page.evaluate(({ rows, options }) =>
            (window as any).LegacyLog.legacyFilter(rows, options).map((r: any) => r.id), { rows, options });
          const actual = rows.filter(row => matchesDefectLog({ ...row, hasActions: row.actions.length > 0 }, options)).map(r => r.id);
          expect(actual, JSON.stringify(options)).toEqual(expected);
        }
      } finally { await context.close(); }
    }, 45_000);
  }

  it('preserves all-result raw-field filters and export workbook mapping', async () => {
    const page = await browser.newPage();
    await page.addScriptTag({ content: bundle });
    const result = await page.evaluate(({ rows }) => {
      const legacy = (window as any).LegacyLog;
      const filter = {
        priority: { filterType: 'text', operator: 'OR', conditions: [
          { filterType: 'text', type: 'equals', filter: 'high' },
          { filterType: 'text', type: 'blank' },
        ] },
      };
      const full = legacy.filterDefectsForExport(rows, filter);
      const workbook = legacy.buildDefectLogWorkbook(full);
      return { count: full.length, sheets: workbook.SheetNames, range: workbook.Sheets['Defects Log']['!ref'],
        firstDescription: workbook.Sheets['Defects Log'].F2.v };
    }, { rows });
    expect(result).toEqual({ count: 237, sheets: ['Defects Log'], range: 'A1:J238', firstDescription: 'Pump & valve 🚢' });
    await page.close();
  });
});
