import type { Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { reportFavorites } from '@shared/schema';
import { getDb } from '../../../db';
import type { AuthenticatedRequest } from '../../../middleware/auth';

function getUserUuid(req: AuthenticatedRequest): string | null {
  return req.user?.userUuid || null;
}

export async function getFavorites(req: AuthenticatedRequest, res: Response) {
  try {
    const userUuid = getUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const db = await getDb();
    const favorites = await db
      .select({ reportId: reportFavorites.reportId })
      .from(reportFavorites)
      .where(
        and(
          eq(reportFavorites.createdByUuid, userUuid),
          eq(reportFavorites.isDeleted, false)
        )
      );

    res.json({ reportIds: favorites.map(f => f.reportId) });
  } catch (error: any) {
    console.error('Error fetching report favorites:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch favorites' });
  }
}

export async function addFavorite(req: AuthenticatedRequest, res: Response) {
  try {
    const userUuid = getUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { reportId } = req.params;
    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const db = await getDb();

    const existing = await db
      .select()
      .from(reportFavorites)
      .where(
        and(
          eq(reportFavorites.createdByUuid, userUuid),
          eq(reportFavorites.reportId, reportId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].isDeleted) {
        await db
          .update(reportFavorites)
          .set({
            isDeleted: false,
            updatedByUuid: userUuid,
          })
          .where(eq(reportFavorites.id, existing[0].id));
      }
      return res.json({ success: true, reportId });
    }

    await db.insert(reportFavorites).values({
      reportId,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });

    res.json({ success: true, reportId });
  } catch (error: any) {
    console.error('Error adding report favorite:', error);
    res.status(500).json({ error: error.message || 'Failed to add favorite' });
  }
}

export async function removeFavorite(req: AuthenticatedRequest, res: Response) {
  try {
    const userUuid = getUserUuid(req);
    if (!userUuid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { reportId } = req.params;
    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const db = await getDb();

    await db
      .update(reportFavorites)
      .set({
        isDeleted: true,
        updatedByUuid: userUuid,
      })
      .where(
        and(
          eq(reportFavorites.createdByUuid, userUuid),
          eq(reportFavorites.reportId, reportId)
        )
      );

    res.json({ success: true, reportId });
  } catch (error: any) {
    console.error('Error removing report favorite:', error);
    res.status(500).json({ error: error.message || 'Failed to remove favorite' });
  }
}
