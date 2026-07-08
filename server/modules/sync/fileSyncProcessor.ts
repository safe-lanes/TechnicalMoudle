/**
 * File Sync Processor — Handles binary file transfer between ship and shore
 *
 * Architecture:
 * 1. When a file is uploaded to a BOTH_EDITABLE table (WO doc, component doc),
 *    it gets queued in sync_file_queue with status='pending'
 * 2. After field data sync completes (Phase 4), the file processor runs
 * 3. Files are chunked into 256KB pieces and transferred one chunk at a time
 * 4. If transfer is interrupted, it resumes from the last successful chunk
 * 5. After all chunks are received, the file is reassembled and verified via SHA-256 hash
 *
 * Storage backends:
 * - 'local' — filesystem under .private/wo-docs/ or .private/component-docs/
 * - 'object' — Replit Object Storage (GCS via signed URLs) — only on Replit
 *
 * Tables with real binary files:
 * - work_order_documents  — fileKey + storageBackend ('local' | 'object')
 * - component_documents   — fileKey + storageBackend ('local' | 'object')
 *
 * Tables with URL references (synced via field logging, binary sync if local://):
 * - defect_attachments    — url column (base64 data URI or local:// path)
 * - change_request_attachment — url column (base64 data URI or local:// path)
 *
 * Storage dirs per table mapped via getStorageDir() helper.
 *
 * Priority: Small files (<100KB) first, then by creation date
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as syncRepo from './repository';
import { syncDiag } from './syncDiagLogger';
import { isShipInstanceId } from './syncRole';

const CHUNK_SIZE_BYTES = 256 * 1024; // 256KB per chunk
const MAX_FILE_RETRIES = 3;
// Env-tunable file-sync limits. Defaults preserve prior behavior; healthy transfers
// (seconds) are unaffected — only a slow/stuck file on a degraded link is bounded.
const CHUNK_TIMEOUT_MS = parseInt(process.env.SYNC_FILE_CHUNK_TIMEOUT_MS || '', 10) || 30000; // A3: per 256KB chunk upload
const FILE_MAX_MS = parseInt(process.env.SYNC_FILE_MAX_MS || '', 10) || 120000;               // B-P0.1: per-file overall budget
// B-P2.2: optional size-based deferral (0 = off ⇒ no deferral) and inter-chunk pacing
// (0 = no delay ⇒ byte-identical send cadence). Both default-preserving. Chunk SIZE is never
// adaptive (it would break chunk_offset resume) — only the cadence (delay) is tunable.
const DEFER_BYTES = parseInt(process.env.SYNC_FILE_DEFER_BYTES || '', 10) || 0;
const CHUNK_DELAY_MS = parseInt(process.env.SYNC_FILE_CHUNK_DELAY_MS || '', 10) || 0;
// Size gate for the shore→ship pull drain: files <= this hold one "Sync Now" open until fully
// pulled+verified (normal attachments arrive in one press); larger files still transfer each
// cycle but don't block the drain's 0-condition. env fallback; the SyncEngine may override from
// sync_settings.sync_file_drain_max_bytes and pass it into pullQueue. Default 10MB.
export const DEFAULT_FILE_DRAIN_MAX_BYTES = parseInt(process.env.SYNC_FILE_DRAIN_MAX_BYTES || '', 10) || 10 * 1024 * 1024;
// Pull-side dead-letter: a file that fails/hash-mismatches this many pull attempts in a row is
// marked terminal 'failed' on the shore (not eternal pending-retry). Mirrors the push's
// DEAD_LETTER_AFTER. A dead-lettered file leaves 'pending', so it also drops out of the drain's
// size-gated 0-condition (a permanently-bad <=limit file can't hold Sync Now open).
const FILE_PULL_DEAD_LETTER_AFTER = 3;
const TEMP_DIR = path.resolve(process.cwd(), '.private', 'sync-temp');

// Storage base directories (match the app's conventions)
const WO_DOCS_DIR = path.resolve(process.cwd(), '.private', 'wo-docs');
const COMPONENT_DOCS_DIR = path.resolve(process.cwd(), '.private', 'component-docs');
const DEFECT_DOCS_DIR = path.resolve(process.cwd(), '.private', 'defect-docs');
const CR_DOCS_DIR = path.resolve(process.cwd(), '.private', 'cr-docs');

/** Resolve table name to its local file storage directory */
function getStorageDir(tableName: string): string {
  switch (tableName) {
    case 'component_documents': return COMPONENT_DOCS_DIR;
    case 'defect_attachments':  return DEFECT_DOCS_DIR;
    case 'change_request_attachment': return CR_DOCS_DIR;
    default: return WO_DOCS_DIR; // work_order_documents and fallback
  }
}

