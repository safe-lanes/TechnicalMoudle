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

  const endMonth = (yearParam && monthParam && !isNaN(yearParam) && !isNaN(monthParam))
    ? { year: yearParam, monthIndex0: monthParam - 1 }
    : undefined;

  const result = await getMaintenanceTrend({ vesselId, vesselIds, endMonth });
  res.json(result);
}));

export default router;
