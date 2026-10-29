import { parseFragment, defaultTreeAdapter } from 'parse5';
import { TZDate } from '@date-fns/tz';

/** Browser context for the approved bounded server-side scalar matcher. */
export interface LogMatchOptions {
  selectedVessel?: string;
  selectedVesselName?: string;
  selectedVesselNames?: string[];
  search?: string;
  periodValue?: {
    mode: string; year?: number; month?: number; quarter?: number;
    dateFrom?: string; dateTo?: string;
  } | null;
  dueOverdue?: string;
  timeZone: string;
  locale: string;
  now: string;
}

type Row = {
  id?: string | null; vesselId?: string | null; vesselName?: string | null; issueDate?: string | null;
  category?: string | null; is_coc?: boolean | null; componentHardwareLevel3?: string | null;
  description?: string | null; targetCloseDate?: string | null; dateCompleted?: string | null;
  verified?: boolean | null; isDeferred?: boolean | null; hasActions?: boolean; priority?: string | null;
};

/** Same fragment context as document.createElement("div").innerHTML. */
export function browserText(html: string): string {
  const div = defaultTreeAdapter.createElement('div', 'http://www.w3.org/1999/xhtml' as any, []);
  const tree = parseFragment(div, html, {});
  const text = (node: any): string => node.nodeName === '#text'
    ? node.value : (node.childNodes || []).map(text).join('');
  return text(tree);
}

function dates(timeZone: string) {
  // Explicit-zone timestamps and ISO date-only strings denote instants;
  // timezone-free strings denote browser wall time, not the server's timezone.
  const parse = (value: string): TZDate => {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return new TZDate(NaN, timeZone);
    const s = value.trim().replace(/\([^)]*\)/g, '').trim();
    const isoDay = /^[+-]?\d{4,6}(?:-\d{2}(?:-\d{2})?)?$/.test(s);
    const namedZone = /Z\s*$|\b(?:Z|UT|UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)(?![a-z])/i.test(s);
    // A trailing "-2026" can be the YEAR in a legacy date, not a zone.
    // Numeric zones need a preceding clock (and can precede the calendar).
    const clockZone = /\d{1,2}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?\s*[+-]\d{1,4}(?::\d{2})?(?:\s|$)/.test(s);
    const zoneBeforeClock = /(?:^|\s)[+-]\d{1,4}(?::\d{2})?(?:\s|$)/.test(s) && /\d{1,2}:\d{1,2}/.test(s);
    if (isoDay || namedZone || clockZone || zoneBeforeClock) return new TZDate(timestamp, timeZone);
    // Parse unzoned wall components in UTC before applying the browser zone.
    // This also avoids the host timezone normalizing a DST gap prematurely.
    const neutral = Date.parse(/^\d{4}-\d{2}-\d{2}T/.test(s) ? `${s}Z` : `${s} GMT`);
    const utc = new Date(Number.isFinite(neutral) ? neutral : timestamp);
    return new TZDate(
      utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(),
      utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds(),
      utc.getUTCMilliseconds(), timeZone,
    );
  };
  const structured = (value: string, dayFirstPrefix = false): TZDate => {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    const dmy = (dayFirstPrefix ? /^(\d{2})-(\d{2})-(\d{4})/ : /^(\d{2})-(\d{2})-(\d{4})$/).exec(value);
    return iso ? new TZDate(+iso[1], +iso[2] - 1, +iso[3], timeZone)
      : dmy ? new TZDate(+dmy[3], +dmy[2] - 1, +dmy[1], timeZone) : parse(value);
  };
  const midnight = (date: TZDate) => { date.setHours(0, 0, 0, 0); return date; };
  return { parse, structured, midnight };
}