/**
 * Resolve a queued file to its existing LOCAL absolute path, or null if not present locally.
 * SINGLE SOURCE OF TRUTH — used by BOTH the enqueue readability pre-flight (queueFileForSync)
 * and the actual transfer (resolveLocalPath), so they can never disagree. Handles: local://
 * prefix (join storage dir), bare keys like "<code>/<file>" (join storage dir — the
 * component_documents case that was falsely marked 'unsendable'), and a last-ditch raw path.
 * Object-backed keys have no local copy → returns null (correctly stays 'unsendable').
 */
function resolveLocalFilePath(fileKey: string, tableName: string): string | null {
  if (fileKey.startsWith('local://')) {
    const fullPath = path.join(getStorageDir(tableName), fileKey.replace('local://', ''));
    if (fs.existsSync(fullPath)) return fullPath;
  }
  const primaryDir = getStorageDir(tableName);
  const dirs = [primaryDir, ...[WO_DOCS_DIR, COMPONENT_DOCS_DIR, DEFECT_DOCS_DIR, CR_DOCS_DIR].filter(d => d !== primaryDir)];
  for (const dir of dirs) {
    const fullPath = path.join(dir, fileKey);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  if (fs.existsSync(fileKey)) return fileKey;
  return null;
}

/** Streamed SHA-256 of a file (bounded memory) — same digest the push computes, so the pull's
 *  receiver-side verify is identical. Fallback for legacy queue rows that lack a stored file_hash. */
async function hashFileStreamed(filePath: string): Promise<string> {
  const hasher = crypto.createHash('sha256');
  const buf = Buffer.allocUnsafe(CHUNK_SIZE_BYTES);
  const fh = await fs.promises.open(filePath, 'r');
  try {
    let pos = 0;
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, CHUNK_SIZE_BYTES, pos);
      if (bytesRead <= 0) break;
      hasher.update(buf.subarray(0, bytesRead));
      pos += bytesRead;
    }
  } finally {
    await fh.close();
  }
  return hasher.digest('hex');
}

export interface FileChunk {
  queueUuid: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // base64 encoded chunk
  fileHash: string; // SHA-256 of complete file (for final verification)
  // File metadata — included so the RECEIVING side knows where to save the file
  // (the receiver doesn't have the sender's sync_file_queue entry)
  fileKey: string;
  tableName: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  vesselId: string | null;
}

export class FileSyncProcessor {
  private instanceId: string;
  private shoreUrl: string;
  private syncApiKey: string;

