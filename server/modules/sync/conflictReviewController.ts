/**
 * Conflict Review Controller
 *
 * HTTP handlers for the unified conflict review API.
 * Serves both sync_conflict_log (new) and sync_conflicts (old) tables.
 */

import { Request, Response } from 'express';
import * as conflictRepo from './conflictReviewRepository';

// ── GET /sync/conflicts/review ──
// (distinct from existing GET /sync/conflicts which returns raw sync_conflicts for Dashboard Section D)

export async function listConflictsHandler(req: Request, res: Response) {
  try {
    const filters: conflictRepo.ListConflictsFilters = {
      resolved: req.query.resolved === 'true',
      tableName: (req.query.tableName as string) || undefined,
      vesselId: (req.query.vesselId as string) || undefined,
      dateFrom: (req.query.dateFrom as string) || undefined,
      dateTo: (req.query.dateTo as string) || undefined,
      source: (req.query.source as 'log' | 'old' | 'all') || 'all',
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
      offset: parseInt(req.query.offset as string) || 0,
    };

    const result = await conflictRepo.listConflicts(filters);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[ConflictReview] list error:', error);
    res.status(500).json({ error: 'Failed to list conflicts' });
  }
}

// ── GET /sync/conflicts/review/count ──

export async function countConflictsHandler(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || undefined;
    const counts = await conflictRepo.countUnresolvedConflicts(vesselId);
    res.json(counts);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[ConflictReview] count error:', error);
    res.status(500).json({ error: 'Failed to count conflicts' });
  }
}

// ── GET /sync/conflicts/review/tables ──

export async function conflictTablesHandler(req: Request, res: Response) {
  try {
    const tables = await conflictRepo.getConflictTableNames();
    res.json({ tables });
  } catch (error: any) {
    console.error('[ConflictReview] tables error:', error);
    res.status(500).json({ error: 'Failed to get conflict tables' });
  }
}

// ── GET /sync/conflicts/review/:id ──

export async function getConflictHandler(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const source = req.query.source as 'log' | 'old';

    if (isNaN(id) || !source || !['log', 'old'].includes(source)) {
      return res.status(400).json({ error: 'Valid id and source (log|old) are required' });
    }

    const conflict = await conflictRepo.getConflict(id, source);
    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }
    res.json(conflict);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[ConflictReview] get error:', error);
    res.status(500).json({ error: 'Failed to get conflict' });
  }
}

// ── POST /sync/conflicts/review/:id/apply-incoming ──

export async function applyIncomingHandler(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const source = req.body.source as 'log' | 'old';

    if (isNaN(id) || !source || !['log', 'old'].includes(source)) {
      return res.status(400).json({ error: 'Valid id and source (log|old) are required' });
    }

    const user = (req as any).user;
    const userId = user?.id ? String(user.id) : 'system';

    const result = await conflictRepo.applyIncomingConflict(id, source, userId);
    if (!result) {
      return res.status(404).json({ error: 'Conflict not found' });
    }
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[ConflictReview] apply-incoming error:', error);
    res.status(500).json({ error: 'Failed to apply incoming value' });
  }
}

// ── POST /sync/conflicts/review/:id/dismiss ──

export async function dismissHandler(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const source = req.body.source as 'log' | 'old';

    if (isNaN(id) || !source || !['log', 'old'].includes(source)) {
      return res.status(400).json({ error: 'Valid id and source (log|old) are required' });
    }

    const user = (req as any).user;
    const userId = user?.id ? String(user.id) : 'system';

    const result = await conflictRepo.dismissConflict(id, source, userId);
    if (!result) {
      return res.status(404).json({ error: 'Conflict not found' });
    }
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[ConflictReview] dismiss error:', error);
    res.status(500).json({ error: 'Failed to dismiss conflict' });
  }
}
