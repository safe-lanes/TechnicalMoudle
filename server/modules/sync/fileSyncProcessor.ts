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

  constructor(shoreUrl?: string) {
    this.instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
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

        // Read the file from local storage
        const fileBuffer = await this.readLocalFile(
          fileEntry.fileKey,
          fileEntry.tableName
        );
        if (!fileBuffer) {
          throw new Error(`File not found: ${fileEntry.fileKey}`);
        }

        // Calculate hash for verification
        const hash = crypto
          .createHash('sha256')
          .update(fileBuffer)
          .digest('hex');

        // Split into chunks
        const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE_BYTES);
        const startChunk = fileEntry.chunkOffset || 0; // Resume from last successful chunk
        const fileStart = Date.now();
        let deferred = false;

        for (let i = startChunk; i < totalChunks; i++) {
          // B-P0.1: per-file overall deadline. On exceed, DEFER (not fail) — persist the
          // resume offset, leave status 'pending', and move to the next file. This is NOT
          // counted as a retry, so a large file on a thin link keeps resuming across cycles
          // instead of burning its retry budget and going to 'failed'.
          if (Date.now() - fileStart > FILE_MAX_MS) {
            await syncRepo.updateFileStatus(fileEntry.queueUuid, 'pending', i);
            syncDiag(`FILE-SYNC DEFER: ${fileEntry.fileKey} exceeded ${FILE_MAX_MS}ms — resuming from chunk ${i}/${totalChunks} next cycle`);
            deferred = true;
            break;
          }
          const start = i * CHUNK_SIZE_BYTES;
          const end = Math.min(start + CHUNK_SIZE_BYTES, fileBuffer.length);
          const chunkData = fileBuffer.subarray(start, end).toString('base64');

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

          // Update progress
          await syncRepo.updateFileStatus(
            fileEntry.queueUuid,
            'in_progress',
            i + 1 // chunk_offset = next chunk to send
          );

          bytesTransferred += end - start;
        }

        if (deferred) continue; // per-file deadline hit — not completed, not failed; resumes next cycle

        // Mark completed
        await syncRepo.markFileCompleted(fileEntry.queueUuid);
        filesProcessed++;
        syncDiag(`FILE-SYNC OK: ${fileEntry.fileKey} — transferred ${fileBuffer.length} bytes in ${totalChunks} chunks`);
        console.log(
          `[FileSyncProcessor] Completed: ${fileEntry.fileName || fileEntry.fileKey} (${totalChunks} chunks, ${fileBuffer.length} bytes)`
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
   * Read a file from local storage.
   * Adapts based on tableName and the app's dual-backend storage.
   */
  private async readLocalFile(
    fileKey: string,
    tableName: string
  ): Promise<Buffer | null> {
    // WO docs use local:// prefix for local storage
    if (fileKey.startsWith('local://')) {
      const relativePath = fileKey.replace('local://', '');
      const baseDir = getStorageDir(tableName);
      const fullPath = path.join(baseDir, relativePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }

    // Try as a plain relative key under the appropriate directory
    const primaryDir = getStorageDir(tableName);
    const dirs = [primaryDir, ...[WO_DOCS_DIR, COMPONENT_DOCS_DIR, DEFECT_DOCS_DIR, CR_DOCS_DIR].filter(d => d !== primaryDir)];

    for (const dir of dirs) {
      const fullPath = path.join(dir, fileKey);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }

    // Try absolute path
    if (fs.existsSync(fileKey)) {
      return fs.readFileSync(fileKey);
    }

    // Object Storage files cannot be read locally without the GCS client.
    // In production, the file would need to be downloaded from Object Storage first.
    // For now, skip cloud-stored files and log a warning.
    console.warn(
      `[FileSyncProcessor] File not found locally: ${fileKey} (table: ${tableName}). ` +
        `If stored in Object Storage, cloud-to-cloud transfer is not yet implemented.`
    );
    return null;
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
        'X-Sync-Api-Key': process.env.SYNC_API_KEY || '',
        'X-Sync-Instance-Id': this.instanceId,
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.status}`);
    }
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
      let fileHash: string | null = null;
      let readable = false;
      try {
        const resolvedPath = fileKey.startsWith('local://')
          ? path.join(getStorageDir(tableName), fileKey.replace('local://', ''))
          : fileKey;
        if (fs.existsSync(resolvedPath)) {
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