  constructor(shoreUrl?: string, instanceId?: string, syncApiKey?: string) {
    // Identity + key are passed by the SyncEngine (which loads them from DB settings —
    // Phase 4b per-tenant key); env fallback keeps legacy/unseeded behavior identical.
    this.instanceId = instanceId || process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    this.syncApiKey = syncApiKey || process.env.SYNC_API_KEY || '';
    // Shore URL can be passed by the SyncEngine (which loads from DB settings)
    // or fall back to the env var
    this.shoreUrl = shoreUrl || process.env.SYNC_SHORE_URL || '';
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  /**
   * Process all pending file transfers for a vessel.
   * Called AFTER field data sync is complete.
   */
  async processQueue(
    vesselId: string,
    _syncBatchId: string,
    phaseDeadlineMs?: number
  ): Promise<{
    filesProcessed: number;
    filesFailed: number;
    bytesTransferred: number;
  }> {
    let filesProcessed = 0;
    let filesFailed = 0;
    let bytesTransferred = 0;
    const phaseStart = Date.now();

    // Determine direction based on instance identity
    const direction = isShipInstanceId(this.instanceId)
      ? 'ship_to_shore'
      : 'shore_to_ship';
    const pendingFiles = await syncRepo.getPendingFiles(vesselId, direction, 50);

    syncDiag(`FILE-SYNC START: ${pendingFiles.length} pending files for vessel=${vesselId}, direction=${direction}`);
    console.log(
      `[FileSyncProcessor] ${pendingFiles.length} pending files for vessel ${vesselId} (${direction})`
    );

    for (const fileEntry of pendingFiles) {
      // B-P0.2: stop cleanly once the file-phase budget is exceeded — remaining files
      // stay 'pending' (resumable next cycle) and the sync cycle proceeds to completion.
      if (phaseDeadlineMs && Date.now() - phaseStart > phaseDeadlineMs) {
        syncDiag(`FILE-SYNC PHASE BUDGET HIT: stopping after ${filesProcessed} processed / ${filesFailed} failed; remaining files left pending (resumable)`);
        break;
      }
      try {
        syncDiag(`FILE-SYNC PROCESS: ${fileEntry.tableName}/${fileEntry.fileKey} (${fileEntry.fileSizeBytes || '?'} bytes) status=${fileEntry.status}`);
        await syncRepo.updateFileStatus(fileEntry.queueUuid, 'in_progress');

        // B-P2.1 / B-P2.3: resolve the local file. null = object-backed (no local copy) OR
        // deleted from disk after enqueue → mark TERMINAL 'unsendable' with a reason (surfaced
        // on the dashboard + health alert), NOT a silent retry-to-failed. This covers files that
        // become unreadable AFTER enqueue too (the enqueue-time guard is B-P1.2).
        const filePath = this.resolveLocalPath(fileEntry.fileKey, fileEntry.tableName);
        if (!filePath) {
          await syncRepo.updateFileStatus(
            fileEntry.queueUuid,
            'unsendable',
            fileEntry.chunkOffset || 0,
            'File not found in local storage at transfer (object-backed or deleted from disk)'
          );
          filesFailed++;
          syncDiag(`FILE-SYNC UNSENDABLE: ${fileEntry.fileKey} — not found in local storage`);
          console.warn(`[FileSyncProcessor] UNSENDABLE: ${fileEntry.fileName || fileEntry.fileKey} — file missing from local storage`);
          continue;
        }

        const fileSize = (await fs.promises.stat(filePath)).size;

        // B-P2.2: defer files over the (optional) size threshold to a later cycle. Default off
        // (0) ⇒ no deferral. Deferred = stays 'pending'/resumable, never 'failed'.
        if (DEFER_BYTES > 0 && fileSize > DEFER_BYTES) {
          await syncRepo.updateFileStatus(fileEntry.queueUuid, 'pending', fileEntry.chunkOffset || 0);
          syncDiag(`FILE-SYNC DEFER (size): ${fileEntry.fileKey} ${fileSize}B > ${DEFER_BYTES}B threshold — deferred to a later cycle`);
          continue;
        }

        // Chunk size is FIXED (CHUNK_SIZE_BYTES, never adaptive) so chunk_offset resume stays
        // valid across cycles. Stream with one open fd: bounded memory (one chunk), not the
        // whole file.
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES);
        const startChunk = fileEntry.chunkOffset || 0; // Resume from last successful chunk
        const fileStart = Date.now();
        let deferred = false;

        const fh = await fs.promises.open(filePath, 'r');
        try {
          // Pass 1: SHA-256 over the ENTIRE file, streamed. Byte-identical to the prior
          // whole-buffer hash, so the receiver's post-reassembly integrity check is unchanged.
          const hasher = crypto.createHash('sha256');
          const hbuf = Buffer.allocUnsafe(CHUNK_SIZE_BYTES);
          let hpos = 0;
          for (;;) {
            const { bytesRead } = await fh.read(hbuf, 0, CHUNK_SIZE_BYTES, hpos);
            if (bytesRead <= 0) break;
            hasher.update(hbuf.subarray(0, bytesRead));
            hpos += bytesRead;
          }
          const hash = hasher.digest('hex');

          // Pass 2: send chunks from startChunk, reading each at its fixed offset.
          const cbuf = Buffer.allocUnsafe(CHUNK_SIZE_BYTES);
          for (let i = startChunk; i < totalChunks; i++) {
            // B-P0.1: per-file overall deadline. On exceed, DEFER (not fail) — persist the
            // resume offset, leave status 'pending', and move to the next file.
            if (Date.now() - fileStart > FILE_MAX_MS) {
              await syncRepo.updateFileStatus(fileEntry.queueUuid, 'pending', i);
              syncDiag(`FILE-SYNC DEFER: ${fileEntry.fileKey} exceeded ${FILE_MAX_MS}ms — resuming from chunk ${i}/${totalChunks} next cycle`);
              deferred = true;
              break;
            }
            const start = i * CHUNK_SIZE_BYTES;
            const want = Math.min(CHUNK_SIZE_BYTES, fileSize - start);
            const { bytesRead } = await fh.read(cbuf, 0, want, start);
            const chunkData = cbuf.subarray(0, bytesRead).toString('base64');

            const chunk: FileChunk = {
              queueUuid: fileEntry.queueUuid,
              chunkIndex: i,
              totalChunks,
              data: chunkData,
              fileHash: hash,
              // Include file metadata so the RECEIVING side can save the file
              fileKey: fileEntry.fileKey,
              tableName: fileEntry.tableName,
              fileName: fileEntry.fileName ?? null,
              fileSizeBytes: fileEntry.fileSizeBytes ?? null,
              vesselId: fileEntry.vesselId ?? null,
            };

            // Send chunk (via sync API or local mode)
            await this.sendChunk(chunk);

            // Update progress (chunk_offset = next chunk to send)
            await syncRepo.updateFileStatus(fileEntry.queueUuid, 'in_progress', i + 1);
            bytesTransferred += bytesRead;

            // B-P2.2: optional gentle inter-chunk pacing for thin links (default 0 ⇒ no delay).
            if (CHUNK_DELAY_MS > 0 && i + 1 < totalChunks) {
              await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
            }
          }
        } finally {
          await fh.close();
        }

        if (deferred) continue; // per-file deadline hit — not completed, not failed; resumes next cycle

        // Mark completed
        await syncRepo.markFileCompleted(fileEntry.queueUuid);
        filesProcessed++;
        syncDiag(`FILE-SYNC OK: ${fileEntry.fileKey} — transferred ${fileSize} bytes in ${totalChunks} chunks (streamed)`);
        console.log(
          `[FileSyncProcessor] Completed: ${fileEntry.fileName || fileEntry.fileKey} (${totalChunks} chunks, ${fileSize} bytes)`
        );
      } catch (error: any) {
        filesFailed++;
        const retryCount = (fileEntry.retryCount || 0) + 1;
        const status = retryCount >= MAX_FILE_RETRIES ? 'failed' : 'pending';

        await syncRepo.updateFileStatus(
          fileEntry.queueUuid,
          status,
          fileEntry.chunkOffset || 0, // Keep current offset for resume
          error.message
        );

        // Increment retry count in DB
        try {
          await syncRepo.incrementRetryCount(fileEntry.queueUuid);
        } catch (_e) {
          // best-effort
        }

        syncDiag(`FILE-SYNC FAIL: ${fileEntry.fileKey} — ${error.message}`);
        console.error(
          `[FileSyncProcessor] Failed: ${fileEntry.fileName || fileEntry.fileKey} — ${error.message} (retry ${retryCount}/${MAX_FILE_RETRIES})`
        );
      }
    }

    syncDiag(`FILE-SYNC DONE: processed=${filesProcessed}, failed=${filesFailed}, bytes=${bytesTransferred}`);
    return { filesProcessed, filesFailed, bytesTransferred };
  }

