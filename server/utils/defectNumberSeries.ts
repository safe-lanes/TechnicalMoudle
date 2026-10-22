/**
 * Defect numbers per side (13-Oct-2026 — Ghazi's decision, option 2; letter/position to be confirmed by Jeevan).
 *
 * Shore (office) and each ship give out defect numbers while offline from each other. Using ONE series on both
 * sides let the same number be given to two different defects (the Testvessel / pilot defect loss). Each side now
 * numbers its OWN series:
 *   ship   : D{vessel}-{yy}-{seq}           e.g. D048-26-0004   (unchanged format)
 *   office : D{vessel}-{yy}-O{seq}          e.g. D048-26-O0001
 * Existing defects keep their numbers. The next number comes from the highest number already used in that series
 * (the defects themselves sync, so this is right after a re-provision too); a local counter is only a floor.
 */

/** Letter marking office-raised defect numbers. Single place to change once the format is confirmed. */
export const OFFICE_DEFECT_SERIES_MARK = 'O';

export type DefectSide = 'ship' | 'shore';

/** The number prefix of one series: everything before the running number. */
export function defectSeriesPrefix(vesselCode: number | string, yearShort: number, side: DefectSide): string {
  const vc = String(vesselCode).padStart(3, '0');
  const yy = String(yearShort % 100).padStart(2, '0');
  return `D${vc}-${yy}-${side === 'shore' ? OFFICE_DEFECT_SERIES_MARK : ''}`;
}

/**
 * Decision D1 (Ghazi, 22-Oct-2026, Jeevan #11): the defect number carries the vessel's V-code —
 *   ship   : {VCODE}-{yy}-{seq}     e.g. 0123-26-0005
 *   office : {VCODE}-{yy}-O{seq}    e.g. 0123-26-O0001
 * Null when the vessel has no usable V-code (letters/digits only) → the caller keeps the D{vessel} series.
 * Existing defects keep their numbers.
 */
export function vcodeDefectSeriesPrefix(vCode: string | null | undefined, yearShort: number, side: DefectSide): string | null {
  const vc = (vCode ?? '').trim();
  if (!/^[A-Za-z0-9]+$/.test(vc)) return null;
  const yy = String(yearShort % 100).padStart(2, '0');
  return `${vc}-${yy}-${side === 'shore' ? OFFICE_DEFECT_SERIES_MARK : ''}`;
}

/** Highest running number used in this series among `ids` (0 if none). Ids of the other series never match. */
export function highestInSeries(ids: readonly string[], prefix: string): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let max = 0;
  for (const id of ids) {
    const m = re.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** The full defect number for a running number. */
export function formatDefectNumber(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(4, '0')}`;
}
