import * as repo from '../repositories/runningHoursRepository';
import { storage } from '../../../storage';

const MAX_HOURS_PER_DAY = 24;
const HIGH_UTILIZATION_THRESHOLD = 20;

export interface RHTimelineEntry {
  date: string;
  runningHours: number;
  source: string;
  sourceReference?: string;
  id?: number;
}

export interface RHValidRange {
  minRH: number;
  maxRH: number;
  previousEntry: {
    date: string;
    runningHours: number;
    source: string;
  } | null;
  nextEntry: {
    date: string;
    runningHours: number;
    source: string;
  } | null;
  recommendedAction: string;
  // Set when the completion date is earlier than the component's RH baseline, i.e. there is no
  // real RH entry dated on or before the completion date. Recording RH before the latest known
  // reading corrupts the timeline, so this is reported as INVALID_BACKDATED by validateRHEntry.
  backdatedBeforeBaseline?: boolean;
  baselineDate?: string;
  baselineRH?: number;
}

export interface RHValidationResult {
  isValid: boolean;
  validationStatus: 'VALID' | 'INVALID_BACKWARD' | 'INVALID_FORWARD' | 'INVALID_DECREASE' | 'INVALID_BACKDATED' | 'HIGH_UTILIZATION';
  errorMessage: string;
  validRange: {
    min: number;
    max: number;
  };
  utilizationRate: number;
  requiresJustification: boolean;
  anomalyFlags: string[];
  previousEntry: {
    date: string;
    runningHours: number;
  } | null;
  nextEntry: {
    date: string;
    runningHours: number;
  } | null;
  daysBetweenPrevious: number;
  daysBetweenNext: number;
  maxPossibleIncrease: number;
  actualIncrease: number;
}

export interface RHTimelineViewEntry {
  id: number;
  date: string;
  rhValue: number;
  change: number | null;
  hrsPerDay: number | null;
  source: string;
  sourceReference: string | null;
  status: string;
  enteredBy: string;
  notes: string | null;
  validationDetails: any;
}

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getDaysBetween(date1: Date, date2: Date): number {
  // Signed (date2 - date1). Direction matters: a backward gap (date2 before date1) must NOT be
  // read as a positive forward allowance. Call sites only pass correctly-ordered dates (previous
  // <= target, target < next), so this is non-negative in practice; the backdated-before-baseline
  // case is detected and rejected in getValidRange/validateRHEntry before any gap maths runs.
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
}