  /**
   * Receive a file chunk from the other side.
   * Called by the sync API when a chunk arrives.
   */
  async receiveChunk(
    chunk: FileChunk
  ): Promise<{ received: boolean; complete: boolean }> {
    const tempPath = path.join(TEMP_DIR, chunk.queueUuid);

    // Create temp directory for this file's chunks
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }

    // Save chunk to temp storage
    const chunkFile = path.join(
      tempPath,
      `chunk_${String(chunk.chunkIndex).padStart(5, '0')}`
    );
    const chunkBuffer = Buffer.from(chunk.data, 'base64');
    fs.writeFileSync(chunkFile, chunkBuffer);

    console.log(
      `[FileSyncProcessor] Received chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} for ${chunk.queueUuid}`
    );

    // Ensure a mirror queue entry exists on the RECEIVING side for tracking.
    // The sender's sync_file_queue entry only exists in the sender's DB,
    // so the receiver needs its own record to track status and provide fileKey/tableName.
    try {
      const existing = await syncRepo.getFileQueueEntry(chunk.queueUuid);
      if (!existing && chunk.fileKey && chunk.tableName) {
        // Create a receiving-side queue entry with the same queueUuid
        const reverseDirection = isShipInstanceId(this.instanceId)
          ? 'shore_to_ship'
          : 'ship_to_shore';
        await syncRepo.queueFileWithUuid({
          queueUuid: chunk.queueUuid,
          tableName: chunk.tableName,
          rowUuid: chunk.queueUuid, // placeholder — actual rowUuid not needed for receive
          fileKey: chunk.fileKey,
          fileName: chunk.fileName,
          fileSizeBytes: chunk.fileSizeBytes,
          fileHash: chunk.fileHash,
          direction: reverseDirection,
          vesselId: chunk.vesselId,
          instanceId: this.instanceId,
          totalChunks: chunk.totalChunks,
          priority: 0,
        });
        console.log(`[FileSyncProcessor] Created mirror queue entry for ${chunk.queueUuid}`);
      }
    } catch (mirrorErr: any) {
      // Non-fatal — we can still save the file using chunk metadata
      console.warn(`[FileSyncProcessor] Mirror queue entry creation failed: ${mirrorErr.message}`);
    }

