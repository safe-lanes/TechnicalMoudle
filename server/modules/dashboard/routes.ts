import { Router } from 'express';
import { asyncHandler } from '../shared/middleware';
import { getMaintenanceTrend } from './services/maintenanceTrendService';

const router = Router();

// GET /technical/api/dashboard/maintenance-trend?vesselId=...&year=...&month=...
router.get('/dashboard/maintenance-trend', asyncHandler(async (req, res) => {
  const vesselId = (req.query.vesselId as string) || 'all';
  const yearParam = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const monthParam = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
  const vesselIdsParam = req.query.vesselIds;
  const vesselIds = Array.isArray(vesselIdsParam)
    ? (vesselIdsParam as string[])
    : typeof vesselIdsParam === 'string' && vesselIdsParam.length > 0
      ? vesselIdsParam.split(',').filter(Boolean)
      : undefined;

  // Resolve end month:
  // - If year+month provided: use that month.
  // - If only year provided: current month when it equals the current year,
  //   else December of the selected year (most recent month of that year).
  // - Else: undefined (service defaults to current month).
  let endMonth: { year: number; monthIndex0: number } | undefined;
  const now = new Date();
  if (yearParam && !isNaN(yearParam)) {
    if (monthParam && !isNaN(monthParam)) {
      endMonth = { year: yearParam, monthIndex0: monthParam - 1 };
    } else if (yearParam === now.getUTCFullYear()) {
      endMonth = { year: yearParam, monthIndex0: now.getUTCMonth() };
    } else {
      endMonth = { year: yearParam, monthIndex0: 11 };
    }
  }

  const result = await getMaintenanceTrend({ vesselId, vesselIds, endMonth });
  res.json(result);
}));

export default router;