function formatDMY(isoDate: string): string {
  if (!isoDate) return isoDate;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${m[3]}-${months[monthIdx] || m[2]}-${m[1]}`;
}

function normalizeAuditDate(audit: any): string {
  if (audit.dateUpdatedLocal) {
    const dateStr = audit.dateUpdatedLocal;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    const formats = dateStr.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (formats) {
      const months: Record<string, string> = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
      };
      const month = months[formats[2]];
      if (month) {
        return `${formats[3]}-${month}-${formats[1].padStart(2, '0')}`;
      }
    }
    return dateStr;
  }
  if (audit.enteredAtUTC) {
    return new Date(audit.enteredAtUTC).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

async function getTimelineForComponent(componentId: string): Promise<RHTimelineEntry[]> {
  const audits = await repo.getRunningHoursAudits(componentId);

  const entries: RHTimelineEntry[] = audits.map(a => ({
    date: normalizeAuditDate(a),
    runningHours: parseFloat(a.cumulativeRH?.toString() || a.newRH?.toString() || '0'),
    source: a.source || 'unknown',
    sourceReference: a.notes || undefined,
    id: a.id
  }));

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}

export async function getValidRange(
  machineryId: string,
  completionDate: string
): Promise<RHValidRange> {
  const timeline = await getTimelineForComponent(machineryId);
  const targetDate = parseDate(completionDate);

  let previousEntry: RHTimelineEntry | null = null;
  let nextEntry: RHTimelineEntry | null = null;

  for (const entry of timeline) {
    const entryDate = parseDate(entry.date);
    if (entryDate.getTime() <= targetDate.getTime()) {
      if (!previousEntry || entryDate.getTime() >= parseDate(previousEntry.date).getTime()) {
        previousEntry = entry;
      }
    }
    if (entryDate.getTime() > targetDate.getTime()) {
      if (!nextEntry || entryDate.getTime() < parseDate(nextEntry.date).getTime()) {
        nextEntry = entry;
      }
    }
  }

  let backdatedBeforeBaseline = false;
  let baselineDate: string | undefined;
  let baselineRH: number | undefined;

  if (!previousEntry) {
    const component = await repo.getComponent(machineryId);
    if (component) {
      const currentRH = parseFloat(component.currentCumulativeRH || '0');
      // Only treat the component's own state as a reference when it carries a REAL last-updated
      // date. A fabricated "now" fallback (no lastUpdated/rhMasterUpdatedAt at all) means there is
      // no RH baseline to compare against (brand-new component) — that must NOT be blocked.
      const rawLastUpdated = component.lastUpdated
        || (component.rhMasterUpdatedAt ? component.rhMasterUpdatedAt.toISOString() : null);
      if (rawLastUpdated) {
        const stateDateStr = rawLastUpdated.split('T')[0];
        const stateDate = parseDate(stateDateStr);
        if (stateDate.getTime() <= targetDate.getTime()) {
          // Baseline is on/before the completion date → normal "previous" anchor.
          previousEntry = {
            date: stateDateStr,
            runningHours: currentRH,
            source: 'COMPONENT_STATE'
          };
        } else {
          // The only known RH reference is dated AFTER the completion date. The completion predates
          // the baseline: there is no real entry on/before it. Never label this future-dated state
          // as the "previous" entry — flag it and treat it as a forward constraint instead.
          backdatedBeforeBaseline = true;
          baselineDate = stateDateStr;
          baselineRH = currentRH;
          if (!nextEntry || stateDate.getTime() < parseDate(nextEntry.date).getTime()) {
            nextEntry = {
              date: stateDateStr,
              runningHours: currentRH,
              source: 'COMPONENT_STATE'
            };
          }
        }
      }
    }
  }

  if (backdatedBeforeBaseline) {
    return {
      minRH: 0,
      maxRH: nextEntry ? nextEntry.runningHours : 0,
      previousEntry: null,
      nextEntry: nextEntry ? {
        date: nextEntry.date,
        runningHours: nextEntry.runningHours,
        source: nextEntry.source
      } : null,
      recommendedAction: 'MANUAL_ENTRY_REQUIRED',
      backdatedBeforeBaseline: true,
      baselineDate,
      baselineRH
    };
  }

  if (!previousEntry) {
    return {
      minRH: 0,
      maxRH: Infinity,
      previousEntry: null,
      nextEntry: null,
      recommendedAction: 'MANUAL_ENTRY_REQUIRED'
    };
  }

  const daysToPrev = getDaysBetween(parseDate(previousEntry.date), targetDate);

  let minRH = previousEntry.runningHours;
  let maxRH = previousEntry.runningHours + (daysToPrev * MAX_HOURS_PER_DAY);

  if (nextEntry) {
    const daysToNext = getDaysBetween(targetDate, parseDate(nextEntry.date));
    const minFromForward = nextEntry.runningHours - (daysToNext * MAX_HOURS_PER_DAY);
    minRH = Math.max(minRH, minFromForward);
    maxRH = Math.min(maxRH, nextEntry.runningHours);
  }

  return {
    minRH: Math.max(0, minRH),
    maxRH,
    previousEntry: {
      date: previousEntry.date,
      runningHours: previousEntry.runningHours,
      source: previousEntry.source
    },
    nextEntry: nextEntry ? {
      date: nextEntry.date,
      runningHours: nextEntry.runningHours,
      source: nextEntry.source
    } : null,
    recommendedAction: daysToPrev <= 1 ? 'USE_CURRENT' : 'MANUAL_ENTRY_REQUIRED'
  };
}

export async function validateRHEntry(
  machineryId: string,
  completionDate: string,
  enteredRH: number
): Promise<RHValidationResult> {
  const range = await getValidRange(machineryId, completionDate);
  const targetDate = parseDate(completionDate);

  // Reject a completion that predates the component's RH baseline: there is no real RH entry dated
  // on or before the completion date, so the entry cannot be anchored. (Legitimate backdating
  // BETWEEN two existing historical entries is unaffected — that produces a real previousEntry and
  // never sets this flag.)
  if (range.backdatedBeforeBaseline) {
    return {
      isValid: false,
      validationStatus: 'INVALID_BACKDATED',
      errorMessage: `Completion Date ${formatDMY(completionDate)} is earlier than the component's last running-hours update (${formatDMY(range.baselineDate || '')}). There is no running-hours entry on or before this date, so running hours cannot be recorded here. Running hours can only be recorded on or after the latest reading.`,
      validRange: { min: range.minRH, max: range.maxRH },
      utilizationRate: 0,
      requiresJustification: false,
      anomalyFlags: ['BACKDATED_BEFORE_BASELINE'],
      previousEntry: null,
      nextEntry: range.nextEntry ? { date: range.nextEntry.date, runningHours: range.nextEntry.runningHours } : null,
      daysBetweenPrevious: 0,
      daysBetweenNext: 0,
      maxPossibleIncrease: 0,
      actualIncrease: 0
    };
  }

  const anomalyFlags: string[] = [];
  let daysBetweenPrevious = 0;
  let daysBetweenNext = 0;
  let actualIncrease = 0;
  let maxPossibleIncrease = 0;
  let utilizationRate = 0;

  if (range.previousEntry) {
    daysBetweenPrevious = getDaysBetween(parseDate(range.previousEntry.date), targetDate);
    actualIncrease = enteredRH - range.previousEntry.runningHours;
    maxPossibleIncrease = daysBetweenPrevious * MAX_HOURS_PER_DAY;
  }

  if (range.nextEntry) {
    daysBetweenNext = getDaysBetween(targetDate, parseDate(range.nextEntry.date));
  }

  if (range.previousEntry && enteredRH < range.previousEntry.runningHours) {
    return {
      isValid: false,
      validationStatus: 'INVALID_DECREASE',
      errorMessage: `Running hours cannot go backward! Previous RH entry: ${range.previousEntry.runningHours} hours on ${range.previousEntry.date}. Your entry: ${enteredRH} hours (${range.previousEntry.runningHours - enteredRH} hours LESS than previous). Running hours can only increase or stay the same, never decrease.`,
      validRange: { min: range.minRH, max: range.maxRH },
      utilizationRate: 0,
      requiresJustification: false,
      anomalyFlags: ['BACKWARD_VIOLATION'],
      previousEntry: range.previousEntry ? { date: range.previousEntry.date, runningHours: range.previousEntry.runningHours } : null,
      nextEntry: range.nextEntry ? { date: range.nextEntry.date, runningHours: range.nextEntry.runningHours } : null,
      daysBetweenPrevious,
      daysBetweenNext,
      maxPossibleIncrease,
      actualIncrease
    };
  }

  if (range.previousEntry && actualIncrease > maxPossibleIncrease && daysBetweenPrevious > 0) {
    return {
      isValid: false,
      validationStatus: 'INVALID_BACKWARD',
      errorMessage: `This is physically impossible because: Previous RH entry: ${range.previousEntry.runningHours} hours on ${range.previousEntry.date}. Days between: ${daysBetweenPrevious} days. Maximum possible increase: ${maxPossibleIncrease} hours (${daysBetweenPrevious} days × ${MAX_HOURS_PER_DAY} hrs/day). Your entered increase: ${actualIncrease} hours. Valid RH range for ${completionDate}: ${range.minRH.toFixed(0)} to ${range.maxRH.toFixed(0)} hours.`,
      validRange: { min: range.minRH, max: range.maxRH },
      utilizationRate: 0,
      requiresJustification: false,
      anomalyFlags: ['EXCEEDS_MAX_RATE'],
      previousEntry: range.previousEntry ? { date: range.previousEntry.date, runningHours: range.previousEntry.runningHours } : null,
      nextEntry: range.nextEntry ? { date: range.nextEntry.date, runningHours: range.nextEntry.runningHours } : null,
      daysBetweenPrevious,
      daysBetweenNext,
      maxPossibleIncrease,
      actualIncrease
    };
  }

  if (range.nextEntry && enteredRH > range.nextEntry.runningHours) {
    return {
      isValid: false,
      validationStatus: 'INVALID_FORWARD',
      errorMessage: `This conflicts with future RH data: Next RH entry: ${range.nextEntry.runningHours} hours on ${range.nextEntry.date}. Your entry of ${enteredRH} hours exceeds the next recorded value. Running hours entered for a backdated work order cannot exceed future recorded values.`,
      validRange: { min: range.minRH, max: range.maxRH },
      utilizationRate: 0,
      requiresJustification: false,
      anomalyFlags: ['EXCEEDS_FUTURE_ENTRY'],
      previousEntry: range.previousEntry ? { date: range.previousEntry.date, runningHours: range.previousEntry.runningHours } : null,
      nextEntry: range.nextEntry ? { date: range.nextEntry.date, runningHours: range.nextEntry.runningHours } : null,
      daysBetweenPrevious,
      daysBetweenNext,
      maxPossibleIncrease,
      actualIncrease
    };
  }

  if (range.nextEntry) {
    const requiredIncrease = range.nextEntry.runningHours - enteredRH;
    const maxForwardIncrease = daysBetweenNext * MAX_HOURS_PER_DAY;
    if (requiredIncrease > maxForwardIncrease && daysBetweenNext > 0) {
      return {
        isValid: false,
        validationStatus: 'INVALID_FORWARD',
        errorMessage: `This conflicts with future RH data: Next RH entry: ${range.nextEntry.runningHours} hours on ${range.nextEntry.date}. Days between: ${daysBetweenNext} days. Required increase from your entry: ${requiredIncrease.toFixed(0)} hours. Maximum possible in ${daysBetweenNext} days: ${maxForwardIncrease} hours (${daysBetweenNext} × ${MAX_HOURS_PER_DAY} hrs/day). Valid RH range for ${completionDate}: ${range.minRH.toFixed(0)} to ${range.maxRH.toFixed(0)} hours. Your entry would require the machinery to run more than ${MAX_HOURS_PER_DAY} hours per day to reach the next recorded value.`,
        validRange: { min: range.minRH, max: range.maxRH },
        utilizationRate: 0,
        requiresJustification: false,
        anomalyFlags: ['FORWARD_VIOLATION'],
        previousEntry: range.previousEntry ? { date: range.previousEntry.date, runningHours: range.previousEntry.runningHours } : null,
        nextEntry: { date: range.nextEntry.date, runningHours: range.nextEntry.runningHours },
        daysBetweenPrevious,
        daysBetweenNext,
        maxPossibleIncrease,
        actualIncrease
      };
    }
  }

  if (range.previousEntry && daysBetweenPrevious > 0) {
    utilizationRate = actualIncrease / daysBetweenPrevious;
  }

  if (range.previousEntry && actualIncrease === 0) {
    anomalyFlags.push('ZERO_INCREASE');
  }

  const requiresJustification = utilizationRate > HIGH_UTILIZATION_THRESHOLD;
  if (requiresJustification) {
    anomalyFlags.push('HIGH_UTILIZATION');
  }

  return {
    isValid: true,
    validationStatus: requiresJustification ? 'HIGH_UTILIZATION' : 'VALID',
    errorMessage: requiresJustification
      ? `High machinery utilization detected: ${utilizationRate.toFixed(1)} hours/day average usage. This indicates the machinery ran nearly continuously. Justification required before saving.`
      : `Valid entry (${utilizationRate.toFixed(1)} hrs/day average usage)`,
    validRange: { min: range.minRH, max: range.maxRH },
    utilizationRate,
    requiresJustification,
    anomalyFlags,
    previousEntry: range.previousEntry ? { date: range.previousEntry.date, runningHours: range.previousEntry.runningHours } : null,
    nextEntry: range.nextEntry ? { date: range.nextEntry.date, runningHours: range.nextEntry.runningHours } : null,
    daysBetweenPrevious,
    daysBetweenNext,
    maxPossibleIncrease,
    actualIncrease
  };
}

