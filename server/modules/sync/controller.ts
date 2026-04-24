/**
 * Sync Controller — Request handlers for the ship-shore sync protocol.
 */

import { Request, Response } from 'express';
import * as syncService from './service';
import * as syncRepo from './repository';
import { getSyncEngine } from './syncEngine';
import { FileSyncProcessor } from './fileSyncProcessor';

// ── POST /sync/initiate ──

export async function initiateSyncHandler(req: Request, res: Response) {
  try {
    const { instanceId, vesselId, lastCheckpoint } = req.body;
    if (!instanceId || !vesselId) {
      return res.status(400).json({ error: 'instanceId and vesselId are required' });
    }

    const result = await syncService.initiateSyncSession(
      instanceId,
      vesselId,
      lastCheckpoint ? new Date(lastCheckpoint) : null
    );
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] initiate error:', error);
    res.status(500).json({ error: 'Failed to initiate sync session' });
  }
}

// ── POST /sync/push ──

export async function pushHandler(req: Request, res: Response) {
  try {
    const { batchUuid, vesselId, oneWayRows, fieldLogs } = req.body;
    if (!batchUuid || !vesselId) {
      return res.status(400).json({ error: 'batchUuid and vesselId are required' });
    }

    const result = await syncService.receivePushData(batchUuid, vesselId, {
      oneWayRows,
      fieldLogs,
    });
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] push error:', error);
    res.status(500).json({ error: 'Failed to process push data' });
  }
}

// ── POST /sync/pull ──

export async function pullHandler(req: Request, res: Response) {
  try {
    const { batchUuid, vesselId, instanceId, lastCheckpoint } = req.body;
    if (!batchUuid || !vesselId || !instanceId) {
      return res.status(400).json({ error: 'batchUuid, vesselId, and instanceId are required' });
    }

    const result = await syncService.preparePullData(
      batchUuid,
      vesselId,
      instanceId,
      lastCheckpoint ? new Date(lastCheckpoint) : null
    );
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] pull error:', error);
    res.status(500).json({ error: 'Failed to prepare pull data' });
  }
}

// ── POST /sync/resolve-conflict ──

export async function resolveConflictHandler(req: Request, res: Response) {
  try {
    const { conflictUuid, resolution, resolvedValue, resolvedBy } = req.body;
    if (!conflictUuid || !resolution) {
      return res.status(400).json({ error: 'conflictUuid and resolution are required' });
    }
    if (!['ship_wins', 'shore_wins', 'manual'].includes(resolution)) {
      return res.status(400).json({ error: 'resolution must be ship_wins, shore_wins, or manual' });
    }
    if (resolution === 'manual' && resolvedValue === undefined) {
      return res.status(400).json({ error: 'resolvedValue is required for manual resolution' });
    }

    const result = await syncService.resolveConflictAction(
      conflictUuid,
      resolution,
      resolvedValue ?? null,
      resolvedBy || 'system'
    );
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] resolve-conflict error:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
}

// ── POST /sync/complete ──

export async function completeSyncHandler(req: Request, res: Response) {
  try {
    const { batchUuid, vesselId, instanceId } = req.body;
    if (!batchUuid || !vesselId || !instanceId) {
      return res.status(400).json({ error: 'batchUuid, vesselId, and instanceId are required' });
    }

    const result = await syncService.completeSyncSession(batchUuid, vesselId, instanceId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] complete error:', error);
    res.status(500).json({ error: 'Failed to complete sync session' });
  }
}

// ── GET /sync/status ──

export async function statusHandler(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '';
    const instanceId = (req.query.instanceId as string) || '';
    if (!vesselId || !instanceId) {
      return res.status(400).json({ error: 'vesselId and instanceId query params are required' });
    }

    const result = await syncService.getSyncStatus(vesselId, instanceId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
}

// ── GET /sync/batches ──

export async function recentBatchesHandler(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 20;

    const batches = await syncService.getRecentBatches(vesselId, limit);
    res.json(batches);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] batches error:', error);
    res.status(500).json({ error: 'Failed to get recent batches' });
  }
}

// ── GET /sync/conflicts ──

export async function unresolvedConflictsHandler(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '';
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId query param is required' });
    }

    const conflicts = await syncService.getUnresolvedConflicts(vesselId);
    res.json(conflicts);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] conflicts error:', error);
    res.status(500).json({ error: 'Failed to get unresolved conflicts' });
  }
}

// ── POST /sync/trigger ──

export async function triggerSyncHandler(req: Request, res: Response) {
  try {
    const { vesselId } = req.body;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId is required' });
    }

    const engine = getSyncEngine();
    const result = await engine.runSync(vesselId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
}

// ── POST /sync/file/upload-chunk ──

export async function uploadChunkHandler(req: Request, res: Response) {
  try {
    const chunk = req.body;
    if (!chunk.queueUuid || chunk.chunkIndex === undefined || !chunk.totalChunks || !chunk.data) {
      return res.status(400).json({ error: 'queueUuid, chunkIndex, totalChunks, and data are required' });
    }

    const processor = new FileSyncProcessor();
    const result = await processor.receiveChunk(chunk);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] upload-chunk error:', error);
    res.status(500).json({ error: 'Failed to receive file chunk' });
  }
}

// ── GET /sync/file/queue ──

export async function fileQueueHandler(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '';
    const direction = (req.query.direction as string) || 'ship_to_shore';
    const limit = parseInt(req.query.limit as string) || 50;

    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId query param is required' });
    }

    const files = await syncRepo.getPendingFiles(vesselId, direction, limit);
    res.json({ files, count: files.length });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] file-queue error:', error);
    res.status(500).json({ error: 'Failed to get file queue' });
  }
}
