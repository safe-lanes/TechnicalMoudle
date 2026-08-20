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
import { syncAutoScheduler } from './autoSyncScheduler';
import { FileSyncProcessor, DEFAULT_FILE_DRAIN_MAX_BYTES } from './fileSyncProcessor';
import { runPruning } from './pruningService';
import { runDriftScan, getOpenDrift } from './driftDetector';
import { getInsertLogSkipCount } from './oneWayApplier';
import { getBuildInfo } from '../../utils/buildInfo';
import { runHealthCheck, getTableStats } from './healthMonitor';
import { getFieldLogFailureSessionCount } from './fieldLogger';
import { getPool } from '../../db';
import { isShipInstanceId, isShipInstance } from './syncRole';
import { getSyncLogPath, getSyncLogDir, syncDiag } from './syncDiagLogger';

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
    const { batchUuid, vesselId, oneWayRows, fieldLogs, masterRecordHints, fullRows } = req.body;
    if (!batchUuid || !vesselId) {
      return res.status(400).json({ error: 'batchUuid and vesselId are required' });
    }

    const result = await syncService.receivePushData(batchUuid, vesselId, {
      oneWayRows,
      fieldLogs,
      masterRecordHints,
      fullRows, // self-heal delivery (optional; absent from old ships)
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

    // 148: tableCheckpoints is OPTIONAL — new ships send per-table one-way watermarks.
    // ABSENT (old ship) → every table falls back to the single lastCheckpoint, which is
    // byte-identical to pre-148 behaviour. Presence of the key IS the capability signal.
    const rawTableCps = req.body.tableCheckpoints;
    let tableCheckpoints: Record<string, Date> | undefined;
    if (rawTableCps && typeof rawTableCps === 'object' && !Array.isArray(rawTableCps)) {
      tableCheckpoints = {};
      for (const [t, iso] of Object.entries(rawTableCps)) {
        if (typeof iso === 'string') {
          const d = new Date(iso);
          if (!isNaN(d.getTime())) tableCheckpoints[t] = d;
        }
      }
    }

    const result = await syncService.preparePullData(
      batchUuid,
      vesselId,
      instanceId,
      lastCheckpoint ? new Date(lastCheckpoint) : null,
      tableCheckpoints
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
    const { batchUuid, vesselId, instanceId, appliedRowUuids } = req.body;
    if (!batchUuid || !vesselId || !instanceId) {
      return res.status(400).json({ error: 'batchUuid, vesselId, and instanceId are required' });
    }

    // appliedRowUuids is OPTIONAL — new ships send the rows they applied so the shore marks only
    // those synced. Absent (old ship) → completeSyncSession falls back to today's behaviour.
    // failedOneWayTables is OPTIONAL — new ships report one-way tables whose apply failed so the
    // shore holds the checkpoint back (one-way orphaning fix). Absent → advance as today.
    const failedOneWayTables = Array.isArray(req.body.failedOneWayTables)
      ? req.body.failedOneWayTables.filter((t: unknown) => typeof t === 'string')
      : undefined;
    // 148: appliedTableCheckpoints is OPTIONAL — new ships echo back the per-table max
    // they applied cleanly. Absent (old ship) → single-watermark path, unchanged.
    const rawApplied = req.body.appliedTableCheckpoints;
    let appliedTableCheckpoints: Record<string, string> | undefined;
    if (rawApplied && typeof rawApplied === 'object' && !Array.isArray(rawApplied)) {
      appliedTableCheckpoints = {};
      for (const [t, iso] of Object.entries(rawApplied)) {
        if (typeof iso === 'string') appliedTableCheckpoints[t] = iso;
      }
    }

    const result = await syncService.completeSyncSession(
      batchUuid,
      vesselId,
      instanceId,
      Array.isArray(appliedRowUuids) ? appliedRowUuids : undefined,
      failedOneWayTables,
      appliedTableCheckpoints
    );
    res.json(result);

    // ── POST-SYNC RECONCILE TRIGGER (2026-08-04, plan §9.6 revision — explicit instruction) ──
    // A duplicate WO pair only becomes VISIBLE on shore when a sync delivers the ship's
    // copy — so the sync cycle that just completed is the exact right moment to resolve
    // it. Fire-and-forget AFTER the response: the ship's cycle is never delayed, a failure
    // here costs nothing (the NEXT cycle fires this hook again — that is the only backup;
    // the periodic reconciler timers were deliberately removed), and the reconciler's own
    // per-vessel lock + shore-only guard make re-entry safe.
    setImmediate(() => {
      import('../work-orders/services/workOrderReconcilerService')
        .then(svc => svc.reconcileVessel(vesselId))
        .then(r => {
          const n = r.resolved.case1 + r.resolved.case2 + r.resolved.case3;
          if (n > 0) console.log(`[WO-Reconciler] post-sync trigger: resolved ${n} duplicate(s) for vessel ${vesselId}`);
        })
        .catch(err => console.warn(`[WO-Reconciler] post-sync trigger failed (next sync retries): ${err?.message || err}`));
    });

    // ── APPROVAL ARRIVAL SWEEP (Phase 2 / W3, explicit instruction) ──
    // Same rationale and shape as the reconciler trigger above: the sync cycle that just
    // completed is the moment a ship-created CR / postponement request became visible on
    // shore, so submit it to the approval engine here. Fire-and-forget after the response;
    // idempotent (ALREADY_PENDING short-circuits, NO_WORKFLOW/DISABLED do nothing); a
    // failure costs nothing — the next sync fires it again. No-op on ships (engine unset).
    setImmediate(() => {
      import('../approvals/engineGateway')
        .then(gw => gw.approvalArrivalSweep(vesselId))
        .catch(err => console.warn(`[approvals] arrival sweep failed (next sync retries): ${err?.message || err}`));
    });
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

    // Phase-0 un-swallow (§9.4): surface LOST field logs until the Sync-Health panel exists.
    // session = failures since this process started; unresolved = durable backlog needing the
    // full-row-diff recovery. Best-effort — an old DB without migration 142 reports nulls.
    let fieldLogFailures: { session: number; unresolved: number | null } = {
      session: getFieldLogFailureSessionCount(),
      unresolved: null,
    };
    try {
      const pool = await getPool();
      const r = await pool.query(`SELECT count(*)::int AS n FROM sync_field_log_failures WHERE resolved = false`);
      fieldLogFailures.unresolved = r.rows[0]?.n ?? 0;
    } catch { /* table absent pre-migration — leave null */ }

    // §13 guard: count of re-delivered INSERT-origin logs SKIPPED to protect a populated
    // column. A skip deliberately writes no conflict row and fires no notification, so this
    // counter is the ONLY signal — a spike means someone is re-offering old logs (recovery,
    // dead-letter replay, checkpoint rewind) and each skip is a value that did NOT get applied.
    const insertLogSkips = { session: getInsertLogSkipCount() };

    // Migration 147 — retry backlog. Now that is_synced=true means CONFIRMED APPLIED, unconfirmed
    // rows are never marked and never pruned (pruning deletes is_synced=true only). That is the
    // right trade — better a retained undelivered record than a deleted one — but it must be
    // VISIBLE or the backlog just grows unseen. `stuck` = rows on the final 7-day tier; they are
    // still retried forever, "stuck" means a human should look, not that anything gave up.
    let retryBacklog: { total: number; stuck: number; maxAttempts: number } | null = null;
    try {
      retryBacklog = await syncRepo.getRetryBacklog(instanceId);
    } catch { /* pre-migration-147 DB — leave null */ }

    // Build identity, so a vessel can be version-confirmed WITHOUT shell access. That is the
    // real constraint: ships are intermittently reachable, and the sync guards only log when
    // they fire, so there was previously no way to prove a fix was live except SSH + git log.
    const build = getBuildInfo();

    res.json({ ...result, fieldLogFailures, insertLogSkips, retryBacklog, build });
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
    // Ship-only guard: sync is always ship-initiated. Shore is the responder.
    if (!(await isShipInstance())) {
      return res.status(400).json({
        error: 'Sync can only be triggered from a vessel (ship) instance. Shore is the responder in ship-initiated sync.',
      });
    }

    const { vesselId } = req.body;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId is required' });
    }

    const engine = getSyncEngine();
    // Drain-to-zero: one "Sync Now" fully reconciles the vessel (push + pull) in this single
    // action, looping whole cycles until both backlogs are 0 or a safety stop (cap / time budget /
    // no-progress). Bounded so a large historical backlog drains a chunk without hanging the request.
    const result = await engine.runSyncToCompletion(vesselId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
}

// ── POST /sync/fetch-rows ──  self-heal (pull direction): the ship requests complete rows
// for fragments that target rows absent on the ship. Read-only; tenant-scoped by the guard.

export async function fetchRowsHandler(req: Request, res: Response) {
  try {
    const { vesselId, instanceId, requests } = req.body || {};
    if (!vesselId || !instanceId || !Array.isArray(requests)) {
      return res.status(400).json({ error: 'vesselId, instanceId, and requests[] are required' });
    }
    const tables = await syncService.fetchFullRowsForHeal(requests);
    res.json({ tables });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] fetch-rows error:', error);
    res.status(500).json({ error: 'Failed to fetch rows for self-heal' });
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

// Friendly module label per source table — the operator sees which area a file belongs
// to without exposing any file path / storage key.
const FILE_CATEGORY_LABELS: Record<string, string> = {
  work_order_documents: 'Work Order',
  component_documents: 'Component',
  defect_attachments: 'Defect',
  change_request_attachment: 'Change Request',
};
function fileCategoryLabel(tableName: string): string {
  return FILE_CATEGORY_LABELS[tableName]
    || tableName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fileQueueHandler(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '';
    const limit = parseInt(req.query.limit as string) || 100;

    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId query param is required' });
    }

    // B-P1.1: surface pending/in_progress/failed/unsendable/skipped files with a friendly
    // category + reason. NEVER expose file_key / file path.
    const rows = await syncRepo.getFileQueueForDashboard(vesselId, limit);
    const files = rows.map((f: any) => ({
      queueUuid: f.queueUuid,
      category: fileCategoryLabel(f.tableName),
      fileName: f.fileName,
      fileSize: f.fileSizeBytes,
      direction: f.direction,
      status: f.status,
      chunkOffset: f.chunkOffset ?? 0,
      totalChunks: f.totalChunks,
      retryCount: f.retryCount ?? 0,
      lastError: f.lastError ?? null,
      createdAt: f.createdAt,
    }));
    res.json({ files, count: files.length });
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] file-queue error:', error);
    res.status(500).json({ error: 'Failed to get file queue' });
  }
}

// ── POST /sync/file/:queueUuid/retry ──  (B-P1.1)
export async function retryFileHandler(req: Request, res: Response) {
  try {
    const { queueUuid } = req.params;
    if (!queueUuid) return res.status(400).json({ error: 'queueUuid is required' });
    const updated = await syncRepo.retryFileQueueEntry(queueUuid);
    if (!updated) return res.status(404).json({ error: 'File queue entry not found' });
    res.json({ success: true, status: updated.status });
  } catch (error: any) {
    console.error('[Sync] file retry error:', error);
    res.status(500).json({ error: 'Failed to retry file' });
  }
}

// ── POST /sync/file/:queueUuid/skip ──  (B-P1.1)
export async function skipFileHandler(req: Request, res: Response) {
  try {
    const { queueUuid } = req.params;
    if (!queueUuid) return res.status(400).json({ error: 'queueUuid is required' });
    const updated = await syncRepo.skipFileQueueEntry(queueUuid);
    if (!updated) return res.status(404).json({ error: 'File queue entry not found' });
    res.json({ success: true, status: updated.status });
  } catch (error: any) {
    console.error('[Sync] file skip error:', error);
    res.status(500).json({ error: 'Failed to skip file' });
  }
}

// ── POST /sync/file/pending ──  shore→ship pull: list shore_to_ship pending for a vessel
// Mirror of upload-chunk (server-to-server, syncTenantGuard). Ship calls this to discover files.
export async function pendingFilesHandler(req: Request, res: Response) {
  try {
    const { vesselId, maxBytes } = req.body;
    if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
    const processor = new FileSyncProcessor();
    const result = await processor.listPendingForPull(vesselId, Number(maxBytes) || DEFAULT_FILE_DRAIN_MAX_BYTES);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] file-pending error:', error);
    res.status(500).json({ error: 'Failed to list pending files' });
  }
}

