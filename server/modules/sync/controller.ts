/**
 * Sync Controller — Request handlers for the ship-shore sync protocol.
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as syncService from './service';
import * as syncRepo from './repository';
import * as provisioningService from './provisioningService';
import { getSyncEngine } from './syncEngine';
import { FileSyncProcessor } from './fileSyncProcessor';
import { runPruning } from './pruningService';
import { runHealthCheck, getTableStats } from './healthMonitor';
import { getPool } from '../../db';
import { getSyncLogPath, getSyncLogDir } from './syncDiagLogger';

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

// ══════════════════════════════════════════════════════════════
// Provisioning endpoints (offline_admin / Sail Admin gated)
// ══════════════════════════════════════════════════════════════

// ── POST /sync/provision/:vesselId ──

export async function generateProvisionHandler(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId param is required' });
    }

    const userId = (req as any).user?.userUuid || (req as any).user?.username || 'system';
    console.log(`[Provisioning] Generating bundle for vessel ${vesselId} by ${userId}`);

    const bundle = await provisioningService.generateProvisioningBundle(vesselId, userId);

    res.json({
      manifest: bundle.manifest,
      downloadReady: true,
      totalRows: bundle.manifest.totalRows,
      tables: bundle.manifest.tables.length,
    });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Provisioning] generate error:', error);
    res.status(500).json({ error: 'Failed to generate provisioning bundle' });
  }
}

// ── GET /sync/provision/manifest/:vesselId ──

export async function getManifestHandler(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId param is required' });
    }

    const bundle = await provisioningService.generateProvisioningBundle(vesselId, 'preview');
    res.json(bundle.manifest);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Provisioning] manifest error:', error);
    res.status(500).json({ error: 'Failed to generate manifest' });
  }
}

// ── GET /sync/provision/download/:vesselId ──

export async function downloadProvisionHandler(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId param is required' });
    }

    const userId = (req as any).user?.userUuid || (req as any).user?.username || 'system';
    const bundle = await provisioningService.generateProvisioningBundle(vesselId, userId);

    const fileName = `provision_${vesselId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.json(bundle);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Provisioning] download error:', error);
    res.status(500).json({ error: 'Failed to download provisioning bundle' });
  }
}

// ── POST /sync/provision/import ──

export async function importProvisionHandler(req: Request, res: Response) {
  try {
    const bundle = req.body;
    if (!bundle?.manifest?.vesselId || !bundle?.data) {
      return res.status(400).json({ error: 'Invalid bundle format. Must contain manifest and data.' });
    }

    const result = await provisioningService.importProvisioningBundle(bundle);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Provisioning] import error:', error);
    res.status(500).json({ error: 'Failed to import provisioning bundle' });
  }
}

// ── POST /sync/provision/verify ──

export async function verifyProvisionHandler(req: Request, res: Response) {
  try {
    const manifest = req.body;
    if (!manifest?.vesselId || !manifest?.tables) {
      return res.status(400).json({ error: 'Invalid manifest format. Must contain vesselId and tables.' });
    }

    const result = await provisioningService.verifyProvisioning(manifest);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Provisioning] verify error:', error);
    res.status(500).json({ error: 'Failed to verify provisioning' });
  }
}

// ══════════════════════════════════════════════════════════════
// Pruning & Health endpoints
// ══════════════════════════════════════════════════════════════

// ── POST /sync/prune ──

export async function pruneHandler(req: Request, res: Response) {
  try {
    const overrides = req.body || {};
    const config: Record<string, number> = {};
    if (overrides.fieldLogDays !== undefined) config.fieldLogDays = parseInt(overrides.fieldLogDays, 10);
    if (overrides.batchDays !== undefined) config.batchDays = parseInt(overrides.batchDays, 10);
    if (overrides.fileQueueDays !== undefined) config.fileQueueDays = parseInt(overrides.fileQueueDays, 10);
    if (overrides.conflictDays !== undefined) config.conflictDays = parseInt(overrides.conflictDays, 10);

    const result = await runPruning(Object.keys(config).length > 0 ? config : undefined);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] prune error:', error);
    res.status(500).json({ error: 'Failed to run pruning' });
  }
}

// ── GET /sync/health ──

export async function healthCheckHandler(req: Request, res: Response) {
  try {
    const result = await runHealthCheck();
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] health check error:', error);
    res.status(500).json({ error: 'Failed to run health check' });
  }
}

// ── GET /sync/table-stats ──

export async function tableStatsHandler(req: Request, res: Response) {
  try {
    const stats = await getTableStats();
    res.json(stats);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] table stats error:', error);
    res.status(500).json({ error: 'Failed to get table stats' });
  }
}

// ══════════════════════════════════════════════════════════════
// Settings, Fleet Overview & Instance Info endpoints
// ══════════════════════════════════════════════════════════════

// ── GET /sync/settings ──

export async function getSettingsHandler(req: Request, res: Response) {
  try {
    const settings = await syncRepo.getAllSettingsFull();
    res.json({ settings });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] get settings error:', error);
    res.status(500).json({ error: 'Failed to get sync settings' });
  }
}

// ── PUT /sync/settings ──

export async function updateSettingsHandler(req: Request, res: Response) {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object is required' });
    }

    const userId = (req as any).user?.userUuid || (req as any).user?.username || 'system';
    await syncRepo.updateSettings(settings, userId);

    // Force sync engine to reload settings from DB
    const engine = getSyncEngine();
    engine.reloadSettings();

    res.json({ success: true, message: 'Settings updated. Sync engine will reload on next cycle.' });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] update settings error:', error);
    res.status(500).json({ error: 'Failed to update sync settings' });
  }
}

// ── POST /sync/settings/test-connection ──

export async function testConnectionHandler(req: Request, res: Response) {
  try {
    const { shoreUrl } = req.body;
    if (!shoreUrl) {
      return res.status(400).json({ error: 'shoreUrl is required' });
    }

    const startTime = Date.now();
    const response = await fetch(`${shoreUrl}/sync/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      res.json({ connected: true, latencyMs, shoreHealth: data, message: `Connected in ${latencyMs}ms` });
    } else {
      res.json({ connected: false, latencyMs, message: `Shore responded with ${response.status}` });
    }
  } catch (error: any) {
    res.json({ connected: false, latencyMs: null, message: `Connection failed: ${error.message}` });
  }
}

// ── GET /sync/instance-info ──

export async function instanceInfoHandler(req: Request, res: Response) {
  try {
    const envInstanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    let dbInstanceId: string | null = null;
    try {
      dbInstanceId = await syncRepo.getSetting('instance_id');
    } catch {}

    const effectiveId = (dbInstanceId && dbInstanceId.trim()) || envInstanceId;
    const isShip = effectiveId.startsWith('SHIP-');
    const isShore = !isShip;

    res.json({
      instanceId: effectiveId,
      isShore,
      isShip,
      instanceType: isShip ? 'ship' : 'shore',
    });
  } catch (error: any) {
    console.error('[Sync] instance info error:', error);
    res.status(500).json({ error: 'Failed to get instance info' });
  }
}

// ── GET /sync/fleet-overview ──

export async function fleetOverviewHandler(req: Request, res: Response) {
  try {
    const overview = await syncService.getFleetSyncOverview();
    res.json({ vessels: overview });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] fleet overview error:', error);
    res.status(500).json({ error: 'Failed to get fleet sync overview' });
  }
}

// ══════════════════════════════════════════════════════════════
// Diagnostic Log endpoints
// ══════════════════════════════════════════════════════════════

// ── GET /sync/diag-log ── (today's log file as plain text)

export async function diagLogHandler(req: Request, res: Response) {
  try {
    const logPath = getSyncLogPath();
    if (fs.existsSync(logPath)) {
      res.setHeader('Content-Type', 'text/plain');
      res.sendFile(path.resolve(logPath));
    } else {
      res.json({ message: 'No diagnostic log for today', path: logPath });
    }
  } catch (error: any) {
    console.error('[Sync] diag-log error:', error);
    res.status(500).json({ error: 'Failed to get diagnostic log' });
  }
}

// ── GET /sync/diag-logs ── (list all available log files with dates + sizes)

export async function diagLogsListHandler(req: Request, res: Response) {
  try {
    const logDir = getSyncLogDir();
    if (!fs.existsSync(logDir)) {
      return res.json({ logs: [], directory: logDir });
    }
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('sync-diag-') && f.endsWith('.log'))
      .map(f => {
        const filePath = path.join(logDir, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          date: f.replace('sync-diag-', '').replace('.log', ''),
          sizeBytes: stat.size,
          sizeKB: Math.round(stat.size / 1024),
          modifiedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
    res.json({ logs: files, directory: logDir });
  } catch (error: any) {
    console.error('[Sync] diag-logs error:', error);
    res.status(500).json({ error: 'Failed to list diagnostic logs' });
  }
}
