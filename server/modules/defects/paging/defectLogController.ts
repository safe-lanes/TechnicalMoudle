import type { Request, Response } from 'express';
import { z } from 'zod';
import { readDefectLog } from './defectLogReader';

const matchSchema = z.object({
  selectedVessel: z.string().optional(),
  selectedVesselName: z.string().optional(),
  selectedVesselNames: z.array(z.string()).optional(),
  search: z.string().optional(),
  periodValue: z.object({
    mode: z.enum(['yearQuarterMonth', 'dateRange']),
    year: z.number().optional(), month: z.number().optional(), quarter: z.number().optional(),
    dateFrom: z.string().optional(), dateTo: z.string().optional(),
  }).nullable().optional(),
  dueOverdue: z.string().optional(),
  timeZone: z.string(),
  locale: z.string(),
  now: z.string().datetime(),
});

export async function getDefectLogPage(req: Request, res: Response) {
  try {
    const page = z.coerce.number().int().min(1).max(1_000_000).default(1).parse(req.query.page);
    const match = matchSchema.parse(JSON.parse(String(req.query.match ?? '{}')));
    // Reject unsupported browser contexts; never silently use server defaults.
    new Intl.DateTimeFormat(match.locale, { timeZone: match.timeZone }).format();
    const result = await readDefectLog({
      page, pageSize: 100,
      vesselId: z.string().optional().parse(req.query.vesselId),
      vesselIds: z.string().optional().parse(req.query.vesselIds)?.split(',').filter(Boolean),
      match,
    }, req.query.export === 'true');
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof RangeError) {
      return res.status(400).json({ error: 'Invalid Defect Log paging request' });
    }
    console.error('Defect Log paged read failed:', error);
    return res.status(500).json({ error: 'Failed to fetch Defect Log records' });
  }
}
