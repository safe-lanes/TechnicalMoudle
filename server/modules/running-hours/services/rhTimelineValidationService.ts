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
}

export interface RHValidationResult {
  isValid: boolean;
  validationStatus: 'VALID' | 'INVALID_BACKWARD' | 'INVALID_FORWARD' | 'INVALID_DECREASE' | 'HIGH_UTILIZATION';
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
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((date2.getTime() - date1.getTime()) / msPerDay));
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

  if (!previousEntry) {
    const component = await repo.getComponent(machineryId);
    if (component) {
      const currentRH = parseFloat(component.currentCumulativeRH || '0');
      const lastUpdated = component.lastUpdated || component.rhMasterUpdatedAt?.toISOString() || new Date().toISOString();
      previousEntry = {
        date: lastUpdated.split('T')[0],
        runningHours: currentRH,
        source: 'COMPONENT_STATE'
      };
    }
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
  source: string;
  updatedBy: string;
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
  } else {
    rhSource = component.rhCurrentMaster || component.currentCumulativeRH;
    rhLastUpdated = component.rhMasterUpdatedAt;
  }
  const currentRH = parseFloat(rhSource || '0');
  const lastUpdated = (rhLastUpdated ? (typeof rhLastUpdated === 'string' ? rhLastUpdated : rhLastUpdated.toISOString()) : null)
    || component.lastUpdated
    || component.updatedAt?.toISOString()
    || new Date().toISOString();

  return {
    currentRH,
    lastUpdated,
    source: 'RH_MODULE',
    updatedBy: component.rhMasterUpdatedBy || 'System'
  };
}
