import { storage } from '../../../storage';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';

// Shared parser (dateParse.ts contract): wo.dueDate / completion strings are
// MIXED-format; raw new Date() swapped or invalidated DD-MM-YYYY values
// (skewing daysLate stats, and an Invalid completion date would THROW at the
// toISOString() date-key below, killing the whole compliance computation).
function woDate(value: any): Date | null {
  return parseWorkOrderDate(value);
}

interface CycleSkipBreakdown {
  rank: string;
  totalWOs: number;
  skippedWOs: number;
  rate: number;
  severity: 'green' | 'yellow' | 'red';
}

interface BackdatedEntry {
  woCode: string;
  jobTitle: string;
  completionDate: string;
  submittedDate: string;
  daysDiff: number;
  performedBy: string;
}

interface BulkCompletionEvent {
  date: string;
  totalCompleted: number;
  overdueCompleted: number;
  performedBy: string;
}

interface ComplianceAnomalies {
  cycleSkipRate: {
    highestRate: number;
    highestRank: string;
    severity: 'green' | 'yellow' | 'red';
    breakdown: CycleSkipBreakdown[];
  };
  backdatingFrequency: {
    percentage: number;
    severity: 'green' | 'yellow' | 'red';
    recentBackdated: BackdatedEntry[];
  };
  bulkCompletions: {
    eventCount: number;
    severity: 'green' | 'yellow' | 'red';
    events: BulkCompletionEvent[];
  };
  scheduleDrift: {
    averageDaysLate: number;
    severity: 'green' | 'yellow' | 'red';
    median: number;
    worst: { woCode: string; jobTitle: string; daysLate: number } | null;
    bestOnTimeCount: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

const cache = new Map<string, { result: ComplianceAnomalies; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000;

const COMPLETED_STATUSES = new Set([
  'Completed',
  'Approved',
  'Closed',
  'Done',
]);

export function invalidateComplianceCache() {
  cache.clear();
}

function getSeverity(value: number, yellowThreshold: number, redThreshold: number): 'green' | 'yellow' | 'red' {
  if (value >= redThreshold) return 'red';
  if (value >= yellowThreshold) return 'yellow';
  return 'green';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function getComplianceAnomalies(vesselId?: string): Promise<ComplianceAnomalies> {
  const cacheKey = vesselId || '__all__';
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const allWOs = await storage.getWorkOrders(vesselId);
  const completedWOs = allWOs.filter((wo: any) =>
    COMPLETED_STATUSES.has(wo.status) && wo.dataScope !== 'fleet'
  );

  const cycleSkipRate = calculateCycleSkipRate(completedWOs);
  const backdatingFrequency = calculateBackdatingFrequency(completedWOs, thirtyDaysAgo);
  const bulkCompletions = calculateBulkCompletions(completedWOs, ninetyDaysAgo);
  const scheduleDrift = calculateScheduleDrift(completedWOs, ninetyDaysAgo);

  const result: ComplianceAnomalies = {
    cycleSkipRate,
    backdatingFrequency,
    bulkCompletions,
    scheduleDrift,
  };

  cache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}

function calculateCycleSkipRate(completedWOs: any[]) {
  const byPerformer: Record<string, { total: number; skipped: number }> = {};

  for (const wo of completedWOs) {
    const performer = wo.performedBy || wo.assignedTo || 'Unknown';
    if (!byPerformer[performer]) {
      byPerformer[performer] = { total: 0, skipped: 0 };
    }
    byPerformer[performer].total++;
    if ((wo.missedCycles ?? 0) >= 1) {
      byPerformer[performer].skipped++;
    }
  }

  const breakdown: CycleSkipBreakdown[] = Object.entries(byPerformer)
    .map(([rank, data]) => {
      const rate = data.total > 0 ? Math.round((data.skipped / data.total) * 100) : 0;
      return {
        rank,
        totalWOs: data.total,
        skippedWOs: data.skipped,
        rate,
        severity: getSeverity(rate, 10, 20) as 'green' | 'yellow' | 'red',
      };
    })
    .sort((a, b) => b.rate - a.rate);

  const highest = breakdown[0];

  return {
    highestRate: highest?.rate ?? 0,
    highestRank: highest?.rank ?? 'N/A',
    severity: getSeverity(highest?.rate ?? 0, 10, 20) as 'green' | 'yellow' | 'red',
    breakdown,
  };
}

function calculateBackdatingFrequency(completedWOs: any[], thirtyDaysAgo: Date) {
  const recentWOs = completedWOs.filter(wo => {
    const completedDate = woDate(wo.dateCompleted || wo.completionDateTime);
    return completedDate !== null && completedDate >= thirtyDaysAgo;
  });

  const backdated: BackdatedEntry[] = [];

  for (const wo of recentWOs) {
    const completionDateStr = wo.dateCompleted || wo.completionDateTime;
    const submittedDateStr = wo.submittedDate || wo.updatedAt;
    if (!completionDateStr || !submittedDateStr) continue;

    const completionDate = woDate(completionDateStr);
    const submittedDate = woDate(submittedDateStr);
    if (!completionDate || !submittedDate) continue;
    const daysDiff = Math.floor((submittedDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 7) {
      backdated.push({
        woCode: wo.workOrderNo || `WO-${wo.id}`,
        jobTitle: wo.jobTitle || '',
        completionDate: completionDateStr,
        submittedDate: submittedDateStr instanceof Date ? submittedDateStr.toISOString() : submittedDateStr,
        daysDiff,
        performedBy: wo.performedBy || wo.assignedTo || 'Unknown',
      });
    }
  }

  backdated.sort((a, b) => b.daysDiff - a.daysDiff);

  const percentage = recentWOs.length > 0
    ? Math.round((backdated.length / recentWOs.length) * 100)
    : 0;

  return {
    percentage,
    severity: getSeverity(percentage, 5, 15) as 'green' | 'yellow' | 'red',
    recentBackdated: backdated.slice(0, 20),
  };
}

function calculateBulkCompletions(completedWOs: any[], ninetyDaysAgo: Date) {
  const byDate: Record<string, { wos: any[]; overdueCount: number }> = {};

  for (const wo of completedWOs) {
    const completedStr = wo.dateCompleted || wo.completionDateTime;
    if (!completedStr) continue;

    const completedDate = woDate(completedStr);
    if (!completedDate || completedDate < ninetyDaysAgo) continue;

    const dateKey = completedDate.toISOString().split('T')[0];
    if (!byDate[dateKey]) {
      byDate[dateKey] = { wos: [], overdueCount: 0 };
    }
    byDate[dateKey].wos.push(wo);

    if (wo.dueDate) {
      const dueDate = woDate(wo.dueDate);
      if (dueDate && completedDate > dueDate) {
        byDate[dateKey].overdueCount++;
      }
    }
  }

  const events: BulkCompletionEvent[] = [];

  for (const [date, data] of Object.entries(byDate)) {
    if (data.wos.length >= 5 && data.overdueCount >= 3) {
      const performers = data.wos
        .map(wo => wo.performedBy || wo.assignedTo || 'Unknown')
        .reduce((acc: Record<string, number>, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
      const topPerformer = Object.entries(performers).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'Unknown';

      events.push({
        date,
        totalCompleted: data.wos.length,
        overdueCompleted: data.overdueCount,
        performedBy: topPerformer,
      });
    }
  }

  events.sort((a, b) => b.date.localeCompare(a.date));

  const eventCount = events.length;

  return {
    eventCount,
    severity: getSeverity(eventCount, 1, 3) as 'green' | 'yellow' | 'red',
    events,
  };
}

function calculateScheduleDrift(completedWOs: any[], ninetyDaysAgo: Date) {
  const recentWOs = completedWOs.filter(wo => {
    const completed = wo.dateCompleted || wo.completionDateTime;
    if (!completed || !wo.dueDate) return false;
    return new Date(completed) >= ninetyDaysAgo;
  });

  if (recentWOs.length === 0) {
    return {
      averageDaysLate: 0,
      severity: 'green' as const,
      median: 0,
      worst: null,
      bestOnTimeCount: 0,
      trend: 'stable' as const,
    };
  }

  const daysLateValues: number[] = [];
  let worstWO: { woCode: string; jobTitle: string; daysLate: number } | null = null;
  let onTimeCount = 0;

  for (const wo of recentWOs) {
    const completedDate = woDate(wo.dateCompleted || wo.completionDateTime);
    const dueDate = woDate(wo.dueDate);
    const daysLate = (completedDate && dueDate)
      ? Math.max(0, Math.floor((completedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    daysLateValues.push(daysLate);

    if (daysLate === 0) {
      onTimeCount++;
    }

    if (!worstWO || daysLate > worstWO.daysLate) {
      worstWO = {
        woCode: wo.workOrderNo || `WO-${wo.id}`,
        jobTitle: wo.jobTitle || '',
        daysLate,
      };
    }
  }

  const avgDaysLate = Math.round(daysLateValues.reduce((s, v) => s + v, 0) / daysLateValues.length);
  const medianDaysLate = median(daysLateValues);

  const midpoint = new Date(ninetyDaysAgo.getTime() + 45 * 24 * 60 * 60 * 1000);
  const firstHalf = recentWOs.filter(wo => { const d = woDate(wo.dateCompleted || wo.completionDateTime); return d !== null && d < midpoint; });
  const secondHalf = recentWOs.filter(wo => { const d = woDate(wo.dateCompleted || wo.completionDateTime); return d !== null && d >= midpoint; });

  const avgFirst = firstHalf.length > 0
    ? firstHalf.reduce((s, wo) => {
        const c = woDate(wo.dateCompleted || wo.completionDateTime); const due = woDate(wo.dueDate);
        const dl = (c && due) ? Math.max(0, Math.floor((c.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        return s + dl;
      }, 0) / firstHalf.length
    : 0;

  const avgSecond = secondHalf.length > 0
    ? secondHalf.reduce((s, wo) => {
        const c = woDate(wo.dateCompleted || wo.completionDateTime); const due = woDate(wo.dueDate);
        const dl = (c && due) ? Math.max(0, Math.floor((c.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        return s + dl;
      }, 0) / secondHalf.length
    : 0;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (avgSecond - avgFirst > 2) trend = 'increasing';
  else if (avgFirst - avgSecond > 2) trend = 'decreasing';

  return {
    averageDaysLate: avgDaysLate,
    severity: getSeverity(avgDaysLate, 7, 14) as 'green' | 'yellow' | 'red',
    median: medianDaysLate,
    worst: worstWO,
    bestOnTimeCount: onTimeCount,
    trend,
  };
}