    // Check if all chunks received
    if (chunk.chunkIndex === chunk.totalChunks - 1) {
      // Reassemble the file
      const assembled = this.assembleChunks(tempPath, chunk.totalChunks);

      // Verify hash
      const hash = crypto
        .createHash('sha256')
        .update(assembled)
        .digest('hex');
      if (hash !== chunk.fileHash) {
        console.error(
          `[FileSyncProcessor] Hash mismatch for ${chunk.queueUuid}: expected ${chunk.fileHash}, got ${hash}`
        );
        // Clean up temp chunks
        fs.rmSync(tempPath, { recursive: true, force: true });
        return { received: true, complete: false };
      }

      // Resolve where to save the file.
      // Primary source: chunk metadata (always available in new protocol).
      // Fallback: queue entry in local DB (for backwards compatibility).
      let fileKey = chunk.fileKey;
      let tableName = chunk.tableName;

      if (!fileKey || !tableName) {
        const fileEntry = await syncRepo.getFileQueueEntry(chunk.queueUuid);
        if (fileEntry) {
          fileKey = fileEntry.fileKey;
          tableName = fileEntry.tableName;
        }
      }

      if (fileKey && tableName) {
        await this.saveLocalFile(fileKey, tableName, assembled);

        // Mark mirror queue entry as completed
        try {
          await syncRepo.markFileCompleted(chunk.queueUuid);
        } catch (_e) { /* best-effort */ }

        console.log(
          `[FileSyncProcessor] File assembled and saved: ${fileKey} (${assembled.length} bytes, hash verified)`
        );
      } else {
        console.error(
          `[FileSyncProcessor] Cannot save file ${chunk.queueUuid}: no fileKey/tableName in chunk or queue entry`
        );
      }

      // Clean up temp chunks
      fs.rmSync(tempPath, { recursive: true, force: true });
      return { received: true, complete: !!fileKey };
    }