export async function getRHTimeline(
  machineryId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<RHTimelineViewEntry[]> {
  const audits = await repo.getRunningHoursAudits(machineryId);

  let filtered = audits;
  if (dateFrom || dateTo) {
    filtered = audits.filter(a => {
      const date = normalizeAuditDate(a);
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    });
  }

  filtered.sort((a, b) => {
    const dateA = normalizeAuditDate(a);
    const dateB = normalizeAuditDate(b);
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const entries: RHTimelineViewEntry[] = [];
  let prevRH: number | null = null;
  let prevDate: string | null = null;

  for (const audit of filtered) {
    const date = normalizeAuditDate(audit);
    const rhValue = parseFloat(audit.cumulativeRH?.toString() || audit.newRH?.toString() || '0');
    let change: number | null = null;
    let hrsPerDay: number | null = null;

    if (prevRH !== null && prevDate) {
      change = rhValue - prevRH;
      const days = getDaysBetween(parseDate(prevDate), parseDate(date));
      if (days > 0 && change >= 0) {
        hrsPerDay = Math.round((change / days) * 10) / 10;
      }
    }

    let status = '✅ Validated';
    if (hrsPerDay !== null && hrsPerDay > HIGH_UTILIZATION_THRESHOLD) {
      status = '⚠️ High Util';
    }
    if (change !== null && change < 0) {
      status = '❌ Decrease';
    }

    const sourceMap: Record<string, string> = {
      single: 'RH Module',
      bulk: 'RH Module (Bulk)',
      cascade: 'RH Module (Cascade)',
      inherited_cascade: 'RH Module (Inherited)',
      manual: 'Manual Entry',
      workorder: 'Work Order',
      reset: 'Reset',
      WO_COMPLETION: 'Work Order'
    };

    entries.push({
      id: audit.id,
      date,
      rhValue,
      change,
      hrsPerDay,
      source: sourceMap[audit.source] || audit.source,
      sourceReference: audit.notes || null,
      status,
      enteredBy: audit.userId || 'System',
      notes: audit.notes || null,
      validationDetails: null
    });

    prevRH = rhValue;
    prevDate = date;
  }

  entries.reverse();
  return entries;
}

export async function getCurrentRH(machineryId: string): Promise<{
  currentRH: number;
  lastUpdated: string;
  hasRealRhBaseline: boolean;
  source: string;
  updatedBy: string;
  rhCounterType: string;
}> {
  const component = await repo.getComponent(machineryId);
  if (!component) {
    throw new Error(`Component not found: ${machineryId}`);
  }

  let rhSource: string | null;
  let rhLastUpdated: Date | string | null;
  if (component.rhCounterType === 'INHERITED') {
    rhSource = component.rhCurrentInheritedCached || component.currentCumulativeRH;
    rhLastUpdated = component.rhInheritedUpdatedAt || component.rhMasterUpdatedAt;
    if ((!rhSource || parseFloat(rhSource) === 0) && component.rhMasterComponentId) {
      try {
        let masterComponent = await repo.getComponent(component.rhMasterComponentId);
        if (!masterComponent && component.vesselId) {
          const allComponents = await repo.getComponents(component.vesselId);
          masterComponent = allComponents.find((c: any) => c.componentCode === component.rhMasterComponentId);
        }
        if (masterComponent) {
          const masterRH = masterComponent.rhCurrentMaster || masterComponent.currentCumulativeRH;
          if (masterRH && parseFloat(masterRH) > 0) {
            rhSource = masterRH;
            rhLastUpdated = masterComponent.rhMasterUpdatedAt || masterComponent.updatedAt;
          }
        }
      } catch {}
    }
  } else {
    rhSource = component.rhCurrentMaster || component.currentCumulativeRH;
    rhLastUpdated = component.rhMasterUpdatedAt;
  }
  const currentRH = parseFloat(rhSource || '0');
  // `hasRealRhBaseline` records whether `lastUpdated` is a genuine RH reference (a real master/
  // inherited RH update date or the legacy `lastUpdated` field) BEFORE the `updatedAt`/`now`
  // fabrication below. The client must only treat the completion date as "backdated before
  // baseline" when this is true — a brand-new component with no real RH reference must never be
  // blocked (matches the timeline validator, which also ignores the fabricated fallback).
  const hasRealRhBaseline = !!(rhLastUpdated || component.lastUpdated);
  const lastUpdated = (rhLastUpdated ? (typeof rhLastUpdated === 'string' ? rhLastUpdated : rhLastUpdated.toISOString()) : null)
    || component.lastUpdated
    || component.updatedAt?.toISOString()
    || new Date().toISOString();

  return {
    currentRH,
    lastUpdated,
    hasRealRhBaseline,
    source: 'RH_MODULE',
    updatedBy: component.rhMasterUpdatedBy || 'System',
    rhCounterType: (component.rhCounterType || 'MASTER').toUpperCase()
  };
}
