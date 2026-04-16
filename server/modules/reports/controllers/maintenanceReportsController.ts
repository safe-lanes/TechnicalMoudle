import type { Request, Response } from 'express';
import * as maintenanceReportService from '../services/maintenanceReportService';
import * as monthlySnapshotService from '../services/monthlySnapshotService';

// ═══════════════════════════════════════════════════════════════
// DUE JOBS (7 DAYS) - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getDueJobs7DaysPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;
    const result = await maintenanceReportService.getDueJobs7DaysData(vesselId, vesselIds);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Due Jobs 7 Days preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// OVERDUE JOBS - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getOverdueJobsPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;
    const result = await maintenanceReportService.getOverdueJobsData(vesselId, dateFrom, dateTo, vesselIds);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Overdue Jobs preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED JOBS - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCompletedJobsPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;
    const result = await maintenanceReportService.getCompletedJobsData(vesselId, dateFrom, dateTo, vesselIds);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Completed Jobs preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// POSTPONEMENT LOG - GET PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getPostponementLogPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const status = req.query.status as string | undefined;
    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;
    const result = await maintenanceReportService.getPostponementLogData(vesselId, dateFrom, dateTo, status, vesselIds);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching Postponement Log preview:", error);
    res.status(500).json({ error: "Failed to fetch report data: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// DUE JOBS (7 DAYS) - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportDueJobs7Days(req: Request, res: Response) {
  try {
    const { vesselId, componentFilter } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportDueJobs7Days(vesselId, componentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Due Jobs report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// OVERDUE JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportOverdueJobs(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo, componentFilter, departmentFilter } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportOverdueJobs(vesselId, dateFrom, dateTo, componentFilter, departmentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Overdue Jobs report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED JOBS REGISTER - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCompletedJobs(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo, componentFilter, departmentFilter } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportCompletedJobs(vesselId, dateFrom, dateTo, componentFilter, departmentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Completed Jobs Register report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// UNPLANNED/BREAKDOWN JOBS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportUnplannedJobs(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo, componentFilter } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportUnplannedJobs(vesselId, dateFrom, dateTo, componentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Unplanned Jobs report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// POSTPONEMENT LOG - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportPostponementLog(req: Request, res: Response) {
  try {
    const { vesselId, dateFrom, dateTo, status, componentFilter, departmentFilter } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    const { buffer, filename } = await maintenanceReportService.exportPostponementLog(vesselId, dateFrom, dateTo, status, componentFilter, departmentFilter);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error generating Postponement Log report:", error);
    res.status(500).json({ error: "Failed to generate report: " + error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - PREVIEW (NEW SNAPSHOT-BASED)
// ═══════════════════════════════════════════════════════════════

function mergeMonthlySummaries(results: Awaited<ReturnType<typeof monthlySnapshotService.getMonthlySummaryData>>[]) {
  if (results.length === 0) throw new Error('No data');
  if (results.length === 1) return results[0];

  type CategoryBucket = { count: number; woIds: string[] };
  const mergeRecords = (records: Record<string, CategoryBucket>[]) => {
    const merged: Record<string, CategoryBucket> = {};
    for (const rec of records) {
      for (const [cat, bucket] of Object.entries(rec)) {
        if (!merged[cat]) merged[cat] = { count: 0, woIds: [] };
        merged[cat].count += bucket.count;
        merged[cat].woIds = [...merged[cat].woIds, ...bucket.woIds];
      }
    }
    return merged;
  };

  const movementKeys = ['newJobsEntered', 'completedInMonth', 'postponedInMonth', 'newlyOverdue', 'unplannedRaised', 'sentToPendingApproval'] as const;
  type MvKey = typeof movementKeys[number];
  const mergedMovement = {} as Record<MvKey, { count: number; woIds: string[] }>;
  for (const key of movementKeys) {
    mergedMovement[key] = { count: 0, woIds: [] };
    for (const r of results) {
      const m = r.movement as Record<MvKey, { count: number; woIds: string[] }>;
      if (m[key]) {
        mergedMovement[key].count += m[key].count;
        mergedMovement[key].woIds = [...mergedMovement[key].woIds, ...(m[key].woIds || [])];
      }
    }
  }

  const opening = mergeRecords(results.map(r => r.opening as Record<string, CategoryBucket>));
  const closing = mergeRecords(results.map(r => r.closing as Record<string, CategoryBucket>));

  const openingTotal = Object.values(opening).reduce((sum, v) => sum + v.count, 0);
  const openingOverdue = opening['Overdue']?.count || 0;
  const closingOverdue = closing['Overdue']?.count || 0;
  const indicators = {
    completionRate: mergedMovement.completedInMonth.count > 0 && openingTotal > 0
      ? Math.round((mergedMovement.completedInMonth.count / openingTotal) * 100) : 0,
    overdueChange: closingOverdue - openingOverdue,
    postponementCount: mergedMovement.postponedInMonth.count,
    unplannedCount: mergedMovement.unplannedRaised.count,
  };

  return {
    vesselName: 'Multiple Vessels',
    month: results[0].month,
    opening,
    movement: mergedMovement,
    closing,
    indicators,
    snapshotMeta: results.flatMap(r => r.snapshotMeta),
  };
}

export async function getMonthlySummaryPreview(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    const vesselIds = req.query.vesselIds ? (req.query.vesselIds as string).split(',').filter(Boolean) : undefined;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Please provide valid year and month" });
    }

    if (vesselId === 'all' && vesselIds && vesselIds.length > 0) {
      const results = await Promise.all(vesselIds.map(vid => monthlySnapshotService.getMonthlySummaryData(vid, year, month)));
      const data = mergeMonthlySummaries(results);
      return res.json(data);
    }

    const data = await monthlySnapshotService.getMonthlySummaryData(vesselId, year, month);
    res.json(data);
  } catch (error: unknown) {
    console.error("Error fetching Monthly Summary preview:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to fetch report data: " + message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - SNAPSHOT DETAIL
// ═══════════════════════════════════════════════════════════════

export async function getMonthlySummarySnapshotDetail(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    const type = req.query.type as string;
    const category = req.query.category as string;

    if (!vesselId || !type || !category) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: "Invalid year or month" });
    }

    if (type === 'movement') {
      const data = await monthlySnapshotService.getMovementDetail(vesselId, year, month, category);
      return res.json(data);
    }

    const data = await monthlySnapshotService.getSnapshotDetail(vesselId, year, month, type, category);
    res.json(data);
  } catch (error: unknown) {
    console.error("Error fetching snapshot detail:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to fetch snapshot detail: " + message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - REGENERATE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════

export async function regenerateMonthlySummarySnapshots(req: Request, res: Response) {
  try {
    const { vesselId, year, month } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }
    if (!year || !month) {
      return res.status(400).json({ error: "Please provide year and month" });
    }

    await monthlySnapshotService.regenerateSnapshots(vesselId, year, month);
    const data = await monthlySnapshotService.getMonthlySummaryData(vesselId, year, month);
    res.json(data);
  } catch (error: unknown) {
    console.error("Error regenerating snapshots:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to regenerate snapshots: " + message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY MAINTENANCE SUMMARY - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportMonthlySummary(req: Request, res: Response) {
  try {
    const { vesselId, startDate } = req.body;

    if (!vesselId) {
      return res.status(400).json({ error: "Please select a vessel" });
    }

    let year: number;
    let month: number;

    if (req.body.year && req.body.month) {
      year = Number(req.body.year);
      month = Number(req.body.month);
    } else if (startDate) {
      const d = new Date(startDate);
      year = d.getFullYear();
      month = d.getMonth() + 1;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const { buffer, filename } = await maintenanceReportService.exportMonthlySummary(vesselId, year, month);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: unknown) {
    console.error("Error generating Monthly Maintenance Summary report:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: "Failed to generate report: " + message });
  }
}