    return { received: true, complete: false };
  }

  /**
   * Reassemble chunks into a single buffer.
   */
  private assembleChunks(tempPath: string, totalChunks: number): Buffer {
    const buffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = path.join(
        tempPath,
        `chunk_${String(i).padStart(5, '0')}`
      );
      buffers.push(fs.readFileSync(chunkFile));
    }
    return Buffer.concat(buffers);
  }

  /**
   * Resolve a queued file to its existing LOCAL path (mirrors the prior dual-backend
   * resolution). Returns the absolute path, or null when the file is not present locally —
   * i.e. object-backed (no local copy) OR deleted from disk after enqueue. Transfer streams
   * from this path instead of loading the whole file into memory. No object-storage fetch
   * (decided B-P2.1: ship files are local; a non-local file is flagged terminal upstream).
   */
  private resolveLocalPath(fileKey: string, tableName: string): string | null {
    // Delegates to the shared module-level resolver — behavior-identical, and guarantees the
    // enqueue pre-flight (queueFileForSync) and this transfer path use the exact same resolution.
    return resolveLocalFilePath(fileKey, tableName);
  }

  /**
   * Save a file to local storage.
   */
  private async saveLocalFile(
    fileKey: string,
    tableName: string,
    buffer: Buffer
  ): Promise<void> {
    let targetPath: string;

    if (fileKey.startsWith('local://')) {
      const relativePath = fileKey.replace('local://', '');
      const baseDir = getStorageDir(tableName);
      targetPath = path.join(baseDir, relativePath);
    } else {
      const baseDir = getStorageDir(tableName);
      targetPath = path.join(baseDir, fileKey);
    }

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, buffer);
    console.log(
      `[FileSyncProcessor] Saved file to local storage: ${targetPath}`
    );
  }

  /**
   * Send a chunk to the other side via sync API.
   */
  private async sendChunk(chunk: FileChunk): Promise<void> {
    const localMode = process.env.SYNC_LOCAL_MODE === 'true';

    if (localMode || !this.shoreUrl) {
      // Local mode — save chunk directly (simulates receive on "other side")
      await this.receiveChunk(chunk);
      return;
    }

    // Remote mode — HTTP call
    const response = await fetch(`${this.shoreUrl}/sync/file/upload-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Api-Key': this.syncApiKey,
        'X-Sync-Instance-Id': this.instanceId,
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SHORE→SHIP PULL — mirror of the ship→shore push (processQueue), in reverse.
  // The ship is the only sync initiator, so it PULLS shore_to_ship files. Reuses
  // receiveChunk (temp-store + reassemble + SHA-256 verify + saveLocalFile + mark mirror
  // completed) — no new transfer/hash/reassembly logic. Additive; the push path is untouched.
  // ═══════════════════════════════════════════════════════════════

  /** POST helper to the shore, reusing the exact auth headers the push (sendChunk) uses. */
  private async callShore(pathStr: string, body: any): Promise<any> {
    const response = await fetch(`${this.shoreUrl}${pathStr}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Api-Key': this.syncApiKey,
        'X-Sync-Instance-Id': this.instanceId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    });
    if (!response.ok) {
      const t = await response.text().catch(() => '');
      throw new Error(`${pathStr} ${response.status}: ${t.substring(0, 200)}`);
    }
    return response.json();
  }

  /**
   * SHORE side: list shore_to_ship 'pending' files for a vessel whose local file is present,
   * plus the count of pending files <= maxBytes (drives the size-gated drain). Read-only.
   */
  async listPendingForPull(
    vesselId: string,
    maxBytes: number
  ): Promise<{ files: any[]; remainingSmallCount: number }> {
    const pending = await syncRepo.getPendingFiles(vesselId, 'shore_to_ship', 50);
    const files: any[] = [];
    for (const f of pending) {
      const local = resolveLocalFilePath(f.fileKey, f.tableName);
      if (!local) continue; // not present on this side — can't serve; skip
      const size = f.fileSizeBytes ?? (await fs.promises.stat(local)).size;
      const totalChunks = f.totalChunks ?? Math.ceil(size / CHUNK_SIZE_BYTES);
      let fileHash = f.fileHash;
      if (!fileHash) fileHash = await hashFileStreamed(local); // legacy rows without a stored hash
      files.push({
        queueUuid: f.queueUuid, tableName: f.tableName, fileKey: f.fileKey,
        fileName: f.fileName ?? null, fileSizeBytes: size, totalChunks, fileHash,
      });
    }
    const remainingSmallCount = await syncRepo.getPendingFileCountBySize(vesselId, 'shore_to_ship', maxBytes);
    return { files, remainingSmallCount };
  }

  /**
   * SHORE side: read ONE chunk (fixed CHUNK_SIZE_BYTES offset) of a queued file. Mirror of the
   * push read; streams one chunk, never the whole file into memory.
   */
  async readChunkForPull(
    queueUuid: string,
    chunkIndex: number
  ): Promise<{ data: string; bytesRead: number } | null> {
    const entry = await syncRepo.getFileQueueEntry(queueUuid);
    if (!entry) return null;
    const local = resolveLocalFilePath(entry.fileKey, entry.tableName);
    if (!local) return null;
    const size = (await fs.promises.stat(local)).size;
    const start = chunkIndex * CHUNK_SIZE_BYTES;
    if (start >= size) return { data: '', bytesRead: 0 };
    const want = Math.min(CHUNK_SIZE_BYTES, size - start);
    const fh = await fs.promises.open(local, 'r');
    try {
      const buf = Buffer.allocUnsafe(want);
      const { bytesRead } = await fh.read(buf, 0, want, start);
      return { data: buf.subarray(0, bytesRead).toString('base64'), bytesRead };
    } finally {
      await fh.close();
    }
  }

  /**
   * SHIP side: pull shore_to_ship files from the shore. For each: resume from the ship mirror's
   * chunk_offset, download chunks, feed each into receiveChunk (reassemble + verify + save +
   * mark mirror completed on the last chunk), then tell the shore to mark completed. A file is
   * only saved/marked-done after its SHA-256 verifies — a partial/failed/mismatched download
   * saves NO file and stays 'pending' to retry. Size gate: files <= maxBytes are counted into
   * remainingSmall (hold the drain open); larger files still transfer each cycle but don't.
   */
  async pullQueue(
    vesselId: string,
    phaseDeadlineMs: number,
    maxBytes: number = DEFAULT_FILE_DRAIN_MAX_BYTES,
    retryCounts: Map<string, number> = new Map()
  ): Promise<{ filesProcessed: number; filesFailed: number; bytesTransferred: number; remainingSmall: number }> {
    // Only the ship pulls. Local mode: shore==ship share storage/DB → files already present;
    // just mark local shore_to_ship pending entries completed (no transfer).
    if (!isShipInstanceId(this.instanceId)) {
      return { filesProcessed: 0, filesFailed: 0, bytesTransferred: 0, remainingSmall: 0 };
    }
    const localMode = process.env.SYNC_LOCAL_MODE === 'true' || !this.shoreUrl;
    if (localMode) {
      let done = 0;
      const local = await syncRepo.getPendingFiles(vesselId, 'shore_to_ship', 50);
      for (const f of local) {
        if (resolveLocalFilePath(f.fileKey, f.tableName)) {
          await syncRepo.markFileCompleted(f.queueUuid);
          done++;
        }
      }
      syncDiag(`FILE-PULL (local mode): marked ${done} shore→ship files present`);
      return { filesProcessed: done, filesFailed: 0, bytesTransferred: 0, remainingSmall: 0 };
    }

    const phaseStart = Date.now();
    let filesProcessed = 0, filesFailed = 0, bytesTransferred = 0, smallResolved = 0;
    let remainingSmallCount = 0;

    let listResp: { files: any[]; remainingSmallCount: number };
    try {
      listResp = await this.callShore('/sync/file/pending', { vesselId, maxBytes });
    } catch (err: any) {
      syncDiag(`FILE-PULL: list request failed — ${err.message}`);
      return { filesProcessed, filesFailed, bytesTransferred, remainingSmall: 0 };
    }
    const files = listResp.files || [];
    remainingSmallCount = listResp.remainingSmallCount || 0;
    syncDiag(`FILE-PULL START: ${files.length} shore→ship file(s) for vessel=${vesselId} (remainingSmall=${remainingSmallCount}, maxBytes=${maxBytes})`);

    for (const f of files) {
      if (phaseDeadlineMs && Date.now() - phaseStart > phaseDeadlineMs) {
        syncDiag(`FILE-PULL PHASE BUDGET HIT: remaining files stay pending (resumable)`);
        break;
      }
      const isSmall = (f.fileSizeBytes ?? 0) <= maxBytes;
      // Dead-letter after N consecutive failures (mirrors the push). Returns true if the file was
      // dead-lettered (marked 'failed' on the shore) — then it leaves 'pending' and drops out of
      // the size-gated drain count too. Returns false to keep retrying (stays 'pending').
      const registerFailure = async (reason: string): Promise<boolean> => {
        const n = (retryCounts.get(f.queueUuid) || 0) + 1;
        if (n >= FILE_PULL_DEAD_LETTER_AFTER) {
          retryCounts.delete(f.queueUuid);
          try { await this.callShore(`/sync/file/${f.queueUuid}/fail`, { reason: `${reason} (x${n})` }); } catch { /* best-effort */ }
          syncDiag(`⚠️ FILE-PULL DEAD-LETTER: ${f.fileKey} — ${n} failed pulls (${reason}); marked 'failed' on shore. NEEDS MANUAL REVIEW.`);
          console.error(`[FileSyncProcessor] ⚠️ DEAD-LETTER pull ${f.fileName || f.fileKey} after ${n} attempts (${reason}) — marked failed, drops from drain.`);
          return true;
        }
        retryCounts.set(f.queueUuid, n);
        return false;
      };
      try {
        syncDiag(`FILE-PULL PROCESS: ${f.tableName}/${f.fileKey} (${f.fileSizeBytes} bytes, ${f.totalChunks} chunks, ${isSmall ? 'small' : 'large'})`);
        // Resume from the ship mirror entry's chunk_offset (mirrors the push's resume). The mirror
        // is created by receiveChunk on the first chunk; on resume it already exists.
        const mirror = await syncRepo.getFileQueueEntry(f.queueUuid);
        const startChunk = mirror?.chunkOffset || 0;
        const fileStart = Date.now();
        let complete = false, deferred = false;

        for (let i = startChunk; i < f.totalChunks; i++) {
          if (Date.now() - fileStart > FILE_MAX_MS) {
            // Per-file budget: DEFER (not fail) — offset persists, resumes next cycle so even a
            // large file always makes progress and eventually completes; never deferred forever.
            syncDiag(`FILE-PULL DEFER: ${f.fileKey} exceeded ${FILE_MAX_MS}ms — resume from chunk ${i}/${f.totalChunks} next cycle`);
            deferred = true;
            break;
          }
          const c = await this.callShore('/sync/file/download-chunk', { queueUuid: f.queueUuid, chunkIndex: i });
          if (!c || c.data === undefined) throw new Error(`download-chunk ${i} returned no data`);
          const chunk: FileChunk = {
            queueUuid: f.queueUuid, chunkIndex: i, totalChunks: f.totalChunks,
            data: c.data, fileHash: f.fileHash, fileKey: f.fileKey, tableName: f.tableName,
            fileName: f.fileName ?? null, fileSizeBytes: f.fileSizeBytes ?? null, vesselId,
          };
          const res = await this.receiveChunk(chunk); // REUSE: temp-store; last chunk → verify+save+mark mirror
          bytesTransferred += c.bytesRead || 0;
          if (i < f.totalChunks - 1) {
            await syncRepo.updateFileStatus(f.queueUuid, 'in_progress', i + 1); // resume tracking (non-last)
          } else {
            complete = res.complete; // receiveChunk already marked the mirror completed (if hash OK)
          }
        }

        if (deferred) continue; // makes progress; not completed, not failed
        if (complete) {
          await this.callShore(`/sync/file/${f.queueUuid}/complete`, {}); // shore marks done → stops re-offering
          retryCounts.delete(f.queueUuid);
          filesProcessed++;
          if (isSmall) smallResolved++;
          syncDiag(`FILE-PULL OK: ${f.fileKey} — ${f.fileSizeBytes} bytes in ${f.totalChunks} chunks (hash verified)`);
        } else {
          // Hash mismatch — receiveChunk discarded temp and did NOT save/mark. Count a failure;
          // dead-letter at N, else reset offset for a clean re-download (shore stays 'pending').
          filesFailed++;
          const deadLettered = await registerFailure('hash mismatch');
          if (deadLettered) { if (isSmall) smallResolved++; }
          else { await syncRepo.updateFileStatus(f.queueUuid, 'pending', 0, 'Hash mismatch on pull — will re-download'); }
        }
      } catch (err: any) {
        filesFailed++;
        // Network/download error — dead-letter at N, else leave offset for resume (shore stays 'pending').
        const deadLettered = await registerFailure(err.message);
        if (deadLettered && isSmall) smallResolved++;
        syncDiag(`FILE-PULL FAIL: ${f.fileKey} — ${err.message}${deadLettered ? ' (dead-lettered)' : ' (offset preserved for resume; shore stays pending)'}`);
      }
    }

    const remainingSmall = Math.max(0, remainingSmallCount - smallResolved);
    syncDiag(`FILE-PULL DONE: processed=${filesProcessed}, failed=${filesFailed}, bytes=${bytesTransferred}, remainingSmall=${remainingSmall}`);
    return { filesProcessed, filesFailed, bytesTransferred, remainingSmall };
  }

  /**
   * Queue a file for sync when it's uploaded to a BOTH_EDITABLE table.
   * Called by upload handlers in WO docs, component docs, etc.
   *
   * Best-effort: failures do NOT block the upload.
   */
  static async queueFileForSync(
    tableName: string,
    rowUuid: string,
    fileKey: string,
    fileName: string | null,
    fileSizeBytes: number | null,
    vesselId: string | null
  ): Promise<void> {
    try {
      const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
      const direction = isShipInstanceId(instanceId)
        ? 'ship_to_shore'
        : 'shore_to_ship';

      // Priority: small files first
      let priority = 0;
      if (fileSizeBytes) {
        if (fileSizeBytes < 100 * 1024) priority = 10; // <100KB — high priority
        else if (fileSizeBytes < 1024 * 1024) priority = 5; // <1MB — medium
        else priority = 1; // >1MB — low
      }

      // Calculate file hash if file exists locally + record local readability.
      // Use the SAME resolver as the actual transfer (resolveLocalFilePath) so a file that IS
      // present is never falsely marked 'unsendable'. The old naive `: fileKey` branch missed
      // bare component_documents keys ("<code>/<file>") that live under getStorageDir(tableName).
      let fileHash: string | null = null;
      let readable = false;
      try {
        const resolvedPath = resolveLocalFilePath(fileKey, tableName);
        if (resolvedPath) {
          readable = true;
          const buffer = fs.readFileSync(resolvedPath);
          fileHash = crypto
            .createHash('sha256')
            .update(buffer)
            .digest('hex');
        }
      } catch {
        // Hash calculation is best-effort
      }

      // B-P1.2 pre-flight: a SHIP-side file that isn't readable in local storage can
      // never be pushed (object-backed or missing on disk). Enqueue it as terminal
      // 'unsendable' with a clear reason instead of letting it sit 'pending' and silently
      // retry to 'failed'. Shore behavior is unchanged (only ship_to_shore is gated).
      let status: string | undefined;
      let lastError: string | undefined;
      if (direction === 'ship_to_shore' && !readable) {
        status = 'unsendable';
        lastError = 'File not readable in local storage at enqueue (object-backed or missing) — cannot push to shore.';
        console.warn(`[FileSyncProcessor] UNSENDABLE at enqueue: ${fileName || fileKey} (${tableName}) — not locally readable`);
      }

      // Calculate total chunks
      const totalChunks = fileSizeBytes
        ? Math.ceil(fileSizeBytes / CHUNK_SIZE_BYTES)
        : null;

      await syncRepo.queueFile({
        tableName,
        rowUuid,
        fileKey,
        fileName,
        fileSizeBytes,
        fileHash,
        direction,
        vesselId,
        instanceId,
        totalChunks,
        priority,
        status,
        lastError,
      });

      console.log(
        `[FileSyncProcessor] Queued for sync: ${fileName || fileKey} (${direction}, priority ${priority})`
      );
    } catch (error: any) {
      // Best-effort — file queuing failure must NEVER block the upload
      console.error(
        `[FileSyncProcessor] Failed to queue file for sync: ${error.message}`
      );
    }
  }
}
