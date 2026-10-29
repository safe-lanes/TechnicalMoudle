// Frozen pre-pagination browser behaviour. Do not share the new reader's matching
// code with this oracle: it must independently detect SQL/helper regressions.
import type { Defect } from '@shared/schema';
import { makeDefectLogExportRow, filterDefectsForExport, buildDefectLogWorkbook } from '../../../../../client/src/pages/defects/defectLogExport';

export function legacyFilter(defects: Defect[], options: any): Defect[] {
  let result = defects;
  const { selectedVessel = 'all', selectedVesselName = '', selectedVesselNames = [], search, periodValue, dueOverdue } = options;
  if (selectedVessel !== 'all') {
    result = result.filter(defect => {
      if (defect.vesselId === selectedVessel) return true;
      if (selectedVesselName) return (defect.vesselName || '').toLowerCase().trim() === selectedVesselName;
      return false;
    });
  }
  if (selectedVesselNames.length > 0) {
    const names = selectedVesselNames.map((n: string) => n.toLowerCase().trim());
    result = result.filter(defect => {
      const vessel = (defect.vesselId || defect.vesselName || '').toLowerCase().trim();
      return names.some((name: string) => name === vessel || vessel.includes(name) || name.includes(vessel));
    });
  }
  if (search?.trim()) {
    const needle = search.trim().toLocaleLowerCase();
    result = result.filter(defect => Object.values(makeDefectLogExportRow(defect))
      .some(value => value.toLocaleLowerCase().includes(needle)));
  }
  if (periodValue) {
    const pv = periodValue;
    result = result.filter(defect => {
      if (!defect.issueDate) return false;
      const val = String(defect.issueDate);
      const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const dmy = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      const date = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3])
        : dmy ? new Date(+dmy[3], +dmy[2] - 1, +dmy[1]) : new Date(val);
      if (isNaN(date.getTime())) return false;
      date.setHours(0, 0, 0, 0);
      if (pv.mode === 'yearQuarterMonth') {
        if (pv.month !== undefined && pv.year) return date.getFullYear() === pv.year && date.getMonth() === pv.month;
        if (pv.quarter !== undefined && pv.year) {
          const start = (pv.quarter - 1) * 3;
          return date.getFullYear() === pv.year && date.getMonth() >= start && date.getMonth() <= start + 2;
        }
        if (pv.year) return date.getFullYear() === pv.year;
      } else if (pv.mode === 'dateRange') {
        if (pv.dateFrom) {
          const from = new Date(pv.dateFrom); from.setHours(0, 0, 0, 0);
          if (date < from) return false;
        }
        if (pv.dateTo) {
          const to = new Date(pv.dateTo); to.setHours(23, 59, 59, 999);
          if (date > to) return false;
        }
        return true;
      }
      return true;
    });
  }
  if (dueOverdue && dueOverdue !== 'all') {
    const today = new Date(options.now); today.setHours(0, 0, 0, 0);
    result = result.filter(defect => {
      if (!defect.targetCloseDate) return false;
      const target = new Date(defect.targetCloseDate); target.setHours(0, 0, 0, 0);
      const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
      switch (dueOverdue) {
        case 'overdue': return days < 0;
        case 'due1month': return days >= 0 && days <= 30;
        case 'due2months': return days >= 0 && days <= 60;
        default: return true;
      }
    });
  }
  return result;
}
export { makeDefectLogExportRow, filterDefectsForExport, buildDefectLogWorkbook };