export function createDefectLogMatcher(options: LogMatchOptions): (row: Row) => boolean {
  const { selectedVessel = 'all', selectedVesselName = '', selectedVesselNames = [] } = options;
  const names = selectedVesselNames.map(n => n.toLowerCase().trim());
  const d = dates(options.timeZone);
  const today = d.midnight(new TZDate(options.now, options.timeZone));
  const valid = (date: Date) => !Number.isNaN(date.getTime());
  const search = options.search?.trim().toLocaleLowerCase(options.locale);
  const monthFormatter = search ? new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }) : null;
  return row => {
  if (selectedVessel !== 'all' && row.vesselId !== selectedVessel &&
    (!selectedVesselName || (row.vesselName || '').toLowerCase().trim() !== selectedVesselName)) return false;
  if (selectedVesselNames.length) {
    const vessel = (row.vesselId || row.vesselName || '').toLowerCase().trim();
    if (!names.some(name => {
      return name === vessel || vessel.includes(name) || name.includes(vessel);
    })) return false;
  }
  if (search) {
    const format = (value?: string | null) => {
      if (value == null || value === '') return '';
      const s = value.trim();
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
      const date = d.structured(s);
      if (!iso && !dmy && !valid(date)) return value;
      const year = iso ? +iso[1] : dmy ? +dmy[3] : date.getFullYear();
      const month = iso ? +iso[2] : dmy ? +dmy[2] : date.getMonth() + 1;
      const day = iso ? +iso[3] : dmy ? +dmy[1] : date.getDate();
      const shortMonth = monthFormatter!.format(new Date(Date.UTC(year, month - 1, 1)));
      return `${String(day).padStart(2, '0')} ${shortMonth} ${year}`;
    };
    const completed = row.dateCompleted ? d.structured(row.dateCompleted, true) : null;
    const target = row.targetCloseDate ? d.structured(row.targetCloseDate, true) : null;
    const status = row.verified === true ? 'Verified'
      : completed && valid(completed) ? 'Closed'
      : target && valid(target) && d.midnight(target) < today ? 'Overdue'
      : row.isDeferred === true ? 'Extended' : row.hasActions ? 'In Progress' : 'Reported';
    const values = [
      row.id || '', row.vesselName || '', format(row.issueDate),
      `${row.category || 'Defect'}${row.is_coc === true ? ' (CoC)' : ''}`,
      row.componentHardwareLevel3 || '-', browserText(row.description || ''),
      format(row.targetCloseDate), format(row.dateCompleted), status, row.priority || '-',
    ];
    if (!values.some(value => value.toLocaleLowerCase(options.locale).includes(search))) return false;
  }
  const pv = options.periodValue;
  if (pv) {
    if (!row.issueDate) return false;
    const date = d.midnight(d.structured(String(row.issueDate)));
    if (!valid(date)) return false;
    if (pv.mode === 'yearQuarterMonth') {
      if (pv.month !== undefined && pv.year) {
        if (date.getFullYear() !== pv.year || date.getMonth() !== pv.month) return false;
      } else if (pv.quarter !== undefined && pv.year) {
        const start = (pv.quarter - 1) * 3;
        if (date.getFullYear() !== pv.year || date.getMonth() < start || date.getMonth() > start + 2) return false;
      } else if (pv.year && date.getFullYear() !== pv.year) return false;
    } else if (pv.mode === 'dateRange') {
      if (pv.dateFrom && date < d.midnight(d.parse(pv.dateFrom))) return false;
      if (pv.dateTo) {
        const to = d.parse(pv.dateTo); to.setHours(23, 59, 59, 999);
        if (date > to) return false;
      }
    }
  }
  if (options.dueOverdue && options.dueOverdue !== 'all') {
    if (!row.targetCloseDate) return false;
    const target = d.midnight(d.parse(row.targetCloseDate));
    const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
    if (options.dueOverdue === 'overdue' && !(days < 0)) return false;
    if (options.dueOverdue === 'due1month' && !(days >= 0 && days <= 30)) return false;
    if (options.dueOverdue === 'due2months' && !(days >= 0 && days <= 60)) return false;
  }
  return true;
  };
}

export function matchesDefectLog(row: Row, options: LogMatchOptions): boolean {
  return createDefectLogMatcher(options)(row);
}