// ── POST /sync/file/download-chunk ──  shore→ship pull: stream one chunk of a queued file
export async function downloadChunkHandler(req: Request, res: Response) {
  try {
    const { queueUuid, chunkIndex } = req.body;
    if (!queueUuid || chunkIndex === undefined) {
      return res.status(400).json({ error: 'queueUuid and chunkIndex are required' });
    }
    const processor = new FileSyncProcessor();
    const chunk = await processor.readChunkForPull(queueUuid, Number(chunkIndex));
    if (!chunk) return res.status(404).json({ error: 'File not found in local storage' });
    res.json(chunk);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[Sync] download-chunk error:', error);
    res.status(500).json({ error: 'Failed to read file chunk' });
  }
}

// ── POST /sync/file/:queueUuid/complete ──  shore→ship pull: ship confirms a verified file;
// the shore marks its shore_to_ship entry completed so it stops re-offering it.
export async function completeFileHandler(req: Request, res: Response) {
  try {
    const { queueUuid } = req.params;
    if (!queueUuid) return res.status(400).json({ error: 'queueUuid is required' });
    await syncRepo.markFileCompleted(queueUuid);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Sync] file complete error:', error);
    res.status(500).json({ error: 'Failed to mark file completed' });
  }
}

// ── POST /sync/file/:queueUuid/fail ──  shore→ship pull dead-letter: the ship gave up after 3
// failed attempts; the shore marks its entry terminal 'failed' (leaves 'pending' → drops from the
// drain count). Mirror of the push's dead-letter.
export async function failFileHandler(req: Request, res: Response) {
  try {
    const { queueUuid } = req.params;
    if (!queueUuid) return res.status(400).json({ error: 'queueUuid is required' });
    const reason = (req.body?.reason as string) || 'Dead-lettered after repeated failed pull attempts';
    await syncRepo.updateFileStatus(queueUuid, 'failed', undefined, reason);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Sync] file fail error:', error);
    res.status(500).json({ error: 'Failed to mark file failed' });
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
    // Phase 4b: persist=true mints/stores the per-ship sync key + the instance->domain
    // map row (master). Domain is the verified tenant domain (set by tenantMiddleware,
    // since provisioning routes are no longer exempt). No-op when multi-tenant disabled.
    const domain = (req as any).tenantDomain || undefined;
    // ?blunt=true forces the full re-deliver-everything reset (the guaranteed self-heal used
    // when a prior import failed verification). Default = snapshot-baseline partition.
    const blunt = req.query.blunt === 'true' || req.query.blunt === '1';
    const bundle = await provisioningService.generateProvisioningBundle(vesselId, userId, { domain, persist: true, blunt });

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

    // Phase 4b: the ship no longer declares a domain — shore is the sole authority
    // via the master instance->domain map. Import just seeds the per-ship key + tunables.
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

    // Phase B defense: the auto-sync scheduler runs only on the ship, so these
    // keys are meaningless on shore (and shore's sync_settings doesn't sync to
    // ship). If a shore caller ever sends them, strip them rather than persisting
    // dead values. Shore may still save OTHER keys (shore_url, retention, etc.).
    const SCHEDULER_ONLY_KEYS = ['auto_sync_enabled', 'sync_interval_minutes'];
    if (!(await isShipInstance())) {
      const stripped = SCHEDULER_ONLY_KEYS.filter((k) => k in settings);
      if (stripped.length > 0) {
        for (const k of stripped) delete settings[k];
        console.log(`[Sync Settings] Ignoring scheduler-only keys on shore: ${stripped.join(', ')}`);
      }
    }

    // Validate sync_interval_minutes if present: positive integer, no minimum.
    let newIntervalMinutes: number | null = null;
    if (settings.sync_interval_minutes !== undefined) {
      const n = Number(settings.sync_interval_minutes);
      if (!Number.isInteger(n) || n <= 0) {
        return res.status(400).json({ error: 'sync_interval_minutes must be a positive integer (minutes)' });
      }
      newIntervalMinutes = n;
    }

    // §16: canonicalise boolean-ish values to lowercase 'true'/'false' BEFORE persisting. The
    // endpoint previously stored whatever a caller sent, so a UI posting "TRUE" would silently
    // disable auto-sync forever (the reader used a strict === 'true'). Reader is now tolerant
    // too, but normalising on write keeps the stored form canonical for SQL and for humans.
    const canonicalised = syncRepo.canonicaliseBooleanSettings(settings);
    if (canonicalised.length > 0) {
      console.log(`[Sync Settings] Canonicalised boolean value(s): ${canonicalised.join(', ')}`);
    }

    const userId = (req as any).user?.userUuid || (req as any).user?.username || 'system';
    await syncRepo.updateSettings(settings, userId);

    // Force sync engine to reload settings from DB
    const engine = getSyncEngine();
    engine.reloadSettings();

    // Apply the new interval LIVE. The scheduler only runs on a ship instance;
    // on shore restartWithNewInterval is a graceful no-op (records the preference).
    if (newIntervalMinutes !== null && (await isShipInstance())) {
      if (!syncAutoScheduler.isStarted()) {
        // Self-heal: this instance resolves as a SHIP right now but the scheduler
        // was never started — the boot-time role decision was taken against a
        // stale instance_id (reproduced 2026-07-28). "Recording a preference"
        // here left auto-sync dead until a restart; start it instead. start()
        // reads sync_interval_minutes from the DB, which we just saved.
        console.warn('[AutoSync] 🩹 SELF-HEAL: settings saved on a ship instance while the scheduler was not running (stale boot-time role decision) — starting it now.');
        syncDiag('[AutoSync] SELF-HEAL: settings-save found the scheduler not running on a ship instance — started late (boot-time role decision was stale).');
        await syncAutoScheduler.start();
      } else {
        syncAutoScheduler.restartWithNewInterval(newIntervalMinutes);
      }
    }

    res.json({
      success: true,
      message: 'Settings updated.',
      ...(newIntervalMinutes !== null ? { syncIntervalMinutes: newIntervalMinutes } : {}),
    });
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
    const isShip = isShipInstanceId(effectiveId);
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


/** GET /sync/drift — open drift findings (row value != its own newest field log). */
export async function driftListHandler(req: any, res: any) {
  const limit = Math.min(parseInt(req.query?.limit ?? '500', 10) || 500, 2000);
  res.json({ success: true, findings: await getOpenDrift(limit) });
}

/**
 * POST /sync/drift/scan — run the scan on demand.
 * Body: { vesselId?, tables?: string[], sinceDays?, maxRowsPerTable?, dryRun? }
 * dryRun=true reports without writing findings — safe to run against production to look.
 */
export async function driftScanHandler(req: any, res: any) {
  const b = req.body || {};
  const result = await runDriftScan({
    vesselId: b.vesselId,
    tables: Array.isArray(b.tables) ? b.tables : undefined,
    sinceDays: b.sinceDays ? parseInt(b.sinceDays, 10) : undefined,
    maxRowsPerTable: b.maxRowsPerTable ? parseInt(b.maxRowsPerTable, 10) : undefined,
    dryRun: b.dryRun === true,
  });
  res.json({ success: true, ...result });
}
